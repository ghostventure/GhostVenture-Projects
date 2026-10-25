"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientNav } from "./client-nav";
import { buildProjectBrief } from "./project-planner";
import { ServiceQuoteBuilder } from "./service-quote-builder";
import { RequestAssetsPanel } from "./request-assets-panel";
import { trackEvent } from "../lib/client-analytics";
import { fetchJson, postJson, patchJson } from "../lib/client-api";
import { authenticatedFetch } from "../lib/client-session";
import { buildClientOnboarding } from "../lib/onboarding";
import { findServiceByName, findServiceBySlug, serviceOptions } from "../lib/services";
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

const maxQuoteDetailsLength = 1900;

function mapSquareAvailability(availability = []) {
  const grouped = new Map();
  const dateFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });
  const timeFormatter = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
  for (const item of availability) {
    const startAt = String(item.startAt || "");
    const date = new Date(startAt);
    if (!startAt || Number.isNaN(date.getTime())) continue;
    const dateValue = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
    if (!grouped.has(dateValue)) grouped.set(dateValue, { value: dateValue, label: `${dateFormatter.format(date)} (${dateValue})`, slots: [] });
    grouped.get(dateValue).slots.push({ label: timeFormatter.format(date), startAt });
  }
  return [...grouped.values()].map((day) => ({ ...day, slots: day.slots.sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt)), timeSlots: day.slots.map((slot) => slot.label) }));
}

function createBookingAttemptUuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function formatMoney(amountCents = 0) {
  const amount = Number(amountCents || 0) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(amount);
}

function formatRequestDate(value) {
  if (!value) return "Date not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not recorded";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function trimQuoteDetails(details) {
  const text = String(details || "").trim();
  if (text.length <= maxQuoteDetailsLength) {
    return text;
  }
  return `${text.slice(0, maxQuoteDetailsLength - 42).trim()}... [trimmed for manager request handoff]`;
}

function downloadClientRequest(request) {
  const payload = {
    exportedAt: new Date().toISOString(),
    request: {
      service: request.project_type,
      status: request.status,
      submittedAt: request.created_at,
      budget: request.budget,
      timeline: request.timeline,
      consultationDate: request.consultation_date,
      consultationTime: request.consultation_time,
      projectDetails: request.details,
      invoiceStatus: request.invoice_status,
      invoiceAmountCents: request.invoice_amount_cents,
      invoiceUrl: request.square_invoice_url
    }
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `black-lion-request-${String(request.project_type || "request").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "request"}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportAppointmentCalendarFile(request) {
  const match = String(request.consultation_time || "").trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match || !/^\d{4}-\d{2}-\d{2}$/.test(request.consultation_date || "")) return;
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") hour += 12;
  const [year, month, day] = request.consultation_date.split("-").map(Number);
  const localWallTime = Date.UTC(year, month - 1, day, hour, Number(match[2]));
  const toStudioUtc = (wallTime) => {
    let candidate = wallTime;
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const parts = Object.fromEntries(formatter.formatToParts(new Date(candidate)).map((part) => [part.type, part.value]));
      const representedWallTime = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
      candidate = wallTime - (representedWallTime - candidate);
    }
    return new Date(candidate).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  };
  const start = toStudioUtc(localWallTime);
  const durationMinutes = Number(String(request.details || "").match(/Duration:\s*(\d+)\s*minutes/i)?.[1] || 0);
  const end = durationMinutes > 0 ? toStudioUtc(localWallTime + durationMinutes * 60_000) : "";
  const escapeIcs = (value) => String(value || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Black Lion Studios//Client Calendar//EN", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT", `UID:bls-${Date.now()}@blacklionstudios.com`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
    `DTSTART:${start}`, ...(end ? [`DTEND:${end}`] : []), `SUMMARY:${escapeIcs(`Black Lion Studios consultation: ${request.project_type}`)}`,
    `DESCRIPTION:${escapeIcs(`Time converted from Black Lion Studios local time (America/New_York).\nRequest status: ${request.status || ""}`)}`,
    "END:VEVENT", "END:VCALENDAR"
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "black-lion-consultation.ics";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function DashboardApp({ initialState = null }) {
  const router = useRouter();
  const bookingAttemptRef = useRef({ startAt: "", id: "" });
  const [state, setState] = useState(initialState || emptyState);
  const [loading, setLoading] = useState(!initialState);
  const [requestMessage, setRequestMessage] = useState("");
  const [selectedService, setSelectedService] = useState(serviceOptions[0] || "");
  const [requestBudget, setRequestBudget] = useState("");
  const [requestTimeline, setRequestTimeline] = useState("");
  const [requestDetails, setRequestDetails] = useState("");
  const [requestStatusFilter, setRequestStatusFilter] = useState("all");
  const [requestSortOrder, setRequestSortOrder] = useState("newest");
  const [refreshingRequests, setRefreshingRequests] = useState(false);
  const [requestRefreshNotice, setRequestRefreshNotice] = useState("");
  const [requestRefreshError, setRequestRefreshError] = useState(false);
  const [requestDateNeedsConfirmation, setRequestDateNeedsConfirmation] = useState(false);
  const [requestReviewReady, setRequestReviewReady] = useState(false);
  const [hasSavedRequestDraft, setHasSavedRequestDraft] = useState(false);
  const [requestDraftMessage, setRequestDraftMessage] = useState("");
  const [requestValidationIssues, setRequestValidationIssues] = useState([]);
  const [sendingQuote, setSendingQuote] = useState(false);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [consultationAvailability, setConsultationAvailability] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [availabilityError, setAvailabilityError] = useState("");
  const [reschedulingRequestId, setReschedulingRequestId] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleAvailability, setRescheduleAvailability] = useState([]);
  const [rescheduleAvailabilityLoading, setRescheduleAvailabilityLoading] = useState(false);
  const [bookingActionId, setBookingActionId] = useState("");
  const [bookingNotice, setBookingNotice] = useState("");
  const [selectedConsultationDate, setSelectedConsultationDate] = useState("");
  const [selectedConsultationTime, setSelectedConsultationTime] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const service = findServiceBySlug(params.get("service"));
    if (service) setSelectedService(service.name);

    if (params.get("planner") === "1") {
      let restoredPlanner = false;
      try {
        const saved = JSON.parse(window.localStorage.getItem("bls-project-planner-v2") || "null");
        const savedServiceSlug = Array.isArray(saved?.services)
          ? saved.services.find((slug) => findServiceBySlug(slug))
          : "";
        if (saved && typeof saved === "object" && savedServiceSlug) {
          const plannerService = findServiceBySlug(savedServiceSlug);
          if (!service && plannerService) setSelectedService(plannerService.name);
          setRequestBudget(typeof saved.budget === "string" && saved.budget ? saved.budget : "To be discussed");
          setRequestTimeline([
            saved.timeline,
            saved.launchDate ? `Target launch: ${saved.launchDate}` : "",
            saved.eventDate ? `Event date: ${saved.eventDate}` : ""
          ].filter(Boolean).join(" · ") || "To be discussed");
          setRequestDetails(buildProjectBrief(saved));
          setRequestMessage("Your planner brief is ready in the request form. Review it and add or remove any details before submitting.");
          restoredPlanner = true;
        }
      } catch {
        restoredPlanner = false;
      }
      if (!restoredPlanner) {
        setRequestMessage("The saved planner draft was not available on this device. Return to Plan and download or copy the brief, then paste it into this request form.");
      }
      params.delete("planner");
      const query = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    }
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("bls-request-draft-v1") || "null");
      setHasSavedRequestDraft(Boolean(saved && saved.accountId && saved.accountId === state.user?.id));
    } catch {
      setRequestDraftMessage("This browser does not allow local draft storage.");
    }
  }, [state.user?.id]);

  function saveRequestDraft() {
    try {
      const draft = {
        accountId: state.user?.id || "",
        service: selectedService,
        budget: requestBudget,
        timeline: requestTimeline,
        details: requestDetails,
        consultationDate: selectedConsultationDate,
        consultationTime: selectedConsultationTime,
        savedAt: new Date().toISOString()
      };
      window.localStorage.setItem("bls-request-draft-v1", JSON.stringify(draft));
      setHasSavedRequestDraft(true);
      setRequestDraftMessage("Draft saved on this device only. It has not been sent to Black Lion Studios.");
    } catch {
      setRequestDraftMessage("Could not save this draft in the browser. You can still submit the request normally.");
    }
  }

  function restoreRequestDraft() {
    try {
      const draft = JSON.parse(window.localStorage.getItem("bls-request-draft-v1") || "null");
      if (!draft || typeof draft !== "object" || !state.user?.id || draft.accountId !== state.user.id) throw new Error("Draft unavailable");
      if (serviceOptions.includes(draft.service)) setSelectedService(draft.service);
      setRequestBudget(typeof draft.budget === "string" ? draft.budget : "");
      setRequestTimeline(typeof draft.timeline === "string" ? draft.timeline : "");
      setRequestDetails(typeof draft.details === "string" ? draft.details : "");
      if (typeof draft.consultationDate === "string") setSelectedConsultationDate(draft.consultationDate);
      if (typeof draft.consultationTime === "string") setSelectedConsultationTime(draft.consultationTime);
      setRequestDateNeedsConfirmation(Boolean(draft.consultationDate && !consultationAvailability.some((day) =>
        day.value === draft.consultationDate && (!draft.consultationTime || day.timeSlots.includes(draft.consultationTime))
      )));
      setRequestReviewReady(false);
      setRequestDraftMessage("Draft restored. Review it before submitting; nothing has been sent.");
    } catch {
      setHasSavedRequestDraft(false);
      setRequestDraftMessage("The saved draft could not be read. You can start a new request here.");
    }
  }

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

  useEffect(() => {
    let active = true;
    async function loadAvailability() {
      setAvailabilityLoading(true);
      setAvailabilityError("");
      const start = new Date();
      const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
      try {
        const { response, data } = await fetchJson(`/api/consultations/availability?startAt=${encodeURIComponent(start.toISOString())}&endAt=${encodeURIComponent(end.toISOString())}`, { cache: "no-store" });
        if (!response.ok) throw new Error(data.error || "Live consultation times could not be loaded.");
        const days = mapSquareAvailability(data.availability || []);
        if (active) {
          setConsultationAvailability(days);
          setSelectedConsultationDate((current) => days.some((day) => day.value === current) ? current : days[0]?.value || "");
          setSelectedConsultationTime((current) => days.some((day) => day.value === selectedConsultationDate && day.timeSlots.includes(current)) ? current : days[0]?.timeSlots[0] || "");
        }
      } catch (error) {
        if (active) {
          setConsultationAvailability([]);
          setAvailabilityError(error.message || "Live consultation times could not be loaded.");
        }
      } finally {
        if (active) setAvailabilityLoading(false);
      }
    }
    loadAvailability();
    return () => { active = false; };
  }, []);

  async function refreshDashboardState() {
    const { response, data } = await fetchJson("/api/dashboard", { cache: "no-store" });
    if (!response.ok) {
      return false;
    }
    setState(data);
    return true;
  }

  async function handleRefreshRequests() {
    if (refreshingRequests) return;
    setRefreshingRequests(true);
    setRequestRefreshNotice("");
    setRequestRefreshError(false);

    try {
      const { response, data } = await fetchJson("/api/dashboard", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Request history could not be refreshed.");
      }
      setState(data);
      setRequestRefreshNotice("Request history updated.");
    } catch {
      setRequestRefreshError(true);
      setRequestRefreshNotice("Could not refresh request history. Your current list is still available; try again or open Messages for help.");
    } finally {
      setRefreshingRequests(false);
    }
  }

  async function submitReschedule(requestId) {
    const day = rescheduleAvailability.find((item) => item.value === rescheduleDate);
    const slot = day?.slots?.find((item) => item.label === rescheduleTime);
    if (!slot?.startAt) {
      setBookingNotice("Choose a currently available time before rescheduling.");
      return;
    }
    setBookingActionId(requestId);
    setBookingNotice("");
    try {
      await patchJson("/api/consultations/bookings", { requestId, startAt: slot.startAt });
      await refreshDashboardState();
      setReschedulingRequestId("");
      setBookingNotice("Appointment time updated.");
    } catch (error) {
      setBookingNotice(error.message || "The appointment could not be rescheduled.");
    } finally {
      setBookingActionId("");
    }
  }

  async function openReschedule(requestId) {
    setReschedulingRequestId(requestId);
    setRescheduleAvailability([]);
    setRescheduleDate("");
    setRescheduleTime("");
    setAvailabilityError("");
    setRescheduleAvailabilityLoading(true);
    const start = new Date();
    const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
    try {
      const { response, data } = await fetchJson(`/api/consultations/availability?startAt=${encodeURIComponent(start.toISOString())}&endAt=${encodeURIComponent(end.toISOString())}&requestId=${encodeURIComponent(requestId)}`, { cache: "no-store" });
      if (!response.ok) throw new Error(data.error || "Appointment availability could not be loaded.");
      const days = mapSquareAvailability(data.availability || []);
      setRescheduleAvailability(days);
      setRescheduleDate(days[0]?.value || "");
      setRescheduleTime(days[0]?.timeSlots[0] || "");
    } catch (error) {
      setAvailabilityError(error.message || "Appointment availability could not be loaded.");
    } finally {
      setRescheduleAvailabilityLoading(false);
    }
  }

  async function cancelAppointment(requestId) {
    if (!window.confirm("Cancel this appointment? The studio may need to follow up about any separate project request or invoice.")) return;
    setBookingActionId(requestId);
    setBookingNotice("");
    try {
      const response = await authenticatedFetch("/api/consultations/bookings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The appointment could not be cancelled.");
      await refreshDashboardState();
      setBookingNotice("Appointment cancelled.");
    } catch (error) {
      setBookingNotice(error.message || "The appointment could not be cancelled.");
    } finally {
      setBookingActionId("");
    }
  }

  function useRequestAsStartingPoint(request) {
    const service = serviceOptions.includes(request.project_type)
      ? request.project_type
      : findServiceByName(request.project_type)?.name;
    if (service) setSelectedService(service);
    setRequestBudget(request.budget || "");
    setRequestTimeline(request.timeline || "");
    setRequestDetails(request.details || "");

    const existingDay = consultationAvailability.find((day) => day.value === request.consultation_date);
    const slotIsCurrent = Boolean(existingDay && (
      !request.consultation_time || existingDay.timeSlots.includes(request.consultation_time)
    ));
    if (request.consultation_date) setSelectedConsultationDate(request.consultation_date);
    if (request.consultation_time) setSelectedConsultationTime(request.consultation_time);
    setRequestDateNeedsConfirmation(Boolean(request.consultation_date && !slotIsCurrent));
    setRequestMessage(
      `Starting point copied. Review the form; nothing has been submitted.${request.consultation_date && !slotIsCurrent ? " The previous date or time may no longer be available, so choose a current consultation slot before submitting." : ""}`
    );

    requestAnimationFrame(() => {
      document.getElementById("service-request")?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById("request-service-select")?.focus({ preventScroll: true });
    });
  }

  async function handleRequest(event) {
    event.preventDefault();
    setRequestMessage("");
    const form = event.currentTarget;
    if (!requestReviewReady) {
      const issues = [];
      if (!selectedService) issues.push("Choose a service.");
      if (!requestBudget.trim()) issues.push("Add a budget range or explain that it is still to be discussed.");
      if (!requestTimeline.trim()) issues.push("Add an expected timeline.");
      if (!requestDetails.trim()) issues.push("Describe the project.");
      if (availabilityLoading) issues.push("Wait for live consultation availability to finish loading.");
      if (availabilityError || !consultationAvailability.length) issues.push("Live consultation availability is not available. Try again later or contact the studio.");
      if (requestDateNeedsConfirmation || !selectedConsultationTimeIsCurrent) issues.push("Choose a currently available consultation date and time.");
      setRequestValidationIssues(issues);
      if (issues.length) {
        setRequestMessage("Review the items listed below before continuing.");
        return;
      }
      setRequestReviewReady(true);
      setRequestMessage("Review the summary below, then submit when you are ready.");
      requestAnimationFrame(() => document.getElementById("request-review-summary")?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }
    if (requestDateNeedsConfirmation) {
      setRequestMessage("Choose a currently available consultation date and time before submitting.");
      return;
    }
    setSubmittingRequest(true);

    try {
      const formData = new FormData(form);
      const selectedSlot = selectedConsultationDay?.slots?.find((slot) => slot.label === selectedConsultationTime);
      if (!selectedSlot?.startAt) throw new Error("Choose a live consultation time before submitting.");
      if (bookingAttemptRef.current.startAt !== selectedSlot.startAt || !bookingAttemptRef.current.id) {
        bookingAttemptRef.current = {
          startAt: selectedSlot.startAt,
          id: createBookingAttemptUuid()
        };
      }
      await postJson("/api/requests", {
        ...Object.fromEntries(formData.entries()),
        startAt: selectedSlot.startAt,
        bookingAttemptId: bookingAttemptRef.current.id
      });
      bookingAttemptRef.current = { startAt: "", id: "" };
      await refreshDashboardState();
      form.reset();
      setSelectedService(serviceOptions[0] || "");
      setRequestBudget("");
      setRequestTimeline("");
      setRequestDetails("");
      setRequestDateNeedsConfirmation(false);
      setRequestReviewReady(false);
      try { window.localStorage.removeItem("bls-request-draft-v1"); } catch {}
      setHasSavedRequestDraft(false);
      setRequestDraftMessage("");
      setRequestValidationIssues([]);
      setSelectedConsultationDate(consultationAvailability[0]?.value || "");
      setSelectedConsultationTime(consultationAvailability[0]?.timeSlots?.[0] || "");
      setRequestMessage("Request submitted.");
      trackEvent("request_submitted", { service: formData.get("projectType") });
    } catch (error) {
      setRequestMessage(error.message);
    } finally {
      setSubmittingRequest(false);
    }
  }

  function applyEstimateToRequest(estimate) {
    setSelectedService(estimate.projectType);
    setRequestBudget(estimate.budget);
    setRequestTimeline(estimate.timeline);
    setRequestDetails(trimQuoteDetails(estimate.details));
    setRequestMessage("Estimate copied into the request form. Review it, then submit when ready.");
    requestAnimationFrame(() => {
      document.getElementById("service-request")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function sendQuoteToManager(estimate) {
    setRequestMessage("");
    setSendingQuote(true);

    try {
      const payload = {
        projectType: estimate.projectType,
        budget: estimate.budget,
        timeline: estimate.timeline,
        consultationDate: selectedConsultationDate,
        consultationTime: selectedConsultationTime,
        details: trimQuoteDetails([
          "Service Estimation quote sent from the client dashboard.",
          estimate.details,
          `Estimator handoff: estimated total cents ${estimate.estimateAmountCents || 0}; required deposit cents ${estimate.depositAmountCents || 0}.`,
          "Manager workflow: review the quote, approve or adjust scope, then continue billing and scheduling through Square."
        ].join(" "))
      };
      if (Number.isFinite(Number(estimate.estimateAmountCents))) {
        payload.estimateAmountCents = Number(estimate.estimateAmountCents);
      }
      if (Number.isFinite(Number(estimate.depositAmountCents))) {
        payload.depositAmountCents = Number(estimate.depositAmountCents);
      }
      await postJson("/api/requests", payload);
      await refreshDashboardState();
      setSelectedService(estimate.projectType);
      setRequestBudget(estimate.budget);
      setRequestTimeline(estimate.timeline);
      setRequestDetails(payload.details);
      setRequestMessage("Quote sent to the manager desk for review and Square workflow follow-up.");
      trackEvent("quote_sent_to_manager", { service: estimate.projectType });
    } catch (error) {
      setRequestMessage(error.message);
    } finally {
      setSendingQuote(false);
    }
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
  const consultationDateOptions = selectedConsultationDate && !consultationAvailability.some((day) => day.value === selectedConsultationDate)
    ? [{
        value: selectedConsultationDate,
        label: `${selectedConsultationDate} (previous request; reconfirm)`
      }, ...consultationAvailability]
    : consultationAvailability;
  const requestStatuses = [...new Set(
    state.requests.map((request) => String(request.status || "New").trim() || "New")
  )].sort((left, right) => left.localeCompare(right));
  const activeRequestStatus = requestStatuses.includes(requestStatusFilter) ? requestStatusFilter : "all";
  const visibleRequests = state.requests
    .filter((request) => activeRequestStatus === "all" || String(request.status || "New").trim() === activeRequestStatus)
    .slice()
    .sort((left, right) => {
      const leftDate = Date.parse(left.created_at || "") || 0;
      const rightDate = Date.parse(right.created_at || "") || 0;
      return requestSortOrder === "oldest" ? leftDate - rightDate : rightDate - leftDate;
    });
  const selectedConsultationDay =
    consultationAvailability.find((day) => day.value === selectedConsultationDate) ||
    (selectedConsultationDate
      ? {
          value: selectedConsultationDate,
          timeSlots: selectedConsultationTime
            ? [selectedConsultationTime]
            : []
        }
      : consultationAvailability[0]);
  const selectedConsultationTimeIsCurrent = Boolean(
    consultationAvailability.find((day) => day.value === selectedConsultationDate)?.timeSlots.includes(selectedConsultationTime)
  );
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

        <ServiceQuoteBuilder
          compact
          dashboard
          onApplyEstimate={applyEstimateToRequest}
          onSendQuote={sendQuoteToManager}
          sendingQuote={sendingQuote}
        />

        <section className="panel" id="service-request">
          <p className="label">Service request</p>
          <h2 className="editorial-heading">Tell Black Lion what you want built.</h2>
          <div className="request-draft-actions">
            <button type="button" className="button button-secondary" onClick={saveRequestDraft}>Save draft on this device</button>
            {hasSavedRequestDraft ? <button type="button" className="button button-secondary" onClick={restoreRequestDraft}>Restore saved draft</button> : null}
            {requestDraftMessage ? <p className="muted" role="status" aria-live="polite">{requestDraftMessage}</p> : null}
          </div>
          {requestValidationIssues.length ? (
            <div className="notice" role="alert" aria-labelledby="request-validation-title">
              <strong id="request-validation-title">A few details need attention</strong>
              <ul>{requestValidationIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
            </div>
          ) : null}
          <form className="form active" onSubmit={handleRequest}>
            <FormSectionCard title="Service setup" copy="Start with the branch, child service, and timing window.">
              <label>
                Service
                <select
                  name="projectType"
                  id="request-service-select"
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
                  disabled={availabilityLoading || consultationAvailability.length === 0}
                  onChange={(event) => {
                    const nextDate = event.target.value;
                    const nextDay = consultationAvailability.find((day) => day.value === nextDate);
                    setSelectedConsultationDate(nextDate);
                    setSelectedConsultationTime(nextDay?.timeSlots?.[0] || "");
                    if (nextDay) {
                      setRequestDateNeedsConfirmation(false);
                      setRequestMessage("");
                    }
                  }}
                >
                  {!consultationAvailability.length ? <option value="">{availabilityLoading ? "Loading live availability…" : "No times currently available"}</option> : null}
                  {consultationDateOptions.map((day) => (
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
                  onChange={(event) => {
                    setSelectedConsultationTime(event.target.value);
                    if (consultationAvailability.find((day) => day.value === selectedConsultationDate)?.timeSlots.includes(event.target.value)) {
                      setRequestDateNeedsConfirmation(false);
                      setRequestMessage("");
                    }
                  }}
                  required
                  disabled={availabilityLoading || !selectedConsultationDay?.timeSlots?.length}
                >
                  {!selectedConsultationDay?.timeSlots?.length ? <option value="">Choose a date with available times</option> : null}
                  {!selectedConsultationTimeIsCurrent && selectedConsultationTime ? (
                    <option value={selectedConsultationTime}>{selectedConsultationTime} (previous request; reconfirm)</option>
                  ) : null}
                  {(selectedConsultationDay?.timeSlots || []).map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </label>
              {availabilityError ? <p className="notice" role="alert">{availabilityError} The studio may need to configure Square availability.</p> : null}
              {requestDateNeedsConfirmation ? (
                <p className="notice" role="status" aria-live="polite">
                  The previous consultation slot is copied for reference. Choose a current date and time before submitting this new request.
                </p>
              ) : null}
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
                  maxLength={2000}
                  value={requestDetails}
                  onChange={(event) => setRequestDetails(event.target.value)}
                  required
                />
              </label>
              <FormHint>{requestDetails.length}/2,000 characters. Plain language is enough here; the goal is clarity, not technical detail.</FormHint>
            </FormSectionCard>
            {requestReviewReady ? (
              <section className="panel request-review-summary" id="request-review-summary" aria-labelledby="request-review-title">
                <p className="label">Final review</p>
                <h3 id="request-review-title">Check these details before sending</h3>
                <dl>
                  <div><dt>Service</dt><dd>{selectedService}</dd></div>
                  <div><dt>Consultation</dt><dd>{selectedConsultationDate} at {selectedConsultationTime}</dd></div>
                  <div><dt>Budget</dt><dd>{requestBudget}</dd></div>
                  <div><dt>Timeline</dt><dd>{requestTimeline}</dd></div>
                  <div><dt>Project details</dt><dd style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{requestDetails}</dd></div>
                </dl>
                {requestDateNeedsConfirmation ? <p className="notice" role="alert">Choose a currently available consultation date and time before submitting.</p> : null}
                <button type="button" className="button button-secondary" onClick={() => setRequestReviewReady(false)}>Edit request</button>
              </section>
            ) : null}
            <button type="submit" className="button" disabled={submittingRequest}>
              {submittingRequest ? "Submitting request..." : requestReviewReady ? "Submit request" : "Review request"}
            </button>
          </form>
          <p className={`message ${requestMessage ? "is-visible" : ""}`} role="status" aria-live="polite">
            {requestMessage}
          </p>
        </section>

        <section className="two-column">
          <div className="panel">
            <div className="planner-heading">
              <div>
                <p className="label">Activity</p>
                <h2 className="editorial-heading">Your requests</h2>
              </div>
              <button type="button" className="button button-secondary" onClick={handleRefreshRequests} disabled={refreshingRequests}>
                {refreshingRequests ? "Refreshing…" : "Refresh status"}
              </button>
            </div>
            <SupportNotice
              title="Request history"
              copy="Every submitted request stays here so you can track status and revisit the brief. Status changes made by the studio appear when you refresh."
            />
            <div className="two-column" aria-label="Request history controls">
              <label>
                Filter by status
                <select value={activeRequestStatus} onChange={(event) => {
                  setRequestStatusFilter(event.target.value);
                  setRequestRefreshNotice("");
                  setRequestRefreshError(false);
                }}>
                  <option value="all">All statuses ({state.requests.length})</option>
                  {requestStatuses.map((status) => (
                    <option value={status} key={status}>
                      {status} ({state.requests.filter((request) => (String(request.status || "New").trim() || "New") === status).length})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Sort requests
                <select value={requestSortOrder} onChange={(event) => {
                  setRequestSortOrder(event.target.value);
                  setRequestRefreshNotice("");
                  setRequestRefreshError(false);
                }}>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </label>
            </div>
            <p className="muted" aria-live="polite">
              Showing {visibleRequests.length} of {state.requests.length} requests.
            </p>
            {requestRefreshNotice ? (
              <p className={requestRefreshError ? "notice" : "muted"} role={requestRefreshError ? "alert" : "status"} aria-live={requestRefreshError ? "assertive" : "polite"}>
                {requestRefreshNotice}
              </p>
            ) : null}
            {bookingNotice ? <p className="message is-visible" role="status" aria-live="polite">{bookingNotice}</p> : null}
            <SurfaceGrid className="stack-small">
              {state.requests.length === 0 ? (
                <p className="muted">No requests yet.</p>
              ) : visibleRequests.length === 0 ? (
                <p className="muted">No requests have this status. Choose another filter to see the rest of your history.</p>
              ) : (
                visibleRequests.map((request) => (
                  <SpotlightCard
                    className="request-card"
                    key={request.id}
                    eyebrow={request.status}
                    title={request.project_type}
                    copy={`${request.consultation_date || "No consultation date"} • ${request.budget || "No budget"}`}
                  >
                    <p className="muted">{request.timeline || "No timeline yet"}</p>
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => useRequestAsStartingPoint(request)}
                    >
                      Use as starting point
                    </button>
                    <details className="request-history-details">
                      <summary>View project and appointment details</summary>
                      <dl>
                        <div><dt>Request ID</dt><dd>{request.id}</dd></div>
                        <div><dt>Submitted</dt><dd>{formatRequestDate(request.created_at)}</dd></div>
                        <div><dt>Source</dt><dd>{request.source || "Website"}</dd></div>
                        <div>
                          <dt>Consultation</dt>
                          <dd>{request.consultation_date
                            ? `${request.consultation_date}${request.consultation_time ? ` at ${request.consultation_time}` : ""}`
                            : "Not scheduled"}</dd>
                        </div>
                        <div className="request-history-brief">
                          <dt>Project details</dt>
                          <dd style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{request.details || "No project details were saved with this request."}</dd>
                        </div>
                      </dl>
                      <div className="request-activity-timeline" aria-label="Request activity timeline">
                        <h3>Activity</h3>
                        <ol>
                          {(request.client_activity?.length
                            ? request.client_activity
                            : [{ label: "Request submitted", created_at: request.created_at }]
                          ).map((activity, index) => (
                            <li key={`${activity.created_at || "activity"}-${index}`}>
                              <time dateTime={activity.created_at || undefined}>{formatRequestDate(activity.created_at)}</time>
                              <span>{activity.label}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </details>
                    <p className="muted">
                      Next step: {request.square_invoice_url
                        ? "Review and pay the Square invoice."
                        : request.source === "Square Appointments"
                          ? "Contact the studio if you also need a separate project request."
                          : ["Completed", "Delivered"].includes(String(request.status || "").trim())
                            ? "Review the delivery and message the studio if anything needs attention."
                            : ["Declined", "Cancelled"].includes(String(request.status || "").trim())
                              ? "Message the studio to discuss another approach."
                              : "Watch for a status update or studio message."}
                    </p>
                    {request.square_invoice_url && !["paid", "completed", "refunded"].includes(String(request.invoice_status || "").toLowerCase()) ? (
                      <p className="notice" role="status"><strong>Action needed:</strong> review the Square invoice to continue.</p>
                    ) : null}
                    <div className="request-export-actions">
                      <button type="button" className="button button-secondary" onClick={() => downloadClientRequest(request)}>
                        Download request copy
                      </button>
                      {(request.source === "Square Appointments" || request.square_booking_id || request.square_appointment_id) && ["Booked", "Confirmed", "Scheduled"].includes(String(request.status || "").trim()) && request.consultation_date && request.consultation_time ? (
                        <button type="button" className="button button-secondary" onClick={() => exportAppointmentCalendarFile(request)}>
                          Add appointment to calendar
                        </button>
                      ) : null}
                    </div>
                    {(request.source === "Square Appointments" || request.square_booking_id || request.square_appointment_id) && ["Booked", "Confirmed", "Scheduled"].includes(String(request.status || "").trim()) ? (
                      <div className="appointment-self-service">
                        <p className="label">Appointment options</p>
                        {reschedulingRequestId === request.id ? (
                          <div className="form active">
                            <label>
                              New date
                              <select value={rescheduleDate} onChange={(event) => {
                                setRescheduleDate(event.target.value);
                                setRescheduleTime(rescheduleAvailability.find((day) => day.value === event.target.value)?.timeSlots?.[0] || "");
                              }} disabled={rescheduleAvailabilityLoading || !rescheduleAvailability.length}>
                                {rescheduleAvailability.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
                              </select>
                            </label>
                            <label>
                              New time
                              <select value={rescheduleTime} onChange={(event) => setRescheduleTime(event.target.value)} disabled={rescheduleAvailabilityLoading || !rescheduleAvailability.find((day) => day.value === rescheduleDate)?.timeSlots?.length}>
                                {(rescheduleAvailability.find((day) => day.value === rescheduleDate)?.timeSlots || []).map((time) => <option key={time}>{time}</option>)}
                              </select>
                            </label>
                            {rescheduleAvailabilityLoading ? <p className="muted" role="status">Checking times for this appointment…</p> : null}
                            {!rescheduleAvailabilityLoading && !rescheduleAvailability.length && !availabilityError ? <p className="muted">No replacement times are currently available.</p> : null}
                            {availabilityError ? <p className="notice" role="alert">Live Square availability could not be loaded: {availabilityError}</p> : null}
                            <div className="actions">
                              <button type="button" className="button" disabled={bookingActionId === request.id || !rescheduleTime} onClick={() => submitReschedule(request.id)}>{bookingActionId === request.id ? "Updating…" : "Confirm new time"}</button>
                              <button type="button" className="button button-secondary" onClick={() => setReschedulingRequestId("")}>Keep current time</button>
                            </div>
                          </div>
                        ) : (
                          <div className="actions">
                            <button type="button" className="button button-secondary" disabled={availabilityLoading || !consultationAvailability.length} onClick={() => openReschedule(request.id)}>Request a new time</button>
                            <button type="button" className="button button-secondary" disabled={bookingActionId === request.id} onClick={() => cancelAppointment(request.id)}>{bookingActionId === request.id ? "Cancelling…" : "Cancel appointment"}</button>
                          </div>
                        )}
                      </div>
                    ) : null}
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
                    <RequestAssetsPanel requestId={request.id} />
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

      </main>
    </div>
  );
}
