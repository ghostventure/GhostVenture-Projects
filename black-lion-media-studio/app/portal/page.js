import { PortalContent } from "../../components/portal/portal-content";

export default async function PortalPage({ searchParams }) {
  const params = await searchParams;
  const requiresAuth = params?.auth === "required";
  const idleReason = params?.reason === "idle";
  return <PortalContent requiresAuth={requiresAuth} idleReason={idleReason} />;
}
