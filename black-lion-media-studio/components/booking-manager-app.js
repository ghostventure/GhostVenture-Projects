"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientNav } from "./client-nav";
import { fetchJson, patchJson, postJson } from "../lib/client-api";
import {
  DetailPairGrid,
  FormHint,
  FormSectionCard,
  ConsultationCalendar,
  ShortcutRail,
  SpotlightCard,
  SupportNotice,
  SurfaceGrid,
  ValueCardGrid
} from "./shared-ui";

const emptyState = {
  user: null,
  metrics: {},
  consultationCalendar: null,
  latestRequests: [],
  modelProfiles: []
};

function formatMoney(amountCents = 0) {
  const amount = Number(amountCents || 0) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(amount);
}

function appendManagerNote(existingNote = "", nextNote = "") {
  return [existingNote, nextNote].map((item) => String(item || "").trim()).filter(Boolean).join("\n");
}

export function BookingManagerApp({ initialState = null }) {
  const router = useRouter();
  const [state, setState] = useState(initialState || emptyState);
  const [loading, setLoading] = useState(!initialState);
  const [managerNotice, setManagerNotice] = useState("");
  const [selectedRequestId, setSelectedRequestId] = useState(initialState?.latestRequests?.[0]?.id || "");
  const [modelSearch, setModelSearch] = useState("");
  const [selectedModelId, setSelectedModelId] = useState(initialState?.modelProfiles?.[0]?.id || "");
  const [savingRequestId, setSavingRequestId] = useState("");
  const [billingRequestId, setBillingRequestId] = useState("");

  async function loadManagerState() {
    const [sessionResult, managerResult] = await Promise.all([
      fetchJson("/api/me", { cache: "no-store" }),
      fetchJson("/api/manager/requests", { cache: "no-store" })
    ]);

    if (sessionResult.response.status === 401) {
      router.replace("/");
      return false;
    }

    if (managerResult.response.status === 403) {
      router.replace("/dashboard");
      return false;
    }

    if (!sessionResult.response.ok || !managerResult.response.ok) {
      router.replace("/dashboard");
      return false;
    }

    setState({
      user: sessionResult.data.user,
      metrics: managerResult.data.metrics || {},
      consultationCalendar: managerResult.data.consultationCalendar || null,
      latestRequests: managerResult.data.latestRequests || [],
      modelProfiles: managerResult.data.modelProfiles || []
    });
    setSelectedRequestId((current) => current || managerResult.data.latestRequests?.[0]?.id || "");
    setSelectedModelId((current) => current || managerResult.data.modelProfiles?.[0]?.id || "");
    return true;
  }

  useEffect(() => {
    if (initialState) {
      return;
    }

    async function load() {
      try {
        await loadManagerState();
      } catch {
        router.replace("/dashboard");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [initialState, router]);

  async function handleManagerUpdate(requestId, event) {
    event.preventDefault();
    setManagerNotice("");
    setSavingRequestId(requestId);

    try {
      const formData = new FormData(event.currentTarget);
      await patchJson(`/api/manager/requests/${requestId}`, {
        status: formData.get("status"),
        invoiceStatus: formData.get("invoiceStatus"),
        paymentStatus: formData.get("paymentStatus"),
        fulfillmentStatus: formData.get("fulfillmentStatus"),
        internalPriority: formData.get("internalPriority"),
        managerNotes: formData.get("managerNotes")
      });
      await loadManagerState();
      setManagerNotice("Request updated.");
    } catch (error) {
      setManagerNotice(error.message);
    } finally {
      setSavingRequestId("");
    }
  }

  async function handleManagerDecision(requestRecord, decision) {
    const approved = decision === "approved";
    setManagerNotice("");
    setSavingRequestId(requestRecord.id);

    try {
      await patchJson(`/api/manager/requests/${requestRecord.id}`, {
        status: approved ? "Approved" : "Declined",
        invoiceStatus: approved ? "Drafted" : "Waived",
        paymentStatus: approved ? "Deposit Requested" : "Pending",
        fulfillmentStatus: approved ? "Queued" : "Closed",
        internalPriority: requestRecord.internal_priority || "Standard",
        managerNotes: appendManagerNote(
          requestRecord.manager_notes,
          approved
            ? "Approved for processing. Continue deposit, payment, and scheduling through Square."
            : "Not approved as submitted. Client notified through the portal."
        )
      });
      await loadManagerState();
      setManagerNotice(approved ? "Request approved. Client was notified." : "Request declined. Client was notified.");
    } catch (error) {
      setManagerNotice(error.message);
    } finally {
      setSavingRequestId("");
    }
  }

  async function handleCreateInvoice(requestId) {
    setManagerNotice("");
    setBillingRequestId(requestId);

    try {
      await postJson(`/api/manager/requests/${requestId}/invoice`, {});
      await loadManagerState();
      setManagerNotice("Square invoice sent.");
    } catch (error) {
      setManagerNotice(error.message);
    } finally {
      setBillingRequestId("");
    }
  }

  if (loading) {
    return (
      <div className="page-shell">
        <section className="panel">
          <h2>Loading manager dashboard...</h2>
        </section>
      </div>
    );
  }

  const selectedRequest =
    state.latestRequests.find((request) => request.id === selectedRequestId) ||
    state.latestRequests[0] ||
    null;
  const summaryItems = [
    { label: "Total requests", value: state.metrics.totalRequests ?? 0, note: "Entire active book of work" },
    { label: "New requests", value: state.metrics.newRequests ?? 0, note: "Fresh requests to review" },
    { label: "Clients", value: state.metrics.uniqueClients ?? 0, note: "Distinct client accounts in motion" },
    { label: "Consultations", value: state.metrics.consultationQueue ?? 0, note: "Scheduled calls and meetings" },
    { label: "Square appts", value: state.metrics.appointmentOnlyRequests ?? 0, note: "Appointment-only calendar imports" }
  ];
  const normalizedModelSearch = modelSearch.trim().toLowerCase();
  const filteredModelProfiles = state.modelProfiles.filter((model) => {
    if (!normalizedModelSearch) {
      return true;
    }

    return [
      model.fullName,
      model.username,
      model.email,
      model.phone,
      model.city,
      model.instagram,
      model.portfolioUrl,
      model.projectTypes,
      model.modelingInterests,
      model.availability,
      model.travelReadiness,
      model.productionPace,
      model.qualityStandards,
      model.reliabilityExamples,
      model.preparationProcess,
      model.queueStatus,
      model.lifecycleStage
    ].some((value) => String(value || "").toLowerCase().includes(normalizedModelSearch));
  });
  const selectedModel =
    filteredModelProfiles.find((model) => model.id === selectedModelId) ||
    state.modelProfiles.find((model) => model.id === selectedModelId) ||
    filteredModelProfiles[0] ||
    null;
  const managerActions = [
    { href: "/messages", label: "Messages", value: "Open conversation center", note: "Jump to client messaging" },
    { href: "/dashboard", label: "Client view", value: "See the customer side", note: "Compare the client experience" },
    { href: "/profile", label: "Profile", value: "Review account details", note: "Keep manager profile current" }
  ];

  return (
    <div className="page-shell">
      <ClientNav
        userName={state.user?.fullName || "Manager"}
        isBookingManager={Boolean(state.user?.isBookingManager)}
        workspace="manager"
      />

      <main className="stack">
        <section
          className="panel workspace-hero"
          style={{ backgroundImage: "url('/ai/hero-editorial.png')" }}
        >
          <div>
            <p className="eyebrow">Manager dashboard</p>
            <h1 className="editorial-heading">{state.user?.fullName || "Manager"}</h1>
            <p>
              Review new requests, update status, and keep invoices, payments, and delivery moving.
            </p>
          </div>
          <ValueCardGrid items={summaryItems} className="ui-value-card-overlay" />
        </section>

        <section className="dashboard-hero-grid">
          <SpotlightCard
            className="panel highlight-panel"
            eyebrow="Studio"
            title="Manager-only request and payment view."
            copy="This side is for reviewing client requests, billing notes, internal notes, and status updates after a request is sent."
          >
            <ShortcutRail items={managerActions} className="ui-shortcut-tight" />
          </SpotlightCard>

          <div
            className="panel visual-card"
            style={{ backgroundImage: "url('/ai/digital-support.png')" }}
          />
        </section>

        {state.consultationCalendar ? (
          <section className="panel">
            <ConsultationCalendar
              calendar={state.consultationCalendar}
              className="dashboard-consultation-calendar"
            />
          </section>
        ) : null}

        <section className="two-column manager-grid">
          <div className="panel">
            <p className="label">Models</p>
            <h2 className="editorial-heading">Find a model</h2>
            <SupportNotice
              title="Model-only search"
              copy="Search model profiles by name, username, email, Instagram, city, project type, availability, speed, quality, reliability, and preparation notes."
            />
            <label className="manager-search-field">
              Search models
              <input
                type="search"
                value={modelSearch}
                onChange={(event) => setModelSearch(event.target.value)}
                placeholder="Name, @handle, city, project type, fast production..."
              />
            </label>
            <SurfaceGrid className="stack-small">
              {filteredModelProfiles.length === 0 ? (
                <p className="muted">No matching model profiles.</p>
              ) : (
                filteredModelProfiles.map((model) => (
                  <button
                    type="button"
                    className={`select-card ${model.id === selectedModel?.id ? "selected" : ""}`}
                    key={model.id}
                    onClick={() => setSelectedModelId(model.id)}
                  >
                    <strong>{model.fullName || model.username || model.email}</strong>
                    <span>{model.instagram || model.username || model.email}</span>
                    <span className="muted">{model.queueStatus || "Standard"} queue</span>
                  </button>
                ))
              )}
            </SurfaceGrid>
          </div>

          <div className="panel">
            <p className="label">Model profile</p>
            <h2 className="editorial-heading">Review fit</h2>
            {selectedModel ? (
              <>
                <SpotlightCard
                  className="subpanel"
                  eyebrow={selectedModel.lifecycleStage || "Model Applicant"}
                  title={selectedModel.fullName || selectedModel.username || "Model profile"}
                  copy={selectedModel.experience || selectedModel.projectTypes || "No model profile summary available."}
                >
                  <DetailPairGrid
                    className="detail-grid"
                    items={[
                      { label: "Username", value: selectedModel.username || "Not set" },
                      { label: "Email", value: selectedModel.email || "Not set" },
                      { label: "Phone", value: selectedModel.phone || "Not set" },
                      { label: "Instagram", value: selectedModel.instagram || "Not set" },
                      { label: "City", value: selectedModel.city || "Not set" },
                      { label: "Projects", value: selectedModel.projectTypes || "Not set" },
                      { label: "Interests", value: selectedModel.modelingInterests || "Not set" },
                      { label: "Queue", value: selectedModel.queueStatus || "Standard" },
                      { label: "No-shows", value: selectedModel.noShowCount || "0" }
                    ]}
                  />
                </SpotlightCard>
                <SpotlightCard
                  className="subpanel"
                  eyebrow="Production scrutiny"
                  title="Speed, quality, and reliability"
                  copy="Use these notes before contacting a model for a time-sensitive project."
                >
                  <DetailPairGrid
                    className="detail-grid"
                    items={[
                      { label: "Availability", value: selectedModel.availability || "Not set" },
                      { label: "Travel", value: selectedModel.travelReadiness || "Not set" },
                      { label: "Production pace", value: selectedModel.productionPace || "Not set" },
                      { label: "Quality", value: selectedModel.qualityStandards || "Not set" },
                      { label: "Reliability", value: selectedModel.reliabilityExamples || "Not set" },
                      { label: "Preparation", value: selectedModel.preparationProcess || "Not set" }
                    ]}
                  />
                </SpotlightCard>
              </>
            ) : (
              <p className="muted">Select a model profile.</p>
            )}
          </div>
        </section>

        <section className="two-column manager-grid">
          <div className="panel">
            <p className="label">Requests</p>
            <h2 className="editorial-heading">Request list</h2>
            <SupportNotice
              title="Review focus"
              copy="Select a request to review the client details, payment status, and next steps."
            />
            <SurfaceGrid className="stack-small">
              {state.latestRequests.length === 0 ? (
                <p className="muted">No requests available.</p>
              ) : (
                state.latestRequests.map((request) => (
                  <button
                    type="button"
                    className={`select-card ${request.id === selectedRequestId ? "selected" : ""}`}
                    key={request.id}
                    onClick={() => setSelectedRequestId(request.id)}
                  >
                    <strong>{request.project_type}</strong>
                    <span>{request.client_name || request.client_email}</span>
                    <span className="muted">{request.status}</span>
                  </button>
                ))
              )}
            </SurfaceGrid>
          </div>

          <div className="panel">
            <p className="label">Request</p>
            <h2 className="editorial-heading">Request details</h2>
            {selectedRequest ? (
              <>
                <SpotlightCard
                  className="subpanel"
                  eyebrow={selectedRequest.status || "No status"}
                  title={selectedRequest.project_type}
                  copy={selectedRequest.details || "No details provided."}
                >
                  <DetailPairGrid
                    className="detail-grid"
                    items={[
                      { label: "Client", value: selectedRequest.client_name || "No client name" },
                      { label: "Email", value: selectedRequest.client_email || "No client email" },
                      { label: "Type", value: selectedRequest.client_type || "Individual" },
                      { label: "Lifecycle", value: selectedRequest.client_lifecycle_stage || "New Lead" },
                      { label: "Budget", value: selectedRequest.budget || "No budget" },
                      {
                        label: "Estimate total",
                        value: selectedRequest.estimate_amount_cents
                          ? formatMoney(selectedRequest.estimate_amount_cents)
                          : "Not provided"
                      },
                      {
                        label: "Required deposit",
                        value: selectedRequest.deposit_amount_cents
                          ? formatMoney(selectedRequest.deposit_amount_cents)
                          : "Not provided"
                      },
                      { label: "Timeline", value: selectedRequest.timeline || "No timeline" },
                      { label: "Invoice", value: selectedRequest.invoice_status || "Pending" },
                      { label: "Payment", value: selectedRequest.payment_status || "Pending" }
                    ]}
                  />
                </SpotlightCard>

                <SpotlightCard
                  className="subpanel"
                  eyebrow="Manager decision"
                  title="Approve or decline this request."
                  copy="Approve when the service estimate is ready for Square deposit and scheduling. Decline if the request should not move forward as submitted."
                >
                  <div className="quote-action-row">
                    <button
                      type="button"
                      className="button"
                      onClick={() => handleManagerDecision(selectedRequest, "approved")}
                      disabled={savingRequestId === selectedRequest.id || selectedRequest.status === "Approved"}
                    >
                      {savingRequestId === selectedRequest.id ? "Saving..." : "Approve for processing"}
                    </button>
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => handleManagerDecision(selectedRequest, "declined")}
                      disabled={savingRequestId === selectedRequest.id || selectedRequest.status === "Declined"}
                    >
                      Not approved
                    </button>
                  </div>
                </SpotlightCard>

                {selectedRequest.source === "Square Appointments" ? (
                  <SpotlightCard
                    className="subpanel"
                    eyebrow="Square appointment"
                    title="Appointment-only booking."
                    copy="This record came from Square Appointments and is kept for calendar visibility. Create a separate client request before invoicing project work."
                  />
                ) : (
                  <SpotlightCard
                    className="subpanel"
                    eyebrow="Square billing"
                    title={
                      selectedRequest.square_invoice_number
                        ? `Invoice ${selectedRequest.square_invoice_number}`
                        : "Create the Square invoice."
                    }
                    copy={
                      selectedRequest.square_invoice_id
                        ? `Sent for ${formatMoney(selectedRequest.invoice_amount_cents)}. Due ${selectedRequest.invoice_due_date || "by invoice terms"}.`
                        : selectedRequest.deposit_amount_cents
                          ? `Send the required deposit invoice for ${formatMoney(selectedRequest.deposit_amount_cents)} through Square.`
                          : "Send an invoice using the listed starting price for this service."
                    }
                  >
                    {selectedRequest.square_invoice_url ? (
                      <a className="button button-secondary" href={selectedRequest.square_invoice_url} target="_blank" rel="noreferrer">
                        Open Square invoice
                      </a>
                    ) : (
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() => handleCreateInvoice(selectedRequest.id)}
                        disabled={billingRequestId === selectedRequest.id}
                      >
                        {billingRequestId === selectedRequest.id ? "Sending invoice..." : "Send Square invoice"}
                      </button>
                    )}
                  </SpotlightCard>
                )}

                <form className="form active" onSubmit={(event) => handleManagerUpdate(selectedRequest.id, event)}>
                  <FormSectionCard title="Status controls" copy="Update the studio status tied to this request.">
                    <label>
                      Status
                      <input name="status" type="text" defaultValue={selectedRequest.status || ""} />
                    </label>
                    <label>
                      Invoice status
                      <input name="invoiceStatus" type="text" defaultValue={selectedRequest.invoice_status || ""} />
                    </label>
                    <label>
                      Payment status
                      <input name="paymentStatus" type="text" defaultValue={selectedRequest.payment_status || ""} />
                    </label>
                    <label>
                      Delivery status
                      <input
                        name="fulfillmentStatus"
                        type="text"
                        defaultValue={selectedRequest.fulfillment_status || ""}
                      />
                    </label>
                    <label>
                      Priority
                      <input name="internalPriority" type="text" defaultValue={selectedRequest.internal_priority || ""} />
                    </label>
                  </FormSectionCard>
                  <FormSectionCard title="Manager notes" copy="Keep private studio notes and client follow-up details together.">
                    <label>
                      Manager notes
                      <textarea name="managerNotes" rows="6" defaultValue={selectedRequest.manager_notes || ""} />
                    </label>
                    <FormHint>These notes stay on the manager side and should support follow-through, not client-facing copy.</FormHint>
                  </FormSectionCard>
                  <button type="submit" className="button" disabled={savingRequestId === selectedRequest.id}>
                    {savingRequestId === selectedRequest.id ? "Saving..." : "Save"}
                  </button>
                </form>
              </>
            ) : (
              <p className="muted">Select a request.</p>
            )}
            <p className={`message ${managerNotice ? "is-visible" : ""}`}>{managerNotice}</p>
          </div>
        </section>
      </main>
    </div>
  );
}
