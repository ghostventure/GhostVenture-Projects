import crypto from "node:crypto";
import {
  enforceMutationRequest,
  jsonOk,
  parseJsonWithSchema
} from "../../../../../lib/api-helpers";
import { findUserByEmail, createPasswordRecoveryToken } from "../../../../../lib/db";
import { sendPasswordRecoveryEmail } from "../../../../../lib/email-notifications";
import { enforceAuthRateLimit, enforceRecoveryEmailRateLimit } from "../../../../../lib/rate-limit";
import { parseWithSchema, passwordRecoveryRequestSchema } from "../../../../../lib/validation";

export const runtime = "nodejs";

const genericResponse = {
  ok: true,
  message: "If an account exists for that address, recovery instructions will be sent."
};

export async function POST(request) {
  const mutation = await enforceMutationRequest(request, enforceAuthRateLimit);
  if (mutation.error) return mutation.error;
  const parsed = await parseJsonWithSchema(request, passwordRecoveryRequestSchema, parseWithSchema);
  if (parsed.error) return parsed.error;
  const user = await findUserByEmail(parsed.data.email);
  if (user) {
    const emailLimit = await enforceRecoveryEmailRateLimit(parsed.data.email);
    if (emailLimit) return jsonOk(genericResponse);
    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await createPasswordRecoveryToken(user.id, tokenHash, Date.now() + 30 * 60 * 1000);
    try {
      await sendPasswordRecoveryEmail({ email: user.email, token });
    } catch (error) {
      console.error("Password recovery email delivery failed.", error?.message || "Unknown mail delivery error.");
    }
  }
  return jsonOk(genericResponse);
}
