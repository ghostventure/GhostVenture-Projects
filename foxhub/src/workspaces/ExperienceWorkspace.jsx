import { useState } from "react";

export function getUxOutputCount(state, key) {
  const outputFields = {
    "universal-command-center": "uxCommandRuns",
    "today-dashboard": "uxTodayCards",
    "context-right-rail": "uxContextRailItems",
    "action-timeline": "uxTimelines",
    "inbox-priority-modes": "uxInboxModes",
    "trust-badge-system": "uxTrustBadges",
    "smart-empty-states": "uxEmptyStateActions",
    "onboarding-progress-map": "uxOnboardingSteps",
    "miniapp-permission-review": "uxMiniAppPermissionReviews",
    "payment-flow-stepper": "uxPaymentSteppers",
    "notification-inbox-upgrade": "uxNotificationInbox",
    "operator-review-console": "uxOperatorConsoleItems",
    "local-map-list-toggle": "uxDiscoveryViews",
    "profile-completeness-meter": "uxCompletenessMeters",
    "saved-workspace": "uxSavedWorkspaceItems",
    "undo-recent-action-toasts": "uxToasts",
    "skeleton-offline-banners": "uxRuntimeBanners",
    "role-based-home-layout": "uxRoleHomeLayouts",
    "object-detail-pages": "uxObjectDetails",
    "guided-create-button": "uxCreateMenuActions"
  };
  const field = outputFields[key] || "uxEvents";
  return Array.isArray(state[field]) ? state[field].length : 0;
}

export function ExperienceWorkspace({
  state,
  setActiveTab,
  openProfilePanel,
  runUnifiedSearch,
  runUnifiedAction,
  activateUxComponent,
  runUxComponent,
  registerBrowserNotifications,
  selectThread,
  handleWalletAction,
  openSearchScope,
  activeMiniApp,
  busy
}) {
  const [selectedKey, setSelectedKey] = useState(state.uxComponents?.[0]?.key || "");
  const [localView, setLocalView] = useState("list");
  const uxComponents = [...(state.uxComponents || [])].sort((a, b) => a.order - b.order);
  const selectedComponent = uxComponents.find((item) => item.key === selectedKey) || uxComponents[0] || null;
  const activeCount = uxComponents.filter((item) => item.status === "active" || item.status === "running").length;
  const recentUxEvents = (state.uxEvents || []).slice(0, 8);
  const latestOutputs = [
    ...(state.uxCommandRuns || []),
    ...(state.uxTodayCards || []),
    ...(state.uxContextRailItems || []),
    ...(state.uxTimelines || []),
    ...(state.uxInboxModes || []),
    ...(state.uxTrustBadges || []),
    ...(state.uxEmptyStateActions || []),
    ...(state.uxOnboardingSteps || []),
    ...(state.uxMiniAppPermissionReviews || []),
    ...(state.uxPaymentSteppers || []),
    ...(state.uxNotificationInbox || []),
    ...(state.uxOperatorConsoleItems || []),
    ...(state.uxDiscoveryViews || []),
    ...(state.uxCompletenessMeters || []),
    ...(state.uxSavedWorkspaceItems || []),
    ...(state.uxToasts || []),
    ...(state.uxRuntimeBanners || []),
    ...(state.uxRoleHomeLayouts || []),
    ...(state.uxObjectDetails || []),
    ...(state.uxCreateMenuActions || [])
  ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 8);
  const selectedOutputCount = selectedComponent ? getUxOutputCount(state, selectedComponent.key) : 0;

  function runFeature(component) {
    const output = runUxComponent?.(component.key, { appId: activeMiniApp?.id });
    if (component.key === "universal-command-center") {
      runUnifiedSearch?.("wallet");
    }
    if (component.key === "miniapp-permission-review") {
      setActiveTab("discover");
    }
    if (component.key === "notification-inbox-upgrade") {
      void registerBrowserNotifications?.();
    }
    if (component.key === "payment-flow-stepper") {
      void handleWalletAction?.("merchant");
    }
    if (component.key === "object-detail-pages" && state.selectedThreadId) {
      selectThread?.(state.selectedThreadId);
    }
    if (component.key === "local-map-list-toggle") {
      openSearchScope?.("local");
    }
    if (component.key === "profile-completeness-meter") {
      openProfilePanel?.();
    }
    if (component.key === "guided-create-button") {
      setActiveTab("market");
    }
    return output;
  }

  const inboxModes = state.uxInboxModes?.[0]?.modes || ["All", "People", "Services", "Money", "Needs reply", "High trust", "Operator"];
  const onboardingSteps = state.uxOnboardingSteps?.[0]?.steps || [];
  const paymentSteps = state.uxPaymentSteppers?.[0]?.steps || ["created", "funded", "held", "reviewed", "released", "disputed", "resolved"];
  const trustBadges = state.uxTrustBadges?.[0]?.badges || ["Verified identity", "Fast responder", "Low dispute rate", "Review pending", "Payment hold active"];
  const createActions = state.uxCreateMenuActions?.[0]?.actions || ["message", "listing", "group", "event", "route", "document", "merchant case", "mini-app manifest"];
  const runtimeBanner = state.uxRuntimeBanners?.[0] || { mode: state.backendMode, banners: ["syncing", "offline", "local-only", "firebase-connected", "native-locked"] };
  const connectionLabel = runtimeBanner.mode === "firebase" ? "Live" : runtimeBanner.mode === "locked" ? "Locked" : "Preview";
  const friendlyBanners = {
    syncing: "Updating",
    offline: "Offline",
    "local-only": "Preview only",
    "firebase-connected": "Live connection",
    "native-locked": "Mobile locked"
  };

  return (
    <>
      <section className="surface-row two-up ux-hero-row">
        <article className="surface surface-strong">
          <div className="surface-head">
            <p className="card-label">UX / Goodies</p>
            <span className="badge subtle">{activeCount}/{uxComponents.length} active</span>
          </div>
          <h2>Twenty interface touches support the rapport network.</h2>
          <p className="surface-note">
            These comforts make social, rapport, communal, service, money, and profile flows easier to understand.
          </p>
          <div className="inline-actions wrap">
            <button type="button" className="accent-button" onClick={() => uxComponents.forEach((item) => activateUxComponent?.(item.key))} disabled={busy}>
              Turn on all 20
            </button>
            <button type="button" className="ghost-button" onClick={() => uxComponents.forEach((item) => runFeature(item))} disabled={busy}>
              Try all in order
            </button>
            <button type="button" className="ghost-button" onClick={() => setLocalView((current) => current === "list" ? "map" : "list")}>
              {localView === "list" ? "Map view" : "List view"}
            </button>
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Connection</p>
            <span className="badge">{connectionLabel}</span>
          </div>
          <div className="glance-strip compact">
            <div className="glance-card warm">
              <span>Goodie actions</span>
              <strong>{state.uxEvents?.length || 0}</strong>
            </div>
            <div className="glance-card cool">
              <span>Updates</span>
              <strong>{latestOutputs.length}</strong>
            </div>
            <div className="glance-card soft">
              <span>View</span>
              <strong>{localView}</strong>
            </div>
          </div>
          <div className="runtime-banner-row">
            {(runtimeBanner.banners || []).map((item) => (
              <span key={item} className="badge subtle">{friendlyBanners[item] || item}</span>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row ux-layout">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Goodie list</p>
            <span className="badge subtle">{uxComponents.length} perks</span>
          </div>
          <div className="blueprint-list">
            {uxComponents.map((component) => (
              <div key={component.key} className={selectedComponent?.key === component.key ? "blueprint-component-row active-soft" : "blueprint-component-row"}>
                <span className="blueprint-order">{String(component.order).padStart(2, "0")}</span>
                <div>
                  <strong>{component.name}</strong>
                  <p>{component.detail}</p>
                  <span className="row-meta-text">{component.surface} · {getUxOutputCount(state, component.key)} outputs</span>
                </div>
                <div className="blueprint-actions">
                  <span className={component.status === "active" || component.status === "running" ? "badge" : "badge subtle"}>{component.status || "ready"}</span>
                  <button type="button" className="ghost-button small" onClick={() => { setSelectedKey(component.key); activateUxComponent?.(component.key); }} disabled={busy}>
                    Activate
                  </button>
                  <button type="button" className="ghost-button small" onClick={() => { setSelectedKey(component.key); runFeature(component); }} disabled={busy}>
                    Run
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <aside className="surface ux-detail-panel">
          <div className="surface-head">
            <p className="card-label">Context rail</p>
            <span className="badge subtle">{selectedOutputCount} outputs</span>
          </div>
          {selectedComponent ? (
            <div className="list-stack">
              <div className="list-row">
                <div>
                  <strong>{String(selectedComponent.order).padStart(2, "0")}. {selectedComponent.name}</strong>
                  <p>{selectedComponent.detail}</p>
                </div>
              </div>
              <div className="list-row">
                <div>
                  <strong>Object context</strong>
                  <p>{state.uxContextRailItems?.[0]?.objectType || "thread"} · {state.uxContextRailItems?.[0]?.objectId || state.selectedThreadId || "current"}</p>
                </div>
                <span className="badge subtle">trust {state.uxContextRailItems?.[0]?.trust || state.trustEngine?.profileScore || 0}</span>
              </div>
              <div className="inline-actions wrap">
                <button type="button" className="ghost-button small" onClick={() => setActiveTab("chat")}>Chat</button>
                <button type="button" className="ghost-button small" onClick={() => setActiveTab("wallet")}>Money</button>
                <button type="button" className="ghost-button small" onClick={() => setActiveTab("discover")}>Services</button>
              </div>
            </div>
          ) : null}
        </aside>
      </section>

      <section className="surface-row three-up">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Today dashboard</p>
            <span className="badge subtle">{state.uxTodayCards?.length || 0} cards</span>
          </div>
          <div className="list-stack">
            {(state.uxTodayCards?.[0]?.cards || ["Run Today Dashboard to build daily cards."]).map((item) => (
              <div key={item} className="list-row"><strong>{item}</strong></div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Inbox modes</p>
            <span className="badge subtle">{inboxModes.length} modes</span>
          </div>
          <div className="context-chip-row">
            {inboxModes.map((mode) => <button key={mode} type="button" className="context-chip"><strong>{mode}</strong></button>)}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Trust badges</p>
            <span className="badge subtle">{trustBadges.length} badges</span>
          </div>
          <div className="runtime-banner-row">
            {trustBadges.map((badge) => <span key={badge} className="badge">{badge}</span>)}
          </div>
        </article>
      </section>

      <section className="surface-row three-up">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Onboarding map</p>
            <span className="badge subtle">{onboardingSteps.filter((item) => item.done).length}/{onboardingSteps.length || 5}</span>
          </div>
          <div className="list-stack">
            {(onboardingSteps.length ? onboardingSteps : [{ label: "Run Onboarding Progress Map", done: false }]).map((step) => (
              <div key={step.label} className="list-row">
                <strong>{step.label}</strong>
                <span className={step.done ? "badge" : "badge review"}>{step.done ? "Done" : "Next"}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Payment stepper</p>
            <span className="badge subtle">{state.uxPaymentSteppers?.[0]?.currentStep || "ready"}</span>
          </div>
          <div className="payment-stepper">
            {paymentSteps.map((step) => (
              <span key={step} className={step === state.uxPaymentSteppers?.[0]?.currentStep ? "payment-step active" : "payment-step"}>{step}</span>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Guided create</p>
            <span className="badge subtle">{createActions.length} actions</span>
          </div>
          <div className="context-chip-row">
            {createActions.map((action) => <button key={action} type="button" className="context-chip"><strong>{action}</strong></button>)}
          </div>
        </article>
      </section>

      <section className="surface-row two-up">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Operator review console</p>
            <span className="badge subtle">{state.uxOperatorConsoleItems?.length || 0} snapshots</span>
          </div>
          <div className="metrics-grid">
            {Object.entries(state.uxOperatorConsoleItems?.[0]?.queues || { verification: 0, disputes: 0, incidents: 0, payoutHolds: 0 }).map(([label, value]) => (
              <div key={label} className="metric-card">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Latest UX output</p>
            <span className="badge subtle">{latestOutputs.length} records</span>
          </div>
          <div className="list-stack">
            {latestOutputs.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.componentName}</strong>
                  <p>{item.result || item.nextAction || item.decision || item.defaultAction || item.status}</p>
                </div>
                <span className="badge subtle">{String(item.order || "").padStart(2, "0")}</span>
              </div>
            ))}
            {!latestOutputs.length ? <p className="panel-copy">Run UX features to populate this output stack.</p> : null}
          </div>
        </article>
      </section>
    </>
  );
}
