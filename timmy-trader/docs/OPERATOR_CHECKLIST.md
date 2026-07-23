# Timmy Operator Checklist

Use this checklist before, during, and after Timmy decision cycles. It is written for cautious operation across the current equity path, paper/live mode, crypto scouting, commodity ETF exposure, and future crypto/futures enablement.

For the end-to-end validation, live brokerage, all-market scanning, Webull watchlist sync, and publication workflows, use `docs/WORKFLOWS.md`.

Timmy is a decision and order-planning tool. It does not guarantee profits, and live automation should stay off unless the broker account, market data, preview path, and risk limits are known-good for the exact asset class being traded.

## 1. Daily Setup

- Confirm only one Timmy instance is running for the active runtime home.
- Confirm the `.env` file belongs to this machine and account; do not paste broker credentials, secrets, tokens, MFA codes, or screenshots into chat.
- Confirm the intended execution target before loading plans:
  - `Paper` for normal testing, scouting, and training-data collection.
  - `Live` only after paper evidence, account checks, Webull preview, and live switches are intentionally enabled.
- Confirm the intended operation mode:
  - `User` for manual review and confirmation before live submit attempts.
  - `Auto` only when market-open automation and broker/account checks are ready for the current target.
- Review active risk limits before market open:
  - `MIN_SCORE_TO_TRADE`
  - `RISK_PER_TRADE_USD`
  - `MAX_POSITIONS`
  - `MAX_DAILY_TRADES`
  - `MAX_SYMBOL_DAILY_TRADES`
  - `ORDER_COOLDOWN_MINUTES`
  - `MIN_REWARD_RISK_TO_TRADE`
  - `MAX_SIGNAL_VOLATILITY_PCT`
  - `MAX_PRICE_OVER_SMA20_PCT`
  - `MAX_PRICE_OVER_SMA50_PCT`
  - `MAX_RSI_TO_BUY`
  - `MAX_ENTRY_CASH_PCT`
  - `WEBULL_MAX_ORDER_NOTIONAL_USD`
  - `WEBULL_MAX_ORDER_QUANTITY`
- Confirm unsupported asset-class live switches remain off unless they are part of the planned test:
  - `ENABLE_CRYPTO_TRADING=0`
  - `ENABLE_FUTURES_TRADING=0`
  - `ENABLE_OPTIONS_TRADING=0`
  - `ENABLE_EVENT_CONTRACT_TRADING=0`

## 2. Pre-Market Checklist

- Run or open Timmy early enough to let startup complete: config, journals, market data, paper reconciliation, trade plans, and dashboard rendering.
- Check the Decision Brief for enabled asset classes, configured non-equity symbols, and scouting-only warnings.
- Confirm the watchlist is the intended one for the session:
  - Equities and ETFs in the normal equity watchlist.
  - Crypto in a separate crypto watchlist for scouting and paper only.
  - Commodity ETFs/equities in a separate commodity watchlist when possible.
  - Futures symbols in a separate futures watchlist for context only until futures support is deliberately enabled.
- Confirm market data freshness and timestamps. Do not act on stale, duplicated, missing, or malformed candles.
- Confirm market data and watchlist defaults fit the session:
  - `MARKET_DATA_PROVIDER=csv` keeps local CSV data as the predictable default.
  - `MARKET_DATA_MAX_AGE_MINUTES=15` controls when the native app treats local market data as stale.
  - `WATCHLIST_PATH=watchlist.txt` and `WATCHLIST_TEMPLATE=equity` keep the default watchlist on equities/ETFs.
- Check market calendar status:
  - Regular US equity session is normally 9:30 a.m. to 4:00 p.m. Eastern.
  - Avoid fresh equity automation on holidays, weekends, unknown calendar status, or early-close uncertainty.
  - Extended-hours execution should remain off unless it was intentionally configured and tested.
- Review scheduled risk events:
  - Broad market news, Fed events, CPI/jobs data, earnings clusters, major index rebalances, halts, and outage notices.
  - For commodity ETFs, review commodity-specific news such as OPEC decisions, inventory reports, weather shocks, crop reports, shipping disruptions, and futures roll dates.
  - For crypto scouting, review weekend liquidity, exchange outages, custody restrictions, unusually wide spreads, and major protocol/exchange news.
- If Webull will be used, run an account check before the open:

```bash
timmy webull-check
```

- If account check fails, stay in `Paper` and do not attempt live preview or live submit.

## 3. Market-Open Checklist

- Wait for opening volatility to settle unless the strategy and limits were explicitly tuned for the first minutes.
- Refresh data after the open; do not use a stale pre-market dashboard snapshot.
- Confirm Timmy's market-session gate agrees with the intended workflow.
- Confirm there are no duplicate Timmy processes, background services, or stale locks controlling the same runtime home.
- Confirm broker state is known before any live path:
  - Account selected.
  - Available cash or buying power visible.
  - Positions visible.
  - Open orders visible or confirmed unavailable in a way that blocks submission.
- Red flag: if Timmy just restarted, the broker disconnected, or market data failed during the same cycle, refresh account/order state before previewing or submitting.

## 4. Auto/User Mode

Use `User` mode as the default.

- In `User` mode:
  - Review the ranked plan, sensible score, entry, stop, target, quantity, and blocking reasons.
  - Use paper trading for data collection.
  - Use Webull preview before considering any live submit.
  - Treat manual confirmation as the last gate, not as a replacement for missing broker or data checks.

- In `Auto` mode:
  - Use only when the current target is intentional and risk limits are conservative.
  - Confirm manual execution buttons are locked while automation is active.
  - Keep `Stop` available and use it if data, broker sync, or market conditions become uncertain.
  - Do not run Auto live immediately after a restart until journals, open orders, current positions, and market data are reconciled.
  - For `Live / Auto`, Timmy previews the exact current Webull order payload immediately before attempting live submit.
- Auto paper is acceptable for market-open training if data freshness and duplicate-entry controls are working.
- Auto live should remain disabled unless every live switch, broker preview requirement, and account permission is already confirmed.
- Safe market-open automation defaults are `AUTO_START_PAPER_ON_MARKET_OPEN=1`, `AUTO_START_LIVE_ON_MARKET_OPEN=0`, and `MARKET_OPEN_POLL_SECONDS=30`.

## 5. Paper/Live Toggle

Default to `Paper`.

- Use `Paper` for:
  - New symbols.
  - New watchlists.
  - New asset classes.
  - Crypto scouting.
  - Futures context.
  - Commodity ETF experiments before any live promotion.
  - Any day with questionable market data, broker sync, or abnormal volatility.

- Consider `Live` only when:
  - The setup has enough paper samples across multiple sessions.
  - The symbol is approved for live trading.
  - The exact broker account and asset class are confirmed.
  - Webull account check succeeds.
  - Webull preview succeeds for the exact order payload.
  - Position and open-order state are known.
  - Live switches are intentionally enabled.
  - Risk caps are small enough that a bad fill is acceptable.

- Stay in `Paper` when:
  - Paper sample size is small.
  - Wins are concentrated in one symbol, one day, or one market condition.
  - Paper P/L depends on ambiguous candles.
  - The asset has unknown tick size, fees, precision, multiplier, leverage, session, or minimum order size.
  - The broker can display the asset but cannot preview the exact order path.

## 6. Webull Preview Gate

Preview is the live-path rehearsal. It should happen before live placement.

- Run a fresh plan before preview:

```bash
timmy plan --data examples/sample_bars.csv
timmy webull-preview --data examples/sample_bars.csv
```

- Confirm the preview matches the plan:
  - Symbol.
  - Side.
  - Quantity.
  - Limit price.
  - Account.
  - Market.
  - Instrument type.
  - Trading session.
  - Notional and risk caps.
- In the native GUI, live submit requires the exact current preview to be less than three minutes old and tied to the same configured account.
- In `Live / Auto`, that exact preview is performed inside the automation cycle before the submit gate runs.
- For current equities/ETFs, expect US equity-style payloads and regular-session behavior unless intentionally changed.
- Keep `WEBULL_REQUIRE_PREVIEW=1` until the final approved-account order preview/place method is tested.
- Red flag: if preview fails, is unavailable, uses the wrong instrument type, or cannot confirm quantity/price constraints, do not submit live.
- Red flag: never send crypto, futures, options, event contracts, direct indexes, forex, CFDs, or unsupported instruments through an equity payload.

## 7. Equity And ETF Operation

Current baseline: equities and liquid ETFs are the supported live path.

Green flags:

- Listed stock or ETF with normal volume and tight spread.
- Market calendar, quote timestamp, and candle timestamp agree.
- Symbol is in the approved watchlist.
- Entry is a limit buy below the latest close.
- Stop is below entry and target is above entry.
- Reward/risk clears the configured minimum.
- Quantity fits risk per trade, notional cap, quantity cap, and available cash.
- No cooldown, daily trade cap, per-symbol cap, or recent rejection block is active.
- Webull preview confirms the same equity order shape Timmy planned.

Red flags:

- Halt, delisting notice, symbol migration, reverse split, merger, or unusual corporate action.
- Thin volume, wide bid/ask spread, stale indicative value, or low-liquidity ETF.
- Leveraged or inverse ETF treated like a plain index proxy.
- Pre-market or after-hours move used while extended-hours execution is disabled.
- RSI, moving averages, or volatility show an already-stretched entry.
- Stop distance is invalid or too wide for the account.
- Duplicate order is already pending for the symbol.

## 8. Crypto Scouting

Current default: crypto is scouting, backtest, and paper-only unless explicit crypto support is deliberately enabled and previewed.

Use crypto scouting to watch movement, not to sneak live orders through the equity path.

Green flags for scouting/paper:

- Crypto symbols live in a separate watchlist.
- Pair mapping is understood, such as `BTC-USD` for data versus `BTCUSD` for broker-facing models.
- Quote currency, minimum order size, precision, spread, and fees are known.
- Paper samples include weekends, overnight periods, high-volatility moves, and broker maintenance windows.
- Timmy labels the asset class correctly and does not treat the pair as an equity.

Red flags:

- Crypto symbol falls through as an equity.
- Weekend spread or outage makes target/stop distances unrealistic.
- Broker account can show crypto but cannot preview or place crypto through the current API permission.
- Spot crypto is confused with margin, lending, staking, perpetual futures, or derivatives.
- Equity market-closed logic is used as the only crypto safety gate.

Before any future crypto live enablement:

- Confirm broker account permission for crypto.
- Confirm exact broker symbol format.
- Confirm order preview for the crypto payload.
- Confirm quantity precision, minimum size, fees, and session/freshness rules.
- Keep live notional caps smaller than equity caps until the path has a track record.

## 9. Commodity ETF Operation

Prefer commodity exposure through liquid ETFs, ETNs, or equities that the current equity path can preview. Keep direct commodities, futures, CFDs, and leveraged commodity products blocked unless a dedicated adapter and risk model exist.

Green flags:

- Product previews as an equity order through Webull.
- Liquidity, spread, and assets under management are acceptable.
- The operator understands the product exposure: spot, futures basket, miners, shipping, storage, roll yield, leverage, inverse behavior, or decay.
- The trade window avoids major scheduled commodity events unless that risk is intentional.
- Stop/target distances account for overnight moves in the underlying commodity or futures market.

Red flags:

- Futures contract, option on futures, CFD, or direct commodity is mixed into the equity watchlist.
- Leveraged or inverse commodity ETP is treated like a simple ETF.
- Front-month roll, delivery risk, storage shock, weather event, geopolitical shock, or inventory release is ignored.
- Product has low volume, wide spread, high decay, or path-dependent behavior.

## 10. Future Crypto/Futures Enablement

Do not enable future asset classes because chart data exists. Enable them only when Timmy, the broker, and the account all support the actual order path.

Minimum gates before promotion beyond paper:

- Separate watchlist and asset-class label.
- Broker account permission for the asset class.
- Broker preview for the exact order payload.
- Correct symbol mapping between data source, Timmy, and broker.
- Asset-specific session and quote-freshness rules.
- Sizing for tick size, precision, minimum order size, contract multiplier, leverage, fees, margin, and settlement.
- Stop/target logic that reflects realistic spreads, gaps, and liquidity.
- Paper results across multiple sessions and volatility regimes.
- Live switches still default off after the code path is added.

Futures-specific red flags:

- Contract multiplier or tick value is unknown.
- Expiration, rollover, or delivery risk is ignored.
- Margin requirement or liquidation behavior is unknown.
- Session break, exchange maintenance, or holiday schedule is not modeled.
- One futures symbol maps to the wrong contract month.

## 11. Trade Decision Red/Green Flags

Green means continue to the next gate. Red means block, downgrade to watch, or require manual review.

Green flags:

- Fresh data.
- Approved symbol.
- Known asset class.
- Known market session.
- Normal liquidity.
- Volume confirms the move.
- Reward/risk clears the threshold.
- Quantity respects all caps.
- Cash or buying power is known.
- No duplicate order or cooldown conflict.
- Preview succeeds before live placement.

Red flags:

- Stale or conflicting data.
- Unknown broker state.
- Unknown open orders.
- Unknown position exposure.
- Unknown asset class or symbol mapping.
- Unsupported instrument treated as an equity.
- Market-wide shock, halt, outage, or extreme gap.
- Thin liquidity, wide spread, or low volume.
- Overheated RSI or price stretched far above moving averages.
- Daily cap, symbol cap, recent rejection block, or loss limit is active.
- Broker preview fails or returns a different order shape than expected.

## 12. Post-Trade Review

Do this after paper cycles and any live attempt.

- Review `execution-events.jsonl` for every paper, preview, block, submit attempt, fill, cancel, failure, and reconciliation event.
- Check whether the audit chain shows a warning. If it does, stop automation and inspect the journal before continuing.
- Review `trade-journal.jsonl` and `paper-training-summary.json` after paper sessions.
- Record whether each outcome was:
  - Target hit.
  - Stopped.
  - Pending.
  - Rejected.
  - Cancelled.
  - Blocked by controls.
  - Skipped due to data or broker uncertainty.
- Compare the trade against the original signal:
  - Did the candle timestamp match the decision?
  - Did the scout score and sensible score justify action?
  - Did volatility expand after entry?
  - Did volume confirm or fade?
  - Did stop/target distances fit the actual spread?
  - Did broker preview or account state differ from the plan?
- For paper promotion, keep results separated by asset class. Do not let strong equity paper results justify crypto, futures, or commodity ETF live automation.
- If a red flag appeared during or after the trade, lower size, tighten watchlists, return to `Paper`, or disable Auto until the cause is understood.

## 13. Stop Conditions

Stop Timmy automation and return to `User` plus `Paper` when any of these happen:

- Market data is stale, missing, or inconsistent.
- Broker account, positions, or open orders are unknown.
- Webull preview fails or returns unexpected fields.
- Multiple Timmy instances are active.
- Audit warning appears.
- Network or broker errors repeat.
- A symbol maps to the wrong asset class.
- A trade is placed, rejected, or cancelled for an unknown reason.
- Market conditions change faster than the configured risk model can handle.
- You cannot explain why Timmy wants to trade the top-ranked plan.
