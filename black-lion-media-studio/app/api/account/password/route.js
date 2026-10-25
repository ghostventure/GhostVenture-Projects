import {
  enforceMutationRequest,
  jsonError,
  jsonOk,
  parseJsonWithSchema,
  requireAuthenticatedUser
} from "../../../../lib/api-helpers";
import { createSignedSessionToken, withSessionCookie } from "../../../../lib/auth";
import { findUserById, updateUserPassword, verifyPassword } from "../../../../lib/db";
import { enforceWriteRateLimit } from "../../../../lib/rate-limit";
import { parseWithSchema, passwordChangeSchema } from "../../../../lib/validation";

export const runtime = "nodejs";

export async function POST(request) {
  const mutation = await enforceMutationRequest(request, (req) =>
    enforceWriteRateLimit(req, "password-change")
  );
  if (mutation.error) return mutation.error;

  const auth = await requireAuthenticatedUser(request);
  if (auth.error) return auth.error;

  const parsed = await parseJsonWithSchema(request, passwordChangeSchema, parseWithSchema);
  if (parsed.error) return parsed.error;

  const user = await findUserById(auth.session.user.id);
  if (!user || !(await verifyPassword(parsed.data.currentPassword, user.password_hash))) {
    return jsonError("Current password is incorrect.", 401);
  }

  const updatedUser = await updateUserPassword(user.id, parsed.data.newPassword);
  if (!updatedUser) return jsonError("Account could not be updated. Please try again.", 500);

  const token = createSignedSessionToken(updatedUser.id, request, updatedUser.auth_version);
  return withSessionCookie(jsonOk({ ok: true }), token);
}
