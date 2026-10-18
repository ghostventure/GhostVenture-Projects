import FeedbackForm from './feedback-form'
import { PageHero } from '../components'

export const metadata = {
  title: 'Product feedback | OverHead',
  description: 'Send private, actionable feedback to the OverHead product team.',
}

export default function FeedbackPage() {
  return <>
    <PageHero eyebrow="Customer feedback" title="Tell us what would make OverHead work better.">
      <p>Share the friction, the outcome you expected, or the improvement that would make your day easier. Feedback goes privately to the OverHead product team.</p>
    </PageHero>
    <section className="page-body contact-grid">
      <div className="contact-panel">
        <p className="eyebrow">Useful feedback</p>
        <h2>Specific beats perfect.</h2>
        <p>Tell us what you were trying to do, where the workflow slowed down, and what a better result would look like. Do not include passwords, recovery codes, payment details, or unredacted customer records.</p>
        <p>Your verified OverHead account is required to keep the feedback channel private and reduce spam. Product feedback is not shared with other customers.</p>
      </div>
      <div className="contact-panel">
        <p className="eyebrow">Send feedback</p>
        <h2>Help shape the next improvement.</h2>
        <FeedbackForm />
      </div>
    </section>
  </>
}
