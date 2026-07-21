# Risk Controls

Use fixed risk rules before any order can become executable.

- Keep live trading disabled unless `TRADER_MODE=live`, `TRADER_LIVE=1`, and `WEBULL_ENABLE_LIVE_ORDERS=1`.
- Cap position size by risk per trade, max notional, max quantity, daily trade count, and symbol cooldown.
- Treat open orders and current positions as exposure before creating new plans.
- Stop trading after daily realized loss reaches `MAX_DAILY_LOSS_USD`.
- Do not increase size after losses without paper or backtest evidence.
- Prefer skipped trades over weak trades when reward/risk, volatility, cash fit, or session timing is unclear.
- Keep new asset classes paper-only until Timmy has broker preview support, session handling, quote freshness checks, sizing precision, and fee/spread treatment for that asset.
- Use tighter notional caps for crypto, currency exposure, commodity products, and leveraged/inverse funds until paper evidence proves the controls are realistic.
- Block live plans for direct indexes, options, futures, CFDs, forex pairs, direct crypto, warrants, rights, mutual funds, bonds, or any symbol with unknown multiplier, tick size, margin, or expiration behavior.
- Treat tradable index and commodity ETFs as equities only when the broker preview confirms the exact instrument and order payload.
