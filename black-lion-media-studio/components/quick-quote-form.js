"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { serviceCatalog } from "../lib/services";

const STORAGE_KEY = "bls-quote-leads";
const budgetRanges = ["Under $250", "$250-$500", "$500-$1,000", "$1,000-$2,500", "$2,500+", "Not sure yet"];
const timelines = ["ASAP", "This week", "This month", "Specific event date", "Flexible"];

export function QuickQuoteForm() {
  const searchParams = useSearchParams();
  const requestedService = searchParams.get("service");
  const defaultService = serviceCatalog.some((service) => service.name === requestedService)
    ? requestedService
    : serviceCatalog[0]?.name || "";
  const [draft, setDraft] = useState({
    service: defaultService,
    budget: budgetRanges[1],
    timeline: timelines[1],
    name: "",
    email: "",
    details: ""
  });
  const [notice, setNotice] = useState("");
  const services = useMemo(() => serviceCatalog.map((service) => service.name), []);

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function submit(event) {
    event.preventDefault();
    setNotice("");
    if (!draft.name.trim() || !draft.email.trim() || !draft.details.trim()) {
      setNotice("Add your name, email, and project details before saving the quote request.");
      return;
    }
    const record = {
      ...draft,
      sourcePath: window.location.pathname,
      referrer: document.referrer || "",
      submittedAt: new Date().toISOString()
    };
    try {
      const current = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([record, ...current].slice(0, 25)));
      setNotice("Quote details saved in this browser. Continue to the portal or email the studio to send it.");
    } catch {
      setNotice("Quote details are ready. Continue to the portal or email the studio to send it.");
    }
  }

  return (
    <form className="quick-quote-form" onSubmit={submit}>
      <div className="quick-quote-grid">
        <label>
          Service
          <select value={draft.service} onChange={(event) => update("service", event.target.value)}>
            {services.map((service) => (
              <option key={service}>{service}</option>
            ))}
          </select>
        </label>
        <label>
          Budget range
          <select value={draft.budget} onChange={(event) => update("budget", event.target.value)}>
            {budgetRanges.map((range) => (
              <option key={range}>{range}</option>
            ))}
          </select>
        </label>
        <label>
          Timeline
          <select value={draft.timeline} onChange={(event) => update("timeline", event.target.value)}>
            {timelines.map((timeline) => (
              <option key={timeline}>{timeline}</option>
            ))}
          </select>
        </label>
        <label>
          Name
          <input value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder="Your name" />
        </label>
        <label>
          Email
          <input type="email" value={draft.email} onChange={(event) => update("email", event.target.value)} placeholder="you@example.com" />
        </label>
      </div>
      <label>
        Project details
        <textarea
          value={draft.details}
          onChange={(event) => update("details", event.target.value)}
          rows={5}
          placeholder="Tell the studio what you need, where it is happening, links/references, and what decision you need next."
        />
      </label>
      {notice ? <p className="message quick-quote-saved">{notice}</p> : null}
      <div className="quick-quote-actions">
        <button type="submit" className="button">Save quote details</button>
        <Link href="/portal" className="button button-secondary">Continue to portal</Link>
        <a className="button button-secondary" href="mailto:contact@blacklionstudios.com">Email studio</a>
      </div>
    </form>
  );
}
