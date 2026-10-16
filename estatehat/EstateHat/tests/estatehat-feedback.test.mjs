import test from "node:test";
import assert from "node:assert/strict";
import { createFeedbackReport, formatFeedbackMarkdown } from "../src/estatehat-feedback.js";

const input = { category: "bug", severity: "high", title: "Sign in button stalls", details: "After entering a valid code the screen stays on the sign-in page.", steps: "Open sign in; enter the code; submit." };

test("feedback drafts validate category, severity, title and useful details", () => {
  assert.throws(() => createFeedbackReport({ ...input, title: "bug" }), /five characters/i);
  assert.throws(() => createFeedbackReport({ ...input, details: "too short" }), /20 characters/i);
  assert.throws(() => createFeedbackReport({ ...input, category: "unknown" }), /report type/i);
  assert.equal(createFeedbackReport(input, "/signin?code=secret").route, "/signin");
});

test("feedback markdown includes reproduction context and clearly says it was not sent", () => {
  const report = createFeedbackReport(input, "/signin");
  const markdown = formatFeedbackMarkdown(report);
  assert.match(markdown, /Steps to reproduce/);
  assert.match(markdown, /Open sign in/);
  assert.match(markdown, /has not been sent/);
  assert.equal(markdown.includes("@example.com"), false);
});

test("report bounds and sanitization prevent control characters and oversized content", () => {
  const report = createFeedbackReport({ ...input, title: `  ${"a".repeat(150)}\u0000` });
  assert.equal(report.title.length, 120);
  assert.equal(report.title.includes("\u0000"), false);
  assert.equal(createFeedbackReport({ ...input, details: "d".repeat(3001) }).details.length, 3000);
});
