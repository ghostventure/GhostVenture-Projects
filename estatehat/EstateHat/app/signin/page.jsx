"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import AuthScreen from "../../src/AuthScreen.jsx";
import { ensureUserProfile, loadUserProfile } from "../../src/backend.js";
import { auth } from "../../src/firebase.js";

export default function SignInPage() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [initialMode] = useState(() => {
    if (typeof window === "undefined") return "login";
    const params = new URLSearchParams(window.location.search);
    return params.get("mode") === "signup" ? "signup" : "login";
  });

  useEffect(() => {
    document.title = initialMode === "signup" ? "Create EstateHat Account" : "EstateHat Sign In";
  }, [initialMode]);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!active) return;
      if (!firebaseUser) {
        setAuthReady(true);
        return;
      }

      try {
        const profile = await loadUserProfile(firebaseUser);
        if (!profile) await ensureUserProfile(firebaseUser);
      } finally {
        if (active) router.replace("/home");
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [router]);

  function handleAuth() {
    router.replace("/home");
  }

  if (!authReady) {
    return <div className="app-loader">Loading sign in&hellip;</div>;
  }

  return <AuthScreen onAuth={handleAuth} initialMode={initialMode} onOpenPublicPage={(page) => router.push(`/${encodeURIComponent(page)}`)} />;
}
