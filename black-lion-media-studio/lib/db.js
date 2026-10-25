import crypto from "node:crypto";
import { promisify } from "node:util";
import { FieldPath } from "firebase-admin/firestore";
import { getDb } from "./firebase-admin";
import { isBookingManager } from "./booking-manager";

const USERS = "users";
const SESSIONS = "sessions";
const REQUESTS = "service_requests";
const MESSAGES = "messages";
const MODEL_APPLICATIONS = "model_applications";
const MODEL_APPLICATION_LOCKS = "model_application_locks";
const USERNAME_RESERVATIONS = "username_reservations";
const USER_SCHEMA_VERSION = 2;
const MODEL_REAPPLICATION_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
const MESSAGE_PAGE_SIZE = 30;
const MESSAGE_PREVIEW_SIZE = 5;
const MANAGER_REQUEST_PAGE_SIZE = 500;
const scryptAsync = promisify(crypto.scrypt.bind(crypto));
const PRIVATE_MANAGER_REQUEST_FIELDS = [
  "billing_name", "billing_email", "billing_address", "preferred_payment_method",
  "budget_profile", "shipping_name", "shipping_address", "shipping_city",
  "shipping_region", "shipping_postal_code", "shipping_country", "tax_id"
];
const MANAGER_USER_CONTEXT_FIELDS = [
  "full_name", "email", "company", "client_tier", "user_type", "lifecycle_stage",
  "lead_source", "phone", "website", "billing_name", "billing_email",
  "preferred_payment_method", "shipping_name", "shipping_address"
];
const MODEL_PROFILE_FIELDS = [
  "full_name", "username", "email", "phone", "instagram", "website", "pronouns",
  "project_goals", "lifecycle_stage", "created_at", "last_profile_update_at",
  ...[
    "city", "modelCity", "instagram", "portfolioUrl", "pronouns", "projectTypes",
    "modelingInterests", "availability", "experience", "relevantSkills",
    "travelReadiness", "compensationExpectation", "usageComfort", "wardrobeComfort",
    "productionPace", "qualityStandards", "reliabilityExamples", "preparationProcess",
    "modelQueueStatus", "modelNoShowCount", "modelReapplicationWindow"
  ].map((field) => new FieldPath("profile_fields", field))
];
const MANAGER_REQUEST_FIELDS = [
  "user_id", "source", "project_type", "budget", "timeline", "consultation_date",
  "consultation_time", "details", "status", "manager_notes", "invoice_status",
  "payment_status", "fulfillment_status", "internal_priority", "created_at", "created_at_ms",
  "updated_at", "last_manager_update_at", "square_customer_id", "client_name",
  "client_email", "estimate_amount_cents", "deposit_amount_cents", "invoice_amount_cents",
  "invoice_due_date", "invoice_sent_at", "square_invoice_id", "square_invoice_number",
  "square_invoice_url"
];
const CLIENT_REQUEST_FIELDS = [
  "budget", "timeline", "details", "status", "source", "project_type",
  "consultation_date", "consultation_time", "created_at", "created_at_ms",
  "invoice_status", "invoice_amount_cents", "square_invoice_url", "client_activity",
  "square_booking_id", "square_booking_status", "square_booking_url"
];

function appendClientActivity(existing = [], additions = []) {
  const previous = Array.isArray(existing) ? existing : [];
  return [...previous, ...additions].slice(-50);
}

function clientActivityEvent(label, createdAt = isoNow()) {
  return { label: String(label || "Update").slice(0, 180), created_at: createdAt };
}

export class ModelApplicationConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = "ModelApplicationConflictError";
    this.code = "MODEL_APPLICATION_CONFLICT";
  }
}

const USER_DEFAULTS = {
  full_name: "",
  username: "",
  email: "",
  email_lower: "",
  company: "",
  phone: "",
  service_interest: "",
  account_status: "Active",
  client_tier: "Standard",
  user_type: "Individual",
  roles: ["client"],
  lifecycle_stage: "New Lead",
  lead_source: "Website",
  preferred_language: "English",
  pronouns: "",
  website: "",
  instagram: "",
  tiktok: "",
  youtube: "",
  merch_interest: "Both",
  preferred_contact_method: "Email",
  notification_opt_in: "true",
  marketing_opt_in: "false",
  timezone: "America/New_York",
  client_notes: "",
  project_goals: "",
  referral_source: "",
  accessibility_notes: "",
  billing_name: "",
  billing_email: "",
  billing_address: "",
  preferred_payment_method: "",
  budget_profile: "",
  shipping_name: "",
  shipping_address: "",
  shipping_city: "",
  shipping_region: "",
  shipping_postal_code: "",
  shipping_country: "United States",
  tax_id: "",
  profile_fields: {},
  is_booking_manager: false,
  last_sign_in_at: "",
  last_profile_update_at: "",
  last_portal_activity_at: ""
};

function isoNow() {
  return new Date().toISOString();
}

function timestampNow() {
  return Date.now();
}

function asText(value, fallback = "") {
  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value).trim();
}

function asBooleanString(value, fallback = "false") {
  if (value === true || value === "true") {
    return "true";
  }

  if (value === false || value === "false") {
    return "false";
  }

  return fallback;
}

function asStringArray(value, fallback = []) {
  const source = Array.isArray(value) ? value : fallback;
  return [...new Set(source.map((item) => asText(item)).filter(Boolean))];
}

function sanitizeProfileFields(fields) {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(fields)
      .map(([key, value]) => [asText(key).slice(0, 80), asText(value).slice(0, 2000)])
      .filter(([key, value]) => key && value)
      .slice(0, 80)
  );
}

function normalizeEmail(email) {
  return asText(email).toLowerCase();
}

function hashKey(value) {
  return crypto.createHash("sha256").update(asText(value).toLowerCase()).digest("hex");
}

function buildUserRecord(data = {}) {
  const merged = { ...USER_DEFAULTS, ...data };
  const email = normalizeEmail(merged.email);
  const isManager = merged.is_booking_manager === true || isBookingManager(merged);
  const roles = asStringArray(merged.roles, ["client"]);

  if (isManager && !roles.includes("manager")) {
    roles.push("manager");
  }

  return {
    ...merged,
    schema_version: Number(merged.schema_version || USER_SCHEMA_VERSION),
    full_name: asText(merged.full_name),
    username: asText(merged.username).toLowerCase(),
    email,
    email_lower: normalizeEmail(merged.email_lower || email),
    company: asText(merged.company),
    phone: asText(merged.phone),
    service_interest: asText(merged.service_interest),
    account_status: asText(merged.account_status, USER_DEFAULTS.account_status),
    client_tier: asText(merged.client_tier, USER_DEFAULTS.client_tier),
    user_type: asText(merged.user_type, USER_DEFAULTS.user_type),
    roles,
    lifecycle_stage: asText(merged.lifecycle_stage, USER_DEFAULTS.lifecycle_stage),
    lead_source: asText(merged.lead_source, USER_DEFAULTS.lead_source),
    preferred_language: asText(merged.preferred_language, USER_DEFAULTS.preferred_language),
    pronouns: asText(merged.pronouns),
    website: asText(merged.website),
    instagram: asText(merged.instagram),
    tiktok: asText(merged.tiktok),
    youtube: asText(merged.youtube),
    merch_interest: asText(merged.merch_interest, USER_DEFAULTS.merch_interest),
    preferred_contact_method: asText(merged.preferred_contact_method, USER_DEFAULTS.preferred_contact_method),
    notification_opt_in: asBooleanString(merged.notification_opt_in, USER_DEFAULTS.notification_opt_in),
    marketing_opt_in: asBooleanString(merged.marketing_opt_in, USER_DEFAULTS.marketing_opt_in),
    timezone: asText(merged.timezone, USER_DEFAULTS.timezone),
    client_notes: asText(merged.client_notes),
    project_goals: asText(merged.project_goals),
    referral_source: asText(merged.referral_source),
    accessibility_notes: asText(merged.accessibility_notes),
    billing_name: asText(merged.billing_name),
    billing_email: normalizeEmail(merged.billing_email),
    billing_address: asText(merged.billing_address),
    preferred_payment_method: asText(merged.preferred_payment_method),
    budget_profile: asText(merged.budget_profile),
    shipping_name: asText(merged.shipping_name),
    shipping_address: asText(merged.shipping_address),
    shipping_city: asText(merged.shipping_city),
    shipping_region: asText(merged.shipping_region),
    shipping_postal_code: asText(merged.shipping_postal_code),
    shipping_country: asText(merged.shipping_country, USER_DEFAULTS.shipping_country),
    tax_id: asText(merged.tax_id),
    profile_fields: sanitizeProfileFields(merged.profile_fields),
    is_booking_manager: isManager,
    created_at: merged.created_at || "",
    last_sign_in_at: merged.last_sign_in_at || "",
    last_profile_update_at: merged.last_profile_update_at || "",
    last_portal_activity_at: merged.last_portal_activity_at || ""
  };
}

function mapUserDocument(id, data) {
  if (!data) {
    return null;
  }

  const user = buildUserRecord(data);

  return {
    id,
    ...user,
    password_hash: data.password_hash,
    created_at: user.created_at || data.created_at
  };
}

function sortNewest(items) {
  const sortTime = (item) => {
    const storedTimestamp = Number(item.created_at_ms);
    if (Number.isFinite(storedTimestamp) && storedTimestamp > 0) return storedTimestamp;
    const parsedTimestamp = Date.parse(item.created_at || "");
    return Number.isFinite(parsedTimestamp) ? parsedTimestamp : 0;
  };
  return items.sort((a, b) => sortTime(b) - sortTime(a));
}

function timestampToMs(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value.toMillis === "function") return value.toMillis();
  if (value && typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeRequestDocument(id, data) {
  return {
    id,
    ...data,
    source: data.source || "Website",
    square_booking_id: data.square_booking_id || "",
    square_booking_status: data.square_booking_status || "",
    square_booking_version: data.square_booking_version || 0,
    square_booking_url: data.square_booking_url || "",
    square_location_id: data.square_location_id || "",
    square_customer_id: data.square_customer_id || "",
    square_order_id: data.square_order_id || "",
    square_invoice_id: data.square_invoice_id || "",
    square_invoice_version: data.square_invoice_version || "",
    square_invoice_number: data.square_invoice_number || "",
    square_invoice_url: data.square_invoice_url || "",
    estimate_amount_cents: Number(data.estimate_amount_cents || 0),
    deposit_amount_cents: Number(data.deposit_amount_cents || 0),
    invoice_amount_cents: data.invoice_amount_cents || 0,
    invoice_due_date: data.invoice_due_date || "",
    invoice_sent_at: data.invoice_sent_at || "",
    manager_notes: data.manager_notes || "",
    invoice_status: data.invoice_status || "Pending",
    payment_status: data.payment_status || "Pending",
    fulfillment_status: data.fulfillment_status || "Queued",
    internal_priority: data.internal_priority || "Standard",
    updated_at: data.updated_at || data.created_at || "",
    last_manager_update_at: data.last_manager_update_at || ""
  };
}

export async function attachInvoiceToRequest(requestId, invoiceData) {
  const db = getDb();
  const updatedAt = isoNow();
  const requestRef = db.collection(REQUESTS).doc(requestId);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(requestRef);
    if (!snapshot.exists) return;
    const existing = snapshot.data();
    const activity = existing.invoice_status === "Sent"
      ? (Array.isArray(existing.client_activity) ? existing.client_activity : [])
      : appendClientActivity(existing.client_activity, [clientActivityEvent("Square invoice sent", updatedAt)]);
    transaction.set(requestRef, {
      square_customer_id: invoiceData.squareCustomerId || "",
      square_order_id: invoiceData.squareOrderId || "",
      square_invoice_id: invoiceData.squareInvoiceId || "",
      square_invoice_version: invoiceData.squareInvoiceVersion || "",
      square_invoice_number: invoiceData.squareInvoiceNumber || "",
      square_invoice_url: invoiceData.squareInvoiceUrl || "",
      invoice_amount_cents: invoiceData.invoiceAmountCents || 0,
      invoice_due_date: invoiceData.invoiceDueDate || "",
      invoice_sent_at: updatedAt,
      invoice_status: "Sent",
      payment_status: "Pending",
      status: "Awaiting Payment",
      updated_at: updatedAt,
      updated_at_ms: timestampNow(),
      last_manager_update_at: updatedAt,
      client_activity: activity
    }, { merge: true });
  });
}

export async function recordSquarePaymentEvent({ eventId, payment }) {
  const db = getDb();
  const eventKey = crypto.createHash("sha256").update(String(eventId || "")).digest("hex");
  const paymentId = asText(payment?.id);
  const orderId = asText(payment?.order_id);
  if (!eventId || !paymentId || !orderId) return { recorded: false, reason: "missing_reference" };

  const requestQuery = await db.collection(REQUESTS).where("square_order_id", "==", orderId).limit(1).get();
  if (requestQuery.empty) return { recorded: false, reason: "request_not_found" };
  const requestDoc = requestQuery.docs[0];
  const requestRef = requestDoc.ref;
  const eventRef = db.collection("square_payment_events").doc(eventKey);
  const paymentStatus = asText(payment.status, "UNKNOWN").toUpperCase();
  const amount = Number(payment.amount_money?.amount || 0);
  const paymentUpdatedAt = asText(payment.updated_at || payment.created_at, isoNow());
  const receiptUrl = asText(payment.receipt_url);

  return db.runTransaction(async (transaction) => {
    const [eventSnapshot, requestSnapshot] = await Promise.all([
      transaction.get(eventRef),
      transaction.get(requestRef)
    ]);
    if (eventSnapshot.exists) return { recorded: false, duplicate: true };
    if (!requestSnapshot.exists) return { recorded: false, reason: "request_not_found" };

    const request = requestSnapshot.data();
    const paymentEvent = {
      kind: "payment",
      event_id: eventKey,
      payment_id: paymentId,
      order_id: orderId,
      status: paymentStatus,
      amount_cents: Number.isInteger(amount) && amount >= 0 ? amount : 0,
      refunded_amount_cents: Math.max(0, Number(payment.refunded_money?.amount || 0)),
      currency: asText(payment.amount_money?.currency, "USD"),
      receipt_url: receiptUrl,
      created_at: paymentUpdatedAt
    };
    const history = Array.isArray(request.square_payment_events) ? request.square_payment_events : [];
    const paymentStatusLabel = paymentStatus === "COMPLETED" ? "Paid" : paymentStatus === "FAILED" ? "Failed" : paymentStatus;
    const latestPayments = request.square_payments && typeof request.square_payments === "object" ? request.square_payments : {};
    const previousPayment = latestPayments[paymentId];
    const previousUpdatedMs = Date.parse(previousPayment?.updated_at || "") || 0;
    const incomingUpdatedMs = Date.parse(paymentUpdatedAt) || 0;
    const paymentIsLatest = !previousPayment || incomingUpdatedMs >= previousUpdatedMs;
    const nextPayments = paymentIsLatest
      ? { ...latestPayments, [paymentId]: { status: paymentStatus, amount_cents: paymentEvent.amount_cents, refunded_amount_cents: paymentEvent.refunded_amount_cents, currency: paymentEvent.currency, receipt_url: receiptUrl, updated_at: paymentUpdatedAt } }
      : latestPayments;
    const allPayments = Object.entries(nextPayments);
    const refunds = request.square_refunds && typeof request.square_refunds === "object" ? request.square_refunds : {};
    const completedGrossAmount = allPayments
      .filter(([, item]) => item.status === "COMPLETED")
      .reduce((sum, [, item]) => sum + Math.max(0, Number(item.amount_cents || 0)), 0);
    const completedAmount = allPayments
      .filter(([, item]) => item.status === "COMPLETED")
      .reduce((sum, [id, item]) => {
        const eventRefundedAmount = Object.values(refunds)
          .filter((refund) => refund.payment_id === id && refund.status === "COMPLETED")
          .reduce((refundSum, refund) => refundSum + Math.max(0, Number(refund.amount_cents || 0)), 0);
        const refundedAmount = Math.max(eventRefundedAmount, Number(item.refunded_amount_cents || 0));
        return sum + Math.max(0, Number(item.amount_cents || 0) - refundedAmount);
      }, 0);
    const invoiceAmount = Math.max(0, Number(request.invoice_amount_cents || 0));
    const hasPendingPayment = allPayments.some(([, item]) => ["APPROVED", "PENDING"].includes(item.status));
    const hasFailedPayment = allPayments.some(([, item]) => item.status === "FAILED");
    const completedRefundAmount = allPayments
      .filter(([, item]) => item.status === "COMPLETED")
      .reduce((sum, [id, item]) => {
        const eventRefundedAmount = Object.values(refunds)
          .filter((refund) => refund.payment_id === id && refund.status === "COMPLETED")
          .reduce((refundSum, refund) => refundSum + Math.max(0, Number(refund.amount_cents || 0)), 0);
        return sum + Math.max(eventRefundedAmount, Number(item.refunded_amount_cents || 0));
      }, 0);
    const nextStatus = completedAmount > 0
      ? (invoiceAmount === 0 || completedAmount >= invoiceAmount ? "Paid" : "Partially Paid")
      : hasPendingPayment
        ? "Pending"
        : completedGrossAmount > 0 && completedRefundAmount >= completedGrossAmount
          ? "Refunded"
          : hasFailedPayment
          ? "Failed"
          : "Pending";
    const receivedAt = isoNow();
    const activity = paymentIsLatest
      ? appendClientActivity(request.client_activity, [clientActivityEvent(
        `Square payment ${paymentStatusLabel.toLowerCase()}${amount ? `: $${(amount / 100).toFixed(2)}` : ""}.`, paymentUpdatedAt
      )])
      : (Array.isArray(request.client_activity) ? request.client_activity : []);
    const nextHistory = [...history, paymentEvent]
      .sort((a, b) => (Date.parse(a.created_at || "") || 0) - (Date.parse(b.created_at || "") || 0))
      .slice(-50);
    transaction.create(eventRef, { ...paymentEvent, request_id: requestDoc.id });
    transaction.set(db.collection("square_payment_links").doc(crypto.createHash("sha256").update(paymentId).digest("hex")), {
      payment_id: paymentId,
      order_id: orderId,
      request_id: requestDoc.id,
      updated_at: paymentUpdatedAt
    }, { merge: true });
    transaction.set(requestRef, {
      square_payment_events: nextHistory,
      square_payments: nextPayments,
      square_net_paid_amount_cents: completedAmount,
      payment_status: nextStatus,
      updated_at: receivedAt,
      updated_at_ms: timestampNow(),
      client_activity: activity
    }, { merge: true });
    return { recorded: true, requestId: requestDoc.id };
  });
}

export async function recordSquareRefundEvent({ eventId, refund, eventCreatedAt = "" }) {
  const db = getDb();
  const refundId = asText(refund?.id);
  const paymentId = asText(refund?.payment_id);
  const orderId = asText(refund?.order_id);
  if (!eventId || !refundId || !paymentId) return { recorded: false, reason: "missing_reference" };

  let requestDoc = null;
  if (orderId) {
    const matches = await db.collection(REQUESTS).where("square_order_id", "==", orderId).limit(1).get();
    requestDoc = matches.docs[0] || null;
  }
  if (!requestDoc) {
    const linkId = crypto.createHash("sha256").update(paymentId).digest("hex");
    const paymentLink = await db.collection("square_payment_links").doc(linkId).get();
    const linkedRequestId = paymentLink.exists ? asText(paymentLink.data()?.request_id) : "";
    if (linkedRequestId) {
      const linkedRequest = await db.collection(REQUESTS).doc(linkedRequestId).get();
      if (linkedRequest.exists) requestDoc = linkedRequest;
    }
  }
  if (!requestDoc) return { recorded: false, reason: "request_not_found" };

  const requestRef = requestDoc.ref;
  const eventKey = crypto.createHash("sha256").update(String(eventId)).digest("hex");
  const eventRef = db.collection("square_payment_events").doc(eventKey);
  const refundStatus = asText(refund.status, "UNKNOWN").toUpperCase();
  const amount = Number(refund.amount_money?.amount || 0);
  const refundUpdatedAt = asText(refund.updated_at || refund.created_at || eventCreatedAt, isoNow());
  return db.runTransaction(async (transaction) => {
    const [eventSnapshot, requestSnapshot] = await Promise.all([
      transaction.get(eventRef), transaction.get(requestRef)
    ]);
    if (eventSnapshot.exists) return { recorded: false, duplicate: true };
    if (!requestSnapshot.exists) return { recorded: false, reason: "request_not_found" };

    const request = requestSnapshot.data();
    const refundEvent = {
      kind: "refund",
      event_id: eventKey,
      refund_id: refundId,
      payment_id: paymentId,
      order_id: orderId || asText(request.square_order_id),
      status: refundStatus,
      amount_cents: Number.isInteger(amount) && amount >= 0 ? amount : 0,
      currency: asText(refund.amount_money?.currency, "USD"),
      receipt_url: "",
      created_at: refundUpdatedAt
    };
    const refunds = request.square_refunds && typeof request.square_refunds === "object" ? request.square_refunds : {};
    const previous = refunds[refundId];
    const previousUpdatedMs = Date.parse(previous?.updated_at || "") || 0;
    const incomingUpdatedMs = Date.parse(refundUpdatedAt) || 0;
    const refundIsLatest = !previous || incomingUpdatedMs >= previousUpdatedMs;
    const nextRefunds = refundIsLatest
      ? { ...refunds, [refundId]: {
        status: refundStatus,
        amount_cents: refundEvent.amount_cents,
        currency: refundEvent.currency,
        payment_id: paymentId,
        order_id: refundEvent.order_id,
        updated_at: refundUpdatedAt
      } }
      : refunds;
    const payments = request.square_payments && typeof request.square_payments === "object" ? request.square_payments : {};
    const allPayments = Object.entries(payments);
    const completedGrossAmount = allPayments
      .filter(([, item]) => item.status === "COMPLETED")
      .reduce((sum, [, item]) => sum + Math.max(0, Number(item.amount_cents || 0)), 0);
    const completedAmount = allPayments
      .filter(([, item]) => item.status === "COMPLETED")
      .reduce((sum, [id, item]) => {
        const refundAmount = Object.values(nextRefunds)
          .filter((entry) => entry.payment_id === id && entry.status === "COMPLETED")
          .reduce((refundSum, entry) => refundSum + Math.max(0, Number(entry.amount_cents || 0)), 0);
        return sum + Math.max(0, Number(item.amount_cents || 0) - Math.max(refundAmount, Number(item.refunded_amount_cents || 0)));
      }, 0);
    const invoiceAmount = Math.max(0, Number(request.invoice_amount_cents || 0));
    const completedRefundAmount = allPayments
      .filter(([, item]) => item.status === "COMPLETED")
      .reduce((sum, [id, item]) => {
        const eventRefundedAmount = Object.values(nextRefunds)
          .filter((refund) => refund.payment_id === id && refund.status === "COMPLETED")
          .reduce((refundSum, refund) => refundSum + Math.max(0, Number(refund.amount_cents || 0)), 0);
        return sum + Math.max(eventRefundedAmount, Number(item.refunded_amount_cents || 0));
      }, 0);
    const hasPendingPayment = allPayments.some(([, item]) => ["APPROVED", "PENDING"].includes(item.status));
    const hasFailedPayment = allPayments.some(([, item]) => item.status === "FAILED");
    const nextStatus = completedAmount > 0
      ? (invoiceAmount === 0 || completedAmount >= invoiceAmount ? "Paid" : "Partially Paid")
      : hasPendingPayment
        ? "Pending"
        : completedGrossAmount > 0 && completedRefundAmount >= completedGrossAmount
          ? "Refunded"
          : hasFailedPayment ? "Failed" : "Pending";
    const history = Array.isArray(request.square_payment_events) ? request.square_payment_events : [];
    const nextHistory = [...history, refundEvent]
      .sort((a, b) => (Date.parse(a.created_at || "") || 0) - (Date.parse(b.created_at || "") || 0))
      .slice(-50);
    transaction.create(eventRef, { ...refundEvent, request_id: requestDoc.id });
    transaction.set(requestRef, {
      square_refunds: nextRefunds,
      square_payment_events: nextHistory,
      square_net_paid_amount_cents: completedAmount,
      payment_status: nextStatus,
      updated_at: isoNow(),
      updated_at_ms: timestampNow(),
      client_activity: refundIsLatest
        ? appendClientActivity(request.client_activity, [clientActivityEvent(
          `Square refund ${refundStatus.toLowerCase()}${amount ? `: $${(amount / 100).toFixed(2)}` : ""}.`, refundUpdatedAt
        )])
        : (Array.isArray(request.client_activity) ? request.client_activity : [])
    }, { merge: true });
    return { recorded: true, requestId: requestDoc.id };
  });
}

export async function listSquarePaymentEventsForRequest(userId, requestId) {
  const db = getDb();
  const requestRef = db.collection(REQUESTS).doc(requestId);
  const requestDoc = await requestRef.get();
  if (!requestDoc.exists || requestDoc.data()?.user_id !== userId) return null;
  const events = Array.isArray(requestDoc.data()?.square_payment_events) ? requestDoc.data().square_payment_events : [];
  return {
    payments: events.map((event) => ({
    kind: asText(event.kind, "payment"),
    status: asText(event.status),
    amountCents: Number(event.amount_cents || 0),
    currency: asText(event.currency, "USD"),
    receiptUrl: asText(event.receipt_url),
    createdAt: asText(event.created_at),
    paymentId: asText(event.payment_id),
    refundId: asText(event.refund_id)
    })),
    netPaidAmountCents: Number(requestDoc.data()?.square_net_paid_amount_cents || 0),
    paymentStatus: asText(requestDoc.data()?.payment_status, "Pending")
  };
}

export async function saveRequestAttachment({ userId, requestId, attachment }) {
  const db = getDb();
  const ref = db.collection("request_attachments").doc(attachment.id);
  const requestRef = db.collection(REQUESTS).doc(requestId);
  return db.runTransaction(async (transaction) => {
    const requestDoc = await transaction.get(requestRef);
    if (!requestDoc.exists || requestDoc.data()?.user_id !== userId) return false;
    transaction.create(ref, {
      user_id: userId,
      request_id: requestId,
      ...attachment,
      created_at: isoNow()
    });
    return true;
  });
}

export async function findRequestAttachment(userId, attachmentId) {
  const db = getDb();
  const attachmentDoc = await db.collection("request_attachments").doc(attachmentId).get();
  if (!attachmentDoc.exists || attachmentDoc.data()?.user_id !== userId) return null;
  const data = attachmentDoc.data();
  const requestDoc = await db.collection(REQUESTS).doc(data.request_id).get();
  if (!requestDoc.exists || requestDoc.data()?.user_id !== userId) return null;
  return { id: attachmentDoc.id, ...data };
}

export async function listRequestAttachments(userId, requestId) {
  const db = getDb();
  const requestDoc = await db.collection(REQUESTS).doc(requestId).get();
  if (!requestDoc.exists || requestDoc.data()?.user_id !== userId) return null;
  const snapshot = await db.collection("request_attachments").where("request_id", "==", requestId).orderBy("created_at", "desc").limit(50).get();
  return snapshot.docs
    .filter((doc) => doc.data()?.user_id === userId)
    .map((doc) => ({ id: doc.id, name: asText(doc.data().name), contentType: asText(doc.data().content_type), size: Number(doc.data().size || 0), createdAt: asText(doc.data().created_at) }));
}

export async function ownsClientMessage(userId, messageId) {
  if (!userId || !messageId) return false;
  const messageDoc = await getDb().collection(MESSAGES).doc(messageId).get();
  return messageDoc.exists && messageDoc.data()?.user_id === userId && messageDoc.data()?.sender_role === "client";
}

export async function saveMessageAttachment({ userId, messageId, attachment }) {
  const db = getDb();
  const messageRef = db.collection(MESSAGES).doc(messageId);
  const attachmentRef = db.collection("message_attachments").doc(attachment.id);
  return db.runTransaction(async (transaction) => {
    const messageDoc = await transaction.get(messageRef);
    if (!messageDoc.exists || messageDoc.data()?.user_id !== userId || messageDoc.data()?.sender_role !== "client") return false;
    const existing = Number(messageDoc.data()?.client_attachment_count || 0);
    if (existing >= 10) {
      const error = new Error("A message can have no more than 10 attachments.");
      error.code = "MESSAGE_ATTACHMENT_LIMIT";
      throw error;
    }
    transaction.create(attachmentRef, {
      user_id: userId,
      message_id: messageId,
      ...(messageDoc.data()?.request_id ? { request_id: messageDoc.data().request_id } : {}),
      ...attachment,
      created_at: isoNow()
    });
    transaction.update(messageRef, { client_attachment_count: existing + 1 });
    return true;
  });
}

export async function listMessageAttachments(userId, messageId) {
  if (!(await ownsClientMessage(userId, messageId))) return null;
  const snapshot = await getDb().collection("message_attachments")
    .where("message_id", "==", messageId)
    .limit(10)
    .get();
  return snapshot.docs
    .filter((doc) => doc.data()?.user_id === userId)
    .sort((a, b) => String(b.data()?.created_at || "").localeCompare(String(a.data()?.created_at || "")))
    .map((doc) => ({
      id: doc.id,
      name: asText(doc.data().name),
      contentType: asText(doc.data().content_type),
      size: Number(doc.data().size || 0),
      createdAt: asText(doc.data().created_at)
    }));
}

export async function findMessageAttachment(userId, messageId, attachmentId) {
  const attachmentDoc = await getDb().collection("message_attachments").doc(attachmentId).get();
  if (!attachmentDoc.exists) return null;
  const data = attachmentDoc.data();
  if (data.user_id !== userId || data.message_id !== messageId || !(await ownsClientMessage(userId, messageId))) return null;
  return { id: attachmentDoc.id, ...data };
}

export async function listManagerRequestAttachments(requestId) {
  const db = getDb();
  const requestDoc = await db.collection(REQUESTS).doc(requestId).get();
  if (!requestDoc.exists) return null;
  const [requestFiles, messageFiles] = await Promise.all([
    db.collection("request_attachments").where("request_id", "==", requestId).limit(100).get(),
    db.collection("message_attachments").where("request_id", "==", requestId).limit(100).get()
  ]);
  const mapFile = (doc, source) => ({
    id: doc.id,
    source,
    messageId: asText(doc.data().message_id),
    name: asText(doc.data().name),
    contentType: asText(doc.data().content_type),
    size: Number(doc.data().size || 0),
    createdAt: asText(doc.data().created_at)
  });
  return [
    ...requestFiles.docs.map((doc) => mapFile(doc, "request")),
    ...messageFiles.docs.map((doc) => mapFile(doc, "message"))
  ].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function findManagerRequestAttachment(requestId, attachmentId) {
  const db = getDb();
  const requestRef = db.collection(REQUESTS).doc(requestId);
  const requestDoc = await requestRef.get();
  if (!requestDoc.exists) return null;
  for (const collectionName of ["request_attachments", "message_attachments"]) {
    const attachmentDoc = await db.collection(collectionName).doc(attachmentId).get();
    if (!attachmentDoc.exists) continue;
    const data = attachmentDoc.data();
    if (data.request_id !== requestId) continue;
    if (collectionName === "message_attachments") {
      const messageDoc = await db.collection(MESSAGES).doc(asText(data.message_id)).get();
      if (!messageDoc.exists || messageDoc.data()?.request_id !== requestId || messageDoc.data()?.sender_role !== "client") return null;
    }
    return { id: attachmentDoc.id, ...data };
  }
  return null;
}

export async function listManagerMessageAttachments(messageId) {
  const db = getDb();
  const messageDoc = await db.collection(MESSAGES).doc(messageId).get();
  if (!messageDoc.exists || messageDoc.data()?.sender_role !== "client") return null;
  const snapshot = await db.collection("message_attachments").where("message_id", "==", messageId).limit(10).get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    name: asText(doc.data().name),
    contentType: asText(doc.data().content_type),
    size: Number(doc.data().size || 0),
    createdAt: asText(doc.data().created_at)
  }));
}

export async function findManagerMessageAttachment(messageId, attachmentId) {
  const db = getDb();
  const messageDoc = await db.collection(MESSAGES).doc(messageId).get();
  if (!messageDoc.exists || messageDoc.data()?.sender_role !== "client") return null;
  const attachmentDoc = await db.collection("message_attachments").doc(attachmentId).get();
  if (!attachmentDoc.exists || attachmentDoc.data()?.message_id !== messageId) return null;
  return { id: attachmentDoc.id, ...attachmentDoc.data() };
}

async function getUsersById(userIds) {
  const db = getDb();
  const users = db.collection(USERS);
  const userRefs = userIds.map((userId) => users.doc(userId));
  const batchSize = 100;
  const maxConcurrentBatches = 4;
  const batches = [];

  // Bound each Firestore lookup and concurrency while avoiding one network round trip per user.
  for (let index = 0; index < userRefs.length; index += batchSize) {
    batches.push(userRefs.slice(index, index + batchSize));
  }
  const userDocs = [];
  for (let index = 0; index < batches.length; index += maxConcurrentBatches) {
    const concurrentBatches = batches.slice(index, index + maxConcurrentBatches);
    const docsByBatch = await Promise.all(concurrentBatches.map((batch) =>
      db.getAll(...batch, { fieldMask: MANAGER_USER_CONTEXT_FIELDS })
    ));
    userDocs.push(...docsByBatch.flat());
  }

  return new Map(
    userDocs
      .filter((doc) => doc.exists)
      .map((doc) => [doc.id, mapUserDocument(doc.id, doc.data())])
  );
}

function attachUserContextToRequests(requests, usersById, { includeBillingDetails = false } = {}) {
  return requests.map((storedRequest) => {
    const { created_at_ms, ...request } = storedRequest;
    for (const field of PRIVATE_MANAGER_REQUEST_FIELDS) delete request[field];
    const user = usersById.get(request.user_id);

    return {
      ...request,
      client_name: request.client_name || user?.full_name || "Unknown client",
      client_email: request.client_email || user?.email || "",
      client_company: user?.company || "",
      client_tier: user?.client_tier || "Standard",
      client_type: user?.user_type || "Individual",
      client_lifecycle_stage: user?.lifecycle_stage || "New Lead",
      client_lead_source: user?.lead_source || "Website",
      client_phone: user?.phone || "",
      client_website: user?.website || "",
      billing_contact_ready: Boolean(user?.billing_name && user?.billing_email),
      payment_method_ready: Boolean(user?.preferred_payment_method),
      shipping_ready: Boolean(user?.shipping_name && user?.shipping_address),
      // Only the server-side Square invoice workflow needs the billing identity values.
      ...(includeBillingDetails ? {
        billing_name: user?.billing_name || "",
        billing_email: user?.billing_email || ""
      } : {})
    };
  });
}

export function sanitizeUser(user) {
  return {
    id: user.id,
    schemaVersion: user.schema_version || USER_SCHEMA_VERSION,
    fullName: user.full_name,
    username: user.username || "",
    email: user.email,
    company: user.company || "",
    phone: user.phone || "",
    serviceInterest: user.service_interest,
    accountStatus: user.account_status || "Active",
    clientTier: user.client_tier || "Standard",
    userType: user.user_type || "Individual",
    roles: asStringArray(user.roles, ["client"]),
    lifecycleStage: user.lifecycle_stage || "New Lead",
    leadSource: user.lead_source || "Website",
    preferredLanguage: user.preferred_language || "English",
    pronouns: user.pronouns || "",
    website: user.website || "",
    instagram: user.instagram || "",
    tiktok: user.tiktok || "",
    youtube: user.youtube || "",
    merchInterest: user.merch_interest || "Both",
    preferredContactMethod: user.preferred_contact_method || "",
    notificationOptIn: user.notification_opt_in === "true",
    marketingOptIn: user.marketing_opt_in === "true",
    timezone: user.timezone || "",
    clientNotes: user.client_notes || "",
    projectGoals: user.project_goals || "",
    referralSource: user.referral_source || "",
    accessibilityNotes: user.accessibility_notes || "",
    billingName: user.billing_name || "",
    billingEmail: user.billing_email || "",
    billingAddress: user.billing_address || "",
    preferredPaymentMethod: user.preferred_payment_method || "",
    budgetProfile: user.budget_profile || "",
    shippingName: user.shipping_name || "",
    shippingAddress: user.shipping_address || "",
    shippingCity: user.shipping_city || "",
    shippingRegion: user.shipping_region || "",
    shippingPostalCode: user.shipping_postal_code || "",
    shippingCountry: user.shipping_country || "United States",
    taxId: user.tax_id || "",
    profileFields: sanitizeProfileFields(user.profile_fields),
    isBookingManager: isBookingManager(user),
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at || "",
    lastProfileUpdateAt: user.last_profile_update_at || "",
    lastPortalActivityAt: user.last_portal_activity_at || ""
  };
}

export async function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const derivedKey = (await scryptAsync(password, salt, 64)).toString("hex");
  return `${salt}:${derivedKey}`;
}

export async function verifyPassword(password, storedHash) {
  if (!storedHash || !String(storedHash).includes(":")) {
    return false;
  }

  const [salt, expectedKey] = storedHash.split(":");
  const derivedKey = await scryptAsync(password, salt, 64);
  const expectedBuffer = Buffer.from(expectedKey, "hex");

  if (derivedKey.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(derivedKey, expectedBuffer);
}

export async function findUserByEmail(email) {
  const db = getDb();
  const emailLower = normalizeEmail(email);
  const snapshot = await db.collection(USERS).where("email_lower", "==", emailLower).limit(1).get();
  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return mapUserDocument(doc.id, doc.data());
}

export async function findUserByUsername(username) {
  const db = getDb();
  const usernameLower = asText(username).toLowerCase();
  if (!usernameLower) {
    return null;
  }

  const snapshot = await db.collection(USERS).where("username", "==", usernameLower).limit(1).get();
  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return mapUserDocument(doc.id, doc.data());
}

export async function findUserById(userId) {
  const db = getDb();
  const userDoc = await db.collection(USERS).doc(userId).get();
  if (!userDoc.exists) {
    return null;
  }

  return mapUserDocument(userDoc.id, userDoc.data());
}

export async function updateUserPassword(userId, password) {
  const db = getDb();
  const passwordHash = await hashPassword(password);
  const passwordChangedAt = new Date().toISOString();
  const userRef = db.collection(USERS).doc(userId);
  const updated = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(userRef);
    if (!snapshot.exists) return false;
    const authVersion = Number(snapshot.data()?.auth_version || 0) + 1;
    transaction.set(userRef, {
      password_hash: passwordHash,
      password_changed_at: passwordChangedAt,
      auth_version: authVersion
    }, { merge: true });
    return true;
  });
  if (!updated) return null;
  return findUserById(userId);
}

export async function createPasswordRecoveryToken(userId, tokenHash, expiresAt) {
  const db = getDb();
  const tokenRef = db.collection("password_recovery_tokens").doc(tokenHash);
  const collection = db.collection("password_recovery_tokens");
  await db.runTransaction(async (transaction) => {
    const previous = await transaction.get(collection.where("user_id", "==", userId));
    previous.docs.forEach((doc) => transaction.delete(doc.ref));
    transaction.set(tokenRef, {
      user_id: userId,
      created_at: isoNow(),
      expires_at_ms: Number(expiresAt),
      consumed_at: ""
    });
  });
}

export async function completePasswordRecovery(tokenHash, password) {
  const db = getDb();
  const tokenRef = db.collection("password_recovery_tokens").doc(tokenHash);
  const passwordHash = await hashPassword(password);
  const now = timestampNow();
  return db.runTransaction(async (transaction) => {
    const tokenSnapshot = await transaction.get(tokenRef);
    if (!tokenSnapshot.exists) return false;
    const token = tokenSnapshot.data();
    if (token.consumed_at || Number(token.expires_at_ms) <= now || !token.user_id) return false;
    const userRef = db.collection(USERS).doc(token.user_id);
    const userSnapshot = await transaction.get(userRef);
    if (!userSnapshot.exists) return false;
    const current = userSnapshot.data();
    transaction.set(userRef, {
      password_hash: passwordHash,
      password_changed_at: isoNow(),
      auth_version: Number(current.auth_version || 0) + 1
    }, { merge: true });
    transaction.set(tokenRef, { consumed_at: isoNow() }, { merge: true });
    return true;
  });
}

export async function createAccountDeletionRequest(user, reason = "") {
  const db = getDb();
  const userId = asText(user?.id);
  if (!userId) throw new Error("A user id is required for account deletion requests.");
  const userRequestRef = db.collection("account_deletion_by_user").doc(userId);
  const requestId = crypto.randomUUID();
  return db.runTransaction(async (transaction) => {
    const pointerSnapshot = await transaction.get(userRequestRef);
    const existingRef = pointerSnapshot.exists && pointerSnapshot.data()?.request_id
      ? db.collection("account_deletion_requests").doc(pointerSnapshot.data().request_id)
      : null;
    const snapshot = existingRef ? await transaction.get(existingRef) : null;
    const existing = snapshot?.exists ? snapshot.data() : null;
    if (existing?.status === "received" || existing?.status === "under_review" || existing?.status === "awaiting_client" || existing?.status === "policy_review") {
      return { requestId: existing.request_id, status: existing.status, existing: true };
    }
    const requestRef = db.collection("account_deletion_requests").doc(requestId);
    transaction.set(requestRef, {
      request_id: requestId,
      user_id: userId,
      email: normalizeEmail(user.email),
      status: "received",
      reason: asText(reason).slice(0, 1000),
      created_at: isoNow(),
      updated_at: isoNow(),
      manager_note: "",
      retention_review_required: true
    });
    transaction.set(userRequestRef, { request_id: requestId, updated_at: isoNow() });
    return { requestId, status: "received", existing: false };
  });
}

export async function listAccountDeletionRequests(limit = 100) {
  const db = getDb();
  const snapshot = await db.collection("account_deletion_requests").orderBy("created_at", "desc").limit(Math.min(200, Math.max(1, limit))).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function updateAccountDeletionRequest(requestId, status, managerNote = "") {
  const db = getDb();
  const matches = await db.collection("account_deletion_requests").where("request_id", "==", asText(requestId)).limit(1).get();
  if (matches.empty) return false;
  const requestRef = matches.docs[0].ref;
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(requestRef);
    if (!snapshot.exists) return false;
    transaction.set(requestRef, {
      status,
      manager_note: asText(managerNote).slice(0, 1200),
      updated_at: isoNow()
    }, { merge: true });
    return true;
  });
}

export async function findUserBySession(token) {
  const db = getDb();
  const sessionDoc = await db.collection(SESSIONS).doc(token).get();
  if (!sessionDoc.exists) {
    return null;
  }

  const session = sessionDoc.data();
  if (!session?.user_id) {
    return null;
  }

  const userDoc = await db.collection(USERS).doc(session.user_id).get();
  if (!userDoc.exists) {
    return null;
  }

  return mapUserDocument(userDoc.id, userDoc.data());
}

export async function createUser({
  fullName,
  username = "",
  email,
  company,
  phone = "",
  serviceInterest,
  accountStatus = "Active",
  clientTier = "Standard",
  userType = "Individual",
  lifecycleStage = "New Lead",
  leadSource = "Website",
  preferredLanguage = "English",
  pronouns = "",
  website = "",
  instagram = "",
  tiktok = "",
  youtube = "",
  merchInterest = "Both",
  preferredContactMethod = "Email",
  notificationOptIn = "true",
  marketingOptIn = "false",
  timezone = "America/New_York",
  clientNotes = "",
  projectGoals = "",
  referralSource = "",
  accessibilityNotes = "",
  billingName = "",
  billingEmail = "",
  billingAddress = "",
  preferredPaymentMethod = "",
  budgetProfile = "",
  shippingName = "",
  shippingAddress = "",
  shippingCity = "",
  shippingRegion = "",
  shippingPostalCode = "",
  shippingCountry = "United States",
  taxId = "",
  profileFields = {},
  password
}) {
  const db = getDb();
  const passwordHash = await hashPassword(password);
  const createdAt = isoNow();
  const docRef = db.collection(USERS).doc();
  const emailLower = normalizeEmail(email);

  await docRef.set(buildUserRecord({
    schema_version: USER_SCHEMA_VERSION,
    full_name: fullName,
    username,
    email: emailLower,
    email_lower: emailLower,
    company,
    phone,
    service_interest: serviceInterest,
    account_status: accountStatus,
    client_tier: clientTier,
    user_type: userType,
    roles: ["client"],
    lifecycle_stage: lifecycleStage,
    lead_source: leadSource,
    preferred_language: preferredLanguage,
    pronouns,
    website,
    instagram,
    tiktok,
    youtube,
    merch_interest: merchInterest,
    preferred_contact_method: preferredContactMethod,
    notification_opt_in: notificationOptIn,
    marketing_opt_in: marketingOptIn,
    timezone,
    client_notes: clientNotes,
    project_goals: projectGoals,
    referral_source: referralSource,
    accessibility_notes: accessibilityNotes,
    billing_name: billingName,
    billing_email: billingEmail,
    billing_address: billingAddress,
    preferred_payment_method: preferredPaymentMethod,
    budget_profile: budgetProfile,
    shipping_name: shippingName,
    shipping_address: shippingAddress,
    shipping_city: shippingCity,
    shipping_region: shippingRegion,
    shipping_postal_code: shippingPostalCode,
    shipping_country: shippingCountry,
    tax_id: taxId,
    profile_fields: profileFields,
    is_booking_manager: false,
    password_hash: passwordHash,
    created_at: createdAt,
    last_sign_in_at: createdAt,
    last_profile_update_at: createdAt,
    last_portal_activity_at: createdAt
  }));

  return docRef.id;
}

export async function createSession(userId) {
  const db = getDb();
  const token = crypto.randomUUID();
  await db.collection(SESSIONS).doc(token).set({
    user_id: userId,
    created_at: isoNow()
  });
  return token;
}

export async function deleteSession(token) {
  const db = getDb();
  await db.collection(SESSIONS).doc(token).delete();
}

export async function createRequest({
  userId,
  projectType,
  budget,
  timeline,
  consultationDate,
  consultationTime,
  estimateAmountCents = 0,
  depositAmountCents = 0,
  details,
  squareBooking = null
}) {
  const db = getDb();
  const requestData = {
    user_id: userId,
    project_type: projectType,
    budget,
    timeline,
    consultation_date: squareBooking?.consultationDate || consultationDate || "",
    consultation_time: squareBooking?.consultationTime || consultationTime || "",
    ...(squareBooking ? {
      source: "Website booking",
      square_booking_id: squareBooking.squareBookingId,
      square_customer_id: squareBooking.squareCustomerId,
      square_location_id: squareBooking.squareLocationId,
      square_booking_status: squareBooking.squareBookingStatus,
      square_booking_version: squareBooking.squareBookingVersion,
      square_booking_url: squareBooking.squareBookingUrl
    } : {}),
    estimate_amount_cents: Number(estimateAmountCents || 0),
    deposit_amount_cents: Number(depositAmountCents || 0),
    details,
    status: "New",
    client_activity: [clientActivityEvent("Request submitted"), ...(squareBooking ? [clientActivityEvent("Square appointment booked")] : [])],
    manager_notes: "",
    invoice_status: "Pending",
    payment_status: "Pending",
    fulfillment_status: "Queued",
    internal_priority: "Standard",
    created_at: isoNow(),
    created_at_ms: timestampNow(),
    updated_at: isoNow(),
    updated_at_ms: timestampNow(),
    last_manager_update_at: ""
  };
  if (squareBooking?.squareBookingId) {
    const safeBookingId = asText(squareBooking.squareBookingId).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
    const requestRef = db.collection(REQUESTS).doc(`square_booking_${safeBookingId}`);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(requestRef);
      const existing = snapshot.exists ? snapshot.data() : {};
      if (existing.user_id && existing.user_id !== userId) {
        const error = new Error("This Square booking is linked to another account.");
        error.code = "SQUARE_BOOKING_OWNER_CONFLICT";
        throw error;
      }
      if (existing.user_id === userId && existing.square_booking_id === squareBooking.squareBookingId) {
        return;
      }
      if (existing.square_booking_id && existing.square_booking_id !== squareBooking.squareBookingId) {
        const error = new Error("This request document is linked to another Square appointment.");
        error.code = "SQUARE_BOOKING_OWNER_CONFLICT";
        throw error;
      }
      transaction.set(requestRef, {
        ...requestData,
        client_activity: appendClientActivity(existing.client_activity, requestData.client_activity),
        created_at: existing.created_at || requestData.created_at,
        created_at_ms: existing.created_at_ms || requestData.created_at_ms
      }, { merge: true });
    });
    return requestRef.id;
  }
  const created = await db.collection(REQUESTS).add(requestData);
  return created.id;
}

function bookingAttemptDocumentId(userId, attemptId) {
  return crypto.createHash("sha256")
    .update(`${asText(userId)}:${asText(attemptId)}`)
    .digest("hex");
}

export async function getSquareBookingAttempt({ userId, attemptId, startAt }) {
  const ref = getDb().collection("square_booking_attempts").doc(bookingAttemptDocumentId(userId, attemptId));
  const snapshot = await ref.get();
  if (!snapshot.exists) return null;
  const current = snapshot.data();
  if (current.user_id !== userId || current.attempt_id !== attemptId || current.start_at !== startAt) {
    const error = new Error("This booking attempt was already used for a different appointment time.");
    error.code = "SQUARE_BOOKING_ATTEMPT_CONFLICT";
    throw error;
  }
  return { ...current, attemptDocumentId: ref.id, existing: true };
}

export async function getOrCreateSquareBookingAttempt({ userId, attemptId, startAt, booking, requestData, idempotencyKey }) {
  const db = getDb();
  const ref = db.collection("square_booking_attempts").doc(bookingAttemptDocumentId(userId, attemptId));
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (snapshot.exists) {
      const current = snapshot.data();
      if (current.user_id !== userId || current.attempt_id !== attemptId || current.start_at !== startAt) {
        const error = new Error("This booking attempt was already used for a different appointment time.");
        error.code = "SQUARE_BOOKING_ATTEMPT_CONFLICT";
        throw error;
      }
      return { ...current, attemptDocumentId: ref.id, existing: true };
    }
    const savedRequestData = Object.fromEntries(Object.entries(requestData || {}).filter(([, value]) => value !== undefined));
    const record = {
      user_id: userId,
      attempt_id: attemptId,
      start_at: startAt,
      booking,
      request_data: savedRequestData,
      idempotency_key: idempotencyKey,
      booking_id: "",
      request_id: "",
      created_at: isoNow(),
      updated_at: isoNow()
    };
    transaction.create(ref, record);
    return { ...record, attemptDocumentId: ref.id, existing: false };
  });
}

export async function markSquareBookingAttemptCreated({ userId, attemptDocumentId, bookingId }) {
  const db = getDb();
  const ref = db.collection("square_booking_attempts").doc(attemptDocumentId);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.data()?.user_id !== userId) return false;
    transaction.set(ref, { booking_id: asText(bookingId), updated_at: isoNow() }, { merge: true });
    return true;
  });
}

export async function markSquareBookingAttemptRequest({ userId, attemptDocumentId, requestId }) {
  const db = getDb();
  const ref = db.collection("square_booking_attempts").doc(attemptDocumentId);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.data()?.user_id !== userId) return false;
    const currentRequestId = asText(snapshot.data()?.request_id);
    if (currentRequestId && currentRequestId !== requestId) {
      const error = new Error("The booking attempt is already linked to another request.");
      error.code = "SQUARE_BOOKING_REQUEST_CONFLICT";
      throw error;
    }
    transaction.set(ref, { request_id: asText(requestId), updated_at: isoNow() }, { merge: true });
    return true;
  });
}

export async function upsertSquareAppointmentRequest(appointment, ownerUserId = "") {
  const db = getDb();
  const now = isoNow();
  const safeBookingId = asText(appointment.squareBookingId)
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 120);
  const docRef = db.collection(REQUESTS).doc(`square_booking_${safeBookingId}`);

  return db.runTransaction(async (transaction) => {
    const existingDoc = await transaction.get(docRef);
    const existingData = existingDoc.exists ? existingDoc.data() : {};
    if (existingData.user_id && ownerUserId && existingData.user_id !== ownerUserId) {
      const error = new Error("This Square booking is already linked to another account.");
      error.code = "SQUARE_BOOKING_OWNER_CONFLICT";
      throw error;
    }
    const existingVersion = Number(existingData.square_booking_version || -1);
    const incomingVersion = Number(appointment.squareBookingVersion || 0);

    if (existingDoc.exists && incomingVersion < existingVersion) {
      return docRef.id;
    }

    const createdAt = existingData.created_at || appointment.createdAt || now;
    const appointmentChanged = !existingDoc.exists ||
      existingData.consultation_date !== appointment.consultationDate ||
      existingData.consultation_time !== appointment.consultationTime ||
      existingData.status !== appointment.status;
    const eventLabel = existingDoc.exists
      ? `Appointment updated: ${appointment.consultationDate || "date pending"}${appointment.consultationTime ? ` at ${appointment.consultationTime}` : ""} (${appointment.status}).`
      : `Appointment booked: ${appointment.consultationDate || "date pending"}${appointment.consultationTime ? ` at ${appointment.consultationTime}` : ""}.`;
    const clientActivity = appointmentChanged
      ? appendClientActivity(existingData.client_activity, [clientActivityEvent(eventLabel, appointment.updatedAt || now)])
      : (Array.isArray(existingData.client_activity) ? existingData.client_activity : []);
    transaction.set(
      docRef,
      {
        user_id: existingData.user_id || ownerUserId || "",
        source: existingData.source || appointment.source,
        square_booking_id: appointment.squareBookingId,
        square_customer_id: appointment.squareCustomerId,
        square_location_id: appointment.squareLocationId,
        square_booking_status: appointment.squareBookingStatus,
        square_booking_version: incomingVersion,
        square_booking_url: appointment.squareBookingUrl,
        project_type: existingData.project_type || appointment.projectType,
        budget: existingData.budget || appointment.budget,
        timeline: existingData.timeline || appointment.timeline,
        consultation_date: appointment.consultationDate,
        consultation_time: appointment.consultationTime,
        details: existingData.details || appointment.details,
        status: existingData.user_id ? (existingData.status || "New") : appointment.status,
        client_activity: clientActivity,
        manager_notes: existingData.manager_notes || "",
        invoice_status: existingData.invoice_status || "Appointment-only",
        payment_status: existingData.payment_status || "Not Required",
        fulfillment_status: existingData.fulfillment_status || "Scheduled",
        internal_priority: existingData.internal_priority || "Standard",
        created_at: createdAt,
        created_at_ms: existingData.created_at_ms || timestampNow(),
        updated_at: appointment.updatedAt || now,
        updated_at_ms: timestampNow(),
        last_manager_update_at: existingData.last_manager_update_at || ""
      },
      { merge: true }
    );

    return docRef.id;
  });
}

export async function getOwnedSquareBookingRequest(requestId, userId) {
  if (!requestId || !userId) return null;
  const snapshot = await getDb().collection(REQUESTS).doc(requestId).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data();
  if (data.user_id !== userId || !data.square_booking_id) return null;
  return {
    id: snapshot.id,
    userId: data.user_id,
    squareBookingId: data.square_booking_id,
    squareBookingStatus: data.square_booking_status || "",
    consultationDate: data.consultation_date || "",
    consultationTime: data.consultation_time || ""
  };
}

export async function listRequests(userId) {
  const db = getDb();
  const snapshot = await db.collection(REQUESTS)
    .where("user_id", "==", userId)
    .select(...CLIENT_REQUEST_FIELDS)
    .get();
  return sortNewest(
    snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        source: asText(data.source, "Website"),
        project_type: asText(data.project_type),
        budget: asText(data.budget),
        timeline: asText(data.timeline),
        details: asText(data.details),
        status: asText(data.status, "New"),
        consultation_date: asText(data.consultation_date),
        consultation_time: asText(data.consultation_time),
        created_at: data.created_at || "",
        created_at_ms: timestampToMs(data.created_at_ms || data.created_at),
        invoice_status: asText(data.invoice_status, "Pending"),
        invoice_amount_cents: Number(data.invoice_amount_cents || 0),
        square_invoice_url: asText(data.square_invoice_url),
        square_booking_id: asText(data.square_booking_id),
        square_booking_status: asText(data.square_booking_status),
        square_booking_url: asText(data.square_booking_url),
        client_activity: (Array.isArray(data.client_activity) ? data.client_activity : []).slice(-50).map((event) => ({
          label: asText(event?.label, "Request update").slice(0, 180),
          created_at: asText(event?.created_at)
        }))
      };
    })
  ).map(({ created_at_ms, ...rest }) => rest);
}

export async function listAllRequestsWithUsers() {
  const startedAt = performance.now();
  const db = getDb();
  const requestCollection = db
    .collection(REQUESTS)
    .select(...MANAGER_REQUEST_FIELDS);
  const userIds = new Set();
  const requests = [];
  let cursor = null;
  let pageCount = 0;

  while (true) {
    let query = requestCollection
      .orderBy(FieldPath.documentId())
      .limit(MANAGER_REQUEST_PAGE_SIZE);
    if (cursor) query = query.startAfter(cursor);

    const requestSnapshot = await query.get();
    if (requestSnapshot.empty) break;
    pageCount += 1;

    const pageRequests = requestSnapshot.docs.map((doc) =>
      normalizeRequestDocument(doc.id, doc.data())
    );
    for (const request of pageRequests) {
      if (request.user_id) userIds.add(request.user_id);
    }
    requests.push(...pageRequests);
    cursor = requestSnapshot.docs[requestSnapshot.docs.length - 1];
    if (requestSnapshot.size < MANAGER_REQUEST_PAGE_SIZE) break;
  }

  // Finish the paged request scan before starting the bounded user lookups so
  // request-page reads are not serialized behind per-page enrichment rounds.
  const usersById = await getUsersById([...userIds]);
  const enrichedRequests = attachUserContextToRequests(requests, usersById);
  const requestsWithSortKey = enrichedRequests.map((request, index) => ({
    ...request,
    created_at_ms: requests[index].created_at_ms
  }));
  const readMs = Math.round(performance.now() - startedAt);
  const sortStartedAt = performance.now();
  const sortedRequests = sortNewest(requestsWithSortKey).map(({ created_at_ms, ...request }) => request);
  console.info(JSON.stringify({
    event: "manager_request_scan_completed",
    requestCount: sortedRequests.length,
    userContextCount: usersById.size,
    pageCount,
    readMs,
    sortMs: Math.round(performance.now() - sortStartedAt),
    totalMs: Math.round(performance.now() - startedAt)
  }));
  return sortedRequests;
}

function buildModelProfile(user) {
  const profileFields = sanitizeProfileFields(user.profile_fields);

  return {
    id: user.id,
    fullName: user.full_name || "",
    username: user.username || "",
    email: user.email || "",
    phone: user.phone || "",
    city: profileFields.city || profileFields.modelCity || "",
    instagram: user.instagram || profileFields.instagram || "",
    portfolioUrl: user.website || profileFields.portfolioUrl || "",
    pronouns: user.pronouns || profileFields.pronouns || "",
    projectTypes: profileFields.projectTypes || user.project_goals || "",
    modelingInterests: profileFields.modelingInterests || "",
    availability: profileFields.availability || "",
    experience: profileFields.experience || "",
    relevantSkills: profileFields.relevantSkills || "",
    travelReadiness: profileFields.travelReadiness || "",
    compensationExpectation: profileFields.compensationExpectation || "",
    usageComfort: profileFields.usageComfort || "",
    wardrobeComfort: profileFields.wardrobeComfort || "",
    productionPace: profileFields.productionPace || "",
    qualityStandards: profileFields.qualityStandards || "",
    reliabilityExamples: profileFields.reliabilityExamples || "",
    preparationProcess: profileFields.preparationProcess || "",
    queueStatus: profileFields.modelQueueStatus || "Standard",
    noShowCount: profileFields.modelNoShowCount || "0",
    reapplicationWindow: profileFields.modelReapplicationWindow || "90 days",
    lifecycleStage: user.lifecycle_stage || "Model Applicant",
    createdAt: user.created_at || "",
    updatedAt: user.last_profile_update_at || ""
  };
}

export async function listModelProfiles() {
  const db = getDb();
  const snapshot = await db.collection(USERS)
    .where("roles", "array-contains", "model")
    .select(...MODEL_PROFILE_FIELDS)
    .get();
  return sortNewest(
    snapshot.docs.map((doc) => {
      const user = mapUserDocument(doc.id, doc.data());
      return {
        ...buildModelProfile(user),
        created_at_ms: user.created_at ? new Date(user.created_at).getTime() : 0
      };
    })
  ).map(({ created_at_ms, ...profile }) => profile);
}

export async function findRequestWithUserById(requestId, { includeBillingDetails = false } = {}) {
  const db = getDb();
  const requestDoc = await db.collection(REQUESTS).doc(requestId).get();
  if (!requestDoc.exists) {
    return null;
  }

  const request = normalizeRequestDocument(requestDoc.id, requestDoc.data());
  const usersById = await getUsersById(request.user_id ? [request.user_id] : []);
  return attachUserContextToRequests([request], usersById, { includeBillingDetails })[0] || null;
}

export async function userOwnsRequest(userId, requestId) {
  const db = getDb();
  const requestDoc = await db.collection(REQUESTS).doc(requestId).get();
  return requestDoc.exists && requestDoc.data()?.user_id === userId;
}

export async function updateManagerRequest(requestId, updates, { decisionMessageBuilder = null } = {}) {
  const db = getDb();
  const requestRef = db.collection(REQUESTS).doc(requestId);
  const messageRef = decisionMessageBuilder ? db.collection(MESSAGES).doc() : null;

  return db.runTransaction(async (transaction) => {
    const requestDoc = await transaction.get(requestRef);
    if (!requestDoc.exists) {
      return { updated: false, decisionMessageCreated: false };
    }

    const existing = requestDoc.data();
    const updatedAt = isoNow();
    const decisionStatusChanged = Boolean(
      decisionMessageBuilder && updates.status && existing.status !== updates.status
    );
    const decisionMessage = decisionStatusChanged
      ? decisionMessageBuilder(existing)
      : null;
    let decisionMessageCreated = false;
    const activityEvents = [];
    if (updates.status && existing.status !== updates.status) activityEvents.push(clientActivityEvent(`Request status updated: ${updates.status}.`, updatedAt));
    if (updates.invoice_status && existing.invoice_status !== updates.invoice_status) activityEvents.push(clientActivityEvent(`Invoice status updated: ${updates.invoice_status}.`, updatedAt));
    if (updates.payment_status && existing.payment_status !== updates.payment_status) activityEvents.push(clientActivityEvent(`Payment status updated: ${updates.payment_status}.`, updatedAt));
    transaction.set(requestRef, {
      ...updates,
      updated_at: updatedAt,
      updated_at_ms: timestampNow(),
      last_manager_update_at: updatedAt,
      ...(activityEvents.length ? { client_activity: appendClientActivity(existing.client_activity, activityEvents) } : {})
    }, { merge: true });

    if (
      decisionMessage &&
      existing.user_id &&
      decisionStatusChanged
    ) {
      transaction.set(messageRef, {
        user_id: existing.user_id,
        request_id: requestId,
        sender_role: "studio",
        client_read_at: "",
        subject: decisionMessage.subject,
        body: decisionMessage.body,
        created_at: updatedAt,
        created_at_ms: timestampNow()
      });
      decisionMessageCreated = true;
    }

    return { updated: true, decisionStatusChanged, decisionMessageCreated };
  });
}

export async function createMessage({ userId, senderRole, subject, body, requestId = "" }) {
  const db = getDb();
  const message = {
    user_id: userId,
    ...(requestId ? { request_id: requestId } : {}),
    sender_role: senderRole,
    ...(senderRole === "studio" ? { client_read_at: "" } : {}),
    subject,
    body,
    created_at: isoNow(),
    created_at_ms: timestampNow()
  };
  const document = await db.collection(MESSAGES).add(message);

  // Return the persisted row so callers can update the thread without rereading
  // the user's entire message history after every send.
  const { created_at_ms, ...responseMessage } = message;
  return { id: document.id, ...responseMessage };
}

function decodeMessageCursor(cursor) {
  if (!cursor) return null;
  if (typeof cursor !== "string" || cursor.length > 512) {
    throw new TypeError("Invalid message cursor.");
  }

  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      !decoded ||
      typeof decoded.createdAt !== "string" ||
      Number.isNaN(Date.parse(decoded.createdAt)) ||
      typeof decoded.id !== "string" ||
      !decoded.id ||
      decoded.id.includes("/")
    ) {
      throw new TypeError("Invalid message cursor.");
    }
    return decoded;
  } catch {
    throw new TypeError("Invalid message cursor.");
  }
}

function serializeMessageCursor(document) {
  return Buffer.from(JSON.stringify({
    createdAt: document.get("created_at"),
    id: document.id
  })).toString("base64url");
}

function mapMessageDocument(document) {
  const { created_at_ms, ...message } = document.data();
  return { id: document.id, ...message };
}

export async function countMessages(userId) {
  const db = getDb();
  const result = await db.collection(MESSAGES).where("user_id", "==", userId).count().get();
  return result.data().count;
}

export async function countUnreadStudioMessages(userId) {
  const db = getDb();
  const snapshot = await db.collection(MESSAGES)
    .where("user_id", "==", userId)
    .where("sender_role", "==", "studio")
    .select("client_read_at")
    .get();
  return snapshot.docs.filter((document) => !document.get("client_read_at")).length;
}

export async function setMessageConversationReadState(userId, requestId, isRead) {
  const db = getDb();
  const snapshot = await db.collection(MESSAGES)
    .where("user_id", "==", userId)
    .where("sender_role", "==", "studio")
    .get();
  const matchingDocs = snapshot.docs.filter((document) => String(document.get("request_id") || "") === requestId);
  const updatedAt = isRead ? isoNow() : "";
  for (let offset = 0; offset < matchingDocs.length; offset += 400) {
    const batch = db.batch();
    matchingDocs.slice(offset, offset + 400).forEach((document) => {
      batch.update(document.ref, { client_read_at: updatedAt });
    });
    await batch.commit();
  }
  return countUnreadStudioMessages(userId);
}

async function countMessagesByRole(userId, senderRole) {
  const db = getDb();
  const result = await db.collection(MESSAGES)
    .where("user_id", "==", userId)
    .where("sender_role", "==", senderRole)
    .count()
    .get();
  return result.data().count;
}

export async function listMessagesPage(userId, { cursor = "", pageSize = MESSAGE_PAGE_SIZE, includeCount = false } = {}) {
  const db = getDb();
  const safePageSize = Math.min(Math.max(Number(pageSize) || MESSAGE_PAGE_SIZE, 1), MESSAGE_PAGE_SIZE);
  const decodedCursor = decodeMessageCursor(cursor);
  let query = db.collection(MESSAGES)
    .where("user_id", "==", userId)
    .orderBy("created_at", "desc")
    .orderBy(FieldPath.documentId(), "desc");

  if (decodedCursor) {
    query = query.startAfter(decodedCursor.createdAt, decodedCursor.id);
  }

  const [snapshot, totalCount] = await Promise.all([
    query.limit(safePageSize + 1).get(),
    includeCount ? countMessages(userId) : Promise.resolve(undefined)
  ]);
  const hasMore = snapshot.docs.length > safePageSize;
  const pageDocs = snapshot.docs.slice(0, safePageSize);
  return {
    messages: pageDocs.map(mapMessageDocument),
    hasMore,
    nextCursor: hasMore && pageDocs.length ? serializeMessageCursor(pageDocs[pageDocs.length - 1]) : "",
    ...(totalCount === undefined ? {} : { totalCount })
  };
}

export async function getMessageSummary(userId) {
  const [summary, studioMessages, clientMessages] = await Promise.all([
    listMessagesPage(userId, { pageSize: MESSAGE_PREVIEW_SIZE, includeCount: true }),
    countMessagesByRole(userId, "studio"),
    countMessagesByRole(userId, "client")
  ]);
  return { ...summary, studioMessages, clientMessages };
}

export async function createModelApplication({
  legalName,
  displayName,
  username,
  email,
  password,
  phone,
  city,
  dateOfBirth,
  pronouns,
  height,
  clothingSizes,
  hairColor,
  eyeColor,
  tattoosPiercings,
  projectTypes,
  modelingInterests,
  availability,
  portfolioUrl,
  instagram,
  otherSocials,
  experience,
  relevantSkills,
  travelReadiness,
  compensationExpectation,
  usageComfort,
  wardrobeComfort,
  productionPace,
  qualityStandards,
  reliabilityExamples,
  preparationProcess,
  contractReadiness,
  independentContractorDisclosure,
  reapplicationPolicy,
  noShowPolicy,
  legalPolicyAcceptance,
  consentToContact,
  notes
}) {
  const db = getDb();
  const now = isoNow();
  const nowMs = timestampNow();
  const emailLower = normalizeEmail(email);
  const usernameLower = asText(username).toLowerCase();
  const emailLockRef = db.collection(MODEL_APPLICATION_LOCKS).doc(hashKey(emailLower));
  const existingUser = await findUserByEmail(emailLower);
  const existingUsernameUser = await findUserByUsername(usernameLower);

  if (existingUser) {
    throw new ModelApplicationConflictError("An account already exists for that email. Sign in first, then update profile details.");
  }

  if (existingUsernameUser) {
    throw new ModelApplicationConflictError("That username is already taken. Choose another username.");
  }

  // The hashed lock is the indexed source of truth for current applications.
  // Only consult legacy application documents when no lock exists, avoiding an
  // unbounded read of an applicant's full history on routine submissions.
  const emailLockSnapshot = await emailLockRef.get();
  if (!emailLockSnapshot.exists) {
    const recentApplicationSnapshot = await db
      .collection(MODEL_APPLICATIONS)
      .where("email", "==", emailLower)
      .get();
    const recentApplication = recentApplicationSnapshot.docs
      .map((doc) => {
        const application = doc.data();
        return {
          id: doc.id,
          ...application,
          created_at_ms: timestampToMs(application.created_at_ms || application.created_at)
        };
      })
      .sort((a, b) => b.created_at_ms - a.created_at_ms)[0];

    if (recentApplication?.created_at_ms && nowMs - recentApplication.created_at_ms < MODEL_REAPPLICATION_WINDOW_MS) {
      const eligibleAt = new Date(recentApplication.created_at_ms + MODEL_REAPPLICATION_WINDOW_MS)
        .toISOString()
        .slice(0, 10);
      throw new ModelApplicationConflictError(`Model applications are limited to once every 3 months. This email can apply again on ${eligibleAt}.`);
    }
  }

  const userRef = existingUser
    ? db.collection(USERS).doc(existingUser.id)
    : db.collection(USERS).doc();
  const previousNoShowCount = Number(existingUser?.profile_fields?.modelNoShowCount || 0);
  const queueStatus = previousNoShowCount > 0 ? "Back of line" : "Standard";
  const passwordHash = password
    ? await hashPassword(password)
    : existingUser?.password_hash || "";

  const modelProfileFields = sanitizeProfileFields({
    modelApplicant: "true",
    modelLegalName: legalName,
    modelDisplayName: displayName,
    modelUsername: usernameLower,
    city,
    dateOfBirth,
    pronouns,
    height,
    clothingSizes,
    hairColor,
    eyeColor,
    tattoosPiercings,
    projectTypes: asStringArray(projectTypes).join(", "),
    modelingInterests: asStringArray(modelingInterests).join(", "),
    availability,
    portfolioUrl,
    instagram,
    otherSocials,
    experience,
    relevantSkills,
    travelReadiness,
    compensationExpectation,
    usageComfort,
    wardrobeComfort,
    productionPace,
    qualityStandards,
    reliabilityExamples,
    preparationProcess,
    contractReadiness: contractReadiness ? "true" : "false",
    independentContractorDisclosure: independentContractorDisclosure ? "true" : "false",
    modelTaxClassificationDisclosure: "1099 independent-contractor opportunity; not full-time W-2 employment unless a separate written agreement says otherwise.",
    reapplicationPolicy: reapplicationPolicy ? "true" : "false",
    noShowPolicy: noShowPolicy ? "true" : "false",
    legalPolicyAcceptance: legalPolicyAcceptance ? "true" : "false",
    consentToContact: consentToContact ? "true" : "false",
    legalPolicyAcceptedAt: now,
    modelReapplicationWindow: "90 days",
    modelNoShowPolicy: "Missed confirmed calls lower future priority.",
    modelQueueStatus: queueStatus,
    modelNoShowCount: String(previousNoShowCount),
    notes
  });

  const userRecord = buildUserRecord({
    ...(existingUser || {}),
    schema_version: USER_SCHEMA_VERSION,
    full_name: legalName,
    username: usernameLower,
    email: emailLower,
    email_lower: emailLower,
    phone,
    service_interest: "Model Sign-up",
    client_tier: "Model",
    user_type: "Model",
    roles: ["model"],
    lifecycle_stage: "Model Applicant",
    lead_source: "Models page",
    pronouns,
    instagram,
    website: portfolioUrl,
    preferred_contact_method: phone ? "Phone" : "Email",
    client_notes: [
      existingUser?.client_notes,
      `Model application submitted ${now}. Production pace: ${asText(productionPace)}`
    ].filter(Boolean).join("\n\n").slice(0, 1200),
    project_goals: asStringArray(projectTypes).join(", "),
    referral_source: "Models page",
    profile_fields: {
      ...(existingUser?.profile_fields || {}),
      ...modelProfileFields
    },
    created_at: existingUser?.created_at || now,
    last_profile_update_at: now,
    last_portal_activity_at: existingUser?.last_portal_activity_at || now,
    password_hash: passwordHash
  });

  const applicationRef = db.collection(MODEL_APPLICATIONS).doc();
  const usernameReservationRef = db.collection(USERNAME_RESERVATIONS).doc(usernameLower);
  const applicationRecord = {
    user_id: userRef.id,
    legal_name: asText(legalName),
    display_name: asText(displayName),
    username: usernameLower,
    email: emailLower,
    phone: asText(phone),
    city: asText(city),
    date_of_birth: asText(dateOfBirth),
    pronouns: asText(pronouns),
    height: asText(height),
    clothing_sizes: asText(clothingSizes),
    hair_color: asText(hairColor),
    eye_color: asText(eyeColor),
    tattoos_piercings: asText(tattoosPiercings),
    project_types: asStringArray(projectTypes),
    modeling_interests: asStringArray(modelingInterests),
    availability: asText(availability),
    portfolio_url: asText(portfolioUrl),
    instagram: asText(instagram),
    other_socials: asText(otherSocials),
    experience: asText(experience),
    relevant_skills: asText(relevantSkills),
    travel_readiness: asText(travelReadiness),
    compensation_expectation: asText(compensationExpectation),
    usage_comfort: asText(usageComfort),
    wardrobe_comfort: asText(wardrobeComfort),
    production_pace: asText(productionPace),
    quality_standards: asText(qualityStandards),
    reliability_examples: asText(reliabilityExamples),
    preparation_process: asText(preparationProcess),
    contract_readiness: Boolean(contractReadiness),
    independent_contractor_disclosure: Boolean(independentContractorDisclosure),
    tax_classification_disclosure: "1099 independent-contractor opportunity; not full-time W-2 employment unless a separate written agreement says otherwise.",
    reapplication_policy_accepted: Boolean(reapplicationPolicy),
    no_show_policy_accepted: Boolean(noShowPolicy),
    legal_policy_accepted: Boolean(legalPolicyAcceptance),
    consent_to_contact: Boolean(consentToContact),
    legal_policy_accepted_at: now,
    reapplication_window_days: 90,
    next_eligible_application_at: new Date(nowMs + MODEL_REAPPLICATION_WINDOW_MS).toISOString(),
    attendance_status: "Pending",
    no_show_count: previousNoShowCount,
    queue_status: queueStatus,
    notes: asText(notes),
    source: "Models page",
    status: "New",
    manager_notes: "",
    created_at: now,
    created_at_ms: nowMs,
    updated_at: now,
    updated_at_ms: nowMs
  };

  await db.runTransaction(async (transaction) => {
    const [emailLockDoc, usernameReservationDoc] = await Promise.all([
      transaction.get(emailLockRef),
      transaction.get(usernameReservationRef)
    ]);

    if (emailLockDoc.exists) {
      const lock = emailLockDoc.data();
      const lastApplicationMs = Number(lock?.last_application_at_ms || 0);
      if (lastApplicationMs && nowMs - lastApplicationMs < MODEL_REAPPLICATION_WINDOW_MS) {
        const eligibleAt = new Date(lastApplicationMs + MODEL_REAPPLICATION_WINDOW_MS)
          .toISOString()
          .slice(0, 10);
        throw new ModelApplicationConflictError(`Model applications are limited to once every 3 months. This email can apply again on ${eligibleAt}.`);
      }
    }

    if (usernameReservationDoc.exists) {
      throw new ModelApplicationConflictError("That username is already taken. Choose another username.");
    }

    transaction.set(userRef, userRecord, { merge: true });
    transaction.set(applicationRef, applicationRecord);
    transaction.set(emailLockRef, {
      email_hash: hashKey(emailLower),
      user_id: userRef.id,
      application_id: applicationRef.id,
      last_application_at: now,
      last_application_at_ms: nowMs,
      next_eligible_application_at: applicationRecord.next_eligible_application_at
    });
    transaction.set(usernameReservationRef, {
      username: usernameLower,
      user_id: userRef.id,
      created_at: now,
      source: "Model Sign-up"
    });
  });

  return {
    applicationId: applicationRef.id,
    userId: userRef.id
  };
}

export async function updateUserProfile({
  userId,
  fullName,
  username,
  company,
  phone,
  serviceInterest,
  userType,
  leadSource,
  preferredLanguage,
  pronouns,
  website,
  instagram,
  tiktok,
  youtube,
  merchInterest,
  preferredContactMethod,
  notificationOptIn,
  marketingOptIn,
  timezone,
  clientNotes,
  projectGoals,
  referralSource,
  accessibilityNotes,
  billingName,
  billingEmail,
  billingAddress,
  preferredPaymentMethod,
  budgetProfile,
  shippingName,
  shippingAddress,
  shippingCity,
  shippingRegion,
  shippingPostalCode,
  shippingCountry,
  taxId,
  profileFields
}) {
  const db = getDb();
  await db.collection(USERS).doc(userId).set(
    {
      schema_version: USER_SCHEMA_VERSION,
      full_name: fullName,
      username: asText(username).toLowerCase(),
      company,
      phone,
      service_interest: serviceInterest,
      user_type: userType,
      lead_source: leadSource,
      preferred_language: preferredLanguage,
      pronouns,
      website,
      instagram,
      tiktok,
      youtube,
      merch_interest: merchInterest,
      preferred_contact_method: preferredContactMethod,
      notification_opt_in: notificationOptIn,
      marketing_opt_in: marketingOptIn,
      timezone,
      client_notes: clientNotes,
      project_goals: projectGoals,
      referral_source: referralSource,
      accessibility_notes: accessibilityNotes,
      billing_name: billingName,
      billing_email: billingEmail,
      billing_address: billingAddress,
      preferred_payment_method: preferredPaymentMethod,
      budget_profile: budgetProfile,
      shipping_name: shippingName,
      shipping_address: shippingAddress,
      shipping_city: shippingCity,
      shipping_region: shippingRegion,
      shipping_postal_code: shippingPostalCode,
      shipping_country: shippingCountry,
      tax_id: taxId,
      profile_fields: sanitizeProfileFields(profileFields),
      last_profile_update_at: isoNow()
    },
    { merge: true }
  );
}

export async function updateUserLifecycle(userId, updates) {
  const db = getDb();
  await db.collection(USERS).doc(userId).set(updates, { merge: true });
}
