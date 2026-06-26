import { ProfileApp } from "../../components/profile-app";
import { listMessages, listRequests, sanitizeUser } from "../../lib/db";
import { requireWorkspaceUser } from "../../lib/server-page-auth";

export default async function ProfilePage() {
  const session = await requireWorkspaceUser();
  const [requests, messages] = await Promise.all([
    listRequests(session.user.id),
    listMessages(session.user.id)
  ]);

  return (
    <ProfileApp
      initialState={{
        user: sanitizeUser(session.user),
        requests,
        messageCount: messages.length
      }}
    />
  );
}
