import Link from "next/link";
import {
  adExpansion200Components,
  adExpansion200Summary,
  adExpansion200Workstreams
} from "../../lib/ad-expansion-200";

export const metadata = {
  title: "Ad Expansion System",
  description:
    "Two hundred Black Lion Studios ad conversion, service intake, trust, operations, analytics, and reliability components staged for paid traffic.",
  alternates: { canonical: "/ad-expansion" }
};

export default function AdExpansionPage() {
  return (
    <div className="page-shell">
      <main className="stack">
        <section className="panel legal-hero">
          <p className="label">Ad expansion system</p>
          <h1>200 additional ad, intake, trust, and reliability components are staged.</h1>
          <p>
            This board keeps the paid-traffic expansion visible: conversion paths, service intake,
            proof, support, analytics, reliability, local SEO, commerce, operations, and compliance.
          </p>
          <div className="legal-action-row">
            <Link href="/book" className="button">Book</Link>
            <Link href="/#service-estimation" className="button button-secondary">Service Estimation</Link>
            <Link href="/support" className="button button-secondary">Support</Link>
          </div>
        </section>

        <section className="simple-grid">
          <article className="panel">
            <p className="label">Installed</p>
            <h2>{adExpansion200Summary.count}</h2>
            <p className="muted">additional components</p>
          </article>
          <article className="panel">
            <p className="label">Workstreams</p>
            <h2>{adExpansion200Summary.workstreamCount}</h2>
            <p className="muted">parallel lanes</p>
          </article>
          <article className="panel">
            <p className="label">Priority</p>
            <h2>{adExpansion200Summary.p0Count}</h2>
            <p className="muted">P0 controls</p>
          </article>
        </section>

        <section className="panel">
          <p className="label">Workstreams</p>
          <div className="landing-offer-matrix">
            {adExpansion200Workstreams.map((workstream) => (
              <div className="landing-offer-cell" key={workstream.id}>
                <span>{workstream.owner}</span>
                <strong>{workstream.label}</strong>
                <p>{workstream.focus}</p>
                <p>{workstream.count} components</p>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <p className="label">Component library</p>
          <div className="service-grid">
            {adExpansion200Components.map((component) => (
              <article className="service-card" key={component.id}>
                <span>{component.priority} · {component.workstream}</span>
                <strong>{component.title}</strong>
                <p>{component.action}</p>
                <p className="muted">{component.status} · {component.owner}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
