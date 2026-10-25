import { jsonError, jsonOk, requireBookingManager } from "../../../../../../lib/api-helpers";
import { listManagerRequestAttachments } from "../../../../../../lib/db";

export const runtime = "nodejs";

export async function GET(request, context) {
  const auth = await requireBookingManager(request);
  if (auth.error) return auth.error;
  const { requestId } = await context.params;
  const attachments = await listManagerRequestAttachments(requestId);
  if (!attachments) return jsonError("That request was not found.", 404);
  return jsonOk({ attachments: attachments.map((attachment) => ({
    ...attachment,
    downloadUrl: `/api/manager/requests/${encodeURIComponent(requestId)}/attachments/${encodeURIComponent(attachment.id)}`
  })) });
}
