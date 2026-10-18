import Link from 'next/link'
import { PageHero, SiteShell } from '../components'
import { iosSourceHref } from '../data'

const capabilities = [
  ['One workspace', 'Use the same verified OverHead account, role, and workspace identity across the web, Windows desktop, and the future iPhone app.'],
  ['Native iPhone workflow', 'A SwiftUI interface for customer records, priority tasks, approvals, and account controlsâ€”not a browser wrapper.'],
  ['Protected on-device access', 'The app uses the iPhoneâ€™s device authentication after it has been backgrounded. It never stores a raw password.'],
  ['Shared operational data', 'Customer, task, and approval changes synchronize through the existing OverHead Firebase workspace and its role-aware rules.'],
]

export default function IOSPage() {
  return <SiteShell><main><PageHero eyebrow="OverHead for iPhone" title="A native mobile companion for the office work that cannot wait."><p>OverHead for iPhone is being built in SwiftUI to bring the customer record, priority queue, approvals, and protected workspace access to your phone while preserving the same account and role controls used by OverHead Desktop.</p></PageHero><section className="section"><p className="eyebrow">Native build in progress</p><h2>Designed for the same workspaceâ€”not a second system.</h2><div className="card-grid two">{capabilities.map(([title, body]) => <article key={title}><strong>{title}</strong><p>{body}</p></article>)}</div></section><section className="section boundaries-section"><p className="eyebrow">Availability</p><h2>Native source is ready for iPad build; the App Store release is not available yet.</h2><p className="section-copy">Download the SwiftUI source package to open it in Swift Playgrounds on iPad. The app still needs Apple signing, TestFlight testing, and App Store review before a public iPhone download can be offered.</p><div className="hero-actions"><Link className="primary" href={iosSourceHref}>Download SwiftUI source</Link><Link className="text-link" href="/sign-in/">Open workspace</Link></div></section></main></SiteShell>
}
