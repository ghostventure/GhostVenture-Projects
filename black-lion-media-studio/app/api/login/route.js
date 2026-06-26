import {
  enforceMutationRequest,
  jsonError,
  jsonOk,
  parseJsonWithSchema
} from "../../../lib/api-helpers";
import { createSignedSessionToken, withSessionCookie } from "../../../lib/auth";
import { enforceAuthRateLimit } from "../../../lib/rate-limit";
import { loginSchema, parseWithSchema } from "../../../lib/validation";
import {
  findUserByEmail,
  listRequests,
  sanitizeUser,
  updateUserLifecycle,
  verifyPassword
} from "../../../lib/db";

export const runtime = "nodejs";

export async function POST(request) {
  const mutation = await enforceMutationRequest(request, enforceAuthRateLimit);
  if (mutation.error) {
    return mutation.error;
  }

  const parsed = await parseJsonWithSchema(request, loginSchema, parseWithSchema);
  if (parsed.error) {
    return parsed.error;
  }

  const { email, password } = parsed.data;
  const user = await findUserByEmail(email);

  if (!user || !verifyPassword(password, user.password_hash)) {
    return jsonError("Invalid email or password.", 401);
  }

  const token = createSignedSessionToken(user.id, request);
  await updateUserLifecycle(user.id, {
    last_sign_in_at: new Date().toISOString(),
    last_portal_activity_at: new Date().toISOString()
  });
  const response = jsonOk({
    sessionToken: token,
    user: sanitizeUser(user),
    requests: await listRequests(user.id)
  });

  return withSessionCookie(response, token);
}
