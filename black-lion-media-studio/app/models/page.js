import Link from "next/link";
import { ModelApplicationComponentLibrary } from "../../components/model-application-component-library";
import { ModelApplicationForm } from "../../components/model-application-form";
import {
  DetailPairGrid,
  ProcessSteps,
  ShortcutRail,
  SupportNotice
} from "../../components/shared-ui";
import {
  modelApplicationComponentInventory,
  modelApplicationComponentSections
} from "../../lib/model-application-components";

export const metadata = {
  title: "Model Sign-up",
  description: "Apply to be considered for Black Lion Studios modeling projects, brand shoots, editorial work, video productions, and casting opportunities.",
  alternates: { canonical: "/models" }
};

const componentLibraryGroups = modelApplicationComponentSections.map((section) => ({
  id: section.id,
  title: section.title,
  copy: section.summary,
  summaryItems: [
    { label: "Units", value: section.units.length },
    { label: "Focus", value: section.title }
  ],
  items: section.units.map((unit) => ({
    id: unit.id,
    title: unit.label,
    copy: unit.intent,
    status: unit.kind,
    tone: unit.kind === "consent" ? "warning" : unit.kind === "field" ? "success" : "neutral",
    tags: [unit.category, unit.kind],
    meta: [
      { label: "Order", value: unit.order },
      { label: "Section", value: section.title }
    ]
  }))
}));

const modelFaqItems = [
  {
    question: "Is Model Sign-up separate from a client profile?",
    answer: "Yes. Model profiles are categorized separately from client profiles and are used for casting review, production fit, contact, and project-term discussions."
  },
  {
    question: "Do I have to be 18 or older?",
    answer: "Yes. The form requires 18+ confirmation and a date of birth that verifies the applicant is at least 18 years old."
  },
  {
    question: "Does signing up guarantee paid work?",
    answer: "No. Signing up does not create employment, agency representation, a booking, exclusivity, a contract, or guaranteed paid work."
  },
  {
    question: "Is this full-time W-2 employment or 1099 project work?",
    answer: "Model opportunities are presented as project-based 1099 independent-contractor opportunities, not full-time W-2 employment. No payroll withholding, employee benefits, guaranteed hours, or employee status are promised unless a separate written agreement says otherwise. Final classification still depends on actual project terms and applicable law."
  },
  {
    question: "Why do you ask about speed, quality, and reliability?",
    answer: "BLS may need models for fast production windows. The screening questions help managers understand call-time readiness, preparation habits, communication, and whether a model can handle quick direction changes."
  },
  {
    question: "Can I include my Instagram handle?",
    answer: "Yes. The form and model profile include Instagram plus other portfolio or social links so managers can review public work and presentation fit."
  },
  {
    question: "Can I choose what I prefer to model for?",
    answer: "Yes. The Modeling interests section lets you mark preferences such as Fashion, Portrait, Lifestyle, Commercial, Product/Merch, Editorial, Fitness, Music Video, Event Promo, Beauty/Grooming, Streetwear, and Brand Campaign."
  },
  {
    question: "How often can I apply?",
    answer: "Model applicants can submit once every 3 months. The system stores the application date and next eligible application window."
  },
  {
    question: "What happens if I miss a confirmed call time or booking?",
    answer: "A missed confirmed call, booking, or production check-in may lower future priority. Managers can use no-show and queue status when reviewing models."
  },
  {
    question: "Who can see my model profile?",
    answer: "The model profile is intended for Black Lion Studios manager review and operational follow-up. Public pages should not expose your legal name, contact details, date of birth, screening notes, compensation expectations, or no-show history."
  },
  {
    question: "What terms are confirmed before a project?",
    answer: "Compensation, schedule, release terms, usage rights, wardrobe or styling expectations, cancellation/no-show terms, and deliverables should be confirmed separately before a project is booked."
  },
  {
    question: "Can I update my PII or model details later?",
    answer: "Yes. After submission, the account routes to the profile area where model-specific PII, contact, portfolio, availability, compensation, usage, and production-readiness details can be updated."
  },
  {
    question: "Should I upload copyrighted work?",
    answer: "Use links and submit only materials you are authorized to share. Portfolio links and references do not transfer ownership or allow republication outside separate project terms."
  },
  {
    question: "Do sponsored posts or endorsements need disclosures?",
    answer: "If content involves payment, employment, gifted products, discounts, or another material connection, required disclosures should be clear and hard to miss where the content is published."
  }
];

export default function ModelsPage() {
  return (
    <div className="page-shell">
      <main className="stack">
        <section className="panel legal-hero models-hero">
          <p className="label">Model Sign-up</p>
          <h1>Apply for Black Lion Studios modeling opportunities.</h1>
          <p>
            Submit your contact details, portfolio, availability, and project interests to be
            considered for contracted shoots, campaigns, videos, editorial work, and casting pools.
          </p>
          <div className="legal-action-row">
            <a href="#model-application" className="button">Start application</a>
            <Link href="/portfolio" className="button button-secondary">View studio work</Link>
          </div>
        </section>

        <section className="two-column quote-layout">
          <div className="panel" id="model-application">
            <p className="label">Application</p>
            <h2 className="editorial-heading">Send your model profile.</h2>
            <ModelApplicationForm />
          </div>

          <div className="stack-small">
            <SupportNotice
              title="Application review"
              copy="Submission creates or updates a model profile account. It does not create a booking, employment relationship, or guaranteed contract. Model opportunities are intended as project-based 1099 independent-contractor opportunities, not full-time W-2 employment. Project scope, compensation, usage rights, schedule, tax paperwork, and release terms are confirmed separately."
            />
            <SupportNotice
              title="1099 contractor disclosure"
              copy="BLS model projects are not presented as full-time W-2 jobs. Models should expect project-specific terms, possible Form W-9/1099-NEC handling where applicable, and responsibility for their own tax obligations unless a separate written agreement changes the relationship."
            />
            <SupportNotice
              title="Higher screening standard"
              copy="BLS reviews speed, reliability, preparation, usage comfort, and production quality before contacting applicants for time-sensitive work. Applicants can reapply once every 3 months."
            />
            <SupportNotice
              title="No-show priority"
              copy="If an applicant misses a confirmed call time, booking, or production check-in, BLS may place that applicant behind other available models for future opportunities."
            />
            <section className="panel">
              <p className="label">Useful context</p>
              <DetailPairGrid
                items={[
                  { label: "Profile", value: "Username and PII" },
                  { label: "Age", value: "18+ confirmation" },
                  { label: "Tax", value: "1099 project work" },
                  { label: "Terms", value: "Contract before booking" },
                  { label: "Screening", value: "Speed and quality" }
                ]}
              />
            </section>
            <section className="panel">
              <p className="label">Review flow</p>
              <ProcessSteps
                items={[
                  "Submit the model application with portfolio and availability.",
                  "The studio reviews fit, logistics, comfort boundaries, usage needs, and budget.",
                  "If there is a match, compensation, release terms, schedule, and project details are confirmed before anything is booked."
                ]}
                className="ui-process-compact"
              />
            </section>
            <section className="panel">
              <p className="label">Related paths</p>
              <ShortcutRail
                items={[
                  { href: "/photography", label: "Photo", value: "Production work", note: "Portraits, events, and campaigns" },
                  { href: "/videography", label: "Video", value: "Shoot support", note: "Music videos, promos, and content" },
                  { href: "/contact", label: "Contact", value: "Ask first", note: "Use for routing questions" }
                ]}
                className="ui-shortcut-tight"
              />
            </section>
          </div>
        </section>
        <ModelApplicationComponentLibrary
          eyebrow="Application architecture"
          title="100+ model application components installed."
          copy="These page units support the streamlined model signup, PII profile path, production-speed screening, quality review, 18+ rules, 90-day reapplication limit, no-show priority handling, and follow-up workflow."
          groups={componentLibraryGroups}
          stats={[
            { label: "Groups", value: modelApplicationComponentInventory.sectionCount },
            { label: "Components", value: modelApplicationComponentInventory.unitCount },
            { label: "Route", value: modelApplicationComponentInventory.route }
          ]}
        />
        <section className="panel">
          <p className="label">Model FAQ</p>
          <h2 className="editorial-heading">Questions before signing up.</h2>
          <div className="model-faq-grid">
            {modelFaqItems.map((item) => (
              <details className="model-faq-item" key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
