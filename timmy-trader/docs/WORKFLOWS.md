# Timmy Workflows

This document is the durable workflow map for keeping Timmy trading, scanning, syncing watchlists, and publishing source updates without missing required checks.

Do not put broker usernames, passwords, MFA codes, API keys, tokens, account IDs, or screenshots into chat, issues, commits, or CI logs. Live brokerage checks stay local because they require the configured machine and authorized Webull credentials.

## 1. Change Validation Workflow

Use this after every source, config, strategy, broker, watchlist, packaging, or documentation change.

1. Run the Python test suite:

```bash
.venv/bin/pytest
```

2. Run the smoke test:

```bash
.venv/bin/python scripts/smoke_test.py
```

3. Rebuild the desktop ELF when GUI, packaging, broker, config, or launch behavior changed:

```bash
scripts/build_elf.sh
```

4. Restart Timmy so the running process uses the current source:

```bash
pkill -f '/home/sniper-lion-main/trading-bots/trend-trader/.venv/bin/timmy-desktop' || true
setsid scripts/launch_timmy.sh >/tmp/timmy-launch.log 2>&1 &
pgrep -af 'timmy|Timmy'
```

5. From the native GUI, use `Power Cycle` when Timmy should save settings, relaunch through the normal launcher, and replace the old process without using a terminal.

6. Inspect `/tmp/timmy-launch.log` and `timmy-crash.log` if the process does not stay up.

## 2. Live Brokerage Workflow

Use this before relying on unattended live brokerage.

1. Confirm local live switches in `.env`:

```text
TRADER_MODE=live
TRADER_LIVE=1
WEBULL_ENABLE_LIVE_ORDERS=1
AUTO_START_LIVE_ON_MARKET_OPEN=1
ENABLE_EQUITY_FRACTIONAL_TRADING=1
```

2. Confirm the account/buying-power check succeeds from Timmy. If buying power is unavailable, live submission should be treated as blocked.

3. To configure or change accounts, use the native GUI `Setup` tab. Enter the Webull OpenAPI App Key, App Secret, default account ID, region, endpoint, and live switches, run `Verify Profile`, save only after verification passes, run `Broker Check`, choose the desired masked account label, then run `Broker Check` again before switching target back to `Live`.

4. Confirm Timmy has exactly one running process for the active `TIMMY_HOME`.

5. Confirm the current market session and quote freshness are valid for the symbols being traded.

6. Confirm order sizing gates before market open:

```text
MAX_POSITIONS
MAX_DAILY_TRADES
MAX_SYMBOL_DAILY_TRADES
ORDER_COOLDOWN_MINUTES
RISK_PER_TRADE_USD
WEBULL_MAX_ORDER_NOTIONAL_USD
WEBULL_MAX_ORDER_QUANTITY
MAX_ENTRY_CASH_PCT
```

7. Confirm Timmy is producing executable plans. Scanning alone is not the same as order placement.

8. Confirm broker rejections are logged and reviewed before loosening any thresholds.

## 3. Actual Trade Placement Workflow

Use this for the real order lifecycle. This workflow is local-only and must not be moved into GitHub Actions.

1. Timmy scans the current active watchlist and rotating market batch.

2. Timmy writes the generated watchlists:

```text
active-watchlist.txt
movement-watchlist.txt
trade-ready-watchlist.txt
quiet-watchlist.txt
```

3. Timmy builds executable plans only for symbols that pass strategy, score, market, cooldown, daily-cap, per-symbol-cap, risk, notional, quantity, buying-power, and asset-class gates.

4. In `Live / Auto`, the native app runs this order path without requiring the operator to be present:

```text
decision cycle -> exact Webull preview -> live submit -> execution event -> account/buying-power refresh
```

5. The live submit path uses `WebullOpenApiBroker.submit_order()`, which calls the Webull OpenAPI order placement endpoint after the configured live guards pass.

6. The live guards that must remain intentional are:

```text
TRADER_MODE=live
TRADER_LIVE=1
WEBULL_ENABLE_LIVE_ORDERS=1
WEBULL_REQUIRE_PREVIEW=0
WEBULL_ACCOUNT_ID configured locally
```

7. The native app still performs the exact-current-plan preview immediately before submit in `Live / Auto`. This is part of the unattended workflow and does not require a Webull Desktop click.

8. Every live broker result is appended to `execution-events.jsonl` with the submitted plan context. Use the event log to confirm whether an order was submitted, rejected, or blocked.

9. After a submitted or rejected order, Timmy should refresh buying power/account state before the next cycle. If account refresh fails, treat the next live cycle as blocked until the broker state is readable again.

10. If no live trade occurs, classify the miss before changing settings:

```text
no executable plan
stale market data
market closed
buying power unavailable
symbol blocked by whitelist or asset-class guard
score below threshold
cooldown or daily cap active
fractional minimum notional not met
Webull preview rejected
Webull submit rejected
```

11. Webull Desktop is not part of the placement path. It is only a viewer for account, order, position, and watchlist state that came from Webull.

## 4. Fractional-First Trading Workflow

Use this when a symbol is too expensive for a whole-share order or when buying power is limited.

1. Keep fractional trading enabled:

```text
ENABLE_EQUITY_FRACTIONAL_TRADING=1
WEBULL_MIN_EQUITY_FRACTIONAL_NOTIONAL_USD=5
WEBULL_EQUITY_FRACTIONAL_QUANTITY_DECIMALS=5
```

2. Timmy should prefer a fractional US equity order when the calculated whole-share quantity is below one share and the notional meets the configured minimum.

3. Whole-share limit orders remain the fallback when fractional trading is disabled or the fractional order fails broker validation.

4. Treat repeated fractional-order broker rejections as a configuration issue, not a signal issue.

## 5. All-Market Scanning Workflow

Use this to keep Timmy looking across the U.S. listed universe instead of a fixed watchlist.

1. Enable rotation:

```text
ENABLE_WATCHLIST_ROTATION=1
WATCHLIST_UNIVERSE=all-us
WATCHLIST_UNIVERSE_BATCH_SIZE=250
WATCHLIST_UNIVERSE_REFRESH_HOURS=24
```

2. Timmy refreshes the listed-symbol universe, scans a rotating batch, scores movement, and writes generated watchlists.

3. Timmy ships `trend_trader/resources/us-listed-symbols.csv` as a warm-start snapshot. Use it when the runtime cache is missing so discovery does not start from the small default list.

4. The mutable runtime cache remains `timmy-watchlist-universe.txt`; it is refreshed from Nasdaq Trader when reachable and kept out of source control.

5. `active-watchlist.txt` is the custom list Timmy trades from.

6. `movement-watchlist.txt` tracks symbols with enough activity to monitor.

7. `trade-ready-watchlist.txt` tracks active symbols whose strategy signal is eligible before broker/risk submission checks.

8. `quiet-watchlist.txt` tracks symbols removed because activity fell below the quiet threshold.

9. If Timmy scans but does not trade, check `trade-ready-watchlist.txt`, strategy scores, broker risk gates, buying power, cooldowns, and rejection history.

## 6. Webull Watchlist Sync Workflow

Use this to reflect Timmy's generated lists in Webull account-side watchlists. Webull Desktop is only the viewer.

1. Enable sync locally:

```text
WEBULL_SYNC_WATCHLISTS=1
WEBULL_ACTIVE_WATCHLIST_NAME=Timmy Active
WEBULL_MOVEMENT_WATCHLIST_NAME=Timmy Movement
WEBULL_TRADE_READY_WATCHLIST_NAME=Timmy Trade Ready
WEBULL_QUIET_WATCHLIST_NAME=Timmy Quiet Removed
```

2. Timmy creates or updates only the configured Timmy-managed watchlists.

3. Existing non-Timmy Webull watchlists must be left alone.

4. After a scan cycle, verify account-side counts with a read-back check. Report only names, counts, and symbols; do not expose internal IDs or credentials.

5. If Webull Desktop does not immediately show the changes, refresh or restart Webull Desktop. The account-side API read-back is the source of truth.

## 7. Publication Workflow

Use this when updating the public mirror.

1. Copy source-only files to the mirror and exclude credentials, runtime state, generated dependencies, build output, journals, cache, locks, and generated watchlists.

2. Run mirror validation:

```bash
PYTHONPATH=/home/sniper-lion-main/Documents/GitHub/AdventureCode-Projects/timmy-trader \
  /home/sniper-lion-main/trading-bots/trend-trader/.venv/bin/pytest \
  /home/sniper-lion-main/Documents/GitHub/AdventureCode-Projects/timmy-trader/tests
```

3. Check the staged diff:

```bash
git diff --cached --check
git status --short
```

4. Scan staged content for accidental credentials before commit.

5. Push and verify the remote head:

```bash
git push origin HEAD
git ls-remote origin HEAD
```

## 8. GitHub CI Workflow

The repository includes `.github/workflows/ci.yml` for source validation on pushes, pull requests, and manual dispatch.

CI performs:

- package install,
- Python module compilation,
- test suite,
- smoke test,
- source-only boundary check.

CI intentionally does not call live Webull endpoints, inspect account state, submit orders, or mutate watchlists. Those checks must run locally on the authorized machine.

## 9. Native GUI Model

The native GUI is organized around Timmy's model:

```text
Setup -> Universe -> Scanner -> Strategy -> Execution -> Broker -> Audit
```

- `Setup` is the Webull profile form, account picker, broker check, and setup status.
- `Universe` is the known stock/ETF ticker pool and rotating market batch.
- `Scanner` is the ranked activity board.
- `Strategy` is the decision brief and eligibility explanation.
- `Execution` is the risk-capped order queue.
- `Broker` is the Webull check, preview, submit, and rejection surface.
- `Audit` is the local event trail for submitted, rejected, and paper events.

The top metric band should show the model state first: universe size, active list count, movement count, trade-ready count, executable plan count, and buying power.

Overview-only widgets such as the hero, pipeline metric band, and execution controls should not stay pinned across focused tabs. `Setup`, `Universe`, `Scanner`, `Strategy`, `Execution`, `Broker`, and `Audit` should use the main content area for the selected workflow surface.

Focused tabs should carry their own operational context:

- `Setup`: Webull OpenAPI key fields, masked account ID entry, region/endpoint, live switches, verification gate, account picker, save profile, broker check, and setup readiness status.
- `Universe`: universe source, bundled snapshot counts, runtime cache, generated watchlists, and Webull watchlist-sync names.
- `Scanner`: scanned ticker table with summary counts for scanned, moving, tradeable, and blocked symbols plus selected-symbol scout, price, and operational gate details.
- `Strategy`: full decision surface with style/pattern/readiness summary, decision brief, eligible symbols, watch focus, and model gate explanations.
- `Execution`: full order desk with the moved execution controls, target/queue/fractional/broker summary, run/preview/paper/live actions, executable queue details, preview freshness, broker gates, and risk blockers.
- `Broker`: current account lane, buying-power snapshot, live switches, preview state, and Webull route controls until a real broker response replaces it.
- `Audit`: audit-chain state, protected-file integrity status, event totals, live/paper/rejected counts, and recent execution events.

Use icons only where the command is obvious: run, live submit, stop, and power cycle. Keep text on higher-context actions such as scan, broker check, and route preview.

Account setup and switching are GUI workflows. The Setup tab should verify the Webull profile before saving anything, save the verified profile locally, show masked account labels discovered from verification or `Broker Check`, save the selected account locally, clear stale live previews, return execution to `Paper`, and require a fresh broker check before the user enables `Live` for the newly selected account.

Tamper-resistance is also a GUI-visible workflow. Timmy signs execution events into a local hash chain and keeps `.timmy-integrity.json` as a signed baseline for protected runtime files. Timmy updates that baseline after its own profile, settings, watchlist, journal, and event-log writes. If those files are edited outside Timmy, the Audit tab should show an audit warning before the operator trusts recent activity.
