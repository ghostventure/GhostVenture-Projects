import { MessagesApp } from "../../components/messages-app";
import { listMessagesPage, sanitizeUser } from "../../lib/db";
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
  const messagePage = await listMessagesPage(session.user.id, { includeCount: true });

  return <MessagesApp initialState={{ user: sanitizeUser(session.user), ...messagePage }} />;
}
