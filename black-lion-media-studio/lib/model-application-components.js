const buildUnits = (category, units) =>
  units.map((unit, index) => ({
    ...unit,
    category,
    order: index + 1
  }));

export const modelApplicationComponentSections = [
  {
    id: "basic-info",
    title: "Basic information",
    summary: "Identity, contact, account, and location units needed before a model profile can be reviewed.",
    units: buildUnits("basic-info", [
      { id: "basic-legal-name", label: "Legal name field", kind: "field", intent: "Collect contracting identity." },
      { id: "basic-display-name", label: "Public or stage name field", kind: "field", intent: "Collect review-facing identity." },
      { id: "basic-username", label: "Username field", kind: "field", intent: "Create or update the model account handle." },
      { id: "basic-email", label: "Email field", kind: "field", intent: "Collect sign-in and follow-up contact." },
      { id: "basic-password", label: "Password field", kind: "field", intent: "Prepare account access after submission." },
      { id: "basic-phone", label: "Phone field", kind: "field", intent: "Support urgent booking or call-time contact." },
      { id: "basic-city", label: "City or service area field", kind: "field", intent: "Match applicants to local or travel-ready work." },
      { id: "basic-date-of-birth", label: "Date of birth field", kind: "field", intent: "Support age screening and account records." },
      { id: "basic-pronouns", label: "Pronouns field", kind: "field", intent: "Collect optional respectful communication context." },
      { id: "basic-profile-purpose", label: "Profile purpose hint", kind: "copy", intent: "Explain legal versus public profile details." }
    ])
  },
  {
    id: "pii-profile-updates",
    title: "PII and profile update prompts",
    summary: "Profile detail units that help with wardrobe, styling, continuity, privacy, and post-submit profile maintenance.",
    units: buildUnits("pii-profile-updates", [
      { id: "pii-profile-update-notice", label: "Profile update notice", kind: "notice", intent: "Tell applicants submission creates or updates a profile." },
      { id: "pii-sensitive-data-warning", label: "Sensitive data warning", kind: "notice", intent: "Discourage unnecessary sensitive information." },
      { id: "pii-height", label: "Height field", kind: "field", intent: "Support casting, wardrobe, and continuity matching." },
      { id: "pii-clothing-sizes", label: "Clothing sizes field", kind: "field", intent: "Support wardrobe planning and merch/product shoots." },
      { id: "pii-hair-color", label: "Hair color field", kind: "field", intent: "Support visual continuity review." },
      { id: "pii-eye-color", label: "Eye color field", kind: "field", intent: "Support visual casting notes." },
      { id: "pii-visible-marks", label: "Tattoos, piercings, or visible marks field", kind: "field", intent: "Capture styling and continuity considerations." },
      { id: "pii-age-confirmation", label: "18+ confirmation checkbox", kind: "consent", intent: "Require applicant age confirmation." },
      { id: "pii-correction-followup", label: "Profile correction follow-up", kind: "prompt", intent: "Remind applicants they can update profile details later." },
      { id: "pii-contact-preference", label: "Contact preference cue", kind: "prompt", intent: "Connect phone and email details to follow-up use." }
    ])
  },
  {
    id: "casting-criteria",
    title: "Casting criteria",
    summary: "Casting units for project interests, applicant fit, skills, boundaries, and creative-use alignment.",
    units: buildUnits("casting-criteria", [
      { id: "casting-project-interests", label: "Project interests fieldset", kind: "field-group", intent: "Let applicants select eligible work types." },
      { id: "casting-modeling-interests", label: "Modeling interests fieldset", kind: "field-group", intent: "Let applicants choose preferred modeling lanes such as fashion, portrait, lifestyle, commercial, and editorial." },
      { id: "casting-photography-option", label: "Photography option", kind: "choice", intent: "Flag still-photo availability." },
      { id: "casting-videography-option", label: "Videography option", kind: "choice", intent: "Flag video production availability." },
      { id: "casting-music-video-option", label: "Music video option", kind: "choice", intent: "Flag music-video casting interest." },
      { id: "casting-brand-campaign-option", label: "Brand campaign option", kind: "choice", intent: "Flag commercial campaign interest." },
      { id: "casting-editorial-option", label: "Editorial option", kind: "choice", intent: "Flag editorial or stylized work interest." },
      { id: "casting-product-merch-option", label: "Product or merch option", kind: "choice", intent: "Flag product, apparel, and merch work interest." },
      { id: "casting-event-promo-option", label: "Event promo option", kind: "choice", intent: "Flag promotional or live-event content interest." },
      { id: "casting-pool-option", label: "Casting pool option", kind: "choice", intent: "Allow general future-opportunity consideration." },
      { id: "casting-experience-fit", label: "Experience and fit field", kind: "field", intent: "Collect modeling, brand, performance, and on-camera context." }
    ])
  },
  {
    id: "production-speed",
    title: "Production speed",
    summary: "Units that screen whether an applicant can handle fast calls, quick resets, and time-sensitive direction.",
    units: buildUnits("production-speed", [
      { id: "speed-production-pace-field", label: "Fast-production readiness field", kind: "field", intent: "Ask how applicants handle tight production windows." },
      { id: "speed-short-call-time", label: "Short call-time prompt", kind: "prompt", intent: "Surface comfort with limited notice." },
      { id: "speed-direction-change", label: "Direction-change prompt", kind: "prompt", intent: "Screen adaptability during shoots." },
      { id: "speed-reset-readiness", label: "Quick reset prompt", kind: "prompt", intent: "Screen ability to move between looks or takes." },
      { id: "speed-communication-pace", label: "Fast communication prompt", kind: "prompt", intent: "Set expectations for replies before production." },
      { id: "speed-call-sheet-review", label: "Call sheet review prompt", kind: "prompt", intent: "Check preparation for schedule details." },
      { id: "speed-time-window-note", label: "Time-window note", kind: "copy", intent: "Explain that timing can decide casting priority." },
      { id: "speed-reschedule-limits", label: "Reschedule limits prompt", kind: "prompt", intent: "Identify applicants who need more scheduling buffer." },
      { id: "speed-travel-timing", label: "Travel timing prompt", kind: "prompt", intent: "Connect travel readiness to production pace." },
      { id: "speed-priority-signal", label: "Production priority signal", kind: "status", intent: "Support later sorting by pace readiness." }
    ])
  },
  {
    id: "quality-scrutiny",
    title: "Quality scrutiny",
    summary: "Units for preparation, professionalism, reliability examples, and final usage expectations.",
    units: buildUnits("quality-scrutiny", [
      { id: "quality-standards-field", label: "Quality standards field", kind: "field", intent: "Ask what professional quality means to the applicant." },
      { id: "quality-reliability-examples", label: "Reliability examples field", kind: "field", intent: "Collect proof of punctuality and follow-through." },
      { id: "quality-preparation-process", label: "Preparation process field", kind: "field", intent: "Collect shoot-prep habits before review." },
      { id: "quality-wardrobe-readiness", label: "Wardrobe readiness prompt", kind: "prompt", intent: "Screen styling preparation." },
      { id: "quality-grooming-readiness", label: "Grooming readiness prompt", kind: "prompt", intent: "Screen appearance preparation." },
      { id: "quality-reference-review", label: "Reference review prompt", kind: "prompt", intent: "Check whether applicants review creative direction." },
      { id: "quality-on-set-conduct", label: "On-set conduct prompt", kind: "prompt", intent: "Set professionalism expectations." },
      { id: "quality-usage-awareness", label: "Usage awareness prompt", kind: "prompt", intent: "Confirm awareness of where work may appear." },
      { id: "quality-scrutiny-notice", label: "Higher screening standard notice", kind: "notice", intent: "Explain speed, preparation, and quality review." },
      { id: "quality-manager-review-tag", label: "Manager review tag", kind: "status", intent: "Support later manager triage." }
    ])
  },
  {
    id: "reapply-no-show-policy",
    title: "Reapply and no-show policy",
    summary: "Policy units that communicate the 90-day reapplication window and missed-confirmation priority impact.",
    units: buildUnits("reapply-no-show-policy", [
      { id: "policy-reapplication-checkbox", label: "Reapplication policy checkbox", kind: "consent", intent: "Confirm applications are limited to once every 3 months." },
      { id: "policy-no-show-checkbox", label: "No-show policy checkbox", kind: "consent", intent: "Confirm missed calls or check-ins may lower priority." },
      { id: "policy-reapplication-window-note", label: "90-day window note", kind: "copy", intent: "State the reapplication interval in applicant-facing language." },
      { id: "policy-next-eligible-date", label: "Next eligible date status", kind: "status", intent: "Support showing the next application date." },
      { id: "policy-attendance-status", label: "Attendance status unit", kind: "status", intent: "Track pending, attended, or missed confirmation outcomes." },
      { id: "policy-no-show-count", label: "No-show count unit", kind: "status", intent: "Support future priority decisions." },
      { id: "policy-queue-status", label: "Queue status unit", kind: "status", intent: "Show standard or lower-priority queue placement." },
      { id: "policy-confirmed-call-time", label: "Confirmed call-time policy copy", kind: "copy", intent: "Clarify what missed contact means." },
      { id: "policy-booking-checkin", label: "Booking check-in policy copy", kind: "copy", intent: "Clarify missed production check-ins." },
      { id: "policy-review-fairness-note", label: "Review fairness note", kind: "copy", intent: "Explain why repeat or no-show applicants may be deprioritized." }
    ])
  },
  {
    id: "contract-payment-readiness",
    title: "Contract and payment readiness",
    summary: "Units that prepare applicants for compensation, release, usage rights, and payment-term conversations.",
    units: buildUnits("contract-payment-readiness", [
      { id: "contract-readiness-checkbox", label: "Contract readiness checkbox", kind: "consent", intent: "Confirm applicant can review and sign paperwork." },
      { id: "contract-compensation-field", label: "Compensation expectation field", kind: "field", intent: "Collect hourly, day-rate, trade, or case-by-case expectations." },
      { id: "contract-usage-comfort-field", label: "Usage comfort field", kind: "field", intent: "Collect commercial, social, editorial, and ad-use limits." },
      { id: "contract-release-terms-note", label: "Release terms note", kind: "copy", intent: "Explain usage rights are confirmed separately." },
      { id: "contract-payment-terms-note", label: "Payment terms note", kind: "copy", intent: "Explain compensation is confirmed before booking." },
      { id: "contract-no-employment-note", label: "No employment guarantee note", kind: "copy", intent: "Clarify submission is not employment or a guaranteed contract." },
      { id: "contract-scope-confirmation", label: "Scope confirmation unit", kind: "copy", intent: "Tie booking to accepted scope and terms." },
      { id: "contract-invoice-readiness", label: "Invoice readiness prompt", kind: "prompt", intent: "Prepare applicants for payment information follow-up." },
      { id: "contract-tax-records-prompt", label: "Tax records prompt", kind: "prompt", intent: "Flag that paid work may require correct records." },
      { id: "contract-manager-approval-status", label: "Manager approval status", kind: "status", intent: "Support later review before any booking." }
    ])
  },
  {
    id: "availability",
    title: "Availability",
    summary: "Scheduling and travel units for casting against real call times, blackout dates, and location constraints.",
    units: buildUnits("availability", [
      { id: "availability-field", label: "Availability field", kind: "field", intent: "Collect typical days, times, blackout dates, and notice needs." },
      { id: "availability-travel-readiness", label: "Travel readiness field", kind: "field", intent: "Collect local-only, travel range, and transportation limits." },
      { id: "availability-blackout-dates", label: "Blackout dates prompt", kind: "prompt", intent: "Find schedule conflicts before outreach." },
      { id: "availability-preferred-notice", label: "Preferred notice prompt", kind: "prompt", intent: "Match applicant lead time to production needs." },
      { id: "availability-local-radius", label: "Local radius prompt", kind: "prompt", intent: "Clarify reachable service area." },
      { id: "availability-transportation-needs", label: "Transportation needs prompt", kind: "prompt", intent: "Identify logistics that affect booking." },
      { id: "availability-lodging-needs", label: "Lodging needs prompt", kind: "prompt", intent: "Identify travel support requirements." },
      { id: "availability-weekend-readiness", label: "Weekend readiness prompt", kind: "prompt", intent: "Surface common production-window fit." },
      { id: "availability-evening-readiness", label: "Evening readiness prompt", kind: "prompt", intent: "Surface low-light or after-work booking fit." },
      { id: "availability-schedule-handoff", label: "Schedule handoff note", kind: "copy", intent: "Explain final scheduling happens through studio follow-up." }
    ])
  },
  {
    id: "portfolio",
    title: "Portfolio",
    summary: "Review units for portfolio, social links, skills, experience, and applicant presentation.",
    units: buildUnits("portfolio", [
      { id: "portfolio-link-field", label: "Portfolio link field", kind: "field", intent: "Collect a reviewable portfolio URL." },
      { id: "portfolio-instagram-field", label: "Instagram field", kind: "field", intent: "Collect optional social portfolio context." },
      { id: "portfolio-other-socials-field", label: "Other social links field", kind: "field", intent: "Collect TikTok, YouTube, website, or agency links." },
      { id: "portfolio-no-attachments-note", label: "No attachments note", kind: "copy", intent: "Encourage links instead of uploads." },
      { id: "portfolio-relevant-skills-field", label: "Relevant skills field", kind: "field", intent: "Capture dance, acting, athletic, demo, or special skills." },
      { id: "portfolio-performance-experience", label: "Performance experience prompt", kind: "prompt", intent: "Surface on-camera or live-performance context." },
      { id: "portfolio-brand-experience", label: "Brand experience prompt", kind: "prompt", intent: "Surface prior commercial or creator work." },
      { id: "portfolio-content-experience", label: "Content experience prompt", kind: "prompt", intent: "Surface creator and social-first work." },
      { id: "portfolio-review-link-health", label: "Review link health status", kind: "status", intent: "Support later broken-link or private-link handling." },
      { id: "portfolio-studio-work-link", label: "Studio work link", kind: "link", intent: "Route applicants to current portfolio context." }
    ])
  },
  {
    id: "follow-up",
    title: "Follow-up",
    summary: "Post-submit units for contact consent, redirects, review flow, manager notes, and applicant status.",
    units: buildUnits("follow-up", [
      { id: "followup-contact-consent", label: "Contact consent checkbox", kind: "consent", intent: "Require permission to contact about opportunities." },
      { id: "followup-additional-notes", label: "Additional notes field", kind: "field", intent: "Collect limits, preferences, questions, or routing context." },
      { id: "followup-submit-button", label: "Submit application button", kind: "action", intent: "Send application data to review." },
      { id: "followup-submitting-state", label: "Submitting state", kind: "state", intent: "Communicate in-flight submission." },
      { id: "followup-success-message", label: "Success message", kind: "message", intent: "Confirm receipt and account readiness." },
      { id: "followup-error-message", label: "Error message", kind: "message", intent: "Surface validation or save failures." },
      { id: "followup-profile-redirect", label: "Profile redirect", kind: "navigation", intent: "Send applicants to update their profile after submission." },
      { id: "followup-review-flow-steps", label: "Review flow steps", kind: "process", intent: "Explain application review, matching, and term confirmation." },
      { id: "followup-manager-notes", label: "Manager notes unit", kind: "admin-data", intent: "Support internal review notes later." },
      { id: "followup-status-tracking", label: "Application status tracking", kind: "status", intent: "Support New, reviewed, contacted, or declined states." }
    ])
  }
];

export const modelApplicationComponentUnits = modelApplicationComponentSections.flatMap((section) =>
  section.units.map((unit) => ({
    ...unit,
    sectionId: section.id,
    sectionTitle: section.title
  }))
);

export const modelApplicationComponentCategories = Object.freeze(
  modelApplicationComponentSections.reduce((categories, section) => {
    categories[section.id] = {
      title: section.title,
      count: section.units.length
    };
    return categories;
  }, {})
);

export const modelApplicationComponentInventory = Object.freeze({
  route: "/models",
  page: "Model Sign-up",
  purpose: "Data-driven inventory for Model Sign-up page units.",
  sectionCount: modelApplicationComponentSections.length,
  unitCount: modelApplicationComponentUnits.length,
  categories: modelApplicationComponentCategories
});
