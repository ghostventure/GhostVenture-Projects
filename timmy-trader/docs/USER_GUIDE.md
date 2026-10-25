# Timmy User Guide

Timmy is a native Linux desktop tool for scanning market candles, reviewing
strategy signals, building risk-capped order plans, and recording paper-trade
activity. It can connect to Webull OpenAPI for account checks, order previews,
and a guarded live-order path. It does not predict the future or guarantee a
profit.

This guide covers the Timmy 0.1.16 desktop release, including movement
discovery, candidate promotion, and Paper, Simulation, and Live automation.
The same release is installed as the Debian package and offered on the public
download page. For live trading, read the [Operator Checklist](OPERATOR_CHECKLIST.md)
and [Webull Setup guide](WEBULL_SETUP.md) first. Public product page:
[Timmy User Guide](https://timmy-tradesonauto.web.app/user-guide.html).

Check an installed package version with
`dpkg-query -W -f='${Version}\n' timmy-trader`. The current package is 0.1.16.
If you use an older build, some controls may differ; upgrade from the
[Download page](https://timmy-tradesonauto.web.app/download.html) before
following a workflow that is not present in your version.

## Start safely

1. Download **Timmy Installation Manager 0.1.16** from the [Download page](https://timmy-tradesonauto.web.app/download.html).
   Keep the `.deb` and matching `.sha256` file together, then verify them with
   `sha256sum -c Timmy-Installation-Manager_0.1.16_amd64.deb.sha256`.
   Install or upgrade with
   `sudo apt install ./Timmy-Installation-Manager_0.1.16_amd64.deb`.
2. Launch Timmy from your desktop application menu, or run `timmy-trader` from
   a terminal after installation.
3. Leave the execution target on **Paper** and the operating mode on **User**.
   This keeps live order routing off. Check the **Paper lane** indicator too:
   the default profile can arm paper activity at market open, and paper runs
   write simulated events to a local journal.
4. Review **Automation** first for current mode, target, next cycle, data and
   account health, risk blockers, and any Live order lifecycle hold. Keep **User**
   mode and **Paper** selected while learning the workflow.
5. Select **Scan** on Overview. Review the data timestamp and source before
   interpreting any signal.
6. Select a row in the radar or Scanner to link its chart, Decision Brief, and
   order-plan context.

On a new profile, the desktop app can create sample candles when no local data
file exists. Sample candles are synthetic demo data. They are not market quotes
and must not be used as evidence for a real order. Confirm the data source and
timestamps shown by Timmy before relying on a scan.

## The desk at a glance

| Workspace | What it is for |
| --- | --- |
| **Automation** | First stop for cycle state, next action, data/account health, risk blockers, Live lifecycle status, and separate Paper and Simulation feedback. Its compact controls select Target, User/Auto, and the Paper lane. |
| **Overview** | Ranked radar, selected-symbol chart, Decision Brief, and current order plan. |
| **Scanner** | Search, filter, sort, and inspect the full signal list. Saved scanner filters only affect the displayed scan view. |
| **Research** | Inspect scan coverage, compare local evidence, preview CSV imports, plan market sessions, compare symbol groups, and export a redacted snapshot. |
| **Strategy** | Review style, enabled patterns, score thresholds, readiness gates, and why a candidate is blocked. |
| **Universe** | Inspect the symbol universe and generated watchlist status. |
| **Portfolio** | Review the local paper ledger and a separately checked broker-cash snapshot. Portfolio positions and P&L are paper-ledger data. |
| **Alerts** | Create local signal rules, pause or remove them, and acknowledge one or all new events. Alerts never place orders. |
| **Execution** | Review the plan queue, strategy thresholds, account lane, order previews/submission, and unknown-order recovery controls. |
| **Broker** | Verify the configured Webull account, refresh account/buying-power information, and inspect connection results. |
| **Setup** | Configure market-data and trading preferences, and verify/save a local Webull profile. |
| **Audit** | Review execution-event history and integrity status. |
| **Health** | Review readiness, data freshness, account blockers, and diagnostic explanations. |

Use **Ctrl+K** for Quick Jump to a workspace, action, or symbol. **F5** refreshes
market data; **Ctrl+R** runs a decision cycle. A decision cycle refreshes and
rebuilds the signal and plan state. If a paper lane is enabled, it can also
journal paper orders; if Live/Auto and all live gates are open, it may follow
the live path. Review the target and mode before using it.

## Read a scan and a plan

1. **Scan** refreshes market data when the configured provider and cache rules
   call for it, then recalculates signals. The default provider is Yahoo delayed
   daily bars; choose CSV to use a local file instead. Remote providers do not
   provide a streaming quote feed.
2. The **radar** summarizes ranked symbols. Personal **Pinned** and named
   watchlist groups change which signals are shown in this view; they do not
   replace Timmy's active trading watchlist or change generated trade-ready
   lists.
3. In **Scanner**, use the text filter, category selector, column headings, and
   column controls to focus the list. Save a named filter to preserve its query,
   category, and minimum score. Applying a saved filter changes the visible
   view and restores its minimum-score setting; that shared threshold can also
   affect which plans are eligible. It does not directly submit an order.
4. Select a symbol to inspect its loaded-candle chart and model read. Remote
   market providers supply delayed daily bars. The chart can display moving
   averages, volume, and the current plan's entry, stop, and
   target levels. These are analysis aids, not promises that an order will fill
   at those prices.
5. Review the **Decision Brief** and **Strategy** gates. A high score or
   movement alert does not mean a trade is approved. A candidate can still be
   blocked by price extension, volatility, reward/risk, session, cash, cooldown,
   daily limits, symbol limits, asset-class support, or other controls.
6. Treat an **Order Plan** as a proposal. It becomes a broker order only after
   a separate paper or live action. “No executable plans” means scanning
   completed without producing a plan that passed the configured gates.

Select **Open risk & plan review** below the Order Plan to inspect the review-only
Risk & Trade Planning Lab. It compares the active queue, shows a hypothetical
field-by-field plan diff, charts entry/stop/target and risk-to-reward, compares
0.5×/1.0×/1.5× portfolio scenarios, and estimates the selected plan's impact on
the local paper ledger. The sizing explorer applies configured quantity
precision and asset notional/quantity limits; it does not model account buying
power or derivative multipliers. Exposure and correlation views use loaded
paper positions and aligned loaded daily candles. Sector exposure stays
unavailable unless sector metadata is present. The stepwise checklist is
informational and never approves, changes, or submits an order.

### Personal groups and pins

Select a ticker, create a personal group, then use **+ Group** to add the
selected ticker. Pinning lets you filter the radar to pinned symbols. These
groups are stored in the local profile as organizational aids. They do not
change the active watchlist, scan universe, broker watchlists, or trading scope.

### Research workbench

Open **Research** for a bounded history of the last 60 scan-coverage records,
including per-symbol returned/missing state and safe provider failure details.
The multi-chart board and group comparison use only currently loaded local
candles. Provider Evidence compares recorded scans; it never makes a second
request to a provider, and runs from different symbols or dates are not a
controlled benchmark. The Data Issue Inbox combines missing coverage and
candle-quality warnings, then opens a unified symbol view with its local chart,
scan result, quality detail, and private local note.

Use **Import CSV** to map symbol, timestamp, and OHLCV fields, review row-level
validation, and preview sample rows before confirming a merge. An invalid row
blocks the whole import. Confirmation merges by symbol and timestamp and writes
the local candle file atomically; imported values replace matching timestamps.
The import is local, makes no provider request, and cannot place orders.

The session planner shows a 35-day US-equities planning horizon in Eastern
Time. Holiday/early-close confidence is only maintained for 2026; future-year
weekdays are labeled for verification. Named scanner table layouts round-trip
column order, visibility, and sorting separately from scanner filters. Research
snapshots export a small whitelisted set of symbols, scan scores, and issue
details; account, broker, credential, and profile fields are excluded.

### Data freshness and quality

Timmy uses daily candles. The Market chart shows a quality label and details
for the selected symbol, including freshness, estimated gaps, repeated
timestamps, and invalid OHLC ranges. Gap counts are estimates based on a fixed
bar interval and do not account for exchange sessions, weekends, or holidays.
Check the raw timestamps and provider if a warning appears. The dashboard's
latest-candle timestamp is not proof of a live quote.

The terminal strip shows a compact, color-coded `FRESH`, `STALE`, `MISSING`,
`INVALID`, or `SAMPLE` data state. Hover over that state for help; the Runtime
panel shows the provider, latest candle timestamp, and approximate candle age.
Use **Scan** or **F5** for a manual refresh. Automatic refresh runs at the
interval set by `TIMMY_DASHBOARD_REFRESH_SECONDS`; provider requests are skipped while
the saved market-data cache is younger than `MARKET_DATA_MAX_AGE_MINUTES`.
The Signal Desk status line reports live batch progress and the most recent
scan coverage, returned symbols, provider failures, and an approximate full
universe pass time. A full pass estimate assumes each configured batch refresh
succeeds at the current cache cadence; rate limits, outages, and unsupported
symbols can make actual coverage slower or incomplete.

If a provider returns no usable bars, Timmy keeps the existing cache and reports
that it is showing previously saved symbols. A refresh is reported as complete
only when new bars were actually written or the existing cache was still fresh.

### Rolling 96-hour movers and upside shortlist

The Universe workspace reports Timmy's rolling 96-hour mover list. Yahoo data
and the all-US universe are the built-in defaults, so the normal dashboard
refresh checks a rotating batch automatically. Broad discovery requests up to
90 daily bars per symbol and defaults to a 200-symbol batch. Timmy records
tickers whose daily OHLC bars show price movement and drops entries after their
latest observed movement ages beyond 96 hours. The scan has a separate cursor
and does not change the active trade watchlist; automatic watchlist rotation
stays off by default. Provider rate limits or failed requests can delay
coverage. To include provider-supported symbols outside the exchange
directory, add one symbol per line to `movement-universe-extra.txt`.

Adjust `WATCHLIST_UNIVERSE_BATCH_SIZE` to change requests per scan. Larger
batches cover the configured universe in fewer successful refreshes, while
raising the number of provider requests in each cycle. Timmy retries selected
temporary network and server failures with bounded delays; permanent provider
errors are reported as unavailable symbols and are not counted as returned
market data.

Timmy saves a ranked `movement-watchlist.txt` after successful broad scans.
The discovery list requires an absolute daily close-to-close change of at least
`MOVEMENT_WATCHLIST_MIN_CHANGE_PCT` (default 1.1%) and keeps up to
`MAX_MOVEMENT_WATCHLIST_SYMBOLS` entries, ranked by move size. A symbol can be
promoted to an automated trade candidate at `TRADE_CANDIDATE_MIN_CHANGE_PCT`
(default 2.2%) only when its move is bullish, scout score is at least 72, the
strategy marks it eligible to trade, and normal plan filters pass. Auto lanes
use only those promoted candidates. The saved candidate bars remain separate
from the active trade watchlist.

Promotion does not bypass the configured symbol whitelist, broker permissions,
fresh account and order checks, risk limits, daily caps, or exact order preview.
Live Auto remains held unless its existing explicit opt-in and risk settings
are valid. A promoted candidate is based on daily data, not a prediction or
guarantee.

The discovery list is separate from the active manual watchlist.
`movement-watchlist.txt` is ranked by absolute percentage movement;
`movement-scan-candidates.csv` stores recent candidate bars used by the
automation signal path. The discovery and trade-candidate thresholds are
configurable with `MOVEMENT_WATCHLIST_MIN_CHANGE_PCT` and
`TRADE_CANDIDATE_MIN_CHANGE_PCT`. Changing either threshold changes candidate
eligibility, but does not remove the strategy, account, order, or risk gates.

The source universe includes US exchange-listed stocks and ETFs, plus a small
set of index benchmarks, Treasury-yield symbols, bond ETF proxies, crypto
pairs, and futures. It does not enumerate individual bonds, every global
listing, every option contract, or every instrument in the market. Daily bars
also mean the 96-hour check and thresholds are based on daily movement
observations, not a continuous intraday feed. The files
`timmy-movement-tracker.json`, `recent-movers-96h.txt`, and
`movement-scan-candidates.csv` hold local discovery history, the current mover
list, and candidate candles.

The Universe workspace's **Fresh Bullish Shortlist · Top 10** section ranks bullish signals
only among current 96-hour movers. Its relative score combines Timmy's existing
technical, sensible, and scout scores. It is not a calibrated probability or
forecast of return. Automated trading uses a separate, stricter candidate gate
and all normal broker/risk controls; the bullish shortlist itself does not
submit orders.

## Paper and Live are separate

### Paper

Paper is the recommended starting target. **Submit Paper** writes simulated
orders to the local journal; it does not send an order to Webull. Paper
positions, cash, and realized results are computed from Timmy's paper ledger
and loaded candle prices. They are not broker-confirmed holdings, and simulated
fills may differ from real execution.

The **Paper lane** checkbox is the single control for scheduled paper activity.
Automation shows Paper and Simulation outcomes separately. It labels fill rate
and slippage unavailable when the local journals lack explicit execution
observations. Candle-model outcomes do not prove broker fills. Use **Pause All
Automation** in Automation or Execution to stop scheduled activity.
Paper simulation settings can permit simulations
outside regular market hours; this does not make the data current or the
simulation equivalent to market execution.

### Simulation

Choose **Simulation** in the shared Target selector to exercise the current
strategy plan through the same **Preview** and **Submit** controls without
constructing a Webull client. Simulation writes to
`simulation-trade-journal.jsonl`, separate from the Paper ledger, and its rows
are labeled **Simulation** in Journal Review. Preview is a local snapshot of
the already loaded plan and candle data; it expires after three minutes or
when the target/plan changes. User mode requires that preview before submit;
Auto mode repeats the local preview and submit workflow on the configured
interval. It does not change strategy or risk settings.

Simulation outcome tracking uses later daily OHLC candles to record a target or
stop threshold, with stop-first when both thresholds appear in the same candle.
It assumes the entry price and does not model intraday order priority, fills,
slippage, spread, fees, or broker behavior. Daily data may be delayed. These
results are local scenario records, not broker-equivalent fills or performance.
Simulation events are excluded from Paper performance and the recent-failure,
cooldown, daily-trade, and loss guards used by Live.

### Live

Live can place real broker orders. Do not switch to Live until you intend to use
the selected Webull account and have verified account state, current buying
power, supported instruments, risk limits, and preview behavior.

The live path depends on all applicable controls, including the selected Live
target, live mode switches, configured account, successful account check,
market/session and strategy gates, order-size limits, and broker support. Every
placement requires a successful exact Webull preview for the same order payload,
a preview estimated cost within Timmy's configured cap, a durable intent record,
and a single submission. `WEBULL_REQUIRE_PREVIEW=1` is the safe setting and does
not block placement after that exact preview succeeds; Timmy always enforces
the preview regardless of this legacy setting. Live Auto additionally requires
the saved Live Auto opt-in in the Webull profile. An uncertain broker outcome
holds automation until the order is reconciled.

Live Auto also requires positive configured limits for
`AUTO_MAX_SYMBOL_EXPOSURE_PCT`, `AUTO_MAX_TOTAL_EXPOSURE_PCT`, and
`AUTO_MAX_DRAWDOWN_PCT`; unset or zero limits keep automated Live blocked.
Before previewing an automated order, Timmy evaluates the fresh account
snapshot, open positions, pending priced buy orders, session state, candle
quality, cooldowns, and exposure/drawdown limits. These checks can reduce the
planned quantity or block the order. Do not weaken or remove a blocker just to
make an automation lane run.

In **User** mode, Timmy asks for confirmation before a manual live submission.
In **Auto** mode, manual execution controls are locked. The Automation panel's
Next Cycle status shows whether the cycle is running, its next Eastern-time due
time, armed for market open, or paused. **Pause All Automation** cancels both
the interval and pending market-open callbacks for the current app session; a
later app launch still follows the saved market-open preferences. Live
automation can preview and submit a current eligible plan automatically only
when every live switch and runtime gate is open. Keep live auto-start disabled
unless you have specifically prepared and tested unattended operation. A
market-open callback waits for active refresh/action work and rechecks the
regular session before it runs. Pausing cannot cancel an order already sent to
the broker.

If a live response is marked **unknown**, the broker may have received the
request even if Timmy did not receive a final response. Timmy stops the current
submission batch, blocks later plans for that symbol, and requires you to check
Webull and record a terminal resolution before that symbol can pass the local
guard again. Live Auto pauses, including a pending market-open Live callback;
a signed automation hold keeps it paused after restart. After you record a
terminal resolution, switch to User and then back to Auto to re-arm Live. An
independent Paper lane can continue on its schedule. Do not assume
“unknown” means rejected or retry it. See
[Automation and Order Safety Review](AUTOMATION_AND_ORDER_SAFETY_REVIEW.md) for
the preview/submit ID contract and documented Webull limitations.

## Configure Webull locally

1. Open **Setup** and enter the Webull OpenAPI App Key, App Secret, account ID,
   region, and endpoint on your own computer.
2. Select **Verify Profile**. Timmy only allows saving after the current values
   pass verification. Editing a field requires verification again.
3. Save the verified profile. Timmy stores it locally under the active runtime
   home; the public website does not receive those credentials.
4. Open **Broker** and run **Check Webull account**. After a profile save or
   account change, Timmy returns the target to Paper and requires a fresh
   account check before Live can be enabled.
5. Confirm the account and buying-power snapshot before any live preview.

Never paste keys, tokens, account identifiers, passwords, or MFA codes into
support requests, screenshots, source files, or public repositories. For exact
Webull setup and authorization details, use [Webull Setup](WEBULL_SETUP.md).

## Alerts and automation

Alerts are local informational rules evaluated after a scan, using the loaded
signal's price, scout score, or action (`trade`, `watch`, or `avoid`). Create a
rule in **Alerts**, select a rule to pause/resume or remove it, and select a
triggered event to acknowledge it. Use **Acknowledge all new** to clear the
current unacknowledged event backlog in one action; the new-event count appears
above Trigger History. Trigger history is local. Alerts do not send desktop
notifications, contact a broker, or create orders.

If the saved alert file cannot be read, Timmy leaves it untouched, warns that
rules and history could not be loaded, and blocks alert writes until the file is
backed up and repaired. This protects the previous rules from being replaced by
an empty alert store.

Automation controls schedule refresh/decision cycles. The **Enable Paper
Automation** action enables only the paper lane. A Live/Auto combination is a
separate, more consequential path and remains subject to the full live gates.
Review the Automation readiness panel and execution target before enabling
either lane.

## Local data and troubleshooting

Timmy keeps UI preferences, watchlist and scanner organization, profiles,
journals, and audit state under its runtime home (`TIMMY_HOME`). If no custom
runtime home is configured, the launcher uses its configured default. Timmy
allows one active native app process per Linux user across all runtime homes.
A second launch exits with a message; it does not stop the active process. The
OS lock is held at `${XDG_CONFIG_HOME:-~/.config}/timmy-trader/timmy-instance.lock`
and released when the process exits. The small lock file may remain afterward;
do not delete it while Timmy is running.

- **No data or synthetic-looking prices:** verify the configured provider and
  CSV file in the runtime home/environment. A new profile may be using
  generated sample candles.
- **Stale data:** check the last candle timestamp and provider status. Remote
  refresh depends on network access and the provider; failed fetches can leave
  older local data in place.
- **CSV will not load:** inspect the row number and required OHLCV values in
  the diagnostic. Timmy preserves an invalid file and does not silently replace
  it with demo bars. Correct the source or deliberately choose another provider.
- **No order plan:** review Scanner and Strategy blockers, score threshold,
  market hours, cash, cooldowns, and risk caps. A scan result alone is not an
  executable order.
- **Live is locked:** run profile verification and Broker Account Check, confirm
  the selected account, and review Setup/Health readiness. Do not bypass a gate
  just to make a button available.
- **Order outcome unknown:** timeouts and server errors may not prove whether
  the broker received an order. Reconcile the client order ID in Webull and
  check order/position state before retrying; Timmy blocks unresolved symbols.
  Timmy records a signed order intent before each broker call, so a shutdown in
  the middle of submission remains visible for review after restart.
- **Timmy refuses a second launch:** close the active instance for this Linux
  user, even if it uses a different runtime home. Do not delete the lock file
  while Timmy is running.

Timmy currently focuses on equities, ETFs, and index proxies. Crypto and
futures remain disabled or scouting-only unless asset-specific support and
permissions have been validated. Options, event contracts, direct indexes,
forex, CFDs, and unsupported instruments do not have a complete live execution
path. The software does not provide streaming quotes, news/earnings analysis,
guaranteed fills, or investment advice.

## More help

- [Operator Checklist](OPERATOR_CHECKLIST.md)
- [Webull Setup](WEBULL_SETUP.md)
- [Workflow reference](WORKFLOWS.md)
- [Risk and legal notes](../site/legal.html#risk)
- [Download the Timmy brochure (PDF)](/downloads/timmy-brochure.pdf)

Timmy is software, not a guarantee of performance. You remain responsible for
reviewing orders, broker permissions, market conditions, and the risk of loss.
