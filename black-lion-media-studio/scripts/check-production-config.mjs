import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const firebaseConfigPath = path.join(projectRoot, "firebase.json");
const firestoreIndexesPath = path.join(projectRoot, "firestore.indexes.json");

function fail(message) {
  console.error(`Deployment blocked: ${message}`);
  process.exitCode = 1;
}

let config;
try {
  config = JSON.parse(await readFile(firebaseConfigPath, "utf8"));
} catch {
  fail("firebase.json is missing or invalid JSON.");
}

const configuredSecrets = config?.hosting?.frameworksBackend?.secrets;
if (!Array.isArray(configuredSecrets) || !configuredSecrets.includes("SESSION_SECRET")) {
  fail("hosting.frameworksBackend.secrets must bind SESSION_SECRET from Secret Manager.");
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
  for (const fileName of envFiles) {
    const content = await readFile(path.join(projectRoot, fileName), "utf8");
    if (/^\s*SESSION_SECRET\s*=/m.test(content)) {
      fail(`${fileName} contains SESSION_SECRET; production signing keys must come from Secret Manager, not dotenv.`);
    }
  }
} catch {
  fail("could not inspect local dotenv filenames for an unsafe SESSION_SECRET value.");
}

if (!process.exitCode) {
  console.log("SESSION_SECRET is bound and required message indexes are declared locally; Firebase must resolve the secret and indexes remotely before backend verification.");
}
