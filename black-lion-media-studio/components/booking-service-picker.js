"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { findServiceBySlug, serviceCatalog } from "../lib/services";

export function BookingServicePicker() {
  const [slug, setSlug] = useState("");
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("service");
    if (findServiceBySlug(requested)) setSlug(requested);
  }, []);
  const service = findServiceBySlug(slug);
  return (
    <section className="panel" id="start-request">
      <p className="label">Start request</p>
      <h2>One request flow for every service.</h2>
      <p>Choose photography, video, music, AI development, or technical support. Then share your project details, budget range, and preferred consultation time in the portal.</p>
      <label>
        Service
        <select value={slug} onChange={(event) => setSlug(event.target.value)}>
          <option value="">Choose a service</option>
          {serviceCatalog.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
        </select>
      </label>
      {service && <p>{service.priceLabel}. {service.description}</p>}
      <div className="hero-actions">
        <Link href={service ? `/portal?service=${service.slug}` : "/portal"} className="button">Continue to request</Link>
      </div>
      <p className="muted">Submitting a request does not confirm a booking or take a payment. Scope, pricing, and scheduling are confirmed during follow-up.</p>
    </section>
  );
}
