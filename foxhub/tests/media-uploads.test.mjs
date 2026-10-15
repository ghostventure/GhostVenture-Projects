import assert from "node:assert/strict";
import test from "node:test";

import {
  IMAGE_UPLOAD_ACCEPT,
  isAcceptedImageDataUrl,
  normalizeImageType,
  sanitizeSvgText,
  validateImageUpload
} from "../src/mediaUploads.js";

test("image upload accept list covers requested photo and vector formats", () => {
  assert.match(IMAGE_UPLOAD_ACCEPT, /image\/jpeg/);
  assert.match(IMAGE_UPLOAD_ACCEPT, /\.jpg/);
  assert.match(IMAGE_UPLOAD_ACCEPT, /\.jpeg/);
  assert.match(IMAGE_UPLOAD_ACCEPT, /image\/png/);
  assert.match(IMAGE_UPLOAD_ACCEPT, /image\/gif/);
  assert.match(IMAGE_UPLOAD_ACCEPT, /image\/svg\+xml/);
  assert.match(IMAGE_UPLOAD_ACCEPT, /\.svg/);
});

test("image upload validation normalizes common extensions and blocks unsupported files", () => {
  assert.equal(normalizeImageType({ name: "photo.JPG", type: "" }), "image/jpeg");
  assert.equal(normalizeImageType({ name: "brand.svg", type: "" }), "image/svg+xml");
  assert.equal(validateImageUpload({ name: "avatar.png", type: "image/png", size: 512 }), "");
  assert.equal(validateImageUpload({ name: "notes.pdf", type: "application/pdf", size: 512 }), "Use JPG, JPEG, PNG, GIF, or SVG vector images.");
  assert.equal(validateImageUpload({ name: "huge.jpg", type: "image/jpeg", size: 11 * 1024 * 1024 }), "Image is too large. Use a file under 10MB.");
});

test("image data URL guard accepts only supported image types", () => {
  assert.equal(isAcceptedImageDataUrl("data:image/jpeg;base64,abc"), true);
  assert.equal(isAcceptedImageDataUrl("data:image/svg+xml;base64,abc"), true);
  assert.equal(isAcceptedImageDataUrl("data:image/webp;base64,abc"), false);
  assert.equal(isAcceptedImageDataUrl("https://example.com/photo.jpg"), false);
});

test("SVG sanitizer removes script and inline event handlers", () => {
  const sanitized = sanitizeSvgText("<svg onload=\"alert(1)\"><script>alert(1)</script><path onclick='bad()' /></svg>");
  assert.equal(sanitized.includes("<script>"), false);
  assert.equal(sanitized.includes("onload"), false);
  assert.equal(sanitized.includes("onclick"), false);
  assert.match(sanitized, /<svg/);
});

