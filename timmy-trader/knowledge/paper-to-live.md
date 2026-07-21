# Paper To Live Promotion

Paper trading is the evidence loop before live automation.

- Store signal snapshot, scout score, sensible score, controls, plan, and outcome.
- Compare target-hit, stopped, pending, win rate, symbol P/L, and net paper P/L.
- Promote a symbol or setup only after enough paper samples exist across different sessions.
- Keep paper and live logs separate but comparable.
- Use conservative OHLC simulation: if stop and target are both hit in one candle, count stop first.
- Do not use paper success as proof of future live profits; use it to reject weak settings faster.
- Run separate paper cohorts by asset class; crypto, forex, commodity proxies, and equity ETFs should not share one promotion threshold.
- Paper-test non-equity assets through weekend, overnight, news, and high-spread periods before considering live support.
- Do not promote a new asset class unless the broker adapter can preview the exact live payload and Timmy can size the instrument with its real tick, precision, fee, and session rules.
