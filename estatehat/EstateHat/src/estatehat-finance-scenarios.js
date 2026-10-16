export const FINANCE_SCENARIO_VERSION = 1;
const MAX_SCENARIOS = 50;

export function createFinanceScenario({ toolId, title, inputs, id = `scenario-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, savedAt = new Date().toISOString() }) {
  if (typeof toolId !== "string" || !toolId || typeof title !== "string" || !title) throw new Error("A calculation type is required.");
  if (!inputs || typeof inputs !== "object" || Array.isArray(inputs)) throw new Error("Scenario inputs are invalid.");
  const normalized = Object.fromEntries(Object.entries(inputs).map(([key, value]) => [String(key).slice(0, 60), String(value).slice(0, 120)]));
  if (Object.keys(normalized).length > 30) throw new Error("Scenario has too many inputs.");
  return { id: String(id).slice(0, 100), toolId: toolId.slice(0, 80), title: title.slice(0, 100), inputs: normalized, savedAt: String(savedAt).slice(0, 40) };
}

export function saveFinanceScenario(scenarios, input) {
  if (!Array.isArray(scenarios) || scenarios.length >= MAX_SCENARIOS) throw new Error("The scenario list is full. Remove one before saving another.");
  const scenario = createFinanceScenario(input);
  if (scenarios.some((item) => item.id === scenario.id)) throw new Error("Scenario IDs must be unique.");
  return [scenario, ...scenarios];
}

export function renameFinanceScenario(scenarios, id, title) {
  const name = String(title || "").trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 100);
  if (name.length < 2) throw new Error("Scenario name must contain at least two characters.");
  if (!scenarios.some((item) => item.id === id)) throw new Error("Scenario was not found.");
  return scenarios.map((item) => item.id === id ? { ...item, title: name } : item);
}

export function deleteFinanceScenario(scenarios, id) {
  return (Array.isArray(scenarios) ? scenarios : []).filter((item) => item.id !== id);
}

export function filterFinanceScenarios(scenarios, { query = "", toolId = "all" } = {}) {
  const needle = String(query).trim().toLowerCase();
  return (Array.isArray(scenarios) ? scenarios : []).filter((item) =>
    (toolId === "all" || item.toolId === toolId) &&
    (!needle || `${item.title} ${item.toolId} ${JSON.stringify(item.inputs)}`.toLowerCase().includes(needle))
  );
}

export function exportFinanceScenarios(scenarios, exportedAt = new Date().toISOString()) {
  if (!Array.isArray(scenarios) || scenarios.length > MAX_SCENARIOS) throw new Error("Scenario backup exceeds the supported limit.");
  return JSON.stringify({ schemaVersion: FINANCE_SCENARIO_VERSION, exportedAt, scenarios }, null, 2);
}

export function importFinanceScenarios(text) {
  if (typeof text !== "string" || text.length > 500_000) throw new Error("Scenario backup must be under 500 KB.");
  let data;
  try { data = JSON.parse(text); } catch { throw new Error("This file is not valid JSON."); }
  if (data?.schemaVersion !== FINANCE_SCENARIO_VERSION || !Array.isArray(data.scenarios) || data.scenarios.length > MAX_SCENARIOS) throw new Error("Unsupported or oversized scenario backup.");
  const ids = new Set();
  return data.scenarios.map((raw) => {
    const item = createFinanceScenario(raw);
    if (ids.has(item.id)) throw new Error("Scenario backup has duplicate IDs.");
    ids.add(item.id);
    return item;
  });
}
