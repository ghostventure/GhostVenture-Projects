import { PortalContent } from "../../components/portal/portal-content";

export const metadata = {
  title: "Client Portal",
  description:
    "Create a Black Lion Studios account, start a service request, and keep project details, scheduling, billing context, and follow-up messages together.",
  alternates: { canonical: "/portal" }
};

export default function PortalPage() {
  return <PortalContent />;
}
