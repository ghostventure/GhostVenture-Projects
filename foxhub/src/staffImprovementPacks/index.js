import { coreOpsStaffImprovements } from "./core-ops.js";
import { workflowIntelStaffImprovements } from "./workflow-intel.js";
import { riskQualityStaffImprovements } from "./risk-quality.js";
import { resilienceGovernanceStaffImprovements } from "./resilience-governance.js";
import { caseSupportExpansionStaffImprovements } from "./case-support-expansion.js";
import { fraudCommerceExpansionStaffImprovements } from "./fraud-commerce-expansion.js";
import { trustPrivacyExpansionStaffImprovements } from "./trust-privacy-expansion.js";
import { platformGovernanceExpansionStaffImprovements } from "./platform-governance-expansion.js";

const packDefinitions = [
  { id: "core-ops", label: "Core Ops", range: "01-10", start: 1, records: coreOpsStaffImprovements },
  { id: "workflow-intel", label: "Workflow Intel", range: "11-20", start: 11, records: workflowIntelStaffImprovements },
  { id: "risk-quality", label: "Risk Quality", range: "21-30", start: 21, records: riskQualityStaffImprovements },
  { id: "resilience-governance", label: "Resilience Governance", range: "31-40", start: 31, records: resilienceGovernanceStaffImprovements },
  { id: "case-support-expansion", label: "Case Support Expansion", range: "41-60", start: 41, records: caseSupportExpansionStaffImprovements },
  { id: "fraud-commerce-expansion", label: "Fraud Commerce Expansion", range: "61-80", start: 61, records: fraudCommerceExpansionStaffImprovements },
  { id: "trust-privacy-expansion", label: "Trust Privacy Expansion", range: "81-100", start: 81, records: trustPrivacyExpansionStaffImprovements },
  { id: "platform-governance-expansion", label: "Platform Governance Expansion", range: "101-120", start: 101, records: platformGovernanceExpansionStaffImprovements }
];

function normalizeToken(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizePriority(value = "") {
  const token = normalizeToken(value);
  if (token === "critical") return "P0";
  if (token === "high") return "P1";
  if (token === "medium") return "P2";
  if (token === "low") return "P3";
  return String(value || "P2").toUpperCase();
}

function normalizeStaffImprovement(record, pack, index) {
  const sequence = Number(record.id) || pack.start + index;
  return {
    ...record,
    id: typeof record.id === "number" ? normalizeToken(record.title) : normalizeToken(record.id || record.title),
    sequence,
    packId: pack.id,
    packLabel: pack.label,
    packRange: pack.range,
    category: String(record.category || "operations"),
    priority: normalizePriority(record.priority),
    riskLevel: String(record.riskLevel || "medium").toLowerCase(),
    controls: Array.isArray(record.controls) ? record.controls : [],
    queues: Array.isArray(record.queues) ? record.queues : [],
    metrics: Array.isArray(record.metrics) ? record.metrics : [],
    staffActions: Array.isArray(record.staffActions) ? record.staffActions : [],
    requiresApproval: Boolean(record.requiresApproval)
  };
}

export const staffImprovementPacks = packDefinitions.map((pack) => ({
  ...pack,
  records: pack.records.map((record, index) => normalizeStaffImprovement(record, pack, index))
}));

export const staffImprovementRoadmap = staffImprovementPacks.flatMap((pack) => pack.records);

export const staffImprovementSummary = {
  total: staffImprovementRoadmap.length,
  approvalRequired: staffImprovementRoadmap.filter((item) => item.requiresApproval).length,
  criticalRisk: staffImprovementRoadmap.filter((item) => item.riskLevel === "critical" || item.riskLevel === "high").length,
  packs: staffImprovementPacks.length
};
