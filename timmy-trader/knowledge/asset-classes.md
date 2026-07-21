# Asset Class Expansion

Timmy can analyze OHLCV-style bars for more than common stocks, but live execution should stay restricted to asset classes that the broker adapter, account permissions, data source, and risk controls all understand. Treat every non-stock asset class as paper-only until it has a verified symbol format, trading session model, order type, fee model, and liquidity check.

## Safety Defaults

- Keep unsupported or newly added asset classes in scouting, backtest, and paper mode first.
- Require an explicit approved universe for each asset class instead of mixing all symbols into one watchlist.
- Use smaller notional caps for assets with 24-hour trading, wider spreads, leverage, contract multipliers, or weekend gaps.
- Disable live orders when the instrument cannot be previewed by the broker adapter with the correct instrument type.
- Prefer skipped trades when quote freshness, session status, minimum size, tick size, or fee treatment is unclear.
- Do not infer live support from chart availability. A broker may show data for an asset it cannot trade through the same API.

## Stocks And ETFs

Current baseline:

- Best-supported path in Timmy today.
- US regular-session assumptions are built around NYSE-style hours.
- Webull preview examples currently use `instrument_type=EQUITY`, `market=US`, and `support_trading_session=CORE`.
- Risk controls expect long buy-low/sell-high limit plans unless short logic is explicitly added.

Green flags:

- Listed common stock or ETF with normal volume and tight spreads.
- Session calendar, quote timestamp, and candle timestamp agree.
- Broker account has permission to trade the instrument.
- Shares, tick size, and order preview match the planned quantity and limit.

Red flags:

- Halted security, delisting notice, corporate action, reverse split, or symbol migration.
- Leveraged/inverse ETF treated like a plain index proxy.
- Pre-market or after-hours move used while extended-hours execution is disabled.
- Thin ETF volume, wide bid/ask spread, or stale indicative value.

## Crypto

Crypto trades continuously and can move hard while stock-market guards say "closed." Do not reuse equity market-hour assumptions for crypto without an explicit crypto session model.

Green flags:

- Spot crypto pair is supported by the broker/API, not just visible in the app.
- The quote currency, minimum order size, precision, and fees are known.
- Data source uses the same pair convention as the broker, such as `BTC-USD` versus `BTCUSD`.
- Liquidity is deep enough at the planned order size, including weekends and overnight.
- Paper results include weekend and high-volatility samples.

Red flags:

- Weekend liquidity drop, exchange outage, custody restriction, or transfer freeze.
- Wide spread relative to target/stop distance.
- Funding, staking, lending, margin, or perpetual futures exposure confused with spot.
- Symbol exists in market data but broker account only supports crypto cash separately from equities.
- Stop/target logic assumes exchange protections that the broker does not provide for crypto.

Safety default:

- Crypto should remain paper-only until Timmy has asset-class-specific sessions, precision, fee handling, and broker preview support for crypto orders.

## Commodity And Raw-Material Exposure

Commodity exposure can mean ETFs, stocks tied to producers, spot commodities, futures, or contracts for difference. Timmy should prefer ETFs or listed equities for commodity themes unless a dedicated futures/commodity adapter exists.

Green flags:

- Exposure is through a liquid ETF, ETN, or equity that the stock broker can preview as an equity order.
- The operator understands whether the product tracks spot, futures, miners, shipping, storage, or roll yield.
- Volume, spread, and expense/decay behavior are acceptable for the holding period.
- Commodity calendar risk is known, such as inventory reports, OPEC decisions, crop reports, contract roll dates, or holiday-thinned sessions.

Red flags:

- Futures contract, option on futures, leveraged commodity ETP, or CFD mixed into an equity watchlist.
- Front-month futures roll or delivery risk ignored.
- Geopolitical or weather move creates a gap beyond the stop model.
- Product has low assets, wide spreads, high decay, or path-dependent leverage.

Safety default:

- Allow commodity ETFs/equities only if they clear normal equity gates. Keep direct futures, spot commodities, CFDs, and leveraged commodity products unsupported unless a separate adapter and risk model are added.

## Forex And Currencies

Forex is not an equity market. It usually trades nearly 24 hours a day during the work week, uses pairs, pips, lot sizes, rollover, and often leverage. Timmy should not send forex orders through an equity adapter.

Green flags:

- Currency exposure is through a liquid ETF that the current equity path can preview, or through a dedicated forex broker adapter in paper mode.
- Pair convention, quote currency, pip value, lot size, margin, rollover, and session breaks are understood.
- Spread is tight enough for the target/stop model during the intended session.
- News calendar risk is checked for central-bank decisions, inflation reports, jobs data, and surprise interventions.

Red flags:

- Leveraged spot FX, CFD, or margin trading treated like buying one share.
- Trading into illiquid handoff windows, weekend gaps, or major scheduled news.
- Stop size ignores pip value, leverage, or account currency conversion.
- Broker account lacks FX permissions or API support.

Safety default:

- Keep forex unsupported for live execution unless Timmy has a dedicated forex adapter, pair-aware sizing, pip/tick math, rollover handling, and a 24/5 session model.

## Indexes And Index Proxies

Indexes themselves are usually not directly tradable. Timmy should distinguish between an index data symbol and a tradable proxy.

Green flags:

- The watchlist uses tradable proxies such as liquid ETFs for index exposure.
- Index symbols are used only as context signals, benchmarks, or filters.
- Broker preview confirms the proxy instrument, quantity, and order constraints.
- Proxy liquidity supports the planned entry, target, and stop distance.

Red flags:

- Direct index symbols like `SPX`, `NDX`, `DJI`, or `VIX` create live order plans.
- Index futures, options, or volatility products are treated as ordinary ETFs.
- Proxy tracking error, leverage, inverse exposure, or volatility decay is ignored.

Safety default:

- Permit liquid ETF proxies through the equity path. Keep direct indexes as data-only and block live plans for non-tradable index symbols.

## Unsupported Instruments

Unsupported means no live order plan should be created until support is deliberately built and tested.

Default unsupported list:

- Options.
- Futures and futures options.
- CFDs.
- Bonds and fixed income that require quote/yield-specific handling.
- Mutual funds.
- Warrants, rights, preferred shares, units, and complex corporate-action instruments.
- Leveraged margin products, perpetual swaps, and structured notes.
- Direct indexes and volatility indexes.

Block or manual-review triggers:

- No broker preview path for the exact instrument type.
- Unknown tick size, minimum quantity, multiplier, fee, margin, borrow, settlement, or expiration behavior.
- Missing live quote, stale candle, or mismatched symbol mapping.
- Live account permissions do not explicitly include the asset class.
- The stop/target model cannot express the instrument's real risk.

## Liquidity And Hours Differences

- Stocks and ETFs: Regular US session is usually 9:30 a.m. to 4:00 p.m. Eastern, with exchange holidays and early closes. Extended-hours trading has thinner books and should stay disabled unless tested.
- Crypto: Usually 24/7, but broker maintenance, exchange outages, weekend liquidity, and sudden spreads matter. Equity market-closed logic is not enough.
- Forex: Usually 24/5 with weekend gaps and session handoffs. Liquidity varies across Asia, London, and New York sessions.
- Commodity ETFs/equities: Follow equity hours, but the underlying commodity or futures market may move outside those hours.
- Futures/CFDs: Often have nearly continuous sessions, contract expirations, margin, and roll mechanics. Keep unsupported without dedicated handling.

## Broker Support Caveats

- A broker can expose separate accounts for equities, crypto, futures, or events. Account selection must match the intended asset.
- Market data, account visibility, preview, and order placement can have different API permissions.
- Symbol formats are broker-specific. Confirm symbol mapping before relying on paper results.
- Order type availability can differ by asset. Stops, bracket orders, fractional sizes, and extended-hours support may not exist everywhere.
- Fees, commissions, spreads, borrow, funding, rollover, and taxes can change the real risk/reward.

## Watchlist Hygiene

- Keep separate watchlists by asset class, such as `watchlist-equity.txt`, `watchlist-crypto.txt`, and `watchlist-fx.txt`, when expanding.
- Add an asset-class label to data ingestion before mixing symbols in scoring output.
- Never let an unsupported symbol silently fall through as an equity.
- Review top-ranked signals for symbol mapping mistakes before promoting paper automation.

## Promotion Checklist

Before any new asset class moves beyond paper:

- Broker API can check account permissions for that asset class.
- Broker API can preview the exact order payload without placing it.
- Timmy understands session hours and quote freshness for that asset.
- Sizing accounts for quantity precision, contract multiplier, leverage, fees, and minimum order size.
- Stops and targets reflect realistic spreads and gap behavior.
- Backtests and paper trades cover multiple sessions and volatility regimes.
- Live defaults remain off until an operator deliberately enables the new asset path.
