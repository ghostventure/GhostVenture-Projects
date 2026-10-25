"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const budgetOptions = [
  { value: "all", label: "Any listed price" },
  { value: "under-500", label: "Under $500 listed" },
  { value: "500-999", label: "$500–$999 listed" },
  { value: "1000-2499", label: "$1,000–$2,499 listed" },
  { value: "2500-plus", label: "$2,500+ listed" },
  { value: "custom", label: "Custom quote" }
];

const turnaroundOptions = [
  { value: "all", label: "Any listed timing" },
  { value: "up-to-7", label: "Up to 7 days" },
  { value: "8-14", label: "8–14 days" },
  { value: "15-plus", label: "15+ days" },
  { value: "review", label: "Agreed after review" }
];

const ignoredWords = new Set(["about", "after", "also", "and", "are", "because", "build", "can", "for", "from", "have", "help", "into", "need", "our", "that", "the", "their", "then", "this", "want", "with", "would", "you"]);

function descriptionTerms(value) {
  return [...new Set(String(value || "").toLowerCase().match(/[a-z0-9]+/g) || [])]
    .filter((term) => term.length > 2 && !ignoredWords.has(term));
}

function listedAmount(service) {
  const match = service.priceLabel.match(/\$\s*([\d,]+)/);
  return match ? Number(match[1].replace(/,/g, "")) : null;
}

function turnaroundCeilingDays(service) {
  const match = service.turnaround.match(/(\d+)\s*(?:-\s*(\d+)\s*)?(business\s+days?|days?|weeks?)/i);
  if (!match) return null;
  const amount = Number(match[2] || match[1]);
  return /weeks?/i.test(match[3]) ? amount * 7 : amount;
}

function matchesBudget(service, filter) {
  if (filter === "all") return true;
  const amount = listedAmount(service);
  if (filter === "custom") return amount === null;
  if (amount === null) return false;
  if (filter === "under-500") return amount < 500;
  if (filter === "500-999") return amount >= 500 && amount < 1000;
  if (filter === "1000-2499") return amount >= 1000 && amount < 2500;
  return amount >= 2500;
}

function matchesTurnaround(service, filter) {
  if (filter === "all") return true;
  const days = turnaroundCeilingDays(service);
  if (filter === "review") return days === null;
  if (days === null) return false;
  if (filter === "up-to-7") return days <= 7;
  if (filter === "8-14") return days >= 8 && days <= 14;
  return days >= 15;
}

export function ServiceEvaluation({ services }) {
  const [budget, setBudget] = useState("all");
  const [turnaround, setTurnaround] = useState("all");
  const [selected, setSelected] = useState([]);
  const [projectDescription, setProjectDescription] = useState("");

  const filteredServices = useMemo(
    () => services.filter((service) => matchesBudget(service, budget) && matchesTurnaround(service, turnaround)),
    [services, budget, turnaround]
  );
  const comparedServices = selected.map((slug) => services.find((service) => service.slug === slug)).filter(Boolean);
  const serviceRecommendations = useMemo(() => {
    const terms = descriptionTerms(projectDescription);
    if (!terms.length) return { terms, services: [], branches: [] };
    const matches = services.map((service) => {
      const searchableText = [service.name, service.description, service.deliverable, service.coverage, service.slug, ...(service.branches || [])].join(" ").toLowerCase();
      const matchedTerms = terms.filter((term) => searchableText.includes(term));
      return { service, matchedTerms, score: matchedTerms.length };
    }).filter((entry) => entry.score > 0).sort((left, right) => right.score - left.score || left.service.name.localeCompare(right.service.name));
    const branchScores = new Map();
    for (const entry of matches) {
      for (const branch of entry.service.branches || []) {
        const current = branchScores.get(branch) || { score: 0, href: entry.service.branchHrefs?.[branch] || "/services", terms: new Set() };
        current.score += entry.score;
        entry.matchedTerms.forEach((term) => current.terms.add(term));
        branchScores.set(branch, current);
      }
    }
    const branches = [...branchScores.entries()].map(([name, result]) => ({
      name, href: result.href, score: result.score, terms: [...result.terms]
    })).sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));
    return { terms, services: matches.slice(0, 3), branches: branches.slice(0, 2) };
  }, [projectDescription, services]);

  function toggleService(slug) {
    setSelected((current) => current.includes(slug)
      ? current.filter((item) => item !== slug)
      : current.length < 3 ? [...current, slug] : current);
  }

  function resetFilters() {
    setBudget("all");
    setTurnaround("all");
  }

  return (
    <section className="panel service-evaluation" aria-labelledby="service-catalog-heading">
      <p className="label">Browse & compare</p>
      <h2 className="editorial-heading" id="service-catalog-heading">Find a service that fits</h2>
      <p className="muted">
        Filter by the catalog’s listed starting or recurring price and its stated turnaround. These are planning guides; final scope, availability, and quotes are confirmed with the studio.
      </p>

      <div className="service-recommendation">
        <label htmlFor="service-project-description">What are you trying to make or solve?</label>
        <textarea
          id="service-project-description"
          value={projectDescription}
          onChange={(event) => setProjectDescription(event.target.value)}
          rows="3"
          maxLength={1000}
          placeholder="For example: I need product photos and short videos for an online launch."
        />
        <p className="muted">Suggestions come from words matched against the service catalog. This stays in your browser and is not submitted.</p>
        {projectDescription.trim() ? (
          serviceRecommendations.branches.length ? (
            <div className="service-recommendation-results" aria-live="polite">
              <h3>Suggested studio branch</h3>
              <ul>
                {serviceRecommendations.branches.map((branch, index) => (
                  <li key={branch.name}>
                    <Link href={branch.href}>{branch.name}</Link>
                    {index === 0 ? <strong> Best catalog match</strong> : null}
                    <span className="muted"> Matched: {branch.terms.join(", ")}</span>
                  </li>
                ))}
              </ul>
              <p>Services to review: {serviceRecommendations.services.map(({ service }) => service.name).join(" · ")}</p>
            </div>
          ) : (
            <p className="notice" role="status" aria-live="polite">No direct catalog terms matched this description. Browse all three branches or describe the tools, media, event, or result you have in mind.</p>
          )
        ) : null}
      </div>

      <div className="service-evaluation-filters">
        <label>
          <span>Listed price range</span>
          <select value={budget} onChange={(event) => setBudget(event.target.value)}>
            {budgetOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label>
          <span>Estimated turnaround</span>
          <select value={turnaround} onChange={(event) => setTurnaround(event.target.value)}>
            {turnaroundOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
          </select>
        </label>
        <button type="button" className="button button-secondary" onClick={resetFilters} disabled={budget === "all" && turnaround === "all"}>
          Reset filters
        </button>
      </div>

      <p className="service-evaluation-count" role="status" aria-live="polite">
        Showing {filteredServices.length} of {services.length} catalog services. Compare up to 3.
      </p>

      {filteredServices.length ? (
        <div className="service-evaluation-grid">
          {filteredServices.map((service) => {
            const checked = selected.includes(service.slug);
            const atLimit = selected.length >= 3 && !checked;
            return (
              <article className="service-evaluation-card" key={service.slug}>
                <p className="label">{service.priceLabel}</p>
                <h3><Link href={service.href || "/services"}>{service.name}</Link></h3>
                <p>{service.description}</p>
                <dl>
                  <div><dt>Branch</dt><dd>{service.branches.join(" · ") || "Contact the studio"}</dd></div>
                  <div><dt>Turnaround</dt><dd>{service.turnaround}</dd></div>
                </dl>
                <label className="service-compare-toggle">
                  <input type="checkbox" checked={checked} disabled={atLimit} onChange={() => toggleService(service.slug)} />
                  <span>{checked ? "Added to comparison" : "Compare this service"}</span>
                </label>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="service-evaluation-empty">
          <strong>No services match both filters.</strong>
          <p>Try a wider price range or turnaround, or reset the filters to browse the full catalog.</p>
          <button type="button" className="button button-secondary" onClick={resetFilters}>Show all services</button>
        </div>
      )}

      {comparedServices.length > 0 ? (
        <section className="service-comparison" aria-labelledby="service-comparison-heading">
          <div className="service-comparison-heading">
            <div>
              <p className="label">Side-by-side</p>
              <h3 id="service-comparison-heading">Service comparison ({comparedServices.length}/3)</h3>
            </div>
            <button type="button" className="button button-secondary" onClick={() => setSelected([])}>Clear comparison</button>
          </div>
          {comparedServices.length < 2 ? (
            <p className="muted">Choose one more service to see the comparison table.</p>
          ) : (
            <div className="service-comparison-scroll" tabIndex="0" aria-label="Scrollable service comparison">
              <table>
                <caption>Selected services compared by branch, listed price, turnaround, and coverage</caption>
                <thead><tr><th scope="col">Details</th>{comparedServices.map((service) => <th scope="col" key={service.slug}>{service.name}</th>)}</tr></thead>
                <tbody>
                  <tr><th scope="row">Branch</th>{comparedServices.map((service) => <td key={service.slug}>{service.branches.join(" · ") || "Contact the studio"}</td>)}</tr>
                  <tr><th scope="row">Price context</th>{comparedServices.map((service) => <td key={service.slug}>{service.priceLabel}</td>)}</tr>
                  <tr><th scope="row">Estimated turnaround</th>{comparedServices.map((service) => <td key={service.slug}>{service.turnaround}</td>)}</tr>
                  <tr><th scope="row">Coverage</th>{comparedServices.map((service) => <td key={service.slug}>{service.coverage}</td>)}</tr>
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </section>
  );
}
