import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ADULT_BIRTH_DATE = "1990-01-01";
const UNDERAGE_BIRTH_DATE = "2010-01-01";

function installLocalStorageShim() {
  const store = new Map();
  global.localStorage = {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    }
  };
}

function captchaProof() {
  const captchaChallenge = { id: `captcha-test-${Date.now()}`, prompt: "2 + 2", answer: "4", issuedAt: Date.now() };
  return { captchaChallenge, captchaAnswer: "4", website: "" };
}

test("shared owner email rules include solidart management account", async () => {
  const rules = await import(`../src/rules.js?test=${Date.now()}`);

  assert.equal(rules.FOXHUB_PRIMARY_OWNER_EMAIL, "solidartentertainment@gmail.com");
  assert.equal(rules.isFoxHubOwnerEmail("solidartentertainment@gmail.com"), true);
  assert.equal(rules.isFoxHubOwnerEmail("founder@foxhubapp.com"), true);
  assert.equal(rules.isFoxHubOwnerEmail("member@example.com"), false);
  assert.equal(rules.isFoxHubStaffEmail("operator@foxhub.com"), true);
  assert.equal(rules.isFoxHubStaffEmail("operator@foxhub.io"), true);
  assert.equal(rules.isFoxHubStaffEmail("operator@foxhubapp.com"), true);
  assert.equal(rules.isFoxHubStaffEmail("operator@foxhubapp.io"), true);
  assert.equal(rules.isFoxHubStaffEmail("operator@personal-foxhubapp.com"), true);
  assert.equal(rules.isFoxHubStaffEmail("operator@notfox.example"), false);
  assert.equal(rules.hasFoxHubStaffAccess({ email: "member@example.com", role: "member" }), false);
  assert.equal(rules.hasFoxHubStaffAccess({ email: "manager@business.example", managerAccess: true }), false);
  assert.equal(rules.hasFoxHubStaffAccess({ email: "staff@business.example", staffAccess: true }), false);
  assert.equal(rules.hasFoxHubStaffAccess({ email: "solidartentertainment@gmail.com", role: "member" }), false);
  assert.equal(rules.hasFoxHubStaffAccess({ email: "operator@foxhub.com" }), true);
  assert.equal(rules.hasFoxHubStaffAccess({ email: "operator@foxhubapp.com" }), true);
  assert.equal(rules.hasFoxHubStaffAccess({ email: "operator@foxhub.com", staffAccess: true }), true);
  assert.equal(rules.hasFoxHubStaffAccess({ email: "manager@foxhub.com", managerAccess: true }), true);
  assert.equal(rules.hasFoxHubStaffAccess({ email: "operator@foxhubapp.com", staffAccess: true }), true);
  assert.equal(rules.hasFoxHubStaffAccess({ email: "manager@foxhubapp.io", managerAccess: true }), true);
  assert.equal(rules.hasFoxHubManagementAccess({ email: "solidartentertainment@gmail.com" }), false);
  assert.equal(rules.hasFoxHubManagementAccess({ email: "manager@business.example", managerAccess: true }), false);
  assert.equal(rules.hasFoxHubManagementAccess({ email: "admin@foxhubapp.com" }), true);
  assert.equal(rules.validateRequiredProfileFields({ email: "admin@foxhubapp.com", name: "", handle: "", city: "" }), "");
  assert.equal(rules.validateRequiredProfileFields({ email: "founder@foxhubapp.com", name: "", handle: "", city: "" }), "");
  assert.equal(rules.canOpenOnboarding({ email: "admin@foxhubapp.com", accessState: "priority" }), false);
  assert.equal(rules.hasApprovedVendorAccess({ email: "vendor@example.com", merchantStatus: "approved" }), true);
  assert.equal(rules.hasApprovedVendorAccess({ email: "vendor@example.com", merchantAccount: { status: "active" } }), true);
  assert.equal(rules.hasApprovedVendorAccess({ email: "vendor@example.com", merchantStatus: "review" }), false);
  assert.equal(rules.getAccountEmblem({ email: "staff@foxhubapp.com" }).label, "FoxHub Staff");
  assert.equal(rules.getAccountEmblem({ email: "vendor@example.com", merchantStatus: "approved" }).label, "Vendor");
  assert.equal(rules.getAccountEmblem({ email: "member@example.com", merchantStatus: "review" }).label, "Member");
  assert.equal(rules.canUseTheme({ email: "member@example.com" }, "premium-silver"), false);
  assert.equal(rules.canUseTheme({ email: "member@example.com", premiumThemes: ["premium-silver"] }, "premium-silver"), true);
  assert.equal(rules.canUseTheme({ email: "member@example.com", themeEntitlements: { "premium-gold": "active" } }, "premium-gold"), true);
  assert.equal(rules.canUseTheme({ email: "staff@foxhubapp.com" }, "premium-marble"), true);
  assert.equal(rules.canUseTheme({ email: "member@example.com" }, "matrix"), true);
});

test("local profile survives save, sign out, and sign in with the same email", async () => {
  installLocalStorageShim();
  const repo = await import(`../src/repository-local.js?test=${Date.now()}`);

  let state = await repo.loadState();
  const signedUp = await repo.signInProfile({
    authMode: "signup",
    ...captchaProof(),
    email: "profile.persist@example.com",
    password: "PersistPass123",
    birthDate: ADULT_BIRTH_DATE,
    name: "Original Name",
    handle: "originalhandle",
    city: "Atlanta",
    accessState: "waitlist"
  });

  state = { ...state, ...signedUp };
  await repo.saveState(state);

  const editedProfile = await repo.updateProfileRecord({
    ...state.profile,
    name: "Saved Name",
    handle: "savedhandle",
    city: "Charlotte",
    bio: "This profile should survive logout.",
    occupation: "Operator",
    demographic: "Founders",
    pronouns: "they/them",
    website: "saved-profile.test",
    availability: "Weekends",
    interests: "local services, creator work",
    profilePhoto: {
      id: "profile-photo-test",
      name: "saved-profile.png",
      type: "image/png",
      url: "data:image/png;base64,iVBORw0KGgo=",
      size: 68
    },
    profilePhotoUrl: "data:image/png;base64,iVBORw0KGgo=",
    profilePhotoName: "saved-profile.png",
    profilePhotoType: "image/png"
  });

  state = { ...state, profile: editedProfile, authenticated: true };
  await repo.saveState(state);

  const signedOut = await repo.signOutCurrentProfile();
  await repo.saveState(signedOut);

  const signedBackIn = await repo.signInProfile({
    authMode: "signin",
    email: "profile.persist@example.com",
    password: "PersistPass123"
  });

  assert.equal(signedBackIn.profile.name, "Saved Name");
  assert.equal(signedBackIn.profile.displayName, "Saved Name");
  assert.equal(signedBackIn.profile.handle, "@savedhandle");
  assert.equal(signedBackIn.profile.city, "Charlotte");
  assert.equal(signedBackIn.profile.bio, "This profile should survive logout.");
  assert.equal(signedBackIn.profile.occupation, "Operator");
  assert.equal(signedBackIn.profile.demographic, "Founders");
  assert.equal(signedBackIn.profile.pronouns, "they/them");
  assert.equal(signedBackIn.profile.website, "saved-profile.test");
  assert.equal(signedBackIn.profile.availability, "Weekends");
  assert.equal(signedBackIn.profile.interests, "local services, creator work");
  assert.equal(signedBackIn.profile.profilePhotoUrl, "data:image/png;base64,iVBORw0KGgo=");
  assert.equal(signedBackIn.profile.profilePhotoName, "saved-profile.png");
  assert.equal(signedBackIn.profile.profilePhotoType, "image/png");
  assert.equal(signedBackIn.profile.profilePhoto.url, "data:image/png;base64,iVBORw0KGgo=");
  assert.match(signedBackIn.profile.oneId, /^FOX-[A-Z0-9]{1,12}$/);
  assert.equal(signedBackIn.profile.oneId, editedProfile.oneId);
});

test("local signup creates a stable OneID account marker", async () => {
  installLocalStorageShim();
  const repo = await import(`../src/repository-local.js?test=${Date.now()}`);

  const signedUp = await repo.signInProfile({
    authMode: "signup",
    ...captchaProof(),
    email: "oneid.user@example.com",
    password: "OneIdPass123",
    birthDate: ADULT_BIRTH_DATE,
    name: "OneID User",
    handle: "oneiduser",
    city: "Atlanta",
    accessState: "waitlist"
  });

  assert.match(signedUp.profile.oneId, /^FOX-[A-Z0-9]{1,12}$/);

  await repo.saveState({ ...(await repo.loadState()), ...signedUp });
  const signedBackIn = await repo.signInProfile({
    authMode: "signin",
    email: "oneid.user@example.com",
    password: "OneIdPass123"
  });

  assert.equal(signedBackIn.profile.oneId, signedUp.profile.oneId);
});

test("local signup requires a robot check proof", async () => {
  installLocalStorageShim();
  const repo = await import(`../src/repository-local.js?test=${Date.now()}`);

  await assert.rejects(
    () =>
      repo.signInProfile({
        authMode: "signup",
        email: "robot.block@example.com",
        password: "RobotBlock123",
        birthDate: ADULT_BIRTH_DATE,
        name: "Robot Block",
        handle: "robotblock",
        city: "Atlanta",
        accessState: "waitlist"
      }),
    /robot check/i
  );
});

test("local signup rejects an email that is already registered", async () => {
  installLocalStorageShim();
  const repo = await import(`../src/repository-local.js?test=${Date.now()}`);

  await repo.signInProfile({
    authMode: "signup",
    ...captchaProof(),
    email: "taken.email@example.com",
    password: "TakenEmail123",
    birthDate: ADULT_BIRTH_DATE,
    name: "Taken Email",
    handle: "takenemail",
    city: "Atlanta",
    accessState: "waitlist"
  });

  await assert.rejects(
    () =>
      repo.signInProfile({
        authMode: "signup",
    ...captchaProof(),
        email: "taken.email@example.com",
        password: "DifferentPass123",
        birthDate: ADULT_BIRTH_DATE,
        name: "Second Person",
        handle: "secondperson",
        city: "Charlotte",
        accessState: "waitlist"
      }),
    /already registered/
  );
});

test("local profile edit keeps the registered account email", async () => {
  installLocalStorageShim();
  const repo = await import(`../src/repository-local.js?test=${Date.now()}`);

  const signedUp = await repo.signInProfile({
    authMode: "signup",
    ...captchaProof(),
    email: "sticky.email@example.com",
    password: "StickyEmail123",
    birthDate: ADULT_BIRTH_DATE,
    name: "Sticky Email",
    handle: "stickyemail",
    city: "Atlanta",
    accessState: "waitlist"
  });

  const edited = await repo.updateProfileRecord({
    ...signedUp.profile,
    email: "changed.email@example.com",
    name: "Sticky Updated",
    handle: "stickyupdated",
    city: "Savannah"
  });

  assert.equal(edited.email, "sticky.email@example.com");
});

test("local partial profile edit preserves saved profile details", async () => {
  installLocalStorageShim();
  const repo = await import(`../src/repository-local.js?test=${Date.now()}`);

  const signedUp = await repo.signInProfile({
    authMode: "signup",
    ...captchaProof(),
    email: "partial.profile@example.com",
    password: "PartialPass123",
    birthDate: ADULT_BIRTH_DATE,
    name: "Partial Original",
    handle: "partialoriginal",
    city: "Atlanta",
    accessState: "waitlist"
  });

  const complete = await repo.updateProfileRecord({
    ...signedUp.profile,
    name: "Partial Saved",
    handle: "partialsaved",
    city: "Birmingham",
    bio: "Saved bio should not reset.",
    occupation: "Service Provider",
    demographic: "Local vendors",
    pronouns: "she/her",
    website: "partial.example.com",
    availability: "Mornings",
    interests: "home services, referrals"
  });

  const partial = await repo.updateProfileRecord({
    email: "partial.profile@example.com",
    name: "",
    handle: "",
    city: "",
    bio: "",
    occupation: "",
    demographic: "",
    pronouns: "",
    website: "",
    availability: "",
    interests: ""
  });

  assert.equal(partial.name, complete.name);
  assert.equal(partial.displayName, complete.displayName);
  assert.equal(partial.handle, complete.handle);
  assert.equal(partial.city, complete.city);
  assert.equal(partial.bio, complete.bio);
  assert.equal(partial.occupation, complete.occupation);
  assert.equal(partial.demographic, complete.demographic);
  assert.equal(partial.pronouns, complete.pronouns);
  assert.equal(partial.website, complete.website);
  assert.equal(partial.availability, complete.availability);
  assert.equal(partial.interests, complete.interests);
});

test("local founder profile keeps custom identity when stale founder snapshot saves", async () => {
  installLocalStorageShim();
  const repo = await import(`../src/repository-local.js?test=${Date.now()}`);

  const scrubbedDefault = await repo.updateProfileRecord({
    email: "founder@foxhubapp.com",
    name: "FoxHub Founder",
    handle: "@founder",
    city: "Atlanta",
    bio: "Founder-level management account for FoxHub staff review, member approvals, and moderation oversight.",
    occupation: "Founder",
    demographic: "FoxHub management",
    role: "founder",
    managerAccess: true,
    staffAccess: true
  });

  assert.equal(scrubbedDefault.name, "");
  assert.equal(scrubbedDefault.handle, "");
  assert.equal(scrubbedDefault.city, "");
  assert.equal(scrubbedDefault.bio, "");
  assert.equal(scrubbedDefault.occupation, "");
  assert.equal(scrubbedDefault.demographic, "");

  const edited = await repo.updateProfileRecord({
    email: "solidartentertainment@gmail.com",
    name: "Solid Art Founder",
    handle: "solidart",
    city: "Detroit",
    bio: "Founder profile with custom public details.",
    occupation: "Founder Operator",
    demographic: "FoxHub leadership",
    pronouns: "he/him",
    website: "foxhub.example",
    availability: "By appointment",
    interests: "community technology, privacy, local commerce",
    role: "founder",
    managerAccess: true,
    staffAccess: true
  });

  const staleFounderSnapshot = {
    ...edited,
    name: "FoxHub Founder",
    handle: "@founder",
    city: "Atlanta",
    bio: "Founder-level management account for FoxHub staff review, member approvals, and moderation oversight.",
    occupation: "Founder",
    pronouns: "",
    website: "",
    availability: "",
    interests: ""
  };

  const state = await repo.loadState();
  await repo.saveState({
    ...state,
    profile: staleFounderSnapshot,
    authenticated: true
  });

  const signedBackIn = await repo.updateProfileRecord({
    email: "solidartentertainment@gmail.com",
    name: "",
    handle: "",
    city: "",
    bio: "",
    occupation: "",
    demographic: "",
    pronouns: "",
    website: "",
    availability: "",
    interests: ""
  });

  assert.equal(signedBackIn.name, "Solid Art Founder");
  assert.equal(signedBackIn.displayName, "Solid Art Founder");
  assert.equal(signedBackIn.handle, "@solidart");
  assert.equal(signedBackIn.city, "Detroit");
  assert.equal(signedBackIn.bio, "Founder profile with custom public details.");
  assert.equal(signedBackIn.occupation, "Founder Operator");
  assert.equal(signedBackIn.pronouns, "he/him");
  assert.equal(signedBackIn.website, "foxhub.example");
  assert.equal(signedBackIn.availability, "By appointment");
  assert.equal(signedBackIn.interests, "community technology, privacy, local commerce");
  assert.equal(signedBackIn.role, "founder");
  assert.equal(signedBackIn.managerAccess, true);
  assert.equal(signedBackIn.staffAccess, true);
});

test("local future member signup starts with blank optional profile fields", async () => {
  installLocalStorageShim();
  const repo = await import(`../src/repository-local.js?test=${Date.now()}`);

  const signedUp = await repo.signInProfile({
    authMode: "signup",
    ...captchaProof(),
    email: "future.blank.profile@example.com",
    password: "FutureBlank123",
    birthDate: ADULT_BIRTH_DATE,
    name: "Future Member",
    handle: "futuremember",
    city: "Memphis",
    accessState: "waitlist"
  });

  assert.equal(signedUp.profile.name, "Future Member");
  assert.equal(signedUp.profile.displayName, "Future Member");
  assert.equal(signedUp.profile.handle, "@futuremember");
  assert.equal(signedUp.profile.city, "Memphis");
  assert.equal(signedUp.profile.bio, "");
  assert.equal(signedUp.profile.occupation, "");
  assert.equal(signedUp.profile.demographic, "");
  assert.equal(signedUp.profile.pronouns, "");
  assert.equal(signedUp.profile.website, "");
  assert.equal(signedUp.profile.availability, "");
  assert.equal(signedUp.profile.interests, "");
});

test("local member signup rejects FoxHub-domain emails", async () => {
  installLocalStorageShim();
  const repo = await import(`../src/repository-local.js?test=${Date.now()}`);

  for (const email of ["member@foxhub.test", "member@foxhub.io", "member@foxhub.biz", "member@foxhub.anything"]) {
    await assert.rejects(
      () =>
        repo.signInProfile({
          authMode: "signup",
    ...captchaProof(),
          email,
          password: "MemberPass123",
          name: "Member Profile",
          handle: "memberprofile",
          city: "Atlanta",
          accessState: "waitlist"
        }),
      /personal email/
    );
  }
});

test("local member signup locks repeated FoxHub-domain attempts and ignores spoofed staff flags", async () => {
  installLocalStorageShim();
  const repo = await import(`../src/repository-local.js?test=${Date.now()}`);
  const draft = {
    authMode: "signup",
    ...captchaProof(),
    email: "spoofed.staff@foxhub.com",
    password: "MemberPass123",
    name: "Spoofed Staff",
    handle: "spoofedstaff",
    city: "Atlanta",
    accessState: "waitlist",
    staffAccess: true,
    managerAccess: true
  };

  await assert.rejects(() => repo.signInProfile(draft), /personal email/);
  await assert.rejects(() => repo.signInProfile(draft), /personal email/);
  await assert.rejects(() => repo.signInProfile(draft), /blocked from member sign-up/);
});

test("local member signup requires 18+ age verification", async () => {
  installLocalStorageShim();
  const repo = await import(`../src/repository-local.js?test=${Date.now()}`);
  const baseDraft = {
    authMode: "signup",
    ...captchaProof(),
    email: "age.check@example.com",
    password: "AgeCheck123",
    name: "Age Check",
    handle: "agecheck",
    city: "Atlanta",
    accessState: "waitlist"
  };

  await assert.rejects(() => repo.signInProfile(baseDraft), /18 or older/);
  await assert.rejects(() => repo.signInProfile({ ...baseDraft, birthDate: UNDERAGE_BIRTH_DATE }), /18 or older/);

  const signedUp = await repo.signInProfile({ ...baseDraft, birthDate: ADULT_BIRTH_DATE });
  assert.equal(signedUp.profile.ageVerified, true);
  assert.match(signedUp.profile.ageVerifiedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(Object.prototype.hasOwnProperty.call(signedUp.profile, "birthDate"), false);
});

test("local sign-in rejects unknown emails instead of creating an account", async () => {
  installLocalStorageShim();
  const repo = await import(`../src/repository-local.js?test=${Date.now()}`);

  await assert.rejects(
    () =>
      repo.signInProfile({
        authMode: "signin",
        email: "not-registered@example.com",
        password: "Anything123"
      }),
    /No registered FoxHub account/
  );
});

test("local sign-in checks the saved password hash", async () => {
  installLocalStorageShim();
  const repo = await import(`../src/repository-local.js?test=${Date.now()}`);

  await repo.signInProfile({
    authMode: "signup",
    ...captchaProof(),
    email: "password.check@example.com",
    password: "CorrectPass123",
    birthDate: ADULT_BIRTH_DATE,
    name: "Password Check",
    handle: "passwordcheck",
    city: "Atlanta",
    accessState: "waitlist"
  });

  await assert.rejects(
    () =>
      repo.signInProfile({
        authMode: "signin",
        email: "password.check@example.com",
        password: "WrongPass123"
      }),
    /Invalid email or password/
  );
});

test("local invite creation installs a seven-day expiration", async () => {
  installLocalStorageShim();
  const repo = await import(`../src/repository-local.js?test=${Date.now()}`);
  const before = Date.now();

  const invite = await repo.createInviteRecord(
    { label: "Seven day invite" },
    { name: "Founder", handle: "@founder" }
  );

  const expiresAt = new Date(invite.expiresAt).getTime();
  const after = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  assert.ok(expiresAt >= before + sevenDaysMs, "invite should last at least seven days from creation");
  assert.ok(expiresAt <= after + sevenDaysMs + 1000, "invite expiration should be seven days, not longer");
});

test("local invite creation expires previously generated active invites", async () => {
  installLocalStorageShim();
  const repo = await import(`../src/repository-local.js?test=${Date.now()}`);

  const firstInvite = await repo.createInviteRecord(
    { label: "First invite" },
    { name: "Founder", handle: "@founder" }
  );
  const secondInvite = await repo.createInviteRecord(
    { label: "Second invite" },
    { name: "Founder", handle: "@founder" }
  );

  const state = await repo.loadState();
  const expiredFirst = state.invites.find((invite) => invite.id === firstInvite.id);
  const activeSecond = state.invites.find((invite) => invite.id === secondInvite.id);

  assert.equal(expiredFirst.status, "expired");
  assert.equal(expiredFirst.expirationReason, "Superseded by a newer invite code");
  assert.ok(new Date(expiredFirst.expiresAt).getTime() <= Date.now());
  assert.equal(activeSecond.status, "active");

  await assert.rejects(
    () =>
      repo.signInProfile({
        authMode: "signup",
    ...captchaProof(),
        email: "expired.previous@example.com",
        password: "ExpiredPrevious123",
        birthDate: ADULT_BIRTH_DATE,
        name: "Expired Previous",
        handle: "expiredprevious",
        city: "Atlanta",
        accessState: "priority",
        inviteCode: firstInvite.code
      }),
    /invalid or has already been used/
  );
});

test("firestore rules permit profile invite replacement to expire older codes", async () => {
  const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
  const firebaseRepository = await readFile(new URL("../src/repository-firebase.js", import.meta.url), "utf8");
  const inviteCreateRule = rules.match(/function validInviteCreate\(inviteId\) \{[\s\S]*?\n    \}/)?.[0] || "";

  assert.match(rules, /function canCreateInvite\(\) \{\s*return signedIn\(\);\s*\}/);
  assert.match(rules, /function validInviteCreate\(inviteId\)/);
  assert.match(rules, /allow create: if canCreateInvite\(\) &&\s*validInviteCreate\(inviteId\);/);
  assert.doesNotMatch(inviteCreateRule, /isFounder|isOwnerEmail|isPlatformOperator|canManagePlatform|email in/);
  assert.match(rules, /function canExpireOwnInviteForReplacement\(\)/);
  assert.match(rules, /allow update: if canExpireOwnInviteForReplacement\(\) \|\|/);
  assert.match(rules, /resource\.data\.createdBy == request\.auth\.uid/);
  assert.match(rules, /resource\.data\.status in \['active', 'sponsor_pending'\]/);
  assert.match(rules, /request\.resource\.data\.status == 'expired'/);
  assert.match(rules, /request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\.hasOnly/);
  assert.match(rules, /request\.resource\.data\.expirationReason == 'Superseded by a newer invite code'/);
  assert.match(firebaseRepository, /status: "expired",\s*expiresAt: serverTimestamp\(\),\s*expiredAt: serverTimestamp\(\),\s*expirationReason: "Superseded by a newer invite code"/);
});

test("local sign-up rejects expired invite codes", async () => {
  installLocalStorageShim();
  const repo = await import(`../src/repository-local.js?test=${Date.now()}`);
  const state = await repo.loadState();

  await repo.saveState({
    ...state,
    invites: [
      {
        id: "expired-invite",
        code: "FOX-EXPIRED",
        label: "Expired invite",
        note: "",
        createdBy: "@founder",
        createdByHandle: "@founder",
        status: "active",
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        redeemedBy: "",
        redeemedAt: ""
      }
    ]
  });

  await assert.rejects(
    () =>
      repo.signInProfile({
        authMode: "signup",
    ...captchaProof(),
        email: "expired.invite@example.com",
        password: "ExpiredInvite123",
        birthDate: ADULT_BIRTH_DATE,
        name: "Expired Invite",
        handle: "expiredinvite",
        city: "Atlanta",
        accessState: "priority",
        inviteCode: "FOX-EXPIRED"
      }),
    /invite code has expired/
  );
});

test("local invite signup waits for sponsor approval before access", async () => {
  installLocalStorageShim();
  const repo = await import(`../src/repository-local.js?test=${Date.now()}`);
  const state = await repo.loadState();
  const invite = await repo.createInviteRecord(
    { label: "Sponsor approval invite" },
    { name: "Current Sponsor", handle: "@sponsor" }
  );
  await repo.saveState({ ...state, invites: [invite] });

  const pending = await repo.signInProfile({
    authMode: "signup",
    ...captchaProof(),
    email: "sponsor.pending@example.com",
    password: "SponsorPending123",
    birthDate: ADULT_BIRTH_DATE,
    name: "Sponsor Pending",
    handle: "sponsorpending",
    city: "Atlanta",
    accessState: "priority",
    inviteCode: invite.code
  });

  assert.equal(pending.authenticated, false);
  assert.equal(pending.profile.accessState, "waitlist");
  assert.equal(pending.profile.accessNote, "Sponsor approval pending");

  const pendingState = await repo.loadState();
  const pendingInvite = pendingState.invites.find((item) => item.id === invite.id);
  assert.equal(pendingInvite.status, "sponsor_pending");
  assert.equal(pendingInvite.applicantEmail, "sponsor.pending@example.com");

  await repo.reviewSponsorInviteRecord(invite.id, "approve");
  const connectedState = await repo.loadState();
  const approvedContact = connectedState.contacts.find((contact) => contact.email === "sponsor.pending@example.com");
  assert.equal(approvedContact.status, "invite approved");
  assert.equal(approvedContact.referralSource, "sponsor invite");

  const approved = await repo.signInProfile({
    authMode: "signin",
    email: "sponsor.pending@example.com",
    password: "SponsorPending123"
  });

  assert.equal(approved.authenticated, true);
  assert.equal(approved.profile.accessState, "priority");
  assert.equal(approved.profile.accessNote, "Sponsor approved invite");
});
