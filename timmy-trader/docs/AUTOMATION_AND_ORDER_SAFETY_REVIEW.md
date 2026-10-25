# Automation and Order Safety Review

## Local behavior changes

- Decision cycles use a shared in-process guard, so a scheduled or market-open callback cannot start a second cycle while another cycle is running.
- A market-open callback waits briefly when a refresh/action is active and rechecks that the regular session is still open before starting.
- **Pause All Automation** cancels both the interval callback and any pending market-open callback for this app session. Starting the app again still follows the existing saved market-open preferences.
- The Automation panel reports a running cycle, the next local Eastern-time due time, market-open arming, or paused state instead of only saying “Every N min.”
- Paper automation has one enable control: the shared Paper Lane checkbox. One shared Pause All Automation action appears with the execution controls in both Execution and Automation; duplicate enable/pause buttons were removed from the Automation detail panel.
- It also keeps the last run time, duration, concise result, and any retry/hold reason visible for the current session.
- Scheduled Paper, Simulation, and Live Auto lanes skip a symbol already attempted for the same latest daily candle, preventing repeated entries from unchanged plans after cooldown expires. Live attempts carry a signed scheduled marker and candle timestamp in the event log. Manual submissions remain available and are not deduplicated by this automation guard.
- An unknown Live outcome halts Live Auto and cancels a pending market-open Live callback. Timmy writes a signed Live automation hold; on restart, that hold remains until unresolved orders are reconciled and the operator explicitly switches back to Auto. An enabled Paper lane may continue on its own schedule while Live is held.
- Paper, Simulation, and Live use one visible target selector and one target-aware Preview/Submit pair. Paper behavior remains on its original journal. Simulation uses local-only preview/submission and a separate journal; Live alone constructs the Webull adapter.
- Previewed and submitted orders carry the same `client_order_id`; the ID uses the UUID hex form shown in Webull's current Python example. A broker result classified as unknown stops the rest of that submission batch.
- Simulation uses the current strategy plans. Later daily OHLC observations record target/stop threshold results, with stop-first when both appear in the same candle. Simulation events stay out of Paper performance and Live's daily loss/rejection/cooldown counters.

Pausing prevents future scheduled callbacks. It cannot undo a broker request that has already begun. Closing the app cancels Tk callbacks; the process lock is released when the process exits. No unattended background service is added.

## Responsive control layout

The execution control bar reflows to a full-width Run Cycle row followed by side-by-side Preview/Submit buttons below 1120 px. Below 1120 px, the Paper/Simulation/Live target radios stack vertically so the full labels fit in the six-column controls grid. The Automation workspace stacks readiness and workflow panels below 1040 px and changes its five status cards to a 3-column grid below 900 px. The native window minimum is 1024 x 600 so the fixed navigation rail and six-column risk controls retain enough horizontal space. Existing content-canvas scrolling carries panels taller than the viewport. Buttons and target radios use Tk keyboard focus traversal/highlight.

Mapped Tk windows were inspected under Xvfb at 1280, 1120, and 1024 px. At all three widths, the Execution controls fit within the content viewport and remained mapped; at 1024 px, Run Cycle spans its own row and Preview/Submit share the next row. Automation readiness and workflow panels also stack at the compact width. The probe exposed an unreachable workspace-rendering block after the alert-preference helper's return; it was restored to `_show_tab`, making workspace navigation render its panels again. The native desktop theme and monitor scaling still merit an operator glance.

## Order path review

1. Timmy builds the current plans, previews each plan, and stores a fingerprint of the full plan plus latest candle timestamp, account ID, preview time, and the client order ID present in Timmy's preview request payload. The response is not assumed to echo this ID.
2. Submission recomputes that fingerprint and requires a matching unexpired preview for the same account. Existing settings and live guards are checked again before the broker call.
3. Timmy durably journals a `pending-submit` intent with the client ID before calling the broker. A lost response or uncertain 5xx result is recorded as unknown; no client-side retry is attempted. The automatic Live lane pauses and requires an explicit re-arm after terminal reconciliation.
4. Unknown outcomes block future plans for that symbol. The operator must check Webull and record a terminal resolution through **Review unknown orders** before that symbol can pass the local guard again. The UI does not currently query Order Detail automatically.

## Webull contract evidence and limits

- **Documented:** Webull's current Getting Started Python example uses `order_v3.place_order` and a `uuid.uuid4().hex` client ID. The official SDK repository also shows v3 preview, placement, and order detail calls.
- **Documented:** the Preview endpoint supports simple orders and explicitly does not support crypto. A missing/failed preview leaves Timmy's local preview gate closed, so the live submit path stops before placement.
- **Documented:** Webull says open-order and history views may lag and recommends querying Order Detail by `client_order_id` for the latest status.
- **Implemented compatibility:** the adapter prefers `order_v3` when the installed client exposes it and falls back to `order_v2` for older SDK clients. The project still declares `webull-openapi-python-sdk>=2.0.14`; compatibility with every lower-bound release has not been verified here.
- **Preview gate detail:** HTTP 2xx alone is not enough. Timmy also requires a client order ID in its request payload and fails closed on explicit body-level false/error/reject/invalid/unsupported fields and nonzero result codes. Webull's published preview documentation does not define a complete response schema in the inspected reference, so other provider-specific failure encodings remain an integration limitation.
- `WEBULL_REQUIRE_PREVIEW=1` intentionally blocks `place_order` even after a preview response. The setting must be deliberately changed to `0` after account-side validation; the desktop does not silently change it.
- A `preview-required` response carries the attempted client ID into the result journal as a known no-submit terminal result, so it clears the prewritten intent without treating it as an unknown broker outcome.
- **Not asserted:** this source review did not call a Webull account, preview endpoint, order endpoint, or place an order. Whether a specific order type/account combination accepts preview remains an account-side integration question.

The current adapter's live and preview request shapes use Webull's documented common `new_orders` fields. This review did not alter strategy or risk calculations, live switches, account controls, or market-hours configuration.

## Sources

- [Webull Trading API Getting Started](https://developer.webull.com/apis/docs/trade-api/getting-started/)
- [Webull Preview Order](https://developer.webull.com/apis/docs/reference/common-order-preview/)
- [Webull Orders reference](https://developer.webull.com/apis/docs/reference/broker-fd-api/orders/)
- [Webull Get Order Detail](https://developer.webull.com/apis/docs/reference/broker-fd-api/order-detail/)
- [Official Webull Python SDK sample](https://github.com/webull-inc/webull-openapi-python-sdk/blob/main/samples/trade/trade_client_v3.py)
