import { CardGrid, CTA, PageHero, SiteShell } from '../components'
import { businessFoundation } from '../business-foundation'
import ContactForm from './contact-form'

const contactRoutes = [
  { kicker: 'Product and setup', title: 'Choose the right starting point.', body: 'Ask about Windows installation, workspace setup, plans, or the product workflow that fits your office.' },
  { kicker: 'Support and recovery', title: 'Move a blocked workflow forward.', body: 'Send your version, the step reached, and any relevant evidence so the request starts with useful context.' },
  { kicker: 'Business and partnerships', title: 'Talk through the opportunity clearly.', body: 'Use the direct contact path for investor questions, partnership conversations, and operating or licensing discussions.' },
]

export default function ContactPage() {
  return (
    <SiteShell tone="light">
      <main>
        <PageHero eyebrow="Contact" title="Let’s talk about what you need.">
          <p>Contact us about the product, support, partnerships, investment, or legal review. Include a short note about the issue or question.</p>
        </PageHero>

        <section className="page-body contact-grid">
          <div className="contact-panel">
            <strong>Direct Contacts</strong>
            <p>Developer support: solidartentertainment@gmail.com</p>
            <p>Include the product version, the page or workflow involved, and whether your request is support, investment, legal, billing, or partnership related so it reaches the right path faster.</p>
          </div>
          <div className="contact-panel">
            <strong>Start a Conversation</strong>
            <p>Share the essential details below to organize your request before connecting it to the right support, sales, or review path.</p>
            <ContactForm />
          </div>
        </section>

        <section className="section">
          <p className="eyebrow">Route your message</p>
          <h2>Send it to the right place.</h2>
          <CardGrid items={contactRoutes} className="three" />
        </section>

        <section className="section investor-disclaimer">
          <strong>How OverHead operates</strong>
          <p>{businessFoundation.scope} We aim to state product status, limits, and next steps plainly so a customer or partner can make an informed decision.</p>
        </section>

        <CTA />
      </main>
    </SiteShell>
  )
}
