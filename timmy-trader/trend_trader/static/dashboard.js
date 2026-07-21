const $ = (selector) => document.querySelector(selector);

const state = {
  signals: [],
  plans: [],
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }
  return data;
}

function money(value) {
  return Number(value || 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => node.classList.remove("show"), 3200);
}

function setBrokerState(label, stateName = "idle") {
  const badge = $("#brokerBadge");
  badge.textContent = label;
  badge.className = `status-pill ${stateName}`;
}

async function loadStatus() {
  const status = await api("/api/status");
  const config = status.config;
  $("#mode").textContent = config.trader_live ? `${config.trader_mode} live` : config.trader_mode;
  $("#account").textContent = config.webull_account_configured ? "Configured" : "Missing";
  $("#notional").textContent = money(config.max_order_notional_usd);
  $("#risk").textContent = money(config.risk_per_trade_usd);
  $("#runtimeStatus").textContent = status.data_ready ? "Ready" : "Preparing";
  $("#dataPath").textContent = status.data_ready ? "Data loaded" : "Sample data will be created";
  $("#liveGuard").textContent = config.webull_live_orders ? "Live switch on" : "Live locked";
  $("#previewRule").textContent = config.webull_require_preview ? "Preview required" : "Preview bypassed";
  $("#maxQty").textContent = `Max qty ${config.max_order_quantity}`;
  $("#positions").textContent = `${config.max_positions} max positions`;
}

async function loadSignals() {
  const data = await api("/api/scan");
  state.signals = data.signals;
  $("#signalsBody").innerHTML = state.signals.length
    ? state.signals.map(signalTemplate).join("")
    : `<p class="empty">No scan results yet.</p>`;
}

function signalTemplate(signal) {
  const decisionClass = signal.decision === "watch" ? "watch" : "";
  return `
    <article class="signal-row">
      <div class="symbol">
        <strong>${signal.symbol}</strong>
        <span>${signal.setup}</span>
      </div>
      <div class="score">
        <span>Score ${signal.score}</span>
        <div class="score-line" style="--score: ${signal.score}%"><i></i></div>
      </div>
      <span class="badge ${decisionClass}">${signal.decision}</span>
      <div class="price-stack">
        <span>Close</span>
        <strong>${money(signal.close)}</strong>
      </div>
      <div class="price-stack">
        <span>Stop / Target</span>
        <strong>${money(signal.stop)} / ${money(signal.target)}</strong>
      </div>
    </article>
  `;
}

async function loadPlans() {
  const data = await api("/api/plans");
  state.plans = data.plans;
  $("#plans").innerHTML = state.plans.length
    ? state.plans.map(planTemplate).join("")
    : `<p class="empty">No eligible plans at current risk settings.</p>`;
}

function planTemplate(plan) {
  return `
    <article class="plan">
      <div class="plan-title">
        <strong>${plan.side} ${plan.quantity} ${plan.symbol}</strong>
        <span class="status-pill good">${plan.order_type}</span>
      </div>
      <div class="plan-grid">
        <div><span>Limit</span><strong>${money(plan.limit_price)}</strong></div>
        <div><span>Notional</span><strong>${money(plan.notional)}</strong></div>
        <div><span>Stop</span><strong>${money(plan.stop_price)}</strong></div>
        <div><span>Target</span><strong>${money(plan.target_price)}</strong></div>
      </div>
      <p class="plan-meta">${plan.reason}</p>
    </article>
  `;
}

async function loadJournal() {
  const data = await api("/api/journal");
  $("#journalList").innerHTML = data.events.length
    ? data.events.slice().reverse().map(eventTemplate).join("")
    : `<p class="empty">No paper trades recorded.</p>`;
}

function eventTemplate(event) {
  return `
    <article class="event">
      <strong>${event.status} · ${event.order?.symbol || "Order"}</strong>
      <div class="muted">${event.submitted_at || ""}</div>
      <div class="muted">${event.order?.side || ""} ${event.order?.quantity || ""} @ ${money(event.order?.limit_price)}</div>
    </article>
  `;
}

function renderPreviewSummary(result) {
  const body = result?.body || {};
  $("#previewSummary").innerHTML = `
    <div><small>Status</small><strong>${result?.status_code || "-"}</strong></div>
    <div><small>Est. Cost</small><strong>${money(body.estimated_cost)}</strong></div>
    <div><small>Fee</small><strong>${money(body.estimated_transaction_fee)}</strong></div>
  `;
}

async function refreshAll() {
  await Promise.all([loadStatus(), loadSignals(), loadPlans(), loadJournal()]);
}

async function runAction(label, callback) {
  try {
    toast(`${label} running...`);
    await callback();
    toast(`${label} complete.`);
  } catch (error) {
    setBrokerState("Error", "bad");
    toast(error.message);
  }
}

$("#refreshBtn").addEventListener("click", () => runAction("Refresh", refreshAll));

$("#sampleBtn").addEventListener("click", () =>
  runAction("Data refresh", async () => {
    await api("/api/sample-data", { method: "POST" });
    await refreshAll();
  }),
);

$("#webullBtn").addEventListener("click", () =>
  runAction("Webull check", async () => {
    setBrokerState("Checking", "idle");
    const data = await api("/api/webull-check", { method: "POST" });
    setBrokerState("Connected", "good");
    $("#previewSummary").innerHTML = `<span>Webull account list redacted and reachable.</span>`;
    $("#previewOutput").textContent = JSON.stringify(data.result, null, 2);
  }),
);

$("#previewBtn").addEventListener("click", () =>
  runAction("Webull preview", async () => {
    setBrokerState("Previewing", "idle");
    const data = await api("/api/webull-preview", { method: "POST" });
    setBrokerState("Preview OK", "good");
    renderPreviewSummary(data.results[0]);
    $("#previewOutput").textContent = JSON.stringify(data.results, null, 2);
  }),
);

$("#paperBtn").addEventListener("click", () =>
  runAction("Paper trade", async () => {
    const data = await api("/api/paper-trade", { method: "POST" });
    $("#previewOutput").textContent = JSON.stringify(data.results, null, 2);
    await loadJournal();
  }),
);

refreshAll().catch((error) => toast(error.message));
