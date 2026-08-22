import { CTA, PageHero, SiteShell } from '../components'
import { businessFoundation } from '../business-foundation'
import { legalSections } from '../data'

const legalUse = [
  ['Product review', 'Use the product, privacy, payment, automation, and support sections to understand the operational boundaries a customer should see before relying on the software.'],
  ['Counsel review', 'Treat the boilerplates as an organized first draft for qualified legal review, not final jurisdiction-specific legal advice.'],
  ['Launch readiness', 'Align final terms, privacy disclosures, refunds, account policy, and payment language with the product features and actual operating practices before sale.'],
]

export default function LegalPage() {
  return (
    <SiteShell tone="light">
      <main>
        <PageHero eyebrow="Legal Center" title="Clear policy drafts for a responsible launch.">
          <p>These documents explain OverHead&apos;s intended product, privacy, access, automation, support, and commercial boundaries. They are organized starting points for customer review and qualified legal cleanup—not a substitute for legal advice.</p>
        </PageHero>

        <section className="page-body legal-stack">
          {legalSections.map((section) => (
            <article className="legal-block" key={section.title}>
              <strong>{section.title}</strong>
              <p>{section.body}</p>
            </article>
          ))}
        </section>

        <section className="section">
          <p className="eyebrow">How to use this center</p>
          <h2>Turn boilerplates into a more deliberate launch review.</h2>
          <div className="step-grid">{legalUse.map(([title, body]) => <article key={title}><strong>{title}</strong><p>{body}</p></article>)}</div>
        </section>

        <section className="section investor-disclaimer">
          <strong>Business boundary</strong>
          <p>{businessFoundation.boundary}</p>
        </section>

        <CTA />
      </main>
    </SiteShell>
  )
}
