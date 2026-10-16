"use client";

import React, { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import EstateHatApp from "../../src/estatehat-platform-alpha.jsx";
import { ensureUserProfile, saveUserProfile } from "../../src/backend.js";
import { auth } from "../../src/firebase.js";
import { useInactivityLogout } from "../../src/useInactivityLogout.js";

function BootFrame({ title, description, actions }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f4efe6", color: "#241d18", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div style={{ width: "min(560px, 100%)", padding: 28, borderRadius: 24, border: "1px solid rgba(52, 43, 34, 0.1)", background: "rgba(255, 251, 245, 0.96)", boxShadow: "0 24px 60px rgba(42, 34, 27, 0.14)" }}>
        <span style={{ display: "inline-block", marginBottom: 14, color: "#b68632", fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>EstateHat</span>
        <h1 style={{ margin: "0 0 10px", fontFamily: "'DM Serif Display', Georgia, serif", fontSize: "clamp(2rem, 4vw, 3rem)", lineHeight: 1.02 }}>{title}</h1>
        <p style={{ margin: 0, color: "#5f5243", fontSize: "1rem", lineHeight: 1.6 }}>{description}</p>
        {actions ? <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 22 }}>{actions}</div> : null}
      </div>
    </div>
  );
}

export default function HomePage() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  const [fatalError, setFatalError] = useState("");
  const [authRetry, setAuthRetry] = useState(0);
  const authCallbackVersion = useRef(0);

  useEffect(() => {
    document.title = "EstateHat";
  }, []);

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        if (!active) return;
        const callbackVersion = ++authCallbackVersion.current;

        try {
          if (!firebaseUser) {
            if (!active || callbackVersion !== authCallbackVersion.current) return;
            setUser(null);
            setFatalError("");
            setAuthReady(true);
            return;
          }

          const profile = await ensureUserProfile(firebaseUser, {}, { throwOnError: true });
          if (!active || callbackVersion !== authCallbackVersion.current) return;
          setUser(profile);
          setFatalError("");
        } catch (error) {
          if (!active || callbackVersion !== authCallbackVersion.current) return;
          setFatalError(error instanceof Error ? error.message : "Unable to initialize your account.");
        } finally {
          if (active && callbackVersion === authCallbackVersion.current) setAuthReady(true);
        }
      },
      (error) => {
        if (!active) return;
        authCallbackVersion.current += 1;
        setFatalError(error instanceof Error ? error.message : "Authentication failed to initialize.");
        setAuthReady(true);
      }
    );

    return () => {
      active = false;
      authCallbackVersion.current += 1;
      unsubscribe();
    };
  }, [authRetry]);

  async function handleLogout() {
    try {
      await signOut(auth);
    } finally {
      setUser(null);
    }
  }

  async function handleSaveProfile(profile) {
    if (!auth.currentUser?.uid) {
      throw new Error("You must be signed in to save your profile.");
    }

    const saved = await saveUserProfile(auth.currentUser.uid, profile, auth.currentUser);
    setUser(saved);
    return saved;
  }

  useInactivityLogout({
    enabled: Boolean(user),
    onTimeout: handleLogout
  });

  if (!authReady) {
    return <BootFrame title="Loading EstateHat" description="Starting the authenticated marketplace shell and restoring your local session." />;
  }

  if (fatalError) {
    return (
      <BootFrame
        title="EstateHat needs attention"
        description={fatalError}
        actions={
          <>
            <button onClick={() => { setFatalError(""); setAuthReady(false); setAuthRetry((attempt) => attempt + 1); }}>Try Again</button>
            <button onClick={() => window.location.assign("/signin")}>Sign In</button>
          </>
        }
      />
    );
  }

  if (!user) {
    return (
      <BootFrame
        title="Sign in to open EstateHat"
        description="The main EstateHat workspace is ready once your account is signed in."
        actions={
          <>
            <button onClick={() => window.location.assign("/signin")}>Sign In</button>
            <button onClick={() => window.location.assign("/")}>Start Page</button>
          </>
        }
      />
    );
  }

  return <EstateHatApp initialUser={user} onLogout={handleLogout} onSaveProfile={handleSaveProfile} />;
}
