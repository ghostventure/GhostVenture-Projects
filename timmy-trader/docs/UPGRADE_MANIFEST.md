# Timmy Upgrade Manifest

This manifest maps the 40 requested upgrades to their owner module, owner GUI
surface, current installation status, and verification contract. Keep this file
updated whenever an upgrade moves from design hook to implementation.

Status vocabulary:

- `Installed hook`: documented owner, workflow contract, and verification target exist.
- `Planned implementation`: owner is assigned, but runtime behavior still needs code.
- `Existing surface`: Timmy already has a related runtime or GUI surface that future work should extend.

## Upgrade Map

| # | Upgrade | Owner module | Owner surface | Status | Verification contract |
| --- | --- | --- | --- | --- | --- |
| 1 | Supervisor/watchdog service | `scripts/launch_timmy.sh`, future service runner | Account Readiness | Planned implementation | Timmy restarts once, avoids duplicate processes, records restart reason. |
| 2 | Broker reconciliation loop | `trend_trader/brokers/*`, execution journal | Broker Desk | Planned implementation | Journal, broker orders, positions, fills, rejects, and cancels reconcile without exposing secrets. |
| 3 | Account Readiness panel | future health view backed by shared runtime state | Account Readiness | Installed hook | Process, data, broker, cash/buying power, watchlists, orders, trade log, scan, response, and watchdog states report one standard status. |
| 4 | Failure classifier | execution, broker, scanner, audit shared classifiers | Trade Log | Planned implementation | Blocks are classified as data, broker, credential, market, cash, preview, submit, cooldown, cap, or system. |
| 5 | Backtest/replay tab | future replay engine, historical data loader | Trading Scoreboard | Planned implementation | Recent data replays under the selected strategy profile without touching live state. |
| 6 | Strategy preset profiles | strategy config and settings persistence | Today's Guardrails | Planned implementation | Conservative, balanced, aggressive, volatility, liquidity, and fractional profiles round-trip through saved settings. |
| 7 | Position manager | broker positions, execution journal | Broker Desk | Planned implementation | Open positions, average entry, exposure, stop/target state, and duplicate-entry gates agree with broker read-back. |
| 8 | Pre-market readiness automation | scheduler, scanner, account check, readiness check | Account Readiness | Planned implementation | Market-open routine runs scan, account check, watchlist sync, risk check, and readiness classification. |
| 9 | Settings import/export | setup profile, UI settings, config serializer | Account Setup | Planned implementation | Export omits secrets unless encrypted locally; import restores non-secret settings and validates schema. |
| 10 | Desktop notifications | future notification adapter, execution events | Account Readiness | Installed hook | Critical, warning, and info notifications are backed by journaled events. |
| 11 | Order fill tracker | broker order read-back, execution journal | Broker Desk | Planned implementation | Submitted orders transition to filled, partial, canceled, rejected, or unknown from broker evidence. |
| 12 | Open order monitor | broker open-order endpoint, execution loop | Broker Desk | Planned implementation | Duplicate orders are blocked when an open order exists for the same account/symbol/side. |
| 13 | Cancel/replace order logic | broker order adapter, execution controls | Orders Ready | Planned implementation | Cancel and replace actions require known order IDs and journal every broker response. |
| 14 | Trailing stop support | risk model, execution planner | Orders Ready | Planned implementation | Trailing stops use asset-specific tick/precision rules and never exceed risk caps. |
| 15 | Partial profit-taking rules | strategy and execution planner | Today's Guardrails | Planned implementation | Split exits have explicit targets, remaining quantity, and journaled reason codes. |
| 16 | Daily loss circuit breaker | risk model, journal analytics | Orders Ready | Planned implementation | Live and auto modes block once realized plus known open risk crosses the configured daily loss cap. |
| 17 | Max drawdown circuit breaker | analytics, risk model | Orders Ready | Planned implementation | Automation blocks when rolling drawdown crosses the configured limit. |
| 18 | Per-symbol exposure limits | risk model, position manager | Orders Ready | Planned implementation | New plans block when current plus planned exposure exceeds symbol cap. |
| 19 | Sector/industry exposure limits | symbol metadata, risk model | Today's Guardrails | Planned implementation | Plans classify sector/industry and block correlated overexposure. |
| 20 | Liquidity filter upgrades | scanner, market data quality checks | Market Pulse | Planned implementation | Volume, dollar volume, spread, and stale quote gates appear in movement detail. |
| 21 | Spread/slippage guard | broker quotes, planner, risk model | Orders Ready | Planned implementation | Plans block or resize when spread/slippage exceeds configured thresholds. |
| 22 | Volatility regime detector | market data analytics, strategy | Today's Guardrails | Planned implementation | Strategy labels current regime and adjusts readiness gates by profile. |
| 23 | Market trend filter | benchmark data, strategy | Today's Guardrails | Planned implementation | Long trades block or down-rank when broad market trend conflicts with profile rules. |
| 24 | News/event risk filter | future event data adapter | Today's Guardrails | Planned implementation | Scheduled or severe event flags block or downgrade symbols before execution. |
| 25 | Earnings-date avoidance | future corporate calendar adapter | Today's Guardrails | Planned implementation | Symbols with earnings inside the configured window are blocked or require manual review. |
| 26 | Halt/suspension detector | market data, broker quotes | Market Pulse | Planned implementation | Halted, suspended, delisted, or abnormal symbols are excluded from active/trade-ready watchlists. |
| 27 | Duplicate trade prevention | execution journal, open orders, positions | Orders Ready | Existing surface | Same-symbol duplicates are blocked using cooldowns, caps, open orders, and position evidence. |
| 28 | Broker session refresh handling | broker adapter, setup profile | Broker Desk | Planned implementation | Expired sessions become `Guarded` or `Blocked`, refresh locally, and never log credentials. |
| 29 | Credential expiry warnings | setup verification, account check | Account Setup | Planned implementation | Expired or invalid credentials block save and raise a warning-class notification. |
| 30 | Watchlist sync read-back verification | Webull watchlist sync adapter | Market Pulse | Existing surface | Timmy-managed Webull watchlists are read back by name/count/symbol without exposing internal IDs. |
| 31 | Trade-ready reason inspector | scanner, strategy, risk blockers | Today's Guardrails | Planned implementation | Each trade-ready or blocked symbol shows the reason stack from scan through broker gates. |
| 32 | Why no trade diagnostics panel | shared classifier, strategy, execution | Trading Scoreboard | Planned implementation | No-trade sessions group blockers by data, strategy, risk, broker, account, market, and system state. |
| 33 | Strategy change audit log | settings persistence, audit journal | Trade Log | Planned implementation | Strategy changes write who/when/what summaries without secrets. |
| 34 | Config versioning/rollback | setup profile, settings store | Account Setup | Planned implementation | Config snapshots can roll back locally and preserve credential safety. |
| 35 | Safe mode boot option | launcher, config loader | Account Readiness | Planned implementation | Safe mode starts Paper/User, disables broker submit, and loads minimal recoverable state. |
| 36 | Crash recovery report | launcher, crash log, audit journal | Account Readiness | Planned implementation | Crash reports show last action, exception, restart result, and recovery recommendation. |
| 37 | Local encrypted profile vault | setup profile storage | Account Setup | Planned implementation | Credentials are encrypted locally and never written to source, logs, screenshots, or public mirror. |
| 38 | Paper vs Live Scorecard | journals, execution events, analytics | Trading Scoreboard | Installed hook | Plans, previews, submits, fills, rejects, skips, and P/L fields compare by symbol/session/profile. |
| 39 | Trading Scoreboard | journals, paper summary, analytics | Trading Scoreboard | Installed hook | Win rate, expectancy, drawdown, reward/risk, follow-through, time-of-day, volatility, rejection, and profile metrics render from journals. |
| 40 | One-click Account Check before live trading | health check runner, broker/scanner/audit readers | Account Readiness | Installed hook | Read-only check reports process, profile, broker, data, session, watchlists, queue, trade log, integrity, and source boundary state. |

## Installed Documentation Hooks

The GUI/workflow standardization slice installs these documentation contracts:

- Account Readiness panel design hooks.
- Desktop notification hooks.
- One-click Account Check contract.
- Paper vs Live Scorecard hook.
- Trading Scoreboard hook.
- Setup/workflow standardization docs.
- Setup boilerplates for paper, guarded live, and runtime reliability examples.
- Tab ownership standard.
- Operator checklist updates.
- Redundant widget audit notes.
- Upgrade manifest for all 40 items.

## Placement Rules

- New health and system-readiness work belongs to Account Readiness.
- New report bodies belong to Trading Scoreboard.
- Broker raw responses stay in Broker Desk.
- Execution actions stay in Orders Ready.
- Strategy and blocker explanations stay in Today's Guardrails.
- Overview receives only compact summaries and must not become a duplicate owner tab.
