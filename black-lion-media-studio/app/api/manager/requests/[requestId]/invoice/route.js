import {
  enforceMutationRequest,
  jsonError,
  jsonOk,
  requireBookingManager
} from "../../../../../../lib/api-helpers";
import { attachInvoiceToRequest, findRequestWithUserById } from "../../../../../../lib/db";
import { enforceWriteRateLimit } from "../../../../../../lib/rate-limit";
import { createPublishedInvoiceForRequest } from "../../../../../../lib/square-billing";

export const runtime = "nodejs";

export async function POST(request, context) {
  const mutation = await enforceMutationRequest(request, (req) =>
    enforceWriteRateLimit(req, "manager-invoices")
  );
  if (mutation.error) {
    return mutation.error;
  }

  const auth = await requireBookingManager(request);
  if (auth.error) {
    return auth.error;
  }

  const params = await context.params;
  const requestRecord = await findRequestWithUserById(params.requestId);
  if (!requestRecord) {
    return jsonError("Request not found.", 404);
  }

  try {
    const invoice = await createPublishedInvoiceForRequest(requestRecord);
    await attachInvoiceToRequest(params.requestId, invoice);

    return jsonOk({
      invoice,
      request: await findRequestWithUserById(params.requestId)
    });
  } catch (error) {
    return jsonError(error.message || "Unable to create Square invoice.", 400);
  }
}
