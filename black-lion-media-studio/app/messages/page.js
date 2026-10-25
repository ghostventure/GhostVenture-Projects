import { MessagesApp } from "../../components/messages-app";
import { listMessagesPage, listRequests, sanitizeUser } from "../../lib/db";
import { requireWorkspaceUser } from "../../lib/server-page-auth";

export const metadata = {
  title: "Messages",
  robots: {
    index: false,
    follow: false
  }
};

export default async function MessagesPage() {
  const session = await requireWorkspaceUser();
  const [messagePage, requests] = await Promise.all([
    listMessagesPage(session.user.id, { includeCount: true }),
    listRequests(session.user.id)
  ]);

  return <MessagesApp initialState={{ user: sanitizeUser(session.user), requests, ...messagePage }} />;
}
