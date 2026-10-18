import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BadgeCheck,
  BarChart3,
  Bell,
  BookOpenCheck,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CloudDownload,
  Database,
  Eye,
  EyeOff,
  FileText,
  Gauge,
  HelpCircle,
  LifeBuoy,
  LockKeyhole,
  MailCheck,
  MessageSquareText,
  PanelTopOpen,
  ReceiptText,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserRoundCog,
  Users,
  Workflow,
} from 'lucide-react'
import { workflowBoilerplates } from './boilerplates'
import { customerDatabaseSchema } from './customerDatabase'
import { complianceBadges, helpArticles, legalDocuments, marketableFeatures, planTiers, supportChannels } from './productBlueprint'
import { themes } from './themes'
import GrowthWorkspace from './features/GrowthWorkspace'
import SalesWorkspace from './features/SalesWorkspace'
import CustomerManagementWorkspace from './features/CustomerManagementWorkspace'
import CustomerFinanceWorkspace from './features/CustomerFinanceWorkspace'
import PeopleOperationsWorkspace from './features/PeopleOperationsWorkspace'
import SchedulingWorkspace from './features/SchedulingWorkspace'
import DocumentControlWorkspace from './features/DocumentControlWorkspace'
import CollaborationWorkspace from './features/CollaborationWorkspace'
import ControlCenter from './features/ControlCenter'
import { IntegrationStudio } from './IntegrationStudio'
import { AutomationStudio } from './AutomationStudio.jsx'
import { ReportStudio } from './ReportStudio.jsx'
import { AccountGovernancePanel, FeatureWavePreferences, FieldAssistSection, SupportOperationsPanel } from './featureWave301400.jsx'
import './App.css'

const navSections = [
  { id: 'overview', label: 'Team Dashboard', detail: 'Priorities, ownership, readiness', icon: Gauge },
  { id: 'reports', label: 'Reports', detail: 'Activity, revenue, and work summaries', icon: BarChart3 },
  { id: 'growth', label: 'Growth & Work', detail: 'Dashboards, tasks, projects, sales', icon: BriefcaseBusiness },
  { id: 'sales-growth', label: 'Sales Studio', detail: 'Forecasts, qualification, and deal workflow', icon: BarChart3 },
  { id: 'customer-management', label: 'Customer Management', detail: 'Segments, care, consent, and ownership', icon: Users },
  { id: 'field-assist', label: 'Field & Assist', detail: 'Offline capture and reviewed local help', icon: Sparkles },
  { id: 'scheduling', label: 'Scheduling', detail: 'Bookings, capacity, time and reminders', icon: CalendarDays },
  { id: 'documents', label: 'Documents', detail: 'Records, retention and review control', icon: FileText },
  { id: 'collaboration', label: 'Team & Comms', detail: 'Shared notes, contacts and preferences', icon: MessageSquareText },
  { id: 'finance', label: 'Finance', detail: 'Invoices, expenses and close workflow', icon: ReceiptText },
  { id: 'people', label: 'People', detail: 'Staff development and workload', icon: UserRoundCog },
  { id: 'rule-center', label: 'Rule Builder', detail: 'Reviewable event workflows', icon: Workflow },
  { id: 'integrations', label: 'Integrations', detail: 'Connections, imports, and export status', icon: CloudDownload },
  { id: 'search', label: 'Search', detail: 'Search, saved views, and record tags', icon: Search },
  { id: 'admin-security', label: 'Admin Security', detail: 'Access reviews and security policies', icon: LockKeyhole },
  { id: 'work', label: 'Workflows', detail: 'Scheduling, answers, quotes', icon: Workflow },
  { id: 'customers', label: 'Customers', detail: 'Profiles, rules, service history', icon: Users },
  { id: 'imports', label: 'Import', detail: 'Microsoft 365 and Business Central', icon: CloudDownload },
  { id: 'automations', label: 'Automations', detail: 'Jobs, reminders, queues', icon: Sparkles },
  { id: 'evidence', label: 'Evidence', detail: 'Integrity, logs, audit trail', icon: ShieldAlert },
  { id: 'support', label: 'Support', detail: 'Legal, tickets, help paths', icon: LifeBuoy },
  { id: 'tools', label: 'Tools', detail: 'PDFs, exports, utilities', icon: BriefcaseBusiness },
  { id: 'accounts', label: 'Accounts', detail: 'Users, roles, manager profiles', icon: UserRoundCog },
  { id: 'licenses', label: 'Licenses', detail: 'User subscriptions and OverHead team access', icon: BadgeCheck },
  { id: 'plans', label: 'Plans', detail: 'Price, billing, access', icon: BadgeCheck },
  { id: 'payments', label: 'Payments', detail: 'Stripe verify, import data', icon: ReceiptText },
  { id: 'square', label: 'Square', detail: 'Browser verify, import data', icon: PanelTopOpen },
  { id: 'security', label: 'Security', detail: 'Recovery, privacy, compliance', icon: ShieldCheck },
  { id: 'settings', label: 'Settings', detail: 'Themes, toggles, backup', icon: Settings2 },
]

const sectionFeatures = {
  overview: ['Command palette', 'Readiness checklist', 'Current work queue', 'Quick notes'],
  reports: ['Date range filters', 'Activity summaries', 'CSV export', 'Local-only reports'],
  work: ['Service intake flows', 'Quote approvals', 'Invoice nudges', 'Follow-up rules'],
  customers: ['Customer policy records', 'Workflow preferences', 'Protected fields', 'Service area notes'],
  imports: ['Microsoft sign-in', 'Read-only preview', 'Duplicate protection', 'Local encrypted token cache'],
  automations: ['Owner digest', 'Due job runner', 'Offline queue', 'Reminder controls'],
  evidence: ['Integrity manifest', 'Tamper ledger', 'Audit history', 'Protected evidence mask'],
  support: ['Support tickets', 'Legal acknowledgements', 'Support bundle', 'Contact channels'],
  tools: ['Fillable PDFs', 'Support bundles', 'Data exports', 'Restore validation'],
  accounts: ['Role manager', 'Suspension status', 'Recovery hints', 'Manager profiles'],
  licenses: ['Profile license numbers', 'Subscription numbers', 'OverHead employee register', 'Access status'],
  plans: ['Silver/Gold/Black', 'Billing profile', 'Locked features', 'Access rules'],
  payments: ['Open Stripe verify', 'Save connection', 'Import billing', 'Import payments'],
  square: ['Open browser verify', 'Save connection', 'Import locations', 'Import customers'],
  security: ['Password recovery', 'Privacy requests', 'Fraud signals', 'Compliance aggregate'],
  settings: ['Theme picker', 'Privacy default', 'Operational toggles', 'Local backup tools'],
}

const modules = [
  { id: 'schedule', label: 'Scheduling', icon: CalendarDays, status: 'Template', owner: 'Front desk', summary: 'Create scheduling work and reminders from the live work queue.' },
  { id: 'answers', label: 'Customer Answers', icon: MessageSquareText, status: 'Template', owner: 'Support', summary: 'Use this as a repeatable support-response and follow-up standard.' },
  { id: 'quotes', label: 'Quotes', icon: FileText, status: 'Template', owner: 'Owner', summary: 'Create a reviewable quote workflow and assign the next action.' },
  { id: 'invoices', label: 'Invoices', icon: ReceiptText, status: 'Template', owner: 'Bookkeeper', summary: 'Track invoice follow-up work through the live queue and support records.' },
  { id: 'followup', label: 'Follow-up', icon: MailCheck, status: 'Template', owner: 'Owner', summary: 'Create a customer follow-up task with a responsible owner.' },
]

const actions = [
  { label: 'Approve quote policy', area: 'Workflows', due: 'Today', protected: true },
  { label: 'Review customer policy record', area: 'Customers', due: 'Today', protected: true },
  { label: 'Prepare support export', area: 'Support', due: 'Optional', protected: false },
  { label: 'Run integrity snapshot', area: 'Evidence', due: 'Required', protected: false },
]

const defaultSession = {
  signedIn: false,
  ownerName: '',
  businessName: '',
  email: '',
  desktopPassword: '',
  role: 'Owner',
  acceptedTerms: false,
  recoveryPhrase: '',
  sessionId: '',
}

const emptyBackendState = {
  health: null,
  customers: [],
  customerSync: { status: 'Not synchronized', last_synced_at: '', message: '' },
  tasks: [],
  supportTickets: [],
  legalDocuments: [],
  auditEvents: [],
  settings: {},
}

function userFacingError(error, fallback) {
  const raw = String(error?.message || error || fallback)
  const message = raw
    .replace(/^Error invoking remote method '[^']+':\s*Error:\s*/i, '')
    .replace(/^Error:\s*/i, '')

  if (/OPERATION_NOT_ALLOWED|BILLING_NOT_ENABLED/i.test(message)) {
    return 'Desktop sign-in is not enabled for this OverHead account yet. Enable Email/Password sign-in in Firebase Authentication, then try again.'
  }
  if (/EMAIL_NOT_FOUND|INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD/i.test(message)) {
    return 'That email or password did not match an OverHead account.'
  }
  if (/EMAIL_EXISTS/i.test(message)) {
    return 'An account already exists for that email. Choose Sign in instead.'
  }
  if (/NETWORK_REQUEST_FAILED|fetch failed|Failed to fetch/i.test(message)) {
    return 'OverHead could not reach the sign-in service. Check your connection and try again.'
  }
  return message || fallback
}

const cylinderMode = window.overheadDesktop?.deploymentMode === 'cylinder'
const applicationName = cylinderMode ? 'OverHead Cylinder' : 'OverHead Desktop'

function App() {
  const [activeSection, setActiveSection] = useState('overview')
  const [activeModule, setActiveModule] = useState('schedule')
  const [activeLegal, setActiveLegal] = useState('Terms of Use')
  const [privacyMode, setPrivacyMode] = useState(true)
  const [integrity, setIntegrity] = useState(null)
  const [theme, setTheme] = useState('system')
  const [session, setSession] = useState(defaultSession)
  const [draftSession, setDraftSession] = useState(defaultSession)
  const [backendState, setBackendState] = useState(emptyBackendState)
  const [backendError, setBackendError] = useState('')
  const [operationNotice, setOperationNotice] = useState('')
  const [activePlan, setActivePlan] = useState('gold')
  const [commandOpen, setCommandOpen] = useState(false)
  const [opsDrawerOpen, setOpsDrawerOpen] = useState(false)
  const [launching, setLaunching] = useState(true)
  const [authMode, setAuthMode] = useState('team')
  const [verification, setVerification] = useState({ email: '', code: '', delivery: null })
  const [navLabels, setNavLabels] = useState(() => { try { return JSON.parse(window.localStorage.getItem('overhead.navLabels.v1') || '{}') } catch { return {} } })
  const [favoritePages, setFavoritePages] = useState(() => { try { return JSON.parse(window.localStorage.getItem('overhead.favoritePages.v1') || '[]') } catch { return [] } })
  const [shortcutKeys, setShortcutKeys] = useState(() => { try { return JSON.parse(window.localStorage.getItem('overhead.navShortcuts.v1') || '{}') } catch { return {} } })
  const [collapsedNavGroups, setCollapsedNavGroups] = useState(() => { try { return JSON.parse(window.localStorage.getItem('overhead.navCollapsed.v1') || '{}') } catch { return {} } })
  const [navCustomizeOpen, setNavCustomizeOpen] = useState(false)

  const selectedModule = useMemo(
    () => modules.find((module) => module.id === activeModule) ?? modules[0],
    [activeModule],
  )
  const selectedLegal = useMemo(
    () => legalDocuments.find((doc) => doc.title === activeLegal) ?? legalDocuments[0],
    [activeLegal],
  )
  const secureView = session.signedIn && !privacyMode
  const teamSections = allowedSectionsForRole(session.role)
  const navGroups = useMemo(() => {
    const visibleSections = allowedSectionsForRole(session.role)
    const groups = { Workspace: [], Operations: [], Administration: [] }
    const administration = ['accounts', 'licenses', 'plans', 'payments', 'security', 'admin-security', 'settings', 'support']
    const operations = ['scheduling', 'documents', 'collaboration', 'finance', 'people', 'rule-center', 'integrations', 'automations', 'evidence', 'imports', 'work', 'customers', 'square', 'tools']
    navSections.filter((section) => visibleSections.includes(section.id)).forEach((section) => groups[administration.includes(section.id) ? 'Administration' : operations.includes(section.id) ? 'Operations' : 'Workspace'].push(section))
    return Object.entries(groups).filter(([, items]) => items.length)
  }, [session.role])
  useEffect(() => { window.localStorage.setItem('overhead.navLabels.v1', JSON.stringify(navLabels)) }, [navLabels])
  useEffect(() => { window.localStorage.setItem('overhead.favoritePages.v1', JSON.stringify(favoritePages)) }, [favoritePages])
  useEffect(() => { window.localStorage.setItem('overhead.navShortcuts.v1', JSON.stringify(shortcutKeys)) }, [shortcutKeys])
  useEffect(() => { window.localStorage.setItem('overhead.navCollapsed.v1', JSON.stringify(collapsedNavGroups)) }, [collapsedNavGroups])
  useEffect(() => {
    const onKeyDown = (event) => {
      if (!(event.altKey && event.shiftKey) || event.ctrlKey || event.metaKey) return
      const key = event.key.toLowerCase()
      const visibleSections = allowedSectionsForRole(session.role)
      const section = navSections.find((item) => visibleSections.includes(item.id) && String(shortcutKeys[item.id] || '').toLowerCase() === key)
      if (section) { event.preventDefault(); setActiveSection(section.id) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [session.role, shortcutKeys])
  const quickCommands = [
    { id: 'today', label: 'Open Current Work', area: 'Navigation', detail: 'Jump to the dashboard queue.', action: () => setActiveSection('overview') },
    { id: 'customers', label: 'Open Customer Records', area: 'Navigation', detail: 'Review profiles and workflow rules.', action: () => setActiveSection('customers') },
    { id: 'plans', label: 'Open Billing And Plans', area: 'Navigation', detail: 'Manage Silver, Gold, Black, billing, and Stripe.', action: () => setActiveSection('plans') },
    { id: 'security', label: 'Open Security Center', area: 'Navigation', detail: 'Recovery, privacy requests, risk, and compliance.', action: () => setActiveSection('security') },
    { id: 'pdf', label: 'Create Fillable PDF', area: 'Tool', detail: 'Generate a customer intake packet.', action: async () => {
      if (!window.overheadBackend?.createFillablePdf) return
      const result = await window.overheadBackend.createFillablePdf({ customerId: backendState.customers?.[0]?.id || '', packetType: 'customer-intake' })
      setOperationNotice(`Fillable PDF created: ${result.pdfPath}`)
      await refreshBackend({ signedIn: true })
    } },
    { id: 'quote-pdf', label: 'Create Latest Quote PDF', area: 'Tool', detail: 'Generate a customer-ready quote record.', action: async () => {
      const quote = backendState.quotes?.[0]
      if (!quote) throw new Error('Create a quote before generating its PDF.')
      const result = await window.overheadBackend?.createOperationalDocument?.({ type: 'quote', id: quote.id })
      setOperationNotice(`Quote PDF created: ${result?.pdfPath || 'saved locally'}`)
      await refreshBackend({ signedIn: true })
    } },
    { id: 'invoice-pdf', label: 'Create Latest Invoice PDF', area: 'Tool', detail: 'Generate a customer-ready invoice record.', action: async () => {
      const invoice = backendState.invoices?.[0]
      if (!invoice) throw new Error('Create an invoice before generating its PDF.')
      const result = await window.overheadBackend?.createOperationalDocument?.({ type: 'invoice', id: invoice.id })
      setOperationNotice(`Invoice PDF created: ${result?.pdfPath || 'saved locally'}`)
      await refreshBackend({ signedIn: true })
    } },
    { id: 'backup', label: 'Create Backup', area: 'Tool', detail: 'Write a local encrypted backup.', action: async () => {
      if (!window.overheadBackend?.createBackup) return
      const result = await window.overheadBackend.createBackup()
      setOperationNotice(`Backup created: ${result.backupPath}`)
      await refreshBackend({ signedIn: true })
    } },
  ]

  useEffect(() => {
    const saved = window.localStorage.getItem('overhead.profile.v1')
    if (saved) {
      try {
        const parsed = { ...defaultSession, ...JSON.parse(saved) }
        setDraftSession({ ...parsed, signedIn: false, desktopPassword: '', recoveryPhrase: '', sessionId: '' })
      } catch {
        window.localStorage.removeItem('overhead.profile.v1')
      }
    }
    setTheme(window.localStorage.getItem('overhead.theme.v1') || 'system')
    const reducedMotionPreference = window.localStorage.getItem('overhead.reduceMotion.v1')
    document.documentElement.dataset.reducedMotion = reducedMotionPreference === null
      ? String(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false)
      : reducedMotionPreference
    if (window.overheadBackend?.health) {
      window.overheadBackend.health()
        .then((health) => setBackendState({ ...emptyBackendState, health }))
        .catch((error) => setBackendError(userFacingError(error, 'Backend unavailable.')))
    }
    if (window.overheadBackend?.rememberedSignIn) {
      window.overheadBackend.rememberedSignIn()
        .then((remembered) => {
          if (!remembered?.email) return
          setDraftSession((current) => ({
            ...current,
            ownerName: remembered.ownerName || current.ownerName,
            businessName: remembered.businessName || current.businessName,
            email: remembered.email,
            role: remembered.role || current.role,
            signedIn: false,
            desktopPassword: '',
            recoveryPhrase: '',
            sessionId: '',
          }))
        })
        .catch(() => {})
    }
    if (window.overheadBackend?.resumeSession) {
      window.overheadBackend.resumeSession()
        .then((rememberedSession) => {
          if (!rememberedSession?.signedIn) return
          const next = { ...defaultSession, ...rememberedSession, desktopPassword: '', recoveryPhrase: '' }
          setSession(next)
          setDraftSession(next)
          setPrivacyMode(false)
          setActiveSection('overview')
          window.localStorage.setItem('overhead.profile.v1', JSON.stringify({
            ownerName: next.ownerName,
            businessName: next.businessName,
            email: next.email,
            role: next.role,
            acceptedTerms: next.acceptedTerms,
          }))
          return window.overheadBackend.bootstrap()
            .then((bootstrap) => setBackendState({ ...emptyBackendState, ...bootstrap }))
        })
        .catch((error) => setBackendError(userFacingError(error, 'Could not restore the previous session.')))
    }
    const launchTimer = window.setTimeout(() => setLaunching(false), 1200)
    return () => window.clearTimeout(launchTimer)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('overhead.theme.v1', theme)
    if (window.overheadBackend?.updateSetting) {
      window.overheadBackend.updateSetting({ key: 'theme', value: theme }).catch(() => {})
    }
  }, [theme])

  useEffect(() => {
    if (!window.overheadDesktop?.onSecurityLock) return undefined
    return window.overheadDesktop.onSecurityLock(() => lockSession())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  useEffect(() => {
    function handleEscape(event) {
      if (event.key !== 'Escape') return
      if (commandOpen) setCommandOpen(false)
      if (opsDrawerOpen) setOpsDrawerOpen(false)
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [commandOpen, opsDrawerOpen])

  useEffect(() => {
    if (!window.overheadDesktop?.integrityReport) return
    window.overheadDesktop.integrityReport()
      .then((report) => setIntegrity(report))
      .catch(() => setIntegrity({ status: 'attention', files: [], notes: ['Integrity report failed.'] }))
  }, [])

  function updateDraft(key, value) {
    setDraftSession((current) => ({ ...current, [key]: value }))
  }

  async function refreshBackend(options = {}) {
    if (!window.overheadBackend?.bootstrap) return
    try {
      if (!(options.signedIn ?? session.signedIn)) {
        const health = await window.overheadBackend.health()
        setBackendState({ ...emptyBackendState, health })
        setBackendError('')
        return
      }
      const bootstrap = await window.overheadBackend.bootstrap()
      setBackendState({ ...emptyBackendState, ...bootstrap })
      setBackendError('')
    } catch (error) {
      setBackendError(userFacingError(error, 'Backend unavailable.'))
    }
  }

  async function signIn() {
    try {
      const accessLane = authMode === 'customer' || authMode === 'customer-enroll' ? 'customer' : authMode === 'team' ? 'team' : ''
      const authPayload = { ...draftSession, selectedTier: activePlan, accessLane }
      const authenticated = window.overheadBackend?.signIn
        ? authMode === 'create'
          ? await window.overheadBackend.register(authPayload)
          : authMode === 'customer-enroll'
            ? await window.overheadBackend.registerCustomerAccess(authPayload)
            : await window.overheadBackend.signIn(authPayload)
        : { ...draftSession, signedIn: true, acceptedTerms: Boolean(draftSession.acceptedTerms) }
      if (authenticated.verificationRequired) {
        setVerification({ email: authenticated.email, code: '', delivery: authenticated.delivery || null })
        setAuthMode('verify')
        setBackendError('')
        return
      }
      await openSession(authenticated)
    } catch (error) {
      setBackendError(userFacingError(error, 'Sign-in failed.'))
    }
  }

  async function verifyEmail() {
    try {
      const authenticated = await window.overheadBackend.verifyEmail({
        email: verification.email || draftSession.email,
        code: verification.code,
        desktopPassword: draftSession.desktopPassword,
      })
      setVerification({ email: '', code: '', delivery: null })
      await openSession(authenticated)
    } catch (error) {
      setBackendError(userFacingError(error, 'Verification failed.'))
    }
  }

  async function openSession(authenticated) {
      const next = {
        ...defaultSession,
        ...authenticated,
        desktopPassword: '',
        recoveryPhrase: '',
      }
      setSession(next)
      setDraftSession(next)
      setPrivacyMode(false)
      setActiveSection('overview')
      window.localStorage.setItem('overhead.profile.v1', JSON.stringify({
        ownerName: next.ownerName,
        businessName: next.businessName,
        email: next.email,
        role: next.role,
        acceptedTerms: next.acceptedTerms,
      }))
      await refreshBackend({ signedIn: true })
  }

  async function powerCycle() {
    try {
      await window.overheadDesktop?.powerCycle?.()
    } catch (error) {
      setBackendError(userFacingError(error, 'Could not restart OverHead.'))
    }
  }

  async function lockSession() {
    if (window.overheadBackend?.lockSession) {
      try {
        await window.overheadBackend.lockSession(session.sessionId)
      } catch {
        // Renderer still locks even if audit write fails.
      }
    }
    const next = { ...session, signedIn: false, desktopPassword: '', sessionId: '' }
    setSession(next)
    setDraftSession(next)
    setPrivacyMode(true)
    window.localStorage.setItem('overhead.profile.v1', JSON.stringify({
      ownerName: next.ownerName,
      businessName: next.businessName,
      email: next.email,
      role: next.role,
      acceptedTerms: next.acceptedTerms,
    }))
    refreshBackend()
  }

  async function runCommand(command) {
    setCommandOpen(false)
    await command.action()
  }

  if (launching) {
    return <SplashScreen theme={theme} />
  }

  if (!session.signedIn) {
    return (
      <LoginScreen
        draftSession={draftSession}
        updateDraft={updateDraft}
        signIn={signIn}
        theme={theme}
        setTheme={setTheme}
        backendError={backendError}
        authMode={authMode}
        setAuthMode={setAuthMode}
        activePlan={activePlan}
        setActivePlan={setActivePlan}
        verification={verification}
        setVerification={setVerification}
        verifyEmail={verifyEmail}
      />
    )
  }

  if (session.role === 'Customer') return <CustomerSupportPortal session={session} lockSession={lockSession} />

  return (
    <div className="desktop-app">
      <header className="desktop-chrome">
        <div className="chrome-title">
          <span className="chrome-dot" />
          <strong>{applicationName}</strong>
          <span>Local-first office workspace</span>
          <span>Owner-controlled desktop app</span>
        </div>
        <div className="chrome-status">
          <span>{secureView ? 'Workspace unlocked' : 'Privacy screen active'}</span>
          <span title="A second launch brings this window forward instead of opening another one.">One window</span>
          <button type="button" onClick={powerCycle}>Power cycle</button>
          <button type="button" onClick={lockSession}>Lock</button>
        </div>
      </header>

      <div className="desktop-body">
        <aside className="sidebar" aria-label="Primary">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">OH</div>
            <div>
              <strong>OverHead</strong>
              <span>Owner-controlled workspace</span>
            </div>
          </div>

          <nav className="nav-list">
            <button className="ghost-button" type="button" onClick={() => setNavCustomizeOpen((open) => !open)} aria-expanded={navCustomizeOpen}>{navCustomizeOpen ? 'Close navigation editor' : 'Customize navigation'}</button>
            {favoritePages.filter((id) => teamSections.includes(id)).length > 0 && <div className="nav-group"><strong>Favorites</strong>{favoritePages.filter((id) => teamSections.includes(id)).map((id) => { const section = navSections.find((item) => item.id === id); if (!section) return null; const Icon = section.icon; return <button className={section.id === activeSection ? 'nav-item active' : 'nav-item'} type="button" key={`favorite-${id}`} onClick={() => setActiveSection(id)}><Icon size={18}/><span><strong>{navLabels[id] || section.label}</strong><small>Favorite page</small></span></button> })}</div>}
            {navCustomizeOpen && <details className="nav-customizer" open><summary>Labels, favorites and shortcuts</summary>{navSections.filter((section) => teamSections.includes(section.id)).map((section) => <div key={`pref-${section.id}`}><label>{section.label}<input aria-label={`Custom label for ${section.label}`} maxLength={28} value={navLabels[section.id] || ''} placeholder={section.label} onChange={(event) => setNavLabels((current) => ({ ...current, [section.id]: event.target.value }))}/></label><label><input type="checkbox" checked={favoritePages.includes(section.id)} onChange={(event) => setFavoritePages((current) => event.target.checked ? [...new Set([...current, section.id])] : current.filter((id) => id !== section.id))}/>Favorite</label><label>Alt+Shift+<input aria-label={`Shortcut key for ${section.label}`} maxLength={1} value={shortcutKeys[section.id] || ''} onChange={(event) => setShortcutKeys((current) => { const key = event.target.value.slice(-1); const next = Object.fromEntries(Object.entries(current).filter(([id, assigned]) => id === section.id || !key || String(assigned).toLowerCase() !== key.toLowerCase())); return { ...next, [section.id]: key } })}/></label></div>)}</details>}
            {navGroups.map(([group, groupSections]) => <div className="nav-group" key={group}><button className="nav-group-heading" type="button" aria-expanded={!collapsedNavGroups[group]} onClick={() => setCollapsedNavGroups((current) => ({ ...current, [group]: !current[group] }))}>{group}</button>{!collapsedNavGroups[group] && groupSections.map((section) => {
              const Icon = section.icon
              const badge = navBadge(section.id, backendState)
              return (
                <button
                  className={section.id === activeSection ? 'nav-item active' : 'nav-item'}
                  type="button"
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                >
                  <Icon size={18} />
                  <span>
                    <strong>{navLabels[section.id] || section.label}</strong>
                    <small>{section.detail}</small>
                  </span>
                  {badge && <em>{badge}</em>}
                </button>
              )
            })}</div>)}
          </nav>

          <div className="sidebar-account">
            <div className="avatar">{initials(session.ownerName || session.email || 'OH')}</div>
            <div>
              <strong>{session.ownerName || 'OverHead Team member'}</strong>
              <span>{session.businessName || 'Workspace profile pending'}</span>
            </div>
          </div>

          <div className="sidebar-status">
            <BadgeCheck size={18} />
            <div>
              <strong>Local-first desktop mode</strong>
              <span>{displayRole(session.role)} access</span>
            </div>
          </div>
        </aside>

        <main className="workspace">
          <header className="command-bar">
            <div>
              <p className="eyebrow">{activeSection === 'overview' ? 'Today in OverHead' : 'Workspace'}</p>
              <h1>{sectionTitle(activeSection)}</h1>
            </div>
            <div className="top-actions">
              <label className="searchbox">
                <Search size={17} />
                <input aria-label="Open OverHead commands" aria-haspopup="dialog" readOnly placeholder="Search records, workflows, support" onFocus={() => setCommandOpen(true)} onClick={() => setCommandOpen(true)} />
              </label>
              <button className="ghost-button" type="button" onClick={() => setCommandOpen(true)}>
                <Search size={17} />
                Commands
              </button>
              <StatusPill icon={ShieldCheck} label={integrity?.status === 'clean' ? 'Integrity clean' : 'Integrity check'} />
              <button className="ghost-button" type="button" onClick={() => setPrivacyMode((value) => !value)}>
                {privacyMode ? <EyeOff size={17} /> : <Eye size={17} />}
                {privacyMode ? 'Privacy on' : 'Privacy off'}
              </button>
              <button className="icon-button" type="button" aria-label="Operations drawer" onClick={() => setOpsDrawerOpen((value) => !value)}><Bell size={18} /></button>
            </div>
          </header>

          <section className="workspace-content">
            {activeSection === 'overview' && (
              <OverviewSection
                session={session}
                secureView={secureView}
                integrity={integrity}
                backendState={backendState}
                refreshBackend={refreshBackend}
                setOperationNotice={setOperationNotice}
              />
            )}
            {activeSection === 'reports' && <><ReportsSection backendState={backendState} /><ReportStudio backendState={backendState} sessionRole={session.role} setOperationNotice={setOperationNotice} /></>}
            {activeSection === 'growth' && <GrowthWorkspace session={session} />}
            {activeSection === 'sales-growth' && <SalesWorkspace backendState={backendState} refreshBackend={refreshBackend} setOperationNotice={setOperationNotice} />}
            {activeSection === 'customer-management' && <CustomerManagementWorkspace backendState={backendState} secureView={secureView} />}
            {activeSection === 'field-assist' && <FieldAssistSection backendState={backendState} session={session} setOperationNotice={setOperationNotice} />}
            {activeSection === 'scheduling' && <SchedulingWorkspace backendState={backendState} setOperationNotice={setOperationNotice} />}
            {activeSection === 'documents' && <DocumentControlWorkspace backendState={backendState} setOperationNotice={setOperationNotice} refreshBackend={refreshBackend} />}
            {activeSection === 'collaboration' && <CollaborationWorkspace backendState={backendState} session={session} setOperationNotice={setOperationNotice} />}
            {activeSection === 'finance' && <CustomerFinanceWorkspace backendState={backendState} setOperationNotice={setOperationNotice} />}
            {activeSection === 'people' && <PeopleOperationsWorkspace backendState={backendState} setOperationNotice={setOperationNotice} />}
            {activeSection === 'rule-center' && <AutomationStudio backendState={backendState} sessionRole={session.role} setOperationNotice={setOperationNotice} refreshBackend={refreshBackend} />}
            {activeSection === 'integrations' && <IntegrationStudio backendState={backendState} sessionRole={session.role} refreshBackend={refreshBackend} setOperationNotice={setOperationNotice} />}
            {activeSection === 'search' && <ControlCenter area="search" backendState={backendState} session={session} setOperationNotice={setOperationNotice} />}
            {activeSection === 'admin-security' && <ControlCenter area="security" backendState={backendState} session={session} setOperationNotice={setOperationNotice} />}
            {activeSection === 'work' && (
              <WorkflowsSection
                activeModule={activeModule}
                selectedModule={selectedModule}
                setActiveModule={setActiveModule}
                refreshBackend={refreshBackend}
                setOperationNotice={setOperationNotice}
              />
            )}
            {activeSection === 'customers' && (
              <CustomersSection
                secureView={secureView}
                customers={backendState.customers}
                backendState={backendState}
                refreshBackend={refreshBackend}
                setOperationNotice={setOperationNotice}
              />
            )}
            {activeSection === 'imports' && (
              <ImportsSection
                backendState={backendState}
                refreshBackend={refreshBackend}
                setOperationNotice={setOperationNotice}
              />
            )}
            {activeSection === 'automations' && (
              <AutomationsSection
                backendState={backendState}
                refreshBackend={refreshBackend}
                setOperationNotice={setOperationNotice}
              />
            )}
            {activeSection === 'evidence' && <EvidenceSection integrity={integrity} secureView={secureView} backendState={backendState} />}
            {activeSection === 'support' && (
              <SupportSection
                activeLegal={activeLegal}
                selectedLegal={selectedLegal}
                setActiveLegal={setActiveLegal}
                session={session}
                backendState={backendState}
                refreshBackend={refreshBackend}
                setOperationNotice={setOperationNotice}
              />
            )}
            {activeSection === 'tools' && (
              <ToolsSection
                backendState={backendState}
                refreshBackend={refreshBackend}
                setOperationNotice={setOperationNotice}
                operationNotice={operationNotice}
              />
            )}
            {activeSection === 'accounts' && (
              <AccountsSection
                backendState={backendState}
                session={session}
                refreshBackend={refreshBackend}
                setOperationNotice={setOperationNotice}
              />
            )}
            {activeSection === 'licenses' && (
              <LicensesSection
                backendState={backendState}
                refreshBackend={refreshBackend}
                setOperationNotice={setOperationNotice}
              />
            )}
            {activeSection === 'plans' && (
              <PlansSection
                backendState={backendState}
                activePlan={activePlan}
                setActivePlan={setActivePlan}
                draftSession={draftSession}
                refreshBackend={refreshBackend}
                setOperationNotice={setOperationNotice}
              />
            )}
            {activeSection === 'payments' && (
              <PaymentsSection
                backendState={backendState}
                refreshBackend={refreshBackend}
                setOperationNotice={setOperationNotice}
              />
            )}
            {activeSection === 'square' && (
              <SquareSection
                backendState={backendState}
                refreshBackend={refreshBackend}
                setOperationNotice={setOperationNotice}
              />
            )}
            {activeSection === 'security' && (
              <SecuritySection
                backendState={backendState}
                refreshBackend={refreshBackend}
                setOperationNotice={setOperationNotice}
              />
            )}
            {activeSection === 'settings' && (
              <SettingsSection
                theme={theme}
                setTheme={setTheme}
                privacyMode={privacyMode}
                setPrivacyMode={setPrivacyMode}
                session={session}
                draftSession={draftSession}
                updateDraft={updateDraft}
                signIn={signIn}
                backendState={backendState}
                refreshBackend={refreshBackend}
                operationNotice={operationNotice}
                setOperationNotice={setOperationNotice}
                activePlan={activePlan}
                setActivePlan={setActivePlan}
              />
            )}
          </section>
        </main>
      </div>
      {commandOpen && (
        <CommandCenter
          commands={quickCommands}
          onRun={runCommand}
          onClose={() => setCommandOpen(false)}
          backendState={backendState}
        />
      )}
      {opsDrawerOpen && (
        <OperationsDrawer
          backendState={backendState}
          integrity={integrity}
          operationNotice={operationNotice}
          onClose={() => setOpsDrawerOpen(false)}
          setActiveSection={setActiveSection}
        />
      )}
    </div>
  )
}

function CommandCenter({ commands, onRun, onClose, backendState }) {
  return (
    <div className="command-overlay" role="presentation" onMouseDown={onClose}>
      <section className="command-center" role="dialog" aria-label="OverHead command center" onMouseDown={(event) => event.stopPropagation()}>
        <div className="section-head tight">
          <div>
            <p className="eyebrow">Command Center</p>
            <h2>Move fast without hunting</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Close command center" onClick={onClose}>Ã—</button>
        </div>
        <div className="command-search-readout">
          <Search size={17} />
          <span>{backendState.health?.customerCount ?? 0} customers</span>
          <span>{backendState.health?.queuedJobCount ?? 0} queued jobs</span>
          <span>{backendState.health?.openFraudSignalCount ?? 0} risk signals</span>
        </div>
        <div className="command-list">
          {commands.map((command) => (
            <button type="button" key={command.id} onClick={() => onRun(command)}>
              <span>{command.area}</span>
              <strong>{command.label}</strong>
              <small>{command.detail}</small>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

function OperationsDrawer({ backendState, integrity, operationNotice, onClose, setActiveSection }) {
  const health = backendState.health || {}
  const activePlan = backendState.entitlements?.activePlan || {}
  const metrics = [
    { label: 'Tier', value: activePlan.name || 'Silver', detail: activePlan.level || 'Basic' },
    { label: 'Store', value: health.encryptedAtRest ? 'Encrypted' : 'Pending', detail: health.databaseExists ? 'Online' : 'Waiting' },
    { label: 'Billing', value: `${health.billingProfileCount ?? 0}`, detail: 'profiles' },
    { label: 'Stripe', value: `${health.stripeConnectionCount ?? 0}`, detail: 'connections' },
    { label: 'PDFs', value: `${health.pdfCount ?? 0}`, detail: 'generated' },
    { label: 'Risk', value: `${health.openFraudSignalCount ?? 0}`, detail: 'open signals' },
  ]

  function jump(section) {
    setActiveSection(section)
    onClose()
  }

  return (
    <aside className="ops-drawer" aria-label="Operations drawer">
      <div className="section-head tight">
        <div>
          <p className="eyebrow">Live Desk</p>
          <h2>Operations drawer</h2>
        </div>
        <button className="icon-button" type="button" aria-label="Close operations drawer" onClick={onClose}>Ã—</button>
      </div>
      <div className="ops-metrics">
        {metrics.map((metric) => (
          <article key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </article>
        ))}
      </div>
      <div className="drawer-stack">
        <button type="button" onClick={() => jump('plans')}>
          <BadgeCheck size={17} />
          <span>Plans, billing, Stripe</span>
        </button>
        <button type="button" onClick={() => jump('tools')}>
          <BriefcaseBusiness size={17} />
          <span>PDFs and office utilities</span>
        </button>
        <button type="button" onClick={() => jump('security')}>
          <ShieldCheck size={17} />
          <span>Recovery and compliance</span>
        </button>
        <button type="button" onClick={() => jump('settings')}>
          <Settings2 size={17} />
          <span>Toggles and backups</span>
        </button>
      </div>
      <div className="drawer-note">
        <strong>{integrity?.status === 'clean' ? 'Runtime clean' : 'Runtime checking'}</strong>
        <span role="status" aria-live="polite">{operationNotice || 'No recent operation notice.'}</span>
      </div>
    </aside>
  )
}

function FeatureRail({ activeSection, backendState }) {
  const features = sectionFeatures[activeSection] || []
  const health = backendState.health || {}
  const summary = {
    overview: `${health.taskCount ?? 0} tasks`,
    work: `${health.queuedJobCount ?? 0} queued`,
    customers: `${health.customerCount ?? 0} records`,
    automations: `${health.queuedJobCount ?? 0} jobs`,
    evidence: `${backendState.auditEvents?.length ?? 0} events`,
    support: `${backendState.supportTickets?.length ?? 0} tickets`,
    tools: `${health.pdfCount ?? 0} PDFs`,
    accounts: `${backendState.userProfiles?.length ?? 0} users`,
    plans: backendState.entitlements?.activePlan?.name || 'Silver',
    payments: `${backendState.stripeConnections?.length ?? 0} Stripe`,
    square: `${backendState.squareConnections?.length ?? 0} Square`,
    security: `${health.openFraudSignalCount ?? 0} risks`,
    settings: `${Object.keys(backendState.appToggles || {}).length} toggles`,
  }[activeSection]

  return (
    <div className="feature-rail" aria-label="Section features">
      <strong>{summary}</strong>
      {features.map((feature) => <span key={feature}>{feature}</span>)}
    </div>
  )
}

function navBadge(section, backendState) {
  const health = backendState.health || {}
  const values = {
    overview: health.taskCount,
    work: 5,
    customers: health.customerCount,
    automations: health.queuedJobCount,
    evidence: backendState.auditEvents?.length,
    support: backendState.supportTickets?.length,
    tools: health.pdfCount,
    accounts: backendState.userProfiles?.length,
    plans: backendState.entitlements?.activePlan?.name || health.activeTier,
    payments: backendState.stripeConnections?.length,
    square: backendState.squareConnections?.length,
    security: health.openFraudSignalCount,
    settings: Object.keys(backendState.appToggles || {}).length,
  }
  const value = values[section]
  if (value === undefined || value === null || value === 0) return ''
  return String(value).slice(0, 8)
}

function SplashScreen({ theme }) {
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return (
    <main className="splash-screen">
      <section className="splash-core" aria-label="OverHead loading">
        <div className="brand-mark large" aria-hidden="true">OH</div>
        <div>
          <p className="eyebrow">OverHead Desktop</p>
          <h1>Loading workspace</h1>
          <span>Starting local store, recovery guard, and privacy controls.</span>
        </div>
        <div className="splash-progress" aria-hidden="true"><span /></div>
      </section>
    </main>
  )
}

function LoginScreen({ draftSession, updateDraft, signIn, theme, setTheme, backendError, authMode, setAuthMode, activePlan, setActivePlan, verification, setVerification, verifyEmail }) {
  const isCreate = authMode === 'create'
  const isTeam = authMode === 'team' || authMode === 'manager' || authMode === 'staff' || authMode === 'sign-in'
  const isCustomer = authMode === 'customer' || authMode === 'customer-enroll'
  const isCustomerEnroll = authMode === 'customer-enroll'
  const isPlans = authMode === 'plans'
  const isHelp = authMode === 'help'
  const isVerify = authMode === 'verify'
  function choosePlan(planId) {
    setActivePlan(planId)
    setAuthMode('create')
  }
  return (
    <main className="login-screen">
      <section className="login-brand-panel">
        <div className="brand lockup">
          <div className="brand-mark" aria-hidden="true">OH</div>
          <div>
            <strong>{applicationName}</strong>
            <span>{cylinderMode ? 'Windows Server and Windows IoT workspace' : 'Installed Windows application'}</span>
          </div>
        </div>
        <h1>Open the work. Keep it moving.</h1>
        <p>
          OverHead helps a small office see the next action, keep its context, and retain control of sensitive decisions without forcing an enterprise-sized system on the team.
        </p>
        <div className="login-command-stack">
          <Proof title="Clarity" text="See what needs an answer, approval, payment nudge, or follow-upâ€”and who owns it." />
          <Proof title="Control" text="Keep important customer context close while roles and review points protect sensitive changes." />
          <Proof title="Recovery" text="Use local backups, support bundles, and activity history to understand and resolve problems." />
        </div>
      </section>

      <section className="login-card" aria-label="OverHead sign in">
        <div className="login-tabs">
          <button className={isCustomer ? 'active' : ''} type="button" onClick={() => setAuthMode('customer')}>Customer Access</button>
          <button className={isTeam ? 'active' : ''} type="button" onClick={() => setAuthMode('team')}>OverHead Team</button>
          <button className={isCreate ? 'active' : ''} type="button" onClick={() => setAuthMode('create')}>Create Workspace</button>
          <button className={isPlans ? 'active' : ''} type="button" onClick={() => setAuthMode('plans')}>Plans</button>
          <button className={isHelp ? 'active' : ''} type="button" onClick={() => setAuthMode('help')}>Help</button>
        </div>
        {isPlans ? (
          cylinderMode ? <CylinderPlanPanel /> : <PublicPlans activePlan={activePlan} choosePlan={choosePlan} />
        ) : isVerify ? (
          <VerificationPanel
            verification={verification}
            setVerification={setVerification}
            verifyEmail={verifyEmail}
            backendError={backendError}
            returnToSignIn={() => { setVerification({ email: '', code: '', delivery: null }); setAuthMode('team') }}
          />
        ) : isHelp ? (
          <PublicHelp />
        ) : (
          <>
        <h2>{isCreate ? 'Create workspace' : isCustomerEnroll ? 'Create customer account' : isCustomer ? 'Customer access' : 'OverHead Team access'}</h2>
        <p>{isCreate
          ? cylinderMode ? 'Create the shared account for this Cylinder host. Evaluation and activation details are available under Plans after sign-in.' : `Selected plan: ${selectedPlanName(activePlan)}. This creates the shared website and desktop workspace account.`
          : isCustomer
            ? isCustomerEnroll ? 'Use the workspace code in your OverHead customer invitation to activate your separate customer account.' : 'Use the customer account issued by your service team. Customer access is kept separate from internal office records and controls.'
            : 'For Members, Managers, and Administrators. Your role controls the dashboard tools you can open after sign-in.'}</p>
        {isCreate && (
          <>
            <FormField label="Owner Name" value={draftSession.ownerName} onChange={(value) => updateDraft('ownerName', value)} placeholder="Owner name" />
            <FormField label="Business Name" value={draftSession.businessName} onChange={(value) => updateDraft('businessName', value)} placeholder="Business name" />
          </>
        )}
        <div className="access-lane-note" role="status">
          <strong>{isCustomer ? 'Customer account required' : 'Team account required'}</strong>
          <span>{isCustomer ? 'Customer Members can request support without opening the internal office console.' : 'Members use daily work and support tools. Managers add team operations. Administrators control people, plans, billing, and settings.'}</span>
        </div>
        <FormField label="Email Address" value={draftSession.email} onChange={(value) => updateDraft('email', value)} placeholder={isCustomer ? 'customer@example.com' : 'team@example.com'} />
        {isCustomerEnroll && <FormField label="Workspace code" value={draftSession.workspaceId || ''} onChange={(value) => updateDraft('workspaceId', value)} placeholder="Code from your invitation" />}
        <label>
          Desktop Password
          <input
            type="password"
            value={draftSession.desktopPassword}
            onChange={(event) => updateDraft('desktopPassword', event.target.value)}
            placeholder={isCreate ? 'Minimum 12 characters' : isCustomer ? 'Enter customer password' : 'Enter team password'}
            minLength={isCreate ? 12 : undefined}
          />
        </label>
        {isCreate && <label className="checkbox-line">
          <input type="checkbox" checked={draftSession.acceptedTerms} onChange={(event) => updateDraft('acceptedTerms', event.target.checked)} />
          I accept the Terms of Use and Privacy Notice for this shared workspace.
        </label>}
        <button className="primary-action full" type="button" onClick={signIn}>{isCreate ? 'Create Workspace' : isCustomerEnroll ? 'Create Customer Account' : isCustomer ? 'Open Customer Support' : 'Open Team Workspace'}</button>
        {authMode === 'customer' && <button className="ghost-button full" type="button" onClick={() => setAuthMode('customer-enroll')}>Create customer account from invitation</button>}
        {isCustomerEnroll && <button className="ghost-button full" type="button" onClick={() => setAuthMode('customer')}>I already have a customer account</button>}
        {backendError && <p className="form-error" role="alert">{backendError}</p>}
        <label className="theme-picker wide">
          Theme
          <select value={theme} onChange={(event) => setTheme(event.target.value)}>
            {themes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <small>OverHead remembers your account name, workspace, email, and role in encrypted local storage. It never saves your raw password.</small>
          </>
        )}
      </section>
    </main>
  )
}

function VerificationPanel({ verification, setVerification, verifyEmail, backendError, returnToSignIn }) {
  const sharedVerification = verification.delivery?.channel === 'firebase-link'
  return (
    <>
      <h2>Check your email</h2>
      <p>{sharedVerification ? `We sent a verification link to ${verification.email || 'your email'}. Open it in your default browser, then return and sign in again.` : `Enter the 6-digit code sent to ${verification.email || 'your email'} before the desk opens.`}</p>
      {verification.delivery?.channel === 'local-outbox' && (
        <p className="form-error">Email is queued locally because SMTP is not connected: {verification.delivery.outboxPath}</p>
      )}
      {!sharedVerification && <><FormField label="Verification code" value={verification.code} onChange={(value) => setVerification((current) => ({ ...current, code: value }))} placeholder="6-digit code" /><button className="primary-action full" type="button" onClick={verifyEmail}>Verify And Open</button></>}
      {sharedVerification && <button className="primary-action full" type="button" onClick={returnToSignIn}>Return To Sign In</button>}
      {backendError && <p className="form-error" role="alert">{backendError}</p>}
    </>
  )
}

function CustomerSupportPortal({ session, lockSession }) {
  const [subject, setSubject] = useState('')
  const [details, setDetails] = useState('')
  const [notice, setNotice] = useState('')
  async function sendRequest() {
    if (!subject.trim() || !details.trim()) { setNotice('Add a subject and short description before sending.'); return }
    try { await window.overheadBackend.createSupportTicket({ subject, details, priority: 'Normal' }); setSubject(''); setDetails(''); setNotice('Your request was sent to the OverHead Team.') } catch (error) { setNotice(userFacingError(error, 'Your request could not be sent.')) }
  }
  return <main className="login-screen"><section className="login-brand-panel"><div className="brand lockup"><div className="brand-mark">OH</div><div><strong>OverHead Customer Support</strong><span>Separate customer access</span></div></div><h1>Get help without entering the internal workspace.</h1><p>Your customer page is kept separate from staff records, billing controls, and office tools.</p></section><section className="login-card"><h2>Customer support</h2><p>Welcome, {session.ownerName || session.email}. Tell the OverHead Team what you need help with. Do not include passwords, card numbers, recovery codes, or tax identifiers.</p><FormField label="Subject" value={subject} onChange={setSubject} placeholder="What do you need help with?" /><FormField label="Details" value={details} onChange={setDetails} placeholder="Short description of the issue" /><button className="primary-action full" type="button" onClick={sendRequest}>Send Support Request</button><button className="ghost-button" type="button" onClick={lockSession}>Sign Out</button>{notice && <p className="form-error">{notice}</p>}</section></main>
}

function PublicPlans({ activePlan, choosePlan }) {
  return (
    <>
      <h2>Choose the desk size</h2>
      <p>Selecting a tier starts registration. Workspace data stays locked until an account signs in.</p>
      <div className="public-plan-stack">
        {planTiers.map((plan) => (
          <button className={activePlan === plan.id ? 'public-plan active' : 'public-plan'} type="button" key={plan.id} onClick={() => choosePlan(plan.id)}>
            <strong>{plan.name}</strong>
            <span>{plan.level} - {plan.price}</span>
            <p>{plan.summary}</p>
            <small>{plan.features.slice(0, 4).join(' / ')}</small>
          </button>
        ))}
      </div>
    </>
  )
}

function PublicHelp() {
  return (
    <>
      <h2>Help center</h2>
      <p>Startup help, account recovery, plan basics, and developer escalation.</p>
      <div className="help-article-stack">
        {helpArticles.map((article) => (
          <article key={article.title}>
            <span>{article.category}</span>
            <strong>{article.title}</strong>
            <p>{article.body}</p>
          </article>
        ))}
      </div>
    </>
  )
}

const dashboardWidgets = [
  ['status', 'Workspace status cards'],
  ['profile', 'Workspace profile'],
  ['standards', 'Operating principles'],
  ['queue', 'Current work queue'],
  ['checklist', 'Office readiness checklist'],
  ['live-operations', 'Create appointments, quotes, and invoices'],
  ['records', 'Operational records'],
  ['compliance', 'Review badges'],
]

function readDashboardWidgetPreferences() {
  try {
    const saved = JSON.parse(window.localStorage.getItem('overhead.dashboard.widgets.v1') || 'null')
    if (Array.isArray(saved)) {
      const valid = new Set(dashboardWidgets.map(([id]) => id))
      const selected = saved.filter((id) => valid.has(id))
      return selected.length ? selected : dashboardWidgets.map(([id]) => id)
    }
  } catch {}
  return dashboardWidgets.map(([id]) => id)
}

function ReportsSection({ backendState }) {
  const [recordType, setRecordType] = useState('invoices')
  const [period, setPeriod] = useState('30')
  const records = backendState[recordType] || []
  const cutoff = period === 'all' ? 0 : Date.now() - Number(period) * 86400000
  const rows = records.filter((record) => {
    const date = Date.parse(record.created_at || record.updated_at || record.scheduled_for || record.due_at || '')
    return !cutoff || (Number.isFinite(date) && date >= cutoff)
  })
  const total = rows.reduce((sum, record) => sum + (Number(record.amount) || 0), 0)
  const statuses = rows.reduce((counts, record) => {
    const status = String(record.status || 'Unspecified')
    counts[status] = (counts[status] || 0) + 1
    return counts
  }, {})
  function downloadCsv() {
    const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const data = [
      ['Record ID', 'Title', 'Status', 'Date', 'Amount'],
      ...rows.map((record) => [record.id, record.title || record.label, record.status, record.created_at || record.updated_at || record.scheduled_for || record.due_at, record.amount]),
    ].map((row) => row.map(quote).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([`\uFEFF${data}`], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `overhead-${recordType}-report-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }
  return (
    <section className="reports-page">
      <div className="panel action-panel">
        <div className="section-head"><div><p className="eyebrow">Workspace reporting</p><h2>Activity report</h2></div><BarChart3 size={18} /></div>
        <p>Review a local summary of operational records, then export the filtered rows as a spreadsheet-ready CSV.</p>
        <div className="report-controls">
          <label>Record type<select value={recordType} onChange={(event) => setRecordType(event.target.value)}><option value="invoices">Invoices</option><option value="quotes">Quotes</option><option value="appointments">Appointments</option><option value="tasks">Tasks</option></select></label>
          <label>Date range<select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All available records</option></select></label>
          <button className="primary-action" type="button" onClick={downloadCsv} disabled={!rows.length}>Export CSV</button>
        </div>
        <div className="dashboard-grid report-metrics">
          <StatusCard icon={FileText} title="Matching records" value={String(rows.length)} note={`From ${records.length} available ${recordType}.`} />
          <StatusCard icon={ReceiptText} title="Recorded value" value={`$${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} note="Sum of amounts stored on matching records." />
          <StatusCard icon={CheckCircle2} title="Statuses" value={String(Object.keys(statuses).length)} note="Distinct statuses in this report." />
        </div>
        {rows.length ? <div className="report-status-list">{Object.entries(statuses).map(([status, count]) => <span key={status}><strong>{status}</strong>{count}</span>)}</div> : <p className="queue-empty">No {recordType} match this date range.</p>}
        <p className="form-hint">This report reads the current OverHead workspace. CSV files are saved to your device when exported.</p>
      </div>
    </section>
  )
}

function OverviewSection({ session, secureView, integrity, backendState, refreshBackend, setOperationNotice }) {
  const queue = backendState.tasks.length ? backendState.tasks : actions
  const health = backendState.health
  const [quickNote, setQuickNote] = useState('')
  const [queueFilter, setQueueFilter] = useState('Open')
  const [taskQuery, setTaskQuery] = useState('')
  const [queueError, setQueueError] = useState('')
  const [visibleWidgets, setVisibleWidgets] = useState(readDashboardWidgetPreferences)
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const widgetSet = useMemo(() => new Set(visibleWidgets), [visibleWidgets])
  useEffect(() => {
    window.localStorage.setItem('overhead.dashboard.widgets.v1', JSON.stringify(visibleWidgets))
  }, [visibleWidgets])
  function toggleWidget(id) {
    setVisibleWidgets((current) => {
      if (current.includes(id)) {
        if (current.length === 1) return current
        return current.filter((item) => item !== id)
      }
      return [...current, id]
    })
  }
  function resetDashboard() {
    setVisibleWidgets(dashboardWidgets.map(([id]) => id))
  }
  const taskCounts = useMemo(() => queue.reduce((counts, task) => {
    const status = task.status || 'Open'
    counts[status] = (counts[status] || 0) + 1
    return counts
  }, {}), [queue])
  const visibleQueue = useMemo(() => queue.filter((task) => {
    const status = task.status || 'Open'
    const query = taskQuery.trim().toLowerCase()
    return (queueFilter === 'All' || status === queueFilter) && (!query || [task.title, task.label, task.area, task.due, task.due_at].some((value) => String(value || '').toLowerCase().includes(query)))
  }), [queue, queueFilter, taskQuery])
  async function completeTask(task) {
    if (!task.id || !window.overheadBackend?.updateTaskStatus) return
    try {
      const nextStatus = task.status === 'Complete' ? 'Open' : 'Complete'
      await window.overheadBackend.updateTaskStatus({ taskId: task.id, status: nextStatus })
      setQueueError('')
      setOperationNotice(`Task marked ${nextStatus.toLowerCase()}.`)
      await refreshBackend()
    } catch (error) { setQueueError(userFacingError(error, 'The task could not be updated.')) }
  }

  async function createQuickNote() {
    if (!quickNote.trim()) { setQueueError('Write a short note before adding it to the queue.'); return }
    if (!window.overheadBackend?.createQuickNote) { setQueueError('The quick-note service is not available. Restart OverHead and try again.'); return }
    try {
      await window.overheadBackend.createQuickNote({ title: quickNote.trim(), details: 'Created from dashboard quick note.' })
      setQuickNote('')
      setQueueError('')
      setOperationNotice('Quick note added to the action queue.')
      await refreshBackend()
    } catch (error) { setQueueError(userFacingError(error, 'The note could not be added.')) }
  }

  return (
    <section className="overview-layout">
      <div className="dashboard-customize-bar">
        <p>Choose the panels that appear on your dashboard.</p>
        <button className="ghost-button" type="button" aria-expanded={customizeOpen} onClick={() => setCustomizeOpen((open) => !open)}>{customizeOpen ? 'Done customizing' : 'Customize dashboard'}</button>
      </div>
      {customizeOpen && <fieldset className="dashboard-widget-picker">
        <legend>Dashboard panels</legend>
        {dashboardWidgets.map(([id, label]) => <label key={id}>
          <input type="checkbox" checked={widgetSet.has(id)} onChange={() => toggleWidget(id)} />
          <span>{label}</span>
        </label>)}
        <button className="text-button" type="button" onClick={resetDashboard}>Show all panels</button>
      </fieldset>}
      {widgetSet.has('status') && <div className="dashboard-grid">
        <StatusCard icon={LockKeyhole} title="Session" value={secureView ? 'Unlocked' : 'Protected'} note="Customer records mask when privacy mode is on." />
        <StatusCard icon={ShieldAlert} title="Review trail" value="Available" note="Use activity and integrity records to review important changes." />
        <StatusCard icon={Database} title="Customer DB" value={`${health?.customerCount ?? Object.keys(customerDatabaseSchema.tables).length} records`} note={health?.databaseExists ? 'Encrypted local store is online.' : 'Profiles, workflow preferences, receipts, and support tickets.'} />
      </div>}

      {widgetSet.has('profile') && <div className="panel hero-panel">
        <div>
          <p className="eyebrow">Workspace Profile</p>
          <h2>{session.businessName || 'Business workspace'}</h2>
          <p>A local-first workspace for customer follow-through, revenue operations, role-aware approvals, and support-ready records.</p>
        </div>
        <div className="profile-grid">
          <ProfileItem label="Owner" value={session.ownerName || 'Pending'} />
          <ProfileItem label="Role" value={session.role} />
          <ProfileItem label="Status" value={secureView ? 'Unlocked' : 'Protected'} />
          <ProfileItem label="Runtime" value={integrity?.status === 'clean' ? 'Clean' : 'Checking'} />
        </div>
      </div>}

      {widgetSet.has('standards') && <section className="operating-standard" aria-label="OverHead operating standard">
        <div><span>CLARITY</span><strong>Make the next action and owner visible.</strong></div>
        <div><span>CONTROL</span><strong>Keep sensitive decisions explainable.</strong></div>
        <div><span>RECOVERY</span><strong>Leave a usable record and a path forward.</strong></div>
      </section>}

      {widgetSet.has('queue') && <section className="panel action-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Action Queue</p>
            <h2>Current work</h2>
          </div>
          <CheckCircle2 size={18} />
        </div>
        <div className="task-table">
          <div className="quick-note-row">
            <input value={quickNote} onChange={(event) => setQuickNote(event.target.value)} placeholder="Quick note or office reminder" />
            <button className="ghost-button" type="button" onClick={createQuickNote}>Add Note</button>
          </div>
          <div className="queue-controls">
            <div className="queue-filters" role="group" aria-label="Filter current work">
              {['Open', 'Queued', 'Blocked', 'Complete', 'All'].map((filter) => <button className={queueFilter === filter ? 'active' : ''} type="button" key={filter} onClick={() => setQueueFilter(filter)}>{filter}{filter !== 'All' && ` (${taskCounts[filter] || 0})`}</button>)}
            </div>
            <input value={taskQuery} onChange={(event) => setTaskQuery(event.target.value)} placeholder="Search current work" />
          </div>
          {queueError && <p className="form-error">{queueError}</p>}
          {!visibleQueue.length && <p className="queue-empty">No work matches that filter.</p>}
          {visibleQueue.map((action) => (
            <div className="task-row" key={action.id || action.label}>
              <strong className={action.protected && !secureView ? 'masked-text' : ''}>{action.protected && !secureView ? 'Protected action' : action.title || action.label}</strong>
              <span>{action.area}</span>
              <span>{action.due || action.status || action.due_at}</span>
              <button className="mini-button" type="button" onClick={() => completeTask(action)} disabled={!action.id || action.status === 'Complete'}>
                {action.status === 'Complete' ? 'Reopen' : 'Done'}
              </button>
            </div>
          ))}
        </div>
      </section>}
      {widgetSet.has('checklist') && <section className="panel action-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Launch Checklist</p>
            <h2>Office readiness</h2>
          </div>
          <BadgeCheck size={18} />
        </div>
        <div className="checklist-grid">
          {(backendState.officeChecklist || []).map((item) => (
            <span key={item.id}>{item.label} - {item.status}</span>
          ))}
        </div>
      </section>}
      {widgetSet.has('live-operations') && <LiveOperations backendState={backendState} refreshBackend={refreshBackend} setOperationNotice={setOperationNotice} />}
      {widgetSet.has('records') && <OperationalRecords backendState={backendState} refreshBackend={refreshBackend} setOperationNotice={setOperationNotice} />}
      {(session.role === 'Owner' || session.role === 'Bookkeeper') && <ExpenseLedger backendState={backendState} refreshBackend={refreshBackend} setOperationNotice={setOperationNotice} />}
      {widgetSet.has('compliance') && <ComplianceBadges />}
    </section>
  )
}

function LiveOperations({ backendState, refreshBackend, setOperationNotice }) {
  const [kind, setKind] = useState('appointment')
  const [draft, setDraft] = useState({ title: '', amount: '', scheduledFor: '', dueDate: '', notes: '', customerId: '' })
  const [error, setError] = useState('')
  const lists = { appointment: backendState.appointments || [], quote: backendState.quotes || [], invoice: backendState.invoices || [] }
  async function create() {
    try {
      const api = kind === 'appointment' ? window.overheadBackend.createAppointment : kind === 'quote' ? window.overheadBackend.createQuote : window.overheadBackend.createInvoice
      if (!api) throw new Error('This operational tool is unavailable. Restart OverHead and try again.')
      await api({ title: draft.title, amount: draft.amount, scheduledFor: draft.scheduledFor, dueDate: draft.dueDate, notes: draft.notes, customerId: draft.customerId })
      setDraft({ title: '', amount: '', scheduledFor: '', dueDate: '', notes: '', customerId: '' }); setError(''); setOperationNotice(`${kind[0].toUpperCase()}${kind.slice(1)} created.`); await refreshBackend()
    } catch (reason) { setError(userFacingError(reason, `The ${kind} could not be created.`)) }
  }
  return <section className="panel action-panel"><div className="section-head"><div><p className="eyebrow">Live operations</p><h2>Create office work</h2></div><span className="record-count">{lists[kind].length} saved</span></div><div className="queue-filters">{['appointment', 'quote', 'invoice'].map((item) => <button className={kind === item ? 'active' : ''} type="button" key={item} onClick={() => setKind(item)}>{item}</button>)}</div><div className="profile-form compact-form"><FormField label="Title" value={draft.title} onChange={(value) => setDraft((current) => ({ ...current, title: value }))} placeholder={kind === 'appointment' ? 'Service appointment' : kind === 'quote' ? 'Service quote' : 'Customer invoice'} /><label>Customer<select value={draft.customerId} onChange={(event) => setDraft((current) => ({ ...current, customerId: event.target.value }))}><option value="">No customer assigned</option>{(backendState.customers || []).map((customer) => <option key={customer.id} value={customer.id}>{customer.business_name || customer.owner_name || customer.email}</option>)}</select></label>{kind === 'appointment' ? <label>Scheduled for<input type="datetime-local" value={draft.scheduledFor} onChange={(event) => setDraft((current) => ({ ...current, scheduledFor: event.target.value }))} /></label> : <><FormField label="Amount" value={draft.amount} onChange={(value) => setDraft((current) => ({ ...current, amount: value }))} placeholder="0.00" />{kind === 'invoice' && <label>Due date<input type="date" value={draft.dueDate} onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))} /></label>}</>}<FormField label="Notes" value={draft.notes} onChange={(value) => setDraft((current) => ({ ...current, notes: value }))} placeholder="Optional internal note" /><button className="primary-action" type="button" onClick={create}>Create {kind}</button>{error && <p className="form-error">{error}</p>}</div><div className="task-list">{lists[kind].slice(0, 4).map((item) => <div className="task-row" key={item.id}><strong>{item.title}</strong><span>{item.status}</span><span>{item.scheduled_for || item.due_date || `$${Number(item.amount || 0).toFixed(2)}`}</span></div>)}{!lists[kind].length && <p className="queue-empty">No {kind}s have been created yet.</p>}</div></section>
}

function OperationalRecords({ backendState, refreshBackend, setOperationNotice }) {
  const [type, setType] = useState('appointment')
  const [error, setError] = useState('')
  const definitions = { appointment: ['Scheduled', 'Confirmed', 'Complete', 'Canceled'], quote: ['Draft', 'Sent', 'Accepted', 'Declined'], invoice: ['Open', 'Sent', 'Paid', 'Void'] }
  const records = backendState[`${type}s`] || []
  const customers = backendState.customers || []
  const customerName = (id) => { const customer = customers.find((item) => item.id === id); return customer ? (customer.business_name || customer.owner_name || customer.email) : 'Unassigned' }
  async function setStatus(id, status) { try { await window.overheadBackend.updateOperationalStatus({ type, id, status }); setError(''); setOperationNotice(`${type[0].toUpperCase()}${type.slice(1)} updated.`); await refreshBackend() } catch (reason) { setError(userFacingError(reason, 'The status could not be updated.')) } }
  async function setCustomer(id, customerId) { try { await window.overheadBackend.assignOperationalCustomer({ type, id, customerId }); setError(''); setOperationNotice('Customer assignment saved.'); await refreshBackend() } catch (reason) { setError(userFacingError(reason, 'The customer assignment could not be saved.')) } }
  async function createPdf(id) { try { const result = await window.overheadBackend.createOperationalDocument({ type, id }); setError(''); setOperationNotice(`${type[0].toUpperCase()}${type.slice(1)} PDF created: ${result.pdfPath}`); await refreshBackend() } catch (reason) { setError(userFacingError(reason, 'The document could not be created.')) } }
  return <section className="panel action-panel"><div className="section-head"><div><p className="eyebrow">Record control</p><h2>Update and deliver work</h2></div></div><div className="queue-filters">{Object.keys(definitions).map((item) => <button className={type === item ? 'active' : ''} type="button" key={item} onClick={() => setType(item)}>{item}s</button>)}</div><div className="task-list">{records.map((record) => <div className="task-row" key={record.id}><strong>{record.title}</strong><span>{customerName(record.customer_id)}</span><label><span className="sr-only">Status</span><select value={record.status} onChange={(event) => setStatus(record.id, event.target.value)}>{definitions[type].map((status) => <option key={status}>{status}</option>)}</select></label><label><span className="sr-only">Customer</span><select value={record.customer_id || ''} onChange={(event) => setCustomer(record.id, event.target.value)}><option value="">Unassigned</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.business_name || customer.owner_name || customer.email}</option>)}</select></label>{type !== 'appointment' && <button className="ghost-button" type="button" onClick={() => createPdf(record.id)}>Create PDF</button>}</div>)}{!records.length && <p className="queue-empty">Create a {type} above to manage it here.</p>}</div>{error && <p className="form-error">{error}</p>}</section>
}

const EXPENSE_CATEGORIES = ['Advertising', 'Insurance', 'Meals', 'Office supplies', 'Payroll', 'Rent', 'Software', 'Travel', 'Utilities', 'Other']
function ExpenseLedger({ backendState, refreshBackend, setOperationNotice }) {
  const today = new Date().toISOString().slice(0, 10)
  const [draft, setDraft] = useState({ title: '', vendor: '', category: 'Other', amount: '', expenseDate: today, notes: '' })
  const [month, setMonth] = useState(today.slice(0, 7))
  const [budgetDraft, setBudgetDraft] = useState({ category: 'Other', amount: '' })
  const [summary, setSummary] = useState({ month, budget: 0, actual: 0, categories: [] })
  const [error, setError] = useState('')
  const expenses = backendState.expenses || []
  useEffect(() => { let active = true; window.overheadBackend?.getExpenseSummary?.(month).then((result) => { if (active) setSummary(result) }).catch((reason) => { if (active) setError(userFacingError(reason, 'The expense summary could not be loaded.')) }); return () => { active = false } }, [month, backendState.expenses])
  async function submitExpense() {
    try {
      await window.overheadBackend.createExpense(draft)
      setDraft((current) => ({ ...current, title: '', vendor: '', amount: '', notes: '' }))
      setError(''); setOperationNotice('Expense submitted for approval.'); await refreshBackend()
    } catch (reason) { setError(userFacingError(reason, 'The expense could not be saved.')) }
  }
  async function setStatus(expenseId, status) {
    try { await window.overheadBackend.updateExpenseStatus({ expenseId, status }); setError(''); setOperationNotice(`Expense marked ${status.toLowerCase()}.`); await refreshBackend() }
    catch (reason) { setError(userFacingError(reason, 'The expense status could not be updated.')) }
  }
  async function saveBudget() {
    try { const next = await window.overheadBackend.setExpenseBudget({ month, ...budgetDraft }); setSummary(next); setBudgetDraft((current) => ({ ...current, amount: '' })); setError(''); setOperationNotice('Monthly category budget saved.') }
    catch (reason) { setError(userFacingError(reason, 'The category budget could not be saved.')) }
  }
  const money = (value) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value || 0))
  return <section className="panel action-panel">
    <div className="section-head"><div><p className="eyebrow">Expense control</p><h2>Expense ledger</h2></div><span className="record-count">{expenses.length} saved</span></div>
    <p className="panel-copy">Record operating costs, review approvals, and compare category spending with monthly budgets.</p>
    <div className="profile-form compact-form">
      <label>Description<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Cloud hosting subscription" /></label>
      <label>Vendor<input value={draft.vendor} onChange={(event) => setDraft({ ...draft, vendor: event.target.value })} placeholder="Vendor name" /></label>
      <label>Category<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>{EXPENSE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label>Amount<input type="number" min="0.01" step="0.01" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} placeholder="0.00" /></label>
      <label>Expense date<input type="date" value={draft.expenseDate} onChange={(event) => setDraft({ ...draft, expenseDate: event.target.value })} /></label>
      <label>Notes<input value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Optional note" /></label>
      <button className="primary-action" type="button" onClick={submitExpense}>Submit expense</button>
    </div>
    <div className="section-head expense-report-head"><div><p className="eyebrow">Budget vs actual</p><h3>{money(summary.actual)} recorded Â· {money(summary.budget)} budgeted</h3></div><label>Month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label></div>
    <div className="profile-form compact-form expense-budget-form"><label>Budget category<select value={budgetDraft.category} onChange={(event) => setBudgetDraft({ ...budgetDraft, category: event.target.value })}>{EXPENSE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label><label>Monthly budget<input type="number" min="0" step="0.01" value={budgetDraft.amount} onChange={(event) => setBudgetDraft({ ...budgetDraft, amount: event.target.value })} placeholder="0.00" /></label><button className="ghost-button" type="button" onClick={saveBudget}>Save category budget</button></div>
    {summary.categories.length > 0 && <div className="task-list">{summary.categories.map((item) => <div className="task-row" key={item.category}><strong>{item.category}</strong><span>Actual {money(item.actual)}</span><span>Budget {money(item.budget)}</span><span>{item.variance >= 0 ? `${money(item.variance)} remaining` : `${money(-item.variance)} over`}</span></div>)}</div>}
    <div className="task-list">{expenses.filter((item) => item.expense_date.startsWith(month)).map((item) => {
      const statuses = item.status === 'Pending' ? ['Pending', 'Approved', 'Rejected'] : item.status === 'Approved' ? ['Pending', 'Approved', 'Rejected', 'Paid'] : item.status === 'Rejected' ? ['Rejected', 'Pending'] : ['Paid']
      return <div className="task-row" key={item.id}><strong>{item.title}<small className="expense-meta">{item.vendor} Â· {item.category} Â· {item.expense_date}</small></strong><span>{money(item.amount)}</span><label><span className="sr-only">Expense status</span><select value={item.status} onChange={(event) => setStatus(item.id, event.target.value)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label></div>
    })}{!expenses.some((item) => item.expense_date.startsWith(month)) && <p className="queue-empty">No expenses recorded for {month}.</p>}</div>
    {error && <p className="form-error">{error}</p>}
  </section>
}

function ComplianceBadges() {
  return (
    <section className="panel action-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Review Badges</p>
          <h2>Built for review</h2>
        </div>
        <ShieldCheck size={18} />
      </div>
      <div className="badge-grid">
        {complianceBadges.map((badge) => (
          <article key={badge.label}>
            <strong>{badge.label}</strong>
            <span>{badge.detail}</span>
          </article>
        ))}
      </div>
    </section>
  )
}

function sectionTitle(section) {
  return {
    overview: 'OverHead Console',
    reports: 'Workspace Reports',
    growth: 'Growth & Work Suite',
    'sales-growth': 'Sales Studio',
    'customer-management': 'Customer Management',
    'field-assist': 'Field & Assist',
    scheduling: 'Scheduling & Time',
    documents: 'Document Control',
    collaboration: 'Team Collaboration',
    finance: 'Finance Operations',
    people: 'People Operations',
    'rule-center': 'Automation Rule Builder',
    integrations: 'Integration Status & Data Exchange',
    search: 'Workspace Search',
    'admin-security': 'Security Administration',
    work: 'Workflow Operations',
    customers: 'Customer Records',
    imports: 'Import From Microsoft',
    automations: 'Automation Control',
    evidence: 'Security And Evidence',
    support: 'Legal And Support',
    tools: 'Office Tools',
    accounts: 'User Accounts',
    licenses: 'Licenses And Team Access',
    plans: 'Plan Entitlements',
    payments: 'Stripe Payments',
    square: 'Square Connection',
    security: 'Security And Recovery',
    settings: 'Settings',
  }[section]
}

function displayRole(role) {
  return role === 'Owner' ? 'Administrator' : role === 'Front Desk' || role === 'Bookkeeper' ? 'Manager' : role === 'Customer' ? 'Customer Member' : 'Member'
}

function allowedSectionsForRole(role) {
  const member = ['overview', 'field-assist', 'scheduling', 'collaboration', 'search', 'work', 'customers', 'support', 'tools', 'security']
  if (role === 'Owner') return navSections.map((section) => section.id)
  if (role === 'Front Desk' || role === 'Bookkeeper') return [...member, 'growth', 'sales-growth', 'customer-management', 'documents', ...(role === 'Bookkeeper' ? ['reports', 'finance'] : []), 'imports', 'automations', 'evidence', 'accounts', 'licenses']
  return member
}

function WorkflowsSection({ activeModule, selectedModule, setActiveModule, refreshBackend, setOperationNotice }) {
  const SelectedIcon = selectedModule.icon
  const [error, setError] = useState('')
  async function createWorkflowWork() {
    try {
      if (!window.overheadBackend?.queueWorkflowJob) throw new Error('Workflow jobs are unavailable. Restart OverHead and try again.')
      await window.overheadBackend.queueWorkflowJob({ type: `workflow.${selectedModule.id}`, title: `${selectedModule.label}: next action`, payload: { module: selectedModule.id } })
      setError(''); setOperationNotice(`${selectedModule.label} work was added to the queue.`); await refreshBackend()
    } catch (reason) { setError(userFacingError(reason, 'The workflow task could not be created.')) }
  }
  return (
    <section className="panel page-panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">Operations</p>
          <h2>Workflows with clear ownership</h2>
        </div>
        <button className="ghost-button" type="button" onClick={createWorkflowWork}><BookOpenCheck size={16} />Create work</button>
      </div>
      <div className="module-layout">
        <div className="module-tabs" role="tablist" aria-label="Admin modules">
          {modules.map((module) => {
            const Icon = module.icon
            return (
              <button className={module.id === activeModule ? 'module-tab active' : 'module-tab'} key={module.id} onClick={() => setActiveModule(module.id)} type="button">
                <Icon size={18} />
                <span>{module.label}</span>
                <small>{module.status} - {module.owner}</small>
              </button>
            )
          })}
        </div>
        <article className="module-detail">
          <div className="module-title">
            <SelectedIcon size={24} />
            <div>
              <h3>{selectedModule.label}</h3>
              <span>{selectedModule.summary}</span>
            </div>
          </div>
          <div className="builder-row">
            <Step number="1" title="Capture only what is needed" text="Collect the required context and customer permission; do not add sensitive details by habit." />
            <Step number="2" title="Assign and review" text={`Set the responsible role, then use an owner approval point when ${selectedModule.label.toLowerCase()} could change money, access, records, or a customer outcome.`} />
            <Step number="3" title="Act and retain context" text="Draft, schedule, invoice, or create the next taskâ€”then keep the decision, handoff, and recovery path understandable." />
          </div>
          <div className="workflow-standard">
            <span><strong>Owner</strong> {selectedModule.owner}</span>
            <span><strong>State</strong> {selectedModule.status}</span>
            <span><strong>Standard</strong> Clear next action, minimum necessary data, review before material change.</span>
          </div>
          <div className="boilerplate-strip">
            {workflowBoilerplates.map((item) => (
              <article key={item.title}>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
          {error && <p className="form-error">{error}</p>}
        </article>
      </div>
    </section>
  )
}

function CustomersSection({ secureView, customers, backendState, refreshBackend, setOperationNotice }) {
  const customerRecords = customers || []
  const [customerQuery, setCustomerQuery] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState(customerRecords[0]?.id || '')
  const matchingCustomers = useMemo(() => {
    const query = customerQuery.trim().toLowerCase()
    if (!query) return customerRecords
    return customerRecords.filter((item) => [item.business_name, item.owner_name, item.email, item.industry, item.service_area]
      .some((value) => String(value || '').toLowerCase().includes(query)))
  }, [customerQuery, customerRecords])
  const customer = customerRecords.find((item) => item.id === selectedCustomerId) || matchingCustomers[0] || customerRecords[0] || {}
  const workflow = customer.workflow_preferences || customer
  const [customerError, setCustomerError] = useState('')
  const [inviteNotice, setInviteNotice] = useState('')
  const [documentLabel, setDocumentLabel] = useState('')
  const savedCustomer = backendState.savedFormMemory?.customer || {}
  const [draftCustomer, setDraftCustomer] = useState({
    businessName: '',
    ownerName: '',
    email: '',
    industry: savedCustomer.industry || '',
    serviceArea: savedCustomer.serviceArea || '',
    preferredContact: savedCustomer.preferredContact || 'Email',
  })

  function updateCustomerDraft(key, value) {
    setDraftCustomer((current) => ({ ...current, [key]: value }))
  }

  async function createCustomer() {
    if (!window.overheadBackend?.createCustomer) {
      setCustomerError('The customer service is not available. Restart OverHead and try again.')
      return
    }
    if (!draftCustomer.businessName.trim()) {
      setCustomerError('Add the customer business name before saving the record.')
      return
    }
    try {
      const result = await window.overheadBackend.createCustomer(draftCustomer)
      const newestCustomer = result?.customers?.[0]
      if (newestCustomer?.id) setSelectedCustomerId(newestCustomer.id)
      setDraftCustomer({ businessName: '', ownerName: '', email: '', industry: '', serviceArea: '', preferredContact: 'Email' })
      setCustomerError('')
      setOperationNotice('Customer record created and workflow setup task queued.')
      await refreshBackend()
    } catch (error) {
      setCustomerError(userFacingError(error, 'The customer record could not be saved.'))
    }
  }

  async function createPortalInvite() {
    if (!customer.id) { setCustomerError('Select a saved customer before creating portal access.'); return }
    try {
      const result = await window.overheadBackend.createCustomerPortalInvite({ customerId: customer.id, email: customer.email })
      setCustomerError('')
      setInviteNotice(`Customer invitation ${result.delivery?.status || 'created'} for ${result.email}. Workspace code: ${result.workspaceId}`)
      setOperationNotice('Customer portal invitation created.')
    } catch (error) { setCustomerError(userFacingError(error, 'Customer portal access could not be created.')) }
  }

  async function attachDocument() {
    if (!customer.id) { setCustomerError('Select a saved customer before attaching a document.'); return }
    try {
      const chosen = await window.overheadBackend.selectDocumentFile()
      if (chosen?.canceled || !chosen?.filePath) return
      const document = await window.overheadBackend.attachCustomerDocument({ customerId: customer.id, sourcePath: chosen.filePath, label: documentLabel })
      setDocumentLabel(''); setCustomerError(''); setOperationNotice(`${document.file_name} attached to ${customer.business_name || 'customer record'}.`); await refreshBackend()
    } catch (error) { setCustomerError(userFacingError(error, 'The document could not be attached.')) }
  }

  async function openDocument(documentId) {
    try { await window.overheadBackend.openCustomerDocument(documentId); setCustomerError('') } catch (error) { setCustomerError(userFacingError(error, 'The document could not be opened.')) }
  }

  const customerDocuments = (backendState.documents || []).filter((item) => item.customer_id === customer.id)

  return (
    <section className="panel page-panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">Database</p>
          <h2>Customer Records</h2>
        </div>
        <span className="record-count">{customerRecords.length} saved</span>
      </div>
      <div className="customer-workspace">
        <aside className="customer-list" aria-label="Customer records">
          <label className="customer-search">
            <Search size={15} />
            <input value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} placeholder="Find a customer" />
          </label>
          <div className="customer-list-items">
            {matchingCustomers.map((item) => (
              <button className={item.id === customer.id ? 'customer-list-item active' : 'customer-list-item'} type="button" key={item.id} onClick={() => setSelectedCustomerId(item.id)}>
                <strong className={!secureView ? 'masked-text' : ''}>{secureView ? item.business_name : 'Protected record'}</strong>
                <span className={!secureView ? 'masked-text' : ''}>{secureView ? `${item.industry || 'General services'} Â· ${item.service_area || 'Local'}` : 'Unlock to view details'}</span>
              </button>
            ))}
            {!matchingCustomers.length && <p className="customer-empty">No customer records match that search.</p>}
          </div>
        </aside>
        <div className="customer-record">
          <span className="customer-record-label">Selected customer</span>
          <strong className={!secureView ? 'masked-text' : ''}>{secureView ? customer.business_name : 'Protected customer record'}</strong>
          <span className={!secureView ? 'masked-text' : ''}>{secureView ? `${customer.industry || 'General services'} Â· ${customer.service_area || 'Local'}` : 'Customer details masked until unlock'}</span>
          <div className="customer-detail-grid">
            <span><small>Contact</small><b className={!secureView ? 'masked-text' : ''}>{secureView ? (customer.preferred_contact || 'Email') : 'Hidden'}</b></span>
            <span><small>Owner</small><b className={!secureView ? 'masked-text' : ''}>{secureView ? (customer.owner_name || 'Not added') : 'Hidden'}</b></span>
            <span><small>Status</small><b>{customer.status || 'Active'}</b></span>
          </div>
          <p><b>Quote rule:</b> {secureView ? (workflow.quote_rules || 'No quote rule has been added yet.') : 'Workflow rules are hidden while protected mode is active.'}</p>
          <p><b>Operating playbook:</b> {secureView ? (workflow.playbook_name || 'Not selected yet â€” use Automations to apply one.') : 'Playbook details are hidden while protected mode is active.'}</p>
          <button className="ghost-button" type="button" onClick={createPortalInvite}>Create Customer Access Invitation</button>
          {inviteNotice && <p className="form-error">{inviteNotice}</p>}
          <div className="document-vault">
            <strong>Customer documents</strong>
            <div className="document-upload-row"><FormField label="Document label" value={documentLabel} onChange={setDocumentLabel} placeholder="Optional label" /><button className="ghost-button" type="button" onClick={attachDocument}>Attach Document</button></div>
            {customerDocuments.map((document) => <button className="text-button" type="button" key={document.id} onClick={() => openDocument(document.id)}>{document.label} Â· {(Number(document.byte_size || 0) / 1024).toFixed(1)} KB</button>)}
            {!customerDocuments.length && <small>No documents attached to this customer.</small>}
          </div>
        </div>
      </div>
      <div className="schema-list">
        {Object.keys(customerDatabaseSchema.tables).map((table) => <span key={table}>{table}</span>)}
      </div>
      <div className="customer-manager">
        <div className="section-head tight">
          <div>
            <p className="eyebrow">Create Record</p>
            <h3>Add customer</h3>
          </div>
          <Users size={18} />
        </div>
        <div className="profile-form compact-form">
          <FormField label="Business name" value={draftCustomer.businessName} onChange={(value) => updateCustomerDraft('businessName', value)} placeholder="Customer business" />
          <FormField label="Owner name" value={draftCustomer.ownerName} onChange={(value) => updateCustomerDraft('ownerName', value)} placeholder="Owner name" />
          <FormField label="Email" value={draftCustomer.email} onChange={(value) => updateCustomerDraft('email', value)} placeholder="customer@example.com" />
          <FormField label="Industry" value={draftCustomer.industry} onChange={(value) => updateCustomerDraft('industry', value)} placeholder="Industry" />
          <FormField label="Service area" value={draftCustomer.serviceArea} onChange={(value) => updateCustomerDraft('serviceArea', value)} placeholder="Service area" />
          <label>
            Preferred contact
            <select value={draftCustomer.preferredContact} onChange={(event) => updateCustomerDraft('preferredContact', event.target.value)}>
              <option>Email</option>
              <option>Phone</option>
              <option>Text message</option>
            </select>
          </label>
          <button className="primary-action" type="button" onClick={createCustomer}>Add Customer</button>
          {customerError && <p className="form-error">{customerError}</p>}
        </div>
      </div>
    </section>
  )
}

function AutomationsSection({ backendState, refreshBackend, setOperationNotice }) {
  const [jobFilter, setJobFilter] = useState('Queued')
  const [jobQuery, setJobQuery] = useState('')
  const [automationError, setAutomationError] = useState('')
  const [playbookCustomerId, setPlaybookCustomerId] = useState(backendState.customers?.[0]?.id || '')
  const [playbookTemplate, setPlaybookTemplate] = useState('intake-control')
  const allJobs = useMemo(() => backendState.workflowJobs || [], [backendState.workflowJobs])
  const customers = backendState.customers || []
  const jobCounts = useMemo(() => allJobs.reduce((counts, job) => ({ ...counts, [job.status]: (counts[job.status] || 0) + 1 }), {}), [allJobs])
  const displayedJobs = useMemo(() => allJobs.filter((job) => {
    const query = jobQuery.trim().toLowerCase()
    return (jobFilter === 'All' || job.status === jobFilter) && (!query || `${job.title} ${job.type}`.toLowerCase().includes(query))
  }), [allJobs, jobFilter, jobQuery])
  async function queueDigest() {
    try {
      if (!window.overheadBackend?.queueWorkflowJob) throw new Error('The workflow service is not available.')
      await window.overheadBackend.queueWorkflowJob({ type: 'owner.digest', title: 'Prepare owner daily digest', payload: { source: 'automation-control' } })
      setAutomationError('')
      setOperationNotice('Owner digest job queued.')
      await refreshBackend()
    } catch (error) { setAutomationError(userFacingError(error, 'The digest could not be queued.')) }
  }

  async function processDueJobs() {
    try {
      if (!window.overheadBackend?.processDueJobs) throw new Error('The workflow service is not available.')
      const jobs = await window.overheadBackend.processDueJobs()
      setAutomationError('')
      setOperationNotice(`${jobs?.filter((job) => job.status === 'Complete').length || 0} completed workflow jobs are now recorded.`)
      await refreshBackend()
    } catch (error) { setAutomationError(userFacingError(error, 'Due jobs could not be processed.')) }
  }

  async function applyPlaybook() {
    try {
      if (!playbookCustomerId) throw new Error('Choose a customer before applying a playbook.')
      if (!window.overheadBackend?.applyCustomerPlaybook) throw new Error('The playbook service is not available.')
      await window.overheadBackend.applyCustomerPlaybook({ customerId: playbookCustomerId, template: playbookTemplate })
      setAutomationError('')
      setOperationNotice('Customer playbook applied. The owner-control tasks are now in the work queue.')
      await refreshBackend()
    } catch (error) { setAutomationError(userFacingError(error, 'The customer playbook could not be applied.')) }
  }

  async function buildFirstDayPlan() {
    try {
      if (!window.overheadBackend?.buildGuidedLaunchPlan) throw new Error('The first-day setup service is not available.')
      const result = await window.overheadBackend.buildGuidedLaunchPlan()
      setAutomationError('')
      setOperationNotice(`First-day setup plan ready. ${result.tasksAdded || 0} new control tasks added.`)
      await refreshBackend()
    } catch (error) { setAutomationError(userFacingError(error, 'The first-day setup plan could not be prepared.')) }
  }

  async function retryJob(jobId) {
    try {
      if (!window.overheadBackend?.retryWorkflowJob) throw new Error('The workflow retry service is not available.')
      await window.overheadBackend.retryWorkflowJob({ jobId })
      setAutomationError('')
      setOperationNotice('Dead-letter job returned to the queue for a fresh retry.')
      await refreshBackend()
    } catch (error) { setAutomationError(userFacingError(error, 'The workflow job could not be retried.')) }
  }

  return (
    <section className="panel page-panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">Rules</p>
          <h2>Automation Coverage</h2>
        </div>
        <div className="button-row">
          <button className="ghost-button" type="button" onClick={queueDigest}>Queue Digest</button>
          <button className="ghost-button" type="button" onClick={processDueJobs}>Run Due</button>
        </div>
      </div>
      <div className="queue-controls automation-controls">
        <div className="queue-filters" role="group" aria-label="Filter workflow jobs">
          {['Queued', 'Complete', 'Dead Letter', 'All'].map((filter) => <button className={jobFilter === filter ? 'active' : ''} type="button" key={filter} onClick={() => setJobFilter(filter)}>{filter}{filter !== 'All' && ` (${jobCounts[filter] || 0})`}</button>)}
        </div>
        <input value={jobQuery} onChange={(event) => setJobQuery(event.target.value)} placeholder="Search automations" />
      </div>
      {automationError && <p className="form-error">{automationError}</p>}
      <div className="playbook-grid">
        <div className="backend-health">
          <strong>First-day setup</strong>
          <span>Build a short owner checklist that gets the first customer, approval rules, and a local backup in place.</span>
          <button className="ghost-button" type="button" onClick={buildFirstDayPlan}>Build First-Day Plan</button>
        </div>
        <div className="backend-health">
          <strong>Customer operating playbook</strong>
          <span>Give staff clear rules before they book, quote, or chase a payment.</span>
          <label>Customer
            <select value={playbookCustomerId} onChange={(event) => setPlaybookCustomerId(event.target.value)}>
              <option value="">Choose customer</option>
              {customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.business_name}</option>)}
            </select>
          </label>
          <label>Playbook
            <select value={playbookTemplate} onChange={(event) => setPlaybookTemplate(event.target.value)}>
              <option value="intake-control">Intake Control â€” collect details before booking</option>
              <option value="quote-approval">Quote Approval â€” owner reviews exceptions</option>
              <option value="payment-followup">Payment Follow-up â€” clear reminder and escalation rules</option>
            </select>
          </label>
          <button className="primary-action" type="button" onClick={applyPlaybook}>Apply Playbook</button>
        </div>
      </div>
      <div className="job-strip">
        {displayedJobs.slice(0, 6).map((job) => (
          <span key={job.id}>{job.status} Â· {job.title}</span>
        ))}
        {!displayedJobs.length && <span>No automation jobs match that filter.</span>}
      </div>
      <div className="feature-list">
        {displayedJobs.filter((job) => job.status === 'Dead Letter').map((job) => (
          <div className="backend-health" key={`retry-${job.id}`}>
            <strong>{job.title}</strong>
            <span>{job.last_error || 'This workflow job needs a manual retry.'}</span>
            <button className="ghost-button" type="button" onClick={() => retryJob(job.id)}>Retry Job</button>
          </div>
        ))}
        {marketableFeatures.filter((feature) => ['Operations', 'Revenue', 'Productivity', 'Integration'].includes(feature.category)).slice(0, 12).map((feature) => (
          <FeatureItem feature={feature} key={feature.name} />
        ))}
      </div>
    </section>
  )
}

function EvidenceSection({ integrity, secureView, backendState }) {
  return (
    <section className="panel page-panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">Defense</p>
          <h2>Integrity Status</h2>
        </div>
        <ShieldAlert size={20} />
      </div>
      <div className="evidence-grid">
        <div className="defense-status">
          <strong>{integrity?.status === 'clean' ? 'Runtime watched files clean' : 'Integrity attention needed'}</strong>
          <span>{integrity?.appPath || 'Desktop integrity API unavailable'}</span>
          <div className="integrity-files">
            {(integrity?.files || []).map((file) => <small key={file.relativePath}>{file.exists ? 'OK' : 'Missing'} - {file.relativePath}</small>)}
          </div>
        </div>
        <div className="defense-status">
          <strong>Protected evidence</strong>
          <span>{secureView ? 'Visible to authorized local session' : 'Masked until owner unlocks'}</span>
          <p>OverHead tracks protected evidence, access events, integrity snapshots, and tamper events in the database contract.</p>
        </div>
        <div className="defense-status">
          <strong>Audit ledger</strong>
          <span>{backendState.auditEvents.length} recent events</span>
          <div className="integrity-files">
            {backendState.auditEvents.slice(0, 5).map((event) => <small key={event.id}>{event.event_type} - {event.title}</small>)}
          </div>
        </div>
      </div>
    </section>
  )
}

function SupportSection({ activeLegal, selectedLegal, setActiveLegal, session, backendState, refreshBackend, setOperationNotice }) {
  const [ticketDraft, setTicketDraft] = useState({ subject: '', details: '', priority: 'Normal' })
  const [sharedTickets, setSharedTickets] = useState([])
  const [supportError, setSupportError] = useState('')

  async function refreshSharedTickets() {
    try {
      if (!window.overheadBackend?.listSharedSupportTickets) return
      setSharedTickets(await window.overheadBackend.listSharedSupportTickets())
      setSupportError('')
    } catch (error) { setSupportError(userFacingError(error, 'Shared support tickets could not be loaded.')) }
  }

  useEffect(() => { refreshSharedTickets() }, [])

  async function acknowledgeLegal() {
    if (!window.overheadBackend?.acknowledgeLegal) return
    await window.overheadBackend.acknowledgeLegal({ email: session.email, title: selectedLegal.title })
    setOperationNotice(`${selectedLegal.title} acknowledged.`)
    await refreshBackend()
  }

  async function createTicket() {
    if (window.overheadBackend?.createSupportTicket && ticketDraft.subject) {
      await window.overheadBackend.createSupportTicket(ticketDraft)
      setTicketDraft({ subject: '', details: '', priority: 'Normal' })
      setOperationNotice('Support ticket created.')
      await refreshSharedTickets()
      await refreshBackend({ signedIn: true })
    }
  }

  function updateTicket(key, value) {
    setTicketDraft((current) => ({ ...current, [key]: value }))
  }

  return (
    <section className="panel page-panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">Governance</p>
          <h2>Legal And Support</h2>
        </div>
        <HelpCircle size={20} />
      </div>
      <div className="support-layout">
        <div className="legal-layout">
          <div className="legal-menu">
            {legalDocuments.map((doc) => (
              <button className={doc.title === activeLegal ? 'active' : ''} type="button" key={doc.title} onClick={() => setActiveLegal(doc.title)}>
                {doc.title}
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
          <article className="legal-doc">
            <strong>{selectedLegal.title}</strong>
            <span>{selectedLegal.status}</span>
            <p>{selectedLegal.body}</p>
            <button className="primary-action" type="button" onClick={acknowledgeLegal}>Acknowledge</button>
          </article>
        </div>
        <div className="support-list">
          <div className="support-item support-form">
            <strong>Create support ticket</strong>
            <p>Describe the symptom, the affected workflow, and the last safe action. Do not include passwords, recovery phrases, card details, tax identifiers, or unredacted customer records.</p>
            <FormField label="Subject" value={ticketDraft.subject} onChange={(value) => updateTicket('subject', value)} placeholder="What needs attention?" />
            <label>
              Priority
              <select value={ticketDraft.priority} onChange={(event) => updateTicket('priority', event.target.value)}>
                <option>Normal</option>
                <option>High</option>
                <option>Urgent</option>
              </select>
            </label>
            <label>
              Details
              <input value={ticketDraft.details} onChange={(event) => updateTicket('details', event.target.value)} placeholder="Short support note" />
            </label>
            <button className="ghost-button" type="button" onClick={createTicket}>Create Ticket</button>
          </div>
          <div className="support-item">
            <strong>Shared support queue</strong>
            <button className="ghost-button" type="button" onClick={refreshSharedTickets}>Refresh queue</button>
            {sharedTickets.slice(0, 8).map((ticket) => <p key={ticket.id}><b>{ticket.priority || 'Normal'}</b> â€” {ticket.subject || 'Support request'} ({ticket.status || 'Open'})</p>)}
            {!sharedTickets.length && <p>No shared tickets yet.</p>}
            {supportError && <p className="form-error">{supportError}</p>}
          </div>
          {supportChannels.map((channel) => (
            <div className="support-item" key={channel.label}>
              <strong>{channel.label}</strong>
              <span>{channel.value}</span>
              <p>{channel.note}</p>
            </div>
          ))}
        </div>
      </div>
      {(session.role === 'Owner' || session.role === 'Support') && <SupportOperationsPanel tickets={sharedTickets} users={backendState.userProfiles || []} session={session} setOperationNotice={setOperationNotice} />}
    </section>
  )
}

function ToolsSection({ backendState, refreshBackend, setOperationNotice, operationNotice }) {
  const [pdfType, setPdfType] = useState('customer-intake')
  const [reminder, setReminder] = useState({ title: 'Call back customer', runAt: '' })
  const [toolError, setToolError] = useState('')

  async function createPdf() {
    try {
      if (!window.overheadBackend?.createFillablePdf) throw new Error('The PDF service is not available.')
      const result = await window.overheadBackend.createFillablePdf({ customerId: backendState.customers?.[0]?.id || '', packetType: pdfType })
      setToolError('')
      setOperationNotice(`Fillable PDF created: ${result.pdfPath}`)
      await refreshBackend()
    } catch (error) { setToolError(userFacingError(error, 'The PDF could not be created.')) }
  }

  async function queueReminder() {
    if (!reminder.title.trim()) { setToolError('Give the reminder a short title before queuing it.'); return }
    try {
      if (!window.overheadBackend?.queueWorkflowJob) throw new Error('The reminder service is not available.')
      await window.overheadBackend.queueWorkflowJob({ type: 'office.reminder', title: reminder.title.trim(), payload: { source: 'tools' }, runAt: reminder.runAt ? new Date(reminder.runAt).toISOString() : '' })
      setReminder({ title: '', runAt: '' })
      setToolError('')
      setOperationNotice('Office reminder queued.')
      await refreshBackend()
    } catch (error) { setToolError(userFacingError(error, 'The reminder could not be queued.')) }
  }

  return (
    <section className="panel page-panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">Office Tools</p>
          <h2>Office tools with a clear record</h2>
        </div>
        <BriefcaseBusiness size={20} />
      </div>
      {toolError && <p className="form-error">{toolError}</p>}
      <div className="tool-grid">
        <div className="backend-health">
          <strong>Fillable PDF packet</strong>
          <span>Generate customer intake, quote review, or support request PDFs from local records. Review the content before sharing it outside the workspace.</span>
          <label>
            Packet type
            <select value={pdfType} onChange={(event) => setPdfType(event.target.value)}>
              <option value="customer-intake">Customer intake</option>
              <option value="quote-review">Quote review</option>
              <option value="support-request">Support request</option>
            </select>
          </label>
          <button className="primary-action" type="button" onClick={createPdf}>Create Fillable PDF</button>
          <small>{backendState.health?.pdfCount ?? 0} PDFs generated</small>
        </div>
        <div className="backend-health">
          <strong>Local operating record</strong>
          <span>Quick notes, support bundles, data exports, restore checks, and workflow jobs are recorded so the owner can understand what happened and what comes next.</span>
          <small>{operationNotice || 'Ready'}</small>
        </div>
        <div className="backend-health">
          <strong>Reminder launcher</strong>
          <span>Queue a dated office follow-up. Give it a responsible owner in the workflow when it affects a customer, payment, or policy. Leave the time blank to add it to today&apos;s queue.</span>
          <FormField label="Reminder" value={reminder.title} onChange={(value) => setReminder((current) => ({ ...current, title: value }))} placeholder="What needs to happen?" />
          <label>Run at<input type="datetime-local" value={reminder.runAt} onChange={(event) => setReminder((current) => ({ ...current, runAt: event.target.value }))} /></label>
          <button className="mini-button" type="button" onClick={() => setReminder((current) => ({ ...current, runAt: '' }))}>Run today</button>
          <button className="ghost-button" type="button" onClick={queueReminder}>Queue Reminder</button>
        </div>
        <div className="backend-health">
          <strong>Output counter</strong>
          <span>{backendState.health?.backupCount ?? 0} backups - {backendState.health?.exportCount ?? 0} exports - {backendState.health?.supportBundleCount ?? 0} bundles</span>
          <small>Everything created here lands in the local OverHead data folder. Protect generated files and use only the minimum needed in a support request.</small>
        </div>
      </div>
    </section>
  )
}

const configurableIdEntities = [['cust', 'Customers'], ['task', 'Tasks'], ['quote', 'Quotes'], ['invoice', 'Invoices'], ['expense', 'Expenses'], ['appointment', 'Appointments'], ['document', 'Documents']]

function AccountsSection({ backendState, session, refreshBackend, setOperationNotice }) {
  const firstUser = backendState.userProfiles?.[0]
  const [selectedEmail, setSelectedEmail] = useState(firstUser?.email || '')
  const [draft, setDraft] = useState({
    email: firstUser?.email || 'owner@overhead.local',
    ownerName: firstUser?.owner_name || '',
    businessName: firstUser?.business_name || '',
    role: firstUser?.role || 'Owner',
    status: firstUser?.status || 'Active',
  })
  const [staffDraft, setStaffDraft] = useState({
    ownerName: '',
    businessName: firstUser?.business_name || '',
    email: '',
    role: 'Front Desk',
    temporaryPassword: '',
  })
  const [approvalDraft, setApprovalDraft] = useState({
    actionType: 'quote_send',
    title: '',
    details: '',
    amount: '',
  })
  const [approvalPolicies, setApprovalPolicies] = useState([])
  const [routeRole, setRouteRole] = useState('Owner')
  const [routeThreshold, setRouteThreshold] = useState('')
  const [recordIdRules, setRecordIdRules] = useState([])
  const [recordIdEntity, setRecordIdEntity] = useState('cust')
  const [recordIdPrefix, setRecordIdPrefix] = useState('')
  const [recordIdNext, setRecordIdNext] = useState('1')

  useEffect(() => {
    if (session?.role !== 'Owner' || !window.overheadBackend?.listFeatureRecords) return
    window.overheadBackend.listFeatureRecords('security').then((records) => {
      const policy = records.find((record) => record.id === 'approval-routing-policy')
      setApprovalPolicies(Array.isArray(policy?.rules) ? policy.rules : [])
      const idPolicy = records.find((record) => record.id === 'record-id-policy')
      setRecordIdRules(Array.isArray(idPolicy?.rules) ? idPolicy.rules : [])
    }).catch(() => setApprovalPolicies([]))
  }, [session?.role])

  useEffect(() => {
    const rule = approvalPolicies.find((item) => item.action_type === approvalDraft.actionType)
    setRouteRole(rule?.approver_role || 'Owner')
    setRouteThreshold(rule ? String(rule.threshold) : '')
  }, [approvalDraft.actionType, approvalPolicies])

  useEffect(() => {
    const rule = recordIdRules.find((item) => item.entity_prefix === recordIdEntity)
    setRecordIdPrefix(rule?.prefix || '')
    setRecordIdNext(rule ? String(rule.next_number) : '1')
  }, [recordIdEntity, recordIdRules])

  async function updateUser() {
    if (!window.overheadBackend?.updateUser) return
    await window.overheadBackend.updateUser(draft)
    setOperationNotice('User profile updated.')
    await refreshBackend()
  }

  function updateDraft(key, value) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function selectUser(user) {
    setSelectedEmail(user.email)
    setDraft({
      email: user.email,
      ownerName: user.owner_name || '',
      businessName: user.business_name || '',
      role: user.role || 'Owner',
      status: user.status || 'Active',
    })
  }

  function updateStaffDraft(key, value) {
    setStaffDraft((current) => ({ ...current, [key]: value }))
  }

  function updateApprovalDraft(key, value) {
    setApprovalDraft((current) => ({ ...current, [key]: value }))
  }

  async function createStaffAccount() {
    if (!window.overheadBackend?.createStaffAccount) return
    const result = await window.overheadBackend.createStaffAccount(staffDraft)
    setOperationNotice(`Staff verification ${result.delivery?.status || 'queued'} for ${staffDraft.email}.`)
    setStaffDraft({ ownerName: '', businessName: firstUser?.business_name || '', email: '', role: 'Front Desk', temporaryPassword: '' })
    await refreshBackend()
  }

  async function createApproval() {
    if (!window.overheadBackend?.createApprovalRequest || !approvalDraft.title) return
    await window.overheadBackend.createApprovalRequest({ ...approvalDraft, amount: approvalDraft.amount === '' ? undefined : Number(approvalDraft.amount) })
    setOperationNotice('Management approval request created.')
    setApprovalDraft((current) => ({ ...current, title: '', details: '', amount: '' }))
    await refreshBackend()
  }

  async function saveApprovalRoute() {
    const threshold = Number(routeThreshold)
    if (!Number.isFinite(threshold) || threshold < 0) { setOperationNotice('Enter a non-negative amount threshold for this approval route.'); return }
    const rule = { action_type: approvalDraft.actionType, threshold, approver_role: routeRole }
    const rules = [...approvalPolicies.filter((item) => item.action_type !== rule.action_type), rule]
    await window.overheadBackend.upsertFeatureRecord({ collection: 'security', record: { id: 'approval-routing-policy', kind: 'approval-routing-policy', rules } })
    setApprovalPolicies(rules)
    setOperationNotice(`Approval route saved. Requests up to ${threshold} go to ${routeRole}; higher amounts stay with an Owner.`)
  }

  async function saveRecordIdRule() {
    const prefix = recordIdPrefix.trim().toUpperCase()
    const nextNumber = Number(recordIdNext)
    if (prefix && (!/^[A-Z][A-Z0-9-]{1,7}$/.test(prefix) || !Number.isSafeInteger(nextNumber) || nextNumber < 1 || nextNumber > 999999999)) {
      setOperationNotice('Use a 2–8 character prefix with letters, numbers, or hyphens and a next number from 1 to 999,999,999.')
      return
    }
    if (prefix && recordIdRules.some((item) => item.entity_prefix !== recordIdEntity && item.prefix === prefix)) {
      setOperationNotice('That prefix is already assigned to another record type. Choose a unique prefix.')
      return
    }
    const rules = recordIdRules.filter((item) => item.entity_prefix !== recordIdEntity)
    if (prefix) rules.push({ entity_prefix: recordIdEntity, prefix, next_number: nextNumber })
    await window.overheadBackend.upsertFeatureRecord({ collection: 'security', record: { id: 'record-id-policy', kind: 'record-id-policy', rules } })
    setRecordIdRules(rules)
    setOperationNotice(prefix ? `${configurableIdEntities.find(([key]) => key === recordIdEntity)?.[1]} will use ${prefix}-NNNNN for new records from ${prefix}-${String(nextNumber).padStart(5, '0')}. Existing IDs are unchanged.` : `Custom IDs disabled for ${configurableIdEntities.find(([key]) => key === recordIdEntity)?.[1]}; new records will use the default IDs.`)
  }

  async function decideApproval(approvalId, decision) {
    if (!window.overheadBackend?.decideApprovalRequest) return
    await window.overheadBackend.decideApprovalRequest({ approvalId, decision, notes: `${decision} from account manager panel.` })
    setOperationNotice(`Approval ${decision.toLowerCase()}.`)
    await refreshBackend()
  }

  return (
    <section className="panel page-panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">Accounts</p>
          <h2>Profiles, responsibility, and access</h2>
        </div>
        <UserRoundCog size={20} />
      </div>
      <div className="settings-layout">
        <div className="feature-list">
          {(backendState.userProfiles || []).map((user) => (
            <button className={selectedEmail === user.email ? 'support-item profile-card selected' : 'support-item profile-card'} type="button" key={user.id} onClick={() => selectUser(user)}>
              <strong>{user.owner_name || user.email}</strong>
              <span>{user.role} - {user.status} - {user.email_verified ? 'Verified' : 'Email pending'}</span>
              <p>{user.email} Â· {user.profile_completion?.percent ?? 0}% profile ready</p>
              <small>{user.profile_completion?.next_step || 'Select to manage this profile.'}</small>
            </button>
          ))}
          <div className="backend-health">
            <strong>Profile standard</strong>
            <span>Give each person only the role they need. Verify the email, keep the business name current, and suspend access as soon as it is no longer needed.</span>
            <small>Role changes, staff access, exports, restores, and billing changes can be routed through management approval.</small>
          </div>
          <div className="support-item support-form">
            <strong>Invite staff with a defined role</strong>
            <FormField label="Name" value={staffDraft.ownerName} onChange={(value) => updateStaffDraft('ownerName', value)} placeholder="Staff name" />
            <FormField label="Email" value={staffDraft.email} onChange={(value) => updateStaffDraft('email', value)} placeholder="staff@example.com" />
            <FormField label="Temporary password" value={staffDraft.temporaryPassword} onChange={(value) => updateStaffDraft('temporaryPassword', value)} placeholder="Minimum 12 characters" />
            <label>
              Role
              <select value={staffDraft.role} onChange={(event) => updateStaffDraft('role', event.target.value)}>
                <option>Front Desk</option>
                <option>Bookkeeper</option>
                <option>Support</option>
              </select>
            </label>
            <small>Use a temporary password only for first access. The invitee should replace it immediately and should never share it.</small>
            <button className="ghost-button" type="button" onClick={createStaffAccount}>Create Staff Account</button>
          </div>
        </div>
        <div className="profile-form">
          <div className="backend-health profile-summary">
            <strong>{draft.ownerName || draft.email || 'Selected profile'}</strong>
            <span>{(backendState.userProfiles || []).find((user) => user.email === draft.email)?.profile_completion?.percent ?? 0}% complete Â· {(backendState.userProfiles || []).find((user) => user.email === draft.email)?.profile_completion?.next_step || 'Complete profile details.'}</span>
            <span>Workspace: {(backendState.userProfiles || []).find((user) => user.email === draft.email)?.workspace_id || 'Local workspace'} Â· License: {(backendState.userProfiles || []).find((user) => user.email === draft.email)?.license_number || 'Pending'}</span>
            <span>Shared profile: {(backendState.userProfiles || []).find((user) => user.email === draft.email)?.shared_sync_status || 'Local only'}</span>
          </div>
          <label>
            Email (account ID)
            <input value={draft.email} readOnly aria-readonly="true" />
          </label>
          <FormField label="Name" value={draft.ownerName} onChange={(value) => updateDraft('ownerName', value)} placeholder="Name" />
          <FormField label="Business" value={draft.businessName} onChange={(value) => updateDraft('businessName', value)} placeholder="Business" />
          <label>
            Role
            <select value={draft.role} onChange={(event) => updateDraft('role', event.target.value)}>
              <option>Owner</option>
              <option>Front Desk</option>
              <option>Bookkeeper</option>
              <option>Support</option>
            </select>
          </label>
          <label>
            Status
            <select value={draft.status} onChange={(event) => updateDraft('status', event.target.value)}>
              <option>Active</option>
              <option>Suspended</option>
            </select>
          </label>
          <button className="primary-action" type="button" onClick={updateUser}>Save Account</button>
          <div className="backend-health">
            <strong>Management approvals</strong>
            <span>Use this record when an action needs owner review before it changes customer records, money, access, or recovery state.</span>
            <label>
              Request type
              <select value={approvalDraft.actionType} onChange={(event) => updateApprovalDraft('actionType', event.target.value)}>
                <option value="quote_send">Quote send</option>
                <option value="data_export">Data export</option>
                <option value="billing_change">Billing change</option>
                <option value="customer_edit">Customer edit</option>
                <option value="restore">Restore</option>
                <option value="staff_access">Staff access</option>
                <option value="policy_change">Policy change</option>
              </select>
            </label>
            <FormField label="Title" value={approvalDraft.title} onChange={(value) => updateApprovalDraft('title', value)} placeholder="What needs approval?" />
            <FormField label="Details" value={approvalDraft.details} onChange={(value) => updateApprovalDraft('details', value)} placeholder="Why it needs management approval" />
            <FormField label="Amount (optional)" value={approvalDraft.amount} onChange={(value) => updateApprovalDraft('amount', value)} placeholder="0.00" />
            <button className="ghost-button" type="button" onClick={createApproval}>Request Approval</button>
            {session?.role === 'Owner' && <div className="profile-form compact-form">
              <strong>Conditional route for {approvalDraft.actionType.replaceAll('_', ' ')}</strong>
              <label>At or below this amount<select value={routeRole} onChange={(event) => setRouteRole(event.target.value)}><option>Owner</option><option>Bookkeeper</option><option>Front Desk</option><option>Support</option></select></label>
              <FormField label="Maximum amount for this role" value={routeThreshold} onChange={setRouteThreshold} placeholder="For example, 250" />
              <button className="ghost-button" type="button" onClick={saveApprovalRoute}>Save conditional route</button>
              <small>Requests over the threshold route to an Owner. The backend verifies the assigned reviewer and prevents requesters from approving their own requests.</small>
            </div>}
          </div>
          <div className="approval-list">
            {(backendState.approvalRequests || []).slice(0, 6).map((approval) => (
              <article key={approval.id}>
                <div>
                  <strong>{approval.title}</strong>
                  <span>{approval.action_type} - {approval.status}</span>
                  <small>{approval.requested_by} to {approval.approver_role || 'Owner'} ({approval.approver_email || approval.manager_email}){approval.amount !== undefined ? ` · ${approval.amount}` : ''}</small>
                </div>
                {approval.status === 'Pending' && (session?.role === 'Owner' || (approval.approver_email === session?.email && approval.approver_role === session?.role)) && (
                  <div className="button-row">
                    <button className="mini-button" type="button" onClick={() => decideApproval(approval.id, 'Approved')}>Approve</button>
                    <button className="mini-button" type="button" onClick={() => decideApproval(approval.id, 'Rejected')}>Reject</button>
                  </div>
                )}
              </article>
            ))}
          </div>
          {session?.role === 'Owner' && <div className="backend-health">
            <strong>Configurable record IDs</strong>
            <span>Set a prefix and starting number for new records. Existing records keep their IDs; leave the prefix empty to use the default random IDs.</span>
            <label>Record type<select value={recordIdEntity} onChange={(event) => setRecordIdEntity(event.target.value)}>{configurableIdEntities.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <FormField label="Prefix (2–8 characters)" value={recordIdPrefix} onChange={setRecordIdPrefix} placeholder="For example, CUS" />
            <FormField label="Next number" value={recordIdNext} onChange={setRecordIdNext} placeholder="1" />
            <button className="ghost-button" type="button" onClick={saveRecordIdRule}>Save ID format</button>
          </div>}
        </div>
      </div>
      <AccountGovernancePanel backendState={backendState} session={session} setOperationNotice={setOperationNotice} />
    </section>
  )
}

function LicensesSection({ backendState, refreshBackend, setOperationNotice }) {
  const [employee, setEmployee] = useState({
    employeeName: '',
    email: '',
    jobTitle: '',
    accessLevel: 'Support',
    expiresAt: '',
  })

  function updateEmployee(key, value) {
    setEmployee((current) => ({ ...current, [key]: value }))
  }

  async function refreshUserLicense(email) {
    if (!window.overheadBackend?.refreshUserLicense) return
    await window.overheadBackend.refreshUserLicense({ email })
    setOperationNotice(`License refreshed for ${email}.`)
    await refreshBackend()
  }

  async function issueEmployeeLicense() {
    if (!window.overheadBackend?.createEmployeeLicense) return
    await window.overheadBackend.createEmployeeLicense(employee)
    setOperationNotice(`OverHead employee license issued to ${employee.email}.`)
    setEmployee({ employeeName: '', email: '', jobTitle: '', accessLevel: 'Support', expiresAt: '' })
    await refreshBackend()
  }

  async function changeEmployeeStatus(employeeLicenseId, status) {
    if (!window.overheadBackend?.updateEmployeeLicense) return
    await window.overheadBackend.updateEmployeeLicense({ employeeLicenseId, status })
    setOperationNotice(`Employee license marked ${status.toLowerCase()}.`)
    await refreshBackend()
  }

  return (
    <section className="panel page-panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">Licensing</p>
          <h2>Profile subscriptions and OverHead team access</h2>
        </div>
        <BadgeCheck size={20} />
      </div>
      <p className="section-copy">Every OverHead user profile has its own license number and is linked to a subscription number. Internal OverHead employees are kept in a separate, owner-managed license register.</p>
      <div className="settings-layout">
        <div className="feature-list">
          <div className="support-item">
            <strong>User licenses</strong>
            <span>{(backendState.licenses || []).length} profile-linked license{(backendState.licenses || []).length === 1 ? '' : 's'}</span>
          </div>
          {(backendState.licenses || []).map((license) => (
            <div className="support-item" key={license.id}>
              <strong>{license.holder_name || license.email}</strong>
              <span>{license.status} - {license.tier} plan</span>
              <p>License: {license.license_number}<br />Subscription: {license.subscription_number}</p>
              <small>{license.email} - renewed {license.renewed_at ? new Date(license.renewed_at).toLocaleDateString() : 'not yet'}</small>
              <button className="mini-button" type="button" onClick={() => refreshUserLicense(license.email)}>Refresh License</button>
            </div>
          ))}
        </div>
        <div className="profile-form">
          <div className="backend-health">
            <strong>OverHead employee licenses</strong>
            <span>These are separate from customer-business staff accounts. Only an OverHead owner can issue or suspend them.</span>
          </div>
          <FormField label="Employee name" value={employee.employeeName} onChange={(value) => updateEmployee('employeeName', value)} placeholder="Employee name" />
          <FormField label="Employee email" value={employee.email} onChange={(value) => updateEmployee('email', value)} placeholder="employee@overhead.com" />
          <FormField label="Job title" value={employee.jobTitle} onChange={(value) => updateEmployee('jobTitle', value)} placeholder="Support specialist" />
          <label>Access level
            <select value={employee.accessLevel} onChange={(event) => updateEmployee('accessLevel', event.target.value)}>
              <option>Support</option><option>Operations</option><option>Management</option><option>Administrator</option>
            </select>
          </label>
          <label>Expiration date (optional)<input type="date" value={employee.expiresAt} onChange={(event) => updateEmployee('expiresAt', event.target.value)} /></label>
          <button className="primary-action" type="button" onClick={issueEmployeeLicense}>Issue Employee License</button>
          <div className="approval-list license-list">
            {(backendState.employeeLicenses || []).map((license) => (
              <article key={license.id}>
                <div>
                  <strong>{license.employee_name} - {license.status}</strong>
                  <span>{license.job_title} - {license.access_level}</span>
                  <small>Employee: {license.employee_number}<br />License: {license.employee_license_number}</small>
                </div>
                <div className="button-row">
                  {license.status !== 'Active' && <button className="mini-button" type="button" onClick={() => changeEmployeeStatus(license.id, 'Active')}>Restore</button>}
                  {license.status === 'Active' && <button className="mini-button" type="button" onClick={() => changeEmployeeStatus(license.id, 'Suspended')}>Suspend</button>}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function CylinderPlanPanel({ backendState }) {
  const entitlement = backendState?.entitlements
  const subscription = entitlement?.subscription
  const trialEnd = subscription?.trial_ends_at
  return <section className="panel page-panel" aria-label="Cylinder deployment">
    <p className="eyebrow">OverHead Cylinder</p>
    <h2>Your server workspace</h2>
    <p>Cylinder runs on Windows Server or Windows IoT. Records, documents, and backups stay on this host unless you explicitly export or synchronize supported records.</p>
    {entitlement && <div className="billing-protection-note" role="status">
      <strong>{subscription?.payment_status === 'trial' ? 'Evaluation active' : entitlement.activeTier === 'cylinder' ? 'Cylinder access active' : 'Cylinder access needs activation'}</strong>
      <span>{trialEnd ? `Evaluation ends ${new Date(trialEnd).toLocaleDateString()}. No automatic charge or renewal.` : `Current access: ${entitlement.activePlan?.name || 'Silver'}.`}</span>
    </div>}
    <p>Continued Cylinder access is arranged through your deployment agreement. Contact support to arrange activation or discuss billing and cancellation.</p>
    <a className="ghost-button" href="https://overhead-office.web.app/contact/" target="_blank" rel="noreferrer">Contact deployment support</a>
    {backendState?.health && <div className="backend-health">
      <strong>Host and storage</strong>
      <span>Host: {backendState.health.deviceName}</span>
      <span>Local data: {backendState.health.dataRoot}</span>
      <span>Customers: {entitlement?.usage?.customers ?? 0} / {entitlement?.activePlan?.maxCustomers ?? 'â€”'}</span>
      <span>Users: {entitlement?.usage?.users ?? 0} / {entitlement?.activePlan?.maxUsers ?? 'â€”'}</span>
      <span>Updates: Cylinder channel</span>
    </div>}
  </section>
}

function PlansSection(props) {
  return cylinderMode ? <CylinderPlanPanel backendState={props.backendState} /> : <DesktopPlansSection {...props} />
}

function DesktopPlansSection({ backendState, activePlan, setActivePlan, draftSession, refreshBackend, setOperationNotice }) {
  const savedBilling = backendState.savedFormMemory?.billing || {}
  const [billing, setBilling] = useState({
    legalName: savedBilling.legalName || '',
    billingEmail: savedBilling.billingEmail || draftSession.email || 'owner@overhead.local',
    phone: savedBilling.phone || '',
    addressLine1: savedBilling.addressLine1 || '',
    addressLine2: savedBilling.addressLine2 || '',
    city: savedBilling.city || '',
    region: savedBilling.region || '',
    postalCode: savedBilling.postalCode || '',
    country: savedBilling.country || 'US',
    taxIdType: savedBilling.taxIdType || '',
    taxIdLast4: '',
    invoiceTerms: savedBilling.invoiceTerms || 'Due on receipt',
    invoiceFooter: savedBilling.invoiceFooter || 'Thank you for using OverHead.',
    consentToRecurringBilling: false,
    cancellationPathAcknowledged: false,
    billingPolicyAcknowledged: false,
    freeTrialPolicyAcknowledged: false,
  })
  const [checkout, setCheckout] = useState(null)
  const [billingError, setBillingError] = useState('')
  const [billingBusy, setBillingBusy] = useState(false)
  const [billingActivity, setBillingActivity] = useState([])

  async function persistBillingProfile() {
    if (!window.overheadBackend?.saveBillingProfile) return
    await window.overheadBackend.saveBillingProfile({ ...billing, managerEmail: draftSession.email || 'owner@overhead.local' })
  }

  async function saveBillingAndTier() {
    if (billingBusy) return
    try {
      setBillingError('')
      setBillingBusy(true)
      await persistBillingProfile()
      setOperationNotice('Billing profile saved. Complete secure checkout to activate a paid tier.')
      await refreshBackend()
    } catch (error) { setBillingError(userFacingError(error, 'The billing profile could not be saved.')) }
    finally { setBillingBusy(false) }
  }

  async function openEmbeddedCheckout() {
    if (billingBusy) return
    try {
      setBillingError('')
      setBillingBusy(true)
      await persistBillingProfile()
      if (!window.overheadBackend?.createEmbeddedCheckout) throw new Error('The secure billing service is not available in this build yet.')
      const result = await window.overheadBackend.createEmbeddedCheckout({ tier: activePlan, acceptBillingPolicy: billing.billingPolicyAcknowledged })
      if (result.alreadySubscribed) {
        setOperationNotice(result.message || `You already have the ${selectedPlanName(activePlan)} plan. No charge was created.`)
        return
      }
      setCheckout(result)
    } catch (error) { setBillingError(userFacingError(error, 'Secure checkout could not be opened.')) }
    finally { setBillingBusy(false) }
  }

  async function startFreeGoldTrial() {
    const confirmed = window.confirm('Start your one free 90-day Gold trial? No card is required and no charge will be made.')
    if (!confirmed) return
    try {
      setBillingError('')
      setBillingBusy(true)
      if (!window.overheadBackend?.startFreeGoldTrial) throw new Error('The secure free-trial service is not available in this build yet.')
      const result = await window.overheadBackend.startFreeGoldTrial({ acceptTrialPolicy: billing.freeTrialPolicyAcknowledged })
      await window.overheadBackend?.getRemoteEntitlements?.()
      await refreshBackend()
      setActivePlan('gold')
      setOperationNotice(`Free Gold trial started â€” no card charged. It ends ${new Date(result.trialEndsAt).toLocaleDateString()}.`)
    } catch (error) { setBillingError(userFacingError(error, 'The free trial could not be started.')) }
    finally { setBillingBusy(false) }
  }

  async function createReceipt() {
    try {
      if (!window.overheadBackend?.createSubscriptionReceipt) throw new Error('The receipt service is not available.')
      const result = await window.overheadBackend.createSubscriptionReceipt()
      setOperationNotice(`Full subscription receipt created: ${result.pdfPath}`)
    } catch (error) { setBillingError(userFacingError(error, 'The subscription receipt could not be created.')) }
  }

  async function refreshBillingActivity() {
    try {
      setBillingError('')
      if (!window.overheadBackend?.getRemoteBillingActivity) throw new Error('The secure billing activity service is not available in this build yet.')
      const result = await window.overheadBackend.getRemoteBillingActivity()
      setBillingActivity(result.events || [])
    } catch (error) { setBillingError(userFacingError(error, 'Billing activity could not be refreshed.')) }
  }

  async function cancelWithUnusedTimeRefund() {
    const confirmed = window.confirm('Cancel the subscription now? OverHead will calculate unused paid time and refund that amount to the original payment method. Access will end immediately.')
    if (!confirmed) return
    try {
      setBillingError('')
      setBillingBusy(true)
      if (!window.overheadBackend?.cancelSubscriptionWithUnusedTimeRefund) throw new Error('The secure cancellation service is not available in this build yet.')
      const result = await window.overheadBackend.cancelSubscriptionWithUnusedTimeRefund()
      const amount = Number(result.refundAmount || 0) / 100
      const refundSummary = result.refundStatus === 'not_applicable' ? 'No unused paid time was available to refund.' : `${amount.toLocaleString(undefined, { style: 'currency', currency: String(result.currency || 'usd').toUpperCase() })} was sent back to the original payment method.`
      await window.overheadBackend?.getRemoteEntitlements?.()
      await refreshBackend()
      setOperationNotice(`Subscription canceled. ${refundSummary}`)
    } catch (error) { setBillingError(userFacingError(error, 'The subscription could not be canceled and refunded.')) }
    finally { setBillingBusy(false) }
  }

  function updateBilling(key, value) {
    setBilling((current) => ({ ...current, [key]: value }))
  }

  return (
    <section className="panel page-panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">Plans</p>
          <h2>Billing profile and entitlements</h2>
        </div>
        <BadgeCheck size={20} />
      </div>
      <div className="plan-grid">
        {planTiers.map((plan) => (
          <button className={activePlan === plan.id ? 'plan-card active' : 'plan-card'} type="button" key={plan.id} onClick={() => setActivePlan(plan.id)}>
            <strong>{plan.name} {!isPlanUnlocked(plan.id, backendState.entitlements?.activeTier) && <span className="lock-word">Locked</span>}</strong>
            <em>{plan.level}</em>
            <span>{plan.price}</span>
            <p>{plan.summary}</p>
            <small>{plan.audience}</small>
            <ul>
              {plan.features.map((feature) => {
                const unlocked = isPlanUnlocked(plan.id, backendState.entitlements?.activeTier)
                return <li className={unlocked ? 'unlocked-feature' : 'locked-feature'} key={feature}>{unlocked ? 'Open' : 'Locked'} - {feature}</li>
              })}
            </ul>
          </button>
        ))}
      </div>
      <div className="billing-protection-note">
        <strong>Protected checkout</strong>
        <span>Before a charge is started, OverHead checks whether this workspace already has the selected plan and blocks duplicate checkout attempts.</span>
      </div>
      <div className="billing-protection-note">
        <strong>Free 90-day Gold trial</strong>
        <span>One per workspace. No card, no charge, and every Gold feature is available until the trial ends.</span>
      </div>
      <div className="billing-form">
        <FormField label="Legal billing name" value={billing.legalName} onChange={(value) => updateBilling('legalName', value)} placeholder="Business legal name" />
        <FormField label="Billing email" value={billing.billingEmail} onChange={(value) => updateBilling('billingEmail', value)} placeholder="billing@example.com" />
        <FormField label="Phone" value={billing.phone} onChange={(value) => updateBilling('phone', value)} placeholder="Billing phone" />
        <FormField label="Address line 1" value={billing.addressLine1} onChange={(value) => updateBilling('addressLine1', value)} placeholder="Street address" />
        <FormField label="Address line 2" value={billing.addressLine2} onChange={(value) => updateBilling('addressLine2', value)} placeholder="Suite, unit, optional" />
        <FormField label="City" value={billing.city} onChange={(value) => updateBilling('city', value)} placeholder="City" />
        <FormField label="State/region" value={billing.region} onChange={(value) => updateBilling('region', value)} placeholder="State" />
        <FormField label="Postal code" value={billing.postalCode} onChange={(value) => updateBilling('postalCode', value)} placeholder="ZIP" />
        <FormField label="Country" value={billing.country} onChange={(value) => updateBilling('country', value)} placeholder="US" />
        <FormField label="Tax ID type" value={billing.taxIdType} onChange={(value) => updateBilling('taxIdType', value)} placeholder="EIN, VAT, GST" />
        <FormField label="Tax ID last 4" value={billing.taxIdLast4} onChange={(value) => updateBilling('taxIdLast4', value)} placeholder="Last 4 only" />
        <FormField label="Invoice terms" value={billing.invoiceTerms} onChange={(value) => updateBilling('invoiceTerms', value)} placeholder="Due on receipt" />
        <FormField label="Invoice footer" value={billing.invoiceFooter} onChange={(value) => updateBilling('invoiceFooter', value)} placeholder="Footer text" />
        <label className="checkbox-line">
          <input type="checkbox" checked={billing.consentToRecurringBilling} onChange={(event) => updateBilling('consentToRecurringBilling', event.target.checked)} />
          I authorize recurring billing for the selected tier.
        </label>
        <label className="checkbox-line">
          <input type="checkbox" checked={billing.cancellationPathAcknowledged} onChange={(event) => updateBilling('cancellationPathAcknowledged', event.target.checked)} />
          I acknowledge the cancellation path must be available before launch.
        </label>
        <label className="checkbox-line">
          <input type="checkbox" checked={billing.billingPolicyAcknowledged} onChange={(event) => updateBilling('billingPolicyAcknowledged', event.target.checked)} />
          I have reviewed and accept the Subscription Billing &amp; Authorization Policy.
        </label>
        <label className="checkbox-line">
          <input type="checkbox" checked={billing.freeTrialPolicyAcknowledged} onChange={(event) => updateBilling('freeTrialPolicyAcknowledged', event.target.checked)} />
          I have reviewed and accept the Free Trial Policy before starting a free trial.
        </label>
        <button className="ghost-button" type="button" disabled={billingBusy} onClick={saveBillingAndTier}>{billingBusy ? 'Saving billing profileâ€¦' : 'Save Billing Profile'}</button>
        <button className="ghost-button" type="button" disabled={billingBusy} onClick={startFreeGoldTrial}>{billingBusy ? 'Starting trialâ€¦' : 'Start Free 90-Day Gold Trial'}</button>
        <button className="primary-action" type="button" disabled={billingBusy || !billing.billingPolicyAcknowledged} onClick={openEmbeddedCheckout}>{billingBusy ? 'Preparing secure checkoutâ€¦' : 'Continue To Secure Checkout'}</button>
        <button className="ghost-button" type="button" disabled={billingBusy} onClick={createReceipt}>Create Full Receipt PDF</button>
        <button className="ghost-button" type="button" disabled={billingBusy} onClick={refreshBillingActivity}>Refresh Billing Activity</button>
        <button className="ghost-button" type="button" disabled={billingBusy} onClick={cancelWithUnusedTimeRefund}>{billingBusy ? 'Processing cancellationâ€¦' : 'Cancel Now & Refund Unused Time'}</button>
      </div>
      <p className="form-hint">Free trial: one no-card, 90-day Gold-equivalent trial per workspace when secure billing services are enabled. Accept the billing policy above to enable secure checkout. Canceling a paid plan ends access immediately; the intended live flow calculates eligible unused time for a refund to the original payment method. Trial periods have no payment to refund.</p>
      {billingActivity.length > 0 && <div className="backend-health"><strong>Billing activity</strong>{billingActivity.map(([title, at, detail]) => <span key={`${title}-${at}`}>{title}: {new Date(at).toLocaleString()} {detail ? `â€” ${detail}` : ''}</span>)}</div>}
      <p className="plan-note">Active: {backendState.entitlements?.activePlan?.name || 'Silver'} / {backendState.entitlements?.activePlan?.level || 'Basic'}</p>
      {billingError && <p className="form-error" role="alert">{billingError}</p>}
      {checkout && <EmbeddedBillingCheckout checkout={checkout} onClose={() => setCheckout(null)} onComplete={async () => { setCheckout(null); await window.overheadBackend?.getRemoteEntitlements?.(); await refreshBackend(); setOperationNotice('Payment submitted. Your plan will update after Stripe confirms it.') }} />}
    </section>
  )
}

function EmbeddedBillingCheckout({ checkout, onClose, onComplete }) {
  const [error, setError] = useState('')
  const mountCheckout = useCallback(async () => {
    try {
      if (!window.Stripe) throw new Error('Stripe checkout could not be loaded.')
      const stripe = window.Stripe(checkout.publishableKey)
      const embedded = await stripe.initEmbeddedCheckout({ fetchClientSecret: async () => checkout.clientSecret, onComplete })
      embedded.mount('#overhead-embedded-checkout')
      return () => embedded.destroy()
    } catch (reason) { setError(userFacingError(reason, 'Stripe checkout could not be started.')); return undefined }
  }, [checkout, onComplete])
  useEffect(() => {
    let cleanup
    const existing = document.querySelector('script[data-overhead-stripe]')
    const ready = async () => { cleanup = await mountCheckout() }
    if (existing) ready()
    else {
      const script = document.createElement('script')
      script.src = 'https://js.stripe.com/clover/stripe.js'
      script.async = true
      script.dataset.overheadStripe = 'true'
      script.onload = ready
      script.onerror = () => setError('Stripe checkout could not be loaded. Check your connection and try again.')
      document.head.appendChild(script)
    }
    return () => { if (cleanup) cleanup() }
  }, [mountCheckout])
  return <div className="checkout-overlay" role="dialog" aria-modal="true" aria-label="Secure Stripe checkout"><div className="checkout-panel"><button className="mini-button" type="button" onClick={onClose}>Close</button><h3>Complete your plan securely</h3><p>Your card details go directly to Stripe. OverHead will update access only after Stripe confirms payment.</p><div id="overhead-embedded-checkout" />{error && <p className="form-error">{error}</p>}</div></div>
}

function PaymentsSection({ backendState, refreshBackend, setOperationNotice }) {
  const [stripeBusy, setStripeBusy] = useState(false)
  const [stripeError, setStripeError] = useState('')
  const connector = backendState.stripeConnector || {}
  async function runStripeAction(action) {
    if (stripeBusy) return
    setStripeBusy(true)
    setStripeError('')
    try { await action() }
    catch (error) { setStripeError(userFacingError(error, 'Stripe could not complete this action.')) }
    finally { setStripeBusy(false); await refreshBackend() }
  }
  async function syncBilling() {
    const result = await window.overheadBackend.syncStripeBilling()
    setOperationNotice(result.message)
  }
  const [stripeDraft, setStripeDraft] = useState({ mode: 'test', clientId: '', accountId: '', publishableKey: '' })
  const [importDraft, setImportDraft] = useState({ accountId: '', businessName: '', managerEmail: '', purchasedTier: 'silver', paymentStatus: 'paid', externalCustomerId: '', externalSubscriptionId: '', customerCount: 0, subscriptionCount: 0, invoiceCount: 0, paymentCount: 0 })

  function updateStripeDraft(key, value) {
    setStripeDraft((current) => ({ ...current, [key]: value }))
  }

  function updateImportDraft(key, value) {
    setImportDraft((current) => ({ ...current, [key]: value }))
  }

  async function openStripe() {
    const result = await window.overheadBackend.openStripeAuthorization()
    setOperationNotice(result.message)
  }

  async function saveStripe() {
    await window.overheadBackend.saveStripeConnection(stripeDraft)
    setOperationNotice('Test details saved. Account authorization has not been verified.')
    await refreshBackend()
  }

  async function importStripe() {
    await window.overheadBackend.importStripeSnapshot(importDraft)
    setOperationNotice('Stripe summary imported.')
    await refreshBackend()
  }

  return (
    <section className="panel page-panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">Stripe</p>
          <h2>Connect payments</h2>
        </div>
        <ReceiptText size={20} />
      </div>
      {stripeError && <p className="form-error" role="alert">{stripeError}</p>}
      <div className="backend-health" aria-live="polite">
        <strong>Shared billing: {connector.status || 'Not checked'}</strong>
        <span>{connector.sharedSignIn ? 'Shared account signed in' : 'Shared account sign-in required'}</span>
        <span>{connector.tier ? `${connector.tier.toUpperCase()} â€” ${String(connector.billing_status || '').replaceAll('_', ' ')}` : 'Sync to check the plan shown on your website account.'}</span>
        <span>{connector.message}</span>
        <small>Last successful sync: {connector.last_synced_at ? new Date(connector.last_synced_at).toLocaleString() : 'Never'}. Refreshes every five minutes while signed in.</small>
        <button className="primary-action" type="button" disabled={stripeBusy || !connector.sharedSignIn} onClick={() => runStripeAction(syncBilling)}>{stripeBusy ? 'Workingâ€¦' : 'Sync Shared Plan and License'}</button>
        <small>This checks OverHeadâ€™s shared billing records. It does not authorize a Stripe merchant account or charge a card.</small>
      </div>
      <div className="tool-grid">
        <div className="backend-health">
          <strong>Step 1: Prepare test mode in browser</strong>
          <span>OverHead opens Stripeâ€™s test dashboard. Live checkout, webhooks, and payment confirmation stay disabled until the secure server is deployed.</span>
          <button className="primary-action" type="button" disabled={stripeBusy} onClick={() => runStripeAction(openStripe)}>Open Stripe Test Dashboard</button>
        </div>
        <div className="backend-health">
          <strong>Step 2: Save non-secret test details</strong>
          <label>
            Mode
            <input value="Test only" readOnly />
          </label>
          <FormField label="Client ID" value={stripeDraft.clientId} onChange={(value) => updateStripeDraft('clientId', value)} placeholder="ca_..." />
          <FormField label="Account ID" value={stripeDraft.accountId} onChange={(value) => updateStripeDraft('accountId', value)} placeholder="acct_..." />
          <FormField label="Publishable key" value={stripeDraft.publishableKey} onChange={(value) => updateStripeDraft('publishableKey', value)} placeholder="pk_test_..." />
          <p className="form-hint">Never enter secret keys or webhook signing secrets in OverHead. Those belong only in the future server environment.</p>
          <button className="ghost-button" type="button" disabled={stripeBusy} onClick={() => runStripeAction(saveStripe)}>Save Test Details</button>
        </div>
        <div className="backend-health">
          <strong>Step 3: Record test-only reference data</strong>
          <FormField label="Business name" value={importDraft.businessName} onChange={(value) => updateImportDraft('businessName', value)} placeholder="Business name" />
          <FormField label="Account ID" value={importDraft.accountId} onChange={(value) => updateImportDraft('accountId', value)} placeholder="acct_..." />
          <FormField label="Manager email" value={importDraft.managerEmail} onChange={(value) => updateImportDraft('managerEmail', value)} placeholder="manager@example.com" />
          <label>
            Paid tier
            <select value={importDraft.purchasedTier} onChange={(event) => updateImportDraft('purchasedTier', event.target.value)}>
              <option value="silver">Silver</option>
              <option value="gold">Gold</option>
              <option value="black">Black</option>
            </select>
          </label>
          <label>
            Payment status
            <select value={importDraft.paymentStatus} onChange={(event) => updateImportDraft('paymentStatus', event.target.value)}>
              <option value="paid">Paid</option>
              <option value="trial">Trial</option>
              <option value="past_due">Past due</option>
              <option value="canceled">Canceled</option>
            </select>
          </label>
          <FormField label="Stripe customer ID" value={importDraft.externalCustomerId} onChange={(value) => updateImportDraft('externalCustomerId', value)} placeholder="cus_..." />
          <FormField label="Stripe subscription ID" value={importDraft.externalSubscriptionId} onChange={(value) => updateImportDraft('externalSubscriptionId', value)} placeholder="sub_..." />
          <FormField label="Customers" value={String(importDraft.customerCount)} onChange={(value) => updateImportDraft('customerCount', value)} placeholder="0" />
          <FormField label="Subscriptions" value={String(importDraft.subscriptionCount)} onChange={(value) => updateImportDraft('subscriptionCount', value)} placeholder="0" />
          <FormField label="Invoices" value={String(importDraft.invoiceCount)} onChange={(value) => updateImportDraft('invoiceCount', value)} placeholder="0" />
          <FormField label="Payments" value={String(importDraft.paymentCount)} onChange={(value) => updateImportDraft('paymentCount', value)} placeholder="0" />
          <button className="ghost-button" type="button" disabled={stripeBusy} onClick={() => runStripeAction(importStripe)}>Save Test Reference</button>
          <p className="form-hint">Saving reference data never changes a subscription or grants paid access. Only a verified server webhook will do that.</p>
        </div>
        <div className="backend-health">
          <strong>Saved Stripe data</strong>
          <span>{backendState.stripeConnections?.length ?? 0} connections - {backendState.stripeImports?.length ?? 0} imports - {backendState.paymentRecords?.length ?? 0} payments read</span>
          {(backendState.stripeImports || []).slice(0, 3).map((item) => <small key={item.id}>{item.business_name || item.account_id} - {item.payment_count} payments</small>)}
        </div>
      </div>
    </section>
  )
}

function ImportsSection({ backendState, refreshBackend, setOperationNotice }) {
  const [connectionDraft, setConnectionDraft] = useState({ provider: 'graph', clientId: '', tenantId: 'organizations', environment: 'Production' })
  const [deviceCode, setDeviceCode] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [preview, setPreview] = useState(null)
  const [companyId, setCompanyId] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const connections = backendState.microsoftConnections || []

  useEffect(() => {
    if (!window.overheadDesktop?.onMicrosoftDeviceCode) return undefined
    return window.overheadDesktop.onMicrosoftDeviceCode((details) => setDeviceCode(details))
  }, [])

  function updateConnection(key, value) {
    setConnectionDraft((current) => ({ ...current, [key]: value }))
    setPreview(null)
    setDeviceCode(null)
  }

  async function connect() {
    try {
      setConnecting(true)
      setDeviceCode(null)
      setOperationNotice('Microsoft sign-in opened in your default browser. Complete the prompt there; OverHead never sees your password.')
      const result = await window.overheadBackend.connectMicrosoft(connectionDraft)
      setOperationNotice(`${result.provider === 'graph' ? 'Microsoft 365' : 'Business Central'} connected for ${result.connection?.account_username || 'your account'}.`)
      await refreshBackend()
    } catch (error) {
      setOperationNotice(userFacingError(error, 'Microsoft connection did not complete.'))
    } finally {
      setConnecting(false)
    }
  }

  async function previewConnection(connection, requestedCompanyId = '') {
    try {
      const result = await window.overheadBackend.previewMicrosoftImport({ connectionId: connection.id, companyId: requestedCompanyId })
      setPreview({ ...result, connection })
      setCompanyId(requestedCompanyId)
      setSelectedIds((result.records || []).map((record) => record.id))
      setOperationNotice(result.companyRequired ? 'Choose the Business Central company, then preview its customers.' : `${result.records?.length || 0} records are ready for review. Nothing has been imported yet.`)
    } catch (error) {
      setOperationNotice(userFacingError(error, 'Could not preview Microsoft records.'))
    }
  }

  async function importSelected() {
    if (!preview?.previewId) return
    try {
      const result = await window.overheadBackend.importMicrosoftPreview({ previewId: preview.previewId, selectedIds })
      setOperationNotice(`Imported ${result.imported} customer record${result.imported === 1 ? '' : 's'}; skipped ${result.skipped} duplicate or plan-limit record${result.skipped === 1 ? '' : 's'}.`)
      setPreview(null)
      setSelectedIds([])
      await refreshBackend()
    } catch (error) {
      setOperationNotice(userFacingError(error, 'Could not import the selected Microsoft records.'))
    }
  }

  function toggleRecord(id) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  return (
    <section className="panel page-panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">Optional integrations</p>
          <h2>Bring useful Microsoft records into OverHead</h2>
        </div>
        <CloudDownload size={20} />
      </div>
      <div className="tool-grid">
        <div className="backend-health">
          <strong>1. Connect Microsoft safely</strong>
          <span>OverHead sends you to Microsoftâ€™s sign-in page. It never collects, stores, or displays your Microsoft password. The encrypted local connection is read-only until you choose records to import.</span>
          <label>
            Source
            <select value={connectionDraft.provider} onChange={(event) => updateConnection('provider', event.target.value)}>
              <option value="graph">Microsoft 365 contacts (Outlook)</option>
              <option value="business_central">Dynamics 365 Business Central customers</option>
            </select>
          </label>
          <FormField label="Microsoft Entra application (client) ID" value={connectionDraft.clientId} onChange={(value) => updateConnection('clientId', value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
          <FormField label="Tenant ID or domain" value={connectionDraft.tenantId} onChange={(value) => updateConnection('tenantId', value)} placeholder="organizations or your tenant GUID" />
          {connectionDraft.provider === 'business_central' && <FormField label="Business Central environment" value={connectionDraft.environment} onChange={(value) => updateConnection('environment', value)} placeholder="Production" />}
          <button className="primary-action" type="button" onClick={connect} disabled={connecting}>{connecting ? 'Waiting for Microsoftâ€¦' : 'Connect With Microsoft'}</button>
          <p className="form-hint">The Entra app must allow public-client device sign-in. Grant only Contacts.Read for Outlook contacts, or Business Central delegated user_impersonation for customer imports. Do not enter a client secret.</p>
        </div>
        <div className="backend-health">
          <strong>Microsoft verification</strong>
          {deviceCode ? <>
            <span>Microsoft opened in your browser. If it asks for a code, use:</span>
            <strong>{deviceCode.userCode}</strong>
            <small>{deviceCode.verificationUri}</small>
          </> : <span>When you connect, the browser opens automatically. This area will show a device code only if Microsoft asks for one.</span>}
        </div>
        <div className="backend-health">
          <strong>2. Preview before import</strong>
          <span>Previewing reads up to 50 records. Importing creates new local customer records only; it does not edit Microsoft data or overwrite an existing OverHead record.</span>
          {connections.length ? connections.map((connection) => (
            <button className="ghost-button" type="button" key={connection.id} onClick={() => previewConnection(connection)}>
              Preview {connection.provider === 'graph' ? 'Microsoft 365 contacts' : 'Business Central customers'} {connection.account_username ? `(${connection.account_username})` : ''}
            </button>
          )) : <small>Connect a Microsoft source first.</small>}
        </div>
        {preview?.companyRequired && (
          <div className="backend-health">
            <strong>Choose a Business Central company</strong>
            <label>
              Company
              <select value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
                <option value="">Select a company</option>
                {(preview.companies || []).map((company) => <option value={company.id} key={company.id}>{company.name}</option>)}
              </select>
            </label>
            <button className="primary-action" type="button" disabled={!companyId} onClick={() => previewConnection(preview.connection, companyId)}>Preview Company Customers</button>
          </div>
        )}
        {preview?.records?.length > 0 && (
          <div className="backend-health">
            <strong>3. Select records to add</strong>
            <span>{selectedIds.length} of {preview.records.length} selected. Duplicates are checked again at import time.</span>
            {preview.records.map((record) => (
              <label className="checkbox-line" key={record.id}>
                <input type="checkbox" checked={selectedIds.includes(record.id)} onChange={() => toggleRecord(record.id)} />
                {record.businessName}{record.email ? ` â€” ${record.email}` : ''}
              </label>
            ))}
            <button className="primary-action" type="button" onClick={importSelected} disabled={!selectedIds.length}>Import Selected Records</button>
          </div>
        )}
      </div>
    </section>
  )
}

function SquareSection({ backendState, refreshBackend, setOperationNotice }) {
  const [squareDraft, setSquareDraft] = useState({ environment: 'sandbox', applicationId: '', merchantId: '', locationId: '', accessToken: '', refreshToken: '' })
  const [importDraft, setImportDraft] = useState({ businessName: '', merchantId: '', locationName: '', locationId: '', customerCount: 0, catalogItemCount: 0, orderCount: 0, paymentCount: 0 })

  function updateSquareDraft(key, value) {
    setSquareDraft((current) => ({ ...current, [key]: value }))
  }

  function updateImportDraft(key, value) {
    setImportDraft((current) => ({ ...current, [key]: value }))
  }

  async function openSquare() {
    const result = await window.overheadBackend.openSquareAuthorization()
    setOperationNotice(result.applicationIdConfigured ? 'Square opened in your browser.' : 'Square opened. Add a Square application ID before production use.')
  }

  async function saveSquare() {
    await window.overheadBackend.saveSquareConnection(squareDraft)
    setOperationNotice('Square connection saved.')
    await refreshBackend()
  }

  async function importSquare() {
    await window.overheadBackend.importSquareSnapshot(importDraft)
    setOperationNotice('Square summary imported.')
    await refreshBackend()
  }

  return (
    <section className="panel page-panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">Square</p>
          <h2>Connect Square</h2>
        </div>
        <PanelTopOpen size={20} />
      </div>
      <div className="tool-grid">
        <div className="backend-health">
          <strong>Step 1: Verify in browser</strong>
          <span>OverHead opens Square in the default browser. Finish Square there, then return here.</span>
          <button className="primary-action" type="button" onClick={openSquare}>Open Square</button>
        </div>
        <div className="backend-health">
          <strong>Step 2: Save connection</strong>
          <label>
            Mode
            <select value={squareDraft.environment} onChange={(event) => updateSquareDraft('environment', event.target.value)}>
              <option value="sandbox">Sandbox</option>
              <option value="production">Production</option>
            </select>
          </label>
          <FormField label="Application ID" value={squareDraft.applicationId} onChange={(value) => updateSquareDraft('applicationId', value)} placeholder="sq0idp-..." />
          <FormField label="Merchant ID" value={squareDraft.merchantId} onChange={(value) => updateSquareDraft('merchantId', value)} placeholder="merchant id" />
          <FormField label="Location ID" value={squareDraft.locationId} onChange={(value) => updateSquareDraft('locationId', value)} placeholder="location id" />
          <FormField label="Access token" value={squareDraft.accessToken} onChange={(value) => updateSquareDraft('accessToken', value)} placeholder="token returned by Square" />
          <FormField label="Refresh token" value={squareDraft.refreshToken} onChange={(value) => updateSquareDraft('refreshToken', value)} placeholder="refresh token" />
          <button className="ghost-button" type="button" onClick={saveSquare}>Save Square</button>
        </div>
        <div className="backend-health">
          <strong>Step 3: Import useful info</strong>
          <FormField label="Business name" value={importDraft.businessName} onChange={(value) => updateImportDraft('businessName', value)} placeholder="Business name" />
          <FormField label="Merchant ID" value={importDraft.merchantId} onChange={(value) => updateImportDraft('merchantId', value)} placeholder="merchant id" />
          <FormField label="Location name" value={importDraft.locationName} onChange={(value) => updateImportDraft('locationName', value)} placeholder="Main shop" />
          <FormField label="Location ID" value={importDraft.locationId} onChange={(value) => updateImportDraft('locationId', value)} placeholder="location id" />
          <FormField label="Customers" value={String(importDraft.customerCount)} onChange={(value) => updateImportDraft('customerCount', value)} placeholder="0" />
          <FormField label="Catalog items" value={String(importDraft.catalogItemCount)} onChange={(value) => updateImportDraft('catalogItemCount', value)} placeholder="0" />
          <FormField label="Orders" value={String(importDraft.orderCount)} onChange={(value) => updateImportDraft('orderCount', value)} placeholder="0" />
          <FormField label="Payments" value={String(importDraft.paymentCount)} onChange={(value) => updateImportDraft('paymentCount', value)} placeholder="0" />
          <button className="ghost-button" type="button" onClick={importSquare}>Import Square Summary</button>
        </div>
        <div className="backend-health">
          <strong>Saved Square data</strong>
          <span>{backendState.squareConnections?.length ?? 0} connections - {backendState.squareImports?.length ?? 0} imports</span>
          {(backendState.squareImports || []).slice(0, 3).map((item) => <small key={item.id}>{item.business_name || item.merchant_id} - {item.payment_count} payments</small>)}
        </div>
      </div>
    </section>
  )
}

function SecuritySection({ backendState, refreshBackend, setOperationNotice }) {
  const [reset, setReset] = useState({ email: 'owner@overhead.local', recoveryPhrase: '', newPassword: '' })
  const [dataRequest, setDataRequest] = useState({ requestType: 'export', subjectEmail: 'owner@overhead.local', notes: '' })
  const [deletionConfirmation, setDeletionConfirmation] = useState('')

  async function resetPassword() {
    if (!window.overheadBackend?.resetPassword) return
    await window.overheadBackend.resetPassword(reset)
    setOperationNotice('Password reset completed.')
    await refreshBackend()
  }

  async function createDataRequest() {
    if (!window.overheadBackend?.createDataRequest) return
    await window.overheadBackend.createDataRequest(dataRequest)
    setOperationNotice('Privacy data request created.')
    await refreshBackend()
  }

  async function completeDeletion(requestId) {
    if (deletionConfirmation !== 'DELETE') return setOperationNotice('Type DELETE before completing local data deletion.')
    if (!window.overheadBackend?.completeDataDeletion) return
    const result = await window.overheadBackend.completeDataDeletion({ requestId, confirmation: deletionConfirmation })
    setDeletionConfirmation('')
    setOperationNotice(`Local deletion completed. Safety backup: ${result.safetyBackupPath}`)
    await refreshBackend()
  }

  function updateReset(key, value) {
    setReset((current) => ({ ...current, [key]: value }))
  }

  function updateDataRequest(key, value) {
    setDataRequest((current) => ({ ...current, [key]: value }))
  }

  return (
    <section className="panel page-panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">Security</p>
          <h2>Privacy, access, and recovery readiness</h2>
        </div>
        <ShieldCheck size={20} />
      </div>
      <div className="settings-layout">
        <div className="profile-form">
          <div className="backend-health">
            <strong>Workspace readiness</strong>
            <span>{backendState.complianceSummary?.status || 'Checking'} - {backendState.complianceSummary?.openDataRequests ?? 0} open data requests</span>
            <span>{backendState.complianceSummary?.encryptedAtRest ? 'Encrypted at rest' : 'Encryption pending'} - {backendState.health?.openFraudSignalCount ?? 0} risk signals</span>
          </div>
          <div className="backend-health">
            <strong>Privacy and confidentiality</strong>
            <span>Use the minimum customer information needed for the job. Restrict it to the people who need it, and use privacy mode whenever the screen can be seen by others.</span>
            <small>Legal drafts are a starting point for attorney review; they do not make a business compliant by themselves.</small>
          </div>
          <div className="backend-health">
            <strong>Risk watch</strong>
            {(backendState.fraudSignals || []).slice(0, 4).map((signal) => (
              <span key={signal.id}>{signal.severity} - {signal.type}</span>
            ))}
            {!backendState.fraudSignals?.length && <span>No open risk signals recorded.</span>}
          </div>
        </div>
        <div className="profile-form">
          <div className="backend-health">
            <strong>Recover access safely</strong>
            <FormField label="Email" value={reset.email} onChange={(value) => updateReset('email', value)} placeholder="owner@example.com" />
            <FormField label="Recovery phrase" value={reset.recoveryPhrase} onChange={(value) => updateReset('recoveryPhrase', value)} placeholder="Recovery phrase" />
            <FormField label="New password" value={reset.newPassword} onChange={(value) => updateReset('newPassword', value)} placeholder="New desktop password" />
            <button className="ghost-button" type="button" onClick={resetPassword}>Reset Password</button>
            <small>Never place a recovery phrase in a support ticket, email, or shared note.</small>
          </div>
          <div className="backend-health">
            <strong>Privacy request record</strong>
            <label>
              Request type
              <select value={dataRequest.requestType} onChange={(event) => updateDataRequest('requestType', event.target.value)}>
                <option value="export">Export</option>
                <option value="delete">Delete</option>
                <option value="retention_review">Retention review</option>
              </select>
            </label>
            <FormField label="Subject email" value={dataRequest.subjectEmail} onChange={(value) => updateDataRequest('subjectEmail', value)} placeholder="customer@example.com" />
            <FormField label="Notes" value={dataRequest.notes} onChange={(value) => updateDataRequest('notes', value)} placeholder="Request notes" />
            <button className="ghost-button" type="button" onClick={createDataRequest}>Create Request</button>
            <small>Confirm the requester, applicable retention duties, and the exact records in scope before acting on a request.</small>
            {(backendState.dataRequests || []).filter((request) => request.request_type === 'delete' && request.status === 'Open').map((request) => (
              <div className="backend-health" key={request.id}>
                <strong>Open local deletion: {request.subject_email}</strong>
                <span>{request.notes || 'No notes supplied.'}</span>
                <input value={deletionConfirmation} onChange={(event) => setDeletionConfirmation(event.target.value)} placeholder="Type DELETE to confirm" />
                <button className="ghost-button" type="button" onClick={() => completeDeletion(request.id)}>Complete Local Deletion</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function SettingsSection({ theme, setTheme, privacyMode, setPrivacyMode, session, draftSession, updateDraft, signIn, backendState, refreshBackend, operationNotice, setOperationNotice }) {
  const [reduceMotion, setReduceMotion] = useState(() => {
    const saved = window.localStorage.getItem('overhead.reduceMotion.v1')
    return saved === null ? Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) : saved === 'true'
  })
  const [restorePath, setRestorePath] = useState('')
  const [restoreConfirmation, setRestoreConfirmation] = useState('')
  const [updater, setUpdater] = useState({ status: 'not-checked', autoCheck: true, message: 'Update status is loading.' })
  const [developerTools, setDeveloperTools] = useState({ configured: false, workspacePath: '', preferredEditor: 'auto', editors: [] })

  useEffect(() => {
    let active = true
    if (window.overheadBackend?.updaterStatus) {
      window.overheadBackend.updaterStatus().then((status) => {
        if (active) setUpdater(status)
      }).catch((error) => {
        if (active) setUpdater({ status: 'unavailable', autoCheck: true, message: userFacingError(error, 'Update status is unavailable.') })
      })
    }
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (session.role !== 'Owner' || !window.overheadBackend?.developerWorkspace) return
    let active = true
    Promise.all([window.overheadBackend.developerWorkspace(), window.overheadBackend.developerEditors?.() || []])
      .then(([workspace, editors]) => { if (active) setDeveloperTools({ ...workspace, editors }) })
      .catch((error) => { if (active) setOperationNotice(userFacingError(error, 'Developer tools are unavailable.')) })
    return () => { active = false }
  }, [session.role, setOperationNotice])

  async function createBackup() {
    if (window.overheadBackend?.createBackup) {
      const result = await window.overheadBackend.createBackup()
      setOperationNotice(`Backup created: ${result.backupPath}`)
      await refreshBackend()
    }
  }

  async function createSupportBundle() {
    if (window.overheadBackend?.createSupportBundle) {
      const result = await window.overheadBackend.createSupportBundle()
      setOperationNotice(`Support bundle created: ${result.bundlePath}`)
      await refreshBackend()
    }
  }

  async function createDataExport() {
    if (window.overheadBackend?.createDataExport) {
      const result = await window.overheadBackend.createDataExport()
      setOperationNotice(`Data export created: ${result.exportPath}`)
      await refreshBackend()
    }
  }

  async function validateRestore() {
    if (window.overheadBackend?.validateRestorePackage && restorePath) {
      const result = await window.overheadBackend.validateRestorePackage(restorePath)
      setOperationNotice(result.valid ? `Restore package valid: ${result.schema}` : 'Restore package rejected.')
      await refreshBackend()
    }
  }

  async function restoreWorkspace() {
    if (restoreConfirmation !== 'RESTORE') return setOperationNotice('Type RESTORE before replacing the local workspace.')
    if (!window.overheadBackend?.restoreFromPackage || !restorePath) return
    const result = await window.overheadBackend.restoreFromPackage({ filePath: restorePath, confirmation: restoreConfirmation })
    setOperationNotice(`Workspace restored. Safety backup: ${result.safetyBackupPath}. Sign in again to continue.`)
    window.setTimeout(() => window.location.reload(), 800)
  }

  async function updateToggle(key, value) {
    if (!window.overheadBackend?.updateToggle) return
    await window.overheadBackend.updateToggle({ key, value })
    setOperationNotice(`${formatToggleName(key)} ${value ? 'enabled' : 'disabled'}.`)
    await refreshBackend()
  }

  async function checkForUpdates() {
    if (!window.overheadBackend?.checkForUpdates) return
    const status = await window.overheadBackend.checkForUpdates()
    setUpdater(status)
    setOperationNotice(status.message || 'Update check started.')
  }

  async function setAutoCheck(enabled) {
    if (!window.overheadBackend?.setAutoCheck) return
    const status = await window.overheadBackend.setAutoCheck({ enabled })
    setUpdater(status)
    setOperationNotice(status.message || `Auto-Check ${enabled ? 'enabled' : 'disabled'}.`)
  }

  async function installUpdate() {
    if (!window.overheadBackend?.installDownloadedUpdate) return
    const result = await window.overheadBackend.installDownloadedUpdate()
    setOperationNotice(result.message || (result.installing ? 'Installing downloaded update.' : 'No downloaded update is ready.'))
  }

  async function syncCustomers() {
    if (!window.overheadBackend?.syncCustomers) return
    const status = await window.overheadBackend.syncCustomers()
    setOperationNotice(status.message || 'Customer synchronization completed.')
    await refreshBackend()
  }

  async function chooseDeveloperWorkspace() {
    try {
      const workspace = await window.overheadBackend?.chooseDeveloperWorkspace?.()
      if (!workspace) return
      setDeveloperTools((current) => ({ ...current, ...workspace }))
      setOperationNotice(workspace.configured ? 'Developer source workspace saved.' : 'Developer source folder was not changed.')
    } catch (error) { setOperationNotice(userFacingError(error, 'The selected folder is not an OverHead source workspace.')) }
  }

  async function setDeveloperEditor(preferredEditor) {
    try {
      const workspace = await window.overheadBackend?.setDeveloperEditor?.({ preferredEditor })
      setDeveloperTools((current) => ({ ...current, ...workspace }))
      setOperationNotice('Preferred code editor saved.')
    } catch (error) { setOperationNotice(userFacingError(error, 'Could not save the preferred code editor.')) }
  }

  async function openDeveloperWorkspace() {
    try {
      const result = await window.overheadBackend?.openDeveloperWorkspace?.()
      setOperationNotice(`${result.editor} opened the OverHead source workspace.`)
    } catch (error) { setOperationNotice(userFacingError(error, 'Could not open the source workspace.')) }
  }

  function updateReducedMotion(enabled) {
    setReduceMotion(enabled)
    window.localStorage.setItem('overhead.reduceMotion.v1', String(enabled))
    document.documentElement.dataset.reducedMotion = String(enabled)
  }

  return (
    <section className="panel page-panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">Preferences</p>
          <h2>Workspace controls and safe operations</h2>
        </div>
        <Settings2 size={20} />
      </div>
      <div className="settings-layout">
        <div className="settings-grid">
          {themes.map((item) => (
            <button className={theme === item.id ? 'theme-card active' : 'theme-card'} type="button" key={item.id} onClick={() => setTheme(item.id)}>
              <strong>{item.name}</strong>
              <span>{item.description}</span>
            </button>
          ))}
          <button className={privacyMode ? 'theme-card active' : 'theme-card'} type="button" onClick={() => setPrivacyMode(!privacyMode)}>
            <strong>{privacyMode ? 'Privacy mode on' : 'Privacy mode off'}</strong>
            <span>Masks sensitive evidence and customer records.</span>
          </button>
          <label className="checkbox-line accessibility-preference">
            <input type="checkbox" checked={reduceMotion} onChange={(event) => updateReducedMotion(event.target.checked)} />
            <span><strong>Reduce motion</strong><small>Limit interface animation and scrolling effects.</small></span>
          </label>
        </div>
        <FeatureWavePreferences session={session} backendState={backendState} operationNotice={operationNotice} setOperationNotice={setOperationNotice} />
        <div className="profile-form">
          <div className="backend-health">
            <strong>Local workspace health</strong>
            <span>{backendState.health?.status || 'Checking'} - {backendState.health?.databasePath || 'Local store path pending'}</span>
            <span>
              {backendState.health?.encryptedAtRest ? 'Encrypted at rest' : 'Encryption pending'}
              {' '} - {backendState.health?.queuedJobCount ?? 0} queued jobs
              {' '} - {backendState.health?.exportCount ?? 0} exports
            </span>
            <div className="button-row">
              <button className="ghost-button" type="button" onClick={createBackup}>Create Backup</button>
              <button className="ghost-button" type="button" onClick={createSupportBundle}>Support Bundle</button>
              <button className="ghost-button" type="button" onClick={createDataExport}>Data Export</button>
            </div>
            <small>Backups and exports are local artifacts. Store them securely, verify a restore before relying on it, and share support bundles only after reviewing their contents.</small>
            {operationNotice && <small>{operationNotice}</small>}
          </div>
          <div className="backend-health">
            <strong>Restore workspace</strong>
            <span>Validate first. Restoring replaces the local workspace, creates a safety backup, and signs you out.</span>
            <input value={restorePath} onChange={(event) => setRestorePath(event.target.value)} placeholder="Path to .secure or .json store file" />
            <div className="button-row"><button className="ghost-button" type="button" onClick={validateRestore}>Validate Restore</button></div>
            <input value={restoreConfirmation} onChange={(event) => setRestoreConfirmation(event.target.value)} placeholder="Type RESTORE to replace local workspace" />
            <button className="ghost-button" type="button" onClick={restoreWorkspace}>Restore Local Workspace</button>
          </div>
          <div className="backend-health update-check-panel">
            <strong>Updates</strong>
            <span>{updater.message || 'Choose Check to look for an update.'}</span>
            <small>{updater.configured ? `Installed: ${updater.currentVersion || 'unknown'} - Available: ${updater.version || 'not checked'} - Channel: ${updater.channel || 'latest'}${updater.checkedAt ? ` - last checked ${new Date(updater.checkedAt).toLocaleString()}` : ''}` : 'Install a packaged release to use the live update service.'}</small>
            <div className="button-row">
              <button className="primary-action" type="button" onClick={checkForUpdates}>Check</button>
              <label className="checkbox-line update-auto-check">
                <input type="checkbox" checked={updater.autoCheck !== false} onChange={(event) => setAutoCheck(event.target.checked)} />
                Auto-Check
              </label>
              {updater.status === 'downloaded' && <button className="ghost-button" type="button" onClick={installUpdate}>Install Update</button>}
            </div>
          </div>
          <div className="backend-health">
            <strong>Customer synchronization</strong>
            <span>{backendState.customerSync?.message || 'Automatic customer sync is waiting for a shared sign-in.'}</span>
            <small>Status: {backendState.customerSync?.status || 'Not synchronized'}{backendState.customerSync?.last_synced_at ? ` - ${new Date(backendState.customerSync.last_synced_at).toLocaleString()}` : ''}</small>
            <div className="button-row"><button className="ghost-button" type="button" onClick={syncCustomers}>Sync Now</button></div>
          </div>
          {session.role === 'Owner' && <div className="backend-health">
            <strong>Developer hot-fix workspace</strong>
            <span>Open only the selected OverHead source folder in Visual Studio Code or Code - OSS. A fresh verified OverHead staff sign-in with an active Management or Administrator credential is required. Customer records, backups, exports, and support bundles are never opened by this tool.</span>
            <small>{developerTools.configured ? developerTools.workspacePath : developerTools.message || 'Choose the local OverHead source folder before opening an editor.'}</small>
            <label>
              Preferred editor
              <select value={developerTools.preferredEditor || 'auto'} onChange={(event) => setDeveloperEditor(event.target.value)}>
                <option value="auto">Auto (prefer VS Code)</option>
                {developerTools.editors.some((editor) => editor.id === 'vscode') && <option value="vscode">Visual Studio Code</option>}
                {developerTools.editors.some((editor) => editor.id === 'oss') && <option value="oss">Code - OSS / VSCodium</option>}
              </select>
            </label>
            <div className="button-row">
              <button className="ghost-button" type="button" onClick={chooseDeveloperWorkspace}>Choose Source Folder</button>
              <button className="primary-action" type="button" onClick={openDeveloperWorkspace} disabled={!developerTools.configured}>Open In Code Editor</button>
            </div>
          </div>}
          <div className="backend-health">
            <strong>Operational controls</strong>
            <span>Controls that change how the workspace behaves. Change one intentionally, then check the current work queue and audit record.</span>
            <div className="toggle-list">
              {Object.entries(backendState.appToggles || {}).map(([key, value]) => (
                <label className="checkbox-line" key={key}>
                  <input type="checkbox" checked={Boolean(value)} onChange={(event) => updateToggle(key, event.target.checked)} />
                  {formatToggleName(key)}
                </label>
              ))}
            </div>
          </div>
          <FormField label="Owner name" value={draftSession.ownerName} onChange={(value) => updateDraft('ownerName', value)} placeholder="Owner name" />
          <FormField label="Business name" value={draftSession.businessName} onChange={(value) => updateDraft('businessName', value)} placeholder="Business name" />
          <FormField label="Email" value={draftSession.email} onChange={(value) => updateDraft('email', value)} placeholder="owner@example.com" />
          <label>
            Role
            <select value={draftSession.role} onChange={(event) => updateDraft('role', event.target.value)}>
              <option>Owner</option>
              <option>Front Desk</option>
              <option>Bookkeeper</option>
              <option>Support</option>
            </select>
          </label>
          <button className="primary-action" type="button" onClick={signIn}>Save Profile</button>
        </div>
      </div>
    </section>
  )
}

function FormField({ label, value, onChange, placeholder }) {
  return (
    <label>
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  )
}

function ProfileItem({ label, value }) {
  return (
    <div className="profile-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function Proof({ title, text }) {
  return (
    <article>
      <strong>{title}</strong>
      <p>{text}</p>
    </article>
  )
}

function Step({ number, title, text }) {
  return (
    <div className="step">
      <span>{number}</span>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  )
}

function StatusPill({ icon: Icon, label }) {
  return (
    <span className="status-pill">
      <Icon size={15} />
      {label}
    </span>
  )
}

function StatusCard({ icon: Icon, title, value, note }) {
  return (
    <section className="metric">
      <Icon size={20} />
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </section>
  )
}

function FeatureItem({ feature }) {
  const Icon = feature.icon || BriefcaseBusiness
  return (
    <article className="feature-item">
      <Icon size={18} />
      <div>
        <strong>{feature.name}</strong>
        <span>{feature.category}</span>
        <p>{feature.detail}</p>
      </div>
    </article>
  )
}

function initials(value) {
  return value
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'OH'
}

function formatToggleName(value) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (letter) => letter.toUpperCase())
}

function selectedPlanName(planId) {
  return planTiers.find((plan) => plan.id === planId)?.name || 'Silver'
}

function tierRank(tier = 'silver') {
  return { silver: 1, gold: 2, black: 3 }[tier] || 1
}

function isPlanUnlocked(planId, activeTier = 'silver') {
  return tierRank(activeTier) >= tierRank(planId)
}

export default App
