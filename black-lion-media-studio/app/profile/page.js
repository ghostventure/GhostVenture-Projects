import { ProfileApp } from "../../components/profile-app";
import { countMessages, listRequests, sanitizeUser } from "../../lib/db";
import { requireWorkspaceUser } from "../../lib/server-page-auth";

export const metadata = {
  title: "Profile",
  robots: {
    index: false,
    follow: false
  }
};

export default async function ProfilePage() {
  const session = await requireWorkspaceUser();
  const [requests, messageCount] = await Promise.all([
    listRequests(session.user.id),
    countMessages(session.user.id)
  ]);

  return (
    <ProfileApp
      initialState={{
        user: sanitizeUser(session.user),
        requests,
        messageCount
      }}
    />
  );
}
