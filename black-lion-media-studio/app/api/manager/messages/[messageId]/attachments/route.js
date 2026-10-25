import { jsonError, jsonOk, requireBookingManager } from "../../../../../../lib/api-helpers";
import { listManagerMessageAttachments } from "../../../../../../lib/db";

export const runtime = "nodejs";

export async function GET(request, context) {
  const auth = await requireBookingManager(request);
  if (auth.error) return auth.error;
  const { messageId } = await context.params;
  const attachments = await listManagerMessageAttachments(messageId);
  if (!attachments) return jsonError("That client message was not found.", 404);
  return jsonOk({ attachments: attachments.map((attachment) => ({
    ...attachment,
    downloadUrl: `/api/manager/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachment.id)}`
  })) });
}
