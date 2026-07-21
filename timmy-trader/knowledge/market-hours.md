# Market Hours

Market-session rules protect automation from bad timing.

- Regular US equity session is 9:30 a.m. to 4:00 p.m. Eastern unless the exchange is closed or has an early close.
- Do not start market-open automation on weekends or known market holidays.
- Treat early closes as shortened sessions.
- Avoid placing fresh strategies immediately after an outage, reconnect, or calendar uncertainty.
- Extended-hours trading should stay off unless explicitly configured and tested.
- Crypto may trade 24/7, but broker maintenance, weekend liquidity, exchange outages, and wider spreads still require a separate session/freshness model.
- Forex usually trades 24/5 with weekend gaps and regional session handoffs; do not reuse equity open/close gates for live FX.
- Commodity ETFs follow equity hours, while underlying commodity or futures markets may move outside those hours.
- Direct futures and CFDs have contract/session rules Timmy does not currently model; keep them unsupported for live execution.
