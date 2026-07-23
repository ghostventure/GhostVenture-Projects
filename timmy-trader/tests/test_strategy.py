from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timedelta

from trend_trader.brokers.webull_openapi import WebullOpenApiBroker
from trend_trader.asset_classes import enabled_asset_classes
from trend_trader.config import load_config
from trend_trader.models import Candle, OrderPlan, Signal
from trend_trader.risk import create_order_plan
from trend_trader.strategy import rank_signals, score_symbol


def make_bars(symbol: str = "SPY") -> list[Candle]:
    start = datetime(2026, 1, 1, 9, 30)
    bars = []
    price = 100.0
    for index in range(60):
        price += -0.15 if index % 6 == 0 else 0.35
        if index == 59:
            price += 3.4
        volume = 1_000_000 if index < 59 else 1_900_000
        bars.append(
            Candle(
                symbol=symbol,
                timestamp=start + timedelta(minutes=index),
                open=price - 0.2,
                high=price + 0.5,
                low=price - 0.5,
                close=price,
                volume=volume,
            )
        )
    return bars


def test_scores_trending_symbol_as_eligible() -> None:
    signal = score_symbol("SPY", make_bars())
    assert signal.score >= 72
    assert signal.scout_score >= 72
    assert signal.scout_action == "alert"
    assert signal.decision == "eligible"
    assert signal.sensible_score >= 78
    assert signal.sensible_action == "trade"
    assert signal.direction == "bullish"
    assert signal.change_pct >= 2.5
    assert signal.entry < signal.close
    assert signal.stop < signal.entry
    assert signal.target > signal.entry
    assert signal.reward_risk >= 1.5


def test_scores_bearish_change_as_watch_not_live_plan() -> None:
    bars = make_bars("QQQ")
    previous = bars[-2].close
    bars[-1] = Candle(
        symbol="QQQ",
        timestamp=bars[-1].timestamp,
        open=previous,
        high=previous + 0.2,
        low=previous * 0.94,
        close=previous * 0.96,
        volume=2_200_000,
    )
    signal = score_symbol("QQQ", bars)
    assert signal.direction == "bearish"
    assert signal.change_pct <= -2.5
    assert signal.scout_action in {"alert", "watch"}
    assert signal.decision == "watch"
    assert signal.sensible_action in {"watch", "avoid"}


def test_aggressive_style_collects_smaller_market_moves() -> None:
    bars = make_bars("SPY")
    previous = bars[-2].close
    bars[-1] = Candle(
        symbol="SPY",
        timestamp=bars[-1].timestamp,
        open=previous,
        high=previous * 1.025,
        low=previous * 0.998,
        close=previous * 1.02,
        volume=2_000_000,
    )

    aggressive = score_symbol("SPY", bars, trading_style="aggressive")
    conservative = score_symbol("SPY", bars, trading_style="conservative")

    assert aggressive.direction == "bullish"
    assert conservative.direction == "neutral"
    assert aggressive.scout_score > conservative.scout_score


def test_pattern_filter_can_keep_breakout_watch_only() -> None:
    bars = make_bars("SPY")

    enabled = score_symbol("SPY", bars)
    filtered = score_symbol("SPY", bars, enabled_trade_patterns={"momentum", "pullback", "volume"})

    assert enabled.setup == "breakout"
    assert enabled.decision == "eligible"
    assert filtered.decision == "watch"
    assert any("breakout pattern is disabled" in reason for reason in filtered.reasons)


def test_quiet_symbol_does_not_create_trade_alert() -> None:
    bars = make_bars("DIA")
    previous = bars[-2].close
    bars[-1] = Candle(
        symbol="DIA",
        timestamp=bars[-1].timestamp,
        open=previous,
        high=previous + 0.15,
        low=previous - 0.15,
        close=previous + 0.05,
        volume=500_000,
    )
    signal = score_symbol("DIA", bars)
    assert signal.scout_action == "quiet"
    assert signal.decision == "skip"


def test_order_plan_respects_risk_limits(monkeypatch) -> None:
    monkeypatch.setenv("WEBULL_SYMBOL_WHITELIST", "SPY")
    monkeypatch.setenv("WEBULL_MAX_ORDER_NOTIONAL_USD", "250")
    monkeypatch.setenv("WEBULL_MAX_ORDER_QUANTITY", "10")
    monkeypatch.setenv("ENABLE_EQUITY_FRACTIONAL_TRADING", "0")
    config = load_config()
    signal = score_symbol("SPY", make_bars())
    plan = create_order_plan(signal, config)
    assert plan is not None
    assert plan.limit_price == signal.entry
    assert plan.limit_price < signal.close
    assert plan.target_price > plan.limit_price
    assert plan.notional <= 250
    assert plan.quantity <= 10
    assert plan.instrument_type == "EQUITY"


def test_order_plan_respects_configured_min_score(monkeypatch) -> None:
    monkeypatch.setenv("WEBULL_SYMBOL_WHITELIST", "SPY")
    monkeypatch.setenv("MIN_SCORE_TO_TRADE", "101")
    config = load_config()
    signal = score_symbol("SPY", make_bars())
    assert signal.score < 101
    assert create_order_plan(signal, config) is None


def test_equity_fractional_plan_when_notional_is_below_one_share(monkeypatch) -> None:
    monkeypatch.setenv("WEBULL_SYMBOL_WHITELIST", "AMD")
    monkeypatch.setenv("WEBULL_MAX_ORDER_NOTIONAL_USD", "250")
    monkeypatch.setenv("WEBULL_MAX_ORDER_QUANTITY", "10")
    monkeypatch.setenv("ENABLE_EQUITY_FRACTIONAL_TRADING", "1")
    config = load_config()
    signal = Signal(
        symbol="AMD",
        score=90,
        decision="eligible",
        direction="bullish",
        setup="fractional equity test",
        reasons=("test",),
        close=544.43,
        change_pct=8.11,
        entry=533.54,
        stop=484.53,
        target=651.17,
        volatility_pct=1.0,
        volume_ratio=2.0,
        reward_risk=2.4,
        expense_status="fair",
        expense_reasons=(),
        sensible_score=90,
        sensible_action="trade",
        scout_score=90,
        scout_action="alert",
    )

    plan = create_order_plan(signal, config)

    assert plan is not None
    assert 0 < plan.quantity < 1
    assert plan.order_type == "MARKET"
    assert plan.limit_price is None
    assert plan.notional <= 250
    assert "fractional" in plan.reason


def test_equity_fractional_plan_is_prioritized_when_full_shares_fit(monkeypatch) -> None:
    monkeypatch.setenv("WEBULL_SYMBOL_WHITELIST", "SPY")
    monkeypatch.setenv("WEBULL_MAX_ORDER_NOTIONAL_USD", "250")
    monkeypatch.setenv("WEBULL_MAX_ORDER_QUANTITY", "10")
    monkeypatch.setenv("ENABLE_EQUITY_FRACTIONAL_TRADING", "1")
    config = load_config()
    signal = score_symbol("SPY", make_bars())

    plan = create_order_plan(signal, config)

    assert plan is not None
    assert plan.quantity > 1
    assert not float(plan.quantity).is_integer()
    assert plan.order_type == "MARKET"
    assert plan.limit_price is None
    assert plan.notional <= 250
    assert "fractional-priority" in plan.reason


def test_equity_fractional_payload_uses_market_quantity_without_limit(monkeypatch) -> None:
    monkeypatch.setenv("ENABLE_EQUITY_FRACTIONAL_TRADING", "1")
    config = load_config()
    order = OrderPlan(
        symbol="AMD",
        side="BUY",
        quantity=0.4686,
        order_type="MARKET",
        limit_price=None,
        stop_price=484.53,
        target_price=651.17,
        notional=250.02,
        reason="fractional equity payload",
        instrument_type="EQUITY",
    )

    payload = WebullOpenApiBroker(config).new_order_payload(order)

    assert payload["instrument_type"] == "EQUITY"
    assert payload["order_type"] == "MARKET"
    assert payload["quantity"] == "0.4686"
    assert payload["entrust_type"] == "QTY"
    assert "limit_price" not in payload


def test_rank_signals_uses_configured_rsi_expense_threshold(monkeypatch) -> None:
    monkeypatch.setenv("WEBULL_SYMBOL_WHITELIST", "SPY")
    base_config = replace(
        load_config(),
        max_price_over_sma20_pct=0,
        max_price_over_sma50_pct=100,
    )

    lenient_signal = rank_signals(
        {"SPY": make_bars("SPY")},
        replace(base_config, max_rsi_to_buy=100),
    )[0]
    strict_config = replace(base_config, max_rsi_to_buy=70)
    strict_signal = rank_signals({"SPY": make_bars("SPY")}, strict_config)[0]

    assert lenient_signal.expense_status == "fair"
    assert lenient_signal.sensible_action == "trade"
    assert create_order_plan(lenient_signal, base_config) is not None
    assert any("20-period average" in reason for reason in lenient_signal.expense_reasons)
    assert not any("RSI is expensive" in reason for reason in lenient_signal.expense_reasons)

    assert strict_signal.expense_status == "too-expensive"
    assert strict_signal.decision == "watch"
    assert create_order_plan(strict_signal, strict_config) is None
    assert any("RSI is expensive" in reason for reason in strict_signal.expense_reasons)


def test_rank_signals_uses_configured_sma20_expense_threshold(monkeypatch) -> None:
    monkeypatch.setenv("WEBULL_SYMBOL_WHITELIST", "SPY")
    base_config = replace(
        load_config(),
        max_rsi_to_buy=70,
        max_price_over_sma50_pct=100,
    )

    lenient_signal = rank_signals(
        {"SPY": make_bars("SPY")},
        replace(base_config, max_price_over_sma20_pct=100),
    )[0]
    strict_config = replace(base_config, max_price_over_sma20_pct=0)
    strict_signal = rank_signals({"SPY": make_bars("SPY")}, strict_config)[0]

    assert lenient_signal.expense_status == "fair"
    assert lenient_signal.sensible_action == "trade"
    assert create_order_plan(lenient_signal, base_config) is not None
    assert any("RSI is expensive" in reason for reason in lenient_signal.expense_reasons)
    assert not any("20-period average" in reason for reason in lenient_signal.expense_reasons)

    assert strict_signal.expense_status == "too-expensive"
    assert strict_signal.decision == "watch"
    assert create_order_plan(strict_signal, strict_config) is None
    assert any("20-period average" in reason for reason in strict_signal.expense_reasons)


def test_rank_signals_uses_configured_sma50_expense_threshold(monkeypatch) -> None:
    monkeypatch.setenv("WEBULL_SYMBOL_WHITELIST", "SPY")
    base_config = replace(
        load_config(),
        max_rsi_to_buy=70,
        max_price_over_sma20_pct=100,
    )

    lenient_signal = rank_signals(
        {"SPY": make_bars("SPY")},
        replace(base_config, max_price_over_sma50_pct=100),
    )[0]
    strict_config = replace(base_config, max_price_over_sma50_pct=0)
    strict_signal = rank_signals({"SPY": make_bars("SPY")}, strict_config)[0]

    assert lenient_signal.expense_status == "fair"
    assert lenient_signal.sensible_action == "trade"
    assert create_order_plan(lenient_signal, base_config) is not None
    assert any("RSI is expensive" in reason for reason in lenient_signal.expense_reasons)
    assert not any("50-period average" in reason for reason in lenient_signal.expense_reasons)

    assert strict_signal.expense_status == "too-expensive"
    assert strict_signal.decision == "watch"
    assert create_order_plan(strict_signal, strict_config) is None
    assert any("50-period average" in reason for reason in strict_signal.expense_reasons)


def test_default_enabled_asset_classes_keep_equities_on(monkeypatch) -> None:
    monkeypatch.setenv("ENABLE_CRYPTO_TRADING", "0")
    monkeypatch.setenv("ENABLE_FUTURES_TRADING", "0")
    monkeypatch.setenv("ENABLE_OPTIONS_TRADING", "0")
    config = load_config()

    assert enabled_asset_classes(config) == ["EQUITY"]

    signal = score_symbol("SPY", make_bars("SPY"))
    plan = create_order_plan(signal, config)
    assert plan is not None
    assert plan.instrument_type == "EQUITY"
    assert plan.support_trading_session == config.webull_support_trading_session


def test_crypto_plan_requires_enable_switch(monkeypatch) -> None:
    monkeypatch.setenv("WEBULL_SYMBOL_WHITELIST", "BTCUSD")
    monkeypatch.setenv("WEBULL_CRYPTO_SYMBOLS", "BTCUSD")
    monkeypatch.setenv("ENABLE_CRYPTO_TRADING", "0")
    blocked = create_order_plan(score_symbol("BTCUSD", make_bars("BTCUSD")), load_config())
    assert blocked is None

    monkeypatch.setenv("ENABLE_CRYPTO_TRADING", "1")
    monkeypatch.setenv("WEBULL_MAX_CRYPTO_ORDER_NOTIONAL_USD", "100")
    config = load_config()
    plan = create_order_plan(score_symbol("BTCUSD", make_bars("BTCUSD")), config)
    assert plan is not None
    assert plan.instrument_type == "CRYPTO"
    assert plan.quantity < 1
    payload = WebullOpenApiBroker(config).new_order_payload(plan)
    assert payload["instrument_type"] == "CRYPTO"
    assert "support_trading_session" not in payload


def test_futures_plan_requires_enable_switch_and_configured_symbol(monkeypatch) -> None:
    monkeypatch.setenv("WEBULL_SYMBOL_WHITELIST", "ES")
    monkeypatch.setenv("WEBULL_FUTURES_SYMBOLS", "ES")
    monkeypatch.setenv("WEBULL_MAX_FUTURES_CONTRACTS", "1")
    monkeypatch.setenv("ENABLE_FUTURES_TRADING", "0")
    blocked = create_order_plan(score_symbol("ES", make_bars("ES")), load_config())
    assert blocked is None

    monkeypatch.setenv("ENABLE_FUTURES_TRADING", "1")
    plan = create_order_plan(score_symbol("ES", make_bars("ES")), load_config())
    assert plan is not None
    assert plan.instrument_type == "FUTURES"
    assert plan.quantity == 1


def test_options_require_leg_metadata_and_events_stay_blocked(monkeypatch) -> None:
    option_symbol = "SPY260116C00500000"
    event_symbol = "EVENT2026"
    monkeypatch.setenv("WEBULL_SYMBOL_WHITELIST", f"{option_symbol},{event_symbol}")
    monkeypatch.setenv("WEBULL_OPTIONS_SYMBOLS", option_symbol)
    monkeypatch.setenv("WEBULL_EVENT_CONTRACT_SYMBOLS", event_symbol)
    monkeypatch.setenv("ENABLE_OPTIONS_TRADING", "1")
    monkeypatch.setenv("ENABLE_EVENT_CONTRACT_TRADING", "1")

    config = load_config()

    option_plan = create_order_plan(
        score_symbol(option_symbol, make_bars(option_symbol)),
        config,
    )
    event_plan = create_order_plan(
        score_symbol(event_symbol, make_bars(event_symbol)),
        config,
    )

    assert option_plan is None
    assert event_plan is None

    monkeypatch.setenv(
        "WEBULL_OPTION_LEGS_JSON",
        '{"SPY260116C00500000":[{"symbol":"SPY","expiration":"2026-01-16","strike_price":"500","option_type":"CALL","side":"BUY","quantity":"1"}]}',
    )
    option_plan = create_order_plan(
        score_symbol(option_symbol, make_bars(option_symbol)),
        load_config(),
    )
    assert option_plan is not None
    assert option_plan.instrument_type == "OPTION"
    payload = WebullOpenApiBroker(load_config()).new_order_payload(option_plan)
    assert payload["instrument_type"] == "OPTION"
    assert payload["legs"][0]["option_type"] == "CALL"


def test_futures_data_symbols_do_not_fall_through_as_equity(monkeypatch) -> None:
    monkeypatch.setenv("WEBULL_SYMBOL_WHITELIST", "ES=F")
    monkeypatch.setenv("WEBULL_FUTURES_SYMBOLS", "")
    monkeypatch.setenv("ENABLE_FUTURES_TRADING", "1")

    plan = create_order_plan(score_symbol("ES=F", make_bars("ES=F")), load_config())

    assert plan is None


def test_known_crypto_pairs_do_not_fall_through_as_equity(monkeypatch) -> None:
    monkeypatch.setenv("WEBULL_SYMBOL_WHITELIST", "SOLUSD")
    monkeypatch.setenv("WEBULL_CRYPTO_SYMBOLS", "")
    monkeypatch.setenv("ENABLE_CRYPTO_TRADING", "1")

    plan = create_order_plan(score_symbol("SOLUSD", make_bars("SOLUSD")), load_config())

    assert plan is None


def test_webull_crypto_payload_formats_fractional_quantity_without_session(monkeypatch) -> None:
    config = load_config()
    order = OrderPlan(
        symbol="BTCUSD",
        side="BUY",
        quantity=0.12345678,
        order_type="LIMIT",
        limit_price=50500.12,
        stop_price=49000.0,
        target_price=54000.0,
        notional=6234.57,
        reason="crypto payload formatting",
        instrument_type="CRYPTO",
        support_trading_session=None,
    )

    payload = WebullOpenApiBroker(config).new_order_payload(order)

    assert payload["instrument_type"] == "CRYPTO"
    assert payload["quantity"] == "0.12345678"
    assert payload["limit_price"] == "50500.12"
    assert "support_trading_session" not in payload
