# Timmy

Timmy is a guarded trend and pattern trading engine for stocks, ETFs, and index proxies by default, with disabled-by-default routing guardrails for crypto and futures. It is designed to make evidence-based decisions from prior/current market data, not to predict the future.

Start with the full operator documentation here:

```text
docs/TIMMY_MASTER_DOCUMENTATION.md
```

Operational workflows for validation, live brokerage, fractional trading, all-market scanning, Webull watchlist sync, and source publication live here:

```text
docs/WORKFLOWS.md
```

## Current Scope

- Scouts stocks, ETFs, and index proxies from OHLCV bars for above-average change.
- Detects trend continuation and breakout-style setups.
- Flags early bullish or bearish moves when the latest change is at least `2.5%`.
- Adds a vigilance scout score that tracks single-bar movement, three-bar acceleration, gap movement, unusual volume, range expansion, and proximity to recent highs/lows.
- Ranks opportunities by scout urgency, trend, momentum, volume, volatility, and risk/reward.
- Creates risk-capped buy-low/sell-high limit order plans.
- Adapts buy-limit, stop, and sell-target bands from observed volatility and volume.
- Blocks buys that appear too expensive from stacked overextension checks such as hot RSI, price stretched above moving averages, thin reward/risk, or entry size versus available cash.
- Adds a sensible trading score that reduces each symbol to `trade`, `watch`, or `avoid`.
- Supports paper trading into a local JSONL journal.
- Enriches paper trades with signal, scout, sensible-score, controls, and candle-timestamp context so the paper path can become useful training data.
- Reconciles pending paper trades against newer candles when target or stop thresholds are hit.
- Shows an execution event log with buy price, sold price when available, target, stop, quantity, and status.
- Adds a tamper-evident audit chain to new execution events.
- Adds operational gates for market session timing, daily trade caps, per-symbol caps, symbol cooldowns, recent rejection history, minimum reward/risk, and maximum volatility.
- Uses an NYSE-aware market calendar for regular sessions, 2026 full-market holidays, and known 1 p.m. early closes.
- Shows a native splash screen that follows startup workflow: config, journals, market data, paper reconciliation, trade plans, and dashboard rendering.
- Can fetch delayed daily market bars into Timmy's CSV format through `timmy fetch-data`.
- Includes a `timmy backtest` runner for testing the current strategy on historical bars before relying on paper/live flows.
- Includes a `timmy webull-sync` snapshot command for guarded account/position/order endpoint checks when supported by the installed Webull SDK.
- Includes a local knowledge repository with searchable trading workflow guidance, best practices, and red/green flags.
- Adds guarded instrument-class routing for equities, crypto, configured futures, and configured option legs.
- Shows enabled asset classes, configured non-equity symbols, and disabled/scouting-only warnings in the native Decision Brief.
- Includes a guarded Webull OpenAPI adapter for account verification.
- Displays available cash or buying power after `Check Webull` can read the account response, then auto-refreshes that Webull balance snapshot every 15 minutes by default while the native app is open and the account is fully configured.
- Blocks live order placement by default.
- Prioritizes fractional US equity orders when enabled, so Timmy can place decimal-share buys inside the same risk and notional caps.
- Remembers the last UI runtime settings on the next launch, including target, mode, account lane, score, plan limit, auto interval, trading style, and enabled patterns.
- Adds adaptable trading style presets and pattern toggles for breakout, momentum, pullback, and volume-expansion setups.
- Documents practical guardrails for asset-class expansion beyond stocks/ETFs, including crypto, commodity exposure, forex/currencies, index proxies, and unsupported instruments.

## What It Does Not Do Yet

- It does not place live Webull orders unless the live environment switches are intentionally enabled and the Webull adapter allows the submit path.
- It does not store your Webull username or password.
- It does not guarantee profits.
- It does not trade options by default.
- It does not live-trade crypto unless its explicit switches, symbols, account permissions, market data, and Webull previews are confirmed.
- It does not live-trade futures until contract multipliers, tick sizes, margin, expiry, and session handling are installed.
- It does not live-trade forex, CFDs, options, direct indexes, event contracts, or other unsupported instruments.

## Setup

```bash
cd /home/sniper-lion-main/trading-bots/trend-trader
python3 -m venv .venv
. .venv/bin/activate
pip install -e .
```

Copy the environment template, then review `docs/OPERATOR_CHECKLIST.md` before enabling Auto mode, switching to Live, previewing Webull orders, or expanding beyond the default equity/ETF path:

```bash
cp .env.example .env
```

Put Webull OpenAPI credentials in `.env` only:

```text
WEBULL_APP_KEY=
WEBULL_APP_SECRET=
WEBULL_ACCOUNT_ID=
```

Fractional equity priority:

```text
ENABLE_EQUITY_FRACTIONAL_TRADING=1
WEBULL_MIN_EQUITY_FRACTIONAL_NOTIONAL_USD=5
WEBULL_EQUITY_FRACTIONAL_QUANTITY_DECIMALS=5
TRADING_STYLE=adaptive
TRADING_PATTERNS=breakout,momentum,pullback,volume
TIMMY_DASHBOARD_REFRESH_SECONDS=60
TIMMY_ACCOUNT_REFRESH_MINUTES=15
```

When enabled, Timmy prioritizes fractional `MARKET` equity orders with decimal `quantity` for eligible US stock/ETF buys. It still honors the configured risk, max-notional, max-quantity, market-hours, daily-trade, per-symbol, and minimum-notional guards. Whole-share limit orders remain the fallback when fractional equity trading is disabled.

Runtime settings:

Timmy stores non-secret UI preferences in `timmy-ui-settings.json` under `TIMMY_HOME`. This includes the last selected execution target/mode, account lane, score threshold, plan limit, auto interval, trading style, and enabled patterns. Broker credentials remain in `.env` only.

Market adaptability:

`TRADING_STYLE` accepts `adaptive`, `aggressive`, `balanced`, or `conservative`. Aggressive reacts to smaller movement and volume shifts; conservative waits for stronger confirmation. `TRADING_PATTERNS` can include `breakout`, `momentum`, `pullback`, and `volume`; removing a pattern keeps matching setups watch-only instead of executable.

Do not put broker usernames, passwords, MFA codes, API keys, or tokens in chat.

## Local Demo

Run the native Linux app from source:

```bash
timmy-desktop
```

Build the Linux ELF:

```bash
scripts/build_elf.sh
```

The executable is created at:

```text
dist/Timmy/Timmy
```

The ELF does not bundle `.env`; keep `.env` next to the project so Webull credentials stay external.

If launching the ELF from outside the project folder, set `TIMMY_HOME` first:

```bash
TIMMY_HOME=/home/sniper-lion-main/trading-bots/trend-trader ./dist/Timmy/Timmy
```

For file-manager launching, use:

```text
Timmy.desktop
```

That launcher sets `TIMMY_HOME` and starts the native ELF. It does not open a browser.

Build an installable Debian package:

```bash
scripts/package_deb.sh
```

Install it locally:

```bash
sudo apt install ./dist/timmy-trader_0.1.0_amd64.deb
```

After install, launch **Timmy** from the system menu or run:

```bash
timmy-trader
```

Install the optional user service scaffold:

```bash
scripts/install_user_service.sh
```

Enable it only when you want Timmy to start with the user session:

```bash
systemctl --user enable --now timmy-trader.service
```

The installed app stores runtime config in:

```text
~/.config/timmy-trader
```

Timmy keeps one active native app instance per runtime home. A new launch checks the existing lock, scans for older native/source Timmy process forms, shuts them down, and opens a fresh instance.

On first installed launch, Timmy seeds `~/.config/timmy-trader/.env` from the packaged safe template only. It does not copy source-checkout secrets or Webull token files into the installed runtime.

The browser dashboard command remains available only as a development fallback:

```bash
timmy-dashboard
```

Generate synthetic bars:

```bash
timmy sample-data --out examples/sample_bars.csv
```

Create a watchlist:

```bash
timmy watchlist-init --out watchlist.txt
timmy watchlist-init --template crypto --out watchlist-crypto.txt
timmy watchlist-init --template commodity-etf --out watchlist-commodities.txt
timmy watchlist-init --template index-proxy --out watchlist-indexes.txt
timmy watchlist-init --template futures-watch --out watchlist-futures.txt
```

The native app uses `WATCHLIST_TEMPLATE` when it needs to create a missing watchlist file. Available templates are `equity`, `crypto`, `commodity-etf`, `index-proxy`, and `futures-watch`.

Dynamic watchlist rotation:

```text
ENABLE_WATCHLIST_ROTATION=1
WATCHLIST_UNIVERSE=all-us
WATCHLIST_UNIVERSE_BATCH_SIZE=250
WATCHLIST_UNIVERSE_REFRESH_HOURS=24
WATCHLIST_ROTATION_CANDIDATES=SPY,QQQ,IWM,DIA,AAPL,MSFT,NVDA,AMD,TSLA,META,GOOGL,AMZN,AVGO,NFLX,COST,JPM,XOM,UNH,LLY,ORCL,CRM,ADBE,INTC,MU,SMH,XLK,XLF,XLE,VTI
ACTIVE_WATCHLIST_PATH=active-watchlist.txt
MOVEMENT_WATCHLIST_PATH=movement-watchlist.txt
TRADE_READY_WATCHLIST_PATH=trade-ready-watchlist.txt
QUIET_WATCHLIST_PATH=quiet-watchlist.txt
WEBULL_SYNC_WATCHLISTS=1
WEBULL_ACTIVE_WATCHLIST_NAME=Timmy Active
WEBULL_MOVEMENT_WATCHLIST_NAME=Timmy Movement
WEBULL_TRADE_READY_WATCHLIST_NAME=Timmy Trade Ready
WEBULL_QUIET_WATCHLIST_NAME=Timmy Quiet Removed
MAX_WATCHLIST_SYMBOLS=12
MAX_MOVEMENT_WATCHLIST_SYMBOLS=50
MIN_WATCHLIST_SCOUT_SCORE=42
QUIET_WATCHLIST_SCOUT_SCORE=30
```

When enabled with a live market-data provider, Timmy fetches the current custom active list plus the candidate pool, scores every loaded symbol, keeps names showing movement, removes quiet low-ranked names, and writes the rotated active list to `ACTIVE_WATCHLIST_PATH`. Timmy then writes market data for that active custom list, and that is the list the strategy can trade from. `watchlist.txt` remains the seed list. Set `WATCHLIST_UNIVERSE=all-us` to refresh the current U.S. listed-symbol universe from Nasdaq Trader and scan it in rotating batches. The active list stays capped by `MAX_WATCHLIST_SYMBOLS`, while `WATCHLIST_UNIVERSE_BATCH_SIZE` controls how many new market symbols are inspected per refresh cycle. Any symbol that may become tradable must also be permitted by `WEBULL_SYMBOL_WHITELIST`; leaving that whitelist blank allows the rotated universe to create order plans when all other risk gates pass.

Generated watchlists are updated together on every rotation cycle:

- `active-watchlist.txt`: the custom list Timmy trades/scouts from.
- `movement-watchlist.txt`: symbols with enough activity to keep an eye on.
- `trade-ready-watchlist.txt`: active symbols whose strategy signal is eligible/trade before broker/risk submission checks.
- `quiet-watchlist.txt`: symbols removed from active rotation because movement fell below the quiet threshold.
- Matching `*-webull.txt` and `*-webull.csv` export files are written beside them for visibility or manual import workflows.

When `WEBULL_SYNC_WATCHLISTS=1`, Timmy also syncs those generated lists into Webull account-side watchlists through the Webull OpenAPI watchlist endpoints. It creates or updates the configured `Timmy ...` lists, adds symbols that Timmy is watching, and removes symbols that no longer belong in each generated list. Existing non-Timmy watchlists are left alone.

Fetch delayed daily bars into Timmy's CSV format:

```bash
timmy fetch-data --provider yahoo --watchlist watchlist.txt --out examples/sample_bars.csv --days 90
```

Yahoo data aliases keep broker-facing crypto symbols intact where possible. For example, Timmy can keep `BTCUSD` in its watchlist/order model while fetching Yahoo bars from `BTC-USD`.

Run a backtest:

```bash
timmy backtest --data examples/sample_bars.csv --hold-bars 10
```

Search local guidance:

```bash
timmy knowledge red flags
timmy knowledge reward risk
timmy readiness
```

Scan:

```bash
timmy scan --data examples/sample_bars.csv
```

Create order plans:

```bash
timmy plan --data examples/sample_bars.csv
```

Paper trade:

```bash
timmy paper-trade --data examples/sample_bars.csv
```

Run the dependency-free smoke test:

```bash
PYTHONPATH=. python3 scripts/smoke_test.py
```

Paper fills are written to:

```text
trade-journal.jsonl
```

Execution events are also written to:

```text
execution-events.jsonl
```

New execution events are signed into a local hash chain using:

```text
.timmy-audit-key
```

If execution records are edited, deleted, or reordered, the Event Log panel will show an audit warning.

Paper-trade training statistics are summarized at:

```text
paper-training-summary.json
```

That summary includes paper event counts, pending/closed outcomes, target-hit versus stopped counts, net paper P/L when available, and per-symbol totals. Paper entries include the scout score, sensible score, controls, and latest candle timestamp used when Timmy made the decision.

Local trading guidance lives in:

```text
knowledge/
```

Topics include risk controls, order handling, scouting, paper-to-live promotion, market hours, live automation, asset-class expansion, and red/green flags.

For day-to-day safe operation, use `docs/OPERATOR_CHECKLIST.md` before enabling Auto mode, switching from Paper to Live, previewing Webull orders, or expanding beyond equities.

Asset-class expansion guidance:

```bash
timmy knowledge asset class
timmy knowledge crypto
timmy knowledge forex
timmy knowledge unsupported
timmy asset-classes
```

Equities are the default class. Crypto can be enabled only after separate account permission, symbol mapping, sizing, session behavior, and Webull preview checks. Futures require explicit configured symbols and a futures-enabled account. Options require explicit option symbols plus `WEBULL_OPTION_LEGS_JSON` so Timmy can send the option-specific `legs` payload Webull expects. Event contracts remain scouting-only until a dedicated order builder is installed.

The native GUI mirrors this in the Decision Brief with a compact asset summary: enabled classes, configured non-equity symbols, and any disabled or scouting-only warnings. This is display-only and does not change broker execution routing.

## Webull Check

After adding approved Webull OpenAPI credentials:

```bash
timmy webull-check
```

This uses Webull's official OpenAPI SDK pattern to list accounts. It does not place orders.

For account/position/order snapshot probing:

```bash
timmy webull-sync
```

The snapshot command is guarded and redacted. It reports unsupported SDK endpoint shapes instead of crashing when the installed SDK exposes different method names.

Preview Timmy's eligible order plans through Webull before placing anything:

```bash
timmy webull-preview --data examples/sample_bars.csv
```

The preview call sends Webull a `new_orders` payload with `combo_type=NORMAL`, `market=US`, and an instrument type from the order plan. Equity orders include `support_trading_session=CORE` by default. Change `WEBULL_SUPPORT_TRADING_SESSION` to `ALL` only if you intentionally want extended-hours equity support.

Detailed setup is documented in `docs/WEBULL_SETUP.md`.

The implementation and hotfix trail is documented in `docs/HOTFIX_IMPLEMENTATION_LOG.md`.

## Safety Defaults

Live orders require all of these before the adapter will even attempt a submit path:

```text
TRADER_MODE=live
TRADER_LIVE=1
WEBULL_ENABLE_LIVE_ORDERS=1
WEBULL_REQUIRE_PREVIEW=0
WEBULL_ACCOUNT_ID=<approved account id>
```

The current Webull adapter still returns a `preview-required` payload while `WEBULL_REQUIRE_PREVIEW=1`. When `WEBULL_REQUIRE_PREVIEW=0`, the native GUI still requires the exact current plan to be previewed before a live submit path is allowed.

The native GUI also records a fingerprint of the last Webull previewed plan. If the plan changes after refresh, the configured account changes, or the preview is more than three minutes old, Live submit is blocked until the exact current plan is previewed again.

The native app has two execution modes:

- `User`: `Live` asks for confirmation before a submit attempt.
- `Auto`: `Run` can submit the ranked live plan automatically when live switches are enabled.

When `Auto` is selected, manual execution buttons are locked so an accidental click cannot preview, run, paper-trade, or submit live outside the automation path. `Stop` stays available and returns the app to `User` mode.

The native app also has an execution target toggle:

- `Paper`: decision cycles collect paper-trade data and update the training summary.
- `Live`: decision cycles use the guarded Webull live path only when live switches are enabled.

Operational defaults can be tightened or relaxed from `.env`:

```text
MIN_SCORE_TO_TRADE=72
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
REQUIRE_MARKET_HOURS=1
AUTO_START_PAPER_ON_MARKET_OPEN=1
AUTO_START_LIVE_ON_MARKET_OPEN=0
MARKET_OPEN_POLL_SECONDS=30
MARKET_DATA_PROVIDER=csv
MARKET_DATA_MAX_AGE_MINUTES=15
WATCHLIST_PATH=watchlist.txt
WATCHLIST_TEMPLATE=equity
ENABLE_CRYPTO_TRADING=0
ENABLE_FUTURES_TRADING=0
ENABLE_OPTIONS_TRADING=0
ENABLE_EVENT_CONTRACT_TRADING=0
WEBULL_CRYPTO_SYMBOLS=BTCUSD,ETHUSD
WEBULL_FUTURES_SYMBOLS=
WEBULL_OPTIONS_SYMBOLS=
WEBULL_EVENT_CONTRACT_SYMBOLS=
WEBULL_MAX_CRYPTO_ORDER_NOTIONAL_USD=100
WEBULL_MAX_FUTURES_CONTRACTS=1
WEBULL_MAX_OPTIONS_CONTRACTS=1
```

Broker defaults stay guarded: `WEBULL_SUPPORT_TRADING_SESSION=CORE` keeps equity previews in the regular session, `WEBULL_TOKEN_CHECK_SECONDS=30` with `WEBULL_TOKEN_CHECK_INTERVAL_SECONDS=3` keeps token approval polling short, and blank Webull credentials or account IDs disable broker-specific paths until configured locally.

Before preview, paper trade, or live submit, the native app refreshes the plan set and re-checks those gates so it does not act from a stale dashboard snapshot.

Refresh performance notes:

- Market data is loaded once per refresh cycle and reused by signal scoring, paper context, and paper outcome reconciliation.
- Execution journals are cached by file size and modification time, so repeated refreshes do not reparse unchanged logs.
- Market-open polling backs off when the next open is far away and checks more frequently close to open.

## Strategy Outline

The first strategy is a disciplined trend/pattern scanner:

- Price above 20/50 moving averages.
- 20-bar breakout detection.
- RSI confirmation without extreme extension.
- Volume confirmation versus recent average.
- Adaptive ATR-based pullback buy limit, stop, and sell target.
- Early-move scouting at `+/-2.5%` to catch bullish and bearish changes before they fall off the radar.
- Expense gate: RSI and moving-average extension flag overheated entries; available account cash can block entries that are too large for the account.
- Vigilance gate: single-bar movement, three-bar acceleration, gap movement, volume surge, range expansion, and recent-high/recent-low proximity determine whether a symbol is `alert`, `watch`, or `quiet`.
- Operational gate: regular-session timing, daily caps, per-symbol caps, cooldowns, rejection history, reward/risk, volatility, and cash fit must clear before a plan becomes executable.
- Sensible score: movement, trend, reward/risk, expense, cash fit, volatility, and recent event history determine the final action.
- Risk-based sizing capped by notional and max quantity.

The goal is to catch "this stock is changing some" setups faster than a human watchlist, inspect them with data, then trade only when the entry, stop, target, and sizing fit the risk controls.

## Sources Used

- Webull OpenAPI docs: `https://developer.webull.com/apis/docs/`
- Webull Trading API getting started: `https://developer.webull.com/apis/docs/trade-api/getting-started/`
- Webull SDK docs: `https://developer.webull.com/apis/docs/sdk/`
- Webull stock trading docs: `https://developer.webull.com/apis/docs/trade-api/stock/`
- Webull API security recommendations: `https://developer.webull.com/apis/docs/AI-friendly-Resources/skills/`
