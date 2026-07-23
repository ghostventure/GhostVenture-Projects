from __future__ import annotations

import os
import re
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable, Iterable

from .config import BotConfig, load_config
from .readiness import readiness_flags


SECRET_PATTERN = re.compile(
    r"(?i)(app[_-]?key|app[_-]?secret|password|passwd|token|account[_-]?id|authorization|bearer)"
)


@dataclass(frozen=True)
class HealthSignal:
    name: str
    level: str
    summary: str
    detail: str = ""


@dataclass(frozen=True)
class SingleProcessState:
    lock_path: str
    pid: int | None
    mode: str | None
    is_running: bool
    status: str


@dataclass(frozen=True)
class CrashRecoveryReport:
    log_path: str
    exists: bool
    last_seen_at: str | None
    summary: str
    excerpt: str = ""


@dataclass(frozen=True)
class RuntimeHealth:
    generated_at: str
    safe_mode: bool
    overall: str
    signals: list[HealthSignal] = field(default_factory=list)
    single_process: SingleProcessState | None = None
    crash_recovery: CrashRecoveryReport | None = None
    market_session: dict | None = None

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class SystemCheckResult:
    passed: bool
    blockers: list[str]
    warnings: list[str]
    health: RuntimeHealth


def runtime_home(value: str | Path | None = None) -> Path:
    return Path(value or os.getenv("TIMMY_HOME", Path.cwd())).expanduser().resolve()


def safe_mode_enabled(env: dict[str, str] | None = None) -> bool:
    env = env or os.environ
    return _truthy(env.get("TIMMY_SAFE_MODE"))


def safe_mode_overrides() -> dict[str, str]:
    return {
        "TRADER_MODE": "paper",
        "TRADER_LIVE": "0",
        "WEBULL_ENABLE_LIVE_ORDERS": "0",
        "AUTO_START_LIVE_ON_MARKET_OPEN": "0",
    }


def apply_safe_mode_environment(env: dict[str, str] | None = None) -> dict[str, str]:
    target = env if env is not None else os.environ
    target.update(safe_mode_overrides())
    target["TIMMY_SAFE_MODE"] = "1"
    return target


def pre_market_system_check(
    home: str | Path | None = None,
    config: BotConfig | None = None,
    plans_count: int = 0,
    events_count: int = 0,
    hooks: Iterable[Callable[[], HealthSignal | Iterable[HealthSignal] | None]] = (),
) -> SystemCheckResult:
    health = build_runtime_health(
        home=home,
        config=config,
        plans_count=plans_count,
        events_count=events_count,
        extra_signals=_run_health_hooks(hooks),
    )
    blockers = [signal.summary for signal in health.signals if signal.level == "block"]
    warnings = [signal.summary for signal in health.signals if signal.level == "warn"]
    return SystemCheckResult(not blockers, blockers, warnings, health)


def build_runtime_health(
    home: str | Path | None = None,
    config: BotConfig | None = None,
    plans_count: int = 0,
    events_count: int = 0,
    extra_signals: Iterable[HealthSignal] = (),
    now: datetime | None = None,
) -> RuntimeHealth:
    home_path = runtime_home(home)
    now = _aware_utc(now)
    if config is None:
        config = load_config()

    safe_mode = safe_mode_enabled()
    readiness = readiness_flags(config, plans_count=plans_count, events_count=events_count)
    signals: list[HealthSignal] = []

    if safe_mode:
        signals.append(HealthSignal("safe_mode", "warn", "Safe mode is active.", "Live automation is forced off."))

    red_flags = readiness.get("red_flags", [])
    green_flags = readiness.get("green_flags", [])
    signals.append(
        HealthSignal(
            "readiness",
            "block" if red_flags else "ok",
            f"{len(green_flags)} ready flag(s), {len(red_flags)} blocker(s).",
            "; ".join(red_flags[:5]),
        )
    )

    signals.append(_credential_expiry_signal(now))
    single_process = inspect_single_process(home_path)
    signals.append(_single_process_signal(single_process))
    crash_report = crash_recovery_report(home_path)
    if crash_report.exists:
        signals.append(HealthSignal("crash_recovery", "warn", "Crash log is present.", crash_report.summary))
    else:
        signals.append(HealthSignal("crash_recovery", "ok", "No crash recovery log is present."))
    signals.extend(extra_signals)

    return RuntimeHealth(
        generated_at=now.isoformat(),
        safe_mode=safe_mode,
        overall=_overall(signals),
        signals=signals,
        single_process=single_process,
        crash_recovery=crash_report,
        market_session=readiness.get("market_session"),
    )


def inspect_single_process(home: str | Path | None = None) -> SingleProcessState:
    home_path = runtime_home(home)
    lock_path = home_path / "timmy.lock"
    pid = None
    mode = None
    try:
        lines = lock_path.read_text(encoding="utf-8").splitlines()
    except FileNotFoundError:
        return SingleProcessState(str(lock_path), None, None, False, "missing-lock")

    for line in lines:
        if line.startswith("pid="):
            try:
                pid = int(line.removeprefix("pid=").strip())
            except ValueError:
                pid = None
        elif line.startswith("mode="):
            mode = line.removeprefix("mode=").strip() or None

    if pid is None:
        return SingleProcessState(str(lock_path), None, mode, False, "invalid-lock")
    running = _process_exists(pid)
    return SingleProcessState(str(lock_path), pid, mode, running, "running" if running else "stale-lock")


def crash_recovery_report(home: str | Path | None = None, max_excerpt_lines: int = 8) -> CrashRecoveryReport:
    home_path = runtime_home(home)
    log_path = home_path / "timmy-crash.log"
    try:
        lines = log_path.read_text(encoding="utf-8", errors="replace").splitlines()
    except FileNotFoundError:
        return CrashRecoveryReport(str(log_path), False, None, "No crash log found.")

    non_empty = [line for line in lines if line.strip()]
    last_seen_at = None
    for line in reversed(non_empty):
        if line.startswith("[") and "]" in line:
            last_seen_at = line[1:line.index("]")]
            break
    excerpt = "\n".join(_redact(line) for line in non_empty[-max_excerpt_lines:])
    return CrashRecoveryReport(str(log_path), True, last_seen_at, "Last crash details are available locally.", excerpt)


def _credential_expiry_signal(now: datetime) -> HealthSignal:
    expiry = _first_expiry("WEBULL_TOKEN_EXPIRES_AT", "WEBULL_ACCESS_TOKEN_EXPIRES_AT", "WEBULL_CREDENTIAL_EXPIRES_AT")
    if expiry is None:
        return HealthSignal("credential_expiry", "warn", "Credential expiry is unknown.", "Run a broker check before live automation.")
    remaining = expiry - now
    if remaining <= timedelta():
        return HealthSignal("credential_expiry", "block", "Broker credential window appears expired.")
    if remaining <= timedelta(hours=24):
        return HealthSignal("credential_expiry", "warn", "Broker credential window expires soon.")
    return HealthSignal("credential_expiry", "ok", "Broker credential expiry window is current.")


def _first_expiry(*keys: str) -> datetime | None:
    for key in keys:
        parsed = _parse_datetime(os.getenv(key, ""))
        if parsed is not None:
            return parsed
    return None


def _parse_datetime(value: str) -> datetime | None:
    value = value.strip()
    if not value:
        return None
    if value.isdigit():
        try:
            return datetime.fromtimestamp(int(value), tz=timezone.utc)
        except (OSError, OverflowError, ValueError):
            return None
    try:
        return _aware_utc(datetime.fromisoformat(value.replace("Z", "+00:00")))
    except ValueError:
        return None


def _single_process_signal(state: SingleProcessState) -> HealthSignal:
    if state.status == "running":
        return HealthSignal("single_process", "ok", "Single-process guard is active.", f"PID {state.pid}")
    if state.status == "stale-lock":
        return HealthSignal("single_process", "warn", "Single-process lock is stale.", "Watchdog can replace it on next launch.")
    return HealthSignal("single_process", "warn", "Single-process guard is not visible.", state.status)


def _run_health_hooks(hooks: Iterable[Callable[[], HealthSignal | Iterable[HealthSignal] | None]]) -> list[HealthSignal]:
    signals: list[HealthSignal] = []
    for hook in hooks:
        try:
            result = hook()
        except Exception as exc:
            signals.append(HealthSignal("system_check_hook", "block", "System check hook failed.", _redact(str(exc))))
            continue
        if result is None:
            continue
        if isinstance(result, HealthSignal):
            signals.append(result)
        else:
            signals.extend(result)
    return signals


def _overall(signals: Iterable[HealthSignal]) -> str:
    levels = {signal.level for signal in signals}
    if "block" in levels:
        return "blocked"
    if "warn" in levels:
        return "guarded"
    return "ready"


def _truthy(value: str | None) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def _process_exists(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


def _aware_utc(value: datetime | None) -> datetime:
    value = value or datetime.now(timezone.utc)
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _redact(value: str) -> str:
    parts = []
    for token in str(value).split():
        if SECRET_PATTERN.search(token):
            parts.append("[redacted]")
        else:
            parts.append(token)
    redacted = " ".join(parts)
    return re.sub(r"\b\d{6,}\b", "[redacted-id]", redacted)
