import crypto from "node:crypto";
import { enforceMutationRequest, jsonError, jsonOk, requireAuthenticatedUser } from "../../../../../lib/api-helpers";
import { findRequestAttachment, listRequestAttachments, saveRequestAttachment } from "../../../../../lib/db";
import { readBoundedMultipartForm } from "../../../../../lib/multipart";
import { getPrivateStorageBucket } from "../../../../../lib/private-storage";
import { enforceWriteRateLimit } from "../../../../../lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const maxFileBytes = 10 * 1024 * 1024;
const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);

function matchesFileSignature(contentType, bytes) {
  if (contentType === "application/pdf") return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  if (contentType === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (contentType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return false;
}

export async function GET(request, context) {
  const auth = await requireAuthenticatedUser(request);
  if (auth.error) return auth.error;
  const { requestId } = await context.params;
  const attachments = await listRequestAttachments(auth.session.user.id, requestId);
  if (!attachments) return jsonError("That request is not available in this account.", 404);
  return jsonOk({ attachments });
}

export async function POST(request, context) {
  const mutation = await enforceMutationRequest(request, (req) => enforceWriteRateLimit(req, "request-attachments"));
  if (mutation.error) return mutation.error;
  const auth = await requireAuthenticatedUser(request);
  if (auth.error) return auth.error;
  const { requestId } = await context.params;
  const bucket = getPrivateStorageBucket();
  if (!bucket) return jsonError("Private file storage is not configured.", 503);

  const parsedForm = await readBoundedMultipartForm(request, maxFileBytes + 128 * 1024);
  if (parsedForm.error) return jsonError(parsedForm.error, parsedForm.status);
  const form = parsedForm.form;
  const file = form.get("file");
  if (!file || typeof file.arrayBuffer !== "function") return jsonError("Choose a file to upload.", 400);
  if (file.size <= 0 || file.size > maxFileBytes) return jsonError("Files must be 10 MB or smaller.", 413);
  const contentType = String(file.type || "").toLowerCase();
  if (!allowedTypes.has(contentType)) return jsonError("Only PDF, PNG, and JPEG files are supported.", 415);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!matchesFileSignature(contentType, bytes)) return jsonError("The file contents do not match the selected file type.", 415);

  const id = crypto.randomUUID();
  const objectPath = `private-request-attachments/${auth.session.user.id}/${requestId}/${id}`;
  const object = bucket.file(objectPath);
  try {
    await object.save(bytes, {
      resumable: false,
      validation: "md5",
      metadata: {
        contentType,
        cacheControl: "private, no-store",
        metadata: { ownerId: auth.session.user.id, requestId, attachmentId: id }
      }
    });
    const saved = await saveRequestAttachment({
      userId: auth.session.user.id,
      requestId,
      attachment: { id, name: String(file.name || "attachment").replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 180), content_type: contentType, size: bytes.length, object_path: objectPath }
    });
    if (!saved) {
      await object.delete().catch(() => {});
      return jsonError("That request is not available in this account.", 404);
    }
    return jsonOk({ attachment: { id, name: String(file.name || "attachment").slice(0, 180), contentType, size: bytes.length } }, { status: 201 });
  } catch (error) {
    await object.delete().catch(() => {});
    console.error("Request attachment upload failed:", error);
    return jsonError("The file could not be saved. Try again later.", 500);
  }
}
