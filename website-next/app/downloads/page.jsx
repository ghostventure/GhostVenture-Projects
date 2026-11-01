import styles from './downloads.module.css'
import { CTA, PageHero, SiteShell } from '../components'

const release = 'https://github.com/ghostventure/GhostVenture-Projects/releases/download'

const packages = [
  {
    name: 'OverHead Install Manager',
    anchor: 'desktop',
    updated: 'Updated November 1, 2026',
    detail: 'Download the Manager to check your Windows edition and install the latest matching OverHead release after you review and agree. This local build is unsigned, and its checksum does not identify the publisher.',
    installer: '/downloads/OverHead-Install-Manager.exe',
    checksum: '/downloads/SHA256SUMS.txt',
    manager: true,
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
      <p>Download the Install Manager. After you consent, it selects OverHead Desktop for supported Windows 10/11 workstation editions or Cylinder Server for supported Windows Server/IoT editions. Cylinder Client remains a separate workstation package.</p>
      <div className={styles.heroLinks}>
        <a className="primary" href="/user-guide/">Read the User Guide</a>
        <a className="text-link" href="/downloads/OverHead-User-Guide.pdf">Download the User Guide PDF</a>
      </div>
    </PageHero>

    <section className={styles.packageGrid} aria-label="OverHead Windows packages">
      {packages.map((item) => <article className={styles.package} id={item.anchor} key={item.name}>
        <p className={styles.eyebrow}>{item.updated || `Version ${item.version}`}</p>
        <h2>{item.name}</h2>
        <p>{item.detail}</p>
        <div className={styles.actions}>
          <a className="primary" href={item.installer}>{item.manager ? 'Download Install Manager (.exe)' : 'Download installer (.exe)'}</a>
          {item.archive && <a className="secondary" href={item.archive}>Download portable archive (.zip)</a>}
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
        <li>The Install Manager handles Desktop on supported Windows 10/11 workstation editions and Cylinder Server on supported Windows Server/IoT editions. Cylinder Client remains a separate workstation package.</li>
        <li>Read the <a href="/user-guide/">User Guide</a> for setup, sign-in, backups, updates, and package requirements.</li>
        <li>Review the published SHA-256 checksum to confirm the Manager file matches this download.</li>
        <li>The Manager checks for the latest matching Desktop or Cylinder Server release and begins installation only after you consent. This unsigned Manager checksum does not independently verify publisher identity.</li>
      </ul>
      <p className={styles.note}>This download page hosts the Install Manager. Application installers are obtained by the Manager only after you consent.</p>
    </section>
    <CTA />
  </main></SiteShell>
}
