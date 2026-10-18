import Link from 'next/link'
import { PageHero, SiteShell } from '../components'
import { iosSourceHref } from '../data'

const capabilities = [
  ['Native source preview', 'The downloadable SwiftUI source includes customer records, priority tasks, approval workflows, and account controls; it is not yet a released iPhone app.'],
  ['Workspace sign-in', 'The source uses Firebase Authentication and checks the workspace profile and role before opening shared data. Production-device behavior still needs release testing.'],
  ['Protected on-device access', 'The source locks after backgrounding and can require device-owner authentication. It stores a remembered email, not a raw password.'],
  ['Shared data implementation', 'The source is wired to read and write customer, task, and approval records through Firestore. Live production-device validation and Apple release review are still required.'],
]

export default function IOSPage() {
  return <SiteShell><main><PageHero eyebrow="OverHead for iPhone" title="A native mobile companion in development."><p>A SwiftUI source preview is available for developers to inspect and build. OverHead for iPhone is not yet offered as a customer-ready app through TestFlight or the App Store.</p></PageHero><section className="section"><p className="eyebrow">What the source includes</p><h2>A native interface connected to the OverHead workspace model.</h2><div className="card-grid two">{capabilities.map(([title, body]) => <article key={title}><strong>{title}</strong><p>{body}</p></article>)}</div></section><section className="section boundaries-section"><p className="eyebrow">Availability</p><h2>Developer source preview only; no public iPhone release yet.</h2><p className="section-copy">The SwiftUI source package can be opened in Swift Playgrounds on iPad. A customer release still requires Apple signing, production-device and Firebase-rule testing, TestFlight validation, and App Store review.</p><div className="hero-actions"><Link className="primary" href={iosSourceHref}>Download SwiftUI source</Link><Link className="text-link" href="/sign-in/">Open workspace</Link></div></section></main></SiteShell>
}
