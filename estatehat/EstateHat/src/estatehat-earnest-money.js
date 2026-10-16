export const DEPOSIT_BACKUP_VERSION = 1;
export const DEPOSIT_STATUSES = Object.freeze(["planned", "deposited", "refunded"]);

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) throw new Error("Choose a valid due date.");
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error("Choose a valid due date.");
  return value;
}

export function createDepositRecord(input, { id = `deposit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, now = new Date().toISOString() } = {}) {
  const amount = Number(input?.amount);
  const listingId = String(input?.listingId || "").slice(0, 160);
  if (!listingId) throw new Error("Choose a property for this deposit record.");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Deposit amount must be greater than zero.");
  const reference = String(input.reference || "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 100);
  return { id, listingId, amount, dueDate: validDate(input.dueDate), status: DEPOSIT_STATUSES.includes(input.status) ? input.status : "planned", note: String(input.note || "").replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 300), reference, createdAt: now };
}

export function addDepositRecord(records, input, options) {
  if (!Array.isArray(records) || records.length >= 200) throw new Error("The deposit record limit has been reached.");
  const record = createDepositRecord(input, options);
  if (records.some((item) => item.id === record.id)) throw new Error("Deposit record IDs must be unique.");
  return [record, ...records];
}

export function updateDepositStatus(records, id, status) {
  if (!DEPOSIT_STATUSES.includes(status)) throw new Error("Choose a supported deposit status.");
  if (!records.some((item) => item.id === id)) throw new Error("Deposit record was not found.");
  return records.map((item) => item.id === id ? { ...item, status, updatedAt: new Date().toISOString() } : item);
}

export function removeDepositRecord(records, id) {
  return (Array.isArray(records) ? records : []).filter((item) => item.id !== id);
}

export function filterDepositRecords(records, listingId, filter = "all", today = new Date().toISOString().slice(0, 10)) {
  return (Array.isArray(records) ? records : []).filter((item) => String(item.listingId) === String(listingId) && (filter === "all" || (filter === "open" ? item.status === "planned" : item.status === filter) || (filter === "overdue" && item.status === "planned" && item.dueDate < today))).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function summarizeDepositRecords(records, listingId, today = new Date().toISOString().slice(0, 10)) {
  const rows = (Array.isArray(records) ? records : []).filter((item) => String(item.listingId) === String(listingId));
  const planned = rows.filter((item) => item.status === "planned");
  const deposited = rows.filter((item) => item.status === "deposited");
  const refunded = rows.filter((item) => item.status === "refunded");
  return { planned: planned.reduce((sum, item) => sum + item.amount, 0), deposited: deposited.reduce((sum, item) => sum + item.amount, 0), refunded: refunded.reduce((sum, item) => sum + item.amount, 0), outstanding: planned.reduce((sum, item) => sum + item.amount, 0), overdueCount: planned.filter((item) => item.dueDate < today).length, count: rows.length };
}

export function exportDepositRecordsCsv(records) {
  const quote = (value) => { let text = String(value ?? "").replace(/[\r\n]+/g, " "); if (/^[=+\-@]/.test(text)) text = `'${text}`; return `"${text.replace(/"/g, '""')}"`; };
  return [["Property ID", "Amount", "Due date", "Status", "Reference", "Note"], ...(Array.isArray(records) ? records : []).map((item) => [item.listingId, item.amount, item.dueDate, item.status, item.reference, item.note])].map((row) => row.map(quote).join(",")).join("\r\n");
}

export function exportDepositRecords(records) {
  return JSON.stringify({ schemaVersion: DEPOSIT_BACKUP_VERSION, exportedAt: new Date().toISOString(), records }, null, 2);
}

export function importDepositRecords(text) {
  if (typeof text !== "string" || text.length > 500_000) throw new Error("Deposit backup must be under 500 KB.");
  let data; try { data = JSON.parse(text); } catch { throw new Error("This file is not valid JSON."); }
  if (data?.schemaVersion !== DEPOSIT_BACKUP_VERSION || !Array.isArray(data.records) || data.records.length > 200) throw new Error("Unsupported deposit backup.");
  const ids = new Set();
  return data.records.map((item) => {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || ids.has(item.id) || !DEPOSIT_STATUSES.includes(item.status)) throw new Error("Deposit backup contains invalid records.");
    ids.add(item.id);
    return createDepositRecord(item, { id: item.id, now: item.createdAt || data.exportedAt || new Date().toISOString() });
  });
}
