import { AuthFormCard } from "../auth-form-card";
import { PortalCredentialChecklist, PortalFormSidecar, ShortcutRail, SpotlightCard } from "../shared-ui";
import { checklistItems, railItems, sidecarTags } from "./portal-data";

export function PortalAccessPanel({ requiresAuth = false, idleReason = false }) {
  return (
    <div className="stack">
      <SpotlightCard
        className="panel highlight-panel"
        eyebrow="Access"
        title="Account access"
        copy="Sign up to save your project history, move through requests faster, and keep every next step in one place."
      >
        <ShortcutRail items={railItems} className="ui-shortcut-tight" />
      </SpotlightCard>

      <PortalFormSidecar title="The account can grow with" items={sidecarTags} />
      <AuthFormCard requiresAuth={requiresAuth} idleReason={idleReason} />
      <PortalCredentialChecklist items={checklistItems} />
    </div>
  );
}
