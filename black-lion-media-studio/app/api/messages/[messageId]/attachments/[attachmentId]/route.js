import { NextResponse } from "next/server";
import { jsonError, requireAuthenticatedUser } from "../../../../../../lib/api-helpers";
import { findMessageAttachment } from "../../../../../../lib/db";
import { getPrivateStorageBucket } from "../../../../../../lib/private-storage";

export const runtime = "nodejs";

export async function GET(request, context) {
  const auth = await requireAuthenticatedUser(request);
  if (auth.error) return auth.error;
  const { messageId, attachmentId } = await context.params;
  const attachment = await findMessageAttachment(auth.session.user.id, messageId, attachmentId);
  if (!attachment) return jsonError("That file is not available in this account.", 404);
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
    console.error("Message attachment download failed:", error.code || error.message);
    return jsonError("The file could not be opened. Try again later.", 503);
  }
}
