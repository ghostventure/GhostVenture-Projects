import { enforceTrustedOrigin, getAuthenticatedUser } from "../../../lib/auth";
import { jsonError, jsonOk } from "../../../lib/api-helpers";
import { recordAnalyticsEvent } from "../../../lib/analytics";

export const runtime = "nodejs";

export async function POST(request) {
  const untrusted = enforceTrustedOrigin(request);
  if (untrusted) {
    return untrusted;
  }

  let payload = {};
  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid event payload.", 400);
  }

  const session = await getAuthenticatedUser(request);
  const eventId = await recordAnalyticsEvent({
    event: payload,
    user: session?.user || null,
    request
  });

  if (!eventId) {
    return jsonError("Unsupported event.", 400);
  }

  return jsonOk({ ok: true });
}
