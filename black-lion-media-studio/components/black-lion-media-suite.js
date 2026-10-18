import { SpotlightCard, StatusChipRow, SurfaceGrid } from "./shared-ui";

const componentModules = [
  {
    id: "intake-priority",
    title: "Intake Priority",
    group: "Request",
    copy: "Ranks new requests by timing, budget clarity, and client readiness.",
    signals: ["New", "Needs review", "Ready"]
  },
  {
    id: "creative-brief",
    title: "Creative Brief",
    group: "Request",
    copy: "Summarizes goals, deliverables, audience, references, and known constraints.",
    signals: ["Goal", "References", "Deliverables"]
  },
  {
    id: "shoot-prep",
    title: "Shoot Prep",
    group: "Creative",
    copy: "Tracks location, shot list, subject notes, gear needs, and arrival windows.",
    signals: ["Location", "Shot list", "Gear"]
  },
  {
    id: "video-workflow",
    title: "Video Workflow",
    group: "Creative",
    copy: "Keeps capture, edit, revision, export, and delivery steps visible.",
    signals: ["Capture", "Edit", "Deliver"]
  },
  {
    id: "beat-session",
    title: "Beat Session",
    group: "Creative",
    copy: "Frames music-session direction, tempo notes, references, and export needs.",
    signals: ["Tempo", "Mood", "Stems"]
  },
  {
    id: "dj-run",
    title: "DJ Run Sheet",
    group: "Creative",
    copy: "Stores event timing, setup needs, clean/explicit rules, and key moments.",
    signals: ["Event", "Setup", "Cues"]
  },
  {
    id: "membership-site-health",
    title: "Membership Site Health",
    group: "Technical",
    copy: "Checks login, billing, content access, support queue, and launch readiness.",
    signals: ["Access", "Billing", "Content"]
  },
  {
    id: "pc-support",
    title: "PC Support Snapshot",
    group: "Technical",
    copy: "Collects device symptoms, urgency, environment, backup state, and fix path.",
    signals: ["Device", "Issue", "Backup"]
  },
  {
    id: "invoice-readiness",
    title: "Invoice Readiness",
    group: "Billing",
    copy: "Shows whether scope, customer, amount, and payment context are ready.",
    signals: ["Scope", "Amount", "Pay link"]
  },
  {
    id: "file-delivery",
    title: "File Delivery",
    group: "Delivery",
    copy: "Tracks final links, access windows, package names, and recipient notes.",
    signals: ["Links", "Access", "Package"]
  },
  {
    id: "brand-asset-vault",
    title: "Brand Asset Vault",
    group: "Delivery",
    copy: "Keeps logos, fonts, references, colors, and approved client assets together.",
    signals: ["Logo", "Fonts", "Refs"]
  },
  {
    id: "content-calendar",
    title: "Content Calendar",
    group: "Planning",
    copy: "Maps upcoming shoots, edits, drops, posting windows, and client approvals.",
    signals: ["Shoot", "Edit", "Post"]
  },
  {
    id: "client-approval",
    title: "Client Approval Queue",
    group: "Delivery",
    copy: "Separates drafts waiting for client review from work ready to release.",
    signals: ["Draft", "Review", "Approved"]
  },
  {
    id: "message-sla",
    title: "Message SLA",
    group: "Support",
    copy: "Highlights unanswered client messages and expected response windows.",
    signals: ["Open", "Due", "Resolved"]
  },
  {
    id: "booking-availability",
    title: "Booking Availability",
    group: "Scheduling",
    copy: "Shows open consultation windows and service-specific scheduling pressure.",
    signals: ["Open", "Busy", "Full"]
  },
  {
    id: "project-timeline",
    title: "Project Timeline",
    group: "Planning",
    copy: "Turns request, quote, production, approval, invoice, and delivery into one lane.",
    signals: ["Quote", "Work", "Close"]
  },
  {
    id: "scope-change",
    title: "Scope Change",
    group: "Billing",
    copy: "Captures requested changes, pricing impact, approval status, and next step.",
    signals: ["Change", "Price", "Approve"]
  },
  {
    id: "retainer-health",
    title: "Retainer Health",
    group: "Billing",
    copy: "Previews monthly support capacity, used time, deliverables, and renewal notes.",
    signals: ["Hours", "Used", "Renew"]
  },
  {
    id: "merch-drop",
    title: "Merch Drop",
    group: "Store",
    copy: "Tracks drop window, featured product, stock notes, and promotion status.",
    signals: ["Drop", "Stock", "Promo"]
  },
  {
    id: "store-fulfillment",
    title: "Store Fulfillment",
    group: "Store",
    copy: "Keeps order status, shipping profile, payment state, and client messages aligned.",
    signals: ["Order", "Ship", "Message"]
  },
  {
    id: "legal-compliance",
    title: "Legal Compliance",
    group: "Policy",
    copy: "Surfaces privacy, terms, DMCA, refunds, accessibility, and support links.",
    signals: ["Terms", "Privacy", "DMCA"]
  },
  {
    id: "privacy-consent",
    title: "Privacy Consent",
    group: "Policy",
    copy: "Records client communication preferences, consent notes, and data request status.",
    signals: ["Consent", "Email", "Data"]
  },
  {
    id: "accessibility-readiness",
    title: "Accessibility Readiness",
    group: "Policy",
    copy: "Checks page headings, form labels, link clarity, contrast, and keyboard reach.",
    signals: ["Labels", "Contrast", "Keys"]
  },
  {
    id: "dmca-claim",
    title: "DMCA Claim",
    group: "Policy",
    copy: "Guides copyright claim intake, evidence capture, response status, and archive.",
    signals: ["Claim", "Evidence", "Archive"]
  },
  {
    id: "analytics-pulse",
    title: "Analytics Pulse",
    group: "Growth",
    copy: "Summarizes portal starts, request submissions, store visits, and message actions.",
    signals: ["Portal", "Request", "Store"]
  },
  {
    id: "email-alert",
    title: "Email Alert",
    group: "Support",
    copy: "Shows whether client message alerts and SMTP runtime settings are active.",
    signals: ["SMTP", "Alert", "Fallback"]
  },
  {
    id: "session-security",
    title: "Session Security",
    group: "Security",
    copy: "Tracks idle warning, manual sign-out, cross-tab sync, and session handoff.",
    signals: ["Idle", "Sync", "Sign out"]
  },
  {
    id: "manager-queue",
    title: "Manager Queue",
    group: "Manager",
    copy: "Groups client requests by new, active, blocked, invoiced, and closed states.",
    signals: ["New", "Active", "Closed"]
  },
  {
    id: "request-triage",
    title: "Request Triage",
    group: "Manager",
    copy: "Separates quote-ready requests from vague briefs that need more detail.",
    signals: ["Ready", "Clarify", "Hold"]
  },
  {
    id: "client-profile",
    title: "Client Profile",
    group: "Account",
    copy: "Shows identity, contact, business context, saved services, and account status.",
    signals: ["Identity", "Contact", "Status"]
  },
  {
    id: "billing-profile",
    title: "Billing Profile",
    group: "Account",
    copy: "Keeps billing contact, invoice preference, payment context, and tax notes nearby.",
    signals: ["Contact", "Invoice", "Tax"]
  },
  {
    id: "shipping-profile",
    title: "Shipping Profile",
    group: "Account",
    copy: "Supports merch shipping, delivery notes, preferred address, and package alerts.",
    signals: ["Address", "Notes", "Alert"]
  },
  {
    id: "vendor-handoff",
    title: "Vendor Handoff",
    group: "Delivery",
    copy: "Packages client-safe context for outside printers, venues, collaborators, or support.",
    signals: ["Context", "Files", "Contact"]
  },
  {
    id: "content-backup",
    title: "Content Backup",
    group: "Delivery",
    copy: "Tracks where final files, drafts, source assets, and archive references live.",
    signals: ["Final", "Draft", "Source"]
  },
  {
    id: "launch-checklist",
    title: "Launch Checklist",
    group: "Planning",
    copy: "Confirms content, billing, legal, support, analytics, and backup steps before release.",
    signals: ["Content", "Legal", "Backup"]
  },
  {
    id: "feedback-loop",
    title: "Feedback Loop",
    group: "Support",
    copy: "Collects revision notes, satisfaction checks, testimonials, and next-project ideas.",
    signals: ["Notes", "Review", "Next"]
  },
  {
    id: "referral-source",
    title: "Referral Source",
    group: "Growth",
    copy: "Captures how clients found the studio and which service made them convert.",
    signals: ["Source", "Service", "Value"]
  },
  {
    id: "support-escalation",
    title: "Support Escalation",
    group: "Support",
    copy: "Flags urgent billing, delivery, access, event, and production support issues.",
    signals: ["Urgent", "Owner", "Resolve"]
  },
  {
    id: "follow-up",
    title: "Follow-Up",
    group: "Growth",
    copy: "Schedules check-ins after delivery, invoice close, merch shipment, or consultation.",
    signals: ["Check-in", "Offer", "Book"]
  },
  {
    id: "archive-retention",
    title: "Archive Retention",
    group: "Policy",
    copy: "Shows what project material is retained, archived, removed, or client-delivered.",
    signals: ["Retain", "Archive", "Remove"]
  }
];

function toStatusChips(signals) {
  return signals.map((label, index) => ({
    label,
    tone: index === 0 ? "positive" : index === 1 ? "warning" : "neutral"
  }));
}

function BlackLionMediaModule({ module }) {
  return (
    <SpotlightCard
      className="black-lion-module-card"
      eyebrow={module.group}
      title={module.title}
      copy={module.copy}
    >
      <StatusChipRow items={toStatusChips(module.signals)} />
    </SpotlightCard>
  );
}

export function BlackLionMediaComponentSuite() {
  return (
    <section className="panel black-lion-suite" aria-labelledby="black-lion-component-suite-title">
      <div className="suite-heading">
        <div>
          <p className="label">Black Lion Media Studio components</p>
          <h2 className="editorial-heading" id="black-lion-component-suite-title">
            Forty installed modules for service operations.
          </h2>
        </div>
        <p className="muted">
          These are reusable surfaces for creative production, technical support,
          client accounts, billing, compliance, support, growth, and manager handoff.
        </p>
      </div>
      <SurfaceGrid className="black-lion-module-grid">
        {componentModules.map((module) => (
          <BlackLionMediaModule key={module.id} module={module} />
        ))}
      </SurfaceGrid>
    </section>
  );
}

export const blackLionMediaComponentModules = componentModules;

export const IntakePriorityModule = () => <BlackLionMediaModule module={componentModules[0]} />;
export const CreativeBriefModule = () => <BlackLionMediaModule module={componentModules[1]} />;
export const ShootPrepModule = () => <BlackLionMediaModule module={componentModules[2]} />;
export const VideoWorkflowModule = () => <BlackLionMediaModule module={componentModules[3]} />;
export const BeatSessionModule = () => <BlackLionMediaModule module={componentModules[4]} />;
export const DjRunSheetModule = () => <BlackLionMediaModule module={componentModules[5]} />;
export const MembershipSiteHealthModule = () => <BlackLionMediaModule module={componentModules[6]} />;
export const PcSupportSnapshotModule = () => <BlackLionMediaModule module={componentModules[7]} />;
export const InvoiceReadinessModule = () => <BlackLionMediaModule module={componentModules[8]} />;
export const FileDeliveryModule = () => <BlackLionMediaModule module={componentModules[9]} />;
export const BrandAssetVaultModule = () => <BlackLionMediaModule module={componentModules[10]} />;
export const ContentCalendarModule = () => <BlackLionMediaModule module={componentModules[11]} />;
export const ClientApprovalQueueModule = () => <BlackLionMediaModule module={componentModules[12]} />;
export const MessageSlaModule = () => <BlackLionMediaModule module={componentModules[13]} />;
export const BookingAvailabilityModule = () => <BlackLionMediaModule module={componentModules[14]} />;
export const ProjectTimelineModule = () => <BlackLionMediaModule module={componentModules[15]} />;
export const ScopeChangeModule = () => <BlackLionMediaModule module={componentModules[16]} />;
export const RetainerHealthModule = () => <BlackLionMediaModule module={componentModules[17]} />;
export const MerchDropModule = () => <BlackLionMediaModule module={componentModules[18]} />;
export const StoreFulfillmentModule = () => <BlackLionMediaModule module={componentModules[19]} />;
export const LegalComplianceModule = () => <BlackLionMediaModule module={componentModules[20]} />;
export const PrivacyConsentModule = () => <BlackLionMediaModule module={componentModules[21]} />;
export const AccessibilityReadinessModule = () => <BlackLionMediaModule module={componentModules[22]} />;
export const DmcaClaimModule = () => <BlackLionMediaModule module={componentModules[23]} />;
export const AnalyticsPulseModule = () => <BlackLionMediaModule module={componentModules[24]} />;
export const EmailAlertModule = () => <BlackLionMediaModule module={componentModules[25]} />;
export const SessionSecurityModule = () => <BlackLionMediaModule module={componentModules[26]} />;
export const ManagerQueueModule = () => <BlackLionMediaModule module={componentModules[27]} />;
export const RequestTriageModule = () => <BlackLionMediaModule module={componentModules[28]} />;
export const ClientProfileModule = () => <BlackLionMediaModule module={componentModules[29]} />;
export const BillingProfileModule = () => <BlackLionMediaModule module={componentModules[30]} />;
export const ShippingProfileModule = () => <BlackLionMediaModule module={componentModules[31]} />;
export const VendorHandoffModule = () => <BlackLionMediaModule module={componentModules[32]} />;
export const ContentBackupModule = () => <BlackLionMediaModule module={componentModules[33]} />;
export const LaunchChecklistModule = () => <BlackLionMediaModule module={componentModules[34]} />;
export const FeedbackLoopModule = () => <BlackLionMediaModule module={componentModules[35]} />;
export const ReferralSourceModule = () => <BlackLionMediaModule module={componentModules[36]} />;
export const SupportEscalationModule = () => <BlackLionMediaModule module={componentModules[37]} />;
export const FollowUpModule = () => <BlackLionMediaModule module={componentModules[38]} />;
export const ArchiveRetentionModule = () => <BlackLionMediaModule module={componentModules[39]} />;
