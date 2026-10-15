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

const email = process.env.FOXHUB_AUTH_SMOKE_EMAIL;
const password = process.env.FOXHUB_AUTH_SMOKE_PASSWORD;
assert.ok(email, "FOXHUB_AUTH_SMOKE_EMAIL is required");
assert.ok(password, "FOXHUB_AUTH_SMOKE_PASSWORD is required");

const { signInProfile } = await import("../src/repository-firebase.js");

const authState = await signInProfile({
  email,
  password,
  authMode: "signin"
});

assert.equal(authState.backendMode, "firebase");
assert.equal(authState.profile.email, email.toLowerCase());
assert.equal(authState.authenticated, true, "Founder should authenticate into the app, not waitlist");
assert.equal(authState.profile.accessState, "priority", "Founder should have priority access");
assert.equal(authState.profile.onboarded, true, "Founder should be onboarded");
assert.equal(authState.profile.role, "founder", "Founder should retain founder role");
assert.equal(authState.profile.waitlistEndsAt, "", "Founder should not have a waitlist end date");

console.log("founder repository smoke passed");
process.exit(0);
