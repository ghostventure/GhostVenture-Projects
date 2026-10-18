// Only shared server records can determine paid access.
function paymentStatusFor(entitlement, time = Date.now()) {
  if (entitlement.status === 'active') return 'paid'
  if (entitlement.status === 'trialing') {
    const end = Date.parse(entitlement.trial_ends_at || '')
    return Number.isFinite(end) && end > time ? 'trial' : 'canceled'
  }
  return entitlement.status === 'past_due' ? 'past_due' : 'canceled'
}

function connectionReadiness(connection) {
  return {
    accountRecorded: /^acct_[a-zA-Z0-9]+$/.test(connection?.account_id || ''),
    mode: connection?.mode || 'test',
    message: 'Saved test details are not proof of an authorized Stripe connection.',
  }
}

function billingErrorMessage(status) {
  if (status === 401) return 'Your shared sign-in expired. Sign out and sign back in, then retry.'
  if (status === 403) return 'Your workspace account does not have permission for this billing action.'
  if (status === 404) return 'The secure billing service is not deployed. Shared plan viewing is still available.'
  return `Billing is unavailable (${status}). Try again later.`
}

module.exports = { paymentStatusFor, connectionReadiness, billingErrorMessage }
