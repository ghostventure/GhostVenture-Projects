import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useState } from "react";
import { foxhubExpansionComponents, miniApps } from "./data.js";
import { THEME_OPTIONS, canUseTheme, getContextActions, getAccountEmblem, getThemeToggleLabel, hasFoxHubManagementAccess, getVisibleCount } from "./rules.js";

import { footerBoilerplateGroups } from "./footerBoilerplates.js";

import FoxHeadMark from "./FoxHeadMark.jsx";
import { isWindowsBrowserRuntime, base64UrlToBytes, credentialToServerPayload, runLocalWindowsHelloManagementCheck, getCurrentFirebaseIdToken, buildFilteredState, buildSectionFeedItems, SectionFeed, formatAuditDate, AppFooter } from "./workspaces/shared.jsx";
import { MemberAccountControls } from "./workspaces/MemberAccountControls.jsx";

const HomeWorkspace = lazy(() => import("./workspaces/HomeWorkspace.jsx").then((module) => ({ default: module.HomeWorkspace })));
const ChatWorkspace = lazy(() => import("./workspaces/ChatWorkspace.jsx").then((module) => ({ default: module.ChatWorkspace })));
const NetworkWorkspace = lazy(() => import("./workspaces/NetworkWorkspace.jsx").then((module) => ({ default: module.NetworkWorkspace })));
const MarketWorkspace = lazy(() => import("./workspaces/MarketWorkspace.jsx").then((module) => ({ default: module.MarketWorkspace })));
const PayWorkspace = lazy(() => import("./workspaces/PayWorkspace.jsx").then((module) => ({ default: module.PayWorkspace })));
const ServicesWorkspace = lazy(() => import("./workspaces/ServicesWorkspace.jsx").then((module) => ({ default: module.ServicesWorkspace })));
const GrowthWorkspace = lazy(() => import("./workspaces/GrowthWorkspace.jsx").then((module) => ({ default: module.GrowthWorkspace })));
const ExperienceWorkspace = lazy(() => import("./workspaces/ExperienceWorkspace.jsx").then((module) => ({ default: module.ExperienceWorkspace })));
const BlueprintWorkspace = lazy(() => import("./workspaces/BlueprintWorkspace.jsx").then((module) => ({ default: module.BlueprintWorkspace })));
const ManagementWorkspace = lazy(() => import("./workspaces/ManagementWorkspace.jsx").then((module) => ({ default: module.ManagementWorkspace })));
const ConnectorsWorkspace = lazy(() => import("./workspaces/ConnectorsWorkspace.jsx").then((module) => ({ default: module.ConnectorsWorkspace })));

function FoxHubShell({
  theme,
  toggleTheme,
  setTheme,
  activeTab,
  setActiveTab,
  state,
  currentView,
  selectedThread,
  activeCircle,
  activeMiniApp,
  busy,
  openProfilePanel,
  openPublicProfile,
  runService,
  selectThread,
  handleSendMessage,
  startDirectThread,
  selectCircle,
  handleWalletAction,
  blockUser,
  selectMiniApp,
  submitMoment,
  signOut,
  handleLaunchMiniApp,
  handleSaveCurrentContext,
  runQrFlow,
  toggleOfficialAccountSubscription,
  openOfficialThread,
  openContactThread,
  openSavedItem,
  runUtilityCard,
  openContinuityItem,
  openSearchScope,
  openLiveChannel,
  openCommunityChannel,
  createGroupConversation,
  reactToMoment,
  commentOnMoment,
  respondFriendRequest,
  listings,
  savedSearches,
  listingAlerts,
  listingCategories = [],
  listingTypes = [],
  listingTags = [],
  createListing,
  flagListing,
  saveListingSearch,
  rateContactTrust,
  startShakeMatch,
  logFileTransfer,
  resolveLocalListing,
  updateCreatorOrder,
  logDemandSignal,
  saveConnectorIntent,
  openConnectorSurface,
  connectConnector,
  testConnector,
  disconnectConnector,
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
  registerBrowserNotifications,
  saveRoutePlan,
  addEndorsement,
  addJobPost,
  registerMiniProgramManifest,
  startCallSession,
  reviewMemberApplication,
  addFoxHubStaffMember,
  activateGrowthCategory,
  runGrowthCategory,
  activateAllGrowthCategories,
  activateUxComponent,
  runUxComponent,
  activateProductionComponent,
  runProductionComponent,
  saveWorkflowPreset,
  runWorkflowPreset,
  updateProfile,
  tutorialAssistant
}) {
  const [quickQuery, setQuickQuery] = useState("");
  const [density, setDensity] = useState("easy");
  const [fastNavOpen, setFastNavOpen] = useState(false);
  const [quickNavQuery, setQuickNavQuery] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [showReconnectNotice, setShowReconnectNotice] = useState(false);
  const [chatFilter, setChatFilter] = useState("all");
  const [foxBoardRoom, setFoxBoardRoom] = useState("workflow");
  const [startCity, setStartCity] = useState(state.profile?.city || "");
  const [startModeNotice, setStartModeNotice] = useState("");
  const [managementCredentialPrompt, setManagementCredentialPrompt] = useState(false);
  const [managementCredentialDraft, setManagementCredentialDraft] = useState({ email: "" });
  const [managementCredentialNotice, setManagementCredentialNotice] = useState("");
  const [managementUnlocked, setManagementUnlocked] = useState(false);
  const [workflowNotice, setWorkflowNotice] = useState("");
  const [isWindowsBrowser, setIsWindowsBrowser] = useState(() => isWindowsBrowserRuntime());
  const deferredQuery = useDeferredValue(quickQuery);
  const deferredNavQuery = useDeferredValue(quickNavQuery);
  const unreadCount = state.threads.reduce((sum, thread) => sum + (thread.unreadCount || 0), 0);
  const query = deferredQuery.trim().toLowerCase();
  const accessState = state.profile.accessState || (state.authenticated ? "active" : "pending");
  const accessLabel =
    accessState === "waitlist"
      ? "Waiting"
      : accessState === "priority"
        ? "Priority"
        : state.authenticated
          ? "Active"
          : "Pending";
  const connectionLabel = !isOnline ? "Offline" : state.backendMode === "firebase" ? "Live" : state.backendMode === "locked" ? "Locked" : "Preview";
  const glanceItems = [
    { label: "Social", value: state.threads.length, tone: "warm" },
    { label: "Rapport", value: state.contacts.length, tone: "cool" },
    { label: "Communal", value: state.circles.length, tone: "soft" },
    { label: "Services", value: state.services.length, tone: "cool" }
  ];
  const activeConnectorCount = state.apiConnectors.filter((item) => {
    const status = String(item.status || "").toLowerCase();
    return status.includes("active") || status.includes("live") || status.includes("connected");
  }).length;
  const accountEmblem = getAccountEmblem(state.profile || {});
  const hasManagementConsole = hasFoxHubManagementAccess(state.profile || {});
  const memberNavItems = [
    { id: "hub", label: "Home", glyph: "fox", meta: "rapport loop" },
    { id: "chat", label: "Social", glyph: "S", meta: unreadCount ? `${unreadCount} unread` : `${state.threads.length} threads` },
    { id: "circles", label: "Rapport", glyph: "R", meta: `${state.contacts.length} contacts` },
    { id: "growth", label: "Communal", glyph: "C", meta: `${state.growthCategories?.length || 0} paths` },
    { id: "discover", label: "Services / Merchant", glyph: "M", meta: `${state.miniAppRecents.length} recent` },
    { id: "market", label: "Needs & Offers", glyph: "N", meta: `${state.listings.length} listings` },
    { id: "wallet", label: "Pay", glyph: "$", meta: `${state.walletEvents.length} events` },
    { id: "experience", label: "Preferences & extras", glyph: "U", meta: `${state.uxComponents?.length || 0} perks` },
    { id: "staff", label: "Management", glyph: "M", meta: `${(state.userRecords || []).filter((item) => ["review", "pending"].includes(String(item.stage || item.identityState || "").toLowerCase())).length} reviews` },
    { id: "connectors", label: "Tools", glyph: "T", meta: `${activeConnectorCount} active` },
    { id: "blueprint", label: "Organizer", glyph: "O", meta: `${foxhubExpansionComponents.length} ways` }
  ].filter((item) => {
    if (["staff", "connectors", "blueprint"].includes(item.id)) return hasManagementConsole;
    return true;
  });
  const staffNavItems = [
    { id: "staff", label: "Management", glyph: "M", meta: `${(state.userRecords || []).filter((item) => ["review", "pending"].includes(String(item.stage || item.identityState || "").toLowerCase())).length} reviews` },
    { id: "connectors", label: "Staff Tools", glyph: "T", meta: `${activeConnectorCount} active` },
    { id: "blueprint", label: "Control Library", glyph: "O", meta: `${foxhubExpansionComponents.filter((item) => item.category === "Operator And Admin" || item.category === "Compliance And Safety").length} controls` }
  ];
  const navItems = hasManagementConsole ? staffNavItems : memberNavItems;
  const staffWorkspaceTabIds = new Set(["staff", "connectors", "blueprint"]);
  const managementGateOpen = hasManagementConsole && activeTab === "staff" && managementUnlocked;
  const openWorkspaceTab = (tabId) => {
    if (hasManagementConsole && !staffWorkspaceTabIds.has(tabId)) {
      openWorkspaceTab("staff");
      return;
    }
    if (tabId === "staff" && hasManagementConsole) {
      if (!isWindowsBrowser) {
        setManagementCredentialNotice("Management requires a Windows browser session. Android and iOS browser sessions are blocked.");
        setManagementCredentialPrompt(true);
        return;
      }
      if (!managementUnlocked) {
        setManagementCredentialDraft({ email: state.profile?.email || "" });
        setManagementCredentialNotice("Use Windows Hello or a platform security key to open Management outside the page.");
        setManagementCredentialPrompt(true);
        return;
      }
    }
    setActiveTab(tabId);
  };
  const boilerplateGroups = footerBoilerplateGroups;

  const filtered = useMemo(() => buildFilteredState(state, query), [state, query]);
  const visibleCount = getVisibleCount(activeTab, filtered);
  const contextActions = getContextActions(activeTab);
  const sectionFeedItems = useMemo(
    () => buildSectionFeedItems(activeTab, filtered, currentView),
    [activeTab, filtered, currentView]
  );
  const quickNavCandidates = useMemo(
    () =>
      [...navItems, ...contextActions]
        .filter((item) => item.label.toLowerCase().includes(deferredNavQuery.trim().toLowerCase()))
        .slice(0, 8),
    [navItems, contextActions, deferredNavQuery]
  );
  const starterActions = [
    {
      id: "social",
      label: "Start Social",
      detail: unreadCount ? `${unreadCount} unread` : "Chats, moments, groups, and calls",
      run: () => setActiveTab("chat")
    },
    {
      id: "rapport",
      label: "Build Rapport",
      detail: `${state.contacts.length} contacts and trust signals`,
      run: () => setActiveTab("circles")
    },
    {
      id: "communal",
      label: "Open Communal",
      detail: "Circles, rooms, events, and local growth",
      run: () => setActiveTab("growth")
    },
    {
      id: "service",
      label: "Find Services",
      detail: "Merchants, mini-apps, bookings, and utilities",
      run: () => setActiveTab("discover")
    }
  ];

  const workflowShortcuts = [
    ...(hasManagementConsole
      ? [
          {
            id: "management-dashboard",
            label: "Open Management dashboard",
            detail: "Review applicants, trust queues, staff controls, and complaint-zero work.",
            steps: ["open_management", "review_applications", "run_trust_queue"],
            run: () => openWorkspaceTab("staff")
          }
        ]
      : []),
    {
      id: "daily-loop",
      label: "Run daily member loop",
      detail: "Social, rapport, local needs, then wallet follow-up in order.",
      steps: ["open_social", "check_rapport", "review_local_needs", "open_wallet"],
      run: () => setActiveTab("chat")
    },
    {
      id: "service-flow",
      label: "Find help and pay",
      detail: "Open trusted services, review nearby offers, and keep payment context attached.",
      steps: ["open_services", "review_market", "open_wallet"],
      run: () => setActiveTab("discover")
    },
    {
      id: "support-flow",
      label: "Resolve a problem",
      detail: "Open account controls, disputes, security reports, and support follow-up.",
      steps: ["open_account_controls", "open_disputes", "file_support_signal"],
      run: () => openWorkspaceTab(hasManagementConsole ? "staff" : "hub")
    }
  ];

  function saveAndRunWorkflow(shortcut) {
    const preset = saveWorkflowPreset?.({
      name: shortcut.label,
      steps: shortcut.steps
    });
    if (preset?.id) {
      runWorkflowPreset?.(preset.id);
    } else {
      trackAnalyticsEvent?.({
        name: "workflow_shortcut_run",
        category: "workflow",
        metadata: { shortcutId: shortcut.id, steps: shortcut.steps.length }
      });
    }
    shortcut.run();
    setWorkflowNotice(`${shortcut.label} is queued.`);
  }

  const commandLogEntries = (state.auditEvents || []).slice(0, 4);
  const localCity = (startCity || state.profile?.city || "").trim();
  const localCityKey = localCity.toLowerCase();
  const localListings = localCityKey
    ? state.listings.filter((item) => String(item.city || item.neighborhood || "").toLowerCase().includes(localCityKey))
    : state.listings;
  const localPeople = localCityKey
    ? state.contacts.filter((item) => String(item.city || item.region || "").toLowerCase().includes(localCityKey))
    : state.contacts;
  const startNearMeActions = [
    { id: "social", label: "Talk to my people", detail: "Chats, groups, and moments", run: () => setActiveTab("chat") },
    { id: "rapport", label: "Check trusted people", detail: `${localPeople.length} people nearby`, run: () => setActiveTab("circles") },
    { id: "communal", label: "Enter my community", detail: "Local circles and rooms", run: () => setActiveTab("growth") },
    { id: "services", label: "Find trusted help", detail: "Services and useful tools", run: () => setActiveTab("discover") },
    { id: "market", label: "Post a need or offer", detail: `${localListings.length} local matches`, run: () => setActiveTab("market") },
    { id: "business", label: "Manage merchant tools", detail: "Payments, tools, and local reach", run: () => setActiveTab("connectors") }
  ];
  async function saveStartCity() {
    const nextCity = startCity.trim();
    if (!nextCity) {
      setStartModeNotice("Type your city first.");
      return;
    }
    try {
      if (updateProfile) {
        await updateProfile({ ...state.profile, city: nextCity });
      }
      trackAnalyticsEvent?.({ name: "start_near_me_city_saved", category: "onboarding", metadata: { city: nextCity } });
      setStartModeNotice(`${nextCity} is set. FoxHub will start closer to home.`);
    } catch (error) {
      setStartModeNotice(error instanceof Error ? error.message : "FoxHub could not save that city yet.");
    }
  }
  function useBrowserLocation() {
    if (!navigator.geolocation) {
      setStartModeNotice("This browser does not offer location sharing. Type your city instead.");
      return;
    }
    setStartModeNotice("Checking your location...");
    navigator.geolocation.getCurrentPosition(
      () => {
        trackAnalyticsEvent?.({ name: "start_near_me_location_allowed", category: "onboarding" });
        setStartModeNotice("Location is on. Type your city too, so FoxHub can name the local area.");
      },
      () => setStartModeNotice("Location stayed off. Type your city and FoxHub will still work."),
      { maximumAge: 300000, timeout: 8000 }
    );
  }
  const heroNarratives = [
    `${unreadCount} unread threads ready`,
    `${state.listings.length} marketplace listings live`,
    `${state.walletEvents.length} wallet events tracked`
  ];
  const foxBoardRooms = [
    { id: "pulse", label: "Command pulse", meta: `${glanceItems.length} signals` },
    { id: "actions", label: "Quick actions", meta: `${starterActions.length} actions` },
    { id: "workflow", label: "Workflow queue", meta: `${workflowShortcuts.length} flows` },
    { id: "log", label: "Dispatch log", meta: `${commandLogEntries.length} events` },
    { id: "session", label: "Session", meta: state.authenticated ? "Signed in" : "Guest" }
  ];

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setFastNavOpen(true);
      }
      if (event.key === "Escape") {
        setFastNavOpen(false);
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    setIsWindowsBrowser(isWindowsBrowserRuntime());
  }, []);

  useEffect(() => {
    if (!hasManagementConsole || activeTab !== "staff" || managementUnlocked) return;
    if (!isWindowsBrowser) {
      setManagementCredentialNotice("Management requires a Windows browser session. Android and iOS browser sessions are blocked.");
      setManagementCredentialPrompt(true);
      return;
    }
    setManagementCredentialDraft({ email: state.profile?.email || "" });
    setManagementCredentialNotice("Use Windows Hello or a platform security key to open Management outside the page.");
    setManagementCredentialPrompt(true);
  }, [activeTab, hasManagementConsole, isWindowsBrowser, managementUnlocked, state.profile?.email]);

  async function submitManagementCredentials(event) {
    event.preventDefault();
    if (!isWindowsBrowser) {
      setManagementCredentialNotice("Management requires a Windows browser session. Android and iOS browser sessions are blocked.");
      return;
    }
    const expectedEmail = String(state.profile?.email || "").trim().toLowerCase();
    const enteredEmail = String(managementCredentialDraft.email || "").trim().toLowerCase();
    if (!enteredEmail || enteredEmail !== expectedEmail) {
      setManagementCredentialNotice("Enter the signed-in staff email for this Management session.");
      return;
    }
    if (!window.PublicKeyCredential || !navigator.credentials?.create) {
      setManagementCredentialNotice("This browser does not expose Windows Hello or platform security-key verification.");
      return;
    }
    try {
      setManagementCredentialNotice("Requesting a server challenge for Management.");
      const idToken = await getCurrentFirebaseIdToken();
      if (!idToken) {
        setManagementCredentialNotice("Management backend unavailable; using Windows Hello local gate until Functions deploy is live.");
        await runLocalWindowsHelloManagementCheck({
          expectedEmail,
          displayName: state.profile?.name || state.profile?.displayName || expectedEmail
        });
        setManagementUnlocked(true);
        setManagementCredentialPrompt(false);
        setManagementCredentialNotice("");
        setManagementCredentialDraft({ email: expectedEmail });
        setActiveTab("staff");
        return;
      }
      const platform = navigator.userAgentData?.platform || navigator.platform || "Windows";
      const challengeResponse = await fetch("/api/management/webauthn/challenge", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${idToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: enteredEmail,
          displayName: state.profile?.name || state.profile?.displayName || expectedEmail,
          platform,
          userAgent: navigator.userAgent || "",
          origin: window.location.origin
        })
      });
      const challengePayload = await challengeResponse.json().catch(() => ({}));
      if (!challengeResponse.ok || !challengePayload.ok) {
        const contentType = challengeResponse.headers.get("content-type") || "";
        if (!contentType.includes("application/json") || (!challengePayload.reason && !challengePayload.error)) {
          setManagementCredentialNotice("Management backend unavailable; using Windows Hello local gate until Functions deploy is live.");
          await runLocalWindowsHelloManagementCheck({
            expectedEmail,
            displayName: state.profile?.name || state.profile?.displayName || expectedEmail
          });
          setManagementUnlocked(true);
          setManagementCredentialPrompt(false);
          setManagementCredentialNotice("");
          setManagementCredentialDraft({ email: expectedEmail });
          setActiveTab("staff");
          return;
        }
        setManagementCredentialNotice(challengePayload.reason || challengePayload.error || "Management backend challenge is unavailable.");
        return;
      }
      setManagementCredentialNotice("Opening Windows Hello. Complete the OS prompt to continue.");
      const challenge = base64UrlToBytes(challengePayload.challenge);
      const userId = base64UrlToBytes(challengePayload.user?.id || "");
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: challengePayload.rpName || "FoxHub" },
          user: {
            id: userId,
            name: challengePayload.user?.name || expectedEmail,
            displayName: challengePayload.user?.displayName || state.profile?.name || state.profile?.displayName || expectedEmail
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },
            { type: "public-key", alg: -257 }
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            residentKey: "preferred",
            userVerification: "required"
          },
          timeout: 60000,
          attestation: "none"
        }
      });
      if (!credential?.id) {
        setManagementCredentialNotice("Windows Hello did not return a verified response.");
        return;
      }
      setManagementCredentialNotice("Verifying Windows Hello response with the Management backend.");
      const verifyResponse = await fetch("/api/management/webauthn/verify", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${idToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          challengeId: challengePayload.challengeId,
          credential: credentialToServerPayload(credential)
        })
      });
      const verifyPayload = await verifyResponse.json().catch(() => ({}));
      if (!verifyResponse.ok || !verifyPayload.ok) {
        setManagementCredentialNotice(verifyPayload.reason || verifyPayload.error || "Management backend verification failed.");
        return;
      }
      setManagementUnlocked(true);
      setManagementCredentialPrompt(false);
      setManagementCredentialNotice("");
      setManagementCredentialDraft({ email: expectedEmail });
      setActiveTab("staff");
    } catch (error) {
      setManagementCredentialNotice(error instanceof Error ? error.message : "Windows Hello verification was cancelled or blocked.");
    }
  }

  useEffect(() => {
    setStartCity(state.profile?.city || "");
  }, [state.profile?.city]);

  useEffect(() => {
    let reconnectTimer;
    const updateNetworkStatus = (event) => {
      const online = window.navigator.onLine;
      setIsOnline(online);
      setShowReconnectNotice(online && event?.type === "online");
      window.clearTimeout(reconnectTimer);
      if (online) reconnectTimer = window.setTimeout(() => setShowReconnectNotice(false), 4500);
    };
    updateNetworkStatus();
    window.addEventListener("online", updateNetworkStatus);
    window.addEventListener("offline", updateNetworkStatus);
    return () => {
      window.clearTimeout(reconnectTimer);
      window.removeEventListener("online", updateNetworkStatus);
      window.removeEventListener("offline", updateNetworkStatus);
    };
  }, []);

  return (
    <div className={`app-shell ${density === "compact" ? "compact-ui" : ""}`}>
      <header className="app-header">
        <button
          type="button"
          className="brand-line"
          onClick={() => openWorkspaceTab(hasManagementConsole ? "staff" : "hub")}
          aria-label={hasManagementConsole ? "Go to FoxHub Management" : "Go to FoxHub Home"}
        >
          <div className="brand-mark" aria-hidden="true">
            <FoxHeadMark className="fox-head-icon" />
          </div>
          <div>
            <p className="eyebrow">FoxHub</p>
            <strong className="header-title">{hasManagementConsole ? "Staff controls and review queues" : "Simple tools for everyday tasks"}</strong>
          </div>
        </button>
        <details className="header-actions workspace-controls"><summary>Account & tools</summary><div className="workspace-control-items">
          <span className={`account-emblem ${accountEmblem.type}`} title="Account access emblem">
            <span aria-hidden="true">{accountEmblem.initials}</span>
            <strong>{accountEmblem.label}</strong>
          </span>
          <button type="button" className="search-chip" onClick={() => openWorkspaceTab(hasManagementConsole ? "connectors" : "discover")}>
            {hasManagementConsole ? "Open staff tools and connectors" : "Find people, services, or payments"}
          </button>
          <button type="button" className="accent-button small" onClick={() => (hasManagementConsole ? openWorkspaceTab("staff") : runUxComponent?.("guided-create-button"))}>
            {hasManagementConsole ? "Review" : "Create"}
          </button>
          <button
            type="button"
            className="ghost-button small"
            onClick={() => setFastNavOpen(true)}
            aria-label="Open quick jump"
          >
            Menu (Ctrl+K)
          </button>
          <button type="button" className="ghost-button small theme-toggle" onClick={toggleTheme}>
            {getThemeToggleLabel(theme)}
          </button>
          <label className="theme-select-label">
            <span>Theme</span>
            <select className="theme-select" value={theme} onChange={(event) => setTheme?.(event.target.value)}>
              {THEME_OPTIONS.map((item) => {
                const locked = !canUseTheme(state.profile || {}, item.id);
                return (
                  <option key={item.id} value={item.id} disabled={locked}>
                    {locked ? `${item.label} (Locked)` : item.label}
                  </option>
                );
              })}
            </select>
          </label>
          <button type="button" className="ghost-button small" onClick={openProfilePanel} disabled={!state.authenticated}>
            Profile
          </button>
          {state.authenticated ? (
            <button type="button" className="ghost-button small" onClick={() => void signOut()} disabled={busy}>
              Sign out
            </button>
          ) : null}
        </div></details>
      </header>

      {!isOnline || showReconnectNotice ? (
        <div className={`network-status-notice ${isOnline ? "is-online" : "is-offline"}`} role="status" aria-live="polite">
          {isOnline ? "Connection restored. FoxHub is syncing again." : "You’re offline. FoxHub will reconnect when your connection returns."}
        </div>
      ) : null}

      <div className={activeTab === "hub" ? "operations-layout hub-layout member-home-layout" : "operations-layout focused-layout"}>
        <aside className="desktop-rail command-column" aria-label="Workspace navigation">
          <div className="desktop-summary command-summary">
            <p className="card-label">Workspace</p>
            <span className={`account-emblem compact ${accountEmblem.type}`}>
              <span aria-hidden="true">{accountEmblem.initials}</span>
              <strong>{accountEmblem.label}</strong>
            </span>
            <strong>{state.authenticated ? state.profile.name || state.profile.handle : "Guest mode"}</strong>
            <p className="row-meta-text">
              {state.authenticated
                ? `${state.profile.handle} · ${state.profile.city || "City pending"}`
                : "Previewing the current product shell"}
            </p>
          </div>
          <nav className="desktop-nav">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === activeTab ? "desktop-nav-item active" : "desktop-nav-item"}
                onClick={() => openWorkspaceTab(item.id)}
              >
                <div className="nav-item-head">
                  <span className="nav-glyph" aria-hidden="true">
                    {item.glyph === "fox" ? <FoxHeadMark className="fox-head-icon" /> : item.glyph}
                  </span>
                  <strong>{item.label}</strong>
                </div>
                <span>{item.meta}</span>
              </button>
            ))}
          </nav>
        </aside>

        <section className="tactical-panel">
          <details className="workspace-toolbar" open={activeTab !== "hub"}><summary>Search & view options</summary>
            <div className="toolbar-search-wrap">
              <input
                type="search"
                className="toolbar-search"
                value={quickQuery}
                onChange={(event) => setQuickQuery(event.target.value)}
                placeholder="Search this page"
                aria-label="Search this page"
              />
              {quickQuery ? (
                <button type="button" className="ghost-button small" onClick={() => setQuickQuery("")}>
                  Clear search
                </button>
              ) : null}
              <div className="toolbar-context">
                <span>{currentView.title}</span>
                <strong>{visibleCount} results</strong>
              </div>
            </div>
            <div className="toolbar-actions">
              <button
                type="button"
                className={density === "easy" ? "ghost-button small active-soft" : "ghost-button small"}
                onClick={() => setDensity("easy")}
              >
                Easy View
              </button>
              <button
                type="button"
                className={density === "compact" ? "ghost-button small active-soft" : "ghost-button small"}
                onClick={() => setDensity("compact")}
              >
                Dense View
              </button>
            </div>
          </details>

        {activeTab === "hub" ? (
          <details className="mission-panel member-workflows"><summary>Local activity & workflows</summary>
<div className="fox-room-list">{foxBoardRooms.map(room => <button type="button" key={room.id} className={foxBoardRoom === room.id ? "ghost-button small active-soft" : "ghost-button small"} onClick={() => setFoxBoardRoom(room.id)}>{room.label}</button>)}</div>
            <section className="section-hero">
              <div>
                <p className="eyebrow">FoxHub</p>
                <h1>{currentView.title}</h1>
                <p className="section-copy">{currentView.description}</p>
              </div>
              <div className="hero-status">
                <div className="status-chip">
                  <span>Connection</span>
                  <strong>{connectionLabel}</strong>
                </div>
                <div className="status-chip">
                  <span>Identity</span>
                  <strong>{state.authenticated ? state.profile.handle : "Pending"}</strong>
                </div>
                <div className="status-chip">
                  <span>Access</span>
                  <strong>{state.profile.accessNote || (state.authenticated ? "Active" : "Pending")}</strong>
                </div>
              </div>
            </section>

            <div className="fox-home-board">
              <section className="start-near-me" aria-label="Start near me">
                <div className="start-near-copy">
                  <p className="eyebrow">Start Here</p>
                  <h2>What do you want to do today?</h2>
                  <p>Pick your city, then choose one simple next step. FoxHub will point you to people, services, posts, and tools that make sense nearby.</p>
                </div>
                <div className="start-location-card">
                  <div className="surface-head">
                    <p className="card-label">Where should FoxHub look first?</p>
                    <span className="badge subtle">{localCity || "City needed"}</span>
                  </div>
                  <div className="start-location-row">
                    <input
                      type="text"
                      value={startCity}
                      onChange={(event) => setStartCity(event.target.value)}
                      placeholder="Enter your city"
                      aria-label="Enter your city"
                    />
                    <button type="button" className="accent-button small" onClick={() => void saveStartCity()}>
                      Save city
                    </button>
                    <button type="button" className="ghost-button small" onClick={useBrowserLocation}>
                      Use my location
                    </button>
                  </div>
                  {startModeNotice ? <p className="surface-note">{startModeNotice}</p> : null}
                  <div className="start-local-strip" aria-label="Local preview">
                    <span><strong>{localPeople.length}</strong> people</span>
                    <span><strong>{state.circles.length}</strong> circles</span>
                    <span><strong>{localListings.length}</strong> needs</span>
                    <span><strong>{miniApps.length}</strong> tools</span>
                  </div>
                </div>
                <div className="start-choice-grid">
                  {startNearMeActions.map((action) => (
                    <button key={action.id} type="button" className="start-choice" onClick={action.run}>
                      <strong>{action.label}</strong>
                      <span>{action.detail}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="command-hero" aria-label="Workspace overview">
                <div className="hero-copy">
                  <p className="eyebrow">Today</p>
                  <h2>Start with people, then move through trust.</h2>
                  <p>Social, rapport, communal spaces, and trusted service actions stay in that order so FoxHub feels like a relationship network first.</p>
                  <div className="hero-cta-row">
                    <button type="button" className="accent-button" onClick={() => setActiveTab("chat")}>Open Social</button>
                    <button type="button" className="ghost-button small" onClick={() => setActiveTab("circles")}>Open Rapport</button>
                  </div>
                </div>
                <div className="hero-metrics">
                  {glanceItems.map((item) => (
                    <div key={item.label} className="hero-metric">
                      <span>{item.label}</span>
                      <strong>{String(item.value).padStart(2, "0")}</strong>
                      <p className="hero-metric-note">{item.tone} signal</p>
                    </div>
                  ))}
                  <div className="hero-narratives">
                    {heroNarratives.map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </div>
                </div>
              </section>

              <section className="dashboard-grid fox-board-room-content" aria-label="Home room content">
                {foxBoardRoom === "pulse" ? (
                <article className="surface">
                  <div className="surface-head">
                    <p className="card-label">Command pulse</p>
                    <span className="badge subtle">Realtime</span>
                  </div>
                  <div className="command-status-grid room-grid">
                    {glanceItems.map((item) => (
                      <div key={item.label} className={`glance-card ${item.tone}`}>
                        <span>{item.label}</span>
                        <strong>{String(item.value).padStart(2, "0")}</strong>
                        <span className="row-meta-text">{item.tone} signal</span>
                      </div>
                    ))}
                  </div>
                </article>
                ) : null}

                {foxBoardRoom === "actions" ? (
                <article className="mission-card surface">
                  <div className="surface-head">
                    <p className="card-label">Quick actions</p>
                    <span className="badge subtle">Primary</span>
                  </div>
                  <div className="mission-grid">
                    {starterActions.map((action) => (
                      <div key={action.id} className="mission-row">
                        <strong>{action.label}</strong>
                        <p>{action.detail}</p>
                        <button type="button" className="ghost-button small" onClick={action.run}>Open</button>
                      </div>
                    ))}
                  </div>
                </article>
                ) : null}

                {foxBoardRoom === "workflow" ? (
                <article className="surface workflow-queue-card">
                  <div className="surface-head">
                    <p className="card-label">Workflow queue</p>
                    <span className="badge subtle">{hasManagementConsole ? "Staff-ready" : "Member-ready"}</span>
                  </div>
                  <div className="workflow-shortcut-grid">
                    {workflowShortcuts.map((shortcut) => (
                      <button
                        key={shortcut.id}
                        type="button"
                        className="workflow-shortcut"
                        onClick={() => saveAndRunWorkflow(shortcut)}
                      >
                        <strong>{shortcut.label}</strong>
                        <span>{shortcut.detail}</span>
                        <em>{shortcut.steps.length} steps</em>
                      </button>
                    ))}
                  </div>
                  {workflowNotice ? <p className="surface-note">{workflowNotice}</p> : null}
                </article>
                ) : null}

                {foxBoardRoom === "session" ? (
                <article className="intel-card surface">
                  <div className="surface-head">
                    <p className="card-label">Session</p>
                    <span className="badge subtle">{state.authenticated ? "Signed in" : "Pending"}</span>
                  </div>
                  <div className="desktop-profile-grid room-session-grid">
                    <div>
                      <span>Connection</span>
                      <strong>{connectionLabel}</strong>
                    </div>
                    <div>
                      <span>Access</span>
                      <strong>{state.profile.accessNote || (state.authenticated ? "Active" : "Pending")}</strong>
                    </div>
                    <div>
                      <span>Status</span>
                      <strong>{state.authenticated ? "Signed in" : "Pending"}</strong>
                    </div>
                    <div>
                      <span>City</span>
                      <strong>{state.profile.city || "Pending"}</strong>
                    </div>
                  </div>
                </article>
                ) : null}

                {foxBoardRoom === "log" ? (
                <article className="signal-card surface">
                  <div className="surface-head">
                    <p className="card-label">Dispatch log</p>
                    <span className="badge subtle">{commandLogEntries.length} events</span>
                  </div>
                  <div className="log-stack">
                    {commandLogEntries.length ? (
                      commandLogEntries.map((entry, index) => (
                        <div key={entry.id || entry.action || index} className="log-row">
                          <div>
                            <strong>{entry.action || entry.type || "Operational event"}</strong>
                            <p>{entry.detail || entry.note || entry.meta || entry.channel || "Event recorded"}</p>
                          </div>
                          <span className="row-meta-text">{formatAuditDate(entry.createdAt || entry.at || entry.timestamp)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="surface-note">No recent dispatches.</p>
                    )}
                  </div>
                </article>
                ) : null}
              </section>
            </div>
          </details>
        ) : null}
          <section className="content-stack">
            {activeTab !== "hub" && !["chat", "circles", "growth", "discover"].includes(activeTab) ? (
              <SectionFeed
                activeTab={activeTab}
                currentView={currentView}
                items={sectionFeedItems}
                busy={busy}
                setActiveTab={setActiveTab}
                selectThread={selectThread}
                startDirectThread={startDirectThread}
                openPublicProfile={openPublicProfile}
              />
            ) : null}

            <Suspense fallback={<section className="surface-row" aria-live="polite"><article className="surface"><p className="card-label">Loading workspace</p><p className="surface-note">Preparing this part of FoxHub…</p></article></section>}>
            {activeTab === "hub" ? (
              <>
              {tutorialAssistant}
              <HomeWorkspace
                state={filtered}
                activeMiniApp={activeMiniApp}
                selectedThread={selectedThread}
                runService={runService}
                runQrFlow={runQrFlow}
                setActiveTab={setActiveTab}
                openProfilePanel={openProfilePanel}
                toggleOfficialAccountSubscription={toggleOfficialAccountSubscription}
                openOfficialThread={openOfficialThread}
                openContactThread={openContactThread}
                openPublicProfile={openPublicProfile}
                openSavedItem={openSavedItem}
                handleWalletAction={handleWalletAction}
                reactToMoment={reactToMoment}
                commentOnMoment={commentOnMoment}
                startShakeMatch={startShakeMatch}
                logFileTransfer={logFileTransfer}
                openLiveChannel={openLiveChannel}
                openCommunityChannel={openCommunityChannel}
                resolveLocalListing={resolveLocalListing}
                updateCreatorOrder={updateCreatorOrder}
                logDemandSignal={logDemandSignal}
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
                busy={busy}
                boilerplateGroups={boilerplateGroups}
              />
              <details className="member-disclosure"><summary>Account, notifications & safety</summary>
              <MemberAccountControls
                state={filtered}
                busy={busy}
                openProfilePanel={openProfilePanel}
                setActiveTab={setActiveTab}
                respondFriendRequest={respondFriendRequest}
                markNotificationRead={markNotificationRead}
                revokeDeviceSession={revokeDeviceSession}
                openDisputeCase={openDisputeCase}
                reportTrustSafetyIncident={reportTrustSafetyIncident}
                registerBrowserNotifications={registerBrowserNotifications}
              />
              </details>

              </>
            ) : null}

            {activeTab === "chat" ? (
              <ChatWorkspace
                state={filtered}
                selectedThread={selectedThread}
                chatFilter={chatFilter}
                setChatFilter={setChatFilter}
                busy={busy}
                selectThread={selectThread}
                handleSendMessage={handleSendMessage}
                handleSaveCurrentContext={handleSaveCurrentContext}
                startDirectThread={startDirectThread}
                setActiveTab={setActiveTab}
                handleWalletAction={handleWalletAction}
                blockUser={blockUser}
                startCallSession={startCallSession}
              />
            ) : null}

            {activeTab === "circles" ? (
              <NetworkWorkspace
                state={filtered}
                activeCircle={activeCircle}
                selectCircle={selectCircle}
                submitMoment={submitMoment}
                busy={busy}
                startDirectThread={startDirectThread}
                openPublicProfile={openPublicProfile}
                selectThread={selectThread}
                setActiveTab={setActiveTab}
                toggleOfficialAccountSubscription={toggleOfficialAccountSubscription}
                rateContactTrust={rateContactTrust}
                resolveLocalListing={resolveLocalListing}
                updateCreatorOrder={updateCreatorOrder}
                logDemandSignal={logDemandSignal}
                openCommunityChannel={openCommunityChannel}
                createGroupConversation={createGroupConversation}
                reactToMoment={reactToMoment}
                commentOnMoment={commentOnMoment}
                respondFriendRequest={respondFriendRequest}
                addEndorsement={addEndorsement}
                addJobPost={addJobPost}
                publishMediaClip={publishMediaClip}
                publishStoryBundle={publishStoryBundle}
                moderateRatingRecord={moderateRatingRecord}
              />
            ) : null}

            {activeTab === "market" ? (
              <MarketWorkspace
                state={filtered}
                listings={listings}
                savedSearches={savedSearches}
                listingAlerts={listingAlerts}
                listingCategories={listingCategories}
                listingTypes={listingTypes}
                listingTags={listingTags}
                createListing={createListing}
                flagListing={flagListing}
                saveListingSearch={saveListingSearch}
                startDirectThread={startDirectThread}
                openPublicProfile={openPublicProfile}
                busy={busy}
                placeAuctionBid={placeAuctionBid}
                upsertCart={upsertCart}
                addShopReview={addShopReview}
                moderateRatingRecord={moderateRatingRecord}
              />
            ) : null}

            {activeTab === "wallet" ? (
              <PayWorkspace
                state={filtered}
                busy={busy}
                handleWalletAction={handleWalletAction}
                runQrFlow={runQrFlow}
                runUtilityCard={runUtilityCard}
                selectedThread={selectedThread}
              />
            ) : null}

            {activeTab === "discover" ? (
              <ServicesWorkspace
                state={filtered}
                activeMiniApp={activeMiniApp}
                selectedThread={selectedThread}
                activeCircle={activeCircle}
                busy={busy}
                runService={runService}
                selectMiniApp={selectMiniApp}
                handleLaunchMiniApp={handleLaunchMiniApp}
                runQrFlow={runQrFlow}
                toggleOfficialAccountSubscription={toggleOfficialAccountSubscription}
                openOfficialThread={openOfficialThread}
                openContinuityItem={openContinuityItem}
                openSearchScope={openSearchScope}
                boilerplateGroups={boilerplateGroups}
                saveRoutePlan={saveRoutePlan}
                registerMiniProgramManifest={registerMiniProgramManifest}
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
                registerMiniAppRuntime={registerMiniAppRuntime}
                invokeMiniAppRuntimeEvent={invokeMiniAppRuntimeEvent}
                queueReliableMutation={queueReliableMutation}
                activateProductionComponent={activateProductionComponent}
                runProductionComponent={runProductionComponent}
              />
            ) : null}

            {activeTab === "experience" ? (
              <ExperienceWorkspace
                state={filtered}
                setActiveTab={setActiveTab}
                openProfilePanel={openProfilePanel}
                runUnifiedSearch={runUnifiedSearch}
                runUnifiedAction={runUnifiedAction}
                activateUxComponent={activateUxComponent}
                runUxComponent={runUxComponent}
                registerBrowserNotifications={registerBrowserNotifications}
                selectThread={selectThread}
                handleWalletAction={handleWalletAction}
                openSearchScope={openSearchScope}
                activeMiniApp={activeMiniApp}
                busy={busy}
              />
            ) : null}

            {activeTab === "growth" ? (
              <GrowthWorkspace
                state={filtered}
                busy={busy}
                setActiveTab={setActiveTab}
                activateGrowthCategory={activateGrowthCategory}
                runGrowthCategory={runGrowthCategory}
                activateAllGrowthCategories={activateAllGrowthCategories}
              />
            ) : null}

            {activeTab === "staff" && managementGateOpen ? (
              <ManagementWorkspace
                state={filtered}
                busy={busy}
                setActiveTab={openWorkspaceTab}
                startDirectThread={startDirectThread}
                resolveVerificationCase={resolveVerificationCase}
                resolveLocalListing={resolveLocalListing}
                moderateRatingRecord={moderateRatingRecord}
                reviewMemberApplication={reviewMemberApplication}
                addFoxHubStaffMember={addFoxHubStaffMember}
                runOperatorCopilot={runOperatorCopilot}
                recalculateTrustEngine={recalculateTrustEngine}
                buildNotificationDigest={buildNotificationDigest}
                setNotificationPolicy={setNotificationPolicy}
                runMerchantRiskCheck={runMerchantRiskCheck}
                updateComplianceControl={updateComplianceControl}
                reviewMerchantSettlement={reviewMerchantSettlement}
                reportTrustSafetyIncident={reportTrustSafetyIncident}
                openDisputeCase={openDisputeCase}
                resolveDisputeCase={resolveDisputeCase}
                markNotificationRead={markNotificationRead}
                revokeDeviceSession={revokeDeviceSession}
                evaluateWalletRisk={evaluateWalletRisk}
              />
            ) : null}

            {activeTab === "staff" && hasManagementConsole && !managementGateOpen ? (
              <section className="surface-row">
                <article className="surface management-gate-card">
                  <div className="surface-head">
                    <p className="card-label">Management locked</p>
                    <span className="badge subtle">Windows browser required</span>
                  </div>
                  <p className="surface-note">
                    Management opens only after staff credentials are entered from a Windows browser session. Android and iOS browser sessions are blocked.
                  </p>
                  <div className="inline-actions wrap">
                    <button type="button" className="accent-button" onClick={() => openWorkspaceTab("staff")}>
                      Enter Management credentials
                    </button>
                    <button type="button" className="ghost-button small" onClick={() => openWorkspaceTab("connectors")}>
                      Open Staff Tools
                    </button>
                  </div>
                </article>
              </section>
            ) : null}

            {activeTab === "connectors" ? (
              <ConnectorsWorkspace
                state={filtered}
                saveConnectorIntent={saveConnectorIntent}
                openConnectorSurface={openConnectorSurface}
                connectConnector={connectConnector}
                testConnector={testConnector}
                disconnectConnector={disconnectConnector}
                prepareStripeConnector={prepareStripeConnector}
              />
            ) : null}

            {activeTab === "blueprint" ? (
              <BlueprintWorkspace
                components={foxhubExpansionComponents}
                state={filtered}
                setActiveTab={setActiveTab}
                openProfilePanel={openProfilePanel}
                runUnifiedSearch={runUnifiedSearch}
                recalculateTrustEngine={recalculateTrustEngine}
                rebuildReputationGraph={rebuildReputationGraph}
                runSmartMatchmaking={runSmartMatchmaking}
                runOperatorCopilot={runOperatorCopilot}
                createConversionFunnel={createConversionFunnel}
                registerMiniAppRuntime={registerMiniAppRuntime}
                queueReliableMutation={queueReliableMutation}
                trackAnalyticsEvent={trackAnalyticsEvent}
                setFeatureFlag={setFeatureFlag}
                evaluateWalletRisk={evaluateWalletRisk}
                runMerchantRiskCheck={runMerchantRiskCheck}
                updateComplianceControl={updateComplianceControl}
              />
            ) : null}
            </Suspense>
          </section>
        </section>
      </div>

      <AppFooter boilerplateGroups={boilerplateGroups} />

      {managementCredentialPrompt ? (
        <div className="overlay management-credential-overlay" role="dialog" aria-modal="true" aria-label="Management credentials">
          <form className="profile-modal management-credential-modal" onSubmit={submitManagementCredentials}>
            <div className="panel-head">
              <div>
                <p className="card-label">Management credentials</p>
                <strong>Windows Hello staff check</strong>
              </div>
              <button
                type="button"
                className="ghost-button small"
                onClick={() => {
                  setManagementCredentialPrompt(false);
                  setManagementCredentialDraft((current) => ({ ...current }));
                }}
              >
                Close
              </button>
            </div>
            <p className="surface-note">
              This Management button opens only from a Windows browser and uses an OS-level Windows Hello or platform security-key prompt outside the page. Android and iOS browser sessions stay blocked from the staff dashboard.
            </p>
            {managementCredentialNotice ? <p className={isWindowsBrowser ? "panel-copy" : "error-text"}>{managementCredentialNotice}</p> : null}
            <label>
              Staff email
              <input
                type="email"
                autoComplete="username"
                value={managementCredentialDraft.email}
                onChange={(event) => setManagementCredentialDraft((current) => ({ ...current, email: event.target.value }))}
                placeholder="staff@foxhub.app"
                disabled={!isWindowsBrowser}
              />
            </label>
            <div className="inline-actions wrap">
              <button type="submit" className="accent-button" disabled={!isWindowsBrowser}>
                Verify with Windows Hello
              </button>
              <button
                type="button"
                className="ghost-button small"
                onClick={() => {
                  setManagementCredentialPrompt(false);
                  openWorkspaceTab("connectors");
                }}
              >
                Staff Tools instead
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <nav className="bottom-nav" aria-label="Primary">
        {(hasManagementConsole ? navItems : navItems.filter(item => ["hub", "chat", "circles", "market"].includes(item.id))).map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === activeTab ? "bottom-nav-item active" : "bottom-nav-item"}
            onClick={() => openWorkspaceTab(item.id)}
          >
            <em className="nav-glyph mobile" aria-hidden="true">
              {item.glyph === "fox" ? <FoxHeadMark className="fox-head-icon" /> : item.glyph}
            </em>
            <strong>{item.label}</strong>
            <span>{item.meta}</span>
          </button>
        ))}
        {!hasManagementConsole ? <button type="button" className="bottom-nav-item utility" onClick={() => setFastNavOpen(true)}><strong>More</strong></button> : null}
        {state.authenticated && hasManagementConsole ? (
          <button type="button" className="bottom-nav-item utility" onClick={() => void signOut()} disabled={busy}>
            <strong>Exit</strong>
            <span>Sign out</span>
          </button>
        ) : null}
      </nav>

      {fastNavOpen ? (
        <div className="quick-nav-overlay" role="dialog" aria-modal="true" aria-label="Quick navigation">
          <div className="quick-nav-panel">
            <div className="quick-nav-head">
              <h3>Quick Menu</h3>
              <button type="button" className="ghost-button small" onClick={() => setFastNavOpen(false)}>
                Close
              </button>
            </div>
            <input
              type="search"
              className="quick-nav-search"
              value={quickNavQuery}
              onChange={(event) => setQuickNavQuery(event.target.value)}
              placeholder="Type to find an area"
            />
        <div className="quick-nav-list">
              {(state.uxComponents || []).slice(0, 20).map((component) => (
                <button
                  key={component.key}
                  type="button"
                  className="quick-nav-item"
                  onClick={() => {
                    runUxComponent?.(component.key);
                    setActiveTab("experience");
                    setFastNavOpen(false);
                  }}
                >
                  <strong>{String(component.order).padStart(2, "0")}. {component.name}</strong>
                  <span>{component.surface}</span>
                </button>
              ))}
              {quickNavCandidates.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="quick-nav-item"
                  onClick={() => {
                    openWorkspaceTab(item.id);
                    setFastNavOpen(false);
                  }}
                >
                  <strong>{item.label}</strong>
                  <span>{item.meta}</span>
                </button>
              ))}
              {quickNavCandidates.length === 0 ? <p className="panel-copy">No matches yet.</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default FoxHubShell;
