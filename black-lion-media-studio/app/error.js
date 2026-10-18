"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({ error, reset }) {
  useEffect(() => {
    try {
      const current = JSON.parse(window.localStorage.getItem("bls-runtime-events") || "[]");
      window.localStorage.setItem(
        "bls-runtime-events",
        JSON.stringify([
          {
            type: "route-error",
            message: error?.message || "Route failed",
            path: window.location.pathname,
            at: new Date().toISOString()
          },
          ...current
        ].slice(0, 30))
      );
    } catch {
      // Error logging should never make recovery fail.
    }
  }, [error]);

  return (
    <div className="page-shell">
      <main className="stack">
        <section className="panel legal-hero">
          <p className="label">Black Lion Studios</p>
          <h1>This page needs a quick retry.</h1>
          <p>
            The session is still open. Retry the view, return home, or continue through the client
            portal.
          </p>
          <div className="legal-action-row">
            <button type="button" className="button" onClick={reset}>
              Retry
            </button>
            <Link href="/" className="button button-secondary">
              Home
            </Link>
            <Link href="/portal" className="button button-secondary">
              Portal
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
