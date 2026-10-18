"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function BackendStatusNotice({
  context = "account and request",
  className = ""
}) {
  const isModelApplication = context === "model application";
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let active = true;

    fetch("/api/me", { cache: "no-store", credentials: "same-origin" })
      .then((response) => {
        if (active) {
          setOffline(response.status >= 500);
        }
      })
      .catch(() => {
        if (active) {
          setOffline(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (!offline) {
    return null;
  }

  return (
    <div className={`ui-support-notice ${className}`.trim()} role="status">
      <strong>Online {context} tools are temporarily unavailable.</strong>
      <p>
        {isModelApplication
          ? "Model applications cannot be submitted right now. Please wait before entering application details, or contact the studio directly."
          : "Account sign-in and project requests cannot be completed right now. Public service information remains available, and you can contact the studio or check appointment options."}
      </p>
      <div className="hero-actions">
        {!isModelApplication && <Link href="/book" className="button button-secondary">View appointment options</Link>}
        <a
          href="mailto:contact@blacklionstudios.com?subject=Black%20Lion%20Studios%20project%20inquiry"
          className="button"
        >
          Email the studio
        </a>
      </div>
    </div>
  );
}
