"use client";

import { useMemo, useState } from "react";
import { deleteProfileLocalData, exportProfileLocalData, LOCAL_DATA_CATEGORIES, summarizeProfileLocalData } from "./estatehat-local-data.js";

export default function EstateHatLocalDataManager({ userKey = "guest" }) {
  const [selected, setSelected] = useState([]);
  const [notice, setNotice] = useState("");
  const summary = useMemo(() => {
    if (typeof window === "undefined") return [];
    try { return summarizeProfileLocalData(window.localStorage, userKey); } catch { return []; }
  }, [userKey, selected, notice]);
  const totalBytes = summary.reduce((total, row) => total + row.bytes, 0);
  function download() {
    try {
      const url = URL.createObjectURL(new Blob([exportProfileLocalData(window.localStorage, userKey)], { type: "application/json" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = "estatehat-browser-data.json"; anchor.click(); URL.revokeObjectURL(url);
      setNotice("This profile's whitelisted browser data was exported.");
    } catch { setNotice("Browser storage is unavailable; no data was exported."); }
  }
  function clearSelected() {
    if (!selected.length || !window.confirm(`Permanently remove browser-only data for ${selected.map((key) => LOCAL_DATA_CATEGORIES[key]).join(", ")}? This does not delete Firebase account data.`)) return;
    try {
      const removed = deleteProfileLocalData(window.localStorage, userKey, selected);
      setNotice(`Removed ${removed} local data record${removed === 1 ? "" : "s"}. Firebase account data was not changed.`);
      setSelected([]);
    } catch (error) { setNotice(error.message); }
  }
  return <div style={{ display: "grid", gap: 9 }}>
    <p style={{ margin: 0, color: "var(--s-muted)", font: "11px/1.5 'Plus Jakarta Sans', sans-serif" }}>Export or clear this profile's browser-only planning data. This does not export or delete your Firebase account, profile, or transaction records.</p>
    <div role="list" aria-label="Browser data categories" style={{ display: "grid", gap: 5 }}>{summary.map((row) => <div key={row.category} role="listitem" style={{ display: "flex", alignItems: "center", gap: 8, padding: 6, border: "1px solid var(--s-border)", borderRadius: 7, font: "11px 'Plus Jakarta Sans', sans-serif" }}><input aria-label={`Select ${row.label} data`} type="checkbox" checked={selected.includes(row.category)} onChange={() => setSelected((current) => current.includes(row.category) ? current.filter((item) => item !== row.category) : [...current, row.category])} /><span style={{ flex: 1 }}>{row.label}</span><span>{row.keys} records · {row.bytes.toLocaleString()} B</span></div>)}</div>
    <div style={{ color: "var(--s-muted)", font: "11px 'Plus Jakarta Sans', sans-serif" }}>Estimated browser data: {totalBytes.toLocaleString()} bytes</div>
    <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}><button type="button" onClick={download} style={{ border: "1px solid var(--s-border)", borderRadius: 7, padding: "8px 10px", background: "var(--s-card)", fontWeight: 800, cursor: "pointer" }}>Export my browser data</button><button type="button" disabled={!selected.length} onClick={clearSelected} style={{ border: "1px solid var(--s-border)", borderRadius: 7, padding: "8px 10px", background: "var(--s-card)", fontWeight: 800, cursor: selected.length ? "pointer" : "not-allowed" }}>Clear selected local data</button></div>
    {notice && <div role="status" aria-live="polite" style={{ color: "var(--s-muted)", font: "11px 'Plus Jakarta Sans', sans-serif" }}>{notice}</div>}
  </div>;
}
