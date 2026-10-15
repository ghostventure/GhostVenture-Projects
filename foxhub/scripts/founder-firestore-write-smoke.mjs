import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";

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

async function runStep(label, action) {
  try {
    const result = await action();
    console.log(`${label}: pass`);
    return result;
  } catch (error) {
    console.error(`${label}: fail`);
    console.error(error?.code || error?.message || error);
    throw error;
  }
}

loadLocalEnv();

const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
});

const auth = getAuth(app);
const db = getFirestore(app);
const email = process.env.FOXHUB_AUTH_SMOKE_EMAIL;
const password = process.env.FOXHUB_AUTH_SMOKE_PASSWORD;
assert.ok(email, "FOXHUB_AUTH_SMOKE_EMAIL is required");
assert.ok(password, "FOXHUB_AUTH_SMOKE_PASSWORD is required");
const normalizedEmail = email.toLowerCase();

const credential = await runStep("auth.signIn", () => signInWithEmailAndPassword(auth, email, password));
const user = credential.user;
const token = await runStep("auth.claims", () => user.getIdTokenResult(true));
console.log(`claims: ${JSON.stringify(token.claims)}`);

const userRef = doc(db, "users", user.uid);
const operatorRef = doc(db, "operatorAccess", user.uid);
const userSnap = await runStep("users.get", () => getDoc(userRef));
console.log(`users.exists: ${userSnap.exists()}`);
const operatorSnap = await runStep("operatorAccess.get", () => getDoc(operatorRef));
console.log(`operatorAccess.exists: ${operatorSnap.exists()}`);

if (!userSnap.exists()) {
  await runStep("users.bootstrapEmail", () =>
    setDoc(userRef, {
      email: normalizedEmail
    })
  );
}

await runStep("users.mergeMechanics", () =>
  setDoc(userRef, { mechanicsUpdatedAt: serverTimestamp() }, { merge: true })
);

await runStep("users.mergeUserRecords", () =>
  setDoc(userRef, {
    userRecords: [
      {
        id: "self-founder-smoke",
        contactId: normalizedEmail,
        profile: { email: normalizedEmail, displayName: "FoxHub Founder" }
      }
    ],
    mechanicsUpdatedAt: serverTimestamp()
  }, { merge: true })
);

await runStep("operatorAccess.mergeOwner", () =>
  setDoc(operatorRef, {
    userId: user.uid,
    email: normalizedEmail,
    role: "owner",
    scopes: ["*", "owner", "admin", "management", "members", "verification", "moderation", "billing", "documents", "notifications", "settings", "security", "operators"],
    state: "active",
    grantedAt: operatorSnap.data()?.grantedAt || serverTimestamp(),
    grantedBy: operatorSnap.data()?.grantedBy || "system",
    updatedAt: serverTimestamp()
  }, { merge: true })
);

console.log("founder Firestore write smoke passed");
