import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthenticatedUser, SessionConfigurationError } from "./auth";
import { isBookingManager } from "./booking-manager";

async function buildServerRequest() {
  const headerStore = await headers();
  const cookieStore = await cookies();

  return {
    headers: {
      get(name) {
        return headerStore.get(name);
      }
    },
    cookies: {
      get(name) {
        return cookieStore.get(name);
      }
    }
  };
}

export async function requireWorkspaceUser({
  managerOnly = false,
  redirectAuthedManagersTo = null
} = {}) {
  const request = await buildServerRequest();
  let session;
  try {
    session = await getAuthenticatedUser(request);
  } catch (error) {
    if (error instanceof SessionConfigurationError) {
      console.error("Session authentication configuration error:", error.message);
      redirect("/portal?auth=unavailable");
    }
    throw error;
  }

  if (!session) {
    redirect("/portal?auth=required");
  }

  const manager = isBookingManager(session.user);
  if (managerOnly && !manager) {
    redirect("/dashboard");
  }

  if (!managerOnly && manager && redirectAuthedManagersTo) {
    redirect(redirectAuthedManagersTo);
  }

  return session;
}
