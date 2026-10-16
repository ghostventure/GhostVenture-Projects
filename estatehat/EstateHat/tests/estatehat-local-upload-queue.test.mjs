import test from "node:test";
import assert from "node:assert/strict";
import { formatFileSize, inspectLocalFiles } from "../src/estatehat-local-upload-queue.js";

const file = (name, type = "application/pdf", size = 2048, lastModified = 1) => ({ name, type, size, lastModified });

test("local file queue accepts supported PDFs and images with size metadata", () => {
  const result = inspectLocalFiles([file("disclosure.pdf"), file("front.webp", "image/webp")]);
  assert.equal(result.length, 2);
  assert.equal(result.every((item) => item.accepted), true);
  assert.equal(result[0].name, "disclosure.pdf");
});

test("file queue rejects unsupported content, empty files and oversized files", () => {
  const [unsupported, empty, oversized] = inspectLocalFiles([
    file("script.js", "text/javascript"), file("empty.png", "image/png", 0), file("big.pdf", "application/pdf", 16 * 1024 * 1024),
  ]);
  assert.match(unsupported.reason, /PDF, JPEG/);
  assert.match(empty.reason, /empty/);
  assert.match(oversized.reason, /15 MB/);
});

test("file queue marks duplicates in the current session without persisting file bytes", () => {
  const first = inspectLocalFiles([file("same.pdf")]);
  const second = inspectLocalFiles([file("same.pdf")], first);
  assert.equal(second[0].accepted, false);
  assert.match(second[0].reason, /already/);
  assert.equal("file" in first[0], true);
});

test("file size formatting reports readable units", () => {
  assert.equal(formatFileSize(42), "42 B");
  assert.equal(formatFileSize(1024), "1.0 KB");
  assert.equal(formatFileSize(2 * 1024 * 1024), "2.0 MB");
});
