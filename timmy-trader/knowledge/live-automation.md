# Live Automation

Live automation must be more restrictive than paper automation.

- Live mode requires explicit environment switches and account configuration.
- Auto live mode should refresh market data, account state, open orders, and positions before submitting.
- Live mode should not rely on stale dashboard plans.
- If the broker preview or sync call fails, block submission.
- If account cash, current holdings, order count, or open orders are unknown, block submission.
- Log every live attempt, block, preview, submit response, and failure.
