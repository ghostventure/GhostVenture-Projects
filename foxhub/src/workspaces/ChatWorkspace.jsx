import { useEffect, useMemo, useState } from "react";

import { getPinnedThreads, getVisibleThreads } from "../rules.js";

import { IMAGE_UPLOAD_ACCEPT, prepareImageAttachment } from "../mediaUploads.js";

import { FilteredEmptyState } from "./shared.jsx";

export function ChatWorkspace({
  state,
  selectedThread,
  chatFilter,
  setChatFilter,
  busy,
  selectThread,
  handleSendMessage,
  handleSaveCurrentContext,
  startDirectThread,
  setActiveTab,
  handleWalletAction,
  blockUser,
  startCallSession
}) {
  const [draftMessage, setDraftMessage] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [attachmentError, setAttachmentError] = useState("");
  const [loadingAttachment, setLoadingAttachment] = useState(false);
  const [inboxLane, setInboxLane] = useState("all");
  const pinnedThreads = getPinnedThreads(state.threads);
  const baseThreads = getVisibleThreads(state.threads, chatFilter);
  const visibleThreads = useMemo(() => {
    if (inboxLane === "all") return baseThreads;
    if (inboxLane === "services") {
      return baseThreads.filter((thread) => thread.type === "official");
    }
    if (inboxLane === "groups") {
      return baseThreads.filter((thread) => thread.type === "community" || thread.type === "private-group");
    }
    if (inboxLane === "money") {
      return baseThreads.filter((thread) => {
        const content = `${thread.name} ${(thread.messages || []).map((message) => message.text).join(" ")}`.toLowerCase();
        return content.includes("wallet") || content.includes("payment") || content.includes("payout") || content.includes("transfer");
      });
    }
    return baseThreads.filter((thread) => thread.type === "direct" || thread.type === "ops");
  }, [baseThreads, inboxLane]);
  const threadMessages = selectedThread?.messages || [];
  const readStateTail = (state.threadReadState || []).slice(0, 6);
  const blockableContact = useMemo(() => {
    if (!selectedThread) return null;
    const byId = (state.contacts || []).find((contact) => contact.id === selectedThread.id);
    if (byId) return byId;
    if (selectedThread.type !== "direct") return null;
    return (state.contacts || []).find((contact) =>
      [contact.name, contact.displayName, contact.handle].filter(Boolean).includes(selectedThread.name)
    ) || null;
  }, [state.contacts, selectedThread]);

  useEffect(() => {
    setDraftMessage("");
    setAttachment(null);
    setAttachmentError("");
    setLoadingAttachment(false);
  }, [selectedThread?.id]);

  const contextActions = useMemo(() => {
    const actions = [];
    if (handleWalletAction) {
      actions.push({
        id: "chat-merchant",
        label: "Log merchant payment",
        detail: "Keeps wallet in sync",
        onClick: () => handleWalletAction("merchant")
      });
      actions.push({
        id: "chat-transfer",
        label: "Send transfer",
        detail: "Start quick move",
        onClick: () => handleWalletAction("send")
      });
    }
    actions.push({
      id: "chat-wallet",
      label: "Open wallet",
      detail: "Ledger view",
      onClick: () => setActiveTab("wallet")
    });
    actions.push({
      id: "chat-save",
      label: "Save context",
      detail: "Pin message",
      onClick: () => handleSaveCurrentContext()
    });
    return actions;
  }, [handleWalletAction, handleSaveCurrentContext, setActiveTab]);

  async function processAttachmentFile(file) {
    if (!file) return;
    setAttachmentError("");
    setLoadingAttachment(true);
    try {
      setAttachment(await prepareImageAttachment(file));
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : "Unable to prepare the image.");
    } finally {
      setLoadingAttachment(false);
    }
  }

  function handleAttachmentSelect(event) {
    void processAttachmentFile(event.target.files?.[0]);
    event.target.value = "";
  }

  function handleAttachmentDrop(event) {
    event.preventDefault();
    void processAttachmentFile(event.dataTransfer?.files?.[0]);
  }

  async function submitMessage(event) {
    event.preventDefault();
    if (!handleSendMessage) return;
    const text = draftMessage.trim();
    if (!text && !attachment) return;
    await handleSendMessage({
      text,
      attachments: attachment ? [attachment] : []
    });
    setDraftMessage("");
    setAttachment(null);
  }

  async function launchCall(mode) {
    if (!selectedThread?.id || !startCallSession) return;
    await startCallSession({
      threadId: selectedThread.id,
      mode,
      participants: Number(selectedThread.members) || 2,
      encryptionState: "device keys established",
      status: "starting"
    });
  }

  async function handleBlockUser() {
    if (!blockUser || !blockableContact) return;
    const reason = window.prompt("Please provide a reason for blocking this user:");
    if (reason === null) return;
    if (!String(reason).trim()) {
      window.alert("A reason is required to block this user.");
      return;
    }
    await blockUser(blockableContact.id, String(reason).trim());
  }

  return (
    <>
      <section className="surface-row two-column-chat">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Chats</p>
            <span className="badge subtle">{visibleThreads.length} threads</span>
          </div>
          <div className="surface-note">Most recent and most active conversations stay together here.</div>
          <div className="chip-filter-row" aria-label="Inbox lanes">
            <button type="button" className={inboxLane === "all" ? "chip-filter active" : "chip-filter"} onClick={() => setInboxLane("all")}>
              All inbox
            </button>
            <button type="button" className={inboxLane === "primary" ? "chip-filter active" : "chip-filter"} onClick={() => setInboxLane("primary")}>
              Primary
            </button>
            <button type="button" className={inboxLane === "groups" ? "chip-filter active" : "chip-filter"} onClick={() => setInboxLane("groups")}>
              Groups
            </button>
            <button type="button" className={inboxLane === "services" ? "chip-filter active" : "chip-filter"} onClick={() => setInboxLane("services")}>
              Services
            </button>
            <button type="button" className={inboxLane === "money" ? "chip-filter active" : "chip-filter"} onClick={() => setInboxLane("money")}>
              Money
            </button>
          </div>
          <div className="chip-filter-row" aria-label="Chat filters">
            <button type="button" className={chatFilter === "all" ? "chip-filter active" : "chip-filter"} onClick={() => setChatFilter("all")}>
              All
            </button>
            <button type="button" className={chatFilter === "unread" ? "chip-filter active" : "chip-filter"} onClick={() => setChatFilter("unread")}>
              Unread
            </button>
            <button type="button" className={chatFilter === "pinned" ? "chip-filter active" : "chip-filter"} onClick={() => setChatFilter("pinned")}>
              Pinned
            </button>
          </div>
          {pinnedThreads.length ? (
            <div className="pinned-thread-strip" aria-label="Pinned threads">
              {pinnedThreads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  className={thread.id === state.selectedThreadId ? "pinned-thread-chip active" : "pinned-thread-chip"}
                  onClick={() => selectThread(thread.id)}
                >
                  <strong>{thread.name}</strong>
                  <span>{thread.unreadCount ? `${thread.unreadCount} unread` : thread.type}</span>
                </button>
              ))}
            </div>
          ) : null}
          <div className="thread-list">
            {visibleThreads.map((thread) => {
              const lastMessage = thread.messages[thread.messages.length - 1];
              return (
                <button
                  key={thread.id}
                  type="button"
                  className={thread.id === state.selectedThreadId ? "thread-item active" : "thread-item"}
                  onClick={() => selectThread(thread.id)}
                >
                  <div className="thread-topline">
                    <strong>{thread.name}</strong>
                    <span className={`presence-chip ${thread.presenceState || "away"}`}>{thread.presence}</span>
                  </div>
                  <p>{lastMessage.text}</p>
                  <div className="thread-bottomline">
                    <span>{thread.lastActiveLabel || thread.type}</span>
                    {thread.unreadCount ? <b className="unread-badge">{thread.unreadCount}</b> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Service channels</p>
            <span className="badge subtle">{state.threads.filter((thread) => thread.type === "official").length} active</span>
          </div>
          <div className="list-stack">
            {state.threads
              .filter((thread) => thread.type === "official")
              .map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  className={thread.id === state.selectedThreadId ? "list-button active" : "list-button"}
                  onClick={() => {
                    selectThread(thread.id);
                    setActiveTab("chat");
                  }}
                >
                  <strong>{thread.name}</strong>
                  <p>{thread.messages[thread.messages.length - 1]?.text || "No updates yet."}</p>
                  <span>{thread.lastActiveLabel || thread.presence}</span>
                </button>
              ))}
          </div>
        </article>

        <article className="surface surface-chat">
          <div className="surface-head">
            <p className="card-label">Conversation</p>
            <span className="badge subtle">{selectedThread?.type || "thread"}</span>
          </div>
          <div className="surface-note">Keep messages, saves, and next actions close to the same thread.</div>
          <div className="chat-header">
            <div>
              <strong>{selectedThread?.name || "No thread selected"}</strong>
              <p>{selectedThread?.members ? `${selectedThread.members} members · ${selectedThread.presence}` : "Open any thread to begin"}</p>
            </div>
            <div className="inline-actions">
              <button type="button" className="ghost-button small" onClick={() => void handleSaveCurrentContext()} disabled={busy}>
                Save
              </button>
              <button type="button" className="ghost-button small" onClick={() => void startDirectThread("isa")} disabled={busy}>
                New chat
              </button>
              <button type="button" className="ghost-button small" onClick={() => void launchCall("voice")} disabled={busy || !selectedThread}>
                Voice
              </button>
              <button type="button" className="ghost-button small" onClick={() => void launchCall("video")} disabled={busy || !selectedThread}>
                Video
              </button>
              <button
                type="button"
                className="danger-button small"
                onClick={() => void handleBlockUser()}
                disabled={busy || !blockableContact}
              >
                Block user
              </button>
            </div>
          </div>
          <div className="chat-context-bar">
            <div className="chat-context-meta">
              <strong>{selectedThread?.name || "Thread context"}</strong>
              <span>{selectedThread?.type || "Chat"} · {selectedThread?.presence || "offline"}</span>
            </div>
            <div className="chat-context-actions">
              {contextActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className="ghost-button small"
                  onClick={action.onClick}
                  disabled={busy}
                >
                  <strong>{action.label}</strong>
                  <span>{action.detail}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="conversation-utility-bar" aria-label="Conversation utilities">
            <button type="button" className="utility-pill" onClick={() => setActiveTab("wallet")}>
              Pay
            </button>
            <button type="button" className="utility-pill" onClick={() => setActiveTab("discover")}>
              Service
            </button>
            <button type="button" className="utility-pill" onClick={() => setActiveTab("hub")}>
              Save
            </button>
            <button type="button" className="utility-pill" onClick={() => setActiveTab("circles")}>
              People
            </button>
          </div>
          <div className="message-stack">
            {threadMessages.map((message) => (
              <div key={message.id} className={message.mine ? "message-bubble mine" : "message-bubble"}>
                <span>{message.author}</span>
                <strong>{message.text}</strong>
                {message.attachments?.length ? (
                  <div className="message-attachment-row">
                    {message.attachments.map((item) => (
                      <div key={item.id || item.name} className="message-attachment">
                        {item.url?.startsWith("data:image") ? (
                          <img src={item.url} alt={item.name || "attachment"} loading="lazy" decoding="async" />
                        ) : (
                          <span>{item.name || "Attachment"}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="message-meta">
                  <p>{message.time}</p>
                  {message.mine && message.status ? <span className="message-status">{message.status}</span> : null}
                </div>
              </div>
            ))}
          </div>
          <form className="composer" onSubmit={submitMessage}>
            <div className="composer-controls">
              <label className="attachment-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={handleAttachmentDrop}>
                <input type="file" accept={IMAGE_UPLOAD_ACCEPT} onChange={handleAttachmentSelect} />
                {loadingAttachment ? "Optimizing..." : "Attach photo"}
                <span>JPG, PNG, GIF, SVG</span>
              </label>
              <input
                type="text"
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
                placeholder="Type a message"
              />
              <button type="submit" className="accent-button" disabled={busy}>
                Send
              </button>
            </div>
            {attachmentError ? <p className="error-text">{attachmentError}</p> : null}
            {attachment ? (
              <div className="attachment-preview">
                <div>
                  <strong>{attachment.name}</strong>
                  <button type="button" className="ghost-button small" onClick={() => setAttachment(null)}>
                    Remove
                  </button>
                </div>
                {attachment.url?.startsWith("data:image") ? (
                  <img src={attachment.url} alt={attachment.name} loading="lazy" decoding="async" />
                ) : (
                  <span>{attachment.name}</span>
                )}
              </div>
            ) : null}
          </form>
        </article>
      </section>
      <section className="surface-row">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Read state</p>
            <span className="badge subtle">{readStateTail.length} tracked</span>
          </div>
          <div className="surface-note">
            Recent thread read markers stay visible here so message state is not buried behind unread badges only.
          </div>
          <div className="list-stack">
            {readStateTail.map((entry) => (
              <div key={entry.threadId} className="list-row">
                <div>
                  <strong>{state.threads.find((thread) => thread.id === entry.threadId)?.name || entry.threadId}</strong>
                  <p>{entry.lastReadAt ? new Date(entry.lastReadAt).toLocaleString() : "No read timestamp"}</p>
                </div>
                <div className="row-meta-text">{entry.unreadCount || 0} unread</div>
              </div>
            ))}
            {!readStateTail.length ? <p className="panel-copy">No thread read-state records yet.</p> : null}
          </div>
        </article>
      </section>
      <section className="surface-row">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Call sessions</p>
            <span className="badge subtle">{(state.callSessions || []).length} active or recent</span>
          </div>
          <div className="list-stack">
            {(state.callSessions || []).slice(0, 6).map((call) => (
              <div key={call.id} className="list-row">
                <div>
                  <strong>{call.mode} call</strong>
                  <p>{call.threadId} · {call.encryptionState}</p>
                </div>
                <div className="row-meta-text">{call.status}</div>
              </div>
            ))}
          </div>
        </article>
      </section>
      <section className="surface-row">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Call history</p>
            <span className="badge subtle">{(state.callLogs || []).length} saved</span>
          </div>
          <div className="list-stack">
            {(state.callLogs || []).slice(0, 6).map((entry) => (
              <div key={entry.id} className="list-row">
                <div>
                  <strong>{entry.mode} call</strong>
                  <p>{entry.contactName || entry.threadId} · {entry.durationLabel || entry.status}</p>
                </div>
                <div className="row-meta-text">{entry.endedAtLabel || entry.status}</div>
              </div>
            ))}
          </div>
        </article>
      </section>
      {!state.threads.length ? <FilteredEmptyState label="Chats" /> : null}
    </>
  );
}
