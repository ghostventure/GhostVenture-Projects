from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import subprocess
import sys
import threading
import tkinter as tk
import tkinter.font as tkfont
import traceback
from dataclasses import is_dataclass, replace
from datetime import datetime, timedelta
from pathlib import Path
from tkinter import messagebox, ttk
from zoneinfo import ZoneInfo

from .asset_classes import asset_profile, enabled_asset_classes
from .brokers.paper import PaperBroker
from .brokers.webull_openapi import WebullOpenApiBroker
from .config import BotConfig, load_config
from .data import load_csv_bars, write_csv_bars
from .market_calendar import market_session, seconds_until_next_open
from .market_data import fetch_daily_bars
from .market_universe import fetch_us_listed_symbols, load_bundled_us_listed_symbols
from .models import OrderPlan
from .readiness import readiness_flags
from .risk import create_order_plan
from .sample_data import write_sample_bars
from .strategy import rank_signals
from .watchlist import DEFAULT_ROTATION_CANDIDATES, load_watchlist, rotate_watchlist, write_watchlist, write_watchlist_template
from .webull_watchlists import sync_generated_watchlists

AUTO_REFRESH_MS = max(30, int(os.getenv("TIMMY_DASHBOARD_REFRESH_SECONDS", "60"))) * 1000
ACCOUNT_REFRESH_MS = max(5, int(os.getenv("TIMMY_ACCOUNT_REFRESH_MINUTES", "15"))) * 60 * 1000
LIVE_PREVIEW_TTL_SECONDS = 180


class TimmyNativeApp:
    def __init__(self, home: Path) -> None:
        self.home = home
        self.data_file = home / "examples" / "sample_bars.csv"
        self.watchlist_path = home / "watchlist.txt"
        self.active_watchlist_path = home / "active-watchlist.txt"
        self.movement_watchlist_path = home / "movement-watchlist.txt"
        self.trade_ready_watchlist_path = home / "trade-ready-watchlist.txt"
        self.quiet_watchlist_path = home / "quiet-watchlist.txt"
        self.journal_path = home / "trade-journal.jsonl"
        self.event_log_path = home / "execution-events.jsonl"
        self.paper_research_path = home / "paper-training-summary.json"
        self.audit_key_path = home / ".timmy-audit-key"
        self.settings_path = home / "timmy-ui-settings.json"
        self.universe_path = home / "timmy-watchlist-universe.txt"
        self.rotation_state_path = home / "timmy-watchlist-rotation.json"
        self.crash_log_path = home / "timmy-crash.log"
        self.config: BotConfig | None = None
        self.config_error: str | None = None
        self.signals = []
        self.signal_by_symbol = {}
        self.plans = []
        self.bars_by_symbol = {}
        self.automation_after_id: str | None = None
        self.market_open_after_id: str | None = None
        self.refresh_after_id: str | None = None
        self.account_refresh_after_id: str | None = None
        self.closing = False
        self.min_score_value = 72
        self.plan_limit_value = 3
        self.auto_interval_value = 1
        self.trade_cash_snapshot: tuple[str, str] = ("-", "Run Check Webull")
        self.trade_cash_value: float | None = None
        self.account_snapshot: tuple[str, str] = ("Unknown", "Run Check Webull")
        self.nav_buttons: dict[str, tk.Button] = {}
        self.manual_controls: list[tk.Button] = []
        self.busy_controls: list[tk.Button] = []
        self.execution_events: list[dict] = []
        self.previewed_order_fingerprints: dict[str, dict] = {}
        self.recent_bad_event_counts: dict[str, int] = {}
        self._execution_events_cache_key: tuple | None = None
        self._execution_events_cache: list[dict] = []
        self.audit_status = "Audit chain ready"

        self.root = tk.Tk()
        self.root.title("Timmy")
        self.root.geometry("1280x840")
        self.root.minsize(1120, 720)
        self.colors = self._theme_palette()
        self.root.configure(bg=self.colors["bg"])
        self.min_score_var = tk.StringVar(value="72")
        self.plan_limit_var = tk.StringVar(value="3")
        self.auto_interval_var = tk.StringVar(value="1")
        self.paper_auto_var = tk.BooleanVar(value=False)
        self.execution_mode_var = tk.StringVar(value="User")
        self.execution_target_var = tk.StringVar(value="Paper")
        self.webull_account_toggle_var = tk.BooleanVar(value=False)
        self.account_lane_var = tk.StringVar(value="I-Cash")
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
        self._setup_settings_traces()
        self.root.withdraw()
        self.root.protocol("WM_DELETE_WINDOW", self.close)
        self.root.report_callback_exception = self._handle_tk_exception
        self.root.bind("<F5>", lambda _event: self.refresh_all())
        self.root.bind("<Control-r>", lambda _event: self.run_decision_cycle())

    def run(self) -> int:
        self.refresh_all()
        self._close_splash()
        self._arm_market_open_automation()
        if self.paper_auto_var.get() or self.execution_mode_var.get() == "Auto":
            self._schedule_automation()
        self.refresh_after_id = self.root.after(AUTO_REFRESH_MS, self._auto_refresh)
        self.account_refresh_after_id = self.root.after(ACCOUNT_REFRESH_MS, self._auto_account_refresh)
        self.root.mainloop()
        return 0

    def _theme_palette(self) -> dict[str, str]:
        requested = os.getenv("TIMMY_THEME", "").strip().lower()
        if requested not in {"light", "dark"}:
            gtk_theme = os.getenv("GTK_THEME", "").lower()
            color_scheme = os.getenv("COLOR_SCHEME", "").lower()
            requested = "dark" if "dark" in f"{gtk_theme} {color_scheme}" else ""
        if not requested:
            requested = "light" if self._system_background_is_light() else "dark"
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
            }
        return {
            "bg": "#111315",
            "rail": "#0a0d0f",
            "runtime": "#161b1e",
            "panel": "#1b2024",
            "panel_2": "#252b30",
            "panel_3": "#101719",
            "line": "#394247",
            "text": "#f4f1e8",
            "muted": "#b5bab7",
            "gold": "#efb64e",
            "gold_text": "#171006",
            "teal": "#42d8c7",
            "green": "#8bd58a",
            "red": "#ff6f7a",
            "button": "#2b3033",
            "button_text": "#f4f1e8",
            "teal_button": "#08746d",
            "teal_button_text": "#f3fffd",
            "selected": "#e65c4f",
            "selected_text": "#ffffff",
            "disabled": "#777f82",
            "entry": "#111619",
            "broker_text": "#dffbf7",
            "mark_text": "#16100a",
            "rail_text": "#f4f1e8",
            "rail_muted": "#929b9a",
            "rail_line": "#252b2e",
            "hot": "#ff6f7a",
            "cyan": "#42d8c7",
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
        splash.title("Timmy")
        splash.geometry("440x260")
        splash.resizable(False, False)
        splash.configure(bg=self.colors["bg"])
        splash.overrideredirect(True)
        splash.update_idletasks()
        width = splash.winfo_screenwidth()
        height = splash.winfo_screenheight()
        splash.geometry(f"440x260+{(width - 440) // 2}+{(height - 260) // 2}")
        frame = tk.Frame(splash, bg=self.colors["panel"], highlightbackground=self.colors["line"], highlightthickness=1)
        frame.pack(fill="both", expand=True, padx=1, pady=1)
        tk.Label(frame, text="T", bg=self.colors["gold"], fg=self.colors["mark_text"], font=("Sans", 28, "bold"),
                 width=2, height=1, anchor="center").pack(pady=(34, 12))
        tk.Label(frame, text="Timmy", bg=self.colors["panel"], fg=self.colors["text"],
                 font=("Sans", 24, "bold")).pack()
        self.splash_status = tk.Label(frame, text="Loading market controls", bg=self.colors["panel"], fg=self.colors["muted"],
                                      font=("Sans", 11), anchor="center", justify="center")
        self.splash_status.pack(pady=(10, 4))
        tk.Label(frame, text="Paper | Live | Guarded", bg=self.colors["panel"], fg=self.colors["gold"],
                 font=("Sans", 9, "bold")).pack(pady=(10, 0))
        splash.lift()
        splash.update()
        return splash

    def _splash_step(self, text: str) -> None:
        if getattr(self, "splash", None) and getattr(self, "splash_status", None):
            try:
                self.splash_status.configure(text=text)
                self.splash.update_idletasks()
            except tk.TclError:
                pass

    def _close_splash(self) -> None:
        self.root.deiconify()
        if getattr(self, "splash", None):
            try:
                self.splash.destroy()
            except tk.TclError:
                pass

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
        style.configure("Treeview", background=self.colors["panel"], foreground=self.colors["text"],
                        fieldbackground=self.colors["panel"], rowheight=38, borderwidth=0,
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

        rail = tk.Frame(self.root, bg=self.colors["rail"], width=236)
        rail.grid(row=0, column=0, sticky="nsew")
        rail.grid_propagate(False)
        rail.columnconfigure(0, weight=0)
        rail.columnconfigure(1, weight=1)

        rail_stripe = tk.Frame(rail, bg=self.colors["hot"], width=6)
        rail_stripe.grid(row=0, column=0, rowspan=4, sticky="nsw")
        mark = tk.Label(rail, text="T", bg=self.colors["gold"], fg=self.colors["mark_text"], font=("Sans", 22, "bold"),
                        width=2, height=1, anchor="center", justify="center", relief="flat")
        mark.grid(row=0, column=0, padx=(24, 10), pady=(24, 10), sticky="w")
        brand_box = tk.Frame(rail, bg=self.colors["rail"])
        brand_box.grid(row=0, column=1, pady=(22, 10), sticky="w")
        brand = tk.Label(brand_box, text="Timmy", bg=self.colors["rail"], fg=self.colors["rail_text"],
                         justify="left", anchor="w", font=("Sans", 15, "bold"))
        brand.pack(anchor="w")
        brand_sub = tk.Label(brand_box, text="TRADER DESK", bg=self.colors["rail"], fg=self.colors["rail_muted"],
                             justify="left", anchor="w", font=("Sans", 8, "bold"))
        brand_sub.pack(anchor="w", pady=(1, 0))

        nav_items = ["Overview", "Signals", "Automation", "Orders", "Broker", "Event Log"]
        nav = tk.Frame(rail, bg=self.colors["rail"])
        nav.grid(row=1, column=0, columnspan=2, sticky="ew", padx=20, pady=(18, 0))
        for item in nav_items:
            button = tk.Button(
                nav,
                text=item,
                command=lambda target=item: self._show_tab(target),
                bg=self.colors["selected"] if item == "Overview" else self.colors["rail"],
                fg=self.colors["selected_text"] if item == "Overview" else self.colors["rail_muted"],
                activebackground=self.colors["selected"],
                activeforeground=self.colors["selected_text"],
                relief="flat",
                anchor="center",
                justify="center",
                padx=10,
                pady=11,
                font=("Sans", 11, "bold"),
                cursor="hand2",
            )
            self._fit_text(button, min_size=9, max_size=11, padding=22, wrap=True)
            button.pack(fill="x", pady=3)
            self.nav_buttons[item] = button

        rail.rowconfigure(2, weight=1)
        runtime = tk.Frame(rail, bg=self.colors["runtime"], highlightbackground=self.colors["rail_line"], highlightthickness=1)
        runtime.grid(row=3, column=0, columnspan=2, sticky="ew", padx=20, pady=22)
        runtime_top = tk.Frame(runtime, bg=self.colors["cyan"], height=4)
        runtime_top.pack(fill="x")
        runtime_title = tk.Label(runtime, text="Runtime", bg=self.colors["runtime"], fg=self.colors["rail_muted"], anchor="center", justify="center")
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

        main = tk.Frame(self.root, bg=self.colors["bg"])
        main.grid(row=0, column=1, sticky="nsew")
        main.columnconfigure(0, weight=1)
        main.rowconfigure(3, weight=1)

        hero = tk.Frame(main, bg=self.colors["panel"], highlightbackground=self.colors["line"], highlightthickness=1)
        hero.grid(row=0, column=0, sticky="ew", padx=24, pady=(24, 14))
        hero.columnconfigure(0, weight=1)
        hero.columnconfigure(1, weight=0)
        accent = tk.Frame(hero, bg=self.colors["hot"], width=7)
        accent.grid(row=0, column=0, rowspan=3, sticky="nsw")
        cyan_rule = tk.Frame(hero, bg=self.colors["cyan"], height=4)
        cyan_rule.grid(row=3, column=0, columnspan=2, sticky="ew")
        hero_eyebrow = tk.Label(hero, text="WEBULL PREVIEW AND RISK CONTROL", bg=self.colors["panel"],
                                fg=self.colors["teal"], font=("Sans", 9, "bold"), anchor="w", justify="left")
        self._fit_text(hero_eyebrow, min_size=8, max_size=9, padding=56, wrap=True)
        hero_eyebrow.grid(row=0, column=0, sticky="ew", padx=(30, 24), pady=(20, 0))
        hero_title = tk.Label(hero, text="Timmy", bg=self.colors["panel"], fg=self.colors["text"],
                              font=("Sans", 31, "bold"), anchor="w", justify="left")
        self._fit_text(hero_title, min_size=24, max_size=31, padding=56, wrap=True)
        hero_title.grid(row=1, column=0, sticky="ew", padx=(30, 24), pady=(2, 0))
        hero_copy = tk.Label(
            hero,
            text="Scout movement, rank setups, set buy-low/sell-high limits, and keep live execution gated by account, preview, and risk controls.",
            bg=self.colors["panel"],
            fg=self.colors["muted"],
            font=("Sans", 12),
            justify="left",
            anchor="w",
        )
        self._fit_text(hero_copy, min_size=10, max_size=12, padding=56, wrap=True)
        hero_copy.grid(row=2, column=0, sticky="ew", padx=(30, 24), pady=(7, 20))
        actions = tk.Frame(hero, bg=self.colors["panel_3"], highlightbackground=self.colors["line"], highlightthickness=1)
        actions.grid(row=0, column=1, rowspan=3, sticky="e", padx=(0, 24), pady=18)
        self.refresh_button = self._button(actions, "Refresh", self.refresh_all)
        self.refresh_button.pack(fill="x", pady=(0, 7))
        self.webull_check_button = self._button(
            actions,
            "Check Webull",
            lambda: self._run_action("Checking Webull", self.webull_check),
            accent="teal",
        )
        self.webull_check_button.pack(fill="x", pady=7)
        self.preview_button = self._button(actions, "Preview Order", lambda: self._run_action("Previewing order", self.webull_preview, threaded=False),
                                           accent="gold")
        self.preview_button.pack(fill="x", pady=(7, 0))
        self.manual_controls.append(self.preview_button)
        self.busy_controls.extend([self.refresh_button, self.webull_check_button, self.preview_button])

        metrics = tk.Frame(main, bg=self.colors["bg"])
        metrics.grid(row=1, column=0, sticky="ew", padx=24, pady=(0, 14))
        for idx in range(3):
            metrics.columnconfigure(idx, weight=1)
        self.mode_card = self._metric(metrics, 0, 0, "Mode")
        self.account_card = self._metric(metrics, 0, 1, "Webull Account")
        self.cash_card = self._metric(metrics, 0, 2, "Buying Power", highlight=True)
        self.notional_card = self._metric(metrics, 1, 0, "Max Notional")
        self.risk_card = self._metric(metrics, 1, 1, "Risk / Trade")

        controls = self._panel(main)
        controls.grid(row=2, column=0, sticky="ew", padx=24, pady=(0, 14))
        for idx in range(6):
            controls.columnconfigure(idx, weight=1, minsize=118)
        controls_title = tk.Label(controls, text="Controls", bg=self.colors["panel"], fg=self.colors["text"],
                                  font=("Sans", 13, "bold"), anchor="w", justify="left")
        controls_title.grid(row=0, column=0, columnspan=2, sticky="ew", padx=18, pady=(14, 0))
        controls_status = tk.Label(controls, text="Preview, cash, score, and live switches stay in command.",
                                   bg=self.colors["panel"], fg=self.colors["muted"], font=("Sans", 9),
                                   anchor="e", justify="right")
        controls_status.grid(row=0, column=2, columnspan=4, sticky="ew", padx=18, pady=(14, 0))
        self._control_entry(controls, 0, "Score", self.min_score_var)
        self._control_entry(controls, 1, "Plans", self.plan_limit_var)
        self._control_entry(controls, 2, "Minutes", self.auto_interval_var)
        self.guard_label = tk.Label(controls, text="Live orders locked", bg=self.colors["panel"], fg=self.colors["gold"],
                                    font=("Sans", 10, "bold"), anchor="center", justify="center")
        self._fit_text(self.guard_label, min_size=8, max_size=10, padding=18, wrap=True)
        self.guard_label.grid(row=1, column=3, sticky="ew", padx=10, pady=14)
        self.eligible_label = tk.Label(controls, text="Eligible: -", bg=self.colors["panel"], fg=self.colors["teal"],
                                       font=("Sans", 10, "bold"), anchor="center", justify="center")
        self._fit_text(self.eligible_label, min_size=8, max_size=10, padding=18, wrap=True)
        self.eligible_label.grid(row=1, column=4, sticky="ew", padx=10, pady=14)
        paper_auto = tk.Checkbutton(controls, text="Paper auto", variable=self.paper_auto_var, command=self._sync_automation,
                                    bg=self.colors["panel"], fg=self.colors["text"], selectcolor=self.colors["panel_2"],
                                    activebackground=self.colors["panel"], activeforeground=self.colors["text"],
                                    disabledforeground=self.colors["disabled"],
                                    font=("Sans", 10, "bold"), justify="center")
        self._fit_text(paper_auto, min_size=8, max_size=10, padding=24, wrap=True)
        paper_auto.grid(row=1, column=5, sticky="ew", padx=10)
        target_box = tk.Frame(controls, bg=self.colors["panel"])
        target_box.grid(row=2, column=0, sticky="ew", padx=10, pady=(0, 14))
        target_label = tk.Label(target_box, text="Target", bg=self.colors["panel"], fg=self.colors["muted"],
                                font=("Sans", 9, "bold"), anchor="center", justify="center")
        self._fit_text(target_label, min_size=8, max_size=9, padding=10, wrap=True)
        target_label.pack(fill="x")
        target_radios = tk.Frame(target_box, bg=self.colors["panel"])
        target_radios.pack(anchor="center", pady=(4, 0))
        for label in ("Paper", "Live"):
            tk.Radiobutton(
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
                command=self._sync_manual_controls,
            ).pack(side="left", padx=(0, 8))
        mode_box = tk.Frame(controls, bg=self.colors["panel"])
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
                command=self._sync_manual_controls,
            ).pack(side="left", padx=(0, 8))
        account_box = tk.Frame(controls, bg=self.colors["panel"])
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
        button_box.grid(row=2, column=3, columnspan=3, sticky="ew", padx=10, pady=(0, 14))
        button_box.columnconfigure((0, 1, 2, 3), weight=1)
        self.run_button = self._button(button_box, "Run", self.run_decision_cycle, accent="teal")
        self.run_button.grid(row=0, column=0, sticky="ew", padx=(0, 7))
        self.live_button = self._button(button_box, "Live", self.submit_live_interactive, accent="gold")
        self.live_button.grid(row=0, column=1, sticky="ew", padx=7)
        self.stop_button = self._button(button_box, "Stop", self.stop_automation)
        self.stop_button.grid(row=0, column=2, sticky="ew", padx=7)
        self.power_cycle_button = self._button(button_box, "Power Cycle", self.power_cycle)
        self.power_cycle_button.grid(row=0, column=3, sticky="ew", padx=(7, 0))
        self.manual_controls.extend([self.run_button, self.live_button])
        self.busy_controls.extend([self.run_button, self.live_button, self.power_cycle_button])

        style_box = tk.Frame(controls, bg=self.colors["panel"])
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
        body.grid(row=3, column=0, sticky="nsew", padx=24, pady=(0, 24))
        body.columnconfigure(0, weight=3)
        body.columnconfigure(1, weight=2)
        body.rowconfigure(0, weight=1)

        signals_panel = self._panel(body)
        self.signals_panel = signals_panel
        signals_panel.grid(row=0, column=0, sticky="nsew", padx=(0, 18))
        signals_panel.rowconfigure(1, weight=1)
        signals_panel.rowconfigure(2, weight=0)
        self._section_header(signals_panel, "RANKED SCANNER", "Signal Board", "Refresh Data",
                             self.refresh_data)
        columns = ("symbol", "scout", "score", "sense", "direction", "decision", "price", "change", "entry")
        self.signal_tree = ttk.Treeview(signals_panel, columns=columns, show="headings", selectmode="browse")
        headings = {
            "symbol": "Symbol", "scout": "Scout", "score": "Score", "sense": "Sensible", "direction": "Bias",
            "decision": "Decision", "price": "Price Gate", "change": "Move", "entry": "Buy Limit",
        }
        widths = {
            "symbol": 72, "scout": 78, "score": 58, "sense": 92, "direction": 74,
            "decision": 80, "price": 96, "change": 74, "entry": 86,
        }
        for key in columns:
            anchor = "w" if key == "symbol" else "center"
            self.signal_tree.heading(key, text=headings[key], anchor="center")
            self.signal_tree.column(key, width=widths[key], anchor=anchor)
        self.signal_tree.grid(row=1, column=0, sticky="nsew", padx=18, pady=(0, 18))
        self.signal_tree.bind("<<TreeviewSelect>>", self._show_selected_signal)
        self.signal_detail = tk.Text(signals_panel, height=6, bg=self.colors["panel_2"], fg=self.colors["muted"],
                                     insertbackground=self.colors["text"], relief="flat", padx=14, pady=10,
                                     font=("Monospace", 10), wrap="word")
        self.signal_detail.grid(row=2, column=0, sticky="ew", padx=18, pady=(0, 18))

        right = tk.Frame(body, bg=self.colors["bg"])
        self.right_panel = right
        right.grid(row=0, column=1, sticky="nsew")
        right.rowconfigure(0, weight=0)
        right.rowconfigure(1, weight=0)
        right.rowconfigure(2, weight=1)
        right.rowconfigure(3, weight=1)
        right.columnconfigure(0, weight=1)

        decision_panel = self._panel(right)
        self.decision_panel = decision_panel
        decision_panel.grid(row=0, column=0, sticky="ew", pady=(0, 18))
        self._section_header(decision_panel, "DECISION ENGINE", "Decision Brief", None, None, compact=True)
        self.decision_text = tk.Text(decision_panel, height=7, bg=self.colors["panel_2"], fg=self.colors["text"],
                                     insertbackground=self.colors["text"], relief="flat", padx=14, pady=12,
                                     font=("Monospace", 10), wrap="word")
        self.decision_text.grid(row=1, column=0, sticky="ew", padx=18, pady=(0, 18))

        order_panel = self._panel(right)
        self.order_panel = order_panel
        order_panel.grid(row=1, column=0, sticky="ew", pady=(0, 18))
        self.paper_trade_button = self._section_header(order_panel, "RISK CAPPED", "Order Plan", "Paper Trade",
                                                       lambda: self._run_action("Paper trade", self.paper_trade, threaded=False), compact=True)
        if self.paper_trade_button:
            self.manual_controls.append(self.paper_trade_button)
            self.busy_controls.append(self.paper_trade_button)
        self.plan_text = tk.Text(order_panel, height=7, bg=self.colors["panel_2"], fg=self.colors["text"],
                                 insertbackground=self.colors["text"], relief="flat", padx=14, pady=12,
                                 font=("Monospace", 10), wrap="word")
        self.plan_text.grid(row=1, column=0, sticky="ew", padx=18, pady=(0, 18))

        broker_panel = self._panel(right)
        self.broker_panel = broker_panel
        broker_panel.grid(row=2, column=0, sticky="nsew", pady=(0, 18))
        broker_panel.rowconfigure(1, weight=1)
        self._section_header(broker_panel, "BROKER RESPONSE", "Webull Preview", None, None, compact=True)
        self.broker_text = tk.Text(broker_panel, height=13, bg=self.colors["panel_2"], fg=self.colors["broker_text"],
                                   insertbackground=self.colors["text"], relief="flat", padx=14, pady=12,
                                   font=("Monospace", 10), wrap="word")
        self.broker_text.grid(row=1, column=0, sticky="nsew", padx=18, pady=(0, 18))

        journal_panel = self._panel(right)
        self.journal_panel = journal_panel
        journal_panel.grid(row=3, column=0, sticky="nsew")
        journal_panel.rowconfigure(1, weight=1)
        self._section_header(journal_panel, "LOCAL AUDIT", "Event Log", None, None, compact=True)
        self.journal_text = tk.Text(journal_panel, height=8, bg=self.colors["panel_2"], fg=self.colors["muted"],
                                    insertbackground=self.colors["text"], relief="flat", padx=14, pady=12,
                                    font=("Monospace", 10), wrap="word")
        self.journal_text.grid(row=1, column=0, sticky="nsew", padx=18, pady=(0, 18))

        self.status_bar = tk.Label(main, text="Ready", bg=self.colors["panel_3"], fg=self.colors["muted"],
                                   anchor="center", justify="center", padx=12, pady=8)
        self._fit_text(self.status_bar, min_size=8, max_size=10, padding=56, wrap=True)
        self.status_bar.grid(row=4, column=0, sticky="ew", padx=24, pady=(0, 8))
        self._sync_manual_controls()

    def _panel(self, parent: tk.Widget) -> tk.Frame:
        return tk.Frame(parent, bg=self.colors["panel"], highlightbackground=self.colors["line"], highlightthickness=1)

    def _show_tab(self, tab: str) -> None:
        self._set_nav_active(tab)
        self.signals_panel.grid_remove()
        self.right_panel.grid_remove()
        for panel in (self.decision_panel, self.order_panel, self.broker_panel, self.journal_panel):
            panel.grid_remove()

        self.body.columnconfigure(0, weight=1)
        self.body.columnconfigure(1, weight=1)

        if tab == "Overview":
            for row, weight in ((0, 0), (1, 0), (2, 1), (3, 1)):
                self.right_panel.rowconfigure(row, weight=weight)
            self.body.columnconfigure(0, weight=3)
            self.body.columnconfigure(1, weight=2)
            self.signals_panel.grid(row=0, column=0, sticky="nsew", padx=(0, 18))
            self.right_panel.grid(row=0, column=1, sticky="nsew")
            self.decision_panel.grid(row=0, column=0, sticky="ew", pady=(0, 18))
            self.order_panel.grid(row=1, column=0, sticky="ew", pady=(0, 18))
            self.broker_panel.grid(row=2, column=0, sticky="nsew", pady=(0, 18))
            self.journal_panel.grid(row=3, column=0, sticky="nsew")
        elif tab == "Signals":
            self.body.columnconfigure(0, weight=1)
            self.signals_panel.grid(row=0, column=0, columnspan=2, sticky="nsew", padx=0)
        else:
            for row in range(4):
                self.right_panel.rowconfigure(row, weight=1 if row == 0 else 0)
            panel_by_tab = {
                "Automation": self.decision_panel,
                "Orders": self.order_panel,
                "Broker": self.broker_panel,
                "Event Log": self.journal_panel,
            }
            panel = panel_by_tab.get(tab, self.decision_panel)
            self.right_panel.grid(row=0, column=0, columnspan=2, sticky="nsew")
            panel.grid(row=0, column=0, sticky="nsew", pady=0)

        self.status_bar.configure(text=f"{tab} tab active.")

    def _set_nav_active(self, active: str) -> None:
        for label, button in self.nav_buttons.items():
            selected = label == active
            button.configure(
                bg=self.colors["selected"] if selected else self.colors["rail"],
                fg=self.colors["selected_text"] if selected else self.colors["rail_muted"],
            )

    def _button(self, parent: tk.Widget, text: str, command, accent: str | None = None) -> tk.Button:
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
        button = tk.Button(parent, text=text, command=command, bg=bg, fg=fg, activebackground=active_bg,
                           activeforeground=fg, relief="flat", padx=16, pady=10, font=("Sans", 10, "bold"),
                           disabledforeground=self.colors["disabled"], cursor="hand2", anchor="center",
                           justify="center", highlightbackground=self.colors["line"], highlightthickness=1)
        self._fit_text(button, min_size=8, max_size=10, padding=28, wrap=True)
        return button

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
                               font=("Sans", 10), anchor="center", justify="center")
        self._fit_text(title_label, min_size=8, max_size=10, padding=36, wrap=True)
        title_label.pack(fill="x", padx=18, pady=(10, 3))
        value = tk.Label(frame, text="-", bg=self.colors["panel"], fg=self.colors["text"],
                         font=("Sans", 18, "bold"), anchor="center", justify="center")
        self._fit_text(value, min_size=12, max_size=18, padding=36, wrap=True)
        value.pack(fill="x", padx=18)
        sub = tk.Label(frame, text="-", bg=self.colors["panel"], fg=self.colors["muted"],
                       font=("Sans", 10), anchor="center", justify="center")
        self._fit_text(sub, min_size=8, max_size=10, padding=36, wrap=True)
        sub.pack(fill="x", padx=18, pady=(2, 12))
        return value, sub

    def _control_entry(self, parent: tk.Widget, column: int, title: str, variable: tk.StringVar) -> None:
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
            button = self._button(header, button_text, command, accent="teal" if button_text == "Paper Trade" else None)
            button.grid(row=0, column=1, rowspan=2, sticky="e")
            return button
        return None

    def refresh_all(self) -> None:
        if self.closing:
            return
        try:
            self.status_bar.configure(text="Refreshing...")
            self._refresh_payload()
            self.status_bar.configure(text="Refresh complete.")
        except Exception as exc:
            self.status_bar.configure(text=f"Refresh failed: {exc}")
            self._set_text(self.broker_text, str(exc))

    def refresh_data(self) -> None:
        try:
            self.status_bar.configure(text="Refreshing sample data...")
            self.data_file.parent.mkdir(parents=True, exist_ok=True)
            write_sample_bars(self.data_file)
            self._refresh_payload()
            self.status_bar.configure(text=f"Sample data refreshed at {self.data_file}")
        except Exception as exc:
            self.status_bar.configure(text=f"Data refresh failed: {exc}")

    def webull_check(self) -> str:
        config = self._execution_config(self._load_config_safe())
        broker = WebullOpenApiBroker(config)
        result = broker.account_list()
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

    def _preview_current_plans(self, config: BotConfig) -> str:
        config = self._execution_config(config)
        plans = list(self.plans)
        if not plans:
            return "No executable plans at current controls. Refresh or lower Min Score."
        broker = WebullOpenApiBroker(config)
        results = [broker.preview_order(plan) for plan in plans[: self.plan_limit_value]]
        now = datetime.now()
        self.previewed_order_fingerprints = {
            self._order_fingerprint(plan, self._latest_candle_timestamp(plan.symbol)): {
                "previewed_at": now,
                "account_id": config.webull_account_id,
                "target": self.execution_target_var.get(),
                "cash": self.trade_cash_snapshot[0],
            }
            for plan in plans[: self.plan_limit_value]
        }
        return json.dumps(results, indent=2, sort_keys=True)

    def paper_trade(self, refresh: bool = True) -> str:
        if refresh:
            self._refresh_payload()
        plans = list(self.plans)
        if not plans:
            return "No executable plans at current controls. Nothing was journaled."
        broker = PaperBroker(str(self.journal_path))
        results = [
            broker.submit(plan, self._paper_context_for_plan(plan))
            for plan in plans[: self.plan_limit_value]
        ]
        for result in results:
            self._append_execution_event(result)
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

    def live_preview_then_submit(self) -> str:
        self._refresh_payload()
        config = self._load_config_safe()
        preview_result = self._preview_current_plans(config)
        submit_result = self.live_submit(refresh=False)
        return "\n\n".join((
            "Exact Webull preview completed:",
            preview_result,
            "Live submit result:",
            submit_result,
        ))

    def live_submit(self, refresh: bool = True) -> str:
        if refresh:
            self._refresh_payload()
        config = self._execution_config(self._load_config_safe())
        plans = list(self.plans)
        if not plans:
            return "No executable plans at current controls. Live order was not submitted."
        missing_previews = [plan.symbol for plan in plans[: self.plan_limit_value] if not self._has_fresh_preview(plan, config)]
        if missing_previews:
            raise RuntimeError(
                "Live submit blocked. Preview the exact current plan first: "
                + ", ".join(missing_previews)
            )
        broker = WebullOpenApiBroker(config)
        results = [broker.submit_order(plan) for plan in plans[: self.plan_limit_value]]
        self._update_buying_power_from_broker_results(results)
        for result in results:
            self._append_execution_event(self._event_from_broker_result(result, mode="live"))
        self._render_status()
        return json.dumps(results, indent=2, sort_keys=True)

    def run_decision_cycle(self) -> None:
        try:
            self.status_bar.configure(text="Running decision cycle...")
            self._refresh_payload()
            summary = self._decision_summary()
            self._set_text(self.decision_text, summary)
            target = self.execution_target_var.get()
            mode = self.execution_mode_var.get()
            self._set_text(self.broker_text, f"Decision cycle completed for {target}. Use Preview Order to validate with Webull before any live workflow.")
            if target == "Live" and mode == "Auto" and self.plans:
                self.status_bar.configure(text="Decision cycle complete. Previewing exact live order in Auto mode...")
                self._run_action("Previewing and submitting live order", self.live_preview_then_submit, threaded=False)
                return
            if target == "Paper" and (self.paper_auto_var.get() or mode == "Auto") and self.plans:
                self._set_text(self.broker_text, self.paper_trade(refresh=False))
                self._load_journal()
            self.status_bar.configure(text="Decision cycle complete.")
        except Exception as exc:
            self.status_bar.configure(text=f"Decision cycle failed: {exc}")
            self._set_text(self.broker_text, str(exc))

    def _refresh_payload(self) -> str:
        self._splash_step("Loading configuration")
        self.config = self._runtime_config(self._load_config_safe())
        self._splash_step("Reading execution journals")
        self.execution_events = self._load_execution_events()
        self.recent_bad_event_counts = self._build_bad_event_counts(self.execution_events)
        self._splash_step("Scanning market data")
        self.bars_by_symbol = self._load_bars()
        self.signals = rank_signals(self.bars_by_symbol, self.config)
        self.signal_by_symbol = {signal.symbol: signal for signal in self.signals}
        self._splash_step("Reconciling paper outcomes")
        if self._reconcile_paper_outcomes(self.bars_by_symbol):
            self.execution_events = self._load_execution_events()
            self.recent_bad_event_counts = self._build_bad_event_counts(self.execution_events)
        self._splash_step("Building trade plans")
        self.plans = self._load_plans(self.config)
        self._splash_step("Rendering dashboard")
        self._render_status()
        self._render_signals()
        self._render_plans()
        self._load_journal()
        self._write_paper_training_summary()
        return "Dashboard refreshed."

    def _load_bars(self):
        if not self.data_file.exists():
            self.data_file.parent.mkdir(parents=True, exist_ok=True)
            write_sample_bars(self.data_file)
        self._refresh_market_data_if_needed()
        try:
            return load_csv_bars(self.data_file)
        except Exception as exc:
            write_sample_bars(self.data_file)
            self.status_bar.configure(text=f"Data repaired after load error: {exc}")
            return load_csv_bars(self.data_file)

    def _refresh_market_data_if_needed(self) -> None:
        config = self.config or self._load_config_safe()
        if config.market_data_provider == "csv":
            return
        if self.data_file.exists():
            age_seconds = datetime.now().timestamp() - self.data_file.stat().st_mtime
            if age_seconds < config.market_data_max_age_minutes * 60:
                return
        watchlist_path = self._runtime_path(config.watchlist_path or self.watchlist_path)
        write_watchlist_template(watchlist_path, config.watchlist_template)
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
            )
            if bars:
                candidate_signals = rank_signals(bars, config)
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
                    self.status_bar.configure(text=f"Market data refreshed for {len(selected_bars)} custom watchlist symbols.")
                return
        symbols = load_watchlist(watchlist_path, config.symbol_whitelist)
        bars = fetch_daily_bars(
            config.market_data_provider,
            symbols,
            timeout=config.market_data_fetch_timeout_seconds,
            max_workers=config.market_data_fetch_workers,
        )
        if bars:
            write_csv_bars(self.data_file, bars)
            self.status_bar.configure(text=f"Market data refreshed for {len(bars)} symbols.")

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
        for path, symbols, export_name in outputs:
            write_watchlist(path, symbols)
            self._write_watchlist_exports(symbols, export_name)
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
            self.status_bar.configure(text=f"Webull watchlist sync failed for {len(failures)} list(s).")
            return
        synced = [result for result in results if result.status == "synced"]
        if synced:
            added = sum(result.added_count for result in synced)
            removed = sum(result.removed_count for result in synced)
            self.status_bar.configure(text=f"Webull watchlists synced: +{added} / -{removed}.")

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
                    return symbols
            except Exception as exc:
                self.status_bar.configure(text=f"Universe refresh skipped: {exc}")
        if self.universe_path.exists():
            return load_watchlist(self.universe_path, None)
        bundled = load_bundled_us_listed_symbols()
        if bundled:
            return bundled
        return sorted(DEFAULT_ROTATION_CANDIDATES)

    def _next_universe_batch(self, universe: list[str], batch_size: int) -> list[str]:
        if not universe:
            return []
        limit = max(1, min(batch_size, len(universe)))
        cursor = self._rotation_cursor()
        start = cursor % len(universe)
        end = start + limit
        if end <= len(universe):
            batch = universe[start:end]
        else:
            batch = universe[start:] + universe[: end - len(universe)]
        self._save_rotation_cursor((start + limit) % len(universe), len(universe))
        return batch

    def _rotation_cursor(self) -> int:
        try:
            state = json.loads(self.rotation_state_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return 0
        try:
            return int(state.get("cursor", 0))
        except (TypeError, ValueError):
            return 0

    def _save_rotation_cursor(self, cursor: int, universe_size: int) -> None:
        state = {
            "cursor": cursor,
            "universe_size": universe_size,
            "saved_at": datetime.now().isoformat(),
        }
        try:
            self.rotation_state_path.write_text(json.dumps(state, indent=2, sort_keys=True), encoding="utf-8")
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
        self.mode_card[0].configure(text=f"{self.execution_target_var.get()} / {self.execution_mode_var.get()}")
        self.mode_card[1].configure(text=f"{self._account_lane()} | {'Live on' if config.trader_live else 'Live locked'}")
        self.account_card[0].configure(text=self._webull_account_card_value(execution_config))
        self.account_card[1].configure(text=self._webull_account_card_detail(execution_config))
        self.cash_card[0].configure(text=self.trade_cash_snapshot[0])
        self.cash_card[1].configure(text=self.trade_cash_snapshot[1])
        self.notional_card[0].configure(text=money(config.max_order_notional_usd))
        self.notional_card[1].configure(text=f"Max qty {config.max_order_quantity:g}")
        self.risk_card[0].configure(text=money(config.risk_per_trade_usd))
        self.risk_card[1].configure(text=f"{config.max_positions} max positions")
        self.guard_label.configure(
            text="Live on" if self._live_ready(execution_config) else "Live locked",
            fg=self.colors["red"] if self._live_ready(execution_config) else self.colors["gold"],
        )
        self.eligible_label.configure(text=f"Plans {len(self.plans)}")
        self.runtime_label.configure(text="Ready" if not self.config_error else "Safe fallback")
        self.last_update_label.configure(text=self._data_freshness_line())
        self._sync_webull_account_toggle(execution_config)

    def _render_signals(self) -> None:
        self.signal_tree.delete(*self.signal_tree.get_children())
        for signal in self.signals:
            self.signal_tree.insert("", "end", values=(
                signal.symbol,
                self._scout_label(signal),
                signal.score,
                self._sensible_label(signal),
                signal.direction,
                signal.decision,
                self._price_gate_label(signal),
                f"{signal.change_pct:+.2f}%",
                money(signal.entry),
            ))
        if self.signals:
            first = self.signal_tree.get_children()[0]
            self.signal_tree.selection_set(first)
            self.signal_tree.focus(first)
            self._show_selected_signal()

    def _render_plans(self) -> None:
        lines = []
        if self.config_error:
            lines.append(f"Config fallback active:\n{self.config_error}")
        for plan in self.plans:
            lines.append(
                f"{plan.side} {_format_quantity(plan.quantity)} {plan.symbol} {plan.instrument_type} {plan.order_type}\n"
                f"Limit {money(plan.limit_price)} | Notional {money(plan.notional)}\n"
                f"Stop {money(plan.stop_price)} | Target {money(plan.target_price)}\n"
                f"{plan.reason}"
            )
        self._set_text(self.plan_text, "\n\n".join(lines) if lines else "No eligible plans at current risk settings.")
        self._set_text(self.decision_text, self._decision_summary())

    def _load_journal(self) -> None:
        events = self.execution_events
        if not events:
            self._set_text(self.journal_text, f"{self.audit_status}\n\nNo buy/sell events recorded.")
            return
        lines = [self.audit_status, ""]
        for event in reversed(events[-14:]):
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
        if not self.journal_path.exists() or not bars_by_symbol:
            return False
        lines = self.journal_path.read_text(encoding="utf-8", errors="replace").splitlines()
        updated_lines: list[str] = []
        changed = False
        for line in lines:
            if not line.strip():
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                updated_lines.append(line)
                continue
            if event.get("mode") != "paper" or event.get("sell_status") != "target-pending":
                updated_lines.append(json.dumps(event, sort_keys=True))
                continue
            outcome = self._paper_outcome_for_event(event, bars_by_symbol)
            if outcome:
                event.update(outcome)
                changed = True
                self._append_execution_event({
                    **event,
                    "event_type": "paper-outcome",
                    "status": outcome["status"],
                    "recorded_at": datetime.now().isoformat(),
                })
            updated_lines.append(json.dumps(event, sort_keys=True))
        if changed:
            self.journal_path.write_text("\n".join(updated_lines) + "\n", encoding="utf-8")
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
        self.paper_research_path.write_text(json.dumps(summary, indent=2, sort_keys=True), encoding="utf-8")

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
            "Auto Webull balance refresh",
            "Previewing order",
            "Paper trade",
            "Submitting live order",
            "Previewing and submitting live order",
        }:
            self._set_text(self.broker_text, result)
        if label in {"Checking Webull", "Auto Webull balance refresh"}:
            self.cash_card[0].configure(text=self.trade_cash_snapshot[0])
            self.cash_card[1].configure(text=self.trade_cash_snapshot[1])
            self._render_status()
        if label == "Paper trade":
            self._load_journal()
        self.status_bar.configure(text=f"{label} complete.")
        self._set_buttons_state("normal")
        self._sync_manual_controls()

    def _handle_tk_exception(self, exc_type, exc_value, exc_traceback) -> None:
        details = "".join(traceback.format_exception(exc_type, exc_value, exc_traceback))
        self._write_crash_log(details)
        try:
            self.status_bar.configure(text=f"Recovered UI error: {exc_value}")
            self._set_text(self.broker_text, details)
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
        self.status_bar.configure(text=f"{label} failed: {exc}")
        self._set_text(self.broker_text, str(exc))
        self._set_buttons_state("normal")
        self._sync_manual_controls()

    def _set_buttons_state(self, state: str) -> None:
        for button in self.busy_controls:
            try:
                button.configure(state=state)
            except tk.TclError:
                pass

    def _sync_manual_controls(self) -> None:
        locked = self.execution_mode_var.get() == "Auto"
        config = self._execution_config(self.config or self._load_config_safe())
        live_target = self.execution_target_var.get() == "Live"
        has_plans = bool(self.plans)
        for button in self.manual_controls:
            state = "disabled" if locked else "normal"
            if button is self.preview_button and not has_plans:
                state = "disabled"
            if button is self.paper_trade_button and not has_plans:
                state = "disabled"
            if button is self.live_button and (not has_plans or not self._live_ready(config)):
                state = "disabled"
            if button is self.preview_button and live_target and not config.webull_account_id:
                state = "disabled"
            try:
                button.configure(state=state)
            except tk.TclError:
                pass
        if locked:
            self.status_bar.configure(text="Auto mode active. Manual execution controls locked.")
        self._sync_webull_account_toggle(config)

    def _toggle_webull_account_target(self) -> None:
        config = self._execution_config(self.config or self._load_config_safe())
        if self.webull_account_toggle_var.get():
            if not config.webull_account_id:
                self.execution_target_var.set("Paper")
                self.webull_account_toggle_var.set(False)
                self.status_bar.configure(text="Webull account is not configured. Target remains Paper.")
            else:
                self.execution_target_var.set("Live")
                self.status_bar.configure(text=f"Webull account selected: {self._mask_account_id(config.webull_account_id)}")
        else:
            self.execution_target_var.set("Paper")
            self.status_bar.configure(text="Paper target selected. Webull account is visible but not active for execution.")
        self._sync_manual_controls()
        self._render_status()

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

    def _sync_webull_account_toggle(self, config: BotConfig) -> None:
        toggle = getattr(self, "webull_account_toggle", None)
        if toggle is None:
            return
        selected = self.execution_target_var.get() == "Live" and bool(config.webull_account_id)
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
        account = self.account_snapshot[0] if self.account_snapshot[0] != "Unknown" else "Configured"
        masked = self._mask_account_id(config.webull_account_id)
        target = "Live" if self.execution_target_var.get() == "Live" else "Paper"
        return f"{self._account_lane()} Account\n{target}: {account} {masked}"

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
        detail = self.account_snapshot[1] if self.account_snapshot[1] != "Run Check Webull" else "Run Check Webull"
        return f"{self._account_lane()} | {target} | {masked} | {detail}"[:40]

    def _show_selected_signal(self, _event=None) -> None:
        selection = self.signal_tree.selection()
        if not selection:
            self._set_text(self.signal_detail, "Select a signal to inspect the decision inputs.")
            return
        symbol = self.signal_tree.item(selection[0], "values")[0]
        signal = self.signal_by_symbol.get(symbol)
        if signal is None:
            return
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
        latest = self._latest_global_candle_timestamp()
        if latest is None:
            return "Data: no candles loaded"
        age = datetime.now() - latest
        days = max(0, age.days)
        label = latest.strftime("%Y-%m-%d %H:%M")
        if self._data_is_stale():
            return f"Data: stale latest candle {label} ({days}d old)"
        return f"Data: latest candle {label}"

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
            "Submit the following live order plan?",
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
        return preview.get("account_id") == config.webull_account_id

    def _execution_config(self, config: BotConfig) -> BotConfig:
        account_id = self._selected_account_id(config)
        if account_id == config.webull_account_id:
            return config
        if not is_dataclass(config):
            return config
        return replace(config, webull_account_id=account_id)

    def _selected_account_id(self, config: BotConfig) -> str | None:
        if self._account_lane() == "Crypto" and self._crypto_account_is_separate(config):
            return self._crypto_account_id(config)
        return self._icash_account_id(config)

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
            1,
            max(1, config.max_positions),
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
        except (OSError, json.JSONDecodeError):
            return
        self.min_score_var.set(str(self._coerce_int(settings.get("min_score"), 72, 0, 100)))
        self.plan_limit_var.set(str(self._coerce_int(settings.get("plan_limit"), 3, 1, 20)))
        self.auto_interval_var.set(str(self._coerce_int(settings.get("auto_interval_minutes"), 1, 1, 60)))
        if settings.get("execution_mode") in {"User", "Auto"}:
            self.execution_mode_var.set(settings["execution_mode"])
        if settings.get("execution_target") in {"Paper", "Live"}:
            self.execution_target_var.set(settings["execution_target"])
        if settings.get("account_lane") in {"I-Cash", "Crypto"}:
            self.account_lane_var.set(settings["account_lane"])
        style = str(settings.get("trading_style", "Adaptive")).strip().title()
        if style in {"Adaptive", "Aggressive", "Balanced", "Conservative"}:
            self.trading_style_var.set(style)
        patterns = settings.get("patterns")
        if isinstance(patterns, list):
            enabled = {str(item).strip().lower() for item in patterns}
            for key, var in self.pattern_vars.items():
                var.set(key in enabled)

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

    def _settings_changed(self) -> None:
        self._save_runtime_settings()

    def _save_runtime_settings(self) -> None:
        settings = {
            "min_score": self._coerce_int(self.min_score_var.get(), 72, 0, 100),
            "plan_limit": self._coerce_int(self.plan_limit_var.get(), 3, 1, 20),
            "auto_interval_minutes": self._coerce_int(self.auto_interval_var.get(), 1, 1, 60),
            "paper_auto": bool(self.paper_auto_var.get()),
            "execution_mode": self.execution_mode_var.get(),
            "execution_target": self.execution_target_var.get(),
            "account_lane": self.account_lane_var.get(),
            "trading_style": self.trading_style_var.get(),
            "patterns": sorted(self._runtime_strategy_patterns()),
            "saved_at": datetime.now().isoformat(),
        }
        try:
            self.settings_path.write_text(json.dumps(settings, indent=2, sort_keys=True), encoding="utf-8")
        except OSError:
            pass

    @staticmethod
    def _coerce_int(value, fallback: int, minimum: int, maximum: int) -> int:
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            parsed = fallback
        return max(minimum, min(maximum, parsed))

    def _sync_automation(self) -> None:
        if self.paper_auto_var.get():
            self.status_bar.configure(text="Paper automation armed.")
            self._schedule_automation()
        else:
            self.stop_automation()

    def _arm_market_open_automation(self) -> None:
        config = self.config or self._load_config_safe()
        paper_enabled = config.auto_start_paper_on_market_open and config.trader_mode == "paper"
        live_enabled = config.auto_start_live_on_market_open and self._live_ready(config)
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
        if self.closing:
            return
        config = self.config or self._load_config_safe()
        paper_enabled = config.auto_start_paper_on_market_open and config.trader_mode == "paper"
        live_enabled = config.auto_start_live_on_market_open and self._live_ready(config)
        if not paper_enabled and not live_enabled:
            return
        if not self._regular_market_open_now():
            self.status_bar.configure(text="Waiting for market open.")
            self._schedule_market_open_check(config)
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
        previous_target = self.execution_target_var.get()
        if paper_enabled:
            self.execution_target_var.set("Paper")
            self._refresh_payload()
            if self.plans:
                self._set_text(self.broker_text, self.paper_trade(refresh=False))
                self._load_journal()
        if live_enabled:
            self.execution_target_var.set("Live")
            self._refresh_payload()
            if self.plans:
                self._run_action("Previewing and submitting live order", self.live_preview_then_submit, threaded=False)
                return
        self.execution_target_var.set(previous_target if not live_enabled else "Live")
        self.status_bar.configure(text="Market-open automation cycle complete.")

    def _schedule_automation(self) -> None:
        if self.closing:
            return
        if self.automation_after_id:
            self.root.after_cancel(self.automation_after_id)
        self.auto_interval_value = self._bounded_int(self.auto_interval_var, 1, 1, 60)
        self.automation_after_id = self.root.after(self.auto_interval_value * 60_000, self._automation_tick)

    def _automation_tick(self) -> None:
        self.automation_after_id = None
        auto_enabled = self.paper_auto_var.get() or self.execution_mode_var.get() == "Auto"
        if self.closing or not auto_enabled:
            return
        self.run_decision_cycle()
        self._schedule_automation()

    def stop_automation(self) -> None:
        self.paper_auto_var.set(False)
        self.execution_mode_var.set("User")
        if self.automation_after_id:
            self.root.after_cancel(self.automation_after_id)
            self.automation_after_id = None
        self._sync_manual_controls()
        self.status_bar.configure(text="Automation stopped.")

    def _set_text(self, widget: tk.Text, value: str) -> None:
        widget.configure(state="normal")
        widget.delete("1.0", "end")
        widget.insert("1.0", value)
        widget.configure(state="disabled")

    def _append_execution_event(self, event: dict) -> None:
        payload = dict(event)
        payload.setdefault("recorded_at", datetime.now().isoformat())
        payload["prev_hash"] = self._last_audit_hash()
        payload["event_hash"] = self._event_signature(payload, payload["prev_hash"])
        self.event_log_path.parent.mkdir(parents=True, exist_ok=True)
        with self.event_log_path.open("a", encoding="utf-8") as file:
            file.write(json.dumps(payload, sort_keys=True) + "\n")
        self.execution_events.append(payload)
        self.recent_bad_event_counts = self._build_bad_event_counts(self.execution_events)
        self._execution_events_cache_key = None

    def _load_execution_events(self) -> list[dict]:
        cache_key = self._event_files_cache_key()
        if cache_key == self._execution_events_cache_key:
            return list(self._execution_events_cache)
        events: list[dict] = []
        seen: set[tuple[str, str, str]] = set()
        self.audit_status = "Audit chain ready"
        for path in (self.journal_path, self.event_log_path):
            if not path.exists():
                continue
            lines = self._tail_lines(path, 500)
            if path == self.event_log_path:
                lines = self._validate_audit_lines(path.read_text(encoding="utf-8", errors="replace").splitlines())[-500:]
            for line in lines:
                if not line.strip():
                    continue
                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    continue
                order = event.get("order", {})
                key = (
                    str(event.get("submitted_at") or event.get("recorded_at") or ""),
                    str(event.get("symbol") or order.get("symbol") or ""),
                    str(event.get("status") or ""),
                )
                if key in seen:
                    continue
                seen.add(key)
                events.append(event)
        self._execution_events_cache_key = cache_key
        self._execution_events_cache = list(events)
        return events

    def _event_files_cache_key(self) -> tuple:
        key = []
        for path in (self.journal_path, self.event_log_path):
            try:
                stat = path.stat()
                key.append((str(path), stat.st_mtime_ns, stat.st_size))
            except FileNotFoundError:
                key.append((str(path), 0, 0))
        return tuple(key)

    def _validate_audit_lines(self, lines: list[str]) -> list[str]:
        validated: list[str] = []
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
        return validated

    @staticmethod
    def _tail_lines(path: Path, limit: int) -> list[str]:
        return path.read_text(encoding="utf-8", errors="replace").splitlines()[-limit:]

    def _event_from_broker_result(self, result: dict, mode: str) -> dict:
        plan = result.get("order_plan") or {}
        status = self._broker_event_status(result)
        return {
            "mode": mode,
            "robot": "Timmy",
            "recorded_at": datetime.now().isoformat(),
            "submitted_at": datetime.now().isoformat(),
            "event_type": "buy-order",
            "status": status,
            "symbol": plan.get("symbol"),
            "quantity": plan.get("quantity"),
            "buy_price": plan.get("limit_price"),
            "sell_target_price": plan.get("target_price"),
            "stop_price": plan.get("stop_price"),
            "sold_price": None,
            "sell_status": "target-pending" if status == "accepted" else "not-opened",
            "broker_error": result.get("error"),
            "broker_body": result.get("body"),
        }

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
        if raw_status in {"preview-required", "rejected", "failed", "accepted"}:
            return raw_status
        status_code = result.get("status_code")
        try:
            code = int(status_code)
        except (TypeError, ValueError):
            code = 0
        body = result.get("body")
        body_text = json.dumps(body, sort_keys=True).lower() if isinstance(body, (dict, list)) else str(body).lower()
        if code and not 200 <= code < 300:
            return "rejected"
        if any(word in body_text for word in ("reject", "rejected", "error", "failed", "insufficient")):
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
        if not self.audit_key_path.exists():
            self.audit_key_path.parent.mkdir(parents=True, exist_ok=True)
            self.audit_key_path.write_text(secrets.token_hex(32), encoding="utf-8")
            self.audit_key_path.chmod(0o600)
        return self.audit_key_path.read_text(encoding="utf-8").strip().encode("utf-8")

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
            if any(word in status for word in ("reject", "fail", "cancel", "error")):
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
        candidates = self._flatten_money_fields(account if account is not None else body)
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
            "buying_power": "Buying power",
            "buyingpower": "Buying power",
            "day_trading_buying_power": "Day-trade buying power",
            "overnight_buying_power": "Overnight buying power",
            "settled_cash": "Settled cash",
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
        return [str(launcher)]
    return [sys.executable, "-m", "trend_trader.desktop"]
