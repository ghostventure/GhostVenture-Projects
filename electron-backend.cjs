const AdmZip = require('adm-zip')
const bcrypt = require('bcryptjs')
const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const cron = require('node-cron')
const nodemailer = require('nodemailer')
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')
const { z } = require('zod')
const { PublicClientApplication } = require('@azure/msal-node')

const profileSchema = z.object({
  ownerName: z.string().trim().optional().default(''),
  businessName: z.string().trim().optional().default(''),
  email: z.string().trim().email().or(z.literal('')),
  desktopPassword: z.string().optional().default(''),
  role: z.enum(['Owner', 'Front Desk', 'Bookkeeper', 'Support']).default('Owner'),
  acceptedTerms: z.boolean().optional().default(false),
  recoveryPhrase: z.string().trim().optional().default(''),
})

const registrationSchema = profileSchema.extend({
  email: z.string().trim().email(),
  desktopPassword: z.string().min(12),
  acceptedTerms: z.literal(true),
  selectedTier: z.enum(['silver', 'gold', 'black', 'cylinder']).default('silver'),
})

const passwordResetSchema = z.object({
  email: z.string().trim().email(),
  recoveryPhrase: z.string().trim().min(1),
  newPassword: z.string().min(12),
})

const userProfileUpdateSchema = z.object({
  email: z.string().trim().email(),
  ownerName: z.string().trim().optional().default(''),
  businessName: z.string().trim().optional().default(''),
  role: z.enum(['Owner', 'Front Desk', 'Bookkeeper', 'Support']).default('Owner'),
  status: z.enum(['Active', 'Suspended']).default('Active'),
})

const staffInviteSchema = z.object({
  ownerName: z.string().trim().min(1),
  businessName: z.string().trim().optional().default(''),
  email: z.string().trim().email(),
  role: z.enum(['Front Desk', 'Bookkeeper', 'Support']).default('Front Desk'),
  temporaryPassword: z.string().min(12),
})

const emailVerificationSchema = z.object({
  email: z.string().trim().email(),
  code: z.string().trim().min(6),
  desktopPassword: z.string().optional().default(''),
})

const approvalRequestSchema = z.object({
  actionType: z.enum(['quote_send', 'data_export', 'billing_change', 'customer_edit', 'restore', 'staff_access', 'policy_change']),
  title: z.string().trim().min(1),
  details: z.string().trim().optional().default(''),
  customerId: z.string().trim().optional().default(''),
})

const approvalDecisionSchema = z.object({
  approvalId: z.string().trim().min(1),
  decision: z.enum(['Approved', 'Rejected']),
  notes: z.string().trim().optional().default(''),
})

const pdfRequestSchema = z.object({
  customerId: z.string().optional().default(''),
  packetType: z.enum(['customer-intake', 'quote-review', 'support-request']).default('customer-intake'),
})

const dataRequestSchema = z.object({
  requestType: z.enum(['export', 'delete', 'retention_review']),
  subjectEmail: z.string().trim().email().or(z.literal('')),
  notes: z.string().trim().optional().default(''),
})

const taskStatusSchema = z.object({
  taskId: z.string().min(1),
  status: z.enum(['Open', 'Queued', 'Complete', 'Blocked']),
})

const customerSchema = z.object({
  businessName: z.string().trim().min(1),
  ownerName: z.string().trim().optional().default(''),
  email: z.string().trim().email().or(z.literal('')),
  industry: z.string().trim().optional().default('General services'),
  serviceArea: z.string().trim().optional().default('Local'),
  preferredContact: z.string().trim().optional().default('Email'),
})

const customerPlaybookSchema = z.object({
  customerId: z.string().trim().min(1),
  template: z.enum(['intake-control', 'quote-approval', 'payment-followup']),
})

const jobSchema = z.object({
  type: z.string().trim().min(1),
  title: z.string().trim().min(1),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
  runAt: z.string().optional().default(''),
})

const legalAckSchema = z.object({
  email: z.string().trim().email().or(z.literal('')),
  title: z.string().trim().min(1),
})

const stripeConfigSchema = z.object({
  mode: z.literal('test').default('test'),
  clientId: z.string().trim().optional().default(''),
  accountId: z.string().trim().optional().default(''),
  publishableKey: z.string().trim().optional().default(''),
})

const stripeImportSchema = z.object({
  accountId: z.string().trim().optional().default(''),
  businessName: z.string().trim().optional().default(''),
  managerEmail: z.string().trim().email().or(z.literal('')).optional().default(''),
  purchasedTier: z.enum(['silver', 'gold', 'black', 'cylinder']).optional().default('silver'),
  paymentStatus: z.enum(['paid', 'trial', 'past_due', 'canceled']).optional().default('paid'),
  externalCustomerId: z.string().trim().optional().default(''),
  externalSubscriptionId: z.string().trim().optional().default(''),
  customerCount: z.coerce.number().nonnegative().optional().default(0),
  subscriptionCount: z.coerce.number().nonnegative().optional().default(0),
  invoiceCount: z.coerce.number().nonnegative().optional().default(0),
  paymentCount: z.coerce.number().nonnegative().optional().default(0),
})

const squareConfigSchema = z.object({
  environment: z.enum(['sandbox', 'production']).default('sandbox'),
  applicationId: z.string().trim().optional().default(''),
  merchantId: z.string().trim().optional().default(''),
  locationId: z.string().trim().optional().default(''),
  accessToken: z.string().trim().optional().default(''),
  refreshToken: z.string().trim().optional().default(''),
})

const squareImportSchema = z.object({
  businessName: z.string().trim().optional().default(''),
  merchantId: z.string().trim().optional().default(''),
  locationName: z.string().trim().optional().default(''),
  locationId: z.string().trim().optional().default(''),
  customerCount: z.coerce.number().nonnegative().optional().default(0),
  catalogItemCount: z.coerce.number().nonnegative().optional().default(0),
  orderCount: z.coerce.number().nonnegative().optional().default(0),
  paymentCount: z.coerce.number().nonnegative().optional().default(0),
})

const microsoftConnectSchema = z.object({
  provider: z.enum(['graph', 'business_central']),
  clientId: z.string().trim().min(10),
  tenantId: z.string().trim().min(1).default('organizations'),
  environment: z.string().trim().min(1).default('Production'),
})

const microsoftPreviewSchema = z.object({
  connectionId: z.string().trim().min(1),
  companyId: z.string().trim().optional().default(''),
})

const microsoftImportSchema = z.object({
  previewId: z.string().trim().min(1),
  selectedIds: z.array(z.string().trim().min(1)).min(1).max(50),
})

const paymentRecordSchema = z.object({
  provider: z.enum(['stripe', 'square']),
  managerEmail: z.string().trim().email().or(z.literal('')).optional().default(''),
  tier: z.enum(['silver', 'gold', 'black', 'cylinder']),
  paymentStatus: z.enum(['paid', 'trial', 'past_due', 'canceled']).default('paid'),
  externalCustomerId: z.string().trim().optional().default(''),
  externalSubscriptionId: z.string().trim().optional().default(''),
  amount: z.coerce.number().optional().default(0),
  currency: z.string().trim().optional().default('usd'),
})

const subscriptionSchema = z.object({
  managerEmail: z.string().trim().email().or(z.literal('')),
  tier: z.enum(['silver', 'gold', 'black', 'cylinder']),
  paymentProvider: z.enum(['stripe', 'manual']).default('manual'),
  paymentStatus: z.enum(['trial', 'paid', 'past_due', 'canceled']).default('paid'),
  externalCustomerId: z.string().trim().optional().default(''),
  externalSubscriptionId: z.string().trim().optional().default(''),
  trialEndsAt: z.string().trim().optional().default(''),
})

const employeeLicenseSchema = z.object({
  employeeName: z.string().trim().min(1),
  email: z.string().trim().email(),
  jobTitle: z.string().trim().optional().default('OverHead team member'),
  accessLevel: z.enum(['Support', 'Operations', 'Management', 'Administrator']).default('Support'),
  expiresAt: z.string().trim().optional().default(''),
})

const employeeLicenseUpdateSchema = z.object({
  employeeLicenseId: z.string().trim().min(1),
  status: z.enum(['Active', 'Suspended', 'Inactive']),
  accessLevel: z.enum(['Support', 'Operations', 'Management', 'Administrator']).optional(),
  expiresAt: z.string().trim().optional().default(''),
})

const billingProfileSchema = z.object({
  managerEmail: z.string().trim().email().or(z.literal('')),
  legalName: z.string().trim().min(1),
  billingEmail: z.string().trim().email(),
  phone: z.string().trim().optional().default(''),
  addressLine1: z.string().trim().min(1),
  addressLine2: z.string().trim().optional().default(''),
  city: z.string().trim().min(1),
  region: z.string().trim().min(1),
  postalCode: z.string().trim().min(1),
  country: z.string().trim().min(2).default('US'),
  taxIdType: z.string().trim().optional().default(''),
  taxIdLast4: z.string().trim().optional().default(''),
  invoiceTerms: z.string().trim().optional().default('Due on receipt'),
  invoiceFooter: z.string().trim().optional().default('Thank you for using OverHead.'),
  consentToRecurringBilling: z.boolean().default(false),
  cancellationPathAcknowledged: z.boolean().default(false),
  billingPolicyAcknowledged: z.boolean().default(false),
})

const planDefinitions = {
  silver: {
    name: 'Silver',
    level: 'Basic',
    maxUsers: 1,
    maxCustomers: 250,
    features: ['customers', 'tasks', 'backups', 'support_bundle'],
  },
  gold: {
    name: 'Gold',
    level: 'Advanced',
    maxUsers: 3,
    maxCustomers: 1500,
    features: ['customers', 'tasks', 'backups', 'support_bundle', 'workflow_jobs', 'legal_acknowledgements', 'roles'],
  },
  black: {
    name: 'Black',
    level: 'Premium',
    maxUsers: 10,
    maxCustomers: 10000,
    features: ['customers', 'tasks', 'backups', 'support_bundle', 'workflow_jobs', 'legal_acknowledgements', 'roles', 'data_export', 'restore_validation', 'fraud_detection', 'stripe'],
  },
  cylinder: {
    name: 'Cylinder',
    level: 'Windows Server',
    maxUsers: 50,
    maxCustomers: 100000,
    features: ['customers', 'tasks', 'backups', 'support_bundle', 'workflow_jobs', 'legal_acknowledgements', 'roles', 'data_export', 'restore_validation', 'fraud_detection', 'server_deployment'],
  },
}

const isCylinderDeployment = () => process.env.OVERHEAD_DEPLOYMENT_MODE === 'cylinder'
const CYLINDER_EVALUATION_DAYS = 30
const OVERHEAD_TEAM_EMAIL_DOMAINS = ['@overheadteam.com', '@overheadteam.biz']

function isOfficialOverheadTeamEmail(email) {
  const normalized = String(email || '').trim().toLowerCase()
  return OVERHEAD_TEAM_EMAIL_DOMAINS.some((domain) => normalized.endsWith(domain) && normalized.length > domain.length)
}

function requireOfficialOverheadTeamEmail(email) {
  if (!isOfficialOverheadTeamEmail(email)) {
    throw new Error('OverHead Team accounts must use an authorized @overheadteam.com or @overheadteam.biz email address.')
  }
}

function cylinderEvaluationEndsAt() {
  const endsAt = new Date()
  endsAt.setDate(endsAt.getDate() + CYLINDER_EVALUATION_DAYS)
  return endsAt.toISOString()
}

function ensureCylinderEvaluation(managerEmail) {
  if (state.subscriptions.some((item) => item.manager_email === managerEmail)) return
  applySubscription({
    managerEmail,
    tier: 'cylinder',
    paymentProvider: 'manual',
    paymentStatus: 'trial',
    trialEndsAt: cylinderEvaluationEndsAt(),
  }, { skipRoleCheck: true })
}

const customerPlaybookTemplates = {
  'intake-control': {
    name: 'Intake Control',
    bookingRules: 'Capture the service request, address, timing window, contact preference, and any deposit requirement before booking.',
    answerTone: 'Friendly, direct, and short. Confirm details before promising price or availability.',
    quoteRules: 'Do not quote outside approved services. Send exceptions to the owner for review.',
    invoiceRules: 'Create the invoice only after the service details are confirmed.',
    followupRules: 'Send a service confirmation after the request is reviewed.',
    tasks: ['Review intake details before booking', 'Confirm the service scope and timing window'],
  },
  'quote-approval': {
    name: 'Quote Approval',
    bookingRules: 'Capture the request before offering an appointment or price.',
    answerTone: 'Clear and helpful. Do not promise discounts, exceptions, or unavailable service.',
    quoteRules: 'Owner approval is required before any quote outside the standard package is sent.',
    invoiceRules: 'Invoice after the approved quote is accepted or the service is completed.',
    followupRules: 'Follow up on unapproved or unanswered quotes before the expiration date.',
    tasks: ['Owner review required before quote is sent', 'Check quote exceptions and customer notes'],
  },
  'payment-followup': {
    name: 'Payment Follow-up',
    bookingRules: 'Confirm service details and payment expectations before booking.',
    answerTone: 'Polite, professional, and factual. Never discuss account details with an unverified contact.',
    quoteRules: 'Use approved service and payment terms in every quote.',
    invoiceRules: 'Send after service completion. Review unpaid invoices at day 3 and day 7 before escalating.',
    followupRules: 'Request a review after payment. Create an owner task before any final escalation.',
    tasks: ['Review unpaid invoice at day 3', 'Owner review before final payment escalation'],
  },
}

let dataRoot = ''
let dbPath = ''
let legacyDbPath = ''
let state = null
let schedulerStarted = false
let secureStore = null
let activeSession = null

const firebaseConfig = {
  apiKey: 'AIzaSyA2bxXMdNsXVgPaYv3jbWJXGlosVYtBd8U',
  projectId: 'overhead-office',
  billingApiUrl: 'https://us-central1-overhead-office.cloudfunctions.net/billingApi',
}

function firebaseError(body, fallback) {
  return new Error(body?.error?.message || fallback)
}

async function firebaseRequest(url, options = {}) {
  const response = await fetch(url, options)
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw firebaseError(body, `Firebase request failed (${response.status}).`)
  return body
}

async function billingApiRequest(action, payload = {}) {
  requireRole(['Owner'], 'billing')
  if (!activeSession?.firebaseIdToken) {
    throw new Error('Sign out and sign back in with your shared OverHead account before opening billing.')
  }
  const response = await fetch(firebaseConfig.billingApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${activeSession.firebaseIdToken}` },
    body: JSON.stringify({ action, ...payload }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || `Billing service failed (${response.status}).`)
  return body
}

async function createEmbeddedCheckout(payload = {}) {
  const tier = String(payload.tier || '').toLowerCase()
  if (!['silver', 'gold', 'black'].includes(tier)) throw new Error('Choose Silver, Gold, or Black before continuing to checkout.')
  return billingApiRequest('checkout', { tier, acceptBillingPolicy: payload.acceptBillingPolicy === true })
}

async function startFreeGoldTrial(payload = {}) {
  return billingApiRequest('start_free_gold_trial', { acceptTrialPolicy: payload.acceptTrialPolicy === true })
}

async function cancelSubscriptionWithUnusedTimeRefund() {
  return billingApiRequest('cancel_with_unused_time_refund')
}

async function getRemoteEntitlements() {
  const remote = await billingApiRequest('entitlements')
  const entitlement = remote.entitlement || {}
  if (['silver', 'gold', 'black'].includes(entitlement.tier)) {
    const paymentStatus = entitlement.status === 'active' ? 'paid'
      : entitlement.status === 'past_due' ? 'past_due'
        : entitlement.status === 'canceled' ? 'canceled' : 'trial'
    applySubscription({
      managerEmail: activeSession.email,
      tier: entitlement.tier,
      paymentProvider: 'stripe',
      paymentStatus,
      externalCustomerId: entitlement.stripe_customer_id || '',
      externalSubscriptionId: entitlement.stripe_subscription_id || '',
      trialEndsAt: entitlement.trial_ends_at || '',
    }, { skipRoleCheck: true })
  }
  if (remote.license) {
    const user = state.userProfiles.find((item) => item.email === activeSession.email)
    const local = state.licenses.find((item) => item.email === activeSession.email)
    if (user && local) {
      local.license_number = remote.license.license_number || local.license_number
      local.tier = remote.license.tier || local.tier
      local.status = remote.license.status || local.status
      local.updated_at = now()
      user.license_number = local.license_number
      state.savedFormMemory.license = { number: local.license_number, tier: local.tier, status: local.status }
      persist()
    }
  }
  return remote
}

async function getRemoteBillingActivity() {
  return billingApiRequest('billing_activity')
}

function firestoreFields(value) {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, typeof item === 'boolean'
    ? { booleanValue: item }
    : { stringValue: String(item ?? '') }]))
}

function firestoreValue(field) {
  if (!field) return undefined
  if ('stringValue' in field) return field.stringValue
  if ('booleanValue' in field) return field.booleanValue
  if ('integerValue' in field) return Number(field.integerValue)
  if ('doubleValue' in field) return field.doubleValue
  if ('timestampValue' in field) return field.timestampValue
  return undefined
}

function firestoreDocument(data) {
  return Object.fromEntries(Object.entries(data?.fields || {}).map(([key, field]) => [key, firestoreValue(field)]))
}

function firebaseHeaders(idToken) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }
}

async function writeFirestoreDocument(pathName, fields, idToken) {
  return firebaseRequest(`https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${pathName}`, {
    method: 'PATCH', headers: firebaseHeaders(idToken), body: JSON.stringify({ fields: firestoreFields(fields) }),
  })
}

async function updateFirestoreDocument(pathName, fields, idToken) {
  const updateMask = Object.keys(fields).map((field) => `updateMask.fieldPaths=${encodeURIComponent(field)}`).join('&')
  return firebaseRequest(`https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${pathName}?${updateMask}`, {
    method: 'PATCH', headers: firebaseHeaders(idToken), body: JSON.stringify({ fields: firestoreFields(fields) }),
  })
}

async function readFirestoreDocument(pathName, idToken) {
  const data = await firebaseRequest(`https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${pathName}`, {
    headers: firebaseHeaders(idToken),
  })
  return firestoreDocument(data)
}

async function listFirestoreDocuments(pathName, idToken) {
  const data = await firebaseRequest(`https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${pathName}`, { headers: firebaseHeaders(idToken) })
  return (data.documents || []).map((document) => ({ id: String(document.name || '').split('/').pop(), ...firestoreDocument(document) }))
}

function localRoleFor(sharedRole) {
  return sharedRole === 'Administrator' ? 'Owner' : sharedRole === 'Manager' ? 'Front Desk' : sharedRole === 'Customer' ? 'Customer' : 'Support'
}

function normalizeDesktopRole(role) {
  return ['Owner', 'Front Desk', 'Bookkeeper', 'Support'].includes(role) ? role : 'Owner'
}

function syncSharedProfile(profile, uid) {
  const email = String(profile.email || '').toLowerCase()
  let user = state.userProfiles.find((item) => item.firebase_uid === uid || item.email === email)
  if (!user) {
    user = { id: createId('user'), created_at: now(), recovery_phrase_hash: '', recovery_hint: 'Managed by Firebase', password_hash: '' }
    state.userProfiles.push(user)
  }
  Object.assign(user, {
    firebase_uid: uid,
    owner_name: profile.owner_name || email,
    business_name: profile.business_name || 'OverHead workspace',
    email,
    manager_email: email,
    role: localRoleFor(profile.role),
    shared_role: profile.role,
    workspace_id: profile.workspace_id,
    status: profile.status,
    email_verified: true,
    email_verified_at: user.email_verified_at || now(),
    terms_accepted_at: user.terms_accepted_at || now(),
    last_sign_in: now(),
    updated_at: now(),
  })
  if (user.role !== 'Customer') {
    ensureManagerProfile(user)
    ensureUserLicense(user)
  }
  state.rememberedSignIn = {
    ownerName: user.owner_name,
    businessName: user.business_name,
    email: user.email,
    role: user.shared_role || user.role,
    lastSuccessfulSignIn: now(),
  }
  state.savedFormMemory.profile = { ...state.rememberedSignIn }
  persist()
  return user
}

function getRememberedSignIn() {
  const remembered = state?.rememberedSignIn || {}
  return {
    ownerName: String(remembered.ownerName || ''),
    businessName: String(remembered.businessName || ''),
    email: String(remembered.email || ''),
    role: String(remembered.role || ''),
    lastSuccessfulSignIn: String(remembered.lastSuccessfulSignIn || ''),
  }
}

async function signInSharedProfile(payload) {
  // The sign-in form can contain a role remembered from the shared workspace
  // (for example, "Administrator"). That workspace role is authoritative only
  // after Firebase signs the user in, so it must not fail desktop-form validation.
  const profile = profileSchema.parse({ ...(payload || {}), role: normalizeDesktopRole(payload?.role) })
  const email = profile.email.toLowerCase()
  const session = await firebaseRequest(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: profile.desktopPassword, returnSecureToken: true }),
  })
  const sharedProfile = await readFirestoreDocument(`profiles/${session.localId}`, session.idToken)
  if (!sharedProfile.uid || sharedProfile.status !== 'Active') throw new Error('This shared account is not active for an OverHead workspace.')
  const accessLane = String(payload?.accessLane || '')
  const sharedRole = String(sharedProfile.role || '')
  if (accessLane === 'team' && !['Administrator', 'Manager', 'Staff'].includes(sharedRole)) {
    recordAudit('auth.access_lane_denied', 'Customer account attempted team access', { email, sharedRole, accessLane }, email)
    throw new Error('This is a customer account. Use Customer Access to sign in.')
  }
  if (accessLane === 'customer' && sharedRole !== 'Customer') {
    recordAudit('auth.access_lane_denied', 'Team account attempted customer access', { email, sharedRole, accessLane }, email)
    throw new Error('This is a staff or manager account. Use Team Access to sign in.')
  }
  const user = syncSharedProfile(sharedProfile, session.localId)
  recordAudit('auth.shared_sign_in', 'Shared Firebase desktop sign-in completed', { email, workspaceId: user.workspace_id, accessLane: accessLane || 'standard' }, email)
  return startSession(user, { firebaseIdToken: session.idToken, firebaseUid: session.localId })
}

async function registerSharedProfile(payload) {
  const profile = registrationSchema.parse({ ...(payload || {}), role: normalizeDesktopRole(payload?.role) })
  const email = profile.email.toLowerCase()
  const session = await firebaseRequest(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: profile.desktopPassword, returnSecureToken: true }),
  })
  const createdAt = now()
  try {
    await writeFirestoreDocument(`workspaces/${session.localId}`, {
      owner_uid: session.localId, business_name: profile.businessName, created_at: createdAt, updated_at: createdAt,
    }, session.idToken)
    const sharedProfile = {
      uid: session.localId, owner_name: profile.ownerName, business_name: profile.businessName, email,
      workspace_id: session.localId, role: 'Administrator', status: 'Active', email_verified: false,
      terms_accepted_at: createdAt, last_sign_in: createdAt, created_at: createdAt, updated_at: createdAt,
    }
    await writeFirestoreDocument(`profiles/${session.localId}`, sharedProfile, session.idToken)
    await firebaseRequest(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${firebaseConfig.apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestType: 'VERIFY_EMAIL', idToken: session.idToken }),
    }).catch(() => undefined)
    const user = syncSharedProfile(sharedProfile, session.localId)
    if (isCylinderDeployment()) ensureCylinderEvaluation(user.email)
    recordAudit('profile.shared_created', 'Shared Firebase workspace created from desktop', { email, workspaceId: session.localId }, email)
    return startSession(user, { firebaseIdToken: session.idToken, firebaseUid: session.localId })
  } catch (error) {
    throw new Error(`Workspace account was created but setup was incomplete: ${error.message}`)
  }
}

async function createCustomerPortalInvite(payload = {}) {
  requireRole(['Owner'], 'customer portal invitation')
  if (!activeSession?.firebaseIdToken || !activeSession?.firebaseUid) throw new Error('Sign out and sign back in with the shared Administrator account first.')
  const customerId = String(payload.customerId || ''); const customer = state.customers.find((item) => item.id === customerId)
  const email = String(payload.email || customer?.email || '').trim().toLowerCase()
  if (!customer || !email) throw new Error('Select a customer with an email address before creating portal access.')
  const workspaceId = activeSession.firebaseUid
  const createdAt = now()
  await writeFirestoreDocument(`workspaces/${workspaceId}/invites/${encodeURIComponent(email)}`, {
    email, role: 'Customer', workspace_id: workspaceId, customer_id: customer.id, business_name: customer.business_name || customer.owner_name || 'Customer', created_at: createdAt, updated_at: createdAt,
  }, activeSession.firebaseIdToken)
  const delivery = deliverOutboundEmail({ to: email, subject: 'Your OverHead Customer Access invitation', text: `You have been invited to OverHead Customer Access. Open the desktop app, choose Customer Access, then Create customer account. Enter this workspace code: ${workspaceId}`, tag: 'customer-invite' })
  recordAudit('customer.portal_invited', 'Customer portal invitation created', { customerId, email, workspaceId })
  return { workspaceId, email, delivery }
}

async function registerCustomerAccess(payload = {}) {
  const email = String(payload.email || '').trim().toLowerCase(); const password = String(payload.desktopPassword || ''); const workspaceId = String(payload.workspaceId || '').trim()
  if (!email || password.length < 12 || !workspaceId) throw new Error('Enter your invitation email, workspace code, and a password of at least 12 characters.')
  const session = await firebaseRequest(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) })
  try {
    const invite = await readFirestoreDocument(`workspaces/${workspaceId}/invites/${encodeURIComponent(email)}`, session.idToken)
    if (invite.email !== email || invite.role !== 'Customer') throw new Error('This invitation is not valid for customer access.')
    const profile = { uid: session.localId, owner_name: invite.business_name || email, business_name: invite.business_name || 'Customer account', email, workspace_id: workspaceId, role: 'Customer', status: 'Active', email_verified: false, terms_accepted_at: now(), last_sign_in: now(), created_at: now(), updated_at: now() }
    await writeFirestoreDocument(`profiles/${session.localId}`, profile, session.idToken)
    const user = syncSharedProfile(profile, session.localId)
    recordAudit('customer.portal_registered', 'Customer portal account registered', { email, workspaceId, customerId: invite.customer_id || '' }, email)
    return startSession(user, { firebaseIdToken: session.idToken, firebaseUid: session.localId })
  } catch (error) {
    throw new Error(`Customer account was created but portal setup was incomplete: ${error.message}`)
  }
}

function now() {
  return new Date().toISOString()
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`
}

function hashValue(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function defaultState() {
  return {
    schema: 'overhead-local-store-v2',
    createdAt: now(),
    updatedAt: now(),
    userProfiles: [],
    emailVerifications: [],
    rememberedSignIn: {
      ownerName: '',
      businessName: '',
      email: '',
      role: '',
      lastSuccessfulSignIn: '',
    },
    approvalRequests: [],
    savedFormMemory: {
      profile: {},
      billing: {},
      customer: {},
    },
    managerProfiles: [],
    subscriptions: [],
    licenses: [],
    employeeLicenses: [],
    billingProfiles: [],
    entitlements: [],
    sessions: [],
    appToggles: {
      privacyModeDefault: true,
      requireLegalAck: true,
      fraudDetection: true,
      allowDataExport: true,
      desktopNotifications: true,
      autoProcessDueJobs: true,
      stripeLiveMode: false,
      supportBundleIncludesStore: true,
      fillablePdfTools: true,
    },
    customers: [],
    appointments: [],
    quotes: [],
    invoices: [],
    workflowPreferences: [],
    guidedLaunchRuns: [],
    adminTasks: [],
    supportTickets: [],
    documents: [],
    legalDocuments: [],
    legalAcknowledgements: [],
    workflowJobs: [],
    fraudSignals: [],
    stripeConnections: [],
    stripeImports: [],
    squareConnections: [],
    squareImports: [],
    microsoftConnections: [],
    paymentRecords: [],
    dataRequests: [],
    settings: {},
    auditEvents: [],
    integritySnapshots: [],
  }
}

const microsoftImportPreviews = new Map()
const MICROSOFT_PREVIEW_TTL_MS = 15 * 60 * 1000

function clearExpiredMicrosoftPreviews() {
  const cutoff = Date.now() - MICROSOFT_PREVIEW_TTL_MS
  for (const [previewId, preview] of microsoftImportPreviews) {
    if (Date.parse(preview.created_at) < cutoff) microsoftImportPreviews.delete(previewId)
  }
}

function initBackend(app, options = {}) {
  dataRoot = path.join(app.getPath('userData'), 'data')
  dbPath = path.join(dataRoot, 'overhead-store.secure')
  legacyDbPath = path.join(dataRoot, 'overhead-store.json')
  secureStore = options.secureStore || null
  fs.mkdirSync(dataRoot, { recursive: true })
  state = readState()
  seed()
  persist()
  startScheduler()
  return getHealth()
}

function readState() {
  if (fs.existsSync(dbPath)) {
    try {
      const encrypted = fs.readFileSync(dbPath, 'utf8')
      return { ...defaultState(), ...JSON.parse(decryptStore(encrypted)) }
    } catch {
      const corruptPath = `${dbPath}.corrupt-${Date.now()}`
      fs.copyFileSync(dbPath, corruptPath)
      return defaultState()
    }
  }
  if (!fs.existsSync(legacyDbPath)) return defaultState()
  try {
    const migrated = { ...defaultState(), ...JSON.parse(fs.readFileSync(legacyDbPath, 'utf8')) }
    fs.renameSync(legacyDbPath, `${legacyDbPath}.migrated-${Date.now()}`)
    return migrated
  } catch {
    const corruptPath = `${legacyDbPath}.corrupt-${Date.now()}`
    fs.copyFileSync(legacyDbPath, corruptPath)
    return defaultState()
  }
}

function persist() {
  state.updatedAt = now()
  const tmpPath = `${dbPath}.tmp`
  fs.writeFileSync(tmpPath, encryptStore(JSON.stringify(state, null, 2)), 'utf8')
  fs.renameSync(tmpPath, dbPath)
}

function encryptStore(plainText) {
  if (secureStore?.available && secureStore.encryptString) {
    return `safeStorage:v1:${secureStore.encryptString(plainText)}`
  }
  return `plain:v1:${Buffer.from(plainText, 'utf8').toString('base64')}`
}

function decryptStore(payload) {
  if (payload.startsWith('safeStorage:v1:')) {
    if (!secureStore?.decryptString) throw new Error('Encrypted store is unavailable on this device.')
    return secureStore.decryptString(payload.slice('safeStorage:v1:'.length))
  }
  if (payload.startsWith('plain:v1:')) {
    return Buffer.from(payload.slice('plain:v1:'.length), 'base64').toString('utf8')
  }
  return payload
}

function seed() {
  if (!state.customers.length) {
    const createdAt = now()
    state.customers.push({
      id: 'oh-cust-001',
      business_name: 'Oak City Detail',
      owner_name: 'Jordan Miles',
      email: 'owner@oakcity.example',
      industry: 'Auto detailing',
      service_area: 'Raleigh, Cary, Knightdale',
      preferred_contact: 'Email',
      status: 'Active setup',
      created_at: createdAt,
      updated_at: createdAt,
    })
    state.workflowPreferences.push({
      customer_id: 'oh-cust-001',
      booking_rules: 'Require service type, vehicle size, address, date window, and deposit status.',
      answer_tone: 'Direct, polite, short. Escalate pricing exceptions to owner.',
      quote_rules: 'Use base package, add pet hair, heavy soil, mobile travel, and ceramic add-ons.',
      invoice_rules: 'Send invoice after service completion. Remind at day 3 and day 7 if unpaid.',
      followup_rules: 'Send review request after paid invoice. Send maintenance reminder after 30 days.',
      human_review_required: 1,
    })
    ;[
      ['Approve quote policy', 'Workflows', 'Open', 'High', 1],
      ['Review customer policy record', 'Customers', 'Open', 'High', 1],
      ['Prepare support export', 'Support', 'Queued', 'Normal', 0],
      ['Run integrity snapshot', 'Evidence', 'Open', 'High', 0],
    ].forEach(([title, area, status, priority, isProtected]) => {
      state.adminTasks.push({
        id: createId('task'),
        customer_id: 'oh-cust-001',
        title,
        area,
        status,
        priority,
        due_at: createdAt,
        protected: isProtected,
        created_at: createdAt,
        updated_at: createdAt,
      })
    })
  }

  ;[
    ['Terms of Use', 'Draft included', 'OverHead local desktop terms placeholder for customer review before production release.'],
    ['Privacy Notice', 'Draft included', 'OverHead stores local records on this device unless export or provider sync is enabled.'],
    ['Acceptable Use Policy', 'Draft included', 'Users may not use OverHead for fraud, credential sharing, deceptive billing, or unauthorized data access.'],
    ['AI Use Disclosure', 'Draft included', 'AI-assisted drafts are suggestions and require owner review before customer-facing use.'],
    ['Data Retention Policy', 'Draft included', 'Customer records should be retained only as long as needed for service, support, and business records.'],
    ['Data Responsibility Disclaimer', 'Draft included', 'OverHead is responsible for the functionality of the program. The customer is responsible for backups, user-entered records, data decisions, data loss, and data manipulation performed by authorized users or outside parties.'],
    ['Support Policy', 'Draft included', 'Support exports can include diagnostics, app version, profile status, and recent audit entries.'],
    ['Subscription Billing & Authorization Policy', 'Draft - legal review required', 'Paid plans renew on the billing interval shown at checkout until canceled. Owners must review plan, price, billing interval, and recurring authorization before checkout. Stripe is the authoritative payment record.'],
    ['Free Trial Policy', 'Draft - legal review required', 'One 30-day, no-card Gold-equivalent trial is available per workspace. It ends automatically, is not transferable or extendable, and may not be recreated through additional accounts or workspaces.'],
    ['Cancellation & Prorated Refund Policy', 'Draft - legal review required', 'Eligible unused time in the current paid period is refunded proportionally to the original payment method after immediate cancellation. Trials, fully used periods, unpaid amounts, and ineligible requests are not refundable.'],
    ['Workspace License & Access Policy', 'Draft - legal review required', 'Licenses are automatically assigned to active workspace members, are not transferable, and may be suspended for trial expiry, cancellation, nonpayment, or misuse.'],
  ].forEach(([title, status, body]) => {
    if (!state.legalDocuments.some((document) => document.title === title)) {
      state.legalDocuments.push({
        id: createId('legal'),
        title,
        version: '0.1',
        status,
        body,
        effective_at: '',
        updated_at: now(),
      })
    }
  })

  if (!Array.isArray(state.legalAcknowledgements)) state.legalAcknowledgements = []
  if (!Array.isArray(state.workflowJobs)) state.workflowJobs = []
  if (!Array.isArray(state.guidedLaunchRuns)) state.guidedLaunchRuns = []
  if (!Array.isArray(state.fraudSignals)) state.fraudSignals = []
  if (!Array.isArray(state.stripeConnections)) state.stripeConnections = []
  state.stripeConnections = state.stripeConnections.map((connection) => {
    delete connection.restricted_key_hash
    delete connection.webhook_secret_hash
    return connection
  })
  if (!Array.isArray(state.stripeImports)) state.stripeImports = []
  if (!Array.isArray(state.squareConnections)) state.squareConnections = []
  if (!Array.isArray(state.squareImports)) state.squareImports = []
  if (!Array.isArray(state.paymentRecords)) state.paymentRecords = []
  if (!Array.isArray(state.dataRequests)) state.dataRequests = []
  if (!Array.isArray(state.managerProfiles)) state.managerProfiles = []
  if (!Array.isArray(state.emailVerifications)) state.emailVerifications = []
  state.rememberedSignIn = { ...defaultState().rememberedSignIn, ...(state.rememberedSignIn || {}) }
  if (!Array.isArray(state.approvalRequests)) state.approvalRequests = []
  state.savedFormMemory = { ...defaultState().savedFormMemory, ...(state.savedFormMemory || {}) }
  if (!Array.isArray(state.subscriptions)) state.subscriptions = []
  if (!Array.isArray(state.licenses)) state.licenses = []
  if (!Array.isArray(state.employeeLicenses)) state.employeeLicenses = []
  if (!Array.isArray(state.billingProfiles)) state.billingProfiles = []
  if (!Array.isArray(state.entitlements)) state.entitlements = []
  state.appToggles = { ...defaultState().appToggles, ...(state.appToggles || {}) }
}

function startScheduler() {
  if (schedulerStarted) return
  schedulerStarted = true
  cron.schedule('*/5 * * * *', () => {
    try {
      if (!activeSession) return
      processDueJobs()
    } catch (error) {
      recordAudit('scheduler.failed', 'Workflow scheduler failed', error.message || String(error))
    }
  })
}

function recordAudit(eventType, title, details, actor = 'local') {
  const event = {
    id: createId('audit'),
    actor,
    event_type: eventType,
    title,
    details: typeof details === 'string' ? details : JSON.stringify(details),
    created_at: now(),
  }
  state.auditEvents.unshift({ ...event, checksum: hashValue(event) })
  state.auditEvents = state.auditEvents.slice(0, 500)
  persist()
  return event
}

function recordFraudSignal(type, severity, details, actor = activeSession?.email || 'local') {
  const signal = {
    id: createId('risk'),
    type,
    severity,
    actor,
    device_name: os.hostname(),
    details: typeof details === 'string' ? details : JSON.stringify(details),
    status: 'Open',
    checksum: hashValue({ type, severity, details, actor }),
    created_at: now(),
  }
  state.fraudSignals.unshift(signal)
  state.fraudSignals = state.fraudSignals.slice(0, 500)
  persist()
  recordAudit('fraud.signal', 'Fraud signal recorded', { type, severity, id: signal.id }, actor)
  return signal
}

function signIn(payload) {
  const profile = profileSchema.parse(payload || {})
  const email = (profile.email || 'owner@overhead.local').toLowerCase()
  const user = state.userProfiles.find((item) => item.email === email)

  if (!user) {
    throw new Error('No local account exists for that email. Use Register first.')
  }
  if (user.email_verified === false) {
    sendVerificationEmail(user, 'sign-in-verification-required')
    throw new Error('Email verification is required. A new code was sent or queued.')
  }
  if (!profile.desktopPassword || !bcrypt.compareSync(profile.desktopPassword, user.password_hash)) {
    recordAudit('auth.failed', 'Desktop sign-in failed', { email }, email)
    const recentFailures = state.auditEvents.filter((event) => event.event_type === 'auth.failed' && event.actor === email).slice(0, 5)
    if (recentFailures.length >= 3) {
      recordFraudSignal('repeated_failed_sign_in', 'High', { email, failures: recentFailures.length }, email)
    }
    throw new Error('Invalid desktop password.')
  }
  user.last_sign_in = now()
  user.updated_at = now()
  ensureManagerProfile(user)
  ensureUserLicense(user)
  persist()
  recordAudit('auth.sign_in', 'Desktop sign-in completed', { email }, email)

  return startSession(user)
}

function registerProfile(payload) {
  const profile = registrationSchema.parse(payload || {})
  const email = profile.email.toLowerCase()
  if (state.userProfiles.find((item) => item.email.toLowerCase() === email)) {
    throw new Error('That username is already registered on this computer.')
  }
  const createdAt = now()
  const user = {
    id: createId('user'),
    owner_name: profile.ownerName || 'Local Owner',
    business_name: profile.businessName || 'Business workspace',
    email,
    manager_email: email,
    role: profile.role,
    status: 'Pending verification',
    email_verified: false,
    email_verified_at: '',
    password_hash: bcrypt.hashSync(profile.desktopPassword, 10),
    recovery_phrase_hash: profile.recoveryPhrase ? bcrypt.hashSync(profile.recoveryPhrase, 10) : '',
    recovery_hint: profile.recoveryPhrase ? `Set ${createdAt.slice(0, 10)}` : 'Not set',
    terms_accepted_at: createdAt,
    last_sign_in: createdAt,
    created_at: createdAt,
    updated_at: createdAt,
  }
  state.userProfiles.push(user)
  state.savedFormMemory.profile = {
    ownerName: user.owner_name,
    businessName: user.business_name,
    email: user.email,
    role: user.shared_role || user.role,
  }
  ensureManagerProfile(user)
  if (isCylinderDeployment()) ensureCylinderEvaluation(user.email)
  else applySubscription({
    managerEmail: user.email,
    tier: profile.selectedTier,
    paymentProvider: 'manual',
    paymentStatus: 'trial',
  }, { skipRoleCheck: true })
  ensureUserLicense(user)
  persist()
  recordAudit('profile.created', 'Local profile created', { email: user.email, role: user.role }, user.email)
  return {
    registered: true,
    verificationRequired: true,
    email: user.email,
    delivery: sendVerificationEmail(user, 'owner-registration'),
  }
}

function createStaffAccount(payload = {}) {
  requireRole(['Owner'], 'staff account creation')
  requireFeature('roles')
  const input = staffInviteSchema.parse(payload)
  const email = input.email.toLowerCase()
  if (state.userProfiles.find((item) => item.email.toLowerCase() === email)) {
    throw new Error('That username is already registered on this computer.')
  }
  const createdAt = now()
  const user = {
    id: createId('user'),
    owner_name: input.ownerName,
    business_name: input.businessName || activeSession?.email || 'Staff workspace',
    email,
    manager_email: activeSession.email,
    role: input.role,
    status: 'Pending verification',
    email_verified: false,
    email_verified_at: '',
    password_hash: bcrypt.hashSync(input.temporaryPassword, 10),
    recovery_phrase_hash: '',
    recovery_hint: 'Not set',
    terms_accepted_at: '',
    last_sign_in: '',
    created_at: createdAt,
    updated_at: createdAt,
  }
  state.userProfiles.push(user)
  state.savedFormMemory.profile = {
    ownerName: user.owner_name,
    businessName: user.business_name,
    email: user.email,
    role: user.role,
  }
  ensureUserLicense(user)
  persist()
  const delivery = sendVerificationEmail(user, 'staff-invite')
  recordAudit('staff.invited', 'Staff account created pending email verification', { email, role: input.role }, activeSession.email)
  return { users: listUserProfiles(), delivery }
}

function sendVerificationEmail(user, purpose) {
  const code = String(crypto.randomInt(100000, 999999))
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
  const verification = {
    id: createId('verify'),
    email: user.email,
    purpose,
    code_hash: hashValue(code),
    attempts: 0,
    status: 'Pending',
    expires_at: expiresAt,
    created_at: now(),
  }
  state.emailVerifications = state.emailVerifications.filter((item) => item.email !== user.email || item.status !== 'Pending')
  state.emailVerifications.unshift(verification)
  persist()

  const subject = 'Confirm your OverHead email'
  const body = [
    `Your OverHead verification code is ${code}.`,
    `It expires at ${expiresAt}.`,
    'If you did not request this, do not share the code.',
  ].join('\n')

  return deliverOutboundEmail({ to: user.email, subject, text: body, tag: 'verify', metadata: { purpose, expiresAt } })
}

function deliverOutboundEmail({ to, subject, text, tag = 'message', metadata = {} }) {
  const smtpHost = process.env.OVERHEAD_SMTP_HOST
  if (smtpHost && process.env.OVERHEAD_SMTP_USER && process.env.OVERHEAD_SMTP_PASS) {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(process.env.OVERHEAD_SMTP_PORT || 587),
      secure: process.env.OVERHEAD_SMTP_SECURE === 'true',
      auth: {
        user: process.env.OVERHEAD_SMTP_USER,
        pass: process.env.OVERHEAD_SMTP_PASS,
      },
    })
    transporter.sendMail({
      from: process.env.OVERHEAD_SMTP_FROM || process.env.OVERHEAD_SMTP_USER,
      to,
      subject,
      text: body,
    }).catch((error) => {
      recordAudit('email.send_failed', 'Outbound email send failed', { email: to, tag, error: error.message || String(error) })
    })
    recordAudit('email.sent', 'Outbound email handed to SMTP', { email: to, tag, ...metadata })
    return { status: 'sent', channel: 'smtp', ...metadata }
  }

  const outboxDir = path.join(dataRoot, 'email-outbox')
  fs.mkdirSync(outboxDir, { recursive: true })
  const outboxPath = path.join(outboxDir, `${tag}-${String(to).replace(/[^a-z0-9_.-]/gi, '_')}-${Date.now()}.txt`)
  fs.writeFileSync(outboxPath, `To: ${to}\nSubject: ${subject}\n\n${text}\n`, 'utf8')
  recordAudit('email.queued', 'Outbound email queued to local outbox', { email: to, tag, outboxPath, ...metadata })
  return { status: 'queued', channel: 'local-outbox', outboxPath, ...metadata }
}

function verifyEmail(payload = {}) {
  const input = emailVerificationSchema.parse(payload)
  const email = input.email.toLowerCase()
  const user = state.userProfiles.find((item) => item.email.toLowerCase() === email)
  if (!user) throw new Error('Account not found.')
  const verification = state.emailVerifications.find((item) => item.email === email && item.status === 'Pending')
  if (!verification) throw new Error('No pending verification code was found.')
  if (verification.expires_at < now()) {
    verification.status = 'Expired'
    persist()
    throw new Error('Verification code expired.')
  }
  verification.attempts += 1
  if (verification.code_hash !== hashValue(input.code)) {
    persist()
    if (verification.attempts >= 3) recordFraudSignal('email_verification_failed', 'High', { email, attempts: verification.attempts }, email)
    throw new Error('Verification code did not match.')
  }
  verification.status = 'Verified'
  user.email_verified = true
  user.email_verified_at = now()
  user.status = 'Active'
  user.terms_accepted_at = user.terms_accepted_at || now()
  user.updated_at = now()
  persist()
  recordAudit('email.verified', 'Email address verified', { email }, email)
  return input.desktopPassword ? signIn({ email, desktopPassword: input.desktopPassword }) : { verified: true, email }
}

function startSession(user, sharedIdentity = {}) {
  const session = {
    id: createId('session'),
    user_profile_id: user.id,
    device_name: os.hostname(),
    lock_state: 'unlocked',
    started_at: now(),
    last_seen_at: now(),
    ended_at: '',
  }
  state.sessions.unshift(session)
  activeSession = { id: session.id, email: user.email, role: user.role, firebaseIdToken: sharedIdentity.firebaseIdToken || '', firebaseUid: sharedIdentity.firebaseUid || user.firebase_uid || '' }
  persist()

  return {
    signedIn: true,
    ownerName: user.owner_name,
    businessName: user.business_name,
    email: user.email,
    role: user.role,
    acceptedTerms: Boolean(user.terms_accepted_at),
    sessionId: session.id,
  }
}

function resumeRememberedSession() {
  const openSession = state.sessions.find((item) => item.lock_state === 'unlocked' && !item.ended_at)
  if (!openSession) return null
  const user = state.userProfiles.find((item) => item.id === openSession.user_profile_id && item.status === 'Active')
  if (!user) return null

  openSession.last_seen_at = now()
  activeSession = { id: openSession.id, email: user.email, role: user.role }
  persist()
  return {
    signedIn: true,
    ownerName: user.owner_name,
    businessName: user.business_name,
    email: user.email,
    role: user.role,
    acceptedTerms: Boolean(user.terms_accepted_at),
    sessionId: openSession.id,
  }
}

function ensureManagerProfile(user) {
  if (!state.managerProfiles.find((manager) => manager.email === user.email)) {
    state.managerProfiles.push({
      id: createId('manager'),
      user_profile_id: user.id,
      name: user.owner_name,
      email: user.email,
      role: 'Billing Manager',
      status: 'Active',
      created_at: now(),
      updated_at: now(),
    })
  }
  if (!state.subscriptions.find((subscription) => subscription.manager_email === user.email)) {
    applySubscription({
      managerEmail: user.email,
      tier: 'silver',
      paymentProvider: 'manual',
      paymentStatus: 'trial',
    }, { skipRoleCheck: true })
  }
}

function numberedRecord(prefix) {
  return `OH-${prefix}-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
}

function sharedLicenseNumber(user) {
  if (!user?.workspace_id || !user?.firebase_uid) return ''
  return `OH-LIC-${crypto.createHash('sha256').update(`${user.workspace_id}:${user.firebase_uid}`).digest('hex').slice(0, 12).toUpperCase()}`
}

function sharedSubscriptionNumber(user, subscription) {
  if (!user?.workspace_id || !user?.firebase_uid) return ''
  const source = subscription?.external_subscription_id || subscription?.tier || 'silver'
  return `OH-SUB-${crypto.createHash('sha256').update(`${user.workspace_id}:${source}`).digest('hex').slice(0, 12).toUpperCase()}`
}

function subscriptionForUser(user) {
  const managerEmail = user.manager_email || user.email
  return state.subscriptions.find((item) => item.manager_email === managerEmail)
    || state.subscriptions.find((item) => item.manager_email === user.email)
    || null
}

function userLicenseStatus(user, subscription) {
  if (user.status === 'Suspended' || ['past_due', 'canceled'].includes(subscription?.payment_status)) return 'Suspended'
  return subscription?.payment_status === 'trial' ? 'Trial' : 'Active'
}

function ensureUserLicense(user) {
  const subscription = subscriptionForUser(user)
  const existing = state.licenses.find((item) => item.user_profile_id === user.id || item.email === user.email)
  const issuedAt = existing?.issued_at || now()
  const license = {
    id: existing?.id || createId('license'),
    license_number: existing?.license_number || sharedLicenseNumber(user) || numberedRecord('LIC'),
    subscription_number: subscription?.subscription_number || existing?.subscription_number || sharedSubscriptionNumber(user, subscription) || numberedRecord('SUB'),
    user_profile_id: user.id,
    manager_email: user.manager_email || user.email,
    email: user.email,
    holder_name: user.owner_name || user.email,
    business_name: user.business_name || '',
    tier: subscription?.tier || existing?.tier || 'silver',
    status: userLicenseStatus(user, subscription),
    issued_at: issuedAt,
    renewed_at: existing?.renewed_at || issuedAt,
    updated_at: now(),
  }
  if (existing) Object.assign(existing, license)
  else state.licenses.unshift(license)
  user.license_number = license.license_number
  user.subscription_number = license.subscription_number
  return license
}

function syncUserLicenses(managerEmail) {
  state.userProfiles
    .filter((user) => (user.manager_email || user.email) === managerEmail || user.email === managerEmail)
    .forEach((user) => ensureUserLicense(user))
}

function currentSubscription() {
  const email = activeSession?.email
  const usable = (item) => ['paid', 'trial'].includes(item.payment_status)
    && !(item.payment_status === 'trial' && item.trial_ends_at && Date.parse(item.trial_ends_at) <= Date.now())
  return state.subscriptions.find((item) => item.manager_email === email && usable(item))
    || state.subscriptions.find((item) => usable(item))
    || null
}

function currentPlan() {
  return planDefinitions[currentSubscription()?.tier] || planDefinitions.silver
}

function requireFeature(feature) {
  const plan = currentPlan()
  if (!plan.features.includes(feature)) {
    recordFraudSignal('plan_feature_denied', 'Medium', { feature, plan: plan.name })
    throw new Error(`${feature} requires a higher plan than ${plan.name}.`)
  }
}

function enforceCustomerLimit() {
  const plan = currentPlan()
  if (state.customers.length >= plan.maxCustomers) {
    throw new Error(`${plan.name} allows up to ${plan.maxCustomers} customer records.`)
  }
}

function lockSession(sessionId) {
  const session = state.sessions.find((item) => item.id === sessionId)
  if (session) {
    session.lock_state = 'locked'
    session.ended_at = now()
    session.last_seen_at = now()
    persist()
  }
  activeSession = null
  recordAudit('session.locked', 'Desktop session locked', { sessionId })
  return { locked: true }
}

function requireRole(allowedRoles, action) {
  if (!activeSession) throw new Error('Sign in is required.')
  if (!allowedRoles.includes(activeSession.role)) {
    recordAudit('access.denied', 'Role action denied', { role: activeSession.role, action }, activeSession.email)
    recordFraudSignal('role_denied_action', 'Medium', { role: activeSession.role, action }, activeSession.email)
    throw new Error(`${activeSession.role} cannot perform ${action}.`)
  }
}

function requireSession(action = 'workspace access') {
  if (!activeSession) throw new Error(`Sign in is required for ${action}.`)
}

function getBootstrap() {
  requireSession('workspace bootstrap')
  return {
    dataRoot,
    health: getHealth(),
    customers: listCustomers(),
    appointments: listAppointments(),
    quotes: listQuotes(),
    invoices: listInvoices(),
    tasks: listTasks(),
    supportTickets: [...state.supportTickets].sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    documents: listDocuments(),
    legalDocuments: [...state.legalDocuments].sort((a, b) => a.title.localeCompare(b.title)),
    legalAcknowledgements: [...state.legalAcknowledgements],
    managerProfiles: [...state.managerProfiles],
    subscriptions: [...state.subscriptions],
    licenses: listLicenses(),
    employeeLicenses: activeSession.role === 'Owner' ? listEmployeeLicenses() : [],
    billingProfiles: listBillingProfiles(),
    entitlements: getEntitlementState(),
    officeChecklist: buildOfficeChecklist(),
    userProfiles: listUserProfiles(),
    approvalRequests: listApprovalRequests(),
    savedFormMemory: state.savedFormMemory,
    appToggles: state.appToggles,
    complianceSummary: getComplianceSummary(),
    workflowJobs: listWorkflowJobs(),
    guidedLaunchRuns: [...state.guidedLaunchRuns],
    fraudSignals: listFraudSignals(),
    stripeConnections: listStripeConnections(),
    stripeImports: listStripeImports(),
    squareConnections: listSquareConnections(),
    squareImports: listSquareImports(),
    microsoftConnections: listMicrosoftConnections(),
    paymentRecords: listPaymentRecords(),
    auditEvents: listAuditEvents(),
    settings: state.settings,
  }
}

const documentExtensions = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt', '.png', '.jpg', '.jpeg'])
const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024

function listDocuments(customerId = '') {
  requireSession('document viewing')
  const records = customerId ? state.documents.filter((item) => item.customer_id === customerId) : state.documents
  return [...records].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
}

function attachCustomerDocument(payload = {}) {
  requireRole(['Owner', 'Front Desk', 'Support'], 'customer document upload')
  const customerId = String(payload.customerId || ''); const sourcePath = String(payload.sourcePath || '')
  const customer = state.customers.find((item) => item.id === customerId)
  if (!customer || !sourcePath || !fs.existsSync(sourcePath)) throw new Error('Choose an existing file and a saved customer record.')
  const source = path.resolve(sourcePath); const extension = path.extname(source).toLowerCase(); const details = fs.statSync(source)
  if (!documentExtensions.has(extension)) throw new Error('Use a PDF, Office document, spreadsheet, image, text, or CSV file.')
  if (!details.isFile() || details.size > MAX_DOCUMENT_BYTES) throw new Error('Documents must be files smaller than 25 MB.')
  const documentId = createId('document'); const outputDir = path.join(dataRoot, 'documents', customerId); fs.mkdirSync(outputDir, { recursive: true })
  const safeName = path.basename(source, extension).replace(/[^a-z0-9_-]/gi, '_').slice(0, 80) || 'document'
  const storedPath = path.join(outputDir, `${documentId}-${safeName}${extension}`)
  fs.copyFileSync(source, storedPath)
  const document = { id: documentId, customer_id: customerId, label: String(payload.label || path.basename(source)).trim().slice(0, 120), file_name: path.basename(source), stored_path: storedPath, extension, byte_size: details.size, checksum: crypto.createHash('sha256').update(fs.readFileSync(storedPath)).digest('hex'), uploaded_by: activeSession.email, created_at: now(), updated_at: now() }
  state.documents.unshift(document); persist(); recordAudit('document.attached', 'Customer document attached', { id: document.id, customerId, fileName: document.file_name, byteSize: document.byte_size }); return document
}

function getStoredDocumentPath(documentId = '') {
  requireRole(['Owner', 'Front Desk', 'Support'], 'customer document opening')
  const document = state.documents.find((item) => item.id === String(documentId || ''))
  if (!document || !fs.existsSync(document.stored_path)) throw new Error('That document is no longer available on this device.')
  return document.stored_path
}

function listAppointments() { requireSession('appointment viewing'); return [...state.appointments].sort((a, b) => String(a.scheduled_for).localeCompare(String(b.scheduled_for))) }
function listQuotes() { requireSession('quote viewing'); return [...state.quotes].sort((a, b) => b.updated_at.localeCompare(a.updated_at)) }
function listInvoices() { requireSession('invoice viewing'); return [...state.invoices].sort((a, b) => b.updated_at.localeCompare(a.updated_at)) }
function createAppointment(payload = {}) {
  requireRole(['Owner', 'Front Desk', 'Support'], 'appointment creation')
  const title = String(payload.title || '').trim(); const scheduledFor = String(payload.scheduledFor || '').trim()
  if (!title || !scheduledFor) throw new Error('Add an appointment title and scheduled date/time.')
  const appointment = { id: createId('appointment'), title, customer_id: String(payload.customerId || ''), scheduled_for: scheduledFor, status: 'Scheduled', notes: String(payload.notes || '').trim(), created_at: now(), updated_at: now() }
  state.appointments.unshift(appointment); state.adminTasks.unshift({ id: createId('task'), title: `Appointment: ${title}`, area: 'Scheduling', status: 'Open', due_at: scheduledFor, created_at: now(), updated_at: now() }); persist(); recordAudit('appointment.created', 'Appointment scheduled', { id: appointment.id, title }); return listAppointments()
}
function createQuote(payload = {}) {
  requireRole(['Owner', 'Front Desk'], 'quote creation')
  const title = String(payload.title || '').trim(); const amount = Number(payload.amount || 0)
  if (!title || amount <= 0) throw new Error('Add a quote title and amount greater than zero.')
  const quote = { id: createId('quote'), title, customer_id: String(payload.customerId || ''), amount, status: 'Draft', notes: String(payload.notes || '').trim(), created_at: now(), updated_at: now() }
  state.quotes.unshift(quote); persist(); recordAudit('quote.created', 'Quote created', { id: quote.id, title, amount }); return listQuotes()
}
function createInvoice(payload = {}) {
  requireRole(['Owner', 'Front Desk', 'Bookkeeper'], 'invoice creation')
  const title = String(payload.title || '').trim(); const amount = Number(payload.amount || 0)
  if (!title || amount <= 0) throw new Error('Add an invoice title and amount greater than zero.')
  const invoice = { id: createId('invoice'), title, customer_id: String(payload.customerId || ''), amount, status: 'Open', due_date: String(payload.dueDate || ''), created_at: now(), updated_at: now() }
  state.invoices.unshift(invoice); persist(); recordAudit('invoice.created', 'Invoice created', { id: invoice.id, title, amount }); return listInvoices()
}
function updateOperationalStatus(payload = {}) {
  const type = String(payload.type || ''); const id = String(payload.id || ''); const status = String(payload.status || '')
  const definitions = { appointment: { rows: state.appointments, statuses: ['Scheduled', 'Confirmed', 'Complete', 'Canceled'], roles: ['Owner', 'Front Desk', 'Support'] }, quote: { rows: state.quotes, statuses: ['Draft', 'Sent', 'Accepted', 'Declined'], roles: ['Owner', 'Front Desk'] }, invoice: { rows: state.invoices, statuses: ['Open', 'Sent', 'Paid', 'Void'], roles: ['Owner', 'Front Desk', 'Bookkeeper'] } }
  const definition = definitions[type]; if (!definition || !id || !definition.statuses.includes(status)) throw new Error('Choose a valid operational record and status.')
  requireRole(definition.roles, `${type} status update`)
  const record = definition.rows.find((item) => item.id === id); if (!record) throw new Error('That operational record no longer exists.')
  record.status = status; record.updated_at = now(); persist(); recordAudit(`${type}.status_updated`, `${type} status updated`, { id, status }); return type === 'appointment' ? listAppointments() : type === 'quote' ? listQuotes() : listInvoices()
}
function assignOperationalCustomer(payload = {}) {
  const type = String(payload.type || ''); const id = String(payload.id || ''); const customerId = String(payload.customerId || '')
  const definitions = { appointment: { rows: state.appointments, roles: ['Owner', 'Front Desk', 'Support'] }, quote: { rows: state.quotes, roles: ['Owner', 'Front Desk'] }, invoice: { rows: state.invoices, roles: ['Owner', 'Front Desk', 'Bookkeeper'] } }
  const definition = definitions[type]; if (!definition || !id) throw new Error('Choose a valid operational record.')
  requireRole(definition.roles, `${type} customer assignment`)
  const record = definition.rows.find((item) => item.id === id); if (!record) throw new Error('That operational record no longer exists.')
  if (customerId && !state.customers.some((item) => item.id === customerId)) throw new Error('Choose a customer from this workspace.')
  record.customer_id = customerId; record.updated_at = now(); persist(); recordAudit(`${type}.customer_assigned`, `${type} customer assigned`, { id, customerId: customerId || null })
  return type === 'appointment' ? listAppointments() : type === 'quote' ? listQuotes() : listInvoices()
}

function listUserProfiles() {
  requireSession('user profile viewing')
  return state.userProfiles.map((user) => ({
    id: user.id,
    owner_name: user.owner_name,
    business_name: user.business_name,
    email: user.email,
    role: user.role,
    shared_role: user.shared_role || '',
    workspace_id: user.workspace_id || '',
    shared_sync_status: user.shared_sync_status || (user.firebase_uid ? 'Pending shared sign-in' : 'Local only'),
    shared_synced_at: user.shared_synced_at || '',
    manager_email: user.manager_email || user.email,
    license_number: user.license_number || state.licenses.find((license) => license.user_profile_id === user.id)?.license_number || '',
    subscription_number: user.subscription_number || state.licenses.find((license) => license.user_profile_id === user.id)?.subscription_number || '',
    status: user.status || 'Active',
    email_verified: user.email_verified !== false,
    email_verified_at: user.email_verified_at || '',
    recovery_hint: user.recovery_hint,
    last_sign_in: user.last_sign_in,
    created_at: user.created_at,
    updated_at: user.updated_at,
    profile_completion: profileCompletionFor(user),
  }))
}

function profileCompletionFor(user) {
  const checks = [
    Boolean(user.owner_name),
    Boolean(user.business_name),
    Boolean(user.email),
    user.email_verified !== false,
    Boolean(user.recovery_hint || user.recovery_phrase),
  ]
  const complete = checks.filter(Boolean).length
  return {
    complete,
    total: checks.length,
    percent: Math.round((complete / checks.length) * 100),
    next_step: !user.owner_name || !user.business_name ? 'Complete the identity and business fields.'
      : user.email_verified === false ? 'Verify the profile email.'
        : !(user.recovery_hint || user.recovery_phrase) ? 'Add a recovery phrase.' : 'Profile is ready.',
  }
}

function listLicenses() {
  requireSession('license viewing')
  const licenses = activeSession.role === 'Owner'
    ? state.licenses
    : state.licenses.filter((license) => license.email === activeSession.email)
  return [...licenses].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

function refreshUserLicense(payload = {}) {
  requireRole(['Owner'], 'user license management')
  const email = z.string().trim().email().parse(payload.email)
  const user = state.userProfiles.find((item) => item.email === email)
  if (!user) throw new Error('User profile not found.')
  const license = ensureUserLicense(user)
  license.renewed_at = now()
  license.updated_at = now()
  persist()
  recordAudit('license.user_refreshed', 'User license refreshed', { email, licenseNumber: license.license_number }, activeSession.email)
  return listLicenses()
}

function listEmployeeLicenses() {
  requireRole(['Owner'], 'OverHead employee license viewing')
  return [...state.employeeLicenses].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

function createEmployeeLicense(payload = {}) {
  requireRole(['Owner'], 'OverHead employee license creation')
  const input = employeeLicenseSchema.parse(payload)
  const email = input.email.toLowerCase()
  requireOfficialOverheadTeamEmail(email)
  if (state.employeeLicenses.find((item) => item.email === email)) throw new Error('That employee already has an OverHead employee license.')
  const createdAt = now()
  const license = {
    id: createId('employee-license'),
    employee_number: numberedRecord('EMP'),
    employee_license_number: numberedRecord('TEAM'),
    employee_name: input.employeeName,
    email,
    job_title: input.jobTitle,
    access_level: input.accessLevel,
    status: 'Active',
    authorized_by: activeSession?.email || '',
    authorized_role: activeSession?.role || 'Owner',
    authorization_recorded_at: createdAt,
    issued_at: createdAt,
    expires_at: input.expiresAt,
    updated_at: createdAt,
  }
  state.employeeLicenses.unshift(license)
  persist()
  recordAudit('license.employee_created', 'OverHead employee license issued by authorized administrator', { email, employeeNumber: license.employee_number, licenseNumber: license.employee_license_number, authorizedBy: license.authorized_by, authorizedRole: license.authorized_role }, activeSession.email)
  return listEmployeeLicenses()
}

function updateEmployeeLicense(payload = {}) {
  requireRole(['Owner'], 'OverHead employee license management')
  const input = employeeLicenseUpdateSchema.parse(payload)
  const license = state.employeeLicenses.find((item) => item.id === input.employeeLicenseId)
  if (!license) throw new Error('Employee license not found.')
  license.status = input.status
  license.access_level = input.accessLevel || license.access_level
  license.expires_at = input.expiresAt
  license.updated_at = now()
  persist()
  recordAudit('license.employee_updated', 'OverHead employee license updated', { email: license.email, status: license.status, accessLevel: license.access_level }, activeSession.email)
  return listEmployeeLicenses()
}

function createApprovalRequest(payload = {}) {
  requireRole(['Front Desk', 'Bookkeeper', 'Support', 'Owner'], 'approval request creation')
  const input = approvalRequestSchema.parse(payload)
  const createdAt = now()
  const request = {
    id: createId('approval'),
    action_type: input.actionType,
    title: input.title,
    details: input.details,
    customer_id: input.customerId,
    requested_by: activeSession.email,
    manager_email: managerForActiveSession(),
    status: 'Pending',
    decision_notes: '',
    decided_by: '',
    decided_at: '',
    created_at: createdAt,
    updated_at: createdAt,
  }
  state.approvalRequests.unshift(request)
  persist()
  recordAudit('approval.requested', 'Management approval requested', request, activeSession.email)
  return listApprovalRequests()
}

function decideApprovalRequest(payload = {}) {
  requireRole(['Owner'], 'management approval')
  const input = approvalDecisionSchema.parse(payload)
  const request = state.approvalRequests.find((item) => item.id === input.approvalId)
  if (!request) throw new Error('Approval request not found.')
  if (request.manager_email !== activeSession.email && activeSession.role !== 'Owner') {
    throw new Error('Only the assigned manager can decide this request.')
  }
  request.status = input.decision
  request.decision_notes = input.notes
  request.decided_by = activeSession.email
  request.decided_at = now()
  request.updated_at = now()
  persist()
  recordAudit('approval.decided', 'Management approval decided', { id: request.id, decision: input.decision }, activeSession.email)
  return listApprovalRequests()
}

function listApprovalRequests() {
  requireSession('approval request viewing')
  if (activeSession.role === 'Owner') {
    return [...state.approvalRequests].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  }
  return state.approvalRequests
    .filter((item) => item.requested_by === activeSession.email || item.manager_email === activeSession.email)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

function managerForActiveSession() {
  const user = state.userProfiles.find((item) => item.email === activeSession.email)
  return user?.manager_email || activeSession.email
}

async function updateUserProfile(payload) {
  requireRole(['Owner'], 'user profile management')
  requireFeature('roles')
  const input = userProfileUpdateSchema.parse(payload || {})
  const user = state.userProfiles.find((item) => item.email === input.email)
  if (!user) throw new Error('User profile not found.')
  const activeUser = state.userProfiles.find((item) => item.email === activeSession.email)
  if (user.email === activeSession.email && input.status !== 'Active') throw new Error('You cannot suspend the account currently managing OverHead.')
  if (user.email === activeSession.email && input.role !== 'Owner') throw new Error('You cannot remove your own owner access while signed in.')
  const activeOwners = state.userProfiles.filter((item) => item.role === 'Owner' && item.status === 'Active')
  if (user.role === 'Owner' && user.status === 'Active' && (input.role !== 'Owner' || input.status !== 'Active') && activeOwners.length <= 1) {
    throw new Error('Keep at least one active Owner profile before changing this account.')
  }
  const sharedRole = input.role === 'Owner' ? 'Administrator' : input.role === 'Front Desk' ? 'Manager' : 'Staff'
  let sharedSync = 'Local only'
  if (user.firebase_uid && activeSession.firebaseIdToken) {
    await updateFirestoreDocument(`profiles/${user.firebase_uid}`, {
      owner_name: input.ownerName || user.owner_name,
      business_name: input.businessName || user.business_name,
      role: sharedRole,
      status: input.status,
      updated_at: now(),
    }, activeSession.firebaseIdToken)
    sharedSync = 'Synchronized'
  } else if (user.firebase_uid) {
    sharedSync = 'Pending shared sign-in'
  }
  user.owner_name = input.ownerName || user.owner_name
  user.business_name = input.businessName || user.business_name
  user.role = input.role
  user.status = input.status
  user.shared_role = sharedRole
  user.shared_sync_status = sharedSync
  user.shared_synced_at = sharedSync === 'Synchronized' ? now() : user.shared_synced_at || ''
  user.updated_at = now()
  ensureUserLicense(user)
  persist()
  recordAudit('user.updated', 'User profile updated', { email: input.email, role: input.role, status: input.status, sharedSync, updatedBy: activeUser?.email || activeSession.email })
  return listUserProfiles()
}

function updateToggle(payload = {}) {
  requireRole(['Owner'], 'settings toggle changes')
  const key = String(payload.key || '')
  if (!Object.prototype.hasOwnProperty.call(state.appToggles, key)) throw new Error('Unknown toggle.')
  state.appToggles[key] = Boolean(payload.value)
  persist()
  recordAudit('toggle.updated', 'Application toggle updated', { key, value: state.appToggles[key] })
  return state.appToggles
}

function resetPassword(payload) {
  const input = passwordResetSchema.parse(payload || {})
  const user = state.userProfiles.find((item) => item.email === input.email)
  if (!user) throw new Error('User profile not found.')
  if (!user.recovery_phrase_hash || !bcrypt.compareSync(input.recoveryPhrase, user.recovery_phrase_hash)) {
    recordFraudSignal('password_recovery_failed', 'High', { email: input.email }, input.email)
    throw new Error('Recovery phrase did not match.')
  }
  user.password_hash = bcrypt.hashSync(input.newPassword, 10)
  user.updated_at = now()
  persist()
  recordAudit('auth.password_reset', 'Desktop password reset by recovery phrase', { email: input.email }, input.email)
  return { reset: true }
}

function microsoftScopes(provider) {
  return provider === 'graph'
    ? ['User.Read', 'Contacts.Read', 'offline_access']
    : ['https://api.businesscentral.dynamics.com/user_impersonation', 'offline_access']
}

function microsoftCachePlugin(connection) {
  return {
    beforeCacheAccess: async (context) => {
      if (connection.token_cache) context.tokenCache.deserialize(connection.token_cache)
    },
    afterCacheAccess: async (context) => {
      if (!context.cacheHasChanged) return
      connection.token_cache = context.tokenCache.serialize()
      connection.updated_at = now()
      persist()
    },
  }
}

function microsoftClient(connection) {
  return new PublicClientApplication({
    auth: {
      clientId: connection.client_id,
      authority: `https://login.microsoftonline.com/${connection.tenant_id}`,
    },
    cache: { cachePlugin: microsoftCachePlugin(connection) },
  })
}

function listMicrosoftConnections() {
  requireSession('Microsoft connection viewing')
  return (state.microsoftConnections || []).map(({ token_cache, ...connection }) => ({
    ...connection,
    connected: Boolean(connection.account_home_id && token_cache),
  }))
}

async function connectMicrosoft(payload, onDeviceCode = () => {}) {
  requireRole(['Owner'], 'Microsoft connection setup')
  requireFeature('customers')
  const input = microsoftConnectSchema.parse(payload || {})
  const createdAt = now()
  const existing = state.microsoftConnections.find((item) => item.provider === input.provider && item.client_id === input.clientId && item.tenant_id === input.tenantId)
  const connection = existing || {
    id: createId('ms'),
    provider: input.provider,
    client_id: input.clientId,
    tenant_id: input.tenantId,
    environment: input.environment,
    account_home_id: '',
    account_username: '',
    token_cache: '',
    created_at: createdAt,
    updated_at: createdAt,
  }
  connection.environment = input.environment
  if (!existing) state.microsoftConnections.push(connection)
  const client = microsoftClient(connection)
  try {
    const token = await client.acquireTokenByDeviceCode({
      scopes: microsoftScopes(input.provider),
      deviceCodeCallback: (response) => onDeviceCode({
        provider: input.provider,
        verificationUri: response.verificationUri,
        userCode: response.userCode,
        message: response.message,
        expiresIn: response.expiresIn,
      }),
    })
    connection.account_home_id = token.account?.homeAccountId || ''
    connection.account_username = token.account?.username || ''
    connection.connected_at = now()
    connection.updated_at = now()
    persist()
    recordAudit('microsoft.connected', 'Microsoft connection authorized', { provider: input.provider, account: connection.account_username })
    return { connection: listMicrosoftConnections().find((item) => item.id === connection.id), provider: input.provider }
  } catch (error) {
    if (!existing) state.microsoftConnections = state.microsoftConnections.filter((item) => item.id !== connection.id)
    persist()
    recordAudit('microsoft.connection_failed', 'Microsoft connection was not authorized', { provider: input.provider, reason: String(error.message || error) })
    throw new Error(`Microsoft sign-in was not completed: ${String(error.message || error)}`)
  }
}

async function microsoftAccessToken(connection) {
  const client = microsoftClient(connection)
  const accounts = await client.getTokenCache().getAllAccounts()
  const account = accounts.find((item) => item.homeAccountId === connection.account_home_id) || accounts[0]
  if (!account) throw new Error('Microsoft connection needs attention. Connect it again to continue.')
  try {
    const result = await client.acquireTokenSilent({ account, scopes: microsoftScopes(connection.provider) })
    return result.accessToken
  } catch {
    throw new Error('Microsoft connection needs attention. Reconnect it to refresh access.')
  }
}

async function microsoftGet(url, accessToken) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } })
  const body = await response.text()
  let data = {}
  try { data = body ? JSON.parse(body) : {} } catch { data = { message: body } }
  if (!response.ok) throw new Error(data.error?.message || data.error_description || data.message || `Microsoft returned ${response.status}.`)
  return data
}

function normalizeMicrosoftRecord(provider, record) {
  if (provider === 'graph') {
    const email = record.emailAddresses?.[0]?.address || ''
    const address = record.businessAddress || {}
    return {
      id: record.id,
      businessName: record.companyName || record.displayName || `${record.givenName || ''} ${record.surname || ''}`.trim() || 'Microsoft 365 contact',
      ownerName: record.displayName || '',
      email,
      serviceArea: [address.city, address.state, address.countryOrRegion].filter(Boolean).join(', '),
      sourceLabel: 'Microsoft 365 contact',
    }
  }
  return {
    id: record.id,
    businessName: record.displayName || record.number || 'Business Central customer',
    ownerName: record.contact || '',
    email: record.email || '',
    serviceArea: [record.address, record.city, record.state].filter(Boolean).join(', '),
    sourceLabel: `Business Central customer ${record.number || ''}`.trim(),
  }
}

async function previewMicrosoftImport(payload) {
  requireRole(['Owner'], 'Microsoft import preview')
  clearExpiredMicrosoftPreviews()
  const input = microsoftPreviewSchema.parse(payload || {})
  const connection = state.microsoftConnections.find((item) => item.id === input.connectionId)
  if (!connection) throw new Error('Microsoft connection not found.')
  const token = await microsoftAccessToken(connection)
  let records = []
  let companies = []
  if (connection.provider === 'graph') {
    const data = await microsoftGet('https://graph.microsoft.com/v1.0/me/contacts?$top=50&$select=id,displayName,givenName,surname,companyName,emailAddresses,businessAddress', token)
    records = (data.value || []).map((item) => normalizeMicrosoftRecord('graph', item))
  } else {
    const base = `https://api.businesscentral.dynamics.com/v2.0/${encodeURIComponent(connection.environment)}/api/v2.0`
    const companyData = await microsoftGet(`${base}/companies?$top=100`, token)
    companies = (companyData.value || []).map((item) => ({ id: item.id, name: item.name }))
    if (input.companyId) {
      const data = await microsoftGet(`${base}/companies(${encodeURIComponent(input.companyId)})/customers?$top=50`, token)
      records = (data.value || []).map((item) => normalizeMicrosoftRecord('business_central', item))
    }
  }
  const previewId = createId('ms_preview')
  microsoftImportPreviews.set(previewId, { id: previewId, connection_id: connection.id, provider: connection.provider, company_id: input.companyId, records, created_by: activeSession.email, created_at: now() })
  return { previewId, provider: connection.provider, records, companies, companyRequired: connection.provider === 'business_central' && !input.companyId }
}

function importMicrosoftPreview(payload) {
  requireRole(['Owner'], 'Microsoft customer import')
  requireFeature('customers')
  clearExpiredMicrosoftPreviews()
  const input = microsoftImportSchema.parse(payload || {})
  const preview = microsoftImportPreviews.get(input.previewId)
  if (!preview || preview.created_by !== activeSession.email) throw new Error('That import preview expired. Preview the Microsoft records again.')
  const selected = preview.records.filter((item) => input.selectedIds.includes(item.id))
  let imported = 0
  let skipped = 0
  const createdAt = now()
  for (const record of selected) {
    const duplicate = state.customers.some((customer) => customer.external_source?.provider === preview.provider && customer.external_source?.connection_id === preview.connection_id && customer.external_source?.id === record.id)
      || Boolean(record.email) && state.customers.some((customer) => customer.email.toLowerCase() === record.email.toLowerCase())
    if (duplicate || state.customers.length >= currentPlan().maxCustomers) { skipped += 1; continue }
    state.customers.push({
      id: createId('cust'),
      business_name: record.businessName,
      owner_name: record.ownerName || 'Owner pending',
      email: record.email || '',
      industry: record.sourceLabel,
      service_area: record.serviceArea || 'Imported from Microsoft',
      preferred_contact: 'Email',
      status: 'Imported - review before outreach',
      external_source: { provider: preview.provider, connection_id: preview.connection_id, id: record.id, imported_at: createdAt },
      created_at: createdAt,
      updated_at: createdAt,
    })
    imported += 1
  }
  microsoftImportPreviews.delete(input.previewId)
  persist()
  recordAudit('microsoft.customers_imported', 'Microsoft customer records imported', { provider: preview.provider, imported, skipped })
  return { imported, skipped, customers: listCustomers() }
}

function listCustomers() {
  requireSession('customer record viewing')
  return state.customers
    .map((customer) => ({
      ...customer,
      ...(state.workflowPreferences.find((item) => item.customer_id === customer.id) || {}),
    }))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

function listTasks() {
  requireSession('task viewing')
  return [...state.adminTasks].sort((a, b) => {
    if (Number(b.protected) !== Number(a.protected)) return Number(b.protected) - Number(a.protected)
    return b.updated_at.localeCompare(a.updated_at)
  })
}

function updateTaskStatus(payload) {
  requireRole(['Owner', 'Front Desk', 'Bookkeeper', 'Support'], 'task updates')
  requireFeature('tasks')
  const input = taskStatusSchema.parse(payload || {})
  const task = state.adminTasks.find((item) => item.id === input.taskId)
  if (!task) throw new Error('Task not found.')
  task.status = input.status
  task.updated_at = now()
  persist()
  recordAudit('task.updated', 'Task status updated', input)
  return listTasks()
}

function queueWorkflowJob(payload) {
  requireRole(['Owner', 'Front Desk', 'Support'], 'workflow queue changes')
  requireFeature('workflow_jobs')
  const input = jobSchema.parse(payload || {})
  const createdAt = now()
  const job = {
    id: createId('job'),
    type: input.type,
    title: input.title,
    payload: input.payload,
    status: 'Queued',
    attempts: 0,
    run_at: input.runAt || createdAt,
    last_error: '',
    created_at: createdAt,
    updated_at: createdAt,
  }
  state.workflowJobs.unshift(job)
  persist()
  recordAudit('workflow.job_queued', 'Workflow job queued', { id: job.id, type: job.type, title: job.title })
  return listWorkflowJobs()
}

function processDueJobs() {
  requireSession('workflow job processing')
  const due = state.workflowJobs.filter((job) => job.status === 'Queued' && job.run_at <= now()).slice(0, 10)
  due.forEach((job) => {
    job.attempts += 1
    job.status = 'Complete'
    job.updated_at = now()
    if (job.type === 'office.reminder' || job.type === 'owner.digest' || job.type.startsWith('workflow.')) {
      state.adminTasks.unshift({ id: createId('task'), title: job.title, area: job.type === 'owner.digest' ? 'Owner Digest' : 'Automation', status: 'Open', priority: 'Normal', due_at: now(), protected: 0, created_at: now(), updated_at: now(), workflow_job_id: job.id })
    }
    recordAudit('workflow.job_completed', 'Workflow job completed', { id: job.id, type: job.type })
  })
  if (due.length) persist()
  return listWorkflowJobs()
}

function listWorkflowJobs() {
  requireSession('workflow job viewing')
  return [...state.workflowJobs].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

function listFraudSignals() {
  requireSession('fraud signal viewing')
  return [...state.fraudSignals].sort((a, b) => b.created_at.localeCompare(a.created_at))
}

function acknowledgeLegal(payload) {
  requireRole(['Owner'], 'legal acknowledgement')
  requireFeature('legal_acknowledgements')
  const input = legalAckSchema.parse(payload || {})
  const document = state.legalDocuments.find((item) => item.title === input.title)
  if (!document) throw new Error('Legal document not found.')
  const createdAt = now()
  const acknowledgement = {
    id: createId('ack'),
    email: input.email || 'owner@overhead.local',
    title: document.title,
    version: document.version,
    checksum: hashValue(document),
    accepted_at: createdAt,
  }
  state.legalAcknowledgements.unshift(acknowledgement)
  persist()
  recordAudit('legal.acknowledged', 'Legal document acknowledged', acknowledgement, acknowledgement.email)
  return [...state.legalAcknowledgements]
}

function createCustomer(payload) {
  requireRole(['Owner', 'Front Desk', 'Support'], 'customer creation')
  requireFeature('customers')
  enforceCustomerLimit()
  const input = customerSchema.parse(payload || {})
  const createdAt = now()
  const customer = {
    id: createId('cust'),
    business_name: input.businessName,
    owner_name: input.ownerName || 'Owner pending',
    email: input.email || 'customer@overhead.local',
    industry: input.industry,
    service_area: input.serviceArea,
    preferred_contact: input.preferredContact,
    status: 'Active setup',
    created_at: createdAt,
    updated_at: createdAt,
  }
  state.customers.push(customer)
  state.savedFormMemory.customer = {
    industry: input.industry,
    serviceArea: input.serviceArea,
    preferredContact: input.preferredContact,
  }
  state.workflowPreferences.push({
    customer_id: customer.id,
    booking_rules: 'Capture request details before booking.',
    answer_tone: 'Direct, polite, short.',
    quote_rules: 'Owner review required before sending.',
    invoice_rules: 'Send after completion and remind at day 3.',
    followup_rules: 'Send review request after paid invoice.',
    human_review_required: 1,
  })
  state.adminTasks.push({
    id: createId('task'),
    customer_id: customer.id,
    title: `Configure ${customer.business_name} workflow rules`,
    area: 'Customers',
    status: 'Open',
    priority: 'High',
    due_at: createdAt,
    protected: 1,
    created_at: createdAt,
    updated_at: createdAt,
  })
  persist()
  recordAudit('customer.created', 'Customer created', { id: customer.id, businessName: customer.business_name })
  return { customers: listCustomers(), tasks: listTasks() }
}

function addPlaybookTask(customer, title, priority = 'High', protectedTask = 1) {
  const existing = state.adminTasks.find((task) => task.customer_id === customer.id && task.title === title && task.status !== 'Complete')
  if (existing) return existing
  const createdAt = now()
  const task = {
    id: createId('task'),
    customer_id: customer.id,
    title,
    area: 'Owner Control',
    status: 'Open',
    priority,
    due_at: createdAt,
    protected: protectedTask,
    created_at: createdAt,
    updated_at: createdAt,
  }
  state.adminTasks.unshift(task)
  return task
}

function applyCustomerPlaybook(payload = {}) {
  requireRole(['Owner', 'Front Desk', 'Support'], 'customer playbook setup')
  const input = customerPlaybookSchema.parse(payload)
  const customer = state.customers.find((item) => item.id === input.customerId)
  if (!customer) throw new Error('Customer record not found.')
  const template = customerPlaybookTemplates[input.template]
  let preferences = state.workflowPreferences.find((item) => item.customer_id === customer.id)
  if (!preferences) {
    preferences = { customer_id: customer.id }
    state.workflowPreferences.push(preferences)
  }
  Object.assign(preferences, {
    booking_rules: template.bookingRules,
    answer_tone: template.answerTone,
    quote_rules: template.quoteRules,
    invoice_rules: template.invoiceRules,
    followup_rules: template.followupRules,
    human_review_required: 1,
    playbook_key: input.template,
    playbook_name: template.name,
    playbook_applied_at: now(),
  })
  template.tasks.forEach((title) => addPlaybookTask(customer, `${customer.business_name}: ${title}`))
  customer.status = 'Playbook active'
  customer.updated_at = now()
  persist()
  recordAudit('playbook.applied', 'Customer operating playbook applied', { customerId: customer.id, customer: customer.business_name, playbook: template.name }, activeSession.email)
  return { customers: listCustomers(), tasks: listTasks() }
}

function buildGuidedLaunchPlan() {
  requireRole(['Owner'], 'guided first-day setup')
  const tasks = [
    ['Add your first customer record', 'Customers', 'High'],
    ['Apply an Intake Control playbook to the first customer', 'Workflows', 'High'],
    ['Review owner approval rules before staff begin work', 'Owner Control', 'High'],
    ['Create a local backup before adding live customer records', 'Security', 'Normal'],
  ]
  const createdAt = now()
  let added = 0
  tasks.forEach(([title, area, priority]) => {
    const existing = state.adminTasks.find((task) => task.title === title && task.status !== 'Complete')
    if (existing) return
    state.adminTasks.unshift({
      id: createId('task'), customer_id: null, title, area, status: 'Open', priority,
      due_at: createdAt, protected: 1, created_at: createdAt, updated_at: createdAt,
    })
    added += 1
  })
  state.guidedLaunchRuns.unshift({ id: createId('guided-launch'), created_at: createdAt, created_by: activeSession.email, tasks_added: added })
  persist()
  recordAudit('guided_launch.created', 'First-day setup plan prepared', { tasksAdded: added }, activeSession.email)
  return { tasks: listTasks(), tasksAdded: added }
}

function listAuditEvents(limit = 25) {
  requireSession('audit viewing')
  return state.auditEvents.slice(0, Number(limit) || 25)
}

function updateSetting({ key, value }) {
  requireRole(['Owner'], 'settings changes')
  if (!key || typeof key !== 'string') throw new Error('Setting key is required.')
  state.settings[key] = {
    value,
    checksum: hashValue({ key, value }),
    updated_at: now(),
  }
  persist()
  recordAudit('settings.updated', 'Setting updated', { key })
  return state.settings
}

function createBackup() {
  requireRole(['Owner', 'Bookkeeper'], 'backup creation')
  requireFeature('backups')
  const backupDir = path.join(dataRoot, 'backups')
  fs.mkdirSync(backupDir, { recursive: true })
  const backupPath = path.join(backupDir, `overhead-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.secure`)
  fs.copyFileSync(dbPath, backupPath)
  recordAudit('backup.created', 'Local database backup created', { backupPath })
  return { backupPath, createdAt: now() }
}

function createDataExport() {
  requireRole(['Owner', 'Bookkeeper'], 'data export')
  requireFeature('data_export')
  recordFraudSignal('sensitive_data_export', 'Medium', { exportType: 'full' })
  const exportDir = path.join(dataRoot, 'exports')
  fs.mkdirSync(exportDir, { recursive: true })
  const exportPath = path.join(exportDir, `overhead-export-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`)
  const zip = new AdmZip()
  const publicState = {
    schema: state.schema,
    exportedAt: now(),
    customers: listCustomers(),
    tasks: listTasks(),
    legalDocuments: state.legalDocuments,
    legalAcknowledgements: state.legalAcknowledgements,
    workflowJobs: listWorkflowJobs(),
    supportTickets: state.supportTickets,
    auditEvents: listAuditEvents(500),
    settings: state.settings,
  }
  zip.addFile('overhead-export.json', Buffer.from(JSON.stringify(publicState, null, 2)))
  zip.addFile('README.txt', Buffer.from('OverHead local export. Keep this file private because it may contain customer and workflow information.'))
  zip.writeZip(exportPath)
  recordAudit('data.exported', 'Data export created', { exportPath })
  return { exportPath, createdAt: now() }
}

function saveStripeConnection(payload) {
  requireRole(['Owner'], 'Stripe connection setup')
  requireFeature('stripe')
  const input = stripeConfigSchema.parse(payload || {})
  const existing = state.stripeConnections.find((item) => item.mode === input.mode)
  const connection = {
    id: existing?.id || createId('stripe'),
    mode: input.mode,
    client_id_hint: input.clientId ? `${input.clientId.slice(0, 12)}...` : '',
    account_id: input.accountId,
    publishable_key_hint: input.publishableKey ? `${input.publishableKey.slice(0, 12)}...` : '',
    status: input.accountId ? 'Test account noted' : 'Waiting for test account',
    updated_at: now(),
  }
  if (existing) Object.assign(existing, connection)
  else state.stripeConnections.unshift(connection)
  persist()
  recordAudit('stripe.local_prepared', 'Stripe test setup prepared without local payment secrets', { mode: input.mode, accountId: input.accountId, clientIdConfigured: Boolean(input.clientId) })
  return listStripeConnections()
}

function listStripeConnections() {
  requireSession('Stripe connection viewing')
  return [...state.stripeConnections].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

function getStripeAuthorizationUrl() {
  requireRole(['Owner'], 'Stripe setup')
  const url = 'https://dashboard.stripe.com/test/apikeys'
  recordAudit('stripe.test_dashboard_opened', 'Stripe test dashboard opened; live checkout and webhooks remain server-side work', {})
  return { url, clientIdConfigured: false, mode: 'test', message: 'Stripe test preparation is browser-only until the server webhook is deployed.' }
}

function importStripeSnapshot(payload = {}) {
  requireRole(['Owner', 'Bookkeeper'], 'Stripe import')
  requireFeature('stripe')
  const input = stripeImportSchema.parse(payload)
  const snapshot = {
    id: createId('stripe_import'),
    account_id: input.accountId,
    business_name: input.businessName,
    manager_email: input.managerEmail || activeSession.email,
    purchased_tier: input.purchasedTier,
    payment_status: input.paymentStatus,
    external_customer_id: input.externalCustomerId,
    external_subscription_id: input.externalSubscriptionId,
    customer_count: input.customerCount,
    subscription_count: input.subscriptionCount,
    invoice_count: input.invoiceCount,
    payment_count: input.paymentCount,
    imported_at: now(),
  }
  state.stripeImports.unshift(snapshot)
  persist()
  recordAudit('stripe.imported', 'Stripe data summary imported', snapshot)
  return listStripeImports()
}

function listStripeImports() {
  requireSession('Stripe import viewing')
  return [...state.stripeImports].sort((a, b) => b.imported_at.localeCompare(a.imported_at))
}

function applyPaymentRecord(payload = {}) {
  requireRole(['Owner', 'Bookkeeper'], 'payment record processing')
  const input = paymentRecordSchema.parse(payload)
  const record = {
    id: createId('payrecord'),
    provider: input.provider,
    manager_email: input.managerEmail || activeSession.email,
    tier: input.tier,
    payment_status: input.paymentStatus,
    external_customer_id: input.externalCustomerId,
    external_subscription_id: input.externalSubscriptionId,
    amount: input.amount,
    currency: input.currency,
    processed_at: now(),
  }
  state.paymentRecords.unshift(record)
  if (['paid', 'trial'].includes(input.paymentStatus)) {
    applySubscription({
      managerEmail: record.manager_email,
      tier: input.tier,
      paymentProvider: input.provider === 'stripe' ? 'stripe' : 'manual',
      paymentStatus: input.paymentStatus,
      externalCustomerId: input.externalCustomerId,
      externalSubscriptionId: input.externalSubscriptionId,
    }, { skipRoleCheck: true })
  }
  persist()
  recordAudit('payment.processed', 'Payment record processed and access updated', record)
  return { paymentRecords: listPaymentRecords(), entitlements: getEntitlementState() }
}

function listPaymentRecords() {
  requireSession('payment record viewing')
  return [...state.paymentRecords].sort((a, b) => b.processed_at.localeCompare(a.processed_at))
}

function getSquareAuthorizationUrl() {
  requireRole(['Owner'], 'Square setup')
  const applicationId = process.env.OVERHEAD_SQUARE_APPLICATION_ID || state.settings.squareApplicationId?.value || ''
  const redirectUri = process.env.OVERHEAD_SQUARE_REDIRECT_URI || state.settings.squareRedirectUri?.value || 'https://developer.squareup.com/apps'
  const scopes = [
    'MERCHANT_PROFILE_READ',
    'PAYMENTS_READ',
    'CUSTOMERS_READ',
    'ITEMS_READ',
    'ORDERS_READ',
  ]
  const url = new URL('https://connect.squareup.com/oauth2/authorize')
  if (applicationId) url.searchParams.set('client_id', applicationId)
  url.searchParams.set('scope', scopes.join(' '))
  url.searchParams.set('session', 'false')
  url.searchParams.set('state', crypto.randomUUID())
  url.searchParams.set('redirect_uri', redirectUri)
  recordAudit('square.oauth_opened', 'Square browser verification started', { scopes })
  return { url: url.toString(), scopes, redirectUri, applicationIdConfigured: Boolean(applicationId) }
}

function saveSquareConnection(payload = {}) {
  requireRole(['Owner'], 'Square setup')
  requireFeature('stripe')
  const input = squareConfigSchema.parse(payload)
  const existing = state.squareConnections.find((item) => item.environment === input.environment)
  const connection = {
    id: existing?.id || createId('square'),
    environment: input.environment,
    application_id_hint: input.applicationId ? `${input.applicationId.slice(0, 10)}...` : '',
    merchant_id: input.merchantId,
    location_id: input.locationId,
    access_token_hash: input.accessToken ? hashValue(input.accessToken) : '',
    refresh_token_hash: input.refreshToken ? hashValue(input.refreshToken) : '',
    status: input.accessToken ? 'Connected' : 'Needs browser verification',
    updated_at: now(),
  }
  if (existing) Object.assign(existing, connection)
  else state.squareConnections.unshift(connection)
  persist()
  recordAudit('square.connected', 'Square connection saved', { merchantId: input.merchantId, environment: input.environment })
  return listSquareConnections()
}

function listSquareConnections() {
  requireSession('Square connection viewing')
  return [...state.squareConnections].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

function importSquareSnapshot(payload = {}) {
  requireRole(['Owner', 'Bookkeeper'], 'Square import')
  requireFeature('stripe')
  const input = squareImportSchema.parse(payload)
  const importedAt = now()
  const snapshot = {
    id: createId('square_import'),
    business_name: input.businessName,
    merchant_id: input.merchantId,
    location_name: input.locationName,
    location_id: input.locationId,
    customer_count: input.customerCount,
    catalog_item_count: input.catalogItemCount,
    order_count: input.orderCount,
    payment_count: input.paymentCount,
    imported_at: importedAt,
  }
  state.squareImports.unshift(snapshot)
  if (input.businessName) {
    state.savedFormMemory.customer = {
      ...state.savedFormMemory.customer,
      businessName: input.businessName,
      serviceArea: input.locationName || state.savedFormMemory.customer.serviceArea || '',
      preferredContact: 'Square',
    }
  }
  persist()
  recordAudit('square.imported', 'Square data summary imported', snapshot)
  return listSquareImports()
}

function listSquareImports() {
  requireSession('Square import viewing')
  return [...state.squareImports].sort((a, b) => b.imported_at.localeCompare(a.imported_at))
}

function applySubscription(payload, options = {}) {
  if (!options.skipRoleCheck) requireRole(['Owner'], 'subscription management')
  const input = subscriptionSchema.parse(payload || {})
  if (input.tier === 'cylinder' && !isCylinderDeployment()) throw new Error('Cylinder is available only in the OverHead Cylinder Windows Server application.')
  const createdAt = now()
  const managerEmail = input.managerEmail || activeSession?.email || 'owner@overhead.local'
  const existing = state.subscriptions.find((item) => item.manager_email === managerEmail)
  const subscription = {
    id: existing?.id || createId('sub'),
    subscription_number: existing?.subscription_number || numberedRecord('SUB'),
    manager_email: managerEmail,
    tier: isCylinderDeployment() ? 'cylinder' : input.tier,
    payment_provider: input.paymentProvider,
    payment_status: input.paymentStatus,
    external_customer_id: input.externalCustomerId,
    external_subscription_id: input.externalSubscriptionId,
    trial_ends_at: input.trialEndsAt,
    activated_at: existing?.activated_at || createdAt,
    updated_at: createdAt,
  }
  if (existing) Object.assign(existing, subscription)
  else state.subscriptions.unshift(subscription)
  syncEntitlements(subscription)
  syncUserLicenses(managerEmail)
  persist()
  recordAudit('subscription.applied', 'Plan entitlement applied', {
    managerEmail,
    tier: subscription.tier,
    paymentStatus: input.paymentStatus,
  }, managerEmail)
  if (!activeSession) {
    const plan = planDefinitions[subscription.tier] || planDefinitions.silver
    return {
    activeTier: subscription.tier,
      activePlan: plan,
      subscription,
      allSubscriptions: [...state.subscriptions],
      usage: {
        users: state.userProfiles.length,
        managers: state.managerProfiles.length,
        customers: state.customers.length,
      },
    }
  }
  return getEntitlementState()
}

function syncEntitlements(subscription) {
  const plan = planDefinitions[subscription.tier] || planDefinitions.silver
  const existing = state.entitlements.find((item) => item.manager_email === subscription.manager_email)
  const entitlement = {
    id: existing?.id || createId('entitlement'),
    manager_email: subscription.manager_email,
    tier: subscription.tier,
    plan_name: plan.name,
    level: plan.level,
    max_users: plan.maxUsers,
    max_customers: plan.maxCustomers,
    features: plan.features,
    active: ['paid', 'trial'].includes(subscription.payment_status),
    updated_at: now(),
  }
  if (existing) Object.assign(existing, entitlement)
  else state.entitlements.unshift(entitlement)
}

function getEntitlementState() {
  requireSession('entitlement viewing')
  const subscription = currentSubscription()
  const plan = currentPlan()
  return {
    activeTier: subscription?.tier || 'silver',
    activePlan: plan,
    subscription,
    allSubscriptions: [...state.subscriptions],
    usage: {
      users: state.userProfiles.length,
      managers: state.managerProfiles.length,
      customers: state.customers.length,
    },
  }
}

function saveBillingProfile(payload = {}) {
  requireRole(['Owner'], 'billing profile management')
  const input = billingProfileSchema.parse(payload)
  if (!input.consentToRecurringBilling) throw new Error('Recurring billing consent is required for subscription plans.')
  if (!input.cancellationPathAcknowledged) throw new Error('Cancellation path acknowledgement is required.')
  if (!input.billingPolicyAcknowledged) throw new Error('Acknowledgement of the Subscription Billing & Authorization Policy is required.')
  const managerEmail = input.managerEmail || activeSession?.email || 'owner@overhead.local'
  const existing = state.billingProfiles.find((item) => item.manager_email === managerEmail)
  const profile = {
    id: existing?.id || createId('billing'),
    manager_email: managerEmail,
    legal_name: input.legalName,
    billing_email: input.billingEmail,
    phone: input.phone,
    address: {
      line1: input.addressLine1,
      line2: input.addressLine2,
      city: input.city,
      region: input.region,
      postal_code: input.postalCode,
      country: input.country,
    },
    tax_id_type: input.taxIdType,
    tax_id_last4: input.taxIdLast4,
    invoice_terms: input.invoiceTerms,
    invoice_footer: input.invoiceFooter,
    consent_to_recurring_billing: input.consentToRecurringBilling,
    cancellation_path_acknowledged: input.cancellationPathAcknowledged,
    billing_policy_acknowledged: input.billingPolicyAcknowledged,
    updated_at: now(),
  }
  state.savedFormMemory.billing = {
    legalName: input.legalName,
    billingEmail: input.billingEmail,
    phone: input.phone,
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2,
    city: input.city,
    region: input.region,
    postalCode: input.postalCode,
    country: input.country,
    taxIdType: input.taxIdType,
    invoiceTerms: input.invoiceTerms,
    invoiceFooter: input.invoiceFooter,
  }
  if (existing) Object.assign(existing, profile)
  else state.billingProfiles.unshift(profile)
  persist()
  recordAudit('billing.profile_saved', 'Billing profile saved', {
    managerEmail,
    legalName: input.legalName,
    billingEmail: input.billingEmail,
    taxIdType: input.taxIdType,
  }, managerEmail)
  return listBillingProfiles()
}

function listBillingProfiles() {
  requireSession('billing profile viewing')
  return [...state.billingProfiles].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

async function createSupportTicket(payload = {}) {
  requireRole(['Owner', 'Front Desk', 'Support', 'Customer'], 'support ticket creation')
  const createdAt = now()
  const ticket = {
    id: createId('support'),
    customer_id: payload.customerId || null,
    subject: String(payload.subject || 'Support request').trim(),
    priority: String(payload.priority || 'Normal').trim(),
    status: 'Open',
    details: String(payload.details || '').trim(),
    created_at: createdAt,
    updated_at: createdAt,
  }
  state.supportTickets.unshift(ticket)
  persist()
  if (activeSession?.firebaseIdToken && activeSession?.firebaseUid) {
    const workspaceId = state.userProfiles.find((item) => item.email === activeSession.email)?.workspace_id
    if (workspaceId) {
      await writeFirestoreDocument(`workspaces/${workspaceId}/support_tickets/${ticket.id}`, {
        workspace_id: workspaceId, created_by: activeSession.firebaseUid, customer_id: ticket.customer_id || '', subject: ticket.subject, priority: ticket.priority, status: ticket.status, details: ticket.details, created_at: ticket.created_at, updated_at: ticket.updated_at,
      }, activeSession.firebaseIdToken)
    }
  }
  recordAudit('support.ticket_created', 'Support ticket created', { id: ticket.id, subject: ticket.subject })
  return [...state.supportTickets]
}

async function listSharedSupportTickets() {
  requireSession('shared support ticket viewing')
  if (!activeSession?.firebaseIdToken) return []
  const workspaceId = state.userProfiles.find((item) => item.email === activeSession.email)?.workspace_id
  if (!workspaceId) return []
  return listFirestoreDocuments(`workspaces/${workspaceId}/support_tickets`, activeSession.firebaseIdToken)
}

function buildOfficeChecklist() {
  requireSession('office checklist viewing')
  const health = getHealth()
  const checklist = [
    { id: 'profile', label: 'Owner profile created', status: state.userProfiles.length ? 'Done' : 'Open' },
    { id: 'plan', label: 'Plan entitlement active', status: currentSubscription() ? 'Done' : 'Open' },
    { id: 'customers', label: 'First customer record added', status: state.customers.length ? 'Done' : 'Open' },
    { id: 'backup', label: 'Backup available', status: health.backupCount ? 'Done' : 'Open' },
    { id: 'legal', label: 'Terms acknowledged', status: state.legalAcknowledgements.length ? 'Done' : 'Open' },
    { id: 'risk', label: 'Fraud/risk queue reviewed', status: health.openFraudSignalCount ? 'Review' : 'Done' },
    { id: 'stripe', label: 'Stripe setup checked', status: health.stripeConnectionCount ? 'Done' : 'Optional' },
  ]
  return checklist
}

function createQuickNote(payload = {}) {
  requireRole(['Owner', 'Front Desk', 'Support'], 'quick note creation')
  const title = String(payload.title || 'Quick note').trim()
  const details = String(payload.details || '').trim()
  const createdAt = now()
  const task = {
    id: createId('task'),
    customer_id: payload.customerId || null,
    title,
    area: 'Notes',
    status: 'Open',
    priority: 'Normal',
    due_at: createdAt,
    protected: 0,
    created_at: createdAt,
    updated_at: createdAt,
  }
  state.adminTasks.unshift(task)
  persist()
  recordAudit('note.created', 'Quick note created', { id: task.id, title, details })
  return listTasks()
}

async function createFillablePdf(payload = {}) {
  requireRole(['Owner', 'Front Desk', 'Support'], 'fillable PDF generation')
  const input = pdfRequestSchema.parse(payload)
  const customer = state.customers.find((item) => item.id === input.customerId) || state.customers[0]
  const outputDir = path.join(dataRoot, 'pdfs')
  fs.mkdirSync(outputDir, { recursive: true })
  const pdfPath = path.join(outputDir, `overhead-${input.packetType}-${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`)

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([612, 792])
  const form = pdfDoc.getForm()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  page.drawText('OverHead Customer Intake Packet', { x: 48, y: 735, size: 20, font: bold, color: rgb(0.06, 0.09, 0.13) })
  page.drawText('Fill, review, and attach this packet to the customer record.', { x: 48, y: 708, size: 10, font, color: rgb(0.32, 0.4, 0.42) })

  const fields = [
    ['Business Name', customer?.business_name || '', 660],
    ['Owner Name', customer?.owner_name || '', 610],
    ['Email', customer?.email || '', 560],
    ['Industry', customer?.industry || '', 510],
    ['Service Area', customer?.service_area || '', 460],
    ['Requested Work', '', 410],
    ['Quote Notes', '', 340],
    ['Approval Notes', '', 270],
  ]

  fields.forEach(([label, value, y]) => {
    page.drawText(label, { x: 48, y: y + 24, size: 10, font: bold, color: rgb(0.06, 0.09, 0.13) })
    const field = form.createTextField(label.toLowerCase().replace(/\s+/g, '_'))
    field.setText(value)
    field.addToPage(page, { x: 48, y, width: 516, height: label.includes('Notes') || label.includes('Work') ? 54 : 30 })
  })

  const reviewed = form.createCheckBox('owner_review_required')
  reviewed.addToPage(page, { x: 48, y: 218, width: 14, height: 14 })
  page.drawText('Owner review required before sending to customer', { x: 70, y: 219, size: 10, font })

  const saved = await pdfDoc.save()
  fs.writeFileSync(pdfPath, saved)
  recordAudit('pdf.created', 'Fillable PDF created', { pdfPath, packetType: input.packetType, customerId: customer?.id || '' })
  return { pdfPath, createdAt: now() }
}

async function createSubscriptionReceipt() {
  requireRole(['Owner', 'Bookkeeper'], 'subscription receipt generation')
  const subscription = currentSubscription()
  if (!subscription) throw new Error('There is no active plan record to summarize yet.')
  const plan = currentPlan()
  const billing = state.billingProfiles.find((item) => item.manager_email === subscription.manager_email) || {}
  const licenses = state.licenses.filter((item) => item.manager_email === subscription.manager_email)
  const outputDir = path.join(dataRoot, 'pdfs')
  fs.mkdirSync(outputDir, { recursive: true })
  const pdfPath = path.join(outputDir, `overhead-subscription-receipt-${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`)
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([612, 792])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const ink = rgb(0.06, 0.09, 0.13)
  const muted = rgb(0.32, 0.4, 0.42)
  let y = 742
  const row = (label, value) => {
    page.drawText(label, { x: 48, y, size: 9, font: bold, color: ink })
    page.drawText(String(value || 'Not available').slice(0, 82), { x: 205, y, size: 9, font, color: ink })
    page.drawLine({ start: { x: 48, y: y - 7 }, end: { x: 564, y: y - 7 }, thickness: 0.4, color: rgb(0.82, 0.85, 0.88) })
    y -= 24
  }
  page.drawText('OverHead Subscription Receipt & Account Summary', { x: 48, y, size: 18, font: bold, color: ink })
  y -= 20
  page.drawText('Letter-size account record generated by OverHead. Keep with your business records.', { x: 48, y, size: 9, font, color: muted })
  y -= 34
  row('Receipt generated', now())
  row('Business', billing.legal_name || activeSession.email)
  row('Billing email', billing.billing_email || subscription.manager_email)
  row('Plan', `${plan.name} — ${plan.level}`)
  row('Subscription number', subscription.subscription_number)
  row('Payment status', subscription.payment_status)
  row('Payment provider', subscription.payment_provider || 'Stripe')
  row('Stripe customer reference', subscription.external_customer_id || 'Pending Stripe confirmation')
  row('Stripe subscription reference', subscription.external_subscription_id || 'Pending Stripe confirmation')
  row('Plan includes', plan.features.join(', '))
  y -= 4
  page.drawText('Assigned workspace licenses', { x: 48, y, size: 11, font: bold, color: ink })
  y -= 19
  if (!licenses.length) page.drawText('License records will appear after the next entitlement refresh.', { x: 48, y, size: 9, font, color: muted })
  licenses.slice(0, 7).forEach((license) => {
    page.drawText(`${license.holder_name || license.email} — ${license.tier} — ${license.status}`, { x: 48, y, size: 9, font, color: ink })
    y -= 15
  })
  y -= 10
  page.drawText('Payment note', { x: 48, y, size: 10, font: bold, color: ink })
  y -= 15
  page.drawText('Stripe is the authoritative processor record for card transactions. This OverHead receipt summarizes the plan, access,', { x: 48, y, size: 8, font, color: muted })
  y -= 12
  page.drawText('billing references, and assigned licenses connected to this workspace at the time this document was generated.', { x: 48, y, size: 8, font, color: muted })
  const saved = await pdf.save()
  fs.writeFileSync(pdfPath, saved)
  recordAudit('billing.receipt_created', 'Subscription receipt PDF created', { pdfPath, tier: subscription.tier, subscriptionNumber: subscription.subscription_number })
  return { pdfPath, createdAt: now() }
}

async function createOperationalDocument(payload = {}) {
  const type = String(payload.type || ''); const id = String(payload.id || '')
  const definitions = { quote: { rows: state.quotes, roles: ['Owner', 'Front Desk'], title: 'Quote' }, invoice: { rows: state.invoices, roles: ['Owner', 'Front Desk', 'Bookkeeper'], title: 'Invoice' } }
  const definition = definitions[type]; if (!definition) throw new Error('Choose a quote or invoice document type.')
  requireRole(definition.roles, `${type} document generation`)
  const record = definition.rows.find((item) => item.id === id); if (!record) throw new Error('That record was not found.')
  const customer = state.customers.find((item) => item.id === record.customer_id) || {}
  const outputDir = path.join(dataRoot, 'pdfs'); fs.mkdirSync(outputDir, { recursive: true })
  const pdfPath = path.join(outputDir, `overhead-${type}-${record.id}.pdf`)
  const pdf = await PDFDocument.create(); const page = pdf.addPage([612, 792]); const font = await pdf.embedFont(StandardFonts.Helvetica); const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const ink = rgb(0.06, 0.09, 0.13); let y = 740
  page.drawText(`OverHead ${definition.title}`, { x: 48, y, size: 22, font: bold, color: ink }); y -= 42
  const row = (label, value) => { page.drawText(label, { x: 48, y, size: 10, font: bold, color: ink }); page.drawText(String(value || 'Not provided').slice(0, 76), { x: 205, y, size: 10, font, color: ink }); y -= 28 }
  row('Record number', record.id); row('Status', record.status); row('Customer', customer.business_name || customer.owner_name); row('Customer email', customer.email); row('Title', record.title); row('Amount', `$${Number(record.amount || 0).toFixed(2)}`); row(type === 'invoice' ? 'Due date' : 'Notes', type === 'invoice' ? record.due_date : record.notes)
  page.drawText('Generated locally by OverHead. Review details before sending to a customer.', { x: 48, y: 100, size: 9, font, color: rgb(0.32, 0.4, 0.42) })
  fs.writeFileSync(pdfPath, await pdf.save()); record.document_path = pdfPath; record.updated_at = now(); persist(); recordAudit(`${type}.document_created`, `${type} PDF created`, { id, pdfPath }); return { pdfPath, createdAt: now() }
}

function createDataRequest(payload = {}) {
  requireRole(['Owner', 'Support'], 'data request management')
  const input = dataRequestSchema.parse(payload)
  const request = {
    id: createId('datareq'),
    request_type: input.requestType,
    subject_email: input.subjectEmail || 'owner@overhead.local',
    status: 'Open',
    notes: input.notes,
    created_at: now(),
    updated_at: now(),
  }
  state.dataRequests.unshift(request)
  persist()
  recordAudit('compliance.data_request', 'Data request created', request)
  return listDataRequests()
}

function listDataRequests() {
  requireSession('privacy request viewing')
  return [...state.dataRequests].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

function getComplianceSummary() {
  requireSession('compliance viewing')
  const required = ['Terms of Use', 'Privacy Notice', 'Acceptable Use Policy', 'AI Use Disclosure', 'Data Retention Policy', 'Support Policy', 'Subscription Billing & Authorization Policy', 'Free Trial Policy', 'Cancellation & Prorated Refund Policy', 'Workspace License & Access Policy']
  const acknowledged = new Set(state.legalAcknowledgements.map((ack) => ack.title))
  const missing = required.filter((title) => !acknowledged.has(title))
  return {
    status: missing.length ? 'Needs acknowledgement' : 'Operational',
    requiredDocuments: required,
    missingDocuments: missing,
    legalAcknowledgementCount: state.legalAcknowledgements.length,
    openDataRequests: state.dataRequests.filter((request) => request.status === 'Open').length,
    retentionDays: state.settings.retentionDays?.value || 365,
    exportAllowed: state.appToggles.allowDataExport,
    encryptedAtRest: fs.existsSync(dbPath) && fs.readFileSync(dbPath, 'utf8').startsWith('safeStorage:v1:'),
    aggregate: {
      customers: state.customers.length,
      users: state.userProfiles.length,
      managers: state.managerProfiles.length,
      auditEvents: state.auditEvents.length,
      fraudSignals: state.fraudSignals.length,
      supportTickets: state.supportTickets.length,
    },
  }
}

function validateRestorePackage(filePath) {
  requireRole(['Owner'], 'restore validation')
  requireFeature('restore_validation')
  if (!filePath || typeof filePath !== 'string') throw new Error('Restore file path is required.')
  const resolved = path.resolve(filePath)
  if (!fs.existsSync(resolved)) throw new Error('Restore file not found.')
  const fileText = fs.readFileSync(resolved, 'utf8')
  const parsed = JSON.parse(decryptStore(fileText))
  const valid = parsed.schema === 'overhead-local-store-v2' && Array.isArray(parsed.customers) && Array.isArray(parsed.adminTasks)
  recordAudit('restore.validated', valid ? 'Restore package validated' : 'Restore package rejected', { filePath: resolved, valid })
  return { valid, schema: parsed.schema || 'unknown', filePath: resolved }
}

function createSupportBundle(integrityReport = null) {
  requireRole(['Owner', 'Support'], 'support bundle creation')
  requireFeature('support_bundle')
  const bundleDir = path.join(dataRoot, 'support-bundles')
  fs.mkdirSync(bundleDir, { recursive: true })
  const bundlePath = path.join(bundleDir, `overhead-support-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`)
  const zip = new AdmZip()
  zip.addFile('health.json', Buffer.from(JSON.stringify(getHealth(), null, 2)))
  zip.addFile('audit-events.json', Buffer.from(JSON.stringify(listAuditEvents(100), null, 2)))
  zip.addFile('tasks.json', Buffer.from(JSON.stringify(listTasks(), null, 2)))
  zip.addFile('customers.json', Buffer.from(JSON.stringify(listCustomers(), null, 2)))
  if (integrityReport) zip.addFile('integrity-report.json', Buffer.from(JSON.stringify(integrityReport, null, 2)))
  const supportState = {
    ...state,
    microsoftConnections: state.microsoftConnections.map(({ token_cache: _tokenCache, ...connection }) => connection),
  }
  zip.addFile('overhead-store.json', Buffer.from(JSON.stringify(supportState, null, 2)))
  if (state.appToggles.supportBundleIncludesStore) zip.addLocalFile(dbPath, '', 'overhead-store.secure')
  zip.writeZip(bundlePath)

  const createdAt = now()
  state.supportTickets.unshift({
    id: createId('support'),
    customer_id: null,
    subject: 'Support bundle created',
    priority: 'Normal',
    status: 'Ready',
    details: bundlePath,
    created_at: createdAt,
    updated_at: createdAt,
  })
  persist()
  recordAudit('support.bundle_created', 'Support bundle created', { bundlePath })
  return { bundlePath, createdAt }
}

function persistIntegritySnapshot(report, appVersion = '0.1.0') {
  const status = report?.status === 'clean' ? 'clean' : 'attention'
  const snapshot = {
    id: createId('integrity'),
    snapshot_type: 'runtime',
    app_version: appVersion,
    file_manifest: JSON.stringify(report?.files || []),
    signature_status: status,
    created_at: now(),
  }
  state.integritySnapshots.unshift(snapshot)
  state.integritySnapshots = state.integritySnapshots.slice(0, 100)
  persist()
  if (status !== 'clean') {
    recordAudit('integrity.attention', 'Runtime integrity attention needed', report || {})
  }
  return snapshot
}

function getHealth() {
  if (!activeSession) {
    return {
      status: state ? 'locked' : 'starting',
      dataRoot,
      databaseExists: Boolean(dbPath && fs.existsSync(dbPath)),
      encryptedAtRest: Boolean(dbPath && fs.existsSync(dbPath) && fs.readFileSync(dbPath, 'utf8').startsWith('safeStorage:v1:')),
      locked: true,
      deviceName: os.hostname(),
    }
  }
  return {
    status: 'ready',
    dataRoot,
    databasePath: dbPath,
    databaseExists: fs.existsSync(dbPath),
    encryptedAtRest: fs.existsSync(dbPath) && fs.readFileSync(dbPath, 'utf8').startsWith('safeStorage:v1:'),
    customerCount: state.customers.length,
    taskCount: state.adminTasks.length,
    auditCount: state.auditEvents.length,
    backupCount: fs.existsSync(path.join(dataRoot, 'backups')) ? fs.readdirSync(path.join(dataRoot, 'backups')).length : 0,
    supportBundleCount: fs.existsSync(path.join(dataRoot, 'support-bundles')) ? fs.readdirSync(path.join(dataRoot, 'support-bundles')).length : 0,
    exportCount: fs.existsSync(path.join(dataRoot, 'exports')) ? fs.readdirSync(path.join(dataRoot, 'exports')).length : 0,
    pdfCount: fs.existsSync(path.join(dataRoot, 'pdfs')) ? fs.readdirSync(path.join(dataRoot, 'pdfs')).length : 0,
    queuedJobCount: state.workflowJobs.filter((job) => job.status === 'Queued').length,
    openFraudSignalCount: state.fraudSignals.filter((signal) => signal.status === 'Open').length,
    stripeConnectionCount: state.stripeConnections.length,
    squareConnectionCount: state.squareConnections.length,
    squareImportCount: state.squareImports.length,
    paymentRecordCount: state.paymentRecords.length,
    billingProfileCount: state.billingProfiles.length,
    activeTier: currentSubscription()?.tier || 'silver',
    deploymentMode: isCylinderDeployment() ? 'cylinder' : 'desktop',
    deviceName: os.hostname(),
  }
}

module.exports = {
  acknowledgeLegal,
  createBackup,
  createCustomer,
  createAppointment,
  createQuote,
  createInvoice,
  updateOperationalStatus,
  assignOperationalCustomer,
  connectMicrosoft,
  previewMicrosoftImport,
  importMicrosoftPreview,
  applyCustomerPlaybook,
  buildGuidedLaunchPlan,
  createDataExport,
  attachCustomerDocument,
  createDataRequest,
  createQuickNote,
  createFillablePdf,
  createOperationalDocument,
  createSubscriptionReceipt,
  createApprovalRequest,
  createSupportBundle,
  createSupportTicket,
  createCustomerPortalInvite,
  createEmbeddedCheckout,
  startFreeGoldTrial,
  cancelSubscriptionWithUnusedTimeRefund,
  createStaffAccount,
  createEmployeeLicense,
  decideApprovalRequest,
  getBootstrap,
  getComplianceSummary,
  getRemoteEntitlements,
  getRemoteBillingActivity,
  getEntitlementState,
  getHealth,
  getStoredDocumentPath,
  getRememberedSignIn,
  resumeRememberedSession,
  getStripeAuthorizationUrl,
  getSquareAuthorizationUrl,
  initBackend,
  listAuditEvents,
  listApprovalRequests,
  listBillingProfiles,
  listCustomers,
  listDataRequests,
  listDocuments,
  listFraudSignals,
  listLicenses,
  listMicrosoftConnections,
  listEmployeeLicenses,
  listStripeConnections,
  listStripeImports,
  listSquareConnections,
  listSquareImports,
  listSharedSupportTickets,
  listTasks,
  listUserProfiles,
  listWorkflowJobs,
  lockSession,
  persistIntegritySnapshot,
  processDueJobs,
  queueWorkflowJob,
  recordFraudSignal,
  saveStripeConnection,
  saveSquareConnection,
  saveBillingProfile,
  registerSharedProfile,
  registerCustomerAccess,
  signInSharedProfile,
  importSquareSnapshot,
  importStripeSnapshot,
  applyPaymentRecord,
  listPaymentRecords,
  registerProfile,
  verifyEmail,
  signIn,
  applySubscription,
  buildOfficeChecklist,
  resetPassword,
  updateToggle,
  updateSetting,
  updateTaskStatus,
  updateUserProfile,
  refreshUserLicense,
  updateEmployeeLicense,
  validateRestorePackage,
}
