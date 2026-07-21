# Timmy Hotfix Implementation Log

Date: 2026-07-20

## Scope

Timmy started as a guarded trading mechanism for Webull. The current build includes:

- Trend/pattern scanner from OHLCV CSV bars.
- Risk-capped order planning.
- Paper trading journal.
- Webull OpenAPI account check.
- Webull OpenAPI order preview.
- Local GUI dashboard.
- Live order placement guarded by environment switches.

## Project Location

```text
/home/sniper-lion-main/trading-bots/trend-trader
```

## Commands

```bash
cd /home/sniper-lion-main/trading-bots/trend-trader
. .venv/bin/activate
timmy scan --data examples/sample_bars.csv
timmy plan --data examples/sample_bars.csv
timmy webull-check
timmy webull-preview --data examples/sample_bars.csv
```

Native app:

```text
timmy-trader
```

ELF desktop launcher build:

```bash
scripts/build_elf.sh
./dist/Timmy/Timmy
```

## Webull Setup

Webull OpenAPI access was approved through the Webull OpenAPI portal. Required local values are stored in `.env`:

```text
WEBULL_APP_KEY=<set locally>
WEBULL_APP_SECRET=<set locally>
WEBULL_ACCOUNT_ID=<Individual Cash account id>
WEBULL_REGION=us
WEBULL_API_ENDPOINT=api.webull.com
WEBULL_SUPPORT_TRADING_SESSION=CORE
```

Do not put Webull usernames, passwords, MFA codes, App Secrets, account IDs, or access tokens in chat.

## Problems Found And Fixes

### ELF Packaging

User requested an ELF executable instead of a plain web-app command. Timmy now builds a Linux ELF at:

```text
dist/Timmy/Timmy
```

Build command:

```bash
scripts/build_elf.sh
```

Two packaging fixes were needed:

- `trend_trader/desktop.py` uses absolute imports so PyInstaller can execute it as the app entrypoint.
- `scripts/build_elf.sh` uses `--collect-data webull` because Webull's SDK requires packaged JSON files such as `webull/core/data/endpoints.json`.

Verified ELF:

```text
ELF 64-bit LSB executable, x86-64
```

Verified through the ELF-backed server:

```text
POST /api/webull-preview -> 200
estimated_cost: 191.79
estimated_transaction_fee: 0.00
```

### Signature Error

Initial Webull calls failed with:

```text
401 UNAUTHORIZED: Header x-signature is invalid
```

Cause:

```text
WEBULL_API_ENDPOINT=https://api.webull.com
```

Fix:

```text
WEBULL_API_ENDPOINT=api.webull.com
```

Webull's Python SDK examples pass the endpoint without the scheme.

### Token Pending

After the endpoint fix, the SDK created a token with:

```text
status:PENDING
```

Resolution:

- Open Webull mobile app.
- Go to Menu -> Messages -> OpenAPI Notifications.
- Open the latest verification.
- Tap Check Now.
- Enter SMS code and confirm.

After approval, `timmy webull-check` returned status `200`.

### Account Selection

Webull returned multiple account classes:

- Crypto Cash
- Individual Margin
- Events Cash
- Individual Cash

Timmy was configured to use Individual Cash for initial stock/ETF preview work.

### SDK Logging Leak

The official SDK printed detailed request data on auth failure, including request headers. Timmy now suppresses the SDK's default stream/file logging and removes `webull_trade_sdk.log` from the working path.

### Account ID Output

Webull preview initially printed raw account IDs inside `request_payload`. Timmy now redacts the output as:

```text
"account_id": "<configured>"
```

### Package Discovery

Webull's token cache created a root-level `conf/` directory. Editable package install then failed because setuptools discovered multiple top-level packages.

Fix:

```toml
[tool.setuptools.packages.find]
include = ["trend_trader*"]
```

`conf/` is now ignored in `.gitignore`.

## Current Verification

Smoke test:

```text
Timmy smoke tests passed
```

Scanner:

- SPY eligible, score 84
- QQQ eligible, score 84
- NVDA eligible, score 84
- AAPL watch, score 54
- IWM watch, score 18

Risk plan:

```text
BUY 1 NVDA LIMIT 191.79
Stop 189.67
Target 196.02
Notional 191.79
```

Webull preview:

```text
status_code: 200
estimated_cost: 191.79
estimated_transaction_fee: 0.00
currency: USD
```

### Scout And Buy-Low/Sell-High Controls

Timmy now treats the scanner as the first decision gate. Stocks, ETFs, and index proxies are ranked by trend, breakout behavior, RSI, volume, volatility, and average movement. The native dashboard keeps watch names visible as "changing enough to inspect," while only eligible names become executable plans.

Executable plans now use a pullback buy-limit entry below the latest close, then derive the stop and sell target from that entry. The entry discount, stop width, target multiple, and watch ranking adapt to volatility and volume conditions while still respecting hard account-level caps.

```text
Scout +/-2.5% movement -> rank setup -> wait for buy-limit entry -> sell into target -> cap downside at stop
```

Live execution supports two operator modes:

- `User`: clicking `Live` opens a confirmation dialog before any live submit attempt.
- `Auto`: clicking `Run` can submit the ranked live order plan automatically when the live environment switches and Webull adapter allow it.

Live submit still goes through the existing Webull guard checks and will be blocked unless live trading is intentionally enabled in environment configuration.

Bearish changes are now detected and ranked as watch/scout signals. Timmy does not silently create short-sale orders in this build; executable plans remain buy-low/sell-high long limit plans.

When the native GUI is set to `Auto`, manual execution buttons are disabled to prevent accidental clicks while automation is active. `Stop` remains enabled and switches the console back to `User` mode.

### Account Cash Display

The native dashboard now includes a `Cash Available` card. It updates after `Check Webull` reads the account response and displays the best available cash or buying-power value Timmy can extract. Account identifiers remain redacted in the broker response panel.

The native dashboard also schedules a Webull account/balance auto-refresh every four hours while Timmy is open. It only runs when the Webull app key, app secret, and account ID are configured; otherwise it skips safely and keeps the manual `Check Webull` button available.

### Too-Expensive Buy Gate

Timmy now separates "moving enough to scout" from "reasonably priced enough to buy." The scanner marks expense warnings when RSI is overheated, price is stretched above moving averages, reward/risk is thin, or a buy-limit entry is too large compared with available cash. Stacked expense warnings block long order plans and keep the signal in watch mode.

Research basis:

- FINRA describes P/E and P/S as common stock valuation measures and frames value investing around securities trading at discounts to intrinsic worth or peers.
- Fidelity's technical analysis education describes RSI as an overbought/oversold momentum tool and moving averages as support/resistance context.
- Fidelity's ATR guide frames ATR as a volatility measure, which Timmy uses for entry, stop, and target bands.

### Execution Event Log

The native dashboard now includes an `Event Log` panel. Paper and live submit attempts record buy/order events with symbol, quantity, buy limit, target sell price, stop price, sold price when available, sell status, mode, and broker/order status.

Runtime event path:

```text
execution-events.jsonl
```

Paper broker fills also continue writing to:

```text
trade-journal.jsonl
```

### Sensible Trading Score

Timmy now creates a final sensible score after the raw scanner score. This score turns every signal into one of three actions:

```text
trade
watch
avoid
```

Inputs include early movement, trend quality, direction, reward/risk, volatility, expense warnings, cash fit, and recent rejected/failed/stopped events for the same symbol. The native GUI shows this in the `Sensible` column, and order planning requires a local `trade` action before a live or paper order plan is eligible.

### Replace Existing Native Instance

Timmy now uses the native lock file as a handoff mechanism. On launch, it checks for an existing Timmy PID, sends it a graceful shutdown, waits briefly, force-kills only if needed, then opens the new instance. This prevents duplicate trading loops while still making a launcher click refresh the visible app.

### Operational And Tamper-Resistance Improvements

Runtime rendering now caches execution events once per refresh, deduplicates paper/live records before display, and builds recent bad-event counts once instead of scanning log files for every signal row. Scanner ordering now prioritizes sensible score before raw scanner score.

New execution records in `execution-events.jsonl` are tamper-evident. Timmy creates a local `.timmy-audit-key`, signs each event with an HMAC hash, and chains every event to the previous event hash. The Event Log panel reports an audit warning if signed events are edited, deleted, malformed, or reordered.

## Native GUI

Timmy was corrected into a native Tk Linux app after the browser dashboard was rejected as the primary user experience. The installed app starts `/opt/timmy-trader/Timmy`, uses a single-instance native lock, and does not open port `8765`.

Files:

```text
trend_trader/desktop.py
trend_trader/native_gui.py
scripts/build_elf.sh
scripts/package_deb.sh
Timmy.desktop
packaging/timmy-trader
packaging/timmy-trader.desktop
```

`scripts/build_elf.sh` packages the native app with PyInstaller as a Linux ELF executable at `dist/Timmy/Timmy`.

Runtime data root:

```text
TIMMY_HOME=<optional project/data path>
```

If `TIMMY_HOME` is not set, Timmy uses the current working directory for `examples/sample_bars.csv`, `.env`, and `trade-journal.jsonl`. Credentials and runtime journals stay external.

File-manager launch path:

```text
Timmy.desktop
```

The launcher sets `TIMMY_HOME` and starts the ELF.

Installable package path:

```text
dist/timmy-trader_0.1.0_amd64.deb
```

Package layout:

```text
/opt/timmy-trader/Timmy
/usr/bin/timmy-trader
/usr/share/applications/timmy-trader.desktop
/usr/share/doc/timmy-trader/
```

The Debian launcher uses `~/.config/timmy-trader` as `TIMMY_HOME`. On first run, it seeds a safe runtime `.env` from the packaged `env.example` if no installed config exists. It does not copy the source checkout `.env`, token file, or other local secrets.

The launcher no longer migrates `conf/token.txt` from the local project. Installed runtimes must use their own Webull token approval flow, and token files are never bundled or copied from the source checkout.

Routes:

```text
GET  /
GET  /api/status
POST /api/sample-data
GET  /api/scan
GET  /api/plans
POST /api/paper-trade
POST /api/webull-check
POST /api/webull-preview
GET  /api/journal
```

Dashboard sections:

- Status metrics.
- Ranked signals.
- Risk-capped order plan.
- Webull preview output.
- Paper journal.

## GUI / UX Upgrade

Completed on 2026-07-20.

Superseded by the native GUI correction below. The browser dashboard files remain in the repository as a development fallback, but the installed executable no longer opens a browser or runs the web dashboard as the user-facing app.

Changed the dashboard from a basic table view into a workstation-style command center:

- Added a persistent left rail with section navigation and runtime status.
- Added a larger overview header with the main refresh, Webull check, and preview actions.
- Split status into readable metric cards for mode, Webull account state, max notional, and risk.
- Reworked the scanner into ranked signal rows with setup, score bars, decision pills, close, stop, and target.
- Reworked the order plan into compact cards with limit, notional, stop, target, and reason.
- Added a broker preview summary area before the raw redacted preview payload.
- Improved toast feedback for refresh, data refresh, Webull check, preview, and paper-trade actions.
- Added responsive CSS for narrow displays.

Files changed:

```text
trend_trader/static/dashboard.html
trend_trader/static/dashboard.css
trend_trader/static/dashboard.js
```

Verification:

```text
node --check trend_trader/static/dashboard.js
python -m compileall trend_trader
./scripts/package_deb.sh
sudo apt install --reinstall -y ./dist/timmy-trader_0.1.0_amd64.deb
curl http://127.0.0.1:8765/
curl http://127.0.0.1:8765/api/status
curl http://127.0.0.1:8765/api/scan
curl -X POST http://127.0.0.1:8765/api/webull-preview
```

Installed-app smoke result:

```text
Historical browser-dashboard smoke result: bundled HTML contained app-shell, Timmy, and Signal Board.
Status: paper mode, live false, Webull account configured, live orders false, preview required true.
Scan: returned ranked signals.
Webull preview: returned ok true, status_code 200, estimated cost 191.79, estimated fee 0.00.
Screenshot: /tmp/timmy-installed-gui.png
```

## Single Instance Guard

Completed on 2026-07-20.

Superseded by the native GUI correction below. Timmy still enforces one active app instance per runtime home, but the lock now protects the native ELF process rather than a browser-backed dashboard server.

Behavior:

- The first Timmy process claims `TIMMY_HOME/timmy.lock`.
- The first process writes the active dashboard URL to `TIMMY_HOME/runtime-url.txt`.
- A second Timmy launch detects the held lock, opens the existing dashboard URL, and exits without starting another server.
- Stale lock files are harmless because the operating-system file lock is released when the owning process exits.

Source:

```text
trend_trader/desktop.py
```

Verification:

```text
TIMMY_HOME=/tmp/timmy-single-instance-test python -m trend_trader.desktop --host 127.0.0.1 --port 8777 --no-browser
TIMMY_HOME=/tmp/timmy-single-instance-test python -m trend_trader.desktop --host 127.0.0.1 --port 8777 --no-browser
```

Historical browser-dashboard result:

```text
First launch: server bound to 127.0.0.1:8777.
Second launch: exited 0 without binding another server.
Lock file: pid and active dashboard URL written.
Installed launch: one /opt/timmy-trader/Timmy process remained listening on 127.0.0.1:8765 after a second timmy-trader command.
```

## Native Executable Correction

Completed on 2026-07-20.

Corrected Timmy from a browser-launched local dashboard into a native Linux executable program.

What changed:

- Added `trend_trader/native_gui.py` as the Tk desktop GUI.
- Replaced `trend_trader/desktop.py` so `Timmy` opens the native GUI directly.
- Removed browser-opening behavior from `packaging/timmy-trader`.
- Removed browser-opening behavior and web-server flags from `scripts/launch_timmy.sh`.
- Updated desktop launchers to `Terminal=false` and native-app wording.
- Simplified `scripts/build_elf.sh` so the ELF build targets the native Tk app, not a Uvicorn/browser bundle.
- Updated Debian metadata from dashboard language to native Webull trading app language.

Final installed behavior:

```text
Executable: /opt/timmy-trader/Timmy
Launcher: timmy-trader
Mode: native
Browser launch: no
Web server on 127.0.0.1:8765: no
Single-instance guard: yes
```

Final smoke result:

```text
ss -ltnp '( sport = :8765 )' returned no listener.
First launch produced one /opt/timmy-trader/Timmy process.
Second timmy-trader launch exited 0.
Process lock contained mode=native.
Screenshot: /tmp/timmy-native-final-fixed.png
```

## Native UX And Decision Controls

Completed on 2026-07-20.

Enriched the native executable UI and renamed the user-facing app to `Timmy`.

Added controls:

- Min score control for filtering executable plans.
- Plan limit control capped by configured max positions.
- Auto interval control for recurring decision cycles.
- `Arm paper auto` control for paper-only automated execution loops.
- `Run Cycle` decision-cycle button.
- `Stop Auto` button.
- Decision brief panel with ranked action list and guard state.
- Selected-signal reasoning panel showing setup inputs and why the bot ranked a symbol.
- Clear live-order guard display.

Guard posture:

```text
The native GUI does not expose live order placement.
Decision cycles can preview through Webull or submit to the local paper journal.
Live execution still requires deliberate environment-level live switches and is not silently enabled by the UI.
```

Rename:

```text
Window title: Timmy
Launcher name: Timmy
Package description: Timmy native Webull trading assistant
```

## Live User / Auto Mode

Completed on 2026-07-20.

Added live real-money submission controls to the native app.

Controls:

- `Mode`: switches between `User` and `Auto`.
- `Live`: manually submits the current live order plan.
- `Run`: runs the decision cycle.
- `Stop`: stops automation.

Behavior:

- `User` mode asks for confirmation before submitting a live order plan.
- `Auto` mode lets the decision cycle attempt live submission after ranking the plan.
- Live submission uses the guarded Webull adapter and still obeys environment-level live switches.
- If live switches are not enabled, the adapter reports the block and does not place the order.
- The GUI remains native-only and does not open a browser or bind a web port.
- The operator-facing runbook is `docs/OPERATOR_CHECKLIST.md`; use it before Auto mode, Live mode, Webull preview, or crypto/futures expansion.

Hardening added with this pass:

- Bad numeric GUI controls are clamped into valid ranges.
- Bad or missing CSV data is regenerated instead of crashing the app.
- Bad config values fall back to safe paper defaults and show a visible fallback state.
- Background broker actions avoid touching Tk state directly.
- Auto-refresh and automation timers are cancelled on window close.

## Safety Controls

Live trading remains disabled unless all of these are intentionally set:

```text
TRADER_MODE=live
TRADER_LIVE=1
WEBULL_ENABLE_LIVE_ORDERS=1
WEBULL_REQUIRE_PREVIEW=0
WEBULL_ACCOUNT_ID=<configured>
```

Current defaults keep Timmy in paper/preview mode.

## Webull Desktop Update Finding

Webull Desktop is installed locally as:

```text
webulldesktop 8.9.0 amd64
```

Main binary:

```text
/usr/local/WebullDesktop/WebullDesktop
```

Launcher:

```text
/usr/share/applications/WebullDesktop.desktop
```

Webull's public desktop page advertises Desktop 9.0. No apt-backed Webull update channel was found, so the safer update path is downloading the official Linux/Ubuntu `.deb` installer and installing that file:

```bash
sudo apt install ./PATH_TO_DOWNLOADED_WEBULL_DEB.deb
```

## Remaining Work

- Replace sample CSV with real market data ingestion.
- Add watchlist editing from the dashboard.
- Add persisted dashboard settings for risk controls.
- Add order history and position queries.
- Add Webull market data subscriptions if needed.
- Add authentication for dashboard if exposed beyond localhost.
- Add a clear manual approval step before any live placement.
- Add automated tests for dashboard API routes.
- Add icon/theme metadata for the ELF launcher.

## Operational Decision Upgrades

Completed on 2026-07-20.

Added a second operational gate after signal scoring and before order plans are allowed to execute.

New gates:

- Regular market-session guard through `REQUIRE_MARKET_HOURS`.
- Minimum reward/risk through `MIN_REWARD_RISK_TO_TRADE`.
- Maximum signal volatility through `MAX_SIGNAL_VOLATILITY_PCT`.
- Account cash entry cap through `MAX_ENTRY_CASH_PCT`.
- Recent rejection/failure avoidance through `MAX_RECENT_REJECTIONS`.
- Daily trade cap through `MAX_DAILY_TRADES`.
- Per-symbol daily cap through `MAX_SYMBOL_DAILY_TRADES`.
- Per-symbol cooldown through `ORDER_COOLDOWN_MINUTES`.
- Estimated realized daily-loss cap through `MAX_DAILY_LOSS_USD`.

Execution hardening:

- `Preview Order`, `Paper Trade`, and `Live` refresh the dashboard payload before using plans, reducing stale-plan risk.
- The native signal detail panel now lists operational block reasons for the selected symbol.
- Shared order planning now rejects low reward/risk and excessive-volatility plans even outside the native GUI path.

## Vigilance And Scouting Upgrades

Completed on 2026-07-20.

Added explicit scout scoring before sensible trade scoring.

Scouting inputs:

- Latest bar movement versus the prior close.
- Three-bar acceleration.
- Opening gap/shift versus prior close.
- Unusual volume versus recent baseline.
- Latest range expansion versus ATR.
- Bullish proximity to recent highs.
- Bearish proximity to recent lows.
- Noise penalties for low-volume moves, excessive volatility, or extreme RSI.

Behavior:

- Every signal now carries `scout_score` and `scout_action`.
- Scout actions are `alert`, `watch`, or `quiet`.
- Quiet symbols that are not otherwise trade-ready become `skip`.
- The native Signal Board has a `Scout` column.
- Selected signal details now explain scout reasons alongside price and operational checks.
- Ranked scanner ordering now prioritizes scout urgency first, then sensible score, then base score.

## Paper Trading Data Collection

Completed on 2026-07-20.

Paper trading now records more than a basic accepted order.

Added:

- `paper_context` on each paper entry.
- Signal snapshot at decision time.
- Scout score/action and sensible score/action at decision time.
- Execution controls at decision time.
- Latest candle timestamp used for the paper decision.
- Pending paper outcome reconciliation against newer OHLCV candles.
- Target-hit, stopped, paper P/L, and closed timestamp fields when an outcome can be inferred.
- `paper-training-summary.json` with aggregate paper counts, pending/closed outcomes, win/loss counts, net paper P/L, and per-symbol totals.

Outcome rule:

- If a later candle hits both stop and target, Timmy records the stop first. That keeps paper results conservative instead of overstating performance from ambiguous OHLC bars.

## Market-Open Execution Workflow

Completed on 2026-07-20.

Added streamlined execution controls:

- `Target`: switches between `Paper` and `Live`.
- `Mode`: switches between `User` and `Auto`.
- `Run`: follows the selected target and mode.

Market-open automation:

- `AUTO_START_PAPER_ON_MARKET_OPEN=1` arms paper automation.
- `AUTO_START_LIVE_ON_MARKET_OPEN=0` keeps live market-open automation off unless explicitly enabled after live guards are validated.
- `MARKET_OPEN_POLL_SECONDS=30` controls how often Timmy checks for regular market open.
- When both paper and live are enabled, Timmy records the paper path first, then attempts the guarded live path.

Current live guard remains unchanged:

```text
TRADER_MODE=live
TRADER_LIVE=1
WEBULL_ENABLE_LIVE_ORDERS=1
WEBULL_REQUIRE_PREVIEW=0
WEBULL_ACCOUNT_ID=<configured>
```

## Consolidation, Speed, Calendar, And Splash

Completed on 2026-07-20.

Consolidation and speed:

- Market bars now load once per refresh cycle and are reused by scanner scoring, paper context, and paper outcome reconciliation.
- Signal lookup now uses a symbol map instead of repeated list scans.
- Execution events are cached by journal/event-log file size and modification time.
- Paper outcome reconciliation now reports whether logs changed, so Timmy only reloads event history when necessary.
- Paper execution can reuse the already-refreshed dashboard snapshot during decision cycles.
- Automation ticks now use the same `Target` and `Mode` workflow instead of a paper-only timer path.

Market calendar:

- Added an NYSE-aware market calendar module.
- Handles regular weekday sessions.
- Blocks known 2026 full-market holidays.
- Handles known 2026 early closes at 1 p.m. Eastern.
- Market-open polling backs off when open is far away, then checks more frequently near open.

Startup workflow:

- Added a native splash screen.
- Splash steps follow the workflow: configuration, journals, market scan, paper reconciliation, trade plans, and dashboard render.

Service scaffold:

- Added `scripts/install_user_service.sh`.
- Installs `~/.config/systemd/user/timmy-trader.service`.
- The service is not enabled automatically; enable it intentionally with `systemctl --user enable --now timmy-trader.service`.

## Market Data, Watchlist, Backtest, And Broker Sync

Completed on 2026-07-20.

Added installable missing pieces:

- `trend_trader/watchlist.py` for watchlist loading and default watchlist creation.
- `trend_trader/market_data.py` for delayed daily-bar ingestion without adding a heavy dependency.
- `trend_trader/backtest.py` for historical strategy simulation.
- `timmy watchlist-init`.
- `timmy fetch-data`.
- `timmy backtest`.
- `timmy webull-sync`.

Config:

```text
MARKET_DATA_PROVIDER=csv
MARKET_DATA_MAX_AGE_MINUTES=15
WATCHLIST_PATH=watchlist.txt
WATCHLIST_TEMPLATE=equity
```

Notes:

- Default provider remains `csv` for predictable local behavior.
- Set `MARKET_DATA_PROVIDER=yahoo` to let the native app refresh delayed daily bars when the local data file is stale.
- `MARKET_DATA_PROVIDER=stooq` is supported, but Timmy falls back to Yahoo when Stooq serves a browser verification page instead of CSV.
- `webull-sync` probes account, position, and order endpoints exposed by the installed Webull SDK and reports unsupported SDK shapes without crashing.
- These market-data paths are practical ingestion bridges, not low-latency real-time feeds.

Launcher hardening:

- New launches scan for `/opt/timmy-trader/Timmy`, `timmy-desktop`, and `python -m trend_trader.desktop` process forms.
- Matching prior Timmy instances receive `SIGTERM`, then `SIGKILL` if needed, before the new instance claims `timmy.lock`.

## Asset-Class Knowledge Guardrails

Completed on 2026-07-20.

Expanded Timmy's knowledge base and guarded instrument model beyond the initial stocks/ETFs/index-proxy workflow.

Added:

- `knowledge/asset-classes.md` with practical guidance for crypto, commodity/raw-material exposure, forex/currencies, indexes/index proxies, and unsupported instruments.
- `timmy asset-classes` to show enabled instrument classes, configured non-equity symbols, and per-class safety limits.
- Watchlist templates for equities, crypto pairs, commodity ETFs, index proxies, and futures watch symbols.
- `WATCHLIST_TEMPLATE` controls which template the native app creates when its configured watchlist file is missing.
- Yahoo data aliases for common crypto pairs, such as keeping `BTCUSD` in Timmy while fetching bars from `BTC-USD`.
- Order plans now carry `instrument_type`, `market`, `time_in_force`, `entrust_type`, and session fields so Webull payloads are no longer hardcoded as equities.
- Crypto payload routing is installed but disabled by default through explicit `.env` switches.
- Futures symbols are scouting-only until contract-aware multiplier, tick-size, margin, expiry, and session handling are installed.
- README discovery notes for asset-class knowledge searches.
- Cross-links and guardrails in risk controls, order handling, scouting, market hours, paper-to-live promotion, and red/green flags.

Safety posture:

- Equities remain the only enabled asset class by default.
- Crypto should stay in data, scouting, backtest, or paper-only mode until broker support, account permissions, session handling, symbol mapping, precision, fees, and order preview behavior are verified for the exact instrument type.
- Futures should stay scouting-only until Timmy has contract-aware sizing and broker validation for the exact contract.
- Direct indexes remain context-only unless mapped to tradable proxies.
- Options, event contracts, CFDs, direct forex, bonds, mutual funds, warrants, rights, and other complex instruments remain unsupported for live execution by default.

Broker validation still required before live crypto/futures:

- Confirm the live `WEBULL_ACCOUNT_ID` maps to the required account class, such as a crypto account or futures-enabled margin account.
- Confirm the matching Webull instrument endpoint returns the intended crypto pair or futures contract, market, tradability, tick size, and status.
- Confirm `timmy webull-preview` accepts the exact `new_orders` payload for a tiny whitelisted order and returns expected buying-power, margin, fee, and validation details.
- Confirm supported order type, time-in-force, and entrust values for the asset before relying on Timmy's current `LIMIT`, `DAY`, and `QTY` defaults.
- Confirm minimum and maximum order amounts, pending-order caps, futures contract limits, and any remaining-position minimums.
- Confirm quantity precision, price precision, tick size, contract multiplier, and broker rounding behavior.
- Confirm fees, commissions, spread/markup, exchange charges, and realistic bid/ask width against Timmy's reward/risk assumptions.
- Confirm market data entitlement and freshness for the asset class; futures data may require a paid subscription, and crypto must use a working asset-specific data endpoint.

Live workflow hardening:

- `AUTO_START_LIVE_ON_MARKET_OPEN` now defaults to `0`; live market-open automation must be explicitly enabled.
- `AUTO_START_PAPER_ON_MARKET_OPEN=1` remains the safe default for paper-only market-open training.
- `MARKET_OPEN_POLL_SECONDS=30` is the safe default market-open check interval.
- Native Live submit requires the exact current order plan to have been previewed in the same GUI session. If refresh changes symbol, quantity, limit, stop, target, instrument type, market, TIF, entrust type, session, configured account, or the preview is more than three minutes old, Timmy blocks Live submit until preview is run again.
- The installed launcher no longer copies `.env` or Webull token files from the source checkout. First run seeds only the packaged safe `env.example` when no runtime config exists.
- The native app now displays latest candle age and blocks executable native plans when the loaded candle set is stale, so a fresh CSV modification time cannot hide old market data.

## Native GUI Asset-Class Visibility

Completed on 2026-07-20.

Updated the native Decision Brief to show a compact asset-class summary:

- Enabled asset classes.
- Configured non-equity symbols, grouped by class.
- Disabled or scouting-only warnings for configured crypto, futures, options, and event-contract symbols.

This is a GUI/docs visibility change only. Broker execution logic and order-routing guards remain unchanged.
