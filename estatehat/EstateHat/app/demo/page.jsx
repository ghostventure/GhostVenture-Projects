"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { defaultProfile } from "../../src/backend.js";

const EstateHatApp = dynamic(() => import("../../src/estatehat-platform-alpha.jsx"), { ssr: false });

const demoFirebaseUser = {
  uid: "estatehat-demo-video-user",
  displayName: "Taylor EstateHat",
  email: "demo@estatehat.com",
  phoneNumber: "(919) 555-0118",
};

export default function DemoPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const demoUser = useMemo(() => {
    const profile = defaultProfile(demoFirebaseUser, {
      name: "Taylor EstateHat",
      email: "demo@estatehat.com",
      phone: "(919) 555-0118",
      accountType: "seller",
      city: "Raleigh",
      state: "NC",
      oneEstateHatId: "EH-DEMO-2026-001",
    });

    return {
      ...profile,
      createdAt: "2026-04-01T14:22:00.000Z",
      updatedAt: "2026-04-30T10:00:00.000Z",
      trust: {
        ...profile.trust,
        verifiedProfileActive: true,
        verifiedProfileVisibility: true,
        verifiedProfileSince: "2026-04-12T09:30:00.000Z",
      },
      verification: {
        ...profile.verification,
        citizenshipStatus: "verified",
        review: {
          ...(profile.verification?.review || {}),
          status: "approved",
          queueLabel: "Priority review queue",
          lastSubmittedAt: "2026-04-22T08:45:00.000Z",
        },
      },
      security: {
        ...profile.security,
        twoFactorEnabled: true,
        loginAlerts: true,
        trustedDevice: true,
        documentShield: true,
      },
      userDatabase: {
        ...profile.userDatabase,
        status: "active",
        preferredContact: "phone",
        supportTier: "priority",
        tags: ["demo", "seller-ready", "verified"],
        notes: "Demo profile for EstateHat product walkthrough video.",
      },
    };
  }, []);

  if (!mounted) {
    return <div className="app-loader">Loading EstateHat demo…</div>;
  }

  return <EstateHatApp initialUser={demoUser} onLogout={() => {}} onSaveProfile={async (nextProfile) => nextProfile} />;
}
