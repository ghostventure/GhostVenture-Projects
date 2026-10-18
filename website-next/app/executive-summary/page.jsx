import { SiteShell } from '../components'
import content from './content.json'
import styles from './summary.module.css'
export const metadata = { title: 'Executive Summary | Overhead LLC', description: 'The Overhead LLC business at a glance: product, opportunity, business model, and path forward. Read online or download the two-page executive summary.' }
export default function ExecutiveSummaryPage() {
  return <SiteShell tone="light"><main className={styles.document}>
    <p className={styles.eyebrow}>Overhead LLC / Executive summary</p>
    <h1>{content.title}</h1><p className={styles.lead}>{content.lead}</p>
    <div className={styles.actions}><a className={styles.button} href="/downloads/Overhead-LLC-Executive-Summary.pdf" download>Download the two-page PDF</a><a href="/downloads/Overhead-LLC-Business-Plan.pdf">Read the full business plan</a></div>
    <p className={styles.meta}>{content.date} · Companion to the September 2026 business plan</p>
    <div className={styles.grid}>{content.pages.flat().map(section => <section key={section.title}><h2>{section.title}</h2><p>{section.body}</p></section>)}</div>
    <p className={styles.closing}>{content.closing}</p>
    <div className={styles.actions}><a href="/contact/">Contact Overhead LLC</a><a href="/about/#business-plan">Explore the business plan</a></div>
  </main></SiteShell>
}
