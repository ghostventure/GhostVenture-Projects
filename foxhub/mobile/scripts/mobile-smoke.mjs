import assert from "node:assert/strict";
import {
  authenticate,
  buildInitialAccounts,
  getAccessLabel,
  hasFoxHubManagementAccess,
  isAtLeast18
} from "../src/foxhubMobileCore.js";

let accounts = buildInitialAccounts();

assert.equal(isAtLeast18("1990-01-01", new Date("2026-06-13T12:00:00Z")), true);
assert.equal(isAtLeast18("2012-01-01", new Date("2026-06-13T12:00:00Z")), false);

assert.throws(
  () =>
    authenticate({
      accounts,
      route: "management",
      mode: "signin",
      draft: { email: "member@example.com", password: "FoxHubMember123" }
    }),
  /Not Permitted\./
);

assert.throws(
  () =>
    authenticate({
      accounts,
      route: "member",
      mode: "signin",
      draft: { email: "founder@foxhub.com", password: "FoxHubFounder123" }
    }),
  /Not Permitted\./
);

const management = authenticate({
  accounts,
  route: "management",
  mode: "signin",
  draft: { email: "founder@foxhub.com", password: "FoxHubFounder123" }
});
assert.equal(hasFoxHubManagementAccess(management.profile), true);
assert.equal(getAccessLabel(management.profile), "Management");

const member = authenticate({
  accounts,
  route: "member",
  mode: "signin",
  draft: { email: "member@example.com", password: "FoxHubMember123" }
});
assert.equal(member.profile.email, "member@example.com");
assert.equal(getAccessLabel(member.profile), "Priority member");

const signup = authenticate({
  accounts,
  route: "member",
  mode: "signup",
  draft: {
    email: "newmember@example.com",
    password: "FoxHubMember123",
    name: "New Member",
    handle: "newmember",
    city: "Atlanta",
    birthDate: "1998-02-14",
    inviteCode: "FOX-DEMO-2026"
  }
});
accounts = signup.accounts;
assert.equal(accounts["newmember@example.com"].displayName, "New Member");
assert.equal(accounts["newmember@example.com"].accessState, "sponsor_pending");

assert.throws(
  () =>
    authenticate({
      accounts,
      route: "member",
      mode: "signup",
      draft: {
        email: "too-young@example.com",
        password: "FoxHubMember123",
        name: "Too Young",
        birthDate: "2012-01-01"
      }
    }),
  /18\+/
);

console.log("foxhub mobile smoke passed");
