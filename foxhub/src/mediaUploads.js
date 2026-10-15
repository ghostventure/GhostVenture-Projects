export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/svg+xml"];
export const ACCEPTED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".svg"];
export const IMAGE_UPLOAD_ACCEPT = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_IMAGE_EXTENSIONS].join(",");
export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;

const RASTER_COMPRESSION_THRESHOLD_BYTES = 700 * 1024;

function getFileExtension(name = "") {
  const match = String(name).toLowerCase().match(/\.[a-z0-9]+$/);
  return match ? match[0] : "";
}

export function normalizeImageType(file = {}) {
  const type = String(file.type || "").toLowerCase();
  if (ACCEPTED_IMAGE_TYPES.includes(type)) return type;
  const extension = getFileExtension(file.name);
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".gif") return "image/gif";
  if (extension === ".svg") return "image/svg+xml";
  return "";
}

export function validateImageUpload(file) {
  if (!file) return "Choose an image to upload.";
  const type = normalizeImageType(file);
  if (!type) return "Use JPG, JPEG, PNG, GIF, or SVG vector images.";
  if (Number(file.size || 0) > MAX_IMAGE_UPLOAD_BYTES) return "Image is too large. Use a file under 10MB.";
  return "";
}

export function isAcceptedImageDataUrl(value = "") {
  const match = String(value || "").match(/^data:([^;,]+)[;,]/i);
  return Boolean(match && ACCEPTED_IMAGE_TYPES.includes(match[1].toLowerCase()));
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read the file."));
    reader.readAsDataURL(file);
  });
}

function readAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read the vector image."));
    reader.readAsText(file);
  });
}

function encodeBase64(value) {
  if (typeof btoa === "function") {
    return btoa(unescape(encodeURIComponent(value)));
  }
  return Buffer.from(value, "utf8").toString("base64");
}

export function sanitizeSvgText(value = "") {
  return String(value || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")
    .replace(/\s(href|xlink:href)\s*=\s*["']javascript:[^"']*["']/gi, "");
}

function sanitizeFileName(name = "Photo") {
  return String(name || "Photo")
    .replace(/[^\w.\- ]+/g, "")
    .trim()
    .slice(0, 120) || "Photo";
}

async function maybeCompressRaster(file, type) {
  if (type === "image/gif" || type === "image/svg+xml" || Number(file.size || 0) < RASTER_COMPRESSION_THRESHOLD_BYTES) {
    return file;
  }
  try {
    const imageCompression = (await import("browser-image-compression")).default;
    return imageCompression(file, {
      maxSizeMB: 1.4,
      maxWidthOrHeight: 1800,
      useWebWorker: true,
      initialQuality: 0.82,
      alwaysKeepResolution: false
    });
  } catch {
    return file;
  }
}

export async function prepareImageAttachment(file) {
  const error = validateImageUpload(file);
  if (error) throw new Error(error);

  const type = normalizeImageType(file);
  const name = sanitizeFileName(file.name || "Photo");

  if (type === "image/svg+xml") {
    const svgText = sanitizeSvgText(await readAsText(file));
    return {
      id: `attachment-${Date.now()}`,
      name,
      type,
      url: `data:image/svg+xml;base64,${encodeBase64(svgText)}`,
      size: Number(file.size || 0)
    };
  }

  const processedFile = await maybeCompressRaster(file, type);
  return {
    id: `attachment-${Date.now()}`,
    name,
    type: normalizeImageType(processedFile) || type,
    url: await readAsDataUrl(processedFile),
    size: Number(processedFile.size || file.size || 0)
  };
}

