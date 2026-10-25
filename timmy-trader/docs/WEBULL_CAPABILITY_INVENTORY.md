# Webull Capability Inventory

This inventory describes Timmy 0.1.16 in the local per-user overlay. Webull
features are subject to account permissions and API availability; implementation
in Timmy is not evidence that an account or order was exercised.

## Installed

- **Equity/ETF Live Auto:** current signal and market-data freshness checks;
  operational/session, daily loss, trade-count, per-symbol, cooldown, cash,
  quantity and notional gates; exact Webull order preview; a required estimated
  cost under the configured cap; durable signed intent before placement; one
  submission using the same fresh preview receipt; result journaling and an
  unknown-outcome hold/reconciliation path.
- Live Auto requires the saved profile opt-in, Live account mode, Webull live
  order permission, and a completed Account Check. Temporary failures before
  the place-order call are journaled as retryable on a later Auto cycle. An
  uncertain outcome is never retried automatically. Explicit User selection is
  preserved.
- Before an automated Live batch, Timmy reads open orders and positions in a
  background worker. Missing, malformed, or failed snapshots block submission;
  an open or ambiguous order or nonzero position blocks a new entry in that
  symbol. This is read-only exposure protection; Timmy does not auto-cancel,
  reprice, or submit an exit from this check.
- Live Auto evaluates and sizes each equity/ETF candidate from a fresh account,
  position, and open-order snapshot before exact preview. It requires account
  equity, available cash, daily P&L, valid position valuations, priced pending
  BUY orders, current symbol data quality, a session state, and the configured
  exposure/drawdown policy. The policy keys are `AUTO_MAX_SYMBOL_EXPOSURE_PCT`,
  `AUTO_MAX_TOTAL_EXPOSURE_PCT`, and `AUTO_MAX_DRAWDOWN_PCT`. Missing or
  malformed context blocks before preview and shows the missing field/reason.
  Account peak equity is tracked privately per hashed account ID from Timmy's
  first verified snapshot; the drawdown window therefore starts at that time.
- The Automation workspace shows read-only Paper and Simulation closed-trade
  outcomes, win rate, expectancy, realized P&L, applicable returns/drawdown,
  signal cohorts, and explicit fill/slippage coverage. Local candle simulations
  do not imply broker fills; absent fill/slippage evidence stays unavailable.
- Paper and Simulation automation remain local. Simulation remains a separate
  local ledger and does not send broker orders.
- Account/balance/position/open-order reads, order detail/history/executions,
  and confirmed cancel/replace and eligible long-equity reduction workflows.
  Order mutations retain confirmation, intent/result journaling, and unresolved
  outcome guards.
- A secondary manual order workflow with exact preview and explicit
  confirmation for US equities/ETFs, options strategies, futures, and event
  contracts. Its targeted contract discovery is limited to relevant equity,
  options, futures, and event instrument methods.
- On-demand market snapshots for supported instrument classes, including crypto
  market data. Crypto order entry is not offered because Webull does not provide
  the required exact order preview.

The broad raw JSON Research & Discovery console and its 60+ endpoint allowlist
were removed because they did not feed the Auto decision cycle. Timmy does not
start real-time streams. The installed SDK 3.0.4 trade-event client prints
signature/auth metadata and does not expose stream cancellation; the market
stream async helper ignores its logger-disabled argument and its lifecycle
requires a separate reviewed wrapper.

## Still pending or constrained

- Automated planning/execution for options, futures, event contracts, and
  crypto. The current Live Auto planner is equity/ETF focused.
- Automated partial-fill quantity reconciliation, stale-order policies,
  cancel/replace decisions, and stop/target exit orders. Partial status is only
  visible when Webull includes it in the open-order snapshot. Existing manual
  confirmed cancel/replace and long-equity reduction paths remain available;
  automation does not act on them without an explicit policy and previewed
  workflow.
- Batch orders. The installed SDK supports stock batch placement, but no batch
  preview contract is present; individual previews plus a batch submission do
  not provide the same exact-order safety receipt.
- Crypto order placement because the Trading API lacks Preview Order for crypto.
- Broad options/futures/event position-close management and automated position
  management beyond the current supported equity order lifecycle.
- Trade-status and market-data streaming, until a safe stoppable implementation
  prevents SDK auth/signature logging and has a bounded UI update path.
- Bank links, funding, deposits, withdrawals, cash journals, and all other
  money movement. These remain deferred.

## Local release evidence

The 0.1.16 source was syntax-compiled, `git diff --check` passed, and the
standalone ELF was built and installed atomically as
`timmy-v0.1.16-local-20261025-r1` in the per-user overlay. SHA-256:
`6e475f6905dd0a6f997a23710b06e5556261d0778f1222a1681ce957ed7f7b83`.
Tests were not run and no Webull account/API request was made during this work.
The running app was left untouched; the new version is selected on the next
launch. No dpkg, GitHub, or Firebase release is implied.
