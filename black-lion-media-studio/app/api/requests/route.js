import {
  enforceMutationRequest,
  jsonOk,
  parseJsonWithSchema,
  requireAuthenticatedUser
} from "../../../lib/api-helpers";
import { createRequest, listRequests } from "../../../lib/db";
import { enforceWriteRateLimit } from "../../../lib/rate-limit";
import { parseWithSchema, requestSchema } from "../../../lib/validation";

export const runtime = "nodejs";

export async function POST(request) {
  const mutation = await enforceMutationRequest(request, (req) =>
    enforceWriteRateLimit(req, "orders")
  );
  if (mutation.error) {
    return mutation.error;
  }

  const auth = await requireAuthenticatedUser(request);
  if (auth.error) {
    return auth.error;
  }

  const parsed = await parseJsonWithSchema(request, requestSchema, parseWithSchema);
  if (parsed.error) {
    return parsed.error;
  }

  const { projectType, budget, timeline, consultationDate, consultationTime, estimateAmountCents, depositAmountCents, details } =
    parsed.data;

  await createRequest({
    userId: auth.session.user.id,
    projectType,
    budget,
    timeline,
    consultationDate,
    consultationTime,
    estimateAmountCents,
    depositAmountCents,
    details
  });

  return jsonOk({
    requests: await listRequests(auth.session.user.id)
  });
}
