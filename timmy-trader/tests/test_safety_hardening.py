from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timedelta
from threading import Event
from types import SimpleNamespace

import pytest

from trend_trader.config import load_config
from trend_trader.brokers.webull_openapi import WebullOpenApiBroker
from trend_trader.models import Candle, OrderPlan, Signal
from trend_trader.native_gui import ACCOUNT_REFRESH_MS, TimmyNativeApp
from trend_trader.risk import create_order_plan


def eligible_signal(symbol: str = "SPY", score: int = 90) -> Signal:
    return Signal(
        symbol=symbol,
        score=score,
        decision="eligible",
        direction="bullish",
        setup="focused safety test",
        reasons=("test setup",),
        close=102.0,
        change_pct=3.0,
        entry=100.0,
        stop=95.0,
        target=112.0,
        volatility_pct=1.0,
        volume_ratio=2.0,
        reward_risk=2.4,
        expense_status="ok",
        expense_reasons=(),
        sensible_score=score,
        sensible_action="trade",
        scout_score=score,
        scout_action="alert",
    )


def order_plan() -> OrderPlan:
    return OrderPlan(
        symbol="SPY",
        side="BUY",
        quantity=2.0,
        order_type="LIMIT",
        limit_price=100.0,
        stop_price=95.0,
        target_price=112.0,
        notional=200.0,
        reason="fingerprint safety test",
        instrument_type="EQUITY",
        market="US",
        time_in_force="DAY",
        entrust_type="QTY",
        support_trading_session="CORE",
    )


def native_app_with_bars(timestamp: datetime) -> TimmyNativeApp:
    app = object.__new__(TimmyNativeApp)
    app.bars_by_symbol = {
        "SPY": [
            Candle(
                symbol="SPY",
                timestamp=timestamp,
                open=99.0,
                high=103.0,
                low=98.0,
                close=102.0,
                volume=1_000_000,
            )
        ]
    }
    app.execution_events = []
    app.recent_bad_event_counts = {}
    app.trade_cash_value = None
    app.config = None
    app.min_score_var = SimpleNamespace(
        value="72",
        get=lambda: app.min_score_var.value,
        set=lambda value: setattr(app.min_score_var, "value", str(value)),
    )
    app.execution_target_var = SimpleNamespace(get=lambda: "Live")
    app.min_score_value = 72
    app.plan_limit_value = 3
    return app


def test_auto_start_live_on_market_open_defaults_false(monkeypatch) -> None:
    monkeypatch.setitem(
        __import__("sys").modules,
        "dotenv",
        SimpleNamespace(load_dotenv=lambda *args, **kwargs: None),
    )
    monkeypatch.delenv("AUTO_START_LIVE_ON_MARKET_OPEN", raising=False)

    config = load_config()

    assert config.auto_start_live_on_market_open is False


def test_futures_enable_switch_requires_configured_symbol(monkeypatch) -> None:
    monkeypatch.setenv("WEBULL_SYMBOL_WHITELIST", "ES")
    monkeypatch.setenv("WEBULL_FUTURES_SYMBOLS", "")
    monkeypatch.setenv("ENABLE_FUTURES_TRADING", "1")

    plan = create_order_plan(eligible_signal("ES"), load_config())

    assert plan is None


@pytest.mark.parametrize("symbol", ("ES", "NQ", "GC", "CL", "ZC", "ES=F"))
def test_common_futures_roots_do_not_fall_through_as_equities(monkeypatch, symbol: str) -> None:
    monkeypatch.setenv("WEBULL_SYMBOL_WHITELIST", symbol)

    plan = create_order_plan(eligible_signal(symbol), load_config())

    assert plan is None


def test_create_order_plan_enforces_min_score_to_trade(monkeypatch) -> None:
    monkeypatch.setenv("WEBULL_SYMBOL_WHITELIST", "SPY")
    monkeypatch.setenv("MIN_SCORE_TO_TRADE", "91")

    plan = create_order_plan(eligible_signal("SPY", score=90), load_config())

    assert plan is None


def test_native_planning_blocks_stale_candles(monkeypatch) -> None:
    monkeypatch.setenv("REQUIRE_MARKET_HOURS", "0")
    monkeypatch.setenv("WEBULL_SYMBOL_WHITELIST", "SPY")
    app = native_app_with_bars(datetime.now() - timedelta(days=5, minutes=1))
    app.signals = [eligible_signal("SPY")]

    assert app._data_is_stale() is True
    assert app._load_plans(load_config()) == []


def test_native_operational_blocks_include_stale_candles(monkeypatch) -> None:
    monkeypatch.setenv("REQUIRE_MARKET_HOURS", "0")
    app = native_app_with_bars(datetime.now() - timedelta(days=5, minutes=1))

    blocks = app._operational_blocks(eligible_signal("SPY"), load_config())

    assert any("stale" in block.lower() for block in blocks)


def test_native_planning_blocks_entries_above_cash_cap(monkeypatch) -> None:
    monkeypatch.setenv("REQUIRE_MARKET_HOURS", "0")
    monkeypatch.setenv("WEBULL_SYMBOL_WHITELIST", "SPY")
    monkeypatch.setenv("MAX_ENTRY_CASH_PCT", "20")
    app = native_app_with_bars(datetime.now())
    app.trade_cash_value = 300.0
    app.signals = [eligible_signal("SPY")]
    app.config = load_config()

    assert app._plans_from_signals(app.config, app.signals) == []
    assert any("cash cap" in block for block in app._operational_blocks(app.signals[0], app.config))


def test_paper_simulation_creates_fractional_scout_plan_when_strict_plan_is_empty(monkeypatch) -> None:
    monkeypatch.setenv("TRADER_MODE", "paper")
    monkeypatch.setenv("PAPER_SIMULATION_ENABLED", "1")
    monkeypatch.setenv("PAPER_SIMULATION_MIN_SCOUT_SCORE", "40")
    monkeypatch.setenv("WEBULL_SYMBOL_WHITELIST", "AMD")
    app = native_app_with_bars(datetime.now())
    app.execution_target_var = SimpleNamespace(get=lambda: "Paper")
    app.signals = [
        replace(
            eligible_signal("AMD", score=48),
            decision="watch",
            setup="trend-continuation",
            scout_score=44,
            scout_action="alert",
            sensible_score=44,
            sensible_action="avoid",
            close=544.43,
            change_pct=8.11,
            entry=533.54,
            stop=484.53,
            target=651.17,
            volatility_pct=7.2,
        )
    ]
    app.bars_by_symbol = {"AMD": app.bars_by_symbol["SPY"]}
    config = load_config()

    plans = app._load_plans(config)

    assert len(plans) == 1
    assert plans[0].symbol == "AMD"
    assert plans[0].quantity > 0
    assert plans[0].quantity < 1
    assert "paper-scout-simulation" in plans[0].reason


def test_paper_simulation_does_not_backfill_live_target(monkeypatch) -> None:
    monkeypatch.setenv("PAPER_SIMULATION_ENABLED", "1")
    monkeypatch.setenv("WEBULL_SYMBOL_WHITELIST", "AMD")
    app = native_app_with_bars(datetime.now())
    app.execution_target_var = SimpleNamespace(get=lambda: "Live")
    app.signals = [
        replace(
            eligible_signal("AMD", score=48),
            decision="watch",
            scout_score=44,
            scout_action="alert",
            sensible_score=44,
            sensible_action="avoid",
            entry=533.54,
            stop=484.53,
            target=651.17,
            volatility_pct=7.2,
        )
    ]
    app.bars_by_symbol = {"AMD": app.bars_by_symbol["SPY"]}

    assert app._load_plans(load_config()) == []


@pytest.mark.parametrize(
    ("field", "value"),
    (
        ("symbol", "QQQ"),
        ("quantity", 3.0),
        ("limit_price", 100.01),
        ("stop_price", 94.5),
        ("target_price", 113.0),
        ("instrument_type", "CRYPTO"),
        ("market", "CC"),
        ("time_in_force", "GTC"),
        ("entrust_type", "AMT"),
        ("support_trading_session", None),
    ),
)
def test_native_order_fingerprint_changes_with_order_details(field: str, value: object) -> None:
    base_plan = order_plan()
    changed_plan = replace(base_plan, **{field: value})

    assert TimmyNativeApp._order_fingerprint(changed_plan) != TimmyNativeApp._order_fingerprint(base_plan)


def test_native_order_fingerprint_changes_with_latest_candle_timestamp() -> None:
    plan = order_plan()

    assert TimmyNativeApp._order_fingerprint(
        plan,
        latest_candle_timestamp="2026-07-20T14:30:00",
    ) != TimmyNativeApp._order_fingerprint(
        plan,
        latest_candle_timestamp="2026-07-20T14:31:00",
    )


def test_live_submit_requires_exact_preview(monkeypatch) -> None:
    monkeypatch.setenv("REQUIRE_MARKET_HOURS", "0")
    monkeypatch.setenv("TRADER_MODE", "live")
    monkeypatch.setenv("TRADER_LIVE", "1")
    monkeypatch.setenv("WEBULL_ENABLE_LIVE_ORDERS", "1")
    monkeypatch.setenv("WEBULL_ACCOUNT_ID", "configured-account")
    app = native_app_with_bars(datetime.now())
    app.plans = [order_plan()]
    app.previewed_order_fingerprints = {}
    monkeypatch.setattr(app, "_refresh_payload", lambda: "")

    with pytest.raises(RuntimeError, match="Preview the exact current plan"):
        app.live_submit()


def test_live_submit_accepts_current_preview_fingerprint(monkeypatch) -> None:
    monkeypatch.setenv("REQUIRE_MARKET_HOURS", "0")
    monkeypatch.setenv("TRADER_MODE", "live")
    monkeypatch.setenv("TRADER_LIVE", "1")
    monkeypatch.setenv("WEBULL_ENABLE_LIVE_ORDERS", "1")
    monkeypatch.setenv("WEBULL_ACCOUNT_ID", "configured-account")
    app = native_app_with_bars(datetime.now())
    plan = order_plan()
    app.plans = [plan]
    app.trade_cash_snapshot = ("$1,000.00", "test cash")
    monkeypatch.setattr(app, "_refresh_payload", lambda: "")
    app.previewed_order_fingerprints = {
        app._order_fingerprint(plan, app._latest_candle_timestamp(plan.symbol)): {
            "previewed_at": datetime.now(),
            "account_id": "configured-account",
            "target": "Live",
            "cash": app.trade_cash_snapshot[0],
        }
    }
    submitted = []

    class BrokerStub:
        def __init__(self, config) -> None:
            self.config = config

        def submit_order(self, submitted_plan):
            submitted.append(submitted_plan)
            return {"status": "accepted", "order_plan": {"symbol": submitted_plan.symbol}}

    monkeypatch.setattr("trend_trader.native_gui.WebullOpenApiBroker", BrokerStub)
    monkeypatch.setattr(app, "_append_execution_event", lambda event: None)

    result = app.live_submit()

    assert submitted == [plan]
    assert "accepted" in result


def test_live_preview_then_submit_previews_exact_plan_before_submit(monkeypatch) -> None:
    monkeypatch.setenv("REQUIRE_MARKET_HOURS", "0")
    monkeypatch.setenv("TRADER_MODE", "live")
    monkeypatch.setenv("TRADER_LIVE", "1")
    monkeypatch.setenv("WEBULL_ENABLE_LIVE_ORDERS", "1")
    monkeypatch.setenv("WEBULL_ACCOUNT_ID", "configured-account")
    app = native_app_with_bars(datetime.now())
    plan = order_plan()
    app.plans = [plan]
    app.trade_cash_snapshot = ("$1,000.00", "test cash")
    monkeypatch.setattr(app, "_refresh_payload", lambda: "")
    calls: list[str] = []

    class BrokerStub:
        def __init__(self, config) -> None:
            self.config = config

        def preview_order(self, submitted_plan):
            calls.append(f"preview:{submitted_plan.symbol}")
            return {"status_code": 200, "order_plan": submitted_plan.__dict__}

        def submit_order(self, submitted_plan):
            calls.append(f"submit:{submitted_plan.symbol}")
            return {"status_code": 200, "order_plan": submitted_plan.__dict__}

    monkeypatch.setattr("trend_trader.native_gui.WebullOpenApiBroker", BrokerStub)
    monkeypatch.setattr(app, "_append_execution_event", lambda event: None)

    result = app.live_preview_then_submit()

    assert calls == ["preview:SPY", "submit:SPY"]
    assert app._has_fresh_preview(plan, load_config()) is True
    assert "Exact Webull preview completed" in result


def test_live_submit_rejects_expired_preview(monkeypatch) -> None:
    monkeypatch.setenv("REQUIRE_MARKET_HOURS", "0")
    monkeypatch.setenv("TRADER_MODE", "live")
    monkeypatch.setenv("TRADER_LIVE", "1")
    monkeypatch.setenv("WEBULL_ENABLE_LIVE_ORDERS", "1")
    monkeypatch.setenv("WEBULL_ACCOUNT_ID", "configured-account")
    app = native_app_with_bars(datetime.now())
    plan = order_plan()
    app.plans = [plan]
    monkeypatch.setattr(app, "_refresh_payload", lambda: "")
    app.previewed_order_fingerprints = {
        app._order_fingerprint(plan, app._latest_candle_timestamp(plan.symbol)): {
            "previewed_at": datetime.now() - timedelta(minutes=4),
            "account_id": "configured-account",
        }
    }

    with pytest.raises(RuntimeError, match="Preview the exact current plan"):
        app.live_submit()


def test_broker_http_error_records_rejected_not_opened() -> None:
    app = native_app_with_bars(datetime.now())
    event = app._event_from_broker_result(
        {
            "status_code": 400,
            "body": {"message": "insufficient buying power"},
            "order_plan": order_plan().__dict__,
        },
        mode="live",
    )

    assert event["status"] == "rejected"
    assert event["sell_status"] == "not-opened"


def test_broker_success_records_accepted_pending_position() -> None:
    app = native_app_with_bars(datetime.now())
    event = app._event_from_broker_result(
        {"status_code": 200, "body": {"order_id": "abc"}, "order_plan": order_plan().__dict__},
        mode="live",
    )

    assert event["status"] == "accepted"
    assert event["sell_status"] == "target-pending"


def test_live_rejection_updates_buying_power_indicator() -> None:
    app = native_app_with_bars(datetime.now())
    app.trade_cash_snapshot = ("-", "Run Check Webull")
    app.trade_cash_value = None

    app._update_buying_power_from_broker_results([
        {
            "status": "rejected",
            "error": "HTTP Status: 417, Code: OAUTH_OPENAPI_DAY_BUYING_POWER_INSUFFICIENT, Msg: Buying power is insufficient.",
        }
    ])

    assert app.trade_cash_snapshot == ("$0.00", "Insufficient buying power")
    assert app.trade_cash_value == 0.0


def test_broker_submit_returns_rejected_result_when_webull_raises(monkeypatch) -> None:
    monkeypatch.setenv("TRADER_MODE", "live")
    monkeypatch.setenv("TRADER_LIVE", "1")
    monkeypatch.setenv("WEBULL_ENABLE_LIVE_ORDERS", "1")
    monkeypatch.setenv("WEBULL_REQUIRE_PREVIEW", "0")
    monkeypatch.setenv("WEBULL_ACCOUNT_ID", "configured-account")
    broker = WebullOpenApiBroker(load_config())

    class OrderClient:
        @staticmethod
        def place_order(_account_id, _orders):
            raise RuntimeError("Buying power is insufficient.")

    broker.trade_client = SimpleNamespace(order_v2=OrderClient())

    result = broker.submit_order(order_plan())

    assert result["status"] == "rejected"
    assert "Buying power is insufficient" in result["error"]
    assert result["request_payload"]["account_id"] == "<configured>"


def test_auto_account_refresh_skips_when_webull_is_incomplete() -> None:
    app = object.__new__(TimmyNativeApp)
    app.closing = False
    app.account_refresh_after_id = None
    statuses: list[str] = []
    scheduled: list[int] = []
    app.status_bar = SimpleNamespace(configure=lambda **kwargs: statuses.append(kwargs["text"]))
    app.root = SimpleNamespace(after=lambda ms, callback: scheduled.append(ms) or "after-id")
    app._load_config_safe = lambda: SimpleNamespace(
        webull_app_key="",
        webull_app_secret="",
        webull_account_id="",
    )

    app._auto_account_refresh()

    assert scheduled == [ACCOUNT_REFRESH_MS]
    assert app.account_refresh_after_id == "after-id"
    assert "skipped" in statuses[0]


def test_auto_account_refresh_runs_webull_check_when_configured() -> None:
    app = object.__new__(TimmyNativeApp)
    app.closing = False
    app.account_refresh_after_id = None
    scheduled: list[int] = []
    actions: list[str] = []
    app.root = SimpleNamespace(after=lambda ms, callback: scheduled.append(ms) or "after-id")
    app._load_config_safe = lambda: SimpleNamespace(
        webull_app_key="key",
        webull_app_secret="secret",
        webull_account_id="account",
    )
    app.webull_check = lambda: "{}"
    app._run_action = lambda label, action: actions.append(label)

    app._auto_account_refresh()

    assert actions == ["Auto Webull balance refresh"]
    assert scheduled == [ACCOUNT_REFRESH_MS]


def test_native_runtime_path_anchors_relative_paths_to_home(tmp_path) -> None:
    app = object.__new__(TimmyNativeApp)
    app.home = tmp_path

    assert app._runtime_path("watchlist.txt") == tmp_path / "watchlist.txt"
    assert app._runtime_path(tmp_path / "already-absolute.txt") == tmp_path / "already-absolute.txt"


def test_threaded_action_binds_exception_before_tk_callback() -> None:
    app = object.__new__(TimmyNativeApp)
    app.closing = False
    callbacks = []
    errors = []
    callback_ready = Event()

    def after(_ms, callback):
        callbacks.append(callback)
        callback_ready.set()

    app.status_bar = SimpleNamespace(configure=lambda **_kwargs: None)
    app.root = SimpleNamespace(after=after)
    app._set_buttons_state = lambda _state: None
    app._action_done = lambda _label, _result: None
    app._action_error = lambda label, exc: errors.append((label, str(exc)))
    app._sync_manual_controls = lambda: None

    app._run_action("Exploding action", lambda: (_ for _ in ()).throw(RuntimeError("boom")))

    assert callback_ready.wait(2)
    assert len(callbacks) == 1
    callbacks[0]()
    assert errors == [("Exploding action", "boom")]
