"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { businessLines } from "../lib/business-lines";
import { serviceCatalog } from "../lib/services";

const STORAGE_KEY = "bls-project-planner-v2";
const steps = ["Choose a service", "Shape the project", "Schedule", "Plan delivery", "Review"];
const budgetOptions = ["Not sure yet", "Under $500", "$500–$1,000", "$1,000–$2,500", "$2,500–$5,000", "$5,000+"];
const deliverableOptions = ["Photos", "Video", "Audio", "Website or software", "Consultation", "Event coverage", "Campaign assets", "Ongoing support"];
const platformOptions = ["Website", "Instagram", "TikTok", "YouTube", "Facebook", "LinkedIn", "Print", "Live event"];

const emptyDraft = {
  branch: "",
  services: [],
  projectName: "",
  goal: "",
  brief: "",
  audience: "",
  keyMessage: "",
  budget: "",
  budgetFlexible: false,
  timeline: "",
  launchDate: "",
  eventDate: "",
  dateFlexible: false,
  locationType: "",
  location: "",
  scheduleWindow: "",
  duration: "",
  deliverables: [],
  platforms: [],
  usage: "",
  fileFormats: "",
  visualStyle: "",
  references: [""],
  assetsReady: "",
  thirdPartyAssets: "",
  accessibility: "",
  rush: false,
  contactMethod: "",
  contactTime: "",
  timezone: "",
  organization: "",
  collaborators: "",
  purchaseOrder: "",
  serviceQuestion: "",
  savedAt: ""
};

function readDraft() {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const strings = Object.keys(emptyDraft).filter((key) => typeof emptyDraft[key] === "string");
    const normalized = { ...emptyDraft, ...value };
    strings.forEach((key) => {
      normalized[key] = typeof value[key] === "string" ? value[key].slice(0, key === "brief" ? 1800 : 600) : emptyDraft[key];
    });
    normalized.services = Array.isArray(value.services)
      ? value.services.filter((slug) => serviceCatalog.some((service) => service.slug === slug))
      : [];
    normalized.deliverables = Array.isArray(value.deliverables) ? value.deliverables.filter((item) => deliverableOptions.includes(item)) : [];
    normalized.platforms = Array.isArray(value.platforms) ? value.platforms.filter((item) => platformOptions.includes(item)) : [];
    normalized.references = Array.isArray(value.references)
      ? value.references.filter((item) => typeof item === "string").slice(0, 8).map((item) => item.slice(0, 500))
      : [""];
    ["budgetFlexible", "dateFlexible", "rush"].forEach((key) => {
      normalized[key] = typeof value[key] === "boolean" ? value[key] : emptyDraft[key];
    });
    return normalized;
  } catch {
    return null;
  }
}

function cleanText(value) {
  return String(value || "").trim();
}

function selectedServicesFor(draft) {
  const slugs = Array.isArray(draft?.services) ? draft.services : [];
  return serviceCatalog.filter((service) => slugs.includes(service.slug));
}

export function buildProjectBrief(draft = {}) {
  const services = selectedServicesFor(draft);
  const references = Array.isArray(draft.references) ? draft.references : [];
  const rows = [
    ["Project", draft.projectName],
    ["Branch", businessLines.find((line) => line.slug === draft.branch)?.name],
    ["Services", services.map((service) => service.name).join(", ")],
    ["Goal", draft.goal],
    ["Project details", draft.brief],
    ["Audience", draft.audience],
    ["Key message", draft.keyMessage],
    ["Budget", draft.budget ? `${draft.budget}${draft.budgetFlexible ? " (flexible)" : ""}` : ""],
    ["Timeline", draft.timeline],
    ["Target launch", draft.launchDate],
    ["Event date", draft.eventDate ? `${draft.eventDate}${draft.dateFlexible ? " (flexible)" : ""}` : ""],
    ["Location", [draft.locationType, draft.location].filter(Boolean).join(" — ")],
    ["Schedule window", draft.scheduleWindow],
    ["Estimated duration", draft.duration],
    ["Deliverables", (Array.isArray(draft.deliverables) ? draft.deliverables : []).join(", ")],
    ["Platforms", (Array.isArray(draft.platforms) ? draft.platforms : []).join(", ")],
    ["Usage", draft.usage],
    ["File formats", draft.fileFormats],
    ["Style direction", draft.visualStyle],
    ["References", references.map(cleanText).filter(Boolean).join("\n")],
    ["Existing assets", draft.assetsReady],
    ["Third-party assets or rights", draft.thirdPartyAssets],
    ["Accessibility needs", draft.accessibility],
    ["Rush timing", draft.rush ? "Please check whether a rush schedule is available." : ""],
    ["Preferred contact", [draft.contactMethod, draft.contactTime, draft.timezone].filter(Boolean).join("; ")],
    ["Organization", draft.organization],
    ["Collaborators", draft.collaborators],
    ["Purchase order or procurement notes", draft.purchaseOrder],
    ["Service-specific notes", draft.serviceQuestion]
  ].filter(([, value]) => cleanText(value));

  const fullBrief = `Black Lion Studios project brief\n\n${rows.map(([label, value]) => `${label}:\n${value}`).join("\n\n")}\n\nThis brief is a planning aid. Scope, pricing, and schedule require studio confirmation.`;
  if (fullBrief.length <= 1850) return fullBrief;
  return `${fullBrief.slice(0, 1680).trimEnd()}\n\nSome long notes were shortened to fit the 2,000-character request limit. Your complete planner draft is still saved in this browser.`;
}

function Field({ label, hint, children }) {
  return (
    <label className="planner-field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function ChoiceTiles({ label, options, selected, onToggle }) {
  return (
    <fieldset className="planner-choice-group">
      <legend>{label}</legend>
      <div className="planner-choice-grid">
        {options.map((option) => {
          const checked = selected.includes(option);
          return (
            <label className={`planner-choice${checked ? " is-selected" : ""}`} key={option}>
              <input type="checkbox" checked={checked} onChange={() => onToggle(option)} />
              <span>{option}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function ProjectPlanner() {
  const [draft, setDraft] = useState(emptyDraft);
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [restored, setRestored] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Loading draft…");
  const services = useMemo(() => selectedServicesFor(draft), [draft]);
  const availableServices = useMemo(() => serviceCatalog.filter((service) => {
    const chosenBranch = businessLines.find((line) => line.slug === draft.branch);
    const matchesBranch = !chosenBranch || chosenBranch.services.some((item) => item.slug === service.slug);
    const text = `${service.name} ${service.description} ${service.category || ""}`.toLowerCase();
    return matchesBranch && text.includes(query.trim().toLowerCase());
  }), [draft.branch, query]);
  const brief = useMemo(() => buildProjectBrief(draft), [draft]);
  const completedSteps = [
    Boolean(draft.branch && draft.services.length),
    Boolean(cleanText(draft.projectName) || cleanText(draft.goal) || cleanText(draft.brief)),
    Boolean(draft.launchDate || draft.eventDate || draft.timeline),
    Boolean(draft.deliverables.length || draft.platforms.length || draft.references.some(cleanText)),
    false
  ].filter(Boolean).length;
  const selectedBranch = businessLines.find((line) => line.slug === draft.branch);
  const serviceLabels = services.map((service) => service.name).join(", ");

  useEffect(() => {
    const saved = readDraft();
    if (saved) {
      setDraft(saved);
      setRestored(Object.keys(emptyDraft).some((key) => {
        if (key === "savedAt") return false;
        const value = saved[key];
        if (Array.isArray(value)) return value.some(Boolean);
        if (typeof value === "boolean") return value !== emptyDraft[key];
        return value !== emptyDraft[key] && Boolean(value);
      }));
    }
    const requestedService = new URLSearchParams(window.location.search).get("service");
    if (requestedService && serviceCatalog.some((service) => service.slug === requestedService)) {
      setDraft((current) => ({ ...current, services: [...new Set([...current.services, requestedService])] }));
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return undefined;
    setSaveStatus("Saving draft…");
    const timeout = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...draft, savedAt: new Date().toISOString() }));
        setSaveStatus("Saved on this device");
      } catch {
        setSaveStatus("Local save unavailable");
        setNotice("This browser could not save the draft locally. You can still copy or download your brief.");
      }
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [draft, hydrated]);

  function update(name, value) {
    setDraft((current) => ({ ...current, [name]: value }));
    setNotice("");
  }

  function toggleList(name, value) {
    setDraft((current) => ({
      ...current,
      [name]: current[name].includes(value)
        ? current[name].filter((item) => item !== value)
        : [...current[name], value]
    }));
  }

  function toggleService(slug) {
    setDraft((current) => ({
      ...current,
      services: current.services.includes(slug)
        ? current.services.filter((item) => item !== slug)
        : [...current.services, slug]
    }));
  }

  function setReference(index, value) {
    setDraft((current) => ({ ...current, references: current.references.map((item, itemIndex) => itemIndex === index ? value : item) }));
  }

  function addReference() {
    setDraft((current) => current.references.length >= 8 ? current : { ...current, references: [...current.references, ""] });
  }

  function removeReference(index) {
    setDraft((current) => ({ ...current, references: current.references.filter((_, itemIndex) => itemIndex !== index) }));
  }

  async function copyBrief() {
    try {
      await navigator.clipboard.writeText(brief);
      setNotice("Project brief copied. You can paste it into your request or save it for later.");
    } catch {
      setNotice("Clipboard access is unavailable. Use Download brief or Print brief instead.");
    }
  }

  function downloadBrief() {
    const blob = new Blob([brief], { type: "text/plain;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `${(draft.projectName || "black-lion-project-brief").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.txt`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
    setNotice("Your brief has been downloaded as a text file.");
  }

  function resetDraft() {
    setDraft(emptyDraft);
    setStep(0);
    setRestored(false);
    setNotice("Planner cleared. A new blank draft is ready.");
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Clearing the in-memory form remains available if storage is disabled.
    }
  }

  function continueToPortal() {
    if (!services.length) {
      setNotice("Choose at least one service before continuing to account setup.");
      setStep(0);
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...draft, savedAt: new Date().toISOString() }));
      window.location.assign(`/portal?service=${encodeURIComponent(services[0].slug)}&planner=1`);
    } catch {
      setSaveStatus("Local save unavailable");
      setNotice("This browser could not save the brief for account setup. Copy or download it before continuing.");
    }
  }

  function advanceStep() {
    if (step === 3 && !validateReferenceLinks()) return;
    setNotice("");
    setStep((current) => Math.min(steps.length - 1, current + 1));
  }

  function validateReferenceLinks() {
    const hasInvalidReference = draft.references.some((reference) => {
      const value = cleanText(reference);
      if (!value) return false;
      try {
        return !["http:", "https:"].includes(new URL(value).protocol);
      } catch {
        return true;
      }
    });
    if (hasInvalidReference) {
      setNotice("Check the reference links. Use a complete http:// or https:// address.");
      return false;
    }
    return true;
  }

  function jumpToStep(index) {
    if (step === 3 && index > step && !validateReferenceLinks()) return;
    setNotice("");
    setStep(index);
  }

  const stepsContent = [
    <div className="planner-step-content" key="service">
      <div className="planner-field-grid">
        <Field label="Studio branch" hint="Filter the service list by the team that best fits your project.">
          <select value={draft.branch} onChange={(event) => update("branch", event.target.value)}>
            <option value="">Any branch</option>
            {businessLines.map((line) => <option value={line.slug} key={line.slug}>{line.name}</option>)}
          </select>
        </Field>
        <Field label="Find a service" hint="Search by service or the kind of work you need.">
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try portraits, website, event…" />
        </Field>
      </div>
      {selectedBranch ? <p className="planner-branch-note"><strong>{selectedBranch.name}:</strong> {selectedBranch.summary}</p> : null}
      <div className="planner-service-list" aria-label="Available services">
        {availableServices.map((service) => {
          const selected = draft.services.includes(service.slug);
          return (
            <button type="button" className={`planner-service-card${selected ? " is-selected" : ""}`} key={service.slug} aria-pressed={selected} onClick={() => toggleService(service.slug)}>
              <span className="planner-service-check" aria-hidden="true">{selected ? "✓" : "+"}</span>
              <span className="planner-service-copy"><strong>{service.name}</strong><small>{service.priceLabel}</small><span>{service.description}</span></span>
            </button>
          );
        })}
        {!availableServices.length ? <p className="empty-state">No services match that search. Try another term or clear the branch filter.</p> : null}
      </div>
      {services.length ? (
        <div className="planner-selected-summary" aria-live="polite">
          <strong>Selected services</strong>
          <div className="planner-selected-services">
            {services.map((service) => <button type="button" key={service.slug} onClick={() => toggleService(service.slug)} aria-label={`Remove ${service.name}`}>{service.name}<span aria-hidden="true">×</span></button>)}
          </div>
        </div>
      ) : null}
      <Field label="What would you like this project to accomplish?">
        <select value={draft.goal} onChange={(event) => update("goal", event.target.value)}>
          <option value="">Choose a goal</option>
          <option>Launch a new idea</option><option>Promote a product, event, or service</option><option>Improve an existing project</option><option>Create content for an audience</option><option>Resolve a technical issue</option><option>Explore options with the studio</option>
        </select>
      </Field>
    </div>,
    <div className="planner-step-content" key="scope">
      <div className="planner-field-grid">
        <Field label="Project name"><input value={draft.projectName} onChange={(event) => update("projectName", event.target.value)} maxLength={100} placeholder="A short working title" /></Field>
        <Field label="Budget range" hint="This is planning context, not a quote.">
          <select value={draft.budget} onChange={(event) => update("budget", event.target.value)}><option value="">Choose a range</option>{budgetOptions.map((option) => <option key={option}>{option}</option>)}</select>
        </Field>
      </div>
      <label className="planner-inline-toggle"><input type="checkbox" checked={draft.budgetFlexible} onChange={(event) => update("budgetFlexible", event.target.checked)} /><span>There is room to adjust the budget for a better fit</span></label>
      <Field label="Project overview" hint={`${draft.brief.length}/1800 characters. Avoid passwords, payment details, or other sensitive information.`}>
        <textarea rows={5} maxLength={1800} value={draft.brief} onChange={(event) => update("brief", event.target.value)} placeholder="Describe what you want to make, improve, or solve." />
      </Field>
      <div className="planner-field-grid">
        <Field label="Who is this for?"><input value={draft.audience} onChange={(event) => update("audience", event.target.value)} maxLength={180} placeholder="Audience, customers, team, or community" /></Field>
        <Field label="Main message or outcome"><input value={draft.keyMessage} onChange={(event) => update("keyMessage", event.target.value)} maxLength={180} placeholder="What should people understand or do?" /></Field>
      </div>
      <Field label="Anything specific the studio should answer for this service?">
        <textarea rows={3} maxLength={600} value={draft.serviceQuestion} onChange={(event) => update("serviceQuestion", event.target.value)} placeholder="Optional question or constraint" />
      </Field>
    </div>,
    <div className="planner-step-content" key="schedule">
      <div className="planner-field-grid">
        <Field label="Preferred timeline"><select value={draft.timeline} onChange={(event) => update("timeline", event.target.value)}><option value="">Choose a timeline</option><option>Flexible</option><option>Within a month</option><option>Within two weeks</option><option>Within a week</option><option>Specific date</option></select></Field>
        <Field label="Target launch or completion date"><input type="date" value={draft.launchDate} onChange={(event) => update("launchDate", event.target.value)} min={new Date().toISOString().slice(0, 10)} /></Field>
        <Field label="Event or session date"><input type="date" value={draft.eventDate} onChange={(event) => update("eventDate", event.target.value)} min={new Date().toISOString().slice(0, 10)} /></Field>
        <Field label="Where will the work happen?"><select value={draft.locationType} onChange={(event) => update("locationType", event.target.value)}><option value="">Choose a location type</option><option>Remote or studio</option><option>Client location</option><option>Event venue</option><option>Multiple locations</option><option>Not decided</option></select></Field>
        <Field label="City, region, or venue"><input value={draft.location} onChange={(event) => update("location", event.target.value)} maxLength={180} placeholder="Approximate location is enough" /></Field>
        <Field label="Preferred schedule window"><input value={draft.scheduleWindow} onChange={(event) => update("scheduleWindow", event.target.value)} maxLength={120} placeholder="Weekdays, evenings, or a date range" /></Field>
        <Field label="Expected session or event duration"><input value={draft.duration} onChange={(event) => update("duration", event.target.value)} maxLength={80} placeholder="For example, 2–3 hours" /></Field>
        <Field label="Time zone"><input value={draft.timezone} onChange={(event) => update("timezone", event.target.value)} maxLength={80} placeholder="For example, Eastern Time" /></Field>
      </div>
      <label className="planner-inline-toggle"><input type="checkbox" checked={draft.dateFlexible} onChange={(event) => update("dateFlexible", event.target.checked)} /><span>The date can move if another time works better</span></label>
      <label className="planner-inline-toggle"><input type="checkbox" checked={draft.rush} onChange={(event) => update("rush", event.target.checked)} /><span>Ask whether a rush schedule is available</span></label>
      <p className="planner-inline-note">Dates are requests only. Availability and final scheduling are confirmed by the studio.</p>
    </div>,
    <div className="planner-step-content" key="delivery">
      <ChoiceTiles label="What would you like delivered?" options={deliverableOptions} selected={draft.deliverables} onToggle={(value) => toggleList("deliverables", value)} />
      <ChoiceTiles label="Where will it be used?" options={platformOptions} selected={draft.platforms} onToggle={(value) => toggleList("platforms", value)} />
      <div className="planner-field-grid">
        <Field label="Usage context"><select value={draft.usage} onChange={(event) => update("usage", event.target.value)}><option value="">Choose a usage context</option><option>Not decided</option><option>Personal or internal</option><option>Organic social content</option><option>Business marketing</option><option>Paid campaign or commercial</option></select></Field>
        <Field label="Preferred file formats"><input value={draft.fileFormats} onChange={(event) => update("fileFormats", event.target.value)} maxLength={160} placeholder="For example, MP4, PNG, web-ready files" /></Field>
        <Field label="Visual or creative direction"><select value={draft.visualStyle} onChange={(event) => update("visualStyle", event.target.value)}><option value="">Choose a direction or leave open</option><option>Open to direction</option><option>Clean and minimal</option><option>Bold and energetic</option><option>Editorial and polished</option><option>Documentary and natural</option><option>Technical and precise</option></select></Field>
        <Field label="Current asset status"><select value={draft.assetsReady} onChange={(event) => update("assetsReady", event.target.value)}><option value="">Choose an asset status</option><option>Assets are ready</option><option>Assets need to be created</option><option>Not sure yet</option></select></Field>
      </div>
      <div className="planner-reference-list">
        <div className="planner-reference-heading"><strong>Reference links</strong><button type="button" className="button button-secondary" onClick={addReference} disabled={draft.references.length >= 8}>Add link</button></div>
        {draft.references.map((reference, index) => (
          <div className="planner-reference-row" key={index}>
            <input type="url" maxLength={500} value={reference} onChange={(event) => setReference(index, event.target.value)} placeholder="https://…" aria-label={`Reference link ${index + 1}`} />
            {draft.references.length > 1 ? <button type="button" className="planner-icon-button" onClick={() => removeReference(index)} aria-label={`Remove reference ${index + 1}`}>×</button> : null}
          </div>
        ))}
      </div>
      <div className="planner-field-grid">
        <Field label="Third-party assets, music, or usage rights"><textarea rows={2} value={draft.thirdPartyAssets} onChange={(event) => update("thirdPartyAssets", event.target.value)} maxLength={500} placeholder="Mention any materials that need permission or licensing." /></Field>
        <Field label="Accessibility or accommodation needs"><textarea rows={2} value={draft.accessibility} onChange={(event) => update("accessibility", event.target.value)} maxLength={500} placeholder="Optional. Share only what helps plan the work." /></Field>
      </div>
    </div>,
    <div className="planner-step-content planner-review-step-content" key="review">
      <div className="planner-review-grid">
        <div>
          <p className="label">Your project snapshot</p>
          <h2>{cleanText(draft.projectName) || "Untitled project"}</h2>
          <p className="muted">{selectedBranch?.name || "Choose a branch"}{serviceLabels ? ` · ${serviceLabels}` : " · Choose one or more services"}</p>
          <pre className="planner-brief-preview">{brief}</pre>
        </div>
        <aside className="planner-review-aside">
          <strong>Request readiness</strong>
          <div className="planner-readiness"><span style={{ width: `${Math.round((completedSteps / 4) * 100)}%` }} /></div>
          <p>{completedSteps} of 4 planning sections have details. You can continue with an early draft.</p>
          <Link href="/services#service-estimation" className="button button-secondary">Open Service Estimation</Link>
          <Link href="/faq" className="button button-secondary">Read booking FAQ</Link>
        </aside>
      </div>
      <div className="planner-field-grid">
        <Field label="Preferred contact method"><select value={draft.contactMethod} onChange={(event) => update("contactMethod", event.target.value)}><option value="">Choose a contact method</option><option>Email</option><option>Phone</option><option>Text</option><option>Portal message</option></select></Field>
        <Field label="Best time to contact"><input value={draft.contactTime} onChange={(event) => update("contactTime", event.target.value)} maxLength={100} placeholder="Optional" /></Field>
        <Field label="Company or organization"><input value={draft.organization} onChange={(event) => update("organization", event.target.value)} maxLength={180} autoComplete="organization" /></Field>
        <Field label="People involved"><input value={draft.collaborators} onChange={(event) => update("collaborators", event.target.value)} maxLength={180} placeholder="Roles or team size; names are optional" /></Field>
        <Field label="Procurement or purchase order notes"><input value={draft.purchaseOrder} onChange={(event) => update("purchaseOrder", event.target.value)} maxLength={180} placeholder="Optional" /></Field>
      </div>
      <label className="planner-inline-toggle"><input type="checkbox" checked={draft.budgetFlexible} onChange={(event) => update("budgetFlexible", event.target.checked)} /><span>Allow the studio to suggest options within a nearby budget range</span></label>
    </div>
  ];

  return (
    <section className="planner-shell">
      <header className="panel planner-heading">
        <div>
          <p className="label">Studio project planner</p>
          <h1>Bring the project into focus.</h1>
          <p className="muted">Shape the scope at your own pace. Your draft stays in this browser until you clear it.</p>
        </div>
        <div className="planner-heading-actions">
          <span className="planner-save-state" role="status">{saveStatus}</span>
          <button type="button" className="button button-secondary" onClick={resetDraft}>Start over</button>
        </div>
      </header>

      <section className="panel planner-progress-panel" aria-label="Planner steps">
        <div className="planner-progress-meta"><span>Step {step + 1} of {steps.length}</span><span>{steps[step]}</span></div>
        <div className="planner-progress-track" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step + 1}><span style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
        <ol className="planner-step-list">
          {steps.map((title, index) => <li key={title}><button type="button" className={index === step ? "is-current" : index < step ? "is-complete" : ""} onClick={() => jumpToStep(index)} aria-current={index === step ? "step" : undefined}><span>{index < step ? "✓" : index + 1}</span>{title}</button></li>)}
        </ol>
      </section>

      {restored ? <p className="planner-restored-notice" role="status">Your saved planner draft was restored. It remains stored only in this browser.</p> : null}
      <section className="panel planner-form-panel">
        {stepsContent[step]}
        <div className="planner-navigation">
          <button type="button" className="button button-secondary" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}>Previous step</button>
          {step < steps.length - 1 ? <button type="button" className="button" onClick={advanceStep}>Continue</button> : <div className="planner-final-actions"><button type="button" className="button button-secondary" onClick={copyBrief}>Copy brief</button><button type="button" className="button button-secondary" onClick={downloadBrief}>Download brief</button><button type="button" className="button button-secondary" onClick={() => window.print()}>Print brief</button><button type="button" className="button" onClick={continueToPortal}>Continue to account setup</button></div>}
        </div>
      </section>
      {notice ? <p className="planner-notice" role="status" aria-live="polite">{notice}</p> : null}
      <p className="planner-privacy-note">The planner does not submit information to Black Lion Studios. Do not enter passwords, payment details, or sensitive personal information. Continue to the account portal to create an account and send a request.</p>
    </section>
  );
}
