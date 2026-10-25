import {
  enforceMutationRequest,
  jsonError,
  jsonOk,
  parseJsonWithSchema,
  requireAuthenticatedUser
} from "../../../lib/api-helpers";
import { countMessages, countUnreadStudioMessages, createMessage, listMessagesPage, setMessageConversationReadState, userOwnsRequest } from "../../../lib/db";
import { notifyNewClientMessage } from "../../../lib/email-notifications";
import { enforceWriteRateLimit } from "../../../lib/rate-limit";
import { messageReadStateSchema, messageSchema, parseWithSchema } from "../../../lib/validation";

export const runtime = "nodejs";

export async function GET(request) {
  const auth = await requireAuthenticatedUser(request);
  if (auth.error) {
    return auth.error;
  }

  const cursor = new URL(request.url).searchParams.get("cursor") || "";
  const summary = new URL(request.url).searchParams.get("summary");
  if (summary === "count") {
    return jsonOk({ totalCount: await countMessages(auth.session.user.id) });
  }
  if (summary === "unread") {
    return jsonOk({ unreadCount: await countUnreadStudioMessages(auth.session.user.id) });
  }

  try {
    return jsonOk(await listMessagesPage(auth.session.user.id, {
      cursor,
      includeCount: !cursor
    }));
  } catch (error) {
    if (error instanceof TypeError && error.message === "Invalid message cursor.") {
      return jsonError("Invalid message history cursor.", 400);
    }
    throw error;
  }
}

export async function PATCH(request) {
  const mutation = await enforceMutationRequest(request, (req) =>
    enforceWriteRateLimit(req, "message-read-state")
  );
  if (mutation.error) return mutation.error;

  const auth = await requireAuthenticatedUser(request);
  if (auth.error) return auth.error;

  const parsed = await parseJsonWithSchema(request, messageReadStateSchema, parseWithSchema);
  if (parsed.error) return parsed.error;
  if (parsed.data.requestId && !(await userOwnsRequest(auth.session.user.id, parsed.data.requestId))) {
    return jsonError("That request is not available in this account.", 404);
  }

  const unreadCount = await setMessageConversationReadState(
    auth.session.user.id,
    parsed.data.requestId,
    parsed.data.isRead
  );
  return jsonOk({ ok: true, unreadCount });
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

  if (parsed.data.requestId && !(await userOwnsRequest(auth.session.user.id, parsed.data.requestId))) {
    return jsonError("That request is not available in this account.", 404);
  }

  const message = await createMessage({
    userId: auth.session.user.id,
    senderRole: "client",
    subject: parsed.data.subject,
    body: parsed.data.body,
    requestId: parsed.data.requestId
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

  return jsonOk({ message }, { status: 201 });
}
