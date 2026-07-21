# Timmy Webull Setup

Use this checklist to connect Timmy to Webull OpenAPI without putting credentials in chat. Use `docs/OPERATOR_CHECKLIST.md` as the day-to-day operating gate before Auto mode, Live mode, previews, or any crypto/futures expansion.

## 1. Webull Access

Create or confirm Webull OpenAPI access from Webull's developer portal. Timmy expects:

- `WEBULL_APP_KEY`
- `WEBULL_APP_SECRET`
- `WEBULL_ACCOUNT_ID`
- `WEBULL_REGION=us`
- `WEBULL_API_ENDPOINT=api.webull.com`
- `WEBULL_TOKEN_CHECK_SECONDS=30`
- `WEBULL_TOKEN_CHECK_INTERVAL_SECONDS=3`

Webull's official SDK handles signatures and token management from App Key and App Secret.

## 2. Local Environment

```bash
cd /home/sniper-lion-main/trading-bots/trend-trader
. .venv/bin/activate
cp .env.example .env
```

Edit `.env` locally. Do not paste broker usernames, passwords, MFA codes, App Secrets, or tokens into chat.

## 3. Account Check

```bash
timmy webull-check
```

This should return the accounts visible to your approved Webull OpenAPI app. If it fails, fix credentials or approval before trying order previews.

On the first successful credential check, Webull may create a `PENDING` token and wait for verification. Open the Webull mobile app, then check Menu -> Messages -> OpenAPI Notifications. Tap the latest verification message, choose Check Now, enter the SMS code, and confirm. Keep `timmy webull-check` running while you do this.

## 4. Scanner And Preview

```bash
timmy sample-data --out examples/sample_bars.csv
timmy scan --data examples/sample_bars.csv
timmy plan --data examples/sample_bars.csv
timmy webull-preview --data examples/sample_bars.csv
```

`webull-preview` sends Timmy's eligible order plan to Webull's preview endpoint. It does not place an order.

## 5. Live Trading Gate

Live placement stays disabled unless all of these are set:

```text
TRADER_MODE=live
TRADER_LIVE=1
WEBULL_ENABLE_LIVE_ORDERS=1
WEBULL_REQUIRE_PREVIEW=0
WEBULL_ACCOUNT_ID=<approved account id>
```

Keep `WEBULL_REQUIRE_PREVIEW=1` until account check and preview responses are clean. Use small risk limits first:

```text
WEBULL_MAX_ORDER_NOTIONAL_USD=25
WEBULL_MAX_ORDER_QUANTITY=1
RISK_PER_TRADE_USD=5
MAX_POSITIONS=1
```

## 6. Current Safety Defaults

- Timmy enables stock/ETF `EQUITY` orders for the US market by default.
- Crypto and futures order routing fields exist, but those classes stay disabled unless their explicit `.env` switches are enabled.
- Timmy uses quantity-based limit orders by default.
- Timmy limits symbols through `WEBULL_SYMBOL_WHITELIST`.
- Timmy caps order size by notional, quantity, and risk per trade.
- Timmy caps entry size against available account cash with `MAX_ENTRY_CASH_PCT=20` by default.
- Timmy uses `CORE` regular market session unless `WEBULL_SUPPORT_TRADING_SESSION` is changed.

## 7. Broker Validation Before Live Crypto Or Futures

Do not enable `ENABLE_CRYPTO_TRADING=1` or `ENABLE_FUTURES_TRADING=1` for live orders until the exact account and instrument path has been validated with Webull. The local adapter can carry `instrument_type`, `market`, `time_in_force`, `entrust_type`, session, quantity, and limit fields into `new_orders`, but it does not prove that a given account can trade a given crypto pair or futures contract.

Validate and record all of the following first:

- Account class: `timmy webull-check` must show the approved account class needed for the asset, such as a separate crypto account or futures-enabled margin account.
- Instrument endpoint: confirm the Webull instrument lookup endpoint returns the intended symbol, contract, market, tradability, tick size, and status.
- Preview response: run `timmy webull-preview` against a tiny whitelisted order and confirm the response accepts the payload shape, reports expected buying-power or margin impact, and returns no account-class or instrument errors.
- Order type and TIF support: confirm the asset supports Timmy's intended `LIMIT`, `DAY`, and `QTY` values before using other order types or `GTC`/`IOC`.
- Minimum and maximum trade amount: confirm broker limits for per-order notional, pending buys, futures contract count, and any remaining-position minimums.
- Precision: confirm quantity precision, price tick size, rounding rules, and whether fractional quantities are allowed for that instrument.
- Fees and spreads: confirm commissions, exchange or regulatory fees, crypto spread/markup, and realistic bid/ask width before relying on reward/risk output.
- Market data entitlement: confirm Timmy can read fresh Webull market data for the exact asset class; futures data may require a paid subscription, while crypto still needs a working asset-specific data endpoint.

## Sources

- Webull OpenAPI docs: `https://developer.webull.com/apis/docs/`
- Webull Trading API getting started: `https://developer.webull.com/apis/docs/trade-api/getting-started/`
- Webull SDK docs: `https://developer.webull.com/apis/docs/sdk/`
- Webull stock trading docs: `https://developer.webull.com/apis/docs/trade-api/stock/`
- Webull futures trading docs: `https://developer.webull.com/apis/docs/trade-api/futures/`
- Webull crypto trading docs: `https://developer.webull.com/apis/docs/trade-api/crypto/`
