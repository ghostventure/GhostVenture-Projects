import { useEffect, useMemo, useState } from "react";
import { cancelTour, filterTours, makeTour, toTourCalendar, updateTour, validateTourDraft } from "./estatehat-tours";
import { calculateOfferMetrics, createOfferDraft, deleteOfferDraft, exportOfferDrafts, filterOfferDrafts, importOfferDrafts, setOfferStatus, validateOfferDraft } from "./estatehat-offers.js";
import { applyNotificationPreferences, countUnreadNotifications, markNotificationsRead, normalizeNotificationPreferences, toggleNotificationPreference } from "./estatehat-notifications.js";
import { exportVaultIntakeCsv, prepareVaultIntake, removeVaultIntake } from "./estatehat-vault-intake.js";
import { createComparisonSet, deleteComparisonSet, exportComparisonSets, importComparisonSets, renameComparisonSet } from "./estatehat-comparisons.js";

const S = {
  bg: "var(--s-bg)",
  card: "var(--s-card)",
  surface: "var(--s-surface)",
  surfaceAlt: "var(--s-surface-alt)",
  dark: "var(--s-dark)",
  mid: "var(--s-mid)",
  muted: "var(--s-muted)",
  light: "var(--s-light)",
  border: "var(--s-border)",
  borderStrong: "var(--s-border-strong)",
  gold: "var(--s-gold)",
  goldDeep: "var(--s-gold-deep)",
  green: "var(--s-green)",
  red: "var(--s-red)",
  greenBg: "var(--s-greenBg)",
  redBg: "var(--s-redBg)",
  goldBg: "var(--s-goldBg)",
  nav: "var(--s-nav)",
  overlay: "var(--s-overlay)",
  shadowSoft: "var(--s-shadow-soft)",
  shadowStrong: "var(--s-shadow-strong)",
  font: "'Plus Jakarta Sans', sans-serif",
  serif: "'DM Serif Display', serif",
  btn: (bg, color) => ({ background: bg, color, border: "1px solid transparent", borderRadius: 8, padding: "10px 16px", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 13, cursor: "pointer" }),
  input: { width: "100%", padding: "12px 14px", border: "1px solid var(--s-input-border)", borderRadius: 8, fontSize: 14, fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none", boxSizing: "border-box", background: "var(--s-input-bg)", color: "var(--s-dark)" },
  label: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 800, color: "var(--s-muted)", display: "block", marginBottom: 6, marginTop: 14 },
};

const fmt = (value = 0) => "$" + Math.round(Number(value) || 0).toLocaleString();
const fee = (price = 0) => Math.round((Number(price) || 0) * 0.015 + 650 + 75);
function useLocalState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });
  function setPersisted(next) {
    setValue((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      try {
        localStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        // Keep in memory if storage is unavailable.
      }
      return resolved;
    });
  }
  return [value, setPersisted];
}

function useMediaQuery(query) {
  const getMatch = () => (typeof window !== "undefined" ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(getMatch);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

function Card({ children, style, ...rest }) {
  return <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 18, boxShadow: `0 10px 28px ${S.shadowSoft}`, ...style }} {...rest}>{children}</div>;
}

function Badge({ children, tone = "default" }) {
  const map = {
    default: { background: S.surface, color: S.muted },
    good: { background: S.greenBg, color: S.green },
    warn: { background: S.redBg, color: S.red },
    accent: { background: S.goldBg, color: S.goldDeep },
  };
  return <span style={{ ...(map[tone] || map.default), borderRadius: 999, padding: "3px 9px", fontFamily: S.font, fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", whiteSpace: "nowrap" }}>{children}</span>;
}

function Header({ title, sub }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontFamily: S.serif, fontSize: 32, color: S.dark, margin: "0 0 5px", lineHeight: 1 }}>{title}</h2>
      {sub && <p style={{ fontFamily: S.font, fontSize: 14, color: S.light, margin: 0, lineHeight: 1.55 }}>{sub}</p>}
    </div>
  );
}

function Tabs({ tabs, active, onSelect }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
      {tabs.map((tab) => (
        <button key={tab.key} onClick={() => onSelect(tab.key)} style={{ ...S.btn(active === tab.key ? S.dark : S.card, active === tab.key ? S.card : S.muted), borderColor: active === tab.key ? S.dark : S.border }}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function EmptyState({ title, body, actionLabel, onAction }) {
  return (
    <Card style={{ textAlign: "center", padding: 28 }}>
      <div style={{ fontFamily: S.font, fontSize: 15, fontWeight: 900, color: S.dark }}>{title}</div>
      <div style={{ fontFamily: S.font, fontSize: 13, color: S.light, lineHeight: 1.55, marginTop: 6 }}>{body}</div>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction} style={{ ...S.btn(S.gold, S.dark), marginTop: 16 }}>
          {actionLabel}
        </button>
      )}
    </Card>
  );
}

export function ToastHost({ toasts = [], onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div style={{ position: "fixed", right: 18, bottom: 18, zIndex: 260, display: "grid", gap: 10, width: "min(360px, calc(100vw - 36px))" }}>
      {toasts.map((toast) => (
        <div key={toast.id} style={{ background: S.card, border: `1px solid ${toast.tone === "error" ? S.red : toast.tone === "success" ? S.green : S.border}`, borderLeft: `4px solid ${toast.tone === "error" ? S.red : toast.tone === "success" ? S.green : S.gold}`, borderRadius: 10, padding: "12px 14px", boxShadow: `0 22px 50px ${S.shadowStrong}`, display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontFamily: S.font, fontSize: 13, fontWeight: 800, color: S.dark }}>{toast.title}</div>
            {toast.message && <div style={{ fontFamily: S.font, fontSize: 12, color: S.light, lineHeight: 1.45, marginTop: 3 }}>{toast.message}</div>}
          </div>
          <button onClick={() => onDismiss(toast.id)} style={{ border: "none", background: "transparent", color: S.light, cursor: "pointer", fontSize: 16 }}>x</button>
        </div>
      ))}
    </div>
  );
}

export function ConfirmDialog({ request, onCancel, onConfirm }) {
  if (!request) return null;
  return (
    <>
      <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: S.overlay, zIndex: 240 }} />
      <div role="dialog" aria-modal="true" style={{ position: "fixed", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: "min(460px, calc(100vw - 32px))", background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, boxShadow: `0 30px 90px ${S.shadowStrong}`, zIndex: 241, padding: 22 }}>
        <div style={{ fontFamily: S.serif, fontSize: 28, color: S.dark, marginBottom: 8 }}>{request.title || "Confirm action"}</div>
        <div style={{ fontFamily: S.font, fontSize: 13, color: S.muted, lineHeight: 1.6, marginBottom: 18 }}>{request.message}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
          <button onClick={onCancel} style={{ ...S.btn(S.surfaceAlt, S.muted), borderColor: S.border }}>Cancel</button>
          <button onClick={onConfirm} style={{ ...S.btn(request.danger ? S.red : S.gold, request.danger ? "#fff" : S.dark) }}>{request.confirmLabel || "Confirm"}</button>
        </div>
      </div>
    </>
  );
}

export function UniversalSearchView({ onNavigate, listings = [], savedSearches = [], recentViewedIds = [], docs = [], deals = [] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const pages = [
    ["Notification Center", "notifications", "Offers, tasks, messages, compliance"],
    ["Document Vault", "documents", "Deal, listing, identity, and billing files"],
    ["Property Comparison", "compare", "Compare saved or live listings"],
    ["Tour Scheduler", "tours", "Showing and inspection appointments"],
    ["Offer Composer", "offer", "Draft purchase terms"],
    ["Admin Workbench", "admin-workbench", "Bulk review and operational tables"],
  ].filter(([label, , meta]) => `${label} ${meta}`.toLowerCase().includes(q));
  const listingHits = listings.filter((item) => `${item.title} ${item.address} ${item.type}`.toLowerCase().includes(q)).slice(0, 8);
  const dealHits = deals.filter((item) => `${item.id} ${item.property} ${item.phase}`.toLowerCase().includes(q)).slice(0, 5);
  const docHits = docs.filter((item) => `${item.docName} ${item.property} ${item.transaction}`.toLowerCase().includes(q)).slice(0, 5);
  const recent = recentViewedIds.map((id) => listings.find((item) => item.id === id)).filter(Boolean).slice(0, 4);

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: 24 }}>
      <Header title="Universal Search" sub="Search listings, deals, documents, pages, and operational workspaces." />
      <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by address, deal ID, document, page, or task..." style={{ ...S.input, fontSize: 16, padding: "16px 18px", marginBottom: 18 }} />
      {!q && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
          {[
            ["Recent Views", recent.map((item) => item.title).join(", ") || "No recent listings yet", "browse"],
            ["Saved Searches", savedSearches.length ? `${savedSearches.length} saved search presets` : "Create one from Browse", "browse"],
            ["Active Deals", deals.length ? `${deals.length} transaction workflows` : "No live transaction feed connected", "transaction"],
            ["Documents", docs.length ? `${docs.length} reviewable files` : "No live document feed connected", "documents"],
          ].map(([title, body, target]) => (
            <Card key={title} onClick={() => onNavigate(target)} style={{ cursor: "pointer" }}>
              <div style={{ fontFamily: S.font, fontSize: 14, fontWeight: 800, color: S.dark }}>{title}</div>
              <div style={{ fontFamily: S.font, fontSize: 12.5, color: S.light, lineHeight: 1.5, marginTop: 6 }}>{body}</div>
            </Card>
          ))}
        </div>
      )}
      {q && <ResultGroups groups={[
        ["Pages", pages.map(([label, view, meta]) => ({ label, meta, action: () => onNavigate(view) }))],
        ["Listings", listingHits.map((item) => ({ label: item.title, meta: `${fmt(item.price)} · ${item.address}`, action: () => onNavigate(item.source === "deal" ? "transaction" : "detail", item.id) }))],
        ["Deals", dealHits.map((item) => ({ label: item.id, meta: `${item.property} · ${item.phase}`, action: () => onNavigate("transaction") }))],
        ["Documents", docHits.map((item) => ({ label: item.docName, meta: `${item.transaction} · ${item.property}`, action: () => onNavigate("documents", item.id) }))],
      ]} />}
    </div>
  );
}

function ResultGroups({ groups }) {
  const visible = groups.filter(([, items]) => items.length);
  if (!visible.length) return <Card style={{ textAlign: "center", fontFamily: S.font, color: S.light }}>No matching EstateHat result.</Card>;
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {visible.map(([title, items]) => (
        <Card key={title}>
          <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: S.light, marginBottom: 10 }}>{title}</div>
          {items.map((item) => (
            <button key={`${title}-${item.label}`} onClick={item.action} style={{ width: "100%", border: "none", borderTop: `1px solid ${S.surface}`, background: "transparent", padding: "12px 0", textAlign: "left", cursor: "pointer" }}>
              <div style={{ fontFamily: S.font, fontSize: 14, fontWeight: 800, color: S.dark }}>{item.label}</div>
              <div style={{ fontFamily: S.font, fontSize: 12, color: S.light, marginTop: 3 }}>{item.meta}</div>
            </button>
          ))}
        </Card>
      ))}
    </div>
  );
}

export function NotificationCenterView({ onNavigate, notify = () => {}, userKey = "guest" }) {
  const safeUserKey = String(userKey || "guest").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100);
  const [filter, setFilter] = useState("all");
  const [readIds, setReadIds] = useLocalState(`estatehat-read-notifications-v1-${safeUserKey}`, []);
  const [dismissedIds, setDismissedIds] = useLocalState(`estatehat-dismissed-notifications-v1-${safeUserKey}`, []);
  const [preferences, setPreferences] = useLocalState(`estatehat-notification-preferences-v1-${safeUserKey}`, normalizeNotificationPreferences());
  const [offers] = useLocalState(`estatehat-offers-v1-${safeUserKey}`, []);
  const [tours] = useLocalState(`estatehat-tours-v1-${safeUserKey}`, []);
  const [uploads] = useLocalState(`estatehat-vault-uploads-v1-${safeUserKey}`, []);
  const notifications = [
    ...offers.map((offer) => ({ id: `offer-${offer.id}`, type: "offer", title: "Offer draft saved", body: `${offer.property} · ${fmt(offer.price)}`, priority: "medium", time: offer.savedAtLabel || "Saved", target: "offer" })),
    ...tours.map((tour) => ({ id: `tour-${tour.id}`, type: "task", title: "Appointment scheduled", body: `${tour.property} · ${tour.date} at ${tour.time}`, priority: "medium", time: tour.date || "Scheduled", target: "tours" })),
    ...uploads.map((upload, index) => ({ id: `upload-${upload.id || index}-${upload.name}`, type: "document", title: upload.isLocalIntake ? "Local document intake recorded" : "Vault upload queued", body: upload.isLocalIntake ? `${upload.name} · metadata only; no file uploaded` : `${upload.name} · ${upload.size || "file"}`, priority: "medium", time: upload.time || "Recorded", target: "documents" })),
  ];
  const enabledNotifications = applyNotificationPreferences(notifications, preferences).filter((item) => !dismissedIds.includes(item.id));
  const visible = filter === "all" ? enabledNotifications : enabledNotifications.filter((item) => item.type === filter);
  const unreadCount = countUnreadNotifications(enabledNotifications, readIds);
  function open(item) {
    setReadIds((current) => current.includes(item.id) ? current : [...current, item.id]);
    notify({ title: "Notification opened", message: item.title, tone: "success" });
    onNavigate(item.target);
  }
  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
      <Header title="Notification Center" sub={`${unreadCount} unread · In-app records from this profile's saved drafts and browser activity.`} />
      <Card title="In-app notification preferences" kicker="This profile" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>{[["offer", "Offer drafts"], ["task", "Appointments"], ["document", "Document queue"]].map(([type, label]) => <label key={type} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: S.dark, fontFamily: S.font, fontSize: 12 }}><input type="checkbox" checked={preferences[type] !== false} onChange={() => setPreferences((current) => toggleNotificationPreference(current, type))} />{label}</label>)}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}><button type="button" onClick={() => setReadIds((current) => markNotificationsRead(enabledNotifications, current))} disabled={!unreadCount} style={{ ...S.btn(S.surfaceAlt, S.dark), borderColor: S.border }}>Mark all read</button><button type="button" onClick={() => { setDismissedIds((current) => [...new Set([...current, ...enabledNotifications.filter((item) => readIds.includes(item.id)).map((item) => item.id)])]); }} disabled={!enabledNotifications.some((item) => readIds.includes(item.id))} style={{ ...S.btn(S.surfaceAlt, S.muted), borderColor: S.border }}>Clear read</button></div>
      </Card>
      <Tabs tabs={["all", "offer", "document", "task", "message", "compliance"].map((key) => ({ key, label: key === "all" ? "All" : key }))} active={filter} onSelect={setFilter} />
      <div style={{ display: "grid", gap: 12 }}>
        {visible.length === 0 && <EmptyState title="No notifications" body="Live notifications will appear after a saved offer, scheduled tour, uploaded document, message, or connected compliance event." />}
        {visible.map((item) => (
          <Card key={item.id} onClick={() => open(item)} style={{ cursor: "pointer", borderLeft: `4px solid ${item.priority === "high" ? S.red : S.gold}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 5 }}>
                  {!readIds.includes(item.id) && <span style={{ width: 8, height: 8, borderRadius: 99, background: S.gold }} />}
                  <div style={{ fontFamily: S.font, fontSize: 15, fontWeight: 800, color: S.dark }}>{item.title}</div>
                  <Badge tone={item.priority === "high" ? "warn" : "default"}>{item.type}</Badge>
                </div>
                <div style={{ fontFamily: S.font, fontSize: 13, color: S.muted, lineHeight: 1.5 }}>{item.body}</div>
              </div>
              <div style={{ fontFamily: S.font, fontSize: 11, color: S.light, whiteSpace: "nowrap" }}>{item.time}</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function DocumentVaultView({ initialDocId, notify = () => {}, docs = [], deals = [], userKey = "guest" }) {
  const isCompact = useMediaQuery("(max-width: 900px)");
  const safeUserKey = String(userKey || "guest").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100);
  const [category, setCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState("recent");
  const [query, setQuery] = useState("");
  const [uploads, setUploads] = useLocalState(`estatehat-vault-uploads-v1-${safeUserKey}`, []);
  const [uploadProfile, setUploadProfile] = useState({ category: "transaction", docType: "Purchase contract", priority: "high" });
  const [selectedId, setSelectedId] = useState(initialDocId || docs[0]?.id);
  const allDocs = useMemo(() => [
    ...docs.map((doc) => ({
      ...doc,
      category: doc.category || (doc.transaction === "N/A" ? "listing" : "transaction"),
      status: doc.status || "pending",
      priority: doc.priority || (doc.flags?.length ? "high" : "medium"),
      dueLabel: doc.dueLabel || (doc.status === "approved" ? "Ready" : doc.flags?.length ? "Resolve before closing" : "Review within 24h"),
      reviewOwner: doc.reviewOwner || (doc.status === "approved" ? "Closing desk" : "Document review"),
      versionCount: doc.versionCount || 1,
      signersPending: doc.signersPending ?? Math.max((doc.parties?.length || 1) - (doc.status === "approved" ? (doc.parties?.length || 1) : 1), 0),
      checklist: doc.checklist || [],
    })),
    ...uploads.map((doc, index) => ({
      id: doc.id || `UP-${index}`,
      transaction: doc.transaction || "Not linked",
      property: doc.property || "Not linked",
      docName: doc.name,
      docType: doc.docType || doc.type || "Uploaded File",
      uploadedBy: "You",
      uploadedRole: "browser session",
      uploaded: doc.time,
      pages: doc.pages || 1,
      status: "intake",
      flags: doc.flags || [],
      parties: doc.parties || ["You"],
      category: doc.category || "identity",
      priority: doc.priority || "medium",
      dueLabel: "Not yet uploaded",
      reviewOwner: "Browser-only intake",
      versionCount: doc.versionCount || 1,
      signersPending: doc.signersPending ?? 1,
      checklist: [{ label: "File name and metadata recorded in this browser", done: true }, { label: "Document contents uploaded to EstateHat", done: false }],
      intakeNotes: "Only file metadata is saved. File contents have not been uploaded or stored by EstateHat.",
      isLocalIntake: true,
    })),
  ], [docs, uploads]);
  const filtered = useMemo(() => {
    let next = category === "all" ? allDocs : allDocs.filter((doc) => doc.category === category);
    if (statusFilter !== "all") next = next.filter((doc) => doc.status === statusFilter);
    const q = query.trim().toLowerCase();
    if (q) {
      next = next.filter((doc) => `${doc.docName} ${doc.docType} ${doc.property} ${doc.transaction} ${doc.uploadedBy} ${doc.reviewOwner}`.toLowerCase().includes(q));
    }
    return [...next].sort((a, b) => {
      if (sortKey === "name") return String(a.docName).localeCompare(String(b.docName));
      if (sortKey === "status") return String(a.status).localeCompare(String(b.status));
      if (sortKey === "priority") {
        const order = { high: 0, medium: 1, low: 2 };
        return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
      }
      return String(b.uploaded || "").localeCompare(String(a.uploaded || ""));
    });
  }, [allDocs, category, query, sortKey, statusFilter]);
  const visible = filtered;
  const selected = allDocs.find((doc) => doc.id === selectedId) || visible[0];
  const metrics = useMemo(() => {
    const source = category === "all" ? allDocs : allDocs.filter((doc) => doc.category === category);
    const providerDocs = source.filter((doc) => !doc.isLocalIntake);
    const approvals = providerDocs.filter((doc) => doc.status === "approved").length;
    const blocked = providerDocs.filter((doc) => doc.flags?.length || doc.status === "rejected").length;
    const pending = providerDocs.filter((doc) => doc.status === "pending").length;
    return {
      approvals,
      blocked,
      pending,
      intake: source.filter((doc) => doc.isLocalIntake).length,
      providerTotal: providerDocs.length,
      readiness: providerDocs.length ? Math.round((approvals / providerDocs.length) * 100) : null,
    };
  }, [allDocs, category]);
  function upload(event) {
    const now = new Date();
    const context = {
      category: uploadProfile.category,
      docType: uploadProfile.docType,
      priority: uploadProfile.priority,
      property: deals[0]?.property || "",
      transaction: deals[0]?.id || "",
    };
    const result = prepareVaultIntake(event.target.files, context, uploads, now);
    if (result.rejected.length) notify({ title: "Some files were not added", message: result.rejected.map((item) => `${item.name}: ${item.reason}`).join(" "), tone: "error" });
    if (result.added.length) notify({ title: "Local intake records added", message: `${result.added.length} file metadata record${result.added.length === 1 ? "" : "s"} saved in this browser. No document was uploaded.`, tone: "success" });
    setUploads((current) => [...result.added, ...current].slice(0, 12));
    if (!selectedId && result.added[0]) setSelectedId(result.added[0].id);
    event.target.value = "";
  }
  return (
    <div style={{ maxWidth: 1120, margin: "0 auto", padding: 24 }}>
      <Header title="Document Vault" sub="Review connected records and manage local file-intake metadata. Document storage and e-sign integrations are not connected in this build." />
      <Tabs tabs={["all", "transaction", "listing", "identity"].map((key) => ({ key, label: key }))} active={category} onSelect={setCategory} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginBottom: 18 }}>
        {[
          ["Provider Review Readiness", metrics.readiness === null ? "N/A" : `${metrics.readiness}%`, metrics.providerTotal ? `${metrics.approvals}/${metrics.providerTotal} provider-backed documents approved` : "No connected document review feed", "good"],
          ["Pending Review", String(metrics.pending), "Needs review, signatures, or indexing", "accent"],
          ["Blocked Items", String(metrics.blocked), "Flags or rejected packets need attention", metrics.blocked ? "warn" : "good"],
          ["Browser Intake Records", String(metrics.intake), "Metadata only; files are not uploaded", "default"],
          ["Visible Queue", String(visible.length), query ? "Filtered search results" : "Current working set", "default"],
        ].map(([label, value, body, tone]) => (
          <Card key={label} style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 900, color: S.light }}>{label}</div>
              <Badge tone={tone === "default" ? "default" : tone}>{tone === "good" ? "ready" : tone === "warn" ? "blocked" : tone === "accent" ? "active" : "visible"}</Badge>
            </div>
            <div style={{ fontFamily: S.serif, fontSize: 28, lineHeight: 1, color: S.dark, marginTop: 10 }}>{value}</div>
            <div style={{ fontFamily: S.font, fontSize: 12.5, lineHeight: 1.5, color: S.light, marginTop: 6 }}>{body}</div>
          </Card>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1.1fr 0.9fr", gap: 18 }}>
        <div style={{ display: "grid", gap: 16 }}>
          <Card>
            <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "repeat(3,minmax(0,1fr))", gap: 12 }}>
              <div>
                <label style={{ ...S.label, marginTop: 0 }}>Upload category</label>
                <select value={uploadProfile.category} onChange={(event) => setUploadProfile((current) => ({ ...current, category: event.target.value }))} style={S.input}>
                  <option value="transaction">Transaction</option>
                  <option value="listing">Listing</option>
                  <option value="identity">Identity</option>
                </select>
              </div>
              <div>
                <label style={{ ...S.label, marginTop: 0 }}>Packet type</label>
                <select value={uploadProfile.docType} onChange={(event) => setUploadProfile((current) => ({ ...current, docType: event.target.value }))} style={S.input}>
                  <option>Purchase contract</option>
                  <option>Disclosure packet</option>
                  <option>Proof of funds</option>
                  <option>ID verification</option>
                  <option>Closing statement</option>
                </select>
              </div>
              <div>
                <label style={{ ...S.label, marginTop: 0 }}>Review priority</label>
                <select value={uploadProfile.priority} onChange={(event) => setUploadProfile((current) => ({ ...current, priority: event.target.value }))} style={S.input}>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
            <label style={S.label}>Record file metadata in this browser</label>
            <input aria-label="Select files for local intake" type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" onChange={upload} style={S.input} />
            <p style={{ color: S.muted, fontFamily: S.font, fontSize: 11, lineHeight: 1.5 }}>This intake queue keeps file name/type/size metadata in this browser only. Files are not sent to EstateHat, and no review, signature, or release workflow is started.</p>
            <button type="button" disabled={!uploads.length} onClick={() => { const url = URL.createObjectURL(new Blob([exportVaultIntakeCsv(uploads)], { type: "text/csv;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "estatehat-local-intake.csv"; anchor.click(); URL.revokeObjectURL(url); }} style={{ ...S.btn(S.surfaceAlt, S.dark), borderColor: S.border }}>Export intake metadata CSV</button>
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10 }}>
              {[
                ["Review owner", uploadProfile.category === "identity" ? "Verification desk" : "Document review"],
                ["SLA", uploadProfile.priority === "high" ? "Same-day release" : "24h release target"],
                ["Required next step", uploadProfile.category === "listing" ? "Attach listing context" : "Confirm metadata and parties"],
              ].map(([label, value]) => (
                <div key={label} style={{ background: S.surfaceAlt, border: `1px solid ${S.border}`, borderRadius: 8, padding: 12 }}>
                  <div style={{ fontFamily: S.font, fontSize: 10.5, letterSpacing: 1.1, textTransform: "uppercase", color: S.light, fontWeight: 900 }}>{label}</div>
                  <div style={{ fontFamily: S.font, fontSize: 12.5, color: S.dark, fontWeight: 800, marginTop: 6 }}>{value}</div>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1.2fr 0.8fr 0.8fr", gap: 10 }}>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search file, property, transaction, reviewer..." style={{ ...S.input, marginTop: 0 }} />
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={S.input}>
                <option value="all">All statuses</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
                <option value="intake">Browser intake</option>
              </select>
              <select value={sortKey} onChange={(event) => setSortKey(event.target.value)} style={S.input}>
                <option value="recent">Most recent</option>
                <option value="priority">Priority</option>
                <option value="status">Status</option>
                <option value="name">Name</option>
              </select>
            </div>
            <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
              {visible.length === 0 && <EmptyState title="No documents in this view" body="Try another category or status filter, or upload a packet to seed the vault queue." />}
              {visible.map((doc) => (
                <button key={doc.id} onClick={() => setSelectedId(doc.id)} style={{ textAlign: "left", border: `1px solid ${selected?.id === doc.id ? S.gold : S.border}`, borderRadius: 8, background: selected?.id === doc.id ? S.goldBg : S.card, padding: 12, cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: S.font, fontSize: 13, fontWeight: 800, color: S.dark, lineHeight: 1.4 }}>{doc.docName}</div>
                      <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.light, marginTop: 4 }}>{doc.transaction} · {doc.property}</div>
                    </div>
                    <div style={{ display: "grid", gap: 6, justifyItems: "end", flexShrink: 0 }}>
                      <Badge tone={doc.status === "approved" ? "good" : doc.status === "rejected" ? "warn" : "accent"}>{doc.status}</Badge>
                      <Badge tone={doc.priority === "high" ? "warn" : doc.priority === "low" ? "default" : "accent"}>{doc.priority}</Badge>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8, marginTop: 10 }}>
                    {[
                      ["Type", doc.docType],
                      ["Review owner", doc.reviewOwner],
                      ["Due", doc.dueLabel],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <div style={{ fontFamily: S.font, fontSize: 10.5, letterSpacing: 1.1, textTransform: "uppercase", color: S.light, fontWeight: 900 }}>{label}</div>
                        <div style={{ fontFamily: S.font, fontSize: 12, color: S.dark, marginTop: 4 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>
        <DocumentPreview doc={selected} onRemove={selected?.isLocalIntake ? () => { setUploads((current) => removeVaultIntake(current, selected.id)); setSelectedId(""); } : undefined} />
      </div>
    </div>
  );
}

function DocumentPreview({ doc, onRemove }) {
  if (!doc) return <Card>No document selected.</Card>;
  const checklist = doc.checklist?.length ? doc.checklist : [
    { label: "Metadata captured", done: true },
    { label: "Review routed", done: doc.status !== "pending" },
    { label: "Parties released", done: doc.status === "approved" },
  ];
  const timeline = [
    { label: doc.isLocalIntake ? "Local record created" : "Uploaded", detail: doc.uploaded || "Queued", tone: "good" },
    { label: doc.isLocalIntake ? "Intake metadata" : "Metadata indexed", detail: `${doc.docType || "Document"} categorized under ${doc.category || "vault"} files`, tone: "good" },
    { label: "Review owner", detail: `${doc.reviewOwner || "Document review"} · ${doc.dueLabel || "Awaiting release"}`, tone: doc.priority === "high" ? "warn" : "accent" },
    { label: "Signature status", detail: doc.isLocalIntake ? "Not connected; no signer or reviewer workflow has started" : doc.status === "approved" ? "All required signatures or approvals complete" : `${doc.signersPending || 0} signer${doc.signersPending === 1 ? "" : "s"} or reviewer action remaining`, tone: doc.isLocalIntake ? "default" : doc.status === "approved" ? "good" : "accent" },
    { label: "Audit trail", detail: doc.flags?.length ? `${doc.flags.length} flag${doc.flags.length === 1 ? "" : "s"} attached for review` : "No active flags", tone: doc.flags?.length ? "warn" : "good" },
  ];
  const completion = Math.round((checklist.filter((item) => item.done).length / checklist.length) * 100);
  return (
    <Card style={{ minHeight: 520 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: 1.3, textTransform: "uppercase", color: S.light, fontWeight: 800 }}>{doc.isLocalIntake ? "Local Intake Record" : "Document Preview"}</div>
          <div style={{ fontFamily: S.serif, fontSize: 25, color: S.dark, lineHeight: 1.05, marginTop: 4 }}>{doc.docName}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <Badge tone={doc.isLocalIntake ? "default" : doc.status === "approved" ? "good" : doc.status === "rejected" ? "warn" : "accent"}>{doc.isLocalIntake ? "local intake" : doc.status}</Badge>
            <Badge tone={doc.priority === "high" ? "warn" : doc.priority === "low" ? "default" : "accent"}>{doc.priority} priority</Badge>
            <Badge tone="default">{doc.category || "vault"}</Badge>
          </div>
        </div>
        <div style={{ minWidth: 180, flex: "0 0 180px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: S.font, fontSize: 11.5, color: S.muted, marginBottom: 8 }}>
            <span>Release readiness</span>
            <strong style={{ color: S.dark }}>{completion}%</strong>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: S.surface, overflow: "hidden" }}>
            <div style={{ width: `${completion}%`, height: "100%", background: completion === 100 ? S.green : S.gold }} />
          </div>
        </div>
      </div>
      <div style={{ height: 186, borderRadius: 8, border: `1px dashed ${S.borderStrong}`, background: S.surfaceAlt, display: "grid", placeItems: "center", marginBottom: 14, padding: 18 }}>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <div style={{ fontFamily: S.font, fontSize: 15, fontWeight: 900, letterSpacing: 1.2, color: S.muted }}>{doc.isLocalIntake ? "METADATA ONLY" : "DOCUMENT PACKET"}</div>
          <div style={{ fontFamily: S.font, fontSize: 13, color: S.muted, fontWeight: 800, marginTop: 8 }}>{doc.isLocalIntake ? `${doc.size || "File details recorded"} · content not available in this vault` : `${doc.pages || 1} page preview · version ${doc.versionCount || 1}`}</div>
          <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.light, marginTop: 8, lineHeight: 1.5 }}>{doc.intakeNotes || "Preview metadata is available. Connected file rendering will appear here once the document service provides a storage URL."}</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12, marginBottom: 16 }}>
        <div style={{ background: S.surfaceAlt, border: `1px solid ${S.border}`, borderRadius: 8, padding: 12 }}>
          <div style={{ fontFamily: S.font, fontSize: 10.5, letterSpacing: 1.2, textTransform: "uppercase", color: S.light, fontWeight: 900, marginBottom: 8 }}>Packet Facts</div>
          {[
            ["Type", doc.docType],
            ["Property", doc.property],
            ["Transaction", doc.transaction],
            ["Added by", `${doc.uploadedBy} (${doc.uploadedRole})`],
            ["Uploaded", doc.uploaded],
          ].map(([label, value]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderTop: `1px solid ${S.border}`, fontFamily: S.font, fontSize: 12 }}>
              <span style={{ color: S.light }}>{label}</span>
              <span style={{ color: S.dark, fontWeight: 700, textAlign: "right" }}>{value}</span>
            </div>
          ))}
        </div>
        <div style={{ background: S.surfaceAlt, border: `1px solid ${S.border}`, borderRadius: 8, padding: 12 }}>
          <div style={{ fontFamily: S.font, fontSize: 10.5, letterSpacing: 1.2, textTransform: "uppercase", color: S.light, fontWeight: 900, marginBottom: 8 }}>Parties And Routing</div>
          <div style={{ display: "grid", gap: 8 }}>
            {(doc.parties?.length ? doc.parties : ["You"]).map((party) => (
              <div key={party} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", borderTop: `1px solid ${S.border}`, paddingTop: 8 }}>
                <div style={{ fontFamily: S.font, fontSize: 12.5, color: S.dark, fontWeight: 800 }}>{party}</div>
                <Badge tone={doc.isLocalIntake ? "default" : doc.status === "approved" ? "good" : party === "You" ? "good" : "accent"}>{doc.isLocalIntake ? "local record" : doc.status === "approved" ? "released" : party === "You" ? "uploaded" : "pending"}</Badge>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${S.border}`, fontFamily: S.font, fontSize: 12.5, color: S.light, lineHeight: 1.5 }}>
            Owner: <strong style={{ color: S.dark }}>{doc.reviewOwner || "Document review"}</strong><br />
            Due: <strong style={{ color: S.dark }}>{doc.dueLabel || "Awaiting release"}</strong>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 16, borderTop: `1px solid ${S.border}`, paddingTop: 14 }}>
        <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: 1.3, textTransform: "uppercase", color: S.light, fontWeight: 900, marginBottom: 10 }}>Release Checklist</div>
        <div style={{ display: "grid", gap: 8 }}>
          {checklist.map((item) => (
            <div key={item.label} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", background: item.done ? S.greenBg : S.surfaceAlt, border: `1px solid ${item.done ? "transparent" : S.border}`, borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontFamily: S.font, fontSize: 12.5, color: S.dark, fontWeight: 700 }}>{item.label}</div>
              <Badge tone={item.done ? "good" : "accent"}>{item.done ? "done" : "next"}</Badge>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 16, borderTop: `1px solid ${S.border}`, paddingTop: 14 }}>
        <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: 1.3, textTransform: "uppercase", color: S.light, fontWeight: 900, marginBottom: 10 }}>Version And Audit Timeline</div>
        <div style={{ display: "grid", gap: 10 }}>
          {timeline.map((item, index) => (
            <div key={item.label} style={{ display: "grid", gridTemplateColumns: "22px 1fr", gap: 10 }}>
              <div>
                <div style={{ width: 14, height: 14, borderRadius: 99, background: item.tone === "warn" ? S.red : item.tone === "good" ? S.green : S.gold, marginTop: 2 }} />
                {index < timeline.length - 1 && <div style={{ width: 2, height: 26, background: S.border, marginLeft: 6, marginTop: 2 }} />}
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ fontFamily: S.font, fontSize: 12.5, fontWeight: 900, color: S.dark }}>{item.label}</div>
                  <Badge tone={item.tone}>{item.tone === "good" ? "ready" : item.tone === "warn" ? "review" : "pending"}</Badge>
                </div>
                <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.light, lineHeight: 1.45, marginTop: 2 }}>{item.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {doc.flags?.length > 0 && <div style={{ marginTop: 12, display: "grid", gap: 6 }}>{doc.flags.map((flag) => <div key={flag} style={{ background: S.redBg, color: S.red, borderRadius: 8, padding: "8px 10px", fontFamily: S.font, fontSize: 12 }}>Flag: {flag}</div>)}</div>}
      {onRemove && <button type="button" onClick={onRemove} style={{ ...S.btn(S.surfaceAlt, S.muted), borderColor: S.border, marginTop: 14 }}>Remove local intake record</button>}
    </Card>
  );
}

export function TransactionMilestonesView({ onNavigate, deals = [] }) {
  const isCompact = useMediaQuery("(max-width: 900px)");
  const [activeDealId, setActiveDealId] = useState(deals[0]?.id);
  const deal = deals.find((item) => item.id === activeDealId) || deals[0];
  if (!deal) return <div style={{ maxWidth: 1040, margin: "0 auto", padding: 24 }}><EmptyState title="No active timeline" body="No transaction milestones are available for this account yet." /></div>;
  const checklist = Object.entries(deal.checklist || {});
  const complete = checklist.filter(([, done]) => done).length;
  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: 24 }}>
      <Header title="Transaction Timeline" sub="Milestones, blockers, and the next best action for each active hat." />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>{deals.map((item) => <button key={item.id} onClick={() => setActiveDealId(item.id)} style={{ ...S.btn(item.id === deal.id ? S.gold : S.card, item.id === deal.id ? S.dark : S.muted), borderColor: S.border }}>{item.id}</button>)}</div>
      <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "0.9fr 1.1fr", gap: 16 }}>
        <Card>
          <div style={{ fontFamily: S.serif, fontSize: 27, color: S.dark }}>{deal.property}</div>
          <div style={{ fontFamily: S.font, color: S.light, fontSize: 13, marginTop: 6 }}>{fmt(deal.price)} · {deal.phase}</div>
          <div style={{ margin: "18px 0 8px", display: "flex", justifyContent: "space-between", fontFamily: S.font, fontSize: 12, color: S.muted }}><span>Checklist progress</span><strong>{complete}/{checklist.length}</strong></div>
          <div style={{ height: 7, background: S.surface, borderRadius: 999, overflow: "hidden" }}><div style={{ height: "100%", width: `${checklist.length ? (complete / checklist.length) * 100 : 0}%`, background: complete === checklist.length ? S.green : S.gold }} /></div>
          <button onClick={() => onNavigate("transaction")} style={{ ...S.btn(S.dark, S.card), width: "100%", marginTop: 16 }}>Open Full Transaction</button>
        </Card>
        <Card>
          <div style={{ display: "grid", gap: 12 }}>
            {(deal.timeline || []).map((event, index) => {
              const done = event.status === "Complete";
              return (
                <div key={`${event.date}-${event.label}`} style={{ display: "grid", gridTemplateColumns: "72px 24px 1fr", gap: 10 }}>
                  <div style={{ fontFamily: S.font, fontSize: 12, color: S.light }}>{event.date}</div>
                  <div><div style={{ width: 18, height: 18, borderRadius: 99, background: done ? S.green : event.status === "Pending" ? S.gold : S.surface, border: `2px solid ${done ? S.green : S.gold}` }} />{index < deal.timeline.length - 1 && <div style={{ width: 2, height: 34, background: S.border, marginLeft: 8 }} />}</div>
                  <div><div style={{ fontFamily: S.font, fontSize: 13.5, fontWeight: 800, color: S.dark }}>{event.label}</div><div style={{ marginTop: 3 }}><Badge tone={done ? "good" : "accent"}>{event.status}</Badge></div></div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function OfferComposerView({ listings = [], notify = () => {}, userKey = "guest" }) {
  const isCompact = useMediaQuery("(max-width: 900px)");
  const safeUserKey = String(userKey || "guest").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100);
  const [savedOffers, setSavedOffers] = useLocalState(`estatehat-offers-v1-${safeUserKey}`, []);
  const [listingId, setListingId] = useState(listings[0]?.id || "");
  const listing = listings.find((item) => String(item.id) === String(listingId)) || listings[0];
  const [offer, setOffer] = useState({ price: "", earnest: "10000", financing: "conventional", inspectionDays: "10", appraisal: true, closingDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) });
  const [draftQuery, setDraftQuery] = useState("");
  const [draftStatus, setDraftStatus] = useState("all");
  const [offerNotice, setOfferNotice] = useState("");
  const price = Number(offer.price || listing?.price || 0);
  const validationError = listing ? validateOfferDraft({ ...offer, listingId, price }, new Date()) : "Choose a property.";
  const offerMetrics = calculateOfferMetrics({ ...offer, price }, listing?.price);
  const visibleOffers = filterOfferDrafts(savedOffers, { query: draftQuery, status: draftStatus });
  function saveOfferDraft() {
    if (!listing || !price) return;
    try {
      const saved = createOfferDraft({ ...offer, listingId, price }, listing);
      setSavedOffers((current) => [saved, ...current].slice(0, 100));
      setOfferNotice("Offer terms saved locally as a draft. No offer was sent.");
      notify({ title: "Offer draft saved", message: `${fmt(price)} offer package is ready for review.`, tone: "success" });
    } catch (error) { setOfferNotice(error.message); }
  }
  return (
    <div style={{ maxWidth: 1060, margin: "0 auto", padding: 24 }}>
      <Header title="Offer Composer" sub="Draft price, financing, contingencies, earnest money, closing date, and expiration before sending." />
      {listings.length === 0 ? (
        <EmptyState title="No properties ready for offers" body="Live listings will appear here when they are available." />
      ) : (
      <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1fr 0.8fr", gap: 18 }}>
        <Card>
          <label style={S.label}>Property</label>
          <select value={listingId} onChange={(event) => setListingId(event.target.value)} style={S.input}>{listings.map((item) => <option key={item.id} value={item.id}>{item.title} · {fmt(item.price)}</option>)}</select>
          <label style={S.label}>Offer price</label>
          <input value={offer.price} onChange={(event) => setOffer({ ...offer, price: event.target.value })} placeholder={listing ? String(listing.price) : "500000"} style={S.input} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={S.label}>Earnest money</label><input value={offer.earnest} onChange={(event) => setOffer({ ...offer, earnest: event.target.value })} style={S.input} /></div>
            <div><label style={S.label}>Financing</label><select value={offer.financing} onChange={(event) => setOffer({ ...offer, financing: event.target.value })} style={S.input}><option value="conventional">Conventional</option><option value="cash">Cash</option><option value="fha">FHA</option><option value="va">VA</option></select></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={S.label}>Inspection period</label><input type="number" min="0" max="60" value={offer.inspectionDays} onChange={(event) => setOffer({ ...offer, inspectionDays: event.target.value })} style={S.input} /></div>
            <div><label style={S.label}>Closing date</label><input type="date" value={offer.closingDate} onChange={(event) => setOffer({ ...offer, closingDate: event.target.value })} style={S.input} /></div>
          </div>
          <label style={{ ...S.label, display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={offer.appraisal} onChange={(event) => setOffer({ ...offer, appraisal: event.target.checked })} /> Include appraisal contingency</label>
          {validationError && <p role="alert" style={{ color: S.red, fontFamily: S.font, fontSize: 12 }}>{validationError}</p>}
          {offerNotice && <p role="status" aria-live="polite" style={{ color: S.muted, fontFamily: S.font, fontSize: 12 }}>{offerNotice}</p>}
          <button type="button" onClick={saveOfferDraft} disabled={!listing || !!validationError} style={{ ...S.btn(!listing || validationError ? S.surface : S.gold, !listing || validationError ? S.light : S.dark), width: "100%", marginTop: 16, cursor: !listing || validationError ? "not-allowed" : "pointer" }}>Save Offer Draft</button>
        </Card>
        <Card>
          <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: 1.3, textTransform: "uppercase", color: S.light }}>Offer Summary</div>
          <div style={{ fontFamily: S.serif, fontSize: 32, color: S.dark, marginTop: 8 }}>{fmt(price)}</div>
          <div style={{ fontFamily: S.font, fontSize: 13, color: S.muted, lineHeight: 1.6, margin: "8px 0 14px" }}>{listing?.title || "Select a property"} · {offer.financing} financing · closes {offer.closingDate}</div>
          <div style={{ display: "grid", gap: 8, fontFamily: S.font, fontSize: 12.5, color: S.muted }}>
            <div>EstateHat fees: <strong style={{ color: S.dark }}>{fmt(fee(price))}</strong></div>
            <div>Earnest money: <strong style={{ color: S.dark }}>{fmt(offer.earnest)}</strong></div>
            <div>Inspection: <strong style={{ color: S.dark }}>{offer.inspectionDays} days</strong></div>
            <div>Appraisal: <strong style={{ color: S.dark }}>{offer.appraisal ? "Included" : "Waived"}</strong></div>
            <div>Earnest as share: <strong style={{ color: S.dark }}>{percent(offerMetrics.earnestPercent)}</strong></div>
            {offerMetrics.askingDifference !== null && <div>Offer vs asking: <strong style={{ color: S.dark }}>{fmt(offerMetrics.askingDifference)} ({percent(offerMetrics.askingDifferencePercent)})</strong></div>}
          </div>
          <div style={{ borderTop: `1px solid ${S.border}`, marginTop: 16, paddingTop: 14 }}>
            <div style={{ fontFamily: S.font, fontSize: 12, fontWeight: 900, color: S.dark, marginBottom: 8 }}>Saved Drafts</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}><input aria-label="Search offer drafts" value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} placeholder="Search drafts" style={S.input} /><select aria-label="Filter offer drafts" value={draftStatus} onChange={(event) => setDraftStatus(event.target.value)} style={S.input}><option value="all">All statuses</option><option value="draft">Draft</option><option value="ready">Ready for review</option><option value="withdrawn">Withdrawn</option></select></div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}><button type="button" disabled={!savedOffers.length} onClick={() => { const url = URL.createObjectURL(new Blob([exportOfferDrafts(savedOffers)], { type: "application/json" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "estatehat-offer-drafts.json"; anchor.click(); URL.revokeObjectURL(url); }}>Download backup</button><label>Restore <input aria-label="Restore offer backup" type="file" accept="application/json,.json" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { if (file.size > 500000) throw new Error("Offer backup must be under 500 KB."); const imported = importOfferDrafts(await file.text()); if (savedOffers.length && !window.confirm(`Replace ${savedOffers.length} drafts with ${imported.length} backup drafts?`)) { setOfferNotice("Restore cancelled; current drafts were kept."); return; } setSavedOffers(imported); setOfferNotice("Offer drafts restored."); } catch (error) { setOfferNotice(error.message); } event.target.value = ""; }} /></label></div>
            {visibleOffers.length === 0 && <div style={{ fontFamily: S.font, fontSize: 12, color: S.light, marginTop: 8 }}>{savedOffers.length ? "No drafts match these filters." : "No offer drafts saved yet."}</div>}
            {visibleOffers.map((saved) => <div key={saved.id} style={{ fontFamily: S.font, fontSize: 12, color: S.muted, borderTop: `1px solid ${S.surface}`, padding: "8px 0", display: "grid", gridTemplateColumns: "1fr auto", gap: 6 }}><span><strong style={{ color: S.dark }}>{fmt(saved.price)}</strong> · {saved.property} · {saved.closingDate}</span><div><select aria-label={`${saved.property} offer status`} value={saved.status} onChange={(event) => setSavedOffers((current) => setOfferStatus(current, saved.id, event.target.value))} style={{ ...S.input, width: "auto" }}><option value="draft">Draft</option><option value="ready">Ready</option><option value="withdrawn">Withdrawn</option></select> <button type="button" aria-label={`Delete offer for ${saved.property}`} onClick={() => setSavedOffers((current) => deleteOfferDraft(current, saved.id))}>Delete</button></div></div>)}
          </div>
        </Card>
      </div>
      )}
    </div>
  );
}

export function TourSchedulerView({ listings = [], notify = () => {}, userKey = "guest" }) {
  const isCompact = useMediaQuery("(max-width: 900px)");
  const safeUserKey = String(userKey || "guest").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100);
  const [tours, setTours] = useLocalState(`estatehat-tours-v1-${safeUserKey}`, []);
  const [draft, setDraft] = useState({ listingId: listings[0]?.id || "", date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), time: "10:00", type: "showing", notes: "" });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("upcoming");
  const [editingTourId, setEditingTourId] = useState("");
  const selected = listings.find((item) => String(item.id) === String(draft.listingId)) || listings[0];
  function schedule() {
    if (!selected) return;
    const validationError = validateTourDraft(draft, tours.filter((tour) => tour.id !== editingTourId));
    if (validationError) { notify({ title: "Appointment needs attention", message: validationError, tone: "error" }); return; }
    const next = editingTourId
      ? { ...draft, listingId: String(selected.id), property: selected.title, address: selected.address || "", status: "scheduled" }
      : makeTour(draft, selected);
    setTours((current) => editingTourId ? updateTour(current, editingTourId, next) : [next, ...current].slice(0, 12));
    setEditingTourId("");
    notify({ title: editingTourId ? "Appointment rescheduled" : "Tour scheduled", message: `${next.property} on ${next.date} at ${next.time}.`, tone: "success" });
  }
  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
      <Header title="Tour Scheduler" sub="Schedule showings, walkthroughs, inspections, and signing appointments." />
      <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "0.9fr 1.1fr", gap: 18 }}>
        <Card>
          {listings.length === 0 ? (
            <EmptyState title="No tour-ready properties" body="Live listings will appear here when available." />
          ) : (
            <>
          <label style={S.label}>Property</label>
          <select value={draft.listingId} onChange={(event) => setDraft({ ...draft, listingId: event.target.value })} style={S.input}>{listings.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}><div><label style={S.label}>Date</label><input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} style={S.input} /></div><div><label style={S.label}>Time</label><input type="time" value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} style={S.input} /></div></div>
          <label style={S.label}>Duration</label><select value={draft.durationMinutes || 60} onChange={(event) => setDraft({ ...draft, durationMinutes: Number(event.target.value) })} style={S.input}><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">1 hour</option><option value="90">90 minutes</option><option value="120">2 hours</option></select>
          <label style={S.label}>Appointment type</label>
          <select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })} style={S.input}><option value="showing">Showing</option><option value="inspection">Inspection</option><option value="walkthrough">Final walkthrough</option><option value="signing">Signing</option></select>
          <label style={S.label}>Notes</label>
          <textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} style={{ ...S.input, minHeight: 90 }} placeholder="Gate code, parking, attendee notes..." />
          <div style={{ fontFamily: S.font, fontSize: 11, color: S.light, textAlign: "right" }}>{draft.notes.length}/1000</div>
          <button type="button" onClick={schedule} style={{ ...S.btn(S.gold, S.dark), width: "100%", marginTop: 14 }}>{editingTourId ? "Save Reschedule" : "Schedule Appointment"}</button>
          {editingTourId && <button type="button" onClick={() => setEditingTourId("")} style={{ ...S.btn(S.surfaceAlt, S.muted), width: "100%", marginTop: 6 }}>Cancel reschedule</button>}
            </>
          )}
        </Card>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}><div style={{ fontFamily: S.font, fontSize: 14, fontWeight: 800, color: S.dark }}>Appointment Planner</div><button type="button" disabled={!tours.some((tour) => tour.status !== "cancelled")} onClick={() => { const blob = new Blob([toTourCalendar(tours)], { type: "text/calendar;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "estatehat-appointments.ics"; link.click(); URL.revokeObjectURL(url); }} style={{ ...S.btn(S.surfaceAlt, S.dark), borderColor: S.border }}>Export calendar</button></div>
          <input aria-label="Search appointments" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search property, address, notes..." style={{ ...S.input, marginBottom: 10 }} />
          <select aria-label="Filter appointments" value={filter} onChange={(event) => setFilter(event.target.value)} style={{ ...S.input, marginBottom: 8 }}><option value="upcoming">Upcoming</option><option value="past">Past</option><option value="cancelled">Cancelled</option><option value="all">All appointments</option></select>
          {filterTours(tours, query, filter).length === 0 && <div style={{ color: S.light, fontFamily: S.font, fontSize: 13, padding: "10px 0" }}>{tours.length ? "No appointments match these filters." : "No appointments scheduled yet."}</div>}
          {filterTours(tours, query, filter).map((item) => <div key={item.id} style={{ borderTop: `1px solid ${S.surface}`, padding: "12px 0", fontFamily: S.font }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><strong style={{ color: S.dark, fontSize: 13 }}>{item.property}</strong><Badge tone={item.status === "cancelled" ? "warn" : "accent"}>{item.status === "cancelled" ? "cancelled" : item.type}</Badge></div><div style={{ color: S.light, fontSize: 12, marginTop: 4 }}>{item.date} at {item.time} · {item.durationMinutes || 60} minutes · {item.address}</div>{item.notes && <div style={{ color: S.muted, fontSize: 12, marginTop: 4 }}>{item.notes}</div>}{item.status !== "cancelled" && <div style={{ display: "flex", gap: 6, marginTop: 8 }}><button type="button" onClick={() => { setDraft({ listingId: item.listingId, date: item.date, time: item.time, type: item.type, notes: item.notes || "", durationMinutes: item.durationMinutes || 60 }); setEditingTourId(item.id); }} style={{ ...S.btn(S.surfaceAlt, S.muted), borderColor: S.border, padding: "6px 10px" }}>Reschedule</button><button type="button" onClick={() => { setTours((current) => cancelTour(current, item.id)); notify({ title: "Appointment cancelled", message: `${item.property} was removed from upcoming appointments.`, tone: "success" }); }} style={{ ...S.btn(S.surfaceAlt, S.muted), borderColor: S.border, padding: "6px 10px" }}>Cancel appointment</button></div>}</div>)}
        </Card>
      </div>
    </div>
  );
}

export function PropertyComparisonView({ listings = [], savedListingIds = [], onNavigate, userKey = "guest" }) {
  const defaults = (savedListingIds.length ? savedListingIds : listings.map((item) => item.id)).slice(0, 3);
  const safeUserKey = String(userKey || "guest").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100);
  const [comparisonSets, setComparisonSets] = useLocalState(`estatehat-comparison-sets-v1-${safeUserKey}`, []);
  const [selectedIds, setSelectedIds] = useState(defaults);
  const [setName, setSetName] = useState("");
  const [setQuery, setSetQuery] = useState("");
  const [comparisonNotice, setComparisonNotice] = useState("");
  const selected = listings.filter((listing) => selectedIds.includes(listing.id)).slice(0, 4);
  const visibleSets = comparisonSets.filter((item) => item.name.toLowerCase().includes(setQuery.trim().toLowerCase()));
  function saveSet(event) {
    event.preventDefault();
    try { setComparisonSets((current) => createComparisonSet(current, setName, selected.map((item) => item.id))); setSetName(""); setComparisonNotice("Comparison saved under this browser profile."); }
    catch (error) { setComparisonNotice(error.message); }
  }
  function downloadSets() {
    const url = URL.createObjectURL(new Blob([exportComparisonSets(comparisonSets)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "estatehat-property-comparisons.json"; anchor.click(); URL.revokeObjectURL(url);
  }
  async function restoreSets(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 200_000) throw new Error("Comparison backup must be under 200 KB.");
      const restored = importComparisonSets(await file.text(), listings.map((item) => item.id));
      if (comparisonSets.length && !window.confirm(`Replace ${comparisonSets.length} saved comparisons with ${restored.length} backup comparisons?`)) { setComparisonNotice("Restore cancelled; saved comparisons were kept."); return; }
      setComparisonSets(restored); setComparisonNotice("Comparison sets restored.");
    } catch (error) { setComparisonNotice(error.message); }
    event.target.value = "";
  }
  return (
    <div style={{ maxWidth: 1120, margin: "0 auto", padding: 24 }}>
      <Header title="Property Comparison" sub="Compare pricing, facts, trusted status, fees, and seller details side by side." />
      {listings.length === 0 ? (
        <EmptyState title="No properties to compare" body="Saved listings and active transaction properties will appear here when available." onAction={() => onNavigate("browse")} actionLabel="Browse Listings" />
      ) : (
      <>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{listings.map((listing) => <label key={listing.id} style={{ border: `1px solid ${selectedIds.includes(listing.id) ? S.gold : S.border}`, background: selectedIds.includes(listing.id) ? S.goldBg : S.card, borderRadius: 8, padding: "8px 10px", fontFamily: S.font, fontSize: 12, color: S.muted, cursor: "pointer" }}><input type="checkbox" checked={selectedIds.includes(listing.id)} onChange={() => setSelectedIds((current) => current.includes(listing.id) ? current.filter((id) => id !== listing.id) : [...current, listing.id].slice(-4))} /> {listing.title}</label>)}</div>
        <form onSubmit={saveSet} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}><input aria-label="Comparison set name" minLength={2} maxLength={80} required value={setName} onChange={(event) => setSetName(event.target.value)} placeholder="Name this comparison" style={{ ...S.input, flex: "1 1 200px" }} /><button type="submit" disabled={selected.length < 2} style={S.btn(selected.length < 2 ? S.surface : S.gold, selected.length < 2 ? S.light : S.dark)}>Save comparison</button></form>
        {comparisonNotice && <div role="status" aria-live="polite" style={{ color: S.muted, fontFamily: S.font, fontSize: 12, marginTop: 8 }}>{comparisonNotice}</div>}
        {comparisonSets.length > 0 && <div style={{ display: "grid", gap: 7, marginTop: 12, borderTop: `1px solid ${S.border}`, paddingTop: 10 }}><div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}><input aria-label="Search saved comparisons" value={setQuery} onChange={(event) => setSetQuery(event.target.value)} placeholder="Search saved comparison sets" style={{ ...S.input, flex: "1 1 180px" }} /><button type="button" onClick={downloadSets}>Download backup</button><label>Restore<input aria-label="Restore comparison backup" type="file" accept="application/json,.json" onChange={restoreSets} /></label></div>{visibleSets.map((item) => <div key={item.id} style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", fontFamily: S.font, fontSize: 12, color: S.dark }}><strong style={{ flex: "1 1 140px" }}>{item.name} · {item.listingIds.length} listings</strong><button type="button" onClick={() => setSelectedIds(item.listingIds.filter((id) => listings.some((listing) => String(listing.id) === String(id))))}>Compare</button><button type="button" onClick={() => { const name = window.prompt("Rename comparison", item.name); if (name) { try { setComparisonSets((current) => renameComparisonSet(current, item.id, name)); } catch (error) { setComparisonNotice(error.message); } } }}>Rename</button><button type="button" onClick={() => setComparisonSets((current) => deleteComparisonSet(current, item.id))}>Delete</button></div>)}</div>}
      </Card>
      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: `160px repeat(${Math.max(selected.length, 1)}, minmax(210px, 1fr))`, minWidth: 760, border: `1px solid ${S.border}`, borderRadius: 10, overflow: "hidden", background: S.card }}>
          {["", ...selected.map((listing) => listing.title)].map((heading, index) => <div key={`h-${index}`} style={{ background: S.surfaceAlt, padding: 12, fontFamily: S.font, fontSize: 12, fontWeight: 800, color: S.dark }}>{heading}</div>)}
          {[
            ["Price", (l) => fmt(l.price)],
            ["Type", (l) => l.type],
            ["Address", (l) => l.address],
            ["Size", (l) => `${l.beds} bed · ${l.baths} bath · ${l.sqft.toLocaleString()} sqft`],
            ["Seller", (l) => `${l.sellerType}: ${l.seller}`],
            ["Verified", (l) => l.verified ? "Verified" : "Not verified"],
            ["EstateHat fees", (l) => fmt(fee(l.price))],
            ["Seller net", (l) => fmt(l.price - fee(l.price))],
          ].flatMap(([label, render]) => [<div key={`${label}-label`} style={{ padding: 12, borderTop: `1px solid ${S.border}`, fontFamily: S.font, fontSize: 12, fontWeight: 800, color: S.light }}>{label}</div>, ...selected.map((listing) => <div key={`${label}-${listing.id}`} style={{ padding: 12, borderTop: `1px solid ${S.border}`, fontFamily: S.font, fontSize: 12.5, color: S.muted }}>{render(listing)}</div>)])}
        </div>
      </div>
      {selected[0] && (
        <button
          onClick={() => onNavigate(selected[0].source === "deal" ? "transaction" : "detail", selected[0].id)}
          style={{ ...S.btn(S.gold, S.dark), marginTop: 16 }}
        >
          {selected[0].source === "deal" ? "Open Transaction" : "Open First Listing"}
        </button>
      )}
      </>
      )}
    </div>
  );
}

export function AdminWorkbenchView({ notify = () => {}, confirmAction = ({ onConfirm }) => onConfirm?.(), docs = [], flags = [], transactions = [] }) {
  const [tab, setTab] = useState("docs");
  const [selectedIds, setSelectedIds] = useState([]);
  const rows = tab === "docs" ? docs : tab === "flags" ? flags : transactions;
  const columns = tab === "docs"
    ? [["docName", "Document"], ["transaction", "Transaction"], ["property", "Property"], ["status", "Status"], ["flagCount", "Flags"]]
    : tab === "flags"
      ? [["severity", "Severity"], ["type", "Type"], ["subject", "Subject"], ["transaction", "Transaction"], ["action", "Action"]]
      : [["id", "Transaction"], ["property", "Property"], ["status", "Status"], ["phase", "Phase"], ["flagCount", "Flags"]];
  const normalizedRows = rows.map((row) => ({ ...row, flagCount: row.flagCount ?? row.flags?.length ?? 0 }));
  function toggle(id) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }
  function bulk(action) {
    confirmAction({
      title: `${action} selected items`,
      message: `${selectedIds.length} ${tab} item${selectedIds.length === 1 ? "" : "s"} will be marked for "${action}".`,
      confirmLabel: action,
      onConfirm: () => {
        notify({ title: "Bulk action recorded", message: `${action} applied to ${selectedIds.length} selected item${selectedIds.length === 1 ? "" : "s"}.`, tone: "success" });
        setSelectedIds([]);
      },
    });
  }
  return (
    <div style={{ maxWidth: 1120, margin: "0 auto", padding: 24 }}>
      <Header title="Admin Workbench" sub="Bulk review tables for documents, flags, and transaction operations." />
      <Tabs tabs={[{ key: "docs", label: "Documents" }, { key: "flags", label: "Flags" }, { key: "transactions", label: "Transactions" }]} active={tab} onSelect={(next) => { setTab(next); setSelectedIds([]); }} />
      {selectedIds.length > 0 && <Card style={{ marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", borderLeft: `4px solid ${S.gold}` }}><div style={{ fontFamily: S.font, fontSize: 13, color: S.dark, fontWeight: 800 }}>{selectedIds.length} selected</div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{["Approve", "Request changes", "Assign review", "Export"].map((action) => <button key={action} onClick={() => bulk(action)} style={{ ...S.btn(action === "Approve" ? S.green : S.surfaceAlt, action === "Approve" ? "#fff" : S.muted), borderColor: S.border }}>{action}</button>)}</div></Card>}
      {normalizedRows.length === 0 ? (
        <EmptyState title="No live operations data" body="This workbench is ready for connected document, flag, and transaction feeds. It does not display placeholder review rows." />
      ) : (
      <div style={{ overflowX: "auto", border: `1px solid ${S.border}`, borderRadius: 10, background: S.card }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
          <thead><tr style={{ background: S.surfaceAlt }}><th style={{ padding: 12, width: 42 }}><input type="checkbox" checked={normalizedRows.length > 0 && normalizedRows.every((row) => selectedIds.includes(row.id))} onChange={() => setSelectedIds(selectedIds.length === normalizedRows.length ? [] : normalizedRows.map((row) => row.id))} /></th>{columns.map(([, label]) => <th key={label} style={{ padding: "12px 14px", textAlign: "left", fontFamily: S.font, fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2, color: S.light }}>{label}</th>)}</tr></thead>
          <tbody>{normalizedRows.map((row) => <tr key={row.id} style={{ borderTop: `1px solid ${S.border}` }}><td style={{ padding: 12 }}><input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggle(row.id)} /></td>{columns.map(([key]) => <td key={key} style={{ padding: "12px 14px", fontFamily: S.font, fontSize: 12.5, color: S.muted, verticalAlign: "top" }}>{["status", "severity"].includes(key) ? <Badge tone={["approved", "In Progress", "info"].includes(row[key]) ? "good" : ["critical", "Blocked"].includes(row[key]) ? "warn" : "accent"}>{row[key]}</Badge> : row[key]}</td>)}</tr>)}</tbody>
        </table>
      </div>
      )}
    </div>
  );
}
