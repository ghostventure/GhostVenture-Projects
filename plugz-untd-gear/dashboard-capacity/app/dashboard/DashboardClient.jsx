"use client";

import { useEffect, useState } from "react";
import { createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import CustomerOrderHistory from "../../dashboard/CustomerOrderHistory";
import { getFirebaseClients } from "../../lib/firebase-client";

export default function DashboardClient() {
  const [clients, setClients] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileState, setProfileState] = useState("idle");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [authMode, setAuthMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    try {
      const firebase = getFirebaseClients();
      setClients(firebase);
      unsubscribe = onAuthStateChanged(firebase.auth, async (currentUser) => {
        if (!active) return;
        setUser(currentUser);
        setProfile(null);
        setAuthReady(true);
        setMessage("");
        if (!currentUser) {
          setProfileState("idle");
          return;
        }
        setProfileState("loading");
        try {
          const snapshot = await getDoc(doc(firebase.db, "users", currentUser.uid));
          if (!active) return;
          setProfile(snapshot.exists() ? snapshot.data() : null);
          setProfileState("ready");
        } catch {
          if (!active) return;
          setProfileState("error");
        }
      });
    } catch (error) {
      setMessage(error.message || "Firebase is not configured yet.");
      setAuthReady(true);
    }
    return () => { active = false; unsubscribe(); };
  }, []);

  async function handleAccountSubmit(event) {
    event.preventDefault();
    if (!clients) return;
    setBusy(true);
    setMessage("");
    try {
      if (authMode === "signup") {
        const credential = await createUserWithEmailAndPassword(clients.auth, email.trim(), password);
        try {
          await httpsCallable(clients.functions, "initializeCustomerProfile")();
        } catch {
          setMessage("Your account was created. Profile setup will finish when you next open the dashboard.");
        }
        setUser(credential.user);
      } else {
        await signInWithEmailAndPassword(clients.auth, email.trim(), password);
      }
    } catch (error) {
      if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found"].includes(error.code)) setMessage("That email and password were not recognized.");
      else if (error.code === "auth/email-already-in-use") setMessage("An account already uses that email. Choose Sign in instead.");
      else if (error.code === "auth/weak-password") setMessage("Use a stronger password with at least six characters.");
      else if (error.code === "auth/too-many-requests") setMessage("Too many attempts. Wait a little and try again.");
      else if (error.code === "auth/unauthorized-domain") setMessage("This preview address is not enabled for sign-in. Add its hostname to Firebase Authentication’s authorized domains.");
      else setMessage("We couldn’t sign you in. Try again or contact support if the problem continues.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePasswordReset() {
    if (!clients || !email.trim()) {
      setMessage("Enter your email address first, then choose password reset.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await sendPasswordResetEmail(clients.auth, email.trim());
      setMessage("If an account exists for that address, a password reset email is on its way.");
    } catch {
      setMessage("We couldn’t send a reset email. Check the address and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    if (!clients) return;
    setBusy(true);
    try { await signOut(clients.auth); }
    catch { setMessage("We couldn’t sign you out. Please retry."); }
    finally { setBusy(false); }
  }

  const name = profile?.displayName || user?.displayName || user?.email || "Plugz member";
  const initials = String(name).trim().slice(0, 1).toUpperCase() || "P";
  const savedCount = Array.isArray(profile?.savedPieces) ? profile.savedPieces.length : 0;
  const profilePercent = [profile?.displayName, profile?.handle, profile?.preferredSize, profile?.styleFocus]
    .filter(Boolean).length * 25;

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <a className="brand" href="https://plugz-untd-gear.web.app/" aria-label="Plugz home">PLUGZ<span>UNTD</span></a>
        <nav aria-label="Account navigation">
          <a href="https://plugz-untd-gear.web.app/#shop">Shop</a>
          <a className="current-link" href="/dashboard" aria-current="page">Dashboard</a>
          {user && <a href="/account/settings">Settings</a>}
          {user && <button className="quiet-button" type="button" onClick={handleSignOut} disabled={busy}>Sign out</button>}
        </nav>
      </header>

      {!authReady ? (
        <section className="sign-in-card" aria-live="polite"><p className="eyebrow">Your account</p><h1>Opening your dashboard…</h1><div className="loading-line" /></section>
      ) : !user ? (
        <section className="sign-in-card">
          <p className="eyebrow">Your account</p>
          <div className="auth-tabs" role="tablist" aria-label="Account access">
            <button type="button" role="tab" aria-selected={authMode === "signin"} className={authMode === "signin" ? "active" : ""} onClick={() => { setAuthMode("signin"); setMessage(""); }}>Sign in</button>
            <button type="button" role="tab" aria-selected={authMode === "signup"} className={authMode === "signup" ? "active" : ""} onClick={() => { setAuthMode("signup"); setMessage(""); }}>Create account</button>
          </div>
          <h1>{authMode === "signup" ? "Create your account." : "Welcome back."}</h1>
          <p>{authMode === "signup" ? "Save pieces, follow drops, and bring your Plugz account together." : "Sign in to see your orders, saved pieces, and account details."}</p>
          <form className="account-form" onSubmit={handleAccountSubmit}>
            <label htmlFor="account-email">Email address</label>
            <input id="account-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
            <div className="password-label-row">
              <label htmlFor="account-password">Password</label>
              {authMode === "signin" && <button className="text-button" type="button" disabled={busy} onClick={handlePasswordReset}>Forgot password?</button>}
            </div>
            <input id="account-password" type="password" autoComplete={authMode === "signup" ? "new-password" : "current-password"} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} />
            <button className="primary-button" type="submit" disabled={busy || !clients}>
              {busy ? "Please wait…" : authMode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>
          <p className="account-terms">By continuing, you agree to the Plugz <a href="https://plugz-untd-gear.web.app/legal.html">Terms</a> and <a href="https://plugz-untd-gear.web.app/privacy.html">Privacy Policy</a>.</p>
          {message && <p className="notice" role="alert">{message}</p>}
          <p className="fine-print">Your account information and order history are private to you.</p>
        </section>
      ) : (
        <>
          <section className="welcome-panel dashboard-hero">
            <div className="hero-glow" aria-hidden="true" />
            <div className="avatar" aria-hidden="true">{initials}</div>
            <div className="welcome-copy">
              <p className="eyebrow">Your Plugz space</p>
              <h1>Welcome back, {name.split(" ")[0]}.</h1>
              <p>{profile?.bio || "Your Plugz account, saved rotation, and order history."}</p>
            </div>
            <div className="hero-actions"><span className="member-chip"><span aria-hidden="true" /> MEMBER ACCOUNT</span><a className="outline-button" href="/account/settings">Account settings <span aria-hidden="true">↗</span></a></div>
          </section>

          <section className="metrics" aria-label="Account summary">
            <article className="metric-card"><span className="metric-icon" aria-hidden="true">♡</span><span className="metric-value">{savedCount}</span><span className="metric-label">Saved pieces</span><span className="metric-footnote">Your personal rotation</span></article>
            <article className="metric-card"><span className="metric-icon" aria-hidden="true">◌</span><span className="metric-value">{profilePercent}%</span><span className="metric-label">Profile signal</span><span className="metric-footnote">Complete your account details</span></article>
            <article className="metric-card"><span className="metric-icon" aria-hidden="true">⌁</span><span className="metric-value">{profile?.dropAlerts || profile?.restockAlerts ? "On" : "Off"}</span><span className="metric-label">Drop alerts</span><span className="metric-footnote">Your notification preference</span></article>
          </section>

          {profileState === "error" && <p className="notice" role="status">We couldn’t load your profile details. Your order history can still load below.</p>}
          {profileState === "loading" && <p className="subtle-status" role="status">Loading your account details…</p>}

          <CustomerOrderHistory functions={clients.functions} uid={user.uid} />

          <section className="quick-links" aria-labelledby="account-links-title">
            <div className="quick-links-heading"><p className="eyebrow">Made for you</p><h2 id="account-links-title">Your account shortcuts</h2><p>Pick up where you left off.</p></div>
            <a className="shortcut-card" href="/account/settings"><span className="shortcut-icon" aria-hidden="true">01</span><span className="shortcut-copy"><strong>Profile & settings</strong><small>Personalize your details and updates.</small></span><span className="shortcut-arrow" aria-hidden="true">↗</span></a>
            <a className="shortcut-card" href="https://plugz-untd-gear.web.app/rotation"><span className="shortcut-icon" aria-hidden="true">02</span><span className="shortcut-copy"><strong>Saved rotation</strong><small>Revisit the pieces you’ve kept.</small></span><span className="shortcut-arrow" aria-hidden="true">↗</span></a>
            <a className="shortcut-card" href="https://plugz-untd-gear.web.app/support"><span className="shortcut-icon" aria-hidden="true">03</span><span className="shortcut-copy"><strong>Member support</strong><small>Get help with an order or account.</small></span><span className="shortcut-arrow" aria-hidden="true">↗</span></a>
          </section>
        </>
      )}
      <footer className="page-footer"><span>PLUGZ UNTD · ACCOUNT CENTER</span><a href="https://plugz-untd-gear.web.app/legal.html#privacy">Privacy</a></footer>
    </main>
  );
}
