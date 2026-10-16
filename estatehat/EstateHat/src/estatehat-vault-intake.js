const ACCEPTED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
export const VAULT_INTAKE_MAX_FILE_BYTES = 15 * 1024 * 1024;
export const VAULT_INTAKE_MAX_RECORDS = 12;

export function prepareVaultIntake(files, context, existing = [], now = new Date()) {
  const known = new Set(existing.map((item) => `${item.name}:${item.byteSize}:${item.lastModified}`));
  const available = Math.max(0, VAULT_INTAKE_MAX_RECORDS - existing.length);
  const added = []; const rejected = [];
  for (const file of Array.from(files || [])) {
    const identity = `${file.name}:${file.size}:${file.lastModified}`;
    let reason = "";
    if (!ACCEPTED_TYPES.has(file.type)) reason = "Choose a PDF, JPEG, PNG, or WebP file.";
    else if (!file.size) reason = "The selected file is empty.";
    else if (file.size > VAULT_INTAKE_MAX_FILE_BYTES) reason = "Files must be 15 MB or smaller.";
    else if (known.has(identity)) reason = "This file is already in the local intake queue.";
    else if (added.length >= available) reason = `The browser intake queue holds up to ${VAULT_INTAKE_MAX_RECORDS} records.`;
    known.add(identity);
    if (reason) { rejected.push({ name: file.name, reason }); continue; }
    added.push({ id: `intake-${Date.now()}-${added.length}-${Math.random().toString(36).slice(2, 7)}`, name: String(file.name).slice(0, 240), byteSize: file.size, size: `${(file.size / 1024).toFixed(1)} KB`, type: file.type, lastModified: file.lastModified, time: now.toISOString(), category: String(context.category || "transaction"), docType: String(context.docType || "Document"), priority: String(context.priority || "normal"), property: String(context.property || ""), transaction: String(context.transaction || ""), isLocalIntake: true });
  }
  return { added, rejected };
}

export function removeVaultIntake(records, id) {
  return (Array.isArray(records) ? records : []).filter((item) => item.id !== id);
}

export function exportVaultIntakeCsv(records) {
  const quote = (value) => {
    let text = String(value ?? "").replace(/[\r\n]+/g, " ");
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [["File name", "Type", "Size bytes", "Category", "Packet type", "Priority", "Property", "Transaction", "Added"], ...(Array.isArray(records) ? records : []).map((item) => [item.name, item.type, item.byteSize, item.category, item.docType, item.priority, item.property, item.transaction, item.time])].map((row) => row.map(quote).join(",")).join("\r\n");
}
