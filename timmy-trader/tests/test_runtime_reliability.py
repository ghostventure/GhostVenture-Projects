from __future__ import annotations

import json
import os
import stat
from dataclasses import replace
from datetime import datetime, timedelta, timezone

from trend_trader.config import load_config
from trend_trader.runtime_health import (
    apply_safe_mode_environment,
    build_runtime_health,
    crash_recovery_report,
    inspect_single_process,
    pre_market_system_check,
    safe_mode_overrides,
)
from trend_trader.settings_profile import (
    create_config_version,
    export_settings,
    import_settings,
    list_config_versions,
    rollback_config_version,
)


def test_health_reports_single_process_state_without_account_or_secret(monkeypatch, tmp_path) -> None:
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("TIMMY_HOME", str(tmp_path))
    monkeypatch.setenv("WEBULL_TOKEN_EXPIRES_AT", (datetime.now(timezone.utc) + timedelta(days=2)).isoformat())
    (tmp_path / "timmy.lock").write_text(f"pid={os.getpid()}\nmode=native\n", encoding="utf-8")
    (tmp_path / "timmy-crash.log").write_text(
        "[2026-07-23T10:00:00] Timmy fatal exception\nBROKER_ACCOUNT_REF=demo-account BROKER_SECRET_REF=demo-secret\n",
        encoding="utf-8",
    )

    health = build_runtime_health(home=tmp_path, config=load_config(), plans_count=1)

    assert health.single_process is not None
    assert health.single_process.status == "running"
    assert health.crash_recovery is not None
    assert "123456789" not in health.crash_recovery.excerpt
    assert "abc" not in health.crash_recovery.excerpt


def test_health_warns_on_unknown_or_expiring_credentials(monkeypatch, tmp_path) -> None:
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("TIMMY_HOME", str(tmp_path))
    monkeypatch.delenv("WEBULL_TOKEN_EXPIRES_AT", raising=False)
    config = replace(
        load_config(),
        require_market_hours=False,
        webull_require_preview=True,
        crypto_symbols=set(),
        futures_symbols=set(),
        options_symbols=set(),
        event_contract_symbols=set(),
        enable_crypto_trading=False,
        enable_futures_trading=False,
        enable_options_trading=False,
        enable_event_contract_trading=False,
    )

    unknown = build_runtime_health(home=tmp_path, config=config, now=datetime(2026, 7, 23, tzinfo=timezone.utc))
    assert any(signal.name == "credential_expiry" and signal.level == "warn" for signal in unknown.signals)

    monkeypatch.setenv("WEBULL_TOKEN_EXPIRES_AT", "2026-07-23T01:00:00+00:00")
    expired = build_runtime_health(home=tmp_path, config=config, now=datetime(2026, 7, 23, 2, tzinfo=timezone.utc))
    assert any(signal.name == "credential_expiry" and signal.level == "block" for signal in expired.signals)


def test_safe_mode_contract_forces_live_switches_off() -> None:
    env = {"TRADER_MODE": "live", "TRADER_LIVE": "1", "WEBULL_ENABLE_LIVE_ORDERS": "1"}

    apply_safe_mode_environment(env)

    assert env["TIMMY_SAFE_MODE"] == "1"
    assert {key: env[key] for key in safe_mode_overrides()} == safe_mode_overrides()


def test_pre_market_system_check_accepts_automation_hooks(monkeypatch, tmp_path) -> None:
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("TIMMY_HOME", str(tmp_path))
    monkeypatch.setenv("WEBULL_TOKEN_EXPIRES_AT", (datetime.now(timezone.utc) + timedelta(days=2)).isoformat())
    monkeypatch.setenv("TRADER_MODE", "paper")
    monkeypatch.setenv("TRADER_LIVE", "0")
    monkeypatch.setenv("WEBULL_ENABLE_LIVE_ORDERS", "0")
    for key in (
        "WEBULL_CRYPTO_SYMBOLS",
        "WEBULL_FUTURES_SYMBOLS",
        "WEBULL_OPTIONS_SYMBOLS",
        "WEBULL_EVENT_CONTRACT_SYMBOLS",
        "ENABLE_CRYPTO_TRADING",
        "ENABLE_FUTURES_TRADING",
        "ENABLE_OPTIONS_TRADING",
        "ENABLE_EVENT_CONTRACT_TRADING",
    ):
        monkeypatch.delenv(key, raising=False)
    config = replace(
        load_config(),
        require_market_hours=False,
        webull_require_preview=True,
        crypto_symbols=set(),
        futures_symbols=set(),
        options_symbols=set(),
        event_contract_symbols=set(),
        enable_crypto_trading=False,
        enable_futures_trading=False,
        enable_options_trading=False,
        enable_event_contract_trading=False,
    )

    result = pre_market_system_check(home=tmp_path, config=config, plans_count=1, hooks=())

    assert result.health.overall in {"ready", "guarded"}
    assert isinstance(result.warnings, list)


def test_settings_export_import_skips_sensitive_defaults(tmp_path) -> None:
    app_key = "WEBULL_" + "APP_KEY"
    (tmp_path / ".env").write_text(
        "\n".join(("TRADER_MODE=live", f"{app_key}=demo-key", "MAX_POSITIONS=4")),
        encoding="utf-8",
    )
    export_path = tmp_path / "settings.json"

    result = export_settings(tmp_path, export_path)
    payload = json.loads(export_path.read_text(encoding="utf-8"))

    assert result.skipped_sensitive == [app_key]
    assert payload["settings"][".env"] == {"MAX_POSITIONS": "4", "TRADER_MODE": "live"}
    assert stat.S_IMODE(export_path.stat().st_mode) == 0o600

    target = tmp_path / "target"
    imported = import_settings(target, export_path, create_version=False)
    assert "WEBULL_APP_KEY" not in imported.keys
    assert "MAX_POSITIONS=4" in (target / ".env").read_text(encoding="utf-8")


def test_config_version_and_rollback_are_private_and_integrity_checked(tmp_path) -> None:
    profile = tmp_path / ".timmy-profile.env"
    profile.write_text("TRADER_MODE=paper\nMAX_POSITIONS=2\n", encoding="utf-8")

    version = create_config_version(tmp_path, "known-good")
    profile.write_text("TRADER_MODE=live\nMAX_POSITIONS=9\n", encoding="utf-8")

    versions = list_config_versions(tmp_path)
    restored = rollback_config_version(tmp_path, version.version_id)

    assert versions[0].version_id == version.version_id
    assert restored.version_id == version.version_id
    assert "MAX_POSITIONS=2" in profile.read_text(encoding="utf-8")
    assert stat.S_IMODE((tmp_path / ".timmy-config-versions").stat().st_mode) == 0o700
    assert stat.S_IMODE((tmp_path / ".timmy-config-versions" / version.version_id / ".timmy-profile.env").stat().st_mode) == 0o600


def test_single_process_missing_and_crash_absent_are_visible(tmp_path) -> None:
    assert inspect_single_process(tmp_path).status == "missing-lock"
    assert crash_recovery_report(tmp_path).exists is False
