"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock3, Copy, Inbox, Mail, MessageSquareText, RefreshCw, Send, UserRound } from "lucide-react";
import { ClientNav } from "./client-nav";
import { authenticatedFetch } from "../lib/client-session";
import { trackEvent } from "../lib/client-analytics";
import { postJson } from "../lib/client-api";
import { FormHint } from "./shared-ui";
import { RequestAssetsPanel } from "./request-assets-panel";

const emptyState = { user: null, requests: [], messages: [], totalCount: 0, hasMore: false, nextCursor: "" };

function MessageAttachments({ messageId }) {
  const [opened, setOpened] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [error, setError] = useState("");
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!opened || loaded) return undefined;
    let active = true;
    setLoadingAttachments(true);
    authenticatedFetch(`/api/messages/${encodeURIComponent(messageId)}/attachments`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Message attachments could not be loaded.");
        if (active) {
          setAttachments(Array.isArray(data.attachments) ? data.attachments : []);
          setLoaded(true);
        }
      })
      .catch((loadError) => { if (active) setError(loadError.message || "Message attachments could not be loaded."); })
      .finally(() => { if (active) setLoadingAttachments(false); });
    return () => { active = false; };
  }, [opened, loaded, messageId, retryKey]);

  return (
    <details className="message-attachments" onToggle={(event) => setOpened(event.currentTarget.open)}>
      <summary>Attachments</summary>
      {loadingAttachments ? <p className="muted">Loading private attachments…</p> : null}
      {error ? <div className="notice" role="alert"><p>{error}</p><button type="button" className="button button-secondary" onClick={() => { setError(""); setLoaded(false); setRetryKey((value) => value + 1); }}>Try again</button></div> : null}
      {loaded && !attachments.length ? <p className="muted">No files are attached to this message.</p> : null}
      {attachments.length ? (
        <ul>
          {attachments.map((attachment) => <li key={attachment.id}><a href={attachment.downloadUrl || `/api/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachment.id)}`} target="_blank" rel="noreferrer">{attachment.name || "Download attachment"}</a></li>)}
        </ul>
      ) : null}
    </details>
  );
}

export function MessagesApp({ initialState = null }) {
  const router = useRouter();
  const [state, setState] = useState(initialState || emptyState);
  const [loading, setLoading] = useState(!initialState);
  const [messageNotice, setMessageNotice] = useState("");
  const [historyNotice, setHistoryNotice] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [conversationFilter, setConversationFilter] = useState("all");
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [pendingAttachmentFiles, setPendingAttachmentFiles] = useState([]);
  const [pendingAttachmentMessageId, setPendingAttachmentMessageId] = useState("");
  const [attachmentNotice, setAttachmentNotice] = useState("");
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [updatingReadState, setUpdatingReadState] = useState(false);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [copyNotice, setCopyNotice] = useState({ id: "", text: "", success: false });
  const sendingRef = useRef(false);

  useEffect(() => {
    if (initialState) {
      return;
    }

    async function loadSession() {
      try {
        const [sessionResponse, messagesResponse] = await Promise.all([
          authenticatedFetch("/api/me", { cache: "no-store" }),
          authenticatedFetch("/api/messages", { cache: "no-store" })
        ]);

        if (!sessionResponse.ok || !messagesResponse.ok) {
          router.replace("/");
          return;
        }

        const sessionData = await sessionResponse.json();
        const messagesData = await messagesResponse.json();

        setState({
          user: sessionData.user,
          requests: sessionData.requests || [],
          messages: messagesData.messages || [],
          totalCount: messagesData.totalCount || 0,
          hasMore: Boolean(messagesData.hasMore),
          nextCursor: messagesData.nextCursor || ""
        });
      } catch {
        router.replace("/");
      } finally {
        setLoading(false);
      }
    }

    loadSession();
  }, [initialState, router]);

  async function handleMessageSubmit(event) {
    event.preventDefault();
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setMessageNotice("");
    const form = event.currentTarget;

    try {
      const formData = new FormData(form);
      const files = formData.getAll("attachments").filter((file) => file instanceof File && file.size > 0);
      if (files.length > 10) throw new Error("Attach up to 10 files to one message.");
      const tooLarge = files.find((file) => file.size > 10 * 1024 * 1024);
      if (tooLarge) throw new Error(`${tooLarge.name} is larger than the 10 MB limit.`);
      const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
      const unsupported = files.find((file) => !allowedTypes.has(file.type));
      if (unsupported) throw new Error(`${unsupported.name} is not a PDF, JPEG, or PNG file.`);
      const data = await postJson("/api/messages", {
        requestId: String(formData.get("requestId") || ""),
        subject: String(formData.get("subject") || ""),
        body: String(formData.get("body") || "")
      });
      if (!data.message?.id) {
        throw new Error("Message was sent, but the thread could not be updated. Refresh the page to see it.");
      }
      setState((current) => ({
        ...current,
        messages: [data.message, ...current.messages],
        totalCount: (current.totalCount || 0) + 1
      }));
      form.reset();
      setSelectedRequestId("");
      setMessageNotice("Message sent.");
      if (files.length) {
        setPendingAttachmentMessageId(data.message.id);
        const uploadResult = await uploadMessageFiles(data.message.id, files);
        setPendingAttachmentFiles(uploadResult.failed);
        setAttachmentNotice(uploadResult.failed.length
          ? `Message sent, but ${uploadResult.failed.length} ${uploadResult.failed.length === 1 ? "file could not" : "files could not"} be attached. ${uploadResult.errors.join(" ")} Retry the upload below.`
          : `${files.length} ${files.length === 1 ? "file" : "files"} attached to your message.`);
      } else if (!pendingAttachmentFiles.length) setAttachmentNotice("");
      trackEvent("message_sent", { subject: formData.get("subject") });
    } catch (error) {
      setMessageNotice(error.message);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  async function uploadMessageFiles(messageId, files) {
    setUploadingAttachments(true);
    const failed = [];
    const errors = [];
    try {
      for (const file of files) {
        const body = new FormData();
        body.append("file", file, file.name);
        try {
          const response = await authenticatedFetch(`/api/messages/${encodeURIComponent(messageId)}/attachments`, {
            method: "POST",
            body
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(result.error || "Upload failed.");
        } catch (error) {
          failed.push(file);
          errors.push(`${file.name}: ${error.message || "Upload failed."}`);
        }
      }
    } finally {
      setUploadingAttachments(false);
    }
    return { failed, errors };
  }

  async function retryMessageAttachmentUploads() {
    if (!pendingAttachmentMessageId || uploadingAttachments || !pendingAttachmentFiles.length) return;
    const uploadResult = await uploadMessageFiles(pendingAttachmentMessageId, pendingAttachmentFiles);
    setPendingAttachmentFiles(uploadResult.failed);
    setAttachmentNotice(uploadResult.failed.length
      ? `${uploadResult.failed.length} file${uploadResult.failed.length === 1 ? "" : "s"} still could not be attached. ${uploadResult.errors.join(" ")} Try again later.`
      : "All files are now attached to your message.");
  }

  async function handleLoadOlder() {
    if (loadingOlder || refreshing || !state.nextCursor) return;
    setLoadingOlder(true);
    setHistoryNotice("");
    try {
      const response = await authenticatedFetch(
        `/api/messages?cursor=${encodeURIComponent(state.nextCursor)}`,
        { cache: "no-store" }
      );
      if (!response.ok) {
        if (response.status === 401) {
          router.replace("/");
          return;
        }
        throw new Error("Older messages could not be loaded. Please try again.");
      }
      const page = await response.json();
      setState((current) => {
        const seenIds = new Set(current.messages.map((message) => message.id));
        return {
          ...current,
          messages: [...current.messages, ...(page.messages || []).filter((message) => !seenIds.has(message.id))],
          hasMore: Boolean(page.hasMore),
          nextCursor: page.nextCursor || ""
        };
      });
    } catch (error) {
      setHistoryNotice(error.message || "Older messages could not be loaded. Please try again.");
    } finally {
      setLoadingOlder(false);
    }
  }

  async function handleRefreshInbox() {
    if (refreshing || loadingOlder) return;
    setRefreshing(true);
    setHistoryNotice("Refreshing inbox…");
    try {
      const response = await authenticatedFetch("/api/messages", { cache: "no-store" });
      if (!response.ok) {
        if (response.status === 401) {
          router.replace("/");
          return;
        }
        throw new Error("Inbox refresh failed. Please try again.");
      }

      const page = await response.json();
      const latestMessages = Array.isArray(page.messages) ? page.messages : [];
      const knownIds = new Set(state.messages.map((message) => message.id));
      const newCount = latestMessages.filter((message) => !knownIds.has(message.id)).length;
      setState((current) => {
        const latestIds = new Set(latestMessages.map((message) => message.id));
        const mergedMessages = [
          ...latestMessages,
          ...current.messages.filter((message) => !latestIds.has(message.id))
        ];
        const keepLoadedPageCursor = current.hasMore && current.nextCursor;
        return {
          ...current,
          messages: mergedMessages,
          totalCount: Number.isFinite(page.totalCount) ? page.totalCount : current.totalCount,
          hasMore: Boolean(current.hasMore || page.hasMore),
          nextCursor: keepLoadedPageCursor || page.nextCursor || ""
        };
      });
      setHistoryNotice(newCount > 0
        ? `Inbox refreshed. ${newCount} new ${newCount === 1 ? "message" : "messages"} added.`
        : "Inbox refreshed. You are up to date.");
    } catch (error) {
      setHistoryNotice(error.message || "Inbox refresh failed. Please try again.");
    } finally {
      setRefreshing(false);
    }
  }

  async function setConversationReadState(isRead) {
    if (conversationFilter === "all" || updatingReadState) return;
    setUpdatingReadState(true);
    setHistoryNotice("");
    try {
      const response = await authenticatedFetch("/api/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: conversationFilter, isRead })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Conversation read state could not be updated.");
      const changedAt = isRead ? new Date().toISOString() : "";
      setState((current) => ({
        ...current,
        messages: current.messages.map((message) =>
          message.sender_role === "studio" && String(message.request_id || "") === conversationFilter
            ? { ...message, client_read_at: changedAt }
            : message
        )
      }));
      setHistoryNotice(isRead ? "Conversation marked read on this account." : "Conversation marked unread on this account.");
      window.dispatchEvent(new CustomEvent("bls-message-read-state-change", { detail: { unreadCount: data.unreadCount } }));
    } catch (error) {
      setHistoryNotice(error.message || "Conversation read state could not be updated.");
    } finally {
      setUpdatingReadState(false);
    }
  }

  async function handleCopyMessage(message) {
    const text = `${message.subject || ""}\n\n${message.body || ""}`.trim();
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard access is unavailable in this browser.");
      }
      await navigator.clipboard.writeText(text);
      setCopyNotice({ id: message.id, text: "Message copied to clipboard.", success: true });
    } catch {
      setCopyNotice({ id: message.id, text: "Could not copy this message. Check clipboard permissions and try again.", success: false });
    }
  }

  if (loading) {
    return (
      <div className="page-shell">
        <section className="messages-loading-panel">
          <Inbox size={22} />
          <h2>Loading messages...</h2>
        </section>
      </div>
    );
  }

  const messageCount = state.totalCount ?? state.messages.length;
  const latestMessage = state.messages[0];
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase();
  const visibleMessages = state.messages.filter((message) => {
    const matchesSearch = !normalizedSearch || `${message.subject || ""}\n${message.body || ""}`.toLocaleLowerCase().includes(normalizedSearch);
    const matchesConversation = conversationFilter === "all" || String(message.request_id || "") === conversationFilter;
    return matchesSearch && matchesConversation;
  });
  const requestById = new Map((state.requests || []).map((request) => [request.id, request]));
  const supportTypes = [
    "Scheduling",
    "Project details",
    "Billing",
    "Delivery"
  ];

  return (
    <div className="page-shell">
      <ClientNav
        userName={state.user?.fullName || "Client"}
        isBookingManager={Boolean(state.user?.isBookingManager)}
      />

      <main className="messages-workspace">
        <section className="messages-hero-panel">
          <div>
            <p className="label">Messages</p>
            <h1>Studio inbox</h1>
            <p>
              Send project questions, billing notes, scheduling changes, and delivery follow-ups
              directly to Black Lion Studios.
            </p>
          </div>
          <div className="messages-hero-stats" aria-label="Message summary">
            <div>
              <span>Total threads</span>
              <strong>{messageCount}</strong>
            </div>
            <div>
              <span>Latest update</span>
              <strong>{latestMessage ? new Date(latestMessage.created_at).toLocaleDateString() : "None"}</strong>
            </div>
          </div>
        </section>

        <section className="messages-grid">
          <section className="messages-compose-panel" aria-labelledby="compose-message-heading">
            <div className="messages-section-head">
              <div className="messages-icon-badge">
                <Send size={18} />
              </div>
              <div>
                <h2 id="compose-message-heading">New message</h2>
                <p>Keep it clear so the studio can answer faster.</p>
              </div>
            </div>

            <form className="messages-compose-form" onSubmit={handleMessageSubmit}>
              <label>
                Conversation
                <select name="requestId" value={selectedRequestId} onChange={(event) => setSelectedRequestId(event.target.value)}>
                  <option value="">General studio support</option>
                  {(state.requests || []).map((request) => (
                    <option key={request.id} value={request.id}>
                      {request.project_type} · {request.consultation_date || request.status}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Subject
                <input name="subject" type="text" placeholder="Question about my booking" required />
              </label>
              <label>
                Message
                <textarea
                  name="body"
                  rows="9"
                  placeholder="Add the details, dates, service, invoice, or delivery question here."
                  required
                />
              </label>
              <label>
                Files to attach to this message (optional)
                <input name="attachments" type="file" multiple accept="application/pdf,image/png,image/jpeg" disabled={Boolean(pendingAttachmentFiles.length) || uploadingAttachments} />
              </label>
              <FormHint>{pendingAttachmentFiles.length ? "Retry the unsent files from the previous message before attaching files to another message." : "Attach up to 10 PDFs, PNGs, or JPEGs, each no larger than 10 MB. The message is sent first; files are then uploaded privately and linked to it."}</FormHint>
              <FormHint>The studio sees this with your account and request history.</FormHint>
              <div className="messages-compose-actions">
                <p className={`message ${messageNotice ? "is-visible" : ""}`} role="status" aria-live="polite" aria-atomic="true">{messageNotice}</p>
                <button type="submit" className="button" disabled={sending}>
                  <Send size={18} />
                  {sending ? "Sending..." : "Send message"}
                </button>
              </div>
            </form>
            {selectedRequestId ? (
              <div className="message-request-assets">
                <p className="muted">Files uploaded here stay with the selected project request and can be opened from its dashboard history.</p>
                <RequestAssetsPanel requestId={selectedRequestId} />
              </div>
            ) : <p className="muted">To upload a private file, select the related project request above. General support messages do not have file attachments.</p>}
            {attachmentNotice ? (
              <div className="notice" role="status" aria-live="polite">
                <p>{attachmentNotice}</p>
                {pendingAttachmentFiles.length ? <button type="button" className="button button-secondary" disabled={uploadingAttachments} onClick={retryMessageAttachmentUploads}>{uploadingAttachments ? "Retrying uploads…" : "Retry failed file uploads"}</button> : null}
              </div>
            ) : null}
          </section>

          <aside className="messages-side-panel" aria-label="Message support details">
            <div className="messages-section-head">
              <div className="messages-icon-badge">
                <MessageSquareText size={18} />
              </div>
              <div>
                <h2>What to send here</h2>
                <p>Use this inbox for active project support.</p>
              </div>
            </div>

            <div className="messages-topic-list">
              {supportTypes.map((item) => (
                <div className="messages-topic-row" key={item}>
                  <ArrowRight size={16} />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="messages-account-card">
              <UserRound size={18} />
              <div>
                <span>Signed in as</span>
                <strong>{state.user?.fullName || state.user?.email || "Client"}</strong>
                <p>{state.user?.email}</p>
              </div>
            </div>

            <div className="messages-quick-links">
              <a href="/dashboard">Dashboard</a>
              <a href="/profile">Profile</a>
            </div>
          </aside>
        </section>

        <section className="messages-history-panel" aria-labelledby="message-history-heading">
          <div className="messages-section-head">
            <div className="messages-icon-badge">
              <Inbox size={18} />
            </div>
            <div>
              <h2 id="message-history-heading">Message history</h2>
              <p>Your saved thread with the studio.</p>
            </div>
          </div>

          <div className="messages-compose-actions">
            <p className={`message ${historyNotice ? "is-visible" : ""}`} role="status" aria-live="polite" aria-atomic="true">{historyNotice}</p>
            <button className="button button-secondary" type="button" onClick={handleRefreshInbox} disabled={refreshing || loadingOlder} aria-busy={refreshing}>
              <RefreshCw size={16} aria-hidden="true" />
              {refreshing ? "Refreshing inbox..." : "Refresh inbox"}
            </button>
          </div>

          <label className="messages-search-label">
            Search loaded messages
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search subject or message text"
              aria-describedby="messages-search-help messages-search-results"
            />
          </label>
          <label className="messages-search-label">
            Show conversation
            <select value={conversationFilter} onChange={(event) => setConversationFilter(event.target.value)}>
              <option value="all">All conversations</option>
              <option value="">General studio support</option>
              {(state.requests || []).map((request) => (
                <option key={request.id} value={request.id}>{request.project_type} · {request.consultation_date || request.status}</option>
              ))}
            </select>
          </label>
          <div className="messages-compose-actions" aria-label="Conversation read state">
            <button className="button button-secondary" type="button" onClick={() => setConversationReadState(true)} disabled={conversationFilter === "all" || updatingReadState}>
              Mark conversation read
            </button>
            <button className="button button-secondary" type="button" onClick={() => setConversationReadState(false)} disabled={conversationFilter === "all" || updatingReadState}>
              Mark conversation unread
            </button>
          </div>
          <p id="messages-search-help" className="muted">Search covers messages currently loaded in this inbox. Load older messages to include earlier history.</p>
          <p id="messages-search-results" className="muted" role="status" aria-live="polite" aria-atomic="true">
            {normalizedSearch
              ? `${visibleMessages.length} ${visibleMessages.length === 1 ? "match" : "matches"} in ${state.messages.length} loaded ${state.messages.length === 1 ? "message" : "messages"}.`
              : `${state.messages.length} ${state.messages.length === 1 ? "message" : "messages"} loaded.`}
          </p>

          <div className="messages-thread-list">
            {state.messages.length === 0 ? (
              <div className="messages-empty-state">
                <Mail size={22} />
                <strong>No messages yet</strong>
                <p>Send the first note when you need help with a booking, invoice, schedule, or delivery.</p>
              </div>
            ) : visibleMessages.length === 0 ? (
              <div className="messages-empty-state">
                <Mail size={22} />
                <strong>No matching messages</strong>
                <p>Try another subject or phrase. Search only includes messages loaded so far.</p>
              </div>
            ) : (
              visibleMessages.map((message) => (
                <article className="messages-thread-card" key={message.id}>
                  <div className="messages-thread-avatar">
                    {String(message.sender_role || "C").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="messages-thread-body">
                    <div className="messages-thread-meta">
                      <span>{message.sender_role || "client"}</span>
                      <time dateTime={message.created_at}>
                        <Clock3 size={14} />
                        {new Date(message.created_at).toLocaleString()}
                      </time>
                    </div>
                    <h3>{message.subject}</h3>
                    {message.request_id ? <p className="muted">Request: {requestById.get(message.request_id)?.project_type || "Request"}</p> : <p className="muted">General studio support</p>}
                    <p>{message.body}</p>
                    {message.sender_role === "client" ? <MessageAttachments messageId={message.id} /> : null}
                    <div className="messages-compose-actions">
                      <button className="button button-secondary" type="button" onClick={() => handleCopyMessage(message)}>
                        <Copy size={16} aria-hidden="true" />
                        Copy message
                      </button>
                      {copyNotice.id === message.id ? (
                        <p className={`message is-visible${copyNotice.success ? "" : " is-error"}`} role="status" aria-live="polite" aria-atomic="true">
                          {copyNotice.text}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
          {state.hasMore ? (
            <div className="messages-compose-actions">
              <button className="button button-secondary" type="button" onClick={handleLoadOlder} disabled={loadingOlder || refreshing} aria-busy={loadingOlder}>
                {loadingOlder ? "Loading older messages..." : "Load older messages"}
              </button>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
