import { jsonOk, requireAuthenticatedUser } from "../../../lib/api-helpers";
import { buildDashboardData } from "../../../lib/dashboard-data";

export const runtime = "nodejs";

export async function GET(request) {
  const auth = await requireAuthenticatedUser(request);
  if (auth.error) {
    return auth.error;
  }

  return jsonOk(await buildDashboardData(auth.session.user));
}
