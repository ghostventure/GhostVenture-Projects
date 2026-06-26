import { jsonOk, requireAuthenticatedUser } from "../../../lib/api-helpers";
import { listRequests, sanitizeUser } from "../../../lib/db";

export const runtime = "nodejs";

export async function GET(request) {
  const auth = await requireAuthenticatedUser(request, "Not authenticated");
  if (auth.error) {
    return auth.error;
  }

  return jsonOk({
    user: sanitizeUser(auth.session.user),
    requests: await listRequests(auth.session.user.id)
  });
}
