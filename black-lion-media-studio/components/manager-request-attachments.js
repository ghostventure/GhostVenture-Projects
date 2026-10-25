"use client";

import { useEffect, useState } from "react";
import { authenticatedFetch } from "../lib/client-session";

function formatFileDate(value) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function ManagerRequestAttachments({ requestId }) {
  const [opened, setOpened] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const requestAttachments = attachments.filter((attachment) => attachment.source === "request");
  const messageGroups = attachments.filter((attachment) => attachment.source === "message").reduce((groups, attachment) => {
    const messageId = String(attachment.messageId || "unknown");
    groups[messageId] = [...(groups[messageId] || []), attachment];
    return groups;
  }, {});

  useEffect(() => {
    if (!opened || loaded) return undefined;
    let active = true;
    setLoading(true);
    authenticatedFetch(`/api/manager/requests/${encodeURIComponent(requestId)}/attachments`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Request files could not be loaded.");
        if (active) {
          setAttachments(Array.isArray(data.attachments) ? data.attachments : []);
          setLoaded(true);
        }
      })
      .catch((loadError) => { if (active) setError(loadError.message || "Request files could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [opened, loaded, requestId, retryKey]);

  return (
    <section className="manager-request-attachments" aria-label="Client attachments">
      <details onToggle={(event) => setOpened(event.currentTarget.open)}>
        <summary>Client attachments</summary>
        {loading ? <p className="muted" role="status">Loading private files…</p> : null}
        {error ? <div className="notice" role="alert"><p>{error}</p><button type="button" className="button button-secondary" onClick={() => { setError(""); setLoaded(false); setRetryKey((value) => value + 1); }}>Try again</button></div> : null}
        {loaded && !attachments.length ? <p className="muted">No files are attached to this request or its client messages.</p> : null}
        {requestAttachments.length ? (
          <div>
            <h3>Files attached to this request</h3>
            <ul>{requestAttachments.map((attachment) => <AttachmentRow key={attachment.id} attachment={attachment} requestId={requestId} />)}</ul>
          </div>
        ) : null}
        {Object.entries(messageGroups).map(([messageId, files]) => (
          <div key={messageId}>
            <h3>Files attached to client message <code>{messageId}</code></h3>
            <ul>{files.map((attachment) => <AttachmentRow key={attachment.id} attachment={attachment} requestId={requestId} />)}</ul>
          </div>
        ))}
      </details>
    </section>
  );
}

function AttachmentRow({ attachment, requestId }) {
  return (
    <li>
      <div>
        <strong>{attachment.name || "Client file"}</strong>
        <span className="muted"> · {formatFileDate(attachment.createdAt)}</span>
      </div>
      <a className="button button-secondary" href={attachment.downloadUrl || `/api/manager/requests/${encodeURIComponent(requestId)}/attachments/${encodeURIComponent(attachment.id)}`} target="_blank" rel="noreferrer">Download private file</a>
    </li>
  );
}
