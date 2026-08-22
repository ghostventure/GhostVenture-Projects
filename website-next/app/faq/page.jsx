import Link from "next/link";
import { CTA, PageHero, ProductProof, SiteShell } from "../components";
import { businessFoundation, businessPrinciples } from "../business-foundation";

const faqs = [
  [
    "Is OverHead a website or desktop app?",
    "OverHead is an installed Windows desktop app. This website explains the product and hosts the Windows ZIP, installer checksum, support information, and legal boilerplates.",
  ],
  [
    "Which computers can run OverHead?",
    "The current release is for Windows. A Mac, mobile, or browser-only edition is not offered as a substitute for the installed Windows workspace.",
  ],
  [
    "What is OverHead Cylinder?",
    "Cylinder is the separate OverHead deployment tier for a supported Windows Server or Windows IoT host. It has its own application identity, local data directory, installer, and update channel.",
  ],
  [
    "Can I install Cylinder on Windows 10 or Windows 11?",
    "No. Cylinder is not compatible with standard Windows 10 or Windows 11 editions. Its launcher checks the Windows host edition and exits on an unsupported desktop edition. Use the standard OverHead desktop application instead.",
  ],
  [
    "What does the Cylinder tier support?",
    "The current Cylinder entitlement profile supports up to 50 users and 100,000 customer records. It includes the server deployment controls alongside the core customer, task, backup, workflow, approval, export, restore-validation, and support capabilities.",
  ],
  [
    "How much is Cylinder?",
    "Cylinder is listed at $499 per month flat, or $4,990 per year. The price covers the separate OverHead server deployment tier for up to 50 users and 100,000 customer records; Windows Server licensing, host hardware, backups, provider accounts, and custom deployment work are separate. Continued use requires a separate deployment order or contract and billing confirmation; the standard desktop checkout does not sell Cylinder.",
  ],
  [
    "Does Cylinder have a trial?",
    "Yes. Each server workspace receives one 30-day, no-card Cylinder evaluation. It does not create a payment or automatically renew. After the evaluation ends, continued Cylinder access requires a completed commercial activation and issued entitlement.",
  ],
  [
    "Does Cylinder automatically copy server data to the cloud?",
    "No. Cylinder customer documents are copied into the local Cylinder data directory and indexed in its local record store. They are not automatically stored in Firebase Storage or replicated to another host.",
  ],
  [
    "What kind of business is it for?",
    "It is for small businesses that need a cleaner office workflow around customers, notes, quotes, invoices, payment follow-ups, staff approvals, and support records.",
  ],
  [
    "What problem does it solve first?",
    "OverHead starts with the work that often gets scattered after a customer call: the next task, customer context, approval, payment follow-up, and record of what happened.",
  ],
  [
    "What principles guide OverHead?",
    `${businessFoundation.mission} In practice, that means ${businessPrinciples[0].title.toLowerCase()}, ${businessPrinciples[1].title.toLowerCase()}, and ${businessPrinciples[5].title.toLowerCase()}.`,
  ],
  [
    "Do I need to move everything into OverHead on day one?",
    "No. Start with one active customer, one queue, or one repeated office process. The goal is useful adoption, not a disruptive all-at-once migration.",
  ],
  [
    "Can I add staff members?",
    "The product includes owner-and-staff profile and role surfaces. Shared-account use depends on the configured workspace and verified access; an owner should control permissions before inviting staff.",
  ],
  [
    "Which email addresses can OverHead Team members use?",
    "Internal OverHead Team members use an authorized @overheadteam.com or @overheadteam.biz address, issued by an authorized supervisor, manager, or administrator. Customer businesses may continue to use their own company email domain for their workspace staff.",
  ],
  [
    "How do licenses work?",
    "Each active workspace member receives one internal license record tied to that workspace and their authenticated account. The workspace plan determines the tier and status; the user role determines permitted actions. Users do not need to copy or manage license numbers, and a pending or suspended license is not active access.",
  ],
  [
    "Is my data only stored on my computer?",
    "The desktop workflow is local-first. Where shared accounts are configured, selected profile and workspace information may be synchronized through the account layer. Treat both the device and account access as part of your security responsibility.",
  ],
  [
    "Do browser customer records automatically appear in the desktop app?",
    "Not yet. Customer records created in the browser workspace are shared through the workspace account layer. Desktop customer records remain local until a dedicated synchronization feature is enabled. Do not assume the two lists are merged automatically.",
  ],
  [
    "Does it replace Stripe or Square?",
    "No. Stripe and Square verification happen in the provider browser. OverHead can help store connection context and import useful summaries, but the payment provider remains the payment provider.",
  ],
  [
    "Can I pay for a plan in the app today?",
    "The product has billing, trial, receipt, cancellation, and refund workflow design, but public production billing depends on configured provider credentials and deployed billing services. Do not assume a payment is live unless you receive provider confirmation and a receipt.",
  ],
  [
    "Is there a free trial?",
    "Yes—OverHead is designed to offer one no-card, 30-day Gold-equivalent trial per workspace. Trial activation becomes publicly available when the secure production billing and account service are enabled; no payment is created for the trial.",
  ],
  [
    "What happens if I cancel?",
    "The intended live billing flow shows the cancellation outcome before confirmation and calculates any eligible unused-time refund. Actual refunds only occur after production billing is enabled and confirmed by the payment provider.",
  ],
  [
    "Will OverHead update itself?",
    "Packaged OverHead and Cylinder releases check their separate secure update feeds before opening. When an update is available, the package downloads and installs when the app closes. New installations still begin with the manual Windows ZIP download. Do not mix the standard desktop and Cylinder installers or update channels.",
  ],
  [
    "Does OverHead protect data automatically?",
    "OverHead includes sign-in, privacy masking, local audit concepts, checksum references, support bundles, and recovery tooling. Customers still need good device security, backups, staff policies, and responsible data handling.",
  ],
  [
    "Should I use it for highly regulated records?",
    "Review your own legal, privacy, retention, security, and industry obligations before placing regulated or sensitive records in any workflow. OverHead does not replace a business's compliance program.",
  ],
  [
    "What happens if password recovery fails?",
    "The product direction is three recovery attempts, then a developer support escalation path with support bundle review where available.",
  ],
  [
    "How do I get help with a problem?",
    "Capture the product version, the step that failed, and a screenshot or support bundle when available. The support page lists the contact path and the most useful information to include.",
  ],
  [
    "How do I know the download is legitimate?",
    "Use the official OverHead download link and compare the downloaded ZIP against its published SHA-256 checksum when source confidence matters. For Cylinder, extract the ZIP first, then compare the installer against the separate Cylinder checksum.",
  ],
  [
    "What does the investor page prove?",
    "It shows the product thesis, installed product evidence, execution milestones, and the metrics planned for pilot validation. It does not claim customer traction, revenue, valuation, or a securities offering without supporting documentation.",
  ],
  [
    "Are the legal documents final legal advice?",
    "No. The legal language is organized policy draft material for review. A qualified attorney should adapt it for the business, jurisdiction, sale terms, and actual operating practices.",
  ],
  [
    "Where are downloads?",
    "The standard Windows ZIP and checksum are available from the Download buttons. Cylinder has its own Server/IoT download and separate checksum on the Cylinder page.",
  ],
];

const installSteps = [
  [
    "1. Download",
    "Get the Windows ZIP from the official OverHead download link.",
  ],
  [
    "2. Verify",
    "Compare the package with the published SHA-256 checksum before installation when source confidence matters.",
  ],
  ["3. Install", "Extract the ZIP locally and run the Windows installer."],
  [
    "4. Start a workspace",
    "Create an owner profile, choose a plan, and begin with the workflow or customer record that matters first.",
  ],
];

const expectations = [
  [
    "What you get now",
    "A Windows desktop workspace, customer and task tools, workflow and approval surfaces, support utilities, a manual ZIP installer, and published download verification.",
  ],
  [
    "What needs setup",
    "Your owner profile, workspace rules, staff access, device security, backups, and any provider or shared-account connection your business chooses to use.",
  ],
  [
    "What is not being promised yet",
    "A browser-only app, mobile app, live self-service public billing for every tier, or a substitute for professional legal, security, accounting, or compliance advice.",
  ],
];

export default function FAQPage() {
  return (
    <SiteShell tone="light">
      <main>
        <PageHero
          eyebrow="FAQ"
          title="Know what you are getting before you install."
        >
          <p>
            Clear answers about what is included now, what needs setup, and what
            is not yet offered—so you can decide with your eyes open.
          </p>
        </PageHero>

        <section
          className="page-body investor-metric-grid"
          aria-label="What to expect from OverHead"
        >
          {expectations.map(([label, body]) => (
            <article key={label}>
              <span>{label}</span>
              <strong>{label}</strong>
              <p>{body}</p>
            </article>
          ))}
        </section>

        <section className="page-body legal-stack">
          {faqs.map(([question, answer]) => (
            <article className="legal-block" key={question}>
              <strong>{question}</strong>
              <p>{answer}</p>
            </article>
          ))}
        </section>

        <section className="section cylinder-faq-callout">
          <div>
            <p className="eyebrow">Windows Server or Windows IoT?</p>
            <h2>
              Cylinder is the separate deployment for a dedicated in-house host.
            </h2>
            <p>
              It is not the regular Windows desktop app. Review the host
              requirement, separate download, update channel, local-data
              boundary, and entitlement profile before installing.
            </p>
          </div>
          <Link className="primary" href="/cylinder/">
            Review OverHead Cylinder
          </Link>
        </section>

        <ProductProof
          eyebrow="Before first use"
          title="Start with a real installed workspace, not a browser tab full of loose context."
          body="The desktop sign-in screen is where an owner creates or enters the local workspace. It establishes the starting point for customer records, office queues, privacy settings, recovery flows, and product tools."
          image="/assets/overhead-signin-proof.png"
          alt="OverHead Desktop Windows sign-in and local account setup screen"
          caption="Actual OverHead Desktop sign-in smoke-test capture"
        />

        <section className="section">
          <p className="eyebrow">Download path</p>
          <h2>A clear start-to-install sequence.</h2>
          <div className="step-grid">
            {installSteps.map(([step, body]) => (
              <article key={step}>
                <strong>{step}</strong>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <CTA />
      </main>
    </SiteShell>
  );
}
