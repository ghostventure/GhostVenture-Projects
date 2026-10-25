import Link from "next/link";
import { businessLines } from "../lib/business-lines";

export default function HomePage() {
  return (
    <div className="page-shell homepage-shell">
      <main className="stack">
        <section className="panel hero-stage splash-landing" style={{ backgroundImage: "url('/ai/hero-editorial.png')" }}>
          <div className="hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">Creative production · Technology · Fashion</p>
              <h1 className="brand-signature">Ideas into experiences.</h1>
              <p>
                Black Lion Studios brings creative production, practical technology, and fashion
                projects together. Choose a team to explore services, plan a project, or find the
                right next step.
              </p>
              <div className="hero-actions">
                <Link href="/plan" className="button">Plan a project</Link>
              </div>
            </div>

            <div className="splash-branch-grid" aria-label="Black Lion Studios branches">
              {businessLines.map((line) => (
                <Link className="splash-branch-card" href={line.href} key={line.slug}>
                  <span>{line.eyebrow}</span>
                  <strong>{line.name}</strong>
                  <p>{line.summary}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
