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

## Non-Negotiable Controls

- Never trade outside whitelist without explicit config change.
- Never exceed max notional or max quantity.
- Never live trade unless all live switches are enabled.
- Never route crypto, futures, options, event contracts, forex, CFDs, or unsupported instruments through an equity payload.
- Never store raw broker credentials in source control.
- Always log why a trade was entered, skipped, or blocked.
