import { enforceMutationRequest, jsonOk } from "../../../lib/api-helpers";
import { clearSessionCookie, getAuthenticatedUser } from "../../../lib/auth";
import { deleteSession } from "../../../lib/db";

export const runtime = "nodejs";

export async function POST(request) {
  const mutation = await enforceMutationRequest(request);
  if (mutation.error) {
    return mutation.error;
  }

  const session = await getAuthenticatedUser(request);
  if (session) {
    await deleteSession(session.token);
  }

  return clearSessionCookie(jsonOk({ ok: true }));
}
