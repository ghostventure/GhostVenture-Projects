import Link from 'next/link'
import { CTA, PageHero, SiteShell } from '../components'
import {
  cylinderChecksumHref,
  cylinderClientChecksumHref,
  cylinderClientDownloadHref,
  cylinderDeployment,
  cylinderDownloadHref,
  downloadHref,
} from '../data'

const installSteps = [
  ['1. Confirm the host', 'Cylinder Server is for supported Windows Server or Windows IoT editions, including Windows IoT Enterprise. It does not run on standard Windows 10 or Windows 11.'],
  ['2. Download and verify', 'Download the Cylinder Server ZIP. After extraction, compare the installer with the included checksum when you need to verify the transfer.'],
  ['3. Install on the host', 'Extract the ZIP locally and run the Server installer with an administrator account. The Server and Client have separate application identities, data locations, and update channels.'],
  ['4. Enroll the department', 'Sign in to the intended workspace, set up departments and employee Ranks, then review devices awaiting approval.'],
]

const ranks = [
  ['Rank 1 · Regular User', 'Uses OverHead according to assigned job function, membership, and approved-device policy.'],
  ['Rank 2 · Management', 'Invites and manages Rank 1 employees in assigned departments.'],
  ['Rank 3 · Administrator', 'Manages lower-ranked employees and devices within assigned departments, and reviews scoped audit events.'],
  ['Rank 4 · Owner', 'Manages workspace membership, departments, devices, version and offline policies, access pause, and workspace-wide audit.'],
]

const boundaries = [
  ['App access controls', 'Cylinder centrally governs OverHead membership, Ranks, department assignments, enrolled devices, minimum app version, offline grace, and employee access pause. These are OverHead controls; they do not configure native Windows Group Policy, Active Directory, or Entra.'],
  ['Local work records', 'Customer documents and operational records remain on the configured Server or workstation. Cylinder access management does not replicate local records or files to Firebase Storage or between devices.'],
  ['Separate configurations', 'Backups, Windows host security, SMTP, Microsoft Entra registration and consent, payment providers, and any external distribution policy require their own setup.'],
]

export default function CylinderPage() {
  return <SiteShell tone="light"><main>
    <PageHero eyebrow="OverHead Cylinder · 0.3.24" title="The multi-user OverHead deployment for a managed department.">
      <p>{cylinderDeployment.text} The Server and Client share the latest OverHead workspace, keyboard, planner, history, and bulk-update improvements.</p>
      <div className="cylinder-hero-actions">
        <Link className="primary" href={cylinderDownloadHref}>Get Cylinder Server</Link>
        <Link className="text-link" href="#requirements">Check host requirements</Link>
        <Link className="text-link" href="/user-guide/">Open the quick User Guide</Link>
      </div>
    </PageHero>

    <section id="requirements" className="section cylinder-fit">
      <article>
        <span>Choose Cylinder Server when</span>
        <strong>Your department needs an in-house Windows Server or Windows IoT host with centrally managed OverHead employees and devices.</strong>
        <p>Each Server workspace includes one 30-day, no-card evaluation. It does not create a payment or automatically renew.</p>
        <strong className="cylinder-fit-price">{cylinderDeployment.price} flat · {cylinderDeployment.annualPrice} annually</strong>
      </article>
      <article>
        <span>Choose Cylinder Client when</span>
        <strong>You are deploying an enrolled OverHead endpoint to a Windows 10/11 workstation or remote-desktop session.</strong>
        <p>The Client uses the department's Cylinder membership and device policy. It is not the Server host or a standalone management console.</p>
        <Link className="text-link" href={cylinderClientDownloadHref}>Get Cylinder Client for Windows 10/11</Link>
      </article>
      <article>
        <span>Choose standard OverHead Desktop when</span>
        <strong>One person needs the individual-user edition on a regular Windows 10/11 computer.</strong>
        <p>Desktop has the shared business workflows and current UX without Cylinder's centralized department and device controls.</p>
        <Link className="text-link" href={downloadHref}>Get OverHead Desktop for Windows</Link>
      </article>
    </section>

    <section className="page-body cylinder-overview">
      <div>
        <p className="eyebrow">One shared OverHead workspace experience</p>
        <h2>Core business tools, with a department control plane on the Server.</h2>
        <p className="section-copy">Desktop, Cylinder Server, and Cylinder Client share the 0.3.24 command palette (Ctrl+K), keyboard navigation, Work Planner, recent-record history, bulk status previews, and performance improvements. Cylinder Server adds employee and device management for a supported host; the separate Client carries the shared work experience to managed endpoints.</p>
      </div>
      <div className="cylinder-signal">
        <span>Current entitlement profile</span>
        <strong>Up to 50 users and 100,000 customer records.</strong>
        <p>Manage employee invitations and removals, four Ranks, departments, device approval, minimum-version and offline policies, access pause, and audit from Cylinder Management.</p>
      </div>
    </section>

    <section className="section">
      <p className="eyebrow">Four Ranks</p>
      <h2>Give each management level a defined scope.</h2>
      <div className="card-grid two">
        {ranks.map(([title, body]) => <article key={title}><span>{title}</span><strong>{title}</strong><p>{body}</p></article>)}
      </div>
      <p className="office-fit-note">A person cannot manage an equal or higher Rank. Management and Administrator actions are limited by their department scope; only the Owner has workspace-wide authority. The Owner can set a minimum app version and offline grace, pause employee access, and review workspace audit events.</p>
    </section>

    <section className="section">
      <p className="eyebrow">Server and Client setup</p>
      <h2>Keep each package on the right Windows edition.</h2>
      <div className="step-grid">{installSteps.map(([step, body]) => <article key={step}><strong>{step}</strong><p>{body}</p></article>)}</div>
      <p className="section-copy">The Server package can optionally include the Cylinder Client distribution package. Administrators can stage the validated Client package to a VPN-accessible share or use their existing software-deployment tools. Remote installation requires the organization's separately configured administrative access and PowerShell remoting.</p>
    </section>

    <section className="section cylinder-download-panel">
      <div>
        <p className="eyebrow">Cylinder price and downloads</p>
        <h2>{cylinderDeployment.price} flat for the Server tier.</h2>
        <p>One 30-day, no-card evaluation is available per Server workspace. It creates no payment and does not automatically renew. Continued access requires a separate deployment order or contract, billing confirmation, and an issued entitlement. Includes up to 50 users and 100,000 customer records. Windows Server licensing, host hardware, backups, provider accounts, and custom deployment work are separate.</p>
      </div>
      <div className="cylinder-download-actions">
        <Link className="primary" href={cylinderDownloadHref}>Download Cylinder Server 0.3.24</Link>
        <Link className="secondary" href={cylinderChecksumHref}>Get Server installer checksums</Link>
        <Link className="secondary" href={cylinderClientDownloadHref}>Download Cylinder Client 0.3.24</Link>
        <Link className="secondary" href={cylinderClientChecksumHref}>Get Client installer checksums</Link>
      </div>
    </section>

    <section className="section"><p className="eyebrow">Operating boundaries</p><h2>Know what the central controls cover.</h2><div className="card-grid three">{boundaries.map(([title, body]) => <article key={title}><span>{title}</span><strong>{title}</strong><p>{body}</p></article>)}</div></section>

    <section className="section cylinder-contact"><div><p className="eyebrow">Need help choosing?</p><h2>Ask before installing on a server host.</h2><p className="section-copy">Send the Windows edition, intended user count, and the deployment question. Do not send passwords, recovery codes, or customer records.</p></div><a className="primary" href="mailto:solidartentertainment@gmail.com?subject=OverHead%20Cylinder%20Deployment%20Question">Ask about Cylinder deployment</a></section>
    <CTA />
  </main></SiteShell>
}
