import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const firebaseConfigPath = path.join(projectRoot, "firebase.json");
const firestoreIndexesPath = path.join(projectRoot, "firestore.indexes.json");

function fail(message) {
  console.error(`Deployment blocked: ${message}`);
  process.exitCode = 1;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

let config;
try {
  config = JSON.parse(await readFile(firebaseConfigPath, "utf8"));
} catch {
  fail("firebase.json is missing or invalid JSON.");
}

const configuredSecrets = config?.hosting?.frameworksBackend?.secrets;
for (const secret of [
  "SESSION_SECRET",
  "SQUARE_ACCESS_TOKEN",
  "SQUARE_WEBHOOK_SIGNATURE_KEY",
  "SQUARE_PAYMENTS_WEBHOOK_SIGNATURE_KEY",
  "SMTP_USER",
  "SMTP_PASS"
]) {
  if (!Array.isArray(configuredSecrets) || !configuredSecrets.includes(secret)) {
    fail(`hosting.frameworksBackend.secrets must bind ${secret} from Secret Manager.`);
  }
}
for (const variable of [
  "SQUARE_LOCATION_ID",
  "SQUARE_CONSULTATION_SERVICE_VARIATION_ID",
  "FIREBASE_STORAGE_BUCKET",
  "SMTP_HOST",
  "SMTP_FROM",
  "SITE_BASE_URL"
]) {
  if (!process.env[variable]) {
    fail(`${variable} must be set in the deployment environment for the enabled provider integrations.`);
  }
}

const requiredMessageIndexes = [
  ["user_id:ASCENDING", "created_at:DESCENDING"],
  ["user_id:ASCENDING", "sender_role:ASCENDING"]
];
try {
  const indexConfig = JSON.parse(await readFile(firestoreIndexesPath, "utf8"));
  const indexes = Array.isArray(indexConfig.indexes) ? indexConfig.indexes : [];
  for (const fields of requiredMessageIndexes) {
    const found = indexes.some((index) =>
      index.collectionGroup === "messages" &&
      fields.every((field, position) => {
        const [fieldPath, order] = field.split(":");
        return index.fields?.[position]?.fieldPath === fieldPath && index.fields[position].order === order;
      })
    );
    if (!found) fail(`firestore.indexes.json must include the messages index ${fields.join(", ")}.`);
  }
} catch {
  fail("firestore.indexes.json is missing or invalid JSON; message query indexes cannot be confirmed.");
}

try {
  const envFiles = (await readdir(projectRoot)).filter(
    (name) => (name === ".env" || name.startsWith(".env.")) && name !== ".env.example"
  );
  const runtimeSecrets = Array.isArray(configuredSecrets)
    ? configuredSecrets.filter((secret) => typeof secret === "string" && secret.trim())
    : [];
  for (const fileName of envFiles) {
    const content = await readFile(path.join(projectRoot, fileName), "utf8");
    for (const secret of runtimeSecrets) {
      const assignment = new RegExp(`^\\s*(?:export\\s+)?${escapeRegExp(secret)}\\s*=`, "m");
      if (assignment.test(content)) {
        fail(`${fileName} contains a Firebase runtime secret assignment for ${secret}; runtime secrets must come from Secret Manager, not dotenv.`);
      }
    }
  }
} catch {
  fail("could not inspect local dotenv files for Firebase runtime secret assignments.");
}

if (!process.exitCode) {
  console.log("Session, Square, Storage, SMTP, and required message indexes are declared locally; Firebase must resolve the secrets, bucket, indexes, and provider credentials remotely before backend verification.");
}
