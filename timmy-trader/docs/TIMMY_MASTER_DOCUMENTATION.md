# Timmy Master Documentation

Timmy is a native Linux trading assistant that scouts market movement, ranks setups, builds guarded order plans, supports paper trading, and can connect to Webull OpenAPI for account checks, order preview, and gated live order submission.

Timmy is not a profit guarantee and does not predict the future. It makes decisions from prior and current market data, then applies risk, account, market-session, and broker gates before an order can become actionable.

## Project Location

```text
/home/sniper-lion-main/trading-bots/trend-trader
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

The desktop launch path is:

```text
/home/sniper-lion-main/trading-bots/trend-trader/scripts/launch_timmy.sh
```

The launcher sets:

```text
TIMMY_HOME=/home/sniper-lion-main/trading-bots/trend-trader
TIMMY_THEME=dark
```

The browser dashboard remains only a development fallback. The main operating surface is the native GUI.

## Launching

From terminal:

```bash
cd /home/sniper-lion-main/trading-bots/trend-trader
./scripts/launch_timmy.sh
```

Direct ELF launch:

```bash
cd /home/sniper-lion-main/trading-bots/trend-trader
TIMMY_HOME=/home/sniper-lion-main/trading-bots/trend-trader ./dist/Timmy/Timmy
```

Build the ELF:

```bash
cd /home/sniper-lion-main/trading-bots/trend-trader
./scripts/build_elf.sh
```

Build the Debian package:

```bash
./scripts/package_deb.sh
```

## Single-Instance Rule

Timmy is designed to run as one active instance per runtime home.

On launch, Timmy:

- Checks the runtime lock.
- Finds older Timmy process forms.
- Sends shutdown signals to the existing instance.
- Force-closes stubborn prior instances.
- Claims the lock before starting the new GUI.
- Refuses to continue if it cannot safely claim the lock.

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
MARKET_DATA_PROVIDER=csv
WATCHLIST_PATH=watchlist.txt
WATCHLIST_TEMPLATE=equity
MARKET_DATA_MAX_AGE_MINUTES=15
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
