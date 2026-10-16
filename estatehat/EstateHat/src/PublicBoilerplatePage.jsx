"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import EstateHatPublicFooter from "./EstateHatPublicFooter.jsx";
import {
  AboutView,
  AccessibilityView,
  DmcaView,
  FAQView,
  HelpView,
  InvestView,
  PressView,
  PrivacyView,
  TermsView,
} from "./estatehat-platform-alpha.jsx";

const PUBLIC_VIEWS = {
  about: { title: "About EstateHat", Component: AboutView },
  help: { title: "EstateHat Help Center", Component: HelpView },
  faq: { title: "EstateHat FAQ & Scope", Component: FAQView },
  invest: { title: "Invest in EstateHat", Component: InvestView },
  press: { title: "EstateHat Press", Component: PressView },
  terms: { title: "EstateHat Terms of Service", Component: TermsView },
  privacy: { title: "EstateHat Privacy Policy", Component: PrivacyView },
  accessibility: { title: "EstateHat Accessibility", Component: AccessibilityView },
  dmca: { title: "EstateHat DMCA Policy", Component: DmcaView },
};

function fallbackRoute() {
  if (typeof document !== "undefined" && document.referrer) {
    const referrer = new URL(document.referrer);
    if (referrer.origin === window.location.origin && referrer.pathname) {
      return `${referrer.pathname}${referrer.search}`;
    }
  }
  return "/";
}

export default function PublicBoilerplatePage({ initialView = "about" }) {
  const router = useRouter();
  const view = PUBLIC_VIEWS[initialView] ? initialView : "about";
  const selected = PUBLIC_VIEWS[view];
  const SelectedComponent = selected.Component;

  useEffect(() => {
    document.title = selected.title;
  }, [selected.title]);

  function handleNavigate(target) {
    if (PUBLIC_VIEWS[target]) {
      router.push(`/${target}`);
      return;
    }
    if (target === "dashboard") {
      window.location.assign(fallbackRoute());
    }
  }

  function handleOpenPublicPage(target) {
    if (PUBLIC_VIEWS[target]) {
      router.push(`/${target}`);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f4efe6", padding: "24px 0 48px" }}>
      <SelectedComponent onNavigate={handleNavigate} />
      <div style={{ padding: "0 24px" }}>
        <EstateHatPublicFooter
          onCreateAccount={() => router.push("/signin?mode=signup")}
          onSignIn={() => router.push("/signin")}
          onOpenApp={() => router.push("/home")}
          onOpenPublicPage={handleOpenPublicPage}
          isAuthenticated={false}
        />
      </div>
    </div>
  );
}
