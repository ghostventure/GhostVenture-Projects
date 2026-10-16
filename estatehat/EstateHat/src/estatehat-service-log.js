export const SERVICE_TYPES = Object.freeze(["HVAC", "Plumbing", "Electrical", "Roof", "Appliances", "Pest control", "Landscaping", "Other"]);
const makeId = () => globalThis.crypto?.randomUUID?.() || `service-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function createServiceRecord(input) {
  const provider = String(input?.provider || "").trim().slice(0, 120);
  const serviceDate = String(input?.serviceDate || "");
  const amount = Number(input?.amount);
  if (provider.length < 2) throw new Error("Enter a provider name with at least two characters.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate) || new Date(`${serviceDate}T00:00:00Z`).toISOString().slice(0, 10) !== serviceDate) throw new Error("Enter a valid service date.");
  if (!Number.isFinite(amount) || amount < 0 || amount > 10000000) throw new Error("Enter an amount between $0 and $10,000,000.");
  return { id: makeId(), provider, serviceDate, amount: Math.round(amount * 100) / 100, type: SERVICE_TYPES.includes(input.type) ? input.type : "Other", notes: String(input.notes || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 500) };
}
export function filterServiceRecords(records, { query = "", type = "all", from = "", to = "" } = {}) {
  const needle = query.trim().toLowerCase();
  return records.filter((record) => (!needle || `${record.provider} ${record.type} ${record.notes}`.toLowerCase().includes(needle)) && (type === "all" || record.type === type) && (!from || record.serviceDate >= from) && (!to || record.serviceDate <= to)).sort((a, b) => b.serviceDate.localeCompare(a.serviceDate) || a.provider.localeCompare(b.provider));
}
export function summarizeServiceRecords(records) {
  const total = records.reduce((sum, record) => sum + Number(record.amount || 0), 0);
  return { count: records.length, total: Math.round(total * 100) / 100, average: records.length ? Math.round((total / records.length) * 100) / 100 : 0, newestDate: records.map((record) => record.serviceDate).sort().at(-1) || "" };
}
export function exportServiceRecordsCsv(records) {
  const cell = (value) => { let text = String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " "); if (/^[\s]*[=+@\-]/.test(text)) text = `'${text}`; return `"${text.replace(/"/g, '""')}"`; };
  return ["Provider,Date,Type,Amount,Notes", ...records.map((record) => [record.provider, record.serviceDate, record.type, record.amount, record.notes].map(cell).join(","))].join("\n");
}
export function restoreServiceRecords(value) {
  if (!Array.isArray(value) || value.length > 1000) throw new Error("Backup must contain at most 1,000 service records.");
  const seen = new Set();
  return value.map((record) => {
    const amount = Number(record?.amount);
    if (!record || typeof record.id !== "string" || !record.id || seen.has(record.id) || typeof record.provider !== "string" || record.provider.length < 2 || !/^\d{4}-\d{2}-\d{2}$/.test(record.serviceDate) || !Number.isFinite(amount) || amount < 0 || !SERVICE_TYPES.includes(record.type)) throw new Error("Backup contains an invalid or duplicate service record.");
    seen.add(record.id);
    return { id: record.id, provider: record.provider.slice(0, 120), serviceDate: record.serviceDate, type: record.type, amount: Math.round(amount * 100) / 100, notes: String(record.notes || "").slice(0, 500) };
  });
}
