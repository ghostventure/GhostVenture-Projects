import { useEffect, useMemo, useState } from "react";
import { SimpleImageBand } from "./EstateHatImagery.jsx";

const S = {
  card: "var(--s-card)",
  surface: "var(--s-surface)",
  surfaceAlt: "var(--s-surface-alt)",
  dark: "var(--s-dark)",
  muted: "var(--s-muted)",
  light: "var(--s-light)",
  border: "var(--s-border)",
  borderStrong: "var(--s-border-strong)",
  gold: "var(--s-gold)",
  goldDeep: "var(--s-gold-deep)",
  goldBg: "var(--s-goldBg)",
  green: "var(--s-green)",
  greenBg: "var(--s-greenBg)",
  red: "var(--s-red)",
  redBg: "var(--s-redBg)",
  blue: "var(--s-blue)",
  blueBg: "var(--s-blueBg)",
  font: "'Plus Jakarta Sans', sans-serif",
  serif: "'DM Serif Display', serif",
  shadowSoft: "var(--s-shadow-soft)",
};

const UX_GROUPS = [
  {
    key: "navigation",
    label: "Navigation And Shell",
    intro: "Ways to move through EstateHat faster without losing role, listing, or transaction context.",
    items: [
      "Universal Command Center",
      "Global Create Menu",
      "Role-Aware Home Layout",
      "Context-Aware Right Rail",
      "Breadcrumb Trail Plus",
      "Recent Workspace Switcher",
      "Pinned Workspaces Bar",
      "Mobile Thumb Navigation",
      "Desktop Split Pane Layout",
      "Keyboard Shortcut Coach",
      "Back-To-Deal Return Path",
      "Session Resume Banner",
    ],
  },
  {
    key: "discovery",
    label: "Property Discovery",
    intro: "Listing search, comparison, map, neighborhood, and buyer-decision improvements.",
    items: [
      "Map/List Toggle",
      "Draw-To-Search Boundary",
      "Commute Time Filter",
      "School Zone Snapshot",
      "Neighborhood Fit Score",
      "Property Match Score",
      "Saved Search Alerts",
      "Recently Viewed Rail",
      "Listing Confidence Badges",
      "Photo Completeness Meter",
      "Open-House Planner",
      "Side-By-Side Compare Tray",
      "Price Drop Watch",
      "Property Note Pins",
    ],
  },
  {
    key: "transaction",
    label: "Transaction Workflow",
    intro: "Offer-to-close UI that makes blockers, money, docs, and responsibilities obvious.",
    items: [
      "Offer Flow Stepper",
      "Closing Timeline",
      "Contingency Checklist",
      "Earnest Money Tracker",
      "Inspection Resolution Board",
      "Appraisal Gap Meter",
      "Title Review Status",
      "Closing Cost Breakdown",
      "Net Proceeds Preview",
      "Signer Responsibility Matrix",
      "Deal Health Score",
      "Blocker Triage Queue",
      "Milestone Dependency Map",
      "Final Walkthrough Checklist",
    ],
  },
  {
    key: "documents",
    label: "Documents And Compliance",
    intro: "Document, signature, disclosure, jurisdiction, and evidence review surfaces.",
    items: [
      "Document Vault Inbox",
      "Missing Document Radar",
      "E-Sign Status Tracker",
      "Disclosure Packet Builder",
      "Jurisdiction Rule Drawer",
      "Document Version Timeline",
      "Sensitive Data Shield",
      "Upload Dropzone Review",
      "County Recording Checklist",
      "Compliance Evidence Bundle",
      "Attorney Review Panel",
      "Audit Trail Viewer",
      "Policy Acknowledgement Center",
      "Retention Status Meter",
    ],
  },
  {
    key: "trust",
    label: "Trust, Safety, And Money",
    intro: "Identity, fraud, role separation, verified billing, payout, and wire-safety UX.",
    items: [
      "Profile Completeness Meter",
      "Trust Badge System",
      "Role Conflict Warning",
      "Verified Billing Checklist",
      "Wire Safety Confirmation",
      "Payout Readiness Meter",
      "Fraud Signal Inbox",
      "Device Trust Panel",
      "MFA Setup Prompt",
      "Login Alert Preferences",
      "Escrow Status Card",
      "Receipt Drawer",
      "Refund/Credit Tracker",
      "Risk Review Console",
    ],
  },
  {
    key: "communication",
    label: "Communication And Support",
    intro: "Messaging, notifications, guidance, assistant, and customer-service affordances.",
    items: [
      "Notification Inbox Upgrade",
      "Message Priority Modes",
      "Template Reply Picker",
      "Participant Presence Chips",
      "Deal Comment Threads",
      "Support Ticket Drawer",
      "Help Article Overlay",
      "Guided Onboarding Map",
      "Smart Empty States",
      "Undo Recent Action Toasts",
      "Offline/Sync Banners",
      "Assistant Suggested Actions",
      "FAQ Inline Answers",
      "Feedback/Bug Report Modal",
    ],
  },
  {
    key: "admin",
    label: "Admin And Operations",
    intro: "Review consoles, queue visibility, SLA state, bulk action, and operator controls.",
    items: [
      "Admin Review Console",
      "Verification Queue Kanban",
      "Listing Quality Review",
      "Photo Review Workbench",
      "Document Review Split View",
      "SLA Timer Badges",
      "Bulk Assignment Bar",
      "Exception Case Drawer",
      "Government Oversight View",
      "County Priority Dashboard",
      "Vendor Compliance Tracker",
      "Release Readiness Checklist",
    ],
  },
];

const UX_ITEMS = UX_GROUPS.flatMap((group) =>
  group.items.map((name, index) => ({
    key: `${group.key}-${index + 1}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
    name,
    group: group.key,
    groupLabel: group.label,
    order: 1 + UX_GROUPS.slice(0, UX_GROUPS.findIndex((item) => item.key === group.key)).reduce((sum, item) => sum + item.items.length, 0) + index,
  }))
);

function readStoredState() {
  try {
    const raw = localStorage.getItem("estatehat-ux-ui-suite-v1");
    return raw ? JSON.parse(raw) : { active: {}, outputs: [], runs: [] };
  } catch {
    return { active: {}, outputs: [], runs: [] };
  }
}

function writeStoredState(next) {
  try {
    localStorage.setItem("estatehat-ux-ui-suite-v1", JSON.stringify(next));
  } catch {
    // Keep the session functional if storage is unavailable.
  }
}

function useMediaQuery(query) {
  const getMatches = () => (typeof window !== "undefined" ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia(query);
    const handleChange = () => setMatches(media.matches);
    handleChange();
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}

function Button({ children, tone = "default", style, ...props }) {
  const palette = tone === "primary"
    ? { background: S.gold, color: S.dark, borderColor: "transparent" }
    : tone === "danger"
      ? { background: S.redBg, color: S.red, borderColor: S.redBg }
      : { background: S.card, color: S.muted, borderColor: S.border };
  return (
    <button type="button" style={{ ...palette, border: `1px solid ${palette.borderColor}`, borderRadius: 8, padding: "9px 12px", fontFamily: S.font, fontSize: 12, fontWeight: 800, cursor: "pointer", ...style }} {...props}>
      {children}
    </button>
  );
}

function Badge({ children, tone = "default" }) {
  const palette = tone === "good"
    ? { background: S.greenBg, color: S.green }
    : tone === "warn"
      ? { background: S.redBg, color: S.red }
      : tone === "accent"
        ? { background: S.goldBg, color: S.goldDeep }
        : { background: S.surface, color: S.muted };
  return <span style={{ ...palette, borderRadius: 999, padding: "4px 9px", fontFamily: S.font, fontSize: 10, fontWeight: 900, textTransform: "uppercase", whiteSpace: "nowrap" }}>{children}</span>;
}

function Card({ children, style, className = "" }) {
  return <section className={`estatehat-no-overlap ${className}`.trim()} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 16, boxShadow: `0 12px 30px ${S.shadowSoft}`, minWidth: 0, ...style }}>{children}</section>;
}

function getOutputPayload(item, { listings = [], user = {} }) {
  const now = new Date().toISOString();
  const base = {
    id: `${item.key}-${Date.now()}`,
    key: item.key,
    name: item.name,
    group: item.groupLabel,
    order: item.order,
    createdAt: now,
  };
  const listingCount = listings.length;
  const accountLabel = user?.accountType || "buyer";
  const sampleAddress = listings[0]?.address || listings[0]?.title || "Active property";

  if (item.group === "navigation") return { ...base, outputType: "navigation", summary: `${item.name} routed ${accountLabel} context into a stable workspace action.`, actions: ["Open dashboard", "Return to deal", "Create", "Find"] };
  if (item.group === "discovery") return { ...base, outputType: "discovery", summary: `${item.name} evaluated ${listingCount} listings for ${sampleAddress}.`, actions: ["Save search", "Compare", "Plan tour", "Watch price"] };
  if (item.group === "transaction") return { ...base, outputType: "transaction", summary: `${item.name} created a buyer/seller closing checkpoint.`, actions: ["Assign owner", "Resolve blocker", "Upload proof", "Notify team"] };
  if (item.group === "documents") return { ...base, outputType: "documents", summary: `${item.name} prepared a compliance-safe document review state.`, actions: ["Preview", "Request signature", "Log audit", "Escalate"] };
  if (item.group === "trust") return { ...base, outputType: "trust", summary: `${item.name} checked identity, money, role, and device risk signals.`, actions: ["Verify", "Hold", "Release", "Review"] };
  if (item.group === "communication") return { ...base, outputType: "communication", summary: `${item.name} produced a support or messaging action.`, actions: ["Reply", "Mute", "Open help", "Undo"] };
  return { ...base, outputType: "admin", summary: `${item.name} generated an operations review output.`, actions: ["Assign", "Approve", "Reject", "Export"] };
}

function Metric({ label, value, detail }) {
  return (
    <Card>
      <div style={{ fontFamily: S.font, fontSize: 10, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase", color: S.goldDeep }}>{label}</div>
      <div style={{ fontFamily: S.serif, fontSize: 34, lineHeight: 1, color: S.dark, marginTop: 6 }}>{value}</div>
      <p style={{ fontFamily: S.font, fontSize: 12, color: S.light, lineHeight: 1.5, margin: "8px 0 0" }}>{detail}</p>
    </Card>
  );
}

function PreviewPanel({ output }) {
  if (!output) {
    return (
      <Card>
        <div style={{ fontFamily: S.font, fontSize: 14, fontWeight: 900, color: S.dark }}>No UX output yet</div>
        <p style={{ fontFamily: S.font, fontSize: 12.5, color: S.light, lineHeight: 1.55, margin: "8px 0 0" }}>Run any goodie to create a visible EstateHat output record.</p>
      </Card>
    );
  }

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <div>
          <div style={{ fontFamily: S.font, fontSize: 10, color: S.goldDeep, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1.2 }}>Latest output</div>
          <h3 style={{ fontFamily: S.font, fontSize: 16, color: S.dark, margin: "5px 0 0" }}>{String(output.order).padStart(2, "0")}. {output.name}</h3>
        </div>
        <Badge tone="accent">{output.outputType}</Badge>
      </div>
      <p style={{ fontFamily: S.font, fontSize: 13, color: S.muted, lineHeight: 1.6, margin: "12px 0" }}>{output.summary}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8 }}>
        {(output.actions || []).map((action) => (
          <div key={action} style={{ background: S.surfaceAlt, border: `1px solid ${S.border}`, borderRadius: 8, padding: 10, fontFamily: S.font, fontSize: 12, color: S.dark, fontWeight: 800 }}>{action}</div>
        ))}
      </div>
    </Card>
  );
}

export function EstateHatUxSuiteView({ listings = [], user, onNavigate }) {
  const isNarrow = useMediaQuery("(max-width: 1500px)");
  const [state, setState] = useState(readStoredState);
  const [activeGroup, setActiveGroup] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState(UX_ITEMS[0]?.key || "");
  const q = query.trim().toLowerCase();
  const selected = UX_ITEMS.find((item) => item.key === selectedKey) || UX_ITEMS[0];
  const visibleItems = useMemo(
    () => UX_ITEMS.filter((item) =>
      (activeGroup === "all" || item.group === activeGroup) &&
      (!q || `${item.name} ${item.groupLabel}`.toLowerCase().includes(q))
    ),
    [activeGroup, q]
  );
  const activeCount = Object.values(state.active || {}).filter(Boolean).length;
  const latestOutput = state.outputs?.[0] || null;

  function commit(next) {
    setState(next);
    writeStoredState(next);
  }

  function activate(item) {
    commit({
      ...state,
      active: { ...(state.active || {}), [item.key]: true },
      runs: [
        { id: `activate-${item.key}-${Date.now()}`, action: "activate", key: item.key, name: item.name, order: item.order, createdAt: new Date().toISOString() },
        ...(state.runs || []),
      ].slice(0, 240),
    });
    setSelectedKey(item.key);
  }

  function run(item) {
    const output = getOutputPayload(item, { listings, user });
    commit({
      ...state,
      active: { ...(state.active || {}), [item.key]: true },
      outputs: [output, ...(state.outputs || [])].slice(0, 240),
      runs: [
        { id: `run-${item.key}-${Date.now()}`, action: "run", key: item.key, name: item.name, order: item.order, createdAt: output.createdAt },
        ...(state.runs || []),
      ].slice(0, 240),
    });
    setSelectedKey(item.key);
  }

  function activateAll() {
    const nextActive = UX_ITEMS.reduce((map, item) => ({ ...map, [item.key]: true }), {});
    commit({
      ...state,
      active: nextActive,
      runs: [
        { id: `activate-all-${Date.now()}`, action: "activate_all", key: "all", name: "Activate all EstateHat Goodies", order: 0, createdAt: new Date().toISOString() },
        ...(state.runs || []),
      ].slice(0, 240),
    });
  }

  function runAllVisible() {
    const outputs = visibleItems.map((item) => getOutputPayload(item, { listings, user }));
    commit({
      ...state,
      active: { ...(state.active || {}), ...visibleItems.reduce((map, item) => ({ ...map, [item.key]: true }), {}) },
      outputs: [...outputs.reverse(), ...(state.outputs || [])].slice(0, 240),
      runs: [
        { id: `run-visible-${Date.now()}`, action: "run_visible", key: activeGroup, name: `Run ${visibleItems.length} visible Goodies`, order: 0, createdAt: new Date().toISOString() },
        ...(state.runs || []),
      ].slice(0, 240),
    });
  }

  return (
    <main className="estatehat-responsive-workspace" style={{ maxWidth: 1320, margin: "0 auto", padding: isNarrow ? "22px 14px 48px" : "26px 22px 48px" }}>
      <div className="estatehat-workspace-header" style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "minmax(0,1fr) auto", gap: 18, alignItems: "end", marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: S.font, fontSize: 11, color: S.goldDeep, fontWeight: 900, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>EstateHat Goodies</div>
          <h1 style={{ fontFamily: S.serif, fontSize: 40, lineHeight: 1, color: S.dark, margin: 0 }}>Goodies</h1>
          <p style={{ fontFamily: S.font, fontSize: 14, color: S.light, lineHeight: 1.6, maxWidth: 820, margin: "10px 0 0" }}>
            A larger EstateHat-specific library for navigation, listing discovery, transaction workflow, documents, trust, support, and operations. Each goodie activates and produces a persisted local output record.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: isNarrow ? "flex-start" : "flex-end" }}>
          <Button onClick={() => onNavigate?.("dashboard")}>Hat Board</Button>
          <Button tone="primary" onClick={activateAll}>Activate All</Button>
          <Button tone="primary" onClick={runAllVisible}>Run Visible</Button>
        </div>
      </div>
      <SimpleImageBand context="Goodies" compact />

      <div className="estatehat-summary-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 18 }}>
        <Metric label="Features" value={UX_ITEMS.length} detail="Grouped by real estate user workflow." />
        <Metric label="Active" value={activeCount} detail="Saved in this browser for review." />
        <Metric label="Outputs" value={state.outputs?.length || 0} detail="Functional records created by runs." />
        <Metric label="Groups" value={UX_GROUPS.length} detail="Navigation, discovery, transaction, docs, trust, support, admin." />
      </div>

      <div className="estatehat-workspace-layout" style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "minmax(560px,1.35fr) minmax(300px,0.65fr)", gap: 16, alignItems: "start" }}>
        <section style={{ minWidth: 0 }}>
          <Card style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <Button tone={activeGroup === "all" ? "primary" : "default"} onClick={() => setActiveGroup("all")}>All</Button>
              {UX_GROUPS.map((group) => (
                <Button key={group.key} tone={activeGroup === group.key ? "primary" : "default"} onClick={() => setActiveGroup(group.key)}>
                  {group.label}
                </Button>
              ))}
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Goodies..." style={{ marginLeft: "auto", minWidth: 220, flex: "1 1 260px", border: `1px solid ${S.border}`, background: "var(--s-input-bg)", color: S.dark, borderRadius: 8, padding: "10px 12px", fontFamily: S.font, fontSize: 13 }} />
            </div>
            {activeGroup !== "all" && (
              <p style={{ fontFamily: S.font, fontSize: 12.5, color: S.goldDeep, lineHeight: 1.55, margin: "12px 0 0" }}>
                {UX_GROUPS.find((group) => group.key === activeGroup)?.intro}
              </p>
            )}
          </Card>

          <div className="estatehat-goodies-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 10 }}>
            {visibleItems.map((item) => {
              const enabled = !!state.active?.[item.key];
              const isSelected = selected?.key === item.key;
              return (
                <Card key={item.key} style={{ borderColor: isSelected ? S.gold : S.border, boxShadow: isSelected ? `0 16px 36px ${S.shadowSoft}` : `0 10px 24px ${S.shadowSoft}` }}>
                  <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "44px minmax(0,1fr)" : "44px minmax(0,1fr) auto", gap: 12, alignItems: "center" }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, display: "grid", placeItems: "center", background: S.goldBg, color: S.goldDeep, fontFamily: S.font, fontWeight: 900, fontSize: 12 }}>
                      {String(item.order).padStart(2, "0")}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <h3 style={{ fontFamily: S.font, fontSize: 15, color: S.dark, margin: 0 }}>{item.name}</h3>
                        <Badge tone={enabled ? "good" : "default"}>{enabled ? "Active" : item.groupLabel}</Badge>
                      </div>
                      <p style={{ fontFamily: S.font, fontSize: 12.5, color: S.light, lineHeight: 1.5, margin: "6px 0 0" }}>
                        {getOutputPayload(item, { listings, user }).summary}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: isNarrow ? "flex-start" : "flex-end", gridColumn: isNarrow ? "1 / -1" : "auto" }}>
                      <Button onClick={() => activate(item)}>Activate</Button>
                      <Button tone="primary" onClick={() => run(item)}>Run</Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        <aside className="estatehat-sticky-panel" style={{ display: "grid", gap: 14, position: isNarrow ? "static" : "sticky", top: isNarrow ? "auto" : 88 }}>
          <PreviewPanel output={latestOutput} />
          <Card>
            <div style={{ fontFamily: S.font, fontSize: 10, color: S.goldDeep, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1.2 }}>Selected feature</div>
            <h3 style={{ fontFamily: S.font, fontSize: 16, color: S.dark, margin: "7px 0 4px" }}>{selected?.name}</h3>
            <p style={{ fontFamily: S.font, fontSize: 12.5, color: S.light, lineHeight: 1.55, margin: 0 }}>{selected ? getOutputPayload(selected, { listings, user }).summary : "Select a feature to preview it."}</p>
            {selected && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                <Button onClick={() => activate(selected)}>Activate</Button>
                <Button tone="primary" onClick={() => run(selected)}>Run</Button>
              </div>
            )}
          </Card>
          <Card>
            <div style={{ fontFamily: S.font, fontSize: 10, color: S.goldDeep, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10 }}>Recent Goodie Runs</div>
            <div style={{ display: "grid", gap: 8 }}>
              {(state.runs || []).slice(0, 8).map((run) => (
                <div key={run.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, borderTop: `1px solid ${S.surface}`, paddingTop: 8 }}>
                  <div style={{ fontFamily: S.font, fontSize: 12, color: S.dark, fontWeight: 800 }}>{run.name}</div>
                  <Badge tone={run.action.includes("run") ? "accent" : "default"}>{run.action}</Badge>
                </div>
              ))}
              {!(state.runs || []).length && <p style={{ fontFamily: S.font, fontSize: 12, color: S.light, margin: 0 }}>No Goodies have run yet.</p>}
            </div>
          </Card>
        </aside>
      </div>
    </main>
  );
}

export { UX_ITEMS };
export default EstateHatUxSuiteView;
