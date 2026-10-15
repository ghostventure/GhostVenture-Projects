export const OWNER_EMAILS = new Set([
  "founder@foxhub.com",
  "solidartentertainment@gmail.com",
  "blacklionmediastudio@gmail.com"
]);

export const SEEDED_ACCOUNTS = [
  {
    email: "founder@foxhub.com",
    password: "FoxHubFounder123",
    name: "FoxHub Founder",
    handle: "@founder",
    city: "Atlanta",
    accountClass: "management",
    accessState: "owner"
  },
  {
    email: "member@example.com",
    password: "FoxHubMember123",
    name: "Demo Member",
    handle: "@demo",
    city: "Atlanta",
    accountClass: "member",
    accessState: "priority",
    accessNote: "Priority member access"
  }
];

export function normalizeEmail(email = "") {
  return String(email || "").trim().toLowerCase();
}

export function isFoxHubDomainEmail(email = "") {
  const normalized = normalizeEmail(email);
  return normalized.endsWith("@foxhub.com") || normalized.endsWith("@foxhub.app");
}

export function hasFoxHubManagementAccess(profile = {}) {
  const email = normalizeEmail(profile.email);
  return profile.accountClass === "management" || OWNER_EMAILS.has(email) || isFoxHubDomainEmail(email);
}

export function isAtLeast18(birthDate = "", now = new Date()) {
  const date = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const birthdayThisYear = new Date(now.getFullYear(), date.getMonth(), date.getDate());
  let age = now.getFullYear() - date.getFullYear();
  if (birthdayThisYear > now) age -= 1;
  return age >= 18;
}

export function createProfile(draft = {}, accountClass = "member") {
  const email = normalizeEmail(draft.email);
  const name = String(draft.name || "").trim();
  const handleSeed = String(draft.handle || email.split("@")[0] || "foxhub").trim();
  const handle = handleSeed.startsWith("@") ? handleSeed : `@${handleSeed}`;
  const inviteCode = String(draft.inviteCode || "").trim();
  const management = accountClass === "management" || OWNER_EMAILS.has(email) || isFoxHubDomainEmail(email);

  return {
    id: `profile-${email || Date.now()}`,
    email,
    name: name || (management ? "FoxHub Management" : "FoxHub Member"),
    displayName: name || (management ? "FoxHub Management" : "FoxHub Member"),
    handle,
    city: String(draft.city || "").trim(),
    zipCode: String(draft.zipCode || "").trim(),
    birthDate: String(draft.birthDate || "").trim(),
    inviteCode,
    sponsorHandle: String(draft.sponsorHandle || "").trim(),
    accountClass: management ? "management" : "member",
    accessState: management ? "owner" : inviteCode ? "sponsor_pending" : "waitlist",
    accessNote: management
      ? "Management workspace access"
      : inviteCode
        ? "Sponsor approval pending"
        : "FoxHub Management review pending",
    onboarded: management || Boolean(inviteCode),
    lastActiveAt: new Date().toISOString()
  };
}

export function buildInitialAccounts() {
  return SEEDED_ACCOUNTS.reduce((accounts, account) => {
    const email = normalizeEmail(account.email);
    accounts[email] = {
      ...createProfile(account, account.accountClass),
      ...account,
      email
    };
    return accounts;
  }, {});
}

export function authenticate({ accounts, route, mode, draft }) {
  const email = normalizeEmail(draft.email);
  const password = String(draft.password || "");
  if (!email || !password) {
    throw new Error("Email and password are required.");
  }

  const existing = accounts[email];
  const routeIsManagement = route === "management";

  if (mode === "signup") {
    if (routeIsManagement) throw new Error("Not Permitted.");
    if (isFoxHubDomainEmail(email) || OWNER_EMAILS.has(email)) throw new Error("Not Permitted.");
    if (existing) throw new Error("This email is already registered.");
    if (!isAtLeast18(draft.birthDate)) throw new Error("FoxHub membership requires 18+ age verification.");
    const profile = createProfile(draft, "member");
    return {
      profile,
      accounts: {
        ...accounts,
        [email]: {
          ...profile,
          password
        }
      }
    };
  }

  if (!existing || existing.password !== password) {
    throw new Error("No matching FoxHub account was found.");
  }

  const management = hasFoxHubManagementAccess(existing);
  if (routeIsManagement && !management) throw new Error("Not Permitted.");
  if (!routeIsManagement && management) throw new Error("Not Permitted.");

  return {
    profile: {
      ...existing,
      lastActiveAt: new Date().toISOString()
    },
    accounts
  };
}

export function getAccessLabel(profile = {}) {
  if (hasFoxHubManagementAccess(profile)) return "Management";
  if (profile.accessState === "priority") return "Priority member";
  if (profile.accessState === "sponsor_pending") return "Sponsor review";
  return "Management review";
}
