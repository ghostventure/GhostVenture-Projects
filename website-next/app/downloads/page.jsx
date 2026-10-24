import styles from './downloads.module.css'
import { CTA, PageHero, SiteShell } from '../components'

const release = 'https://github.com/ghostventure/GhostVenture-Projects/releases/download'

const packages = [
  {
    name: 'OverHead Desktop',
    anchor: 'desktop',
    version: '0.3.24',
    detail: 'For an individual office user on Windows 10 or 11.',
    installer: `${release}/overhead-v0.3.24/OverHead-Setup-0.3.24-win-x64.exe`,
    archive: `${release}/overhead-v0.3.24/OverHead-Desktop-0.3.24-win-x64.zip`,
    checksum: `${release}/overhead-v0.3.24/SHA256SUMS.txt`,
  },
  {
    name: 'Cylinder Server',
    anchor: 'cylinder-server',
    version: '0.3.24',
    detail: 'For supported Windows Server or Windows IoT hosts managing a department.',
    installer: `${release}/overhead-cylinder-v0.3.24/OverHead-Cylinder-Setup-0.3.24-win-x64.exe`,
    archive: `${release}/overhead-cylinder-v0.3.24/OverHead-Cylinder-0.3.24-win-x64.zip`,
    checksum: `${release}/overhead-cylinder-v0.3.24/SHA256SUMS.txt`,
  },
  {
    name: 'Cylinder Client',
    anchor: 'cylinder-client',
    version: '0.3.24',
    detail: 'For managed Windows 10 or 11 workstations enrolled in a Cylinder department.',
    installer: `${release}/overhead-cylinder-client-v0.3.24/OverHead-Cylinder-Client-Setup-0.3.24-win-x64.exe`,
    archive: `${release}/overhead-cylinder-client-v0.3.24/OverHead-Cylinder-Client-0.3.24-win-x64.zip`,
    checksum: `${release}/overhead-cylinder-client-v0.3.24/SHA256SUMS.txt`,
  },
]

export default function DownloadsPage() {
  return <SiteShell tone="light"><main>
    <PageHero eyebrow="OverHead downloads" title="Choose the package for your Windows workspace.">
      <p>These links open the published 0.3.24 GitHub release assets. Choose the package that matches the computer and the way your team uses OverHead.</p>
      <div className={styles.heroLinks}>
        <a className="primary" href="/user-guide/">Read the User Guide</a>
        <a className="text-link" href="/downloads/OverHead-User-Guide.pdf">Download the User Guide PDF</a>
      </div>
    </PageHero>

    <section className={styles.packageGrid} aria-label="OverHead Windows packages">
      {packages.map((item) => <article className={styles.package} id={item.anchor} key={item.name}>
        <p className={styles.eyebrow}>Version {item.version}</p>
        <h2>{item.name}</h2>
        <p>{item.detail}</p>
        <div className={styles.actions}>
          <a className="primary" href={item.installer}>Download installer (.exe)</a>
          <a className="secondary" href={item.archive}>Download portable archive (.zip)</a>
          <a className={styles.checksum} href={item.checksum}>View release checksums</a>
        </div>
      </article>)}
    </section>

    <section className={styles.releaseNotes} aria-labelledby="before-installing">
      <div>
        <p className={styles.eyebrow}>Before installing</p>
        <h2 id="before-installing">A few quick checks</h2>
      </div>
      <ul>
        <li>Use Desktop for an individual Windows 10 or 11 office computer. Cylinder Server and Client have separate roles and installers.</li>
        <li>Read the <a href="/user-guide/">User Guide</a> for setup, sign-in, backups, updates, and package requirements.</li>
        <li>Check the checksum file published alongside the package when you need to verify a download.</li>
        <li>Desktop automatic update checks use its Firebase update feed first and a matching stable GitHub release as fallback. Cylinder editions use their own feeds; manual download links here go to the matching GitHub release.</li>
      </ul>
      <p className={styles.note}>The locally rebuilt “OverHead Installation Manager” is not one of the published release assets. This page links to the published OverHead 0.3.24 setup installer and does not describe a separate desktop release.</p>
    </section>
    <CTA />
  </main></SiteShell>
}
