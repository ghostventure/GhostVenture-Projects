

import { normalizeConnectorStatus, connectorStatusBadge, formatConnectorDate, FilteredEmptyState } from "./shared.jsx";

export function ConnectorsWorkspace({ state, saveConnectorIntent, openConnectorSurface, connectConnector, testConnector, disconnectConnector, prepareStripeConnector }) {
  const automationCount = state.apiConnectors.filter((item) => item.automation && item.automation !== "Manual").length;
  const activeCount = state.apiConnectors.filter((item) => normalizeConnectorStatus(item.status) === "Active").length;
  const readyCount = Math.max(state.apiConnectors.length - activeCount, 0);
  const stripeConnector = state.apiConnectors.find((item) => item.id === "stripe-connect") || null;
  const stripeReady = Boolean(stripeConnector?.stripeReady || stripeConnector?.setupComplete || normalizeConnectorStatus(stripeConnector?.status) === "Active");
  const stripeMissingFields = Array.isArray(stripeConnector?.missingProfileFields) ? stripeConnector.missingProfileFields : [];
  const stripeBillingPlans = [
    {
      id: "verified-user",
      name: "Verified user badge",
      price: "$20/mo",
      audience: "Creators, operators, local service pros",
      status: "Ready for Stripe Price ID"
    },
    {
      id: "merchant-tools",
      name: "Merchant tools",
      price: "Usage + platform fee",
      audience: "Local merchants and service providers",
      status: "Needs live checkout session"
    },
    {
      id: "mini-app-billing",
      name: "Mini-app billing",
      price: "Subscription or commission",
      audience: "Mini-app owners and marketplace partners",
      status: "Needs product mapping"
    }
  ];
  const stripeBillingReadiness = [
    { label: "Client packages", value: "@stripe/react-stripe-js + @stripe/stripe-js", state: "Installed" },
    { label: "Server package", value: "Functions stripe SDK", state: "Installed" },
    { label: "Webhook capture", value: "stripeWebhookEvents + billingSubscriptionEvents", state: "Installed" },
    { label: "Connector", value: stripeReady ? "Profile ready for account linking" : stripeMissingFields.length ? `Missing ${stripeMissingFields.join(", ")}` : "Run prepare check", state: stripeReady ? "Ready" : "Setup" }
  ];

  return (
    <>
      <section className="surface-row two-up">
        <article className="surface surface-strong">
          <div className="surface-head">
            <p className="card-label">API connectors</p>
            <span className="badge subtle">{state.apiConnectors.length} tracked</span>
          </div>
          <div className="surface-note">
            One-tap connector controls for non-technical operators. Connect first, run a check, then open the matching FoxHub surface.
          </div>
          {stripeConnector ? (
            <div className="inline-actions wrap">
              <button type="button" className="accent-button" onClick={() => prepareStripeConnector()}>
                Prepare Stripe
              </button>
              <span className={connectorStatusBadge(stripeConnector.status)}>
                Stripe: {normalizeConnectorStatus(stripeConnector.status)}
              </span>
            </div>
          ) : null}
          <div className="glance-strip compact">
            <div className="glance-card warm">
              <span>Automation</span>
              <strong>{automationCount}</strong>
            </div>
            <div className="glance-card cool">
              <span>Active</span>
              <strong>{activeCount}</strong>
            </div>
            <div className="glance-card soft">
              <span>Ready</span>
              <strong>{readyCount}</strong>
            </div>
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Connector logic</p>
            <span className="badge subtle">Operational view</span>
          </div>
          <div className="list-stack">
            <div className="moderation-rule-card">
              <strong>If a connector is not ready, the product should not silently depend on it.</strong>
              <p>Use this page to inspect which external rails are active, which are ready, and which surfaces in FoxHub are tied to them.</p>
            </div>
            <div className="moderation-rule-card">
              <strong>Simple flow: Connect, Check, Open surface.</strong>
              <p>Every connector now supports a full lifecycle: connect it, run a health check, and disconnect if you need to pause it.</p>
            </div>
          </div>
        </article>
      </section>

      <section className="surface-row two-up stripe-billing-section">
        <article className="surface surface-strong">
          <div className="surface-head">
            <p className="card-label">Stripe Billing</p>
            <span className={stripeReady ? "badge" : "badge review"}>{stripeReady ? "Ready to link" : "Setup needed"}</span>
          </div>
          <div className="surface-note">
            Billing components are installed as a guarded setup surface. FoxHub can show plans, readiness, and next actions now; live charges still require Stripe keys, Price IDs, and hosted checkout or portal sessions.
          </div>
          <div className="stripe-billing-readiness">
            {stripeBillingReadiness.map((item) => (
              <div key={item.label} className="stripe-readiness-card">
                <span>{item.label}</span>
                <strong>{item.state}</strong>
                <p>{item.value}</p>
              </div>
            ))}
          </div>
          <div className="inline-actions wrap">
            <button type="button" className="accent-button" onClick={() => prepareStripeConnector()}>
              Prepare Stripe billing
            </button>
            <button type="button" className="ghost-button small" onClick={() => openConnectorSurface(stripeConnector || { surface: "wallet", name: "Stripe Billing" })}>
              Open wallet billing
            </button>
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Billing plans</p>
            <span className="badge subtle">{stripeBillingPlans.length} mapped</span>
          </div>
          <div className="stripe-plan-grid">
            {stripeBillingPlans.map((plan) => (
              <div key={plan.id} className="stripe-plan-card">
                <span>{plan.audience}</span>
                <strong>{plan.name}</strong>
                <p>{plan.price}</p>
                <div className="row-meta-text">{plan.status}</div>
              </div>
            ))}
          </div>
          <div className="stripe-billing-warning">
            <strong>Live billing guard</strong>
            <p>Do not enable real checkout until `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, product Price IDs, success/cancel URLs, and legal billing copy are configured and verified.</p>
          </div>
        </article>
      </section>

      <section className="surface-row">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Connector registry</p>
            <span className="badge subtle">{state.apiConnectors.length} visible</span>
          </div>
          <div className="list-stack">
            {state.apiConnectors.map((connector) => (
              <div key={connector.id} className="list-row connector-row">
                <div>
                  <strong>{connector.name}</strong>
                  <p>{connector.summary}</p>
                  <div className="row-meta-text">
                    {connector.category} · {connector.automation} · Last check: {formatConnectorDate(connector.lastCheckedAt)}
                  </div>
                </div>
                <div className="inline-actions wrap">
                  <span className={connectorStatusBadge(connector.status)}>{normalizeConnectorStatus(connector.status)}</span>
                  {connector.id === "stripe-connect" ? (
                    <button type="button" className="ghost-button small" onClick={() => prepareStripeConnector()}>
                      Prepare Stripe
                    </button>
                  ) : null}
                  <button type="button" className="ghost-button small" onClick={() => connectConnector(connector)}>
                    Connect
                  </button>
                  <button type="button" className="ghost-button small" onClick={() => testConnector(connector)}>
                    Run check
                  </button>
                  <button type="button" className="ghost-button small" onClick={() => disconnectConnector(connector)}>
                    Disconnect
                  </button>
                  <button type="button" className="ghost-button small" onClick={() => openConnectorSurface(connector)}>
                    Open surface
                  </button>
                  <button type="button" className="ghost-button small" onClick={() => saveConnectorIntent(connector)}>
                    Save for setup
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
      {!state.apiConnectors.length ? <FilteredEmptyState label="Tools" /> : null}
    </>
  );
}
