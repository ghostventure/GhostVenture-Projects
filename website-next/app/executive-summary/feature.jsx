import styles from './summary.module.css'
export default function ExecutiveSummaryFeature() {
  return <section className={styles.feature} aria-label="Executive summary">
    <div><p className={styles.eyebrow}>Overhead LLC · Executive summary</p><h2>The business, at a glance.</h2><p>Our purpose, product, commercial model, and path forward—in a concise, two-page brief.</p></div>
    <div className={styles.actions}><a className={styles.button} href="/executive-summary/">Read the summary</a><a href="/downloads/Overhead-LLC-Executive-Summary.pdf" download>Download PDF</a></div>
  </section>
}
