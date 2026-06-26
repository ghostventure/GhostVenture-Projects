"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock3, Inbox, Mail, MessageSquareText, Send, UserRound } from "lucide-react";
import { ClientNav } from "./client-nav";
import { authenticatedFetch } from "../lib/client-session";
import { trackEvent } from "../lib/client-analytics";
import { postJson } from "../lib/client-api";
import { FormHint } from "./shared-ui";

const emptyState = { user: null, messages: [] };

export function MessagesApp({ initialState = null }) {
  const router = useRouter();
  const [state, setState] = useState(initialState || emptyState);
  const [loading, setLoading] = useState(!initialState);
  const [messageNotice, setMessageNotice] = useState("");

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
          messages: messagesData.messages || []
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
    setMessageNotice("");
    const form = event.currentTarget;

    try {
      const formData = new FormData(form);
      const data = await postJson("/api/messages", Object.fromEntries(formData.entries()));
      setState((current) => ({ ...current, messages: data.messages || [] }));
      form.reset();
      setMessageNotice("Message sent.");
      trackEvent("message_sent", { subject: formData.get("subject") });
    } catch (error) {
      setMessageNotice(error.message);
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

  const messageCount = state.messages.length;
  const latestMessage = state.messages[0];
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
              <FormHint>The studio sees this with your account and request history.</FormHint>
              <div className="messages-compose-actions">
                <p className={`message ${messageNotice ? "is-visible" : ""}`}>{messageNotice}</p>
                <button type="submit" className="button">
                  <Send size={18} />
                  Send message
                </button>
              </div>
            </form>
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

          <div className="messages-thread-list">
            {state.messages.length === 0 ? (
              <div className="messages-empty-state">
                <Mail size={22} />
                <strong>No messages yet</strong>
                <p>Send the first note when you need help with a booking, invoice, schedule, or delivery.</p>
              </div>
            ) : (
              state.messages.map((message) => (
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
                    <p>{message.body}</p>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
