import fs from "node:fs";
import path from "node:path";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function detectProjectId() {
  if (process.env.GCLOUD_PROJECT) {
    return process.env.GCLOUD_PROJECT;
  }

  if (process.env.GOOGLE_CLOUD_PROJECT) {
    return process.env.GOOGLE_CLOUD_PROJECT;
  }

  if (process.env.FIREBASE_CONFIG) {
    try {
      const parsed = JSON.parse(process.env.FIREBASE_CONFIG);
      if (parsed.projectId) {
        return parsed.projectId;
      }
    } catch {
      // Ignore malformed runtime config and continue with file fallback.
    }
  }

  const firebasercPath = path.join(process.cwd(), ".firebaserc");
  if (fs.existsSync(firebasercPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(firebasercPath, "utf8"));
      if (parsed.projects?.default) {
        return parsed.projects.default;
      }
    } catch {
      // Ignore unreadable local config and let Firebase Admin throw if needed.
    }
  }

  return undefined;
}

function getFirebaseApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId: detectProjectId()
  });
}

export function getDb() {
  return getFirestore(getFirebaseApp());
}
