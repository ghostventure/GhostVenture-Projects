import { CardGrid, CTA, PageHero, ProductProof, SiteShell } from '../components'
import { businessFoundation, businessPrinciples, businessReferences, businessScope } from '../business-foundation'

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

        <section className="page-body split">
          <div>
            <p className="eyebrow">Why It Exists</p>
            <h2>Small offices need a simpler way to stay organized.</h2>
            <p className="section-copy">OverHead keeps daily records, approvals, and follow-up within reach of the people doing the work.</p>
            <p className="section-copy">{businessFoundation.scope}</p>
          </div>
          <div className="metrics">
            <article className="metric"><span>Platform</span><strong>Windows</strong><p>Installed desktop app with local workflow state.</p></article>
            <article className="metric"><span>Audience</span><strong>SMB</strong><p>Local service offices and owner-run teams.</p></article>
            <article className="metric"><span>Model</span><strong>Local first</strong><p>Provider connections are explicit handoffs.</p></article>
            <article className="metric"><span>Focus</span><strong>Daily control</strong><p>Practical visibility for owners and managers.</p></article>
          </div>
        </section>

        <section className="section mission-statement">
          <p className="eyebrow">Our mission</p>
          <h2>{businessFoundation.mission}</h2>
          <p className="section-copy">{businessFoundation.boundary}</p>
        </section>

        <section className="section">
          <p className="eyebrow">Operating Principles</p>
          <h2>The standards that shape product, support, and commercial decisions.</h2>
          <CardGrid items={businessPrinciples} />
        </section>

        <ProductProof
          eyebrow="Installed product"
          title="See the office at a glance."
          body="The desktop app puts customer records, current work, office checks, and useful tools in one Windows view."
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
