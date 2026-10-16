"use client";

import { useState } from "react";
import { createFeedbackReport, formatFeedbackMarkdown } from "./estatehat-feedback.js";

const input = { width: "100%", boxSizing: "border-box", padding: 8, border: "1px solid var(--s-border)", borderRadius: 7, background: "var(--s-input-bg)", color: "var(--s-dark)", font: "12px 'Plus Jakarta Sans', sans-serif" };
const button = { border: "1px solid var(--s-border)", borderRadius: 7, padding: "8px 10px", background: "var(--s-card)", color: "var(--s-dark)", font: "700 11px 'Plus Jakarta Sans', sans-serif", cursor: "pointer" };

export default function EstateHatFeedbackDraft() {
  const [form, setForm] = useState({ category: "bug", severity: "normal", title: "", details: "", steps: "" });
  const [report, setReport] = useState(null);
  const [notice, setNotice] = useState("");
  function prepare(event) {
    event.preventDefault();
    try { setReport(createFeedbackReport(form, window.location.pathname)); setNotice("Feedback draft prepared. Review and download or copy it; nothing was submitted."); }
    catch (error) { setNotice(error.message); }
  }
  function download() {
    const body = formatFeedbackMarkdown(report);
    const url = URL.createObjectURL(new Blob([body], { type: "text/markdown;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "estatehat-feedback-draft.md"; anchor.click(); URL.revokeObjectURL(url);
    setNotice("Feedback draft downloaded. Send it through your preferred support channel.");
  }
  async function copy() {
    try { await navigator.clipboard.writeText(formatFeedbackMarkdown(report)); setNotice("Feedback draft copied to clipboard."); }
    catch { setNotice("Clipboard access is unavailable. Download the draft instead."); }
  }
  return <div style={{ display: "grid", gap: 8 }}>
    <p style={{ margin: 0, color: "var(--s-muted)", font: "11px/1.5 'Plus Jakarta Sans', sans-serif" }}>This prepares a report file in your browser. EstateHat does not send or save it. Avoid including passwords, payment details, or private documents.</p>
    <form onSubmit={prepare} style={{ display: "grid", gap: 7 }}>
      <label>Type<select aria-label="Feedback type" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} style={input}><option value="bug">Bug</option><option value="idea">Idea</option><option value="account">Account access</option><option value="transaction">Transaction blocker</option></select></label>
      <label>Severity<select aria-label="Feedback severity" value={form.severity} onChange={(event) => setForm((current) => ({ ...current, severity: event.target.value }))} style={input}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="blocking">Blocking</option></select></label>
      <label>Title<input aria-label="Feedback title" required minLength={5} maxLength={120} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} style={input} /></label>
      <label>What happened?<textarea aria-label="Feedback details" required minLength={20} maxLength={3000} value={form.details} onChange={(event) => setForm((current) => ({ ...current, details: event.target.value }))} rows={4} style={input} /></label>
      <label>Steps to reproduce (optional)<textarea aria-label="Reproduction steps" maxLength={1500} value={form.steps} onChange={(event) => setForm((current) => ({ ...current, steps: event.target.value }))} rows={3} style={input} /></label>
      <button type="submit" style={button}>Prepare report</button>
    </form>
    {report && <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}><button type="button" style={button} onClick={download}>Download Markdown</button><button type="button" style={button} onClick={copy}>Copy report</button><button type="button" style={button} onClick={() => { setReport(null); setNotice("Draft cleared."); }}>Clear draft</button></div>}
    {notice && <div role="status" aria-live="polite" style={{ color: "var(--s-muted)", font: "11px 'Plus Jakarta Sans', sans-serif" }}>{notice}</div>}
  </div>;
}
