import {
  enforceMutationRequest,
  jsonError,
  jsonOk,
  parseJsonWithSchema,
  requireBookingManager
} from "../../../../../lib/api-helpers";
import { findRequestWithUserById, updateManagerRequest } from "../../../../../lib/db";
import { enforceWriteRateLimit } from "../../../../../lib/rate-limit";
import { managerRequestUpdateSchema, parseWithSchema } from "../../../../../lib/validation";

export const runtime = "nodejs";

export async function GET(request, context) {
  const auth = await requireBookingManager(request);
  if (auth.error) {
    return auth.error;
  }

  const params = await context.params;
  const requestRecord = await findRequestWithUserById(params.requestId);
  if (!requestRecord) {
    return jsonError("Request not found.", 404);
  }

  return jsonOk({ request: requestRecord });
}

export async function PATCH(request, context) {
  const mutation = await enforceMutationRequest(request, (req) =>
    enforceWriteRateLimit(req, "manager-requests")
  );
  if (mutation.error) {
    return mutation.error;
  }

  const auth = await requireBookingManager(request);
  if (auth.error) {
    return auth.error;
  }

  const params = await context.params;
  const existing = await findRequestWithUserById(params.requestId);
  if (!existing) {
    return jsonError("Request not found.", 404);
  }

  const parsed = await parseJsonWithSchema(request, managerRequestUpdateSchema, parseWithSchema);
  if (parsed.error) {
    return parsed.error;
  }

  await updateManagerRequest(params.requestId, {
    ...(parsed.data.status ? { status: parsed.data.status } : {}),
    ...(parsed.data.invoiceStatus ? { invoice_status: parsed.data.invoiceStatus } : {}),
    ...(parsed.data.paymentStatus ? { payment_status: parsed.data.paymentStatus } : {}),
    ...(parsed.data.fulfillmentStatus ? { fulfillment_status: parsed.data.fulfillmentStatus } : {}),
    ...(parsed.data.internalPriority ? { internal_priority: parsed.data.internalPriority } : {}),
    ...(typeof parsed.data.managerNotes === "string" ? { manager_notes: parsed.data.managerNotes } : {})
  });

  return jsonOk({
    request: await findRequestWithUserById(params.requestId)
  });
}
