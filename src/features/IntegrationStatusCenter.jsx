import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, AlertCircle, CheckCircle2, Cloud, HardDrive, RefreshCw, ShieldAlert, Unplug } from 'lucide-react'
import './IntegrationStatusCenter.css'

const asDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString()
}

const normalize = (value) => String(value || '').toLowerCase()

function StateBadge({ state }) {
  const type = normalize(state)
  const Icon = ['connected', 'synced', 'healthy', 'ready'].some((word) => type.includes(word)) ? CheckCircle2
    : ['attention', 'error', 'failed', 'expired'].some((word) => type.includes(word)) ? AlertCircle
      : ['offline', 'local', 'not configured', 'not connected', 'not checked', 'waiting'].some((word) => type.includes(word)) ? Unplug : Activity
  return <span className={`isc-badge ${type.includes('attention') || type.includes('error') || type.includes('failed') ? 'is-warning' : type.includes('connected') || type.includes('synced') ? 'is-good' : ''}`}><Icon size={14} aria-hidden="true" />{state}</span>
}

export default function IntegrationStatusCenter({ backendState = {}, session = {}, refreshBackend = async () => {}, setOperationNotice = () => {} }) {
  const [details, setDetails] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [refreshedAt, setRefreshedAt] = useState('')
  const refreshRef = useRef(null)

  const refresh = useCallback(async ({ retryCustomers = false } = {}) => {
    const bridge = window.overheadBackend
    if (!bridge) {
      setError('The desktop service bridge is unavailable in this build. Showing only status already supplied by the app.')
      setDetails({ stripe: { unavailable: true }, microsoft: { unavailable: true }, square: { unavailable: true }, ...(retryCustomers ? { customerSync: { unavailable: true } } : {}) })
      return
    }
    setLoading(true)
    setError('')
    setDetails({ stripe: { loading: true }, microsoft: { loading: true }, square: { loading: true }, ...(retryCustomers ? { customerSync: { loading: true } } : {}) })
    const jobs = [
      ['stripe', bridge.getStripeConnectorStatus],
      ['microsoft', bridge.listMicrosoftConnections],
      ['square', bridge.listSquareConnections],
    ]
    try {
      const results = await Promise.all(jobs.map(async ([key, fn]) => {
        if (typeof fn !== 'function') return [key, { unavailable: true }]
        try { return [key, { value: await fn() }] }
        catch (reason) { return [key, { error: reason?.message || 'Status could not be loaded.' }] }
      }))
      setDetails(Object.fromEntries(results))
      const errors = results.map(([, result]) => result.error).filter(Boolean)
      if (errors.length) setError(errors.join(' '))

      if (retryCustomers) {
        if (typeof bridge.syncCustomers !== 'function') {
          setDetails((current) => ({ ...current, customerSync: { unavailable: true } }))
        } else {
          try {
            const sync = await bridge.syncCustomers()
            setDetails((current) => ({ ...current, customerSync: { value: sync } }))
            await refreshBackend()
          } catch (reason) {
            setDetails((current) => ({ ...current, customerSync: { error: reason?.message || 'Shared workspace sync could not finish.' } }))
          }
        }
      }
      setRefreshedAt(new Date().toISOString())
    } catch (reason) {
      setError(reason?.message || 'Integration statuses could not be refreshed.')
    } finally {
      setLoading(false)
    }
  }, [refreshBackend])

  refreshRef.current = refresh
  useEffect(() => { refreshRef.current?.() }, [])

  const currentValue = (entry, fallback) => entry ? entry.value || null : fallback
  const customerSync = currentValue(details.customerSync, backendState.customerSync) || {}
  const stripe = currentValue(details.stripe, backendState.stripeConnector)
  const microsoft = currentValue(details.microsoft, backendState.microsoftConnections)
  const square = currentValue(details.square, backendState.squareConnections)
  const apiAvailable = (name) => typeof window.overheadBackend?.[name] === 'function'
  const stateFor = (result, fallback) => result?.error ? 'Status unavailable' : result?.unavailable ? 'Unavailable in this build' : fallback
  const providers = useMemo(() => {
    const signedIn = Boolean(session?.sessionId || session?.id || session?.email)
    const customerStatus = customerSync.status || (signedIn ? 'Not synchronized' : 'Local only')
    const customers = {
      name: 'OverHead shared workspace', icon: Cloud,
      state: details.customerSync?.loading ? 'Checking…' : details.customerSync?.error ? 'Status unavailable' : details.customerSync?.unavailable || !apiAvailable('syncCustomers') ? 'Unavailable in this build' : customerSync.status ? customerStatus : signedIn ? 'Not synchronized' : 'Local only',
      detail: details.customerSync?.error || (details.customerSync?.unavailable || !apiAvailable('syncCustomers') ? 'Customer sync status is not available in this build; no cached connection state is being presented.' : customerSync.message || (signedIn ? 'No successful shared customer sync has been recorded.' : 'No shared workspace session is active. Local records remain on this device.')),
      last: details.customerSync?.error || details.customerSync?.unavailable || !apiAvailable('syncCustomers') || details.customerSync?.loading ? '' : customerSync.last_synced_at,
      action: 'Retry customer sync', retry: 'customers',
    }
    const msRows = Array.isArray(microsoft) ? microsoft : []
    const msConnected = msRows.filter((item) => item.connected).length
    const msConfigured = msRows.length
    const msUnavailable = details.microsoft?.unavailable || !apiAvailable('listMicrosoftConnections')
    const ms = { name: 'Microsoft 365', icon: Cloud, state: details.microsoft?.loading ? 'Checking…' : stateFor({ ...details.microsoft, unavailable: msUnavailable }, msConnected ? `${msConnected} connected` : msConfigured ? 'Configured, sign-in incomplete' : 'Not configured'), detail: details.microsoft?.error || (msUnavailable ? 'Connection status is not available in this build; cached connection data is not presented as current.' : msConfigured ? `${msConnected} authenticated connection(s) of ${msConfigured} saved. This app exposes sign-in and preview/import flows; no background mailbox/calendar sync is claimed.` : 'No Microsoft account connection is configured on this device.'), last: details.microsoft?.error || msUnavailable || details.microsoft?.loading ? '' : msRows.reduce((best, item) => item.updated_at && (!best || item.updated_at > best) ? item.updated_at : best, ''), action: '', }
    const sqRows = Array.isArray(square) ? square : []
    const sqUnavailable = details.square?.unavailable || !apiAvailable('listSquareConnections')
    const sq = { name: 'Square', icon: Activity, state: details.square?.loading ? 'Checking…' : stateFor({ ...details.square, unavailable: sqUnavailable }, sqRows.length ? 'Configured' : 'Not configured'), detail: details.square?.error || (sqUnavailable ? 'Connection status is not available in this build; cached merchant records are not presented as current.' : sqRows.length ? `${sqRows.length} saved merchant connection(s). Snapshot import is available; this connector does not report live account connectivity or automatic sync.` : 'No Square merchant connection is configured.'), last: details.square?.error || sqUnavailable || details.square?.loading ? '' : sqRows.reduce((best, item) => item.updated_at && (!best || item.updated_at > best) ? item.updated_at : best, ''), action: '' }
    const stripeConnections = stripe?.connections || backendState.stripeConnections || []
    const stripeReady = stripeConnections.filter((item) => item.ready || item.status === 'Ready').length
    const stripeUnavailable = details.stripe?.unavailable || !apiAvailable('getStripeConnectorStatus')
    const stripeState = details.stripe?.loading ? 'Checking…' : stripeUnavailable ? 'Unavailable in this build' : details.stripe?.error ? 'Status unavailable' : stripe?.sharedSignIn ? (stripe.status || 'Shared account signed in') : stripeConnections.length ? `${stripeReady} ready connection(s)` : 'Not configured'
    const st = { name: 'Stripe', icon: Activity, state: stripeState, detail: details.stripe?.error || (stripeUnavailable ? 'Stripe status is not available in this build; cached connector data is not presented as current.' : stripe?.message || (stripe?.sharedSignIn ? 'Shared billing status is available for refresh. Stripe payment event ingestion/webhooks are separate and are not indicated as active here.' : 'Stripe connector credentials or a shared billing session are not currently available.')), last: details.stripe?.error || stripeUnavailable || details.stripe?.loading ? '' : stripe?.last_synced_at, action: stripe?.sharedSignIn && apiAvailable('syncStripeBilling') && !stripeUnavailable && !details.stripe?.error ? 'Refresh billing status' : '', retry: 'stripe' }
    return [customers, ms, sq, st]
  }, [session, customerSync, microsoft, square, stripe, details, backendState.stripeConnections])

  const act = async (provider) => {
    const key = provider === 'customers' ? 'customerSync' : provider
    const method = provider === 'customers' ? 'syncCustomers' : 'syncStripeBilling'
    setError('')
    setLoading(true)
    setDetails((current) => ({ ...current, [key]: { loading: true } }))
    try {
      const action = window.overheadBackend?.[method]
      if (typeof action !== 'function') {
        setDetails((current) => ({ ...current, [key]: { unavailable: true } }))
        setError(`${provider === 'customers' ? 'Customer synchronization' : 'Billing status refresh'} is not available in this build.`)
        return
      }
      const value = await action()
      setDetails((current) => ({ ...current, [key]: { value } }))
      if (provider === 'customers') await refreshBackend()
      setOperationNotice(provider === 'customers' ? 'Shared workspace customer sync finished. Review its latest status below.' : 'Stripe shared billing status refreshed.')
    } catch (reason) {
      setDetails((current) => ({ ...current, [key]: { error: reason?.message || 'The requested refresh could not finish.' } }))
      setError(reason?.message || 'The requested refresh could not finish.')
    } finally {
      setLoading(false)
    }
  }

  return <section className="integration-status-center" aria-labelledby="integration-status-title">
    <header className="isc-header">
      <div><p className="eyebrow">Connections</p><h2 id="integration-status-title"><Activity size={19} aria-hidden="true" /> Integration status</h2><p>Live status comes from the installed desktop bridge. A saved setup record alone is not proof that a provider is connected.</p></div>
      <button className="ghost-button" type="button" onClick={() => refresh()} disabled={loading}><RefreshCw size={15} aria-hidden="true" />{loading ? 'Refreshing…' : 'Refresh statuses'}</button>
    </header>
    {(error || details.customerSync?.error) && <p className="isc-error" role="alert"><ShieldAlert size={16} aria-hidden="true" />{details.customerSync?.error || error}</p>}
    <div className="isc-grid">{providers.map(({ name, icon: Icon, state, detail, last, action, retry }) => <article className="isc-card" key={name}>
      <div className="isc-card-head"><h3><Icon size={17} aria-hidden="true" />{name}</h3><StateBadge state={state} /></div>
      <p>{detail}</p>
      <div className="isc-meta"><span>Last successful sync</span><strong>{asDate(last) || 'No recorded sync'}</strong></div>
      {action && <button className="ghost-button" type="button" disabled={loading} onClick={() => act(retry)}><RefreshCw size={14} aria-hidden="true" />{action}</button>}
    </article>)}</div>
    <footer className="isc-footer"><HardDrive size={15} aria-hidden="true" /><span>Local records remain available independently. Offline status and provider status are separate; failed remote checks do not imply local data loss.</span>{refreshedAt && <small>Checked {asDate(refreshedAt)}</small>}</footer>
  </section>
}
