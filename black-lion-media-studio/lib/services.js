export const serviceCatalog = [
  {
    slug: "ai-services",
    name: "AI Services & Software Development",
    priceLabel: "Custom quote after consultation",
    invoiceAmountCents: 0,
    description: "Know about AI but unsure where to start? Get practical help turning your idea into an app, website, or useful automation.",
    deliverable: "An agreed project plan, development support, testing, and a walkthrough",
    coverage: "AI getting-started guidance, custom software, workflow automation, and help finishing or improving AI-assisted projects.",
    turnaround: "Schedule agreed after project review"
  },
  {
    slug: "photography",
    name: "Photography",
    priceLabel: "Starting at $350",
    invoiceAmountCents: 35000,
    description: "Portraits, product sessions, events, and branded visual content.",
    deliverable: "Edited image set with scheduled shoot coordination",
    coverage: "Portrait shoots, event coverage, product photos, and branded content sessions.",
    turnaround: "Typically 3-7 business days"
  },
  {
    slug: "videography",
    name: "Videography",
    priceLabel: "Starting at $1,500",
    invoiceAmountCents: 150000,
    description: "Promotional videos, live captures, reels, and campaign footage.",
    deliverable: "Shot list planning, filming, and edited final delivery",
    coverage: "Promo videos, social reels, interviews, event capture, and branded campaign footage.",
    turnaround: "Typically 5-10 business days"
  },
  {
    slug: "platform-membership-site-building-maintenance",
    name: "Membership Sites & Support",
    priceLabel: "$350 / month",
    invoiceAmountCents: 35000,
    description: "Build and update membership websites, private content areas, and support pages.",
    deliverable: "Site setup, update planning, and member access support",
    coverage: "Membership pages, private content access, billing setup help, and ongoing updates.",
    turnaround: "Typically 2-4 weeks"
  },
  {
    slug: "dj-services",
    name: "DJ Services",
    priceLabel: "Starting at $800",
    invoiceAmountCents: 80000,
    description: "Event DJ support for private events, parties, launches, and activations.",
    deliverable: "Booking, event coordination, and performance coverage",
    coverage: "Private events, brand activations, launch events, parties, and curated live sets.",
    turnaround: "Booking window typically 3-14 days"
  },
  {
    slug: "pc-tech-services",
    name: "PC Tech Services",
    priceLabel: "Starting at $150",
    invoiceAmountCents: 15000,
    description: "PC setup, troubleshooting, upgrades, tune-ups, and support.",
    deliverable: "Diagnosis, recommendations, and hands-on help",
    coverage: "Tune-ups, upgrades, software setup, repair guidance, and performance help.",
    turnaround: "Typically 1-3 business days"
  },
  {
    slug: "beat-creation-session",
    name: "Beat Creation Session",
    priceLabel: "Starting at $400",
    invoiceAmountCents: 40000,
    description: "Collaborative beat development sessions for artists, creators, and brands.",
    deliverable: "Live session time and exported creative draft assets",
    coverage: "Collaborative production sessions, idea development, arrangement work, and draft exports.",
    turnaround: "Session scheduling typically 2-5 days"
  }
];

export const serviceAdRoutes = [
  {
    route: "/ai-services",
    catalogSlug: "ai-services",
    branchName: "Black Lion Tech Development",
    branchHref: "/tech-development",
    audience: "Business owners, creators, and people with an idea who need help getting started",
    headline: "You’ve heard what AI can do. Let’s put it to work on your idea.",
    summary: "You do not need to know how to code or which AI tool to choose. Tell us what you want to build or make easier, and we will help you work out a practical next step.",
    image: "/ai/digital-support.png",
    trustItems: [
      "No coding experience or finished project brief is required.",
      "Scope and pricing are discussed before development begins.",
      "Tool subscriptions and ongoing hosting costs are explained during planning.",
      "Testing and a practical handoff are part of the agreed development plan."
    ],
    fit: [
      "Get started: understand where AI could help and choose a manageable first project.",
      "Build with help: turn an idea into a website, app, or internal business tool.",
      "Automate a task: reduce repetitive work across forms, documents, and everyday tools.",
      "Finish what you started: get help debugging or improving a project built with AI."
    ],
    briefFields: [
      { label: "Idea", value: "What would you like to build, fix, or make easier?" },
      { label: "People", value: "Who will use it, and what should they be able to do?" },
      { label: "Starting point", value: "An idea, existing website, unfinished app, or tools you have tried" },
      { label: "Priorities", value: "Your most useful first result, budget range, and preferred timing" }
    ],
    outcomes: [
      { label: "Understand", value: "A clear starting point", copy: "Translate your idea into a small, useful first version and discuss where AI fits." },
      { label: "Build", value: "Hands-on development", copy: "Create or improve the agreed software and test the tasks it needs to handle." },
      { label: "Use", value: "A guided handoff", copy: "Walk through the result, ongoing costs, and options for updates and support." }
    ],
    faqs: [
      { question: "Do I need to know how to code?", answer: "No. Start by describing the problem or idea in your own words. We can help define the features and next steps." },
      { question: "Can you help if I already tried building with AI?", answer: "Yes. We can review an unfinished app or website, discuss what is working, and scope the fixes or development it needs." },
      { question: "Does my app have to include AI?", answer: "No. AI can help with development, or become a feature when it serves a useful purpose. The approach depends on what your project needs." },
      { question: "How much does it cost?", answer: "Projects receive a custom quote after review. We agree on scope, timing, and any separate tool or hosting costs before work begins." }
    ]
  },
  {
    route: "/photography",
    catalogSlug: "photography",
    branchName: "Black Lion Multimedia",
    branchHref: "/multimedia",
    audience: "Creators, families, brands, product sellers, and event hosts",
    headline: "Photography that gives the request a clear shot list and delivery path.",
    summary:
      "Book portraits, product images, event coverage, or branded visuals with the details Black Lion Studios needs to plan the session.",
    image: "/ai/visual-storytelling.png",
    fit: [
      "Portrait sessions and profile images",
      "Product, merch, and brand visuals",
      "Small events, launches, and behind-the-scenes coverage",
      "Social content that needs a polished image set"
    ],
    briefFields: [
      { label: "Subject", value: "Who or what needs to be photographed" },
      { label: "Location", value: "Studio, event, business, or outdoor setting" },
      { label: "Usage", value: "Personal, social, product, campaign, or print" },
      { label: "Deadline", value: "Shoot window and final delivery target" }
    ],
    outcomes: [
      { label: "Plan", value: "Shot list", copy: "Clarify the looks, products, people, and setting before the session." },
      { label: "Capture", value: "Shoot coverage", copy: "Coordinate timing, location, and must-have frames." },
      { label: "Deliver", value: "Edited image set", copy: "Receive a focused set of edited images for the intended use." }
    ],
    faqs: [
      "Bring reference images, outfit notes, product details, and any must-have angles.",
      "Rush timing depends on schedule, location, and edit volume.",
      "Usage needs should be stated before the shoot so delivery is aligned."
    ]
  },
  {
    route: "/videography",
    catalogSlug: "videography",
    branchName: "Black Lion Multimedia",
    branchHref: "/multimedia",
    audience: "Artists, businesses, event hosts, and campaign teams",
    headline: "Videography requests with the concept, footage needs, and edit goals up front.",
    summary:
      "Start video work with the project goal, schedule, format, and delivery use already attached to the request.",
    image: "/ai/hero-editorial.png",
    fit: [
      "Promotional videos and launch content",
      "Social reels and short-form campaign clips",
      "Interviews, event captures, and recap footage",
      "Brand or creator content that needs planning before filming"
    ],
    briefFields: [
      { label: "Goal", value: "Promo, recap, interview, reel, or campaign footage" },
      { label: "Format", value: "Horizontal, vertical, social clips, or mixed delivery" },
      { label: "Scenes", value: "Locations, people, products, and must-capture moments" },
      { label: "Deadline", value: "Shoot date, draft date, and final delivery target" }
    ],
    outcomes: [
      { label: "Scope", value: "Shot plan", copy: "Define the footage needed before the camera day." },
      { label: "Capture", value: "Production coverage", copy: "Coordinate schedule, scene needs, and content priorities." },
      { label: "Deliver", value: "Edited video", copy: "Package the footage for the platform or campaign goal." }
    ],
    faqs: [
      "Send reference videos if you have a visual style in mind.",
      "Music, captions, and platform format should be discussed before editing starts.",
      "Multi-location projects may need extra scheduling time."
    ]
  },
  {
    route: "/dj-services",
    catalogSlug: "dj-services",
    branchName: "Black Lion Multimedia",
    branchHref: "/multimedia",
    audience: "Private events, parties, activations, launches, and small venues",
    headline: "DJ service requests that line up timing, crowd, equipment, and vibe.",
    summary:
      "Give the studio the event type, music direction, venue details, and schedule so booking follow-up starts with useful context.",
    image: "/ai/sound-atmosphere.png",
    fit: [
      "Private parties and community events",
      "Brand activations and launch events",
      "Curated live sets and hosted event music",
      "Small venue or pop-up event support"
    ],
    briefFields: [
      { label: "Event", value: "Type, date, time, location, and expected guest count" },
      { label: "Sound", value: "Genres, clean versions, special songs, and do-not-play notes" },
      { label: "Venue", value: "Power, setup space, access time, and house equipment" },
      { label: "Flow", value: "Arrival, announcements, breaks, and event milestones" }
    ],
    outcomes: [
      { label: "Confirm", value: "Event basics", copy: "Verify date, location, crowd size, and schedule before quote." },
      { label: "Plan", value: "Music direction", copy: "Match the set to the event, crowd, and requested energy." },
      { label: "Perform", value: "Live support", copy: "Arrive with the agreed setup and event flow in mind." }
    ],
    faqs: [
      "Venue access time and power details matter for setup.",
      "Special songs and clean-version needs should be included early.",
      "Travel, extended time, or extra equipment can change the quote."
    ]
  },
  {
    route: "/pc-tech-support",
    catalogSlug: "pc-tech-services",
    branchName: "Black Lion Tech Development",
    branchHref: "/tech-development",
    audience: "Home users, creators, small offices, and practical tech support clients",
    headline: "PC tech support requests that capture the issue before the first follow-up.",
    summary:
      "Send device details, symptoms, urgency, and setup notes so troubleshooting starts with the right facts.",
    image: "/ai/digital-support.png",
    fit: [
      "PC setup, cleanup, and tune-up help",
      "Software, driver, and performance troubleshooting",
      "Upgrade planning and practical repair guidance",
      "Creator or small business workstation support"
    ],
    briefFields: [
      { label: "Device", value: "Desktop, laptop, OS, model, and age if known" },
      { label: "Problem", value: "Symptoms, error messages, speed issues, or setup goal" },
      { label: "Urgency", value: "Normal support, deadline, or work-stopping issue" },
      { label: "Access", value: "In-person, drop-off, screenshots, or account constraints" }
    ],
    outcomes: [
      { label: "Diagnose", value: "Issue review", copy: "Capture symptoms and likely causes before work begins." },
      { label: "Recommend", value: "Fix path", copy: "Explain practical next steps, parts, or setup changes." },
      { label: "Support", value: "Hands-on help", copy: "Perform the agreed tune-up, setup, or troubleshooting work." }
    ],
    faqs: [
      "Back up important files before service when possible.",
      "Include screenshots or exact error text if available.",
      "Hardware parts, licenses, and third-party services are separate from labor."
    ]
  },
  {
    route: "/membership-sites",
    catalogSlug: "platform-membership-site-building-maintenance",
    branchName: "Black Lion Tech Development",
    branchHref: "/tech-development",
    audience: "Creators, coaches, private communities, and small businesses",
    headline: "Membership-site support for access, updates, billing flow, and content structure.",
    summary:
      "Start site support with the pages, member access needs, update cadence, and maintenance priorities already outlined.",
    image: "/ai/digital-support.png",
    fit: [
      "Private content and member access planning",
      "Membership page builds and ongoing updates",
      "Billing setup guidance and support page structure",
      "Maintenance help for creators and small teams"
    ],
    briefFields: [
      { label: "Site", value: "Current platform, domain, pages, and access model" },
      { label: "Members", value: "Who gets access and what each group should see" },
      { label: "Content", value: "Videos, posts, downloads, events, or gated pages" },
      { label: "Maintenance", value: "Update frequency, support needs, and launch target" }
    ],
    outcomes: [
      { label: "Map", value: "Access structure", copy: "Clarify what members need and how content should be organized." },
      { label: "Build", value: "Site support", copy: "Set up or improve the pages, links, and update workflow." },
      { label: "Maintain", value: "Ongoing updates", copy: "Keep the site usable as members and content change." }
    ],
    faqs: [
      "Existing platform access may be needed before setup work starts.",
      "Billing providers and membership tools may have separate fees.",
      "A launch checklist helps avoid access problems on release day."
    ]
  },
  {
    route: "/beat-sessions",
    catalogSlug: "beat-creation-session",
    branchName: "Black Lion Multimedia",
    branchHref: "/multimedia",
    audience: "Artists, creators, brands, and music-driven content teams",
    headline: "Beat sessions with creative direction, references, and export needs ready.",
    summary:
      "Book a collaborative production session with the sound, tempo, use case, and delivery expectations attached to the request.",
    image: "/ai/sound-atmosphere.png",
    fit: [
      "Collaborative beat creation sessions",
      "Artist idea development and arrangement work",
      "Brand or content music drafts",
      "Session exports for writing, demos, or next-step production"
    ],
    briefFields: [
      { label: "Sound", value: "Genre, mood, tempo, references, and creative direction" },
      { label: "Use", value: "Demo, release idea, content, brand, or writing session" },
      { label: "Session", value: "Remote/in-person preference and scheduling window" },
      { label: "Exports", value: "Draft needs, stems discussion, and file handoff expectations" }
    ],
    outcomes: [
      { label: "Shape", value: "Creative direction", copy: "Start with references and a target sound." },
      { label: "Create", value: "Session work", copy: "Build the beat direction collaboratively during the booked time." },
      { label: "Export", value: "Draft assets", copy: "Leave with the agreed draft files or next-step handoff." }
    ],
    faqs: [
      "Bring references and notes for tempo, mood, and intended use.",
      "Final rights, publishing, and release use should be clarified before commercial release.",
      "Additional mixing, mastering, or stem work may require a separate quote."
    ]
  }
];

export const modelApplicationService = {
  slug: "model-applications",
  name: "Model Sign-up",
  priceLabel: "Application review",
  invoiceAmountCents: 0,
  description: "Model applicant profile, casting review, production-readiness screening, and follow-up.",
  deliverable: "Application record and model profile review",
  coverage: "Casting pool, photo, video, campaign, editorial, product, and event-promo opportunities.",
  turnaround: "Reviewed as project needs open"
};

export const serviceOptions = [...serviceCatalog.map((service) => service.name), modelApplicationService.name];

export function findServiceByName(name) {
  if (name === modelApplicationService.name) {
    return modelApplicationService;
  }

  return serviceCatalog.find((service) => service.name === name) || null;
}

export function findServiceBySlug(slug) {
  return serviceCatalog.find((service) => service.slug === slug) || null;
}

export function findServiceAdPage(route) {
  const page = serviceAdRoutes.find((item) => item.route === route);
  if (!page) {
    return null;
  }

  const service = findServiceBySlug(page.catalogSlug);
  return service ? { ...page, service } : null;
}
