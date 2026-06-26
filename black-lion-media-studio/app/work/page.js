import Link from "next/link";
import { LandingMediaPair, LandingOfferMatrix } from "../../components/shared-ui";

export const metadata = {
  title: "Work",
  description: "Black Lion Studios work lanes for creative production, sound, technical support, and client portal coordination.",
  alternates: { canonical: "/work" }
};

const workItems = [
  { label: "Photo and video", value: "Production", copy: "Portraits, products, campaigns, reels, events, and branded footage." },
  { label: "Music and events", value: "Sound", copy: "Beat sessions, DJ services, and creative support for music-driven projects." },
  { label: "Sites and support", value: "Tech", copy: "Membership sites, updates, troubleshooting, PC setup, and practical help." },
  { label: "Client flow", value: "Portal", copy: "Requests, messages, billing context, and scheduling stay tied together." }
];

export default function WorkPage() {
  return (
    <div className="page-shell">
      <main className="stack">
        <LandingMediaPair
          image="/ai/sound-atmosphere.png"
          eyebrow="Work"
          title="Creative and technical projects with a clear handoff."
          copy="Black Lion Studios organizes each request around the service needed, the schedule, and the next action."
          items={["Creative production", "Audio and event support", "Membership-site and PC support", "Portal-based follow-up"]}
        />
        <section className="panel">
          <p className="label">Work lanes</p>
          <LandingOfferMatrix items={workItems} />
          <div className="section-action-row">
            <Link href="/portal" className="button">Start a request</Link>
            <Link href="/services" className="button button-secondary">View services</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
