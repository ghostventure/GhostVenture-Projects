export const FEEDBACK_CATEGORIES = Object.freeze(["bug", "idea", "account", "transaction"]);
export const FEEDBACK_SEVERITIES = Object.freeze(["low", "normal", "high", "blocking"]);

const sanitize = (value, length) => typeof value === "string" ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, length) : "";

export function createFeedbackReport(input, route = "/") {
  const category = FEEDBACK_CATEGORIES.includes(input?.category) ? input.category : "";
  const severity = FEEDBACK_SEVERITIES.includes(input?.severity) ? input.severity : "";
  const title = sanitize(input?.title, 120);
  const details = sanitize(input?.details, 3000);
  const steps = sanitize(input?.steps, 1500);
  if (!category || !severity) throw new Error("Choose a report type and severity.");
  if (title.length < 5) throw new Error("Use at least five characters for the report title.");
  if (details.length < 20) throw new Error("Describe what happened in at least 20 characters.");
  return { category, severity, title, details, steps, route: sanitize(route, 200).split(/[?#]/, 1)[0] || "/", createdAt: new Date().toISOString() };
}

export function formatFeedbackMarkdown(report) {
  const safe = (value) => String(value || "").replace(/\r/g, "");
  return ["# EstateHat feedback draft", "", `- Type: ${safe(report.category)}`, `- Severity: ${safe(report.severity)}`, `- Page: ${safe(report.route)}`, `- Created: ${safe(report.createdAt)}`, "", `## ${safe(report.title)}`, "", safe(report.details), "", "## Steps to reproduce", "", safe(report.steps) || "Not provided", "", "This draft was generated in the browser. It has not been sent to EstateHat."].join("\n");
}
