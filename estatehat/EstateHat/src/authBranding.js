const SHARED_DEFAULT = {
  appName: "EstateHat",
  tagline: "Private real estate, handled with clarity.",
  accentBadge: "Access welcome",
  heroHeadline: "Buy, sell, and move forward without getting lost.",
  heroDescription:
    "This screen helps buyers, sellers, and the people helping them stay on top of homes, paperwork, and next steps without any extra fuss.",
  heroFooter: "From your first showing to closing day, everything stays easier to follow.",
  slogan: "",
  termsCopy: (name) => `By continuing, you agree to ${name}'s sign-in, identity, and account protection steps.`,
  callouts: [
    {
      title: "Guided home search",
      desc: "Bookmark listings, compare offers, and keep track of tours without bouncing between tools.",
    },
    {
      title: "Transparent deal flow",
      desc: "Your documents, escrow updates, and next steps stay visible in a single place.",
    },
    {
      title: "Gentle support",
      desc: "Reset your password or re-enter the house plan with a single tap.",
    },
  ],
};

const BRAND_TEMPLATES = {
  estatehat: {
    appName: "EstateHat",
    tagline: "Private real estate, handled with care.",
    accentBadge: "EstateHat Access",
    heroHeadline: "Buy, sell, and move forward without getting lost.",
    heroDescription:
      "This screen is for people buying a home, selling a home, or helping with the sale. Sign in, create your account, or get back in from one simple place.",
    heroFooter: "Every step, from listing to closing, stays in one easy-to-follow place.",
    slogan: "",
    termsCopy: (name) => `By continuing, you agree to ${name}'s sign-in, identity, and account protection steps.`,
    callouts: SHARED_DEFAULT.callouts,
  },
};

function normalizeTermsCopy(termsCopy) {
  if (typeof termsCopy === "function") {
    return termsCopy;
  }

  if (typeof termsCopy === "string") {
    return () => termsCopy;
  }

  return SHARED_DEFAULT.termsCopy;
}

export function mergeAuthBranding(brandingOverrides = {}) {
  const merged = {
    ...SHARED_DEFAULT,
    ...brandingOverrides,
  };
  merged.callouts = Array.isArray(brandingOverrides.callouts)
    ? brandingOverrides.callouts
    : SHARED_DEFAULT.callouts;
  merged.termsCopy = normalizeTermsCopy(brandingOverrides.termsCopy ?? merged.termsCopy);
  return merged;
}

export function getAuthBrandingTemplate(key) {
  if (key && BRAND_TEMPLATES[key]) {
    return mergeAuthBranding(BRAND_TEMPLATES[key]);
  }
  return mergeAuthBranding(BRAND_TEMPLATES.estatehat);
}
