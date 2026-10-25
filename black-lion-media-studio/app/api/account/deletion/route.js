import {
  enforceMutationRequest,
  jsonOk,
  parseJsonWithSchema,
  requireAuthenticatedUser
} from "../../../../lib/api-helpers";
import { createAccountDeletionRequest } from "../../../../lib/db";
import { notifyAccountDeletionRequest } from "../../../../lib/email-notifications";
import { enforceWriteRateLimit } from "../../../../lib/rate-limit";
import { accountDeletionRequestSchema, parseWithSchema } from "../../../../lib/validation";

export const runtime = "nodejs";

export async function POST(request) {
  const mutation = await enforceMutationRequest(request, (req) => enforceWriteRateLimit(req, "account-deletion"));
  if (mutation.error) return mutation.error;
  const auth = await requireAuthenticatedUser(request);
  if (auth.error) return auth.error;
  const parsed = await parseJsonWithSchema(request, accountDeletionRequestSchema, parseWithSchema);
  if (parsed.error) return parsed.error;
  const result = await createAccountDeletionRequest(auth.session.user, parsed.data.reason);
  if (!result.existing) {
    try {
      await notifyAccountDeletionRequest({ email: auth.session.user.email, requestId: result.requestId });
    } catch (error) {
      console.error("Account deletion request notification failed.", error?.message || "Unknown mail delivery error.");
    }
  }
  return jsonOk({
    ok: true,
    requestId: result.requestId,
    status: result.status,
    existing: result.existing,
    message: "Your request was received. The studio will follow up to confirm its scope and applicable retention before any account data is removed."
  }, { status: result.existing ? 200 : 201 });
}
