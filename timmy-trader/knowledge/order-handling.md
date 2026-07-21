# Order Handling

Use guarded order flow.

- Prefer limit entries for buy-low plans.
- Preview broker payloads before live order placement.
- Use stop and target values in every plan, even when the broker API needs separate exit handling.
- Avoid market orders during high volatility, thin volume, open gaps, or uncertain data.
- Do not submit duplicate orders for the same symbol while an order is pending or cooldown is active.
- If network or broker status is uncertain, refresh account/order state before submitting.
- Do not send non-equity assets through an equity payload. The broker preview must confirm the correct instrument type, market, quantity precision, and order constraints.
- Use direct indexes only as data/context symbols; create live plans only for tradable proxies such as liquid ETFs.
- Keep crypto, forex, futures, CFDs, options, and other unsupported instruments blocked until their own adapter can preview and place the correct order form.
- Re-check fees, spread, minimum size, tick size, and session support before promoting any new asset class from paper to live.
