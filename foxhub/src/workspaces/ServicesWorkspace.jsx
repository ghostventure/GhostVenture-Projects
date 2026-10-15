import { useMemo, useState } from "react";
import { merchantOpsSuite, compliancePrograms, merchantServiceComponents, miniProgramMechanics, trustSafetyIncidents, blueCollarServiceCategories, whiteCollarServiceCategories, blackCollarServiceCategories, yellowCollarServiceCategories, greenCollarServiceCategories, pinkCollarServiceCategories, brownCollarServiceCategories, purpleCollarServiceCategories, weChatParityInstallPacks } from "../data.js";

import { operationalComponentCatalog, operationalComponentDomains, operationalComponentSummary, summarizeOperationalComponents } from "../operationalComponents.js";

import { DiscoveryInfluencePanel, ServiceCategoryPanel, FilteredEmptyState, rankMiniApps } from "./shared.jsx";

export function WeChatParityPanel({ packs, runService }) {
  const featureCount = packs.reduce((sum, pack) => sum + pack.features.length, 0);

  return (
    <article className="surface surface-strong">
      <div className="surface-head">
        <p className="card-label">WeChat gap install</p>
        <span className="badge subtle">{packs.length} packs · {featureCount} items</span>
      </div>
      <div className="surface-note">
        Simple install list for the non-video WeChat gaps. Channels and video are intentionally excluded.
      </div>
      <div className="list-stack">
        {packs.map((pack) => (
          <div key={pack.id} className="list-row">
            <div>
              <div className="thread-topline">
                <strong>{pack.name}</strong>
                <span className="badge subtle">{pack.area}</span>
              </div>
              <p>{pack.summary}</p>
              <div className="tag-row">
                {pack.features.map((feature) => (
                  <span key={feature} className="template-tag">{feature}</span>
                ))}
              </div>
            </div>
            <div className="inline-actions wrap">
              <span className="badge">{pack.status}</span>
              <button type="button" className="ghost-button small" onClick={() => void runService(pack.routeServiceId)}>
                Open
              </button>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

export function ServicesWorkspace({ state, activeMiniApp, selectedThread, activeCircle, busy, runService, selectMiniApp, handleLaunchMiniApp, runQrFlow, toggleOfficialAccountSubscription, openOfficialThread, openContinuityItem, openSearchScope, boilerplateGroups, saveRoutePlan, registerMiniProgramManifest, uploadDocumentEvidence, submitVerificationCase, resolveVerificationCase, updateComplianceControl, reportTrustSafetyIncident, runMerchantRiskCheck, submitMerchantApplication, upsertMerchantInventoryItem, updateMerchantStorefrontSettings, updateMerchantOnboarding, reviewMerchantSettlement, updateMerchantPayoutControl, updateMerchantLocationStatus, openDisputeCase, resolveDisputeCase, markNotificationRead, revokeDeviceSession, registerBrowserNotifications, registerMiniAppRuntime, invokeMiniAppRuntimeEvent, queueReliableMutation, activateProductionComponent, runProductionComponent }) {
  const rankedMiniApps = rankMiniApps(state, selectedThread, activeCircle);
  const recentQrHistory = state.qrHistory.slice(0, 4);
  const recentMiniApps = state.miniAppRecents.slice(0, 4);
  const faqItems = [
    {
      question: "What should a new user do first?",
      answer: "Finish the profile card, start in chats, and then open one service surface. That is the shortest path to understanding how FoxHub works."
    },
    {
      question: "How do invite codes work?",
      answer: "A valid invite code gives immediate access during sign-up. Without one, the account enters the review queue until access opens."
    },
    {
      question: "Where do I manage my account details?",
      answer: "Open Profile from the header. That is where identity details, invite creation, and tutorial status live."
    },
    {
      question: "Is FoxHub mainly for chat or services?",
      answer: "Chat is the primary operating layer. Services, payments, and local discovery are attached to that identity and thread context."
    },
    {
      question: "How does FoxHub handle trust, safety, and compliance?",
      answer: "FoxHub now includes operator controls for sanctions-aware onboarding checks, dispute handling, trust and safety incident reporting, and merchant risk monitoring."
    }
  ];
  const [routeDraft, setRouteDraft] = useState({ name: "", origin: "", destination: "", stops: 0, etaMinutes: 15, mode: "drive" });
  const [manifestDraft, setManifestDraft] = useState({ appId: "", version: "1.0.0", permissions: "identity,wallet,contacts", events: "thread:return", status: "draft" });
  const [verificationDraft, setVerificationDraft] = useState({ targetId: "", targetType: "merchant", label: "", requestedItems: "government id,bank account,tax profile", owner: "Ops" });
  const [documentDraft, setDocumentDraft] = useState({ targetId: "", targetType: "profile", name: "", kind: "verification", mimeType: "application/pdf", status: "stored", source: "manual upload" });
  const [incidentDraft, setIncidentDraft] = useState({ type: "merchant_impersonation_report", severity: "medium", channel: "market", detail: "", owner: "Trust Ops" });
  const [disputeDraft, setDisputeDraft] = useState({ merchantName: "", merchantId: "", amount: "$0.00", reason: "cardholder_dispute", owner: "Payments Ops", detail: "" });
  const [merchantApplicationDraft, setMerchantApplicationDraft] = useState({
    merchantName: state.profile?.name ? `${state.profile.name} Business` : "",
    businessType: "Local services",
    category: "Services",
    city: state.profile?.city || "",
    zipCode: state.profile?.zipCode || state.profile?.postalCode || "",
    website: state.profile?.website || "",
    description: ""
  });
  const [merchantApplicationNotice, setMerchantApplicationNotice] = useState("");
  const merchantAccount = state.profile?.merchantAccount || {};
  const merchantStatus = merchantAccount.status || state.profile?.merchantStatus || "";
  const merchantApproved = ["approved", "active", "verified"].includes(String(merchantStatus).toLowerCase());
  const merchantInventory = merchantAccount.inventory || [
    { id: "starter-item-1", sku: "starter-service", title: "Starter service", price: 75, stock: 10, status: "draft" },
    { id: "starter-item-2", sku: "local-pickup", title: "Local pickup item", price: 25, stock: 24, status: "draft" }
  ];
  const merchantSettings = merchantAccount.settings || {
    storefrontStatus: "draft",
    fulfillmentMode: "local pickup",
    payoutSchedule: "weekly",
    returnsPolicy: "7-day review",
    supportContact: state.profile?.email || ""
  };
  const [inventoryDraft, setInventoryDraft] = useState({ title: "", sku: "", price: 0, stock: 0, status: "active" });
  const [storefrontSettingsDraft, setStorefrontSettingsDraft] = useState(merchantSettings);
  const [serviceTab, setServiceTab] = useState("overview");
  const [serviceCatalogQuery, setServiceCatalogQuery] = useState("");
  const [serviceCatalogType, setServiceCatalogType] = useState("all");
  const [operationalComponentQuery, setOperationalComponentQuery] = useState("");
  const [operationalComponentDomain, setOperationalComponentDomain] = useState("all");
  const [blueCollarCategoryId, setBlueCollarCategoryId] = useState(blueCollarServiceCategories[0]?.id || "");
  const [merchantBlueCollarCategoryId, setMerchantBlueCollarCategoryId] = useState(blueCollarServiceCategories[0]?.id || "");
  const [whiteCollarCategoryId, setWhiteCollarCategoryId] = useState(whiteCollarServiceCategories[0]?.id || "");
  const [merchantWhiteCollarCategoryId, setMerchantWhiteCollarCategoryId] = useState(whiteCollarServiceCategories[0]?.id || "");
  const [blackCollarCategoryId, setBlackCollarCategoryId] = useState(blackCollarServiceCategories[0]?.id || "");
  const [merchantBlackCollarCategoryId, setMerchantBlackCollarCategoryId] = useState(blackCollarServiceCategories[0]?.id || "");
  const [yellowCollarCategoryId, setYellowCollarCategoryId] = useState(yellowCollarServiceCategories[0]?.id || "");
  const [merchantYellowCollarCategoryId, setMerchantYellowCollarCategoryId] = useState(yellowCollarServiceCategories[0]?.id || "");
  const [greenCollarCategoryId, setGreenCollarCategoryId] = useState(greenCollarServiceCategories[0]?.id || "");
  const [merchantGreenCollarCategoryId, setMerchantGreenCollarCategoryId] = useState(greenCollarServiceCategories[0]?.id || "");
  const [pinkCollarCategoryId, setPinkCollarCategoryId] = useState(pinkCollarServiceCategories[0]?.id || "");
  const [merchantPinkCollarCategoryId, setMerchantPinkCollarCategoryId] = useState(pinkCollarServiceCategories[0]?.id || "");
  const [brownCollarCategoryId, setBrownCollarCategoryId] = useState(brownCollarServiceCategories[0]?.id || "");
  const [merchantBrownCollarCategoryId, setMerchantBrownCollarCategoryId] = useState(brownCollarServiceCategories[0]?.id || "");
  const [purpleCollarCategoryId, setPurpleCollarCategoryId] = useState(purpleCollarServiceCategories[0]?.id || "");
  const [merchantPurpleCollarCategoryId, setMerchantPurpleCollarCategoryId] = useState(purpleCollarServiceCategories[0]?.id || "");
  const unreadNotifications = (state.notificationEvents || []).filter((item) => item.status !== "read").slice(0, 4);
  const verificationQueue = (state.verificationCases || []).slice(0, 6);
  const complianceTail = (state.compliancePrograms || []).slice(0, 6);
  const trustIncidentTail = (state.trustSafetyIncidents || []).slice(0, 6);
  const merchantOnboardingTail = (state.merchantOnboardingQueue || []).slice(0, 6);
  const merchantRiskTail = (state.merchantRiskSignals || []).slice(0, 6);
  const disputeTail = (state.disputeCases || []).slice(0, 6);
  const merchantSettlementTail = (state.merchantSettlements || []).slice(0, 6);
  const merchantPayoutControlTail = (state.merchantPayoutControls || []).slice(0, 6);
  const merchantLocationTail = (state.merchantLocations || []).slice(0, 6);
  const liveTerminals = merchantLocationTail.filter((item) => item.status === "live").length;
  const settlementsDue = merchantSettlementTail.filter((item) => item.status === "review" || item.status === "ready").length;
  const payoutRisk = merchantPayoutControlTail.filter((item) => item.state === "hold").length;
  const merchantSummary = merchantOpsSuite?.summary || {};
  const merchantQueueSnapshots = merchantOpsSuite?.queues || [];
  const merchantActionCards = merchantOpsSuite?.actions || [];
  const highlightedQueues = merchantQueueSnapshots.slice(0, 3);
  const complianceHighlights = compliancePrograms.slice(0, 3);
  const merchantTrustIncidents = trustSafetyIncidents
    .filter((incident) => (incident.type || "").includes("merchant") || incident.channel === "market")
    .slice(0, 3);
  const formatIncidentDate = (value) => {
    if (!value) return "Unknown";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? "Unknown"
      : parsed.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  };
  const merchantActionHandlers = {
    "merchant-pay": () => void handleWalletAction("merchant"),
    "merchant-qr": () => void runQrFlow("qr-pay"),
    "merchant-wallet": () => void runService("merchant"),
    "merchant-watch": () => void openOfficialThread("wallet-watch")
  };
  const merchantMetrics = [
    { label: "Locations", value: merchantSummary.locations ?? 0, helper: "total storefronts" },
    { label: "Live terminals", value: merchantSummary.liveTerminals ?? 0, helper: "QR lanes running" },
    { label: "Settlements due", value: merchantSummary.settlementsDue ?? "$0", helper: "awaiting release" },
    { label: "Payout risk", value: merchantSummary.payoutRisk ?? 0, helper: "on hold" }
  ];
  const merchantCoverageGroups = merchantServiceComponents.reduce((groups, component) => {
    const key = component.category || "Operations";
    return {
      ...groups,
      [key]: [...(groups[key] || []), component]
    };
  }, {});
  const miniMechanicGroups = miniProgramMechanics.reduce((groups, mechanic) => {
    const key = mechanic.area || "Runtime";
    return {
      ...groups,
      [key]: [...(groups[key] || []), mechanic]
    };
  }, {});
  const merchantCoverageScore = merchantServiceComponents.length
    ? Math.round((merchantServiceComponents.filter((component) => component.status === "installed").length / merchantServiceComponents.length) * 100)
    : 0;
  const miniCoverageScore = miniProgramMechanics.length
    ? Math.round((miniProgramMechanics.filter((mechanic) => mechanic.status === "installed").length / miniProgramMechanics.length) * 100)
    : 0;
  const serviceCatalog = state.services || [];
  const serviceTypes = useMemo(() => Array.from(new Set(serviceCatalog.map((service) => service.type))).sort(), [serviceCatalog]);
  const catalogQuery = serviceCatalogQuery.trim().toLowerCase();
  const filteredServiceCatalog = useMemo(
    () =>
      serviceCatalog.filter((service) => {
        const typeMatch = serviceCatalogType === "all" || service.type === serviceCatalogType;
        const queryMatch =
          !catalogQuery ||
          [service.name, service.type, service.blurb].some((value) => String(value || "").toLowerCase().includes(catalogQuery));
        return typeMatch && queryMatch;
      }),
    [serviceCatalog, serviceCatalogType, catalogQuery]
  );
  const merchantServiceTypes = new Set(["Business", "Money", "Market", "Food", "Events", "Work", "Mobility", "Community"]);
  const merchantSideServices = serviceCatalog.filter((service) => merchantServiceTypes.has(service.type));
  const auditTail = (state.auditEvents || []).slice(0, 6);
  const deviceTail = (state.deviceSessions || []).slice(0, 6);
  const documentTail = (state.documentVault || []).slice(0, 6);
  const operatorTail = (state.operatorActions || []).slice(0, 6);
  const operatorAccessTail = (state.operatorAccessRecords || []).slice(0, 4);
  const notificationSubscriptionTail = (state.notificationSubscriptions || []).slice(0, 4);
  const readStateTail = (state.threadReadState || []).slice(0, 4);
  const productionComponents = state.productionComponents || [];
  const productionCatalog = useMemo(() => [...productionComponents, ...operationalComponentCatalog], [productionComponents]);
  const operationalSummary = useMemo(() => summarizeOperationalComponents(operationalComponentCatalog), []);
  const operationalQuery = operationalComponentQuery.trim().toLowerCase();
  const activeComponentKeys = useMemo(
    () => new Set([
      ...productionComponents
        .filter((item) => item.status === "active" || item.status === "running")
        .map((item) => item.key),
      ...(state.productionEvents || [])
        .filter((item) => item.action === "activate" || item.action === "run")
        .map((item) => item.componentKey)
    ]),
    [productionComponents, state.productionEvents]
  );
  const filteredProductionCatalog = useMemo(
    () =>
      productionCatalog
        .filter((component) => operationalComponentDomain === "all" || component.domain === operationalComponentDomain || component.surface === operationalComponentDomain)
        .filter((component) => {
          if (!operationalQuery) return true;
          return [component.key, component.name, component.surface, component.domainLabel, component.detail, component.owner, component.capability]
            .some((value) => String(value || "").toLowerCase().includes(operationalQuery));
        })
        .slice(0, 120),
    [productionCatalog, operationalComponentDomain, operationalQuery]
  );
  const activeProductionCount = activeComponentKeys.size;
  const productionEvents = (state.productionEvents || []).slice(0, 6);
  const productionOutputs = [
    ...(state.serverJobs || []),
    ...(state.pushDeliveries || []),
    ...(state.storageObjects || []),
    ...(state.authHardeningChecks || []),
    ...(state.rbacAssignments || []),
    ...(state.paymentWebhookEvents || []),
    ...(state.searchIndexJobs || []),
    ...(state.miniAppSandboxSessions || []),
    ...(state.geoIndexRecords || []),
    ...(state.moderationPipelineCases || []),
    ...(state.analyticsExports || []),
    ...(state.smokeTestRuns || [])
  ]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 8);
  const serviceLibraryTabs = [
    { id: "overview", label: "Overview", meta: `${state.searchScopes.length} ways to search` },
    { id: "catalog", label: "Catalog", meta: `${serviceCatalog.length} services` },
    { id: "parity", label: "Parity", meta: `${weChatParityInstallPacks.length} packs` },
    { id: "mini", label: "Mini Apps", meta: `${miniProgramMechanics.length} helpers` },
    { id: "merchant", label: "Shops", meta: `${merchantServiceComponents.length} tools` },
    { id: "compliance", label: "Safety", meta: `${complianceTail.length} checks` },
    { id: "production", label: "Back Room", meta: `${operationalComponentSummary.total.toLocaleString()} helpers` },
    { id: "routes", label: "Routes", meta: `${state.routePlans?.length || 0} saved` },
    { id: "channels", label: "Channels", meta: `${state.officialAccounts.length} accounts` }
  ];

  async function submitRoutePlan(event) {
    event.preventDefault();
    if (!routeDraft.name.trim()) return;
    await saveRoutePlan(routeDraft);
    setRouteDraft({ name: "", origin: "", destination: "", stops: 0, etaMinutes: 15, mode: "drive" });
  }

  async function submitManifest(event) {
    event.preventDefault();
    if (!manifestDraft.appId.trim()) return;
    await registerMiniProgramManifest({
      ...manifestDraft,
      permissions: manifestDraft.permissions.split(",").map((item) => item.trim()).filter(Boolean),
      events: manifestDraft.events.split(",").map((item) => item.trim()).filter(Boolean)
    });
    setManifestDraft({ appId: "", version: "1.0.0", permissions: "identity,wallet,contacts", events: "thread:return", status: "draft" });
  }

  function submitVerification(event) {
    event.preventDefault();
    if (!verificationDraft.targetId.trim() || !verificationDraft.label.trim()) return;
    submitVerificationCase({
      ...verificationDraft,
      requestedItems: verificationDraft.requestedItems.split(",").map((item) => item.trim()).filter(Boolean),
      status: "review",
      stage: "intake"
    });
    setVerificationDraft({ targetId: "", targetType: "merchant", label: "", requestedItems: "government id,bank account,tax profile", owner: "Ops" });
  }

  async function submitDocument(event) {
    event.preventDefault();
    if (!documentDraft.targetId.trim() || !documentDraft.name.trim()) return;
    await uploadDocumentEvidence(documentDraft);
    setDocumentDraft({ targetId: "", targetType: "profile", name: "", kind: "verification", mimeType: "application/pdf", status: "stored", source: "manual upload" });
  }

  function submitIncident(event) {
    event.preventDefault();
    if (!incidentDraft.detail.trim()) return;
    reportTrustSafetyIncident(incidentDraft);
    setIncidentDraft({ type: "merchant_impersonation_report", severity: "medium", channel: "market", detail: "", owner: "Trust Ops" });
  }

  function submitDispute(event) {
    event.preventDefault();
    if (!disputeDraft.merchantName.trim() || !disputeDraft.reason.trim()) return;
    openDisputeCase(disputeDraft);
    setDisputeDraft({ merchantName: "", merchantId: "", amount: "$0.00", reason: "cardholder_dispute", owner: "Payments Ops", detail: "" });
  }

  function submitMemberMerchantApplication(event) {
    event.preventDefault();
    if (!merchantApplicationDraft.merchantName.trim() || !merchantApplicationDraft.businessType.trim() || !merchantApplicationDraft.zipCode.trim()) return;
    submitMerchantApplication?.(merchantApplicationDraft);
    setMerchantApplicationNotice("Merchant application sent to FoxHub Management.");
    setMerchantApplicationDraft((current) => ({
      ...current,
      merchantName: "",
      description: "",
      website: current.website,
      city: current.city,
      zipCode: current.zipCode
    }));
  }

  function submitInventoryItem(event) {
    event.preventDefault();
    if (!inventoryDraft.title.trim()) return;
    upsertMerchantInventoryItem?.(inventoryDraft);
    setInventoryDraft({ title: "", sku: "", price: 0, stock: 0, status: "active" });
  }

  function submitStorefrontSettings(event) {
    event.preventDefault();
    updateMerchantStorefrontSettings?.(storefrontSettingsDraft);
  }

  return (
    <>
      <section className="service-library-tabs" aria-label="Services library tabs">
        {serviceLibraryTabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={serviceTab === item.id ? "service-library-tab active" : "service-library-tab"}
            onClick={() => {
              setServiceTab(item.id);
              if (item.id === "merchant") selectMiniApp("merchantos");
            }}
          >
            <strong>{item.label}</strong>
            <span>{item.meta}</span>
          </button>
        ))}
      </section>

      <div className={`service-library service-tab-${serviceTab}`}>
      <section className="surface-row service-panel catalog-panel">
        <ServiceCategoryPanel
          title="Blue-collar cats and sub-cats"
          detail="Pick the plain category first, then choose a specific service type. Each category stays tied to quote, scheduling, proof, payment, and trust basics."
          categories={blueCollarServiceCategories}
          activeCategoryId={blueCollarCategoryId}
          setActiveCategoryId={setBlueCollarCategoryId}
          runService={runService}
        />
      </section>

      <section className="surface-row service-panel catalog-panel">
        <ServiceCategoryPanel
          title="White-collar cats and sub-cats"
          detail="Professional services stay just as simple: pick a category, choose the need, then route into documents, quotes, scheduling, and follow-up."
          categories={whiteCollarServiceCategories}
          activeCategoryId={whiteCollarCategoryId}
          setActiveCategoryId={setWhiteCollarCategoryId}
          runService={runService}
        />
      </section>

      <section className="surface-row service-panel catalog-panel">
        <ServiceCategoryPanel
          title="Black-collar cats and sub-cats"
          detail="Heavy, dirty, hazardous, industrial, energy, waste, field, and infrastructure work with safety, proof, dispatch, and service logs kept simple."
          categories={blackCollarServiceCategories}
          activeCategoryId={blackCollarCategoryId}
          setActiveCategoryId={setBlackCollarCategoryId}
          runService={runService}
        />
      </section>

      <section className="surface-row service-panel catalog-panel">
        <ServiceCategoryPanel
          title="Yellow-collar cats and sub-cats"
          detail="Creative, media, design, performance, content, style, and interactive work with briefs, rights, revisions, and delivery kept simple."
          categories={yellowCollarServiceCategories}
          activeCategoryId={yellowCollarCategoryId}
          setActiveCategoryId={setYellowCollarCategoryId}
          runService={runService}
        />
      </section>

      <section className="surface-row service-panel catalog-panel">
        <ServiceCategoryPanel
          title="Green-collar cats and sub-cats"
          detail="Environmental, clean-energy, recycling, conservation, green building, agriculture, and climate-resilience work with audits and proof kept simple."
          categories={greenCollarServiceCategories}
          activeCategoryId={greenCollarCategoryId}
          setActiveCategoryId={setGreenCollarCategoryId}
          runService={runService}
        />
      </section>

      <section className="surface-row service-panel catalog-panel">
        <ServiceCategoryPanel
          title="Pink-collar cats and sub-cats"
          detail="Care, service, teaching, hospitality, retail, admin, wellness, beauty, and household work with schedules, notes, and follow-up kept simple."
          categories={pinkCollarServiceCategories}
          activeCategoryId={pinkCollarCategoryId}
          setActiveCategoryId={setPinkCollarCategoryId}
          runService={runService}
        />
      </section>

      <section className="surface-row service-panel catalog-panel">
        <ServiceCategoryPanel
          title="Brown-collar cats and sub-cats"
          detail="Public works, civic field support, postal, uniformed support, grounds, sanitation, yard, and inspection work with route logs and proof kept simple."
          categories={brownCollarServiceCategories}
          activeCategoryId={brownCollarCategoryId}
          setActiveCategoryId={setBrownCollarCategoryId}
          runService={runService}
        />
      </section>

      <section className="surface-row service-panel catalog-panel">
        <ServiceCategoryPanel
          title="Purple-collar cats and sub-cats"
          detail="Hybrid technical work that blends hands-on operations with IT, automation, smart building, data, AV, logistics, and security support."
          categories={purpleCollarServiceCategories}
          activeCategoryId={purpleCollarCategoryId}
          setActiveCategoryId={setPurpleCollarCategoryId}
          runService={runService}
        />
      </section>

      <section className="surface-row service-panel catalog-panel">
        <article className="surface surface-strong">
          <div className="surface-head">
            <p className="card-label">Service catalog</p>
            <span className="badge subtle">{filteredServiceCatalog.length}/{serviceCatalog.length} services</span>
          </div>
          <div className="surface-note">
            Search every useful FoxHub service from one place. The same catalog is also available from the merchant side for business-facing work.
          </div>
          <div className="toolbar-row">
            <input
              type="search"
              className="toolbar-search"
              placeholder="Search services, payments, events, support..."
              value={serviceCatalogQuery}
              onChange={(event) => setServiceCatalogQuery(event.target.value)}
            />
            <select value={serviceCatalogType} onChange={(event) => setServiceCatalogType(event.target.value)}>
              <option value="all">All categories</option>
              {serviceTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div className="service-grid catalog-service-grid">
            {filteredServiceCatalog.map((service) => (
              <button key={service.id} type="button" className="service-card" onClick={() => void runService(service.id)}>
                <p>{service.type}</p>
                <strong>{service.name}</strong>
                <span>{service.blurb}</span>
              </button>
            ))}
          </div>
          {!filteredServiceCatalog.length ? <p className="panel-copy">No services match that search.</p> : null}
        </article>
      </section>

      <section className="surface-row service-panel parity-panel">
        <WeChatParityPanel packs={weChatParityInstallPacks} runService={runService} />
      </section>

      <section className="surface-row two-up service-panel production-panel">
        <article className="surface surface-strong">
          <div className="surface-head">
            <p className="card-label">Back Room</p>
            <span className="badge subtle">{activeProductionCount}/{productionComponents.length} active</span>
          </div>
          <div className="surface-note">
            These helpers keep FoxHub safer, smoother, and easier to support as more people use it.
          </div>
          <div className="glance-strip compact">
            <div className="glance-card warm">
              <span>Helpers</span>
              <strong>{operationalComponentSummary.total.toLocaleString()}</strong>
            </div>
            <div className="glance-card cool">
              <span>Domains</span>
              <strong>{operationalComponentSummary.domains}</strong>
            </div>
            <div className="glance-card soft">
              <span>Active</span>
              <strong>{activeProductionCount}</strong>
            </div>
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Recent back-room activity</p>
            <span className="badge subtle">{productionOutputs.length} updates</span>
          </div>
          <div className="list-stack">
            {productionOutputs.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.componentName || item.componentKey}</strong>
                  <p>{item.detail || item.status}</p>
                </div>
                <span className="badge subtle">{item.owner || item.status}</span>
              </div>
            ))}
            {!productionOutputs.length ? <p className="panel-copy">Try a helper to create the first update.</p> : null}
          </div>
        </article>
      </section>

      <section className="surface-row service-panel production-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Turn on and try</p>
            <span className="badge subtle">{operationalComponentSummary.total.toLocaleString()} installed</span>
          </div>
          <div className="surface-note">
            Search across 4,000 operational and functional helpers. The page renders a focused slice while the full catalog stays available for activation and run events.
          </div>
          <div className="glance-strip compact">
            <div className="glance-card warm">
              <span>Ready</span>
              <strong>{operationalSummary.byStatus.ready || 0}</strong>
            </div>
            <div className="glance-card cool">
              <span>Staged</span>
              <strong>{operationalSummary.byStatus.staged || 0}</strong>
            </div>
            <div className="glance-card soft">
              <span>Catalog slice</span>
              <strong>{filteredProductionCatalog.length}</strong>
            </div>
          </div>
          <div className="toolbar-row">
            <input
              type="search"
              className="toolbar-search"
              placeholder="Search 4,000 ops components, domains, surfaces..."
              value={operationalComponentQuery}
              onChange={(event) => setOperationalComponentQuery(event.target.value)}
            />
            <select value={operationalComponentDomain} onChange={(event) => setOperationalComponentDomain(event.target.value)}>
              <option value="all">All domains</option>
              {operationalComponentDomains.map((domain) => (
                <option key={domain.key} value={domain.key}>{domain.label}</option>
              ))}
            </select>
          </div>
          <div className="blueprint-list">
            {filteredProductionCatalog.map((component) => {
              const isActive = activeComponentKeys.has(component.key) || component.status === "active" || component.status === "running";
              return (
              <div key={component.key} className="blueprint-component-row">
                <span className="blueprint-order">{component.surface}</span>
                <div>
                  <strong>{component.name}</strong>
                  <p>{component.detail}</p>
                </div>
                <div className="blueprint-actions">
                  <span className={isActive ? "badge" : "badge subtle"}>
                    {isActive ? "active" : component.status}
                  </span>
                  <button type="button" className="ghost-button small" onClick={() => activateProductionComponent?.(component.key)} disabled={busy}>
                    Activate
                  </button>
                  <button type="button" className="ghost-button small" onClick={() => runProductionComponent?.(component.key)} disabled={busy}>
                    Run
                  </button>
                </div>
              </div>
            );})}
          </div>
        </article>
      </section>

      <section className="surface-row two-up service-panel production-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Back-room activity</p>
            <span className="badge subtle">{productionEvents.length} recent</span>
          </div>
          <div className="list-stack">
            {productionEvents.map((event) => (
              <div key={event.id} className="list-row">
                <div>
                  <strong>{event.action}</strong>
                  <p>{event.detail}</p>
                </div>
                <span className="badge subtle">{event.componentKey}</span>
              </div>
            ))}
            {!productionEvents.length ? <p className="panel-copy">No back-room actions have run yet.</p> : null}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Phone alerts</p>
            <span className="badge">Installed</span>
          </div>
          <div className="list-stack">
            <div className="list-row">
              <div>
                <strong>@capacitor/push-notifications</strong>
                <p>Phone alerts are ready for the iPhone and Android versions.</p>
              </div>
              <span className="badge subtle">Capacitor</span>
            </div>
            <div className="list-row">
              <div>
                <strong>Support tools are ready</strong>
                <p>The payment, message, email, and document helpers are waiting in the back room.</p>
              </div>
              <span className="badge subtle">Back room</span>
            </div>
          </div>
        </article>
      </section>

      <section className="surface-row service-panel overview-panel">
        <DiscoveryInfluencePanel openSearchScope={openSearchScope} />
      </section>

      <section className="surface-row service-panel overview-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">FAQ page</p>
            <span className="badge subtle">{faqItems.length} answers</span>
          </div>
          <div className="surface-note">
            Fast answers for new people, invites, profiles, and how to get around FoxHub.
          </div>
          <div className="list-stack">
            {faqItems.map((item) => (
              <div key={item.question} className="list-row">
                <div>
                  <strong>{item.question}</strong>
                  <p>{item.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row three-up service-panel overview-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Compliance controls</p>
            <span className="badge subtle">{complianceTail.length} tracked</span>
          </div>
          <div className="surface-note">
            Core controls tied to sanctions screening, customer due diligence, payment-data security, and information-security safeguards.
          </div>
          <div className="list-stack">
            {complianceTail.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.framework}</strong>
                  <p>{item.control}</p>
                </div>
                <div className="inline-actions wrap">
                  <span className="row-meta-text">{item.status} · {item.cadence}</span>
                  <button type="button" className="ghost-button small" onClick={() => updateComplianceControl(item.id, "in_review")}>In review</button>
                  <button type="button" className="ghost-button small" onClick={() => updateComplianceControl(item.id, "active")}>Active</button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Trust and safety</p>
            <span className="badge subtle">{trustIncidentTail.length} incidents</span>
          </div>
          <form className="market-form" onSubmit={submitIncident}>
            <label>
              Incident type
              <select value={incidentDraft.type} onChange={(event) => setIncidentDraft((current) => ({ ...current, type: event.target.value }))}>
                <option value="account_takeover_attempt">Account takeover attempt</option>
                <option value="merchant_impersonation_report">Merchant impersonation</option>
                <option value="payment_fraud_signal">Payment fraud signal</option>
                <option value="harassment_report">Harassment report</option>
              </select>
            </label>
            <label>
              Severity
              <select value={incidentDraft.severity} onChange={(event) => setIncidentDraft((current) => ({ ...current, severity: event.target.value }))}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <label>
              Detail
              <input value={incidentDraft.detail} onChange={(event) => setIncidentDraft((current) => ({ ...current, detail: event.target.value }))} />
            </label>
            <button type="submit" className="ghost-button" disabled={busy}>File incident</button>
          </form>
          <div className="list-stack">
            {trustIncidentTail.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.type}</strong>
                  <p>{item.detail}</p>
                </div>
                <div className="row-meta-text">{item.severity} · {item.status}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Access and alerts</p>
            <span className="badge subtle">{notificationSubscriptionTail.length} subscriptions</span>
          </div>
          <div className="surface-note">
            Notification subscriptions and alert readiness live here with the rest of the operator and service control layer.
          </div>
          <div className="list-stack">
            {notificationSubscriptionTail.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.channel}</strong>
                  <p>{item.endpoint}</p>
                </div>
                <div className="row-meta-text">{item.permission} · {item.status}</div>
              </div>
            ))}
            {!notificationSubscriptionTail.length ? <p className="panel-copy">No notification subscriptions are registered yet.</p> : null}
          </div>
          <button type="button" className="ghost-button small wide" onClick={() => void registerBrowserNotifications?.()} disabled={busy}>
            Enable browser alerts
          </button>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Operator access</p>
            <span className="badge subtle">{operatorAccessTail.length} records</span>
          </div>
          <div className="list-stack">
            {operatorAccessTail.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.email || item.userId}</strong>
                  <p>{item.role} · {Array.isArray(item.scopes) ? item.scopes.join(", ") : "no scopes"}</p>
                </div>
                <div className="row-meta-text">{item.state || "active"}</div>
              </div>
            ))}
            {!operatorAccessTail.length ? <p className="panel-copy">No operator-access records are visible for this account.</p> : null}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Conversation continuity</p>
            <span className="badge subtle">{readStateTail.length} read markers</span>
          </div>
          <div className="list-stack">
            {readStateTail.map((item) => (
              <div key={item.threadId} className="list-row">
                <div>
                  <strong>{state.threads.find((thread) => thread.id === item.threadId)?.name || item.threadId}</strong>
                  <p>{item.lastReadAt ? new Date(item.lastReadAt).toLocaleString() : "No read timestamp"}</p>
                </div>
                <div className="row-meta-text">{item.unreadCount || 0} unread</div>
              </div>
            ))}
            {!readStateTail.length ? <p className="panel-copy">No read-state continuity markers yet.</p> : null}
          </div>
        </article>
      </section>

      <section className="surface-row two-up service-panel merchant-panel">
        <ServiceCategoryPanel
          title="Merchant cats and sub-cats"
          detail="Use the same blue-collar directory from the business side for lead intake, quotes, proof, scheduling, payout, and service follow-up."
          categories={blueCollarServiceCategories}
          mode="merchant"
          activeCategoryId={merchantBlueCollarCategoryId}
          setActiveCategoryId={setMerchantBlueCollarCategoryId}
          runService={runService}
        />
      </section>

      <section className="surface-row two-up service-panel merchant-panel">
        <ServiceCategoryPanel
          title="Merchant white-collar cats"
          detail="Professional help for business admin, finance, compliance, marketing, creative work, tech, sales, hiring, real estate, and training."
          categories={whiteCollarServiceCategories}
          mode="merchant"
          activeCategoryId={merchantWhiteCollarCategoryId}
          setActiveCategoryId={setMerchantWhiteCollarCategoryId}
          runService={runService}
        />
      </section>

      <section className="surface-row two-up service-panel merchant-panel">
        <ServiceCategoryPanel
          title="Merchant black-collar cats"
          detail="Industrial and field-service work for merchants, operators, facilities, yards, fleets, energy sites, and infrastructure teams."
          categories={blackCollarServiceCategories}
          mode="merchant"
          activeCategoryId={merchantBlackCollarCategoryId}
          setActiveCategoryId={setMerchantBlackCollarCategoryId}
          runService={runService}
        />
      </section>

      <section className="surface-row two-up service-panel merchant-panel">
        <ServiceCategoryPanel
          title="Merchant yellow-collar cats"
          detail="Creative and media services for merchants, creators, events, campaigns, content, storefronts, and brand work."
          categories={yellowCollarServiceCategories}
          mode="merchant"
          activeCategoryId={merchantYellowCollarCategoryId}
          setActiveCategoryId={setMerchantYellowCollarCategoryId}
          runService={runService}
        />
      </section>

      <section className="surface-row two-up service-panel merchant-panel">
        <ServiceCategoryPanel
          title="Merchant green-collar cats"
          detail="Environmental and sustainability services for energy, waste, water, buildings, fleets, food systems, and resilience work."
          categories={greenCollarServiceCategories}
          mode="merchant"
          activeCategoryId={merchantGreenCollarCategoryId}
          setActiveCategoryId={setMerchantGreenCollarCategoryId}
          runService={runService}
        />
      </section>

      <section className="surface-row two-up service-panel merchant-panel">
        <ServiceCategoryPanel
          title="Merchant pink-collar cats"
          detail="Care, service, guest, admin, retail, education, wellness, beauty, and household support for customer-facing operators."
          categories={pinkCollarServiceCategories}
          mode="merchant"
          activeCategoryId={merchantPinkCollarCategoryId}
          setActiveCategoryId={setMerchantPinkCollarCategoryId}
          runService={runService}
        />
      </section>

      <section className="surface-row two-up service-panel merchant-panel">
        <ServiceCategoryPanel
          title="Merchant brown-collar cats"
          detail="Civic, field, route, grounds, sanitation, yard, institutional, inspection, and seasonal operations for public-facing work."
          categories={brownCollarServiceCategories}
          mode="merchant"
          activeCategoryId={merchantBrownCollarCategoryId}
          setActiveCategoryId={setMerchantBrownCollarCategoryId}
          runService={runService}
        />
      </section>

      <section className="surface-row two-up service-panel merchant-panel">
        <ServiceCategoryPanel
          title="Merchant purple-collar cats"
          detail="Hands-on technical services for devices, smart buildings, automation, AV, logistics systems, data operations, and cyber-physical support."
          categories={purpleCollarServiceCategories}
          mode="merchant"
          activeCategoryId={merchantPurpleCollarCategoryId}
          setActiveCategoryId={setMerchantPurpleCollarCategoryId}
          runService={runService}
        />
      </section>

      <section className="surface-row two-up service-panel merchant-panel">
        <article className="surface surface-strong">
          <div className="surface-head">
            <p className="card-label">Merchant service catalog</p>
            <span className="badge subtle">{merchantSideServices.length} business-ready</span>
          </div>
          <div className="surface-note">
            The merchant side gets quick access to payments, food and deals, events, local market, work requests, delivery, support, and business operations.
          </div>
          <div className="service-grid catalog-service-grid">
            {merchantSideServices.map((service) => (
              <button key={`merchant-${service.id}`} type="button" className="service-card" onClick={() => void runService(service.id)}>
                <p>{service.type}</p>
                <strong>{service.name}</strong>
                <span>{service.blurb}</span>
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row two-up service-panel merchant-panel">
        {merchantApproved ? (
        <article className="surface surface-strong merchant-dashboard-card">
          <div className="surface-head">
            <p className="card-label">Merchant dashboard</p>
            <span className="badge">Approved seller tools</span>
          </div>
          <div className="surface-note">
            Approved merchants can manage storefront status, inventory, orders, payout settings, and seller operations from this dashboard.
          </div>
          <div className="starter-grid">
            <div className="starter-card">
              <strong>{merchantAccount.merchantName || state.profile?.name || "Merchant"}</strong>
              <span>{merchantStatus || "active"} · {merchantSettings.storefrontStatus || "draft"} storefront</span>
            </div>
            <div className="starter-card">
              <strong>{merchantInventory.length} items</strong>
              <span>{merchantInventory.filter((item) => Number(item.stock || 0) <= 3).length} low-stock alerts</span>
            </div>
            <div className="starter-card">
              <strong>{(state.fulfillmentOrders || []).length} orders</strong>
              <span>packing, pickup, tracking, and delivery controls</span>
            </div>
            <div className="starter-card">
              <strong>{merchantSettings.payoutSchedule || "weekly"} payouts</strong>
              <span>{merchantSettings.fulfillmentMode || "local pickup"} fulfillment</span>
            </div>
          </div>

          <div className="surface-row two-up merchant-controls-grid">
            <article className="surface">
              <div className="surface-head">
                <p className="card-label">Inventory</p>
                <span className="badge subtle">{merchantInventory.length} SKUs</span>
              </div>
              <form className="market-form" onSubmit={submitInventoryItem}>
                <label>
                  Item title
                  <input value={inventoryDraft.title} onChange={(event) => setInventoryDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Product or service" />
                </label>
                <label>
                  SKU
                  <input value={inventoryDraft.sku} onChange={(event) => setInventoryDraft((current) => ({ ...current, sku: event.target.value }))} placeholder="sku-name" />
                </label>
                <label>
                  Price
                  <input type="number" min="0" step="0.01" value={inventoryDraft.price} onChange={(event) => setInventoryDraft((current) => ({ ...current, price: event.target.value }))} />
                </label>
                <label>
                  Stock
                  <input type="number" min="0" value={inventoryDraft.stock} onChange={(event) => setInventoryDraft((current) => ({ ...current, stock: event.target.value }))} />
                </label>
                <button type="submit" className="ghost-button" disabled={busy || !inventoryDraft.title.trim()}>Save inventory item</button>
              </form>
              <div className="list-stack">
                {merchantInventory.slice(0, 6).map((item) => (
                  <div key={item.id} className="list-row">
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.sku} · ${Number(item.price || 0).toFixed(2)} · {Number(item.stock || 0)} in stock</p>
                    </div>
                    <span className={Number(item.stock || 0) <= 3 ? "badge" : "badge subtle"}>{item.status || "active"}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="surface">
              <div className="surface-head">
                <p className="card-label">Storefront settings</p>
                <span className="badge subtle">Seller setup</span>
              </div>
              <form className="market-form" onSubmit={submitStorefrontSettings}>
                <label>
                  Storefront status
                  <select value={storefrontSettingsDraft.storefrontStatus || "draft"} onChange={(event) => setStorefrontSettingsDraft((current) => ({ ...current, storefrontStatus: event.target.value }))}>
                    <option value="draft">Draft</option>
                    <option value="open">Open</option>
                    <option value="paused">Paused</option>
                  </select>
                </label>
                <label>
                  Fulfillment mode
                  <select value={storefrontSettingsDraft.fulfillmentMode || "local pickup"} onChange={(event) => setStorefrontSettingsDraft((current) => ({ ...current, fulfillmentMode: event.target.value }))}>
                    <option value="local pickup">Local pickup</option>
                    <option value="delivery">Delivery</option>
                    <option value="shipping">Shipping</option>
                    <option value="appointment">Appointment</option>
                  </select>
                </label>
                <label>
                  Payout schedule
                  <select value={storefrontSettingsDraft.payoutSchedule || "weekly"} onChange={(event) => setStorefrontSettingsDraft((current) => ({ ...current, payoutSchedule: event.target.value }))}>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Biweekly</option>
                    <option value="manual review">Manual review</option>
                  </select>
                </label>
                <label>
                  Returns policy
                  <input value={storefrontSettingsDraft.returnsPolicy || ""} onChange={(event) => setStorefrontSettingsDraft((current) => ({ ...current, returnsPolicy: event.target.value }))} />
                </label>
                <button type="submit" className="ghost-button" disabled={busy}>Save storefront settings</button>
              </form>
              <div className="list-stack">
                {(state.fulfillmentOrders || []).slice(0, 4).map((order) => (
                  <div key={order.id} className="list-row">
                    <div>
                      <strong>{order.trackingLabel || order.id}</strong>
                      <p>{order.carrier || "Local fulfillment"} · {order.eta || "ETA pending"}</p>
                    </div>
                    <span className="badge subtle">{order.status || "open"}</span>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </article>
        ) : (
        <article className="surface surface-strong merchant-application-form">
          <div className="surface-head">
            <p className="card-label">Apply to become a merchant</p>
            <span className="badge subtle">{state.profile?.merchantStatus === "review" ? "In review" : "Member application"}</span>
          </div>
          <div className="surface-note">
            Submit a simple in-app application. FoxHub Management reviews business identity, tax profile, bank account confirmation, account age, and risk signals before approval.
          </div>
          {state.profile?.merchantAccount?.merchantName ? (
            <div className="entry-lock-note">
              <strong>{state.profile.merchantAccount.merchantName}</strong>
              <span>Status: {state.profile.merchantAccount.status || state.profile.merchantStatus || "review"}</span>
            </div>
          ) : null}
          <form className="market-form" onSubmit={submitMemberMerchantApplication}>
            <label>
              Business name
              <input
                value={merchantApplicationDraft.merchantName}
                onChange={(event) => setMerchantApplicationDraft((current) => ({ ...current, merchantName: event.target.value }))}
                placeholder="Business or storefront name"
              />
            </label>
            <label>
              Business type
              <select
                value={merchantApplicationDraft.businessType}
                onChange={(event) => setMerchantApplicationDraft((current) => ({ ...current, businessType: event.target.value }))}
              >
                <option value="Local services">Local services</option>
                <option value="Creator goods">Creator goods</option>
                <option value="Food and beverage">Food and beverage</option>
                <option value="Events and venues">Events and venues</option>
                <option value="Professional services">Professional services</option>
              </select>
            </label>
            <label>
              Category
              <input
                value={merchantApplicationDraft.category}
                onChange={(event) => setMerchantApplicationDraft((current) => ({ ...current, category: event.target.value }))}
                placeholder="Services, food, events..."
              />
            </label>
            <label>
              ZIP code
              <input
                type="text"
                inputMode="numeric"
                autoComplete="postal-code"
                value={merchantApplicationDraft.zipCode}
                onChange={(event) => setMerchantApplicationDraft((current) => ({ ...current, zipCode: event.target.value }))}
                placeholder="30303"
              />
            </label>
            <label>
              City
              <input
                value={merchantApplicationDraft.city}
                onChange={(event) => setMerchantApplicationDraft((current) => ({ ...current, city: event.target.value }))}
                placeholder="City"
              />
            </label>
            <label>
              Website or link
              <input
                value={merchantApplicationDraft.website}
                onChange={(event) => setMerchantApplicationDraft((current) => ({ ...current, website: event.target.value }))}
                placeholder="https://example.com"
              />
            </label>
            <label>
              What will you sell or provide?
              <textarea
                rows={3}
                value={merchantApplicationDraft.description}
                onChange={(event) => setMerchantApplicationDraft((current) => ({ ...current, description: event.target.value }))}
                placeholder="Briefly describe the business."
              />
            </label>
            {merchantApplicationNotice ? <p className="success-text">{merchantApplicationNotice}</p> : null}
            <button
              type="submit"
              className="accent-button wide"
              disabled={busy || !merchantApplicationDraft.merchantName.trim() || !merchantApplicationDraft.businessType.trim() || !merchantApplicationDraft.zipCode.trim()}
            >
              Submit merchant application
            </button>
          </form>
        </article>
        )}

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Merchant onboarding depth</p>
            <span className="badge subtle">{merchantOnboardingTail.length} merchants</span>
          </div>
          <div className="entry-lock-note">
            <strong>Single sign-on merchant rule</strong>
            <span>Merchants must use the signed-in FoxHub account, wait at least 90 days from user signup before approval, keep one merchant account, and attach any extra storefronts under that account.</span>
          </div>
          {state.commercePolicy?.commerceBlocked ? (
            <div className="entry-lock-note">
              <strong>Commerce penalty active</strong>
              <span>{state.commercePolicy.reason}</span>
            </div>
          ) : null}
          <div className="list-stack">
            {merchantOnboardingTail.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.merchantName}</strong>
                  <p>{item.stage} · {Array.isArray(item.requiredItems) ? item.requiredItems.join(", ") : "No checklist"}</p>
                  <p className="row-meta-text">
                    {item.merchantAccountId || `merchant-account-${item.merchantId}`} · {Array.isArray(item.storefronts) ? item.storefronts.length : 0} storefronts · {Number(item.accountAgeDays || 0)} / {item.minimumAccountAgeDays || 90} days
                  </p>
                </div>
                <div className="inline-actions wrap">
                  <span className="row-meta-text">{item.riskTier} risk · {item.status}</span>
                  <button type="button" className="ghost-button small" onClick={() => updateMerchantOnboarding(item.merchantId, "advance")}>Advance</button>
                  <button type="button" className="ghost-button small" onClick={() => updateMerchantOnboarding(item.merchantId, "hold")}>Hold</button>
                  <button type="button" className="ghost-button small" onClick={() => runMerchantRiskCheck(item.merchantId, "manual review")}>Risk check</button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Dispute management</p>
            <span className="badge subtle">{disputeTail.length} cases</span>
          </div>
          <form className="market-form" onSubmit={submitDispute}>
            <label>
              Merchant
              <input value={disputeDraft.merchantName} onChange={(event) => setDisputeDraft((current) => ({ ...current, merchantName: event.target.value }))} />
            </label>
            <label>
              Amount
              <input value={disputeDraft.amount} onChange={(event) => setDisputeDraft((current) => ({ ...current, amount: event.target.value }))} />
            </label>
            <label>
              Reason
              <input value={disputeDraft.reason} onChange={(event) => setDisputeDraft((current) => ({ ...current, reason: event.target.value }))} />
            </label>
            <button type="submit" className="ghost-button" disabled={busy}>Open dispute</button>
          </form>
          <div className="list-stack">
            {disputeTail.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.merchantName}</strong>
                  <p>{item.reason} · {item.amount}</p>
                </div>
                <div className="inline-actions wrap">
                  <span className="row-meta-text">{item.status}</span>
                  {item.status !== "resolved" ? (
                    <button type="button" className="ghost-button small" onClick={() => resolveDisputeCase(item.id, "resolved")}>
                      Resolve
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row two-up service-panel merchant-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Merchant risk signals</p>
            <span className="badge subtle">{merchantRiskTail.length} signals</span>
          </div>
          <div className="list-stack">
            {merchantRiskTail.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.merchantName}</strong>
                  <p>{item.signal} · {item.detail}</p>
                </div>
                <div className="row-meta-text">score {item.score} · {item.status}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Operator queue</p>
            <span className="badge subtle">{verificationQueue.length} verification cases</span>
          </div>
          <form className="market-form" onSubmit={submitVerification}>
            <label>
              Target id
              <input value={verificationDraft.targetId} onChange={(event) => setVerificationDraft((current) => ({ ...current, targetId: event.target.value }))} />
            </label>
            <label>
              Type
              <select value={verificationDraft.targetType} onChange={(event) => setVerificationDraft((current) => ({ ...current, targetType: event.target.value }))}>
                <option value="merchant">Merchant</option>
                <option value="profile">Profile</option>
                <option value="payout">Payout</option>
              </select>
            </label>
            <label>
              Label
              <input value={verificationDraft.label} onChange={(event) => setVerificationDraft((current) => ({ ...current, label: event.target.value }))} />
            </label>
            <label>
              Requested items
              <input value={verificationDraft.requestedItems} onChange={(event) => setVerificationDraft((current) => ({ ...current, requestedItems: event.target.value }))} />
            </label>
            <button type="submit" className="ghost-button" disabled={busy}>Open verification case</button>
          </form>
          <div className="list-stack">
            {verificationQueue.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.targetType} · {item.status} · {item.stage}</p>
                </div>
                <div className="inline-actions wrap">
                  <button type="button" className="ghost-button small" onClick={() => resolveVerificationCase(item.id, "approved")}>
                    Approve
                  </button>
                  <button type="button" className="ghost-button small" onClick={() => resolveVerificationCase(item.id, "follow_up")}>
                    Follow up
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Notification center</p>
            <span className="badge subtle">{(state.notificationEvents || []).length} events</span>
          </div>
          <div className="list-stack">
            {unreadNotifications.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </div>
                <button type="button" className="ghost-button small" onClick={() => markNotificationRead(item.id)}>
                  Mark read
                </button>
              </div>
            ))}
            {!unreadNotifications.length ? <p className="panel-copy">No unread notifications.</p> : null}
          </div>
        </article>
      </section>

      <section className="surface-row two-up service-panel compliance-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Document vault</p>
            <span className="badge subtle">{(state.documentVault || []).length} stored</span>
          </div>
          <form className="market-form" onSubmit={submitDocument}>
            <label>
              Target id
              <input value={documentDraft.targetId} onChange={(event) => setDocumentDraft((current) => ({ ...current, targetId: event.target.value }))} />
            </label>
            <label>
              Target type
              <select value={documentDraft.targetType} onChange={(event) => setDocumentDraft((current) => ({ ...current, targetType: event.target.value }))}>
                <option value="profile">Profile</option>
                <option value="merchant">Merchant</option>
                <option value="thread">Thread</option>
                <option value="listing">Listing</option>
              </select>
            </label>
            <label>
              Document name
              <input value={documentDraft.name} onChange={(event) => setDocumentDraft((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              Kind
              <input value={documentDraft.kind} onChange={(event) => setDocumentDraft((current) => ({ ...current, kind: event.target.value }))} />
            </label>
            <button type="submit" className="ghost-button" disabled={busy}>Add document</button>
          </form>
          <div className="list-stack">
            {documentTail.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.targetType} · {item.targetId}</p>
                </div>
                <div className="row-meta-text">{item.kind} · {item.status}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Operator actions</p>
            <span className="badge subtle">{(state.operatorActions || []).length} logged</span>
          </div>
          <div className="list-stack">
            {operatorTail.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.action}</strong>
                  <p>{item.detail}</p>
                </div>
                <div className="row-meta-text">{item.outcome}</div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row two-up service-panel compliance-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Audit trail</p>
            <span className="badge subtle">{(state.auditEvents || []).length} events</span>
          </div>
          <div className="list-stack">
            {auditTail.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.action}</strong>
                  <p>{item.detail}</p>
                </div>
                <div className="row-meta-text">{item.type} · {item.severity}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Device sessions</p>
            <span className="badge subtle">{deviceTail.length} tracked</span>
          </div>
          <div className="list-stack">
            {deviceTail.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.platform} · {item.location}</p>
                </div>
                <div className="inline-actions wrap">
                  <span className="row-meta-text">{item.trust} · {item.sessionState}</span>
                  {item.sessionState !== "revoked" ? (
                    <button type="button" className="ghost-button small" onClick={() => revokeDeviceSession(item.id)}>
                      Revoke
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row two-up service-panel routes-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Route planner</p>
            <span className="badge subtle">{(state.routePlans || []).length} routes</span>
          </div>
          <div className="inline-actions wrap">
            <button
              type="button"
              className="ghost-button small"
              onClick={() => setRouteDraft({ name: "Home to Venue", origin: "Home", destination: "Main Venue", stops: 1, etaMinutes: 18, mode: "drive" })}
            >
              Home to Venue
            </button>
            <button
              type="button"
              className="ghost-button small"
              onClick={() => setRouteDraft({ name: "Pickup Loop", origin: "Downtown", destination: "Event District", stops: 3, etaMinutes: 24, mode: "drive" })}
            >
              Pickup Loop
            </button>
            <button
              type="button"
              className="ghost-button small"
              onClick={() => setRouteDraft({ name: "Transit Route", origin: "Station", destination: "Venue", stops: 1, etaMinutes: 32, mode: "transit" })}
            >
              Transit Route
            </button>
          </div>
          <form className="market-form" onSubmit={submitRoutePlan}>
            <label>
              Route name
              <input value={routeDraft.name} onChange={(event) => setRouteDraft((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              Origin
              <input value={routeDraft.origin} onChange={(event) => setRouteDraft((current) => ({ ...current, origin: event.target.value }))} />
            </label>
            <label>
              Destination
              <input value={routeDraft.destination} onChange={(event) => setRouteDraft((current) => ({ ...current, destination: event.target.value }))} />
            </label>
            <button type="submit" className="ghost-button" disabled={busy}>Save route</button>
          </form>
          <div className="list-stack">
            {(state.routePlans || []).slice(0, 4).map((route) => (
              <div key={route.id} className="list-row">
                <div>
                  <strong>{route.name}</strong>
                  <p>{route.origin} to {route.destination}</p>
                </div>
                <div className="row-meta-text">{route.mode || "route"}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Mini-program manifest</p>
            <span className="badge subtle">{(state.miniProgramManifests || []).length} manifests</span>
          </div>
          <form className="market-form" onSubmit={submitManifest}>
            <label>
              App id
              <input value={manifestDraft.appId} onChange={(event) => setManifestDraft((current) => ({ ...current, appId: event.target.value }))} />
            </label>
            <label>
              Permissions
              <input value={manifestDraft.permissions} onChange={(event) => setManifestDraft((current) => ({ ...current, permissions: event.target.value }))} />
            </label>
            <label>
              Events
              <input value={manifestDraft.events} onChange={(event) => setManifestDraft((current) => ({ ...current, events: event.target.value }))} />
            </label>
            <button type="submit" className="ghost-button" disabled={busy}>Register manifest</button>
          </form>
          <div className="list-stack">
            {(state.miniProgramManifests || []).slice(0, 4).map((manifest) => (
              <div key={manifest.id} className="list-row">
                <div>
                  <strong>{manifest.appId}</strong>
                  <p>{Array.isArray(manifest.permissions) ? manifest.permissions.join(", ") : "No permissions listed"}</p>
                </div>
                <div className="row-meta-text">{manifest.status || manifest.version || "draft"}</div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row service-panel mini-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Runtime sessions</p>
            <span className="badge subtle">{(state.miniAppRuntimeSessions || []).length} active</span>
          </div>
          <div className="list-stack">
            {(state.miniAppRuntimeSessions || []).slice(0, 5).map((session) => (
              <div key={session.id} className="list-row">
                <div>
                  <strong>{session.appId || session.name}</strong>
                  <p>{session.scope || session.context || "mini app session"}</p>
                </div>
                <div className="row-meta-text">{session.status || "running"}</div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row two-up mini-mechanics-row service-panel mini-panel">
        <article className="surface surface-strong">
          <div className="surface-head">
            <p className="card-label">Mini app helpers</p>
            <span className="badge subtle">{miniCoverageScore}% covered</span>
          </div>
          <p className="surface-note">
            Mini apps need more than launch buttons. These helpers keep each app connected to the right person and the right conversation.
          </p>
          <div className="mechanic-grid">
            {Object.entries(miniMechanicGroups).map(([area, items]) => (
              <div key={area} className="mechanic-group">
                <div className="mechanic-group-head">
                  <strong>{area}</strong>
                  <span className="badge subtle">{items.length}</span>
                </div>
                <div className="list-stack">
                  {items.map((item) => (
                    <div key={item.id} className="mechanic-item">
                      <div>
                        <strong>{item.name}</strong>
                        <p>{item.detail}</p>
                      </div>
                      <span className="badge subtle">{item.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Mini app actions</p>
            <span className="badge subtle">{state.miniAppRuntimeSessions?.length || 0} sessions</span>
          </div>
          <p className="surface-note">
            Use these controls to make sure a mini app can open, ask for permission, send an update, and finish later if needed.
          </p>
          <div className="action-grid">
            <button type="button" className="action-pill" onClick={() => registerMiniProgramManifest?.({ appId: activeMiniApp?.id || "merchantos", version: "1.0.0", permissions: ["identity", "wallet", "contacts"], events: ["thread:return", "checkout:open"], status: "review" })} disabled={busy}>
              <strong>Save selected mini app</strong>
              <p>Saves what the app can use: money, identity, contacts, and return path.</p>
            </button>
            <button type="button" className="action-pill" onClick={() => registerMiniAppRuntime?.({ appId: activeMiniApp?.id || "merchantos", permissions: ["profile.read", "wallet.write", "thread.return"] })} disabled={busy}>
              <strong>Open mini app session</strong>
              <p>Starts a safe session for the selected mini app.</p>
            </button>
            <button type="button" className="action-pill" onClick={() => invokeMiniAppRuntimeEvent?.({ appId: activeMiniApp?.id || "merchantos", permission: "wallet.write", event: "checkout:open" })} disabled={busy}>
              <strong>Send checkout event</strong>
              <p>Tests event handling for a wallet or merchant checkout path.</p>
            </button>
            <button type="button" className="action-pill" onClick={() => queueReliableMutation?.({ mutation: "mini_program_checkout", payload: { appId: activeMiniApp?.id || "merchantos", threadId: selectedThread?.id || "thread" } })} disabled={busy}>
              <strong>Queue deferred action</strong>
              <p>Adds an offline-safe mutation tied to the current mini-program.</p>
            </button>
          </div>
        </article>
      </section>

      <section className="surface-row service-panel mini-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Recent mini-programs</p>
            <span className="badge subtle">{recentMiniApps.length} recent</span>
          </div>
          <div className="recent-mini-strip">
            {recentMiniApps.map((item) => {
              const match = rankedMiniApps.find((app) => app.name === item.name);
              return (
                <button
                  key={item.name}
                  type="button"
                  className="recent-mini-card"
                  onClick={() => {
                    if (match) {
                      selectMiniApp(match.id);
                      setServiceTab(match.id === "merchantos" ? "merchant" : "mini");
                    }
                  }}
                >
                  <span>{item.meta}</span>
                  <strong>{item.name}</strong>
                </button>
              );
            })}
          </div>
        </article>
      </section>

      <section className="surface-row two-up service-panel mini-panel">
        <article className="surface surface-strong">
          <div className="surface-head">
            <p className="card-label">Mini-programs</p>
            <span className="badge subtle">{state.searchScopes.length} surfaces</span>
          </div>
          <div className="surface-note">
            Utility apps that inherit identity, payments, and contact context.
          </div>
          <div className="mini-grid">
            {rankedMiniApps.map((app) => (
              <button
                key={app.id}
                type="button"
                className={app.id === state.activeMiniAppId ? "mini-tile active" : "mini-tile"}
                onClick={() => {
                  selectMiniApp(app.id);
                  setServiceTab(app.id === "merchantos" ? "merchant" : "mini");
                }}
              >
                <strong>{app.name}</strong>
                <p>{app.summary}</p>
              </button>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Launch context</p>
            <span className="badge subtle">{activeMiniApp.type}</span>
          </div>
          <div className="surface-note">
            Where this service opens from, and what context it inherits.
          </div>
          <div className="launchpad">
            <h3>{activeMiniApp.name}</h3>
            <p className="panel-copy">{activeMiniApp.summary}</p>
            <div className="launchpad-list">
              <div className="launchpad-row">
                <span>From thread</span>
                <strong>{selectedThread?.name || "FoxHub"}</strong>
              </div>
              <div className="launchpad-row">
                <span>Circle</span>
                <strong>{activeCircle?.name || "General"}</strong>
              </div>
              <div className="launchpad-row">
                <span>Permission scope</span>
                <strong>identity, wallet, contacts</strong>
              </div>
            </div>
            <div className="inline-actions wrap">
              <button type="button" className="accent-button" onClick={() => void handleLaunchMiniApp()} disabled={busy}>
                Launch {activeMiniApp.name}
              </button>
              <button type="button" className="ghost-button" onClick={() => void runQrFlow("qr-miniapp")} disabled={busy}>
                Scan and open
              </button>
            </div>
          </div>
        </article>
      </section>

      {activeMiniApp.id === "merchantos" ? (
        <section className="surface-row merchant-service-row service-panel merchant-panel">
          <article className="surface surface-strong">
            <div className="surface-head">
              <p className="card-label">Merchant service coverage</p>
              <span className="badge subtle">{merchantCoverageScore}% covered</span>
            </div>
            <p className="surface-note">
              MerchantOS now exposes the core operating pieces a merchant section needs: onboarding, checkout, settlements, risk, locations, disputes, documents, alerts, and reporting.
            </p>
            <div className="mechanic-grid merchant-coverage-grid">
              {Object.entries(merchantCoverageGroups).map(([category, items]) => (
                <div key={category} className="mechanic-group">
                  <div className="mechanic-group-head">
                    <strong>{category}</strong>
                    <span className="badge subtle">{items.length}</span>
                  </div>
                  <div className="list-stack">
                    {items.map((item) => (
                      <div key={item.id} className="mechanic-item">
                        <div>
                          <strong>{item.name}</strong>
                          <p>{item.mechanic}</p>
                        </div>
                        <span className="badge subtle">{item.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {activeMiniApp.id === "merchantos" ? (
        <section className="surface-row two-up service-panel merchant-panel">
          <article className="surface surface-strong">
            <div className="surface-head">
              <p className="card-label">MerchantOS</p>
              <span className="badge subtle">{merchantLocationTail.length} locations</span>
            </div>
            <div className="surface-note">
              Merchant management stays tied to FoxHub payment context so operators can run QR checkout, settlement review, payout readiness, and store health from the same workspace.
            </div>
            <div className="glance-strip compact">
              <div className="glance-card warm">
                <span>Live terminals</span>
                <strong>{liveTerminals}</strong>
              </div>
              <div className="glance-card cool">
                <span>Settlements due</span>
                <strong>{settlementsDue}</strong>
              </div>
              <div className="glance-card soft">
                <span>Payout risk</span>
                <strong>{payoutRisk}</strong>
              </div>
            </div>
            <div className="inline-actions wrap">
              <button type="button" className="accent-button" onClick={() => void runService("merchant")} disabled={busy}>
                Run merchant pay
              </button>
              <button type="button" className="ghost-button" onClick={() => void runQrFlow("qr-pay")} disabled={busy}>
                Scan merchant QR
              </button>
              <button type="button" className="ghost-button" onClick={() => void openOfficialThread("wallet-watch")} disabled={busy}>
                Wallet Watch
              </button>
            </div>
          </article>

          <article className="surface">
            <div className="surface-head">
              <p className="card-label">Settlement controls</p>
              <span className="badge subtle">{merchantSettlementTail.length} settlements</span>
            </div>
            <div className="list-stack">
              {merchantSettlementTail.map((settlement) => (
                <div key={settlement.id} className="list-row">
                  <div>
                    <strong>{settlement.merchantName}</strong>
                    <p>{settlement.note}</p>
                  </div>
                  <div className="inline-actions wrap">
                    <span className="row-meta-text">{settlement.status} · {settlement.amount}</span>
                    <button type="button" className="ghost-button small" onClick={() => reviewMerchantSettlement(settlement.id, "approved")} disabled={busy}>Approve</button>
                    <button type="button" className="ghost-button small" onClick={() => reviewMerchantSettlement(settlement.id, "hold")} disabled={busy}>Hold</button>
                    <button type="button" className="ghost-button small" onClick={() => reviewMerchantSettlement(settlement.id, "release")} disabled={busy}>Release</button>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {activeMiniApp.id === "merchantos" ? (
        <section className="surface-row three-up merchant-intel service-panel merchant-panel">
          <article className="surface surface-strong">
            <div className="surface-head">
              <p className="card-label">Merchant intelligence</p>
              <span className="badge subtle">{highlightedQueues.length} queues</span>
            </div>
            <div className="metrics-grid">
              {merchantMetrics.map((metric) => (
                <div key={metric.label} className="metric-card">
                  <span className="row-meta-text">{metric.label}</span>
                  <strong>{metric.value}</strong>
                  <span className="row-meta-text metric-helper">{metric.helper}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="surface">
            <div className="surface-head">
              <p className="card-label">Queue focus</p>
              <span className="badge subtle">{merchantQueueSnapshots.length} active</span>
            </div>
            <div className="list-stack">
              {highlightedQueues.map((queue) => (
                <div key={queue.id} className="queue-card">
                  <div className="queue-head">
                    <strong>{queue.name}</strong>
                    <span className="badge subtle">{queue.status}</span>
                  </div>
                  <p className="queue-detail">{queue.detail}</p>
                  <div className="row-meta-text">{queue.volume}</div>
                </div>
              ))}
              {!highlightedQueues.length ? (
                <p className="surface-note">No queue snapshots available.</p>
              ) : null}
            </div>
          </article>

          <article className="surface">
            <div className="surface-head">
              <p className="card-label">Action center</p>
              <span className="badge subtle">{merchantActionCards.length} shortcuts</span>
            </div>
            <div className="action-grid">
              {merchantActionCards.map((action) => {
                const handler = merchantActionHandlers[action.id];
                return (
                  <button
                    key={action.id}
                    type="button"
                    className="action-pill"
                    onClick={handler}
                    disabled={!handler || busy}
                  >
                    <strong>{action.label}</strong>
                    <p>{action.detail}</p>
                  </button>
                );
              })}
              {!merchantActionCards.length ? (
                <p className="surface-note">No quick actions available.</p>
              ) : null}
            </div>
          </article>
        </section>
      ) : null}

      {activeMiniApp.id === "merchantos" ? (
        <section className="surface-row two-up service-panel merchant-panel">
          <article className="surface">
            <div className="surface-head">
              <p className="card-label">Compliance programs</p>
              <span className="badge subtle">{complianceHighlights.length} monitored</span>
            </div>
            <div className="list-stack">
              {complianceHighlights.map((program) => (
                <div key={program.id} className="compliance-card">
                  <div className="queue-head">
                    <strong>{program.framework}</strong>
                    <span className="badge subtle">{program.status}</span>
                  </div>
                  <p>{program.control}</p>
                  <div className="row-meta-text">
                    {program.owner} · reviewed {program.cadence}
                  </div>
                </div>
              ))}
              {!complianceHighlights.length ? (
                <p className="surface-note">No compliance programs are lighted right now.</p>
              ) : null}
            </div>
          </article>

          <article className="surface">
            <div className="surface-head">
              <p className="card-label">Trust & safety alerts</p>
              <span className="badge subtle">{merchantTrustIncidents.length} active</span>
            </div>
            <div className="list-stack">
              {merchantTrustIncidents.length ? (
                merchantTrustIncidents.map((incident) => (
                  <div key={incident.id} className="incident-row">
                    <div>
                      <strong>{(incident.type || "").replace(/_/g, " ")}</strong>
                      <p>{incident.detail}</p>
                    </div>
                    <div className="row-meta-text">
                      {incident.severity} · {formatIncidentDate(incident.createdAt)}
                    </div>
                  </div>
                ))
              ) : (
                <p className="surface-note">No trust incidents affecting merchants in the last 24 hours.</p>
              )}
            </div>
          </article>
        </section>
      ) : null}

      {activeMiniApp.id === "merchantos" ? (
        <section className="surface-row two-up service-panel merchant-panel">
          <article className="surface">
            <div className="surface-head">
              <p className="card-label">Merchant locations</p>
              <span className="badge subtle">{merchantLocationTail.length} sites</span>
            </div>
            <div className="list-stack">
              {merchantLocationTail.map((location) => (
                <div key={location.id} className="list-row">
                  <div>
                    <strong>{location.merchantName}</strong>
                    <p>{location.city}, {location.state} · {location.terminalHealth} terminal · QR {location.qrStatus}</p>
                  </div>
                  <div className="inline-actions wrap">
                    <span className="row-meta-text">{location.status} · {location.complianceState}</span>
                    <button type="button" className="ghost-button small" onClick={() => updateMerchantLocationStatus(location.id, "live")} disabled={busy}>Live</button>
                    <button type="button" className="ghost-button small" onClick={() => updateMerchantLocationStatus(location.id, "pilot")} disabled={busy}>Pilot</button>
                    <button type="button" className="ghost-button small" onClick={() => updateMerchantLocationStatus(location.id, "review")} disabled={busy}>Review</button>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="surface">
            <div className="surface-head">
              <p className="card-label">Payout controls</p>
              <span className="badge subtle">{merchantPayoutControlTail.length} controls</span>
            </div>
            <div className="list-stack">
              {merchantPayoutControlTail.map((control) => (
                <div key={control.id} className="list-row">
                  <div>
                    <strong>{control.merchantName}</strong>
                    <p>{control.reason}</p>
                  </div>
                  <div className="inline-actions wrap">
                    <span className="row-meta-text">{control.state} · reserve {control.reservePercent}%</span>
                    <button type="button" className="ghost-button small" onClick={() => updateMerchantPayoutControl(control.merchantId, "release")} disabled={busy}>Release</button>
                    <button type="button" className="ghost-button small" onClick={() => updateMerchantPayoutControl(control.merchantId, "monitor")} disabled={busy}>Monitor</button>
                    <button type="button" className="ghost-button small" onClick={() => updateMerchantPayoutControl(control.merchantId, "hold")} disabled={busy}>Hold</button>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      <section className="surface-row three-up service-panel channels-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Recent apps</p>
            <span className="badge subtle">{state.serviceContinuity.length} continuity</span>
          </div>
          <div className="list-stack">
            {state.serviceContinuity.map((item) => (
              <button key={item.id} type="button" className="list-button" onClick={() => openContinuityItem(item)}>
                <div>
                  <strong>{item.appName}</strong>
                  <p>{item.returnLabel}</p>
                </div>
                <div className="row-meta-text">{item.fromThread}</div>
              </button>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Search surfaces</p>
            <span className="badge subtle">{state.searchScopes.length} scopes</span>
          </div>
          <div className="list-stack">
            {state.searchScopes.map((scope) => (
              <button key={scope.id} type="button" className="list-button" onClick={() => openSearchScope(scope.id)}>
                <div>
                  <strong>{scope.name}</strong>
                  <p>{scope.hint}</p>
                </div>
              </button>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">QR history</p>
            <span className="badge subtle">{state.qrHistory.length} recent</span>
          </div>
          <div className="list-stack">
            {recentQrHistory.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
                <div className="row-meta-text">{item.meta}</div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row service-panel channels-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Channel access</p>
            <span className="badge subtle">{state.officialAccountSubscriptions.length} following</span>
          </div>
          <div className="list-stack">
            {state.officialAccounts.map((account) => {
              const subscribed = state.officialAccountSubscriptions.includes(account.id);
              return (
                <div key={account.id} className="list-row">
                  <div>
                    <strong>{account.name}</strong>
                    <p>{account.summary}</p>
                  </div>
                  <div className="inline-actions">
                    <button type="button" className="ghost-button small" onClick={() => void openOfficialThread(account.id)}>
                      Open
                    </button>
                    <button type="button" className="ghost-button small" onClick={() => toggleOfficialAccountSubscription(account.id)}>
                    {subscribed ? "Following" : "Follow"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </article>

      </section>
      </div>
      {!state.searchScopes.length && !state.serviceContinuity.length && !state.officialAccounts.length ? (
        <FilteredEmptyState label="Services" />
      ) : null}
    </>
  );
}
