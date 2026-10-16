"use client";

import { useEffect, useMemo, useState } from "react";
import { addContingency, createContingencyChecklist, exportContingencyChecklist, filterContingencies, importContingencyChecklist, removeCustomContingency, summarizeContingencies, toggleContingency } from "./estatehat-contingency-checklist.js";

const buttonStyle = { border: "1px solid var(--s-border)", borderRadius: 7, padding: "7px 9px", background: "var(--s-card)", color: "var(--s-dark)", font: "700 11px 'Plus Jakarta Sans', sans-serif", cursor: "pointer" };

function readChecklists(key) {
  if (typeof window === "undefined") return [];
  try {
    const data = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(data) ? data.map((record) => importContingencyChecklist(JSON.stringify({ schemaVersion: 1, checklist: record }))) : [];
  } catch { return []; }
}

export default function EstateHatContingencyChecklist({ listings = [], userKey = "guest" }) {
  const safeUserKey = String(userKey || "guest").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100);
  const storageKey = `estatehat-contingencies-v1-${safeUserKey}`;
  const [checklists, setChecklists] = useState(() => readChecklists(storageKey));
  const [listingId, setListingId] = useState(String(listings[0]?.id || ""));
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState("all");
  const [notice, setNotice] = useState("");
  const listing = listings.find((item) => String(item.id) === listingId);
  const checklist = checklists.find((item) => String(item.listingId) === listingId);
  const summary = useMemo(() => summarizeContingencies(checklist), [checklist]);
  useEffect(() => { try { window.localStorage.setItem(storageKey, JSON.stringify(checklists)); } catch { setNotice("Browser storage is unavailable; download a backup to preserve checklist changes."); } }, [storageKey, checklists]);

  function ensureChecklist() {
    if (!listing || checklist) return checklist;
    const created = createContingencyChecklist(listing.id, { title: `${listing.title || "Property"} contingencies` });
    setChecklists((current) => [...current, created]);
    return created;
  }
  function update(transform) {
    const current = ensureChecklist();
    if (!current) return;
    setChecklists((rows) => rows.map((item) => item.id === current.id ? transform(item) : item));
  }
  function downloadBackup() {
    if (!checklist) return;
    const url = URL.createObjectURL(new Blob([exportContingencyChecklist(checklist)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `estatehat-contingencies-${listingId}.json`; anchor.click(); URL.revokeObjectURL(url);
    setNotice("Checklist backup downloaded.");
  }
  async function restoreBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 100_000) throw new Error("Checklist backup must be under 100 KB.");
      const restored = importContingencyChecklist(await file.text());
      if (restored.listingId !== listingId) throw new Error("This backup belongs to another property.");
      if (checklist && !window.confirm("Replace this property's current checklist with the backup?")) { setNotice("Restore cancelled; the current checklist was kept."); return; }
      setChecklists((current) => [...current.filter((item) => item.listingId !== listingId), restored]);
      setNotice("Checklist restored.");
    } catch (error) { setNotice(error.message); }
    event.target.value = "";
  }

  if (!listings.length) return <p style={{ color: "var(--s-muted)", font: "12px 'Plus Jakarta Sans', sans-serif" }}>Save or load a property before creating its contingency checklist.</p>;
  const rows = filterContingencies(checklist, filter);
  return <div style={{ display: "grid", gap: 8 }}>
    <p style={{ margin: 0, color: "var(--s-muted)", font: "11px/1.5 'Plus Jakarta Sans', sans-serif" }}>Personal checklist stored in this browser under your account profile. It is not synced to transaction participants and does not mark legal contingencies as satisfied.</p>
    <label style={{ color: "var(--s-muted)", font: "700 10px 'Plus Jakarta Sans', sans-serif" }}>Property<select aria-label="Checklist property" value={listingId} onChange={(event) => setListingId(event.target.value)} style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}>
      {listings.map((item) => <option key={item.id} value={item.id}>{item.title || item.address || item.id}</option>)}
    </select></label>
    {!checklist ? <button type="button" style={buttonStyle} onClick={ensureChecklist}>Create checklist</button> : <>
      <div aria-label="Checklist progress" style={{ display: "flex", justifyContent: "space-between", color: "var(--s-dark)", font: "700 11px 'Plus Jakarta Sans', sans-serif" }}><span>{summary.done} of {summary.total} complete</span><span>{summary.percent}%</span></div>
      <progress aria-label="Checklist completion" max="100" value={summary.percent} style={{ width: "100%" }} />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><select aria-label="Filter checklist items" value={filter} onChange={(event) => setFilter(event.target.value)} style={{ padding: 7 }}><option value="all">All items</option><option value="open">Open</option><option value="done">Complete</option></select><button type="button" style={buttonStyle} onClick={downloadBackup}>Download backup</button><label style={{ ...buttonStyle }}>Restore<input aria-label="Restore contingency checklist" type="file" accept="application/json,.json" onChange={restoreBackup} style={{ maxWidth: 140 }} /></label></div>
      <form onSubmit={(event) => { event.preventDefault(); try { update((item) => addContingency(item, draft)); setDraft(""); setNotice("Custom checklist item added."); } catch (error) { setNotice(error.message); } }} style={{ display: "flex", gap: 6 }}><input aria-label="New contingency item" minLength={2} maxLength={100} required value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Add a personal checklist item" style={{ flex: 1, minWidth: 0, padding: 8 }} /><button type="submit" style={buttonStyle}>Add</button></form>
      {rows.map((item) => <label key={item.id} style={{ display: "flex", alignItems: "center", gap: 7, padding: 7, border: "1px solid var(--s-border)", borderRadius: 7, color: "var(--s-dark)", font: "12px 'Plus Jakarta Sans', sans-serif" }}><input type="checkbox" checked={item.done} onChange={() => update((current) => toggleContingency(current, item.id))} />{item.label}{item.source === "custom" && <button type="button" aria-label={`Remove ${item.label}`} onClick={(event) => { event.preventDefault(); update((current) => removeCustomContingency(current, item.id)); }} style={{ marginLeft: "auto", ...buttonStyle }}>Remove</button>}</label>)}
    </>}
    {notice && <div role="status" aria-live="polite" style={{ color: "var(--s-muted)", font: "11px 'Plus Jakarta Sans', sans-serif" }}>{notice}</div>}
  </div>;
}
