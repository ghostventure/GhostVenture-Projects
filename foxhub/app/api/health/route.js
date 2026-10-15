import { jsonResponse } from "../_server/foxhub-server.js";

export const dynamic = "force-dynamic";

export async function GET() {
  return jsonResponse({
    ok: true,
    service: "foxhub-next-backend",
    status: "ready",
    runtime: "nodejs",
    firebaseProjectConfigured: Boolean(process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    opsSecretConfigured: Boolean(process.env.FOXHUB_OPS_WEBHOOK_SECRET),
    stripeWebhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    checkedAt: new Date().toISOString()
  });
}
