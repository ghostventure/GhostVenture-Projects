

import { COMPLAINT_ZERO_CONTROLS } from "./shared.jsx";

export function MemberAccountControls({
  state,
  busy,
  openProfilePanel,
  setActiveTab,
  respondFriendRequest,
  markNotificationRead,
  revokeDeviceSession,
  openDisputeCase,
  reportTrustSafetyIncident,
  registerBrowserNotifications
}) {
  const profile = state.profile || {};
  const friendRequests = (state.friendRequests || []).slice(0, 4);
  const trustedContacts = (state.contacts || []).slice(0, 4);
  const deviceSessions = (state.deviceSessions || []).slice(0, 4);
  const unreadNotifications = (state.notificationEvents || []).filter((item) => item.status !== "read").slice(0, 4);
  const supportTarget = profile.handle || profile.email || "member";
  const complaintControls = COMPLAINT_ZERO_CONTROLS;

  function openMemberDispute() {
    openDisputeCase?.({
      merchantName: profile.name || profile.handle || "Member support",
      merchantId: supportTarget,
      amount: "$0.00",
      reason: "member_support_request",
      owner: "Member Support",
      detail: "Member opened an account, connection, payment, or service support request from Account Controls."
    });
  }

  function reportSecurityConcern() {
    reportTrustSafetyIncident?.({
      type: "member_security_concern",
      severity: "medium",
      channel: "account_controls",
      owner: "Trust Support",
      contactId: supportTarget,
      detail: "Member reported a security, fraud, impersonation, harassment, or account-access concern from Account Controls."
    });
  }

  function runComplaintControl(control) {
    if (control.id === "feed-control") {
      setActiveTab("hub");
      return;
    }
    if (control.id === "commercial-boundaries") {
      setActiveTab("market");
      return;
    }
    if (control.id === "privacy-account-control") {
      openProfilePanel?.();
      return;
    }
    if (control.id === "attention-notifications") {
      registerBrowserNotifications?.();
      return;
    }
    if (control.id === "support-disputes") {
      openMemberDispute();
      return;
    }
    if (control.id === "safety-moderation" || control.id === "trust-anti-spam") {
      reportTrustSafetyIncident?.({
        type: control.id === "trust-anti-spam" ? "spam_or_scam_report" : "member_safety_report",
        severity: control.id === "trust-anti-spam" ? "high" : "medium",
        channel: "complaint_zero_controls",
        owner: control.id === "trust-anti-spam" ? "Fraud Support" : "Trust Support",
        contactId: supportTarget,
        detail: `Member used ${control.label} for ${control.detail}`
      });
      return;
    }
    openDisputeCase?.({
      merchantName: profile.name || profile.handle || "Member feedback",
      merchantId: supportTarget,
      amount: "$0.00",
      reason: control.id,
      owner: "Product Support",
      detail: `Member submitted ${control.label}: ${control.detail}`
    });
  }

  return (
    <>
    <section className="surface-row member-control-center">
      <article className="surface surface-strong">
        <div className="surface-head">
          <p className="card-label">Account controls</p>
          <span className="badge subtle">Member self-service</span>
        </div>
        <h2>Manage your profile, security, connections, and support.</h2>
        <p className="surface-note">
          These controls are for the signed-in member. They do not expose staff review tools, but they let members manage the parts of FoxHub that belong to them.
        </p>
        <div className="member-control-grid">
          <button type="button" className="member-control-card" onClick={openProfilePanel} disabled={busy}>
            <strong>Profile and account settings</strong>
            <span>Edit your public OneID card, handle, city, links, interests, and profile memory.</span>
          </button>
          <button type="button" className="member-control-card" onClick={() => setActiveTab("circles")} disabled={busy}>
            <strong>Connection permissions</strong>
            <span>Review who wants to connect, accept trusted people, or ignore requests.</span>
          </button>
          <button type="button" className="member-control-card" onClick={() => setActiveTab("chat")} disabled={busy}>
            <strong>Messages and blocks</strong>
            <span>Open conversations, save context, or block a selected direct contact with a reason.</span>
          </button>
          <button type="button" className="member-control-card" onClick={() => registerBrowserNotifications?.()} disabled={busy}>
            <strong>Notification settings</strong>
            <span>Enable browser alerts for account, security, wallet, and support updates.</span>
          </button>
          <button type="button" className="member-control-card" onClick={openMemberDispute} disabled={busy}>
            <strong>Support or dispute help</strong>
            <span>Open a member support request for account, payment, service, or marketplace trouble.</span>
          </button>
          <button type="button" className="member-control-card" onClick={reportSecurityConcern} disabled={busy}>
            <strong>Report security concern</strong>
            <span>Send fraud, impersonation, harassment, or account-access concerns to Trust Support.</span>
          </button>
        </div>
      </article>

      <article className="surface">
        <div className="surface-head">
          <p className="card-label">Connection requests</p>
          <span className="badge subtle">{friendRequests.length} pending</span>
        </div>
        <div className="list-stack">
          {friendRequests.map((request) => (
            <div key={request.id} className="list-row compact-row">
              <div>
                <strong>{request.name}</strong>
                <p>{request.handle} · {request.city || "Unknown city"} · {request.mutualCount || 0} mutual</p>
              </div>
              <div className="inline-actions wrap">
                <button type="button" className="ghost-button small" onClick={() => respondFriendRequest?.(request.id, "accept")} disabled={busy}>
                  Accept
                </button>
                <button type="button" className="ghost-button small" onClick={() => respondFriendRequest?.(request.id, "ignore")} disabled={busy}>
                  Ignore
                </button>
              </div>
            </div>
          ))}
          {!friendRequests.length ? <p className="panel-copy">No pending connection requests.</p> : null}
        </div>
      </article>

      <article className="surface">
        <div className="surface-head">
          <p className="card-label">Security and alerts</p>
          <span className="badge subtle">{deviceSessions.length} sessions</span>
        </div>
        <div className="list-stack">
          {deviceSessions.map((item) => (
            <div key={item.id} className="list-row compact-row">
              <div>
                <strong>{item.label}</strong>
                <p>{item.platform} · {item.location} · {item.sessionState}</p>
              </div>
              {item.sessionState !== "revoked" ? (
                <button type="button" className="ghost-button small" onClick={() => revokeDeviceSession?.(item.id)} disabled={busy}>
                  Revoke
                </button>
              ) : <span className="badge subtle">Revoked</span>}
            </div>
          ))}
          {unreadNotifications.map((item) => (
            <div key={item.id} className="list-row compact-row">
              <div>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </div>
              <button type="button" className="ghost-button small" onClick={() => markNotificationRead?.(item.id)} disabled={busy}>
                Mark read
              </button>
            </div>
          ))}
          {!deviceSessions.length && !unreadNotifications.length ? <p className="panel-copy">No active security alerts.</p> : null}
        </div>
      </article>

      <article className="surface">
        <div className="surface-head">
          <p className="card-label">Trusted contacts</p>
          <span className="badge subtle">{trustedContacts.length} visible</span>
        </div>
        <div className="list-stack">
          {trustedContacts.map((contact) => (
            <div key={contact.id} className="list-row compact-row">
              <div>
                <strong>{contact.displayName || contact.name || contact.handle}</strong>
                <p>{contact.handle} · {contact.trustTier || contact.trust || "trust pending"} · {contact.status || "connected"}</p>
              </div>
              <button type="button" className="ghost-button small" onClick={() => setActiveTab("circles")} disabled={busy}>
                Manage
              </button>
            </div>
          ))}
          {!trustedContacts.length ? <p className="panel-copy">Accepted connections will appear here.</p> : null}
        </div>
      </article>
    </section>
    <section className="surface-row">
      <article className="surface">
        <div className="surface-head">
          <p className="card-label">Complaint prevention controls</p>
          <span className="badge subtle">{complaintControls.length} safeguards</span>
        </div>
        <div className="complaint-control-grid">
          {complaintControls.map((control) => (
            <button key={control.id} type="button" className="member-control-card" onClick={() => runComplaintControl(control)} disabled={busy}>
              <strong>{control.label}</strong>
              <span>{control.userAction} - {control.detail}</span>
            </button>
          ))}
        </div>
      </article>
    </section>
    </>
  );
}
