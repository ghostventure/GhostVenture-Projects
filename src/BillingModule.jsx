import { useCallback, useEffect, useState } from 'react'
import { CreditCard, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react'
import './BillingModule.css'

const plans = [
  { id: 'silver', name: 'Silver', price: '$59', summary: 'Core office control for a solo owner or lean front desk.', includes: ['1 owner profile', '250 customers', 'Task queue and backups'] },
  { id: 'gold', name: 'Gold', price: '$129', summary: 'Workflow and role depth for a busy service office.', includes: ['3 staff profiles', '1,500 customers', 'Workflow automation'] },
  { id: 'black', name: 'Black', price: '$299', summary: 'Higher-volume protection, recovery, and access controls.', includes: ['10 staff profiles', '10,000 customers', 'Audit ledger and concierge setup'] },
]

const emptyProfile = {
  managerEmail: '', legalName: '', billingEmail: '', phone: '',
  addressLine1: '', addressLine2: '', city: '', region: '', postalCode: '', country: 'US',
  taxIdType: '', taxIdLast4: '', invoiceTerms: 'Due on receipt',
  invoiceFooter: 'Thank you for using OverHead.',
  consentToRecurringBilling: false, cancellationPathAcknowledged: false,
  billingPolicyAcknowledged: false, freeTrialPolicyAcknowledged: false,
}

function profileFromStored(item = {}) {
  return {
    ...emptyProfile,
    managerEmail: item.manager_email || '',
    legalName: item.legal_name || '',
    billingEmail: item.billing_email || '',
    phone: item.phone || '',
    addressLine1: item.address?.line1 || '',
    addressLine2: item.address?.line2 || '',
    city: item.address?.city || '',
    region: item.address?.region || '',
    postalCode: item.address?.postal_code || '',
    country: item.address?.country || 'US',
    taxIdType: item.tax_id_type || '',
    taxIdLast4: item.tax_id_last4 || '',
    invoiceTerms: item.invoice_terms || 'Due on receipt',
    invoiceFooter: item.invoice_footer || 'Thank you for using OverHead.',
    consentToRecurringBilling: item.consent_to_recurring_billing === true,
    cancellationPathAcknowledged: item.cancellation_path_acknowledged === true,
    billingPolicyAcknowledged: item.billing_policy_acknowledged === true,
  }
}

function formatStatus(value) {
  return String(value || 'inactive').replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase())
}

function tierFromLaunchUrl() {
  const tier = new URLSearchParams(window.location.search).get('tier') || ''
  return ['silver', 'gold', 'black'].includes(tier) ? tier : ''
}

export default function BillingModule() {
  const [profile, setProfile] = useState(emptyProfile)
  const [entitlement, setEntitlement] = useState(null)
  const [license, setLicense] = useState(null)
  const [activity, setActivity] = useState([])
  const [requestedTier] = useState(tierFromLaunchUrl)
  const [selectedTier, setSelectedTier] = useState(() => tierFromLaunchUrl() || 'silver')
  const [checkout, setCheckout] = useState(null)
  const [pendingTransactionTier, setPendingTransactionTier] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [lastChecked, setLastChecked] = useState('')

  const refresh = useCallback(async () => {
    setError('')
    try {
      const api = window.overheadBilling
      if (!api) throw new Error('The secure OverHead billing bridge is unavailable. Close this window and reopen Billing from OverHead.')
      const results = await Promise.allSettled([api.getEntitlements(), api.getActivity(), api.getProfile()])
      const failure = results.find((result) => result.status === 'rejected')
      if (failure) throw failure.reason
      const [remote, ledger, savedProfile] = results.map((result) => result.value)
      const current = remote?.entitlement || {}
      setEntitlement(current)
      setLicense(remote?.license || null)
      setActivity(Array.isArray(ledger?.events) ? ledger.events : [])
      if (savedProfile) setProfile((previous) => ({ ...profileFromStored(savedProfile), freeTrialPolicyAcknowledged: previous.freeTrialPolicyAcknowledged }))
      if (!requestedTier && ['silver', 'gold', 'black'].includes(current.tier)) setSelectedTier(current.tier)
      setLastChecked(new Date().toLocaleString())
    } catch (cause) {
      const message = cause?.message || ''
      setError(/sign in is required|sign in with your shared/i.test(message)
        ? 'Sign in as the workspace owner in OverHead’s main window, then refresh Billing here.'
        : message || 'Billing information could not be loaded. Check your connection and try again.')
    }
  }, [requestedTier])

  useEffect(() => {
    window.scrollTo(0, 0)
    refresh()
  }, [refresh])

  function updateProfile(key, value) {
    setProfile((current) => ({ ...current, [key]: value }))
  }

  async function saveProfile() {
    await window.overheadBilling.saveProfile(profile)
    setNotice('Billing profile saved securely on this device.')
  }

  async function runAction(action, successMessage) {
    if (busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await action()
      if (successMessage) setNotice(typeof successMessage === 'function' ? successMessage(result) : successMessage)
      await refresh()
      return result
    } catch (cause) {
      setError(cause?.message || 'Billing action failed. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  async function beginCheckout() {
    if (!profile.billingPolicyAcknowledged) {
      setError('Review and accept the Subscription Billing & Authorization Policy before checkout.')
      return
    }
    const result = await runAction(async () => {
      await saveProfile()
      return window.overheadBilling.createCheckout({ tier: selectedTier, acceptBillingPolicy: profile.billingPolicyAcknowledged })
    })
    if (result?.alreadySubscribed) setNotice(result.message || `The ${selectedTier} plan is already active. No additional charge was created.`)
    else if (result?.clientSecret && result?.publishableKey) setCheckout(result)
  }

  async function startTrial() {
    if (!profile.freeTrialPolicyAcknowledged) {
      setError('Review and accept the Free Trial Policy before starting the trial.')
      return
    }
    await runAction(() => window.overheadBilling.startTrial({ acceptTrialPolicy: true }), (result) => result?.message || 'Your free 30-day Gold trial is active. No card was charged.')
  }

  async function cancelPlan() {
    if (!window.confirm('Cancel the subscription now? OverHead will calculate eligible unused paid time and return that amount to the original payment method. Access ends immediately.')) return
    await runAction(() => window.overheadBilling.cancelAndRefund(), (result) => result?.message || 'Subscription cancellation was submitted.')
  }

  async function createReceipt() {
    await runAction(() => window.overheadBilling.createReceipt(), (result) => `Receipt created: ${result?.pdfPath || 'saved to your OverHead documents'}`)
  }

  const finalizeTransaction = useCallback(async (tier) => {
    if (busy) return
    setBusy(true)
    setCheckout(null)
    setError('')
    setNotice('Payment completed. Confirming and saving your workspace plan…')
    try {
      const result = await window.overheadBilling.confirmCheckout(tier)
      if (!result?.confirmed) throw new Error('The plan update has not been confirmed yet.')
      setEntitlement(result.entitlement)
      setLicense(result.license || null)
      setPendingTransactionTier('')
      setNotice(`${tier[0].toUpperCase()}${tier.slice(1)} is active and saved. Returning to OverHead…`)
      await window.overheadBilling.returnToOverhead({ tier })
    } catch (cause) {
      setPendingTransactionTier(tier)
      setError(cause?.message || 'Payment completed, but the plan could not be confirmed yet. Retry the plan sync in a moment.')
    } finally {
      setBusy(false)
    }
  }, [busy])

  const handleCheckoutComplete = useCallback(() => {
    setCheckout(null)
    setPendingTransactionTier(selectedTier)
    return finalizeTransaction(selectedTier)
  }, [finalizeTransaction, selectedTier])

  const currentTier = plans.find((plan) => plan.id === entitlement?.tier) || plans[0]

  return (
    <main className="billing-module">
      <header className="billing-topbar">
        <div className="billing-brand-mark"><CreditCard size={21} /></div>
        <div className="billing-title"><strong>OverHead</strong><span>WORKSPACE BILLING</span></div>
        <div className="billing-top-actions">
          <span className="secure-label"><ShieldCheck size={15} /> Payments protected by Stripe</span>
          <button className="icon-action" onClick={refresh} disabled={busy} aria-label="Refresh billing"><RefreshCw size={17} /></button>
        </div>
      </header>

      <div className="billing-content">
        <section className="billing-page-intro">
          <div><span className="billing-eyebrow">PLANS &amp; PAYMENTS</span><h1>Manage your subscription</h1><p>Choose a plan, update billing details, and review workspace access.</p></div>
          <div className="billing-account-status"><span className={`status-dot ${['active', 'trialing'].includes(String(entitlement?.status || '').toLowerCase()) ? 'active' : ''}`} /><div><strong>{currentTier.name} plan</strong><small>{formatStatus(entitlement?.status)}</small></div></div>
        </section>
        {(error || notice) && <div className={`billing-message ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>{error || notice}</div>}
        {pendingTransactionTier && <button className="billing-primary-action" type="button" disabled={busy} onClick={() => finalizeTransaction(pendingTransactionTier)}>{busy ? 'Confirming plan…' : 'Retry plan confirmation'}</button>}

        <section className="billing-section">
          <div className="billing-section-heading"><div><span className="billing-eyebrow">01 · PLAN</span><h2>Choose the right plan</h2></div><span className="billing-muted">Monthly subscription · Cancel any time</span></div>
          <div className="billing-plan-grid">
            {plans.map((plan) => (
              <button key={plan.id} type="button" className={`billing-plan ${selectedTier === plan.id ? 'selected' : ''}`} onClick={() => setSelectedTier(plan.id)} aria-pressed={selectedTier === plan.id}>
                <span className="billing-plan-name">{plan.name}</span><strong>{plan.price}<small> / month</small></strong><p>{plan.summary}</p>
                <ul>{plan.includes.map((item) => <li key={item}>{item}</li>)}</ul>
                <span className="plan-select-indicator">{selectedTier === plan.id ? 'Selected' : 'Select plan'}</span>
              </button>
            ))}
          </div>
        </section>

        <div className="billing-checkout-layout">
          <section className="billing-section billing-profile-section">
            <div className="billing-section-heading"><div><span className="billing-eyebrow">02 · BILLING PROFILE</span><h2>Where should receipts go?</h2></div><span className="billing-muted">* Required</span></div>
            <div className="billing-fields">
              <Field label="Legal billing name" value={profile.legalName} onChange={(value) => updateProfile('legalName', value)} required />
              <Field label="Billing email" value={profile.billingEmail} onChange={(value) => updateProfile('billingEmail', value)} type="email" required />
              <Field label="Street address" value={profile.addressLine1} onChange={(value) => updateProfile('addressLine1', value)} required />
              <Field label="Apt, suite, etc." value={profile.addressLine2} onChange={(value) => updateProfile('addressLine2', value)} />
              <Field label="City" value={profile.city} onChange={(value) => updateProfile('city', value)} required />
              <Field label="State / region" value={profile.region} onChange={(value) => updateProfile('region', value)} required />
              <Field label="Postal code" value={profile.postalCode} onChange={(value) => updateProfile('postalCode', value)} required />
              <Field label="Country code" value={profile.country} onChange={(value) => updateProfile('country', value)} required />
              <Field label="Phone (optional)" value={profile.phone} onChange={(value) => updateProfile('phone', value)} />
            </div>
            <div className="billing-consents">
              <Consent checked={profile.billingPolicyAcknowledged && profile.consentToRecurringBilling && profile.cancellationPathAcknowledged} onChange={(value) => {
                updateProfile('billingPolicyAcknowledged', value)
                updateProfile('consentToRecurringBilling', value)
                updateProfile('cancellationPathAcknowledged', value)
              }}>I agree to recurring monthly charges for this plan, accept the Subscription Billing &amp; Authorization Policy, and understand how to cancel.</Consent>
            </div>
            <button className="button-secondary save-profile-button" disabled={busy} onClick={() => runAction(saveProfile, 'Billing profile saved on this device.')}>Save billing details</button>
          </section>

          <aside className="billing-order-summary">
            <span className="billing-eyebrow">03 · ORDER SUMMARY</span>
            <h2>Your plan</h2>
            <div className="summary-plan-row"><div><strong>{plans.find((plan) => plan.id === selectedTier)?.name}</strong><small>OverHead workspace plan</small></div><strong>{plans.find((plan) => plan.id === selectedTier)?.price}<small> / month</small></strong></div>
            <div className="summary-divider" />
            <ul className="summary-includes">{plans.find((plan) => plan.id === selectedTier)?.includes.map((item) => <li key={item}>{item}</li>)}</ul>
            <div className="summary-total"><span>Due today</span><strong>{plans.find((plan) => plan.id === selectedTier)?.price}</strong></div>
            <p className="summary-secure"><LockKeyhole size={15} /> Card details are entered securely with Stripe.</p>
            <button className="button-primary" disabled={busy || !profile.billingPolicyAcknowledged || !profile.consentToRecurringBilling || !profile.cancellationPathAcknowledged} onClick={beginCheckout}>{busy ? 'Preparing checkout…' : 'Continue to secure checkout'}</button>
            <div className="trial-block">
              <Consent checked={profile.freeTrialPolicyAcknowledged} onChange={(value) => updateProfile('freeTrialPolicyAcknowledged', value)}>I have reviewed the Free Trial Policy.</Consent>
              <button className="button-secondary" disabled={busy || !profile.freeTrialPolicyAcknowledged} onClick={startTrial}>Start the free 30-day Gold trial</button>
            </div>
          </aside>
        </div>

        <section className="billing-section billing-history-section">
          <div className="billing-section-heading"><div><span className="billing-eyebrow">ACCOUNT</span><h2>Subscription activity</h2></div><div className="billing-inline-actions"><button className="text-action" disabled={busy} onClick={createReceipt}>Create receipt</button><button className="text-action danger-action" disabled={busy || !entitlement?.stripe_subscription_id} onClick={cancelPlan}>Cancel &amp; refund unused time</button></div></div>
          {activity.length ? <div className="billing-activity">{activity.map((event, index) => <ActivityRow key={`${event?.[0] || event?.title || 'event'}-${index}`} event={event} />)}</div> : <p className="billing-empty">No subscription activity has been recorded yet.</p>}
          <p className="billing-last-checked">Last refreshed {lastChecked || 'not yet'}</p>
        </section>

      </div>
      {checkout && <StripeCheckout checkout={checkout} onClose={() => setCheckout(null)} onComplete={handleCheckoutComplete} />}
    </main>
  )
}

function Field({ label, value, onChange, type = 'text', required = false }) {
  return <label className="billing-field"><span>{label}{required ? ' *' : ''}</span><input type={type} value={value || ''} onChange={(event) => onChange(event.target.value)} autoComplete="off" /></label>
}

function Consent({ checked, onChange, children }) {
  return <label className="billing-consent"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{children}</span></label>
}

function ActivityRow({ event }) {
  const title = Array.isArray(event) ? event[0] : event?.title || event?.type || 'Billing update'
  const at = Array.isArray(event) ? event[1] : event?.created_at || event?.createdAt || ''
  const detail = Array.isArray(event) ? event[2] : event?.detail || event?.status || ''
  return <div className="billing-activity-row"><span className="activity-dot" /><div><strong>{title}</strong><small>{detail}</small></div><time>{at ? new Date(at).toLocaleString() : ''}</time></div>
}

function StripeCheckout({ checkout, onClose, onComplete }) {
  const [error, setError] = useState('')
  const mount = useCallback(async () => {
    try {
      if (!window.Stripe) throw new Error('Stripe checkout could not be loaded.')
      const stripe = window.Stripe(checkout.publishableKey)
      const embedded = await stripe.initEmbeddedCheckout({ fetchClientSecret: async () => checkout.clientSecret, onComplete })
      embedded.mount('#overhead-linux-stripe-checkout')
      return () => embedded.destroy()
    } catch (cause) {
      setError(cause?.message || 'Stripe checkout could not be started.')
    }
  }, [checkout, onComplete])

  useEffect(() => {
    let cleanup
    let script = document.querySelector('script[data-overhead-stripe]')
    const ready = async () => { cleanup = await mount() }
    if (window.Stripe) ready()
    else if (script) script.addEventListener('load', ready, { once: true })
    else {
      script = document.createElement('script')
      script.src = 'https://js.stripe.com/clover/stripe.js'
      script.async = true
      script.dataset.overheadStripe = 'true'
      script.onload = ready
      script.onerror = () => setError('Stripe could not be loaded. Check your connection and try again.')
      document.head.appendChild(script)
    }
    return () => { if (cleanup) cleanup() }
  }, [mount])

  return <div className="stripe-modal" role="dialog" aria-modal="true" aria-label="Secure Stripe checkout"><div className="stripe-modal-panel"><div className="stripe-modal-heading"><div><span className="billing-eyebrow">STRIPE CHECKOUT</span><h2>Complete your payment</h2></div><button className="icon-action" onClick={onClose} aria-label="Close checkout">×</button></div><p>Your payment details are entered directly with Stripe. OverHead never receives or stores your card number or security code.</p><div id="overhead-linux-stripe-checkout" />{error && <div className="billing-message error" role="alert">{error}</div>}</div></div>
}
