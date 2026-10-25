from __future__ import annotations

import hashlib
import hmac
import csv
import json
import math
import os
import secrets
import subprocess
import sys
import tempfile
import threading
import tkinter as tk
import tkinter.font as tkfont
import traceback
from uuid import uuid4
from collections import deque
from collections.abc import Iterable
from dataclasses import asdict, dataclass, is_dataclass, replace
from datetime import datetime, timedelta
from pathlib import Path
from tkinter import filedialog, messagebox, simpledialog, ttk
from zoneinfo import ZoneInfo

from .asset_classes import asset_profile, enabled_asset_classes
from .alerts import ALERT_RULE_TEMPLATES, AlertStore, alert_rule_from_template, filter_alert_events
from .brokers.paper import PaperBroker
from .brokers.simulation import SimulationBroker
from .brokers.webull_openapi import WebullOpenApiBroker
from .config import BotConfig, load_config
from .data import load_csv_bars, write_csv_bars
from .data_quality import summarize_candle_quality
from .risk import AutomationRiskContext, AutomationRiskDecision, AutomationRiskLimits, evaluate_automation_order
from .market_guards import PositionSnapshot
from .market_calendar import market_session, market_session_calendar, seconds_until_next_open
from .market_data import fetch_daily_bars
from .market_universe import fetch_us_listed_symbols, load_bundled_us_listed_instruments, load_bundled_us_listed_symbols
from .movement_tracker import (
    CROSS_ASSET_SYMBOLS,
    MovementTrackerError,
    movement_scan_summary,
    refresh_movement_tracker,
    recent_mover_symbols,
    top_movement_candidates,
    top_upside_setups,
)
from .models import OrderPlan, Signal
from .diagnostics import inspect_trade_ready, why_no_trade
from .decision_insights import chart_context, compare_symbols, explain_blockers, explain_signal, paper_performance, position_what_if
from .decision_audit import audit_signal_decision
from .automation_insights import analyze_automation_history
from .automation_backend import AutomationCycleSnapshot, build_automation_backend_view
from .paper_journal_summary import summarize_paper_journal
from .portfolio_consistency import summarize_closed_paper_events, summarize_paper_period_returns
from .shortcut_help import ShortcutHelpRegistry
from .journal_filters import JournalFilterState, filter_journal_events
from .readiness import readiness_flags
from .risk import create_order_plan, enforce_live_guards
from .risk_planning_lab import RiskPlanningLab
from .runtime_health import build_runtime_health, pre_market_system_check
from .sample_data import write_sample_bars
from .strategy import rank_signals
from .strategy_presets import list_strategy_presets
from .updates import check_and_install_update
from .symbol_notes import SymbolNotesStore
from .scanner_presets import ScannerPresetStore, ScannerTablePresetStore
from .scanner_view_state import make_scanner_view, scanner_view_from_dict, scanner_view_to_dict
from .settings_backups import backup_raw_ui_settings, backup_ui_settings
from .settings_profile import create_config_version, list_config_versions, rollback_config_version
from .operations_review import daily_activity_brief, mask_identifier, order_timeline, redact, recovery_steps, save_journal_review, support_event_summary
from .trader_profile_score import (
    calculate_trader_profile_score,
    recommend_trader_scorecard_next_steps,
)
from .watchlist import DEFAULT_ROTATION_CANDIDATES, load_watchlist, rotate_watchlist, write_watchlist, write_watchlist_template
from .workspace_tools import ActionRegistry, WorkspaceStore
from .research_workbench import (
    ScanCoverageStore,
    compare_symbol_groups,
    merge_imported_candles,
    preview_csv_import,
    provider_evidence,
    redacted_research_snapshot,
)
from .watchlist_organization import WatchlistOrganizationStore
from .watchlist_change_explanations import explain_membership_changes
from .webull_watchlists import sync_generated_watchlists

AUTO_REFRESH_MS = max(30, int(os.getenv("TIMMY_DASHBOARD_REFRESH_SECONDS", "60"))) * 1000
ACCOUNT_REFRESH_MS = max(5, int(os.getenv("TIMMY_ACCOUNT_REFRESH_MINUTES", "15"))) * 60 * 1000
AUTOMATION_RETRY_MS = 5_000
AUTOMATION_RECOVERY_MS = 30_000
LIVE_PREVIEW_TTL_SECONDS = 180
TRADING_PRINCIPLE = "Make money, but never be reckless, clumsy, or wasteful."


@dataclass(frozen=True)
class MarketRefreshOutcome:
    state: str
    requested: int = 0
    returned: int = 0
    cached_symbols: int = 0
    issues: tuple[dict, ...] = ()
    returned_symbols: tuple[str, ...] = ()


@dataclass(frozen=True)
class AutomationMarketSnapshot:
    """Immutable market inputs prepared away from the Tk event loop."""
    config: BotConfig
    bars_by_symbol: tuple[tuple[str, tuple], ...]
    signals: tuple
    synthetic_data: bool
    data_error: str
    refresh_outcome: MarketRefreshOutcome | None
    refresh_error: str
    candidate_signals: tuple = ()


@dataclass(frozen=True)
class LiveAutomationJob:
    """Serialized order intent captured before any worker-side broker call."""
    config: BotConfig
    risk_limits: AutomationRiskLimits
    plan_json: tuple[str, ...]
    signal_json: tuple[str, ...]
    data_quality_json: tuple[str, ...]
    activity_blocks: tuple[tuple[str, ...], ...]
    last_symbol_trade_json: tuple[str, ...]
    candle_timestamps: tuple[str, ...]
    cancelled: threading.Event


@dataclass(frozen=True)
class LiveAutomationWorkerResult:
    result_text: str
    results_json: str
    hold_reason: str = ""
    cancelled: bool = False
    lifecycle_summary: str = ""
    risk_decision: AutomationRiskDecision | None = None
    broker_orders_json: str = "null"
    broker_positions_json: str = "null"


def _write_private_json(path: Path, payload: dict) -> None:
    """Atomically replace a private runtime JSON file without partial writes."""
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            os.fchmod(stream.fileno(), 0o600)
            json.dump(payload, stream, indent=2, sort_keys=True)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        try:
            directory_fd = os.open(path.parent, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
        except OSError:
            return
        try:
            os.fsync(directory_fd)
        except OSError:
            pass
        finally:
            os.close(directory_fd)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def _write_private_text(path: Path, content: str) -> None:
    """Atomically replace a private text file, including credential files."""
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            os.fchmod(stream.fileno(), 0o600)
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        try:
            directory_fd = os.open(path.parent, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
        except OSError:
            return
        try:
            os.fsync(directory_fd)
        except OSError:
            pass
        finally:
            os.close(directory_fd)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


class TimmyNativeApp:
    def __init__(self, home: Path) -> None:
        self.home = home
        self.data_file = home / "examples" / "sample_bars.csv"
        self.sample_data_marker_path = home / ".timmy-sample-data.sha256"
        self.watchlist_path = home / "watchlist.txt"
        self.active_watchlist_path = home / "active-watchlist.txt"
        self.movement_watchlist_path = home / "movement-watchlist.txt"
        self.trade_ready_watchlist_path = home / "trade-ready-watchlist.txt"
        self.quiet_watchlist_path = home / "quiet-watchlist.txt"
        self.journal_path = home / "trade-journal.jsonl"
        self.simulation_journal_path = home / "simulation-trade-journal.jsonl"
        self.event_log_path = home / "execution-events.jsonl"
        self.paper_research_path = home / "paper-training-summary.json"
        self.audit_key_path = home / ".timmy-audit-key"
        self.integrity_manifest_path = home / ".timmy-integrity.json"
        self.settings_path = home / "timmy-ui-settings.json"
        self.automation_risk_state_path = home / "automation-risk-state.json"
        self.workspace_store = WorkspaceStore(home)
        self._last_workspace_state = self.workspace_store.last_state()
        self._restoring_last_workspace = True
        self._latest_generated_watchlist_change_notes: list[str] = []
        self.symbol_notes = SymbolNotesStore(home)
        self.scanner_presets = ScannerPresetStore(home / "scanner-presets.json")
        self.scanner_table_presets = ScannerTablePresetStore(home / "scanner-table-presets.json")
        self.scan_coverage = ScanCoverageStore(home / "scan-coverage-history.json")
        self.alert_store = AlertStore(home / "timmy-alerts.json")
        self.watchlist_organization = WatchlistOrganizationStore(home)
        self.action_registry = ActionRegistry()
        self._palette_rows: list[tuple[str, object]] = []
        self.universe_path = home / "timmy-watchlist-universe.txt"
        self.rotation_state_path = home / "timmy-watchlist-rotation.json"
        self.movement_tracker_path = home / "timmy-movement-tracker.json"
        self.recent_movers_path = home / "recent-movers-96h.txt"
        self.movement_scan_bars_path = home / "movement-scan-candidates.csv"
        self.movement_universe_extra_path = home / "movement-universe-extra.txt"
        self.movement_rotation_state_path = home / "timmy-movement-universe-rotation.json"
        self._movement_recommendations: list[dict] = []
        self._movement_candidate_records: list[dict] = []
        self.automation_movement_candidates: frozenset[str] = frozenset()
        self._movement_tracker_payload: dict = {}
        self._movement_tracker_error = ""
        self._movement_recommendation_note = ""
        self._movement_scan_progress: dict = {}
        self.crash_log_path = home / "timmy-crash.log"
        self.config: BotConfig | None = None
        self.config_error: str | None = None
        self.signals = []
        self.signal_by_symbol = {}
        self.plans = []
        self.bars_by_symbol = {}
        self.automation_after_id: str | None = None
        self.market_open_after_id: str | None = None
        self._automation_cycle_in_progress = False
        self._automation_cycle_started_at: datetime | None = None
        self._automation_cancel_event: threading.Event | None = None
        self._automation_cycle_requested_target = ""
        self._automation_cycle_requested_mode = ""
        self._execution_journal_lock = threading.RLock()
        self._automation_next_run_at: datetime | None = None
        self._automation_last_run_at: datetime | None = None
        self._automation_last_duration_seconds: float | None = None
        self._automation_last_result = "No automation cycle has run this session."
        self._automation_wait_reason = ""
        self._latest_automation_risk_decision: AutomationRiskDecision | None = None
        self._latest_automation_broker_orders: tuple[dict, ...] | None = None
        self._latest_automation_broker_positions: tuple[dict, ...] | None = None
        self._latest_automation_lifecycle_summary = "No Live Auto account/order preflight has run this session."
        self._automation_hold_reason = ""
        self._persisted_live_automation_hold_id = ""
        self._manual_mode_user_selected = False
        self._automatic_fallback_active = False
        self._automatic_fallback_reason = ""
        self._automatic_fallback_restore_mode = "User"
        self._automatic_fallback_attempt = 0
        self._automatic_fallback_after_id: str | None = None
        self.local_preview_fingerprints: dict[str, dict] = {}
        self.refresh_after_id: str | None = None
        self.account_refresh_after_id: str | None = None
        self.update_check_after_id: str | None = None
        self.update_check_in_progress = False
        self._refresh_in_progress = False
        self._action_in_progress = False
        self._market_data_load_error = ""
        self._sample_data_in_use = False
        self._active_action_label = ""
        self._wheel_delta_remainder = 0
        self.closing = False
        self.min_score_value = 72
        self.plan_limit_value = 3
        self.auto_interval_value = 1
        self.trade_cash_snapshot: tuple[str, str] = ("-", "Run Account Check")
        self.trade_cash_value: float | None = None
        self.paper_cash_snapshot: tuple[str, str] = ("$10,000.00", "Paper cash")
        self.account_snapshot: tuple[str, str] = ("Unknown", "Run Account Check")
        self.webull_account_choices: list[dict[str, str]] = []
        self.webull_account_labels: dict[str, str] = {}
        self.verified_profile_fingerprint: str | None = None
        self.profile_verification_status = "Not verified"
        self.nav_buttons: dict[str, tk.Button] = {}
        self.profile_field_status_labels: dict[str, tk.Label] = {}
        self.setup_readiness_labels: dict[str, tk.Label] = {}
        self.scanner_summary_labels: dict[str, tk.Label] = {}
        self._scanner_sort_column: str | None = None
        self._scanner_sort_reverse = False
        self.strategy_summary_labels: dict[str, tk.Label] = {}
        self.execution_summary_labels: dict[str, tk.Label] = {}
        self.broker_summary_labels: dict[str, tk.Label] = {}
        self.audit_summary_labels: dict[str, tk.Label] = {}
        self.manual_controls: list[tk.Button] = []
        self.busy_controls: list[tk.Button] = []
        self.execution_events: list[dict] = []
        self.journal_filter_state = JournalFilterState()
        self.shortcut_help = ShortcutHelpRegistry()
        for group, key, action, description in (
            ("General", "F1", "help", "Open the keyboard and workflow guide"),
            ("General", "F5", "refresh", "Refresh the market scan"),
            ("General", "Ctrl+R", "decision-cycle", "Run a decision cycle"),
            ("Navigation", "Ctrl+K", "quick-search", "Search pages and quick actions"),
            ("General", "Esc", "clear-close", "Clear scanner search or close a dialog"),
        ):
            self.shortcut_help.register(group, key, action, description)
        self.previewed_order_fingerprints: dict[str, dict] = {}
        self.recent_bad_event_counts: dict[str, int] = {}
        self._execution_events_cache_key: tuple | None = None
        self._execution_events_cache: list[dict] = []
        self._tooltip: tk.Toplevel | None = None
        self.audit_status = "Audit chain ready"
        self._settings_load_error: str | None = None
        self._settings_save_error: str | None = None
        self._settings_validation_notes: list[str] = []

        self.root = tk.Tk()
        self.root.title("Timmy | Auto Trade Assistant")
        self.root.geometry("1360x860")
        self.root.minsize(820, 560)
        self.colors = self._theme_palette()
        self.root.configure(bg=self.colors["bg"])
        self.min_score_var = tk.StringVar(value="72")
        self.scanner_filter_var = tk.StringVar(value="")
        self.scanner_category_var = tk.StringVar(value="All")
        self.scanner_match_var = tk.StringVar(value="All symbols")
        self.scanner_preset_var = tk.StringVar(value="Saved filters")
        self.chart_sma_var = tk.BooleanVar(value=True)
        self.chart_volume_var = tk.BooleanVar(value=True)
        self.chart_levels_var = tk.BooleanVar(value=True)
        self.chart_window_var = tk.StringVar(value="80")
        self.trader_experience_years_var = tk.StringVar(value="")
        self.trader_risk_preference_var = tk.StringVar(value="Not set")
        self.trader_risk_acknowledged_var = tk.BooleanVar(value=False)
        self.trader_risk_acknowledged_at = ""
        self._portfolio_default_card_order = (
            "Paper Equity", "Realized P&L", "Open P&L", "Available Cash", "Open Positions",
        )
        self.portfolio_card_order = list(self._portfolio_default_card_order)
        self.scanner_column_order: tuple[str, ...] = ()
        self.scanner_visible_columns: set[str] = set()
        self._saved_scanner_view = None
        self.watchlist_group_var = tk.StringVar(value="All signals")
        self.overview_radar_visible_var = tk.BooleanVar(
            value=self._last_workspace_state.get("overview_radar_visible", True) is not False)
        self.movement_filter_var = tk.StringVar(value="All fresh")
        self.watchlist_pinned_only_var = tk.BooleanVar(value=False)
        self.plan_limit_var = tk.StringVar(value="3")
        self.auto_interval_var = tk.StringVar(value="1")
        self.paper_auto_var = tk.BooleanVar(value=False)
        self.execution_mode_var = tk.StringVar(value="User")
        self.alert_history_state_var = tk.StringVar(value="All")
        self.alert_history_query_var = tk.StringVar(value="")
        self.alert_history_sort_var = tk.StringVar(value="Newest")
        self.execution_target_var = tk.StringVar(value="Paper")
        self.webull_account_toggle_var = tk.BooleanVar(value=False)
        self.account_lane_var = tk.StringVar(value="I-Cash")
        self.webull_account_choice_var = tk.StringVar(value="Configured account")
        self.selected_webull_account_id_var = tk.StringVar(value="")
        self.profile_app_key_var = tk.StringVar(value="")
        self.profile_app_secret_var = tk.StringVar(value="")
        self.profile_account_id_var = tk.StringVar(value="")
        self.profile_region_var = tk.StringVar(value="us")
        self.profile_endpoint_var = tk.StringVar(value="")
        self.profile_live_orders_var = tk.BooleanVar(value=False)
        self.profile_require_preview_var = tk.BooleanVar(value=True)
        self.profile_trader_live_var = tk.BooleanVar(value=False)
        self.profile_auto_live_var = tk.BooleanVar(value=False)
        self.trading_style_var = tk.StringVar(value="Adaptive")
        self.pattern_vars = {
            "breakout": tk.BooleanVar(value=True),
            "momentum": tk.BooleanVar(value=True),
            "pullback": tk.BooleanVar(value=True),
            "volume": tk.BooleanVar(value=True),
        }
        self._load_persisted_settings()

        self._configure_style()
        self.splash = self._build_splash()
        self._build_layout()
        self._register_command_actions()
        self.scanner_preset_var.trace_add("write", lambda *_args: self._apply_scanner_preset_name())
        self._refresh_scanner_preset_menu()
        self.root.bind("<Configure>", self._responsive_layout, add="+")
        self._setup_settings_traces()
        self._setup_profile_traces()
        self.watchlist_group_var.trace_add("write", lambda *_args: self._save_last_workspace_state())
        self.root.withdraw()
        self.root.protocol("WM_DELETE_WINDOW", self.close)
        self.root.report_callback_exception = self._handle_tk_exception
        self.root.bind("<F5>", lambda _event: self.refresh_all())
        self.root.bind("<Control-r>", lambda _event: self.run_decision_cycle())
        self.root.bind("<Control-k>", self._open_command_palette)
        self.root.bind("<F1>", self._open_help_guide)

    def run(self) -> int:
        self.refresh_all()
        self._close_splash()
        self._arm_market_open_automation()
        if self._automation_enabled():
            self._schedule_automation()
        if self._automatic_fallback_active:
            self._schedule_automatic_fallback_recovery()
        self.refresh_after_id = self.root.after(AUTO_REFRESH_MS, self._auto_refresh)
        self.account_refresh_after_id = self.root.after(ACCOUNT_REFRESH_MS, self._auto_account_refresh)
        self.update_check_after_id = self.root.after(5000, self._schedule_update_check)
        self.root.mainloop()
        return 0

    def _theme_palette(self) -> dict[str, str]:
        requested = os.getenv("TIMMY_THEME", "").strip().lower()
        if requested not in {"light", "dark"}:
            gtk_theme = os.getenv("GTK_THEME", "").lower()
            color_scheme = os.getenv("COLOR_SCHEME", "").lower()
            requested = "dark" if "dark" in f"{gtk_theme} {color_scheme}" else ""
        if not requested:
            # Timmy's market desk defaults to its high-contrast trading theme;
            # users can still opt into the light palette with TIMMY_THEME=light.
            requested = "dark"
        if requested == "light":
            return {
                "bg": "#e8edf1",
                "rail": "#101418",
                "runtime": "#151a20",
                "panel": "#fbfcf8",
                "panel_2": "#edf0ed",
                "panel_3": "#dfe5e7",
                "line": "#aab4b8",
                "text": "#111518",
                "muted": "#526068",
                "gold": "#b17622",
                "gold_text": "#ffffff",
                "teal": "#047f7a",
                "green": "#1f7a4b",
                "red": "#bd2b36",
                "button": "#e1e5e5",
                "button_text": "#111518",
                "teal_button": "#006c67",
                "teal_button_text": "#ffffff",
                "selected": "#f3c15b",
                "selected_text": "#11100b",
                "disabled": "#768188",
                "entry": "#ffffff",
                "broker_text": "#103633",
                "mark_text": "#ffffff",
                "rail_text": "#f2f3ee",
                "rail_muted": "#a8b0ae",
                "rail_line": "#31383a",
                "hot": "#cf3f4a",
                "cyan": "#00a6a0",
                "up_row": "#e6f4eb",
                "down_row": "#fae8eb",
            }
        return {
            "bg": "#080b0e",
            "rail": "#090d10",
            "runtime": "#11181b",
            "panel": "#12191d",
            "panel_2": "#192226",
            "panel_3": "#0c1215",
            "line": "#2b383b",
            "text": "#e8f1ed",
            "muted": "#92a29a",
            "gold": "#e9b949",
            "gold_text": "#101722",
            "teal": "#00ce84",
            "green": "#18d996",
            "red": "#ff5f68",
            "button": "#1b282b",
            "button_text": "#e8f1ed",
            "teal_button": "#087a58",
            "teal_button_text": "#f1fffd",
            "selected": "#143b2e",
            "selected_text": "#72f3b7",
            "disabled": "#66798c",
            "entry": "#0c1513",
            "broker_text": "#caffeb",
            "mark_text": "#101722",
            "rail_text": "#e8f0f8",
            "rail_muted": "#8297ad",
            "rail_line": "#23302e",
            "hot": "#00ce84",
            "cyan": "#00ce84",
            "up_row": "#10291f",
            "down_row": "#2a191b",
        }

    def _system_background_is_light(self) -> bool:
        try:
            red, green, blue = self.root.winfo_rgb(self.root.cget("background"))
        except tk.TclError:
            return False
        luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 65535
        return luminance >= 0.55

    def _build_splash(self) -> tk.Toplevel:
        splash = tk.Toplevel(self.root)
        splash.title("Timmy Trader")
        splash.geometry("520x310")
        splash.resizable(False, False)
        splash.configure(bg=self.colors["bg"])
        splash.overrideredirect(True)
        splash.update_idletasks()
        width = splash.winfo_screenwidth()
        height = splash.winfo_screenheight()
        splash.geometry(f"520x310+{(width - 520) // 2}+{(height - 310) // 2}")
        frame = tk.Frame(
            splash,
            bg=self.colors["panel"],
            highlightbackground=self.colors["line"],
            highlightthickness=1,
        )
        frame.pack(fill="both", expand=True, padx=1, pady=1)

        header = tk.Frame(frame, bg=self.colors["panel"])
        header.pack(fill="x", padx=28, pady=(24, 8))
        tk.Label(
            header,
            text="T",
            bg=self.colors["gold"],
            fg=self.colors["mark_text"],
            font=("Sans", 22, "bold"),
            width=2,
            height=1,
            anchor="center",
        ).pack(side="left", padx=(0, 14))
        identity = tk.Frame(header, bg=self.colors["panel"])
        identity.pack(side="left", fill="y")
        tk.Label(
            identity,
            text="TIMMY",
            bg=self.colors["panel"],
            fg=self.colors["text"],
            font=("Sans", 21, "bold"),
            anchor="w",
        ).pack(anchor="w")
        tk.Label(
            identity,
            text="TRADER  /  MARKET WORKSPACE",
            bg=self.colors["panel"],
            fg=self.colors["muted"],
            font=("Sans", 8, "bold"),
            anchor="w",
        ).pack(anchor="w", pady=(2, 0))

        chart = tk.Canvas(
            frame,
            height=82,
            bg=self.colors["panel_3"],
            highlightthickness=0,
            bd=0,
        )
        chart.pack(fill="x", padx=28, pady=(12, 15))
        chart.update_idletasks()
        chart_width = max(420, chart.winfo_width())
        for y in (20, 41, 62):
            chart.create_line(0, y, chart_width, y, fill=self.colors["line"], width=1)
        for x in range(35, chart_width, 58):
            chart.create_line(x, 0, x, 82, fill=self.colors["line"], width=1)
        sparkline = [
            (0.02, 0.69), (0.12, 0.60), (0.20, 0.65), (0.30, 0.40),
            (0.39, 0.49), (0.49, 0.31), (0.58, 0.43), (0.69, 0.22),
            (0.78, 0.34), (0.88, 0.16), (0.98, 0.25),
        ]
        points = [coord for x, y in sparkline for coord in (x * chart_width, y * 82)]
        chart.create_line(*points, fill=self.colors["teal"], width=2, smooth=True)
        chart.create_oval(
            chart_width - 10, 0.25 * 82 - 5, chart_width, 0.25 * 82 + 5,
            fill=self.colors["teal"], outline=self.colors["panel_3"], width=2,
        )
        chart.create_text(
            12, 12, text="MARKET SYSTEMS  •  STARTING", anchor="nw",
            fill=self.colors["muted"], font=("Sans", 7, "bold"),
        )

        status_row = tk.Frame(frame, bg=self.colors["panel"])
        status_row.pack(fill="x", padx=29)
        self.splash_status = tk.Label(
            status_row,
            text="Preparing your workspace",
            bg=self.colors["panel"],
            fg=self.colors["text"],
            font=("Sans", 10),
            anchor="w",
        )
        self.splash_status.pack(side="left")
        tk.Label(
            status_row,
            text="PAPER  /  LIVE  /  GUARDED",
            bg=self.colors["panel"],
            fg=self.colors["gold"],
            font=("Sans", 8, "bold"),
            anchor="e",
        ).pack(side="right")
        self.splash_progress_value = 0
        self.splash_progress_bar = tk.Frame(frame, bg=self.colors["line"], height=3)
        self.splash_progress_bar.pack(fill="x", padx=28, pady=(12, 0))
        self.splash_progress_fill = tk.Frame(self.splash_progress_bar, bg=self.colors["teal"], width=0)
        self.splash_progress_fill.place(x=0, y=0, relheight=1)
        splash.lift()
        splash.update()
        return splash

    def _splash_step(self, text: str) -> None:
        if getattr(self, "splash", None) and getattr(self, "splash_status", None):
            try:
                self.splash_progress_value = min(100, getattr(self, "splash_progress_value", 0) + 15)
                self.splash_status.configure(text=text)
                self.splash_progress_bar.update_idletasks()
                self.splash_progress_fill.configure(
                    width=max(1, int(self.splash_progress_bar.winfo_width() * self.splash_progress_value / 100))
                )
                self.splash.update_idletasks()
            except tk.TclError:
                pass

    def _close_splash(self) -> None:
        self.root.deiconify()
        if getattr(self, "splash_progress_fill", None):
            try:
                self.splash_progress_fill.configure(width=self.splash_progress_bar.winfo_width())
            except tk.TclError:
                pass
        if getattr(self, "splash", None):
            try:
                self.splash.destroy()
            except tk.TclError:
                pass

    def _schedule_update_check(self) -> None:
        if self.closing:
            return
        self._start_update_check()
        self.update_check_after_id = self.root.after(24 * 60 * 60 * 1000, self._schedule_update_check)

    def _start_update_check(self) -> None:
        if self.closing or self.update_check_in_progress:
            return
        self.update_check_in_progress = True
        self.github_update_label.configure(text="Automatic updates: checking…")

        def check() -> None:
            try:
                result = check_and_install_update()
                error = None
            except Exception as exc:
                result = None
                error = str(exc) or exc.__class__.__name__
            try:
                self.root.after(0, lambda: self._finish_update_check(result, error))
            except tk.TclError:
                pass

        threading.Thread(target=check, name="timmy-update-check", daemon=True).start()

    def _finish_update_check(self, result, error: str | None) -> None:
        if self.closing:
            return
        self.update_check_in_progress = False
        if error:
            self.github_update_label.configure(text=f"Automatic update failed: {error[:75]}", fg=self.colors["red"])
            return
        color = self.colors["green"] if "installed" in result.status or "up to date" in result.status else self.colors["rail_muted"]
        self.github_update_label.configure(text=result.status, fg=color)

    def close(self) -> None:
        self._save_runtime_settings()
        self.closing = True
        if getattr(self, "splash", None):
            try:
                self.splash.destroy()
            except tk.TclError:
                pass
        for after_id in (
            self.refresh_after_id,
            self.account_refresh_after_id,
            self.automation_after_id,
            self.market_open_after_id,
            self._automatic_fallback_after_id,
            self.update_check_after_id,
        ):
            if after_id:
                try:
                    self.root.after_cancel(after_id)
                except tk.TclError:
                    pass
        self.root.destroy()

    def _configure_style(self) -> None:
        style = ttk.Style(self.root)
        style.theme_use("clam")
        style.configure("Vertical.TScrollbar", background=self.colors["panel_2"],
                        troughcolor=self.colors["bg"], bordercolor=self.colors["bg"],
                        arrowcolor=self.colors["muted"])
        style.configure("Treeview", background=self.colors["panel"], foreground=self.colors["text"],
                        fieldbackground=self.colors["panel"], rowheight=30, borderwidth=0,
                        font=("Sans", 10))
        style.configure("Treeview.Heading", background=self.colors["panel_2"], foreground=self.colors["muted"],
                        relief="flat", font=("Sans", 10, "bold"), padding=(4, 10))
        style.map(
            "Treeview",
            background=[("selected", self.colors["selected"])],
            foreground=[("selected", self.colors["selected_text"])],
        )

    def _build_layout(self) -> None:
        self.root.columnconfigure(1, weight=1)
        self.root.rowconfigure(0, weight=1)

        rail = tk.Frame(self.root, bg=self.colors["rail"], width=204)
        rail.grid(row=0, column=0, sticky="nsew")
        rail.grid_propagate(False)
        rail.columnconfigure(0, weight=0)
        rail.columnconfigure(1, weight=1)

        rail_stripe = tk.Frame(rail, bg=self.colors["cyan"], width=4)
        rail_stripe.grid(row=0, column=0, rowspan=4, sticky="nsw")
        mark = tk.Label(rail, text="T", bg=self.colors["gold"], fg=self.colors["mark_text"], font=("Sans", 22, "bold"),
                        width=2, height=1, anchor="center", justify="center", relief="flat")
        mark.grid(row=0, column=0, padx=(24, 10), pady=(24, 10), sticky="w")
        brand_box = tk.Frame(rail, bg=self.colors["rail"])
        brand_box.grid(row=0, column=1, pady=(22, 10), sticky="w")
        brand = tk.Label(brand_box, text="Timmy", bg=self.colors["rail"], fg=self.colors["rail_text"],
                         justify="left", anchor="w", font=("Sans", 15, "bold"))
        brand.pack(anchor="w")
        brand_sub = tk.Label(brand_box, text="AUTO TRADE ASSISTANT", bg=self.colors["rail"], fg=self.colors["rail_muted"],
                             justify="left", anchor="w", font=("Sans", 8, "bold"))
        brand_sub.pack(anchor="w", pady=(1, 0))

        nav_sections = (
            ("WORKSPACES", ("Automation", "Overview", "Portfolio", "Alerts")),
            ("EXECUTION", ("Execution", "Broker", "Audit")),
            ("RESEARCH", ("Scanner", "Research", "Strategy", "Universe")),
            ("SYSTEM", ("Setup", "Health")),
        )
        nav = tk.Frame(rail, bg=self.colors["rail"])
        nav.grid(row=1, column=0, columnspan=2, sticky="ew", padx=18, pady=(12, 0))
        for section, items in nav_sections:
            label = tk.Label(nav, text=section, bg=self.colors["rail"], fg=self.colors["rail_muted"],
                             anchor="w", font=("Sans", 8, "bold"))
            label.pack(fill="x", padx=8, pady=(6, 2))
            for item in items:
                button = tk.Button(
                    nav,
                    text=item,
                    command=lambda target=item: self._show_tab(target),
                    bg=self.colors["selected"] if item == "Automation" else self.colors["rail"],
                    fg=self.colors["selected_text"] if item == "Automation" else self.colors["rail_muted"],
                    activebackground=self.colors["selected"],
                    activeforeground=self.colors["selected_text"],
                    relief="flat",
                    anchor="w",
                    justify="left",
                    padx=14,
                    pady=6,
                    font=("Sans", 10, "bold"),
                    cursor="hand2",
                    takefocus=True,
                    highlightbackground=self.colors["rail_line"],
                    highlightcolor=self.colors["cyan"],
                    highlightthickness=2,
                )
                self._fit_text(button, min_size=9, max_size=11, padding=22, wrap=True)
                button.pack(fill="x", pady=1)
                self.nav_buttons[item] = button
        review_button = tk.Button(nav, text="Review & Operations", command=self._open_operations_review,
                                  bg=self.colors["rail"], fg=self.colors["rail_muted"],
                                  activebackground=self.colors["selected"], activeforeground=self.colors["selected_text"],
                                  relief="flat", anchor="w", padx=14, pady=7, font=("Sans", 10, "bold"), cursor="hand2")
        review_button.pack(fill="x", pady=(9, 1))

        rail.rowconfigure(2, weight=1)
        runtime = tk.Frame(rail, bg=self.colors["runtime"], highlightbackground=self.colors["rail_line"], highlightthickness=1)
        runtime.grid(row=3, column=0, columnspan=2, sticky="ew", padx=20, pady=22)
        runtime_top = tk.Frame(runtime, bg=self.colors["cyan"], height=4)
        runtime_top.pack(fill="x")
        runtime_title = tk.Label(runtime, text="Desk Status", bg=self.colors["runtime"], fg=self.colors["rail_muted"], anchor="center", justify="center")
        self._fit_text(runtime_title, min_size=8, max_size=10, padding=20, wrap=True)
        runtime_title.pack(fill="x", padx=14, pady=(12, 2))
        self.runtime_label = tk.Label(runtime, text="Checking", bg=self.colors["runtime"], fg=self.colors["teal"],
                                      anchor="center", justify="center", font=("Sans", 12, "bold"))
        self._fit_text(self.runtime_label, min_size=9, max_size=12, padding=20, wrap=True)
        self.runtime_label.pack(fill="x", padx=14)
        self.last_update_label = tk.Label(runtime, text="No refresh yet", bg=self.colors["runtime"], fg=self.colors["rail_muted"],
                                          anchor="center", justify="center")
        self._fit_text(self.last_update_label, min_size=8, max_size=10, padding=20, wrap=True)
        self.last_update_label.pack(fill="x", padx=14, pady=(2, 12))
        self.github_update_label = tk.Label(runtime, text="Automatic updates enabled", bg=self.colors["runtime"],
                                            fg=self.colors["rail_muted"], anchor="center", justify="center")
        self._fit_text(self.github_update_label, min_size=8, max_size=10, padding=20, wrap=True)
        self.github_update_label.pack(fill="x", padx=14, pady=(0, 12))

        content_view = tk.Frame(self.root, bg=self.colors["bg"])
        content_view.grid(row=0, column=1, sticky="nsew")
        content_view.rowconfigure(1, weight=1)
        content_view.columnconfigure(0, weight=1)
        terminal_strip = tk.Frame(content_view, bg=self.colors["runtime"], height=42,
                                  highlightbackground=self.colors["line"], highlightthickness=1)
        terminal_strip.grid(row=0, column=0, columnspan=2, sticky="ew")
        terminal_strip.grid_propagate(False)
        terminal_strip.columnconfigure(1, weight=1)
        terminal_strip.columnconfigure(2, weight=0)
        terminal_mark = tk.Label(terminal_strip, text="TIMMY  /  US EQUITIES", bg=self.colors["runtime"],
                                 fg=self.colors["teal"], font=("Sans", 9, "bold"), anchor="w")
        terminal_mark.grid(row=0, column=0, sticky="w", padx=(18, 20))
        self.terminal_session_label = tk.Label(terminal_strip, text="SESSION · CHECKING", bg=self.colors["runtime"],
                                               fg=self.colors["muted"], font=("Sans", 9, "bold"), anchor="w")
        self.terminal_session_label.grid(row=0, column=1, sticky="w", padx=(0, 16))
        self.market_session_label = self.terminal_session_label
        self.terminal_data_label = tk.Label(terminal_strip, text="DATA · CHECKING", bg=self.colors["runtime"],
                                            fg=self.colors["muted"], font=("Sans", 8, "bold"), anchor="e")
        self.terminal_data_label.grid(row=0, column=2, sticky="e", padx=(10, 16))
        self._add_tooltip(
            self.terminal_data_label,
            "Compact data state. Full provider, timestamp, and candle age are shown in Runtime.",
        )
        self.terminal_mode_label = tk.Label(terminal_strip, text="PAPER · USER", bg=self.colors["runtime"],
                                            fg=self.colors["green"], font=("Sans", 8, "bold"), anchor="e")
        self.terminal_mode_label.grid(row=0, column=3, sticky="e", padx=(6, 18))
        self.content_canvas = tk.Canvas(content_view, bg=self.colors["bg"], highlightthickness=0, borderwidth=0)
        self.content_canvas.grid(row=1, column=0, sticky="nsew")
        content_scrollbar = ttk.Scrollbar(content_view, orient="vertical", command=self.content_canvas.yview,
                                          style="Vertical.TScrollbar")
        content_scrollbar.grid(row=1, column=1, sticky="ns")
        self.content_canvas.configure(yscrollcommand=content_scrollbar.set)
        main = tk.Frame(self.content_canvas, bg=self.colors["bg"])
        self._main_canvas_window = self.content_canvas.create_window((0, 0), window=main, anchor="nw")
        main.bind("<Configure>", lambda _event: self.content_canvas.configure(
            scrollregion=self.content_canvas.bbox("all")), add="+")
        self.content_canvas.bind("<Configure>", lambda event: self.content_canvas.itemconfigure(
            self._main_canvas_window, width=event.width), add="+")
        self.root.bind_all("<MouseWheel>", self._scroll_content, add="+")
        self.root.bind_all("<Button-4>", self._scroll_content, add="+")
        self.root.bind_all("<Button-5>", self._scroll_content, add="+")
        main.columnconfigure(0, weight=1)
        main.rowconfigure(3, weight=1)

        hero = tk.Frame(main, bg=self.colors["panel"], highlightbackground=self.colors["line"], highlightthickness=1)
        self.hero = hero
        hero.grid(row=0, column=0, sticky="ew", padx=18, pady=(16, 10))
        hero.columnconfigure(0, weight=1)
        hero.columnconfigure(1, weight=0)
        accent = tk.Frame(hero, bg=self.colors["hot"], width=7)
        accent.grid(row=0, column=0, rowspan=3, sticky="nsw")
        cyan_rule = tk.Frame(hero, bg=self.colors["cyan"], height=4)
        cyan_rule.grid(row=3, column=0, columnspan=2, sticky="ew")
        hero_eyebrow = tk.Label(hero, text="MARKETS  /  US EQUITIES  /  PAPER TRADING", bg=self.colors["panel"],
                                fg=self.colors["teal"], font=("Sans", 9, "bold"), anchor="w", justify="left")
        self._fit_text(hero_eyebrow, min_size=8, max_size=9, padding=56, wrap=True)
        hero_eyebrow.grid(row=0, column=0, sticky="ew", padx=(30, 24), pady=(12, 0))
        hero_title = tk.Label(hero, text="Market desk", bg=self.colors["panel"], fg=self.colors["text"],
                              font=("Sans", 22, "bold"), anchor="w", justify="left")
        self._fit_text(hero_title, min_size=18, max_size=22, padding=56, wrap=True)
        hero_title.grid(row=1, column=0, sticky="ew", padx=(30, 24), pady=(0, 0))
        hero_copy = tk.Label(
            hero,
            text="Prices, ranked ideas, risk context, and an execution queue in one trading workspace.",
            bg=self.colors["panel"],
            fg=self.colors["muted"],
            font=("Sans", 10),
            justify="left",
            anchor="w",
        )
        self._fit_text(hero_copy, min_size=9, max_size=10, padding=56, wrap=True)
        hero_copy.grid(row=2, column=0, sticky="ew", padx=(30, 24), pady=(3, 12))
        action_box = tk.Frame(hero, bg=self.colors["panel"])
        action_box.grid(row=0, column=1, rowspan=3, sticky="e", padx=(0, 18), pady=8)
        action_buttons = tk.Frame(action_box, bg=self.colors["panel"])
        action_buttons.pack(anchor="e")
        self.refresh_button = self._button(
            action_buttons, "↻  Scan", self.refresh_all, accent="teal", tooltip="Refresh market data and rebuild the scan")
        self.refresh_button.pack(side="left", padx=(0, 7))
        # Run Cycle has one home in the shared Automation / Execution control strip.
        self.decision_cycle_button = None
        # Broker account actions live on Broker; keep the overview focused on
        # the market scan instead of mixing account checks into its action rail.
        self.busy_controls.append(self.refresh_button)

        # Timmy's market workspace uses a compact signal-to-action masthead
        # instead of a large landing-page hero and a second row of KPI cards.
        # The three stages make the workflow legible while leaving room for
        # the chart, symbol radar, and order context below.
        self.market_masthead = tk.Frame(main, bg=self.colors["panel"],
                                       highlightbackground=self.colors["line"], highlightthickness=1)
        masthead_accent = tk.Frame(self.market_masthead, bg=self.colors["teal"], width=4)
        masthead_accent.grid(row=0, column=0, rowspan=3, sticky="nsw")
        masthead_title = tk.Label(self.market_masthead, text="SIGNAL DESK", bg=self.colors["panel"],
                                  fg=self.colors["text"], font=("Sans", 14, "bold"), anchor="w")
        masthead_title.grid(row=0, column=1, sticky="w", padx=(16, 8), pady=(9, 0))
        masthead_subtitle = tk.Label(self.market_masthead, text="Timmy's market read, from radar to risk-checked action",
                                     bg=self.colors["panel"], fg=self.colors["muted"],
                                     font=("Sans", 9), anchor="w")
        masthead_subtitle.grid(row=1, column=1, sticky="w", padx=(16, 8), pady=(0, 9))
        self.market_scan_status_label = tk.Label(
            self.market_masthead,
            text="Scan status · waiting for first market refresh",
            bg=self.colors["panel"], fg=self.colors["muted"],
            font=("Sans", 8), anchor="w", justify="left", wraplength=800,
        )
        self.market_scan_status_label.grid(row=2, column=1, columnspan=3, sticky="ew",
                                           padx=(16, 12), pady=(0, 8))
        flow = tk.Frame(self.market_masthead, bg=self.colors["panel"])
        flow.grid(row=0, column=2, rowspan=2, sticky="e", padx=(8, 16))
        for index, (number, label) in enumerate((("01", "RADAR"), ("02", "READ"), ("03", "ACT"))):
            stage = tk.Frame(flow, bg=self.colors["panel_2"],
                             highlightbackground=self.colors["line"], highlightthickness=1)
            stage.pack(side="left", padx=(0 if index == 0 else 6, 0))
            tk.Label(stage, text=number, bg=self.colors["panel_2"], fg=self.colors["teal"],
                     font=("Monospace", 8, "bold")).pack(side="left", padx=(8, 4), pady=6)
            tk.Label(stage, text=label, bg=self.colors["panel_2"], fg=self.colors["text"],
                     font=("Sans", 8, "bold")).pack(side="left", padx=(0, 8), pady=6)
        palette_button = self._button(self.market_masthead, "⌕  Quick Jump  Ctrl+K",
                                      self._open_command_palette, accent="teal",
                                      tooltip="Find a workspace, action, or ticker")
        palette_button.grid(row=0, column=3, rowspan=2, sticky="e", padx=(0, 14))
        self.overview_radar_toggle = tk.Checkbutton(
            self.market_masthead,
            text="Show radar",
            variable=self.overview_radar_visible_var,
            command=self._apply_overview_layout,
            bg=self.colors["panel"], fg=self.colors["text"], selectcolor=self.colors["panel_2"],
            activebackground=self.colors["panel"], activeforeground=self.colors["text"],
            font=("Sans", 8, "bold"),
        )
        self.overview_radar_toggle.grid(row=0, column=4, sticky="e", padx=(0, 14))
        self._add_tooltip(self.overview_radar_toggle, "Collapse the ranked ticker radar to give the chart and decision workspace more room. This preference is remembered.")
        self.market_masthead.columnconfigure(1, weight=1)

        metrics = tk.Frame(main, bg=self.colors["bg"])
        self.metrics = metrics
        metrics.grid(row=1, column=0, sticky="ew", padx=18, pady=(0, 10))
        for idx in range(5):
            metrics.columnconfigure(idx, weight=1)
        self.universe_card = self._metric(metrics, 0, 0, "Universe")
        self.active_card = self._metric(metrics, 0, 1, "Active List")
        self.movement_card = self._metric(metrics, 0, 2, "Movement")
        self.trade_ready_card = self._metric(metrics, 0, 3, "Trade Ready")
        self.plan_card = self._metric(metrics, 0, 4, "Orders Ready")
        self.cash_card = self._metric(metrics, 0, 5, "Cash Account", highlight=True)
        self.paper_cash_card = self._metric(metrics, 0, 6, "Paper Account", highlight=True)
        self.cash_card[0].master.grid_remove()
        self.paper_cash_card[0].master.grid_remove()

        controls = tk.Frame(main, bg=self.colors["panel"], highlightbackground=self.colors["cyan"], highlightthickness=1)
        self.controls = controls
        for idx in range(6):
            controls.columnconfigure(idx, weight=1, minsize=118)
        controls_title = tk.Label(controls, text="Lane & risk controls", bg=self.colors["panel"], fg=self.colors["text"],
                                  font=("Sans", 15, "bold"), anchor="w", justify="left")
        self.controls_title = controls_title
        controls_title.grid(row=0, column=0, columnspan=2, sticky="ew", padx=18, pady=(14, 0))
        controls_status = tk.Label(controls, text="Tune the scan, choose an account lane, and review order actions.",
                                   bg=self.colors["panel"], fg=self.colors["muted"], font=("Sans", 9),
                                   anchor="e", justify="right")
        self.controls_status = controls_status
        controls_status.grid(row=0, column=2, columnspan=4, sticky="ew", padx=18, pady=(14, 0))
        self.control_entry_frames = [
            self._control_entry(controls, 0, "Score", self.min_score_var),
            self._control_entry(controls, 1, "Plans", self.plan_limit_var),
            self._control_entry(controls, 2, "Minutes", self.auto_interval_var),
        ]
        self.guard_label = tk.Label(controls, text="Live orders locked", bg=self.colors["panel"], fg=self.colors["gold"],
                                    font=("Sans", 10, "bold"), anchor="center", justify="center")
        self._fit_text(self.guard_label, min_size=8, max_size=10, padding=18, wrap=True)
        self.guard_label.grid(row=1, column=3, sticky="ew", padx=10, pady=14)
        self.eligible_label = tk.Label(controls, text="Eligible: -", bg=self.colors["panel"], fg=self.colors["teal"],
                                       font=("Sans", 10, "bold"), anchor="center", justify="center")
        self._fit_text(self.eligible_label, min_size=8, max_size=10, padding=18, wrap=True)
        self.eligible_label.grid(row=1, column=4, sticky="ew", padx=10, pady=14)
        paper_auto = tk.Checkbutton(controls, text="Paper lane", variable=self.paper_auto_var, command=self._sync_automation,
                                    bg=self.colors["panel"], fg=self.colors["text"], selectcolor=self.colors["panel_2"],
                                    activebackground=self.colors["panel"], activeforeground=self.colors["text"],
                                    disabledforeground=self.colors["disabled"],
                                    font=("Sans", 10, "bold"), justify="center")
        self._fit_text(paper_auto, min_size=8, max_size=10, padding=24, wrap=True)
        paper_auto.grid(row=1, column=5, sticky="ew", padx=10)
        self.paper_auto_control = paper_auto
        target_box = tk.Frame(controls, bg=self.colors["panel"])
        self.target_box = target_box
        target_box.grid(row=2, column=0, sticky="ew", padx=10, pady=(0, 14))
        target_label = tk.Label(target_box, text="Target", bg=self.colors["panel"], fg=self.colors["muted"],
                                font=("Sans", 9, "bold"), anchor="center", justify="center")
        self._fit_text(target_label, min_size=8, max_size=9, padding=10, wrap=True)
        target_label.pack(fill="x")
        target_radios = tk.Frame(target_box, bg=self.colors["panel"])
        self.target_radios = target_radios
        target_radios.pack(anchor="center", pady=(4, 0))
        self.target_radio_buttons = []
        for label in ("Paper", "Simulation", "Live"):
            target_radio = tk.Radiobutton(
                target_radios,
                text=label,
                value=label,
                variable=self.execution_target_var,
                bg=self.colors["panel"],
                fg=self.colors["text"],
                selectcolor=self.colors["panel_2"],
                activebackground=self.colors["panel"],
                activeforeground=self.colors["text"],
                disabledforeground=self.colors["disabled"],
                font=("Sans", 9, "bold"),
                justify="center",
                command=self._on_execution_target_selected,
                takefocus=1,
            )
            target_radio.pack(side="left", padx=(0, 8))
            self.target_radio_buttons.append(target_radio)
        mode_box = tk.Frame(controls, bg=self.colors["panel"])
        self.mode_box = mode_box
        mode_box.grid(row=2, column=1, sticky="ew", padx=10, pady=(0, 14))
        mode_label = tk.Label(mode_box, text="Mode", bg=self.colors["panel"], fg=self.colors["muted"],
                              font=("Sans", 9, "bold"), anchor="center", justify="center")
        self._fit_text(mode_label, min_size=8, max_size=9, padding=10, wrap=True)
        mode_label.pack(fill="x")
        radios = tk.Frame(mode_box, bg=self.colors["panel"])
        radios.pack(anchor="center", pady=(4, 0))
        for label in ("User", "Auto"):
            tk.Radiobutton(
                radios,
                text=label,
                value=label,
                variable=self.execution_mode_var,
                bg=self.colors["panel"],
                fg=self.colors["text"],
                selectcolor=self.colors["panel_2"],
                activebackground=self.colors["panel"],
                activeforeground=self.colors["text"],
                disabledforeground=self.colors["disabled"],
                font=("Sans", 9, "bold"),
                justify="center",
                command=self._on_execution_mode_selected,
            ).pack(side="left", padx=(0, 8))
        account_box = tk.Frame(controls, bg=self.colors["panel"])
        self.account_box = account_box
        account_box.grid(row=2, column=2, sticky="ew", padx=10, pady=(0, 14))
        account_label = tk.Label(account_box, text="Account", bg=self.colors["panel"], fg=self.colors["muted"],
                                 font=("Sans", 9, "bold"), anchor="center", justify="center")
        self._fit_text(account_label, min_size=8, max_size=9, padding=10, wrap=True)
        account_label.pack(fill="x")
        lane_radios = tk.Frame(account_box, bg=self.colors["panel"])
        lane_radios.pack(anchor="center", pady=(4, 0))
        for label in ("I-Cash", "Crypto"):
            tk.Radiobutton(
                lane_radios,
                text=label,
                value=label,
                variable=self.account_lane_var,
                bg=self.colors["panel"],
                fg=self.colors["text"],
                selectcolor=self.colors["panel_2"],
                activebackground=self.colors["panel"],
                activeforeground=self.colors["text"],
                disabledforeground=self.colors["disabled"],
                font=("Sans", 8, "bold"),
                justify="center",
                command=self._sync_account_lane,
            ).pack(side="left", padx=(0, 6))
        self.webull_account_menu = tk.OptionMenu(account_box, self.webull_account_choice_var, "Configured account")
        self.webull_account_menu.configure(
            bg=self.colors["button"],
            fg=self.colors["button_text"],
            activebackground=self.colors["panel_2"],
            activeforeground=self.colors["text"],
            relief="flat",
            font=("Sans", 8, "bold"),
            highlightthickness=1,
            highlightbackground=self.colors["line"],
        )
        self.webull_account_menu["menu"].configure(
            bg=self.colors["panel_2"],
            fg=self.colors["text"],
            activebackground=self.colors["selected"],
            activeforeground=self.colors["selected_text"],
            font=("Sans", 9),
        )
        self.webull_account_menu.pack(fill="x", pady=(4, 0))
        self._fit_text(self.webull_account_menu, min_size=7, max_size=8, padding=18, wrap=True)
        self.webull_account_toggle = tk.Checkbutton(
            account_box,
            text="Webull Account\nChecking",
            variable=self.webull_account_toggle_var,
            command=self._toggle_webull_account_target,
            indicatoron=False,
            bg=self.colors["button"],
            fg=self.colors["button_text"],
            selectcolor=self.colors["selected"],
            activebackground=self.colors["panel_2"],
            activeforeground=self.colors["text"],
            disabledforeground=self.colors["disabled"],
            relief="flat",
            font=("Sans", 9, "bold"),
            justify="center",
            anchor="center",
            padx=8,
            pady=5,
            cursor="hand2",
        )
        self._fit_text(self.webull_account_toggle, min_size=7, max_size=9, padding=18, wrap=True)
        self.webull_account_toggle.pack(fill="x", pady=(4, 0))
        button_box = tk.Frame(controls, bg=self.colors["panel"])
        self.execution_action_box = button_box
        button_box.grid(row=2, column=3, columnspan=3, sticky="ew", padx=10, pady=(0, 14))
        button_box.columnconfigure((0, 1, 2, 3), weight=1)
        self.run_button = self._button(button_box, "Run cycle", self.run_decision_cycle, accent="teal", tooltip="Run decision cycle")
        self.run_button.grid(row=0, column=0, sticky="ew", padx=(0, 7))
        self.execution_preview_button = self._button(
            button_box,
            "Preview Paper",
            lambda: self._run_action("Previewing selected target", self.preview_selected_target, threaded=False),
            accent="gold",
            tooltip="Preview current plan locally or through Webull according to Target",
        )
        self.execution_preview_button.grid(row=0, column=1, sticky="ew", padx=7)
        # Shared reference keeps execution enablement rules tied to its single
        # natural home instead of a duplicate overview button.
        self.preview_button = self.execution_preview_button
        self.manual_controls.append(self.preview_button)
        self.execution_submit_button = self._button(
            button_box,
            "Submit Paper",
            self.submit_selected_target,
            accent="teal",
            tooltip="Submit through the currently selected Paper, Simulation, or Live target",
        )
        self.execution_submit_button.grid(row=0, column=2, columnspan=2, sticky="ew", padx=(7, 0))
        self.execution_run_button = self.run_button
        self.execution_preview_control = self.execution_preview_button
        self.execution_paper_button = self.execution_submit_button
        self.live_button = self.execution_submit_button
        self.stop_button = self._button(
            button_box,
            "Pause All Automation",
            self.stop_automation,
            accent="gold",
            tooltip="Pause scheduled and market-open automation; it cannot cancel an order already sent to Webull",
        )
        self.stop_button.grid(row=1, column=0, columnspan=2, sticky="ew", padx=(0, 7), pady=(8, 0))
        self.power_cycle_button = self._button(button_box, "Power cycle", self.power_cycle, tooltip="Save settings and restart Timmy")
        self.power_cycle_button.grid(row=1, column=2, columnspan=2, sticky="ew", padx=(7, 0), pady=(8, 0))
        self.manual_controls.extend([self.run_button, self.execution_preview_button, self.execution_submit_button])
        self.busy_controls.extend([
            self.run_button,
            self.execution_preview_button,
            self.execution_submit_button,
            self.power_cycle_button,
        ])

        style_box = tk.Frame(controls, bg=self.colors["panel"])
        self.style_box = style_box
        style_box.grid(row=3, column=0, columnspan=2, sticky="ew", padx=10, pady=(0, 14))
        style_label = tk.Label(style_box, text="Style", bg=self.colors["panel"], fg=self.colors["muted"],
                               font=("Sans", 9, "bold"), anchor="center", justify="center")
        style_label.pack(side="left", padx=(0, 8))
        style_menu = tk.OptionMenu(style_box, self.trading_style_var, "Adaptive", "Aggressive", "Balanced", "Conservative")
        style_menu.configure(bg=self.colors["button"], fg=self.colors["button_text"],
                             activebackground=self.colors["panel_2"], activeforeground=self.colors["text"],
                             relief="flat", font=("Sans", 9, "bold"), highlightthickness=0)
        style_menu.pack(side="left", fill="x", expand=True)

        pattern_box = tk.Frame(controls, bg=self.colors["panel"])
        self.pattern_box = pattern_box
        pattern_box.grid(row=3, column=2, columnspan=4, sticky="ew", padx=10, pady=(0, 14))
        pattern_label = tk.Label(pattern_box, text="Patterns", bg=self.colors["panel"], fg=self.colors["muted"],
                                 font=("Sans", 9, "bold"), anchor="w", justify="left")
        pattern_label.pack(side="left", padx=(0, 8))
        for key, label in (("breakout", "Breakout"), ("momentum", "Momentum"), ("pullback", "Pullback"), ("volume", "Volume")):
            tk.Checkbutton(
                pattern_box,
                text=label,
                variable=self.pattern_vars[key],
                command=self.refresh_all,
                bg=self.colors["panel"],
                fg=self.colors["text"],
                selectcolor=self.colors["panel_2"],
                activebackground=self.colors["panel"],
                activeforeground=self.colors["text"],
                disabledforeground=self.colors["disabled"],
                font=("Sans", 8, "bold"),
                justify="center",
            ).pack(side="left", padx=(0, 6))

        body = tk.Frame(main, bg=self.colors["bg"])
        self.body = body
        body.grid(row=3, column=0, sticky="nsew", padx=18, pady=(0, 16))
        body.columnconfigure(0, weight=5)
        body.columnconfigure(1, weight=3)
        body.rowconfigure(0, weight=1)

        signals_panel = self._panel(body)
        self.signals_panel = signals_panel
        signals_panel.grid(row=0, column=0, sticky="nsew", padx=(0, 18))
        signals_panel.columnconfigure(0, weight=1)
        signals_panel.columnconfigure(1, weight=0)
        signals_panel.rowconfigure(3, weight=1)
        signals_panel.rowconfigure(4, weight=0)
        self._section_header(signals_panel, "SCANNER OUTPUT", "Signal scanner", "Scan Now",
                             self.refresh_all)
        scanner_filter = tk.Frame(signals_panel, bg=self.colors["panel"])
        scanner_filter.grid(row=1, column=0, sticky="ew", padx=18, pady=(0, 10))
        tk.Label(scanner_filter, text="Show", bg=self.colors["panel"], fg=self.colors["muted"],
                 font=("Sans", 9, "bold")).pack(side="left", padx=(0, 6))
        category_menu = tk.OptionMenu(
            scanner_filter, self.scanner_category_var, "All", "Moving", "Tradeable", "Blocked", "Quiet",
            "Locally quieted")
        category_menu.configure(bg=self.colors["button"], fg=self.colors["button_text"],
                                activebackground=self.colors["panel_2"], activeforeground=self.colors["text"],
                                relief="flat", font=("Sans", 9, "bold"), highlightthickness=0)
        category_menu["menu"].configure(bg=self.colors["panel_2"], fg=self.colors["text"],
                                         activebackground=self.colors["selected"],
                                         activeforeground=self.colors["selected_text"])
        category_menu.pack(side="left", padx=(0, 10))
        tk.Label(scanner_filter, text="Symbol / setup", bg=self.colors["panel"], fg=self.colors["muted"],
                 font=("Sans", 8, "bold")).pack(side="left", padx=(0, 6))
        scanner_filter_entry = tk.Entry(
            scanner_filter,
            textvariable=self.scanner_filter_var,
            bg=self.colors["entry"],
            fg=self.colors["text"],
            insertbackground=self.colors["text"],
            relief="flat",
            font=("Sans", 10),
        )
        scanner_filter_entry.pack(side="left", fill="x", expand=True, ipady=5)
        scanner_filter_entry.bind("<Escape>", lambda _event: self.scanner_filter_var.set(""))
        self._add_tooltip(scanner_filter_entry, "Search ticker, direction, setup, or action. Press Escape to clear.")
        self.scanner_category_var.trace_add("write", lambda *_args: self._render_signals())
        self.scanner_preset_menu = tk.OptionMenu(scanner_filter, self.scanner_preset_var, "Saved filters")
        self.scanner_preset_menu.configure(bg=self.colors["button"], fg=self.colors["button_text"],
                                           activebackground=self.colors["panel_2"], activeforeground=self.colors["text"],
                                           relief="flat", font=("Sans", 8, "bold"), highlightthickness=0)
        self.scanner_preset_menu.pack(side="right", padx=(6, 0))
        self._button(scanner_filter, "Save filter", self._save_scanner_preset).pack(side="right", padx=(8, 0))
        self._button(scanner_filter, "Columns", self._open_scanner_columns).pack(side="right", padx=(8, 0))
        tk.Label(scanner_filter, textvariable=self.scanner_match_var, bg=self.colors["panel"], fg=self.colors["muted"],
                 font=("Sans", 9)).pack(side="right", padx=(10, 0))
        self.scanner_filter_var.trace_add("write", lambda *_args: self._render_signals())
        scanner_summary = tk.Frame(signals_panel, bg=self.colors["panel"])
        scanner_summary.grid(row=2, column=0, sticky="ew", padx=12, pady=(0, 12))
        scanner_summary.columnconfigure((0, 1, 2, 3), weight=1)
        self.scanner_summary_labels = {}
        for idx, title in enumerate(("Scanned", "Moving", "Tradeable", "Blocked")):
            self.scanner_summary_labels[title] = self._mini_stat(scanner_summary, idx, title)
        columns = ("symbol", "scout", "score", "sense", "direction", "decision", "price", "change", "entry")
        self.signal_tree = ttk.Treeview(signals_panel, columns=columns, show="headings", selectmode="browse")
        self.signal_tree.tag_configure("up", background=self.colors["up_row"])
        self.signal_tree.tag_configure("down", background=self.colors["down_row"])
        headings = {
            "symbol": "Symbol", "scout": "Signal", "score": "Score", "sense": "Action", "direction": "Bias",
            "decision": "Model", "price": "Price Gate", "change": "Move", "entry": "Buy Limit",
        }
        self.signal_tree_headings = headings
        self.scanner_column_order = tuple(columns)
        self.scanner_visible_columns = set(columns)
        widths = {
            "symbol": 68, "scout": 68, "score": 50, "sense": 82, "direction": 62,
            "decision": 72, "price": 88, "change": 62, "entry": 76,
        }
        for key in columns:
            anchor = "w" if key == "symbol" else "center"
            self.signal_tree.heading(
                key,
                text=headings[key],
                anchor="center",
                command=lambda column=key: self._sort_signal_tree(column),
            )
            self.signal_tree.column(key, width=widths[key], anchor=anchor)
        self.signal_tree.grid(row=3, column=0, sticky="nsew", padx=(18, 0), pady=(0, 12))
        self.signal_tree_scrollbar = ttk.Scrollbar(
            signals_panel, orient="vertical", command=self.signal_tree.yview, style="Vertical.TScrollbar")
        self.signal_tree.configure(yscrollcommand=self.signal_tree_scrollbar.set)
        self.signal_tree_scrollbar.grid(row=3, column=1, sticky="ns", padx=(0, 18), pady=(0, 12))
        for widget in (self.signal_tree, self.signal_tree_scrollbar):
            widget.bind("<MouseWheel>", lambda event, target=self.signal_tree: self._scroll_widget(event, target), add="+")
            widget.bind("<Button-4>", lambda event, target=self.signal_tree: self._scroll_widget(event, target), add="+")
            widget.bind("<Button-5>", lambda event, target=self.signal_tree: self._scroll_widget(event, target), add="+")
        self.signal_tree.bind("<<TreeviewSelect>>", self._show_selected_signal)
        if isinstance(self._saved_scanner_view, dict):
            try:
                self._apply_scanner_view(scanner_view_from_dict(self._saved_scanner_view, allowed_columns=columns), save=False)
            except ValueError:
                self._saved_scanner_view = None
        self.signal_detail = tk.Text(signals_panel, height=6, bg=self.colors["panel_2"], fg=self.colors["muted"],
                                     insertbackground=self.colors["text"], relief="flat", padx=14, pady=10,
                                     font=("Monospace", 9), wrap="word")
        self.signal_detail.grid(row=4, column=0, sticky="ew", padx=(18, 0), pady=(0, 14))
        self.signal_detail_scrollbar = ttk.Scrollbar(
            signals_panel, orient="vertical", command=self.signal_detail.yview, style="Vertical.TScrollbar")
        self.signal_detail.configure(yscrollcommand=self.signal_detail_scrollbar.set)
        self.signal_detail_scrollbar.grid(row=4, column=1, sticky="ns", padx=(0, 18), pady=(0, 14))
        for widget in (self.signal_detail, self.signal_detail_scrollbar):
            widget.bind("<MouseWheel>", lambda event, target=self.signal_detail: self._scroll_widget(event, target), add="+")
            widget.bind("<Button-4>", lambda event, target=self.signal_detail: self._scroll_widget(event, target), add="+")
            widget.bind("<Button-5>", lambda event, target=self.signal_detail: self._scroll_widget(event, target), add="+")

        # Keep the Overview focused on a compact ranked list; the full scanner
        # remains available on its own tab with every diagnostic column.
        market_watchlist = self._panel(body)
        self.market_watchlist_panel = market_watchlist
        market_watchlist.columnconfigure(0, weight=1)
        market_watchlist.rowconfigure(2, weight=1)
        self._section_header(market_watchlist, "MARKET RADAR", "Ranked Watchlist", "Open Scanner",
                             lambda: self._show_tab("Scanner"), compact=True)
        watch_tools = tk.Frame(market_watchlist, bg=self.colors["panel"])
        watch_tools.grid(row=1, column=0, sticky="ew", padx=12, pady=(0, 6))
        self.watchlist_group_menu = ttk.Combobox(watch_tools, textvariable=self.watchlist_group_var,
                                                 state="readonly", width=17)
        self.watchlist_group_menu.pack(side="left", fill="x", expand=True)
        self.watchlist_group_menu.bind("<<ComboboxSelected>>", lambda _event: self._render_signals())
        self._button(watch_tools, "New", self._create_watchlist_group).pack(side="left", padx=(5, 0))
        self._button(watch_tools, "+ Group", self._add_selected_to_watchlist_group).pack(side="left", padx=(5, 0))
        self._button(watch_tools, "Pin", self._toggle_selected_watchlist_pin).pack(side="left", padx=(5, 0))
        self.local_quiet_button = self._button(watch_tools, "Quiet", self._toggle_selected_local_quiet)
        self.local_quiet_button.pack(side="left", padx=(5, 0))
        watch_columns = ("symbol", "score", "move", "signal")
        self.market_watch_tree = ttk.Treeview(
            market_watchlist, columns=watch_columns, show="headings", selectmode="browse", height=16)
        for key, title, width, anchor in (
            ("symbol", "Ticker", 74, "w"), ("score", "Score", 52, "center"),
            ("move", "Move", 68, "e"), ("signal", "Signal", 74, "center"),
        ):
            self.market_watch_tree.heading(key, text=title)
            self.market_watch_tree.column(key, width=width, minwidth=42, anchor=anchor, stretch=key == "symbol")
        self.market_watch_tree.tag_configure("up", background=self.colors["up_row"])
        self.market_watch_tree.tag_configure("down", background=self.colors["down_row"])
        self.market_watch_tree.grid(row=2, column=0, sticky="nsew", padx=12, pady=(0, 8))
        self.market_watch_tree.bind("<<TreeviewSelect>>", self._show_market_watch_selection)
        self.market_watch_footer = tk.Label(
            market_watchlist, text="Select a ticker to inspect its chart and decision.",
            bg=self.colors["panel"], fg=self.colors["muted"], anchor="w", justify="left",
            font=("Sans", 8), wraplength=240)
        self.market_watch_footer.grid(row=3, column=0, sticky="ew", padx=14, pady=(0, 12))

        universe_panel = self._panel(body)
        self.universe_panel = universe_panel
        universe_panel.rowconfigure(2, weight=1)
        self._section_header(universe_panel, "MARKET INTAKE", "Universe And Watchlists", "Use Sample Bars",
                             self.refresh_data)
        movement_filter_row = tk.Frame(universe_panel, bg=self.colors["panel"])
        movement_filter_row.grid(row=1, column=0, sticky="ew", padx=18, pady=(0, 8))
        tk.Label(movement_filter_row, text="SHORTLIST FILTER", bg=self.colors["panel"],
                 fg=self.colors["muted"], font=("Sans", 8, "bold")).pack(side="left", padx=(0, 8))
        self.movement_filter_menu = ttk.Combobox(
            movement_filter_row,
            textvariable=self.movement_filter_var,
            state="readonly",
            width=24,
            values=("All fresh", "Pinned only", "Frequent movers (3+)"),
        )
        self.movement_filter_menu.pack(side="left")
        self.movement_filter_menu.bind("<<ComboboxSelected>>", lambda _event: self._render_universe())
        self.universe_text = tk.Text(universe_panel, height=18, bg=self.colors["panel_2"], fg=self.colors["text"],
                                     insertbackground=self.colors["text"], relief="flat", padx=14, pady=12,
                                     font=("Monospace", 10), wrap="word")
        self.universe_text.grid(row=2, column=0, sticky="nsew", padx=18, pady=(0, 18))

        self._build_research_panel(body)

        setup_panel = self._panel(body)
        self.setup_panel = setup_panel
        setup_panel.columnconfigure(0, weight=5)
        setup_panel.columnconfigure(1, weight=4)
        setup_panel.rowconfigure(2, weight=1)
        self._section_header(setup_panel, "ACCOUNT SETUP", "Broker Profile", None, None)
        setup_steps = tk.Frame(setup_panel, bg=self.colors["panel"])
        setup_steps.grid(row=1, column=0, columnspan=2, sticky="ew", padx=18, pady=(0, 14))
        setup_steps.columnconfigure((0, 1, 2, 3, 4), weight=1)
        self.setup_badges: dict[str, tuple[tk.Label, tk.Label]] = {}
        for idx, label in enumerate(("Profile", "Keys", "Account", "Cash", "Live")):
            badge = tk.Frame(setup_steps, bg=self.colors["panel_2"], highlightbackground=self.colors["line"], highlightthickness=1)
            badge.grid(row=0, column=idx, sticky="ew", padx=(0 if idx == 0 else 8, 0))
            title = tk.Label(badge, text=label, bg=self.colors["panel_2"], fg=self.colors["muted"],
                             font=("Sans", 9, "bold"), anchor="center")
            title.pack(fill="x", padx=10, pady=(8, 2))
            value = tk.Label(badge, text="-", bg=self.colors["panel_2"], fg=self.colors["text"],
                             font=("Sans", 11, "bold"), anchor="center")
            value.pack(fill="x", padx=10, pady=(0, 8))
            self.setup_badges[label] = (title, value)
        profile_form = tk.Frame(setup_panel, bg=self.colors["panel"])
        profile_form.grid(row=2, column=0, sticky="nsew", padx=18, pady=(0, 18))
        profile_form.columnconfigure(1, weight=1)
        setup_status = tk.Frame(setup_panel, bg=self.colors["panel_2"], highlightbackground=self.colors["line"], highlightthickness=1)
        setup_status.grid(row=2, column=1, sticky="nsew", padx=(0, 18), pady=(0, 18))
        setup_status.columnconfigure(0, weight=1)
        setup_status.rowconfigure(5, weight=1)

        row = 0
        tk.Label(
            profile_form,
            text="Broker Profile",
            bg=self.colors["panel"],
            fg=self.colors["text"],
            font=("Sans", 14, "bold"),
            anchor="w",
        ).grid(row=row, column=0, columnspan=3, sticky="ew", pady=(0, 2))
        tk.Label(
            profile_form,
            text="Keys and account settings stay local.",
            bg=self.colors["panel"],
            fg=self.colors["muted"],
            font=("Sans", 9),
            anchor="w",
            justify="left",
        ).grid(row=row + 1, column=0, columnspan=3, sticky="ew", pady=(0, 12))
        row += 2
        for label, variable, secret in (
            ("App Key", self.profile_app_key_var, True),
            ("App Secret", self.profile_app_secret_var, True),
            ("Account ID", self.profile_account_id_var, True),
            ("Region", self.profile_region_var, False),
            ("Endpoint", self.profile_endpoint_var, False),
        ):
            self._profile_field(profile_form, row, label, variable, secret=secret)
            row += 1

        switch_box = tk.Frame(profile_form, bg=self.colors["panel"])
        switch_box.grid(row=row, column=0, columnspan=3, sticky="ew", pady=(8, 8))
        switch_box.columnconfigure((0, 1), weight=1)
        for idx, (label, variable) in enumerate((
            ("Live account mode", self.profile_trader_live_var),
            ("Allow live orders", self.profile_live_orders_var),
            ("Exact preview always required", self.profile_require_preview_var),
            ("Auto at open", self.profile_auto_live_var),
        )):
            check = tk.Checkbutton(
                switch_box,
                text=label,
                variable=variable,
                bg=self.colors["panel"],
                fg=self.colors["text"],
                selectcolor=self.colors["panel_2"],
                activebackground=self.colors["panel"],
                activeforeground=self.colors["text"],
                font=("Sans", 9),
                anchor="w",
                justify="left",
            )
            check.grid(row=idx // 2, column=idx % 2, sticky="ew", padx=(0, 10), pady=2)
            if variable is self.profile_require_preview_var:
                check.configure(state=tk.DISABLED)
        row += 1

        account_select = tk.Frame(profile_form, bg=self.colors["panel"])
        account_select.grid(row=row, column=0, columnspan=3, sticky="ew", pady=(6, 8))
        account_select.columnconfigure(1, weight=1)
        tk.Label(account_select, text="Account lane", bg=self.colors["panel"], fg=self.colors["muted"],
                 font=("Sans", 9, "bold"), anchor="w").grid(row=0, column=0, sticky="w", padx=(0, 10))
        self.setup_account_menu = self._account_option_menu(account_select)
        self.setup_account_menu.grid(row=0, column=1, sticky="ew")
        row += 1

        setup_actions = tk.Frame(profile_form, bg=self.colors["panel"])
        setup_actions.grid(row=row, column=0, columnspan=3, sticky="ew", pady=(8, 0))
        setup_actions.columnconfigure((0, 1, 2), weight=1, minsize=120)
        self.setup_verify_button = self._button(
            setup_actions,
            "✓ Keys",
            lambda: self._run_action("Verifying Webull profile", self.verify_webull_profile),
            accent="gold",
            tooltip="Checks the current draft credentials with Webull before saving.",
        )
        self.setup_verify_button.grid(row=0, column=0, sticky="ew", padx=(0, 8), pady=(0, 8))
        self.setup_save_button = self._button(
            setup_actions,
            "✓ Save",
            self.save_webull_profile_from_setup,
            accent="teal",
            tooltip="Writes the verified profile to this machine.",
        )
        self.setup_save_button.grid(row=0, column=1, sticky="ew", padx=8, pady=(0, 8))
        self.setup_boilerplate_button = self._button(
            setup_actions,
            "≡ Examples",
            self.open_setup_boilerplates,
            tooltip="Opens example setup templates without changing your live profile.",
        )
        self.setup_boilerplate_button.grid(row=0, column=2, sticky="ew", padx=(8, 0), pady=(0, 8))
        self.setup_check_button = self._button(
            setup_actions,
            "✓ Account",
            lambda: self._run_action("Checking Webull", self.webull_check),
            accent="teal",
            tooltip="Refreshes account status and buying power from Webull.",
        )
        self.setup_check_button.grid(row=1, column=0, sticky="ew", padx=(0, 8))
        self.setup_live_button = self._button(
            setup_actions,
            "⚡ Live",
            self.use_live_from_setup,
            tooltip="Switches Timmy's execution target to Live after readiness checks.",
        )
        self.setup_live_button.grid(row=1, column=1, columnspan=2, sticky="ew", padx=(8, 0))
        self.busy_controls.extend([self.setup_verify_button, self.setup_save_button, self.setup_check_button, self.setup_live_button])

        tk.Label(
            setup_status,
            text="NEXT MOVE",
            bg=self.colors["panel_2"],
            fg=self.colors["muted"],
            font=("Sans", 9, "bold"),
            anchor="w",
        ).grid(row=0, column=0, sticky="ew", padx=14, pady=(12, 2))
        self.setup_next_action_label = tk.Label(
            setup_status,
            text="-",
            bg=self.colors["panel_2"],
            fg=self.colors["text"],
            font=("Sans", 11, "bold"),
            anchor="w",
            justify="left",
            wraplength=360,
        )
        self.setup_next_action_label.grid(row=1, column=0, sticky="ew", padx=14, pady=(0, 12))

        account_strip = tk.Frame(setup_status, bg=self.colors["panel_2"])
        account_strip.grid(row=2, column=0, sticky="ew", padx=14, pady=(0, 12))
        account_strip.columnconfigure((0, 1, 2, 3), weight=1)
        self.setup_account_labels = {}
        for idx, label in enumerate(("Account", "Cash Account", "Paper Account", "Status")):
            tile = tk.Frame(account_strip, bg=self.colors["panel"], highlightbackground=self.colors["line"], highlightthickness=1)
            tile.grid(row=0, column=idx, sticky="ew", padx=(0 if idx == 0 else 8, 0))
            tk.Label(tile, text=label, bg=self.colors["panel"], fg=self.colors["muted"],
                     font=("Sans", 8, "bold"), anchor="center").pack(fill="x", padx=8, pady=(8, 1))
            value = tk.Label(tile, text="-", bg=self.colors["panel"], fg=self.colors["text"],
                             font=("Sans", 10, "bold"), anchor="center")
            value.pack(fill="x", padx=8, pady=(0, 8))
            self.setup_account_labels[label] = value
        account_strip.grid_remove()

        readiness = tk.Frame(setup_status, bg=self.colors["panel_2"])
        readiness.grid(row=3, column=0, sticky="ew", padx=14, pady=(0, 12))
        readiness.columnconfigure(1, weight=1)
        self.setup_readiness_labels = {}
        for idx, label in enumerate(("Draft", "Verify", "Save", "Account", "Live")):
            tk.Label(
                readiness,
                text=label,
                bg=self.colors["panel_2"],
                fg=self.colors["muted"],
                font=("Sans", 8, "bold"),
                anchor="w",
            ).grid(row=idx, column=0, sticky="w", pady=2, padx=(0, 10))
            value = tk.Label(
                readiness,
                text="-",
                bg=self.colors["panel_2"],
                fg=self.colors["text"],
                font=("Sans", 9),
                anchor="w",
            )
            value.grid(row=idx, column=1, sticky="ew", pady=2)
            self.setup_readiness_labels[label] = value

        tk.Label(
            setup_status,
            text="ACCOUNT NOTES",
            bg=self.colors["panel_2"],
            fg=self.colors["muted"],
            font=("Sans", 9, "bold"),
            anchor="w",
        ).grid(row=4, column=0, sticky="ew", padx=14, pady=(0, 4))
        self.setup_status_text = tk.Text(
            setup_status,
            height=10,
            bg=self.colors["panel_2"],
            fg=self.colors["text"],
            insertbackground=self.colors["text"],
            relief="flat",
            padx=14,
            pady=12,
            font=("Monospace", 10),
            wrap="word",
        )
        self.setup_status_text.grid(row=5, column=0, sticky="nsew")

        strategy_tab_panel = self._panel(body)
        self.strategy_tab_panel = strategy_tab_panel
        strategy_tab_panel.columnconfigure(0, weight=3)
        strategy_tab_panel.columnconfigure(1, weight=2)
        strategy_tab_panel.rowconfigure(2, weight=1)
        self._section_header(strategy_tab_panel, "STRATEGY MODEL", "Decision Logic", None, None)
        strategy_summary = tk.Frame(strategy_tab_panel, bg=self.colors["panel"])
        strategy_summary.grid(row=1, column=0, columnspan=2, sticky="ew", padx=12, pady=(0, 12))
        strategy_summary.columnconfigure((0, 1, 2, 3), weight=1)
        self.strategy_summary_labels = {}
        for idx, title in enumerate(("Style", "Patterns", "Eligible", "Readiness")):
            self.strategy_summary_labels[title] = self._mini_stat(strategy_summary, idx, title)
        self.strategy_decision_text = tk.Text(
            strategy_tab_panel,
            height=18,
            bg=self.colors["panel_2"],
            fg=self.colors["text"],
            insertbackground=self.colors["text"],
            relief="flat",
            padx=14,
            pady=12,
            font=("Monospace", 10),
            wrap="word",
        )
        self.strategy_decision_text.grid(row=2, column=0, sticky="nsew", padx=18, pady=(0, 18))
        self.strategy_gate_text = tk.Text(
            strategy_tab_panel,
            height=18,
            bg=self.colors["panel_2"],
            fg=self.colors["muted"],
            insertbackground=self.colors["text"],
            relief="flat",
            padx=14,
            pady=12,
            font=("Monospace", 10),
            wrap="word",
        )
        self.strategy_gate_text.grid(row=2, column=1, sticky="nsew", padx=(0, 18), pady=(0, 18))

        execution_tab_panel = self._panel(body)
        self.execution_tab_panel = execution_tab_panel
        execution_tab_panel.columnconfigure(0, weight=3)
        execution_tab_panel.columnconfigure(1, weight=2)
        execution_tab_panel.rowconfigure(2, weight=1)
        self._section_header(execution_tab_panel, "EXECUTION DESK", "Orders And Broker Gates", None, None)
        execution_summary = tk.Frame(execution_tab_panel, bg=self.colors["panel"])
        execution_summary.grid(row=1, column=0, columnspan=2, sticky="ew", padx=12, pady=(0, 12))
        execution_summary.columnconfigure((0, 1, 2, 3), weight=1)
        self.execution_summary_labels = {}
        for idx, title in enumerate(("Target", "Queue", "Fractional", "Broker")):
            self.execution_summary_labels[title] = self._mini_stat(execution_summary, idx, title)
        self.execution_queue_text = tk.Text(
            execution_tab_panel,
            height=12,
            bg=self.colors["panel_2"],
            fg=self.colors["text"],
            insertbackground=self.colors["text"],
            relief="flat",
            padx=14,
            pady=12,
            font=("Monospace", 10),
            wrap="word",
        )
        self.execution_queue_text.grid(row=2, column=0, sticky="nsew", padx=18, pady=(0, 18))
        self.execution_gate_text = tk.Text(
            execution_tab_panel,
            height=12,
            bg=self.colors["panel_2"],
            fg=self.colors["muted"],
            insertbackground=self.colors["text"],
            relief="flat",
            padx=14,
            pady=12,
            font=("Monospace", 10),
            wrap="word",
        )
        self.execution_gate_text.grid(row=2, column=1, sticky="nsew", padx=(0, 18), pady=(0, 18))
        recovery_controls = tk.Frame(execution_tab_panel, bg=self.colors["panel"])
        recovery_controls.grid(row=3, column=0, columnspan=2, sticky="ew", padx=18, pady=(0, 18))
        self.unknown_order_review_button = self._button(
            recovery_controls,
            "Review unknown orders",
            self.review_unknown_live_orders,
            accent="gold",
        )
        self.unknown_order_review_button.configure(width=22)
        self.unknown_order_review_button.pack(side="left")

        health_panel = self._panel(body)
        self.health_panel = health_panel
        health_panel.columnconfigure(0, weight=1)
        health_panel.columnconfigure(1, weight=1)
        health_panel.rowconfigure(2, weight=1)
        self._section_header(health_panel, "DESK HEALTH", "Today's Guardrails", "Run Check", self.run_system_check)
        health_summary = tk.Frame(health_panel, bg=self.colors["panel"])
        health_summary.grid(row=1, column=0, columnspan=2, sticky="ew", padx=12, pady=(0, 12))
        health_summary.columnconfigure((0, 1, 2, 3), weight=1)
        self.health_summary_labels = {}
        for idx, title in enumerate(("Desk", "Market", "Account", "Watchdog")):
            self.health_summary_labels[title] = self._mini_stat(health_summary, idx, title)
        self._button(health_summary, "Back Up Preferences", self._backup_ui_preferences, accent="teal").grid(
            row=0, column=4, sticky="e", padx=(10, 8), pady=5)
        self._button(health_summary, "Copy Details", self._copy_health_details).grid(
            row=0, column=5, sticky="e", padx=(0, 8), pady=5)
        self.health_text = tk.Text(
            health_panel,
            height=16,
            bg=self.colors["panel_2"],
            fg=self.colors["text"],
            insertbackground=self.colors["text"],
            relief="flat",
            padx=14,
            pady=12,
            font=("Monospace", 10),
            wrap="word",
        )
        self.health_text.grid(row=2, column=0, sticky="nsew", padx=18, pady=(0, 18))
        self.diagnostics_text = tk.Text(
            health_panel,
            height=16,
            bg=self.colors["panel_2"],
            fg=self.colors["muted"],
            insertbackground=self.colors["text"],
            relief="flat",
            padx=14,
            pady=12,
            font=("Monospace", 10),
            wrap="word",
        )
        self.diagnostics_text.grid(row=2, column=1, sticky="nsew", padx=(0, 18), pady=(0, 18))

        portfolio_panel = self._panel(body)
        self.portfolio_panel = portfolio_panel
        portfolio_panel.columnconfigure((0, 1), weight=1, uniform="portfolio-columns")
        portfolio_panel.rowconfigure(4, weight=1)
        self._section_header(portfolio_panel, "ACCOUNT PERFORMANCE", "Portfolio", "Check Broker",
                             lambda: self._run_action("Checking Webull", self.webull_check), compact=False)
        portfolio_stats = tk.Frame(portfolio_panel, bg=self.colors["panel"])
        portfolio_stats.grid(row=1, column=0, columnspan=2, sticky="ew", padx=12, pady=(0, 12))
        portfolio_stats.columnconfigure((0, 1, 2, 3, 4), weight=1)
        self.portfolio_summary_labels = {}
        for idx, title in enumerate(self.portfolio_card_order):
            self.portfolio_summary_labels[title] = self._mini_stat(portfolio_stats, idx, title)
        portfolio_context_row = tk.Frame(portfolio_panel, bg=self.colors["panel"])
        portfolio_context_row.grid(row=2, column=0, columnspan=2, sticky="ew", padx=18, pady=(0, 8))
        portfolio_context_row.columnconfigure(0, weight=1)
        self.portfolio_account_context = tk.Label(
            portfolio_context_row, text="Broker snapshot has not been checked.", bg=self.colors["panel"],
            fg=self.colors["muted"], font=("Sans", 8), anchor="w", justify="left", wraplength=1240)
        self.portfolio_account_context.grid(row=0, column=0, sticky="ew", padx=(2, 10))
        self._button(portfolio_context_row, "Card order", self._edit_portfolio_card_order).grid(
            row=0, column=1, sticky="e", padx=(4, 0))
        self.portfolio_risk_context = tk.Label(
            portfolio_panel, text="Paper performance and exposure will appear when journal data is available.",
            bg=self.colors["panel"], fg=self.colors["muted"], font=("Sans", 8, "bold"), anchor="w",
            justify="left", wraplength=1240)
        self.portfolio_risk_context.grid(row=3, column=0, columnspan=2, sticky="ew", padx=20, pady=(0, 10))
        holdings_box = tk.Frame(portfolio_panel, bg=self.colors["panel_2"], highlightbackground=self.colors["line"], highlightthickness=1)
        holdings_box.grid(row=4, column=0, columnspan=2, sticky="nsew", padx=18, pady=(0, 12))
        holdings_box.columnconfigure(0, weight=1)
        holdings_box.columnconfigure(1, weight=0)
        holdings_box.rowconfigure(1, weight=1)
        tk.Label(holdings_box, text="PAPER POSITIONS · MARKED TO LATEST LOADED PRICE",
                 bg=self.colors["panel_2"], fg=self.colors["teal"], font=("Sans", 9, "bold"),
                 anchor="w").grid(row=0, column=0, sticky="ew", padx=14, pady=(10, 6))
        holding_columns = ("symbol", "qty", "entry", "last", "value", "pnl", "state")
        self.portfolio_holdings_tree = ttk.Treeview(
            holdings_box, columns=holding_columns, show="headings", selectmode="browse", height=7)
        for key, title, width, anchor in (
            ("symbol", "Symbol", 90, "w"), ("qty", "Qty", 72, "e"),
            ("entry", "Avg Cost", 105, "e"), ("last", "Last", 105, "e"),
            ("value", "Market Value", 120, "e"), ("pnl", "Open P&L", 110, "e"),
            ("state", "Status", 120, "center"),
        ):
            self.portfolio_holdings_tree.heading(key, text=title)
            self.portfolio_holdings_tree.column(key, width=width, minwidth=54, anchor=anchor, stretch=key == "symbol")
        self.portfolio_holdings_tree.tag_configure("up", foreground=self.colors["green"])
        self.portfolio_holdings_tree.tag_configure("down", foreground=self.colors["red"])
        self.portfolio_holdings_tree.grid(row=1, column=0, sticky="nsew", padx=12, pady=(0, 12))
        self.portfolio_holdings_scrollbar = ttk.Scrollbar(
            holdings_box, orient="vertical", command=self.portfolio_holdings_tree.yview, style="Vertical.TScrollbar")
        self.portfolio_holdings_tree.configure(yscrollcommand=self.portfolio_holdings_scrollbar.set)
        self.portfolio_holdings_scrollbar.grid(row=1, column=1, sticky="ns", padx=(0, 12), pady=(0, 12))
        portfolio_bottom = tk.Frame(portfolio_panel, bg=self.colors["panel"])
        portfolio_bottom.grid(row=5, column=0, columnspan=2, sticky="ew", padx=18, pady=(0, 18))
        portfolio_bottom.columnconfigure((0, 1, 2), weight=1, uniform="portfolio-bottom")
        equity_box = tk.Frame(portfolio_bottom, bg=self.colors["panel_2"], highlightbackground=self.colors["line"], highlightthickness=1)
        equity_box.grid(row=0, column=0, sticky="nsew", padx=(0, 8))
        tk.Label(equity_box, text="REALIZED EQUITY CURVE · PAPER LEDGER", bg=self.colors["panel_2"],
                 fg=self.colors["muted"], font=("Sans", 8, "bold"), anchor="w").pack(fill="x", padx=12, pady=(9, 2))
        self.portfolio_equity_chart = tk.Canvas(equity_box, height=150, bg=self.colors["panel_2"],
                                                highlightthickness=0, borderwidth=0)
        self.portfolio_equity_chart.pack(fill="both", expand=True, padx=8, pady=(0, 8))
        self.portfolio_equity_chart.bind("<Configure>", lambda _event: self._draw_portfolio_equity(), add="+")
        activity_box = tk.Frame(portfolio_bottom, bg=self.colors["panel_2"], highlightbackground=self.colors["line"], highlightthickness=1)
        activity_box.grid(row=0, column=1, sticky="nsew", padx=(8, 0))
        tk.Label(activity_box, text="RECENT PAPER CLOSES", bg=self.colors["panel_2"], fg=self.colors["muted"],
                 font=("Sans", 8, "bold"), anchor="w").pack(fill="x", padx=12, pady=(9, 2))
        self.portfolio_activity_text = tk.Text(activity_box, height=8, bg=self.colors["panel_2"], fg=self.colors["text"],
                                               insertbackground=self.colors["text"], relief="flat", padx=12, pady=8,
                                               font=("Monospace", 9), wrap="word")
        self.portfolio_activity_text.pack(fill="both", expand=True, padx=8, pady=(0, 8))
        self.trader_scorecard = tk.Frame(portfolio_bottom, bg=self.colors["panel_2"],
                                        highlightbackground=self.colors["line"], highlightthickness=1)
        self.trader_scorecard.grid(row=0, column=2, sticky="nsew", padx=(8, 0))
        self.trader_scorecard.columnconfigure(0, weight=1)
        tk.Label(self.trader_scorecard, text="TRADER SCORECARD", bg=self.colors["panel_2"],
                 fg=self.colors["teal"], font=("Sans", 9, "bold"), anchor="w").grid(
                     row=0, column=0, sticky="ew", padx=12, pady=(10, 2))
        self.trader_score_value = tk.Label(self.trader_scorecard, text="—", bg=self.colors["panel_2"],
                                           fg=self.colors["text"], font=("Sans", 20, "bold"), anchor="w")
        self.trader_score_value.grid(row=1, column=0, sticky="ew", padx=12)
        self.trader_score_grade = tk.Label(self.trader_scorecard, text="BUILDING PROFILE", bg=self.colors["panel_2"],
                                           fg=self.colors["gold"], font=("Sans", 9, "bold"), anchor="w")
        self.trader_score_grade.grid(row=2, column=0, sticky="ew", padx=12, pady=(0, 4))
        self.trader_live_score_value = tk.Label(self.trader_scorecard, text="LIVE  — / 100", bg=self.colors["panel_2"],
                                                fg=self.colors["muted"], font=("Sans", 12, "bold"), anchor="w")
        self.trader_live_score_value.grid(row=3, column=0, sticky="ew", padx=12)
        self.trader_live_score_grade = tk.Label(self.trader_scorecard, text="BUILDING PROFILE", bg=self.colors["panel_2"],
                                                fg=self.colors["muted"], font=("Sans", 8, "bold"), anchor="w")
        self.trader_live_score_grade.grid(row=4, column=0, sticky="ew", padx=12, pady=(0, 2))
        self._button(self.trader_scorecard, "Edit profile", self._edit_trader_profile).grid(
            row=5, column=0, sticky="w", padx=12, pady=(3, 4))
        self.trader_score_detail = tk.Text(self.trader_scorecard, height=11, bg=self.colors["panel_2"],
                                           fg=self.colors["muted"], relief="flat", padx=12, pady=4,
                                           font=("Monospace", 8), wrap="word")
        self.trader_score_detail.grid(row=6, column=0, sticky="nsew", padx=(4, 0), pady=(0, 8))
        self.trader_score_scroll = ttk.Scrollbar(self.trader_scorecard, orient="vertical",
                                                 command=self.trader_score_detail.yview,
                                                 style="Vertical.TScrollbar")
        self.trader_score_detail.configure(yscrollcommand=self.trader_score_scroll.set, state="disabled")
        self.trader_score_scroll.grid(row=6, column=1, sticky="ns", padx=(0, 4), pady=(0, 8))

        automation_panel = self._panel(body)
        self.automation_panel = automation_panel
        automation_panel.columnconfigure((0, 1), weight=1, uniform="automation-columns")
        automation_panel.rowconfigure((2, 3), weight=1)
        self._section_header(automation_panel, "AUTO TRADE ASSISTANT", "Automation Status", None, None)
        automation_stats = tk.Frame(automation_panel, bg=self.colors["panel"])
        self.automation_stats = automation_stats
        automation_stats.grid(row=1, column=0, columnspan=2, sticky="ew", padx=12, pady=(0, 12))
        automation_stats.columnconfigure((0, 1, 2, 3, 4), weight=1)
        self.automation_summary_labels = {}
        for idx, title in enumerate(("Automation", "Mode", "Target", "Next Cycle", "Data / Account")):
            self.automation_summary_labels[title] = self._mini_stat(automation_stats, idx, title)
        automation_guidance = tk.Frame(automation_panel, bg=self.colors["panel_2"], highlightbackground=self.colors["line"], highlightthickness=1)
        self.automation_guidance = automation_guidance
        automation_guidance.grid(row=2, column=0, sticky="nsew", padx=(18, 9), pady=(0, 18))
        automation_guidance.columnconfigure(0, weight=1)
        automation_guidance.rowconfigure(1, weight=1)
        tk.Label(automation_guidance, text="NEXT ACTION & BLOCKERS", bg=self.colors["panel_2"], fg=self.colors["teal"],
                 font=("Sans", 9, "bold"), anchor="w").grid(row=0, column=0, sticky="ew", padx=14, pady=(12, 6))
        self.automation_readiness_text = tk.Text(automation_guidance, height=16, bg=self.colors["panel_2"],
                                                 fg=self.colors["text"], insertbackground=self.colors["text"],
                                                 relief="flat", padx=14, pady=8, font=("Monospace", 10), wrap="word")
        self.automation_readiness_text.grid(row=1, column=0, sticky="nsew", padx=4, pady=(0, 12))
        self.automation_readiness_scroll = ttk.Scrollbar(
            automation_guidance, orient="vertical", command=self.automation_readiness_text.yview,
            style="Vertical.TScrollbar")
        self.automation_readiness_text.configure(yscrollcommand=self.automation_readiness_scroll.set)
        self.automation_readiness_scroll.grid(row=1, column=1, sticky="ns", padx=(0, 5), pady=(0, 12))
        automation_review_actions = tk.Frame(automation_guidance, bg=self.colors["panel_2"])
        automation_review_actions.grid(row=2, column=0, columnspan=2, sticky="ew", padx=12, pady=(0, 12))
        automation_review_actions.columnconfigure((0, 1), weight=1)
        self._button(automation_review_actions, "Open Execution & orders",
                     lambda: self._show_tab("Execution"), accent="teal").grid(
                         row=0, column=0, sticky="ew", padx=(0, 5))
        self._button(automation_review_actions, "Open Broker",
                     lambda: self._show_tab("Broker")).grid(
                         row=0, column=1, sticky="ew", padx=(5, 0))
        automation_workflow = tk.Frame(automation_panel, bg=self.colors["panel"], highlightbackground=self.colors["line"], highlightthickness=1)
        self.automation_workflow = automation_workflow
        automation_workflow.grid(row=2, column=1, sticky="nsew", padx=(9, 18), pady=(0, 18))
        automation_workflow.columnconfigure((0, 2), weight=1, uniform="automation-lanes")
        automation_workflow.rowconfigure((1, 2), weight=1)
        tk.Label(automation_workflow, text="PAPER & SIMULATION FEEDBACK", bg=self.colors["panel"], fg=self.colors["muted"],
                 font=("Sans", 9, "bold"), anchor="w").grid(row=0, column=0, columnspan=3, sticky="ew", padx=16, pady=(14, 8))
        paper_lane_frame = tk.Frame(automation_workflow, bg=self.colors["panel"])
        self.paper_insights_frame = paper_lane_frame
        paper_lane_frame.grid(row=1, column=0, sticky="nsew", padx=(12, 5), pady=(0, 12))
        paper_lane_frame.columnconfigure(0, weight=1)
        paper_lane_frame.rowconfigure(0, weight=1)
        self.paper_insights_text = tk.Text(paper_lane_frame, height=16, bg=self.colors["panel_2"], fg=self.colors["text"],
                                           insertbackground=self.colors["text"], relief="flat", padx=12, pady=10,
                                           font=("Monospace", 9), wrap="word")
        self.paper_insights_text.grid(row=0, column=0, sticky="nsew")
        paper_lane_scroll = ttk.Scrollbar(paper_lane_frame, orient="vertical", command=self.paper_insights_text.yview,
                                          style="Vertical.TScrollbar")
        self.paper_insights_text.configure(yscrollcommand=paper_lane_scroll.set)
        paper_lane_scroll.grid(row=0, column=1, sticky="ns")
        simulation_lane_frame = tk.Frame(automation_workflow, bg=self.colors["panel"])
        self.simulation_insights_frame = simulation_lane_frame
        simulation_lane_frame.grid(row=1, column=2, sticky="nsew", padx=(5, 12), pady=(0, 12))
        simulation_lane_frame.columnconfigure(0, weight=1)
        simulation_lane_frame.rowconfigure(0, weight=1)
        self.simulation_insights_text = tk.Text(simulation_lane_frame, height=16, bg=self.colors["panel_2"], fg=self.colors["text"],
                                                insertbackground=self.colors["text"], relief="flat", padx=12, pady=10,
                                                font=("Monospace", 9), wrap="word")
        self.simulation_insights_text.grid(row=0, column=0, sticky="nsew")
        simulation_lane_scroll = ttk.Scrollbar(simulation_lane_frame, orient="vertical", command=self.simulation_insights_text.yview,
                                               style="Vertical.TScrollbar")
        self.simulation_insights_text.configure(yscrollcommand=simulation_lane_scroll.set)
        simulation_lane_scroll.grid(row=0, column=1, sticky="ns")
        alerts_panel = self._panel(body)
        self.alerts_panel = alerts_panel
        alerts_panel.columnconfigure((0, 1), weight=1, uniform="alert-columns")
        alerts_panel.rowconfigure(2, weight=1)
        self._section_header(alerts_panel, "LOCAL SIGNAL MONITOR", "Alerts And Triggers", "New Rule",
                             self._create_alert_rule)
        alert_actions = tk.Frame(alerts_panel, bg=self.colors["panel"])
        alert_actions.grid(row=1, column=0, columnspan=2, sticky="ew", padx=18, pady=(0, 10))
        self._button(alert_actions, "Enable / pause rule", self._toggle_selected_alert_rule).pack(side="left", padx=(0, 8))
        self._button(alert_actions, "Remove rule", self._remove_selected_alert_rule, accent="gold").pack(side="left", padx=(0, 8))
        self._button(alert_actions, "Acknowledge event", self._acknowledge_selected_alert).pack(side="left")
        self._button(alert_actions, "Acknowledge all new", self._acknowledge_all_alerts, accent="teal").pack(side="right")
        rules_box = tk.Frame(alerts_panel, bg=self.colors["panel_2"], highlightbackground=self.colors["line"], highlightthickness=1)
        rules_box.grid(row=2, column=0, sticky="nsew", padx=(18, 8), pady=(0, 18))
        rules_box.columnconfigure(0, weight=1)
        rules_box.rowconfigure(1, weight=1)
        tk.Label(rules_box, text="RULES · EVALUATED AFTER EACH SCAN", bg=self.colors["panel_2"],
                 fg=self.colors["teal"], font=("Sans", 9, "bold"), anchor="w").grid(
                     row=0, column=0, sticky="ew", padx=12, pady=(10, 6))
        self.alert_rules_tree = ttk.Treeview(rules_box, columns=("name", "condition", "state"),
                                             show="headings", selectmode="browse", height=10)
        for key, title, width in (("name", "Rule", 130), ("condition", "Condition", 210), ("state", "State", 72)):
            self.alert_rules_tree.heading(key, text=title)
            self.alert_rules_tree.column(key, width=width, anchor="w", stretch=key != "state")
        self.alert_rules_tree.grid(row=1, column=0, sticky="nsew", padx=10, pady=(0, 10))
        events_box = tk.Frame(alerts_panel, bg=self.colors["panel_2"], highlightbackground=self.colors["line"], highlightthickness=1)
        events_box.grid(row=2, column=1, sticky="nsew", padx=(8, 18), pady=(0, 18))
        events_box.columnconfigure(0, weight=1)
        events_box.rowconfigure(2, weight=1)
        self.alert_events_heading = tk.Label(events_box, text="TRIGGER HISTORY · LOCAL ONLY", bg=self.colors["panel_2"],
                                             fg=self.colors["muted"], font=("Sans", 9, "bold"), anchor="w")
        self.alert_events_heading.grid(row=0, column=0, sticky="ew", padx=12, pady=(10, 6))
        history_tools = tk.Frame(events_box, bg=self.colors["panel_2"])
        history_tools.grid(row=1, column=0, sticky="ew", padx=10, pady=(0, 7))
        history_tools.columnconfigure(1, weight=1)
        ttk.Combobox(history_tools, textvariable=self.alert_history_state_var, values=("All", "New", "Seen"),
                     state="readonly", width=7).grid(row=0, column=0, sticky="w", padx=(0, 6))
        history_search = tk.Entry(history_tools, textvariable=self.alert_history_query_var, bg=self.colors["entry"],
                                  fg=self.colors["text"], insertbackground=self.colors["text"], relief="flat")
        history_search.grid(row=0, column=1, sticky="ew", padx=(0, 6), ipady=4)
        history_search.insert(0, "")
        ttk.Combobox(history_tools, textvariable=self.alert_history_sort_var, values=("Newest", "Oldest", "Symbol"),
                     state="readonly", width=8).grid(row=0, column=2, sticky="e")
        for widget in history_tools.winfo_children():
            if isinstance(widget, ttk.Combobox):
                widget.bind("<<ComboboxSelected>>", lambda _event: self._render_alerts_panel())
        history_search.bind("<KeyRelease>", lambda _event: self._render_alerts_panel())
        history_search.bind("<Escape>", lambda _event: (self.alert_history_query_var.set(""), self._render_alerts_panel()))
        self.alert_events_tree = ttk.Treeview(events_box, columns=("time", "symbol", "rule", "state"),
                                              show="headings", selectmode="browse", height=10)
        for key, title, width in (("time", "Triggered", 145), ("symbol", "Ticker", 70),
                                  ("rule", "Rule", 130), ("state", "State", 82)):
            self.alert_events_tree.heading(key, text=title)
            self.alert_events_tree.column(key, width=width, anchor="w", stretch=key == "rule")
        self.alert_events_tree.grid(row=2, column=0, sticky="nsew", padx=10, pady=(0, 10))
        self.alert_events_tree.tag_configure("new", foreground=self.colors["gold"])

        right = tk.Frame(body, bg=self.colors["bg"])
        self.right_panel = right
        right.grid(row=0, column=1, sticky="nsew")
        right.rowconfigure(0, weight=3)
        right.rowconfigure(1, weight=2)
        right.rowconfigure(3, weight=0)
        right.columnconfigure((0, 1), weight=1, uniform="desk-insights")

        chart_panel = self._panel(right)
        self.market_chart_panel = chart_panel
        chart_panel.grid(row=0, column=0, columnspan=2, sticky="nsew", pady=(0, 10))
        chart_panel.columnconfigure(0, weight=1)
        chart_panel.rowconfigure(1, weight=1)
        chart_header = tk.Frame(chart_panel, bg=self.colors["panel"])
        chart_header.grid(row=0, column=0, sticky="ew", padx=14, pady=(11, 4))
        chart_header.columnconfigure(0, weight=1)
        tk.Label(chart_header, text="PRICE ACTION · LOCAL CANDLES", bg=self.colors["panel"], fg=self.colors["muted"],
                 font=("Sans", 8, "bold"), anchor="w").grid(row=0, column=0, sticky="w")
        self.market_chart_title = tk.Label(chart_header, text="Select a symbol", bg=self.colors["panel"],
                                           fg=self.colors["text"], font=("Sans", 12, "bold"), anchor="w")
        self.market_chart_title.grid(row=1, column=0, sticky="w", pady=(3, 0))
        self.market_chart_move = tk.Label(chart_header, text="—", bg=self.colors["panel"],
                                          fg=self.colors["muted"], font=("Sans", 10, "bold"), anchor="e")
        self.market_chart_move.grid(row=0, column=1, rowspan=2, sticky="e", padx=(10, 0))
        chart_tools = tk.Frame(chart_header, bg=self.colors["panel"])
        chart_tools.grid(row=2, column=0, columnspan=2, sticky="w", pady=(6, 0))
        for label, variable in (("MA 20 / 50", self.chart_sma_var), ("Volume", self.chart_volume_var),
                                ("Trade levels", self.chart_levels_var)):
            tk.Checkbutton(chart_tools, text=label, variable=variable, command=self._draw_market_chart,
                           bg=self.colors["panel"], fg=self.colors["muted"], selectcolor=self.colors["panel_2"],
                           activebackground=self.colors["panel"], activeforeground=self.colors["text"],
                           font=("Sans", 8, "bold"), padx=4).pack(side="left", padx=(0, 6))
        self._button(chart_tools, "Compare", self._open_symbol_comparison).pack(side="left", padx=(8, 0))
        tk.Label(chart_tools, text="Range", bg=self.colors["panel"], fg=self.colors["muted"],
                 font=("Sans", 8, "bold")).pack(side="left", padx=(10, 4))
        chart_range = ttk.Combobox(chart_tools, textvariable=self.chart_window_var, values=("20", "40", "80", "120"),
                                   state="readonly", width=5)
        chart_range.pack(side="left")
        chart_range.bind("<<ComboboxSelected>>", lambda _event: self._chart_window_selected())
        self.market_chart_data_quality = tk.Label(
            chart_header, text="DATA · refresh to inspect feed quality", bg=self.colors["panel"],
            fg=self.colors["muted"], font=("Sans", 8, "bold"), anchor="w")
        self.market_chart_data_quality.grid(row=3, column=0, columnspan=2, sticky="ew", pady=(4, 0))
        self.market_chart = tk.Canvas(chart_panel, height=270, bg=self.colors["panel_2"],
                                      highlightthickness=0, borderwidth=0)
        self.market_chart.grid(row=1, column=0, sticky="nsew", padx=12, pady=(0, 12))
        self.market_chart.bind("<Configure>", lambda _event: self._draw_market_chart(), add="+")
        self.market_chart.bind("<Motion>", self._market_chart_hover, add="+")
        self.market_chart.bind("<Leave>", lambda _event: self.market_chart.delete("hover"), add="+")

        decision_panel = self._panel(right)
        self.decision_panel = decision_panel
        decision_panel.grid(row=1, column=0, sticky="nsew", padx=(0, 6), pady=(0, 10))
        decision_panel.columnconfigure(0, weight=1)
        decision_panel.rowconfigure(1, weight=1)
        self._section_header(decision_panel, "STRATEGY MODEL", "Decision Brief", "Sizing preview",
                             self._open_sizing_preview, compact=True)
        self.decision_text = tk.Text(decision_panel, height=7, bg=self.colors["panel_2"], fg=self.colors["text"],
                                     insertbackground=self.colors["text"], relief="flat", padx=14, pady=12,
                                     font=("Monospace", 10), wrap="word")
        self.decision_text.grid(row=1, column=0, sticky="nsew", padx=(14, 0), pady=(0, 12))
        decision_scrollbar = ttk.Scrollbar(decision_panel, orient="vertical", command=self.decision_text.yview,
                                           style="Vertical.TScrollbar")
        self.decision_text.configure(yscrollcommand=decision_scrollbar.set)
        decision_scrollbar.grid(row=1, column=1, sticky="ns", padx=(0, 10), pady=(0, 12))

        order_panel = self._panel(right)
        self.order_panel = order_panel
        order_panel.grid(row=1, column=1, sticky="nsew", padx=(6, 0), pady=(0, 10))
        order_panel.columnconfigure(0, weight=1)
        order_panel.rowconfigure(1, weight=1)
        self.paper_trade_button = self._section_header(order_panel, "EXECUTION QUEUE", "Order Plan", None,
                                                       None, compact=True)
        self.plan_text = tk.Text(order_panel, height=7, bg=self.colors["panel_2"], fg=self.colors["text"],
                                 insertbackground=self.colors["text"], relief="flat", padx=14, pady=12,
                                 font=("Monospace", 10), wrap="word")
        self.plan_text.grid(row=1, column=0, sticky="nsew", padx=(14, 0), pady=(0, 12))
        plan_scrollbar = ttk.Scrollbar(order_panel, orient="vertical", command=self.plan_text.yview,
                                       style="Vertical.TScrollbar")
        self.plan_text.configure(yscrollcommand=plan_scrollbar.set)
        plan_scrollbar.grid(row=1, column=1, sticky="ns", padx=(0, 10), pady=(0, 12))
        self._button(order_panel, "Open risk & plan review", self._open_risk_planning_lab,
                     tooltip="Review risk, compare plans, and inspect hypothetical changes without editing the queue").grid(
                         row=2, column=0, columnspan=2, sticky="ew", padx=14, pady=(0, 14))

        broker_panel = self._panel(right)
        self.broker_panel = broker_panel
        broker_panel.grid(row=2, column=0, sticky="nsew", pady=(0, 18))
        broker_panel.columnconfigure(0, weight=1)
        broker_panel.columnconfigure(1, weight=1)
        broker_panel.rowconfigure(3, weight=1)
        self._section_header(broker_panel, "BROKER DESK", "Connection Diagnostics", "Portfolio",
                             lambda: self._show_tab("Portfolio"), compact=True)
        broker_actions = tk.Frame(broker_panel, bg=self.colors["panel"])
        broker_actions.grid(row=1, column=0, columnspan=2, sticky="ew", padx=18, pady=(0, 12))
        self.webull_check_button = self._button(
            broker_actions, "Check Webull account", lambda: self._run_action("Checking Webull", self.webull_check),
            accent="teal", tooltip="Refresh account status and buying power")
        self.webull_check_button.pack(side="left")
        self.busy_controls.append(self.webull_check_button)
        broker_actions.grid_remove()
        broker_summary = tk.Frame(broker_panel, bg=self.colors["panel"])
        broker_summary.grid(row=2, column=0, columnspan=2, sticky="ew", padx=12, pady=(0, 12))
        broker_summary.columnconfigure((0, 1, 2, 3, 4), weight=1)
        self.broker_summary_labels = {}
        for idx, title in enumerate(("Account", "API Check", "Region", "Live Gate", "Preview Gate")):
            self.broker_summary_labels[title] = self._mini_stat(broker_summary, idx, title)
        self.broker_readiness_text = tk.Text(broker_panel, height=13, bg=self.colors["panel_2"], fg=self.colors["text"],
                                             insertbackground=self.colors["text"], relief="flat", padx=14, pady=12,
                                             font=("Monospace", 10), wrap="word")
        self.broker_readiness_text.grid(row=3, column=0, sticky="nsew", padx=18, pady=(0, 18))
        self.broker_text = tk.Text(broker_panel, height=13, bg=self.colors["panel_2"], fg=self.colors["broker_text"],
                                   insertbackground=self.colors["text"], relief="flat", padx=14, pady=12,
                                   font=("Monospace", 10), wrap="word")
        self.broker_text.grid(row=3, column=1, sticky="nsew", padx=(0, 18), pady=(0, 18))

        journal_panel = self._panel(right)
        self.journal_panel = journal_panel
        journal_panel.grid(row=3, column=0, sticky="nsew")
        journal_panel.columnconfigure(0, weight=1)
        journal_panel.columnconfigure(1, weight=2)
        journal_panel.rowconfigure(2, weight=1)
        self._section_header(journal_panel, "TRADE LOG", "Fills And Guardrails", None, None, compact=True)
        audit_summary = tk.Frame(journal_panel, bg=self.colors["panel"])
        audit_summary.grid(row=1, column=0, columnspan=2, sticky="ew", padx=12, pady=(0, 12))
        audit_summary.columnconfigure((0, 1, 2, 3), weight=1)
        self.audit_summary_labels = {}
        for idx, title in enumerate(("Guardrails", "Events", "Live", "Rejected")):
            self.audit_summary_labels[title] = self._mini_stat(audit_summary, idx, title)
        self._button(audit_summary, "Filter journal", self._open_journal_filter).grid(
            row=0, column=4, sticky="e", padx=(8, 0), pady=4)
        self.audit_integrity_text = tk.Text(journal_panel, height=8, bg=self.colors["panel_2"], fg=self.colors["text"],
                                            insertbackground=self.colors["text"], relief="flat", padx=14, pady=12,
                                            font=("Monospace", 10), wrap="word")
        self.audit_integrity_text.grid(row=2, column=0, sticky="nsew", padx=18, pady=(0, 18))
        self.journal_text = tk.Text(journal_panel, height=8, bg=self.colors["panel_2"], fg=self.colors["muted"],
                                    insertbackground=self.colors["text"], relief="flat", padx=14, pady=12,
                                    font=("Monospace", 10), wrap="word")
        self.journal_text.grid(row=2, column=1, sticky="nsew", padx=(0, 18), pady=(0, 18))

        self.status_bar = tk.Label(main, text="Ready", bg=self.colors["panel_3"], fg=self.colors["muted"],
                                   anchor="w", justify="left", padx=16, pady=9,
                                   highlightbackground=self.colors["line"], highlightthickness=1)
        self._fit_text(self.status_bar, min_size=8, max_size=10, padding=32, wrap=True)
        self.status_bar.grid(row=4, column=0, sticky="ew", padx=18, pady=(0, 6))
        self._refresh_webull_account_menu()
        self._sync_profile_save_state()
        self._sync_manual_controls()
        self._show_tab("Overview")

    def _panel(self, parent: tk.Widget) -> tk.Frame:
        return tk.Frame(parent, bg=self.colors["panel"], highlightbackground=self.colors["line"], highlightthickness=1)

    def _build_research_panel(self, parent: tk.Widget) -> None:
        panel = self._panel(parent)
        self.research_panel = panel
        panel.columnconfigure(0, weight=1)
        panel.rowconfigure(3, weight=1)
        self._section_header(panel, "LOCAL EVIDENCE", "Research Workbench",
                             "Refresh coverage", self.refresh_all)
        actions = tk.Frame(panel, bg=self.colors["panel"])
        actions.grid(row=1, column=0, sticky="ew", padx=16, pady=(0, 12))
        action_specs = (
            ("Coverage Explorer", self._open_scan_coverage),
            ("Multi-chart Board", self._open_chart_board),
            ("Provider Evidence", self._open_provider_comparison),
            ("Import CSV…", self._open_csv_import),
            ("Session Planner", self._open_session_planner),
            ("Data Issue Inbox", self._open_data_issue_inbox),
            ("Compare Groups", self._open_group_comparison),
            ("Export Snapshot", self._export_research_snapshot),
            ("Save Table Layout", self._save_scanner_table_preset),
            ("Load Table Layout", self._open_scanner_table_preset),
            ("Open Symbol Research", self._open_symbol_research_drawer),
        )
        for index, (label, callback) in enumerate(action_specs):
            button = self._button(actions, label, callback, accent="teal" if index in {0, 3, 7} else None)
            button.grid(row=index // 5, column=index % 5, sticky="ew", padx=4, pady=4)
            actions.columnconfigure(index % 5, weight=1)
        self.research_status_label = tk.Label(
            panel,
            text="Coverage and comparison use only locally loaded candle data. Provider evidence never triggers a second fetch.",
            bg=self.colors["panel"], fg=self.colors["muted"], anchor="w", justify="left", wraplength=1200,
        )
        self.research_status_label.grid(row=2, column=0, sticky="ew", padx=18, pady=(0, 8))
        table_box = tk.Frame(panel, bg=self.colors["panel_2"])
        table_box.grid(row=3, column=0, sticky="nsew", padx=16, pady=(0, 16))
        table_box.columnconfigure(0, weight=1)
        table_box.rowconfigure(1, weight=1)
        tk.Label(table_box, text="SCAN COVERAGE HISTORY · DOUBLE-CLICK A RUN FOR SYMBOL DETAIL",
                 bg=self.colors["panel_2"], fg=self.colors["teal"], font=("Sans", 9, "bold"), anchor="w").grid(
                     row=0, column=0, sticky="ew", padx=10, pady=(10, 6))
        columns = ("time", "provider", "source", "coverage", "returned", "requested")
        tree = ttk.Treeview(table_box, columns=columns, show="headings", height=12, selectmode="browse")
        self.research_coverage_tree = tree
        for key, title, width in (("time", "Recorded", 175), ("provider", "Provider", 100),
                                  ("source", "Source", 90), ("coverage", "Coverage", 100),
                                  ("returned", "Returned", 90), ("requested", "Requested", 90)):
            tree.heading(key, text=title)
            tree.column(key, width=width, anchor="w" if key in {"time", "provider", "source"} else "e")
        tree.grid(row=1, column=0, sticky="nsew", padx=10, pady=(0, 10))
        tree.bind("<Double-1>", lambda _event: self._open_selected_coverage_detail())
        self._render_scan_coverage()

    def _mini_stat(self, parent: tk.Widget, column: int, title: str) -> tk.Label:
        frame = tk.Frame(parent, bg=self.colors["panel_2"], highlightbackground=self.colors["line"], highlightthickness=1)
        frame.grid(row=0, column=column, sticky="ew", padx=6)
        tk.Label(
            frame,
            text=title,
            bg=self.colors["panel_2"],
            fg=self.colors["muted"],
            font=("Sans", 8, "bold"),
            anchor="center",
            justify="center",
        ).pack(fill="x", padx=10, pady=(8, 2))
        value = tk.Label(
            frame,
            text="-",
            bg=self.colors["panel_2"],
            fg=self.colors["text"],
            font=("Sans", 13, "bold"),
            anchor="center",
            justify="center",
        )
        self._fit_text(value, min_size=9, max_size=13, padding=24, wrap=True)
        value.pack(fill="x", padx=10, pady=(0, 8))
        return value

    def _show_tab(self, tab: str) -> None:
        self.active_tab = tab
        self.content_canvas.yview_moveto(0)
        self._set_nav_active(tab)
        overview_active = tab == "Overview"
        if overview_active:
            self.body.master.rowconfigure(1, weight=1)
            self.body.master.rowconfigure(3, weight=0)
            self.hero.grid_remove()
            self.metrics.grid_remove()
            self.market_masthead.grid(row=0, column=0, sticky="ew", padx=18, pady=(12, 8))
            self.controls.grid_remove()
            self.body.grid_configure(row=1, pady=(0, 16))
        else:
            self.body.master.rowconfigure(1, weight=0)
            self.body.master.rowconfigure(3, weight=1)
            self.market_masthead.grid_remove()
            self.hero.grid_remove()
            self.metrics.grid_remove()
            self.controls.grid_remove()
            self.body.grid_configure(row=3, pady=(16, 16))
        self.signals_panel.grid_remove()
        self.market_watchlist_panel.grid_remove()
        self.portfolio_panel.grid_remove()
        self.automation_panel.grid_remove()
        self.alerts_panel.grid_remove()
        self.market_chart_panel.grid_remove()
        self.universe_panel.grid_remove()
        self.setup_panel.grid_remove()
        self.strategy_tab_panel.grid_remove()
        self.execution_tab_panel.grid_remove()
        self.health_panel.grid_remove()
        self.research_panel.grid_remove()
        self.right_panel.grid_remove()
        for panel in (self.decision_panel, self.order_panel, self.broker_panel, self.journal_panel):
            panel.grid_remove()

        self.body.columnconfigure(0, weight=1)
        self.body.columnconfigure(1, weight=1)

        if overview_active:
            # Left rail is the radar; the broad right work area follows the
            # selected symbol through chart, model read, and order plan.
            radar_visible = self.overview_radar_visible_var.get()
            self.body.columnconfigure(0, weight=2 if radar_visible else 1, uniform="signal-desk")
            self.body.columnconfigure(1, weight=7 if radar_visible else 0, uniform="signal-desk")
            self.right_panel.rowconfigure(0, weight=3)
            self.right_panel.rowconfigure(1, weight=2)
            self.right_panel.columnconfigure(0, weight=2, uniform="desk-workbench")
            self.right_panel.columnconfigure(1, weight=1, uniform="desk-workbench")
            if radar_visible:
                self.market_watchlist_panel.grid(row=0, column=0, sticky="nsew", padx=(0, 10))
                self.right_panel.grid(row=0, column=1, sticky="nsew")
            else:
                self.right_panel.grid(row=0, column=0, columnspan=2, sticky="nsew")
            self.market_chart_panel.grid(row=0, column=0, rowspan=2, sticky="nsew", padx=(0, 10), pady=(0, 10))
            self.decision_panel.grid(row=0, column=1, sticky="nsew", pady=(0, 6))
            self.order_panel.grid(row=1, column=1, sticky="nsew", pady=(6, 10))
        elif tab == "Setup":
            self.body.columnconfigure(0, weight=1)
            self._sync_profile_form(self.config or self._load_config_safe())
            self._render_setup_status()
            self.setup_panel.grid(row=0, column=0, columnspan=2, sticky="nsew", padx=0)
        elif tab == "Universe":
            self.body.columnconfigure(0, weight=1)
            self.universe_panel.grid(row=0, column=0, columnspan=2, sticky="nsew", padx=0)
        elif tab == "Scanner":
            self.body.columnconfigure(0, weight=1)
            self.signals_panel.grid(row=0, column=0, columnspan=2, sticky="nsew", padx=0)
        elif tab == "Research":
            self.body.columnconfigure(0, weight=1)
            self._render_scan_coverage()
            self.research_panel.grid(row=0, column=0, columnspan=2, sticky="nsew", padx=0)
        elif tab == "Portfolio":
            self.body.columnconfigure(0, weight=1)
            self._render_portfolio_panel()
            self.portfolio_panel.grid(row=0, column=0, columnspan=2, sticky="nsew", padx=0)
        elif tab == "Automation":
            self.body.columnconfigure(0, weight=1)
            self._render_automation_panel()
            self.automation_panel.grid(row=0, column=0, columnspan=2, sticky="nsew", padx=0)
            self.body.master.rowconfigure(1, weight=1)
            self.body.master.rowconfigure(3, weight=0)
            self.body.grid_configure(row=1, pady=(0, 10))
            self.controls.grid(row=2, column=0, sticky="ew", padx=12, pady=(0, 14))
            self._set_automation_controls_compact(True)
        elif tab == "Alerts":
            self.body.columnconfigure(0, weight=1)
            self._render_alerts_panel()
            self.alerts_panel.grid(row=0, column=0, columnspan=2, sticky="nsew", padx=0)
        elif tab == "Strategy":
            self.body.columnconfigure(0, weight=1)
            self._render_strategy_tab()
            self.strategy_tab_panel.grid(row=0, column=0, columnspan=2, sticky="nsew", padx=0)
        elif tab == "Execution":
            self.body.columnconfigure(0, weight=1)
            self.controls.grid(row=2, column=0, sticky="ew", padx=24, pady=(0, 14))
            self._set_automation_controls_compact(False)
            self._render_execution_tab()
            self.execution_tab_panel.grid(row=0, column=0, columnspan=2, sticky="nsew", padx=0)
        elif tab == "Health":
            self.body.columnconfigure(0, weight=1)
            self._render_health_tab()
            self.health_panel.grid(row=0, column=0, columnspan=2, sticky="nsew", padx=0)
        else:
            for row in range(4):
                self.right_panel.rowconfigure(row, weight=1 if row == 0 else 0)
            panel_by_tab = {
                "Broker": self.broker_panel,
                "Audit": self.journal_panel,
            }
            panel = panel_by_tab.get(tab, self.decision_panel)
            if tab == "Broker":
                self._render_broker_summary(force=True)
            elif tab == "Audit":
                self._load_journal()
            self.right_panel.grid(row=0, column=0, columnspan=2, sticky="nsew")
            panel.grid(row=0, column=0, sticky="nsew", pady=0)

        self._responsive_layout()
        self.status_bar.configure(text=f"{tab} workspace active.")
        self._save_last_workspace_state()

    def _open_operations_review(self) -> None:
        """Open review tools; broker data is read-only and local-only features say so."""
        window = tk.Toplevel(self.root)
        window.title("Review & Operations")
        window.geometry("900x650")
        window.minsize(680, 480)
        window.transient(self.root)
        window.configure(bg=self.colors["panel"])
        window.rowconfigure(1, weight=1)
        window.columnconfigure(0, weight=1)
        tk.Label(window, text="REVIEW & OPERATIONS", bg=self.colors["panel"], fg=self.colors["teal"],
                 font=("Sans", 13, "bold"), anchor="w").grid(row=0, column=0, sticky="ew", padx=16, pady=12)
        tabs = ttk.Notebook(window)
        tabs.grid(row=1, column=0, sticky="nsew", padx=12, pady=(0, 12))
        bg = self.colors["panel"]
        fg = self.colors["text"]
        muted = self.colors["muted"]

        def page(title: str):
            frame = tk.Frame(tabs, bg=bg)
            tabs.add(frame, text=title)
            frame.columnconfigure(0, weight=1)
            frame.rowconfigure(1, weight=1)
            return frame

        def text_area(frame, initial=""):
            box = tk.Text(frame, bg=self.colors["panel_2"], fg=fg, insertbackground=fg, wrap="word", relief="flat")
            box.grid(row=1, column=0, sticky="nsew", padx=12, pady=8)
            box.insert("1.0", initial)
            box.configure(state="disabled")
            return box

        def set_text(box, value):
            box.configure(state="normal")
            box.delete("1.0", "end")
            box.insert("1.0", value)
            box.configure(state="disabled")

        # 1 and 6: lifecycle timeline and an evidence-limited UTC daily brief.
        activity = page("Activity")
        activity.rowconfigure(1, weight=1)
        activity_box = text_area(activity)
        def render_activity():
            timeline = order_timeline(self.execution_events)
            lines = ["DAILY ACTIVITY BRIEF", *daily_activity_brief(self.execution_events), "", "ORDER LIFECYCLE TIMELINE"]
            lines.extend(f"{row['time'] or 'time unknown'} | {row['mode']} | {row['symbol']} | {row['status']} | {row['detail']}"
                         for row in reversed(timeline))
            set_text(activity_box, "\n".join(lines))
        tk.Button(activity, text="Refresh local activity", command=render_activity).grid(row=0, column=0, sticky="w", padx=12, pady=(10, 0))
        render_activity()

        # 2 and 3: broker order/position management with explicit per-action confirmation.
        orders = page("Open Orders & Reconcile")
        orders.rowconfigure(1, weight=1)
        orders.columnconfigure(0, weight=1)
        order_frame = ttk.LabelFrame(orders, text="Open orders")
        order_frame.grid(row=1, column=0, sticky="nsew", padx=10, pady=6)
        order_frame.rowconfigure(0, weight=1)
        order_frame.columnconfigure(0, weight=1)
        order_tree = ttk.Treeview(order_frame, columns=("symbol", "side", "quantity", "type", "price", "status", "client_id"), show="headings", height=7)
        for key, title, width in (("symbol", "Symbol", 90), ("side", "Side", 70), ("quantity", "Qty", 70), ("type", "Type", 90), ("price", "Limit", 80), ("status", "Status", 110), ("client_id", "Client order ID", 210)):
            order_tree.heading(key, text=title); order_tree.column(key, width=width, anchor="w")
        order_tree.grid(row=0, column=0, sticky="nsew")
        pos_frame = ttk.LabelFrame(orders, text="Positions")
        pos_frame.grid(row=2, column=0, sticky="nsew", padx=10, pady=6)
        pos_frame.rowconfigure(0, weight=1); pos_frame.columnconfigure(0, weight=1)
        position_tree = ttk.Treeview(pos_frame, columns=("symbol", "quantity", "instrument", "side", "market_value"), show="headings", height=5)
        for key, title, width in (("symbol", "Symbol", 100), ("quantity", "Qty", 80), ("instrument", "Instrument", 100), ("side", "Side", 80), ("market_value", "Market value", 120)):
            position_tree.heading(key, text=title); position_tree.column(key, width=width, anchor="w")
        position_tree.grid(row=0, column=0, sticky="nsew")
        orders.rowconfigure(1, weight=2); orders.rowconfigure(2, weight=1)
        order_rows = {}; position_rows = {}
        order_status = tk.Label(orders, text="Refresh to request a read-only broker snapshot.", bg=bg, fg=muted, anchor="w", justify="left", wraplength=780)
        order_status.grid(row=4, column=0, sticky="ew", padx=12, pady=4)
        def refresh_orders():
            order_status.configure(text="Loading read-only broker snapshot…")
            mode_context = self._lane_mode_label()
            def worker():
                try:
                    config = self._execution_config(self.config or self._load_config_safe())
                    snapshot = WebullOpenApiBroker(config).account_snapshot()
                    account_context = mask_identifier(config.webull_account_id)
                    snapshot_time = datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S %Z")
                    def done():
                        raw = snapshot.get("open_orders")
                        payload = raw.get("body") if isinstance(raw, dict) else raw
                        if isinstance(payload, dict):
                            payload = payload.get("orders") or payload.get("items") or payload.get("data") or [payload]
                        broker_orders = payload if isinstance(payload, list) else []
                        for item in order_tree.get_children(): order_tree.delete(item)
                        order_rows.clear()
                        for index, row in enumerate(broker_orders):
                            if not isinstance(row, dict): continue
                            client_id = row.get("client_order_id") or row.get("clientOrderId") or ""
                            symbol = row.get("symbol") or row.get("ticker") or "?"
                            quantity = row.get("quantity", row.get("qty", "?"))
                            price = row.get("limit_price", row.get("limitPrice", ""))
                            values = (symbol, row.get("side", "?"), quantity, row.get("order_type", row.get("orderType", "?")), price,
                                      row.get("status", "?"), client_id)
                            iid = order_tree.insert("", "end", iid=f"open-{index}", values=values)
                            order_rows[iid] = row
                        positions_raw = snapshot.get("positions")
                        positions_payload = positions_raw.get("body") if isinstance(positions_raw, dict) else positions_raw
                        if isinstance(positions_payload, dict):
                            positions_payload = positions_payload.get("positions") or positions_payload.get("items") or positions_payload.get("data") or [positions_payload]
                        broker_positions = positions_payload if isinstance(positions_payload, list) else []
                        for item in position_tree.get_children(): position_tree.delete(item)
                        position_rows.clear()
                        for index, row in enumerate(broker_positions):
                            if not isinstance(row, dict): continue
                            symbol = row.get("symbol") or row.get("ticker") or "?"
                            quantity = row.get("quantity", row.get("qty", "?"))
                            instrument = row.get("instrument_type", row.get("instrumentType", "EQUITY"))
                            side = str(row.get("side") or row.get("position_side") or row.get("direction") or "").upper()
                            market_value = row.get("market_value", row.get("marketValue", ""))
                            iid = position_tree.insert("", "end", iid=f"position-{index}", values=(symbol, quantity, instrument, side or "unspecified", market_value))
                            position_rows[iid] = row
                        from .broker_reconciliation import reconcile_broker_state
                        report = reconcile_broker_state(self.execution_events, broker_orders,
                                                        snapshot.get("positions") if isinstance(snapshot.get("positions"), list) else ())
                        order_status.configure(text=f"Account {account_context} · {snapshot_time} · {report.open_order_count} open orders · {len(broker_positions)} positions · reconciliation {'clear' if report.ok else 'review required'}. Snapshot may lag; verify at Webull before acting.")
                    self.root.after(0, done)
                except Exception as exc:
                    error_text = f"Broker snapshot unavailable: {type(exc).__name__}: {exc}\nNo order state was changed."
                    self.root.after(0, lambda message=error_text: order_status.configure(text=message))
            threading.Thread(target=worker, daemon=True, name="timmy-open-orders-review").start()
        def selected_order():
            chosen = order_tree.selection()
            return order_rows.get(chosen[0]) if chosen else None
        def mutate_order(action):
            row = selected_order()
            if not row:
                messagebox.showinfo("Select an order", "Select a fresh open order first.", parent=window); return
            client_id = row.get("client_order_id") or row.get("clientOrderId")
            if not client_id:
                messagebox.showerror("Order ID unavailable", "This row has no client order ID; refresh and verify it in Webull.", parent=window); return
            config = self._execution_config(self._load_config_safe())
            if action == "cancel":
                prompt = f"Cancel {row.get('symbol', '?')} {row.get('side', '?')} order {client_id}? This sends a cancel request to Webull."
                changes = None
            else:
                if str(row.get("order_type", row.get("orderType", ""))).upper() != "LIMIT":
                    messagebox.showinfo("Unsupported order", "Timmy currently replaces limit orders only.", parent=window); return
                old_qty = float(row.get("quantity", row.get("qty", 0)) or 0)
                old_price = float(row.get("limit_price", row.get("limitPrice", 0)) or 0)
                qty = simpledialog.askfloat("Replace limit order", f"New quantity (current {old_qty:g}; cannot increase):", minvalue=0.00000001, maxvalue=old_qty, parent=window)
                if qty is None: return
                price = simpledialog.askfloat("Replace limit order", f"New limit price (current {old_price:g}):", minvalue=0.00000001, parent=window)
                if price is None: return
                price = round(price, 2)
                if str(row.get("side", "")).upper() in {"BUY", "B"} and qty * price > old_qty * old_price + 0.000001:
                    messagebox.showerror("Exposure increase blocked", "Timmy will not increase the displayed notional of a BUY order through replacement.", parent=window); return
                changes = {"quantity": str(qty), "limit_price": f"{price:.2f}"}
                prompt = f"Replace {row.get('symbol', '?')} limit order {client_id} with quantity {qty:g} at ${price:.2f}?"
            if not messagebox.askyesno("Confirm Webull order change", prompt, parent=window): return
            try:
                self._ensure_execution_journal_writable()
                self._append_execution_event({"mode":"live", "event_type":"order-action-intent", "action":action, "status":"pending-action", "client_order_id":str(client_id), "symbol":row.get("symbol"), "recorded_at":datetime.now().isoformat()})
            except Exception as exc:
                messagebox.showerror("Journal unavailable", f"No request sent. Timmy could not record the action: {exc}", parent=window); return
            order_status.configure(text=f"Sending confirmed {action} request… Do not repeat while the outcome is unknown.")
            def worker():
                try:
                    broker = WebullOpenApiBroker(config)
                    result = broker.cancel_order(str(client_id)) if action == "cancel" else broker.replace_order(str(client_id), changes)
                    status = self._broker_event_status(result)
                    event_status = "accepted" if status in {"accepted", "submitted"} else status
                    self._append_execution_event({"mode":"live", "event_type":"order-action-result", "action":action, "status":event_status, "client_order_id":str(client_id), "symbol":row.get("symbol"), "broker_body":result.get("body"), "recorded_at":datetime.now().isoformat()})
                    message = f"{action.title()} result: {event_status}. {json.dumps(result, sort_keys=True)}"
                except Exception as exc:
                    message = f"{action.title()} outcome unknown: {type(exc).__name__}: {exc}. Verify order detail at Webull before retrying."
                    try: self._append_execution_event({"mode":"live", "event_type":"order-action-result", "action":action, "status":"unknown", "client_order_id":str(client_id), "symbol":row.get("symbol"), "recorded_at":datetime.now().isoformat()})
                    except Exception: self._hold_live_automation("Order action outcome could not be journaled; reconcile at Webull")
                self.root.after(0, lambda: (order_status.configure(text=message), refresh_orders()))
            threading.Thread(target=worker, daemon=True, name="timmy-webull-order-action").start()
        def reduce_position():
            chosen = position_tree.selection()
            position = position_rows.get(chosen[0]) if chosen else None
            if not position:
                messagebox.showinfo("Select a position", "Select a position from the latest snapshot.", parent=window); return
            instrument = str(position.get("instrument_type", position.get("instrumentType", "EQUITY"))).upper()
            side = str(position.get("side") or position.get("position_side") or position.get("direction") or "").upper()
            symbol = str(position.get("symbol") or position.get("ticker") or "").upper()
            try: held = abs(float(position.get("quantity", position.get("qty", 0))))
            except (TypeError, ValueError): held = 0
            if instrument != "EQUITY" or side not in {"LONG", "BUY"} or not symbol or held <= 0:
                messagebox.showinfo("Position not eligible", "Reduce/close is enabled only for explicitly identified long equity positions. This snapshot does not establish that safely.", parent=window); return
            qty = simpledialog.askfloat("Reduce position", f"Quantity to sell (held {held:g}; partial reductions allowed):", minvalue=0.00000001, maxvalue=held, parent=window)
            if qty is None: return
            price = simpledialog.askfloat("Sell limit", "Limit price per share:", minvalue=0.00000001, parent=window)
            if price is None: return
            from .models import OrderPlan
            plan = OrderPlan(symbol=symbol, side="SELL", quantity=qty, order_type="LIMIT", limit_price=price, stop_price=0, target_price=0, notional=qty*price, reason="User-confirmed position reduction")
            config = self._execution_config(self._load_config_safe())
            client_id = __import__("uuid").uuid4().hex[:32]
            order = WebullOpenApiBroker(config)
            payload = order.new_order_payload(plan, client_order_id=client_id)
            order_status.configure(text="Getting an order estimate for the requested reduction…")
            def preview_worker():
                try: preview = order.preview_order_payloads([payload])
                except Exception as exc:
                    error_message = f"Preview unavailable; no order sent: {type(exc).__name__}: {exc}"
                    self.root.after(0, lambda message=error_message: order_status.configure(text=message)); return
                if not preview.get("preview_ok") or not preview.get("preview_fingerprint"):
                    self.root.after(0, lambda: order_status.configure(text="Exact preview failed; no position-reduction order was sent.")); return
                def confirm():
                    if not messagebox.askyesno("Confirm position reduction", f"Sell {qty:g} {symbol} shares with a limit of ${price:.2f}?\n\nWebull estimate: {json.dumps(preview.get('body'), sort_keys=True)[:1200]}\n\nThis places a live order.", parent=window):
                        order_status.configure(text="Position reduction cancelled; no order sent."); return
                    try:
                        enforce_live_guards(config)
                        self._ensure_execution_journal_writable()
                        self._append_execution_event({"mode":"live", "event_type":"live-order-intent", "status":"pending-submit", "client_order_id":client_id, "symbol":symbol, "side":"SELL", "quantity":qty, "order_type":"LIMIT", "limit_price":price, "recorded_at":datetime.now().isoformat()})
                    except Exception as exc:
                        messagebox.showerror("Live order blocked", f"No request sent: {exc}", parent=window); return
                    def submit_worker():
                        try:
                            result = order.submit_previewed_order_payloads([payload], preview["preview_fingerprint"])
                        except Exception as exc:
                            result = {"status": "unknown", "error": type(exc).__name__}
                        result_status = self._broker_event_status(result)
                        try: self._append_execution_event({"mode":"live", "event_type":"sell-order", "status":result_status, "client_order_id":client_id, "symbol":symbol, "quantity":qty, "sell_price":price, "broker_body":result.get("body"), "recorded_at":datetime.now().isoformat()})
                        except Exception as exc: self._hold_live_automation(f"Position-reduction response journal failed: {exc}")
                        self.root.after(0, lambda: (order_status.configure(text=f"Position reduction {result_status}; refresh to reconcile at Webull."), refresh_orders()))
                    threading.Thread(target=submit_worker, daemon=True, name="timmy-webull-position-reduction").start()
                self.root.after(0, confirm)
            threading.Thread(target=preview_worker, daemon=True, name="timmy-webull-position-preview").start()
        def open_guarded_order_entry():
            dialog = tk.Toplevel(window); dialog.title("New Guarded Webull Order · Auto Trade Assistant"); dialog.transient(window)
            dialog.geometry("820x760"); dialog.minsize(700, 620); dialog.configure(bg=bg)
            dialog.columnconfigure(1, weight=1); dialog.rowconfigure(11, weight=1)
            tk.Label(dialog, text="AUTO TRADE ASSISTANT · GUARDED LIVE ORDER", bg=bg, fg=self.colors["teal"], font=("Sans", 12, "bold"), anchor="w").grid(row=0, column=0, columnspan=2, sticky="ew", padx=14, pady=(12, 6))
            tk.Label(dialog, text="Supported draft types: US equity/ETF, options strategy, futures, and event contracts. Crypto submission stays disabled because Webull's Trading API has no exact-order preview endpoint for crypto.", bg=bg, fg=muted, wraplength=760, justify="left", anchor="w").grid(row=1, column=0, columnspan=2, sticky="ew", padx=14, pady=4)
            config_at_open = self._execution_config(self._load_config_safe())
            tk.Label(dialog, text=f"Account: {mask_identifier(config_at_open.webull_account_id)} · Risk cap: ${config_at_open.max_order_notional_usd:,.2f} preview estimated cost · One order per confirmation", bg=bg, fg=muted, anchor="w").grid(row=2, column=0, columnspan=2, sticky="ew", padx=14, pady=4)
            product_var = tk.StringVar(value="EQUITY")
            side_var = tk.StringVar(value="BUY")
            tif_var = tk.StringVar(value="DAY")
            strategy_var = tk.StringVar(value="SINGLE")
            symbol_var = tk.StringVar()
            quantity_var = tk.StringVar(value="1")
            price_var = tk.StringVar()
            expire_var = tk.StringVar()
            def field(row, label, widget):
                tk.Label(dialog, text=label, bg=bg, fg=fg, anchor="w").grid(row=row, column=0, sticky="w", padx=(14, 8), pady=3)
                widget.grid(row=row, column=1, sticky="ew", padx=(0, 14), pady=3)
            field(3, "Product", ttk.Combobox(dialog, textvariable=product_var, values=("EQUITY", "OPTION", "FUTURES", "EVENT"), state="readonly"))
            field(4, "Discovered symbol", ttk.Entry(dialog, textvariable=symbol_var))
            field(5, "Side", ttk.Combobox(dialog, textvariable=side_var, values=("BUY", "SELL"), state="readonly"))
            field(6, "Quantity / contracts", ttk.Entry(dialog, textvariable=quantity_var))
            field(7, "Limit price", ttk.Entry(dialog, textvariable=price_var))
            field(8, "Time in force", ttk.Combobox(dialog, textvariable=tif_var, values=("DAY", "GTC", "IOC", "GTD", "FOK"), state="readonly"))
            expire_label = tk.Label(dialog, text="GTD expiration (YYYY-MM-DD)", bg=bg, fg=fg, anchor="w")
            expire_entry = ttk.Entry(dialog, textvariable=expire_var)
            expire_label.grid(row=9, column=0, sticky="w", padx=(14, 8), pady=3)
            expire_entry.grid(row=9, column=1, sticky="ew", padx=(0, 14), pady=3)
            expire_label.grid_remove(); expire_entry.grid_remove()
            option_frame = ttk.LabelFrame(dialog, text="Options strategy legs (JSON)")
            option_frame.grid(row=10, column=0, columnspan=2, sticky="ew", padx=14, pady=6); option_frame.columnconfigure(0, weight=1)
            strategy_row = ttk.Frame(option_frame); strategy_row.grid(row=0, column=0, sticky="ew", padx=8, pady=5)
            ttk.Label(strategy_row, text="Strategy").pack(side="left")
            ttk.Combobox(strategy_row, textvariable=strategy_var, values=("SINGLE", "COVERED_STOCK", "VERTICAL", "STRADDLE", "STRANGLE", "CALENDAR", "BUTTERFLY", "CONDOR", "IRON_BUTTERFLY", "IRON_CONDOR", "COLLAR_WITH_STOCK", "DIAGONAL"), state="readonly", width=24).pack(side="left", padx=8)
            option_legs = tk.Text(option_frame, height=6, wrap="word", bg=self.colors["panel_2"], fg=fg, insertbackground=fg)
            option_legs.insert("1.0", '[{"side":"BUY","quantity":"1","symbol":"AAPL","strike_price":"200","option_expire_date":"2027-01-15","instrument_type":"OPTION","option_type":"CALL","market":"US"}]')
            option_legs.grid(row=1, column=0, sticky="ew", padx=8, pady=5)
            state = {"broker": None, "payload": None, "fingerprint": None, "estimate": None, "config": None, "client_order_id": None}
            order_result = tk.Text(dialog, height=8, wrap="word", bg=self.colors["panel_2"], fg=fg, insertbackground=fg)
            order_result.grid(row=11, column=0, columnspan=2, sticky="nsew", padx=14, pady=6)
            tk.Label(dialog, text="Preview is non-mutating. Submit stays blocked unless the same order passes Webull preview, Timmy's product/risk guards, and a second confirmation. Crypto remains available in market data and research, but has no supported order-entry form because Webull does not provide its required exact preview.", bg=bg, fg=muted, wraplength=760, justify="left", anchor="w").grid(row=12, column=0, columnspan=2, sticky="ew", padx=14, pady=4)
            def set_order_text(value):
                order_result.configure(state="normal"); order_result.delete("1.0", "end"); order_result.insert("1.0", value); order_result.configure(state="disabled")
            def update_product(*_args):
                kind = product_var.get().upper()
                side_choices = {"EQUITY": ("BUY", "SELL"), "OPTION": ("BUY", "SELL", "SHORT"), "FUTURES": ("BUY", "SELL"), "EVENT": ("BUY", "SELL")}[kind]
                side_menu.configure(values=side_choices)
                if side_var.get() not in side_choices: side_var.set(side_choices[0])
                tif_values = ("DAY", "GTC") if kind in {"EQUITY", "OPTION", "FUTURES"} else ("DAY", "GTC", "IOC", "GTD", "FOK")
                tif_menu.configure(values=tif_values)
                if tif_var.get() not in tif_values: tif_var.set("DAY")
                if kind == "OPTION": option_frame.grid()
                else: option_frame.grid_remove()
                if kind == "EVENT" and tif_var.get().upper() == "GTD":
                    expire_label.grid(); expire_entry.grid()
                else:
                    expire_label.grid_remove(); expire_entry.grid_remove()
                preview_button.configure(state="normal")
                submit_button.configure(state="disabled")
            side_menu = dialog.grid_slaves(row=5, column=1)[0]
            tif_menu = dialog.grid_slaves(row=8, column=1)[0]
            def build_payload(client_order_id):
                kind = product_var.get().upper()
                symbol = symbol_var.get().strip().upper()
                try: quantity = float(quantity_var.get())
                except ValueError as exc: raise ValueError("Enter a positive quantity.") from exc
                try: limit_price = float(price_var.get())
                except ValueError as exc: raise ValueError("Enter a positive limit price.") from exc
                if not symbol or quantity <= 0 or limit_price <= 0:
                    raise ValueError("A symbol, positive quantity, and positive limit price are required.")
                order = {"client_order_id": client_order_id, "combo_type": "NORMAL", "symbol": symbol,
                         "instrument_type": kind, "market": "US", "order_type": "LIMIT",
                         "limit_price": f"{limit_price:.2f}", "quantity": f"{quantity:.8f}".rstrip("0").rstrip("."),
                         "side": side_var.get().upper(), "time_in_force": tif_var.get().upper(), "entrust_type": "QTY"}
                if kind == "EQUITY": order["support_trading_session"] = "CORE"
                if kind == "OPTION":
                    try: legs = json.loads(option_legs.get("1.0", "end-1c"))
                    except json.JSONDecodeError as exc: raise ValueError(f"Option legs must be valid JSON: {exc}") from exc
                    order["option_strategy"] = strategy_var.get().upper(); order["legs"] = legs
                if kind == "EVENT": order["event_trade_mode"] = "TRADE_IN_CONTRACT"
                if kind == "EVENT" and tif_var.get().upper() == "GTD": order["expire_date"] = expire_var.get().strip()
                return order
            def find_product_instruments():
                kind = product_var.get().upper()
                open_instrument_discovery(kind, symbol_var.get().strip())
            def preview_manual_order():
                if product_var.get().upper() == "CRYPTO": return
                import uuid
                client_id = uuid.uuid4().hex[:32]
                try: payload = build_payload(client_id)
                except Exception as exc: messagebox.showerror("Order draft invalid", str(exc), parent=dialog); return
                config = self._execution_config(self._load_config_safe())
                preview_button.configure(state="disabled"); submit_button.configure(state="disabled")
                set_order_text("Requesting an exact Webull preview. No order is being placed.")
                broker = WebullOpenApiBroker(config)
                state.update({"broker": None, "payload": None, "fingerprint": None, "estimate": None,
                              "config": config, "client_order_id": client_id})
                def worker():
                    try:
                        response = broker.preview_order_payloads([payload])
                        body = response.get("body")
                        def find_cost(value):
                            if isinstance(value, dict):
                                for key, item in value.items():
                                    if str(key).lower() in {"estimated_cost", "estimatedcost", "estimated_margin", "estimatedmargin"}:
                                        try: return float(item)
                                        except (TypeError, ValueError): pass
                                for item in value.values():
                                    found = find_cost(item)
                                    if found is not None: return found
                            if isinstance(value, list):
                                for item in value:
                                    found = find_cost(item)
                                    if found is not None: return found
                            return None
                        estimate = find_cost(body)
                        okay = bool(response.get("preview_ok")) and estimate is not None and estimate >= 0 and estimate <= config.max_order_notional_usd
                        if okay:
                            state.update({"broker": broker, "payload": payload, "fingerprint": response.get("preview_fingerprint"), "estimate": estimate})
                        info = {"exact_order": payload, "preview_response": redact(response),
                                "estimated_cost": estimate, "timmy_cost_cap": config.max_order_notional_usd,
                                "submit_ready": okay}
                        output = json.dumps(info, indent=2, sort_keys=True, default=str)
                        if not okay: output += "\n\nSUBMISSION BLOCKED: preview failed, estimated cost is missing, or Timmy's configured risk cap was exceeded."
                        def done():
                            set_order_text(output)
                            preview_button.configure(state="normal")
                            submit_button.configure(state="normal" if okay else "disabled")
                        self.root.after(0, done)
                    except Exception as exc:
                        error_message = f"Preview failed; no order placed: {type(exc).__name__}: {exc}"
                        self.root.after(0, lambda message=error_message: (set_order_text(message), preview_button.configure(state="normal"), submit_button.configure(state="disabled")))
                threading.Thread(target=worker, daemon=True, name="timmy-guarded-order-preview").start()
            def submit_manual_order():
                if not state.get("broker") or not state.get("fingerprint") or not state.get("payload"):
                    messagebox.showerror("Preview required", "Preview this exact order successfully before submitting.", parent=dialog); return
                if self.execution_target_var.get() != "Live" or self.execution_mode_var.get() != "User":
                    messagebox.showerror("Manual Live mode required", "Select Live as the execution target and User as the execution mode before a manual Webull order.", parent=dialog); return
                if self._action_in_progress or self._refresh_in_progress or self._automation_cycle_in_progress or getattr(self, "_manual_webull_order_in_progress", False):
                    messagebox.showerror("Timmy is busy", "Wait for the current action or automation cycle to finish before submitting a manual order.", parent=dialog); return
                live_block = self._live_auto_block_reason()
                if live_block:
                    messagebox.showerror("Live orders held", live_block, parent=dialog); return
                try: current_payload = build_payload(state["client_order_id"])
                except Exception as exc: messagebox.showerror("Order draft invalid", str(exc), parent=dialog); return
                fingerprint = state["broker"].order_payload_fingerprint(state["config"].webull_account_id, [current_payload])
                if current_payload != state["payload"] or fingerprint != state["fingerprint"]:
                    state.update({"broker": None, "payload": None, "fingerprint": None})
                    submit_button.configure(state="disabled")
                    messagebox.showwarning("Preview expired", "The order details changed. Request a new preview; the prior preview cannot authorize this draft.", parent=dialog); return
                estimate = state.get("estimate")
                confirm_text = ("Submit this exact live order to Webull?\n\n"
                                + json.dumps(current_payload, indent=2, sort_keys=True)
                                + f"\n\nWebull preview estimated cost: ${estimate:,.2f}\nTimmy cost cap: ${state['config'].max_order_notional_usd:,.2f}\n\nThis will transmit one live order.")
                if not messagebox.askyesno("Confirm exact live order", confirm_text, parent=dialog):
                    set_order_text("Submission cancelled. No order was sent."); return
                if self.execution_target_var.get() != "Live" or self.execution_mode_var.get() != "User" or self._automation_cycle_in_progress or self._action_in_progress:
                    messagebox.showerror("Live mode changed", "Timmy's execution mode changed during confirmation. No order was sent.", parent=dialog); return
                config = self._execution_config(self._load_config_safe())
                if config != state["config"]:
                    state.update({"broker": None, "payload": None, "fingerprint": None})
                    submit_button.configure(state="disabled")
                    messagebox.showwarning("Settings changed", "Live account or risk settings changed after preview. Get a fresh preview.", parent=dialog); return
                try:
                    enforce_live_guards(config)
                    self._ensure_execution_journal_writable()
                    self._append_execution_event({"mode":"live", "robot":"Timmy", "event_type":"live-order-intent", "status":"pending-submit",
                                                  "client_order_id":current_payload["client_order_id"], "symbol":current_payload["symbol"],
                                                  "side":current_payload["side"], "quantity":current_payload["quantity"],
                                                  "order_type":"LIMIT", "limit_price":current_payload["limit_price"],
                                                  "instrument_type":current_payload["instrument_type"], "option_strategy":current_payload.get("option_strategy"),
                                                  "recorded_at":datetime.now().isoformat()})
                except Exception as exc:
                    messagebox.showerror("Live order blocked", f"No order sent: {exc}", parent=dialog); return
                preview_button.configure(state="disabled"); submit_button.configure(state="disabled")
                self._manual_webull_order_in_progress = True
                set_order_text("Sending one confirmed order. Do not repeat while the broker outcome is unresolved.")
                broker = state["broker"]; fingerprint = state["fingerprint"]
                def submit_worker():
                    try:
                        result = broker.submit_previewed_order_payloads([current_payload], fingerprint)
                        status = self._broker_event_status(result)
                        kind = "buy-order" if current_payload["side"] == "BUY" else "sell-order"
                        try:
                            self._append_execution_event({"mode":"live", "robot":"Timmy", "event_type":kind, "status":status,
                                                          "client_order_id":current_payload["client_order_id"], "symbol":current_payload["symbol"],
                                                          "side":current_payload["side"], "quantity":current_payload["quantity"],
                                                          "buy_price":current_payload["limit_price"] if current_payload["side"] == "BUY" else None,
                                                          "sell_price":current_payload["limit_price"] if current_payload["side"] != "BUY" else None,
                                                          "instrument_type":current_payload["instrument_type"], "option_strategy":current_payload.get("option_strategy"),
                                                          "broker_body":result.get("body"), "recorded_at":datetime.now().isoformat()})
                        except Exception as exc:
                            self._hold_live_automation(f"Manual order result could not be journaled: {exc}")
                        output = f"Broker status: {status}\n\n{json.dumps(redact(result), indent=2, sort_keys=True, default=str)}"
                        if status == "unknown": output += "\n\nOUTCOME UNKNOWN: reconcile this client order ID in Webull before retrying."
                        self.root.after(0, lambda: (set_order_text(output), refresh_orders(), setattr(self, "_manual_webull_order_in_progress", False)))
                    except Exception as exc:
                        try: self._append_execution_event({"mode":"live", "robot":"Timmy", "event_type":"sell-order" if current_payload["side"] != "BUY" else "buy-order", "status":"unknown", "client_order_id":current_payload["client_order_id"], "symbol":current_payload["symbol"], "recorded_at":datetime.now().isoformat()})
                        except Exception as journal_exc: self._hold_live_automation(f"Manual order outcome and journal status unknown: {journal_exc}")
                        error_message = f"Order outcome unknown: {type(exc).__name__}: {exc}. Reconcile at Webull before retrying."
                        self.root.after(0, lambda message=error_message: (set_order_text(message), setattr(self, "_manual_webull_order_in_progress", False)))
                threading.Thread(target=submit_worker, daemon=True, name="timmy-guarded-order-submit").start()
            side_menu = dialog.grid_slaves(row=5, column=1)[0]
            tif_menu = dialog.grid_slaves(row=8, column=1)[0]
            product_var.trace_add("write", update_product)
            tif_var.trace_add("write", update_product)
            buttons = ttk.Frame(dialog); buttons.grid(row=13, column=0, columnspan=2, sticky="ew", padx=14, pady=10)
            ttk.Button(buttons, text="Find instruments / contracts", command=find_product_instruments).pack(side="left", padx=(0, 8))
            preview_button = ttk.Button(buttons, text="Preview exact order", command=preview_manual_order); preview_button.pack(side="left", padx=8)
            submit_button = ttk.Button(buttons, text="Confirm & Submit Live", command=submit_manual_order, state="disabled"); submit_button.pack(side="left", padx=8)
            ttk.Button(buttons, text="Close", command=dialog.destroy).pack(side="right", padx=8)
            update_product()
        def open_webull_report(kind):
            report_window = tk.Toplevel(window); report_window.title(f"Webull {kind}"); report_window.transient(window)
            report_box = text_area(report_window, f"Loading read-only {kind.lower()}…")
            def worker():
                try:
                    config = self._execution_config(self._load_config_safe()); broker = WebullOpenApiBroker(config)
                    if kind == "Order history": result = broker.order_history()
                    else: result = broker.order_executions()
                    text_value = json.dumps(result, indent=2, sort_keys=True, default=str)
                except Exception as exc: text_value = f"Webull {kind.lower()} unavailable: {type(exc).__name__}: {exc}"
                self.root.after(0, lambda: set_text(report_box, text_value))
            threading.Thread(target=worker, daemon=True, name="timmy-webull-report").start()
        def open_instrument_discovery(product, initial_query=""):
            discovery = tk.Toplevel(window)
            discovery.title(f"Find {product.title()} instruments")
            discovery.transient(window)
            discovery.configure(bg=bg)
            discovery.columnconfigure(0, weight=1)
            discovery.rowconfigure(2, weight=1)
            tk.Label(
                discovery,
                text="Targeted read-only contract lookup for the selected guarded order workflow.",
                bg=bg, fg=muted, anchor="w", justify="left", wraplength=680,
            ).grid(row=0, column=0, sticky="ew", padx=12, pady=(12, 6))
            query_var = tk.StringVar(value=initial_query)
            query_entry = ttk.Entry(discovery, textvariable=query_var, width=36)
            query_entry.grid(row=1, column=0, sticky="ew", padx=12, pady=5)
            result_box = text_area(discovery, "Enter a symbol, option underlying, futures contract code, or event series, then search.")
            result_box.grid(row=2, column=0, sticky="nsew", padx=12, pady=6)
            def search():
                query = query_var.get().strip()
                if not query:
                    messagebox.showwarning("Lookup value required", "Enter a lookup value first.", parent=discovery)
                    return
                set_text(result_box, f"Looking up {product} instruments…")
                def worker():
                    try:
                        config = self._execution_config(self._load_config_safe())
                        response = WebullOpenApiBroker(config).discover_order_instruments(product, query)
                        output = json.dumps(redact(response), indent=2, sort_keys=True, default=str)
                        if len(output) > 30_000:
                            output = output[:30_000] + "\n… results truncated at 30 KB"
                    except Exception as exc:
                        output = f"Instrument lookup unavailable ({type(exc).__name__})."
                    self.root.after(0, lambda: set_text(result_box, output))
                threading.Thread(target=worker, daemon=True, name="timmy-webull-instrument-lookup").start()
            buttons = ttk.Frame(discovery)
            buttons.grid(row=3, column=0, sticky="ew", padx=12, pady=(2, 12))
            ttk.Button(buttons, text="Search instruments", command=search).pack(side="left")
            ttk.Button(buttons, text="Close", command=discovery.destroy).pack(side="right")
            query_entry.focus_set()
            if initial_query:
                search()
        def inspect_selected_order():
            row = selected_order()
            client_id = (row or {}).get("client_order_id") or (row or {}).get("clientOrderId")
            if not client_id:
                messagebox.showinfo("Select an order", "Select an order with a client order ID.", parent=window); return
            details = tk.Toplevel(window); details.title("Webull Order Detail"); details.transient(window)
            details_box = text_area(details, "Loading read-only order detail…")
            def worker():
                try:
                    config = self._execution_config(self._load_config_safe())
                    response = WebullOpenApiBroker(config).get_order_detail(str(client_id))
                    output = json.dumps(redact(response), indent=2, sort_keys=True, default=str)
                except Exception as exc: output = f"Order detail unavailable: {type(exc).__name__}: {exc}"
                self.root.after(0, lambda: set_text(details_box, output))
            threading.Thread(target=worker, daemon=True, name="timmy-webull-order-detail").start()
        def request_market_snapshot():
            symbols_text = simpledialog.askstring("Webull market snapshot", "Enter up to 20 symbols, separated by commas:", parent=window)
            if not symbols_text: return
            symbols = [item.strip().upper() for item in symbols_text.split(",") if item.strip()]
            if not symbols or len(symbols) > 20:
                messagebox.showerror("Symbol limit", "Enter between one and twenty symbols.", parent=window); return
            kind_window = tk.Toplevel(window); kind_window.title("Market snapshot type"); kind_window.transient(window); kind_window.grab_set()
            tk.Label(kind_window, text="Instrument class", bg=bg, fg=fg).pack(padx=12, pady=(12, 4))
            kind_var = tk.StringVar(value="EQUITY")
            ttk.Combobox(kind_window, textvariable=kind_var, values=("EQUITY", "OPTION", "FUTURES", "CRYPTO", "EVENT"), state="readonly").pack(padx=12, pady=4)
            def load_snapshot():
                kind = kind_var.get(); kind_window.destroy()
                report_window = tk.Toplevel(window); report_window.title(f"Webull {kind} market snapshot"); report_window.transient(window)
                report_box = text_area(report_window, "Loading read-only market data…")
                def worker():
                    try:
                        config = self._execution_config(self._load_config_safe())
                        result = WebullOpenApiBroker(config).market_snapshot(symbols, kind)
                        text_value = json.dumps(result, indent=2, sort_keys=True, default=str)
                    except Exception as exc: text_value = f"Snapshot unavailable: {type(exc).__name__}: {exc}"
                    self.root.after(0, lambda: set_text(report_box, text_value))
                threading.Thread(target=worker, daemon=True, name="timmy-webull-market-snapshot").start()
            ttk.Button(kind_window, text="Load snapshot", command=load_snapshot).pack(padx=12, pady=12)
        controls = ttk.Frame(orders); controls.grid(row=0, column=0, sticky="ew", padx=10, pady=(10, 0))
        ttk.Button(controls, text="Refresh snapshot", command=refresh_orders).pack(side="left", padx=(0, 6))
        ttk.Button(controls, text="Cancel selected order", command=lambda: mutate_order("cancel")).pack(side="left", padx=6)
        ttk.Button(controls, text="Replace selected limit order", command=lambda: mutate_order("replace")).pack(side="left", padx=6)
        ttk.Button(controls, text="Order detail", command=inspect_selected_order).pack(side="left", padx=6)
        ttk.Button(controls, text="Reduce / close selected position", command=reduce_position).pack(side="left", padx=6)
        read_controls = ttk.Frame(orders); read_controls.grid(row=3, column=0, sticky="ew", padx=10, pady=(0, 4))
        ttk.Button(read_controls, text="Order history", command=lambda: open_webull_report("Order history")).pack(side="left", padx=(0, 6))
        ttk.Button(read_controls, text="Executions", command=lambda: open_webull_report("Executions")).pack(side="left", padx=6)
        ttk.Button(read_controls, text="Market data snapshots", command=request_market_snapshot).pack(side="left", padx=6)
        ttk.Button(read_controls, text="New guarded live order", command=open_guarded_order_entry).pack(side="left", padx=6)

        # 4: named, integrity-checked settings versions with explicit restore.
        profiles = page("Settings Profiles")
        profiles.rowconfigure(1, weight=1)
        profile_list = tk.Listbox(profiles, bg=self.colors["panel_2"], fg=fg, selectbackground=self.colors["selected"], height=8)
        profile_list.grid(row=1, column=0, sticky="nsew", padx=12, pady=8)
        profile_status = tk.Label(profiles, text="Config versions are local and private. Restore changes runtime env files and requires restart.", bg=bg, fg=muted, anchor="w", justify="left", wraplength=780)
        profile_status.grid(row=2, column=0, sticky="ew", padx=12, pady=4)
        version_cache = []
        def reload_profiles():
            version_cache[:] = list_config_versions(self.home)
            profile_list.delete(0, "end")
            for item in version_cache:
                profile_list.insert("end", f"{item.created_at} · {item.label} · {item.version_id}")
        def create_profile():
            label = simpledialog.askstring("Save settings profile", "Name this local configuration snapshot:", parent=window)
            if not label:
                return
            try:
                item = create_config_version(self.home, label)
                profile_status.configure(text=f"Saved {item.label} ({len(item.files)} files). Secrets remain in the private local snapshot.")
                reload_profiles()
            except Exception as exc:
                messagebox.showerror("Profile save failed", str(exc), parent=window)
        def compare_profile():
            selected = profile_list.curselection()
            if not selected:
                return
            item = version_cache[selected[0]]
            changes = []
            for name, expected in item.files.items():
                try:
                    actual = hashlib.sha256((self.home / name).read_bytes()).hexdigest()
                except OSError:
                    actual = "missing"
                changes.append(f"{name}: {'matches' if actual == expected else 'differs'} · saved {expected[:12]} · current {actual[:12]}")
            profile_status.configure(text=f"Comparison against current files for {item.label}: " + ("; ".join(changes) or "no config files captured"))
        def restore_profile():
            selected = profile_list.curselection()
            if not selected:
                return
            item = version_cache[selected[0]]
            if not messagebox.askyesno("Restore settings profile", f"Restore {item.label}? A pre-restore snapshot will be saved. Restart Timmy to load the restored values.", parent=window):
                return
            try:
                rollback_config_version(self.home, item.version_id)
                profile_status.configure(text=f"Restored {item.label}. Restart Timmy to apply it.")
                reload_profiles()
            except Exception as exc:
                messagebox.showerror("Profile restore failed", str(exc), parent=window)
        profile_actions = tk.Frame(profiles, bg=bg)
        profile_actions.grid(row=0, column=0, sticky="w", padx=12, pady=8)
        for title, command in (("Save named profile", create_profile), ("Compare selected", compare_profile), ("Restore selected", restore_profile)):
            tk.Button(profile_actions, text=title, command=command).pack(side="left", padx=(0, 7))
        reload_profiles()

        # 5: first-run boundary checklist, persisted as a local completion marker.
        setup = page("First Run")
        setup.rowconfigure(1, weight=1)
        marker = self.home / ".timmy-first-run-reviewed.json"
        setup_box = text_area(setup, "FIRST-RUN SAFETY WALKTHROUGH\n\n1. Synthetic sample candles are illustrative and are never broker quotes.\n2. Paper mode uses Timmy's local paper ledger; it does not place broker orders.\n3. Real account reads require a configured Webull profile and account check.\n4. Live orders require explicit live gates, fresh account state, and required preview.\n5. Verify account, region, order IDs, and broker open orders independently before relying on a status.\n\nCompleting this checklist records only that it was reviewed; it does not enable live trading.")
        def mark_setup_reviewed():
            _write_private_json(marker, {"reviewed_at": datetime.now().astimezone().isoformat(), "version": 1})
            messagebox.showinfo("Setup walkthrough", "Review recorded locally. Trading mode and live gates were not changed.", parent=window)
        tk.Button(setup, text="Mark walkthrough reviewed", command=mark_setup_reviewed).grid(row=0, column=0, sticky="w", padx=12, pady=(10, 0))

        # 7: independent local labels/notes attached to journal event identity.
        journal = page("Journal Review")
        journal.columnconfigure(0, weight=1)
        journal.rowconfigure(1, weight=1)
        events = list(reversed(self.execution_events[-250:]))
        journal_list = tk.Listbox(journal, bg=self.colors["panel_2"], fg=fg, selectbackground=self.colors["selected"], height=8)
        journal_list.grid(row=1, column=0, sticky="nsew", padx=12, pady=8)
        journal_meta = {}
        for index, event in enumerate(events):
            key = str(event.get("client_order_id") or event.get("broker_order_id") or event.get("recorded_at") or f"row-{index}")
            journal_meta[index] = (key, event)
            journal_list.insert("end", f"{event.get('recorded_at', event.get('submitted_at','time unknown'))} · {event.get('symbol','?')} · {event.get('status','event')}")
        label_var, note_var = tk.StringVar(), tk.StringVar()
        def load_journal_review(_event=None):
            selected = journal_list.curselection()
            if not selected:
                return
            try:
                notes = json.loads((self.home / "journal-review-notes.json").read_text(encoding="utf-8"))
                current = notes.get(journal_meta[selected[0]][0], {})
            except (OSError, ValueError, AttributeError):
                current = {}
            label_var.set(str(current.get("label", "")))
            note_var.set(str(current.get("note", "")))
        journal_list.bind("<<ListboxSelect>>", load_journal_review)
        form = tk.Frame(journal, bg=bg)
        form.grid(row=2, column=0, sticky="ew", padx=12)
        tk.Entry(form, textvariable=label_var, width=22).pack(side="left", padx=(0, 8))
        tk.Entry(form, textvariable=note_var).pack(side="left", fill="x", expand=True, padx=(0, 8))
        def save_review():
            selected = journal_list.curselection()
            if not selected:
                messagebox.showinfo("Journal review", "Select an event first.", parent=window)
                return
            try:
                save_journal_review(self.home / "journal-review-notes.json", journal_meta[selected[0]][0], label_var.get(), note_var.get())
                messagebox.showinfo("Journal review", "Local review label and note saved.", parent=window)
            except Exception as exc:
                messagebox.showerror("Journal review", str(exc), parent=window)
        tk.Button(form, text="Save label / note", command=save_review).pack(side="right")
        tk.Label(journal, text="Labels and notes are stored separately; source execution events remain unchanged.", bg=bg, fg=muted, anchor="w").grid(row=3, column=0, sticky="ew", padx=12, pady=8)

        # 8: local notification controls only; the product has no email/push delivery integration.
        alerts = page("Alert Controls")
        alerts.rowconfigure(1, weight=1)
        alert_box = text_area(alerts, "Alert rules and trigger history are local. No email, SMS, or push delivery is configured.")
        alert_settings_path = self.home / "timmy-alert-preferences.json"
        try:
            alert_prefs = json.loads(alert_settings_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            alert_prefs = {}
        if not isinstance(alert_prefs, dict):
            alert_prefs = {}
        enabled_var = tk.BooleanVar(value=alert_prefs.get("local_alerts_enabled", True) is not False)
        quiet_var = tk.BooleanVar(value=alert_prefs.get("quiet_hours_enabled", False) is True)
        start_var = tk.StringVar(value=str(alert_prefs.get("quiet_start", "22:00")))
        end_var = tk.StringVar(value=str(alert_prefs.get("quiet_end", "07:00")))
        alert_controls = tk.Frame(alerts, bg=bg)
        alert_controls.grid(row=0, column=0, sticky="ew", padx=12, pady=10)
        tk.Checkbutton(alert_controls, text="Local alert history enabled", variable=enabled_var, bg=bg, fg=fg, selectcolor=bg).pack(anchor="w")
        tk.Checkbutton(alert_controls, text="Quiet hours (local display preference)", variable=quiet_var, bg=bg, fg=fg, selectcolor=bg).pack(anchor="w")
        tk.Label(alert_controls, text="Start / end (HH:MM)", bg=bg, fg=muted).pack(side="left")
        tk.Entry(alert_controls, textvariable=start_var, width=7).pack(side="left", padx=4)
        tk.Entry(alert_controls, textvariable=end_var, width=7).pack(side="left", padx=4)
        def save_alert_prefs():
            import re
            if any(not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", value.get()) for value in (start_var, end_var)):
                messagebox.showerror("Alert controls", "Quiet-hour times must use 24-hour HH:MM format.", parent=window)
                return
            _write_private_json(alert_settings_path, {"local_alerts_enabled": enabled_var.get(), "quiet_hours_enabled": quiet_var.get(), "quiet_start": start_var.get(), "quiet_end": end_var.get()})
            set_text(alert_box, "Saved local alert display preferences. Quiet hours suppress only the status-bar notification; triggered events continue to be recorded in local history. Timmy has no email, SMS, push, or background delivery integration.")
        tk.Button(alert_controls, text="Save preferences", command=save_alert_prefs).pack(side="left", padx=8)

        # 9: stepwise recovery guide based on a selected recent event.
        recovery = page("Recovery")
        recovery.rowconfigure(1, weight=1)
        recovery_box = text_area(recovery, "Select a recent journal event below to generate a recovery walkthrough.")
        event_choices = list(reversed(self.execution_events[-100:]))
        recovery_var = tk.StringVar(value="Select event")
        labels = [f"{event.get('symbol','?')} · {event.get('status', event.get('event','event'))} · {event.get('reason', event.get('message',''))}"[:120] for event in event_choices]
        choice = ttk.Combobox(recovery, textvariable=recovery_var, values=["Select event", *labels], state="readonly")
        choice.grid(row=0, column=0, sticky="ew", padx=12, pady=10)
        def render_recovery(_event=None):
            index = choice.current() - 1
            if index < 0 or index >= len(event_choices):
                return
            event = event_choices[index]
            cause = str(event.get("reason") or event.get("message") or event.get("error") or event.get("status") or "")
            set_text(recovery_box, "RECOVERY WALKTHROUGH\n\n" + "\n".join(f"{i}. {step}" for i, step in enumerate(recovery_steps(cause), start=1)) + "\n\nConfirm broker state before retrying any potentially submitted order.")
        choice.bind("<<ComboboxSelected>>", render_recovery)

        # 10: bounded, recursively redacted local support bundle.
        support = page("Support Bundle")
        support.rowconfigure(1, weight=1)
        support_box = text_area(support, "Export includes app version, allowlisted mode/data/gate states, and structured summaries of recent local events. It omits event messages, broker IDs, credentials, and raw crash logs.")
        def export_support():
            destination = filedialog.asksaveasfilename(parent=window, title="Export redacted diagnostics", defaultextension=".json", filetypes=(("JSON support bundle", "*.json"),))
            if not destination:
                return
            from . import __version__
            target = str(self.execution_target_var.get()).strip().lower()
            if target not in {"paper", "simulation", "live"}:
                target = "paper"
            run_mode = "auto" if str(self.execution_mode_var.get()).lower() == "auto" else "user"
            if self._market_data_load_error:
                data_state = "invalid"
            elif self._sample_data_in_use:
                data_state = "synthetic"
            elif self.bars_by_symbol:
                data_state = "loaded"
            else:
                data_state = "missing"
            payload = {
                "app_version": __version__,
                "generated_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "execution_target": target,
                "execution_mode": run_mode,
                "sample_data": bool(self._sample_data_in_use),
                "data_state": data_state,
                "broker_profile_configured": bool(self.config and self.config.webull_app_key and self.config.webull_app_secret),
                "live_submission_gate_enabled": bool(self.config and self.config.webull_enable_live_orders),
                "preview_required": True,
                "recent_events": support_event_summary(self.execution_events, limit=100),
            }
            try:
                serialized = json.dumps(payload, ensure_ascii=False)
                if len(serialized.encode("utf-8")) > 2_000_000:
                    payload["recent_events"] = payload["recent_events"][-25:]
                    serialized = json.dumps(payload, ensure_ascii=False)
                if len(serialized.encode("utf-8")) > 2_000_000:
                    raise ValueError("Support bundle exceeds 2 MB after truncation; reduce unusually large log fields and retry.")
                _write_private_json(Path(destination), payload)
                set_text(support_box, f"Structured support bundle saved to {destination}. Free-form event messages and raw crash logs were omitted.")
            except Exception as exc:
                messagebox.showerror("Support bundle", str(exc), parent=window)
        tk.Button(support, text="Export redacted diagnostics", command=export_support).grid(row=0, column=0, sticky="w", padx=12, pady=(10, 0))

    def _local_alert_notification_allowed(self) -> bool:
        """Gate only the local status-bar toast; alert events remain journaled."""
        try:
            prefs = json.loads((self.home / "timmy-alert-preferences.json").read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return True
        if not isinstance(prefs, dict):
            return True
        if prefs.get("local_alerts_enabled") is False:
            return False
        if prefs.get("quiet_hours_enabled") is not True:
            return True
        try:
            start_hour, start_minute = (int(value) for value in str(prefs["quiet_start"]).split(":"))
            end_hour, end_minute = (int(value) for value in str(prefs["quiet_end"]).split(":"))
            now = datetime.now().hour * 60 + datetime.now().minute
            start, end = start_hour * 60 + start_minute, end_hour * 60 + end_minute
        except (KeyError, TypeError, ValueError):
            return True
        if start == end:
            return False
        return not (start <= now < end if start < end else now >= start or now < end)

    def _apply_overview_layout(self) -> None:
        if getattr(self, "active_tab", None) == "Overview":
            self._show_tab(self.active_tab)

    def _save_last_workspace_state(self) -> None:
        if getattr(self, "_restoring_last_workspace", True):
            return
        state: dict[str, object] = {
            "workspace": getattr(self, "active_tab", "Automation"),
            "overview_radar_visible": self.overview_radar_visible_var.get(),
        }
        group = getattr(self, "watchlist_group_var", None)
        if group is not None and group.get() in {"All signals", "Pinned", *[item.name for item in self.watchlist_organization.groups]}:
            state["watchlist_group"] = group.get()
        symbol = getattr(self, "selected_chart_symbol", "")
        if symbol and symbol in self.signal_by_symbol:
            state["selected_symbol"] = symbol
        try:
            self.workspace_store.remember_last_state(state)
        except (OSError, ValueError):
            pass

    def _restore_last_workspace(self) -> None:
        if not getattr(self, "_restoring_last_workspace", False):
            return
        state = self._last_workspace_state
        workspace = state.get("workspace", "Automation")
        # Older versions saved the Market alias for the same Overview screen.
        if workspace == "Market":
            workspace = "Automation"
        valid_tabs = {"Overview", "Setup", "Universe", "Scanner", "Portfolio", "Automation",
                      "Research", "Alerts", "Strategy", "Execution", "Health", "Broker", "Audit"}
        if workspace not in valid_tabs:
            workspace = "Automation"
        self.overview_radar_visible_var.set(state.get("overview_radar_visible") is not False)
        group = state.get("watchlist_group")
        valid_groups = {"All signals", "Pinned", *[item.name for item in self.watchlist_organization.groups]}
        if isinstance(group, str) and group in valid_groups:
            self.watchlist_group_var.set(group)
        self._show_tab(str(workspace))
        symbol = state.get("selected_symbol")
        if isinstance(symbol, str) and symbol in self.signal_by_symbol:
            if hasattr(self, "signal_tree"):
                for item in self.signal_tree.get_children():
                    values = self.signal_tree.item(item, "values")
                    if values and values[0] == symbol:
                        self.signal_tree.selection_set(item)
                        self.signal_tree.focus(item)
                        break
            if hasattr(self, "market_watch_tree"):
                for item in self.market_watch_tree.get_children():
                    values = self.market_watch_tree.item(item, "values")
                    if values and values[0] == symbol:
                        self.market_watch_tree.selection_set(item)
                        self.market_watch_tree.focus(item)
                        break
            self._display_selected_signal(symbol)
        self._restoring_last_workspace = False
        if not isinstance(symbol, str) or symbol in self.signal_by_symbol:
            self._save_last_workspace_state()

    def _copy_health_details(self) -> None:
        sections = []
        for widget in (getattr(self, "health_text", None), getattr(self, "diagnostics_text", None)):
            if widget is not None:
                sections.append(widget.get("1.0", "end-1c").strip())
        details = "\n\n".join(section for section in sections if section)
        if not details:
            self.status_bar.configure(text="There are no diagnostic details to copy yet. Run the desk check first.")
            return
        self.root.clipboard_clear()
        self.root.clipboard_append(details)
        self.status_bar.configure(text="Health and diagnostic details copied to the clipboard.")

    def _set_automation_controls_compact(self, compact: bool) -> None:
        """Show only lane and cycle controls on Automation; keep tuning in Execution."""
        if not hasattr(self, "control_entry_frames"):
            return
        if compact:
            self.controls_title.configure(text="Automation controls")
            self.controls_status.configure(text="Target · mode · paper lane · run or pause")
            for frame in self.control_entry_frames:
                frame.grid_remove()
            self.guard_label.grid_remove()
            self.eligible_label.grid_remove()
            self.account_box.grid_remove()
            self.style_box.grid_remove()
            self.pattern_box.grid_remove()
            self.power_cycle_button.grid_remove()
            self.paper_auto_control.grid_configure(row=1, column=0, columnspan=2, padx=8, pady=8)
            self.target_box.grid_configure(row=1, column=2, columnspan=2, padx=8, pady=8)
            self.mode_box.grid_configure(row=1, column=4, columnspan=2, padx=8, pady=8)
            self.execution_action_box.grid_configure(row=2, column=0, columnspan=6, padx=10, pady=(0, 12))
            for column in range(6):
                self.controls.columnconfigure(column, weight=1, minsize=0)
        else:
            self.controls_title.configure(text="Lane & risk controls")
            self.controls_status.configure(text="Tune the scan, choose an account lane, and review order actions.")
            for column, frame in enumerate(self.control_entry_frames):
                frame.grid(row=1, column=column, sticky="ew", padx=10, pady=14)
            self.guard_label.grid(row=1, column=3, sticky="ew", padx=10, pady=14)
            self.eligible_label.grid(row=1, column=4, sticky="ew", padx=10, pady=14)
            self.paper_auto_control.grid_configure(row=1, column=5, columnspan=1, padx=10, pady=0)
            self.target_box.grid_configure(row=2, column=0, columnspan=1, padx=10, pady=(0, 14))
            self.mode_box.grid_configure(row=2, column=1, columnspan=1, padx=10, pady=(0, 14))
            self.account_box.grid(row=2, column=2, sticky="ew", padx=10, pady=(0, 14))
            self.execution_action_box.grid_configure(row=2, column=3, columnspan=3, padx=10, pady=(0, 14))
            self.style_box.grid(row=3, column=0, columnspan=2, sticky="ew", padx=10, pady=(0, 14))
            self.pattern_box.grid(row=3, column=2, columnspan=4, sticky="ew", padx=10, pady=(0, 14))
            self.power_cycle_button.grid(row=1, column=2, columnspan=2, sticky="ew", padx=(7, 0), pady=(8, 0))
            for column in range(6):
                self.controls.columnconfigure(column, weight=1, minsize=118)

    def _responsive_layout(self, event=None) -> None:
        if event is not None and event.widget is not self.root:
            return
        if not hasattr(self, "metrics"):
            return
        window_width = self.root.winfo_width()
        compact = window_width < 1120
        for column in range(6):
            self.controls.columnconfigure(column, weight=1, minsize=0 if compact else 118)
        if hasattr(self, "target_radio_buttons"):
            compact_target = window_width < 1120
            for button in self.target_radio_buttons:
                button.pack_forget()
            for button in self.target_radio_buttons:
                if compact_target:
                    button.pack(anchor="w", fill="x", padx=4, pady=1)
                else:
                    button.pack(side="left", padx=(0, 8))
        if hasattr(self, "execution_action_box"):
            if compact:
                self.execution_run_button.grid_configure(row=0, column=0, columnspan=4, padx=0, pady=(0, 4))
                self.execution_preview_control.grid_configure(row=1, column=0, columnspan=2, padx=(0, 4))
                self.execution_submit_button.grid_configure(row=1, column=2, columnspan=2, padx=(4, 0))
                self.stop_button.grid_configure(row=2, column=0, columnspan=2, padx=(0, 4), pady=(4, 0))
                if getattr(self, "active_tab", None) == "Automation":
                    self.power_cycle_button.grid_remove()
                else:
                    self.power_cycle_button.grid_configure(row=2, column=2, columnspan=2, padx=(4, 0), pady=(4, 0))
            else:
                self.execution_run_button.grid_configure(row=0, column=0, columnspan=1, padx=(0, 7), pady=0)
                self.execution_preview_control.grid_configure(row=0, column=1, columnspan=1, padx=7)
                self.execution_submit_button.grid_configure(row=0, column=2, columnspan=2, padx=(7, 0))
                self.stop_button.grid_configure(row=1, column=0, columnspan=2, padx=(0, 7), pady=(8, 0))
                if getattr(self, "active_tab", None) == "Automation":
                    self.power_cycle_button.grid_remove()
                else:
                    self.power_cycle_button.grid_configure(row=1, column=2, columnspan=2, padx=(7, 0), pady=(8, 0))
        if hasattr(self, "automation_guidance") and hasattr(self, "automation_workflow"):
            if window_width < 1040:
                self.automation_guidance.grid_configure(row=2, column=0, columnspan=2, padx=12, pady=(0, 8))
                self.automation_workflow.grid_configure(row=3, column=0, columnspan=2, padx=12, pady=(0, 12))
                columns = 2 if window_width < 900 else 3
                for index, label in enumerate(self.automation_summary_labels.values()):
                    label.master.grid_configure(row=index // columns, column=index % columns)
                for column in range(5):
                    self.automation_stats.columnconfigure(column, weight=1 if column < columns else 0)
                self.paper_insights_frame.grid_configure(row=1, column=0, columnspan=3, padx=12, pady=(0, 6))
                self.simulation_insights_frame.grid_configure(row=2, column=0, columnspan=3, padx=12, pady=(0, 12))
            else:
                self.automation_guidance.grid_configure(row=2, column=0, columnspan=1, padx=(18, 9), pady=(0, 18))
                self.automation_workflow.grid_configure(row=2, column=1, columnspan=1, padx=(9, 18), pady=(0, 18))
                for index, label in enumerate(self.automation_summary_labels.values()):
                    label.master.grid_configure(row=0, column=index)
                for column in range(5):
                    self.automation_stats.columnconfigure(column, weight=1)
                self.paper_insights_frame.grid_configure(row=1, column=0, columnspan=1, padx=(12, 5), pady=(0, 12))
                self.simulation_insights_frame.grid_configure(row=1, column=2, columnspan=1, padx=(5, 12), pady=(0, 12))
        if getattr(self, "active_tab", None) != "Overview":
            return
        scan_label = getattr(self, "market_scan_status_label", None)
        if scan_label is not None:
            scan_label.configure(wraplength=max(360, min(860, window_width - 520)))
        if compact:
            for idx in range(3):
                self.metrics.columnconfigure(idx, weight=1)
            for idx in range(3, 5):
                self.metrics.columnconfigure(idx, weight=0)
            for card, row, column in (
                (self.universe_card, 0, 0), (self.active_card, 0, 1),
                (self.movement_card, 0, 2), (self.trade_ready_card, 1, 0),
                (self.plan_card, 1, 1),
            ):
                card[0].master.grid_configure(row=row, column=column)
            self.body.columnconfigure(0, weight=2, uniform="signal-desk")
            self.body.columnconfigure(1, weight=7, uniform="signal-desk")
            self.market_watchlist_panel.grid_configure(row=0, column=0, columnspan=1, padx=(0, 8), pady=0)
            self.right_panel.grid_configure(row=0, column=1, columnspan=1, padx=0, pady=0)
            self.right_panel.columnconfigure(0, weight=2, uniform="desk-workbench")
            self.right_panel.columnconfigure(1, weight=1, uniform="desk-workbench")
            self.market_chart_panel.grid_configure(row=0, column=0, rowspan=2, padx=(0, 8), pady=0)
            self.decision_panel.grid_configure(row=0, column=1, padx=0, pady=(0, 5))
            self.order_panel.grid_configure(row=1, column=1, padx=0, pady=(5, 0))
        else:
            for idx in range(5):
                self.metrics.columnconfigure(idx, weight=1)
            for card, column in (
                (self.universe_card, 0), (self.active_card, 1),
                (self.movement_card, 2), (self.trade_ready_card, 3),
                (self.plan_card, 4),
            ):
                card[0].master.grid_configure(row=0, column=column)
            self.body.columnconfigure(0, weight=2, uniform="signal-desk")
            self.body.columnconfigure(1, weight=7, uniform="signal-desk")
            self.market_watchlist_panel.grid_configure(row=0, column=0, columnspan=1, padx=(0, 10), pady=0)
            self.right_panel.grid_configure(row=0, column=1, columnspan=1, padx=0, pady=0)
            self.right_panel.columnconfigure(0, weight=2, uniform="desk-workbench")
            self.right_panel.columnconfigure(1, weight=1, uniform="desk-workbench")
            self.market_chart_panel.grid_configure(row=0, column=0, rowspan=2, padx=(0, 10), pady=(0, 10))
            self.decision_panel.grid_configure(row=0, column=1, padx=0, pady=(0, 6))
            self.order_panel.grid_configure(row=1, column=1, padx=0, pady=(6, 10))

    def _scroll_content(self, event) -> str | None:
        if not hasattr(self, "content_canvas"):
            return None
        canvas = self.content_canvas
        x, y = event.x_root, event.y_root
        left, top = canvas.winfo_rootx(), canvas.winfo_rooty()
        if not (left <= x <= left + canvas.winfo_width() and top <= y <= top + canvas.winfo_height()):
            return None
        if getattr(event, "num", None) == 4:
            step = -3
        elif getattr(event, "num", None) == 5:
            step = 3
        else:
            delta = getattr(event, "delta", 0)
            self._wheel_delta_remainder += delta
            wheel_ticks = int(self._wheel_delta_remainder / 120)
            self._wheel_delta_remainder -= wheel_ticks * 120
            step = -wheel_ticks
        if step:
            canvas.yview_scroll(step, "units")
            return "break"
        return None

    def _scroll_widget(self, event, target: tk.Widget) -> str:
        if getattr(event, "num", None) == 4:
            step = -3
        elif getattr(event, "num", None) == 5:
            step = 3
        else:
            delta = getattr(event, "delta", 0)
            self._wheel_delta_remainder += delta
            ticks = int(self._wheel_delta_remainder / 120)
            self._wheel_delta_remainder -= ticks * 120
            step = -ticks
        if step:
            target.yview_scroll(step, "units")
        return "break"

    def _profile_field(self, parent: tk.Widget, row: int, label: str, variable: tk.StringVar, secret: bool = False) -> None:
        tk.Label(parent, text=label, bg=self.colors["panel"], fg=self.colors["muted"],
                 font=("Sans", 9, "bold"), anchor="w").grid(row=row, column=0, sticky="w", pady=5, padx=(0, 12))
        tk.Entry(
            parent,
            textvariable=variable,
            bg=self.colors["entry"],
            fg=self.colors["text"],
            insertbackground=self.colors["text"],
            relief="flat",
            show="*" if secret else "",
            highlightbackground=self.colors["line"],
            highlightthickness=1,
            font=("Sans", 10),
        ).grid(row=row, column=1, sticky="ew", pady=5, ipady=5)
        status = tk.Label(
            parent,
            text="-",
            bg=self.colors["panel"],
            fg=self.colors["muted"],
            font=("Sans", 8, "bold"),
            anchor="e",
            width=12,
        )
        status.grid(row=row, column=2, sticky="e", pady=5, padx=(10, 0))
        self.profile_field_status_labels[label] = status

    def _account_option_menu(self, parent: tk.Widget) -> tk.OptionMenu:
        menu = tk.OptionMenu(parent, self.webull_account_choice_var, "Configured account")
        menu.configure(
            bg=self.colors["button"],
            fg=self.colors["button_text"],
            activebackground=self.colors["panel_2"],
            activeforeground=self.colors["text"],
            relief="flat",
            font=("Sans", 8, "bold"),
            highlightthickness=1,
            highlightbackground=self.colors["line"],
        )
        menu["menu"].configure(
            bg=self.colors["panel_2"],
            fg=self.colors["text"],
            activebackground=self.colors["selected"],
            activeforeground=self.colors["selected_text"],
            font=("Sans", 9),
        )
        return menu

    def _set_nav_active(self, active: str) -> None:
        for label, button in self.nav_buttons.items():
            selected = label == active
            button.configure(
                bg=self.colors["selected"] if selected else self.colors["rail"],
                fg=self.colors["selected_text"] if selected else self.colors["rail_muted"],
            )

    def _button(self, parent: tk.Widget, text: str, command, accent: str | None = None, tooltip: str | None = None) -> tk.Button:
        bg = self.colors["button"]
        fg = self.colors["button_text"]
        active_bg = self.colors["panel_2"]
        if accent == "gold":
            bg = self.colors["gold"]
            fg = self.colors["gold_text"]
            active_bg = self.colors["gold"]
        elif accent == "teal":
            bg = self.colors["teal_button"]
            fg = self.colors["teal_button_text"]
            active_bg = self.colors["cyan"]
        icon_only = len(text) <= 2
        button = tk.Button(parent, text=text, command=command, bg=bg, fg=fg, activebackground=active_bg,
                           activeforeground=fg, relief="flat", padx=16, pady=10,
                           font=("Sans", 14 if icon_only else 10, "bold"),
                           disabledforeground=self.colors["disabled"], cursor="hand2", anchor="center",
                           justify="center", takefocus=True, highlightbackground=self.colors["line"],
                           highlightcolor=self.colors["cyan"], highlightthickness=2)
        if icon_only:
            button.configure(width=3)
        else:
            self._fit_text(button, min_size=8, max_size=10, padding=28, wrap=True)
        if tooltip:
            self._add_tooltip(button, tooltip)
        return button

    def _add_tooltip(self, widget: tk.Widget, text: str) -> None:
        def show(_event=None) -> None:
            self._hide_tooltip()
            try:
                x = widget.winfo_rootx() + 8
                y = widget.winfo_rooty() + widget.winfo_height() + 8
            except tk.TclError:
                return
            tip = tk.Toplevel(self.root)
            tip.wm_overrideredirect(True)
            tip.wm_geometry(f"+{x}+{y}")
            label = tk.Label(
                tip,
                text=text,
                bg=self.colors["panel_3"],
                fg=self.colors["text"],
                padx=8,
                pady=5,
                font=("Sans", 9, "bold"),
                highlightbackground=self.colors["line"],
                highlightthickness=1,
            )
            label.pack()
            self._tooltip = tip

        widget.bind("<Enter>", show, add="+")
        widget.bind("<Leave>", lambda _event=None: self._hide_tooltip(), add="+")
        widget.bind("<ButtonPress>", lambda _event=None: self._hide_tooltip(), add="+")

    def _hide_tooltip(self) -> None:
        if self._tooltip is None:
            return
        try:
            self._tooltip.destroy()
        except tk.TclError:
            pass
        self._tooltip = None

    def _register_command_actions(self) -> None:
        pages = (
            ("Overview", "Overview", "quotes symbols chart"), ("Scanner", "Signal Scanner", "scan filter"),
            ("Portfolio", "Portfolio", "holdings paper pnl"), ("Automation", "Automation", "paper pause"),
            ("Alerts", "Alerts", "rules notifications"), ("Execution", "Execution Desk", "orders preview"),
            ("Strategy", "Strategy Settings", "risk patterns"), ("Universe", "Universe", "watchlist symbols"),
            ("Setup", "Broker Setup", "profile account"), ("Broker", "Connection Diagnostics", "broker status"),
            ("Audit", "Trade Journal", "history audit"), ("Health", "System Health", "diagnostics"),
        )
        for tab, label, keywords in pages:
            self.action_registry.register(
                f"page:{tab.lower()}", f"Open {label}", lambda target=tab: self._show_tab(target),
                category="Workspace", keywords=keywords.split(),
            )
        self.action_registry.register("page:review-operations", "Open Review & Operations",
                                      self._open_operations_review, category="Workspace",
                                      keywords=("timeline", "open orders", "reconcile", "journal", "support"))
        for action_id, label, callback, shortcut, keywords in (
            ("market:refresh", "Refresh market scan", self.refresh_all, "F5", ("quotes", "update")),
            ("market:cycle", "Run decision cycle", self.run_decision_cycle, "Ctrl+R", ("evaluate", "strategy")),
            ("help:guide", "Open keyboard and workflow guide", self._open_help_guide, "F1", ("help", "shortcuts", "learn")),
            ("workspace:save", "Save current workspace", self._save_workspace_preset, "", ("layout", "preset")),
            ("symbol:note", "Edit note for selected ticker", self._edit_selected_symbol_note, "", ("research", "remember")),
        ):
            self.action_registry.register(action_id, label, callback, category="Actions",
                                          shortcut=shortcut, keywords=keywords)

    def _open_command_palette(self, _event=None):
        if getattr(self, "_palette_window", None) is not None:
            try:
                self._palette_window.destroy()
            except tk.TclError:
                pass
        window = tk.Toplevel(self.root)
        self._palette_window = window
        window.title("Timmy Quick Jump")
        window.transient(self.root)
        window.configure(bg=self.colors["panel"])
        window.geometry("560x430")
        window.minsize(420, 300)
        window.columnconfigure(0, weight=1)
        window.rowconfigure(2, weight=1)
        tk.Label(window, text="QUICK JUMP  /  WORKSPACES · ACTIONS · SYMBOLS",
                 bg=self.colors["panel"], fg=self.colors["teal"],
                 font=("Sans", 9, "bold"), anchor="w").grid(row=0, column=0, sticky="ew", padx=16, pady=(14, 8))
        query = tk.StringVar()
        search = tk.Entry(window, textvariable=query, bg=self.colors["entry"], fg=self.colors["text"],
                          insertbackground=self.colors["text"], relief="flat", font=("Sans", 13))
        search.grid(row=1, column=0, sticky="ew", padx=16, pady=(0, 10), ipady=9)
        results = tk.Listbox(window, bg=self.colors["panel_2"], fg=self.colors["text"],
                             selectbackground=self.colors["selected"], selectforeground=self.colors["selected_text"],
                             relief="flat", font=("Sans", 10), activestyle="none", height=12)
        results.grid(row=2, column=0, sticky="nsew", padx=16, pady=(0, 14))

        def invoke(_event=None):
            selection = results.curselection()
            if not selection and self._palette_rows:
                selection = (0,)
            if selection:
                _label, callback = self._palette_rows[selection[0]]
                window.destroy()
                self._palette_window = None
                try:
                    callback()
                except Exception as exc:
                    self.status_bar.configure(text=f"Quick Jump action failed: {exc}")
            return "break"

        query.trace_add("write", lambda *_args: self._update_command_palette(query.get(), results))
        search.bind("<Return>", invoke)
        search.bind("<Escape>", lambda _event: (window.destroy(), setattr(self, "_palette_window", None), "break")[-1])
        search.bind("<Down>", lambda _event: (results.focus_set(), results.selection_set(0), "break")[-1])
        results.bind("<Return>", invoke)
        results.bind("<Double-Button-1>", invoke)
        results.bind("<Escape>", lambda _event: (window.destroy(), setattr(self, "_palette_window", None), "break")[-1])
        self._update_command_palette("", results)
        window.protocol("WM_DELETE_WINDOW", lambda: (window.destroy(), setattr(self, "_palette_window", None)))
        search.focus_set()
        window.grab_set()
        return "break"

    def _update_command_palette(self, query: str, results: tk.Listbox) -> None:
        rows: list[tuple[str, object]] = []
        actions = self.action_registry.search(query, limit=30)
        for action in actions:
            shortcut = f"  ·  {action.shortcut}" if action.shortcut else ""
            rows.append((f"{action.category}   /   {action.label}{shortcut}",
                         lambda action_id=action.action_id: self.action_registry.invoke(action_id)))
        presets = self.workspace_store.list_presets()
        for preset in presets:
            label = f"Workspace   /   Load {preset.name}"
            if not query or all(term in label.lower() for term in query.lower().split()):
                rows.append((label, lambda name=preset.name: self._load_workspace_preset(name)))
        symbols = list(self.workspace_store.recent_symbols())
        symbols.extend(symbol for symbol in sorted(self.signal_by_symbol) if symbol not in symbols)
        for symbol in symbols:
            signal = self.signal_by_symbol.get(symbol)
            label = f"Symbol   /   {symbol}" + (f"  ·  {signal.decision} {signal.score}" if signal else "  ·  recent")
            if not query or all(term in f"{symbol} {label}".lower() for term in query.lower().split()):
                rows.append((label, lambda target=symbol: self._open_symbol_from_palette(target)))
        self._palette_rows = rows[:40]
        results.delete(0, tk.END)
        for label, _callback in self._palette_rows:
            results.insert(tk.END, label)
        if self._palette_rows:
            results.selection_set(0)

    def _open_symbol_from_palette(self, symbol: str) -> None:
        self._show_tab("Overview")
        self._display_selected_signal(symbol)
        try:
            self.workspace_store.remember_symbol(symbol)
        except ValueError:
            pass

    def _open_help_guide(self, _event=None):
        dialog = tk.Toplevel(self.root)
        dialog.title("Timmy quick guide")
        dialog.transient(self.root)
        dialog.configure(bg=self.colors["panel"])
        dialog.columnconfigure(0, weight=1)
        tk.Label(dialog, text="TIMMY QUICK GUIDE", bg=self.colors["panel"], fg=self.colors["teal"],
                 font=("Sans", 12, "bold"), anchor="w").grid(row=0, column=0, sticky="ew", padx=18, pady=(16, 5))
        tk.Label(dialog, text="KEYBOARD SHORTCUTS", bg=self.colors["panel"], fg=self.colors["gold"],
                 font=("Sans", 9, "bold"), anchor="w").grid(row=1, column=0, sticky="ew", padx=18, pady=(8, 3))
        shortcuts = [(item.key, item.description) for item in self.shortcut_help.list_items()]
        shortcuts_box = tk.Frame(dialog, bg=self.colors["panel"])
        shortcuts_box.grid(row=2, column=0, sticky="ew", padx=18)
        for key, action in shortcuts:
            line = tk.Frame(shortcuts_box, bg=self.colors["panel"])
            line.pack(fill="x", pady=2)
            tk.Label(line, text=key, bg=self.colors["panel_2"], fg=self.colors["text"],
                     font=("Monospace", 9, "bold"), padx=7, pady=4, width=10, anchor="w").pack(side="left")
            tk.Label(line, text=action, bg=self.colors["panel"], fg=self.colors["muted"],
                     font=("Sans", 9), anchor="w").pack(side="left", padx=10)
        workflow_text = (
            "MARKET RADAR\nSelect a ticker to inspect its chart and decision brief. Pin it or add it to a personal group.\n\n"
            "CHART\nChoose a history range, toggle moving averages, volume, or trade levels, and compare local symbols.\n\n"
            "SCANNER\nSearch or filter results. Click a heading to sort; use Columns to choose and arrange what you see.\n\n"
            "ALERTS & NOTES\nCreate local signal rules in Alerts and save private ticker notes from Quick Jump. These do not submit orders."
        )
        tk.Label(dialog, text=workflow_text, bg=self.colors["panel_2"], fg=self.colors["text"],
                 font=("Sans", 9), justify="left", anchor="w", wraplength=560, padx=12, pady=10).grid(
                     row=3, column=0, sticky="ew", padx=18, pady=(12, 12))
        self._button(dialog, "Close", dialog.destroy).grid(row=4, column=0, sticky="e", padx=18, pady=(0, 16))
        dialog.bind("<Escape>", lambda _event: dialog.destroy())
        dialog.bind("<F1>", lambda _event: dialog.destroy())
        dialog.grab_set()
        return "break"

    def _save_workspace_preset(self) -> None:
        name = simpledialog.askstring("Save workspace", "Name this workspace preset:", parent=self.root)
        if name is None:
            return
        state = {
            "workspace": getattr(self, "active_tab", "Overview"),
            "density": "compact" if self.root.winfo_width() < 1120 else "standard",
        }
        selected_symbol = getattr(self, "selected_chart_symbol", "")
        if selected_symbol:
            state["selected_symbol"] = selected_symbol
        try:
            preset = self.workspace_store.save_preset(name, state)
        except ValueError as exc:
            messagebox.showerror("Workspace not saved", str(exc), parent=self.root)
            return
        self.status_bar.configure(text=f"Workspace '{preset.name}' saved.")

    def _load_workspace_preset(self, name: str) -> None:
        preset = self.workspace_store.load_preset(name)
        if preset is None:
            self.status_bar.configure(text=f"Workspace '{name}' was not found.")
            return
        workspace = preset.state.get("workspace", "Overview")
        if workspace not in {item for _section, items in (
            ("WORKSPACES", ("Overview", "Portfolio", "Automation", "Alerts")),
            ("RESEARCH", ("Scanner", "Strategy", "Universe")),
            ("EXECUTION", ("Execution", "Broker")),
            ("SYSTEM", ("Setup", "Audit", "Health")),
        ) for item in items}:
            workspace = "Overview"
        self._show_tab(str(workspace))
        symbol = preset.state.get("selected_symbol")
        if isinstance(symbol, str) and symbol in self.signal_by_symbol:
            self._display_selected_signal(symbol)
        self.status_bar.configure(text=f"Workspace '{name}' loaded.")

    def _fit_text(
        self,
        widget: tk.Widget,
        min_size: int,
        max_size: int,
        padding: int = 16,
        wrap: bool = True,
    ) -> None:
        base = tkfont.Font(font=widget.cget("font"))
        family = base.actual("family")
        weight = base.actual("weight")
        slant = base.actual("slant")

        def apply_fit(_event=None) -> None:
            width = max(1, widget.winfo_width() - padding)
            text = str(widget.cget("text") or "")
            size = max_size
            while size > min_size:
                candidate = tkfont.Font(family=family, size=size, weight=weight, slant=slant)
                longest_word = max(text.split(), key=len, default="")
                if not longest_word or candidate.measure(longest_word) <= width:
                    break
                size -= 1
            widget.configure(font=(family, size, weight))
            if wrap:
                widget.configure(wraplength=width)

        widget.bind("<Configure>", apply_fit, add="+")
        self.root.after_idle(apply_fit)

    def _metric(self, parent: tk.Widget, row: int, column: int, title: str, highlight: bool = False) -> tuple[tk.Label, tk.Label]:
        frame = tk.Frame(parent, bg=self.colors["panel"], highlightbackground=self.colors["gold"] if highlight else self.colors["line"],
                         highlightthickness=2 if highlight else 1)
        frame.grid(row=row, column=column, sticky="ew", padx=6, pady=6)
        stripe = tk.Frame(frame, bg=self.colors["gold"] if highlight else self.colors["cyan"], height=4)
        stripe.pack(fill="x")
        title_label = tk.Label(frame, text=title, bg=self.colors["panel"], fg=self.colors["muted"],
                               font=("Sans", 9), anchor="center", justify="center")
        self._fit_text(title_label, min_size=8, max_size=9, padding=20, wrap=True)
        title_label.pack(fill="x", padx=8, pady=(6, 2))
        value = tk.Label(frame, text="-", bg=self.colors["panel"], fg=self.colors["text"],
                         font=("Sans", 16, "bold"), anchor="center", justify="center")
        self._fit_text(value, min_size=11, max_size=16, padding=20, wrap=True)
        value.pack(fill="x", padx=8)
        sub = tk.Label(frame, text="-", bg=self.colors["panel"], fg=self.colors["muted"],
                       font=("Sans", 9), anchor="center", justify="center")
        self._fit_text(sub, min_size=7, max_size=9, padding=20, wrap=True)
        sub.pack(fill="x", padx=8, pady=(1, 7))
        return value, sub

    def _control_entry(self, parent: tk.Widget, column: int, title: str, variable: tk.StringVar) -> tk.Frame:
        frame = tk.Frame(parent, bg=self.colors["panel_3"], highlightbackground=self.colors["line"], highlightthickness=1)
        frame.grid(row=1, column=column, sticky="ew", padx=10, pady=14)
        label = tk.Label(frame, text=title, bg=self.colors["panel"], fg=self.colors["muted"],
                         font=("Sans", 9, "bold"), anchor="center", justify="center")
        label.configure(bg=self.colors["panel_3"])
        self._fit_text(label, min_size=8, max_size=9, padding=10, wrap=True)
        label.pack(fill="x", padx=10, pady=(8, 0))
        tk.Entry(frame, textvariable=variable, bg=self.colors["entry"], fg=self.colors["text"],
                 insertbackground=self.colors["text"], relief="flat", width=8, justify="center",
                 font=("Sans", 13, "bold"), highlightbackground=self.colors["cyan"], highlightthickness=1).pack(fill="x", padx=10, pady=(5, 8), ipady=5)
        return frame

    def _section_header(self, parent: tk.Widget, eyebrow: str, title: str, button_text: str | None, command, compact: bool = False) -> tk.Button | None:
        parent.columnconfigure(0, weight=1)
        header = tk.Frame(parent, bg=self.colors["panel"])
        header.grid(row=0, column=0, sticky="ew", padx=18, pady=(14 if compact else 18, 12))
        header.columnconfigure(0, weight=1)
        eyebrow_label = tk.Label(header, text=eyebrow, bg=self.colors["panel"], fg=self.colors["gold"],
                                 font=("Sans", 9, "bold"), anchor="w", justify="left")
        self._fit_text(eyebrow_label, min_size=8, max_size=9, padding=20, wrap=True)
        eyebrow_label.grid(row=0, column=0, sticky="ew")
        title_label = tk.Label(header, text=title, bg=self.colors["panel"], fg=self.colors["text"],
                               font=("Sans", 16, "bold"), anchor="w", justify="left")
        self._fit_text(title_label, min_size=12, max_size=16, padding=20, wrap=True)
        title_label.grid(row=1, column=0, sticky="ew", pady=(2, 0))
        if button_text and command:
            tooltip = {
                "Scan Now": "Refresh market data and rebuild the ranked scanner",
                "Use Sample Bars": "Switch to generated sample market history",
                "Run Model": "Run strategy model",
                "Run Check": "Run desk health check",
                "Paper Trade": "Paper trade current queue",
            }.get(button_text, button_text)
            button = self._button(header, button_text, command,
                                  accent="teal" if button_text == "Paper Trade" else None, tooltip=tooltip)
            button.grid(row=0, column=1, rowspan=2, sticky="e")
            return button
        return None

    def refresh_all(self) -> None:
        if self.closing:
            return
        if self._action_in_progress:
            self.status_bar.configure(text="An action is already in progress. Wait for it to finish before refreshing.")
            return
        if self._refresh_in_progress:
            self.status_bar.configure(text="Refresh already in progress.")
            return
        try:
            refresh_config = self._runtime_config(self._load_config_safe())
        except Exception as exc:
            self.status_bar.configure(text=f"Refresh setup failed: {exc}")
            return
        self._refresh_in_progress = True
        self.status_bar.configure(text="Refreshing market data...")
        scan_status_label = getattr(self, "market_scan_status_label", None)
        if scan_status_label is not None:
            scan_status_label.configure(text="SCAN STARTING · refreshing provider data and updating the scan")
        self._set_buttons_state("disabled")
        self.config = refresh_config

        def refresh_market_data() -> None:
            error = None
            outcome = None
            try:
                # Network requests and watchlist rotation can take several seconds.
                # Keep them off Tk's event loop so the window remains responsive.
                outcome = self._refresh_market_data_if_needed(config=refresh_config)
            except Exception as exc:
                error = exc
            if not self.closing:
                try:
                    self.root.after(0, lambda error=error, outcome=outcome: finish_refresh(error, outcome))
                except tk.TclError:
                    pass

        def finish_refresh(error: Exception | None, outcome: MarketRefreshOutcome | None) -> None:
            self._refresh_in_progress = False
            if self.closing:
                return
            try:
                self._refresh_payload(skip_market_refresh=True)
                try:
                    self._record_research_scan(outcome, refresh_error=error)
                except (OSError, ValueError, tk.TclError) as record_error:
                    self.status_bar.configure(text=f"Scan completed, but coverage history was not saved: {record_error}")
                if error is not None:
                    detail = str(error).strip() or error.__class__.__name__
                    if self._market_data_load_error:
                        state = "the saved market data file is unreadable and was preserved"
                    elif self._sample_data_in_use:
                        state = "synthetic sample data is displayed (not market quotes)"
                    elif self.bars_by_symbol:
                        state = "the last saved market data is displayed"
                    else:
                        state = "no market data is available"
                    self.status_bar.configure(
                        text=f"Market refresh failed; {state}. {detail[:180]}"
                    )
                elif self._market_data_load_error:
                    self.status_bar.configure(
                        text="Refresh finished, but the saved market data file is unreadable and was preserved."
                    )
                elif self._sample_data_in_use:
                    self.status_bar.configure(
                        text="Refresh finished; synthetic sample data is displayed (not market quotes)."
                    )
                elif outcome is not None and outcome.state == "empty":
                    if self.bars_by_symbol:
                        if outcome.returned:
                            message = (
                                f"Provider returned {outcome.returned:,} bars, but none matched the active cache; "
                                "the saved data was kept."
                            )
                        else:
                            message = "Provider returned no usable bars; the saved data was kept."
                        self.status_bar.configure(
                            text=f"{message} Showing {len(self.bars_by_symbol):,} previously saved symbols."
                        )
                    else:
                        self.status_bar.configure(text="Provider returned no usable bars; no market data is available.")
                elif outcome is not None and outcome.state == "updated":
                    if outcome.returned < outcome.requested:
                        self.status_bar.configure(
                            text=(f"Market data updated for {outcome.cached_symbols:,} symbols; "
                                  f"provider returned {outcome.returned:,}/{outcome.requested:,} requested.")
                        )
                    else:
                        self.status_bar.configure(
                            text=f"Market data refresh complete for {outcome.cached_symbols:,} symbols."
                        )
                elif outcome is not None and outcome.state == "cached":
                    self.status_bar.configure(text="Saved market data is still within its freshness window.")
                elif outcome is not None and outcome.state == "csv":
                    self.status_bar.configure(text="Market data is read from the configured CSV file.")
                elif self.bars_by_symbol:
                    self.status_bar.configure(text="Using the saved market data cache.")
                else:
                    self.status_bar.configure(text="Refresh finished; no market data is available from the selected source.")
                if self._settings_save_error:
                    self.status_bar.configure(
                        text=f"{self.status_bar.cget('text')} Settings not saved: {self._settings_save_error[:120]}"
                    )
                if self._paper_summary_storage_error:
                    self.status_bar.configure(
                        text=f"{self.status_bar.cget('text')} Paper summary not saved: {self._paper_summary_storage_error[:100]}"
                    )
            except Exception as exc:
                self.status_bar.configure(text=f"Refresh failed: {exc}")
                self._set_text(self.broker_text, str(exc))
            finally:
                self._set_buttons_state("normal")
                self._sync_manual_controls()
                self._sync_profile_save_state()

        threading.Thread(target=refresh_market_data, daemon=True, name="timmy-market-refresh").start()

    def _set_status_from_worker(self, text: str) -> None:
        """Queue a status update from background market-data work."""
        if self.closing:
            return
        try:
            def apply_status() -> None:
                if self.closing:
                    return
                self.status_bar.configure(text=text)
                label = getattr(self, "market_scan_status_label", None)
                progress = getattr(self, "_movement_scan_progress", {})
                live_scan = isinstance(progress, dict) and progress.get("phase") in {"started", "progress"}
                if label is not None and live_scan:
                    label.configure(
                        text=self._market_scan_status_line(),
                        fg=self.colors["teal"],
                    )
            self.root.after(0, apply_status)
        except (tk.TclError, RuntimeError):
            pass

    def _market_scan_status_line(self) -> str:
        progress = getattr(self, "_movement_scan_progress", {})
        if isinstance(progress, dict) and progress.get("phase") in {"started", "progress"}:
            return (
                f"SCAN IN PROGRESS · {int(progress.get('completed', 0) or 0):,}/"
                f"{int(progress.get('requested', 0) or 0):,} checked · "
                f"{int(progress.get('returned', 0) or 0):,} returned · "
                f"{int(progress.get('failed', 0) or 0):,} unavailable"
            )
        tracker = getattr(self, "_movement_tracker_payload", {})
        summary = movement_scan_summary(tracker if isinstance(tracker, dict) else {})
        latest = summary.get("latest") or {}
        if latest:
            requested = max(0, int(latest.get("requested_count", 0) or 0))
            returned = max(0, int(latest.get("returned_count", 0) or 0))
            failed = max(0, int(latest.get("failed_count", 0) or 0))
            stamp = self._movement_timestamp_label(summary.get("last_checked_at"))
            scope = str(latest.get("scope") or "scan")
            universe = max(0, int(latest.get("universe_count", 0) or 0))
            coverage = latest.get("batch_coverage_pct")
            coverage_text = f" · {coverage:.1f}% of universe requested" if isinstance(coverage, (int, float)) else ""
            cadence = max(
                float(getattr(self.config, "market_data_max_age_minutes", 5) or 5),
                AUTO_REFRESH_MS / 60_000,
            )
            full_pass = ""
            if universe and requested:
                batches = (universe + requested - 1) // requested
                hours = batches * cadence / 60
                full_pass = f" · nominal full pass ~{hours:.1f}h at current refresh cadence"
            return (
                f"LAST SCAN · {scope} · {stamp} · {returned:,}/{requested:,} returned · "
                f"{failed:,} unavailable{coverage_text}{full_pass}"
            )
        config = getattr(self, "config", None)
        provider = str(getattr(config, "market_data_provider", "csv") or "csv").upper()
        cadence = max(1, round(AUTO_REFRESH_MS / 60_000))
        return f"SCAN READY · {provider} · automatic refresh about every {cadence} min · F5 to scan now"

    def _record_movement_scan_progress(self, snapshot: dict) -> None:
        """Keep broad-scan progress visible while provider requests run."""
        progress = dict(snapshot)
        self._movement_scan_progress = progress
        phase = str(progress.get("phase", ""))
        completed = int(progress.get("completed", 0) or 0)
        requested = int(progress.get("requested", 0) or 0)
        returned = int(progress.get("returned", 0) or 0)
        failed = int(progress.get("failed", 0) or 0)
        if phase in {"started", "progress"}:
            self._set_status_from_worker(
                f"Scanning broad universe: {completed:,}/{requested:,} checked, "
                f"{returned:,} with bars, {failed:,} unavailable."
            )

    def refresh_data(self) -> None:
        if self._action_in_progress or self._refresh_in_progress:
            active = self._active_action_label if self._action_in_progress else "market refresh"
            self.status_bar.configure(text=f"Cannot refresh sample data while {active} is in progress.")
            return
        try:
            self.status_bar.configure(text="Refreshing sample data...")
            self.data_file.parent.mkdir(parents=True, exist_ok=True)
            write_sample_bars(self.data_file)
            self._mark_sample_data()
            self._refresh_payload(skip_market_refresh=True)
            self.status_bar.configure(text=f"Sample data refreshed at {self.data_file}")
        except Exception as exc:
            self.status_bar.configure(text=f"Data refresh failed: {exc}")

    def open_webull_profile(self) -> None:
        config = self._execution_config(self.config or self._load_config_safe())
        dialog = tk.Toplevel(self.root)
        dialog.title("Webull Profile")
        dialog.configure(bg=self.colors["panel"])
        dialog.transient(self.root)
        dialog.grab_set()
        dialog.resizable(False, False)

        frame = tk.Frame(dialog, bg=self.colors["panel"], padx=18, pady=16)
        frame.pack(fill="both", expand=True)
        tk.Label(
            frame,
            text="Webull Profile",
            bg=self.colors["panel"],
            fg=self.colors["text"],
            font=("Sans", 15, "bold"),
            anchor="w",
        ).grid(row=0, column=0, columnspan=2, sticky="ew", pady=(0, 10))
        tk.Label(
            frame,
            text="Stored locally on this machine. Do not paste broker credentials into chat.",
            bg=self.colors["panel"],
            fg=self.colors["muted"],
            font=("Sans", 9),
            anchor="w",
            justify="left",
            wraplength=420,
        ).grid(row=1, column=0, columnspan=2, sticky="ew", pady=(0, 12))

        values = {
            "WEBULL_APP_KEY": tk.StringVar(value=config.webull_app_key or ""),
            "WEBULL_APP_SECRET": tk.StringVar(value=config.webull_app_secret or ""),
            "WEBULL_ACCOUNT_ID": tk.StringVar(value=config.webull_account_id or ""),
            "WEBULL_REGION": tk.StringVar(value=config.webull_region or "us"),
            "WEBULL_API_ENDPOINT": tk.StringVar(value=config.webull_api_endpoint or ""),
            "WEBULL_ENABLE_LIVE_ORDERS": tk.BooleanVar(value=config.webull_enable_live_orders),
            "WEBULL_REQUIRE_PREVIEW": tk.BooleanVar(value=True),
            "TRADER_LIVE": tk.BooleanVar(value=config.trader_live),
            "AUTO_START_LIVE_ON_MARKET_OPEN": tk.BooleanVar(value=config.auto_start_live_on_market_open),
        }

        row = 2
        for key, label, secret in (
            ("WEBULL_APP_KEY", "App Key", False),
            ("WEBULL_APP_SECRET", "App Secret", True),
            ("WEBULL_ACCOUNT_ID", "Default Account ID", False),
            ("WEBULL_REGION", "Region", False),
            ("WEBULL_API_ENDPOINT", "API Endpoint", False),
        ):
            tk.Label(frame, text=label, bg=self.colors["panel"], fg=self.colors["muted"], anchor="w").grid(
                row=row, column=0, sticky="w", pady=4
            )
            entry = tk.Entry(
                frame,
                textvariable=values[key],
                width=42,
                bg=self.colors["entry"],
                fg=self.colors["text"],
                insertbackground=self.colors["text"],
                relief="flat",
                show="*" if secret else "",
                highlightbackground=self.colors["line"],
                highlightthickness=1,
            )
            entry.grid(row=row, column=1, sticky="ew", pady=4)
            row += 1

        for key, label in (
            ("WEBULL_ENABLE_LIVE_ORDERS", "Allow live order submission"),
            ("TRADER_LIVE", "Use live trading mode"),
            ("WEBULL_REQUIRE_PREVIEW", "Exact Webull preview required (mandatory)"),
            ("AUTO_START_LIVE_ON_MARKET_OPEN", "Auto-start live at market open"),
        ):
            check = tk.Checkbutton(
                frame,
                text=label,
                variable=values[key],
                bg=self.colors["panel"],
                fg=self.colors["text"],
                selectcolor=self.colors["panel_2"],
                activebackground=self.colors["panel"],
                activeforeground=self.colors["text"],
                font=("Sans", 9),
                anchor="w",
                justify="left",
            )
            check.grid(row=row, column=0, columnspan=2, sticky="ew", pady=2)
            if key == "WEBULL_REQUIRE_PREVIEW":
                check.configure(state=tk.DISABLED)
            row += 1

        button_row = tk.Frame(frame, bg=self.colors["panel"])
        button_row.grid(row=row, column=0, columnspan=2, sticky="e", pady=(14, 0))
        self._button(button_row, "×", dialog.destroy, tooltip="Cancel").pack(side="left", padx=(0, 8))
        self._button(
            button_row,
            "✓ Save",
            lambda: self._save_webull_profile_from_dialog(dialog, values),
            accent="teal",
            tooltip="Save verified account profile",
        ).pack(side="left")

        frame.columnconfigure(1, weight=1)
        dialog.update_idletasks()
        x = self.root.winfo_rootx() + max(0, (self.root.winfo_width() - dialog.winfo_width()) // 2)
        y = self.root.winfo_rooty() + max(0, (self.root.winfo_height() - dialog.winfo_height()) // 2)
        dialog.geometry(f"+{x}+{y}")

    def _save_webull_profile_from_dialog(self, dialog: tk.Toplevel, values: dict[str, tk.Variable]) -> None:
        app_key = values["WEBULL_APP_KEY"].get().strip()
        app_secret = values["WEBULL_APP_SECRET"].get().strip()
        account_id = values["WEBULL_ACCOUNT_ID"].get().strip()
        if not app_key or not app_secret:
            messagebox.showerror("Webull Profile", "App Key and App Secret are required.")
            return
        profile = self._profile_payload_from_values(values)
        if self._profile_fingerprint(profile) != self.verified_profile_fingerprint:
            messagebox.showerror("Webull Profile", "Verify Keys before saving this account.")
            return
        try:
            self._write_profile_env(profile)
        except OSError as exc:
            messagebox.showerror("Webull Profile", f"Profile save failed: {exc}")
            return
        self._apply_saved_profile(profile, account_id)
        dialog.destroy()

    def _write_profile_env(self, profile: dict[str, str]) -> None:
        path = self.home / ".timmy-profile.env"
        lines = [
            "# Timmy local Webull profile. Do not commit this file.",
            *[
                f"{key}={self._env_quote(value)}"
                for key, value in profile.items()
                if value != ""
            ],
            "",
        ]
        _write_private_text(path, "\n".join(lines))
        self._refresh_integrity_manifest()

    @staticmethod
    def _env_quote(value: str) -> str:
        escaped = value.replace("\\", "\\\\").replace('"', '\\"')
        return f'"{escaped}"'

    def save_webull_profile_from_setup(self) -> None:
        values = {
            "WEBULL_APP_KEY": self.profile_app_key_var,
            "WEBULL_APP_SECRET": self.profile_app_secret_var,
            "WEBULL_ACCOUNT_ID": self.profile_account_id_var,
            "WEBULL_REGION": self.profile_region_var,
            "WEBULL_API_ENDPOINT": self.profile_endpoint_var,
            "WEBULL_ENABLE_LIVE_ORDERS": self.profile_live_orders_var,
            "WEBULL_REQUIRE_PREVIEW": self.profile_require_preview_var,
            "TRADER_LIVE": self.profile_trader_live_var,
            "AUTO_START_LIVE_ON_MARKET_OPEN": self.profile_auto_live_var,
        }
        app_key = values["WEBULL_APP_KEY"].get().strip()
        app_secret = values["WEBULL_APP_SECRET"].get().strip()
        account_id = values["WEBULL_ACCOUNT_ID"].get().strip()
        if not app_key or not app_secret:
            self.status_bar.configure(text="Webull profile needs App Key and App Secret.")
            messagebox.showerror("Webull Profile", "App Key and App Secret are required.")
            return
        profile = self._profile_payload_from_values(values)
        if self._profile_fingerprint(profile) != self.verified_profile_fingerprint:
            self.status_bar.configure(text="Verify Keys before saving.")
            messagebox.showerror("Webull Profile", "Verify Keys before saving this account.")
            self._sync_profile_save_state()
            return
        try:
            self._write_profile_env(profile)
        except OSError as exc:
            self.status_bar.configure(text=f"Profile save failed: {exc}")
            messagebox.showerror("Webull Profile", f"Profile save failed: {exc}")
            return
        self._apply_saved_profile(profile, account_id)

    def verify_webull_profile(self) -> str:
        profile = self._current_profile_payload()
        app_key = profile.get("WEBULL_APP_KEY", "")
        app_secret = profile.get("WEBULL_APP_SECRET", "")
        account_id = profile.get("WEBULL_ACCOUNT_ID", "")
        if not app_key or not app_secret:
            self.verified_profile_fingerprint = None
            self.profile_verification_status = "Missing App Key or App Secret"
            self._sync_profile_save_state()
            raise RuntimeError("App Key and App Secret are required before verification.")
        if not account_id:
            self.verified_profile_fingerprint = None
            self.profile_verification_status = "Missing Account ID"
            self._sync_profile_save_state()
            raise RuntimeError("Default Account ID is required before verification.")
        config = self._config_from_profile(profile)
        broker = WebullOpenApiBroker(config)
        result = broker.account_list()
        choices = self._extract_webull_account_choices(result)
        if not choices:
            self.verified_profile_fingerprint = None
            self.profile_verification_status = "No Webull accounts returned"
            self._sync_profile_save_state()
            raise RuntimeError("Webull verification failed. No accounts were returned.")
        account_ids = {choice["id"] for choice in choices if choice.get("id")}
        if account_id and account_id not in account_ids:
            self.verified_profile_fingerprint = None
            self.profile_verification_status = f"Account {self._mask_account_id(account_id)} not found"
            self._sync_profile_save_state()
            raise RuntimeError("Webull verification failed. The entered account ID was not returned by Webull.")
        verified_account_id = account_id
        config = replace(config, webull_account_id=verified_account_id)
        self.webull_account_choices = choices
        self.selected_webull_account_id_var.set(verified_account_id)
        self.trade_cash_snapshot = self._extract_trade_cash(result, verified_account_id)
        self.trade_cash_value = self._numeric_money(self.trade_cash_snapshot[0])
        redacted = self._redact_accounts(result)
        self.account_snapshot = self._extract_account_summary(redacted, verified_account_id)
        self.verified_profile_fingerprint = self._profile_fingerprint(profile)
        self.profile_verification_status = (
            f"Verified {len(choices)} account(s); selected {self._mask_account_id(verified_account_id)}"
        )
        self._refresh_webull_account_menu(config)
        self._sync_profile_save_state()
        self._render_setup_status()
        return json.dumps(
            {
                "status": "verified",
                "accounts_found": len(choices),
                "selected_account": self._mask_account_id(verified_account_id),
                "cash_summary": {
                    "available": self.trade_cash_snapshot[0],
                    "source": self.trade_cash_snapshot[1],
                },
            },
            indent=2,
            sort_keys=True,
        )

    def _current_profile_payload(self) -> dict[str, str]:
        values = {
            "WEBULL_APP_KEY": self.profile_app_key_var,
            "WEBULL_APP_SECRET": self.profile_app_secret_var,
            "WEBULL_ACCOUNT_ID": self.profile_account_id_var,
            "WEBULL_REGION": self.profile_region_var,
            "WEBULL_API_ENDPOINT": self.profile_endpoint_var,
            "WEBULL_ENABLE_LIVE_ORDERS": self.profile_live_orders_var,
            "WEBULL_REQUIRE_PREVIEW": self.profile_require_preview_var,
            "TRADER_LIVE": self.profile_trader_live_var,
            "AUTO_START_LIVE_ON_MARKET_OPEN": self.profile_auto_live_var,
        }
        return self._profile_payload_from_values(values)

    def use_live_from_setup(self) -> None:
        self.webull_account_toggle_var.set(True)
        self._toggle_webull_account_target()
        self._render_setup_status()

    def open_setup_boilerplates(self) -> None:
        boilerplates_path = self.home / "docs" / "boilerplates"
        if not boilerplates_path.exists():
            self.status_bar.configure(text="Setup boilerplates are not installed in this checkout.")
            return
        try:
            subprocess.Popen(["xdg-open", str(boilerplates_path)])
        except OSError as exc:
            self.status_bar.configure(text=f"Could not open boilerplates: {exc}")
            return
        self.status_bar.configure(text="Setup boilerplates opened.")

    def _profile_payload_from_values(self, values: dict[str, tk.Variable]) -> dict[str, str]:
        return {
            "WEBULL_APP_KEY": values["WEBULL_APP_KEY"].get().strip(),
            "WEBULL_APP_SECRET": values["WEBULL_APP_SECRET"].get().strip(),
            "WEBULL_ACCOUNT_ID": values["WEBULL_ACCOUNT_ID"].get().strip(),
            "WEBULL_REGION": values["WEBULL_REGION"].get().strip() or "us",
            "WEBULL_API_ENDPOINT": values["WEBULL_API_ENDPOINT"].get().strip(),
            "WEBULL_ENABLE_LIVE_ORDERS": "1" if values["WEBULL_ENABLE_LIVE_ORDERS"].get() else "0",
            "WEBULL_REQUIRE_PREVIEW": "1",
            "TRADER_MODE": "live" if values["TRADER_LIVE"].get() else "paper",
            "TRADER_LIVE": "1" if values["TRADER_LIVE"].get() else "0",
            "AUTO_START_LIVE_ON_MARKET_OPEN": "1" if values["AUTO_START_LIVE_ON_MARKET_OPEN"].get() else "0",
        }

    def _config_from_profile(self, profile: dict[str, str]) -> BotConfig:
        config = self.config or self._load_config_safe()
        return replace(
            config,
            webull_app_key=profile.get("WEBULL_APP_KEY") or None,
            webull_app_secret=profile.get("WEBULL_APP_SECRET") or None,
            webull_account_id=profile.get("WEBULL_ACCOUNT_ID") or None,
            webull_region=profile.get("WEBULL_REGION") or "us",
            webull_api_endpoint=profile.get("WEBULL_API_ENDPOINT") or None,
            webull_enable_live_orders=profile.get("WEBULL_ENABLE_LIVE_ORDERS") == "1",
            webull_require_preview=True,
            trader_mode=profile.get("TRADER_MODE") or config.trader_mode,
            trader_live=profile.get("TRADER_LIVE") == "1",
            auto_start_live_on_market_open=profile.get("AUTO_START_LIVE_ON_MARKET_OPEN") == "1",
        )

    @staticmethod
    def _profile_fingerprint(profile: dict[str, str]) -> str:
        encoded = json.dumps(profile, sort_keys=True, separators=(",", ":")).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()

    def _apply_saved_profile(self, profile: dict[str, str], account_id: str) -> None:
        os.environ.update(profile)
        if account_id:
            self.selected_webull_account_id_var.set(account_id)
        self.previewed_order_fingerprints.clear()
        self.trade_cash_snapshot = ("-", "Run Account Check")
        self.trade_cash_value = None
        self.account_snapshot = ("Profile saved", "Run Account Check")
        self.execution_target_var.set("Paper")
        self.config = self._runtime_config(self._load_config_safe())
        self._sync_profile_form(self.config)
        self._save_runtime_settings()
        self._render_status()
        self._render_broker_summary()
        self._render_setup_status()
        self._set_text(
            self.broker_text,
            "Webull profile saved locally.\n\nRun Account Check to verify the account and buying power before enabling Live.",
        )
        self.status_bar.configure(text="Webull profile saved. Account Check required before Live.")
        self._sync_profile_save_state()

    def _sync_profile_form(self, config: BotConfig) -> None:
        self.profile_app_key_var.set(config.webull_app_key or "")
        self.profile_app_secret_var.set(config.webull_app_secret or "")
        self.profile_account_id_var.set(config.webull_account_id or "")
        self.profile_region_var.set(config.webull_region or "us")
        self.profile_endpoint_var.set(config.webull_api_endpoint or "")
        self.profile_live_orders_var.set(config.webull_enable_live_orders)
        self.profile_require_preview_var.set(True)
        self.profile_trader_live_var.set(config.trader_live)
        self.profile_auto_live_var.set(config.auto_start_live_on_market_open)
        self._refresh_webull_account_menu(config)

    def _render_setup_status(self) -> None:
        profile = self._current_profile_payload()
        config = self._execution_config(self._config_from_profile(profile))
        self._render_setup_badges(config)
        self._render_setup_guidance(profile, config)
        widget = getattr(self, "setup_status_text", None)
        if widget is None:
            return
        profile_path = self.home / ".timmy-profile.env"
        profile_verified = self._profile_fingerprint(profile) == self.verified_profile_fingerprint
        lines = [
            "Account notes",
            f"- Local profile: {'saved' if profile_path.exists() else 'not saved'}",
            f"- Verification: {self.profile_verification_status}",
            f"- App key: {'present' if config.webull_app_key else 'missing'}",
            f"- App secret: {'present' if config.webull_app_secret else 'missing'}",
            f"- Account: {self._mask_account_id(config.webull_account_id)}",
            f"- Account check: {self.trade_cash_snapshot[1]}",
            f"- Buying power: {self.trade_cash_snapshot[0]}",
            f"- Save gate: {'open' if profile_verified else 'locked'}",
            f"- Profile permissions: {self._runtime_file_mode_label(profile_path)}",
            f"- Integrity manifest: {self._runtime_file_mode_label(self.integrity_manifest_path)}",
            f"- Trade log guard: {self.audit_status}",
            f"- Live account mode: {'on' if config.trader_live else 'off'}",
            f"- Live order switch: {'on' if config.webull_enable_live_orders else 'off'}",
            f"- Live target: {self.execution_target_var.get()}",
        ]
        self._set_text(widget, "\n".join(lines))

    def _render_setup_guidance(self, profile: dict[str, str], config: BotConfig) -> None:
        profile_verified = self._profile_fingerprint(profile) == self.verified_profile_fingerprint
        broker_checked = bool(config.webull_account_id) and not self._broker_check_required(config)
        live_ready = self._live_ready(config) and self.execution_target_var.get() == "Live" and broker_checked

        next_action = getattr(self, "setup_next_action_label", None)
        if next_action is not None:
            color = self.colors["teal"] if live_ready else self.colors["gold"]
            next_action.configure(text=self._setup_next_action(config), fg=color)

        field_status = getattr(self, "profile_field_status_labels", {})
        field_values = {
            "App Key": ("Verified" if profile_verified else ("Present" if profile.get("WEBULL_APP_KEY") else "Missing")),
            "App Secret": ("Verified" if profile_verified else ("Present" if profile.get("WEBULL_APP_SECRET") else "Missing")),
            "Account ID": (
                "Verified" if profile_verified else ("Present" if profile.get("WEBULL_ACCOUNT_ID") else "Missing")
            ),
            "Region": "Ready" if profile.get("WEBULL_REGION") else "Default",
            "Endpoint": "Ready" if profile.get("WEBULL_API_ENDPOINT") else "Default",
        }
        for label, value in field_values.items():
            widget = field_status.get(label)
            if widget is None:
                continue
            if value in {"Verified", "Ready"}:
                color = self.colors["teal"]
            elif value in {"Missing"}:
                color = self.colors["red"]
            else:
                color = self.colors["gold"]
            widget.configure(text=value, fg=color)

        readiness = getattr(self, "setup_readiness_labels", {})
        readiness_values = {
            "Draft": ("Complete" if config.webull_app_key and config.webull_app_secret and config.webull_account_id else "Needs fields"),
            "Verify": ("Passed" if profile_verified else self.profile_verification_status),
            "Save": ("Enabled" if profile_verified else "Locked"),
            "Account": ("Checked" if broker_checked else self.trade_cash_snapshot[1]),
            "Live": ("Armed" if live_ready else "Guarded"),
        }
        for label, value in readiness_values.items():
            widget = readiness.get(label)
            if widget is None:
                continue
            good = value in {"Complete", "Passed", "Enabled", "Checked", "Armed"}
            caution = value in {"Locked", "Guarded", "Needs fields"} or "Missing" in str(value) or "Run" in str(value)
            color = self.colors["teal"] if good else (self.colors["gold"] if caution else self.colors["muted"])
            if label == "Live" and value == "Armed":
                color = self.colors["red"]
            widget.configure(text=value, fg=color)
        account_labels = getattr(self, "setup_account_labels", {})
        paper_cash_value, _paper_cash_detail = self._paper_account_snapshot()
        account_values = {
            "Account": self._webull_account_card_value(config),
            "Cash Account": self.trade_cash_snapshot[0],
            "Paper Account": paper_cash_value,
            "Status": "Fresh" if broker_checked else "Check",
        }
        for label, value in account_values.items():
            widget = account_labels.get(label)
            if widget is None:
                continue
            color = self.colors["teal"] if value in {"Fresh"} else (self.colors["gold"] if value in {"Check", "-"} else self.colors["text"])
            widget.configure(text=value, fg=color)

    def _runtime_file_mode_label(self, path: Path) -> str:
        if not path.exists():
            return "missing"
        try:
            return oct(path.stat().st_mode & 0o777)
        except OSError:
            return "unreadable"

    def _render_setup_badges(self, config: BotConfig) -> None:
        badges = getattr(self, "setup_badges", None)
        if not badges:
            return
        profile_saved = (self.home / ".timmy-profile.env").exists()
        credentials_ok = self._profile_fingerprint(self._current_profile_payload()) == self.verified_profile_fingerprint
        account_ok = bool(config.webull_account_id) and not self._broker_check_required(config)
        live_ok = self._live_ready(config) and self.execution_target_var.get() == "Live" and account_ok
        values = {
            "Profile": ("Saved" if profile_saved else "Draft", self.colors["teal"] if profile_saved else self.colors["gold"]),
            "Keys": ("Verified" if credentials_ok else "Verify", self.colors["teal"] if credentials_ok else self.colors["gold"]),
            "Account": ("Checked" if account_ok else "Check", self.colors["teal"] if account_ok else self.colors["gold"]),
            "Cash": (self.trade_cash_snapshot[0], self.colors["teal"] if account_ok else self.colors["gold"]),
            "Live": ("Armed" if live_ok else "Guarded", self.colors["red"] if live_ok else self.colors["muted"]),
        }
        for label, (_title, value_label) in badges.items():
            value, color = values[label]
            value_label.configure(text=value, fg=color)

    def _setup_next_action(self, config: BotConfig) -> str:
        if not config.webull_app_key or not config.webull_app_secret:
            return "Enter the Webull App Key and App Secret, then run Verify Keys."
        if not config.webull_account_id:
            return "Enter or select a Webull account, then run Verify Keys."
        if self._profile_fingerprint(self._current_profile_payload()) != self.verified_profile_fingerprint:
            return "Verify Keys must pass before Save Account opens."
        if self._broker_check_required(config):
            return "Run Account Check to refresh buying power before Live."
        if not self._live_ready(config):
            return "Turn on live account mode and live order submission if this account should trade live."
        if self.execution_target_var.get() != "Live":
            return "Use Live after Account Check if this account should place real orders."
        return "Account desk is ready for guarded live trading."

    def webull_check(self) -> str:
        config = self._execution_config(self._load_config_safe())
        broker = WebullOpenApiBroker(config)
        result = broker.account_snapshot()
        self.webull_account_choices = self._extract_webull_account_choices(result)
        self._refresh_webull_account_menu(config)
        self.trade_cash_snapshot = self._extract_trade_cash(result, config.webull_account_id)
        self.trade_cash_value = self._numeric_money(self.trade_cash_snapshot[0])
        redacted = self._redact_accounts(result)
        self.account_snapshot = self._extract_account_summary(redacted, config.webull_account_id)
        redacted["cash_summary"] = {
            "available": self.trade_cash_snapshot[0],
            "source": self.trade_cash_snapshot[1],
        }
        redacted["account_summary"] = {
            "label": self.account_snapshot[0],
            "source": self.account_snapshot[1],
        }
        return json.dumps(redacted, indent=2, sort_keys=True)

    def webull_preview(self) -> str:
        self._refresh_payload()
        config = self._load_config_safe()
        return self._preview_current_plans(config)

    def preview_selected_target(self) -> str:
        """Preview locally for Paper/Simulation, using Webull only for Live."""
        target = self.execution_target_var.get()
        if target == "Live":
            result = self.webull_preview()
            return f"TARGET: LIVE · WEBULL PREVIEW\n{result}"
        return self._preview_local_plans(target)

    def _preview_local_plans(self, target: str | None = None, plans_override: list | None = None) -> str:
        target = target or self.execution_target_var.get()
        if target not in {"Paper", "Simulation"}:
            raise ValueError("Local preview is available only for Paper or Simulation targets.")
        plans = list(self.plans[: self.plan_limit_value] if plans_override is None else plans_override)
        if not plans:
            return f"TARGET: {target.upper()} · No executable plans are loaded. Run a cycle first."
        now = datetime.now()
        self.local_preview_fingerprints = {}
        rows = []
        for plan in plans:
            fingerprint = self._order_fingerprint(plan, self._latest_candle_timestamp(plan.symbol))
            preview_id = uuid4().hex
            self.local_preview_fingerprints[fingerprint] = {
                "previewed_at": now,
                "target": target,
                "preview_id": preview_id,
            }
            rows.append({"preview_id": preview_id, "plan": asdict(plan)})
        return json.dumps({
            "target": target,
            "preview_type": "local plan snapshot",
            "created_at": now.isoformat(),
            "market_data_note": "Uses the already loaded daily candles; no broker request or fresh provider request is made.",
            "orders": rows,
        }, indent=2, sort_keys=True)

    def simulate_current_plans(self, plans_override: list | None = None) -> str:
        if self.execution_target_var.get() != "Simulation":
            raise RuntimeError("Select Simulation target before submitting a local simulation.")
        plans = list(self.plans[: self.plan_limit_value] if plans_override is None else plans_override)
        if not plans:
            return "TARGET: SIMULATION · No executable plans are loaded. No event was written."
        now = datetime.now()
        missing = []
        preview_rows = {}
        for plan in plans:
            fingerprint = self._order_fingerprint(plan, self._latest_candle_timestamp(plan.symbol))
            preview = self.local_preview_fingerprints.get(fingerprint)
            previewed_at = preview.get("previewed_at") if preview else None
            if (
                not isinstance(previewed_at, datetime)
                or preview.get("target") != "Simulation"
                or (now - previewed_at).total_seconds() > LIVE_PREVIEW_TTL_SECONDS
            ):
                missing.append(plan.symbol)
            else:
                preview_rows[fingerprint] = preview
        if missing:
            raise RuntimeError("Simulation submit blocked; preview the current Simulation plan first: " + ", ".join(missing))

        broker = SimulationBroker(str(self.simulation_journal_path))
        results = []
        for plan in plans:
            fingerprint = self._order_fingerprint(plan, self._latest_candle_timestamp(plan.symbol))
            context = self._paper_context_for_plan(plan)
            context["simulation_preview_id"] = preview_rows[fingerprint]["preview_id"]
            event = broker.submit(plan, context)
            self._append_execution_event(event)
            results.append(event)
        self._load_journal()
        return json.dumps({
            "target": "Simulation",
            "broker_request_sent": False,
            "journal": str(self.simulation_journal_path),
            "fill_model": "Daily OHLC target/stop threshold; stop-first if both touched.",
            "data_limit": "Daily candles are delayed/coarse and cannot model intraday fills, slippage, queue position, or broker fees.",
            "events": results,
        }, indent=2, sort_keys=True)

    def _has_local_preview(self, plan, target: str) -> bool:
        fingerprint = self._order_fingerprint(plan, self._latest_candle_timestamp(plan.symbol))
        preview = self.local_preview_fingerprints.get(fingerprint)
        previewed_at = preview.get("previewed_at") if preview else None
        return bool(
            isinstance(previewed_at, datetime)
            and preview.get("target") == target
            and (datetime.now() - previewed_at).total_seconds() <= LIVE_PREVIEW_TTL_SECONDS
        )

    def submit_selected_target(self) -> None:
        target = self.execution_target_var.get()
        if target == "Live":
            self.submit_live_interactive()
            return
        if target == "Simulation":
            self._run_action("Submitting Simulation", self.simulate_current_plans, threaded=False)
            return
        self._run_action("Submitting Paper", self._submit_paper_target, threaded=False)

    def _submit_paper_target(self) -> str:
        if self.execution_target_var.get() != "Paper":
            raise RuntimeError("Select Paper target before submitting Paper trades.")
        return "TARGET: PAPER · LOCAL PAPER LEDGER\n" + self.paper_trade()

    def _on_execution_target_selected(self) -> None:
        # A radio selection is an explicit operator choice. Let an in-flight
        # operation return, but do not continue the automation batch under the
        # former target.
        if self._automation_cycle_in_progress and self._automation_cancel_event is not None:
            self._automation_cancel_event.set()
        if self._automatic_fallback_active:
            self._clear_automatic_fallback(keep_manual=True)
        self.previewed_order_fingerprints.clear()
        self.local_preview_fingerprints.clear()
        if self.config is not None and self.signals:
            self.plans = self._load_plans(self.config)
            self._render_plans()
            self._render_status()
            self._render_broker_summary()
        self._sync_manual_controls()
        self._render_automation_panel()
        if self._automation_enabled():
            self._schedule_automation()
        elif self.automation_after_id:
            try:
                self.root.after_cancel(self.automation_after_id)
            except tk.TclError:
                pass
            self.automation_after_id = None
            self._automation_next_run_at = None
        self.status_bar.configure(text=f"Execution target selected: {self.execution_target_var.get()}.")

    def _sync_execution_target_controls(self) -> None:
        target = self.execution_target_var.get()
        if target not in {"Paper", "Simulation", "Live"}:
            target = "Paper"
        submit_button = getattr(self, "execution_submit_button", None)
        preview_button = getattr(self, "execution_preview_button", None)
        if submit_button is not None:
            submit_button.configure(text=f"Submit {target}")
        if preview_button is not None:
            preview_button.configure(text=f"Preview {target}")

    def _preview_current_plans(self, config: BotConfig, plans_override: list | None = None) -> str:
        config = self._execution_config(config)
        plans = list(self.plans if plans_override is None else plans_override)
        if not plans:
            return "No executable plans at current controls. Refresh or lower Min Score."
        broker = WebullOpenApiBroker(config)
        results = [broker.preview_order(plan) for plan in plans[: self.plan_limit_value]]
        now = datetime.now()
        self.previewed_order_fingerprints = {}
        for plan, result in zip(plans[: self.plan_limit_value], results):
            request_payload = result.get("request_payload") or {}
            orders = request_payload.get("new_orders") if isinstance(request_payload, dict) else None
            client_order_id = (
                str(orders[0].get("client_order_id") or "")
                if isinstance(orders, list) and orders and isinstance(orders[0], dict)
                else ""
            )
            # Don't mark non-preview/error responses as a usable preview.
            try:
                preview_status = int(result.get("status_code") or 0)
            except (TypeError, ValueError):
                preview_status = 0
            if (
                not client_order_id
                or not 200 <= preview_status < 300
                or self._webull_preview_body_has_error(result.get("body"))
            ):
                continue
            self.previewed_order_fingerprints[
                self._order_fingerprint(plan, self._latest_candle_timestamp(plan.symbol))
            ] = {
                "previewed_at": now,
                "account_id": config.webull_account_id,
                "target": self.execution_target_var.get(),
                "cash": self.trade_cash_snapshot[0],
                "client_order_id": client_order_id,
            }
        return json.dumps(results, indent=2, sort_keys=True)

    @staticmethod
    def _webull_preview_body_has_error(body) -> bool:
        """Fail closed on explicit business-level error/rejection fields."""
        error_words = ("error", "reject", "invalid", "insufficient", "unsupported", "not supported", "failed", "failure")
        if isinstance(body, dict):
            for key, value in body.items():
                normalized_key = str(key).strip().lower()
                normalized_value = str(value).strip().lower() if value is not None else ""
                if normalized_key in {"success", "ok"} and (
                    value is False or normalized_value in {"false", "no", "0"}
                ):
                    return True
                if normalized_key in {"error", "error_msg", "error_message", "error_code", "errorcode", "errcode"}:
                    if value not in (None, False, "", 0, "0", "none", "null"):
                        return True
                if normalized_key in {"code", "status", "status_code", "statuscode", "retcode", "result_code", "resultcode"}:
                    if normalized_key not in {"status", "status_code", "statuscode"}:
                        try:
                            zero_code = int(value) == 0
                        except (TypeError, ValueError):
                            zero_code = normalized_value in {"", "ok", "success", "none", "null"}
                        if not zero_code and normalized_value not in {"200", "ok", "success"}:
                            return True
                    if any(word in normalized_value for word in error_words):
                        return True
                if normalized_key in {"message", "msg", "detail", "reason"} and any(
                    word in normalized_value for word in error_words
                ):
                    return True
                if isinstance(value, str) and any(word in normalized_value for word in error_words):
                    return True
                if isinstance(value, (dict, list)) and TimmyNativeApp._webull_preview_body_has_error(value):
                    return True
            return False
        if isinstance(body, list):
            return any(TimmyNativeApp._webull_preview_body_has_error(item) for item in body)
        if isinstance(body, str):
            lowered = body.lower()
            return any(word in lowered for word in error_words)
        return False

    @staticmethod
    def _preview_estimated_cost(body):
        """Read a documented preview cost field without guessing from price."""
        cost_keys = {"estimated_cost", "estimatedcost", "estimated_margin", "estimatedmargin"}
        if isinstance(body, dict):
            for key, value in body.items():
                if str(key).lower() in cost_keys:
                    try:
                        parsed = float(value)
                    except (TypeError, ValueError):
                        continue
                    if math.isfinite(parsed):
                        return parsed
            for value in body.values():
                found = TimmyNativeApp._preview_estimated_cost(value)
                if found is not None:
                    return found
        elif isinstance(body, list):
            for value in body:
                found = TimmyNativeApp._preview_estimated_cost(value)
                if found is not None:
                    return found
        return None

    def paper_trade(
        self,
        refresh: bool = True,
        refresh_after: bool = True,
        plans_override: list | None = None,
    ) -> str:
        if refresh:
            self._refresh_payload()
        plans = list(self.plans if plans_override is None else plans_override)
        if not plans:
            return "No executable plans at current controls. Nothing was journaled."
        broker = PaperBroker(str(self.journal_path))
        results = [
            broker.submit(plan, self._paper_context_for_plan(plan))
            for plan in plans[: self.plan_limit_value]
        ]
        for result in results:
            self._append_execution_event(result)
        if refresh_after:
            self._refresh_payload()
        return json.dumps(results, indent=2, sort_keys=True)

    def submit_live_interactive(self) -> None:
        self.execution_target_var.set("Live")
        if not self.plans:
            self.refresh_all()
        if not self.plans:
            self._set_text(self.broker_text, "No executable plans at current controls. Live order was not submitted.")
            return
        mode = self.execution_mode_var.get()
        if mode == "User" and not messagebox.askyesno("Submit live order", self._live_confirmation_text()):
            self.status_bar.configure(text="Live submission cancelled.")
            return
        self._run_action("Submitting live order", self.live_submit, threaded=False)

    def power_cycle(self) -> None:
        if not messagebox.askyesno("Power cycle Timmy", "Restart Timmy now?"):
            self.status_bar.configure(text="Power cycle cancelled.")
            return
        self._save_runtime_settings()
        env = os.environ.copy()
        env["TIMMY_HOME"] = str(self.home)
        try:
            with Path("/tmp/timmy-launch.log").open("ab") as log:
                subprocess.Popen(
                    _restart_command(self.home),
                    cwd=str(self.home),
                    env=env,
                    stdout=log,
                    stderr=subprocess.STDOUT,
                    start_new_session=True,
                    close_fds=True,
                )
        except Exception as exc:
            self._write_crash_log(
                f"Power cycle failed\n{''.join(traceback.format_exception(type(exc), exc, exc.__traceback__))}"
            )
            self.status_bar.configure(text=f"Power cycle failed: {exc}")
            return
        self.status_bar.configure(text="Power cycling Timmy...")
        self.root.after(250, self.close)

    def live_preview_then_submit(
        self,
        refresh: bool = True,
        plans_override: list | None = None,
        scheduled_automation: bool = False,
    ) -> str:
        # The live lane now owns one broker adapter from exact preview through
        # submission, so its in-memory receipt cannot be lost between clients.
        return self.live_submit(refresh=refresh, plans_override=plans_override,
                                scheduled_automation=scheduled_automation)

    def live_submit(
        self,
        refresh: bool = True,
        plans_override: list | None = None,
        scheduled_automation: bool = False,
    ) -> str:
        if refresh:
            self._refresh_payload()
        config = self._execution_config(self._load_config_safe())
        self._plan_limit(config)
        plans = list(self.plans if plans_override is None else plans_override)
        if not plans:
            return "No executable plans at current controls. Live order was not submitted."
        if not self._live_ready(config):
            raise RuntimeError("Live order blocked: Live account mode and Webull live order switch must both be enabled.")
        if self._broker_check_required(config):
            raise RuntimeError("Live order blocked: run Account Check and confirm buying power before trading.")
        if self.execution_mode_var.get() == "Auto" and not config.auto_start_live_on_market_open:
            raise RuntimeError("Live Auto blocked: enable and save the explicit Live Auto opt-in in the Webull profile first.")
        if scheduled_automation and not config.auto_start_live_on_market_open:
            raise RuntimeError("Scheduled Live Auto blocked: the saved Live Auto opt-in is off.")
        plans = plans[: self.plan_limit_value]
        # Recheck each signal and its current operational limits immediately
        # before broker work. This includes data age, market hours, daily loss,
        # trade count, cooldown, cash cap, recent rejects, and unresolved IDs.
        signal_by_symbol = {
            signal.symbol.upper(): signal
            for signal in (*self.signals, *getattr(self, "movement_candidate_signals", []))
        }
        for plan in plans:
            if plan.instrument_type != "EQUITY" or plan.market != "US":
                raise RuntimeError(f"Live Auto currently supports US equities and ETFs only; {plan.symbol} was not submitted.")
            signal = signal_by_symbol.get(plan.symbol.upper())
            if signal is None:
                raise RuntimeError(f"Live order blocked: no current signal is available for {plan.symbol}.")
            blockers = self._operational_blocks(signal, config)
            if blockers:
                raise RuntimeError(f"Live order blocked for {plan.symbol}: " + "; ".join(blockers))
            if plan.notional > config.max_order_notional_usd:
                raise RuntimeError(f"Live order blocked for {plan.symbol}: plan notional exceeds the configured per-order cap.")
        self._ensure_execution_journal_writable()
        enforce_live_guards(config)
        broker = WebullOpenApiBroker(config)
        broker.connect()
        results = []
        for plan in plans:
            order_request = broker.new_order_payload(plan)
            client_order_id = order_request["client_order_id"]
            preview = broker.preview_order_payloads([order_request])
            estimated_cost = self._preview_estimated_cost(preview.get("body"))
            if (not preview.get("preview_ok") or estimated_cost is None or estimated_cost < 0
                    or estimated_cost > config.max_order_notional_usd):
                results.append({
                    "status": "preview-blocked",
                    "symbol": plan.symbol,
                    "client_order_id": client_order_id,
                    "preview_ok": bool(preview.get("preview_ok")),
                    "estimated_cost": estimated_cost,
                    "risk_cap": config.max_order_notional_usd,
                    "message": "No order was submitted because an exact successful preview and an in-cap estimated cost are required.",
                    "preview_response": redact(preview),
                })
                break
            # Persist intent first. A crash or lost response after the broker
            # call then leaves a durable unresolved record instead of allowing
            # a duplicate submission on the next launch.
            self._append_execution_event({
                "mode": "live",
                "robot": "Timmy",
                "event_type": "live-order-intent",
                "status": "pending-submit",
                "symbol": plan.symbol.upper(),
                "automation_scheduled": bool(scheduled_automation),
                "automation_candle_timestamp": self._latest_candle_timestamp(plan.symbol),
                "client_order_id": client_order_id,
                "quantity": plan.quantity,
                "buy_price": plan.limit_price,
                "order_type": plan.order_type,
                "preview_fingerprint": preview.get("preview_fingerprint"),
                "estimated_cost": estimated_cost,
                "recorded_at": datetime.now().isoformat(),
            })
            result = broker.submit_previewed_order_payloads(
                [order_request], preview.get("preview_fingerprint") or "")
            result["order_plan"] = asdict(plan)
            try:
                live_event = self._event_from_broker_result(result, mode="live")
                live_event["automation_scheduled"] = bool(scheduled_automation)
                live_event["automation_candle_timestamp"] = self._latest_candle_timestamp(plan.symbol)
                live_event["before_submit_failure"] = bool(result.get("before_submit_failure"))
                self._append_execution_event(live_event)
            except Exception as exc:
                # Stop the batch immediately. The broker call has happened, so
                # an unpersisted response must be reconciled before any retry.
                broker_status = self._broker_event_status(result)
                result["timmy_broker_status"] = broker_status
                result["timmy_journal_error"] = str(exc) or exc.__class__.__name__
                result["status"] = "unknown" if broker_status in {"accepted", "submitted", "unknown"} else broker_status
                request = result.get("request_payload") or {}
                orders = request.get("new_orders") if isinstance(request, dict) else None
                client_id = (orders[0].get("client_order_id") if isinstance(orders, list) and orders
                             and isinstance(orders[0], dict) else "unknown")
                self._write_crash_log(
                    f"CRITICAL: live order response could not be durably journaled; "
                    f"symbol={plan.symbol.upper()} client_order_id={client_id} "
                    f"broker_status={broker_status} journal_error={result['timmy_journal_error']}"
                )
                results.append(result)
                break
            results.append(result)
            if self._broker_event_status(result) == "unknown":
                # Do not continue submitting a batch while a broker outcome is
                # unresolved. The operator must reconcile this client order ID.
                break
            if result.get("before_submit_failure"):
                # The broker adapter failed before calling place_order. The
                # signed failed result resolves this intent and permits a later
                # Auto cycle to retry the current candle without duplication.
                break
        self._update_buying_power_from_broker_results(results)
        self._render_status()
        return "TARGET: LIVE · WEBULL · exact preview → risk check → durable intent → one submit → journal/reconcile\n" + json.dumps(results, indent=2, sort_keys=True)

    def _make_live_automation_job(
        self,
        prepared: AutomationMarketSnapshot,
        plans: list[OrderPlan],
        cancelled: threading.Event,
    ) -> LiveAutomationJob:
        """Validate on Tk, then serialize inputs for a broker-only worker."""
        if cancelled.is_set() or self.execution_target_var.get() != "Live" or self.execution_mode_var.get() != "Auto":
            raise RuntimeError("Live Auto was cancelled before a broker request started.")
        if not plans:
            raise RuntimeError("There are no new eligible Live Auto plans.")
        config = self._execution_config(self.config or prepared.config)
        risk_limits = self._configured_automation_risk_limits(config)
        if not self._live_ready(config):
            raise RuntimeError("Live Auto requires enabled Live account and Webull order switches.")
        if not config.auto_start_live_on_market_open:
            raise RuntimeError("Live Auto requires the saved Live Auto opt-in.")
        if self._broker_check_required(config):
            raise RuntimeError("Run Account Check before automated Live orders.")
        block_reason = self._live_auto_block_reason()
        if block_reason:
            raise RuntimeError(block_reason)
        signal_by_symbol = {
            signal.symbol.upper(): signal
            for signal in (*self.signals, *getattr(self, "movement_candidate_signals", []))
        }
        selected_plans = plans[: self.plan_limit_value]
        selected_signals: list[Signal] = []
        selected_quality: list[dict | None] = []
        activity_blocks: list[tuple[str, ...]] = []
        last_trade_timestamps: list[str] = []
        prepared_bars = {symbol.upper(): bars for symbol, bars in prepared.bars_by_symbol}
        for plan in selected_plans:
            if plan.instrument_type != "EQUITY" or plan.market != "US":
                raise RuntimeError(f"Live Auto currently supports US equities and ETFs only; {plan.symbol} was not submitted.")
            signal = signal_by_symbol.get(plan.symbol.upper())
            if signal is None:
                raise RuntimeError(f"Live order blocked: no current signal is available for {plan.symbol}.")
            selected_signals.append(signal)
            bars = prepared_bars.get(plan.symbol.upper(), ())
            quality = self._automation_daily_data_quality(plan.symbol, bars)
            quality_payload = asdict(quality) if quality is not None else None
            if quality_payload and quality_payload.get("latest_at") is not None:
                quality_payload["latest_at"] = quality_payload["latest_at"].isoformat()
            selected_quality.append(quality_payload)
            today_events = self._today_execution_events()
            blocks = []
            if self._recent_bad_events(plan.symbol) >= config.max_recent_rejections:
                blocks.append(f"{plan.symbol} recent rejected/failed events reached {config.max_recent_rejections}.")
            if self._count_trade_events(today_events) >= config.max_daily_trades:
                blocks.append(f"Daily trade cap reached ({config.max_daily_trades}).")
            if self._count_trade_events(today_events, plan.symbol.upper()) >= config.max_symbol_daily_trades:
                blocks.append(f"{plan.symbol} daily trade cap reached ({config.max_symbol_daily_trades}).")
            activity_blocks.append(tuple(blocks))
            latest_event = self._latest_symbol_event(self.execution_events, plan.symbol.upper())
            last_trade_timestamps.append(latest_event.isoformat() if latest_event else "")
        self._ensure_execution_journal_writable()
        frozen_config = self._freeze_config_snapshot(config)
        return LiveAutomationJob(
            config=frozen_config,
            risk_limits=risk_limits,
            plan_json=tuple(json.dumps(asdict(plan), sort_keys=True, separators=(",", ":")) for plan in selected_plans),
            signal_json=tuple(json.dumps(asdict(signal), sort_keys=True, separators=(",", ":")) for signal in selected_signals),
            data_quality_json=tuple(json.dumps(item, sort_keys=True, separators=(",", ":")) if item is not None else "null"
                                    for item in selected_quality),
            activity_blocks=tuple(activity_blocks),
            last_symbol_trade_json=tuple(last_trade_timestamps),
            candle_timestamps=tuple(self._latest_candle_timestamp(plan.symbol) or "" for plan in selected_plans),
            cancelled=cancelled,
        )

    @staticmethod
    def _configured_automation_risk_limits(config: BotConfig) -> AutomationRiskLimits:
        values = (
            ("AUTO_MAX_SYMBOL_EXPOSURE_PCT", config.automation_max_symbol_exposure_pct),
            ("AUTO_MAX_TOTAL_EXPOSURE_PCT", config.automation_max_total_exposure_pct),
            ("AUTO_MAX_DRAWDOWN_PCT", config.automation_max_drawdown_pct),
        )
        missing = [name for name, value in values
                   if not math.isfinite(float(value)) or not 0 < float(value) <= 100]
        if missing:
            raise RuntimeError("Live Auto risk policy is not configured. Set values from 0 to 100 (exclusive of 0) for: "
                               + ", ".join(missing))
        return AutomationRiskLimits(
            max_symbol_exposure_pct=float(config.automation_max_symbol_exposure_pct),
            max_total_exposure_pct=float(config.automation_max_total_exposure_pct),
            max_drawdown_pct=float(config.automation_max_drawdown_pct),
        )

    @staticmethod
    def _automation_daily_data_quality(symbol: str, bars) -> object | None:
        """Evaluate daily bars using trading-session gaps, not weekend gaps."""
        if not bars:
            return None
        report = summarize_candle_quality(bars, interval_minutes=1440, stale_after_minutes=4320)
        item = next((quality for quality in report.symbols if quality.symbol.upper() == symbol.upper()), None)
        if item is None:
            return None
        missing_sessions = 0
        eastern = ZoneInfo("America/New_York")
        for earlier, later in zip(sorted(bars, key=lambda bar: bar.timestamp),
                                  sorted(bars, key=lambda bar: bar.timestamp)[1:]):
            day = earlier.timestamp.date() + timedelta(days=1)
            end_day = later.timestamp.date()
            while day < end_day:
                noon = datetime.combine(day, datetime.min.time().replace(hour=12), tzinfo=eastern)
                if market_session(noon).is_open:
                    missing_sessions += 1
                day += timedelta(days=1)
        if item.invalid_ohlc_bars or item.duplicate_timestamps or missing_sessions:
            label = "CHECK DATA"
        elif item.age_minutes is None or item.age_minutes >= 4320:
            label = "STALE"
        elif item.age_minutes >= 2160:
            label = "AGING"
        else:
            label = "CURRENT"
        return replace(item, label=label, missing_bars_estimate=missing_sessions)

    def _automation_account_metric(self, sources, aliases: tuple[str, ...]) -> float | None:
        for alias in aliases:
            normalized_alias = "".join(character for character in alias.lower() if character.isalnum())
            for source in sources:
                for path, value in self._walk_items(source):
                    normalized_path = "".join(character for character in path.lower() if character.isalnum())
                    if normalized_path == normalized_alias or normalized_path.endswith(normalized_alias):
                        parsed = self._numeric_money(value)
                        if parsed is not None and math.isfinite(parsed):
                            return parsed
        return None

    def _automation_peak_equity(self, account_id: str | None, current_equity: float) -> float:
        """Maintain a private high-water mark per account, without storing IDs."""
        if not account_id:
            raise RuntimeError("Configured account ID is unavailable for the drawdown baseline.")
        key = hashlib.sha256(str(account_id).encode("utf-8")).hexdigest()
        path = self.automation_risk_state_path
        try:
            raw = path.read_text(encoding="utf-8")
        except FileNotFoundError:
            state = {"schema": 1, "accounts": {}}
        except (OSError, UnicodeError) as exc:
            raise RuntimeError("Stored automation drawdown state is unreadable; repair it before Live Auto.") from exc
        else:
            try:
                state = json.loads(raw)
            except json.JSONDecodeError as exc:
                raise RuntimeError("Stored automation drawdown state is malformed; repair it before Live Auto.") from exc
            if not isinstance(state, dict) or state.get("schema") != 1 or not isinstance(state.get("accounts"), dict):
                raise RuntimeError("Stored automation drawdown state has an unsupported shape; repair it before Live Auto.")
        accounts = state["accounts"]
        record = accounts.get(key)
        if record is None:
            peak = current_equity
        elif isinstance(record, dict):
            try:
                peak = float(record.get("peak_equity"))
            except (TypeError, ValueError):
                raise RuntimeError("Stored account drawdown baseline is invalid; repair it before Live Auto.") from None
            if not math.isfinite(peak) or peak <= 0:
                raise RuntimeError("Stored account drawdown baseline is invalid; repair it before Live Auto.")
            peak = max(peak, current_equity)
        else:
            raise RuntimeError("Stored account drawdown baseline is invalid; repair it before Live Auto.")
        accounts[key] = {"peak_equity": round(peak, 2), "updated_at": datetime.now().astimezone().isoformat()}
        _write_private_json(path, {"schema": 1, "accounts": accounts})
        return peak

    @staticmethod
    def _automation_response_rows(value, name: str) -> list[dict]:
        if not isinstance(value, dict) or value.get("ok") is False:
            raise RuntimeError(f"Webull {name} snapshot is unavailable.")
        try:
            code = int(value.get("status_code") or 0)
        except (TypeError, ValueError):
            code = 0
        if not 200 <= code < 300:
            raise RuntimeError(f"Webull {name} snapshot returned an unverified response.")
        payload = value.get("body")
        if isinstance(payload, dict):
            names = ("orders", "items", "data") if name == "open orders" else ("positions", "items", "data")
            nested = next((payload[key] for key in names if key in payload), None)
            if nested is not None:
                payload = nested
            elif any(key in payload for key in ("symbol", "ticker", "instrumentSymbol")):
                payload = [payload]
        if not isinstance(payload, list) or any(not isinstance(row, dict) for row in payload):
            raise RuntimeError(f"Webull {name} snapshot shape is unsupported; Live Auto is held for safety.")
        return payload

    def _run_live_automation_job(self, job: LiveAutomationJob) -> LiveAutomationWorkerResult:
        """Perform preview, placement, and durable journaling without touching Tk."""
        results: list[dict] = []
        risk_decision_for_view: AutomationRiskDecision | None = None
        if job.cancelled.is_set():
            return LiveAutomationWorkerResult("", "[]", cancelled=True)
        broker = WebullOpenApiBroker(job.config)
        try:
            enforce_live_guards(job.config)
            broker.connect()
        except Exception as exc:
            results.append({"status": "failed", "before_submit_failure": True,
                            "message": f"Broker setup failed before order preview ({type(exc).__name__})."})
            return LiveAutomationWorkerResult(
                "TARGET: LIVE · WEBULL\n" + json.dumps(results, indent=2, sort_keys=True),
                json.dumps(results),
            )

        # Refresh account, order, and position state before evaluating risk.
        # No account/order mutation occurs until risk gates, exact preview,
        # durable intent, and the existing one-submit receipt path all pass.
        try:
            snapshot = broker.account_snapshot()
            broker_orders = self._automation_response_rows(snapshot.get("open_orders"), "open orders")
            broker_positions = self._automation_response_rows(snapshot.get("positions"), "positions")
            from .broker_reconciliation import parse_broker_orders
            parsed_orders = parse_broker_orders(broker_orders)
            if any(not order.symbol for order in parsed_orders):
                raise RuntimeError("an open order has no recognizable symbol")
            positions: list[PositionSnapshot] = []
            for row in broker_positions:
                symbol = str(row.get("symbol") or row.get("ticker") or row.get("instrumentSymbol") or "").strip().upper()
                if not symbol:
                    raise RuntimeError("a position has no recognizable symbol")
                raw_quantity = next((row[key] for key in ("quantity", "qty", "position", "holdingQuantity")
                                     if row.get(key) not in (None, "")), None)
                try:
                    quantity = float(raw_quantity)
                except (TypeError, ValueError):
                    raise RuntimeError("a position has no recognizable quantity") from None
                if not math.isfinite(quantity) or quantity == 0:
                    if quantity == 0:
                        continue
                    raise RuntimeError("a position has an invalid quantity")
                value = self._automation_account_metric((row,), ("market_value", "marketValue", "marketValueInAccount"))
                if value is None:
                    mark = self._automation_account_metric((row,), ("market_price", "marketPrice", "lastPrice", "markPrice"))
                    value = abs(quantity) * mark if mark is not None and mark > 0 else None
                if value is None or not math.isfinite(value) or value < 0:
                    raise RuntimeError(f"position market value is unavailable for {symbol}")
                positions.append(PositionSnapshot(symbol, quantity, abs(value),
                                                  str(row.get("sector") or "") or None,
                                                  str(row.get("industry") or "") or None))
            safe_broker_orders = tuple({
                "symbol": order.symbol, "side": order.side, "quantity": order.quantity,
                "status": order.status, "broker_order_id": order.broker_order_id,
                "client_order_id": order.client_order_id,
                "filled_quantity": order.filled_quantity,
                "average_fill_price": order.average_fill_price,
            } for order in parsed_orders)
            safe_broker_positions = tuple({
                "symbol": position.symbol, "quantity": position.quantity,
                "market_value": position.market_value,
                "side": "SHORT" if position.quantity < 0 else "LONG",
                "sector": position.sector, "industry": position.industry,
            } for position in positions)
            active_or_uncertain_symbols = {
                order.symbol.upper() for order in parsed_orders
                if order.symbol and not order.is_terminal
            }
            pending_order_notionals: dict[str, float] = {}
            for order in parsed_orders:
                if order.is_terminal:
                    continue
                if order.quantity <= 0 or order.filled_quantity < 0 or order.filled_quantity > order.quantity:
                    raise RuntimeError(f"pending quantity is unavailable or invalid for {order.symbol}")
                if order.side in {"SELL", "S"}:
                    continue
                if order.side not in {"BUY", "B"}:
                    raise RuntimeError(f"pending order side is ambiguous for {order.symbol}")
                remaining = order.quantity - order.filled_quantity
                if remaining <= 0:
                    continue
                price = self._automation_account_metric((order.raw,), ("limit_price", "limitPrice", "orderPrice", "price"))
                if price is None or price <= 0:
                    raise RuntimeError(f"pending order price is unavailable for {order.symbol}")
                pending_order_notionals[order.symbol] = pending_order_notionals.get(order.symbol, 0.0) + remaining * price

            body = snapshot.get("body") if isinstance(snapshot, dict) else None
            if not isinstance(body, dict):
                raise RuntimeError("account snapshot is missing its balance section")
            balance = body.get("balance")
            accounts = body.get("accounts")
            account = self._select_account_payload({"accounts": accounts}, job.config.webull_account_id)
            equity = self._automation_account_metric(
                (balance, account),
                ("net_liquidation_value", "netLiquidationValue", "total_equity", "account_equity",
                 "equity", "net_asset", "net_assets", "total_asset", "total_assets"),
            )
            cash_text, _cash_source = self._extract_trade_cash(snapshot, job.config.webull_account_id)
            cash = self._numeric_money(cash_text)
            day_pnl = self._automation_account_metric(
                (balance, account),
                ("day_pnl", "today_pnl", "daily_pnl", "day_profit_loss", "today_profit_loss", "day_gain_loss"),
            )
            if equity is None or cash is None or cash <= 0:
                raise RuntimeError("fresh positive account equity and available cash could not be identified in Webull's account snapshot")
            peak_equity = self._automation_peak_equity(job.config.webull_account_id, equity)
            lifecycle_summary = (
                f"Fresh Webull preflight: {sum(not order.is_terminal for order in parsed_orders)} active/uncertain orders, "
                f"{len(positions)} open positions; account risk context loaded. Existing same-symbol exposure is held; "
                "no automatic cancel/reprice or exit policy is enabled."
            )
        except Exception as exc:
            results.append({"status": "preflight-blocked",
                            "message": f"Live Auto requires fresh, readable account/order/position risk context ({str(exc)[:180]}); no order was sent."})
            return LiveAutomationWorkerResult(
                "TARGET: LIVE · WEBULL\n" + json.dumps(results, indent=2, sort_keys=True),
                json.dumps(results),
                lifecycle_summary="Live Auto held: account equity, cash, daily P&L, positions, or open orders could not be verified. Check the account snapshot and configured risk inputs before retrying.",
            )

        hold_reason = ""
        for index, (plan_json, signal_json, quality_json, candle) in enumerate(
            zip(job.plan_json, job.signal_json, job.data_quality_json, job.candle_timestamps)
        ):
            if job.cancelled.is_set():
                break
            plan_values = json.loads(plan_json)
            plan = OrderPlan(**plan_values)
            symbol = plan.symbol.upper()
            if job.activity_blocks[index]:
                results.append({"status": "activity-blocked", "symbol": symbol,
                                "risk_reasons": list(job.activity_blocks[index]),
                                "message": "Existing daily trade/rejection limits blocked this candidate."})
                continue
            if symbol in active_or_uncertain_symbols or any(position.symbol.upper() == symbol for position in positions):
                results.append({
                    "status": "exposure-blocked", "symbol": plan.symbol.upper(),
                    "message": "A fresh broker snapshot shows an open/uncertain order or position for this symbol. No automatic cancel, replace, or scale-in was attempted.",
                })
                continue
            signal = Signal(**json.loads(signal_json))
            quality_values = json.loads(quality_json)
            quality = None
            if isinstance(quality_values, dict):
                quality_values["details"] = tuple(quality_values.get("details", ()))
                latest_at = quality_values.get("latest_at")
                if isinstance(latest_at, str):
                    try:
                        quality_values["latest_at"] = datetime.fromisoformat(latest_at)
                    except ValueError:
                        quality_values["latest_at"] = None
                from .data_quality import SymbolDataQuality
                quality = SymbolDataQuality(**quality_values)
            last_event_text = job.last_symbol_trade_json[index]
            last_trade = None
            if last_event_text:
                try:
                    last_trade = datetime.fromisoformat(last_event_text.replace("Z", "+00:00"))
                except ValueError:
                    results.append({"status": "risk-blocked", "symbol": symbol,
                                    "risk_reasons": ["Last symbol-trade timestamp is invalid; automated entry is held."]})
                    continue
            context = AutomationRiskContext(
                account_equity=equity,
                available_cash=cash,
                positions=tuple(positions),
                pending_order_notionals=dict(pending_order_notionals),
                day_pnl=day_pnl,
                peak_equity=peak_equity,
                session_open=market_session().is_open,
                data_quality=quality,
                last_symbol_trade_at={symbol: last_trade} if last_trade else {},
                now=datetime.now(tz=ZoneInfo("UTC")),
                is_live=True,
                live_auto_opted_in=job.config.auto_start_live_on_market_open,
                live_safety_hold=False,
                unresolved_live_outcomes=False,
            )
            decision = evaluate_automation_order(signal, job.config, context, job.risk_limits)
            if not decision.allowed or decision.plan is None:
                risk_decision_for_view = decision
                results.append({"status": "risk-blocked", "symbol": symbol,
                                "risk_reasons": list(decision.reasons),
                                "risk_guards": [asdict(guard) for guard in decision.guards],
                                "message": "Risk evaluation blocked this order before preview."})
                continue
            risk_decision_for_view = decision
            plan = decision.plan
            risk_guard_payloads = [asdict(guard) for guard in decision.guards]
            prior_pending = pending_order_notionals.get(symbol, 0.0)
            pending_order_notionals[symbol] = prior_pending + plan.notional

            def restore_pending_reservation() -> None:
                if prior_pending:
                    pending_order_notionals[symbol] = prior_pending
                else:
                    pending_order_notionals.pop(symbol, None)

            order_request = broker.new_order_payload(plan)
            client_order_id = order_request["client_order_id"]
            try:
                preview = broker.preview_order_payloads([order_request])
            except Exception as exc:
                restore_pending_reservation()
                results.append({"status": "preview-blocked", "symbol": plan.symbol,
                                "message": f"Exact preview failed ({type(exc).__name__}); no order was submitted."})
                break
            estimated_cost = self._preview_estimated_cost(preview.get("body"))
            if (not preview.get("preview_ok") or estimated_cost is None or estimated_cost < 0
                    or estimated_cost > job.config.max_order_notional_usd):
                results.append({
                    "status": "preview-blocked", "symbol": plan.symbol,
                    "client_order_id": client_order_id,
                    "preview_ok": bool(preview.get("preview_ok")),
                    "estimated_cost": estimated_cost,
                    "risk_cap": job.config.max_order_notional_usd,
                    "message": "No order was submitted because exact preview or the configured cost cap failed.",
                    "preview_response": redact(preview),
                })
                restore_pending_reservation()
                break
            projected_total = sum(position.market_value for position in positions) + sum(pending_order_notionals.values())
            projected_symbol = (sum(position.market_value for position in positions if position.symbol.upper() == symbol)
                                + sum(value for pending_symbol, value in pending_order_notionals.items()
                                      if pending_symbol.upper() == symbol))
            if (projected_total > equity * job.risk_limits.max_total_exposure_pct / 100.0
                    or projected_symbol > equity * job.risk_limits.max_symbol_exposure_pct / 100.0):
                results.append({"status": "risk-blocked", "symbol": symbol,
                                "risk_reasons": ["Exact preview estimated cost would exceed the configured symbol or total exposure limit."],
                                "risk_guards": risk_guard_payloads,
                                "estimated_cost": estimated_cost,
                                "message": "Preview cost exceeded projected exposure limits; no order was sent."})
                restore_pending_reservation()
                continue
            # Replace the plan estimate with the broker estimate for subsequent
            # candidates in this same cycle's portfolio exposure calculation.
            pending_order_notionals[symbol] = prior_pending + estimated_cost
            # User-selected User mode, a target switch, or Stop sets this token.
            # Check it after the slow preview and before recording an intent.
            if job.cancelled.is_set():
                restore_pending_reservation()
                break
            self._append_execution_event({
                "mode": "live", "robot": "Timmy", "event_type": "live-order-intent",
                "status": "pending-submit", "symbol": plan.symbol.upper(),
                "automation_scheduled": True, "automation_candle_timestamp": candle,
                "client_order_id": client_order_id, "quantity": plan.quantity,
                "buy_price": plan.limit_price, "order_type": plan.order_type,
                "preview_fingerprint": preview.get("preview_fingerprint"),
                "estimated_cost": estimated_cost, "recorded_at": datetime.now().isoformat(),
                "automation_risk_limits": asdict(job.risk_limits),
                "automation_risk_guards": risk_guard_payloads,
            })
            if job.cancelled.is_set():
                result = {"status": "failed", "before_submit_failure": True,
                          "message": "Live Auto was cancelled before the placement call.",
                          "request_payload": {"new_orders": [order_request]},
                          "order_plan": asdict(plan)}
            else:
                try:
                    result = broker.submit_previewed_order_payloads(
                        [order_request], preview.get("preview_fingerprint") or "")
                except Exception as exc:
                    result = {"status": "unknown", "error": type(exc).__name__,
                              "request_payload": {"new_orders": [order_request]}}
                result["order_plan"] = asdict(plan)
            try:
                event = self._event_from_broker_result(result, mode="live")
                event["automation_scheduled"] = True
                event["automation_candle_timestamp"] = candle
                event["before_submit_failure"] = bool(result.get("before_submit_failure"))
                event["automation_risk_limits"] = asdict(job.risk_limits)
                event["automation_risk_guards"] = risk_guard_payloads
                self._append_execution_event(event)
            except Exception as exc:
                result["status"] = "unknown"
                result["timmy_journal_error"] = type(exc).__name__
                hold_reason = "Live order outcome could not be durably journaled; reconcile at Webull before retrying."
                results.append(result)
                break
            results.append(result)
            broker_status = self._broker_event_status(result)
            if result.get("before_submit_failure") or broker_status in {"failed", "rejected"}:
                restore_pending_reservation()
            if broker_status == "unknown":
                hold_reason = "Live order outcome is unknown. Reconcile with Webull before retrying."
                break
            if result.get("before_submit_failure") or job.cancelled.is_set():
                break
        result_text = "TARGET: LIVE · WEBULL\n" + json.dumps(results, indent=2, sort_keys=True)
        return LiveAutomationWorkerResult(result_text, json.dumps(results), hold_reason,
                                          cancelled=job.cancelled.is_set(),
                                          lifecycle_summary=lifecycle_summary,
                                          risk_decision=risk_decision_for_view,
                                          broker_orders_json=json.dumps(safe_broker_orders),
                                          broker_positions_json=json.dumps(safe_broker_positions))

    def run_decision_cycle(self) -> None:
        if getattr(self, "_manual_webull_order_in_progress", False):
            self.status_bar.configure(text="Automation cycle deferred while a confirmed manual Webull order is being reconciled.")
            return
        if self._automation_cycle_in_progress:
            self.status_bar.configure(text="Decision cycle skipped: another automation cycle is already running.")
            return
        if self._action_in_progress or self._refresh_in_progress:
            active = self._active_action_label if self._action_in_progress else "market refresh"
            self.status_bar.configure(text=f"Decision cycle paused while {active} is in progress.")
            return
        try:
            config_snapshot = self._freeze_config_snapshot(
                self._runtime_config(self._load_config_safe()))
        except Exception as exc:
            self.status_bar.configure(text=f"Decision cycle setup failed: {type(exc).__name__}")
            return

        automatic_requested = self._automation_enabled()
        requested_target = self.execution_target_var.get()
        requested_mode = self.execution_mode_var.get()
        self._automation_cycle_requested_target = requested_target
        self._automation_cycle_requested_mode = requested_mode
        cancelled = threading.Event()
        self._automation_cancel_event = cancelled
        self._automation_cycle_in_progress = True
        self._automation_cycle_started_at = datetime.now(tz=ZoneInfo("America/New_York"))
        self._automation_wait_reason = "Preparing market data and signals in background."
        self._refresh_in_progress = True
        self.status_bar.configure(text="Decision cycle running · refreshing data and ranking signals in background…")
        scan_status_label = getattr(self, "market_scan_status_label", None)
        if scan_status_label is not None:
            scan_status_label.configure(text="SCAN STARTING · preparing data and signals off the UI thread")
        self._set_buttons_state("disabled")
        self._sync_manual_controls()

        def prepare_worker() -> None:
            try:
                snapshot = self._prepare_automation_market_snapshot(config_snapshot)
                error = None
            except Exception as exc:
                snapshot = None
                error = exc
            if not self.closing:
                try:
                    self.root.after(0, lambda: self._finish_decision_cycle_prepare(
                        snapshot, error, automatic_requested, requested_target,
                        requested_mode, cancelled))
                except tk.TclError:
                    pass
        threading.Thread(target=prepare_worker, daemon=True,
                         name="timmy-automation-market-preparation").start()

    def _finish_decision_cycle_prepare(
        self,
        snapshot: AutomationMarketSnapshot | None,
        error: Exception | None,
        automatic_requested: bool,
        requested_target: str,
        requested_mode: str,
        cancelled: threading.Event,
    ) -> None:
        self._refresh_in_progress = False
        self._set_buttons_state("normal")
        if self.closing:
            self._finish_automation_cycle("Cycle cancelled while the app was closing.")
            return
        if cancelled.is_set():
            self.status_bar.configure(text="Decision cycle stopped · user-selected mode/target preserved; no Live order was started.")
            self._finish_automation_cycle("Cycle cancelled after an explicit mode, target, or Pause All selection.")
            return
        if error is not None or snapshot is None:
            reason = type(error).__name__ if error is not None else "market-data preparation failed"
            self.status_bar.configure(text=f"Decision cycle failed: {reason}")
            self._set_text(self.broker_text, f"Decision cycle failed before planning: {reason}")
            if not cancelled.is_set():
                self._fallback_to_manual_after_cycle_error(reason, automatic_requested)
            self._finish_automation_cycle(f"Cycle failed: {reason}")
            return
        try:
            self._refresh_payload(prepared=snapshot)
            try:
                self._record_research_scan(snapshot.refresh_outcome,
                                           refresh_error=(RuntimeError(snapshot.refresh_error)
                                                          if snapshot.refresh_error else None))
            except (OSError, ValueError, tk.TclError):
                pass
            if snapshot.refresh_error:
                self.status_bar.configure(text=f"Provider refresh failed ({snapshot.refresh_error}); using saved market data.")
            elif snapshot.data_error:
                self.status_bar.configure(text=f"Market data unavailable ({snapshot.data_error}); Live orders remain gated.")

            summary = self._decision_summary()
            self._set_text(self.decision_text, summary)
            target = self.execution_target_var.get()
            mode = self.execution_mode_var.get()
            paper_enabled = self.paper_auto_var.get()
            simulation_enabled = target == "Simulation" and mode == "Auto"
            # An explicit User/target choice during background preparation
            # cancels Live Auto without changing that choice back afterward.
            user_cancelled = cancelled.is_set() or target != requested_target or mode != requested_mode
            live_block = self._live_auto_block_reason() if target == "Live" and mode == "Auto" else ""
            live_enabled = target == "Live" and mode == "Auto" and not live_block and not user_cancelled
            if user_cancelled and requested_target == "Live":
                live_block = "Live Auto was cancelled because execution mode or target changed during the cycle."
            self._automation_wait_reason = live_block
            lane_results: list[str] = []
            if paper_enabled or simulation_enabled or live_enabled or live_block:
                # Local paper/simulation journal work stays on Tk because it is
                # short and contains UI-backed mode state. Broker latency is
                # isolated in the following immutable job.
                lane_results = self._run_automation_lanes(
                    paper_enabled=paper_enabled,
                    live_enabled=False,
                    simulation_enabled=simulation_enabled,
                )
            if live_enabled:
                lane_plans, skipped = self._scheduled_live_lane_plans()
                if not lane_plans:
                    detail = "No new Live Auto entries; current symbols already have a scheduled attempt for this daily candle."
                    self._record_automation_feedback("live", "above-expectation", detail)
                    lane_results.append(f"Live lane skipped: {detail} {', '.join(skipped)}")
                    text = "\n\n".join(lane_results) or detail
                    self._set_text(self.broker_text, text)
                    self.status_bar.configure(text="Live Auto cycle complete · no new eligible order.")
                    self._finish_automation_cycle(text)
                    return
                job = self._make_live_automation_job(snapshot, lane_plans, cancelled)
                self.status_bar.configure(text="Live Auto running · exact preview and broker work in background…")
                self._set_text(self.broker_text, "Live Auto is checking the exact Webull preview and risk cap. No order is sent before a durable intent is recorded.")
                def broker_worker() -> None:
                    try:
                        result = self._run_live_automation_job(job)
                        worker_error = None
                    except Exception as exc:
                        result = None
                        worker_error = exc
                    if not self.closing:
                        try:
                            self.root.after(0, lambda: self._finish_live_automation_worker(
                                result, worker_error, snapshot, lane_results,
                                automatic_requested, cancelled))
                        except tk.TclError:
                            pass
                threading.Thread(target=broker_worker, daemon=True,
                                 name="timmy-live-auto-broker-worker").start()
                self._render_automation_panel()
                return

            lane_result_text = "\n\n".join(lane_results)
            if lane_result_text:
                self._set_text(self.broker_text, lane_result_text)
            if live_block and target == "Live":
                self.status_bar.configure(text=f"Live automation held: {live_block}")
                self._set_text(self.broker_text, (lane_result_text + "\n\n" if lane_result_text else "")
                               + f"Live automation held: {live_block}")
                cycle_result = f"Live automation held: {live_block}"
            elif user_cancelled:
                self.status_bar.configure(text="Decision cycle stopped · user-selected mode/target preserved.")
                cycle_result = "Decision cycle stopped after an explicit mode or target change."
            elif lane_result_text:
                cycle_result = self._automation_result_label(lane_result_text)
                self.status_bar.configure(text=cycle_result)
            else:
                self._set_text(self.broker_text,
                               f"TARGET: {target.upper()} · Decision cycle completed. No automatic lane was enabled.")
                self.status_bar.configure(text="Decision cycle complete.")
                cycle_result = "Decision cycle complete; no automatic lane was enabled."
            self._finish_automation_cycle(cycle_result)
        except Exception as exc:
            reason = (str(exc)[:220] if str(exc).startswith("Live Auto risk policy is not configured.")
                      else type(exc).__name__)
            self.status_bar.configure(text=f"Decision cycle failed: {reason}")
            self._set_text(self.broker_text, f"Decision cycle failed: {reason}")
            if not cancelled.is_set():
                self._fallback_to_manual_after_cycle_error(reason, automatic_requested)
            self._finish_automation_cycle(f"Cycle failed: {reason}")

    def _finish_live_automation_worker(
        self,
        result: LiveAutomationWorkerResult | None,
        error: Exception | None,
        snapshot: AutomationMarketSnapshot,
        lane_results: list[str],
        automatic_requested: bool,
        cancelled: threading.Event,
    ) -> None:
        if error is not None or result is None:
            reason = type(error).__name__ if error is not None else "broker worker failed"
            live_text = f"Live lane blocked before a confirmed result ({reason})."
            self._record_automation_feedback("live", "below-expectation", live_text)
            output = "\n\n".join([*lane_results, live_text])
            self._set_text(self.broker_text, output)
            self.status_bar.configure(text=live_text)
            self._finish_automation_cycle(live_text)
            return
        try:
            rows = json.loads(result.results_json)
        except (TypeError, ValueError):
            rows = []
        if isinstance(rows, list):
            self._update_buying_power_from_broker_results(rows)
        self._latest_automation_risk_decision = result.risk_decision
        self._latest_automation_lifecycle_summary = result.lifecycle_summary or "Broker preflight summary unavailable."
        try:
            self._latest_automation_broker_orders = tuple(json.loads(result.broker_orders_json))
            self._latest_automation_broker_positions = tuple(json.loads(result.broker_positions_json))
        except (TypeError, ValueError):
            self._latest_automation_broker_orders = None
            self._latest_automation_broker_positions = None
        try:
            self.execution_events = self._load_execution_events()
            self.recent_bad_event_counts = self._build_bad_event_counts(self.execution_events)
        except (OSError, ValueError):
            pass
        live_status = self._live_submission_status("Submitting live order", result.result_text)
        if result.hold_reason:
            self._hold_live_automation(result.hold_reason)
        expectation = self._feedback_expectation(result.result_text)
        lifecycle_blocked = any(
            isinstance(row, dict) and row.get("status") in {"preflight-blocked", "exposure-blocked"}
            for row in rows
        )
        self._record_automation_feedback("live", expectation,
                                         ("Live Auto stopped at the broker order/position preflight; no automatic cancel, replace, or exit was attempted."
                                          if lifecycle_blocked else
                                          "Live Auto used a fresh exact preview, risk gate, durable intent, and one submit per order."))
        lane_results = [*lane_results]
        if result.lifecycle_summary:
            lane_results.append(result.lifecycle_summary)
        lane_results.append("Live lane result:\n" + result.result_text)
        output = "\n\n".join(lane_results)
        self._set_text(self.broker_text, output)
        if live_status:
            self.status_bar.configure(text=live_status)
        elif result.cancelled or cancelled.is_set():
            self.status_bar.configure(text="Live Auto stopped · user-selected mode/target preserved; no further orders will be sent.")
        elif any(row.get("status") == "preflight-blocked" for row in rows if isinstance(row, dict)):
            self._automation_wait_reason = result.lifecycle_summary
            self.status_bar.configure(text=result.lifecycle_summary or "Live Auto waiting for a readable broker snapshot.")
        elif any(row.get("status") == "exposure-blocked" for row in rows if isinstance(row, dict)):
            self.status_bar.configure(text="Live Auto held for existing broker exposure · review open orders and positions.")
        else:
            self.status_bar.configure(text="Live Auto cycle complete · review order status and reconciliation.")
        self._render_status()
        self._render_broker_summary()
        self._render_setup_status()
        self._finish_automation_cycle(live_status or self._automation_result_label(result.result_text))

    def _finish_automation_cycle(self, result: str) -> None:
        finished_at = datetime.now(tz=ZoneInfo("America/New_York"))
        started_at = self._automation_cycle_started_at
        self._automation_last_run_at = finished_at
        self._automation_last_duration_seconds = (
            max(0.0, (finished_at - started_at).total_seconds()) if started_at else None)
        self._automation_last_result = str(result)[:220]
        if not str(result).startswith("Cycle failed:"):
            self._automatic_fallback_attempt = 0
        self._automation_cycle_in_progress = False
        self._automation_cycle_started_at = None
        self._automation_cancel_event = None
        self._automation_cycle_requested_target = ""
        self._automation_cycle_requested_mode = ""
        self._sync_manual_controls()
        self._render_automation_panel()
        if self._automation_enabled():
            self._schedule_automation()

    @staticmethod
    def _automation_result_label(result_text: str) -> str:
        lowered = str(result_text).lower()
        if "unknown" in lowered or "pending-submit" in lowered:
            return "Unknown broker outcome; review required."
        if any(marker in lowered for marker in ("blocked", "rejected", "failed", "error", "preview-required")):
            return "Cycle finished with blocked work; review details."
        if "no executable plans" in lowered or "no new " in lowered:
            return "Cycle finished with no new eligible plans."
        if "accepted" in lowered:
            return "Broker accepted a request; confirm its live status at Webull."
        return "Automation cycle completed."

    @staticmethod
    def _automation_live_result_text(result_text: str) -> str:
        marker = "Live lane result:\n"
        return result_text.split(marker, 1)[1] if marker in result_text else result_text

    @staticmethod
    def _live_result_requires_automation_hold(status: str | None) -> bool:
        lowered = str(status or "").lower()
        return any(marker in lowered for marker in (
            "outcome is unknown",
            "could not journal a broker response",
            "blocks unresolved duplicates",
        ))

    def _automation_movement_plans(self) -> list:
        """Restrict Auto lanes to percentage-qualified, strategy-qualified movers."""
        candidates = set(getattr(self, "automation_movement_candidates", ()))
        config = self.config or self._load_config_safe()
        signals = [
            signal for signal in getattr(self, "movement_candidate_signals", [])
            if signal.symbol.upper() in candidates
        ]
        return self._plans_from_signals(config, signals)[:self.plan_limit_value]

    def _automation_lane_plans(self, lane: str) -> tuple[list, list[str]]:
        """Return plans not already journaled for this lane and daily candle."""
        existing: set[tuple[str, str]] = set()
        for event in getattr(self, "execution_events", []):
            if event.get("mode") != lane or event.get("event_type") != "buy-order":
                continue
            context = event.get("paper_context")
            if not isinstance(context, dict):
                continue
            order = event.get("order")
            symbol = event.get("symbol") or (order.get("symbol") if isinstance(order, dict) else "")
            candle = context.get("latest_candle_timestamp")
            if symbol:
                existing.add((str(symbol).upper(), str(candle or "unknown")))

        selected = []
        skipped: list[str] = []
        for plan in self._automation_movement_plans()[: self.plan_limit_value]:
            key = (plan.symbol.upper(), str(self._latest_candle_timestamp(plan.symbol) or "unknown"))
            if key in existing:
                skipped.append(plan.symbol.upper())
                continue
            existing.add(key)
            selected.append(plan)
        return selected, skipped

    def _scheduled_live_lane_plans(self) -> tuple[list, list[str]]:
        """Skip Live Auto symbols already attempted against the same candle."""
        existing = set()
        for event in getattr(self, "execution_events", []):
            if (
                event.get("mode") != "live"
                or event.get("automation_scheduled") is not True
                or event.get("event_type") != "buy-order"
                or str(event.get("status", "")).lower() == "preview-required"
                or (str(event.get("status", "")).lower() == "failed" and event.get("before_submit_failure") is True)
            ):
                continue
            symbol = str(event.get("symbol") or "").upper()
            candle = event.get("automation_candle_timestamp")
            if symbol and candle:
                existing.add((symbol, str(candle)))

        selected = []
        skipped = []
        for plan in self._automation_movement_plans()[: self.plan_limit_value]:
            key = (plan.symbol.upper(), str(self._latest_candle_timestamp(plan.symbol) or "unknown"))
            if key in existing:
                skipped.append(plan.symbol.upper())
                continue
            existing.add(key)
            selected.append(plan)
        return selected, skipped

    def _run_automation_lanes(
        self,
        paper_enabled: bool,
        live_enabled: bool,
        simulation_enabled: bool = False,
    ) -> list[str]:
        previous_target = self.execution_target_var.get()
        results: list[str] = []
        if not self._automation_movement_plans():
            config = self.config or self._load_config_safe()
            detail = (
                "No automated entry: no fresh movement candidate passed the "
                f"{config.trade_candidate_min_change_pct:.1f}% move, scout, bullish strategy, and execution-plan filters."
            )
            self._record_automation_feedback("combined", "above-expectation", detail)
            return [detail]
        if paper_enabled:
            self.execution_target_var.set("Paper")
            try:
                lane_plans, skipped = self._automation_lane_plans("paper")
                if lane_plans:
                    paper_result = self.paper_trade(refresh=False, refresh_after=False, plans_override=lane_plans)
                    self._load_journal()
                    self.paper_cash_snapshot = self._paper_account_snapshot()
                    paper_expectation = self._feedback_expectation(paper_result)
                    self._record_automation_feedback("paper", paper_expectation, f"Paper lane journaled {len(lane_plans)} new plan(s).")
                    results.append("Paper lane result:\n" + paper_result)
                else:
                    detail = "No new paper entries; the current symbols were already journaled for this daily candle."
                    self._record_automation_feedback("paper", "above-expectation", detail)
                    results.append(f"Paper lane skipped: {detail} {', '.join(skipped)}")
            except Exception as exc:
                self._record_automation_feedback("paper", "below-expectation", str(exc))
                results.append(f"Paper lane blocked:\n{exc}")
        if simulation_enabled:
            self.execution_target_var.set("Simulation")
            try:
                lane_plans, skipped = self._automation_lane_plans("simulation")
                if lane_plans:
                    self._preview_local_plans("Simulation", plans_override=lane_plans)
                    simulation_result = self.simulate_current_plans(plans_override=lane_plans)
                    self._record_automation_feedback("simulation", self._feedback_expectation(simulation_result), f"Local Simulation journaled {len(lane_plans)} new plan(s).")
                    results.append("Simulation lane result (local only):\n" + simulation_result)
                else:
                    detail = "No new Simulation entries; the current symbols were already journaled for this daily candle."
                    self._record_automation_feedback("simulation", "above-expectation", detail)
                    results.append(f"Simulation lane skipped: {detail} {', '.join(skipped)}")
            except Exception as exc:
                self._record_automation_feedback("simulation", "below-expectation", str(exc))
                results.append(f"Simulation lane blocked:\n{exc}")
        if live_enabled:
            self.execution_target_var.set("Live")
            try:
                lane_plans, skipped = self._scheduled_live_lane_plans()
                if lane_plans:
                    live_result = self.live_preview_then_submit(
                        refresh=False,
                        plans_override=lane_plans,
                        scheduled_automation=True,
                    )
                    live_expectation = self._feedback_expectation(live_result)
                    self._record_automation_feedback("live", live_expectation, f"Live Auto previewed {len(lane_plans)} new candle plan(s) and submitted through existing guards.")
                    results.append("Live lane result:\n" + live_result)
                else:
                    detail = "No new Live Auto entries; current symbols already have a scheduled attempt for this daily candle."
                    self._record_automation_feedback("live", "above-expectation", detail)
                    results.append(f"Live lane skipped: {detail} {', '.join(skipped)}")
            except Exception as exc:
                self._record_automation_feedback("live", "below-expectation", str(exc))
                results.append(f"Live lane blocked:\n{exc}")
        self.execution_target_var.set("Live" if live_enabled else previous_target)
        self._render_status()
        self._render_broker_summary()
        self._render_setup_status()
        return results or ["Automation lanes checked: no enabled lane."]

    def _fallback_to_manual_after_cycle_error(self, reason: str, automatic_requested: bool) -> None:
        """Pause failed non-Live automation and schedule a guarded Auto retry."""
        if not automatic_requested or self.execution_target_var.get() == "Live":
            return
        self._automatic_fallback_active = True
        self._automatic_fallback_reason = str(reason or "Automation cycle failed")[:220]
        self._automatic_fallback_attempt = min(self._automatic_fallback_attempt + 1, 4)
        self._automatic_fallback_restore_mode = (
            "Auto" if self.execution_mode_var.get() == "Auto" else "User"
        )
        if self._automatic_fallback_restore_mode == "Auto":
            self._manual_mode_user_selected = False
        self.execution_mode_var.set("User")
        self._cancel_automation_callback("automation_after_id")
        self._automation_next_run_at = None
        self._schedule_automatic_fallback_recovery()
        self._sync_manual_controls()
        self._record_automation_mode_transition("temporary-manual-fallback", self._automatic_fallback_reason)

    def _schedule_automatic_fallback_recovery(self) -> None:
        if self.closing or not self._automatic_fallback_active:
            return
        self._cancel_automation_callback("_automatic_fallback_after_id")
        retry_seconds = self._automatic_fallback_retry_seconds()
        self._automatic_fallback_after_id = self.root.after(
            retry_seconds * 1000, self._try_automatic_fallback_recovery
        )

    def _automatic_fallback_retry_seconds(self) -> int:
        base_seconds = max(30, AUTOMATION_RECOVERY_MS // 1000)
        return min(300, base_seconds * (2 ** max(0, self._automatic_fallback_attempt - 1)))

    def _clear_automatic_fallback(self, *, keep_manual: bool) -> None:
        was_active = self._automatic_fallback_active
        reason = self._automatic_fallback_reason
        self._cancel_automation_callback("_automatic_fallback_after_id")
        self._automatic_fallback_active = False
        self._automatic_fallback_reason = ""
        self._automatic_fallback_restore_mode = "User"
        self._automatic_fallback_attempt = 0
        if keep_manual:
            self._manual_mode_user_selected = True
        self._save_runtime_settings()
        if was_active:
            state = "user-kept-manual" if keep_manual else "fallback-cancelled"
            self._record_automation_mode_transition(state, reason)

    def _record_automation_mode_transition(self, status: str, reason: str) -> None:
        try:
            self._append_execution_event({
                "mode": "system",
                "robot": "Timmy",
                "event_type": "automation-mode-transition",
                "status": str(status)[:48],
                "target": self.execution_target_var.get(),
                "execution_mode": self.execution_mode_var.get(),
                "reason": str(reason or "")[:220],
                "recorded_at": datetime.now().isoformat(),
            })
        except Exception as exc:
            self._write_crash_log(f"Automation mode transition could not be journaled: {exc}")

    def _try_automatic_fallback_recovery(self) -> None:
        self._automatic_fallback_after_id = None
        if self.closing or not self._automatic_fallback_active:
            return
        if self._manual_mode_user_selected or self.execution_mode_var.get() != "User":
            self._clear_automatic_fallback(keep_manual=self._manual_mode_user_selected)
            self._sync_manual_controls()
            self._render_automation_panel()
            if self._automation_enabled():
                self._schedule_automation()
            return
        if self.execution_target_var.get() == "Live":
            self._clear_automatic_fallback(keep_manual=False)
            self.status_bar.configure(
                text="Auto recovery paused after switching to Live; review readiness and select Auto explicitly."
            )
            self._sync_manual_controls()
            self._render_automation_panel()
            return
        if self._action_in_progress or self._refresh_in_progress or self._automation_cycle_in_progress:
            self._schedule_automatic_fallback_recovery()
            return
        restore_mode = self._automatic_fallback_restore_mode
        reason = self._automatic_fallback_reason
        self._automatic_fallback_active = False
        self._automatic_fallback_reason = ""
        self._automatic_fallback_restore_mode = "User"
        if restore_mode == "Auto":
            self._manual_mode_user_selected = False
            self.execution_mode_var.set("Auto")
        self._save_runtime_settings()
        self._record_automation_mode_transition("automatic-recovery", reason)
        self._sync_manual_controls()
        self._render_automation_panel()
        if self._automation_enabled():
            self._schedule_automation()
        self.status_bar.configure(
            text=(f"Automation resumed after recovery from: {reason}" if restore_mode == "Auto"
                  else "Paper automation resumed after its recovery pause.")
        )

    def _record_automation_feedback(self, lane: str, expectation: str, detail: str) -> None:
        detail = detail[:500]
        if not self._should_record_automation_feedback(lane, expectation, detail):
            return
        event = {
            "mode": lane,
            "robot": "Timmy",
            "event_type": "automation-feedback",
            "status": expectation,
            "lane": lane,
            "detail": detail,
            "plans_count": len(getattr(self, "plans", [])),
            "cash_account": self.trade_cash_snapshot[0],
            "paper_account": self._paper_account_snapshot()[0],
            "principle": TRADING_PRINCIPLE,
        }
        try:
            self._append_execution_event(event)
        except Exception:
            pass

    def _should_record_automation_feedback(self, lane: str, expectation: str, detail: str) -> bool:
        now = datetime.now(ZoneInfo("America/New_York"))
        for event in reversed(getattr(self, "execution_events", [])[-20:]):
            if event.get("event_type") != "automation-feedback":
                continue
            if event.get("lane") != lane or event.get("status") != expectation or event.get("detail") != detail:
                continue
            timestamp = self._event_timestamp(event)
            if timestamp and (now - timestamp).total_seconds() < 900:
                return False
        return True

    @staticmethod
    def _feedback_expectation(result_text: str) -> str:
        lowered = str(result_text).lower()
        weak_markers = (
            "blocked",
            "rejected",
            "failed",
            "error",
            "unknown",
            "pending-submit",
            "unresolved",
            "insufficient",
            "preview-required",
            "no executable",
            "nothing was journaled",
        )
        return "below-expectation" if any(marker in lowered for marker in weak_markers) else "above-expectation"

    @staticmethod
    def _freeze_config_snapshot(config: BotConfig) -> BotConfig:
        """Copy mutable configuration sets before passing config to a worker."""
        return replace(
            config,
            symbol_whitelist=frozenset(config.symbol_whitelist),
            enabled_trade_patterns=frozenset(config.enabled_trade_patterns),
            watchlist_rotation_candidates=frozenset(config.watchlist_rotation_candidates),
            crypto_symbols=frozenset(config.crypto_symbols),
            futures_symbols=frozenset(config.futures_symbols),
            options_symbols=frozenset(config.options_symbols),
            event_contract_symbols=frozenset(config.event_contract_symbols),
        )

    def _prepare_automation_market_snapshot(self, config: BotConfig) -> AutomationMarketSnapshot:
        """Fetch and rank data in a worker; return immutable values for Tk apply."""
        config_snapshot = self._freeze_config_snapshot(self._runtime_config(config))
        refresh_outcome = None
        refresh_error = ""
        try:
            refresh_outcome = self._refresh_market_data_if_needed(config=config_snapshot)
        except Exception as exc:
            refresh_error = f"{type(exc).__name__}: {str(exc)[:180]}"
        bars_by_symbol = {}
        candidate_bars: dict = {}
        data_error = ""
        synthetic = False
        try:
            if not self.data_file.exists():
                self.data_file.parent.mkdir(parents=True, exist_ok=True)
                write_sample_bars(self.data_file)
                self._mark_sample_data()
            else:
                synthetic = self._sample_marker_matches()
            bars_by_symbol = load_csv_bars(self.data_file)
            if config_snapshot.market_data_provider != "csv" and config_snapshot.watchlist_universe == "all-us":
                if self.movement_scan_bars_path.exists():
                    try:
                        candidate_bars = load_csv_bars(self.movement_scan_bars_path)
                    except (OSError, TypeError, ValueError) as exc:
                        data_error = f"movement candidate cache unavailable: {type(exc).__name__}"
        except Exception as exc:
            data_error = f"{type(exc).__name__}: {str(exc)[:180]}"
            bars_by_symbol = {}
            synthetic = False
        signals = tuple(rank_signals(bars_by_symbol, config_snapshot))
        candidate_signals = tuple(rank_signals(candidate_bars, config_snapshot))
        frozen_bars = tuple((symbol, tuple(bars)) for symbol, bars in sorted({**bars_by_symbol, **candidate_bars}.items()))
        return AutomationMarketSnapshot(
            config=config_snapshot,
            bars_by_symbol=frozen_bars,
            signals=signals,
            synthetic_data=synthetic,
            data_error=data_error,
            refresh_outcome=refresh_outcome,
            refresh_error=refresh_error,
            candidate_signals=candidate_signals,
        )

    def _refresh_payload(
        self,
        skip_market_refresh: bool = False,
        prepared: AutomationMarketSnapshot | None = None,
    ) -> str:
        self._splash_step("Loading configuration")
        self.config = prepared.config if prepared is not None else self._runtime_config(self._load_config_safe())
        self._splash_step("Reading execution journals")
        self.execution_events = self._load_execution_events()
        self.recent_bad_event_counts = self._build_bad_event_counts(self.execution_events)
        self._splash_step("Scanning market data")
        if prepared is None:
            self.bars_by_symbol = self._load_bars(skip_market_refresh=skip_market_refresh)
            self.signals = rank_signals(self.bars_by_symbol, self.config)
            self.movement_candidate_signals = []
        else:
            self.bars_by_symbol = {symbol: list(bars) for symbol, bars in prepared.bars_by_symbol}
            self.signals = list(prepared.signals)
            self.movement_candidate_signals = list(prepared.candidate_signals)
            self._sample_data_in_use = prepared.synthetic_data
            self._market_data_load_error = prepared.data_error
        self._refresh_movement_watchlist(
            self.bars_by_symbol,
            self.signals,
            synthetic=self._sample_data_in_use,
        )
        self._persist_movement_candidates(self.config, self.bars_by_symbol)
        self.signal_by_symbol = {signal.symbol: signal for signal in self.signals}
        quiet_symbols = set(self.watchlist_organization.quiet_symbols)
        alert_signals = [signal for signal in self.signals if signal.symbol.upper() not in quiet_symbols]
        try:
            new_alerts = self.alert_store.evaluate(alert_signals)
        except (OSError, ValueError) as exc:
            new_alerts = []
            self._alert_storage_error = str(exc)
        else:
            self._alert_storage_error = ""
            if new_alerts and self._local_alert_notification_allowed():
                self.status_bar.configure(text=f"{len(new_alerts)} local alert(s) triggered. Review Alerts workspace.")
        self._splash_step("Reconciling paper outcomes")
        if self._reconcile_paper_outcomes(self.bars_by_symbol):
            self.execution_events = self._load_execution_events()
            self.recent_bad_event_counts = self._build_bad_event_counts(self.execution_events)
        self._splash_step("Building trade plans")
        self.plans = self._load_plans(self.config)
        self._splash_step("Rendering dashboard")
        self._render_status()
        self._render_universe()
        self._render_signals()
        self._render_plans()
        self._render_broker_summary()
        self._load_journal()
        self._render_health_tab()
        self._render_portfolio_panel()
        self._render_automation_panel()
        self._render_alerts_panel()
        self._write_paper_training_summary()
        self._restore_last_workspace()
        return "Dashboard refreshed."

    def _load_bars(self, skip_market_refresh: bool = False):
        if not skip_market_refresh:
            self._refresh_market_data_if_needed()
        if not self.data_file.exists():
            self.data_file.parent.mkdir(parents=True, exist_ok=True)
            write_sample_bars(self.data_file)
            self._mark_sample_data()
        else:
            self._sample_data_in_use = self._sample_marker_matches()
        try:
            bars = load_csv_bars(self.data_file)
        except Exception as exc:
            self._market_data_load_error = f"{type(exc).__name__}: {exc}"
            self._sample_data_in_use = False
            self.status_bar.configure(
                text="Market data file could not be read. The original file was preserved; no sample data substituted."
            )
            return {}
        self._market_data_load_error = ""
        return bars

    def _sample_marker_matches(self) -> bool:
        try:
            marker = json.loads(self.sample_data_marker_path.read_text(encoding="utf-8"))
            stat = self.data_file.stat()
        except (OSError, ValueError, TypeError):
            return False
        if not isinstance(marker, dict) or not isinstance(marker.get("sha256"), str):
            return False
        if marker.get("size") == stat.st_size and marker.get("mtime_ns") == stat.st_mtime_ns:
            return True
        try:
            actual_hash = hashlib.sha256(self.data_file.read_bytes()).hexdigest()
        except OSError:
            return False
        if not hmac.compare_digest(marker["sha256"], actual_hash):
            self._clear_sample_data_marker()
            return False
        marker.update(size=stat.st_size, mtime_ns=stat.st_mtime_ns)
        try:
            _write_private_json(self.sample_data_marker_path, marker)
        except OSError:
            pass
        return True

    def _mark_sample_data(self) -> None:
        self._sample_data_in_use = True
        try:
            stat = self.data_file.stat()
            marker = {
                "sha256": hashlib.sha256(self.data_file.read_bytes()).hexdigest(),
                "size": stat.st_size,
                "mtime_ns": stat.st_mtime_ns,
            }
            _write_private_json(self.sample_data_marker_path, marker)
        except OSError:
            # Keep the current-session provenance visible even if the small
            # marker cannot be persisted; never replace user market data.
            pass

    def _clear_sample_data_marker(self) -> None:
        self._sample_data_in_use = False
        try:
            self.sample_data_marker_path.unlink(missing_ok=True)
        except OSError:
            pass

    def _refresh_market_data_if_needed(self, config: BotConfig | None = None) -> MarketRefreshOutcome:
        config = config or self.config or self._load_config_safe()
        diagnostics: list[dict] = []
        if config.market_data_provider == "csv":
            return MarketRefreshOutcome("csv")
        if self.data_file.exists():
            age_seconds = datetime.now().timestamp() - self.data_file.stat().st_mtime
            if age_seconds < config.market_data_max_age_minutes * 60 and not self._sample_marker_matches():
                return MarketRefreshOutcome("cached")
        watchlist_path = self._runtime_path(config.watchlist_path or self.watchlist_path)
        write_watchlist_template(watchlist_path, config.watchlist_template)
        if config.watchlist_universe == "all-us":
            universe = sorted(set(self._load_market_universe(config)) | set(CROSS_ASSET_SYMBOLS)
                              | set(self._read_watchlist_symbols(self.movement_universe_extra_path)))
            movement_batch = self._next_movement_universe_batch(
                universe,
                config.watchlist_universe_batch_size,
                state_path=self.movement_rotation_state_path,
            )
            movement_bars = fetch_daily_bars(
                config.market_data_provider,
                movement_batch,
                # Signal scoring and trade plans require at least 55 daily bars.
                # Six bars can detect movement, but could never qualify an
                # all-universe discovery symbol for the strategy.
                days=90,
                timeout=config.market_data_fetch_timeout_seconds,
                max_workers=config.market_data_fetch_workers,
                progress_callback=self._record_movement_scan_progress,
                diagnostic_callback=diagnostics.append,
            )
            movement_signals = rank_signals(movement_bars, config)
            self._refresh_movement_watchlist(
                movement_bars,
                movement_signals,
                scan_metadata={
                    "source": config.market_data_provider,
                    "scope": "all-us",
                    "requested_count": len(movement_batch),
                    "returned_count": len(movement_bars),
                    "universe_count": len(universe),
                    "failed_count": int(self._movement_scan_progress.get("failed", 0) or 0),
                    **getattr(self, "_movement_batch_audit", {}),
                },
            )
            self._persist_movement_candidates(config, movement_bars)
        if config.enable_watchlist_rotation:
            seed_symbols = load_watchlist(watchlist_path, config.symbol_whitelist)
            active_watchlist_path = self._runtime_path(config.active_watchlist_path or self.active_watchlist_path)
            symbols = load_watchlist(active_watchlist_path, set(seed_symbols))
            previous_symbols = list(symbols)
            candidates = self._rotation_candidates(config, symbols)
            bars = fetch_daily_bars(
                config.market_data_provider,
                candidates,
                timeout=config.market_data_fetch_timeout_seconds,
                max_workers=config.market_data_fetch_workers,
                diagnostic_callback=diagnostics.append,
            )
            if bars:
                candidate_signals = rank_signals(bars, config)
                self._refresh_movement_watchlist(bars, candidate_signals)
                rotated = rotate_watchlist(
                    symbols,
                    candidate_signals,
                    set(candidates),
                    max_symbols=config.max_watchlist_symbols,
                    min_scout_score=config.min_watchlist_scout_score,
                    quiet_scout_score=config.quiet_watchlist_scout_score,
                )
                if rotated != symbols:
                    write_watchlist(active_watchlist_path, rotated)
                    symbols = rotated
                self._write_generated_watchlists(config, candidate_signals, previous_symbols, rotated)
                selected_bars = {symbol: bars[symbol] for symbol in symbols if symbol in bars}
                if selected_bars:
                    write_csv_bars(self.data_file, selected_bars)
                    self._clear_sample_data_marker()
                    self._set_status_from_worker(f"Market data refreshed for {len(selected_bars)} custom watchlist symbols.")
                    return MarketRefreshOutcome("updated", len(candidates), len(bars), len(selected_bars), tuple(diagnostics), tuple(bars))
                return MarketRefreshOutcome("empty", len(candidates), len(bars), 0, tuple(diagnostics), tuple(bars))
        symbols = load_watchlist(watchlist_path, config.symbol_whitelist)
        bars = fetch_daily_bars(
            config.market_data_provider,
            symbols,
            timeout=config.market_data_fetch_timeout_seconds,
            max_workers=config.market_data_fetch_workers,
            diagnostic_callback=diagnostics.append,
        )
        if bars:
            self._refresh_movement_watchlist(bars, rank_signals(bars, config))
            write_csv_bars(self.data_file, bars)
            self._clear_sample_data_marker()
            self._set_status_from_worker(f"Market data refreshed for {len(bars)} symbols.")
            return MarketRefreshOutcome("updated", len(symbols), len(bars), len(bars), tuple(diagnostics), tuple(bars))
        return MarketRefreshOutcome("empty", len(symbols), 0, 0, tuple(diagnostics), ())

    def _write_generated_watchlists(
        self,
        config: BotConfig,
        signals,
        previous_symbols: list[str],
        active_symbols: list[str],
    ) -> None:
        active = set(symbol.upper() for symbol in active_symbols)
        previous = set(symbol.upper() for symbol in previous_symbols)
        ranked = sorted(
            signals,
            key=lambda signal: (signal.scout_score, signal.sensible_score, signal.score),
            reverse=True,
        )
        movement = [
            signal.symbol.upper()
            for signal in ranked
            if signal.scout_score >= config.min_watchlist_scout_score
        ][: max(1, config.max_movement_watchlist_symbols)]
        trade_ready = [
            signal.symbol.upper()
            for signal in ranked
            if signal.symbol.upper() in active
            and signal.decision == "eligible"
            and signal.sensible_action == "trade"
        ]
        quiet = sorted(
            signal.symbol.upper()
            for signal in ranked
            if signal.symbol.upper() in previous - active
            and signal.scout_score < config.quiet_watchlist_scout_score
        )

        outputs = (
            (self._runtime_path(config.active_watchlist_path or self.active_watchlist_path), active_symbols, "active-watchlist"),
            (self._runtime_path(config.movement_watchlist_path or self.movement_watchlist_path), movement, "movement-watchlist"),
            (self._runtime_path(config.trade_ready_watchlist_path or self.trade_ready_watchlist_path), trade_ready, "trade-ready-watchlist"),
            (self._runtime_path(config.quiet_watchlist_path or self.quiet_watchlist_path), quiet, "quiet-watchlist"),
        )
        previous_by_name = {
            export_name: set(self._read_watchlist_symbols(path))
            for path, _symbols, export_name in outputs
        }
        signal_by_symbol = {signal.symbol.upper(): signal for signal in ranked}
        movement_rank = {signal.symbol.upper(): index for index, signal in enumerate(ranked)}
        movement_cap = max(1, config.max_movement_watchlist_symbols)

        def movement_added(symbol: str) -> str:
            signal = signal_by_symbol.get(symbol)
            if signal is None:
                return "qualified in the current movement scan"
            return f"scout score {signal.scout_score} meets ≥ {config.min_watchlist_scout_score}; ranked #{movement_rank[symbol] + 1}"

        def movement_removed(symbol: str) -> str:
            signal = signal_by_symbol.get(symbol)
            if signal is None:
                return "symbol was absent from the current signal scan"
            if signal.scout_score < config.min_watchlist_scout_score:
                return f"scout score {signal.scout_score} is below {config.min_watchlist_scout_score}"
            return f"ranked below the configured top-{movement_cap} movement cap"

        def trade_ready_reason(symbol: str, *, adding: bool) -> str:
            signal = signal_by_symbol.get(symbol)
            if adding and signal is not None:
                return "in active list, eligible, and signal action is Trade"
            if signal is None:
                return "symbol was absent from the current signal scan"
            if symbol not in active:
                return "no longer in the active watchlist"
            if signal.decision != "eligible":
                return f"decision is {signal.decision}, not eligible"
            if signal.sensible_action != "trade":
                return f"signal action is {signal.sensible_action}, not Trade"
            return "no longer meets the trade-ready rules"

        def quiet_added(symbol: str) -> str:
            signal = signal_by_symbol.get(symbol)
            if signal is None:
                return "removed from active and marked quiet in the current scan"
            return f"removed from active and scout score {signal.scout_score} is below {config.quiet_watchlist_scout_score}"

        def quiet_removed(symbol: str) -> str:
            signal = signal_by_symbol.get(symbol)
            if symbol in active:
                return "symbol returned to the active watchlist"
            if signal is None:
                return "symbol was absent from the current signal scan"
            if signal.scout_score >= config.quiet_watchlist_scout_score:
                return f"scout score recovered to {signal.scout_score} (quiet threshold {config.quiet_watchlist_scout_score})"
            return "symbol is no longer in the prior active-source set"

        change_notes: list[str] = []
        for _path, symbols, export_name in outputs:
            before = previous_by_name[export_name]
            after = set(str(symbol).upper() for symbol in symbols)
            if export_name == "active-watchlist":
                added_reason = lambda _symbol: "now included by the active watchlist source or rotation"
                removed_reason = lambda _symbol: "no longer included by the active watchlist source or rotation"
            elif export_name == "movement-watchlist":
                added_reason, removed_reason = movement_added, movement_removed
            elif export_name == "trade-ready-watchlist":
                added_reason = lambda symbol: trade_ready_reason(symbol, adding=True)
                removed_reason = lambda symbol: trade_ready_reason(symbol, adding=False)
            else:
                added_reason, removed_reason = quiet_added, quiet_removed
            change_notes.extend(explain_membership_changes(
                export_name.replace("-", " ").title(), before, after,
                added_reason=added_reason, removed_reason=removed_reason,
            ))
        self._latest_generated_watchlist_change_notes = change_notes
        for path, symbols, export_name in outputs:
            write_watchlist(path, symbols)
            self._write_watchlist_exports(symbols, export_name)
        self._refresh_integrity_manifest()
        self._sync_webull_generated_watchlists(config, {
            config.webull_active_watchlist_name: active_symbols,
            config.webull_movement_watchlist_name: movement,
            config.webull_trade_ready_watchlist_name: trade_ready,
            config.webull_quiet_watchlist_name: quiet,
        })

    def _sync_webull_generated_watchlists(self, config: BotConfig, lists: dict[str, list[str]]) -> None:
        if not config.webull_sync_watchlists:
            return
        results = sync_generated_watchlists(config, lists)
        failures = [result for result in results if result.status == "failed"]
        if failures:
            self._set_status_from_worker(f"Webull watchlist sync failed for {len(failures)} list(s).")
            return
        synced = [result for result in results if result.status == "synced"]
        if synced:
            added = sum(result.added_count for result in synced)
            removed = sum(result.removed_count for result in synced)
            self._set_status_from_worker(f"Webull watchlists synced: +{added} / -{removed}.")

    def _write_watchlist_exports(self, symbols: list[str], export_name: str = "active-watchlist") -> None:
        clean = sorted(dict.fromkeys(symbol.strip().upper() for symbol in symbols if symbol.strip()))
        try:
            (self.home / f"{export_name}-webull.txt").write_text("\n".join(clean) + "\n", encoding="utf-8")
            csv_lines = ["Symbol", *clean]
            (self.home / f"{export_name}-webull.csv").write_text("\n".join(csv_lines) + "\n", encoding="utf-8")
        except OSError:
            pass

    def _rotation_candidates(self, config: BotConfig, current_symbols: list[str]) -> list[str]:
        if config.watchlist_universe == "all-us":
            universe = self._load_market_universe(config)
            batch = self._next_universe_batch(universe, config.watchlist_universe_batch_size)
            return sorted(set(current_symbols) | set(batch))
        return sorted(
            set(current_symbols)
            | set(DEFAULT_ROTATION_CANDIDATES)
            | set(config.watchlist_rotation_candidates)
        )

    def _refresh_movement_watchlist(
        self,
        bars_by_symbol: dict,
        signals: list,
        synthetic: bool = False,
        scan_metadata: dict | None = None,
    ) -> None:
        if synthetic:
            # Expire old genuine records, but never let synthetic demo bars
            # create or extend a movement record or an upside setup.
            bars_by_symbol = {}
            signals = []
        try:
            payload = refresh_movement_tracker(
                self.movement_tracker_path,
                bars_by_symbol,
                signals=signals,
                now=datetime.now(),
                window_hours=96,
                scan_metadata=scan_metadata,
            )
            symbols = recent_mover_symbols(payload)
            _write_private_json(self.movement_tracker_path, payload)
            _write_private_text(
                self.recent_movers_path,
                "# Symbols with observed price movement in the rolling 96-hour window.\n"
                + "".join(f"{symbol}\n" for symbol in symbols),
            )
            self._movement_tracker_payload = payload
            pinned = tuple(getattr(getattr(self, "watchlist_organization", None), "pinned_symbols", ()))
            self._movement_recommendations = (
                [] if synthetic else top_upside_setups(payload, limit=10, pinned_symbols=pinned)
            )
            self._movement_recommendation_note = (
                "Recommendations withheld because current data are synthetic."
                if synthetic else ""
            )
            self._movement_tracker_error = ""
            self._refresh_integrity_manifest()
        except (MovementTrackerError, OSError, TypeError, ValueError) as exc:
            self._movement_tracker_error = str(exc)
            self._movement_tracker_payload = {}
            self._movement_recommendations = []
            self._movement_recommendation_note = "No recommendations shown; movement history could not be verified."
            self._set_status_from_worker(
                "96-hour movement tracker paused; saved history was preserved. "
                "Back up and repair the tracker before resuming."
            )

    def _persist_movement_candidates(self, config: BotConfig, bars_by_symbol: dict) -> None:
        """Save percentage-qualified discoveries separately from the active trade list."""
        if getattr(self, "_movement_tracker_error", ""):
            return
        candidates = top_movement_candidates(
            getattr(self, "_movement_tracker_payload", {}),
            limit=max(1, config.max_movement_watchlist_symbols),
            minimum_change_pct=config.movement_watchlist_min_change_pct,
            trade_candidate_change_pct=config.trade_candidate_min_change_pct,
        )
        target = self._runtime_path(config.movement_watchlist_path or self.movement_watchlist_path)
        symbols = [item["symbol"] for item in candidates]
        contents = (
            "# Auto-discovered from the rotating 96-hour percentage-movement scan.\n"
            "# Research candidates only; this file does not change the active trade watchlist.\n"
            + "".join(f"{symbol}\n" for symbol in symbols)
        )
        _write_private_text(target, contents)

        previous_bars: dict[str, list] = {}
        if self.movement_scan_bars_path.exists():
            try:
                previous_bars = load_csv_bars(self.movement_scan_bars_path)
            except (OSError, TypeError, ValueError):
                # Keep an unreadable prior cache untouched instead of erasing it.
                previous_bars = {}
        selected = {}
        for symbol in symbols:
            if symbol in bars_by_symbol:
                selected[symbol] = bars_by_symbol[symbol]
            elif symbol in previous_bars:
                selected[symbol] = previous_bars[symbol]
        write_csv_bars(self.movement_scan_bars_path, selected)
        try:
            self.movement_scan_bars_path.chmod(0o600)
        except OSError:
            pass
        self._movement_candidate_records = candidates
        self.automation_movement_candidates = frozenset(
            item["symbol"] for item in candidates if item.get("trade_candidate")
        )
        self._refresh_integrity_manifest()

    def _load_market_universe(self, config: BotConfig) -> list[str]:
        stale = True
        if self.universe_path.exists():
            age_seconds = datetime.now().timestamp() - self.universe_path.stat().st_mtime
            stale = age_seconds >= max(1, config.watchlist_universe_refresh_hours) * 3600
        if stale:
            try:
                symbols = fetch_us_listed_symbols(timeout=10)
                if symbols:
                    self.universe_path.write_text("\n".join(symbols) + "\n", encoding="utf-8")
                    self._refresh_integrity_manifest()
                    return symbols
            except Exception as exc:
                self._set_status_from_worker(f"Universe refresh skipped: {exc}")
        if self.universe_path.exists():
            return load_watchlist(self.universe_path, None)
        bundled = load_bundled_us_listed_symbols()
        if bundled:
            return bundled
        return sorted(DEFAULT_ROTATION_CANDIDATES)

    def _next_universe_batch(
        self,
        universe: list[str],
        batch_size: int,
        state_path: Path | None = None,
    ) -> list[str]:
        if not universe:
            return []
        limit = max(1, min(batch_size, len(universe)))
        cursor = self._rotation_cursor(state_path)
        start = cursor % len(universe)
        end = start + limit
        if end <= len(universe):
            batch = universe[start:end]
        else:
            batch = universe[start:] + universe[: end - len(universe)]
        self._save_rotation_cursor((start + limit) % len(universe), len(universe), state_path)
        return batch

    def _next_movement_universe_batch(
        self,
        universe: list[str],
        batch_size: int,
        state_path: Path | None = None,
    ) -> list[str]:
        """Prioritize pinned tickers while advancing non-pinned coverage fairly.

        Pinned symbols receive up to half of each multi-symbol batch and are
        placed first. For one-symbol batches, the persisted cadence is two pin
        scans followed by one non-pin scan. Each pool has an independent cursor.
        """
        symbols = list(dict.fromkeys(str(value).strip().upper() for value in universe if str(value).strip()))
        if not symbols:
            self._movement_batch_audit = {}
            return []

        path = state_path or self.movement_rotation_state_path
        organization = getattr(self, "watchlist_organization", None)
        raw_pins = getattr(organization, "pinned_symbols", ())
        pins = list(dict.fromkeys(str(value).strip().upper() for value in raw_pins if str(value).strip()))
        symbol_set = set(symbols)
        pin_pool = [symbol for symbol in pins if symbol in symbol_set]
        pin_set = set(pin_pool)
        other_pool = [symbol for symbol in symbols if symbol not in pin_set]
        pin_outside = len([symbol for symbol in pins if symbol not in symbol_set])
        limit = max(1, min(int(batch_size or 1), len(symbols)))

        try:
            state = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(state, dict):
                state = {}
        except (OSError, json.JSONDecodeError):
            state = {}
        try:
            pin_cursor = max(0, int(state.get("pin_cursor", 0)))
            other_cursor = max(0, int(state.get("nonpin_cursor", state.get("cursor", 0))))
            slot_cycle = max(0, int(state.get("slot_cycle", 0)))
        except (TypeError, ValueError, OverflowError):
            pin_cursor, other_cursor, slot_cycle = 0, 0, 0

        def take(pool: list[str], cursor: int, count: int) -> tuple[list[str], int]:
            if not pool or count <= 0:
                return [], cursor
            count = min(count, len(pool))
            start = cursor % len(pool)
            selected = [pool[(start + offset) % len(pool)] for offset in range(count)]
            return selected, (start + count) % len(pool)

        selected_pins: list[str] = []
        selected_others: list[str] = []
        if pin_pool and other_pool and limit == 1:
            choose_pin = slot_cycle % 3 != 2
            if choose_pin:
                selected_pins, pin_cursor = take(pin_pool, pin_cursor, 1)
            else:
                selected_others, other_cursor = take(other_pool, other_cursor, 1)
            slot_cycle = (slot_cycle + 1) % 3
        elif pin_pool and other_pool:
            pin_budget = max(1, limit // 2)
            other_budget = max(1, limit - pin_budget)
            pin_budget = min(pin_budget, len(pin_pool))
            other_budget = min(other_budget, len(other_pool))
            remaining = limit - pin_budget - other_budget
            if remaining and len(pin_pool) > pin_budget:
                extra = min(remaining, len(pin_pool) - pin_budget)
                pin_budget += extra
                remaining -= extra
            if remaining and len(other_pool) > other_budget:
                other_budget += min(remaining, len(other_pool) - other_budget)
            selected_pins, pin_cursor = take(pin_pool, pin_cursor, pin_budget)
            selected_others, other_cursor = take(other_pool, other_cursor, other_budget)
        elif pin_pool:
            selected_pins, pin_cursor = take(pin_pool, pin_cursor, limit)
        else:
            selected_others, other_cursor = take(other_pool, other_cursor, limit)

        batch = selected_pins + selected_others
        self._movement_batch_audit = {
            "pinned_requested_count": len(selected_pins),
            "pinned_universe_count": len(pin_pool),
            "pinned_outside_scope_count": pin_outside,
        }
        try:
            _write_private_json(path, {
                "pin_cursor": pin_cursor,
                "nonpin_cursor": other_cursor,
                "slot_cycle": slot_cycle,
                "universe_size": len(symbols),
                "pinned_universe_count": len(pin_pool),
                "saved_at": datetime.now().isoformat(),
            })
            self._refresh_integrity_manifest()
        except OSError:
            pass
        return batch

    def _rotation_cursor(self, state_path: Path | None = None) -> int:
        path = state_path or self.rotation_state_path
        try:
            state = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return 0
        try:
            return int(state.get("cursor", 0))
        except (TypeError, ValueError):
            return 0

    def _save_rotation_cursor(
        self,
        cursor: int,
        universe_size: int,
        state_path: Path | None = None,
    ) -> None:
        path = state_path or self.rotation_state_path
        state = {
            "cursor": cursor,
            "universe_size": universe_size,
            "saved_at": datetime.now().isoformat(),
        }
        try:
            _write_private_json(path, state)
            self._refresh_integrity_manifest()
        except OSError:
            pass

    def _runtime_path(self, path: str | Path) -> Path:
        candidate = Path(path).expanduser()
        if candidate.is_absolute():
            return candidate
        return self.home / candidate

    def _load_plans(self, config: BotConfig):
        if self._data_is_stale():
            return []
        plans = self._plans_from_signals(config, self.signals)
        if plans or not self._paper_simulation_enabled(config):
            return plans
        return self._paper_scout_plans(config, self.signals)

    def _plans_from_signals(self, config: BotConfig, signals):
        min_score = self._min_score(config)
        plans = []
        for signal in signals:
            operational_blocks = self._operational_blocks(signal, config)
            if (
                signal.score < min_score
                or operational_blocks
                or self._local_sensible_action(signal) != "trade"
            ):
                continue
            plan = create_order_plan(signal, config)
            if plan:
                plans.append(plan)
        return plans

    def _paper_simulation_enabled(self, config: BotConfig) -> bool:
        target = getattr(self, "execution_target_var", None)
        target_value = target.get() if target is not None else "Paper"
        return (
            config.trader_mode == "paper"
            and target_value == "Paper"
            and config.paper_simulation_enabled
        )

    def _paper_scout_plans(self, config: BotConfig, signals) -> list[OrderPlan]:
        plans: list[OrderPlan] = []
        min_scout_score = config.paper_simulation_min_scout_score
        for signal in signals:
            if signal.direction != "bullish":
                continue
            if signal.scout_score < min_scout_score:
                continue
            if signal.scout_action not in {"alert", "watch"}:
                continue
            if config.symbol_whitelist and signal.symbol.upper() not in config.symbol_whitelist:
                continue
            operational_blocks = self._operational_blocks(
                signal,
                config,
                include_session=not config.paper_simulation_ignore_market_hours,
                include_signal_quality=False,
            )
            if operational_blocks:
                continue
            plan = self._paper_scout_plan(signal, config)
            if plan:
                plans.append(plan)
        return plans

    def _paper_scout_plan(self, signal, config: BotConfig) -> OrderPlan | None:
        profile = asset_profile(signal.symbol, config)
        if profile.instrument_type != "EQUITY" or not profile.enabled:
            return None
        risk_per_share = max(signal.entry - signal.stop, 0.01)
        risk_qty = config.risk_per_trade_usd / risk_per_share
        notional_qty = profile.max_notional / max(signal.entry, 0.01)
        quantity = round(max(0.0, min(risk_qty, notional_qty, profile.max_quantity)), 4)
        if quantity <= 0 or quantity * signal.entry < 2.0:
            return None
        return OrderPlan(
            symbol=signal.symbol,
            side="BUY",
            quantity=quantity,
            order_type="LIMIT",
            limit_price=signal.entry,
            stop_price=signal.stop,
            target_price=signal.target,
            notional=round(quantity * signal.entry, 2),
            reason=(
                f"paper-scout-simulation {signal.setup} score={signal.score} "
                f"scout={signal.scout_score} buy-low/sell-high band"
            ),
            instrument_type=profile.instrument_type,
            time_in_force=profile.time_in_force,
            entrust_type=profile.entrust_type,
            support_trading_session=profile.support_trading_session,
            extra_payload=profile.extra_payload,
        )

    def _render_status(self) -> None:
        config = self.config
        if config is None:
            return
        execution_config = self._execution_config(config)
        self._refresh_webull_account_menu(execution_config)
        universe_count = self._pipeline_universe_count(config)
        active_count = self._watchlist_count(config.active_watchlist_path or self.active_watchlist_path)
        movement_count = self._watchlist_count(config.movement_watchlist_path or self.movement_watchlist_path)
        trade_ready_count = self._watchlist_count(config.trade_ready_watchlist_path or self.trade_ready_watchlist_path)
        self.universe_card[0].configure(text=f"{universe_count:,}")
        self.universe_card[1].configure(text=config.watchlist_universe if config.enable_watchlist_rotation else "custom seed")
        self.active_card[0].configure(text=f"{active_count:,}")
        self.active_card[1].configure(text="trade source" if config.enable_watchlist_rotation else "manual watchlist")
        self.movement_card[0].configure(text=f"{movement_count:,}")
        self.movement_card[1].configure(text=f"score >= {config.min_watchlist_scout_score}")
        self.trade_ready_card[0].configure(text=f"{trade_ready_count:,}")
        self.trade_ready_card[1].configure(text="before broker gates")
        self.plan_card[0].configure(text=f"{len(self.plans):,}")
        self.plan_card[1].configure(text=self._lane_mode_label())
        self.paper_cash_snapshot = self._paper_account_snapshot()
        self.cash_card[0].configure(text=self.trade_cash_snapshot[0])
        self.cash_card[1].configure(text=self.trade_cash_snapshot[1])
        self.paper_cash_card[0].configure(text=self.paper_cash_snapshot[0])
        self.paper_cash_card[1].configure(text=self.paper_cash_snapshot[1])
        self.guard_label.configure(
            text="Live on" if self._live_ready(execution_config) else "Live locked",
            fg=self.colors["red"] if self._live_ready(execution_config) else self.colors["gold"],
        )
        self.eligible_label.configure(text=f"Plans {len(self.plans)}")
        if self._market_data_load_error:
            self.runtime_label.configure(text="Data file invalid", fg=self.colors["red"])
        elif self._settings_save_error:
            self.runtime_label.configure(text="Settings issue", fg=self.colors["red"])
        elif not self.bars_by_symbol:
            self.runtime_label.configure(text="No market data", fg=self.colors["gold"])
        elif self._sample_data_in_use:
            self.runtime_label.configure(text="Synthetic sample", fg=self.colors["gold"])
        else:
            self.runtime_label.configure(
                text="Ready" if not self.config_error else "Safe fallback",
                fg=self.colors["teal"] if not self.config_error else self.colors["gold"],
            )
        self.last_update_label.configure(text=self._data_freshness_line())
        scan_status_label = getattr(self, "market_scan_status_label", None)
        if scan_status_label is not None and not self._refresh_in_progress:
            progress = getattr(self, "_movement_scan_progress", {})
            unavailable = int(progress.get("failed", 0) or 0) if isinstance(progress, dict) else 0
            scan_status_label.configure(
                text=self._market_scan_status_line(),
                fg=self.colors["gold"] if unavailable else self.colors["muted"],
            )
        session = market_session()
        if session.is_open and session.closes_at:
            session_text = f"US EQUITIES · OPEN TILL {session.closes_at.strftime('%I:%M %p').lstrip('0')} ET"
            session_color = self.colors["green"]
        elif session.opens_at:
            session_text = f"US EQUITIES · OPENS {session.opens_at.strftime('%a %I:%M %p').lstrip('0')} ET"
            session_color = self.colors["gold"]
        else:
            session_text = "US EQUITIES · CLOSED"
            session_color = self.colors["muted"]
        self.market_session_label.configure(text=session_text, fg=session_color)
        terminal_session = getattr(self, "terminal_session_label", None)
        if terminal_session is not None:
            terminal_session.configure(text=session_text, fg=session_color)
        terminal_data = getattr(self, "terminal_data_label", None)
        if terminal_data is not None:
            if self._market_data_load_error:
                data_state, data_color = "INVALID", self.colors["red"]
            elif self._sample_data_in_use:
                data_state, data_color = "SAMPLE", self.colors["gold"]
            elif not self.bars_by_symbol:
                data_state, data_color = "MISSING", self.colors["gold"]
            elif self._data_is_stale():
                data_state, data_color = "STALE", self.colors["gold"]
            else:
                data_state, data_color = "FRESH", self.colors["green"]
            terminal_data.configure(text=f"DATA · {data_state}", fg=data_color)
        terminal_mode = getattr(self, "terminal_mode_label", None)
        if terminal_mode is not None:
            mode_text = self.execution_mode_var.get().upper()
            target_text = self.execution_target_var.get().upper()
            if target_text == "LIVE" and not self._live_ready(execution_config):
                terminal_mode.configure(text="LIVE · LOCKED", fg=self.colors["gold"])
            else:
                lane_text = target_text
                lane_color = self.colors["red"] if target_text == "LIVE" else (
                    self.colors["teal"] if target_text == "SIMULATION" else self.colors["green"]
                )
                terminal_mode.configure(text=f"{lane_text} · {mode_text}", fg=lane_color)
        self._sync_execution_target_controls()
        self._sync_webull_account_toggle(execution_config)

    def _lane_mode_label(self) -> str:
        lanes = []
        if self.paper_auto_var.get():
            lanes.append("Paper")
        if self.execution_target_var.get() == "Live" and self.execution_mode_var.get() == "Auto":
            lanes.append("Live")
        if self.execution_target_var.get() == "Simulation" and self.execution_mode_var.get() == "Auto":
            lanes.append("Simulation / local")
        if len(lanes) > 1:
            return " + ".join(lanes) + " / Auto"
        return f"{self.execution_target_var.get()} / {self.execution_mode_var.get()}"

    def _paper_portfolio_records(self) -> list[dict]:
        records: dict[tuple[str, ...], dict] = {}
        for index, event in enumerate(getattr(self, "execution_events", [])):
            if event.get("mode") != "paper":
                continue
            order = event.get("order") or {}
            symbol = str(event.get("symbol") or order.get("symbol") or "").upper()
            if not symbol:
                continue
            order_id = str(event.get("client_order_id") or event.get("order_id") or order.get("client_order_id") or "").strip()
            if order_id:
                trade_key = ("id", order_id)
            else:
                submitted = str(event.get("submitted_at") or event.get("recorded_at") or "")
                if not submitted:
                    trade_key = ("row", str(index))
                else:
                    trade_key = (
                        "fallback", symbol, submitted,
                        str(event.get("quantity") or order.get("quantity") or ""),
                        str(event.get("buy_price") or order.get("limit_price") or ""),
                    )
            previous = records.get(trade_key)
            terminal = event.get("sell_status") in {"target-hit", "stopped"}
            previous_terminal = previous and previous.get("sell_status") in {"target-hit", "stopped"}
            if previous is None or (terminal and not previous_terminal):
                records[trade_key] = event
            elif terminal and previous_terminal:
                event_time = str(event.get("closed_at") or event.get("recorded_at") or "")
                previous_time = str(previous.get("closed_at") or previous.get("recorded_at") or "")
                if event_time >= previous_time:
                    if self._float_or_none(event.get("paper_pnl")) is None:
                        old_pnl = self._float_or_none(previous.get("paper_pnl"))
                        if old_pnl is not None:
                            event = {**event, "paper_pnl": old_pnl}
                    records[trade_key] = event
        return list(records.values())

    def _edit_trader_profile(self) -> None:
        dialog = tk.Toplevel(self.root)
        dialog.title("Trader scorecard profile")
        dialog.transient(self.root)
        dialog.configure(bg=self.colors["panel"])
        dialog.columnconfigure(1, weight=1)
        tk.Label(dialog, text="SELF-REPORTED CONTEXT", bg=self.colors["panel"], fg=self.colors["teal"],
                 font=("Sans", 10, "bold"), anchor="w").grid(row=0, column=0, columnspan=2,
                                                               sticky="ew", padx=16, pady=(14, 8))
        tk.Label(dialog, text="Years trading", bg=self.colors["panel"], fg=self.colors["muted"],
                 font=("Sans", 9, "bold")).grid(row=1, column=0, sticky="w", padx=16, pady=7)
        years_var = tk.StringVar(value=self.trader_experience_years_var.get())
        years_entry = tk.Entry(dialog, textvariable=years_var, width=10, bg=self.colors["entry"],
                               fg=self.colors["text"], insertbackground=self.colors["text"], relief="flat")
        years_entry.grid(row=1, column=1, sticky="w", padx=8, pady=7, ipady=4)
        tk.Label(dialog, text="Risk preference", bg=self.colors["panel"], fg=self.colors["muted"],
                 font=("Sans", 9, "bold")).grid(row=2, column=0, sticky="w", padx=16, pady=7)
        preference_var = tk.StringVar(value=self.trader_risk_preference_var.get())
        ttk.Combobox(dialog, textvariable=preference_var,
                     values=("Not set", "Conservative", "Moderate", "Aggressive"),
                     state="readonly", width=16).grid(row=2, column=1, sticky="w", padx=8, pady=7)
        disclosure = (
            "Trading can lose money. Margin and other leverage can magnify losses. "
            "This scorecard is an educational summary, not a credit score, broker rating, "
            "or assessment that a strategy is suitable for you."
        )
        tk.Label(dialog, text=disclosure, bg=self.colors["panel_2"], fg=self.colors["text"],
                 font=("Sans", 9), justify="left", wraplength=470, padx=12, pady=10).grid(
                     row=3, column=0, columnspan=2, sticky="ew", padx=16, pady=(8, 6))
        acknowledged = tk.BooleanVar(value=self.trader_risk_acknowledged_var.get())
        tk.Checkbutton(dialog, text="I have reviewed and understand this risk summary.", variable=acknowledged,
                       bg=self.colors["panel"], fg=self.colors["text"], selectcolor=self.colors["panel_2"],
                       activebackground=self.colors["panel"], activeforeground=self.colors["text"],
                       font=("Sans", 9), wraplength=460, justify="left").grid(
                           row=4, column=0, columnspan=2, sticky="w", padx=16, pady=8)
        buttons = tk.Frame(dialog, bg=self.colors["panel"])
        buttons.grid(row=5, column=0, columnspan=2, sticky="e", padx=16, pady=(8, 14))

        def save_profile() -> None:
            raw_years = years_var.get().strip()
            if raw_years:
                try:
                    years = int(raw_years)
                except ValueError:
                    messagebox.showerror("Profile not saved", "Years trading must be a whole number from 0 to 80.", parent=dialog)
                    return
                if not 0 <= years <= 80:
                    messagebox.showerror("Profile not saved", "Years trading must be between 0 and 80.", parent=dialog)
                    return
            else:
                years = None
            self.trader_experience_years_var.set("" if years is None else str(years))
            self.trader_risk_preference_var.set(preference_var.get())
            self.trader_risk_acknowledged_var.set(bool(acknowledged.get()))
            self.trader_risk_acknowledged_at = datetime.now().isoformat() if acknowledged.get() else ""
            self._save_runtime_settings()
            dialog.destroy()
            self._render_portfolio_panel()

        self._button(buttons, "Cancel", dialog.destroy).pack(side="right", padx=(8, 0))
        self._button(buttons, "Save profile", save_profile, accent="teal").pack(side="right")
        dialog.bind("<Return>", lambda _event: save_profile())
        dialog.bind("<Escape>", lambda _event: dialog.destroy())
        dialog.grab_set()
        years_entry.focus_set()

    def _render_portfolio_panel(self) -> None:
        if not hasattr(self, "portfolio_holdings_tree"):
            return
        records = self._paper_portfolio_records()
        closed = [event for event in records if event.get("sell_status") in {"target-hit", "stopped"}]
        opened = [event for event in records if event.get("sell_status") == "target-pending"]
        config = self.config or self._load_config_safe()
        raw_starting_balance = self._paper_starting_balance()
        starting_balance = (raw_starting_balance if math.isfinite(raw_starting_balance) and raw_starting_balance > 0
                            else None)
        paper_stats = paper_performance(self.execution_events, starting_balance=starting_balance)
        score_journal = summarize_paper_journal(self.execution_events)
        score_missing_pnl = max(
            score_journal.closed_trades_missing_pnl,
            1 if score_journal.closed_trade_count != paper_stats.closed_trades else 0,
        )
        realized_value = (0.0 if paper_stats.closed_trades == 0 and score_journal.closed_trade_count == 0
                          else paper_stats.realized_pnl)
        unrealized = 0.0
        market_value = 0.0
        pending_cost = 0.0
        market_value_complete = True
        pending_cost_complete = True
        symbol_exposure: dict[str, float] = {}
        asset_exposure: dict[str, float] = {}
        self.portfolio_holdings_tree.delete(*self.portfolio_holdings_tree.get_children())
        for event in sorted(opened, key=lambda item: str(item.get("submitted_at", "")), reverse=True):
            order = event.get("order") or {}
            symbol = str(event.get("symbol") or order.get("symbol") or "").upper()
            quantity = self._float_or_none(event.get("quantity") or order.get("quantity"))
            entry = self._float_or_none(event.get("buy_price") or order.get("limit_price"))
            signal = self.signal_by_symbol.get(symbol)
            bars = self.bars_by_symbol.get(symbol, [])
            last = float(signal.close) if signal is not None else (float(bars[-1].close) if bars else None)
            valid_position = bool(quantity is not None and math.isfinite(quantity) and quantity > 0
                                  and entry is not None and math.isfinite(entry) and entry > 0)
            mark_valid = last is not None and last > 0 and math.isfinite(last)
            if valid_position:
                pending_cost += quantity * entry
            else:
                pending_cost_complete = False
            if valid_position and mark_valid:
                value = quantity * last
                open_pnl = (last - entry) * quantity
                market_value += value
                unrealized += open_pnl
                symbol_exposure[symbol] = symbol_exposure.get(symbol, 0.0) + value
                asset_type = asset_profile(symbol, config).instrument_type
                asset_exposure[asset_type] = asset_exposure.get(asset_type, 0.0) + value
                last_text, value_text, pnl_text = money(last), money(value), money(open_pnl)
                tag = "up" if open_pnl > 0 else "down" if open_pnl < 0 else ""
            else:
                market_value_complete = False
                last_text = value_text = pnl_text = "—"
                tag = ""
            self.portfolio_holdings_tree.insert(
                "", "end",
                values=(symbol, f"{quantity:g}" if quantity is not None and math.isfinite(quantity) else "—",
                        money(entry) if entry is not None and math.isfinite(entry) else "—",
                        last_text, value_text, pnl_text,
                        "OPEN · PAPER" if mark_valid else "OPEN · NO MARK"),
                tags=(tag,) if tag else (),
            )
        if not opened:
            self.portfolio_holdings_tree.insert(
                "", "end", values=("No open paper positions", "-", "-", "-", "-", "-", "Waiting"))
        available_cash = (round(starting_balance + realized_value - pending_cost, 2)
                          if starting_balance is not None and realized_value is not None and pending_cost_complete else None)
        equity = (available_cash + market_value
                  if available_cash is not None and market_value_complete else None)
        open_pnl_value = unrealized if market_value_complete else None
        paper_cash_label = (money(available_cash) if available_cash is not None else
                            "— · balance unavailable" if starting_balance is None else "— · journal incomplete")
        equity_label = (money(equity) if equity is not None else
                        "— · balance unavailable" if starting_balance is None else
                        "— · marks incomplete" if not market_value_complete else "— · journal incomplete")
        self._update_label_map(
            self.portfolio_summary_labels,
            {
                "Paper Equity": equity_label,
                "Realized P&L": money(realized_value) if realized_value is not None else "— · P&L incomplete",
                "Open P&L": money(open_pnl_value) if open_pnl_value is not None else "— · mark unavailable",
                "Available Cash": paper_cash_label,
                "Open Positions": f"{len(opened):,}",
            },
        )
        paper_return = (f"{paper_stats.return_pct:+.2f}%" if paper_stats.return_pct is not None
                        else "no closed trades" if score_journal.closed_trade_count == 0 else "incomplete")
        drawdown = (f"{money(paper_stats.max_drawdown_usd)} / {paper_stats.max_drawdown_pct:.2f}%"
                    if paper_stats.max_drawdown_usd is not None and paper_stats.max_drawdown_pct is not None else "incomplete")
        self.portfolio_account_context.configure(
            text=f"BROKER · {self._webull_account_card_value(config)} · cash {self.trade_cash_snapshot[0]} "
                 f"({self.trade_cash_snapshot[1]})  |  PAPER MARKS · {self._data_freshness_line()}  |  "
                 "Equity uses starting balance, realized closes, and available local price marks.")
        top_symbol, top_value = max(symbol_exposure.items(), key=lambda item: item[1], default=(None, 0.0))
        concentration_pct = (top_value / market_value * 100.0) if market_value > 0 and market_value_complete else None
        asset_text = (", ".join(f"{name} {money(value)}" for name, value in sorted(asset_exposure.items()))
                      if asset_exposure and market_value_complete else "unavailable · price marks incomplete")
        concentration = (f"{top_symbol} {concentration_pct:.0f}% of marked exposure"
                         if top_symbol and concentration_pct is not None else "not available")
        concentration_flag = " · CONCENTRATED (>50%)" if concentration_pct is not None and concentration_pct > 50 else ""
        period_stats = summarize_paper_period_returns(
            self.execution_events, as_of=datetime.now().astimezone(), starting_balance=starting_balance)
        def period_text(label: str, pnl: float | None, pct: float | None, count: int, missing: int) -> str:
            if missing:
                return f"{label} incomplete"
            if not count:
                return f"{label} —"
            return f"{label} {money(pnl)}" + (f" ({pct:+.2f}%)" if pct is not None else "")
        history_confidence = (
            "NO CLOSED HISTORY" if score_journal.closed_trade_count == 0 else
            "JOURNAL COMPLETE" if score_missing_pnl == 0 else
            f"DATA INCOMPLETE · {score_missing_pnl} close(s) missing P&L"
        )
        score_confidence = (
            "NO HISTORY" if score_journal.closed_trade_count == 0 else
            "P&L OK" if score_missing_pnl == 0 else f"{score_missing_pnl} P&L MISSING"
        )
        self.portfolio_risk_context.configure(
            text=(f"CLOSED PAPER · {score_journal.closed_trade_count} trades · RETURN {paper_return} · "
                  f"PEAK DRAWDOWN {drawdown} · {period_text('TODAY', period_stats.daily_pnl, period_stats.daily_return_pct, period_stats.daily_closed_trades, period_stats.daily_missing_pnl)} · "
                  f"{period_text('WEEK', period_stats.weekly_pnl, period_stats.weekly_return_pct, period_stats.weekly_closed_trades, period_stats.weekly_missing_pnl)} · "
                  f"EXPOSURE {asset_text} · TOP {concentration}{concentration_flag} · {history_confidence}. "
                  "Sector tags are not available in the local position journal."))
        account_ready = self.trade_cash_value is not None and not self._broker_check_required(config)
        trader_score = calculate_trader_profile_score(
            closed_paper_trades=score_journal.closed_trade_count,
            paper_return_pct=paper_stats.return_pct,
            max_drawdown_pct=paper_stats.max_drawdown_pct,
            starting_balance=paper_stats.starting_balance,
            risk_per_trade=config.risk_per_trade_usd,
            max_daily_loss=config.max_daily_loss_usd,
            account_snapshot_available=account_ready,
            experience_years=(float(self.trader_experience_years_var.get())
                              if self.trader_experience_years_var.get().isdigit() else None),
            risk_profile_complete=(self.trader_risk_preference_var.get() != "Not set"
                                   and self.trader_risk_acknowledged_var.get()),
            closed_trades_missing_pnl=max(
                score_missing_pnl,
            ),
        )
        live_score = calculate_trader_profile_score(
            closed_paper_trades=0,
            paper_return_pct=None,
            max_drawdown_pct=None,
            starting_balance=None,
            risk_per_trade=config.risk_per_trade_usd,
            max_daily_loss=config.max_daily_loss_usd,
            account_snapshot_available=account_ready,
            experience_years=(float(self.trader_experience_years_var.get())
                              if self.trader_experience_years_var.get().isdigit() else None),
            risk_profile_complete=(self.trader_risk_preference_var.get() != "Not set"
                                   and self.trader_risk_acknowledged_var.get()),
            lane_label="Live",
        )
        self.trader_score_value.configure(
            text=f"PAPER  {trader_score.score} / 100" if trader_score.score is not None else "PAPER  — / 100"
        )
        grade_colors = {"Poor": self.colors["red"], "OK": self.colors["gold"],
                        "Good": self.colors["teal"], "Excellent": self.colors["green"],
                        "Building profile": self.colors["muted"]}
        self.trader_score_grade.configure(
            text=(f"{trader_score.grade.upper()} · {trader_score.closed_paper_trades}/20 · "
                  f"{score_confidence} · {trader_score.coverage_pct}% DATA"),
            fg=grade_colors.get(trader_score.grade, self.colors["muted"]),
        )
        self.trader_live_score_value.configure(
            text=f"LIVE  {live_score.score} / 100" if live_score.score is not None else "LIVE  — / 100"
        )
        self.trader_live_score_grade.configure(
            text=(f"{live_score.grade.upper()} · {live_score.coverage_pct}% DATA COVERAGE"
                  if live_score.grade != "Building profile" else "BUILDING · NO CLOSED LIVE P&L DATA"),
            fg=grade_colors.get(live_score.grade, self.colors["muted"]),
        )
        score_lines = [
            f"PAPER HISTORY · {score_journal.closed_trade_count} closed / 20 required to grade",
            f"REALIZED P&L DATA · {history_confidence}",
            "Open paper marks are excluded from score history; live P&L history is not recorded here.",
            "Daily/weekly percentages use the configured paper starting balance as denominator.",
            "",
            "SCORE FACTORS",
        ]
        score_lines.extend(
            (f"{part.name}: {part.score:.0f}/100 · {part.detail}" if part.score is not None
             else f"{part.name}: unavailable · {part.detail}")
            for part in trader_score.components
        )
        paper_next_steps = recommend_trader_scorecard_next_steps(
            scorecard=trader_score,
            lane_label="Paper",
            realized_return_pct=paper_stats.return_pct,
            max_drawdown_pct=paper_stats.max_drawdown_pct,
            closed_trades_missing_pnl=max(
                score_missing_pnl,
            ),
        )
        live_next_steps = recommend_trader_scorecard_next_steps(
            scorecard=live_score,
            lane_label="Live",
            realized_return_pct=None,
            max_drawdown_pct=None,
        )
        score_lines.extend(("", "WHAT TO DO NEXT · OPTIONAL REVIEW STEPS",
                            *[f"Paper: {step}" for step in paper_next_steps],
                            *[f"Live: {step}" for step in live_next_steps],
                            "",
                            "Bands: Poor 0–39 · OK 40–59 · Good 60–79 · Excellent 80–100",
                            f"Rubric: 50% return and 50% drawdown; at least 20 closed trades required.",
                            "Return: -10% to +10% maps to 0-100; drawdown: 10% to 0% maps to 0-100.",
                            "Profile answers, open P&L, account wealth, buying power, and configured limits do not change the score.",
                            "Paper and Live histories stay separate. Internal educational indicator; not a credit score."))
        self.trader_score_detail.configure(state="normal")
        self.trader_score_detail.delete("1.0", "end")
        self.trader_score_detail.insert("1.0", "\n".join(score_lines))
        self.trader_score_detail.configure(state="disabled")
        self._portfolio_curve_values = [starting_balance or 0.0]
        self._portfolio_curve_complete = (starting_balance is not None and score_missing_pnl == 0
                                          and len(closed) == score_journal.closed_trade_count)
        for event in sorted(closed, key=lambda item: str(item.get("closed_at") or item.get("submitted_at") or "")):
            pnl = self._float_or_none(event.get("paper_pnl"))
            if pnl is None or not math.isfinite(pnl):
                self._portfolio_curve_complete = False
                break
            self._portfolio_curve_values.append(self._portfolio_curve_values[-1] + pnl)
        if not self._portfolio_curve_complete:
            self._portfolio_curve_values = []
        recent = sorted(closed, key=lambda item: str(item.get("closed_at") or item.get("submitted_at") or ""), reverse=True)[:8]
        if recent:
            lines = []
            for event in recent:
                symbol = str(event.get("symbol") or (event.get("order") or {}).get("symbol") or "?").upper()
                pnl = self._float_or_none(event.get("paper_pnl"))
                state = "TARGET" if event.get("sell_status") == "target-hit" else "STOP"
                when = str(event.get("closed_at") or event.get("submitted_at") or "")[:16].replace("T", " ")
                lines.append(f"{when}  {symbol:<7} {state:<7} {(money(pnl) if pnl is not None and math.isfinite(pnl) else 'P&L —'):>12}")
            self._set_text(self.portfolio_activity_text, "\n".join(lines))
        else:
            self._set_text(self.portfolio_activity_text, "No closed paper trades yet.\n\nCompleted paper outcomes will appear here after market bars reach a stop or target.")
        self._draw_portfolio_equity()

    def _draw_portfolio_equity(self) -> None:
        canvas = getattr(self, "portfolio_equity_chart", None)
        if canvas is None:
            return
        try:
            canvas.delete("all")
            width, height = max(1, canvas.winfo_width()), max(1, canvas.winfo_height())
        except tk.TclError:
            return
        values = getattr(self, "_portfolio_curve_values", [])
        if not getattr(self, "_portfolio_curve_complete", True):
            canvas.create_text(width / 2, height / 2,
                               text="Equity curve withheld · closed journal data is incomplete",
                               fill=self.colors["gold"], font=("Sans", 9), anchor="center", width=max(width - 32, 1))
            return
        if len(values) < 2:
            baseline = height * 0.55
            canvas.create_line(24, baseline, width - 16, baseline, fill=self.colors["line"], dash=(3, 4))
            canvas.create_text(width / 2, height / 2, text="Closed trade history will draw here",
                               fill=self.colors["muted"], font=("Sans", 9), anchor="center")
            return
        low, high = min(values), max(values)
        spread = max(high - low, abs(high) * 0.002, 1.0)
        low -= spread * 0.18
        high += spread * 0.18
        left, right, top, bottom = 38, max(39, width - 12), 12, max(13, height - 20)
        for fraction in (0.0, 0.5, 1.0):
            y = bottom - fraction * (bottom - top)
            value = low + fraction * (high - low)
            canvas.create_line(left, y, right, y, fill=self.colors["line"])
            canvas.create_text(2, y, text=f"${value:,.0f}", fill=self.colors["muted"],
                               font=("Sans", 7), anchor="w")
        points = []
        for index, value in enumerate(values):
            x = left + index * (right - left) / (len(values) - 1)
            y = bottom - (value - low) * (bottom - top) / max(high - low, 1e-9)
            points.extend((x, y))
        color = self.colors["green"] if values[-1] >= values[0] else self.colors["red"]
        canvas.create_line(*points, fill=color, width=2, smooth=True, splinesteps=12)
        canvas.create_oval(points[-2] - 3, points[-1] - 3, points[-2] + 3, points[-1] + 3,
                           fill=color, outline=color)

    def _render_automation_panel(self) -> None:
        if not hasattr(self, "automation_readiness_text"):
            return
        config = self.config or self._load_config_safe()
        live_ready = self._live_ready(self._execution_config(config))
        interval = self._bounded_int(self.auto_interval_var, 1, 1, 60)
        live_block = (self._live_auto_block_reason()
                      if self.execution_target_var.get() == "Live" and self.execution_mode_var.get() == "Auto"
                      else "")
        if self._automation_cycle_in_progress:
            next_cycle = "Running"
        elif self._automatic_fallback_active:
            next_cycle = f"Auto retry in {self._automatic_fallback_retry_seconds()}s"
        elif live_block and self.execution_target_var.get() == "Live" and self.execution_mode_var.get() == "Auto":
            next_cycle = "Paper continues · Live held" if self.paper_auto_var.get() else "Held · review required"
        elif self._automation_next_run_at is not None:
            due = self._automation_next_run_at.astimezone(ZoneInfo("America/New_York"))
            next_cycle = f"Due {due.strftime('%I:%M %p ET').lstrip('0')}"
        elif self.market_open_after_id:
            next_cycle = "Armed for open"
        elif self.paper_auto_var.get() or self.execution_mode_var.get() == "Auto":
            next_cycle = f"Every {interval} min"
        else:
            next_cycle = "Paused"
        readiness = readiness_flags(config, plans_count=len(self.plans), events_count=len(self.execution_events))
        cycle_state = (
            "running" if self._automation_cycle_in_progress else
            "held" if (self._automation_hold_reason or live_block and self.execution_target_var.get() == "Live") else
            "waiting" if self._automation_wait_reason else
            "healthy" if self._automation_enabled() else "paused"
        )
        enabled_lanes = []
        if self.paper_auto_var.get():
            enabled_lanes.append("Paper")
        if self.execution_target_var.get() == "Simulation" and self.execution_mode_var.get() == "Auto":
            enabled_lanes.append("Simulation")
        if self.execution_target_var.get() == "Live" and self.execution_mode_var.get() == "Auto":
            enabled_lanes.append("Live")
        cycle_snapshot = AutomationCycleSnapshot(
            state=cycle_state,
            target=self.execution_target_var.get(),
            mode=self.execution_mode_var.get(),
            enabled_lanes=tuple(enabled_lanes),
            next_run_at=self._automation_next_run_at,
            last_run_at=self._automation_last_run_at,
            last_duration_seconds=self._automation_last_duration_seconds,
            last_result=self._automation_last_result,
            wait_reason=self._automation_wait_reason,
            hold_reason=live_block or self._automation_hold_reason,
            data_status=self._data_freshness_line(),
        )
        raw_starting_balance = self._paper_starting_balance()
        paper_starting_balance = (raw_starting_balance if math.isfinite(raw_starting_balance)
                                  and raw_starting_balance > 0 else None)
        insight_events = tuple(self.execution_events[-5000:])
        backend_view = build_automation_backend_view(
            cycle_snapshot,
            self._latest_automation_risk_decision,
            # The periodic preflight fetches open orders and positions only;
            # it does not fetch terminal order history, so a full journal
            # reconciliation would overstate completeness.
            live_journal_events=None,
            broker_orders=self._latest_automation_broker_orders,
            broker_positions=self._latest_automation_broker_positions,
            paper_events=insight_events,
            simulation_events=insight_events,
            paper_starting_balance=paper_starting_balance,
            # No separate Simulation starting-balance setting exists; keep
            # return and percentage drawdown unavailable instead of borrowing Paper's.
            simulation_starting_balance=None,
        )
        risk_view = backend_view.risk
        reconciliation = backend_view.live_reconciliation
        mode = self.execution_mode_var.get()
        target = self.execution_target_var.get()
        current_state = backend_view.cycle.state
        if current_state == "running":
            next_action = "Cycle running · market data and signals are updating."
        elif current_state == "held":
            next_action = f"Review the Live hold, then reconcile before resuming: {backend_view.cycle.hold_reason or live_block}"
        elif current_state == "waiting":
            next_action = f"Waiting for a safe cycle: {backend_view.cycle.wait_reason or 'current work to finish.'}"
        elif mode == "User":
            next_action = "User mode · review the plan, then use Run Cycle or Preview / Submit below."
        elif live_block and target == "Live":
            next_action = f"Live Auto is held: {live_block}"
        elif self._automatic_fallback_active:
            next_action = f"Auto will retry in {self._automatic_fallback_retry_seconds()}s · {self._automatic_fallback_reason}"
        elif self._automation_enabled():
            next_action = f"Auto is scheduled · next cycle {next_cycle.lower()}."
        else:
            next_action = "Choose User or Auto and select a target to begin."

        account_ok = not self._broker_check_required(self._execution_config(config))
        data_line = self._data_freshness_line()
        if "fresh" in data_line.lower():
            health_value = "Data current"
        elif "synthetic" in data_line.lower():
            health_value = "Synthetic data"
        elif "stale" in data_line.lower():
            health_value = "Stale data"
        else:
            health_value = "Check data"
        if target == "Live" and not account_ok:
            health_value = "Account check needed"
        self._update_label_map(self.automation_summary_labels, {
            "Automation": "PAUSED" if current_state == "idle" else current_state.upper(),
            "Mode": mode,
            "Target": target,
            "Next Cycle": next_cycle,
            "Data / Account": health_value,
        })

        blockers: list[str] = []
        if backend_view.cycle.hold_reason:
            blockers.append(f"Live hold · {backend_view.cycle.hold_reason}")
        if backend_view.cycle.wait_reason and backend_view.cycle.wait_reason not in blockers:
            blockers.append(f"Cycle wait · {backend_view.cycle.wait_reason}")
        if live_block:
            blockers.append(f"Live readiness · {live_block}")
        if target == "Live" and not account_ok:
            blockers.append("Account · run Check Webull account in Broker and confirm the selected account.")
        if "unavailable" in self._data_freshness_line().lower() or "stale" in self._data_freshness_line().lower():
            blockers.append(f"Market data · {self._data_freshness_line()}")
        if risk_view.state == "blocked":
            blockers.extend(f"Risk · {reason}" for reason in risk_view.reasons[:4])
        elif risk_view.state == "unavailable" and target == "Live" and mode == "Auto":
            blockers.append("Risk · no Live Auto risk decision has been recorded this session.")
        if readiness.get("red_flags"):
            blockers.extend(f"Readiness · {item}" for item in readiness["red_flags"][:3])

        lines = [next_action, "", f"Selected workflow · {target} / {mode}",
                 f"Paper lane · {'armed' if self.paper_auto_var.get() else 'paused'} (local ledger)",
                 f"Live submission · {'guarded and ready' if live_ready else 'locked'} · Live Auto opt-in {'on' if config.auto_start_live_on_market_open else 'off'}",
                 (f"Movement discovery · {len(getattr(self, '_movement_candidate_records', []))} saved · "
                  f"{len(getattr(self, 'automation_movement_candidates', ()))} potential trade candidate(s) · "
                  f"daily move thresholds {config.movement_watchlist_min_change_pct:.1f}% / "
                  f"{config.trade_candidate_min_change_pct:.1f}%"),
                 f"Market data · {self._data_freshness_line()}",
                 f"Live account snapshot · {'checked' if account_ok else 'check required'} · "
                 f"manual plans {len(self.plans):,} · auto candidate plans {len(self._automation_movement_plans()):,}",
                 f"Latest Live risk evaluation · {risk_view.state.upper()}"
                 + (f" · {risk_view.symbol} {risk_view.quantity:g} shares / {money(risk_view.notional)}"
                    if risk_view.quantity is not None and risk_view.notional is not None else "")]
        if risk_view.guards:
            lines.extend(f"  {name} · {status} · {reason}" for name, status, reason in risk_view.guards[:4])
        if blockers:
            lines.extend(("", "ACTIONABLE BLOCKERS"))
            lines.extend(f"• {item}" for item in blockers[:8])
        elif current_state in {"healthy", "idle"}:
            lines.extend(("", "No current risk or readiness blockers are reported."))
        lines.extend(("", "LIVE ORDER LIFECYCLE", self._latest_automation_lifecycle_summary))
        if self._latest_automation_broker_orders is None or self._latest_automation_broker_positions is None:
            lines.append("Broker snapshot · unavailable this session; no order/position state is inferred.")
        else:
            lines.append(f"Broker snapshot · {len(self._latest_automation_broker_orders)} open-order rows · "
                         f"{len(self._latest_automation_broker_positions)} position rows")
        if reconciliation.state == "unavailable":
            lines.append("Full journal reconciliation is unavailable until a matching Live journal snapshot is supplied.")
        else:
            lines.append(f"Journal reconciliation · {reconciliation.state.upper()} · {reconciliation.message}")
            lines.extend(f"  {issue.severity.upper()} {issue.symbol}: {issue.message}" for issue in reconciliation.issues[:3])
        lines.extend(("", f"Last cycle · {backend_view.cycle.last_result or 'not run this session'}"))
        if backend_view.cycle.last_duration_seconds is not None:
            lines.append(f"Duration · {backend_view.cycle.last_duration_seconds:.1f}s")
        self._set_text(self.automation_readiness_text, "\n".join(lines))

        for lane, lane_view, widget, start_balance in (
            ("PAPER", backend_view.paper, self.paper_insights_text, paper_starting_balance),
            ("SIMULATION", backend_view.simulation, self.simulation_insights_text, None),
        ):
            insights = analyze_automation_history(
                insight_events,
                lane=lane.lower(),
                starting_balance=start_balance,
            )
            win_rate = f"{lane_view.win_rate * 100:.1f}%" if lane_view.win_rate is not None else "unavailable"
            realized = money(lane_view.realized_pnl) if lane_view.realized_pnl is not None else "incomplete"
            ret = f"{lane_view.return_pct:+.2f}%" if lane_view.return_pct is not None else "unavailable"
            drawdown = (f"{money(lane_view.max_drawdown_usd)} / {lane_view.max_drawdown_pct:.2f}%"
                        if lane_view.max_drawdown_usd is not None and lane_view.max_drawdown_pct is not None
                        else "incomplete / unavailable")
            expectancy = money(lane_view.expectancy) if lane_view.expectancy is not None else "unavailable"
            lane_lines = [
                f"{lane} · {lane_view.state.upper()}",
                f"Closed outcomes · {lane_view.closed_trades} · W/L/BE {lane_view.wins}/{lane_view.losses}/{lane_view.breakeven}",
                f"Win rate · {win_rate}", f"Expectancy · {expectancy}", f"Net realized · {realized}",
                f"Return · {ret}", f"Max drawdown · {drawdown}",
                f"Fill rate · {insights.fill_rate_status} ({insights.fill_observation_count} explicit observations)",
                f"Slippage · {insights.slippage_status} ({insights.slippage_observation_count} explicit observations)",
                "Local candle outcomes do not establish broker fills or slippage.",
            ]
            if insights.cohort_outcomes:
                cohort_text = "; ".join(
                    f"{cohort.dimension}={cohort.cohort} · {cohort.closed_trades} closes · "
                    f"win {cohort.win_rate_pct:.1f}%" if cohort.win_rate_pct is not None else
                    f"{cohort.dimension}={cohort.cohort} · {cohort.closed_trades} closes · incomplete P&L"
                    for cohort in insights.cohort_outcomes[:3]
                )
                lane_lines.append(f"Signal cohorts · {cohort_text}")
            else:
                lane_lines.append("Signal cohorts · unavailable until closed outcomes have stored signal snapshots.")
            if insights.recommendations:
                lane_lines.append(f"Review prompt · {insights.recommendations[0].message}")
            if lane_view.incomplete_reasons:
                lane_lines.extend(f"Data gap · {reason}" for reason in lane_view.incomplete_reasons[:2])
            lane_lines.append("Recommendations are descriptive review prompts; they do not change strategy or Live settings.")
            if len(self.execution_events) > len(insight_events):
                lane_lines.append(f"Showing latest {len(insight_events):,} of {len(self.execution_events):,} local events.")
            self._set_text(widget, "\n".join(lane_lines))

    def _render_alerts_panel(self) -> None:
        if not hasattr(self, "alert_rules_tree"):
            return
        for tree in (self.alert_rules_tree, self.alert_events_tree):
            for item in tree.get_children():
                tree.delete(item)
        for rule in self.alert_store.rules:
            conditions = []
            if rule.symbol:
                conditions.append(rule.symbol)
            if rule.price is not None:
                op = {"above": ">", "at_or_above": "≥", "below": "<", "at_or_below": "≤"}[rule.price_op]
                conditions.append(f"price {op} {rule.price:g}")
            if rule.score is not None:
                op = {"above": ">", "at_or_above": "≥", "below": "<", "at_or_below": "≤"}[rule.score_op]
                conditions.append(f"score {op} {rule.score:g}")
            if rule.action:
                conditions.append(f"action = {rule.action}")
            self.alert_rules_tree.insert("", "end", iid=rule.id,
                                         values=(rule.name, " · ".join(conditions), "Enabled" if rule.enabled else "Paused"))
        all_events = self.alert_store.events[-500:]
        try:
            visible_events = filter_alert_events(
                all_events,
                state=self.alert_history_state_var.get(),
                query=self.alert_history_query_var.get(),
                sort=self.alert_history_sort_var.get(),
            )
        except ValueError:
            visible_events = []
        for event in visible_events:
            self.alert_events_tree.insert(
                "", "end", iid=event.id,
                values=(event.triggered_at[:19].replace("T", " "), event.symbol, event.rule_name,
                        "Seen" if event.acknowledged_at else "New"),
                tags=() if event.acknowledged_at else ("new",),
            )
        if not visible_events:
            query = self.alert_history_query_var.get().strip()
            hint = "Search is limited to 100 characters." if len(query) > 100 else (
                "No events match these filters." if all_events else "No alerts yet. Rules evaluate after each market scan."
            )
            self.alert_events_tree.insert("", "end", iid="__empty_alert_history__", values=("—", "—", hint, "—"))
        error = getattr(self.alert_store, "load_error", None) or getattr(self, "_alert_storage_error", "")
        pending = sum(1 for event in self.alert_store.events if not event.acknowledged_at)
        self.alert_events_heading.configure(
            text=f"TRIGGER HISTORY · {len(visible_events)}/{len(all_events)} SHOWN · {pending} NEW · LOCAL ONLY" if pending
            else f"TRIGGER HISTORY · {len(visible_events)}/{len(all_events)} SHOWN · LOCAL ONLY",
            fg=self.colors["gold"] if pending else self.colors["muted"],
        )
        if hasattr(self, "status_bar"):
            if error:
                status = f"Alert store issue: {error}"
            elif pending:
                status = f"{pending} unacknowledged alert event(s) · evaluated after scans · no order actions"
            else:
                status = "Alerts evaluate after market scans; they never submit orders."
            self.status_bar.configure(text=status)

    def _create_alert_rule(self) -> None:
        dialog = tk.Toplevel(self.root)
        dialog.title("Create local alert")
        dialog.transient(self.root)
        dialog.configure(bg=self.colors["panel"])
        dialog.columnconfigure(1, weight=1)
        name, symbol = tk.StringVar(value="Signal alert"), tk.StringVar()
        template_labels = [template.label for template in ALERT_RULE_TEMPLATES]
        template_by_label = {template.label: template for template in ALERT_RULE_TEMPLATES}
        selected_template = tk.StringVar(value=template_labels[0])
        value = tk.StringVar()
        tk.Label(dialog, text="LOCAL SIGNAL RULE", bg=self.colors["panel"], fg=self.colors["teal"],
                 font=("Sans", 10, "bold")).grid(row=0, column=0, columnspan=2, sticky="w", padx=16, pady=(14, 8))
        for row, (label, var) in enumerate((("Name", name), ("Symbol · optional", symbol)), start=1):
            tk.Label(dialog, text=label, bg=self.colors["panel"], fg=self.colors["muted"]).grid(row=row, column=0, sticky="w", padx=16, pady=6)
            tk.Entry(dialog, textvariable=var, bg=self.colors["entry"], fg=self.colors["text"],
                     insertbackground=self.colors["text"], relief="flat", width=30).grid(row=row, column=1, sticky="ew", padx=16, pady=6, ipady=5)
        tk.Label(dialog, text="Rule template", bg=self.colors["panel"], fg=self.colors["muted"]).grid(row=3, column=0, sticky="w", padx=16, pady=6)
        menu = tk.OptionMenu(dialog, selected_template, *template_labels)
        menu.configure(bg=self.colors["button"], fg=self.colors["button_text"], relief="flat", highlightthickness=0)
        menu.grid(row=3, column=1, sticky="ew", padx=16, pady=6)
        menu["menu"].configure(bg=self.colors["panel_2"], fg=self.colors["text"])
        template_description = tk.Label(dialog, text=ALERT_RULE_TEMPLATES[0].description, bg=self.colors["panel"],
                                        fg=self.colors["muted"], font=("Sans", 8), anchor="w")
        template_description.grid(row=4, column=0, columnspan=2, sticky="ew", padx=16, pady=(0, 4))
        value_entry = tk.Entry(dialog, textvariable=value, bg=self.colors["entry"], fg=self.colors["text"],
                               insertbackground=self.colors["text"], relief="flat", width=30)
        value_entry.grid(row=5, column=1, sticky="ew", padx=16, pady=6, ipady=5)
        tk.Label(dialog, text="Threshold / action", bg=self.colors["panel"], fg=self.colors["muted"]).grid(row=5, column=0, sticky="w", padx=16, pady=6)
        tk.Label(dialog, text="Evaluated against data already loaded by Timmy.", bg=self.colors["panel"],
                 fg=self.colors["muted"], font=("Sans", 8)).grid(row=6, column=0, columnspan=2, sticky="w", padx=16, pady=6)

        def apply_template(_value=None) -> None:
            template = template_by_label[selected_template.get()]
            name.set(template.name)
            value.set(template.default_value)
            template_description.configure(text=template.description)
            value_entry.configure(state="normal" if template.kind != "action" else "disabled")

        menu["menu"].delete(0, "end")
        for template_label in template_labels:
            menu["menu"].add_command(label=template_label, command=lambda label=template_label: (selected_template.set(label), apply_template()))
        apply_template()

        def save() -> None:
            template = template_by_label.get(selected_template.get())
            raw = value.get().strip()
            ticker = symbol.get().strip().upper() or None
            try:
                if template is None:
                    raise ValueError("Choose a rule template.")
                rule = alert_rule_from_template(template.id, name=name.get(), symbol=ticker, value=raw)
                self.alert_store.add_rule(rule)
            except (ValueError, OSError) as exc:
                messagebox.showerror("Alert not saved", str(exc), parent=dialog)
                return
            dialog.destroy()
            self._render_alerts_panel()

        actions = tk.Frame(dialog, bg=self.colors["panel"])
        actions.grid(row=7, column=0, columnspan=2, sticky="e", padx=16, pady=(8, 14))
        self._button(actions, "Cancel", dialog.destroy).pack(side="right", padx=(8, 0))
        self._button(actions, "Save rule", save, accent="teal").pack(side="right")
        dialog.bind("<Return>", lambda _event: save())
        dialog.bind("<Escape>", lambda _event: dialog.destroy())
        dialog.grab_set()

    def _selected_alert_rule(self):
        selected = self.alert_rules_tree.selection()
        return next((item for item in self.alert_store.rules if selected and item.id == selected[0]), None)

    def _toggle_selected_alert_rule(self) -> None:
        rule = self._selected_alert_rule()
        if rule is not None:
            try:
                self.alert_store.set_enabled(rule.id, not rule.enabled)
            except OSError as exc:
                self.status_bar.configure(text=f"Could not update alert rule: {exc}")
                return
            self._render_alerts_panel()
        else:
            self.status_bar.configure(text="Select an alert rule first.")

    def _remove_selected_alert_rule(self) -> None:
        rule = self._selected_alert_rule()
        if rule is not None:
            try:
                self.alert_store.remove_rule(rule.id)
            except OSError as exc:
                self.status_bar.configure(text=f"Could not remove alert rule: {exc}")
                return
            self._render_alerts_panel()
        else:
            self.status_bar.configure(text="Select an alert rule first.")

    def _acknowledge_selected_alert(self) -> None:
        selected = self.alert_events_tree.selection()
        if not selected or selected[0] == "__empty_alert_history__":
            self.status_bar.configure(text="Select an alert event first.")
            return
        try:
            self.alert_store.acknowledge(selected[0])
        except (KeyError, OSError) as exc:
            self._render_alerts_panel()
            self.status_bar.configure(text=f"Could not acknowledge alert: {exc}")
            return
        self._render_alerts_panel()

    def _acknowledge_all_alerts(self) -> None:
        if getattr(self.alert_store, "load_error", None):
            self._render_alerts_panel()
            self.status_bar.configure(
                text="Saved alert data is unreadable; no history was changed. Back up and repair the alert file first."
            )
            return
        try:
            acknowledged = self.alert_store.acknowledge_all()
        except OSError as exc:
            self.status_bar.configure(text=f"Could not acknowledge alerts: {exc}")
            return
        self._render_alerts_panel()
        self.status_bar.configure(
            text=f"Acknowledged {acknowledged} new alert event(s)." if acknowledged
            else "There are no new alert events to acknowledge."
        )

    def _pipeline_universe_count(self, config: BotConfig) -> int:
        if config.watchlist_universe == "all-us":
            if self.universe_path.exists():
                symbols = set(load_watchlist(self.universe_path, None))
            else:
                symbols = set(load_bundled_us_listed_symbols())
            return len(symbols | set(CROSS_ASSET_SYMBOLS)
                       | set(self._read_watchlist_symbols(self.movement_universe_extra_path)))
        return len(load_watchlist(self._runtime_path(config.watchlist_path or self.watchlist_path), config.symbol_whitelist))

    def _watchlist_count(self, path: str | Path) -> int:
        source = self._runtime_path(path)
        if not source.exists():
            return 0
        try:
            symbols = [
                line.split("#", 1)[0].strip().upper()
                for line in source.read_text(encoding="utf-8", errors="replace").splitlines()
            ]
        except OSError:
            return 0
        return len([symbol for symbol in dict.fromkeys(symbols) if symbol])

    def _render_universe(self) -> None:
        config = self.config or self._load_config_safe()
        bundled = load_bundled_us_listed_instruments()
        bundled_counts = {
            "stock": sum(1 for item in bundled if item.asset_type == "stock"),
            "etf": sum(1 for item in bundled if item.asset_type == "etf"),
        }
        active_path = self._runtime_path(config.active_watchlist_path or self.active_watchlist_path)
        movement_path = self._runtime_path(config.movement_watchlist_path or self.movement_watchlist_path)
        trade_ready_path = self._runtime_path(config.trade_ready_watchlist_path or self.trade_ready_watchlist_path)
        quiet_path = self._runtime_path(config.quiet_watchlist_path or self.quiet_watchlist_path)
        if config.market_data_provider == "csv":
            movement_scan_state = "- Broad scan inactive: CSV mode tracks only symbols in the loaded file."
        elif config.watchlist_universe != "all-us":
            movement_scan_state = "- Broad scan inactive: set WATCHLIST_UNIVERSE=all-us to expand discovery."
        else:
            movement_scan_state = (
                "- Broad scan: rotating provider batches run when cached market data is stale; "
                "a batch is only a portion of the configured universe."
            )
        tracker = getattr(self, "_movement_tracker_payload", {})
        scan = movement_scan_summary(tracker)
        def count_value(value) -> int:
            try:
                return max(0, int(value))
            except (TypeError, ValueError, OverflowError):
                return 0

        latest_scan = scan["latest"] or {}
        successful_scan = scan["last_successful"] or {}
        latest_status = str(latest_scan.get("status", "not recorded"))
        latest_at = scan["last_checked_at"]
        successful_at = scan["last_successful_at"]
        scan_lines = [
            f"- Last provider check: {self._movement_timestamp_label(latest_at)} · {latest_status}",
            (f"- Latest batch response: {count_value(latest_scan.get('returned_count')):,}/"
             f"{count_value(latest_scan.get('requested_count')):,} requested · "
             f"{count_value(latest_scan.get('failed_count')):,} unavailable · "
             f"{latest_scan.get('scope', 'scope unknown')}"
             + (f" · {latest_scan['batch_coverage_pct']:.1f}% of configured list requested"
                if isinstance(latest_scan.get("batch_coverage_pct"), (int, float)) else "")
             + (f" · {latest_scan['provider_return_pct']:.1f}% returned"
                if isinstance(latest_scan.get("provider_return_pct"), (int, float)) else "")),
            (f"- Pin-priority batch: {count_value(latest_scan.get('pinned_requested_count')):,}/"
             f"{count_value(latest_scan.get('pinned_universe_count')):,} in-scope pins requested first · "
             f"{count_value(latest_scan.get('pinned_outside_scope_count')):,} pinned outside configured list"
             if latest_scan else "- Pin-priority batch: waiting for first scan"),
            (f"- Last response with data: {self._movement_timestamp_label(successful_at)} · "
             f"{count_value(successful_scan.get('returned_count')):,}/"
             f"{count_value(successful_scan.get('requested_count')):,} requested" if successful_at else
             "- Last response with data: none recorded"),
        ]
        progress = getattr(self, "_movement_scan_progress", {})
        if isinstance(progress, dict) and progress.get("phase") in {"started", "progress"}:
            scan_lines.append(
                f"- Scan progress: {count_value(progress.get('completed')):,}/"
                f"{count_value(progress.get('requested')):,} checked · "
                f"{count_value(progress.get('returned')):,} with bars · "
                f"{count_value(progress.get('failed')):,} unavailable"
            )
        elif isinstance(progress, dict) and progress.get("phase") == "completed":
            scan_lines.append(
                f"- Most recent in-session batch: {count_value(progress.get('returned')):,}/"
                f"{count_value(progress.get('requested')):,} symbols returned bars · "
                f"{count_value(progress.get('failed')):,} unavailable"
            )
        movers = tracker.get("symbols", {}) if isinstance(tracker, dict) else {}
        if not isinstance(movers, dict):
            movers = {}
        pinned_symbols = set(getattr(getattr(self, "watchlist_organization", None), "pinned_symbols", ()))
        locally_quieted = set(getattr(getattr(self, "watchlist_organization", None), "quiet_symbols", ()))
        current_movers = recent_mover_symbols(tracker) if isinstance(tracker, dict) else []
        frequent_movers = sum(
            1 for symbol in current_movers
            if isinstance(movers.get(symbol), dict)
            and count_value(movers[symbol].get("movement_frequency_96h")) >= 3
        )
        pinned_movers = len(set(current_movers) & pinned_symbols)
        filter_mode = getattr(getattr(self, "movement_filter_var", None), "get", lambda: "All fresh")()
        recommendations = top_upside_setups(
            tracker,
            limit=10,
            pinned_symbols=pinned_symbols,
            pinned_only=filter_mode == "Pinned only",
            minimum_movement_frequency=3 if filter_mode == "Frequent movers (3+)" else 0,
        ) if not self._movement_tracker_error and not self._movement_recommendation_note else []
        recommendations = [item for item in recommendations if item["symbol"] not in locally_quieted]
        if filter_mode == "Pinned only":
            recommendation_filter_label = "Filter: pinned symbols · ranking remains score-based"
        elif filter_mode == "Frequent movers (3+)":
            recommendation_filter_label = "Filter: at least 3 observed moving daily bars in 96h"
        else:
            recommendation_filter_label = "Filter: all fresh bullish setups among current 96-hour movers"
        recommendation_history_lines = [
            f"    {item['symbol']} observations: " + " → ".join(
                f"{self._movement_timestamp_label(snapshot['updated_at'])} "
                f"{snapshot['score']:.0f}/100 @ {snapshot['price']:,.2f}"
                for snapshot in item.get("shortlist_history", [])[-4:]
            )
            for item in recommendations
            if len(item.get("shortlist_history", [])) > 1
        ]
        recommendation_lines = [
            "",
            "Fresh bullish shortlist · top 10 by existing blended score",
            recommendation_filter_label,
            "Only setups updated from a timestamped bar within the rolling 96 hours are shown.",
            *[
                f"{index:>2}. {item['symbol']:<8} {item['score']:>4.0f}/100  "
                f"freq {item.get('movement_frequency_96h', 0)}/96h  "
                f"history {item.get('shortlist_observation_count', 0)} obs  "
                f"{item.get('change_pct', 0):+.2f}% last-bar move · "
                f"{item.get('observed_change_since_shortlist_pct', 0):+.2f}% observed since shortlist  "
                f"{'PINNED · ' if item.get('pinned') else ''}"
                f"as of {self._movement_timestamp_label(item.get('updated_at'))}"
                for index, item in enumerate(recommendations, start=1)
            ],
            *recommendation_history_lines,
            *([self._movement_recommendation_note] if self._movement_recommendation_note else []),
            *( ("No fresh bullish setups match the selected filter.",)
               if not recommendations and not self._movement_recommendation_note else () ),
            "Since-shortlist change is an observed close-to-close price comparison, not realized trade performance.",
        ]
        candidate_lines = [
            f"{index:>2}. {item['symbol']:<8} {item['change_pct']:+.2f}% · scout {item['scout_score']:>2}/100 · "
            + ("POTENTIAL TRADE · strategy-qualified; execution gates remain" if item.get("trade_candidate") else
               f"watch · {item.get('direction', 'unknown')} · strategy {item.get('decision', 'unknown')}")
            for index, item in enumerate(getattr(self, "_movement_candidate_records", [])[:12], start=1)
        ]
        lines = [
            "Universe source",
            f"- Mode: {config.watchlist_universe}",
            f"- Rotation: {'enabled' if config.enable_watchlist_rotation else 'disabled'}",
            f"- Runtime cache: {self._file_summary(self.universe_path)}",
            f"- Bundled snapshot: {len(bundled):,} symbols ({bundled_counts['stock']:,} stocks / {bundled_counts['etf']:,} ETFs)",
            f"- Batch size: {config.watchlist_universe_batch_size:,}",
            f"- Refresh window: {config.watchlist_universe_refresh_hours}h",
            movement_scan_state,
            f"- Rolling 96-hour movers: {self._watchlist_count(self.recent_movers_path):,} tickers",
            "- Movement uses daily OHLC bars; repeated moving bars increase the observed frequency count.",
            *scan_lines,
            f"- Frequent movers (3+ moving bars in 96h): {frequent_movers:,} · pinned movers: {pinned_movers:,}",
            f"- Extra provider symbols: {len(self._read_watchlist_symbols(self.movement_universe_extra_path)):,} "
            f"in {self.movement_universe_extra_path.name}",
            *([f"- Tracker warning: {self._movement_tracker_error}"] if self._movement_tracker_error else []),
            "",
            (f"Auto-discovery watchlist · at least {config.movement_watchlist_min_change_pct:.1f}% daily move · "
             f"saved at {self._runtime_path(config.movement_watchlist_path or self.movement_watchlist_path).name}"),
            (f"Potential trade promotion · at least {config.trade_candidate_min_change_pct:.1f}% daily move, "
             "scout alert, bullish strategy eligibility, and normal order/risk checks."),
            *(candidate_lines or ["No fresh percentage-qualified candidates in the saved scan window."]),
            *recommendation_lines,
            "",
            "Generated watchlists",
            self._watchlist_summary_line("Active trade source", active_path),
            self._watchlist_summary_line("Movement candidates", movement_path),
            self._watchlist_summary_line("Trade-ready before broker", trade_ready_path),
            self._watchlist_summary_line("Quiet removed", quiet_path),
            *(["", "Why generated lists changed", *self._latest_generated_watchlist_change_notes]
              if self._latest_generated_watchlist_change_notes else []),
            "",
            "Webull account-side sync",
            f"- Sync: {'enabled' if config.webull_sync_watchlists else 'disabled'}",
            f"- Active: {config.webull_active_watchlist_name}",
            f"- Movement: {config.webull_movement_watchlist_name}",
            f"- Trade ready: {config.webull_trade_ready_watchlist_name}",
            f"- Quiet removed: {config.webull_quiet_watchlist_name}",
            "",
            "Trading boundary",
            f"- Webull symbol whitelist: {'all rotated symbols allowed' if not config.symbol_whitelist else self._compact_symbols(config.symbol_whitelist, 8)}",
            f"- Active cap: {config.max_watchlist_symbols:,}",
            f"- Movement cap: {config.max_movement_watchlist_symbols:,}",
            f"- Movement threshold: scout >= {config.min_watchlist_scout_score}",
            f"- Quiet threshold: scout < {config.quiet_watchlist_scout_score}",
        ]
        self._set_text(self.universe_text, "\n".join(lines))

    @staticmethod
    def _movement_timestamp_label(value) -> str:
        if not isinstance(value, str) or not value.strip():
            return "not recorded"
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if parsed.tzinfo is not None:
                parsed = parsed.astimezone()
            return parsed.strftime("%b %d %H:%M")
        except ValueError:
            return value[:16].replace("T", " ")

    def _watchlist_summary_line(self, label: str, path: Path) -> str:
        symbols = self._read_watchlist_symbols(path)
        return f"- {label}: {len(symbols):,} | {self._preview_symbols(symbols)}"

    def _read_watchlist_symbols(self, path: Path) -> list[str]:
        if not path.exists():
            return []
        try:
            raw_symbols = [
                line.split("#", 1)[0].strip().upper()
                for line in path.read_text(encoding="utf-8", errors="replace").splitlines()
            ]
        except OSError:
            return []
        return sorted(symbol for symbol in dict.fromkeys(raw_symbols) if symbol)

    def _preview_symbols(self, symbols: list[str], limit: int = 12) -> str:
        if not symbols:
            return "-"
        if len(symbols) <= limit:
            return ", ".join(symbols)
        return f"{', '.join(symbols[:limit])}, +{len(symbols) - limit} more"

    def _file_summary(self, path: Path) -> str:
        if not path.exists():
            return "missing"
        try:
            age = datetime.now() - datetime.fromtimestamp(path.stat().st_mtime)
        except OSError:
            return "unreadable"
        if age.days:
            return f"{self._watchlist_count(path):,} symbols, {age.days}d old"
        minutes = max(0, int(age.total_seconds() // 60))
        return f"{self._watchlist_count(path):,} symbols, {minutes}m old"

    def _render_signals(self) -> None:
        self.signal_tree.delete(*self.signal_tree.get_children())
        self._refresh_watchlist_group_menu()
        if hasattr(self, "market_watch_tree"):
            self.market_watch_tree.delete(*self.market_watch_tree.get_children())
        moving_count = 0
        tradeable_count = 0
        blocked_count = 0
        config = self.config or self._load_config_safe()
        locally_quieted = set(self.watchlist_organization.quiet_symbols)
        filter_text = self.scanner_filter_var.get().strip().upper()
        category_filter = self.scanner_category_var.get().strip().casefold()
        for signal in self.signals:
            is_moving = getattr(signal, "scout_action", "quiet") in {"alert", "watch"}
            if is_moving:
                moving_count += 1
            operational_blocks = self._operational_blocks(signal, config)
            is_tradeable = (
                signal.score >= self._min_score(config)
                and self._local_sensible_action(signal) == "trade"
                and not operational_blocks
            )
            is_blocked = False
            if is_tradeable:
                tradeable_count += 1
            elif signal.score >= self._min_score(config) or self._local_sensible_action(signal) == "trade":
                blocked_count += 1
                is_blocked = True
            row_values = (
                signal.symbol,
                self._scout_label(signal),
                signal.score,
                self._sensible_label(signal),
                signal.direction,
                signal.decision,
                self._price_gate_label(signal),
                f"{signal.change_pct:+.2f}%",
                money(signal.entry),
            )
            selected_group = self._watchlist_group_for_selection()
            group_filter = self.watchlist_group_var.get()
            pinned = set(self.watchlist_organization.pinned_symbols)
            is_locally_quieted = signal.symbol.upper() in locally_quieted
            watch_allowed = (
                group_filter == "All signals"
                or (group_filter == "Pinned" and signal.symbol in pinned)
                or (selected_group is not None and signal.symbol in selected_group.symbols)
            )
            if hasattr(self, "market_watch_tree") and watch_allowed and not is_locally_quieted:
                movement_tag = "up" if signal.change_pct > 0 else "down" if signal.change_pct < 0 else ""
                self.market_watch_tree.insert(
                    "", "end",
                    values=(signal.symbol, signal.score, f"{signal.change_pct:+.2f}%", self._scout_label(signal)),
                    tags=(movement_tag,) if movement_tag else (),
                )
            searchable = " ".join(str(value) for value in (
                signal.symbol, signal.direction, signal.decision,
                self._scout_label(signal), self._sensible_label(signal),
            )).upper()
            category_match = (
                ((category_filter == "all" or category_filter == "moving" and is_moving
                  or category_filter == "tradeable" and is_tradeable
                  or category_filter == "blocked" and is_blocked
                  or category_filter == "quiet" and not is_moving and not is_tradeable and not is_blocked)
                 and not is_locally_quieted)
                or (category_filter == "locally quieted" and is_locally_quieted)
            )
            if category_match and (not filter_text or filter_text in searchable):
                movement_tag = "up" if signal.change_pct > 0 else "down" if signal.change_pct < 0 else ""
                self.signal_tree.insert("", "end", values=row_values, tags=(movement_tag,) if movement_tag else ())
        self._sync_local_quiet_button()
        if self._scanner_sort_column:
            self._sort_signal_tree(self._scanner_sort_column, toggle=False)
        self._update_label_map(
            getattr(self, "scanner_summary_labels", {}),
            {
                "Scanned": f"{len(self.signals):,}",
                "Moving": f"{moving_count:,}",
                "Tradeable": f"{tradeable_count:,}",
                "Blocked": f"{blocked_count:,}",
            },
        )
        visible_rows = self.signal_tree.get_children()
        if filter_text:
            match_text = f"{len(visible_rows):,} matches"
        elif category_filter == "all":
            match_text = f"{len(visible_rows):,} symbols"
        else:
            match_text = f"{len(visible_rows):,} {category_filter.lower()}"
        self.scanner_match_var.set(match_text)
        if visible_rows:
            first = visible_rows[0]
            self.signal_tree.selection_set(first)
            self.signal_tree.focus(first)
            self._show_selected_signal()
            if hasattr(self, "market_watch_tree"):
                watch_rows = self.market_watch_tree.get_children()
                if watch_rows:
                    self.market_watch_tree.selection_set(watch_rows[0])
                    self.market_watch_tree.focus(watch_rows[0])
                    self._show_market_watch_selection()
        else:
            self._show_selected_signal()
            if filter_text:
                detail = f"No rows match ‘{filter_text}’. Clear the search or choose another scanner category."
            elif category_filter != "all":
                detail = f"No {category_filter.lower()} signals currently match the strategy gates."
            else:
                detail = "No signals are available yet. Refresh market data to build the scanner list."
            self._set_text(self.signal_detail, detail)

    def _sort_signal_tree(self, column: str, toggle: bool = True) -> None:
        if toggle:
            if self._scanner_sort_column == column:
                self._scanner_sort_reverse = not self._scanner_sort_reverse
            else:
                self._scanner_sort_column = column
                self._scanner_sort_reverse = column in {"score", "change"}
        reverse = self._scanner_sort_reverse
        items = self.signal_tree.get_children("")
        if column in {"score", "change", "entry"}:
            numeric_rows = []
            missing_rows = []
            for item in items:
                value = self.signal_tree.set(item, column)
                try:
                    numeric = float(value.replace("$", "").replace(",", "").replace("%", "").replace("+", ""))
                except ValueError:
                    missing_rows.append(item)
                else:
                    numeric_rows.append((numeric, item))
            rows = [item for _value, item in sorted(numeric_rows, reverse=reverse)] + missing_rows
        else:
            rows = sorted(items, key=lambda item: self.signal_tree.set(item, column).casefold(), reverse=reverse)
        for index, item in enumerate(rows):
            self.signal_tree.move(item, "", index)
        for key, title in self.signal_tree_headings.items():
            marker = (" ▼" if reverse else " ▲") if key == column else ""
            self.signal_tree.heading(key, text=title + marker)

    def _open_scanner_columns(self) -> None:
        order = list(self.scanner_column_order)
        visible = set(self.scanner_visible_columns)
        dialog = tk.Toplevel(self.root)
        dialog.title("Scanner columns")
        dialog.transient(self.root)
        dialog.configure(bg=self.colors["panel"])
        dialog.columnconfigure(0, weight=1)
        dialog.rowconfigure(2, weight=1)
        tk.Label(dialog, text="PERSONALIZE YOUR SCANNER", bg=self.colors["panel"], fg=self.colors["teal"],
                 font=("Sans", 10, "bold"), anchor="w").grid(row=0, column=0, sticky="ew", padx=14, pady=(14, 4))
        tk.Label(dialog, text="Select a column and use Show / Hide or move it in the displayed order.",
                 bg=self.colors["panel"], fg=self.colors["muted"], font=("Sans", 8), anchor="w").grid(
                     row=1, column=0, sticky="ew", padx=14, pady=(0, 8))
        listbox = tk.Listbox(dialog, width=34, height=len(order), bg=self.colors["panel_2"], fg=self.colors["text"],
                             selectbackground=self.colors["selected"], selectforeground=self.colors["selected_text"],
                             relief="flat", activestyle="none", font=("Sans", 10))
        listbox.grid(row=2, column=0, sticky="nsew", padx=14)

        def redraw(selected: int = 0) -> None:
            listbox.delete(0, "end")
            for key in order:
                marker = "Shown" if key in visible else "Hidden"
                listbox.insert("end", f"{self.signal_tree_headings[key]:<14}  {marker}")
            if order:
                selected = max(0, min(selected, len(order) - 1))
                listbox.selection_set(selected)
                listbox.activate(selected)

        def selected_index() -> int | None:
            selection = listbox.curselection()
            return int(selection[0]) if selection else None

        def toggle_visibility(show: bool) -> None:
            index = selected_index()
            if index is None:
                return
            key = order[index]
            if show:
                visible.add(key)
            else:
                if len(visible) <= 1 and key in visible:
                    messagebox.showinfo("Scanner columns", "Keep at least one column visible.", parent=dialog)
                    return
                visible.discard(key)
            redraw(index)

        def move(delta: int) -> None:
            index = selected_index()
            if index is None or not 0 <= index + delta < len(order):
                return
            order[index], order[index + delta] = order[index + delta], order[index]
            redraw(index + delta)

        actions = tk.Frame(dialog, bg=self.colors["panel"])
        actions.grid(row=3, column=0, sticky="ew", padx=14, pady=8)
        self._button(actions, "Show", lambda: toggle_visibility(True)).pack(side="left")
        self._button(actions, "Hide", lambda: toggle_visibility(False)).pack(side="left", padx=5)
        self._button(actions, "Move up", lambda: move(-1)).pack(side="left")
        self._button(actions, "Move down", lambda: move(1)).pack(side="left", padx=5)
        foot = tk.Frame(dialog, bg=self.colors["panel"])
        foot.grid(row=4, column=0, sticky="e", padx=14, pady=(0, 14))
        self._button(foot, "Cancel", dialog.destroy).pack(side="right", padx=(8, 0))

        def apply_view() -> None:
            sort_column = self._scanner_sort_column if self._scanner_sort_column in visible else next(
                (key for key in order if key in visible), "symbol")
            view = make_scanner_view("My scanner", order, visible, sort_column,
                                     self._scanner_sort_reverse if self._scanner_sort_column else True,
                                     allowed_columns=self.scanner_column_order)
            self._apply_scanner_view(view)
            dialog.destroy()

        self._button(foot, "Apply view", apply_view, accent="teal").pack(side="right")
        redraw()
        dialog.bind("<Escape>", lambda _event: dialog.destroy())
        dialog.grab_set()

    def _apply_scanner_view(self, view, *, save: bool = True) -> None:
        self.scanner_column_order = view.columns
        self.scanner_visible_columns = set(view.visible_columns)
        self.signal_tree.configure(displaycolumns=view.visible_order)
        self._scanner_sort_column = view.sort_column
        self._scanner_sort_reverse = view.descending
        if save:
            self._saved_scanner_view = scanner_view_to_dict(view)
            self._save_runtime_settings()
        self._sort_signal_tree(view.sort_column, toggle=False)
        if save:
            self._render_signals()

    def _refresh_scanner_preset_menu(self) -> None:
        menu = getattr(self, "scanner_preset_menu", None)
        if menu is None:
            return
        widget_menu = menu["menu"]
        widget_menu.delete(0, "end")
        presets = self.scanner_presets.presets
        if not presets:
            widget_menu.add_command(label="No saved filters", command=lambda: self.scanner_preset_var.set("Saved filters"))
        for preset in presets:
            widget_menu.add_command(label=preset.name, command=lambda name=preset.name: self.scanner_preset_var.set(name))
        widget_menu.configure(bg=self.colors["panel_2"], fg=self.colors["text"],
                              activebackground=self.colors["selected"], activeforeground=self.colors["selected_text"])

    def _save_scanner_preset(self) -> None:
        name = simpledialog.askstring("Save scanner filter", "Name this filter:", parent=self.root)
        if name is None:
            return
        category = self.scanner_category_var.get().strip().lower()
        if category == "all":
            category = None
        score = self._coerce_int(self.min_score_var.get(), 72, 0, 100)
        try:
            preset = self.scanner_presets.create(
                name, self.scanner_filter_var.get(), category=category, min_score=score)
        except (ValueError, OSError) as exc:
            messagebox.showerror("Filter not saved", str(exc), parent=self.root)
            return
        self.scanner_preset_var.set(preset.name)
        self._refresh_scanner_preset_menu()
        self.status_bar.configure(text=f"Scanner filter '{preset.name}' saved.")

    def _apply_scanner_preset_name(self) -> None:
        name = self.scanner_preset_var.get()
        if name == "Saved filters":
            return
        preset = next((item for item in self.scanner_presets.presets if item.name == name), None)
        if preset is None:
            return
        self.scanner_filter_var.set(preset.query)
        self.scanner_category_var.set((preset.category or "all").title())
        if preset.min_score is not None:
            self.min_score_var.set(str(preset.min_score))
        self._render_signals()
        self.status_bar.configure(text=f"Scanner filter '{preset.name}' applied.")

    def _render_plans(self) -> None:
        lines = []
        if self.config_error:
            lines.append(f"Config fallback active:\n{self.config_error}")
        config = self.config or self._load_config_safe()
        lines.extend([
            "Trade guardrails",
            f"- Target / mode: {self._lane_mode_label()}",
            f"- Live guard: {'enabled' if self._live_ready(self._execution_config(config)) else 'locked'}",
            f"- Fractional priority: {'on' if config.enable_equity_fractional_trading else 'off'}",
            f"- Plan limit: {self._plan_limit(config)}",
            f"- Max notional: {money(config.max_order_notional_usd)}",
            f"- Max quantity: {config.max_order_quantity:g}",
            f"- Risk per trade: {money(config.risk_per_trade_usd)}",
            f"- Max positions: {config.max_positions}",
            "",
            "Executable queue",
        ])
        for plan in self.plans:
            lines.append(
                f"{plan.side} {_format_quantity(plan.quantity)} {plan.symbol} {plan.instrument_type} {plan.order_type}\n"
                f"Limit {money(plan.limit_price)} | Notional {money(plan.notional)}\n"
                f"Stop {money(plan.stop_price)} | Target {money(plan.target_price)}\n"
                f"{plan.reason}"
            )
        if not self.plans:
            lines.append("No eligible plans at current risk settings.")
            lines.append("")
            lines.append("Common blockers: no trade-ready symbol, stale data, score below threshold, cooldown, daily cap, buying power, fractional minimum, preview rejection, or broker rejection.")
        self._set_text(self.plan_text, "\n\n".join(lines))
        selected_signal = self.signal_by_symbol.get(getattr(self, "selected_chart_symbol", ""))
        if getattr(self, "active_tab", None) == "Overview" and selected_signal is not None:
            self._set_text(self.decision_text, self._market_decision_brief(selected_signal))
        else:
            self._set_text(self.decision_text, self._decision_summary())
        self._render_strategy_tab()
        self._render_execution_tab()

    def _render_strategy_tab(self) -> None:
        if not hasattr(self, "strategy_decision_text"):
            return
        config = self.config or self._load_config_safe()
        readiness = readiness_flags(config, plans_count=len(self.plans), events_count=len(self.execution_events))
        eligible_signals = [
            signal
            for signal in self.signals
            if signal.score >= self._min_score(config)
            and self._local_sensible_action(signal) == "trade"
            and not self._operational_blocks(signal, config)
        ]
        self._update_label_map(
            getattr(self, "strategy_summary_labels", {}),
            {
                "Style": config.trading_style.title(),
                "Patterns": str(len(config.enabled_trade_patterns)),
                "Eligible": f"{len(eligible_signals):,}",
                "Readiness": f"{len(readiness['green_flags'])}G / {len(readiness['red_flags'])}R",
            },
        )
        self._set_text(self.strategy_decision_text, self._decision_summary())
        self._set_text(self.strategy_gate_text, self._strategy_gate_detail(config, readiness, eligible_signals))

    def _strategy_gate_detail(self, config: BotConfig, readiness: dict, eligible_signals: list) -> str:
        pattern_line = ", ".join(sorted(config.enabled_trade_patterns)) or "none"
        signal_mix = self._strategy_signal_mix(config)
        top_watch = [
            signal
            for signal in self.signals[:12]
            if self._local_sensible_action(signal) in {"trade", "watch"}
            or getattr(signal, "scout_action", "quiet") in {"alert", "watch"}
        ]
        lines = [
            "Model controls",
            f"- Style: {config.trading_style}",
            f"- Patterns: {pattern_line}",
            f"- Min score: {self._min_score(config)}",
            "- Sensible threshold: trade >= 78, watch >= 50",
            f"- Data: {self._data_freshness_line()}",
            "",
            "Signal mix",
            f"- Alert/watch: {signal_mix['moving']}",
            f"- Trade-score candidates: {signal_mix['score_ready']}",
            f"- Sensible trade candidates: {signal_mix['sensible_ready']}",
            f"- Operationally blocked: {signal_mix['blocked']}",
            "",
            "Readiness gates",
        ]
        lines.extend(f"- Green: {flag}" for flag in readiness["green_flags"][:8])
        lines.extend(f"- Red: {flag}" for flag in readiness["red_flags"][:8])
        if not readiness["green_flags"] and not readiness["red_flags"]:
            lines.append("- No readiness flags reported")
        lines.extend([
            "",
            "Eligible symbols",
            self._preview_symbols([signal.symbol for signal in eligible_signals], limit=16),
            "",
            "Watch focus",
        ])
        if not top_watch:
            lines.append("- No active watch focus at current thresholds")
        for signal in top_watch[:8]:
            blocks = self._operational_blocks(signal, config)
            block_label = "clear" if not blocks else blocks[0]
            lines.append(
                f"- {signal.symbol}: scout {getattr(signal, 'scout_score', 0)} | sensible {self._local_sensible_score(signal)} | {block_label}"
            )
        return "\n".join(lines)

    def _strategy_signal_mix(self, config: BotConfig) -> dict[str, int]:
        moving = 0
        score_ready = 0
        sensible_ready = 0
        blocked = 0
        min_score = self._min_score(config)
        for signal in self.signals:
            if getattr(signal, "scout_action", "quiet") in {"alert", "watch"}:
                moving += 1
            score_ok = signal.score >= min_score
            sensible_ok = self._local_sensible_action(signal) == "trade"
            if score_ok:
                score_ready += 1
            if sensible_ok:
                sensible_ready += 1
            if (score_ok or sensible_ok) and self._operational_blocks(signal, config):
                blocked += 1
        return {
            "moving": moving,
            "score_ready": score_ready,
            "sensible_ready": sensible_ready,
            "blocked": blocked,
        }

    def _render_execution_tab(self) -> None:
        if not hasattr(self, "execution_queue_text"):
            return
        config = self.config or self._load_config_safe()
        execution_config = self._execution_config(config)
        live_ready = self._live_ready(execution_config)
        broker_label = "Ready" if live_ready and not self._broker_check_required(execution_config) else "Guarded"
        self._update_label_map(
            getattr(self, "execution_summary_labels", {}),
            {
                "Target": self._lane_mode_label(),
                "Queue": f"{len(self.plans):,}",
                "Fractional": "On" if config.enable_equity_fractional_trading else "Off",
                "Broker": broker_label,
            },
        )
        self._set_text(self.execution_queue_text, self._execution_queue_detail(config))
        self._set_text(self.execution_gate_text, self._execution_gate_detail(config, execution_config))

    def run_system_check(self) -> None:
        if self._action_in_progress or self._refresh_in_progress:
            active = self._active_action_label if self._action_in_progress else "market refresh"
            self.status_bar.configure(text=f"Desk check waiting for {active} to finish.")
            return
        try:
            self.status_bar.configure(text="Running desk check...")
            self._refresh_payload()
            self._render_health_tab(force_check=True)
            self.status_bar.configure(text="Desk check complete.")
        except Exception as exc:
            self.status_bar.configure(text=f"Desk check failed: {exc}")
            if hasattr(self, "health_text"):
                self._set_text(self.health_text, str(exc))

    def _backup_ui_preferences(self) -> None:
        """Save current non-credential preferences, then make a private backup."""
        if self._settings_load_error:
            try:
                target = backup_raw_ui_settings(self.settings_path, self.home / "backups")
            except (OSError, UnicodeError, ValueError) as exc:
                self.status_bar.configure(text=f"Original preferences could not be backed up: {exc}")
                return
            self.status_bar.configure(
                text=f"Unreadable preferences preserved byte-for-byte: {target.name} · repair the original file before saving."
            )
            return
        self._save_runtime_settings()
        if self._settings_save_error:
            try:
                target = backup_raw_ui_settings(self.settings_path, self.home / "backups")
            except (OSError, UnicodeError, ValueError) as exc:
                self.status_bar.configure(text=f"Preferences backup failed: {self._settings_save_error[:90]} · {exc}")
                return
            self.status_bar.configure(
                text=f"Current preferences file preserved byte-for-byte: {target.name} · {self._settings_save_error[:100]}"
            )
            return
        try:
            target = backup_ui_settings(self.settings_path, self.home / "backups")
        except (OSError, UnicodeError, ValueError) as exc:
            self.status_bar.configure(text=f"Preferences backup failed: {exc}")
            return
        self.status_bar.configure(text=f"Preferences backup saved: {target.name} · local file only")

    def _render_health_tab(self, force_check: bool = False) -> None:
        if not hasattr(self, "health_text"):
            return
        config = self.config or self._load_config_safe()
        health = build_runtime_health(
            home=self.home,
            config=self._execution_config(config),
            plans_count=len(self.plans),
            events_count=len(self.execution_events),
        )
        system_check = pre_market_system_check(
            home=self.home,
            config=self._execution_config(config),
            plans_count=len(self.plans),
            events_count=len(self.execution_events),
        ) if force_check else None
        market = health.market_session or {}
        process = health.single_process
        watchdog_value = "Running" if process and process.is_running else "Check"
        account_value = "Fresh" if not self._broker_check_required(self._execution_config(config)) else "Needed"
        self._update_label_map(
            getattr(self, "health_summary_labels", {}),
            {
                "Desk": health.overall.title(),
                "Market": "Open" if market.get("is_open") else "Closed",
                "Account": account_value,
                "Watchdog": watchdog_value,
            },
        )
        signal_lines = [
            "Desk health",
            f"- Overall: {health.overall}",
            f"- Principle: {TRADING_PRINCIPLE}",
            f"- Safe mode: {'on' if health.safe_mode else 'off'}",
            f"- Account check: {'needed' if account_value == 'Needed' else 'fresh'}",
            f"- Buying power: {self.trade_cash_snapshot[0]} ({self.trade_cash_snapshot[1]})",
            f"- Market: {'open' if market.get('is_open') else market.get('reason', 'closed')}",
            f"- Watchdog: {watchdog_value.lower()}",
        ]
        if system_check is not None:
            signal_lines.extend([
                "",
                "One-click check",
                f"- Status: {'passed' if system_check.passed else 'blocked'}",
                f"- Blockers: {len(system_check.blockers):,}",
                f"- Warnings: {len(system_check.warnings):,}",
            ])
        signal_lines.extend(["", "Startup and recovery"])
        crash = health.crash_recovery
        signal_lines.append(
            f"- Crash log: {crash.summary if crash else 'status unavailable'}"
            + (f" · last entry {crash.last_seen_at}" if crash and crash.last_seen_at else "")
        )
        if crash and crash.excerpt:
            signal_lines.extend(("  Recent redacted details:", *[f"  {line}" for line in crash.excerpt.splitlines()]))
        if self._settings_load_error:
            signal_lines.append(f"- Saved preferences need repair: {self._settings_load_error[:180]}")
        elif self._settings_validation_notes:
            signal_lines.append("- Preferences were normalized during load:")
            signal_lines.extend(f"  {note}" for note in self._settings_validation_notes[:5])
        if self._settings_save_error:
            signal_lines.append(f"- Preferences save status: {self._settings_save_error[:180]}")
        signal_lines.extend(["", "Guardrail notes"])
        for signal in health.signals[:10]:
            detail = f" | {signal.detail}" if signal.detail else ""
            signal_lines.append(f"- {signal.level}: {signal.summary}{detail}")
        self._set_text(self.health_text, "\n".join(signal_lines))
        self._set_text(self.diagnostics_text, self._health_diagnostics_detail(config))

    def _health_diagnostics_detail(self, config: BotConfig) -> str:
        plan_by_symbol = {plan.symbol.upper(): plan for plan in self.plans}
        reports = [
            inspect_trade_ready(
                signal,
                plan_by_symbol.get(signal.symbol.upper()),
                min_score_to_trade=self._min_score(config),
                min_reward_risk=config.min_reward_risk_to_trade,
                max_signal_volatility_pct=config.max_signal_volatility_pct,
            )
            for signal in self.signals[:12]
        ]
        rollup = why_no_trade(reports)
        presets = ", ".join(preset.name for preset in list_strategy_presets())
        lines = [
            "Why no trade",
            f"- Ready: {rollup['ready']:,}",
            f"- Blocked: {rollup['blocked']:,}",
            f"- Top reason: {rollup['top_reason'] or '-'}",
            f"- Ready tickers: {self._preview_symbols(list(rollup['ready_symbols']), limit=10)}",
            "",
            "Strategy playbook",
            f"- Current style: {config.trading_style.title()}",
            f"- Available presets: {presets}",
            "",
            "Blocked tickers",
        ]
        for report in reports[:8]:
            if report.trade_ready:
                continue
            issue = report.issues[0].message if report.issues else "waiting on cleaner setup"
            lines.append(f"- {report.symbol}: {issue}")
        if len(lines) <= 10:
            lines.append("- No blocked tickers in the current desk sample.")
        return "\n".join(lines)

    def _execution_queue_detail(self, config: BotConfig) -> str:
        lines = [
            "Executable queue",
            f"- Plan limit this pass: {self._plan_limit(config)}",
            f"- Orders ready: {len(self.plans):,}",
            "",
        ]
        if not self.plans:
            lines.extend([
                "No executable order plans at current settings.",
                "",
                "Most common causes",
                "- Scanner found movement but score stayed below threshold",
                "- Sensible score did not reach trade",
                "- Market data is stale or market-hours gate is closed",
                "- Cash, fractional minimum, reward/risk, cooldown, or daily cap blocked the plan",
            ])
            return "\n".join(lines)
        for idx, plan in enumerate(self.plans[: self._plan_limit(config)], start=1):
            latest = self._latest_candle_timestamp(plan.symbol) or "unknown"
            preview = "fresh preview" if self._has_fresh_preview(plan, self._execution_config(config)) else "preview needed"
            lines.append(
                f"{idx}. {plan.symbol} {plan.side} {_format_quantity(plan.quantity)} {plan.instrument_type}\n"
                f"   Limit {money(plan.limit_price)} | Notional {money(plan.notional)} | {preview}\n"
                f"   Stop {money(plan.stop_price)} | Target {money(plan.target_price)} | Candle {latest}\n"
                f"   {plan.reason}"
            )
        return "\n\n".join(lines)

    def _execution_gate_detail(self, config: BotConfig, execution_config: BotConfig) -> str:
        readiness = readiness_flags(config, plans_count=len(self.plans), events_count=len(self.execution_events))
        paper_cash_value, paper_cash_detail = self._paper_account_snapshot()
        lines = [
            "Broker and risk gates",
            f"- Account lane: {self._account_lane()}",
            f"- Account: {self._webull_account_card_value(execution_config)}",
            f"- Cash account: {self.trade_cash_snapshot[0]} ({self.trade_cash_snapshot[1]})",
            f"- Paper account: {paper_cash_value} ({paper_cash_detail})",
            f"- Live switches: {'enabled' if self._live_ready(execution_config) else 'locked'}",
            f"- Account check: {'needed' if self._broker_check_required(execution_config) else 'fresh'}",
            f"- Saved Live Auto opt-in: {'on' if execution_config.auto_start_live_on_market_open else 'off'}",
            "- Exact broker preview: always required before every live placement",
            "",
            "Risk controls",
            f"- Max notional: {money(config.max_order_notional_usd)}",
            f"- Max quantity: {config.max_order_quantity:g}",
            f"- Risk per trade: {money(config.risk_per_trade_usd)}",
            f"- Max daily trades: {config.max_daily_trades}",
            f"- Cooldown: {config.order_cooldown_minutes}m",
            "",
            "Readiness",
        ]
        lines.extend(f"- Green: {flag}" for flag in readiness["green_flags"][:8])
        lines.extend(f"- Red: {flag}" for flag in readiness["red_flags"][:8])
        if not readiness["green_flags"] and not readiness["red_flags"]:
            lines.append("- No readiness flags reported")
        return "\n".join(lines)

    @staticmethod
    def _update_label_map(labels: dict[str, tk.Label], values: dict[str, str]) -> None:
        for key, value in values.items():
            widget = labels.get(key)
            if widget is not None:
                widget.configure(text=value)

    def _render_broker_summary(self, force: bool = False) -> None:
        config = self.config or self._load_config_safe()
        execution_config = self._execution_config(config)
        account_value = self._webull_account_card_value(execution_config)
        live_value = "On" if self._live_ready(execution_config) else "Locked"
        preview_value = "Req"
        self._update_label_map(
            getattr(self, "broker_summary_labels", {}),
            {
                "Account": account_value,
                "API Check": "N/A" if not execution_config.webull_account_id else (
                    "Needed" if self._broker_check_required(execution_config) else "Fresh"),
                "Region": config.webull_region.upper(),
                "Live Gate": live_value,
                "Preview Gate": preview_value,
            },
        )
        readiness_lines = [
            "Connection diagnostics",
            f"- Account: {account_value}",
            f"- Status: {self._webull_account_card_detail(execution_config)}",
            f"- API region: {config.webull_region}",
            f"- Credential profile: {'configured' if config.webull_app_key and config.webull_app_secret else 'incomplete'}",
            f"- Live submission gate: {'enabled' if live_value == 'On' else 'locked'}",
            "- Preview gate: required for every live placement",
            f"- OpenAPI submit switch: {'on' if config.webull_enable_live_orders else 'off'}",
            f"- Watchlist sync: {'on' if config.webull_sync_watchlists else 'off'}",
            f"- Last account check: {self.trade_cash_snapshot[1]}",
            "",
            "Execution readiness",
            f"- Orders ready: {len(self.plans):,}",
            f"- Target / mode: {self._lane_mode_label()}",
            f"- Fresh dry runs: {self._fresh_preview_count(execution_config):,}",
        ]
        self._set_text(self.broker_readiness_text, "\n".join(readiness_lines))
        current = self._text_value(self.broker_text).strip()
        if current and not force and not current.startswith("Broker desk"):
            return
        response_lines = [
            "Broker desk notes",
            "- No broker note loaded in this pane yet.",
            "- Account Check, Preview Route, paper orders, and live orders show here.",
            "",
            "Current connection",
            f"- Account: {account_value}",
            f"- API region: {config.webull_region}",
            f"- Live: {live_value}",
            f"- Dry run: {preview_value}",
        ]
        self._set_text(self.broker_text, "\n".join(response_lines))

    def _load_journal(self) -> None:
        events = self.execution_events
        filtered_events = filter_journal_events(events, self.journal_filter_state)
        self._render_audit_summary(events)
        self._render_audit_integrity(events)
        if not events:
            self._set_text(self.journal_text, "Recent trade notes\n\nNo buy/sell events recorded.")
            return
        live_count = sum(1 for event in events if event.get("mode") == "live")
        paper_count = sum(1 for event in events if event.get("mode") == "paper")
        simulation_count = sum(1 for event in events if event.get("mode") == "simulation")
        simulation_pending = sum(1 for event in events if event.get("mode") == "simulation" and event.get("sell_status") == "target-pending")
        rejected_count = sum(1 for event in events if str(event.get("status", "")).lower() == "rejected")
        paper_summary = summarize_paper_journal(events)
        consistency = summarize_closed_paper_events(events)
        win_rate = f"{paper_summary.win_rate:.0%}" if paper_summary.win_rate is not None else "incomplete"
        expectancy = money(paper_summary.expectancy) if paper_summary.expectancy is not None else "incomplete"
        lines = [
            "Trade log summary",
            f"- Total loaded: {len(events)}",
            f"- Live: {live_count}",
            f"- Paper: {paper_count}",
            f"- Simulation: {simulation_count} ({simulation_pending} awaiting a daily-candle target/stop threshold)",
            f"- Rejected: {rejected_count}",
            f"- Paper account: {self._paper_account_snapshot()[0]}",
            "",
            "Closed paper performance",
            f"- Closed trades: {paper_summary.closed_trade_count} | W/L/BE: {paper_summary.wins}/{paper_summary.losses}/{paper_summary.breakeven}",
            f"- Win rate: {win_rate} | Expectancy/trade: {expectancy}",
            (f"- Consistency: profit factor "
             f"{f'{consistency.profit_factor:.2f}' if consistency.profit_factor is not None else 'n/a'} | "
             f"best/worst {money(consistency.best_trade)}/{money(consistency.worst_trade)} · {consistency.status}"
             if consistency.status == "complete"
             else f"- Consistency: {consistency.status} · {consistency.note}"),
            f"- Current streak: {paper_summary.current_win_streak} wins / {paper_summary.current_loss_streak} losses",
            (f"- Data note: {'; '.join(paper_summary.incomplete_reasons)}" if paper_summary.incomplete_data else "- Results include only explicitly closed paper trades."),
            "",
            "Recent trade notes",
            f"- Showing {len(filtered_events)} of {len(events)} journal rows",
        ]
        for event in reversed(filtered_events[-14:]):
            symbol = event.get("symbol") or event.get("order", {}).get("symbol") or "-"
            quantity = event.get("quantity") or event.get("order", {}).get("quantity") or "-"
            buy_price = event.get("buy_price") or event.get("order", {}).get("limit_price")
            sold_price = event.get("sold_price")
            sell_status = event.get("sell_status") or "not-sold"
            target = event.get("sell_target_price") or event.get("order", {}).get("target_price")
            stop = event.get("stop_price") or event.get("order", {}).get("stop_price")
            timestamp = event.get("submitted_at") or event.get("recorded_at") or "-"
            lines.append(
                f"{timestamp}\n"
                f"{event.get('mode', '-')} | {event.get('status', '-')} | {symbol} x{quantity}\n"
                f"BUY {money(buy_price)} | SOLD {money(sold_price) if sold_price is not None else '-'} | "
                f"sell {sell_status} | target {money(target)} | stop {money(stop)}"
            )
        self._set_text(self.journal_text, "\n\n".join(lines))

    def _open_journal_filter(self) -> None:
        dialog = tk.Toplevel(self.root)
        dialog.title("Filter trade journal")
        dialog.transient(self.root)
        dialog.configure(bg=self.colors["panel"])
        dialog.columnconfigure(1, weight=1)
        current = self.journal_filter_state
        mode_var = tk.StringVar(value=current.mode or "All")
        symbol_var = tk.StringVar(value=current.symbol or "")
        status_var = tk.StringVar(value=current.status or "")
        start_var = tk.StringVar(value=current.start.strftime("%Y-%m-%d") if current.start else "")
        end_var = tk.StringVar(value=current.end.strftime("%Y-%m-%d") if current.end else "")
        query_var = tk.StringVar(value=current.query or "")
        fields = (("Mode", mode_var), ("Symbol", symbol_var), ("Status", status_var),
                  ("Start date (UTC)", start_var), ("End date (UTC)", end_var), ("Text search", query_var))
        tk.Label(dialog, text="FILTER JOURNAL ROWS", bg=self.colors["panel"], fg=self.colors["teal"],
                 font=("Sans", 11, "bold")).grid(row=0, column=0, columnspan=2, sticky="w", padx=16, pady=(14, 8))
        for row, (label, variable) in enumerate(fields, start=1):
            tk.Label(dialog, text=label, bg=self.colors["panel"], fg=self.colors["muted"],
                     font=("Sans", 9)).grid(row=row, column=0, sticky="w", padx=16, pady=5)
            if label == "Mode":
                ttk.Combobox(dialog, textvariable=variable, values=("All", "Paper", "Simulation", "Live"),
                             state="readonly", width=24).grid(row=row, column=1, sticky="ew", padx=16, pady=5)
            else:
                tk.Entry(dialog, textvariable=variable, bg=self.colors["entry"], fg=self.colors["text"],
                         insertbackground=self.colors["text"], relief="flat").grid(
                             row=row, column=1, sticky="ew", padx=16, pady=5, ipady=5)
        buttons = tk.Frame(dialog, bg=self.colors["panel"])
        buttons.grid(row=7, column=0, columnspan=2, sticky="e", padx=16, pady=(10, 14))

        def apply_filter() -> None:
            try:
                self.journal_filter_state = JournalFilterState(
                    mode=None if mode_var.get() == "All" else mode_var.get(),
                    symbol=symbol_var.get() or None, status=status_var.get() or None,
                    start=start_var.get() or None, end=end_var.get() or None,
                    query=query_var.get() or None,
                )
            except ValueError as exc:
                messagebox.showerror("Invalid journal filter", str(exc), parent=dialog)
                return
            self._load_journal()
            dialog.destroy()

        self._button(buttons, "Clear", lambda: [setattr(self, "journal_filter_state", JournalFilterState()),
                                                  self._load_journal(), dialog.destroy()]).pack(side="left", padx=4)
        self._button(buttons, "Apply", apply_filter).pack(side="left", padx=4)

    def _render_audit_summary(self, events: list[dict]) -> None:
        live_count = sum(1 for event in events if event.get("mode") == "live")
        rejected_count = sum(1 for event in events if str(event.get("status", "")).lower() == "rejected")
        integrity = "Warn" if str(self.audit_status).startswith("Audit warning") else "OK"
        self._update_label_map(
            getattr(self, "audit_summary_labels", {}),
            {
                "Integrity": integrity,
                "Guardrails": integrity,
                "Events": f"{len(events):,}",
                "Live": f"{live_count:,}",
                "Rejected": f"{rejected_count:,}",
            },
        )

    def _render_audit_integrity(self, events: list[dict]) -> None:
        if not hasattr(self, "audit_integrity_text"):
            return
        latest = "-"
        timestamps = [self._event_timestamp(event) for event in events]
        timestamps = [timestamp for timestamp in timestamps if timestamp is not None]
        if timestamps:
            latest = max(timestamps).isoformat(timespec="seconds")
        signed_count = sum(1 for event in events if event.get("event_hash"))
        manifest_label = self._runtime_file_mode_label(self.integrity_manifest_path)
        event_log_label = self._runtime_file_mode_label(self.event_log_path)
        journal_label = self._runtime_file_mode_label(self.journal_path)
        lines = [
            "Guardrail check",
            f"- Status: {self.audit_status}",
            f"- Signed events: {signed_count:,} / {len(events):,}",
            f"- Latest trade note: {latest}",
            "",
            "Protected local files",
            f"- Integrity manifest: {manifest_label}",
            f"- Trade events: {event_log_label}",
            f"- Paper journal: {journal_label}",
            "",
            "Privacy line",
            "- Broker secrets and account IDs stay out of logs, commits, and screenshots.",
        ]
        self._set_text(self.audit_integrity_text, "\n".join(lines))

    def _paper_context_for_plan(self, plan) -> dict:
        signal = self.signal_by_symbol.get(plan.symbol)
        if signal is None:
            return {"robot": "Timmy", "paper_schema": 2}
        config = self.config or self._load_config_safe()
        operational_blocks = self._operational_blocks(signal, config)
        return {
            "paper_schema": 2,
            "source": "native",
            "simulation_lane": "paper-scout" if "paper-scout-simulation" in plan.reason else None,
            "latest_candle_timestamp": self._latest_candle_timestamp(plan.symbol),
            "signal_snapshot": {
                "symbol": signal.symbol,
                "score": signal.score,
                "scout_score": signal.scout_score,
                "scout_action": signal.scout_action,
                "sensible_score": self._local_sensible_score(signal),
                "sensible_action": self._local_sensible_action(signal),
                "decision": signal.decision,
                "direction": signal.direction,
                "setup": signal.setup,
                "close": signal.close,
                "change_pct": signal.change_pct,
                "volatility_pct": signal.volatility_pct,
                "volume_ratio": signal.volume_ratio,
                "reward_risk": signal.reward_risk,
                "expense_status": signal.expense_status,
            },
            "operational_blocks": operational_blocks,
            "controls": {
                "min_score": self.min_score_value,
                "plan_limit": self.plan_limit_value,
                "execution_mode": self.execution_mode_var.get(),
                "paper_auto": self.paper_auto_var.get(),
                "trading_style": self.trading_style_var.get(),
                "patterns": sorted(self._runtime_strategy_patterns()),
            },
        }

    def _latest_candle_timestamp(self, symbol: str) -> str | None:
        bars = self.bars_by_symbol.get(symbol.upper(), [])
        if not bars:
            return None
        return bars[-1].timestamp.isoformat()

    def _reconcile_paper_outcomes(self, bars_by_symbol: dict) -> bool:
        if not bars_by_symbol:
            return False
        changed = False
        simulation_path = getattr(self, "simulation_journal_path", self.journal_path.parent / "simulation-trade-journal.jsonl")
        for path, expected_mode in (
            (self.journal_path, "paper"),
            (simulation_path, "simulation"),
        ):
            if not path.exists():
                continue
            updated_lines: list[str] = []
            path_changed = False
            for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
                if not line.strip():
                    continue
                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    updated_lines.append(line)
                    continue
                if event.get("mode") != expected_mode or event.get("sell_status") != "target-pending":
                    updated_lines.append(json.dumps(event, sort_keys=True))
                    continue
                outcome = self._paper_outcome_for_event(event, bars_by_symbol)
                if outcome:
                    event.update(outcome)
                    if expected_mode == "simulation":
                        event["status"] = str(outcome["status"]).replace("paper-", "simulation-", 1)
                    path_changed = True
                    changed = True
                    self._append_execution_event({
                        **event,
                        "event_type": f"{expected_mode}-outcome",
                        "recorded_at": datetime.now().isoformat(),
                    })
                updated_lines.append(json.dumps(event, sort_keys=True))
            if path_changed:
                _write_private_text(path, "\n".join(updated_lines) + "\n")
                self._refresh_integrity_manifest()
        return changed

    def _paper_outcome_for_event(self, event: dict, bars_by_symbol: dict) -> dict | None:
        symbol = str(event.get("symbol") or event.get("order", {}).get("symbol") or "").upper()
        if not symbol:
            return None
        bars = bars_by_symbol.get(symbol, [])
        if not bars:
            return None
        context = event.get("paper_context") or {}
        start_raw = context.get("latest_candle_timestamp") or event.get("submitted_at")
        start = self._parse_naive_timestamp(start_raw)
        if start is None:
            return None
        target = self._float_or_none(event.get("sell_target_price") or event.get("order", {}).get("target_price"))
        stop = self._float_or_none(event.get("stop_price") or event.get("order", {}).get("stop_price"))
        quantity = self._float_or_none(event.get("quantity") or event.get("order", {}).get("quantity")) or 0.0
        buy_price = self._float_or_none(event.get("buy_price") or event.get("order", {}).get("limit_price"))
        if target is None or stop is None or buy_price is None:
            return None
        for bar in bars:
            if bar.timestamp <= start:
                continue
            hit_stop = bar.low <= stop
            hit_target = bar.high >= target
            if not hit_stop and not hit_target:
                continue
            sold_price = stop if hit_stop else target
            sell_status = "stopped" if hit_stop else "target-hit"
            pnl = round((sold_price - buy_price) * quantity, 2)
            return {
                "status": f"paper-{sell_status}",
                "sold_price": sold_price,
                "sell_status": sell_status,
                "closed_at": bar.timestamp.isoformat(),
                "paper_pnl": pnl,
                "paper_outcome_rule": "stop-first" if hit_stop and hit_target else "ohlc-threshold",
            }
        return None

    @staticmethod
    def _parse_naive_timestamp(raw: str | None) -> datetime | None:
        if not raw:
            return None
        try:
            parsed = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        except ValueError:
            return None
        if parsed.tzinfo is not None:
            parsed = parsed.astimezone(ZoneInfo("America/New_York")).replace(tzinfo=None)
        return parsed

    @staticmethod
    def _float_or_none(value) -> float | None:
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    def _paper_account_snapshot(self) -> tuple[str, str]:
        starting_balance = self._paper_starting_balance()
        paper_events = [event for event in getattr(self, "execution_events", []) if event.get("mode") == "paper"]
        closed_pnl = round(
            sum(
                self._float_or_none(event.get("paper_pnl")) or 0.0
                for event in paper_events
                if event.get("sell_status") in {"target-hit", "stopped"}
            ),
            2,
        )
        pending_notional = 0.0
        pending_count = 0
        for event in paper_events:
            if event.get("sell_status") != "target-pending":
                continue
            quantity = self._float_or_none(event.get("quantity") or event.get("order", {}).get("quantity")) or 0.0
            buy_price = self._float_or_none(event.get("buy_price") or event.get("order", {}).get("limit_price")) or 0.0
            pending_notional += quantity * buy_price
            pending_count += 1
        available = round(starting_balance + closed_pnl - pending_notional, 2)
        return money(available), f"{pending_count} open / P&L {money(closed_pnl)}"

    @staticmethod
    def _paper_starting_balance() -> float:
        try:
            return float(os.getenv("PAPER_ACCOUNT_STARTING_BALANCE_USD", "10000"))
        except ValueError:
            return 10000.0

    def _write_paper_training_summary(self) -> None:
        paper_events = [event for event in self.execution_events if event.get("mode") == "paper"]
        closed = [event for event in paper_events if event.get("sell_status") in {"target-hit", "stopped"}]
        wins = [event for event in closed if event.get("sell_status") == "target-hit"]
        losses = [event for event in closed if event.get("sell_status") == "stopped"]
        pending = [event for event in paper_events if event.get("sell_status") == "target-pending"]
        pnl = round(sum(self._float_or_none(event.get("paper_pnl")) or 0.0 for event in closed), 2)
        summary = {
            "updated_at": datetime.now().isoformat(),
            "schema": 1,
            "total_paper_events": len(paper_events),
            "closed_events": len(closed),
            "pending_events": len(pending),
            "wins": len(wins),
            "losses": len(losses),
            "win_rate": round(len(wins) / len(closed), 4) if closed else None,
            "net_paper_pnl": pnl,
            "symbols": self._paper_symbol_summary(paper_events),
        }
        try:
            _write_private_json(self.paper_research_path, summary)
        except OSError as exc:
            self._paper_summary_storage_error = f"{type(exc).__name__}: {exc}"
            if hasattr(self, "status_bar"):
                self.status_bar.configure(text=f"Paper summary could not be saved: {self._paper_summary_storage_error[:150]}")
        else:
            self._paper_summary_storage_error = None

    def _paper_symbol_summary(self, events: list[dict]) -> dict:
        summary: dict[str, dict] = {}
        for event in events:
            symbol = str(event.get("symbol") or event.get("order", {}).get("symbol") or "").upper()
            if not symbol:
                continue
            bucket = summary.setdefault(symbol, {"events": 0, "wins": 0, "losses": 0, "pending": 0, "pnl": 0.0})
            bucket["events"] += 1
            status = event.get("sell_status")
            if status == "target-hit":
                bucket["wins"] += 1
            elif status == "stopped":
                bucket["losses"] += 1
            elif status == "target-pending":
                bucket["pending"] += 1
            bucket["pnl"] = round(bucket["pnl"] + (self._float_or_none(event.get("paper_pnl")) or 0.0), 2)
        return summary

    def _run_action(self, label: str, action, threaded: bool = True) -> None:
        if self.closing:
            return
        if self._action_in_progress:
            self.status_bar.configure(text=f"{self._active_action_label} is still in progress. Please wait.")
            return
        if self._refresh_in_progress:
            self.status_bar.configure(text="Market refresh is still in progress. Please wait before starting another action.")
            return
        self._action_in_progress = True
        self._active_action_label = label
        self.status_bar.configure(text=f"{label}...")
        self._set_buttons_state("disabled")

        def run_action() -> None:
            try:
                result = action()
                self._action_done(label, result)
            except Exception as exc:
                self._action_error(label, exc)

        if not threaded:
            self.root.after(0, run_action)
            return

        def worker() -> None:
            try:
                result = action()
                if not self.closing:
                    self.root.after(0, lambda result=result: self._action_done(label, result))
            except Exception as exc:
                if not self.closing:
                    self.root.after(0, lambda exc=exc: self._action_error(label, exc))

        threading.Thread(target=worker, daemon=True).start()

    def _action_done(self, label: str, result: str) -> None:
        if label in {
            "Checking Webull",
            "Verifying Webull profile",
            "Auto Webull balance refresh",
            "Previewing order",
            "Paper trade",
            "Submitting live order",
            "Previewing and submitting live order",
        } or label in {"Previewing selected target", "Submitting Paper", "Submitting Simulation"}:
            self._set_text(self.broker_text, result)
        if label in {"Checking Webull", "Verifying Webull profile", "Auto Webull balance refresh"}:
            self.cash_card[0].configure(text=self.trade_cash_snapshot[0])
            self.cash_card[1].configure(text=self.trade_cash_snapshot[1])
            self._render_status()
            self._render_setup_status()
            self._render_portfolio_panel()
        if label in {"Paper trade", "Submitting Paper", "Submitting Simulation"}:
            self._load_journal()
        status = self._live_submission_status(label, result)
        self.status_bar.configure(text=status or f"{label} complete.")
        self._action_in_progress = False
        self._active_action_label = ""
        self._set_buttons_state("normal")
        self._sync_manual_controls()
        self._sync_profile_save_state()

    @classmethod
    def _live_submission_status(cls, label: str, result: str) -> str | None:
        if label not in {"Submitting live order", "Previewing and submitting live order"}:
            return None
        payload_text = result
        if "Live submit result:\n" in result:
            payload_text = result.split("Live submit result:\n", 1)[1]
        if payload_text.startswith("TARGET: LIVE · WEBULL\n"):
            payload_text = payload_text.split("\n", 1)[1]
        try:
            payload = json.loads(payload_text)
        except (TypeError, ValueError):
            lowered = result.lower()
            if "no executable plans" in lowered or "order was not submitted" in lowered:
                return "Live order was not submitted. Review Broker Details for the reason."
            return None
        rows = payload if isinstance(payload, list) else [payload] if isinstance(payload, dict) else []
        if any(isinstance(row, dict) and row.get("timmy_journal_error") for row in rows):
            return "Critical: Timmy could not journal a broker response and stopped the batch. Reconcile Webull before any live retry."
        statuses = {cls._broker_event_status(row) for row in rows if isinstance(row, dict)}
        if "unknown" in statuses:
            return "Live order outcome is unknown. Check Webull before retrying; Timmy blocks unresolved duplicates."
        if "rejected" in statuses:
            return "Webull rejected the live order request. Review Broker Details before another attempt."
        if "preview-required" in statuses:
            return "Live order was not submitted; the required preview is missing or expired."
        if "accepted" in statuses:
            return "Webull accepted the order request. Confirm its current state in Webull; acceptance is not a fill."
        if "failed" in statuses:
            return "Live order failed. Review Broker Details before retrying."
        if "preflight-blocked" in statuses:
            return "Live Auto held because the current Webull order/position snapshot could not be verified; no order was sent."
        if "exposure-blocked" in statuses:
            return "Live Auto found an existing or ambiguous order/position for a planned symbol; no duplicate entry was sent."
        if "risk-blocked" in statuses:
            return "Live Auto risk evaluation blocked this candidate before preview. Review Broker Details for the exact reasons."
        if "activity-blocked" in statuses:
            return "Live Auto skipped a candidate because a daily trade or rejection limit was reached."
        return None

    def _handle_tk_exception(self, exc_type, exc_value, exc_traceback) -> None:
        details = "".join(traceback.format_exception(exc_type, exc_value, exc_traceback))
        self._write_crash_log(details)
        try:
            self.status_bar.configure(text=f"Recovered UI error: {exc_value}")
            self._set_text(self.broker_text, details)
            self._action_in_progress = False
            self._active_action_label = ""
            self._set_buttons_state("normal")
            self._sync_manual_controls()
        except tk.TclError:
            pass

    def _write_crash_log(self, details: str) -> None:
        try:
            self.crash_log_path.parent.mkdir(parents=True, exist_ok=True)
            with self.crash_log_path.open("a", encoding="utf-8") as file:
                file.write(f"\n[{datetime.now().isoformat()}] Timmy recovered exception\n")
                file.write(details)
                file.write("\n")
            self.crash_log_path.chmod(0o600)
        except OSError:
            pass

    def _action_error(self, label: str, exc: Exception) -> None:
        self._write_crash_log(f"{label} failed\n{''.join(traceback.format_exception(type(exc), exc, exc.__traceback__))}")
        if label == "Verifying Webull profile":
            self.verified_profile_fingerprint = None
            self.profile_verification_status = "Verification failed"
            self._render_setup_status()
        self.status_bar.configure(text=f"{label} failed: {exc}")
        self._set_text(self.broker_text, str(exc))
        self._action_in_progress = False
        self._active_action_label = ""
        self._set_buttons_state("normal")
        self._sync_manual_controls()
        self._sync_profile_save_state()

    def _set_buttons_state(self, state: str) -> None:
        for button in self.busy_controls:
            try:
                button.configure(state=state)
            except tk.TclError:
                pass

    def _sync_manual_controls(self) -> None:
        locked = self.execution_mode_var.get() == "Auto" or self._automatic_fallback_active
        config = self._execution_config(self.config or self._load_config_safe())
        target = self.execution_target_var.get()
        live_target = target == "Live"
        has_plans = bool(self.plans)
        for button in self.manual_controls:
            state = "disabled" if locked else "normal"
            if button is self.preview_button and not has_plans:
                state = "disabled"
            if button is self.paper_trade_button and not has_plans:
                state = "disabled"
            if button is self.live_button and (not has_plans or (live_target and not self._live_ready(config))):
                state = "disabled"
            if button is self.live_button and live_target and self._selected_account_needs_broker_check(config):
                state = "disabled"
            if button is self.preview_button and live_target and not config.webull_account_id:
                state = "disabled"
            if button is self.execution_submit_button and target == "Simulation" and has_plans:
                if not all(self._has_local_preview(plan, "Simulation") for plan in self.plans[: self.plan_limit_value]):
                    state = "disabled"
            try:
                button.configure(state=state)
            except tk.TclError:
                pass
        if locked:
            self.status_bar.configure(text="Auto mode active. Manual execution controls locked.")
        self._sync_execution_target_controls()
        self._sync_webull_account_toggle(config)

    def _toggle_webull_account_target(self) -> None:
        config = self._execution_config(self.config or self._load_config_safe())
        if self.webull_account_toggle_var.get():
            if not config.webull_account_id:
                self.execution_target_var.set("Paper")
                self.webull_account_toggle_var.set(False)
                self.status_bar.configure(text="Webull account is not configured. Target remains Paper.")
            elif self._selected_account_needs_broker_check(config):
                self.execution_target_var.set("Paper")
                self.webull_account_toggle_var.set(False)
                self.status_bar.configure(text="Run Account Check before enabling Live on the selected account.")
            else:
                self.execution_target_var.set("Live")
                self.status_bar.configure(text=f"Webull account selected: {self._mask_account_id(config.webull_account_id)}")
        else:
            self.execution_target_var.set("Paper")
            self.status_bar.configure(text="Paper target selected. Webull account is visible but not active for execution.")
        self._sync_manual_controls()
        self._render_status()
        self._render_setup_status()

    def _sync_account_lane(self) -> None:
        config = self.config or self._load_config_safe()
        if self._account_lane() == "Crypto" and not self._crypto_account_is_separate(config):
            self._set_account_lane("I-Cash")
            status = "Crypto buying power appears linked to I-Cash; no separate crypto account ID is configured."
            if self._crypto_account_id(config):
                status = "Crypto and I-Cash are configured to the same account; staying on I-Cash."
            self.status_bar.configure(text=status)
        else:
            active = self._execution_config(config).webull_account_id
            self.status_bar.configure(text=f"{self._account_lane()} account selected: {self._mask_account_id(active)}")
        self._sync_manual_controls()
        self._render_status()
        self._render_setup_status()

    def _sync_webull_account_toggle(self, config: BotConfig) -> None:
        toggle = getattr(self, "webull_account_toggle", None)
        if toggle is None:
            return
        selected = self.execution_target_var.get() == "Live" and bool(config.webull_account_id)
        if self._selected_account_needs_broker_check(config):
            selected = False
        self.webull_account_toggle_var.set(selected)
        toggle.configure(
            text=self._webull_account_toggle_text(config),
            bg=self.colors["selected"] if selected else self.colors["button"],
            fg=self.colors["selected_text"] if selected else self.colors["button_text"],
            activebackground=self.colors["selected"] if selected else self.colors["panel_2"],
            activeforeground=self.colors["selected_text"] if selected else self.colors["text"],
        )

    def _webull_account_toggle_text(self, config: BotConfig) -> str:
        if not config.webull_account_id:
            return "Webull Account\nNot configured"
        if self._selected_account_needs_broker_check(config):
            return "Webull Account\nCheck required"
        account = self.account_snapshot[0] if self.account_snapshot[0] != "Unknown" else "Configured"
        masked = self._mask_account_id(config.webull_account_id)
        target = self.execution_target_var.get()
        return f"{self._account_lane()} Account\n{target}: {account} {masked}"

    def _selected_account_needs_broker_check(self, config: BotConfig) -> bool:
        selected = self._selected_webull_account_override()
        if selected and selected != config.webull_account_id:
            return False
        return self._broker_check_required(config)

    def _broker_check_required(self, config: BotConfig) -> bool:
        source = str(self.trade_cash_snapshot[1] or "")
        return bool(config.webull_account_id and source in {"Run Account Check", "Run Broker Check", "Run Check Webull"})

    def _webull_account_card_value(self, config: BotConfig) -> str:
        if not config.webull_account_id:
            return "Missing"
        if self.account_snapshot[0] == "Unknown":
            return self._mask_account_id(config.webull_account_id)
        return self.account_snapshot[0]

    def _webull_account_card_detail(self, config: BotConfig) -> str:
        if not config.webull_account_id:
            return "Configure account"
        target = self.execution_target_var.get()
        masked = self._mask_account_id(config.webull_account_id)
        detail = self.account_snapshot[1]
        if detail in {"Run Check Webull", "Run Broker Check"}:
            detail = "Run Account Check"
        return f"{self._account_lane()} | {target} | {masked} | {detail}"[:40]

    def _refresh_webull_account_menu(self, config: BotConfig | None = None) -> None:
        menu_widgets = [
            widget
            for widget in (
                getattr(self, "webull_account_menu", None),
                getattr(self, "setup_account_menu", None),
            )
            if widget is not None
        ]
        if not menu_widgets:
            return
        config = config or self.config or self._load_config_safe()
        choices = list(self.webull_account_choices)
        configured_id = self._icash_account_id(config)
        if configured_id and not any(choice.get("id") == configured_id for choice in choices):
            choices.insert(0, {"id": configured_id, "label": "Configured", "detail": "Local default"})
        labels: dict[str, str] = {}
        for menu_widget in menu_widgets:
            menu_widget["menu"].delete(0, "end")
        if not choices:
            label = "No account loaded"
            labels[label] = ""
            for menu_widget in menu_widgets:
                menu_widget["menu"].add_command(label=label, command=lambda value=label: self._select_webull_account(value))
            self.webull_account_choice_var.set(label)
            self.webull_account_labels = labels
            return
        selected_id = self._selected_webull_account_override() or configured_id or choices[0].get("id", "")
        selected_label = ""
        for choice in choices:
            account_id = str(choice.get("id") or "")
            if not account_id:
                continue
            label = self._webull_account_choice_label(choice)
            base_label = label
            suffix = 2
            while label in labels:
                label = f"{base_label} ({suffix})"
                suffix += 1
            labels[label] = account_id
            for menu_widget in menu_widgets:
                menu_widget["menu"].add_command(label=label, command=lambda value=label: self._select_webull_account(value))
            if account_id == selected_id:
                selected_label = label
        self.webull_account_labels = labels
        self.webull_account_choice_var.set(selected_label or next(iter(labels)))

    def _select_webull_account(self, label: str) -> None:
        account_id = self.webull_account_labels.get(label, "")
        self.webull_account_choice_var.set(label)
        if not account_id:
            return
        previous = self._selected_webull_account_override()
        self.selected_webull_account_id_var.set(account_id)
        if previous != account_id:
            self.previewed_order_fingerprints.clear()
            self.trade_cash_snapshot = ("-", "Run Account Check")
            self.trade_cash_value = None
            self.account_snapshot = ("Selected", "Run Account Check")
            self.execution_target_var.set("Paper")
            self._set_text(
                self.broker_text,
                f"Selected Webull account {self._mask_account_id(account_id)}.\n\nRun Account Check before enabling Live on this account.",
            )
            self.status_bar.configure(text="Account changed. Account Check required before Live.")
        self._save_runtime_settings()
        self._sync_manual_controls()
        self._render_status()

    def _webull_account_choice_label(self, choice: dict[str, str]) -> str:
        account_id = choice.get("id") or ""
        label = choice.get("label") or "Webull"
        detail = choice.get("detail") or "account"
        return f"{label} {self._mask_account_id(account_id)} | {detail}"[:42]

    def _extract_webull_account_choices(self, result: dict) -> list[dict[str, str]]:
        body = result.get("body")
        if isinstance(body, dict):
            candidates = body.get("accounts") or body.get("account_list") or body.get("data") or [body]
        else:
            candidates = body
        if not isinstance(candidates, list):
            candidates = [candidates]
        choices: list[dict[str, str]] = []
        seen: set[str] = set()
        for item in candidates:
            if not isinstance(item, dict):
                continue
            account_id = self._account_id_from_payload(item)
            if not account_id or account_id in seen:
                continue
            seen.add(account_id)
            label, detail = self._extract_account_summary({"body": item}, account_id)
            choices.append({"id": account_id, "label": label, "detail": detail})
        return choices

    def _account_id_from_payload(self, payload: dict) -> str | None:
        preferred_keys = (
            "account_id",
            "accountid",
            "account_number",
            "accountnumber",
            "broker_account_id",
            "brokeraccountid",
        )
        fallback: str | None = None
        for key, value in self._walk_items(payload):
            normalized = key.lower().replace("-", "_").replace(" ", "_")
            compact = normalized.replace("_", "")
            if value in (None, ""):
                continue
            text = str(value).strip()
            if compact in preferred_keys or normalized in preferred_keys:
                return text
            if fallback is None and "account" in compact and ("id" in compact or "number" in compact):
                fallback = text
        return fallback

    def _show_selected_signal(self, _event=None) -> None:
        selection = self.signal_tree.selection()
        if not selection:
            self._set_text(self.signal_detail, "Select a signal to inspect the decision inputs.")
            self.selected_chart_symbol = ""
            self.market_chart_title.configure(text="Select a symbol")
            self.market_chart_move.configure(text="—", fg=self.colors["muted"])
            self._draw_market_chart()
            return
        symbol = self.signal_tree.item(selection[0], "values")[0]
        self._display_selected_signal(symbol)

    def _show_market_watch_selection(self, _event=None) -> None:
        selection = self.market_watch_tree.selection()
        if not selection:
            return
        symbol = self.market_watch_tree.item(selection[0], "values")[0]
        self._display_selected_signal(symbol)
        signal = self.signal_by_symbol.get(symbol)
        if signal is not None:
            self.market_watch_footer.configure(
                text=f"{signal.decision} · {signal.direction} bias · {self._price_gate_label(signal)}")

    def _watchlist_group_for_selection(self):
        label = self.watchlist_group_var.get()
        return next((group for group in self.watchlist_organization.groups if group.name == label), None)

    def _refresh_watchlist_group_menu(self) -> None:
        if not hasattr(self, "watchlist_group_menu"):
            return
        labels = ["All signals", "Pinned"] + [group.name for group in self.watchlist_organization.groups]
        self.watchlist_group_menu.configure(values=labels)
        if self.watchlist_group_var.get() not in labels:
            self.watchlist_group_var.set("All signals")

    def _create_watchlist_group(self) -> None:
        name = simpledialog.askstring("New watchlist group", "Name this personal ticker group:", parent=self.root)
        if not name:
            return
        try:
            group = self.watchlist_organization.create_group(name)
        except (OSError, ValueError) as exc:
            messagebox.showerror("Watchlist group", str(exc), parent=self.root)
            return
        self.watchlist_group_var.set(group.name)
        self._refresh_watchlist_group_menu()
        self._render_signals()
        self.status_bar.configure(text=f"Personal group '{group.name}' created. It does not change trading scope.")

    def _add_selected_to_watchlist_group(self) -> None:
        group = self._watchlist_group_for_selection()
        symbol = getattr(self, "selected_chart_symbol", "")
        if group is None or not symbol:
            messagebox.showinfo("Watchlist group", "Choose a personal group and select a ticker first.", parent=self.root)
            return
        try:
            self.watchlist_organization.add_symbol(group.id, symbol)
        except (OSError, ValueError) as exc:
            messagebox.showerror("Watchlist group", str(exc), parent=self.root)
            return
        self._render_signals()
        self.status_bar.configure(text=f"{symbol} added to personal group '{group.name}'.")

    def _toggle_selected_watchlist_pin(self) -> None:
        symbol = getattr(self, "selected_chart_symbol", "")
        if not symbol:
            return
        try:
            if symbol in self.watchlist_organization.pinned_symbols:
                self.watchlist_organization.unpin_symbol(symbol)
                state = "unpinned"
            else:
                self.watchlist_organization.pin_symbol(symbol)
                state = "pinned"
        except (OSError, ValueError) as exc:
            messagebox.showerror("Pinned ticker", str(exc), parent=self.root)
            return
        self._render_signals()
        self.status_bar.configure(text=f"{symbol} {state} in your personal watchlist.")

    def _sync_local_quiet_button(self) -> None:
        button = getattr(self, "local_quiet_button", None)
        if button is None:
            return
        symbol = getattr(self, "selected_chart_symbol", "")
        is_quiet = bool(symbol and self.watchlist_organization.is_quiet(symbol))
        button.configure(text="Unquiet" if is_quiet else "Quiet")

    def _toggle_selected_local_quiet(self) -> None:
        symbol = getattr(self, "selected_chart_symbol", "")
        if not symbol:
            messagebox.showinfo("Local quiet", "Select a ticker in the radar or scanner first.", parent=self.root)
            return
        try:
            if self.watchlist_organization.is_quiet(symbol):
                self.watchlist_organization.unquiet_symbol(symbol)
                state = "unquieted"
            else:
                self.watchlist_organization.quiet_symbol(symbol)
                state = "quieted locally"
        except (OSError, ValueError) as exc:
            messagebox.showerror("Local quiet", str(exc), parent=self.root)
            return
        self._render_signals()
        self.status_bar.configure(
            text=f"{symbol} {state} in research/radar and local alerts only; trading scope is unchanged."
        )

    def _display_selected_signal(self, symbol: str) -> None:
        signal = self.signal_by_symbol.get(symbol)
        if signal is None:
            return
        self.selected_chart_symbol = symbol
        self._sync_local_quiet_button()
        try:
            self.workspace_store.remember_symbol(symbol)
        except ValueError:
            pass
        self._save_last_workspace_state()
        self.market_chart_title.configure(text=f"{symbol} · {signal.close:,.2f}")
        self.market_chart_move.configure(
            text=f"{signal.change_pct:+.2f}%",
            fg=self.colors["green"] if signal.change_pct >= 0 else self.colors["red"],
        )
        try:
            if self._sample_data_in_use:
                quality_text, quality_color = "SAMPLE DATA · NOT MARKET QUOTES", self.colors["gold"]
            else:
                quality = summarize_candle_quality(self.bars_by_symbol.get(symbol, []), interval_minutes=1440,
                                                   stale_after_minutes=4320)
                item = next((row for row in quality.symbols if row.symbol == symbol.upper()), None)
                if item is None:
                    quality_text, quality_color = "DATA · NO DATA", self.colors["muted"]
                else:
                    age = f"{item.age_minutes / 60:.0f}h old" if item.age_minutes is not None else "age unknown"
                    issues = item.missing_bars_estimate + item.duplicate_timestamps + item.invalid_ohlc_bars
                    detail = f" · {issues} quality flags" if issues else ""
                    quality_text, quality_color = f"DATA · {item.label} · {age}{detail}", {
                        "CURRENT": self.colors["green"], "AGING": self.colors["gold"],
                        "STALE": self.colors["red"], "CHECK DATA": self.colors["red"],
                    }.get(item.label, self.colors["muted"])
            self.market_chart_data_quality.configure(text=quality_text, fg=quality_color)
        except (ValueError, TypeError, OverflowError):
            self.market_chart_data_quality.configure(text="DATA · quality unavailable", fg=self.colors["muted"])
        self._draw_market_chart()
        reasons = "\n".join(f"- {reason}" for reason in signal.reasons)
        expense = "\n".join(f"- {reason}" for reason in signal.expense_reasons) or "- price gate clear"
        config = self.config or self._load_config_safe()
        operational = "\n".join(f"- {reason}" for reason in self._operational_blocks(signal, config)) or "- operational gates clear"
        self._set_text(
            self.signal_detail,
            f"{signal.symbol} | {signal.decision} | score {signal.score}\n"
            f"Scout: {self._scout_label(signal)}\n"
            f"Sensible: {self._sensible_label(signal)}\n"
            f"Bias: {signal.direction} | Setup: {signal.setup}\n"
            f"Price gate: {self._price_gate_label(signal)}\n"
            f"Close {money(signal.close)} | Latest move {signal.change_pct:+.2f}% | Avg change {signal.volatility_pct:.2f}% | Volume x{signal.volume_ratio or 0:.2f}\n"
            f"Buy limit {money(signal.entry)} | Stop {money(signal.stop)} | Sell target {money(signal.target)} | R/R {signal.reward_risk:.2f}\n"
            f"Scout reasons:\n{reasons}\nPrice checks:\n{expense}\nOperational checks:\n{operational}",
        )
        if getattr(self, "active_tab", None) == "Overview":
            self._set_text(self.decision_text, self._market_decision_brief(signal))

    def _market_decision_brief(self, signal) -> str:
        config = self.config or self._load_config_safe()
        decision_audit = audit_signal_decision(signal, config)
        blockers = self._operational_blocks(signal, config)
        status = "READY FOR REVIEW" if not blockers else "GATED · REVIEW REQUIRED"
        explanation = explain_signal(signal)
        gate = self._price_gate_label(signal)
        lines = [
            status,
            f"{signal.symbol} · {signal.decision} · score {signal.score}/100",
            f"{signal.direction} bias · {signal.setup} · {gate}",
            "",
            f"ENTRY   {money(signal.entry)}",
            f"STOP    {money(signal.stop)}",
            f"TARGET  {money(signal.target)} · R/R {signal.reward_risk:.2f}",
            "",
            "SUPPORT / CAUTION",
        ]
        lines.extend(f"{factor.status.upper()} · {factor.detail}" for factor in explanation.factors[:3])
        note = self.symbol_notes.get(signal.symbol)
        if note is not None:
            lines.extend(("", "YOUR NOTE", note.text))
        guidance = explain_blockers(blockers)
        if guidance:
            lines.extend(("", "GATE · NEXT STEP", f"{guidance[0].message}: {guidance[0].next_step}"))
        else:
            lines.extend(("", "GATE", "No operational blocks"))
        decision_blocks = [gate for gate in decision_audit.gates if gate.status == "block"]
        lines.extend(("", "PLAN DECISION", decision_audit.summary))
        if decision_blocks:
            lines.extend(f"BLOCK · {gate.name}: {gate.detail}" for gate in decision_blocks[:3])
        else:
            lines.append("All signal-to-plan gates pass; execution still requires the normal preview and controls.")
        return (
            "\n".join(lines)
        )

    def _open_sizing_preview(self) -> None:
        symbol = getattr(self, "selected_chart_symbol", "")
        signal = self.signal_by_symbol.get(symbol)
        if signal is None:
            messagebox.showinfo("Sizing preview", "Select a symbol in the Market radar first.", parent=self.root)
            return
        config = self.config or self._load_config_safe()
        preview = position_what_if(signal, config, available_cash=self.trade_cash_value)
        lines = [f"{preview.symbol} · hypothetical sizing", ""]
        if not preview.rows:
            lines.append(preview.note)
        else:
            lines.append(f"Entry {money(preview.entry)} · Stop {money(preview.stop)} · Target {money(preview.target)}")
            lines.append("")
            lines.extend(
                f"{row.size_multiplier:g}× risk · {row.quantity:g} shares · {money(row.notional)} notional · "
                f"{money(row.estimated_stop_loss)} stop risk · {money(row.estimated_target_gain)} target gain · {row.binding_limit}"
                for row in preview.rows
            )
        lines.extend(("", preview.note, "No order is created or sent by this preview."))
        messagebox.showinfo("Sizing preview", "\n".join(lines), parent=self.root)

    def _open_risk_planning_lab(self) -> None:
        existing = getattr(self, "_risk_planning_lab", None)
        if existing is not None:
            try:
                if existing.window.winfo_exists():
                    existing.window.lift()
                    existing._reload_data()
                    return
            except tk.TclError:
                pass
        self._risk_planning_lab = RiskPlanningLab(self.root, self)

    def _edit_selected_symbol_note(self) -> None:
        symbol = getattr(self, "selected_chart_symbol", "")
        if not symbol:
            messagebox.showinfo("Ticker note", "Select a symbol in the Market radar first.", parent=self.root)
            return
        existing = self.symbol_notes.get(symbol)
        dialog = tk.Toplevel(self.root)
        dialog.title(f"{symbol} research note")
        dialog.transient(self.root)
        dialog.configure(bg=self.colors["panel"])
        dialog.columnconfigure(0, weight=1)
        dialog.rowconfigure(1, weight=1)
        tk.Label(dialog, text=f"YOUR NOTE · {symbol}", bg=self.colors["panel"], fg=self.colors["teal"],
                 font=("Sans", 10, "bold"), anchor="w").grid(row=0, column=0, sticky="ew", padx=16, pady=(14, 8))
        note_text = tk.Text(dialog, width=56, height=10, bg=self.colors["panel_2"], fg=self.colors["text"],
                            insertbackground=self.colors["text"], relief="flat", wrap="word", padx=10, pady=8)
        note_text.grid(row=1, column=0, sticky="nsew", padx=16)
        if existing:
            note_text.insert("1.0", existing.text)
        tk.Label(dialog, text="Stored locally with Timmy's workspace data.", bg=self.colors["panel"],
                 fg=self.colors["muted"], font=("Sans", 8), anchor="w").grid(row=2, column=0, sticky="ew", padx=16, pady=6)

        def save_note() -> None:
            text = note_text.get("1.0", "end-1c").strip()
            if not text:
                if existing:
                    self.symbol_notes.delete(symbol)
                dialog.destroy()
                self._refresh_selected_decision_note(symbol)
                return
            try:
                self.symbol_notes.save(symbol, text)
            except (ValueError, OSError) as exc:
                messagebox.showerror("Note not saved", str(exc), parent=dialog)
                return
            dialog.destroy()
            self._refresh_selected_decision_note(symbol)

        actions = tk.Frame(dialog, bg=self.colors["panel"])
        actions.grid(row=3, column=0, sticky="e", padx=16, pady=(0, 14))
        self._button(actions, "Cancel", dialog.destroy).pack(side="right", padx=(8, 0))
        self._button(actions, "Save note", save_note, accent="teal").pack(side="right")
        dialog.bind("<Control-Return>", lambda _event: save_note())
        dialog.bind("<Escape>", lambda _event: dialog.destroy())
        dialog.grab_set()
        note_text.focus_set()

    def _refresh_selected_decision_note(self, symbol: str) -> None:
        signal = self.signal_by_symbol.get(symbol)
        if signal is not None and getattr(self, "active_tab", None) == "Overview":
            self._set_text(self.decision_text, self._market_decision_brief(signal))
        self.status_bar.configure(text=f"Ticker note for {symbol} saved locally.")

    def _draw_market_chart(self) -> None:
        canvas = getattr(self, "market_chart", None)
        if canvas is None:
            return
        try:
            canvas.delete("all")
            width = max(1, canvas.winfo_width())
            height = max(1, canvas.winfo_height())
        except tk.TclError:
            return
        symbol = getattr(self, "selected_chart_symbol", "")
        all_bars = self.bars_by_symbol.get(symbol, []) if symbol else []
        signal = self.signal_by_symbol.get(symbol)
        chart_limit = self._coerce_int(self.chart_window_var.get(), 80, 20, 120)
        context = chart_context(all_bars, signal, symbol=symbol, limit=chart_limit) if symbol else None
        if context is None or len(context.candles) < 2:
            canvas.create_text(width / 2, height / 2, text="Price history appears after a market data refresh",
                               fill=self.colors["muted"], font=("Sans", 9), anchor="center")
            return
        bars = [bar for bar in all_bars if getattr(bar, "symbol", "").upper() == symbol.upper()][-chart_limit:]
        left, right = 42, max(43, width - 12)
        top, bottom = 12, max(30, height - (48 if self.chart_volume_var.get() else 22))
        self._chart_render_context = context
        self._chart_render_bars = bars
        self._chart_plot_bounds = (left, right, top, bottom)
        low, high = context.price_min, context.price_max
        for fraction in (0.0, 0.5, 1.0):
            y = bottom - fraction * (bottom - top)
            value = low + fraction * (high - low)
            canvas.create_line(left, y, right, y, fill=self.colors["line"], width=1)
            canvas.create_text(left - 5, y, text=f"{value:.2f}", fill=self.colors["muted"],
                               font=("Sans", 7), anchor="w")
        candle_step = (right - left) / max(len(context.candles) - 1, 1)
        candle_width = max(3, min(11, candle_step * 0.56))
        def chart_xy(x_value: float, y_value: float) -> tuple[float, float]:
            return left + x_value * (right - left), bottom - y_value * (bottom - top)

        for candle in context.candles:
            x, y_high = chart_xy(candle["x"], candle["high"])
            _, y_low = chart_xy(candle["x"], candle["low"])
            _, y_open = chart_xy(candle["x"], candle["open"])
            _, y_close = chart_xy(candle["x"], candle["close"])
            candle_color = self.colors["green"] if candle["close_value"] >= candle["open_value"] else self.colors["red"]
            canvas.create_line(x, y_high, x, y_low, fill=candle_color, width=1)
            body_top = min(y_open, y_close)
            body_bottom = max(y_open, y_close)
            if body_bottom - body_top < 2:
                body_bottom = body_top + 2
            canvas.create_rectangle(x - candle_width / 2, body_top, x + candle_width / 2, body_bottom,
                                    fill=candle_color, outline=candle_color)
        if self.chart_sma_var.get():
            for points, color in ((context.sma20, self.colors["gold"]), (context.sma50, self.colors["teal"])):
                coords = [chart_xy(point.x, point.y) for point in points]
                if len(coords) > 1:
                    canvas.create_line(*[coordinate for point in coords for coordinate in point],
                                       fill=color, width=1.5, smooth=False)
        if self.chart_levels_var.get():
            level_colors = {"Entry": self.colors["teal"], "Stop": self.colors["red"], "Target": self.colors["green"]}
            for level in context.levels:
                _, y = chart_xy(0, level.y)
                color = level_colors.get(level.name, self.colors["muted"])
                canvas.create_line(left, y, right, y, fill=color, dash=(5, 3), width=1)
                canvas.create_text(right - 2, y - 7, text=f"{level.name} {level.value:.2f}",
                                   fill=color, font=("Sans", 7, "bold"), anchor="e")
        last_y = chart_xy(0, context.candles[-1]["close"])[1]
        canvas.create_line(left, last_y, right, last_y, fill=self.colors["muted"], dash=(2, 4))
        first_day = getattr(bars[0], "timestamp", None)
        last_day = getattr(bars[-1], "timestamp", None)
        if hasattr(first_day, "strftime") and hasattr(last_day, "strftime"):
            canvas.create_text(left, height - 1, text=first_day.strftime("%b %d"),
                               fill=self.colors["muted"], font=("Sans", 7), anchor="s")
            canvas.create_text(right, height - 1, text=last_day.strftime("%b %d"),
                               fill=self.colors["muted"], font=("Sans", 7), anchor="s")
        if self.chart_volume_var.get():
            volume_top = bottom + 10
            volume_bottom = height - 18
            canvas.create_line(left, volume_top, right, volume_top, fill=self.colors["line"], width=1)
            for candle, volume in zip(context.candles, context.volume_bars):
                x, _ = chart_xy(candle["x"], 0)
                bar_height = max(1, volume.height * max(1, volume_bottom - volume_top))
                color = self.colors["green"] if candle["close_value"] >= candle["open_value"] else self.colors["red"]
                canvas.create_rectangle(x - candle_width / 2, volume_bottom - bar_height,
                                        x + candle_width / 2, volume_bottom, fill=color, outline="")

    def _market_chart_hover(self, event) -> None:
        context = getattr(self, "_chart_render_context", None)
        bounds = getattr(self, "_chart_plot_bounds", None)
        bars = getattr(self, "_chart_render_bars", [])
        if context is None or bounds is None or not context.candles:
            return
        left, right, top, bottom = bounds
        if not left <= event.x <= right or not top <= event.y <= bottom:
            self.market_chart.delete("hover")
            return
        fraction = (event.x - left) / max(right - left, 1)
        index = max(0, min(len(context.candles) - 1, round(fraction * (len(context.candles) - 1))))
        candle = context.candles[index]
        price_fraction = (bottom - event.y) / max(bottom - top, 1)
        cursor_price = context.price_min + price_fraction * (context.price_max - context.price_min)
        x = left + candle["x"] * (right - left)
        self.market_chart.delete("hover")
        self.market_chart.create_line(x, top, x, bottom, fill=self.colors["muted"], dash=(3, 3), tags="hover")
        self.market_chart.create_line(left, event.y, right, event.y, fill=self.colors["muted"], dash=(3, 3), tags="hover")
        bar = bars[index] if index < len(bars) else None
        timestamp = getattr(bar, "timestamp", None)
        date_label = timestamp.strftime("%b %d %Y") if hasattr(timestamp, "strftime") else "Date unavailable"
        volume = getattr(bar, "volume", None)
        volume_label = f"{volume:,.0f}" if isinstance(volume, (int, float)) else "—"
        detail = (
            f"{date_label}  O {candle['open_value']:.2f}  H {candle['high_value']:.2f}  "
            f"L {candle['low_value']:.2f}  C {candle['close_value']:.2f}  V {volume_label}  Cursor {cursor_price:.2f}"
        )
        text_width = min(680, max(220, len(detail) * 5.5), max(80, right - left))
        box_x = min(max(left, event.x + 10), max(left, right - text_width))
        box_y = top + 4 if event.y > top + 35 else top + 26
        self.market_chart.create_rectangle(box_x, box_y, box_x + text_width, box_y + 20,
                                           fill=self.colors["panel"], outline=self.colors["line"], tags="hover")
        self.market_chart.create_text(box_x + 7, box_y + 10, text=detail, fill=self.colors["text"],
                                      font=("Monospace", 8), anchor="w", tags="hover")

    def _chart_window_selected(self) -> None:
        self._save_runtime_settings()
        self._draw_market_chart()

    def _record_research_scan(self, outcome: MarketRefreshOutcome | None, *, refresh_error: Exception | None = None) -> None:
        config = self.config or self._load_config_safe()
        source = "failed" if refresh_error else (outcome.state if outcome else "manual")
        provider = str(getattr(config, "market_data_provider", "unknown") or "unknown")
        if source == "csv":
            provider = "CSV"
        try:
            requested = load_watchlist(self._runtime_path(config.watchlist_path or self.watchlist_path), config.symbol_whitelist)
        except (OSError, ValueError):
            requested = sorted(self.bars_by_symbol)
        if source in {"csv", "cached"}:
            requested = sorted(set(requested) | set(self.bars_by_symbol))
        returned_symbols = set() if refresh_error else set(
            outcome.returned_symbols if outcome and outcome.state in {"updated", "empty"} else self.bars_by_symbol)
        issues = {
            symbol: "No candle bars returned in this scan; older local candles may still be available. Confirm provider coverage or symbol format."
            for symbol in requested if symbol not in returned_symbols
        }
        if refresh_error:
            safe_category = type(refresh_error).__name__
            issues = {symbol: f"Refresh failed ({safe_category}); older local candles may still be available. Review provider configuration and retry."
                      for symbol in requested}
        if outcome:
            for issue in outcome.issues:
                symbol = str(issue.get("symbol", "")).upper()
                if symbol in issues:
                    code = f" HTTP {issue['status_code']}" if issue.get("status_code") else ""
                    issues[symbol] = f"{issue.get('provider', provider)} · {issue.get('category', 'provider')}:{code} {issue.get('detail', '')}".strip()
        record = self.scan_coverage.record(
            requested, returned_symbols, provider=provider, source=source, issues=issues)
        self._latest_research_coverage = record
        if hasattr(self, "research_status_label"):
            self.research_status_label.configure(
                text=(f"Latest local scan: {record['returned']}/{record['requested']} symbols covered "
                      f"({record['coverage_pct']:.1f}%) · {provider.upper()} · {source}. "
                      "Provider comparison uses saved evidence only; no extra market-data request is made.")
            )
        self._render_scan_coverage()

    def _render_scan_coverage(self) -> None:
        tree = getattr(self, "research_coverage_tree", None)
        if tree is None:
            return
        for item in tree.get_children():
            tree.delete(item)
        self._research_coverage_by_id = {}
        history = self.scan_coverage.history()
        for row in reversed(history):
            run_id = str(row.get("id", ""))
            self._research_coverage_by_id[run_id] = row
            when = str(row.get("at", "")).replace("T", " ")[:19]
            tree.insert("", "end", iid=run_id, values=(when, row.get("provider", "unknown"), row.get("source", "unknown"),
                                                         f"{row.get('coverage_pct', 0)}%", row.get("returned", 0), row.get("requested", 0)))

    def _research_window(self, title: str, geometry: str = "860x560") -> tk.Toplevel:
        dialog = tk.Toplevel(self.root)
        dialog.title(title)
        dialog.geometry(geometry)
        dialog.minsize(620, 380)
        dialog.transient(self.root)
        dialog.configure(bg=self.colors["panel"])
        dialog.columnconfigure(0, weight=1)
        dialog.rowconfigure(1, weight=1)
        return dialog

    def _open_scan_coverage(self) -> None:
        self._show_tab("Research")
        selection = self.research_coverage_tree.selection()
        if not selection:
            items = self.research_coverage_tree.get_children()
            if items:
                selection = (items[0],)
        if selection:
            self.research_coverage_tree.selection_set(selection[0])
            self._open_selected_coverage_detail()
        else:
            messagebox.showinfo("Scan coverage", "Refresh market data to create the first coverage-history record.", parent=self.root)

    def _open_selected_coverage_detail(self) -> None:
        selection = self.research_coverage_tree.selection()
        row = self._research_coverage_by_id.get(selection[0]) if selection else None
        if not row:
            return
        dialog = self._research_window("Scan coverage by symbol", "760x600")
        tk.Label(dialog, text=f"{row.get('provider', 'Unknown')} · {row.get('at', '')} · {row.get('coverage_pct', 0)}% covered",
                 bg=self.colors["panel"], fg=self.colors["teal"], font=("Sans", 10, "bold"), anchor="w").grid(
                     row=0, column=0, sticky="ew", padx=14, pady=12)
        tree = ttk.Treeview(dialog, columns=("symbol", "state", "issue"), show="headings", height=18)
        for key, title, width in (("symbol", "Symbol", 100), ("state", "Coverage", 110), ("issue", "Coverage note", 460)):
            tree.heading(key, text=title)
            tree.column(key, width=width, anchor="w", stretch=key == "issue")
        tree.grid(row=1, column=0, sticky="nsew", padx=14, pady=(0, 12))
        tree.bind("<Double-1>", lambda _event: self._research_symbol_from_issue(tree))
        for item in row.get("symbols", []):
            tree.insert("", "end", values=(item.get("symbol", ""), "Covered" if item.get("covered") else "Missing",
                                           item.get("issue", "")))

    def _open_provider_comparison(self) -> None:
        rows = provider_evidence(self.scan_coverage.history())
        dialog = self._research_window("Provider evidence comparison", "760x440")
        tk.Label(dialog, text="SAVED LOCAL EVIDENCE ONLY · THIS VIEW DOES NOT REQUEST PROVIDER DATA",
                 bg=self.colors["panel"], fg=self.colors["teal"], font=("Sans", 9, "bold"), anchor="w").grid(
                     row=0, column=0, sticky="ew", padx=14, pady=12)
        tree = ttk.Treeview(dialog, columns=("provider", "at", "coverage", "returned", "requested", "source"), show="headings", height=12)
        for key, title, width in (("provider", "Provider", 120), ("at", "Latest evidence", 180), ("coverage", "Coverage", 90),
                                  ("returned", "Returned", 90), ("requested", "Requested", 90), ("source", "Source", 100)):
            tree.heading(key, text=title)
            tree.column(key, width=width, anchor="w" if key in {"provider", "at", "source"} else "e")
        tree.grid(row=1, column=0, sticky="nsew", padx=14, pady=(0, 12))
        for row in rows:
            tree.insert("", "end", values=(row.get("provider"), str(row.get("at", ""))[:19], f"{row.get('coverage_pct', 0)}%",
                                           row.get("returned", 0), row.get("requested", 0), row.get("source", "")))
        tk.Label(dialog, text="Only providers recorded during normal scans appear. Historical coverage may use different symbols or dates, so it is not a controlled price-quality benchmark.",
                 bg=self.colors["panel"], fg=self.colors["muted"], wraplength=710, justify="left", anchor="w").grid(
                     row=2, column=0, sticky="ew", padx=14, pady=(0, 12))

    def _open_session_planner(self) -> None:
        rows = market_session_calendar(days=35)
        dialog = self._research_window("Market session planner", "680x600")
        tk.Label(dialog, text="US EQUITIES · EASTERN TIME · PLANNING AID",
                 bg=self.colors["panel"], fg=self.colors["teal"], font=("Sans", 9, "bold"), anchor="w").grid(
                     row=0, column=0, sticky="ew", padx=14, pady=12)
        tree = ttk.Treeview(dialog, columns=("date", "state", "hours", "confidence"), show="headings", height=20)
        for key, title, width in (("date", "Date", 120), ("state", "Session", 180), ("hours", "Hours", 180), ("confidence", "Calendar", 160)):
            tree.heading(key, text=title)
            tree.column(key, width=width, anchor="w")
        tree.grid(row=1, column=0, sticky="nsew", padx=14, pady=(0, 12))
        for row in rows:
            tree.insert("", "end", values=tuple(row[key] for key in ("date", "state", "hours", "confidence")))
        tk.Label(dialog, text="Holiday dates are maintained only for 2026. Future-year weekdays are marked for verification; this planner never changes automation or order permissions.",
                 bg=self.colors["panel"], fg=self.colors["muted"], wraplength=620, justify="left", anchor="w").grid(
                     row=2, column=0, sticky="ew", padx=14, pady=(0, 12))

    def _open_chart_board(self) -> None:
        selected = getattr(self, "selected_chart_symbol", "")
        raw = simpledialog.askstring("Multi-chart board", "Enter 2–6 symbols, separated by commas. Uses current local candles only:",
                                     initialvalue=", ".join(([selected] if selected else []) + ["SPY"]), parent=self.root)
        if not raw:
            return
        symbols = list(dict.fromkeys(token.strip().upper() for token in raw.split(",") if token.strip()))[:6]
        if len(symbols) < 2:
            messagebox.showinfo("Multi-chart board", "Choose at least two symbols.", parent=self.root)
            return
        dialog = self._research_window("Multi-symbol chart board", "940x700")
        dialog.columnconfigure((0, 1), weight=1)
        dialog.rowconfigure(1, weight=1)
        tk.Label(dialog, text="NORMALIZED CLOSE · COMMON 20-BAR WINDOW · LOCAL CANDLES",
                 bg=self.colors["panel"], fg=self.colors["teal"], font=("Sans", 9, "bold"), anchor="w").grid(
                     row=0, column=0, columnspan=2, sticky="ew", padx=14, pady=12)
        for index, symbol in enumerate(symbols):
            canvas = tk.Canvas(dialog, height=230, bg=self.colors["panel_2"], highlightthickness=1,
                               highlightbackground=self.colors["line"])
            canvas.grid(row=1 + index // 2, column=index % 2, sticky="nsew", padx=10, pady=10)
            bars = self.bars_by_symbol.get(symbol, [])[-20:]
            canvas.create_text(12, 12, text=f"{symbol} · {len(bars)} bars", fill=self.colors["text"], anchor="nw", font=("Sans", 10, "bold"))
            if len(bars) < 2:
                canvas.create_text(12, 42, text="Not enough local candles", fill=self.colors["muted"], anchor="nw")
                continue
            base = float(bars[0].close)
            vals = [float(bar.close) / base * 100 - 100 for bar in bars]
            low, high = min(vals), max(vals)
            span = max(high - low, 0.01)
            width, height = 420, 155
            points = []
            for i, value in enumerate(vals):
                x = 16 + i * (width - 32) / max(1, len(vals) - 1)
                y = 194 - (value - low) / span * (height - 20)
                points.extend((x, y))
            canvas.create_line(*points, fill=self.colors["teal"], width=2, smooth=True)
            canvas.create_text(12, 32, text=f"20-bar return: {vals[-1]:+.2f}%", fill=self.colors["muted"], anchor="nw")
        tk.Label(dialog, text="Comparison is descriptive and not a trading recommendation. Missing local history stays visible as a gap.",
                 bg=self.colors["panel"], fg=self.colors["muted"], anchor="w").grid(row=4, column=0, columnspan=2, sticky="ew", padx=14, pady=8)

    def _open_group_comparison(self) -> None:
        groups = {group.name: group.symbols for group in self.watchlist_organization.groups}
        groups["Active watchlist"] = tuple(load_watchlist(self._runtime_path(self.watchlist_path), getattr(self.config, "symbol_whitelist", None)))
        if self.watchlist_organization.pinned_symbols:
            groups["Pinned symbols"] = self.watchlist_organization.pinned_symbols
        rows = compare_symbol_groups(groups, self.bars_by_symbol)
        dialog = self._research_window("Research group comparison", "720x480")
        tk.Label(dialog, text="GROUP PERFORMANCE · LOCAL DAILY CANDLES · NO EXTRA PROVIDER CALLS",
                 bg=self.colors["panel"], fg=self.colors["teal"], font=("Sans", 9, "bold"), anchor="w").grid(
                     row=0, column=0, sticky="ew", padx=14, pady=12)
        tree = ttk.Treeview(dialog, columns=("group", "symbols", "covered", "return"), show="headings", height=14)
        for key, title, width in (("group", "Group / List", 220), ("symbols", "Symbols", 100), ("covered", "With data", 100), ("return", "Mean 20-bar return", 170)):
            tree.heading(key, text=title)
            tree.column(key, width=width, anchor="w" if key == "group" else "e")
        tree.grid(row=1, column=0, sticky="nsew", padx=14, pady=(0, 12))
        for row in rows:
            ret = "—" if row["mean_return_pct"] is None else f"{row['mean_return_pct']:+.2f}%"
            tree.insert("", "end", values=(row["name"], row["symbols"], row["covered"], ret))
        tk.Label(dialog, text="Groups are organizational only and do not change the scan universe or trading scope.",
                 bg=self.colors["panel"], fg=self.colors["muted"], anchor="w").grid(row=2, column=0, sticky="ew", padx=14, pady=(0, 12))

    def _open_data_issue_inbox(self) -> None:
        history = self.scan_coverage.history()
        latest = history[-1] if history else None
        dialog = self._research_window("Symbol data issue inbox", "820x560")
        tk.Label(dialog, text="LOCAL COVERAGE AND CANDLE QUALITY · ACTIONS ARE READ-ONLY",
                 bg=self.colors["panel"], fg=self.colors["teal"], font=("Sans", 9, "bold"), anchor="w").grid(
                     row=0, column=0, sticky="ew", padx=14, pady=12)
        tree = ttk.Treeview(dialog, columns=("symbol", "state", "detail", "action"), show="headings", height=18)
        for key, title, width in (("symbol", "Symbol", 90), ("state", "Issue", 120), ("detail", "Evidence", 360), ("action", "Suggested next step", 210)):
            tree.heading(key, text=title)
            tree.column(key, width=width, anchor="w", stretch=key in {"detail", "action"})
        tree.grid(row=1, column=0, sticky="nsew", padx=14, pady=(0, 12))
        issues = []
        if latest:
            issues.extend({"symbol": item.get("symbol"), "state": "No candle data", "detail": item.get("issue", "Coverage missing"),
                           "action": "Confirm symbol / provider coverage"} for item in latest.get("symbols", []) if not item.get("covered"))
        for symbol, bars in self.bars_by_symbol.items():
            quality = summarize_candle_quality(bars, interval_minutes=1440).symbols
            if quality and quality[0].label not in {"CURRENT"}:
                q = quality[0]
                issues.append({"symbol": symbol, "state": q.label, "detail": "; ".join(q.details),
                               "action": "Review timestamps and source; refresh if stale"})
        for item in issues:
            tree.insert("", "end", values=(item.get("symbol"), item.get("state"), item.get("detail"), item.get("action")))
        if not issues:
            tree.insert("", "end", values=("—", "No open issues", "No missing coverage or candle-quality warnings in the latest local evidence.", "Refresh after the next session"))
        tree.bind("<Double-1>", lambda _event: self._research_symbol_from_issue(tree))
        tk.Label(dialog, text="Provider failures are inferred from missing symbols unless the provider supplied a safe structured error; raw provider responses are not stored here.",
                 bg=self.colors["panel"], fg=self.colors["muted"], wraplength=760, justify="left", anchor="w").grid(
                     row=2, column=0, sticky="ew", padx=14, pady=(0, 12))

    def _research_symbol_from_issue(self, tree) -> None:
        selection = tree.selection()
        if not selection:
            return
        values = tree.item(selection[0], "values")
        if not values or not values[0] or values[0] == "—":
            return
        self._open_symbol_research_drawer_for(str(values[0]))

    def _open_csv_import(self) -> None:
        path = filedialog.askopenfilename(parent=self.root, title="Choose market-data CSV", filetypes=(("CSV files", "*.csv"), ("All files", "*")))
        if not path:
            return
        try:
            with open(path, newline="", encoding="utf-8-sig") as stream:
                headers = next(csv.reader(stream), [])
        except (OSError, UnicodeError, csv.Error) as exc:
            messagebox.showerror("CSV import", f"Could not read the CSV header: {exc}", parent=self.root)
            return
        headers = [str(header).strip() for header in headers if str(header).strip()]
        if not headers:
            messagebox.showerror("CSV import", "The selected file has no usable header row.", parent=self.root)
            return
        dialog = self._research_window("Preview and map market-data CSV", "860x640")
        tk.Label(dialog, text=f"SOURCE · {Path(path).name} · MAP FIELDS, PREVIEW VALIDATION, THEN CONFIRM MERGE",
                 bg=self.colors["panel"], fg=self.colors["teal"], font=("Sans", 9, "bold"), anchor="w").grid(
                     row=0, column=0, sticky="ew", padx=14, pady=12)
        mapping_box = tk.Frame(dialog, bg=self.colors["panel"])
        mapping_box.grid(row=1, column=0, sticky="ew", padx=14)
        mapping_vars = {}
        aliases = {"symbol": ("symbol", "ticker", "stock"), "timestamp": ("timestamp", "datetime", "date", "time"),
                   "open": ("open", "o"), "high": ("high", "h"), "low": ("low", "l"),
                   "close": ("close", "c", "adj close"), "volume": ("volume", "vol", "v")}
        for index, field in enumerate(("symbol", "timestamp", "open", "high", "low", "close", "volume")):
            tk.Label(mapping_box, text=field.title(), bg=self.colors["panel"], fg=self.colors["muted"], anchor="w").grid(
                row=index // 4 * 2, column=index % 4, sticky="w", padx=4, pady=(6, 0))
            var = tk.StringVar()
            mapping_vars[field] = var
            default = next((header for header in headers if header.strip().lower() in aliases[field]), "")
            var.set(default)
            ttk.Combobox(mapping_box, textvariable=var, values=headers, state="readonly", width=18).grid(
                row=index // 4 * 2 + 1, column=index % 4, sticky="ew", padx=4, pady=(0, 6))
        for col in range(4):
            mapping_box.columnconfigure(col, weight=1)
        preview = tk.Text(dialog, height=20, bg=self.colors["panel_2"], fg=self.colors["text"], wrap="word", relief="flat")
        preview.grid(row=2, column=0, sticky="nsew", padx=14, pady=10)
        state = {"result": None}
        actions = tk.Frame(dialog, bg=self.colors["panel"])
        actions.grid(row=3, column=0, sticky="ew", padx=14, pady=(0, 12))
        confirm = self._button(actions, "Confirm atomic merge", lambda: None, accent="teal")
        confirm.pack(side="right")
        confirm.configure(state="disabled")

        def run_preview() -> None:
            mapping = {field: var.get() for field, var in mapping_vars.items()}
            try:
                result = preview_csv_import(path, mapping)
            except (OSError, ValueError, UnicodeError) as exc:
                messagebox.showerror("CSV preview", str(exc), parent=dialog)
                return
            state["result"] = result
            preview.delete("1.0", "end")
            preview.insert("end", f"Rows parsed: {result.total_rows:,} · Valid rows: {len(result.candles):,} · Status: {'READY' if result.ready else 'BLOCKED'}\n")
            if result.errors:
                preview.insert("end", "\nValidation issues (showing up to 100):\n" + "\n".join(result.errors))
            else:
                preview.insert("end", "\nPreview rows:\n")
                for bar in result.candles[:15]:
                    preview.insert("end", f"{bar.symbol} · {bar.timestamp.isoformat()} · O {bar.open:g} H {bar.high:g} L {bar.low:g} C {bar.close:g} · V {bar.volume:g}\n")
                preview.insert("end", "\nExisting data will be merged by symbol and timestamp; the imported row wins on duplicate timestamps. The original remains untouched until confirmation.")
            confirm.configure(state="normal" if result.ready else "disabled")

        def commit_import() -> None:
            result = state.get("result")
            if not result or not result.ready:
                return
            if not messagebox.askyesno("Confirm CSV merge", f"Merge {len(result.candles):,} validated rows into the local market-data file? This will not contact a provider or place orders.", parent=dialog):
                return
            try:
                existing = load_csv_bars(self.data_file) if self.data_file.exists() else {}
                merged = merge_imported_candles(existing, result.candles)
                write_csv_bars(self.data_file, merged)
                self._clear_sample_data_marker()
                self._refresh_payload(skip_market_refresh=True)
                self._record_research_scan(MarketRefreshOutcome("csv", returned_symbols=tuple(merged)))
                self.status_bar.configure(text=f"Imported {len(result.candles):,} validated CSV rows; market data updated atomically.")
                dialog.destroy()
            except (OSError, ValueError) as exc:
                messagebox.showerror("CSV import not committed", f"The existing data was preserved: {exc}", parent=dialog)

        confirm.configure(command=commit_import)
        self._button(actions, "Preview mapping", run_preview).pack(side="right", padx=(0, 8))
        self._button(actions, "Cancel", dialog.destroy).pack(side="left")

    def _export_research_snapshot(self) -> None:
        target = filedialog.asksaveasfilename(parent=self.root, title="Export redacted research snapshot",
                                              defaultextension=".json", filetypes=(("JSON snapshot", "*.json"),))
        if not target:
            return
        signals = []
        for signal in self.signals:
            symbol = str(getattr(signal, "symbol", "")).upper()
            bars = self.bars_by_symbol.get(symbol, [])
            change = None
            if len(bars) > 1 and bars[-2].close:
                change = (bars[-1].close / bars[-2].close - 1) * 100
            signals.append({"symbol": symbol, "close": float(bars[-1].close) if bars else None,
                            "change_pct": change, "score": getattr(signal, "score", None),
                            "decision": getattr(signal, "decision", "")})
        history = self.scan_coverage.history()
        issues = []
        if history:
            issues = [{"symbol": row.get("symbol"), "provider": history[-1].get("provider"),
                       "category": "coverage", "detail": row.get("issue"),
                       "action": "Confirm symbol / provider coverage"}
                      for row in history[-1].get("symbols", []) if not row.get("covered")]
        snapshot = redacted_research_snapshot(
            provider=str(getattr(self.config, "market_data_provider", "unknown")),
            as_of=datetime.now().astimezone(), symbols=signals, issues=issues)
        try:
            _write_private_json(Path(target), snapshot)
            messagebox.showinfo("Snapshot exported", "Redacted research data saved. Account, broker, order, credential, and private profile fields are excluded.", parent=self.root)
        except (OSError, ValueError) as exc:
            messagebox.showerror("Snapshot export", str(exc), parent=self.root)

    def _save_scanner_table_preset(self) -> None:
        name = simpledialog.askstring("Save scanner table layout", "Name this table and column layout:", parent=self.root)
        if name is None:
            return
        sort_column = self._scanner_sort_column if self._scanner_sort_column in self.scanner_visible_columns else next(iter(self.scanner_visible_columns), "symbol")
        try:
            view = make_scanner_view(name, self.scanner_column_order, self.scanner_visible_columns, sort_column,
                                     self._scanner_sort_reverse, allowed_columns=self.scanner_column_order)
            self.scanner_table_presets.save(name, scanner_view_to_dict(view))
        except (OSError, ValueError) as exc:
            messagebox.showerror("Table layout not saved", str(exc), parent=self.root)
            return
        self.status_bar.configure(text=f"Scanner table layout '{name.strip()}' saved; columns, visibility, and sorting will round-trip.")

    def _open_scanner_table_preset(self) -> None:
        presets = self.scanner_table_presets.presets
        if not presets:
            messagebox.showinfo("Scanner table layouts", "No named table layouts are saved yet.", parent=self.root)
            return
        dialog = self._research_window("Load scanner table layout", "520x420")
        tk.Label(dialog, text="NAMED PRESENTATION PRESETS · DOES NOT CHANGE SCANNER FILTERS OR TRADING SETTINGS",
                 bg=self.colors["panel"], fg=self.colors["teal"], font=("Sans", 9, "bold"), anchor="w", wraplength=470).grid(
                     row=0, column=0, sticky="ew", padx=14, pady=12)
        listbox = tk.Listbox(dialog, bg=self.colors["panel_2"], fg=self.colors["text"], selectbackground=self.colors["selected"], relief="flat")
        listbox.grid(row=1, column=0, sticky="nsew", padx=14, pady=(0, 10))
        for preset in presets:
            listbox.insert("end", preset["name"])
        actions = tk.Frame(dialog, bg=self.colors["panel"])
        actions.grid(row=2, column=0, sticky="e", padx=14, pady=(0, 12))

        def load_selected() -> None:
            selected = listbox.curselection()
            if not selected:
                return
            preset = presets[int(selected[0])]
            try:
                view = scanner_view_from_dict(preset, allowed_columns=self.scanner_column_order)
                self._apply_scanner_view(view)
                self.status_bar.configure(text=f"Scanner table layout '{preset['name']}' loaded.")
                dialog.destroy()
            except (KeyError, TypeError, ValueError) as exc:
                messagebox.showerror("Layout unavailable", str(exc), parent=dialog)

        self._button(actions, "Cancel", dialog.destroy).pack(side="right", padx=(8, 0))
        self._button(actions, "Load", load_selected, accent="teal").pack(side="right")
        self._button(actions, "Delete", lambda: self._delete_scanner_table_preset(listbox, presets)).pack(side="left")

    def _delete_scanner_table_preset(self, listbox, presets) -> None:
        selected = listbox.curselection()
        if not selected:
            return
        preset = presets[int(selected[0])]
        if messagebox.askyesno("Delete layout", f"Remove '{preset['name']}'?", parent=listbox.winfo_toplevel()):
            self.scanner_table_presets.delete(preset["name"])
            listbox.delete(selected[0])

    def _open_symbol_research_drawer(self) -> None:
        symbol = str(getattr(self, "selected_chart_symbol", "") or "").strip().upper()
        if not symbol:
            symbol = simpledialog.askstring("Symbol research", "Enter a symbol from your local data:", parent=self.root) or ""
            symbol = symbol.strip().upper()
        if not symbol:
            return
        self._open_symbol_research_drawer_for(symbol)

    def _open_symbol_research_drawer_for(self, symbol: str) -> None:
        bars = self.bars_by_symbol.get(symbol, [])
        signal = self.signal_by_symbol.get(symbol)
        note = self.symbol_notes.get(symbol)
        quality = summarize_candle_quality(bars, interval_minutes=1440).symbols[0] if bars else None
        dialog = self._research_window(f"{symbol} · unified research", "900x680")
        dialog.columnconfigure((0, 1), weight=1)
        tk.Label(dialog, text=f"{symbol} · CHART / DATA QUALITY / SCAN CONTEXT / NOTE",
                 bg=self.colors["panel"], fg=self.colors["teal"], font=("Sans", 10, "bold"), anchor="w").grid(
                     row=0, column=0, columnspan=2, sticky="ew", padx=14, pady=12)
        canvas = tk.Canvas(dialog, height=240, bg=self.colors["panel_2"], highlightthickness=1, highlightbackground=self.colors["line"])
        canvas.grid(row=1, column=0, columnspan=2, sticky="ew", padx=14, pady=(0, 10))
        closes = [float(bar.close) for bar in bars[-60:]]
        if len(closes) >= 2:
            low, high = min(closes), max(closes)
            span = max(high - low, 0.0001)
            points = []
            for index, value in enumerate(closes):
                points.extend((20 + index * 820 / (len(closes) - 1), 210 - (value - low) / span * 180))
            canvas.create_line(*points, fill=self.colors["teal"], width=2, smooth=True)
            canvas.create_text(16, 12, text=f"{len(closes)} local candles · {closes[-1]:,.2f} latest", fill=self.colors["text"], anchor="nw")
        else:
            canvas.create_text(16, 20, text="Not enough local candles to chart this symbol.", fill=self.colors["muted"], anchor="nw")
        scan_text = (f"Scan action: {getattr(signal, 'sensible_action', 'No current scan result')}\n"
                     f"Decision: {getattr(signal, 'decision', 'Unknown')}\n"
                     f"Scout score: {getattr(signal, 'scout_score', '—')} · Model score: {getattr(signal, 'score', '—')}\n"
                     f"Last close: {closes[-1]:,.2f}" if closes else "No local scan/candle context is available.")
        if quality:
            scan_text += f"\nData quality: {quality.label} · {quality.candle_count} bars · {quality.age_minutes:.0f} minutes old" if quality.age_minutes is not None else f"\nData quality: {quality.label}"
            scan_text += "\n" + "; ".join(quality.details)
        context = tk.Label(dialog, text=scan_text, bg=self.colors["panel_2"], fg=self.colors["text"], justify="left", anchor="nw", padx=12, pady=10)
        context.grid(row=2, column=0, sticky="nsew", padx=(14, 7), pady=(0, 10))
        note_box = tk.Frame(dialog, bg=self.colors["panel_2"])
        note_box.grid(row=2, column=1, sticky="nsew", padx=(7, 14), pady=(0, 10))
        tk.Label(note_box, text="PRIVATE LOCAL SYMBOL NOTE", bg=self.colors["panel_2"], fg=self.colors["muted"], anchor="w").pack(fill="x", padx=10, pady=(10, 4))
        note_text = tk.Text(note_box, height=8, bg=self.colors["entry"], fg=self.colors["text"], wrap="word", relief="flat")
        note_text.pack(fill="both", expand=True, padx=10, pady=(0, 8))
        if note:
            note_text.insert("1.0", note.text)
        def save_note() -> None:
            body = note_text.get("1.0", "end").strip()
            if not body:
                messagebox.showinfo("Symbol note", "Add a note or use the existing note editor to remove one.", parent=dialog)
                return
            try:
                self.symbol_notes.save(symbol, body)
                messagebox.showinfo("Symbol note", f"Local note saved for {symbol}.", parent=dialog)
            except (OSError, ValueError) as exc:
                messagebox.showerror("Symbol note", str(exc), parent=dialog)
        self._button(note_box, "Save note", save_note, accent="teal").pack(anchor="e", padx=10, pady=(0, 10))
        self._button(dialog, "Open in Market desk", lambda: (self._show_tab("Overview"), self._display_selected_signal(symbol), dialog.destroy())).grid(
            row=3, column=0, sticky="w", padx=14, pady=(0, 12))


    def _open_symbol_comparison(self) -> None:
        selected = getattr(self, "selected_chart_symbol", "")
        raw = simpledialog.askstring(
            "Compare symbols", "Enter up to six tickers separated by commas (same local candle dates):",
            initialvalue=", ".join(([selected] if selected else []) + ["SPY"]), parent=self.root,
        )
        if not raw:
            return
        symbols = list(dict.fromkeys(token.strip().upper() for token in raw.split(",") if token.strip()))[:6]
        if len(symbols) < 2:
            messagebox.showinfo("Compare symbols", "Choose at least two tickers.", parent=self.root)
            return
        rows = compare_symbols(self.bars_by_symbol, symbols, window=20)
        dialog = tk.Toplevel(self.root)
        dialog.title("Local symbol comparison")
        dialog.transient(self.root)
        dialog.configure(bg=self.colors["panel"])
        dialog.columnconfigure(0, weight=1)
        dialog.rowconfigure(1, weight=1)
        tk.Label(dialog, text="RELATIVE PERFORMANCE · SHARED LOCAL CANDLES", bg=self.colors["panel"],
                 fg=self.colors["teal"], font=("Sans", 9, "bold"), anchor="w").grid(
                     row=0, column=0, sticky="ew", padx=14, pady=(14, 8))
        columns = ("symbol", "return", "relative", "volatility", "range", "bars", "status")
        table = ttk.Treeview(dialog, columns=columns, show="headings", height=max(3, len(rows)))
        headings = (("symbol", "Ticker"), ("return", "Return"), ("relative", "vs first"),
                    ("volatility", "Volatility"), ("range", "Range"), ("bars", "Bars"), ("status", "Data"))
        for key, label in headings:
            table.heading(key, text=label)
            table.column(key, width=105 if key == "symbol" else 92, anchor="w" if key in {"symbol", "status"} else "e")
        table.grid(row=1, column=0, sticky="nsew", padx=14)

        def percent(value: float | None) -> str:
            return f"{value:+.2f}%" if value is not None else "—"

        for row in rows:
            table.insert("", "end", values=(row.symbol, percent(row.return_pct), percent(row.relative_return_pct_points),
                                                percent(row.volatility_pct), percent(row.range_pct), row.bars_used,
                                                "Ready" if row.status == "complete" else "Need data"))
        note = "Return, volatility, and range use only the last 20 shared candle timestamps. Relative return is measured against the first ticker."
        tk.Label(dialog, text=note, bg=self.colors["panel"], fg=self.colors["muted"],
                 font=("Sans", 8), anchor="w", wraplength=650, justify="left").grid(
                     row=2, column=0, sticky="ew", padx=14, pady=8)
        self._button(dialog, "Close", dialog.destroy).grid(row=3, column=0, sticky="e", padx=14, pady=(0, 14))

    def _decision_summary(self) -> str:
        config = self.config or self._load_config_safe()
        limit = self._plan_limit(config)
        prefix = []
        if self.config_error:
            prefix = ["Safe config fallback active.", self.config_error, ""]
        asset_lines = self._asset_visibility_lines(config)
        if not self.plans:
            return "\n".join(prefix + asset_lines + [""]) + (
                f"No executable plans at min score {self._min_score(config)}.\n"
                f"{self._data_freshness_line()}\n"
                "Timmy will keep scouting stocks, index proxies, and ETFs until movement, acceleration, volume, range expansion, and trend confirmation are strong enough."
            )
        top = self.plans[:limit]
        lines = [
            f"Decision mode: {config.trader_mode}",
            f"Execution: {self.execution_mode_var.get()}",
            f"Target: {self.execution_target_var.get()}",
            f"Guard: {'live enabled' if self._live_ready(config) else 'live orders locked'}",
            f"Style: {config.trading_style} | Patterns: {', '.join(sorted(config.enabled_trade_patterns)) or 'none'}",
            f"Min score: {self._min_score(config)} | Plan limit: {limit}",
            self._data_freshness_line(),
            *asset_lines,
            self._readiness_line(config),
            "Vigilance score: movement, acceleration, volume, range expansion, proximity to highs/lows, and noise filters decide alert/watch/quiet.",
            "Sensible score: trend, reward/risk, expense, cash fit, volatility, and recent event history decide trade/watch/avoid.",
            "Operational gate: session timing, cooldown, daily caps, rejection history, volatility, cash fit, and reward/risk must clear.",
            "Adaptive: +/-2.5% move detection, entry, stop, target, and watch ranking respond to volatility and volume.",
            "Expense gate: Timmy blocks buys that are overextended versus RSI/averages or too large for available cash.",
            "",
            "Scout result: changing symbols are ranked first; eligible symbols become buy-low/sell-high limit plans.",
            "",
            "Ranked action list:",
        ]
        for idx, plan in enumerate(top, start=1):
            lines.append(
                f"{idx}. {plan.side} {_format_quantity(plan.quantity)} {plan.symbol} {plan.instrument_type} {plan.order_type} "
                f"at {money(plan.limit_price)} | risk stop {money(plan.stop_price)} | target {money(plan.target_price)}"
            )
        lines.append("")
        lines.append("Next controlled step: Preview or Submit Live. Live placement still depends on environment live switches.")
        return "\n".join(prefix + lines)

    def _asset_visibility_lines(self, config: BotConfig) -> list[str]:
        enabled = ", ".join(enabled_asset_classes(config))
        non_equity = []
        warnings = []

        class_specs = (
            ("Crypto", config.crypto_symbols, config.enable_crypto_trading, "disabled"),
            ("Futures", config.futures_symbols, config.enable_futures_trading, "disabled"),
            ("Options", config.options_symbols, config.enable_options_trading, "needs legs" if not config.option_legs else "disabled"),
            ("Events", config.event_contract_symbols, False, "scouting-only"),
        )
        for label, symbols, is_enabled, disabled_label in class_specs:
            if not symbols:
                continue
            status = "on" if is_enabled else disabled_label
            non_equity.append(f"{label} {self._compact_symbols(symbols)} ({status})")
            if not is_enabled:
                warnings.append(f"{label} {disabled_label}")
        if config.enable_options_trading and config.options_symbols and not config.option_legs:
            warnings.append("Options need WEBULL_OPTION_LEGS_JSON")
        if config.enable_event_contract_trading:
            warnings.append("Event execution blocked")

        lines = [f"Assets enabled: {enabled}"]
        lines.append(f"Non-equity symbols: {'; '.join(non_equity) if non_equity else 'none configured'}")
        if warnings:
            lines.append(f"Asset warnings: {'; '.join(warnings)}")
        return lines

    @staticmethod
    def _compact_symbols(symbols: set[str], limit: int = 4) -> str:
        ordered = sorted(symbols)
        if len(ordered) <= limit:
            return ", ".join(ordered)
        return f"{', '.join(ordered[:limit])}, +{len(ordered) - limit} more"

    def _readiness_line(self, config: BotConfig) -> str:
        flags = readiness_flags(config, plans_count=len(self.plans), events_count=len(self.execution_events))
        return f"Readiness: {len(flags['green_flags'])} green | {len(flags['red_flags'])} red"

    def _data_freshness_line(self) -> str:
        if self._market_data_load_error:
            detail = self._market_data_load_error.rsplit(": ", 1)[-1]
            return f"Data: unreadable CSV · {detail[:72]} · original preserved"
        if self._sample_data_in_use:
            return "Data: synthetic sample · not market quotes"
        provider = str(getattr(self.config, "market_data_provider", "csv") or "csv").strip().lower()
        source = {
            "yahoo": "Yahoo feed",
            "stooq": "Stooq feed (Yahoo fallback)",
            "csv": "CSV file",
        }.get(provider, f"{provider.upper()} feed" if provider else "CSV file")
        latest = self._latest_global_candle_timestamp()
        if latest is None:
            return f"MISSING · {source} · no candles loaded"
        age = max(timedelta(0), datetime.now() - latest)
        age_hours = age.total_seconds() / 3600
        label = latest.strftime("%Y-%m-%d %H:%M")
        if self._data_is_stale():
            age_label = f"{age_hours / 24:.1f}d" if age_hours >= 48 else f"{age_hours:.0f}h"
            return f"STALE · {source} · last candle {label} ({age_label} old)"
        return f"FRESH · {source} · last candle {label} ({age_hours:.0f}h old)"

    def _data_is_stale(self) -> bool:
        latest = self._latest_global_candle_timestamp()
        if latest is None:
            return True
        return (datetime.now() - latest) > timedelta(days=4)

    def _latest_global_candle_timestamp(self) -> datetime | None:
        latest: datetime | None = None
        for bars in self.bars_by_symbol.values():
            if not bars:
                continue
            candidate = bars[-1].timestamp
            if latest is None or candidate > latest:
                latest = candidate
        return latest

    def _live_ready(self, config: BotConfig) -> bool:
        return (
            config.trader_mode == "live"
            and config.trader_live
            and config.webull_enable_live_orders
            and bool(config.webull_account_id)
        )

    def _live_confirmation_text(self) -> str:
        config = self._execution_config(self.config or self._load_config_safe())
        plan_lines = []
        for plan in self.plans[: self.plan_limit_value]:
            plan_lines.append(
                f"{plan.side} {_format_quantity(plan.quantity)} {plan.symbol} {plan.instrument_type} {plan.order_type} at {money(plan.limit_price)}"
            )
        guard = "Live switches enabled" if self._live_ready(config) else "Live switches are not fully enabled; submit will be blocked."
        return "\n".join([
            "TARGET: LIVE · Submit the following Webull order plan?",
            "",
            *plan_lines,
            "",
            guard,
        ])

    @staticmethod
    def _order_fingerprint(plan, latest_candle_timestamp: str | None = None) -> str:
        payload = {
            "symbol": plan.symbol,
            "side": plan.side,
            "quantity": plan.quantity,
            "order_type": plan.order_type,
            "limit_price": plan.limit_price,
            "stop_price": plan.stop_price,
            "target_price": plan.target_price,
            "instrument_type": plan.instrument_type,
            "market": plan.market,
            "time_in_force": plan.time_in_force,
            "entrust_type": plan.entrust_type,
            "support_trading_session": plan.support_trading_session,
            "extra_payload": plan.extra_payload,
            "latest_candle_timestamp": latest_candle_timestamp,
        }
        encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()

    def _has_fresh_preview(self, plan, config: BotConfig) -> bool:
        fingerprint = self._order_fingerprint(plan, self._latest_candle_timestamp(plan.symbol))
        preview = self.previewed_order_fingerprints.get(fingerprint)
        if not preview:
            return False
        previewed_at = preview.get("previewed_at")
        if not isinstance(previewed_at, datetime):
            return False
        if (datetime.now() - previewed_at).total_seconds() > LIVE_PREVIEW_TTL_SECONDS:
            return False
        return preview.get("account_id") == config.webull_account_id and bool(preview.get("client_order_id"))

    def _fresh_preview_count(self, config: BotConfig) -> int:
        return sum(1 for plan in self.plans if self._has_fresh_preview(plan, config))

    def _execution_config(self, config: BotConfig) -> BotConfig:
        account_id = self._selected_account_id(config)
        if account_id == config.webull_account_id:
            return config
        if not is_dataclass(config):
            return config
        return replace(config, webull_account_id=account_id)

    def _selected_account_id(self, config: BotConfig) -> str | None:
        selected = self._selected_webull_account_override()
        if selected:
            return selected
        if self._account_lane() == "Crypto" and self._crypto_account_is_separate(config):
            return self._crypto_account_id(config)
        return self._icash_account_id(config)

    def _selected_webull_account_override(self) -> str | None:
        selected_var = getattr(self, "selected_webull_account_id_var", None)
        if selected_var is None:
            return None
        try:
            selected = selected_var.get().strip()
        except tk.TclError:
            return None
        return selected or None

    def _account_lane(self) -> str:
        lane_var = getattr(self, "account_lane_var", None)
        if lane_var is None:
            return "I-Cash"
        try:
            value = lane_var.get()
        except tk.TclError:
            return "I-Cash"
        return value if value in {"I-Cash", "Crypto"} else "I-Cash"

    def _set_account_lane(self, value: str) -> None:
        lane_var = getattr(self, "account_lane_var", None)
        if lane_var is None:
            return
        try:
            lane_var.set(value)
        except tk.TclError:
            pass

    def _icash_account_id(self, config: BotConfig) -> str | None:
        return (
            os.getenv("WEBULL_ICASH_ACCOUNT_ID")
            or os.getenv("WEBULL_CASH_ACCOUNT_ID")
            or config.webull_account_id
        )

    def _crypto_account_id(self, config: BotConfig) -> str | None:
        return (
            os.getenv("WEBULL_CRYPTO_ACCOUNT_ID")
            or os.getenv("WEBULL_PAY_ACCOUNT_ID")
            or os.getenv("WEBULL_DIGITAL_ACCOUNT_ID")
        )

    def _crypto_account_is_separate(self, config: BotConfig) -> bool:
        crypto_id = self._crypto_account_id(config)
        icash_id = self._icash_account_id(config)
        return bool(crypto_id and icash_id and str(crypto_id) != str(icash_id))

    def _min_score(self, config: BotConfig) -> int:
        value = self._bounded_int(self.min_score_var, config.min_score_to_trade, 0, 100)
        self.min_score_value = value
        return value

    def _plan_limit(self, config: BotConfig) -> int:
        self.plan_limit_value = self._bounded_int(
            self.plan_limit_var,
            config.max_positions,
            0,
            max(0, config.max_positions),
        )
        return self.plan_limit_value

    @staticmethod
    def _bounded_int(variable: tk.StringVar, fallback: int, minimum: int, maximum: int) -> int:
        try:
            value = int(variable.get())
        except ValueError:
            value = fallback
        value = max(minimum, min(maximum, value))
        if variable.get() != str(value):
            variable.set(str(value))
        return value

    def _load_config_safe(self) -> BotConfig:
        try:
            config = load_config()
            self.config_error = None
            return config
        except Exception as exc:
            self.config_error = str(exc)
            return BotConfig(
                trader_mode="paper",
                trader_live=False,
                min_score_to_trade=72,
                max_positions=3,
                max_daily_loss_usd=100.0,
                risk_per_trade_usd=25.0,
                automation_max_symbol_exposure_pct=0.0,
                automation_max_total_exposure_pct=0.0,
                automation_max_drawdown_pct=0.0,
                symbol_whitelist={"AAPL", "AMD", "DIA", "IWM", "MSFT", "NVDA", "QQQ", "SPY", "TSLA"},
                max_order_notional_usd=250.0,
                max_order_quantity=10.0,
                enable_equity_fractional_trading=False,
                min_equity_fractional_notional_usd=5.0,
                equity_fractional_quantity_decimals=5,
                max_price_over_sma20_pct=6.0,
                max_price_over_sma50_pct=12.0,
                max_rsi_to_buy=78.0,
                max_entry_cash_pct=20.0,
                min_reward_risk_to_trade=1.6,
                max_signal_volatility_pct=4.5,
                trading_style="adaptive",
                enabled_trade_patterns={"breakout", "momentum", "pullback", "volume"},
                max_daily_trades=5,
                max_symbol_daily_trades=2,
                order_cooldown_minutes=15,
                max_recent_rejections=2,
                require_market_hours=True,
                auto_start_paper_on_market_open=True,
                auto_start_live_on_market_open=False,
                market_open_poll_seconds=30,
                paper_simulation_enabled=False,
                paper_simulation_ignore_market_hours=True,
                paper_simulation_min_scout_score=40,
                market_data_provider="csv",
                market_data_max_age_minutes=15,
                market_data_fetch_timeout_seconds=4,
                market_data_fetch_workers=12,
                watchlist_path=None,
                active_watchlist_path=None,
                movement_watchlist_path=None,
                trade_ready_watchlist_path=None,
                quiet_watchlist_path=None,
                webull_sync_watchlists=False,
                webull_active_watchlist_name="Timmy Active",
                webull_movement_watchlist_name="Timmy Movement",
                webull_trade_ready_watchlist_name="Timmy Trade Ready",
                webull_quiet_watchlist_name="Timmy Quiet Removed",
                watchlist_template="equity",
                enable_watchlist_rotation=False,
                watchlist_universe="custom",
                watchlist_universe_batch_size=100,
                watchlist_universe_refresh_hours=24,
                watchlist_rotation_candidates=set(),
                max_watchlist_symbols=12,
                max_movement_watchlist_symbols=50,
                min_watchlist_scout_score=42,
                quiet_watchlist_scout_score=30,
                enable_crypto_trading=False,
                enable_futures_trading=False,
                enable_options_trading=False,
                enable_event_contract_trading=False,
                crypto_symbols=set(),
                futures_symbols=set(),
                options_symbols=set(),
                event_contract_symbols=set(),
                option_legs={},
                futures_contracts={},
                max_crypto_order_notional_usd=100.0,
                max_futures_contracts=1.0,
                max_options_contracts=1.0,
                webull_app_key=None,
                webull_app_secret=None,
                webull_region="us",
                webull_api_endpoint="api.webull.com",
                webull_account_id=None,
                webull_support_trading_session="CORE",
                webull_token_check_seconds=30,
                webull_token_check_interval_seconds=3,
                webull_enable_live_orders=False,
                webull_require_preview=True,
            )

    def _runtime_config(self, config: BotConfig) -> BotConfig:
        if not is_dataclass(config):
            return config
        return replace(
            config,
            trading_style=self.trading_style_var.get().strip().lower() or config.trading_style,
            enabled_trade_patterns=self._runtime_strategy_patterns(),
        )

    def _runtime_strategy_patterns(self) -> set[str]:
        patterns = {key for key, var in self.pattern_vars.items() if var.get()}
        return patterns or {"breakout", "momentum", "pullback", "volume"}

    def _load_persisted_settings(self) -> None:
        if not self.settings_path.exists():
            return
        try:
            settings = json.loads(self.settings_path.read_text(encoding="utf-8"))
        except (OSError, UnicodeError, json.JSONDecodeError) as exc:
            self._settings_load_error = f"{type(exc).__name__}: {exc}"
            self._settings_save_error = "saved preferences are unreadable; the original file was preserved"
            return
        if not isinstance(settings, dict):
            self._settings_load_error = "saved preferences must contain a JSON object"
            self._settings_save_error = "saved preferences are invalid; the original file was preserved"
            return
        saved_scanner_view = settings.get("scanner_view")
        if isinstance(saved_scanner_view, dict):
            self._saved_scanner_view = saved_scanner_view
        if "portfolio_card_order" in settings:
            card_order = self._validated_portfolio_card_order(settings.get("portfolio_card_order"))
            if card_order is None:
                self._settings_validation_notes.append("Portfolio card order was invalid and reset to its default.")
            else:
                self.portfolio_card_order = card_order
        for key, label, minimum, maximum in (
            ("min_score", "minimum scout score", 0, 100),
            ("plan_limit", "plans per pass", 1, 20),
            ("auto_interval_minutes", "automation interval", 1, 60),
        ):
            raw = settings.get(key)
            if raw is None:
                continue
            try:
                parsed = int(raw)
                if isinstance(raw, bool) or str(parsed) != str(raw).strip():
                    raise ValueError
            except (TypeError, ValueError):
                self._settings_validation_notes.append(f"{label} was invalid and reset to its default.")
            else:
                if not minimum <= parsed <= maximum:
                    self._settings_validation_notes.append(
                        f"{label} was outside {minimum}–{maximum} and clamped to a safe range."
                    )
        self.min_score_var.set(str(self._coerce_int(settings.get("min_score"), 72, 0, 100)))
        chart_window = str(settings.get("chart_window", "80"))
        if chart_window in {"20", "40", "80", "120"}:
            self.chart_window_var.set(chart_window)
        self.plan_limit_var.set(str(self._coerce_int(settings.get("plan_limit"), 3, 1, 20)))
        self.auto_interval_var.set(str(self._coerce_int(settings.get("auto_interval_minutes"), 1, 1, 60)))
        execution_mode = settings.get("execution_mode")
        if isinstance(execution_mode, str) and execution_mode in {"User", "Auto"}:
            self.execution_mode_var.set(execution_mode)
        selected_manual = settings.get("manual_mode_user_selected")
        if execution_mode == "Auto":
            self._manual_mode_user_selected = False
        elif isinstance(selected_manual, bool):
            self._manual_mode_user_selected = selected_manual
        elif execution_mode == "User":
            # Existing settings did not record the source of Manual mode.
            # Treat it as a deliberate choice rather than overriding it later.
            self._manual_mode_user_selected = True
        self._automatic_fallback_restore_mode = (
            settings.get("automatic_fallback_restore_mode")
            if settings.get("automatic_fallback_restore_mode") in {"User", "Auto"}
            else "User"
        )
        fallback_reason = settings.get("automatic_fallback_reason")
        self._automatic_fallback_reason = str(fallback_reason)[:220] if isinstance(fallback_reason, str) else ""
        self._automatic_fallback_attempt = self._coerce_int(settings.get("automatic_fallback_attempt"), 0, 0, 4)
        self._automatic_fallback_active = (
            settings.get("automatic_fallback_active") is True
            and not self._manual_mode_user_selected
            and self.execution_mode_var.get() == "User"
        )
        execution_target = settings.get("execution_target")
        if isinstance(execution_target, str) and execution_target in {"Paper", "Simulation", "Live"}:
            self.execution_target_var.set(execution_target)
        account_lane = settings.get("account_lane")
        if isinstance(account_lane, str) and account_lane in {"I-Cash", "Crypto"}:
            self.account_lane_var.set(account_lane)
        if isinstance(settings.get("selected_webull_account_id"), str):
            self.selected_webull_account_id_var.set(settings["selected_webull_account_id"].strip())
        style = str(settings.get("trading_style", "Adaptive")).strip().title()
        if style in {"Adaptive", "Aggressive", "Balanced", "Conservative"}:
            self.trading_style_var.set(style)
        patterns = settings.get("patterns")
        if isinstance(patterns, list):
            enabled = {str(item).strip().lower() for item in patterns}
            for key, var in self.pattern_vars.items():
                var.set(key in enabled)
        raw_experience = settings.get("trader_experience_years")
        if isinstance(raw_experience, int) and not isinstance(raw_experience, bool) and 0 <= raw_experience <= 80:
            self.trader_experience_years_var.set(str(raw_experience))
        preference = settings.get("trader_risk_preference")
        if isinstance(preference, str) and preference in {"Not set", "Conservative", "Moderate", "Aggressive"}:
            self.trader_risk_preference_var.set(preference)
        self.trader_risk_acknowledged_var.set(settings.get("trader_risk_acknowledged") is True)
        self.trader_risk_acknowledged_at = str(settings.get("trader_risk_acknowledged_at") or "")

    def _setup_settings_traces(self) -> None:
        for var in (
            self.min_score_var,
            self.plan_limit_var,
            self.auto_interval_var,
            self.paper_auto_var,
            self.execution_mode_var,
            self.execution_target_var,
            self.account_lane_var,
            self.trading_style_var,
            *self.pattern_vars.values(),
        ):
            var.trace_add("write", lambda *_args: self._settings_changed())

    def _setup_profile_traces(self) -> None:
        for var in (
            self.profile_app_key_var,
            self.profile_app_secret_var,
            self.profile_account_id_var,
            self.profile_region_var,
            self.profile_endpoint_var,
            self.profile_live_orders_var,
            self.profile_require_preview_var,
            self.profile_trader_live_var,
            self.profile_auto_live_var,
        ):
            var.trace_add("write", lambda *_args: self._profile_form_changed())

    def _profile_form_changed(self) -> None:
        if self._automation_cycle_in_progress and self._automation_cancel_event is not None:
            self._automation_cancel_event.set()
        current_fingerprint = self._profile_fingerprint(self._current_profile_payload())
        if self.verified_profile_fingerprint and current_fingerprint != self.verified_profile_fingerprint:
            self.verified_profile_fingerprint = None
            self.profile_verification_status = "Changed since verification"
            self.trade_cash_snapshot = ("-", "Run Account Check")
            self.trade_cash_value = None
            self.execution_target_var.set("Paper")
        self._sync_profile_save_state()
        self._render_setup_status()

    def _sync_profile_save_state(self) -> None:
        button = getattr(self, "setup_save_button", None)
        if button is None:
            return
        state = "normal" if self._profile_fingerprint(self._current_profile_payload()) == self.verified_profile_fingerprint else "disabled"
        try:
            button.configure(state=state)
        except tk.TclError:
            pass

    def _settings_changed(self) -> None:
        # Risk and automation settings are captured for each cycle. If they
        # change mid-flight, finish the in-flight provider call but prevent
        # the cycle from advancing to a broker request.
        if self._automation_cycle_in_progress and self._automation_cancel_event is not None:
            self._automation_cancel_event.set()
        self._save_runtime_settings()
        if getattr(self, "config", None) is not None:
            self._render_status()
        if self._settings_save_error and hasattr(self, "status_bar"):
            self.status_bar.configure(text=f"Settings not saved: {self._settings_save_error[:160]}")
        if getattr(self, "active_tab", None) == "Automation":
            self._render_automation_panel()

    def _save_runtime_settings(self) -> None:
        if self._settings_load_error:
            self._settings_save_error = "saved preferences are unreadable; back up and repair the file before saving changes"
            return
        bounded_values = []
        for label, value, minimum, maximum in (
            ("Minimum scout score", self.min_score_var.get(), 0, 100),
            ("Plans per pass", self.plan_limit_var.get(), 1, 20),
            ("Automation interval", self.auto_interval_var.get(), 1, 60),
        ):
            try:
                parsed = int(value)
            except (TypeError, ValueError):
                self._settings_save_error = f"{label} must be a whole number from {minimum} to {maximum}."
                return
            if str(parsed) != str(value).strip() or not minimum <= parsed <= maximum:
                self._settings_save_error = f"{label} must be a whole number from {minimum} to {maximum}."
                return
            bounded_values.append(parsed)
        settings = {
            "min_score": bounded_values[0],
            "plan_limit": bounded_values[1],
            "auto_interval_minutes": bounded_values[2],
            "paper_auto": bool(self.paper_auto_var.get()),
            "execution_mode": self.execution_mode_var.get(),
            "manual_mode_user_selected": bool(self._manual_mode_user_selected),
            "automatic_fallback_active": bool(self._automatic_fallback_active),
            "automatic_fallback_restore_mode": self._automatic_fallback_restore_mode,
            "automatic_fallback_reason": self._automatic_fallback_reason[:220],
            "automatic_fallback_attempt": self._automatic_fallback_attempt,
            "execution_target": self.execution_target_var.get(),
            "account_lane": self.account_lane_var.get(),
            "selected_webull_account_id": self._selected_webull_account_override() or "",
            "trading_style": self.trading_style_var.get(),
            "patterns": sorted(self._runtime_strategy_patterns()),
            "chart_window": self.chart_window_var.get(),
            "trader_experience_years": (int(self.trader_experience_years_var.get())
                                        if self.trader_experience_years_var.get().isdigit() else None),
            "trader_risk_preference": self.trader_risk_preference_var.get(),
            "trader_risk_acknowledged": bool(self.trader_risk_acknowledged_var.get()),
            "trader_risk_acknowledged_at": self.trader_risk_acknowledged_at,
            "portfolio_card_order": list(self._validated_portfolio_card_order(self.portfolio_card_order)
                                          or self._portfolio_default_card_order),
            "saved_at": datetime.now().isoformat(),
        }
        if isinstance(self._saved_scanner_view, dict):
            settings["scanner_view"] = self._saved_scanner_view
        try:
            _write_private_json(self.settings_path, settings)
            self._refresh_integrity_manifest()
        except OSError as exc:
            self._settings_save_error = f"{type(exc).__name__}: {exc}"
        else:
            self._settings_save_error = None

    def _validated_portfolio_card_order(self, value) -> list[str] | None:
        if not isinstance(value, (list, tuple)) or len(value) != len(self._portfolio_default_card_order):
            return None
        if any(not isinstance(item, str) for item in value):
            return None
        if len(set(value)) != len(value) or set(value) != set(self._portfolio_default_card_order):
            return None
        return list(value)

    def _edit_portfolio_card_order(self) -> None:
        dialog = tk.Toplevel(self.root)
        dialog.title("Portfolio card order")
        dialog.transient(self.root)
        dialog.configure(bg=self.colors["panel"])
        tk.Label(dialog, text="Choose which portfolio totals appear first.", bg=self.colors["panel"],
                 fg=self.colors["muted"], font=("Sans", 9), anchor="w").pack(fill="x", padx=14, pady=(12, 8))
        body = tk.Frame(dialog, bg=self.colors["panel"])
        body.pack(fill="both", expand=True, padx=14)
        cards = tk.Listbox(body, height=5, exportselection=False, bg=self.colors["entry"],
                           fg=self.colors["text"], selectbackground=self.colors["selected"],
                           selectforeground=self.colors["selected_text"], relief="flat", activestyle="none")
        cards.pack(side="left", fill="both", expand=True)
        controls = tk.Frame(body, bg=self.colors["panel"])
        controls.pack(side="left", fill="y", padx=(8, 0))
        order = list(self.portfolio_card_order)

        def display_order(selected: int = 0) -> None:
            cards.delete(0, "end")
            for title in order:
                cards.insert("end", title)
            if order:
                selected = max(0, min(selected, len(order) - 1))
                cards.selection_set(selected)
                cards.activate(selected)

        def move(delta: int) -> None:
            selection = cards.curselection()
            if not selection:
                return
            source = int(selection[0])
            destination = max(0, min(source + delta, len(order) - 1))
            if destination == source:
                return
            order[source], order[destination] = order[destination], order[source]
            display_order(destination)

        self._button(controls, "Move up", lambda: move(-1)).pack(fill="x", pady=(0, 6))
        self._button(controls, "Move down", lambda: move(1)).pack(fill="x")
        display_order()
        buttons = tk.Frame(dialog, bg=self.colors["panel"])
        buttons.pack(fill="x", padx=14, pady=12)

        def reset_order() -> None:
            order[:] = self._portfolio_default_card_order
            display_order()

        def save_order() -> None:
            validated = self._validated_portfolio_card_order(order)
            if validated is None:
                messagebox.showerror("Order not saved", "The card order is invalid.", parent=dialog)
                return
            self.portfolio_card_order = validated
            for column, title in enumerate(self.portfolio_card_order):
                self.portfolio_summary_labels[title].master.grid_configure(column=column)
            self._save_runtime_settings()
            if self._settings_save_error and hasattr(self, "status_bar"):
                self.status_bar.configure(text=f"Card order changed for this session; preference not saved: {self._settings_save_error[:140]}")
            dialog.destroy()

        self._button(buttons, "Reset", reset_order).pack(side="left")
        self._button(buttons, "Cancel", dialog.destroy).pack(side="right", padx=(8, 0))
        self._button(buttons, "Save order", save_order, accent="teal").pack(side="right")
        dialog.bind("<Escape>", lambda _event: dialog.destroy())
        dialog.grab_set()

    @staticmethod
    def _coerce_int(value, fallback: int, minimum: int, maximum: int) -> int:
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            parsed = fallback
        return max(minimum, min(maximum, parsed))

    def _sync_automation(self) -> None:
        if self._automatic_fallback_active:
            self._clear_automatic_fallback(keep_manual=True)
        if self._automation_enabled():
            self._automation_wait_reason = ""
            self.status_bar.configure(text=f"{self.execution_target_var.get()} automation armed.")
            self._schedule_automation()
        else:
            self._cancel_automation_callback("automation_after_id")
            self._automation_next_run_at = None
            self._sync_manual_controls()
            self._render_automation_panel()

    def _automation_enabled(self) -> bool:
        if self._automatic_fallback_active:
            return False
        if self.paper_auto_var.get():
            return True
        if self.execution_mode_var.get() != "Auto":
            return False
        return not (self.execution_target_var.get() == "Live" and self._live_auto_block_reason())

    def _unresolved_live_auto_reason(self) -> str:
        if getattr(self, "_execution_log_unreadable_for_order_safety", False):
            return "Execution history is unreadable; Live automation remains held."
        if str(getattr(self, "audit_status", "")).startswith("Audit warning"):
            return "Execution history has an integrity warning; Live automation remains held."
        try:
            unresolved = self._unresolved_unknown_live_orders()
        except Exception:
            return "Live order history could not be checked; Live automation remains held."
        if unresolved:
            return f"{len(unresolved)} unresolved Live order outcome(s); review unknown orders before resuming."
        if str(getattr(self, "audit_status", "")).startswith("Audit warning"):
            return "Execution history has an integrity warning; Live automation remains held."
        return ""

    def _live_auto_block_reason(self) -> str:
        config = self._execution_config(self.config or self._load_config_safe())
        try:
            self._configured_automation_risk_limits(config)
        except RuntimeError as exc:
            return str(exc)
        if not config.auto_start_live_on_market_open:
            return "Saved Live Auto opt-in is off; enable it in the Webull profile before automated Live orders."
        if not self._live_ready(config):
            return "Live account mode or the Webull live-order switch is off."
        if self._broker_check_required(config):
            return "Run Account Check before automated Live orders."
        unresolved_reason = self._unresolved_live_auto_reason()
        if self._automation_hold_reason:
            return self._automation_hold_reason
        if unresolved_reason:
            return unresolved_reason
        if self._persisted_live_automation_hold_id:
            return "Live automation remains paused; select Auto again to explicitly re-arm after review."
        return ""

    def _cancel_automation_callback(self, attribute: str) -> None:
        callback_id = getattr(self, attribute, None)
        if callback_id:
            try:
                self.root.after_cancel(callback_id)
            except tk.TclError:
                pass
        setattr(self, attribute, None)

    def _hold_live_automation(self, reason: str) -> None:
        detail = str(reason or "Unknown Live order outcome.").strip()[:180]
        self._automation_hold_reason = (
            f"{detail} Review unknown orders and confirm Webull state before re-arming."
        )
        self._persist_live_automation_hold(detail)
        self._automation_wait_reason = self._automation_hold_reason
        if not self.paper_auto_var.get():
            self._cancel_automation_callback("automation_after_id")
        self._cancel_automation_callback("market_open_after_id")
        self._automation_next_run_at = None
        self.status_bar.configure(text=self._automation_hold_reason)

    def _persist_live_automation_hold(self, detail: str) -> None:
        if self._persisted_live_automation_hold_id:
            return
        if getattr(self, "_execution_log_unreadable_for_order_safety", False):
            return
        if str(getattr(self, "audit_status", "")).startswith("Audit warning"):
            return
        hold_id = uuid4().hex
        try:
            self._append_execution_event({
                "mode": "live",
                "robot": "Timmy",
                "event_type": "live-automation-hold",
                "status": "held",
                "hold_id": hold_id,
                "reason": str(detail)[:180],
                "recorded_at": datetime.now().isoformat(),
            })
        except Exception:
            return
        self._persisted_live_automation_hold_id = hold_id

    def _record_live_automation_rearm(self) -> bool:
        hold_id = self._persisted_live_automation_hold_id
        if not hold_id:
            return True
        try:
            self._append_execution_event({
                "mode": "live",
                "robot": "Timmy",
                "event_type": "live-automation-rearm",
                "status": "rearmed",
                "hold_id": hold_id,
                "recorded_at": datetime.now().isoformat(),
            })
        except Exception as exc:
            self.status_bar.configure(text=f"Live automation remains held; re-arm could not be journaled: {str(exc)[:120]}")
            return False
        self._persisted_live_automation_hold_id = ""
        return True

    def _on_execution_mode_selected(self) -> None:
        if (self._automation_cycle_in_progress
                and self.execution_mode_var.get() != self._automation_cycle_requested_mode
                and self._automation_cancel_event is not None):
            self._automation_cancel_event.set()
        self._manual_mode_user_selected = self.execution_mode_var.get() == "User"
        self._clear_automatic_fallback(keep_manual=False)
        if self.execution_mode_var.get() == "Auto" and self.execution_target_var.get() == "Live":
            unresolved_reason = self._unresolved_live_auto_reason()
            if unresolved_reason:
                self._automation_hold_reason = unresolved_reason
                self._persist_live_automation_hold(unresolved_reason)
                if self.paper_auto_var.get():
                    self._schedule_automation()
                else:
                    self._cancel_automation_callback("automation_after_id")
                self._cancel_automation_callback("market_open_after_id")
                self._automation_next_run_at = None
                self.status_bar.configure(text=f"Live automation held: {unresolved_reason}")
                self._sync_manual_controls()
                self._render_automation_panel()
                return
            # Choosing Auto again is the explicit re-arm after a prior safety hold.
            if not self._record_live_automation_rearm():
                self._sync_manual_controls()
                self._render_automation_panel()
                return
            self._automation_hold_reason = ""
            self._automation_wait_reason = ""
        self._sync_manual_controls()
        if self._automation_enabled():
            self._schedule_automation()
            self.status_bar.configure(text=f"{self.execution_target_var.get()} automation armed on the configured interval.")
        else:
            self._cancel_automation_callback("automation_after_id")
            self._automation_next_run_at = None
            self.status_bar.configure(text="Automation is paused. Run Cycle remains available in User mode.")
        self._render_automation_panel()

    def _arm_market_open_automation(self) -> None:
        if self._automatic_fallback_active:
            return
        config = self.config or self._load_config_safe()
        paper_enabled = (
            config.auto_start_paper_on_market_open and config.trader_mode == "paper"
            and not self._manual_mode_user_selected
        )
        live_block = self._live_auto_block_reason()
        live_enabled = (
            config.auto_start_live_on_market_open and self._live_ready(config)
            and not live_block and not self._manual_mode_user_selected
        )
        if config.auto_start_live_on_market_open and live_block:
            self._persist_live_automation_hold(live_block)
            self._automation_wait_reason = live_block
            if self.execution_target_var.get() == "Live":
                self.status_bar.configure(text=f"Live market-open automation held: {live_block}")
            self._render_automation_panel()
        if not paper_enabled and not live_enabled:
            return
        if paper_enabled:
            self.paper_auto_var.set(True)
        if live_enabled:
            self.execution_target_var.set("Live")
            self.execution_mode_var.set("Auto")
        if self._regular_market_open_now() or (paper_enabled and self._paper_simulation_enabled(config)):
            self.status_bar.configure(text="Market open automation active.")
            self._run_market_open_cycle(paper_enabled, live_enabled)
            self._schedule_automation()
            return
        self.status_bar.configure(text="Market-open automation armed.")
        self._schedule_market_open_check(config)

    def _schedule_market_open_check(self, config: BotConfig | None = None) -> None:
        if self.closing:
            return
        config = config or self.config or self._load_config_safe()
        if self.market_open_after_id:
            try:
                self.root.after_cancel(self.market_open_after_id)
            except tk.TclError:
                pass
        seconds_to_open = seconds_until_next_open()
        if seconds_to_open > 3600:
            delay_seconds = 900
        elif seconds_to_open > 300:
            delay_seconds = 60
        else:
            delay_seconds = max(5, config.market_open_poll_seconds)
        delay_seconds = min(delay_seconds, seconds_to_open)
        delay_ms = delay_seconds * 1000
        self.market_open_after_id = self.root.after(delay_ms, self._market_open_tick)

    def _market_open_tick(self) -> None:
        self.market_open_after_id = None
        if self.closing or self._automatic_fallback_active:
            return
        config = self.config or self._load_config_safe()
        paper_enabled = (
            config.auto_start_paper_on_market_open and config.trader_mode == "paper"
            and not self._manual_mode_user_selected
        )
        live_block = self._live_auto_block_reason()
        live_enabled = (
            config.auto_start_live_on_market_open and self._live_ready(config)
            and not live_block and not self._manual_mode_user_selected
        )
        if config.auto_start_live_on_market_open and live_block:
            self._persist_live_automation_hold(live_block)
            self._automation_wait_reason = live_block
            if self.execution_target_var.get() == "Live":
                self.status_bar.configure(text=f"Live market-open automation held: {live_block}")
            self._render_automation_panel()
        if not paper_enabled and not live_enabled:
            return
        if not self._regular_market_open_now():
            self.status_bar.configure(text="Waiting for market open.")
            self._schedule_market_open_check(config)
            return
        if self._action_in_progress or self._refresh_in_progress or self._automation_cycle_in_progress:
            self._automation_wait_reason = "Market-open cycle is waiting for current work to finish."
            self.status_bar.configure(text="Market-open cycle waiting for current work to finish.")
            self.market_open_after_id = self.root.after(AUTOMATION_RETRY_MS, self._market_open_tick)
            self._automation_next_run_at = datetime.now(tz=ZoneInfo("America/New_York")) + timedelta(milliseconds=AUTOMATION_RETRY_MS)
            self._render_automation_panel()
            return
        if paper_enabled:
            self.paper_auto_var.set(True)
        if live_enabled:
            self.execution_target_var.set("Live")
            self.execution_mode_var.set("Auto")
        self.status_bar.configure(text="Market open detected. Running decision cycle.")
        self._run_market_open_cycle(paper_enabled, live_enabled)
        self._schedule_automation()

    def _run_market_open_cycle(self, paper_enabled: bool, live_enabled: bool) -> None:
        if self._automation_cycle_in_progress or self._action_in_progress or self._refresh_in_progress:
            self.status_bar.configure(text="Market-open cycle skipped while another operation is active.")
            return
        if paper_enabled:
            self.paper_auto_var.set(True)
        if live_enabled and not self._manual_mode_user_selected:
            self.execution_target_var.set("Live")
            self.execution_mode_var.set("Auto")
        self._automation_wait_reason = "Market-open cycle uses the standard asynchronous decision pipeline."
        self.run_decision_cycle()

    def _schedule_automation(self) -> None:
        if self.closing or not self._automation_enabled():
            self._cancel_automation_callback("automation_after_id")
            self._automation_next_run_at = None
            self._render_automation_panel()
            return
        if self.automation_after_id:
            self._cancel_automation_callback("automation_after_id")
        self.auto_interval_value = self._bounded_int(self.auto_interval_var, 1, 1, 60)
        self._automation_next_run_at = datetime.now(tz=ZoneInfo("America/New_York")) + timedelta(minutes=self.auto_interval_value)
        self._automation_wait_reason = ""
        self.automation_after_id = self.root.after(self.auto_interval_value * 60_000, self._automation_tick)
        self._render_automation_panel()

    def _automation_tick(self) -> None:
        self.automation_after_id = None
        self._automation_next_run_at = None
        self._render_automation_panel()
        auto_enabled = self._automation_enabled()
        if self.closing or not auto_enabled:
            return
        if self._action_in_progress or self._refresh_in_progress or self._automation_cycle_in_progress:
            active = self._active_action_label if self._action_in_progress else (
                "market refresh" if self._refresh_in_progress else "another automation cycle"
            )
            self.status_bar.configure(text=f"Automation cycle waiting for {active} to finish.")
            self._automation_wait_reason = f"Waiting for {active} to finish. Retry in {AUTOMATION_RETRY_MS // 1000} seconds."
            self._automation_next_run_at = datetime.now(tz=ZoneInfo("America/New_York")) + timedelta(milliseconds=AUTOMATION_RETRY_MS)
            self.automation_after_id = self.root.after(AUTOMATION_RETRY_MS, self._automation_tick)
            self._render_automation_panel()
            return
        self.run_decision_cycle()
        self._schedule_automation()

    def stop_automation(self) -> None:
        self._clear_automatic_fallback(keep_manual=True)
        if self._automation_cancel_event is not None:
            self._automation_cancel_event.set()
        self.paper_auto_var.set(False)
        self.execution_mode_var.set("User")
        self._manual_mode_user_selected = True
        self._automation_hold_reason = ""
        self._automation_wait_reason = ""
        self._cancel_automation_callback("automation_after_id")
        self._cancel_automation_callback("market_open_after_id")
        self._automation_next_run_at = None
        self._sync_manual_controls()
        self._record_automation_mode_transition("user-stopped-automation", "Pause All Automation selected by user.")
        self.status_bar.configure(text="Automation stopped.")
        self._render_automation_panel()

    def _set_text(self, widget: tk.Text, value: str) -> None:
        widget.configure(state="normal")
        widget.delete("1.0", "end")
        widget.insert("1.0", value)
        widget.configure(state="disabled")

    def _text_value(self, widget: tk.Text) -> str:
        try:
            return widget.get("1.0", "end-1c")
        except tk.TclError:
            return ""

    def _ensure_execution_journal_writable(self) -> None:
        """Fail before a broker request if Timmy cannot persist its response."""
        self.event_log_path.parent.mkdir(parents=True, exist_ok=True)
        if self.event_log_path.exists():
            self.event_log_path.chmod(0o600)
        descriptor = os.open(self.event_log_path, os.O_WRONLY | os.O_APPEND | os.O_CREAT, 0o600)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)

    def _append_execution_event(self, event: dict) -> None:
        with self._execution_journal_lock:
            self._append_execution_event_locked(event)

    def _append_execution_event_locked(self, event: dict) -> None:
        payload = dict(event)
        payload.setdefault("recorded_at", datetime.now().isoformat())
        payload["prev_hash"] = self._last_audit_hash()
        payload["event_hash"] = self._event_signature(payload, payload["prev_hash"])
        self.event_log_path.parent.mkdir(parents=True, exist_ok=True)
        with self.event_log_path.open("a", encoding="utf-8") as file:
            os.fchmod(file.fileno(), 0o600)
            file.write(json.dumps(payload, sort_keys=True) + "\n")
            file.flush()
            os.fsync(file.fileno())
        self._refresh_integrity_manifest()
        self.execution_events.append(payload)
        self.recent_bad_event_counts = self._build_bad_event_counts(self.execution_events)
        self._execution_events_cache_key = None

    def _load_execution_events(self) -> list[dict]:
        cache_key = self._event_files_cache_key()
        if cache_key == self._execution_events_cache_key:
            return list(self._execution_events_cache)
        events: list[dict] = []
        seen: set[tuple[str, str, str, str]] = set()
        self.audit_status = "Audit chain ready"
        self._harden_runtime_files()
        simulation_path = getattr(self, "simulation_journal_path", self.journal_path.parent / "simulation-trade-journal.jsonl")
        for path in (self.journal_path, simulation_path, self.event_log_path):
            if not path.exists():
                continue
            lines = self._tail_lines(path, 500)
            if path == self.event_log_path:
                with path.open("r", encoding="utf-8", errors="replace") as event_log:
                    lines = self._validate_audit_lines(event_log, limit=500)
            for line in lines:
                if not line.strip():
                    continue
                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    continue
                order = event.get("order", {})
                key = (
                    str(event.get("mode") or ""),
                    str(event.get("submitted_at") or event.get("recorded_at") or ""),
                    str(event.get("symbol") or order.get("symbol") or ""),
                    str(event.get("status") or ""),
                )
                if key in seen:
                    continue
                seen.add(key)
                events.append(event)
        self._validate_integrity_manifest()
        self._execution_events_cache_key = cache_key
        self._execution_events_cache = list(events)
        return events

    def _event_files_cache_key(self) -> tuple:
        key = []
        simulation_path = getattr(self, "simulation_journal_path", self.journal_path.parent / "simulation-trade-journal.jsonl")
        for path in (self.journal_path, simulation_path, self.event_log_path, self.integrity_manifest_path):
            try:
                stat = path.stat()
                key.append((str(path), stat.st_mtime_ns, stat.st_size))
            except FileNotFoundError:
                key.append((str(path), 0, 0))
        return tuple(key)

    def _validate_audit_lines(self, lines: Iterable[str], limit: int | None = None) -> list[str]:
        # Validate every link in order, but keep only the recent records needed
        # by the UI when reading a long execution history.
        validated = deque(maxlen=limit) if limit else []
        prev_hash = "genesis"
        saw_signed = False
        self.audit_status = "Audit chain ok"
        for line in lines:
            if not line.strip():
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                self.audit_status = "Audit warning: malformed event log line detected"
                continue
            event_hash = event.get("event_hash")
            if not event_hash:
                validated.append(line)
                continue
            saw_signed = True
            expected_prev = event.get("prev_hash")
            expected_hash = self._event_signature(event, expected_prev)
            if expected_prev != prev_hash or not hmac.compare_digest(str(event_hash), expected_hash):
                self.audit_status = "Audit warning: execution log may have been edited"
                validated.append(line)
                prev_hash = str(event_hash)
                continue
            validated.append(line)
            prev_hash = str(event_hash)
        if not saw_signed and validated:
            self.audit_status = "Audit warning: legacy unsigned event records"
        return list(validated)

    @staticmethod
    def _tail_lines(path: Path, limit: int) -> list[str]:
        return path.read_text(encoding="utf-8", errors="replace").splitlines()[-limit:]

    def _event_from_broker_result(self, result: dict, mode: str) -> dict:
        plan = result.get("order_plan") or {}
        status = self._broker_event_status(result)
        request_payload = result.get("request_payload") or {}
        new_orders = request_payload.get("new_orders") if isinstance(request_payload, dict) else None
        request_order = new_orders[0] if isinstance(new_orders, list) and new_orders and isinstance(new_orders[0], dict) else {}
        return {
            "mode": mode,
            "robot": "Timmy",
            "recorded_at": datetime.now().isoformat(),
            "submitted_at": datetime.now().isoformat(),
            "event_type": "buy-order",
            "status": status,
            "symbol": plan.get("symbol"),
            "client_order_id": request_order.get("client_order_id"),
            "quantity": plan.get("quantity"),
            "buy_price": plan.get("limit_price"),
            "sell_target_price": plan.get("target_price"),
            "stop_price": plan.get("stop_price"),
            "sold_price": None,
            "sell_status": "target-pending" if status == "accepted" else "not-opened",
            "broker_error": result.get("error"),
            "broker_body": result.get("body"),
        }

    def _unresolved_unknown_live_orders(self) -> list[dict]:
        """Return unknown live orders not cleared by terminal resolution records."""
        event_log_path = getattr(self, "event_log_path", None)
        try:
            stat = event_log_path.stat() if event_log_path else None
            file_key = (stat.st_mtime_ns, stat.st_size, stat.st_ctime_ns, stat.st_mode) if stat else (0, 0, 0, 0)
        except FileNotFoundError:
            file_key = (0, 0, 0, 0)
        except OSError:
            self._execution_log_unreadable_for_order_safety = True
            self._unresolved_live_orders_cache_key = None
            return []
        cache_key = (file_key, len(getattr(self, "execution_events", [])))
        if getattr(self, "_unresolved_live_orders_cache_key", None) == cache_key:
            return list(getattr(self, "_unresolved_live_orders_cache", []))
        if file_key == (0, 0, 0, 0):
            self._persisted_live_automation_hold_id = ""

        events = list(getattr(self, "execution_events", []))
        trusted_unknown_events: list[dict] = []
        trusted_resolution_ids: set[str] = set()
        trusted_order_result_ids: set[str] = set()
        self._execution_log_unreadable_for_order_safety = False
        if event_log_path and file_key != (0, 0):
            # Execution history is displayed as a bounded tail, but safety
            # blocks must survive even if an unresolved order is older. Stream
            # the file and retain only relevant order records to bound memory.
            try:
                event_stream = event_log_path.open("r", encoding="utf-8", errors="replace")
            except OSError:
                self._execution_log_unreadable_for_order_safety = True
                self._unresolved_live_orders_cache_key = None
                self._unresolved_live_orders_cache = []
                return []
            with event_stream as event_log:
                previous_hash = "genesis"
                saw_signed = False
                chain_valid = True
                saw_records = False
                resolution_candidates: set[str] = set()
                order_result_candidates: set[str] = set()
                order_action_result_candidates: set[str] = set()
                active_automation_hold_id = ""
                self.audit_status = "Audit chain ok"
                for line in event_log:
                    if not line.strip():
                        continue
                    try:
                        event = json.loads(line)
                    except json.JSONDecodeError:
                        self.audit_status = "Audit warning: malformed event log line detected"
                        chain_valid = False
                        continue
                    if not isinstance(event, dict):
                        continue
                    saw_records = True
                    event_hash = event.get("event_hash")
                    if event_hash:
                        saw_signed = True
                        expected_hash = self._event_signature(event, event.get("prev_hash"))
                        if event.get("prev_hash") != previous_hash or not hmac.compare_digest(str(event_hash), expected_hash):
                            self.audit_status = "Audit warning: execution log may have been edited"
                            chain_valid = False
                        previous_hash = str(event_hash)
                    if event.get("mode") == "live":
                        event_type = str(event.get("event_type", "")).lower()
                        event_status = str(event.get("status", "")).lower()
                        hold_id = str(event.get("hold_id") or "")
                        if event_hash and event_type == "live-automation-hold" and event_status == "held" and hold_id:
                            active_automation_hold_id = hold_id
                        elif (
                            event_hash
                            and event_type == "live-automation-rearm"
                            and event_status == "rearmed"
                            and hold_id == active_automation_hold_id
                        ):
                            active_automation_hold_id = ""
                        if event_type == "live-order-intent" and event_status == "pending-submit":
                            trusted_unknown_events.append(event)
                        elif event_type == "buy-order" and event_status == "unknown":
                            trusted_unknown_events.append(event)
                        elif event_type == "order-action-intent" and event_status == "pending-action":
                            trusted_unknown_events.append(event)
                        elif event_type == "order-action-result" and event_status == "unknown":
                            trusted_unknown_events.append(event)
                        elif (
                            event_hash
                            and event_type in {"buy-order", "sell-order"}
                            and event_status in {"accepted", "rejected", "failed", "submitted", "cancelled", "canceled", "expired", "preview-required"}
                            and event.get("client_order_id")
                        ):
                            order_result_candidates.add(str(event["client_order_id"]))
                        elif (
                            event_hash
                            and event_type == "order-action-result"
                            and event_status in {"accepted", "rejected", "failed", "submitted", "cancelled", "canceled", "expired"}
                            and event.get("client_order_id")
                        ):
                            order_action_result_candidates.add(str(event["client_order_id"]))
                    if (
                        event_hash
                        and event.get("event_type") == "order-resolution"
                        and str(event.get("status", "")).lower() in {"rejected", "cancelled", "canceled", "expired"}
                        and event.get("client_order_id")
                    ):
                        resolution_candidates.add(str(event["client_order_id"]))
                if not saw_signed and saw_records:
                    self.audit_status = "Audit warning: legacy unsigned event records"
                    chain_valid = False
                if chain_valid:
                    trusted_resolution_ids = resolution_candidates
                    trusted_order_result_ids = order_result_candidates | order_action_result_candidates
                    self._persisted_live_automation_hold_id = active_automation_hold_id

            events.extend(trusted_unknown_events)

        # A resolution only clears the guard when it belongs to a valid signed
        # audit chain; copied or manually edited JSON cannot unlock a symbol.
        resolved_ids = trusted_resolution_ids | trusted_order_result_ids
        unresolved: dict[str, dict] = {}
        for event in events:
            if event.get("mode") != "live":
                continue
            event_type = str(event.get("event_type", "")).lower()
            event_status = str(event.get("status", "")).lower()
            if not (
                (event_type in {"buy-order", "sell-order"} and event_status == "unknown")
                or (event_type == "live-order-intent" and event_status == "pending-submit")
                or (event_type == "order-action-intent" and event_status == "pending-action")
                or (event_type == "order-action-result" and event_status == "unknown")
            ):
                continue
            client_order_id = str(event.get("client_order_id") or "").strip()
            if client_order_id and client_order_id not in resolved_ids:
                unresolved.setdefault(client_order_id, event)
        result = list(unresolved.values())
        self._unresolved_live_orders_cache_key = cache_key
        self._unresolved_live_orders_cache = result
        return list(result)

    def review_unknown_live_orders(self) -> None:
        unresolved = self._unresolved_unknown_live_orders()
        if getattr(self, "_execution_log_unreadable_for_order_safety", False):
            messagebox.showerror(
                "Execution log unavailable",
                "Timmy cannot read the execution log. Live orders remain blocked until the log is readable.",
            )
            return
        if not unresolved:
            messagebox.showinfo("Unresolved live orders", "No unresolved live order outcomes were found.")
            return
        if str(getattr(self, "audit_status", "")).startswith("Audit warning"):
            messagebox.showerror(
                "Execution log needs repair",
                "Timmy found an execution log integrity warning. Resolve the log integrity issue before recording an order resolution.",
            )
            return

        window = tk.Toplevel(self.root)
        window.title("Resolve unknown live orders")
        window.transient(self.root)
        window.grab_set()
        window.configure(bg=self.colors["panel"])
        window.columnconfigure(0, weight=1)
        window.rowconfigure(1, weight=1)

        tk.Label(
            window,
            text=(
                "Check each client order ID directly in Webull. Resolve only after Webull shows "
                "Rejected, Cancelled, or Expired. This tool does not contact Webull."
            ),
            bg=self.colors["panel"],
            fg=self.colors["text"],
            justify="left",
            wraplength=540,
            padx=16,
            pady=14,
        ).grid(row=0, column=0, sticky="ew")

        tree = ttk.Treeview(window, columns=("symbol", "client_order_id", "recorded"), show="headings", height=7)
        tree.heading("symbol", text="Symbol")
        tree.heading("client_order_id", text="Client order ID")
        tree.heading("recorded", text="Recorded")
        tree.column("symbol", width=90, stretch=False)
        tree.column("client_order_id", width=260, stretch=True)
        tree.column("recorded", width=150, stretch=False)
        tree.grid(row=1, column=0, sticky="nsew", padx=16, pady=(0, 10))
        order_by_id = {}
        for event in unresolved:
            order_id = str(event.get("client_order_id"))
            order_by_id[order_id] = event
            tree.insert(
                "",
                "end",
                iid=order_id,
                values=(event.get("symbol") or "-", order_id, event.get("recorded_at") or event.get("submitted_at") or "-"),
            )

        controls = tk.Frame(window, bg=self.colors["panel"])
        controls.grid(row=2, column=0, sticky="ew", padx=16, pady=(0, 8))
        status_var = tk.StringVar(value="")
        status = ttk.Combobox(
            controls,
            textvariable=status_var,
            values=("rejected", "cancelled", "expired"),
            state="readonly",
            width=14,
        )
        status.pack(side="left", padx=(0, 12))
        checked_var = tk.BooleanVar(value=False)
        confirm = tk.Checkbutton(
            controls,
            text="I checked this order ID in Webull and confirmed its terminal status.",
            variable=checked_var,
            bg=self.colors["panel"],
            fg=self.colors["text"],
            selectcolor=self.colors["panel_2"],
            activebackground=self.colors["panel"],
            activeforeground=self.colors["text"],
            wraplength=360,
            justify="left",
        )
        confirm.pack(side="left", fill="x", expand=True)

        buttons = tk.Frame(window, bg=self.colors["panel"])
        buttons.grid(row=3, column=0, sticky="e", padx=16, pady=(0, 14))

        def record_resolution() -> None:
            selection = tree.selection()
            if not selection:
                messagebox.showwarning("Resolve order", "Select an unresolved order first.", parent=window)
                return
            if not checked_var.get():
                messagebox.showwarning("Resolve order", "Confirm that you checked the order in Webull.", parent=window)
                return
            order_id = selection[0]
            event = order_by_id.get(order_id)
            terminal_status = status_var.get().lower()
            if not event or terminal_status not in {"rejected", "cancelled", "expired"}:
                messagebox.showerror("Resolve order", "A supported terminal status is required.", parent=window)
                return
            if not messagebox.askyesno(
                "Confirm terminal order status",
                f"Record {order_id} as {terminal_status.upper()} based on your Webull check?\n\n"
                "This clears Timmy's duplicate-order block for this client order ID.",
                parent=window,
            ):
                return
            self._append_execution_event({
                "mode": "live",
                "robot": "Timmy",
                "event_type": "order-resolution",
                "status": terminal_status,
                "symbol": str(event.get("symbol") or "").upper(),
                "client_order_id": order_id,
                "resolution_source": "operator-confirmed-webull-terminal-status",
                "recorded_at": datetime.now().isoformat(),
            })
            self._refresh_payload(skip_market_refresh=True)
            window.destroy()
            self.status_bar.configure(text=f"Recorded {order_id} as {terminal_status} after Webull confirmation.")

        self._button(buttons, "Record resolution", record_resolution, accent="gold").pack(side="left", padx=(0, 8))
        self._button(buttons, "Close", window.destroy).pack(side="left")

    def _update_buying_power_from_broker_results(self, results: list[dict]) -> None:
        for result in results:
            if self._broker_result_mentions(result, "buying power is insufficient"):
                self.trade_cash_snapshot = ("$0.00", "Insufficient buying power")
                self.trade_cash_value = 0.0
                return
            if self._broker_result_mentions(result, "insufficient buying power"):
                self.trade_cash_snapshot = ("$0.00", "Insufficient buying power")
                self.trade_cash_value = 0.0
                return

    @staticmethod
    def _broker_result_mentions(result: dict, phrase: str) -> bool:
        haystack = " ".join(
            str(value)
            for value in (
                result.get("status"),
                result.get("error"),
                result.get("message"),
                result.get("body"),
            )
        ).lower()
        return phrase.lower() in haystack

    @staticmethod
    def _broker_event_status(result: dict) -> str:
        raw_status = str(result.get("status") or "").lower()
        if raw_status in {"preview-required", "rejected", "failed", "accepted", "unknown",
                          "preflight-blocked", "exposure-blocked", "risk-blocked", "activity-blocked"}:
            return raw_status
        status_code = result.get("status_code")
        try:
            code = int(status_code)
        except (TypeError, ValueError):
            code = 0
        body = result.get("body")
        body_text = json.dumps(body, sort_keys=True).lower() if isinstance(body, (dict, list)) else str(body).lower()
        if any(word in body_text for word in ("reject", "rejected", "insufficient", "invalid order", "not accepted")):
            return "rejected"
        if 500 <= code < 600:
            # A server failure does not establish whether order placement was
            # committed. Keep the symbol blocked until the operator reconciles.
            return "unknown"
        if code and not 200 <= code < 300:
            return "rejected"
        if any(word in body_text for word in ("error", "failed")):
            return "rejected"
        if code:
            return "accepted"
        return "submitted"

    def _last_audit_hash(self) -> str:
        if not self.event_log_path.exists():
            return "genesis"
        for line in reversed(self._tail_lines(self.event_log_path, 500)):
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            event_hash = event.get("event_hash")
            if event_hash:
                return str(event_hash)
        return "genesis"

    def _event_signature(self, event: dict, prev_hash: str | None) -> str:
        payload = {key: value for key, value in event.items() if key not in {"event_hash", "prev_hash"}}
        encoded = json.dumps(
            {"prev_hash": prev_hash or "genesis", "event": payload},
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
        return hmac.new(self._audit_key(), encoded, hashlib.sha256).hexdigest()

    def _audit_key(self) -> bytes:
        audit_key_path = getattr(self, "audit_key_path", getattr(self, "home", Path(".")) / ".timmy-audit-key")
        if not audit_key_path.exists():
            _write_private_text(audit_key_path, secrets.token_hex(32))
        else:
            audit_key_path.chmod(0o600)
        return audit_key_path.read_text(encoding="utf-8").strip().encode("utf-8")

    def _tamper_tracked_paths(self) -> dict[str, Path]:
        home = getattr(self, "home", Path("."))
        return {
            "profile": home / ".timmy-profile.env",
            "settings": getattr(self, "settings_path", home / "timmy-ui-settings.json"),
            "watchlist": getattr(self, "watchlist_path", home / "watchlist.txt"),
            "active_watchlist": getattr(self, "active_watchlist_path", home / "active-watchlist.txt"),
            "movement_watchlist": getattr(self, "movement_watchlist_path", home / "movement-watchlist.txt"),
            "trade_ready_watchlist": getattr(self, "trade_ready_watchlist_path", home / "trade-ready-watchlist.txt"),
            "quiet_watchlist": getattr(self, "quiet_watchlist_path", home / "quiet-watchlist.txt"),
            "universe": getattr(self, "universe_path", home / "timmy-watchlist-universe.txt"),
            "rotation_state": getattr(self, "rotation_state_path", home / "timmy-watchlist-rotation.json"),
            "movement_rotation_state": getattr(self, "movement_rotation_state_path", home / "timmy-movement-universe-rotation.json"),
            "movement_tracker": getattr(self, "movement_tracker_path", home / "timmy-movement-tracker.json"),
            "movement_scan_candidates": getattr(self, "movement_scan_bars_path", home / "movement-scan-candidates.csv"),
            "recent_movers": getattr(self, "recent_movers_path", home / "recent-movers-96h.txt"),
            "movement_universe_extra": getattr(self, "movement_universe_extra_path", home / "movement-universe-extra.txt"),
            "paper_journal": getattr(self, "journal_path", home / "trade-journal.jsonl"),
            "simulation_journal": getattr(self, "simulation_journal_path", home / "simulation-trade-journal.jsonl"),
            "execution_events": getattr(self, "event_log_path", home / "execution-events.jsonl"),
        }

    def _harden_runtime_files(self) -> None:
        home = getattr(self, "home", Path("."))
        audit_key_path = getattr(self, "audit_key_path", home / ".timmy-audit-key")
        manifest_path = getattr(self, "integrity_manifest_path", home / ".timmy-integrity.json")
        settings_path = getattr(self, "settings_path", home / "timmy-ui-settings.json")
        journal_path = getattr(self, "journal_path", home / "trade-journal.jsonl")
        simulation_journal_path = getattr(self, "simulation_journal_path", home / "simulation-trade-journal.jsonl")
        event_log_path = getattr(self, "event_log_path", home / "execution-events.jsonl")
        for path in (audit_key_path, manifest_path, home / ".timmy-profile.env"):
            if path.exists():
                try:
                    path.chmod(0o600)
                except OSError:
                    self._set_audit_warning(f"could not harden {path.name}")
        for path in (settings_path, journal_path, simulation_journal_path, event_log_path):
            if path.exists():
                try:
                    path.chmod(0o600)
                except OSError:
                    self._set_audit_warning(f"could not harden {path.name}")

    def _refresh_integrity_manifest(self) -> None:
        try:
            self._harden_runtime_files()
            payload = self._integrity_manifest_payload()
            signed = {
                **payload,
                "signature": self._integrity_signature(payload),
            }
            manifest_path = getattr(self, "integrity_manifest_path", getattr(self, "home", Path(".")) / ".timmy-integrity.json")
            _write_private_json(manifest_path, signed)
        except OSError as exc:
            self._set_audit_warning(f"integrity manifest update failed: {exc}")

    def _validate_integrity_manifest(self) -> None:
        manifest_path = getattr(self, "integrity_manifest_path", getattr(self, "home", Path(".")) / ".timmy-integrity.json")
        if not manifest_path.exists():
            self._refresh_integrity_manifest()
            if not self.audit_status.startswith("Audit warning"):
                self.audit_status = "Audit chain ok; integrity baseline created"
            return
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            self._set_audit_warning("integrity manifest is unreadable")
            return
        signature = str(manifest.get("signature") or "")
        payload = {key: value for key, value in manifest.items() if key != "signature"}
        expected_signature = self._integrity_signature(payload)
        if not signature or not hmac.compare_digest(signature, expected_signature):
            self._set_audit_warning("integrity manifest signature mismatch")
            return
        current_files = self._integrity_manifest_payload()["files"]
        stored_files = payload.get("files", {})
        if current_files != stored_files:
            self._set_audit_warning("protected runtime files changed outside Timmy")
            return
        if self.audit_status in {"Audit chain ready", "Audit chain ok"}:
            self.audit_status = "Audit chain ok; integrity manifest ok"

    def _integrity_manifest_payload(self) -> dict:
        return {
            "version": 1,
            "files": {
                label: self._integrity_file_record(path)
                for label, path in self._tamper_tracked_paths().items()
            },
        }

    def _integrity_file_record(self, path: Path) -> dict:
        try:
            stat = path.stat()
        except FileNotFoundError:
            return {"exists": False}
        try:
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
        except OSError:
            digest = "unreadable"
        return {
            "exists": True,
            "sha256": digest,
            "size": stat.st_size,
            "mode": oct(stat.st_mode & 0o777),
        }

    def _integrity_signature(self, payload: dict) -> str:
        encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
        return hmac.new(self._audit_key(), encoded, hashlib.sha256).hexdigest()

    def _set_audit_warning(self, message: str) -> None:
        current = getattr(self, "audit_status", "")
        warning = f"Audit warning: {message}"
        if current.startswith("Audit warning") and message not in current:
            self.audit_status = f"{current}; {message}"
        else:
            self.audit_status = warning

    def _auto_refresh(self) -> None:
        if self.closing:
            return
        self.refresh_all()
        self.refresh_after_id = self.root.after(AUTO_REFRESH_MS, self._auto_refresh)

    def _auto_account_refresh(self) -> None:
        if self.closing:
            return
        try:
            config = self._execution_config(self._load_config_safe())
            if config.webull_app_key and config.webull_app_secret and config.webull_account_id:
                self._run_action("Auto Webull balance refresh", self.webull_check)
            else:
                self.status_bar.configure(text="Webull balance auto-refresh skipped; account is not fully configured.")
        finally:
            if not self.closing:
                self.account_refresh_after_id = self.root.after(ACCOUNT_REFRESH_MS, self._auto_account_refresh)

    @staticmethod
    def _redact_accounts(result: dict) -> dict:
        safe = dict(result)
        body = safe.get("body")
        if isinstance(body, list):
            safe["body"] = [
                {
                    "account_class": item.get("account_class"),
                    "account_label": item.get("account_label"),
                    "account_type": item.get("account_type"),
                }
                for item in body
                if isinstance(item, dict)
            ]
        return safe

    def _entry_too_large_for_cash(self, signal, config: BotConfig) -> bool:
        # A zero/invalid cash cap is an explicit no-entry risk setting. Fail
        # closed even when account cash is unavailable or reported as zero.
        if config.max_entry_cash_pct <= 0:
            return True
        if self.trade_cash_value is None or self.trade_cash_value <= 0:
            return False
        max_entry = self.trade_cash_value * (config.max_entry_cash_pct / 100)
        return signal.entry > max_entry

    def _operational_blocks(
        self,
        signal,
        config: BotConfig,
        *,
        include_session: bool = True,
        include_signal_quality: bool = True,
    ) -> list[str]:
        blocks: list[str] = []
        symbol = signal.symbol.upper()
        today_events = self._today_execution_events()

        # An exception during place_order leaves acceptance uncertain. Keep
        # that symbol blocked across sessions until an explicit terminal
        # broker resolution is journaled for the same client order ID.
        unresolved_orders = self._unresolved_unknown_live_orders()
        if getattr(self, "_execution_log_unreadable_for_order_safety", False):
            blocks.append("execution event log unreadable; live-order safety cannot be confirmed")
        if any(str(event.get("symbol") or "").upper() == symbol for event in unresolved_orders):
            blocks.append("unresolved live order outcome; reconcile with Webull before submitting this symbol")

        if include_session and config.require_market_hours and not self._regular_market_open_now():
            blocks.append("regular market session is closed")
        if self._symbol_data_is_stale(symbol):
            latest = self._latest_candle_timestamp(symbol) or "missing"
            blocks.append(f"market data stale: latest {symbol} candle {latest}")
        if include_signal_quality:
            if signal.reward_risk < config.min_reward_risk_to_trade:
                blocks.append(f"reward/risk {signal.reward_risk:.2f} below {config.min_reward_risk_to_trade:.2f}")
            if signal.volatility_pct > config.max_signal_volatility_pct:
                blocks.append(f"volatility {signal.volatility_pct:.2f}% above {config.max_signal_volatility_pct:.2f}%")
        if self._entry_too_large_for_cash(signal, config):
            blocks.append(f"entry exceeds {config.max_entry_cash_pct:g}% cash cap")
        if self._recent_bad_events(symbol) >= config.max_recent_rejections:
            blocks.append(f"recent rejected/failed events reached {config.max_recent_rejections}")
        if self._count_trade_events(today_events) >= config.max_daily_trades:
            blocks.append(f"daily trade cap reached at {config.max_daily_trades}")
        if self._count_trade_events(today_events, symbol) >= config.max_symbol_daily_trades:
            blocks.append(f"{symbol} daily trade cap reached at {config.max_symbol_daily_trades}")

        last_symbol_event = self._latest_symbol_event(today_events, symbol)
        if last_symbol_event:
            age = datetime.now(tz=ZoneInfo("America/New_York")) - last_symbol_event
            cooldown = timedelta(minutes=config.order_cooldown_minutes)
            if age < cooldown:
                remaining = int((cooldown - age).total_seconds() // 60) + 1
                blocks.append(f"{symbol} cooldown active for {remaining}m")

        if self._estimated_daily_realized_loss(today_events) >= config.max_daily_loss_usd:
            blocks.append(f"daily realized-loss cap reached at {money(config.max_daily_loss_usd)}")
        return blocks

    def _symbol_data_is_stale(self, symbol: str) -> bool:
        bars = self.bars_by_symbol.get(symbol.upper(), [])
        if not bars:
            return True
        return (datetime.now() - bars[-1].timestamp) > timedelta(days=4)

    def _today_execution_events(self) -> list[dict]:
        market_tz = ZoneInfo("America/New_York")
        today = datetime.now(tz=market_tz).date()
        events = []
        for event in self.execution_events:
            if event.get("mode") == "simulation":
                continue
            if str(event.get("status", "")).lower() == "preview-required":
                continue
            timestamp = self._event_timestamp(event)
            if timestamp and timestamp.astimezone(market_tz).date() == today:
                events.append(event)
        return events

    @staticmethod
    def _regular_market_open_now() -> bool:
        return market_session().is_open

    @staticmethod
    def _event_timestamp(event: dict) -> datetime | None:
        raw = event.get("submitted_at") or event.get("recorded_at")
        if not raw:
            return None
        try:
            parsed = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        except ValueError:
            return None
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=ZoneInfo("America/New_York"))
        return parsed

    def _count_trade_events(self, events: list[dict], symbol: str | None = None) -> int:
        count = 0
        for event in events:
            event_symbol = str(event.get("symbol") or event.get("order", {}).get("symbol") or "").upper()
            if symbol and event_symbol != symbol:
                continue
            status = str(event.get("status", "")).lower()
            if any(word in status for word in ("reject", "fail", "cancel", "error", "preview-required")):
                continue
            count += 1
        return count

    def _latest_symbol_event(self, events: list[dict], symbol: str) -> datetime | None:
        latest: datetime | None = None
        for event in events:
            event_symbol = str(event.get("symbol") or event.get("order", {}).get("symbol") or "").upper()
            if event_symbol != symbol:
                continue
            timestamp = self._event_timestamp(event)
            if timestamp and (latest is None or timestamp > latest):
                latest = timestamp
        return latest

    @staticmethod
    def _estimated_daily_realized_loss(events: list[dict]) -> float:
        loss = 0.0
        for event in events:
            buy_price = event.get("buy_price") or event.get("order", {}).get("limit_price")
            sold_price = event.get("sold_price")
            quantity = event.get("quantity") or event.get("order", {}).get("quantity") or 0
            if buy_price is None or sold_price is None:
                continue
            try:
                pnl = (float(sold_price) - float(buy_price)) * float(quantity)
            except (TypeError, ValueError):
                continue
            if pnl < 0:
                loss += abs(pnl)
        return round(loss, 2)

    def _price_gate_label(self, signal) -> str:
        if signal.expense_status == "too-expensive":
            return "too expensive"
        if self.config and self._entry_too_large_for_cash(signal, self.config):
            return "cash cap"
        return "fair"

    def _local_sensible_score(self, signal) -> int:
        score = signal.sensible_score
        if getattr(signal, "scout_action", "quiet") == "alert":
            score += 4
        elif getattr(signal, "scout_action", "quiet") == "quiet":
            score -= 10
        if self.config and self._entry_too_large_for_cash(signal, self.config):
            score -= 35
        if self._recent_bad_events(signal.symbol) >= 2:
            score -= 20
        return max(0, min(100, score))

    def _local_sensible_action(self, signal) -> str:
        score = self._local_sensible_score(signal)
        if score >= 78 and signal.direction == "bullish" and self._price_gate_label(signal) == "fair":
            return "trade"
        if score >= 50:
            return "watch"
        return "avoid"

    def _sensible_label(self, signal) -> str:
        return f"{self._local_sensible_action(signal)} {self._local_sensible_score(signal)}"

    @staticmethod
    def _scout_label(signal) -> str:
        return f"{getattr(signal, 'scout_action', 'quiet')} {getattr(signal, 'scout_score', 0)}"

    def _recent_bad_events(self, symbol: str) -> int:
        return self.recent_bad_event_counts.get(symbol.upper(), 0)

    def _build_bad_event_counts(self, events: list[dict]) -> dict[str, int]:
        counts: dict[str, int] = {}
        for event in events[-40:]:
            if event.get("mode") == "simulation":
                continue
            event_symbol = event.get("symbol") or event.get("order", {}).get("symbol")
            if not event_symbol:
                continue
            status = str(event.get("status", "")).lower()
            sell_status = str(event.get("sell_status", "")).lower()
            if any(word in status for word in ("reject", "fail", "cancel", "error")) or "stopped" in sell_status:
                key = str(event_symbol).upper()
                counts[key] = counts.get(key, 0) + 1
        return counts

    def _extract_trade_cash(self, result: dict, account_id: str | None) -> tuple[str, str]:
        body = result.get("body")
        account = self._select_account_payload(body, account_id)
        candidates = []
        if isinstance(body, dict) and body.get("balance") is not None:
            candidates.extend(self._flatten_money_fields(body.get("balance")))
        candidates.extend(self._flatten_money_fields(account if account is not None else body))
        priorities = (
            "cash_available_for_trade",
            "available_cash",
            "availablecash",
            "cashavailable",
            "cash_balance",
            "cashbalance",
            "buying_power",
            "buyingpower",
            "day_trading_buying_power",
            "overnight_buying_power",
            "settled_cash",
        )
        for priority in priorities:
            for key, value in candidates:
                if key == priority:
                    return money(value), self._cash_label(priority)
        for key, value in candidates:
            if "cash" in key or "buyingpower" in key or "buying_power" in key:
                return money(value), self._cash_label(key)
        return "-", "Cash not found"

    def _select_account_payload(self, body, account_id: str | None):
        if isinstance(body, dict) and isinstance(body.get("accounts"), list):
            selected = self._select_account_payload(body.get("accounts"), account_id)
            if isinstance(selected, dict):
                return selected
        if not isinstance(body, list) or not account_id:
            return body
        normalized_id = str(account_id)
        for item in body:
            if not isinstance(item, dict):
                continue
            for key, value in self._walk_items(item):
                if "account" in key and str(value) == normalized_id:
                    return item
        return body

    def _extract_account_summary(self, result: dict, account_id: str | None = None) -> tuple[str, str]:
        body = result.get("body")
        account = self._select_account_payload(body, account_id or self._execution_config(self._load_config_safe()).webull_account_id)
        if isinstance(account, list):
            account = next((item for item in account if isinstance(item, dict)), None)
        if not isinstance(account, dict):
            return "Unknown", "Account response checked"
        label = account.get("account_label") or account.get("account_type") or account.get("account_class") or "Configured"
        detail_parts = [
            str(account.get(key))
            for key in ("account_class", "account_type")
            if account.get(key)
        ]
        detail = " / ".join(dict.fromkeys(detail_parts)) or "Account response checked"
        return str(label)[:28], detail[:40]

    @staticmethod
    def _mask_account_id(account_id: str | None) -> str:
        if not account_id:
            return "No account"
        value = str(account_id).strip()
        if len(value) <= 4:
            return value
        return f"****{value[-4:]}"

    def _flatten_money_fields(self, value) -> list[tuple[str, float]]:
        fields: list[tuple[str, float]] = []
        for key, raw_value in self._walk_items(value):
            normalized = key.lower().replace("-", "_").replace(" ", "_")
            amount = self._numeric_money(raw_value)
            if amount is not None:
                fields.append((normalized, amount))
        return fields

    def _walk_items(self, value, prefix: str = ""):
        if isinstance(value, dict):
            for key, item in value.items():
                name = f"{prefix}_{key}" if prefix else str(key)
                yield from self._walk_items(item, name)
        elif isinstance(value, list):
            for item in value:
                yield from self._walk_items(item, prefix)
        else:
            yield prefix, value

    @staticmethod
    def _numeric_money(value) -> float | None:
        if isinstance(value, bool):
            return None
        if isinstance(value, (int, float)):
            return float(value)
        if not isinstance(value, str):
            return None
        cleaned = value.replace("$", "").replace(",", "").strip()
        if not cleaned:
            return None
        try:
            return float(cleaned)
        except ValueError:
            return None

    @staticmethod
    def _cash_label(key: str) -> str:
        labels = {
            "cash_available_for_trade": "Available to trade",
            "available_cash": "Available cash",
            "availablecash": "Available cash",
            "cashavailable": "Available cash",
            "cash_balance": "Cash balance",
            "cashbalance": "Cash balance",
            "account_currency_assets_cash_balance": "Cash balance",
            "total_cash_balance": "Cash balance",
            "buying_power": "Buying power",
            "buyingpower": "Buying power",
            "account_currency_assets_buying_power": "Buying power",
            "day_trading_buying_power": "Day-trade buying power",
            "overnight_buying_power": "Overnight buying power",
            "account_currency_assets_night_trading_buying_power": "Night trading buying power",
            "account_currency_assets_option_buying_power": "Option buying power",
            "settled_cash": "Settled cash",
            "account_currency_assets_settled_cash": "Settled cash",
            "account_currency_assets_unsettled_cash": "Unsettled cash",
        }
        return labels.get(key, key.replace("_", " ").title())


def money(value) -> str:
    try:
        amount = float(value or 0)
    except (TypeError, ValueError):
        amount = 0.0
    return f"${amount:,.2f}"


def _format_quantity(value: float) -> str:
    if float(value).is_integer():
        return str(int(value))
    return f"{value:.8f}".rstrip("0").rstrip(".")


def _restart_command(home: Path) -> list[str]:
    launcher = home / "scripts" / "launch_timmy.sh"
    if launcher.exists():
        command = [str(launcher)]
    elif getattr(sys, "frozen", False):
        # In a packaged install sys.executable is Timmy itself, not Python.
        command = [sys.executable]
    else:
        command = [sys.executable, "-m", "trend_trader.desktop"]
    # Power Cycle schedules this process to exit shortly after spawning the
    # replacement. Let the old instance release its lock before relaunching.
    return ["sh", "-c", 'sleep 1; exec "$@"', "timmy-restart", *command]
