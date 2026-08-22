import Link from 'next/link'
import { CTA, PageHero, SiteShell } from '../components'
import { businessFoundation } from '../business-foundation'
import { investorBrochureHref } from '../data'

const snapshot = [
  ['Stage', 'Pre-seed operating product', 'A packaged Windows application and public product surface are available for review today.'],
  ['Initial buyer', 'Owner-led service businesses', 'The first customer is feeling the daily cost of scattered follow-through and missing context.'],
  ['Commercial model', 'Desktop subscription plus server deployment', 'Silver, Gold, and Black serve standard Windows offices; Cylinder is the separate Windows Server and Windows IoT deployment tier.'],
  ['Current objective', 'Pilot evidence to paid proof', 'The next work is disciplined activation, repeat use, conversion, and retention measurement.'],
]

const workflow = [
  ['Capture the work', 'Keep customer context, notes, tasks, quotes, invoices, and policy details in a practical office workspace instead of scattered messages and files.'],
  ['Move it with control', 'Use queues, reminders, workflow status, and manager approvals to make the next action visible while preserving accountability.'],
  ['Keep the evidence', 'Retain support bundles, audit entries, checksum references, recovery context, and payment-import records so the office can explain what happened later.'],
]

const execution = [
  ['Prove the first workflow', 'Recruit a narrow pilot cohort, measure setup and weekly use, and turn observed friction into product priorities.'],
  ['Convert proof into revenue', 'Complete production billing and onboarding, measure paid conversion and retention, and document customer economics.'],
  ['Build repeatability', 'Focus integrations and vertical workflow packages on the channels and use cases that show durable demand.'],
]

const metrics = [
  ['Activation', 'Invited workspaces that complete setup and use the core workflow.'],
  ['Engagement', 'Weekly active workspaces and repeat use of customer, queue, and approval tools.'],
  ['Commercial', 'Trial-to-paid conversion, paid workspaces, recurring revenue, and retention.'],
  ['Efficiency', 'Onboarding time, support burden, and the integrations that reduce repeated work.'],
]

const diligence = [
  ['Why desktop first?', 'The target workflow is often managed from a front desk or owner machine. An installed command center stays close to the work while the web layer handles discovery, download, account entry, and support.'],
  ['Why not a generic CRM?', 'OverHead begins with the operational layer after the call: active work, customer rules, approvals, payment context, recovery, and evidence. That is a narrower, day-to-day job.'],
  ['What creates retention?', 'As an office relies on its customer context, workflow rules, history, and support-ready records, a well-run workspace becomes more useful.'],
  ['What remains gated?', 'Live payment processing, installer signing, final legal review, broader third-party integrations, and repeatable acquisition remain validation milestones—not claims of completion.'],
]

export default function InvestorsPage() {
  return <SiteShell tone="light"><main>
    <PageHero eyebrow="Investor brief" title="The operating layer for a local business office.">
      <p>{businessFoundation.promise}</p>
      <div className="investor-hero-actions"><a className="primary" href="#investment-case">Review the investment case</a><Link className="text-link" href={investorBrochureHref}>Download the investor brief</Link></div>
    </PageHero>

    <section id="investment-case" className="section investor-snapshot" aria-label="OverHead investment snapshot">
      {snapshot.map(([label, value, detail]) => <article key={label}><span>{label}</span><strong>{value}</strong><p>{detail}</p></article>)}
    </section>

    <section className="page-body investor-opening">
      <div><p className="eyebrow">The problem</p><h2>Small-business administration is still full of expensive handoffs.</h2><p className="section-copy">Customer context gets split between notes, inboxes, calendars, payment tabs, staff conversations, and the owner&apos;s memory. OverHead is built to bring that operating layer into one practical command surface.</p></div>
      <div className="investor-signal"><span>Why now</span><strong>Everyday office work is still managed across tools that do not share the same operational memory.</strong><p>OverHead starts where the gap is most visible: follow-through, approvals, payment context, and the evidence a business needs when a customer asks what happened.</p></div>
    </section>

    <section className="section investor-positioning">
      <div><p className="eyebrow">The thesis</p><h2>Earn the office routine before trying to replace the whole stack.</h2><p className="section-copy">The product is designed to win a focused operational job first, then deepen the account and integration layer where it directly improves office throughput, retention, or customer confidence.</p></div>
      <div className="investor-thesis-list"><article><span>01</span><strong>Start with repeatable friction</strong><p>Customer context, active work, approvals, payment handoffs, and support evidence are daily problems—not occasional features.</p></article><article><span>02</span><strong>Build trusted operating memory</strong><p>Records, rules, history, and support context become more useful as a workflow becomes habitual.</p></article><article><span>03</span><strong>Expand from measured proof</strong><p>Add vertical packages and integrations only where pilots show a clear increase in value and retention.</p></article></div>
    </section>

    <section className="section">
      <p className="eyebrow">Product proof</p><h2>A real installed product, not a concept-only mockup.</h2><p className="section-copy">These captures come from the OverHead desktop smoke-test release. They show the installed sign-in experience and the command console with workspace status, customer database, task queue, office readiness, and security indicators.</p>
      <div className="desktop-proof-grid"><figure><img src="/assets/overhead-console-proof.png" alt="OverHead Desktop command console showing workspace overview, customer database, current work queue, and office readiness" /><figcaption>Signed-in OverHead Desktop command console</figcaption></figure><figure><img src="/assets/overhead-signin-proof.png" alt="OverHead Desktop sign-in screen for a local Windows workspace" /><figcaption>Installed Windows sign-in experience</figcaption></figure></div>
    </section>

    <section className="section investor-loop-section"><div><p className="eyebrow">The customer workflow</p><h2>One command layer for work that must keep moving.</h2><p className="section-copy">The product narrative is deliberately simple: capture the work, move it with control, and keep the evidence.</p></div><div className="investor-loop-grid">{workflow.map(([step, body]) => <article key={step}><span>{step}</span><p>{body}</p></article>)}</div></section>

    <section className="section investor-model-section"><div><p className="eyebrow">How it makes money</p><h2>A subscription path tied to operational depth—and a separate server deployment path.</h2><p className="section-copy">Silver establishes an owner workspace. Gold adds greater workflow and staff depth. Black packages higher-volume controls, encrypted local storage, audit depth, and premium setup expectations. Cylinder is a distinct Windows Server and Windows IoT deployment tier for an in-house host, with separate identity, data root, update channel, and larger entitlement profile. The product does not present Cylinder as a standard desktop checkout option.</p></div><div className="investor-signal"><span>Commercial promise</span><strong>Less scattered follow-through. Better context. Stronger control over the office work already in motion.</strong><p>That creates a concrete sales conversation from the first download, while Cylinder gives a clearly bounded path for organizations that need an in-house server host.</p></div></section>

    <section className="section investor-loop-section"><div><p className="eyebrow">Capital to milestones</p><h2>Funding should reduce specific execution risk.</h2></div><div className="investor-loop-grid">{execution.map(([step, body]) => <article key={step}><span>{step}</span><p>{body}</p></article>)}</div></section>

    <section className="section"><p className="eyebrow">Evidence plan</p><h2>What an investor should expect to see next.</h2><div className="investor-metric-grid">{metrics.map(([label, detail]) => <article key={label}><span>{label}</span><strong>{label}</strong><p>{detail}</p></article>)}</div><p className="section-copy">No customer, revenue, retention, valuation, or market-size figures are presented until they are measured and supportable.</p></section>

    <section className="section"><p className="eyebrow">Diligence starter</p><h2>Direct answers before a deeper conversation.</h2><div className="diligence-grid">{diligence.map(([question, answer]) => <article key={question}><strong>{question}</strong><p>{answer}</p></article>)}</div></section>

    <section className="section brochure-callout"><div><p className="eyebrow">Investor materials</p><h2>Take the concise brief with you.</h2><p>Download the printable overview for the mission, product proof, commercial shape, execution plan, and diligence topics.</p></div><div className="investor-cta-actions"><Link className="primary" href={investorBrochureHref}>Download investor brief</Link><Link className="secondary" href="/contact">Request a conversation</Link></div></section>

    <section className="section investor-disclaimer"><strong>Investor notice</strong><p>This page is informational and not a securities offering. Product evidence, architecture notes, release records, pilot metrics, financial model, capitalization materials, and formal risk disclosures are shared through a controlled diligence process when available.</p></section>
    <CTA />
  </main></SiteShell>
}
