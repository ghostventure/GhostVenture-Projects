import { useState } from "react";

export function GrowthWorkspace({ state, busy, setActiveTab, activateGrowthCategory, runGrowthCategory, activateAllGrowthCategories }) {
  const [activeGroup, setActiveGroup] = useState("All");
  const categories = state.growthCategories || [];
  const groupSummaries = [...categories.reduce((map, item) => {
    const key = item.groupId || item.group || "people";
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        name: item.group || "People",
        order: item.groupOrder || 99,
        detail: item.groupDetail || "Related FoxHub activity.",
        items: []
      });
    }
    map.get(key).items.push(item);
    return map;
  }, new Map()).values()].sort((a, b) => a.order - b.order);
  const visibleCategories = activeGroup === "All"
    ? categories
    : categories.filter((item) => (item.groupId || item.group || "people") === activeGroup);
  const groupedVisibleCategories = [...visibleCategories.reduce((map, item) => {
    const key = item.groupId || item.group || "people";
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        name: item.group || "People",
        order: item.groupOrder || 99,
        detail: item.groupDetail || "Related FoxHub activity.",
        items: []
      });
    }
    map.get(key).items.push(item);
    return map;
  }, new Map()).values()].sort((a, b) => a.order - b.order);
  const activeCount = categories.filter((item) => item.status === "active" || item.status === "running").length;
  const outputs = (state.growthOutputs || []).slice(0, 8);
  const moneyOutputs = outputs.filter((item) => item.moneyReadiness).length;
  const selectedGroup = groupSummaries.find((group) => group.id === activeGroup) || null;
  const selectedGroupCount = selectedGroup ? selectedGroup.items.length : categories.length;
  const selectedGroupActiveCount = selectedGroup
    ? selectedGroup.items.filter((item) => item.status === "active" || item.status === "running").length
    : activeCount;

  function activateVisibleCategories() {
    visibleCategories.forEach((item) => activateGrowthCategory?.(item.key));
  }

  function runVisibleCategories() {
    visibleCategories.forEach((item) => runGrowthCategory?.(item.key));
  }

  return (
    <>
      <section className="surface-row two-up">
        <article className="surface surface-strong">
          <div className="surface-head">
            <p className="card-label">Communal</p>
            <span className="badge">{categories.length} paths ready</span>
          </div>
          <h2 className="section-title">Seventeen community paths help people gather, coordinate, and return.</h2>
          <p className="panel-copy">
            This workspace sits after social and rapport: local rooms, creators, booking, stores, trust, money, public pages, and community growth.
          </p>
          <div className="glance-strip compact">
            <div className="glance-card warm"><span>Active</span><strong>{activeCount}/{categories.length}</strong></div>
            <div className="glance-card cool"><span>Recent wins</span><strong>{state.growthOutputs?.length || 0}</strong></div>
            <div className="glance-card soft"><span>Sections</span><strong>{groupSummaries.length}</strong></div>
          </div>
          <div className="button-row wrap">
            <button type="button" className="primary-button" onClick={() => activateAllGrowthCategories?.()} disabled={busy}>
              Turn on all 17
            </button>
            <button type="button" className="ghost-button" onClick={() => categories.forEach((item) => runGrowthCategory?.(item.key))} disabled={busy}>
              Try all 17
            </button>
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Easy checkout</p>
            <span className="badge subtle">No surprises</span>
          </div>
          <div className="list-stack">
            {["Price shown before checkout", "Deposit, hold, and release steps visible", "Receipt and refund paths ready", "Provider payout setup prompted early", "Dispute path visible from wallet/request screens", "Setup warnings appear before payment"].map((item) => (
              <div key={item} className="list-row">
                <div><strong>{item}</strong><p>Built into money, booking, store, deal, creator, and demo records.</p></div>
                <span className="badge">Ready</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row three-up">
        {groupSummaries.map((group) => {
          const groupActive = group.items.filter((item) => item.status === "active" || item.status === "running").length;
          return (
            <article key={group.id} className={activeGroup === group.id ? "surface surface-strong" : "surface"}>
              <div className="surface-head">
                <p className="card-label">{String(group.order).padStart(2, "0")}</p>
                <span className="badge subtle">{groupActive}/{group.items.length} active</span>
              </div>
              <h3>{group.name}</h3>
              <p className="panel-copy">{group.detail}</p>
              <button type="button" className="ghost-button small" onClick={() => setActiveGroup(group.id)}>
                View group
              </button>
            </article>
          );
        })}
      </section>

      <section className="service-library-tabs" aria-label="Communal sections">
        <button
          type="button"
          className={activeGroup === "All" ? "service-library-tab active" : "service-library-tab"}
          onClick={() => setActiveGroup("All")}
        >
          <strong>All groups</strong>
          <span>{categories.length} items</span>
        </button>
        {groupSummaries.map((group) => (
          <button
            key={group.id}
            type="button"
            className={activeGroup === group.id ? "service-library-tab active" : "service-library-tab"}
            onClick={() => setActiveGroup(group.id)}
          >
            <strong>{group.name}</strong>
            <span>{group.items.length} items</span>
          </button>
        ))}
      </section>

      <section className="surface-row">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Grouped categories</p>
            <span className="badge subtle">{selectedGroupActiveCount}/{selectedGroupCount} active</span>
          </div>
          <div className="button-row wrap">
            <button type="button" className="ghost-button" onClick={activateVisibleCategories} disabled={busy}>
              Turn on this section
            </button>
            <button type="button" className="ghost-button" onClick={runVisibleCategories} disabled={busy}>
              Try this section
            </button>
          </div>
          <div className="blueprint-list">
            {groupedVisibleCategories.map((group) => (
              <div key={group.id} className="list-stack">
                <div className="list-row">
                  <div>
                    <strong>{group.name}</strong>
                    <p>{group.detail}</p>
                  </div>
                  <span className="badge subtle">{group.items.length} items</span>
                </div>
                {group.items.sort((a, b) => a.order - b.order).map((category) => (
                  <div key={category.key} className="blueprint-component-row">
                    <span className="blueprint-order">{String(category.order).padStart(2, "0")}</span>
                    <div>
                      <strong>{category.name}</strong>
                      <p>{category.detail}</p>
                      <span className="row-meta-text">{category.group} · {category.surface} · Opens {category.targetTab || "hub"}</span>
                    </div>
                    <div className="blueprint-actions">
                      <span className={category.status === "active" || category.status === "running" ? "badge" : "badge subtle"}>{category.status}</span>
                      <button type="button" className="ghost-button small" onClick={() => activateGrowthCategory?.(category.key)} disabled={busy}>Activate</button>
                      <button type="button" className="ghost-button small" onClick={() => runGrowthCategory?.(category.key)} disabled={busy}>Run</button>
                      <button type="button" className="ghost-button small" onClick={() => setActiveTab(category.targetTab || "hub")}>Open</button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row two-up">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Recent activity</p>
            <span className="badge subtle">{outputs.length} updates</span>
          </div>
          <div className="list-stack">
            {outputs.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.categoryName}</strong>
                  <p>{item.headline || item.detail || item.salesOffer?.join(", ") || item.requestTypes?.join(", ") || `${item.surface} record generated.`}</p>
                </div>
                <span className="badge subtle">{item.group || item.surface}</span>
              </div>
            ))}
            {!outputs.length ? <p className="panel-copy">Try a path to create the first update.</p> : null}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">What happened</p>
            <span className="badge subtle">{(state.growthEvents || []).length} total</span>
          </div>
          <div className="list-stack">
            {(state.growthEvents || []).slice(0, 8).map((event) => (
              <div key={event.id} className="list-row">
                <div><strong>{event.action}</strong><p>{event.detail}</p></div>
                <span className="badge subtle">{event.group || event.categoryKey}</span>
              </div>
            ))}
            {!(state.growthEvents || []).length ? <p className="panel-copy">Nothing has happened here yet.</p> : null}
          </div>
        </article>
      </section>
    </>
  );
}
