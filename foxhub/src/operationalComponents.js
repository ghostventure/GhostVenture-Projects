const OPERATIONAL_COMPONENT_TOTAL = 4000;
const COMPONENTS_PER_DOMAIN = 100;

const operationalDomains = [
  ["access", "Access", "Auth", "identity, sign-in, staff gates, invite review, account recovery"],
  ["accounts", "Accounts", "Profile", "profile state, member records, onboarding, lifecycle fields"],
  ["admin", "Admin", "Management", "management queues, staff review, founder controls, operator records"],
  ["analytics", "Analytics", "Analytics", "events, funnels, exports, retention, consent-aware metrics"],
  ["audit", "Audit", "Compliance", "audit logs, evidence records, action history, policy traceability"],
  ["billing", "Billing", "Payments", "invoices, deposits, receipts, payment reminders, ledger review"],
  ["booking", "Booking", "Calendar", "availability, reservations, appointment changes, no-show signals"],
  ["catalog", "Catalog", "Services", "service records, categories, pricing context, fulfillment notes"],
  ["chat", "Chat", "Social", "messages, read states, thread health, reply prompts"],
  ["commerce", "Commerce", "Market", "merchant tools, inventory, carts, checkout, fulfillment"],
  ["community", "Community", "Circles", "circles, groups, member trust, local discovery"],
  ["content", "Content", "Media", "posts, moments, stories, clips, uploads, moderation hints"],
  ["crm", "CRM", "Relationships", "customer records, lifecycle, next-best action, contact health"],
  ["data", "Data", "Database", "schema shape, migrations, sync health, data quality"],
  ["devices", "Devices", "Security", "device sessions, browser trust, push endpoint readiness"],
  ["discovery", "Discovery", "Search", "search scopes, nearby records, recommendations, saved searches"],
  ["documents", "Documents", "Vault", "document vault, evidence, file metadata, retention"],
  ["email", "Email", "Notifications", "mail events, invite notices, support messages, digest routing"],
  ["finance", "Finance", "Wallet", "wallet flows, holds, payouts, disputes, reconciliation"],
  ["fraud", "Fraud", "Trust", "risk checks, abuse patterns, transaction holds, account review"],
  ["growth", "Growth", "Marketing", "funnels, conversion nudges, onboarding campaigns, referrals"],
  ["help", "Help", "Support", "support queues, help topics, escalation, client follow-up"],
  ["integrations", "Integrations", "Connectors", "external APIs, webhooks, imports, partner sync"],
  ["inventory", "Inventory", "Merchant", "stock records, availability, merchant catalog, restock alerts"],
  ["jobs", "Jobs", "Work", "gigs, job posts, applications, fulfillment milestones"],
  ["legal", "Legal", "Policy", "terms acceptance, privacy, compliance, recordkeeping"],
  ["local", "Local", "Places", "city records, maps, routes, local commerce, event discovery"],
  ["media", "Media", "Storage", "image handling, compression, asset review, upload resilience"],
  ["moderation", "Moderation", "Safety", "reports, queues, appeals, evidence, decisions"],
  ["mobile", "Mobile", "Mobile", "Expo readiness, mobile lock state, push, compact flows"],
  ["notifications", "Notifications", "Alerts", "push, inbox, digest, unread, escalation signals"],
  ["ops", "Operations", "Back Room", "runbooks, queues, SLAs, handoffs, production checks"],
  ["payments", "Payments", "Pay", "payment intents, settlements, webhook events, refunds"],
  ["performance", "Performance", "Runtime", "load health, caching, offline state, bundle reliability"],
  ["privacy", "Privacy", "Privacy", "consent, minimization, retention, export/delete readiness"],
  ["quality", "Quality", "QA", "smoke checks, regression suites, release evidence"],
  ["reputation", "Reputation", "Trust", "ratings, endorsements, trust tiers, relationship graph"],
  ["search", "Search", "Search", "index jobs, filters, scoring, saved-search alerts"],
  ["security", "Security", "Hardening", "RBAC, claim checks, suspicious activity, rule coverage"],
  ["workflow", "Workflow", "Organizer", "tasks, timelines, checklists, saved workspaces, run states"]
];

function titleCase(value) {
  return String(value)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function buildComponent(domain, index) {
  const [domainKey, domainLabel, surface, scope] = domain;
  const localNumber = index + 1;
  const globalNumber = operationalDomains.indexOf(domain) * COMPONENTS_PER_DOMAIN + localNumber;
  const padded = String(localNumber).padStart(3, "0");
  const cycle = ["intake", "queue", "review", "sync", "alert", "report", "handoff", "audit", "recover", "optimize"][index % 10];
  const status = index % 8 === 0 ? "active" : index % 5 === 0 ? "staged" : "ready";

  return {
    key: `ops-${domainKey}-${padded}`,
    name: `${domainLabel} ${titleCase(cycle)} Component ${padded}`,
    surface,
    domain: domainKey,
    domainLabel,
    status,
    order: globalNumber,
    owner: `${domainLabel} Ops`,
    capability: cycle,
    detail: `Operational ${cycle} helper for ${scope}. Installed as component ${globalNumber} of ${OPERATIONAL_COMPONENT_TOTAL}.`
  };
}

export const operationalComponentCatalog = operationalDomains.flatMap((domain) =>
  Array.from({ length: COMPONENTS_PER_DOMAIN }, (_, index) => buildComponent(domain, index))
);

export const operationalComponentDomains = operationalDomains.map(([key, label, surface, scope]) => ({
  key,
  label,
  surface,
  scope,
  count: COMPONENTS_PER_DOMAIN
}));

export const operationalComponentSummary = {
  total: operationalComponentCatalog.length,
  domains: operationalComponentDomains.length,
  perDomain: COMPONENTS_PER_DOMAIN
};

export function findOperationalComponent(componentKey) {
  return operationalComponentCatalog.find((component) => component.key === componentKey) || null;
}

export function summarizeOperationalComponents(components = operationalComponentCatalog) {
  return components.reduce((summary, component) => {
    summary.bySurface[component.surface] = (summary.bySurface[component.surface] || 0) + 1;
    summary.byStatus[component.status] = (summary.byStatus[component.status] || 0) + 1;
    summary.byDomain[component.domainLabel] = (summary.byDomain[component.domainLabel] || 0) + 1;
    return summary;
  }, {
    total: components.length,
    bySurface: {},
    byStatus: {},
    byDomain: {}
  });
}
