# Automation and Order Safety Review

## Local behavior changes

- Decision cycles use a shared in-process guard, so a scheduled or market-open callback cannot start a second cycle while another cycle is running.
- A market-open callback waits briefly when a refresh/action is active and rechecks that the regular session is still open before starting.
- **Pause All Automation** cancels both the interval callback and any pending market-open callback for this app session. Starting the app again still follows the existing saved market-open preferences.
- The Automation panel reports a running cycle, the next local Eastern-time due time, market-open arming, or paused state instead of only saying “Every N min.”
- Paper automation has one enable control: the shared Paper Lane checkbox. One shared Pause All Automation action appears with the execution controls in both Execution and Automation; duplicate enable/pause buttons were removed from the Automation detail panel.
- It also keeps the last run time, duration, concise result, and any retry/hold reason visible for the current session.
- Decision-cycle market refresh, CSV loading, and signal ranking now run in a background worker and return an immutable snapshot for Tk to apply. Live Auto preview, durable intent, submit, and journal work run in a separate broker worker; UI state is updated through `root.after`. A single-cycle guard remains active across both workers. Changing the target/mode, editing profile or risk settings, or choosing Pause All cancels further steps. A broker call already in progress cannot be recalled.
- Tk still applies the prepared snapshot, renders widgets, and runs the short local Paper/Simulation journal lanes on the UI thread. Those steps can still cause brief pauses on unusually large local datasets; no full GUI responsiveness benchmark was run for this change.
- Each automated Live batch now reads a fresh Webull open-order and position snapshot before previewing entries. A missing, malformed, or unsuccessful snapshot blocks the batch; existing or ambiguous orders and nonzero positions block new entries for the same symbol. This is read-only duplicate/exposure protection. It does not automatically cancel or replace stale orders, reconcile fill quantities, or create exit orders.
- Before an automated Live exact preview, the equity/ETF candidate also passes `evaluate_automation_order` using fresh account equity/cash/daily P&L, positions, priced pending BUYs, current-session state, candle quality, cooldown, configured exposure percentages, and Timmy's private per-account equity high-water mark. Risk sizing can reduce the plan quantity. A missing/ambiguous required field blocks before preview with the relevant reason. `AUTO_MAX_SYMBOL_EXPOSURE_PCT`, `AUTO_MAX_TOTAL_EXPOSURE_PCT`, and `AUTO_MAX_DRAWDOWN_PCT` default to 0/unset; set each to a value in `(0, 100]` in `.timmy-profile.env` before Live Auto can run. The high-water baseline begins with Timmy's first verified account snapshot, not an all-time account high.
- The Automation workspace shows descriptive Paper and Simulation closed-outcome metrics and signal cohorts. Fill rate and slippage remain unavailable unless the journal has explicit fill/slippage fields; the daily-candle Simulation model is not presented as a real fill record. No recommendation changes strategy or Live settings.
- Scheduled Paper, Simulation, and Live Auto lanes skip a symbol already attempted for the same latest daily candle, preventing repeated entries from unchanged plans after cooldown expires. Live Auto dedupe counts signed scheduled `buy-order` outcomes; a `preview-required` no-submit result does not consume the candle, while unresolved intents are held by the Live safety guard. Manual submissions remain available and are not deduplicated by this automation guard.
- Automated lanes now source plans only from the saved movement-discovery cache. Discovery needs at least a 1.1% absolute daily move; an automatic entry candidate additionally needs at least a 2.2% bullish move, scout alert (72+), an eligible strategy decision, an executable plan, and all existing whitelist/account/risk/preview gates. The discovery watchlist is separate from the active trade list. The broad scanner uses 90 daily bars so symbols meet the strategy's 55-bar minimum; movement scores do not bypass Live order controls.
- An unknown Live outcome halts Live Auto and cancels a pending market-open Live callback. Timmy writes a signed Live automation hold; on restart, that hold remains until unresolved orders are reconciled and the operator explicitly switches back to Auto. An enabled Paper lane may continue on its own schedule while Live is held.
- Paper, Simulation, and Live use one visible target selector and one target-aware Preview/Submit pair. Paper behavior remains on its original journal. Simulation uses local-only preview/submission and a separate journal; Live alone constructs the Webull adapter.
- Previewed and submitted orders carry the same `client_order_id`; the ID uses the UUID hex form shown in Webull's current Python example. A broker result classified as unknown stops the rest of that submission batch.
- Simulation uses the current strategy plans. Later daily OHLC observations record target/stop threshold results, with stop-first when both appear in the same candle. Simulation events stay out of Paper performance and Live's daily loss/rejection/cooldown counters.

Pausing prevents future scheduled callbacks. It cannot undo a broker request that has already begun. Closing the app cancels Tk callbacks; the process lock is released when the process exits. No unattended background service is added.

## Responsive control layout

The execution control bar reflows to a full-width Run Cycle row followed by side-by-side Preview/Submit buttons below 1120 px. Below 1120 px, the Paper/Simulation/Live target radios stack vertically so the full labels fit in the six-column controls grid. The Automation workspace stacks readiness and workflow panels below 1040 px and changes its five status cards to a 3-column grid below 900 px. The native window minimum is 1024 x 600 so the fixed navigation rail and six-column risk controls retain enough horizontal space. Existing content-canvas scrolling carries panels taller than the viewport. Buttons and target radios use Tk keyboard focus traversal/highlight.

Mapped Tk windows were inspected under Xvfb at 1280, 1120, and 1024 px. At all three widths, the Execution controls fit within the content viewport and remained mapped; at 1024 px, Run Cycle spans its own row and Preview/Submit share the next row. Automation readiness and workflow panels also stack at the compact width. The probe exposed an unreachable workspace-rendering block after the alert-preference helper's return; it was restored to `_show_tab`, making workspace navigation render its panels again. The native desktop theme and monitor scaling still merit an operator glance.

## Order path review

1. Live Auto rebuilds the current US equity/ETF plan, rechecks the signal and operational gates, then requests an exact Webull preview immediately before each order. The preview and placement share the same adapter instance and normalized payload/client ID; the response is not assumed to echo that ID.
2. Placement requires a successful preview receipt matching the exact payload, a documented estimated preview cost within Timmy's configured cap, enabled live switches, a completed Account Check, and the saved Live Auto opt-in. A missing, malformed, stale, or over-cap preview stops before the intent or placement call.
3. Timmy durably journals a `pending-submit` intent with the client ID before calling the broker. A failure known to occur before the placement call is journaled as retryable on a later Auto cycle. A lost response or uncertain 5xx result is recorded as unknown; no client-side retry is attempted. The automatic Live lane pauses and requires terminal reconciliation plus explicit re-arm.
4. Unknown outcomes block future plans for that symbol. The operator must check Webull and record a terminal resolution through **Review unknown orders** before that symbol can pass the local guard again. The UI does not currently query Order Detail automatically.

## Webull contract evidence and limits

- **Documented:** Webull's current Getting Started Python example uses `order_v3.place_order` and a `uuid.uuid4().hex` client ID. The official SDK repository also shows v3 preview, placement, and order detail calls.
- **Documented:** the Preview endpoint supports simple orders and explicitly does not support crypto. A missing/failed preview leaves Timmy's local preview gate closed, so the live submit path stops before placement.
- **Documented:** Webull says open-order and history views may lag and recommends querying Order Detail by `client_order_id` for the latest status.
- **Implemented compatibility:** the adapter prefers `order_v3` when the installed client exposes it and falls back to `order_v2` for older SDK clients. The project still declares `webull-openapi-python-sdk>=2.0.14`; compatibility with every lower-bound release has not been verified here.
- **Preview gate detail:** HTTP 2xx alone is not enough. Timmy also requires a client order ID in its request payload and fails closed on explicit body-level false/error/reject/invalid/unsupported fields and nonzero result codes. Webull's published preview documentation does not define a complete response schema in the inspected reference, so other provider-specific failure encodings remain an integration limitation.
- `WEBULL_REQUIRE_PREVIEW=1` is the safe setting. A successful exact preview receipt allows the same payload to proceed; Timmy always enforces preview even if a legacy environment file says `0`.
- The raw `submit_order` adapter method fails closed. Live flows use the explicit preview-receipt method so a successful preview is neither bypassed nor accidentally treated as a block.
- **Not asserted:** this source review did not call a Webull account, preview endpoint, order endpoint, or place an order. Whether a specific order type/account combination accepts preview remains an account-side integration question.

The current adapter's live and preview request shapes use Webull's documented common `new_orders` fields. Live Auto remains focused on US equities/ETFs; other supported products stay in the secondary manually confirmed workflow until their automated planning and lifecycle guards are implemented.

## Sources

- [Webull Trading API Getting Started](https://developer.webull.com/apis/docs/trade-api/getting-started/)
- [Webull Preview Order](https://developer.webull.com/apis/docs/reference/common-order-preview/)
- [Webull Orders reference](https://developer.webull.com/apis/docs/reference/broker-fd-api/orders/)
- [Webull Get Order Detail](https://developer.webull.com/apis/docs/reference/broker-fd-api/order-detail/)
- [Official Webull Python SDK sample](https://github.com/webull-inc/webull-openapi-python-sdk/blob/main/samples/trade/trade_client_v3.py)
