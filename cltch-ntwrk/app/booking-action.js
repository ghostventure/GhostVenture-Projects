const ENDPOINT = 'https://us-central1-cltch-ntwrk-social.cloudfunctions.net/bookingAction';
const retryIds = new Map();

function createActionId() {
  return globalThis.crypto?.randomUUID?.() || `booking_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export async function performBookingAction(auth, gigId, action, payload = {}, suppliedActionId = '') {
  if (!auth?.currentUser || !gigId || !action) throw new Error('Sign in and choose a booking action first.');
  const uid = auth.currentUser.uid;
  const payloadKey = JSON.stringify(payload || {});
  const retryKey = `${uid}:${gigId}:${action}`;
  let actionId = suppliedActionId;
  let sessionStore = null;
  try { sessionStore = globalThis.sessionStorage; } catch (_) { /* storage can be unavailable */ }
  if (!actionId) {
    try {
      const stored = sessionStore?.getItem(`cltch_booking_action_retry:${retryKey}`);
      const prior = stored ? JSON.parse(stored) : null;
      if (prior?.payloadKey === payloadKey && prior.actionId) actionId = prior.actionId;
    } catch (_) { /* use in-memory retry state */ }
    const cached = retryIds.get(retryKey);
    if (!actionId && cached?.payloadKey === payloadKey) actionId = cached.actionId;
    if (!actionId) actionId = createActionId();
    retryIds.set(retryKey, { actionId, payloadKey });
    try { sessionStore?.setItem(`cltch_booking_action_retry:${retryKey}`, JSON.stringify({ actionId, payloadKey })); } catch (_) { /* memory fallback */ }
  }
  const token = await auth.currentUser.getIdToken();
  let response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ gigId, action, actionId, payload })
    });
  } catch (error) {
    throw error;
  }
  let body = {};
  try { body = await response.json(); } catch (_) { /* handled below */ }
  if (!response.ok) {
    if (response.status < 500 && !suppliedActionId) {
      retryIds.delete(retryKey);
      try { sessionStore?.removeItem(`cltch_booking_action_retry:${retryKey}`); } catch (_) {}
    }
    throw new Error(body.error || 'Booking action failed. Try again.');
  }
  if (!suppliedActionId) {
    retryIds.delete(retryKey);
    try { sessionStore?.removeItem(`cltch_booking_action_retry:${retryKey}`); } catch (_) {}
  }
  return body;
}
