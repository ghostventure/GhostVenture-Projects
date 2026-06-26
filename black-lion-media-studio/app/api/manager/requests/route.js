import { jsonOk, requireBookingManager } from "../../../../lib/api-helpers";
import { buildManagerDashboardData } from "../../../../lib/manager-dashboard-data";

export const runtime = "nodejs";

export async function GET(request) {
  const auth = await requireBookingManager(request);
  if (auth.error) {
    return auth.error;
  }

  return jsonOk(await buildManagerDashboardData());
}
