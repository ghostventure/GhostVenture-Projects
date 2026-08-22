import Link from "next/link";
import { CTA, CardGrid, SiteShell } from "./components";
import { businessFoundation } from "./business-foundation";
import {
  businessGuideHref,
  checksumHref,
  cylinderDeployment,
  cylinderPageHref,
  downloadHref,
  plans,
} from "./data";

const trustItems = [
  [
    "Windows desktop workspace",
    "Keep the work close to the desk where it happens.",
  ],
  [
    "Owner-aware controls",
    "Give staff momentum while preserving the reviews that matter.",
  ],
  [
    "Support-ready records",
    "Keep the context needed to answer “what happened?” later.",
  ],
];

const startSteps = [
  ["1", "Download", "Get the official Windows ZIP."],
  ["2", "Install", "Extract it locally, then run the installer."],
  ["3", "Set up", "Create the owner workspace and sign in."],
  ["4", "Start small", "Add one customer or task that needs attention."],
];

const outcomes = [
  {
    kicker: "Customer context",
    title: "Walk into every conversation prepared.",
    body: "Keep customer details, notes, workflow preferences, and local history in one place instead of rebuilding the story from messages and memory.",
  },
  {
    kicker: "Daily follow-through",
    title: "Make the next action easy to find.",
    body: "Bring active tasks, quote status, invoice follow-up, reminders, and owner priorities into one focused view.",
  },
  {
    kicker: "Staff control",
    title: "Keep work moving with the right checks.",
    body: "Route sensitive exports, policy edits, billing changes, restore operations, and record changes through the reviews your office needs.",
  },
  {
    kicker: "Clear answers",
    title: "Keep the evidence behind the work.",
    body: "Review important changes, payment imports, integrity checks, recovery events, and support bundles without digging through separate tools.",
  },
];

const revenueLeakSignals = [
  ["Open quotes", "Quotes that need a follow-up before the customer moves on."],
  ["Unpaid invoices", "Revenue work that needs a clear next call or reminder."],
  [
    "No next action",
    "Customers whose story is known but whose follow-through is not.",
  ],
  [
    "Waiting approval",
    "Work paused because the right person has not reviewed it.",
  ],
  ["Unassigned work", "Tasks that can quietly become nobody's responsibility."],
];

const firstWinSteps = [
  [
    "Bring in one active customer",
    "Start with the person, job, or account that needs attention today.",
  ],
  [
    "Name the next action",
    "Turn a loose note, open quote, or unpaid invoice into a visible follow-up.",
  ],
  [
    "Give it an owner",
    "Make responsibility clear before another handoff creates delay.",
  ],
  [
    "Review what is waiting",
    "See approvals and priority work before the end of the day.",
  ],
];

const officeFits = [
  [
    "Owner-led service businesses",
    "When the owner is still the final safety net for customer promises, follow-up, and payments.",
  ],
  [
    "Growing local teams",
    "When work has started moving between the front desk, operations, and management.",
  ],
  [
    "Established offices",
    "When customer context and accountability matter, but a heavyweight enterprise rollout does not.",
  ],
];

export default function HomePage() {
  return (
    <SiteShell>
      <main>
        <section className="home-hero">
          <div className="hero-inner">
            <p className="eyebrow">
              Windows office software for owner-led businesses
            </p>
            <h1>Find the customer work that is costing you money.</h1>
            <p className="lede">
              Use OverHead to run an Office Revenue Leak Check: find open
              quotes, unpaid invoices, missed follow-up, waiting approvals, and
              work assigned to nobody before they quietly become lost revenue.
            </p>
            <div className="hero-actions">
              <Link className="primary" href={downloadHref}>
                Start your Revenue Leak Check
              </Link>
              <Link
                className="text-link hero-guide-link"
                href={businessGuideHref}
              >
                See how it works
              </Link>
            </div>
            <p className="hero-note">
              <strong>30-day free Gold trial.</strong> No card is required to
              evaluate the workflow. Start with one customer and one task.
            </p>
            <div className="hero-readout" aria-label="Product capabilities">
              <div>
                <span>01</span>
                <strong>Keep the customer story together</strong>
              </div>
              <div>
                <span>02</span>
                <strong>See today&apos;s work in one view</strong>
              </div>
              <div>
                <span>03</span>
                <strong>Review changes with confidence</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="section revenue-check">
          <div className="revenue-check-intro">
            <p className="eyebrow">Office Revenue Leak Check</p>
            <h2>
              Do not ask your team to work harder before you can see what is
              stuck.
            </h2>
            <p className="section-copy">
              OverHead gives an owner a practical starting point: find the
              customer work with no clear next step, then assign it, review it,
              or follow through. Start with one list—not a complicated rollout.
            </p>
            <div className="home-proof-actions">
              <Link className="primary" href={downloadHref}>
                Get the Windows workspace
              </Link>
              <Link className="text-link" href="#get-started">
                See the four-step setup
              </Link>
            </div>
          </div>
          <div className="revenue-check-list">
            {revenueLeakSignals.map(([title, body], index) => (
              <article key={title}>
                <span>0{index + 1}</span>
                <div>
                  <strong>{title}</strong>
                  <p>{body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="section first-win-section">
          <div>
            <p className="eyebrow">Your first useful hour</p>
            <h2>Do not migrate the whole office. Prove the habit first.</h2>
            <p className="section-copy">
              The fastest way to judge OverHead is to use it on work already in
              motion. Start with one active customer, one revenue follow-up, and
              one decision that needs an owner.
            </p>
          </div>
          <div className="first-win-grid">
            {firstWinSteps.map(([title, body], index) => (
              <article key={title}>
                <span>Step {index + 1}</span>
                <strong>{title}</strong>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          className="trust-strip"
          aria-label="OverHead product trust points"
        >
          {trustItems.map(([title, text]) => (
            <article key={title}>
              <strong>{title}</strong>
              <span>{text}</span>
            </article>
          ))}
        </section>

        <section className="section home-intro">
          <div>
            <p className="eyebrow">A better office rhythm</p>
            <h2>
              The work after the customer call should not disappear into
              separate tools.
            </h2>
            <p className="section-copy">
              OverHead gives the owner and team one practical desktop workspace
              for the customer record, active work, follow-up, approvals,
              payment context, and support history.
            </p>
          </div>
          <div className="home-intro-signal">
            <span>Built for the day-to-day</span>
            <strong>
              Start with the work that has to move today—not a complicated
              system you have to learn around.
            </strong>
            <p>{businessFoundation.promise}</p>
          </div>
        </section>

        <section className="section office-fit-section">
          <p className="eyebrow">Built for the office in front of you</p>
          <h2>
            Useful when accountability matters more than another dashboard.
          </h2>
          <CardGrid
            items={officeFits.map(([title, body]) => ({ title, body }))}
            className="three"
          />
          <p className="office-fit-note">
            OverHead is not positioned as a replacement for your accountant,
            payment provider, legal adviser, or industry compliance program. It
            is the operating layer that helps the office remember what needs to
            happen next.
          </p>
        </section>

        <section className="section home-product-proof">
          <div>
            <p className="eyebrow">See the product</p>
            <h2>A real desktop workspace for the work already on your desk.</h2>
            <p className="section-copy">
              The command console brings customer records, current work, office
              readiness, and key controls into one place. The screenshots below
              are from the installed product.
            </p>
            <div className="home-proof-actions">
              <Link className="primary" href={downloadHref}>
                Get the Windows download
              </Link>
              <Link className="text-link" href="/support/">
                See installation help
              </Link>
            </div>
          </div>
          <figure>
            <img
              src="/assets/overhead-console-proof.png"
              alt="OverHead desktop command console showing workspace overview, customer database, current work queue, and office readiness"
            />
            <figcaption>OverHead Desktop command console</figcaption>
          </figure>
        </section>

        <section className="section">
          <p className="eyebrow">What it helps you do</p>
          <h2>
            Keep the office work connected without making it feel complicated.
          </h2>
          <CardGrid items={outcomes} />
        </section>

        <section id="get-started" className="section start-section">
          <p className="eyebrow">Start here</p>
          <h2>Four steps to a working office setup.</h2>
          <div className="start-grid">
            {startSteps.map(([number, title, body]) => (
              <article key={number}>
                <span>{number}</span>
                <strong>{title}</strong>
                <p>{body}</p>
              </article>
            ))}
          </div>
          <div className="download-help">
            <div>
              <strong>Before you download</strong>
              <p>
                OverHead currently runs on Windows. The ZIP is the official
                manual download; use the checksum if you want to verify it.
              </p>
            </div>
            <div>
              <Link className="primary" href={downloadHref}>
                Download for Windows
              </Link>
              <Link className="text-link" href={checksumHref}>
                Get the checksum
              </Link>
            </div>
          </div>
        </section>

        <section className="section">
          <p className="eyebrow">Plans and deployments</p>
          <h2>Choose the setup that fits the office and its host.</h2>
          <p className="section-copy">
            Start with a 30-day free Gold trial for the standard desktop
            application. No card is required for the trial; commercial
            activation is available when secure production billing and account
            services are enabled.
          </p>
          <div className="plan-grid">
            {plans.map((plan) => (
              <article
                className={
                  plan.name === "Gold" ? "plan-card featured" : "plan-card"
                }
                key={plan.name}
              >
                <span>{plan.label}</span>
                <h3>{plan.name}</h3>
                <strong className="price">{plan.price}</strong>
                <p>{plan.text}</p>
                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <article className="cylinder-plan-card">
            <div>
              <span>{cylinderDeployment.label}</span>
              <h3>{cylinderDeployment.name}</h3>
              <strong className="cylinder-price">
                {cylinderDeployment.price}
              </strong>
              <p>{cylinderDeployment.text}</p>
            </div>
            <ul>
              {cylinderDeployment.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <div>
              <strong>{cylinderDeployment.annualPrice} annually</strong>
              <span>Separate server deployment</span>
              <Link className="primary" href={cylinderPageHref}>
                Explore Cylinder
              </Link>
            </div>
          </article>
        </section>

        <section className="section boundaries-section">
          <p className="eyebrow">Plain terms</p>
          <h2>What OverHead does—and what it does not do.</h2>
          <div className="card-grid two">
            <article>
              <span>OverHead helps you</span>
              <strong>Keep office work in order.</strong>
              <p>
                Organize customers, tasks, approvals, payment follow-up, and
                support records.
              </p>
            </article>
            <article>
              <span>OverHead does not replace</span>
              <strong>Your judgment or your advisers.</strong>
              <p>
                You remain responsible for your staff, business records,
                security, provider accounts, and professional obligations.
              </p>
            </article>
          </div>
        </section>
        <CTA />
      </main>
    </SiteShell>
  );
}
