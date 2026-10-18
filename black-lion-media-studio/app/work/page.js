import Link from "next/link";
import { LandingMediaPair, LandingOfferMatrix, ShortcutRail } from "../../components/shared-ui";
import { businessLines } from "../../lib/business-lines";

export const metadata = {
  title: "Work",
  description: "Black Lion Studios work grouped by Multimedia, Tech Development, Fashion, and client portal coordination.",
  alternates: { canonical: "/work" }
};

const workItems = [
  { label: "Photos & Video", value: "Black Lion Multimedia", copy: "Production, sound, events, campaigns, DJ services, and beat sessions." },
  { label: "AI & Software", value: "Black Lion Tech Development", copy: "AI guidance, apps, automation, website maintenance, and PC support." },
  { label: "Fashion", value: "Black Lion Fashion", copy: "Merch, model sign-up, product visuals, and fashion campaign support." },
  { label: "Client flow", value: "Portal", copy: "Requests, messages, billing context, and scheduling stay tied together." }
];

export default function WorkPage() {
  return (
    <div className="page-shell">
      <main className="stack">
        <LandingMediaPair
          image="/ai/sound-atmosphere.png"
          eyebrow="Work"
          title="Work grouped by branch with a clear handoff."
          copy="Black Lion Studios organizes each request around Multimedia, Tech Development, or Fashion before it moves into the portal."
          items={businessLines.map((line) => line.name)}
        />
        <section className="panel">
          <p className="label">Work lanes</p>
          <ShortcutRail
            items={businessLines.map((line) => ({
              href: line.href,
              label: line.eyebrow,
              value: line.name,
              note: line.summary
            }))}
            className="ui-shortcut-tight"
          />
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
