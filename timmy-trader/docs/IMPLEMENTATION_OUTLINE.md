# Timmy Implementation Outline

## Phase 1 - Guarded Local Engine

- Load historical/current OHLCV bars.
- Score trend, volume, momentum, volatility, and breakout quality.
- Create risk-capped order plans.
- Paper trade to a local journal.
- Keep live order placement disabled.
- Keep `docs/OPERATOR_CHECKLIST.md` as the operating gate before Auto mode, Live mode, Webull preview, or non-equity expansion.

## Phase 2 - Webull OpenAPI Readiness

- Use official Webull OpenAPI SDK.
- Store App Key, App Secret, Account ID, and endpoint in `.env`.
- Verify account access through `webull-check`.
- Add market-data ingestion from Webull historical bars after credentials are confirmed.

## Phase 3 - Paper Trading Loop

- Scheduled scanner.
- Watchlist/universe loader.
- Paper order lifecycle: submit, stop, target, timeout, close.
- Trade journal with reasons and after-action metrics.

## Phase 4 - Live Controlled Trading

- Validate Webull order preview/place methods in the approved account.
- Require preview before live placement.
- Keep order caps, symbol whitelist, daily loss limit, asset-class switches, and kill switch.
- Keep equities/ETFs as the default live path; crypto and futures require explicit enablement, broker permission, symbol mapping, market data, sizing, session, and preview validation.
- Add reconciliation against broker positions and open orders.

## Phase 5 - Smarter Feedback

- Track setup performance by symbol, time of day, market regime, and volatility.
- Suppress setups that repeatedly fail under similar conditions.
- Prefer symbols with stronger historical follow-through and cleaner liquidity.

## Phase 6 - Trading Desk Workflow Standard

- Keep `Overview` as a compact model snapshot, not a duplicate workspace.
- Assign every widget, action, report, and raw response to one owner tab.
- Add Account Readiness panel hooks for process, data, broker, cash/buying
  power, watchlist, orders ready, trade log, scan, broker-response, and
  watchdog evidence.
- Add desktop notification hooks for critical, warning, and info event classes.
- Add a one-click Account Check contract that is read-only by default and
  reports readiness without placing orders or mutating broker state.
- Add Paper vs Live Scorecard hooks that summarize plan, preview, submit, fill,
  reject, skip, and P/L evidence from existing journals.
- Add Trading Scoreboard hooks that summarize outcomes by symbol, session,
  strategy profile, time of day, and volatility regime.
- Keep `docs/WORKFLOWS.md`, `docs/OPERATOR_CHECKLIST.md`, and
  `docs/UPGRADE_MANIFEST.md` synchronized when new GUI surfaces are added.

## Tab Ownership Contract

- Account Setup owns profile fields, credential verification, account selection,
  local profile files, and setup readiness.
- Market Pulse owns symbol universe state, generated watchlists, rotation,
  Webull watchlist sync, scanned ticker tables, and movement ranking.
- Today's Guardrails owns strategy settings, signal mix, readiness gates,
  pattern/style controls, and eligibility explanations.
- Orders Ready owns executable queue, paper/live controls, fractional routing,
  risk gates, and order actions.
- Broker Desk owns account route state, cash/buying power, preview/submit
  responses, account checks, and broker rejection detail.
- Trade Log owns integrity chain, protected-file state, execution events,
  signed-event coverage, and recent history.
- Account Readiness owns system status summaries, one-click Account Check
  results, watchdog status, and notification readiness.
- Trading Scoreboard owns Paper vs Live Scorecard, performance analytics, and
  strategy outcome summaries.

## Upgrade Hook Contracts

- Account Readiness hooks must read shared runtime state and report `Ready`,
  `Guarded`, `Blocked`, `Unknown`, or `Stale`.
- Notification hooks must be journal-backed and classified as `critical`, `warning`, or `info`.
- One-click Account Check must avoid submit, sync, account switching, journal
  clearing, or live-state mutation unless a separate repair action is
  explicitly selected.
- Paper vs Live Scorecard hooks must compare paper and live outcomes without
  mixing asset classes or strategy profiles.
- Trading Scoreboard hooks must be derived from `trade-journal.jsonl`,
  `execution-events.jsonl`, and paper summary outputs.
- Redundant widgets should be removed, demoted to summaries, or moved to their owner tab before new UI is added.

## Non-Negotiable Controls

- Never trade outside whitelist without explicit config change.
- Never exceed max notional or max quantity.
- Never live trade unless all live switches are enabled.
- Never route crypto, futures, options, event contracts, forex, CFDs, or unsupported instruments through an equity payload.
- Never store raw broker credentials in source control.
- Always log why a trade was entered, skipped, or blocked.
