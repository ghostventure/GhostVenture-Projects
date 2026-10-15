import { getAdminDb, jsonResponse, sanitizeText, serverTimestamp, verifyOpsSecretFromRequest } from "../../_server/foxhub-server.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const authResult = verifyOpsSecretFromRequest(request);
  if (!authResult.ok) {
    return jsonResponse({ ok: false, error: "unauthorized", reason: authResult.reason }, 401);
  }

  const body = await request.json().catch(() => ({}));
  const componentKey = sanitizeText(body.componentKey || "next-backend", 80);
  const action = sanitizeText(body.action || "run", 80);
  const targetUid = sanitizeText(body.uid || "", 160);
  const event = {
    componentKey,
    action,
    surface: sanitizeText(body.surface || "next-api", 80),
    detail: sanitizeText(body.detail || "Next backend operation accepted.", 500),
    status: sanitizeText(body.status || "accepted", 40),
    targetUid,
    payload: body.payload && typeof body.payload === "object" ? body.payload : {},
    createdAt: serverTimestamp()
  };

  const db = getAdminDb();
  const eventRef = await db.collection("productionOpsEvents").add(event);
  if (targetUid) {
    await db.collection("users").doc(targetUid).collection("productionOpsEvents").doc(eventRef.id).set(event, { merge: true });
  }

  return jsonResponse({
    ok: true,
    eventId: eventRef.id,
    componentKey,
    action,
    backend: "next-api",
    secretConfigured: Boolean(process.env.FOXHUB_OPS_WEBHOOK_SECRET)
  });
}
