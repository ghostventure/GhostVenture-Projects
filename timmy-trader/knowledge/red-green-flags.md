# Red And Green Flags

Green flags mean a setup can continue to the next gate. Red flags mean block, downgrade, or require manual review.

## Market Context

Green flags:

- Regular market session is open.
- Market calendar confirms the exchange is open.
- Data timestamp is fresh enough for the configured workflow.
- Spread, liquidity, and volume are normal for the symbol.
- The symbol is in the approved watchlist.
- Asset class, broker account type, and symbol format are explicitly known.
- The symbol is either supported for the current live path or marked paper/context-only.

Red flags:

- Market is closed, on holiday, or in an early-close window the system does not understand.
- Data is stale, missing, malformed, duplicated, or from a different session.
- Symbol is not in the approved universe.
- Sudden market-wide news, halt, limit-up/limit-down, or extreme gap is detected.
- Liquidity is thin or volume is below baseline.
- Crypto, forex, futures, CFD, option, or direct-index symbol is treated as an equity.
- Broker account can show the asset but cannot preview or place that asset through the current API path.

## Scouting

Green flags:

- Latest move crosses the configured vigilance threshold.
- Three-bar acceleration confirms the move.
- Volume is above recent baseline.
- Range expansion confirms meaningful movement.
- Bullish move is near recent highs with trend support.
- Bearish move is recognized as a risk/watch alert when short logic is disabled.

Red flags:

- Quiet symbol with no material movement.
- Move is only a low-volume drift.
- RSI is extreme and price is already stretched.
- Volatility is too high for the current stop/target model.
- Signal depends on one bar only and lacks volume or trend confirmation.

## Trade Plan

Green flags:

- Entry is a limit buy below the latest close.
- Reward/risk clears the minimum threshold.
- Stop is below entry and target is above entry.
- Quantity respects risk per trade, max notional, max quantity, and cash cap.
- No cooldown or daily cap is active for the symbol.
- Instrument type, tick size, minimum quantity, session, and fees are known.

Red flags:

- Quantity calculates to zero.
- Entry is above cash cap or notional cap.
- Stop distance is invalid or too wide for the account.
- Reward/risk is thin.
- Recent rejected, failed, cancelled, or stopped events hit the configured threshold.
- Daily trade cap, per-symbol cap, or daily loss cap is already reached.
- Contract multiplier, leverage, rollover, borrow, expiration, or quote currency is unknown.

## Paper Trading

Green flags:

- Paper entry includes signal snapshot, scout score, sensible score, controls, and candle timestamp.
- Outcome can be reconciled to target-hit, stopped, or pending.
- Performance is consistent across multiple sessions and symbols.
- Paper results agree with backtest directionally.

Red flags:

- Paper sample size is too small.
- Wins are concentrated in one symbol, one day, or one market condition.
- Paper P/L depends on ambiguous OHLC candles.
- Strategy changes are promoted without paper or backtest evidence.
- Paper automation creates duplicate entries for the same symbol during cooldown.

## Live Trading

Green flags:

- Live switches are intentionally enabled.
- Broker account, cash, positions, and open orders are known.
- Broker preview succeeds.
- No duplicate order is pending for the symbol.
- Live target is selected and mode matches the intended workflow.

Red flags:

- Any live switch is off.
- Broker sync fails or account state is unknown.
- Open orders cannot be queried.
- Position exposure is unknown.
- Preview is required but not completed.
- Network, broker, or data errors occurred during the same cycle.
- The system just restarted and has not reconciled journals, open orders, and current positions.

## Operational Health

Green flags:

- One Timmy instance is running.
- Audit chain is valid.
- Market data loaded once and refresh completed.
- No web port is open for native-only operation.
- Service scaffold is disabled unless intentionally enabled.

Red flags:

- Multiple Timmy processes are running.
- Audit warning appears.
- Journal or event log is malformed.
- Repeated refresh failures occur.
- Background service and GUI are both attempting to control the same runtime home.
- Runtime config differs from the expected trading mode.
