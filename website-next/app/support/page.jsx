import Link from 'next/link'
import { CTA, PageHero, SiteShell } from '../components'
import { cylinderPageHref, downloadPageHref } from '../data'

const supportRoutes = [
  { id: 'install', label: 'Install or launch', title: 'Choose and open the right OverHead app.', body: 'Use the Download page to choose OverHead Suite for Windows or Mac, or the separate Install Manager. The current Windows packages are unsigned; if Windows shows a publisher warning, keep the exact wording.', steps: ['Open the OverHead Download page and choose the package for your computer.', 'Use the release checksum if you need to confirm the downloaded file matches the published asset.', 'Record the app version and the full message if installation or launch stops.'], subject: 'OverHead Support - Install or launch' },
  { id: 'access', label: 'Sign-in or access', title: 'Resolve account and workspace access safely.', body: 'Confirm the email address and capture the full error message. Do not send passwords, recovery codes, or a screenshot that exposes them.', steps: ['Confirm the email address used for sign-in.', 'Copy the complete error message or take a safe screenshot.', 'State whether you can reach the workspace after sign-in.'], subject: 'OverHead Support - Sign-in or access' },
  { id: 'workflow', label: 'Workflow or data', title: 'Explain what changed and where it stopped.', body: 'The fastest diagnosis begins with the last step that worked, the next action that failed, and only the evidence needed to reproduce the issue.', steps: ['Describe the last successful step.', 'Name the action that failed and what you expected instead.', 'Attach a safe screenshot or sanitized support bundle if available.'], subject: 'OverHead Support - Workflow or data' },
  { id: 'billing', label: 'Plan, trial, or billing', title: 'Keep provider and account details protected.', body: 'For a plan, trial, cancellation, receipt, or provider handoff question, share the account email, plan name, and provider receipt reference—not payment credentials.', steps: ['State the account email and the plan or trial involved.', 'Include a provider receipt or reference number if one exists.', 'Never send card numbers, bank details, or provider passwords.'], subject: 'OverHead Support - Plan or billing' },
  { id: 'cylinder', label: 'Cylinder server deployment', title: 'Confirm the host and evaluation before installing the server package.', body: 'Cylinder is a separate deployment for Windows Server or Windows IoT. It will not run on standard Windows 10 or Windows 11 editions. Its setup package and checksum are linked from the OverHead Download page.', steps: ['Confirm the exact Windows Server or Windows IoT edition.', 'Review the Cylinder host requirements and release notes.', 'Include the host edition, intended user count, and whether your question is about evaluation or commercial activation.'], subject: 'OverHead Support - Cylinder deployment' },
]

const beforeContact = [
  ['1', 'Start with the issue', 'Pick the closest route below. It tells you what to try and what information is useful.'],
  ['2', 'Keep the exact message', 'Copy the plain-language error exactly as it appears. Do not summarize it as “it will not work.”'],
  ['3', 'Share only what is needed', 'A version, screenshot, checksum result, or sanitized support bundle is usually enough to begin.'],
]

const safety = [
  ['Safe to share', 'OverHead version, Windows version, exact error text, last successful step, checksum result, and a sanitized screenshot or support bundle.'],
  ['Keep private', 'Passwords, recovery codes, full payment details, tax identifiers, provider passwords, and unredacted customer records.'],
  ['What happens next', 'Support uses the issue details to identify a clear next action. If a provider or account action is required, you stay in control of that account.'],
]

export default function SupportPage() {
  return <SiteShell tone="light"><main>
    <PageHero eyebrow="Support center" title="Get a clear next step and get back to work.">
      <p>Choose the issue that matches what happened. You will see the safest first checks, what information is useful, and how to contact support without sending sensitive information.</p>
      <div className="support-hero-actions"><a className="primary" href="#support-routes">Choose an issue</a><a className="text-link" href="mailto:solidartentertainment@gmail.com?subject=OverHead%20Support">Email developer support</a></div>
    </PageHero>

    <section className="section support-before-contact"><p className="eyebrow">Before you contact support</p><h2>Three small details make troubleshooting much faster.</h2><div className="support-step-grid">{beforeContact.map(([number, title, body]) => <article key={number}><span>{number}</span><strong>{title}</strong><p>{body}</p></article>)}</div></section>

    <section id="support-routes" className="section support-routes"><div><p className="eyebrow">Choose your issue</p><h2>Start with the route closest to what happened.</h2><p className="section-copy">Each route is written for a practical next step. If none fits, email support with the problem in plain language and the last action that worked.</p></div><div className="support-route-grid">{supportRoutes.map((route) => <article id={route.id} key={route.id}><span>{route.label}</span><h3>{route.title}</h3><p>{route.body}</p><ol>{route.steps.map((step) => <li key={step}>{step}</li>)}</ol><a className="text-link" href={`mailto:solidartentertainment@gmail.com?subject=${encodeURIComponent(route.subject)}`}>Contact support about {route.label.toLowerCase()}</a></article>)}</div></section>

    <section className="section support-download-panel"><div><p className="eyebrow">Choose the right package</p><h2>Start with the browser demo, then pick the installed app.</h2><p>The Download page explains Windows Desktop, Install Manager, Mac, and the separate Cylinder Server/IoT package, with release notes and checksum links.</p></div><div className="support-download-actions"><Link className="primary" href={downloadPageHref}>Choose an OverHead download</Link><Link className="secondary" href={cylinderPageHref}>Review Cylinder requirements</Link></div></section>

    <section className="section"><p className="eyebrow">Safe support</p><h2>Helpful evidence is not the same as sensitive information.</h2><div className="card-grid three">{safety.map(([title, body]) => <article key={title}><span>{title}</span><strong>{title}</strong><p>{body}</p></article>)}</div></section>

    <section className="section support-contact"><div><p className="eyebrow">Still need help?</p><h2>Send one clear support message.</h2><p className="section-copy">Include the OverHead version, Windows version, exact issue, last successful step, and any safe-to-share screenshot, checksum result, or sanitized support bundle. This gives support a useful starting point without putting your account or customers at risk.</p></div><div className="support-contact-card"><span>Developer support</span><strong>solidartentertainment@gmail.com</strong><p>No passwords, recovery codes, or payment credentials are needed to begin.</p><a className="primary" href="mailto:solidartentertainment@gmail.com?subject=OverHead%20Support%20Request">Write a support email</a></div></section>

    <CTA />
  </main></SiteShell>
}
