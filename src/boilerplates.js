export const onboardingBoilerplates = {
  welcomeTitle: 'Welcome to OverHead',
  welcomeBody:
    'Start by creating the owner profile. After sign-in, OverHead unlocks customer records, workflow setup, quote rules, invoice reminders, support tools, and protected evidence views.',
  signInSteps: [
    'Enter the owner name and business name.',
    'Add the business email used for admin work.',
    'Choose the role for this local profile.',
    'Create a recovery phrase and store it somewhere private.',
    'Accept the Terms of Use and Privacy Notice.',
    'Select Sign in locally to unlock protected business data.',
  ],
  recoveryHint:
    'Use a phrase you can remember but others cannot guess. Do not use customer names, business passwords, or payment account credentials.',
}

export const workflowBoilerplates = [
  {
    title: 'Scheduling starter',
    body: 'Collect service type, preferred date, time window, address or location, deposit status, and cancellation rules before confirming the appointment.',
  },
  {
    title: 'Customer answer starter',
    body: 'Answer with approved service details, price boundaries, availability, next steps, and a human handoff whenever confidence is low.',
  },
  {
    title: 'Quote starter',
    body: 'Use base service price, add-ons, travel fees, rush fees, expiration date, deposit requirement, and owner approval status before sending.',
  },
  {
    title: 'Invoice reminder starter',
    body: 'Send a polite reminder after the due date, include the invoice number, amount, payment link placeholder, and owner escalation timing.',
  },
  {
    title: 'Follow-up starter',
    body: 'Follow up after a quote, after service completion, after payment, and later for retention or maintenance reminders.',
  },
]

export const legalBoilerplates = {
  terms:
    'OverHead supports practical office operations; it does not replace owner judgment or qualified legal, accounting, security, compliance, medical, financial, or other professional advice. Users must maintain accurate records, protect account access, supervise staff permissions, review generated drafts before sending, and use the software only for lawful business operations.',
  privacy:
    'OverHead is designed as a local-first desktop tool. Customer records, workflow preferences, support notes, and audit events are stored locally unless the user connects an external provider. Enter only information needed for the work, limit access to people who need it, and never include passwords, recovery phrases, full payment details, or unredacted customer records in support requests.',
  support:
    'For support, include the app version, device name, workflow affected, exact error, recent steps, and whether protected mode or privacy mode was active. Send only the minimum evidence needed to diagnose the issue; use a sanitized support bundle where possible.',
}
