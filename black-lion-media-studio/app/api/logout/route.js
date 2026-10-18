import { enforceMutationRequest, jsonOk } from "../../../lib/api-helpers";
import { clearSessionCookie, getAuthenticatedUser, SessionConfigurationError } from "../../../lib/auth";
import { deleteSession } from "../../../lib/db";

export const runtime = "nodejs";

export async function POST(request) {
  const mutation = await enforceMutationRequest(request);
  if (mutation.error) {
    return mutation.error;
  }

  try {
    const session = await getAuthenticatedUser(request);
    if (session) {
      await deleteSession(session.token);
    }
  } catch (error) {
    if (!(error instanceof SessionConfigurationError)) {
      throw error;
    }
    console.error("Session authentication configuration error during logout:", error.message);
  }

  return clearSessionCookie(jsonOk({ ok: true }));
}
