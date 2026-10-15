import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function loadLocalEnv() {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const splitAt = line.indexOf("=");
    if (splitAt === -1) continue;
    const key = line.slice(0, splitAt).trim();
    const value = line.slice(splitAt + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadLocalEnv();

const emails = (process.env.FOXHUB_AUTH_SMOKE_EMAILS || process.env.FOXHUB_AUTH_SMOKE_EMAIL || "")
  .split(",")
  .map((email) => email.trim())
  .filter(Boolean);
const password = process.env.FOXHUB_AUTH_SMOKE_PASSWORD;
assert.ok(emails.length, "FOXHUB_AUTH_SMOKE_EMAIL or FOXHUB_AUTH_SMOKE_EMAILS is required");
assert.ok(password, "FOXHUB_AUTH_SMOKE_PASSWORD is required");

const { signInProfile, createInviteRecord } = await import("../src/repository-firebase.js");
const { auth } = await import("../src/firebase.js");

for (const email of emails) {
  const authState = await signInProfile({
    email,
    password,
    authMode: "signin"
  });

  assert.equal(authState.backendMode, "firebase");
  assert.equal(authState.profile.email, email.toLowerCase());
  assert.equal(authState.authenticated, true, `${email} should authenticate before creating invites`);
  assert.equal(authState.profile.accessState, "priority", `${email} should have priority access`);
  assert.equal(authState.profile.onboarded, true, `${email} should be onboarded`);
  assert.equal(authState.profile.role, "founder", `${email} should retain founder role`);

  const invite = await createInviteRecord(
    {
      label: "Founder invite smoke",
      note: "Invite creation verification"
    },
    authState.profile
  );

  assert.ok(invite.id.startsWith("invite-"), `${email} invite should have an id`);
  assert.ok(invite.code.startsWith("FOX-"), `${email} invite should have a FoxHub invite code`);
  assert.equal(invite.createdBy, auth.currentUser.uid, `${email} invite should be owned by the signed-in user`);
  assert.equal(invite.status, "active", `${email} invite should be active immediately after creation`);
  assert.ok(invite.expiresAt, `${email} invite should have an expiration timestamp`);
}

console.log(`founder invite smoke passed for ${emails.length} account${emails.length === 1 ? "" : "s"}`);
process.exit(0);
