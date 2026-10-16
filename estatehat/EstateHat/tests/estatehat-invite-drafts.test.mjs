import test from "node:test";
import assert from "node:assert/strict";
import { createInviteDraft, createInviteMailto, formatInviteDraft } from "../src/estatehat-invite-drafts.js";

test("invite draft validates recipient and selected role/scope", () => {
  assert.throws(() => createInviteDraft({ email: "bad", role: "agent", scope: "documents" }), /valid email/i);
  assert.throws(() => createInviteDraft({ email: "a@example.com", role: "admin", scope: "documents" }), /role and information scope/i);
  assert.throws(() => createInviteDraft({ email: "a@example.com", role: "agent", scope: "everything" }), /role and information scope/i);
});

test("invite draft normalizes email and bounds/sanitizes optional message", () => {
  const draft = createInviteDraft({ email: " A@EXAMPLE.COM ", role: "agent", scope: "documents", message: `hello\u0000${"x".repeat(700)}` }, "House");
  assert.equal(draft.email, "a@example.com");
  assert.equal(draft.message.length, 500);
  assert.equal(draft.message.includes("\u0000"), false);
  assert.equal(draft.property, "House");
});

test("formatted draft and mailto clearly preserve draft-only boundary", () => {
  const invite = createInviteDraft({ email: "a@example.com", role: "lender", scope: "property summary" });
  assert.match(formatInviteDraft(invite), /has not sent an invitation or granted access/i);
  assert.match(decodeURIComponent(createInviteMailto(invite)), /EstateHat collaborator access request/);
  assert.match(createInviteMailto(invite), /^mailto:a%40example\.com/);
});
