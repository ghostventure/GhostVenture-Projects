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

async function postIdentityToolkit(path, payload) {
  const apiKey = process.env.VITE_FIREBASE_API_KEY;
  assert.ok(apiKey, "VITE_FIREBASE_API_KEY is required for Firebase Auth smoke tests");

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/${path}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

loadLocalEnv();

const unknownEmail = `unknown-${Date.now()}@foxhub.invalid`;
const unknown = await postIdentityToolkit("accounts:signInWithPassword", {
  email: unknownEmail,
  password: "not-a-real-password",
  returnSecureToken: true
});

assert.equal(unknown.ok, false, "Unknown Firebase Auth user must be rejected");
assert.match(unknown.data?.error?.message || "", /INVALID_LOGIN_CREDENTIALS|EMAIL_NOT_FOUND|INVALID_PASSWORD/, "Unknown-user rejection should be an auth credential error");

const smokeEmail = process.env.FOXHUB_AUTH_SMOKE_EMAIL;
const smokePassword = process.env.FOXHUB_AUTH_SMOKE_PASSWORD;

if (smokeEmail && smokePassword) {
  const known = await postIdentityToolkit("accounts:signInWithPassword", {
    email: smokeEmail,
    password: smokePassword,
    returnSecureToken: true
  });
  assert.equal(known.ok, true, "Known Firebase Auth user must sign in with the registered password");
  assert.equal(known.data?.registered, true, "Known Firebase Auth user should be marked registered");

  const lookup = await postIdentityToolkit("accounts:lookup", {
    idToken: known.data.idToken
  });
  assert.equal(lookup.ok, true, "Known Firebase Auth user should be readable after sign-in");

  if (smokeEmail.toLowerCase() === "solidartentertainment@gmail.com") {
    assert.equal(lookup.data?.users?.[0]?.localId, "43caVpuJfHaHEJdsvaGu5vKpttw1", "Solid Art owner account should resolve to the expected founder UID");
  }

  if (smokeEmail.toLowerCase() === "founder@foxhubapp.com") {
    const attributes = lookup.data?.users?.[0]?.customAttributes || "";
    assert.match(attributes, /"owner":true/, "Founder account should include owner custom claim");
    assert.match(attributes, /"founder":true/, "Founder account should include founder custom claim");
    assert.match(attributes, /"role":"owner"/, "Founder account should have owner role claim");
  }
}

console.log(smokeEmail && smokePassword ? "firebase auth smoke passed with known-user check" : "firebase auth smoke passed with unknown-user rejection check");
