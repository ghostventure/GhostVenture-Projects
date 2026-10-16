import { useMemo, useState } from "react";
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

const MOVE_KIT_GROUPS = [
  {
    key: "transaction",
    label: "Closing Path",
    intro: "Plain next steps for buyers and sellers from accepted offer through closing day.",
    items: [
      ["Closing Confidence Table", "Shows item, owner, due date, status, and plain meaning."],
      ["Deal Timeline With Traffic Lights", "Turns each deal phase green, yellow, or red."],
      ["What Happens Next Panel", "Explains the next task in plain language."],
      ["Closing Day Checklist", "Keeps final IDs, funds, keys, and signatures visible."],
      ["Buyer Milestone Tracker", "Shows buyer steps from offer to recording."],
      ["Seller Milestone Tracker", "Shows seller steps from listing to proceeds."],
      ["Inspection Period Countdown", "Tracks inspection review time left."],
      ["Financing Deadline Countdown", "Shows loan-related deadline pressure."],
      ["Appraisal Status Tracker", "Tracks ordered, received, reviewed, and cleared."],
      ["Final Walk-Through Checklist", "Helps buyers check the property before signing."],
    ],
  },
  {
    key: "documents",
    label: "Forms And Documents",
    intro: "Document clarity, missing paperwork, signatures, versions, and safe sharing.",
    items: [
      ["Plain-English Document Explainer", "Explains what a document is and what to check."],
      ["Missing Document Detector", "Flags expected paperwork that is not uploaded yet."],
      ["Document Readiness Score", "Scores whether a packet is ready to review."],
      ["Signature Needed Queue", "Shows who still needs to sign."],
      ["Form Auto-Fill Review", "Lets users confirm filled fields before using a form."],
      ["Document Version History", "Keeps the latest and older versions easy to compare."],
      ["Closing Packet Preview", "Shows the expected signing packet before closing."],
      ["Upload Quality Checker", "Warns about blurry scans and wrong file types."],
      ["Before Signing Panel", "Lists what to check before signing."],
      ["Document Share Permissions", "Shows who can see each file."],
    ],
  },
  {
    key: "buyer",
    label: "Buyer Help",
    intro: "Buyer confidence tools for offers, affordability, tours, and home comparison.",
    items: [
      ["Offer Strength Meter", "Rates offer clarity, timing, contingencies, and financing."],
      ["First-Time Buyer Mode", "Simplifies wording and explains each step."],
      ["Saved Home Comparison Table", "Compares top homes side by side."],
      ["Monthly Payment Snapshot", "Shows a rough payment view without advice language."],
      ["Can I Afford This Planner", "Organizes price, cash, and recurring cost inputs."],
      ["Commute And Area Notes", "Stores buyer notes for location tradeoffs."],
      ["Renovation Concern Checklist", "Tracks visible repair and upgrade concerns."],
      ["Buyer Question Builder", "Helps users ask better questions."],
      ["Tour Feedback Cards", "Captures likes, concerns, and dealbreakers after tours."],
      ["Home Shortlist Ranking", "Ranks saved homes by buyer preference."],
    ],
  },
  {
    key: "seller",
    label: "Seller Help",
    intro: "Seller preparation, listing quality, showing readiness, and offer review.",
    items: [
      ["Seller Readiness Score", "Checks listing basics before going live."],
      ["Listing Photo Quality Coach", "Flags weak, missing, or duplicate photos."],
      ["Listing Completeness Meter", "Shows missing property facts."],
      ["Showing Availability Grid", "Keeps available showing times clear."],
      ["Seller Repair Notes", "Stores repairs, upgrades, and known issues."],
      ["Price Change Impact Panel", "Shows what changed when price changes."],
      ["Offer Comparison Table", "Compares offer terms in one table."],
      ["Buyer Strength Summary", "Summarizes buyer readiness signals."],
      ["Seller Disclosure Helper", "Organizes disclosure reminders and status."],
      ["Listing Launch Checklist", "Keeps final publish tasks in one place."],
    ],
  },
  {
    key: "trust",
    label: "Trust And Safety",
    intro: "Safety warnings, role controls, permission checks, and support boundaries.",
    items: [
      ["Fair Housing Copy Guard", "Warns when listing language may create a problem."],
      ["Wire Fraud Warning Panel", "Shows safe wire reminders before money movement."],
      ["Identity Review Status", "Shows where account review stands."],
      ["Role Conflict Warning", "Warns when roles should not overlap."],
      ["Permission Access Review", "Shows who can access deal data."],
      ["Sensitive Data Warning", "Flags risky personal or financial information."],
      ["Suspicious Activity Notice", "Shows unusual account or deal behavior."],
      ["Support Scope Reminder", "Explains what support can and cannot do."],
      ["Advice Boundary Notice", "Keeps legal and financial advice boundaries clear."],
      ["Account Safety Health Score", "Summarizes sign-in, role, and data safety."],
    ],
  },
];

export const MOVE_KIT_ITEMS = MOVE_KIT_GROUPS.flatMap((group) =>
  group.items.map(([name, detail], index) => ({
    key: `${group.key}-${index + 1}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
    name,
    detail,
    group: group.key,
    groupLabel: group.label,
    order: 1 + MOVE_KIT_GROUPS.slice(0, MOVE_KIT_GROUPS.findIndex((item) => item.key === group.key)).reduce((sum, item) => sum + item.items.length, 0) + index,
  }))
);

function readState() {
  try {
    const raw = localStorage.getItem("estatehat-move-kit-v1");
    return raw ? JSON.parse(raw) : { active: {}, runs: [] };
  } catch {
    return { active: {}, runs: [] };
  }
}

function writeState(next) {
  try {
    localStorage.setItem("estatehat-move-kit-v1", JSON.stringify(next));
  } catch {
    // Keep the kit usable when local storage is unavailable.
  }
}

function Button({ children, tone = "default", style, ...props }) {
  const palette = tone === "primary"
    ? { background: S.gold, color: S.dark, borderColor: "transparent" }
    : { background: S.card, color: S.muted, borderColor: S.border };
  return (
    <button type="button" style={{ ...palette, border: `1px solid ${palette.borderColor}`, borderRadius: 8, padding: "9px 12px", fontFamily: S.font, fontSize: 12, fontWeight: 800, cursor: "pointer", ...style }} {...props}>
      {children}
    </button>
  );
}

function Card({ children, style, className = "" }) {
  return <section className={`estatehat-no-overlap ${className}`.trim()} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 8, padding: 16, boxShadow: `0 12px 30px ${S.shadowSoft}`, minWidth: 0, ...style }}>{children}</section>;
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

function StatusPill({ children, tone = "default" }) {
  const palette = tone === "active"
    ? { background: S.greenBg, color: S.green }
    : tone === "warn"
      ? { background: S.redBg, color: S.red }
      : { background: S.surface, color: S.muted };
  return <span style={{ ...palette, borderRadius: 999, padding: "4px 9px", fontFamily: S.font, fontSize: 10, fontWeight: 900, textTransform: "uppercase", whiteSpace: "nowrap" }}>{children}</span>;
}

function outputFor(item, user, listings) {
  const sampleHome = listings?.[0]?.title || listings?.[0]?.address || "selected home";
  if (item.group === "transaction") return `${item.name} prepared next-step guidance for ${sampleHome}.`;
  if (item.group === "documents") return `${item.name} organized paperwork status for ${user?.name || "this account"}.`;
  if (item.group === "buyer") return `${item.name} created a buyer-friendly decision aid.`;
  if (item.group === "seller") return `${item.name} created a seller-ready listing aid.`;
  return `${item.name} checked trust, safety, role, or support boundaries.`;
}

export function EstateHatMoveKitView({ onNavigate, user, listings = [] }) {
  const [state, setState] = useState(() => readState());
  const [activeGroup, setActiveGroup] = useState("transaction");
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState(MOVE_KIT_ITEMS[0]?.key || "");
  const activeCount = Object.values(state.active || {}).filter(Boolean).length;
  const selected = MOVE_KIT_ITEMS.find((item) => item.key === selectedKey) || MOVE_KIT_ITEMS[0];
  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MOVE_KIT_ITEMS.filter((item) => item.group === activeGroup)
      .filter((item) => !q || `${item.name} ${item.detail} ${item.groupLabel}`.toLowerCase().includes(q));
  }, [activeGroup, query]);

  function commit(next) {
    setState(next);
    writeState(next);
  }

  function activate(item) {
    const run = {
      id: `${item.key}-${Date.now()}`,
      name: item.name,
      group: item.groupLabel,
      summary: outputFor(item, user, listings),
      createdAt: new Date().toISOString(),
    };
    commit({
      active: { ...(state.active || {}), [item.key]: true },
      runs: [run, ...(state.runs || [])].slice(0, 20),
    });
    setSelectedKey(item.key);
  }

  function activateVisible() {
    const active = { ...(state.active || {}) };
    visibleItems.forEach((item) => {
      active[item.key] = true;
    });
    commit({
      active,
      runs: [
        {
          id: `visible-${Date.now()}`,
          name: `Activated ${visibleItems.length} visible Move Kit items`,
          group: MOVE_KIT_GROUPS.find((group) => group.key === activeGroup)?.label || "Move Kit",
          summary: "Visible items are ready to use in this workspace.",
          createdAt: new Date().toISOString(),
        },
        ...(state.runs || []),
      ].slice(0, 20),
    });
  }

  return (
    <div className="estatehat-responsive-workspace" style={{ maxWidth: 1180, margin: "0 auto", padding: 24 }}>
      <section className="estatehat-workspace-header" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 16, alignItems: "end", marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: S.font, fontSize: 11, color: S.goldDeep, fontWeight: 900, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>EstateHat Move Kit</div>
          <h1 style={{ fontFamily: S.serif, fontSize: 42, lineHeight: 1, color: S.dark, margin: 0 }}>Move Kit</h1>
          <p style={{ fontFamily: S.font, fontSize: 13, color: S.muted, lineHeight: 1.6, maxWidth: 680 }}>
            50 new buyer, seller, document, closing, and trust helpers. These are new installable surfaces, separate from Hat Data and Goodies.
          </p>
        </div>
        <Button tone="primary" onClick={activateVisible}>Activate Visible</Button>
      </section>
      <SimpleImageBand context="Move Kit" compact />

      <section className="estatehat-summary-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 16 }}>
        <Metric label="Installed" value={MOVE_KIT_ITEMS.length} detail="New Move Kit items." />
        <Metric label="Active" value={activeCount} detail="Activated in this browser." />
        <Metric label="Groups" value={MOVE_KIT_GROUPS.length} detail="Closing, documents, buyer, seller, trust." />
      </section>

      <section style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        {MOVE_KIT_GROUPS.map((group) => (
          <button key={group.key} type="button" onClick={() => setActiveGroup(group.key)} style={{ border: `1px solid ${activeGroup === group.key ? S.gold : S.border}`, background: activeGroup === group.key ? S.goldBg : S.card, color: activeGroup === group.key ? S.goldDeep : S.muted, borderRadius: 999, padding: "8px 11px", fontFamily: S.font, fontSize: 12, fontWeight: 900, cursor: "pointer" }}>
            {group.label}
          </button>
        ))}
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Move Kit..." style={{ marginLeft: "auto", minWidth: 220, flex: "1 1 260px", border: `1px solid ${S.border}`, background: "var(--s-input-bg)", color: S.dark, borderRadius: 8, padding: "10px 12px", fontFamily: S.font, fontSize: 13 }} />
      </section>

      <section className="estatehat-workspace-layout" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.25fr) minmax(280px, 0.75fr)", gap: 14 }}>
        <div className="estatehat-tile-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
          {visibleItems.map((item) => (
            <Card key={item.key} style={{ borderColor: selected?.key === item.key ? S.gold : S.border }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ fontFamily: S.font, fontSize: 11, color: S.light, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1.1 }}>#{item.order} {item.groupLabel}</div>
                <StatusPill tone={state.active?.[item.key] ? "active" : "default"}>{state.active?.[item.key] ? "Active" : "Ready"}</StatusPill>
              </div>
              <h3 style={{ fontFamily: S.font, fontSize: 15, color: S.dark, margin: "0 0 8px", lineHeight: 1.3 }}>{item.name}</h3>
              <p style={{ fontFamily: S.font, fontSize: 12.5, color: S.muted, lineHeight: 1.55, margin: "0 0 12px" }}>{item.detail}</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button onClick={() => setSelectedKey(item.key)}>Preview</Button>
                <Button tone="primary" onClick={() => activate(item)}>Activate</Button>
              </div>
            </Card>
          ))}
        </div>
        <aside className="estatehat-sticky-panel" style={{ display: "grid", gap: 12, alignContent: "start" }}>
          <Card>
            <div style={{ fontFamily: S.font, fontSize: 11, color: S.goldDeep, fontWeight: 900, letterSpacing: 1.3, textTransform: "uppercase", marginBottom: 6 }}>Selected Item</div>
            <h2 style={{ fontFamily: S.serif, fontSize: 28, color: S.dark, margin: 0, lineHeight: 1 }}>{selected?.name}</h2>
            <p style={{ fontFamily: S.font, fontSize: 13, color: S.muted, lineHeight: 1.6 }}>{selected?.detail}</p>
            <div style={{ background: S.surfaceAlt, borderRadius: 8, padding: 12, fontFamily: S.font, fontSize: 12.5, color: S.dark, lineHeight: 1.55 }}>
              {selected ? outputFor(selected, user, listings) : "Select a Move Kit item to preview output."}
            </div>
            {selected && <Button tone="primary" onClick={() => activate(selected)} style={{ marginTop: 12 }}>Activate This</Button>}
          </Card>
          <Card>
            <div style={{ fontFamily: S.font, fontSize: 11, color: S.goldDeep, fontWeight: 900, letterSpacing: 1.3, textTransform: "uppercase", marginBottom: 8 }}>Recent Runs</div>
            {(state.runs || []).length === 0 && <p style={{ fontFamily: S.font, fontSize: 12, color: S.light, margin: 0 }}>No Move Kit items have run yet.</p>}
            {(state.runs || []).slice(0, 6).map((run) => (
              <div key={run.id} style={{ borderTop: `1px solid ${S.surface}`, padding: "9px 0", fontFamily: S.font }}>
                <div style={{ fontSize: 12.5, fontWeight: 900, color: S.dark }}>{run.name}</div>
                <div style={{ fontSize: 11.5, color: S.light, marginTop: 3 }}>{run.group}</div>
              </div>
            ))}
          </Card>
          <Button onClick={() => onNavigate?.("help")}>Open Help Center</Button>
        </aside>
      </section>
    </div>
  );
}
