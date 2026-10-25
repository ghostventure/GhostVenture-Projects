import { getStorage } from "firebase-admin/storage";

export function getPrivateStorageBucket() {
  const bucketName = String(process.env.FIREBASE_STORAGE_BUCKET || "").trim();
  if (!bucketName) return null;
  return getStorage().bucket(bucketName);
}
