import { useState, useEffect, useRef, useCallback, useMemo, memo, lazy, Suspense } from "react";
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  orderBy, 
  where, 
  doc, 
  setDoc 
} from "firebase/firestore";
import { auth, db } from "./firebase.js";
import { postSquareAction, postStripeAction } from "./backend-api.js";
import { loadUserProfile, submitListingForReview, subscribeToFeaturedPlacements, subscribeToListings } from "./backend.js";
import {
  AdminWorkbenchView,
  ConfirmDialog,
  DocumentVaultView,
  NotificationCenterView,
  OfferComposerView,
  PropertyComparisonView,
  ToastHost,
  TourSchedulerView,
  TransactionMilestonesView,
  UniversalSearchView,
} from "./GuiFeatureViews.jsx";
import { EstateHatComponentSuiteView } from "./AdditionalComponents.jsx";
import EstateHatFinancialTools from "./EstateHatFinancialTools.jsx";
import { SimpleImageBand } from "./EstateHatImagery.jsx";

const EstateHatUxSuiteView = lazy(() => import("./EstateHatUxSuite.jsx"));
const EstateHatMoveKitView = lazy(() => import("./EstateHatMoveKit.jsx").then((module) => ({ default: module.EstateHatMoveKitView })));
const ESTATEHAT_UX_FEATURE_COUNT = 94;
const ESTATEHAT_MOVE_KIT_COUNT = 50;

// ─── PERFORMANCE UTILITIES ───────────────

// Debounce hook — prevents search from firing on every keystroke
function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function useMediaQuery(query) {
  const getMatches = () => (typeof window !== "undefined" ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    const media = window.matchMedia(query);
    const handleChange = () => setMatches(media.matches);
    handleChange();
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}

function isFeaturedPlacementActive(placement) {
  if (!placement || placement.status !== "active") return false;
  const endsAt = placement.endsAt;
  if (!endsAt) return true;
  const endsAtMs = typeof endsAt?.toMillis === "function"
    ? endsAt.toMillis()
    : Date.parse(String(endsAt || ""));
  return !Number.isFinite(endsAtMs) || endsAtMs > Date.now();
}

function featuredPlacementMatchesListing(placement, listing) {
  if (!placement || placement.placementType !== "listing" || !listing) return false;
  const targetListingId = String(placement.targetListingId || "").trim();
  const targetSubmissionId = String(placement.targetSubmissionId || "").trim();
  return (
    (targetListingId && targetListingId === listing.id) ||
    (targetSubmissionId && (targetSubmissionId === listing.id || targetSubmissionId === listing.reviewSubmissionId))
  );
}

function getActiveFeaturedPlacements(placements = [], placementType = "") {
  return (Array.isArray(placements) ? placements : []).filter((placement) => {
    if (!isFeaturedPlacementActive(placement)) return false;
    return placementType ? placement.placementType === placementType : true;
  }).sort((a, b) => {
    const aEnds = typeof a?.endsAt?.toMillis === "function" ? a.endsAt.toMillis() : Date.parse(String(a?.endsAt || ""));
    const bEnds = typeof b?.endsAt?.toMillis === "function" ? b.endsAt.toMillis() : Date.parse(String(b?.endsAt || ""));
    const safeA = Number.isFinite(aEnds) ? aEnds : Number.MAX_SAFE_INTEGER;
    const safeB = Number.isFinite(bEnds) ? bEnds : Number.MAX_SAFE_INTEGER;
    return safeA - safeB;
  });
}

function buildFeaturedListingIdSet(listings = [], placements = []) {
  if (!Array.isArray(placements) || placements.length === 0 || !Array.isArray(listings) || listings.length === 0) {
    return new Set();
  }

  const targets = new Set();
  for (const placement of placements) {
    if (placement?.placementType !== "listing" || !isFeaturedPlacementActive(placement)) continue;
    const listingId = String(placement.targetListingId || "").trim();
    const submissionId = String(placement.targetSubmissionId || "").trim();
    if (listingId) targets.add(listingId);
    if (submissionId) targets.add(submissionId);
  }

  if (!targets.size) return new Set();

  const listingIds = new Set();
  for (const listing of listings) {
    if (targets.has(String(listing?.id || "")) || targets.has(String(listing?.reviewSubmissionId || ""))) {
      listingIds.add(listing.id);
    }
  }
  return listingIds;
}

function featuredServiceRoleLabel(role = "") {
  const normalized = String(role || "").trim();
  return MATCH_ROLE_LABELS[normalized] || ACCOUNT_TYPES.find((entry) => entry.key === normalized)?.label || "Service Provider";
}

const FEATURED_LISTING_PRICE_LABEL = "$99 / 30 days";
const FEATURED_SERVICE_PRICE_LABEL = "$59 / 30 days";

function formatFeaturedPlacementWindow(placement) {
  if (!placement?.endsAt) return "Active now";
  const raw = typeof placement.endsAt?.toDate === "function"
    ? placement.endsAt.toDate()
    : new Date(placement.endsAt);
  if (!(raw instanceof Date) || Number.isNaN(raw.getTime())) return "Active now";
  return `Active through ${raw.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

function detectOperatingSystem() {
  if (typeof navigator === "undefined") {
    return { os: "unknown", label: "Unknown OS", shortLabel: "Web", isMobileOs: false };
  }

  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const touchPoints = navigator.maxTouchPoints || 0;
  const iPadDesktopMode = /Mac/i.test(platform) && touchPoints > 1;

  if (/iPhone|iPad|iPod/i.test(ua) || iPadDesktopMode) return { os: "ios", label: "iOS / iPadOS", shortLabel: "iOS", isMobileOs: true };
  if (/Android/i.test(ua)) return { os: "android", label: "Android", shortLabel: "Android", isMobileOs: true };
  if (/Win/i.test(platform)) return { os: "windows", label: "Windows", shortLabel: "Windows", isMobileOs: false };
  if (/Mac/i.test(platform)) return { os: "macos", label: "macOS", shortLabel: "macOS", isMobileOs: false };
  if (/Linux/i.test(platform)) return { os: "linux", label: "Linux", shortLabel: "Linux", isMobileOs: false };
  return { os: "web", label: "Web Browser", shortLabel: "Web", isMobileOs: false };
}

function useOperatingSystem() {
  const [device, setDevice] = useState(detectOperatingSystem);

  useEffect(() => {
    const update = () => setDevice(detectOperatingSystem());
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return device;
}

function useLocalStorageState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore persistence failures and keep the in-memory state.
    }
  }, [key, value]);

  return [value, setValue];
}

function savedSearchLabel(search) {
  const parts = [];
  if (search.search) parts.push(search.search);
  if (search.type && search.type !== "All") parts.push(search.type);
  if (search.priceRange && search.priceRange !== "all") parts.push(search.priceRange.replace("to", " to "));
  if (search.verifiedOnly) parts.push("verified");
  return parts.join(" · ") || "All listings";
}

function redirectToStripeUrl(url) {
  if (!url) {
    throw new Error("Stripe did not return a redirect URL.");
  }
  window.location.assign(url);
}

const HOUSING_TREND_SERIES = [
  {
    id: "CSUSHPINSA",
    label: "Home Price Index",
    unit: "index",
    source: "S&P CoreLogic Case-Shiller via FRED",
    format: (value) => Number(value).toFixed(1),
  },
  {
    id: "ESALEUSQ176N",
    label: "Vacant Inventory For Sale",
    unit: "thousands",
    source: "U.S. Census Bureau via FRED",
    format: (value) => `${Number(value).toLocaleString()}K`,
  },
];

const FRED_TIMEOUT_MS = 8000;
const HOUSING_TREND_FALLBACK_ITEMS = [
  {
    id: "CENSUS_MEDIAN_PRICE",
    label: "Median New-Home Price",
    unit: "USD",
    source: "U.S. Census Bureau / HUD New Residential Sales release",
    date: "2026-01",
    value: 400500,
    displayValue: "$400,500",
    change: -29200,
    changePct: -6.8,
  },
  {
    id: "CENSUS_FOR_SALE",
    label: "New Houses For Sale",
    unit: "thousands",
    source: "U.S. Census Bureau / HUD New Residential Sales release",
    date: "2026-01",
    value: 476,
    displayValue: "476K",
    change: -20,
    changePct: -4.0,
  },
];

function parseFredCsv(csv) {
  return String(csv || "")
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => {
      const [date, rawValue] = line.split(",");
      const value = Number(rawValue);
      if (!date || rawValue === "." || !Number.isFinite(value)) return null;
      return { date, value };
    })
    .filter(Boolean);
}

async function fetchFredSeries(seriesId) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FRED_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}`, {
      headers: { Accept: "text/csv" },
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`FRED ${seriesId} timed out.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
  if (!response.ok) throw new Error(`FRED ${seriesId} request failed.`);
  const rows = parseFredCsv(await response.text());
  if (rows.length === 0) throw new Error(`FRED ${seriesId} returned no observations.`);
  const latest = rows[rows.length - 1];
  const previous = rows.slice(0, -1).reverse().find((row) => Number.isFinite(row.value));
  const change = previous ? latest.value - previous.value : null;
  const changePct = previous && previous.value !== 0 ? (change / previous.value) * 100 : null;
  return { latest, previous, change, changePct };
}

// Skeleton loader for async content
function Skeleton({ width = "100%", height = 20, radius = 8, style: sx }) {
  return (
    <div style={{
      width, height, borderRadius: radius, background: `linear-gradient(90deg, ${S.surface} 25%, ${S.surfaceAlt} 50%, ${S.surface} 75%)`,
      backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite",
      ...sx,
    }} />
  );
}

// Inject shimmer animation once
const SHIMMER_CSS = `@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`;

// Theme CSS variables
const THEME_CSS = `
:root {
  color-scheme: light;
  --s-bg:#F6F7F5; --s-card:#FFFFFF; --s-surface:#ECEFED; --s-surface-alt:#F2F4F2; --s-dark:#171A17; --s-mid:#2E332F; --s-muted:#4F5A51; --s-light:#5F6A62; --s-text:#171A17; --s-text-soft:#4F5A51; --s-text-inverse:#F6F7F5; --s-primary:#171A17; --s-primary-mid:#2E332F; --s-primary-contrast:#FFFFFF; --s-nav-text:#F8F1E7;
  --s-border:rgba(23,26,23,0.10); --s-border-strong:#C7D0C8; --s-gold:#C89B42; --s-gold-deep:#8F681E; --s-green:#226B4A; --s-red:#B33A3A;
  --s-greenBg:#E4F3EB; --s-redBg:#F8E6E6; --s-goldBg:rgba(200,155,66,0.14); --s-blue:#326FA8; --s-blueBg:#E6F0F8; --s-violet:#6B5CA8; --s-violetBg:#EFECFA; --s-orange:#C16434; --s-orangeBg:#F8E9E2;
  --s-nav:#111511; --s-input-bg:#FFFFFF; --s-input-border:#CCD5CD; --s-focus:#C89B42; --s-overlay:rgba(10,12,10,0.50); --s-shadow-soft:rgba(16,24,18,0.07); --s-shadow-strong:rgba(16,24,18,0.20);
}
:root.dark {
  color-scheme: dark;
  --s-bg:#101210; --s-card:#171A17; --s-surface:#202620; --s-surface-alt:#252B25; --s-dark:#F0F4F0; --s-mid:#DCE4DD; --s-muted:#AEB9B0; --s-light:#8F9A92; --s-text:#F0F4F0; --s-text-soft:#AEB9B0; --s-text-inverse:#171A17; --s-primary:#0C0F0C; --s-primary-mid:#1E261F; --s-primary-contrast:#F6F7F5; --s-nav-text:#F4EADC;
  --s-border:rgba(240,244,240,0.10); --s-border-strong:#3D493F; --s-gold:#D2A64E; --s-gold-deep:#E0BE73; --s-green:#62B485; --s-red:#E06A6A;
  --s-greenBg:#14241B; --s-redBg:#2A1717; --s-goldBg:rgba(210,166,78,0.14); --s-blue:#78AEE0; --s-blueBg:#152332; --s-violet:#B5A7E7; --s-violetBg:#251F36; --s-orange:#E59A6A; --s-orangeBg:#311D14;
  --s-nav:#0C0F0C; --s-input-bg:#1C211C; --s-input-border:#3B453D; --s-focus:#D2A64E; --s-overlay:rgba(0,0,0,0.56); --s-shadow-soft:rgba(0,0,0,0.24); --s-shadow-strong:rgba(0,0,0,0.38);
}
:root[data-estatehat-theme="matrix-green"] {
  color-scheme: dark;
  --s-bg:#020402; --s-card:#071107; --s-surface:#0b190b; --s-surface-alt:#102210; --s-dark:#7CFF89; --s-mid:#54D960; --s-muted:#38B643; --s-light:#23942D; --s-text:#7CFF89; --s-text-soft:#54D960; --s-text-inverse:#031103; --s-primary:#031103; --s-primary-mid:#0b190b; --s-primary-contrast:#7CFF89; --s-nav-text:#7CFF89;
  --s-border:rgba(124,255,137,0.14); --s-border-strong:rgba(124,255,137,0.34); --s-gold:#7CFF89; --s-gold-deep:#B4FFBA; --s-green:#7CFF89; --s-red:#7CFF89;
  --s-greenBg:rgba(42,122,49,0.18); --s-redBg:rgba(30,85,35,0.18); --s-goldBg:rgba(124,255,137,0.12); --s-blue:#7CFF89; --s-blueBg:rgba(18,53,22,0.28); --s-violet:#7CFF89; --s-violetBg:rgba(18,53,22,0.28); --s-orange:#7CFF89; --s-orangeBg:rgba(18,53,22,0.28);
  --s-nav:#010301; --s-input-bg:#031103; --s-input-border:rgba(124,255,137,0.26); --s-focus:#7CFF89; --s-overlay:rgba(0,0,0,0.72); --s-shadow-soft:rgba(0,0,0,0.38); --s-shadow-strong:rgba(0,0,0,0.54);
}
:root[data-estatehat-theme="matrix-blue"] {
  color-scheme: dark;
  --s-bg:#020408; --s-card:#071120; --s-surface:#0c1830; --s-surface-alt:#12203b; --s-dark:#7FDBFF; --s-mid:#58B6FF; --s-muted:#3694E6; --s-light:#2872B7; --s-text:#7FDBFF; --s-text-soft:#58B6FF; --s-text-inverse:#05101d; --s-primary:#05101d; --s-primary-mid:#0c1830; --s-primary-contrast:#7FDBFF; --s-nav-text:#7FDBFF;
  --s-border:rgba(127,219,255,0.15); --s-border-strong:rgba(127,219,255,0.34); --s-gold:#7FDBFF; --s-gold-deep:#B6ECFF; --s-green:#7FDBFF; --s-red:#7FDBFF;
  --s-greenBg:rgba(28,70,117,0.18); --s-redBg:rgba(28,70,117,0.18); --s-goldBg:rgba(127,219,255,0.12); --s-blue:#7FDBFF; --s-blueBg:rgba(18,42,76,0.3); --s-violet:#7FDBFF; --s-violetBg:rgba(18,42,76,0.3); --s-orange:#7FDBFF; --s-orangeBg:rgba(18,42,76,0.3);
  --s-nav:#01040A; --s-input-bg:#05101d; --s-input-border:rgba(127,219,255,0.26); --s-focus:#7FDBFF; --s-overlay:rgba(0,0,0,0.72); --s-shadow-soft:rgba(0,0,0,0.4); --s-shadow-strong:rgba(0,0,0,0.56);
}
html, body {
  background: var(--s-bg);
  color: var(--s-dark);
  transition: background-color 0.2s ease, color 0.2s ease;
}
body::selection {
  background: rgba(212,160,83,0.24);
}
input:focus, select:focus, textarea:focus { border-color: var(--s-focus) !important; box-shadow: 0 0 0 3px rgba(212,160,83,0.15); transition: all 0.2s ease; }
input, select, textarea {
  background: var(--s-input-bg);
  color: var(--s-text);
  border-color: var(--s-input-border);
}
input::placeholder, textarea::placeholder {
  color: var(--s-text-soft);
  opacity: 0.78;
}
.estatehat-shell {
  background: transparent;
  color: var(--s-text);
}
.estatehat-nav {
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}
.estatehat-shell :focus-visible {
  outline: 3px solid var(--s-focus);
  outline-offset: 3px;
}
.estatehat-dashboard {
  max-width: 1360px !important;
  padding: clamp(16px, 2.4vw, 32px) !important;
}
.estatehat-dashboard > .estatehat-dashboard-next {
  border-radius: 20px !important;
  border: 1px solid var(--s-border-strong) !important;
  background: linear-gradient(135deg, var(--s-card), var(--s-surface-alt)) !important;
  box-shadow: 0 16px 40px var(--s-shadow-soft) !important;
}
.estatehat-dashboard-next-track {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--s-surface);
}
.estatehat-dashboard-next-track > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--s-green), var(--s-gold));
  transition: width 240ms ease;
}
.estatehat-shell .estatehat-dashboard button {
  transition: transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease;
}
.estatehat-shell .estatehat-dashboard button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px var(--s-shadow-soft);
}
@media (prefers-reduced-motion: reduce) {
  .estatehat-shell *, .estatehat-shell *::before, .estatehat-shell *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  .estatehat-shell button:hover:not(:disabled) { transform: none !important; }
}
.estatehat-palette-scrim {
  position: fixed;
  inset: 0;
  background: rgba(16, 12, 8, 0.44);
  z-index: 220;
}
.estatehat-palette {
  position: fixed;
  left: 50%;
  top: 84px;
  transform: translateX(-50%);
  width: min(620px, calc(100vw - 28px));
  border-radius: 12px;
  border: 1px solid var(--s-border);
  background: color-mix(in srgb, var(--s-card) 94%, transparent);
  box-shadow: 0 30px 80px var(--s-shadow-strong);
  z-index: 221;
  overflow: hidden;
}
.estatehat-palette-item:hover {
  border-color: var(--s-border-strong);
  transform: translateY(-1px);
}
.estatehat-shell,
.estatehat-shell * {
  min-width: 0;
}
.estatehat-shell button,
.estatehat-shell input,
.estatehat-shell select,
.estatehat-shell textarea {
  max-width: 100%;
}
.estatehat-shell button {
  min-height: 40px;
  touch-action: manipulation;
}
.estatehat-shell img,
.estatehat-shell video,
.estatehat-shell canvas {
  max-width: 100%;
}
.estatehat-image-band {
  max-width: 100%;
}
.estatehat-image-band img {
  min-height: 0;
}
.estatehat-shell [style*="grid-template-columns"] {
  min-width: 0;
}
.estatehat-shell [style*="display: flex"] {
  min-width: 0;
}
.estatehat-shell [style*="grid-template-columns"] > *,
.estatehat-shell [style*="display: grid"] > *,
.estatehat-shell [style*="display: flex"] > * {
  min-width: 0;
  max-width: 100%;
}
.estatehat-shell [style*="white-space: nowrap"] {
  max-width: 100%;
}
.estatehat-device-chip {
  border: 1px solid var(--s-border-strong);
  border-radius: 8px;
  padding: 4px 8px;
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 10px;
  font-weight: 800;
  color: var(--s-nav-text);
  background: rgba(255,255,255,0.05);
  white-space: nowrap;
}
.estatehat-responsive-workspace {
  width: min(1240px, calc(100vw - 36px));
  margin-left: auto;
  margin-right: auto;
}
.estatehat-workspace-header,
.estatehat-workspace-layout,
.estatehat-summary-grid,
.estatehat-tile-grid {
  min-width: 0;
}
.estatehat-shell[data-layout-mode="desktop"] .estatehat-workspace-layout,
.estatehat-shell[data-layout-mode="desktop"] [style*="grid-template-columns"] {
  align-items: start;
}
.estatehat-shell[data-layout-mode="desktop"] .estatehat-tile-grid {
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)) !important;
}
.estatehat-shell[data-layout-mode="desktop"] .estatehat-summary-grid {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)) !important;
}
.estatehat-shell[data-layout-mode="desktop"] .estatehat-no-overlap {
  overflow: hidden;
  overflow-wrap: anywhere;
}
@media (min-width: 1440px) {
  .estatehat-shell {
    --estatehat-page-gutter: 32px;
  }
  .estatehat-shell > div[style*="max-width: 960px"],
  .estatehat-shell > div[style*="max-width: 980px"],
  .estatehat-shell > div[style*="max-width: 1100px"],
  .estatehat-shell > div[style*="max-width: 1200px"],
  .estatehat-shell > main[style*="max-width"] {
    max-width: min(1320px, calc(100vw - 64px)) !important;
  }
  .estatehat-shell [style*="grid-template-columns: repeat(auto-fit"] {
    gap: 18px !important;
  }
}
@media (max-width: 820px) {
  html,
  body,
  #root {
    min-height: 100%;
  }
  body {
    overflow-x: hidden;
    overscroll-behavior-y: none;
  }
  .estatehat-shell {
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
  .estatehat-nav {
    align-items: stretch !important;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
  }
  .estatehat-nav::-webkit-scrollbar {
    display: none;
  }
  .estatehat-nav > div:first-child {
    position: sticky;
    left: 0;
    z-index: 2;
    background: inherit;
    padding-right: 4px;
  }
  .estatehat-nav > div:nth-child(2) {
    gap: 8px !important;
    padding-bottom: 2px;
  }
  .estatehat-nav button {
    min-height: 42px !important;
    white-space: nowrap;
  }
  .estatehat-shell > div[style*="padding: 24px"],
  .estatehat-shell > main[style*="padding"] {
    padding: 16px 12px !important;
  }
  .estatehat-shell [style*="grid-template-columns"] {
    grid-template-columns: minmax(0, 1fr) !important;
  }
  .estatehat-shell[data-layout-mode="mobile"] .estatehat-responsive-workspace {
    width: 100%;
    padding: 12px 10px 22px !important;
  }
  .estatehat-shell[data-layout-mode="mobile"] .estatehat-workspace-header,
  .estatehat-shell[data-layout-mode="mobile"] .estatehat-workspace-layout,
  .estatehat-shell[data-layout-mode="mobile"] .estatehat-summary-grid,
  .estatehat-shell[data-layout-mode="mobile"] .estatehat-tile-grid {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) !important;
    gap: 12px !important;
  }
  .estatehat-shell[data-layout-mode="mobile"] .estatehat-tile-grid > *,
  .estatehat-shell[data-layout-mode="mobile"] .estatehat-summary-grid > * {
    border-radius: 8px !important;
    width: 100% !important;
  }
  .estatehat-shell[data-layout-mode="mobile"] .estatehat-sticky-panel {
    position: static !important;
  }
  .estatehat-shell[data-os="ios"],
  .estatehat-shell[data-os="android"] {
    -webkit-text-size-adjust: 100%;
  }
  .estatehat-shell [style*="display: flex"] {
    flex-wrap: wrap !important;
  }
  .estatehat-shell [style*="justify-content: space-between"] {
    gap: 10px !important;
  }
  .estatehat-shell [style*="font-size: 38px"],
  .estatehat-shell [style*="font-size: 36px"],
  .estatehat-shell [style*="font-size: 34px"],
  .estatehat-shell [style*="font-size: 32px"] {
    font-size: 28px !important;
    line-height: 1.08 !important;
  }
  .estatehat-shell input,
  .estatehat-shell select,
  .estatehat-shell textarea {
    min-height: 44px;
    font-size: 16px !important;
  }
  .estatehat-shell button {
    min-height: 44px;
  }
  .estatehat-image-band {
    grid-template-columns: minmax(0, 1fr) !important;
    height: auto !important;
  }
  .estatehat-image-band img {
    height: 132px !important;
  }
  .estatehat-palette {
    top: auto;
    left: 10px;
    right: 10px;
    bottom: calc(10px + env(safe-area-inset-bottom, 0px));
    width: auto;
    max-height: min(72vh, 620px);
    transform: none;
    overflow-y: auto;
  }
  footer {
    padding: 32px 16px 24px !important;
    margin-top: 40px !important;
  }
}
@media (max-width: 430px) {
  .estatehat-shell > div[style*="padding: 24px"],
  .estatehat-shell > main[style*="padding"] {
    padding: 12px 10px !important;
  }
  .estatehat-nav {
    padding: 8px 10px !important;
    min-height: 62px !important;
  }
  .estatehat-nav button {
    padding-left: 10px !important;
    padding-right: 10px !important;
  }
  .estatehat-shell [style*="font-size: 28px"],
  .estatehat-shell [style*="font-size: 30px"],
  .estatehat-shell [style*="font-size: 32px"] {
    font-size: 24px !important;
  }
}
`;

// Error boundary as a function (wraps children)
function ErrorFallback({ error }) {
  return (
    <div style={{ padding: 40, textAlign: "center", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
      <h2 style={{ fontSize: 22, color: S.dark, marginBottom: 8 }}>Something went wrong</h2>
      <p style={{ fontSize: 14, color: S.muted, marginBottom: 16 }}>{error?.message || "An unexpected error occurred."}</p>
      <button onClick={() => window.location.reload()} style={{ background: S.gold, color: "#171A17", border: "none", borderRadius: 12, padding: "12px 24px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
        Reload App
      </button>
    </div>
  );
}

// ─── FONTS ───────────────────────────────
const FONT_LINK = "https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap";
const THEME_MODE_STORAGE_KEY = "estatehat-theme";
const LEGACY_DARK_STORAGE_KEY = "estatehat-dark";
const THEME_MODES = ["light", "dark", "matrix-green", "matrix-blue"];
const THEME_MODE_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "matrix-green", label: "Matrix Green" },
  { value: "matrix-blue", label: "Matrix Blue" },
];

function resolveInitialThemeMode() {
  if (typeof window === "undefined") return "light";
  const storedTheme = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);
  if (THEME_MODES.includes(storedTheme)) return storedTheme;
  return window.localStorage.getItem(LEGACY_DARK_STORAGE_KEY) === "true" ? "dark" : "light";
}

// ─── CONSTANTS ───────────────────────────
const ACCOUNT_TYPES = [
  { key: "buyer", label: "Buyer", icon: "🏠", desc: "Browse, make offers, and purchase properties" },
  { key: "seller", label: "Seller", icon: "💰", desc: "List properties and manage offers from buyers" },
  { key: "corp_buyer", label: "Corporate Buyer", icon: "🏢", desc: "Purchase properties on behalf of an LLC, corporation, trust, or investment group" },
  { key: "corp_seller", label: "Corporate Seller", icon: "🏗", desc: "List and sell properties held by an LLC, corporation, trust, or institutional entity" },
  { key: "attorney", label: "Attorney", icon: "⚖️", desc: "Review contracts, handle closings, and legal compliance" },
  { key: "agent", label: "Licensed Agent", icon: "🔑", desc: "Represent buyers or sellers in transactions" },
  { key: "inspector", label: "Inspector", icon: "🔍", desc: "Provide inspection reports and property assessments" },
  { key: "lender", label: "Lender / Bank", icon: "🏦", desc: "Process mortgage applications and fund transactions" },
  { key: "admin", label: "Administrator", icon: "🛡️", desc: "Platform oversight, verification review, and compliance management" },
  { key: "webmaster", label: "Webmaster", icon: "🧰", desc: "Website operations, content maintenance, and platform support access" },
  { key: "gov_municipality", label: "Municipality Government", icon: "🏛️", desc: "Municipal public administration and compliance oversight" },
  { key: "gov_township", label: "Township Government", icon: "🏛️", desc: "Township-level public administration and compliance oversight" },
  { key: "gov_county", label: "County Government", icon: "🏛️", desc: "County-level public administration and compliance oversight" },
  { key: "gov_borough", label: "Borough Government", icon: "🏛️", desc: "Borough-level public administration and compliance oversight" },
  { key: "gov_parish", label: "Parish Government", icon: "🏛️", desc: "Parish-level public administration and compliance oversight" },
  { key: "gov_state", label: "State Government", icon: "🏛️", desc: "State-level public administration and compliance oversight" },
  { key: "gov_territory", label: "Territory Government", icon: "🏛️", desc: "Territory-level public administration and compliance oversight" },
  { key: "gov_federal", label: "Federal Government", icon: "🏛️", desc: "Federal public administration and compliance oversight" },
];

const ROLE_BLUEPRINTS = {
  buyer: {
    label: "Buyer Desk",
    responsibilities: ["Verify identity and funding readiness", "Track listings, offers, and escrow milestones", "Keep required documents current before closing"],
    securityFocus: ["Enable login alerts before submitting offers", "Use trusted-device protection for document access", "Review account health before sending funds"],
    operationalAccess: ["Browse listings and save searches", "Make offers and manage transaction activity", "Use financial tools and receipts when available"],
  },
  seller: {
    label: "Seller Desk",
    responsibilities: ["Maintain accurate listing data and photos", "Respond to buyer questions and document requests", "Complete seller-side verification before closing"],
    securityFocus: ["Protect listing updates with trusted-device checks", "Review alerts before changing payout details", "Keep transaction-facing contact data current"],
    operationalAccess: ["Manage listings and buyer conversations", "Monitor closing requirements and fees", "Access receipts and transaction workflow"],
  },
  corp_buyer: {
    label: "Corporate Buyer Desk",
    responsibilities: ["Maintain entity documents and signer approvals", "Verify proof of funds and entity standing", "Coordinate internal signer responsibilities before closing"],
    securityFocus: ["Restrict access to trusted devices for signer records", "Enable login alerts for all entity-side reviews", "Keep session limits tighter around document uploads"],
    operationalAccess: ["Browse and save inventory as an entity buyer", "Track entity verification and signer readiness", "Access transaction and financial workflow"],
  },
  corp_seller: {
    label: "Corporate Seller Desk",
    responsibilities: ["Maintain entity ownership and listing authority records", "Coordinate listing updates across authorized signers", "Clear seller-side compliance issues before closing"],
    securityFocus: ["Use login alerts for signer and payout changes", "Review trusted-device status before editing entity details", "Limit session exposure on shared machines"],
    operationalAccess: ["Manage listings and seller transaction workflow", "Track entity verification and signer readiness", "Access receipts and closing-related controls"],
  },
  attorney: {
    label: "Attorney Desk",
    responsibilities: ["Review contracts, title, and closing readiness", "Maintain independent legal role separation", "Document approvals and exceptions clearly"],
    securityFocus: ["Protect privileged document review with trusted-device access", "Enable login alerts for every legal-session sign-in", "Keep short session timeouts on shared office devices"],
    operationalAccess: ["Participate in transactions and document workflows", "Use role-specific legal practice tools", "Review messages and approval checkpoints"],
  },
  agent: {
    label: "Agent Desk",
    responsibilities: ["Represent client interests without role conflicts", "Keep listings and showing information accurate", "Move buyer and seller tasks forward visibly"],
    securityFocus: ["Use login alerts before updating listing-facing data", "Protect saved workflow data on trusted devices only", "Review account health before sharing documents"],
    operationalAccess: ["Manage listings, tours, and transaction updates", "Use role-specific agent workflow tools", "Coordinate client messaging inside the platform"],
  },
  inspector: {
    label: "Inspector Desk",
    responsibilities: ["Deliver independent inspection records", "Keep licensing and report history current", "Avoid overlapping financial or representation roles"],
    securityFocus: ["Protect report uploads with trusted-device access", "Use login alerts for every field-device sign-in", "Keep report sessions short after uploads"],
    operationalAccess: ["Participate in transaction and document review", "Use inspection workflow tools", "Share report updates with other verified parties"],
  },
  lender: {
    label: "Lender Desk",
    responsibilities: ["Maintain funding and underwriting records", "Keep lender-side verification current", "Coordinate disbursement readiness without role conflicts"],
    securityFocus: ["Enable alerts before changing financial workflow settings", "Use trusted-device controls for bank-facing access", "Tighten session limits around funding steps"],
    operationalAccess: ["Participate in transaction and financial workflow", "Use lender-specific tools and receipts", "Coordinate closing readiness with verified parties"],
  },
  admin: {
    label: "Administrator Desk",
    responsibilities: ["Review verification, document, and transaction controls", "Escalate and resolve compliance blockers", "Protect separation of duties across the platform"],
    securityFocus: ["Use the strongest session controls available", "Keep login alerts enabled at all times", "Review account health before approving sensitive actions"],
    operationalAccess: ["Access admin oversight and escalations", "Review verification queues and transaction blockers", "Monitor system integrity across user roles"],
  },
  webmaster: {
    label: "Webmaster Desk",
    responsibilities: ["Maintain site operations and content integrity", "Support platform configuration without taking transaction roles", "Protect system-facing access and support workflows"],
    securityFocus: ["Use trusted-device protection for operational access", "Enable login alerts for all support sessions", "Maintain strict session timeout and document shielding"],
    operationalAccess: ["Access profile, listings, admin-level support surfaces", "Review operational health and support details", "Avoid buyer/seller financial execution paths"],
  },
  gov_municipality: {
    label: "Municipality Government Desk",
    responsibilities: ["Review municipality-level compliance and jurisdiction records", "Coordinate permitted government-side oversight actions", "Maintain public accountability and record quality"],
    securityFocus: ["Apply strict public-sector access controls", "Require full legal component completion before elevated actions", "Audit sensitive oversight interactions"],
    operationalAccess: ["Review listings and transaction activity in scope", "Use oversight communications and profile surfaces", "Coordinate with verified platform administrators"],
  },
  gov_township: {
    label: "Township Government Desk",
    responsibilities: ["Review township-level compliance and jurisdiction records", "Coordinate permitted government-side oversight actions", "Maintain public accountability and record quality"],
    securityFocus: ["Apply strict public-sector access controls", "Require full legal component completion before elevated actions", "Audit sensitive oversight interactions"],
    operationalAccess: ["Review listings and transaction activity in scope", "Use oversight communications and profile surfaces", "Coordinate with verified platform administrators"],
  },
  gov_county: {
    label: "County Government Desk",
    responsibilities: ["Review county-level compliance and jurisdiction records", "Coordinate permitted government-side oversight actions", "Maintain public accountability and record quality"],
    securityFocus: ["Apply strict public-sector access controls", "Require full legal component completion before elevated actions", "Audit sensitive oversight interactions"],
    operationalAccess: ["Review listings and transaction activity in scope", "Use oversight communications and profile surfaces", "Coordinate with verified platform administrators"],
  },
  gov_borough: {
    label: "Borough Government Desk",
    responsibilities: ["Review borough-level compliance and jurisdiction records", "Coordinate permitted government-side oversight actions", "Maintain public accountability and record quality"],
    securityFocus: ["Apply strict public-sector access controls", "Require full legal component completion before elevated actions", "Audit sensitive oversight interactions"],
    operationalAccess: ["Review listings and transaction activity in scope", "Use oversight communications and profile surfaces", "Coordinate with verified platform administrators"],
  },
  gov_parish: {
    label: "Parish Government Desk",
    responsibilities: ["Review parish-level compliance and jurisdiction records", "Coordinate permitted government-side oversight actions", "Maintain public accountability and record quality"],
    securityFocus: ["Apply strict public-sector access controls", "Require full legal component completion before elevated actions", "Audit sensitive oversight interactions"],
    operationalAccess: ["Review listings and transaction activity in scope", "Use oversight communications and profile surfaces", "Coordinate with verified platform administrators"],
  },
  gov_state: {
    label: "State Government Desk",
    responsibilities: ["Review state-level compliance and jurisdiction records", "Coordinate permitted government-side oversight actions", "Maintain public accountability and record quality"],
    securityFocus: ["Apply strict public-sector access controls", "Require full legal component completion before elevated actions", "Audit sensitive oversight interactions"],
    operationalAccess: ["Review listings and transaction activity in scope", "Use oversight communications and profile surfaces", "Coordinate with verified platform administrators"],
  },
  gov_territory: {
    label: "Territory Government Desk",
    responsibilities: ["Review territory-level compliance and jurisdiction records", "Coordinate permitted government-side oversight actions", "Maintain public accountability and record quality"],
    securityFocus: ["Apply strict public-sector access controls", "Require full legal component completion before elevated actions", "Audit sensitive oversight interactions"],
    operationalAccess: ["Review listings and transaction activity in scope", "Use oversight communications and profile surfaces", "Coordinate with verified platform administrators"],
  },
  gov_federal: {
    label: "Federal Government Desk",
    responsibilities: ["Review federal-level compliance and jurisdiction records", "Coordinate permitted government-side oversight actions", "Maintain public accountability and record quality"],
    securityFocus: ["Apply strict public-sector access controls", "Require full legal component completion before elevated actions", "Audit sensitive oversight interactions"],
    operationalAccess: ["Review listings and transaction activity in scope", "Use oversight communications and profile surfaces", "Coordinate with verified platform administrators"],
  },
};

function getAccountBlueprint(role) {
  return ROLE_BLUEPRINTS[role] || ROLE_BLUEPRINTS.buyer;
}

function formatProfileDate(value) {
  if (!value) return "Not yet recorded";
  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : value instanceof Date
        ? value
        : typeof value === "number"
          ? new Date(value)
          : typeof value === "string"
            ? new Date(value)
            : null;

  if (!date || Number.isNaN(date.getTime())) return "Not yet recorded";
  return date.toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function getReferralIncentiveState(verifiedBilling = {}, user = {}) {
  const incentive = verifiedBilling.referralIncentive || {};
  const credits = Array.isArray(incentive.credits) ? incentive.credits.slice(0, 12) : [];
  const earned = Math.min(12, Math.max(0, Number(incentive.earnedFreeMonths) || credits.filter((credit) => credit.status === "credited").length));
  const applied = Math.min(earned, Math.max(0, Number(incentive.appliedFreeMonths) || 0));
  const referralCode = incentive.referralCode || `EH-${String(user?.uid || user?.email || "member").replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase() || "MEMBER"}`;
  return {
    status: incentive.status || "available",
    maxFreeMonths: 12,
    earnedFreeMonths: earned,
    appliedFreeMonths: applied,
    availableFreeMonths: Math.max(0, earned - applied),
    referralCode,
    credits,
  };
}

const GOVERNMENT_ACCOUNT_TYPES = new Set(["gov_municipality", "gov_township", "gov_county", "gov_borough", "gov_parish", "gov_state", "gov_territory", "gov_federal"]);

const LEGAL_COMPONENT_DEFINITIONS = {
  terms_ack: { label: "Terms acknowledgement", desc: "Accept platform terms and member obligations." },
  privacy_ack: { label: "Privacy acknowledgement", desc: "Accept data handling and privacy disclosures." },
  disclosures_ack: { label: "Legal disclosures acknowledgement", desc: "Confirm required legal disclosures were reviewed." },
  electronic_records_consent: { label: "Electronic records consent", desc: "Consent to receive and retain electronic records/signatures." },
  non_brokerage_ack: { label: "Non-brokerage acknowledgment", desc: "Acknowledge EstateHat is not your licensed broker unless separately engaged." },
  fair_housing_attestation: { label: "Fair-housing attestation", desc: "Acknowledge anti-discrimination obligations in listings and transactions." },
  support_scope_attestation: { label: "Support scope attestation", desc: "Acknowledge support is operational guidance, not legal representation." },
  marketing_consent_attestation: { label: "Marketing consent attestation", desc: "Confirm consent records for marketing outreach are accurate and auditable." },
  platform_fee_disclosure_ack: { label: "Platform fee disclosure attestation", desc: "Acknowledge EstateHat surcharge and third-party provider fee disclosures." },
  funds_custody_boundary_ack: { label: "Funds custody boundary attestation", desc: "Acknowledge EstateHat does not custody funds and uses third-party rails." },
  identity_attestation: { label: "Identity attestation", desc: "Confirm profile identity and authority are accurate." },
  sanctions_screening: { label: "Sanctions and watchlist screening", desc: "Pass sanctions and restricted-party screening." },
  anti_fraud_ack: { label: "Anti-fraud attestation", desc: "Acknowledge anti-fraud policy and prohibited behavior." },
  license_in_good_standing: { label: "Professional license in good standing", desc: "Required for licensed service roles." },
  entity_authority: { label: "Entity authority attestation", desc: "Confirm authority to act for the organization." },
  funds_source_attestation: { label: "Source-of-funds attestation", desc: "Provide lawful source-of-funds declaration." },
  property_disclosure_ack: { label: "Property disclosure attestation", desc: "Acknowledge disclosure duties for listed properties." },
  aml_policy_ack: { label: "AML/KYC policy attestation", desc: "Acknowledge anti-money-laundering obligations." },
  government_authority: { label: "Government authority validation", desc: "Confirm office authority and jurisdictional scope." },
  records_officer_attestation: { label: "Public records officer attestation", desc: "Confirm records responsibility and point of contact." },
  ethics_attestation: { label: "Government ethics attestation", desc: "Acknowledge ethics and conflict restrictions." },
};

const CURRENT_POLICY_VERSIONS = {
  terms: "2026-04-11",
  privacy: "2026-04-11",
  disclosures: "2026-04-11",
};

const MARKETING_CONSENT_VERSION = "2026-04-11";

const STRICT_PRIVACY_OUTLIER_STATES = new Set([
  "CA", "CO", "CT", "DE", "IA", "IN", "KY", "MD", "MN", "MT",
  "NE", "NH", "NJ", "NY", "OR", "RI", "TN", "TX", "UT", "VA",
]);

const STRONG_MARKETING_CONSENT_STATES = new Set(["FL"]);
const US_TERRITORY_CODES = new Set(["PR", "GU", "VI"]);

const STRICT_COUNTY_KEYS = new Set([
  "NY|NEW YORK",
  "NY|KINGS",
  "NY|QUEENS",
  "NY|BRONX",
  "NY|RICHMOND",
  "CA|LOS ANGELES",
  "CA|SAN FRANCISCO",
  "CA|ALAMEDA",
  "CA|SANTA CLARA",
  "CA|SAN DIEGO",
  "IL|COOK",
  "WA|KING",
  "MD|MONTGOMERY",
  "FL|MIAMI-DADE",
  "FL|BROWARD",
  "PR|SAN JUAN",
  "GU|GUAM",
  "VI|ST. THOMAS",
  "VI|ST. CROIX",
  "VI|ST. JOHN",
]);

const STRICT_CITY_KEYS = new Set([
  "NY|NEW YORK",
  "CA|LOS ANGELES",
  "CA|SAN FRANCISCO",
  "IL|CHICAGO",
  "WA|SEATTLE",
  "MD|ROCKVILLE",
  "FL|MIAMI",
  "FL|FORT LAUDERDALE",
]);

const STRICT_MUNICIPALITY_KEYS = new Set([
  "NY|MANHATTAN BOROUGH",
  "NY|BROOKLYN BOROUGH",
  "NY|QUEENS BOROUGH",
  "NY|BRONX BOROUGH",
  "NY|STATEN ISLAND BOROUGH",
  "LA|ORLEANS PARISH",
]);

const COMPLIANCE_ADMIN_EMAILS = new Set([
  "administrator@estatehat.com",
  "webmaster@estatehat.com",
  "webmaster.login@estatehat.com",
]);

const LEGAL_EVIDENCE_OPTIONS = [
  { key: "attestation_statement", label: "Signed attestation statement" },
  { key: "verification_letter", label: "Verification letter" },
  { key: "policy_acknowledgement", label: "Policy acknowledgement record" },
  { key: "consent_capture", label: "Consent capture record" },
  { key: "screening_report", label: "Screening/report output" },
  { key: "license_record", label: "License/public registry record" },
  { key: "document_packet", label: "Document packet reference" },
];

const SOURCE_OF_FUNDS_EVIDENCE_OPTIONS = [
  { key: "statement", label: "Statement" },
  { key: "verification_letter", label: "Verification letter" },
];

function getLegalEvidenceOptionsForComponent(componentKey) {
  if (componentKey === "funds_source_attestation") return SOURCE_OF_FUNDS_EVIDENCE_OPTIONS;
  if (componentKey === "sanctions_screening") {
    return [
      { key: "screening_report", label: "Sanctions screening report" },
      { key: "verification_letter", label: "Verification letter" },
    ];
  }
  return LEGAL_EVIDENCE_OPTIONS;
}

function normalizeJurisdictionToken(value) {
  return String(value || "").trim().toUpperCase();
}

function deriveLocationComplianceOverlay(jurisdiction = {}) {
  const state = normalizeJurisdictionToken(jurisdiction.state || "NC");
  const county = normalizeJurisdictionToken(jurisdiction.county || "WAKE");
  const city = normalizeJurisdictionToken(jurisdiction.city || "RALEIGH");
  const municipality = normalizeJurisdictionToken(jurisdiction.municipality || "");
  const countyKey = `${state}|${county}`;
  const cityKey = `${state}|${city}`;
  const municipalityKey = `${state}|${municipality}`;
  const isBoroughOrParish = municipality.includes("BOROUGH") || municipality.includes("PARISH");
  const isTerritory = US_TERRITORY_CODES.has(state);
  const strictLocality =
    STRICT_COUNTY_KEYS.has(countyKey) ||
    STRICT_CITY_KEYS.has(cityKey) ||
    STRICT_MUNICIPALITY_KEYS.has(municipalityKey);

  const outlierFlags = {
    territoryOutlier: isTerritory,
    privacyOutlier: STRICT_PRIVACY_OUTLIER_STATES.has(state),
    marketingOutlier: STRONG_MARKETING_CONSENT_STATES.has(state),
    fairHousingOutlier: state === "NY" || state === "CA" || strictLocality,
    recordingOutlier: strictLocality,
    federalOutlier: true,
    counselReviewRequired: isTerritory || STRICT_PRIVACY_OUTLIER_STATES.has(state) || STRONG_MARKETING_CONSENT_STATES.has(state) || state === "NY" || state === "CA" || strictLocality,
  };

  const checklist = [
    "Apply strict_us_51 baseline controls",
    "Validate state-level privacy and breach timeline requirements",
    "Validate county recording package/forms and fees",
    "Log jurisdiction review timestamp for audit",
  ];
  if (isBoroughOrParish) checklist.push("Validate borough/parish local overlay requirements");
  if (isTerritory) checklist.push("Apply territory-specific legal and recording overlay (PR/GU/VI)");
  if (outlierFlags.fairHousingOutlier) checklist.push("Run enhanced fair-housing/source-of-income review");
  if (outlierFlags.marketingOutlier) checklist.push("Run enhanced SMS/telemarketing consent verification");
  if (outlierFlags.counselReviewRequired) checklist.push("Require counsel sign-off before activation");

  return { state, county, city, municipality, outlierFlags, checklist };
}

function inferJurisdictionFromAddress(address = "") {
  const text = String(address || "").trim();
  const stateZip = text.match(/,\s*([A-Za-z]{2})\s+(\d{5})(?:-\d{4})?\s*$/);
  const state = stateZip ? stateZip[1].toUpperCase() : "";
  const beforeState = stateZip ? text.slice(0, stateZip.index) : text;
  const segments = beforeState.split(",").map((part) => part.trim()).filter(Boolean);
  const city = segments.length > 1 ? segments[segments.length - 1] : "";

  return {
    state,
    city,
    county: "",
    municipality: "",
  };
}

function isLegalComponentVerificationValid(componentKey, componentState = {}) {
  const options = getLegalEvidenceOptionsForComponent(componentKey);
  const evidenceType = String(componentState?.evidenceType || "").trim();
  const hasSupportedType = options.some((option) => option.key === evidenceType);
  const hasReference = String(componentState?.notes || "").trim().length >= 8;
  const hasAttestation = !!componentState?.attested;
  return hasSupportedType && hasReference && hasAttestation;
}

function isLegalComponentComplete(componentKey, componentState = {}) {
  return !!componentState?.complete && isLegalComponentVerificationValid(componentKey, componentState);
}

function getRequiredLegalComponentsForRole(role) {
  const required = [
    "terms_ack",
    "privacy_ack",
    "disclosures_ack",
    "electronic_records_consent",
    "non_brokerage_ack",
    "fair_housing_attestation",
    "support_scope_attestation",
    "marketing_consent_attestation",
    "platform_fee_disclosure_ack",
    "funds_custody_boundary_ack",
    "identity_attestation",
    "sanctions_screening",
    "anti_fraud_ack",
  ];
  if (["attorney", "agent", "inspector", "lender"].includes(role)) required.push("license_in_good_standing");
  if (["corp_buyer", "corp_seller"].includes(role)) required.push("entity_authority");
  if (["buyer", "corp_buyer"].includes(role)) required.push("funds_source_attestation");
  if (["seller", "corp_seller"].includes(role)) required.push("property_disclosure_ack");
  if (role === "lender") required.push("aml_policy_ack");
  if (GOVERNMENT_ACCOUNT_TYPES.has(role)) required.push("government_authority", "records_officer_attestation", "ethics_attestation");
  return required.map((key) => ({ key, ...(LEGAL_COMPONENT_DEFINITIONS[key] || { label: key, desc: "" }) }));
}

function hasTrustedProfileEligibility(profile = {}) {
  const fieldsComplete = [profile.name, profile.email, profile.phone, profile.address]
    .every((value) => String(value || "").trim().length > 0);
  const reviewStatus = String(profile?.verification?.review?.status || "").toLowerCase();
  const reviewReady = reviewStatus === "ready";
  const requiresCitizenship = ["buyer", "seller", "corp_buyer", "corp_seller"].includes(profile?.accountType);
  const citizenshipStatus = String(profile?.verification?.citizenshipStatus || "").toLowerCase();
  const citizenshipReady = !requiresCitizenship || citizenshipStatus === "citizen" || citizenshipStatus === "permanent_resident";
  const requiredLegal = getRequiredLegalComponentsForRole(profile?.accountType);
  const legalComponents = profile?.legal?.components || {};
  const legalReady = requiredLegal.every((component) => isLegalComponentComplete(component.key, legalComponents?.[component.key]));
  const legalHoldActive = !!profile?.compliance?.legalHold?.active;
  return fieldsComplete && reviewReady && citizenshipReady && legalReady && !legalHoldActive;
}

// ─── ROLE-BASED ACCESS CONTROL ───────────
const PERMISSIONS = {
  buyer:      { browse: true, detail: true, list: false, messages: true, transaction: true, boilerplates: true, profile: true, admin: false, financial: true, makeOffer: true, listProperty: false, scheduleTour: true, uploadDocs: true, viewReceipts: true, connectBanks: true, wireFunds: true },
  seller:     { browse: true, detail: true, list: true,  messages: true, transaction: true, boilerplates: true, profile: true, admin: false, financial: true, makeOffer: false, listProperty: true, scheduleTour: false, uploadDocs: true, viewReceipts: true, connectBanks: true, wireFunds: false },
  corp_buyer: { browse: true, detail: true, list: false, messages: true, transaction: true, boilerplates: true, profile: true, admin: false, financial: true, makeOffer: true, listProperty: false, scheduleTour: true, uploadDocs: true, viewReceipts: true, connectBanks: true, wireFunds: true },
  corp_seller:{ browse: true, detail: true, list: true,  messages: true, transaction: true, boilerplates: true, profile: true, admin: false, financial: true, makeOffer: false, listProperty: true, scheduleTour: false, uploadDocs: true, viewReceipts: true, connectBanks: true, wireFunds: false },
  attorney:   { browse: true, detail: true, list: false, messages: true, transaction: true, boilerplates: true, profile: true, admin: false, financial: false, makeOffer: false, listProperty: false, scheduleTour: false, uploadDocs: true, viewReceipts: true, connectBanks: false, wireFunds: false },
  agent:      { browse: true, detail: true, list: true,  messages: true, transaction: true, boilerplates: true, profile: true, admin: false, financial: false, makeOffer: true, listProperty: true, scheduleTour: true, uploadDocs: true, viewReceipts: true, connectBanks: false, wireFunds: false },
  inspector:  { browse: true, detail: true, list: false, messages: true, transaction: true, boilerplates: false, profile: true, admin: false, financial: false, makeOffer: false, listProperty: false, scheduleTour: false, uploadDocs: true, viewReceipts: true, connectBanks: false, wireFunds: false },
  lender:     { browse: true, detail: true, list: false, messages: true, transaction: true, boilerplates: true, profile: true, admin: false, financial: true, makeOffer: false, listProperty: false, scheduleTour: false, uploadDocs: true, viewReceipts: true, connectBanks: true, wireFunds: true },
  admin:      { browse: true, detail: true, list: true,  messages: true, transaction: true, boilerplates: true, profile: true, admin: true,  financial: true, makeOffer: true, listProperty: true, scheduleTour: true, uploadDocs: true, viewReceipts: true, connectBanks: true, wireFunds: true },
  webmaster:  { browse: true, detail: true, list: true,  messages: true, transaction: true, boilerplates: true, profile: true, admin: true,  financial: true, makeOffer: false, listProperty: true, scheduleTour: false, uploadDocs: true, viewReceipts: true, connectBanks: false, wireFunds: false },
  gov_municipality: { browse: true, detail: true, list: false, messages: true, transaction: true, boilerplates: true, profile: true, admin: true,  financial: false, makeOffer: false, listProperty: false, scheduleTour: false, uploadDocs: true, viewReceipts: true, connectBanks: false, wireFunds: false },
  gov_township:{ browse: true, detail: true, list: false, messages: true, transaction: true, boilerplates: true, profile: true, admin: true,  financial: false, makeOffer: false, listProperty: false, scheduleTour: false, uploadDocs: true, viewReceipts: true, connectBanks: false, wireFunds: false },
  gov_county: { browse: true, detail: true, list: false, messages: true, transaction: true, boilerplates: true, profile: true, admin: true,  financial: false, makeOffer: false, listProperty: false, scheduleTour: false, uploadDocs: true, viewReceipts: true, connectBanks: false, wireFunds: false },
  gov_borough:{ browse: true, detail: true, list: false, messages: true, transaction: true, boilerplates: true, profile: true, admin: true,  financial: false, makeOffer: false, listProperty: false, scheduleTour: false, uploadDocs: true, viewReceipts: true, connectBanks: false, wireFunds: false },
  gov_parish: { browse: true, detail: true, list: false, messages: true, transaction: true, boilerplates: true, profile: true, admin: true,  financial: false, makeOffer: false, listProperty: false, scheduleTour: false, uploadDocs: true, viewReceipts: true, connectBanks: false, wireFunds: false },
  gov_state:  { browse: true, detail: true, list: false, messages: true, transaction: true, boilerplates: true, profile: true, admin: true,  financial: false, makeOffer: false, listProperty: false, scheduleTour: false, uploadDocs: true, viewReceipts: true, connectBanks: false, wireFunds: false },
  gov_territory:{ browse: true, detail: true, list: false, messages: true, transaction: true, boilerplates: true, profile: true, admin: true,  financial: false, makeOffer: false, listProperty: false, scheduleTour: false, uploadDocs: true, viewReceipts: true, connectBanks: false, wireFunds: false },
  gov_federal:{ browse: true, detail: true, list: false, messages: true, transaction: true, boilerplates: true, profile: true, admin: true,  financial: false, makeOffer: false, listProperty: false, scheduleTour: false, uploadDocs: true, viewReceipts: true, connectBanks: false, wireFunds: false },
};

function getPerms(role) { return PERMISSIONS[role] || PERMISSIONS.buyer; }

const VIEW_PERMISSION_REQUIREMENTS = Object.freeze({
  browse: "browse",
  compare: "browse",
  tours: "browse",
  offer: "browse",
  watchlist: "browse",
  detail: "detail",
  matching: "browse",
  list: "list",
  messages: "messages",
  transaction: "transaction",
  milestones: "transaction",
  documents: "transaction",
  boilerplates: "boilerplates",
  profile: "profile",
  admin: "admin",
  "admin-workbench": "admin",
});

function isViewAllowedForPerms(view, perms) {
  const requiredPerm = VIEW_PERMISSION_REQUIREMENTS[view];
  return !requiredPerm || !!perms?.[requiredPerm];
}

// ─── ROLE CONFLICT MATRIX ────────────────
// Professional roles are mutually exclusive to prevent conflicts of interest.
// Buyer & Seller are exempt — no restrictions apply to them.
const ROLE_CONFLICTS = {
  buyer:       [],
  seller:      [],
  corp_buyer:  [],
  corp_seller: [],
  attorney:    ["agent", "inspector", "lender", "admin"],
  agent:       ["attorney", "inspector", "lender", "admin"],
  inspector:   ["attorney", "agent", "lender", "admin"],
  lender:      ["attorney", "agent", "inspector", "admin"],
  admin:       ["attorney", "agent", "inspector", "lender"],
  webmaster:   [],
  gov_municipality:[],
  gov_township: [],
  gov_county:   [],
  gov_borough:  [],
  gov_parish:   [],
  gov_state:    [],
  gov_territory:[],
  gov_federal:  [],
};

const CONFLICT_REASONS = {
  "buyer-attorney":      "Buyer/Seller profiles can only switch between Buyer and Seller.",
  "buyer-agent":         "Buyer/Seller profiles can only switch between Buyer and Seller.",
  "buyer-inspector":     "Buyer/Seller profiles can only switch between Buyer and Seller.",
  "buyer-lender":        "Buyer/Seller profiles can only switch between Buyer and Seller.",
  "buyer-admin":         "Buyer/Seller profiles can only switch between Buyer and Seller.",
  "buyer-webmaster":     "Buyer/Seller profiles can only switch between Buyer and Seller.",
  "buyer-gov_municipality":"Buyer/Seller profiles can only switch between Buyer and Seller.",
  "buyer-gov_township":  "Buyer/Seller profiles can only switch between Buyer and Seller.",
  "buyer-gov_county":    "Buyer/Seller profiles can only switch between Buyer and Seller.",
  "buyer-gov_borough":   "Buyer/Seller profiles can only switch between Buyer and Seller.",
  "buyer-gov_parish":    "Buyer/Seller profiles can only switch between Buyer and Seller.",
  "buyer-gov_state":     "Buyer/Seller profiles can only switch between Buyer and Seller.",
  "buyer-gov_territory": "Buyer/Seller profiles can only switch between Buyer and Seller.",
  "buyer-gov_federal":   "Buyer/Seller profiles can only switch between Buyer and Seller.",
  "seller-attorney":     "Buyer/Seller profiles can only switch between Buyer and Seller.",
  "seller-agent":        "Buyer/Seller profiles can only switch between Buyer and Seller.",
  "seller-inspector":    "Buyer/Seller profiles can only switch between Buyer and Seller.",
  "seller-lender":       "Buyer/Seller profiles can only switch between Buyer and Seller.",
  "seller-admin":        "Buyer/Seller profiles can only switch between Buyer and Seller.",
  "seller-webmaster":    "Buyer/Seller profiles can only switch between Buyer and Seller.",
  "seller-gov_municipality":"Buyer/Seller profiles can only switch between Buyer and Seller.",
  "seller-gov_township": "Buyer/Seller profiles can only switch between Buyer and Seller.",
  "seller-gov_county":   "Buyer/Seller profiles can only switch between Buyer and Seller.",
  "seller-gov_borough":  "Buyer/Seller profiles can only switch between Buyer and Seller.",
  "seller-gov_parish":   "Buyer/Seller profiles can only switch between Buyer and Seller.",
  "seller-gov_state":    "Buyer/Seller profiles can only switch between Buyer and Seller.",
  "seller-gov_territory":"Buyer/Seller profiles can only switch between Buyer and Seller.",
  "seller-gov_federal":  "Buyer/Seller profiles can only switch between Buyer and Seller.",
  "corp_buyer-buyer":    "Corporate profiles can only switch between Corporate Buyer and Corporate Seller.",
  "corp_buyer-seller":   "Corporate profiles can only switch between Corporate Buyer and Corporate Seller.",
  "corp_buyer-attorney": "Corporate profiles can only switch between Corporate Buyer and Corporate Seller.",
  "corp_buyer-agent":    "Corporate profiles can only switch between Corporate Buyer and Corporate Seller.",
  "corp_buyer-inspector":"Corporate profiles can only switch between Corporate Buyer and Corporate Seller.",
  "corp_buyer-lender":   "Corporate profiles can only switch between Corporate Buyer and Corporate Seller.",
  "corp_buyer-admin":    "Corporate profiles can only switch between Corporate Buyer and Corporate Seller.",
  "corp_buyer-webmaster":"Corporate profiles can only switch between Corporate Buyer and Corporate Seller.",
  "corp_buyer-gov_municipality":"Corporate profiles can only switch between Corporate Buyer and Corporate Seller.",
  "corp_buyer-gov_township":"Corporate profiles can only switch between Corporate Buyer and Corporate Seller.",
  "corp_buyer-gov_county":"Corporate profiles can only switch between Corporate Buyer and Corporate Seller.",
  "corp_buyer-gov_borough":"Corporate profiles can only switch between Corporate Buyer and Corporate Seller.",
  "corp_buyer-gov_parish":"Corporate profiles can only switch between Corporate Buyer and Corporate Seller.",
  "corp_buyer-gov_state":"Corporate profiles can only switch between Corporate Buyer and Corporate Seller.",
  "corp_buyer-gov_territory":"Corporate profiles can only switch between Corporate Buyer and Corporate Seller.",
  "corp_buyer-gov_federal":"Corporate profiles can only switch between Corporate Buyer and Corporate Seller.",
  "corp_seller-buyer":    "Corporate profiles can only switch between Corporate Buyer and Corporate Seller.",
  "corp_seller-seller":   "Corporate profiles can only switch between Corporate Buyer and Corporate Seller.",
  "corp_seller-attorney": "Corporate profiles can only switch between Corporate Buyer and Corporate Seller.",
  "corp_seller-agent":    "Corporate profiles can only switch between Corporate Buyer and Corporate Seller.",
  "corp_seller-inspector":"Corporate profiles can only switch between Corporate Buyer and Corporate Seller.",
  "corp_seller-lender":   "Corporate profiles can only switch between Corporate Buyer and Corporate Seller.",
  "corp_seller-admin":    "Corporate profiles can only switch between Corporate Buyer and Corporate Seller.",
  "corp_seller-webmaster":"Corporate profiles can only switch between Corporate Buyer and Corporate Seller.",
  "corp_seller-gov_municipality":"Corporate profiles can only switch between Corporate Buyer and Corporate Seller.",
  "corp_seller-gov_township":"Corporate profiles can only switch between Corporate Buyer and Corporate Seller.",
  "corp_seller-gov_county":"Corporate profiles can only switch between Corporate Buyer and Corporate Seller.",
  "corp_seller-gov_borough":"Corporate profiles can only switch between Corporate Buyer and Corporate Seller.",
  "corp_seller-gov_parish":"Corporate profiles can only switch between Corporate Buyer and Corporate Seller.",
  "corp_seller-gov_state":"Corporate profiles can only switch between Corporate Buyer and Corporate Seller.",
  "corp_seller-gov_territory":"Corporate profiles can only switch between Corporate Buyer and Corporate Seller.",
  "corp_seller-gov_federal":"Corporate profiles can only switch between Corporate Buyer and Corporate Seller.",
  "attorney-agent":     "An attorney cannot also act as an agent — legal counsel must be independent from sales representation.",
  "attorney-inspector": "An attorney cannot also be an inspector — legal review must be independent from property assessment.",
  "attorney-lender":    "An attorney cannot also be a lender — legal oversight must be independent from financial interests.",
  "attorney-admin":     "An attorney cannot also be a platform administrator — legal practice must be separate from platform governance.",
  "agent-inspector":    "An agent cannot also be an inspector — sales representation must be independent from property assessment.",
  "agent-lender":       "An agent cannot also be a lender — sales representation must be independent from funding decisions.",
  "agent-admin":        "An agent cannot also be a platform administrator — client representation must be separate from platform governance.",
  "inspector-lender":   "An inspector cannot also be a lender — property assessment must be independent from financial interests.",
  "inspector-admin":    "An inspector cannot also be a platform administrator — inspections must be separate from platform governance.",
  "lender-admin":       "A lender cannot also be a platform administrator — financial operations must be separate from platform governance.",
};

function getConflictReason(roleA, roleB) {
  const key1 = `${roleA}-${roleB}`;
  const key2 = `${roleB}-${roleA}`;
  return CONFLICT_REASONS[key1] || CONFLICT_REASONS[key2] || "These roles cannot be held simultaneously due to conflict of interest.";
}

// Professional roles are locked — once assigned, cannot switch to any other role
const LOCKED_ROLES = ["attorney", "agent", "inspector", "lender", "admin", "webmaster", "gov_municipality", "gov_township", "gov_county", "gov_borough", "gov_parish", "gov_state", "gov_territory", "gov_federal"];
const BUY_SELL_ROLES = ["buyer", "seller"];
const CORP_BUY_SELL_ROLES = ["corp_buyer", "corp_seller"];

function isRoleBlocked(currentRole, targetRole) {
  if (currentRole === targetRole) return false;
  if (BUY_SELL_ROLES.includes(currentRole)) return !BUY_SELL_ROLES.includes(targetRole);
  if (CORP_BUY_SELL_ROLES.includes(currentRole)) return !CORP_BUY_SELL_ROLES.includes(targetRole);
  if (LOCKED_ROLES.includes(currentRole)) return true; // locked roles can't switch to anything
  return (ROLE_CONFLICTS[currentRole] || []).includes(targetRole);
}

function RestrictedBanner({ role, feature }) {
  const acct = ACCOUNT_TYPES.find((a) => a.key === role);
  return (
    <div style={{ maxWidth: 500, margin: "80px auto", textAlign: "center", padding: 32 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
      <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 26, color: S.dark, marginBottom: 8 }}>Access Restricted</h2>
      <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, color: S.muted, lineHeight: 1.6, marginBottom: 20 }}>
        <strong>{feature}</strong> is not available for <strong>{acct?.label || role}</strong> accounts. This restriction exists to prevent conflicts of interest and ensure platform integrity.
      </p>
      <div style={{ background: S.surface, borderRadius: 14, padding: 18, textAlign: "left", marginBottom: 20 }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 700, color: S.muted, marginBottom: 10 }}>Who can access this feature:</div>
        {Object.entries(PERMISSIONS).filter(([, p]) => {
          const featureKey = feature.toLowerCase().replace(/ /g, "").replace("listproperty", "list").replace("adminoversight", "admin").replace("browselistings", "browse").replace("templates", "boilerplates").replace("financialconnections", "financial");
          const matchKeys = Object.keys(p).filter((k) => k.toLowerCase().includes(featureKey.toLowerCase().slice(0, 5)));
          return matchKeys.length > 0 && matchKeys.some((k) => p[k]);
        }).slice(0, 4).map(([roleKey]) => {
          const a = ACCOUNT_TYPES.find((at) => at.key === roleKey);
          return a ? (
            <div key={roleKey} style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: S.dark, padding: "4px 0" }}>
              {a.icon} {a.label}
            </div>
          ) : null;
        })}
      </div>
      <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, color: S.light }}>
        If you believe this is an error, contact EstateHat support.
      </p>
    </div>
  );
}

const VERIFICATION_STEPS = [
  { key: "identity", label: "Government ID", desc: "Upload a valid photo ID (driver's license, passport, or state ID)", icon: "🪪", required: true },
  { key: "selfie", label: "Selfie Verification", desc: "Take a live photo to match against your ID", icon: "🤳", required: true },
  { key: "address", label: "Proof of Address", desc: "Utility bill, bank statement, or lease (within 90 days)", icon: "📬", required: true },
  { key: "citizenship", label: "U.S. Citizenship / Residency", desc: "U.S. passport, birth certificate, naturalization certificate, or permanent resident card (green card)", icon: "🇺🇸", required: true, buyerSeller: true },
  { key: "ssn", label: "SSN / ITIN Verification", desc: "Social Security Number or Individual Taxpayer ID verified through a secure third-party service (never stored)", icon: "🔐", required: true, buyerSeller: true },
  { key: "homeowner", label: "Homeowner Verification", desc: "Property deed, mortgage statement, or county tax record proving current or prior homeownership", icon: "🏡", required: false, buyerSeller: true },
  { key: "license", label: "Professional License", desc: "Required for Attorneys, Agents, Inspectors, and Lenders", icon: "📜", required: false },
  { key: "background", label: "Background Check", desc: "Consent to a third-party background screening", icon: "🛡️", required: true },
];

const CORP_VERIFICATION_STEPS = [
  { key: "entity_docs", label: "Entity Formation Documents", desc: "Articles of Incorporation, Articles of Organization, or Trust Agreement", icon: "🏛", required: true },
  { key: "ein", label: "EIN / Tax ID Verification", desc: "IRS EIN confirmation letter (CP 575 or 147C)", icon: "🔢", required: true },
  { key: "domestic_entity", label: "U.S. Domestic Entity", desc: "Proof entity is formed in a U.S. state — state filing receipt, Secretary of State registration, or FEIN letter", icon: "🇺🇸", required: true },
  { key: "good_standing", label: "Certificate of Good Standing", desc: "Current certificate from state of incorporation (within 90 days)", icon: "✅", required: true },
  { key: "operating_agreement", label: "Operating Agreement / Bylaws", desc: "LLC operating agreement, corporate bylaws, or trust provisions", icon: "📘", required: true },
  { key: "auth_resolution", label: "Board / Member Resolution", desc: "Resolution authorizing real estate transactions and naming authorized signers", icon: "📋", required: true },
  { key: "auth_signer_id", label: "Authorized Signer ID", desc: "Government-issued photo ID for each person authorized to sign on behalf of the entity", icon: "🪪", required: true },
  { key: "auth_signer_selfie", label: "Authorized Signer Selfie", desc: "Live selfie verification for each authorized signer", icon: "🤳", required: true },
  { key: "signer_citizenship", label: "Signer U.S. Citizenship / Residency", desc: "Each authorized signer must verify U.S. citizenship or permanent residency individually", icon: "🇺🇸", required: true },
  { key: "registered_agent", label: "Registered Agent Info", desc: "Name and address of the entity's registered agent on file with the state", icon: "📬", required: true },
  { key: "background_entity", label: "Entity Background Check", desc: "OFAC, sanctions, and litigation screening for the entity", icon: "🛡️", required: true },
  { key: "background_signers", label: "Signer Background Checks", desc: "Individual background checks for all authorized signers", icon: "🛡️", required: true },
  { key: "proof_of_funds", label: "Corporate Proof of Funds", desc: "Bank statement or letter from U.S.-based corporate account showing available funds", icon: "🏦", required: true },
];

// ─── CITIZENSHIP STATUS TYPES ────────────
const CITIZENSHIP_STATUSES = [
  { key: "citizen", label: "U.S. Citizen", icon: "🇺🇸", badge: "verified", desc: "Verified via passport, birth certificate, or naturalization certificate" },
  { key: "permanent_resident", label: "Permanent Resident", icon: "🟢", badge: "verified", desc: "Verified via green card (Form I-551)" },
  { key: "pending", label: "Verification Pending", icon: "🟡", badge: "type", desc: "Documents submitted, awaiting admin review" },
  { key: "unverified", label: "Not Yet Verified", icon: "⚪", badge: "warn", desc: "Citizenship/residency documents not yet submitted" },
];

const ENTITY_TYPES = [
  { key: "llc", label: "LLC (Limited Liability Company)" },
  { key: "corp", label: "Corporation (C-Corp or S-Corp)" },
  { key: "lp", label: "Limited Partnership (LP)" },
  { key: "trust", label: "Revocable / Irrevocable Trust" },
  { key: "reit", label: "REIT (Real Estate Investment Trust)" },
  { key: "joint_venture", label: "Joint Venture" },
  { key: "nonprofit", label: "501(c)(3) Nonprofit" },
  { key: "govt", label: "Government Entity" },
];

const FINANCIAL_INSTITUTIONS = [
  { id: "chase", name: "JPMorgan Chase", type: "Bank", logo: "🏦", connected: false, supports: ["escrow", "wire", "mortgage"] },
  { id: "boa", name: "Bank of America", type: "Bank", logo: "🏦", connected: false, supports: ["escrow", "wire", "mortgage"] },
  { id: "wells", name: "Wells Fargo", type: "Bank", logo: "🏦", connected: false, supports: ["escrow", "wire", "mortgage"] },
  { id: "stripe", name: "Stripe Connect", type: "Payment Processor", logo: "💳", connected: false, supports: ["escrow", "receipts", "refunds"] },
  { id: "plaid", name: "Plaid", type: "Account Verification", logo: "🔗", connected: false, supports: ["identity", "balance", "transactions"] },
  { id: "escrowcom", name: "Escrow.com", type: "Escrow Service", logo: "🔒", connected: false, supports: ["escrow", "milestone", "receipts"] },
  { id: "firstam", name: "First American Title", type: "Title & Escrow", logo: "📋", connected: false, supports: ["title", "escrow", "insurance"] },
  { id: "docusign", name: "DocuSign", type: "E-Signature", logo: "✍️", connected: false, supports: ["contracts", "signatures", "notarization"] },
];

const PAYOUT_PROVIDER_OPTIONS = [
  { key: "stripe_connect", label: "Stripe Connect" },
  { key: "square", label: "Square" },
  { key: "paypal", label: "PayPal Payouts" },
  { key: "adyen", label: "Adyen" },
  { key: "none", label: "None" },
];

const PAYOUT_METHOD_OPTIONS = [
  { key: "ach_standard", label: "ACH Standard" },
  { key: "ach_same_day", label: "ACH Same-Day" },
  { key: "instant_card", label: "Instant to Card" },
];

const PAYOUT_SCHEDULE_OPTIONS = [
  { key: "manual", label: "Manual" },
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "biweekly", label: "Biweekly" },
  { key: "monthly", label: "Monthly" },
];

const BOILERPLATES = [
  { id: "purchase", name: "Purchase Agreement", category: "Contract", pages: 12, desc: "Standard residential purchase agreement covering price, contingencies, timelines, and closing terms." },
  { id: "disclosure", name: "Seller Disclosure Statement", category: "Disclosure", pages: 8, desc: "State-required property condition disclosure including known defects, environmental hazards, and material facts." },
  { id: "inspection", name: "Inspection Contingency", category: "Addendum", pages: 3, desc: "Buyer's right to inspect and negotiate repairs or credits within a specified period." },
  { id: "financing", name: "Financing Contingency", category: "Addendum", pages: 2, desc: "Protection for buyers if mortgage approval falls through within the contingency window." },
  { id: "escrow_inst", name: "Escrow Instructions", category: "Escrow", pages: 6, desc: "Detailed instructions to the escrow agent on fund disbursement, document handling, and closing procedures." },
  { id: "title_report", name: "Preliminary Title Report", category: "Title", pages: 4, desc: "Template for title search findings, liens, encumbrances, and chain of ownership." },
  { id: "closing", name: "Closing Disclosure (HUD)", category: "Closing", pages: 5, desc: "Final accounting of all transaction costs, credits, and adjustments for both parties." },
  { id: "poa", name: "Power of Attorney", category: "Legal", pages: 2, desc: "Authorization for a designated representative to act on behalf of buyer or seller at closing." },
  { id: "lease", name: "Lease Agreement", category: "Rental", pages: 10, desc: "Standard residential lease with terms for rent, deposits, maintenance responsibilities, and termination." },
  { id: "nda", name: "Non-Disclosure Agreement", category: "Legal", pages: 2, desc: "Confidentiality agreement for sharing sensitive property or financial information." },
  { id: "corp_resolution", name: "Corporate Board Resolution", category: "Corporate", pages: 3, desc: "Resolution authorizing specific real estate transactions, naming authorized signers and transaction limits." },
  { id: "corp_purchase", name: "Entity Purchase Agreement", category: "Corporate", pages: 16, desc: "Purchase agreement for corporate/LLC/trust buyers including entity representations, warranty provisions, and signer authority." },
  { id: "corp_operating", name: "Operating Agreement Amendment", category: "Corporate", pages: 4, desc: "Amendment to LLC operating agreement adding real estate transaction authority or new member provisions." },
  { id: "corp_assignment", name: "Assignment of Contract", category: "Corporate", pages: 3, desc: "Assign purchase rights from an individual to a corporate entity or between entities prior to closing." },
  { id: "corp_due_diligence", name: "Due Diligence Checklist", category: "Corporate", pages: 6, desc: "Comprehensive checklist for corporate acquisitions including environmental, zoning, title, and financial review items." },
  { id: "corp_auth_letter", name: "Letter of Authorization", category: "Corporate", pages: 1, desc: "Authorizes a named representative to act on behalf of the entity for a specific transaction." },
  { id: "ack_non_brokerage", name: "Non-Brokerage Acknowledgment", category: "Compliance", pages: 1, desc: "Acknowledges EstateHat platform scope and confirms understanding of non-brokerage status for the specified jurisdiction." },
  { id: "attest_fair_housing", name: "Fair Housing Attestation", category: "Compliance", pages: 1, desc: "Attests that listing and transaction conduct complies with fair housing and anti-discrimination obligations in the selected jurisdiction." },
  { id: "attest_support_scope", name: "Support Scope Attestation", category: "Compliance", pages: 1, desc: "Confirms support interactions are operational guidance and not legal representation, with jurisdiction-specific acknowledgment language." },
  { id: "ack_electronic_records", name: "Electronic Records Consent Acknowledgment", category: "Compliance", pages: 1, desc: "Confirms consent to electronic records and signatures for the transaction jurisdiction and selected municipality overlay." },
  { id: "attest_marketing_consent", name: "Marketing Consent Attestation", category: "Compliance", pages: 1, desc: "Certifies the consent record is accurate and valid for the communication jurisdiction before outbound outreach." },
  { id: "ack_platform_fee_disclosure", name: "Platform Fee Disclosure Attestation", category: "Compliance", pages: 1, desc: "Confirms understanding of EstateHat surcharge and third-party provider fees before transaction execution." },
  { id: "ack_funds_custody_boundary", name: "Funds Custody Boundary Attestation", category: "Compliance", pages: 1, desc: "Confirms EstateHat does not custody transaction funds and uses third-party escrow/payment rails." },
];

const TRANSACTION_CHECKLIST = [
  { key: "buyer_identity", label: "Buyer Identity Verified", category: "Identity & Citizenship" },
  { key: "buyer_citizenship", label: "Buyer U.S. Citizenship / Residency Confirmed", category: "Identity & Citizenship" },
  { key: "seller_identity", label: "Seller Identity Verified", category: "Identity & Citizenship" },
  { key: "seller_citizenship", label: "Seller U.S. Citizenship / Residency Confirmed", category: "Identity & Citizenship" },
  { key: "offer_accepted", label: "Offer Accepted by Seller", category: "Offer" },
  { key: "earnest_deposit", label: "Earnest Money Deposited to Escrow", category: "Financial" },
  { key: "proof_of_funds", label: "Proof of Funds / Pre-Approval Letter", category: "Financial" },
  { key: "purchase_agreement", label: "Purchase Agreement Signed (Both Parties)", category: "Documents" },
  { key: "seller_disclosure", label: "Seller Disclosure Received", category: "Documents" },
  { key: "inspection_report", label: "Property Inspection Completed", category: "Inspection" },
  { key: "appraisal", label: "Appraisal Completed", category: "Financial" },
  { key: "title_search", label: "Title Search Clear", category: "Title" },
  { key: "title_insurance", label: "Title Insurance Bound", category: "Title" },
  { key: "mortgage_approved", label: "Mortgage Final Approval", category: "Financial" },
  { key: "closing_disclosure", label: "Closing Disclosure Reviewed (3-day)", category: "Closing" },
  { key: "final_walkthrough", label: "Final Walk-Through Completed", category: "Closing" },
  { key: "funds_wired", label: "Funds Wired to Escrow", category: "Closing" },
  { key: "docs_recorded", label: "Deed & Documents Recorded", category: "Closing" },
];

// ─── HELPERS ─────────────────────────────
const fmt = (p) => "$" + p.toLocaleString();
const fmtCents = (cents = 0) => fmt(Math.round((Number(cents) || 0) / 100));
const cx = (...classes) => classes.filter(Boolean).join(" ");
function listingHasTrustedBadge(listing = {}) {
  const active = !!(listing.trustedProfileActive || listing.trust?.verifiedProfileActive);
  const visible = listing.trustedProfileVisibility !== false && listing.trust?.verifiedProfileVisibility !== false;
  const eligible = listing.trustedProfileEligible !== false && listing.trust?.verifiedProfileEligible !== false;
  return active && visible && eligible;
}

// ─── FEE CALCULATION ────────────────────
const FEE_RATE = 0.015;
const FEE_LABEL = "1.50%";
const ESCROW_FLAT = 500;
const WIRE_FLAT = 35;
function getFeeRate() { return { rate: FEE_RATE, label: FEE_LABEL }; }
function normalizeSellerFeeLines(price, sellerFeeLines = []) {
  return (Array.isArray(sellerFeeLines) ? sellerFeeLines : [])
    .map((line, index) => {
      const label = String(line?.label || "").trim() || `Seller Fee ${index + 1}`;
      const mode = line?.mode === "percentage" ? "percentage" : "amount";
      const rawValue = Number(line?.value || 0);
      const value = Number.isFinite(rawValue) ? Math.max(0, rawValue) : 0;
      const amount = mode === "percentage" ? Math.round((Number(price) || 0) * (value / 100)) : Math.round(value * 100) / 100;
      return {
        id: line?.id || `seller-fee-${index + 1}`,
        label,
        mode,
        value,
        amount,
      };
    })
    .filter((line) => line.amount > 0);
}

function calcFees(price, options = {}) {
  const tier = getFeeRate();
  const processingFee = Math.round(price * tier.rate);
  const sellerFeeLines = normalizeSellerFeeLines(price, options.sellerFeeLines);
  const sellerAdditionalFees = sellerFeeLines.reduce((sum, line) => sum + line.amount, 0);
  const totalFees = processingFee + ESCROW_FLAT + WIRE_FLAT;
  const buyerTotal = price + processingFee;
  const buyerClosingTotal = price + totalFees;
  const sellerNet = price - sellerAdditionalFees;
  const sellerPaidTotalFees = totalFees;
  const sellerNetIfSellerPaysFee = price - totalFees - sellerAdditionalFees;
  const traditionalComm = Math.round(price * 0.06);
  const savings = traditionalComm - totalFees;
  return {
    tier,
    processingFee,
    totalFees,
    buyerTotal,
    buyerClosingTotal,
    sellerNet,
    sellerPaidTotalFees,
    sellerNetIfSellerPaysFee,
    sellerAdditionalFees,
    sellerFeeLines,
    savings,
    escrowFlat: ESCROW_FLAT,
    wireFlat: WIRE_FLAT,
  };
}

const FeeBreakdown = memo(function FeeBreakdown({ price, compact = false, sellerFeeLines = [] }) {
  const f = calcFees(price, { sellerFeeLines });
  if (compact) {
    return (
      <div style={{ background: S.surface, borderRadius: 12, padding: 14, fontFamily: S.font, fontSize: 12, color: S.muted, lineHeight: 1.8 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: S.dark, marginBottom: 4 }}>💰 Fee Breakdown</div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Sale Price</span><span style={{ fontWeight: 600 }}>{fmt(price)}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>EstateHat Buyer Fee ({f.tier.label})</span><span style={{ fontWeight: 600 }}>{fmt(f.processingFee)}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Escrow Service</span><span>{fmt(f.escrowFlat)}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Wire Transfer</span><span>{fmt(f.wireFlat)}</span></div>
        {f.sellerFeeLines.map((line) => (
          <div key={line.id} style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{line.label} {line.mode === "percentage" ? `(${line.value.toFixed(2).replace(/\.00$/, "")}%)` : "(fixed)"}</span>
            <span>{fmt(line.amount)}</span>
          </div>
        ))}
        <div style={{ borderTop: `1px solid ${S.borderStrong}`, marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between", fontWeight: 700, color: S.dark, fontSize: 13 }}><span>Buyer Total Due</span><span>{fmt(f.buyerClosingTotal)}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", color: S.muted, marginTop: 2 }}><span>Seller net if buyer pays fee</span><span>{fmt(f.sellerNet)}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", color: S.green, fontWeight: 600, marginTop: 2 }}><span>✓ You save vs. 6% agent</span><span>{fmt(f.savings)}</span></div>
      </div>
    );
  }
  return (
    <Card>
      <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: S.light, marginBottom: 14, fontWeight: 600 }}>Closing Cost Estimate</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div style={{ textAlign: "center", padding: 12, background: S.surfaceAlt, borderRadius: 10 }}>
          <div style={{ fontFamily: S.serif, fontSize: 22, color: S.dark }}>{f.tier.label}</div>
          <div style={{ fontFamily: S.font, fontSize: 11, color: S.light }}>Platform Rate</div>
        </div>
        <div style={{ textAlign: "center", padding: 12, background: S.surfaceAlt, borderRadius: 10 }}>
          <div style={{ fontFamily: S.serif, fontSize: 22, color: S.dark }}>{fmt(f.buyerClosingTotal)}</div>
          <div style={{ fontFamily: S.font, fontSize: 11, color: S.light }}>Buyer Total Due</div>
        </div>
        <div style={{ textAlign: "center", padding: 12, background: S.greenBg, borderRadius: 10 }}>
          <div style={{ fontFamily: S.serif, fontSize: 22, color: S.green }}>{fmt(f.savings)}</div>
          <div style={{ fontFamily: S.font, fontSize: 11, color: S.green }}>Saved vs. Agent</div>
        </div>
      </div>
      {[
        ["Sale Price", fmt(price), false],
        [`EstateHat Buyer Fee (${f.tier.label})`, fmt(f.processingFee), false],
        ["Escrow Service (flat)", fmt(f.escrowFlat), false],
        ["Wire Transfer (flat)", fmt(f.wireFlat), false],
        ...f.sellerFeeLines.map((line) => [line.label + (line.mode === "percentage" ? ` (${line.value.toFixed(2).replace(/\.00$/, "")}%)` : " (fixed)"), fmt(line.amount), false]),
      ].map(([label, val]) => (
        <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${S.surface}`, fontFamily: S.font, fontSize: 13, color: S.muted }}>
          <span>{label}</span><span style={{ fontWeight: 600 }}>{val}</span>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 4px", fontFamily: S.font, fontSize: 15, fontWeight: 700, color: S.dark }}>
        <span>Buyer Total Due</span><span>{fmt(f.buyerClosingTotal)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: S.font, fontSize: 13, fontWeight: 600, color: S.muted }}>
        <span>Seller net if buyer pays fee</span><span>{fmt(f.sellerNet)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: S.font, fontSize: 13, fontWeight: 600, color: S.green, marginTop: 3 }}>
        <span>Seller net if seller elects to pay fee</span><span>{fmt(f.sellerNetIfSellerPaysFee)}</span>
      </div>
      <div style={{ marginTop: 12, padding: "10px 14px", background: S.greenBg, borderRadius: 10, fontFamily: S.font, fontSize: 12, color: S.green, lineHeight: 1.5 }}>
        Traditional agents would charge <strong>{fmt(Math.round(price * 0.06))}</strong> on this sale. EstateHat saves the seller <strong>{fmt(f.savings)}</strong> while still helping keep identities checked, escrow coordinated, and the closing steps organized.
      </div>
    </Card>
  );
});

// ─── STYLE SYSTEM ────────────────────────
const S = {
  bg: "var(--s-bg)", card: "var(--s-card)", surface: "var(--s-surface)", surfaceAlt: "var(--s-surface-alt)", dark: "var(--s-dark)", mid: "var(--s-mid)", muted: "var(--s-muted)", light: "var(--s-light)", border: "var(--s-border)", borderStrong: "var(--s-border-strong)", gold: "var(--s-gold)", goldDeep: "var(--s-gold-deep)", green: "var(--s-green)", red: "var(--s-red)", greenBg: "var(--s-greenBg)", redBg: "var(--s-redBg)", goldBg: "var(--s-goldBg)", blue: "var(--s-blue)", blueBg: "var(--s-blueBg)", violet: "var(--s-violet)", violetBg: "var(--s-violetBg)", orange: "var(--s-orange)", orangeBg: "var(--s-orangeBg)", nav: "var(--s-nav)", overlay: "var(--s-overlay)", shadowSoft: "var(--s-shadow-soft)", shadowStrong: "var(--s-shadow-strong)", primary: "var(--s-primary)", primaryMid: "var(--s-primary-mid)", primaryContrast: "var(--s-primary-contrast)", navText: "var(--s-nav-text)",
  font: "'Plus Jakarta Sans', sans-serif",
  serif: "'DM Serif Display', serif",
  radius: 8,
  btn: (bg, color) => ({ background: bg, color, border: "none", borderRadius: 8, padding: "10px 18px", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease" }),
  input: { width: "100%", padding: "12px 16px", border: "1px solid var(--s-input-border)", borderRadius: 8, fontSize: 14, fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none", boxSizing: "border-box", background: "var(--s-input-bg)", color: "var(--s-dark)" },
  label: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 600, color: "var(--s-muted)", display: "block", marginBottom: 6, marginTop: 14 },
  sectionTitle: { fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "var(--s-dark)", margin: "0 0 6px" },
  sectionSub: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, color: "var(--s-light)", marginBottom: 24 },
};

// ─── SMALL COMPONENTS ────────────────────

const Badge = memo(function Badge({ children, variant = "default" }) {
  const map = { default: { background: S.surface, color: S.muted }, new: { background: S.green, color: S.greenBg }, hot: { background: S.red, color: S.redBg }, type: { background: S.goldBg, color: S.goldDeep }, verified: { background: S.greenBg, color: S.green }, warn: { background: S.redBg, color: S.red }, role: { background: S.violetBg, color: S.violet } };
  const s = map[variant] || map.default;
  return <span style={{ ...s, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, fontFamily: S.font, letterSpacing: 0.5, textTransform: "uppercase", whiteSpace: "nowrap", display: "inline-block" }}>{children}</span>;
});

function StarRating({ rating }) {
  return <span style={{ color: S.gold, fontSize: 14, letterSpacing: 1 }}>{"★".repeat(Math.floor(rating))}{rating % 1 >= 0.5 ? "½" : ""}<span style={{ color: S.light, marginLeft: 4, fontFamily: S.font, fontSize: 13 }}>{rating}</span></span>;
}

const REPUTATION_GRADES = ["AA", "A", "B", "C", "D", "F"];
const REPUTATION_GRADE_META = {
  AA: { score: 98, label: "Elite", desc: "Exceptional record, strong feedback, and very low risk signals.", tone: "verified" },
  A: { score: 90, label: "Excellent", desc: "Reliable, responsive, and consistently positive.", tone: "verified" },
  B: { score: 80, label: "Solid", desc: "Good standing with normal transaction expectations.", tone: "type" },
  C: { score: 70, label: "Watch", desc: "Mixed record or limited history. Review details before relying on this profile.", tone: "warn" },
  D: { score: 55, label: "Concern", desc: "Repeated issues or incomplete reputation history.", tone: "warn" },
  F: { score: 25, label: "High Risk", desc: "Do not proceed without admin review and documented remediation.", tone: "warn" },
};

function reputationScoreFromGrade(grade) {
  return REPUTATION_GRADE_META[grade]?.score || 80;
}

function reputationGradeFromScore(score = 80) {
  const value = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  if (value >= 95) return "AA";
  if (value >= 85) return "A";
  if (value >= 75) return "B";
  if (value >= 65) return "C";
  if (value >= 50) return "D";
  return "F";
}

function gradeFromStarRating(rating = 0) {
  const score = Math.max(0, Math.min(100, Math.round((Number(rating) || 0) * 20)));
  return reputationGradeFromScore(score);
}

function summarizeReputation(reputation = {}) {
  const feedback = Array.isArray(reputation.feedback) ? reputation.feedback.slice(0, 20) : [];
  const published = feedback.filter((entry) => (entry.status || "published") === "published");
  const baseScore = Number.isFinite(Number(reputation.score)) ? Number(reputation.score) : 80;
  const averageScore = published.length
    ? Math.round(published.reduce((sum, entry) => sum + (Number(entry.score) || reputationScoreFromGrade(entry.grade)), 0) / published.length)
    : Math.max(0, Math.min(100, Math.round(baseScore)));
  return {
    grade: reputationGradeFromScore(averageScore),
    score: averageScore,
    reviewCount: published.length,
    testimonialCount: published.filter((entry) => String(entry.testimonial || "").trim()).length,
    visibility: reputation.visibility !== false,
    lastReviewedAt: reputation.lastReviewedAt || null,
    summary: String(reputation.summary || "").slice(0, 220),
    feedback,
  };
}

function GradeBadge({ grade = "B", score, size = "normal" }) {
  const safeGrade = REPUTATION_GRADES.includes(grade) ? grade : "B";
  const meta = REPUTATION_GRADE_META[safeGrade];
  const critical = safeGrade === "D" || safeGrade === "F";
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      borderRadius: 8,
      padding: size === "large" ? "7px 11px" : "4px 8px",
      background: critical ? S.redBg : safeGrade === "AA" || safeGrade === "A" ? S.greenBg : safeGrade === "B" ? S.goldBg : S.surfaceAlt,
      color: critical ? S.red : safeGrade === "AA" || safeGrade === "A" ? S.green : safeGrade === "B" ? S.goldDeep : S.muted,
      border: `1px solid ${critical ? `${S.red}44` : S.border}`,
      fontFamily: S.font,
      fontWeight: 900,
      fontSize: size === "large" ? 13 : 11,
      whiteSpace: "nowrap",
    }}>
      Grade {safeGrade}
      {Number.isFinite(Number(score)) && <span style={{ fontWeight: 700, opacity: 0.82 }}>{Math.round(Number(score))}/100</span>}
      <span style={{ fontWeight: 700, opacity: 0.82 }}>{meta.label}</span>
    </span>
  );
}

const Card = memo(function Card({ children, style: sx, ...rest }) {
  return <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 8, padding: 20, boxShadow: `0 2px 12px ${S.shadowSoft}`, ...sx }} {...rest}>{children}</div>;
});

function SectionHeader({ title, sub }) {
  return (
    <>
      <h2 style={S.sectionTitle}>{title}</h2>
      {sub && <p style={S.sectionSub}>{sub}</p>}
      <SimpleImageBand context={title} compact />
    </>
  );
}

function TabBar({ tabs, active, onSelect }) {
  return (
    <div style={{ display: "flex", gap: 4, background: S.surface, borderRadius: 8, padding: 4, marginBottom: 24, flexWrap: "wrap" }}>
      {tabs.map((t) => (
        <button key={t.key} onClick={() => onSelect(t.key)} style={{
          ...S.btn(active === t.key ? S.card : "transparent", active === t.key ? S.dark : S.light),
          padding: "10px 18px", fontSize: 13, borderRadius: 6, boxShadow: active === t.key ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
        }}>{t.icon && <span style={{ marginRight: 6 }}>{t.icon}</span>}{t.label}</button>
      ))}
    </div>
  );
}

const ProgressBar = memo(function ProgressBar({ value, max, color = S.gold }) {
  return (
    <div style={{ height: 6, borderRadius: 3, background: S.surface, overflow: "hidden" }}>
      <div style={{ height: "100%", borderRadius: 3, background: color, width: `${Math.min((value / max) * 100, 100)}%`, transition: "width 0.5s ease" }} />
    </div>
  );
});

function FileUploadZone({ label, accept, onUpload, files = [] }) {
  const ref = useRef(null);
  const handleFiles = (fileList) => {
    const arr = Array.from(fileList).map((f) => ({ name: f.name, size: (f.size / 1024).toFixed(1) + " KB", type: f.type, time: new Date().toLocaleTimeString(), status: "uploaded" }));
    onUpload(arr);
  };
  return (
    <div>
      {label && <label style={S.label}>{label}</label>}
      <div
        onClick={() => ref.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleFiles(e.dataTransfer.files); }}
        style={{ border: `2px dashed ${S.borderStrong}`, borderRadius: 14, padding: 28, textAlign: "center", cursor: "pointer", background: S.card, transition: "border-color 0.2s" }}
      >
        <div style={{ fontSize: 28, marginBottom: 6 }}>📂</div>
        <div style={{ fontFamily: S.font, fontSize: 13, fontWeight: 600, color: S.muted }}>Click or drag files here</div>
        <div style={{ fontFamily: S.font, fontSize: 11, color: S.light, marginTop: 4 }}>{accept || "PDF, JPG, PNG, DOCX — Max 25MB"}</div>
        <input ref={ref} type="file" multiple style={{ display: "none" }} onChange={(e) => handleFiles(e.target.files)} />
      </div>
      {files.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {files.map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: S.greenBg, borderRadius: 10, padding: "8px 14px" }}>
              <span style={{ fontFamily: S.font, fontSize: 13, color: S.green, fontWeight: 600 }}>✓ {f.name}</span>
              <span style={{ fontFamily: S.font, fontSize: 11, color: S.light }}>{f.size} · {f.time}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ValidationChecklist({ items, checked, title }) {
  const allDone = items.every((it) => checked[it.key]);
  const count = items.filter((it) => checked[it.key]).length;
  const categories = [...new Set(items.map((i) => i.category))];
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: 0 }}>{title || "Transaction Checklist"}</h3>
        <Badge variant={allDone ? "verified" : "warn"}>{count}/{items.length} Complete</Badge>
      </div>
      <ProgressBar value={count} max={items.length} color={allDone ? S.green : S.gold} />
      {!allDone && (
        <div style={{ marginTop: 10, padding: "10px 14px", background: S.redBg, borderRadius: 10, fontFamily: S.font, fontSize: 12, color: S.red, lineHeight: 1.5 }}>
          ⚠️ <strong>Transaction Blocked:</strong> All items must be completed before closing can proceed. {items.length - count} item{items.length - count > 1 ? "s" : ""} remaining.
        </div>
      )}
      <div style={{ marginTop: 16 }}>
        {categories.map((cat) => (
          <div key={cat} style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: S.light, marginBottom: 6 }}>{cat}</div>
            {items.filter((i) => i.category === cat).map((item) => (
              <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${S.surface}` }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 6, border: checked[item.key] ? "none" : `2px solid ${S.borderStrong}`,
                  background: checked[item.key] ? S.green : "transparent", display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>
                  {checked[item.key] && "✓"}
                </div>
                <span style={{ fontFamily: S.font, fontSize: 13, color: checked[item.key] ? S.muted : S.dark, fontWeight: checked[item.key] ? 400 : 600, textDecoration: checked[item.key] ? "line-through" : "none" }}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

function AddressVerifier({ address, onVerified }) {
  const [status, setStatus] = useState("idle"); // idle | verifying | verified | failed
  const [resolved, setResolved] = useState("");
  const verify = () => {
    setStatus("verifying");
    setTimeout(() => {
      if (address && address.length > 10) {
        setResolved(address);
        setStatus("verified");
        onVerified?.(true);
      } else {
        setStatus("failed");
        onVerified?.(false);
      }
    }, 1500);
  };
  return (
    <div style={{ background: S.card, border: `1px solid ${status === "verified" ? S.green : status === "failed" ? S.red : S.borderStrong}`, borderRadius: 14, padding: 16, marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontFamily: S.font, fontSize: 13, fontWeight: 600, color: S.dark }}>📍 Address Verification</span>
        <button onClick={verify} disabled={status === "verifying"} style={{ ...S.btn(status === "verified" ? S.green : S.dark, "#fff"), padding: "6px 16px", fontSize: 12, opacity: status === "verifying" ? 0.6 : 1 }}>
          {status === "verifying" ? "Verifying..." : status === "verified" ? "✓ Verified" : "Verify Address"}
        </button>
      </div>
      {status === "verified" && (
        <div style={{ fontFamily: S.font, fontSize: 12, color: S.green, background: S.greenBg, padding: "8px 12px", borderRadius: 8, lineHeight: 1.5 }}>
          ✅ <strong>Address format check passed:</strong> {resolved}<br />
          This is a local validation preview. Final parcel and mapping verification runs during listing review.
        </div>
      )}
      {status === "failed" && (
        <div style={{ fontFamily: S.font, fontSize: 12, color: S.red, background: S.redBg, padding: "8px 12px", borderRadius: 8 }}>
          ❌ Address could not be verified. Please check the format and try again.
        </div>
      )}
      {status === "idle" && (
        <div style={{ fontFamily: S.font, fontSize: 11, color: S.light }}>
          Click "Verify Address" to run a quick local format check before submission.
        </div>
      )}
    </div>
  );
}

function HousingTrendsWidget() {
  const [state, setState] = useLocalStorageState("estatehat-housing-trends-v1", {
    status: "idle",
    updatedAt: "",
    items: [],
    error: "",
  });

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, status: "loading", error: "" }));
    try {
      const results = await Promise.allSettled(
        HOUSING_TREND_SERIES.map(async (series) => {
          const data = await fetchFredSeries(series.id);
          return {
            ...series,
            date: data.latest.date,
            value: data.latest.value,
            displayValue: series.format(data.latest.value),
            change: data.change,
            changePct: data.changePct,
          };
        })
      );
      const rows = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
      const failures = results.filter((result) => result.status === "rejected").map((result) => result.reason?.message).filter(Boolean);
      if (!rows.length) {
        throw new Error(failures[0] || "Housing trend feeds are unavailable.");
      }
      setState({
        status: failures.length ? "stale" : "ready",
        updatedAt: new Date().toISOString(),
        items: rows,
        error: failures.length ? failures.join(" ") : "",
      });
    } catch (error) {
      setState((current) => {
        const fallbackItems = current.items?.length ? current.items : HOUSING_TREND_FALLBACK_ITEMS;
        return {
          ...current,
          status: "stale",
          updatedAt: current.updatedAt || new Date().toISOString(),
          items: fallbackItems,
          error: `${error?.message || "Housing trend feeds are unavailable."} Showing the latest published official national snapshot instead.`,
        };
      });
    }
  }, [setState]);

  useEffect(() => {
    if (state.status === "loading") {
      setState((current) => ({
        ...current,
        status: current.items?.length ? "stale" : "idle",
      }));
      return;
    }
    const updatedMs = state.updatedAt ? Date.parse(state.updatedAt) : 0;
    const stale = !updatedMs || Date.now() - updatedMs > 6 * 60 * 60 * 1000;
    if (stale) refresh();
  }, [refresh, setState, state.status, state.updatedAt]);

  const items = Array.isArray(state.items) ? state.items : [];
  const updatedLabel = state.updatedAt ? new Date(state.updatedAt).toLocaleString() : "";

  return (
    <Card style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: S.goldDeep }}>
            Housing Trends
          </div>
          <div style={{ fontFamily: S.serif, fontSize: 25, color: S.dark, marginTop: 4 }}>National market pulse</div>
          <div style={{ fontFamily: S.font, fontSize: 12, color: S.light, marginTop: 4 }}>
            Public economic data from FRED. {updatedLabel ? `Last checked ${updatedLabel}.` : "Fetching latest available observations."}
          </div>
        </div>
        <button type="button" onClick={refresh} disabled={state.status === "loading"} style={{ ...S.btn(state.status === "loading" ? S.surface : S.dark, state.status === "loading" ? S.light : S.card), border: `1px solid ${S.border}` }}>
          {state.status === "loading" ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {items.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12 }}>
          {items.map((item) => {
            const higher = Number(item.change) > 0;
            const lower = Number(item.change) < 0;
            const changeText = Number.isFinite(item.change)
              ? `${higher ? "+" : ""}${item.unit === "%" ? Number(item.change).toFixed(2) : Number(item.change).toLocaleString(undefined, { maximumFractionDigits: 1 })}${item.unit === "%" ? " pts" : ""}`
              : "No prior value";
            return (
              <div key={item.id} style={{ border: `1px solid ${S.border}`, borderRadius: 8, padding: 14, background: S.surfaceAlt }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <div style={{ fontFamily: S.font, fontSize: 12, fontWeight: 800, color: S.muted }}>{item.label}</div>
                  <Badge variant={higher ? "warn" : lower ? "verified" : "default"}>{changeText}</Badge>
                </div>
                <div style={{ fontFamily: S.serif, fontSize: 28, color: S.dark, marginTop: 8 }}>{item.displayValue}</div>
                <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.light, lineHeight: 1.45, marginTop: 6 }}>
                  Observation: {item.date}<br />
                  {item.source}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ padding: 18, borderRadius: 8, background: S.surfaceAlt, border: `1px solid ${S.border}`, fontFamily: S.font, fontSize: 13, color: S.light }}>
          Housing trend feeds are not available yet. Use Refresh to retry; no placeholder market values are displayed.
        </div>
      )}
      {state.error && (
        <div style={{ marginTop: 10, fontFamily: S.font, fontSize: 12, color: S.red, background: S.redBg, borderRadius: 8, padding: "8px 10px" }}>
          {state.error}
        </div>
      )}
    </Card>
  );
}


// ═══════════════════════════════════════════
// ─── VIEWS ────────────────────────────────
// ═══════════════════════════════════════════

function StatusBar({ label, value, tone = S.gold }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontFamily: S.font, fontSize: 11.5, color: S.light, fontWeight: 800, marginBottom: 6 }}>
        <span>{label}</span>
        <span>{safeValue}%</span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: S.surface, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${safeValue}%`, background: tone, borderRadius: 999 }} />
      </div>
    </div>
  );
}

function buildActionInboxItems({
  profileCompletion = 0,
  verificationDone = 0,
  verificationTotal = 0,
  legalCompleted = 0,
  legalTotal = 0,
  payoutReadyCount = 0,
  verifiedBillingReadyCount = 0,
  savedListingIds = [],
  savedSearches = [],
  listingsReady = false,
  listingSyncError = "",
  perms = {},
}) {
  const items = [];
  if (profileCompletion < 4) items.push({ id: "profile", title: "Finish profile basics", body: `${profileCompletion}/4 core fields complete`, view: "profile", tone: "warn", priority: "High" });
  if (verificationTotal > 0 && verificationDone < verificationTotal) items.push({ id: "verification", title: "Complete verification checks", body: `${verificationDone}/${verificationTotal} identity checks complete`, view: "profile", tone: "warn", priority: "High" });
  if (legalTotal > 0 && legalCompleted < legalTotal) items.push({ id: "legal", title: "Review required legal steps", body: `${legalCompleted}/${legalTotal} legal controls complete`, view: "profile", tone: "warn", priority: "High" });
  if (payoutReadyCount < 6) items.push({ id: "payout", title: "Activate payout readiness", body: `${payoutReadyCount}/6 payout framework checks ready`, view: "profile", tone: "accent", priority: "Medium" });
  if (verifiedBillingReadyCount < 4) items.push({ id: "billing", title: "Resolve verified billing setup", body: `${verifiedBillingReadyCount}/4 billing checks ready`, view: "profile", tone: "accent", priority: "Medium" });
  if (perms.browse && savedListingIds.length === 0) items.push({ id: "watchlist", title: "Save homes to your watchlist", body: "Shortlist properties before comparing or planning tours", view: "browse", tone: "default", priority: "Low" });
  if (perms.browse && savedSearches.length === 0) items.push({ id: "saved-search", title: "Create a saved search", body: "Reuse important filters without rebuilding them", view: "browse", tone: "default", priority: "Low" });
  if (!listingsReady) items.push({ id: "syncing", title: "Listing sync is still running", body: "Live inventory is loading into the workspace", view: "dashboard", tone: "accent", priority: "Info" });
  if (listingSyncError) items.push({ id: "sync-error", title: "Review listing sync issue", body: listingSyncError, view: "dashboard", tone: "warn", priority: "High" });
  if (items.length === 0) items.push({ id: "clear", title: "No urgent account actions", body: "Core profile, legal, billing, and payout checks look current", view: "dashboard", tone: "verified", priority: "Ready" });
  return items;
}

function RoleAwareDashboardWidgets({ user, perms, listings, savedListingIds, savedSearches, recentViewedIds, onNavigate }) {
  const role = user?.accountType || "buyer";
  const roleLabel = ACCOUNT_TYPES.find((item) => item.key === role)?.label || "EstateHat User";
  const roleMap = {
    buyer: [
      ["Buyer Path", "Find, compare, tour, and draft offers", "Browse", "browse"],
      ["Shortlist", `${savedListingIds.length} saved homes`, "Watchlist", "watchlist"],
      ["Decision Memory", `${recentViewedIds.length} recent views`, "Compare", "compare"],
    ],
    seller: [
      ["Seller Path", "Prepare listings, docs, and offer review", "List", "list"],
      ["Offer Desk", "Compare offer terms and buyer readiness", "Offers", "offer"],
      ["Listing Quality", `${listings.length} marketplace listings visible`, "Browse", "browse"],
    ],
    agent: [
      ["Agent Workspace", "Client discovery, tours, and offer coordination", "Match", "matching"],
      ["Tour Load", "Schedule showings and inspections", "Tours", "tours"],
      ["Deal Support", "Keep transaction context close", "Active Hats", "transaction"],
    ],
    admin: [
      ["Admin Console", "Review docs, flags, and operating queues", "Workbench", "admin-workbench"],
      ["Marketplace", `${listings.length} live listings`, "Browse", "browse"],
      ["Saved Signals", `${savedSearches.length} saved searches`, "Search", "search"],
    ],
    government: [
      ["Oversight", "Review compliance and jurisdiction records", "Admin", "admin"],
      ["Rule Context", "Use FAQ and compliance boundaries", "FAQ", "faq"],
      ["Document Access", "Review permitted records", "Docs", "documents"],
    ],
  };
  const professionalFallback = [
    ["Professional Desk", "Coordinate documents, messages, and milestones", "Messages", "messages"],
    ["Review Queue", "See transaction and document status", "Docs", "documents"],
    ["Profile Trust", "Keep credentials and security current", "My Info", "profile"],
  ];
  const rows = roleMap[role] || (["attorney", "inspector", "lender"].includes(role) ? professionalFallback : roleMap.buyer);
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: S.goldDeep }}>Role-Aware Dashboard</div>
          <div style={{ fontFamily: S.serif, fontSize: 26, color: S.dark, marginTop: 3 }}>{roleLabel} workspace</div>
        </div>
        <Badge variant="type">{role}</Badge>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10 }}>
        {rows.map(([title, body, actionLabel, target]) => (
          <button
            key={title}
            type="button"
            onClick={() => onNavigate(target)}
            disabled={!isViewAllowedForPerms(target, perms)}
            style={{ textAlign: "left", border: `1px solid ${S.border}`, background: S.surfaceAlt, borderRadius: 8, padding: 13, cursor: isViewAllowedForPerms(target, perms) ? "pointer" : "not-allowed", opacity: isViewAllowedForPerms(target, perms) ? 1 : 0.58 }}
          >
            <div style={{ fontFamily: S.font, fontSize: 13, fontWeight: 900, color: S.dark }}>{title}</div>
            <div style={{ fontFamily: S.font, fontSize: 12, color: S.muted, lineHeight: 1.45, marginTop: 5 }}>{body}</div>
            <div style={{ fontFamily: S.font, fontSize: 11, color: S.goldDeep, fontWeight: 900, marginTop: 10 }}>{actionLabel}</div>
          </button>
        ))}
      </div>
    </Card>
  );
}

function DealHealthPanel({ score, blockers = [], onNavigate }) {
  const tone = score >= 82 ? S.green : score >= 58 ? S.gold : S.red;
  const status = score >= 82 ? "Healthy" : score >= 58 ? "Needs Attention" : "Blocked";
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: S.goldDeep }}>Deal Health</div>
          <div style={{ fontFamily: S.serif, fontSize: 30, color: S.dark, marginTop: 4 }}>{score}/100</div>
        </div>
        <Badge variant={score >= 82 ? "verified" : score >= 58 ? "type" : "warn"}>{status}</Badge>
      </div>
      <StatusBar label="Readiness" value={score} tone={tone} />
      <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
        {blockers.slice(0, 4).map((item) => (
          <button key={item.id} type="button" onClick={() => onNavigate(item.view)} style={{ border: `1px solid ${S.border}`, background: item.tone === "warn" ? S.redBg : S.surfaceAlt, borderRadius: 8, padding: "9px 10px", textAlign: "left", cursor: "pointer" }}>
            <div style={{ fontFamily: S.font, fontSize: 12.5, fontWeight: 800, color: S.dark }}>{item.title}</div>
            <div style={{ fontFamily: S.font, fontSize: 11.5, color: item.tone === "warn" ? S.red : S.light, marginTop: 2 }}>{item.body}</div>
          </button>
        ))}
      </div>
      <button type="button" onClick={() => onNavigate("transaction")} style={{ ...S.btn(S.dark, S.card), width: "100%", marginTop: 14 }}>Open Active Hats</button>
    </Card>
  );
}

function ActionInboxPanel({ items = [], onNavigate, title = "Action Inbox" }) {
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: S.goldDeep }}>{title}</div>
          <div style={{ fontFamily: S.font, fontSize: 12, color: S.light, marginTop: 3 }}>One place for account, deal, document, and money next steps.</div>
        </div>
        <Badge variant="type">{items.length}</Badge>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {items.map((item) => (
          <button key={item.id} type="button" onClick={() => onNavigate(item.view)} style={{ width: "100%", border: `1px solid ${S.border}`, borderLeft: `4px solid ${item.tone === "warn" ? S.red : item.tone === "verified" ? S.green : S.gold}`, background: item.tone === "warn" ? S.redBg : item.tone === "verified" ? S.greenBg : S.surfaceAlt, borderRadius: 8, padding: "10px 12px", textAlign: "left", cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
              <div>
                <div style={{ fontFamily: S.font, fontSize: 13, fontWeight: 900, color: S.dark }}>{item.title}</div>
                <div style={{ fontFamily: S.font, fontSize: 12, color: S.muted, lineHeight: 1.45, marginTop: 3 }}>{item.body}</div>
              </div>
              <Badge variant={item.tone === "warn" ? "warn" : item.tone === "verified" ? "verified" : "type"}>{item.priority}</Badge>
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
}

function ActionInboxView({
  onNavigate,
  user,
  perms,
  listings = [],
  savedListingIds = [],
  savedSearches = [],
  recentViewedIds = [],
  listingsReady,
  listingSyncError,
}) {
  const isCompact = useMediaQuery("(max-width: 900px)");
  const legalComponents = user?.legal?.components || {};
  const legalKeys = Object.keys(legalComponents);
  const legalCompleted = legalKeys.filter((key) => isLegalComponentComplete(key, legalComponents[key])).length;
  const profileCompletion = [user?.name, user?.email, user?.phone, user?.address].filter((value) => String(value || "").trim()).length;
  const verificationSteps = user?.verification?.stepStatus || {};
  const verificationKeys = Object.keys(verificationSteps);
  const verificationDone = verificationKeys.filter((key) => !!verificationSteps[key]).length;
  const trustedEligible = hasTrustedProfileEligibility(user || {});
  const payoutFramework = user?.payoutFramework || {};
  const payoutCompliance = payoutFramework.compliance || {};
  const payoutAccounts = payoutFramework.accounts || {};
  const payoutProvider = payoutFramework.providerPrimary || "stripe_connect";
  const payoutProviderConnected =
    (payoutProvider === "stripe_connect" && !!payoutAccounts.stripeOnboardingComplete) ||
    (payoutProvider === "square" && !!payoutAccounts.squareMerchantId) ||
    (payoutProvider === "paypal" && !!payoutAccounts.paypalPayoutsEmail) ||
    (payoutProvider === "adyen" && !!payoutAccounts.adyenAccountCode);
  const payoutReadyCount = [profileCompletion >= 4, !!payoutCompliance.kycComplete, !!payoutCompliance.tosAccepted, !!payoutCompliance.bankAccountLinked, !!payoutCompliance.riskReviewComplete, !!payoutProviderConnected].filter(Boolean).length;
  const verifiedBillingCompliance = user?.verifiedBilling?.compliance || {};
  const verifiedBillingReadyCount = [trustedEligible, legalKeys.length === 0 ? true : legalCompleted >= legalKeys.length, !!verifiedBillingCompliance.paymentMethodSaved, !!verifiedBillingCompliance.fraudReviewClear].filter(Boolean).length;
  const items = buildActionInboxItems({ profileCompletion, verificationDone, verificationTotal: verificationKeys.length, legalCompleted, legalTotal: legalKeys.length, payoutReadyCount, verifiedBillingReadyCount, savedListingIds, savedSearches, listingsReady, listingSyncError, perms });
  const dealHealthScore = Math.round((profileCompletion / 4) * 20 + (verificationKeys.length ? verificationDone / verificationKeys.length : 1) * 20 + (legalKeys.length ? legalCompleted / legalKeys.length : 1) * 20 + (payoutReadyCount / 6) * 20 + (verifiedBillingReadyCount / 4) * 20);

  return (
    <div style={{ maxWidth: 1120, margin: "0 auto", padding: 24 }}>
      <SectionHeader title="Action Inbox" sub="A unified queue for profile, verification, document, deal, billing, and discovery next steps." />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 16 }}>
        {[
          ["Open items", items.filter((item) => item.id !== "clear").length],
          ["Deal health", `${dealHealthScore}/100`],
          ["Saved homes", savedListingIds.length],
          ["Recent views", recentViewedIds.length],
          ["Live listings", listings.length],
        ].map(([label, value]) => (
          <Card key={label} style={{ padding: 15 }}>
            <div style={{ fontFamily: S.font, fontSize: 11, color: S.light, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1.2 }}>{label}</div>
            <div style={{ fontFamily: S.serif, fontSize: 30, color: S.dark, marginTop: 5 }}>{value}</div>
          </Card>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "minmax(0,1.2fr) minmax(280px,0.8fr)", gap: 14 }}>
        <ActionInboxPanel items={items} onNavigate={onNavigate} title="Priority Queue" />
        <DealHealthPanel score={dealHealthScore} blockers={items} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

function EstateHatMobileBottomNav({ activeView, onNavigate, savedCount = 0, perms = {}, visible = false }) {
  if (!visible) return null;
  const items = [
    { label: "Board", view: "dashboard", badge: 0 },
    { label: "Inbox", view: "action-inbox", badge: 0 },
    { label: "Browse", view: "browse", badge: 0, permKey: "browse" },
    { label: "Docs", view: "documents", badge: 0, permKey: "transaction" },
    { label: "Saved", view: "watchlist", badge: savedCount, permKey: "browse" },
  ].filter((item) => !item.permKey || perms[item.permKey]);

  return (
    <div style={{ position: "fixed", left: 10, right: 10, bottom: 10, zIndex: 180, background: "rgba(17,21,17,0.96)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 6, boxShadow: "0 18px 45px rgba(0,0,0,0.32)", display: "grid", gridTemplateColumns: `repeat(${items.length}, minmax(0,1fr))`, gap: 4 }}>
      {items.map((item) => {
        const active = activeView === item.view;
        return (
          <button key={item.view} type="button" onClick={() => onNavigate(item.view)} style={{ border: "none", borderRadius: 10, background: active ? "rgba(212,160,83,0.2)" : "transparent", color: active ? S.gold : S.navText, fontFamily: S.font, fontSize: 10.5, fontWeight: 900, padding: "8px 4px 7px", cursor: "pointer", minWidth: 0, display: "grid", gap: 2, placeItems: "center", position: "relative" }}>
            <span style={{ width: 5, height: 5, borderRadius: 99, background: active ? S.gold : "rgba(255,255,255,0.38)" }} />
            <span style={{ whiteSpace: "nowrap", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>
            {item.badge > 0 && <span style={{ position: "absolute", transform: "translate(18px,-12px)", background: S.red, color: "#fff", borderRadius: 99, padding: "1px 5px", fontSize: 9 }}>{item.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}

function HatBoardView({
  onNavigate,
  user,
  perms = {},
  listings = [],
  savedListingIds = [],
  recentViewedIds = [],
  savedSearches = [],
  listingsReady = false,
  listingSyncError = "",
}) {
  const isCompact = useMediaQuery("(max-width: 820px)");
  const boardThreeCol = useMediaQuery("(min-width: 1180px)");
  const legalComponents = user?.legal?.components || {};
  const legalKeys = Object.keys(legalComponents);
  const legalCompleted = legalKeys.filter((key) => isLegalComponentComplete(key, legalComponents[key])).length;
  const profileCompletion = [user?.name, user?.email, user?.phone, user?.address].filter((value) => String(value || "").trim()).length;
  const verificationSteps = user?.verification?.stepStatus || {};
  const verificationKeys = Object.keys(verificationSteps);
  const verificationDone = verificationKeys.filter((key) => !!verificationSteps[key]).length;
  const trustedEligible = hasTrustedProfileEligibility(user || {});
  const trustedActive =
    !!user?.trust?.verifiedProfileActive &&
    user?.trust?.verifiedProfileVisibility !== false &&
    trustedEligible;
  const payoutFramework = user?.payoutFramework || {};
  const payoutCompliance = payoutFramework.compliance || {};
  const payoutAccounts = payoutFramework.accounts || {};
  const payoutProvider = payoutFramework.providerPrimary || "stripe_connect";
  const payoutProviderConnected =
    (payoutProvider === "stripe_connect" && !!payoutAccounts.stripeOnboardingComplete) ||
    (payoutProvider === "square" && !!payoutAccounts.squareMerchantId) ||
    (payoutProvider === "paypal" && !!payoutAccounts.paypalPayoutsEmail) ||
    (payoutProvider === "adyen" && !!payoutAccounts.adyenAccountCode);
  const payoutChecks = [
    profileCompletion >= 4,
    !!payoutCompliance.kycComplete,
    !!payoutCompliance.tosAccepted,
    !!payoutCompliance.bankAccountLinked,
    !!payoutCompliance.riskReviewComplete,
    !!payoutProviderConnected,
  ];
  const payoutReadyCount = payoutChecks.filter(Boolean).length;
  const verifiedBilling = user?.verifiedBilling || {};
  const verifiedBillingCompliance = verifiedBilling.compliance || {};
  const verifiedBillingChecks = [
    trustedEligible,
    legalKeys.length === 0 ? true : legalCompleted >= legalKeys.length,
    !!verifiedBillingCompliance.paymentMethodSaved,
    !!verifiedBillingCompliance.fraudReviewClear,
  ];
  const verifiedBillingReadyCount = verifiedBillingChecks.filter(Boolean).length;
  const actionInboxItems = buildActionInboxItems({
    profileCompletion,
    verificationDone,
    verificationTotal: verificationKeys.length,
    legalCompleted,
    legalTotal: legalKeys.length,
    payoutReadyCount,
    verifiedBillingReadyCount,
    savedListingIds,
    savedSearches,
    listingsReady,
    listingSyncError,
    perms,
  });
  const dealHealthScore = Math.round(
    (profileCompletion / 4) * 20 +
    (verificationKeys.length ? verificationDone / verificationKeys.length : 1) * 20 +
    (legalKeys.length ? legalCompleted / legalKeys.length : 1) * 20 +
    (payoutReadyCount / 6) * 20 +
    (verifiedBillingReadyCount / 4) * 20
  );

  const widgets = [
    {
      title: "Trusted User",
      value: trustedActive ? "Active" : trustedEligible ? "Ready" : "Locked",
      detail: trustedActive ? "Green badge visible to users" : "Complete profile, legal, and checks",
      tone: trustedActive ? "verified" : trustedEligible ? "type" : "warn",
      action: () => onNavigate("profile"),
      actionLabel: "Manage",
    },
    {
      title: "Profile Completion",
      value: `${profileCompletion}/4`,
      detail: "Core identity fields",
      tone: profileCompletion >= 4 ? "verified" : "warn",
      action: () => onNavigate("profile"),
      actionLabel: "Finish Profile",
    },
    {
      title: "Verification",
      value: `${verificationDone}/${verificationKeys.length || 0}`,
      detail: "Identity and account checks",
      tone: verificationKeys.length > 0 && verificationDone >= verificationKeys.length ? "verified" : "type",
      action: () => onNavigate("profile"),
      actionLabel: "Open Checks",
    },
    {
      title: "Legal Steps",
      value: `${legalCompleted}/${legalKeys.length || 0}`,
      detail: "Required legal controls",
      tone: legalKeys.length > 0 && legalCompleted >= legalKeys.length ? "verified" : "warn",
      action: () => onNavigate("profile"),
      actionLabel: "Review Legal",
    },
    {
      title: "Payout Framework",
      value: `${payoutReadyCount}/6`,
      detail: `Status: ${payoutFramework.status || "setup"}`,
      tone: payoutReadyCount === 6 ? "verified" : "warn",
      action: () => onNavigate("profile"),
      actionLabel: "Configure",
    },
    {
      title: "Verified Billing",
      value: `${verifiedBillingReadyCount}/4`,
      detail: `Status: ${verifiedBilling.status || "setup"}`,
      tone: verifiedBillingReadyCount === 4 ? "verified" : "type",
      action: () => onNavigate("profile"),
      actionLabel: "Manage",
    },
    {
      title: "Watchlist",
      value: `${savedListingIds.length}`,
      detail: "Saved properties",
      tone: savedListingIds.length > 0 ? "type" : "default",
      action: () => onNavigate("watchlist"),
      actionLabel: "Open",
    },
    {
      title: "Live Listings",
      value: listingsReady ? `${listings.length}` : "Syncing",
      detail: listingSyncError ? "Sync issue detected" : "Marketplace inventory",
      tone: listingSyncError ? "warn" : "verified",
      action: () => onNavigate("browse"),
      actionLabel: "Browse",
    },
  ];

  const priorityActions = [
    { label: "Complete profile basics", done: profileCompletion >= 4, nav: "profile" },
    { label: "Finish verification checks", done: verificationKeys.length > 0 && verificationDone >= verificationKeys.length, nav: "profile" },
    { label: "Finish legal steps", done: legalKeys.length > 0 && legalCompleted >= legalKeys.length, nav: "profile" },
    { label: "Activate payout framework", done: payoutReadyCount === 6, nav: "profile" },
    { label: "Activate verified profile billing", done: verifiedBillingReadyCount === 4, nav: "profile" },
  ];
  const nextAction = priorityActions.find((item) => !item.done);

  return (
    <div className="estatehat-dashboard" style={{ padding: 24, maxWidth: 1280, margin: "0 auto" }}>
      <SectionHeader
        title="Hat Board"
        sub="Most important account, trust, legal, and payout indicators in one place."
      />

      <Card style={{ marginBottom: 18, padding: isCompact ? 16 : 18, background: "linear-gradient(180deg, rgba(255,251,245,0.98), rgba(246,239,227,0.96))" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: S.goldDeep }}>
              Snapshot
            </div>
            <div style={{ fontFamily: S.serif, fontSize: 30, color: S.dark, marginTop: 4 }}>Welcome back, {user?.name?.split(" ")[0] || "User"}</div>
            <div style={{ fontFamily: S.font, fontSize: 12.5, color: S.muted, marginTop: 6 }}>
              Account type: <strong style={{ color: S.dark }}>{ACCOUNT_TYPES.find((a) => a.key === user?.accountType)?.label || "User"}</strong>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => onNavigate("profile")} style={S.btn(S.dark, S.card)}>My Info</button>
            {perms.transaction && <button onClick={() => onNavigate("transaction")} style={S.btn(S.gold, S.dark)}>My Active Hats</button>}
            {perms.messages && <button onClick={() => onNavigate("messages")} style={S.btn(S.surfaceAlt, S.dark)}>Messages</button>}
            {perms.browse && <button onClick={() => onNavigate("browse")} style={S.btn(S.surfaceAlt, S.dark)}>Browse</button>}
          </div>
        </div>
      </Card>

      <Card className="estatehat-dashboard-next" style={{ marginBottom: 18, padding: isCompact ? 16 : 22 }}>
        <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "minmax(0,1fr) auto", alignItems: "center", gap: 18 }}>
          <div>
            <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: S.goldDeep, marginBottom: 6 }}>Your next step</div>
            <div style={{ fontFamily: S.serif, fontSize: isCompact ? 23 : 28, color: S.dark, lineHeight: 1.15 }}>
              {nextAction ? nextAction.label : "Your account setup is in good shape"}
            </div>
            <div style={{ fontFamily: S.font, fontSize: 13, color: S.muted, marginTop: 6 }}>
              {nextAction ? "Complete this first to unlock a smoother path through your workspace." : "Your key profile, verification, legal, and payment setup checks are complete."}
            </div>
          </div>
          <button type="button" onClick={() => onNavigate(nextAction?.nav || "browse")} style={{ ...S.btn(S.gold, S.dark), minWidth: isCompact ? "100%" : 180 }}>
            {nextAction ? "Continue setup →" : "Explore listings →"}
          </button>
          <div style={{ gridColumn: "1 / -1" }}>
            <div className="estatehat-dashboard-next-track" role="progressbar" aria-label="Account readiness" aria-valuemin={0} aria-valuemax={100} aria-valuenow={dealHealthScore}>
              <span style={{ width: `${dealHealthScore}%` }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 7, fontFamily: S.font, fontSize: 11, color: S.muted }}>
              <span>Account readiness</span><strong style={{ color: S.dark }}>{dealHealthScore}%</strong>
            </div>
          </div>
        </div>
      </Card>

      <HousingTrendsWidget />

      <div style={{ display: "grid", gridTemplateColumns: boardThreeCol ? "repeat(3,minmax(0,1fr))" : isCompact ? "1fr" : "1.05fr 0.95fr", gap: 14, alignItems: "start" }}>
        <RoleAwareDashboardWidgets
          user={user}
          perms={perms}
          listings={listings}
          savedListingIds={savedListingIds}
          savedSearches={savedSearches}
          recentViewedIds={recentViewedIds}
          onNavigate={onNavigate}
        />
        <ActionInboxPanel items={actionInboxItems.slice(0, 5)} onNavigate={onNavigate} />
        <DealHealthPanel score={dealHealthScore} blockers={actionInboxItems} onNavigate={onNavigate} />

        <Card>
          <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: S.goldDeep, marginBottom: 10 }}>
            Account Signals
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : boardThreeCol ? "1fr 1fr" : "1fr 1fr", gap: 12 }}>
            {widgets.map((widget) => (
              <div key={widget.title} style={{ padding: 16, borderRadius: 12, background: S.surfaceAlt, border: `1px solid ${S.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ fontFamily: S.font, fontSize: 12, fontWeight: 700, color: S.light, letterSpacing: 0.4 }}>{widget.title}</div>
                  <Badge variant={widget.tone}>{widget.value}</Badge>
                </div>
                <div style={{ fontFamily: S.font, fontSize: 12, color: S.muted, lineHeight: 1.5, marginBottom: 10 }}>{widget.detail}</div>
                <button onClick={widget.action} style={{ ...S.btn(S.card, S.dark), width: "100%", border: `1px solid ${S.border}` }}>
                  {widget.actionLabel}
                </button>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: S.goldDeep, marginBottom: 8 }}>
            Priority Checklist
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {priorityActions.map((item) => (
              <button
                key={item.label}
                onClick={() => onNavigate(item.nav)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: `1px solid ${item.done ? `${S.green}44` : S.border}`,
                  borderRadius: 12,
                  padding: "10px 12px",
                  background: item.done ? S.greenBg : S.surfaceAlt,
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span style={{ fontFamily: S.font, fontSize: 12.5, fontWeight: 700, color: S.dark }}>{item.label}</span>
                <Badge variant={item.done ? "verified" : "warn"}>{item.done ? "Done" : "Pending"}</Badge>
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: S.goldDeep, marginBottom: 8 }}>
            Activity
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {[
              ["Saved searches", savedSearches.length],
              ["Recent views", recentViewedIds.length],
              ["Watchlist items", savedListingIds.length],
              ["Listings available", listings.length],
            ].map(([label, value]) => (
              <div key={label} style={{ padding: "10px 12px", borderRadius: 12, background: S.surfaceAlt, border: `1px solid ${S.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: S.font, fontSize: 12.5, color: S.muted }}>{label}</span>
                <span style={{ fontFamily: S.font, fontSize: 14, fontWeight: 700, color: S.dark }}>{value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: S.goldDeep, marginBottom: 8 }}>
            Quick Access
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {[
              { label: "Open My Info", detail: "Profile, trust, legal, and payout controls", nav: "profile" },
              { label: "Open My Active Hats", detail: "Deals, timelines, and closing milestones", nav: "transaction", allowed: perms.transaction },
              { label: "Open Messages", detail: "Shared conversations and updates", nav: "messages", allowed: perms.messages },
              { label: "Browse Listings", detail: "Marketplace inventory and saved searches", nav: "browse", allowed: perms.browse },
              { label: "Open Assistant", detail: "Jump directly to the next workflow", nav: "help" },
            ].filter((item) => item.allowed !== false).map((item) => (
              <button
                key={item.label}
                onClick={() => onNavigate(item.nav)}
                style={{ width: "100%", textAlign: "left", border: `1px solid ${S.border}`, borderRadius: 12, padding: "10px 12px", background: S.surfaceAlt, cursor: "pointer" }}
              >
                <div style={{ fontFamily: S.font, fontSize: 12.5, fontWeight: 700, color: S.dark }}>{item.label}</div>
                <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.muted, lineHeight: 1.45, marginTop: 3 }}>{item.detail}</div>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function HomeView({ onNavigate, user, listings = [], savedListingIds = [], recentViewedIds = [], savedSearches = [], onToggleSave }) {
  const [search, setSearch] = useState("");
  const isCompact = useMediaQuery("(max-width: 820px)");
  const watchlistListings = useMemo(() => listings.filter((listing) => savedListingIds.includes(listing.id)).slice(0, 3), [listings, savedListingIds]);
  const recentListings = useMemo(() => recentViewedIds.map((id) => listings.find((listing) => listing.id === id)).filter(Boolean).slice(0, 3), [listings, recentViewedIds]);
  const avgPrice = useMemo(() => {
    if (!listings.length) return 0;
    const total = listings.reduce((sum, listing) => sum + (Number(listing.price) || 0), 0);
    return Math.round(total / listings.length);
  }, [listings]);
  const verifiedCount = useMemo(() => listings.filter((listing) => !!listing.verified).length, [listings]);
  const liveStats = [
    [listings.length.toLocaleString(), "Live Listings"],
    [avgPrice ? fmt(avgPrice) : "-", "Average Price"],
    [`${verifiedCount}/${listings.length || 0}`, "Verified Sellers"],
    [savedListingIds.length.toString(), "Saved Homes"],
  ];
  const featureCategories = useMemo(() => ([
    {
      key: "discover",
      title: "Discovery",
      desc: "Search, shortlist, and return to the right properties quickly.",
      items: [
        { label: "Browse Listings", detail: "Live property inventory", nav: "browse" },
        { label: "Watchlist", detail: `${savedListingIds.length} saved`, nav: "watchlist" },
        { label: "Saved Searches", detail: `${savedSearches.length} saved`, nav: "browse" },
        { label: "Recent Views", detail: `${recentViewedIds.length} tracked`, nav: "browse" },
      ],
    },
    {
      key: "dealflow",
      title: "Deal Flow",
      desc: "Everything needed to move from offer to closing.",
      items: [
        { label: "My Active Hats", detail: "Checklist and milestones", nav: "transaction" },
        { label: "Messages", detail: "Conversation timeline", nav: "messages" },
        { label: "List Property", detail: "Seller intake flow", nav: "list" },
        { label: "Forms", detail: "Transaction docs", nav: "boilerplates" },
      ],
    },
    {
      key: "account",
      title: "Account & Security",
      desc: "Profile controls, verification, and account posture.",
      items: [
        { label: "My Info", detail: "Identity and role profile", nav: "profile" },
        { label: "Security Center", detail: "Session and device settings", nav: "profile" },
        { label: "Verification Status", detail: "Readiness checkpoints", nav: "profile" },
      ],
    },
    {
      key: "finance",
      title: "Finance & Planning",
      desc: "Fee visibility and planning tools.",
      items: [
        { label: "Calculator", detail: "Mortgage + closing estimate", nav: "calculator" },
        { label: "Fee Model", detail: "Flat 1.50% + escrow/wire", nav: "calculator" },
      ],
    },
    {
      key: "support",
      title: "Support & Governance",
      desc: "Policies, guidance, and operational oversight.",
      items: [
        { label: "Help Center", detail: "Guides and FAQs", nav: "help" },
        { label: "About EstateHat", detail: "Trust and company details", nav: "about" },
      ],
    },
  ]), [recentViewedIds.length, savedListingIds.length, savedSearches.length]);
  const openAssistant = (topic = "navigate") => {
    try {
      window.dispatchEvent(new CustomEvent("estatehat-assistant-open", { detail: { topic } }));
    } catch {
      // Ignore event dispatch failures.
    }
  };
  return (
    <div>
      <div style={{ background: `linear-gradient(160deg, ${S.primary} 0%, ${S.primaryMid} 48%, ${S.nav} 100%)`, padding: "80px 24px 70px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 30% 20%, rgba(212,160,83,0.08) 0%, transparent 60%)" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontFamily: S.font, fontSize: 12, letterSpacing: 4, textTransform: "uppercase", color: S.gold, marginBottom: 16, fontWeight: 600 }}>
            Buy · Sell · Close — All Peer-to-Peer
          </div>
          <h1 style={{ fontFamily: S.serif, fontSize: "clamp(32px,5vw,52px)", color: S.navText, margin: "0 0 12px", lineHeight: 1.15 }}>
            Real Estate,<br />A Place Where You Can Hang Your Hat
          </h1>
          <p style={{ fontFamily: S.font, fontSize: 16, color: S.light, maxWidth: 500, margin: "0 auto 36px", lineHeight: 1.6 }}>
            Buy and sell with clear steps, reviewed paperwork, and licensed escrow support so the process feels easier to follow.
          </p>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.16)", color: "#efe3d0", fontFamily: S.font, fontSize: 12, marginBottom: 16 }}>
            <span>✓</span>
            Verified users, audited controls, and encrypted data handling
          </div>
          <div style={{ display: "flex", flexDirection: isCompact ? "column" : "row", gap: 10, maxWidth: 520, margin: "0 auto", background: S.card, borderRadius: 14, padding: 6, boxShadow: "0 8px 30px rgba(0,0,0,0.2)" }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by city, ZIP, or address..." style={{ flex: 1, border: "none", outline: "none", padding: "14px 16px", fontSize: 15, fontFamily: S.font, background: "transparent", color: S.dark }} />
            <button onClick={() => onNavigate("browse", search)} style={{ ...S.btn(S.gold, S.dark), width: isCompact ? "100%" : "auto" }}>Search</button>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 48, padding: "36px 24px", background: S.surfaceAlt, flexWrap: "wrap" }}>
        {liveStats.map(([val, lbl]) => (
          <div key={lbl} style={{ textAlign: "center" }}>
            <div style={{ fontFamily: S.serif, fontSize: 28, color: S.dark }}>{val}</div>
            <div style={{ fontFamily: S.font, fontSize: 12, color: S.light, letterSpacing: 0.5 }}>{lbl}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: "18px 24px 30px", maxWidth: 960, margin: "0 auto" }}>
        <Card style={{ padding: isCompact ? 16 : 18, background: "linear-gradient(180deg, rgba(255,251,245,0.98), rgba(246,239,227,0.96))" }}>
          <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: S.goldDeep, fontWeight: 800, marginBottom: 6 }}>
            Start Here
          </div>
          <div style={{ fontFamily: S.serif, fontSize: isCompact ? 24 : 28, color: S.dark, marginBottom: 8 }}>
            Not sure what to do first?
          </div>
          <p style={{ fontFamily: S.font, fontSize: 13, color: S.muted, margin: "0 0 12px", lineHeight: 1.6 }}>
            Use the EstateHat Assistant. Tell it your goal and it takes you to the right place in one step.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "repeat(4,minmax(0,1fr))", gap: 8 }}>
            <button onClick={() => openAssistant("buy")} style={{ ...S.btn(S.dark, S.card), textAlign: "left", borderRadius: 10, justifyContent: "flex-start" }}>I want to buy</button>
            <button onClick={() => openAssistant("sell")} style={{ ...S.btn(S.dark, S.card), textAlign: "left", borderRadius: 10, justifyContent: "flex-start" }}>I want to sell</button>
            <button onClick={() => openAssistant("setup")} style={{ ...S.btn(S.surfaceAlt, S.dark), textAlign: "left", borderRadius: 10, border: `1px solid ${S.border}` }}>Set up my account</button>
            <button onClick={() => openAssistant("trust")} style={{ ...S.btn(S.surfaceAlt, S.dark), textAlign: "left", borderRadius: 10, border: `1px solid ${S.border}` }}>Why trust this site?</button>
          </div>
        </Card>
      </div>

      <div style={{ padding: "48px 24px 20px", maxWidth: 960, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 24 }}>
          <h2 style={S.sectionTitle}>Hat Spotlights</h2>
          <button onClick={() => onNavigate("browse")} style={{ background: "none", border: "none", fontFamily: S.font, fontSize: 14, color: S.gold, cursor: "pointer", fontWeight: 600 }}>View All →</button>
        </div>
        {listings.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 20 }}>
            {listings.slice(0, 3).map((l) => <PropertyCard key={l.id} listing={l} onClick={() => onNavigate("detail", l.id)} isSaved={savedListingIds.includes(l.id)} onToggleSave={onToggleSave} />)}
          </div>
        ) : (
          <Card style={{ textAlign: "center", padding: 28 }}>
            <div style={{ fontFamily: S.serif, fontSize: 24, color: S.dark, marginBottom: 8 }}>Listings Are Coming Online</div>
            <div style={{ fontFamily: S.font, fontSize: 13, color: S.light, lineHeight: 1.6 }}>
              No published listings are available yet. Check back shortly as new inventory is reviewed and published.
            </div>
          </Card>
        )}
      </div>

      <div style={{ padding: "0 24px 40px", maxWidth: 960, margin: "0 auto" }}>
        <h2 style={{ ...S.sectionTitle, textAlign: "center", marginBottom: 24 }}>Your EstateHat Updates</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16, marginBottom: 24 }}>
          {[
            ["Saved Homes", savedListingIds.length, "Open watchlist anytime to compare properties and return faster."],
            ["Recent Views", recentViewedIds.length, "Recently viewed listings stay close so you can pick back up quickly."],
            ["Saved Searches", savedSearches.length, "Keep the filters you care about and reuse them in one tap."],
          ].map(([title, value, desc]) => (
            <Card key={title}>
              <div style={{ fontFamily: S.serif, fontSize: 28, color: S.dark, marginBottom: 6 }}>{value}</div>
              <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 14, color: S.dark, marginBottom: 6 }}>{title}</div>
              <div style={{ fontFamily: S.font, fontSize: 12, color: S.light, lineHeight: 1.6 }}>{desc}</div>
            </Card>
          ))}
        </div>
        {watchlistListings.length > 0 && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
              <h3 style={{ fontFamily: S.serif, fontSize: 28, color: S.dark }}>Saved For Later</h3>
              <button onClick={() => onNavigate("watchlist")} style={{ background: "none", border: "none", fontFamily: S.font, fontSize: 14, color: S.gold, cursor: "pointer", fontWeight: 600 }}>Open Watchlist →</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 20, marginBottom: 24 }}>
              {watchlistListings.map((listing) => (
                <PropertyCard key={listing.id} listing={listing} onClick={() => onNavigate("detail", listing.id)} isSaved={true} onToggleSave={onToggleSave} />
              ))}
            </div>
          </>
        )}
        {recentListings.length > 0 && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
              <h3 style={{ fontFamily: S.serif, fontSize: 28, color: S.dark }}>Recently Viewed</h3>
              <button onClick={() => onNavigate("browse")} style={{ background: "none", border: "none", fontFamily: S.font, fontSize: 14, color: S.gold, cursor: "pointer", fontWeight: 600 }}>Continue Browsing →</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 20 }}>
              {recentListings.map((listing) => (
                <PropertyCard key={listing.id} listing={listing} onClick={() => onNavigate("detail", listing.id)} isSaved={savedListingIds.includes(listing.id)} onToggleSave={onToggleSave} />
              ))}
            </div>
          </>
        )}
      </div>

      <div style={{ padding: "48px 24px 60px", maxWidth: 960, margin: "0 auto" }}>
        <h2 style={{ ...S.sectionTitle, textAlign: "center", marginBottom: 36 }}>How It Works</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 20 }}>
          {[
            ["🪪", "Confirm Your Information", "Take care of the identity and account checks needed before you move into a live deal."],
            ["🔍", "Browse Homes", "Search listings with clear property details, photos, and seller information."],
            ["🤝", "Make an Offer", "Share offers, paperwork, and updates in one place as the deal takes shape."],
            ["🔒", "Close with Escrow", "Work through the final steps with licensed escrow support and clear reminders along the way."],
          ].map(([icon, title, desc]) => (
            <Card key={title} style={{ textAlign: "center", padding: 20 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
              <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 15, color: S.dark, marginBottom: 8 }}>{title}</div>
              <div style={{ fontFamily: S.font, fontSize: 13, color: S.muted, lineHeight: 1.5 }}>{desc}</div>
            </Card>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 24px 40px", maxWidth: 960, margin: "0 auto" }}>
        <h2 style={{ ...S.sectionTitle, textAlign: "center", marginBottom: 8 }}>Feature Map</h2>
        <p style={{ ...S.sectionSub, textAlign: "center", maxWidth: 620, margin: "0 auto 22px" }}>
          Micro features are grouped under top-level product categories so navigation stays lean and predictable.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
          {featureCategories.map((category) => (
            <Card key={category.key} style={{ padding: 16 }}>
              <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: S.goldDeep, fontWeight: 800, marginBottom: 6 }}>
                {category.title}
              </div>
              <div style={{ fontFamily: S.font, fontSize: 12, color: S.light, lineHeight: 1.5, marginBottom: 10 }}>{category.desc}</div>
              <div style={{ display: "grid", gap: 8 }}>
                {category.items.map((item) => (
                  <button
                    key={`${category.key}-${item.label}`}
                    onClick={() => onNavigate(item.nav)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      border: `1px solid ${S.border}`,
                      borderRadius: 10,
                      background: S.surfaceAlt,
                      padding: "10px 12px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <span style={{ fontFamily: S.font, fontSize: 12.5, fontWeight: 700, color: S.dark }}>{item.label}</span>
                    <span style={{ fontFamily: S.font, fontSize: 11, color: S.muted }}>{item.detail}</span>
                  </button>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>

      <HomeWorkspace user={user} onNavigate={onNavigate} />

      {/* Trust Signals */}
      <div style={{ padding: "32px 24px", background: S.surfaceAlt }}>
        <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", justifyContent: "center", gap: 32, flexWrap: "wrap" }}>
          {[
            ["🇺🇸", "U.S. Verified Only"],
            ["🔒", "AES-256 Encrypted"],
            ["🛡️", "Background Checked"],
            ["⚖️", "Licensed Escrow"],
            ["📋", "18-Point Checklist"],
            ["💰", "1.50% Flat Fee"],
          ].map(([icon, label]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>{icon}</span>
              <span style={{ fontFamily: S.font, fontSize: 12, fontWeight: 600, color: S.muted }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const MOMENT_EXPIRATION_MS = 180 * 24 * 60 * 60 * 1000;

function HomeWorkspace({ user, onNavigate }) {
  const [showQR, setShowQR] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [lastNote, setLastNote] = useState("");
  const [scheduleDraft, setScheduleDraft] = useState("");
  const [scheduledItems, setScheduledItems] = useState([]);
  const noteRef = useRef(null);
  const scheduleRef = useRef(null);

  const walletHistory = useMemo(
    () => [
      { id: "bal1", title: "Escrow release", amount: 1240, date: "Apr 1, 2026", method: "ACH", status: "Settled" },
      { id: "bal2", title: "Inspection credit hold", amount: -200, date: "Mar 27, 2026", method: "Licensed Escrow", status: "Processing" },
      { id: "bal3", title: "Closing wire received", amount: 680, date: "Mar 12, 2026", method: "Wire", status: "Settled" },
    ],
    []
  );
  const walletBalance = walletHistory.reduce((sum, entry) => sum + entry.amount, 0);
  const now = Date.now();
  const feedPosts = [
    {
      id: "m1",
      title: "Offer package delivered",
      body: "Buyer disclosures, proof of funds, and timing notes were shared in one update.",
      createdAt: now - 12 * 24 * 60 * 60 * 1000,
      image: "",
    },
    {
      id: "m2",
      title: "Inspection window opened",
      body: "Inspection access details and repair notes were posted for both sides.",
      createdAt: now - 60 * 24 * 60 * 60 * 1000,
      image: "",
    },
    {
      id: "m3",
      title: "Title review in progress",
      body: "Escrow requested one final document before the closing file can be cleared.",
      createdAt: now - 210 * 24 * 60 * 60 * 1000,
      image: "",
    },
  ];
  const visiblePosts = feedPosts.filter((post) => now - post.createdAt <= MOMENT_EXPIRATION_MS);
  const expiredPosts = feedPosts.filter((post) => now - post.createdAt > MOMENT_EXPIRATION_MS);

  const handleSaveNote = () => {
    if (!noteDraft.trim()) return;
    setLastNote(noteDraft.trim());
    setNoteDraft("");
  };

  const handleSchedule = () => {
    if (!scheduleDraft) return;
    setScheduledItems((prev) => [...prev, { id: Date.now().toString(), when: scheduleDraft, label: "Property milestone" }]);
    setScheduleDraft("");
  };

  const utilityActions = [
    { label: "Calculator", icon: "🧮", action: () => onNavigate("calculator"), description: "Open the mortgage calculator." },
    { label: "Notes", icon: "🗒️", action: () => noteRef.current?.focus(), description: "Capture quick reminders right here." },
    { label: "Scheduler", icon: "📅", action: () => scheduleRef.current?.focus(), description: "Schedule tours, calls, and deadlines." },
  ];

  return (
    <div style={{ padding: "48px 24px", maxWidth: 960, margin: "0 auto", borderRadius: 28, background: S.surface, boxShadow: `0 12px 45px ${S.shadowStrong}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontFamily: S.font, fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: S.muted }}>Home Workspace</div>
          <h3 style={{ fontFamily: S.serif, fontSize: 32, margin: "4px 0", color: S.dark }}>Payments, Updates, and Utilities</h3>
          <div style={{ fontFamily: S.font, fontSize: 13, color: S.light, maxWidth: 400 }}>Track escrow activity, document milestones, and day-to-day deal notes from one place.</div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => setShowQR((prev) => !prev)} style={{ ...S.btn(S.accent, "#fff"), fontSize: 13 }}>
            {showQR ? "Hide Wallet QR" : "Show Wallet QR"}
          </button>
          <button onClick={() => onNavigate("transaction")} style={{ ...S.btn(S.gold, S.dark), fontSize: 13 }}>
            View Transaction Ledger
          </button>
        </div>
      </div>

      {showQR && (
        <div style={{ marginBottom: 24, padding: "18px 20px", background: S.surfaceAlt, borderRadius: 18, border: `1px dashed ${S.accent}` }}>
          <div style={{ width: 120, height: 120, margin: "0 auto", borderRadius: 16, background: `linear-gradient(135deg, ${S.accent} 0%, ${S.accentDeep} 80%)`, display: "grid", placeItems: "center", color: "#fff", fontWeight: 700, letterSpacing: 4 }}>
            QR
          </div>
          <div style={{ textAlign: "center", marginTop: 12, fontFamily: S.font, fontSize: 13, color: S.muted }}>
            Wallet ID {user?.uid?.slice(0, 6) ?? "XXXXXX"}-PAY
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 20, marginBottom: 32 }}>
        <Card style={{ padding: 24, borderRadius: 24, border: `1px solid ${S.border}` }}>
          <div style={{ fontFamily: S.font, fontSize: 13, color: S.muted, marginBottom: 6 }}>Payments Wallet</div>
          <div style={{ fontFamily: S.serif, fontSize: 40, color: S.dark, marginBottom: 12 }}>${walletBalance.toLocaleString()}</div>
          <div style={{ fontFamily: S.font, fontSize: 12, color: S.light, marginBottom: 12 }}>Includes recent escrow and closing activity.</div>
          <div style={{ fontFamily: S.font, fontSize: 12, color: S.light, display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span>History</span>
            <span>Method</span>
          </div>
          {walletHistory.map((entry) => (
            <div key={entry.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: S.font, fontSize: 12, color: S.dark, padding: "6px 0", borderTop: `1px solid ${S.surface}` }}>
              <div>
                <div>{entry.title}</div>
                <div style={{ fontSize: 11, color: S.muted }}>{entry.date}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, color: entry.amount > 0 ? S.gold : S.red }}>{entry.amount > 0 ? `+$${entry.amount}` : `-$${Math.abs(entry.amount)}`}</div>
                <div style={{ fontSize: 11, color: S.light }}>{entry.method}</div>
              </div>
            </div>
          ))}
        </Card>

        <Card style={{ padding: 24, borderRadius: 24, border: `1px solid ${S.border}`, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: S.font, fontSize: 13, color: S.muted, marginBottom: 6 }}>Deal Updates (6-Mo Archive)</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <span style={{ ...S.btn(S.surface, S.dark), padding: "6px 12px", borderRadius: 16, border: `1px solid ${S.border}`, fontSize: 11 }}>Live feed</span>
              <span style={{ ...S.btn(S.surfaceAlt, S.muted), padding: "6px 12px", borderRadius: 16, border: `1px solid ${S.surface}` , fontSize: 11}}>Fresh every milestone</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {visiblePosts.map((post) => (
                <div key={post.id} style={{ padding: 12, borderRadius: 14, background: S.surfaceAlt, border: `1px solid ${S.border}` }}>
                  <div style={{ fontFamily: S.font, fontSize: 13, fontWeight: 600, color: S.dark }}>{post.title}</div>
                  <div style={{ fontFamily: S.font, fontSize: 12, color: S.muted }}>{post.body}</div>
                  <div style={{ fontFamily: S.font, fontSize: 11, color: S.light, marginTop: 4 }}>Posted {Math.round((now - post.createdAt) / (24 * 60 * 60 * 1000))} days ago</div>
                </div>
              ))}
              {expiredPosts.length > 0 && (
                <div style={{ fontFamily: S.font, fontSize: 12, color: S.muted, fontStyle: "italic" }}>
                  {expiredPosts.length} update{expiredPosts.length > 1 ? "s" : ""} archived after six months to keep the workspace focused.
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 18, marginBottom: 32 }}>
        {utilityActions.map((util) => (
          <div key={util.label} style={{ borderRadius: 18, border: `1px solid ${S.border}`, padding: 20, background: S.surfaceAlt, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 24 }}>{util.icon}</div>
            <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 15, color: S.dark }}>{util.label}</div>
            <div style={{ fontFamily: S.font, fontSize: 12, color: S.muted, lineHeight: 1.4 }}>{util.description}</div>
            <button onClick={util.action} style={{ ...S.btn(S.gold, S.dark), marginTop: "auto", fontSize: 12, padding: "8px 0" }}>Open</button>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 20 }}>
        <Card style={{ background: S.goldBg, border: "none" }}>
          <div style={{ fontFamily: S.font, fontSize: 13, color: S.dark, marginBottom: 8 }}>Quick Note</div>
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Capture a quick reminder for your next tour, inspection, or closing follow-up."
            ref={noteRef}
            style={{ width: "100%", minHeight: 110, borderRadius: 14, border: `1px solid ${S.border}`, padding: 12, fontFamily: S.font, fontSize: 13, resize: "vertical" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
            <span style={{ fontFamily: S.font, fontSize: 12, color: S.muted }}>{lastNote ? "Last note saved" : "No notes yet"}</span>
            <button onClick={handleSaveNote} disabled={!noteDraft.trim()} style={{ ...S.btn(S.accent, "#fff"), fontSize: 12, padding: "6px 18px" }}>
              Save note
            </button>
          </div>
          {lastNote && <div style={{ marginTop: 8, fontFamily: S.font, fontSize: 12, color: S.dark }}>{lastNote}</div>}
        </Card>

        <Card style={{ background: S.blueBg, border: "none" }}>
          <div style={{ fontFamily: S.font, fontSize: 13, color: S.dark, marginBottom: 8 }}>Scheduler</div>
          <input
            type="datetime-local"
            value={scheduleDraft}
            onChange={(e) => setScheduleDraft(e.target.value)}
            ref={scheduleRef}
            style={{ width: "100%", borderRadius: 14, border: `1px solid ${S.border}`, padding: "10px 12px", fontFamily: S.font, fontSize: 13, marginBottom: 10 }}
          />
          <button onClick={handleSchedule} disabled={!scheduleDraft} style={{ ...S.btn(S.blue, "#fff"), fontSize: 12, padding: "8px 18px" }}>
            Add milestone
          </button>
          <div style={{ marginTop: 12, fontFamily: S.font, fontSize: 12, color: S.dark }}>
            {scheduledItems.length === 0
              ? "No milestones saved yet."
              : `${scheduledItems.length} upcoming milestone${scheduledItems.length > 1 ? "s" : ""}`}
          </div>
        </Card>
      </div>
    </div>
  );
}

const PropertyCard = memo(function PropertyCard({ listing, onClick, isSaved = false, onToggleSave, isFeatured = false }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{
      background: S.card, borderRadius: 16, overflow: "hidden", cursor: "pointer",
      transition: "all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1)", transform: hovered ? "translateY(-8px)" : "none",
      boxShadow: hovered || isFeatured ? `0 30px 60px ${S.shadowStrong}` : `0 4px 20px ${S.shadowSoft}`, border: `1px solid ${hovered || isFeatured ? S.gold : S.border}`,
    }}>
      <div style={{ height: 180, background: `linear-gradient(135deg, ${S.mid} 0%, ${S.muted} 50%, ${S.light} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 64, position: "relative", overflow: "hidden" }}>
        <div style={{ transition: "transform 0.6s cubic-bezier(0.165, 0.84, 0.44, 1)", transform: hovered ? "scale(1.15)" : "scale(1)" }}>{listing.img}</div>
        <div style={{ position: "absolute", top: 10, left: 10, display: "flex", gap: 5 }}>
          {isFeatured && <Badge variant="verified">★ Featured</Badge>}
          {listing.daysListed <= 3 && <Badge variant="new">New</Badge>}
          <Badge variant="type">{listing.type}</Badge>
          {listing.verified && <Badge variant="verified">✓ Verified</Badge>}
          {listing.verified && <Badge variant="verified">🇺🇸</Badge>}
          {listingHasTrustedBadge(listing) && <Badge variant="verified">🟢 Trusted</Badge>}
        </div>
        {onToggleSave && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              onToggleSave(listing.id);
            }}
            aria-label={isSaved ? "Remove from watchlist" : "Save to watchlist"}
            style={{ position: "absolute", top: 10, right: 10, border: "none", borderRadius: 999, width: 38, height: 38, background: "rgba(255,255,255,0.9)", cursor: "pointer", fontSize: 18 }}
          >
            {isSaved ? "★" : "☆"}
          </button>
        )}
      </div>
      <div style={{ padding: "20px" }}>
        <div style={{ fontFamily: S.serif, fontSize: 24, color: S.dark, marginBottom: 4 }}>{fmt(listing.price)}</div>
        <div style={{ fontFamily: S.font, fontSize: 15, fontWeight: 700, color: S.mid, marginBottom: 4 }}>{listing.title}</div>
        <div style={{ fontFamily: S.font, fontSize: 13, color: S.light, marginBottom: 16, lineHeight: 1.4 }}>{listing.address}</div>
        <div style={{ display: "flex", gap: 14, fontFamily: S.font, fontSize: 13, color: S.muted }}>
          <span>{listing.beds} bed</span><span style={{ color: S.borderStrong }}>|</span>
          <span>{listing.baths} bath</span><span style={{ color: S.borderStrong }}>|</span>
          <span>{listing.sqft.toLocaleString()} sqft</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontFamily: S.font, fontSize: 12, color: S.light }}>
          <Badge variant="role">{listing.sellerType}</Badge>
          <span>{listing.seller}</span>
          {listing.verified && <span style={{ color: S.green }}>✓</span>}
          {listingHasTrustedBadge(listing) && <span style={{ color: "#31A354" }}>🟢</span>}
        </div>
      </div>
    </div>
  );
});

function BrowseView({ onNavigate, initialSearch, listings = [], featuredPlacements = [], savedSearches = [], onSaveSearch, onApplySavedSearch, onRemoveSavedSearch, savedListingIds = [], onToggleSave, listingsReady = false, listingSyncError = "" }) {
  const [search, setSearch] = useState(initialSearch || "");
  const [type, setType] = useState("All");
  const [sort, setSort] = useState("newest");
  const [priceRange, setPriceRange] = useState("all");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const debouncedSearch = useDebounce(search, 250);

  const featuredListingIds = useMemo(() => buildFeaturedListingIdSet(listings, featuredPlacements), [featuredPlacements, listings]);
  const featuredListingCount = featuredListingIds.size;

  useEffect(() => {
    if (typeof initialSearch === "string") {
      setSearch(initialSearch);
      return;
    }
    if (initialSearch && typeof initialSearch === "object") {
      setSearch(initialSearch.search || "");
      setType(initialSearch.type || "All");
      setSort(initialSearch.sort || "newest");
      setPriceRange(initialSearch.priceRange || "all");
      setVerifiedOnly(!!initialSearch.verifiedOnly);
    }
  }, [initialSearch]);

  const filtered = useMemo(() => {
    let result = listings.filter((l) => {
      if (type !== "All" && l.type !== type) return false;
      if (debouncedSearch && !(l.title + l.address).toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
      if (priceRange === "under300k" && l.price >= 300000) return false;
      if (priceRange === "300to500k" && (l.price < 300000 || l.price > 500000)) return false;
      if (priceRange === "over500k" && l.price <= 500000) return false;
      if (verifiedOnly && !l.verified) return false;
      return true;
    });
    result.sort((a, b) => {
      const featuredDelta = Number(featuredListingIds.has(b.id)) - Number(featuredListingIds.has(a.id));
      if (featuredDelta !== 0) return featuredDelta;
      if (sort === "newest") return a.daysListed - b.daysListed;
      if (sort === "price_low") return a.price - b.price;
      if (sort === "price_high") return b.price - a.price;
      return 0;
    });
    return result;
  }, [debouncedSearch, type, sort, priceRange, verifiedOnly, featuredListingIds]);

  const marketStats = useMemo(() => {
    const inventoryCount = filtered.length;
    const verifiedCount = filtered.filter((listing) => !!listing.verified).length;
    const trustedCount = filtered.filter((listing) => listingHasTrustedBadge(listing)).length;
    const newestCount = filtered.filter((listing) => Number(listing.daysListed || 0) <= 7).length;
    const averagePrice = inventoryCount
      ? Math.round(filtered.reduce((sum, listing) => sum + (Number(listing.price) || 0), 0) / inventoryCount)
      : 0;
    return { inventoryCount, verifiedCount, trustedCount, newestCount, averagePrice };
  }, [filtered]);

  const topTypes = useMemo(() => {
    const counts = filtered.reduce((acc, listing) => {
      const key = listing.type || "Other";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [filtered]);

  const hasActiveFilters = debouncedSearch || type !== "All" || sort !== "newest" || priceRange !== "all" || verifiedOnly;
  const featuredLeadListing = useMemo(
    () => filtered.find((listing) => featuredListingIds.has(listing.id)) || null,
    [featuredListingIds, filtered]
  );
  const featuredListing = featuredLeadListing || filtered[0] || listings[0] || null;
  const quickActions = [
    { label: "Verified sellers", active: verifiedOnly, onClick: () => setVerifiedOnly((current) => !current) },
    { label: "New this week", active: sort === "newest", onClick: () => setSort("newest") },
    { label: "Under $300K", active: priceRange === "under300k", onClick: () => setPriceRange("under300k") },
    { label: "Condos", active: type === "Condo", onClick: () => setType("Condo") },
  ];

  function resetFilters() {
    setSearch("");
    setType("All");
    setSort("newest");
    setPriceRange("all");
    setVerifiedOnly(false);
  }

  return (
    <div style={{ padding: 24, maxWidth: 1240, margin: "0 auto" }}>
      <SectionHeader title="Browse Properties" sub={`${filtered.length} properties found`} />

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.65fr) minmax(300px,0.95fr)", gap: 18, alignItems: "stretch", marginBottom: 24 }}>
        <Card style={{ borderRadius: 24, padding: 24, background: `linear-gradient(145deg, ${S.dark} 0%, ${S.mid} 52%, ${S.card} 100%)`, color: "#fff", overflow: "hidden", position: "relative" }}>
          <div style={{ position: "absolute", inset: "auto -40px -65px auto", width: 220, height: 220, borderRadius: 999, background: "radial-gradient(circle, rgba(201,157,74,0.28) 0%, rgba(201,157,74,0) 70%)" }} />
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, position: "relative" }}>
            <div>
              <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "rgba(255,255,255,0.68)", marginBottom: 8 }}>Property Discovery</div>
              <div style={{ fontFamily: S.serif, fontSize: 34, lineHeight: 1.05, marginBottom: 8 }}>
                {featuredListing ? featuredListing.title : "Track live inventory with cleaner search context"}
              </div>
              {featuredLeadListing && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.08)", fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fff", marginBottom: 8 }}>
                  ★ Featured Lead Placement
                </div>
              )}
              <div style={{ fontFamily: S.font, fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,0.76)", maxWidth: 620 }}>
                {featuredListing
                  ? `${featuredListing.address} · ${featuredListing.beds} bed · ${featuredListing.baths} bath · ${featuredListing.sqft.toLocaleString()} sqft`
                  : "Use saved searches, trust filters, and pricing context to narrow inventory without losing track of what is market-ready."}
              </div>
            </div>
            {featuredListing && (
              <button onClick={() => onNavigate("detail", featuredListing.id)} style={{ ...S.btn("rgba(255,255,255,0.12)", "#fff"), border: "1px solid rgba(255,255,255,0.16)", padding: "11px 16px", backdropFilter: "blur(10px)" }}>
                Open Lead Listing
              </button>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(132px,1fr))", gap: 12, position: "relative" }}>
            {[
              [marketStats.inventoryCount.toLocaleString(), "Matching inventory"],
              [marketStats.averagePrice ? fmt(marketStats.averagePrice) : "—", "Average asking"],
              [marketStats.verifiedCount.toLocaleString(), "Verified sellers"],
              [marketStats.newestCount.toLocaleString(), "New this week"],
            ].map(([value, label]) => (
              <div key={label} style={{ borderRadius: 18, padding: "14px 15px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.12)" }}>
                <div style={{ fontFamily: S.serif, fontSize: 24, marginBottom: 4 }}>{value}</div>
                <div style={{ fontFamily: S.font, fontSize: 12, color: "rgba(255,255,255,0.72)" }}>{label}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card style={{ borderRadius: 24, padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: 1.6, textTransform: "uppercase", color: S.light, marginBottom: 6 }}>Market Pulse</div>
              <div style={{ fontFamily: S.serif, fontSize: 26, color: S.dark }}>Search position</div>
            </div>
            <Badge variant={listingSyncError ? "warn" : listingsReady ? "verified" : "type"}>
              {listingSyncError ? "Sync issue" : listingsReady ? "Live" : "Syncing"}
            </Badge>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ borderRadius: 18, padding: "14px 16px", background: S.surface }}>
              <div style={{ fontFamily: S.font, fontSize: 12, color: S.light, marginBottom: 5 }}>Featured placements live</div>
              <div style={{ fontFamily: S.serif, fontSize: 24, color: S.dark }}>{featuredListingCount.toLocaleString()}</div>
            </div>
            <div style={{ borderRadius: 18, padding: "14px 16px", background: S.surface }}>
              <div style={{ fontFamily: S.font, fontSize: 12, color: S.light, marginBottom: 5 }}>Trust-ready inventory</div>
              <div style={{ fontFamily: S.serif, fontSize: 24, color: S.dark }}>{marketStats.trustedCount.toLocaleString()}</div>
            </div>
            <div style={{ borderRadius: 18, padding: "14px 16px", background: S.surface }}>
              <div style={{ fontFamily: S.font, fontSize: 12, color: S.light, marginBottom: 5 }}>Top property mix</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(topTypes.length ? topTypes : [["No mix yet", 0]]).map(([label, count]) => (
                  <span key={label} style={{ borderRadius: 999, padding: "7px 10px", background: S.card, border: `1px solid ${S.border}`, fontFamily: S.font, fontSize: 12, color: S.muted }}>
                    {label} {count ? `· ${count}` : ""}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ borderRadius: 18, padding: "14px 16px", background: listingSyncError ? S.redBg : S.greenBg, border: `1px solid ${listingSyncError ? `${S.red}22` : `${S.green}22`}` }}>
              <div style={{ fontFamily: S.font, fontSize: 12, fontWeight: 700, color: listingSyncError ? S.red : S.green, marginBottom: 4 }}>
                {listingSyncError ? "Inventory feed needs attention" : listingsReady ? "Inventory feed is available" : "Inventory feed is still warming up"}
              </div>
              <div style={{ fontFamily: S.font, fontSize: 12, lineHeight: 1.5, color: listingSyncError ? S.red : S.muted }}>
                {listingSyncError || (listingsReady ? "Filters are acting on the current published listing set, with active paid featured placements pinned first when they match the current slice." : "Browse filters will sharpen as live listings finish syncing into the workspace.")}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(260px,300px)", gap: 22, alignItems: "start" }}>
        <div>
          <Card style={{ borderRadius: 24, marginBottom: 20, padding: 20 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
              <div>
                <div style={{ fontFamily: S.serif, fontSize: 28, color: S.dark, marginBottom: 4 }}>Refine the property pool</div>
                <div style={{ fontFamily: S.font, fontSize: 13, color: S.light }}>Search by address or title, control trust posture, and save the combinations you reuse.</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={action.onClick}
                    style={{
                      border: `1px solid ${action.active ? S.gold : S.border}`,
                      background: action.active ? S.goldBg : S.card,
                      color: action.active ? S.goldDeep : S.muted,
                      borderRadius: 999,
                      padding: "8px 12px",
                      fontFamily: S.font,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {action.label}
                  </button>
                ))}
                {hasActiveFilters && (
                  <button onClick={resetFilters} style={{ border: "none", background: "transparent", color: S.red, fontFamily: S.font, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    Reset filters
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 14 }}>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by address, title, or area..." style={{ ...S.input, minWidth: 180 }} />
              <select value={type} onChange={(e) => setType(e.target.value)} style={S.input}><option value="All">All Types</option><option>House</option><option>Condo</option><option>Townhome</option><option>Multi-Family</option></select>
              <select value={priceRange} onChange={(e) => setPriceRange(e.target.value)} style={S.input}><option value="all">Any Price</option><option value="under300k">Under $300K</option><option value="300to500k">$300K–$500K</option><option value="over500k">$500K+</option></select>
              <select value={sort} onChange={(e) => setSort(e.target.value)} style={S.input}><option value="newest">Newest</option><option value="price_low">Price ↑</option><option value="price_high">Price ↓</option></select>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: S.font, fontSize: 13, color: S.muted, cursor: "pointer", padding: "10px 12px", borderRadius: 14, background: S.surface }}>
                <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} />
                Verified sellers only
              </label>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={() => onSaveSearch?.({ search, type, sort, priceRange, verifiedOnly })} style={{ ...S.btn(S.dark, "#fff"), padding: "10px 16px", fontSize: 12 }}>
                  Save Search
                </button>
                <button onClick={() => onNavigate("watchlist")} style={{ ...S.btn(S.surfaceAlt, S.dark), padding: "10px 16px", fontSize: 12, border: `1px solid ${S.border}` }}>
                  Open Watchlist
                </button>
              </div>
            </div>
          </Card>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            <div>
              <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: 1.6, textTransform: "uppercase", color: S.light, marginBottom: 4 }}>Results</div>
              <div style={{ fontFamily: S.serif, fontSize: 26, color: S.dark }}>{marketStats.inventoryCount.toLocaleString()} matching listings</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {hasActiveFilters ? (
                [
                  debouncedSearch ? `Search: ${debouncedSearch}` : null,
                  type !== "All" ? type : null,
                  priceRange !== "all" ? priceRange.replace("to", " to ") : null,
                  verifiedOnly ? "Verified only" : null,
                ].filter(Boolean).map((token) => (
                  <span key={token} style={{ borderRadius: 999, padding: "8px 10px", background: S.goldBg, color: S.goldDeep, border: `1px solid ${S.border}`, fontFamily: S.font, fontSize: 12, fontWeight: 700 }}>
                    {token}
                  </span>
                ))
              ) : (
                <span style={{ fontFamily: S.font, fontSize: 12, color: S.light }}>Showing the full published inventory set with featured homes promoted to the top.</span>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 20 }}>
            {filtered.map((l) => <PropertyCard key={l.id} listing={l} onClick={() => onNavigate("detail", l.id)} isSaved={savedListingIds.includes(l.id)} onToggleSave={onToggleSave} isFeatured={featuredListingIds.has(l.id)} />)}
          </div>
          {filtered.length === 0 && (
            <Card style={{ marginTop: 18, borderRadius: 24, padding: 28, textAlign: "center", background: S.surface }}>
              <div style={{ fontSize: 34, marginBottom: 10 }}>🏡</div>
              <div style={{ fontFamily: S.serif, fontSize: 28, color: S.dark, marginBottom: 6 }}>No properties match this slice</div>
              <div style={{ fontFamily: S.font, fontSize: 13, lineHeight: 1.6, color: S.light, maxWidth: 520, margin: "0 auto 16px" }}>
                Relax one or two filters, switch back to all property types, or reuse a saved search that is closer to your usual buying window.
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
                <button onClick={resetFilters} style={{ ...S.btn(S.dark, "#fff"), padding: "10px 16px", fontSize: 12 }}>Reset filters</button>
                {savedSearches[0] && (
                  <button onClick={() => onApplySavedSearch(savedSearches[0])} style={{ ...S.btn(S.surfaceAlt, S.dark), padding: "10px 16px", fontSize: 12, border: `1px solid ${S.border}` }}>
                    Apply saved search
                  </button>
                )}
              </div>
            </Card>
          )}
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          <Card style={{ borderRadius: 24 }}>
            <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: 1.6, textTransform: "uppercase", color: S.light, marginBottom: 10 }}>Saved Searches</div>
            {savedSearches.length > 0 ? (
              <div style={{ display: "grid", gap: 10 }}>
                {savedSearches.map((saved) => (
                  <div key={saved.id} style={{ borderRadius: 18, padding: "14px 14px 12px", background: S.surface }}>
                    <button onClick={() => onApplySavedSearch(saved)} style={{ border: "none", background: "transparent", padding: 0, textAlign: "left", cursor: "pointer", width: "100%" }}>
                      <div style={{ fontFamily: S.font, fontSize: 13, fontWeight: 700, color: S.dark, marginBottom: 4 }}>{savedSearchLabel(saved)}</div>
                      <div style={{ fontFamily: S.font, fontSize: 12, color: S.light, lineHeight: 1.5 }}>Reapply this view to continue from the same filter posture.</div>
                    </button>
                    <button onClick={() => onRemoveSavedSearch?.(saved.id)} style={{ marginTop: 8, border: "none", background: "transparent", color: S.red, fontFamily: S.font, fontSize: 12, cursor: "pointer", padding: 0 }}>
                      Remove search
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontFamily: S.font, fontSize: 13, lineHeight: 1.6, color: S.light }}>
                Save a few filter combinations here so buyer and seller research does not restart from scratch every session.
              </div>
            )}
          </Card>

          <Card style={{ borderRadius: 24 }}>
            <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: 1.6, textTransform: "uppercase", color: S.light, marginBottom: 10 }}>Featured Placement</div>
            <div style={{ fontFamily: S.serif, fontSize: 24, color: S.dark, marginBottom: 6 }}>Promoted homes can surface first.</div>
            <div style={{ fontFamily: S.font, fontSize: 12, lineHeight: 1.6, color: S.light, marginBottom: 10 }}>
              Sellers can pay for a 30-day featured slot after submitting a listing. Active placements are clearly labeled and pinned above the broader inventory set.
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <Badge variant="verified">{FEATURED_LISTING_PRICE_LABEL}</Badge>
              <span style={{ fontFamily: S.font, fontSize: 12, color: S.muted }}>{featuredListingCount} live now</span>
            </div>
          </Card>

          <Card style={{ borderRadius: 24 }}>
            <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: 1.6, textTransform: "uppercase", color: S.light, marginBottom: 10 }}>Browse Guidance</div>
            <div style={{ display: "grid", gap: 10 }}>
              {[
                ["Trust posture", "Verified and trusted indicators help you spot listings that are closer to transaction-ready."],
                ["Price shaping", "Sort high or low after narrowing type so outliers do not distort the full inventory view."],
                ["Decision memory", "Use watchlist plus saved searches together: one remembers listings, the other remembers the search lane."],
              ].map(([title, body]) => (
                <div key={title} style={{ borderRadius: 18, padding: "14px 14px 12px", background: S.surface }}>
                  <div style={{ fontFamily: S.font, fontSize: 13, fontWeight: 700, color: S.dark, marginBottom: 4 }}>{title}</div>
                  <div style={{ fontFamily: S.font, fontSize: 12, lineHeight: 1.55, color: S.light }}>{body}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DetailView({ listingId, onNavigate, perms = {}, listings = [], user, isSaved = false, onToggleSave, onTrackListing, onSyncJurisdiction }) {
  const listing = listings.find((l) => l.id === listingId);
  const [showOffer, setShowOffer] = useState(false);
  const [offerAmount, setOfferAmount] = useState(listing ? String(listing.price) : "");
  const [offerSent, setOfferSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msgText, setMsgText] = useState("");
  const [messages, setMessages] = useState([]);
  const [addressVerified, setAddressVerified] = useState(false);
  const inferredLocation = useMemo(() => inferJurisdictionFromAddress(listing?.address || ""), [listing?.address]);
  const [offerJurisdiction, setOfferJurisdiction] = useState(() => ({
    city: inferredLocation.city || "",
    state: inferredLocation.state || "",
    county: "",
    municipality: "",
  }));

  useEffect(() => {
    if (listing) onTrackListing?.(listing.id);
  }, [listing, onTrackListing]);

  useEffect(() => {
    setOfferJurisdiction({
      city: inferredLocation.city || "",
      state: inferredLocation.state || "",
      county: "",
      municipality: "",
    });
  }, [inferredLocation.city, inferredLocation.state, listing?.id]);

  if (!listing) return <div style={{ padding: 40, textAlign: "center" }}>Listing not found.</div>;

  const handleSendOffer = async () => {
    setLoading(true);
    try {
      await onSyncJurisdiction?.({
        city: offerJurisdiction.city,
        state: offerJurisdiction.state,
        county: offerJurisdiction.county,
        municipality: offerJurisdiction.municipality,
      });
      await addDoc(collection(db, "deals"), {
        propertyId: listing.id,
        propertyAddress: listing.address,
        buyerId: user.uid || null,
        buyerName: user.name,
        amount: Number(offerAmount),
        status: "Offer Pending",
        timestamp: serverTimestamp(),
      });
      setOfferSent(true);
      setTimeout(() => { setOfferSent(false); setShowOffer(false); }, 2500);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  const handleSendMsg = () => {
    if (!msgText.trim()) return;
    setMessages([...messages, { from: "you", text: msgText, time: "Now" }]);
    setMsgText("");
    setTimeout(() => setMessages((m) => [...m, { from: "seller", text: "Thanks for reaching out! Happy to schedule a showing this week.", time: "Now" }]), 1200);
  };

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: 24 }}>
      <button onClick={() => onNavigate("browse")} style={{ background: "none", border: "none", fontFamily: S.font, fontSize: 14, color: S.gold, cursor: "pointer", fontWeight: 600, marginBottom: 20, padding: 0 }}>← Back to Listings</button>
      <div style={{ height: 260, background: `linear-gradient(135deg, ${S.mid} 0%, ${S.muted} 50%, ${S.light} 100%)`, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 80, marginBottom: 24, position: "relative" }}>
        {listing.img}
        <div style={{ position: "absolute", top: 16, left: 16, display: "flex", gap: 6 }}>
          {listing.daysListed <= 3 && <Badge variant="new">New</Badge>}
          <Badge variant="type">{listing.type}</Badge>
          {listing.verified && <Badge variant="verified">✓ Verified Seller</Badge>}
          {listing.verified && <Badge variant="verified">🇺🇸 U.S. Verified</Badge>}
        </div>
      </div>

      {/* Unverified Seller Warning */}
      {!listing.verified && (
        <div style={{ padding: "14px 18px", background: S.redBg, border: `1px solid ${S.red}33`, borderRadius: 12, marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div style={{ fontFamily: S.font, fontSize: 13, color: S.red, lineHeight: 1.5 }}>
            <strong>Seller Not Fully Verified</strong> — This seller has not completed U.S. citizenship/residency verification or identity checks. Proceed with caution. EstateHat will block any transaction until full verification is complete.
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "start" }}>
        <div>
          <h1 style={{ fontFamily: S.serif, fontSize: 30, color: S.dark, margin: "0 0 4px" }}>{listing.title}</h1>
          <div style={{ fontFamily: S.font, fontSize: 14, color: S.light, marginBottom: 14 }}>{listing.address}</div>
          <div style={{ display: "flex", gap: 20, marginBottom: 20, fontFamily: S.font, fontSize: 15, color: S.mid, fontWeight: 500 }}>
            <span>{listing.beds} Beds</span><span>{listing.baths} Baths</span><span>{listing.sqft.toLocaleString()} Sqft</span>
          </div>
          <p style={{ fontFamily: S.font, fontSize: 14.5, color: S.muted, lineHeight: 1.7, margin: "0 0 20px" }}>{listing.description}</p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {listing.features.map((f) => <Badge key={f}>{f}</Badge>)}
          </div>

          <AddressVerifier address={listing.address} onVerified={setAddressVerified} />

          {/* Messenger */}
          <Card style={{ marginTop: 20, padding: 20 }}>
            <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 15, color: S.dark, margin: "0 0 12px" }}>💬 Message {listing.seller}</h3>
            <div style={{ minHeight: 80, maxHeight: 200, overflowY: "auto", marginBottom: 10 }}>
              {messages.length === 0 && <div style={{ fontFamily: S.font, fontSize: 13, color: S.light, textAlign: "center", padding: 16 }}>Start a conversation</div>}
              {messages.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.from === "you" ? "flex-end" : "flex-start", marginBottom: 8 }}>
                  <div style={{ background: m.from === "you" ? S.gold : S.surface, color: S.dark, padding: "10px 14px", borderRadius: 14, maxWidth: "75%", fontFamily: S.font, fontSize: 13.5, lineHeight: 1.5 }}>{m.text}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={msgText} onChange={(e) => setMsgText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSendMsg()} placeholder="Type a message..." style={{ ...S.input, flex: 1 }} />
              <button onClick={handleSendMsg} style={S.btn(S.mid, S.card)}>Send</button>
            </div>
          </Card>
        </div>

        <div>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: S.serif, fontSize: 32, color: S.dark, marginBottom: 2 }}>{fmt(listing.price)}</div>
            <div style={{ fontFamily: S.font, fontSize: 12, color: S.light, marginBottom: 4 }}>${Math.round(listing.price / listing.sqft)}/sqft</div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${S.surface}`, borderBottom: `1px solid ${S.surface}`, margin: "10px 0 14px", fontFamily: S.font, fontSize: 12 }}>
              <span style={{ color: S.light }}>EstateHat buyer fee ({FEE_LABEL})</span>
              <span style={{ color: S.muted, fontWeight: 600 }}>{fmt(calcFees(listing.price).processingFee)}</span>
            </div>
            <div style={{ fontFamily: S.font, fontSize: 12, color: S.green, fontWeight: 600, marginBottom: 14 }}>
              ✓ Save {fmt(calcFees(listing.price).savings)} vs. traditional agents
            </div>
            {perms.makeOffer ? (
              <button onClick={() => setShowOffer(true)} style={{ ...S.btn(S.gold, S.dark), width: "100%", marginBottom: 8, padding: "14px" }}>Make an Offer</button>
            ) : (
              <div style={{ padding: "10px 14px", background: S.surface, borderRadius: 12, marginBottom: 8, fontFamily: S.font, fontSize: 12, color: S.light, textAlign: "center" }}>🔒 Offers restricted for your account type</div>
            )}
            {onToggleSave && (
              <button onClick={() => onToggleSave(listing.id)} style={{ ...S.btn(isSaved ? S.surface : "transparent", isSaved ? S.dark : S.mid), width: "100%", border: `2px solid ${S.mid}`, padding: "12px", marginBottom: 8 }}>
                {isSaved ? "★ Saved to Watchlist" : "☆ Save to Watchlist"}
              </button>
            )}
            {perms.scheduleTour ? (
              <button style={{ ...S.btn("transparent", S.mid), width: "100%", border: `2px solid ${S.mid}`, padding: "12px" }}>Schedule a Tour</button>
            ) : (
              <div style={{ padding: "10px 14px", background: S.surface, borderRadius: 12, fontFamily: S.font, fontSize: 12, color: S.light, textAlign: "center" }}>🔒 Tours restricted for your account type</div>
            )}
          </Card>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: S.light, marginBottom: 10, fontWeight: 600 }}>Seller</div>
            <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, marginBottom: 4 }}>{listing.seller}</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
              <Badge variant="role">{listing.sellerType}</Badge>
              {listingHasTrustedBadge(listing) && <Badge variant="verified">🟢 Trusted User</Badge>}
              <StarRating rating={listing.sellerRating} />
              <GradeBadge grade={listing.reputation?.grade || gradeFromStarRating(listing.sellerRating)} score={listing.reputation?.score || Math.round((Number(listing.sellerRating) || 0) * 20)} />
            </div>
            <div style={{ fontFamily: S.font, fontSize: 12, color: S.light }}>{listing.sellerDeals} deals closed</div>
            {listing.verified && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ padding: "8px 14px", background: S.greenBg, borderRadius: 10, fontFamily: S.font, fontSize: 12, color: S.green, fontWeight: 600 }}>
                  ✓ Identity Verified · Background Checked
                </div>
                <div style={{ padding: "8px 14px", background: S.greenBg, borderRadius: 10, fontFamily: S.font, fontSize: 12, color: S.green, fontWeight: 600 }}>
                  🇺🇸 U.S. Citizen · Verified
                </div>
                <div style={{ padding: "8px 14px", background: S.greenBg, borderRadius: 10, fontFamily: S.font, fontSize: 12, color: S.green, fontWeight: 600 }}>
                  🏡 Verified Homeowner
                </div>
              </div>
            )}
          </Card>
          <Card>
            <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: S.light, marginBottom: 10, fontWeight: 600 }}>Required for Closing</div>
            {["Purchase Agreement", "Escrow Deposit", "Inspection Report", "Title Search", "Closing Disclosure"].map((d) => (
              <div key={d} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontFamily: S.font, fontSize: 12.5, color: S.muted }}>
                <span style={{ color: S.borderStrong }}>○</span> {d}
              </div>
            ))}
          </Card>
        </div>
      </div>

      {showOffer && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => !offerSent && setShowOffer(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: S.card, borderRadius: 20, padding: 32, width: "90%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            {offerSent ? (
              <div style={{ textAlign: "center", padding: 20 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                <div style={{ fontFamily: S.serif, fontSize: 24, color: S.dark, marginBottom: 8 }}>Offer Submitted!</div>
                <div style={{ fontFamily: S.font, fontSize: 14, color: S.muted }}>Funds will be held in escrow. All documents must pass validation before closing.</div>
              </div>
            ) : (
              <>
                <h3 style={{ fontFamily: S.serif, fontSize: 24, color: S.dark, margin: "0 0 4px" }}>Make an Offer</h3>
                <div style={{ fontFamily: S.font, fontSize: 13, color: S.light, marginBottom: 20 }}>{listing.title}</div>
                <label style={S.label}>Your Offer ($)</label>
                <input type="number" value={offerAmount} onChange={(e) => setOfferAmount(e.target.value)} style={{ ...S.input, fontSize: 20, fontFamily: S.serif, marginBottom: 14 }} />
                <label style={S.label}>Message to Seller</label>
                <textarea rows={3} placeholder="We love the home..." style={{ ...S.input, resize: "none", marginBottom: 14 }} />
                <label style={S.label}>Proof of Funds / Pre-Approval</label>
                <FileUploadZone accept="PDF, JPG — Pre-approval letter or bank statement" onUpload={() => {}} />
                <div style={{ marginTop: 12, marginBottom: 12, padding: 12, borderRadius: 10, background: S.surfaceAlt, border: `1px solid ${S.border}` }}>
                  <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 700, letterSpacing: 1.1, textTransform: "uppercase", color: S.light, marginBottom: 8 }}>
                    Transaction Jurisdiction (for Compliance)
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <input
                      value={offerJurisdiction.city}
                      onChange={(e) => setOfferJurisdiction((prev) => ({ ...prev, city: e.target.value.slice(0, 80) }))}
                      placeholder="City"
                      style={S.input}
                    />
                    <input
                      value={offerJurisdiction.state}
                      onChange={(e) => setOfferJurisdiction((prev) => ({ ...prev, state: e.target.value.slice(0, 10).toUpperCase() }))}
                      placeholder="State / Territory"
                      style={S.input}
                    />
                    <input
                      value={offerJurisdiction.county}
                      onChange={(e) => setOfferJurisdiction((prev) => ({ ...prev, county: e.target.value.slice(0, 80) }))}
                      placeholder="County"
                      style={S.input}
                    />
                    <input
                      value={offerJurisdiction.municipality}
                      onChange={(e) => setOfferJurisdiction((prev) => ({ ...prev, municipality: e.target.value.slice(0, 120) }))}
                      placeholder="Borough / Parish / Equivalent"
                      style={S.input}
                    />
                  </div>
                </div>
                {offerAmount && Number(offerAmount) > 0 && (
                  <div style={{ margin: "16px 0" }}>
                    <FeeBreakdown price={Number(offerAmount)} compact />
                  </div>
                )}
                <div style={{ background: S.greenBg, borderRadius: 12, padding: 14, margin: "8px 0 16px", fontFamily: S.font, fontSize: 12, color: S.green, lineHeight: 1.5 }}>
                  🔒 Funds held in escrow until all validation checks pass. Processing fee is deducted at closing — not upfront.
                </div>
                <button onClick={handleSendOffer} style={{ ...S.btn(S.gold, S.dark), width: "100%", padding: "14px", fontSize: 15 }}>Submit Offer with Escrow</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function WatchlistView({ listings = [], savedListingIds = [], onNavigate, onToggleSave, savedSearches = [], onApplySavedSearch }) {
  const savedListings = useMemo(() => listings.filter((listing) => savedListingIds.includes(listing.id)), [listings, savedListingIds]);

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <SectionHeader title="Watchlist" sub={`${savedListings.length} saved propert${savedListings.length === 1 ? "y" : "ies"}`} />
      {savedListings.length === 0 ? (
        <Card style={{ textAlign: "center", padding: 36 }}>
          <div style={{ fontFamily: S.serif, fontSize: 28, color: S.dark, marginBottom: 8 }}>Your watchlist is empty</div>
          <div style={{ fontFamily: S.font, fontSize: 13, color: S.light, lineHeight: 1.6, marginBottom: 16 }}>
            Save listings from Browse or the property detail page so your top options stay in one place.
          </div>
          <button onClick={() => onNavigate("browse")} style={{ ...S.btn(S.gold, S.dark), padding: "12px 18px" }}>Browse Listings</button>
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 20 }}>
          {savedListings.map((listing) => (
            <PropertyCard key={listing.id} listing={listing} onClick={() => onNavigate("detail", listing.id)} isSaved={true} onToggleSave={onToggleSave} />
          ))}
        </div>
      )}
      {savedSearches.length > 0 && (
        <Card style={{ marginTop: 24 }}>
          <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 14, color: S.dark, marginBottom: 10 }}>Quick Start From Saved Searches</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {savedSearches.map((saved) => (
              <button key={saved.id} onClick={() => onApplySavedSearch?.(saved)} style={{ border: `1px solid ${S.border}`, background: S.surfaceAlt, borderRadius: 999, padding: "8px 12px", fontFamily: S.font, fontSize: 12, color: S.muted, cursor: "pointer" }}>
                {savedSearchLabel(saved)}
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── PROFILE & VERIFICATION ──────────────

function ProfileView({ user, setUser, perms = {}, onSaveProfile, onNotify }) {
  const [tab, setTab] = useState("profile");
  const [saveStatus, setSaveStatus] = useState(null); // null | "saving" | "saved" | "error"
  const profileWide = useMediaQuery("(min-width: 1100px)");
  const profileMedium = useMediaQuery("(min-width: 760px)");
  const defaultVerificationSteps = useMemo(() => ({ identity: false, selfie: false, address: false, citizenship: false, ssn: false, homeowner: false, license: false, background: false }), []);
  const defaultCorpVerificationSteps = useMemo(() => ({ entity_docs: false, ein: false, domestic_entity: false, good_standing: false, operating_agreement: false, auth_resolution: false, auth_signer_id: false, auth_signer_selfie: false, signer_citizenship: false, registered_agent: false, background_entity: false, background_signers: false, proof_of_funds: false }), []);
  const persistedVerification = user.verification || {};
  const [verStatus, setVerStatus] = useState(() => ({ ...defaultVerificationSteps, ...(persistedVerification.stepStatus || {}) }));
  const [corpVerStatus, setCorpVerStatus] = useState(() => ({ ...defaultCorpVerificationSteps, ...(persistedVerification.stepStatus || {}) }));
  const [verificationDocs, setVerificationDocs] = useState(() => ({ ...(persistedVerification.stepDocuments || {}) }));
  const [citizenshipStatus, setCitizenshipStatus] = useState(persistedVerification.citizenshipStatus || "unverified"); // citizen | permanent_resident | pending | unverified
  const [selectedCitizenshipPath, setSelectedCitizenshipPath] = useState("citizen");
  const [docs, setDocs] = useState([]);
  const [connectedBanks, setConnectedBanks] = useState({});
  const [receiptLog, setReceiptLog] = useState([
    { id: "TXN-001", date: "2026-03-20", type: "Earnest Deposit", amount: 12500, from: "You", to: "First American Escrow", status: "Held" },
    { id: "TXN-002", date: "2026-03-18", type: "Inspection Fee", amount: 450, from: "You", to: "Triangle Home Inspectors", status: "Complete" },
    { id: "TXN-003", date: "2026-03-15", type: "EstateHat Buyer Fee (1.50%)", amount: 8835, from: "Buyer Closing Funds", to: "EstateHat LLC", status: "Pending Close" },
    { id: "TXN-004", date: "2026-03-15", type: "Escrow Service Fee", amount: 500, from: "Seller", to: "First American Title", status: "Pending Close" },
  ]);
  const [corpInfo, setCorpInfo] = useState({ entityName: "", entityType: "llc", ein: "", stateOfFormation: "", dateFormed: "", registeredAgent: "", regAgentAddress: "", authorizedSigners: [{ name: "", title: "" }] });

  const isCorp = ["corp_buyer", "corp_seller"].includes(user.accountType);
  const isBuyerOrSeller = useMemo(() => ["buyer", "seller"].includes(user.accountType), [user.accountType]);
  const isProfessional = useMemo(() => ["attorney", "agent", "inspector", "lender"].includes(user.accountType), [user.accountType]);
  const isGovernment = useMemo(() => GOVERNMENT_ACCOUNT_TYPES.has(user.accountType), [user.accountType]);
  const activeVerSteps = useMemo(() => isCorp ? CORP_VERIFICATION_STEPS : VERIFICATION_STEPS.filter((v) => {
    if (v.key === "license") return isProfessional;
    if (v.buyerSeller) return isBuyerOrSeller;
    return v.required;
  }), [isCorp, isProfessional, isBuyerOrSeller]);
  const activeVerStatus = isCorp ? corpVerStatus : verStatus;
  const setActiveVer = isCorp ? setCorpVerStatus : setVerStatus;
  const verCount = useMemo(() => activeVerSteps.filter((s) => activeVerStatus[s.key]).length, [activeVerSteps, activeVerStatus]);
  const reqSteps = activeVerSteps;
  const listedVerificationSteps = useMemo(
    () => reqSteps.filter((step) => !["citizenship", "signer_citizenship", "homeowner"].includes(step.key)),
    [reqSteps]
  );

  const citizenshipVerified = citizenshipStatus === "citizen" || citizenshipStatus === "permanent_resident";
  const homeownerVerified = verStatus.homeowner;
  const citizenInfo = useMemo(() => CITIZENSHIP_STATUSES.find((c) => c.key === citizenshipStatus), [citizenshipStatus]);
  const accountBlueprint = useMemo(() => getAccountBlueprint(user.accountType), [user.accountType]);
  const security = user.security || {};
  const legal = user.legal || {};
  const compliance = user.compliance || {};
  const complianceJurisdiction = compliance.jurisdiction || {};
  const complianceRegulatoryProfile = compliance.regulatoryProfile || {};
  const complianceLegalHold = compliance.legalHold || {};
  const complianceIncidents = compliance.incidents || {};
  const compliancePolicy = compliance.policy || {};
  const complianceOutlierFlags = compliance.outlierFlags || {};
  const complianceSupportPacket = compliance.supportPacket || {};
  const complianceAuditTrail = Array.isArray(compliance.auditTrail) ? compliance.auditTrail : [];
  const subpoenaRequests = Array.isArray(compliance.subpoenaRequests) ? compliance.subpoenaRequests : [];
  const locationOverlay = useMemo(
    () => deriveLocationComplianceOverlay(complianceJurisdiction),
    [complianceJurisdiction]
  );
  const complianceLegalHoldActive = !!complianceLegalHold.active;
  const canManageComplianceControls = COMPLIANCE_ADMIN_EMAILS.has(String(user?.email || "").toLowerCase());
  const userDatabase = user.userDatabase || {};
  const reputation = useMemo(() => summarizeReputation(user.reputation || {}), [user.reputation]);
  const reputationMeta = REPUTATION_GRADE_META[reputation.grade] || REPUTATION_GRADE_META.B;
  const reputationPublishedFeedback = useMemo(
    () => reputation.feedback.filter((entry) => (entry.status || "published") === "published"),
    [reputation.feedback]
  );
  const [reputationDraft, setReputationDraft] = useState({
    grade: "A",
    authorName: "",
    authorRole: "buyer",
    transactionRef: "",
    testimonial: "",
  });
  const payoutFramework = user.payoutFramework || {};
  const payoutCompliance = payoutFramework.compliance || {};
  const payoutAccounts = payoutFramework.accounts || {};
  const payoutQueue = Array.isArray(payoutFramework.queue) ? payoutFramework.queue : [];
  const profileCompletion = useMemo(() => {
    return [user.name, user.email, user.phone, user.address].filter((value) => String(value || "").trim()).length;
  }, [user.address, user.email, user.name, user.phone]);
  const trust = user.trust || {};
  const verifiedBilling = user.verifiedBilling || {};
  const verifiedBillingCompliance = verifiedBilling.compliance || {};
  const referralIncentive = getReferralIncentiveState(verifiedBilling, user);
  const [referralFriendEmail, setReferralFriendEmail] = useState("");
  const [referralFriendName, setReferralFriendName] = useState("");
  const [subpoenaDraft, setSubpoenaDraft] = useState({
    targetScope: "",
    outsideBoundaryReason: "",
    docketNumber: "",
    judgeName: "",
    documentName: "",
  });
  const [billingActionBusy, setBillingActionBusy] = useState("");
  const [billingActionError, setBillingActionError] = useState("");
  const [platformFeeDraft, setPlatformFeeDraft] = useState({
    amount: "500.00",
    reference: "",
    description: "",
  });
  const referralEmailCandidate = referralFriendEmail.trim().toLowerCase();
  const referralEmailAlreadyCredited = referralIncentive.credits.some((credit) => String(credit.friendEmail || "").toLowerCase() === referralEmailCandidate);
  const referralCapReached = referralIncentive.earnedFreeMonths >= referralIncentive.maxFreeMonths;
  const canRecordReferralCredit = referralEmailCandidate.includes("@") && !referralEmailAlreadyCredited && !referralCapReached;
  const trustedProfileActive = !!trust.verifiedProfileActive;
  const trustedEligibilitySnapshot = useMemo(() => ({
    ...user,
    verification: {
      ...(user.verification || {}),
      citizenshipStatus,
      review: {
        ...(user.verification?.review || {}),
        status: verCount >= reqSteps.length ? "ready" : "in_progress",
      },
    },
  }), [citizenshipStatus, reqSteps.length, user, verCount]);
  const trustedProfileEligible = hasTrustedProfileEligibility(trustedEligibilitySnapshot);
  const trustedProfileVisible = trustedProfileActive && trust.verifiedProfileVisibility !== false && trustedProfileEligible;
  const trustedProfilePriceCents = Number(trust.verifiedProfilePriceCents) || 2000;
  const trustedProfileSince = trust.verifiedProfileSince;
  const verificationReview = persistedVerification.review || {};
  const securityChecks = useMemo(() => {
    return [
      { label: "Two-factor authentication", ok: !!security.twoFactorEnabled, detail: security.twoFactorEnabled ? "Enabled" : "Not enabled yet" },
      { label: "Login alerts", ok: !!security.loginAlerts, detail: security.loginAlerts ? "Alerting on sign-in activity" : "Alerts are turned off" },
      { label: "Trusted-device protection", ok: !!security.trustedDevice, detail: security.trustedDevice ? "Current device marked trusted" : "Current device not marked trusted" },
      { label: "Document shielding", ok: !!security.documentShield, detail: security.documentShield ? "Sensitive document views restricted" : "Document shielding disabled" },
      {
        label: "Verification coverage",
        ok: verCount >= reqSteps.length,
        detail: `${verCount}/${reqSteps.length} required checks complete`,
      },
      {
        label: "Customer record integrity",
        ok: profileCompletion >= 4,
        detail: `${profileCompletion}/4 core profile fields complete`,
      },
    ];
  }, [profileCompletion, reqSteps.length, security.documentShield, security.loginAlerts, security.trustedDevice, security.twoFactorEnabled, verCount]);
  const securityScore = securityChecks.filter((item) => item.ok).length;
  const lastUpdatedLabel = useMemo(() => formatProfileDate(user.updatedAt), [user.updatedAt]);
  const memberSinceLabel = useMemo(() => formatProfileDate(user.createdAt), [user.createdAt]);
  const trustedDevices = useMemo(() => ([
    { name: "Primary browser", status: security.trustedDevice ? "Trusted" : "Needs trust", detail: "Current session on this device", lastSeen: "Active now" },
    { name: "Mobile access", status: security.twoFactorEnabled ? "Protected" : "Review", detail: "Use MFA before approving mobile document work", lastSeen: "Mar 31, 2026" },
  ]), [security.trustedDevice, security.twoFactorEnabled]);
  const securityEvents = useMemo(() => ([
    { time: "Apr 2, 2026 · 9:14 PM", label: "Profile security settings updated", outcome: "success" },
    { time: "Apr 2, 2026 · 9:10 PM", label: security.loginAlerts ? "Login alerts confirmed active" : "Login alerts still disabled", outcome: security.loginAlerts ? "success" : "warning" },
    { time: "Apr 2, 2026 · 9:06 PM", label: `${verCount}/${reqSteps.length} verification requirements complete`, outcome: verCount >= reqSteps.length ? "success" : "warning" },
  ]), [reqSteps.length, security.loginAlerts, verCount]);
  const requiredLegalComponents = useMemo(() => getRequiredLegalComponentsForRole(user.accountType), [user.accountType]);
  const legalCompletedCount = useMemo(
    () => requiredLegalComponents.filter((component) => isLegalComponentComplete(component.key, legal?.components?.[component.key])).length,
    [legal?.components, requiredLegalComponents]
  );
  const verifiedBillingChecks = useMemo(() => ([
    { label: "No legal hold active", ok: !complianceLegalHoldActive },
    { label: "Profile eligible", ok: trustedProfileEligible },
    { label: "Legal steps complete", ok: legalCompletedCount >= requiredLegalComponents.length },
    { label: "Payment method saved", ok: !!verifiedBillingCompliance.paymentMethodSaved },
    { label: "Fraud review clear", ok: !!verifiedBillingCompliance.fraudReviewClear },
  ]), [complianceLegalHoldActive, legalCompletedCount, requiredLegalComponents.length, trustedProfileEligible, verifiedBillingCompliance.fraudReviewClear, verifiedBillingCompliance.paymentMethodSaved]);
  const verifiedBillingReadyCount = verifiedBillingChecks.filter((item) => item.ok).length;
  const verifiedBillingReady = verifiedBillingReadyCount === verifiedBillingChecks.length;
  const payoutProfileEligible = profileCompletion >= 4 && verCount >= reqSteps.length && legalCompletedCount >= requiredLegalComponents.length;
  const payoutAccountConnected = useMemo(() => {
    if (payoutFramework.providerPrimary === "stripe_connect") return !!payoutAccounts.stripeOnboardingComplete;
    if (payoutFramework.providerPrimary === "square") return !!payoutAccounts.squareMerchantId;
    if (payoutFramework.providerPrimary === "paypal") return !!payoutAccounts.paypalPayoutsEmail;
    if (payoutFramework.providerPrimary === "adyen") return !!payoutAccounts.adyenAccountCode;
    return false;
  }, [payoutAccounts.adyenAccountCode, payoutAccounts.paypalPayoutsEmail, payoutAccounts.squareMerchantId, payoutAccounts.stripeOnboardingComplete, payoutFramework.providerPrimary]);
  const payoutReadinessChecks = useMemo(() => ([
    { label: "No legal hold active", ok: !complianceLegalHoldActive },
    { label: "Profile, verification, and legal complete", ok: payoutProfileEligible },
    { label: "KYC complete", ok: !!payoutCompliance.kycComplete },
    { label: "Terms accepted", ok: !!payoutCompliance.tosAccepted },
    { label: "Bank linked", ok: !!payoutCompliance.bankAccountLinked },
    { label: "Risk review complete", ok: !!payoutCompliance.riskReviewComplete },
    { label: "Primary provider connected", ok: payoutAccountConnected },
  ]), [complianceLegalHoldActive, payoutAccountConnected, payoutCompliance.bankAccountLinked, payoutCompliance.kycComplete, payoutCompliance.riskReviewComplete, payoutCompliance.tosAccepted, payoutProfileEligible]);
  const payoutReadyCount = payoutReadinessChecks.filter((item) => item.ok).length;
  const payoutReady = !complianceLegalHoldActive && payoutReadyCount === payoutReadinessChecks.length;
  const userDatabaseDepthScore = useMemo(() => {
    let score = 0;
    if (profileCompletion >= 4) score += 40;
    score += Math.round((verCount / Math.max(reqSteps.length, 1)) * 40);
    if (Array.isArray(userDatabase.tags) && userDatabase.tags.length > 0) score += 5;
    if (String(userDatabase.notes || "").trim().length > 0) score += 5;
    if (String(userDatabase.transactionIntent || "").trim().length > 0 && userDatabase.transactionIntent !== "browse") score += 5;
    if (String(userDatabase.targetMarket || "").trim().length > 0) score += 5;
    if (String(userDatabase.stageOwner || "").trim().length > 0) score += 5;
    return Math.min(100, Math.max(0, score));
  }, [profileCompletion, reqSteps.length, userDatabase.notes, userDatabase.stageOwner, userDatabase.tags, userDatabase.targetMarket, userDatabase.transactionIntent, verCount]);
  const myInfoHealthScore = useMemo(() => {
    const buckets = [
      Math.round((profileCompletion / 4) * 100),
      Math.round((verCount / Math.max(reqSteps.length, 1)) * 100),
      Math.round((securityScore / Math.max(securityChecks.length, 1)) * 100),
      Math.round((legalCompletedCount / Math.max(requiredLegalComponents.length, 1)) * 100),
    ];
    return Math.round(buckets.reduce((sum, value) => sum + value, 0) / buckets.length);
  }, [legalCompletedCount, profileCompletion, reqSteps.length, requiredLegalComponents.length, securityChecks.length, securityScore, verCount]);
  const myInfoActionItems = useMemo(() => {
    const items = [];
    if (profileCompletion < 4) items.push({ title: "Finish core profile fields", detail: `${profileCompletion}/4 core fields complete`, tone: "accent" });
    if (verCount < reqSteps.length) items.push({ title: "Complete verification coverage", detail: `${verCount}/${reqSteps.length} required checks complete`, tone: "warn" });
    if (legalCompletedCount < requiredLegalComponents.length) items.push({ title: "Close legal readiness gaps", detail: `${legalCompletedCount}/${requiredLegalComponents.length} legal records verified`, tone: "warn" });
    if (securityScore < securityChecks.length - 1) items.push({ title: "Tighten account security", detail: `${securityScore}/${securityChecks.length} security controls active`, tone: "accent" });
    if (!trustedProfileVisible && trustedProfileEligible) items.push({ title: "Activate trusted profile badge", detail: verifiedBillingReady ? "Billing is ready for activation" : "Finish billing readiness to publish trust status", tone: verifiedBillingReady ? "good" : "accent" });
    if (!items.length) items.push({ title: "Profile looks operational", detail: "Core account, trust, security, and legal posture are in a good state.", tone: "good" });
    return items.slice(0, 5);
  }, [legalCompletedCount, profileCompletion, reqSteps.length, requiredLegalComponents.length, securityChecks.length, securityScore, trustedProfileEligible, trustedProfileVisible, verCount, verifiedBillingReady]);
  const myInfoRecentActivity = useMemo(() => ([
    { label: "Last profile write", value: lastUpdatedLabel, meta: "Managed account record" },
    { label: "Verification queue", value: verificationReview.queueLabel || "Standard review queue", meta: verificationReview.lastSubmittedAt ? `Last submitted ${formatProfileDate(verificationReview.lastSubmittedAt)}` : "No recent submission timestamp" },
    { label: "Trusted profile", value: trustedProfileVisible ? "Visible" : trustedProfileActive ? "Active but paused" : "Inactive", meta: trustedProfileSince ? `Since ${formatProfileDate(trustedProfileSince)}` : "No activation date recorded" },
    { label: "Security event", value: securityEvents[0]?.label || "No recent event", meta: securityEvents[0]?.time || "Timestamp pending" },
  ]), [lastUpdatedLabel, securityEvents, trustedProfileActive, trustedProfileSince, trustedProfileVisible, verificationReview.lastSubmittedAt, verificationReview.queueLabel]);
  const myInfoOverviewMetrics = useMemo(() => ([
    {
      label: "My Info Health",
      value: `${myInfoHealthScore}%`,
      detail: "Combined profile, legal, verification, and security posture",
      tone: myInfoHealthScore >= 85 ? "verified" : "type",
    },
    {
      label: "Verification",
      value: `${verCount}/${reqSteps.length}`,
      detail: "Required checks complete",
      tone: verCount >= reqSteps.length ? "verified" : "warn",
    },
    {
      label: "Legal Readiness",
      value: `${legalCompletedCount}/${requiredLegalComponents.length}`,
      detail: "Verified legal records",
      tone: legalCompletedCount >= requiredLegalComponents.length ? "verified" : "warn",
    },
    {
      label: "Security Controls",
      value: `${securityScore}/${securityChecks.length}`,
      detail: "Active protections",
      tone: securityScore >= securityChecks.length - 1 ? "verified" : "type",
    },
  ]), [legalCompletedCount, myInfoHealthScore, reqSteps.length, requiredLegalComponents.length, securityChecks.length, securityScore, verCount]);
  const myInfoStatusBadges = useMemo(() => {
    const items = [
      { label: accountBlueprint.label, variant: "role" },
      { label: verCount >= reqSteps.length ? "Fully verified" : `${verCount}/${reqSteps.length} verified`, variant: verCount >= reqSteps.length ? "verified" : "warn" },
      { label: securityScore >= securityChecks.length - 1 ? "Security aligned" : "Security review", variant: securityScore >= securityChecks.length - 1 ? "verified" : "type" },
    ];
    if (trustedProfileVisible) items.push({ label: "Trusted user", variant: "verified" });
    if ((isBuyerOrSeller || isCorp) && citizenInfo?.label) items.push({ label: citizenInfo.label, variant: citizenInfo?.badge || "warn" });
    if (isBuyerOrSeller) items.push({ label: homeownerVerified ? "Verified homeowner" : "Homeowner unverified", variant: homeownerVerified ? "verified" : "warn" });
    return items.slice(0, 5);
  }, [accountBlueprint.label, citizenInfo?.badge, citizenInfo?.label, homeownerVerified, isBuyerOrSeller, isCorp, reqSteps.length, securityChecks.length, securityScore, trustedProfileVisible, verCount]);
  const customerRecordHighlights = useMemo(() => ([
    { label: "Lifecycle status", value: userDatabase.status || "onboarding", meta: "Current customer record stage" },
    { label: "Intent", value: userDatabase.transactionIntent || "browse", meta: "Primary customer motion" },
    { label: "Preferred contact", value: userDatabase.preferredContact || "email", meta: "Outbound support default" },
    { label: "Support tier", value: userDatabase.supportTier || "standard", meta: "Current service posture" },
    { label: "Last contact", value: userDatabase.lastContactAt ? formatProfileDate(userDatabase.lastContactAt) : "Not recorded", meta: userDatabase.stageOwner ? `Owner: ${userDatabase.stageOwner}` : "No assigned stage owner" },
    { label: "Record depth", value: `${userDatabaseDepthScore}/100`, meta: "Database completeness score" },
  ]), [userDatabase.lastContactAt, userDatabase.preferredContact, userDatabase.stageOwner, userDatabase.status, userDatabase.supportTier, userDatabase.transactionIntent, userDatabaseDepthScore]);

  function updateSecurity(nextSecurity) {
    setUser({ ...user, security: { ...security, ...nextSecurity } });
  }

  function updateLegal(nextLegal) {
    const merged = { ...legal, ...nextLegal };
    setUser({ ...user, legal: merged });
  }

  function updateCompliance(nextCompliance) {
    setUser({ ...user, compliance: { ...compliance, ...nextCompliance } });
  }

  function submitSubpoenaRequest() {
    if (!isGovernment) return;
    const targetScope = subpoenaDraft.targetScope.trim();
    const outsideBoundaryReason = subpoenaDraft.outsideBoundaryReason.trim();
    const docketNumber = subpoenaDraft.docketNumber.trim();
    const judgeName = subpoenaDraft.judgeName.trim();
    const documentName = subpoenaDraft.documentName.trim();
    if (!targetScope || !outsideBoundaryReason || !docketNumber || !judgeName || !documentName) return;
    const entry = {
      id: `SUB-${Date.now()}`,
      status: "submitted",
      requestedAt: new Date().toISOString(),
      requestedBy: user.name || "Government profile",
      accountType: user.accountType,
      jurisdictionLabel: (ACCOUNT_TYPES.find((item) => item.key === user.accountType)?.label) || user.accountType,
      targetScope,
      outsideBoundaryReason,
      docketNumber,
      judgeName,
      documentName,
    };
    updateCompliance({
      subpoenaRequests: [entry, ...subpoenaRequests].slice(0, 12),
    });
    setSubpoenaDraft({
      targetScope: "",
      outsideBoundaryReason: "",
      docketNumber: "",
      judgeName: "",
      documentName: "",
    });
  }

  function updateTrust(nextTrust) {
    setUser({ ...user, trust: { ...trust, ...nextTrust } });
  }

  function updateReputation(nextReputation) {
    setUser({
      ...user,
      reputation: summarizeReputation({
        ...reputation,
        ...nextReputation,
      }),
    });
  }

  function addReputationFeedback() {
    const grade = REPUTATION_GRADES.includes(reputationDraft.grade) ? reputationDraft.grade : "B";
    const nowIso = new Date().toISOString();
    const entry = {
      id: `REP-${Date.now()}`,
      grade,
      score: reputationScoreFromGrade(grade),
      authorName: reputationDraft.authorName.trim() || "Verified EstateHat user",
      authorRole: reputationDraft.authorRole,
      transactionRef: reputationDraft.transactionRef.trim(),
      testimonial: reputationDraft.testimonial.trim().slice(0, 360),
      status: "published",
      createdAt: nowIso,
    };
    updateReputation({
      feedback: [entry, ...reputation.feedback].slice(0, 20),
      lastReviewedAt: nowIso,
    });
    setReputationDraft({ grade: "A", authorName: "", authorRole: "buyer", transactionRef: "", testimonial: "" });
  }

  function updateReputationFeedbackStatus(entryId, status) {
    const nextFeedback = reputation.feedback.map((entry) => entry.id === entryId ? { ...entry, status } : entry);
    updateReputation({
      feedback: nextFeedback,
      lastReviewedAt: new Date().toISOString(),
    });
  }

  function updateVerifiedBilling(nextVerifiedBilling) {
    setUser({
      ...user,
      verifiedBilling: {
        ...verifiedBilling,
        ...nextVerifiedBilling,
      },
    });
  }

  function updateReferralIncentive(nextReferralIncentive) {
    updateVerifiedBilling({
      referralIncentive: {
        ...referralIncentive,
        ...nextReferralIncentive,
      },
    });
  }

  function recordReferralCredit() {
    const cleanEmail = referralEmailCandidate;
    if (!cleanEmail || !cleanEmail.includes("@")) return;
    if (referralEmailAlreadyCredited || referralCapReached) return;
    const nowIso = new Date().toISOString();
    const nextCredit = {
      id: `REF-${Date.now()}`,
      friendEmail: cleanEmail,
      friendName: referralFriendName.trim(),
      status: "credited",
      freeMonths: 1,
      createdAt: nowIso,
      creditedAt: nowIso,
    };
    updateReferralIncentive({
      earnedFreeMonths: Math.min(12, referralIncentive.earnedFreeMonths + 1),
      credits: [nextCredit, ...referralIncentive.credits].slice(0, 12),
    });
    setReferralFriendEmail("");
    setReferralFriendName("");
  }

  function applyReferralFreeMonth() {
    if (referralIncentive.availableFreeMonths <= 0) return;
    const parsedNextCharge = Date.parse(verifiedBilling.nextChargeAt || "");
    const baseMs = Number.isFinite(parsedNextCharge) && parsedNextCharge > Date.now() ? parsedNextCharge : Date.now();
    updateVerifiedBilling({
      nextChargeAt: new Date(baseMs + 30 * 24 * 60 * 60 * 1000).toISOString(),
      referralIncentive: {
        ...referralIncentive,
        appliedFreeMonths: Math.min(referralIncentive.earnedFreeMonths, referralIncentive.appliedFreeMonths + 1),
      },
    });
  }

  function updateUserDatabase(nextUserDatabase) {
    const merged = { ...userDatabase, ...nextUserDatabase };
    const marketingOptInChanged = Object.prototype.hasOwnProperty.call(nextUserDatabase, "marketingOptIn");
    if (marketingOptInChanged) {
      if (nextUserDatabase.marketingOptIn) {
        merged.marketingConsentAt = new Date().toISOString();
        merged.marketingConsentMethod = merged.marketingConsentMethod || "checkbox";
        merged.marketingConsentVersion = MARKETING_CONSENT_VERSION;
        merged.marketingRevokedAt = null;
      } else {
        merged.marketingConsentAt = null;
        merged.marketingConsentMethod = "";
        merged.marketingConsentVersion = "";
        merged.marketingConsentIpHash = "";
        merged.marketingRevokedAt = new Date().toISOString();
      }
    }
    setUser({
      ...user,
      userDatabase: {
        ...merged,
        profileDepthScore: userDatabaseDepthScore,
      },
    });
  }

  function updatePayoutFramework(nextPayoutFramework) {
    setUser({
      ...user,
      payoutFramework: {
        ...payoutFramework,
        ...nextPayoutFramework,
      },
    });
  }

  function updateVerification(nextVerification) {
    setUser({
      ...user,
      verification: {
        ...(user.verification || {}),
        ...nextVerification,
        review: {
          status: verCount >= reqSteps.length ? "ready" : "in_progress",
          lastSubmittedAt: nextVerification.review?.lastSubmittedAt || user.verification?.review?.lastSubmittedAt || null,
          lastReviewedAt: user.verification?.review?.lastReviewedAt || null,
          queueLabel: nextVerification.review?.queueLabel || user.verification?.review?.queueLabel || "Standard review queue",
          notes: nextVerification.review?.notes || user.verification?.review?.notes || "Complete your required items to move from profile setup into live transaction use.",
        },
      },
    });
  }

  async function launchVerifiedProfileCheckout() {
    setBillingActionBusy("verified-checkout");
    setBillingActionError("");
    try {
      if ((verifiedBilling.provider || "stripe_connect") === "square") {
        const payload = await postSquareAction("verified-subscription/start", {}, { auth });
        const refreshed = auth.currentUser ? await loadUserProfile(auth.currentUser) : null;
        if (refreshed) {
          setUser(refreshed);
        }
        onNotify?.({
          tone: "success",
          title: "Square subscription started",
          body: payload.message || "Square verified billing has been started and will be tracked in EstateHat.",
        });
        return;
      }

      const payload = await postStripeAction("verified-checkout", {}, { auth });
      onNotify?.({ tone: "info", title: "Opening Stripe Checkout", body: "Verified membership billing is being handed to Stripe." });
      redirectToStripeUrl(payload.url);
    } catch (error) {
      setBillingActionError(error.message || "Unable to start verified billing.");
    } finally {
      setBillingActionBusy("");
    }
  }

  async function openVerifiedBillingPortal() {
    setBillingActionBusy("billing-portal");
    setBillingActionError("");
    try {
      if ((verifiedBilling.provider || "stripe_connect") === "square") {
        await postSquareAction("verified-subscription/refresh", {}, { auth });
        const refreshed = auth.currentUser ? await loadUserProfile(auth.currentUser) : null;
        if (refreshed) {
          setUser(refreshed);
        }
        onNotify?.({ tone: "success", title: "Square billing refreshed", body: "Verified billing status was refreshed from Square." });
        return;
      }

      const payload = await postStripeAction("billing-portal", {}, { auth });
      onNotify?.({ tone: "info", title: "Opening Stripe Billing", body: "Billing management is being handed to Stripe." });
      redirectToStripeUrl(payload.url);
    } catch (error) {
      setBillingActionError(error.message || "Unable to open billing.");
    } finally {
      setBillingActionBusy("");
    }
  }

  async function cancelSquareVerifiedSubscription() {
    setBillingActionBusy("square-cancel");
    setBillingActionError("");
    try {
      await postSquareAction("verified-subscription/cancel", {}, { auth });
      const refreshed = auth.currentUser ? await loadUserProfile(auth.currentUser) : null;
      if (refreshed) {
        setUser(refreshed);
      }
      onNotify?.({ tone: "success", title: "Square subscription canceled", body: "Verified billing has been canceled in Square." });
    } catch (error) {
      setBillingActionError(error.message || "Unable to cancel Square billing.");
    } finally {
      setBillingActionBusy("");
    }
  }

  async function startStripeConnectOnboarding() {
    setBillingActionBusy("connect-onboarding");
    setBillingActionError("");
    try {
      const payload = await postStripeAction("connect/onboarding", {}, { auth });
      onNotify?.({ tone: "info", title: "Opening Stripe Connect", body: "Payout onboarding is being handed to Stripe." });
      redirectToStripeUrl(payload.url);
    } catch (error) {
      setBillingActionError(error.message || "Unable to start Stripe Connect onboarding.");
    } finally {
      setBillingActionBusy("");
    }
  }

  async function refreshStripeConnectStatus() {
    setBillingActionBusy("connect-refresh");
    setBillingActionError("");
    try {
      await postStripeAction("connect/refresh", {}, { auth });
      const refreshed = auth.currentUser ? await loadUserProfile(auth.currentUser) : null;
      if (refreshed) {
        setUser(refreshed);
      }
      onNotify?.({ tone: "success", title: "Stripe status refreshed", body: "Payout status was refreshed from Stripe." });
    } catch (error) {
      setBillingActionError(error.message || "Unable to refresh Stripe Connect status.");
    } finally {
      setBillingActionBusy("");
    }
  }

  async function launchPlatformFeeCheckout() {
    const amountCents = Math.round(Number(platformFeeDraft.amount || 0) * 100);
    if (!Number.isFinite(amountCents) || amountCents < 50) {
      setBillingActionError("Enter a platform fee amount of at least $0.50.");
      return;
    }

    setBillingActionBusy("platform-fee");
    setBillingActionError("");
    try {
      if ((verifiedBilling.provider || "stripe_connect") === "square") {
        const payload = await postSquareAction("platform-fee-checkout", {
          amountCents,
          reference: platformFeeDraft.reference,
          description: platformFeeDraft.description,
          acknowledged: true,
        }, { auth });
        onNotify?.({ tone: "info", title: "Opening Square Checkout", body: "Platform fee collection is being handed to Square." });
        redirectToStripeUrl(payload.url);
        return;
      }

      const payload = await postStripeAction("platform-fee-checkout", {
        amountCents,
        reference: platformFeeDraft.reference,
        description: platformFeeDraft.description,
        acknowledged: true,
      }, { auth });
      onNotify?.({ tone: "info", title: "Opening Stripe Checkout", body: "Platform fee collection is being handed to Stripe." });
      redirectToStripeUrl(payload.url);
    } catch (error) {
      setBillingActionError(error.message || "Unable to start platform fee checkout.");
    } finally {
      setBillingActionBusy("");
    }
  }

  function applyVerificationStep(key, value, meta = {}) {
    const nextStatus = { ...(isCorp ? corpVerStatus : verStatus), [key]: value };
    if (isCorp) {
      setCorpVerStatus(nextStatus);
    } else {
      setVerStatus(nextStatus);
    }
    updateVerification({
      stepStatus: nextStatus,
      stepDocuments: meta.stepDocuments || verificationDocs,
      citizenshipStatus,
      homeownerVerified: key === "homeowner" ? value : homeownerVerified,
      review: {
        lastSubmittedAt: meta.lastSubmittedAt || new Date().toISOString(),
        queueLabel: meta.queueLabel || "Verification submitted",
        notes: meta.notes || "Recent verification evidence was added to the profile.",
      },
    });
  }

  function uploadVerificationEvidence(stepKey, files, reviewNotes) {
    if (!Array.isArray(files) || files.length === 0) return;
    const stamped = files.map((file) => ({ ...file, uploadedAt: new Date().toISOString() }));
    const nextDocs = {
      ...verificationDocs,
      [stepKey]: [...(verificationDocs[stepKey] || []), ...stamped],
    };
    setVerificationDocs(nextDocs);
    applyVerificationStep(stepKey, true, {
      stepDocuments: nextDocs,
      queueLabel: `${stepKey.replace(/_/g, " ")} evidence submitted`,
      notes: reviewNotes || "Verification evidence uploaded and queued for review.",
      lastSubmittedAt: new Date().toISOString(),
    });
  }

  useEffect(() => {
    const mergedStatus = isCorp ? corpVerStatus : verStatus;
    updateVerification({
      stepStatus: mergedStatus,
      stepDocuments: verificationDocs,
      citizenshipStatus,
      homeownerVerified: verStatus.homeowner,
      review: {
        queueLabel: verCount >= reqSteps.length ? "Ready for approval" : "Standard review queue",
        notes: verCount >= reqSteps.length
          ? "All required verification items are complete and ready for review."
          : "Complete the remaining required items to move into ready-for-review status.",
      },
    });
  }, [citizenshipStatus, corpVerStatus, isCorp, verCount, verStatus, verificationDocs]); // intentional sync into persisted profile shape

  return (
    <div style={{ maxWidth: tab === "profile" ? 1080 : 840, margin: "0 auto", padding: 24 }}>
      <SectionHeader title="My Info" sub="Keep your account details, paperwork status, and home-buying or selling information up to date" />
      <TabBar
        tabs={[
          { key: "profile", label: "Profile", icon: "👤" },
          { key: "reputation", label: "Reputation", icon: "🏅" },
          { key: "verification", label: "Verification", icon: "🪪" },
          { key: "security", label: "Security", icon: "🛡️" },
          { key: "documents", label: "Documents", icon: "📄" },
          ...(["attorney", "agent", "inspector", "lender"].includes(user.accountType) ? [{ key: "practice", label: user.accountType === "attorney" ? "Legal Practice" : user.accountType === "agent" ? "Agent Tools" : user.accountType === "inspector" ? "Inspections" : "Lending & Escrow", icon: user.accountType === "attorney" ? "⚖️" : user.accountType === "agent" ? "🔑" : user.accountType === "inspector" ? "🔍" : "🏦" }] : []),
          ...(isCorp ? [{ key: "entity", label: "Entity Management", icon: "🏛" }] : []),
          ...(perms.financial ? [{ key: "financial", label: "Financial", icon: "🏦" }] : []),
          ...(perms.viewReceipts ? [{ key: "receipts", label: "Receipts", icon: "🧾" }] : []),
        ]}
        active={tab}
        onSelect={setTab}
      />

      {tab === "profile" && (
        <div style={{ display: "grid", gridTemplateColumns: profileWide ? "minmax(0, 1.12fr) minmax(0, 0.88fr)" : profileMedium ? "repeat(2, minmax(0, 1fr))" : "1fr", gap: 16, alignItems: "start" }}>
          <Card style={{ gridColumn: "1 / -1", borderRadius: 24, padding: 0, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: profileWide ? "minmax(0,1.38fr) minmax(280px,0.86fr)" : "1fr", background: `linear-gradient(145deg, ${S.dark} 0%, ${S.mid} 52%, ${S.card} 100%)` }}>
              <div style={{ padding: 26, color: "#fff", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: "auto auto -72px -32px", width: 210, height: 210, borderRadius: 999, background: "radial-gradient(circle, rgba(201,157,74,0.28) 0%, rgba(201,157,74,0) 70%)" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 18, position: "relative" }}>
                  <div style={{ width: 78, height: 78, borderRadius: "50%", background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: S.font, fontWeight: 800, fontSize: 24, color: "#fff", backdropFilter: "blur(10px)" }}>
                    {user.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div>
                    <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: 1.7, textTransform: "uppercase", color: "rgba(255,255,255,0.68)", marginBottom: 6 }}>Account Overview</div>
                    <div style={{ fontFamily: S.serif, fontSize: 36, lineHeight: 1.04, marginBottom: 6 }}>{user.name}</div>
                    <div style={{ fontFamily: S.font, fontSize: 14, color: "rgba(255,255,255,0.74)", lineHeight: 1.6, maxWidth: 620 }}>
                      Keep your identity, legal posture, trust state, and customer record aligned before you move deeper into listings, messages, documents, and closing flow.
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 16, flexWrap: "wrap", position: "relative" }}>
                  {myInfoStatusBadges.map((item) => (
                    <Badge key={item.label} variant={item.variant}>{item.label}</Badge>
                  ))}
                  {reputation.visibility !== false && <GradeBadge grade={reputation.grade} score={reputation.score} />}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginTop: 18, position: "relative" }}>
                  {myInfoOverviewMetrics.map((metric) => (
                    <div key={metric.label} style={{ borderRadius: 18, padding: "14px 15px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.12)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                        <div style={{ fontFamily: S.font, fontSize: 11, color: "rgba(255,255,255,0.68)", textTransform: "uppercase", letterSpacing: 1.2 }}>{metric.label}</div>
                        <Badge variant={metric.tone}>{metric.tone === "verified" ? "Ready" : metric.value}</Badge>
                      </div>
                      <div style={{ fontFamily: S.serif, fontSize: 28, lineHeight: 1.04, marginTop: 8 }}>{metric.value}</div>
                      <div style={{ fontFamily: S.font, fontSize: 11.5, color: "rgba(255,255,255,0.74)", lineHeight: 1.55, marginTop: 6 }}>{metric.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ padding: 22, background: "#f8f4ec", borderLeft: profileWide ? `1px solid ${S.border}` : "none", borderTop: !profileWide ? `1px solid ${S.border}` : "none" }}>
                <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: 1.6, textTransform: "uppercase", color: S.light, marginBottom: 8 }}>Record Summary</div>
                <div style={{ display: "grid", gap: 10 }}>
                  {[
                    ["Email", user.email],
                    ["OneID / One EstateHat", user.oneEstateHatId || "Pending"],
                    ["Member since", memberSinceLabel],
                    ["Last record update", lastUpdatedLabel],
                  ].map(([label, value]) => (
                    <div key={label} style={{ borderRadius: 16, padding: "12px 14px", background: S.card, border: `1px solid ${S.border}` }}>
                      <div style={{ fontFamily: S.font, fontSize: 11, color: S.light, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 4 }}>{label}</div>
                      <div style={{ fontFamily: label === "OneID / One EstateHat" ? S.serif : S.font, fontSize: label === "OneID / One EstateHat" ? 22 : 13.5, color: S.dark, lineHeight: 1.35, fontWeight: label === "OneID / One EstateHat" ? 400 : 700 }}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 16, background: S.greenBg, fontFamily: S.font, fontSize: 12, lineHeight: 1.55, color: S.green }}>
                  Merge-based profile writes preserve the rest of the Firestore user record while this page updates managed account fields.
                </div>
              </div>
            </div>
          </Card>
          {isGovernment && (
            <Card style={{ gridColumn: "1 / -1", background: S.surfaceAlt }}>
              <div style={{ display: "grid", gridTemplateColumns: profileWide ? "1.1fr 0.9fr" : "1fr", gap: 16 }}>
                <div>
                  <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: S.light, marginBottom: 8, fontWeight: 700 }}>
                    Government Boundary
                  </div>
                  <div style={{ fontFamily: S.font, fontSize: 14, color: S.dark, fontWeight: 800, lineHeight: 1.45 }}>
                    Government profiles are limited-rights oversight accounts.
                  </div>
                  <div style={{ fontFamily: S.font, fontSize: 12.5, color: S.muted, lineHeight: 1.65, marginTop: 8 }}>
                    EstateHat allows government participation inside the platform, but access to private information outside the profile's normal jurisdictional boundary should only move forward through judge-backed paperwork that includes the judge's name and signature.
                  </div>
                  <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                    {[
                      "Government participation is allowed within normal platform and jurisdiction scope",
                      "Out-of-boundary private information requires subpoena paperwork",
                      "Judge name and signature are required before elevated access review",
                    ].map((item) => (
                      <div key={item} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <span style={{ color: S.gold, fontSize: 15, marginTop: 1 }}>•</span>
                        <div style={{ fontFamily: S.font, fontSize: 12.5, color: S.muted, lineHeight: 1.55 }}>{item}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: S.light, fontWeight: 700 }}>
                      Subpoena Request
                    </div>
                    <Badge variant={subpoenaRequests.length ? "type" : "warn"}>{subpoenaRequests.length} logged</Badge>
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    <div>
                      <label style={S.label}>Requested information scope</label>
                      <input value={subpoenaDraft.targetScope} onChange={(e) => setSubpoenaDraft((current) => ({ ...current, targetScope: e.target.value }))} placeholder="Records, account, transaction, or document scope" style={S.input} />
                    </div>
                    <div>
                      <label style={S.label}>Why this is outside boundary</label>
                      <textarea value={subpoenaDraft.outsideBoundaryReason} onChange={(e) => setSubpoenaDraft((current) => ({ ...current, outsideBoundaryReason: e.target.value }))} placeholder="State why the request exceeds normal jurisdiction scope" style={{ ...S.input, minHeight: 84, resize: "vertical" }} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: profileMedium ? "1fr 1fr" : "1fr", gap: 10 }}>
                      <div>
                        <label style={S.label}>Subpoena docket / reference</label>
                        <input value={subpoenaDraft.docketNumber} onChange={(e) => setSubpoenaDraft((current) => ({ ...current, docketNumber: e.target.value }))} placeholder="Court, docket, or subpoena reference" style={S.input} />
                      </div>
                      <div>
                        <label style={S.label}>Judge name</label>
                        <input value={subpoenaDraft.judgeName} onChange={(e) => setSubpoenaDraft((current) => ({ ...current, judgeName: e.target.value }))} placeholder="Presiding judge name" style={S.input} />
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: profileMedium ? "1fr 1fr" : "1fr", gap: 10 }}>
                      <div>
                        <label style={S.label}>Paperwork file name</label>
                        <input value={subpoenaDraft.documentName} onChange={(e) => setSubpoenaDraft((current) => ({ ...current, documentName: e.target.value }))} placeholder="Signed subpoena PDF or order packet file name" style={S.input} />
                      </div>
                      <div style={{ alignSelf: "end", fontFamily: S.font, fontSize: 11.5, color: S.light, lineHeight: 1.55, paddingBottom: 4 }}>
                        Signed paperwork should show the judge name, signature, and the request reference before private out-of-boundary information is reviewed.
                      </div>
                    </div>
                    <button onClick={submitSubpoenaRequest} style={{ ...S.btn(S.dark, S.card), width: "100%" }}>
                      Log judge-backed subpoena request
                    </button>
                    {subpoenaRequests.length > 0 && (
                      <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
                        {subpoenaRequests.slice(0, 3).map((entry) => (
                          <div key={entry.id} style={{ borderRadius: 10, border: `1px solid ${S.border}`, background: S.surfaceAlt, padding: "10px 12px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                              <strong style={{ fontFamily: S.font, fontSize: 12.5, color: S.dark }}>{entry.docketNumber}</strong>
                              <Badge variant="type">{entry.status}</Badge>
                            </div>
                            <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.muted, lineHeight: 1.55, marginTop: 5 }}>
                              {entry.targetScope} · {entry.documentName}
                            </div>
                            <div style={{ fontFamily: S.font, fontSize: 11, color: S.light, marginTop: 5 }}>
                              {formatProfileDate(entry.requestedAt)} · {entry.jurisdictionLabel} · Judge {entry.judgeName}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}
          <Card style={{ gridColumn: profileWide ? "auto" : "1 / -1", borderRadius: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: S.light, fontWeight: 700 }}>
                Action Queue
              </div>
              <Badge variant={myInfoActionItems.some((item) => item.tone === "warn") ? "warn" : "verified"}>
                {myInfoActionItems.length} items
              </Badge>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {myInfoActionItems.map((item) => (
                <div key={item.title} style={{ border: `1px solid ${item.tone === "warn" ? `${S.red}33` : item.tone === "good" ? `${S.green}33` : S.border}`, borderRadius: 12, padding: "12px 14px", background: item.tone === "warn" ? S.redBg : item.tone === "good" ? S.greenBg : S.surfaceAlt }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <strong style={{ fontFamily: S.font, fontSize: 13, color: S.dark }}>{item.title}</strong>
                    <Badge variant={item.tone === "warn" ? "warn" : item.tone === "good" ? "verified" : "type"}>{item.tone === "warn" ? "Attention" : item.tone === "good" ? "Good" : "Next"}</Badge>
                  </div>
                  <div style={{ fontFamily: S.font, fontSize: 12, color: S.muted, lineHeight: 1.55, marginTop: 6 }}>{item.detail}</div>
                </div>
              ))}
            </div>
          </Card>
          <Card style={{ gridColumn: profileWide ? "span 1" : "1 / -1", borderRadius: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: S.light, fontWeight: 700 }}>
                Recent Activity
              </div>
              <Badge variant="type">Profile timeline</Badge>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {myInfoRecentActivity.map((entry, index) => (
                <div key={entry.label} style={{ display: "grid", gridTemplateColumns: "20px 1fr", gap: 10 }}>
                  <div>
                    <div style={{ width: 12, height: 12, borderRadius: 99, background: index === 0 ? S.gold : S.surface, marginTop: 4 }} />
                    {index < myInfoRecentActivity.length - 1 && <div style={{ width: 2, height: 30, background: S.border, marginLeft: 5, marginTop: 4 }} />}
                  </div>
                  <div style={{ paddingBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <strong style={{ fontFamily: S.font, fontSize: 12.5, color: S.dark }}>{entry.label}</strong>
                      <span style={{ fontFamily: S.font, fontSize: 11.5, color: S.muted }}>{entry.value}</span>
                    </div>
                    <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.light, lineHeight: 1.5, marginTop: 4 }}>{entry.meta}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card style={{ gridColumn: profileWide ? "span 1" : "1 / -1", borderRadius: 24 }}>
            <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: S.light, marginBottom: 8, fontWeight: 700 }}>
              Account Scope
            </div>
            <div style={{ fontFamily: S.serif, fontSize: 28, color: S.dark, lineHeight: 1.08, marginBottom: 8 }}>{accountBlueprint.label}</div>
            <div style={{ fontFamily: S.font, fontSize: 12.5, color: S.light, lineHeight: 1.6, marginBottom: 12 }}>
              Use this account posture across listings, search, messages, forms, documents, support, and transaction readiness steps.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {accountBlueprint.responsibilities.map((item) => (
                <div key={item} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ color: S.gold, fontSize: 15, marginTop: 1 }}>•</span>
                  <div style={{ fontFamily: S.font, fontSize: 12.5, color: S.muted, lineHeight: 1.55 }}>{item}</div>
                </div>
              ))}
            </div>
          </Card>
          <Card style={{ gridColumn: profileWide ? "span 1" : "1 / -1", borderRadius: 24 }}>
            <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: S.light, marginBottom: 8, fontWeight: 700 }}>
              Customer Record Health
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
              <div style={{ padding: 14, borderRadius: 14, background: S.surfaceAlt }}>
                <div style={{ fontFamily: S.font, fontSize: 11, color: S.light, textTransform: "uppercase", letterSpacing: 1.2 }}>Profile completion</div>
                <div style={{ fontFamily: S.serif, fontSize: 28, color: S.dark, marginTop: 4 }}>{profileCompletion}/4</div>
                <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.muted, marginTop: 4 }}>Core customer fields populated</div>
              </div>
              {customerRecordHighlights.map((item) => (
                <div key={item.label} style={{ padding: 14, borderRadius: 16, background: S.surfaceAlt }}>
                  <div style={{ fontFamily: S.font, fontSize: 11, color: S.light, textTransform: "uppercase", letterSpacing: 1.2 }}>{item.label}</div>
                  <div style={{ fontFamily: item.label === "Record depth" ? S.serif : S.font, fontSize: item.label === "Record depth" ? 28 : 14, color: S.dark, fontWeight: item.label === "Record depth" ? 400 : 700, marginTop: 6 }}>
                    {item.value}
                  </div>
                  <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.muted, marginTop: 5 }}>{item.meta}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 12, background: S.greenBg, fontFamily: S.font, fontSize: 12, color: S.green, lineHeight: 1.55 }}>
              Customer database integrity is preserved by merge-based profile writes. Saving this page updates managed fields without replacing unrelated user record data.
            </div>
          </Card>
          <Card style={{ gridColumn: "1 / -1", borderRadius: 24 }}>
            <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: S.light, marginBottom: 8, fontWeight: 700 }}>
              User & Customer Database
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
              <div>
                <label style={S.label}>Lifecycle Status</label>
                <select
                  value={userDatabase.status || "onboarding"}
                  onChange={(e) => updateUserDatabase({ status: e.target.value })}
                  style={{ ...S.input, cursor: "pointer" }}
                >
                  <option value="lead">Lead</option>
                  <option value="onboarding">Onboarding</option>
                  <option value="active">Active</option>
                  <option value="transacting">Transacting</option>
                  <option value="closed">Closed</option>
                  <option value="dormant">Dormant</option>
                </select>
              </div>
              <div>
                <label style={S.label}>Lead Source</label>
                <input
                  value={userDatabase.leadSource || ""}
                  onChange={(e) => updateUserDatabase({ leadSource: e.target.value })}
                  placeholder="direct, referral, campaign"
                  style={S.input}
                />
              </div>
              <div>
                <label style={S.label}>Preferred Contact</label>
                <select
                  value={userDatabase.preferredContact || "email"}
                  onChange={(e) => updateUserDatabase({ preferredContact: e.target.value })}
                  style={{ ...S.input, cursor: "pointer" }}
                >
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="sms">SMS</option>
                  <option value="in_app">In-App</option>
                </select>
              </div>
              <div>
                <label style={S.label}>Support Tier</label>
                <select
                  value={userDatabase.supportTier || "standard"}
                  onChange={(e) => updateUserDatabase({ supportTier: e.target.value })}
                  style={{ ...S.input, cursor: "pointer" }}
                >
                  <option value="standard">Standard</option>
                  <option value="priority">Priority</option>
                  <option value="white_glove">White Glove</option>
                </select>
              </div>
              <div>
                <label style={S.label}>Preferred Language</label>
                <input
                  value={userDatabase.preferredLanguage || ""}
                  onChange={(e) => updateUserDatabase({ preferredLanguage: e.target.value })}
                  placeholder="English"
                  style={S.input}
                />
              </div>
              <div>
                <label style={S.label}>Risk Level</label>
                <select
                  value={userDatabase.riskLevel || "low"}
                  onChange={(e) => updateUserDatabase({ riskLevel: e.target.value })}
                  style={{ ...S.input, cursor: "pointer" }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label style={S.label}>Transaction Intent</label>
                <select
                  value={userDatabase.transactionIntent || "browse"}
                  onChange={(e) => updateUserDatabase({ transactionIntent: e.target.value })}
                  style={{ ...S.input, cursor: "pointer" }}
                >
                  <option value="browse">Browse</option>
                  <option value="buy">Buy</option>
                  <option value="sell">Sell</option>
                  <option value="buy_sell">Buy & Sell</option>
                  <option value="invest">Invest</option>
                  <option value="service">Service Provider</option>
                </select>
              </div>
              <div>
                <label style={S.label}>Stage Owner</label>
                <input
                  value={userDatabase.stageOwner || ""}
                  onChange={(e) => updateUserDatabase({ stageOwner: e.target.value })}
                  placeholder="Support desk, self-serve, concierge"
                  style={S.input}
                />
              </div>
              <div>
                <label style={S.label}>Target Market</label>
                <input
                  value={userDatabase.targetMarket || ""}
                  onChange={(e) => updateUserDatabase({ targetMarket: e.target.value })}
                  placeholder="Raleigh, NC · Miami, FL · Hudson Valley"
                  style={S.input}
                />
              </div>
              <div>
                <label style={S.label}>Budget Band</label>
                <select
                  value={userDatabase.budgetBand || "undisclosed"}
                  onChange={(e) => updateUserDatabase({ budgetBand: e.target.value })}
                  style={{ ...S.input, cursor: "pointer" }}
                >
                  <option value="undisclosed">Undisclosed</option>
                  <option value="under_250k">Under $250K</option>
                  <option value="250k_500k">$250K-$500K</option>
                  <option value="500k_1m">$500K-$1M</option>
                  <option value="1m_2m">$1M-$2M</option>
                  <option value="2m_plus">$2M+</option>
                </select>
              </div>
              <div>
                <label style={S.label}>Timeline Band</label>
                <select
                  value={userDatabase.timelineBand || "undisclosed"}
                  onChange={(e) => updateUserDatabase({ timelineBand: e.target.value })}
                  style={{ ...S.input, cursor: "pointer" }}
                >
                  <option value="undisclosed">Undisclosed</option>
                  <option value="immediate">Immediate</option>
                  <option value="30_days">Within 30 days</option>
                  <option value="90_days">Within 90 days</option>
                  <option value="6_months">Within 6 months</option>
                  <option value="12_months_plus">12+ months</option>
                </select>
              </div>
              <div>
                <label style={S.label}>Last Contact</label>
                <input
                  type="date"
                  value={userDatabase.lastContactAt ? String(userDatabase.lastContactAt).slice(0, 10) : ""}
                  onChange={(e) => updateUserDatabase({ lastContactAt: e.target.value ? new Date(`${e.target.value}T12:00:00.000Z`).toISOString() : null })}
                  style={S.input}
                />
              </div>
            </div>
            <label style={S.label}>Tags (comma separated)</label>
            <input
              value={Array.isArray(userDatabase.tags) ? userDatabase.tags.join(", ") : ""}
              onChange={(e) => updateUserDatabase({ tags: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) })}
              placeholder="first_time_buyer, relocation, high_intent"
              style={S.input}
            />
            <label style={S.label}>Internal Notes</label>
            <textarea
              rows={4}
              value={userDatabase.notes || ""}
              onChange={(e) => updateUserDatabase({ notes: e.target.value })}
              placeholder="Customer history, support context, and anti-fraud notes."
              style={{ ...S.input, resize: "vertical" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: S.font, fontSize: 12.5, color: S.muted }}>
                <input
                  type="checkbox"
                  checked={!!userDatabase.marketingOptIn}
                  onChange={(e) => updateUserDatabase({ marketingOptIn: e.target.checked })}
                />
                Marketing opt-in
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: S.font, fontSize: 12.5, color: S.muted }}>
                <input
                  type="checkbox"
                  checked={!!userDatabase.fraudWatch}
                  onChange={(e) => updateUserDatabase({ fraudWatch: e.target.checked })}
                />
                Fraud watch
              </label>
            </div>
            <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: S.surfaceAlt, fontFamily: S.font, fontSize: 12, color: S.muted }}>
              Database depth score: <strong style={{ color: S.dark }}>{userDatabaseDepthScore}/100</strong>
            </div>
            <div style={{ marginTop: 8, fontFamily: S.font, fontSize: 11.5, color: S.light, lineHeight: 1.55 }}>
              Marketing consent: {userDatabase.marketingOptIn ? "Opted in" : "Not opted in"} ·
              {" "}Version {userDatabase.marketingConsentVersion || "n/a"} ·
              {" "}Captured {userDatabase.marketingConsentAt ? formatProfileDate(userDatabase.marketingConsentAt) : "not recorded"}
            </div>
          </Card>
          <Card style={{ gridColumn: profileWide ? "auto" : "1 / -1", borderRadius: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: S.light, fontWeight: 700 }}>
                Required Legal Steps
              </div>
              <Badge variant={legalCompletedCount >= requiredLegalComponents.length ? "verified" : "warn"}>
                {legalCompletedCount}/{requiredLegalComponents.length} complete
              </Badge>
            </div>
            <ProgressBar value={legalCompletedCount} max={requiredLegalComponents.length} color={legalCompletedCount >= requiredLegalComponents.length ? S.green : S.gold} />
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {requiredLegalComponents.map((component) => {
                const state = legal?.components?.[component.key] || {};
                const evidenceOptions = getLegalEvidenceOptionsForComponent(component.key);
                const isDone = isLegalComponentComplete(component.key, state);
                const verificationReady = isLegalComponentVerificationValid(component.key, state);
                return (
                  <div key={component.key} style={{ border: `1px solid ${S.border}`, borderRadius: 12, padding: "10px 12px", background: isDone ? S.greenBg : S.surfaceAlt }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <div>
                        <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 13, color: S.dark }}>{component.label}</div>
                        <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.muted, lineHeight: 1.5, marginTop: 2 }}>{component.desc}</div>
                        <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.light, lineHeight: 1.5, marginTop: 4 }}>
                          Verification record required: evidence type, document reference, and attestation.
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          updateLegal({
                            components: {
                              ...(legal.components || {}),
                              [component.key]: {
                                ...(legal?.components?.[component.key] || {}),
                                complete: false,
                                completedAt: null,
                                evidenceType: "",
                                notes: "",
                                attested: false,
                                attestedAt: null,
                              },
                            },
                            ...(component.key === "terms_ack" ? { acceptedTermsAt: null } : {}),
                            ...(component.key === "privacy_ack" ? { acceptedPrivacyAt: null } : {}),
                            ...(component.key === "disclosures_ack" ? { acceptedLegalDisclosuresAt: null } : {}),
                          });
                        }}
                        style={{ ...S.btn(S.surfaceAlt, S.dark), border: `1px solid ${S.border}`, minWidth: 90 }}
                      >
                        Clear
                      </button>
                    </div>
                    <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "minmax(160px, 250px) minmax(0, 1fr)", gap: 8 }}>
                        <select
                          value={state.evidenceType || ""}
                          onChange={(e) => {
                            updateLegal({
                              components: {
                                ...(legal.components || {}),
                                [component.key]: {
                                  ...(legal?.components?.[component.key] || {}),
                                  evidenceType: e.target.value,
                                  complete: false,
                                  completedAt: null,
                                },
                              },
                            });
                          }}
                          style={{ ...S.input, minHeight: 40 }}
                        >
                          <option value="">Select verification evidence</option>
                          {evidenceOptions.map((option) => (
                            <option key={option.key} value={option.key}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <input
                          value={state.notes || ""}
                          onChange={(e) => {
                            updateLegal({
                              components: {
                                ...(legal.components || {}),
                                [component.key]: {
                                  ...(legal?.components?.[component.key] || {}),
                                  notes: e.target.value.slice(0, 180),
                                  complete: false,
                                  completedAt: null,
                                },
                              },
                            });
                          }}
                          placeholder="Document file name, letter ID, or verification reference"
                          style={{ ...S.input, minHeight: 40 }}
                        />
                      </div>
                      <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontFamily: S.font, fontSize: 12, color: S.muted }}>
                        <input
                          type="checkbox"
                          checked={!!state.attested}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            updateLegal({
                              components: {
                                ...(legal.components || {}),
                                [component.key]: {
                                  ...(legal?.components?.[component.key] || {}),
                                  attested: checked,
                                  attestedAt: checked ? new Date().toISOString() : null,
                                  complete: false,
                                  completedAt: null,
                                },
                              },
                            });
                          }}
                        />
                        <span>I attest this legal record is accurate and can be produced for audit, compliance review, or legal proceedings.</span>
                      </label>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ fontFamily: S.font, fontSize: 11.5, color: verificationReady ? S.green : S.red }}>
                          {verificationReady ? "Verification record is complete." : "Complete all verification fields before confirming this legal component."}
                        </div>
                        <button
                          onClick={() => {
                            if (!verificationReady) return;
                            const nowIso = new Date().toISOString();
                            updateLegal({
                              components: {
                                ...(legal.components || {}),
                                [component.key]: {
                                  ...(legal?.components?.[component.key] || {}),
                                  complete: true,
                                  completedAt: nowIso,
                                  attestedAt: state.attestedAt || nowIso,
                                },
                              },
                              ...(component.key === "terms_ack" ? { acceptedTermsAt: nowIso } : {}),
                              ...(component.key === "privacy_ack" ? { acceptedPrivacyAt: nowIso } : {}),
                              ...(component.key === "disclosures_ack" ? { acceptedLegalDisclosuresAt: nowIso } : {}),
                            });
                          }}
                          disabled={!verificationReady}
                          style={{
                            ...S.btn(verificationReady ? S.green : S.surfaceAlt, verificationReady ? S.greenBg : S.muted),
                            border: verificationReady ? "none" : `1px solid ${S.border}`,
                            minWidth: 142,
                            cursor: verificationReady ? "pointer" : "not-allowed",
                          }}
                        >
                          {isDone ? "Verified" : "Verify Component"}
                        </button>
                      </div>
                    </div>
                    {state.attestedAt && (
                      <div style={{ fontFamily: S.font, fontSize: 11, color: S.light, marginTop: 4 }}>
                        Attested: {formatProfileDate(state.attestedAt)}
                      </div>
                    )}
                    {state.completedAt && (
                      <div style={{ fontFamily: S.font, fontSize: 11, color: S.light, marginTop: 6 }}>
                        Completed: {formatProfileDate(state.completedAt)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 10, fontFamily: S.font, fontSize: 11.5, color: S.muted, lineHeight: 1.55 }}>
              These steps are installed per profile and required before trusted status and sensitive workflows become fully active.
            </div>
          </Card>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: S.light, fontWeight: 700 }}>
                Compliance Controls
              </div>
              <Badge variant={complianceLegalHold.active ? "warn" : "verified"}>
                {complianceLegalHold.active ? "Legal Hold Active" : "Operational"}
              </Badge>
            </div>
            {!canManageComplianceControls && (
              <div style={{ marginBottom: 10, padding: "10px 12px", borderRadius: 10, border: `1px solid ${S.border}`, background: S.surfaceAlt, fontFamily: S.font, fontSize: 12, color: S.muted, lineHeight: 1.55 }}>
                Compliance operational controls are restricted to designated compliance administrators.
              </div>
            )}
            <div style={{ display: "grid", gap: 8, marginBottom: 10, opacity: canManageComplianceControls ? 1 : 0.65, pointerEvents: canManageComplianceControls ? "auto" : "none" }}>
              <label style={S.label}>Jurisdiction State</label>
              <input
                value={complianceJurisdiction.state || "NC"}
                onChange={(e) => updateCompliance({
                  jurisdiction: {
                    ...complianceJurisdiction,
                    state: e.target.value.slice(0, 60),
                  },
                })}
                style={S.input}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={S.label}>County</label>
                  <input
                    value={complianceJurisdiction.county || "Wake"}
                    onChange={(e) => updateCompliance({
                      jurisdiction: {
                        ...complianceJurisdiction,
                        county: e.target.value.slice(0, 80),
                      },
                    })}
                    style={S.input}
                  />
                </div>
                <div>
                  <label style={S.label}>City</label>
                  <input
                    value={complianceJurisdiction.city || "Raleigh"}
                    onChange={(e) => updateCompliance({
                      jurisdiction: {
                        ...complianceJurisdiction,
                        city: e.target.value.slice(0, 80),
                      },
                    })}
                    style={S.input}
                  />
                </div>
              </div>
              <label style={S.label}>Municipality (Borough / Parish / Equivalent)</label>
              <input
                value={complianceJurisdiction.municipality || ""}
                onChange={(e) => updateCompliance({
                  jurisdiction: {
                    ...complianceJurisdiction,
                    municipality: e.target.value.slice(0, 120),
                  },
                })}
                placeholder="e.g., Brooklyn Borough, Orleans Parish"
                style={S.input}
              />
              <button
                onClick={() => {
                  const nowIso = new Date().toISOString();
                  updateCompliance({
                    jurisdiction: {
                      ...complianceJurisdiction,
                      state: locationOverlay.state,
                      county: locationOverlay.county,
                      city: locationOverlay.city,
                      municipality: locationOverlay.municipality,
                    },
                    outlierFlags: {
                      ...locationOverlay.outlierFlags,
                    },
                    regulatoryProfile: {
                      ...complianceRegulatoryProfile,
                      baselineProfile: "strict_us_51",
                      outlierReviewRequired: !!locationOverlay.outlierFlags.counselReviewRequired,
                      outlierLastReviewedAt: nowIso,
                      lastJurisdictionReviewAt: nowIso,
                    },
                    supportPacket: {
                      ...complianceSupportPacket,
                      notes: locationOverlay.checklist.join(" | ").slice(0, 600),
                    },
                  });
                }}
                style={{ ...S.btn(S.surfaceAlt, S.dark), border: `1px solid ${S.border}` }}
              >
                Apply Location Compliance Profile
              </button>
              <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.muted, lineHeight: 1.6 }}>
                Location checklist: {locationOverlay.checklist.join(" • ")}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {[
                  ["federalEnabled", "Federal"],
                  ["stateEnabled", "State"],
                  ["countyEnabled", "County"],
                  ["cityEnabled", "City"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => updateCompliance({
                      regulatoryProfile: {
                        ...complianceRegulatoryProfile,
                        [key]: !complianceRegulatoryProfile[key],
                      },
                    })}
                    style={{
                      ...S.btn(complianceRegulatoryProfile[key] ? S.greenBg : S.surfaceAlt, complianceRegulatoryProfile[key] ? S.green : S.muted),
                      border: `1px solid ${complianceRegulatoryProfile[key] ? `${S.green}44` : S.border}`,
                      fontSize: 12,
                    }}
                  >
                    {complianceRegulatoryProfile[key] ? "✓" : "○"} {label}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.muted }}>
                  Last jurisdiction review: {complianceRegulatoryProfile.lastJurisdictionReviewAt ? formatProfileDate(complianceRegulatoryProfile.lastJurisdictionReviewAt) : "Not recorded"}
                </div>
                <button
                  onClick={() => updateCompliance({
                    regulatoryProfile: {
                      ...complianceRegulatoryProfile,
                      lastJurisdictionReviewAt: new Date().toISOString(),
                    },
                    policy: {
                      ...compliancePolicy,
                      lastPolicyReviewAt: new Date().toISOString(),
                      termsVersion: compliancePolicy.termsVersion || CURRENT_POLICY_VERSIONS.terms,
                      privacyVersion: compliancePolicy.privacyVersion || CURRENT_POLICY_VERSIONS.privacy,
                      disclosuresVersion: compliancePolicy.disclosuresVersion || CURRENT_POLICY_VERSIONS.disclosures,
                    },
                  })}
                  style={{ ...S.btn(S.surfaceAlt, S.dark), border: `1px solid ${S.border}` }}
                >
                  Log Review Timestamp
                </button>
              </div>
            </div>
            <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: 10, marginTop: 8, display: "grid", gap: 8, opacity: canManageComplianceControls ? 1 : 0.65, pointerEvents: canManageComplianceControls ? "auto" : "none" }}>
              <div style={{ fontFamily: S.font, fontSize: 12, fontWeight: 700, color: S.dark }}>Legal Hold</div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: S.font, fontSize: 12.5, color: S.muted }}>
                <input
                  type="checkbox"
                  checked={!!complianceLegalHold.active}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    updateCompliance({
                      legalHold: {
                        ...complianceLegalHold,
                        active: checked,
                        initiatedAt: checked ? new Date().toISOString() : complianceLegalHold.initiatedAt || null,
                        releasedAt: checked ? null : new Date().toISOString(),
                      },
                    });
                  }}
                />
                Hold high-risk transactions for legal review
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
                <input
                  value={complianceLegalHold.matterId || ""}
                  onChange={(e) => updateCompliance({
                    legalHold: {
                      ...complianceLegalHold,
                      matterId: e.target.value.slice(0, 80),
                    },
                  })}
                  placeholder="Matter ID"
                  style={S.input}
                />
                <input
                  value={complianceLegalHold.reason || ""}
                  onChange={(e) => updateCompliance({
                    legalHold: {
                      ...complianceLegalHold,
                      reason: e.target.value.slice(0, 240),
                    },
                  })}
                  placeholder="Reason for hold"
                  style={S.input}
                />
              </div>
            </div>
            <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: 10, marginTop: 8, display: "grid", gap: 8, opacity: canManageComplianceControls ? 1 : 0.65, pointerEvents: canManageComplianceControls ? "auto" : "none" }}>
              <div style={{ fontFamily: S.font, fontSize: 12, fontWeight: 700, color: S.dark }}>Incident Posture</div>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(120px, 180px) minmax(120px, 180px) 1fr", gap: 8 }}>
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={Number.isFinite(Number(complianceIncidents.openCount)) ? complianceIncidents.openCount : 0}
                  onChange={(e) => updateCompliance({
                    incidents: {
                      ...complianceIncidents,
                      openCount: Math.max(0, Math.min(999, Number(e.target.value) || 0)),
                    },
                  })}
                  style={S.input}
                />
                <select
                  value={complianceIncidents.escalationLevel || "none"}
                  onChange={(e) => updateCompliance({
                    incidents: {
                      ...complianceIncidents,
                      escalationLevel: e.target.value,
                    },
                  })}
                  style={S.input}
                >
                  <option value="none">No Escalation</option>
                  <option value="watch">Watch</option>
                  <option value="critical">Critical</option>
                </select>
                <button
                  onClick={() => updateCompliance({
                    incidents: {
                      ...complianceIncidents,
                      lastIncidentAt: new Date().toISOString(),
                    },
                  })}
                  style={{ ...S.btn(S.surfaceAlt, S.dark), border: `1px solid ${S.border}` }}
                >
                  Stamp Incident Timestamp
                </button>
              </div>
            </div>
            <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: 10, marginTop: 8, display: "grid", gap: 6, opacity: canManageComplianceControls ? 1 : 0.65, pointerEvents: canManageComplianceControls ? "auto" : "none" }}>
              <div style={{ fontFamily: S.font, fontSize: 12, fontWeight: 700, color: S.dark }}>Policy Versions</div>
              <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.muted }}>Terms: {compliancePolicy.termsVersion || CURRENT_POLICY_VERSIONS.terms}</div>
              <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.muted }}>Privacy: {compliancePolicy.privacyVersion || CURRENT_POLICY_VERSIONS.privacy}</div>
              <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.muted }}>Disclosures: {compliancePolicy.disclosuresVersion || CURRENT_POLICY_VERSIONS.disclosures}</div>
              <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.light }}>
                Last policy review: {compliancePolicy.lastPolicyReviewAt ? formatProfileDate(compliancePolicy.lastPolicyReviewAt) : "Not recorded"}
              </div>
            </div>
            <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: 10, marginTop: 8, display: "grid", gap: 6, opacity: canManageComplianceControls ? 1 : 0.65, pointerEvents: canManageComplianceControls ? "auto" : "none" }}>
              <div style={{ fontFamily: S.font, fontSize: 12, fontWeight: 700, color: S.dark }}>Outlier Flags (US-51 Baseline)</div>
              <div style={{ fontFamily: S.font, fontSize: 11.5, color: complianceOutlierFlags.privacyOutlier ? S.red : S.muted }}>
                Privacy outlier: {complianceOutlierFlags.privacyOutlier ? "Yes" : "No"}
              </div>
              <div style={{ fontFamily: S.font, fontSize: 11.5, color: complianceOutlierFlags.territoryOutlier ? S.red : S.muted }}>
                Territory outlier (PR/GU/VI): {complianceOutlierFlags.territoryOutlier ? "Yes" : "No"}
              </div>
              <div style={{ fontFamily: S.font, fontSize: 11.5, color: complianceOutlierFlags.marketingOutlier ? S.red : S.muted }}>
                Marketing consent outlier: {complianceOutlierFlags.marketingOutlier ? "Yes" : "No"}
              </div>
              <div style={{ fontFamily: S.font, fontSize: 11.5, color: complianceOutlierFlags.fairHousingOutlier ? S.red : S.muted }}>
                Fair-housing outlier: {complianceOutlierFlags.fairHousingOutlier ? "Yes" : "No"}
              </div>
              <div style={{ fontFamily: S.font, fontSize: 11.5, color: complianceOutlierFlags.recordingOutlier ? S.red : S.muted }}>
                Recording outlier: {complianceOutlierFlags.recordingOutlier ? "Yes" : "No"}
              </div>
              <div style={{ fontFamily: S.font, fontSize: 11.5, color: complianceOutlierFlags.counselReviewRequired ? S.red : S.muted }}>
                Counsel review required: {complianceOutlierFlags.counselReviewRequired ? "Yes" : "No"}
              </div>
            </div>
            <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: 10, marginTop: 8, display: "grid", gap: 8, opacity: canManageComplianceControls ? 1 : 0.65, pointerEvents: canManageComplianceControls ? "auto" : "none" }}>
              <div style={{ fontFamily: S.font, fontSize: 12, fontWeight: 700, color: S.dark }}>Support Packet Snapshot</div>
              <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.muted }}>
                Status: {complianceSupportPacket.ready ? "Ready" : "Not generated"} · Version: {complianceSupportPacket.packetVersion || "us51-baseline-2026-04-11"}
              </div>
              <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.light }}>
                Generated: {complianceSupportPacket.generatedAt ? formatProfileDate(complianceSupportPacket.generatedAt) : "Not recorded"} · {complianceSupportPacket.generatedBy || "No operator"}
              </div>
              <button
                onClick={() => {
                  const nowIso = new Date().toISOString();
                  const summary = `Jurisdiction ${complianceJurisdiction.state || "NC"} / ${complianceJurisdiction.county || "Wake"} / ${complianceJurisdiction.city || "Raleigh"} with strict_us_51 baseline, outlier review ${complianceOutlierFlags.counselReviewRequired ? "required" : "not required"}.`;
                  updateCompliance({
                    supportPacket: {
                      ready: true,
                      generatedAt: nowIso,
                      generatedBy: user.email || "",
                      packetVersion: "us51-baseline-2026-04-11",
                      jurisdictionSummary: summary,
                      notes: complianceSupportPacket.notes || "Generated from profile compliance controls for support and legal audit requests.",
                    },
                    regulatoryProfile: {
                      ...complianceRegulatoryProfile,
                      baselineProfile: "strict_us_51",
                      outlierReviewRequired: !!complianceOutlierFlags.counselReviewRequired,
                      outlierLastReviewedAt: nowIso,
                    },
                  });
                }}
                style={{ ...S.btn(S.surfaceAlt, S.dark), border: `1px solid ${S.border}` }}
              >
                Generate Support Packet Snapshot
              </button>
            </div>
            <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: 10, marginTop: 8 }}>
              <div style={{ fontFamily: S.font, fontSize: 12, fontWeight: 700, color: S.dark, marginBottom: 6 }}>Recent Compliance Audit Events</div>
              {complianceAuditTrail.slice(0, 5).map((entry) => (
                <div key={entry.id} style={{ fontFamily: S.font, fontSize: 11.5, color: S.muted, lineHeight: 1.5, padding: "6px 0", borderBottom: `1px dashed ${S.border}` }}>
                  <strong style={{ color: S.dark }}>{entry.field || "profile"}</strong> · {entry.summary || "update"}<br />
                  {entry.at ? formatProfileDate(entry.at) : "Timestamp pending"} · {entry.actorEmail || "authenticated user"}
                </div>
              ))}
              {complianceAuditTrail.length === 0 && (
                <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.light }}>
                  No compliance audit events recorded yet.
                </div>
              )}
            </div>
          </Card>
          <Card>
            <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: S.light, marginBottom: 8, fontWeight: 700 }}>
              Verified Profile
            </div>
            <div style={{ padding: 14, borderRadius: 14, border: `1px solid ${trustedProfileVisible ? S.green : S.border}`, background: trustedProfileVisible ? S.greenBg : S.surfaceAlt, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 14, color: S.dark }}>
                  🟢 Verified Profile Badge
                </div>
                <Badge variant={trustedProfileVisible ? "verified" : trustedProfileActive ? "type" : "warn"}>
                  {trustedProfileVisible ? "Active" : trustedProfileActive ? "Paused" : "Inactive"}
                </Badge>
              </div>
              <div style={{ fontFamily: S.font, fontSize: 12, color: S.muted, lineHeight: 1.6, marginBottom: 8 }}>
                Subscribe for {fmt(Math.round(trustedProfilePriceCents / 100))}/month and show a green trusted-user icon on your public profile surfaces.
              </div>
              <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.light }}>
                {trustedProfileVisible && trustedProfileSince
                  ? `Active since ${formatProfileDate(trustedProfileSince)}`
                  : trustedProfileActive
                    ? "Subscription is paused until your profile, legal, and verification requirements are complete."
                    : "Activate to display your green trust icon to other users."}
              </div>
            </div>
            {!trustedProfileEligible && (
              <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 12, border: `1px solid ${S.red}`, background: S.redBg, fontFamily: S.font, fontSize: 12, color: S.red, lineHeight: 1.6 }}>
                Complete profile information before enabling Verified User. Core profile fields and required verification must be complete.
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={S.label}>Billing Provider</label>
                <select
                  value={verifiedBilling.provider || "stripe_connect"}
                  onChange={(e) => updateVerifiedBilling({ provider: e.target.value })}
                  style={{ ...S.input, cursor: "pointer" }}
                >
                  {PAYOUT_PROVIDER_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={S.label}>Billing Interval</label>
                <select
                  value={verifiedBilling.interval || "monthly"}
                  onChange={(e) => updateVerifiedBilling({ interval: e.target.value })}
                  style={{ ...S.input, cursor: "pointer" }}
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {[
                { key: "paymentMethodSaved", label: "Payment method saved" },
                { key: "fraudReviewClear", label: "Fraud review clear" },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => updateVerifiedBilling({
                    compliance: {
                      ...verifiedBillingCompliance,
                      [item.key]: !verifiedBillingCompliance[item.key],
                      profileEligible: trustedProfileEligible,
                      legalReady: legalCompletedCount >= requiredLegalComponents.length,
                      lastCheckedAt: new Date().toISOString(),
                    },
                  })}
                  style={{
                    ...S.btn(verifiedBillingCompliance[item.key] ? S.greenBg : S.surfaceAlt, verifiedBillingCompliance[item.key] ? S.green : S.muted),
                    border: `1px solid ${verifiedBillingCompliance[item.key] ? `${S.green}44` : S.border}`,
                    fontSize: 12,
                  }}
                >
                  {verifiedBillingCompliance[item.key] ? "✓" : "○"} {item.label}
                </button>
              ))}
            </div>
            <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 12, background: verifiedBillingReady ? S.greenBg : S.redBg, color: verifiedBillingReady ? S.green : S.red, fontFamily: S.font, fontSize: 12 }}>
              Billing readiness: {verifiedBillingReadyCount}/{verifiedBillingChecks.length} checks complete.
            </div>
            <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, border: `1px solid ${S.border}`, background: S.surfaceAlt }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ fontFamily: S.font, fontSize: 12, fontWeight: 800, color: S.dark, marginBottom: 4 }}>Referral Incentive</div>
                  <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.muted, lineHeight: 1.55 }}>
                    Refer a friend and earn 1 free month of Verified User after the referral is verified, up to 12 total.
                  </div>
                </div>
                <Badge variant={referralCapReached ? "warn" : "verified"}>{referralIncentive.earnedFreeMonths}/{referralIncentive.maxFreeMonths} earned</Badge>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8, marginBottom: 10 }}>
                <div style={{ padding: 10, borderRadius: 10, background: S.surface, border: `1px solid ${S.border}` }}>
                  <div style={{ fontFamily: S.font, fontSize: 10.5, color: S.light, textTransform: "uppercase", letterSpacing: 0.8 }}>Available</div>
                  <div style={{ fontFamily: S.serif, fontSize: 22, color: S.dark }}>{referralIncentive.availableFreeMonths}</div>
                </div>
                <div style={{ padding: 10, borderRadius: 10, background: S.surface, border: `1px solid ${S.border}` }}>
                  <div style={{ fontFamily: S.font, fontSize: 10.5, color: S.light, textTransform: "uppercase", letterSpacing: 0.8 }}>Applied</div>
                  <div style={{ fontFamily: S.serif, fontSize: 22, color: S.dark }}>{referralIncentive.appliedFreeMonths}</div>
                </div>
                <div style={{ padding: 10, borderRadius: 10, background: S.surface, border: `1px solid ${S.border}` }}>
                  <div style={{ fontFamily: S.font, fontSize: 10.5, color: S.light, textTransform: "uppercase", letterSpacing: 0.8 }}>Referral Code</div>
                  <div style={{ fontFamily: S.font, fontSize: 13, fontWeight: 800, color: S.dark, marginTop: 4, wordBreak: "break-word" }}>{referralIncentive.referralCode}</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8, marginBottom: 8 }}>
                <input
                  value={referralFriendName}
                  onChange={(e) => setReferralFriendName(e.target.value)}
                  placeholder="Friend name"
                  style={S.input}
                />
                <input
                  value={referralFriendEmail}
                  onChange={(e) => setReferralFriendEmail(e.target.value)}
                  placeholder="friend@email.com"
                  style={S.input}
                />
              </div>
              {referralEmailAlreadyCredited && (
                <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.red, marginBottom: 8 }}>This email already has a referral credit.</div>
              )}
              {referralCapReached && (
                <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.muted, marginBottom: 8 }}>The 12 month referral maximum has been reached.</div>
              )}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: referralIncentive.credits.length ? 10 : 0 }}>
                <button
                  onClick={recordReferralCredit}
                  disabled={!canRecordReferralCredit}
                  style={{ ...S.btn(canRecordReferralCredit ? S.gold : S.surface, canRecordReferralCredit ? S.dark : S.light), border: `1px solid ${canRecordReferralCredit ? S.gold : S.border}`, opacity: canRecordReferralCredit ? 1 : 0.65, cursor: canRecordReferralCredit ? "pointer" : "not-allowed" }}
                >
                  Record Verified Referral
                </button>
                <button
                  onClick={applyReferralFreeMonth}
                  disabled={referralIncentive.availableFreeMonths <= 0}
                  style={{ ...S.btn(referralIncentive.availableFreeMonths > 0 ? S.greenBg : S.surface, referralIncentive.availableFreeMonths > 0 ? S.green : S.light), border: `1px solid ${referralIncentive.availableFreeMonths > 0 ? `${S.green}44` : S.border}`, opacity: referralIncentive.availableFreeMonths > 0 ? 1 : 0.65, cursor: referralIncentive.availableFreeMonths > 0 ? "pointer" : "not-allowed" }}
                >
                  Apply 1 Free Month
                </button>
              </div>
              {referralIncentive.credits.length > 0 && (
                <div style={{ display: "grid", gap: 6 }}>
                  {referralIncentive.credits.slice(0, 4).map((credit) => (
                    <div key={credit.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 0", borderTop: `1px solid ${S.border}`, fontFamily: S.font, fontSize: 11.5, color: S.muted }}>
                      <span><strong style={{ color: S.dark }}>{credit.friendName || credit.friendEmail}</strong>{credit.friendName ? ` (${credit.friendEmail})` : ""}</span>
                      <span>{credit.creditedAt ? formatProfileDate(credit.creditedAt) : credit.status || "pending"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={() => {
                  if (verifiedBilling.customerId || trustedProfileActive) {
                    openVerifiedBillingPortal();
                    return;
                  }
                  if (!trustedProfileEligible || !verifiedBillingReady) return;
                  launchVerifiedProfileCheckout();
                }}
                disabled={billingActionBusy === "verified-checkout" || billingActionBusy === "billing-portal" || (!verifiedBilling.customerId && !trustedProfileActive && (!trustedProfileEligible || !verifiedBillingReady))}
                style={{ ...S.btn((verifiedBilling.customerId || trustedProfileActive) ? S.surfaceAlt : S.green, (verifiedBilling.customerId || trustedProfileActive) ? S.dark : S.greenBg), border: (verifiedBilling.customerId || trustedProfileActive) ? `1px solid ${S.border}` : "none", opacity: billingActionBusy === "verified-checkout" || billingActionBusy === "billing-portal" || (!verifiedBilling.customerId && !trustedProfileActive && (!trustedProfileEligible || !verifiedBillingReady)) ? 0.6 : 1, cursor: billingActionBusy === "verified-checkout" || billingActionBusy === "billing-portal" || (!verifiedBilling.customerId && !trustedProfileActive && (!trustedProfileEligible || !verifiedBillingReady)) ? "not-allowed" : "pointer" }}
              >
                {billingActionBusy === "verified-checkout"
                  ? "Opening Checkout…"
                  : billingActionBusy === "billing-portal"
                    ? ((verifiedBilling.provider || "stripe_connect") === "square" ? "Refreshing Billing…" : "Opening Billing…")
                    : verifiedBilling.customerId || trustedProfileActive
                      ? ((verifiedBilling.provider || "stripe_connect") === "square" ? "Refresh Verified Billing" : "Manage Verified Billing")
                      : trustedProfileEligible && verifiedBillingReady
                        ? ((verifiedBilling.provider || "stripe_connect") === "square" ? "Start Square Billing • $20/mo" : "Subscribe • $20/mo")
                        : "Complete Setup To Unlock"}
              </button>
              {(verifiedBilling.provider || "stripe_connect") === "square" && verifiedBilling.subscriptionId && (
                <button
                  onClick={cancelSquareVerifiedSubscription}
                  disabled={billingActionBusy === "square-cancel"}
                  style={{ ...S.btn(S.surfaceAlt, S.dark), border: `1px solid ${S.border}`, opacity: billingActionBusy === "square-cancel" ? 0.6 : 1, cursor: billingActionBusy === "square-cancel" ? "not-allowed" : "pointer" }}
                >
                  {billingActionBusy === "square-cancel" ? "Canceling…" : "Cancel Square Billing"}
                </button>
              )}
              <button
                onClick={() => updateTrust({ verifiedProfileVisibility: !trust.verifiedProfileVisibility })}
                style={{ ...S.btn("transparent", S.dark), border: `1px solid ${S.border}` }}
              >
                {trust.verifiedProfileVisibility === false ? "Badge Hidden" : "Badge Visible"}
              </button>
            </div>
            {billingActionError && (
              <div style={{ marginTop: 10, fontFamily: S.font, fontSize: 11.5, color: S.red, lineHeight: 1.5 }}>
                {billingActionError}
              </div>
            )}
            <div style={{ marginTop: 10, fontFamily: S.font, fontSize: 11, color: S.light, lineHeight: 1.55, display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span>Verified billing status: <strong style={{ color: S.dark }}>{verifiedBilling.status || "setup"}</strong></span>
              <span>Next charge: <strong style={{ color: S.dark }}>{verifiedBilling.nextChargeAt ? formatProfileDate(verifiedBilling.nextChargeAt) : "Not scheduled"}</strong></span>
            </div>
            <div style={{ marginTop: 8, fontFamily: S.font, fontSize: 11.5, color: S.light, lineHeight: 1.55 }}>
              {(verifiedBilling.provider || "stripe_connect") === "square"
                ? "Square mode starts a recurring subscription from EstateHat and syncs status back into the profile. Card-on-file automation can be added after the core subscription flow is live."
                : "Live billing now routes through Stripe Checkout and the Stripe customer portal instead of local-only status toggles."}
            </div>
          </Card>
          <Card>
            <label style={S.label}>Full Legal Name</label>
            <input value={user.name} onChange={(e) => setUser({ ...user, name: e.target.value })} style={S.input} />
            <label style={S.label}>Email</label>
            <input value={user.email} onChange={(e) => setUser({ ...user, email: e.target.value })} style={S.input} />
            <label style={S.label}>Phone</label>
            <input value={user.phone} onChange={(e) => setUser({ ...user, phone: e.target.value })} style={S.input} />
          </Card>
          <Card>
            <label style={S.label}>Account Type</label>
            {LOCKED_ROLES.includes(user.accountType) ? (
              <div style={{ ...S.input, display: "flex", alignItems: "center", gap: 8, cursor: "default", opacity: 0.8 }}>
                <span>🔒</span>
                <span>{ACCOUNT_TYPES.find(t => t.key === user.accountType)?.icon} {ACCOUNT_TYPES.find(t => t.key === user.accountType)?.label}</span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: S.light }}>Role locked</span>
              </div>
            ) : (
              <select
                value={user.accountType}
                onChange={(e) => {
                  if (!isRoleBlocked(user.accountType, e.target.value)) {
                    setUser({ ...user, accountType: e.target.value });
                  }
                }}
                style={{ ...S.input, cursor: "pointer" }}
              >
                {ACCOUNT_TYPES.map((t) => {
                  const blocked = isRoleBlocked(user.accountType, t.key);
                  return <option key={t.key} value={t.key} disabled={blocked}>{t.icon} {t.label}{blocked ? " 🚫 (Conflict)" : ""}</option>;
                })}
              </select>
            )}
            <div style={{ marginTop: 12, padding: 14, background: S.surface, borderRadius: 12, fontFamily: S.font, fontSize: 13, color: S.muted, lineHeight: 1.5 }}>
              {ACCOUNT_TYPES.find((t) => t.key === user.accountType)?.desc}
            </div>
            <div style={{ marginTop: 12, padding: 14, background: S.surfaceAlt, borderRadius: 12 }}>
              <div style={{ fontFamily: S.font, fontSize: 12, fontWeight: 700, color: S.dark, marginBottom: 8 }}>Role access in this profile</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {accountBlueprint.operationalAccess.map((item) => (
                  <Badge key={item} variant="type">{item}</Badge>
                ))}
              </div>
            </div>

            {/* Role Conflict Notice */}
            {(ROLE_CONFLICTS[user.accountType] || []).length > 0 && (
              <div style={{ marginTop: 12, border: `1px solid ${S.border}`, borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "10px 14px", background: S.surfaceAlt, fontFamily: S.font, fontSize: 12, fontWeight: 700, color: S.dark }}>
                  🚫 Role Restrictions — Conflict of Interest Prevention
                </div>
                <div style={{ padding: "10px 14px" }}>
                  <div style={{ fontFamily: S.font, fontSize: 12, color: S.light, marginBottom: 8 }}>
                    As a <strong style={{ color: S.dark }}>{ACCOUNT_TYPES.find((t) => t.key === user.accountType)?.label}</strong>, you cannot hold these roles:
                  </div>
                  {(ROLE_CONFLICTS[user.accountType] || []).map((blockedRole) => {
                    const blockedAcct = ACCOUNT_TYPES.find((t) => t.key === blockedRole);
                    return (
                      <div key={blockedRole} style={{ display: "flex", alignItems: "start", gap: 10, padding: "8px 0", borderBottom: `1px solid ${S.surface}` }}>
                        <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{blockedAcct?.icon}</span>
                        <div>
                          <div style={{ fontFamily: S.font, fontSize: 13, fontWeight: 600, color: S.red, textDecoration: "line-through" }}>{blockedAcct?.label}</div>
                          <div style={{ fontFamily: S.font, fontSize: 11, color: S.light, lineHeight: 1.4 }}>{getConflictReason(user.accountType, blockedRole)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <label style={S.label}>Mailing Address</label>
            <input value={user.address || ""} onChange={(e) => setUser({ ...user, address: e.target.value })} placeholder="123 Main St, Raleigh, NC 27601" style={S.input} />
            <AddressVerifier address={user.address} onVerified={() => {}} />
          </Card>

          {/* Save Profile */}
          {onSaveProfile && (
            <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 14, marginTop: 4 }}>
              <button
                onClick={async () => {
                  setSaveStatus("saving");
                  try {
                    await onSaveProfile(user);
                    setSaveStatus("saved");
                    setTimeout(() => setSaveStatus(null), 3000);
                  } catch {
                    setSaveStatus("error");
                    setTimeout(() => setSaveStatus(null), 3000);
                  }
                }}
                disabled={saveStatus === "saving"}
                style={{ ...S.btn(S.gold, S.dark), opacity: saveStatus === "saving" ? 0.7 : 1, cursor: saveStatus === "saving" ? "not-allowed" : "pointer" }}
              >
                {saveStatus === "saving" ? "Saving…" : "Save Profile"}
              </button>
              {saveStatus === "saved" && <span style={{ fontFamily: S.font, fontSize: 13, color: S.green }}>✓ Profile saved</span>}
              {saveStatus === "error" && <span style={{ fontFamily: S.font, fontSize: 13, color: S.red }}>Failed to save. Try again.</span>}
            </div>
          )}
        </div>
      )}

      {tab === "reputation" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 20 }}>
          <Card style={{ gridColumn: "1 / -1" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: S.light, marginBottom: 8, fontWeight: 800 }}>
                  Profile Reputation Grade
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontFamily: S.serif, fontSize: 54, color: S.dark, lineHeight: 1 }}>{reputation.grade}</div>
                  <GradeBadge grade={reputation.grade} score={reputation.score} size="large" />
                </div>
                <div style={{ fontFamily: S.font, fontSize: 13, color: S.muted, lineHeight: 1.6, marginTop: 8, maxWidth: 620 }}>
                  {reputationMeta.desc} Grades are based on published feedback and can include optional testimonials from completed EstateHat interactions.
                </div>
              </div>
              <div style={{ minWidth: 190, padding: 14, borderRadius: 12, background: S.surfaceAlt, border: `1px solid ${S.border}` }}>
                <div style={{ fontFamily: S.font, fontSize: 11, color: S.light, textTransform: "uppercase", letterSpacing: 1.1 }}>Reputation health</div>
                <div style={{ fontFamily: S.serif, fontSize: 30, color: S.dark, marginTop: 3 }}>{reputation.score}/100</div>
                <div style={{ fontFamily: S.font, fontSize: 12, color: S.muted, marginTop: 4 }}>
                  {reputation.reviewCount} grade records · {reputation.testimonialCount} testimonials
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: S.light, marginBottom: 8, fontWeight: 800 }}>
              Add Grade Feedback
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {REPUTATION_GRADES.map((grade) => (
                <button
                  key={grade}
                  type="button"
                  onClick={() => setReputationDraft((current) => ({ ...current, grade }))}
                  style={{
                    ...S.btn(reputationDraft.grade === grade ? S.dark : S.surfaceAlt, reputationDraft.grade === grade ? S.card : S.dark),
                    border: `1px solid ${reputationDraft.grade === grade ? S.dark : S.border}`,
                    padding: "8px 11px",
                  }}
                >
                  {grade}
                </button>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={S.label}>Feedback From</label>
                <input
                  value={reputationDraft.authorName}
                  onChange={(e) => setReputationDraft((current) => ({ ...current, authorName: e.target.value }))}
                  placeholder="Verified user name"
                  style={S.input}
                />
              </div>
              <div>
                <label style={S.label}>Role</label>
                <select
                  value={reputationDraft.authorRole}
                  onChange={(e) => setReputationDraft((current) => ({ ...current, authorRole: e.target.value }))}
                  style={{ ...S.input, cursor: "pointer" }}
                >
                  {["buyer", "seller", "agent", "inspector", "lender", "attorney", "admin"].map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
            </div>
            <label style={S.label}>Transaction / Listing Reference</label>
            <input
              value={reputationDraft.transactionRef}
              onChange={(e) => setReputationDraft((current) => ({ ...current, transactionRef: e.target.value }))}
              placeholder="TXN-04756, listing address, or service request"
              style={S.input}
            />
            <label style={S.label}>Optional Feedback / Testimonial</label>
            <textarea
              rows={5}
              value={reputationDraft.testimonial}
              onChange={(e) => setReputationDraft((current) => ({ ...current, testimonial: e.target.value }))}
              placeholder="Add a short testimonial or leave blank for grade-only feedback."
              style={{ ...S.input, resize: "vertical" }}
            />
            <button onClick={addReputationFeedback} style={{ ...S.btn(S.gold, S.dark), marginTop: 12 }}>
              Add Reputation Record
            </button>
            <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: S.goldBg, fontFamily: S.font, fontSize: 12, color: S.goldDeep, lineHeight: 1.55 }}>
              Best practice: only add ratings tied to completed transactions, verified service work, or documented support outcomes.
            </div>
          </Card>

          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: S.light, fontWeight: 800 }}>
                Grade Scale
              </div>
              <button
                type="button"
                onClick={() => updateReputation({ visibility: !reputation.visibility })}
                style={{ ...S.btn(reputation.visibility ? S.greenBg : S.surfaceAlt, reputation.visibility ? S.green : S.muted), border: `1px solid ${S.border}`, padding: "7px 10px" }}
              >
                {reputation.visibility ? "Visible" : "Hidden"}
              </button>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {REPUTATION_GRADES.map((grade) => (
                <div key={grade} style={{ display: "grid", gridTemplateColumns: "74px 1fr", gap: 10, alignItems: "center", padding: "8px 0", borderTop: `1px solid ${S.border}` }}>
                  <GradeBadge grade={grade} score={REPUTATION_GRADE_META[grade].score} />
                  <div>
                    <div style={{ fontFamily: S.font, fontSize: 12, fontWeight: 800, color: S.dark }}>{REPUTATION_GRADE_META[grade].label}</div>
                    <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.muted, lineHeight: 1.45 }}>{REPUTATION_GRADE_META[grade].desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card style={{ gridColumn: "1 / -1" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: S.light, fontWeight: 800 }}>
                Feedback And Testimonials
              </div>
              <Badge variant={reputationPublishedFeedback.length ? "verified" : "type"}>
                {reputationPublishedFeedback.length ? `${reputationPublishedFeedback.length} published` : "No published feedback"}
              </Badge>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {reputation.feedback.length === 0 && (
                <div style={{ padding: 16, borderRadius: 12, background: S.surfaceAlt, fontFamily: S.font, fontSize: 13, color: S.muted }}>
                  No reputation feedback has been added yet. This profile starts at Grade B until real transaction feedback is recorded.
                </div>
              )}
              {reputation.feedback.map((entry) => (
                <div key={entry.id} style={{ border: `1px solid ${S.border}`, borderRadius: 12, padding: 12, background: entry.status === "published" ? S.card : S.surfaceAlt }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <GradeBadge grade={entry.grade} score={entry.score} />
                      <span style={{ fontFamily: S.font, fontSize: 12, color: S.dark, fontWeight: 800 }}>{entry.authorName || "Verified EstateHat user"}</span>
                      <Badge variant="role">{entry.authorRole || "user"}</Badge>
                    </div>
                    <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.light }}>
                      {entry.createdAt ? formatProfileDate(entry.createdAt) : "Date pending"}
                    </div>
                  </div>
                  {entry.transactionRef && (
                    <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.light, marginBottom: 6 }}>Reference: {entry.transactionRef}</div>
                  )}
                  {entry.testimonial ? (
                    <div style={{ fontFamily: S.font, fontSize: 13, color: S.muted, lineHeight: 1.6 }}>{entry.testimonial}</div>
                  ) : (
                    <div style={{ fontFamily: S.font, fontSize: 12, color: S.light }}>Grade-only feedback. No testimonial was supplied.</div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
                    <Badge variant={entry.status === "published" ? "verified" : entry.status === "flagged" ? "warn" : "type"}>{entry.status || "published"}</Badge>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {["published", "hidden", "flagged"].map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => updateReputationFeedbackStatus(entry.id, status)}
                          style={{ ...S.btn((entry.status || "published") === status ? S.dark : S.surfaceAlt, (entry.status || "published") === status ? S.card : S.muted), border: `1px solid ${S.border}`, padding: "6px 9px", fontSize: 11 }}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {onSaveProfile && (
            <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 14 }}>
              <button
                onClick={async () => {
                  setSaveStatus("saving");
                  try {
                    await onSaveProfile(user);
                    setSaveStatus("saved");
                    setTimeout(() => setSaveStatus(null), 3000);
                  } catch {
                    setSaveStatus("error");
                    setTimeout(() => setSaveStatus(null), 3000);
                  }
                }}
                disabled={saveStatus === "saving"}
                style={{ ...S.btn(S.gold, S.dark), opacity: saveStatus === "saving" ? 0.7 : 1, cursor: saveStatus === "saving" ? "not-allowed" : "pointer" }}
              >
                {saveStatus === "saving" ? "Saving…" : "Save Reputation"}
              </button>
              {saveStatus === "saved" && <span style={{ fontFamily: S.font, fontSize: 13, color: S.green }}>✓ Reputation saved</span>}
              {saveStatus === "error" && <span style={{ fontFamily: S.font, fontSize: 13, color: S.red }}>Failed to save. Try again.</span>}
            </div>
          )}
        </div>
      )}

      {tab === "security" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 20 }}>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: 0 }}>Security Center</h3>
              <Badge variant={securityScore >= securityChecks.length - 1 ? "verified" : "warn"}>{securityScore}/{securityChecks.length} checks healthy</Badge>
            </div>
            <ProgressBar value={securityScore} max={securityChecks.length} color={securityScore >= securityChecks.length - 1 ? S.green : S.gold} />
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
              {[
                {
                  key: "twoFactorEnabled",
                  label: "Two-factor authentication",
                  desc: "Require a second factor before sensitive profile and document actions.",
                },
                {
                  key: "loginAlerts",
                  label: "Login alerts",
                  desc: "Notify this account when a new session or unusual login occurs.",
                },
                {
                  key: "trustedDevice",
                  label: "Trusted-device mode",
                  desc: "Mark this device as a higher-trust device for profile and document work.",
                },
                {
                  key: "documentShield",
                  label: "Document shielding",
                  desc: "Keep sensitive document views behind stricter access checks and shorter exposure windows.",
                },
              ].map((item) => (
                <div key={item.key} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: 16, border: `1px solid ${S.border}`, borderRadius: 16, background: S.surfaceAlt }}>
                  <div>
                    <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 13.5, color: S.dark }}>{item.label}</div>
                    <div style={{ fontFamily: S.font, fontSize: 12, color: S.muted, lineHeight: 1.55, marginTop: 4 }}>{item.desc}</div>
                  </div>
                  <button
                    onClick={() => updateSecurity({ [item.key]: !security[item.key] })}
                    style={{
                      ...S.btn(security[item.key] ? S.green : S.surface, security[item.key] ? S.greenBg : S.muted),
                      padding: "9px 14px",
                      fontSize: 12,
                      minWidth: 92,
                      alignSelf: "center",
                    }}
                  >
                    {security[item.key] ? "Enabled" : "Enable"}
                  </button>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 16, padding: 16, borderRadius: 16, background: S.surfaceAlt, border: `1px solid ${S.border}` }}>
              <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 13.5, color: S.dark, marginBottom: 10 }}>Session timeout</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[15, 30, 60, 120].map((minutes) => (
                  <button
                    key={minutes}
                    onClick={() => updateSecurity({ sessionTimeoutMinutes: minutes })}
                    style={{
                      ...S.btn(security.sessionTimeoutMinutes === minutes ? S.gold : S.card, security.sessionTimeoutMinutes === minutes ? S.dark : S.muted),
                      border: `1px solid ${security.sessionTimeoutMinutes === minutes ? S.gold : S.border}`,
                      padding: "9px 14px",
                      fontSize: 12,
                    }}
                  >
                    {minutes} min
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 16, padding: 16, borderRadius: 16, background: S.surfaceAlt, border: `1px solid ${S.border}` }}>
              <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 13.5, color: S.dark, marginBottom: 10 }}>Recovery and reauthentication</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ padding: 12, borderRadius: 12, background: S.card, border: `1px solid ${S.border}` }}>
                  <div style={{ fontFamily: S.font, fontSize: 11, color: S.light, textTransform: "uppercase", letterSpacing: 1.1 }}>Recovery contact</div>
                  <div style={{ fontFamily: S.font, fontSize: 13, color: S.dark, fontWeight: 700, marginTop: 6 }}>{user.email || "Email required"}</div>
                  <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.muted, marginTop: 4 }}>Used for sign-in recovery and security notices.</div>
                </div>
                <div style={{ padding: 12, borderRadius: 12, background: S.card, border: `1px solid ${S.border}` }}>
                  <div style={{ fontFamily: S.font, fontSize: 11, color: S.light, textTransform: "uppercase", letterSpacing: 1.1 }}>High-risk actions</div>
                  <div style={{ fontFamily: S.font, fontSize: 13, color: S.dark, fontWeight: 700, marginTop: 6 }}>{security.twoFactorEnabled ? "MFA or reauth ready" : "Reauth recommended"}</div>
                  <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.muted, marginTop: 4 }}>Use stronger checks before document and payout changes.</div>
                </div>
              </div>
            </div>
          </Card>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <Card>
              <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: S.light, marginBottom: 8, fontWeight: 700 }}>
                Account Health
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {securityChecks.map((item) => (
                  <div key={item.label} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", paddingBottom: 10, borderBottom: `1px solid ${S.surface}` }}>
                    <div>
                      <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 12.5, color: S.dark }}>{item.label}</div>
                      <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.muted, marginTop: 3 }}>{item.detail}</div>
                    </div>
                    <Badge variant={item.ok ? "verified" : "warn"}>{item.ok ? "Healthy" : "Needs attention"}</Badge>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: S.light, marginBottom: 8, fontWeight: 700 }}>
                Security Priorities For This Role
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {accountBlueprint.securityFocus.map((item) => (
                  <div key={item} style={{ display: "flex", gap: 10 }}>
                    <span style={{ color: S.blue, fontSize: 15, marginTop: 1 }}>•</span>
                    <div style={{ fontFamily: S.font, fontSize: 12.5, color: S.muted, lineHeight: 1.55 }}>{item}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: S.light, marginBottom: 8, fontWeight: 700 }}>
                Trusted Devices
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {trustedDevices.map((device) => (
                  <div key={device.name} style={{ padding: 12, borderRadius: 14, background: S.surfaceAlt, border: `1px solid ${S.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div>
                        <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 12.5, color: S.dark }}>{device.name}</div>
                        <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.muted, marginTop: 3 }}>{device.detail}</div>
                      </div>
                      <Badge variant={device.status === "Trusted" || device.status === "Protected" ? "verified" : "warn"}>{device.status}</Badge>
                    </div>
                    <div style={{ fontFamily: S.font, fontSize: 11, color: S.light, marginTop: 6 }}>Last seen: {device.lastSeen}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: S.light, marginBottom: 8, fontWeight: 700 }}>
                Recent Security Activity
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {securityEvents.map((event) => (
                  <div key={event.time + event.label} style={{ display: "flex", justifyContent: "space-between", gap: 10, paddingBottom: 10, borderBottom: `1px solid ${S.surface}` }}>
                    <div>
                      <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 12.5, color: S.dark }}>{event.label}</div>
                      <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.muted, marginTop: 3 }}>{event.time}</div>
                    </div>
                    <Badge variant={event.outcome === "success" ? "verified" : "warn"}>{event.outcome}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === "verification" && (
        <div>
          <Card style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: 0 }}>{isCorp ? "Entity Verification" : "Identity Verification"}</h3>
              <Badge variant={verCount >= reqSteps.length ? "verified" : "warn"}>{verCount}/{reqSteps.length} Complete</Badge>
            </div>
            <ProgressBar value={verCount} max={reqSteps.length} color={verCount >= reqSteps.length ? S.green : S.gold} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 14 }}>
              <div style={{ padding: 12, borderRadius: 14, background: S.surfaceAlt }}>
                <div style={{ fontFamily: S.font, fontSize: 11, color: S.light, textTransform: "uppercase", letterSpacing: 1.1 }}>Review status</div>
                <div style={{ fontFamily: S.font, fontSize: 13, fontWeight: 700, color: S.dark, marginTop: 6 }}>{verificationReview.status || "in_progress"}</div>
              </div>
              <div style={{ padding: 12, borderRadius: 14, background: S.surfaceAlt }}>
                <div style={{ fontFamily: S.font, fontSize: 11, color: S.light, textTransform: "uppercase", letterSpacing: 1.1 }}>Queue</div>
                <div style={{ fontFamily: S.font, fontSize: 13, fontWeight: 700, color: S.dark, marginTop: 6 }}>{verificationReview.queueLabel || "Standard review queue"}</div>
              </div>
              <div style={{ padding: 12, borderRadius: 14, background: S.surfaceAlt }}>
                <div style={{ fontFamily: S.font, fontSize: 11, color: S.light, textTransform: "uppercase", letterSpacing: 1.1 }}>Last submission</div>
                <div style={{ fontFamily: S.font, fontSize: 13, fontWeight: 700, color: S.dark, marginTop: 6 }}>{formatProfileDate(verificationReview.lastSubmittedAt)}</div>
              </div>
            </div>
            {verCount < reqSteps.length && (
              <div style={{ marginTop: 10, padding: "10px 14px", background: S.redBg, borderRadius: 10, fontFamily: S.font, fontSize: 12, color: S.red, lineHeight: 1.5 }}>
                ⚠️ <strong>Account Restricted:</strong> You must complete all verification steps to make transactions, submit offers, or list properties.
              </div>
            )}
            <div style={{ marginTop: 10, padding: "10px 14px", background: S.surfaceAlt, borderRadius: 10, fontFamily: S.font, fontSize: 12, color: S.muted, lineHeight: 1.55 }}>
              {verificationReview.notes || "Complete your required items to move from profile setup into live transaction use."}
            </div>
          </Card>

          {/* Citizenship / Residency Status Card — Buyer, Seller, Corp */}
          {(isBuyerOrSeller || isCorp) && (
            <Card style={{ marginBottom: 16, borderLeft: `4px solid ${citizenshipVerified ? S.green : S.red}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: 0 }}>🇺🇸 U.S. Citizenship / Residency Status</h3>
                <Badge variant={citizenInfo?.badge || "warn"}>{citizenInfo?.icon} {citizenInfo?.label}</Badge>
              </div>
              <p style={{ fontFamily: S.font, fontSize: 12, color: S.light, lineHeight: 1.5, margin: "0 0 12px" }}>
                {citizenInfo?.desc}
              </p>
              {!citizenshipVerified && (
                <div style={{ padding: "12px 16px", background: S.redBg, borderRadius: 10, fontFamily: S.font, fontSize: 13, color: S.red, lineHeight: 1.6, marginBottom: 12 }}>
                  ⛔ <strong>TRANSACTION BLOCKED:</strong> U.S. citizenship or permanent residency must be verified before any real estate transaction can proceed. This protects all parties from overseas fraud schemes.
                </div>
              )}
              {citizenshipVerified && (
                <div style={{ padding: "12px 16px", background: S.greenBg, borderRadius: 10, fontFamily: S.font, fontSize: 13, color: S.green, lineHeight: 1.6 }}>
                  ✅ <strong>Citizenship verified.</strong> You are cleared to participate in all transactions on EstateHat. This status is displayed to other parties for transparency.
                </div>
              )}
              {!citizenshipVerified && citizenshipStatus !== "pending" && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontFamily: S.font, fontSize: 12, fontWeight: 700, color: S.dark, marginBottom: 8 }}>Select your status and upload proof:</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {[
                      { key: "citizen", label: "U.S. Citizen", docs: "Passport, birth certificate, or naturalization certificate" },
                      { key: "permanent_resident", label: "Permanent Resident", docs: "Green card (Form I-551)" },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => setSelectedCitizenshipPath(opt.key)}
                        style={{
                          ...S.btn(selectedCitizenshipPath === opt.key ? S.gold : S.surfaceAlt, selectedCitizenshipPath === opt.key ? S.dark : S.muted),
                          padding: "8px 16px",
                          fontSize: 12,
                          border: `1px solid ${selectedCitizenshipPath === opt.key ? S.gold : S.border}`,
                        }}
                      >
                        {selectedCitizenshipPath === opt.key ? "Selected:" : "Choose:"} {opt.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <FileUploadZone
                      label="Upload Citizenship / Residency Proof"
                      accept="PDF, JPG, PNG — Passport, birth certificate, naturalization document, or green card"
                      onUpload={(files) => {
                        const citizenshipStepKey = isCorp ? "signer_citizenship" : "citizenship";
                        setCitizenshipStatus(selectedCitizenshipPath);
                        uploadVerificationEvidence(
                          citizenshipStepKey,
                          files,
                          `${selectedCitizenshipPath === "permanent_resident" ? "Permanent resident" : "U.S. citizen"} evidence uploaded for review.`
                        );
                      }}
                      files={verificationDocs[isCorp ? "signer_citizenship" : "citizenship"] || []}
                    />
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Homeowner Status Card — Buyer & Seller only */}
          {isBuyerOrSeller && (
            <Card style={{ marginBottom: 16, borderLeft: `4px solid ${homeownerVerified ? S.green : "#C9C0B4"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: 0 }}>🏡 Homeowner Verification</h3>
                <Badge variant={homeownerVerified ? "verified" : "default"}>{homeownerVerified ? "✓ Verified Homeowner" : "Optional"}</Badge>
              </div>
              <p style={{ fontFamily: S.font, fontSize: 12, color: S.light, lineHeight: 1.5, margin: "0 0 10px" }}>
                Proving current or prior homeownership builds trust with other parties. Verified homeowners receive a badge visible on their profile and listings.
              </p>
              <div style={{ fontFamily: S.font, fontSize: 12, color: S.muted, lineHeight: 1.5, marginBottom: 10 }}>
                Accepted documents: property deed, mortgage statement, county tax record, or closing disclosure from a prior purchase.
              </div>
              {homeownerVerified ? (
                <div style={{ padding: "10px 14px", background: S.greenBg, borderRadius: 10, fontFamily: S.font, fontSize: 12, color: S.green }}>
                  ✅ Homeownership verified via uploaded documentation. Badge is visible to other parties.
                </div>
              ) : (
                <FileUploadZone
                  label="Upload Homeownership Proof"
                  accept="PDF, JPG, PNG — Deed, mortgage statement, county tax record, or prior closing disclosure"
                  onUpload={(files) => uploadVerificationEvidence("homeowner", files, "Homeownership evidence uploaded for reviewer validation.")}
                  files={verificationDocs.homeowner || []}
                />
              )}
            </Card>
          )}

          {listedVerificationSteps.map((step) => {
            const isRequired = step.required;
            const isDone = activeVerStatus[step.key];
            const uploadedForStep = verificationDocs[step.key] || [];
            return (
              <Card key={step.key} style={{ marginBottom: 12, padding: 18, borderLeft: `4px solid ${isDone ? S.green : isRequired ? S.gold : "#D9D2C7"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 24 }}>{step.icon}</span>
                    <div>
                      <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 14, color: S.dark }}>
                        {step.label} {isRequired && <span style={{ color: S.red, fontSize: 11 }}>REQUIRED</span>}
                      </div>
                      <div style={{ fontFamily: S.font, fontSize: 12, color: S.light }}>{step.desc}</div>
                      <div style={{ fontFamily: S.font, fontSize: 11, color: S.muted, marginTop: 4 }}>
                        Uploaded evidence: {uploadedForStep.length}
                      </div>
                    </div>
                  </div>
                  {isDone ? (
                    <Badge variant="verified">✓ Complete</Badge>
                  ) : (
                    <Badge variant="warn">Upload Required</Badge>
                  )}
                </div>
                {!isDone && (
                  <div style={{ marginTop: 12 }}>
                    {step.key.includes("background") ? (
                      <button
                        onClick={() => applyVerificationStep(step.key, true, { queueLabel: `${step.label} consent submitted`, notes: `${step.label} consent recorded for compliance review.` })}
                        style={S.btn(S.gold, S.dark)}
                      >
                        Consent
                      </button>
                    ) : (
                      <FileUploadZone
                        label="Upload Evidence"
                        accept="PDF, DOCX, JPG, PNG — clear and readable files required"
                        onUpload={(files) => uploadVerificationEvidence(step.key, files, `${step.label} evidence uploaded for verification review.`)}
                        files={uploadedForStep}
                      />
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {tab === "documents" && (
        <div>
          <Card style={{ marginBottom: 20 }}>
            <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: "0 0 12px" }}>📂 My Documents</h3>
            <FileUploadZone
              label="Upload New Document"
              accept="PDF, DOCX, JPG, PNG — Contracts, disclosures, reports, IDs"
              onUpload={(newFiles) => setDocs([...docs, ...newFiles])}
              files={docs}
            />
          </Card>
          <Card>
            <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: "0 0 4px" }}>📋 Common Forms</h3>
            <p style={{ fontFamily: S.font, fontSize: 13, color: S.light, marginBottom: 16 }}>Reusable legal and compliance forms ready for your transactions</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {BOILERPLATES.map((bp) => (
                <div key={bp.id} style={{ border: `1px solid ${S.border}`, borderRadius: 12, padding: 16, cursor: "pointer", transition: "border-color 0.2s" }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = S.gold}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = "rgba(180,170,150,0.2)"}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 6 }}>
                    <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 13.5, color: S.dark }}>{bp.name}</div>
                    <Badge>{bp.category}</Badge>
                  </div>
                  <div style={{ fontFamily: S.font, fontSize: 12, color: S.light, lineHeight: 1.5, marginBottom: 8 }}>{bp.desc}</div>
                  <div style={{ fontFamily: S.font, fontSize: 11, color: S.gold, fontWeight: 600 }}>📥 Download Form · {bp.pages} pages</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === "financial" && (
        <div>
          <Card style={{ marginBottom: 20 }}>
            <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: "0 0 4px" }}>💸 Payout Framework</h3>
            <p style={{ fontFamily: S.font, fontSize: 13, color: S.light, marginBottom: 16 }}>
              Stripe Connect-first payout orchestration with fallback provider support and release controls.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={S.label}>Primary Provider</label>
                <select
                  value={payoutFramework.providerPrimary || "stripe_connect"}
                  onChange={(e) => updatePayoutFramework({ providerPrimary: e.target.value })}
                  style={{ ...S.input, cursor: "pointer" }}
                >
                  {PAYOUT_PROVIDER_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={S.label}>Fallback Provider</label>
                <select
                  value={payoutFramework.providerFallback || "none"}
                  onChange={(e) => updatePayoutFramework({ providerFallback: e.target.value })}
                  style={{ ...S.input, cursor: "pointer" }}
                >
                  {PAYOUT_PROVIDER_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={S.label}>Payout Method</label>
                <select
                  value={payoutFramework.payoutMethod || "ach_standard"}
                  onChange={(e) => updatePayoutFramework({ payoutMethod: e.target.value })}
                  style={{ ...S.input, cursor: "pointer" }}
                >
                  {PAYOUT_METHOD_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={S.label}>Payout Schedule</label>
                <select
                  value={payoutFramework.payoutSchedule || "weekly"}
                  onChange={(e) => updatePayoutFramework({ payoutSchedule: e.target.value })}
                  style={{ ...S.input, cursor: "pointer" }}
                >
                  {PAYOUT_SCHEDULE_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={S.label}>Minimum Payout Amount</label>
                <input
                  type="number"
                  min={5}
                  value={Math.round((payoutFramework.minimumPayoutCents || 2500) / 100)}
                  onChange={(e) => updatePayoutFramework({ minimumPayoutCents: Math.max(500, Math.round(Number(e.target.value || 0) * 100)) })}
                  style={S.input}
                />
              </div>
              <div>
                <label style={S.label}>Reserve Rate (%)</label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  step={0.1}
                  value={((payoutFramework.reserveRateBps || 250) / 100).toFixed(1)}
                  onChange={(e) => updatePayoutFramework({ reserveRateBps: Math.max(0, Math.round(Number(e.target.value || 0) * 100)) })}
                  style={S.input}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
              <button
                onClick={() => {
                  if (payoutFramework.status === "active") {
                    updatePayoutFramework({ status: "paused" });
                    return;
                  }
                  if (!payoutReady) return;
                  updatePayoutFramework({
                    status: "active",
                    compliance: {
                      ...payoutCompliance,
                      profileEligible: payoutProfileEligible,
                      lastCheckedAt: new Date().toISOString(),
                    },
                  });
                }}
                disabled={payoutFramework.status !== "active" && !payoutReady}
                style={{
                  ...S.btn(payoutFramework.status === "active" ? S.surfaceAlt : S.green, payoutFramework.status === "active" ? S.dark : S.greenBg),
                  border: payoutFramework.status === "active" ? `1px solid ${S.border}` : "none",
                  opacity: payoutFramework.status !== "active" && !payoutReady ? 0.6 : 1,
                  cursor: payoutFramework.status !== "active" && !payoutReady ? "not-allowed" : "pointer",
                }}
              >
                {payoutFramework.status === "active" ? "Pause Payouts" : "Activate Payouts"}
              </button>
              <button
                onClick={() => updatePayoutFramework({ instantPayoutEnabled: !payoutFramework.instantPayoutEnabled })}
                style={{ ...S.btn("transparent", S.dark), border: `1px solid ${S.border}` }}
              >
                {payoutFramework.instantPayoutEnabled ? "Instant Payouts Enabled" : "Enable Instant Payouts"}
              </button>
              <Badge variant={payoutFramework.status === "active" ? "verified" : payoutReady ? "type" : "warn"}>
                {payoutFramework.status === "active" ? "Payouts Active" : payoutReady ? "Ready To Activate" : "Setup Required"}
              </Badge>
            </div>
            <div style={{ padding: "10px 12px", borderRadius: 12, background: payoutReady ? S.greenBg : S.redBg, color: payoutReady ? S.green : S.red, fontFamily: S.font, fontSize: 12.5 }}>
              Readiness: {payoutReadyCount}/{payoutReadinessChecks.length} checks complete.
            </div>
            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {payoutReadinessChecks.map((item) => (
                <div key={item.label} style={{ padding: "8px 10px", borderRadius: 10, border: `1px solid ${item.ok ? `${S.green}44` : `${S.border}`}`, background: item.ok ? S.greenBg : S.surfaceAlt, fontFamily: S.font, fontSize: 11.5, color: item.ok ? S.green : S.muted }}>
                  {item.ok ? "✓" : "○"} {item.label}
                </div>
              ))}
            </div>
          </Card>

          <Card style={{ marginBottom: 20 }}>
            <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: "0 0 4px" }}>🔐 Payout Compliance</h3>
            <p style={{ fontFamily: S.font, fontSize: 13, color: S.light, marginBottom: 14 }}>
              These controls gate disbursement access and help block scam accounts.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[
                { key: "kycComplete", label: "KYC complete" },
                { key: "tosAccepted", label: "Terms accepted" },
                { key: "bankAccountLinked", label: "Bank account linked" },
                { key: "riskReviewComplete", label: "Risk review complete" },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => updatePayoutFramework({
                    compliance: {
                      ...payoutCompliance,
                      [item.key]: !payoutCompliance[item.key],
                      profileEligible: payoutProfileEligible,
                      lastCheckedAt: new Date().toISOString(),
                    },
                  })}
                  style={{
                    ...S.btn(payoutCompliance[item.key] ? S.greenBg : S.surfaceAlt, payoutCompliance[item.key] ? S.green : S.muted),
                    border: `1px solid ${payoutCompliance[item.key] ? `${S.green}44` : S.border}`,
                    fontSize: 12,
                  }}
                >
                  {payoutCompliance[item.key] ? "✓" : "○"} {item.label}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 12, fontFamily: S.font, fontSize: 11.5, color: S.light }}>
              Last compliance check: {payoutCompliance.lastCheckedAt ? formatProfileDate(payoutCompliance.lastCheckedAt) : "Not checked yet"}
            </div>
          </Card>

          <Card style={{ marginBottom: 20 }}>
            <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: "0 0 4px" }}>🧾 Provider Accounts</h3>
            <p style={{ fontFamily: S.font, fontSize: 13, color: S.light, marginBottom: 12 }}>
              Save provider identifiers used by payout orchestration.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={S.label}>Stripe Connect Account ID</label>
                <input
                  value={payoutAccounts.stripeConnectAccountId || ""}
                  onChange={(e) => updatePayoutFramework({ accounts: { ...payoutAccounts, stripeConnectAccountId: e.target.value } })}
                  placeholder="acct_..."
                  style={S.input}
                />
              </div>
              <div>
                <label style={S.label}>Square Merchant ID</label>
                <input
                  value={payoutAccounts.squareMerchantId || ""}
                  onChange={(e) => updatePayoutFramework({ accounts: { ...payoutAccounts, squareMerchantId: e.target.value } })}
                  placeholder="sq0idp-..."
                  style={S.input}
                />
              </div>
              <div>
                <label style={S.label}>PayPal Payouts Email</label>
                <input
                  value={payoutAccounts.paypalPayoutsEmail || ""}
                  onChange={(e) => updatePayoutFramework({ accounts: { ...payoutAccounts, paypalPayoutsEmail: e.target.value } })}
                  placeholder="payouts@estatehat.com"
                  style={S.input}
                />
              </div>
              <div>
                <label style={S.label}>Adyen Account Code</label>
                <input
                  value={payoutAccounts.adyenAccountCode || ""}
                  onChange={(e) => updatePayoutFramework({ accounts: { ...payoutAccounts, adyenAccountCode: e.target.value } })}
                  placeholder="ADYEN-ACCT-..."
                  style={S.input}
                />
              </div>
            </div>
            <label style={{ ...S.label, marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={!!payoutAccounts.stripeOnboardingComplete}
                onChange={(e) => updatePayoutFramework({ accounts: { ...payoutAccounts, stripeOnboardingComplete: e.target.checked } })}
              />
              Stripe onboarding complete
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              <button
                onClick={startStripeConnectOnboarding}
                disabled={billingActionBusy === "connect-onboarding"}
                style={{ ...S.btn(S.green, "#fff"), opacity: billingActionBusy === "connect-onboarding" ? 0.7 : 1, cursor: billingActionBusy === "connect-onboarding" ? "not-allowed" : "pointer" }}
              >
                {billingActionBusy === "connect-onboarding" ? "Opening Stripe Connect…" : "Start Stripe Connect Onboarding"}
              </button>
              <button
                onClick={refreshStripeConnectStatus}
                disabled={billingActionBusy === "connect-refresh" || !payoutAccounts.stripeConnectAccountId}
                style={{ ...S.btn(S.surfaceAlt, S.dark), border: `1px solid ${S.border}`, opacity: billingActionBusy === "connect-refresh" || !payoutAccounts.stripeConnectAccountId ? 0.65 : 1, cursor: billingActionBusy === "connect-refresh" || !payoutAccounts.stripeConnectAccountId ? "not-allowed" : "pointer" }}
              >
                {billingActionBusy === "connect-refresh" ? "Refreshing Stripe Status…" : "Refresh Stripe Status"}
              </button>
            </div>
            <div style={{ marginTop: 10, fontFamily: S.font, fontSize: 11.5, color: S.light, lineHeight: 1.55 }}>
              This opens Stripe-hosted onboarding for the payout account and then refreshes local payout readiness from the connected Stripe account state.
            </div>
          </Card>

          <Card style={{ marginBottom: 20 }}>
            <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: "0 0 4px" }}>💳 Platform Fee Collection</h3>
            <p style={{ fontFamily: S.font, fontSize: 13, color: S.light, marginBottom: 12 }}>
              Use Stripe Checkout for documented one-time platform surcharge or fee collection when the fee is being paid directly instead of being deducted at closing.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={S.label}>Amount (USD)</label>
                <input
                  value={platformFeeDraft.amount}
                  onChange={(e) => setPlatformFeeDraft((current) => ({ ...current, amount: e.target.value }))}
                  placeholder="500.00"
                  style={S.input}
                />
              </div>
              <div>
                <label style={S.label}>Reference</label>
                <input
                  value={platformFeeDraft.reference}
                  onChange={(e) => setPlatformFeeDraft((current) => ({ ...current, reference: e.target.value }))}
                  placeholder="TXN-04756 or closing packet ref"
                  style={S.input}
                />
              </div>
            </div>
            <label style={S.label}>Description</label>
            <textarea
              rows={3}
              value={platformFeeDraft.description}
              onChange={(e) => setPlatformFeeDraft((current) => ({ ...current, description: e.target.value }))}
              placeholder="Document the surcharge or platform fee basis."
              style={{ ...S.input, resize: "vertical" }}
            />
            <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 12, background: S.surfaceAlt, border: `1px solid ${S.border}`, fontFamily: S.font, fontSize: 11.5, color: S.muted, lineHeight: 1.55 }}>
              Use this only for a specifically disclosed fee. The default model is buyer-paid on top of sale price, with a seller-pay override only when the seller explicitly elects to absorb it.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <button
                onClick={launchPlatformFeeCheckout}
                disabled={billingActionBusy === "platform-fee"}
                style={{ ...S.btn(S.gold, S.dark), opacity: billingActionBusy === "platform-fee" ? 0.7 : 1, cursor: billingActionBusy === "platform-fee" ? "not-allowed" : "pointer" }}
              >
                {billingActionBusy === "platform-fee" ? "Opening Stripe Checkout…" : "Collect Platform Fee In Stripe"}
              </button>
            </div>
          </Card>

          <Card style={{ marginBottom: 20 }}>
            <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: "0 0 4px" }}>🏦 Connected Institutions</h3>
            <p style={{ fontFamily: S.font, fontSize: 13, color: S.light, marginBottom: 16 }}>Link your banks, escrow services, and payment processors</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {FINANCIAL_INSTITUTIONS.map((fi) => {
                const isConn = connectedBanks[fi.id];
                return (
                  <div key={fi.id} style={{ border: `1px solid ${isConn ? S.green : S.border}`, background: isConn ? S.greenBg : S.card, borderRadius: 14, padding: 16, transition: "all 0.2s" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 22 }}>{fi.logo}</span>
                      <div>
                        <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 14, color: S.dark }}>{fi.name}</div>
                        <div style={{ fontFamily: S.font, fontSize: 11, color: S.light }}>{fi.type}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                      {fi.supports.map((s) => <Badge key={s}>{s}</Badge>)}
                    </div>
                    <button
                      onClick={() => setConnectedBanks({ ...connectedBanks, [fi.id]: !isConn })}
                      style={{ ...S.btn(isConn ? "transparent" : S.dark, isConn ? S.red : S.card), width: "100%", padding: "8px", fontSize: 12, border: isConn ? `1px solid ${S.red}` : "none" }}
                    >
                      {isConn ? "Disconnect" : "Connect via API"}
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: "0 0 8px" }}>📤 Payout Queue Snapshot</h3>
            <div style={{ fontFamily: S.font, fontSize: 12, color: S.light, marginBottom: 10 }}>
              Minimum payout threshold: <strong style={{ color: S.dark }}>{fmtCents(payoutFramework.minimumPayoutCents || 2500)}</strong>
            </div>
            {payoutQueue.length === 0 ? (
              <div style={{ padding: "12px 14px", borderRadius: 12, background: S.surfaceAlt, fontFamily: S.font, fontSize: 12, color: S.muted }}>
                No queued payouts yet. This framework is now active for future payout events.
              </div>
            ) : (
              payoutQueue.map((item) => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${S.surface}` }}>
                  <div>
                    <div style={{ fontFamily: S.font, fontSize: 13, fontWeight: 700, color: S.dark }}>{item.id}</div>
                    <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.light }}>{item.destinationLabel || "Destination pending"}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: S.font, fontSize: 13, fontWeight: 700, color: S.dark }}>{fmtCents(item.amountCents || 0)}</div>
                    <Badge variant={item.status === "sent" ? "verified" : "type"}>{item.status || "pending"}</Badge>
                  </div>
                </div>
              ))
            )}
          </Card>
        </div>
      )}

      {tab === "receipts" && (
        <div>
          <Card>
            <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: "0 0 14px" }}>🧾 Transaction Receipts</h3>
            <div style={{ border: `1px solid ${S.border}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr 100px 100px 80px", gap: 0, fontFamily: S.font, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: S.light, background: S.surface, padding: "10px 16px" }}>
                <span>ID</span><span>Type</span><span>Parties</span><span>Amount</span><span>Date</span><span>Status</span>
              </div>
              {receiptLog.map((r) => (
                <div key={r.id} style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr 100px 100px 80px", gap: 0, fontFamily: S.font, fontSize: 13, color: S.dark, padding: "12px 16px", borderTop: `1px solid ${S.surface}`, alignItems: "center" }}>
                  <span style={{ fontWeight: 600, color: S.gold }}>{r.id}</span>
                  <span>{r.type}</span>
                  <span style={{ fontSize: 12, color: S.muted }}>{r.from} → {r.to}</span>
                  <span style={{ fontWeight: 600 }}>{fmt(r.amount)}</span>
                  <span style={{ fontSize: 12, color: S.light }}>{r.date}</span>
                  <Badge variant={r.status === "Complete" ? "verified" : "type"}>{r.status}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── ATTORNEY PRACTICE DASHBOARD ── */}
      {tab === "practice" && user.accountType === "attorney" && (
        <div>
          {/* Authority Controls */}
          <Card style={{ marginBottom: 16 }}>
            <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: "0 0 4px" }}>⚖️ Legal Authority Controls</h3>
            <p style={{ fontFamily: S.font, fontSize: 12, color: S.light, marginBottom: 16 }}>Actions you can take on active transactions as closing attorney.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { label: "Place Legal Hold", desc: "Freeze a transaction pending legal review. All parties notified, no funds move.", icon: "🛑", color: S.red, actionLabel: "Place Hold" },
                { label: "Approve Contract", desc: "Sign off that a purchase agreement is legally sound and ready for execution.", icon: "✅", color: S.green, actionLabel: "Review Queue" },
                { label: "Authorize Closing", desc: "Certify all legal requirements met. Required before escrow can disburse.", icon: "🔒", color: S.gold, actionLabel: "Authorize" },
                { label: "Request Amendment", desc: "Flag a contract clause for revision. Transaction paused until both parties agree.", icon: "📝", color: "#378ADD", actionLabel: "Draft Amendment" },
              ].map((ctrl) => (
                <div key={ctrl.label} style={{ border: `1px solid ${S.border}`, borderRadius: 14, padding: 16, borderLeft: `4px solid ${ctrl.color}` }}>
                  <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 14, color: S.dark, marginBottom: 4 }}>{ctrl.icon} {ctrl.label}</div>
                  <div style={{ fontFamily: S.font, fontSize: 12, color: S.light, lineHeight: 1.5, marginBottom: 10 }}>{ctrl.desc}</div>
                  <button style={{ ...S.btn(ctrl.color, "#fff"), padding: "6px 16px", fontSize: 12, width: "100%" }}>{ctrl.actionLabel}</button>
                </div>
              ))}
            </div>
          </Card>

          {/* Active Cases */}
          <Card style={{ marginBottom: 16 }}>
            <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: "0 0 12px" }}>📂 Active Cases</h3>
            {[
              { txn: "TXN-04821", property: "108 Oak Ridge Lane, Cary, NC", parties: "Chen → Mitchell", status: "Contract Approved", phase: "Awaiting closing authorization", holdActive: false },
              { txn: "TXN-04756", property: "500 Fayetteville St #12B", parties: "Patel → Nguyen", status: "Title Review", phase: "Title search complete — drafting purchase agreement", holdActive: false },
              { txn: "TXN-04550", property: "12 Walnut Creek Blvd, Durham", parties: "Brown → TBD", status: "Contract Drafting", phase: "Initial offer under review — pending seller response", holdActive: false },
            ].map((c) => (
              <div key={c.txn} style={{ padding: "14px 0", borderBottom: `1px solid ${S.surface}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div>
                    <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 14, color: S.dark }}>{c.property}</div>
                    <div style={{ fontFamily: S.font, fontSize: 12, color: S.light }}>{c.txn} · {c.parties}</div>
                  </div>
                  <Badge variant={c.status.includes("Approved") ? "verified" : "type"}>{c.status}</Badge>
                </div>
                <div style={{ fontFamily: S.font, fontSize: 12, color: S.muted, marginBottom: 8 }}>{c.phase}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={{ ...S.btn("#F0EBE3", S.muted), padding: "5px 12px", fontSize: 11 }}>Review Docs</button>
                  <button style={{ ...S.btn("#F0EBE3", S.muted), padding: "5px 12px", fontSize: 11 }}>Message Parties</button>
                  <button style={{ ...S.btn(S.redBg, S.red), padding: "5px 12px", fontSize: 11 }}>Place Hold</button>
                </div>
              </div>
            ))}
          </Card>

          {/* Compliance Checklist */}
          <Card>
            <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: "0 0 12px" }}>📋 Closing Compliance Checklist</h3>
            <p style={{ fontFamily: S.font, fontSize: 12, color: S.light, marginBottom: 12 }}>Your sign-off is required on each item before closing can proceed.</p>
            {[
              "Purchase agreement reviewed and legally compliant",
              "All contingencies satisfied or waived in writing",
              "Title search clear — no undisclosed liens or encumbrances",
              "Title insurance policy bound and confirmed",
              "Seller disclosures complete and accurate per state requirements",
              "Closing disclosure reviewed — figures match agreed terms",
              "All signatures authentic and parties verified",
              "Deed prepared and ready for recording",
              "Power of attorney valid (if applicable)",
              "Funds verified in escrow — wire confirmation received",
            ].map((item) => (
              <label key={item} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${S.surface}`, fontFamily: S.font, fontSize: 13, color: S.muted, cursor: "pointer" }}>
                <input type="checkbox" /> {item}
              </label>
            ))}
            <button style={{ ...S.btn(S.green, "#fff"), width: "100%", padding: "12px", marginTop: 14, fontSize: 14 }}>✓ Certify Closing Ready — All Legal Requirements Met</button>
          </Card>
        </div>
      )}

      {/* ── AGENT TOOLS DASHBOARD ── */}
      {tab === "practice" && user.accountType === "agent" && (
        <div>
          <Card style={{ marginBottom: 16 }}>
            <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: "0 0 4px" }}>🔑 Agent Authority Controls</h3>
            <p style={{ fontFamily: S.font, fontSize: 12, color: S.light, marginBottom: 16 }}>Tools for managing listings and representing clients in transactions.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { label: "Submit Counter-Offer", desc: "Respond to a buyer's offer on behalf of your seller client with revised terms.", icon: "💬", color: S.gold, actionLabel: "Draft Counter" },
                { label: "Schedule Showing", desc: "Coordinate property viewings with verified buyers. Auto-notifies all parties.", icon: "📅", color: "#378ADD", actionLabel: "Open Calendar" },
                { label: "Withdraw Listing", desc: "Pull a property from the market. Requires written seller authorization.", icon: "⏸", color: S.red, actionLabel: "Request Withdrawal" },
                { label: "Recommend Pricing", desc: "Submit a comparative market analysis to advise your client on pricing strategy.", icon: "📊", color: S.green, actionLabel: "Create CMA" },
              ].map((ctrl) => (
                <div key={ctrl.label} style={{ border: `1px solid ${S.border}`, borderRadius: 14, padding: 16, borderLeft: `4px solid ${ctrl.color}` }}>
                  <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 14, color: S.dark, marginBottom: 4 }}>{ctrl.icon} {ctrl.label}</div>
                  <div style={{ fontFamily: S.font, fontSize: 12, color: S.light, lineHeight: 1.5, marginBottom: 10 }}>{ctrl.desc}</div>
                  <button style={{ ...S.btn(ctrl.color, "#fff"), padding: "6px 16px", fontSize: 12, width: "100%" }}>{ctrl.actionLabel}</button>
                </div>
              ))}
            </div>
          </Card>

          {/* Client Representations */}
          <Card style={{ marginBottom: 16 }}>
            <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: "0 0 12px" }}>👥 Client Representations</h3>
            {[
              { client: "Sarah Williams (Seller)", property: "44 Magnolia Walk, Durham", repType: "Listing Agent", status: "Active — Offer received", commission: "2.5% seller-side" },
              { client: "Marcus Bell (Buyer)", property: "330 Capital Blvd, Raleigh", repType: "Buyer's Agent", status: "Active — Under contract", commission: "2.5% buyer-side" },
            ].map((rep) => (
              <div key={rep.client} style={{ padding: "14px 0", borderBottom: `1px solid ${S.surface}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div>
                    <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 14, color: S.dark }}>{rep.client}</div>
                    <div style={{ fontFamily: S.font, fontSize: 12, color: S.light }}>{rep.property}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}><Badge variant="role">{rep.repType}</Badge><Badge variant="verified">{rep.status.split("—")[0].trim()}</Badge></div>
                </div>
                <div style={{ fontFamily: S.font, fontSize: 12, color: S.muted, marginBottom: 8 }}>{rep.status} · {rep.commission}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={{ ...S.btn("#F0EBE3", S.muted), padding: "5px 12px", fontSize: 11 }}>View Deal</button>
                  <button style={{ ...S.btn("#F0EBE3", S.muted), padding: "5px 12px", fontSize: 11 }}>Message Client</button>
                  <button style={{ ...S.btn("#F0EBE3", S.muted), padding: "5px 12px", fontSize: 11 }}>Upload Docs</button>
                </div>
              </div>
            ))}
          </Card>

          {/* Showings Calendar */}
          <Card>
            <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: "0 0 12px" }}>📅 Upcoming Showings</h3>
            {[
              { date: "Mar 27, 2:00 PM", property: "44 Magnolia Walk", buyer: "Jordan Mitchell", status: "Confirmed" },
              { date: "Mar 28, 10:00 AM", property: "44 Magnolia Walk", buyer: "Andrea Collins", status: "Pending" },
              { date: "Mar 29, 1:00 PM", property: "330 Capital Blvd", buyer: "Marcus Bell (2nd viewing)", status: "Confirmed" },
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${S.surface}` }}>
                <div>
                  <div style={{ fontFamily: S.font, fontWeight: 600, fontSize: 13, color: S.dark }}>{s.property}</div>
                  <div style={{ fontFamily: S.font, fontSize: 12, color: S.light }}>{s.date} · {s.buyer}</div>
                </div>
                <Badge variant={s.status === "Confirmed" ? "verified" : "type"}>{s.status}</Badge>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* ── INSPECTOR DASHBOARD ── */}
      {tab === "practice" && user.accountType === "inspector" && (
        <div>
          <Card style={{ marginBottom: 16 }}>
            <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: "0 0 4px" }}>🔍 Inspection Authority Controls</h3>
            <p style={{ fontFamily: S.font, fontSize: 12, color: S.light, marginBottom: 16 }}>Your findings directly impact whether a transaction can proceed.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { label: "Submit Inspection Report", desc: "Upload your findings. Report is shared with buyer, seller, and attorney simultaneously.", icon: "📋", color: S.green, actionLabel: "Upload Report" },
                { label: "Flag Critical Deficiency", desc: "Identify a safety or structural issue that could block closing until resolved.", icon: "🚨", color: S.red, actionLabel: "Flag Issue" },
                { label: "Request Re-Inspection", desc: "After repairs are made, schedule a follow-up to verify the work was completed.", icon: "🔄", color: "#378ADD", actionLabel: "Schedule Re-Inspect" },
                { label: "Issue Clearance Letter", desc: "Confirm that previously flagged issues have been satisfactorily resolved.", icon: "✅", color: S.green, actionLabel: "Issue Clearance" },
              ].map((ctrl) => (
                <div key={ctrl.label} style={{ border: `1px solid ${S.border}`, borderRadius: 14, padding: 16, borderLeft: `4px solid ${ctrl.color}` }}>
                  <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 14, color: S.dark, marginBottom: 4 }}>{ctrl.icon} {ctrl.label}</div>
                  <div style={{ fontFamily: S.font, fontSize: 12, color: S.light, lineHeight: 1.5, marginBottom: 10 }}>{ctrl.desc}</div>
                  <button style={{ ...S.btn(ctrl.color, "#fff"), padding: "6px 16px", fontSize: 12, width: "100%" }}>{ctrl.actionLabel}</button>
                </div>
              ))}
            </div>
          </Card>

          {/* Active Inspections */}
          <Card style={{ marginBottom: 16 }}>
            <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: "0 0 12px" }}>🏠 Active Inspections</h3>
            {[
              { property: "108 Oak Ridge Lane, Cary, NC", txn: "TXN-04821", date: "Mar 27, 9:00 AM", type: "Full Home Inspection", status: "Scheduled", fee: 450, deficiencies: 0 },
              { property: "330 Capital Blvd, Raleigh, NC", txn: "TXN-04780", date: "Mar 21, 10:00 AM", type: "Full Home Inspection", status: "Report Submitted", fee: 425, deficiencies: 3 },
            ].map((insp) => (
              <div key={insp.txn} style={{ padding: "14px 0", borderBottom: `1px solid ${S.surface}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div>
                    <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 14, color: S.dark }}>{insp.property}</div>
                    <div style={{ fontFamily: S.font, fontSize: 12, color: S.light }}>{insp.txn} · {insp.type} · {insp.date}</div>
                  </div>
                  <Badge variant={insp.status === "Report Submitted" ? "verified" : "type"}>{insp.status}</Badge>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 8 }}>
                  <div style={{ background: S.surfaceAlt, borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                    <div style={{ fontFamily: S.font, fontSize: 14, fontWeight: 700, color: S.dark }}>{fmt(insp.fee)}</div>
                    <div style={{ fontFamily: S.font, fontSize: 10, color: S.light }}>Inspection Fee</div>
                  </div>
                  <div style={{ background: insp.deficiencies > 0 ? S.redBg : S.greenBg, borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                    <div style={{ fontFamily: S.font, fontSize: 14, fontWeight: 700, color: insp.deficiencies > 0 ? S.red : S.green }}>{insp.deficiencies}</div>
                    <div style={{ fontFamily: S.font, fontSize: 10, color: insp.deficiencies > 0 ? S.red : S.green }}>Deficiencies</div>
                  </div>
                  <div style={{ background: S.surfaceAlt, borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                    <div style={{ fontFamily: S.font, fontSize: 14, fontWeight: 700, color: S.dark }}>{insp.status === "Report Submitted" ? "✓" : "—"}</div>
                    <div style={{ fontFamily: S.font, fontSize: 10, color: S.light }}>Report Filed</div>
                  </div>
                </div>
                {insp.deficiencies > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: S.red, marginBottom: 6 }}>Deficiencies Found</div>
                    {["HVAC condenser — refrigerant leak detected", "Deck railing — loose at 3 attachment points", "Bathroom exhaust — not vented to exterior"].map((d) => (
                      <div key={d} style={{ fontFamily: S.font, fontSize: 12, color: S.red, background: S.redBg, padding: "6px 10px", borderRadius: 6, marginBottom: 4 }}>⚠️ {d}</div>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 6 }}>
                  {insp.status === "Scheduled" && <button style={{ ...S.btn(S.gold, S.dark), padding: "5px 12px", fontSize: 11 }}>Upload Report</button>}
                  {insp.deficiencies > 0 && <button style={{ ...S.btn("#378ADD", "#fff"), padding: "5px 12px", fontSize: 11 }}>Schedule Re-Inspect</button>}
                  {insp.deficiencies > 0 && <button style={{ ...S.btn(S.green, "#fff"), padding: "5px 12px", fontSize: 11 }}>Issue Clearance</button>}
                  <button style={{ ...S.btn("#F0EBE3", S.muted), padding: "5px 12px", fontSize: 11 }}>Message Parties</button>
                </div>
              </div>
            ))}
          </Card>

          {/* Inspection Checklist Template */}
          <Card>
            <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: "0 0 12px" }}>📋 Standard Inspection Areas</h3>
            <p style={{ fontFamily: S.font, fontSize: 12, color: S.light, marginBottom: 12 }}>Rate each area during your walkthrough. Your assessment determines if the deal proceeds.</p>
            {["Structural / Foundation", "Roof & Attic", "Exterior Walls & Siding", "Plumbing Systems", "Electrical Systems", "HVAC / Climate", "Kitchen & Appliances", "Bathrooms", "Windows & Doors", "Basement / Crawlspace", "Garage", "Fire Safety / Detectors"].map((area) => (
              <div key={area} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${S.surface}` }}>
                <span style={{ fontFamily: S.font, fontSize: 13, color: S.dark }}>{area}</span>
                <div style={{ display: "flex", gap: 4 }}>
                  {["Pass", "Minor", "Major", "Fail"].map((grade) => (
                    <button key={grade} style={{ ...S.btn(grade === "Pass" ? S.greenBg : grade === "Fail" ? S.redBg : "#F0EBE3", grade === "Pass" ? S.green : grade === "Fail" ? S.red : S.muted), padding: "3px 10px", fontSize: 10, borderRadius: 6 }}>{grade}</button>
                  ))}
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* ── LENDER / ESCROW DASHBOARD ── */}
      {tab === "practice" && user.accountType === "lender" && (
        <div>
          <Card style={{ marginBottom: 16 }}>
            <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: "0 0 4px" }}>🏦 Lending & Escrow Authority Controls</h3>
            <p style={{ fontFamily: S.font, fontSize: 12, color: S.light, marginBottom: 16 }}>You control the flow of funds. Nothing closes without your authorization.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { label: "Confirm Wire Receipt", desc: "Verify incoming funds have cleared and are held in escrow. Both parties notified.", icon: "✅", color: S.green, actionLabel: "Confirm Funds" },
                { label: "Disburse Funds", desc: "Release escrow funds to seller upon closing authorization from attorney.", icon: "💸", color: S.gold, actionLabel: "Initiate Disbursement" },
                { label: "Freeze Escrow", desc: "Place a hold on all funds in escrow due to dispute, fraud suspicion, or legal hold.", icon: "🧊", color: "#378ADD", actionLabel: "Freeze Account" },
                { label: "Issue Refund", desc: "Return earnest money to buyer if contingencies fail or deal falls through.", icon: "↩️", color: S.red, actionLabel: "Process Refund" },
              ].map((ctrl) => (
                <div key={ctrl.label} style={{ border: `1px solid ${S.border}`, borderRadius: 14, padding: 16, borderLeft: `4px solid ${ctrl.color}` }}>
                  <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 14, color: S.dark, marginBottom: 4 }}>{ctrl.icon} {ctrl.label}</div>
                  <div style={{ fontFamily: S.font, fontSize: 12, color: S.light, lineHeight: 1.5, marginBottom: 10 }}>{ctrl.desc}</div>
                  <button style={{ ...S.btn(ctrl.color, "#fff"), padding: "6px 16px", fontSize: 12, width: "100%" }}>{ctrl.actionLabel}</button>
                </div>
              ))}
            </div>
          </Card>

          {/* Active Escrow Accounts */}
          <Card style={{ marginBottom: 16 }}>
            <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: "0 0 12px" }}>🔒 Active Escrow Accounts</h3>
            {[
              { txn: "ESC-2026-04821", property: "108 Oak Ridge Lane, Cary, NC", balance: 12500, totalDue: 589000, buyer: "Jordan Mitchell", seller: "David Chen", status: "Funds Held", disbReady: false },
              { txn: "ESC-2026-04756", property: "500 Fayetteville St #12B", balance: 8000, totalDue: 310000, buyer: "Thanh Nguyen", seller: "Priya Patel", status: "Funds Held", disbReady: false },
              { txn: "ESC-2026-04690", property: "217 Haywood Ave, Raleigh, NC", balance: 340000, totalDue: 340000, buyer: "Robert Fields", seller: "Angela Brooks", status: "Ready to Disburse", disbReady: true },
            ].map((esc) => (
              <div key={esc.txn} style={{ padding: "14px 0", borderBottom: `1px solid ${S.surface}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div>
                    <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 14, color: S.dark }}>{esc.property}</div>
                    <div style={{ fontFamily: S.font, fontSize: 12, color: S.light }}>{esc.txn} · {esc.buyer} → {esc.seller}</div>
                  </div>
                  <Badge variant={esc.disbReady ? "verified" : "type"}>{esc.status}</Badge>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div style={{ background: S.surfaceAlt, borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                    <div style={{ fontFamily: S.font, fontSize: 14, fontWeight: 700, color: S.gold }}>{fmt(esc.balance)}</div>
                    <div style={{ fontFamily: S.font, fontSize: 10, color: S.light }}>In Escrow</div>
                  </div>
                  <div style={{ background: S.surfaceAlt, borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                    <div style={{ fontFamily: S.font, fontSize: 14, fontWeight: 700, color: S.dark }}>{fmt(esc.totalDue)}</div>
                    <div style={{ fontFamily: S.font, fontSize: 10, color: S.light }}>Total Due</div>
                  </div>
                  <div style={{ background: esc.balance >= esc.totalDue ? S.greenBg : S.redBg, borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                    <div style={{ fontFamily: S.font, fontSize: 14, fontWeight: 700, color: esc.balance >= esc.totalDue ? S.green : S.red }}>{fmt(esc.totalDue - esc.balance)}</div>
                    <div style={{ fontFamily: S.font, fontSize: 10, color: esc.balance >= esc.totalDue ? S.green : S.red }}>Remaining</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={{ ...S.btn(S.green, "#fff"), padding: "5px 12px", fontSize: 11 }}>Confirm Wire</button>
                  {esc.disbReady && <button style={{ ...S.btn(S.gold, S.dark), padding: "5px 12px", fontSize: 11 }}>Disburse Funds</button>}
                  <button style={{ ...S.btn("#F0EBE3", S.muted), padding: "5px 12px", fontSize: 11 }}>View Ledger</button>
                  <button style={{ ...S.btn(S.redBg, S.red), padding: "5px 12px", fontSize: 11 }}>Freeze</button>
                </div>
              </div>
            ))}
          </Card>

          {/* Underwriting Checklist */}
          <Card>
            <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: "0 0 12px" }}>📋 Disbursement Authorization Checklist</h3>
            <p style={{ fontFamily: S.font, fontSize: 12, color: S.light, marginBottom: 12 }}>All items must be confirmed before any funds are released. One missing item blocks disbursement.</p>
            {[
              "Attorney closing authorization received",
              "All purchase agreement conditions satisfied",
              "Buyer's full funds wired and cleared",
              "Title insurance policy confirmed",
              "Deed and documents recorded with county",
              "EstateHat buyer fee (1.50%) calculated and disclosed, or seller-pay override documented",
              "Seller net proceeds calculated and verified",
              "Wire instructions confirmed with receiving bank",
              "All parties have signed closing disclosure",
              "No active legal holds or disputes on file",
            ].map((item) => (
              <label key={item} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${S.surface}`, fontFamily: S.font, fontSize: 13, color: S.muted, cursor: "pointer" }}>
                <input type="checkbox" /> {item}
              </label>
            ))}
            <button style={{ ...S.btn(S.gold, S.dark), width: "100%", padding: "12px", marginTop: 14, fontSize: 14 }}>💸 Authorize Disbursement — Release Funds to Seller</button>
          </Card>
        </div>
      )}

      {/* ── CORPORATE ENTITY MANAGEMENT ── */}
      {tab === "entity" && isCorp && (
        <div>
          {/* Entity Info Card */}
          <Card style={{ marginBottom: 16 }}>
            <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: "0 0 14px" }}>🏛 Entity Information</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={S.label}>Legal Entity Name</label>
                <input value={corpInfo.entityName} onChange={(e) => setCorpInfo({ ...corpInfo, entityName: e.target.value })} placeholder="e.g., Triangle Holdings LLC" style={S.input} />
              </div>
              <div>
                <label style={S.label}>Entity Type</label>
                <select value={corpInfo.entityType} onChange={(e) => setCorpInfo({ ...corpInfo, entityType: e.target.value })} style={{ ...S.input, cursor: "pointer" }}>
                  {ENTITY_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>EIN / Tax ID</label>
                <input value={corpInfo.ein} onChange={(e) => setCorpInfo({ ...corpInfo, ein: e.target.value })} placeholder="XX-XXXXXXX" style={S.input} />
              </div>
              <div>
                <label style={S.label}>State of Formation</label>
                <input value={corpInfo.stateOfFormation} onChange={(e) => setCorpInfo({ ...corpInfo, stateOfFormation: e.target.value })} placeholder="e.g., North Carolina" style={S.input} />
              </div>
              <div>
                <label style={S.label}>Date of Formation</label>
                <input type="date" value={corpInfo.dateFormed} onChange={(e) => setCorpInfo({ ...corpInfo, dateFormed: e.target.value })} style={S.input} />
              </div>
              <div>
                <label style={S.label}>Registered Agent</label>
                <input value={corpInfo.registeredAgent} onChange={(e) => setCorpInfo({ ...corpInfo, registeredAgent: e.target.value })} placeholder="Agent name" style={S.input} />
              </div>
            </div>
            <label style={S.label}>Registered Agent Address</label>
            <input value={corpInfo.regAgentAddress} onChange={(e) => setCorpInfo({ ...corpInfo, regAgentAddress: e.target.value })} placeholder="Full address of registered agent" style={S.input} />
            <AddressVerifier address={corpInfo.regAgentAddress} onVerified={() => {}} />
          </Card>

          {/* Authorized Signers */}
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: 0 }}>✍️ Authorized Signers</h3>
              <button
                onClick={() => setCorpInfo({ ...corpInfo, authorizedSigners: [...corpInfo.authorizedSigners, { name: "", title: "" }] })}
                style={{ ...S.btn(S.gold, S.dark), padding: "6px 16px", fontSize: 12 }}
              >+ Add Signer</button>
            </div>
            <p style={{ fontFamily: S.font, fontSize: 12, color: S.light, marginBottom: 14 }}>
              Each authorized signer must be individually verified (ID + selfie + background check). Only verified signers can execute contracts on behalf of the entity.
            </p>
            {corpInfo.authorizedSigners.map((signer, i) => (
              <div key={i} style={{ border: `1px solid ${S.border}`, borderRadius: 12, padding: 16, marginBottom: 10, borderLeft: `4px solid ${signer.name ? S.gold : "#C9C0B4"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontFamily: S.font, fontSize: 13, fontWeight: 700, color: S.dark }}>Signer #{i + 1}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Badge variant={signer.name ? "type" : "warn"}>{signer.name ? "Pending Verification" : "Incomplete"}</Badge>
                    {corpInfo.authorizedSigners.length > 1 && (
                      <button onClick={() => setCorpInfo({ ...corpInfo, authorizedSigners: corpInfo.authorizedSigners.filter((_, j) => j !== i) })} style={{ background: "none", border: "none", color: S.red, cursor: "pointer", fontFamily: S.font, fontSize: 12 }}>Remove</button>
                    )}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ ...S.label, marginTop: 0 }}>Full Legal Name</label>
                    <input value={signer.name} onChange={(e) => { const s = [...corpInfo.authorizedSigners]; s[i] = { ...s[i], name: e.target.value }; setCorpInfo({ ...corpInfo, authorizedSigners: s }); }} placeholder="As shown on government ID" style={S.input} />
                  </div>
                  <div>
                    <label style={{ ...S.label, marginTop: 0 }}>Title / Role</label>
                    <input value={signer.title} onChange={(e) => { const s = [...corpInfo.authorizedSigners]; s[i] = { ...s[i], title: e.target.value }; setCorpInfo({ ...corpInfo, authorizedSigners: s }); }} placeholder="e.g., Managing Member, CEO, Trustee" style={S.input} />
                  </div>
                </div>
              </div>
            ))}
          </Card>

          {/* Corporate Authority Actions */}
          <Card style={{ marginBottom: 16 }}>
            <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: "0 0 4px" }}>🏗 Entity Authority Controls</h3>
            <p style={{ fontFamily: S.font, fontSize: 12, color: S.light, marginBottom: 16 }}>Actions specific to corporate and institutional accounts.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { label: "Upload Board Resolution", desc: "Authorize specific transactions or grant signing authority for upcoming deals.", icon: "📋", color: S.gold, actionLabel: "Upload Resolution" },
                { label: user.accountType === "corp_buyer" ? "Submit Corporate Offer" : "List Entity Property", desc: user.accountType === "corp_buyer" ? "Make an offer on behalf of the entity. Requires authorized signer approval." : "List a property held by the entity. Requires resolution and title verification.", icon: user.accountType === "corp_buyer" ? "🤝" : "📋", color: "#378ADD", actionLabel: user.accountType === "corp_buyer" ? "Draft Offer" : "Create Listing" },
                { label: "Manage Representatives", desc: "Assign attorneys, agents, or inspectors to act on behalf of the entity in transactions.", icon: "👥", color: S.green, actionLabel: "Assign Reps" },
                { label: "Request Entity Audit", desc: "Generate a compliance report for all entity transactions, signers, and documents.", icon: "📊", color: "#7F77DD", actionLabel: "Run Audit" },
              ].map((ctrl) => (
                <div key={ctrl.label} style={{ border: `1px solid ${S.border}`, borderRadius: 14, padding: 16, borderLeft: `4px solid ${ctrl.color}` }}>
                  <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 14, color: S.dark, marginBottom: 4 }}>{ctrl.icon} {ctrl.label}</div>
                  <div style={{ fontFamily: S.font, fontSize: 12, color: S.light, lineHeight: 1.5, marginBottom: 10 }}>{ctrl.desc}</div>
                  <button style={{ ...S.btn(ctrl.color, "#fff"), padding: "6px 16px", fontSize: 12, width: "100%" }}>{ctrl.actionLabel}</button>
                </div>
              ))}
            </div>
          </Card>

          {/* Portfolio Summary (Corp Buyer) or Holdings (Corp Seller) */}
          <Card style={{ marginBottom: 16 }}>
            <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: "0 0 12px" }}>
              {user.accountType === "corp_buyer" ? "📈 Acquisition Pipeline" : "🏘 Property Holdings"}
            </h3>
            {user.accountType === "corp_buyer" ? (
              <>
                {[
                  { property: "108 Oak Ridge Lane, Cary, NC", price: 589000, status: "Under Contract", phase: "Inspection", signer: "Jordan Mitchell, Managing Member" },
                  { property: "44 Magnolia Walk, Durham, NC", price: 275000, status: "Offer Submitted", phase: "Awaiting Response", signer: "Jordan Mitchell, Managing Member" },
                  { property: "920 Lake Wheeler Rd, Raleigh, NC", price: 1250000, status: "Due Diligence", phase: "Environmental Review", signer: "Pending Board Approval" },
                ].map((acq) => (
                  <div key={acq.property} style={{ padding: "12px 0", borderBottom: `1px solid ${S.surface}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 14, color: S.dark }}>{acq.property}</div>
                      <Badge variant={acq.status === "Under Contract" ? "verified" : acq.status === "Due Diligence" ? "type" : "default"}>{acq.status}</Badge>
                    </div>
                    <div style={{ fontFamily: S.font, fontSize: 12, color: S.light }}>{fmt(acq.price)} · {acq.phase} · Signer: {acq.signer}</div>
                  </div>
                ))}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 14 }}>
                  <div style={{ background: S.surfaceAlt, borderRadius: 10, padding: 12, textAlign: "center" }}>
                    <div style={{ fontFamily: S.serif, fontSize: 20, color: S.dark }}>3</div>
                    <div style={{ fontFamily: S.font, fontSize: 10, color: S.light }}>Active Deals</div>
                  </div>
                  <div style={{ background: S.surfaceAlt, borderRadius: 10, padding: 12, textAlign: "center" }}>
                    <div style={{ fontFamily: S.serif, fontSize: 20, color: S.dark }}>{fmt(2114000)}</div>
                    <div style={{ fontFamily: S.font, fontSize: 10, color: S.light }}>Pipeline Value</div>
                  </div>
                  <div style={{ background: S.surfaceAlt, borderRadius: 10, padding: 12, textAlign: "center" }}>
                    <div style={{ fontFamily: S.serif, fontSize: 20, color: S.gold }}>{fmt(Math.round(2114000 * 0.015))}</div>
                    <div style={{ fontFamily: S.font, fontSize: 10, color: S.light }}>Est. Fees</div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {[
                  { property: "217 Haywood Ave, Raleigh, NC (Duplex)", units: 2, acquired: "2019", value: 340000, status: "Listed — Offer Received", tenant: "Occupied (2 tenants)" },
                  { property: "4200 Six Forks Rd, Raleigh, NC (Office)", units: 8, acquired: "2021", value: 1850000, status: "Listed", tenant: "75% Occupied" },
                  { property: "88 Shoreline Dr, Wake Forest, NC", units: 1, acquired: "2020", value: 725000, status: "Pending Verification", tenant: "Vacant" },
                ].map((hold) => (
                  <div key={hold.property} style={{ padding: "12px 0", borderBottom: `1px solid ${S.surface}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 14, color: S.dark }}>{hold.property}</div>
                      <Badge variant={hold.status.includes("Offer") ? "verified" : hold.status === "Listed" ? "type" : "warn"}>{hold.status}</Badge>
                    </div>
                    <div style={{ fontFamily: S.font, fontSize: 12, color: S.light }}>
                      {fmt(hold.value)} · {hold.units} unit{hold.units > 1 ? "s" : ""} · Acquired {hold.acquired} · {hold.tenant}
                    </div>
                  </div>
                ))}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 14 }}>
                  <div style={{ background: S.surfaceAlt, borderRadius: 10, padding: 12, textAlign: "center" }}>
                    <div style={{ fontFamily: S.serif, fontSize: 20, color: S.dark }}>3</div>
                    <div style={{ fontFamily: S.font, fontSize: 10, color: S.light }}>Holdings</div>
                  </div>
                  <div style={{ background: S.surfaceAlt, borderRadius: 10, padding: 12, textAlign: "center" }}>
                    <div style={{ fontFamily: S.serif, fontSize: 20, color: S.dark }}>{fmt(2915000)}</div>
                    <div style={{ fontFamily: S.font, fontSize: 10, color: S.light }}>Portfolio Value</div>
                  </div>
                  <div style={{ background: S.surfaceAlt, borderRadius: 10, padding: 12, textAlign: "center" }}>
                    <div style={{ fontFamily: S.serif, fontSize: 20, color: S.dark }}>11</div>
                    <div style={{ fontFamily: S.font, fontSize: 10, color: S.light }}>Total Units</div>
                  </div>
                </div>
              </>
            )}
          </Card>

          {/* Corporate Compliance */}
          <Card>
            <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: "0 0 12px" }}>📋 Entity Compliance Status</h3>
            <p style={{ fontFamily: S.font, fontSize: 12, color: S.light, marginBottom: 12 }}>All items must be current for the entity to transact. Expired items block all new transactions.</p>
            {[
              { label: "Certificate of Good Standing", status: "Valid", expires: "Dec 2026" },
              { label: "Operating Agreement on file", status: "Valid", expires: "N/A" },
              { label: "Board resolution (current year)", status: corpInfo.entityName ? "Valid" : "Missing", expires: "Dec 2026" },
              { label: "Registered agent active", status: "Valid", expires: "Ongoing" },
              { label: "EIN verified with IRS", status: corpInfo.ein ? "Verified" : "Pending", expires: "N/A" },
              { label: "OFAC / sanctions screening", status: "Clear", expires: "Quarterly renewal" },
              { label: "All signers individually verified", status: "Pending", expires: "Per signer" },
              { label: "Entity insurance (E&O / liability)", status: "Valid", expires: "Sep 2026" },
            ].map((item) => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${S.surface}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: item.status === "Valid" || item.status === "Verified" || item.status === "Clear" ? S.green : item.status === "Missing" ? S.red : S.gold }}>
                    {item.status === "Valid" || item.status === "Verified" || item.status === "Clear" ? "✓" : item.status === "Missing" ? "✗" : "○"}
                  </span>
                  <span style={{ fontFamily: S.font, fontSize: 13, color: S.dark }}>{item.label}</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontFamily: S.font, fontSize: 11, color: S.light }}>{item.expires}</span>
                  <Badge variant={item.status === "Valid" || item.status === "Verified" || item.status === "Clear" ? "verified" : item.status === "Missing" ? "warn" : "type"}>{item.status}</Badge>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}


// ─── TRANSACTION VIEW ────────────────────

// ─── USER DEALS DATA ─────────────────────

const USER_DEALS = [
  {
    id: "TXN-04821", property: "108 Oak Ridge Lane, Cary, NC", propertyId: 3, price: 589000, img: "🏠", type: "House",
    beds: 5, baths: 3.5, sqft: 3400, status: "In Progress", phase: "Inspection & Appraisal", daysOpen: 12, openDate: "Mar 14, 2026", estClose: "Apr 15, 2026",
    parties: [
      { name: "Jordan Mitchell", role: "buyer", you: true, verified: true },
      { name: "David Chen", role: "seller", you: false, verified: true },
      { name: "Rachel Torres, Esq.", role: "attorney", you: false, verified: true },
      { name: "Mike Rawlings", role: "inspector", you: false, verified: true },
      { name: "First American Title", role: "lender", you: false, verified: true },
    ],
    checklist: { buyer_identity: true, buyer_citizenship: true, seller_identity: true, seller_citizenship: true, offer_accepted: true, earnest_deposit: true, proof_of_funds: true, purchase_agreement: true, seller_disclosure: true, inspection_report: false, appraisal: false, title_search: true, title_insurance: true, mortgage_approved: false, closing_disclosure: false, final_walkthrough: false, funds_wired: false, docs_recorded: false },
    escrowBalance: 12500,
    timeline: [
      { date: "Mar 14", label: "Offer submitted", status: "Complete" },
      { date: "Mar 15", label: "Offer accepted by seller", status: "Complete" },
      { date: "Mar 18", label: "Earnest money deposited ($12,500)", status: "Complete" },
      { date: "Mar 20", label: "Purchase agreement signed", status: "Complete" },
      { date: "Mar 25", label: "Seller disclosure received", status: "Complete" },
      { date: "Mar 27", label: "Home inspection (scheduled)", status: "Pending" },
      { date: "Apr 01", label: "Appraisal", status: "Scheduled" },
      { date: "Apr 10", label: "Mortgage final approval", status: "Scheduled" },
      { date: "Apr 15", label: "Closing day", status: "Scheduled" },
    ],
  },
  {
    id: "TXN-04899", property: "44 Magnolia Walk, Durham, NC", propertyId: 4, price: 275000, img: "🏘", type: "Townhome",
    beds: 3, baths: 2.5, sqft: 1600, status: "Offer Pending", phase: "Offer Review", daysOpen: 3, openDate: "Mar 23, 2026", estClose: "May 01, 2026",
    parties: [
      { name: "Jordan Mitchell", role: "buyer", you: true, verified: true },
      { name: "Sarah Williams", role: "agent", you: false, verified: true },
    ],
    checklist: { buyer_identity: true, buyer_citizenship: true, seller_identity: false, seller_citizenship: false, offer_accepted: false, earnest_deposit: false, proof_of_funds: true, purchase_agreement: false, seller_disclosure: false, inspection_report: false, appraisal: false, title_search: false, title_insurance: false, mortgage_approved: false, closing_disclosure: false, final_walkthrough: false, funds_wired: false, docs_recorded: false },
    escrowBalance: 0,
    timeline: [
      { date: "Mar 23", label: "Offer submitted ($275,000)", status: "Complete" },
      { date: "Mar 24", label: "Pre-approval letter uploaded", status: "Complete" },
      { date: "Mar 26", label: "Awaiting seller response", status: "Pending" },
    ],
  },
];

// Reference deal shapes retained for future live transaction wiring
const ROLE_DEALS = {
  seller: [
    { id: "TXN-04821", property: "108 Oak Ridge Lane, Cary, NC", price: 589000, img: "🏠", type: "House", status: "In Progress", phase: "Inspection & Appraisal", daysOpen: 12, yourRole: "Seller", otherParty: "Jordan Mitchell (Buyer)", checkDone: 8, checkTotal: 18 },
    { id: "TXN-04610", property: "55 Pine Grove Ct, Apex, NC", price: 465000, img: "🏡", type: "House", status: "Closing", phase: "Final Walkthrough", daysOpen: 32, yourRole: "Seller", otherParty: "Amanda Price (Buyer)", checkDone: 17, checkTotal: 18 },
  ],
  attorney: [
    { id: "TXN-04821", property: "108 Oak Ridge Lane, Cary, NC", price: 589000, img: "🏠", type: "House", status: "In Progress", phase: "Contract Review", daysOpen: 12, yourRole: "Closing Attorney", otherParty: "David Chen → Jordan Mitchell", checkDone: 8, checkTotal: 18 },
    { id: "TXN-04756", property: "500 Fayetteville St #12B, Raleigh, NC", price: 310000, img: "🏢", type: "Condo", status: "In Progress", phase: "Title Review", daysOpen: 5, yourRole: "Closing Attorney", otherParty: "Priya Patel → Thanh Nguyen", checkDone: 4, checkTotal: 18 },
    { id: "TXN-04550", property: "12 Walnut Creek Blvd, Durham, NC", price: 380000, img: "🏘", type: "Townhome", status: "Offer Pending", phase: "Contract Drafting", daysOpen: 2, yourRole: "Closing Attorney", otherParty: "Keisha Brown → TBD", checkDone: 1, checkTotal: 18 },
  ],
  agent: [
    { id: "TXN-04899", property: "44 Magnolia Walk, Durham, NC", price: 275000, img: "🏘", type: "Townhome", status: "Offer Pending", phase: "Offer Review", daysOpen: 3, yourRole: "Listing Agent", otherParty: "Jordan Mitchell (Buyer)", checkDone: 2, checkTotal: 18 },
    { id: "TXN-04780", property: "330 Capital Blvd, Raleigh, NC", price: 520000, img: "🏠", type: "House", status: "In Progress", phase: "Appraisal", daysOpen: 16, yourRole: "Buyer's Agent", otherParty: "Kim Park (Seller)", checkDone: 11, checkTotal: 18 },
  ],
  inspector: [
    { id: "TXN-04821", property: "108 Oak Ridge Lane, Cary, NC", price: 589000, img: "🏠", type: "House", status: "In Progress", phase: "Inspection Scheduled", daysOpen: 12, yourRole: "Home Inspector", otherParty: "David Chen → Jordan Mitchell", checkDone: 8, checkTotal: 18 },
    { id: "TXN-04780", property: "330 Capital Blvd, Raleigh, NC", price: 520000, img: "🏠", type: "House", status: "Report Submitted", phase: "Awaiting Buyer Review", daysOpen: 16, yourRole: "Home Inspector", otherParty: "Kim Park → Marcus Bell", checkDone: 10, checkTotal: 18 },
  ],
  lender: [
    { id: "TXN-04821", property: "108 Oak Ridge Lane, Cary, NC", price: 589000, img: "🏠", type: "House", status: "In Progress", phase: "Escrow Open", daysOpen: 12, yourRole: "Escrow & Title", otherParty: "David Chen → Jordan Mitchell", checkDone: 8, checkTotal: 18 },
    { id: "TXN-04756", property: "500 Fayetteville St #12B, Raleigh, NC", price: 310000, img: "🏢", type: "Condo", status: "In Progress", phase: "Escrow Open", daysOpen: 5, yourRole: "Escrow & Title", otherParty: "Priya Patel → Thanh Nguyen", checkDone: 4, checkTotal: 18 },
    { id: "TXN-04690", property: "217 Haywood Ave, Raleigh, NC", price: 340000, img: "🏗", type: "Multi-Family", status: "Closing", phase: "Final Disbursement", daysOpen: 28, yourRole: "Escrow & Title", otherParty: "Angela Brooks → Robert Fields", checkDone: 17, checkTotal: 18 },
  ],
  corp_buyer: [
    { id: "TXN-04821", property: "108 Oak Ridge Lane, Cary, NC", price: 589000, img: "🏠", type: "House", status: "In Progress", phase: "Inspection & Appraisal", daysOpen: 12, yourRole: "Corporate Buyer (Triangle Holdings LLC)", otherParty: "David Chen (Seller)", checkDone: 8, checkTotal: 18 },
    { id: "TXN-04899", property: "44 Magnolia Walk, Durham, NC", price: 275000, img: "🏘", type: "Townhome", status: "Offer Pending", phase: "Offer Review", daysOpen: 3, yourRole: "Corporate Buyer (Triangle Holdings LLC)", otherParty: "Sarah Williams (Agent)", checkDone: 2, checkTotal: 18 },
    { id: "TXN-05010", property: "920 Lake Wheeler Rd, Raleigh, NC", price: 1250000, img: "🏢", type: "Multi-Family", status: "Due Diligence", phase: "Environmental Review", daysOpen: 8, yourRole: "Corporate Buyer (Triangle Holdings LLC)", otherParty: "Greenway Properties Inc. (Corp Seller)", checkDone: 5, checkTotal: 18 },
  ],
  corp_seller: [
    { id: "TXN-04690", property: "217 Haywood Ave, Raleigh, NC", price: 340000, img: "🏗", type: "Multi-Family", status: "Closing", phase: "Final Walkthrough", daysOpen: 28, yourRole: "Corporate Seller (Brooks Realty Holdings LLC)", otherParty: "Robert Fields (Buyer)", checkDone: 17, checkTotal: 18 },
    { id: "TXN-05020", property: "4200 Six Forks Rd, Raleigh, NC", price: 1850000, img: "🏢", type: "Multi-Family", status: "Listed", phase: "Awaiting Offers", daysOpen: 5, yourRole: "Corporate Seller (Brooks Realty Holdings LLC)", otherParty: "No offers yet", checkDone: 1, checkTotal: 18 },
    { id: "TXN-04512", property: "88 Shoreline Dr, Wake Forest, NC", price: 725000, img: "🏡", type: "House", status: "Blocked", phase: "Seller Verification Pending", daysOpen: 18, yourRole: "Corporate Seller (Okafor Family Trust)", otherParty: "Samantha Lee (Buyer)", checkDone: 2, checkTotal: 18 },
  ],
};

function TransactionView({ onNavigate, user, collaboratorsByDeal = {} }) {
  const isCompact = useMediaQuery("(max-width: 820px)");
  const [activeDealId, setActiveDealId] = useState(null);
  const [checked, setChecked] = useState({});
  const [tab, setTab] = useState("checklist");
  const [dealFilter, setDealFilter] = useState("all");
  const [dealQuery, setDealQuery] = useState("");
  const [txDocsByDeal, setTxDocsByDeal] = useLocalStorageState("estatehat-tx-docs-v1", {});
  const [dealDecisions, setDealDecisions] = useLocalStorageState("estatehat-deal-decisions-v1", {});
  const [voidedDeals, setVoidedDeals] = useLocalStorageState("estatehat-voided-deals-v1", {});
  const canUploadDocs = !!PERMISSIONS[user.accountType]?.uploadDocs;

  const isBuyerType = useMemo(() => ["buyer", "corp_buyer"].includes(user.accountType), [user.accountType]);
  const canCancelSale = useMemo(() => ["buyer", "seller", "corp_buyer", "corp_seller"].includes(user.accountType), [user.accountType]);
  const isAdmin = user.accountType === "admin";
  const isRegulatoryRole = useMemo(
    () => ["attorney", "lender", "admin", "gov_municipality", "gov_township", "gov_county", "gov_borough", "gov_parish", "gov_state", "gov_territory", "gov_federal"].includes(user.accountType),
    [user.accountType]
  );
  const roleDeals = useMemo(() => ROLE_DEALS[user.accountType] || [], [user.accountType]);
  const buyerDeals = useMemo(() => USER_DEALS, []);
  const activeDeal = useMemo(() => (isBuyerType || isAdmin) ? buyerDeals.find((d) => d.id === activeDealId) : null, [isBuyerType, isAdmin, activeDealId, buyerDeals]);
  const txDocs = useMemo(() => {
    if (!activeDeal) return [];
    return txDocsByDeal[activeDeal.id] || [];
  }, [activeDeal, txDocsByDeal]);

  const decisionLabels = useMemo(() => ({
    approved: "Approved",
    declined: "Declined",
    revision: "Needs Revision",
  }), []);

  function buildDecisionKey(dealId, partyKey) {
    return `${dealId}::${partyKey}`;
  }

  function readDecision(dealId, partyKey) {
    return dealDecisions[buildDecisionKey(dealId, partyKey)] || null;
  }

  function writeDecision(dealId, partyKey, decision) {
    const next = {
      decision,
      decisionLabel: decisionLabels[decision] || decision,
      actorRole: user.accountType,
      actorName: user.name || "User",
      updatedAt: new Date().toISOString(),
    };
    setDealDecisions((prev) => ({
      ...prev,
      [buildDecisionKey(dealId, partyKey)]: next,
    }));
  }

  function isDealVoided(dealId) {
    return !!voidedDeals[dealId];
  }

  function cancelSale(deal) {
    if (!deal?.id || !canCancelSale) return;

    const firstWarning = `Cancel Sale will immediately void transaction ${deal.id}. This cannot be undone. You must restart the full process to continue. Continue?`;
    if (typeof window !== "undefined" && !window.confirm(firstWarning)) return;

    const secondWarning = "Final confirmation: void this transaction now?";
    if (typeof window !== "undefined" && !window.confirm(secondWarning)) return;

    const nowIso = new Date().toISOString();
    setVoidedDeals((prev) => ({
      ...prev,
      [deal.id]: {
        dealId: deal.id,
        property: deal.property,
        cancelledBy: user.name || "User",
        cancelledRole: user.accountType,
        cancelledAt: nowIso,
        reason: "Cancelled by party action. Restart required for any future sale attempt.",
      },
    }));

    setActiveDealId((current) => (current === deal.id ? null : current));

    if (typeof window !== "undefined") {
      window.alert("Transaction voided. This action cannot be undone. To proceed, start a new sale process from the beginning.");
    }
  }

  function addDocsForDeal(dealId, docs) {
    if (!dealId || !Array.isArray(docs) || docs.length === 0) return;
    const stamped = docs.map((doc) => ({
      ...doc,
      dealId,
      uploadedAt: new Date().toISOString(),
    }));
    setTxDocsByDeal((prev) => ({
      ...prev,
      [dealId]: [...(prev[dealId] || []), ...stamped],
    }));
  }

  function openDealFilePicker(dealId) {
    if (typeof document === "undefined" || !dealId) return;
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".pdf,.doc,.docx,.jpg,.jpeg,.png";
    input.onchange = (event) => {
      const files = Array.from(event.target?.files || []);
      if (!files.length) return;
      const normalized = files.map((f) => ({
        name: f.name,
        size: (f.size / 1024).toFixed(1) + " KB",
        type: f.type || "application/octet-stream",
        time: new Date().toLocaleTimeString(),
        status: "uploaded",
      }));
      addDocsForDeal(dealId, normalized);
    };
    input.click();
  }

  // When entering a buyer deal, load its checklist state
  useEffect(() => {
    if (activeDeal) setChecked(activeDeal.checklist);
  }, [activeDeal]);

  const toggleCheck = useCallback((key) => setChecked((prev) => ({ ...prev, [key]: !prev[key] })), []);
  const allDone = useMemo(() => TRANSACTION_CHECKLIST.every((i) => checked[i.key]), [checked]);
  const checkCount = useMemo(() => TRANSACTION_CHECKLIST.filter((i) => checked[i.key]).length, [checked]);
  const normalizedDealQuery = dealQuery.trim().toLowerCase();

  // ── Deal List (all roles) ──
  if (!activeDealId) {
    const summaryDeals = (isBuyerType || isAdmin) ? buyerDeals.map((d) => ({
      id: d.id, property: d.property, price: d.price, img: d.img, type: d.type, status: d.status, phase: d.phase, daysOpen: d.daysOpen,
      yourRole: isAdmin ? "Admin (Full Access)" : "Buyer", otherParty: d.parties.filter((p) => !p.you).map((p) => p.name).join(", "),
      checkDone: Object.values(d.checklist).filter(Boolean).length, checkTotal: Object.keys(d.checklist).length,
    })) : (roleDeals || []);

    const activeSummaryDeals = summaryDeals.filter((deal) => !isDealVoided(deal.id));
    const voidedSummaryDeals = summaryDeals.filter((deal) => isDealVoided(deal.id));
    const filteredDeals = activeSummaryDeals.filter((deal) => {
      const statusPass = dealFilter === "all"
        || (dealFilter === "attention" && (deal.status === "Blocked" || (deal.checkDone / deal.checkTotal) < 0.45))
        || deal.status.toLowerCase() === dealFilter
        || deal.phase.toLowerCase() === dealFilter;
      const textPass = !normalizedDealQuery || [deal.id, deal.property, deal.type, deal.status, deal.phase, deal.otherParty]
        .join(" ")
        .toLowerCase()
        .includes(normalizedDealQuery);
      return statusPass && textPass;
    });
    const totalValue = activeSummaryDeals.reduce((s, d) => s + d.price, 0);
    const nearestCloseDeal = activeSummaryDeals.length > 0
      ? [...activeSummaryDeals].sort((a, b) => (b.checkDone / b.checkTotal) - (a.checkDone / a.checkTotal))[0]
      : null;
    const attentionDeals = activeSummaryDeals
      .filter((deal) => deal.status === "Blocked" || (deal.checkDone / deal.checkTotal) < 0.45)
      .sort((a, b) => (a.checkDone / a.checkTotal) - (b.checkDone / b.checkTotal));
    const averageReadiness = activeSummaryDeals.length
      ? Math.round(activeSummaryDeals.reduce((sum, deal) => sum + (deal.checkDone / deal.checkTotal), 0) / activeSummaryDeals.length * 100)
      : 0;
    const totalUploadedDocs = activeSummaryDeals.reduce((sum, deal) => sum + (txDocsByDeal[deal.id] || []).length, 0);
    const liveCollaborators = activeSummaryDeals.reduce((sum, deal) => sum + (collaboratorsByDeal[deal.id] || []).length, 0);
    const dashboardTone = attentionDeals.length > 0 ? S.red : S.green;

    return (
      <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
        <SectionHeader title="My Active Hats" sub={`${activeSummaryDeals.length} active transaction${activeSummaryDeals.length !== 1 ? "s" : ""} · Total value: ${fmt(totalValue)}`} />

        <Card
          style={{
            marginBottom: 18,
            padding: isCompact ? 18 : 22,
            background: `linear-gradient(145deg, ${S.dark}, #24364C)`,
            color: "#fff",
            border: "none",
            boxShadow: "0 20px 44px rgba(18, 28, 43, 0.22)",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1.45fr 1fr", gap: 18, alignItems: "stretch" }}>
            <div>
              <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: 1.6, textTransform: "uppercase", color: "rgba(255,255,255,0.72)", marginBottom: 10 }}>
                Deal Command Center
              </div>
              <div style={{ fontFamily: S.serif, fontSize: isCompact ? 28 : 34, lineHeight: 1.02, marginBottom: 10 }}>
                Keep every live transaction moving without hunting through screens.
              </div>
              <div style={{ fontFamily: S.font, fontSize: 14, lineHeight: 1.7, color: "rgba(255,255,255,0.8)", maxWidth: 520 }}>
                Track readiness, surface blocked files, and jump into the next deal that needs attention.
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
                <button onClick={() => onNavigate("browse")} style={{ ...S.btn(S.gold, S.dark), padding: "10px 16px" }}>Find another property</button>
                <button onClick={() => setDealFilter("attention")} style={{ ...S.btn("rgba(255,255,255,0.08)", "#fff"), border: "1px solid rgba(255,255,255,0.18)", padding: "10px 16px" }}>
                  Review attention queue
                </button>
              </div>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ borderRadius: 18, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div>
                    <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: "rgba(255,255,255,0.64)" }}>
                      Portfolio Health
                    </div>
                    <div style={{ fontFamily: S.serif, fontSize: 28, lineHeight: 1.05, marginTop: 6 }}>{averageReadiness}%</div>
                  </div>
                  <div style={{ width: 58, height: 58, borderRadius: "50%", border: `3px solid ${dashboardTone}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: S.font, fontWeight: 800, color: dashboardTone }}>
                    {attentionDeals.length}
                  </div>
                </div>
                <div style={{ fontFamily: S.font, fontSize: 12, lineHeight: 1.55, color: "rgba(255,255,255,0.78)", marginTop: 10 }}>
                  {attentionDeals.length > 0 ? `${attentionDeals.length} deal${attentionDeals.length !== 1 ? "s" : ""} need immediate action.` : "All live deals are advancing cleanly right now."}
                </div>
              </div>
              <div style={{ borderRadius: 18, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", padding: 16 }}>
                <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: "rgba(255,255,255,0.64)", marginBottom: 10 }}>
                  Immediate Focus
                </div>
                {nearestCloseDeal ? (
                  <div>
                    <div style={{ fontFamily: S.font, fontSize: 14, fontWeight: 700, color: "#fff" }}>{nearestCloseDeal.property}</div>
                    <div style={{ fontFamily: S.font, fontSize: 12, lineHeight: 1.5, color: "rgba(255,255,255,0.78)", marginTop: 5 }}>
                      {Math.round((nearestCloseDeal.checkDone / nearestCloseDeal.checkTotal) * 100)}% ready · {nearestCloseDeal.phase} · {nearestCloseDeal.daysOpen} days open
                    </div>
                  </div>
                ) : (
                  <div style={{ fontFamily: S.font, fontSize: 12, lineHeight: 1.5, color: "rgba(255,255,255,0.78)" }}>
                    No live deals yet. Start from Browse Listings to open a transaction.
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Summary Stats */}
        <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr 1fr" : "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
          {[
            ["Active Deals", activeSummaryDeals.length, S.gold],
            ["Total Value", fmt(totalValue), S.dark],
            ["Docs Uploaded", totalUploadedDocs, S.gold],
            ["Live Team Seats", liveCollaborators, S.green],
          ].map(([label, val, color]) => (
            <div key={label} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: 16, borderLeft: `4px solid ${color}` }}>
              <div style={{ fontFamily: S.serif, fontSize: 22, color, lineHeight: 1.2 }}>{val}</div>
              <div style={{ fontFamily: S.font, fontSize: 11, color: S.light, marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>

        <Card style={{ marginBottom: 18, padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1.2fr auto", gap: 12, alignItems: "center" }}>
            <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1fr auto", gap: 12, alignItems: "center" }}>
              <input
                value={dealQuery}
                onChange={(event) => setDealQuery(event.target.value)}
                placeholder="Search transaction, property, party, or phase"
                style={{ ...S.input, margin: 0 }}
              />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  ["all", "All"],
                  ["attention", "Attention"],
                  ["in progress", "In Progress"],
                  ["offer pending", "Offer Pending"],
                  ["closing", "Closing"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDealFilter(value)}
                    style={{
                      ...S.btn(dealFilter === value ? S.gold : S.surfaceAlt, dealFilter === value ? S.dark : S.muted),
                      border: `1px solid ${dealFilter === value ? S.gold : S.border}`,
                      padding: "8px 12px",
                      fontSize: 11.5,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.light, textAlign: isCompact ? "left" : "right" }}>
              Showing {filteredDeals.length} of {activeSummaryDeals.length} active deals
            </div>
          </div>
        </Card>

        {attentionDeals.length > 0 && (
          <Card style={{ marginBottom: 18, borderLeft: `4px solid ${S.red}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div>
                <div style={{ fontFamily: S.font, fontWeight: 800, fontSize: 14, color: S.dark }}>Attention Queue</div>
                <div style={{ fontFamily: S.font, fontSize: 12, color: S.light, marginTop: 4 }}>Low-readiness or blocked transactions are surfaced here first.</div>
              </div>
              <Badge variant="warn">{attentionDeals.length} flagged</Badge>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {attentionDeals.slice(0, 3).map((deal) => (
                <div key={`attention-${deal.id}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: "12px 14px", borderRadius: 12, background: S.redBg, border: `1px solid ${S.red}33` }}>
                  <div>
                    <div style={{ fontFamily: S.font, fontSize: 13, fontWeight: 700, color: S.dark }}>{deal.property}</div>
                    <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.red, marginTop: 4 }}>
                      {deal.status === "Blocked" ? "Blocked transaction" : `${Math.round((deal.checkDone / deal.checkTotal) * 100)}% ready`} · {deal.phase}
                    </div>
                  </div>
                  <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.muted, textAlign: "right" }}>
                    {deal.daysOpen} days open
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {activeSummaryDeals.length === 0 && (
          <Card style={{ textAlign: "center", padding: 48 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
            <div style={{ fontFamily: S.serif, fontSize: 22, color: S.dark, marginBottom: 8 }}>No Active Deals</div>
            <div style={{ fontFamily: S.font, fontSize: 14, color: S.light, marginBottom: 20 }}>
              You don't have any active transactions yet. Browse listings to get started.
            </div>
            <button onClick={() => onNavigate("browse")} style={{ ...S.btn(S.gold, S.dark), padding: "12px 28px" }}>Browse Listings</button>
          </Card>
        )}

        {/* Deal Cards */}
        {activeSummaryDeals.length > 0 && filteredDeals.length === 0 && (
          <Card style={{ textAlign: "center", padding: 32, marginBottom: 14 }}>
            <div style={{ fontFamily: S.serif, fontSize: 22, color: S.dark, marginBottom: 8 }}>No deals match this view</div>
            <div style={{ fontFamily: S.font, fontSize: 14, color: S.light, marginBottom: 18 }}>
              Clear the search or switch filters to bring more transactions back into scope.
            </div>
            <button onClick={() => { setDealFilter("all"); setDealQuery(""); }} style={{ ...S.btn(S.gold, S.dark), padding: "10px 18px" }}>
              Reset filters
            </button>
          </Card>
        )}

        {filteredDeals.map((deal) => {
          const pct = Math.round((deal.checkDone / deal.checkTotal) * 100);
          const fee = calcFees(deal.price);
          const myDecision = readDecision(deal.id, user.accountType);
          const uploadedCount = (txDocsByDeal[deal.id] || []).length;
          const matchedTeam = collaboratorsByDeal[deal.id] || [];
          return (
            <Card
              key={deal.id}
              onClick={() => (isBuyerType || isAdmin) ? setActiveDealId(deal.id) : null}
              style={{
                marginBottom: 14, cursor: (isBuyerType || isAdmin) ? "pointer" : "default",
                borderLeft: `4px solid ${deal.status === "Closing" ? S.green : deal.status === "Offer Pending" ? S.gold : deal.status === "Blocked" ? S.red : "#378ADD"}`,
                transition: "box-shadow 0.2s",
              }}
            >
              <div style={{ display: "flex", gap: 16, alignItems: "start" }}>
                {/* Property Preview */}
                <div style={{ width: 80, height: 80, borderRadius: 12, background: `linear-gradient(135deg, ${S.mid}, ${S.muted})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, flexShrink: 0 }}>
                  {deal.img}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 6 }}>
                    <div>
                      <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark }}>{deal.property}</div>
                      <div style={{ fontFamily: S.font, fontSize: 12, color: S.light, marginTop: 2 }}>
                        {deal.id} · {deal.type} · {deal.daysOpen} days open
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <Badge variant={deal.status === "Closing" ? "verified" : deal.status === "Offer Pending" ? "type" : deal.status === "Blocked" ? "warn" : "default"}>{deal.status}</Badge>
                    </div>
                  </div>

                  {/* Role Tag */}
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                    <Badge variant="role">Your role: {deal.yourRole}</Badge>
                    <span style={{ fontFamily: S.font, fontSize: 12, color: S.light }}>
                      {deal.otherParty}
                    </span>
                    {canCancelSale && (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          cancelSale(deal);
                        }}
                        style={{ ...S.btn(S.red, "#fff"), padding: "5px 10px", fontSize: 11, marginLeft: "auto" }}
                      >
                        Cancel Sale
                      </button>
                    )}
                  </div>

                  {/* Metrics Row */}
                  <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                    {[
                      ["Price", fmt(deal.price)],
                      ["Buyer Fee", fmt(fee.processingFee)],
                      ["Buyer Total", fmt(fee.buyerTotal)],
                      ["Phase", deal.phase],
                    ].map(([k, v]) => (
                      <div key={k} style={{ background: S.surfaceAlt, borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                        <div style={{ fontFamily: S.font, fontSize: 14, fontWeight: 700, color: S.dark }}>{v}</div>
                        <div style={{ fontFamily: S.font, fontSize: 10, color: S.light }}>{k}</div>
                      </div>
                    ))}
                  </div>
                  <ProgressBar value={deal.checkDone} max={deal.checkTotal} color={deal.status === "Closing" ? S.green : S.gold} />
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginTop: 8 }}>
                    <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.light }}>
                      Readiness: <span style={{ color: pct >= 75 ? S.green : pct < 45 ? S.red : S.gold, fontWeight: 700 }}>{pct}%</span>
                    </div>
                    <div style={{ fontFamily: S.font, fontSize: 11.5, color: pct < 45 || deal.status === "Blocked" ? S.red : S.muted }}>
                      {deal.status === "Blocked" ? "Needs unblock before closing work can continue." : pct < 45 ? "Early-stage transaction. More filings required." : "Advancing toward closing."}
                    </div>
                  </div>
                  {matchedTeam.length > 0 && (
                    <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: S.surfaceAlt, border: `1px solid ${S.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <div style={{ fontFamily: S.font, fontSize: 12, fontWeight: 700, color: S.dark }}>Matched Team</div>
                        <Badge variant="verified">{matchedTeam.length} attached</Badge>
                      </div>
                      <div style={{ fontFamily: S.font, fontSize: 12, color: S.muted, lineHeight: 1.5 }}>
                        {matchedTeam.map((member) => `${member.name} (${member.role})${member.linkedin ? " · LinkedIn" : ""}`).join(", ")}
                      </div>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          onNavigate("messages", { dealId: deal.id });
                        }}
                        style={{ ...S.btn(S.surfaceAlt, S.dark), border: `1px solid ${S.border}`, marginTop: 8, padding: "6px 10px", fontSize: 11.5 }}
                      >
                        Open attached conversation
                      </button>
                    </div>
                  )}
                  <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: S.surfaceAlt, border: `1px solid ${S.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <div style={{ fontFamily: S.font, fontSize: 12, fontWeight: 700, color: S.dark }}>Sale Decision</div>
                      <Badge variant={myDecision?.decision === "approved" ? "verified" : myDecision?.decision === "declined" ? "warn" : myDecision?.decision === "revision" ? "type" : "default"}>
                        {myDecision?.decisionLabel || "No decision"}
                      </Badge>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {[
                        { key: "approved", label: "Approve", bg: S.green, color: "#fff" },
                        { key: "declined", label: "Decline", bg: S.red, color: "#fff" },
                        { key: "revision", label: "Needs Revision", bg: S.gold, color: S.dark },
                      ].map((choice) => (
                        <button
                          key={choice.key}
                          onClick={(event) => {
                            event.stopPropagation();
                            writeDecision(deal.id, user.accountType, choice.key);
                          }}
                          style={{
                            ...S.btn(choice.bg, choice.color),
                            padding: "6px 12px",
                            fontSize: 11.5,
                            opacity: myDecision?.decision === choice.key ? 1 : 0.86,
                          }}
                        >
                          {choice.label}
                        </button>
                      ))}
                    </div>
                    <div style={{ fontFamily: S.font, fontSize: 11, color: S.light, marginTop: 7, lineHeight: 1.45 }}>
                      {myDecision
                        ? `Last updated ${formatProfileDate(myDecision.updatedAt)} by ${myDecision.actorName} (${myDecision.actorRole}).`
                        : "Record your decision for this in-process sale."}
                    </div>
                    {isRegulatoryRole && (
                      <div style={{ fontFamily: S.font, fontSize: 10.8, color: S.muted, marginTop: 6 }}>
                        Regulatory role decision is logged for compliance traceability.
                      </div>
                    )}
                  </div>
                  {(isBuyerType || isAdmin) && (
                    <div style={{ fontFamily: S.font, fontSize: 12, color: S.gold, fontWeight: 600, marginTop: 8 }}>
                      Click to view full transaction details →
                    </div>
                  )}
                  {canUploadDocs && (
                    <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: S.surfaceAlt, border: `1px solid ${S.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <div style={{ fontFamily: S.font, fontSize: 12, fontWeight: 700, color: S.dark }}>Transaction Documents</div>
                        <Badge variant={uploadedCount > 0 ? "verified" : "warn"}>{uploadedCount} uploaded</Badge>
                      </div>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          openDealFilePicker(deal.id);
                        }}
                        style={{ ...S.btn(S.surfaceAlt, S.dark), border: `1px solid ${S.border}`, padding: "7px 12px", fontSize: 12 }}
                      >
                        Upload Documents
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}

        {voidedSummaryDeals.length > 0 && (
          <Card style={{ marginTop: 14, borderLeft: `4px solid ${S.red}` }}>
            <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 14, color: S.dark, marginBottom: 8 }}>Voided Transactions</div>
            <div style={{ display: "grid", gap: 8 }}>
              {voidedSummaryDeals.map((deal) => {
                const meta = voidedDeals[deal.id];
                return (
                  <div key={`voided-${deal.id}`} style={{ padding: "10px 12px", borderRadius: 10, background: S.redBg, border: `1px solid ${S.red}44` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <div>
                        <div style={{ fontFamily: S.font, fontSize: 13, fontWeight: 700, color: S.dark }}>{deal.id} · {deal.property}</div>
                        <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.red, marginTop: 4 }}>
                          Voided by {meta?.cancelledBy || "User"} ({meta?.cancelledRole || "role"}) on {meta?.cancelledAt ? formatProfileDate(meta.cancelledAt) : "Unknown"}.
                        </div>
                        <div style={{ fontFamily: S.font, fontSize: 11, color: S.muted, marginTop: 4 }}>
                          This action cannot be undone. Restart the full process for a new transaction.
                        </div>
                      </div>
                      <Badge variant="warn">Voided</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    );
  }

  // ── Single Deal Detail (buyer / admin only) ──
  const deal = activeDeal;
  const fee = calcFees(deal.price);
  const voidedMeta = voidedDeals[deal.id];

  if (voidedMeta) {
    return (
      <div style={{ maxWidth: 820, margin: "0 auto", padding: 24 }}>
        <button onClick={() => setActiveDealId(null)} style={{ background: "none", border: "none", fontFamily: S.font, fontSize: 14, color: S.gold, cursor: "pointer", fontWeight: 600, marginBottom: 16, padding: 0 }}>
          ← Back to My Active Hats
        </button>
        <Card style={{ borderLeft: `4px solid ${S.red}` }}>
          <div style={{ fontFamily: S.serif, fontSize: 28, color: S.dark, marginBottom: 8 }}>Transaction Voided</div>
          <div style={{ fontFamily: S.font, fontSize: 13.5, color: S.red, marginBottom: 10 }}>
            {deal.id} · {deal.property}
          </div>
          <div style={{ fontFamily: S.font, fontSize: 13, color: S.muted, lineHeight: 1.65, marginBottom: 12 }}>
            This sale was cancelled by {voidedMeta.cancelledBy} ({voidedMeta.cancelledRole}) on {formatProfileDate(voidedMeta.cancelledAt)}.
            The cancellation is immediate and cannot be undone.
          </div>
          <div style={{ padding: "10px 12px", borderRadius: 10, background: S.redBg, border: `1px solid ${S.red}44`, fontFamily: S.font, fontSize: 12.5, color: S.red }}>
            To continue with this property, restart the full sale process from the beginning.
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: 24 }}>
      <button onClick={() => setActiveDealId(null)} style={{ background: "none", border: "none", fontFamily: S.font, fontSize: 14, color: S.gold, cursor: "pointer", fontWeight: 600, marginBottom: 16, padding: 0 }}>
        ← Back to My Active Hats
      </button>

      {/* Deal Header */}
      <Card style={{ marginBottom: 20, display: "flex", gap: 20, alignItems: "center" }}>
        <div style={{ width: 80, height: 80, borderRadius: 14, background: `linear-gradient(135deg, ${S.mid}, ${S.muted})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, flexShrink: 0 }}>
          {deal.img}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: S.serif, fontSize: 22, color: S.dark, marginBottom: 2 }}>{deal.property}</div>
          <div style={{ fontFamily: S.font, fontSize: 13, color: S.light }}>{deal.id} · {deal.type} · {deal.beds} bed / {deal.baths} bath / {deal.sqft.toLocaleString()} sqft</div>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <Badge variant={deal.status === "Closing" ? "verified" : deal.status === "Offer Pending" ? "type" : "default"}>{deal.status}</Badge>
            <Badge variant="role">Phase: {deal.phase}</Badge>
            <span style={{ fontFamily: S.font, fontSize: 12, color: S.light }}>{deal.daysOpen} days · Est. close: {deal.estClose}</span>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontFamily: S.serif, fontSize: 26, color: S.dark }}>{fmt(deal.price)}</div>
          <div style={{ fontFamily: S.font, fontSize: 12, color: S.gold, fontWeight: 600 }}>Fee: {fmt(fee.processingFee)}</div>
          {canCancelSale && (
            <button
              onClick={() => cancelSale(deal)}
              style={{ ...S.btn(S.red, "#fff"), marginTop: 10, padding: "7px 12px", fontSize: 11.5 }}
            >
              Cancel Sale
            </button>
          )}
        </div>
      </Card>

      <TabBar
        tabs={[
          { key: "checklist", label: "Validation Checklist", icon: "✅" },
          { key: "timeline", label: "Timeline", icon: "📅" },
          { key: "payments", label: "Payments & Escrow", icon: "💰" },
          { key: "parties", label: "Parties", icon: "👥" },
          { key: "documents", label: "Documents", icon: "📄" },
        ]}
        active={tab}
        onSelect={setTab}
      />

      {tab === "checklist" && (
        <div>
          <Card style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: 0 }}>Closing Validation</h3>
              <Badge variant={allDone ? "verified" : "warn"}>{checkCount}/{TRANSACTION_CHECKLIST.length} Complete</Badge>
            </div>
            <ProgressBar value={checkCount} max={TRANSACTION_CHECKLIST.length} color={allDone ? S.green : S.gold} />
            {!allDone && (
              <div style={{ marginTop: 10, padding: "10px 14px", background: S.redBg, borderRadius: 10, fontFamily: S.font, fontSize: 12, color: S.red, lineHeight: 1.5 }}>
                ⚠️ <strong>CLOSING BLOCKED:</strong> All {TRANSACTION_CHECKLIST.length} items must be completed. {TRANSACTION_CHECKLIST.length - checkCount} remaining.
              </div>
            )}
            {allDone && (
              <div style={{ marginTop: 10, padding: "10px 14px", background: S.greenBg, borderRadius: 10, fontFamily: S.font, fontSize: 12, color: S.green, lineHeight: 1.5 }}>
                ✅ <strong>ALL CHECKS PASSED.</strong> Transaction cleared for closing.
              </div>
            )}
          </Card>
          {[...new Set(TRANSACTION_CHECKLIST.map((i) => i.category))].map((cat) => (
            <Card key={cat} style={{ marginBottom: 12, padding: 18 }}>
              <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: S.light, marginBottom: 10 }}>{cat}</div>
              {TRANSACTION_CHECKLIST.filter((i) => i.category === cat).map((item) => (
                <div key={item.key} onClick={() => toggleCheck(item.key)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${S.surface}`, cursor: "pointer" }}>
                  <div style={{ width: 24, height: 24, borderRadius: 7, border: checked[item.key] ? "none" : `2px solid ${S.borderStrong}`, background: checked[item.key] ? S.green : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700, flexShrink: 0, transition: "all 0.2s" }}>
                    {checked[item.key] && "✓"}
                  </div>
                  <span style={{ fontFamily: S.font, fontSize: 14, color: checked[item.key] ? S.light : S.dark, fontWeight: checked[item.key] ? 400 : 600, textDecoration: checked[item.key] ? "line-through" : "none" }}>{item.label}</span>
                </div>
              ))}
            </Card>
          ))}
          {allDone && <button style={{ ...S.btn(S.green, "#fff"), width: "100%", padding: "16px", fontSize: 16, marginTop: 12 }}>🔒 Finalize Closing & Disburse Funds</button>}
        </div>
      )}

      {tab === "timeline" && (
        <Card>
          <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: "0 0 16px" }}>Transaction Timeline</h3>
          {deal.timeline.map((ev, i) => (
            <div key={i} style={{ display: "flex", gap: 14, padding: "12px 0", borderBottom: i < deal.timeline.length - 1 ? "1px solid #F0EBE3" : "none" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20, flexShrink: 0, marginTop: 2 }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: ev.status === "Complete" ? S.green : ev.status === "Pending" ? S.gold : "#C9C0B4", flexShrink: 0 }} />
                {i < deal.timeline.length - 1 && <div style={{ width: 2, flex: 1, background: "#E8E3DA", marginTop: 4 }} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: S.font, fontSize: 14, fontWeight: 600, color: S.dark }}>{ev.label}</div>
                <div style={{ fontFamily: S.font, fontSize: 12, color: S.light }}>{ev.date}</div>
              </div>
              <Badge variant={ev.status === "Complete" ? "verified" : ev.status === "Pending" ? "type" : "default"}>{ev.status}</Badge>
            </div>
          ))}
        </Card>
      )}

      {tab === "payments" && (() => {
        return (
          <div>
            <FeeBreakdown price={deal.price} />
            <Card style={{ marginTop: 16, marginBottom: 16 }}>
              <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: "0 0 16px" }}>Escrow Account</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
                {[["In Escrow", fmt(deal.escrowBalance), S.gold], ["Sale Price", fmt(deal.price), S.dark], ["Buyer Fee", fmt(fee.processingFee), S.gold]].map(([label, val, color]) => (
                  <div key={label} style={{ textAlign: "center", padding: 16, background: S.surfaceAlt, borderRadius: 12 }}>
                    <div style={{ fontFamily: S.serif, fontSize: 22, color }}>{val}</div>
                    <div style={{ fontFamily: S.font, fontSize: 11, color: S.light }}>{label}</div>
                  </div>
                ))}
              </div>
              <button style={{ ...S.btn(S.gold, S.dark), width: "100%", padding: "14px" }}>Wire Funds to Escrow →</button>
              <div style={{ marginTop: 12, padding: "10px 14px", background: S.greenBg, borderRadius: 10, fontFamily: S.font, fontSize: 12, color: S.green, lineHeight: 1.5 }}>
                🔒 Buyer pays the EstateHat fee ({FEE_LABEL}) by default as a separate transaction line item above sale price. Seller may elect to absorb that fee instead.
              </div>
            </Card>
          </div>
        );
      })()}

      {tab === "parties" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {deal.parties.map((p) => (
            <Card key={p.name}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: p.you ? S.goldBg : "#F0EBE3", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                  {ACCOUNT_TYPES.find((t) => t.key === p.role)?.icon || "👤"}
                </div>
                <div>
                  <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 15, color: S.dark }}>
                    {p.name} {p.you && <span style={{ color: S.gold, fontSize: 12 }}>(You)</span>}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Badge variant="role">{p.role}</Badge>
                    {p.verified && <Badge variant="verified">✓ Verified</Badge>}
                  </div>
                </div>
              </div>
              {(() => {
                const partyKey = `${p.role}:${p.name}`;
                const decision = readDecision(deal.id, partyKey);
                const canAct = p.you || isAdmin;
                return (
                  <div style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${S.border}`, background: S.surfaceAlt }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <div style={{ fontFamily: S.font, fontSize: 12, fontWeight: 700, color: S.dark }}>Transaction Decision</div>
                      <Badge variant={decision?.decision === "approved" ? "verified" : decision?.decision === "declined" ? "warn" : decision?.decision === "revision" ? "type" : "default"}>
                        {decision?.decisionLabel || "Pending"}
                      </Badge>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {[
                        { key: "approved", label: "Approve", bg: S.green, color: "#fff" },
                        { key: "declined", label: "Decline", bg: S.red, color: "#fff" },
                        { key: "revision", label: "Needs Revision", bg: S.gold, color: S.dark },
                      ].map((choice) => (
                        <button
                          key={`${partyKey}-${choice.key}`}
                          disabled={!canAct}
                          onClick={() => canAct && writeDecision(deal.id, partyKey, choice.key)}
                          style={{
                            ...S.btn(choice.bg, choice.color),
                            padding: "6px 12px",
                            fontSize: 11.5,
                            opacity: !canAct ? 0.45 : decision?.decision === choice.key ? 1 : 0.86,
                            cursor: canAct ? "pointer" : "not-allowed",
                          }}
                        >
                          {choice.label}
                        </button>
                      ))}
                    </div>
                    <div style={{ fontFamily: S.font, fontSize: 11, color: S.light, marginTop: 7 }}>
                      {decision
                        ? `Last updated ${formatProfileDate(decision.updatedAt)} by ${decision.actorName} (${decision.actorRole}).`
                        : canAct
                          ? "Choose Approve, Decline, or Needs Revision."
                          : "This party must submit their own decision."}
                    </div>
                  </div>
                );
              })()}
            </Card>
          ))}
        </div>
      )}

      {tab === "documents" && (
        <Card>
          <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: "0 0 12px" }}>Transaction Documents</h3>
          <FileUploadZone
            accept="PDF, DOCX, JPG — Contracts, disclosures, reports"
            onUpload={(newFiles) => addDocsForDeal(deal.id, newFiles)}
            files={txDocs}
          />
          <div style={{ marginTop: 16 }}>
            <div style={{ fontFamily: S.font, fontSize: 12, fontWeight: 700, color: S.dark, marginBottom: 8 }}>Required Documents</div>
            {["Purchase Agreement", "Seller Disclosure", "Inspection Report", "Appraisal Report", "Title Report", "Proof of Insurance", "Closing Disclosure"].map((d, i) => (
              <div key={d} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${S.surface}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: i < txDocs.length ? S.green : "#C9C0B4" }}>{i < txDocs.length ? "✓" : "○"}</span>
                  <span style={{ fontFamily: S.font, fontSize: 13, color: S.dark }}>{d}</span>
                </div>
                {i < txDocs.length ? <Badge variant="verified">Uploaded</Badge> : <Badge variant="warn">Missing</Badge>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── LIST PROPERTY ───────────────────────

function ListPropertyView({ onNavigate, user, onSyncJurisdiction }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    title: "",
    address: "",
    city: "",
    state: "",
    county: "",
    municipality: "",
    zip: "",
    price: "",
    beds: "",
    baths: "",
    sqft: "",
    type: "House",
    description: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submittedListingId, setSubmittedListingId] = useState("");
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [promotionBusy, setPromotionBusy] = useState(false);
  const [promotionError, setPromotionError] = useState("");
  const [addressVerified, setAddressVerified] = useState(false);
  const [listDocs, setListDocs] = useState([]);
  const [exteriorPhotos, setExteriorPhotos] = useState([]);
  const [interiorPhotos, setInteriorPhotos] = useState([]);
  const [sellerFeeLines, setSellerFeeLines] = useState([]);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const parsedPrice = Math.max(0, Number(form.price || 0));
  const listingFees = calcFees(parsedPrice, { sellerFeeLines });

  function addSellerFeeLine() {
    setSellerFeeLines((current) => [
      ...current,
      { id: `seller-fee-${Date.now()}-${current.length}`, label: "", mode: "amount", value: "" },
    ]);
  }

  function updateSellerFeeLine(id, patch) {
    setSellerFeeLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line));
  }

  function removeSellerFeeLine(id) {
    setSellerFeeLines((current) => current.filter((line) => line.id !== id));
  }

  const MIN_EXTERIOR = 4;
  const MIN_INTERIOR = 6;
  const exteriorOk = exteriorPhotos.length >= MIN_EXTERIOR;
  const interiorOk = interiorPhotos.length >= MIN_INTERIOR;
  const photosOk = exteriorOk && interiorOk;

  const allValidations = [
    { label: "Address verified via mapping service", ok: addressVerified },
    { label: "Seller identity verified", ok: true },
    { label: `Exterior photos uploaded (${exteriorPhotos.length}/${MIN_EXTERIOR} minimum)`, ok: exteriorOk },
    { label: `Interior photos uploaded (${interiorPhotos.length}/${MIN_INTERIOR} minimum)`, ok: interiorOk },
    { label: "Disclosure documents uploaded", ok: listDocs.length > 0 },
    { label: "Pricing within market range", ok: !!form.price },
    { label: "Photos pending third-party review", ok: photosOk, info: true },
  ];
  const canPublish = allValidations.filter((v) => !v.info).every((v) => v.ok);
  const syncJurisdictionForListing = async () => {
    const inferred = inferJurisdictionFromAddress(`${form.address}, ${form.city}, ${form.state} ${form.zip}`.trim());
    const jurisdiction = {
      state: (form.state || inferred.state || "").trim().toUpperCase(),
      city: (form.city || inferred.city || "").trim(),
      county: (form.county || inferred.county || "").trim(),
      municipality: (form.municipality || inferred.municipality || "").trim(),
    };
    if (!jurisdiction.state && !jurisdiction.city && !jurisdiction.county && !jurisdiction.municipality) return;
    await onSyncJurisdiction?.(jurisdiction);
  };

  if (!user) {
    return (
      <div style={{ maxWidth: 620, margin: "0 auto", padding: 24 }}>
        <Card>
          <div style={{ fontFamily: S.serif, fontSize: 26, color: S.dark, marginBottom: 8 }}>Sign in required</div>
          <p style={{ fontFamily: S.font, fontSize: 14, color: S.muted, lineHeight: 1.7, margin: "0 0 14px" }}>
            You need an EstateHat account before you can post or manage listings.
          </p>
          <button onClick={() => onNavigate("dashboard")} style={{ ...S.btn(S.mid, S.card) }}>
            Return to dashboard
          </button>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{ maxWidth: 500, margin: "80px auto", textAlign: "center", padding: 24 }}>
        <div style={{ fontSize: 56, marginBottom: 20 }}>🎉</div>
        <h2 style={{ fontFamily: S.serif, fontSize: 30, color: S.dark, marginBottom: 10 }}>Submitted for Review!</h2>
        <p style={{ fontFamily: S.font, fontSize: 15, color: S.muted, lineHeight: 1.6, marginBottom: 12 }}>
          Your listing for <strong>{form.title || "your property"}</strong> has been submitted. Before it goes live, an EstateHat reviewer (not the buyer or seller) will verify your photos and documents.
        </p>
        <div style={{ background: S.greenBg, borderRadius: 12, padding: 16, textAlign: "left", marginBottom: 24, fontFamily: S.font, fontSize: 13, color: S.green, lineHeight: 1.6 }}>
  ✅ {exteriorPhotos.length} exterior photos submitted<br />
  ✅ {interiorPhotos.length} interior photos submitted<br />
  ✅ {listDocs.length} document{listDocs.length !== 1 ? "s" : ""} submitted<br />
  🗂 Submission ID: {submittedListingId || "Pending"}<br />
  🔍 Awaiting third-party verification (typically 24–48 hours)
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          <button
            onClick={async () => {
              if (!submittedListingId) return;
              setPromotionBusy(true);
              setPromotionError("");
              try {
                const payload = await postStripeAction("featured-placement-checkout", {
                  placementType: "listing",
                  submissionId: submittedListingId,
                  acknowledged: true,
                }, { auth });
                redirectToStripeUrl(payload.url);
              } catch (error) {
                setPromotionError(error instanceof Error ? error.message : "Unable to start featured listing checkout.");
              } finally {
                setPromotionBusy(false);
              }
            }}
            disabled={!submittedListingId || promotionBusy}
            style={{ ...S.btn(!submittedListingId || promotionBusy ? "#C9C0B4" : S.dark, !submittedListingId || promotionBusy ? "#999" : S.card), padding: "14px 32px", fontSize: 15, opacity: !submittedListingId || promotionBusy ? 0.6 : 1, cursor: !submittedListingId || promotionBusy ? "not-allowed" : "pointer" }}
          >
            {promotionBusy ? "Opening Stripe Checkout…" : `Feature This Listing • ${FEATURED_LISTING_PRICE_LABEL}`}
          </button>
          <div style={{ fontFamily: S.font, fontSize: 12, color: S.light, lineHeight: 1.55 }}>
            Paid featured placement pins this property higher in Browse once the review queue publishes it live.
          </div>
          {promotionError && (
            <div style={{ padding: "10px 12px", borderRadius: 10, background: S.redBg, fontFamily: S.font, fontSize: 12, color: S.red }}>
              {promotionError}
            </div>
          )}
          <button onClick={() => onNavigate("browse")} style={{ ...S.btn(S.gold, S.dark), padding: "14px 32px", fontSize: 15 }}>View All Listings</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 620, margin: "0 auto", padding: 24 }}>
      <SectionHeader title="List Your Property" sub="Sell directly to verified buyers — no agents, no commissions." />
      <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
        {["Details", "Photos", "Documents", "Review"].map((s, i) => (
          <div key={s} style={{ flex: 1, textAlign: "center" }}>
            <div style={{ height: 4, borderRadius: 2, background: i + 1 <= step ? S.gold : "#E8E3DA", marginBottom: 6, transition: "background 0.3s" }} />
            <span style={{ fontFamily: S.font, fontSize: 11, color: i + 1 <= step ? S.gold : "#B5AA98", fontWeight: 600 }}>{s}</span>
          </div>
        ))}
      </div>

      {/* STEP 1: Details */}
      {step === 1 && (
        <Card>
          <label style={S.label}>Property Title</label>
          <input value={form.title} onChange={set("title")} placeholder="e.g., Charming Ranch in North Hills" style={S.input} />
          <label style={S.label}>Address</label>
          <input value={form.address} onChange={set("address")} placeholder="Full street address with ZIP" style={S.input} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={S.label}>City</label><input value={form.city} onChange={set("city")} placeholder="City" style={S.input} /></div>
            <div><label style={S.label}>State / Territory</label><input value={form.state} onChange={set("state")} placeholder="NC / CA / NY / FL / PR / GU / VI" style={S.input} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div><label style={S.label}>County</label><input value={form.county} onChange={set("county")} placeholder="County (if known)" style={S.input} /></div>
            <div><label style={S.label}>Municipality</label><input value={form.municipality} onChange={set("municipality")} placeholder="Borough / Parish / Equivalent" style={S.input} /></div>
            <div><label style={S.label}>ZIP</label><input value={form.zip} onChange={set("zip")} placeholder="ZIP" style={S.input} /></div>
          </div>
          <AddressVerifier address={form.address} onVerified={setAddressVerified} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={S.label}>Asking Price ($)</label><input type="number" value={form.price} onChange={set("price")} placeholder="425000" style={S.input} /></div>
            <div><label style={S.label}>Property Type</label><select value={form.type} onChange={set("type")} style={{ ...S.input, cursor: "pointer" }}><option>House</option><option>Condo</option><option>Townhome</option><option>Multi-Family</option><option>Land</option></select></div>
          </div>
          <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: S.surfaceAlt, border: `1px solid ${S.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", marginBottom: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: S.light }}>Seller-Carried Fees</div>
                <div style={{ fontFamily: S.font, fontSize: 12.5, color: S.muted, lineHeight: 1.55, marginTop: 5 }}>
                  Sellers can add their own fee lines here by fixed amount or percentage. Buyers can see these fees, but cannot edit them.
                </div>
              </div>
              <button type="button" onClick={addSellerFeeLine} style={{ ...S.btn(S.surface, S.dark), border: `1px solid ${S.border}`, padding: "8px 12px" }}>
                Add Seller Fee
              </button>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {sellerFeeLines.length === 0 && (
                <div style={{ fontFamily: S.font, fontSize: 12, color: S.light }}>
                  No additional seller fees added.
                </div>
              )}
              {sellerFeeLines.map((line, index) => (
                <div key={line.id} style={{ display: "grid", gridTemplateColumns: "1.35fr 0.8fr 0.8fr auto", gap: 8, alignItems: "end" }}>
                  <div>
                    <label style={S.label}>Fee Label</label>
                    <input
                      value={line.label}
                      onChange={(e) => updateSellerFeeLine(line.id, { label: e.target.value.slice(0, 60) })}
                      placeholder={`Seller fee ${index + 1}`}
                      style={S.input}
                    />
                  </div>
                  <div>
                    <label style={S.label}>Mode</label>
                    <select value={line.mode} onChange={(e) => updateSellerFeeLine(line.id, { mode: e.target.value })} style={{ ...S.input, cursor: "pointer" }}>
                      <option value="amount">Amount</option>
                      <option value="percentage">Percentage</option>
                    </select>
                  </div>
                  <div>
                    <label style={S.label}>{line.mode === "percentage" ? "Percent" : "Amount ($)"}</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.value}
                      onChange={(e) => updateSellerFeeLine(line.id, { value: e.target.value })}
                      placeholder={line.mode === "percentage" ? "1.25" : "500"}
                      style={S.input}
                    />
                  </div>
                  <button type="button" onClick={() => removeSellerFeeLine(line.id)} style={{ ...S.btn(S.redBg, S.red), border: `1px solid ${S.red}33`, padding: "10px 12px" }}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
            {parsedPrice > 0 && sellerFeeLines.length > 0 && (
              <div style={{ marginTop: 12, fontFamily: S.font, fontSize: 12, color: S.muted, lineHeight: 1.6 }}>
                Seller fee total: <strong style={{ color: S.dark }}>{fmt(listingFees.sellerAdditionalFees)}</strong>
              </div>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div><label style={S.label}>Beds</label><input type="number" value={form.beds} onChange={set("beds")} style={S.input} /></div>
            <div><label style={S.label}>Baths</label><input type="number" value={form.baths} onChange={set("baths")} style={S.input} /></div>
            <div><label style={S.label}>Sqft</label><input type="number" value={form.sqft} onChange={set("sqft")} style={S.input} /></div>
          </div>
          <label style={S.label}>Description</label>
          <textarea value={form.description} onChange={set("description")} rows={4} placeholder="Describe what makes your property special..." style={{ ...S.input, resize: "vertical" }} />
          <button onClick={() => setStep(2)} style={{ ...S.btn(S.mid, S.card), width: "100%", marginTop: 20, padding: "14px" }}>Continue to Photos →</button>
        </Card>
      )}

      {/* STEP 2: Photos (REQUIRED) */}
      {step === 2 && (
        <div>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: 0 }}>📸 Exterior Photos</h3>
              <Badge variant={exteriorOk ? "verified" : "warn"}>{exteriorPhotos.length}/{MIN_EXTERIOR} minimum</Badge>
            </div>
            <p style={{ fontFamily: S.font, fontSize: 12, color: S.light, marginBottom: 12, marginTop: 4 }}>
              Front of property, sides, backyard, street view. Must clearly show the full exterior from multiple angles.
            </p>
            <FileUploadZone
              accept="JPG, PNG, HEIC — High resolution exterior photos"
              onUpload={(f) => setExteriorPhotos([...exteriorPhotos, ...f])}
              files={exteriorPhotos}
            />
            {!exteriorOk && exteriorPhotos.length > 0 && (
              <div style={{ marginTop: 8, padding: "8px 12px", background: S.redBg, borderRadius: 8, fontFamily: S.font, fontSize: 12, color: S.red }}>
                ⚠️ {MIN_EXTERIOR - exteriorPhotos.length} more exterior photo{MIN_EXTERIOR - exteriorPhotos.length > 1 ? "s" : ""} required
              </div>
            )}
          </Card>

          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: 0 }}>🏠 Interior Photos</h3>
              <Badge variant={interiorOk ? "verified" : "warn"}>{interiorPhotos.length}/{MIN_INTERIOR} minimum</Badge>
            </div>
            <p style={{ fontFamily: S.font, fontSize: 12, color: S.light, marginBottom: 12, marginTop: 4 }}>
              Kitchen, bathrooms, bedrooms, living areas, and any unique features. Each major room should have at least one photo.
            </p>
            <FileUploadZone
              accept="JPG, PNG, HEIC — High resolution interior photos"
              onUpload={(f) => setInteriorPhotos([...interiorPhotos, ...f])}
              files={interiorPhotos}
            />
            {!interiorOk && interiorPhotos.length > 0 && (
              <div style={{ marginTop: 8, padding: "8px 12px", background: S.redBg, borderRadius: 8, fontFamily: S.font, fontSize: 12, color: S.red }}>
                ⚠️ {MIN_INTERIOR - interiorPhotos.length} more interior photo{MIN_INTERIOR - interiorPhotos.length > 1 ? "s" : ""} required
              </div>
            )}
          </Card>

          {/* Hard Block Warning */}
          {!photosOk && (
            <div style={{ padding: "14px 18px", background: S.redBg, border: `1px solid ${S.red}33`, borderRadius: 12, marginBottom: 16, fontFamily: S.font, fontSize: 13, color: S.red, lineHeight: 1.6 }}>
              <strong>⛔ LISTING BLOCKED:</strong> You must upload at least {MIN_EXTERIOR} exterior photos and {MIN_INTERIOR} interior photos before proceeding. No photos, no listing — this protects all parties.
            </div>
          )}

          <div style={{ padding: 14, background: S.surface, borderRadius: 12, marginBottom: 16, fontFamily: S.font, fontSize: 12, color: S.muted, lineHeight: 1.6 }}>
            🔍 <strong>Third-party review required:</strong> All photos will be reviewed by an EstateHat administrator — never by the buyer or seller — to verify they accurately represent the property. Misleading or stock photos will be flagged and rejected.
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => setStep(1)} style={{ ...S.btn("transparent", S.mid), flex: 1, border: `2px solid ${S.mid}` }}>← Back</button>
            <button
              onClick={() => photosOk && setStep(3)}
              disabled={!photosOk}
              style={{ ...S.btn(photosOk ? S.mid : "#C9C0B4", photosOk ? S.card : "#999"), flex: 2, opacity: photosOk ? 1 : 0.5, cursor: photosOk ? "pointer" : "not-allowed" }}
            >
              {photosOk ? "Continue to Documents →" : `Upload ${!exteriorOk ? "exterior" : "interior"} photos to continue`}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Documents */}
      {step === 3 && (
        <Card>
          <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, margin: "0 0 4px" }}>📄 Required Listing Documents</h3>
          <p style={{ fontFamily: S.font, fontSize: 13, color: S.light, marginBottom: 16 }}>Upload disclosures and supporting documents. All are required before your listing goes live.</p>
          <FileUploadZone
            accept="PDF, DOCX — Disclosures, surveys, HOA docs"
            onUpload={(f) => setListDocs([...listDocs, ...f])}
            files={listDocs}
          />
          <div style={{ marginTop: 16, padding: 14, background: S.surface, borderRadius: 12, fontFamily: S.font, fontSize: 12, color: S.muted, lineHeight: 1.6 }}>
            📋 <strong>Required:</strong> Seller Disclosure Statement, Lead Paint Disclosure (pre-1978 homes)<br />
            📋 <strong>Recommended:</strong> HOA documents, recent survey or plat, home warranty info
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <button onClick={() => setStep(2)} style={{ ...S.btn("transparent", S.mid), flex: 1, border: `2px solid ${S.mid}` }}>← Back</button>
            <button onClick={() => setStep(4)} style={{ ...S.btn(S.mid, S.card), flex: 2 }}>Review Listing →</button>
          </div>
        </Card>
      )}

      {/* STEP 4: Review */}
      {step === 4 && (
        <div>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: S.serif, fontSize: 22, color: S.dark, marginBottom: 4 }}>{form.title || "Untitled Property"}</div>
            <div style={{ fontFamily: S.font, fontSize: 13, color: S.light, marginBottom: 12 }}>{form.address || "No address"}</div>
            <div style={{ fontFamily: S.serif, fontSize: 28, color: S.dark, marginBottom: 8 }}>{form.price ? fmt(Number(form.price)) : "$—"}</div>
            <div style={{ display: "flex", gap: 14, fontFamily: S.font, fontSize: 13, color: S.muted, marginBottom: 10 }}>
              <span>{form.beds || "—"} bed</span><span>|</span><span>{form.baths || "—"} bath</span><span>|</span><span>{form.sqft ? Number(form.sqft).toLocaleString() : "—"} sqft</span>
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}><Badge variant="type">{form.type}</Badge></div>
            <p style={{ fontFamily: S.font, fontSize: 13.5, color: S.muted, lineHeight: 1.6, margin: "0 0 14px" }}>{form.description || "No description."}</p>

            {/* Photo Summary */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div style={{ background: exteriorOk ? S.greenBg : S.redBg, borderRadius: 10, padding: 12, textAlign: "center" }}>
                <div style={{ fontFamily: S.font, fontSize: 20, fontWeight: 700, color: exteriorOk ? S.green : S.red }}>{exteriorPhotos.length}</div>
                <div style={{ fontFamily: S.font, fontSize: 11, color: exteriorOk ? S.green : S.red }}>Exterior Photos</div>
              </div>
              <div style={{ background: interiorOk ? S.greenBg : S.redBg, borderRadius: 10, padding: 12, textAlign: "center" }}>
                <div style={{ fontFamily: S.font, fontSize: 20, fontWeight: 700, color: interiorOk ? S.green : S.red }}>{interiorPhotos.length}</div>
                <div style={{ fontFamily: S.font, fontSize: 11, color: interiorOk ? S.green : S.red }}>Interior Photos</div>
              </div>
            </div>
          </Card>

          {/* Pre-Publish Validation */}
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 14, color: S.dark }}>Pre-Publish Validation</div>
              <Badge variant={canPublish ? "verified" : "warn"}>{allValidations.filter((v) => !v.info && v.ok).length}/{allValidations.filter((v) => !v.info).length} Passed</Badge>
            </div>
            <ProgressBar value={allValidations.filter((v) => !v.info && v.ok).length} max={allValidations.filter((v) => !v.info).length} color={canPublish ? S.green : S.gold} />
            <div style={{ marginTop: 12 }}>
              {allValidations.map((v) => (
                <div key={v.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${S.surface}`, fontFamily: S.font, fontSize: 13 }}>
                  <span style={{ color: v.info ? "#378ADD" : v.ok ? S.green : S.red, fontSize: 14 }}>{v.info ? "ℹ" : v.ok ? "✓" : "✗"}</span>
                  <span style={{ color: v.info ? "#378ADD" : v.ok ? S.muted : S.dark, fontWeight: v.ok ? 400 : 600 }}>{v.label}</span>
                </div>
              ))}
            </div>
            {!canPublish && (
              <div style={{ marginTop: 10, padding: "10px 14px", background: S.redBg, borderRadius: 10, fontFamily: S.font, fontSize: 12, color: S.red, lineHeight: 1.5 }}>
                ⛔ <strong>CANNOT PUBLISH:</strong> All validation checks must pass. Go back and fix the items marked with ✗.
              </div>
            )}
            {submitError && (
              <div style={{ marginTop: 10, padding: "10px 14px", background: S.redBg, borderRadius: 10, fontFamily: S.font, fontSize: 12, color: S.red, lineHeight: 1.5 }}>
                {submitError}
              </div>
            )}
          </Card>

          {parsedPrice > 0 && (
            <div style={{ marginBottom: 16 }}>
              <FeeBreakdown price={parsedPrice} sellerFeeLines={sellerFeeLines} />
            </div>
          )}

          {sellerFeeLines.length > 0 && (
            <Card style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 14, color: S.dark, marginBottom: 10 }}>Seller Fee Schedule</div>
              <div style={{ display: "grid", gap: 8 }}>
                {normalizeSellerFeeLines(parsedPrice, sellerFeeLines).map((line) => (
                  <div key={line.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontFamily: S.font, fontSize: 12.5, color: S.muted }}>
                    <span>{line.label} {line.mode === "percentage" ? `(${line.value.toFixed(2).replace(/\.00$/, "")}%)` : "(fixed)"}</span>
                    <strong style={{ color: S.dark }}>{fmt(line.amount)}</strong>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div style={{ padding: 14, background: S.greenBg, borderRadius: 12, marginBottom: 16, fontFamily: S.font, fontSize: 12, color: S.green, lineHeight: 1.6 }}>
            🔒 After submission, your photos and documents will be reviewed by a third-party EstateHat administrator — never by the buyer or seller. Your listing will go live only after review passes. Estimated review time: 24–48 hours.
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => setStep(3)} style={{ ...S.btn("transparent", S.mid), flex: 1, border: `2px solid ${S.mid}` }}>← Edit</button>
            <button
              onClick={async () => {
                if (!canPublish) return;
                setSubmitBusy(true);
                setSubmitError("");
                try {
                  await syncJurisdictionForListing();
                  const submission = await submitListingForReview({
                    user,
                    listing: {
                      ...form,
                      addressVerified,
                      sellerFeeLines,
                    },
                    exteriorPhotos,
                    interiorPhotos,
                    documents: listDocs,
                  });
                  setSubmittedListingId(submission.id);
                  setSubmitted(true);
                } catch (error) {
                  setSubmitError(error instanceof Error ? error.message : "Unable to submit this listing for review.");
                } finally {
                  setSubmitBusy(false);
                }
              }}
              disabled={!canPublish || submitBusy}
              style={{ ...S.btn(canPublish && !submitBusy ? S.gold : "#C9C0B4", canPublish && !submitBusy ? S.dark : "#999"), flex: 2, padding: "14px", fontSize: 15, opacity: canPublish && !submitBusy ? 1 : 0.5, cursor: canPublish && !submitBusy ? "pointer" : "not-allowed" }}
            >
              {submitBusy ? "Submitting..." : canPublish ? "Submit for Review 🚀" : "Fix validation errors to submit"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BOILERPLATES VIEW ───────────────────

function BoilerplatesView() {
  const isCompact = useMediaQuery("(max-width: 820px)");
  const [selectedCat, setSelectedCat] = useState("All");
  const [openTemplateId, setOpenTemplateId] = useState(null);
  const [templateJurisdiction, setTemplateJurisdiction] = useState({
    city: "",
    state: "",
    county: "",
    municipality: "",
  });
  const cats = ["All", ...new Set(BOILERPLATES.map((b) => b.category))];
  const filtered = selectedCat === "All" ? BOILERPLATES : BOILERPLATES.filter((b) => b.category === selectedCat);

  function isJurisdictionTemplate(templateId) {
    return [
      "ack_non_brokerage",
      "attest_fair_housing",
      "attest_support_scope",
      "ack_electronic_records",
      "attest_marketing_consent",
      "ack_platform_fee_disclosure",
      "ack_funds_custody_boundary",
    ].includes(templateId);
  }

  function renderJurisdictionTemplateText(templateId) {
    const city = templateJurisdiction.city || "[City]";
    const state = templateJurisdiction.state || "[State/Territory]";
    const county = templateJurisdiction.county || "[County]";
    const municipality = templateJurisdiction.municipality || "[Municipality/Borough/Parish]";
    const place = `${city}, ${state}`;
    if (templateId === "ack_non_brokerage") {
      return `I acknowledge that in ${place}, EstateHat operates as a technology platform and not as my licensed brokerage representative unless separately engaged under applicable ${county} / ${municipality} rules.`;
    }
    if (templateId === "attest_fair_housing") {
      return `I attest that all listing, messaging, and transaction conduct in ${place} complies with fair-housing and anti-discrimination obligations, including local protected-class overlays applicable in ${county}.`;
    }
    if (templateId === "attest_support_scope") {
      return `I acknowledge that support provided for this transaction in ${place} is operational guidance only and does not constitute legal representation or legal advice under ${state} or ${county} jurisdictional rules.`;
    }
    if (templateId === "ack_electronic_records") {
      return `I consent to receive and execute electronic records and signatures for this transaction in ${place}, including any municipality-specific requirements for ${municipality}.`;
    }
    if (templateId === "attest_marketing_consent") {
      return `I attest that outbound communications tied to this transaction in ${place} are supported by valid, auditable consent records and suppression controls required in ${state}.`;
    }
    if (templateId === "ack_platform_fee_disclosure") {
      return `I acknowledge the EstateHat platform surcharge and any separate third-party escrow, title, and payment-rail fees disclosed for this transaction in ${place}.`;
    }
    if (templateId === "ack_funds_custody_boundary") {
      return `I acknowledge EstateHat does not custody transaction funds in ${place}; funds movement is executed through designated third-party escrow/payment providers.`;
    }
    return "";
  }

  return (
    <div style={{ maxWidth: 840, margin: "0 auto", padding: 24 }}>
      <SectionHeader title="Common Forms" sub="Reusable transaction, compliance, and acknowledgement forms for every stage of your real estate workflow" />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24 }}>
        {cats.map((c) => (
          <button key={c} onClick={() => setSelectedCat(c)} style={{ ...S.btn(selectedCat === c ? S.mid : S.surface, selectedCat === c ? S.card : S.muted), padding: "8px 16px", fontSize: 12, borderRadius: 20 }}>{c}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1fr 1fr", gap: 16 }}>
        {filtered.map((bp) => {
          const isOpen = openTemplateId === bp.id;
          return (
          <Card key={bp.id} style={{ transition: "box-shadow 0.2s" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
              <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 15, color: S.dark }}>{bp.name}</div>
              <Badge>{bp.category}</Badge>
            </div>
            <p style={{ fontFamily: S.font, fontSize: 13, color: S.light, lineHeight: 1.5, margin: "0 0 12px" }}>{bp.desc}</p>
            {isOpen && (
              <div style={{ background: S.surfaceAlt, border: `1px solid ${S.border}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
                <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: S.goldDeep, marginBottom: 8 }}>
                  Form Preview
                </div>
                <div style={{ fontFamily: S.font, fontSize: 12, color: S.muted, lineHeight: 1.7, marginBottom: 10 }}>
                  This form includes standard language for `{bp.category.toLowerCase()}` workflows, signature blocks, transaction identifiers, state-ready fillable fields, and Hat Data references where a workflow needs component context.
                </div>
                {isJurisdictionTemplate(bp.id) && (
                  <div style={{ marginBottom: 10, padding: 10, borderRadius: 10, background: S.card, border: `1px solid ${S.border}` }}>
                    <div style={{ fontFamily: S.font, fontSize: 10.5, fontWeight: 700, letterSpacing: 1.1, textTransform: "uppercase", color: S.light, marginBottom: 8 }}>
                      Jurisdiction Fill-ins
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1fr 1fr", gap: 8, marginBottom: 8 }}>
                      <input value={templateJurisdiction.city} onChange={(e) => setTemplateJurisdiction((prev) => ({ ...prev, city: e.target.value.slice(0, 80) }))} placeholder="City" style={S.input} />
                      <input value={templateJurisdiction.state} onChange={(e) => setTemplateJurisdiction((prev) => ({ ...prev, state: e.target.value.slice(0, 10).toUpperCase() }))} placeholder="State / Territory" style={S.input} />
                      <input value={templateJurisdiction.county} onChange={(e) => setTemplateJurisdiction((prev) => ({ ...prev, county: e.target.value.slice(0, 80) }))} placeholder="County" style={S.input} />
                      <input value={templateJurisdiction.municipality} onChange={(e) => setTemplateJurisdiction((prev) => ({ ...prev, municipality: e.target.value.slice(0, 120) }))} placeholder="Municipality / Borough / Parish" style={S.input} />
                    </div>
                    <div style={{ fontFamily: S.font, fontSize: 12, color: S.dark, lineHeight: 1.65, background: S.surfaceAlt, borderRadius: 8, padding: "8px 10px" }}>
                      {renderJurisdictionTemplateText(bp.id)}
                    </div>
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                  {[
                    ["Pages", bp.pages],
                    ["Category", bp.category],
                    ["Format", "PDF / DOCX"],
                  ].map(([label, value]) => (
                    <div key={label} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ fontFamily: S.font, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: S.light, marginBottom: 4 }}>{label}</div>
                      <div style={{ fontFamily: S.font, fontSize: 12, color: S.dark, fontWeight: 600 }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: isCompact ? "stretch" : "center", flexDirection: isCompact ? "column" : "row", gap: 10 }}>
              <span style={{ fontFamily: S.font, fontSize: 11, color: S.light }}>{bp.pages} pages</span>
              <div style={{ display: "flex", gap: 6, width: isCompact ? "100%" : "auto" }}>
                <button
                  onClick={() => setOpenTemplateId((current) => current === bp.id ? null : bp.id)}
                  style={{ ...S.btn(isOpen ? S.mid : S.surface, isOpen ? S.card : S.muted), padding: "6px 12px", fontSize: 11, flex: 1 }}
                >
                  {isOpen ? "Hide Preview" : "Preview"}
                </button>
                <button style={{ ...S.btn(S.gold, S.dark), padding: "6px 12px", fontSize: 11, flex: 1 }}>📥 Download</button>
              </div>
            </div>
          </Card>
        )})}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════
// ─── ADMIN OVERSIGHT DASHBOARD ───────────
// ═══════════════════════════════════════════

const ADMIN_VERIFICATION_QUEUE = [];

const ADMIN_DOC_REVIEW_QUEUE = [];

const ADMIN_ACTIVE_TRANSACTIONS = [];

const ADMIN_FLAGS = [];

function AdminView({ onNavigate, user }) {
  const isCompact = useMediaQuery("(max-width: 900px)");
  const [tab, setTab] = useState("overview");
  const [verQueue, setVerQueue] = useState([]);
  const [docQueue, setDocQueue] = useState([]);
  const [flags, setFlags] = useState([]);
  const [selectedVer, setSelectedVer] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [reviewNotes, setReviewNotes] = useState({});
  const activeTransactions = useMemo(() => [], []);
  const [txStatuses, setTxStatuses] = useState({});

  const openFlags = useMemo(() => flags.filter((f) => f.status === "open"), [flags]);
  const criticalFlags = useMemo(() => openFlags.filter((f) => f.severity === "critical"), [openFlags]);
  const pendingVer = useMemo(() => verQueue.filter((v) => v.status === "pending"), [verQueue]);
  const pendingDocs = useMemo(() => docQueue.filter((d) => d.status === "pending"), [docQueue]);

  const approveVerDoc = useCallback((vId, docType) => setVerQueue((prev) => prev.map((v) => v.id === vId ? { ...v, docs: v.docs.map((d) => d.type === docType ? { ...d, status: "approved" } : d) } : v)), []);
  const rejectVerDoc = useCallback((vId, docType) => setVerQueue((prev) => prev.map((v) => v.id === vId ? { ...v, docs: v.docs.map((d) => d.type === docType ? { ...d, status: "rejected" } : d) } : v)), []);
  const approveFullUser = useCallback((vId) => { setVerQueue((prev) => prev.map((v) => v.id === vId ? { ...v, status: "approved", docs: v.docs.map((d) => ({ ...d, status: "approved" })) } : v)); setSelectedVer(null); }, []);
  const rejectFullUser = useCallback((vId) => { setVerQueue((prev) => prev.map((v) => v.id === vId ? { ...v, status: "rejected", docs: v.docs.map((d) => d.status === "pending" ? { ...d, status: "rejected" } : d) } : v)); setSelectedVer(null); }, []);
  const approveTxDoc = useCallback((docId) => { setDocQueue((prev) => prev.map((d) => d.id === docId ? { ...d, status: "approved" } : d)); setSelectedDoc(null); }, []);
  const rejectTxDoc = useCallback((docId) => { setDocQueue((prev) => prev.map((d) => d.id === docId ? { ...d, status: "rejected" } : d)); setSelectedDoc(null); }, []);
  const resolveFlag = useCallback((fId) => setFlags((prev) => prev.map((f) => f.id === fId ? { ...f, status: "resolved" } : f)), []);
  const setTransactionDecision = useCallback((txId, nextStatus, escalationState, lastAction) => {
    setTxStatuses((prev) => ({
      ...prev,
      [txId]: {
        ...(prev[txId] || {}),
        status: nextStatus,
        escalationState,
        lastAction,
      },
    }));
  }, []);

  const severityStyle = (sev) => {
    if (sev === "critical") return { bg: S.redBg, color: S.red, icon: "🔴" };
    if (sev === "warning") return { bg: "#FFF3E0", color: "#BA7517", icon: "🟡" };
    return { bg: "#E6F1FB", color: "#185FA5", icon: "🔵" };
  };
  const statusDot = (s) => <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: s === "pending" ? S.gold : s === "approved" ? S.green : s === "rejected" ? S.red : s === "open" ? S.gold : S.green, marginRight: 6 }} />;

  return (
    <div style={{ maxWidth: 1060, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <SectionHeader title="Admin Oversight" sub="Verification, document review, transaction compliance, and escalated-case decisions" />
        <Badge variant="role">{ACCOUNT_TYPES.find((acct) => acct.key === user?.accountType)?.label || "Administrator"}</Badge>
      </div>

      {criticalFlags.length > 0 && (
        <div style={{ background: S.redBg, border: `1px solid ${S.red}33`, borderRadius: 12, padding: "12px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div style={{ flex: 1, fontFamily: S.font, fontSize: 13, color: S.red, lineHeight: 1.5 }}>
            <strong>{criticalFlags.length} critical flag{criticalFlags.length > 1 ? "s" : ""} require immediate attention</strong> — {criticalFlags.map((f) => f.subject.split("—")[0].trim()).join(", ")}
          </div>
          <button onClick={() => setTab("flags")} style={{ ...S.btn(S.red, "#fff"), padding: "6px 16px", fontSize: 12, flexShrink: 0 }}>Review Now</button>
        </div>
      )}

      <TabBar tabs={[
        { key: "overview", label: "Overview", icon: "📊" },
        { key: "verification", label: `Verify Users (${pendingVer.length})`, icon: "🪪" },
        { key: "documents", label: `Review Docs (${pendingDocs.length})`, icon: "📄" },
        { key: "transactions", label: "Transactions", icon: "💼" },
        { key: "flags", label: `Flags (${openFlags.length})`, icon: "🚩" },
      ]} active={tab} onSelect={setTab} />

      {/* ── OVERVIEW ── */}
      {tab === "overview" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr 1fr" : "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
            {[
              ["Pending Verifications", pendingVer.length, S.gold, () => setTab("verification")],
              ["Documents to Review", pendingDocs.length, "#378ADD", () => setTab("documents")],
              ["Active Transactions", activeTransactions.length, S.green, () => setTab("transactions")],
              ["Open Flags", openFlags.length, criticalFlags.length > 0 ? S.red : S.gold, () => setTab("flags")],
            ].map(([label, val, color, action]) => (
              <div key={label} onClick={action} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: 18, cursor: "pointer", borderLeft: `4px solid ${color}` }}>
                <div style={{ fontFamily: S.serif, fontSize: 30, color }}>{val}</div>
                <div style={{ fontFamily: S.font, fontSize: 12, color: S.light, marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>

          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: S.light, marginBottom: 14, fontWeight: 600 }}>Platform Revenue — Active Pipeline</div>
            <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 14 }}>
              {[
                ["Total Pipeline", fmt(activeTransactions.reduce((s, t) => s + t.price, 0)), S.dark],
                ["Projected Fees (1.50%)", fmt(Math.round(activeTransactions.reduce((s, t) => s + t.price, 0) * 0.015)), S.gold],
                ["In Escrow", fmt(0), S.green],
                ["Blocked Value", fmt(0), S.red],
              ].map(([label, val, color]) => (
                <div key={label} style={{ textAlign: "center", padding: 14, background: S.surfaceAlt, borderRadius: 10 }}>
                  <div style={{ fontFamily: S.serif, fontSize: 20, color }}>{val}</div>
                  <div style={{ fontFamily: S.font, fontSize: 11, color: S.light }}>{label}</div>
                </div>
              ))}
            </div>
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1fr 1fr", gap: 14 }}>
            <Card>
              <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 14, color: S.dark, marginBottom: 12 }}>🪪 Highest Priority Verifications</div>
              {verQueue.filter((v) => v.status === "pending").sort((a, b) => a.priority === "high" ? -1 : 1).slice(0, 3).map((v) => (
                <div key={v.id} onClick={() => { setSelectedVer(v.id); setTab("verification"); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${S.surface}`, cursor: "pointer" }}>
                  <div>
                    <div style={{ fontFamily: S.font, fontSize: 13, fontWeight: 600, color: S.dark }}>{v.name}</div>
                    <div style={{ display: "flex", gap: 4, marginTop: 2 }}><Badge variant="role">{v.role}</Badge><Badge variant={v.priority === "high" ? "warn" : "default"}>{v.priority}</Badge></div>
                  </div>
                  <span style={{ fontFamily: S.font, fontSize: 11, color: S.light }}>{v.submitted}</span>
                </div>
              ))}
            </Card>
            <Card>
              <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 14, color: S.dark, marginBottom: 12 }}>🚩 Latest Flags</div>
              {openFlags.slice(0, 4).map((f) => {
                const sv = severityStyle(f.severity);
                return (
                  <div key={f.id} onClick={() => setTab("flags")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${S.surface}`, cursor: "pointer" }}>
                    <span style={{ fontSize: 12 }}>{sv.icon}</span>
                    <div style={{ flex: 1, fontFamily: S.font, fontSize: 12, color: S.dark, lineHeight: 1.4 }}>{f.subject.length > 50 ? f.subject.slice(0, 50) + "..." : f.subject}</div>
                    <span style={{ fontFamily: S.font, fontSize: 10, color: S.light }}>{f.created}</span>
                  </div>
                );
              })}
            </Card>
          </div>

          {/* Audit Log */}
          <Card style={{ marginTop: 16 }}>
            <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 14, color: S.dark, marginBottom: 12 }}>📋 Recent Admin Activity Log</div>
            {([]).length === 0 && (
              <div style={{ fontFamily: S.font, fontSize: 13, color: S.light, lineHeight: 1.5 }}>
                No live admin activity has been recorded in this session.
              </div>
            )}
            {([]).map((log, i) => (
              <div key={i} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: i < 7 ? "1px solid #F0EBE3" : "none", fontFamily: S.font, fontSize: 12 }}>
                <span style={{ color: S.light, minWidth: 130, flexShrink: 0 }}>{log.time}</span>
                <span style={{ color: log.admin === "System" ? "#378ADD" : S.gold, fontWeight: 600, minWidth: 110, flexShrink: 0 }}>{log.admin}</span>
                <span style={{ color: S.muted }}>{log.action}</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* ── VERIFICATION QUEUE ── */}
      {tab === "verification" && (
        <div>
          {verQueue.map((v) => {
            const isOpen = selectedVer === v.id;
            const pendingCount = v.docs.filter((d) => d.status === "pending").length;
            const allApproved = v.status === "approved" || v.docs.every((d) => d.status === "approved");
            const hasFlags = v.docs.some((d) => d.flags.length > 0);
            return (
              <Card key={v.id} style={{ marginBottom: 12, padding: 0, overflow: "hidden", borderLeft: `4px solid ${allApproved ? S.green : hasFlags ? S.red : S.gold}` }}>
                <div onClick={() => setSelectedVer(isOpen ? null : v.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", cursor: "pointer", background: isOpen ? "#F8F5F0" : "transparent" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 42, height: 42, borderRadius: "50%", background: S.surface, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: S.font, fontWeight: 700, fontSize: 14, color: S.muted }}>
                      {v.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 15, color: S.dark }}>
                        {v.name} {allApproved && <span style={{ color: S.green, fontSize: 12 }}>✓ Verified</span>}
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 3 }}>
                        <Badge variant="role">{v.role}</Badge>
                        <span style={{ fontFamily: S.font, fontSize: 11, color: S.light }}>{v.email}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Badge variant={v.priority === "high" ? "warn" : "default"}>{v.priority}</Badge>
                    {allApproved ? <Badge variant="verified">Approved</Badge> : <Badge variant="warn">{pendingCount} pending</Badge>}
                    <span style={{ fontSize: 14, color: S.light, transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>▼</span>
                  </div>
                </div>
                {isOpen && (
                  <div style={{ padding: "0 20px 20px" }}>
                    <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: S.light, marginBottom: 10, fontWeight: 600 }}>Submitted Documents</div>
                    {v.docs.map((doc) => (
                      <div key={doc.type} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: doc.status === "approved" ? S.greenBg : doc.status === "rejected" ? S.redBg : "#FDFCF9", borderRadius: 10, marginBottom: 8, border: `1px solid ${doc.status === "approved" ? S.green + "33" : doc.status === "rejected" ? S.red + "33" : S.border}` }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: S.font, fontWeight: 600, fontSize: 13, color: S.dark }}>{doc.type}</div>
                          <div style={{ fontFamily: S.font, fontSize: 12, color: S.light, marginTop: 2 }}>📎 {doc.file}</div>
                          {doc.flags.map((flag, fi) => (
                            <div key={fi} style={{ fontFamily: S.font, fontSize: 11, color: S.red, background: S.redBg, padding: "4px 10px", borderRadius: 6, marginTop: 6, display: "inline-block" }}>⚠️ {flag}</div>
                          ))}
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          {doc.status === "pending" ? (
                            <>
                              <button onClick={() => approveVerDoc(v.id, doc.type)} style={{ ...S.btn(S.green, "#fff"), padding: "5px 14px", fontSize: 11 }}>Approve</button>
                              <button onClick={() => rejectVerDoc(v.id, doc.type)} style={{ ...S.btn("transparent", S.red), padding: "5px 14px", fontSize: 11, border: `1px solid ${S.red}` }}>Reject</button>
                            </>
                          ) : (
                            <Badge variant={doc.status === "approved" ? "verified" : "warn"}>{doc.status}</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                    <label style={S.label}>Admin Review Notes</label>
                    <textarea value={reviewNotes[v.id] || ""} onChange={(e) => setReviewNotes({ ...reviewNotes, [v.id]: e.target.value })} rows={2} placeholder="Document any observations, concerns, or reasons for decision..." style={{ ...S.input, resize: "vertical", marginBottom: 12 }} />
                    {!allApproved && (
                      <div style={{ display: "flex", gap: 10, paddingTop: 12, borderTop: `1px solid ${S.surface}` }}>
                        <button onClick={() => approveFullUser(v.id)} style={{ ...S.btn(S.green, "#fff"), padding: "10px 24px", fontSize: 13 }}>✓ Approve All & Verify</button>
                        <button onClick={() => rejectFullUser(v.id)} style={{ ...S.btn("transparent", S.red), padding: "10px 24px", fontSize: 13, border: `1px solid ${S.red}` }}>✗ Reject Application</button>
                        <button style={{ ...S.btn("#F0EBE3", S.muted), padding: "10px 24px", fontSize: 13 }}>Request Resubmission</button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ── DOCUMENT REVIEW ── */}
      {tab === "documents" && (
        <div>
          {docQueue.map((doc) => {
            const isOpen = selectedDoc === doc.id;
            return (
              <Card key={doc.id} style={{ marginBottom: 12, padding: 0, overflow: "hidden", borderLeft: `4px solid ${doc.status === "approved" ? S.green : doc.status === "rejected" ? S.red : doc.flags.length > 0 ? S.red : S.gold}` }}>
                <div onClick={() => setSelectedDoc(isOpen ? null : doc.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", cursor: "pointer", background: isOpen ? "#F8F5F0" : "transparent" }}>
                  <div>
                    <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 14, color: S.dark }}>{doc.docType}</div>
                    <div style={{ fontFamily: S.font, fontSize: 12, color: S.light, marginTop: 2 }}>{doc.property} · {doc.transaction}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Badge variant="role">{doc.uploadedRole}</Badge>
                    {doc.flags.length > 0 && <Badge variant="warn">{doc.flags.length} flag{doc.flags.length > 1 ? "s" : ""}</Badge>}
                    <Badge variant={doc.status === "approved" ? "verified" : doc.status === "rejected" ? "warn" : "default"}>{doc.status}</Badge>
                    <span style={{ fontSize: 14, color: S.light, transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>▼</span>
                  </div>
                </div>
                {isOpen && (
                  <div style={{ padding: "0 20px 20px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 14 }}>
                      <div>
                        <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: S.light, marginBottom: 6, fontWeight: 600 }}>Document Details</div>
                        {[["File", doc.docName], ["Pages", doc.pages], ["Uploaded By", `${doc.uploadedBy} (${doc.uploadedRole})`], ["Uploaded", doc.uploaded], ["Transaction", doc.transaction]].map(([k, v]) => (
                          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontFamily: S.font, fontSize: 12 }}>
                            <span style={{ color: S.light }}>{k}</span><span style={{ color: S.dark, fontWeight: 500 }}>{v}</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: S.light, marginBottom: 6, fontWeight: 600 }}>Parties</div>
                        {doc.parties.map((p) => <div key={p} style={{ fontFamily: S.font, fontSize: 13, color: S.muted, padding: "4px 0" }}>• {p}</div>)}
                        {doc.flags.length > 0 && (
                          <div style={{ marginTop: 12 }}>
                            <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: S.light, marginBottom: 6, fontWeight: 600 }}>Flags</div>
                            {doc.flags.map((flag, i) => <div key={i} style={{ fontFamily: S.font, fontSize: 12, color: S.red, background: S.redBg, padding: "6px 10px", borderRadius: 8, marginBottom: 4 }}>⚠️ {flag}</div>)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ background: S.surfaceAlt, borderRadius: 12, padding: 14, marginBottom: 14 }}>
                      <div style={{ fontFamily: S.font, fontSize: 12, fontWeight: 700, color: S.dark, marginBottom: 8 }}>Verification Checklist</div>
                      {(doc.docType.includes("Photos") ? [
                        "Minimum photo count met (4 exterior / 6 interior)",
                        "Photos are high resolution and well-lit",
                        "Photos match the listed property address",
                        "No heavy filters, distortion, or misleading angles",
                        "All major rooms / exterior angles represented",
                        "No stock photos or images from other listings",
                        "Reviewer is NOT the buyer or seller on this listing",
                      ] : [
                        "Document is complete and legible",
                        "All required signatures present",
                        "Dates are consistent and current",
                        "Names match verified identities on file",
                        "No blank required sections or missing pages",
                        "Notarization valid (if applicable)",
                        "No signs of tampering or alteration",
                      ]).map((check) => (
                        <label key={check} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: S.font, fontSize: 12, color: S.muted, padding: "4px 0", cursor: "pointer" }}>
                          <input type="checkbox" /> {check}
                        </label>
                      ))}
                    </div>
                    <label style={S.label}>Admin Review Notes</label>
                    <textarea value={reviewNotes[doc.id] || ""} onChange={(e) => setReviewNotes({ ...reviewNotes, [doc.id]: e.target.value })} rows={2} placeholder="Note any issues, required corrections, or conditions..." style={{ ...S.input, resize: "vertical", marginBottom: 12 }} />
                    {doc.status === "pending" && (
                      <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={() => approveTxDoc(doc.id)} style={{ ...S.btn(S.green, "#fff"), padding: "10px 24px", fontSize: 13 }}>✓ Approve Document</button>
                        <button onClick={() => rejectTxDoc(doc.id)} style={{ ...S.btn("transparent", S.red), padding: "10px 24px", fontSize: 13, border: `1px solid ${S.red}` }}>✗ Reject — Request Revision</button>
                        <button style={{ ...S.btn("#F0EBE3", S.muted), padding: "10px 24px", fontSize: 13 }}>Escalate to Attorney</button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ── TRANSACTIONS ── */}
      {tab === "transactions" && (
        <div>
          {activeTransactions.length === 0 && (
            <Card style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontFamily: S.serif, fontSize: 22, color: S.dark, marginBottom: 8 }}>No Live Transactions</div>
              <div style={{ fontFamily: S.font, fontSize: 14, color: S.light }}>
                Connected transaction records will appear here when the transaction backend is available.
              </div>
            </Card>
          )}
          {activeTransactions.map((tx) => {
            const pct = Math.round((tx.checklistDone / tx.checklistTotal) * 100);
            const fee = calcFees(tx.price);
            const txState = txStatuses[tx.id] || { status: tx.status, escalationState: "monitoring", lastAction: "" };
            const isEscalated = txState.escalationState === "escalated";
            return (
              <Card key={tx.id} style={{ marginBottom: 14, borderLeft: `4px solid ${txState.status === "Blocked" ? S.red : txState.status === "Closing" ? S.green : S.gold}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 15, color: S.dark }}>{tx.property}</div>
                    <div style={{ fontFamily: S.font, fontSize: 12, color: S.light, marginTop: 2 }}>{tx.id} · {tx.daysOpen} days · Phase: {tx.phase}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {tx.flagCount > 0 && <Badge variant="warn">{tx.flagCount} flags</Badge>}
                    {isEscalated && <Badge variant="warn">Escalated</Badge>}
                    <Badge variant={txState.status === "Blocked" ? "warn" : txState.status === "Closing" ? "verified" : "type"}>{txState.status}</Badge>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
                  {[["Sale Price", fmt(tx.price)], ["Platform Fee", fmt(fee.processingFee)], ["Checklist", `${tx.checklistDone}/${tx.checklistTotal}`], ["Progress", `${pct}%`]].map(([k, v]) => (
                    <div key={k} style={{ textAlign: "center", padding: 10, background: S.surfaceAlt, borderRadius: 8 }}>
                      <div style={{ fontFamily: S.font, fontSize: 15, fontWeight: 700, color: S.dark }}>{v}</div>
                      <div style={{ fontFamily: S.font, fontSize: 10, color: S.light }}>{k}</div>
                    </div>
                  ))}
                </div>
                <ProgressBar value={tx.checklistDone} max={tx.checklistTotal} color={tx.status === "Blocked" ? S.red : tx.status === "Closing" ? S.green : S.gold} />
                <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 8, marginTop: 12, fontFamily: S.font, fontSize: 12 }}>
                  {[["Buyer", tx.buyer], ["Seller", tx.seller], ["Attorney", tx.attorney], ["Escrow", tx.escrow]].map(([role, name]) => (
                    <div key={role}><span style={{ color: S.light }}>{role}: </span><span style={{ color: name === "N/A" || name === "Pending" ? S.red : S.dark, fontWeight: 600 }}>{name}</span></div>
                  ))}
                </div>
                {(txState.status === "Blocked" || isEscalated) && (
                  <div style={{ marginTop: 10, padding: "8px 14px", background: S.redBg, borderRadius: 8, fontFamily: S.font, fontSize: 12, color: S.red }}>
                    ⚠️ Administrator decision required before this transaction can proceed normally.
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                  <button onClick={() => setTransactionDecision(tx.id, "Active", "monitoring", "Approved to continue after escalation review")} style={{ ...S.btn(S.green, "#fff"), padding: "8px 16px", fontSize: 12 }}>
                    Approve Continuation
                  </button>
                  <button onClick={() => setTransactionDecision(tx.id, "Blocked", "escalated", "Rejected pending transaction corrections or remediation")} style={{ ...S.btn("transparent", S.red), padding: "8px 16px", fontSize: 12, border: `1px solid ${S.red}` }}>
                    Reject / Block
                  </button>
                  <button onClick={() => setTransactionDecision(tx.id, txState.status === "Blocked" ? "Active" : txState.status, "escalated", "Escalated for administrator intervention")} style={{ ...S.btn("#F0EBE3", S.muted), padding: "8px 16px", fontSize: 12 }}>
                    Escalate
                  </button>
                  <button onClick={() => setTransactionDecision(tx.id, "Closing", "monitoring", "Cleared all issues and approved for closing sequence")} style={{ ...S.btn(S.gold, S.dark), padding: "8px 16px", fontSize: 12 }}>
                    Approve For Closing
                  </button>
                </div>
                {txState.lastAction && (
                  <div style={{ marginTop: 10, fontFamily: S.font, fontSize: 12, color: S.light }}>
                    Last admin action: {txState.lastAction}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ── FLAGS ── */}
      {tab === "flags" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {[["All", flags.length], ["Critical", criticalFlags.length], ["Warning", flags.filter((f) => f.severity === "warning" && f.status === "open").length], ["Info", flags.filter((f) => f.severity === "info" && f.status === "open").length], ["Resolved", flags.filter((f) => f.status === "resolved").length]].map(([label, count]) => (
              <div key={label} style={{ fontFamily: S.font, fontSize: 12, color: S.muted, padding: "6px 14px", background: S.surface, borderRadius: 20 }}>{label} <strong>{count}</strong></div>
            ))}
          </div>
          {flags.map((f) => {
            const sv = severityStyle(f.severity);
            return (
              <Card key={f.id} style={{ marginBottom: 10, padding: "16px 20px", borderLeft: `4px solid ${sv.color}`, opacity: f.status === "resolved" ? 0.5 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12 }}>{sv.icon}</span>
                      <Badge variant={f.severity === "critical" ? "warn" : f.severity === "warning" ? "type" : "default"}>{f.severity}</Badge>
                      <Badge>{f.type}</Badge>
                      <span style={{ fontFamily: S.font, fontSize: 11, color: S.light }}>{f.id} · {f.transaction} · {f.created}</span>
                    </div>
                    <div style={{ fontFamily: S.font, fontSize: 14, fontWeight: 600, color: S.dark, marginBottom: 6 }}>{f.subject}</div>
                    <div style={{ fontFamily: S.font, fontSize: 12, color: S.muted, background: S.surfaceAlt, padding: "6px 12px", borderRadius: 8, display: "inline-block" }}>
                      Recommended: {f.action}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 12 }}>
                    {f.status === "open" ? (
                      <>
                        <button onClick={() => resolveFlag(f.id)} style={{ ...S.btn(S.green, "#fff"), padding: "6px 14px", fontSize: 11 }}>Resolve</button>
                        <button style={{ ...S.btn("#F0EBE3", S.muted), padding: "6px 14px", fontSize: 11 }}>Escalate</button>
                      </>
                    ) : (
                      <Badge variant="verified">Resolved</Badge>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════
// ─── MESSAGES / CHAT SYSTEM ──────────────

function MessagesView({ user, onNavigate, collaboratorsByDeal = {}, conversationPrefill = null }) {
  const isCompact = useMediaQuery("(max-width: 900px)");
  const [activeConvId, setActiveConvId] = useState(null);
  const [newMsg, setNewMsg] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [liveMessages, setLiveMessages] = useState([]);
  const [showInfo, setShowInfo] = useState(false);
  const chatEndRef = useRef(null);
  const [attachments, setAttachments] = useState([]);
  const [toolbarNotice, setToolbarNotice] = useState("");
  const debouncedSearchQ = useDebounce(searchQ, 200);
  const dealLookup = useMemo(() => {
    return {};
  }, []);
  const conversations = useMemo(() => {
    const rows = [];
    Object.entries(collaboratorsByDeal || {}).forEach(([dealId, members]) => {
      if (!Array.isArray(members)) return;
      members.forEach((member, index) => {
        const convId = `deal-${dealId}-${member.id || `${member.role}-${index}`}`;
        rows.push({
          id: convId,
          dealId,
          name: member.name,
          role: member.role,
          linkedin: member.linkedin || "",
          property: member.property || dealLookup[dealId]?.property || dealId,
          propertyId: dealLookup[dealId]?.propertyId || null,
          avatar: (member.name || "?").split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "?",
          online: false,
          unread: 0,
          verified: true,
          messages: [],
        });
      });
    });
    return rows;
  }, [collaboratorsByDeal, dealLookup]);
  const filteredConversations = useMemo(() => {
    if (!debouncedSearchQ.trim()) return conversations;
    const q = debouncedSearchQ.toLowerCase();
    return conversations.filter((conv) => `${conv.name} ${conv.role} ${conv.property}`.toLowerCase().includes(q));
  }, [conversations, debouncedSearchQ]);
  const activeConv = useMemo(() => conversations.find((c) => c.id === activeConvId), [conversations, activeConvId]);

  useEffect(() => {
    if (!conversations.length) {
      setActiveConvId(null);
      return;
    }
    if (conversationPrefill?.dealId) {
      const prefill = conversations.find((conv) => conv.dealId === conversationPrefill.dealId);
      if (prefill) {
        setActiveConvId(prefill.id);
        return;
      }
    }
    if (!activeConvId || !conversations.some((conv) => conv.id === activeConvId)) {
      setActiveConvId(conversations[0].id);
    }
  }, [conversations, conversationPrefill, activeConvId]);
  
  const chatToolbarActions = useMemo(() => {
    const base = [
      {
        label: "Request docs",
        icon: "🗂️",
        handler: () => setToolbarNotice(`Requested documents from ${activeConv?.name || "collaborator"}.`),
      },
      {
        label: "Share calendar",
        icon: "📅",
        handler: () => {
          setToolbarNotice("Calendar shared with the counterparty.");
          onNavigate("transaction");
        },
      },
      {
        label: "Check-in",
        icon: "✅",
        handler: () => setToolbarNotice("Showing the next confirmed transaction milestone."),
      },
    ];
    if (activeConv?.role === "seller") {
      base.unshift({
        label: "Listing stats",
        icon: "📈",
        handler: () => setToolbarNotice("Opened listing stats for the seller."),
      });
    }
    return base;
  }, [activeConv, onNavigate]);

  useEffect(() => {
    if (!activeConvId) {
      setLiveMessages([]);
      return undefined;
    }
    const q = query(collection(db, "messages"), where("convId", "==", activeConvId), orderBy("timestamp", "asc"));
    return onSnapshot(q, (snapshot) => {
      setLiveMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
  }, [activeConvId]);

  const sendMessage = async () => {
    if (!activeConvId) return;
    if (!newMsg.trim() && attachments.length === 0) return;
    const text = newMsg.trim();
    setNewMsg("");
    setAttachments([]);
    const payload = {
      convId: activeConvId,
      from: "me",
      uid: user?.uid || "",
      text,
      timestamp: serverTimestamp(),
      userName: user.name,
      attachments,
    };
    
    await addDoc(collection(db, "messages"), payload);
  };

  const fileInputRef = useRef(null);
  const handleFiles = (fileList) => {
    const allowedMimeTypes = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
      "text/plain",
    ]);
    const maxFiles = 5;
    const maxBytes = 4 * 1024 * 1024;
    let remainingSlots = Math.max(0, maxFiles - attachments.length);

    Array.from(fileList).forEach((file) => {
      if (remainingSlots <= 0) {
        setToolbarNotice(`Attachment limit reached (${maxFiles} files max).`);
        return;
      }
      if (file.size > maxBytes) {
        setToolbarNotice(`"${file.name}" exceeds the 4MB attachment limit.`);
        return;
      }
      if (!allowedMimeTypes.has(file.type)) {
        setToolbarNotice(`"${file.name}" type is not allowed.`);
        return;
      }
      remainingSlots -= 1;
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            size: (file.size / 1024).toFixed(1) + " KB",
            type: file.type.startsWith("image/") ? "photo" : "document",
            preview: event.target.result,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const roleColor = (role) => {
    const map = { seller: S.gold, attorney: "#7F77DD", inspector: "#1D9E75", agent: "#D85A30", lender: "#378ADD", buyer: S.green };
    return map[role] || S.light;
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 24px 0", minHeight: isCompact ? "auto" : "calc(100vh - 54px - 24px)", display: "flex", flexDirection: "column" }}>
      <SectionHeader title="Messages" sub="Communicate with all parties across your transactions" />
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: isCompact ? "1fr" : "300px 1fr", border: `1px solid ${S.border}`, borderRadius: 16, overflow: "hidden", background: S.card, minHeight: 0 }}>

        {/* ── Conversation List ── */}
        <div style={{ borderRight: `1px solid ${S.border}`, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ padding: "14px 14px 10px" }}>
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search conversations..."
              style={{ ...S.input, fontSize: 13, padding: "10px 14px" }}
            />
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {filteredConversations.length === 0 && (
              <div style={{ padding: 24, fontFamily: S.font, fontSize: 13, color: S.light, lineHeight: 1.6 }}>
                Conversations will appear here once you start messaging on a live transaction or listing.
              </div>
            )}
            {filteredConversations.map((c) => (
              <div
                key={c.id}
                onClick={() => setActiveConvId(c.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer",
                  background: activeConvId === c.id ? "#F0EBE3" : "transparent",
                  borderLeft: activeConvId === c.id ? `3px solid ${S.gold}` : "3px solid transparent",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: "50%", background: roleColor(c.role) + "22",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: S.font, fontWeight: 700, fontSize: 14, color: roleColor(c.role),
                  }}>
                    {c.avatar}
                  </div>
                  {c.online && (
                    <div style={{ position: "absolute", bottom: 0, right: 0, width: 12, height: 12, borderRadius: "50%", background: S.green, border: `2px solid ${S.card}` }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                    <span style={{ fontFamily: S.font, fontWeight: 600, fontSize: 13.5, color: S.dark, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                    {c.unread > 0 && (
                      <span style={{ background: S.gold, color: S.dark, borderRadius: 10, padding: "2px 7px", fontSize: 11, fontWeight: 700, fontFamily: S.font, flexShrink: 0 }}>{c.unread}</span>
                    )}
                  </div>
                  <div style={{ fontFamily: S.font, fontSize: 11, color: S.light, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.property}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
                    <Badge variant="role">{c.role}</Badge>
                    {c.verified && <span style={{ fontSize: 10, color: S.green }}>✓</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Active Chat ── */}
        {activeConv ? (
          <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
            {/* Chat Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: `1px solid ${S.border}`, flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ position: "relative" }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: "50%", background: roleColor(activeConv.role) + "22",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: S.font, fontWeight: 700, fontSize: 13, color: roleColor(activeConv.role),
                  }}>
                    {activeConv.avatar}
                  </div>
                  {activeConv.online && (
                    <div style={{ position: "absolute", bottom: -1, right: -1, width: 10, height: 10, borderRadius: "50%", background: S.green, border: `2px solid ${S.card}` }} />
                  )}
                </div>
                <div>
                  <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 15, color: S.dark }}>
                    {activeConv.name}
                    {activeConv.verified && <span style={{ color: S.green, marginLeft: 6, fontSize: 12 }}>✓ Verified</span>}
                  </div>
                  <div style={{ fontFamily: S.font, fontSize: 12, color: S.light }}>
                    <Badge variant="role">{activeConv.role}</Badge>
                    <span style={{ marginLeft: 8 }}>{activeConv.online ? "Online" : "Offline"}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {activeConv.propertyId && (
                  <button onClick={() => onNavigate("detail", activeConv.propertyId)} style={{ ...S.btn("#F0EBE3", S.muted), padding: "6px 14px", fontSize: 12 }}>
                    View Property
                  </button>
                )}
                <button onClick={() => setShowInfo(!showInfo)} style={{ ...S.btn(showInfo ? S.mid : "#F0EBE3", showInfo ? S.card : S.muted), padding: "6px 14px", fontSize: 12 }}>
                  Info
                </button>
              </div>
            </div>

            {/* Property Context Banner */}
            <div style={{ padding: "8px 20px", background: S.surfaceAlt, borderBottom: `1px solid ${S.border}`, fontFamily: S.font, fontSize: 12, color: S.muted, display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <span>🏠</span>
              <span style={{ fontWeight: 600 }}>{activeConv.property}</span>
              <span style={{ color: S.light }}>·</span>
              <span style={{ color: S.light }}>End-to-end encrypted</span>
            </div>

            {toolbarNotice && (
              <div style={{ padding: "10px 20px", borderBottom: `1px solid ${S.surface}`, fontFamily: S.font, fontSize: 12, color: S.blue, background: S.blueBg }}>
                {toolbarNotice}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, padding: "10px 20px", borderBottom: `1px solid ${S.border}`, flexWrap: "wrap", background: S.surface }}>
              {chatToolbarActions.map((action) => (
                <button
                  key={action.label}
                  onClick={action.handler}
                  style={{
                    ...S.btn(S.surfaceAlt, S.dark),
                    padding: "8px 14px",
                    borderRadius: 999,
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>{action.icon}</span>
                  {action.label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
              {/* Messages Area */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
                  {(liveMessages.length > 0 ? liveMessages : []).map((msg, i, allMessages) => {
                    const isMe = msg.from === "me";
                    const messageTime = msg.time || "Now";
                    const dateLabel = String(messageTime).split(",")[0];
                    const prevDateLabel = i > 0 ? String(allMessages[i - 1].time || "").split(",")[0] : "";
                    const showDateHeader = i === 0 || prevDateLabel !== dateLabel;
                    return (
                      <div key={msg.id}>
                        {showDateHeader && (
                          <div style={{ textAlign: "center", margin: "16px 0 12px", fontFamily: S.font, fontSize: 11, color: S.light }}>
                            {dateLabel}
                          </div>
                        )}
                        <div style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", marginBottom: 8 }}>
                          <div style={{ maxWidth: "72%" }}>
                            <div style={{
                              background: isMe ? S.gold : "#F0EBE3",
                              color: S.dark,
                              padding: "10px 16px", borderRadius: 18,
                              borderBottomRightRadius: isMe ? 4 : 18,
                              borderBottomLeftRadius: isMe ? 18 : 4,
                              fontFamily: S.font, fontSize: 14, lineHeight: 1.55,
                            }}>
                              {msg.text}
                              {msg.attachments?.length > 0 && (
                                <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 10 }}>
                                  {msg.attachments.map((att, index) => (
                                    <div key={index} style={{ minWidth: 120 }}>
                                      {att.type === "photo" ? (
                                        <img src={att.preview} alt={att.name} style={{ width: 120, borderRadius: 12, border: `1px solid ${S.surface}` }} />
                                      ) : (
                                        <div style={{ borderRadius: 12, padding: "8px 10px", background: S.surface, border: `1px solid ${S.border}` }}>
                                          <div style={{ fontSize: 13, fontWeight: 600 }}>{att.name}</div>
                                          <div style={{ fontSize: 11, color: S.muted }}>{att.size}</div>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div style={{ fontFamily: S.font, fontSize: 10, color: S.light, marginTop: 3, textAlign: isMe ? "right" : "left", padding: "0 4px" }}>
                              {messageTime}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {liveMessages.length === 0 && (
                    <div style={{ textAlign: "center", padding: "48px 24px", fontFamily: S.font, fontSize: 13, color: S.light }}>
                      No messages yet. Start the attached conversation for this sale team.
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Attachment Preview */}
                {attachments.length > 0 && (
                  <div style={{ padding: "8px 20px", borderTop: `1px solid ${S.border}`, display: "flex", gap: 8, flexWrap: "wrap", flexShrink: 0 }}>
                    {attachments.map((a, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: S.surface, borderRadius: 10, padding: "6px 12px", minWidth: 160, maxWidth: 240 }}>
                        {a.type === "photo" ? (
                          <img src={a.preview} alt={a.name} style={{ width: 60, height: 60, borderRadius: 8, objectFit: "cover" }} />
                        ) : (
                          <div style={{ fontSize: 18 }}>📄</div>
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: S.font, fontSize: 12, fontWeight: 600 }}>{a.name}</div>
                          <div style={{ fontFamily: S.font, fontSize: 11, color: S.muted }}>{a.size}</div>
                        </div>
                        <button onClick={() => setAttachments(attachments.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: S.red, fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Input Bar */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 20px", borderTop: `1px solid ${S.border}`, flexShrink: 0 }}>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{ ...S.btn("#F0EBE3", S.muted), padding: "8px 12px", fontSize: 16, borderRadius: 10, flexShrink: 0 }}
                    title="Attach file"
                  >
                    +
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    style={{ display: "none" }}
                    onChange={(e) => {
                      handleFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <input
                    value={newMsg}
                    onChange={(e) => setNewMsg(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
                    placeholder={`Message ${activeConv.name}...`}
                    style={{ ...S.input, flex: 1, fontSize: 14, padding: "10px 16px" }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMsg.trim() && attachments.length === 0}
                    style={{ ...S.btn(S.gold, S.dark), padding: "10px 20px", fontSize: 14, opacity: (!newMsg.trim() && attachments.length === 0) ? 0.5 : 1, flexShrink: 0 }}
                  >
                    Send
                  </button>
                </div>
              </div>

              {/* Info Panel */}
              {showInfo && (
                <div style={{ width: 240, borderLeft: `1px solid ${S.border}`, padding: 16, overflowY: "auto", flexShrink: 0 }}>
                  <div style={{ textAlign: "center", marginBottom: 16 }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: "50%", background: roleColor(activeConv.role) + "22",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: S.font, fontWeight: 700, fontSize: 18, color: roleColor(activeConv.role),
                      margin: "0 auto 8px",
                    }}>
                      {activeConv.avatar}
                    </div>
                    <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 15, color: S.dark }}>{activeConv.name}</div>
                    <div style={{ marginTop: 4 }}>
                      <Badge variant="role">{activeConv.role}</Badge>
                      {activeConv.verified && <Badge variant="verified">✓ Verified</Badge>}
                    </div>
                  </div>
                  <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: S.light, marginBottom: 8, fontWeight: 600 }}>Linked Property</div>
                  <div style={{ padding: 12, background: S.surfaceAlt, borderRadius: 10, marginBottom: 16, fontFamily: S.font, fontSize: 13, color: S.dark, lineHeight: 1.5 }}>
                    🏠 {activeConv.property}
                  </div>
                  <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: S.light, marginBottom: 8, fontWeight: 600 }}>Shared Documents</div>
                  {activeConv.messages.filter((m) => m.type === "document" || m.type === "receipt").map((m) => (
                    <div key={m.id} style={{ padding: "8px 10px", background: S.surface, borderRadius: 8, marginBottom: 6, cursor: "pointer", fontFamily: S.font, fontSize: 12, color: S.muted, fontWeight: 600 }}>
                      {m.text}
                      <div style={{ fontSize: 10, color: S.light, fontWeight: 400, marginTop: 2 }}>{m.fileSize} · {m.time}</div>
                    </div>
                  ))}
                  {activeConv.messages.filter((m) => m.type === "document" || m.type === "receipt").length === 0 && (
                    <div style={{ fontFamily: S.font, fontSize: 12, color: S.light, padding: 8 }}>No documents shared yet</div>
                  )}
                  <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: S.light, marginBottom: 8, marginTop: 16, fontWeight: 600 }}>Actions</div>
                  {activeConv.propertyId && (
                    <button onClick={() => onNavigate("detail", activeConv.propertyId)} style={{ ...S.btn("#F0EBE3", S.muted), width: "100%", padding: "8px", fontSize: 12, marginBottom: 6 }}>
                      View Listing
                    </button>
                  )}
                  <button onClick={() => onNavigate("transaction")} style={{ ...S.btn("#F0EBE3", S.muted), width: "100%", padding: "8px", fontSize: 12, marginBottom: 6 }}>
                    View Transaction
                  </button>
                  {activeConv.linkedin && (
                    <a
                      href={activeConv.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ ...S.btn("#0A66C2", "#fff"), width: "100%", padding: "8px", fontSize: 12, marginBottom: 6, textDecoration: "none", textAlign: "center" }}
                    >
                      Open LinkedIn
                    </a>
                  )}
                  <button style={{ ...S.btn(S.redBg, S.red), width: "100%", padding: "8px", fontSize: 12 }}>
                    Report User
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontFamily: S.font, fontSize: 14, color: S.light }}>
            Select a conversation
          </div>
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════
// ─── MAIN APP ─────────────────────────────
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
// ─── LEGAL & COMPANY PAGES ───────────────
// ═══════════════════════════════════════════

function LegalPageLayout({ title, children, onBack }) {
  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: 24 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", fontFamily: S.font, fontSize: 14, color: S.gold, cursor: "pointer", fontWeight: 600, marginBottom: 20, padding: 0 }}>← Back</button>
      <h1 style={{ fontFamily: S.serif, fontSize: 32, color: S.dark, marginBottom: 6 }}>{title}</h1>
      <div style={{ fontFamily: S.font, fontSize: 12, color: S.light, marginBottom: 28 }}>Last updated: April 11, 2026 · EstateHat LLC</div>
      <div style={{ fontFamily: S.font, fontSize: 14.5, color: S.muted, lineHeight: 1.8 }}>{children}</div>
    </div>
  );
}

function LegalSection({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontFamily: S.font, fontSize: 17, fontWeight: 700, color: S.dark, marginBottom: 8 }}>{title}</h2>
      <div style={{ fontFamily: S.font, fontSize: 14, color: S.muted, lineHeight: 1.8 }}>{children}</div>
    </div>
  );
}

function AccordionSection({ title, isOpen, onToggle, children, dense = false }) {
  return (
    <Card style={{ marginBottom: 12, padding: 0, overflow: "hidden" }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          padding: dense ? "14px 18px" : "16px 20px",
          background: isOpen ? S.surfaceAlt : "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ fontFamily: S.font, fontSize: dense ? 14 : 15, fontWeight: 700, color: S.dark }}>{title}</span>
        <span style={{ fontSize: 14, color: S.light, transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}>▼</span>
      </button>
      {isOpen && (
        <div style={{ padding: dense ? "0 18px 16px" : "0 20px 18px", fontFamily: S.font, fontSize: 14, color: S.muted, lineHeight: 1.8 }}>
          {children}
        </div>
      )}
    </Card>
  );
}

export function TermsView({ onNavigate }) {
  const [openSection, setOpenSection] = useState(0);
  const sections = [
    ["1. Acceptance of Terms", `By creating an account or using EstateHat ("Platform"), you agree to these Terms of Service ("Terms"), our Privacy Policy, and applicable law. EstateHat LLC ("Company," "we," "us") provides software tools for peer-to-peer real estate transaction coordination among verified users and participating professionals. Your One EstateHat account is the single sign-in used across listings, search, messages, forms, Hat Data, Goodies, documents, support, and closing steps. If you do not agree to these Terms, do not use the Platform.`],
    ["2. Eligibility & Verification", `You must be at least 18 years of age and a verified United States citizen or lawful permanent resident to transact on EstateHat. All users must complete identity verification, including government-issued photo ID, selfie matching, and background screening. Corporate accounts must provide entity formation documents, EIN verification, authorized signer identification, and OFAC/sanctions screening. EstateHat reserves the right to deny or revoke access at any time if verification requirements are not met.`],
    ["3. Account Types & Responsibilities", `EstateHat offers the following account types: Buyer, Seller, Corporate Buyer, Corporate Seller, Attorney, Licensed Agent, Inspector, Lender, and Administrator. Each account type carries specific permissions and restrictions as outlined in our Role-Based Access Control policy. Professional roles (Attorney, Agent, Inspector, Lender) are mutually exclusive to prevent conflicts of interest. Users may not hold conflicting professional roles simultaneously. EstateHat may provide in-platform matching and collaboration tools to connect users with participating professionals, but users remain responsible for reviewing and selecting their own service providers. EstateHat does not create attorney-client, broker-client, escrow-agent, fiduciary, or advisory relationships between EstateHat and users by providing platform features or support.`],
    ["4. Fees & Payment", `EstateHat charges a flat 1.50% platform fee on the final sale price of each completed transaction. By default, the buyer pays that fee on top of the agreed property price. A seller can elect to absorb the 1.50% fee instead, in which case the buyer does not pay it. Additional flat fees include $500 for escrow services and $35 for wire transfers. All fees are disclosed prior to offer submission and on the closing disclosure or equivalent settlement paperwork. EstateHat does not charge listing fees or buyer access fees. Optional membership-style features (including Verified User status) may be offered in-product and are separately disclosed before activation. Fees are non-refundable once a transaction has closed.`],
    ["5. Escrow & Fund Handling", `EstateHat does not directly custody transaction funds. Transaction funds are intended to move through participating third-party escrow, title, and payment providers selected for a transaction workflow. EstateHat supports an integrated in-platform workflow for listings, matching, messaging, and transaction coordination, but use of platform-matched professionals is optional unless explicitly required by a specific transaction configuration. Fund release readiness depends on completion of required validation and documentation steps. EstateHat is not liable for delays caused by incomplete verification, documentation, or third-party processing timelines.`],
    ["5A. Product Surface Names", `Move Kit, Hat Data, and Goodies are EstateHat product-interface labels. Move Kit refers to plain-language buyer, seller, document, closing, and trust helpers. Hat Data refers to installed workflow items and data-oriented operating surfaces. Goodies refers to optional user-experience helpers. None of these labels creates legal, brokerage, title, escrow, lending, tax, appraisal, underwriting, investment, fiduciary, or advisory services.`],
    ["6. Property Listings & Photos", `Sellers and their authorized agents are solely responsible for the accuracy of listing information. All listings require a minimum of 4 exterior photos and 6 interior photos, which must be reviewed and approved by a third-party EstateHat administrator — never by the buyer or seller in the transaction. Misleading, altered, or stock photos will result in listing removal and possible account suspension. All property addresses are verified against mapping services and county records.`],
    ["7. Transaction Validation", `Every transaction must pass an 18-item validation checklist before closing can proceed. If even one item is incomplete or fails review, the transaction is blocked. This includes buyer and seller identity verification, U.S. citizenship/residency confirmation, document review, inspection completion, and attorney authorization. EstateHat reserves the right to halt any transaction at any stage if fraud, misrepresentation, or non-compliance is detected. Validation workflows are operational controls and do not constitute legal opinions, title opinions, underwriting decisions, or guarantees of legal enforceability.`],
    ["8. Limitation of Liability", `EstateHat is a technology platform. We are not a real estate brokerage, law firm, title company, bank, or insurance provider. We do not provide legal, financial, tax, underwriting, investment, lending, or appraisal advice, and nothing on the Platform is a substitute for licensed professional advice. The Platform is provided "as is" without warranties to the extent permitted by law. To the extent permitted by law, EstateHat LLC is not liable for indirect, incidental, special, consequential, exemplary, or punitive damages arising from Platform use. Our aggregate liability for a specific claim shall not exceed the fees collected by EstateHat for the transaction directly at issue.`],
    ["9. Dispute Resolution", `Any disputes arising from use of the Platform shall first be subject to good-faith mediation. If mediation fails, disputes shall be resolved through binding arbitration in Wake County, North Carolina, under the rules of the American Arbitration Association. Class action waiver: you agree to resolve disputes individually and waive any right to participate in class or collective proceedings.`],
    ["10. Termination", `EstateHat may suspend or terminate your account at any time for violation of these Terms, fraud, failure to maintain verification, or for any reason at our sole discretion. Upon termination, any pending transactions will be handled according to the escrow partner's policies. You may delete your account at any time, subject to completion of active transactions.`],
    ["11. Governing Law", `These Terms are governed by the laws of the State of North Carolina, without regard to conflict of law principles. Any legal action shall be brought exclusively in the state or federal courts of Wake County, North Carolina.`],
  ];
  return (
    <LegalPageLayout title="Terms of Service" onBack={() => onNavigate("dashboard")}>
      {sections.map(([title, body], index) => (
        <AccordionSection
          key={title}
          title={title}
          isOpen={openSection === index}
          onToggle={() => setOpenSection((current) => current === index ? null : index)}
        >
          {body}
        </AccordionSection>
      ))}
      <Card style={{ background: S.surfaceAlt, marginTop: 20 }}>
        <div style={{ fontFamily: S.font, fontSize: 13, color: S.muted, lineHeight: 1.6 }}>
          <strong>EstateHat LLC</strong><br />
          421 Fayetteville Street, Suite 1100<br />
          Raleigh, North Carolina 27601<br />
          legal@estatehat.com · (919) 555-0100<br />
          EIN: XX-XXXXXXX · Incorporated in North Carolina
        </div>
      </Card>
    </LegalPageLayout>
  );
}

export function PrivacyView({ onNavigate }) {
  const [openSection, setOpenSection] = useState(0);
  const sections = [
    ["1. Information We Collect", `We collect information you provide directly: full legal name, email, phone number, mailing address, One EstateHat account ID, government-issued photo ID, selfie images, Social Security Number or ITIN (verified through a third-party service — never stored on EstateHat servers), U.S. citizenship or residency documentation, professional licenses, and entity formation documents for corporate accounts. We also collect usage data including IP addresses, browser type, device information, pages visited, and actions taken on the Platform.`],
    ["2. How We Use Your Information", `Your information is used to: verify your identity and U.S. citizenship/residency status, facilitate real estate transactions between verified parties, prevent fraud and unauthorized access, comply with legal and regulatory requirements (KYC/AML), communicate with you about your transactions and account, operate Move Kit, Hat Data, and Goodies features, improve Platform performance and security, and generate anonymized analytics. We do not sell your personal information to third parties. We do not use your information for advertising purposes. We do not use account data to provide legal, financial, tax, or investment advice.`],
    ["3. Information Sharing", `We share your information only as needed for Platform operations and legal compliance, including with transaction counterparties (limited to relevant transaction details), escrow/title/payment providers supporting a transaction, identity/background service providers, infrastructure and security providers, and law enforcement or regulators when legally required. We do not sell personal information.`],
    ["4. Data Security", `We use administrative, technical, and organizational safeguards designed to protect personal data, including encryption in transit and at rest, access controls, logging, and account security features. No system is guaranteed to be 100% secure, but we work to reduce risk and respond to incidents.`],
    ["5. Data Retention & Deletion", `Account data is retained for the duration of your account plus 7 years for legal and regulatory compliance. Transaction records are retained for 10 years. Verification documents are retained for 5 years after account closure. You may request deletion of your account and personal data by contacting privacy@estatehat.com, subject to legal retention requirements.`],
    ["6. Your Rights", `You have the right to: access your personal data, correct inaccurate data, request deletion (subject to retention requirements), opt out of non-essential communications, and receive a copy of your data in a portable format. California residents may have additional rights under applicable California privacy laws. To exercise any right, contact privacy@estatehat.com.`],
    ["7. Contact", `EstateHat LLC, Privacy Team
421 Fayetteville Street, Suite 1100, Raleigh, NC 27601
privacy@estatehat.com · (919) 555-0100`],
  ];
  return (
    <LegalPageLayout title="Privacy Policy" onBack={() => onNavigate("dashboard")}>
      {sections.map(([title, body], index) => (
        <AccordionSection
          key={title}
          title={title}
          isOpen={openSection === index}
          onToggle={() => setOpenSection((current) => current === index ? null : index)}
        >
          <div style={{ whiteSpace: "pre-line" }}>{body}</div>
        </AccordionSection>
      ))}
    </LegalPageLayout>
  );
}

export function AboutView({ onNavigate }) {
  const isCompact = useMediaQuery("(max-width: 820px)");
  const [openContact, setOpenContact] = useState(0);
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      <button onClick={() => onNavigate("dashboard")} style={{ background: "none", border: "none", fontFamily: S.font, fontSize: 14, color: S.gold, cursor: "pointer", fontWeight: 600, marginBottom: 20, padding: 0 }}>← Back</button>

      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🎩</div>
        <h1 style={{ fontFamily: S.serif, fontSize: 36, color: S.dark, marginBottom: 8 }}>About EstateHat</h1>
        <p style={{ fontFamily: S.font, fontSize: 16, color: S.light, lineHeight: 1.6, maxWidth: 540, margin: "0 auto" }}>
          A Place Where You Can Hang Your Hat — an integrated real estate workflow platform built on trust, transparency, and U.S.-verified identities.
        </p>
      </div>

      <Card style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 18, color: S.dark, marginBottom: 10 }}>Our Mission</h2>
        <p style={{ fontFamily: S.font, fontSize: 14.5, color: S.muted, lineHeight: 1.8, margin: 0 }}>
          EstateHat exists to make real estate transactions accessible, transparent, and secure for every US Citizen and lawful permanent resident using the platform. We are building an in-platform ecosystem where listings, matching, messaging, checklists, forms, and transaction coordination work together in one place. Users can stay fully inside that workflow for speed and clarity, while still keeping flexibility to work with their own qualified professionals when needed.
        </p>
      </Card>

      <Card style={{ marginBottom: 20, background: S.surfaceAlt }}>
        <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1.1fr 0.9fr", gap: 18, alignItems: "start" }}>
          <div>
            <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: S.light, marginBottom: 8, fontWeight: 700 }}>
              Why EstateHat Exists
            </div>
            <div style={{ fontFamily: S.serif, fontSize: 30, color: S.dark, lineHeight: 1.08, marginBottom: 10 }}>
              More than a listing site.
            </div>
            <div style={{ fontFamily: S.font, fontSize: 13.5, color: S.muted, lineHeight: 1.7 }}>
              EstateHat is designed as an operating platform, not just a place to post or browse homes. Listings, identity, communication, legal steps, matching, and closing readiness all sit inside one connected workspace so people can keep moving without losing context.
            </div>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {[
              ["Platform model", "Listings, messages, forms, trust, and transaction flow connected"],
              ["User posture", "Built for verified buyers, sellers, professionals, admins, and approved government oversight"],
              ["Funds boundary", "EstateHat coordinates workflow; licensed third parties handle escrow and money movement"],
            ].map(([label, value]) => (
              <div key={label} style={{ borderRadius: 12, border: `1px solid ${S.border}`, background: S.card, padding: "12px 14px" }}>
                <div style={{ fontFamily: S.font, fontSize: 10.5, letterSpacing: 1.2, textTransform: "uppercase", color: S.light, fontWeight: 800 }}>{label}</div>
                <div style={{ fontFamily: S.font, fontSize: 12.5, color: S.dark, lineHeight: 1.55, marginTop: 6, fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <Card>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🇺🇸</div>
          <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 15, color: S.dark, marginBottom: 6 }}>US Citizen / Residency Verification</h3>
          <p style={{ fontFamily: S.font, fontSize: 13, color: S.light, lineHeight: 1.6, margin: 0 }}>Every buyer and seller must verify U.S. citizenship or permanent residency. No exceptions. This is a front-line fraud control before transactions are allowed to move forward.</p>
        </Card>
        <Card>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🔒</div>
          <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 15, color: S.dark, marginBottom: 6 }}>Escrow-Protected</h3>
          <p style={{ fontFamily: S.font, fontSize: 13, color: S.light, lineHeight: 1.6, margin: 0 }}>Every dollar moves through licensed escrow partners. No funds are released until all 18 validation checklist items are complete and verified.</p>
        </Card>
        <Card>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⚖️</div>
          <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 15, color: S.dark, marginBottom: 6 }}>Separation of Duties</h3>
          <p style={{ fontFamily: S.font, fontSize: 13, color: S.light, lineHeight: 1.6, margin: 0 }}>Attorneys can't be inspectors. Agents can't be lenders. Our role conflict matrix ensures no single party has too much power in any transaction.</p>
        </Card>
        <Card>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🧩</div>
          <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 15, color: S.dark, marginBottom: 6 }}>Integrated, Not Forced</h3>
          <p style={{ fontFamily: S.font, fontSize: 13, color: S.light, lineHeight: 1.6, margin: 0 }}>EstateHat works best as one connected workflow, but you can still bring your own qualified agent, inspector, or lender when appropriate.</p>
        </Card>
        <Card>
          <div style={{ fontSize: 28, marginBottom: 8 }}>💰</div>
          <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 15, color: S.dark, marginBottom: 6 }}>1.50% Flat Fee</h3>
          <p style={{ fontFamily: S.font, fontSize: 13, color: S.light, lineHeight: 1.6, margin: 0 }}>Traditional agents charge 5-6%. EstateHat charges a flat 1.50% platform fee. By default the buyer pays it on top of the sale price, and the seller can choose to absorb it instead. On a $500K home, that remains materially below a traditional commission structure.</p>
        </Card>
        <Card>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🏛️</div>
          <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 15, color: S.dark, marginBottom: 6 }}>Government Boundaries</h3>
          <p style={{ fontFamily: S.font, fontSize: 13, color: S.light, lineHeight: 1.6, margin: 0 }}>Approved government bodies can participate within platform and jurisdiction scope. Private out-of-boundary information requires judge-backed paperwork with the judge's name and signature before review.</p>
        </Card>
      </div>

      <Card style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 18, color: S.dark, marginBottom: 12 }}>Company Information</h2>
        <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1fr 1fr", gap: 20 }}>
          <div>
            {[
              ["Legal Name", "EstateHat LLC"],
              ["Founded", "2025"],
              ["Incorporated", "State of North Carolina"],
              ["EIN", "XX-XXXXXXX"],
              ["Type", "Limited Liability Company (LLC)"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${S.surface}`, fontFamily: S.font, fontSize: 13 }}>
                <span style={{ color: S.light }}>{k}</span><span style={{ color: S.dark, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
          <div>
            {[
              ["Headquarters", "Raleigh, NC 27601"],
              ["Industry", "PropTech / FinTech"],
              ["Platform", "Web, iOS, Android, Windows"],
              ["Users", "U.S. Citizens & Residents Only"],
              ["Platform Fee", "1.50% flat, buyer-paid by default"],
              ["Ecosystem Model", "In-platform first, optional external providers"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${S.surface}`, fontFamily: S.font, fontSize: 13 }}>
                <span style={{ color: S.light }}>{k}</span><span style={{ color: S.dark, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <h2 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 18, color: S.dark, marginBottom: 12 }}>Contact Us</h2>
        {[
          ["📧", "General", "hello@estatehat.com"],
          ["📈", "Investor / Finance", "investors@estatehat.com"],
          ["⚖️", "Legal", "legal@estatehat.com"],
          ["🔒", "Privacy", "privacy@estatehat.com"],
          ["🛡️", "Security", "security@estatehat.com"],
          ["📞", "Support", "(919) 555-0100"],
          ["📬", "Mail", "421 Fayetteville St\nSuite 1100\nRaleigh, NC 27601"],
        ].map(([icon, label, value], index) => (
          <AccordionSection
            key={label}
            title={`${icon} ${label}`}
            isOpen={openContact === index}
            onToggle={() => setOpenContact((current) => current === index ? null : index)}
            dense
          >
            <div style={{ color: S.gold, fontWeight: 600, whiteSpace: "pre-line" }}>{value}</div>
          </AccordionSection>
        ))}
      </Card>
    </div>
  );
}

export function InvestView({ onNavigate }) {
  const isCompact = useMediaQuery("(max-width: 820px)");
  const highlights = [
    ["Category", "PropTech / transaction workflow platform"],
    ["Entity", "EstateHat LLC, North Carolina"],
    ["Headquarters", "Raleigh, North Carolina"],
    ["Launch posture", "Production platform with public company pages and multi-device support"],
    ["Core users", "Verified U.S. buyers, sellers, and approved professionals"],
    ["Revenue model", "1.50% platform fee on completed transactions, buyer-paid by default unless seller absorbs"],
  ];
  const materials = [
    {
      title: "Investor Brochure",
      body: "A short visual overview of the company, product posture, trust model, and current monetization structure.",
      href: "/investor/estatehat-investor-brochure.pdf",
      cta: "Download brochure",
    },
    {
      title: "Business Plan",
      body: "A concise business-plan PDF covering product thesis, GTM posture, operating priorities, and model assumptions.",
      href: "/investor/estatehat-business-plan.pdf",
      cta: "Open business plan",
    },
    {
      title: "Financial Goals & Model",
      body: "A planning summary with revenue drivers, 12- and 24-month targets, and operating goals for investor conversations.",
      href: "/investor/estatehat-financial-goals-model.pdf",
      cta: "View financial model",
    },
  ];
  const investmentPoints = [
    {
      title: "Integrated workflow instead of disconnected tools",
      body: "EstateHat combines listings, messaging, forms, transaction checklists, and closing-readiness controls in one product surface so users do not have to bounce across separate vendors just to keep a deal moving.",
    },
    {
      title: "Identity-first trust and fraud controls",
      body: "Platform access and transaction flow are built around verified U.S. identities, role separation, and structured validation steps before a closing can move forward.",
    },
    {
      title: "Software margin model with third-party fund boundaries",
      body: "EstateHat coordinates workflow and fee logic inside the platform while licensed third parties handle escrow, title, and money movement, which keeps the operating model focused on software and compliance orchestration rather than direct custody.",
    },
  ];
  const tractionSignals = [
    "Production platform position announced March 31, 2026.",
    "Cross-device support across web, iOS, Android, and Windows appears throughout the public product materials.",
    "Public-facing legal, help, privacy, accessibility, and press pages are already part of the operating footprint.",
  ];
  const financialGoals = [
    ["12-month transaction goal", "100 completed transactions"],
    ["12-month GMV goal", "$35M transaction volume through the platform"],
    ["12-month platform-fee goal", "$525k modeled transaction-fee revenue at 1.50%"],
    ["12-month subscription goal", "600 paid Verified Users, equal to $144k annualized subscription revenue"],
    ["24-month transaction goal", "300 completed transactions"],
    ["24-month GMV goal", "$105M transaction volume through the platform"],
    ["24-month platform-fee goal", "$1.575M modeled transaction-fee revenue at 1.50%"],
    ["24-month subscription goal", "1,500 paid Verified Users, equal to $360k annualized subscription revenue"],
  ];
  const operatingGoals = [
    "Keep gross-margin mix focused on software and workflow revenue rather than direct custody or principal risk.",
    "Hold monthly burn below the level that would drop post-financing runway under 12 months.",
    "Reach contribution-margin-positive mature cohorts before broad GTM expansion.",
    "Move toward operating break-even after trust, compliance, and billing integrations are fully live.",
  ];
  const opportunityPoints = [
    "Residential transaction workflows are still fragmented across listings, documents, messaging, and closing coordination.",
    "Non-expert users need more trust signals and clearer step-by-step progression to stay in funnel.",
    "EstateHat’s product thesis is that guided workflow plus verification can improve execution quality and reduce avoidable friction.",
  ];
  const milestoneRows = [
    ["Product baseline", "Live public site, authenticated app shell, legal/help pages, and investor materials"],
    ["Monetization baseline", "1.50% transaction-fee model plus $20/month Verified User subscription"],
    ["Next 12 months", "Billing/payout integrations, KPI reporting cadence, funnel optimization, compliance hardening"],
    ["Next 24 months", "Scale completed transactions, improve cohort economics, and mature reporting for broader fundraising"],
  ];
  const useOfFunds = [
    "Compliance, counsel review, and trust/safety hardening",
    "Billing, payout, and operations integrations",
    "Measured growth testing and conversion optimization",
    "Security, analytics, and investor-reporting maturity",
  ];
  const trustCommitments = [
    "Build around workflow trust, operational clarity, and lower-friction execution rather than empty marketplace volume.",
    "Keep legal, escrow, and financial-advice boundaries explicit so investors can see where software responsibility starts and stops.",
    "Focus capital on durable product, compliance, and reporting improvements that make the platform more credible over time.",
  ];
  const welcomePoints = [
    "Investors should be able to understand the product quickly, access materials immediately, and know where diligence conversations begin.",
    "EstateHat is positioning this page as an entry point into a more serious process: packet review, diligence requests, follow-up calls, and structured updates.",
  ];
  const investorActions = [
    {
      title: "Get The Investor Packet",
      body: "Open the brochure, business plan, and financial goals set directly from the page.",
      cta: "Open materials",
      href: "/investor/estatehat-investor-brochure.pdf",
    },
    {
      title: "Request Data Room Access",
      body: "Start a direct email for diligence materials, assumptions, and follow-up document requests.",
      cta: "Request access",
      href: "mailto:investors@estatehat.com?subject=EstateHat%20Data%20Room%20Request&body=Hello%20EstateHat%2C%0A%0AI%20would%20like%20to%20request%20investor%20data%20room%20access.%20Please%20send%20the%20next%20steps.%0A%0AName%3A%0AFirm%3A%0AReason%20for%20request%3A%0A",
    },
    {
      title: "Join Investor Updates",
      body: "Request periodic product, milestone, and investor-facing company updates.",
      cta: "Join updates",
      href: "mailto:investors@estatehat.com?subject=EstateHat%20Investor%20Updates&body=Hello%20EstateHat%2C%0A%0APlease%20add%20me%20to%20investor%20updates.%0A%0AName%3A%0AFirm%3A%0AEmail%3A%0A",
    },
    {
      title: "Schedule An Intro Call",
      body: "Open a direct path for strategic partners, accredited investors, and financing conversations.",
      cta: "Email investor relations",
      href: "mailto:investors@estatehat.com?subject=EstateHat%20Investor%20Intro%20Call&body=Hello%20EstateHat%2C%0A%0AI%20would%20like%20to%20schedule%20an%20introductory%20conversation.%0A%0AName%3A%0AFirm%3A%0AAvailability%3A%0A",
    },
    {
      title: "Square Invoice Link",
      body: "Square invoicing will be added here once the live payment link is provided.",
      cta: "Link pending",
      href: "",
      pending: true,
    },
  ];
  const incentiveSignals = [
    "Immediate access to brochure, plan, and model documents",
    "Clear diligence path for qualified follow-up conversations",
    "Direct investor-relations contact instead of a dead-end contact block",
  ];
  const diligenceItems = [
    "Investor brochure, business plan, and financial model are live and downloadable from this page.",
    "Public legal, privacy, FAQ, accessibility, and press pages are part of the live company surface.",
    "Direct diligence requests route into investor relations for follow-up materials and structured review.",
  ];
  const riskPosture = [
    "EstateHat is still in an execution-heavy phase, so billing, payout, compliance, and reporting maturity remain important to long-term value creation.",
    "Current public goals are planning targets, not audited results, and should be read alongside diligence materials rather than as stand-alone financial proof.",
    "The company is explicitly avoiding blurred boundaries around legal advice, fund custody, and regulated-party responsibilities.",
  ];
  const investorFaq = [
    {
      q: "What is the core bet behind EstateHat?",
      a: "That trust, guided workflow, and clearer operational structure can materially improve how non-expert users navigate real estate transactions.",
    },
    {
      q: "How does EstateHat intend to make money?",
      a: "Primarily through a 1.50% platform fee on completed transactions and a $20/month Verified User subscription model shown in the current product posture.",
    },
    {
      q: "What should investors expect this page to do?",
      a: "Serve as the front door for materials, diligence requests, update requests, and direct investor-relations contact, not as a substitute for a full data room.",
    },
    {
      q: "What still has to be proven?",
      a: "Sustained transaction conversion, deeper integration maturity, durable reporting cadence, and evidence that trust-first positioning improves operating outcomes over time.",
    },
  ];

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: 24 }}>
      <button onClick={() => onNavigate("dashboard")} style={{ background: "none", border: "none", fontFamily: S.font, fontSize: 14, color: S.gold, cursor: "pointer", fontWeight: 600, marginBottom: 20, padding: 0 }}>← Back</button>
      <SectionHeader title="Invest" sub="A brief overview of EstateHat for investors, strategic partners, and finance conversations." />

      <Card style={{ marginBottom: 20, background: S.surfaceAlt }}>
        <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1.05fr 0.95fr", gap: 18, alignItems: "start" }}>
          <div>
            <div style={{ fontFamily: S.font, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: S.light, marginBottom: 8, fontWeight: 700 }}>
              EstateHat at a glance
            </div>
            <div style={{ fontFamily: S.serif, fontSize: 31, color: S.dark, lineHeight: 1.08, marginBottom: 10 }}>
              Real estate workflow, trust, and transaction coordination in one platform.
            </div>
            <div style={{ fontFamily: S.font, fontSize: 14, color: S.muted, lineHeight: 1.75 }}>
              EstateHat is building an integrated operating layer for peer-to-peer real estate transactions. The platform is designed to reduce friction between listing discovery, identity verification, communication, paperwork, and closing readiness while maintaining clear boundaries around legal, escrow, and financial-advice functions.
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
              {materials.map((item) => (
                <a
                  key={item.title}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    textDecoration: "none",
                    fontFamily: S.font,
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: S.dark,
                    background: "#efe1c6",
                    border: `1px solid ${S.border}`,
                    borderRadius: 999,
                    padding: "10px 14px",
                  }}
                >
                  {item.title}
                </a>
              ))}
            </div>
            <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
              {incentiveSignals.map((item) => (
                <div key={item} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ color: S.gold, fontWeight: 700 }}>•</span>
                  <span style={{ fontFamily: S.font, fontSize: 12.75, color: S.muted, lineHeight: 1.65 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {highlights.map(([label, value]) => (
              <div key={label} style={{ borderRadius: 12, border: `1px solid ${S.border}`, background: S.card, padding: "12px 14px" }}>
                <div style={{ fontFamily: S.font, fontSize: 10.5, letterSpacing: 1.2, textTransform: "uppercase", color: S.light, fontWeight: 800 }}>{label}</div>
                <div style={{ fontFamily: S.font, fontSize: 12.5, color: S.dark, lineHeight: 1.55, marginTop: 6, fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 18, color: S.dark, marginBottom: 12 }}>Why Investors Should Feel Welcome Here</h2>
        <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1fr 1fr", gap: 20 }}>
          <div style={{ display: "grid", gap: 10 }}>
            {welcomePoints.map((item) => (
              <div key={item} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ color: S.gold, fontWeight: 700 }}>•</span>
                <span style={{ fontFamily: S.font, fontSize: 13.5, color: S.muted, lineHeight: 1.7 }}>{item}</span>
              </div>
            ))}
          </div>
          <div style={{ borderRadius: 12, border: `1px solid ${S.border}`, background: S.surfaceAlt, padding: "14px 16px" }}>
            <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: S.gold, marginBottom: 10 }}>Capital stewardship posture</div>
            <div style={{ display: "grid", gap: 10 }}>
              {trustCommitments.map((item) => (
                <div key={item} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ color: S.gold, fontWeight: 700 }}>•</span>
                  <span style={{ fontFamily: S.font, fontSize: 13, color: S.muted, lineHeight: 1.7 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
        {investmentPoints.map((point) => (
          <Card key={point.title}>
            <h3 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 15, color: S.dark, marginBottom: 8 }}>{point.title}</h3>
            <p style={{ fontFamily: S.font, fontSize: 13.5, color: S.light, lineHeight: 1.7, margin: 0 }}>{point.body}</p>
          </Card>
        ))}
      </div>

      <Card style={{ marginBottom: 20, background: S.surfaceAlt }}>
        <h2 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 18, color: S.dark, marginBottom: 12 }}>Investor Next Steps</h2>
        <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1fr 1fr", gap: 14 }}>
          {investorActions.map((item) => (
            <div key={item.title} style={{ borderRadius: 12, border: `1px solid ${S.border}`, background: S.card, padding: "16px 16px 18px" }}>
              <div style={{ fontFamily: S.font, fontSize: 15, fontWeight: 700, color: S.dark, marginBottom: 8 }}>{item.title}</div>
              <div style={{ fontFamily: S.font, fontSize: 13, color: S.muted, lineHeight: 1.7, marginBottom: 14 }}>{item.body}</div>
              {item.pending ? (
                <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 42, padding: "0 14px", borderRadius: 999, background: S.card, color: S.light, textDecoration: "none", fontFamily: S.font, fontSize: 12.5, fontWeight: 700, border: `1px dashed ${S.border}` }}>
                  {item.cta}
                </div>
              ) : (
                <a
                  href={item.href}
                  target={item.href.startsWith("mailto:") ? undefined : "_blank"}
                  rel={item.href.startsWith("mailto:") ? undefined : "noreferrer"}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 42,
                    padding: "0 14px",
                    borderRadius: 999,
                    background: "#efe1c6",
                    color: S.dark,
                    textDecoration: "none",
                    fontFamily: S.font,
                    fontSize: 12.5,
                    fontWeight: 700,
                    border: `1px solid ${S.border}`,
                  }}
                >
                  {item.cta}
                </a>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 18, color: S.dark, marginBottom: 12 }}>Why This Category</h2>
        <div style={{ display: "grid", gap: 10 }}>
          {opportunityPoints.map((item) => (
            <div key={item} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ color: S.gold, fontWeight: 700 }}>•</span>
              <span style={{ fontFamily: S.font, fontSize: 13.5, color: S.muted, lineHeight: 1.7 }}>{item}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 18, color: S.dark, marginBottom: 12 }}>Business Model</h2>
        <div style={{ fontFamily: S.font, fontSize: 14, color: S.muted, lineHeight: 1.8 }}>
          EstateHat’s current public fee model is a flat 1.50% platform fee on completed transactions. The buyer pays that fee by default on top of the sale price unless the seller elects to absorb it. Additional escrow and payment-rail fees may apply by transaction configuration, but EstateHat positions itself as the software coordination layer rather than the direct holder of client funds.
        </div>
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 18, color: S.dark, marginBottom: 12 }}>Public Diligence Map</h2>
        <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1fr 1fr", gap: 20 }}>
          <div style={{ display: "grid", gap: 10 }}>
            {diligenceItems.map((item) => (
              <div key={item} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ color: S.gold, fontWeight: 700 }}>•</span>
                <span style={{ fontFamily: S.font, fontSize: 13.5, color: S.muted, lineHeight: 1.7 }}>{item}</span>
              </div>
            ))}
          </div>
          <div style={{ borderRadius: 12, border: `1px solid ${S.border}`, background: S.surfaceAlt, padding: "14px 16px" }}>
            <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: S.gold, marginBottom: 10 }}>What happens next</div>
            <div style={{ display: "grid", gap: 10 }}>
              {[
                "Review the public packet and PDFs first.",
                "Request diligence materials or investor updates through investor relations.",
                "Move qualified conversations into direct follow-up and structured review.",
              ].map((item) => (
                <div key={item} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ color: S.gold, fontWeight: 700 }}>•</span>
                  <span style={{ fontFamily: S.font, fontSize: 13, color: S.muted, lineHeight: 1.7 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 18, color: S.dark, marginBottom: 12 }}>Investor Materials</h2>
        <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1fr 1fr 1fr", gap: 14 }}>
          {materials.map((item) => (
            <div key={item.title} style={{ height: "100%", borderRadius: 12, border: `1px solid ${S.border}`, background: S.surfaceAlt, padding: "16px 16px 18px" }}>
              <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: S.gold, marginBottom: 8 }}>PDF download</div>
              <div style={{ fontFamily: S.font, fontSize: 15, fontWeight: 700, color: S.dark, marginBottom: 8 }}>{item.title}</div>
              <div style={{ fontFamily: S.font, fontSize: 13, color: S.muted, lineHeight: 1.7, marginBottom: 14 }}>{item.body}</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <a
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    textDecoration: "none",
                    fontFamily: S.font,
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: S.dark,
                    background: "#efe1c6",
                    border: `1px solid ${S.border}`,
                    borderRadius: 999,
                    padding: "10px 14px",
                  }}
                >
                  {item.cta}
                </a>
                <a
                  href={item.href}
                  download
                  style={{
                    textDecoration: "none",
                    fontFamily: S.font,
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: S.gold,
                    border: `1px solid ${S.border}`,
                    borderRadius: 999,
                    padding: "10px 14px",
                    background: S.card,
                  }}
                >
                  Save PDF
                </a>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 18, color: S.dark, marginBottom: 12 }}>Execution Risk And Boundary Posture</h2>
        <div style={{ display: "grid", gap: 10 }}>
          {riskPosture.map((item) => (
            <div key={item} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ color: S.gold, fontWeight: 700 }}>•</span>
              <span style={{ fontFamily: S.font, fontSize: 13.5, color: S.muted, lineHeight: 1.7 }}>{item}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 18, color: S.dark, marginBottom: 12 }}>Current Operating Signals</h2>
        <div style={{ display: "grid", gap: 10 }}>
          {tractionSignals.map((item) => (
            <div key={item} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ color: S.gold, fontWeight: 700 }}>•</span>
              <span style={{ fontFamily: S.font, fontSize: 13.5, color: S.muted, lineHeight: 1.7 }}>{item}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 18, color: S.dark, marginBottom: 12 }}>Financial Goals</h2>
        <div style={{ fontFamily: S.font, fontSize: 13.5, color: S.muted, lineHeight: 1.8, marginBottom: 16 }}>
          These are planning targets for investor discussions, not historical results or guarantees. They are built around the current public product model: transaction-fee revenue at 1.50% plus paid Verified User subscriptions at $20 per month.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1fr 1fr", gap: 20, marginBottom: 14 }}>
          <div>
            {financialGoals.map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "8px 0", borderBottom: `1px solid ${S.surface}`, fontFamily: S.font, fontSize: 13 }}>
                <span style={{ color: S.light }}>{label}</span>
                <span style={{ color: S.dark, fontWeight: 700, textAlign: "right" }}>{value}</span>
              </div>
            ))}
          </div>
          <div style={{ borderRadius: 12, border: `1px solid ${S.border}`, background: S.surfaceAlt, padding: "14px 16px" }}>
            <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: S.gold, marginBottom: 10 }}>Operating aims</div>
            <div style={{ display: "grid", gap: 10 }}>
              {operatingGoals.map((goal) => (
                <div key={goal} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ color: S.gold, fontWeight: 700 }}>•</span>
                  <span style={{ fontFamily: S.font, fontSize: 13, color: S.muted, lineHeight: 1.7 }}>{goal}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 18, color: S.dark, marginBottom: 12 }}>Investor FAQ</h2>
        <div style={{ display: "grid", gap: 12 }}>
          {investorFaq.map((item) => (
            <div key={item.q} style={{ borderRadius: 12, border: `1px solid ${S.border}`, background: S.surfaceAlt, padding: "14px 16px" }}>
              <div style={{ fontFamily: S.font, fontSize: 13.5, fontWeight: 700, color: S.dark, marginBottom: 6 }}>{item.q}</div>
              <div style={{ fontFamily: S.font, fontSize: 13, color: S.muted, lineHeight: 1.7 }}>{item.a}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 18, color: S.dark, marginBottom: 12 }}>Milestones And Use Of Funds</h2>
        <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1.08fr 0.92fr", gap: 20 }}>
          <div>
            {milestoneRows.map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "8px 0", borderBottom: `1px solid ${S.surface}`, fontFamily: S.font, fontSize: 13 }}>
                <span style={{ color: S.light }}>{label}</span>
                <span style={{ color: S.dark, fontWeight: 700, textAlign: "right" }}>{value}</span>
              </div>
            ))}
          </div>
          <div style={{ borderRadius: 12, border: `1px solid ${S.border}`, background: S.surfaceAlt, padding: "14px 16px" }}>
            <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: S.gold, marginBottom: 10 }}>Expected capital focus</div>
            <div style={{ display: "grid", gap: 10 }}>
              {useOfFunds.map((item) => (
                <div key={item} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ color: S.gold, fontWeight: 700 }}>•</span>
                  <span style={{ fontFamily: S.font, fontSize: 13, color: S.muted, lineHeight: 1.7 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: S.font, fontWeight: 700, fontSize: 18, color: S.dark, marginBottom: 12 }}>Investor Contact</h2>
        <div style={{ fontFamily: S.font, fontSize: 14, color: S.muted, lineHeight: 1.8 }}>
          Finance and investor inquiries can be directed to <span style={{ color: S.gold, fontWeight: 700 }}>investors@estatehat.com</span>.<br />
          EstateHat LLC<br />
          421 Fayetteville Street, Suite 1100<br />
          Raleigh, NC 27601<br />
          (919) 555-0100
        </div>
      </Card>

      <Card>
        <div style={{ fontFamily: S.font, fontSize: 12.5, color: S.light, lineHeight: 1.75 }}>
          This page is provided for general company information only. It is not an offer to sell securities, a solicitation to buy securities, or legal, tax, or investment advice. Any financing or investment discussion should be handled directly with EstateHat and appropriate professional advisors.
        </div>
      </Card>
    </div>
  );
}

export function PressView({ onNavigate }) {
  const updates = [
    {
      title: "EstateHat launches production platform for peer-to-peer real estate transactions",
      date: "March 31, 2026",
      body: "EstateHat has moved from internal testing into production, bringing verified user onboarding, listing workflows, transaction tracking, and integrated messaging into one platform experience.",
    },
    {
      title: "EstateHat outlines identity-first fraud prevention model",
      date: "March 12, 2026",
      body: "The company published its operating approach for identity verification, role separation, and transaction controls designed to reduce fraud risk across buyer, seller, and professional participant flows.",
    },
    {
      title: "EstateHat expands platform support across web, iOS, and Windows",
      date: "February 18, 2026",
      body: "EstateHat confirmed support for cross-device access so users can manage listings, documents, and transaction activity from the device that fits their workflow.",
    },
  ];

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: 24 }}>
      <button onClick={() => onNavigate("dashboard")} style={{ background: "none", border: "none", fontFamily: S.font, fontSize: 14, color: S.gold, cursor: "pointer", fontWeight: 600, marginBottom: 20, padding: 0 }}>← Back</button>
      <SectionHeader title="Press" sub="Company updates, announcements, and media contact information" />

      <Card style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: S.font, fontSize: 14, color: S.muted, lineHeight: 1.8 }}>
          EstateHat is a Raleigh-based real estate platform focused on verified identities, structured transaction workflows, and lower-friction peer-to-peer property transactions.
        </div>
      </Card>

      {updates.map((item) => (
        <Card key={item.title} style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: S.gold, marginBottom: 10 }}>{item.date}</div>
          <div style={{ fontFamily: S.serif, fontSize: 24, color: S.dark, marginBottom: 10 }}>{item.title}</div>
          <div style={{ fontFamily: S.font, fontSize: 14, color: S.muted, lineHeight: 1.75 }}>{item.body}</div>
        </Card>
      ))}

      <Card>
        <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, marginBottom: 8 }}>Media Contact</div>
        <div style={{ fontFamily: S.font, fontSize: 14, color: S.muted, lineHeight: 1.8 }}>
          press@estatehat.com<br />
          EstateHat LLC<br />
          421 Fayetteville Street, Suite 1100<br />
          Raleigh, NC 27601
        </div>
      </Card>
    </div>
  );
}

export function AccessibilityView({ onNavigate }) {
  return (
    <LegalPageLayout title="Accessibility" onBack={() => onNavigate("dashboard")}>
      <LegalSection title="1. Accessibility Commitment">
        EstateHat is committed to providing a platform that is usable by as many people as possible, including users who rely on assistive technologies. We aim to support keyboard navigation, readable contrast, clear labeling, and consistent interface structure across core workflows.
      </LegalSection>
      <LegalSection title="2. Ongoing Improvements">
        Accessibility work is ongoing. We regularly review navigation patterns, form labels, focus states, responsive layouts, and content hierarchy to improve the experience across listing discovery, account management, messaging, and transaction workflows.
      </LegalSection>
      <LegalSection title="3. Known Limitations">
        Some workflows may continue to evolve as EstateHat expands platform capabilities. If you encounter content that is difficult to access, incomplete screen reader labeling, insufficient contrast, or keyboard traps, we want to hear about it so we can address it directly.
      </LegalSection>
      <LegalSection title="4. Contact">
        To report an accessibility issue or request accommodation, contact accessibility@estatehat.com or write to EstateHat LLC, 421 Fayetteville Street, Suite 1100, Raleigh, NC 27601. Please include the page you visited, the device or browser you used, and a short description of the issue.
      </LegalSection>
    </LegalPageLayout>
  );
}

export function DmcaView({ onNavigate }) {
  return (
    <LegalPageLayout title="DMCA Policy" onBack={() => onNavigate("dashboard")}>
      <LegalSection title="1. Reporting Copyright Claims">
        EstateHat respects intellectual property rights. If you believe content on the platform infringes your copyright, send a written notice that identifies the copyrighted work, the specific allegedly infringing material, your contact information, and a statement made in good faith under penalty of perjury.
      </LegalSection>
      <LegalSection title="2. Required Notice Contents">
        Your notice should include: your name and signature, a description of the copyrighted work, the exact URL or location of the allegedly infringing content, your mailing address, email, and phone number, and a statement that you are authorized to act on behalf of the copyright owner.
      </LegalSection>
      <LegalSection title="3. Counter Notices">
        If you believe material was removed or disabled in error, you may submit a counter notice that identifies the removed content, explains why you believe the removal was mistaken, and includes your consent to the jurisdiction of the appropriate court.
      </LegalSection>
      <LegalSection title="4. DMCA Agent">
        DMCA Agent<br />
        EstateHat LLC<br />
        421 Fayetteville Street, Suite 1100<br />
        Raleigh, NC 27601<br />
        dmca@estatehat.com
      </LegalSection>
    </LegalPageLayout>
  );
}

// ─── MORTGAGE CALCULATOR ─────────────────
function CalculatorView({ onNavigate, userKey = "guest" }) {
  const isCompact = useMediaQuery("(max-width: 820px)");
  const [price, setPrice] = useState(425000);
  const [down, setDown] = useState(20);
  const [rate, setRate] = useState(6.5);
  const [term, setTerm] = useState(30);

  const calc = useMemo(() => {
    const loanAmt = price * (1 - down / 100);
    const monthlyRate = rate / 100 / 12;
    const numPayments = term * 12;
    const monthlyPayment = monthlyRate > 0 ? loanAmt * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1) : loanAmt / numPayments;
    const totalPaid = monthlyPayment * numPayments;
    const totalInterest = totalPaid - loanAmt;
    const fee = calcFees(price);
    return { loanAmt, monthlyPayment: Math.round(monthlyPayment), totalPaid: Math.round(totalPaid), totalInterest: Math.round(totalInterest), downAmt: Math.round(price * down / 100), fee };
  }, [price, down, rate, term]);

  const sliderLabel = { fontFamily: S.font, fontSize: 12, fontWeight: 600, color: S.muted, marginBottom: 4 };
  const sliderRow = { display: "flex", alignItems: "center", gap: 12, marginBottom: 16 };

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: 24 }}>
      <button onClick={() => onNavigate("dashboard")} style={{ background: "none", border: "none", fontFamily: S.font, fontSize: 14, color: S.gold, cursor: "pointer", fontWeight: 600, marginBottom: 20, padding: 0 }}>← Back</button>
      <SectionHeader title="Mortgage Calculator" sub="Estimate your monthly payment and see how EstateHat saves you money" />

      <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1fr 1fr 1fr", gap: 14, marginBottom: 24 }}>
        <div style={{ textAlign: "center", padding: 18, background: S.card, borderRadius: 14, border: `1px solid ${S.border}`, borderTop: `4px solid ${S.gold}` }}>
          <div style={{ fontFamily: S.serif, fontSize: 28, color: S.gold }}>{fmt(calc.monthlyPayment)}</div>
          <div style={{ fontFamily: S.font, fontSize: 12, color: S.light }}>Monthly Payment</div>
        </div>
        <div style={{ textAlign: "center", padding: 18, background: S.card, borderRadius: 14, border: `1px solid ${S.border}` }}>
          <div style={{ fontFamily: S.serif, fontSize: 28, color: S.dark }}>{fmt(calc.loanAmt)}</div>
          <div style={{ fontFamily: S.font, fontSize: 12, color: S.light }}>Loan Amount</div>
        </div>
        <div style={{ textAlign: "center", padding: 18, background: S.card, borderRadius: 14, border: `1px solid ${S.border}` }}>
          <div style={{ fontFamily: S.serif, fontSize: 28, color: S.green }}>{fmt(calc.fee.savings)}</div>
          <div style={{ fontFamily: S.font, fontSize: 12, color: S.green }}>Saved vs. Agent</div>
        </div>
      </div>

      <Card style={{ marginBottom: 20 }}>
        <div style={sliderLabel}>Home Price: <strong style={{ color: S.dark }}>{fmt(price)}</strong></div>
        <div style={sliderRow}>
          <input type="range" min={100000} max={2000000} step={5000} value={price} onChange={(e) => setPrice(+e.target.value)} style={{ flex: 1 }} />
        </div>
        <div style={sliderLabel}>Down Payment: <strong style={{ color: S.dark }}>{down}% ({fmt(calc.downAmt)})</strong></div>
        <div style={sliderRow}>
          <input type="range" min={0} max={50} step={1} value={down} onChange={(e) => setDown(+e.target.value)} style={{ flex: 1 }} />
        </div>
        <div style={sliderLabel}>Interest Rate: <strong style={{ color: S.dark }}>{rate}%</strong></div>
        <div style={sliderRow}>
          <input type="range" min={2} max={12} step={0.1} value={rate} onChange={(e) => setRate(+e.target.value)} style={{ flex: 1 }} />
        </div>
        <div style={sliderLabel}>Loan Term: <strong style={{ color: S.dark }}>{term} years</strong></div>
        <div style={sliderRow}>
          {[15, 20, 30].map((t) => (
            <button key={t} onClick={() => setTerm(t)} style={{ ...S.btn(term === t ? S.gold : "#F0EBE3", term === t ? S.dark : S.muted), padding: "8px 20px", fontSize: 13 }}>{t} yr</button>
          ))}
        </div>
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 15, color: S.dark, marginBottom: 12 }}>Payment Breakdown</div>
        {[
          ["Home Price", fmt(price)],
          ["Down Payment (" + down + "%)", fmt(calc.downAmt)],
          ["Loan Amount", fmt(calc.loanAmt)],
          ["Total Interest (" + term + " yr)", fmt(calc.totalInterest)],
          ["Total Paid", fmt(calc.totalPaid)],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${S.surface}`, fontFamily: S.font, fontSize: 13, color: S.muted }}>
            <span>{k}</span><span style={{ fontWeight: 600, color: S.dark }}>{v}</span>
          </div>
        ))}
      </Card>

      <FeeBreakdown price={price} />
      <EstateHatFinancialTools key={userKey} userKey={userKey} />
    </div>
  );
}

const PROFESSIONAL_MATCH_DIRECTORY = [];
const MATCH_ROLE_LABELS = {
  agent: "Agent",
  inspector: "Inspector",
  lender: "Lender",
};

function MatchingServiceView({ onNavigate, user, featuredPlacements = [], saleTargets = [], attachedByDeal = {}, onAttachProfessional = () => {} }) {
  const isCompact = useMediaQuery("(max-width: 820px)");
  const [market, setMarket] = useState("Raleigh");
  const [propertyType, setPropertyType] = useState("Single Family");
  const [timeline, setTimeline] = useState("30-60 days");
  const [rolesWanted, setRolesWanted] = useState({ agent: true, inspector: true, lender: true });
  const [requested, setRequested] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState(saleTargets[0]?.id || "");
  const [attachNotice, setAttachNotice] = useState("");
  const [priority, setPriority] = useState("balanced");
  const [budget, setBudget] = useState("standard");
  const [financingStatus, setFinancingStatus] = useState("preapproval-needed");
  const [notes, setNotes] = useState("");
  const [matchRequests, setMatchRequests] = useLocalStorageState("estatehat-match-requests-v1", []);
  const [inviteDraft, setInviteDraft] = useState({ name: "", email: "", role: "agent", company: "" });
  const [featureHeadline, setFeatureHeadline] = useState("");
  const [featureCompany, setFeatureCompany] = useState("");
  const [featureMarket, setFeatureMarket] = useState("Raleigh");
  const [featureNote, setFeatureNote] = useState("");
  const [featureBusy, setFeatureBusy] = useState(false);
  const [featureError, setFeatureError] = useState("");
  const canAttachToSale = ["seller", "corp_seller"].includes(user?.accountType);
  const canFeatureService = ["agent", "inspector", "lender"].includes(user?.accountType);
  const debouncedMarket = useDebounce(market, 150);
  const featuredServicePlacements = useMemo(() => {
    const normalizedMarket = debouncedMarket.trim().toLowerCase();
    return getActiveFeaturedPlacements(featuredPlacements, "service")
      .filter((placement) => {
        if (!normalizedMarket) return true;
        return String(placement.market || "").toLowerCase().includes(normalizedMarket);
      })
      .slice(0, 6);
  }, [debouncedMarket, featuredPlacements]);
  const myActiveServicePlacement = useMemo(
    () => getActiveFeaturedPlacements(featuredPlacements, "service").find((placement) => placement.uid === user?.uid) || null,
    [featuredPlacements, user?.uid]
  );

  const selectedRoles = useMemo(
    () => Object.entries(rolesWanted).filter(([, enabled]) => enabled).map(([role]) => role),
    [rolesWanted]
  );

  const matches = useMemo(() => {
    return [];
  }, []);
  const matchingReadiness = useMemo(() => {
    const checks = [
      market.trim().length >= 2,
      !!propertyType,
      !!timeline,
      selectedRoles.length > 0,
      priority !== "",
      budget !== "",
      financingStatus !== "",
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [budget, financingStatus, market, priority, propertyType, selectedRoles.length, timeline]);
  const servicePlan = useMemo(() => {
    return selectedRoles.map((role, index) => ({
      role,
      label: MATCH_ROLE_LABELS[role],
      status: index === 0 ? "First intro" : "Chained intro",
      detail: role === "agent"
        ? "Coordinate offer strategy, showing access, and negotiation support."
        : role === "inspector"
          ? "Review property condition, repair flags, and inspection timing."
          : "Review preapproval, loan timeline, and escrow funding readiness.",
    }));
  }, [selectedRoles]);
  const selectedTarget = useMemo(
    () => saleTargets.find((target) => target.id === selectedTargetId) || saleTargets[0] || null,
    [saleTargets, selectedTargetId]
  );

  function saveMatchRequest() {
    if (selectedRoles.length === 0) return;
    const request = {
      id: `MATCH-${Date.now()}`,
      market: market.trim() || "Selected market",
      propertyType,
      timeline,
      priority,
      budget,
      financingStatus,
      roles: selectedRoles,
      notes: notes.trim(),
      targetId: selectedTarget?.id || "",
      targetProperty: selectedTarget?.property || "",
      createdAt: new Date().toISOString(),
      status: "Queued",
      readiness: matchingReadiness,
    };
    setMatchRequests((current) => [request, ...current].slice(0, 12));
    setRequested(true);
  }

  function attachManualProfessional() {
    const cleanName = inviteDraft.name.trim();
    const cleanEmail = inviteDraft.email.trim();
    if (!selectedTarget || !cleanName || !cleanEmail.includes("@")) return;
    onAttachProfessional({
      dealId: selectedTarget.id,
      property: selectedTarget.property,
      professional: {
        id: `manual-${Date.now()}`,
        name: cleanName,
        role: inviteDraft.role,
        email: cleanEmail,
        company: inviteDraft.company.trim(),
        linkedin: "",
      },
    });
    setAttachNotice(`${cleanName} added to ${selectedTarget.id}. Conversation access is now attached to this sale.`);
    setInviteDraft({ name: "", email: "", role: "agent", company: "" });
  }

  async function launchFeaturedServiceCheckout() {
    if (!canFeatureService) return;
    setFeatureBusy(true);
    setFeatureError("");
    try {
      const payload = await postStripeAction("featured-placement-checkout", {
        placementType: "service",
        headline: featureHeadline.trim() || `${user?.name || "EstateHat Pro"} · ${featuredServiceRoleLabel(user?.accountType)}`,
        company: featureCompany.trim(),
        market: featureMarket.trim(),
        note: featureNote.trim(),
        acknowledged: true,
      }, { auth });
      redirectToStripeUrl(payload.url);
    } catch (error) {
      setFeatureError(error instanceof Error ? error.message : "Unable to start featured service checkout.");
    } finally {
      setFeatureBusy(false);
    }
  }

  useEffect(() => {
    if (!saleTargets.length) {
      setSelectedTargetId("");
      return;
    }
    if (!saleTargets.some((target) => target.id === selectedTargetId)) {
      setSelectedTargetId(saleTargets[0].id);
    }
  }, [saleTargets, selectedTargetId]);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <button onClick={() => onNavigate("dashboard")} style={{ background: "none", border: "none", fontFamily: S.font, fontSize: 14, color: S.gold, cursor: "pointer", fontWeight: 600, marginBottom: 20, padding: 0 }}>← Back</button>
      <SectionHeader title="Match Services" sub="Find a verified agent, inspector, and lender that fit your timeline and market." />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, marginBottom: 10 }}>What you need</div>
        <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1fr 1fr", gap: 12 }}>
          <div>
            <label style={S.label}>Target market</label>
            <input value={market} onChange={(e) => setMarket(e.target.value)} placeholder="City (e.g., Raleigh)" style={S.input} />
          </div>
          <div>
            <label style={S.label}>Property type</label>
            <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)} style={S.input}>
              {["Single Family", "Condo", "Townhome", "Multi-Family", "Land"].map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={S.label}>Timeline</label>
            <select value={timeline} onChange={(e) => setTimeline(e.target.value)} style={S.input}>
              {["0-30 days", "30-60 days", "60-90 days", "90+ days"].map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={S.label}>Services needed</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
              {["agent", "inspector", "lender"].map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setRolesWanted((current) => ({ ...current, [role]: !current[role] }))}
                  style={{
                    ...S.btn(rolesWanted[role] ? S.gold : "transparent", rolesWanted[role] ? S.dark : S.mid),
                    border: rolesWanted[role] ? "none" : `1px solid ${S.borderStrong}`,
                    padding: "7px 10px",
                    fontSize: 12,
                  }}
                >
                  {MATCH_ROLE_LABELS[role]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={S.label}>Match priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} style={S.input}>
              <option value="speed">Fastest qualified response</option>
              <option value="balanced">Balanced fit and response time</option>
              <option value="experience">Most transaction experience</option>
              <option value="local">Strongest local coverage</option>
            </select>
          </div>
          <div>
            <label style={S.label}>Budget preference</label>
            <select value={budget} onChange={(e) => setBudget(e.target.value)} style={S.input}>
              <option value="value">Value-focused</option>
              <option value="standard">Standard market rate</option>
              <option value="premium">Premium availability</option>
            </select>
          </div>
          <div>
            <label style={S.label}>Financing status</label>
            <select value={financingStatus} onChange={(e) => setFinancingStatus(e.target.value)} style={S.input}>
              <option value="preapproval-needed">Preapproval needed</option>
              <option value="preapproved">Preapproved</option>
              <option value="cash">Cash buyer</option>
              <option value="seller-side">Seller-side support</option>
              <option value="not-sure">Not sure yet</option>
            </select>
          </div>
          <div>
            <label style={S.label}>Notes for match team</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Neighborhoods, constraints, inspection concerns, lender preferences..." style={{ ...S.input, minHeight: 84, resize: "vertical" }} />
          </div>
        </div>
        <div style={{ marginTop: 12, fontFamily: S.font, fontSize: 12, color: S.light }}>
          Matches are filtered by service type and coverage area. Final engagement terms are set directly with each provider.
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "0.85fr 1.15fr", gap: 14, marginBottom: 16 }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: S.goldDeep }}>Match Readiness</div>
              <div style={{ fontFamily: S.serif, fontSize: 34, color: S.dark, marginTop: 4 }}>{matchingReadiness}%</div>
            </div>
            <Badge variant={matchingReadiness >= 85 ? "verified" : "type"}>{matchingReadiness >= 85 ? "Ready" : "Draft"}</Badge>
          </div>
          <ProgressBar value={matchingReadiness} max={100} color={matchingReadiness >= 85 ? S.green : S.gold} />
          <div style={{ display: "grid", gap: 7, marginTop: 12 }}>
            {[
              ["Market", market.trim() || "Missing"],
              ["Timeline", timeline],
              ["Services", selectedRoles.map((role) => MATCH_ROLE_LABELS[role]).join(", ") || "None selected"],
              ["Priority", priority.replace(/-/g, " ")],
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontFamily: S.font, fontSize: 12, borderTop: `1px solid ${S.surface}`, paddingTop: 7 }}>
                <span style={{ color: S.light }}>{label}</span>
                <strong style={{ color: S.dark, textAlign: "right" }}>{value}</strong>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: S.goldDeep, marginBottom: 10 }}>Matching Plan</div>
          <div style={{ display: "grid", gap: 10 }}>
            {servicePlan.length === 0 && (
              <div style={{ fontFamily: S.font, fontSize: 13, color: S.light }}>Select at least one service to build a match plan.</div>
            )}
            {servicePlan.map((item, index) => (
              <div key={item.role} style={{ display: "grid", gridTemplateColumns: "28px 1fr", gap: 10 }}>
                <div>
                  <div style={{ width: 20, height: 20, borderRadius: 99, display: "grid", placeItems: "center", background: S.gold, color: S.dark, fontFamily: S.font, fontSize: 11, fontWeight: 900 }}>{index + 1}</div>
                  {index < servicePlan.length - 1 && <div style={{ width: 2, height: 30, background: S.border, marginLeft: 9, marginTop: 3 }} />}
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontFamily: S.font, fontSize: 13.5, color: S.dark }}>{item.label}</strong>
                    <Badge variant="type">{item.status}</Badge>
                  </div>
                  <div style={{ fontFamily: S.font, fontSize: 12, color: S.muted, lineHeight: 1.5, marginTop: 4 }}>{item.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {canFeatureService && (
        <Card style={{ marginBottom: 16, background: "linear-gradient(180deg, rgba(255,251,245,0.98), rgba(247,239,228,0.96))" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap", marginBottom: 10 }}>
            <div>
              <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: S.goldDeep }}>Featured Service Spotlight</div>
              <div style={{ fontFamily: S.serif, fontSize: 24, color: S.dark, marginTop: 4 }}>Pay to get featured in Match Services.</div>
              <div style={{ fontFamily: S.font, fontSize: 13, color: S.muted, lineHeight: 1.65, marginTop: 6, maxWidth: 620 }}>
                Promote your service for 30 days so buyers and sellers see your spotlight card before the broader provider directory comes online.
              </div>
            </div>
            <Badge variant="verified">{FEATURED_SERVICE_PRICE_LABEL}</Badge>
          </div>
          {myActiveServicePlacement && (
            <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 12, background: S.greenBg, fontFamily: S.font, fontSize: 12, color: S.green, lineHeight: 1.6 }}>
              <strong>Active spotlight live.</strong> {formatFeaturedPlacementWindow(myActiveServicePlacement)} in {myActiveServicePlacement.market || "your current market"}.
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1fr 1fr", gap: 10 }}>
            <input value={featureHeadline} onChange={(e) => setFeatureHeadline(e.target.value)} placeholder={`${user?.name || "Your name"} · ${featuredServiceRoleLabel(user?.accountType)}`} style={S.input} />
            <input value={featureCompany} onChange={(e) => setFeatureCompany(e.target.value)} placeholder="Company or practice name" style={S.input} />
            <input value={featureMarket} onChange={(e) => setFeatureMarket(e.target.value)} placeholder="Primary market (e.g. Raleigh-Durham)" style={S.input} />
            <textarea value={featureNote} onChange={(e) => setFeatureNote(e.target.value)} placeholder="Why should someone choose your service?" style={{ ...S.input, minHeight: 90, resize: "vertical" }} />
          </div>
          <div style={{ marginTop: 10, fontFamily: S.font, fontSize: 12, color: S.light, lineHeight: 1.55 }}>
            Your spotlight appears as paid featured placement content inside EstateHat. It does not change verification, ranking, or transaction outcomes.
          </div>
          {featureError && (
            <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: S.redBg, fontFamily: S.font, fontSize: 12, color: S.red }}>
              {featureError}
            </div>
          )}
          <button
            type="button"
            onClick={launchFeaturedServiceCheckout}
            disabled={featureBusy || !featureMarket.trim()}
            style={{ ...S.btn(featureBusy || !featureMarket.trim() ? "#C9C0B4" : S.gold, featureBusy || !featureMarket.trim() ? "#999" : S.dark), width: "100%", marginTop: 14, opacity: featureBusy || !featureMarket.trim() ? 0.6 : 1, cursor: featureBusy || !featureMarket.trim() ? "not-allowed" : "pointer" }}
          >
            {featureBusy ? "Opening Stripe Checkout…" : "Buy Featured Service Spotlight"}
          </button>
        </Card>
      )}

      {!canFeatureService && (
        <Card style={{ marginBottom: 16, background: S.surfaceAlt }}>
          <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: S.goldDeep, marginBottom: 8 }}>Featured Service Spotlight</div>
          <div style={{ fontFamily: S.serif, fontSize: 22, color: S.dark, marginBottom: 6 }}>Paid service promotion is reserved for service-provider accounts.</div>
          <div style={{ fontFamily: S.font, fontSize: 12.5, color: S.muted, lineHeight: 1.6 }}>
            Agent, inspector, and lender profiles can buy promoted spotlight placement inside Match Services. Buyer and seller accounts can still browse those featured service ads here.
          </div>
        </Card>
      )}

      {canAttachToSale && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 15, color: S.dark, marginBottom: 8 }}>Attach to sale or listing</div>
          <label style={S.label}>Sale / transaction</label>
          <select value={selectedTarget?.id || ""} onChange={(e) => setSelectedTargetId(e.target.value)} style={S.input}>
            {saleTargets.length === 0 && <option value="">No active seller sales available</option>}
            {saleTargets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.id} - {target.property}
              </option>
            ))}
          </select>
          <div style={{ marginTop: 8, fontFamily: S.font, fontSize: 12, color: S.muted, lineHeight: 1.5 }}>
            When attached, the professional is added to this sale team and appears in the linked conversation so they can review and participate.
          </div>
          {selectedTarget && (
            <div style={{ marginTop: 8, fontFamily: S.font, fontSize: 12, color: S.light }}>
              Currently attached: <strong>{(attachedByDeal[selectedTarget.id] || []).length}</strong>
            </div>
          )}
          {attachNotice && (
            <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 10, background: S.greenBg, color: S.green, fontFamily: S.font, fontSize: 12 }}>
              {attachNotice}
            </div>
          )}
          <div style={{ marginTop: 14, borderTop: `1px solid ${S.border}`, paddingTop: 14 }}>
            <div style={{ fontFamily: S.font, fontWeight: 800, fontSize: 13, color: S.dark, marginBottom: 8 }}>Invite your own professional</div>
            <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1fr 1fr", gap: 10 }}>
              <input value={inviteDraft.name} onChange={(e) => setInviteDraft({ ...inviteDraft, name: e.target.value })} placeholder="Name" style={S.input} />
              <input value={inviteDraft.email} onChange={(e) => setInviteDraft({ ...inviteDraft, email: e.target.value })} placeholder="Email" style={S.input} />
              <select value={inviteDraft.role} onChange={(e) => setInviteDraft({ ...inviteDraft, role: e.target.value })} style={S.input}>
                {Object.entries(MATCH_ROLE_LABELS).map(([role, label]) => <option key={role} value={role}>{label}</option>)}
              </select>
              <input value={inviteDraft.company} onChange={(e) => setInviteDraft({ ...inviteDraft, company: e.target.value })} placeholder="Company optional" style={S.input} />
            </div>
            <button type="button" onClick={attachManualProfessional} disabled={!selectedTarget || !inviteDraft.name.trim() || !inviteDraft.email.includes("@")} style={{ ...S.btn(S.mid, S.card), width: "100%", marginTop: 10, opacity: selectedTarget && inviteDraft.name.trim() && inviteDraft.email.includes("@") ? 1 : 0.55 }}>
              Attach invited professional
            </button>
          </div>
        </Card>
      )}

      <Card style={{ marginBottom: 16, background: S.surfaceAlt }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start", marginBottom: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 15, color: S.dark, marginBottom: 8 }}>Relevant bodies</div>
            <div style={{ fontFamily: S.font, fontSize: 13, color: S.muted, lineHeight: 1.7, maxWidth: 640 }}>
              EstateHat can route one coordinated request across the people and oversight points that matter for this transaction, so introductions happen in a useful order instead of as disconnected outreach.
            </div>
          </div>
          <Badge variant={selectedRoles.length > 0 ? "verified" : "type"}>{selectedRoles.length > 0 ? `${selectedRoles.length} active` : "No bodies selected"}</Badge>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "repeat(3,minmax(0,1fr))", gap: 10, marginBottom: 12 }}>
          {[
            {
              title: "Primary bodies",
              value: selectedRoles.length ? selectedRoles.map((role) => MATCH_ROLE_LABELS[role]).join(", ") : "Select at least one service",
              detail: "These are the providers EstateHat will line up first for contact and fit review.",
            },
            {
              title: "Market scope",
              value: `${market.trim() || "Selected market"} · ${propertyType}`,
              detail: "Used to narrow local coverage, property familiarity, and role fit.",
            },
            {
              title: "Timing path",
              value: timeline,
              detail: priority === "speed" ? "Fastest qualified path" : priority === "local" ? "Local coverage weighted" : priority === "experience" ? "Experience weighted" : "Balanced fit and response time",
            },
          ].map((item) => (
            <div key={item.title} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 12 }}>
              <div style={{ fontFamily: S.font, fontSize: 10.5, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: S.light }}>{item.title}</div>
              <div style={{ fontFamily: S.font, fontSize: 12.5, fontWeight: 800, color: S.dark, lineHeight: 1.5, marginTop: 7 }}>{item.value}</div>
              <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.muted, lineHeight: 1.55, marginTop: 6 }}>{item.detail}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
          {(selectedRoles.length ? selectedRoles : ["agent", "inspector", "lender"]).map((role, index) => {
            const isSelected = selectedRoles.includes(role);
            const title = MATCH_ROLE_LABELS[role];
            const body = role === "agent"
              ? {
                  lane: "Market entry and negotiation lane",
                  touchpoint: "Shortlist coverage, showing coordination, offer pacing, and seller communication.",
                  trigger: "Useful first when you need representation, listing context, or local strategy.",
                }
              : role === "inspector"
                ? {
                    lane: "Condition and repair lane",
                    touchpoint: "Inspection timing, repair risk, disclosure follow-up, and issue escalation.",
                    trigger: "Useful once a property is serious enough to warrant due-diligence scheduling.",
                  }
                : {
                    lane: "Funding and closing lane",
                    touchpoint: "Preapproval, underwriting timing, funds readiness, and settlement coordination.",
                    trigger: "Useful when financing certainty affects speed, offer strength, or closing timing.",
                  };
            return (
              <div key={role} style={{ border: `1px solid ${isSelected ? "rgba(212,160,83,0.42)" : S.border}`, borderRadius: 10, background: isSelected ? S.goldBg : S.card, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 99, background: isSelected ? S.gold : S.surface, color: isSelected ? S.dark : S.muted, display: "grid", placeItems: "center", fontFamily: S.font, fontSize: 11, fontWeight: 900 }}>
                      {index + 1}
                    </div>
                    <strong style={{ fontFamily: S.font, fontSize: 13, color: S.dark }}>{title}</strong>
                  </div>
                  <Badge variant={isSelected ? "verified" : "type"}>{isSelected ? "Included" : "Available"}</Badge>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "0.8fr 1.2fr 1fr", gap: 10, marginTop: 10 }}>
                  {[
                    ["Lane", body.lane],
                    ["Touchpoints", body.touchpoint],
                    ["Best trigger", body.trigger],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div style={{ fontFamily: S.font, fontSize: 10.5, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: S.light }}>{label}</div>
                      <div style={{ fontFamily: S.font, fontSize: 11.8, color: S.muted, lineHeight: 1.55, marginTop: 5 }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ fontFamily: S.font, fontSize: 12, color: S.light, lineHeight: 1.55, maxWidth: 620 }}>
            EstateHat keeps the request coordinated so the next introduction is informed by the prior one, the property type, and the timing you set above.
          </div>
          <button
            type="button"
            onClick={saveMatchRequest}
            disabled={selectedRoles.length === 0}
            style={{ ...S.btn(S.dark, S.card), opacity: selectedRoles.length === 0 ? 0.6 : 1, cursor: selectedRoles.length === 0 ? "not-allowed" : "pointer" }}
          >
            Request relevant bodies
          </button>
        </div>
        {requested && (
          <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: S.greenBg, color: S.green, fontFamily: S.font, fontSize: 12.5, lineHeight: 1.55 }}>
            Match request saved for <strong>{user?.name || "your account"}</strong>. Relevant bodies requested: <strong>{selectedRoles.map((role) => MATCH_ROLE_LABELS[role]).join(", ")}</strong> in <strong>{market || "your selected market"}</strong> ({propertyType}, {timeline}).
          </div>
        )}
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontFamily: S.font, fontWeight: 800, fontSize: 15, color: S.dark }}>Saved match requests</div>
          <Badge variant="type">{matchRequests.length}</Badge>
        </div>
        {matchRequests.length === 0 ? (
          <div style={{ fontFamily: S.font, fontSize: 13, color: S.light, lineHeight: 1.55 }}>No saved match requests yet. Build the intake above and request introductions to create a queue record.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {matchRequests.slice(0, 5).map((request) => (
              <div key={request.id} style={{ border: `1px solid ${S.border}`, borderRadius: 10, padding: 12, background: S.card }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <strong style={{ fontFamily: S.font, fontSize: 13, color: S.dark }}>{request.market} · {request.propertyType}</strong>
                  <Badge variant={request.readiness >= 85 ? "verified" : "type"}>{request.status}</Badge>
                </div>
                <div style={{ fontFamily: S.font, fontSize: 12, color: S.muted, lineHeight: 1.5, marginTop: 5 }}>
                  {request.roles.map((role) => MATCH_ROLE_LABELS[role]).join(", ")} · {request.timeline} · readiness {request.readiness}%
                  {request.targetId ? ` · attached target ${request.targetId}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {featuredServicePlacements.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: S.goldDeep }}>Featured Services</div>
              <div style={{ fontFamily: S.serif, fontSize: 24, color: S.dark, marginTop: 4 }}>Paid spotlights in this market</div>
            </div>
            <Badge variant="verified">{featuredServicePlacements.length} live</Badge>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {featuredServicePlacements.map((placement) => (
              <div key={placement.id} style={{ border: `1px solid ${S.border}`, borderRadius: 12, padding: 14, background: S.card }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "start" }}>
                  <div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                      <Badge variant="verified">★ Featured</Badge>
                      <Badge variant="type">{featuredServiceRoleLabel(placement.serviceRole)}</Badge>
                    </div>
                    <div style={{ fontFamily: S.font, fontSize: 15, fontWeight: 800, color: S.dark }}>{placement.title || `${placement.ownerName} Spotlight`}</div>
                    <div style={{ fontFamily: S.font, fontSize: 12, color: S.light, marginTop: 4 }}>{placement.subtitle || placement.company || placement.ownerName} · {placement.market || "Market not specified"}</div>
                  </div>
                  <div style={{ fontFamily: S.font, fontSize: 11, color: S.goldDeep, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Paid Promotion
                  </div>
                </div>
                <div style={{ fontFamily: S.font, fontSize: 12.5, color: S.muted, lineHeight: 1.6, marginTop: 8 }}>
                  {placement.description || "Featured service provider spotlight."}
                </div>
                <div style={{ marginTop: 8, fontFamily: S.font, fontSize: 11.5, color: S.light }}>
                  {formatFeaturedPlacementWindow(placement)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {matches.length === 0 && (
          <Card>
            <div style={{ fontFamily: S.font, fontSize: 15, fontWeight: 800, color: S.dark, marginBottom: 6 }}>
              No connected provider directory yet
            </div>
            <div style={{ fontFamily: S.font, fontSize: 13, color: S.muted, lineHeight: 1.65 }}>
              Match Services now saves intake requests and sale attachments without showing placeholder professionals. Paid featured service spotlights can appear above while the live provider directory is still being connected.
            </div>
          </Card>
        )}
        {matches.map((entry) => (
          <Card key={entry.id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontFamily: S.font, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: S.goldDeep, marginBottom: 6 }}>{MATCH_ROLE_LABELS[entry.role]}</div>
                <div style={{ fontFamily: S.serif, fontSize: 24, color: S.dark, marginBottom: 4 }}>{entry.name}</div>
                <div style={{ fontFamily: S.font, fontSize: 13, color: S.muted, lineHeight: 1.6 }}>{entry.highlights}</div>
              </div>
              <div style={{ textAlign: isCompact ? "left" : "right", minWidth: 220 }}>
                <div style={{ fontFamily: S.font, fontSize: 13, color: S.dark, fontWeight: 700 }}>★ {entry.rating.toFixed(1)} rating</div>
                <div style={{ marginTop: 5 }}><GradeBadge grade={entry.reputation?.grade || gradeFromStarRating(entry.rating)} score={entry.reputation?.score || Math.round((Number(entry.rating) || 0) * 20)} /></div>
                <div style={{ fontFamily: S.font, fontSize: 12, color: S.light }}>{entry.response}</div>
                <div style={{ fontFamily: S.font, fontSize: 12, color: S.light, marginTop: 4 }}>{entry.pricing}</div>
              </div>
            </div>
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {entry.coverage.map((city) => (
                <span key={city} style={{ fontFamily: S.font, fontSize: 11, color: S.dark, background: S.surfaceAlt, border: `1px solid ${S.border}`, borderRadius: 999, padding: "4px 9px" }}>
                  {city}
                </span>
              ))}
              {entry.linkedin && (
                <span style={{ fontFamily: S.font, fontSize: 11, color: "#0A66C2", background: "rgba(10, 102, 194, 0.08)", border: "1px solid rgba(10, 102, 194, 0.28)", borderRadius: 999, padding: "4px 9px" }}>
                  LinkedIn available
                </span>
              )}
            </div>
            {(canAttachToSale || entry.linkedin) && (
              <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                {entry.linkedin && (
                  <a
                    href={entry.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ ...S.btn("#0A66C2", "#fff"), padding: "8px 12px", fontSize: 12, textDecoration: "none" }}
                  >
                    View LinkedIn
                  </a>
                )}
                <button
                  type="button"
                  disabled={!selectedTarget}
                  onClick={() => {
                    if (!selectedTarget) return;
                    onAttachProfessional({
                      dealId: selectedTarget.id,
                      property: selectedTarget.property,
                      professional: entry,
                    });
                    setAttachNotice(`${entry.name} added to ${selectedTarget.id}. Conversation access is now attached to this sale.`);
                  }}
                  style={{ ...S.btn(S.dark, S.card), padding: "8px 12px", fontSize: 12, opacity: selectedTarget ? 1 : 0.6, cursor: selectedTarget ? "pointer" : "not-allowed" }}
                >
                  Add to sale + conversation
                </button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── HELP CENTER ─────────────────────────
export function HelpView({ onNavigate }) {
  const isCompact = useMediaQuery("(max-width: 820px)");
  const [openFaq, setOpenFaq] = useState(null);
  const faqs = [
    { q: "How does EstateHat make money?", a: "EstateHat currently presents a flat 1.50% platform fee on the final sale price. By default that fee is charged to the buyer on top of the agreed property price, unless the seller elects to absorb it instead. Additional modeled flat fees of $500 (escrow) and $35 (wire transfer) may apply by transaction setup. Optional in-product features, including Verified User status, can carry separate pricing when enabled." },
    { q: "Where can I review all legal, compliance, and support scope disclosures?", a: "Use Help Center for plain-language answers, FAQ & Scope for platform boundaries and disclaimers, the EstateHat Assistant for guided links, Forms for reusable acknowledgement text, Move Kit for buyer/seller/document/closing/trust helpers, Hat Data for installed workflow items, and Goodies for optional workspace helpers. EstateHat support is operational guidance only and is not legal or financial advice." },
    { q: "Do I need an account to post a listing?", a: "Yes. You must be signed in to post a listing, upload listing photos, and submit listing documents for review." },
    { q: "Why do I need to verify my U.S. citizenship?", a: "This helps protect buyers and sellers from fraud. Before a sale can move forward, buyers and sellers need to show they are a U.S. citizen or permanent resident so everyone knows who they are dealing with." },
    { q: "What happens if a checklist item fails?", a: "The sale pauses until that item is taken care of. If something important is missing, like paperwork, identity checks, or signatures, closing cannot move ahead until it is fixed." },
    { q: "How are photos verified?", a: "Every listing requires a minimum of 4 exterior and 6 interior photos. These are reviewed by a third-party EstateHat administrator — never by the buyer or seller in the transaction. Filtered, misleading, or stock photos are flagged and rejected." },
    { q: "Can an attorney also be my agent?", a: "No. Certain jobs stay separate so there is no conflict of interest. For example, an attorney cannot also serve as the agent, inspector, or lender on the same deal." },
    { q: "Is my SSN stored on EstateHat?", a: "No. Your Social Security Number is checked through a secure outside service. EstateHat keeps only the result of the check, not the number itself." },
    { q: "What if a seller isn't verified?", a: "You will see a warning on the listing, and the sale cannot move forward until the seller finishes the required identity, citizenship, and background checks." },
    { q: "How does the escrow work?", a: "Funds are held by licensed third-party escrow partners. EstateHat does not hold the money itself. Money is released only after the sale is ready, approvals are in place, and the required checks are complete." },
    { q: "Where do I complete required attestations and acknowledgments?", a: "Open Forms to complete the required legal attestations and acknowledgment statements, including platform fee disclosure and funds custody boundary. Required steps must be completed with statement-level evidence before sensitive workflow actions are unlocked. These workflows are compliance controls, not legal representation." },
    { q: "What are Move Kit, Hat Data, and Goodies?", a: "Move Kit is the plain-language helper workspace for buyers, sellers, documents, closing steps, and trust warnings. Hat Data is the installed workflow-component library. Goodies is the optional experience-helper workspace for navigation, discovery, transaction, document, trust, support, and admin improvements." },
    { q: "How does location-based compliance work?", a: "EstateHat applies a location compliance profile using the transaction location fields (state, county, city, and municipality/borough/parish where applicable). The profile records jurisdiction overlays, outlier flags, and a checklist for higher-risk legal distinctions, including U.S. territories such as Puerto Rico, Guam, and the U.S. Virgin Islands." },
    { q: "Can I use EstateHat on my phone?", a: "Yes. You can use EstateHat in a web browser on your phone, and your account information stays the same across supported devices." },
    { q: "Do I have to use EstateHat-matched professionals?", a: "No. Matching is available if you need it, but you can still use your own qualified agent, inspector, or lender based on your transaction setup and compliance requirements." },
    { q: "What does adding a professional to a sale do?", a: "When you add a matched professional to a sale, they are attached to that transaction workflow and can be included in the linked conversation for review and coordination." },
    { q: "How do corporate accounts work?", a: "Business buyers and sellers have a few extra steps. We review company paperwork, signer information, and other records so the people signing for the company are clearly identified." },
  ];

  return (
    <div style={{ maxWidth: 740, margin: "0 auto", padding: 24 }}>
      <button onClick={() => onNavigate("dashboard")} style={{ background: "none", border: "none", fontFamily: S.font, fontSize: 14, color: S.gold, cursor: "pointer", fontWeight: 600, marginBottom: 20, padding: 0 }}>← Back</button>
      <SectionHeader title="Help Center" sub="Frequently asked questions and support" />

      {faqs.map((faq, i) => (
        <AccordionSection
          key={i}
          title={faq.q}
          isOpen={openFaq === i}
          onToggle={() => setOpenFaq((current) => current === i ? null : i)}
          dense
        >
          <div style={{ fontSize: 13.5, lineHeight: 1.7 }}>{faq.a}</div>
        </AccordionSection>
      ))}

      <Card style={{ marginTop: 24 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📞</div>
          <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 16, color: S.dark, marginBottom: 4 }}>Still need help?</div>
          <div style={{ fontFamily: S.font, fontSize: 13, color: S.light, marginBottom: 14 }}>Our support team is available Monday–Friday, 9 AM – 6 PM EST.</div>
          <div style={{ display: "flex", flexDirection: isCompact ? "column" : "row", gap: 10, justifyContent: "center", alignItems: "center" }}>
            <div style={{ fontFamily: S.font, fontSize: 13, color: S.gold, fontWeight: 600 }}>📧 support@estatehat.com</div>
            <div style={{ fontFamily: S.font, fontSize: 13, color: S.gold, fontWeight: 600 }}>📞 (919) 555-0100</div>
          </div>
          <button onClick={() => onNavigate("faq")} style={{ ...S.btn(S.dark, S.card), marginTop: 14 }}>
            Open Full FAQ Scope Page
          </button>
        </div>
      </Card>
    </div>
  );
}

export function FAQView({ onNavigate }) {
  const [openSection, setOpenSection] = useState(0);
  const sections = [
    [
      "What EstateHat Offers",
      "EstateHat offers software tools for account verification workflows, listing and search interfaces, transaction checklists, document coordination surfaces, in-platform messaging, profile trust/billing status controls, and optional in-platform professional matching with sale-level collaborator attachment.",
    ],
    [
      "What EstateHat Does Not Offer",
      "EstateHat does not act as your real estate broker, attorney, title insurer, escrow bank, lender, tax advisor, or appraisal provider. EstateHat does not guarantee transaction outcomes, property condition, financing approval, title status, or legal enforceability of third-party agreements. EstateHat also does not require universal provider lock-in; qualified external professionals may still be used when transaction setup and compliance requirements allow.",
    ],
    [
      "In-Platform Ecosystem (Optional)",
      "EstateHat is designed as an integrated workflow ecosystem: listing, matching, messaging, and transaction steps work together in one place. This in-platform path is recommended for speed and coordination, but users can still work with their own qualified professionals where allowed.",
    ],
    [
      "What Is Covered In Platform Support",
      "Platform support covers account access issues, profile setup questions, navigation help, feature guidance (including matching and collaborator attachment), and technical troubleshooting related to EstateHat product behavior.",
    ],
    [
      "What Is Outside Support Scope",
      "Support does not provide legal advice, tax advice, investment advice, underwriting decisions, title opinions, contract drafting for legal sufficiency, negotiation representation, or dispute adjudication between parties.",
    ],
    [
      "Fees and Billing Scope",
      "EstateHat currently presents a 1.50% platform fee model and optional verified-profile billing controls in product workflows. By default the buyer pays that fee on top of sale price, unless the seller elects to absorb it. Third-party provider fees, escrow/title costs, and financial rail fees may apply separately depending on transaction setup. EstateHat does not directly custody transaction funds; fund movement is executed through designated third-party escrow/payment providers.",
    ],
    [
      "Required Legal Steps and Evidence",
      "Required legal steps are not pass/fail checkboxes only. EstateHat expects statement/verification evidence for required steps, including source-of-funds attestation support, platform fee disclosure acknowledgment, and funds custody boundary acknowledgment. Missing or insufficient documentation can pause workflow progression.",
    ],
    [
      "Jurisdiction Coverage and Location Adjustments",
      "EstateHat compliance workflows are location-aware by state and county, with municipality handling for city/borough/parish distinctions where relevant. U.S. territory handling is also supported (including Puerto Rico, Guam, and the U.S. Virgin Islands) and can trigger enhanced outlier review paths.",
    ],
    [
      "Where To Find Disclosures In-Product",
      "Compliance and support disclosures are intentionally available in multiple places: Help Center, FAQ & Scope, Assistant guided topics, Forms, Move Kit, Hat Data, Goodies, and My Info compliance profile sections. These parallel surfaces are designed so users can locate core legal/financial scope disclosures without relying on a single page.",
    ],
    [
      "Move Kit, Hat Data, and Goodies",
      "Move Kit is the plain-language helper workspace for buyer, seller, document, closing, and trust guidance. Hat Data is the installed workflow-item library for EstateHat data and operating tools. Goodies is the optional helper workspace for experience improvements such as navigation, listing discovery, transaction workflow, document handling, trust and money controls, support, and admin operations. These labels describe product surfaces, not legal, brokerage, title, escrow, lending, or advisory services.",
    ],
    [
      "Data and Privacy Scope",
      "EstateHat uses account and transaction data to operate platform features, security controls, and compliance workflows. EstateHat does not sell personal information. For formal privacy handling details, see the Privacy Policy.",
    ],
    [
      "Government and Compliance Profiles",
      "Government profile roles can be configured for township, city, county, borough, parish, state, and federal contexts. These roles are administrative profiles within the platform and are not legal endorsements or certifications by any government authority.",
    ],
    [
      "Verified User Badge Scope",
      "A Verified User badge indicates profile requirements, legal steps, and billing readiness state inside EstateHat. It is a platform trust signal, not a legal guarantee, credit guarantee, or background guarantee beyond the configured verification workflow.",
    ],
  ];

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: 24 }}>
      <button onClick={() => onNavigate("dashboard")} style={{ background: "none", border: "none", fontFamily: S.font, fontSize: 14, color: S.gold, cursor: "pointer", fontWeight: 600, marginBottom: 20, padding: 0 }}>← Back</button>
      <SectionHeader title="FAQ & Scope" sub="What EstateHat offers, what it does not offer, and what support can cover." />

      {sections.map(([title, body], index) => (
        <AccordionSection
          key={title}
          title={title}
          isOpen={openSection === index}
          onToggle={() => setOpenSection((current) => (current === index ? null : index))}
        >
          {body}
        </AccordionSection>
      ))}

      <Card style={{ marginTop: 20, background: S.surfaceAlt }}>
        <div style={{ fontFamily: S.font, fontSize: 13, color: S.muted, lineHeight: 1.7 }}>
          For legal interpretation of these terms or transaction-specific advice, consult qualified counsel and licensed professionals.
        </div>
      </Card>
    </div>
  );
}

function EstateHatAssistant({ currentView, onNavigate, isCompact, user, perms, savedListingCount = 0, featuredPlacementCount = 0 }) {
  const storageKey = "estatehat-assistant-dismissed-v1";
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(storageKey) !== "true";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, open ? "false" : "true");
    } catch {
      // Ignore localStorage failures.
    }
  }, [open]);

  const [activeTopic, setActiveTopic] = useState("documents");
  const [query, setQuery] = useState("");
  const [reply, setReply] = useState(null);
  const [routeHistory, setRouteHistory] = useState([]);
  const inputRef = useRef(null);
  const accountType = user?.accountType || "buyer";
  const verifiedProfileActive = !!user?.trust?.verifiedProfileActive;
  const trustedProfileVisible = verifiedProfileActive && user?.trust?.verifiedProfileVisibility !== false;
  const examplePrompts = useMemo(() => ([
    "I want to buy a home",
    "Where do I upload documents?",
    "How do I set up my account?",
    "Who pays the EstateHat fee?",
  ]), []);

  useEffect(() => {
    const handler = (event) => {
      const requestedTopic = event?.detail?.topic;
      if (typeof requestedTopic === "string" && requestedTopic) {
        setActiveTopic(requestedTopic);
        setReply(null);
      }
      setOpen(true);
    };
    window.addEventListener("estatehat-assistant-open", handler);
    return () => window.removeEventListener("estatehat-assistant-open", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(timeout);
  }, [open]);

  const topics = useMemo(() => ([
    {
      id: "buy",
      question: "I want to buy a home",
      answer: "Start in Browse Listings. Save homes to Watchlist, then open My Active Hats when you're ready to submit and track an offer.",
      keywords: ["buy", "buyer", "purchase", "home", "house", "property", "browse", "listing", "search"],
      guidance: [
        "Browse live listings first so you can narrow by location and budget.",
        "Save strong options to Watchlist before starting an offer flow.",
        "Use My Active Hats once a deal is live and paperwork starts moving.",
      ],
      actions: [
        { label: "Open Browse Listings", action: () => onNavigate("browse") },
        { label: "Open Watchlist", action: () => onNavigate("watchlist") },
      ],
    },
    {
      id: "sell",
      question: "I want to sell a home",
      answer: "Start with List Property. If you need help, use Match Services to find an agent, inspector, or lender, then attach them to the sale so they can join the linked conversation and review process.",
      keywords: ["sell", "seller", "listing", "list my home", "post property", "sale team"],
      guidance: [
        "Start the seller intake in List Property.",
        "Use Match Services if you need an agent, inspector, or lender attached to the sale.",
        "Keep the live sale in My Active Hats once the listing is moving.",
      ],
      actions: [
        { label: "Open List Property", action: () => onNavigate("list") },
        { label: "Open Match Services", action: () => onNavigate("matching") },
        { label: "Open My Active Hats", action: () => onNavigate("transaction") },
      ],
    },
    {
      id: "documents",
      question: "Where do I upload documents?",
      answer: "Use My Active Hats for paperwork, checklists, and updates tied to a live sale. Shared files also show up through Messages once a deal is active.",
      keywords: ["document", "documents", "upload", "paperwork", "files", "forms", "pdf", "vault"],
      guidance: [
        "Use My Active Hats for deal-tied uploads and checklist items.",
        "Use Messages when a shared file belongs inside an active conversation thread.",
        "Open Help Center if you need document process guidance before uploading.",
      ],
      actions: [
        { label: "Open My Active Hats", action: () => onNavigate("transaction") },
        { label: "Open Help Center", action: () => onNavigate("help") },
      ],
    },
    {
      id: "seller",
      question: "How do I find seller contact info?",
      answer: "Start from the property listing. Seller details show up where they are needed, and direct communication happens through Messages instead of posting personal contact information all over the site.",
      keywords: ["seller contact", "seller info", "contact seller", "reach seller", "owner contact", "message seller"],
      guidance: [
        "Open the listing first so the seller context stays tied to the property.",
        "Use Messages for direct communication instead of looking for exposed personal contact data.",
      ],
      actions: [
        { label: "Browse Listings", action: () => onNavigate("browse") },
        { label: "Open Messages", action: () => onNavigate("messages") },
      ],
    },
    {
      id: "team",
      question: "How do I build my sale team?",
      answer: "Open Match Services, pick the services you need, and add a professional to a specific sale. They will show up in My Active Hats and can be included in the attached conversation thread.",
      keywords: ["team", "agent", "inspector", "lender", "attorney", "professional", "match", "services", "sale team"],
      guidance: [
        "Use Match Services to find the right professional type first.",
        "Attach them to a specific sale so the relationship is tracked correctly.",
        "Use My Active Hats and Messages once the team member is connected.",
      ],
      actions: [
        { label: "Open Match Services", action: () => onNavigate("matching") },
        { label: "Open Messages", action: () => onNavigate("messages") },
      ],
    },
    {
      id: "navigate",
      question: "How do I navigate the site?",
      answer: "Browse is where you look through homes. Match Services helps you find professionals if needed. Watchlist saves options. My Active Hats handles paperwork and next steps. Messages keeps conversations together. Move Kit holds buyer, seller, document, closing, and trust helpers. Hat Data shows installed workflow items, Goodies holds optional helper features, and My Info holds account details.",
      keywords: ["navigate", "navigation", "where do i go", "where is", "how do i use", "site", "find page", "page"],
      guidance: [
        "Use Browse for inventory, Match for professionals, and Watchlist for saved homes.",
        "Use My Active Hats for live deals and paperwork.",
        "Use My Info for account, verification, trust, and security details.",
      ],
      actions: [
        { label: "Go to Browse", action: () => onNavigate("browse") },
        { label: "Open Match Services", action: () => onNavigate("matching") },
        { label: "Open Move Kit", action: () => onNavigate("move-kit") },
        { label: "Open Hat Data", action: () => onNavigate("components") },
        { label: "Open Goodies", action: () => onNavigate("ux-suite") },
        { label: "Open Help Center", action: () => onNavigate("help") },
      ],
    },
    {
      id: "device-layout",
      question: "Why does the layout change on my phone?",
      answer: "EstateHat checks whether you are on a phone, tablet, or desktop browser. On desktop, sections use wider grids with overlap guards. On mobile, workspaces become stacked tiles so buttons, cards, and text have room to breathe.",
      keywords: ["phone", "mobile", "layout", "tablet", "desktop", "screen", "ios", "android", "view"],
      guidance: [
        "Phone layouts stack content into tiles to reduce overlap and horizontal squeeze.",
        "Desktop layouts keep denser multi-column boards where there is enough space.",
      ],
      actions: [
        { label: "Open Move Kit", action: () => onNavigate("move-kit") },
        { label: "Open Hat Data", action: () => onNavigate("components") },
        { label: "Open Goodies", action: () => onNavigate("ux-suite") },
      ],
    },
    {
      id: "setup",
      question: "Where do I finish account setup?",
      answer: "Use My Info for your account details and setup. Use My Active Hats when you need to move a live sale forward.",
      keywords: ["setup", "account", "profile", "my info", "verification", "billing", "identity", "security"],
      guidance: [
        "Open My Info for identity, role, trust, compliance, and billing setup.",
        "Return to My Active Hats only when there is a live transaction to move forward.",
      ],
      actions: [
        { label: "Open My Info", action: () => onNavigate("profile") },
        { label: "Open My Active Hats", action: () => onNavigate("transaction") },
      ],
    },
    {
      id: "compliance",
      question: "Where are compliance disclosures and required attestations?",
      answer: "Use Help Center and FAQ & Scope for legal and support boundaries, and use Forms for required attestations and acknowledgments. Move Kit adds plain-language support helpers like fair housing copy checks, wire-fraud reminders, document readiness, and closing guidance. Hat Data and Goodies are product workspaces, not legal, brokerage, title, escrow, lending, or advisory services. EstateHat fee model is 1.50% where applicable, buyer-paid by default unless the seller elects to absorb it, and transaction funds move through third-party escrow/payment rails rather than EstateHat custody.",
      keywords: ["compliance", "legal", "disclosure", "attestation", "required", "faq", "scope", "policy", "terms", "privacy"],
      guidance: [
        "Start in Help Center or FAQ & Scope when you need platform-boundary answers.",
        "Use Forms when you need required acknowledgments or reusable attestation text.",
        "Use My Info for profile-side compliance status and record health.",
      ],
      actions: [
        { label: "Open Help Center", action: () => onNavigate("help") },
        { label: "Open FAQ & Scope", action: () => onNavigate("faq") },
        { label: "Open Forms", action: () => onNavigate("boilerplates") },
        { label: "Open Move Kit", action: () => onNavigate("move-kit") },
        { label: "Open Hat Data", action: () => onNavigate("components") },
        { label: "Open Goodies", action: () => onNavigate("ux-suite") },
        { label: "Open My Info", action: () => onNavigate("profile") },
      ],
    },
    {
      id: "fees",
      question: "Who pays the EstateHat fee?",
      answer: "EstateHat uses a 1.50% platform fee model. By default, the buyer pays that fee on top of the agreed property price. A seller can elect to absorb the fee instead, in which case the buyer does not pay it. Escrow, wire, title, and lender-side amounts can still apply separately depending on the deal structure.",
      keywords: ["fee", "fees", "pricing", "cost", "costs", "buyer pays", "seller pays", "platform fee"],
      guidance: [
        "Use FAQ & Scope when you need the plain-language fee explanation.",
        "Use Calculator and live deal views when you need the fee in transaction context.",
      ],
      actions: [
        { label: "Open Help Center", action: () => onNavigate("help") },
        { label: "Open FAQ & Scope", action: () => onNavigate("faq") },
        { label: "Open My Active Hats", action: () => onNavigate("transaction") },
      ],
    },
    {
      id: "featured",
      question: "How do I buy a featured placement?",
      answer: "Sellers can buy a featured listing after submitting a property, and service providers can buy a featured spotlight from Match Services. Featured placements run on a paid 30-day window and surface higher in EstateHat discovery views.",
      keywords: ["featured", "promote", "promotion", "spotlight", "boost", "advertise", "placement"],
      guidance: [
        "Seller promotions start after a listing submission is created.",
        "Service spotlights are managed from Match Services for eligible provider roles.",
        "Use Browse to see how featured inventory is surfacing in the market view.",
      ],
      actions: [
        { label: "Open List Property", action: () => onNavigate("list") },
        { label: "Open Match Services", action: () => onNavigate("matching") },
        { label: "Open Browse Listings", action: () => onNavigate("browse") },
      ],
    },
    {
      id: "verified-profile",
      question: "How do I activate Verified Profile billing?",
      answer: "Verified Profile billing and trust setup live in My Info. Start there to review readiness, billing provider, and the paid verification workflow.",
      keywords: ["verified profile", "verified user", "badge", "billing", "subscription", "verified billing", "membership"],
      guidance: [
        "Open My Info to review profile readiness before starting paid verification.",
        "Use Help Center if you need plain-language fee or trust-policy context first.",
      ],
      actions: [
        { label: "Open My Info", action: () => onNavigate("profile") },
        { label: "Open Help Center", action: () => onNavigate("help") },
      ],
    },
    {
      id: "messages",
      question: "Where do I keep deal conversations organized?",
      answer: "Use Messages for linked buyer, seller, and professional threads. Keep the conversation tied to the property or deal instead of spreading updates across email and text.",
      keywords: ["message", "messages", "chat", "conversation", "thread", "communicate", "inbox"],
      guidance: [
        "Open Messages when you need one conversation trail tied to the deal.",
        "Use My Active Hats when the next step is paperwork, milestones, or approvals.",
      ],
      actions: [
        { label: "Open Messages", action: () => onNavigate("messages") },
        { label: "Open My Active Hats", action: () => onNavigate("transaction") },
      ],
    },
    {
      id: "move-kit",
      question: "Where are the new 50 real estate helpers?",
      answer: "Open Move Kit. It contains 50 new buyer, seller, document, closing, and trust helpers, including offer strength, seller readiness, document explainers, closing confidence, fair housing wording checks, and wire-fraud reminders.",
      keywords: ["move kit", "helpers", "50", "tool", "tools", "helper", "guidance"],
      guidance: [
        "Use Move Kit when you need plain-language process help, not just navigation.",
        "Return to your live transaction after using a helper so the guidance stays practical.",
      ],
      actions: [
        { label: "Open Move Kit", action: () => onNavigate("move-kit") },
        { label: "Open My Active Hats", action: () => onNavigate("transaction") },
        { label: "Open Help Center", action: () => onNavigate("help") },
      ],
    },
    {
      id: "trust",
      question: "Why should I trust EstateHat with my information?",
      answer: "EstateHat uses verified account workflows, role-based controls, and encrypted data handling. Real support and policy pages are available in-app so you can review how transactions and account protections work.",
      keywords: ["trust", "safe", "security", "privacy", "data", "information", "encrypted", "protected"],
      guidance: [
        "Use Privacy Policy and Help Center when you want the formal policy view.",
        "Use My Info if you need to review your own account security and record posture.",
      ],
      actions: [
        { label: "Open Help Center", action: () => onNavigate("help") },
        { label: "Open Privacy Policy", action: () => onNavigate("privacy") },
      ],
    },
  ]), [onNavigate]);

  const workspacePlaybooks = useMemo(() => ({
    browse: {
      label: "Browse workflow",
      summary: "Move from discovery into saved targets or an active offer path.",
      steps: [
        "Filter live listings by location, type, and budget.",
        "Save strong targets to Watchlist.",
        "Open a listing detail view before messaging or offer prep.",
      ],
      actions: [
        { label: "Open Watchlist", action: () => onNavigate("watchlist") },
        { label: "Open Offer Composer", action: () => onNavigate("offer") },
      ],
    },
    list: {
      label: "Seller workflow",
      summary: "Create the submission first, then move into promotion or service support.",
      steps: [
        "Finish seller intake and review the submission.",
        "Buy a featured placement only after the submission exists.",
        "Use Match Services if you need licensed support attached.",
      ],
      actions: [
        { label: "Open Match Services", action: () => onNavigate("matching") },
        { label: "Open My Active Hats", action: () => onNavigate("transaction") },
      ],
    },
    profile: {
      label: "Account workflow",
      summary: "Use My Info to tighten trust, billing, and compliance posture.",
      steps: [
        "Review identity, trust, and verified billing readiness.",
        "Update customer database fields and profile gaps.",
        "Move into Help or FAQ if you need scope or fee context.",
      ],
      actions: [
        { label: "Open FAQ & Scope", action: () => onNavigate("faq") },
        { label: "Open Help Center", action: () => onNavigate("help") },
      ],
    },
    transaction: {
      label: "Deal workflow",
      summary: "Keep active deals moving through paperwork, parties, and milestones.",
      steps: [
        "Check the current deal for blockers and missing docs.",
        "Use Document Vault for upload and review tasks.",
        "Use Messages when a step needs an attached conversation trail.",
      ],
      actions: [
        { label: "Open Document Vault", action: () => onNavigate("documents") },
        { label: "Open Messages", action: () => onNavigate("messages") },
      ],
    },
    matching: {
      label: "Services workflow",
      summary: "Use Match Services to attach the right professional to the right deal.",
      steps: [
        "Choose the professional type you need first.",
        "Review spotlighted providers or eligible paid placement surfaces.",
        "Attach the selected professional to a specific sale target.",
      ],
      actions: [
        { label: "Open My Active Hats", action: () => onNavigate("transaction") },
        { label: "Open Messages", action: () => onNavigate("messages") },
      ],
    },
    help: {
      label: "Support workflow",
      summary: "Use support content for boundaries, disclosures, and routing clarity.",
      steps: [
        "Start in Help Center for plain-language answers.",
        "Open FAQ & Scope for formal platform boundaries.",
        "Use Forms or My Info if the answer needs action, not just reading.",
      ],
      actions: [
        { label: "Open FAQ & Scope", action: () => onNavigate("faq") },
        { label: "Open Forms", action: () => onNavigate("boilerplates") },
      ],
    },
  }), [onNavigate]);

  const contextSignals = useMemo(() => {
    const signals = [
      { label: "Role", value: accountType.replace(/_/g, " "), tone: "neutral" },
      { label: "Workspace", value: currentView, tone: "neutral" },
    ];
    if (trustedProfileVisible) {
      signals.push({ label: "Trust", value: "Verified active", tone: "good" });
    } else if (accountType !== "buyer") {
      signals.push({ label: "Trust", value: "Profile still maturing", tone: "warn" });
    }
    if (savedListingCount > 0) {
      signals.push({ label: "Saved", value: `${savedListingCount} tracked`, tone: "neutral" });
    }
    if (featuredPlacementCount > 0) {
      signals.push({ label: "Featured", value: `${featuredPlacementCount} live`, tone: "good" });
    }
    if (perms?.admin) {
      signals.push({ label: "Access", value: "Admin surfaces enabled", tone: "warn" });
    }
    return signals.slice(0, 6);
  }, [accountType, currentView, featuredPlacementCount, perms?.admin, savedListingCount, trustedProfileVisible]);

  const roleTopics = useMemo(() => {
    if (accountType === "seller" || accountType === "corporate_seller") return ["sell", "featured", "team", "fees"];
    if (["agent", "inspector", "lender"].includes(accountType)) return ["team", "featured", "messages", "verified-profile"];
    if (accountType === "admin") return ["compliance", "documents", "messages", "navigate"];
    return ["buy", "documents", "verified-profile", "fees"];
  }, [accountType]);

  const resolveAssistantQuery = useCallback((rawQuery) => {
    const normalized = String(rawQuery || "").trim().toLowerCase();
    if (!normalized) {
      return {
        topicId: activeTopic,
        title: "Ask for a goal or task",
        summary: "Ask for a goal like “I want to buy”, “upload documents”, “pricing”, or “set up my account”.",
        guidance: [
          "Keep it short and task-based so the assistant can route you clearly.",
          "Use the quick prompts below if you want a faster starting point.",
        ],
        autoAction: null,
      };
    }

    const directRoutes = [
      { topicId: "buy", matcher: /(browse|listing|listings|search homes|search property)/, actionLabel: "Open Browse Listings" },
      { topicId: "sell", matcher: /(list property|sell|seller|post home)/, actionLabel: "Open List Property" },
      { topicId: "documents", matcher: /(document|documents|upload|paperwork|vault|forms)/, actionLabel: "Open My Active Hats" },
      { topicId: "messages", matcher: /(message|messages|chat|conversation|thread)/, actionLabel: "Open Messages" },
      { topicId: "team", matcher: /(team|agent|inspector|lender|attorney|professional|match)/, actionLabel: "Open Match Services" },
      { topicId: "setup", matcher: /(setup|account|profile|verification|billing|security)/, actionLabel: "Open My Info" },
      { topicId: "verified-profile", matcher: /(verified profile|verified user|verified billing|subscription|membership|badge)/, actionLabel: "Open My Info" },
      { topicId: "featured", matcher: /(featured|promote|promotion|spotlight|boost|advertise)/, actionLabel: "Open Match Services" },
      { topicId: "compliance", matcher: /(compliance|legal|disclosure|faq|policy|terms|privacy)/, actionLabel: "Open FAQ & Scope" },
      { topicId: "fees", matcher: /(fee|fees|price|pricing|cost|costs)/, actionLabel: "Open FAQ & Scope" },
      { topicId: "move-kit", matcher: /(move kit|helper|helpers|guidance)/, actionLabel: "Open Move Kit" },
      { topicId: "trust", matcher: /(trust|safe|security|privacy|data)/, actionLabel: "Open Privacy Policy" },
      { topicId: "navigate", matcher: /(where do i go|navigate|navigation|find page|where is)/, actionLabel: "Open Help Center" },
    ];

    const directMatch = directRoutes.find((entry) => entry.matcher.test(normalized));
    let bestTopic = topics[0];
    let bestScore = -1;

    topics.forEach((topic) => {
      const haystack = [
        topic.question,
        topic.answer,
        ...(topic.keywords || []),
        ...topic.actions.map((action) => action.label),
      ].join(" ").toLowerCase();
      const score = (topic.keywords || []).reduce((total, keyword) => total + (normalized.includes(keyword) ? 3 : 0), 0)
        + topic.actions.reduce((total, action) => total + (normalized.includes(action.label.toLowerCase()) ? 2 : 0), 0)
        + (haystack.includes(normalized) ? 2 : 0);
      if (score > bestScore) {
        bestScore = score;
        bestTopic = topic;
      }
    });

    const chosenTopic = directMatch
      ? topics.find((topic) => topic.id === directMatch.topicId) || bestTopic
      : bestScore > 0
        ? bestTopic
        : topics.find((topic) => topic.id === "navigate") || bestTopic;

    const autoAction = directMatch
      ? chosenTopic.actions.find((action) => action.label === directMatch.actionLabel) || chosenTopic.actions[0]
      : /^open |^go to |^take me to |^show me /.test(normalized)
        ? chosenTopic.actions[0]
        : null;

    return {
      topicId: chosenTopic.id,
      title: chosenTopic.question,
      summary: chosenTopic.answer,
      guidance: chosenTopic.guidance || [],
      autoAction,
      nextSteps: chosenTopic.actions.slice(0, 3).map((item) => item.label),
    };
  }, [activeTopic, topics]);

  const runAssistantQuery = useCallback((rawQuery) => {
    const result = resolveAssistantQuery(rawQuery);
    setActiveTopic(result.topicId);
    setReply(result);
    setRouteHistory((current) => {
      const entry = { topicId: result.topicId, title: result.title, at: Date.now() };
      const deduped = current.filter((item) => item.topicId !== entry.topicId);
      return [entry, ...deduped].slice(0, 4);
    });
    if (result.autoAction) {
      result.autoAction.action();
    }
  }, [resolveAssistantQuery]);

  const activeEntry = topics.find((topic) => topic.id === activeTopic) || topics[0];
  const quickTopics = useMemo(() => {
    if (currentView === "profile") return ["setup", "compliance", "trust"];
    if (currentView === "browse") return ["buy", "seller", "fees"];
    if (currentView === "matching") return ["team", "featured", "messages"];
    if (currentView === "list") return ["sell", "featured", "team"];
    if (currentView === "transaction") return ["documents", "team", "compliance"];
    if (currentView === "help") return ["navigate", "compliance", "fees"];
    return ["navigate", "setup", "buy"];
  }, [currentView]);
  const smartTip = useMemo(() => (
    currentView === "help"
      ? "Pick a common question below or open the full help center."
      : currentView === "profile"
        ? "Use the assistant to jump from account cleanup into trust, billing, or compliance details."
        : "Tell me your goal, and I will take you to the right page or disclosure."
  ), [currentView]);
  const activePlaybook = workspacePlaybooks[currentView] || workspacePlaybooks.help;

  return (
    <>
      {open && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: isCompact ? 82 : 22,
            width: isCompact ? "calc(100vw - 20px)" : 420,
            maxWidth: "calc(100vw - 28px)",
            borderRadius: 20,
            background: S.card,
            border: `1px solid ${S.border}`,
            boxShadow: "0 24px 60px rgba(42, 37, 32, 0.18)",
            zIndex: 160,
            overflow: "hidden",
            backdropFilter: "blur(18px)",
            maxHeight: isCompact ? "calc(100vh - 124px)" : "calc(100vh - 44px)",
          }}
        >
          <div
            style={{
              padding: "14px 16px 12px",
              background: `linear-gradient(135deg, ${S.primary} 0%, ${S.primaryMid} 100%)`,
              color: S.navText,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: S.gold }}>
                  EstateHat Assistant
                </div>
                <div style={{ fontFamily: S.serif, fontSize: 24, lineHeight: 1, marginTop: 4 }}>Guided steps for everyone</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{ background: "transparent", border: "none", color: S.navText, fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 0 }}
                aria-label="Close assistant"
              >
                ×
              </button>
            </div>
            <div style={{ fontFamily: S.font, fontSize: 12.5, color: S.navText, opacity: 0.82, lineHeight: 1.65, marginTop: 10 }}>
              {smartTip}
            </div>
          </div>

          <div style={{ padding: 14, overflowY: "auto", maxHeight: isCompact ? "calc(100vh - 238px)" : "none" }}>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                runAssistantQuery(query);
              }}
              style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1fr auto", gap: 8, marginBottom: 10 }}
            >
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tell me what you need"
                style={{
                  border: `1px solid ${S.border}`,
                  borderRadius: 12,
                  padding: "11px 12px",
                  fontFamily: S.font,
                  fontSize: 12.5,
                  background: S.card,
                  color: S.dark,
                }}
              />
              <button
                type="submit"
                style={{
                  border: "none",
                  borderRadius: 12,
                  padding: "11px 14px",
                  background: S.gold,
                  color: S.dark,
                  cursor: "pointer",
                  fontFamily: S.font,
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                Guide Me
              </button>
            </form>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {examplePrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => {
                    setQuery(prompt);
                    runAssistantQuery(prompt);
                  }}
                  style={{
                    border: `1px solid ${S.border}`,
                    background: S.card,
                    color: S.muted,
                    borderRadius: 999,
                    padding: "7px 10px",
                    cursor: "pointer",
                    fontFamily: S.font,
                    fontSize: 11.5,
                    fontWeight: 700,
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {contextSignals.map((signal) => (
                <div
                  key={`${signal.label}-${signal.value}`}
                  style={{
                    border: `1px solid ${signal.tone === "good" ? "rgba(52, 137, 95, 0.24)" : signal.tone === "warn" ? "rgba(184, 136, 61, 0.28)" : S.border}`,
                    background: signal.tone === "good" ? "rgba(52, 137, 95, 0.08)" : signal.tone === "warn" ? "rgba(212, 160, 83, 0.1)" : S.card,
                    color: signal.tone === "good" ? "#2D6A4F" : signal.tone === "warn" ? S.goldDeep : S.muted,
                    borderRadius: 12,
                    padding: "7px 10px",
                    fontFamily: S.font,
                    fontSize: 11.5,
                    fontWeight: 700,
                  }}
                >
                  {signal.label}: {signal.value}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {quickTopics.map((topicId) => {
                const topic = topics.find((item) => item.id === topicId);
                if (!topic) return null;
                return (
                  <button
                    key={topic.id}
                    onClick={() => {
                      setActiveTopic(topic.id);
                      setReply(null);
                    }}
                    style={{
                      border: `1px solid ${activeEntry.id === topic.id ? S.gold : S.border}`,
                      background: activeEntry.id === topic.id ? S.goldBg : S.surfaceAlt,
                      color: activeEntry.id === topic.id ? S.goldDeep : S.muted,
                      borderRadius: 999,
                      padding: "8px 10px",
                      cursor: "pointer",
                      fontFamily: S.font,
                      fontSize: 11.5,
                      fontWeight: 700,
                    }}
                  >
                    {topic.question}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {roleTopics.map((topicId) => {
                const topic = topics.find((item) => item.id === topicId);
                if (!topic) return null;
                return (
                  <button
                    key={`role-${topic.id}`}
                    onClick={() => {
                      setActiveTopic(topic.id);
                      setReply(null);
                    }}
                    style={{
                      border: `1px dashed ${S.borderStrong}`,
                      background: S.card,
                      color: S.goldDeep,
                      borderRadius: 999,
                      padding: "7px 10px",
                      cursor: "pointer",
                      fontFamily: S.font,
                      fontSize: 11.5,
                      fontWeight: 800,
                    }}
                  >
                    Role route: {topic.question}
                  </button>
                );
              })}
            </div>
            <div style={{ border: `1px solid ${S.border}`, borderRadius: 12, background: S.surfaceAlt, padding: "9px 10px", fontFamily: S.font, fontSize: 11.5, color: S.muted, lineHeight: 1.5, marginBottom: 10 }}>
              Disclosures are available in Help Center, FAQ & Scope, Assistant topics, Forms, Hat Data, Goodies, and My Info. EstateHat uses a 1.50% platform fee model that is buyer-paid by default unless the seller elects to absorb it, and funds move through third-party escrow/payment rails.
            </div>
            <div style={{ border: `1px solid ${S.border}`, borderRadius: 16, background: S.blueBg, padding: 14, marginBottom: 12 }}>
              <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: S.blue, marginBottom: 6 }}>
                Current workspace plan
              </div>
              <div style={{ fontFamily: S.font, fontSize: 13, fontWeight: 800, color: S.dark, marginBottom: 6 }}>
                {activePlaybook.label}
              </div>
              <div style={{ fontFamily: S.font, fontSize: 12.5, color: S.dark, lineHeight: 1.6, marginBottom: 10 }}>
                {activePlaybook.summary}
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                {activePlaybook.steps.map((step) => (
                  <div key={step} style={{ fontFamily: S.font, fontSize: 12, color: S.muted, lineHeight: 1.5 }}>
                    • {step}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                {activePlaybook.actions.map((item) => (
                  <button
                    key={item.label}
                    onClick={item.action}
                    style={{
                      border: `1px solid ${S.blue}`,
                      background: S.card,
                      color: S.blue,
                      borderRadius: 999,
                      padding: "7px 10px",
                      cursor: "pointer",
                      fontFamily: S.font,
                      fontSize: 11.5,
                      fontWeight: 800,
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "repeat(2,minmax(0,1fr))", gap: 8, marginBottom: 12 }}>
              {topics.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTopic(item.id);
                    setReply(null);
                  }}
                  style={{
                    textAlign: "left",
                    background: activeEntry.id === item.id ? S.goldBg : S.card,
                    border: `1px solid ${S.border}`,
                    borderRadius: 14,
                    padding: "10px 12px",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 13.5, color: S.dark }}>{item.question}</div>
                </button>
              ))}
            </div>

            {reply && (
              <div style={{ border: `1px solid ${S.border}`, borderRadius: 14, background: S.blueBg, padding: "12px 13px", marginBottom: 12 }}>
                <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: S.blue, marginBottom: 6 }}>
                  Answer and guidance
                </div>
                <div style={{ fontFamily: S.font, fontSize: 13, fontWeight: 800, color: S.dark, marginBottom: 6 }}>
                  {reply.title}
                </div>
                <div style={{ fontFamily: S.font, fontSize: 12.5, color: S.dark, lineHeight: 1.6 }}>
                  {reply.summary}
                </div>
                {!!reply.guidance?.length && (
                  <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                    {reply.guidance.map((item) => (
                      <div key={item} style={{ fontFamily: S.font, fontSize: 12, color: S.muted, lineHeight: 1.5 }}>
                        • {item}
                      </div>
                    ))}
                  </div>
                )}
                {!!reply.nextSteps?.length && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    {reply.nextSteps.map((step) => (
                      <span key={step} style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, color: S.blue, background: S.card, border: `1px solid ${S.border}`, borderRadius: 999, padding: "6px 9px" }}>
                        {step}
                      </span>
                    ))}
                  </div>
                )}
                {reply.autoAction && (
                  <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.muted, marginTop: 6 }}>
                    Opened: {reply.autoAction.label}
                  </div>
                )}
              </div>
            )}

            <div style={{ border: `1px solid ${S.border}`, borderRadius: 16, background: S.card, padding: 14 }}>
              <div style={{ fontFamily: S.font, fontWeight: 800, fontSize: 13, color: S.dark, marginBottom: 8 }}>
                {activeEntry.question}
              </div>
              <div style={{ fontFamily: S.font, fontSize: 12.5, color: S.muted, lineHeight: 1.65 }}>
                {activeEntry.answer}
              </div>
              <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                {activeEntry.actions.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      setReply({ topicId: activeEntry.id, summary: activeEntry.answer, autoAction: item });
                      item.action();
                    }}
                    style={{
                      textAlign: "left",
                      background: S.surfaceAlt,
                      border: `1px solid ${S.border}`,
                      borderRadius: 12,
                      padding: "10px 12px",
                      cursor: "pointer",
                      fontFamily: S.font,
                      fontWeight: 700,
                      fontSize: 12.5,
                      color: S.dark,
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {!!routeHistory.length && (
              <div style={{ border: `1px solid ${S.border}`, borderRadius: 14, background: S.surfaceAlt, padding: "12px 13px", marginTop: 12 }}>
                <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: S.goldDeep, marginBottom: 8 }}>
                  Recent guided routes
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {routeHistory.map((item) => (
                    <button
                      key={`${item.topicId}-${item.at}`}
                      onClick={() => {
                        setActiveTopic(item.topicId);
                        setReply(null);
                      }}
                      style={{
                        textAlign: "left",
                        background: S.card,
                        border: `1px solid ${S.border}`,
                        borderRadius: 12,
                        padding: "9px 11px",
                        cursor: "pointer",
                        fontFamily: S.font,
                        fontSize: 12,
                        fontWeight: 700,
                        color: S.dark,
                      }}
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => onNavigate("help")}
              style={{
                width: "100%",
                textAlign: "center",
                background: "transparent",
                border: "none",
                padding: "10px 12px 0",
                cursor: "pointer",
                fontFamily: S.font,
                fontWeight: 700,
                fontSize: 12,
                color: S.goldDeep,
              }}
            >
              Open full Help Center
            </button>
          </div>
        </div>
      )}

      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: "fixed",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: isCompact ? 82 : 22,
            zIndex: 160,
            border: "none",
            borderRadius: 999,
            background: `linear-gradient(135deg, ${S.gold} 0%, #b98735 100%)`,
            color: S.dark,
            padding: isCompact ? "12px 16px" : "12px 18px",
            fontFamily: S.font,
            fontSize: 13,
            fontWeight: 800,
            cursor: "pointer",
            boxShadow: "0 16px 36px rgba(42, 37, 32, 0.18)",
          }}
        >
          Assistant
        </button>
      )}
    </>
  );
}

function EstateHatCommandPalette({ open, onClose, commands, onNavigate, isCompact }) {
  const [queryText, setQueryText] = useState("");

  useEffect(() => {
    if (!open) {
      setQueryText("");
      return;
    }
    const id = window.setTimeout(() => {
      document.getElementById("estatehat-command-search")?.focus();
    }, 30);
    return () => window.clearTimeout(id);
  }, [open]);

  if (!open) return null;

  const filtered = commands.filter((item) => {
    const haystack = `${item.label} ${item.meta || ""}`.toLowerCase();
    return haystack.includes(queryText.trim().toLowerCase());
  });

  function handleSelect(item) {
    onClose();
    onNavigate(item.view, item.data);
  }

  return (
    <>
      <div className="estatehat-palette-scrim" onClick={onClose} />
      <div className="estatehat-palette">
        <div style={{ padding: isCompact ? 16 : 18, borderBottom: `1px solid ${S.border}`, background: `linear-gradient(135deg, ${S.primary} 0%, ${S.primaryMid} 100%)`, color: S.navText }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: S.gold }}>Find A Page</div>
              <div style={{ fontFamily: S.serif, fontSize: isCompact ? 24 : 28, lineHeight: 1, marginTop: 4 }}>Find what you need faster</div>
            </div>
            <button onClick={onClose} style={{ background: "transparent", border: `1px solid rgba(255,255,255,0.16)`, borderRadius: 999, padding: "8px 12px", color: "#f4eadc", fontFamily: S.font, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Close
            </button>
          </div>
          <div style={{ fontFamily: S.font, fontSize: 12.5, color: S.navText, opacity: 0.82, lineHeight: 1.65, marginTop: 10 }}>
            Search pages and common actions. Shortcut: Ctrl/Cmd + K
          </div>
        </div>
        <div style={{ padding: 14 }}>
          <input
            id="estatehat-command-search"
            type="search"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Search homes, my active hats, my info, help..."
            style={{ ...S.input, marginBottom: 12 }}
          />
          <div style={{ display: "grid", gap: 8, maxHeight: "52vh", overflowY: "auto" }}>
            {filtered.length ? filtered.map((item) => (
              <button
                key={`${item.kind}-${item.label}`}
                className="estatehat-palette-item"
                onClick={() => handleSelect(item)}
                style={{
                  textAlign: "left",
                  width: "100%",
                  border: `1px solid ${S.border}`,
                  borderRadius: 16,
                  background: S.card,
                  padding: "12px 14px",
                  cursor: "pointer",
                  transition: "transform 0.18s ease, border-color 0.18s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontFamily: S.font, fontWeight: 700, fontSize: 13.5, color: S.dark }}>{item.label}</div>
                    <div style={{ fontFamily: S.font, fontSize: 11.5, color: S.light, marginTop: 3 }}>{item.meta}</div>
                  </div>
                  <div style={{ fontFamily: S.font, fontSize: 10.5, fontWeight: 800, color: S.goldDeep, letterSpacing: 1, textTransform: "uppercase" }}>
                    Go
                  </div>
                </div>
              </button>
            )) : (
              <div style={{ border: `1px solid ${S.border}`, borderRadius: 16, background: S.card, padding: 18, fontFamily: S.font, fontSize: 13, color: S.light, textAlign: "center" }}>
                No matching page or action.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}


// ═══════════════════════════════════════════
// ─── MAIN APP ─────────────────────────────
// ═══════════════════════════════════════════

export default function App({ initialUser, onLogout, onSaveProfile }) {
  const isCompact = useMediaQuery("(max-width: 900px)");
  const deviceInfo = useOperatingSystem();
  const layoutMode = isCompact || deviceInfo.isMobileOs ? "mobile" : "desktop";
  const [themeMode, setThemeMode] = useState(resolveInitialThemeMode);
  const darkMode = themeMode !== "light";
  const [view, setView] = useState(initialUser ? "dashboard" : "splash");
  const [viewData, setViewData] = useState(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const topRef = useRef(null);
  const [savedListingIds, setSavedListingIds] = useLocalStorageState("estatehat-watchlist", []);
  const [recentViewedIds, setRecentViewedIds] = useLocalStorageState("estatehat-recent-views", []);
  const [savedSearches, setSavedSearches] = useLocalStorageState("estatehat-saved-searches", []);
  const [collaboratorsByDeal, setCollaboratorsByDeal] = useLocalStorageState("estatehat-collaborators-by-deal-v1", {});
  const [listings, setListings] = useState([]);
  const [featuredPlacements, setFeaturedPlacements] = useState([]);
  const [listingsReady, setListingsReady] = useState(false);
  const [listingSyncError, setListingSyncError] = useState("");
  const [navigationNotice, setNavigationNotice] = useState("");
  const [toasts, setToasts] = useState([]);
  const [confirmRequest, setConfirmRequest] = useState(null);

  useEffect(() => {
    return subscribeToListings(
      (liveData) => {
        setListings(liveData);
        setListingSyncError("");
        setListingsReady(true);
      },
      (error) => {
        console.error("Listing sync error:", error);
        setListingSyncError(error?.message || "Unable to sync listings.");
        setListingsReady(true);
      }
    );
  }, []);

  useEffect(() => {
    return subscribeToFeaturedPlacements(
      (liveData) => {
        setFeaturedPlacements(liveData);
      },
      (error) => {
        console.error("Featured placement sync error:", error);
      }
    );
  }, []);

  const [user, setUser] = useState(initialUser);

  useEffect(() => {
    setUser(initialUser);
    if (initialUser) setView("dashboard");
    if (!initialUser) setView("splash");
  }, [initialUser]);

  useEffect(() => {
    // Preconnect to Google Fonts for faster load
    if (!document.getElementById("estatehat-font-preconnect")) {
      const preconnect = document.createElement("link");
      preconnect.id = "estatehat-font-preconnect";
      preconnect.rel = "preconnect";
      preconnect.href = "https://fonts.googleapis.com";
      document.head.appendChild(preconnect);
    }
    if (!document.getElementById("estatehat-fonts-origin-preconnect")) {
      const preconnect2 = document.createElement("link");
      preconnect2.id = "estatehat-fonts-origin-preconnect";
      preconnect2.rel = "preconnect";
      preconnect2.href = "https://fonts.gstatic.com";
      preconnect2.crossOrigin = "anonymous";
      document.head.appendChild(preconnect2);
    }
    // Load fonts
    if (!document.getElementById("estatehat-app-fonts")) {
      const link = document.createElement("link");
      link.id = "estatehat-app-fonts";
      link.href = FONT_LINK;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    // Inject shimmer animation for skeleton loaders
    if (!document.getElementById("estatehat-shimmer-style")) {
      const style = document.createElement("style");
      style.id = "estatehat-shimmer-style";
      style.textContent = SHIMMER_CSS;
      document.head.appendChild(style);
    }
    // Inject theme CSS variables
    if (!document.getElementById("estatehat-theme-style")) {
      const themeStyle = document.createElement("style");
      themeStyle.id = "estatehat-theme-style";
      themeStyle.textContent = THEME_CSS;
      document.head.appendChild(themeStyle);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.estatehatTheme = themeMode;
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem(THEME_MODE_STORAGE_KEY, themeMode);
    localStorage.setItem(LEGACY_DARK_STORAGE_KEY, String(darkMode));
  }, [darkMode, themeMode]);

  useEffect(() => {
    if (!navigationNotice) return undefined;
    const timeout = window.setTimeout(() => setNavigationNotice(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [navigationNotice]);

  const notify = useCallback((toast) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((current) => [...current, { id, tone: "info", ...toast }].slice(-4));
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 4200);
  }, []);

  const featuredListingIds = useMemo(() => buildFeaturedListingIdSet(listings, featuredPlacements), [featuredPlacements, listings]);

  const sortedListings = useMemo(() => {
    if (!featuredListingIds.size) return listings;
    return [...listings].sort((a, b) => {
      const featuredDelta = Number(featuredListingIds.has(b.id)) - Number(featuredListingIds.has(a.id));
      if (featuredDelta !== 0) return featuredDelta;
      return Number(a.daysListed || 0) - Number(b.daysListed || 0);
    });
  }, [featuredListingIds, listings]);

  useEffect(() => {
    if (!user || typeof window === "undefined") return undefined;
    const params = new URLSearchParams(window.location.search);
    const stripeState = params.get("stripe");
    if (!stripeState) return undefined;

    const refreshProfile = async () => {
      if (!auth.currentUser) return;
      try {
        const refreshed = await loadUserProfile(auth.currentUser);
        if (refreshed) {
          setUser(refreshed);
        }
      } catch (error) {
        console.error("Stripe profile refresh failed:", error);
      }
    };

    if (stripeState === "verified-success") {
      notify({ tone: "success", title: "Stripe checkout completed", body: "Verified membership is syncing back into EstateHat." });
    } else if (stripeState === "platform-fee-success") {
      notify({ tone: "success", title: "Platform fee payment completed", body: "The Stripe payment completed and is being recorded." });
    } else if (stripeState === "connect-return") {
      notify({ tone: "success", title: "Stripe Connect returned", body: "Refreshing payout status from Stripe." });
    } else if (stripeState === "verified-cancel" || stripeState === "platform-fee-cancel" || stripeState === "featured-placement-cancel") {
      notify({ tone: "warn", title: "Stripe checkout canceled", body: "No payment was completed." });
    } else if (stripeState === "featured-placement-success") {
      notify({ tone: "success", title: "Featured placement purchased", body: "Your paid promotion is being activated and will surface in EstateHat shortly." });
    }

    refreshProfile();
    const followup = window.setTimeout(refreshProfile, 2500);
    params.delete("stripe");
    params.delete("session_id");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash || ""}`;
    window.history.replaceState({}, document.title, nextUrl);
    return () => window.clearTimeout(followup);
  }, [notify, user]);

  const requestConfirm = useCallback((request) => {
    setConfirmRequest(request);
  }, []);

  const closeConfirm = useCallback(() => setConfirmRequest(null), []);

  const runConfirm = useCallback(() => {
    const action = confirmRequest?.onConfirm;
    setConfirmRequest(null);
    action?.();
  }, [confirmRequest]);

  const navigate = useCallback((v, data) => {
    const navPerms = getPerms(user?.accountType || "buyer");
    if (!isViewAllowedForPerms(v, navPerms)) {
      const acct = ACCOUNT_TYPES.find((a) => a.key === (user?.accountType || "buyer"));
      setNavigationNotice(`${acct?.label || "Current account"} cannot access ${v}.`);
      setCommandOpen(false);
      return;
    }
    if (view === v && viewData === data) return;
    if (v === "detail" && data) {
      setRecentViewedIds((current) => [data, ...current.filter((id) => id !== data)].slice(0, 8));
    }
    setView(v);
    setViewData(data);
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    topRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
  }, [setRecentViewedIds, user?.accountType, view, viewData]);

  const toggleSavedListing = useCallback((listingId) => {
    setSavedListingIds((current) => (
      current.includes(listingId)
        ? current.filter((id) => id !== listingId)
        : [listingId, ...current].slice(0, 24)
    ));
  }, [setSavedListingIds]);

  const saveSearchPreset = useCallback((filters) => {
    const normalized = {
      id: `${Date.now()}`,
      search: (filters.search || "").trim(),
      type: filters.type || "All",
      sort: filters.sort || "newest",
      priceRange: filters.priceRange || "all",
      verifiedOnly: !!filters.verifiedOnly,
    };
    setSavedSearches((current) => {
      const deduped = current.filter((item) => savedSearchLabel(item) !== savedSearchLabel(normalized));
      return [normalized, ...deduped].slice(0, 8);
    });
  }, [setSavedSearches]);

  const removeSavedSearch = useCallback((searchId) => {
    setSavedSearches((current) => current.filter((item) => item.id !== searchId));
  }, [setSavedSearches]);
  const attachProfessionalToDeal = useCallback(({ dealId, property, professional }) => {
    if (!dealId || !professional?.id) return;
    const normalized = {
      id: professional.id,
      name: professional.name,
      role: professional.role,
      linkedin: professional.linkedin || "",
      property: property || dealId,
      attachedAt: new Date().toISOString(),
      attachedBy: user?.name || "User",
      attachedByRole: user?.accountType || "seller",
    };
    setCollaboratorsByDeal((previous) => {
      const current = Array.isArray(previous[dealId]) ? previous[dealId] : [];
      const deduped = current.filter((entry) => entry.id !== normalized.id);
      return {
        ...previous,
        [dealId]: [...deduped, normalized],
      };
    });
  }, [setCollaboratorsByDeal, user]);

  const syncJurisdictionFromTransaction = useCallback(async (incoming = {}) => {
    if (!user) return;
    const currentCompliance = user.compliance || {};
    const currentJurisdiction = currentCompliance.jurisdiction || {};
    const nextJurisdiction = {
      country: currentJurisdiction.country || "US",
      state: String(incoming.state || currentJurisdiction.state || "NC").trim().toUpperCase(),
      county: String(incoming.county || currentJurisdiction.county || "").trim(),
      city: String(incoming.city || currentJurisdiction.city || "").trim(),
      municipality: String(incoming.municipality || currentJurisdiction.municipality || "").trim(),
    };
    const overlay = deriveLocationComplianceOverlay(nextJurisdiction);
    const nowIso = new Date().toISOString();
    const nextProfile = {
      ...user,
      compliance: {
        ...currentCompliance,
        jurisdiction: nextJurisdiction,
        outlierFlags: {
          ...(currentCompliance.outlierFlags || {}),
          ...overlay.outlierFlags,
        },
        regulatoryProfile: {
          ...(currentCompliance.regulatoryProfile || {}),
          baselineProfile: "strict_us_51",
          outlierReviewRequired: !!overlay.outlierFlags.counselReviewRequired,
          outlierLastReviewedAt: nowIso,
          lastJurisdictionReviewAt: nowIso,
        },
        supportPacket: {
          ...(currentCompliance.supportPacket || {}),
          notes: overlay.checklist.join(" | ").slice(0, 600),
        },
      },
    };
    setUser(nextProfile);
    try {
      await onSaveProfile?.(nextProfile);
    } catch (error) {
      console.error("Jurisdiction sync failed:", error);
    }
  }, [onSaveProfile, user]);
  const currentUser = user || { name: "User", accountType: "buyer", trust: { verifiedProfileActive: false } };
  const sellerSaleTargets = useMemo(() => {
    return [];
  }, []);
  const perms = useMemo(() => getPerms(currentUser.accountType), [currentUser.accountType]);
  const acctInfo = useMemo(() => ACCOUNT_TYPES.find((a) => a.key === currentUser.accountType), [currentUser.accountType]);
  const acctBlueprint = useMemo(() => getAccountBlueprint(currentUser.accountType), [currentUser.accountType]);
  const navTrustedProfileActive =
    !!currentUser?.trust?.verifiedProfileActive &&
    currentUser?.trust?.verifiedProfileVisibility !== false &&
    hasTrustedProfileEligibility(currentUser);
  const userInitials = (currentUser.name || "User")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const navBtn = (label, target, badge, permKey) => {
    if (permKey && !perms[permKey]) return null;
    return (
      <button key={target} type="button" onClick={() => navigate(target)} style={{
        width: isCompact ? "auto" : "100%",
        background: view === target ? "rgba(212,160,83,0.18)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${view === target ? "rgba(212,160,83,0.42)" : "rgba(255,255,255,0.1)"}`,
        borderRadius: 8,
        fontFamily: S.font,
        fontSize: 12,
        fontWeight: view === target ? 700 : 600,
        color: view === target ? S.gold : S.navText,
        cursor: "pointer",
        padding: "7px 11px",
        whiteSpace: "nowrap",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: 8,
        position: "relative",
        textAlign: "left",
        transition: "transform 0.18s ease, border-color 0.18s ease, background 0.18s ease",
      }}>
        <span style={{ width: 6, height: 6, borderRadius: 99, background: view === target ? S.gold : "rgba(255,255,255,0.32)" }} />
        {label}
        {badge > 0 && <span style={{ background: S.red, color: "#fff", borderRadius: 8, padding: "1px 6px", fontSize: 10, fontWeight: 700, marginLeft: 2 }}>{badge}</span>}
      </button>
    );
  };

  const primaryNavItems = useMemo(() => ([
    { label: "Hat Board", target: "dashboard", badge: 0 },
    { label: "Action Inbox", target: "action-inbox", badge: 0 },
    { label: "Search", target: "search", badge: 0 },
    { label: "Browse", target: "browse", badge: 0, permKey: "browse" },
    { label: "Match", target: "matching", badge: 0, permKey: "browse" },
    { label: "Watchlist", target: "watchlist", badge: savedListingIds.length, permKey: "browse" },
    { label: "List", target: "list", badge: 0, permKey: "list" },
    { label: "Notices", target: "notifications", badge: 5 },
    { label: "Messages", target: "messages", badge: 3, permKey: "messages" },
    { label: "Docs", target: "documents", badge: 0, permKey: "transaction" },
    { label: "My Active Hats", target: "transaction", badge: 0, permKey: "transaction" },
    { label: "Move Kit", target: "move-kit", badge: ESTATEHAT_MOVE_KIT_COUNT },
    { label: "Hat Data", target: "components", badge: 50 },
    { label: "Goodies", target: "ux-suite", badge: ESTATEHAT_UX_FEATURE_COUNT },
    { label: "Forms", target: "boilerplates", badge: 0, permKey: "boilerplates" },
    { label: "Admin", target: "admin", badge: 0, permKey: "admin" },
    { label: "My Info", target: "profile", badge: 0, permKey: "profile" },
  ]), [savedListingIds.length]);

  const gatedView = (permKey, featureName, component) => {
    if (!perms[permKey]) return <RestrictedBanner role={user?.accountType || "buyer"} feature={featureName} />;
    return component;
  };

  const commandEntries = useMemo(() => {
    const entries = [
      { kind: "nav", label: "Hat Board", meta: "Return to your main status board", view: "dashboard" },
      { kind: "nav", label: "Action Inbox", meta: "Review account, deal, document, and money next steps", view: "action-inbox" },
      { kind: "nav", label: "Universal Search", meta: "Find listings, deals, docs, and pages", view: "search" },
      { kind: "nav", label: "Notification Center", meta: "Review alerts, tasks, and requests", view: "notifications" },
      { kind: "nav", label: "Help Center", meta: "Get directions and answers", view: "help" },
      { kind: "nav", label: "FAQ & Scope", meta: "Understand what is and is not covered", view: "faq" },
      { kind: "nav", label: "Calculator", meta: "Estimate closing costs and fees", view: "calculator" },
      { kind: "nav", label: "Move Kit", meta: `${ESTATEHAT_MOVE_KIT_COUNT} buyer, seller, document, closing, and trust helpers`, view: "move-kit" },
      { kind: "nav", label: "Hat Data", meta: "Review installed EstateHat data and workflow items", view: "components" },
      { kind: "nav", label: "Goodies", meta: `Install and run ${ESTATEHAT_UX_FEATURE_COUNT} EstateHat goodies`, view: "ux-suite" },
    ];

    if (perms.browse) entries.push({ kind: "nav", label: "Browse Listings", meta: "Search homes and inventory", view: "browse" });
    if (perms.browse) entries.push({ kind: "nav", label: "Property Comparison", meta: "Compare listing facts and fees", view: "compare" });
    if (perms.browse) entries.push({ kind: "nav", label: "Tour Scheduler", meta: "Schedule showings and walkthroughs", view: "tours" });
    if (perms.browse) entries.push({ kind: "nav", label: "Offer Composer", meta: "Draft offer terms and contingencies", view: "offer" });
    if (perms.browse) entries.push({ kind: "nav", label: "Match Services", meta: "Find agent, inspector, and lender matches", view: "matching" });
    if (perms.browse) entries.push({ kind: "nav", label: "Watchlist", meta: "Review saved homes", view: "watchlist" });
    if (perms.transaction) entries.push({ kind: "nav", label: "My Active Hats", meta: "Paperwork, updates, and closing steps", view: "transaction" });
    if (perms.transaction) entries.push({ kind: "nav", label: "Transaction Timeline", meta: "See milestones and blockers", view: "milestones" });
    if (perms.transaction) entries.push({ kind: "nav", label: "Document Vault", meta: "Preview and upload transaction documents", view: "documents" });
    if (perms.messages) entries.push({ kind: "nav", label: "Messages", meta: "See conversations and updates", view: "messages" });
    if (perms.profile) entries.push({ kind: "nav", label: "My Info", meta: "Account details and setup", view: "profile" });
    if (perms.list) entries.push({ kind: "nav", label: "List Property", meta: "Start a new home sale listing", view: "list" });
    if (perms.boilerplates) entries.push({ kind: "nav", label: "Forms", meta: "Access reusable transaction documents", view: "boilerplates" });
    if (perms.admin) entries.push({ kind: "nav", label: "Admin Workbench", meta: "Bulk review documents, flags, and deals", view: "admin-workbench" });
    if (perms.admin) entries.push({ kind: "nav", label: "Admin Oversight", meta: "Review compliance and controls", view: "admin" });
    return entries;
  }, [perms]);

  useEffect(() => {
    function handleKeydown(event) {
      const tag = event.target?.tagName?.toLowerCase() || "";
      const isTyping = tag === "input" || tag === "textarea" || tag === "select" || event.target?.isContentEditable;

      if ((event.ctrlKey || event.metaKey) && !event.altKey && String(event.key).toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((current) => !current);
        return;
      }

      if (event.key === "Escape" && commandOpen) {
        event.preventDefault();
        setCommandOpen(false);
        return;
      }

      if (!event.altKey || event.ctrlKey || event.metaKey || isTyping) return;
      if (!["1", "2", "3"].includes(event.key)) return;

      const shortcuts = [
        () => navigate(perms.browse ? "browse" : "dashboard"),
        () => navigate(perms.transaction ? "transaction" : "help"),
        () => navigate(perms.profile ? "profile" : "help"),
      ];
      const action = shortcuts[Number(event.key) - 1];
      if (action) {
        event.preventDefault();
        action();
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [commandOpen, navigate, perms]);

  return (
    <div
      ref={topRef}
      className={`estatehat-shell estatehat-os-${deviceInfo.os} estatehat-${layoutMode}`}
      data-os={deviceInfo.os}
      data-layout-mode={layoutMode}
      data-mobile-os={deviceInfo.isMobileOs ? "true" : "false"}
      style={{ minHeight: "100vh", background: S.bg, fontFamily: S.font, paddingRight: isCompact ? 0 : 280, paddingBottom: isCompact && user ? 78 : 0, boxSizing: "border-box" }}
    >
      {/* ── Nav ── */}
      <nav className="estatehat-nav" style={{ background: darkMode ? "rgba(12,15,12,0.94)" : "rgba(17,21,17,0.94)", display: "flex", flexDirection: isCompact ? "row" : "column", alignItems: isCompact ? "center" : "stretch", justifyContent: isCompact ? "space-between" : "flex-start", padding: isCompact ? "10px 14px" : "18px 16px", minHeight: isCompact ? 68 : "100vh", maxHeight: isCompact ? "none" : "100vh", width: isCompact ? "auto" : 280, position: isCompact ? "sticky" : "fixed", top: 0, right: isCompact ? "auto" : 0, zIndex: 100, boxShadow: isCompact ? "0 10px 28px rgba(0,0,0,0.16)" : "-2px 0 22px rgba(0,0,0,0.18)", gap: isCompact ? 12 : 16, borderBottom: isCompact ? `1px solid ${darkMode ? "rgba(240,244,240,0.08)" : "rgba(255,255,255,0.08)"}` : "none", borderLeft: isCompact ? "none" : `1px solid ${darkMode ? "rgba(240,244,240,0.08)" : "rgba(255,255,255,0.08)"}`, overflowY: isCompact ? "visible" : "auto", boxSizing: "border-box" }}>
        <div onClick={() => navigate("dashboard")} style={{ cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", gap: 10, paddingBottom: isCompact ? 0 : 14, borderBottom: isCompact ? "none" : "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ width: isCompact ? 28 : 32, height: isCompact ? 28 : 32, borderRadius: 8, background: "#2A2520", display: "grid", placeItems: "center", boxShadow: "0 8px 18px rgba(0,0,0,0.18)", overflow: "hidden", border: `1px solid ${S.borderStrong}` }}>
            <img src="/icons/estatehat-icon.svg" alt="EstateHat" style={{ width: "100%", height: "100%", display: "block" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ fontFamily: S.serif, fontSize: isCompact ? 18 : 21, color: S.gold }}>
              EstateHat
            </div>
            {!isCompact && (
              <div style={{ fontFamily: S.font, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,243,229,0.64)" }}>
                Private real estate, handled with care
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: isCompact ? "row" : "column", gap: isCompact ? 10 : 8, alignItems: isCompact ? "center" : "stretch", overflowX: isCompact ? "auto" : "visible", flex: isCompact ? 1 : "0 0 auto" }}>
          {primaryNavItems.map((item) => navBtn(item.label, item.target, item.badge, item.permKey))}
          <div style={{ display: "flex", flexDirection: isCompact ? "row" : "column", alignItems: isCompact ? "center" : "stretch", gap: 8, marginLeft: isCompact ? 4 : 0, marginTop: isCompact ? 0 : 12, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg, ${S.gold}, #B8883D)`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, color: "#151712", cursor: "pointer" }}>
              {userInitials}
            </div>
            <div style={{ fontFamily: S.font, fontSize: 10, color: S.navText, opacity: 0.76, lineHeight: 1.2, maxWidth: 70 }}>
              <div style={{ color: S.navText, fontWeight: 600, fontSize: 11 }}>{(currentUser.name || "Guest").split(" ")[0]}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span>{acctInfo?.label || "Guest"}</span>
                {navTrustedProfileActive && <span style={{ color: "#6BE18D", fontSize: 10 }}>●</span>}
              </div>
            </div>
            </div>
            <span className="estatehat-device-chip" title={`Detected ${deviceInfo.label}; using ${layoutMode} layout`}>
              {layoutMode === "mobile" ? "Tile View" : "Desktop View"}
            </span>
            <select value={themeMode} onChange={(event) => setThemeMode(event.target.value)} title="Choose theme" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${S.borderStrong}`, color: S.navText, borderRadius: 8, padding: isCompact ? "4px 28px 4px 10px" : "8px 32px 8px 10px", fontFamily: S.font, fontSize: 11, cursor: "pointer", flexShrink: 0, fontWeight: 700, appearance: "none", WebkitAppearance: "none", MozAppearance: "none", minHeight: isCompact ? 32 : 40 }}>
              {THEME_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} style={{ color: "#171A17" }}>
                  {option.label}
                </option>
              ))}
            </select>
            <button onClick={() => setCommandOpen(true)} title="Find a page" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${S.borderStrong}`, borderRadius: 8, padding: isCompact ? "6px 12px" : "8px 10px", fontFamily: S.font, fontSize: 11, color: S.navText, cursor: "pointer", flexShrink: 0, fontWeight: 700 }}>
              ⌘ Find
            </button>
            {user && onLogout && (
              <button onClick={onLogout} style={{ background: "transparent", border: `1px solid ${S.borderStrong}`, borderRadius: 8, padding: isCompact ? "4px 10px" : "8px 10px", fontFamily: S.font, fontSize: 11, color: S.navText, cursor: "pointer", flexShrink: 0 }}>
                Log out
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ── Role Permissions Banner ── */}
      {user && currentUser.accountType !== "admin" && (
        <div style={{ background: S.goldBg, padding: "6px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <span style={{ fontSize: 12 }}>{acctInfo?.icon}</span>
          <span style={{ fontFamily: S.font, fontSize: 12, color: S.goldDeep }}>
            Logged in as <strong>{acctInfo?.label}</strong> in the <strong>{acctBlueprint.label}</strong> account. Your details, paperwork status, and account settings live in My Info.
          </span>
          {navTrustedProfileActive && <Badge variant="verified">🟢 Trusted User</Badge>}
        </div>
      )}

      {!listingsReady && (
        <div style={{ background: S.blueBg, color: S.blue, fontFamily: S.font, fontSize: 12, textAlign: "center", padding: "8px 16px" }}>
          Syncing live listings...
        </div>
      )}
      {listingsReady && listingSyncError && (
        <div style={{ background: S.redBg, color: S.red, fontFamily: S.font, fontSize: 12, textAlign: "center", padding: "8px 16px" }}>
          Listing sync issue: {listingSyncError}
        </div>
      )}
      {navigationNotice && (
        <div style={{ background: S.goldBg, color: S.goldDeep, fontFamily: S.font, fontSize: 12, textAlign: "center", padding: "8px 16px" }}>
          {navigationNotice}
        </div>
      )}

      {view === "splash" && <HomeView onNavigate={navigate} user={currentUser} listings={listings} savedListingIds={savedListingIds} recentViewedIds={recentViewedIds} savedSearches={savedSearches} onToggleSave={toggleSavedListing} />}
      {view === "dashboard" && <HatBoardView onNavigate={navigate} user={currentUser} perms={perms} listings={sortedListings} savedListingIds={savedListingIds} recentViewedIds={recentViewedIds} savedSearches={savedSearches} listingsReady={listingsReady} listingSyncError={listingSyncError} />}
      {view === "action-inbox" && <ActionInboxView onNavigate={navigate} user={currentUser} perms={perms} listings={sortedListings} savedListingIds={savedListingIds} recentViewedIds={recentViewedIds} savedSearches={savedSearches} listingsReady={listingsReady} listingSyncError={listingSyncError} />}
      {view === "search" && <UniversalSearchView onNavigate={navigate} listings={listings} savedSearches={savedSearches} recentViewedIds={recentViewedIds} />}
      {view === "home" && <HomeView onNavigate={navigate} user={currentUser} listings={listings} savedListingIds={savedListingIds} recentViewedIds={recentViewedIds} savedSearches={savedSearches} onToggleSave={toggleSavedListing} />}
      {view === "browse" && gatedView("browse", "Browse Listings", <BrowseView onNavigate={navigate} listings={sortedListings} featuredPlacements={featuredPlacements} initialSearch={viewData} savedSearches={savedSearches} onSaveSearch={saveSearchPreset} onApplySavedSearch={(saved) => navigate("browse", saved)} onRemoveSavedSearch={removeSavedSearch} savedListingIds={savedListingIds} onToggleSave={toggleSavedListing} listingsReady={listingsReady} listingSyncError={listingSyncError} />)}
      {view === "compare" && gatedView("browse", "Property Comparison", <PropertyComparisonView key={currentUser?.uid || "guest"} listings={listings} savedListingIds={savedListingIds} onNavigate={navigate} userKey={currentUser?.uid || "guest"} />)}
      {view === "tours" && gatedView("browse", "Tour Scheduler", <TourSchedulerView key={currentUser?.uid || "guest"} listings={listings} notify={notify} userKey={currentUser?.uid || "guest"} />)}
      {view === "watchlist" && gatedView("browse", "Watchlist", <WatchlistView listings={listings} savedListingIds={savedListingIds} onNavigate={navigate} onToggleSave={toggleSavedListing} savedSearches={savedSearches} onApplySavedSearch={(saved) => navigate("browse", saved)} />)}
      {view === "detail" && gatedView("detail", "Listing Details", <DetailView listingId={viewData} onNavigate={navigate} perms={perms} listings={listings} user={currentUser} isSaved={savedListingIds.includes(viewData)} onToggleSave={toggleSavedListing} onTrackListing={(id) => setRecentViewedIds((current) => [id, ...current.filter((entry) => entry !== id)].slice(0, 8))} onSyncJurisdiction={syncJurisdictionFromTransaction} />)}
      {view === "list" && gatedView("list", "List Property", <ListPropertyView onNavigate={navigate} user={currentUser} onSyncJurisdiction={syncJurisdictionFromTransaction} />)}
      {view === "profile" && user && <ProfileView user={user} setUser={setUser} perms={perms} onSaveProfile={onSaveProfile} onNotify={notify} />}
      {view === "transaction" && gatedView("transaction", "My Active Hats", <TransactionView onNavigate={navigate} user={currentUser} collaboratorsByDeal={collaboratorsByDeal} />)}
      {view === "milestones" && gatedView("transaction", "Transaction Timeline", <TransactionMilestonesView onNavigate={navigate} deals={[]} />)}
      {view === "documents" && gatedView("transaction", "Document Vault", <DocumentVaultView key={currentUser?.uid || "guest"} initialDocId={viewData} notify={notify} docs={[]} deals={[]} userKey={currentUser?.uid || "guest"} />)}
      {view === "offer" && gatedView("browse", "Offer Composer", <OfferComposerView key={currentUser?.uid || "guest"} listings={listings} notify={notify} userKey={currentUser?.uid || "guest"} />)}
      {view === "notifications" && <NotificationCenterView key={currentUser?.uid || "guest"} onNavigate={navigate} notify={notify} userKey={currentUser?.uid || "guest"} />}
      {view === "messages" && gatedView("messages", "Messages", <MessagesView user={currentUser} onNavigate={navigate} collaboratorsByDeal={collaboratorsByDeal} conversationPrefill={viewData} />)}
      {view === "move-kit" && (
        <Suspense fallback={<Skeleton height={260} radius={10} style={{ margin: 24 }} />}>
          <EstateHatMoveKitView onNavigate={navigate} listings={listings} user={currentUser} />
        </Suspense>
      )}
      {view === "components" && <EstateHatComponentSuiteView onNavigate={navigate} listings={listings} savedListingIds={savedListingIds} user={currentUser} />}
      {view === "ux-suite" && (
        <Suspense fallback={<Skeleton height={260} radius={10} style={{ margin: 24 }} />}>
          <EstateHatUxSuiteView onNavigate={navigate} listings={listings} user={currentUser} />
        </Suspense>
      )}
      {view === "admin" && gatedView("admin", "Admin Oversight", <AdminView onNavigate={navigate} user={currentUser} />)}
      {view === "admin-workbench" && gatedView("admin", "Admin Workbench", <AdminWorkbenchView notify={notify} confirmAction={requestConfirm} docs={[]} flags={[]} transactions={[]} />)}
      {view === "boilerplates" && gatedView("boilerplates", "Forms", <BoilerplatesView />)}
      {view === "terms" && <TermsView onNavigate={navigate} />}
      {view === "privacy" && <PrivacyView onNavigate={navigate} />}
      {view === "about" && <AboutView onNavigate={navigate} />}
      {view === "press" && <PressView onNavigate={navigate} />}
      {view === "invest" && <InvestView onNavigate={navigate} />}
      {view === "accessibility" && <AccessibilityView onNavigate={navigate} />}
      {view === "dmca" && <DmcaView onNavigate={navigate} />}
      {view === "calculator" && <CalculatorView onNavigate={navigate} userKey={currentUser?.uid || "guest"} />}
      {view === "matching" && gatedView("browse", "Match Services", <MatchingServiceView onNavigate={navigate} user={currentUser} featuredPlacements={featuredPlacements} saleTargets={sellerSaleTargets} attachedByDeal={collaboratorsByDeal} onAttachProfessional={attachProfessionalToDeal} />)}
      {view === "help" && <HelpView onNavigate={navigate} />}
      {view === "faq" && <FAQView onNavigate={navigate} />}

      {/* ── Footer ── */}
      <footer style={{ background: S.nav, padding: "48px 24px 32px", marginTop: 60 }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          {/* Top Row: Logo + Links */}
          <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1.5fr 1fr 1fr 1fr 1fr", gap: 32, marginBottom: 36 }}>
            {/* Brand */}
            <div>
              <div style={{ fontFamily: S.serif, fontSize: 22, color: S.gold, marginBottom: 8 }}>🎩 EstateHat</div>
              <div style={{ fontFamily: S.font, fontSize: 13, color: S.muted, lineHeight: 1.7 }}>
                A Place Where You Can Hang Your Hat. A simpler way to keep up with homes, paperwork, and closing steps in one place.
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                {["Web", "iOS", "Android", "Windows"].map((p) => (
                  <span key={p} style={{ fontFamily: S.font, fontSize: 10, color: S.gold, background: "rgba(212,160,83,0.12)", padding: "3px 10px", borderRadius: 8, fontWeight: 600 }}>{p}</span>
                ))}
              </div>
            </div>
            {/* Product */}
            <div>
              <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: S.light, marginBottom: 12 }}>Product</div>
              {[
                ["Browse Listings", "browse", "browse"],
                ["Match Services", "matching", "browse"],
                ["List Property", "list", "list"],
                ["Forms", "boilerplates", "boilerplates"],
                ["Move Kit", "move-kit", null],
                ["Hat Data", "components", null],
                ["Goodies", "ux-suite", null],
                ["Calculator", "calculator", null],
              ]
                .filter(([, , permKey]) => !permKey || perms[permKey])
                .map(([label, target]) => (
                  <div key={label} onClick={() => navigate(target)} style={{ fontFamily: S.font, fontSize: 13, color: S.mid, padding: "4px 0", cursor: "pointer" }}>{label}</div>
                ))}
            </div>
            {/* Company */}
            <div>
              <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: S.light, marginBottom: 12 }}>Company</div>
              {[["About Us", "about"], ["Help Center", "help"], ["FAQ & Scope", "faq"], ["Invest", "invest"], ["Careers", null], ["Press", "press"]].map(([label, view]) => (
                <div key={label} onClick={() => view && navigate(view)} style={{ fontFamily: S.font, fontSize: 13, color: view ? S.mid : S.light, padding: "4px 0", cursor: view ? "pointer" : "default" }}>{label}{!view && " (Coming Soon)"}</div>
              ))}
            </div>
            {/* Legal */}
            <div>
              <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: S.light, marginBottom: 12 }}>Legal</div>
              {[["Terms of Service", "terms"], ["Privacy Policy", "privacy"], ["FAQ & Scope", "faq"], ["Accessibility", "accessibility"], ["DMCA Policy", "dmca"]].map(([label, view]) => (
                <div key={label} onClick={() => navigate(view)} style={{ fontFamily: S.font, fontSize: 13, color: S.mid, padding: "4px 0", cursor: "pointer" }}>{label}</div>
              ))}
            </div>
            {/* Contact */}
            <div>
              <div style={{ fontFamily: S.font, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: S.light, marginBottom: 12 }}>Contact</div>
              <div style={{ fontFamily: S.font, fontSize: 13, color: S.mid, lineHeight: 1.7 }}>
                EstateHat LLC<br />
                421 Fayetteville St, Suite 1100<br />
                Raleigh, NC 27601<br />
                <span style={{ color: S.gold }}>hello@estatehat.com</span><br />
                <span style={{ color: S.gold }}>investors@estatehat.com</span><br />
                (919) 555-0100
              </div>
            </div>
          </div>

          {/* Compliance Badges */}
          <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
            {[
              "🇺🇸 U.S. Verified Users Only",
              "🔒 Encrypted In Transit & At Rest",
              "🛡️ Role-Based Access Controls",
              "⚖️ Policy & Compliance Workflows",
              "🏦 Licensed Escrow Partners",
            ].map((badge) => (
              <span key={badge} style={{ fontFamily: S.font, fontSize: 11, color: S.light, background: "rgba(255,255,255,0.05)", padding: "5px 14px", borderRadius: 20, border: `1px solid ${S.border}` }}>{badge}</span>
            ))}
          </div>

          {/* Disclaimers */}
          <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: 20, fontFamily: S.font, fontSize: 11, color: S.light, lineHeight: 1.8, textAlign: "center" }}>
            <div style={{ marginBottom: 8 }}>
              EstateHat LLC is a technology platform and is not a licensed real estate brokerage, law firm, bank, title company, or insurance provider. EstateHat does not provide legal, financial, tax, or investment advice. All real estate transactions are between independent parties, with workflow checks applied through the platform.
            </div>
            <div style={{ marginBottom: 8 }}>
              1.50% platform fee appears in current platform fee workflows and is buyer-paid by default on top of sale price unless the seller elects to absorb it. Additional escrow, payment rail, and service-provider fees may apply by transaction setup. Savings examples are illustrative and not guaranteed.
            </div>
            <div style={{ color: S.muted }}>
              © 2026 EstateHat LLC. All rights reserved. · NC LLC · EIN: XX-XXXXXXX · 421 Fayetteville Street, Suite 1100, Raleigh, NC 27601
            </div>
          </div>
        </div>
      </footer>

      <EstateHatAssistant
        currentView={view}
        onNavigate={navigate}
        isCompact={isCompact}
        user={currentUser}
        perms={perms}
        savedListingCount={savedListingIds.length}
        featuredPlacementCount={featuredPlacements.length}
      />
      <EstateHatMobileBottomNav
        activeView={view}
        onNavigate={navigate}
        savedCount={savedListingIds.length}
        perms={perms}
        visible={isCompact && !!user}
      />
      <EstateHatCommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        commands={commandEntries}
        onNavigate={navigate}
        isCompact={isCompact}
      />
      <ToastHost toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />
      <ConfirmDialog request={confirmRequest} onCancel={closeConfirm} onConfirm={runConfirm} />
    </div>
  );
}
