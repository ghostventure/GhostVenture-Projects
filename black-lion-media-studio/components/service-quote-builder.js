"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

const quoteStorageKey = "bls-service-estimates";
const maxStoredEstimates = 20;
const includedTravelMiles = 30;
const includedRevisionRounds = 2;

const microServices = [
  { id: "portrait-session", label: "Portrait session", category: "Black Lion Multimedia", base: 450, unit: "session", service: "Photography", marketRange: "$250-$1,500 package" },
  { id: "event-photo", label: "Event photo coverage", category: "Black Lion Multimedia", base: 1200, unit: "event block", service: "Photography", marketRange: "$150-$500/hr" },
  { id: "product-photos", label: "Product or merch photos", category: "Black Lion Fashion", base: 900, unit: "set", service: "Photography", marketRange: "$35-$175/image or $800-$5,000 day" },
  { id: "headshot-mini", label: "Headshot mini-session", category: "Black Lion Multimedia", base: 275, unit: "session", service: "Photography", marketRange: "$150-$350/hr or $250-$1,500 package" },
  { id: "brand-lifestyle", label: "Brand lifestyle set", category: "Black Lion Fashion", base: 1200, unit: "set", service: "Photography", marketRange: "$800-$5,000 day" },
  { id: "real-estate-photo", label: "Real estate photo set", category: "Black Lion Multimedia", base: 300, unit: "property", service: "Photography", marketRange: "$150-$500 listing" },
  { id: "photo-retouching", label: "Photo retouching pack", category: "Black Lion Multimedia", base: 250, unit: "pack", service: "Photography", marketRange: "$35-$175/image" },
  { id: "promo-video", label: "Promo video", category: "Black Lion Multimedia", base: 2500, unit: "project", service: "Videography", marketRange: "$2,500-$7,000 short-form branded" },
  { id: "social-reels", label: "Short-form reels", category: "Black Lion Multimedia", base: 750, unit: "bundle", service: "Videography", marketRange: "$500-$5,000 per short video" },
  { id: "event-video", label: "Event video capture", category: "Black Lion Multimedia", base: 2200, unit: "event block", service: "Videography", marketRange: "$1,500-$4,500 event" },
  { id: "interview-video", label: "Interview or testimonial video", category: "Black Lion Multimedia", base: 1500, unit: "project", service: "Videography", marketRange: "$1,500-$3,500 project" },
  { id: "music-video", label: "Music video capture", category: "Black Lion Multimedia", base: 2500, unit: "project", service: "Videography", marketRange: "$2,000-$7,000+ project" },
  { id: "highlight-recap", label: "Event highlight recap", category: "Black Lion Multimedia", base: 900, unit: "edit", service: "Videography", marketRange: "$400-$2,000 edit" },
  { id: "video-edit-only", label: "Video edit-only package", category: "Black Lion Multimedia", base: 650, unit: "edit", service: "Videography", marketRange: "$75-$350/hr" },
  { id: "dj-set", label: "DJ event set", category: "Black Lion Multimedia", base: 1600, unit: "booking", service: "DJ Services", marketRange: "$800-$2,700 wedding quartiles" },
  { id: "beat-session", label: "Beat creation session", category: "Black Lion Multimedia", base: 750, unit: "session", service: "Beat Creation Session", marketRange: "$400-$1,000 developing producer/song" },
  { id: "audio-edit", label: "Audio edit or cleanup", category: "Black Lion Multimedia", base: 250, unit: "edit", service: "Beat Creation Session", marketRange: "$75-$150/hr mid-level" },
  { id: "sound-setup", label: "Sound setup support", category: "Black Lion Multimedia", base: 450, unit: "setup", service: "DJ Services", marketRange: "$150-$750 setup" },
  { id: "playlist-curation", label: "Playlist curation", category: "Black Lion Multimedia", base: 175, unit: "list", service: "DJ Services", marketRange: "$75-$250 list" },
  { id: "recording-session", label: "Recording session support", category: "Black Lion Multimedia", base: 450, unit: "session", service: "Beat Creation Session", marketRange: "$75-$150/hr mid-level" },
  { id: "mix-master", label: "Mixing or mastering pass", category: "Black Lion Multimedia", base: 450, unit: "track", service: "Beat Creation Session", marketRange: "$200-$600 mix or $80-$200 master" },
  { id: "membership-page", label: "Membership page setup", category: "Black Lion Tech Development", base: 1200, unit: "page set", service: "Membership Sites & Support", marketRange: "$125-$300/hr US agency" },
  { id: "site-maintenance", label: "Site maintenance block", category: "Black Lion Tech Development", base: 350, unit: "month", service: "Membership Sites & Support", marketRange: "$35-$650/mo SMB maintenance" },
  { id: "pc-support", label: "PC support visit", category: "Black Lion Tech Development", base: 150, unit: "visit", service: "PC Tech Services", marketRange: "$119-$169 national repair average" },
  { id: "landing-page-build", label: "Landing page build", category: "Black Lion Tech Development", base: 1800, unit: "page", service: "Membership Sites & Support", marketRange: "$125-$300/hr US agency" },
  { id: "form-automation", label: "Form or automation setup", category: "Black Lion Tech Development", base: 600, unit: "workflow", service: "Membership Sites & Support", marketRange: "$125-$300/hr US agency" },
  { id: "analytics-setup", label: "Analytics or tracking setup", category: "Black Lion Tech Development", base: 450, unit: "setup", service: "Membership Sites & Support", marketRange: "$125-$300/hr US agency" },
  { id: "pc-tuneup", label: "PC tune-up and cleanup", category: "Black Lion Tech Development", base: 150, unit: "device", service: "PC Tech Services", marketRange: "$119-$169 national repair average" },
  { id: "hardware-upgrade", label: "Hardware upgrade labor", category: "Black Lion Tech Development", base: 175, unit: "device", service: "PC Tech Services", marketRange: "$119-$226 repair/labor range" },
  { id: "content-planning", label: "Creative planning call", category: "Black Lion Multimedia", base: 175, unit: "call", service: "Photography", marketRange: "$125-$300/hr production planning" },
  { id: "shot-list", label: "Shot list and production brief", category: "Black Lion Multimedia", base: 250, unit: "brief", service: "Photography", marketRange: "$125-$300/hr production planning" },
  { id: "content-calendar", label: "Content calendar setup", category: "Black Lion Multimedia", base: 350, unit: "calendar", service: "Videography", marketRange: "$250-$1,000 plan" },
  { id: "brand-review", label: "Brand or campaign review", category: "Black Lion Fashion", base: 300, unit: "review", service: "Photography", marketRange: "$125-$300/hr strategy review" },
  { id: "production-roadmap", label: "Production roadmap", category: "Black Lion Multimedia", base: 500, unit: "roadmap", service: "Videography", marketRange: "$300-$1,500 plan" },
  { id: "rush-edit", label: "Rush edit window", category: "Black Lion Multimedia", base: 400, unit: "rush block", service: "Videography", marketRange: "15%-35% rush lift" },
  { id: "extra-revisions", label: "Revision pack", category: "Black Lion Multimedia", base: 150, unit: "pack", service: "Videography", marketRange: "$75-$350/hr" },
  { id: "extra-location", label: "Extra location", category: "Black Lion Multimedia", base: 200, unit: "location", service: "Photography", marketRange: "$75-$300 add-on" },
  { id: "same-day-teaser", label: "Same-day teaser delivery", category: "Black Lion Multimedia", base: 500, unit: "teaser", service: "Videography", marketRange: "$400-$2,000 add-on" },
  { id: "raw-file-delivery", label: "Raw file delivery", category: "Black Lion Multimedia", base: 300, unit: "handoff", service: "Videography", marketRange: "$100-$750 add-on" },
  { id: "usage-license-extension", label: "Usage license extension", category: "Black Lion Fashion", base: 500, unit: "license", service: "Photography", marketRange: "$250-$10,000 usage" },
  { id: "assistant-operator", label: "Assistant or second operator", category: "Black Lion Multimedia", base: 600, unit: "day", service: "Videography", marketRange: "$300-$800 day" }
];

const mainServiceLanes = ["Black Lion Multimedia", "Black Lion Tech Development", "Black Lion Fashion"];
const usageOptions = [
  { label: "Personal / internal", multiplier: 1 },
  { label: "Social content", multiplier: 1.08 },
  { label: "Business marketing", multiplier: 1.18 },
  { label: "Paid campaign / commercial", multiplier: 1.35 }
];
const timelineOptions = [
  { label: "Flexible", multiplier: 0.95, days: "7-14 days" },
  { label: "Standard", multiplier: 1, days: "3-10 days" },
  { label: "Priority", multiplier: 1.18, days: "2-5 days" },
  { label: "Rush", multiplier: 1.35, days: "24-72 hours when available" }
];
const locationOptions = [
  { label: "Remote / studio-ready", fee: 0 },
  { label: "Local on-site", fee: 75 },
  { label: "Multi-location", fee: 175 },
  { label: "Event venue", fee: 125 }
];
const productionTierOptions = [
  { label: "Essential", multiplier: 0.92, note: "Lean setup" },
  { label: "Studio standard", multiplier: 1, note: "Balanced production" },
  { label: "Premium", multiplier: 1.16, note: "Higher polish" },
  { label: "Campaign-grade", multiplier: 1.32, note: "Commercial-ready" }
];
const deliveryFormatOptions = [
  { label: "Standard delivery", fee: 0, note: "Core files and handoff" },
  { label: "Social-ready kit", fee: 125, note: "Crops, captions, and platform cuts" },
  { label: "Brand asset kit", fee: 250, note: "Organized launch-ready deliverables" },
  { label: "Archive and source handoff", fee: 350, note: "Expanded file packaging" }
];
const talentSupportOptions = [
  { label: "No added crew", fee: 0, note: "Solo or client-provided support" },
  { label: "Assistant coordination", fee: 175, note: "On-site support planning" },
  { label: "Model/talent coordination", fee: 300, note: "Talent scheduling support" },
  { label: "Full production support", fee: 550, note: "Crew, talent, and run-of-show support" }
];
const marketModes = [
  { label: "Soft", multiplier: 0.94 },
  { label: "Normal", multiplier: 1 },
  { label: "Busy", multiplier: 1.12 },
  { label: "High demand", multiplier: 1.24 }
];

function money(value) {
  const amount = Number.isFinite(Number(value)) ? Number(value) : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(Math.round(amount));
}

function cents(value) {
  const amount = Number.isFinite(Number(value)) ? Number(value) : 0;
  return Math.max(0, Math.round(amount * 100));
}

function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function getOption(options, label, fallbackIndex = 0) {
  return options.find((item) => item.label === label) || options[fallbackIndex] || options[0];
}

function getMarketMode(index) {
  const safeIndex = clamp(index, 0, marketModes.length - 1);
  return marketModes[safeIndex] || marketModes[1] || marketModes[0];
}

function visibleServiceIds(lanes) {
  const laneSet = new Set(lanes.filter((lane) => mainServiceLanes.includes(lane)));
  return microServices
    .filter((item) => laneSet.has(item.category) || laneSet.has(item.service))
    .map((item) => item.id);
}

function safeEstimateList(rawValue) {
  try {
    const parsed = JSON.parse(rawValue || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function calculateTravelCharge(miles, hasServices) {
  const safeMiles = clamp(miles, 0, 150);
  const billableMiles = hasServices ? Math.max(0, safeMiles - includedTravelMiles) : 0;
  return {
    safeMiles,
    billableMiles,
    fee: billableMiles ? billableMiles * 1.35 + Math.ceil(billableMiles / 25) * 25 : 0
  };
}

function budgetLabel(total) {
  if (total < 250) return "Under $250";
  if (total < 500) return "$250-$500";
  if (total < 1000) return "$500-$1,000";
  if (total < 2500) return "$1,000-$2,500";
  return "$2,500+";
}

function primaryServiceName(selectedItems, selectedLanes) {
  if (selectedLanes.length === 1) {
    const laneItem = selectedItems.find((item) => item.category === selectedLanes[0] || item.service === selectedLanes[0]);
    if (laneItem) return laneItem.service;
  }
  return selectedItems[0]?.service || "Photography";
}

function readinessScore({ selectedItems, scope, complexity, deliverables, hours, revisions, timeline, productionTier, deliveryFormat }) {
  let score = selectedItems.length ? 48 : 12;
  score += Math.min(18, selectedItems.length * 4);
  score += clamp(scope, 0, 4) * 3;
  score += clamp(complexity, 0, 4) * 3;
  score += Math.min(10, deliverables * 1.5);
  score += Math.min(8, hours);
  score += revisions <= includedRevisionRounds ? 4 : 1;
  if (timeline === "Flexible" || timeline === "Standard") score += 5;
  if (productionTier === "Premium" || productionTier === "Campaign-grade") score += 4;
  if (deliveryFormat !== "Standard delivery") score += 3;
  return Math.round(clamp(score, 0, 100));
}

function readinessLabel(score) {
  if (score >= 82) return "Production-ready";
  if (score >= 64) return "Strong brief";
  if (score >= 42) return "Needs review";
  return "Early draft";
}

export function ServiceQuoteBuilder({
  compact = false,
  dashboard = false,
  onApplyEstimate,
  onSendQuote,
  sendingQuote = false
}) {
  const [selectedIds, setSelectedIds] = useState(["portrait-session"]);
  const [selectedLanes, setSelectedLanes] = useState(["Black Lion Multimedia"]);
  const [usage, setUsage] = useState(usageOptions[1].label);
  const [timeline, setTimeline] = useState(timelineOptions[1].label);
  const [location, setLocation] = useState(locationOptions[0].label);
  const [productionTier, setProductionTier] = useState(productionTierOptions[1].label);
  const [deliveryFormat, setDeliveryFormat] = useState(deliveryFormatOptions[0].label);
  const [talentSupport, setTalentSupport] = useState(talentSupportOptions[0].label);
  const [market, setMarket] = useState(1);
  const [scope, setScope] = useState(2);
  const [complexity, setComplexity] = useState(2);
  const [deliverables, setDeliverables] = useState(2);
  const [hours, setHours] = useState(2);
  const [revisions, setRevisions] = useState(1);
  const [travelMiles, setTravelMiles] = useState(0);
  const [firstTimer, setFirstTimer] = useState(true);
  const [confirmedSignature, setConfirmedSignature] = useState("");
  const [savedNotice, setSavedNotice] = useState("");

  const estimate = useMemo(() => {
    const safeSelectedIds = new Set(selectedIds.filter((id) => microServices.some((item) => item.id === id)));
    const selectedItems = microServices.filter((item) => safeSelectedIds.has(item.id));
    const safeSelectedLanes = selectedLanes.filter((lane) => mainServiceLanes.includes(lane));
    const usageOption = getOption(usageOptions, usage, 0);
    const timelineOption = getOption(timelineOptions, timeline, 1);
    const locationOption = getOption(locationOptions, location, 0);
    const productionTierOption = getOption(productionTierOptions, productionTier, 1);
    const deliveryFormatOption = getOption(deliveryFormatOptions, deliveryFormat, 0);
    const talentSupportOption = getOption(talentSupportOptions, talentSupport, 0);
    const marketOption = getMarketMode(market);
    const serviceBase = selectedItems.reduce((sum, item) => sum + item.base, 0);
    const setupBase = selectedItems.length ? serviceBase : 0;
    const scopeMultiplier = 1 + (clamp(scope, 0, 4) - 2) * 0.08;
    const complexityMultiplier = 1 + (clamp(complexity, 0, 4) - 2) * 0.1;
    const deliverableFee = selectedItems.length ? Math.max(0, deliverables - 1) * 45 : 0;
    const hourFee = selectedItems.length ? Math.max(0, hours - 2) * 65 : 0;
    const billableRevisionRounds = selectedItems.length ? Math.max(0, revisions - includedRevisionRounds) : 0;
    const revisionFee = billableRevisionRounds * 55;
    const travelCharge = calculateTravelCharge(travelMiles, selectedItems.length > 0);
    const billableTravelMiles = travelCharge.billableMiles;
    const travelFee = travelCharge.fee;
    const serviceSubtotal = (setupBase + locationOption.fee + deliveryFormatOption.fee + talentSupportOption.fee + deliverableFee + hourFee + revisionFee) *
      scopeMultiplier *
      complexityMultiplier *
      productionTierOption.multiplier *
      usageOption.multiplier *
      timelineOption.multiplier *
      marketOption.multiplier;
    const discount = firstTimer ? serviceSubtotal * 0.25 : 0;
    const serviceTotal = Math.max(0, serviceSubtotal - discount);
    const total = serviceTotal + travelFee;
    const deposit = total > 0 ? total * 0.5 : 0;
    const summary = selectedItems.length
      ? selectedItems.map((item) => item.label).join(", ")
      : "No optional micro-services selected yet";
    const score = readinessScore({
      selectedItems,
      scope,
      complexity,
      deliverables,
      hours,
      revisions,
      timeline,
      productionTier,
      deliveryFormat
    });
    const signature = [
      selectedItems.map((item) => item.id).sort().join(","),
      safeSelectedLanes.sort().join(","),
      usage,
      timeline,
      location,
      productionTier,
      deliveryFormat,
      talentSupport,
      market,
      scope,
      complexity,
      deliverables,
      hours,
      revisions,
      travelMiles,
      firstTimer,
      Math.round(total)
    ].join("|");

    return {
      selectedItems,
      summary,
      productionTierLabel: productionTierOption.label,
      productionTierNote: productionTierOption.note,
      deliveryFormatLabel: deliveryFormatOption.label,
      deliveryFormatNote: deliveryFormatOption.note,
      talentSupportLabel: talentSupportOption.label,
      talentSupportNote: talentSupportOption.note,
      marketRate: serviceSubtotal,
      discount,
      serviceTotal,
      total,
      deposit,
      travelFee,
      billableTravelMiles,
      billableRevisionRounds,
      timelineDays: timelineOption.days,
      serviceName: primaryServiceName(selectedItems, safeSelectedLanes),
      budget: budgetLabel(total),
      budgetSummary: `${money(total)} estimated total | 50% deposit ${money(deposit)} | ${budgetLabel(total)}`,
      estimateAmountCents: cents(total),
      depositAmountCents: cents(deposit),
      readinessScore: score,
      readinessLabel: readinessLabel(score),
      signature,
      details: [
        `Estimate generated from: ${summary}.`,
        `Main services: ${safeSelectedLanes.length ? safeSelectedLanes.join(", ") : "None selected"}.`,
        `Usage: ${usage}. Timeline: ${timeline}. Location: ${location}. Production tier: ${productionTierOption.label}. Delivery format: ${deliveryFormatOption.label}. Talent or crew support: ${talentSupportOption.label}. Market: ${marketOption.label}.`,
        `Production readiness: ${readinessLabel(score)} at ${score}/100.`,
        `Scope ${scope}/4, complexity ${complexity}/4, deliverables ${deliverables}, hours ${hours}, revisions ${revisions}; the first ${includedRevisionRounds} revision rounds are included and ${billableRevisionRounds} rounds are billable.`,
        `Travel distance: ${travelCharge.safeMiles} miles; travel under ${includedTravelMiles} miles is included and ${billableTravelMiles} miles are an independent extra charge over the included ${includedTravelMiles}-mile window.`,
        `Client confirmation required before manager handoff: confirm this estimate matches what they are looking for.`,
        firstTimer ? "First-time client discount included at 25%." : "No first-time discount included.",
        selectedItems.length
          ? "Once selected services are requested, a 50% deposit is warranted and required to confirm the request, scheduling seriousness, and production commitment."
          : "Deposit requirement applies after services are selected and requested."
      ].join(" ")
    };
  }, [selectedIds, usage, timeline, location, productionTier, deliveryFormat, talentSupport, market, scope, complexity, deliverables, hours, revisions, travelMiles, firstTimer, selectedLanes]);

  const estimateConfirmed = confirmedSignature === estimate.signature;

  function toggleService(serviceId) {
    setSavedNotice("");
    setSelectedIds((current) =>
      current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId]
    );
  }

  function toggleMainService(lane) {
    if (!mainServiceLanes.includes(lane)) return;
    setSavedNotice("");
    const next = selectedLanes.includes(lane)
      ? selectedLanes.filter((item) => item !== lane)
      : [...selectedLanes, lane];
    const nextVisibleIds = new Set(visibleServiceIds(next));
    setSelectedLanes(next);
    setSelectedIds((selected) => selected.filter((id) => nextVisibleIds.has(id)));
  }

  function saveEstimate() {
    const record = {
      total: estimate.total,
      marketRate: estimate.marketRate,
      discount: estimate.discount,
      deposit: estimate.deposit,
      serviceName: estimate.serviceName,
      budget: estimate.budget,
      summary: estimate.summary,
      details: estimate.details,
      createdAt: new Date().toISOString()
    };
    try {
      const current = safeEstimateList(window.localStorage.getItem(quoteStorageKey));
      window.localStorage.setItem(quoteStorageKey, JSON.stringify([record, ...current].slice(0, maxStoredEstimates)));
      setSavedNotice("Estimate saved in this browser.");
    } catch {
      setSavedNotice("Estimate ready. Local save was not available in this browser.");
    }
  }

  function applyEstimate() {
    if (!onApplyEstimate) return;
    onApplyEstimate({
      projectType: estimate.serviceName,
      budget: estimate.budgetSummary,
      timeline: estimate.timelineDays,
      estimateAmountCents: estimate.estimateAmountCents,
      depositAmountCents: estimate.depositAmountCents,
      details: estimate.details
    });
    setSavedNotice("Estimate copied into the service request form.");
  }

  function sendConfirmedEstimate() {
    if (!onSendQuote) return;
    if (!estimate.selectedItems.length) {
      setSavedNotice("Select at least one service before sending a quote.");
      return;
    }
    if (!estimateConfirmed) {
      setSavedNotice("Confirm that this estimate matches what you are looking for before sending it.");
      return;
    }
    onSendQuote({
      projectType: estimate.serviceName,
      budget: estimate.budgetSummary,
      timeline: estimate.timelineDays,
      estimateAmountCents: estimate.estimateAmountCents,
      depositAmountCents: estimate.depositAmountCents,
      details: estimate.details
    });
  }

  const visibleServices = microServices.filter(
    (item) => selectedLanes.includes(item.category) || selectedLanes.includes(item.service)
  );

  return (
    <section
      className={`service-quote-builder ${compact ? "service-quote-compact" : ""}`}
      id={compact ? undefined : "service-estimation"}
      aria-label="Service Estimation"
    >
      <div className="quote-builder-head">
        <div>
          <p className="label">Service Estimation</p>
          <h2 className="editorial-heading">Build a Service Estimation before you send the request.</h2>
          <p className="muted">
            Choose only the micro-services you want. The estimate updates as scope, timing, usage,
            travel, and first-time pricing change.
          </p>
        </div>
        <div className="quote-builder-total">
          <span>Service Estimation</span>
          <strong>{money(estimate.total)}</strong>
          <p>{estimate.selectedItems.length ? `${estimate.selectedItems.length} selected` : "No services selected"}</p>
        </div>
      </div>

      <div className="quote-builder-grid">
        <div className="quote-control-panel">
          <div className="quote-select-grid">
            <label>
              Usage
              <select value={usage} onChange={(event) => setUsage(event.target.value)}>
                {usageOptions.map((option) => (
                  <option key={option.label}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              Timeline
              <select value={timeline} onChange={(event) => setTimeline(event.target.value)}>
                {timelineOptions.map((option) => (
                  <option key={option.label}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              Location
              <select value={location} onChange={(event) => setLocation(event.target.value)}>
                {locationOptions.map((option) => (
                  <option key={option.label}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              Production tier
              <select value={productionTier} onChange={(event) => setProductionTier(event.target.value)}>
                {productionTierOptions.map((option) => (
                  <option key={option.label}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              Delivery format
              <select value={deliveryFormat} onChange={(event) => setDeliveryFormat(event.target.value)}>
                {deliveryFormatOptions.map((option) => (
                  <option key={option.label}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              Talent / crew support
              <select value={talentSupport} onChange={(event) => setTalentSupport(event.target.value)}>
                {talentSupportOptions.map((option) => (
                  <option key={option.label}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="main-service-picker">
            <strong>Main services</strong>
            <div>
              {mainServiceLanes.map((lane) => (
                <label className="main-service-option" key={lane}>
                  <input
                    type="checkbox"
                    checked={selectedLanes.includes(lane)}
                    onChange={() => toggleMainService(lane)}
                  />
                  <span>{lane}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="micro-service-groups">
            <div className="micro-service-group">
              <strong>{selectedLanes.length ? "Selected branch services" : "Select a branch to show services"}</strong>
              <div className="micro-service-list">
                {visibleServices.map((item) => (
                  <label className="micro-service-option" key={item.id}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleService(item.id)}
                    />
                    <span>
                      <b>{item.label}</b>
                      <em>{money(item.base)} / {item.unit} · market {item.marketRange}</em>
                    </span>
                  </label>
                ))}
                {visibleServices.length === 0 ? (
                  <p className="muted">No main services selected yet.</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="quote-toggle-row">
            <label className="quote-switch">
              <input type="checkbox" checked={firstTimer} onChange={(event) => setFirstTimer(event.target.checked)} />
              <span />
              First-time client discount: 25%
            </label>
          </div>
        </div>

        <div className="quote-adjust-panel">
          <div className="quote-premium-card">
            <span>Production readiness</span>
            <strong>{estimate.readinessScore}/100</strong>
            <p>{estimate.readinessLabel}</p>
          </div>
          <div className="quote-insight-grid">
            <div>
              <span>Tier</span>
              <strong>{estimate.productionTierLabel}</strong>
              <p>{estimate.productionTierNote}</p>
            </div>
            <div>
              <span>Delivery</span>
              <strong>{estimate.deliveryFormatLabel}</strong>
              <p>{estimate.deliveryFormatNote}</p>
            </div>
            <div>
              <span>Support</span>
              <strong>{estimate.talentSupportLabel}</strong>
              <p>{estimate.talentSupportNote}</p>
            </div>
          </div>
          <label>
            Market rate
            <input type="range" min="0" max="3" value={market} onChange={(event) => setMarket(Number(event.target.value))} />
            <span>{marketModes[market].label}</span>
          </label>
          <label>
            Scope
            <input type="range" min="0" max="4" value={scope} onChange={(event) => setScope(Number(event.target.value))} />
            <span>{scope}/4</span>
          </label>
          <label>
            Complexity
            <input type="range" min="0" max="4" value={complexity} onChange={(event) => setComplexity(Number(event.target.value))} />
            <span>{complexity}/4</span>
          </label>
          <label>
            Deliverables
            <input type="range" min="1" max="8" value={deliverables} onChange={(event) => setDeliverables(Number(event.target.value))} />
            <span>{deliverables}</span>
          </label>
          <label>
            On-site/session hours
            <input type="range" min="1" max="10" value={hours} onChange={(event) => setHours(Number(event.target.value))} />
            <span>{hours}</span>
          </label>
          <label>
            Revision rounds
            <input type="range" min="0" max="5" value={revisions} onChange={(event) => setRevisions(Number(event.target.value))} />
            <span>{revisions} selected{estimate.billableRevisionRounds ? ` / ${estimate.billableRevisionRounds} billable` : " / included"}</span>
          </label>
          <label>
            Travel distance
            <input type="range" min="0" max="150" step="5" value={travelMiles} onChange={(event) => setTravelMiles(Number(event.target.value))} />
            <span>{travelMiles} miles{travelMiles > 30 ? ` / +${money(estimate.travelFee)}` : " / included"}</span>
          </label>
        </div>

        <aside className="quote-result-card">
          <p className="label">Estimate result</p>
          <div className="quote-price-row">
            <span>Service subtotal</span>
            <strong>{money(estimate.marketRate)}</strong>
          </div>
          <div className="quote-price-row discount">
            <span>First-time discount</span>
            <strong>-{money(estimate.discount)}</strong>
          </div>
          <div className="quote-price-row">
            <span>Travel charge over 30 miles</span>
            <strong>{estimate.billableTravelMiles ? money(estimate.travelFee) : "Included"}</strong>
          </div>
          <div className="quote-price-row">
            <span>Revision rounds after 2</span>
            <strong>{estimate.billableRevisionRounds ? `${estimate.billableRevisionRounds} billable` : "Included"}</strong>
          </div>
          <div className="quote-price-total">
            <span>Estimated total</span>
            <strong>{money(estimate.total)}</strong>
          </div>
          <div className="quote-result-metrics">
            <div>
              <span>Required deposit</span>
              <strong>{money(estimate.deposit)}</strong>
            </div>
            <div>
              <span>Timing</span>
              <strong>{estimate.timelineDays}</strong>
            </div>
            <div>
              <span>Budget lane</span>
              <strong>{estimate.budget}</strong>
            </div>
          </div>
          <div className="quote-review-panel">
            <div>
              <span>Production readiness</span>
              <strong>{estimate.readinessLabel}</strong>
            </div>
            <div>
              <span>Selected services</span>
              <strong>{estimate.selectedItems.length}</strong>
            </div>
          </div>
          <p className="quote-summary">{estimate.summary}</p>
          <p className="quote-disclaimer">
            Estimate only. Baselines use 2026 market-rate research for comparable U.S. multimedia,
            software, web, fashion, DJ, and PC-support work. Final quote can change after schedule, venue,
            files, usage, travel, and delivery needs are reviewed. Travel under 30 miles is
            included; travel over 30 miles is an independent extra charge. Once selected services
            are requested, a 50% deposit is warranted and required to confirm seriousness and
            reserve production time. Two revision rounds are included; additional revision rounds
            may add charges.
          </p>
          <label className="quote-confirmation">
            <input
              type="checkbox"
              checked={estimateConfirmed}
              onChange={(event) => setConfirmedSignature(event.target.checked ? estimate.signature : "")}
            />
            <span>
              I confirm this Service Estimation matches what I am looking for and is ready for manager review.
            </span>
          </label>
          <div className="quote-action-row">
            <button type="button" className="button" onClick={saveEstimate}>Save estimation</button>
            {dashboard && onSendQuote ? (
              <button type="button" className="button" onClick={sendConfirmedEstimate} disabled={sendingQuote || estimate.selectedItems.length === 0 || !estimateConfirmed}>
                {sendingQuote ? "Sending quote..." : estimate.selectedItems.length === 0 ? "Select services first" : !estimateConfirmed ? "Confirm estimate first" : "Send Quote"}
              </button>
            ) : null}
            {dashboard && onApplyEstimate ? (
              <button type="button" className="button button-secondary" onClick={applyEstimate}>Apply to request form</button>
            ) : (
              <Link href="/portal" className="button button-secondary">Continue to portal</Link>
            )}
          </div>
          {savedNotice ? <p className="message is-visible">{savedNotice}</p> : null}
        </aside>
      </div>
    </section>
  );
}
