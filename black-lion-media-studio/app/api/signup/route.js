import {
  enforceMutationRequest,
  jsonError,
  jsonOk,
  parseJsonWithSchema
} from "../../../lib/api-helpers";
import { createUser, findUserByEmail, findUserByUsername, listRequests, sanitizeUser } from "../../../lib/db";
import { createSignedSessionToken, withSessionCookie } from "../../../lib/auth";
import { enforceAuthRateLimit } from "../../../lib/rate-limit";
import { parseWithSchema, signupSchema } from "../../../lib/validation";

export const runtime = "nodejs";

export async function POST(request) {
  const mutation = await enforceMutationRequest(request, enforceAuthRateLimit);
  if (mutation.error) {
    return mutation.error;
  }

  const parsed = await parseJsonWithSchema(request, signupSchema, parseWithSchema);
  if (parsed.error) {
    return parsed.error;
  }

  const {
    fullName,
    username,
    email,
    company,
    phone,
    serviceInterest,
    userType,
    leadSource,
    preferredLanguage,
    preferredContactMethod,
    website,
    referralSource,
    password
  } = parsed.data;

  if (await findUserByEmail(email)) {
    return jsonError("An account already exists for that email.", 409);
  }

  if (username && (await findUserByUsername(username))) {
    return jsonError("That username is already taken. Choose another username.", 409);
  }

  const userId = await createUser({
    fullName,
    username,
    email,
    company,
    phone,
    serviceInterest,
    userType,
    leadSource,
    preferredLanguage,
    preferredContactMethod,
    website,
    referralSource,
    password
  });
  const user = await findUserByEmail(email);
  const token = createSignedSessionToken(userId, request);
  const response = jsonOk(
    {
      sessionToken: token,
      user: sanitizeUser(user),
      requests: await listRequests(userId)
    },
    { status: 201 }
  );

  return withSessionCookie(response, token);
}
