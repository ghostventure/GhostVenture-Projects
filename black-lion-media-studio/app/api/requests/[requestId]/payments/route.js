import { jsonError, jsonOk, requireAuthenticatedUser } from "../../../../../lib/api-helpers";
import { listSquarePaymentEventsForRequest } from "../../../../../lib/db";

export const runtime = "nodejs";

export async function GET(request, context) {
  const auth = await requireAuthenticatedUser(request);
  if (auth.error) return auth.error;
  const { requestId } = await context.params;
  const history = await listSquarePaymentEventsForRequest(auth.session.user.id, requestId);
  if (!history) return jsonError("That request is not available in this account.", 404);
  return jsonOk(history);
}
