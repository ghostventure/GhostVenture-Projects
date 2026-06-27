"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

const quoteStorageKey = "bls-service-estimates";
const maxStoredEstimates = 20;
const includedTravelMiles = 30;

const microServices = [
  { id: "portrait-session", label: "Portrait session", category: "Photography", base: 375, unit: "session", service: "Photography", marketRange: "$250-$1,500 package" },
  { id: "event-photo", label: "Event photo coverage", category: "Photography", base: 900, unit: "event block", service: "Photography", marketRange: "$150-$500/hr" },
  { id: "product-photos", label: "Product or merch photos", category: "Photography", base: 650, unit: "set", service: "Photography", marketRange: "$500-$2,500 half-day" },
  { id: "headshot-mini", label: "Headshot mini-session", category: "Photography", base: 225, unit: "session", service: "Photography", marketRange: "$150-$500 session" },
  { id: "brand-lifestyle", label: "Brand lifestyle set", category: "Photography", base: 800, unit: "set", service: "Photography", marketRange: "$800-$5,000 day" },
  { id: "real-estate-photo", label: "Real estate photo set", category: "Photography", base: 350, unit: "property", service: "Photography", marketRange: "$150-$500 shoot" },
  { id: "photo-retouching", label: "Photo retouching pack", category: "Photography", base: 175, unit: "pack", service: "Photography", marketRange: "$25-$175 image" },
  { id: "promo-video", label: "Promo video", category: "Videography", base: 1250, unit: "project", service: "Videography", marketRange: "$500-$5,000 project" },
  { id: "social-reels", label: "Short-form reels", category: "Videography", base: 450, unit: "bundle", service: "Videography", marketRange: "$250+ per video" },
  { id: "event-video", label: "Event video capture", category: "Videography", base: 1800, unit: "event block", service: "Videography", marketRange: "$1,500-$4,500 event" },
  { id: "interview-video", label: "Interview or testimonial video", category: "Videography", base: 900, unit: "project", service: "Videography", marketRange: "$750-$3,000 project" },
  { id: "music-video", label: "Music video capture", category: "Videography", base: 1500, unit: "project", service: "Videography", marketRange: "$1,000-$10,000+" },
  { id: "highlight-recap", label: "Event highlight recap", category: "Videography", base: 700, unit: "edit", service: "Videography", marketRange: "$400-$1,500 edit" },
  { id: "video-edit-only", label: "Video edit-only package", category: "Videography", base: 500, unit: "edit", service: "Videography", marketRange: "$75-$350/hr" },
  { id: "dj-set", label: "DJ event set", category: "Music and events", base: 750, unit: "booking", service: "DJ Services", marketRange: "$400-$1,800 booking" },
  { id: "beat-session", label: "Beat creation session", category: "Music and events", base: 500, unit: "session", service: "Beat Creation Session", marketRange: "$200-$1,500+ song" },
  { id: "audio-edit", label: "Audio edit or cleanup", category: "Music and events", base: 225, unit: "edit", service: "Beat Creation Session", marketRange: "$75-$200/hr" },
  { id: "sound-setup", label: "Sound setup support", category: "Music and events", base: 300, unit: "setup", service: "DJ Services", marketRange: "$150-$750 setup" },
  { id: "playlist-curation", label: "Playlist curation", category: "Music and events", base: 125, unit: "list", service: "DJ Services", marketRange: "$75-$250 list" },
  { id: "recording-session", label: "Recording session support", category: "Music and events", base: 350, unit: "session", service: "Beat Creation Session", marketRange: "$50-$200/hr" },
  { id: "mix-master", label: "Mixing or mastering pass", category: "Music and events", base: 350, unit: "track", service: "Beat Creation Session", marketRange: "$150-$1,000 track" },
  { id: "membership-page", label: "Membership page setup", category: "Web and tech", base: 850, unit: "page set", service: "Membership Sites & Support", marketRange: "$50-$250/hr" },
  { id: "site-maintenance", label: "Site maintenance block", category: "Web and tech", base: 300, unit: "month", service: "Membership Sites & Support", marketRange: "$35-$650/mo" },
  { id: "pc-support", label: "PC support visit", category: "Web and tech", base: 125, unit: "visit", service: "PC Tech Services", marketRange: "$79-$250 repair" },
  { id: "landing-page-build", label: "Landing page build", category: "Web and tech", base: 950, unit: "page", service: "Membership Sites & Support", marketRange: "$1,000-$5,000 site" },
  { id: "form-automation", label: "Form or automation setup", category: "Web and tech", base: 425, unit: "workflow", service: "Membership Sites & Support", marketRange: "$75-$200/hr" },
  { id: "analytics-setup", label: "Analytics or tracking setup", category: "Web and tech", base: 250, unit: "setup", service: "Membership Sites & Support", marketRange: "$150-$750 setup" },
  { id: "pc-tuneup", label: "PC tune-up and cleanup", category: "Web and tech", base: 150, unit: "device", service: "PC Tech Services", marketRange: "$89-$250 repair" },
  { id: "hardware-upgrade", label: "Hardware upgrade labor", category: "Web and tech", base: 175, unit: "device", service: "PC Tech Services", marketRange: "$59-$179 labor" },
  { id: "content-planning", label: "Creative planning call", category: "Planning", base: 125, unit: "call", service: "Photography", marketRange: "$75-$200/hr" },
  { id: "shot-list", label: "Shot list and production brief", category: "Planning", base: 175, unit: "brief", service: "Photography", marketRange: "$75-$200/hr" },
  { id: "content-calendar", label: "Content calendar setup", category: "Planning", base: 275, unit: "calendar", service: "Videography", marketRange: "$250-$1,000 plan" },
  { id: "brand-review", label: "Brand or campaign review", category: "Planning", base: 225, unit: "review", service: "Photography", marketRange: "$100-$250/hr" },
  { id: "production-roadmap", label: "Production roadmap", category: "Planning", base: 350, unit: "roadmap", service: "Videography", marketRange: "$300-$1,500 plan" },
  { id: "rush-edit", label: "Rush edit window", category: "Add-ons", base: 250, unit: "rush block", service: "Videography", marketRange: "15%-35% rush lift" },
  { id: "extra-revisions", label: "Revision pack", category: "Add-ons", base: 125, unit: "pack", service: "Videography", marketRange: "$75-$200/hr" },
  { id: "extra-location", label: "Extra location", category: "Add-ons", base: 150, unit: "location", service: "Photography", marketRange: "$75-$300 add-on" },
  { id: "same-day-teaser", label: "Same-day teaser delivery", category: "Add-ons", base: 300, unit: "teaser", service: "Videography", marketRange: "$250-$1,000 add-on" },
  { id: "raw-file-delivery", label: "Raw file delivery", category: "Add-ons", base: 200, unit: "handoff", service: "Videography", marketRange: "$100-$750 add-on" },
  { id: "usage-license-extension", label: "Usage license extension", category: "Add-ons", base: 350, unit: "license", service: "Photography", marketRange: "$250-$10,000 usage" },
  { id: "assistant-operator", label: "Assistant or second operator", category: "Add-ons", base: 450, unit: "day", service: "Videography", marketRange: "$300-$800 day" }
];

const mainServiceLanes = ["Photography", "Videography", "Music and events", "Web and tech", "Planning", "Add-ons"];
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

export function ServiceQuoteBuilder({ compact = false, dashboard = false, onApplyEstimate }) {
  const [selectedIds, setSelectedIds] = useState(["portrait-session"]);
  const [selectedLanes, setSelectedLanes] = useState(["Photography"]);
  const [usage, setUsage] = useState(usageOptions[1].label);
  const [timeline, setTimeline] = useState(timelineOptions[1].label);
  const [location, setLocation] = useState(locationOptions[0].label);
  const [market, setMarket] = useState(1);
  const [scope, setScope] = useState(2);
  const [complexity, setComplexity] = useState(2);
  const [deliverables, setDeliverables] = useState(2);
  const [hours, setHours] = useState(2);
  const [revisions, setRevisions] = useState(1);
  const [travelMiles, setTravelMiles] = useState(0);
  const [firstTimer, setFirstTimer] = useState(true);
  const [savedNotice, setSavedNotice] = useState("");

  const estimate = useMemo(() => {
    const safeSelectedIds = new Set(selectedIds.filter((id) => microServices.some((item) => item.id === id)));
    const selectedItems = microServices.filter((item) => safeSelectedIds.has(item.id));
    const safeSelectedLanes = selectedLanes.filter((lane) => mainServiceLanes.includes(lane));
    const usageOption = getOption(usageOptions, usage, 0);
    const timelineOption = getOption(timelineOptions, timeline, 1);
    const locationOption = getOption(locationOptions, location, 0);
    const marketOption = getMarketMode(market);
    const serviceBase = selectedItems.reduce((sum, item) => sum + item.base, 0);
    const setupBase = selectedItems.length ? serviceBase : 0;
    const scopeMultiplier = 1 + (clamp(scope, 0, 4) - 2) * 0.08;
    const complexityMultiplier = 1 + (clamp(complexity, 0, 4) - 2) * 0.1;
    const deliverableFee = selectedItems.length ? Math.max(0, deliverables - 1) * 45 : 0;
    const hourFee = selectedItems.length ? Math.max(0, hours - 2) * 65 : 0;
    const revisionFee = selectedItems.length ? Math.max(0, revisions - 1) * 55 : 0;
    const travelCharge = calculateTravelCharge(travelMiles, selectedItems.length > 0);
    const billableTravelMiles = travelCharge.billableMiles;
    const travelFee = travelCharge.fee;
    const serviceSubtotal = (setupBase + locationOption.fee + deliverableFee + hourFee + revisionFee) *
      scopeMultiplier *
      complexityMultiplier *
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

    return {
      selectedItems,
      summary,
      marketRate: serviceSubtotal,
      discount,
      serviceTotal,
      total,
      deposit,
      travelFee,
      billableTravelMiles,
      timelineDays: timelineOption.days,
      serviceName: primaryServiceName(selectedItems, safeSelectedLanes),
      budget: budgetLabel(total),
      details: [
        `Estimate generated from: ${summary}.`,
        `Main services: ${safeSelectedLanes.length ? safeSelectedLanes.join(", ") : "None selected"}.`,
        `Usage: ${usage}. Timeline: ${timeline}. Location: ${location}. Market: ${marketOption.label}.`,
        `Scope ${scope}/4, complexity ${complexity}/4, deliverables ${deliverables}, hours ${hours}, revisions ${revisions}.`,
        `Travel distance: ${travelCharge.safeMiles} miles; travel under ${includedTravelMiles} miles is included and ${billableTravelMiles} miles are an independent extra charge over the included ${includedTravelMiles}-mile window.`,
        firstTimer ? "First-time client discount included at 25%." : "No first-time discount included.",
        selectedItems.length
          ? "Once selected services are requested, a 50% deposit is warranted and required to confirm the request, scheduling seriousness, and production commitment."
          : "Deposit requirement applies after services are selected and requested."
      ].join(" ")
    };
  }, [selectedIds, usage, timeline, location, market, scope, complexity, deliverables, hours, revisions, travelMiles, firstTimer, selectedLanes]);

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
      budget: estimate.budget,
      timeline: estimate.timelineDays,
      details: estimate.details
    });
    setSavedNotice("Estimate copied into the service request form.");
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
              <strong>{selectedLanes.length ? "Selected main-service sub-services" : "Select a main service to show sub-services"}</strong>
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
            <span>{revisions}</span>
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
          <p className="quote-summary">{estimate.summary}</p>
          <p className="quote-disclaimer">
            Estimate only. Baselines use 2026 market-rate research for comparable U.S. creative,
            web, audio, DJ, and PC-support work. Final quote can change after schedule, venue,
            files, usage, travel, and delivery needs are reviewed. Travel under 30 miles is
            included; travel over 30 miles is an independent extra charge. Once selected services
            are requested, a 50% deposit is warranted and required to confirm seriousness and
            reserve production time.
          </p>
          <div className="quote-action-row">
            <button type="button" className="button" onClick={saveEstimate}>Save estimation</button>
            {dashboard && onApplyEstimate ? (
              <button type="button" className="button button-secondary" onClick={applyEstimate}>Apply to request</button>
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
