import {
  getAdminApp,
  getAdminDb,
  jsonResponse,
  sanitizeText,
  serverTimestamp,
  verifyOpsSecretFromRequest
} from "../../_server/foxhub-server.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const authResult = verifyOpsSecretFromRequest(request);
  if (!authResult.ok) {
    return jsonResponse({ ok: false, error: "unauthorized", reason: authResult.reason }, 401);
  }

  const body = await request.json().catch(() => ({}));
  const token = sanitizeText(body.token || "", 500);
  const title = sanitizeText(body.title || "FoxHub update", 120);
  const messageBody = sanitizeText(body.body || "A FoxHub event is ready.", 240);
  const requestRecord = {
    uid: sanitizeText(body.uid || "", 160),
    channel: "fcm",
    tokenPreview: token ? `${token.slice(0, 8)}...${token.slice(-6)}` : "",
    title,
    body: messageBody,
    status: token ? "queued" : "missing_token",
    backend: "next-api",
    createdAt: serverTimestamp()
  };

  const db = getAdminDb();
  const requestRef = await db.collection("pushDeliveryRequests").add(requestRecord);
  let messageId = "";
  let status = requestRecord.status;

  if (token) {
    try {
      messageId = await getAdminApp().messaging().send({
        token,
        notification: {
          title,
          body: messageBody
        },
        data: {
          requestId: requestRef.id,
          source: "foxhub-next"
        }
      });
      status = "sent";
      await requestRef.set({ status, messageId, sentAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      status = "failed";
      await requestRef.set({ status, error: sanitizeText(error?.message || "send_failed", 240) }, { merge: true });
    }
  }

  return jsonResponse({
    ok: true,
    requestId: requestRef.id,
    status,
    messageId,
    backend: "next-api",
    secretConfigured: Boolean(process.env.FOXHUB_OPS_WEBHOOK_SECRET)
  });
}
