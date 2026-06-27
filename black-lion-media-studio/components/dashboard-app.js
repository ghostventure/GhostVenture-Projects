"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientNav } from "./client-nav";
import { BlackLionMediaComponentSuite } from "./black-lion-media-suite";
import { ServiceQuoteBuilder } from "./service-quote-builder";
import { trackEvent } from "../lib/client-analytics";
import { fetchJson, postJson } from "../lib/client-api";
import { buildClientOnboarding } from "../lib/onboarding";
import { getConsultationAvailability } from "../lib/consultations";
import { findServiceByName, serviceOptions } from "../lib/services";
import {
  FormHint,
  FormSectionCard,
  ShortcutRail,
  SpotlightCard,
  SupportNotice,
  SurfaceGrid,
  ValueCardGrid
} from "./shared-ui";

const emptyState = {
  user: null,
  requests: [],
  messages: [],
  metrics: {},
  consultationCalendar: null
};

const consultationAvailability = getConsultationAvailability();

function formatMoney(amountCents = 0) {
  const amount = Number(amountCents || 0) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(amount);
}

export function DashboardApp({ initialState = null }) {
  const router = useRouter();
  const [state, setState] = useState(initialState || emptyState);
  const [loading, setLoading] = useState(!initialState);
  const [requestMessage, setRequestMessage] = useState("");
  const [selectedService, setSelectedService] = useState(serviceOptions[0] || "");
  const [requestBudget, setRequestBudget] = useState("");
  const [requestTimeline, setRequestTimeline] = useState("");
  const [requestDetails, setRequestDetails] = useState("");
  const [selectedConsultationDate, setSelectedConsultationDate] = useState(
    consultationAvailability[0]?.value || ""
  );
  const [selectedConsultationTime, setSelectedConsultationTime] = useState(
    consultationAvailability[0]?.timeSlots?.[0] || ""
  );

  useEffect(() => {
    if (initialState) {
      return;
    }

    async function loadSession() {
      try {
        const { response, data } = await fetchJson("/api/dashboard", { cache: "no-store" });
        if (!response.ok) {
          router.replace("/");
          return;
        }
        setState(data);
      } catch {
        router.replace("/");
      } finally {
        setLoading(false);
      }
    }

    loadSession();
  }, [initialState, router]);

  async function refreshDashboardState() {
    const { response, data } = await fetchJson("/api/dashboard", { cache: "no-store" });
    if (!response.ok) {
      return false;
    }
    setState(data);
    return true;
  }

  async function handleRequest(event) {
    event.preventDefault();
    setRequestMessage("");
    const form = event.currentTarget;

    try {
      const formData = new FormData(form);
      await postJson("/api/requests", Object.fromEntries(formData.entries()));
      await refreshDashboardState();
      form.reset();
      setSelectedService(serviceOptions[0] || "");
      setRequestBudget("");
      setRequestTimeline("");
      setRequestDetails("");
      setSelectedConsultationDate(consultationAvailability[0]?.value || "");
      setSelectedConsultationTime(consultationAvailability[0]?.timeSlots?.[0] || "");
      setRequestMessage("Request submitted.");
      trackEvent("request_submitted", { service: formData.get("projectType") });
    } catch (error) {
      setRequestMessage(error.message);
    }
  }

  function applyEstimateToRequest(estimate) {
    setSelectedService(estimate.projectType);
    setRequestBudget(estimate.budget);
    setRequestTimeline(estimate.timeline);
    setRequestDetails(estimate.details);
    setRequestMessage("Estimate copied into the request form. Review it, then submit when ready.");
    requestAnimationFrame(() => {
      document.getElementById("service-request")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  if (loading) {
    return (
      <div className="page-shell">
        <section className="panel">
          <h2>Loading dashboard...</h2>
        </section>
      </div>
    );
  }

  const selectedServiceDetails = findServiceByName(selectedService);
  const selectedConsultationDay =
    consultationAvailability.find((day) => day.value === selectedConsultationDate) ||
    consultationAvailability[0];
  const onboarding = state.onboarding || buildClientOnboarding({
    user: state.user || {},
    requests: state.requests,
    messages: state.messages
  });
  const utilityItems = [
    { href: "#service-request", label: "Request", value: "Start a new request", note: "Send the next service request" },
    { href: "/messages", label: "Messages", value: "Continue the conversation", note: "Open the client thread" },
    { href: "/profile", label: "Profile", value: "Keep details current", note: "Update account and billing fields" }
  ];
  const snapshotItems = [
    { label: "Requests", value: state.requests.length, note: "Service requests you have sent" },
    { label: "Messages", value: state.messages.length, note: "Questions and replies" },
    { label: "Profile", value: `${state.metrics.profileCompletionPercent ?? 0}%`, note: "How complete your details are" }
  ];
  const workflowItems = [
    { label: "Start", value: "Send the request", note: "Service, date, budget, and plain-language details." },
    { label: "Track", value: "Watch status", note: "Requests, messages, invoices, and next steps stay together." },
    { label: "Finish", value: "Close the loop", note: "Use messages for approvals, delivery, and follow-up." }
  ];

  return (
    <div className="page-shell">
      <ClientNav
        userName={state.user?.fullName || "Client"}
        isBookingManager={Boolean(state.user?.isBookingManager)}
        workspace="client"
      />

      <main className="stack">
        <section
          className="panel workspace-hero"
          style={{ backgroundImage: "url('/ai/digital-support.png')" }}
        >
          <div>
            <p className="eyebrow">Client dashboard</p>
            <h1 className="editorial-heading">{state.user?.fullName || "Client"}</h1>
            <p>
              Keep booking simple: send a service request, watch status changes, and stay in touch
              without sorting through clutter.
            </p>
          </div>
          <ValueCardGrid items={snapshotItems} className="ui-value-card-overlay" />
        </section>

        <section className="dashboard-hero-grid">
          <SpotlightCard
            className="panel highlight-panel"
            eyebrow="Request"
            title="Start a new service request."
            copy="Pick the service, choose a consultation date, and describe what you need in plain language. The studio handles pricing, scheduling, and follow-up after that."
          >
            {selectedServiceDetails ? (
              <div className="subpanel">
                <p>
                  <strong>{selectedServiceDetails.name}</strong>
                </p>
                <p>{selectedServiceDetails.description}</p>
                <p className="muted">
                  {selectedServiceDetails.priceLabel} • {selectedServiceDetails.turnaround}
                </p>
              </div>
            ) : null}
            <ShortcutRail items={utilityItems} className="ui-shortcut-tight" />
          </SpotlightCard>

          <div
            className="panel visual-card"
            style={{ backgroundImage: "url('/ai/sound-atmosphere.png')" }}
          />
        </section>

        <section className="panel onboarding-panel" aria-labelledby="client-onboarding-title">
          <div className="onboarding-header">
            <div>
              <p className="label">Client onboarding</p>
              <h2 className="editorial-heading" id="client-onboarding-title">
                {onboarding.nextStep?.complete ? "Your client setup is ready." : onboarding.nextStep?.title}
              </h2>
              <p className="muted">
                {onboarding.nextStep?.complete
                  ? "You can keep using the dashboard for new requests, messages, billing, and delivery."
                  : onboarding.nextStep?.copy}
              </p>
            </div>
            <div className="onboarding-score">
              <strong>{onboarding.completionPercent}%</strong>
              <span>
                {onboarding.completedCount}/{onboarding.totalCount} done
              </span>
            </div>
          </div>
          <div className="completion-bar onboarding-bar">
            <span style={{ width: `${onboarding.completionPercent}%` }} />
          </div>
          <div className="onboarding-steps">
            {onboarding.steps.map((step) => (
              <a
                href={step.href}
                className={`onboarding-step ${step.complete ? "is-complete" : ""}`}
                data-analytics-event="onboarding_step_click"
                data-analytics-label={step.id}
                key={step.id}
              >
                <span>{step.complete ? "Done" : step.label}</span>
                <strong>{step.title}</strong>
                <p>{step.copy}</p>
                <em>{step.actionLabel}</em>
              </a>
            ))}
          </div>
        </section>

        <ServiceQuoteBuilder compact dashboard onApplyEstimate={applyEstimateToRequest} />

        <section className="panel" id="service-request">
          <p className="label">Service request</p>
          <h2 className="editorial-heading">Tell Black Lion what you want built.</h2>
          <form className="form active" onSubmit={handleRequest}>
            <FormSectionCard title="Service setup" copy="Start with the service lane and the timing window.">
              <label>
                Service
                <select
                  name="projectType"
                  value={selectedService}
                  onChange={(event) => setSelectedService(event.target.value)}
                  required
                >
                  {serviceOptions.map((service) => (
                    <option key={service}>{service}</option>
                  ))}
                </select>
              </label>
              <label>
                Consultation date
                <select
                  name="consultationDate"
                  value={selectedConsultationDate}
                  required
                  onChange={(event) => {
                    const nextDate = event.target.value;
                    const nextDay = consultationAvailability.find((day) => day.value === nextDate);
                    setSelectedConsultationDate(nextDate);
                    setSelectedConsultationTime(nextDay?.timeSlots?.[0] || "");
                  }}
                >
                  {consultationAvailability.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Consultation time
                <select
                  name="consultationTime"
                  value={selectedConsultationTime}
                  onChange={(event) => setSelectedConsultationTime(event.target.value)}
                  required
                >
                  {(selectedConsultationDay?.timeSlots || []).map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </label>
            </FormSectionCard>
            <FormSectionCard title="Project details" copy="Add the budget range and the details the studio should read first.">
              <label>
                Budget
                <input
                  name="budget"
                  type="text"
                  value={requestBudget}
                  onChange={(event) => setRequestBudget(event.target.value)}
                  required
                />
              </label>
              <label>
                Timeline
                <input
                  name="timeline"
                  type="text"
                  value={requestTimeline}
                  onChange={(event) => setRequestTimeline(event.target.value)}
                  required
                />
              </label>
              <label>
                Project details
                <textarea
                  name="details"
                  rows="6"
                  value={requestDetails}
                  onChange={(event) => setRequestDetails(event.target.value)}
                  required
                />
              </label>
              <FormHint>Plain language is enough here. The goal is clarity, not technical detail.</FormHint>
            </FormSectionCard>
            <button type="submit" className="button">
              Submit request
            </button>
          </form>
          <p className={`message ${requestMessage ? "is-visible" : ""}`}>{requestMessage}</p>
        </section>

        <section className="two-column">
          <div className="panel">
            <p className="label">Activity</p>
            <h2 className="editorial-heading">Your requests</h2>
            <SupportNotice
              title="Request history"
              copy="Every submitted request stays here so you can track status and revisit the brief."
            />
            <SurfaceGrid className="stack-small">
              {state.requests.length === 0 ? (
                <p className="muted">No requests yet.</p>
              ) : (
                state.requests.map((request) => (
                  <SpotlightCard
                    className="request-card"
                    key={request.id}
                    eyebrow={request.status}
                    title={request.project_type}
                    copy={`${request.consultation_date || "No consultation date"} • ${request.budget || "No budget"}`}
                  >
                    <p className="muted">{request.timeline || "No timeline yet"}</p>
                    {request.square_invoice_url ? (
                      <div className="billing-summary">
                        <span>{request.invoice_status || "Invoice sent"}</span>
                        <strong>{formatMoney(request.invoice_amount_cents)}</strong>
                        <a href={request.square_invoice_url} target="_blank" rel="noreferrer">
                          Pay invoice
                        </a>
                      </div>
                    ) : (
                      <p className="muted">Invoice: {request.invoice_status || "Pending"}</p>
                    )}
                  </SpotlightCard>
                ))
              )}
            </SurfaceGrid>
          </div>

          <div className="panel">
            <p className="label">Messages</p>
            <h2 className="editorial-heading">Recent conversation</h2>
            <SupportNotice
              title="Communication snapshot"
              copy="The latest conversation stays visible here so you do not lose track of replies."
            />
            <SurfaceGrid className="stack-small">
              {state.messages.length === 0 ? (
                <p className="muted">No messages yet.</p>
              ) : (
                state.messages.slice(0, 5).map((message) => (
                  <SpotlightCard
                    className="message-card"
                    key={message.id}
                    eyebrow={new Date(message.created_at).toLocaleDateString()}
                    title={message.subject}
                    copy={message.body}
                  />
                ))
              )}
            </SurfaceGrid>
          </div>
        </section>

        <section className="panel dashboard-workflow-panel">
          <div>
            <p className="label">Workflow</p>
            <h2 className="editorial-heading">A shorter path from request to delivery.</h2>
            <p className="muted">
              The dashboard now focuses on the actions that move real work: request, track, message,
              invoice, and finish.
            </p>
          </div>
          <ValueCardGrid items={workflowItems} />
        </section>

        <BlackLionMediaComponentSuite />
      </main>
    </div>
  );
}
