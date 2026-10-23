const { onRequest } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
const Stripe = require('stripe');
const crypto = require('node:crypto');
const { buildCalendarFeed, hashToken } = require('./calendar-subscription');
const { bookingAcceptanceCheck, isBlockedBetween, normalizeBookingCache } = require('./booking-policy');
const { createUnreadMessageCountService } = require('./unread-message-count');
const { nextHostReliability } = require('./host-reliability');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const getUnreadMessageCount = createUnreadMessageCountService({
  db,
  documentIdField: admin.firestore.FieldPath.documentId()
});
const plugzAdminApp = admin.apps.find((app) => app.name === 'plugz-untd-gear')
  || admin.initializeApp({ projectId: 'plugz-untd-gear' }, 'plugz-untd-gear');
const ALLOWED_ORIGINS = new Set([
  'https://cltch-ntwrk-social.web.app',
  'https://cltch-ntwrk.web.app',
  'https://cltch.network',
  'https://www.cltch.network',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
]);
const PLUGZ_PROJECT_ID = 'plugz-untd-gear';
const PLUGZ_PROVIDER_ID = 'plugz';
const PLUGZ_MEMBERSHIP_MONTHS = 6;
const PLUGZ_TERMS_VERSION = 'plugz-cltch-bridge-2026-07-29';

function getPlaidClient() {
  const clientId = process.env.PLAID_CLIENT_ID || '';
  const secret = process.env.PLAID_SECRET || '';
  const envName = (process.env.PLAID_ENV || 'sandbox').toLowerCase();

  if (!clientId || !secret) {
    throw new Error('Plaid secrets are not configured. Set PLAID_CLIENT_ID and PLAID_SECRET.');
  }

  const envMap = {
    sandbox: PlaidEnvironments.sandbox,
    development: PlaidEnvironments.development,
    production: PlaidEnvironments.production
  };

  const config = new Configuration({
    basePath: envMap[envName] || PlaidEnvironments.sandbox,
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': clientId,
        'PLAID-SECRET': secret
      }
    }
  });

  return new PlaidApi(config);
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (err) {
      return {};
    }
  }
  return {};
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return '';
  }
  return authHeader.slice(7).trim();
}

function setCors(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.has(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
  }
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Firebase-AppCheck');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

function validateOrigin(req) {
  const origin = req.headers.origin || '';
  if (!origin) return;
  if (!ALLOWED_ORIGINS.has(origin)) {
    const err = new Error('Origin not allowed.');
    err.status = 403;
    throw err;
  }
}

async function verifyAppCheckIfPresent(req) {
  const token = req.headers['x-firebase-appcheck'];
  if (!token) return null;
  try {
    return await admin.appCheck().verifyToken(token);
  } catch (error) {
    const err = new Error('Invalid App Check token.');
    err.status = 401;
    throw err;
  }
}

async function requireUid(req) {
  const token = getBearerToken(req);
  if (!token) {
    const err = new Error('Missing auth token.');
    err.status = 401;
    throw err;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded.uid;
  } catch (error) {
    const err = new Error('Invalid auth token.');
    err.status = 401;
    throw err;
  }
}

async function requireRoleAccess(uid, role) {
  const roleSnap = await db.collection('userRoles').doc(uid).get();
  if (roleSnap.exists && roleSnap.data().role === role) return true;
  const profileRef = role === 'host' ? db.collection('hosts').doc(uid) : db.collection('musicians').doc(uid);
  const profileSnap = await profileRef.get();
  if (profileSnap.exists) return true;
  const err = new Error('Role access denied.');
  err.status = 403;
  throw err;
}

function respond(res, status, payload) {
  res.set('Cache-Control', 'no-store');
  res.status(status).json(payload);
}

async function assertNotBlockedBetween(transaction, userA, userB) {
  const [aBlocksB, bBlocksA] = await Promise.all([
    transaction.get(db.collection('userBlocks').doc(userA).collection('blocked').doc(userB)),
    transaction.get(db.collection('userBlocks').doc(userB).collection('blocked').doc(userA))
  ]);
  if (isBlockedBetween(aBlocksB.exists, bBlocksA.exists)) {
    const error = new Error('This booking cannot be accepted because one participant has blocked the other.');
    error.status = 403;
    throw error;
  }
}

function validRole(role) {
  return role === 'host' || role === 'musician';
}

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase().slice(0, 160) : '';
}

function cleanText(value, max = 120) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function addMonths(date, months) {
  const next = new Date(date.getTime());
  const originalDate = next.getDate();
  next.setMonth(next.getMonth() + months);
  if (next.getDate() !== originalDate) {
    next.setDate(0);
  }
  return next;
}

function buildOneId(uid) {
  const cleanUid = cleanText(uid, 128).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return cleanUid ? `CLTCH-${cleanUid.slice(0, 10)}` : '';
}

function dashboardRouteForRole(role) {
  return role === 'host' ? 'host.html' : 'musician-matched-gigs.html';
}

function profileRouteForRole(role) {
  return role === 'host' ? 'host-profile.html' : 'musician-profile.html';
}

function buildPlugzBridgeUid(plugzUid) {
  const safeUid = cleanText(plugzUid, 96).replace(/[^a-zA-Z0-9_-]/g, '');
  return safeUid ? `plugz_${safeUid}`.slice(0, 128) : '';
}

function buildPlugzImportedProfile(plugzUser) {
  return {
    uid: cleanText(plugzUser.uid, 128),
    email: normalizeEmail(plugzUser.email),
    displayName: cleanText(plugzUser.name || plugzUser.displayName || '', 80),
    photoURL: cleanText(plugzUser.picture || plugzUser.photoURL || '', 240),
    provider: cleanText(plugzUser.firebase?.sign_in_provider || '', 60),
    emailVerified: plugzUser.email_verified === true,
    importedAt: admin.firestore.FieldValue.serverTimestamp()
  };
}

async function resolveOrCreateCltchUserFromPlugz(plugzUser) {
  const email = normalizeEmail(plugzUser.email);
  const displayName = cleanText(plugzUser.name || plugzUser.displayName || email.split('@')[0] || 'Plugz Member', 80);

  if (!email) {
    const err = new Error('Plugz account is missing an email address.');
    err.status = 400;
    throw err;
  }

  try {
    return await admin.auth().getUserByEmail(email);
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') {
      throw error;
    }
  }

  const uid = buildPlugzBridgeUid(plugzUser.uid);
  if (!uid) {
    const err = new Error('Plugz account identifier is invalid.');
    err.status = 400;
    throw err;
  }

  try {
    return await admin.auth().createUser({
      uid,
      email,
      emailVerified: plugzUser.email_verified === true,
      displayName
    });
  } catch (error) {
    if (error?.code === 'auth/uid-already-exists') {
      return admin.auth().getUser(uid);
    }
    throw error;
  }
}

async function grantPlugzMembership(uid, email, role, plugzUser, acceptance = {}) {
  const now = new Date();
  const expiresAt = addMonths(now, PLUGZ_MEMBERSHIP_MONTHS);
  const membershipRef = db.collection('memberships').doc(uid);
  const userRef = db.collection('users').doc(uid);
  const roleRef = db.collection('userRoles').doc(uid);
  const plugzUid = cleanText(plugzUser.uid, 128);
  const claimRef = db.collection('plugzBridgeClaims').doc(plugzUid);
  const eventRef = db.collection('plugzBridgeEvents').doc();
  const importedProfile = buildPlugzImportedProfile(plugzUser);
  let nextExpiresAt = expiresAt;

  await db.runTransaction(async (transaction) => {
    const [membershipSnap, claimSnap] = await Promise.all([
      transaction.get(membershipRef),
      transaction.get(claimRef)
    ]);
    const existing = membershipSnap.exists ? membershipSnap.data() || {} : {};
    const existingExpires = existing.expiresAt?.toDate ? existing.expiresAt.toDate() : null;
    nextExpiresAt = existingExpires && existingExpires > expiresAt ? existingExpires : expiresAt;

    if (claimSnap.exists) {
      const claim = claimSnap.data() || {};
      if (claim.cltchUid && claim.cltchUid !== uid) {
        const err = new Error('This Plugz account is already connected to another CLTCH account.');
        err.status = 409;
        throw err;
      }
    }

    const membershipPayload = {
      uid,
      email,
      provider: PLUGZ_PROVIDER_ID,
      source: 'plugz-untd-gear',
      projectId: PLUGZ_PROJECT_ID,
      plan: 'cltch-free-6-months',
      status: 'active',
      trialMonths: PLUGZ_MEMBERSHIP_MONTHS,
      startedAt: existing.startedAt || admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(nextExpiresAt),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      plugzUid,
      plugzEmailVerified: plugzUser.email_verified === true,
      termsAccepted: true,
      termsVersion: PLUGZ_TERMS_VERSION,
      termsAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      termsAcceptedFrom: cleanText(acceptance.source, 40),
      importedProfile
    };

    transaction.set(roleRef, {
      role,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    transaction.set(userRef, {
      uid,
      oneId: buildOneId(uid),
      role,
      email,
      displayName: cleanText(plugzUser.name || plugzUser.displayName || '', 80),
      status: 'active',
      profileComplete: false,
      payoutReady: false,
      authProvider: PLUGZ_PROVIDER_ID,
      profileRoute: profileRouteForRole(role),
      dashboardRoute: dashboardRouteForRole(role),
      membershipPlan: 'cltch-free-6-months',
      membershipSource: 'plugz',
      membershipStatus: 'active',
      membershipExpiresAt: admin.firestore.Timestamp.fromDate(nextExpiresAt),
      plugzUid,
      plugzTermsAccepted: true,
      plugzTermsVersion: PLUGZ_TERMS_VERSION,
      plugzTermsAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      plugzImportedAt: admin.firestore.FieldValue.serverTimestamp(),
      plugzImportedEmail: importedProfile.email,
      plugzImportedDisplayName: importedProfile.displayName,
      plugzImportedPhotoURL: importedProfile.photoURL,
      plugzImportedProvider: importedProfile.provider,
      authLastSignInAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: existing.createdAt || admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    transaction.set(membershipRef, membershipPayload, { merge: true });
    transaction.set(claimRef, {
      plugzUid,
      cltchUid: uid,
      email,
      status: 'claimed',
      source: 'plugz-untd-gear',
      firstClaimedAt: claimSnap.exists ? claimSnap.data().firstClaimedAt : admin.firestore.FieldValue.serverTimestamp(),
      lastClaimedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    transaction.set(eventRef, {
      uid,
      email,
      plugzUid,
      role,
      type: 'plugz_membership_grant',
      status: 'active',
      plan: 'cltch-free-6-months',
      termsAccepted: true,
      termsVersion: PLUGZ_TERMS_VERSION,
      termsAcceptedFrom: cleanText(acceptance.source, 40),
      importedProfile,
      expiresAt: admin.firestore.Timestamp.fromDate(nextExpiresAt),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });

  return {
    plan: 'cltch-free-6-months',
    status: 'active',
    source: 'plugz-untd-gear',
    expiresAt: nextExpiresAt.toISOString()
  };
}

function sanitizeInstitution(name) {
  if (!name || typeof name !== 'string') return '';
  return name.replace(/[^a-zA-Z0-9 .&'\-]/g, '').trim().slice(0, 48);
}

function sanitizeMask(mask) {
  if (!mask || typeof mask !== 'string') return '';
  return mask.replace(/[^0-9]/g, '').slice(-4);
}

function buildDisplayHandle(institution, mask) {
  const safeInstitution = sanitizeInstitution(institution);
  const safeMask = sanitizeMask(mask);
  if (safeInstitution && safeMask) return `Plaid ${safeInstitution} ****${safeMask}`;
  if (safeInstitution) return `Plaid ${safeInstitution}`;
  if (safeMask) return `Plaid ****${safeMask}`;
  return 'Plaid Connected';
}

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY || '';
  if (!secretKey) {
    const err = new Error('Stripe is not configured. Set STRIPE_SECRET_KEY first.');
    err.status = 503;
    throw err;
  }
  return new Stripe(secretKey);
}

function getStripePublishableKey() {
  return process.env.STRIPE_PUBLISHABLE_KEY || '';
}

function stripeConnectedAccountRef(uid, role) {
  return db.collection('stripeAccounts').doc(uid).collection('roles').doc(role);
}

async function getConnectedAccountId(uid, role) {
  const snap = await stripeConnectedAccountRef(uid, role).get();
  if (!snap.exists) {
    const err = new Error('Stripe connected account not found for this role.');
    err.status = 404;
    throw err;
  }
  const accountId = (snap.data() || {}).accountId || '';
  if (!accountId) {
    const err = new Error('Stripe connected account record is incomplete.');
    err.status = 409;
    throw err;
  }
  return accountId;
}

function buildStripeReturnUrl(path) {
  const baseUrl = (process.env.STRIPE_PLATFORM_BASE_URL || 'https://cltch-ntwrk-social.web.app').replace(/\/+$/, '');
  const safePath = String(path || '').replace(/^\/+/, '');
  return `${baseUrl}/${safePath}`;
}

function parseAmountCents(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    const err = new Error('Invalid amount.');
    err.status = 400;
    throw err;
  }
  return Math.round(amount * 100);
}

function requirePositiveAmountCents(value, label) {
  const amountCents = parseAmountCents(value);
  if (amountCents <= 0) {
    const err = new Error(`Invalid ${label}.`);
    err.status = 400;
    throw err;
  }
  return amountCents;
}

async function readDocumentData(collection, id) {
  const snap = await db.collection(collection).doc(id).get();
  return snap.exists ? snap.data() : null;
}

async function readStripeRoleState(uid, role) {
  const snap = await stripeConnectedAccountRef(uid, role).get();
  if (!snap.exists) {
    return {
      connected: false
    };
  }
  const data = snap.data() || {};
  return {
    connected: !!data.accountId,
    accountId: data.accountId || '',
    chargesEnabled: !!data.chargesEnabled,
    payoutsEnabled: !!data.payoutsEnabled,
    detailsSubmitted: !!data.detailsSubmitted,
    updatedAt: data.updatedAt || null
  };
}

async function buildSessionBootstrap(uid, requestedRole) {
  const userSummary = await readDocumentData('users', uid);
  const roleRecord = await readDocumentData('userRoles', uid);
  const resolvedRole = validRole(requestedRole)
    ? requestedRole
    : (validRole(roleRecord?.role) ? roleRecord.role : (validRole(userSummary?.role) ? userSummary.role : 'musician'));
  const [hostProfile, musicianProfile, hostStripe, musicianStripe, plaidItem] = await Promise.all([
    readDocumentData('hosts', uid),
    readDocumentData('musicians', uid),
    readStripeRoleState(uid, 'host'),
    readStripeRoleState(uid, 'musician'),
    readDocumentData('plaidItems', uid)
  ]);

  return {
    uid,
    role: resolvedRole,
    userSummary,
    roleRecord,
    profiles: {
      host: hostProfile,
      musician: musicianProfile,
      active: resolvedRole === 'host' ? hostProfile : musicianProfile
    },
    payments: {
      stripe: {
        ready: !!getStripePublishableKey(),
        host: hostStripe,
        musician: musicianStripe
      },
      plaid: {
        ready: !!(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET),
        connected: !!plaidItem?.itemId,
        institutionName: plaidItem?.institutionName || '',
        accountMask: plaidItem?.accountMask || '',
        displayHandle: plaidItem?.displayHandle || '',
        updatedAt: plaidItem?.updatedAt || null
      }
    }
  };
}

exports.apiHealth = onRequest({ region: 'us-central1' }, async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'GET') {
    respond(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    validateOrigin(req);
    respond(res, 200, {
      ok: true,
      timestamp: new Date().toISOString(),
      services: {
        firestore: true,
        stripe: {
          configured: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY)
        },
        plaid: {
          configured: !!(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET)
        }
      }
    });
  } catch (error) {
    const status = error.status || 500;
    logger.error('apiHealth failed', error);
    respond(res, status, { ok: false, error: error.message || 'Health check failed.' });
  }
});

exports.apiSessionBootstrap = onRequest({ region: 'us-central1' }, async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'GET') {
    respond(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    validateOrigin(req);
    await verifyAppCheckIfPresent(req);
    const uid = await requireUid(req);
    const role = typeof req.query?.role === 'string' ? req.query.role : '';
    const session = await buildSessionBootstrap(uid, role);
    respond(res, 200, {
      ok: true,
      session,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const status = error.status || 500;
    logger.error('apiSessionBootstrap failed', error);
    respond(res, status, { ok: false, error: error.message || 'Unable to load session bootstrap.' });
  }
});

exports.apiCalendarSubscription = onRequest({ region: 'us-central1' }, async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { respond(res, 405, { error: 'Method not allowed.' }); return; }
  try {
    validateOrigin(req);
    await verifyAppCheckIfPresent(req);
    const token = getBearerToken(req);
    if (!token) { respond(res, 401, { error: 'Sign in to manage your calendar subscription.' }); return; }
    const decoded = await admin.auth().verifyIdToken(token);
    if (decoded.email_verified !== true) { respond(res, 403, { error: 'Verify your email before managing a calendar subscription.' }); return; }
    const uid = decoded.uid;
    const profile = await db.collection('musicians').doc(uid).get();
    if (!profile.exists) { respond(res, 403, { error: 'A performer profile is required.' }); return; }
    const body = parseBody(req);
    const ownerRef = db.collection('calendarSubscriptionOwners').doc(uid);
    if (body.action === 'status') {
      const ownerSnap = await ownerRef.get();
      const active = !!(ownerSnap.exists && ownerSnap.data()?.tokenHash && (await db.collection('calendarSubscriptionTokens').doc(ownerSnap.data().tokenHash).get()).exists);
      respond(res, 200, { active });
      return;
    }
    if (body.action === 'revoke') {
      await db.runTransaction(async (transaction) => {
        const ownerSnap = await transaction.get(ownerRef);
        if (ownerSnap.exists) {
          const oldHash = ownerSnap.data()?.tokenHash;
          if (oldHash) transaction.delete(db.collection('calendarSubscriptionTokens').doc(oldHash));
          transaction.delete(ownerRef);
        }
      });
      respond(res, 200, { active: false });
      return;
    }
    if (body.action !== 'create') { respond(res, 400, { error: 'Choose create, status, or revoke.' }); return; }

    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = hashToken(rawToken);
    const tokenRef = db.collection('calendarSubscriptionTokens').doc(tokenHash);
    await db.runTransaction(async (transaction) => {
      const ownerSnap = await transaction.get(ownerRef);
      if (ownerSnap.exists && ownerSnap.data()?.tokenHash) {
        transaction.delete(db.collection('calendarSubscriptionTokens').doc(ownerSnap.data().tokenHash));
      }
      transaction.set(ownerRef, { tokenHash, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      transaction.set(tokenRef, { userId: uid, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    });
    const projectId = admin.app().options.projectId || process.env.GCLOUD_PROJECT || 'cltch-ntwrk-social';
    const url = `https://us-central1-${projectId}.cloudfunctions.net/calendarFeed?token=${encodeURIComponent(rawToken)}`;
    respond(res, 200, { active: true, url });
  } catch (error) {
    const status = error.status || 500;
    logger.error('apiCalendarSubscription failed', { code: error.code || '', status });
    respond(res, status, { error: error.message || 'Unable to manage the calendar subscription.' });
  }
});

exports.calendarFeed = onRequest({ region: 'us-central1', invoker: 'public' }, async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  if (req.method !== 'GET') { res.status(405).send('Method not allowed.'); return; }
  const rawToken = typeof req.query?.token === 'string' ? req.query.token : '';
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(rawToken)) { res.status(404).send('Calendar feed unavailable.'); return; }
  try {
    const tokenHash = hashToken(rawToken);
    const tokenSnap = await db.collection('calendarSubscriptionTokens').doc(tokenHash).get();
    if (!tokenSnap.exists) { res.status(404).send('Calendar feed unavailable.'); return; }
    const uid = tokenSnap.data()?.userId;
    if (typeof uid !== 'string' || !uid) { res.status(404).send('Calendar feed unavailable.'); return; }
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const fromDate = yesterday.toISOString().slice(0, 10);
    const snapshot = await db.collection('gigs')
      .where('acceptedBy', '==', uid)
      .where('status', '==', 'accepted')
      .where('date', '>=', fromDate)
      .orderBy('date', 'asc')
      .limit(200)
      .get();
    const gigs = snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
    const feed = buildCalendarFeed(gigs);
    res.set('Content-Type', 'text/calendar; charset=utf-8');
    res.set('Content-Disposition', 'inline; filename="cltch-private-bookings.ics"');
    res.status(200).send(feed);
  } catch (error) {
    logger.error('calendarFeed failed', { code: error.code || '' });
    res.status(503).send('Calendar feed temporarily unavailable.');
  }
});

exports.apiUnreadMessageCounts = onRequest({ region: 'us-central1' }, async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'GET') {
    respond(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    validateOrigin(req);
    await verifyAppCheckIfPresent(req);
    const uid = await requireUid(req);
    respond(res, 200, await getUnreadMessageCount(uid));
  } catch (error) {
    const status = error.status || 500;
    logger.error('apiUnreadMessageCounts failed', { message: error.message, status });
    respond(res, status, { error: status >= 500 ? 'Unread message count is unavailable.' : error.message });
  }
});

exports.plugzBridge = onRequest({ region: 'us-central1', invoker: 'public' }, async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    respond(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    validateOrigin(req);
    await verifyAppCheckIfPresent(req);
    const body = parseBody(req);
    const plugzIdToken = typeof body.plugzIdToken === 'string' ? body.plugzIdToken.trim() : '';
    const cltchIdToken = typeof body.cltchIdToken === 'string' ? body.cltchIdToken.trim() : '';
    const requestedRole = validRole(body.role) ? body.role : 'musician';
    const acceptedTerms = body.acceptedTerms === true;
    const acceptedTermsVersion = cleanText(body.termsVersion, 80);

    if (!plugzIdToken) {
      respond(res, 400, { error: 'Missing Plugz auth token.' });
      return;
    }
    if (!acceptedTerms || acceptedTermsVersion !== PLUGZ_TERMS_VERSION) {
      respond(res, 400, { error: 'Accept the CLTCH Plugz membership terms before continuing.' });
      return;
    }

    const decodedPlugzUser = await plugzAdminApp.auth().verifyIdToken(plugzIdToken);
    if (decodedPlugzUser.aud !== PLUGZ_PROJECT_ID || decodedPlugzUser.firebase?.sign_in_provider === 'anonymous') {
      respond(res, 403, { error: 'Plugz account is not eligible for CLTCH access.' });
      return;
    }
    if (decodedPlugzUser.email_verified !== true) {
      respond(res, 403, { error: 'Verify your Plugz email before activating CLTCH membership.' });
      return;
    }

    let cltchUser;
    if (cltchIdToken) {
      const decodedCltchUser = await admin.auth().verifyIdToken(cltchIdToken);
      cltchUser = await admin.auth().getUser(decodedCltchUser.uid);
    } else {
      cltchUser = await resolveOrCreateCltchUserFromPlugz(decodedPlugzUser);
    }
    const email = normalizeEmail(cltchUser.email || decodedPlugzUser.email);
    const membership = await grantPlugzMembership(cltchUser.uid, email, requestedRole, decodedPlugzUser, {
      source: cltchIdToken ? 'profile' : 'auth'
    });
    const customToken = await admin.auth().createCustomToken(cltchUser.uid, {
      provider: PLUGZ_PROVIDER_ID,
      plugz: true,
      membership: 'cltch-free-6-months'
    });

    respond(res, 200, {
      ok: true,
      customToken,
      role: requestedRole,
      uid: cltchUser.uid,
      email,
      membership,
      termsVersion: PLUGZ_TERMS_VERSION
    });
  } catch (error) {
    const status = error.status || 500;
    logger.error('plugzBridge failed', error);
    respond(res, status, { ok: false, error: error.message || 'Unable to connect Plugz to CLTCH.' });
  }
});

exports.stripeConfig = onRequest({ region: 'us-central1' }, async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'GET') {
    respond(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    validateOrigin(req);
    const publishableKey = getStripePublishableKey();
    respond(res, 200, {
      ready: !!publishableKey,
      publishableKey
    });
  } catch (error) {
    const status = error.status || 500;
    logger.error('stripeConfig failed', error);
    respond(res, status, { error: error.message || 'Unable to load Stripe config.' });
  }
});

exports.stripeCreateConnectedAccount = onRequest({ region: 'us-central1' }, async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    respond(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    validateOrigin(req);
    await verifyAppCheckIfPresent(req);
    const uid = await requireUid(req);
    const body = parseBody(req);
    const role = body.role;

    if (!validRole(role)) {
      respond(res, 400, { error: 'Invalid role.' });
      return;
    }
    await requireRoleAccess(uid, role);

    const stripe = getStripeClient();
    const existing = await stripeConnectedAccountRef(uid, role).get();
    if (existing.exists && existing.data().accountId) {
      respond(res, 200, {
        accountId: existing.data().accountId,
        alreadyExists: true
      });
      return;
    }

    const account = await stripe.accounts.create({
      type: 'express',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true }
      },
      metadata: {
        platform: 'CLTCH.NTWRK',
        uid,
        role
      }
    });

    await stripeConnectedAccountRef(uid, role).set({
      accountId: account.id,
      role,
      uid,
      chargesEnabled: !!account.charges_enabled,
      payoutsEnabled: !!account.payouts_enabled,
      detailsSubmitted: !!account.details_submitted,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    respond(res, 200, {
      accountId: account.id,
      alreadyExists: false
    });
  } catch (error) {
    const status = error.status || 500;
    logger.error('stripeCreateConnectedAccount failed', error);
    respond(res, status, { error: error.message || 'Unable to create Stripe connected account.' });
  }
});

exports.stripeCreateOnboardingLink = onRequest({ region: 'us-central1' }, async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    respond(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    validateOrigin(req);
    await verifyAppCheckIfPresent(req);
    const uid = await requireUid(req);
    const body = parseBody(req);
    const role = body.role;

    if (!validRole(role)) {
      respond(res, 400, { error: 'Invalid role.' });
      return;
    }
    await requireRoleAccess(uid, role);

    const stripe = getStripeClient();
    const accountId = await getConnectedAccountId(uid, role);
    const link = await stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      refresh_url: buildStripeReturnUrl(role === 'host' ? 'host-profile.html' : 'musician-profile.html'),
      return_url: buildStripeReturnUrl(role === 'host' ? 'host-profile.html' : 'musician-profile.html')
    });

    respond(res, 200, {
      url: link.url,
      expiresAt: link.expires_at
    });
  } catch (error) {
    const status = error.status || 500;
    logger.error('stripeCreateOnboardingLink failed', error);
    respond(res, status, { error: error.message || 'Unable to create Stripe onboarding link.' });
  }
});

exports.stripeCreateHostCheckoutIntent = onRequest({ region: 'us-central1' }, async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    respond(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    validateOrigin(req);
    await verifyAppCheckIfPresent(req);
    const uid = await requireUid(req);
    const body = parseBody(req);
    const gigId = typeof body.gigId === 'string' ? body.gigId.trim() : '';
    const performerId = typeof body.performerId === 'string' ? body.performerId.trim() : '';

    if (!gigId || !performerId) {
      respond(res, 400, { error: 'Missing gigId or performerId.' });
      return;
    }

    const gigSnap = await db.collection('gigs').doc(gigId).get();
    if (!gigSnap.exists) {
      respond(res, 404, { error: 'Gig not found.' });
      return;
    }
    const gig = gigSnap.data() || {};
    if (gig.hostId !== uid) {
      respond(res, 403, { error: 'Only the host for this gig can start checkout.' });
      return;
    }
    if (gig.status !== 'accepted' || gig.acceptedBy !== performerId) {
      respond(res, 409, { error: 'Checkout is available only for the performer currently assigned to an accepted booking.' });
      return;
    }

    const stripe = getStripeClient();
    const connectedAccountId = await getConnectedAccountId(performerId, 'musician');
    const account = await stripe.accounts.retrieve(connectedAccountId);
    const accountReadiness = {
      chargesEnabled: !!account.charges_enabled,
      payoutsEnabled: !!account.payouts_enabled,
      detailsSubmitted: !!account.details_submitted,
      transfersActive: account.capabilities?.transfers === 'active'
    };
    await stripeConnectedAccountRef(performerId, 'musician').set({
      ...accountReadiness,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    if (!accountReadiness.chargesEnabled || !accountReadiness.payoutsEnabled || !accountReadiness.detailsSubmitted || !accountReadiness.transfersActive) {
      respond(res, 409, { error: 'The performer payout account is not currently ready for checkout.' });
      return;
    }

    const totalAmount = gig.lockedHostTotalCharge ?? gig.hostTotalCharge;
    const feeAmount = gig.lockedProcessingFeeAmount ?? gig.processingFeeAmount ?? 0;
    const totalAmountCents = requirePositiveAmountCents(totalAmount, 'booking total');
    const feeAmountCents = parseAmountCents(feeAmount);
    if (feeAmountCents > totalAmountCents) {
      respond(res, 409, { error: 'The stored booking fee exceeds the booking total.' });
      return;
    }

    if (gig.stripePaymentIntentId) {
      const existingIntent = await stripe.paymentIntents.retrieve(gig.stripePaymentIntentId);
      if (existingIntent.metadata?.gigId !== gigId
        || existingIntent.metadata?.hostId !== uid
        || existingIntent.metadata?.performerId !== performerId
        || existingIntent.amount !== totalAmountCents
        || existingIntent.application_fee_amount !== feeAmountCents
        || existingIntent.currency !== 'usd') {
        respond(res, 409, { error: 'The existing payment record does not match this booking. Contact support before retrying.' });
        return;
      }
      if (existingIntent.status === 'canceled' || existingIntent.status === 'succeeded') {
        respond(res, 409, { error: 'This booking payment is already closed.' });
        return;
      }
      respond(res, 200, {
        clientSecret: existingIntent.client_secret,
        paymentIntentId: existingIntent.id,
        reused: true
      });
      return;
    }

    const intent = await stripe.paymentIntents.create({
      amount: totalAmountCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      application_fee_amount: feeAmountCents,
      transfer_data: {
        destination: connectedAccountId
      },
      metadata: {
        platform: 'CLTCH.NTWRK',
        gigId,
        hostId: uid,
        performerId
      }
    }, {
      idempotencyKey: `cltch-host-checkout-${gigId}`
    });

    await db.collection('gigs').doc(gigId).set({
      stripeCheckoutPreparedAt: admin.firestore.FieldValue.serverTimestamp(),
      stripePaymentIntentId: intent.id,
      stripeConnectedAccountId: connectedAccountId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    respond(res, 200, {
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id
    });
  } catch (error) {
    const status = error.status || 500;
    logger.error('stripeCreateHostCheckoutIntent failed', error);
    respond(res, status, { error: error.message || 'Unable to create Stripe checkout intent.' });
  }
});

exports.plaidCreateLinkToken = onRequest({ region: 'us-central1' }, async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    respond(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    validateOrigin(req);
    await verifyAppCheckIfPresent(req);
    const uid = await requireUid(req);
    const body = parseBody(req);
    const role = body.role;

    if (!validRole(role)) {
      respond(res, 400, { error: 'Invalid role.' });
      return;
    }
    await requireRoleAccess(uid, role);

    const plaidClient = getPlaidClient();

    const linkTokenResp = await plaidClient.linkTokenCreate({
      client_name: 'CLTCH.NTWRK',
      language: 'en',
      country_codes: ['US'],
      products: ['auth'],
      user: {
        client_user_id: `${uid}:${role}`
      },
      account_filters: {
        depository: {
          account_subtypes: ['checking', 'savings']
        }
      }
    });

    respond(res, 200, {
      linkToken: linkTokenResp.data.link_token,
      expiration: linkTokenResp.data.expiration
    });
  } catch (error) {
    const status = error.status || 500;
    logger.error('plaidCreateLinkToken failed', error);
    respond(res, status, { error: error.message || 'Unable to create Plaid link token.' });
  }
});

exports.plaidExchangePublicToken = onRequest({ region: 'us-central1' }, async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    respond(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    validateOrigin(req);
    await verifyAppCheckIfPresent(req);
    const uid = await requireUid(req);
    const body = parseBody(req);

    const role = body.role;
    const publicToken = body.publicToken;
    const accountId = typeof body.accountId === 'string' ? body.accountId : '';
    const institutionName = typeof body.institutionName === 'string' ? body.institutionName : '';
    const accountMask = typeof body.accountMask === 'string' ? body.accountMask : '';

    if (!validRole(role)) {
      respond(res, 400, { error: 'Invalid role.' });
      return;
    }
    await requireRoleAccess(uid, role);

    if (!publicToken || typeof publicToken !== 'string') {
      respond(res, 400, { error: 'Missing public token.' });
      return;
    }

    const plaidClient = getPlaidClient();
    const exchangeResp = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken
    });

    const itemId = exchangeResp.data.item_id;
    const accessToken = exchangeResp.data.access_token;

    await db.collection('plaidItems').doc(uid).set(
      {
        [role]: {
          itemId,
          accessToken,
          accountId,
          institutionName: sanitizeInstitution(institutionName),
          accountMask: sanitizeMask(accountMask),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }
      },
      { merge: true }
    );

    const displayHandle = buildDisplayHandle(institutionName, accountMask);
    respond(res, 200, {
      ok: true,
      displayHandle,
      institutionName: sanitizeInstitution(institutionName),
      accountMask: sanitizeMask(accountMask)
    });
  } catch (error) {
    const status = error.status || 500;
    logger.error('plaidExchangePublicToken failed', error);
    respond(res, status, { error: error.message || 'Unable to exchange Plaid public token.' });
  }
});

// All consequential booking transitions pass through this transaction so the
// server owns authorization, conflict checks, idempotency, and the audit clock.
exports.bookingAction = onRequest({ region: 'us-central1' }, async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') return respond(res, 204, {});
  if (req.method !== 'POST') return respond(res, 405, { error: 'POST required.' });
  try {
    validateOrigin(req);
    await verifyAppCheckIfPresent(req);
    const uid = await requireUid(req);
    const { gigId, action, actionId, payload = {} } = parseBody(req);
    if (!/^[A-Za-z0-9_-]{1,150}$/.test(gigId || '') || !/^[A-Za-z0-9_-]{8,100}$/.test(actionId || '')) {
      return respond(res, 400, { error: 'A valid booking and action id are required.' });
    }
    const allowedActions = new Set(['accept', 'cancel', 'reopen', 'checkin', 'proposeAmendment', 'acceptAmendment', 'declineAmendment', 'offerReplacement', 'acceptReplacement', 'declineReplacement']);
    if (!allowedActions.has(action)) return respond(res, 400, { error: 'Unsupported booking action.' });
    if (['accept', 'checkin', 'acceptReplacement', 'declineReplacement'].includes(action)) await requireRoleAccess(uid, 'musician');
    if (['offerReplacement', 'reopen'].includes(action)) await requireRoleAccess(uid, 'host');

    const gigRef = db.collection('gigs').doc(gigId);
    const actionRef = gigRef.collection('actionReceipts').doc(actionId);
    const auditRef = gigRef.collection('audit');
    let result = {};
    await db.runTransaction(async (tx) => {
      result = {};
      const [gigSnap, receiptSnap] = await Promise.all([tx.get(gigRef), tx.get(actionRef)]);
      if (!gigSnap.exists) { const e = new Error('Booking not found.'); e.status = 404; throw e; }
      const gig = gigSnap.data();
      if (receiptSnap.exists) {
        const receipt = receiptSnap.data();
        if (receipt.actorId !== uid || receipt.action !== action) { const e = new Error('This action id has already been used.'); e.status = 409; throw e; }
        result = receipt.result || { idempotent: true };
        return;
      }
      const host = uid === gig.hostId;
      const performer = uid === gig.acceptedBy;
      const recordAcceptance = action === 'accept';
      const recordHostCancellation = action === 'cancel'
        && host && gig.status === 'accepted'
        && gig.reliabilityAcceptanceTracked === true;
      const reliabilityRef = db.collection('hostBookingReliability').doc(gig.hostId);
      let reliabilitySnap = null;
      if (recordAcceptance || recordHostCancellation) reliabilitySnap = await tx.get(reliabilityRef);
      if (host && ['cancel', 'reopen'].includes(action)) {
        const hostSnap = await tx.get(db.collection('hosts').doc(uid));
        if (!hostSnap.exists) { const e = new Error('Complete your host profile before changing booking status.'); e.status = 403; throw e; }
      }
      const now = admin.firestore.FieldValue.serverTimestamp();
      let updates = {};
      let auditAction = action;
      let profileWrites = [];
      let acceptanceResult = null;
      if (action === 'accept') {
        if (host || gig.status !== 'open') { const e = new Error('This booking is no longer available.'); e.status = 409; throw e; }
        await assertNotBlockedBetween(tx, uid, gig.hostId);
        const musicianRef = db.collection('musicians').doc(uid);
        const musicianSnap = await tx.get(musicianRef);
        const acceptance = bookingAcceptanceCheck(gig, musicianSnap.exists ? musicianSnap.data() : null, uid, gigId);
        if (acceptance.error) { const e = new Error(acceptance.error); e.status = acceptance.error.includes('Complete your') ? 403 : 409; throw e; }
        const musician = musicianSnap.data();
        const date = acceptance.localDate;
        updates = { status: 'accepted', acceptedBy: uid, acceptedAt: now, reliabilityAcceptanceTracked: true, lockedPay: gig.pay || '', lockedDate: gig.date || '', lockedTime: gig.time || '', lockedLocation: gig.location || '' };
        if (Number.isFinite(Number(gig.processingFeeAmount))) updates.lockedProcessingFeeAmount = Number(gig.processingFeeAmount);
        if (Number.isFinite(Number(gig.hostTotalCharge))) updates.lockedHostTotalCharge = Number(gig.hostTotalCharge);
        const booking = { gigId, id: gigId, date, venue: gig.venue || '', time: gig.time || '', pay: gig.pay || '', location: gig.location || '', genre: gig.genre || '' };
        profileWrites.push([musicianRef, { bookedDates: normalizeBookingCache(musician.bookedDates, booking) }]);
        acceptanceResult = booking;
      } else if (action === 'cancel') {
        const cancellationDate = cleanText(gig.lockedDate || gig.date, 20);
        if (cancellationDate && cancellationDate < new Date().toISOString().slice(0, 10)) { const e = new Error('Past bookings cannot be cancelled from this action.'); e.status = 409; throw e; }
        if (host && ['open', 'accepted'].includes(gig.status)) {
          updates = { status: 'cancelled', cancelledAt: now, cancelledBy: uid, acceptedBy: admin.firestore.FieldValue.delete(), acceptedAt: admin.firestore.FieldValue.delete(), reliabilityAcceptanceTracked: admin.firestore.FieldValue.delete(), checkedInAt: admin.firestore.FieldValue.delete(), lockedPay: admin.firestore.FieldValue.delete(), lockedDate: admin.firestore.FieldValue.delete(), lockedTime: admin.firestore.FieldValue.delete(), lockedLocation: admin.firestore.FieldValue.delete(), lockedProcessingFeeAmount: admin.firestore.FieldValue.delete(), lockedHostTotalCharge: admin.firestore.FieldValue.delete(), pendingAmendment: admin.firestore.FieldValue.delete(), replacementOffer: admin.firestore.FieldValue.delete() };
          const reason = cleanText(payload.cancelReason, 160);
          updates.cancelReason = reason || admin.firestore.FieldValue.delete();
        } else if (performer && gig.status === 'accepted') {
          updates = { status: 'open', acceptedBy: admin.firestore.FieldValue.delete(), acceptedAt: admin.firestore.FieldValue.delete(), reliabilityAcceptanceTracked: admin.firestore.FieldValue.delete(), checkedInAt: admin.firestore.FieldValue.delete(), lockedPay: admin.firestore.FieldValue.delete(), lockedDate: admin.firestore.FieldValue.delete(), lockedTime: admin.firestore.FieldValue.delete(), lockedLocation: admin.firestore.FieldValue.delete(), lockedProcessingFeeAmount: admin.firestore.FieldValue.delete(), lockedHostTotalCharge: admin.firestore.FieldValue.delete(), pendingAmendment: admin.firestore.FieldValue.delete(), replacementOffer: admin.firestore.FieldValue.delete() };
        }
        else { const e = new Error('You cannot cancel this booking in its current state.'); e.status = 403; throw e; }
        const performerId = host ? gig.acceptedBy : performer ? uid : '';
        if (performerId && gig.status === 'accepted') {
          const musicianRef = db.collection('musicians').doc(performerId);
          const musicianSnap = await tx.get(musicianRef);
          if (musicianSnap.exists) {
            const dates = Array.isArray(musicianSnap.data()?.bookedDates) ? musicianSnap.data().bookedDates : [];
            profileWrites.push([musicianRef, { bookedDates: normalizeBookingCache(dates.filter((entry) => entry?.gigId !== gigId)) }]);
          }
        }
      } else if (action === 'reopen') {
        if (!host || gig.status !== 'cancelled') { const e = new Error('Only the host can reopen a cancelled booking.'); e.status = 403; throw e; }
        if (gig.date && gig.date < new Date().toISOString().slice(0, 10)) { const e = new Error('Past bookings cannot be reopened.'); e.status = 409; throw e; }
        updates = { status: 'open', acceptedBy: admin.firestore.FieldValue.delete(), acceptedAt: admin.firestore.FieldValue.delete(), checkedInAt: admin.firestore.FieldValue.delete(), cancelledAt: admin.firestore.FieldValue.delete(), cancelledBy: admin.firestore.FieldValue.delete(), lockedPay: admin.firestore.FieldValue.delete(), lockedDate: admin.firestore.FieldValue.delete(), lockedTime: admin.firestore.FieldValue.delete(), lockedLocation: admin.firestore.FieldValue.delete(), lockedProcessingFeeAmount: admin.firestore.FieldValue.delete(), lockedHostTotalCharge: admin.firestore.FieldValue.delete(), pendingAmendment: admin.firestore.FieldValue.delete(), replacementOffer: admin.firestore.FieldValue.delete() };
      } else if (action === 'checkin') {
        if (!performer || gig.status !== 'accepted') { const e = new Error('Only the assigned performer can check in.'); e.status = 403; throw e; }
        if (gig.checkedInAt) { result = { checkedIn: true, idempotent: true }; }
        else updates = { checkedInAt: now, checkInConsentAt: now };
      } else if (action === 'proposeAmendment') {
        if ((!host && !performer) || gig.status !== 'accepted') { const e = new Error('Only booking participants can propose an amendment.'); e.status = 403; throw e; }
        if (gig.pendingAmendment) { const e = new Error('A booking amendment is already waiting for a response.'); e.status = 409; throw e; }
        const fields = ['date', 'time', 'location', 'pay']; const amendment = {};
        fields.forEach((field) => {
          if (!Object.prototype.hasOwnProperty.call(payload, field)) return;
          const value = cleanText(payload[field], field === 'location' || field === 'pay' ? 100 : 20);
          const valid = field === 'date' ? /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
            : field === 'time' ? /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
              : !!value;
          if (!valid) { const e = new Error(`Invalid proposed ${field}.`); e.status = 400; throw e; }
          amendment[field] = value;
        });
        if (!Object.keys(amendment).length) { const e = new Error('Include at least one proposed change.'); e.status = 400; throw e; }
        updates = { pendingAmendment: { ...amendment, proposedBy: uid, proposedAt: admin.firestore.Timestamp.now(), acceptedBy: [] } };
      } else if (action === 'acceptAmendment' || action === 'declineAmendment') {
        const amendment = gig.pendingAmendment;
        if ((!host && !performer) || !amendment || amendment.proposedBy === uid) { const e = new Error('No amendment is awaiting your response.'); e.status = 409; throw e; }
        updates = action === 'declineAmendment' ? { pendingAmendment: admin.firestore.FieldValue.delete() } : { pendingAmendment: { ...amendment, acceptedBy: [amendment.proposedBy, uid] } };
        if (action === 'acceptAmendment') {
          if (amendment.date) updates.lockedDate = amendment.date;
          if (amendment.time) updates.lockedTime = amendment.time;
          if (amendment.location) updates.lockedLocation = amendment.location;
          if (amendment.pay) updates.lockedPay = amendment.pay;
          updates.pendingAmendment = admin.firestore.FieldValue.delete();
        }
      } else if (action === 'offerReplacement') {
        if (!host || gig.status !== 'accepted' || gig.pendingAmendment || gig.replacementOffer?.status === 'pending' || gig.replacementOffer?.status === 'accepted' || !/^[A-Za-z0-9_-]{1,128}$/.test(payload.performerId || '') || payload.performerId === gig.acceptedBy) { const e = new Error('A host must choose a different performer and resolve any pending amendment first.'); e.status = 403; throw e; }
        updates = { replacementOffer: { performerId: payload.performerId, offeredBy: uid, offeredAt: admin.firestore.Timestamp.now(), status: 'pending' } };
      } else if (action === 'acceptReplacement') {
        const offer = gig.replacementOffer;
        if (!offer || offer.performerId !== uid || offer.status !== 'pending' || gig.status !== 'accepted') { const e = new Error('No replacement offer is available to you.'); e.status = 403; throw e; }
        await assertNotBlockedBetween(tx, uid, gig.hostId);
        const [oldPerformerSnap, newPerformerSnap] = await Promise.all([
          gig.acceptedBy ? tx.get(db.collection('musicians').doc(gig.acceptedBy)) : Promise.resolve(null),
          tx.get(db.collection('musicians').doc(uid))
        ]);
        if (!newPerformerSnap?.exists) { const e = new Error('Your performer profile is no longer available for this replacement.'); e.status = 409; throw e; }
        const replacementGig = { ...gig, status: 'open', date: gig.lockedDate || gig.date, time: gig.lockedTime || gig.time };
        const replacementAcceptance = bookingAcceptanceCheck(replacementGig, newPerformerSnap.data(), uid, gigId);
        if (replacementAcceptance.error) { const e = new Error(replacementAcceptance.error); e.status = 409; throw e; }
        updates = { acceptedBy: uid, acceptedAt: now, replacementOffer: { ...offer, status: 'accepted', acceptedAt: admin.firestore.Timestamp.now() } };
        const booking = { gigId, id: gigId, date: replacementAcceptance.localDate || replacementGig.date || '', venue: gig.venue || '', time: replacementGig.time || '', pay: gig.lockedPay || gig.pay || '', location: gig.lockedLocation || gig.location || '', genre: gig.genre || '' };
        if (oldPerformerSnap?.exists) {
          const oldRef = db.collection('musicians').doc(gig.acceptedBy);
          const oldDates = Array.isArray(oldPerformerSnap.data()?.bookedDates) ? oldPerformerSnap.data().bookedDates : [];
          tx.update(oldRef, { bookedDates: normalizeBookingCache(oldDates.filter((entry) => entry?.gigId !== gigId)) });
        }
        const newRef = db.collection('musicians').doc(uid);
        const newDates = Array.isArray(newPerformerSnap.data()?.bookedDates) ? newPerformerSnap.data().bookedDates : [];
        tx.update(newRef, { bookedDates: normalizeBookingCache(newDates, booking) });
      } else if (action === 'declineReplacement') {
        const offer = gig.replacementOffer;
        if (!offer || offer.performerId !== uid || offer.status !== 'pending') { const e = new Error('No replacement offer is available to decline.'); e.status = 403; throw e; }
        updates = { replacementOffer: { ...offer, status: 'declined', declinedAt: admin.firestore.Timestamp.now() } };
      }
      if (Object.keys(updates).length) {
        tx.update(gigRef, updates);
        tx.create(auditRef.doc(), { action: auditAction, actorId: uid, at: now, fromStatus: gig.status, toStatus: updates.status || gig.status, actionId });
      }
      if (recordAcceptance || recordHostCancellation) {
        const next = nextHostReliability(reliabilitySnap?.exists ? reliabilitySnap.data() : null, {
          acceptance: recordAcceptance,
          hostCancellationAfterAcceptance: recordHostCancellation,
          serverTime: now
        });
        if (next) tx.set(reliabilityRef, next);
      }
      profileWrites.forEach(([ref, data]) => tx.update(ref, data));
      result = { ...(result.idempotent ? result : {}), ok: true, action, ...(acceptanceResult ? { booking: acceptanceResult } : {}) };
      tx.create(actionRef, { actorId: uid, action, result, createdAt: now });
    });
    return respond(res, 200, result);
  } catch (error) {
    logger.warn('bookingAction failed', { message: error.message });
    return respond(res, error.status || 500, { error: error.message || 'Booking action failed.' });
  }
});
