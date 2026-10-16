const ACCEPTED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 15 * 1024 * 1024;

export function inspectLocalFiles(files, existing = []) {
  const known = new Set(existing.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
  return Array.from(files || []).map((file) => {
    const identity = `${file.name}:${file.size}:${file.lastModified}`;
    let reason = "";
    if (!ACCEPTED_TYPES.has(file.type)) reason = "Choose a PDF, JPEG, PNG, or WebP file.";
    else if (file.size <= 0) reason = "The file is empty.";
    else if (file.size > MAX_FILE_SIZE) reason = "Files must be 15 MB or smaller.";
    else if (known.has(identity)) reason = "This file is already in the queue.";
    known.add(identity);
    return { id: `${identity}:${Math.random().toString(36).slice(2, 8)}`, name: file.name, size: file.size, lastModified: file.lastModified, type: file.type, accepted: !reason, reason, file: reason ? undefined : file };
  });
}

export function formatFileSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
