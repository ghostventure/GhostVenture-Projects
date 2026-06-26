import { DashboardApp } from "../../components/dashboard-app";
import { buildDashboardData } from "../../lib/dashboard-data";
import { requireWorkspaceUser } from "../../lib/server-page-auth";

export const metadata = {
  title: "Client Dashboard | Black Lion Studios"
};

export default async function DashboardPage() {
  const session = await requireWorkspaceUser();
  const initialState = await buildDashboardData(session.user);

  return <DashboardApp initialState={initialState} />;
}
