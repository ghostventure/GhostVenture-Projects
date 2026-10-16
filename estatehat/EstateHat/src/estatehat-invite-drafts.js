export const INVITE_ROLES = Object.freeze(["agent", "inspector", "lender", "attorney", "support"]);
export const INVITE_SCOPES = Object.freeze(["property summary", "documents", "appointment details"]);

export function createInviteDraft(input, propertyTitle = "Property") {
  const email = String(input?.email || "").trim().toLowerCase().slice(0, 254);
  const role = INVITE_ROLES.includes(input?.role) ? input.role : "";
  const scope = INVITE_SCOPES.includes(input?.scope) ? input.scope : "";
  const message = String(input?.message || "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 500);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  if (!role || !scope) throw new Error("Choose a collaborator role and information scope.");
  return { email, role, scope, property: String(propertyTitle || "Property").slice(0, 160), message };
}

export function formatInviteDraft(invite) {
  return `EstateHat collaborator access request\n\nProperty: ${invite.property}\nRequested role: ${invite.role}\nRequested information: ${invite.scope}\nRecipient: ${invite.email}\n\n${invite.message || "Please contact the property owner to confirm the appropriate access."}\n\nThis is a draft only. EstateHat has not sent an invitation or granted access.`;
}

export function createInviteMailto(invite) {
  const subject = `EstateHat access request: ${invite.property}`;
  return `mailto:${encodeURIComponent(invite.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(formatInviteDraft(invite))}`;
}
