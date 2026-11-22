import Link from 'next/link'
import { PageHero, SiteShell } from '../components'
import { cylinderDownload, macDownload, windowsDownloads } from './download-catalog'

export const metadata = {
  title: 'Download OverHead Suite',
  description: 'Choose OverHead Suite for Windows or Mac, the Install Manager, or the separate Cylinder deployment.',
}

export default function DownloadPage() {
  return (
    <SiteShell tone="light">
      <main>
        <PageHero eyebrow="OverHead Suite downloads" title="Choose the right Suite for your office.">
          <p>
            Start with the free browser demo if you want to explore first. When
            you are ready, pick the installed app that matches your computer
            and how your office works. The demo is a preview; these downloads are the installed OverHead Suite and related tools.
          </p>
          <div className="download-hero-actions">
            <Link className="primary" href="/demo/">Try the free demo</Link>
            <a className="text-link" href="#windows-downloads">Go to Windows downloads</a>
          </div>
        </PageHero>

        <section id="windows-downloads" className="section download-choice-section">
          <div className="download-section-heading">
            <div><p className="eyebrow">Windows</p><h2>Choose the Windows download you want.</h2></div>
            <p>The full desktop installer and the separate Install Manager are both available. Use the desktop installer if you want the direct app setup.</p>
          </div>
          <div className="download-choice-grid">
            {windowsDownloads.map((release) => (
              <article key={release.key} className={`download-choice-card${release.featured ? ' download-choice-featured' : ''}`}>
                <span className="download-version">{release.versionLabel}</span>
                <h3>{release.name}</h3>
                <p>{release.description}</p>
                <ul>{release.requirements.map((item) => <li key={item}>{item}</li>)}<li>{release.unsigned}</li></ul>
                <a className={release.downloadStyle} href={release.downloadHref}>{release.downloadLabel}</a>
                <div className="download-card-links"><a href={release.checksumHref}>{release.checksumLabel}</a><a href={release.releaseHref}>{release.releaseLabel}</a></div>
              </article>
            ))}
          </div>
        </section>

        <section className="section download-choice-section">
          <div className="download-section-heading">
            <div><p className="eyebrow">Native Mac app</p><h2>OverHead Suite for Mac</h2></div>
            <p>Use the Mac package only on a supported Intel Mac. Mac and Windows customer and task records stay in separate local workspaces.</p>
          </div>
          <article className="download-choice-card download-mac-card">
            <div><span className="download-version">{macDownload.versionLabel}</span><h3>{macDownload.name}</h3><p>{macDownload.requirements} {macDownload.unsigned}</p></div>
            <div className="download-mac-actions"><a className="primary" href={macDownload.downloadHref}>{macDownload.downloadLabel}</a><div className="download-card-links"><a href={macDownload.checksumHref}>{macDownload.checksumLabel}</a><a href={macDownload.notesHref}>{macDownload.notesLabel}</a></div></div>
          </article>
        </section>

        <section className="section download-integrity-note">
          <div><p className="eyebrow">Before opening an installer</p><h2>Check the file and understand the Windows warning.</h2></div>
          <div>
            <p>The current Windows desktop and Install Manager releases are unsigned. Their release pages say Windows publisher identity is not verified. Compare a downloaded file with that release’s SHA-256 checksum if you need to confirm it matches the published asset.</p>
            <p>A matching checksum confirms the file has not changed since it was published; it does not establish who published it. Download only from the official OverHead site or linked GitHub release.</p>
          </div>
        </section>

        <section className="section download-cylinder-callout">
          <div><p className="eyebrow">{cylinderDownload.requirementsLabel}</p><h2>OverHead Cylinder is a separate deployment.</h2><p>{cylinderDownload.description}</p></div>
          <div className="download-cylinder-actions"><a className="secondary" href={cylinderDownload.downloadHref}>Download Cylinder {cylinderDownload.version}</a><a href={cylinderDownload.checksumHref}>Cylinder SHA-256 checksums</a><Link href={cylinderDownload.releaseHref}>Release notes</Link><Link href={cylinderDownload.productHref}>Review host and evaluation details</Link></div>
        </section>

        <section className="section download-support-callout">
          <div><p className="eyebrow">Want to explore first?</p><h2>Try sample records before downloading.</h2><p>The browser demo does not need an account and never connects to a real business workspace.</p></div>
          <Link className="primary" href="/demo/">Open the free demo</Link>
        </section>
      </main>
    </SiteShell>
  )
}
