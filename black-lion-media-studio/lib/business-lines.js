import { merchCollections, plugzSiteLinks } from "./merch";
import { modelApplicationService, serviceAdRoutes, serviceCatalog } from "./services";

const serviceBySlug = new Map(serviceCatalog.map((service) => [service.slug, service]));
const routeBySlug = new Map(serviceAdRoutes.map((route) => [route.catalogSlug, route.route]));

function catalogItems(slugs) {
  return slugs.map((slug) => {
    const service = serviceBySlug.get(slug);
    return {
      ...service,
      href: routeBySlug.get(slug) || "/services"
    };
  }).filter((service) => service.slug);
}

export const businessLines = [
  {
    slug: "multimedia",
    href: "/multimedia",
    name: "Black Lion Multimedia",
    shortName: "Multimedia",
    eyebrow: "Photos & Video",
    image: "/ai/visual-storytelling.png",
    summary:
      "Photo, video, DJ, and beat-session work for creators, brands, events, product launches, and campaign content.",
    hero:
      "Book photo, video, sound, and production support through one creative lane.",
    services: catalogItems(["photography", "videography", "dj-services", "beat-creation-session"]),
    highlights: [
      "Portraits, product images, campaigns, and event coverage",
      "Promo videos, reels, interviews, recaps, and music video support",
      "DJ bookings, event sound direction, and beat creation sessions"
    ],
    paths: [
      { href: "/photography", label: "Photo", value: "Photography", note: "Portrait, product, event, and campaign images" },
      { href: "/videography", label: "Video", value: "Videography", note: "Promo, recap, reel, interview, and music video coverage" },
      { href: "/dj-services", label: "Events", value: "DJ Services", note: "Private events, launches, activations, and small venues" },
      { href: "/beat-sessions", label: "Audio", value: "Beat Sessions", note: "Collaborative production sessions and draft exports" }
    ],
    workflow: [
      "Choose the production service that fits the shoot, event, or release.",
      "Share references, locations, platform needs, schedule, and deadline.",
      "Keep planning, billing, delivery, and follow-up attached to the same request."
    ]
  },
  {
    slug: "tech-development",
    href: "/tech-development",
    name: "Black Lion Tech Development",
    shortName: "Tech Development",
    eyebrow: "AI & Software Development",
    image: "/ai/digital-support.png",
    summary:
      "Start with an idea, even if you do not know how to build it. Get AI guidance and software development, backed by website maintenance and computer service and repair support.",
    hero:
      "Know about AI, but not sure where to start? Start here.",
    services: catalogItems(["ai-services", "platform-membership-site-building-maintenance", "pc-tech-services"]),
    highlights: [
      "AI guidance, custom apps, automation, and help finishing AI-assisted projects",
      "Landing pages, forms, analytics setup, site maintenance, and access support",
      "PC tune-ups, setup, upgrades, repair guidance, and workstation troubleshooting"
    ],
    paths: [
      { href: "/ai-services", label: "Start with AI", value: "AI Services & Software Development", note: "From your first idea to practical software and automation" },
      { href: "/membership-sites", label: "Web", value: "Membership Sites", note: "Builds, maintenance, access structure, and private content" },
      { href: "/pc-tech-support", label: "Support", value: "Computer Service & Repair", note: "Setup, cleanup, upgrades, troubleshooting, and repair guidance" },
      { href: "/services#service-estimation", label: "Estimate", value: "Service Estimation", note: "Scope software, web, and support work before intake" }
    ],
    workflow: [
      "Tell us what you want to build or make easier. No technical brief is needed to start.",
      "Agree on a useful first step, scope, costs, and timeline, then build and test in stages.",
      "Use the portal for updates, approvals, billing, messages, and recurring maintenance."
    ]
  },
  {
    slug: "fashion",
    href: "/fashion",
    name: "Black Lion Fashion",
    shortName: "Fashion",
    eyebrow: "Fashion",
    image: "/ai/hero-editorial.png",
    summary:
      "Merch, streetwear direction, model applications, casting review, product imagery, and campaign-ready fashion content.",
    hero:
      "Connect merch, styling, product visuals, and model opportunities under one fashion branch.",
    services: [
      {
        ...modelApplicationService,
        href: "/models"
      },
      {
        slug: "merch-store",
        name: "Merch Store",
        priceLabel: "Live Plugz storefront",
        description: "Plugz UNTD and Plugz RNGD apparel, accessories, drop previews, and store questions.",
        coverage: merchCollections.map((collection) => collection.name).join(", "),
        turnaround: "Live storefront availability varies by drop",
        href: "/store"
      },
      ...catalogItems(["photography", "videography"])
    ],
    highlights: [
      "Plugz UNTD and Plugz RNGD merch previews with direct links to the live storefront",
      "Model Sign-up as a separate applicant profile and casting review sub-site",
      "Fashion, product, editorial, lifestyle, and campaign visuals for apparel or talent work"
    ],
    paths: [
      { href: "/store", label: "Merch", value: "Plugz collections", note: "Browse Black Lion fashion and open the live storefront" },
      { href: "/models", label: "Models", value: "Model Sign-up", note: "Separate model profile, casting review, and project interests" },
      { href: "/models/faq", label: "FAQ", value: "Model FAQ", note: "Eligibility, terms, review, and scheduling expectations" },
      { href: plugzSiteLinks.shop, label: "Shop", value: "Live Plugz shop", note: "Open current Plugz drop details" }
    ],
    workflow: [
      "Browse merch, campaign services, or the model application path.",
      "For modeling, submit through the dedicated model sub-site and keep that profile separate from client accounts.",
      "For fashion content, send product, wardrobe, usage, model, location, and deadline details."
    ]
  }
];

export function findBusinessLine(slug) {
  return businessLines.find((line) => line.slug === slug) || null;
}
