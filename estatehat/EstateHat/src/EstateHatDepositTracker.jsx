"use client";

import { useEffect, useMemo, useState } from "react";
import { addDepositRecord, exportDepositRecords, exportDepositRecordsCsv, filterDepositRecords, importDepositRecords, removeDepositRecord, summarizeDepositRecords, updateDepositStatus } from "./estatehat-earnest-money.js";

const money = (value) => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0);
const button = { border: "1px solid var(--s-border)", borderRadius: 7, padding: "7px 9px", background: "var(--s-card)", color: "var(--s-dark)", font: "700 11px 'Plus Jakarta Sans', sans-serif", cursor: "pointer" };
function readRecords(key) {
  if (typeof window === "undefined") return [];
  try { const parsed = JSON.parse(window.localStorage.getItem(key) || "[]"); return importDepositRecords(JSON.stringify({ schemaVersion: 1, records: Array.isArray(parsed) ? parsed : [] })); }
  catch { return []; }
}

export default function EstateHatDepositTracker({ listings = [], userKey = "guest" }) {
  const safeUserKey = String(userKey || "guest").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100);
  const storageKey = `estatehat-deposit-records-v1-${safeUserKey}`;
  const [records, setRecords] = useState(() => readRecords(storageKey));
  const [listingId, setListingId] = useState(String(listings[0]?.id || ""));
  const [form, setForm] = useState({ amount: "", dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), reference: "", note: "" });
  const [filter, setFilter] = useState("all");
  const [notice, setNotice] = useState("");
  const propertyRecords = useMemo(() => filterDepositRecords(records, listingId, filter), [records, listingId, filter]);
  const summary = useMemo(() => summarizeDepositRecords(records, listingId), [records, listingId]);
  useEffect(() => { try { window.localStorage.setItem(storageKey, JSON.stringify(records)); } catch { setNotice("Browser storage is unavailable; download a backup to keep these notes."); } }, [storageKey, records]);

  function add(event) {
    event.preventDefault();
    try { setRecords((current) => addDepositRecord(current, { ...form, listingId })); setForm((current) => ({ ...current, amount: "", reference: "", note: "" })); setNotice("Deposit planning record saved in this browser. No money was transferred or verified."); }
    catch (error) { setNotice(error.message); }
  }
  function backup() {
    const url = URL.createObjectURL(new Blob([exportDepositRecords(records)], { type: "application/json" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "estatehat-deposit-planning.json"; anchor.click(); URL.revokeObjectURL(url); setNotice("Local deposit notes exported.");
  }
  async function restore(event) {
    const file = event.target.files?.[0]; if (!file) return;
    try { if (file.size > 500_000) throw new Error("Deposit backup must be under 500 KB."); const rows = importDepositRecords(await file.text()); if (records.length && !window.confirm(`Replace ${records.length} local deposit records with ${rows.length} backup records?`)) { setNotice("Restore cancelled; current records were kept."); return; } setRecords(rows); setNotice("Deposit planning records restored."); }
    catch (error) { setNotice(error.message); }
    event.target.value = "";
  }
  function exportCsv() {
    const url = URL.createObjectURL(new Blob([exportDepositRecordsCsv(propertyRecords)], { type: "text/csv;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "estatehat-deposit-planning.csv"; anchor.click(); URL.revokeObjectURL(url);
  }

  if (!listings.length) return <p style={{ color: "var(--s-muted)", font: "12px 'Plus Jakarta Sans', sans-serif" }}>No property is available to attach a private deposit planning record.</p>;
  return <div style={{ display: "grid", gap: 9 }}>
    <p style={{ margin: 0, color: "var(--s-muted)", font: "11px/1.5 'Plus Jakarta Sans', sans-serif" }}>Private planning notes stored in this browser under your profile. This does not move, verify, or hold money and is not linked to a bank, escrow account, or transaction service.</p>
    <label style={{ font: "700 10px 'Plus Jakarta Sans', sans-serif", color: "var(--s-muted)" }}>Property<select aria-label="Deposit property" value={listingId} onChange={(event) => setListingId(event.target.value)} style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}>{listings.map((item) => <option key={item.id} value={item.id}>{item.title || item.address}</option>)}</select></label>
    <div style={{ display: "flex", gap: 7, flexWrap: "wrap", color: "var(--s-dark)", font: "700 11px 'Plus Jakarta Sans', sans-serif" }}><span>Planned {money(summary.planned)}</span><span>Deposited status {money(summary.deposited)}</span><span>Outstanding {money(summary.outstanding)}</span><span>Overdue {summary.overdueCount}</span></div>
    <form onSubmit={add} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 7 }}><label>Amount<input aria-label="Deposit amount" type="number" min="0.01" step="0.01" required value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} style={{ display: "block", width: "100%", padding: 8 }} /></label><label>Due date<input aria-label="Deposit due date" type="date" required value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} style={{ display: "block", width: "100%", padding: 8 }} /></label><label>Reference (optional)<input aria-label="Deposit reference note" maxLength={100} value={form.reference} onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))} style={{ display: "block", width: "100%", padding: 8 }} /></label><label>Note<textarea aria-label="Deposit planning note" maxLength={300} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} style={{ display: "block", width: "100%", padding: 8 }} /></label><button type="submit" style={button}>Add deposit note</button></form>
    <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}><select aria-label="Filter deposit notes" value={filter} onChange={(event) => setFilter(event.target.value)} style={{ padding: 7 }}><option value="all">All records</option><option value="open">Planned</option><option value="overdue">Overdue</option><option value="deposited">Marked deposited</option><option value="refunded">Marked refunded</option></select><button type="button" onClick={exportCsv} disabled={!propertyRecords.length} style={button}>Export CSV</button><button type="button" onClick={backup} disabled={!records.length} style={button}>Backup all</button><label style={button}>Restore<input aria-label="Restore deposit planning backup" type="file" accept="application/json,.json" onChange={restore} /></label></div>
    {propertyRecords.map((record) => <div key={record.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: 8, border: "1px solid var(--s-border)", borderRadius: 7, font: "11px 'Plus Jakarta Sans', sans-serif" }}><span><strong>{money(record.amount)}</strong> due {record.dueDate} · {record.status}{record.reference && <><br />Ref: {record.reference}</>}{record.note && <><br />{record.note}</>}</span><div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}><select aria-label={`Deposit ${record.id} status`} value={record.status} onChange={(event) => setRecords((current) => updateDepositStatus(current, record.id, event.target.value))} style={{ padding: 6 }}><option value="planned">Planned</option><option value="deposited">Marked deposited</option><option value="refunded">Marked refunded</option></select><button type="button" aria-label="Delete deposit note" style={button} onClick={() => setRecords((current) => removeDepositRecord(current, record.id))}>Remove</button></div></div>)}
    {notice && <div role="status" aria-live="polite" style={{ color: "var(--s-muted)", font: "11px 'Plus Jakarta Sans', sans-serif" }}>{notice}</div>}
  </div>;
}
