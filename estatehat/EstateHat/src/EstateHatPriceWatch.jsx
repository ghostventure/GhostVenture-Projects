"use client";

import { useEffect, useState } from "react";
import { createPriceWatch, deletePriceWatch, exportPriceWatches, filterPriceWatches, importPriceWatches } from "./estatehat-price-watches.js";

const money = (value) => Number.isFinite(Number(value)) ? new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value) : "Unavailable";
const button = { border: "1px solid var(--s-border)", borderRadius: 7, padding: "7px 9px", background: "var(--s-card)", color: "var(--s-dark)", font: "700 11px 'Plus Jakarta Sans', sans-serif", cursor: "pointer" };

export default function EstateHatPriceWatch({ listings = [], savedListingIds = [], userKey = "guest", onNavigate }) {
  const safeUserKey = String(userKey || "guest").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100);
  const storageKey = `estatehat-price-watches-v1-${safeUserKey}`;
  const saved = new Set(savedListingIds.map(String));
  const savedListings = listings.filter((listing) => saved.has(String(listing.id)));
  const [watches, setWatches] = useState(() => {
    if (typeof window === "undefined") return [];
    try { return importPriceWatches(window.localStorage.getItem(storageKey) || '{"schemaVersion":1,"watches":[]}', savedListingIds); } catch { return []; }
  });
  const [listingId, setListingId] = useState(String(savedListings[0]?.id || ""));
  const [targetPrice, setTargetPrice] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const savedIds = new Set(savedListingIds.map(String));
    setWatches((current) => current.filter((watch) => savedIds.has(String(watch.listingId))));
  }, [savedListingIds.join("|")]);
  useEffect(() => { try { window.localStorage.setItem(storageKey, JSON.stringify(watches)); } catch { setNotice("Browser storage is unavailable; download a backup to keep these targets."); } }, [storageKey, watches]);

  function addWatch(event) {
    event.preventDefault();
    const listing = savedListings.find((item) => String(item.id) === listingId);
    try { setWatches((current) => createPriceWatch(current, listing, targetPrice)); setTargetPrice(""); setNotice("Price target saved locally. It will be checked when this page has current listing data."); }
    catch (error) { setNotice(error.message); }
  }
  async function restore(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 200_000) throw new Error("Price watch backup must be under 200 KB.");
      const imported = importPriceWatches(await file.text(), savedListingIds);
      if (watches.length && !window.confirm(`Replace ${watches.length} price targets with ${imported.length} backup targets?`)) { setNotice("Restore cancelled; existing price targets were kept."); return; }
      setWatches(imported); setNotice("Price watch backup restored.");
    } catch (error) { setNotice(error.message); }
    event.target.value = "";
  }
  function download() {
    const url = URL.createObjectURL(new Blob([exportPriceWatches(watches)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "estatehat-price-watches.json"; anchor.click(); URL.revokeObjectURL(url);
    setNotice("Price watch backup downloaded.");
  }

  const visible = filterPriceWatches(watches, listings, { query, status });
  return <div style={{ display: "grid", gap: 9 }}>
    <p style={{ margin: 0, color: "var(--s-muted)", font: "11px/1.5 'Plus Jakarta Sans', sans-serif" }}>Local target-price alerts for saved listings. The app checks current listing data when available; it does not send push alerts or promise a live feed.</p>
    {savedListings.length ? <form onSubmit={addWatch} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(110px,0.7fr) auto", gap: 7 }}>
      <select aria-label="Saved listing for price target" value={listingId} onChange={(event) => setListingId(event.target.value)} style={{ minWidth: 0, padding: 8 }}>
        {savedListings.map((listing) => <option key={listing.id} value={listing.id}>{listing.title || listing.address} · {money(listing.price)}</option>)}
      </select>
      <input aria-label="Target price" type="number" min="1" step="1000" required value={targetPrice} onChange={(event) => setTargetPrice(event.target.value)} placeholder="Target price" style={{ minWidth: 0, padding: 8 }} />
      <button type="submit" style={button}>Add target</button>
    </form> : <div style={{ color: "var(--s-muted)", fontSize: 12 }}>Save a listing to your watchlist first. <button type="button" onClick={() => onNavigate?.("browse")} style={button}>Browse listings</button></div>}
    {watches.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}><input aria-label="Search price targets" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search targets" style={{ flex: "1 1 140px", padding: 7 }} /><select aria-label="Filter price targets" value={status} onChange={(event) => setStatus(event.target.value)} style={{ padding: 7 }}><option value="all">All</option><option value="watching">Watching</option><option value="target-reached">Target reached</option><option value="unavailable">Price unavailable</option></select><button type="button" style={button} onClick={download}>Backup</button><label style={button}>Restore<input aria-label="Restore price target backup" type="file" accept="application/json,.json" onChange={restore} /></label></div>}
    {visible.map((watch) => <div key={watch.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: 8, border: "1px solid var(--s-border)", borderRadius: 7, color: "var(--s-dark)", font: "11px 'Plus Jakarta Sans', sans-serif" }}><span><strong>{watch.title}</strong><br />Target {money(watch.targetPrice)} · Current {money(watch.currentPrice)} · {watch.status === "target-reached" ? "Target reached" : watch.status === "watching" ? `${money(watch.difference)} above target` : "Current price unavailable"}</span><button type="button" aria-label={`Remove price alert for ${watch.title}`} style={button} onClick={() => setWatches((current) => deletePriceWatch(current, watch.id))}>Remove</button></div>)}
    {watches.length > 0 && visible.length === 0 && <p style={{ margin: 0, color: "var(--s-muted)", fontSize: 12 }}>No price targets match these filters.</p>}
    {notice && <div role="status" aria-live="polite" style={{ color: "var(--s-muted)", font: "11px 'Plus Jakarta Sans', sans-serif" }}>{notice}</div>}
  </div>;
}
