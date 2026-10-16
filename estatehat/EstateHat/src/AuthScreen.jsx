import React, { useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  updateProfile,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from "firebase/auth";
import { auth } from "./firebase.js";
import { defaultProfile, ensureUserProfile, saveUserProfile } from "./backend.js";
import { getAuthBrandingTemplate } from "./authBranding.js";
import EstateHatPublicFooter from "./EstateHatPublicFooter.jsx";
import { SimpleImageBand } from "./EstateHatImagery.jsx";

const S = {
  bg: "#f4fff6",
  panel: "rgba(255, 255, 247, 0.9)",
  dark: "#123429",
  ink: "#123429",
  muted: "#53685f",
  gold: "#f4b740",
  goldDeep: "#0f6b4f",
  accent: "#1f9d6b",
  accentSoft: "rgba(31, 157, 107, 0.12)",
  border: "rgba(27, 111, 82, 0.22)",
  danger: "#c1423a",
  dangerBg: "rgba(193,66,58,0.14)",
  notice: "#0f6b4f",
  noticeBg: "rgba(31,157,107,0.12)",
  font: "'Plus Jakarta Sans', sans-serif",
  serif: "'Newsreader', Georgia, serif",
  input: {
    width: "100%",
    padding: "14px 16px",
    border: "1px solid rgba(27, 111, 82, 0.22)",
    borderRadius: 8,
    fontSize: 14,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    outline: "none",
    boxSizing: "border-box",
    background: "rgba(255,255,247,0.86)",
    color: "#123429",
  },
};

const DEXTERITY_HIGHLIGHTS = [
  { title: "Follows through", detail: "Auto session checks, responsive forms, and lockouts keep the gate secure." },
  { title: "Feels premium", detail: "Soft gradients, layered cards, and focused typography make every tap deliberate." },
  { title: "Ready for growth", detail: "The same auth screen already supports thousands of profiles without lag." },
];

const HERO_FEATURES = [
  {
    title: "Guided support",
    desc: "Clear steps help buyers and sellers know what to do next without the guesswork.",
    stat: "Simple from day one",
  },
  {
    title: "Clear home details",
    desc: "Listings highlight the property, the paperwork, and the important facts people ask about first.",
    stat: "Easy to review",
  },
  {
    title: "Built-in peace of mind",
    desc: "Identity checks and reviewed documents help everyone feel more comfortable moving forward.",
    stat: "Reviewed before closing",
  },
];

const VERIFICATION_COMPONENTS = [
  {
    focus: "Identity",
    title: "Who you are",
    details: "We review account identity details so buyers, sellers, and support roles are tied to a real person.",
  },
  {
    focus: "Access",
    title: "Sign-in safety",
    details: "Password reset activity, login attempts, and account access patterns are checked for unusual behavior.",
  },
  {
    focus: "Profile",
    title: "Contact details",
    details: "Basic profile information like name, email, phone, and role selection is kept consistent for future review.",
  },
  {
    focus: "Transaction",
    title: "Readiness",
    details: "The account can later move into property, paperwork, and closing steps without repeating setup from scratch.",
  },
];

const DEXTERITY_METRICS = [
  { label: "Average reply", value: "9 min", detail: "Real people helping" },
  { label: "Accounts reviewed", value: "99.2%", detail: "Identity checks completed" },
  { label: "Reliable access", value: "99.9%", detail: "Ready when you need it" },
];

const DEXTERITY_PROMISES = [
  { step: "Start", note: "Get signed in, pick your role, and see the next steps for your move or sale." },
  { step: "Prepare", note: "Keep your paperwork, home details, and important updates in one place." },
  { step: "Close", note: "Follow the final steps with reminders so nothing important gets missed." },
];

const NEW_MEMBER_HOOKS = [
  {
    title: "List beautifully, without the busywork",
    detail: "Create your listing, add photos, and keep property details polished in one clean workspace.",
  },
  {
    title: "Guidance that feels human",
    detail: "See clear next steps for documents, timelines, and decisions without pressure-heavy language.",
  },
  {
    title: "Confidence from the first conversation",
    detail: "Verified profiles and practical checks help buyers and sellers move forward with more trust.",
  },
];

const DAISY_CHAIN_OFFER = [
  {
    step: "1. Create your account",
    detail: "Set up your profile and choose buyer or seller in a couple of minutes.",
  },
  {
    step: "2. Publish your first listing",
    detail: "Unlock a guided listing checklist and a smoother property setup flow.",
  },
  {
    step: "3. Unlock guided closing support",
    detail: "As activity starts, you get calm step-by-step support from offer through close.",
  },
];

const EARLY_MEMBER_INCENTIVES = [
  "No listing fee to publish your home",
  "Compliance templates and guided checklists included",
  "One EstateHat account for listings, messages, forms, and closing steps",
];

const ACCOUNT_TYPES = [
  { key: "buyer", label: "Buyer" },
  { key: "seller", label: "Seller" },
  { key: "corp_buyer", label: "Corporate Buyer" },
  { key: "corp_seller", label: "Corporate Seller" },
  { key: "attorney", label: "Attorney" },
  { key: "agent", label: "Agent" },
  { key: "inspector", label: "Inspector" },
  { key: "lender", label: "Lender" },
  { key: "admin", label: "Administrator" },
  { key: "webmaster", label: "Webmaster" },
  { key: "government", label: "Government" },
];

const GOVERNMENT_TYPE_OPTIONS = [
  { key: "gov_municipality", label: "Municipality" },
  { key: "gov_township", label: "Township" },
  { key: "gov_county", label: "County" },
  { key: "gov_borough", label: "Borough" },
  { key: "gov_parish", label: "Parish" },
  { key: "gov_state", label: "State" },
  { key: "gov_territory", label: "Territory" },
  { key: "gov_federal", label: "Federal" },
];

const ATTEMPT_KEY = "estatehat_auth_attempts_v1";
const LOCK_KEY = "estatehat_auth_lock_until_v1";
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const AUTH_TIMEOUT_MS = 15000;

function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

function normalizeEmail(raw) {
  return raw.trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStrongPassword(password) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);
}

function readLockUntil() {
  const value = Number(localStorage.getItem(LOCK_KEY) || 0);
  return Number.isFinite(value) ? value : 0;
}

function readRecentAttempts() {
  const now = Date.now();
  try {
    const parsed = JSON.parse(localStorage.getItem(ATTEMPT_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((ts) => Number.isFinite(ts) && now - ts < ATTEMPT_WINDOW_MS);
  } catch {
    return [];
  }
}

function writeAttempts(attempts) {
  localStorage.setItem(ATTEMPT_KEY, JSON.stringify(attempts));
}

async function persistProfileSafe(user, profile) {
  if (!user?.uid) return;
  try {
    await withTimeout(saveUserProfile(user.uid, profile, user), AUTH_TIMEOUT_MS, "Saving your profile took too long.");
  } catch {
    // Non-blocking
  }
}

export default function AuthScreen({ onAuth, initialMode = "login", onOpenPublicPage }) {
  const [mode, setMode] = useState(initialMode === "signup" ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [accountType, setAccountType] = useState("buyer");
  const [governmentType, setGovernmentType] = useState("gov_municipality");
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [lockUntil, setLockUntil] = useState(() => readLockUntil());
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showProfileOptions, setShowProfileOptions] = useState(false);
  const branding = useMemo(() => getAuthBrandingTemplate(), []);

  const now = Date.now();
  const lockRemainingSeconds = Math.max(0, Math.ceil((lockUntil - now) / 1000));
  const isLocked = lockRemainingSeconds > 0;

  useEffect(() => {
    const id = setInterval(() => setLockUntil(readLockUntil()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function finishRedirectLogin() {
      try {
        const cred = await getRedirectResult(auth);
        if (!mounted || !cred?.user) return;
        const profile = await ensureUserProfile(cred.user);
        if (typeof onAuth === "function") onAuth(profile);
      } catch (err) {
        if (mounted) setError(friendlyError(err));
      }
    }
    finishRedirectLogin();
    return () => {
      mounted = false;
    };
  }, [onAuth]);

  useEffect(() => {
    const nextMode = initialMode === "signup" ? "signup" : "login";
    setMode(nextMode);
    setError("");
    setNotice("");
  }, [initialMode]);

  function recordFailedAttempt() {
    const attempts = [...readRecentAttempts(), Date.now()];
    writeAttempts(attempts);
    if (attempts.length >= MAX_ATTEMPTS) {
      const until = Date.now() + LOCKOUT_MS;
      localStorage.setItem(LOCK_KEY, String(until));
      setLockUntil(until);
    }
  }

  function clearFailedAttempts() {
    localStorage.removeItem(ATTEMPT_KEY);
    localStorage.removeItem(LOCK_KEY);
    setLockUntil(0);
  }

  function validateCommon(cleanEmail, pass) {
    if (!isValidEmail(cleanEmail)) return "Please enter a valid email address.";
    if (pass.length < 6) return "Password must be at least 6 characters.";
    return "";
  }

  function friendlyError(err, intent = "auth") {
    const code = err?.code || "";
    if (
      code === "auth/invalid-credential" ||
      code === "auth/wrong-password" ||
      code === "auth/user-not-found" ||
      code === "auth/invalid-login-credentials"
    ) {
      return "Invalid email or password.";
    }
    if (code === "auth/email-already-in-use") {
      return "This email is already registered. Try signing in.";
    }
    if (code === "auth/operation-not-allowed") {
      return "This sign-in method is temporarily disabled.";
    }
    if (code === "auth/invalid-email") {
      return "Please enter a valid email address.";
    }
    if (code === "auth/missing-password") {
      return "Please enter your password.";
    }
    if (code === "auth/weak-password") {
      return "Use a stronger password with 8+ characters, mixed case, and a number.";
    }
    if (code === "auth/too-many-requests") {
      return "Too many attempts. Pause and try again in a few minutes.";
    }
    if (/timed out/i.test(err?.message || "")) {
      return err.message;
    }
    if (intent === "reset") {
      return "Password reset failed. Please try again.";
    }
    return mode === "login" ? "Sign-in failed. Please try again." : "Account creation failed. Please try again.";
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setNotice("");
    if (honeypot) {
      setError("Unable to process request.");
      return;
    }
    if (isLocked) {
      setError(`Too many attempts. Try again in ${lockRemainingSeconds}s.`);
      return;
    }
    const cleanEmail = normalizeEmail(email);
    const validationError = validateCommon(cleanEmail, password);
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    try {
      const cred = await withTimeout(
        signInWithEmailAndPassword(auth, cleanEmail, password),
        AUTH_TIMEOUT_MS,
        "Sign-in timed out. Please check your connection and try again."
      );
      const profile = await ensureUserProfile(cred.user);
      if (typeof onAuth === "function") onAuth(profile);
      clearFailedAttempts();
    } catch (err) {
      recordFailedAttempt();
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setNotice("");
    if (honeypot) {
      setError("Unable to process request.");
      return;
    }
    if (isLocked) {
      setError(`Too many attempts. Try again in ${lockRemainingSeconds}s.`);
      return;
    }
    const cleanEmail = normalizeEmail(email);
    const validationError = validateCommon(cleanEmail, password);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (name.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }
    if (!isStrongPassword(password)) {
      setError("Use 8+ characters with uppercase, lowercase, and a number.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const resolvedAccountType = accountType === "government" ? governmentType : accountType;
      const cred = await withTimeout(
        createUserWithEmailAndPassword(auth, cleanEmail, password),
        AUTH_TIMEOUT_MS,
        "Account creation timed out. Please try again."
      );
      await updateProfile(cred.user, { displayName: name.trim() }).catch(() => {});
      const profile = defaultProfile(cred.user, {
        name: name.trim(),
        email: cleanEmail,
        phone: phone.trim(),
        accountType: resolvedAccountType,
      });
      await persistProfileSafe(cred.user, profile);
      if (typeof onAuth === "function") onAuth(profile);
      clearFailedAttempts();
    } catch (err) {
      recordFailedAttempt();
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    if (loading) return;
    setError("");
    setNotice("");
    if (isLocked) {
      setError(`Too many attempts. Try again in ${lockRemainingSeconds}s.`);
      return;
    }
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const cred = await withTimeout(signInWithPopup(auth, provider), AUTH_TIMEOUT_MS, "Google sign-in timed out. Please try again.");
      const profile = await ensureUserProfile(cred.user);
      if (typeof onAuth === "function") onAuth(profile);
      clearFailedAttempts();
    } catch (err) {
      if (err?.code === "auth/popup-blocked" || err?.code === "auth/popup-closed-by-user") {
        setNotice("Popup blocked or closed. Redirecting to Google sign-in...");
        await signInWithRedirect(auth, provider);
        return;
      }
      recordFailedAttempt();
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (loading) return;
    const cleanEmail = normalizeEmail(email);
    if (!isValidEmail(cleanEmail)) {
      setError("Enter your email address first, then use reset password.");
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await withTimeout(
        sendPasswordResetEmail(auth, cleanEmail),
        AUTH_TIMEOUT_MS,
        "Password reset timed out. Please try again."
      );
      setNotice(`Password reset email sent to ${cleanEmail}.`);
    } catch (err) {
      setError(friendlyError(err, "reset"));
    } finally {
      setLoading(false);
    }
  }

  const modeSubtitle = useMemo(
    () =>
      mode === "login"
        ? "Welcome back. One EstateHat gets you back into listings, messages, forms, documents, and closing steps."
        : "Create one EstateHat account and prepare your first listing with guided, professional support.",
    [mode]
  );

  const passwordInputType = showPassword ? "text" : "password";
  const confirmPasswordInputType = showConfirmPassword ? "text" : "password";

  return (
    <div
      className="estatehat-auth-root"
      style={{
        minHeight: "100vh",
        background: [
          "linear-gradient(rgba(31,157,107,0.08) 1px, transparent 1px)",
          "linear-gradient(90deg, rgba(31,157,107,0.08) 1px, transparent 1px)",
          "linear-gradient(180deg, #f4fff6 0%, #eaf7ff 58%, #fff8dc 100%)",
        ].join(","),
        backgroundSize: "52px 52px, 52px 52px, auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        padding: 24,
        fontFamily: S.font,
      }}
    >
      <div
        className="estatehat-auth-grid"
        style={{
          width: "min(1160px, 100%)",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)",
          gap: 24,
        }}
      >
        <div
          className="estatehat-auth-hero"
          style={{
            borderRadius: 8,
            padding: "44px 36px",
            background: [
              "linear-gradient(rgba(255,255,247,0.1) 1px, transparent 1px)",
              "linear-gradient(90deg, rgba(255,255,247,0.1) 1px, transparent 1px)",
              "linear-gradient(180deg, rgba(15,107,79,0.94) 0%, rgba(76,132,77,0.9) 62%, rgba(244,183,64,0.34) 100%)",
            ].join(","),
            backgroundSize: "42px 42px, 42px 42px, auto",
            color: "#fffef6",
            boxShadow: "0 32px 90px rgba(27,111,82,0.24)",
            position: "relative",
            overflow: "hidden",
            border: `1px solid ${S.border}`,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ fontSize: 12, letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 12 }}>{branding.accentBadge}</div>
            <div style={{ fontFamily: S.serif, fontSize: "clamp(2.4rem, 5vw, 4.2rem)", lineHeight: 1.1, marginBottom: 14 }}>{branding.heroHeadline}</div>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: "rgba(244,247,243,0.88)", maxWidth: 510 }}>{branding.heroDescription}</p>
            <div style={{ marginTop: 28, display: "grid", gap: 12 }}>
              {branding.callouts.map((callout) => (
                <div key={callout.title} style={{ background: "rgba(255,255,247,0.14)", borderRadius: 8, padding: 16, border: "1px solid rgba(255,255,247,0.26)", backdropFilter: "blur(12px)" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{callout.title}</div>
                  <div style={{ fontSize: 13, color: "rgba(244,247,243,0.72)", lineHeight: 1.5 }}>{callout.desc}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 26, display: "grid", gap: 12 }}>
              {HERO_FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  style={{
                    borderRadius: 8,
                    padding: 16,
                    background: "rgba(255,255,247,0.14)",
                    border: "1px solid rgba(255,255,247,0.26)",
                    display: "grid",
                    gap: 4,
                    transition: "transform 0.28s ease, box-shadow 0.28s ease",
                    boxShadow: "0 12px 30px rgba(0, 0, 0, 0.25)",
                  }}
                >
                  <strong style={{ fontSize: 14 }}>{feature.title}</strong>
                  <p style={{ fontSize: 13, color: "rgba(244,247,243,0.8)", margin: 0 }}>{feature.desc}</p>
                  <span style={{ fontSize: 12, color: S.accent, fontWeight: 600 }}>{feature.stat}</span>
                </div>
              ))}
            </div>
            <div
              style={{
                marginTop: 28,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
              }}
            >
              {DEXTERITY_HIGHLIGHTS.map((item) => (
                <div
                  key={item.title}
                  style={{
                    borderRadius: 8,
                    padding: 16,
                    border: `1px solid ${S.border}`,
                    background: "rgba(255,255,247,0.12)",
                    backdropFilter: "blur(14px)",
                    boxShadow: "0 18px 40px rgba(3, 33, 38, 0.35)",
                    transition: "transform 0.28s ease",
                  }}
                >
                  <div style={{ fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.65)" }}>{item.title}</div>
                  <p style={{ fontSize: 13, color: "rgba(244,247,243,0.8)", margin: "10px 0 0", lineHeight: 1.5 }}>{item.detail}</p>
                </div>
              ))}
            </div>
            <div
              style={{
                marginTop: 22,
                padding: "18px 20px",
                borderRadius: 8,
                background: "rgba(255,255,247,0.14)",
                border: "1px solid rgba(255,255,247,0.26)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div>
                <p style={{ fontSize: 12, color: "rgba(244,247,243,0.8)", margin: 0, textTransform: "uppercase", letterSpacing: "0.3em" }}>EstateHat promise</p>
                <strong style={{ fontSize: 28, fontFamily: S.serif, color: "#fff" }}>Simple, steady support</strong>
              </div>
              <p style={{ fontSize: 12, color: "rgba(244,247,243,0.78)", margin: 0, maxWidth: 220 }}>
                One EstateHat keeps home search, selling, documents, messages, forms, and closing steps under the same sign-in.
              </p>
            </div>
          </div>
        </div>
        <div
          className="estatehat-auth-panel"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,247,0.94), rgba(232,248,237,0.88))",
            borderRadius: 8,
            padding: "32px 34px",
            border: `1px solid ${S.border}`,
            boxShadow: "0 26px 70px rgba(27,111,82,0.16)",
          }}
        >
            <div style={{ display: "flex", gap: 10, borderRadius: 8, background: "rgba(31,157,107,0.1)", padding: 6, marginBottom: 24 }}>
              {[
                ["login", "Sign In"],
                ["signup", "Create Account"],
              ].map(([nextMode, label]) => (
                <button
                  key={nextMode}
                  type="button"
                  onClick={() => {
                    setMode(nextMode);
                    setError("");
                    setNotice("");
                  }}
                  style={{
                    flex: 1,
                    minHeight: 46,
                    borderRadius: 8,
                    border: mode === nextMode ? "1px solid rgba(244,183,64,0.54)" : "1px solid transparent",
                    background: mode === nextMode ? S.gold : "transparent",
                    color: mode === nextMode ? "#17351e" : S.ink,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: S.font,
                    fontSize: 14,
                    transition: "background 0.3s ease, color 0.3s ease, transform 0.3s ease",
                    transform: mode === nextMode ? "translateY(-1px)" : "translateY(0)",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: S.goldDeep, marginBottom: 6 }}>Welcome</div>
            <h2 style={{ fontFamily: S.serif, fontSize: 32, margin: "0 0 8px", color: S.dark }}>{mode === "login" ? "Welcome back" : "Claim your early member access"}</h2>
            <p style={{ fontSize: 13, color: S.muted, lineHeight: 1.6 }}>{modeSubtitle}</p>
          </div>
          {mode === "login" && (
            <div
              style={{
                marginBottom: 16,
                borderRadius: 8,
                border: `1px solid ${S.border}`,
                background: "linear-gradient(135deg, rgba(31,157,107,0.12), rgba(244,183,64,0.14))",
                padding: "16px 16px 14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: S.dark }}>Founding Member Window</div>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setError("");
                    setNotice("");
                  }}
                  style={{
                    border: "none",
                    borderRadius: 8,
                    padding: "8px 12px",
                    background: S.goldDeep,
                    color: "#fffef6",
                    fontFamily: S.font,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Create account
                </button>
              </div>
              <p style={{ margin: "0 0 10px", fontSize: 12.5, color: S.muted, lineHeight: 1.45 }}>
                Join now to lock in the smoothest setup path while EstateHat is onboarding early members.
              </p>
              <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
                {EARLY_MEMBER_INCENTIVES.map((item) => (
                  <div key={item} style={{ fontSize: 12.5, color: S.dark, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: S.goldDeep }}>✓</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {NEW_MEMBER_HOOKS.map((hook) => (
                  <div
                    key={hook.title}
                    style={{
                      borderRadius: 8,
                      background: "rgba(255,255,247,0.74)",
                      border: `1px solid ${S.border}`,
                      padding: "10px 12px",
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: S.dark }}>{hook.title}</div>
                    <div style={{ fontSize: 12, color: S.muted, lineHeight: 1.45, marginTop: 3 }}>{hook.detail}</div>
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginTop: 10,
                  borderRadius: 8,
                  border: `1px solid ${S.border}`,
                  background: "rgba(255,255,247,0.74)",
                  padding: "10px 12px",
                  display: "grid",
                  gap: 7,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: S.goldDeep, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Member Path
                </div>
                {DAISY_CHAIN_OFFER.map((offer) => (
                  <div key={offer.step}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: S.dark }}>{offer.step}</div>
                    <div style={{ fontSize: 12, color: S.muted, lineHeight: 1.4 }}>{offer.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {mode === "signup" && (
            <div
              style={{
                marginBottom: 14,
                borderRadius: 8,
                border: `1px solid ${S.border}`,
                background: "linear-gradient(135deg, rgba(31,157,107,0.12), rgba(244,183,64,0.14))",
                padding: "12px 14px",
              }}
            >
              <div style={{ fontSize: 12, color: S.goldDeep, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>
                New Member Incentives
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                {EARLY_MEMBER_INCENTIVES.map((item) => (
                  <div key={item} style={{ fontSize: 12.5, color: S.dark, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: S.goldDeep }}>✓</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: 12,
              marginBottom: 18,
            }}
          >
            {DEXTERITY_METRICS.map((metric) => (
              <div
                key={metric.label}
                style={{
                  borderRadius: 8,
                  padding: 12,
                  border: `1px solid ${S.border}`,
                  background: "rgba(255,255,247,0.74)",
                  minHeight: 80,
                }}
              >
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.2em", color: S.muted }}>{metric.label}</div>
                <strong style={{ fontSize: 20, display: "block", margin: "6px 0" }}>{metric.value}</strong>
                <span style={{ fontSize: 11, color: S.muted }}>{metric.detail}</span>
              </div>
            ))}
          </div>
          <form onSubmit={mode === "login" ? handleLogin : handleSignup}>
            <input type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} style={{ position: "absolute", left: -9999, opacity: 0, width: 1, height: 1 }} aria-hidden="true" />
            {mode === "signup" && (
              <>
                <label style={{ fontSize: 12, fontWeight: 700, color: S.ink, display: "block", marginBottom: 6 }}>Full Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jordan Mitchell"
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                  style={{ ...S.input, marginBottom: 14 }}
                />
              </>
            )}
            <label style={{ fontSize: 12, fontWeight: 700, color: S.ink, display: "block", marginBottom: 6 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete={mode === "login" ? "username" : "email"}
              spellCheck={false}
              inputMode="email"
              style={{ ...S.input, marginBottom: 14 }}
            />
            <label style={{ fontSize: 12, fontWeight: 700, color: S.ink, display: "block", marginBottom: 6 }}>Password</label>
            <div style={{ position: "relative", marginBottom: mode === "signup" ? 14 : 10 }}>
              <input
                type={passwordInputType}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                style={{ ...S.input, marginBottom: 0, paddingRight: 96 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                style={{ position: "absolute", top: "50%", right: 12, transform: "translateY(-50%)", border: "none", background: "transparent", color: S.goldDeep, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {mode === "signup" && (
              <>
                <label style={{ fontSize: 12, fontWeight: 700, color: S.ink, display: "block", marginBottom: 6 }}>Confirm Password</label>
                <div style={{ position: "relative", marginBottom: 12 }}>
                  <input
                    type={confirmPasswordInputType}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    style={{ ...S.input, marginBottom: 0, paddingRight: 96 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    style={{ position: "absolute", top: "50%", right: 12, transform: "translateY(-50%)", border: "none", background: "transparent", color: S.goldDeep, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                  >
                    {showConfirmPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <label style={{ fontSize: 12, fontWeight: 700, color: S.ink, display: "block", marginBottom: 6 }}>Account Type</label>
                <select value={accountType} onChange={(e) => setAccountType(e.target.value)} style={{ ...S.input, marginBottom: 12 }}>
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
                {accountType === "government" && (
                  <>
                    <label style={{ fontSize: 12, fontWeight: 700, color: S.ink, display: "block", marginBottom: 6 }}>Government Type</label>
                    <select value={governmentType} onChange={(e) => setGovernmentType(e.target.value)} style={{ ...S.input, marginBottom: 12 }}>
                      {GOVERNMENT_TYPE_OPTIONS.map((t) => (
                        <option key={t.key} value={t.key}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setShowProfileOptions((value) => !value)}
                  style={{ background: "transparent", border: "none", padding: 0, marginBottom: showProfileOptions ? 12 : 16, color: S.goldDeep, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                >
                  {showProfileOptions ? "Hide extra profile options" : "Add phone"}
                </button>
                {showProfileOptions && (
                  <>
                    <label style={{ fontSize: 12, fontWeight: 700, color: S.ink, display: "block", marginBottom: 6 }}>Phone</label>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(555) 000-0000"
                      maxLength={30}
                      autoComplete="tel"
                      style={{ ...S.input, marginBottom: 14 }}
                    />
                  </>
                )}
              </>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: mode === "signup" ? 10 : 16 }}>
              {mode === "login" && (
                <button type="button" onClick={handleResetPassword} disabled={loading} style={{ background: "transparent", border: "none", padding: 0, color: S.goldDeep, fontWeight: 700, fontSize: 12, cursor: loading ? "not-allowed" : "pointer" }}>
                  Reset password
                </button>
              )}
            </div>
            {isLocked && (
              <div style={{ fontSize: 13, color: S.danger, background: S.dangerBg, borderRadius: 8, padding: "12px 14px", marginBottom: 14 }}>
                Too many attempts. Try again in {lockRemainingSeconds}s.
              </div>
            )}
            {error && (
              <div role="alert" style={{ fontSize: 13, color: S.danger, background: S.dangerBg, borderRadius: 8, padding: "12px 14px", marginBottom: 14 }}>
                {error}
              </div>
            )}
            {notice && (
              <div aria-live="polite" style={{ fontSize: 13, color: S.notice, background: S.noticeBg, borderRadius: 8, padding: "12px 14px", marginBottom: 14 }}>
                {notice}
              </div>
            )}
          <button
            type="submit"
            disabled={loading || isLocked}
            style={{
              width: "100%",
              minHeight: 52,
              background: `linear-gradient(135deg, ${S.gold} 0%, ${S.goldDeep} 100%)`,
              color: "#031111",
              border: "none",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 15,
              cursor: loading || isLocked ? "not-allowed" : "pointer",
              opacity: loading || isLocked ? 0.7 : 1,
              transition: "transform 0.25s ease, box-shadow 0.25s ease",
              boxShadow: loading || isLocked ? "none" : "0 18px 40px rgba(31,157,107,0.22)",
            }}
          >
            {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
          <div
            style={{
              marginTop: 16,
              padding: "14px 16px",
              borderRadius: 8,
              border: `1px solid ${S.border}`,
              background: S.accentSoft,
              color: S.dark,
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            EstateHat gives you one place to review homes, keep up with paperwork, and stay organized through closing.
          </div>
            <div
              style={{
                marginTop: 18,
                borderRadius: 8,
                border: `1px solid ${S.border}`,
                padding: "18px 20px",
                background: "rgba(31,157,107,0.08)",
                display: "grid",
                gap: 12,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: S.dark }}>What We Review</div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 12,
                }}
              >
                {VERIFICATION_COMPONENTS.map((item) => (
                  <div
                    key={item.title}
                    style={{
                      borderRadius: 8,
                      background: "rgba(255,255,247,0.74)",
                      border: `1px solid ${S.border}`,
                      padding: 10,
                      minHeight: 120,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <strong style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.2em", color: S.muted }}>{item.focus}</strong>
                    <div style={{ fontSize: 15, fontWeight: 700, color: S.dark }}>{item.title}</div>
                    <p style={{ fontSize: 12, color: S.muted, margin: 0, lineHeight: 1.4 }}>{item.details}</p>
                  </div>
                ))}
              </div>
            </div>
            <div
              style={{
                marginTop: 16,
                padding: "16px 18px",
                borderRadius: 8,
                border: `1px solid ${S.border}`,
                background: "rgba(255,255,247,0.74)",
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: S.dark }}>How It Usually Goes</div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                  gap: 8,
                }}
              >
                {DEXTERITY_PROMISES.map((promise) => (
                  <div
                    key={promise.step}
                    style={{
                      borderRadius: 8,
                      padding: "10px 12px",
                      background: S.accentSoft,
                      border: `1px solid ${S.border}`,
                    }}
                  >
                    <div style={{ fontSize: 12, color: S.goldDeep }}>{promise.step}</div>
                    <p style={{ fontSize: 12, margin: "4px 0 0", color: S.muted, lineHeight: 1.3 }}>{promise.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </form>
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0" }}>
            <div style={{ flex: 1, height: 1, background: S.border }} />
            <span style={{ fontSize: 12, color: S.muted }}>or</span>
            <div style={{ flex: 1, height: 1, background: S.border }} />
          </div>
          <button
            onClick={handleGoogle}
            disabled={loading || isLocked}
            style={{ width: "100%", minHeight: 52, borderRadius: 8, border: `1px solid ${S.border}`, background: "rgba(255,255,247,0.78)", color: S.dark, fontWeight: 600, fontSize: 14, cursor: loading || isLocked ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.93 2.31-8.16 2.31-6.26 0-11.57-3.59-13.46-8.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            Continue with Google
          </button>
          <div style={{ textAlign: "center", marginTop: 18, fontSize: 12, color: S.muted, lineHeight: 1.6 }}>{branding.termsCopy(branding.appName)}</div>
          <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: S.muted }}>
            {mode === "login" ? "Don\'t have an account?" : "Already have an account?"} <span
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              style={{ color: S.goldDeep, fontWeight: 700, cursor: "pointer" }}
            >
              {mode === "login" ? "Create one" : "Sign in"}
            </span>
          </div>
        </div>
      </div>
      <SimpleImageBand context="sign in" compact style={{ width: "min(1160px, 100%)", margin: "0 auto" }} />
      <EstateHatPublicFooter
        onCreateAccount={() => setMode("signup")}
        onSignIn={() => setMode("login")}
        onOpenPublicPage={onOpenPublicPage}
      />
      <style>{`
        .estatehat-auth-root,
        .estatehat-auth-root * {
          box-sizing: border-box;
        }
        .estatehat-auth-grid,
        .estatehat-auth-panel,
        .estatehat-auth-hero {
          min-width: 0;
        }
        @media (max-width: 860px) {
          .estatehat-auth-root {
            padding: 12px !important;
            justify-content: flex-start !important;
          }
          .estatehat-auth-grid {
            grid-template-columns: minmax(0, 1fr) !important;
            gap: 12px !important;
          }
          .estatehat-auth-hero {
            display: none !important;
          }
          .estatehat-auth-panel {
            padding: 20px 16px !important;
            width: 100% !important;
          }
          .estatehat-auth-panel h2,
          .estatehat-auth-panel p,
          .estatehat-auth-panel div,
          .estatehat-auth-panel button,
          .estatehat-auth-panel input,
          .estatehat-auth-panel select {
            max-width: 100% !important;
            overflow-wrap: anywhere !important;
          }
        }
      `}</style>
    </div>
  );
}
