import { useState } from "react";

import { hasFoxHubManagementAccess } from "../rules.js";
import { staffImprovementPacks, staffImprovementRoadmap, staffImprovementSummary } from "../staffImprovementPacks/index.js";

import { formatAuditDate, STAFF_ROLE_TEMPLATES, COMPLAINT_ZERO_CONTROLS, FilteredEmptyState } from "./shared.jsx";

export function ManagementWorkspace({
  state,
  busy,
  setActiveTab,
  resolveVerificationCase,
  resolveLocalListing,
  moderateRatingRecord,
  reviewMemberApplication,
  addFoxHubStaffMember,
  runOperatorCopilot,
  recalculateTrustEngine,
  buildNotificationDigest,
  setNotificationPolicy,
  runMerchantRiskCheck,
  updateComplianceControl,
  reviewMerchantSettlement,
  reportTrustSafetyIncident,
  openDisputeCase,
  resolveDisputeCase,
  markNotificationRead,
  revokeDeviceSession,
  evaluateWalletRisk
}) {
  const [staffDraft, setStaffDraft] = useState({
    name: "New FoxHub Staff Member",
    email: "support.staff@foxhub.app",
    role: "support-ops",
    title: "Support Operations Specialist",
    department: "Support Operations",
    scopes: "support, member-review, connections, notifications, account-recovery"
  });
  const reviewRecords = (state.userRecords || []).filter((record) => {
    const stage = String(record.stage || "").toLowerCase();
    const identity = String(record.identityState || "").toLowerCase();
    const tags = (record.tags || []).join(" ").toLowerCase();
    return stage === "review" || stage === "pending" || identity === "review" || tags.includes("pending") || tags.includes("waitlist");
  });
  const activeMembers = (state.userRecords || []).filter((record) => String(record.stage || "").toLowerCase() === "active");
  const applicantQueue = reviewRecords.length ? reviewRecords : (state.userRecords || []).slice(0, 6);
  const verificationQueue = (state.verificationCases || []).filter((item) => ["review", "open", "pending"].includes(String(item.status || "").toLowerCase())).slice(0, 6);
  const moderationQueue = [
    ...(state.moderationCases || []).map((item) => ({ ...item, queueType: "listing" })),
    ...(state.ratingModerationQueue || []).map((item) => ({ ...item, queueType: "rating" }))
  ].filter((item) => !["resolved", "approved", "removed"].includes(String(item.status || "").toLowerCase())).slice(0, 6);
  const applicantEmailNotices = (state.notificationEvents || [])
    .filter((item) => item.category === "email" && item.template === "foxhub_member_application_decision")
    .slice(0, 4);
  const merchantRiskQueue = (state.merchantOnboardingQueue || []).slice(0, 4);
  const settlementQueue = (state.merchantSettlements || []).filter((item) => !["settled", "released"].includes(String(item.status || "").toLowerCase())).slice(0, 4);
  const complianceQueue = (state.compliancePrograms || []).slice(0, 4);
  const auditQueue = (state.auditEvents || []).slice(0, 5);
  const operatorInsights = (state.copilotInsights || []).slice(0, 3);
  const notificationDigest = buildNotificationDigest ? buildNotificationDigest().slice(0, 4) : (state.notificationEvents || []).slice(0, 4);
  const disputeQueue = (state.disputeCases || []).filter((item) => String(item.status || "").toLowerCase() !== "resolved").slice(0, 5);
  const fraudQueue = (state.fraudHoldQueue || []).filter((item) => String(item.status || "").toLowerCase() !== "clear").slice(0, 5);
  const securityQueue = (state.trustSafetyIncidents || []).filter((item) => !["resolved", "closed"].includes(String(item.status || "").toLowerCase())).slice(0, 5);
  const supportNotifications = (state.notificationEvents || []).filter((item) =>
    ["support", "security", "safety", "payments", "risk", "compliance"].includes(String(item.category || "").toLowerCase()) && item.status !== "read"
  ).slice(0, 5);
  const deviceReviewQueue = (state.deviceSessions || []).filter((item) => String(item.sessionState || "").toLowerCase() !== "revoked").slice(0, 5);
  const pendingStaffMembers = (state.pendingStaffMembers || []).slice(0, 5);
  const staffOperatorRecords = (state.operatorAccessRecords || []).filter((item) => item.id !== "operator-access-founder").slice(0, 5);
  const supportMacros = [
    { id: "account-recovery", title: "Account recovery", detail: "Verify email, revoke risky devices, and ask for fresh sign-in." },
    { id: "payment-dispute", title: "Payment dispute", detail: "Open dispute, hold payout if needed, and request evidence." },
    { id: "fraud-report", title: "Fraud report", detail: "Create safety incident, run wallet risk, and preserve audit context." },
    { id: "harassment", title: "Harassment or abuse", detail: "Route to Trust Support, block if needed, and log moderation review." },
    { id: "merchant-onboarding", title: "Merchant onboarding", detail: "Check merchant risk, settlement readiness, and compliance notes." },
    { id: "staff-access", title: "Staff access review", detail: "Review role scope, audit trails, and account security before elevation." }
  ];
  const staffControlLoadout = [
    {
      title: "Access review",
      detail: "Create a staff copilot review for role scope, pending invites, and permission changes.",
      action: () => runOperatorCopilot?.({ title: "Staff access review" })
    },
    {
      title: "Permission audit",
      detail: "Build a notification digest and surface operator-access changes for review.",
      action: () => buildNotificationDigest?.()
    },
    {
      title: "Member application sweep",
      detail: "Run the trust engine before reviewing pending member access.",
      action: () => recalculateTrustEngine?.()
    },
    {
      title: "Fraud hold",
      detail: "Generate a wallet fraud-hold review with velocity and linked-account risk.",
      action: () => evaluateWalletRisk?.({ amount: 2400, velocity: 8, geoAnomaly: true, linkedAccountRisk: true })
    },
    {
      title: "Security incident",
      detail: "Open a high-severity security incident for account takeover or impersonation.",
      action: () => reportTrustSafetyIncident?.({ type: "account_takeover", severity: "high", channel: "staff_controls", owner: "Security Ops", detail: "Staff opened an account takeover investigation from Management." })
    },
    {
      title: "Dispute intake",
      detail: "Open a payment or service dispute case for support investigation.",
      action: () => openDisputeCase?.({ merchantName: "Staff dispute intake", merchantId: "staff-dispute-intake", amount: "$0.00", reason: "staff_dispute_intake", owner: "Dispute Ops", detail: "Staff opened a dispute intake from Management controls." })
    },
    {
      title: "Compliance review",
      detail: "Mark a compliance control reviewed and keep it visible in audit.",
      action: () => updateComplianceControl?.("kyc-program", "reviewed")
    },
    {
      title: "Merchant risk",
      detail: "Run a merchant risk check for onboarding and settlement readiness.",
      action: () => runMerchantRiskCheck?.("merchant-onboarding", "staff controls review")
    },
    {
      title: "Settlement approval",
      detail: "Approve a waiting settlement record when a queue item is available.",
      action: () => settlementQueue[0] ? reviewMerchantSettlement?.(settlementQueue[0].id || settlementQueue[0].settlementId, "approved") : runOperatorCopilot?.({ title: "Settlement readiness review" })
    },
    {
      title: "Device recovery",
      detail: "Revoke the oldest active device session in the recovery queue.",
      action: () => deviceReviewQueue[0] ? revokeDeviceSession?.(deviceReviewQueue[0].id) : reportTrustSafetyIncident?.({ type: "device_recovery_review", severity: "medium", channel: "staff_controls", owner: "Security Ops", detail: "Staff opened a device recovery review." })
    }
  ];
  const complaintZeroStats = [
    { label: "Feed Control", value: (state.uxDiscoveryViews || []).length + (state.uxRoleHomeLayouts || []).length },
    { label: "Commercial Boundaries", value: (state.merchantOnboardingQueue || []).length + (state.listings || []).filter((item) => item.featured).length },
    { label: "Safety and Moderation", value: securityQueue.length + moderationQueue.length },
    { label: "Trust and Anti-Spam", value: fraudQueue.length + (state.merchantRiskSignals || []).length },
    { label: "Privacy and Account Control", value: deviceReviewQueue.length + (state.blockedContacts || []).length },
    { label: "Attention and Notification Health", value: supportNotifications.length + (state.notificationSubscriptions || []).length },
    { label: "Support and Dispute Resolution", value: disputeQueue.length + applicantEmailNotices.length },
    { label: "Product Guardrails", value: (state.auditEvents || []).filter((item) => String(item.action || item.type || "").includes("product")).length }
  ];
  const complaintZeroLoadout = COMPLAINT_ZERO_CONTROLS.map((control) => {
    const actionMap = {
      "feed-control": () => runOperatorCopilot?.({ title: "Feed Control complaint review" }),
      "commercial-boundaries": () => runOperatorCopilot?.({ title: "Commercial boundary audit" }),
      "safety-moderation": () => reportTrustSafetyIncident?.({ type: "harmful_recommendation_review", severity: "high", channel: "complaint_zero_staff", owner: "Trust Ops", detail: "Staff opened a safety and moderation complaint-zero review." }),
      "trust-anti-spam": () => evaluateWalletRisk?.({ amount: 900, velocity: 10, geoAnomaly: false, linkedAccountRisk: true }),
      "privacy-account-control": () => reportTrustSafetyIncident?.({ type: "privacy_or_account_control_review", severity: "medium", channel: "complaint_zero_staff", owner: "Privacy Ops", detail: "Staff opened a privacy/account-control complaint review." }),
      "attention-notifications": () => setNotificationPolicy?.({ mode: "digest", muteLowPriority: true, quietHours: true }),
      "support-disputes": () => openDisputeCase?.({ merchantName: "Complaint-zero support", merchantId: "complaint-zero-support", amount: "$0.00", reason: "support_sla_review", owner: "Support Ops", detail: "Staff opened a support and dispute resolution SLA review." }),
      "product-guardrails": () => runOperatorCopilot?.({ title: "Product guardrails drift review" })
    };
    return {
      ...control,
      action: actionMap[control.id] || (() => runOperatorCopilot?.({ title: `${control.label} review` }))
    };
  });
  const staffImprovementPreview = staffImprovementRoadmap.slice(0, 12);
  const highRiskStaffImprovements = staffImprovementRoadmap.filter((item) => item.requiresApproval || item.riskLevel === "critical" || item.riskLevel === "high");
  const staffStats = [
    { label: "Applications", value: reviewRecords.length },
    { label: "Members", value: activeMembers.length },
    { label: "Verification", value: verificationQueue.length },
    { label: "Moderation", value: moderationQueue.length },
    { label: "Risk", value: (state.merchantRiskSignals || []).length },
    { label: "Support", value: disputeQueue.length + fraudQueue.length + securityQueue.length + supportNotifications.length }
  ];
  const currentProfile = state.profile || {};
  const founderManager = hasFoxHubManagementAccess(currentProfile);
  const founderOperatorRecord = (state.operatorAccessRecords || []).find((item) => item.id === "operator-access-founder" || hasFoxHubManagementAccess(item));
  const staffMemberRecord = state.staffMemberRecord || null;
  const staffDatabaseLabel = staffMemberRecord ? "staffMembers synced" : founderManager || founderOperatorRecord ? "staffMembers pending sync" : "member mode only";
  const managementScopeLabels = founderOperatorRecord?.scopes?.length
    ? founderOperatorRecord.scopes
    : ["members", "verification", "moderation", "billing"];

  function updateStaffDraft(field, value) {
    setStaffDraft((current) => ({ ...current, [field]: value }));
  }

  function applyRoleTemplate(role) {
    const template = STAFF_ROLE_TEMPLATES.find((item) => item.role === role);
    if (!template) {
      updateStaffDraft("role", role);
      return;
    }
    setStaffDraft((current) => ({
      ...current,
      role: template.role,
      title: template.title,
      department: template.department,
      scopes: template.scopes.join(", ")
    }));
  }

  function submitStaffMember(event) {
    event.preventDefault();
    const result = addFoxHubStaffMember?.({
      ...staffDraft,
      scopes: staffDraft.scopes.split(",").map((scope) => scope.trim()).filter(Boolean)
    });
    if (result?.staffRecord) {
      setStaffDraft((current) => ({
        ...current,
        email: result.staffRecord.email,
        name: result.staffRecord.name
      }));
    }
  }

  return (
    <>
      <section className="surface-row two-up staff-console-hero">
        <article className="surface surface-strong">
          <div className="surface-head">
            <p className="card-label">Management dashboard</p>
            <span className="badge subtle">Staff / manager / moderator</span>
          </div>
          <h2>Staff control center for access, trust, risk, and operations.</h2>
          <p className="surface-note">
            Staff and management accounts now stay in operator mode. Member social, rapport, pay, goodies, and public member content are removed from this workspace so the console focuses on review queues and controls.
          </p>
          <div className="staff-stat-grid">
            {staffStats.map((item) => (
              <div key={item.label} className="staff-stat-card">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">{founderManager ? "Operator identity" : "Staff identity"}</p>
            <span className="badge subtle">{founderManager ? "Primary operator" : "Scoped access"}</span>
          </div>
          {founderManager ? (
            <div className="management-profile-card">
              <div>
                <strong>{currentProfile.name || "FoxHub Founder"}</strong>
                <p>{currentProfile.email || "solidartentertainment@gmail.com"}</p>
              </div>
              <div className="staff-profile-facts">
                <span>{staffMemberRecord?.role || currentProfile.role || "founder"}</span>
                <span>{founderOperatorRecord?.state || "active"}</span>
                <span>{staffMemberRecord?.title || currentProfile.accessNote || "Founder management access"}</span>
                  <span>{currentProfile.city || "Location unset"}</span>
              </div>
              <div className="database-mode-grid" aria-label="Profile database split">
                <div>
                  <span>Member database</span>
                  <strong>users/{"{uid}"}</strong>
                  <p>Member profile and app state.</p>
                </div>
                <div>
                  <span>Staff database</span>
                  <strong>{staffDatabaseLabel}</strong>
                  <p>{staffMemberRecord?.department || "Staff identity stays separate."}</p>
                </div>
                <div>
                  <span>Permissions</span>
                  <strong>{founderOperatorRecord ? "operatorAccess active" : "operatorAccess pending"}</strong>
                  <p>Role scopes and admin access.</p>
                </div>
              </div>
              <div className="management-scope-grid">
                {managementScopeLabels.map((scope) => (
                  <span key={scope}>{scope}</span>
                ))}
              </div>
            </div>
          ) : null}
          <div className="staff-action-grid">
            <button type="button" className="action-pill" onClick={() => recalculateTrustEngine?.()}>
              <strong>Run trust engine</strong>
              <p>Recalculate profile, listing, and merchant trust scores for review decisions.</p>
            </button>
            <button type="button" className="action-pill" onClick={() => runOperatorCopilot?.({ title: "Staff console triage" })}>
              <strong>Run operator copilot</strong>
              <p>Create a triage recommendation from open verifications and disputes.</p>
            </button>
            <button type="button" className="action-pill" onClick={() => setNotificationPolicy?.({ mode: "priority", muteLowPriority: true })}>
              <strong>Set priority alerts</strong>
              <p>Mute low-priority noise and keep staff attention on risk, disputes, and compliance.</p>
            </button>
            <button type="button" className="action-pill" onClick={() => setActiveTab("connectors")}>
              <strong>Open staff tools</strong>
              <p>Manage Stripe, API connectors, checks, and integration readiness.</p>
            </button>
            <button type="button" className="action-pill" onClick={() => setActiveTab("blueprint")}>
              <strong>Open control library</strong>
              <p>Find admin, policy, role, permission, moderation, and compliance components.</p>
            </button>
            <button type="button" className="action-pill" onClick={() => buildNotificationDigest?.()}>
              <strong>Build notification digest</strong>
              <p>Sort the current staff notification stream by operational priority.</p>
            </button>
            <button type="button" className="action-pill" onClick={() => reportTrustSafetyIncident?.({ type: "staff_security_sweep", severity: "high", channel: "management", owner: "Trust Ops", detail: "Staff opened a security sweep from Management." })}>
              <strong>Open security sweep</strong>
              <p>Create a trust and safety incident for fraud, impersonation, account takeover, or abuse.</p>
            </button>
            <button type="button" className="action-pill" onClick={() => evaluateWalletRisk?.({ amount: 1800, velocity: 6, geoAnomaly: true, linkedAccountRisk: true })}>
              <strong>Run fraud hold test</strong>
              <p>Generate a wallet-risk review record for fraud operations.</p>
            </button>
          </div>
        </article>
      </section>

      <section className="surface-row two-up staff-member-setup">
        <article className="surface surface-strong">
          <div className="surface-head">
            <p className="card-label">Add new FoxHub Staff Member</p>
            <span className="badge subtle">operatorAccess + staffMembers</span>
          </div>
          <h2>Invite staff and stage their management permissions.</h2>
          <form className="staff-member-form" onSubmit={submitStaffMember}>
            <label>
              <span>Name</span>
              <input type="text" value={staffDraft.name} onChange={(event) => updateStaffDraft("name", event.target.value)} />
            </label>
            <label>
              <span>Staff email</span>
              <input type="email" value={staffDraft.email} onChange={(event) => updateStaffDraft("email", event.target.value)} />
            </label>
            <label>
              <span>Role</span>
              <select value={staffDraft.role} onChange={(event) => applyRoleTemplate(event.target.value)}>
                {STAFF_ROLE_TEMPLATES.map((template) => (
                  <option key={template.role} value={template.role}>{template.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Title</span>
              <input type="text" value={staffDraft.title} onChange={(event) => updateStaffDraft("title", event.target.value)} />
            </label>
            <label>
              <span>Department</span>
              <input type="text" value={staffDraft.department} onChange={(event) => updateStaffDraft("department", event.target.value)} />
            </label>
            <label className="wide-field">
              <span>Permission scopes</span>
              <input type="text" value={staffDraft.scopes} onChange={(event) => updateStaffDraft("scopes", event.target.value)} />
            </label>
            <button type="submit" className="primary-action" disabled={busy || !staffDraft.email.trim()}>
              Add staff member
            </button>
          </form>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Staff setup queue</p>
            <span className="badge subtle">{pendingStaffMembers.length + staffOperatorRecords.length} staged</span>
          </div>
          <div className="list-stack">
            {pendingStaffMembers.map((member) => (
              <div key={member.id} className="list-row compact-row">
                <div>
                  <strong>{member.name}</strong>
                  <p>{member.email} - {member.title || member.role}</p>
                </div>
                <span className="badge review">{member.status || "invited"}</span>
              </div>
            ))}
            {!pendingStaffMembers.length ? (
              <div className="list-row compact-row">
                <div>
                  <strong>New FoxHub Staff Member</strong>
                  <p>support.staff@foxhub.app - Support Operations Specialist</p>
                </div>
                <span className="badge subtle">ready</span>
              </div>
            ) : null}
            {staffOperatorRecords.map((record) => (
              <div key={record.id} className="list-row compact-row">
                <div>
                  <strong>{record.email || record.userId}</strong>
                  <p>{record.role || "staff"} - {(record.scopes || []).join(", ") || "scopes pending"}</p>
                </div>
                <span className="badge subtle">{record.state || "active"}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Staff role library</p>
            <span className="badge subtle">{STAFF_ROLE_TEMPLATES.length} roles</span>
          </div>
          <div className="staff-role-grid">
            {STAFF_ROLE_TEMPLATES.map((template) => (
              <button key={template.role} type="button" className="staff-role-card" onClick={() => applyRoleTemplate(template.role)}>
                <strong>{template.label}</strong>
                <span>{template.title}</span>
                <p>{template.scopes.slice(0, 4).join(", ")}</p>
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row three-up staff-support-ops">
        <article className="surface surface-strong">
          <div className="surface-head">
            <p className="card-label">Support operations</p>
            <span className="badge subtle">{supportNotifications.length + disputeQueue.length} active</span>
          </div>
          <h2>Support, disputes, fraud, and security stay in staff view.</h2>
          <p className="surface-note">
            These controls are intentionally staff-only. They collect member support requests, payment disputes, fraud holds, security incidents, risky devices, and unread operational alerts without sending staff back into member content.
          </p>
          <div className="staff-control-grid">
            <button type="button" className="staff-control-card" onClick={() => openDisputeCase?.({ merchantName: "Member support", merchantId: "member-support", amount: "$0.00", reason: "staff_support_case", owner: "Support Ops", detail: "Staff opened a general support case from Management." })}>
              <strong>Open support case</strong>
              <span>Create a support/dispute case for account, payment, service, or marketplace issues.</span>
            </button>
            <button type="button" className="staff-control-card" onClick={() => reportTrustSafetyIncident?.({ type: "fraud_or_security_report", severity: "high", channel: "support_ops", owner: "Trust Ops", detail: "Staff escalated a fraud, security, impersonation, or abuse concern." })}>
              <strong>Escalate fraud/security</strong>
              <span>Create a trust and safety incident for staff investigation.</span>
            </button>
            <button type="button" className="staff-control-card" onClick={() => setNotificationPolicy?.({ mode: "support-priority", muteLowPriority: true })}>
              <strong>Support priority mode</strong>
              <span>Focus alerts on disputes, fraud, security, compliance, and payment risk.</span>
            </button>
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Support macros</p>
            <span className="badge subtle">{supportMacros.length} playbooks</span>
          </div>
          <div className="list-stack">
            {supportMacros.map((macro) => (
              <div key={macro.id} className="list-row compact-row">
                <div>
                  <strong>{macro.title}</strong>
                  <p>{macro.detail}</p>
                </div>
                <button type="button" className="ghost-button small" onClick={() => runOperatorCopilot?.({ title: `${macro.title} playbook` })} disabled={busy}>
                  Use
                </button>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Support alerts</p>
            <span className="badge subtle">{supportNotifications.length} unread</span>
          </div>
          <div className="list-stack">
            {supportNotifications.map((item) => (
              <div key={item.id} className="list-row compact-row">
                <div>
                  <strong>{item.title || item.subject || "Support alert"}</strong>
                  <p>{item.body || item.emailBody || item.category}</p>
                </div>
                <button type="button" className="ghost-button small" onClick={() => markNotificationRead?.(item.id)} disabled={busy}>
                  Clear
                </button>
              </div>
            ))}
            {!supportNotifications.length ? <p className="panel-copy">No unread support alerts.</p> : null}
          </div>
        </article>
      </section>

      <section className="surface-row">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Loaded staff controls</p>
            <span className="badge subtle">{staffControlLoadout.length} controls</span>
          </div>
          <div className="staff-control-grid loaded-staff-controls">
            {staffControlLoadout.map((control) => (
              <button key={control.title} type="button" className="staff-control-card" onClick={control.action} disabled={busy}>
                <strong>{control.title}</strong>
                <span>{control.detail}</span>
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row two-up complaint-zero-dashboard">
        <article className="surface surface-strong">
          <div className="surface-head">
            <p className="card-label">Complaint-zero dashboard</p>
            <span className="badge subtle">{complaintZeroStats.length} categories</span>
          </div>
          <h2>Track the eight complaint sources before they repeat.</h2>
          <div className="complaint-stat-grid">
            {complaintZeroStats.map((item) => (
              <div key={item.label} className="staff-stat-card">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Complaint-zero staff controls</p>
            <span className="badge subtle">{complaintZeroLoadout.length} actions</span>
          </div>
          <div className="complaint-control-grid">
            {complaintZeroLoadout.map((control) => (
              <button key={control.id} type="button" className="staff-control-card" onClick={control.action} disabled={busy}>
                <strong>{control.label}</strong>
                <span>{control.staffAction} - {control.detail}</span>
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row two-up staff-improvement-roadmap">
        <article className="surface surface-strong">
          <div className="surface-head">
            <p className="card-label">Staff improvement roadmap</p>
            <span className="badge subtle">{staffImprovementSummary.total} controls</span>
          </div>
          <h2>One hundred twenty staff-side upgrades are staged across eight workstreams.</h2>
          <div className="complaint-stat-grid">
            <div className="staff-stat-card">
              <span>Packs</span>
              <strong>{staffImprovementSummary.packs}</strong>
            </div>
            <div className="staff-stat-card">
              <span>Approval required</span>
              <strong>{staffImprovementSummary.approvalRequired}</strong>
            </div>
            <div className="staff-stat-card">
              <span>High risk</span>
              <strong>{staffImprovementSummary.criticalRisk}</strong>
            </div>
            <div className="staff-stat-card">
              <span>Preview</span>
              <strong>{staffImprovementPreview.length}</strong>
            </div>
          </div>
          <div className="staff-role-grid">
            {staffImprovementPacks.map((pack) => (
              <button key={pack.id} type="button" className="staff-role-card" onClick={() => runOperatorCopilot?.({ title: `${pack.label} staff improvement review` })} disabled={busy}>
                <strong>{pack.label}</strong>
                <span>{pack.range}</span>
                <p>{pack.records.length} controls staged for Management review.</p>
              </button>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Next staff controls</p>
            <span className="badge subtle">{highRiskStaffImprovements.length} guarded</span>
          </div>
          <div className="list-stack">
            {staffImprovementPreview.map((item) => (
              <div key={item.id} className="list-row compact-row">
                <div>
                  <strong>{String(item.sequence).padStart(2, "0")}. {item.title}</strong>
                  <p>{item.description}</p>
                  <div className="row-meta-text">{item.packLabel} - {item.owner} - {item.priority}</div>
                </div>
                <button type="button" className="ghost-button small" onClick={() => runOperatorCopilot?.({ title: `${item.title} implementation review` })} disabled={busy}>
                  Review
                </button>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row three-up staff-control-center">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Operator controls</p>
            <span className="badge subtle">Actual staff actions</span>
          </div>
          <div className="staff-control-grid">
            <button type="button" className="staff-control-card" onClick={() => recalculateTrustEngine?.()}>
              <strong>Trust recalculation</strong>
              <span>Refresh trust score engine.</span>
            </button>
            <button type="button" className="staff-control-card" onClick={() => runOperatorCopilot?.({ title: "Access and safety triage" })}>
              <strong>Ops triage</strong>
              <span>Generate staff recommendations.</span>
            </button>
            <button type="button" className="staff-control-card" onClick={() => setActiveTab("connectors")}>
              <strong>Connector setup</strong>
              <span>Open integration controls.</span>
            </button>
            <button type="button" className="staff-control-card" onClick={() => setActiveTab("blueprint")}>
              <strong>Control library</strong>
              <span>Open admin components.</span>
            </button>
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Notification digest</p>
            <span className="badge subtle">{notificationDigest.length} priority</span>
          </div>
          <div className="list-stack">
            {notificationDigest.map((item) => (
              <div key={item.id || item.title} className="list-row compact-row">
                <div>
                  <strong>{item.title || item.subject || "Staff notice"}</strong>
                  <p>{item.body || item.emailBody || item.category || "No detail"}</p>
                </div>
                <span className="badge subtle">{item.category || "system"}</span>
              </div>
            ))}
            {!notificationDigest.length ? <p className="panel-copy">No staff notifications are waiting.</p> : null}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Audit trail</p>
            <span className="badge subtle">{auditQueue.length} recent</span>
          </div>
          <div className="list-stack">
            {auditQueue.map((item) => (
              <div key={item.id || `${item.type}-${item.createdAt}`} className="list-row compact-row">
                <div>
                  <strong>{item.action || item.type || "Audit event"}</strong>
                  <p>{item.detail || item.targetId || "No detail recorded"}</p>
                </div>
                <span className={item.severity === "high" ? "badge review" : "badge subtle"}>{item.severity || "info"}</span>
              </div>
            ))}
            {!auditQueue.length ? <p className="panel-copy">Staff actions and policy events will appear here.</p> : null}
          </div>
        </article>
      </section>

      <section className="surface-row">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">FoxHub Member applications</p>
            <span className="badge subtle">{applicantQueue.length} visible</span>
          </div>
          <div className="surface-note">
            Accepting an application marks the record active; priority gives priority support. Holds and rejects stay visible with audit and notification records.
          </div>
          <div className="staff-application-grid">
            {applicantQueue.map((record) => (
              <div key={record.id} className="staff-application-card">
                <div className="staff-application-head">
                  <div>
                    <strong>{record.profile?.displayName || record.contactId || record.id}</strong>
                    <p>{record.profile?.email || record.contactId || "No email on record"}</p>
                  </div>
                  <span className={String(record.stage || "").toLowerCase() === "active" ? "badge" : "badge review"}>{record.stage || "review"}</span>
                </div>
                <div className="staff-profile-facts">
                  <span>{record.accountType || "member"}</span>
                  <span>{record.profile?.city || "Unknown city"}</span>
                  <span>{record.identityState || "review"}</span>
                  <span>{record.supportTier || "standard"}</span>
                </div>
                <p>{record.notes || "No staff notes yet."}</p>
                <div className="inline-actions wrap">
                  <button type="button" className="ghost-button small" onClick={() => reviewMemberApplication(record.id, "approve")} disabled={busy}>
                    Accept member
                  </button>
                  <button type="button" className="ghost-button small" onClick={() => reviewMemberApplication(record.id, "priority")} disabled={busy}>
                    Priority
                  </button>
                  <button type="button" className="ghost-button small" onClick={() => reviewMemberApplication(record.id, "hold")} disabled={busy}>
                    Hold
                  </button>
                  <button type="button" className="danger-button small" onClick={() => reviewMemberApplication(record.id, "reject")} disabled={busy}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
            {!applicantQueue.length ? <FilteredEmptyState label="member applications" /> : null}
          </div>
        </article>
      </section>

      <section className="surface-row two-up service-panel compliance-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Verification queue</p>
            <span className="badge subtle">{verificationQueue.length} open</span>
          </div>
          <div className="list-stack">
            {verificationQueue.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.label || item.targetId}</strong>
                  <p>{item.targetType} · {item.stage} · {item.owner}</p>
                </div>
                <div className="inline-actions wrap">
                  <button type="button" className="ghost-button small" onClick={() => resolveVerificationCase(item.id, "approved")} disabled={busy}>
                    Approve
                  </button>
                  <button type="button" className="ghost-button small" onClick={() => resolveVerificationCase(item.id, "follow_up")} disabled={busy}>
                    Follow up
                  </button>
                </div>
              </div>
            ))}
            {!verificationQueue.length ? <p className="panel-copy">No verification cases need staff review.</p> : null}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Moderator queue</p>
            <span className="badge subtle">{moderationQueue.length} open</span>
          </div>
          <div className="list-stack">
            {moderationQueue.map((item) => (
              <div key={`${item.queueType}-${item.id || item.recordId}`} className="list-row">
                <div>
                  <strong>{item.title || item.targetId || item.recordId}</strong>
                  <p>{item.reason || item.detail || item.status || "Needs review"}</p>
                </div>
                <div className="inline-actions wrap">
                  {item.queueType === "rating" ? (
                    <>
                      <button type="button" className="ghost-button small" onClick={() => moderateRatingRecord(item.recordId, "approved")} disabled={busy}>
                        Approve
                      </button>
                      <button type="button" className="ghost-button small" onClick={() => moderateRatingRecord(item.recordId, "removed")} disabled={busy}>
                        Remove
                      </button>
                    </>
                  ) : (
                    <button type="button" className="ghost-button small" onClick={() => resolveLocalListing(item.listingId || item.targetId || item.id, "Cleared by staff console")} disabled={busy}>
                      Clear
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!moderationQueue.length ? <p className="panel-copy">No moderator cases need staff review.</p> : null}
          </div>
        </article>
      </section>

      <section className="surface-row three-up staff-control-center">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Merchant risk controls</p>
            <span className="badge subtle">{merchantRiskQueue.length} merchants</span>
          </div>
          <div className="list-stack">
            {merchantRiskQueue.map((item) => (
              <div key={item.merchantId || item.id} className="list-row compact-row">
                <div>
                  <strong>{item.merchantName || item.name || item.merchantId || item.id}</strong>
                  <p>{item.status || item.stage || "Pending risk review"}</p>
                </div>
                <button type="button" className="ghost-button small" onClick={() => runMerchantRiskCheck?.(item.merchantId || item.id, "staff console review")} disabled={busy}>
                  Run risk
                </button>
              </div>
            ))}
            {!merchantRiskQueue.length ? <p className="panel-copy">No merchant onboarding records need risk checks.</p> : null}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Settlement controls</p>
            <span className="badge subtle">{settlementQueue.length} open</span>
          </div>
          <div className="list-stack">
            {settlementQueue.map((item) => (
              <div key={item.id || item.settlementId} className="list-row compact-row">
                <div>
                  <strong>{item.merchantName || item.merchantId || item.id}</strong>
                  <p>{item.amount || "Amount pending"} · {item.status || "review"}</p>
                </div>
                <button type="button" className="ghost-button small" onClick={() => reviewMerchantSettlement?.(item.id || item.settlementId, "approved")} disabled={busy}>
                  Approve
                </button>
              </div>
            ))}
            {!settlementQueue.length ? <p className="panel-copy">No settlements are waiting for staff action.</p> : null}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Compliance controls</p>
            <span className="badge subtle">{complianceQueue.length} controls</span>
          </div>
          <div className="list-stack">
            {complianceQueue.map((item) => (
              <div key={item.id} className="list-row compact-row">
                <div>
                  <strong>{item.name || item.title || item.id}</strong>
                  <p>{item.status || "review"} · {item.owner || "Staff"}</p>
                </div>
                <button type="button" className="ghost-button small" onClick={() => updateComplianceControl?.(item.id, "reviewed")} disabled={busy}>
                  Mark reviewed
                </button>
              </div>
            ))}
            {!complianceQueue.length ? <p className="panel-copy">No compliance controls are configured yet.</p> : null}
          </div>
        </article>
      </section>

      <section className="surface-row three-up staff-support-ops">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Dispute queue</p>
            <span className="badge subtle">{disputeQueue.length} open</span>
          </div>
          <div className="list-stack">
            {disputeQueue.map((item) => (
              <div key={item.id} className="list-row compact-row">
                <div>
                  <strong>{item.merchantName || item.merchantId || item.id}</strong>
                  <p>{item.reason} · {item.amount} · {item.owner || "Support Ops"}</p>
                </div>
                <button type="button" className="ghost-button small" onClick={() => resolveDisputeCase?.(item.id, "resolved")} disabled={busy}>
                  Resolve
                </button>
              </div>
            ))}
            {!disputeQueue.length ? <p className="panel-copy">No open disputes.</p> : null}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Fraud hold queue</p>
            <span className="badge subtle">{fraudQueue.length} held</span>
          </div>
          <div className="list-stack">
            {fraudQueue.map((item) => (
              <div key={item.id} className="list-row compact-row">
                <div>
                  <strong>${Number(item.amount || 0).toFixed(2)} risk review</strong>
                  <p>score {item.riskScore} · velocity {item.velocity} · {item.geoAnomaly ? "geo anomaly" : "normal geo"}</p>
                </div>
                <span className={item.status === "hold" ? "badge review" : "badge subtle"}>{item.status}</span>
              </div>
            ))}
            {!fraudQueue.length ? <p className="panel-copy">No wallet fraud holds are open.</p> : null}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Security concerns</p>
            <span className="badge subtle">{securityQueue.length} active</span>
          </div>
          <div className="list-stack">
            {securityQueue.map((item) => (
              <div key={item.id} className="list-row compact-row">
                <div>
                  <strong>{item.type}</strong>
                  <p>{item.detail} · {item.owner || "Trust Ops"}</p>
                </div>
                <span className={item.severity === "critical" || item.severity === "high" ? "badge review" : "badge subtle"}>{item.severity}</span>
              </div>
            ))}
            {!securityQueue.length ? <p className="panel-copy">No security incidents are active.</p> : null}
          </div>
        </article>
      </section>

      <section className="surface-row">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Device and account recovery review</p>
            <span className="badge subtle">{deviceReviewQueue.length} sessions</span>
          </div>
          <div className="list-stack">
            {deviceReviewQueue.map((item) => (
              <div key={item.id} className="list-row compact-row">
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.platform} · {item.location} · {item.trust} · {item.sessionState}</p>
                </div>
                <button type="button" className="ghost-button small" onClick={() => revokeDeviceSession?.(item.id)} disabled={busy}>
                  Revoke session
                </button>
              </div>
            ))}
            {!deviceReviewQueue.length ? <p className="panel-copy">No active device sessions need review.</p> : null}
          </div>
        </article>
      </section>

      <section className="surface-row">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Operator copilot insights</p>
            <span className="badge subtle">{operatorInsights.length} recent</span>
          </div>
          <div className="list-stack">
            {operatorInsights.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.summary}</p>
                </div>
                <span className="badge subtle">{formatAuditDate(item.createdAt)}</span>
              </div>
            ))}
            {!operatorInsights.length ? <p className="panel-copy">Run operator copilot to create the first triage recommendation.</p> : null}
          </div>
        </article>
      </section>

      <section className="surface-row">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Applicant email notices</p>
            <span className="badge subtle">{applicantEmailNotices.length} recent</span>
          </div>
          <div className="list-stack">
            {applicantEmailNotices.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.subject || item.title}</strong>
                  <p>{item.toEmail || "No recipient"} · {item.deliveryState || "queued"} · {item.emailBody || item.body}</p>
                </div>
                <span className={item.deliveryState === "sent" ? "badge" : "badge review"}>{item.deliveryState || "queued"}</span>
              </div>
            ))}
            {!applicantEmailNotices.length ? <p className="panel-copy">Approval and denial email notices will appear here after manager review.</p> : null}
          </div>
        </article>
      </section>
    </>
  );
}
