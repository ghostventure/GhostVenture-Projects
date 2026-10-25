import crypto from "node:crypto";
import { enforceMutationRequest, jsonError, jsonOk, parseJsonWithSchema } from "../../../../../lib/api-helpers";
import { completePasswordRecovery } from "../../../../../lib/db";
import { enforceAuthRateLimit } from "../../../../../lib/rate-limit";
import { parseWithSchema, passwordRecoveryCompleteSchema } from "../../../../../lib/validation";

export const runtime = "nodejs";

export async function POST(request) {
  const mutation = await enforceMutationRequest(request, enforceAuthRateLimit);
  if (mutation.error) return mutation.error;
  const parsed = await parseJsonWithSchema(request, passwordRecoveryCompleteSchema, parseWithSchema);
  if (parsed.error) return parsed.error;
  const tokenHash = crypto.createHash("sha256").update(parsed.data.token).digest("hex");
  const completed = await completePasswordRecovery(tokenHash, parsed.data.newPassword);
  if (!completed) return jsonError("This recovery link is invalid or has expired. Request a new one and try again.", 400);
  return jsonOk({ ok: true, message: "Your password has been updated. Please sign in again." });
}
