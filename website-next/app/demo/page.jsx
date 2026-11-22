import Link from 'next/link'
import { PageHero, SiteShell } from '../components'
import DemoWorkspace from './demo-workspace'

export const metadata = {
  title: 'Try the OverHead Demo',
  description: 'Explore a no-account OverHead browser demo with fictional small-business records.',
}

export default function DemoPage() {
  return (
    <SiteShell tone="light">
      <main>
        <PageHero eyebrow="Free browser demo" title="Find the work that needs a next step.">
          <p>
            Explore a sample office, follow a quote, review an invoice, and see
            how OverHead keeps the next action visible. No account or download
            is needed.
          </p>
        </PageHero>

        <DemoWorkspace />

        <section className="section demo-next-step">
          <div>
            <p className="eyebrow">Ready for your own workspace?</p>
            <h2>Take the workflow from sample records to your office.</h2>
            <p className="section-copy">
            The demo is a short browser preview. The installed apps provide
              the real workspace and keep your operational records on your
              device.
            </p>
          </div>
          <div className="demo-next-actions">
            <Link className="primary" href="/download/">
              Choose your OverHead Suite download
            </Link>
          </div>
        </section>
      </main>
    </SiteShell>
  )
}
