import crypto from "node:crypto";
import {
  enforceMutationRequest,
  jsonError,
  jsonOk,
  requireAuthenticatedUser
} from "../../../../../lib/api-helpers";
import { listMessageAttachments, saveMessageAttachment } from "../../../../../lib/db";
import { readBoundedMultipartForm } from "../../../../../lib/multipart";
import { getPrivateStorageBucket } from "../../../../../lib/private-storage";
import { enforceWriteRateLimit } from "../../../../../lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const maxFileBytes = 10 * 1024 * 1024;
const maxRequestBytes = maxFileBytes + 128 * 1024;
const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);

function matchesFileSignature(contentType, bytes) {
  if (contentType === "application/pdf") return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  if (contentType === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (contentType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return false;
}

function safeFileName(value) {
  return String(value || "attachment").replace(/[\\/\u0000-\u001f\u007f]/g, "_").slice(0, 180) || "attachment";
}

export async function GET(request, context) {
  const auth = await requireAuthenticatedUser(request);
  if (auth.error) return auth.error;
  const { messageId } = await context.params;
  const attachments = await listMessageAttachments(auth.session.user.id, messageId);
  if (!attachments) return jsonError("That message is not available in this account.", 404);
  return jsonOk({ attachments: attachments.map((attachment) => ({
    ...attachment,
    downloadUrl: `/api/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachment.id)}`
  })) });
}

export async function POST(request, context) {
  const mutation = await enforceMutationRequest(request, (req) => enforceWriteRateLimit(req, "message-attachments"));
  if (mutation.error) return mutation.error;
  const auth = await requireAuthenticatedUser(request);
  if (auth.error) return auth.error;
  const { messageId } = await context.params;
  if (!messageId || messageId.includes("/")) return jsonError("That message is not available in this account.", 404);
  const bucket = getPrivateStorageBucket();
  if (!bucket) return jsonError("Private file storage is not configured.", 503);
  const parsedForm = await readBoundedMultipartForm(request, maxRequestBytes);
  if (parsedForm.error) return jsonError(parsedForm.error, parsedForm.status);
  const form = parsedForm.form;
  const file = form.get("file");
  if (!file || typeof file.arrayBuffer !== "function") return jsonError("Choose a file to upload.", 400);
  if (file.size <= 0 || file.size > maxFileBytes) return jsonError("Files must be 10 MB or smaller.", 413);
  const contentType = String(file.type || "").toLowerCase();
  if (!allowedTypes.has(contentType)) return jsonError("Only PDF, PNG, and JPEG files are supported.", 415);

  let bytes;
  try { bytes = Buffer.from(await file.arrayBuffer()); } catch { return jsonError("The file could not be read.", 400); }
  if (bytes.length !== file.size || !matchesFileSignature(contentType, bytes)) {
    return jsonError("The file contents do not match the selected file type.", 415);
  }

  const id = crypto.randomUUID();
  const objectPath = `private-message-attachments/${auth.session.user.id}/${messageId}/${id}`;
  const object = bucket.file(objectPath);
  try {
    await object.save(bytes, {
      resumable: false,
      validation: "md5",
      metadata: {
        contentType,
        cacheControl: "private, no-store",
        metadata: { ownerId: auth.session.user.id, messageId, attachmentId: id }
      }
    });
    const name = safeFileName(file.name);
    const saved = await saveMessageAttachment({
      userId: auth.session.user.id,
      messageId,
      attachment: { id, name, content_type: contentType, size: bytes.length, object_path: objectPath }
    });
    if (!saved) {
      await object.delete().catch(() => {});
      return jsonError("That client message is not available in this account.", 404);
    }
    return jsonOk({ attachment: {
      id,
      name,
      contentType,
      size: bytes.length,
      downloadUrl: `/api/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(id)}`
    } }, { status: 201 });
  } catch (error) {
    await object.delete().catch(() => {});
    if (error.code === "MESSAGE_ATTACHMENT_LIMIT") return jsonError("A message can have no more than 10 attachments.", 409);
    console.error("Message attachment upload failed:", error.code || error.message);
    return jsonError("The file could not be saved. Try again later.", 500);
  }
}
