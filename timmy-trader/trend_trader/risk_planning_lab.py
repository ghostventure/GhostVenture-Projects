"""Read-only portfolio risk and order-plan review workspace for the desktop GUI."""
from __future__ import annotations

import math
import tkinter as tk
from tkinter import ttk

from .asset_classes import asset_profile


def _money(value: float | None) -> str:
    if value is None or not math.isfinite(value):
        return "—"
    return f"${value:,.2f}"


def _number(value: object) -> float | None:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if math.isfinite(parsed) else None


def _correlation(left: list[float], right: list[float]) -> float | None:
    size = min(len(left), len(right))
    if size < 3:
        return None
    left, right = left[-size:], right[-size:]
    mean_left = sum(left) / size
    mean_right = sum(right) / size
    cov = sum((a - mean_left) * (b - mean_right) for a, b in zip(left, right))
    den_left = math.sqrt(sum((a - mean_left) ** 2 for a in left))
    den_right = math.sqrt(sum((b - mean_right) ** 2 for b in right))
    if den_left <= 0 or den_right <= 0:
        return None
    return cov / (den_left * den_right)


def _aligned_returns(left_bars, right_bars) -> tuple[list[float], list[float]]:
    def index(bars):
        result = {}
        for bar in bars or []:
            close = _number(getattr(bar, "close", None))
            stamp = getattr(bar, "timestamp", None)
            if close and close > 0 and stamp is not None:
                result[str(stamp.date())] = close
        return result
    left, right = index(left_bars), index(right_bars)
    dates = sorted(set(left) & set(right))[-31:]
    if len(dates) < 4:
        return [], []
    left_returns, right_returns = [], []
    for previous, current in zip(dates, dates[1:]):
        left_returns.append(math.log(left[current] / left[previous]))
        right_returns.append(math.log(right[current] / right[previous]))
    return left_returns, right_returns


class RiskPlanningLab:
    """Tk review-only workspace. It never writes or submits an OrderPlan."""

    def __init__(self, parent: tk.Misc, app) -> None:
        self.app = app
        self.colors = app.colors
        self.window = tk.Toplevel(parent)
        self.window.title("Risk & Trade Planning Lab · Review Only")
        self.window.geometry("1120x820")
        self.window.minsize(900, 650)
        self.window.transient(parent)
        self.window.configure(bg=self.colors["panel"])
        self.window.columnconfigure(0, weight=1)
        self.window.rowconfigure(1, weight=1)
        self.selected_index = 0
        self.diff_reviewed = False
        self.plan_keys: list[str] = []
        self.plan_by_key = {}
        self._build_header()
        self.notebook = ttk.Notebook(self.window)
        self.notebook.grid(row=1, column=0, sticky="nsew", padx=14, pady=(0, 14))
        self.comparison_tab = ttk.Frame(self.notebook)
        self.risk_tab = ttk.Frame(self.notebook)
        self.exposure_tab = ttk.Frame(self.notebook)
        self.scenarios_tab = ttk.Frame(self.notebook)
        self.readiness_tab = ttk.Frame(self.notebook)
        for frame in (self.comparison_tab, self.risk_tab, self.exposure_tab, self.scenarios_tab, self.readiness_tab):
            frame.columnconfigure(0, weight=1)
        self.comparison_tab.rowconfigure(1, weight=1)
        for row in (0, 1):
            self.risk_tab.rowconfigure(row, weight=1)
            self.exposure_tab.rowconfigure(row, weight=1)
            self.scenarios_tab.rowconfigure(row, weight=1)
        self.readiness_tab.rowconfigure(0, weight=1)
        self.notebook.add(self.comparison_tab, text="Plan review")
        self.notebook.add(self.risk_tab, text="Risk & sizing")
        self.notebook.add(self.exposure_tab, text="Exposure & correlation")
        self.notebook.add(self.scenarios_tab, text="Scenarios & impact")
        self.notebook.add(self.readiness_tab, text="Pre-submit checklist")
        self._build_comparison_tab()
        self._build_risk_tab()
        self._build_exposure_tab()
        self._build_scenarios_tab()
        self._build_readiness_tab()
        self._reload_data()
        self.window.bind("<Escape>", lambda _event: self.window.destroy())

    def _build_header(self) -> None:
        header = tk.Frame(self.window, bg=self.colors["panel"])
        header.grid(row=0, column=0, sticky="ew", padx=20, pady=14)
        header.columnconfigure(0, weight=1)
        tk.Label(header, text="RISK & TRADE PLANNING LAB", bg=self.colors["panel"],
                 fg=self.colors["teal"], font=("Sans", 10, "bold"), anchor="w").grid(row=0, column=0, sticky="ew")
        tk.Label(header, text="Compare plans, inspect downside, and review hypothetical changes before taking action.",
                 bg=self.colors["panel"], fg=self.colors["text"], font=("Sans", 15, "bold"),
                 anchor="w", justify="left", wraplength=850).grid(row=1, column=0, sticky="ew", pady=(3, 0))
        selector = tk.Frame(header, bg=self.colors["panel"])
        selector.grid(row=2, column=0, sticky="w", pady=(8, 0))
        tk.Label(selector, text="Selected plan", bg=self.colors["panel"], fg=self.colors["muted"]).pack(side="left", padx=(0, 8))
        self.plan_selector_var = tk.StringVar()
        self.plan_selector = ttk.Combobox(selector, textvariable=self.plan_selector_var, state="readonly", width=32)
        self.plan_selector.pack(side="left")
        self.plan_selector.bind("<<ComboboxSelected>>", self._on_plan_selected)
        tk.Button(header, text="Refresh review data", command=self._reload_data,
                  bg=self.colors["button"], fg=self.colors["text"], relief="flat", padx=12, pady=8).grid(
                      row=0, column=1, rowspan=2, sticky="e", padx=(12, 0))

    def _section(self, parent, title: str, copy: str = "") -> tk.Frame:
        frame = tk.LabelFrame(parent, text=title, bg=self.colors["panel"], fg=self.colors["teal"],
                              font=("Sans", 10, "bold"), padx=12, pady=10)
        if copy:
            tk.Label(frame, text=copy, bg=self.colors["panel"], fg=self.colors["muted"],
                     anchor="w", justify="left", wraplength=980).pack(fill="x", pady=(0, 8))
        return frame

    def _tree(self, parent, columns, headings, *, height=7, widths=None):
        tree = ttk.Treeview(parent, columns=columns, show="headings", height=height)
        widths = widths or {}
        for key, heading in zip(columns, headings):
            tree.heading(key, text=heading)
            tree.column(key, width=widths.get(key, 120), minwidth=70, anchor="w" if key in {"symbol", "group", "plan"} else "e")
        tree.pack(fill="both", expand=True)
        return tree

    def _build_comparison_tab(self) -> None:
        board = self._section(self.comparison_tab, "Order-plan comparison board",
                              "The active queue is shown as generated. These values are a review snapshot; this lab never changes the queue.")
        board.grid(row=0, column=0, sticky="nsew", padx=12, pady=12)
        board.columnconfigure(0, weight=1)
        self.plan_tree = self._tree(board, ("plan", "side", "quantity", "entry", "notional", "stoprisk", "rewardrisk"),
                                    ("Plan", "Side", "Quantity", "Entry", "Notional", "Stop risk", "Reward / risk"),
                                    height=6, widths={"plan": 150, "side": 70, "quantity": 95, "entry": 95, "notional": 110, "stoprisk": 110, "rewardrisk": 115})
        self.plan_tree.bind("<<TreeviewSelect>>", self._on_board_select)
        review = ttk.Frame(self.comparison_tab)
        review.grid(row=1, column=0, sticky="nsew", padx=12, pady=(0, 12))
        review.columnconfigure(0, weight=1)
        review.columnconfigure(1, weight=1)
        change_box = self._section(review, "Review a hypothetical plan change")
        change_box.grid(row=0, column=0, sticky="nsew", padx=(0, 6))
        change_box.columnconfigure(1, weight=1)
        tk.Label(change_box, text="Edit these local review fields, then inspect the field-by-field diff. Nothing is saved to the active plan.",
                 bg=self.colors["panel"], fg=self.colors["muted"], anchor="w", justify="left", wraplength=440).grid(
                     row=0, column=0, columnspan=2, sticky="ew", pady=(0, 8))
        self.change_vars = {name: tk.StringVar() for name in ("quantity", "entry", "stop", "target")}
        labels = (("quantity", "Quantity"), ("entry", "Entry / limit"), ("stop", "Stop"), ("target", "Target"))
        for row, (key, title) in enumerate(labels, start=1):
            tk.Label(change_box, text=title, bg=self.colors["panel"], fg=self.colors["muted"], anchor="w").grid(
                row=row, column=0, sticky="w", padx=(0, 10), pady=4)
            entry = tk.Entry(change_box, textvariable=self.change_vars[key], bg=self.colors["entry"],
                             fg=self.colors["text"], insertbackground=self.colors["text"], relief="flat", width=18)
            entry.grid(row=row, column=1, sticky="ew", pady=4, ipady=4)
            self.change_vars[key].trace_add("write", lambda *_args: self._plan_edit_changed())
        self.diff_text = tk.Text(change_box, height=7, bg=self.colors["panel_2"], fg=self.colors["text"],
                                 wrap="word", relief="flat", state="disabled", padx=8, pady=8)
        self.diff_text.grid(row=5, column=0, columnspan=2, sticky="nsew", pady=(8, 6))
        change_box.rowconfigure(5, weight=1)
        self.review_ack = tk.BooleanVar(value=False)
        tk.Checkbutton(change_box, text="I reviewed this hypothetical diff", variable=self.review_ack,
                       command=self._review_ack_changed, bg=self.colors["panel"], fg=self.colors["text"],
                       selectcolor=self.colors["panel_2"], activebackground=self.colors["panel"],
                       activeforeground=self.colors["text"], anchor="w").grid(row=6, column=0, columnspan=2, sticky="w")
        chart_box = self._section(review, "Stop / target and risk-to-reward view",
                                  "The visual reflects the hypothetical fields on the left; values are not a forecast.")
        chart_box.grid(row=0, column=1, sticky="nsew", padx=(6, 0))
        chart_box.columnconfigure(0, weight=1)
        self.plan_chart = tk.Canvas(chart_box, height=250, bg=self.colors["panel_2"], highlightthickness=0)
        self.plan_chart.pack(fill="both", expand=True)
        self.plan_chart.bind("<Configure>", lambda _event: self._draw_plan_chart())
        self.plan_chart_text = tk.Label(chart_box, text="Select a plan to chart its stop and target.",
                                        bg=self.colors["panel"], fg=self.colors["muted"], anchor="w", justify="left")
        self.plan_chart_text.pack(fill="x", pady=(6, 0))

    def _build_risk_tab(self) -> None:
        budget = self._section(self.risk_tab, "Risk-budget waterfall",
                               "Compares the configured per-trade budget times the plan limit with stop risk in the current visible plan queue.")
        budget.grid(row=0, column=0, sticky="ew", padx=12, pady=12)
        self.waterfall = tk.Canvas(budget, height=210, bg=self.colors["panel_2"], highlightthickness=0)
        self.waterfall.pack(fill="x", expand=True)
        self.waterfall.bind("<Configure>", lambda _event: self._render_risk_waterfall())
        sizing = self._section(self.risk_tab, "Share and fraction sizing explorer")
        sizing.grid(row=1, column=0, sticky="ew", padx=12, pady=(0, 12))
        sizing.columnconfigure(1, weight=1)
        tk.Label(sizing, text="Review-only sizing applies the selected instrument's quantity precision and configured max quantity/notional. Derivative contract multipliers and broker buying-power rules are not modeled.",
                 bg=self.colors["panel"], fg=self.colors["muted"], anchor="w", justify="left", wraplength=980).grid(
                     row=0, column=0, columnspan=2, sticky="ew", pady=(0, 8))
        tk.Label(sizing, text="Hypothetical notional", bg=self.colors["panel"], fg=self.colors["muted"], anchor="w").grid(
            row=1, column=0, sticky="w", padx=(0, 10), pady=4)
        self.sizing_notional_var = tk.StringVar(value="")
        self.sizing_notional_entry = tk.Entry(sizing, textvariable=self.sizing_notional_var, width=18,
                                              bg=self.colors["entry"], fg=self.colors["text"],
                                              insertbackground=self.colors["text"], relief="flat")
        self.sizing_notional_entry.grid(row=1, column=1, sticky="w", pady=4, ipady=4)
        self.sizing_notional_var.trace_add("write", lambda *_args: self._update_sizing())
        self.sizing_result = tk.Label(sizing, text="Select a plan to explore its share size.", bg=self.colors["panel_2"],
                                      fg=self.colors["text"], anchor="w", justify="left", padx=10, pady=10)
        self.sizing_result.grid(row=2, column=0, columnspan=2, sticky="ew", pady=(8, 0))

    def _build_exposure_tab(self) -> None:
        exposure = self._section(self.exposure_tab, "Portfolio exposure map",
                                 "Uses open paper positions and available local price marks. Broker-held positions and sector classifications are shown only when present in loaded data.")
        exposure.grid(row=0, column=0, sticky="nsew", padx=12, pady=12)
        exposure.columnconfigure(0, weight=1)
        exposure.rowconfigure(1, weight=1)
        self.exposure_summary = tk.Label(exposure, text="", bg=self.colors["panel_2"], fg=self.colors["text"],
                                         anchor="w", justify="left", padx=10, pady=8)
        self.exposure_summary.pack(fill="x", pady=(0, 8))
        self.exposure_tree = self._tree(exposure, ("kind", "group", "value", "share"),
                                        ("View", "Symbol / class / sector", "Marked value", "Share of marked exposure"),
                                        height=8, widths={"kind": 130, "group": 260, "value": 150, "share": 190})
        correlation = self._section(self.exposure_tab, "Correlation clusters",
                                    "Pearson correlation of aligned daily log returns for the latest common loaded sessions. Clusters connect pairs with |r| ≥ 0.70; correlation is not diversification proof.")
        correlation.grid(row=1, column=0, sticky="ew", padx=12, pady=(0, 12))
        correlation.columnconfigure(0, weight=1)
        self.cluster_summary = tk.Label(correlation, text="", bg=self.colors["panel_2"], fg=self.colors["text"],
                                        anchor="w", justify="left", padx=10, pady=8)
        self.cluster_summary.pack(fill="x", pady=(0, 8))
        self.correlation_tree = self._tree(correlation, ("left", "right", "corr", "sessions"),
                                           ("Symbol A", "Symbol B", "Correlation", "Sessions"), height=5,
                                           widths={"left": 120, "right": 120, "corr": 120, "sessions": 100})

    def _build_scenarios_tab(self) -> None:
        scenarios = self._section(self.scenarios_tab, "Multi-scenario portfolio comparison",
                                  "Compares 0.5×, 1.0×, and 1.5× quantities across the entire active plan list. Scenarios are arithmetic illustrations and never alter plans.")
        scenarios.grid(row=0, column=0, sticky="nsew", padx=12, pady=12)
        scenarios.columnconfigure(0, weight=1)
        self.scenario_tree = self._tree(scenarios, ("scenario", "plans", "notional", "stoprisk", "targetgain", "after"),
                                        ("Scenario", "Plans", "Added notional", "Added stop risk", "Target gain", "Marked exposure after"),
                                        height=5, widths={"scenario": 150, "plans": 80, "notional": 145, "stoprisk": 145, "targetgain": 145, "after": 180})
        impact = self._section(self.scenarios_tab, "Proposed-plan portfolio impact preview",
                               "The selected plan is added hypothetically to existing marked paper exposure. It does not include broker holdings unless they are in Timmy's local ledger.")
        impact.grid(row=1, column=0, sticky="ew", padx=12, pady=(0, 12))
        self.impact_summary = tk.Label(impact, text="", bg=self.colors["panel_2"], fg=self.colors["text"],
                                       anchor="w", justify="left", padx=10, pady=10, wraplength=980)
        self.impact_summary.pack(fill="x")

    def _build_readiness_tab(self) -> None:
        frame = self._section(self.readiness_tab, "Stepwise pre-submit readiness checklist",
                              "Read each step before paper or live action. This checklist is informational and does not enable or submit orders.")
        frame.grid(row=0, column=0, sticky="nsew", padx=12, pady=12)
        self.readiness_text = tk.Text(frame, height=24, bg=self.colors["panel_2"], fg=self.colors["text"],
                                      relief="flat", wrap="word", padx=12, pady=10, state="disabled")
        self.readiness_text.pack(fill="both", expand=True)

    def _selected_plan(self):
        key = self.plan_selector_var.get() if hasattr(self, "plan_selector_var") else ""
        return self.plan_by_key.get(key)

    def _reload_data(self) -> None:
        plans = list(getattr(self.app, "plans", []) or [])
        previous = self.plan_selector_var.get()
        self.plan_by_key = {}
        self.plan_keys = []
        for index, plan in enumerate(plans):
            key = f"{index + 1}. {plan.symbol} · {plan.side}"
            self.plan_keys.append(key)
            self.plan_by_key[key] = plan
        self.plan_selector.configure(values=self.plan_keys)
        if previous in self.plan_by_key:
            self.plan_selector_var.set(previous)
        elif self.plan_keys:
            self.plan_selector_var.set(self.plan_keys[0])
        else:
            self.plan_selector_var.set("")
        self.plan_tree.delete(*self.plan_tree.get_children())
        for index, plan in enumerate(plans):
            metrics = self._plan_metrics(plan)
            self.plan_tree.insert("", "end", iid=f"plan-{index}", values=(
                f"{plan.symbol} · {plan.instrument_type}", plan.side, f"{plan.quantity:g}",
                _money(metrics["entry"]), _money(metrics["notional"]), _money(metrics["risk"]),
                f"{metrics['rr']:.2f}×" if metrics["rr"] is not None else "—",
            ))
        if plans:
            if not self.plan_tree.selection():
                self.plan_tree.selection_set("plan-0")
            self._on_plan_selected()
        else:
            self._clear_plan_fields()
        self._render_risk_waterfall()
        self._render_exposure_and_correlations()
        self._render_scenarios()
        self._render_readiness()

    def _clear_plan_fields(self) -> None:
        self.loading_inputs = True
        for variable in getattr(self, "change_vars", {}).values():
            variable.set("")
        self.loading_inputs = False
        self.review_ack.set(False)
        self.diff_reviewed = False
        self._set_text(self.diff_text, "No executable plan is available for review.")
        self.sizing_result.configure(text="No current plan. Refresh the scanner to load a sizing example.")
        self.plan_chart.delete("all")
        self.plan_chart_text.configure(text="No selected plan to chart.")

    def _on_board_select(self, _event=None) -> None:
        selection = self.plan_tree.selection()
        if not selection:
            return
        try:
            index = int(selection[0].split("-", 1)[1])
            key = self.plan_keys[index]
        except (ValueError, IndexError):
            return
        self.plan_selector_var.set(key)
        self._load_selected_plan()

    def _on_plan_selected(self, _event=None) -> None:
        self._load_selected_plan()

    def _load_selected_plan(self) -> None:
        plan = self._selected_plan()
        if plan is None:
            self._clear_plan_fields()
            return
        try:
            index = self.plan_keys.index(self.plan_selector_var.get())
            iid = f"plan-{index}"
            if iid in self.plan_tree.get_children():
                self.plan_tree.selection_set(iid)
        except ValueError:
            pass
        metrics = self._plan_metrics(plan)
        self.loading_inputs = True
        self.change_vars["quantity"].set(f"{plan.quantity:g}")
        self.change_vars["entry"].set(f"{metrics['entry']:g}" if metrics["entry"] is not None else "")
        self.change_vars["stop"].set(f"{plan.stop_price:g}")
        self.change_vars["target"].set(f"{plan.target_price:g}")
        self.loading_inputs = False
        self.review_ack.set(False)
        self.diff_reviewed = False
        self.sizing_notional_var.set(f"{metrics['notional']:.2f}" if metrics["notional"] is not None else "")
        self._update_change_preview()
        self._update_sizing()
        self._draw_plan_chart()
        self._render_scenarios()
        self._render_readiness()

    def _plan_metrics(self, plan) -> dict:
        signal = getattr(self.app, "signal_by_symbol", {}).get(plan.symbol.upper())
        entry = _number(plan.limit_price)
        if entry is None and signal is not None:
            entry = _number(signal.entry)
        if entry is None:
            entry = _number(plan.stop_price)
        quantity = _number(plan.quantity) or 0.0
        stop = _number(plan.stop_price)
        target = _number(plan.target_price)
        notional = _number(plan.notional)
        if notional is None and entry is not None:
            notional = abs(quantity * entry)
        risk = abs(entry - stop) * abs(quantity) if entry is not None and stop is not None else None
        reward = abs(target - entry) * abs(quantity) if entry is not None and target is not None else None
        rr = reward / risk if reward is not None and risk is not None and risk > 0 else None
        return {"entry": entry, "quantity": quantity, "stop": stop, "target": target,
                "notional": notional, "risk": risk, "reward": reward, "rr": rr}

    def _hypothetical_values(self):
        plan = self._selected_plan()
        if plan is None:
            return None, "Select an executable plan."
        parsed = {key: _number(var.get()) for key, var in self.change_vars.items()}
        missing = [key for key, value in parsed.items() if value is None]
        if missing:
            return None, f"Enter valid numeric values for: {', '.join(missing)}."
        if parsed["quantity"] <= 0 or parsed["entry"] <= 0 or parsed["stop"] <= 0 or parsed["target"] <= 0:
            return None, "Quantity and all price levels must be greater than zero."
        if plan.side.upper() == "BUY" and not (parsed["stop"] < parsed["entry"] < parsed["target"]):
            return None, "For a buy plan, stop must be below entry and target above entry."
        if plan.side.upper() == "SELL" and not (parsed["target"] < parsed["entry"] < parsed["stop"]):
            return None, "For a sell plan, target must be below entry and stop above entry."
        profile = asset_profile(plan.symbol, self.app.config or self.app._load_config_safe())
        if not profile.enabled:
            return None, f"{plan.symbol} is not enabled in the current asset configuration."
        decimals = profile.quantity_decimals
        if profile.instrument_type == "EQUITY":
            decimals = (self.app.config or self.app._load_config_safe()).equity_fractional_quantity_decimals if (self.app.config or self.app._load_config_safe()).enable_equity_fractional_trading else 0
        step = 10 ** (-decimals)
        quantity = math.floor(parsed["quantity"] / step + 1e-9) * step
        if quantity <= 0:
            return None, "Quantity is below the supported increment for this asset."
        if profile.max_quantity > 0 and quantity > profile.max_quantity:
            return None, f"Quantity exceeds the configured asset maximum of {profile.max_quantity:g}."
        notional = quantity * parsed["entry"]
        if profile.max_notional > 0 and notional > profile.max_notional + 1e-6:
            return None, f"Notional exceeds the configured asset maximum of {_money(profile.max_notional)}."
        risk = abs(parsed["entry"] - parsed["stop"]) * quantity
        reward = abs(parsed["target"] - parsed["entry"]) * quantity
        return {**parsed, "quantity": quantity, "notional": notional, "risk": risk, "reward": reward,
                "rr": reward / risk if risk > 0 else None}, ""

    def _update_change_preview(self) -> None:
        if getattr(self, "loading_inputs", False):
            return
        plan = self._selected_plan()
        if plan is None:
            return
        original = self._plan_metrics(plan)
        values = {key: _number(var.get()) for key, var in self.change_vars.items()}
        if any(value is None for value in values.values()):
            self.diff_reviewed = False
            self._set_text(self.diff_text, "Enter numeric values to see the change review.")
            self._draw_plan_chart()
            self._render_readiness()
            return
        rows = (
            ("Quantity", original["quantity"], values["quantity"]),
            ("Entry / limit", original["entry"], values["entry"]),
            ("Stop", original["stop"], values["stop"]),
            ("Target", original["target"], values["target"]),
        )
        diffs = [f"{name}: {before:g} → {after:g}" for name, before, after in rows
                 if before is not None and not math.isclose(before, after, rel_tol=1e-9, abs_tol=1e-9)]
        state = "Changes found" if diffs else "No differences from the active plan."
        text = [state, *diffs]
        _validated, validation_error = self._hypothetical_values()
        if _validated is not None:
            text.extend((
                f"Estimated notional: {_money(original['notional'])} → {_money(_validated['notional'])}",
                f"Estimated stop risk: {_money(original['risk'])} → {_money(_validated['risk'])}",
                f"Estimated target gain: {_money(original['reward'])} → {_money(_validated['reward'])}",
                f"Reward / risk: {original['rr']:.2f}× → {_validated['rr']:.2f}×"
                if original["rr"] is not None and _validated["rr"] is not None else "Reward / risk comparison unavailable.",
            ))
        text.extend(("", "Review-only: this hypothetical edit does not change, save, or execute the active plan."))
        if validation_error:
            text.insert(1, f"Review warning: {validation_error}")
        self.diff_reviewed = bool(self.review_ack.get())
        self._set_text(self.diff_text, "\n".join(text))
        self._draw_plan_chart()
        self._render_risk_waterfall()
        self._render_scenarios()
        self._render_readiness()

    def _plan_edit_changed(self) -> None:
        if getattr(self, "loading_inputs", False):
            return
        self.review_ack.set(False)
        self._update_change_preview()

    @staticmethod
    def _set_text(widget: tk.Text, value: str) -> None:
        widget.configure(state="normal")
        widget.delete("1.0", "end")
        widget.insert("1.0", value)
        widget.configure(state="disabled")

    def _draw_plan_chart(self) -> None:
        if not hasattr(self, "plan_chart"):
            return
        canvas = self.plan_chart
        canvas.delete("all")
        plan = self._selected_plan()
        values, error = self._hypothetical_values()
        width = max(canvas.winfo_width(), 380)
        height = max(canvas.winfo_height(), 230)
        if plan is None or values is None:
            canvas.create_text(width / 2, height / 2, text=error or "Select a plan", fill=self.colors["muted"],
                               width=width - 50, justify="center")
            self.plan_chart_text.configure(text=error or "Select a plan.")
            return
        entry, stop, target = values["entry"], values["stop"], values["target"]
        low, high = min(entry, stop, target), max(entry, stop, target)
        spread = max(high - low, abs(entry) * 0.02, 0.01)
        low -= spread * 0.18
        high += spread * 0.18
        top, bottom = 28, height - 26
        def y(price): return bottom - (price - low) / (high - low) * (bottom - top)
        left, right = 88, width - 26
        canvas.create_rectangle(left, min(y(entry), y(target)), right, max(y(entry), y(target)),
                                fill="#173d36", outline="")
        canvas.create_rectangle(left, min(y(entry), y(stop)), right, max(y(entry), y(stop)),
                                fill="#45272b", outline="")
        for title, price, color in (("TARGET", target, self.colors["green"]), ("ENTRY", entry, self.colors["gold"]), ("STOP", stop, self.colors["red"])):
            yy = y(price)
            canvas.create_line(left, yy, right, yy, fill=color, width=2)
            canvas.create_text(8, yy, text=f"{title} {_money(price)}", fill=color, anchor="w", font=("Sans", 8, "bold"))
        rr = values["rr"]
        ratio_text = f"Risk/reward {rr:.2f}×" if rr is not None else "Risk/reward unavailable · stop distance is zero"
        self.plan_chart_text.configure(text=f"{plan.symbol} {plan.side} · stop risk {_money(values['risk'])} · target gain {_money(values['reward'])} · {ratio_text}")

    def _render_risk_waterfall(self) -> None:
        if not hasattr(self, "waterfall"):
            return
        canvas = self.waterfall
        canvas.delete("all")
        config = self.app.config or self.app._load_config_safe()
        per_trade = max(0.0, float(config.risk_per_trade_usd or 0))
        slots = max(1, int(getattr(self.app, "plan_limit_value", 1) or 1))
        budget = per_trade * slots
        current_risk = sum(self._plan_metrics(plan)["risk"] or 0.0 for plan in getattr(self.app, "plans", []))
        selected = self._selected_plan()
        proposed, _error = self._hypothetical_values()
        after_risk = current_risk
        if selected is not None and proposed is not None:
            after_risk = max(0.0, current_risk - (self._plan_metrics(selected)["risk"] or 0.0) + proposed["risk"])
        remaining = budget - after_risk
        width, height = max(canvas.winfo_width(), 560), max(canvas.winfo_height(), 200)
        canvas.create_text(14, 16, text=f"Per-trade cap {_money(per_trade)} × {slots} plan slot(s) = {_money(budget)} review allowance",
                           fill=self.colors["text"], anchor="w", font=("Sans", 9, "bold"))
        label_x, bar_x, bar_max = 14, 192, width - 225
        max_value = max(budget, current_risk, after_risk, 1.0)
        scale = bar_max / max_value
        items = (("Current queue risk", current_risk, self.colors["solar"]),
                 ("Queue with proposed edit", after_risk, self.colors["gold"]),
                 ("Remaining allowance", max(remaining, 0.0), self.colors["green"] if remaining >= 0 else self.colors["red"]))
        for index, (label, value, color) in enumerate(items):
            yy = 54 + index * 44
            canvas.create_text(label_x, yy + 10, text=label, fill=self.colors["muted"], anchor="w")
            canvas.create_rectangle(bar_x, yy, bar_x + bar_max, yy + 22, fill=self.colors["panel"], outline="")
            draw_value = min(abs(value), max_value)
            canvas.create_rectangle(bar_x, yy, bar_x + draw_value * scale, yy + 22, fill=color, outline="")
            canvas.create_text(bar_x + bar_max + 8, yy + 10, text=_money(value), fill=self.colors["text"], anchor="w")
        if remaining < 0:
            note = f"Queue exceeds the configured aggregate review allowance by {_money(abs(remaining))}. This is a warning view; existing risk logic remains unchanged."
        else:
            note = f"Proposed queue risk leaves {_money(remaining)} of this aggregate review allowance."
        canvas.create_text(14, height - 18, text=note, fill=self.colors["muted"], anchor="w", width=width - 30)

    def _update_sizing(self) -> None:
        if not hasattr(self, "sizing_result"):
            return
        plan = self._selected_plan()
        if plan is None:
            self.sizing_result.configure(text="Select a plan to explore share sizing.")
            return
        config = self.app.config or self.app._load_config_safe()
        profile = asset_profile(plan.symbol, config)
        if not profile.enabled:
            self.sizing_result.configure(text=f"{plan.symbol} is disabled by the current asset-class configuration.")
            return
        metrics = self._plan_metrics(plan)
        price = metrics["entry"]
        desired = _number(self.sizing_notional_var.get())
        if price is None or price <= 0 or desired is None or desired <= 0:
            self.sizing_result.configure(text="Enter a positive hypothetical notional. A valid plan entry is required.")
            return
        decimals = profile.quantity_decimals
        if profile.instrument_type == "EQUITY":
            decimals = config.equity_fractional_quantity_decimals if config.enable_equity_fractional_trading else 0
        requested_notional = min(desired, profile.max_notional) if profile.max_notional > 0 else desired
        raw_qty = requested_notional / price
        step = 10 ** (-decimals)
        quantity = math.floor(raw_qty / step + 1e-9) * step
        quantity = min(quantity, profile.max_quantity) if profile.max_quantity > 0 else quantity
        if profile.instrument_type == "EQUITY" and decimals > 0 and requested_notional < config.min_equity_fractional_notional_usd:
            quantity = 0.0
        actual_notional = quantity * price
        cap_note = f" Requested {_money(desired)} was capped to configured order maximum {_money(profile.max_notional)}." if profile.max_notional > 0 and desired > profile.max_notional else ""
        if quantity <= 0:
            self.sizing_result.configure(text="This amount is below the minimum supported quantity or configured fractional minimum. Increase the notional to continue.")
            return
        if profile.instrument_type in {"FUTURES", "OPTION"}:
            note = "Integer contract count shown; contract multiplier, margin, and broker buying-power checks are not modeled here."
        elif profile.instrument_type == "CRYPTO":
            note = f"Uses {decimals}-decimal quantity steps and the configured crypto order maximum."
        else:
            note = f"Uses {'fractional' if decimals else 'whole-share'} quantity steps and configured equity limits."
        self.sizing_result.configure(
            text=f"{plan.symbol} · {profile.instrument_type} · {quantity:g} units × {_money(price)} = {_money(actual_notional)} notional.{cap_note} {note} Account buying power is not modeled. No order is created."
        )

    def _existing_paper_exposure(self) -> tuple[dict[str, dict], bool]:
        rows: dict[str, dict] = {}
        complete = True
        config = self.app.config or self.app._load_config_safe()
        for event in self.app._paper_portfolio_records():
            if event.get("sell_status") != "target-pending":
                continue
            order = event.get("order") or {}
            symbol = str(event.get("symbol") or order.get("symbol") or "").upper()
            quantity = _number(event.get("quantity") or order.get("quantity"))
            entry = _number(event.get("buy_price") or order.get("limit_price"))
            signal = getattr(self.app, "signal_by_symbol", {}).get(symbol)
            bars = getattr(self.app, "bars_by_symbol", {}).get(symbol, [])
            mark = _number(getattr(signal, "close", None)) if signal else (_number(bars[-1].close) if bars else None)
            if not symbol or quantity is None or quantity <= 0 or mark is None or mark <= 0:
                complete = False
                continue
            rows[symbol] = rows.get(symbol, {"value": 0.0, "asset": asset_profile(symbol, config).instrument_type})
            rows[symbol]["value"] += quantity * mark
            rows[symbol]["quantity"] = rows[symbol].get("quantity", 0.0) + quantity
            rows[symbol]["entry_value"] = rows[symbol].get("entry_value", 0.0) + quantity * (entry or mark)
        return rows, complete

    def _render_exposure_and_correlations(self) -> None:
        if not hasattr(self, "exposure_tree"):
            return
        self.exposure_tree.delete(*self.exposure_tree.get_children())
        positions, complete = self._existing_paper_exposure()
        total = sum(row["value"] for row in positions.values())
        for symbol, row in sorted(positions.items(), key=lambda item: item[1]["value"], reverse=True):
            share = row["value"] / total * 100 if total > 0 else 0
            self.exposure_tree.insert("", "end", values=("Symbol", symbol, _money(row["value"]), f"{share:.1f}%"))
        classes: dict[str, float] = {}
        for row in positions.values():
            classes[row["asset"]] = classes.get(row["asset"], 0.0) + row["value"]
        for name, value in sorted(classes.items(), key=lambda item: item[1], reverse=True):
            share = value / total * 100 if total > 0 else 0
            self.exposure_tree.insert("", "end", values=("Asset class", name, _money(value), f"{share:.1f}%"))
        self.exposure_tree.insert("", "end", values=("Sector", "Unavailable · sector metadata not loaded", "—", "—"))
        marks_note = "all local paper marks available" if complete else "partial · one or more positions lack a current local mark"
        self.exposure_summary.configure(text=f"Marked paper exposure {_money(total)} · {len(positions)} symbol(s) · {marks_note}. Broker positions are not included in this map.")
        self._render_correlations()

    def _render_correlations(self) -> None:
        if not hasattr(self, "correlation_tree"):
            return
        self.correlation_tree.delete(*self.correlation_tree.get_children())
        symbols = set(self._existing_paper_exposure()[0])
        symbols.update(str(plan.symbol).upper() for plan in getattr(self.app, "plans", []))
        symbols = sorted(symbols)[:30]
        pairs = []
        graph = {symbol: set() for symbol in symbols}
        for index, left_symbol in enumerate(symbols):
            for right_symbol in symbols[index + 1:]:
                left, right = _aligned_returns(
                    getattr(self.app, "bars_by_symbol", {}).get(left_symbol, []),
                    getattr(self.app, "bars_by_symbol", {}).get(right_symbol, []),
                )
                corr = _correlation(left, right)
                if corr is None:
                    continue
                pairs.append((left_symbol, right_symbol, corr, min(len(left), len(right))))
                if abs(corr) >= 0.70:
                    graph[left_symbol].add(right_symbol)
                    graph[right_symbol].add(left_symbol)
        for idx, (left, right, corr, sessions) in enumerate(sorted(pairs, key=lambda item: abs(item[2]), reverse=True)[:40]):
            self.correlation_tree.insert("", "end", iid=f"corr-{idx}", values=(left, right, f"{corr:+.2f}", sessions))
        clusters = []
        seen = set()
        for symbol in symbols:
            if symbol in seen or not graph[symbol]:
                continue
            stack, cluster = [symbol], []
            seen.add(symbol)
            while stack:
                current = stack.pop()
                cluster.append(current)
                for neighbor in graph[current] - seen:
                    seen.add(neighbor)
                    stack.append(neighbor)
            if len(cluster) > 1:
                clusters.append(tuple(sorted(cluster)))
        if clusters:
            summary = " | ".join("Cluster: " + ", ".join(cluster) for cluster in clusters)
        elif pairs:
            summary = "No pairs meet the |correlation| ≥ 0.70 cluster threshold."
        else:
            summary = "Insufficient aligned price history for pairwise correlations."
        self.cluster_summary.configure(text=summary)

    def _scenario_quantity(self, plan, multiplier: float) -> float:
        config = self.app.config or self.app._load_config_safe()
        profile = asset_profile(plan.symbol, config)
        decimals = profile.quantity_decimals
        if profile.instrument_type == "EQUITY" and not config.enable_equity_fractional_trading:
            decimals = 0
        step = 10 ** (-decimals)
        qty = math.floor(abs(float(plan.quantity)) * multiplier / step + 1e-9) * step
        if profile.max_quantity > 0:
            qty = min(qty, profile.max_quantity)
        metrics = self._plan_metrics(plan)
        if profile.max_notional > 0 and metrics["entry"] and qty * metrics["entry"] > profile.max_notional:
            qty = math.floor((profile.max_notional / metrics["entry"]) / step + 1e-9) * step
        return qty

    def _render_scenarios(self) -> None:
        if not hasattr(self, "scenario_tree"):
            return
        self.scenario_tree.delete(*self.scenario_tree.get_children())
        plans = list(getattr(self.app, "plans", []) or [])
        positions, marks_complete = self._existing_paper_exposure()
        exposure = sum(row["value"] for row in positions.values())
        for index, multiplier in enumerate((0.5, 1.0, 1.5)):
            total_notional = total_risk = total_gain = 0.0
            count = 0
            for plan in plans:
                metrics = self._plan_metrics(plan)
                quantity = self._scenario_quantity(plan, multiplier)
                if quantity <= 0 or metrics["entry"] is None:
                    continue
                count += 1
                total_notional += quantity * metrics["entry"]
                if metrics["risk"] is not None and metrics["quantity"] > 0:
                    total_risk += (metrics["risk"] / metrics["quantity"]) * quantity
                if metrics["reward"] is not None and metrics["quantity"] > 0:
                    total_gain += (metrics["reward"] / metrics["quantity"]) * quantity
            after = _money(exposure + total_notional) + (" · partial base" if not marks_complete else "")
            self.scenario_tree.insert("", "end", iid=f"scenario-{index}", values=(
                f"{multiplier:.1f}× quantity", count, _money(total_notional), _money(total_risk), _money(total_gain), after
            ))
        self._render_impact()

    def _render_impact(self) -> None:
        plan = self._selected_plan()
        values, error = self._hypothetical_values()
        positions, complete = self._existing_paper_exposure()
        current_by_symbol = {symbol: row["value"] for symbol, row in positions.items()}
        current_total = sum(current_by_symbol.values())
        if plan is None or values is None:
            self.impact_summary.configure(text=error or "Select a plan for the impact preview.")
            return
        proposed_value = values["notional"]
        after_total = current_total + proposed_value
        same_symbol_after = current_by_symbol.get(plan.symbol.upper(), 0.0) + proposed_value
        share = same_symbol_after / after_total * 100 if after_total > 0 else 0.0
        note = "Complete local marks" if complete else "Partial local marks; some existing positions are omitted"
        self.impact_summary.configure(
            text=(f"Paper ledger now: {_money(current_total)} ({note}). Add {plan.symbol} hypothetically: "
                  f"+{_money(proposed_value)} notional and +{_money(values['risk'])} stop risk. "
                  f"Estimated marked exposure after: {_money(after_total)}; {plan.symbol} would be about {share:.1f}% "
                  "of this local marked-plus-proposed total. Broker positions, fees, slippage, and derivatives multipliers may be absent.")
        )

    def _render_readiness(self) -> None:
        if not hasattr(self, "readiness_text"):
            return
        plan = self._selected_plan()
        config = self.app.config or self.app._load_config_safe()
        target = str(self.app.execution_target_var.get() or "Paper")
        signal = getattr(self.app, "signal_by_symbol", {}).get(plan.symbol.upper()) if plan else None
        try:
            data_fresh = bool(self.app.bars_by_symbol) and not self.app._data_is_stale() and not self.app._sample_data_in_use
        except Exception:
            data_fresh = False
        preview_fresh = bool(plan and self.app._has_fresh_preview(plan, self.app._execution_config(config)))
        broker_check = not self.app._broker_check_required(self.app._execution_config(config))
        live_ready = self.app._live_ready(self.app._execution_config(config))
        changes, hypothetical_error = self._hypothetical_values()
        diff_required = False
        fields_entered = any(var.get().strip() for var in self.change_vars.values())
        if plan and changes:
            original = self._plan_metrics(plan)
            diff_required = any(not math.isclose(float(changes[key]), float(original[base]), rel_tol=1e-9, abs_tol=1e-9)
                                 for key, base in (("quantity", "quantity"), ("entry", "entry"), ("stop", "stop"), ("target", "target"))
                                 if original[base] is not None)
        account_step = target != "Live" or (bool(config.webull_account_id) and broker_check)
        account_detail = (
            "Not required for the current paper target." if target != "Live" else
            "No Webull account is configured." if not config.webull_account_id else
            "Broker account check is current." if broker_check else "Live target selected; run an account check."
        )
        checks = [
            ("1. Select an active executable plan", plan is not None, "Choose a row in the comparison board."),
            ("2. Check market-data freshness", data_fresh, self.app._data_freshness_line()),
            ("3. Review the plan or hypothetical change", not hypothetical_error and (not diff_required or bool(self.review_ack.get())),
             hypothetical_error if fields_entered and hypothetical_error else
             "Diff acknowledgement is required only when hypothetical fields differ from the active plan."),
            ("4. Confirm exact broker preview", preview_fresh or not config.webull_require_preview,
             "Fresh exact-plan preview found." if preview_fresh else "A fresh preview is missing or not required by current configuration."),
            ("5. Refresh account state", account_step, account_detail),
            ("6. Review execution lane and guards", target != "Live" or live_ready,
             f"Current target: {target} · live guard {'enabled' if live_ready else 'locked'}. This lab does not change the lane."),
        ]
        lines = ["STEPWISE REVIEW · NOT AN ORDER APPROVAL", ""]
        for title, okay, detail in checks:
            mark = "[READY]" if okay else "[REVIEW]"
            lines.extend((f"{mark} {title}", f"    {detail}", ""))
        if signal is None and plan:
            lines.extend(("[REVIEW] Current signal record is unavailable for this plan.", "    Verify the plan directly against its source data.", ""))
        lines.append("This checklist is informational only. It does not create, edit, approve, or submit an order.")
        self._set_text(self.readiness_text, "\n".join(lines))

    def _review_ack_changed(self) -> None:
        self.diff_reviewed = bool(self.review_ack.get())
        self._render_readiness()
