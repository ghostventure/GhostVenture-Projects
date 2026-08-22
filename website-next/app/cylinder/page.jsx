import Link from 'next/link'
import { CTA, PageHero, SiteShell } from '../components'
import { cylinderChecksumHref, cylinderDeployment, cylinderDownloadHref, downloadHref } from '../data'

const installSteps = [
  ['1. Confirm the host', 'Cylinder is for Windows Server or Windows IoT, including Windows IoT Enterprise. It will not run on standard Windows 10 or Windows 11 editions.'],
  ['2. Download and verify', 'Download the Cylinder ZIP on the supported host. After extracting it, compare the Cylinder installer with the included checksum before installation when the transfer source is uncertain.'],
  ['3. Install as an administrator', 'Extract the ZIP locally and run the Cylinder installer with an administrator account.'],
  ['4. Create or sign in', 'Launch Cylinder and use the intended workspace. The server deployment has its own local data location and update channel.'],
]

const boundaries = [
  ['Separate deployment', 'Cylinder has its own application identity, local data root, and update feed. Do not use the standard desktop installer or update channel for a Cylinder host.'],
  ['Local data responsibility', 'Customer documents are copied into the local Cylinder data directory and indexed in the local record store. They are not automatically replicated to Firebase Storage or another host.'],
  ['External configuration remains yours', 'SMTP, Microsoft Entra registration and consent, payment providers, device security, backups, and code-signing credentials remain separate configuration responsibilities.'],
]

export default function CylinderPage() {
  return <SiteShell tone="light"><main>
    <PageHero eyebrow="OverHead Cylinder" title="OverHead for your in-house Windows Server or Windows IoT host.">
      <p>{cylinderDeployment.text}</p>
      <div className="cylinder-hero-actions"><Link className="primary" href={cylinderDownloadHref}>Start the 30-day Cylinder evaluation</Link><Link className="text-link" href="#requirements">Check host requirements</Link></div>
    </PageHero>

    <section id="requirements" className="section cylinder-fit"><article><span>Choose Cylinder when</span><strong>You run a supported Windows Server or Windows IoT host and need the separate server deployment tier.</strong><p>Start with one 30-day, no-card evaluation per server workspace. It creates no payment and does not automatically renew.</p><strong className="cylinder-fit-price">{cylinderDeployment.price} flat · {cylinderDeployment.annualPrice} annually</strong></article><article><span>Choose standard OverHead when</span><strong>You are installing on a normal Windows 10 or Windows 11 office computer.</strong><p>The standard desktop application is the correct choice for regular Windows editions.</p><Link className="text-link" href={downloadHref}>Get standard OverHead for Windows</Link></article></section>

    <section className="page-body cylinder-overview"><div><p className="eyebrow">Server deployment tier</p><h2>Built for a dedicated host—not a larger desktop download.</h2><p className="section-copy">Cylinder is deliberately kept separate from the standard desktop application so its host compatibility, local data location, entitlement limits, and update channel remain clear.</p></div><div className="cylinder-signal"><span>Current entitlement profile</span><strong>Up to 50 users and 100,000 customer records.</strong><p>It includes the server deployment controls in addition to the core customer, task, backup, support, workflow, approval, export, restore-validation, and fraud-detection capabilities.</p></div></section>

    <section className="section"><p className="eyebrow">Install on the right host</p><h2>A clear server deployment path.</h2><div className="step-grid">{installSteps.map(([step, body]) => <article key={step}><strong>{step}</strong><p>{body}</p></article>)}</div></section>

    <section className="section cylinder-download-panel"><div><p className="eyebrow">Cylinder price and download</p><h2>{cylinderDeployment.price} flat for the server deployment tier.</h2><p>Start with one 30-day, no-card evaluation per server workspace. It creates no charge and does not automatically renew. Continued use requires a separate deployment order or contract, billing confirmation, and an issued entitlement. Includes up to 50 users and 100,000 customer records. Windows Server licensing, host hardware, backups, provider accounts, and custom deployment work are separate. Do not install this package on a standard Windows edition.</p></div><div className="cylinder-download-actions"><Link className="primary" href={cylinderDownloadHref}>Start evaluation download</Link><Link className="secondary" href={cylinderChecksumHref}>Get Cylinder installer checksum</Link></div></section>

    <section className="section"><p className="eyebrow">Operating boundaries</p><h2>Keep the server deployment understandable and supportable.</h2><div className="card-grid three">{boundaries.map(([title, body]) => <article key={title}><span>{title}</span><strong>{title}</strong><p>{body}</p></article>)}</div></section>

    <section className="section cylinder-contact"><div><p className="eyebrow">Need help choosing?</p><h2>Ask before installing on a server host.</h2><p className="section-copy">Send the Windows edition, intended user count, and the deployment question. Do not send passwords, recovery codes, or customer records.</p></div><a className="primary" href="mailto:solidartentertainment@gmail.com?subject=OverHead%20Cylinder%20Deployment%20Question">Ask about Cylinder deployment</a></section>
    <CTA />
  </main></SiteShell>
}
