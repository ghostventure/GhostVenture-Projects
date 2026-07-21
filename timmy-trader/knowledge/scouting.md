# Scouting

Scouting decides whether a symbol deserves attention before it becomes a trade.

- Watch latest bar movement, three-bar acceleration, gap movement, volume surge, and range expansion.
- Treat bullish moves near recent highs as stronger watch candidates.
- Treat bearish moves near recent lows as scout alerts, not buy-low entries, unless short logic is explicitly enabled.
- Penalize low-volume moves, excessive volatility, and RSI extremes.
- Rank scout urgency first, then sensible score, then raw scanner score.
- Quiet symbols should not create trade plans.
- Separate scouting from tradability. A symbol can be worth watching even when live execution is unsupported.
- Label asset class before mixing stocks, ETFs, crypto pairs, currency pairs, commodity proxies, and index data in one scan.
- Treat direct indexes as context unless a tradable proxy is mapped.
- Escalate to manual review when symbol format, quote currency, session, or volume field differs from normal equity bars.
