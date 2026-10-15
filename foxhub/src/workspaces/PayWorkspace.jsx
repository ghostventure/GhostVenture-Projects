

import { getContactTrustTier, getTrustRestrictionLine, getTrustTierMeta } from "../rules.js";

import { trustTierBadgeClass, FilteredEmptyState } from "./shared.jsx";
import { moderationBadgeClass } from "./MarketWorkspace.jsx";

export function PayWorkspace({ state, busy, handleWalletAction, runQrFlow, runUtilityCard, selectedThread }) {
  const moderationCases = state.moderationCases || [];
  const blockedCount = moderationCases.filter((item) => item.status === "block").length;
  const reviewCount = moderationCases.filter((item) => item.status === "review").length;
  const activeContact =
    state.contacts.find((contact) => contact.id === selectedThread?.id) ||
    state.contacts.find((contact) => contact.name === selectedThread?.name) ||
    null;
  const activeTrustTier = getContactTrustTier(activeContact || {});
  const billPayProviders = state.utilityBillPayProviders || [];
  const billPayPayments = state.utilityBillPayPayments || [];
  const readyBillers = billPayProviders.filter((item) => item.status === "ready").length;
  return (
    <>
      <section className="surface-row two-up">
        <article className="surface surface-strong">
          <div className="surface-head">
            <p className="card-label">Pay</p>
            <span className="badge">Moderator live</span>
          </div>
          <div className="surface-note">
            Payment actions stay compact and close to conversation, but risky flows get intercepted before money moves.
          </div>
          {activeContact ? (
            <div className="trust-transaction-card">
              <div className="thread-topline">
                <strong>{activeContact.displayName || activeContact.name}</strong>
                <span className={trustTierBadgeClass(activeTrustTier)}>{activeTrustTier} · {getTrustTierMeta(activeTrustTier).label}</span>
              </div>
              <p>{getTrustRestrictionLine(activeTrustTier)}</p>
            </div>
          ) : null}
          <div className="wallet-card">
            <span>Available balance</span>
            <strong>$3,280.55</strong>
            <p>Keep transfers and merchant pay close to conversation so money feels like part of the thread, not a separate tool.</p>
            <div className="moderation-summary">
              <div className="moderation-pill">
                <span>In review</span>
                <strong>{reviewCount}</strong>
              </div>
              <div className="moderation-pill danger">
                <span>Blocked</span>
                <strong>{blockedCount}</strong>
              </div>
            </div>
          </div>
          <div className="inline-actions wrap">
            <button type="button" className="accent-button" onClick={() => void handleWalletAction("send")} disabled={busy}>
              Send
            </button>
            <button type="button" className="ghost-button" onClick={() => void handleWalletAction("add")} disabled={busy}>
              Add cash
            </button>
            <button type="button" className="ghost-button" onClick={() => void handleWalletAction("cashout")} disabled={busy}>
              Cash out
            </button>
            <button type="button" className="ghost-button" onClick={() => void runQrFlow("qr-pay")} disabled={busy}>
              Scan to pay
            </button>
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Moderator layer</p>
            <span className={reviewCount || blockedCount ? "badge review" : "badge subtle"}>
              {moderationCases.length} cases
            </span>
          </div>
          <div className="surface-note">
            If/then rules moderate wallet actions using access state, counterparty trust, thread context, and velocity.
          </div>
          <div className="list-stack">
            <div className="moderation-rule-card">
              <strong>Moderator controls</strong>
              <p>Authenticated access, complete identity, verified thread context, counterparty trust, merchant review state, and rapid wallet velocity.</p>
            </div>
            <div className="inline-actions wrap">
              {state.utilityCards.map((card) => (
                <button key={card.id} type="button" className="ghost-button" onClick={() => void runUtilityCard(card.id)} disabled={busy}>
                  {card.name}
                </button>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className="surface-row two-up">
        <article className="surface surface-strong">
          <div className="surface-head">
            <p className="card-label">Universal bill pay</p>
            <span className="badge">{readyBillers}/{billPayProviders.length} ready</span>
          </div>
          <div className="surface-note">
            Utility service bills share one wallet path for account checks, scheduled payments, autopay, reminders, and receipts.
          </div>
          <div className="list-stack">
            {billPayProviders.map((provider) => (
              <div key={provider.id} className="list-row">
                <div>
                  <strong>{provider.name}</strong>
                  <p>{provider.category} · Acct {provider.accountMask} · Due {provider.dueDate}</p>
                  <p>{provider.memo}</p>
                </div>
                <div className="billpay-side">
                  <div className="amount">{provider.dueAmount}</div>
                  <span className={provider.status === "ready" ? "badge subtle" : "badge review"}>
                    {provider.autopay ? "Autopay" : provider.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="inline-actions wrap">
            <button type="button" className="accent-button" onClick={() => void handleWalletAction("utility")} disabled={busy}>
              Pay next bill
            </button>
            <button type="button" className="ghost-button" onClick={() => void runUtilityCard("billpay")} disabled={busy}>
              Review billers
            </button>
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Bill pay ledger</p>
            <span className="badge subtle">{billPayPayments.length} scheduled</span>
          </div>
          <div className="surface-note">
            Receipt status and payment method stay visible beside the normal wallet activity feed.
          </div>
          <div className="list-stack">
            {billPayPayments.map((payment) => (
              <div key={payment.id} className="list-row">
                <div>
                  <strong>{payment.providerName}</strong>
                  <p>{payment.method} · {payment.scheduledFor}</p>
                  <p>{payment.receiptState}</p>
                </div>
                <div className="billpay-side">
                  <div className="amount">{payment.amount}</div>
                  <span className={payment.status === "scheduled" ? "badge subtle" : "badge review"}>{payment.status}</span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row two-up">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Recent activity</p>
            <span className="badge subtle">{state.walletEvents.length} events</span>
          </div>
          <div className="list-stack">
            {state.walletEvents.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.meta}</p>
                </div>
                <div className="amount">{item.amount}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Moderator queue</p>
            <span className={blockedCount ? "badge block" : reviewCount ? "badge review" : "badge subtle"}>
              {blockedCount ? `${blockedCount} blocked` : reviewCount ? `${reviewCount} held` : "Clear"}
            </span>
          </div>
          <div className="surface-note">
            Users stay on the curated path while risky wallet attempts get logged for operator review.
          </div>
          <div className="list-stack">
            {moderationCases.length ? (
              moderationCases.slice(0, 5).map((item) => (
                <div key={item.id} className="moderation-case">
                  <div className="moderation-case-head">
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.threadName}{item.contactName ? ` · ${item.contactName}` : ""}</p>
                    </div>
                    <span className={moderationBadgeClass(item.status)}>{item.outcomeLabel || item.status}</span>
                  </div>
                  {item.trustTier ? <p className="moderation-tier">Trust tier {item.trustTier}</p> : null}
                  <p className="moderation-copy">{item.detail}</p>
                  <p className="moderation-meta">
                    {item.amount || "No amount"} · {item.createdAtLabel}
                  </p>
                  <p className="moderation-basis">{item.basis}</p>
                  <p className="moderation-next">{item.recommendedAction}</p>
                </div>
              ))
            ) : (
              <div className="moderation-rule-card">
                <strong>No moderator cases yet</strong>
                <p>Allowed wallet actions stay lightweight. Only held or blocked actions are routed into this queue.</p>
              </div>
            )}
          </div>
        </article>
      </section>
      {!state.walletEvents.length && !state.utilityCards.length ? <FilteredEmptyState label="Pay" /> : null}
    </>
  );
}
