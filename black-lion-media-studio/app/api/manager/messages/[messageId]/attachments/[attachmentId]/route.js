import { NextResponse } from "next/server";
import { jsonError, requireBookingManager } from "../../../../../../../lib/api-helpers";
import { findManagerMessageAttachment } from "../../../../../../../lib/db";
import { getPrivateStorageBucket } from "../../../../../../../lib/private-storage";

export const runtime = "nodejs";

export async function GET(request, context) {
  const auth = await requireBookingManager(request);
  if (auth.error) return auth.error;
  const { messageId, attachmentId } = await context.params;
  const attachment = await findManagerMessageAttachment(messageId, attachmentId);
  if (!attachment) return jsonError("That file is not available for this message.", 404);
  const bucket = getPrivateStorageBucket();
  if (!bucket) return jsonError("Private file storage is not configured.", 503);
  try {
    const [url] = await bucket.file(attachment.object_path).getSignedUrl({
      action: "read",
      expires: Date.now() + 5 * 60 * 1000,
      responseDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(attachment.name || "attachment")}`,
      responseType: attachment.content_type
    });
    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Manager message attachment download failed:", error.code || error.message);
    return jsonError("The file could not be opened. Try again later.", 503);
  }
}
