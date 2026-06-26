import {
  enforceMutationRequest,
  jsonOk,
  parseJsonWithSchema,
  requireAuthenticatedUser
} from "../../../lib/api-helpers";
import { createMessage, listMessages } from "../../../lib/db";
import { notifyNewClientMessage } from "../../../lib/email-notifications";
import { enforceWriteRateLimit } from "../../../lib/rate-limit";
import { messageSchema, parseWithSchema } from "../../../lib/validation";

export const runtime = "nodejs";

export async function GET(request) {
  const auth = await requireAuthenticatedUser(request);
  if (auth.error) {
    return auth.error;
  }

  return jsonOk({
    messages: await listMessages(auth.session.user.id)
  });
}

export async function POST(request) {
  const mutation = await enforceMutationRequest(request, (req) =>
    enforceWriteRateLimit(req, "messages")
  );
  if (mutation.error) {
    return mutation.error;
  }

  const auth = await requireAuthenticatedUser(request);
  if (auth.error) {
    return auth.error;
  }

  const parsed = await parseJsonWithSchema(request, messageSchema, parseWithSchema);
  if (parsed.error) {
    return parsed.error;
  }

  await createMessage({
    userId: auth.session.user.id,
    senderRole: "client",
    subject: parsed.data.subject,
    body: parsed.data.body
  });

  try {
    await notifyNewClientMessage({
      user: auth.session.user,
      subject: parsed.data.subject,
      body: parsed.data.body
    });
  } catch (error) {
    console.error("Client message email alert failed:", error);
  }

  return jsonOk({
    messages: await listMessages(auth.session.user.id)
  });
}
