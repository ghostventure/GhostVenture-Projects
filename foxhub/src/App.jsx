import { Suspense, lazy, startTransition, useEffect, useMemo, useRef, useState } from "react";
import { miniApps, views } from "./data.js";
import {
  buildAccessModel,
  canUseTheme,
  canOpenOnboarding,
  getAccessGateMessage,
  getAccessStatusLabel,
  getAuthSubmitLabel,
  getEntryDescription,
  hasFoxHubManagementAccess,
  hasFoxHubStaffAccess,
  isAtLeast18,
  isFoxHubDomainEmail,
  isWaitlistProfile,
  normalizeProfileDraft,
  officialThreadIdForAccount,
  validateRequiredProfileFields,
  evaluateListingPost,
  getListingCategories,
  getListingTypes,
  getListingTags,
  matchesListingSearch,
  buildListingAlert,
  getOwnTrustTier,
  THEME_OPTIONS
} from "./rules.js";
import { buildModerationCase, evaluateTransactionAction } from "./transaction-moderation.js";
import { useFoxHubStore } from "./useFoxHubStore.js";
import { footerBoilerplateGroups, footerQuickAccessLinks, getFooterItemHref, getFooterPageByPath } from "./footerBoilerplates.js";
import { createCaptchaChallenge, validateCaptchaProof } from "./captchaGuard.js";
import { IMAGE_UPLOAD_ACCEPT, prepareImageAttachment } from "./mediaUploads.js";
import RuntimeErrorBoundary from "./RuntimeErrorBoundary.jsx";
import { createRetryingLazyImport } from "./runtimeReliability.js";
import FoxHeadMark from "./FoxHeadMark.jsx";

const FoxHubShell = lazy(createRetryingLazyImport(() => import("./FoxHubShell.jsx"), "foxhub-shell"));
const IDLE_SIGN_OUT_MS = 10 * 60 * 1000;
const AUTH_WINDOW_MS = 60 * 1000;
const MAX_AUTH_FAILURES = 5;
const THEME_IDS = THEME_OPTIONS.map((item) => item.id);
const DEFAULT_THEME_ID = "green-composite";
const STAFF_WORKSPACE_TAB_IDS = new Set(["staff", "connectors", "blueprint"]);
const PROFILE_DRAFT_STORAGE_PREFIX = "foxhub-profile-draft:";
const SIGNUP_FEEDBACK_STORAGE_KEY = "foxhub-signup-feedback-requests";
const SIGNUP_SUPPORT_EMAIL = "support@foxhub.app";

function createDefaultAuthDraft() {
  const captchaChallenge = createCaptchaChallenge();
  return {
    name: "",
    handle: "",
    city: "",
    zipCode: "",
    postalCode: "",
    birthDate: "",
    email: "",
    password: "",
    inviteCode: "",
    sponsorHandle: "",
    accessPath: "waitlist",
    captchaChallenge,
    captchaAnswer: "",
    website: ""
  };
}

function getProfileDraftStorageKey(email = "") {
  const normalized = String(email || "").trim().toLowerCase();
  return normalized ? `${PROFILE_DRAFT_STORAGE_PREFIX}${normalized}` : "";
}

function mergeStoredProfileDraft(baseDraft = {}, storedDraft = {}) {
  const next = { ...baseDraft };
  ["name", "handle", "city", "zipCode", "postalCode", "bio", "occupation", "demographic", "pronouns", "website", "availability", "interests", "profilePhoto", "profilePhotoUrl", "profilePhotoName", "profilePhotoType"].forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(storedDraft, field)) {
      next[field] = storedDraft[field] || "";
    }
  });
  return next;
}

function connectorStatusLabel(status = "") {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("active") || normalized.includes("live") || normalized.includes("connected")) return "Active";
  return "Ready";
}

function getInviteExpiresAtMillis(invite = {}) {
  const value = invite.expiresAt;
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getInviteExpiryLabel(invite = {}) {
  const expiresAt = getInviteExpiresAtMillis(invite);
  if (!expiresAt) return "Expires in 7 days";
  const remainingMs = expiresAt - Date.now();
  if (remainingMs <= 0) return "Expired";
  const days = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
  if (days >= 2) return `Expires in ${days} days`;
  const hours = Math.ceil(remainingMs / (60 * 60 * 1000));
  return `Expires in ${Math.max(1, hours)} hour${hours === 1 ? "" : "s"}`;
}

function TutorialAssistant({ profile, currentTab, setActiveTab, openProfilePanel, completeTutorial }) {
  const profileReady = Boolean(profile.name && profile.handle && profile.city);
  const steps = [
    {
      id: "profile",
      title: "Finish your identity card",
      detail: profileReady ? `${profile.name || profile.handle} is ready for social, rapport, community, and services.` : "Add your public display name, username, and city so FoxHub knows how to place you in the community rapport network.",
      complete: profileReady,
      action: () => openProfilePanel(),
      actionLabel: profileReady ? "Review profile" : "Open profile"
    },
    {
      id: "social",
      title: "Start from Social",
      detail: currentTab === "chat" ? "You are already in the social layer." : "Start with conversations, moments, groups, calls, and saved context.",
      complete: currentTab === "chat",
      action: () => setActiveTab("chat"),
      actionLabel: "Open Social"
    },
    {
      id: "rapport",
      title: "Check Rapport",
      detail: currentTab === "circles" ? "You are already in Rapport." : "Open Rapport to see people, trust context, vouches, introductions, and circles.",
      complete: currentTab === "circles",
      action: () => setActiveTab("circles"),
      actionLabel: "Open Rapport"
    },
    {
      id: "services",
      title: "Try Services / Merchant",
      detail: currentTab === "discover" ? "You are already in Services / Merchant." : "Open Services / Merchant after social and rapport context are clear.",
      complete: currentTab === "discover",
      action: () => setActiveTab("discover"),
      actionLabel: "Open Services"
    }
  ];
  const completedCount = steps.filter((step) => step.complete).length;

  return (
    <section className="surface-row">
      <article className="surface surface-strong">
        <div className="surface-head">
          <p className="card-label">Tutorial assistant</p>
          <span className="badge subtle">{completedCount}/{steps.length} steps</span>
        </div>
        <div className="surface-note">
          A quick first-run guide for new users. It stays practical: identity, social, rapport, then services.
        </div>
        <div className="list-stack">
          {steps.map((step) => (
            <div key={step.id} className="list-row">
              <div>
                <strong>{step.title}</strong>
                <p>{step.detail}</p>
              </div>
              <div className="inline-actions wrap">
                <span className={step.complete ? "badge subtle" : "badge review"}>{step.complete ? "Done" : "Next"}</span>
                <button type="button" className="ghost-button small" onClick={step.action}>
                  {step.actionLabel}
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="inline-actions wrap">
          <button type="button" className="accent-button" onClick={completeTutorial}>
            Dismiss tutorial
          </button>
        </div>
      </article>
    </section>
  );
}

function CaptchaGate({ authDraft, setAuthDraft }) {
  const challenge = authDraft.captchaChallenge || createCaptchaChallenge();
  function refreshChallenge() {
    setAuthDraft({
      ...authDraft,
      captchaChallenge: createCaptchaChallenge(),
      captchaAnswer: "",
      website: ""
    });
  }

  return (
    <div className="captcha-gate" aria-label="Robot check">
      <input
        type="text"
        tabIndex="-1"
        autoComplete="off"
        className="captcha-honeypot"
        value={authDraft.website || ""}
        onChange={(event) => setAuthDraft({ ...authDraft, website: event.target.value })}
        aria-hidden="true"
      />
      <div>
        <p className="card-label">Robot check</p>
        <strong>Keep remotes and robots out.</strong>
        <span>Solve: {challenge.prompt}</span>
      </div>
      <label>
        Answer
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={authDraft.captchaAnswer || ""}
          onChange={(event) => setAuthDraft({ ...authDraft, captchaChallenge: challenge, captchaAnswer: event.target.value })}
          placeholder="Enter answer"
        />
      </label>
      <button type="button" className="ghost-button small" onClick={refreshChallenge}>
        Refresh check
      </button>
    </div>
  );
}

function getAdultBirthDateMax(referenceDate = new Date()) {
  const value = new Date(referenceDate);
  value.setFullYear(value.getFullYear() - 18);
  return value.toISOString().slice(0, 10);
}

function isStrongSignupPassword(value = "") {
  const password = String(value || "");
  return password.length >= 10 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
}

function getSignupReadiness(authDraft = {}) {
  const emailReady = Boolean(String(authDraft.email || "").trim());
  const passwordReady = isStrongSignupPassword(authDraft.password);
  const accessReady = authDraft.accessPath !== "invite" || Boolean(String(authDraft.inviteCode || "").trim());
  const profileReady = !validateRequiredProfileFields(normalizeProfileDraft(authDraft));
  const ageReady = isAtLeast18(authDraft.birthDate);
  const captchaReady = !validateCaptchaProof(authDraft);
  const items = [
    { id: "credentials", label: "Email and strong password", ready: emailReady && passwordReady },
    { id: "access", label: authDraft.accessPath === "invite" ? "Invite code entered" : "Manager review selected", ready: accessReady },
    { id: "profile", label: "Profile basics complete", ready: profileReady },
    { id: "age", label: "18+ date of birth", ready: ageReady },
    { id: "captcha", label: "Robot check complete", ready: captchaReady }
  ];
  return {
    items,
    completed: items.filter((item) => item.ready).length,
    total: items.length,
    ready: items.every((item) => item.ready)
  };
}

function SignupReadinessPanel({ authDraft }) {
  const readiness = getSignupReadiness(authDraft);
  return (
    <div className="signup-readiness-panel" aria-label="Signup readiness">
      <div className="surface-head">
        <p className="card-label">Signup readiness</p>
        <span className={readiness.ready ? "badge subtle" : "badge review"}>{readiness.completed}/{readiness.total} ready</span>
      </div>
      <div className="signup-readiness-list">
        {readiness.items.map((item) => (
          <div key={item.id} className={item.ready ? "signup-readiness-item complete" : "signup-readiness-item"}>
            <span aria-hidden="true">{item.ready ? "Done" : "Needed"}</span>
            <strong>{item.label}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function EntryPage({
  state,
  entryTab,
  setEntryTab,
  authMode,
  setAuthMode,
  authDraft,
  setAuthDraft,
  profileDraft,
  setProfileDraft,
  authError,
  authNotice,
  busy,
  isLockedMode,
  handleSubmit,
  handleProfileSubmit,
  needsOnboarding,
  openProfilePanel,
  completeTutorial
}) {
  const normalized = normalizeProfileDraft(profileDraft);
  const waitlistMode = isWaitlistProfile(state.profile);
  const onboardingOpen = canOpenOnboarding(state.profile);
  const authenticatedOnboarding = Boolean(state.authenticated && onboardingOpen);
  const activeEntryTab = authenticatedOnboarding ? "onboarding" : entryTab;
  const isEntrySignup = state.backendMode === "local" || authMode === "signup";
  const entrySignupReady = !isEntrySignup || getSignupReadiness(authDraft).ready;
  const checklist = [
    {
      label: "Public display name",
      detail: normalized.name ? normalized.name : "Add the name people should see in chats and services. It does not have to be your legal name.",
      complete: Boolean(normalized.name)
    },
    {
      label: "Username",
      detail: normalized.handle ? normalized.handle : "Choose the @handle FoxHub will use across the app.",
      complete: Boolean(normalized.handle)
    },
    {
      label: "City context",
      detail: normalized.city ? normalized.city : "Set the city that anchors circles, discovery, and local utility.",
      complete: Boolean(normalized.city)
    }
  ];

  return (
    <div className="overlay onboarding-overlay" role="dialog" aria-modal="true">
      <div className="entry-shell">
        <section className="entry-story onboarding-story">
          <p className="card-label">Welcome to FoxHub</p>
          <h2>Two quick steps: sign in, then set up your profile.</h2>
          <p className="panel-copy">
            FoxHub keeps chats, people, money, and services tied to one OneID. Invites get you in faster. Without one, we review the account before everything opens.
          </p>
          <div className="onboarding-glance">
            <div className="status-chip">
              <span>Sign in</span>
              <strong>{state.profile.email || "Not signed in"}</strong>
            </div>
            <div className="status-chip">
              <span>OneID</span>
              <strong>{state.profile.oneId || "Created at sign-in"}</strong>
            </div>
            <div className="status-chip">
              <span>Access</span>
              <strong>{getAccessStatusLabel(state.profile)}</strong>
            </div>
          </div>
          <div className="onboarding-checklist">
            {checklist.map((item) => (
              <div key={item.label} className={item.complete ? "onboarding-step complete" : "onboarding-step"}>
                <div className="onboarding-step-top">
                  <strong>{item.label}</strong>
                  <span>{item.complete ? "Ready" : "Needed"}</span>
                </div>
                <p>{item.detail}</p>
              </div>
            ))}
          </div>
          {!state.profile.tutorialCompleted ? (
            <div className="list-stack">
              <div className="entry-lock-note">
                <strong>Tutorial assistant</strong>
                <span>New users should start with three things: finish the profile card, use chats first, then open one service surface.</span>
              </div>
              <div className="inline-actions wrap">
                <button type="button" className="ghost-button small" onClick={openProfilePanel}>
                  Open profile
                </button>
                <button type="button" className="ghost-button small" onClick={() => setEntryTab("onboarding")} disabled={!onboardingOpen}>
                  Continue onboarding
                </button>
                <button type="button" className="ghost-button small" onClick={completeTutorial}>
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <div className="entry-panel onboarding-form">
          <div className="entry-tabs" role="tablist" aria-label="Entry flow">
            {!authenticatedOnboarding ? (
              <button
                type="button"
                role="tab"
                aria-selected={activeEntryTab === "authentication"}
                className={activeEntryTab === "authentication" ? "auth-pill active" : "auth-pill"}
                onClick={() => setEntryTab("authentication")}
              >
                Sign in
              </button>
            ) : null}
            <button
              type="button"
              role="tab"
              aria-selected={activeEntryTab === "onboarding"}
              aria-disabled={!onboardingOpen}
              className={
                onboardingOpen
                  ? activeEntryTab === "onboarding"
                    ? "auth-pill active"
                    : "auth-pill"
                  : "auth-pill locked"
              }
              onClick={() => {
                if (!onboardingOpen) return;
                setEntryTab("onboarding");
              }}
            >
              Profile setup
            </button>
          </div>

          {!onboardingOpen ? (
            <div className="entry-lock-note">
              <strong>{waitlistMode ? "Access is under review." : "Profile setup opens after sign in."}</strong>
              <span>{getAccessGateMessage(state.profile)}</span>
            </div>
          ) : null}

          {activeEntryTab === "authentication" ? (
            <form className="entry-form" onSubmit={handleSubmit}>
              <div className="panel-head">
                <div>
                  <p className="card-label">Sign in</p>
                  <h3>{isLockedMode ? "Mobile sign-in needs the live connection." : state.backendMode === "firebase" ? "Enter FoxHub with OneID." : "Try FoxHub with a sample OneID."}</h3>
                </div>
              </div>
              <p className="panel-copy">
                {isLockedMode ? state.securityLock?.detail || "This mobile app needs the live FoxHub connection before people can sign in." : getEntryDescription(state.backendMode, isLockedMode)}
              </p>
              {isLockedMode ? (
                <div className="security-lock-card">
                  <p className="card-label">Mobile safety lock</p>
                  <p className="panel-copy">
                    The phone app needs the live FoxHub connection before people can use it on iPhone or Android.
                  </p>
                </div>
              ) : state.backendMode === "firebase" ? (
                <div className="auth-toggle">
                  <button
                    type="button"
                    className={authMode === "signup" ? "auth-pill active" : "auth-pill"}
                    onClick={() => {
                      setAuthMode("signup");
                      setAuthError("");
                      setAuthNotice("");
                    }}
                  >
                    Create account
                  </button>
                  <button
                    type="button"
                    className={authMode === "signin" ? "auth-pill active" : "auth-pill"}
                    onClick={() => {
                      setAuthMode("signin");
                      setAuthError("");
                      setAuthNotice("");
                    }}
                  >
                    Sign in
                  </button>
                </div>
              ) : null}
              {state.backendMode === "firebase" ? (
                <>
                  <label>
                    Email
                    <input
                      type="email"
                      autoComplete="email"
                      value={authDraft.email}
                      onChange={(event) => setAuthDraft({ ...authDraft, email: event.target.value })}
                      placeholder="you@example.com"
                    />
                  </label>
                  <label>
                    Password
                    <input
                      type="password"
                      autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                      value={authDraft.password}
                      onChange={(event) => setAuthDraft({ ...authDraft, password: event.target.value })}
                      placeholder="Enter a password"
                    />
                  </label>
                </>
              ) : null}
              {state.backendMode === "local" || authMode === "signup" ? (
                <>
                  <div className="entry-access-panel">
                    <div className="surface-head">
                      <p className="card-label">Access path</p>
                      <span className="badge subtle">Invite or request</span>
                    </div>
                    <div className="entry-access-row">
                      <button
                        type="button"
                        className={authDraft.inviteCode || authDraft.sponsorHandle ? "auth-pill active" : "auth-pill"}
                        onClick={() => setAuthDraft({ ...authDraft, accessPath: "invite" })}
                      >
                        Have an invite
                      </button>
                      <button
                        type="button"
                        className={!authDraft.inviteCode && !authDraft.sponsorHandle ? "auth-pill active" : "auth-pill"}
                        onClick={() => setAuthDraft({ ...authDraft, accessPath: "waitlist", inviteCode: "", sponsorHandle: "" })}
                      >
                        Request access
                      </button>
                    </div>
                    <p className="panel-copy entry-access-copy">
                      Invites and sponsor handles help us welcome trusted people faster. No invite yet? Request access and a manager will email the approval or denial decision.
                    </p>
                    <label>
                      Invite code
                      <input
                        type="text"
                        value={authDraft.inviteCode || ""}
                        onChange={(event) => setAuthDraft({ ...authDraft, inviteCode: event.target.value, accessPath: event.target.value ? "invite" : authDraft.accessPath })}
                        placeholder="FOX-ATL-2026"
                      />
                    </label>
                    <label>
                      Sponsor handle
                      <input
                        type="text"
                        value={authDraft.sponsorHandle || ""}
                        onChange={(event) => setAuthDraft({ ...authDraft, sponsorHandle: event.target.value, accessPath: event.target.value ? "invite" : authDraft.accessPath })}
                        placeholder="@trustedfriend"
                      />
                    </label>
                  </div>
                  <label>
                    Public display name
                    <input
                      type="text"
                      value={authDraft.name}
                      onChange={(event) => setAuthDraft({ ...authDraft, name: event.target.value })}
                      placeholder="Insert public display name"
                    />
                  </label>
                  <label>
                    Username
                    <input
                      type="text"
                      value={authDraft.handle}
                      onChange={(event) => setAuthDraft({ ...authDraft, handle: event.target.value })}
                      placeholder="Insert username"
                    />
                  </label>
                  <label>
                    City
                    <input
                      type="text"
                      value={authDraft.city}
                      onChange={(event) => setAuthDraft({ ...authDraft, city: event.target.value })}
                      placeholder="Insert city"
                    />
                  </label>
                  <label>
                    ZIP code
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      value={authDraft.zipCode || ""}
                      onChange={(event) => setAuthDraft({ ...authDraft, zipCode: event.target.value, postalCode: event.target.value })}
                      placeholder="30303"
                    />
                  </label>
                  <label>
                    Date of birth (18+ only)
                    <input
                      type="date"
                      max={getAdultBirthDateMax()}
                      value={authDraft.birthDate || ""}
                      onChange={(event) => setAuthDraft({ ...authDraft, birthDate: event.target.value })}
                    />
                  </label>
                  <CaptchaGate authDraft={authDraft} setAuthDraft={setAuthDraft} />
                  <SignupReadinessPanel authDraft={authDraft} />
                </>
              ) : null}
              {authNotice ? <p className="success-text">{authNotice}</p> : null}
              {authError ? <p className="error-text">{authError}</p> : null}
              {(() => {
                const hasInvite = Boolean(authDraft.inviteCode || authDraft.sponsorHandle);
                return (
              <button type="submit" className="accent-button wide" disabled={busy || isLockedMode || !entrySignupReady}>
                {busy ? "Working..." : getAuthSubmitLabel(state.backendMode, authMode, hasInvite)}
              </button>
                );
              })()}
            </form>
          ) : (
            <form className="entry-form" onSubmit={handleProfileSubmit}>
              <div className="panel-head">
                <div>
                  <p className="card-label">Onboarding</p>
                  <h3>Complete your FoxHub profile.</h3>
                </div>
              </div>
              <p className="panel-copy">
                These fields become the shared identity layer for conversation context, circles, payments, and mini-app launches.
              </p>
              <label>
                Email
                <input type="email" value={state.profile.email || authDraft.email || ""} disabled />
              </label>
              <label>
                Public display name
                <input
                  type="text"
                  value={profileDraft.name}
                  onChange={(event) => setProfileDraft({ ...profileDraft, name: event.target.value })}
                  placeholder="Insert public display name"
                />
              </label>
              <label>
                Username
                <input
                  type="text"
                  value={profileDraft.handle}
                  onChange={(event) => setProfileDraft({ ...profileDraft, handle: event.target.value })}
                  placeholder="Insert username"
                />
              </label>
              <label>
                City
                <input
                  type="text"
                  value={profileDraft.city}
                  onChange={(event) => setProfileDraft({ ...profileDraft, city: event.target.value })}
                  placeholder="Insert city"
                />
              </label>
              <label>
                ZIP code
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  value={profileDraft.zipCode || profileDraft.postalCode || ""}
                  onChange={(event) => setProfileDraft({ ...profileDraft, zipCode: event.target.value, postalCode: event.target.value })}
                  placeholder="30303"
                />
              </label>
              <label>
                Bio
                <input
                  type="text"
                  value={profileDraft.bio || ""}
                  onChange={(event) => setProfileDraft({ ...profileDraft, bio: event.target.value })}
                  placeholder="Insert short public bio"
                />
              </label>
              <label>
                Occupation
                <input
                  type="text"
                  value={profileDraft.occupation || ""}
                  onChange={(event) => setProfileDraft({ ...profileDraft, occupation: event.target.value })}
                  placeholder="Insert occupation"
                />
              </label>
              <label>
                Demographic
                <input
                  type="text"
                  value={profileDraft.demographic || ""}
                  onChange={(event) => setProfileDraft({ ...profileDraft, demographic: event.target.value })}
                  placeholder="Insert audience or community"
                />
              </label>
              <div className="onboarding-preview">
                <span>Preview</span>
                <strong>{normalized.name || "Your name"}</strong>
                <p>{normalized.handle || "@handle"} · {normalized.city || "City"}</p>
                <p>{normalized.occupation || "Occupation"} · {normalized.demographic || "Demographic"}</p>
              </div>
              {authError ? <p className="error-text">{authError}</p> : null}
              <button type="submit" className="accent-button wide" disabled={busy || !needsOnboarding}>
                Finish setup
              </button>
          </form>
        )}
        </div>
      </div>
    </div>
  );
}

function LandingPage({ openSignIn, openSignUp, openFeedback, openWorkspace, isAuthenticated = false, campaignSource = null }) {
  const landingImages = [
    {
      src: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=900&q=80",
      alt: "Friends gathered around a shared table"
    },
    {
      src: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=80",
      alt: "Neighbors meeting at a local place"
    },
    {
      src: "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=900&q=80",
      alt: "People greeting each other in the community"
    }
  ];

  return (
    <div className="auth-page" aria-live="polite">
      <header className="landing-nav" aria-label="FoxHub landing navigation">
        <button type="button" className="landing-brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <span aria-hidden="true">
            <FoxHeadMark className="fox-head-icon" />
          </span>
          <strong>FoxHub</strong>
        </button>
        <div className="landing-nav-actions">
          <a href="#why-foxhub">Why FoxHub</a>
          <a href="/comparison">Compare</a>
          <button type="button" className="ghost-button small" onClick={isAuthenticated ? openWorkspace : openSignIn}>
            {isAuthenticated ? "Open app" : "Sign in"}
          </button>
          <button type="button" className="accent-button small" onClick={openSignUp}>
            Sign up
          </button>
        </div>
      </header>

      <main className="landing-page">
        <section className="landing-hero">
          <div className="landing-copy">
            <p className="card-label">Early access is open</p>
            <h1>Your private circle for local trust.</h1>
            <p>
              Join FoxHub to share updates, make plans, ask around, find trusted help, and keep your people connected without bouncing between apps.
            </p>
            <p className="landing-privacy-note">
              Built for people who want online community to feel useful, local, and less exposed. FoxHub is designed not to scan private messages or personal images for ad profiles.
            </p>
            {campaignSource ? (
              <div className="landing-campaign-note" aria-label="Campaign source">
                <span>Ad source</span>
                <strong>{campaignSource.source || "Direct"}{campaignSource.campaign ? ` / ${campaignSource.campaign}` : ""}</strong>
              </div>
            ) : null}
            <div className="landing-actions">
              <button type="button" className="accent-button" onClick={openSignUp}>
                Request early access
              </button>
              <button type="button" className="ghost-button" onClick={isAuthenticated ? openWorkspace : openSignIn}>
                {isAuthenticated ? "Open app" : "Sign in"}
              </button>
              <a className="ghost-button" href="/comparison">
                Compare FoxHub
              </a>
              <button type="button" className="ghost-button" onClick={openFeedback}>
                Sign-up help
              </button>
            </div>
            <div className="landing-flow-note" aria-label="Early access flow">
              <strong>How early access works</strong>
              <span>Use an invite for priority review, or request access and wait for a FoxHub manager decision.</span>
            </div>
            <div className="landing-flow-note launch-support-note" aria-label="Launch support">
              <strong>Launch support is open</strong>
              <span>If sign-up stalls, use Sign-up help. FoxHub attaches campaign and device context so support can see where the flow broke.</span>
            </div>
            <div className="landing-proof">
              <div>
                <strong>1</strong>
                <span>home for people, groups, and trusted help</span>
              </div>
              <div>
                <strong>100+</strong>
                <span>ways to ask, share, plan, and help</span>
              </div>
              <div>
                <strong>Invite</strong>
                <span>priority access for trusted members</span>
              </div>
              <div>
                <strong>Local</strong>
                <span>circles, meetups, neighbors, and local finds</span>
              </div>
            </div>
          </div>

          <div className="landing-photo-board" aria-label="FoxHub community previews">
            <img className="landing-photo primary" src={landingImages[0].src} alt={landingImages[0].alt} fetchPriority="high" decoding="async" />
            <img className="landing-photo secondary" src={landingImages[1].src} alt={landingImages[1].alt} loading="lazy" decoding="async" />
            <img className="landing-photo tertiary" src={landingImages[2].src} alt={landingImages[2].alt} loading="lazy" decoding="async" />
            <div className="landing-float-card">
              <span>Why join now</span>
              <strong>Founding members help set the tone for their circles.</strong>
            </div>
          </div>
        </section>

        <section className="landing-band" id="why-foxhub">
          <div className="landing-card">
            <span>Stay close</span>
            <strong>Catch up with friends, groups, neighbors, creators, and local circles in one familiar place.</strong>
          </div>
          <div className="landing-card">
            <span>Ask your circle</span>
            <strong>Need a hand, a recommendation, a ride, a repair, a sitter, or a place to go? Start with people you trust.</strong>
          </div>
          <div className="landing-card">
            <span>Show up together</span>
            <strong>Plan cookouts, meetups, pop-ups, watch parties, fundraisers, and everyday community moments.</strong>
          </div>
          <div className="landing-card">
            <span>Keep it private</span>
            <strong>Private rooms should feel private, with safety checks focused on abuse, fraud, security, and illegal activity.</strong>
          </div>
        </section>

        <section className="landing-band landing-steps" aria-label="How FoxHub opens">
          <div className="landing-card">
            <span>Step 1</span>
            <strong>Create your member profile with your email, username, city, and 18+ check.</strong>
          </div>
          <div className="landing-card">
            <span>Step 2</span>
            <strong>Choose invite access if someone brought you in, or send a request for Management review.</strong>
          </div>
          <div className="landing-card">
            <span>Step 3</span>
            <strong>After approval, sign in with the same email and password to open your FoxHub workspace.</strong>
          </div>
          <div className="landing-card">
            <span>Need help?</span>
            <strong>Use the sign-up help page if an invite, approval, password, or button gets in the way.</strong>
          </div>
        </section>

        <LandingFooter />
      </main>
    </div>
  );
}

function SignupFeedbackPage({
  feedbackDraft,
  setFeedbackDraft,
  feedbackNotice,
  campaignSource,
  handleSubmit,
  openLanding,
  openSignIn,
  openSignUp
}) {
  const feedbackReady = Boolean(String(feedbackDraft.email || "").trim() && String(feedbackDraft.message || "").trim());
  const issueTypes = [
    "Invite code issue",
    "Email already taken",
    "Password trouble",
    "Age verification",
    "Captcha or robot check",
    "Signup readiness will not complete",
    "Waiting on approval",
    "Page or button not working",
    "Ad link or landing page issue",
    "Other sign-up issue"
  ];

  return (
    <div className="auth-page auth-page-centered signup-feedback-page" aria-live="polite">
      <div className="auth-page-panel feedback-page-panel">
        <section className="auth-page-story feedback-story">
          <div className="auth-page-kicker">
            <p className="card-label">Sign-up help</p>
            <span className="badge subtle">Public feedback lane</span>
          </div>
          <h2>Having trouble signing up?</h2>
          <p className="panel-copy">
            Send the details from here so FoxHub can see where new users are getting stuck: invite code, email, approval, password, age check, or a broken button.
          </p>
          <div className="auth-highlight-grid">
            <div className="auth-highlight-card">
              <strong>Use your real email</strong>
              <span>Member accounts should use a current personal email. FoxHub-domain emails stay reserved for staff.</span>
            </div>
            <div className="auth-highlight-card">
              <strong>Invite or review</strong>
              <span>Invite access waits on the inviter. No-invite access goes through Management review.</span>
            </div>
            <div className="auth-highlight-card">
              <strong>18+ only</strong>
              <span>Sign-up requires date-of-birth verification before the account request can continue.</span>
            </div>
          </div>
          <div className="feedback-contact-card">
            <span>Direct support email</span>
            <strong>{SIGNUP_SUPPORT_EMAIL}</strong>
            <p>If your browser does not open an email draft, send the same details to this address.</p>
          </div>
          <div className="feedback-context-card">
            <span>Launch context</span>
            <strong>{campaignSource ? `${campaignSource.source || "direct"}${campaignSource.campaign ? ` / ${campaignSource.campaign}` : ""}` : "Direct or untagged visit"}</strong>
            <p>FoxHub adds the page, campaign, browser, screen size, and time zone to the support draft.</p>
          </div>
          <div className="inline-actions wrap">
            <button type="button" className="ghost-button" onClick={openLanding}>
              Back to FoxHub
            </button>
            <button type="button" className="ghost-button" onClick={openSignIn}>
              Sign in
            </button>
            <button type="button" className="accent-button" onClick={openSignUp}>
              Try sign-up again
            </button>
          </div>
        </section>

        <form className="auth-page-form feedback-form" onSubmit={handleSubmit}>
          <div className="auth-form-head">
            <div>
              <p className="card-label">Report a sign-up issue</p>
              <h3>Tell us what happened.</h3>
            </div>
            <span className="badge subtle">No sign-in needed</span>
          </div>
          <label>
            Email you tried to use
            <input
              type="email"
              autoComplete="email"
              required
              value={feedbackDraft.email}
              onChange={(event) => setFeedbackDraft({ ...feedbackDraft, email: event.target.value })}
              placeholder="you@example.com"
            />
          </label>
          <label>
            Name or public display name
            <input
              type="text"
              value={feedbackDraft.name}
              onChange={(event) => setFeedbackDraft({ ...feedbackDraft, name: event.target.value })}
              placeholder="Insert public display name"
            />
          </label>
          <label>
            What part is giving you trouble?
            <select
              value={feedbackDraft.issueType}
              onChange={(event) => setFeedbackDraft({ ...feedbackDraft, issueType: event.target.value })}
            >
              {issueTypes.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Invite code or sponsor handle
            <input
              type="text"
              value={feedbackDraft.inviteContext}
              onChange={(event) => setFeedbackDraft({ ...feedbackDraft, inviteContext: event.target.value })}
              placeholder="FOX-ATL-2026 or @trustedfriend"
            />
          </label>
          <label>
            What did you see?
            <textarea
              rows={5}
              required
              value={feedbackDraft.message}
              onChange={(event) => setFeedbackDraft({ ...feedbackDraft, message: event.target.value })}
              placeholder="Example: I entered my invite code, then the page said..."
            />
          </label>
          <div className="entry-lock-note">
            <strong>Helpful details</strong>
            <span>Include the button, error text, and what you expected to happen. FoxHub captures the page and device context automatically.</span>
          </div>
          {feedbackNotice ? <p className="success-text">{feedbackNotice}</p> : null}
          <button type="submit" className="accent-button wide" disabled={!feedbackReady}>
            Prepare feedback email
          </button>
        </form>
      </div>
    </div>
  );
}

const foxHubComparisonAdvantages = [
  {
    title: "Rapport-first access",
    detail: "Invites create sponsor responsibility, sponsor approval, 30-day retention incentives, and rapport consequences instead of treating growth as a pure numbers game."
  },
  {
    title: "Single-account merchant gate",
    detail: "Merchant and vendor access stays under one signed-in user account, waits at least 90 days before approval, and supports multiple storefronts under that one merchant account."
  },
  {
    title: "Penalty-based buy/sell accountability",
    detail: "Three active account flags pause buying and selling for 30 days, giving the marketplace a built-in responsibility loop."
  },
  {
    title: "Private-message ad boundary",
    detail: "FoxHub is designed not to scan private messages or personal images for ad profiles."
  },
  {
    title: "Local trust before transactions",
    detail: "Social, rapport, circles, merchant tools, payments, and services are ordered so commerce grows out of trusted relationships."
  },
  {
    title: "Manager review for no-invite applicants",
    detail: "Applicants without invites go to staff review with approval, denial, hold, and email-notice records."
  }
];

const avoidedComparisonFeatures = [
  {
    title: "Engagement-first feeds",
    detail: "FoxHub is not built around maximizing endless scrolling or outrage-heavy discovery before trust is established."
  },
  {
    title: "Broad private-content profiling",
    detail: "FoxHub avoids positioning private messages and personal images as material for ad-profile building."
  },
  {
    title: "Instant merchant churn",
    detail: "FoxHub does not let a fresh account immediately become a fully approved merchant with multiple disconnected seller identities."
  },
  {
    title: "Unowned invite growth",
    detail: "FoxHub avoids invite codes that let new members bypass the responsibility of the person who invited them."
  },
  {
    title: "Feature rewards without rapport",
    detail: "FoxHub restricts favorable goodies and elevated features when rapport drops too low."
  },
  {
    title: "One-size-fits-all public exposure",
    detail: "FoxHub favors contacts-first privacy, staff review, and local relationship context over defaulting every action into a broad public graph."
  }
];

function ComparisonPage({ openLanding, openSignIn, openSignUp, openWorkspace, isAuthenticated = false }) {
  return (
    <div className="auth-page" aria-live="polite">
      <header className="landing-nav" aria-label="FoxHub comparison navigation">
        <button type="button" className="landing-brand" onClick={openLanding}>
          <span aria-hidden="true">
            <FoxHeadMark className="fox-head-icon" />
          </span>
          <strong>FoxHub</strong>
        </button>
        <div className="landing-nav-actions">
          <button type="button" className="ghost-button small" onClick={openLanding}>
            Splash
          </button>
          <button type="button" className="ghost-button small" onClick={isAuthenticated ? openWorkspace : openSignIn}>
            {isAuthenticated ? "Open app" : "Sign in"}
          </button>
          <button type="button" className="accent-button small" onClick={openSignUp}>
            Sign up
          </button>
        </div>
      </header>

      <main className="landing-page">
        <section className="footer-info-page comparison-hero">
          <div className="footer-info-hero">
            <p className="card-label">FoxHub comparison</p>
            <h1>What FoxHub is built to do differently.</h1>
            <strong>Facebook is a social network. WeChat is a mature super-app. FoxHub is being built as a rapport-based trust network.</strong>
            <p>
              This page highlights FoxHub design choices that focus on invite responsibility, local trust, merchant accountability, and privacy boundaries.
            </p>
          </div>
          <aside className="footer-info-card" aria-label="Comparison note">
            <span className="badge subtle">Product position</span>
            <strong>Rapport before reach</strong>
            <p>FoxHub puts relationships, sponsor accountability, and staff review ahead of broad growth mechanics.</p>
          </aside>
        </section>

        <section className="landing-band comparison-grid" aria-label="FoxHub advantages">
          {foxHubComparisonAdvantages.map((item) => (
            <div key={item.title} className="landing-card">
              <span>FoxHub includes</span>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </div>
          ))}
        </section>

        <section className="landing-band comparison-grid" aria-label="Features FoxHub avoids">
          {avoidedComparisonFeatures.map((item) => (
            <div key={item.title} className="landing-card">
              <span>FoxHub avoids</span>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

function LandingFooter() {
  const totalPages = footerBoilerplateGroups.reduce((total, group) => total + group.items.length, 0);

  return (
    <footer className="landing-footer" aria-label="FoxHub splash footer">
      <section className="boilerplate-footnotes" aria-label="Footer links">
        <div className="boilerplate-footnote-head">
          <div>
            <p className="card-label">Footer Links</p>
            <h2>Rules, help, status, and product pages are ready from the first screen.</h2>
            <p className="boilerplate-footnote-copy">
              New visitors can find legal, support, trust, company, product, business, developer, and status paths before signing in.
            </p>
          </div>
          <div className="boilerplate-footer-summary" aria-label="Footer summary">
            <span className="badge subtle">Splash footer</span>
            <strong>{footerBoilerplateGroups.length} sections</strong>
            <span>{totalPages} links</span>
          </div>
        </div>
        <div className="footer-quick-access" aria-label="Quick footer access">
          {footerQuickAccessLinks.map((link) => (
            <a key={link.href} className="footer-quick-link" href={link.href}>
              <strong>{link.label}</strong>
              <span>{link.detail}</span>
            </a>
          ))}
        </div>
        <div className="boilerplate-footnote-row">
          {footerBoilerplateGroups.map((group) => (
            <section key={group.id} className="boilerplate-footnote-item">
              <div className="boilerplate-topline">
                <span className="boilerplate-glyph" aria-hidden="true">{group.glyph}</span>
                <span className="boilerplate-accent">{group.accent}</span>
              </div>
              <div className="boilerplate-head">
                <strong>{group.label}</strong>
                <span>{group.items.length} pages</span>
              </div>
              <p className="boilerplate-copy">{group.summary}</p>
              <div className="boilerplate-meta-row">
                <span>{group.owner}</span>
                <span>{group.status}</span>
              </div>
              <div className="tag-row">
                {group.items.map((item) => (
                  <a key={item} className="template-tag" href={getFooterItemHref(group.id, item)}>
                    {item}
                  </a>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
      <div className="footer-baseline">
        <span>FoxHub</span>
        <span>Built for local trust, payments, mini apps, and community operations.</span>
      </div>
    </footer>
  );
}

function FooterInfoPage({ page, openLanding, openSignIn, openSignUp, isAuthenticated = false, openWorkspace }) {
  const related = page?.relatedItems || [];

  return (
    <div className="auth-page" aria-live="polite">
      <header className="landing-nav" aria-label="FoxHub footer page navigation">
        <button type="button" className="landing-brand" onClick={openLanding}>
          <span aria-hidden="true">
            <FoxHeadMark className="fox-head-icon" />
          </span>
          <strong>FoxHub</strong>
        </button>
        <div className="landing-nav-actions">
          <button type="button" className="ghost-button small" onClick={openLanding}>
            Splash
          </button>
          <button type="button" className="ghost-button small" onClick={isAuthenticated ? openWorkspace : openSignIn}>
            {isAuthenticated ? "Open app" : "Sign in"}
          </button>
          <button type="button" className="accent-button small" onClick={openSignUp}>
            Sign up
          </button>
        </div>
      </header>

      <main className="landing-page">
        <section className="footer-info-page">
          <div className="footer-info-hero">
            <p className="card-label">{page.eyebrow}</p>
            <h1>{page.title}</h1>
            <strong>{page.headline}</strong>
            {page.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <div className="boilerplate-meta-row">
              <span>{page.owner}</span>
              <span>{page.status}</span>
            </div>
          </div>
          <aside className="footer-info-card" aria-label="Page readiness">
            <span className="badge subtle">Footer quick access</span>
            <strong>Latest FoxHub information stays one click away.</strong>
            <p>
              These links prioritize privacy, complaint prevention, staff controls, safety, status, and support.
            </p>
            <div className="footer-quick-stack">
              {footerQuickAccessLinks.slice(0, 6).map((link) => (
                <a key={link.href} className="footer-quick-link compact" href={link.href}>
                  <strong>{link.label}</strong>
                  <span>{link.detail}</span>
                </a>
              ))}
            </div>
          </aside>
        </section>

        <section className="landing-band" aria-label="Related footer pages">
          {(page.actions || related).slice(0, 3).map((item) => (
            <div key={item} className="landing-card">
              <span>{page.group.label}</span>
              <strong>{item}</strong>
            </div>
          ))}
        </section>

        <section className="landing-band" aria-label="Related footer pages">
          {related.slice(0, 3).map((item) => (
            <a key={item} className="landing-card linked-card" href={getFooterItemHref(page.group.id, item)}>
              <span>{page.group.label}</span>
              <strong>{item}</strong>
            </a>
          ))}
        </section>

        <LandingFooter />
      </main>
    </div>
  );
}

function SignInPage({
  state,
  authMode,
  setAuthMode,
  authDraft,
  setAuthDraft,
  authError,
  authNotice,
  busy,
  isLockedMode,
  handleSubmit,
  openLanding,
  openFeedback,
  openManagementSignIn,
  openPasswordRecovery
}) {
  const isSigningUp = authMode === "signup";
  const hasInvite = Boolean(authDraft.inviteCode || authDraft.sponsorHandle);
  const signupReady = !isSigningUp || getSignupReadiness(authDraft).ready;
  const accessHighlights = [
    { label: "One account", detail: "Sign up once, then use the same email and password everywhere." },
    { label: "Invite-aware", detail: "Invite requests go back to the current user who invited you." },
    { label: "Manager review", detail: "No-invite requests stay in the manager approval lane." }
  ];
  const statusTiles = [
    { label: "Runtime", value: state.backendMode === "firebase" ? "Live sync" : state.backendMode === "locked" ? "Locked" : "Preview" },
    { label: "Access", value: state.profile.accessNote || (state.profile.accessState === "waitlist" ? "Review" : "Ready") },
    { label: "Identity", value: state.profile.oneId || "OneID" }
  ];

  return (
    <div className="auth-page auth-page-centered" aria-live="polite">
      <div className="auth-page-panel">
        <section className="auth-page-story">
          <div className="auth-page-kicker">
            <p className="card-label">FoxHub Access</p>
            <span className="badge subtle">{state.backendMode === "firebase" ? "Live account" : "Preview account"}</span>
          </div>
          <h2>{isSigningUp ? "Create the account once, then come back faster." : "Come back to your people, posts, and local signal."}</h2>
          <p className="panel-copy">
            {isSigningUp
              ? "Start with your login, access path, and profile basics. After approval, the same email and password open FoxHub without extra detours."
              : "Sign in with the email and password created during sign-up. FoxHub checks the registered account before access opens."}
          </p>
          <div className="auth-page-cta">
            <strong>{authDraft.email || state.profile.email || "Start with your email"}</strong>
            <span>{isSigningUp ? "Use these credentials again after invite or manager approval." : state.profile.accessNote || "Sign in to reconnect with your people."}</span>
          </div>
          <div className="auth-highlight-grid">
            {accessHighlights.map((item) => (
              <div key={item.label} className="auth-highlight-card">
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
              </div>
            ))}
          </div>
          <div className="auth-status-strip" aria-label="Account status">
            {statusTiles.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
          <div className="auth-database-panel" aria-label="Member database mode">
            <span className="badge subtle">Member database</span>
            <strong>Public sign-up writes to <code>users/{"{uid}"}</code>.</strong>
            <p>
              FoxHub Members are stored separately from employees. This route is for member credentials, member profiles, invite approval, and Management review.
            </p>
          </div>
          <button type="button" className="ghost-button wide" onClick={openFeedback}>
            Trouble signing up?
          </button>
          <button type="button" className="ghost-button wide" onClick={openLanding}>
            Back to FoxHub
          </button>
        </section>

        <form className="auth-page-form" onSubmit={handleSubmit}>
          <div className="auth-form-head">
            <div>
              <p className="card-label">{isSigningUp ? "Create account" : "Secure entry"}</p>
              <h3>{isSigningUp ? "Sign up" : "Sign in"}</h3>
            </div>
            <span className="badge subtle">{isLockedMode ? "Connection needed" : "Ready"}</span>
          </div>
          <div className="auth-toggle" role="tablist" aria-label="Member account mode">
            <button
              type="button"
              role="tab"
              aria-selected={!isSigningUp}
              className={!isSigningUp ? "auth-pill active" : "auth-pill"}
              onClick={() => {
                setAuthMode("signin");
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isSigningUp}
              className={isSigningUp ? "auth-pill active" : "auth-pill"}
              onClick={() => {
                setAuthMode("signup");
              }}
            >
              Sign up
            </button>
          </div>
          <label>
            Email
            <input
              type="email"
              autoComplete={isSigningUp ? "email" : "username"}
              value={authDraft.email}
              onChange={(event) => setAuthDraft({ ...authDraft, email: event.target.value })}
              placeholder="you@example.com"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={isSigningUp ? "new-password" : "current-password"}
              value={authDraft.password}
              onChange={(event) => setAuthDraft({ ...authDraft, password: event.target.value })}
              placeholder={isSigningUp ? "Create a password" : "Enter your password"}
            />
          </label>
          {isSigningUp ? (
            <>
              <div className="entry-access-panel">
                <div className="surface-head">
                  <p className="card-label">Access path</p>
                  <span className="badge subtle">{authDraft.accessPath === "invite" ? "Invite" : "Request"}</span>
                </div>
                <div className="entry-access-row">
                  <button
                    type="button"
                    className={authDraft.accessPath === "invite" ? "auth-pill active" : "auth-pill"}
                    onClick={() => setAuthDraft({ ...authDraft, accessPath: "invite" })}
                  >
                    Have an invite
                  </button>
                  <button
                    type="button"
                    className={authDraft.accessPath === "waitlist" ? "auth-pill active" : "auth-pill"}
                    onClick={() =>
                      setAuthDraft({
                        ...authDraft,
                        accessPath: "waitlist",
                        inviteCode: "",
                        sponsorHandle: ""
                      })
                    }
                  >
                    Request access
                  </button>
                </div>
                {authDraft.accessPath === "invite" ? (
                  <>
                    <label>
                      Invite code
                      <input
                        type="text"
                        value={authDraft.inviteCode || ""}
                        onChange={(event) =>
                          setAuthDraft({
                            ...authDraft,
                            inviteCode: event.target.value,
                            accessPath: "invite"
                          })
                        }
                        placeholder="FOX-ATL-2026"
                      />
                    </label>
                    <label>
                      Sponsor handle
                      <input
                        type="text"
                        value={authDraft.sponsorHandle || ""}
                        onChange={(event) =>
                          setAuthDraft({
                            ...authDraft,
                            sponsorHandle: event.target.value,
                            accessPath: "invite"
                          })
                        }
                        placeholder="@trustedfriend"
                      />
                    </label>
                    <p className="panel-copy entry-access-copy">
                      The current user tied to the invite must approve or deny the new account before access opens.
                    </p>
                  </>
                ) : (
                  <div className="join-waitlist-note">
                    <p className="panel-copy">
                      No invite yet? Send the application to FoxHub Management for approval or denial.
                    </p>
                    <p className="panel-copy" style={{ fontWeight: 700 }}>
                      FoxHub emails the decision after review.
                    </p>
                  </div>
                )}
              </div>
              <div className="auth-profile-grid">
                <label>
                  Public display name
                  <input
                    type="text"
                    autoComplete="name"
                    value={authDraft.name}
                    onChange={(event) => setAuthDraft({ ...authDraft, name: event.target.value })}
                    placeholder="Insert public display name"
                  />
                </label>
                <label>
                    Username
                  <input
                    type="text"
                    value={authDraft.handle}
                    onChange={(event) => setAuthDraft({ ...authDraft, handle: event.target.value })}
                    placeholder="Insert username"
                  />
                </label>
                <label>
                  City
                  <input
                    type="text"
                    autoComplete="address-level2"
                    value={authDraft.city}
                    onChange={(event) => setAuthDraft({ ...authDraft, city: event.target.value })}
                    placeholder="Insert city"
                  />
                </label>
                <label>
                  ZIP code
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    value={authDraft.zipCode || ""}
                    onChange={(event) => setAuthDraft({ ...authDraft, zipCode: event.target.value, postalCode: event.target.value })}
                    placeholder="30303"
                  />
                </label>
                <label>
                  Date of birth (18+ only)
                  <input
                    type="date"
                    max={getAdultBirthDateMax()}
                    value={authDraft.birthDate || ""}
                    onChange={(event) => setAuthDraft({ ...authDraft, birthDate: event.target.value })}
                  />
                </label>
              </div>
              <div className="entry-lock-note">
                <strong>Single sign-on rule</strong>
                <span>After approval, sign in with this exact email and password. There is no alternate member login path.</span>
              </div>
              <CaptchaGate authDraft={authDraft} setAuthDraft={setAuthDraft} />
              <SignupReadinessPanel authDraft={authDraft} />
            </>
          ) : (
            <>
              <div className="auth-recovery-row">
                <span>Use the email and password created during sign-up. Accounts are checked before access opens.</span>
                <button type="button" className="text-link-button" onClick={openPasswordRecovery}>
                  Forgot password?
                </button>
              </div>
              <button type="button" className="management-entry-button" onClick={openManagementSignIn} disabled={busy || isLockedMode}>
                <strong>Management</strong>
                <span>Sign in and open the Management dashboard.</span>
              </button>
            </>
          )}
          {authError ? <p className="error-text">{authError}</p> : null}
          {authNotice ? <p className="success-text">{authNotice}</p> : null}
          <button type="submit" className="accent-button wide" disabled={busy || isLockedMode || !signupReady}>
            {busy ? "Working..." : isSigningUp ? hasInvite ? "Create account with invite" : "Request access" : "Sign in"}
          </button>
          {isSigningUp ? (
            <button type="button" className="text-link-button center-link" onClick={openFeedback}>
              Having difficulties signing up?
            </button>
          ) : null}
          <div className="auth-preview-panel" aria-label="FoxHub preview">
            <div className="auth-preview-topline">
              <strong>After sign-in</strong>
              <span>{state.profile.handle || "@you"}</span>
            </div>
            <div className="auth-preview-message">
              <span>Social</span>
              <strong>{state.threads?.[0]?.name || "Your active thread"}</strong>
              <p>{state.threads?.[0]?.messages?.slice(-1)?.[0]?.text || "Messages, saves, and next actions return here."}</p>
            </div>
            <div className="auth-preview-row">
              <div>
                <span>Moments</span>
                <strong>{state.moments?.length || 0}</strong>
              </div>
              <div>
                <span>Circles</span>
                <strong>{state.circles?.length || 0}</strong>
              </div>
              <div>
                <span>Services</span>
                <strong>{state.services?.length || 0}</strong>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function ManagementSignInPage({ state, authDraft, setAuthDraft, authError, authNotice, busy, isLockedMode, handleSubmit, openSignIn, openLanding, openPasswordRecovery }) {
  const managementTiles = [
    { label: "Applicants", detail: "Approve, prioritize, hold, or reject FoxHub Member applications." },
    { label: "Trust", detail: "Review verification, moderation, member safety, and access records." },
    { label: "Admin", detail: "Open founder, manager, and administrator controls from one dashboard." }
  ];

  return (
    <div className="auth-page auth-page-centered management-access-page" aria-live="polite">
      <div className="auth-page-panel">
        <section className="auth-page-story">
          <div className="auth-page-kicker">
            <p className="card-label">FoxHub Management</p>
            <span className="badge subtle">Managers / founders / admins</span>
          </div>
          <h2>One combined dashboard for FoxHub staff decisions.</h2>
          <p className="panel-copy">
            Sign in with a manager, founder, or administrator account to open member approvals, verification, moderation, billing readiness, and operator controls together.
          </p>
          <div className="auth-highlight-grid">
            {managementTiles.map((item) => (
              <div key={item.label} className="auth-highlight-card">
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
              </div>
            ))}
          </div>
          <div className="auth-status-strip" aria-label="Management scope">
            <div>
              <span>Runtime</span>
              <strong>{state.backendMode === "firebase" ? "Live sync" : state.backendMode === "locked" ? "Locked" : "Preview"}</strong>
            </div>
            <div>
              <span>Default view</span>
              <strong>Management</strong>
            </div>
            <div>
              <span>Access</span>
              <strong>Staff only</strong>
            </div>
          </div>
          <div className="auth-database-panel staff-mode" aria-label="Staff database mode">
            <span className="badge subtle">Staff database</span>
            <strong>Authorized staff records write to <code>staffMembers/{"{uid}"}</code>.</strong>
            <p>
              The employee profile is separate from member users. Operator permissions stay in <code>operatorAccess/{"{uid}"}</code> so staff identity and staff access are not mixed.
            </p>
          </div>
          <button type="button" className="ghost-button wide" onClick={openLanding}>
            Back to FoxHub
          </button>
        </section>

        <form className="auth-page-form" onSubmit={handleSubmit}>
          <div className="auth-form-head">
            <div>
              <p className="card-label">Staff entry</p>
              <h3>Management sign-in</h3>
            </div>
            <span className="badge subtle">{isLockedMode ? "Connection needed" : "Ready"}</span>
          </div>
          <label>
            Staff email
            <input
              type="email"
              autoComplete="email"
              value={authDraft.email}
              onChange={(event) => setAuthDraft({ ...authDraft, email: event.target.value })}
              placeholder="solidartentertainment@gmail.com"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={authDraft.password}
              onChange={(event) => setAuthDraft({ ...authDraft, password: event.target.value })}
              placeholder="Enter your password"
            />
          </label>
          <div className="auth-recovery-row">
            <span>Authorized staff land directly on the combined Management dashboard.</span>
            <button type="button" className="text-link-button" onClick={openPasswordRecovery}>
              Forgot password?
            </button>
          </div>
          {authError ? <p className="error-text">{authError}</p> : null}
          {authNotice ? <p className="success-text">{authNotice}</p> : null}
          <button type="submit" className="accent-button wide" disabled={busy || isLockedMode}>
            {busy ? "Working..." : "Open Management"}
          </button>
          <button type="button" className="ghost-button wide" onClick={openSignIn}>
            Member sign-in
          </button>
        </form>
      </div>
    </div>
  );
}

function PasswordResetPage({
  state,
  passwordResetDraft,
  setPasswordResetDraft,
  passwordResetEmail,
  authError,
  authNotice,
  busy,
  isLockedMode,
  showConfirm,
  handleRequest,
  handleConfirm,
  openSignIn,
  openLanding
}) {
  return (
    <div className="auth-page auth-page-centered" aria-live="polite">
      <div className="auth-page-panel">
        <section className="auth-page-story">
          <div className="auth-page-kicker">
            <p className="card-label">Account recovery</p>
            <span className="badge subtle">{state.backendMode === "firebase" ? "Email validated" : "Live mode required"}</span>
          </div>
          <h2>{showConfirm ? "Create a new FoxHub password." : "Reset your FoxHub password."}</h2>
          <p className="panel-copy">
            {showConfirm
              ? "Your email reset link is verified. Set a new password, then sign in with that password."
              : "FoxHub sends a validation link to the email on the account. Use that link to open the new-password page."}
          </p>
          <div className="auth-highlight-grid">
            <div className="auth-highlight-card">
              <strong>Email check</strong>
              <span>Reset access starts with the email used during sign-up.</span>
            </div>
            <div className="auth-highlight-card">
              <strong>Validation code</strong>
              <span>The emailed link carries the reset code that FoxHub verifies.</span>
            </div>
            <div className="auth-highlight-card">
              <strong>New password</strong>
              <span>After validation, the new password replaces the old one for future login.</span>
            </div>
          </div>
          <button type="button" className="ghost-button wide" onClick={openLanding}>
            Back to FoxHub
          </button>
        </section>

        <form className="auth-page-form" onSubmit={showConfirm ? handleConfirm : handleRequest}>
          <div className="auth-form-head">
            <div>
              <p className="card-label">Password recovery</p>
              <h3>{showConfirm ? "New password" : "Send reset email"}</h3>
            </div>
            <span className="badge subtle">{isLockedMode ? "Connection needed" : "Ready"}</span>
          </div>
          {showConfirm ? (
            <div className="entry-lock-note">
              <strong>{passwordResetEmail || passwordResetDraft.email || "Verified email"}</strong>
              <span>This email was validated by the reset link.</span>
            </div>
          ) : (
            <label>
              Account email
              <input
                type="email"
                autoComplete="email"
                value={passwordResetDraft.email}
                onChange={(event) => setPasswordResetDraft({ ...passwordResetDraft, email: event.target.value })}
                placeholder="you@example.com"
              />
            </label>
          )}
          {showConfirm ? (
            <>
              <label>
                New password
                <input
                  type="password"
                  autoComplete="new-password"
                  value={passwordResetDraft.password}
                  onChange={(event) => setPasswordResetDraft({ ...passwordResetDraft, password: event.target.value })}
                  placeholder="Create a new password"
                />
              </label>
              <label>
                Confirm password
                <input
                  type="password"
                  autoComplete="new-password"
                  value={passwordResetDraft.confirmPassword}
                  onChange={(event) => setPasswordResetDraft({ ...passwordResetDraft, confirmPassword: event.target.value })}
                  placeholder="Re-enter the new password"
                />
              </label>
            </>
          ) : null}
          <div className="auth-recovery-row">
            <span>{showConfirm ? "Use at least 10 characters with upper and lower case letters and a number." : "Security-question recovery can be added later after questions are collected during sign-up."}</span>
          </div>
          {authError ? <p className="error-text">{authError}</p> : null}
          {authNotice ? <p className="success-text">{authNotice}</p> : null}
          <button type="submit" className="accent-button wide" disabled={busy || isLockedMode}>
            {busy ? "Working..." : showConfirm ? "Change password" : "Send reset email"}
          </button>
          <button type="button" className="ghost-button wide" onClick={openSignIn}>
            Return to sign in
          </button>
        </form>
      </div>
    </div>
  );
}

function SignUpPage({
  state,
  authDraft,
  setAuthDraft,
  authError,
  authNotice,
  busy,
  handleSubmit,
  openFeedback,
  closeSignUp
}) {
  const hasInvite = Boolean(authDraft.inviteCode || authDraft.sponsorHandle);
  const signupReady = getSignupReadiness(authDraft).ready;
  return (
    <div className="overlay onboarding-overlay" role="dialog" aria-modal="true">
      <div className="entry-shell">
        <section className="entry-story onboarding-story">
          <p className="card-label">Join the early network</p>
          <h2>Start with your people and build from there.</h2>
          <p className="panel-copy">
            Create your profile, add your city, and tell FoxHub how you found us. Invites move faster, but anyone can request access and help shape the circles forming now.
          </p>
          <div className="onboarding-checklist">
            <div className="onboarding-step complete">
              <div className="onboarding-step-top">
                <strong>Bring your circle</strong>
                <span>People first</span>
              </div>
              <p>Start with conversations, groups, recommendations, plans, and trusted local connections.</p>
            </div>
            <div className="onboarding-step">
              <div className="onboarding-step-top">
                <strong>Get priority</strong>
                <span>Have an invite?</span>
              </div>
              <p>Invite codes and sponsor handles help us open the door faster for trusted members.</p>
            </div>
          </div>
          <div className="signup-helper" aria-live="polite">
            <div className="signup-helper-item">
              <strong>Quick tip</strong>
              <p>Invite codes and sponsor handles help us welcome trusted people faster.</p>
            </div>
            <div className="signup-helper-item">
              <strong>Your local anchor</strong>
              <p>Your public display name, username, and city help place you near the right people and circles.</p>
            </div>
            <div className="signup-helper-item">
              <strong>Friendly rollout</strong>
              <p>If access is not instant, a manager reviews the application and emails the approval or denial decision.</p>
            </div>
          </div>
        </section>

        <form className="entry-panel onboarding-form" onSubmit={handleSubmit}>
          <div className="panel-head">
            <div>
              <p className="card-label">Create account</p>
              <h3>Set up your FoxHub profile.</h3>
            </div>
            <button type="button" className="ghost-button small" onClick={closeSignUp}>
              Close
            </button>
          </div>
          <p className="panel-copy">Add the basics so FoxHub can connect you with the right people, circles, and local moments.</p>
          <div className="entry-lock-note">
            <strong>Credentials</strong>
            <span>Use this same email and password after invite approval or manager review. There is no alternate sign-in path.</span>
          </div>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              value={authDraft.email}
              onChange={(event) => setAuthDraft({ ...authDraft, email: event.target.value })}
              placeholder="you@example.com"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="new-password"
              value={authDraft.password}
              onChange={(event) => setAuthDraft({ ...authDraft, password: event.target.value })}
              placeholder="Create a password"
            />
          </label>
          <div className="entry-access-panel">
            <div className="surface-head">
              <p className="card-label">Access path</p>
              <span className="badge subtle">{authDraft.accessPath === "invite" ? "Invite" : "Request"}</span>
            </div>
            <div className="entry-access-row">
              <button
                type="button"
                className={authDraft.accessPath === "invite" ? "auth-pill active" : "auth-pill"}
                onClick={() =>
                  setAuthDraft({
                    ...authDraft,
                    accessPath: "invite"
                  })
                }
              >
                Have an invite
              </button>
              <button
                type="button"
                className={authDraft.accessPath === "waitlist" ? "auth-pill active" : "auth-pill"}
                onClick={() =>
                  setAuthDraft({
                    ...authDraft,
                    accessPath: "waitlist",
                    inviteCode: "",
                    sponsorHandle: ""
                  })
                }
              >
                Request access
              </button>
            </div>
            {authDraft.accessPath === "invite" ? (
              <>
                <label>
                  Invite code
                  <input
                    type="text"
                    value={authDraft.inviteCode || ""}
                    onChange={(event) =>
                      setAuthDraft({
                        ...authDraft,
                        inviteCode: event.target.value,
                        accessPath: event.target.value ? "invite" : authDraft.accessPath
                      })
                    }
                    placeholder="FOX-ATL-2026"
                  />
                </label>
                <label>
                  Sponsor handle
                  <input
                    type="text"
                    value={authDraft.sponsorHandle || ""}
                    onChange={(event) =>
                      setAuthDraft({
                        ...authDraft,
                        sponsorHandle: event.target.value,
                        accessPath: event.target.value ? "invite" : authDraft.accessPath
                      })
                    }
                    placeholder="@trustedfriend"
                  />
                </label>
                <p className="panel-copy entry-access-copy">
                  Invites and sponsor handles speed access for trusted accounts.
                </p>
              </>
            ) : (
              <div className="join-waitlist-note">
                <p className="panel-copy">
                  No invite yet? Send a request anyway. A FoxHub manager will approve or deny the application.
                </p>
                <p className="panel-copy" style={{ fontWeight: 700 }}>
                  We will email you when a manager makes the decision.
                </p>
              </div>
            )}
          </div>
          <label>
                Public display name
            <input
              type="text"
              value={authDraft.name}
              onChange={(event) => setAuthDraft({ ...authDraft, name: event.target.value })}
                  placeholder="Insert public display name"
            />
          </label>
          <label>
                Username
            <input
              type="text"
              value={authDraft.handle}
              onChange={(event) => setAuthDraft({ ...authDraft, handle: event.target.value })}
              placeholder="Insert username"
            />
          </label>
          <label>
            City
            <input
              type="text"
              value={authDraft.city}
              onChange={(event) => setAuthDraft({ ...authDraft, city: event.target.value })}
              placeholder="Insert city"
            />
          </label>
          <label>
            ZIP code
            <input
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              value={authDraft.zipCode || ""}
              onChange={(event) => setAuthDraft({ ...authDraft, zipCode: event.target.value, postalCode: event.target.value })}
              placeholder="30303"
            />
          </label>
          <label>
            Date of birth (18+ only)
            <input
              type="date"
              max={getAdultBirthDateMax()}
              value={authDraft.birthDate || ""}
              onChange={(event) => setAuthDraft({ ...authDraft, birthDate: event.target.value })}
            />
          </label>
          <p className="panel-copy">
            You must be 18 or older to create a FoxHub account.
          </p>
          <CaptchaGate authDraft={authDraft} setAuthDraft={setAuthDraft} />
          <SignupReadinessPanel authDraft={authDraft} />
          <button type="button" className="ghost-button wide" onClick={openFeedback}>
            Having difficulties signing up?
          </button>
          {authNotice ? <p className="success-text">{authNotice}</p> : null}
          {authError ? <p className="error-text">{authError}</p> : null}
          <button type="submit" className="accent-button wide" disabled={busy || !signupReady}>
            <span className={busy ? "signup-loader" : undefined} aria-hidden={busy ? "false" : "true"} />
            {busy ? "Signing up..." : hasInvite ? "Create account with invite" : "Request access"}
          </button>
        </form>
      </div>
    </div>
  );
}

function App() {
  const SIGN_IN_PATH = "/signin";
  const MANAGEMENT_PATH = "/management";
  const FEEDBACK_PATH = "/feedback";
  const validTabIds = new Set(Object.keys(views));
  const idleTimerRef = useRef(null);
  const idleSigningOutRef = useRef(false);
  const wasAuthenticatedRef = useRef(false);
  const [routePath, setRoutePath] = useState(() => {
    if (typeof window === "undefined") return "/";
    return window.location.pathname || "/";
  });
  const [routeSearch, setRouteSearch] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.location.search || "";
  });
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_THEME_ID;
    const saved = window.localStorage.getItem("foxhub-theme");
    if (THEME_IDS.includes(saved)) return saved;
    return DEFAULT_THEME_ID;
  });
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === "undefined") return "hub";
    const saved = window.sessionStorage.getItem("foxhub-active-tab");
    return saved && validTabIds.has(saved) ? saved : "hub";
  });
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [publicProfileContactId, setPublicProfileContactId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [entryTab, setEntryTab] = useState("authentication");
  const [authMode, setAuthMode] = useState("signin");
  const [authError, setAuthError] = useState("");
  const [showSignUpPage, setShowSignUpPage] = useState(false);
  const [authNotice, setAuthNotice] = useState("");
  const [passwordResetMode, setPasswordResetMode] = useState("signin");
  const [passwordResetDraft, setPasswordResetDraft] = useState({ email: "", password: "", confirmPassword: "" });
  const [passwordResetEmail, setPasswordResetEmail] = useState("");
  const [campaignSource, setCampaignSource] = useState(null);
  const [feedbackNotice, setFeedbackNotice] = useState("");
  const [feedbackDraft, setFeedbackDraft] = useState({
    email: "",
    name: "",
    issueType: "Invite code issue",
    inviteContext: "",
    message: ""
  });
  const [authDraft, setAuthDraft] = useState(() => createDefaultAuthDraft());
  const [profileDraft, setProfileDraft] = useState({
    name: "",
    handle: "",
    city: "",
    zipCode: "",
    postalCode: "",
    bio: "",
    occupation: "",
    demographic: "",
    pronouns: "",
    website: "",
    availability: "",
    interests: "",
    profilePhoto: null,
    profilePhotoUrl: "",
    profilePhotoName: "",
    profilePhotoType: "",
    oneId: "",
    verifiedPerformerSubscribed: false,
    verifiedPerformerStatus: "not_subscribed",
    verifiedPerformerPlan: "$20/month",
    verifiedPerformerSince: ""
  });
  const [inviteDraft, setInviteDraft] = useState({ label: "", note: "" });
  const [profilePhotoBusy, setProfilePhotoBusy] = useState(false);
  const [profilePhotoError, setProfilePhotoError] = useState("");
  const authFailuresRef = useRef([]);
  const {
    state,
    signIn,
    requestPasswordReset,
    verifyPasswordReset,
    confirmPasswordReset,
    signOut,
    updateProfile,
    subscribeVerifiedPerformer,
    cancelVerifiedPerformer,
    selectThread,
    addMessage,
    selectCircle,
    selectMiniApp,
    launchMiniApp,
    addWalletEvent,
    startDirectThread,
    startShakeMatch,
    logFileTransfer,
    openLiveChannel,
    openCommunityChannel,
    createGroupConversation,
    addMoment,
    reactToMoment,
    commentOnMoment,
    respondFriendRequest,
    addFavorite,
    addSavedItem,
    runQrAction,
    recordModerationCase,
    flagCurrentAccountForCommerce,
    addListing,
    saveListingSearch,
    recordListingAlert,
    updateListing,
    resolveLocalListing,
    updateCreatorOrder,
    logDemandSignal,
    rateContactTrust,
    toggleOfficialAccountSubscription,
    publishMediaClip,
    publishStoryBundle,
    placeAuctionBid,
    upsertCart,
    addShopReview,
    moderateRatingRecord,
    uploadDocumentEvidence,
    submitVerificationCase,
    resolveVerificationCase,
    updateComplianceControl,
    reportTrustSafetyIncident,
    runMerchantRiskCheck,
    submitMerchantApplication,
    upsertMerchantInventoryItem,
    updateMerchantStorefrontSettings,
    updateMerchantOnboarding,
    reviewMerchantSettlement,
    updateMerchantPayoutControl,
    updateMerchantLocationStatus,
    openDisputeCase,
    resolveDisputeCase,
    markNotificationRead,
    revokeDeviceSession,
    saveRoutePlan,
    addEndorsement,
    addJobPost,
    registerMiniProgramManifest,
    startCallSession,
    createInvite,
    reviewSponsorInvite,
    applyRapportRetentionBoost,
    registerBrowserNotifications,
    blockUser,
    reviewMemberApplication,
    addFoxHubStaffMember,
    connectApiConnector,
    testApiConnector,
    disconnectApiConnector,
    prepareStripeConnector,
    runUnifiedSearch,
    runUnifiedAction,
    recalculateTrustEngine,
    createEscrowContract,
    releaseEscrowMilestone,
    openEscrowDispute,
    rebuildReputationGraph,
    runSmartMatchmaking,
    runOperatorCopilot,
    setNotificationPolicy,
    buildNotificationDigest,
    createConversionFunnel,
    registerMiniAppRuntime,
    invokeMiniAppRuntimeEvent,
    queueReliableMutation,
    flushReliableQueue,
    trackAnalyticsEvent,
    setFeatureFlag,
    assignExperimentVariant,
    evaluateWalletRisk,
    activateGrowthCategory,
    runGrowthCategory,
    activateAllGrowthCategories,
    activateUxComponent,
    runUxComponent,
    activateProductionComponent,
    runProductionComponent
  } = useFoxHubStore();

  const isLockedMode = state?.backendMode === "locked";
  const postLoginTabKey = "foxhub-post-login-tab";
  const selectedThread = useMemo(
    () => state?.threads.find((thread) => thread.id === state.selectedThreadId) || state?.threads?.[0] || null,
    [state, state?.selectedThreadId, state?.threads]
  );
  const activeCircle = useMemo(
    () => state?.circles.find((circle) => circle.id === state.activeCircleId) || state?.circles?.[0] || null,
    [state, state?.activeCircleId, state?.circles]
  );
  const activeMiniApp = useMemo(
    () => miniApps.find((app) => app.id === state?.activeMiniAppId) || miniApps[0],
    [state?.activeMiniAppId]
  );
  const profileSetupIncomplete = Boolean(validateRequiredProfileFields(state?.profile || {}));
  const needsOnboarding = state?.backendMode === "firebase" && canOpenOnboarding(state?.profile || {}) && profileSetupIncomplete;
  const showSignUpOverlay = showSignUpPage;
  const isSignInRoute = routePath === SIGN_IN_PATH;
  const isManagementRoute = routePath === MANAGEMENT_PATH;
  const isFeedbackRoute = routePath === FEEDBACK_PATH;
  const isComparisonRoute = routePath === "/comparison";
  const canUseManagement = state?.authenticated && hasFoxHubManagementAccess(state?.profile || {});
  const activeStaffTab = STAFF_WORKSPACE_TAB_IDS.has(activeTab) ? activeTab : "staff";
  const effectiveActiveTab = isManagementRoute && canUseManagement ? activeStaffTab : activeTab === "staff" && !canUseManagement ? "hub" : activeTab;
  const currentView = useMemo(() => views[effectiveActiveTab] || views.hub, [effectiveActiveTab]);
  const isExplicitLandingRoute = routePath === "/landing";
  const isLandingRoute = routePath === "/";
  const footerPage = getFooterPageByPath(routePath);
  const isFooterRoute = Boolean(footerPage);
  const showSignInPage = !state?.authenticated && !showSignUpOverlay && isSignInRoute;
  const showManagementSignInPage = !state?.authenticated && !showSignUpOverlay && isManagementRoute;
  const showFeedbackPage = !showSignUpOverlay && isFeedbackRoute;
  const showFooterPage = !showSignUpOverlay && isFooterRoute;
  const showLandingPage = !showSignUpOverlay && !showFooterPage && !showFeedbackPage && !isComparisonRoute && !showManagementSignInPage && (isExplicitLandingRoute || (!state?.authenticated && !isSignInRoute && !isManagementRoute && !isFeedbackRoute));
  const showComparisonPage = !showSignUpOverlay && isComparisonRoute;
  const showEntryOverlay = state?.authenticated && needsOnboarding;
  const resetParams = useMemo(() => new URLSearchParams(routeSearch), [routeSearch]);
  const resetActionCode = resetParams.get("oobCode") || "";
  const resetUrlMode = resetParams.get("mode") || "";
  const showPasswordResetPage = (showSignInPage || showManagementSignInPage) && (passwordResetMode === "request" || passwordResetMode === "confirm" || resetUrlMode === "reset");
  const showPasswordResetConfirm = showPasswordResetPage && Boolean(resetActionCode);
  const accessibleThemeIds = useMemo(
    () => THEME_OPTIONS.filter((item) => canUseTheme(state?.profile || {}, item.id)).map((item) => item.id),
    [state?.profile]
  );

  function navigateRoute(path, options = {}) {
    if (typeof window === "undefined") return;
    if (window.location.pathname === path) {
      setRoutePath(path);
      setRouteSearch(window.location.search || "");
      return;
    }
    if (options.replace) {
      window.history.replaceState(null, "", path);
    } else {
      window.history.pushState(null, "", path);
    }
    setRoutePath(path);
    setRouteSearch("");
  }

  function isOwnerProfile(profile = {}) {
    return hasFoxHubStaffAccess(profile);
  }

  function canAccessManagement(profile = {}) {
    return hasFoxHubManagementAccess(profile);
  }

  function getAuthenticatedRoute(profile = {}) {
    return canAccessManagement(profile) ? MANAGEMENT_PATH : "/";
  }

  function getAuthenticatedTab(profile = {}, postLoginTab = "") {
    const canManage = canAccessManagement(profile);
    if (isManagementRoute || canManage) return "staff";
    if (postLoginTab === "staff") return "hub";
    if (postLoginTab && validTabIds.has(postLoginTab)) return postLoginTab;
    return "hub";
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const safeTab = validTabIds.has(activeTab) ? activeTab : "hub";
    if (safeTab !== activeTab) {
      setActiveTab(safeTab);
      return;
    }
    window.sessionStorage.setItem("foxhub-active-tab", safeTab);
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("foxhub-theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!accessibleThemeIds.includes(theme)) {
      setTheme(DEFAULT_THEME_ID);
    }
  }, [accessibleThemeIds, theme]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleRoute = () => {
      setRoutePath(window.location.pathname || "/");
      setRouteSearch(window.location.search || "");
    };
    window.addEventListener("popstate", handleRoute);
    return () => window.removeEventListener("popstate", handleRoute);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const source = params.get("utm_source") || params.get("source") || "";
    const campaign = params.get("utm_campaign") || params.get("campaign") || "";
    const medium = params.get("utm_medium") || "";
    const term = params.get("utm_term") || "";
    const content = params.get("utm_content") || "";
    const hasCampaign = Boolean(source || campaign || medium || term || content);
    if (!hasCampaign) {
      const saved = window.localStorage.getItem("foxhub-campaign-source");
      if (saved) {
        try {
          setCampaignSource(JSON.parse(saved));
        } catch {
          window.localStorage.removeItem("foxhub-campaign-source");
        }
      }
      return;
    }
    const record = {
      source: source || "direct",
      campaign,
      medium,
      term,
      content,
      capturedAt: new Date().toISOString(),
      landingPath: window.location.pathname || "/"
    };
    window.localStorage.setItem("foxhub-campaign-source", JSON.stringify(record));
    setCampaignSource(record);
  }, [routePath]);

  useEffect(() => {
    if (!showSignInPage || !resetActionCode) return;
    let cancelled = false;
    setPasswordResetMode("confirm");
    setAuthError("");
    setAuthNotice("Validating your password reset link.");
    verifyPasswordReset(resetActionCode)
      .then((result) => {
        if (cancelled) return;
        setPasswordResetEmail(result?.email || "");
        setPasswordResetDraft((current) => ({ ...current, email: result?.email || current.email }));
        setAuthNotice("Reset link verified. Create a new password.");
      })
      .catch((error) => {
        if (cancelled) return;
        setAuthError(error instanceof Error ? error.message : "This password reset link is invalid or expired.");
        setAuthNotice("");
      });
    return () => {
      cancelled = true;
    };
  }, [resetActionCode, showSignInPage]);

  useEffect(() => {
    if (state?.authenticated) {
      setShowSignUpPage(false);
    }
  }, [state?.authenticated]);

  useEffect(() => {
    if (!state?.authenticated) return;
    applyRapportRetentionBoost?.();
  }, [state?.authenticated, state?.invites?.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const wasAuthenticated = wasAuthenticatedRef.current;
    wasAuthenticatedRef.current = !!state?.authenticated;
    if (state?.authenticated) {
      const canManage = canAccessManagement(state.profile || {});
      if (!wasAuthenticated) {
        const postLoginTab = typeof window !== "undefined" ? window.sessionStorage.getItem(postLoginTabKey) : "";
        if (postLoginTab) window.sessionStorage.removeItem(postLoginTabKey);
        const targetTab = getAuthenticatedTab(state.profile || {}, postLoginTab);
        startTransition(() => {
          setActiveTab(targetTab);
        });
      }
      if (!canManage && activeTab === "staff") {
        startTransition(() => {
          setActiveTab("hub");
        });
      }
      if (isManagementRoute && !canManage) {
        navigateRoute("/", { replace: true });
        return;
      }
      if (isManagementRoute && !STAFF_WORKSPACE_TAB_IDS.has(activeTab)) {
        startTransition(() => {
          setActiveTab("staff");
        });
      }
      if (isSignInRoute || isExplicitLandingRoute || isLandingRoute) {
        navigateRoute(getAuthenticatedRoute(state.profile || {}), { replace: true });
      }
      return;
    }
    if (!isExplicitLandingRoute && !isLandingRoute && !isSignInRoute && !isManagementRoute && !isFooterRoute && !isComparisonRoute && !isFeedbackRoute) navigateRoute("/", { replace: true });
  }, [state?.authenticated, state?.profile?.email, state?.profile?.role, activeTab, isExplicitLandingRoute, isLandingRoute, isSignInRoute, isManagementRoute, isFooterRoute, isComparisonRoute, isFeedbackRoute]);

  useEffect(() => {
    if (authMode !== "signup" || authDraft.captchaChallenge?.id) return;
    setAuthDraft((current) => ({ ...current, captchaChallenge: createCaptchaChallenge(), captchaAnswer: "", website: "" }));
  }, [authMode, authDraft.captchaChallenge?.id]);

  useEffect(() => {
    setEntryTab(needsOnboarding ? "onboarding" : "authentication");
  }, [needsOnboarding]);

  useEffect(() => {
    if (typeof window === "undefined" || !showProfilePanel || !state?.authenticated) return;
    const email = state.profile?.email || profileDraft.email || "";
    const storageKey = getProfileDraftStorageKey(email);
    if (!storageKey) return;
    const draftPayload = {
      ...profileDraft,
      email: String(email).trim().toLowerCase(),
      savedAt: new Date().toISOString()
    };
    window.localStorage.setItem(storageKey, JSON.stringify(draftPayload));
  }, [showProfilePanel, state?.authenticated, state?.profile?.email, profileDraft]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const clearIdleTimer = () => {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    };

    if (!state?.authenticated) {
      clearIdleTimer();
      idleSigningOutRef.current = false;
      return clearIdleTimer;
    }

    const scheduleIdleSignOut = () => {
      clearIdleTimer();
      idleTimerRef.current = window.setTimeout(async () => {
        if (idleSigningOutRef.current) return;
        idleSigningOutRef.current = true;
        setBusy(true);
        try {
          await signOut();
          setAuthDraft(createDefaultAuthDraft());
          setAuthError("");
          setAuthMode("signup");
          setShowProfilePanel(false);
          setAuthNotice("Signed out after 10 minutes of inactivity.");
        } finally {
          setBusy(false);
          idleSigningOutRef.current = false;
        }
      }, IDLE_SIGN_OUT_MS);
    };

    const activityEvents = ["pointerdown", "keydown", "mousemove", "scroll", "touchstart"];
    const handleActivity = () => {
      if (!state.authenticated || idleSigningOutRef.current) return;
      scheduleIdleSignOut();
    };

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true });
    });
    scheduleIdleSignOut();

    return () => {
      clearIdleTimer();
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });
    };
  }, [state?.authenticated]);

  function navigateToTab(tabId) {
    const canManage = canAccessManagement(state.profile || {});
    if (canManage && !STAFF_WORKSPACE_TAB_IDS.has(tabId)) {
      if (!isManagementRoute) {
        navigateRoute(MANAGEMENT_PATH, { replace: true });
      }
      startTransition(() => {
        setActiveTab("staff");
      });
      return;
    }
    if (tabId === "staff" && !canAccessManagement(state.profile || {})) {
      if (isManagementRoute) {
        navigateRoute("/", { replace: true });
      }
      startTransition(() => {
        setActiveTab("hub");
      });
      return;
    }
    if (isManagementRoute && !STAFF_WORKSPACE_TAB_IDS.has(tabId)) {
      navigateRoute("/", { replace: true });
    }
    startTransition(() => {
      setActiveTab(tabId);
    });
  }

  function findThreadByName(name = "") {
    return state?.threads?.find((thread) => thread.name === name) || null;
  }

  function findCircleByName(name = "") {
    return state?.circles?.find((circle) => circle.name === name) || null;
  }

  function findMiniAppByName(name = "") {
    return miniApps.find((app) => app.name === name) || null;
  }

  async function openOfficialThread(accountId) {
    const threadId = officialThreadIdForAccount(accountId);
    if (!threadId) return;
    selectThread(threadId);
    navigateToTab("chat");
  }

  async function openContactThread(contactId) {
    await startDirectThread(contactId);
    navigateToTab("chat");
  }

  function openSearchScope(scopeId) {
    if (scopeId === "messages") {
      navigateToTab("chat");
      return;
    }
    if (scopeId === "people" || scopeId === "channels") {
      navigateToTab("circles");
      return;
    }
    navigateToTab("discover");
  }

  async function saveConnectorIntent(connector) {
    if (!connector) return;
    await addSavedItem({
      kind: "connector",
      source: "Tools",
      title: connector.name,
      detail: connector.summary,
      meta: `${connectorStatusLabel(connector.status)} · ${connector.category}`
    });
    navigateToTab("connectors");
  }

  function openConnectorSurface(connector) {
    if (!connector?.surface) {
      navigateToTab("connectors");
      return;
    }
    navigateToTab(connector.surface);
  }

  async function handleConnectConnector(connector) {
    if (!connector?.id) return;
    setBusy(true);
    try {
      await connectApiConnector(connector.id);
    } finally {
      setBusy(false);
    }
  }

  async function handleTestConnector(connector) {
    if (!connector?.id) return;
    setBusy(true);
    try {
      await testApiConnector(connector.id);
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnectConnector(connector) {
    if (!connector?.id) return;
    setBusy(true);
    try {
      await disconnectApiConnector(connector.id);
    } finally {
      setBusy(false);
    }
  }

  async function handlePrepareStripeConnector() {
    setBusy(true);
    try {
      const result = await prepareStripeConnector();
      if (result?.ok) {
        setAuthNotice("Stripe is ready. Connect your Stripe account to activate live billing.");
      } else {
        setAuthNotice(`Stripe prep needs profile fields: ${(result?.missing || []).join(", ")}.`);
      }
    } finally {
      setBusy(false);
    }
  }

  function openSavedItem(item) {
    if (!item) return;
    const sourceThread = findThreadByName(item.source);
    const sourceMiniApp = findMiniAppByName(item.title);

    if (sourceThread) {
      selectThread(sourceThread.id);
    }
    if (sourceMiniApp) {
      selectMiniApp(sourceMiniApp.id);
    }

    if (item.kind === "message") {
      navigateToTab("chat");
      return;
    }
    if (item.kind === "moment") {
      navigateToTab("circles");
      return;
    }
    if (item.kind === "mini-app") {
      navigateToTab("discover");
      return;
    }
    if (item.kind === "merchant-ops") {
      const merchantOps = findMiniAppByName("MerchantOS");
      if (merchantOps) {
        selectMiniApp(merchantOps.id);
      }
      navigateToTab("discover");
      return;
    }
    if (item.kind === "payment" || item.kind === "qr") {
      navigateToTab("wallet");
      return;
    }
    if (item.kind === "connector") {
      navigateToTab("connectors");
      return;
    }
    navigateToTab("hub");
  }

  async function runUtilityCard(cardId) {
    if (cardId === "money") {
      await handleWalletAction("send");
      navigateToTab("wallet");
      return;
    }
    if (cardId === "billpay") {
      await handleWalletAction("utility");
      navigateToTab("wallet");
      return;
    }
    if (cardId === "merchantops") {
      const merchantOps = findMiniAppByName("MerchantOS");
      if (merchantOps) {
        selectMiniApp(merchantOps.id);
      }
      navigateToTab("discover");
      return;
    }
    if (cardId === "scan") {
      await runQrFlow("qr-contact");
      return;
    }
    if (cardId === "card") {
      openProfilePanel();
      return;
    }
    if (cardId === "saved") {
      navigateToTab("hub");
      return;
    }
    navigateToTab("hub");
  }

  function openContinuityItem(item) {
    if (!item) return;
    selectMiniApp(item.appId);
    const linkedThread = findThreadByName(item.fromThread);
    const linkedCircle = findCircleByName(item.fromCircle);
    if (linkedThread) {
      selectThread(linkedThread.id);
    }
    if (linkedCircle) {
      selectCircle(linkedCircle.id);
    }
    navigateToTab("discover");
  }

  if (!state) {
    return (
      <div className="loading-shell">
        <div className="loading-card">
          <p className="eyebrow">FoxHub</p>
          <h2>Getting FoxHub ready</h2>
          <p className="panel-copy">Opening your people, circles, and local updates.</p>
        </div>
      </div>
    );
  }

  async function handleSendMessage(payload) {
    if (!payload) return;
    const normalizedPayload = typeof payload === "string" ? { text: payload } : payload;
    const text = normalizedPayload.text?.trim() || "";
    const attachments = Array.isArray(normalizedPayload.attachments) ? normalizedPayload.attachments : [];
    if (!text && attachments.length === 0) return;
    setBusy(true);
    try {
      await addMessage(state.selectedThreadId, { text, attachments });
    } finally {
      setBusy(false);
    }
  }

  async function handleBlockUser(contactId, reason) {
    const normalizedReason = String(reason || "").trim();
    if (!contactId) return;
    if (!normalizedReason) {
      setAuthError("A reason is required to block this user.");
      return;
    }
    setBusy(true);
    try {
      await blockUser(contactId, normalizedReason);
      setAuthError("");
      setAuthNotice("User blocked and disconnected from your chat.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to block this user.");
    } finally {
      setBusy(false);
    }
  }

  async function createListing(payload) {
    if (!payload) return;
    if (state.commercePolicy?.commerceBlocked) {
      setAuthError(state.commercePolicy.reason || "Buying and selling are paused for this account.");
      navigateToTab("market");
      return;
    }
    if (state.rapportPolicy?.restricted && (payload.featured || payload.verified)) {
      setAuthError(state.rapportPolicy.reason || "Improve rapport before using favorable listing features.");
      navigateToTab("market");
      return;
    }
    const trustTier = getOwnTrustTier(state.profile);
    const evaluation = evaluateListingPost({
      trustTier,
      category: payload.category,
      type: payload.type,
      price: Number(payload.price) || 0,
      featured: Boolean(payload.featured),
      verified: Boolean(payload.verified)
    });
    const listing = {
      id: `listing-${Date.now()}`,
      title: payload.title,
      category: payload.category,
      type: payload.type,
      description: payload.description,
      city: payload.city,
      neighborhood: payload.neighborhood,
      tags: payload.tags || [],
      price: Number(payload.price) || 0,
      currency: payload.currency || "USD",
      contactId: payload.contactId,
      photos: payload.photos || [],
      featured: evaluation.allowFeatured && Boolean(payload.featured),
      verified: evaluation.allowVerified && Boolean(payload.verified),
      status: evaluation.status === "block" ? "blocked" : evaluation.status === "review" ? "review" : "active",
      flags: [],
      postedAt: new Date().toISOString(),
      trustTier
    };
    addListing(listing);

    if (evaluation.status !== "allow") {
      recordModerationCase(
        buildModerationCase({
          actionType: "listing",
          amount: `$${listing.price.toFixed(2)}`,
          state,
          selectedThread,
          evaluation: {
            ...evaluation,
            contact: state.contacts.find((contact) => contact.id === payload.contactId) || null,
            userRecord: state.userRecords.find((record) => record.contactId === payload.contactId) || null
          }
        })
      );
      submitVerificationCase({
        targetId: listing.id,
        targetType: "listing",
        label: `${listing.title} listing review`,
        requestedItems: ["listing details", "seller trust review", "category approval"],
        owner: "Marketplace ops",
        status: "review",
        stage: evaluation.status === "block" ? "policy_check" : "intake"
      });
    }

    (state.savedSearches || []).forEach((search) => {
      if (matchesListingSearch(listing, search)) {
        recordListingAlert(buildListingAlert(search, listing));
      }
    });
  }

  function flagListing(listingId, reason) {
    const listing = state.listings.find((item) => item.id === listingId);
    if (!listing) return;
    updateListing(listingId, {
      status: "flagged",
      flags: [...(listing.flags || []), reason || "Flagged by peer"]
    });
    recordListingAlert({
      id: `alert-${Date.now()}`,
      listingId,
      title: listing.title,
      summary: reason ? `Flagged · ${reason}` : "Flagged by peer",
      timestamp: new Date().toISOString()
    });
    flagCurrentAccountForCommerce(reason || "market flag", state.profile?.handle || "peer");
    submitVerificationCase({
      targetId: listingId,
      targetType: "listing",
      label: `${listing.title} flagged for review`,
      requestedItems: ["peer flag review", "listing policy check"],
      owner: "Marketplace ops",
      status: "review",
      stage: "flag_review"
    });
  }

  async function addContextMessage(text) {
    if (!state?.selectedThreadId || !text) return;
    await addMessage(state.selectedThreadId, text);
  }

  async function handleWalletAction(type) {
    const actions = {
      send: { title: "P2P transfer", amount: "-$24.00", meta: `Sent from ${state.profile.handle}` },
      add: { title: "Wallet top-up", amount: "+$100.00", meta: "Instant debit load" },
      cashout: { title: "Instant cash-out", amount: "-$75.00", meta: "Bank transfer initiated" },
      merchant: { title: "Merchant payment", amount: "-$42.80", meta: "QR merchant checkout" },
      utility: { title: "Utility bill payment", amount: "-$126.40", meta: "Universal Bill Pay · Power Grid" }
    };
    const threadNotes = {
      send: "Payment sent from this thread.",
      add: "Wallet top-up completed in conversation context.",
      cashout: "Cash-out initiated from wallet context.",
      merchant: "Merchant payment completed from this thread.",
      utility: "Utility bill payment scheduled with receipt tracking."
    };
    setBusy(true);
    try {
      if (["send", "merchant"].includes(type) && state.commercePolicy?.commerceBlocked) {
        recordModerationCase(
          buildModerationCase({
            actionType: type,
            amount: actions[type].amount,
            state,
            selectedThread,
            evaluation: {
              status: "block",
              reason: state.commercePolicy.reason || "Buying and selling are paused for this account.",
              risk: "commerce_penalty"
            }
          })
        );
        setAuthError(state.commercePolicy.reason || "Buying and selling are paused for this account.");
        navigateToTab("wallet");
        return;
      }
      const evaluation = evaluateTransactionAction({
        actionType: type,
        amount: actions[type].amount,
        state,
        selectedThread
      });

      if (evaluation.status !== "allow") {
        recordModerationCase(
          buildModerationCase({
            actionType: type,
            amount: actions[type].amount,
            state,
            selectedThread,
            evaluation
          })
        );
        if (type === "merchant") {
          submitVerificationCase({
            targetId: selectedThread?.id || selectedThread?.name || "merchant-payment",
            targetType: "merchant",
            label: "Merchant payment verification follow-up",
            requestedItems: ["merchant verification", "payout approval", "risk review"],
            owner: "Merchant ops",
            status: "review",
            stage: "payment_hold"
          });
        } else if (type === "cashout") {
          submitVerificationCase({
            targetId: state.profile.handle || "cashout",
            targetType: "payout",
            label: "Cash-out verification follow-up",
            requestedItems: ["identity refresh", "bank account confirmation"],
            owner: "Payout ops",
            status: "review",
            stage: "payout_hold"
          });
        }
        setAuthError(
          evaluation.status === "block"
            ? "FoxHub blocked this wallet action and routed it to the moderator layer."
            : "FoxHub held this wallet action for moderator review before any money moved."
        );
        navigateToTab("wallet");
        return;
      }

      await addWalletEvent(actions[type]);
      await addContextMessage(threadNotes[type]);
      await addSavedItem({
        kind: "payment",
        source: selectedThread?.name || "FoxHub",
        title: actions[type].title,
        detail: threadNotes[type],
        meta: actions[type].meta
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleAuth(event) {
    event.preventDefault();
    const effectiveAuthMode = showManagementSignInPage ? "signin" : authMode;
    setAuthError("");
    setAuthNotice("");
    const now = Date.now();
    authFailuresRef.current = authFailuresRef.current.filter((stamp) => now - stamp < AUTH_WINDOW_MS);
    if (authFailuresRef.current.length >= MAX_AUTH_FAILURES) {
      setAuthError("Too many failed attempts. Wait one minute and try again.");
      return;
    }
    if (isLockedMode) {
      setAuthError("This native build only runs in secure Firebase mode. Add the Firebase environment before signing in on iOS or Android.");
      return;
    }
    const needsProfile = effectiveAuthMode === "signup";
    if (!authDraft.email.trim() && state.backendMode === "firebase") {
      setAuthError("Email is required.");
      return;
    }
    const memberSignup = effectiveAuthMode === "signup" && !showManagementSignInPage;
    if (memberSignup && isFoxHubDomainEmail(authDraft.email)) {
      setAuthError("Use your current personal email for a member profile. FoxHub-domain emails are reserved for staff and management accounts.");
      return;
    }
    if (!authDraft.password && (state.backendMode === "firebase" || memberSignup)) {
      setAuthError("Password is required.");
      return;
    }
    if (memberSignup) {
      if (!isStrongSignupPassword(authDraft.password)) {
        setAuthError("Use a stronger password with at least 10 characters, upper and lower case letters, and a number.");
        return;
      }
    }
    const authProfileDraft = normalizeProfileDraft(authDraft);
    const accessModel = effectiveAuthMode === "signup" ? buildAccessModel(authDraft) : {};
    if (effectiveAuthMode === "signup" && authDraft.accessPath === "invite" && !authDraft.inviteCode.trim()) {
      setAuthError("Enter an invite code so the current user can approve or deny the request.");
      return;
    }
    if (needsProfile && validateRequiredProfileFields(authProfileDraft)) {
      setAuthError("Public display name, username, and city are required.");
      return;
    }
    if (effectiveAuthMode === "signup" && !isAtLeast18(authDraft.birthDate)) {
      setAuthError("You must be 18 or older to create a FoxHub account.");
      return;
    }
    if (memberSignup) {
      const captchaError = validateCaptchaProof(authDraft);
      if (captchaError) {
        setAuthDraft((current) => ({ ...current, captchaChallenge: createCaptchaChallenge(), captchaAnswer: "", website: "" }));
        setAuthError(captchaError);
        return;
      }
    }
    setBusy(true);
    try {
      const authState = await signIn({
        ...authDraft,
        ...authProfileDraft,
        ...accessModel,
        email: authDraft.email.trim(),
        password: authDraft.password,
        authMode: effectiveAuthMode
      });
      if (showManagementSignInPage && !canAccessManagement(authState?.profile || {})) {
        await signOut();
        setAuthMode("signin");
        setPasswordResetMode("signin");
        setAuthNotice("");
        setAuthError("Not Permitted.");
        navigateRoute(MANAGEMENT_PATH, { replace: true });
        return;
      }
      if (showSignInPage && effectiveAuthMode === "signin" && canAccessManagement(authState?.profile || {})) {
        await signOut();
        setAuthMode("signin");
        setPasswordResetMode("signin");
        setAuthNotice("");
        setAuthError("Not Permitted.");
        navigateRoute(SIGN_IN_PATH, { replace: true });
        return;
      }
      setActiveTab(getAuthenticatedTab(authState?.profile || {}));
      const nextProfileDraft = normalizeProfileDraft(authState?.profile || authProfileDraft);
      authFailuresRef.current = [];
      setProfileDraft((current) => ({ ...current, ...nextProfileDraft }));
      if (effectiveAuthMode === "signin") {
        if (authState?.authenticated) {
          setAuthNotice("Signed in. Loading your circle.");
          if (isManagementRoute || isSignInRoute || isExplicitLandingRoute || isLandingRoute || isOwnerProfile(authState?.profile || {})) {
            navigateRoute(getAuthenticatedRoute(authState?.profile || {}), { replace: true });
          }
        } else if (isWaitlistProfile(authState?.profile || {})) {
          setAuthNotice(getAccessGateMessage(authState?.profile || {}));
        } else {
          setAuthNotice("Signed in. Finish your FoxHub identity card to open the rest of your circle.");
        }
      } else if (effectiveAuthMode === "signup" && authDraft.accessPath === "invite") {
        setAuthNotice("Account created. The current user who invited you must approve or deny the request before access opens.");
      } else if ((state.backendMode === "local" || effectiveAuthMode === "signup") && accessModel.accessState === "waitlist") {
        setAuthNotice("Application submitted. A FoxHub manager will approve or deny it, then email you the decision.");
      } else if (state.backendMode === "local" || effectiveAuthMode === "signup") {
        setAuthNotice("Account created. Sign in with the same email and password when access opens.");
      }
    } catch (error) {
      authFailuresRef.current = [...authFailuresRef.current, Date.now()];
      setAuthError(error instanceof Error ? error.message : "Unable to authenticate.");
    } finally {
      setBusy(false);
    }
  }

  function handleSignupFeedback(event) {
    event.preventDefault();
    const browserContext =
      typeof window !== "undefined"
        ? {
            pageUrl: window.location.href,
            referrer: document.referrer || "",
            userAgent: window.navigator.userAgent || "",
            viewport: `${window.innerWidth || 0}x${window.innerHeight || 0}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || ""
          }
        : {};
    const record = {
      ...feedbackDraft,
      email: String(feedbackDraft.email || "").trim().toLowerCase(),
      submittedAt: new Date().toISOString(),
      sourcePath: routePath,
      campaignSource,
      browserContext
    };
    if (typeof window !== "undefined") {
      const existing = JSON.parse(window.localStorage.getItem(SIGNUP_FEEDBACK_STORAGE_KEY) || "[]");
      window.localStorage.setItem(SIGNUP_FEEDBACK_STORAGE_KEY, JSON.stringify([record, ...existing].slice(0, 25)));
      const subject = encodeURIComponent(`FoxHub sign-up help: ${record.issueType}`);
      const body = encodeURIComponent(
        [
          `Email: ${record.email || "not provided"}`,
          `Name: ${record.name || "not provided"}`,
          `Issue: ${record.issueType}`,
          `Invite/sponsor: ${record.inviteContext || "not provided"}`,
          `Path: ${record.sourcePath}`,
          `URL: ${record.browserContext.pageUrl || "not captured"}`,
          `Campaign: ${record.campaignSource ? `${record.campaignSource.source || "direct"} / ${record.campaignSource.campaign || "none"} / ${record.campaignSource.medium || "none"}` : "not captured"}`,
          `Referrer: ${record.browserContext.referrer || "not captured"}`,
          `Viewport: ${record.browserContext.viewport || "not captured"}`,
          `Timezone: ${record.browserContext.timezone || "not captured"}`,
          `User agent: ${record.browserContext.userAgent || "not captured"}`,
          "",
          record.message || "No message provided.",
          "",
          `Captured: ${record.submittedAt}`
        ].join("\n")
      );
      window.location.href = `mailto:${SIGNUP_SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    }
    setFeedbackNotice("Feedback saved locally and an email draft was prepared.");
  }

  async function handleEnableNotifications() {
    setAuthError("");
    setAuthNotice("");
    try {
      const permission = await registerBrowserNotifications();
      setAuthNotice(permission === "granted" ? "Browser notifications are enabled." : "Browser notifications were not enabled.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to update browser notifications.");
    }
  }

  const openSignUp = () => {
    navigateRoute(SIGN_IN_PATH);
    setShowSignUpPage(false);
    setAuthMode("signup");
    setPasswordResetMode("signin");
    setAuthError("");
    setAuthNotice("");
  };

  const closeSignUp = () => {
    navigateRoute("/", { replace: true });
    setShowSignUpPage(false);
    setAuthMode("signin");
  };

  const openSignIn = () => {
    navigateRoute(SIGN_IN_PATH);
    setShowSignUpPage(false);
    setAuthMode("signin");
    setPasswordResetMode("signin");
    setAuthError("");
    setAuthNotice("");
  };

  const openFeedback = () => {
    setShowSignUpPage(false);
    setPasswordResetMode("signin");
    setAuthError("");
    setAuthNotice("");
    setFeedbackNotice("");
    setFeedbackDraft((current) => ({
      ...current,
      email: current.email || authDraft.email || "",
      name: current.name || authDraft.name || "",
      inviteContext: current.inviteContext || authDraft.inviteCode || authDraft.sponsorHandle || ""
    }));
    navigateRoute(FEEDBACK_PATH);
  };

  const openPasswordRecovery = () => {
    navigateRoute(isManagementRoute ? MANAGEMENT_PATH : SIGN_IN_PATH);
    setShowSignUpPage(false);
    setAuthMode("signin");
    setPasswordResetMode("request");
    setPasswordResetDraft((current) => ({ ...current, email: authDraft.email || current.email, password: "", confirmPassword: "" }));
    setAuthError("");
    setAuthNotice("");
  };

  const openLanding = () => {
    navigateRoute("/landing");
    setShowSignUpPage(false);
    setAuthMode("signin");
    setPasswordResetMode("signin");
    setAuthError("");
    setAuthNotice("");
  };

  const openWorkspace = () => {
    navigateRoute("/");
    setShowSignUpPage(false);
    setAuthError("");
    setAuthNotice("");
  };

  const openManagementSignIn = () => {
    navigateRoute(MANAGEMENT_PATH);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(postLoginTabKey, "staff");
      window.sessionStorage.setItem("foxhub-active-tab", "staff");
    }
    setAuthMode("signin");
    setPasswordResetMode("signin");
    setAuthError("");
    setAuthNotice("Management sign-in selected. The Management dashboard will open after authentication.");
  };

  async function handlePasswordResetRequest(event) {
    event.preventDefault();
    setAuthError("");
    setAuthNotice("");
    const email = passwordResetDraft.email.trim() || authDraft.email.trim();
    if (!email) {
      setAuthError("Enter the email address on your FoxHub account.");
      return;
    }
    if (isLockedMode) {
      setAuthError("Password reset requires the Firebase-backed live account mode.");
      return;
    }
    setBusy(true);
    try {
      const result = await requestPasswordReset(email);
      setPasswordResetDraft((current) => ({ ...current, email: result?.email || email }));
      setAuthNotice(`Password reset email sent to ${result?.email || email}. Use the link in that email to validate the code and create a new password.`);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to send password reset email.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePasswordResetConfirm(event) {
    event.preventDefault();
    setAuthError("");
    setAuthNotice("");
    if (!resetActionCode) {
      setAuthError("Open the reset link from your email before creating a new password.");
      return;
    }
    if (passwordResetDraft.password !== passwordResetDraft.confirmPassword) {
      setAuthError("The new passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await confirmPasswordReset(resetActionCode, passwordResetDraft.password);
      setPasswordResetMode("signin");
      setPasswordResetDraft({ email: passwordResetEmail || passwordResetDraft.email, password: "", confirmPassword: "" });
      setAuthDraft((current) => ({ ...current, email: passwordResetEmail || passwordResetDraft.email, password: "" }));
      setAuthNotice("Password changed. Sign in with your new password.");
      navigateRoute(SIGN_IN_PATH, { replace: true });
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to change password.");
    } finally {
      setBusy(false);
    }
  }

  function openProfilePanel() {
    const normalized = normalizeProfileDraft(state.profile);
    const storageKey = getProfileDraftStorageKey(normalized.email || state.profile?.email);
    let nextDraft = normalized;
    if (typeof window !== "undefined" && storageKey) {
      try {
        const storedDraft = JSON.parse(window.localStorage.getItem(storageKey) || "null");
        if (storedDraft && storedDraft.email === normalized.email) {
          nextDraft = mergeStoredProfileDraft(normalized, storedDraft);
        }
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    }
    setProfileDraft(nextDraft);
    setInviteDraft({ label: "", note: "" });
    setShowProfilePanel(true);
  }

  function openPublicProfile(contactId) {
    if (!contactId) return;
    setPublicProfileContactId(contactId);
  }

  async function handleProfilePhotoFile(file) {
    if (!file) return;
    setProfilePhotoBusy(true);
    setProfilePhotoError("");
    try {
      const attachment = await prepareImageAttachment(file);
      setProfileDraft((current) => ({
        ...current,
        profilePhoto: attachment,
        profilePhotoUrl: attachment.url,
        profilePhotoName: attachment.name,
        profilePhotoType: attachment.type
      }));
      setAuthNotice("Profile photo staged. Save profile to publish it.");
    } catch (error) {
      setProfilePhotoError(error instanceof Error ? error.message : "Unable to prepare that profile photo.");
    } finally {
      setProfilePhotoBusy(false);
    }
  }

  function handleProfilePhotoDrop(event) {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    void handleProfilePhotoFile(file);
  }

  function removeProfilePhoto() {
    setProfileDraft((current) => ({
      ...current,
      profilePhoto: null,
      profilePhotoUrl: "",
      profilePhotoName: "",
      profilePhotoType: ""
    }));
    setProfilePhotoError("");
    setAuthNotice("Profile photo removed from the draft. Save profile to publish the change.");
  }

  async function saveProfile(event) {
    event.preventDefault();
    const normalizedDraft = normalizeProfileDraft({
      ...profileDraft,
      email: profileDraft.email || state.profile?.email || authDraft.email
    });
    const nextProfile = {
      ...normalizedDraft,
      email: state.profile?.email || normalizedDraft.email || authDraft.email,
      oneId: normalizedDraft.oneId || state.profile?.oneId,
      accessState: state.profile?.accessState || normalizedDraft.accessState,
      accessNote: state.profile?.accessNote || normalizedDraft.accessNote,
      inviteCode: state.profile?.inviteCode || normalizedDraft.inviteCode,
      sponsorHandle: state.profile?.sponsorHandle || normalizedDraft.sponsorHandle,
      waitlistEndsAt: state.profile?.waitlistEndsAt || normalizedDraft.waitlistEndsAt,
      tutorialCompleted: Boolean(state.profile?.tutorialCompleted || normalizedDraft.tutorialCompleted),
      verifiedPerformerSubscribed: Boolean(state.profile?.verifiedPerformerSubscribed ?? normalizedDraft.verifiedPerformerSubscribed),
      verifiedPerformerStatus: state.profile?.verifiedPerformerStatus || normalizedDraft.verifiedPerformerStatus,
      verifiedPerformerPlan: state.profile?.verifiedPerformerPlan || normalizedDraft.verifiedPerformerPlan,
      verifiedPerformerSince: state.profile?.verifiedPerformerSince || normalizedDraft.verifiedPerformerSince,
      profilePhoto: normalizedDraft.profilePhoto,
      profilePhotoUrl: normalizedDraft.profilePhotoUrl,
      profilePhotoName: normalizedDraft.profilePhotoName,
      profilePhotoType: normalizedDraft.profilePhotoType
    };
    const validationError = validateRequiredProfileFields(nextProfile);
    if (validationError) {
      setAuthError(validationError);
      return;
    }

    setBusy(true);
    try {
      await updateProfile(nextProfile);
      if (typeof window !== "undefined") {
        const storageKey = getProfileDraftStorageKey(nextProfile.email);
        if (storageKey) window.localStorage.removeItem(storageKey);
      }
      setShowProfilePanel(false);
      setAuthError("");
      setAuthNotice("Profile saved. Draft backup cleared.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to save your profile.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubscribeVerifiedPerformer() {
    setAuthError("");
    if (state.rapportPolicy?.restricted) {
      setAuthError(state.rapportPolicy.reason || "Improve rapport before accessing favorable goodies.");
      return;
    }
    setBusy(true);
    try {
      await subscribeVerifiedPerformer();
      setProfileDraft((current) => ({
        ...current,
        verifiedPerformerSubscribed: true,
        verifiedPerformerStatus: "active",
        verifiedPerformerPlan: "$20/month",
        verifiedPerformerSince: current.verifiedPerformerSince || new Date().toISOString()
      }));
      setAuthNotice("Verified user subscription is active.");
    } catch (error) {
      setAuthError(error?.message || "Could not start the verified subscription.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelVerifiedPerformer() {
    setBusy(true);
    try {
      await cancelVerifiedPerformer();
      setProfileDraft((current) => ({
        ...current,
        verifiedPerformerSubscribed: false,
        verifiedPerformerStatus: "inactive",
        verifiedPerformerPlan: "$20/month"
      }));
      setAuthNotice("Verified user subscription is inactive.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateInvite() {
    setAuthError("");
    setAuthNotice("");
    setBusy(true);
    try {
      const record = await createInvite(inviteDraft);
      setInviteDraft({ label: "", note: "" });
      setAuthNotice(`Invite ready: ${record.code}`);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to create invite.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSponsorInviteReview(inviteId, decision) {
    setAuthError("");
    setAuthNotice("");
    setBusy(true);
    try {
      const reviewed = await reviewSponsorInvite(inviteId, decision);
      setAuthNotice(reviewed.status === "redeemed" ? "Invite approved. Rapport boost starts after 30 days of retention." : "Invite denied.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to review invite.");
    } finally {
      setBusy(false);
    }
  }

  async function completeTutorial() {
    setBusy(true);
    try {
      const nextProfile = {
        ...normalizeProfileDraft(state.profile),
        tutorialCompleted: true
      };
      await updateProfile(nextProfile);
      setAuthNotice("Tutorial dismissed. You can reopen profile help anytime from your account card.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOut();
      setAuthDraft(createDefaultAuthDraft());
      if (typeof window !== "undefined") {
        const storageKey = getProfileDraftStorageKey(state.profile?.email || authDraft.email);
        if (storageKey) window.localStorage.removeItem(storageKey);
      }
      setProfileDraft({
        name: "",
        handle: "",
        city: "",
        bio: "",
        occupation: "",
        demographic: "",
        oneId: "",
        verifiedPerformerSubscribed: false,
        verifiedPerformerStatus: "not_subscribed",
        verifiedPerformerPlan: "$20/month",
        verifiedPerformerSince: ""
      });
      setAuthError("");
      setAuthNotice("");
      setAuthMode("signup");
      setShowProfilePanel(false);
      navigateRoute(isManagementRoute ? MANAGEMENT_PATH : SIGN_IN_PATH, { replace: true });
    } finally {
      setBusy(false);
    }
  }

  async function submitMoment(text, attachments = []) {
    if ((!text && !attachments.length) || !state.authenticated) return;
    setBusy(true);
    try {
      await addMoment(text, state.profile, attachments);
    } finally {
      setBusy(false);
    }
  }

  async function runService(serviceId) {
    if (serviceId === "scan") {
      navigateToTab("chat");
      await runQrFlow("qr-contact");
      return;
    }

    if (serviceId === "merchant") {
      navigateToTab("chat");
      await handleWalletAction("merchant");
      return;
    }

    if (serviceId === "merchantops") {
      const merchantOps = findMiniAppByName("MerchantOS");
      if (merchantOps) {
        selectMiniApp(merchantOps.id);
        navigateToTab("discover");
        await launchMiniApp(merchantOps);
        await addContextMessage("MerchantOS opened for merchant queue and settlement work.");
      }
      return;
    }

    if (serviceId === "ride") {
      navigateToTab("discover");
      await launchMiniApp({ id: "ridegrid", name: "RideGrid" });
      await addContextMessage("RideGrid launched from this conversation.");
      return;
    }

    if (serviceId === "tickets") {
      navigateToTab("discover");
      await launchMiniApp({ id: "foxtickets", name: "FoxTickets" });
      await addContextMessage("FoxTickets launched from this conversation.");
      return;
    }

    const service = state.services.find((item) => item.id === serviceId);
    if (!service) return;
    const serviceTabByType = {
      Identity: "discover",
      Money: "wallet",
      Market: "market",
      Food: "discover",
      Events: "discover",
      Work: "market",
      Housing: "market",
      Mobility: "discover",
      Business: "discover",
      Community: "circles"
    };
    navigateToTab(service.surface || serviceTabByType[service.type] || "discover");
    await addSavedItem({
      kind: "service",
      source: "Services",
      title: service.name,
      detail: service.blurb,
      meta: service.type
    });
    await addContextMessage(`${service.name} opened from Services.`);
  }

  async function runQrFlow(actionId) {
    const qrBehaviors = {
      "qr-contact": async () => {
        await startDirectThread("isa");
        await runQrAction({ title: "QR contact added", meta: "Opened a verified direct thread from scan flow" });
        await addSavedItem({
          kind: "qr",
          source: "QR scan",
          title: "Contact added from QR",
          detail: "Opened a verified direct thread from scan flow.",
          meta: "Identity action"
        });
      },
      "qr-circle": async () => {
        navigateToTab("circles");
        await runQrAction({ title: "QR circle invite redeemed", meta: `Joined context for ${activeCircle?.name || "active circle"}` });
        await addSavedItem({
          kind: "qr",
          source: "QR scan",
          title: "Circle invite redeemed",
          detail: `Joined context for ${activeCircle?.name || "active circle"}.`,
          meta: "Circle action"
        });
      },
      "qr-pay": async () => {
        const evaluation = evaluateTransactionAction({
          actionType: "qr-pay",
          amount: "-$18.00",
          state,
          selectedThread
        });

        if (evaluation.status !== "allow") {
          recordModerationCase(
            buildModerationCase({
              actionType: "qr-pay",
              amount: "-$18.00",
              state,
              selectedThread,
              evaluation
            })
          );
          setAuthError(
            evaluation.status === "block"
              ? "FoxHub blocked this QR payment and routed it to the moderator layer."
              : "FoxHub held this QR payment for moderator review before any money moved."
          );
          navigateToTab("wallet");
          return;
        }

        navigateToTab("chat");
        await runQrAction({ title: "QR merchant payment", amount: "-$18.00", meta: `Paid from ${selectedThread?.name || "current context"}` });
        await addContextMessage("QR merchant payment completed from this thread.");
      },
      "qr-miniapp": async () => {
        navigateToTab("discover");
        await launchMiniApp(activeMiniApp);
        await runQrAction({ title: `QR mini-app launch`, meta: `Opened ${activeMiniApp.name} from scan context` });
        await addContextMessage(`${activeMiniApp.name} launched from QR context.`);
      }
    };

    const behavior = qrBehaviors[actionId];
    if (behavior) {
      setBusy(true);
      try {
        await behavior();
      } finally {
        setBusy(false);
      }
    }
  }

  async function handleLaunchMiniApp() {
    setBusy(true);
    try {
      await launchMiniApp(activeMiniApp);
      await addContextMessage(`${activeMiniApp.name} launched from this thread.`);
      await addSavedItem({
        kind: "mini-app",
        source: selectedThread?.name || "FoxHub",
        title: `${activeMiniApp.name} launch`,
        detail: activeMiniApp.summary,
        meta: "Opened in conversation context"
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveCurrentContext() {
    setBusy(true);
    try {
      await addSavedItem({
        kind: "message",
        source: selectedThread?.name || "FoxHub",
        title: selectedThread?.name || "Current thread",
        detail: selectedThread?.messages?.[selectedThread.messages.length - 1]?.text || "Saved from FoxHub",
        meta: "Saved from chat"
      });
      await addFavorite({
        type: "thread",
        title: selectedThread?.name || "Current thread",
        detail: selectedThread?.messages?.[selectedThread.messages.length - 1]?.text || "Saved from FoxHub"
      });
    } finally {
      setBusy(false);
    }
  }

  const publicProfileContact = publicProfileContactId
    ? state.contacts.find((contact) => contact.id === publicProfileContactId)
    : null;
  const publicProfileRecord = publicProfileContact
    ? state.userRecords.find((record) => record.contactId === publicProfileContact.id)
    : null;
  const profilePreviewName = profileDraft.name || state.profile?.name || "Your public name";
  const profilePreviewHandle = profileDraft.handle || state.profile?.handle || "@username";
  const profilePreviewCity = profileDraft.city || state.profile?.city || "Your city";
  const profilePreviewPhotoUrl = profileDraft.profilePhoto?.url || profileDraft.profilePhotoUrl || state.profile?.profilePhoto?.url || state.profile?.profilePhotoUrl || "";
  const profileRequiredFields = [profileDraft.name, profileDraft.handle, profileDraft.city];
  const profileOptionalFields = [profileDraft.bio, profileDraft.occupation, profileDraft.demographic, profileDraft.pronouns, profileDraft.website, profileDraft.availability, profileDraft.interests];
  const profileSavedFieldCount = [...profileRequiredFields, ...profileOptionalFields].filter((value) => String(value || "").trim()).length;
  const profileCompletion = Math.round(
    (profileSavedFieldCount / 10) * 100
  );
  const profileEditorStats = [
    { label: "Completion", value: `${profileCompletion}%`, detail: "public card readiness" },
    { label: "Saved fields", value: `${profileSavedFieldCount}/10`, detail: "organized profile details" },
    { label: "Draft backup", value: showProfilePanel ? "On" : "Ready", detail: "retains edits before Save" },
    { label: "Access", value: state.profile?.accessState || "active", detail: state.profile?.accessNote || "account status" },
    { label: "Badge", value: state.profile?.verifiedPerformerSubscribed ? "Active" : "Off", detail: state.profile?.verifiedPerformerPlan || "$20/month" }
  ];

  return (
    <>
      {state?.authenticated && !showLandingPage && !showFooterPage && !showComparisonPage ? (
        <RuntimeErrorBoundary>
          <Suspense
            fallback={
              <div className="loading-shell">
                <div className="loading-card">
                  <p className="eyebrow">FoxHub</p>
                  <h2>Loading app shell</h2>
                  <p className="panel-copy">Opening your people, circles, and local updates.</p>
                </div>
              </div>
            }
          >
            <FoxHubShell
            theme={theme}
            toggleTheme={() => setTheme((current) => {
              const allowedThemes = accessibleThemeIds.length ? accessibleThemeIds : ["light"];
              const index = allowedThemes.indexOf(current);
              return allowedThemes[(index + 1 + allowedThemes.length) % allowedThemes.length] || "light";
            })}
            setTheme={(nextTheme) => {
              if (canUseTheme(state?.profile || {}, nextTheme)) {
                setTheme(nextTheme);
              }
            }}
            activeTab={effectiveActiveTab}
            setActiveTab={navigateToTab}
            state={state}
            currentView={currentView}
            selectedThread={selectedThread}
            activeCircle={activeCircle}
            activeMiniApp={activeMiniApp}
            busy={busy}
            openProfilePanel={openProfilePanel}
            openPublicProfile={openPublicProfile}
            runService={runService}
            selectThread={selectThread}
            handleSendMessage={handleSendMessage}
            startDirectThread={startDirectThread}
            selectCircle={selectCircle}
            handleWalletAction={handleWalletAction}
            blockUser={handleBlockUser}
            selectMiniApp={selectMiniApp}
            submitMoment={submitMoment}
            signOut={handleSignOut}
            handleLaunchMiniApp={handleLaunchMiniApp}
            handleSaveCurrentContext={handleSaveCurrentContext}
            runQrFlow={runQrFlow}
            toggleOfficialAccountSubscription={toggleOfficialAccountSubscription}
            openOfficialThread={openOfficialThread}
            openContactThread={openContactThread}
            openSavedItem={openSavedItem}
            runUtilityCard={runUtilityCard}
            openContinuityItem={openContinuityItem}
            openSearchScope={openSearchScope}
            listings={state.listings}
            savedSearches={state.savedSearches}
            listingAlerts={state.listingAlerts}
            listingCategories={getListingCategories()}
            listingTypes={getListingTypes()}
            listingTags={getListingTags()}
            createListing={createListing}
            flagListing={flagListing}
            saveListingSearch={saveListingSearch}
            rateContactTrust={rateContactTrust}
            saveConnectorIntent={saveConnectorIntent}
            openConnectorSurface={openConnectorSurface}
            connectConnector={handleConnectConnector}
            testConnector={handleTestConnector}
            disconnectConnector={handleDisconnectConnector}
            prepareStripeConnector={handlePrepareStripeConnector}
            reviewMemberApplication={reviewMemberApplication}
            addFoxHubStaffMember={addFoxHubStaffMember}
            runUnifiedSearch={runUnifiedSearch}
            runUnifiedAction={runUnifiedAction}
            recalculateTrustEngine={recalculateTrustEngine}
            createEscrowContract={createEscrowContract}
            releaseEscrowMilestone={releaseEscrowMilestone}
            openEscrowDispute={openEscrowDispute}
            rebuildReputationGraph={rebuildReputationGraph}
            runSmartMatchmaking={runSmartMatchmaking}
            runOperatorCopilot={runOperatorCopilot}
            setNotificationPolicy={setNotificationPolicy}
            buildNotificationDigest={buildNotificationDigest}
            createConversionFunnel={createConversionFunnel}
            registerMiniAppRuntime={registerMiniAppRuntime}
            invokeMiniAppRuntimeEvent={invokeMiniAppRuntimeEvent}
            queueReliableMutation={queueReliableMutation}
            flushReliableQueue={flushReliableQueue}
            trackAnalyticsEvent={trackAnalyticsEvent}
            setFeatureFlag={setFeatureFlag}
            assignExperimentVariant={assignExperimentVariant}
            evaluateWalletRisk={evaluateWalletRisk}
            startShakeMatch={startShakeMatch}
            logFileTransfer={logFileTransfer}
            openLiveChannel={openLiveChannel}
            openCommunityChannel={openCommunityChannel}
            createGroupConversation={createGroupConversation}
            reactToMoment={reactToMoment}
            commentOnMoment={commentOnMoment}
            respondFriendRequest={respondFriendRequest}
            resolveLocalListing={resolveLocalListing}
            updateCreatorOrder={updateCreatorOrder}
            logDemandSignal={logDemandSignal}
            publishMediaClip={publishMediaClip}
            publishStoryBundle={publishStoryBundle}
            placeAuctionBid={placeAuctionBid}
            upsertCart={upsertCart}
            addShopReview={addShopReview}
            moderateRatingRecord={moderateRatingRecord}
            uploadDocumentEvidence={uploadDocumentEvidence}
            submitVerificationCase={submitVerificationCase}
            resolveVerificationCase={resolveVerificationCase}
            updateComplianceControl={updateComplianceControl}
            reportTrustSafetyIncident={reportTrustSafetyIncident}
            runMerchantRiskCheck={runMerchantRiskCheck}
            submitMerchantApplication={submitMerchantApplication}
            upsertMerchantInventoryItem={upsertMerchantInventoryItem}
            updateMerchantStorefrontSettings={updateMerchantStorefrontSettings}
            updateMerchantOnboarding={updateMerchantOnboarding}
            reviewMerchantSettlement={reviewMerchantSettlement}
            updateMerchantPayoutControl={updateMerchantPayoutControl}
            updateMerchantLocationStatus={updateMerchantLocationStatus}
            openDisputeCase={openDisputeCase}
            resolveDisputeCase={resolveDisputeCase}
            markNotificationRead={markNotificationRead}
            revokeDeviceSession={revokeDeviceSession}
            registerBrowserNotifications={registerBrowserNotifications}
            saveRoutePlan={saveRoutePlan}
            addEndorsement={addEndorsement}
            addJobPost={addJobPost}
            registerMiniProgramManifest={registerMiniProgramManifest}
            startCallSession={startCallSession}
            activateGrowthCategory={activateGrowthCategory}
            runGrowthCategory={runGrowthCategory}
            activateAllGrowthCategories={activateAllGrowthCategories}
            activateUxComponent={activateUxComponent}
            runUxComponent={runUxComponent}
            activateProductionComponent={activateProductionComponent}
            runProductionComponent={runProductionComponent}
            updateProfile={updateProfile}
            tutorialAssistant={
              !state.profile?.tutorialCompleted && state.authenticated ? (
                <TutorialAssistant
                  profile={state.profile}
                  currentTab={activeTab}
                  setActiveTab={navigateToTab}
                  openProfilePanel={openProfilePanel}
                  completeTutorial={() => void completeTutorial()}
                />
              ) : null
            }
            />
          </Suspense>
        </RuntimeErrorBoundary>
      ) : null}

      {showLandingPage ? (
        <LandingPage
          openSignIn={openSignIn}
          openSignUp={openSignUp}
          openFeedback={openFeedback}
          openWorkspace={openWorkspace}
          isAuthenticated={!!state?.authenticated}
          campaignSource={campaignSource}
        />
      ) : null}

      {showFeedbackPage ? (
        <SignupFeedbackPage
          feedbackDraft={feedbackDraft}
          setFeedbackDraft={setFeedbackDraft}
          feedbackNotice={feedbackNotice}
          campaignSource={campaignSource}
          handleSubmit={handleSignupFeedback}
          openLanding={openLanding}
          openSignIn={openSignIn}
          openSignUp={openSignUp}
        />
      ) : null}

      {showFooterPage ? (
        <FooterInfoPage
          page={footerPage}
          openLanding={openLanding}
          openSignIn={openSignIn}
          openSignUp={openSignUp}
          openWorkspace={openWorkspace}
          isAuthenticated={!!state?.authenticated}
        />
      ) : null}

      {showComparisonPage ? (
        <ComparisonPage
          openLanding={openLanding}
          openSignIn={openSignIn}
          openSignUp={openSignUp}
          openWorkspace={openWorkspace}
          isAuthenticated={!!state?.authenticated}
        />
      ) : null}

      {showSignInPage && !showPasswordResetPage ? (
        <SignInPage
          state={state}
          authMode={authMode}
          setAuthMode={setAuthMode}
          authDraft={authDraft}
          setAuthDraft={setAuthDraft}
          authError={authError}
          authNotice={authNotice}
          busy={busy}
          isLockedMode={isLockedMode}
          handleSubmit={handleAuth}
          openSignUp={openSignUp}
          openLanding={openLanding}
          openFeedback={openFeedback}
          openManagementSignIn={openManagementSignIn}
          openPasswordRecovery={openPasswordRecovery}
        />
      ) : null}

      {showManagementSignInPage && !showPasswordResetPage ? (
        <ManagementSignInPage
          state={state}
          authDraft={authDraft}
          setAuthDraft={setAuthDraft}
          authError={authError}
          authNotice={authNotice}
          busy={busy}
          isLockedMode={isLockedMode}
          handleSubmit={handleAuth}
          openSignIn={openSignIn}
          openLanding={openLanding}
          openPasswordRecovery={openPasswordRecovery}
        />
      ) : null}

      {showPasswordResetPage ? (
        <PasswordResetPage
          state={state}
          passwordResetDraft={passwordResetDraft}
          setPasswordResetDraft={setPasswordResetDraft}
          passwordResetEmail={passwordResetEmail}
          authError={authError}
          authNotice={authNotice}
          busy={busy}
          isLockedMode={isLockedMode}
          showConfirm={showPasswordResetConfirm}
          handleRequest={handlePasswordResetRequest}
          handleConfirm={handlePasswordResetConfirm}
          openSignIn={isManagementRoute ? openManagementSignIn : openSignIn}
          openLanding={openLanding}
        />
      ) : null}

      {showSignUpOverlay ? (
        <SignUpPage
          state={state}
          authDraft={authDraft}
          setAuthDraft={setAuthDraft}
          authError={authError}
          authNotice={authNotice}
          busy={busy}
          handleSubmit={handleAuth}
          openFeedback={openFeedback}
          closeSignUp={closeSignUp}
        />
      ) : null}

      {showEntryOverlay ? (
        <EntryPage
          state={state}
          entryTab={entryTab}
          setEntryTab={setEntryTab}
          authMode={authMode}
          setAuthMode={setAuthMode}
          authDraft={authDraft}
          setAuthDraft={setAuthDraft}
          profileDraft={profileDraft}
          setProfileDraft={setProfileDraft}
          authError={authError}
          authNotice={authNotice}
          busy={busy}
          isLockedMode={isLockedMode}
          handleSubmit={handleAuth}
          handleProfileSubmit={saveProfile}
          needsOnboarding={needsOnboarding}
          openProfilePanel={openProfilePanel}
          completeTutorial={() => void completeTutorial()}
        />
      ) : null}

      {showProfilePanel ? (
        <div className="overlay profile-overlay" role="dialog" aria-modal="true">
          <form className="profile-modal profile-editor-modal" onSubmit={saveProfile}>
            <div className="panel-head">
              <div>
                <p className="card-label">Profile editor</p>
                <strong>Edit your public OneID card</strong>
              </div>
              <button type="button" className="ghost-button small" onClick={() => setShowProfilePanel(false)}>
                Close
              </button>
            </div>
            {authError ? <p className="error-text">{authError}</p> : null}
            {authNotice ? <p className="panel-copy">{authNotice}</p> : null}

            <section className="profile-editor-hero" aria-label="Profile editor preview">
              <div className="profile-editor-preview-card">
                <div className="profile-editor-cover" aria-hidden="true">
                  <span>{profilePreviewCity}</span>
                </div>
                <div className="profile-editor-preview-body">
                  <div className="profile-editor-avatar" aria-hidden="true">
                    {profilePreviewPhotoUrl ? <img src={profilePreviewPhotoUrl} alt="" /> : profilePreviewName.slice(0, 1)}
                  </div>
                  <div>
                    <p className="card-label">Live public preview</p>
                    <h3>{profilePreviewName}</h3>
                    <p>{profilePreviewHandle} · {profilePreviewCity}</p>
                    <div className="inline-actions wrap">
                      <span className="badge subtle">{profileDraft.occupation || "Add occupation"}</span>
                      <span className="badge subtle">{profileDraft.demographic || "Add audience"}</span>
                      <span className="badge subtle">{profileDraft.availability || "Add availability"}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="profile-editor-status-grid">
                {profileEditorStats.map((item) => (
                  <div key={item.label} className="profile-editor-status-card">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                    <p>{item.detail}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="profile-editor-section">
              <div className="profile-editor-section-head">
                <div>
                  <p className="card-label">Public identity</p>
                  <h3>What other members see first</h3>
                </div>
                <span className="badge subtle">Public</span>
              </div>
              <div className="profile-editor-field-grid">
                <div className="profile-photo-editor">
                  <div className="profile-photo-copy">
                    <strong>Profile photo</strong>
                    <span>JPG, PNG, GIF, SVG vector images. Profile photo saved with your public OneID card.</span>
                  </div>
                  <label
                    className="profile-photo-dropzone"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={handleProfilePhotoDrop}
                  >
                    <input
                      type="file"
                      accept={IMAGE_UPLOAD_ACCEPT}
                      onChange={(event) => void handleProfilePhotoFile(event.target.files?.[0])}
                    />
                    <span>{profilePhotoBusy ? "Optimizing profile photo..." : profilePreviewPhotoUrl ? "Replace profile photo" : "Add profile photo"}</span>
                  </label>
                  <div className="inline-actions wrap">
                    {profileDraft.profilePhotoName || profileDraft.profilePhoto?.name ? <span className="badge subtle">{profileDraft.profilePhotoName || profileDraft.profilePhoto?.name}</span> : null}
                    {profilePreviewPhotoUrl ? (
                      <button type="button" className="ghost-button small" onClick={removeProfilePhoto}>
                        Remove profile photo
                      </button>
                    ) : null}
                  </div>
                  {profilePhotoError ? <p className="error-text">{profilePhotoError}</p> : null}
                </div>
                <label>
                  Public display name
                  <input
                    type="text"
                    value={profileDraft.name}
                    onChange={(event) => setProfileDraft({ ...profileDraft, name: event.target.value })}
                    placeholder="Insert public display name"
                  />
                </label>
                <label>
                  Username
                  <input
                    type="text"
                    value={profileDraft.handle}
                    onChange={(event) => setProfileDraft({ ...profileDraft, handle: event.target.value })}
                    placeholder="Insert username"
                  />
                </label>
                <label>
                  City
                  <input
                    type="text"
                    value={profileDraft.city}
                    onChange={(event) => setProfileDraft({ ...profileDraft, city: event.target.value })}
                    placeholder="Insert city"
                  />
                </label>
                <label>
                  ZIP code
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    value={profileDraft.zipCode || profileDraft.postalCode || ""}
                    onChange={(event) => setProfileDraft({ ...profileDraft, zipCode: event.target.value, postalCode: event.target.value })}
                    placeholder="30303"
                  />
                </label>
              </div>
              <label>
                Bio
                <textarea
                  value={profileDraft.bio || ""}
                  onChange={(event) => setProfileDraft({ ...profileDraft, bio: event.target.value })}
                  placeholder="Insert short public bio"
                  rows={3}
                />
              </label>
            </section>

            <section className="profile-editor-section">
              <div className="profile-editor-section-head">
                <div>
                  <p className="card-label">Role and community</p>
                  <h3>How FoxHub should place you</h3>
                </div>
                <span className="badge subtle">Context</span>
              </div>
              <div className="profile-editor-field-grid two">
                <label>
                  Occupation
                  <input
                    type="text"
                    value={profileDraft.occupation || ""}
                    onChange={(event) => setProfileDraft({ ...profileDraft, occupation: event.target.value })}
                    placeholder="Insert occupation"
                  />
                </label>
                <label>
                  Demographic
                  <input
                    type="text"
                    value={profileDraft.demographic || ""}
                    onChange={(event) => setProfileDraft({ ...profileDraft, demographic: event.target.value })}
                    placeholder="Insert audience or community"
                  />
                </label>
                <label>
                  Pronouns
                  <input
                    type="text"
                    value={profileDraft.pronouns || ""}
                    onChange={(event) => setProfileDraft({ ...profileDraft, pronouns: event.target.value })}
                    placeholder="Insert pronouns, if you want"
                  />
                </label>
                <label>
                  Website or link
                  <input
                    type="text"
                    value={profileDraft.website || ""}
                    onChange={(event) => setProfileDraft({ ...profileDraft, website: event.target.value })}
                    placeholder="Insert website or profile link"
                  />
                </label>
                <label>
                  Availability
                  <input
                    type="text"
                    value={profileDraft.availability || ""}
                    onChange={(event) => setProfileDraft({ ...profileDraft, availability: event.target.value })}
                    placeholder="Insert availability"
                  />
                </label>
              </div>
              <label>
                Interests and strengths
                <textarea
                  value={profileDraft.interests || ""}
                  onChange={(event) => setProfileDraft({ ...profileDraft, interests: event.target.value })}
                  placeholder="Insert interests and strengths"
                  rows={3}
                />
              </label>
            </section>

            <section className="profile-editor-section profile-editor-account-grid">
              <div className="entry-lock-note">
                <strong>Account email</strong>
                <span>{state.profile.email || profileDraft.email || authDraft.email || "No email on file"}</span>
              </div>
              <div className="entry-lock-note">
                <strong>OneID</strong>
                <span>{state.profile.oneId || profileDraft.oneId || "Created from your account when you sign in."}</span>
              </div>
              <div className="entry-lock-note">
                <strong>Profile memory</strong>
                <span>{profileSavedFieldCount}/10 profile fields organized. Draft backup stays local until the profile is saved.</span>
              </div>
              <div className="entry-lock-note">
                <strong>{state.profile.accessNote || "Access status"}</strong>
                <span>
                  {state.profile.accessState === "waitlist"
                    ? state.profile.waitlistEndsAt
                      ? `This profile is waiting for monthly verification review until ${new Date(state.profile.waitlistEndsAt).toLocaleString()}.`
                      : "This profile is still waiting for monthly verification review."
                    : state.profile.sponsorHandle || state.profile.inviteCode
                      ? `Priority access came through ${state.profile.sponsorHandle || state.profile.inviteCode}.`
                      : "This account is using the standard active access path."}
                </span>
              </div>
              <div className="entry-lock-note">
                <strong>Browser notifications</strong>
                <span>Enable browser alerts for verification, wallet, and operator activity without opening the app first.</span>
                <button type="button" className="ghost-button small" disabled={busy || !state.authenticated} onClick={() => void handleEnableNotifications()}>
                  Enable
                </button>
              </div>
            </section>

            <section className="profile-editor-section">
              <div className="profile-editor-section-head">
                <div>
                  <p className="card-label">Verified badge</p>
                  <h3>Public trust badge plan</h3>
                  <p>
                    {state.profile?.verifiedPerformerSubscribed
                      ? `Active since ${state.profile.verifiedPerformerSince ? new Date(state.profile.verifiedPerformerSince).toLocaleDateString() : "now"}.`
                      : "Subscribe to show a verified user badge across trust surfaces. Billing routes through Stripe Connect."}
                  </p>
                </div>
                <span className="badge subtle">{state.profile?.verifiedPerformerSubscribed ? "Active" : "$20/month"}</span>
              </div>
              <div className="inline-actions wrap">
                <button
                  type="button"
                  className="ghost-button"
                  disabled={busy || state.profile?.verifiedPerformerSubscribed}
                  onClick={() => void handleSubscribeVerifiedPerformer()}
                >
                  Subscribe
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={busy || !state.profile?.verifiedPerformerSubscribed}
                  onClick={() => void handleCancelVerifiedPerformer()}
                >
                  Cancel
                </button>
              </div>
            </section>

            <section className="profile-editor-section">
              <div className="profile-editor-section-head">
                <div>
                  <p className="card-label">Invite tools</p>
                  <h3>Create access codes from your profile</h3>
                </div>
                <span className="badge subtle">{(state.invites || []).length} invites</span>
              </div>
              <div className="profile-editor-field-grid two">
                <label>
                  Invite label
                  <input
                    type="text"
                    value={inviteDraft.label}
                    onChange={(event) => setInviteDraft({ ...inviteDraft, label: event.target.value })}
                    placeholder="Insert invite label"
                  />
                </label>
                <label>
                  Invite note
                  <input
                    type="text"
                    value={inviteDraft.note}
                    onChange={(event) => setInviteDraft({ ...inviteDraft, note: event.target.value })}
                    placeholder="Optional note for the recipient"
                  />
                </label>
              </div>
              <button type="button" className="ghost-button wide" disabled={busy || !state.authenticated} onClick={() => void handleCreateInvite()}>
                Create invite code
              </button>
              <div className="list-stack">
                {(state.invites || []).slice(0, 6).map((invite) => (
                  <div key={invite.id} className="list-row">
                    <div>
                      <strong>{invite.code}</strong>
                      <p>{invite.label || "Profile invite"}{invite.note ? ` · ${invite.note}` : ""} · {getInviteExpiryLabel(invite)}</p>
                      {invite.status === "sponsor_pending" ? (
                        <p className="row-meta-text">Sponsor approval needed for {invite.applicantName || invite.applicantEmail || "new member"}</p>
                      ) : null}
                    </div>
                    <div className="inline-actions wrap">
                      <span className="row-meta-text">{invite.status}</span>
                      {invite.status === "sponsor_pending" ? (
                        <>
                          <button type="button" className="ghost-button small" disabled={busy} onClick={() => void handleSponsorInviteReview(invite.id, "approve")}>
                            Approve
                          </button>
                          <button type="button" className="danger-button small" disabled={busy} onClick={() => void handleSponsorInviteReview(invite.id, "deny")}>
                            Deny
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="profile-editor-savebar">
              <div>
                <strong>{profilePreviewName}</strong>
                <p>{profilePreviewHandle} · {profileCompletion}% complete</p>
              </div>
              <button type="submit" className="accent-button" disabled={busy}>
                Save profile
              </button>
            </div>
          </form>
        </div>
      ) : null}
      {publicProfileContact ? (
        <PublicProfileModal
          contact={publicProfileContact}
          record={publicProfileRecord}
          onClose={() => setPublicProfileContactId(null)}
          onMessage={() => {
            void startDirectThread(publicProfileContact.id);
            setPublicProfileContactId(null);
          }}
          onOpenRapport={() => {
            navigateToTab("circles");
            setPublicProfileContactId(null);
          }}
        />
      ) : null}
    </>
  );
}

function PublicProfileModal({ contact, record, onClose, onMessage, onOpenRapport }) {
  const publicTags = Array.isArray(contact.tags) ? contact.tags.slice(0, 6) : [];
  const displayName = contact.displayName || contact.name || "FoxHub member";
  const publicProfilePhotoUrl = contact.profilePhoto?.url || contact.profilePhotoUrl || record?.profile?.profilePhoto?.url || record?.profile?.profilePhotoUrl || "";
  const trustLabel = contact.trustTier || contact.trust || "member";
  const publicSummary = contact.preferredSurface || contact.status || record?.notes || "This member has not added a public bio yet.";
  const publicActivity = [
    { label: "Presence", value: contact.lastActiveLabel || contact.presenceState || "Away" },
    { label: "Known through", value: contact.referralSource || "Direct relationship" },
    { label: "Best surface", value: contact.preferredSurface || "Rapport" },
    { label: "Public stage", value: contact.customerStage || contact.tier || record?.stage || "Active member" }
  ];
  const trustSignals = [
    { label: "Verification", value: contact.verificationLevel || record?.identityState || "Not published" },
    { label: "Wallet state", value: contact.walletState || record?.walletState || "Not published" },
    { label: "Support lane", value: contact.supportTier || record?.supportTier || "Standard" }
  ];
  const profileHighlights = [
    { label: "Public role", value: contact.tier || contact.status || contact.accountType || "Member" },
    { label: "City lane", value: `${contact.city || "FoxHub"}${contact.region ? `, ${contact.region}` : ""}` },
    { label: "Preferred lane", value: contact.preferredSurface || "Rapport" }
  ];
  const activityTimeline = [
    { title: "Joined FoxHub", detail: contact.joinDate || record?.profile?.joinDate || "Saved profile" },
    { title: "Trust reviewed", detail: contact.verificationLevel || record?.identityState || "Community trust pending" },
    { title: "Last visible signal", detail: contact.lastActiveLabel || contact.lastTransaction || "No public activity yet" }
  ];

  return (
    <div className="overlay profile-overlay" role="dialog" aria-modal="true">
      <article className="profile-modal public-profile-modal">
        <div className="panel-head">
          <p className="card-label">Public profile</p>
          <button type="button" className="ghost-button small" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="public-profile-showcase">
          <div className="public-profile-cover" aria-hidden="true">
            <span>{contact.city || "FoxHub"}</span>
          </div>
          <div className="public-profile-hero">
            <div className="public-profile-avatar" aria-hidden="true">
              {publicProfilePhotoUrl ? <img src={publicProfilePhotoUrl} alt="" /> : displayName.slice(0, 1)}
            </div>
            <div className="public-profile-identity">
              <p className="card-label">Member profile</p>
              <h3>{displayName}</h3>
              <p>{contact.handle} · {contact.city}{contact.region ? `, ${contact.region}` : ""}</p>
              <div className="inline-actions wrap">
                <span className="badge subtle">{contact.accountType || contact.status || "member"}</span>
                <span className="badge subtle">Trust {trustLabel}</span>
                <span className="badge subtle">{contact.presenceState || "away"}</span>
              </div>
            </div>
            <div className="public-profile-trust-meter" aria-label={`Trust tier ${trustLabel}`}>
              <span>Trust lane</span>
              <strong>{trustLabel}</strong>
              <div className="public-profile-meter-bar">
                <i style={{ width: `${Math.min(Math.max(Number(contact.relationshipScore || 0), 18), 100)}%` }} />
              </div>
              <p>{contact.relationshipScore || 0} rapport score</p>
            </div>
          </div>
        </div>

        <div className="public-profile-command-row">
          <div className="public-profile-grid">
            <div className="public-profile-stat">
              <span>Peer rating</span>
              <strong>{typeof contact.peerRatingAverage === "number" ? contact.peerRatingAverage.toFixed(1) : "N/A"}</strong>
              <p>{contact.peerRatingCount || 0} ratings</p>
            </div>
            <div className="public-profile-stat">
              <span>Rapport</span>
              <strong>{contact.relationshipScore || 0}</strong>
              <p>{contact.referralSource || "direct relationship"}</p>
            </div>
            <div className="public-profile-stat">
              <span>Joined</span>
              <strong>{contact.joinDate || record?.profile?.joinDate || "Saved"}</strong>
              <p>{contact.supportTier || record?.supportTier || "standard"}</p>
            </div>
          </div>
          <div className="public-profile-action-panel">
            <button type="button" className="accent-button" onClick={onMessage}>
              Message
            </button>
            <button type="button" className="ghost-button" onClick={onOpenRapport}>
              Open in Rapport
            </button>
          </div>
        </div>

        <section className="public-profile-section public-profile-about">
          <div>
            <p className="card-label">About</p>
            <h4>{contact.tier || contact.status || contact.accountType || "FoxHub member"}</h4>
            <p>{publicSummary}</p>
          </div>
          <div className="public-profile-highlight-grid">
            {profileHighlights.map((item) => (
              <div key={item.label} className="public-profile-highlight">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="public-profile-section">
          <div>
            <p className="card-label">Trust and safety</p>
            <h4>Public trust signals</h4>
          </div>
          <div className="public-profile-signal-list">
            {trustSignals.map((signal) => (
              <div key={signal.label} className="public-profile-signal">
                <span>{signal.label}</span>
                <strong>{signal.value}</strong>
              </div>
            ))}
          </div>
        </section>
        {publicTags.length ? (
          <section className="public-profile-section">
            <div>
              <p className="card-label">Public strengths</p>
              <h4>What this profile is known for</h4>
            </div>
            <div className="public-profile-tags" aria-label="Public profile tags">
              {publicTags.map((tag) => (
                <span key={tag} className="badge subtle">{tag}</span>
              ))}
            </div>
          </section>
        ) : null}
        <section className="public-profile-section">
          <div>
            <p className="card-label">Public activity</p>
            <h4>Relationship context</h4>
          </div>
          <div className="public-profile-activity-grid">
            {publicActivity.map((item) => (
              <div key={item.label} className="public-profile-activity">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="public-profile-section">
          <div>
            <p className="card-label">Timeline</p>
            <h4>Public milestones</h4>
          </div>
          <div className="public-profile-timeline">
            {activityTimeline.map((item) => (
              <div key={item.title} className="public-profile-timeline-item">
                <span aria-hidden="true" />
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </article>
    </div>
  );
}

export default App;
