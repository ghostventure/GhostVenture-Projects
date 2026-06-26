import Link from "next/link";
import { copyrightClaimSections, lastUpdated } from "../../lib/legal-content";

export default function DMCAPage() {
  return (
    <div className="page-shell">
      <main className="stack">
        <section className="panel legal-hero">
          <p className="label">Copyright Claims</p>
          <h1>Claims are reviewed as allegations, not automatic proof.</h1>
          <p>
            Black Lion Studios respects valid intellectual property rights, but a complaint is not
            treated as proof by itself. The studio may preserve creation records, challenge false
            claims, and reject abusive or unsupported allegations. Last updated {lastUpdated}.
          </p>
          <Link href="mailto:contact@blacklionstudios.com" className="button">
            Send copyright claim
          </Link>
        </section>

        <section className="panel legal-section">
          <h2>Copyright contact and evidence</h2>
          <p>
            Send claims to contact@blacklionstudios.com with the subject line &quot;Copyright
            Claim&quot;. Include the work you claim to own, the exact Black Lion Studios material you
            are challenging, and the facts supporting your claim. Black Lion Studios may compare
            that claim against source files, drafts, timestamps, deploy history, project notes, and
            other records showing original or independent creation.
          </p>
        </section>

        {copyrightClaimSections.map((section) => (
          <section className="panel legal-section" key={section.title}>
            <h2>{section.title}</h2>
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}

        <section className="panel legal-section">
          <h2>DMCA when it actually applies</h2>
          <p>
            DMCA procedures may be relevant if hosted third-party or user-submitted content creates
            a copyright dispute. Otherwise, ordinary business pages, independently created designs,
            common ideas, service descriptions, and functional website patterns are handled through
            the copyright-claim review above.
          </p>
        </section>
      </main>
    </div>
  );
}
