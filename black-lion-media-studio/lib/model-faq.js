export const modelFaqItems = [
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

export const modelFaqPreviewItems = modelFaqItems.filter((item) =>
  [
    "Is Model Sign-up separate from a client profile?",
    "Do I have to be 18 or older?",
    "Is this full-time W-2 employment or 1099 project work?"
  ].includes(item.question)
);
