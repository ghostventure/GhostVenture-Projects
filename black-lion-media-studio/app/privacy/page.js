import Link from "next/link";
import { lastUpdated, privacySections } from "../../lib/legal-content";

export default function PrivacyPage() {
  return (
    <div className="page-shell">
      <main className="stack">
        <section className="panel legal-hero">
          <p className="label">Privacy Policy</p>
          <h1>How client and account information is handled.</h1>
          <p>
            Black Lion Studios uses account information to provide services, communicate with
            clients, protect sign-in, support Square appointments, process requests, and coordinate
            delivery. Last updated {lastUpdated}.
          </p>
          <Link href="mailto:contact@blacklionstudios.com" className="button">
            Privacy contact
          </Link>
        </section>

        <section className="panel legal-section">
          <h2>Quick privacy summary</h2>
          <p>
            The public calendar may show whether a time is Available, Reserved, or Not Available,
            but it should not expose client names, model names, appointment notes, payment details,
            or private project information. Privacy requests can be sent through portal messages or
            contact@blacklionstudios.com.
          </p>
        </section>

        {privacySections.map((section) => (
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
          <h2>Security and retention</h2>
          <p>
            Information should be kept only as long as needed for account use, business records,
            legal obligations, dispute handling, security, and service delivery. Access should be
            limited to people and providers who need it to run the service.
          </p>
        </section>
      </main>
    </div>
  );
}
