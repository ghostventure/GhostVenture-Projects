"use client";

import { useCallback, useEffect, useState } from "react";
import { authenticatedFetch } from "../lib/client-session";

function money(amountCents, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: /^[A-Z]{3}$/.test(currency) ? currency : "USD" }).format(Number(amountCents || 0) / 100);
}

function formatDate(value) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function RequestAssetsPanel({ requestId }) {
  const [attachments, setAttachments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [netPaidAmountCents, setNetPaidAmountCents] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [opened, setOpened] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  const refresh = useCallback(async () => {
    const [attachmentResponse, paymentResponse] = await Promise.all([
      authenticatedFetch(`/api/requests/${encodeURIComponent(requestId)}/attachments`, { cache: "no-store" }),
      authenticatedFetch(`/api/requests/${encodeURIComponent(requestId)}/payments`, { cache: "no-store" })
    ]);
    const [attachmentData, paymentData] = await Promise.all([
      attachmentResponse.json().catch(() => ({})),
      paymentResponse.json().catch(() => ({}))
    ]);
    const failures = [];
    if (attachmentResponse.ok) setAttachments(Array.isArray(attachmentData.attachments) ? attachmentData.attachments : []);
    else failures.push(attachmentData.error || "Request files could not be loaded.");
    if (paymentResponse.ok) {
      setPayments(Array.isArray(paymentData.payments) ? paymentData.payments : []);
      setNetPaidAmountCents(Number.isFinite(Number(paymentData.netPaidAmountCents)) ? Number(paymentData.netPaidAmountCents) : null);
      setPaymentStatus(String(paymentData.paymentStatus || ""));
    }
    else failures.push(paymentData.error || "Payment history could not be loaded.");
    if (failures.length) throw new Error(failures.join(" "));
  }, [requestId]);

  useEffect(() => {
    if (!opened) return undefined;
    let active = true;
    setLoading(true);
    setError("");
    refresh().catch((loadError) => { if (active) setError(loadError.message || "Request files and payment history could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh, opened, retryKey]);

  async function upload(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = new FormData(form).get("file");
    if (!(file instanceof File) || !file.size) {
      setError("Choose a PDF, PNG, or JPEG file first.");
      return;
    }
    setUploading(true);
    setNotice("");
    setError("");
    try {
      const response = await authenticatedFetch(`/api/requests/${encodeURIComponent(requestId)}/attachments`, { method: "POST", body: new FormData(form) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The file could not be uploaded.");
      form.reset();
      setNotice("File uploaded to this request.");
      await refresh().catch((refreshError) => setError(`File uploaded, but the latest request files or payment history could not be refreshed. ${refreshError.message}`));
    } catch (uploadError) {
      setError(uploadError.message || "The file could not be uploaded.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="request-assets-panel" aria-label="Request files and payment history">
      <details onToggle={(event) => setOpened(event.currentTarget.open)}>
        <summary>Files and payment history</summary>
        {loading ? <p className="muted">Loading request files and payment history…</p> : null}
        {error ? <div className="notice" role="alert"><p>{error}</p><button type="button" className="button button-secondary" disabled={loading} onClick={() => { setError(""); setRetryKey((value) => value + 1); }}>Retry loading</button></div> : null}
        <div>
          <h4>Private request files</h4>
          <p className="muted">Upload a PDF, PNG, or JPEG up to 10 MB. Files stay private to your account and are available to authorized studio staff; downloads require an active sign-in.</p>
          <form className="form active" onSubmit={upload}>
            <label>Choose a file<input name="file" type="file" accept="application/pdf,image/png,image/jpeg" required /></label>
            <button className="button button-secondary" type="submit" disabled={uploading}>{uploading ? "Uploading…" : "Upload file"}</button>
          </form>
          <ul>
            {attachments.map((attachment) => <li key={attachment.id}><a href={`/api/attachments/${encodeURIComponent(attachment.id)}`} target="_blank" rel="noreferrer">{attachment.name}</a> <span className="muted">· {formatDate(attachment.createdAt)}</span></li>)}
            {!loading && attachments.length === 0 ? <li className="muted">No files attached yet.</li> : null}
          </ul>
        </div>
        <div>
          <h4>Payment and receipt history</h4>
          {netPaidAmountCents !== null || paymentStatus ? (
            <p className="muted" role="status">{paymentStatus ? `Payment status: ${paymentStatus}. ` : ""}{netPaidAmountCents !== null ? `Net paid: ${money(netPaidAmountCents)}.` : ""}</p>
          ) : null}
          <ul>
            {payments.map((payment, index) => (
              <li key={`${payment.paymentId || payment.createdAt}-${index}`}>
                {payment.kind === "refund" ? (
                  <><strong>{String(payment.status || "").toUpperCase() === "COMPLETED" ? "Refunded" : `Refund · ${payment.status || "Update"}`}</strong> · {money(String(payment.status || "").toUpperCase() === "COMPLETED" ? -Number(payment.amountCents || 0) : payment.amountCents, payment.currency)} · {formatDate(payment.createdAt)}</>
                ) : (
                  <><strong>{payment.status || "Payment update"}</strong> · {money(payment.amountCents, payment.currency)} · {formatDate(payment.createdAt)}</>
                )}
                {payment.kind !== "refund" && payment.receiptUrl && /^https:\/\//i.test(payment.receiptUrl) ? <a href={payment.receiptUrl} target="_blank" rel="noreferrer">View Square receipt</a> : null}
              </li>
            ))}
            {!loading && payments.length === 0 ? <li className="muted">No Square payment events have been recorded for this request yet.</li> : null}
          </ul>
        </div>
        {notice ? <p className="message is-visible" role="status" aria-live="polite">{notice}</p> : null}
      </details>
    </section>
  );
}
