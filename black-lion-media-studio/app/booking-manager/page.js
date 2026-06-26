import { BookingManagerApp } from "../../components/booking-manager-app";
import { buildManagerDashboardData } from "../../lib/manager-dashboard-data";
import { sanitizeUser } from "../../lib/db";
import { requireWorkspaceUser } from "../../lib/server-page-auth";

export const metadata = {
  title: "Booking Manager | Black Lion Studios"
};

export default async function BookingManagerPage() {
  const session = await requireWorkspaceUser({ managerOnly: true });
  const managerData = await buildManagerDashboardData();

  return (
    <BookingManagerApp
      initialState={{
        user: sanitizeUser(session.user),
        metrics: managerData.metrics || {},
        consultationCalendar: managerData.consultationCalendar || null,
        latestRequests: managerData.latestRequests || [],
        modelProfiles: managerData.modelProfiles || []
      }}
    />
  );
}
