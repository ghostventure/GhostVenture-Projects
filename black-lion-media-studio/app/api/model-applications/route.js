import {
  enforceMutationRequest,
  jsonError,
  jsonOk,
  parseJsonWithSchema,
  sessionConfigurationResponse
} from "../../../lib/api-helpers";
import { createSignedSessionToken, withSessionCookie } from "../../../lib/auth";
import {
  createModelApplication,
  findUserById,
  listRequests,
  ModelApplicationConflictError,
  sanitizeUser
} from "../../../lib/db";
import { notifyNewModelApplication } from "../../../lib/email-notifications";
import { enforceWriteRateLimit } from "../../../lib/rate-limit";
import { modelApplicationSchema, parseWithSchema } from "../../../lib/validation";

export const runtime = "nodejs";

export async function POST(request) {
  const sessionConfiguration = sessionConfigurationResponse();
  if (sessionConfiguration) return sessionConfiguration;

  const mutation = await enforceMutationRequest(request, (req) =>
    enforceWriteRateLimit(req, "model-applications")
  );
  if (mutation.error) {
    return mutation.error;
  }

  const parsed = await parseJsonWithSchema(request, modelApplicationSchema, parseWithSchema);
  if (parsed.error) {
    return parsed.error;
  }

  let saved;
  try {
    saved = await createModelApplication(parsed.data);
  } catch (error) {
    if (error instanceof ModelApplicationConflictError) {
      return jsonError(error.message, 409);
    }

    console.error("Model application persistence failed:", {
      name: error?.name || "Error",
      code: error?.code || "UNKNOWN"
    });
    return jsonError("We could not save your application right now. Please try again shortly.", 503);
  }

  notifyNewModelApplication(parsed.data).catch((error) => {
    console.error("Model application email alert failed:", error);
  });

  const user = await findUserById(saved.userId);
  const token = createSignedSessionToken(saved.userId, request);
  const response = jsonOk(
    {
      sessionToken: token,
      user: sanitizeUser(user),
      requests: await listRequests(saved.userId),
      applicationId: saved.applicationId,
      message: "Application received. Your model profile account is ready for PII updates."
    },
    { status: 201 }
  );

  return withSessionCookie(response, token);
}
