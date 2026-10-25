# Timmy Master Documentation

## Release Target: 0.1.16 (local user overlay)

The current local source targets version 0.1.16. It builds on
the 0.1.7 research/data, risk/planning, and review/operations wave with
same-candle scheduled Paper/Simulation/Live Auto dedupe, clearer cycle
result/wait feedback, persistent Live Auto holds after unknown outcomes, and
removal of duplicate controls and workspace aliases. Shared Paper/Simulation/Live
controls, the separate local simulation journal, provider-data validation, and
atomic cache writes remain included. Version 0.1.9 adds a read-only signal-to-plan
decision audit in the native Decision Brief and dashboard API (`/api/decisions`).
It reports strategy, score, expense, reward/risk, volatility, whitelist,
instrument, and price-level gates, plus whether the standard planner returned a
plan. It never submits or changes an order. Version 0.1.10 adds a recoverable
temporary User-mode fallback for failed Paper/Simulation automation cycles.
After a 30-second recovery pause, Timmy restores the prior Auto request and
retries with backoff up to five minutes unless the user explicitly selected
User, changed the execution target, or selected Live.
User-mode preference is persisted separately from the temporary fallback so a
restart does not mistake a system pause for the user's choice. Live automation
errors and unknown broker outcomes remain held for explicit review and re-arm.
Market-open Paper and Live automation also honor a saved user-selected User
mode.
Version 0.1.11 adds Webull open-order cancellation and limit-order replacement
from a fresh account snapshot, with a confirmation for each action and a signed
intent/result journal. It adds explicit-preview, explicit-confirmation limit
sell orders to reduce eligible long equity positions. Timmy rejects position
reductions when instrument type or long direction is unclear. Order actions
remain subject to the existing live execution guards and unresolved outcomes
must be reconciled before retrying. Read-only order history, execution history,
and Webull snapshots for equities, options, futures, crypto, and event contracts
are also available on demand where the account and API permissions allow them.
These market-data views do not expand Timmy's planning or live-order support for
those instruments. Trade-event streaming is not wired into the GUI. Money
movement, transfers, options/crypto position reductions, and broad instrument
order controls are not included. Live account mutations were not exercised
during implementation. At the time this 0.1.11 note was written, the Firebase
download page had not yet been updated from 0.1.6. Treat that statement as
historical; the current source and installer target are documented at the top
of this file.

Version 0.1.12 adds a manually opened guarded order-entry workflow for US
equity/ETF limit orders, single and multi-leg option strategies, futures, and
event contracts. The UI requests an exact Webull preview, enforces Timmy's
product switches and configured quantity/cost limits, retains an in-memory
fingerprint for the exact normalized payload, requires Live + User mode and a
separate final confirmation, and writes a durable order intent before one
submission. Crypto order submission and multi-order batch submission are
blocked: Webull does not currently expose Preview Order for crypto, and the
batch endpoint has different product/availability limits. Real-time streams
remain pending as documented below. The 0.1.12 ELF was built and installed into
the per-user overlay. The launcher selects it on the next app start; an already
running process retains its loaded version. The system package, GitHub, and
Firebase were not updated.

### Webull streaming integration status

Timmy does not start Webull trade-event or market-data streams. The installed
Webull SDK 3.0.4 trade-events client prints its signed subscribe request,
signature, and authentication metadata, then retries in an internal loop. It
does not expose a stop method or retain the gRPC channel for cancellation. It is
not safe to connect this directly to the GUI event log or to promise a working
Stop control. The SDK market-data client's `connect_and_loop_async` accepts a
logger-disabled option but does not forward it to the worker, whose default
enables console and file logging. Its loop lifecycle also relies on MQTT client
internals. Timmy should wait for upstream fixes or use a separately reviewed
stream adapter that suppresses all SDK/auth logs, retains and cancels the
connection, joins its worker off the UI thread, and sends only bounded,
redacted payloads to the UI through `root.after`. A market-data stream can be
considered independently from trade-status events once this lifecycle has a
safe implementation and verification path.

Version 0.1.13 repairs the equity/ETF Live Auto order path. It now requires the saved Live Auto opt-in, enabled live account/order switches, and a completed Account Check. Immediately before each order it rechecks the current signal and operational gates, requests an exact Webull preview on the same broker adapter used for submission, requires a documented estimated cost within the configured cap, writes a durable intent, and submits once using that preview receipt. A failure before the placement call is journaled as retryable; an uncertain placement result remains unresolved and holds Live Auto until reconciliation. The live lane is limited to supported US equities and ETFs. The generic Research & Discovery JSON console and its broad endpoint allowlist have been removed. Targeted contract discovery remains within the secondary manual order workflow; crypto remains available for market-data snapshots but has no order draft or submit control. Paper and Simulation behavior remains local.

The 0.1.13 native executable is installed in the per-user overlay and selected by the launcher on the next app start. An already-running process keeps its loaded prior version until it is closed. No Debian package, GitHub, or Firebase release was made.

Version 0.1.14 moved decision-cycle provider refresh, local data loading, and
signal ranking into a background worker, then applies an immutable market
snapshot on Tk. Live Auto exact preview, durable intent, submission, and result
journaling run in a separate broker worker, with UI updates posted through
`root.after`. The cycle guard remains held across both workers. Explicit target
or mode changes, profile edits, risk-setting changes, and Pause All cancel
future cycle steps while preserving an already-running broker call's outcome
for journaling and reconciliation. Tk snapshot application/rendering and local
Paper/Simulation journal work remain on the UI thread; no GUI responsiveness
benchmark or live broker operation was performed for this change.

Version 0.1.15 adds a read-only broker order/position preflight to each
automated Live batch. Timmy requires recognizable successful open-order and
position snapshots, blocks entries that overlap an active or ambiguous order
or a nonzero position, and reports the current lifecycle check. It never
cancels or reprices automatically. Partial fills are observed only insofar as
they appear in the open-order snapshot; fill-quantity reconciliation, stale
order policies, and automatic stop/target exits remain pending until an
explicit operator policy and a safe, previewed workflow. No Webull request or
GUI responsiveness benchmark was made during this implementation.

Version 0.1.16 wires the pure automation risk evaluator into equity/ETF Live
Auto after a fresh Webull account/order/position snapshot and before any exact
preview. It sizes against current equity, available cash, positions, pending
BUY orders, configured position/daily/rejection limits, data/session state,
daily loss, exposure percentages, and a private per-account drawdown high-water
mark. Missing or ambiguous context blocks before preview and displays actionable
reasons. The required policy keys are `AUTO_MAX_SYMBOL_EXPOSURE_PCT`,
`AUTO_MAX_TOTAL_EXPOSURE_PCT`, and `AUTO_MAX_DRAWDOWN_PCT`; unset/zero values
keep Live Auto blocked until configured to a percentage in `(0, 100]`. The
high-water mark starts at Timmy's first verified account snapshot, so measured
drawdown is since tracking began, not the account's all-time peak. Exact broker
preview, durable intent, one submission, and unresolved outcome holds remain
in place. Paper and Simulation now show closed-trade performance, cohort
summaries, and explicit fill/slippage coverage; unavailable fills, slippage,
and Simulation return percentages are not inferred. These insights never
change strategy or Live settings automatically.
The 0.1.16 discovery update scans 90 daily bars per symbol in rotating
all-US batches (200 symbols by default), saves a separate movement-ranked
watchlist at an absolute daily move of 1.1% or more, and promotes only bullish
movers at 2.2% or more with scout score 72+, an eligible strategy decision,
and an executable plan. Automated lanes use the saved discovery candidate
bars without replacing the active custom watchlist. Whitelist, account,
exposure, drawdown, session, order preview, and other existing execution gates
remain required; these daily-bar thresholds are filters, not return forecasts.
The native updater expects the GitHub Release assets
`Timmy-linux-x86_64.tar.gz` and `SHA256SUMS`; a Hosting deployment does not
publish that archive or update a running app.

Timmy is a native Linux trading assistant that scouts market movement, ranks setups, builds guarded order plans, supports paper trading, and can connect to Webull OpenAPI for account checks, order preview, and gated live order submission.

Timmy is not a profit guarantee and does not predict the future. It makes decisions from prior and current market data, then applies risk, account, market-session, and broker gates before an order can become actionable.

## Project Location

```text
/path/to/timmy-trader
```

Important runtime files:

```text
.env
.env.example
dist/Timmy/Timmy
scripts/launch_timmy.sh
trade-journal.jsonl
execution-events.jsonl
paper-training-summary.json
timmy-crash.log
watchlist.txt
```

Installed/user runtime location:

```text
~/.config/timmy-trader
```

## Application Type

Timmy is currently packaged as a native Linux ELF executable:

```text
dist/Timmy/Timmy
```

The development-checkout launch path is:

```text
/path/to/timmy-trader/scripts/launch_timmy.sh
```

The development launcher defaults to:

```text
TIMMY_HOME=/path/to/timmy-trader
TIMMY_THEME=dark
```

The browser dashboard remains only a development fallback. The main operating surface is the native GUI.

## Recent Responsiveness And Scaling Changes

- The native GUI groups navigation into workflow and operations sections, presents a guided market overview, places account and order actions in their relevant work areas, and scrolls on smaller displays.
- Market-data refresh and watchlist rotation run in a background worker so slow network requests do not block native GUI input and redraws. The UI reports refresh progress and returns to cached-data rendering if a refresh fails.
- Provider bars are checked for finite positive OHLC prices, consistent high/low ranges, non-negative finite volume, valid timestamps, and matching symbols before they enter scans or the local cache.
- Market-data CSV updates are written to a same-directory temporary file, flushed, and atomically replaced so a failed refresh cannot leave a partially truncated cache. Existing file permissions are retained.
- The Scanner tab filters visible rows as text is entered and shows the number of matches. Press Escape in the filter field to clear it.
- Large market-data fetches keep a bounded number of requests in flight and queued, rather than creating one future for every symbol up front.
- Stooq responses fall back to Yahoo per missing symbol, and market-data worker concurrency is capped at 24.
- The development dashboard reads the journal as a stream and retains only the latest 50 valid events in memory.
- The native app checks GitHub Releases shortly after launch and once per day. Stable Linux packages are checksum-verified, installed under the user's home directory, and selected automatically the next time Timmy starts. The active session is never restarted. Release tags use `timmy-v*`, with assets named `Timmy-linux-x86_64.tar.gz` and `SHA256SUMS`.

## 0.1.7 UX Capability Wave (included in 0.1.8)

The local 0.1.7 package adds 30 user-facing capabilities across the Research
Workbench, Risk & Trade Planning Lab, and Review & Operations workspace. Read
the [research workbench guide](RESEARCH_WORKBENCH.md), [risk and planning
guide](TIMMY_RISK_PLANNING_UX_WAVE_2026-10-25.md), and
[operator workflows](WORKFLOWS.md) for their data sources and limits. These
views do not enable Live mode or change strategy calculations. The open-order
monitor is read-only; no cancel/replace operation was added. The package is
installed locally; public Hosting and GitHub release assets remain unchanged.
See the [automation and order safety review](AUTOMATION_AND_ORDER_SAFETY_REVIEW.md)
for the mode contract, scheduling behavior, live preview and submit limits, and
the Simulation fill model.

The first build with the updater must be installed once. After that, stable GitHub releases install automatically for that user; the root-owned system package is left intact. An optional `BASE_RELEASE` marker in the installed overlay prevents the updater from replacing that overlay with the same or an older release; locally built overlays without that marker follow the normal latest-release check. Automatic native updates currently support x86_64 Linux only. Deploying the public Firebase Hosting site alone does not update the native application. The public site is [timmy-tradesonauto.web.app](https://timmy-tradesonauto.web.app).

## Launching

From terminal:

```bash
cd /path/to/timmy-trader
./scripts/launch_timmy.sh
```

Direct ELF launch:

```bash
cd /path/to/timmy-trader
TIMMY_HOME=/path/to/timmy-trader ./dist/Timmy/Timmy
```

Build the ELF:

```bash
cd /path/to/timmy-trader
./scripts/build_elf.sh
```

Build the Debian package:

```bash
./scripts/package_deb.sh
```

Install the resulting 0.1.8 Debian package locally:

```bash
sudo apt install ./dist/timmy-trader_0.1.8_amd64.deb
```

## Single-Instance Rule

Timmy runs one active native app instance per Linux user, across all runtime homes.

On launch, Timmy:

- Claims an OS file lock at `${XDG_CONFIG_HOME:-~/.config}/timmy-trader/timmy-instance.lock`.
- Refuses to start another instance for the same Linux user, even if it selects a different `TIMMY_HOME`.
- Leaves other users' sessions alone. The lock file can remain after exit; the OS lock is released when the process closes it.

This matters because trading state, account state, live market data, and automation settings can change every few minutes. Running multiple active copies would create avoidable execution risk.

## Theme And Fonts

Dark mode is installed and active through:

```text
TIMMY_THEME=dark
```

The theme is loaded before the native Tk window is created. The launcher also exports the theme explicitly so the packaged ELF receives the correct theme immediately.

The GUI uses theme-aware foreground/background pairs:

- Dark background uses light text.
- Light background uses dark text.
- Buttons, selected controls, disabled text, Treeview rows, text panels, and broker-output panels have explicit contrast colors.
- Compact labels and buttons are configured to fit or wrap inside their available space.

## GUI Layout

Main navigation:

- Overview
- Signals
- Automation
- Orders
- Broker
- Event Log

Top workflow:

- `Refresh` updates data, plans, status, logs, and dashboard panels.
- `Check Webull` checks the configured broker account and cash/buying-power fields.
- `Preview Order` sends the current eligible order plan to Webull preview.

Dashboard cards:

- Mode
- Webull Account
- Cash Available
- Max Notional
- Risk / Trade

Controls:

- Score threshold.
- Plan count.
- Automation interval.
- Live guard status.
- Eligible plan count.
- Paper auto toggle.
- Paper/Live target.
- User/Auto mode.
- I-Cash/Crypto account lane selector.
- Webull account toggle.
- Run, Live, and Stop buttons.

## Account Lanes

Timmy now distinguishes account lane from execution target.

Execution target:

- `Paper`: local paper-trading path.
- `Live`: broker-facing path, still protected by live switches and broker gates.

Account lane:

- `I-Cash`: the Webull brokerage/cash-management lane.
- `Crypto`: the Webull Pay/crypto lane only when a separate crypto account ID is configured.

Default behavior:

- Timmy defaults to `I-Cash`.
- If `Crypto` is selected without a separate crypto account ID, Timmy snaps back to `I-Cash`.
- If `WEBULL_CRYPTO_ACCOUNT_ID` or `WEBULL_PAY_ACCOUNT_ID` exists and differs from I-Cash, Timmy can switch lanes.
- If crypto buying power is linked to the same brokerage account, Timmy treats it as the same cash lane instead of pretending there is a separate account.

Optional account variables:

```text
WEBULL_ACCOUNT_ID=
WEBULL_ICASH_ACCOUNT_ID=
WEBULL_CRYPTO_ACCOUNT_ID=
WEBULL_PAY_ACCOUNT_ID=
```

Current Webull account model note:

- Webull cash management is tied to a Webull brokerage account.
- Webull crypto is handled through Webull Pay LLC and may be linked into the Webull app.
- Webull’s own help pages state crypto and brokerage accounts can be separate, and that linked buying power can share one unified cash pool.
- References:
  - `https://www.webull.com/trading-investing/crypto`
  - `https://www.webull.com/help/faq/11084-Account-Opening`
  - `https://www.webull.com/help/faq/11111-Linking-Buying-Power`
  - `https://www.webull.com/trading-investing/cash-management`

## Webull Configuration

Timmy uses Webull OpenAPI credentials from local `.env` only.

Required for account checks and broker workflows:

```text
WEBULL_APP_KEY=
WEBULL_APP_SECRET=
WEBULL_REGION=us
WEBULL_API_ENDPOINT=api.webull.com
WEBULL_ACCOUNT_ID=
WEBULL_SUPPORT_TRADING_SESSION=CORE
WEBULL_TOKEN_CHECK_SECONDS=30
WEBULL_TOKEN_CHECK_INTERVAL_SECONDS=3
```

Do not put these in chat:

- Broker usernames.
- Broker passwords.
- MFA codes.
- App secrets.
- API tokens.
- Access tokens.
- Refresh tokens.
- Screenshots containing secrets.

Account check:

```bash
timmy webull-check
```

Order preview:

```bash
timmy webull-preview --data examples/sample_bars.csv
```

## Live Trading Gate

Live trading requires all live switches and account values to be configured:

```text
TRADER_MODE=live
TRADER_LIVE=1
WEBULL_ENABLE_LIVE_ORDERS=1
WEBULL_ACCOUNT_ID=<approved account id>
```

Preview behavior:

```text
WEBULL_REQUIRE_PREVIEW=1
```

keeps preview required by default. If this is changed to `0`, Timmy still uses internal GUI preview/submit workflow safeguards for Auto live paths where implemented.

Live submit remains blocked when:

- Live mode is off.
- Webull live order switch is off.
- Account ID is missing.
- No eligible plans exist.
- The current plan does not have a fresh matching preview where preview is required by the GUI path.
- Market-hours gate blocks operation.
- Risk, cooldown, stale-data, cash, volatility, or daily-limit gates block the plan.

If the connection fails after Timmy sends a live order, the result is recorded
as `unknown` because Webull may have accepted the order before the response was
lost. Timmy blocks that symbol until the operator checks the client order ID in
Webull. Use **Review unresolved live orders** in the Execution Desk to record a
resolution only after Webull shows the order as rejected, cancelled, or expired.
Accepted, filled, or still-open orders remain blocked; the current UI does not
provide a release action for those outcomes. Reconcile them directly in Webull
and leave the symbol blocked until Timmy has an explicit position/order
reconciliation flow. This recovery action records the operator's check; it does
not query Webull or submit another order.

## Market-Open Behavior

Current conservative gate:

```text
REQUIRE_MARKET_HOURS=1
```

Timmy uses an NYSE-style regular-session market calendar:

- Regular open: 9:30 a.m. Eastern.
- Regular close: 4:00 p.m. Eastern.
- 2026 full-market holidays are modeled.
- Known 2026 1 p.m. early closes are modeled.

When the market is closed and `REQUIRE_MARKET_HOURS=1`, Timmy adds:

```text
regular market session is closed
```

to operational blocks. That prevents eligible live order plans from being created through the normal equity workflow.

Market-open automation:

```text
AUTO_START_PAPER_ON_MARKET_OPEN=1
AUTO_START_LIVE_ON_MARKET_OPEN=0
MARKET_OPEN_POLL_SECONDS=30
```

If live market-open automation is enabled, Timmy waits for the market-open gate, switches target/mode as configured, runs the decision cycle, and then schedules recurring automation.

Important nuance:

- Crypto may trade 24/7 through Webull Pay, but Timmy currently uses a global conservative regular-market gate. That means crypto live execution should not be assumed 24/7 until an asset-class-specific crypto session gate is installed and tested.

## Paper Mode

Paper mode is the default safe proving ground.

Paper trade command:

```bash
timmy paper-trade --data examples/sample_bars.csv
```

Paper fills write to:

```text
trade-journal.jsonl
```

Execution events write to:

```text
execution-events.jsonl
```

Paper training summary writes to:

```text
paper-training-summary.json
```

Timmy enriches paper trades with:

- Symbol.
- Quantity.
- Buy limit.
- Target.
- Stop.
- Signal context.
- Scout context.
- Sensible-score context.
- Controls.
- Candle timestamp.
- Execution mode.
- Tamper-evident audit chain data.

Paper reconciliation checks newer candles for target/stop outcomes and updates local execution events.

## Auto/User Mode

User mode:

- Manual review is expected.
- Manual execution buttons are enabled when plans and gates allow.
- Live button prompts for confirmation before live submit attempts.

Auto mode:

- Manual execution controls lock to prevent accidental clicks.
- Stop remains available.
- Paper Auto can collect paper-trading data.
- Live Auto can run market-open workflow only when the live target and switches are configured.
- The live path still uses current plans, account gates, market gates, and broker checks.

## Strategy

Timmy scouts and ranks based on:

- Single-bar movement.
- Three-bar acceleration.
- Gap movement.
- Unusual volume.
- Range expansion.
- Proximity to highs/lows.
- Trend and momentum.
- RSI.
- Moving-average overextension.
- Reward/risk.
- Volatility.
- Cash fit.
- Rejection history.

Timmy detects early movement around:

```text
+/-2.5%
```

Signals can become:

- `eligible`
- `watch`
- blocked/avoided by operational, expense, or risk gates.

Executable order plans are currently buy-low/sell-high long limit plans. Bearish movement can be scouted and ranked, but Timmy does not silently create short-sale orders in this build.

## Risk Controls

Configurable risk controls:

```text
MIN_SCORE_TO_TRADE=72
MAX_POSITIONS=3
MAX_DAILY_LOSS_USD=100
RISK_PER_TRADE_USD=25
MIN_REWARD_RISK_TO_TRADE=1.6
MAX_SIGNAL_VOLATILITY_PCT=4.5
MAX_PRICE_OVER_SMA20_PCT=6
MAX_PRICE_OVER_SMA50_PCT=12
MAX_RSI_TO_BUY=78
MAX_ENTRY_CASH_PCT=20
MAX_DAILY_TRADES=5
MAX_SYMBOL_DAILY_TRADES=2
ORDER_COOLDOWN_MINUTES=15
MAX_RECENT_REJECTIONS=2
WEBULL_MAX_ORDER_NOTIONAL_USD=250
WEBULL_MAX_ORDER_QUANTITY=10
```

Plan sizing considers:

- Risk per trade.
- Stop distance.
- Maximum notional.
- Maximum quantity.
- Available cash/buying power when present.
- Asset-specific quantity precision.

Malformed or non-finite explicitly configured exposure limits fail closed to
zero, which can block plans. Correct the value in the local profile before
resuming live use; omitted settings continue to use the documented defaults.

Blocks include:

- Market closed.
- Stale data.
- Thin reward/risk.
- High volatility.
- Entry too large for cash cap.
- Symbol cooldown.
- Daily trade limit.
- Per-symbol daily trade limit.
- Recent bad/rejected events.
- Too-expensive RSI/moving-average conditions.

## Asset Classes

Default supported live path:

- Stocks.
- ETFs.
- Index proxies through ETFs.

Guarded/disabled by default:

```text
ENABLE_CRYPTO_TRADING=0
ENABLE_FUTURES_TRADING=0
ENABLE_OPTIONS_TRADING=0
ENABLE_EVENT_CONTRACT_TRADING=0
```

Crypto:

- Can be scouted and paper-tested when configured.
- Requires correct account lane, symbol mapping, permission, preview path, precision, fees, spread, and session rules before live use.

Futures:

- Requires contract multipliers, tick size, margin, expiry, rollover, session rules, and broker preview before live use.

Options:

- Requires explicit option legs in `WEBULL_OPTION_LEGS_JSON`.
- Should not be enabled live without options permission, order-shape validation, contract selection, risk model, and preview.

Event contracts:

- Treated as blocked/scouting-only unless a dedicated adapter and account permission path are installed.

## Market Data

Default:

```text
MARKET_DATA_PROVIDER=yahoo
WATCHLIST_UNIVERSE=all-us
WATCHLIST_UNIVERSE_BATCH_SIZE=200
WATCHLIST_PATH=watchlist.txt
WATCHLIST_TEMPLATE=equity
MARKET_DATA_MAX_AGE_MINUTES=10
MOVEMENT_WATCHLIST_MIN_CHANGE_PCT=1.1
TRADE_CANDIDATE_MIN_CHANGE_PCT=2.2
```

Sample data:

```bash
timmy sample-data --out examples/sample_bars.csv
```

Watchlist templates:

```bash
timmy watchlist-init --template equity --out watchlist.txt
timmy watchlist-init --template crypto --out watchlist-crypto.txt
timmy watchlist-init --template commodity-etf --out watchlist-commodities.txt
timmy watchlist-init --template index-proxy --out watchlist-indexes.txt
timmy watchlist-init --template futures-watch --out watchlist-futures.txt
```

Fetch delayed daily bars:

```bash
timmy fetch-data --provider yahoo --watchlist watchlist.txt --out examples/sample_bars.csv --days 90
```

Backtest:

```bash
timmy backtest --data examples/sample_bars.csv --hold-bars 10
```

Scan:

```bash
timmy scan --data examples/sample_bars.csv
```

Plan:

```bash
timmy plan --data examples/sample_bars.csv
```

## Event Log And Tamper Resistance

Execution events are stored at:

```text
execution-events.jsonl
```

Timmy writes an audit key at:

```text
.timmy-audit-key
```

New execution events include tamper-evident chain data. Timmy also writes a signed protected-file baseline at:

```text
.timmy-integrity.json
```

The integrity manifest tracks local profile, settings, watchlist, paper-journal, and execution-event files. Timmy refreshes the baseline after its own writes and shows an Audit warning if protected files change outside Timmy or the manifest signature is edited. This is not a full security system and does not prevent host-level tampering by someone with filesystem control, but it helps detect event-log and runtime-file edits after the fact.

Sensitive runtime files should remain local and private.

## Crash Recovery

GUI exceptions are caught and written to:

```text
timmy-crash.log
```

Timmy attempts to recover the GUI by:

- Reporting the error in the status bar.
- Writing traceback details to broker output.
- Re-enabling controls.
- Re-syncing manual controls.

Fatal startup errors are also written to `timmy-crash.log`.

Smoke test:

```bash
PYTHONPATH=. python3 scripts/smoke_test.py
```

Full validation:

```bash
. .venv/bin/activate
python -m compileall -q trend_trader tests
pytest -q
python scripts/smoke_test.py
```

Current expected test result after the latest changes:

```text
63 passed
Timmy smoke tests passed
```

## Knowledge Repository

Timmy includes local guidance files:

```text
knowledge/asset-classes.md
knowledge/live-automation.md
knowledge/market-hours.md
knowledge/order-handling.md
knowledge/paper-to-live.md
knowledge/red-green-flags.md
knowledge/risk-controls.md
knowledge/scouting.md
```

Search guidance:

```bash
timmy knowledge red flags
timmy knowledge reward risk
timmy readiness
```

## Operational Checklist

Before market open:

- Confirm only one Timmy instance is running.
- Confirm `.env` belongs to this machine and account.
- Confirm target is `Paper` or `Live` intentionally.
- Confirm mode is `User` or `Auto` intentionally.
- Check Webull account and cash.
- Check market data freshness.
- Confirm watchlist.
- Confirm asset class gates.
- Review risk caps.
- Review any major scheduled news or volatility event.

At market open:

- Let opening volatility settle unless intentionally trading the open.
- Refresh market data.
- Confirm broker state.
- Confirm no duplicate Timmy process.
- Confirm no stale locks.
- Confirm plans are not stale.
- Preview before live operation when required.

During operation:

- Use `User` as the default.
- Use `Auto` only when target, account, live switches, data, and risk caps are known-good.
- Keep `Stop` available.
- Do not continue live operation after broker sync failure, stale data, unexpected restart, or unclear open-order state.

After operation:

- Review Event Log.
- Review paper/live outcomes.
- Check crash log.
- Check execution-events audit chain.
- Keep notes on blocked trades and false positives.

## Troubleshooting

No dark mode:

- Confirm `.env` has `TIMMY_THEME=dark`.
- Relaunch through `scripts/launch_timmy.sh`.
- Confirm the old process was replaced.

No account visible:

- Confirm `.env` has `WEBULL_ACCOUNT_ID`.
- Run `Check Webull`.
- Confirm Webull OpenAPI app approval.
- Confirm API endpoint is `api.webull.com`, not `https://api.webull.com`.

Crypto selector snaps back to I-Cash:

- This is expected when no distinct `WEBULL_CRYPTO_ACCOUNT_ID` or `WEBULL_PAY_ACCOUNT_ID` is configured.
- If buying power is linked to I-Cash, there may be no separate account lane to switch into.

Live button disabled:

- No eligible plans.
- Auto mode is locking manual execution controls.
- Live switches are incomplete.
- Account ID is missing.
- Market is closed.
- Risk gates block current plans.

No eligible plans:

- Market data may be stale.
- Score threshold may be too high.
- Watchlist may not have movement.
- Volatility may be above the cap.
- Reward/risk may be too low.
- Entry may be too expensive versus cash/RSI/moving averages.

Unexpected close:

- Check `timmy-crash.log`.
- Relaunch through `scripts/launch_timmy.sh`.
- Run validation commands.
- Check that only one Timmy process is active.

## Current Known Limits

- Timmy does not guarantee profits.
- Timmy does not predict the future.
- Timmy does not store Webull usernames/passwords.
- Timmy’s primary live path remains equities/ETFs.
- Crypto live trading needs asset-specific session, preview, precision, spread, and permission validation before it should be trusted.
- Futures/options/event contracts remain high-risk and should stay disabled until account-specific preview and risk support are proven.
- The current global market-hours gate is conservative and NYSE-style.
- Host-level tamper resistance is limited by local filesystem access.

## Related Docs

```text
README.md
docs/OPERATOR_CHECKLIST.md
docs/WEBULL_SETUP.md
docs/IMPLEMENTATION_OUTLINE.md
docs/HOTFIX_IMPLEMENTATION_LOG.md
```
