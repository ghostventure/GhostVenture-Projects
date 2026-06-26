"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClientNav } from "./client-nav";
import { authenticatedFetch } from "../lib/client-session";
import { trackEvent } from "../lib/client-analytics";
import { postJson } from "../lib/client-api";
import { serviceOptions } from "../lib/services";
import {
  DetailPairGrid,
  FormHint,
  FormSectionCard,
  ShortcutRail,
  SpotlightCard,
  SupportNotice,
  SurfaceGrid,
  ValueCardGrid
} from "./shared-ui";

const emptyState = { user: null, requests: [], messageCount: 0 };

const modelProfileFieldDefinitions = [
  { key: "modelLegalName", label: "Legal name", type: "text", section: "Identity" },
  { key: "modelDisplayName", label: "Public or stage name", type: "text", section: "Identity" },
  { key: "dateOfBirth", label: "Date of birth", type: "date", section: "Identity" },
  { key: "height", label: "Height", type: "text", section: "Profile details" },
  { key: "clothingSizes", label: "Clothing sizes", type: "text", section: "Profile details" },
  { key: "hairColor", label: "Hair color", type: "text", section: "Profile details" },
  { key: "eyeColor", label: "Eye color", type: "text", section: "Profile details" },
  { key: "tattoosPiercings", label: "Tattoos, piercings, or visible marks", type: "textarea", rows: 3, section: "Profile details" },
  { key: "projectTypes", label: "Project interests", type: "textarea", rows: 3, section: "Casting" },
  { key: "modelingInterests", label: "Preferred modeling interests", type: "textarea", rows: 3, section: "Casting" },
  { key: "availability", label: "Availability", type: "textarea", rows: 4, section: "Scheduling" },
  { key: "portfolioUrl", label: "Portfolio link", type: "url", section: "Portfolio" },
  { key: "otherSocials", label: "Other social links", type: "textarea", rows: 3, section: "Portfolio" },
  { key: "experience", label: "Experience and fit", type: "textarea", rows: 5, section: "Casting" },
  { key: "relevantSkills", label: "Relevant skills", type: "textarea", rows: 4, section: "Casting" },
  { key: "travelReadiness", label: "Travel readiness", type: "textarea", rows: 3, section: "Scheduling" },
  { key: "compensationExpectation", label: "Compensation expectation", type: "textarea", rows: 3, section: "Terms" },
  { key: "usageComfort", label: "Usage comfort", type: "textarea", rows: 3, section: "Terms" },
  { key: "wardrobeComfort", label: "Wardrobe or styling comfort", type: "textarea", rows: 3, section: "Terms" },
  { key: "productionPace", label: "Fast-production readiness", type: "textarea", rows: 3, section: "Scrutiny" },
  { key: "qualityStandards", label: "Quality standards", type: "textarea", rows: 3, section: "Scrutiny" },
  { key: "reliabilityExamples", label: "Reliability examples", type: "textarea", rows: 4, section: "Scrutiny" },
  { key: "preparationProcess", label: "Preparation process", type: "textarea", rows: 4, section: "Scrutiny" }
];

function getModelProfileFieldGroups() {
  return modelProfileFieldDefinitions.reduce((groups, field) => {
    if (!groups[field.section]) {
      groups[field.section] = [];
    }

    groups[field.section].push(field);
    return groups;
  }, {});
}

function formatProfileFields(fields) {
  const entries = Object.entries(fields || {});
  if (!entries.length) {
    return "";
  }

  return entries.map(([key, value]) => `${key}: ${value}`).join("\n");
}

function parseProfileFields(value) {
  return String(value || "")
    .split("\n")
    .map((line) => line.split(":"))
    .map(([key, ...rest]) => [String(key || "").trim(), rest.join(":").trim()])
    .filter(([key, fieldValue]) => key && fieldValue)
    .reduce((fields, [key, fieldValue]) => ({ ...fields, [key]: fieldValue }), {});
}

function collectModelProfileFields(formData) {
  return modelProfileFieldDefinitions.reduce((fields, field) => {
    const value = String(formData.get(`modelProfile.${field.key}`) || "").trim();
    if (value) {
      fields[field.key] = value;
    }
    return fields;
  }, {});
}

function countFilled(values) {
  return values.filter((value) => {
    if (typeof value === "boolean") {
      return value;
    }

    return Boolean(String(value || "").trim());
  }).length;
}

function buildProfileInsights(user, requests = [], messageCount = 0) {
  const profileFields = [
    user?.fullName,
    user?.email,
    user?.phone,
    user?.serviceInterest,
    user?.preferredContactMethod,
    user?.timezone,
    user?.projectGoals,
    user?.billingName,
    user?.billingEmail,
    user?.billingAddress,
    user?.preferredPaymentMethod,
    user?.shippingName,
    user?.shippingAddress
  ];
  const contactReady = countFilled([user?.email, user?.phone, user?.preferredContactMethod]);
  const billingReady = countFilled([
    user?.billingName,
    user?.billingEmail,
    user?.billingAddress,
    user?.preferredPaymentMethod
  ]);
  const deliveryReady = countFilled([
    user?.shippingName,
    user?.shippingAddress,
    user?.shippingCity,
    user?.shippingRegion,
    user?.shippingPostalCode,
    user?.shippingCountry
  ]);
  const profilePercent = Math.round((countFilled(profileFields) / profileFields.length) * 100);

  return {
    profilePercent,
    contactReady,
    billingReady,
    deliveryReady,
    requestCount: requests.length,
    messageCount
  };
}

export function ProfileApp({ initialState = null }) {
  const router = useRouter();
  const [state, setState] = useState(initialState || emptyState);
  const [loading, setLoading] = useState(!initialState);
  const [profileMessage, setProfileMessage] = useState("");

  useEffect(() => {
    if (initialState) {
      return;
    }

    async function loadSession() {
      try {
        const [response, messagesResponse] = await Promise.all([
          authenticatedFetch("/api/me", { cache: "no-store" }),
          authenticatedFetch("/api/messages", { cache: "no-store" })
        ]);
        if (!response.ok || !messagesResponse.ok) {
          router.replace("/");
          return;
        }

        const data = await response.json();
        const messagesData = await messagesResponse.json();
        setState({ ...data, messageCount: (messagesData.messages || []).length });
      } catch {
        router.replace("/");
      } finally {
        setLoading(false);
      }
    }

    loadSession();
  }, [initialState, router]);

  async function handleProfileUpdate(event) {
    event.preventDefault();
    setProfileMessage("");

    try {
      const formData = new FormData(event.currentTarget);
      const payload = Object.fromEntries(formData.entries());
      payload.notificationOptIn = formData.get("notificationOptIn") ? "true" : "false";
      payload.marketingOptIn = formData.get("marketingOptIn") ? "true" : "false";
      payload.profileFields = {
        ...parseProfileFields(payload.profileFields),
        ...collectModelProfileFields(formData)
      };
      modelProfileFieldDefinitions.forEach((field) => {
        delete payload[`modelProfile.${field.key}`];
      });
      const data = await postJson("/api/profile", payload);
      setState((current) => ({ ...current, user: data.user }));
      setProfileMessage("Profile updated.");
      trackEvent("profile_updated", { service: payload.serviceInterest });
      toast.success("Profile updated");
    } catch (error) {
      setProfileMessage(error.message);
      toast.error(error.message);
    }
  }

  if (loading) {
    return (
      <div className="page-shell">
        <section className="panel">
          <h2>Loading profile...</h2>
        </section>
      </div>
    );
  }

  const insights = buildProfileInsights(state.user, state.requests, state.messageCount);
  const isModelProfile = state.user?.roles?.includes("model") || state.user?.userType === "Model";
  const profileKind = isModelProfile ? "Model" : "Client";
  const modelProfileFieldGroups = getModelProfileFieldGroups();
  const modelProfileSummary = isModelProfile
    ? [
        { label: "Queue", value: state.user?.profileFields?.modelQueueStatus || "Standard" },
        { label: "No-shows", value: state.user?.profileFields?.modelNoShowCount || "0" },
        { label: "Reapply", value: state.user?.profileFields?.modelReapplicationWindow || "90 days" },
        { label: "Tax", value: "1099 project work" },
        { label: "Instagram", value: state.user?.instagram || state.user?.profileFields?.instagram || "Not set" }
      ]
    : [];
  const readinessItems = [
    {
      label: "Contact",
      value: `${insights.contactReady}/3`,
      note: insights.contactReady === 3 ? "Ready for follow-up" : "Add phone or preferred contact"
    },
    {
      label: "Billing",
      value: `${insights.billingReady}/4`,
      note: insights.billingReady === 4 ? "Ready for invoices" : "Add invoice details"
    },
    {
      label: "Delivery",
      value: `${insights.deliveryReady}/6`,
      note: insights.deliveryReady === 6 ? "Ready for shipping" : "Add shipping details if needed"
    }
  ];
  const profileSummary = [
    { label: "Email", value: state.user?.email || "Not set" },
    { label: "Service", value: state.user?.serviceInterest || "Not selected" },
    { label: "Contact", value: state.user?.preferredContactMethod || "Email" },
    { label: "Billing email", value: state.user?.billingEmail || state.user?.email || "Not set" },
    { label: `${profileKind} type`, value: state.user?.userType || (isModelProfile ? "Model" : "Individual") },
    { label: "Timezone", value: state.user?.timezone || "America/New_York" }
  ];
  const profileActions = [
    { href: isModelProfile ? "/models" : "/dashboard", label: isModelProfile ? "Models" : "Dashboard", value: isModelProfile ? "Application details" : "Requests and invoices", note: isModelProfile ? "Review the application path" : "Return to status and billing" },
    { href: "/messages", label: "Messages", value: "Studio conversation", note: "Ask questions or follow up" }
  ];

  return (
    <div className="page-shell">
      <ClientNav
        userName={state.user?.fullName || profileKind}
        isBookingManager={Boolean(state.user?.isBookingManager)}
      />

      <main className="stack">
        <section
          className="panel workspace-hero"
          style={{ backgroundImage: "url('/ai/digital-support.png')" }}
        >
          <p className="label">Profile</p>
          <h1 className="editorial-heading">{state.user?.fullName || profileKind}</h1>
          <p>
            {isModelProfile
              ? "Keep the PII, portfolio, contact, and production-readiness details Black Lion Studios uses for model review and follow-up in one place."
              : "Keep the details Black Lion Studios uses for service requests, invoices, shipping, scheduling, and follow-up in one place."}
          </p>
          <ValueCardGrid
            className="ui-value-card-overlay"
            items={[
              { label: "Profile", value: `${insights.profilePercent}%`, note: "Ready for work and billing" },
              { label: "Requests", value: insights.requestCount, note: "Service requests you have sent" },
              { label: "Messages", value: insights.messageCount, note: "Questions and replies with the studio" }
            ]}
          />
        </section>

        <section className="two-column">
          <SpotlightCard
            className="panel highlight-panel"
            eyebrow={`${profileKind} snapshot`}
            title="The details the studio will use first."
            copy={isModelProfile ? "This is the quick read before casting review, follow-up, and PII updates." : "This is the quick read before scheduling, invoicing, shipping, or replying."}
          >
            <DetailPairGrid className="detail-grid" items={profileSummary} />
          </SpotlightCard>
          <div className="panel">
            <p className="label">Readiness</p>
            <h2 className="editorial-heading">{profileKind} checklist</h2>
            <SurfaceGrid className="stack-small">
              {readinessItems.map((item) => (
                <div className="select-card" key={item.label}>
                  <strong>{item.label}</strong>
                  <span>{item.value}</span>
                  <span className="muted">{item.note}</span>
                </div>
              ))}
            </SurfaceGrid>
            {isModelProfile ? <DetailPairGrid className="detail-grid" items={modelProfileSummary} /> : null}
          </div>
        </section>

        <section className="panel profile-editor-panel">
          <p className="label">Account details</p>
          <h2 className="editorial-heading">Update the {profileKind.toLowerCase()} profile.</h2>
          <SupportNotice
            title={isModelProfile ? "Comprehensive model profile" : "Consolidated profile"}
            copy={isModelProfile ? "Model identity, PII, portfolio links, availability, contract terms, speed, quality, and reliability details stay separate from client profiles." : "Contact, service preferences, billing, shipping, links, and extra details are grouped by how the studio uses them."}
          />
          <form className="form active" onSubmit={handleProfileUpdate}>
            <FormSectionCard title="Contact and account" copy="The basics for identity, replies, and scheduling.">
              <label>
                Full name
                <input name="fullName" type="text" defaultValue={state.user?.fullName || ""} required />
              </label>
              <label>
                Username
                <input name="username" type="text" defaultValue={state.user?.username || ""} autoComplete="username" />
              </label>
              <label>
                Company
                <input name="company" type="text" defaultValue={state.user?.company || ""} />
              </label>
              <label>
                Phone
                <input name="phone" type="tel" defaultValue={state.user?.phone || ""} />
              </label>
              <label>
                Preferred contact
                <select name="preferredContactMethod" defaultValue={state.user?.preferredContactMethod || "Email"}>
                  <option>Email</option>
                  <option>Phone</option>
                  <option>Text</option>
                  <option>Portal Message</option>
                </select>
              </label>
              <label>
                Account type
                <select name="userType" defaultValue={state.user?.userType || "Individual"}>
                  <option>Individual</option>
                  <option>Business</option>
                  <option>Organization</option>
                <option>Creator</option>
                <option>Model</option>
              </select>
            </label>
              <label>
                Pronouns
                <input name="pronouns" type="text" defaultValue={state.user?.pronouns || ""} />
              </label>
              <label>
                Preferred language
                <input name="preferredLanguage" type="text" defaultValue={state.user?.preferredLanguage || "English"} />
              </label>
              <label>
                Timezone
                <input name="timezone" type="text" defaultValue={state.user?.timezone || "America/New_York"} />
              </label>
            </FormSectionCard>
            <FormSectionCard title="Service and follow-up" copy="Tell the studio what work matters next and how to keep the account useful.">
              <label>
                Primary service interest
                <select name="serviceInterest" defaultValue={state.user?.serviceInterest || serviceOptions[0] || ""} required>
                  {serviceOptions.map((service) => (
                    <option key={service}>{service}</option>
                  ))}
                </select>
              </label>
              <label>
                Merch interest
                <select name="merchInterest" defaultValue={state.user?.merchInterest || "Both"}>
                  <option>Plugz UNTD</option>
                  <option>Plugz RNGD</option>
                  <option>Both</option>
                  <option>None</option>
                </select>
              </label>
              <label>
                Lead source
                <input name="leadSource" type="text" defaultValue={state.user?.leadSource || "Website"} />
              </label>
              <label>
                Referral source
                <input name="referralSource" type="text" defaultValue={state.user?.referralSource || ""} />
              </label>
              <label>
                Project goals
                <textarea name="projectGoals" rows="5" defaultValue={state.user?.projectGoals || ""} />
              </label>
              <label>
                Notes
                <textarea name="clientNotes" rows="6" defaultValue={state.user?.clientNotes || ""} />
              </label>
              <label>
                Accessibility notes
                <textarea name="accessibilityNotes" rows="4" defaultValue={state.user?.accessibilityNotes || ""} />
              </label>
              <label className="checkbox-row">
                <input type="checkbox" name="notificationOptIn" defaultChecked={Boolean(state.user?.notificationOptIn)} />
                Receive notifications
              </label>
              <label className="checkbox-row">
                <input type="checkbox" name="marketingOptIn" defaultChecked={Boolean(state.user?.marketingOptIn)} />
                Receive updates
              </label>
              <FormHint>Some internal account settings are controlled by the studio.</FormHint>
            </FormSectionCard>
            {isModelProfile ? (
              <FormSectionCard
                title="Model profile"
                copy="These model-only fields keep casting, production readiness, and PII review separate from client profile categories."
              >
                {Object.entries(modelProfileFieldGroups).map(([section, fields]) => (
                  <div className="model-profile-subsection" key={section}>
                    <strong>{section}</strong>
                    <div className="quick-quote-grid">
                      {fields.map((field) => (
                        <label key={field.key}>
                          {field.label}
                          {field.type === "textarea" ? (
                            <textarea
                              name={`modelProfile.${field.key}`}
                              rows={field.rows || 3}
                              defaultValue={state.user?.profileFields?.[field.key] || ""}
                            />
                          ) : (
                            <input
                              name={`modelProfile.${field.key}`}
                              type={field.type || "text"}
                              inputMode={field.type === "url" ? "url" : undefined}
                              defaultValue={state.user?.profileFields?.[field.key] || ""}
                            />
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                <FormHint>Attendance status, queue position, and no-show counts are tracked by the studio, not edited by applicants.</FormHint>
              </FormSectionCard>
            ) : null}
            <FormSectionCard title="Billing and invoices" copy="Used for Square invoices, quotes, deposits, and payment follow-up.">
              <label>
                Billing name
                <input name="billingName" type="text" defaultValue={state.user?.billingName || ""} />
              </label>
              <label>
                Billing email
                <input name="billingEmail" type="email" defaultValue={state.user?.billingEmail || ""} />
              </label>
              <label>
                Billing address
                <textarea name="billingAddress" rows="4" defaultValue={state.user?.billingAddress || ""} />
              </label>
              <label>
                Preferred payment method
                <input name="preferredPaymentMethod" type="text" defaultValue={state.user?.preferredPaymentMethod || ""} />
              </label>
              <label>
                Budget profile
                <input name="budgetProfile" type="text" defaultValue={state.user?.budgetProfile || ""} />
              </label>
              <label>
                Tax ID
                <input name="taxId" type="text" defaultValue={state.user?.taxId || ""} />
              </label>
            </FormSectionCard>
            <FormSectionCard title="Shipping and delivery" copy="Useful when merch, physical items, or shipped deliverables are involved.">
              <label>
                Shipping name
                <input name="shippingName" type="text" defaultValue={state.user?.shippingName || ""} />
              </label>
              <label>
                Shipping address
                <textarea name="shippingAddress" rows="4" defaultValue={state.user?.shippingAddress || ""} />
              </label>
              <label>
                City
                <input name="shippingCity" type="text" defaultValue={state.user?.shippingCity || ""} />
              </label>
              <label>
                State / region
                <input name="shippingRegion" type="text" defaultValue={state.user?.shippingRegion || ""} />
              </label>
              <label>
                Postal code
                <input name="shippingPostalCode" type="text" defaultValue={state.user?.shippingPostalCode || ""} />
              </label>
              <label>
                Country
                <input name="shippingCountry" type="text" defaultValue={state.user?.shippingCountry || "United States"} />
              </label>
            </FormSectionCard>
            <FormSectionCard title="Links and extra details" copy="Optional web links and custom profile details that help the studio understand the client.">
              <label>
                Website
                <input name="website" type="text" inputMode="url" defaultValue={state.user?.website || ""} />
              </label>
              <label>
                Instagram
                <input name="instagram" type="text" defaultValue={state.user?.instagram || ""} />
              </label>
              <label>
                TikTok
                <input name="tiktok" type="text" defaultValue={state.user?.tiktok || ""} />
              </label>
              <label>
                YouTube
                <input name="youtube" type="text" inputMode="url" defaultValue={state.user?.youtube || ""} />
              </label>
              <label>
                Custom fields
                <textarea
                  name="profileFields"
                  rows="6"
                  defaultValue={formatProfileFields(state.user?.profileFields)}
                  placeholder="Preferred venue: Studio A&#10;Wardrobe size: Large"
                />
              </label>
              <FormHint>Use one detail per line in the format `Label: value`. Up to 25 extra details can be saved.</FormHint>
            </FormSectionCard>
            <button type="submit" className="button">
              Save profile
            </button>
          </form>
          <p className={`message ${profileMessage ? "is-visible" : ""}`}>{profileMessage}</p>
          <ShortcutRail
            items={profileActions}
            className="ui-shortcut-tight"
          />
        </section>
      </main>
    </div>
  );
}
