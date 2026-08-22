export const navItems = [
  { href: '/about/', label: 'About' },
  { href: '/cylinder/', label: 'Cylinder' },
  { href: '/careers/', label: 'Careers' },
  { href: '/dashboard/', label: 'Workspace' },
  { href: '/investors/', label: 'Investors' },
  { href: '/faq/', label: 'FAQ' },
  { href: '/support/', label: 'Support' },
  { href: '/contact/', label: 'Contact' },
]

export const downloadHref = '/downloads/OverHead-Desktop-0.3.5-win-x64.zip'
export const cylinderDownloadHref = '/downloads/OverHead-Cylinder-0.3.4-win-x64.zip'
export const checksumHref = '/downloads/SHA256SUMS.txt'
export const cylinderChecksumHref = '/downloads/CYLINDER-SHA256SUMS.txt'
export const cylinderPageHref = '/cylinder/'
export const investorBrochureHref = '/downloads/OverHead-Investor-Brochure.pdf'
export const businessGuideHref = '/downloads/OverHead-Business-Office-Guide.pdf'

export const plans = [
  {
    name: 'Silver',
    price: '$59/mo',
    label: 'Basic',
    text: 'For the solo owner ready to replace loose notes with a reliable daily command view.',
    features: ['1 owner profile', '250 customer records', 'Task queue', 'Basic backup tools', 'Support bundle export'],
  },
  {
    name: 'Gold',
    price: '$129/mo',
    label: 'Advanced',
    text: 'For busy teams that want faster follow-through, clearer roles, and fewer dropped handoffs.',
    features: ['3 staff profiles', '1,500 customer records', 'Workflow automation', 'Legal center', 'Priority support'],
  },
  {
    name: 'Black',
    price: '$299/mo',
    label: 'Premium',
    text: 'For high-trust offices that need stronger control, deeper records, and premium onboarding.',
    features: ['10 staff profiles', '10,000 customer records', 'Encrypted local store', 'Audit ledger', 'Concierge setup'],
  },
]

export const cylinderDeployment = {
  name: 'OverHead Cylinder',
  label: 'Windows Server / Windows IoT',
  price: '$499/mo',
  annualPrice: '$4,990/year',
  text: 'A separate in-house deployment for organizations running a supported Windows Server or Windows IoT host. It includes one 30-day, no-card evaluation per server workspace and is not the standard Windows desktop application.',
  features: ['Up to 50 users', 'Up to 100,000 customer records', 'Separate local data root and update channel', 'Server deployment controls'],
}

export const capabilityGroups = [
  {
    kicker: 'Front Desk',
    title: 'Make every customer interaction feel prepared.',
    body: 'Keep customer details, service area notes, workflow preferences, support context, and local history close at hand so your desk starts with context, not a blank slate.',
  },
  {
    kicker: 'Revenue',
    title: 'Keep revenue work from falling through the cracks.',
    body: 'See quote status, unpaid invoices, reminders, owner approvals, and today’s priority tasks in one focused desktop view.',
  },
  {
    kicker: 'Control',
    title: 'Give staff momentum without giving up control.',
    body: 'Route sensitive exports, policy edits, billing changes, restore operations, and record changes through the manager review your office needs.',
  },
  {
    kicker: 'Evidence',
    title: 'Be ready when a customer or manager needs answers.',
    body: 'Keep important changes, access denials, payment imports, support bundles, integrity checks, and recovery events available for review.',
  },
]

export const legalSections = [
  {
    title: 'Business Scope and Product Boundary',
    body: 'OverHead is a local-first Windows workspace for customer follow-through, revenue operations, role-aware approvals, and support-ready records. It supports practical business administration; it does not replace the owner’s judgment, professional advisers, required security practices, or industry-specific compliance program.',
  },
  {
    title: 'Terms of Use Draft',
    body: 'Users must maintain accurate records, supervise staff access, keep credentials private, and review operational output before it is sent or relied upon. OverHead may not be used for fraud, deceptive billing, unlawful messaging, credential sharing, unauthorized access, or regulated decisions without qualified review.',
  },
  {
    title: 'Privacy and Data-Minimization Draft',
    body: 'OverHead is designed around local-first records, sign-in before workspace access, privacy masking, support exports, and user-controlled backups. Customers should enter and retain only the information needed for the work, restrict access to people who need it, and follow their own lawful notice, retention, deletion, and disclosure obligations.',
  },
  {
    title: 'Access, Security, and Recovery Draft',
    body: 'Owners are responsible for assigning appropriate roles, removing inactive staff, protecting devices and backups, and reviewing access activity. OverHead provides workflow controls and recovery guidance, but no software can eliminate the need for strong passwords, device security, staff training, and an incident-response plan.',
  },
  {
    title: 'OverHead Team Identity and Authorization Draft',
    body: 'Internal OverHead Team accounts use an authorized @overheadteam.com or @overheadteam.biz email address and must be issued by an authorized supervisor, manager, or administrator. The authorization record identifies the approving account and time of issue. This internal-team rule does not require a customer business to abandon its own company email domain for its workspace staff.',
  },
  {
    title: 'AI And Automation Disclosure',
    body: 'AI-assisted drafts, suggested responses, summaries, reminders, and workflow recommendations are reviewable aids—not autonomous decisions. The business owner or authorized manager controls final approval, pricing, language, timing, customer communications, and any decision that could materially affect a customer or employee.',
  },
  {
    title: 'Payment Provider and Commercial Disclosure',
    body: 'Where payment-provider connections are enabled, the provider remains responsible for its payment processing, fraud review, dispute process, tax handling, and account terms. OverHead should present plan, trial, renewal, cancellation, refund, and receipt information plainly; no charge should be assumed until provider confirmation is received.',
  },
  {
    title: 'Cylinder Evaluation and Activation Draft',
    body: 'Cylinder provides one 30-day, no-card evaluation per server workspace. The evaluation does not create a payment, does not automatically renew, and ends unless a separate commercial activation is completed. Continued Cylinder use at the published monthly or annual price requires a deployment order or contract, billing confirmation, and an issued entitlement before activation. The standard desktop checkout does not sell Cylinder. A final invoice, billing interval, renewal, cancellation, refund, and support terms must be presented before any payment is collected.',
  },
  {
    title: 'Support and Evidence Handling Draft',
    body: 'Support should request only the evidence needed to diagnose an issue, such as product version, device details, exact error, screenshot, checksum result, or sanitized support bundle. Users should never send passwords, recovery codes, full payment details, tax identifiers, or unredacted customer records.',
  },
  {
    title: 'Fair Use and Customer Communication Draft',
    body: 'Businesses remain responsible for lawful, accurate, and respectful customer communications. OverHead must not be used to misrepresent pricing, create deceptive records, send unlawful messages, evade provider rules, or automate communications without appropriate human review.',
  },
  {
    title: 'Launch and Change-Management Draft',
    body: 'Before enabling a workflow, provider connection, or commercial feature, the business should confirm its staff permissions, customer-facing language, backup and recovery approach, and applicable legal or contractual requirements. Product status and feature availability should be stated accurately at all times.',
  },
  {
    title: 'Cylinder Server Deployment Boundary',
    body: 'OverHead Cylinder is a separate deployment for supported Windows Server and Windows IoT hosts. It has its own application identity, local data root, update feed, and server-tier entitlement. It is not compatible with standard Windows 10 or Windows 11 editions. Customer documents remain on the configured Cylinder host unless the customer separately configures another storage or replication process.',
  },
]

export const sharedUserDatabaseContract = {
  schema: 'overhead-shared-users-v1',
  purpose: 'Shared account and licensing registry for the website and OverHead desktop account model.',
  tables: {
    user_profiles: [
      'id',
      'owner_name',
      'business_name',
      'email',
      'manager_email',
      'role',
      'status',
      'email_verified',
      'email_verified_at',
      'recovery_hint',
      'terms_accepted_at',
      'last_sign_in',
      'created_at',
      'updated_at',
      'source',
    ],
    manager_profiles: [
      'id',
      'user_profile_id',
      'name',
      'email',
      'business_name',
      'tier',
      'status',
      'created_at',
      'updated_at',
    ],
    subscriptions: [
      'id',
      'manager_email',
      'tier',
      'payment_provider',
      'payment_status',
      'external_customer_id',
      'external_subscription_id',
      'created_at',
      'updated_at',
    ],
    access_events: [
      'id',
      'user_profile_id',
      'event_type',
      'device_name',
      'ip_hint',
      'risk_level',
      'created_at',
    ],
  },
}
