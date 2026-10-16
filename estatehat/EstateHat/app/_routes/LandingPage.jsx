"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import MarketingLanding from "../../src/MarketingLanding.jsx";
import { auth } from "../../src/firebase.js";

export default function LandingPage() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    document.title = "EstateHat";
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setIsAuthenticated(Boolean(firebaseUser));
      setAuthReady(true);
    });

    return unsubscribe;
  }, []);

  if (!authReady) {
    return <div className="app-loader">Starting EstateHat&hellip;</div>;
  }

  return (
    <MarketingLanding
      onStartSignup={() => router.push("/signin?mode=signup")}
      onSignIn={() => router.push("/signin")}
      onOpenApp={() => router.push(isAuthenticated ? "/home" : "/signin")}
      onOpenPublicPage={(page) => router.push(`/${encodeURIComponent(page)}`)}
      isAuthenticated={isAuthenticated}
    />
  );
}
