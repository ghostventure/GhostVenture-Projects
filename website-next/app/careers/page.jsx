import { CTA, PageHero, ProductProof, SiteShell } from '../components'
import { businessFoundation, businessPrinciples } from '../business-foundation'
import CareersJobBoard from './careers-job-board'

const principles = [
  ['Stay close to the work', businessPrinciples[3].body],
  ['Own the outcome', 'People closest to the work are expected to name the gap, explain the tradeoff, and carry meaningful work through.'],
  ['Communicate plainly', 'Direct writing, careful judgment, and an honest change of course matter more than polished corporate language.'],
  ['Make it dependable', 'Quality means a useful, explainable product—not decoration, inflated claims, or complexity a busy office cannot carry.'],
]

const process = [
  ['1. Apply directly', 'Choose a role and send a short introduction with a resume, portfolio, or relevant work example. There is no account to create.'],
  ['2. Meet the work', 'If there is a fit, the conversation focuses on the problem the role owns, the company direction, and what you want to build next.'],
  ['3. Show your approach', 'Some roles may use a brief, relevant exercise or portfolio discussion to understand how you think—not to extract free work.'],
  ['4. Get a clear answer', 'We aim to provide a direct next step or decision and to respect the time you put into the process.'],
]

export default function CareersPage() {
  return (
    <SiteShell tone="light">
      <main>
        <PageHero eyebrow="Careers at OverHead" title="Make everyday office work easier to run.">
          <p>OverHead is for people who want to build practical software for the work that keeps small businesses moving. Our mission is simple: {businessFoundation.mission.toLowerCase()}</p>
          <div className="career-hero-actions"><a className="primary" href="#open-roles">See open roles</a><a className="text-link" href="mailto:solidartentertainment@gmail.com?subject=OverHead%20Careers%20Question">Ask a careers question</a></div>
        </PageHero>

        <section className="page-body careers-opening">
          <div><p className="eyebrow">A better candidate experience</p><h2>See the work. Know the next step. Apply without the runaround.</h2><p className="section-copy">The open roles are below first—not buried behind company language. Each one explains the problem, the expected outcomes, the engagement type, and how to apply.</p></div>
          <div className="career-signal"><span>What matters here</span><strong>Useful ownership, clear thinking, and work that makes a real office run better.</strong><p>We care about the person using the product at the desk, the customer waiting for an answer, and the owner who needs to understand what is happening.</p></div>
        </section>

        <section className="section careers-at-a-glance" aria-label="Working at OverHead">
          <article><span>01</span><strong>Practical product work</strong><p>Help make customer records, active work, payments, approvals, and support easier to manage.</p></article>
          <article><span>02</span><strong>Visible ownership</strong><p>Take responsibility for a meaningful part of the customer experience and explain your decisions clearly.</p></article>
          <article><span>03</span><strong>Small-team contribution</strong><p>Bring useful judgment across product, customer, and operational questions as the company grows.</p></article>
        </section>

        <CareersJobBoard />

        <section className="section"><p className="eyebrow">How we work</p><h2>A work style built for useful decisions.</h2><p className="section-copy">The product is meant to reduce uncertainty for offices. The same standard applies internally: understand the real problem, make the tradeoffs visible, and leave the next person with a clearer path.</p><div className="careers-principle-grid">{principles.map(([title, body]) => <article key={title}><strong>{title}</strong><p>{body}</p></article>)}</div></section>

        <ProductProof
          eyebrow="The product"
          title="Help shape a product that has to earn daily use."
          body="OverHead Desktop is packaged as a Windows application for real office work. The next chapters are about strengthening the secure account layer, deepening the workflow tools that earn daily use, and connecting web and desktop without losing a straightforward local-first experience."
          image="/assets/overhead-console-proof.png"
          alt="OverHead desktop command console with operational queue and customer work tools"
          caption="Actual OverHead Desktop smoke-test capture"
        />

        <section className="section"><p className="eyebrow">Application process</p><h2>Specific, respectful, and focused on real work.</h2><p className="section-copy">The process should help both sides decide whether the work is a fit. We will not ask you to create an account, repeat your resume in a form, or send payment for any part of the application.</p><div className="step-grid">{process.map(([step, body]) => <article key={step}><strong>{step}</strong><p>{body}</p></article>)}</div></section>

        <section className="section careers-apply"><div><p className="eyebrow">Open application</p><h2>Do not see the right title?</h2><p>Send a short introduction, a resume or portfolio, the area you are interested in, and one example of a practical product or operational problem you helped solve.</p></div><a className="primary" href="mailto:solidartentertainment@gmail.com?subject=OverHead%20Open%20Application">Send an open application</a></section>

        <section className="section career-safety"><strong>Candidate safety</strong><p>OverHead will not ask candidates to pay a fee, share financial login credentials, or provide sensitive identity documents before a legitimate offer process. Verify unexpected outreach through the application email above.</p></section>

        <CTA />
      </main>
    </SiteShell>
  )
}
