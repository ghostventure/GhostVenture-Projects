import {
  enforceMutationRequest,
  jsonError,
  jsonOk,
  parseJsonWithSchema,
  requireBookingManager
} from "../../../../lib/api-helpers";
import { listAccountDeletionRequests, updateAccountDeletionRequest } from "../../../../lib/db";
import { enforceWriteRateLimit } from "../../../../lib/rate-limit";
import { accountDeletionReviewSchema, parseWithSchema } from "../../../../lib/validation";

export const runtime = "nodejs";

export async function GET(request) {
  const auth = await requireBookingManager(request);
  if (auth.error) return auth.error;
  return jsonOk({ requests: await listAccountDeletionRequests() });
}

export async function PATCH(request) {
  const mutation = await enforceMutationRequest(request, (req) => enforceWriteRateLimit(req, "account-deletion-review"));
  if (mutation.error) return mutation.error;
  const auth = await requireBookingManager(request);
  if (auth.error) return auth.error;
  const parsed = await parseJsonWithSchema(request, accountDeletionReviewSchema, parseWithSchema);
  if (parsed.error) return parsed.error;
  const { requestId, status, managerNote } = parsed.data;
  const updated = await updateAccountDeletionRequest(requestId, status, managerNote);
  if (!updated) return jsonError("Deletion request was not found.", 404);
  return jsonOk({ ok: true, requestId, status });
}
