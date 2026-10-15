import { useDeferredValue, useMemo, useState } from "react";

export function getBlueprintTargetTab(category = "") {
  if (category.includes("Messaging")) return "chat";
  if (category.includes("Marketplace")) return "market";
  if (category.includes("MerchantOS") || category.includes("Compliance") || category.includes("Mini-Programs") || category.includes("Discovery")) return "discover";
  if (category.includes("Wallet")) return "wallet";
  if (category.includes("Profile")) return "circles";
  if (category.includes("Operator")) return "connectors";
  return "hub";
}

export function getBlueprintRunLabel(category = "") {
  if (category.includes("Navigation")) return "Map";
  if (category.includes("Profile")) return "Sync";
  if (category.includes("Messaging")) return "Thread";
  if (category.includes("Marketplace")) return "Search";
  if (category.includes("MerchantOS")) return "Risk";
  if (category.includes("Wallet")) return "Check";
  if (category.includes("Compliance")) return "Review";
  if (category.includes("Operator")) return "Triage";
  if (category.includes("Mini-Programs")) return "Runtime";
  if (category.includes("Discovery")) return "Discover";
  return "Run";
}

export function BlueprintWorkspace({
  components,
  state,
  setActiveTab,
  openProfilePanel,
  runUnifiedSearch,
  recalculateTrustEngine,
  rebuildReputationGraph,
  runSmartMatchmaking,
  runOperatorCopilot,
  createConversionFunnel,
  registerMiniAppRuntime,
  queueReliableMutation,
  trackAnalyticsEvent,
  setFeatureFlag,
  evaluateWalletRisk,
  runMerchantRiskCheck,
  updateComplianceControl
}) {
  const categories = useMemo(
    () => Array.from(new Set(components.map((item) => item.category))),
    [components]
  );
  const [activeCategory, setActiveCategory] = useState(categories[0] || "All");
  const [blueprintQuery, setBlueprintQuery] = useState("");
  const [lastAction, setLastAction] = useState(null);
  const deferredBlueprintQuery = useDeferredValue(blueprintQuery);
  const normalizedQuery = deferredBlueprintQuery.trim().toLowerCase();
  const enabledFlags = state.analyticsHub?.flags || {};
  const enabledCount = components.filter((item) => enabledFlags[`component_${item.id}`]).length;
  const blueprintEvents = (state.analyticsHub?.events || []).filter((event) => event.category === "blueprint").slice(0, 6);
  const categoryCounts = useMemo(
    () =>
      categories.reduce((counts, category) => {
        counts[category] = components.filter((item) => item.category === category).length;
        return counts;
      }, {}),
    [categories, components]
  );
  const filteredComponents = useMemo(
    () =>
      components
        .filter((item) => activeCategory === "All" || item.category === activeCategory)
        .filter((item) => {
          if (!normalizedQuery) return true;
          return [item.name, item.category, item.mechanic, item.id]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery);
        })
        .sort((a, b) => a.order - b.order),
    [activeCategory, components, normalizedQuery]
  );
  const enableComponent = (item) => {
    const flagKey = `component_${item.id}`;
    setFeatureFlag?.(flagKey, true);
    queueReliableMutation?.({
      mutation: "enable_blueprint_component",
      payload: {
        componentId: item.id,
        order: item.order,
        category: item.category,
        targetTab: getBlueprintTargetTab(item.category)
      }
    });
    trackAnalyticsEvent?.({
      name: "blueprint_component_enabled",
      category: "blueprint",
      metadata: { componentId: item.id, category: item.category, order: item.order }
    });
    setLastAction({ label: item.name, detail: "Enabled and queued for platform sync." });
  };
  const runComponent = (item) => {
    enableComponent(item);
    const targetTab = getBlueprintTargetTab(item.category);
    if (item.category.includes("Navigation")) {
      setFeatureFlag?.(`navigation_room_${item.id}`, true);
      queueReliableMutation?.({ mutation: "refresh_navigation_component", payload: { componentId: item.id } });
    } else if (item.category.includes("Profile")) {
      recalculateTrustEngine?.();
      rebuildReputationGraph?.();
      openProfilePanel?.();
    } else if (item.category.includes("Messaging")) {
      runUnifiedSearch?.("thread");
      queueReliableMutation?.({ mutation: "thread_component_action", payload: { componentId: item.id } });
    } else if (item.category.includes("Marketplace")) {
      runUnifiedSearch?.("listing");
      queueReliableMutation?.({ mutation: "marketplace_component_action", payload: { componentId: item.id } });
    } else if (item.category.includes("MerchantOS")) {
      const merchantId = state.merchantOnboardingQueue?.[0]?.merchantId || state.merchantOnboardingQueue?.[0]?.id || "merchantos-demo";
      runMerchantRiskCheck?.(merchantId, item.name);
    } else if (item.category.includes("Wallet")) {
      evaluateWalletRisk?.({ amount: 275, velocity: 2, geoAnomaly: false, linkedAccountRisk: false });
    } else if (item.category.includes("Compliance")) {
      const controlId = state.compliancePrograms?.[0]?.id || "consumer-protection";
      updateComplianceControl?.(controlId, "in_review");
    } else if (item.category.includes("Operator")) {
      runOperatorCopilot?.({ title: item.name });
    } else if (item.category.includes("Mini-Programs")) {
      registerMiniAppRuntime?.({ appId: item.id, permissions: ["profile.read", "wallet.read", "thread:return"] });
    } else if (item.category.includes("Discovery")) {
      runUnifiedSearch?.(item.name);
      runSmartMatchmaking?.({ query: item.name, city: state.profile?.city || "" });
    }
    if (item.id.includes("conversion") || item.name.includes("Funnel")) {
      createConversionFunnel?.({ title: item.name, offer: "Blueprint conversion path" });
    }
    trackAnalyticsEvent?.({
      name: "blueprint_component_run",
      category: "blueprint",
      metadata: { componentId: item.id, category: item.category, targetTab }
    });
    setLastAction({ label: item.name, detail: `${getBlueprintRunLabel(item.category)} action completed.` });
  };

  return (
    <>
      <section className="surface-row two-up blueprint-hero-row">
        <article className="surface surface-strong blueprint-hero">
          <div className="surface-head">
            <p className="card-label">Organizer</p>
            <span className="badge">{components.length} ways</span>
          </div>
          <h2>FoxHub now has a clear place for everything.</h2>
          <p>
            The {components.length} helpful pieces are grouped by purpose, so people can move through identity, messages, buying,
            selling, shops, money, safety, support, mini apps, and discovery without guessing.
          </p>
          <div className="inline-actions wrap">
            <button type="button" className="accent-button" onClick={() => setActiveTab("discover")}>
              Open Services
            </button>
            <button type="button" className="ghost-button" onClick={() => setActiveTab("connectors")}>
              Open Tools
            </button>
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Easy browsing</p>
            <span className="badge subtle">Organized</span>
          </div>
          <div className="blueprint-summary-grid">
            <div className="metric-card">
              <span className="metric-helper">Rooms</span>
              <strong>{categories.length}</strong>
            </div>
            <div className="metric-card">
              <span className="metric-helper">Visible now</span>
              <strong>{filteredComponents.length}</strong>
            </div>
            <div className="metric-card">
              <span className="metric-helper">Enabled</span>
              <strong>{enabledCount}</strong>
            </div>
          </div>
          <div className="surface-note">
            Instead of forcing all {components.length} into one long scroll, this room shows one section at a time and lets people search.
          </div>
        </article>
      </section>

      <section className="surface-row">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Organizer rooms</p>
            <span className="badge subtle">{activeCategory}</span>
          </div>
          <div className="blueprint-toolbar">
            <input
              type="search"
              value={blueprintQuery}
              onChange={(event) => setBlueprintQuery(event.target.value)}
              placeholder="Search rooms, tools, or what you need"
              aria-label="Search organizer items"
            />
            <button type="button" className="ghost-button" onClick={() => setActiveCategory("All")}>
              Show All
            </button>
          </div>
          <div className="blueprint-category-tabs" role="tablist" aria-label="Organizer rooms">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={category === activeCategory ? "blueprint-category-tab active" : "blueprint-category-tab"}
                onClick={() => setActiveCategory(category)}
              >
                <strong>{category}</strong>
                <span>{categoryCounts[category]} ready</span>
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Organizer list</p>
            <span className="badge subtle">{filteredComponents.length} shown</span>
          </div>
          {lastAction ? (
            <div className="blueprint-action-note">
              <strong>{lastAction.label}</strong>
              <span>{lastAction.detail}</span>
            </div>
          ) : null}
          <div className="blueprint-list">
            {filteredComponents.map((item) => (
              <div key={item.id} className="blueprint-component-row">
                <span className="blueprint-order">{String(item.order).padStart(2, "0")}</span>
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.mechanic}</p>
                </div>
                <div className="blueprint-actions">
                  <span className={enabledFlags[`component_${item.id}`] ? "badge" : "badge subtle"}>
                    {enabledFlags[`component_${item.id}`] ? "Enabled" : item.category}
                  </span>
                  <button type="button" className="ghost-button small" onClick={() => enableComponent(item)}>
                    Enable
                  </button>
                  <button type="button" className="ghost-button small" onClick={() => runComponent(item)}>
                    {getBlueprintRunLabel(item.category)}
                  </button>
                  <button type="button" className="ghost-button small" onClick={() => setActiveTab(getBlueprintTargetTab(item.category))}>
                    Open
                  </button>
                </div>
              </div>
            ))}
            {filteredComponents.length === 0 ? (
              <div className="filtered-empty">
                <strong>No matching organizer items.</strong>
                <p>Try a broader search or switch rooms.</p>
              </div>
            ) : null}
          </div>
        </article>
      </section>

      <section className="surface-row two-up">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Recent follow-up</p>
            <span className="badge subtle">{state.reliabilityQueue?.length || 0} queued</span>
          </div>
          <div className="list-stack">
            {(state.reliabilityQueue || []).slice(0, 5).map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.mutation}</strong>
                  <p>{item.status} · retries {item.retries || 0}</p>
                </div>
                <span className="badge subtle">{item.payload?.componentId || "FoxHub"}</span>
              </div>
            ))}
            {!state.reliabilityQueue?.length ? <p className="surface-note">Turn on or try an item to create the first update.</p> : null}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Organizer activity</p>
            <span className="badge subtle">{blueprintEvents.length} recent</span>
          </div>
          <div className="list-stack">
            {blueprintEvents.map((event) => (
              <div key={event.id} className="list-row">
                <div>
                  <strong>{event.name}</strong>
                  <p>{event.metadata?.componentId || "component"} · {event.metadata?.category || "blueprint"}</p>
                </div>
                <span className="badge subtle">{new Date(event.createdAt).toLocaleTimeString()}</span>
              </div>
            ))}
            {!blueprintEvents.length ? <p className="surface-note">Run a component to populate the action trail.</p> : null}
          </div>
        </article>
      </section>
    </>
  );
}
