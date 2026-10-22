import { CardGrid, CTA, PageHero, ProductProof, SiteShell } from '../components'
import { businessFoundation, businessPrinciples, businessReferences, businessScope } from '../business-foundation'
import styles from './business-plan.module.css'
import ExecutiveSummaryFeature from '../executive-summary/feature'

const operatingAreas = [
  { kicker: 'Customer work', title: 'Keep the next customer step visible.', body: 'Keep notes, service details, and follow-ups where the desk can use them.' },
  { kicker: 'Money work', title: 'Keep quotes and payment follow-up together.', body: 'Put quotes, invoices, reminders, and provider notes near the person handling them.' },
  { kicker: 'Team control', title: 'Review sensitive changes.', body: 'Use approvals for exports, policy changes, billing updates, and record changes that need an owner’s attention.' },
]

export default function AboutPage() {
  return (
    <SiteShell tone="light">
      <main>
        <PageHero eyebrow="About OverHead" title="A more organized office starts here.">
          <p>{businessFoundation.promise}</p>
        </PageHero>

        <ExecutiveSummaryFeature />
        <section className="page-body split">
          <div>
            <p className="eyebrow">Why It Exists</p>
            <h2>Small offices need a simpler way to stay organized.</h2>
            <p className="section-copy">OverHead keeps daily records, approvals, and follow-up within reach of the people doing the work.</p>
            <p className="section-copy">{businessFoundation.scope}</p>
          </div>
          <div className="metrics">
            <article className="metric"><span>Current release</span><strong>0.3.24</strong><p>Windows Desktop, Cylinder Server, and Cylinder Client share the latest workflow UX.</p></article>
            <article className="metric"><span>Audience</span><strong>SMB</strong><p>Local service offices and owner-run teams.</p></article>
            <article className="metric"><span>Workflow model</span><strong>Local first</strong><p>Scheduled reports, exports, and access reviews run locally while the app is open.</p></article>
            <article className="metric"><span>Focus</span><strong>Daily control</strong><p>Practical visibility for owners and managers.</p></article>
          </div>
        </section>

        <section className="section">
          <p className="eyebrow">Current release · 0.3.24</p>
          <h2>A faster shared workspace, with Cylinder's department controls.</h2>
          <p className="section-copy">All three Windows packages include keyboard navigation, Ctrl+K command search, Work Planner, recent-record history, bulk status previews, lazy-loaded workspaces, and batched local saves. Desktop remains the individual-user edition. Cylinder Server adds central employee Ranks, departments, device authorization, minimum-version/offline policies, access pause, and audit; Cylinder Client brings the shared work tools to enrolled Windows 10/11 workstations.</p>
          <p className="section-copy">Cylinder's controls govern OverHead membership and device access, not native Windows Group Policy, Active Directory, or Entra. Operational records and customer documents stay on the configured devices and are not centrally synchronized by these controls.</p>
        </section>

        <section className="section mission-statement">
          <p className="eyebrow">Our mission</p>
          <h2>{businessFoundation.mission}</h2>
          <p className="section-copy">{businessFoundation.boundary}</p>
        </section>

        <section id="business-plan" className={`section ${styles.plan}`} aria-labelledby="business-plan-title">
          <a className={styles.cover} href="/downloads/Overhead-LLC-Business-Plan.pdf" target="_blank" rel="noopener noreferrer" aria-label="Open the Overhead LLC business plan PDF in a new tab">
            <img src="/assets/overhead-business-plan-cover.webp" alt="Cover of the Overhead LLC business plan" width="408" height="528" loading="lazy" />
          </a>
          <div className={styles.content}>
            <p className="eyebrow">Our business plan</p>
            <h2 id="business-plan-title">A closer look at Overhead LLC.</h2>
            <p className={styles.description}>Explore the business behind OverHead: our market, product direction, operating strategy, and plans for sustainable growth.</p>
            <p className={styles.details}>September 2026 <span aria-hidden="true">·</span> 27 pages <span aria-hidden="true">·</span> PDF</p>
            <div className={styles.actions}>
              <a className="primary" href="/downloads/Overhead-LLC-Business-Plan.pdf" target="_blank" rel="noopener noreferrer">Read the business plan <span className={styles.srOnly}>(PDF, opens in a new tab)</span></a>
              <a className={styles.download} href="/downloads/Overhead-LLC-Business-Plan.pdf" download="Overhead-LLC-Business-Plan.pdf">Download PDF</a>
            </div>
            <p className={styles.note}>Financial projections are clearly labeled planning assumptions, alongside the research and product evidence that inform the plan.</p>
          </div>
        </section>

        <section className="section">
          <p className="eyebrow">Operating Principles</p>
          <h2>The standards that shape product, support, and commercial decisions.</h2>
          <CardGrid items={businessPrinciples} />
        </section>

        <ProductProof
          eyebrow="Installed product"
          title="See the office at a glance."
          body="OverHead Desktop 0.3.24 puts customer records, current work, office checks, keyboard tools, and local workflow controls in one Windows view."
          image="/assets/overhead-console-proof.png"
          alt="OverHead Desktop command console showing workspace status, customer database, action queue, and office readiness"
          caption="Actual OverHead Desktop smoke-test capture"
        />

        <section className="section">
          <p className="eyebrow">Where it helps</p>
          <h2>Designed around the work a local office repeats every day.</h2>
          <CardGrid items={operatingAreas} className="three" />
        </section>

        <section className="section">
          <p className="eyebrow">Product scope</p>
          <h2>Clear about what OverHead is—and what it is not.</h2>
          <div className="diligence-grid">{businessScope.map(([title, body]) => <article key={title}><strong>{title}</strong><p>{body}</p></article>)}</div>
          <p className="section-copy">Our approach is informed by practical small-business security guidance from <a href={businessReferences[0].href} target="_blank" rel="noreferrer">NIST</a> and the <a href={businessReferences[1].href} target="_blank" rel="noreferrer">FTC</a>. These references guide product judgment; they are not a certification claim.</p>
        </section>

        <CTA />
      </main>
    </SiteShell>
  )
}
