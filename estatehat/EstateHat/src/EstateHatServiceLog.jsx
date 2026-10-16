"use client";
import { useEffect, useMemo, useState } from "react";
import { createServiceRecord, exportServiceRecordsCsv, filterServiceRecords, restoreServiceRecords, SERVICE_TYPES, summarizeServiceRecords } from "./estatehat-service-log.js";

const keyFor = (userKey) => `estatehat:service-log:v1:${encodeURIComponent(userKey || "guest")}`;
const field = { width: "100%", boxSizing: "border-box", padding: 9, border: "1px solid var(--s-border)", borderRadius: 7, background: "var(--s-surface)", color: "var(--s-dark)" };
const button = { padding: "8px 10px", borderRadius: 7, border: "1px solid var(--s-border)", background: "var(--s-card)", color: "var(--s-dark)", cursor: "pointer", fontWeight: 700 };

export default function EstateHatServiceLog({ userKey = "guest" }) {
  const storageKey = keyFor(userKey);
  const [records, setRecords] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [provider, setProvider] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("HVAC");
  const [notes, setNotes] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => { try { setRecords(restoreServiceRecords(JSON.parse(localStorage.getItem(storageKey) || "[]"))); } catch { setRecords([]); setNotice("Saved service log could not be read; a blank browser list is ready."); } setLoaded(true); }, [storageKey]);
  useEffect(() => { if (loaded) localStorage.setItem(storageKey, JSON.stringify(records)); }, [loaded, records, storageKey]);
  const visible = useMemo(() => filterServiceRecords(records, { query, type: category, from, to }), [records, query, category, from, to]);
  const summary = summarizeServiceRecords(visible);
  function add(event) { event.preventDefault(); try { setRecords((current) => [...current, createServiceRecord({ provider, serviceDate, amount, type, notes })]); setProvider(""); setAmount(""); setNotes(""); setNotice("Service record saved in this browser profile."); } catch (error) { setNotice(error.message); } }
  function download(name, content, mime) { const url = URL.createObjectURL(new Blob([content], { type: mime })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url); }
  function restore(file) { if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const next = restoreServiceRecords(JSON.parse(String(reader.result))); setRecords(next); setNotice(`Restored ${next.length} service records.`); } catch (error) { setNotice(error.message || "Could not restore backup."); } }; reader.readAsText(file); }
  return <div style={{ display: "grid", gap: 10, color: "var(--s-dark)" }}>
    <p style={{ margin: 0, fontSize: 12, color: "var(--s-muted)" }}>A private browser record of household service visits and costs. It does not verify providers, warranties, or invoices.</p>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12 }}><span>Shown records: <strong>{summary.count}</strong></span><span>Total shown: <strong>${summary.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span><span>Average: <strong>${summary.average.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span><span>Newest: <strong>{summary.newestDate || "—"}</strong></span></div>
    <form onSubmit={add} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8 }}>
      <input aria-label="Service provider" required minLength={2} maxLength={120} value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Provider" style={field} />
      <input aria-label="Service date" required type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} style={field} />
      <input aria-label="Service cost" required type="number" min="0" max="10000000" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Cost" style={field} />
      <select aria-label="Service type" value={type} onChange={(e) => setType(e.target.value)} style={field}>{SERVICE_TYPES.map((item) => <option key={item}>{item}</option>)}</select>
      <input aria-label="Service notes" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" style={field} />
      <button type="submit" style={button}>Add record</button>
    </form>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 7 }}><input aria-label="Search service records" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search provider or notes" style={field} /><select aria-label="Filter service type" value={category} onChange={(e) => setCategory(e.target.value)} style={field}><option value="all">All service types</option>{SERVICE_TYPES.map((item) => <option key={item}>{item}</option>)}</select><label style={{ fontSize: 11 }}>From<input aria-label="Service date from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={field} /></label><label style={{ fontSize: 11 }}>To<input aria-label="Service date to" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={field} /></label></div>
    <div style={{ display: "grid", gap: 6 }}>{visible.map((record) => <article key={record.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", border: "1px solid var(--s-border)", borderRadius: 8, padding: 9 }}><div><strong>{record.provider}</strong> · ${record.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}<div style={{ fontSize: 11, color: "var(--s-muted)" }}>{record.serviceDate} · {record.type}{record.notes && ` · ${record.notes}`}</div></div><button style={button} onClick={() => setRecords((current) => current.filter((item) => item.id !== record.id))}>Delete</button></article>)}{!visible.length && <span style={{ fontSize: 12, color: "var(--s-muted)" }}>No matching service visits.</span>}</div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}><button style={button} onClick={() => download("estatehat-service-log.csv", exportServiceRecordsCsv(visible), "text/csv")}>Export shown CSV</button><button style={button} onClick={() => download("estatehat-service-log.json", JSON.stringify(records, null, 2), "application/json")}>Download full backup</button><label style={{ ...button, display: "inline-flex", alignItems: "center", gap: 5 }}>Restore backup<input aria-label="Restore service log backup" type="file" accept="application/json,.json" onChange={(e) => { restore(e.target.files?.[0]); e.target.value = ""; }} /></label><button style={button} onClick={() => { if (window.confirm("Clear every service record saved in this browser profile?")) { setRecords([]); setNotice("Service log cleared."); } }}>Clear all</button></div>
    {notice && <p role="status" aria-live="polite" style={{ margin: 0, fontSize: 12 }}>{notice}</p>}
  </div>;
}
