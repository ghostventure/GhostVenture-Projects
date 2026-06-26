"use client";

import { useEffect, useMemo, useState } from "react";
import { notifyAuthStateChange } from "../lib/auth-events";
import { storeClientSessionToken } from "../lib/client-session";

const projectTypeOptions = [
  "Photography",
  "Videography",
  "Music video",
  "Brand campaign",
  "Editorial",
  "Product or merch",
  "Event promo",
  "Casting pool"
];

const modelingInterestOptions = [
  "Fashion",
  "Portrait",
  "Lifestyle",
  "Commercial",
  "Product or merch",
  "Editorial",
  "Fitness",
  "Music video",
  "Event promo",
  "Beauty or grooming",
  "Streetwear",
  "Brand campaign"
];

const initialDraft = {
  legalName: "",
  displayName: "",
  username: "",
  email: "",
  password: "",
  phone: "",
  city: "",
  dateOfBirth: "",
  pronouns: "",
  height: "",
  clothingSizes: "",
  hairColor: "",
  eyeColor: "",
  tattoosPiercings: "",
  ageConfirmation: false,
  projectTypes: [],
  modelingInterests: [],
  availability: "",
  portfolioUrl: "",
  instagram: "",
  otherSocials: "",
  experience: "",
  relevantSkills: "",
  travelReadiness: "",
  compensationExpectation: "",
  usageComfort: "",
  wardrobeComfort: "",
  productionPace: "",
  qualityStandards: "",
  reliabilityExamples: "",
  preparationProcess: "",
  contractReadiness: false,
  independentContractorDisclosure: false,
  reapplicationPolicy: false,
  noShowPolicy: false,
  legalPolicyAcceptance: false,
  notes: "",
  consentToContact: false
};

const instanceStorageKey = "bls-model-signup-active-instance";
const instanceChannelName = "bls-model-signup-instance";
const instanceTtlMs = 9000;
const modelSignupIdleCloseMs = 20 * 60 * 1000;
const draftStorageKey = "bls-model-signup-draft";
const draftSchemaVersion = 1;

function sanitizeStoredDraft(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return initialDraft;
  }

  return {
    ...initialDraft,
    ...Object.fromEntries(
      Object.keys(initialDraft)
        .filter((key) => key !== "password" && Object.hasOwn(value, key))
        .map((key) => [key, value[key]])
    ),
    password: ""
  };
}

export function ModelApplicationForm() {
  const instanceId = useMemo(
    () => `model-signup-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    []
  );
  const [draft, setDraft] = useState(initialDraft);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState("neutral");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasOtherInstance, setHasOtherInstance] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const stored = JSON.parse(window.localStorage.getItem(draftStorageKey) || "null");
      if (stored?.schemaVersion === draftSchemaVersion && stored?.draft) {
        setDraft(sanitizeStoredDraft(stored.draft));
        setNotice("Saved model signup details restored. Re-enter the password before submitting.");
        setNoticeTone("neutral");
      }
    } catch {
      window.localStorage.removeItem(draftStorageKey);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const draftForStorage = { ...draft, password: "" };
    try {
      window.localStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          schemaVersion: draftSchemaVersion,
          updatedAt: new Date().toISOString(),
          draft: draftForStorage
        })
      );
    } catch {
      // Draft retention is best-effort. Submission remains server-backed.
    }
  }, [draft]);

  useEffect(() => {
    let channel = null;

    function readActiveInstance() {
      try {
        return JSON.parse(window.localStorage.getItem(instanceStorageKey) || "null");
      } catch {
        return null;
      }
    }

    function writeActiveInstance() {
      const active = readActiveInstance();
      const activeIsFresh = active?.id && active.id !== instanceId && Date.now() - Number(active.updatedAt || 0) < instanceTtlMs;
      setHasOtherInstance(Boolean(activeIsFresh));
      window.localStorage.setItem(
        instanceStorageKey,
        JSON.stringify({
          id: instanceId,
          updatedAt: Date.now()
        })
      );
      channel?.postMessage({ type: "active", id: instanceId, updatedAt: Date.now() });
    }

    function handleStorage(event) {
      if (event.key !== instanceStorageKey || !event.newValue) {
        return;
      }

      try {
        const active = JSON.parse(event.newValue);
        setHasOtherInstance(active.id !== instanceId && Date.now() - Number(active.updatedAt || 0) < instanceTtlMs);
      } catch {
        setHasOtherInstance(false);
      }
    }

    if (typeof window === "undefined") {
      return undefined;
    }

    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel(instanceChannelName);
      channel.onmessage = (event) => {
        if (event.data?.type === "active" && event.data.id !== instanceId) {
          setHasOtherInstance(Date.now() - Number(event.data.updatedAt || 0) < instanceTtlMs);
        }
      };
    }

    writeActiveInstance();
    window.addEventListener("storage", handleStorage);
    const intervalId = window.setInterval(writeActiveInstance, 3000);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("storage", handleStorage);
      const active = readActiveInstance();
      if (active?.id === instanceId) {
        window.localStorage.removeItem(instanceStorageKey);
      }
      channel?.close();
    };
  }, [instanceId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    let closeTimerId = null;

    function closeInactivePage() {
      window.close();
      window.setTimeout(() => {
        if (!window.closed) {
          window.location.replace("/");
        }
      }, 250);
    }

    function resetCloseTimer() {
      if (closeTimerId) {
        window.clearTimeout(closeTimerId);
      }

      closeTimerId = window.setTimeout(closeInactivePage, modelSignupIdleCloseMs);
    }

    const activityEvents = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "touchmove", "pointerdown", "input"];
    resetCloseTimer();
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, resetCloseTimer, { passive: true });
    });

    return () => {
      if (closeTimerId) {
        window.clearTimeout(closeTimerId);
      }
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, resetCloseTimer);
      });
    };
  }, []);

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function toggleProjectType(projectType) {
    setDraft((current) => {
      const exists = current.projectTypes.includes(projectType);
      return {
        ...current,
        projectTypes: exists
          ? current.projectTypes.filter((item) => item !== projectType)
          : [...current.projectTypes, projectType]
      };
    });
  }

  function toggleModelingInterest(interest) {
    setDraft((current) => {
      const exists = current.modelingInterests.includes(interest);
      return {
        ...current,
        modelingInterests: exists
          ? current.modelingInterests.filter((item) => item !== interest)
          : [...current.modelingInterests, interest]
      };
    });
  }

  async function submit(event) {
    event.preventDefault();
    setNotice("");
    setNoticeTone("neutral");

    if (hasOtherInstance) {
      setNotice("another instance of this is open");
      setNoticeTone("error");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/model-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft)
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "Application could not be submitted.");
      }

      if (result.sessionToken) {
        storeClientSessionToken(result.sessionToken);
        notifyAuthStateChange("signed-in");
      }

      window.localStorage.removeItem(draftStorageKey);
      setDraft(initialDraft);
      setNotice(result.message || "Application received.");
      setNoticeTone("success");
      window.location.assign("/profile?model=application");
    } catch (error) {
      setNotice(error.message || "Application could not be submitted.");
      setNoticeTone("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="model-application-form" onSubmit={submit}>
      <section className="model-form-section">
        <div className="ui-form-section-head">
          <strong>Basic information</strong>
          <p className="ui-form-hint">Use legal details for contracting and public details for creative review.</p>
        </div>
      <div className="quick-quote-grid">
        <label>
          Legal name
          <input value={draft.legalName} onChange={(event) => update("legalName", event.target.value)} autoComplete="name" />
        </label>
        <label>
          Public or stage name
          <input value={draft.displayName} onChange={(event) => update("displayName", event.target.value)} />
        </label>
        <label>
          Username
          <input value={draft.username} onChange={(event) => update("username", event.target.value)} autoComplete="username" placeholder="model-name" />
        </label>
        <label>
          Email
          <input type="email" value={draft.email} onChange={(event) => update("email", event.target.value)} autoComplete="email" />
        </label>
        <label>
          Password
          <input type="password" minLength={8} value={draft.password} onChange={(event) => update("password", event.target.value)} autoComplete="new-password" />
        </label>
        <label>
          Phone
          <input type="tel" value={draft.phone} onChange={(event) => update("phone", event.target.value)} autoComplete="tel" />
        </label>
        <label>
          City or service area
          <input value={draft.city} onChange={(event) => update("city", event.target.value)} placeholder="Atlanta, remote, travel radius" />
        </label>
        <label>
          Date of birth
          <input type="date" value={draft.dateOfBirth} onChange={(event) => update("dateOfBirth", event.target.value)} />
        </label>
        <label>
          Pronouns
          <input value={draft.pronouns} onChange={(event) => update("pronouns", event.target.value)} placeholder="Optional" />
        </label>
      </div>
      </section>

      <section className="model-form-section">
        <div className="ui-form-section-head">
          <strong>Profile details</strong>
          <p className="ui-form-hint">These help match models to styling, wardrobe, continuity, and production needs.</p>
        </div>
        <div className="quick-quote-grid">
        <label>
          Height
          <input value={draft.height} onChange={(event) => update("height", event.target.value)} placeholder="5'8&quot;, 173 cm, etc." />
        </label>
        <label>
          Clothing sizes
          <input value={draft.clothingSizes} onChange={(event) => update("clothingSizes", event.target.value)} placeholder="Shirt, pants, dress, shoe, or relevant sizing" />
        </label>
        <label>
          Hair color
          <input value={draft.hairColor} onChange={(event) => update("hairColor", event.target.value)} />
        </label>
        <label>
          Eye color
          <input value={draft.eyeColor} onChange={(event) => update("eyeColor", event.target.value)} />
        </label>
        </div>
        <label>
          Tattoos, piercings, or visible marks
          <textarea
            value={draft.tattoosPiercings}
            onChange={(event) => update("tattoosPiercings", event.target.value)}
            rows={3}
            placeholder="Mention visible tattoos, piercings, scars, or styling considerations if relevant."
          />
        </label>
      </section>

      <section className="model-form-section">
        <div className="ui-form-section-head">
          <strong>Portfolio and public links</strong>
          <p className="ui-form-hint">Send links the studio can review without attachments.</p>
        </div>
        <div className="quick-quote-grid">
        <label>
          Portfolio link
          <input type="url" value={draft.portfolioUrl} onChange={(event) => update("portfolioUrl", event.target.value)} placeholder="https://..." />
        </label>
        <label>
          Instagram
          <input value={draft.instagram} onChange={(event) => update("instagram", event.target.value)} placeholder="@name" />
        </label>
        <label>
          Other social links
          <input value={draft.otherSocials} onChange={(event) => update("otherSocials", event.target.value)} placeholder="TikTok, YouTube, website, agency profile" />
        </label>
      </div>
      </section>

      <section className="model-form-section">
        <div className="ui-form-section-head">
          <strong>Project fit</strong>
          <p className="ui-form-hint">Choose the types of work you want to be considered for.</p>
        </div>
      <fieldset className="model-project-fieldset">
        <legend>Project interests</legend>
        <div className="model-project-grid">
          {projectTypeOptions.map((projectType) => (
            <label className="checkbox-row model-project-option" key={projectType}>
              <input
                type="checkbox"
                checked={draft.projectTypes.includes(projectType)}
                onChange={() => toggleProjectType(projectType)}
              />
              <span>{projectType}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="model-project-fieldset">
        <legend>Modeling interests</legend>
        <div className="model-project-grid">
          {modelingInterestOptions.map((interest) => (
            <label className="checkbox-row model-project-option" key={interest}>
              <input
                type="checkbox"
                checked={draft.modelingInterests.includes(interest)}
                onChange={() => toggleModelingInterest(interest)}
              />
              <span>{interest}</span>
            </label>
          ))}
        </div>
      </fieldset>
      </section>

      <section className="model-form-section">
        <div className="ui-form-section-head">
          <strong>Scheduling and job terms</strong>
          <p className="ui-form-hint">These secondary items help avoid mismatches before a project is offered.</p>
        </div>
      <label>
        Availability
        <textarea
          value={draft.availability}
          onChange={(event) => update("availability", event.target.value)}
          rows={4}
          placeholder="Typical availability, blackout dates, travel limits, and preferred notice."
        />
      </label>
      <label>
        Travel readiness
        <textarea
          value={draft.travelReadiness}
          onChange={(event) => update("travelReadiness", event.target.value)}
          rows={3}
          placeholder="Local only, willing to travel, transportation needs, mileage range, or lodging requirements."
        />
      </label>
      <label>
        Compensation expectation
        <textarea
          value={draft.compensationExpectation}
          onChange={(event) => update("compensationExpectation", event.target.value)}
          rows={3}
          placeholder="Hourly/day rate, trade-for-portfolio openness, minimum fee, or case-by-case preference."
        />
      </label>
      <label>
        Usage comfort
        <textarea
          value={draft.usageComfort}
          onChange={(event) => update("usageComfort", event.target.value)}
          rows={3}
          placeholder="Commercial, social, editorial, music video, paid ads, portfolio, or any usage limits to discuss."
        />
      </label>
      <label>
        Wardrobe or styling comfort
        <textarea
          value={draft.wardrobeComfort}
          onChange={(event) => update("wardrobeComfort", event.target.value)}
          rows={3}
          placeholder="Wardrobe boundaries, glam needs, hair/makeup comfort, modesty limits, or styling categories."
        />
      </label>
      <label>
        Fast-production readiness
        <textarea
          value={draft.productionPace}
          onChange={(event) => update("productionPace", event.target.value)}
          rows={3}
          placeholder="Explain how you handle short call times, fast direction changes, quick resets, and tight production windows."
        />
      </label>
      <label>
        Quality standards
        <textarea
          value={draft.qualityStandards}
          onChange={(event) => update("qualityStandards", event.target.value)}
          rows={3}
          placeholder="Describe what professional quality means to you on set, in communication, and in final usage."
        />
      </label>
      <label>
        Reliability examples
        <textarea
          value={draft.reliabilityExamples}
          onChange={(event) => update("reliabilityExamples", event.target.value)}
          rows={4}
          placeholder="Share examples of punctuality, completing prior jobs, handling schedule changes, or staying production-ready."
        />
      </label>
      <label>
        Preparation process
        <textarea
          value={draft.preparationProcess}
          onChange={(event) => update("preparationProcess", event.target.value)}
          rows={4}
          placeholder="How do you prepare before a shoot: wardrobe, grooming, references, travel planning, sleep, call sheet review, or communication?"
        />
      </label>
      </section>

      <section className="model-form-section">
        <div className="ui-form-section-head">
          <strong>Experience and notes</strong>
          <p className="ui-form-hint">Add the context that would help BLS cast you responsibly.</p>
        </div>
      <label>
        Experience and fit
        <textarea
          value={draft.experience}
          onChange={(event) => update("experience", event.target.value)}
          rows={6}
          placeholder="Share relevant modeling, content, performance, brand, or on-camera experience."
        />
      </label>
      <label>
        Relevant skills
        <textarea
          value={draft.relevantSkills}
          onChange={(event) => update("relevantSkills", event.target.value)}
          rows={4}
          placeholder="Dance, acting, athletic work, posing, public speaking, instruments, driving, product demos, or special talents."
        />
      </label>

      <label>
        Additional notes
        <textarea
          value={draft.notes}
          onChange={(event) => update("notes", event.target.value)}
          rows={4}
          placeholder="Usage limits, wardrobe notes, collaboration preferences, or questions."
        />
      </label>
      </section>

      <div className="model-consent-stack">
        {hasOtherInstance ? (
          <p className="message model-application-message error" role="alert">
            another instance of this is open
          </p>
        ) : null}
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={draft.ageConfirmation}
            onChange={(event) => update("ageConfirmation", event.target.checked)}
          />
          <span>I confirm I am at least 18 years old.</span>
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={draft.contractReadiness}
            onChange={(event) => update("contractReadiness", event.target.checked)}
          />
          <span>I can review and sign project paperwork before booking, including compensation, release, and usage terms.</span>
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={draft.independentContractorDisclosure}
            onChange={(event) => update("independentContractorDisclosure", event.target.checked)}
          />
          <span>I understand model projects are offered as 1099 independent-contractor opportunities, not full-time W-2 employment, and no payroll withholding, employee benefits, or guaranteed hours are promised unless a separate written agreement says otherwise.</span>
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={draft.reapplicationPolicy}
            onChange={(event) => update("reapplicationPolicy", event.target.checked)}
          />
          <span>I understand I can submit a model application once every 3 months.</span>
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={draft.noShowPolicy}
            onChange={(event) => update("noShowPolicy", event.target.checked)}
          />
          <span>I understand that missing a confirmed call time, booking, or production check-in may lower my priority for future opportunities.</span>
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={draft.legalPolicyAcceptance}
            onChange={(event) => update("legalPolicyAcceptance", event.target.checked)}
          />
          <span>I agree to the Terms of Use and Privacy Policy, including model profile review, contact, retention, usage-rights, and copyright-material rules.</span>
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={draft.consentToContact}
            onChange={(event) => update("consentToContact", event.target.checked)}
          />
          <span>I consent to be contacted by Black Lion Studios about modeling opportunities and project terms.</span>
        </label>
      </div>

      {notice ? <p className={`message model-application-message ${noticeTone}`.trim()}>{notice}</p> : null}

      <div className="quick-quote-actions">
        <button type="submit" className="button" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit application"}
        </button>
      </div>
    </form>
  );
}
