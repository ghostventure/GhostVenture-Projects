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
  "invoice_status", "invoice_amount_cents", "square_invoice_url"
];

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
  await db.collection(REQUESTS).doc(requestId).set(
    {
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
      last_manager_update_at: updatedAt
    },
    { merge: true }
  );
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
  details
}) {
  const db = getDb();
  await db.collection(REQUESTS).add({
    user_id: userId,
    project_type: projectType,
    budget,
    timeline,
    consultation_date: consultationDate,
    consultation_time: consultationTime,
    estimate_amount_cents: Number(estimateAmountCents || 0),
    deposit_amount_cents: Number(depositAmountCents || 0),
    details,
    status: "New",
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
  });
}

export async function upsertSquareAppointmentRequest(appointment) {
  const db = getDb();
  const now = isoNow();
  const safeBookingId = asText(appointment.squareBookingId)
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 120);
  const docRef = db.collection(REQUESTS).doc(`square_booking_${safeBookingId}`);

  return db.runTransaction(async (transaction) => {
    const existingDoc = await transaction.get(docRef);
    const existingData = existingDoc.exists ? existingDoc.data() : {};
    const existingVersion = Number(existingData.square_booking_version || -1);
    const incomingVersion = Number(appointment.squareBookingVersion || 0);

    if (existingDoc.exists && incomingVersion < existingVersion) {
      return docRef.id;
    }

    const createdAt = existingData.created_at || appointment.createdAt || now;
    transaction.set(
      docRef,
      {
        user_id: existingData.user_id || "",
        source: appointment.source,
        square_booking_id: appointment.squareBookingId,
        square_customer_id: appointment.squareCustomerId,
        square_location_id: appointment.squareLocationId,
        square_booking_status: appointment.squareBookingStatus,
        square_booking_version: incomingVersion,
        square_booking_url: appointment.squareBookingUrl,
        project_type: appointment.projectType,
        budget: appointment.budget,
        timeline: appointment.timeline,
        consultation_date: appointment.consultationDate,
        consultation_time: appointment.consultationTime,
        details: appointment.details,
        status: appointment.status,
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
        square_invoice_url: asText(data.square_invoice_url)
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
    transaction.set(requestRef, {
      ...updates,
      updated_at: updatedAt,
      updated_at_ms: timestampNow(),
      last_manager_update_at: updatedAt
    }, { merge: true });

    if (
      decisionMessage &&
      existing.user_id &&
      decisionStatusChanged
    ) {
      transaction.set(messageRef, {
        user_id: existing.user_id,
        sender_role: "studio",
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

export async function createMessage({ userId, senderRole, subject, body }) {
  const db = getDb();
  const message = {
    user_id: userId,
    sender_role: senderRole,
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
