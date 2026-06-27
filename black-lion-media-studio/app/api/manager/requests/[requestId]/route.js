import {
  enforceMutationRequest,
  jsonError,
  jsonOk,
  parseJsonWithSchema,
  requireBookingManager
} from "../../../../../lib/api-helpers";
import { createMessage, findRequestWithUserById, updateManagerRequest } from "../../../../../lib/db";
import { enforceWriteRateLimit } from "../../../../../lib/rate-limit";
import { managerRequestUpdateSchema, parseWithSchema } from "../../../../../lib/validation";

export const runtime = "nodejs";

function buildDecisionMessage(status, requestRecord, managerNotes = "") {
  const projectType = requestRecord.project_type || "service";
  const note = managerNotes ? ` Manager note: ${managerNotes}` : "";

  if (status === "Approved") {
    return {
      subject: "Service request approved",
      body: `Your ${projectType} request has been approved for processing. The studio manager will continue the Square workflow for the required deposit, payment, and scheduling follow-up.${note}`
    };
  }

  if (status === "Declined") {
    return {
      subject: "Service request not approved",
      body: `Your ${projectType} request was not approved as submitted. Review any manager notes and message the studio if you want to revise the request or ask about next steps.${note}`
    };
  }

  return null;
}

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

  const decisionChanged =
    parsed.data.status &&
    ["Approved", "Declined"].includes(parsed.data.status) &&
    existing.status !== parsed.data.status;
  const decisionMessage = decisionChanged
    ? buildDecisionMessage(parsed.data.status, existing, parsed.data.managerNotes)
    : null;

  if (decisionMessage && existing.user_id) {
    await createMessage({
      userId: existing.user_id,
      senderRole: "studio",
      subject: decisionMessage.subject,
      body: decisionMessage.body
    });
  }

  return jsonOk({
    request: await findRequestWithUserById(params.requestId)
  });
}
