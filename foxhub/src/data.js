export const tabs = [
  { id: "hub", label: "Home" },
  { id: "chat", label: "Social" },
  { id: "circles", label: "Rapport" },
  { id: "growth", label: "Communal" },
  { id: "discover", label: "Services / Merchant" },
  { id: "market", label: "Needs & Offers" },
  { id: "wallet", label: "Pay" },
  { id: "experience", label: "UX / Goodies" },
  { id: "connectors", label: "Tools" },
  { id: "blueprint", label: "Organizer" }
];

export const listingCategories = [
  "For Sale",
  "Housing",
  "Jobs",
  "Gigs",
  "Services",
  "Community"
];

export const listingTypes = [
  { id: "offer", label: "Offer" },
  { id: "request", label: "Request" },
  { id: "gig", label: "Gig" },
  { id: "housing", label: "Housing" },
  { id: "service", label: "Service" }
];

export const listingTags = ["vip", "local", "verified", "urgent", "new", "featured"];

export const sourcePatternCards = [
  {
    id: "instagram",
    source: "Instagram",
    component: "Creator profile card",
    zone: "Network",
    summary: "Visual identity, activity, and follow-style actions that make people feel easier to understand at a glance.",
    highlight: "Profile identity"
  },
  {
    id: "ebay",
    source: "eBay",
    component: "Watch and offer card",
    zone: "Market",
    summary: "Save items, compare status, and keep deal movement visible from one compact listing card.",
    highlight: "Watchlist"
  },
  {
    id: "amazon",
    source: "Amazon",
    component: "Buy box summary",
    zone: "Market",
    summary: "Clear price, shipping, trust, and checkout context grouped into one high-conversion panel.",
    highlight: "Decision panel"
  },
  {
    id: "etsy",
    source: "Etsy",
    component: "Shop trust module",
    zone: "Market",
    summary: "Seller story, favorites, reviews, and handmade-style trust signals tailored for creator commerce.",
    highlight: "Maker trust"
  },
  {
    id: "whatsapp",
    source: "WhatsApp",
    component: "Community and channel stack",
    zone: "Chats",
    summary: "Private group communication and broadcast updates separated cleanly but kept under one messaging roof.",
    highlight: "Communities"
  },
  {
    id: "google-search",
    source: "Google Search",
    component: "Universal result scopes",
    zone: "Discover",
    summary: "One search entry that branches into people, listings, services, and content instead of forcing separate searches.",
    highlight: "Search scopes"
  },
  {
    id: "google-maps",
    source: "Google Maps",
    component: "Local places cards",
    zone: "Discover",
    summary: "Nearby recommendations with distance, hours, save actions, and community signals for local utility.",
    highlight: "Nearby places"
  },
  {
    id: "linkedin",
    source: "LinkedIn",
    component: "Professional trust profile",
    zone: "Network",
    summary: "Role, reputation, work history, and intro actions that make service providers easier to vet.",
    highlight: "Work identity"
  }
];

export const foxhubPlaces = [
  {
    id: "place-1",
    name: "Midtown Print & Ship",
    type: "Shipping and print",
    distance: "0.6 mi",
    rating: "4.8",
    status: "Open until 8 PM",
    note: "Label printing, returns, packaging help"
  },
  {
    id: "place-2",
    name: "Peachtree Coffee House",
    type: "Cafe workspace",
    distance: "0.9 mi",
    rating: "4.6",
    status: "Busy now",
    note: "Good for meetups, plugs, and Wi-Fi"
  },
  {
    id: "place-3",
    name: "Westside Creator Studio",
    type: "Production space",
    distance: "1.7 mi",
    rating: "4.9",
    status: "Appointments only",
    note: "Photo sets, rentals, and team sessions"
  }
];

export const foxhubProfessionalCards = [
  {
    id: "pro-1",
    name: "Tia Brooks",
    role: "Community growth lead",
    company: "FoxHub Miami Circle",
    trust: "Verified operator",
    strength: "Events · creator partnerships · merchant rollout",
    reach: "2 mutual circles"
  },
  {
    id: "pro-2",
    name: "Marcus Lee",
    role: "Marketplace operations advisor",
    company: "FoxHub Austin",
    trust: "Trusted advisor",
    strength: "Launch reviews · fulfillment · vendor ops",
    reach: "Recommended by Nova"
  },
  {
    id: "pro-3",
    name: "Nova Reyes",
    role: "City creator partner",
    company: "FoxHub Atlanta",
    trust: "AA relationship tier",
    strength: "Merch drops · events · local demand signals",
    reach: "High reply rate"
  }
];

export const foxhubMarketSignals = [
  {
    id: "signal-1",
    title: "Watchlist momentum",
    detail: "14 saves in the last 24 hours",
    cue: "eBay-style watch activity"
  },
  {
    id: "signal-2",
    title: "Top decision box",
    detail: "Price, fulfillment, and trust stacked in one panel",
    cue: "Amazon-style buy clarity"
  },
  {
    id: "signal-3",
    title: "Maker trust story",
    detail: "Shop note, review average, and favorites together",
    cue: "Etsy-style shop warmth"
  },
  {
    id: "signal-4",
    title: "Fast category browse",
    detail: "Housing, jobs, services, and community in one scan",
    cue: "Craigslist-style speed"
  }
];

export const listings = [
  {
    id: "listing-1",
    title: "Pop-up merch drop · curated FoxHub caps",
    category: "For Sale",
    type: "offer",
    price: 340,
    currency: "USD",
    city: "Atlanta",
    neighborhood: "West Midtown",
    description:
      "Limited-edition FoxHub caps produced under the ATL design collective. Mix of leather patches and reflective embroidery.",
    tags: ["vip", "featured"],
    photos: ["https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80"],
    contactId: "nova",
    status: "active",
    featured: true,
    verified: true,
    postedAt: "2026-03-28T14:00:00Z",
    flags: []
  },
  {
    id: "listing-2",
    title: "Apartment share · Midtown A",
    category: "Housing",
    type: "housing",
    price: 1250,
    currency: "USD",
    city: "Miami",
    neighborhood: "Wynwood",
    description:
      "Bright 2-bed share, available immediately. Seeking creative professional to join trusted circle. Utilities split evenly.",
    tags: ["local"],
    photos: ["https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=900&q=80"],
    contactId: "tia",
    status: "review",
    featured: false,
    verified: false,
    postedAt: "2026-03-30T09:15:00Z",
    flags: []
  },
  {
    id: "listing-3",
    title: "Guest DJ for residents-only rooftop",
    category: "Gigs",
    type: "gig",
    price: 450,
    currency: "USD",
    city: "Miami",
    neighborhood: "Brickell",
    description:
      "Looking for a DJ to play a 3-hour curated set for a rooftop residency. FoxHub will cover setup and travel.",
    tags: ["urgent", "local"],
    photos: ["https://images.unsplash.com/photo-1487215078519-e21cc028cb29?auto=format&fit=crop&w=900&q=80"],
    contactId: "isa",
    status: "active",
    featured: false,
    verified: false,
    postedAt: "2026-03-25T17:45:00Z",
    flags: []
  },
  {
    id: "listing-4",
    title: "Services · City operations studio consulting",
    category: "Services",
    type: "service",
    price: 1200,
    currency: "USD",
    city: "Austin",
    neighborhood: "Downtown",
    description:
      "Ops and product pairing for new launches. Strategy, vendor ops, and trust-layer guidance for FoxHub merchants.",
    tags: ["verified"],
    photos: ["https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&q=80"],
    contactId: "marcus",
    status: "active",
    featured: true,
    verified: true,
    postedAt: "2026-03-20T12:00:00Z",
    flags: []
  }
];

export const savedSearches = [
  {
    id: "saved-1",
    name: "Local gigs",
    keywords: "DJ|producer",
    category: "Gigs",
    city: "Miami",
    radius: "10 miles"
  }
];

export const listingAlerts = [];

export const circles = [
  { id: "atl", name: "Atlanta Creators", members: "2.3k", trust: "Verified pilot", focus: "artists, hosts, promoters" },
  { id: "mia", name: "Miami Hosts", members: "1.1k", trust: "Open circle", focus: "nightlife, hospitality, local events" },
  { id: "aus", name: "Austin Builders", members: "860", trust: "Curated", focus: "founders, operators, devs" }
];

export const contacts = [
  {
    id: "nova",
    name: "Nova Reyes",
    handle: "@nova",
    displayName: "Nova Reyes",
    legalName: "Nova Elise Reyes",
    email: "nova.reyes@example.com",
    phone: "+1 (404) 555-0184",
    city: "Atlanta",
    region: "GA",
    zipCode: "30303",
    status: "builder",
    accountType: "creator",
    trust: "verified",
    trustTier: "AA",
    peerRatingAverage: 4.9,
    peerRatingCount: 18,
    myPeerRating: "AA",
    verificationLevel: "government id + payout verified",
    presenceState: "online",
    lastActiveLabel: "active now",
    tier: "launch partner",
    customerStage: "active",
    relationshipScore: 94,
    lifetimeValue: "$8.4k",
    lastTransaction: "$420 payout · 3d ago",
    preferredSurface: "circles",
    tags: ["creator lead", "city ops", "high trust"],
    joinDate: "2026-01-14",
    referralSource: "private circle invite",
    walletState: "active",
    payoutMethod: "instant transfer",
    supportTier: "priority"
  },
  {
    id: "marcus",
    name: "Marcus Lee",
    handle: "@mlee",
    displayName: "Marcus Lee",
    legalName: "Marcus Jin Lee",
    email: "marcus.lee@example.com",
    phone: "+1 (512) 555-0131",
    city: "Austin",
    region: "TX",
    zipCode: "78701",
    status: "product",
    accountType: "operator",
    trust: "trusted",
    trustTier: "A",
    peerRatingAverage: 4.3,
    peerRatingCount: 11,
    myPeerRating: "A",
    verificationLevel: "email + device verified",
    presenceState: "focus",
    lastActiveLabel: "last active 8m ago",
    tier: "advisor",
    customerStage: "active",
    relationshipScore: 88,
    lifetimeValue: "$3.1k",
    lastTransaction: "No recent wallet activity",
    preferredSurface: "direct chat",
    tags: ["product advisor", "beta feedback"],
    joinDate: "2026-02-03",
    referralSource: "internal invite",
    walletState: "inactive",
    payoutMethod: "not configured",
    supportTier: "standard"
  },
  {
    id: "tia",
    name: "Tia Brooks",
    handle: "@tia",
    displayName: "Tia Brooks",
    legalName: "Tia Renee Brooks",
    email: "tia.brooks@example.com",
    phone: "+1 (305) 555-0177",
    city: "Miami",
    region: "FL",
    zipCode: "33139",
    status: "creator",
    accountType: "creator",
    trust: "trusted",
    trustTier: "AA",
    peerRatingAverage: 4.8,
    peerRatingCount: 15,
    myPeerRating: "AA",
    verificationLevel: "government id verified",
    presenceState: "online",
    lastActiveLabel: "active now",
    tier: "growth node",
    customerStage: "active",
    relationshipScore: 91,
    lifetimeValue: "$6.2k",
    lastTransaction: "$118 transfer · yesterday",
    preferredSurface: "moments",
    tags: ["creator", "nightlife", "merchant bridge"],
    joinDate: "2026-01-28",
    referralSource: "event signup",
    walletState: "active",
    payoutMethod: "foxhub balance",
    supportTier: "priority"
  },
  {
    id: "isa",
    name: "Isa Moore",
    handle: "@isamoore",
    displayName: "Isa Moore",
    legalName: "Isabella Moore",
    email: "isa.moore@example.com",
    phone: "+1 (786) 555-0115",
    city: "Miami",
    region: "FL",
    zipCode: "33139",
    status: "merchant",
    accountType: "merchant",
    trust: "pilot",
    trustTier: "C",
    peerRatingAverage: 2.2,
    peerRatingCount: 6,
    myPeerRating: "C",
    verificationLevel: "merchant docs pending",
    presenceState: "away",
    lastActiveLabel: "last active 24m ago",
    tier: "merchant pilot",
    customerStage: "onboarding",
    relationshipScore: 76,
    lifetimeValue: "$1.9k",
    lastTransaction: "$42.80 merchant pay · today",
    preferredSurface: "wallet",
    tags: ["merchant", "pilot", "qr checkout"],
    joinDate: "2026-03-06",
    referralSource: "creator referral",
    walletState: "review",
    payoutMethod: "business account pending",
    supportTier: "merchant ops"
  }
];

export const userRecords = [
  {
    id: "user-nova",
    contactId: "nova",
    accountType: "creator",
    segment: "city launch lead",
    stage: "active",
    owner: "ATL rollout",
    trustScore: 94,
    walletVolume30d: "$2,480",
    lifetimeValue: "$8,400",
    lastOrder: "Sunday rooftop set payout",
    lastActivity: "Moments post shared into private circle 12 min ago",
    acquisitionSource: "private invite",
    preferredChannel: "circles",
    paymentStatus: "settled",
    riskState: "low",
    consentState: "verified",
    identityState: "verified",
    walletState: "active",
    supportTier: "priority",
    engagementScore: 97,
    referralCount: 14,
    deviceCount: 3,
    messageVolume30d: "418",
    circleCount: 4,
    savedCount: 12,
    notes: "High-referral operator. Good wedge into Atlanta creator onboarding.",
    tags: ["vip", "creator", "referrals"],
    timeline: ["Invited via private circle", "Completed identity card", "Received first payout", "Referred 14 creators"],
    profile: {
      displayName: "Nova Reyes",
      legalName: "Nova Elise Reyes",
      email: "nova.reyes@example.com",
      phone: "+1 (404) 555-0184",
      city: "Atlanta",
      region: "GA",
      timezone: "America/New_York",
      joinDate: "2026-01-14",
      language: "en-US"
    },
    verification: {
      identity: "passed",
      merchant: "n/a",
      payout: "approved",
      riskReview: "clear"
    },
    preferences: {
      notifications: "priority alerts only",
      privacy: "trusted circles first",
      discovery: "creator and city drops",
      payments: "instant payouts"
    },
    relationship: {
      acquisitionSource: "private invite",
      referrer: "ATL rollout ops",
      owner: "ATL rollout",
      preferredSurface: "circles",
      nextBestAction: "offer host tools beta"
    },
    businessProfile: {
      businessType: "creator collective",
      organization: "South Loop Sessions",
      website: "southloopsessions.test",
      payoutMethod: "instant transfer"
    },
    security: {
      mfa: "enabled",
      deviceTrust: "high",
      lastDevice: "iPhone 15 Pro",
      lastIpRegion: "Atlanta, GA"
    }
  },
  {
    id: "user-tia",
    contactId: "tia",
    accountType: "creator",
    segment: "merchant bridge",
    stage: "active",
    owner: "Miami growth",
    trustScore: 91,
    walletVolume30d: "$1,760",
    lifetimeValue: "$6,200",
    lastOrder: "SplitTab nightlife settlement",
    lastActivity: "Sent merchant QR feedback 46 min ago",
    acquisitionSource: "event activation",
    preferredChannel: "moments",
    paymentStatus: "settled",
    riskState: "low",
    consentState: "verified",
    identityState: "trusted",
    walletState: "active",
    supportTier: "priority",
    engagementScore: 92,
    referralCount: 6,
    deviceCount: 2,
    messageVolume30d: "271",
    circleCount: 3,
    savedCount: 9,
    notes: "Strong early-adopter signal. Useful bridge between creator and merchant usage.",
    tags: ["growth", "nightlife", "pilot"],
    timeline: ["Joined from event drop", "Activated wallet", "Completed 11 peer transfers", "Saved merchant QR kit concept"],
    profile: {
      displayName: "Tia Brooks",
      legalName: "Tia Renee Brooks",
      email: "tia.brooks@example.com",
      phone: "+1 (305) 555-0177",
      city: "Miami",
      region: "FL",
      timezone: "America/New_York",
      joinDate: "2026-01-28",
      language: "en-US"
    },
    verification: {
      identity: "passed",
      merchant: "n/a",
      payout: "approved",
      riskReview: "clear"
    },
    preferences: {
      notifications: "all creator drops",
      privacy: "public moments, private wallet",
      discovery: "events and nightlife",
      payments: "foxhub balance"
    },
    relationship: {
      acquisitionSource: "event activation",
      referrer: "FoxTickets launch crew",
      owner: "Miami growth",
      preferredSurface: "moments",
      nextBestAction: "promote merchant bundle"
    },
    businessProfile: {
      businessType: "creator",
      organization: "Tia After Dark",
      website: "tiaafterdark.test",
      payoutMethod: "foxhub balance"
    },
    security: {
      mfa: "enabled",
      deviceTrust: "high",
      lastDevice: "Pixel 9",
      lastIpRegion: "Miami, FL"
    }
  },
  {
    id: "user-isa",
    contactId: "isa",
    accountType: "merchant",
    segment: "venue pilot",
    stage: "onboarding",
    owner: "Merchant ops",
    trustScore: 76,
    walletVolume30d: "$920",
    lifetimeValue: "$1,900",
    lastOrder: "QR merchant checkout pilot",
    lastActivity: "Requested merchant QR kits in group thread",
    acquisitionSource: "creator referral",
    preferredChannel: "wallet",
    paymentStatus: "monitor",
    riskState: "review",
    consentState: "pending tax profile",
    identityState: "pending merchant docs",
    walletState: "review",
    supportTier: "merchant ops",
    engagementScore: 74,
    referralCount: 1,
    deviceCount: 1,
    messageVolume30d: "63",
    circleCount: 1,
    savedCount: 2,
    notes: "Promising merchant pilot, but onboarding is incomplete and needs compliance follow-through.",
    tags: ["merchant", "pilot", "review"],
    timeline: ["Referred by Tia", "Opened direct merchant thread", "First QR payment captured", "Compliance follow-up pending"],
    profile: {
      displayName: "Isa Moore",
      legalName: "Isabella Moore",
      email: "isa.moore@example.com",
      phone: "+1 (786) 555-0115",
      city: "Miami",
      region: "FL",
      timezone: "America/New_York",
      joinDate: "2026-03-06",
      language: "en-US"
    },
    verification: {
      identity: "basic verified",
      merchant: "pending",
      payout: "blocked pending docs",
      riskReview: "manual review"
    },
    preferences: {
      notifications: "merchant settlement alerts",
      privacy: "staff only",
      discovery: "merchant tools",
      payments: "bank settlement pending"
    },
    relationship: {
      acquisitionSource: "creator referral",
      referrer: "Tia Brooks",
      owner: "Merchant ops",
      preferredSurface: "wallet",
      nextBestAction: "complete tax and business verification"
    },
    businessProfile: {
      businessType: "venue",
      organization: "Coastline Social Club",
      website: "coastlinesocial.test",
      payoutMethod: "business account pending"
    },
    security: {
      mfa: "disabled",
      deviceTrust: "medium",
      lastDevice: "iPad Pro",
      lastIpRegion: "Miami, FL"
    }
  },
  {
    id: "user-marcus",
    contactId: "marcus",
    accountType: "operator",
    segment: "product advisor",
    stage: "active",
    owner: "Core product",
    trustScore: 88,
    walletVolume30d: "$120",
    lifetimeValue: "$3,100",
    lastOrder: "No wallet order history",
    lastActivity: "Shared product sequencing guidance 8 min ago",
    acquisitionSource: "internal invite",
    preferredChannel: "direct chat",
    paymentStatus: "not using wallet",
    riskState: "low",
    consentState: "verified",
    identityState: "trusted",
    walletState: "inactive",
    supportTier: "standard",
    engagementScore: 84,
    referralCount: 2,
    deviceCount: 2,
    messageVolume30d: "193",
    circleCount: 2,
    savedCount: 5,
    notes: "High-signal product operator. Less transactional value, high strategic value.",
    tags: ["advisor", "product", "internal"],
    timeline: ["Invited internally", "Completed profile", "Joined Austin Builders", "Reviewed voice-room sequencing"],
    profile: {
      displayName: "Marcus Lee",
      legalName: "Marcus Jin Lee",
      email: "marcus.lee@example.com",
      phone: "+1 (512) 555-0131",
      city: "Austin",
      region: "TX",
      timezone: "America/Chicago",
      joinDate: "2026-02-03",
      language: "en-US"
    },
    verification: {
      identity: "email verified",
      merchant: "n/a",
      payout: "not configured",
      riskReview: "clear"
    },
    preferences: {
      notifications: "direct mentions only",
      privacy: "operator circles",
      discovery: "builder tools",
      payments: "disabled"
    },
    relationship: {
      acquisitionSource: "internal invite",
      referrer: "Core product",
      owner: "Core product",
      preferredSurface: "direct chat",
      nextBestAction: "invite to advisor channel"
    },
    businessProfile: {
      businessType: "operator",
      organization: "Independent advisor",
      website: "marcuslee.test",
      payoutMethod: "not configured"
    },
    security: {
      mfa: "enabled",
      deviceTrust: "high",
      lastDevice: "MacBook Pro",
      lastIpRegion: "Austin, TX"
    }
  }
];

export const userSegments = [
  { id: "seg-creators", name: "Creators", count: 2, health: "strong", detail: "High engagement, payout active, strong referral loops" },
  { id: "seg-merchants", name: "Merchants", count: 1, health: "watch", detail: "Higher compliance friction, strong QR payment upside" },
  { id: "seg-operators", name: "Operators", count: 1, health: "stable", detail: "Lower wallet activity, high strategic product influence" }
];

export const customerRecords = userRecords;

export const friendRequests = [
  {
    id: "fr-isa",
    fromContactId: "isa",
    name: "Isa Moore",
    handle: "@isamoore",
    city: "Miami",
    mutualCount: 7,
    note: "We met in Miami Hosts and should connect directly for event workflows."
  },
  {
    id: "fr-renee",
    fromContactId: "renee",
    name: "Renee Lawson",
    handle: "@renee",
    city: "Atlanta",
    mutualCount: 3,
    note: "Looking to coordinate creator pop-up scheduling."
  }
];

export const threads = [
  {
    id: "foxhub-newsroom",
    name: "FoxHub Newsroom",
    type: "official",
    members: 1,
    presence: "service channel",
    presenceState: "online",
    lastActiveLabel: "updated 4m ago",
    unreadCount: 2,
    messages: [
      { id: 1, author: "FoxHub Newsroom", text: "QR identity actions now open direct threads and service context faster.", time: "09:20", mine: false },
      { id: 2, author: "FoxHub Newsroom", text: "Mini-app launches now preserve conversation context instead of feeling detached.", time: "09:26", mine: false }
    ]
  },
  {
    id: "wallet-watch",
    name: "Wallet Watch",
    type: "official",
    members: 1,
    presence: "service channel",
    presenceState: "focus",
    lastActiveLabel: "updated 11m ago",
    unreadCount: 1,
    messages: [
      { id: 1, author: "Wallet Watch", text: "Merchant payments should feel native to threads, not buried behind separate checkout surfaces.", time: "08:58", mine: false },
      { id: 2, author: "Wallet Watch", text: "Next goal: preserve thread-linked payment receipts across devices.", time: "09:09", mine: false }
    ]
  },
  {
    id: "atl-culture-wire",
    name: "ATL Culture Wire",
    type: "official",
    members: 1,
    presence: "service channel",
    presenceState: "online",
    lastActiveLabel: "updated 18m ago",
    unreadCount: 1,
    messages: [
      { id: 1, author: "ATL Culture Wire", text: "Friday creator crawl opens with a FoxTickets guest-list drop.", time: "08:41", mine: false },
      { id: 2, author: "ATL Culture Wire", text: "Scan-to-join circles are converting better than generic invite links.", time: "08:55", mine: false }
    ]
  },
  {
    id: "launch-team",
    name: "Launch Team",
    type: "ops",
    members: 8,
    presence: "6 online",
    presenceState: "online",
    lastActiveLabel: "updated 2m ago",
    unreadCount: 4,
    messages: [
      { id: 1, author: "Nova", text: "Atlanta beta waitlist crossed 2,300 this morning.", time: "09:12", mine: false },
      { id: 2, author: "You", text: "Good. Keep creators ahead of local merchants in onboarding.", time: "09:14", mine: true, status: "seen" },
      { id: 3, author: "Milan", text: "Copy. QR invites and private circles are testing clean.", time: "09:18", mine: false }
    ]
  },
  {
    id: "marcus",
    name: "Marcus Lee",
    type: "direct",
    members: 2,
    presence: "active now",
    presenceState: "focus",
    lastActiveLabel: "last active 8m ago",
    unreadCount: 1,
    messages: [
      { id: 1, author: "Marcus", text: "Voice rooms should launch after group chat, not before.", time: "Yesterday", mine: false },
      { id: 2, author: "You", text: "Agreed. Messaging retention comes first.", time: "Yesterday", mine: true, status: "delivered" }
    ]
  },
  {
    id: "miami-hosts",
    name: "Miami Hosts",
    type: "community",
    members: 124,
    presence: "19 online",
    presenceState: "online",
    lastActiveLabel: "updated 1m ago",
    unreadCount: 7,
    messages: [
      { id: 1, author: "Rae", text: "SplitTab saved last night's bar crawl. Push it into discover.", time: "08:02", mine: false },
      { id: 2, author: "Isa", text: "Need merchant QR kits next.", time: "08:04", mine: false }
    ]
  }
];

export const miniApps = [
  { id: "splittab", name: "SplitTab", type: "Payments", summary: "Group tabs, instant settle, merchant QR closeout." },
  { id: "merchantos", name: "MerchantOS", type: "Merchant", summary: "Merchant management, settlement, payout, and QR operations." },
  { id: "foxtickets", name: "FoxTickets", type: "Events", summary: "Community ticket drops and creator guest lists." },
  { id: "neighborhoods", name: "Neighborhoods", type: "Local", summary: "Verified area chat, alerts, and service boards." },
  { id: "ridegrid", name: "RideGrid", type: "Mobility", summary: "Group mobility requests and event pickup pooling." }
];

export const miniProgramMechanics = [
  { id: "manifest", name: "Manifest registry", area: "Runtime", status: "installed", detail: "App id, version, permission list, launch events, and review state are captured before an app is trusted." },
  { id: "permissions", name: "Permission gate", area: "Security", status: "installed", detail: "Identity, wallet, contacts, and thread access are declared per mini-program instead of assumed globally." },
  { id: "context-return", name: "Thread return context", area: "Navigation", status: "installed", detail: "Users can return from a mini-program to the conversation, merchant, or service path that launched it." },
  { id: "qr-launch", name: "QR launch path", area: "Checkout", status: "installed", detail: "QR scans can open a merchant payment or mini-program flow with the current account context attached." },
  { id: "runtime-events", name: "Runtime event bridge", area: "Operations", status: "installed", detail: "Mini-program bootstrap, permission checks, and service events can be logged as runtime sessions." },
  { id: "reliability", name: "Reliable action queue", area: "Offline", status: "installed", detail: "Mini-program actions can be queued and flushed so checkout or service updates do not disappear during bad network conditions." },
  { id: "analytics", name: "Analytics and experiments", area: "Growth", status: "installed", detail: "Launches, funnels, and feature variants can be tracked without wiring every app by hand." },
  { id: "trust", name: "Trust and safety bridge", area: "Compliance", status: "installed", detail: "Reports, verification cases, incidents, and merchant risk checks stay available from service surfaces." }
];

export const merchantServiceComponents = [
  { id: "kyb", name: "KYB onboarding", category: "Compliance", status: "installed", mechanic: "Collect business identity, tax profile, ownership, bank details, and verification review before full payout access." },
  { id: "bank", name: "Bank and payout rails", category: "Payments", status: "installed", mechanic: "Track payout readiness, reserves, payout holds, releases, and next payout windows for each merchant." },
  { id: "qr", name: "QR checkout lanes", category: "Checkout", status: "installed", mechanic: "Run merchant pay, scan QR codes, and route counter checkout back into wallet and conversation context." },
  { id: "settlements", name: "Settlement review", category: "Finance", status: "installed", mechanic: "Review, approve, hold, or release daily settlement batches with audit events and wallet records." },
  { id: "disputes", name: "Disputes and chargebacks", category: "Risk", status: "installed", mechanic: "Open dispute cases, assign them to Payments Ops, and resolve them with an audit trail." },
  { id: "risk", name: "Merchant risk scoring", category: "Risk", status: "installed", mechanic: "Run manual risk checks, update onboarding status, and push high-risk merchants into enhanced due diligence." },
  { id: "locations", name: "Location and terminal health", category: "Operations", status: "installed", mechanic: "Track each store, terminal health, QR status, compliance state, and live or pilot rollout status." },
  { id: "incidents", name: "Trust and safety incidents", category: "Safety", status: "installed", mechanic: "File merchant impersonation, fraud, harassment, or account-takeover incidents from the services console." },
  { id: "documents", name: "Document vault", category: "Compliance", status: "installed", mechanic: "Store merchant evidence, verification documents, and review files against a merchant or account target." },
  { id: "alerts", name: "Notification routing", category: "Operations", status: "installed", mechanic: "Surface payout, dispute, onboarding, and risk alerts to operators with read-state handling." },
  { id: "audit", name: "Audit logging", category: "Governance", status: "installed", mechanic: "Record merchant onboarding, payout, settlement, dispute, and risk actions with actor and target metadata." },
  { id: "reporting", name: "Merchant reporting", category: "Analytics", status: "installed", mechanic: "Summarize locations, live terminals, settlement exposure, payout risk, incidents, and queue volume." }
];

export const foxhubExpansionComponents = [
  { order: 1, id: "global-section-map", category: "Navigation And Architecture", name: "Global Section Map", mechanic: "Maps every major area, sub-room, and purpose so users understand where each feature lives." },
  { order: 2, id: "room-breadcrumbs", category: "Navigation And Architecture", name: "Room Breadcrumbs", mechanic: "Shows location paths such as FoxHub > Services > MerchantOS > Settlements." },
  { order: 3, id: "pinned-room-shortcuts", category: "Navigation And Architecture", name: "Pinned Room Shortcuts", mechanic: "Lets users pin frequently used rooms to the left rail." },
  { order: 4, id: "recently-viewed-rooms", category: "Navigation And Architecture", name: "Recently Viewed Rooms", mechanic: "Keeps the last five visited rooms available for fast return." },
  { order: 5, id: "role-based-navigation", category: "Navigation And Architecture", name: "Role-Based Navigation", mechanic: "Changes tab emphasis for user, creator, merchant, host, operator, and admin roles." },
  { order: 6, id: "room-search", category: "Navigation And Architecture", name: "Room Search", mechanic: "Searches pages, rooms, and components separately from marketplace results." },
  { order: 7, id: "cross-room-deep-links", category: "Navigation And Architecture", name: "Cross-Room Deep Links", mechanic: "Creates direct links to threads, merchants, disputes, listings, and profiles." },
  { order: 8, id: "room-permission-labels", category: "Navigation And Architecture", name: "Room Permission Labels", mechanic: "Explains why a user can or cannot access a room." },
  { order: 9, id: "workspace-mode-switcher", category: "Navigation And Architecture", name: "Workspace Mode Switcher", mechanic: "Switches between user, merchant, operator, and admin workspace modes." },
  { order: 10, id: "feature-dependency-map", category: "Navigation And Architecture", name: "Feature Dependency Map", mechanic: "Shows which features depend on wallet, profile, verification, or connectors." },
  { order: 11, id: "profile-completion-meter", category: "Profile And Identity", name: "Profile Completion Meter", mechanic: "Tracks identity, city, handle, bio, verification, and wallet readiness." },
  { order: 12, id: "identity-trust-timeline", category: "Profile And Identity", name: "Identity Trust Timeline", mechanic: "Shows verification, reports, endorsements, disputes, and trust events in order." },
  { order: 13, id: "profile-visibility-controls", category: "Profile And Identity", name: "Profile Visibility Controls", mechanic: "Controls whether a profile is public, contacts-only, merchant-only, or hidden." },
  { order: 14, id: "multi-role-profile-cards", category: "Profile And Identity", name: "Multi-Role Profile Cards", mechanic: "Lets one account hold creator, merchant, host, buyer, and operator roles." },
  { order: 15, id: "profile-preview-drawer", category: "Profile And Identity", name: "Profile Preview Drawer", mechanic: "Previews how other people see the profile card." },
  { order: 16, id: "verification-document-checklist", category: "Profile And Identity", name: "Verification Document Checklist", mechanic: "Tracks missing ID, business docs, payout docs, and tax docs." },
  { order: 17, id: "trusted-contact-sponsors", category: "Profile And Identity", name: "Trusted Contact Sponsors", mechanic: "Shows who invited or vouched for an account." },
  { order: 18, id: "account-risk-banner", category: "Profile And Identity", name: "Account Risk Banner", mechanic: "Flags holds, disputes, missing documents, or trust problems on the account." },
  { order: 19, id: "identity-conflict-resolver", category: "Profile And Identity", name: "Identity Conflict Resolver", mechanic: "Detects duplicate handles, emails, merchant names, and profile records." },
  { order: 20, id: "profile-activity-digest", category: "Profile And Identity", name: "Profile Activity Digest", mechanic: "Summarizes recent activity across messages, wallet, listings, and services." },
  { order: 21, id: "thread-room-tabs", category: "Messaging And Threads", name: "Thread Room Tabs", mechanic: "Splits a conversation into messages, files, payments, tasks, people, and history." },
  { order: 22, id: "thread-context-card", category: "Messaging And Threads", name: "Thread Context Card", mechanic: "Shows the merchant, listing, event, or payment tied to a conversation." },
  { order: 23, id: "thread-task-checklist", category: "Messaging And Threads", name: "Thread Task Checklist", mechanic: "Assigns and completes tasks inside a conversation." },
  { order: 24, id: "thread-payment-summary", category: "Messaging And Threads", name: "Thread Payment Summary", mechanic: "Summarizes total sent, pending, held, refunded, and disputed in a thread." },
  { order: 25, id: "conversation-health-meter", category: "Messaging And Threads", name: "Conversation Health Meter", mechanic: "Flags unread, stale, blocked, high-risk, or awaiting-reply conversations." },
  { order: 26, id: "saved-replies", category: "Messaging And Threads", name: "Saved Replies", mechanic: "Stores reusable replies for merchants, hosts, operators, and support." },
  { order: 27, id: "thread-escalation-button", category: "Messaging And Threads", name: "Thread Escalation Button", mechanic: "Escalates a thread to trust, payments, support, or merchant operations." },
  { order: 28, id: "message-attachment-vault", category: "Messaging And Threads", name: "Message Attachment Vault", mechanic: "Collects all files from a thread in one place." },
  { order: 29, id: "thread-audit-view", category: "Messaging And Threads", name: "Thread Audit View", mechanic: "Shows edits, deleted messages, and moderation actions." },
  { order: 30, id: "smart-thread-summary", category: "Messaging And Threads", name: "Smart Thread Summary", mechanic: "Provides a plain-language recap of long threads." },
  { order: 31, id: "listing-quality-score", category: "Marketplace", name: "Listing Quality Score", mechanic: "Detects missing photos, vague descriptions, risky pricing, and incomplete posts." },
  { order: 32, id: "listing-draft-wizard", category: "Marketplace", name: "Listing Draft Wizard", mechanic: "Guides sellers through a validated post flow." },
  { order: 33, id: "listing-compare-tray", category: "Marketplace", name: "Listing Compare Tray", mechanic: "Compares saved listings side-by-side." },
  { order: 34, id: "seller-verification-badge-panel", category: "Marketplace", name: "Seller Verification Badge Panel", mechanic: "Shows seller trust, sales, disputes, and response time." },
  { order: 35, id: "offer-negotiation-room", category: "Marketplace", name: "Offer Negotiation Room", mechanic: "Structures offers, counters, expirations, and acceptance." },
  { order: 36, id: "listing-fraud-signals", category: "Marketplace", name: "Listing Fraud Signals", mechanic: "Flags duplicate images, suspicious price, new accounts, and repeated reports." },
  { order: 37, id: "saved-listing-collections", category: "Marketplace", name: "Saved Listing Collections", mechanic: "Groups saved listings into user-created folders." },
  { order: 38, id: "marketplace-order-timeline", category: "Marketplace", name: "Marketplace Order Timeline", mechanic: "Tracks offer, payment, fulfillment, review, and dispute steps." },
  { order: 39, id: "pickup-or-delivery-selector", category: "Marketplace", name: "Pickup Or Delivery Selector", mechanic: "Chooses local pickup, shipping, or event handoff." },
  { order: 40, id: "listing-performance-dashboard", category: "Marketplace", name: "Listing Performance Dashboard", mechanic: "Tracks listing views, saves, messages, and conversion." },
  { order: 41, id: "merchant-dashboard-home", category: "MerchantOS", name: "Merchant Dashboard Home", mechanic: "Provides one landing room for merchant health." },
  { order: 42, id: "merchant-setup-wizard", category: "MerchantOS", name: "Merchant Setup Wizard", mechanic: "Walks through profile, KYB, bank, QR, settlement, tax, and review setup." },
  { order: 43, id: "merchant-storefront-editor", category: "MerchantOS", name: "Merchant Storefront Editor", mechanic: "Edits merchant name, hours, location, categories, and policies." },
  { order: 44, id: "merchant-qr-kit-builder", category: "MerchantOS", name: "Merchant QR Kit Builder", mechanic: "Builds printable or display-ready QR checkout cards." },
  { order: 45, id: "terminal-health-board", category: "MerchantOS", name: "Terminal Health Board", mechanic: "Tracks live, degraded, offline, limited, and review terminal states." },
  { order: 46, id: "settlement-calendar", category: "MerchantOS", name: "Settlement Calendar", mechanic: "Shows payout windows by day, week, and month." },
  { order: 47, id: "payout-reserve-manager", category: "MerchantOS", name: "Payout Reserve Manager", mechanic: "Manages reserve percent, hold reason, and next release date." },
  { order: 48, id: "chargeback-evidence-builder", category: "MerchantOS", name: "Chargeback Evidence Builder", mechanic: "Compiles receipts, chat history, delivery proof, and policy text." },
  { order: 49, id: "merchant-risk-queue", category: "MerchantOS", name: "Merchant Risk Queue", mechanic: "Orders merchants by risk score and next action." },
  { order: 50, id: "merchant-compliance-checklist", category: "MerchantOS", name: "Merchant Compliance Checklist", mechanic: "Tracks KYB, OFAC, tax, bank, and owner verification." },
  { order: 51, id: "wallet-command-center", category: "Wallet And Payments", name: "Wallet Command Center", mechanic: "Shows balance, holds, pending payments, disputes, and payouts." },
  { order: 52, id: "payment-intent-tracker", category: "Wallet And Payments", name: "Payment Intent Tracker", mechanic: "Tracks created, authorized, captured, failed, and refunded payments." },
  { order: 53, id: "refund-workflow", category: "Wallet And Payments", name: "Refund Workflow", mechanic: "Handles partial or full refunds with reason and audit entry." },
  { order: 54, id: "escrow-milestone-builder", category: "Wallet And Payments", name: "Escrow Milestone Builder", mechanic: "Splits payment by deliverables." },
  { order: 55, id: "payment-limits-dashboard", category: "Wallet And Payments", name: "Payment Limits Dashboard", mechanic: "Shows daily and monthly limits by trust tier." },
  { order: 56, id: "suspicious-wallet-activity-panel", category: "Wallet And Payments", name: "Suspicious Wallet Activity Panel", mechanic: "Flags velocity, repeated failures, and new-device activity." },
  { order: 57, id: "split-payment-room", category: "Wallet And Payments", name: "Split Payment Room", mechanic: "Coordinates multiple payers, merchant closeout, and balances." },
  { order: 58, id: "wallet-statement-export", category: "Wallet And Payments", name: "Wallet Statement Export", mechanic: "Exports CSV or PDF transaction reports." },
  { order: 59, id: "tax-report-generator", category: "Wallet And Payments", name: "Tax Report Generator", mechanic: "Generates annual payment summaries for users and merchants." },
  { order: 60, id: "payout-method-manager", category: "Wallet And Payments", name: "Payout Method Manager", mechanic: "Manages bank, debit, pending verification, and disabled payout methods." },
  { order: 61, id: "compliance-home-room", category: "Compliance And Safety", name: "Compliance Home Room", mechanic: "Groups all controls by framework and owner." },
  { order: 62, id: "policy-version-tracker", category: "Compliance And Safety", name: "Policy Version Tracker", mechanic: "Tracks terms, privacy, DMCA, and community standards history." },
  { order: 63, id: "consent-receipt-ledger", category: "Compliance And Safety", name: "Consent Receipt Ledger", mechanic: "Records acceptance of terms, privacy, cookies, and marketing." },
  { order: 64, id: "age-gate-review-queue", category: "Compliance And Safety", name: "Age Gate Review Queue", mechanic: "Flags underage risk and incomplete date-of-birth checks." },
  { order: 65, id: "child-safety-escalation-panel", category: "Compliance And Safety", name: "Child Safety Escalation Panel", mechanic: "Provides high-priority reporting and restriction workflow." },
  { order: 66, id: "dmca-intake-form", category: "Compliance And Safety", name: "DMCA Intake Form", mechanic: "Structures notices, counter-notices, evidence, and status." },
  { order: 67, id: "legal-hold-manager", category: "Compliance And Safety", name: "Legal Hold Manager", mechanic: "Preserves records for disputes or investigations." },
  { order: 68, id: "data-deletion-request-workflow", category: "Compliance And Safety", name: "Data Deletion Request Workflow", mechanic: "Handles privacy deletion requests and audit records." },
  { order: 69, id: "blocked-entity-list", category: "Compliance And Safety", name: "Blocked Entity List", mechanic: "Tracks banned users, merchants, devices, and payout methods." },
  { order: 70, id: "jurisdiction-rules-matrix", category: "Compliance And Safety", name: "Jurisdiction Rules Matrix", mechanic: "Connects federal, state, city, and local notes to relevant workflows." },
  { order: 71, id: "operator-home", category: "Operator And Admin", name: "Operator Home", mechanic: "Summarizes queue counts, urgent items, and recent actions." },
  { order: 72, id: "case-management-room", category: "Operator And Admin", name: "Case Management Room", mechanic: "Unifies disputes, reports, verifications, and merchant holds." },
  { order: 73, id: "case-assignment-board", category: "Operator And Admin", name: "Case Assignment Board", mechanic: "Tracks owner, SLA, severity, and due date." },
  { order: 74, id: "sla-timer", category: "Operator And Admin", name: "SLA Timer", mechanic: "Counts down support, dispute, DMCA, and safety deadlines." },
  { order: 75, id: "operator-notes", category: "Operator And Admin", name: "Operator Notes", mechanic: "Stores private notes on profiles, merchants, and cases." },
  { order: 76, id: "bulk-action-review", category: "Operator And Admin", name: "Bulk Action Review", mechanic: "Approves, holds, or closes multiple cases with confirmation." },
  { order: 77, id: "admin-audit-explorer", category: "Operator And Admin", name: "Admin Audit Explorer", mechanic: "Searches audit records by actor, target, and action." },
  { order: 78, id: "role-and-permission-manager", category: "Operator And Admin", name: "Role And Permission Manager", mechanic: "Grants and revokes operator and admin scopes." },
  { order: 79, id: "impersonation-safe-support-view", category: "Operator And Admin", name: "Impersonation-Safe Support View", mechanic: "Allows support inspection without acting as the user." },
  { order: 80, id: "system-health-room", category: "Operator And Admin", name: "System Health Room", mechanic: "Shows Firebase, auth, hosting, connector, and payment status." },
  { order: 81, id: "mini-app-store", category: "Mini-Programs And Services", name: "Mini-App Store", mechanic: "Browses available mini-programs by category." },
  { order: 82, id: "mini-app-permission-review", category: "Mini-Programs And Services", name: "Mini-App Permission Review", mechanic: "Approves or rejects requested mini-program scopes." },
  { order: 83, id: "mini-app-runtime-inspector", category: "Mini-Programs And Services", name: "Mini-App Runtime Inspector", mechanic: "Shows live sessions, events, errors, and last launch." },
  { order: 84, id: "mini-app-sandbox-mode", category: "Mini-Programs And Services", name: "Mini-App Sandbox Mode", mechanic: "Tests apps without touching live wallet or profile data." },
  { order: 85, id: "mini-app-return-path-tester", category: "Mini-Programs And Services", name: "Mini-App Return Path Tester", mechanic: "Confirms users return to the correct thread or room." },
  { order: 86, id: "service-recipe-builder", category: "Mini-Programs And Services", name: "Service Recipe Builder", mechanic: "Combines route, payment, message, merchant, and checklist steps." },
  { order: 87, id: "service-continuity-shelf", category: "Mini-Programs And Services", name: "Service Continuity Shelf", mechanic: "Resumes abandoned service flows." },
  { order: 88, id: "service-health-badges", category: "Mini-Programs And Services", name: "Service Health Badges", mechanic: "Marks services as ready, missing permission, connector required, or review." },
  { order: 89, id: "local-utility-directory", category: "Mini-Programs And Services", name: "Local Utility Directory", mechanic: "Organizes route, QR, safety, merchant, event, and contact utilities." },
  { order: 90, id: "mini-app-error-queue", category: "Mini-Programs And Services", name: "Mini-App Error Queue", mechanic: "Collects failed launches, permission denials, and event failures." },
  { order: 91, id: "unified-result-types", category: "Discovery, Search, And Intelligence", name: "Unified Result Types", mechanic: "Normalizes people, listings, merchants, threads, services, and documents." },
  { order: 92, id: "search-filters-panel", category: "Discovery, Search, And Intelligence", name: "Search Filters Panel", mechanic: "Filters by type, trust, city, status, date, and owner." },
  { order: 93, id: "search-result-actions", category: "Discovery, Search, And Intelligence", name: "Search Result Actions", mechanic: "Runs message, save, pay, open case, verify, or report actions from results." },
  { order: 94, id: "recommendation-reason-cards", category: "Discovery, Search, And Intelligence", name: "Recommendation Reason Cards", mechanic: "Explains why a person, listing, or service is suggested." },
  { order: 95, id: "saved-search-rooms", category: "Discovery, Search, And Intelligence", name: "Saved Search Rooms", mechanic: "Turns saved searches into live rooms." },
  { order: 96, id: "trend-board", category: "Discovery, Search, And Intelligence", name: "Trend Board", mechanic: "Shows rising searches, merchant demand, and local service demand." },
  { order: 97, id: "demand-signal-inbox", category: "Discovery, Search, And Intelligence", name: "Demand Signal Inbox", mechanic: "Groups user requests into actionable opportunities." },
  { order: 98, id: "user-segment-dashboard", category: "Discovery, Search, And Intelligence", name: "User Segment Dashboard", mechanic: "Summarizes creators, merchants, hosts, buyers, and operators." },
  { order: 99, id: "cross-surface-analytics", category: "Discovery, Search, And Intelligence", name: "Cross-Surface Analytics", mechanic: "Tracks journeys across chat, market, wallet, and services." },
  { order: 100, id: "feature-adoption-board", category: "Discovery, Search, And Intelligence", name: "Feature Adoption Board", mechanic: "Shows which rooms and features users actually use." },
  { order: 101, id: "secure-account-baseline", category: "Profile And Identity", name: "Secure Account Baseline", mechanic: "Checks passkeys, recovery email, phone status, device history, and profile risk before sensitive actions." },
  { order: 102, id: "family-account-roles", category: "Profile And Identity", name: "Family Account Roles", mechanic: "Separates parent, teen, caregiver, household, and business delegate access without merging profiles." },
  { order: 103, id: "trusted-device-approval", category: "Profile And Identity", name: "Trusted Device Approval", mechanic: "Requires step-up review when a new device touches wallet, merchant, or admin surfaces." },
  { order: 104, id: "account-recovery-war-room", category: "Profile And Identity", name: "Account Recovery War Room", mechanic: "Groups recovery proof, device revocation, support notes, and user status in one path." },
  { order: 105, id: "identity-risk-explainer", category: "Profile And Identity", name: "Identity Risk Explainer", mechanic: "Shows plain-language reasons behind verification holds, limits, and requested documents." },
  { order: 106, id: "profile-merge-review", category: "Profile And Identity", name: "Profile Merge Review", mechanic: "Detects duplicate accounts and stages a human-safe merge or separation review." },
  { order: 107, id: "delegated-access-keys", category: "Profile And Identity", name: "Delegated Access Keys", mechanic: "Issues scoped access for assistants, staff, parents, or managers with expiration and audit trails." },
  { order: 108, id: "creator-merchant-identity-link", category: "Profile And Identity", name: "Creator Merchant Identity Link", mechanic: "Connects creator profiles to storefronts, payout records, bookings, and public proof." },
  { order: 109, id: "profile-readiness-roadmap", category: "Profile And Identity", name: "Profile Readiness Roadmap", mechanic: "Turns missing profile work into ordered steps for chat, listings, wallet, and merchant readiness." },
  { order: 110, id: "sensitive-action-step-up", category: "Profile And Identity", name: "Sensitive Action Step-Up", mechanic: "Asks for extra confirmation before payout changes, role grants, dispute closure, and account deletion." },
  { order: 111, id: "verification-appeal-desk", category: "Profile And Identity", name: "Verification Appeal Desk", mechanic: "Lets users challenge failed verification with evidence, status, owner, and next review date." },
  { order: 112, id: "identity-consistency-score", category: "Profile And Identity", name: "Identity Consistency Score", mechanic: "Compares profile, merchant, payout, tax, device, and document signals for mismatch risk." },
  { order: 113, id: "high-risk-payment-hold", category: "Wallet And Payments", name: "High-Risk Payment Hold", mechanic: "Places risky payments into review with reason codes, release options, and notification steps." },
  { order: 114, id: "bill-pay-autopay-manager", category: "Wallet And Payments", name: "Bill Pay Autopay Manager", mechanic: "Schedules repeating utility, rent, insurance, and mobile payments with funding checks." },
  { order: 115, id: "escrow-release-approval", category: "Wallet And Payments", name: "Escrow Release Approval", mechanic: "Requires buyer, seller, or operator confirmation before releasing milestone funds." },
  { order: 116, id: "wallet-funding-router", category: "Wallet And Payments", name: "Wallet Funding Router", mechanic: "Chooses bank, card, balance, or cash-in funding paths based on limits and cost." },
  { order: 117, id: "receipt-dispute-launcher", category: "Wallet And Payments", name: "Receipt Dispute Launcher", mechanic: "Starts a dispute directly from a receipt with linked chat, order, and evidence." },
  { order: 118, id: "merchant-payout-exception-board", category: "Wallet And Payments", name: "Merchant Payout Exception Board", mechanic: "Lists payout failures, bank rejects, reserve holds, and compliance blocks by urgency." },
  { order: 119, id: "split-bill-reconciliation", category: "Wallet And Payments", name: "Split Bill Reconciliation", mechanic: "Settles group balances and highlights unpaid shares, refunds, tips, and merchant closeout." },
  { order: 120, id: "cash-in-cash-out-map", category: "Wallet And Payments", name: "Cash-In Cash-Out Map", mechanic: "Shows nearby cash agents, fees, hours, limits, and safety warnings." },
  { order: 121, id: "tax-form-readiness", category: "Wallet And Payments", name: "Tax Form Readiness", mechanic: "Tracks W-9, 1099, merchant tax profile, thresholds, and export status." },
  { order: 122, id: "payment-method-risk-rules", category: "Wallet And Payments", name: "Payment Method Risk Rules", mechanic: "Scores cards, banks, device changes, retry patterns, and linked account history." },
  { order: 123, id: "subscription-billing-panel", category: "Wallet And Payments", name: "Subscription Billing Panel", mechanic: "Manages recurring mini-app, merchant, creator, and local service subscriptions." },
  { order: 124, id: "wallet-limit-increase-request", category: "Wallet And Payments", name: "Wallet Limit Increase Request", mechanic: "Collects justification and proof for higher transfer, payout, escrow, or bill-pay limits." },
  { order: 125, id: "trust-report-triage", category: "Compliance And Safety", name: "Trust Report Triage", mechanic: "Sorts scams, harassment, impersonation, safety, payment, and listing reports by severity." },
  { order: 126, id: "moderation-evidence-locker", category: "Compliance And Safety", name: "Moderation Evidence Locker", mechanic: "Preserves screenshots, messages, files, listing states, and decision notes for review." },
  { order: 127, id: "community-standards-checker", category: "Compliance And Safety", name: "Community Standards Checker", mechanic: "Maps reported behavior to policy areas and recommended enforcement choices." },
  { order: 128, id: "fraud-ring-link-analysis", category: "Compliance And Safety", name: "Fraud Ring Link Analysis", mechanic: "Connects accounts, devices, listings, payouts, IP patterns, and disputes into risk clusters." },
  { order: 129, id: "seller-buyer-protection-center", category: "Compliance And Safety", name: "Seller Buyer Protection Center", mechanic: "Explains eligibility, deadlines, evidence, holds, refunds, and appeal windows." },
  { order: 130, id: "privacy-request-console", category: "Compliance And Safety", name: "Privacy Request Console", mechanic: "Handles access, correction, export, deletion, and opt-out requests with deadlines." },
  { order: 131, id: "content-safety-precheck", category: "Compliance And Safety", name: "Content Safety Precheck", mechanic: "Reviews marketplace, channel, moment, and mini-app content before risky publishing." },
  { order: 132, id: "sanction-screening-result", category: "Compliance And Safety", name: "Sanction Screening Result", mechanic: "Records screening status, match strength, false positive notes, and escalation owner." },
  { order: 133, id: "incident-severity-ladder", category: "Compliance And Safety", name: "Incident Severity Ladder", mechanic: "Standardizes severity, SLA, escalation path, and required user communication." },
  { order: 134, id: "policy-exception-register", category: "Compliance And Safety", name: "Policy Exception Register", mechanic: "Tracks approved exceptions, expiration dates, owners, and risk acknowledgements." },
  { order: 135, id: "appeal-outcome-ledger", category: "Compliance And Safety", name: "Appeal Outcome Ledger", mechanic: "Keeps appeal decisions, evidence, reviewers, notifications, and final state visible." },
  { order: 136, id: "regulatory-calendar", category: "Compliance And Safety", name: "Regulatory Calendar", mechanic: "Tracks filing dates, policy reviews, data deadlines, and compliance owner tasks." },
  { order: 137, id: "priority-support-lane", category: "Operator And Admin", name: "Priority Support Lane", mechanic: "Surfaces urgent account, payment, safety, and merchant issues ahead of routine tickets." },
  { order: 138, id: "operator-shift-handoff", category: "Operator And Admin", name: "Operator Shift Handoff", mechanic: "Summarizes open cases, blocked queues, incident notes, and next owner at shift change." },
  { order: 139, id: "admin-change-approval", category: "Operator And Admin", name: "Admin Change Approval", mechanic: "Requires second-review approval for role grants, rules changes, and sensitive closures." },
  { order: 140, id: "support-macro-library", category: "Operator And Admin", name: "Support Macro Library", mechanic: "Stores approved responses for payouts, disputes, verification, account recovery, and safety." },
  { order: 141, id: "queue-load-balancer", category: "Operator And Admin", name: "Queue Load Balancer", mechanic: "Moves cases between operators based on severity, SLA, skills, and current workload." },
  { order: 142, id: "case-quality-review", category: "Operator And Admin", name: "Case Quality Review", mechanic: "Reviews closed cases for evidence, tone, policy fit, and outcome consistency." },
  { order: 143, id: "ops-playbook-launcher", category: "Operator And Admin", name: "Ops Playbook Launcher", mechanic: "Opens the right internal checklist for fraud, outage, payout, moderation, or launch issues." },
  { order: 144, id: "operator-permission-audit", category: "Operator And Admin", name: "Operator Permission Audit", mechanic: "Finds stale roles, risky scopes, dormant operators, and missing approvals." },
  { order: 145, id: "bulk-notification-composer", category: "Operator And Admin", name: "Bulk Notification Composer", mechanic: "Prepares segmented user notices for incidents, product changes, payment delays, and policy updates." },
  { order: 146, id: "live-incident-room", category: "Operator And Admin", name: "Live Incident Room", mechanic: "Coordinates outage status, affected features, user messaging, owners, and timeline notes." },
  { order: 147, id: "admin-data-export-center", category: "Operator And Admin", name: "Admin Data Export Center", mechanic: "Packages reports, audit trails, disputes, and compliance exports for authorized staff." },
  { order: 148, id: "operator-training-simulator", category: "Operator And Admin", name: "Operator Training Simulator", mechanic: "Runs practice cases for disputes, fraud, verification, merchant holds, and safety actions." },
  { order: 149, id: "merchant-launch-readiness", category: "MerchantOS", name: "Merchant Launch Readiness", mechanic: "Checks profile, bank, tax, QR, locations, policies, inventory, and support coverage." },
  { order: 150, id: "store-hours-exception-manager", category: "MerchantOS", name: "Store Hours Exception Manager", mechanic: "Handles holiday hours, pop-up schedules, closures, and temporary service changes." },
  { order: 151, id: "merchant-inventory-lite", category: "MerchantOS", name: "Merchant Inventory Lite", mechanic: "Tracks simple stock, low-count alerts, service availability, and sold-out states." },
  { order: 152, id: "local-deal-campaign-builder", category: "MerchantOS", name: "Local Deal Campaign Builder", mechanic: "Creates offers by radius, audience, time window, budget, and redemption limit." },
  { order: 153, id: "customer-follow-up-queue", category: "MerchantOS", name: "Customer Follow-Up Queue", mechanic: "Prompts merchants to reply, send receipts, request reviews, or resolve open requests." },
  { order: 154, id: "merchant-staff-access", category: "MerchantOS", name: "Merchant Staff Access", mechanic: "Gives staff limited roles for orders, messages, QR, refunds, inventory, and analytics." },
  { order: 155, id: "service-menu-builder", category: "MerchantOS", name: "Service Menu Builder", mechanic: "Builds service lists with prices, deposits, durations, policies, and booking notes." },
  { order: 156, id: "merchant-review-response-desk", category: "MerchantOS", name: "Merchant Review Response Desk", mechanic: "Lets merchants respond to reviews, flag abuse, and request operator review." },
  { order: 157, id: "qr-table-map", category: "MerchantOS", name: "QR Table Map", mechanic: "Maps QR codes to tables, booths, counters, pop-up stations, and staff owners." },
  { order: 158, id: "merchant-cash-closeout", category: "MerchantOS", name: "Merchant Cash Closeout", mechanic: "Reconciles cash notes, QR sales, refunds, tips, deposits, and shift totals." },
  { order: 159, id: "vendor-onboarding-packet", category: "MerchantOS", name: "Vendor Onboarding Packet", mechanic: "Packages event vendor docs, payout readiness, stall assignment, menu, and compliance proof." },
  { order: 160, id: "merchant-health-benchmark", category: "MerchantOS", name: "Merchant Health Benchmark", mechanic: "Compares merchant response, conversion, disputes, payout health, and repeat customers." },
  { order: 161, id: "listing-photo-checker", category: "Marketplace", name: "Listing Photo Checker", mechanic: "Flags missing angles, blurry images, duplicate photos, and unsafe visual claims." },
  { order: 162, id: "market-price-sanity-check", category: "Marketplace", name: "Market Price Sanity Check", mechanic: "Compares price, category, condition, location, and fraud signals before publishing." },
  { order: 163, id: "offer-expiration-manager", category: "Marketplace", name: "Offer Expiration Manager", mechanic: "Handles active, expired, accepted, countered, withdrawn, and disputed offers." },
  { order: 164, id: "local-delivery-proof", category: "Marketplace", name: "Local Delivery Proof", mechanic: "Captures pickup photo, drop-off note, courier identity, and buyer confirmation." },
  { order: 165, id: "seller-response-score", category: "Marketplace", name: "Seller Response Score", mechanic: "Measures reply time, no-shows, completed orders, refunds, and dispute outcomes." },
  { order: 166, id: "market-bundle-builder", category: "Marketplace", name: "Market Bundle Builder", mechanic: "Groups listings into bundles, kits, event packages, or service add-ons." },
  { order: 167, id: "safe-meetup-planner", category: "Marketplace", name: "Safe Meetup Planner", mechanic: "Suggests public meetup spots, time windows, safety notes, and contact sharing." },
  { order: 168, id: "buyer-intent-board", category: "Marketplace", name: "Buyer Intent Board", mechanic: "Lets buyers post wanted items, budgets, timing, and trusted seller preferences." },
  { order: 169, id: "listing-renewal-scheduler", category: "Marketplace", name: "Listing Renewal Scheduler", mechanic: "Prompts renew, archive, discount, boost, or update actions for stale listings." },
  { order: 170, id: "marketplace-review-request", category: "Marketplace", name: "Marketplace Review Request", mechanic: "Asks buyers and sellers for reviews after payment, pickup, delivery, or dispute closure." },
  { order: 171, id: "category-demand-heatmap", category: "Marketplace", name: "Category Demand Heatmap", mechanic: "Shows demand by category, city, price band, and recent search volume." },
  { order: 172, id: "service-job-board", category: "Marketplace", name: "Service Job Board", mechanic: "Turns user requests into open jobs with quote, schedule, proof, and payment status." },
  { order: 173, id: "thread-translation-helper", category: "Messaging And Threads", name: "Thread Translation Helper", mechanic: "Adds translated summaries and reply drafts while preserving original messages." },
  { order: 174, id: "voice-note-transcript", category: "Messaging And Threads", name: "Voice Note Transcript", mechanic: "Turns voice notes into searchable text with sender, timestamp, and confidence labels." },
  { order: 175, id: "thread-decision-log", category: "Messaging And Threads", name: "Thread Decision Log", mechanic: "Captures agreements, approvals, due dates, price changes, and dispute-relevant decisions." },
  { order: 176, id: "group-poll-planner", category: "Messaging And Threads", name: "Group Poll Planner", mechanic: "Creates polls for time, place, budget, vendor, playlist, menu, or pickup choices." },
  { order: 177, id: "thread-payment-request", category: "Messaging And Threads", name: "Thread Payment Request", mechanic: "Attaches payment requests, deposits, holds, and receipts to conversation context." },
  { order: 178, id: "message-risk-nudge", category: "Messaging And Threads", name: "Message Risk Nudge", mechanic: "Warns users before sharing codes, moving off-platform, or accepting risky payment terms." },
  { order: 179, id: "group-role-badges", category: "Messaging And Threads", name: "Group Role Badges", mechanic: "Labels hosts, sellers, buyers, staff, moderators, vendors, and operators inside group chats." },
  { order: 180, id: "thread-file-expiration", category: "Messaging And Threads", name: "Thread File Expiration", mechanic: "Sets file retention, download expiry, access scope, and evidence preservation state." },
  { order: 181, id: "scheduled-message-send", category: "Messaging And Threads", name: "Scheduled Message Send", mechanic: "Queues announcements, reminders, booking follow-ups, and payment nudges for later." },
  { order: 182, id: "circle-introduction-card", category: "Messaging And Threads", name: "Circle Introduction Card", mechanic: "Creates trusted introductions with context, purpose, limits, and mutual contacts." },
  { order: 183, id: "unread-priority-sorter", category: "Messaging And Threads", name: "Unread Priority Sorter", mechanic: "Ranks unread threads by payment, booking, safety, merchant, and personal urgency." },
  { order: 184, id: "thread-cleanup-assistant", category: "Messaging And Threads", name: "Thread Cleanup Assistant", mechanic: "Suggests archiving, pinning, task extraction, file cleanup, and stale follow-ups." },
  { order: 185, id: "mini-app-template-gallery", category: "Mini-Programs And Services", name: "Mini-App Template Gallery", mechanic: "Offers starter templates for booking, menu, ticketing, quote, checkout, and community apps." },
  { order: 186, id: "mini-app-review-checklist", category: "Mini-Programs And Services", name: "Mini-App Review Checklist", mechanic: "Reviews permissions, data use, wallet access, support contact, and policy readiness." },
  { order: 187, id: "mini-app-version-rollout", category: "Mini-Programs And Services", name: "Mini-App Version Rollout", mechanic: "Stages releases by version, audience, city, merchant, and rollback status." },
  { order: 188, id: "mini-app-crash-log", category: "Mini-Programs And Services", name: "Mini-App Crash Log", mechanic: "Collects launch errors, rejected permissions, slow loads, and failed service calls." },
  { order: 189, id: "mini-app-monetization-setup", category: "Mini-Programs And Services", name: "Mini-App Monetization Setup", mechanic: "Configures subscription, fee, commission, free trial, and merchant-sponsored options." },
  { order: 190, id: "service-request-intake", category: "Mini-Programs And Services", name: "Service Request Intake", mechanic: "Captures problem, photos, location, budget, schedule, contact preference, and proof needs." },
  { order: 191, id: "booking-calendar-bridge", category: "Mini-Programs And Services", name: "Booking Calendar Bridge", mechanic: "Connects availability, deposits, reminders, reschedules, and cancellation policy into one flow." },
  { order: 192, id: "quote-comparison-table", category: "Mini-Programs And Services", name: "Quote Comparison Table", mechanic: "Compares provider quote, scope, schedule, warranty, trust, and payment terms." },
  { order: 193, id: "provider-route-scheduler", category: "Mini-Programs And Services", name: "Provider Route Scheduler", mechanic: "Orders jobs by address, time window, service type, proof needs, and urgency." },
  { order: 194, id: "service-proof-capture", category: "Mini-Programs And Services", name: "Service Proof Capture", mechanic: "Collects before, during, after, signature, receipt, and warranty proof for jobs." },
  { order: 195, id: "mini-app-permission-diff", category: "Mini-Programs And Services", name: "Mini-App Permission Diff", mechanic: "Shows permission changes between app versions before users or reviewers approve." },
  { order: 196, id: "service-provider-scorecard", category: "Mini-Programs And Services", name: "Service Provider Scorecard", mechanic: "Summarizes arrival, completion, proof quality, reviews, refunds, and repeat bookings." },
  { order: 197, id: "universal-command-search", category: "Discovery, Search, And Intelligence", name: "Universal Command Search", mechanic: "Finds people, rooms, actions, listings, receipts, cases, and services from one command entry." },
  { order: 198, id: "nearby-demand-radar", category: "Discovery, Search, And Intelligence", name: "Nearby Demand Radar", mechanic: "Highlights local demand for gigs, services, food, rides, venues, and merchant offers." },
  { order: 199, id: "recommendation-feedback-loop", category: "Discovery, Search, And Intelligence", name: "Recommendation Feedback Loop", mechanic: "Lets users explain bad recommendations and improve future matching signals." },
  { order: 200, id: "saved-context-timeline", category: "Discovery, Search, And Intelligence", name: "Saved Context Timeline", mechanic: "Shows saved chats, listings, routes, receipts, documents, and services in chronological order." },
  { order: 201, id: "local-trend-alerts", category: "Discovery, Search, And Intelligence", name: "Local Trend Alerts", mechanic: "Notifies operators and merchants when searches, demand, incidents, or deals spike nearby." },
  { order: 202, id: "search-quality-review", category: "Discovery, Search, And Intelligence", name: "Search Quality Review", mechanic: "Audits zero-result searches, bad matches, missing categories, and high-demand gaps." },
  { order: 203, id: "city-launch-scoreboard", category: "Discovery, Search, And Intelligence", name: "City Launch Scoreboard", mechanic: "Tracks city readiness by users, merchants, services, incidents, payments, and engagement." },
  { order: 204, id: "creator-opportunity-matcher", category: "Discovery, Search, And Intelligence", name: "Creator Opportunity Matcher", mechanic: "Matches creators to brands, venues, gigs, ticket drops, and local services." },
  { order: 205, id: "merchant-opportunity-matcher", category: "Discovery, Search, And Intelligence", name: "Merchant Opportunity Matcher", mechanic: "Matches merchants to demand signals, events, offers, creators, and service gaps." },
  { order: 206, id: "smart-notification-digest", category: "Discovery, Search, And Intelligence", name: "Smart Notification Digest", mechanic: "Bundles low-priority updates into plain-language summaries by room and urgency." },
  { order: 207, id: "intent-capture-chip", category: "Discovery, Search, And Intelligence", name: "Intent Capture Chip", mechanic: "Turns repeated searches and taps into declared buying, booking, hiring, or selling intent." },
  { order: 208, id: "cross-room-recommendation-map", category: "Discovery, Search, And Intelligence", name: "Cross-Room Recommendation Map", mechanic: "Explains how chat, wallet, marketplace, services, and profile context affect suggestions." },
  { order: 209, id: "mobile-safe-area-auditor", category: "Navigation And Architecture", name: "Mobile Safe Area Auditor", mechanic: "Checks bottom nav, keyboard, modal, and device notch spacing across mobile shells." },
  { order: 210, id: "offline-mode-banner", category: "Navigation And Architecture", name: "Offline Mode Banner", mechanic: "Shows when actions are queued, stale, synced, failed, or safe to retry." },
  { order: 211, id: "route-health-monitor", category: "Navigation And Architecture", name: "Route Health Monitor", mechanic: "Checks public, signed-in, mobile, admin, and mini-app routes for broken surfaces." },
  { order: 212, id: "first-run-tour-manager", category: "Navigation And Architecture", name: "First Run Tour Manager", mechanic: "Guides new users through chats, services, wallet, profile, and local discovery in order." },
  { order: 213, id: "room-density-switch", category: "Navigation And Architecture", name: "Room Density Switch", mechanic: "Lets users choose compact, comfortable, or presentation density across data-heavy rooms." },
  { order: 214, id: "accessibility-review-panel", category: "Navigation And Architecture", name: "Accessibility Review Panel", mechanic: "Checks keyboard paths, labels, contrast, focus state, text wrapping, and motion preferences." },
  { order: 215, id: "desktop-mobile-parity-check", category: "Navigation And Architecture", name: "Desktop Mobile Parity Check", mechanic: "Compares key actions across desktop web, mobile web, Android, iOS, and desktop shell." },
  { order: 216, id: "deep-link-recovery-handler", category: "Navigation And Architecture", name: "Deep Link Recovery Handler", mechanic: "Routes expired, blocked, or signed-out deep links to a useful recovery path." },
  { order: 217, id: "notification-permission-coach", category: "Navigation And Architecture", name: "Notification Permission Coach", mechanic: "Explains browser and native notification value before asking for system permission." },
  { order: 218, id: "install-prompt-manager", category: "Navigation And Architecture", name: "Install Prompt Manager", mechanic: "Shows PWA, Android, iOS, and desktop install paths at the right time." },
  { order: 219, id: "release-notes-room", category: "Navigation And Architecture", name: "Release Notes Room", mechanic: "Presents user-facing changes, known issues, fixes, and new rooms after each release." },
  { order: 220, id: "foundation-readiness-checklist", category: "Navigation And Architecture", name: "Foundation Readiness Checklist", mechanic: "Tracks whether auth, data, payments, safety, deployment, docs, and smoke tests are ready." }
];

export const walletEvents = [
  { id: 1, title: "Creator payout", amount: "+$240.00", meta: "Sunday rooftop set" },
  { id: 2, title: "Peer transfer", amount: "-$18.40", meta: "Brunch with Tia" },
  { id: 3, title: "Merchant reward", amount: "+$4.00", meta: "FoxHub Card reward" }
];

export const moments = [
  {
    id: 1,
    author: "Nova Reyes",
    handle: "@nova",
    text: "Atlanta creators are already using private circles to coordinate pop-ups faster than Instagram DMs.",
    meta: "12 min ago",
    stats: "34 reacts · 9 replies",
    postedAt: "2026-03-30T12:00:00Z",
    reactions: { like: 24, love: 7, haha: 3 },
    myReaction: "",
    comments: [
      { id: "m1-c1", author: "Isa", text: "This flow is way faster than juggling multiple apps.", time: "9m ago" }
    ]
  },
  {
    id: 2,
    author: "Tia Brooks",
    handle: "@tia",
    text: "If SplitTab launches with merchant QR kits, nightlife adoption gets much easier.",
    meta: "46 min ago",
    stats: "21 reacts · 4 reposts",
    postedAt: "2026-03-25T09:45:00Z",
    reactions: { like: 12, love: 6, haha: 0 },
    myReaction: "",
    comments: []
  }
];

export const channels = [
  { id: "ops", name: "FoxHub Ops", summary: "product, trust, infra", cadence: "7 posts today" },
  { id: "atl-live", name: "ATL Live", summary: "events and city drops", cadence: "3 live updates" },
  { id: "money", name: "Wallet Watch", summary: "merchant pilots and payouts", cadence: "2 alerts" }
];

export const peopleNearby = [
  { id: "nearby-nova", contactId: "nova", name: "Nova Reyes", handle: "@nova", city: "Atlanta", region: "GA", zipCode: "30303", distance: "0.4 miles", presence: "Online", activity: "Just posted Moments", trust: "AA" },
  { id: "nearby-isa", contactId: "isa", name: "Isa Moore", handle: "@isamoore", city: "Miami", region: "FL", zipCode: "33139", distance: "1.1 miles", presence: "Focus", activity: "Verified DJ set tonight", trust: "C" },
  { id: "nearby-tia", contactId: "tia", name: "Tia Brooks", handle: "@tia", city: "Miami", region: "FL", zipCode: "33139", distance: "1.7 miles", presence: "Online", activity: "Hosts merchant drop", trust: "AA" },
  { id: "nearby-marcus", contactId: "marcus", name: "Marcus Lee", handle: "@mlee", city: "Austin", region: "TX", zipCode: "78701", distance: "2.4 miles", presence: "Available", activity: "Onboarding hosts", trust: "A" }
];

export const channelStreams = [
  { id: "channel-ops", title: "FoxHub Ops Live", host: "Nova Reyes", viewers: "1.2k", status: "Broadcasting now", contactId: "nova" },
  { id: "channel-wallet", title: "Wallet Watchstream", host: "Tia Brooks", viewers: "860", status: "Premiere 5m", contactId: "tia" },
  { id: "channel-music", title: "Miami Hosts Lounge", host: "Isa Moore", viewers: "430", status: "Starting soon", contactId: "isa" }
];

export const shakeMatches = [
  { id: "shake-1", name: "Nova Reyes", handle: "@nova", matchNote: "Shared a recent rooftop set", trust: "verified" },
  { id: "shake-2", name: "Tia Brooks", handle: "@tia", matchNote: "Looking for curated merchandise help", trust: "trusted" },
  { id: "shake-3", name: "Marcus Lee", handle: "@mlee", matchNote: "Operator offering guidance", trust: "advisor" }
];

export const fileTransfers = [
  { id: "file-1", title: "Rooftop Rider Contract", recipient: "Isa Moore", status: "Delivered", meta: "Just now" },
  { id: "file-2", title: "Venue Access Docs", recipient: "Nova Reyes", status: "In review", meta: "13m ago" }
];

export const localListings = [
  { id: "local-1", title: "Nightlife Popup Crew", region: "Miami", price: 420, flagged: true, flaggedReason: "Duplicate listing", status: "Under review", modNote: "" },
  { id: "local-2", title: "Private Studio Space", region: "Atlanta", price: 680, flagged: false, flaggedReason: "", status: "Active", modNote: "Approved with insurance" }
];

export const creatorOrders = [
  { id: "order-1", title: "Custom DJ Package", buyer: "@venueOp", status: "Preparing", note: "Need rider confirmation" },
  { id: "order-2", title: "Host experience kit", buyer: "@cityHost", status: "Awaiting approval", note: "Missing ID docs" }
];

export const demandSignals = [
  { id: "signal-1", region: "Miami", demand: "High", capacity: "3 gigs open", note: "Nightlife + private labels" },
  { id: "signal-2", region: "Atlanta", demand: "Moderate", capacity: "5 gigs open", note: "Brunch/pop-up demand surged" }
];

export const storyHighlights = [
  { id: "story-1", title: "Rooftop showcase", author: "Tia Brooks", summary: "Refined sets for high-energy lounges.", timestamp: "2h ago", tag: "Reel" },
  { id: "story-2", title: "City takeover", author: "Nova Reyes", summary: "Curated host walkthrough + crew meet.", timestamp: "6h ago", tag: "Story" }
];

export const reviewInsights = [
  { id: "review-1", aspect: "Service", score: 92, meta: "70 Voices analyzed" },
  { id: "review-2", aspect: "Trust", score: 88, meta: "Verified performers" },
  { id: "review-3", aspect: "Value", score: 85, meta: "Rate per experience" }
];

export const shortVideos = [
  {
    id: "clip-1",
    title: "Night market teaser",
    creatorId: "tia",
    durationSec: 18,
    caption: "Tonight's merchant crawl route and creator lineup.",
    status: "published",
    views: 1240,
    likes: 138,
    postedAt: "2026-04-02T22:15:00Z"
  }
];

export const storyBundles = [
  {
    id: "bundle-1",
    ownerId: "nova",
    title: "Atlanta drop day",
    frames: 4,
    expiresAt: "2026-04-04T10:00:00Z",
    viewedBy: ["tia"],
    status: "live"
  }
];

export const auctionLots = [
  {
    id: "lot-1",
    listingId: "listing-1",
    title: "FoxHub launch cap set",
    sellerId: "nova",
    startingBid: 180,
    currentBid: 240,
    bidCount: 3,
    reserveMet: true,
    endsAt: "2026-04-06T22:00:00Z",
    status: "live"
  }
];

export const bidEvents = [
  {
    id: "bid-1",
    lotId: "lot-1",
    bidderId: "tia",
    amount: 240,
    currency: "USD",
    placedAt: "2026-04-03T08:10:00Z",
    status: "leading"
  }
];

export const carts = [
  {
    id: "cart-1",
    ownerId: "self",
    itemCount: 2,
    subtotal: 388,
    currency: "USD",
    status: "active",
    items: [
      { sku: "fox-cap-drop", title: "Launch cap", qty: 1, unitPrice: 340 },
      { sku: "event-pass-fastlane", title: "Fast-lane pass", qty: 1, unitPrice: 48 }
    ]
  }
];

export const fulfillmentOrders = [
  {
    id: "fulfill-1",
    cartId: "cart-1",
    carrier: "Local courier",
    trackingLabel: "FH-ATL-2044",
    eta: "Tomorrow by 6 PM",
    status: "packing"
  }
];

export const shopProfiles = [
  {
    id: "shop-1",
    ownerId: "nova",
    name: "South Loop Goods",
    headline: "Small-batch creator merch and event kits.",
    followers: 482,
    favorites: 930,
    rating: 4.8,
    reviewCount: 76
  }
];

export const shopReviews = [
  {
    id: "shop-review-1",
    shopId: "shop-1",
    author: "Tia Brooks",
    rating: 5,
    title: "Fast handoff and great finish",
    body: "Packaging was solid and the seller stayed responsive through delivery.",
    createdAt: "2026-04-02T18:20:00Z"
  }
];

export const ratingRecords = [
  {
    id: "rating-contact-1",
    targetType: "contact",
    targetId: "nova",
    actorId: "self",
    actorLabel: "Current user",
    rating: 5,
    trustTier: "AA",
    title: "Reliable operator",
    body: "Fast follow-through and strong city coordination.",
    status: "published",
    moderationStatus: "clear",
    createdAt: "2026-04-02T18:10:00Z"
  },
  {
    id: "rating-contact-2",
    targetType: "contact",
    targetId: "isa",
    actorId: "self",
    actorLabel: "Current user",
    rating: 2,
    trustTier: "C",
    title: "Needs follow-through",
    body: "Merchant onboarding is still incomplete.",
    status: "review",
    moderationStatus: "queued",
    createdAt: "2026-04-02T20:05:00Z"
  },
  {
    id: "rating-shop-1",
    targetType: "shop",
    targetId: "shop-1",
    actorId: "tia",
    actorLabel: "Tia Brooks",
    rating: 5,
    trustTier: "AA",
    title: "Fast handoff and great finish",
    body: "Packaging was solid and the seller stayed responsive through delivery.",
    status: "published",
    moderationStatus: "clear",
    createdAt: "2026-04-02T18:20:00Z"
  }
];

export const ratingModerationQueue = [
  {
    id: "rating-mod-1",
    recordId: "rating-contact-2",
    targetType: "contact",
    targetId: "isa",
    reason: "Low rating needs operator review",
    status: "open",
    createdAt: "2026-04-02T20:05:00Z"
  }
];

export const reputationSnapshots = [
  {
    id: "rep-contact-nova",
    targetType: "contact",
    targetId: "nova",
    label: "Nova Reyes",
    averageRating: 4.9,
    ratingCount: 18,
    trustTier: "AA",
    verification: "government id + payout verified",
    lastRatedAt: "2026-04-02T18:10:00Z"
  },
  {
    id: "rep-contact-isa",
    targetType: "contact",
    targetId: "isa",
    label: "Isa Moore",
    averageRating: 2.2,
    ratingCount: 6,
    trustTier: "C",
    verification: "merchant docs pending",
    lastRatedAt: "2026-04-02T20:05:00Z"
  },
  {
    id: "rep-shop-1",
    targetType: "shop",
    targetId: "shop-1",
    label: "South Loop Goods",
    averageRating: 4.8,
    ratingCount: 76,
    trustTier: "AA",
    verification: "storefront verified",
    lastRatedAt: "2026-04-02T18:20:00Z"
  }
];

export const routePlans = [
  {
    id: "route-1",
    name: "Miami merchant crawl",
    origin: "Wynwood",
    destination: "Brickell",
    stops: 4,
    etaMinutes: 32,
    mode: "drive",
    status: "ready"
  }
];

export const professionalIdentities = [
  {
    id: "pro-identity-1",
    contactId: "marcus",
    headline: "Marketplace operations advisor",
    company: "FoxHub Austin",
    experienceYears: 9,
    skills: ["launch ops", "vendor systems", "trust design"],
    verification: "verified operator"
  }
];

export const endorsements = [
  {
    id: "endorse-1",
    fromContactId: "nova",
    toContactId: "marcus",
    skill: "launch ops",
    note: "Helped tighten merchant rollout sequencing.",
    createdAt: "2026-04-01T19:45:00Z"
  }
];

export const jobPosts = [
  {
    id: "job-1",
    title: "City operator, Miami",
    team: "Growth",
    location: "Miami, FL",
    type: "Contract",
    status: "open",
    applicants: 12
  }
];

export const resumeEntries = [
  {
    id: "resume-1",
    contactId: "marcus",
    role: "Operations lead",
    organization: "Launch North",
    period: "2021-2025",
    summary: "Scaled onboarding, payments, and support systems across three launch cities."
  }
];

export const miniProgramManifests = [
  {
    id: "manifest-splittab",
    appId: "splittab",
    version: "1.0.0",
    permissions: ["identity", "wallet", "contacts"],
    events: ["checkout:start", "checkout:complete", "thread:return"],
    status: "signed"
  }
];

export const runtimeSessions = [
  {
    id: "runtime-1",
    appId: "splittab",
    threadId: "miami-hosts",
    state: "warm",
    openedAt: "2026-04-03T08:00:00Z",
    returnTarget: "Miami Hosts"
  }
];

export const callSessions = [
  {
    id: "call-1",
    threadId: "launch-team",
    mode: "voice",
    participants: 4,
    encryptionState: "device keys established",
    status: "ended"
  }
];

export const callLogs = [
  {
    id: "call-log-1",
    threadId: "launch-team",
    summary: "Ops sync call",
    durationSec: 1320,
    endedAt: "2026-04-03T07:40:00Z",
    status: "completed"
  }
];

export const communityChannels = [
  { id: "community-ops", name: "Operations Room", mod: "Nova Reyes", contactId: "nova", members: 128, topic: "Logistics+Security" },
  { id: "community-arts", name: "Creators Lounge", mod: "Tia Brooks", contactId: "tia", members: 93, topic: "Artist collabs" }
];

export const officialAccounts = [
  { id: "foxhub-news", name: "FoxHub Newsroom", type: "service", summary: "product updates, releases, platform notices" },
  { id: "atl-culture", name: "ATL Culture Wire", type: "subscription", summary: "city drops, creators, live events" },
  { id: "wallet-watch", name: "Wallet Watch", type: "service", summary: "merchant onboarding, payment notices, trust updates" }
];

export const officialPosts = [
  {
    id: "post-foxhub-news-1",
    accountId: "foxhub-news",
    accountName: "FoxHub Newsroom",
    title: "Private circles now support trust-gated invites",
    summary: "Invite links can now carry circle and launch context so discovery stays tighter.",
    meta: "Platform note · 14 min ago"
  },
  {
    id: "post-atl-culture-1",
    accountId: "atl-culture",
    accountName: "ATL Culture Wire",
    title: "Friday creator crawl opens with FoxTickets drop",
    summary: "Merchants and hosts can route guest-list access straight from the city channel.",
    meta: "City drop · 27 min ago"
  },
  {
    id: "post-wallet-watch-1",
    accountId: "wallet-watch",
    accountName: "Wallet Watch",
    title: "Merchant QR payouts are settling faster in pilot",
    summary: "Three nightlife groups crossed same-night closeout without leaving chat.",
    meta: "Wallet alert · 42 min ago"
  }
];

export const searchScopes = [
  { id: "messages", name: "Messages", hint: "Find threads, notes, and payment messages" },
  { id: "people", name: "People", hint: "Search contacts, handles, and trusted profiles" },
  { id: "services", name: "Services", hint: "Search mini-apps, utilities, and saved tools" },
  { id: "channels", name: "Channels", hint: "Search broadcasts and official accounts" },
  { id: "merchants", name: "Merchants", hint: "Search merchant operations, settlements, and payout work" }
];

const serviceGroups = [
  {
    type: "Identity",
    surface: "discover",
    items: [
      ["scan", "Scan QR", "Add contact, join circle, or pay merchant."],
      ["oneid-vault", "OneID Vault", "Review your OneID, profile status, access path, and account marker."],
      ["profile-checkup", "Profile Checkup", "Find missing profile details before chats, listings, and services open."],
      ["verification-center", "Verification Center", "Track identity, phone, payout, and merchant review steps."],
      ["invite-pass", "Invite Pass", "Create, redeem, and review priority invite codes."],
      ["trusted-sponsors", "Trusted Sponsors", "See who invited, vouched for, or referred an account."],
      ["account-recovery", "Account Recovery", "Start email, device, and support recovery paths."],
      ["privacy-controls", "Privacy Controls", "Choose profile visibility and local discovery preferences."],
      ["device-sessions", "Device Sessions", "Review signed-in devices and revoke access."],
      ["notification-center", "Notification Center", "Manage alerts for messages, money, services, and reviews."]
    ]
  },
  {
    type: "Money",
    surface: "wallet",
    items: [
      ["merchant", "Pay Merchant", "Jump from chat to checkout in one step."],
      ["utility-bill-pay", "Utility Bill Pay", "Pay electric, gas, water, internet, mobile, rent, insurance, and municipal bills from one FoxHub wallet surface."],
      ["splittab", "SplitTab", "Split group tabs, settle instantly, and keep the receipt in chat."],
      ["wallet-topup", "Wallet Top-Up", "Add funds or prepare a payment before checkout."],
      ["cashout", "Cash Out", "Move available balance toward a bank or payout route."],
      ["payout-setup", "Payout Setup", "Check bank, tax, and payout readiness."],
      ["escrow-hold", "Hold Money Safely", "Create a hold for marketplace, service, or gig work."],
      ["refunds", "Refunds", "Review refunds, reversals, and partial returns."],
      ["disputes", "Disputes", "Open or monitor a payment or order dispute."],
      ["receipts", "Receipts", "Find receipts tied to chats, services, and marketplace orders."],
      ["fees", "Fees And Pricing", "Review service fees, deposits, holds, and release timing."]
    ]
  },
  {
    type: "Market",
    surface: "market",
    items: [
      ["buy-nearby", "Buy Nearby", "Browse local goods, offers, and trusted sellers."],
      ["sell-item", "Sell An Item", "Create a listing with photos, price, location, and chat handoff."],
      ["market-watchlist", "Watchlist", "Save listings and get updates when prices or status change."],
      ["offers", "Offers", "Send, counter, accept, and track marketplace offers."],
      ["pickup-delivery", "Pickup Or Delivery", "Coordinate local pickup, delivery, or event handoff."],
      ["listing-boost", "Boost Listing", "Improve listing quality, photos, and trust signals."],
      ["auction-room", "Auction Room", "Bid, watch lots, and track auction closeout."],
      ["order-tracker", "Order Tracker", "Follow offer, payment, fulfillment, review, and dispute steps."],
      ["seller-trust", "Seller Trust", "Review seller ratings, verification, and dispute history."],
      ["local-alerts", "Listing Alerts", "Get notified when matching listings appear nearby."]
    ]
  },
  {
    type: "Food",
    surface: "discover",
    items: [
      ["food-deals", "Food Deals", "Find nearby specials, claims, and limited-time offers."],
      ["restaurant-qr", "Restaurant QR", "Open menu, pay, tip, and keep the receipt in FoxHub."],
      ["group-dining", "Group Dining", "Plan a table, split a bill, and coordinate arrivals."],
      ["takeout-pickup", "Takeout Pickup", "Track pickup details and message the merchant."],
      ["catering-requests", "Catering Requests", "Request quotes for offices, events, and private groups."],
      ["food-trucks", "Food Trucks", "Find pop-ups, truck routes, and active stops."],
      ["happy-hour", "Happy Hour", "Browse time-sensitive drinks, food, and event deals."],
      ["grocery-help", "Grocery Help", "Post or accept local grocery pickup requests."],
      ["meal-prep", "Meal Prep", "Discover meal-prep sellers and subscription offers."],
      ["kitchen-popups", "Kitchen Pop-Ups", "Find creator food drops, tastings, and private menus."]
    ]
  },
  {
    type: "Events",
    surface: "discover",
    items: [
      ["tickets", "FoxTickets", "Claim drops and manage guest lists."],
      ["event-finder", "Event Finder", "Discover local shows, markets, classes, and meetups."],
      ["guest-list", "Guest List", "Create, join, and manage guest-list drops."],
      ["rsvp-checkin", "RSVP And Check-In", "Track RSVPs, scans, arrivals, and no-shows."],
      ["venue-booking", "Venue Booking", "Request a venue, room, booth, or table."],
      ["promoter-tools", "Promoter Tools", "Run event pages, ticket drops, and audience updates."],
      ["pop-up-planner", "Pop-Up Planner", "Coordinate vendors, creators, inventory, and payments."],
      ["event-staffing", "Event Staffing", "Find hosts, security, DJs, vendors, and cleanup help."],
      ["event-rides", "Event Rides", "Coordinate arrival and pickup around events."],
      ["after-event-recap", "After-Event Recap", "Save photos, payments, attendance, and follow-ups."]
    ]
  },
  {
    type: "Work",
    surface: "market",
    items: [
      ["jobs", "Jobs", "Browse local jobs, part-time work, and business openings."],
      ["gigs", "Gigs", "Find one-time work, creative calls, shifts, and paid tasks."],
      ["post-work", "Post Work", "Post a job, gig, shift, or project request."],
      ["service-quotes", "Service Quotes", "Request quotes from nearby providers."],
      ["resume-card", "Resume Card", "Share a compact profile for jobs, gigs, and referrals."],
      ["endorsements", "Endorsements", "Ask trusted people to vouch for your work."],
      ["availability", "Availability", "Set work hours, booking windows, and response expectations."],
      ["contract-room", "Contract Room", "Track scope, milestones, payments, and changes."],
      ["crew-builder", "Crew Builder", "Assemble a team for events, shoots, moves, or pop-ups."],
      ["work-history", "Work History", "Review completed work, ratings, payouts, and disputes."]
    ]
  },
  {
    type: "Housing",
    surface: "market",
    items: [
      ["housing", "Housing", "Browse rooms, rentals, short stays, and housing requests."],
      ["roommates", "Roommates", "Find roommate matches with trust and city context."],
      ["short-stays", "Short Stays", "Find temporary stays near events, jobs, and neighborhoods."],
      ["moving-help", "Moving Help", "Request movers, trucks, packing, and delivery support."],
      ["storage", "Storage", "Find local storage, lockers, and temporary space."],
      ["cleaning", "Cleaning", "Book home, office, move-out, or event cleanup help."],
      ["repairs", "Repairs", "Find local repair help for home, tech, and small jobs."],
      ["shared-workspace", "Shared Workspace", "Find desks, studios, rooms, and work-friendly places."],
      ["property-services", "Property Services", "Coordinate maintenance, showings, inspections, and vendors."],
      ["neighborhood-fit", "Neighborhood Fit", "Compare areas by people, services, listings, and activity."]
    ]
  },
  {
    type: "Mobility",
    surface: "discover",
    items: [
      ["ride", "RideGrid", "Request shared rides around events and nightlife."],
      ["route-planner", "Route Planner", "Plan saved routes with stops, timing, and handoff notes."],
      ["delivery-run", "Delivery Run", "Request local pickup and drop-off help."],
      ["errand-runner", "Errand Runner", "Post quick errands and coordinate trusted help."],
      ["parking-finder", "Parking Finder", "Save parking notes near events, venues, and businesses."],
      ["pickup-points", "Pickup Points", "Set clear meetup and pickup spots for people or goods."],
      ["airport-help", "Airport Help", "Coordinate airport rides, bags, and pickup timing."],
      ["courier-board", "Courier Board", "Find couriers for documents, packages, and local deliveries."],
      ["fleet-check", "Fleet Check", "Track driver, vehicle, and route readiness for business runs."],
      ["travel-group", "Travel Group", "Coordinate group travel plans, payments, and updates."]
    ]
  },
  {
    type: "Business",
    surface: "discover",
    items: [
      ["merchantops", "MerchantOS", "Run merchant QR, settlements, payouts, and location ops."],
      ["business-profile", "Business Profile", "Set up name, hours, services, policies, and contact paths."],
      ["mini-store", "Mini Store", "Create a simple storefront for products, services, and offers."],
      ["qr-kit", "QR Kit Builder", "Build printable QR checkout and service cards."],
      ["settlements", "Settlements", "Review daily settlement batches and payout windows."],
      ["merchant-risk", "Merchant Risk", "Check risk signals, holds, documents, and disputes."],
      ["customer-inbox", "Customer Inbox", "Manage customer chats, requests, receipts, and follow-ups."],
      ["loyalty", "Loyalty", "Create perks, repeat-customer offers, and local rewards."],
      ["business-analytics", "Business Analytics", "Review saves, visits, sales, messages, and conversion."],
      ["operator-desk", "Operator Desk", "Monitor queues, support tasks, and service health."]
    ]
  },
  {
    type: "Community",
    surface: "circles",
    items: [
      ["neighborhoods", "Neighborhoods", "Open local rooms, alerts, people, and service boards."],
      ["people-nearby", "People Nearby", "Find trusted people, creators, helpers, and businesses."],
      ["creator-bookings", "Creator Bookings", "Book creators, photographers, performers, and hosts."],
      ["community-alerts", "Community Alerts", "Share local safety, lost-and-found, weather, and urgent notes."],
      ["support-center", "Support Center", "Get help with account, money, market, and service issues."],
      ["trust-report", "Trust Report", "Report scams, harassment, impersonation, or unsafe behavior."],
      ["document-vault", "Document Vault", "Store account, business, dispute, and verification documents."],
      ["saved-context", "Saved Context", "Keep important chats, services, routes, receipts, and listings."],
      ["public-directory", "Public Directory", "Browse public people, businesses, services, and local pages."],
      ["build-my-platform", "Build My Platform", "Package FoxHub-style rooms and tools for a client or city."]
    ]
  }
];

export const services = serviceGroups.flatMap((group) =>
  group.items.map(([id, name, blurb]) => ({
    id,
    name,
    type: group.type,
    surface: group.surface,
    blurb
  }))
);

export const blueCollarServiceCategories = [
  {
    id: "home-repair",
    name: "Fix My Home",
    merchantName: "Home Repair Leads",
    serviceId: "repairs",
    summary: "Everyday repair, maintenance, and install jobs.",
    components: ["quote request", "proof photos", "arrival window", "warranty note"],
    subcategories: [
      "Handyman",
      "Plumbing",
      "Electrical",
      "HVAC",
      "Appliance repair",
      "Garage doors",
      "Locksmith",
      "Drywall repair",
      "Painting",
      "Smart home setup",
      "TV mounting",
      "Window and door repair"
    ]
  },
  {
    id: "construction-renovation",
    name: "Build Or Remodel",
    merchantName: "Build And Remodel Jobs",
    serviceId: "property-services",
    summary: "Larger contractor work, installs, remodels, and site work.",
    components: ["project scope", "estimate", "permit note", "milestone payments"],
    subcategories: [
      "General contracting",
      "Kitchen remodel",
      "Bathroom remodel",
      "Carpentry",
      "Framing",
      "Roofing",
      "Flooring",
      "Tile",
      "Concrete",
      "Masonry",
      "Decks",
      "Fencing",
      "Insulation",
      "Demolition",
      "Excavation"
    ]
  },
  {
    id: "yard-outside",
    name: "Yard And Outside",
    merchantName: "Outdoor Service Jobs",
    serviceId: "property-services",
    summary: "Exterior upkeep, landscaping, trees, pools, and seasonal help.",
    components: ["property photos", "service radius", "recurring schedule", "weather note"],
    subcategories: [
      "Lawn mowing",
      "Landscaping",
      "Garden care",
      "Tree trimming",
      "Tree removal",
      "Stump grinding",
      "Irrigation",
      "Leaf removal",
      "Snow removal",
      "Pressure washing",
      "Gutter cleaning",
      "Pool service",
      "Outdoor lighting",
      "Driveway sealing"
    ]
  },
  {
    id: "clean-turnover",
    name: "Clean And Turn Over",
    merchantName: "Cleaning And Turnover",
    serviceId: "cleaning",
    summary: "Home, office, rental, move-out, and specialty cleaning.",
    components: ["room count", "before photos", "checklist", "supplies note"],
    subcategories: [
      "House cleaning",
      "Deep cleaning",
      "Move-out cleaning",
      "Airbnb turnover",
      "Office cleaning",
      "Restaurant cleaning",
      "Post-construction cleaning",
      "Carpet cleaning",
      "Upholstery cleaning",
      "Floor care",
      "Laundry service",
      "Trash-out",
      "Odor removal",
      "Specialty cleanup"
    ]
  },
  {
    id: "move-haul-deliver",
    name: "Move Or Haul",
    merchantName: "Moving And Hauling",
    serviceId: "moving-help",
    summary: "Moving labor, hauling, delivery, pickup, and load-in work.",
    components: ["item list", "pickup/dropoff", "crew size", "truck need"],
    subcategories: [
      "Local moving",
      "Long-distance moving",
      "Labor-only moving",
      "Packing help",
      "Unpacking help",
      "Junk removal",
      "Donation pickup",
      "Appliance hauling",
      "Debris hauling",
      "Courier delivery",
      "Furniture delivery",
      "Large item pickup",
      "Event load-in",
      "Warehouse help"
    ]
  },
  {
    id: "auto-equipment",
    name: "Auto And Equipment",
    merchantName: "Auto And Equipment Work",
    serviceId: "fleet-check",
    summary: "Vehicle, fleet, machine, and mobile equipment services.",
    components: ["vehicle details", "symptoms", "mobile or shop", "parts needed"],
    subcategories: [
      "Auto repair",
      "Mobile mechanic",
      "Oil change",
      "Brake service",
      "Tire service",
      "Towing",
      "Roadside help",
      "Battery service",
      "Auto detailing",
      "Windshield repair",
      "Body repair",
      "Motorcycle repair",
      "Boat repair",
      "RV repair",
      "Small engine repair",
      "Fleet maintenance"
    ]
  },
  {
    id: "food-events-labor",
    name: "Food And Events",
    merchantName: "Food And Event Crews",
    serviceId: "event-staffing",
    summary: "Hands-on staff and setup for food, parties, venues, and events.",
    components: ["headcount", "shift time", "role list", "payout plan"],
    subcategories: [
      "Catering",
      "Food truck booking",
      "Bartending",
      "Servers",
      "Event setup",
      "Event teardown",
      "Stagehands",
      "Audio setup",
      "Lighting setup",
      "Security staff",
      "Valet",
      "Ticket scanning",
      "Kitchen prep",
      "Dishwashing",
      "Tent/table/chair setup"
    ]
  },
  {
    id: "business-facilities",
    name: "Business And Facilities",
    merchantName: "Facility Service Work",
    serviceId: "business-profile",
    summary: "Storefront, restaurant, office, warehouse, and facility maintenance.",
    components: ["business profile", "service window", "compliance proof", "invoice"],
    subcategories: [
      "Commercial maintenance",
      "Janitorial",
      "Restaurant equipment",
      "Refrigeration",
      "Grease trap",
      "Hood cleaning",
      "Commercial plumbing",
      "Commercial electrical",
      "Commercial HVAC",
      "Sign installation",
      "Storefront glass",
      "Parking lot striping",
      "Security cameras",
      "Access control",
      "Fire extinguisher service",
      "Loading dock repair"
    ]
  },
  {
    id: "safety-damage",
    name: "Safety And Damage Help",
    merchantName: "Safety And Remediation",
    serviceId: "trust-report",
    summary: "Higher-trust inspection, damage, cleanup, and remediation work.",
    components: ["evidence", "insurance note", "licensed proof", "case history"],
    subcategories: [
      "Mold remediation",
      "Water damage",
      "Fire damage",
      "Smoke damage",
      "Asbestos removal",
      "Lead paint removal",
      "Hazmat cleanup",
      "Biohazard cleanup",
      "Radon mitigation",
      "Air duct cleaning",
      "Dryer vent cleaning",
      "Chimney cleaning",
      "Septic service",
      "Home inspection",
      "Termite inspection",
      "Emergency board-up"
    ]
  },
  {
    id: "local-task-help",
    name: "Local Task Help",
    merchantName: "Neighborhood Task Work",
    serviceId: "errand-runner",
    summary: "Simple neighborhood help, errands, pets, assembly, and setup tasks.",
    components: ["task details", "location", "time window", "trust check"],
    subcategories: [
      "Pet grooming",
      "Dog walking",
      "Pet sitting",
      "Errands",
      "Grocery pickup",
      "Furniture assembly",
      "Home organization",
      "House sitting",
      "Plant care",
      "Holiday lights",
      "Decoration setup",
      "Party help",
      "Package pickup",
      "Mobile notary",
      "General task help"
    ]
  }
];

export const whiteCollarServiceCategories = [
  {
    id: "business-admin",
    name: "Business Admin",
    merchantName: "Business Admin Help",
    serviceId: "operator-desk",
    summary: "Back-office support for small businesses, teams, and local operators.",
    components: ["intake form", "document checklist", "task owner", "follow-up note"],
    subcategories: [
      "Virtual assistant",
      "Admin support",
      "Data entry",
      "Scheduling",
      "Customer support",
      "Vendor coordination",
      "Inbox management",
      "CRM cleanup",
      "Process documentation",
      "Operations setup",
      "Executive assistant",
      "Procurement help"
    ]
  },
  {
    id: "finance-accounting",
    name: "Finance And Accounting",
    merchantName: "Finance Desk",
    serviceId: "business-analytics",
    summary: "Money, reporting, bookkeeping, tax prep, and business finance help.",
    components: ["secure docs", "monthly report", "approval trail", "export"],
    subcategories: [
      "Bookkeeping",
      "Payroll",
      "Tax preparation",
      "Sales tax",
      "Accounts receivable",
      "Accounts payable",
      "Budgeting",
      "Financial reporting",
      "Expense cleanup",
      "Invoice setup",
      "Controller services",
      "CFO advisory",
      "Grant accounting",
      "Audit prep"
    ]
  },
  {
    id: "legal-compliance",
    name: "Legal And Compliance",
    merchantName: "Legal And Compliance",
    serviceId: "verification-center",
    summary: "Policy, contracts, filings, compliance checks, and risk review.",
    components: ["case file", "deadline", "document vault", "review status"],
    subcategories: [
      "Contract review",
      "Business formation",
      "Trademark support",
      "Licensing",
      "Permit support",
      "Policy writing",
      "Terms and privacy",
      "HR compliance",
      "Risk review",
      "Insurance review",
      "Notary coordination",
      "Compliance audit",
      "Vendor agreements",
      "Dispute prep"
    ]
  },
  {
    id: "marketing-growth",
    name: "Marketing And Growth",
    merchantName: "Marketing Help",
    serviceId: "loyalty",
    summary: "Promotion, campaigns, local growth, customer retention, and offers.",
    components: ["campaign brief", "audience", "offer", "results"],
    subcategories: [
      "Marketing strategy",
      "Social media",
      "Content calendar",
      "Email marketing",
      "SMS campaigns",
      "Paid ads",
      "Local SEO",
      "Referral program",
      "Loyalty program",
      "Influencer outreach",
      "PR outreach",
      "Event promotion",
      "Brand partnerships",
      "Customer retention"
    ]
  },
  {
    id: "creative-content",
    name: "Creative And Content",
    merchantName: "Creative Services",
    serviceId: "creator-bookings",
    summary: "Design, writing, photo, video, audio, and brand content.",
    components: ["creative brief", "asset list", "revision notes", "usage rights"],
    subcategories: [
      "Graphic design",
      "Logo design",
      "Brand identity",
      "Copywriting",
      "Photography",
      "Videography",
      "Video editing",
      "Podcast editing",
      "Voiceover",
      "Presentation design",
      "Product photos",
      "Menu design",
      "Flyers",
      "Content repurposing",
      "Creative direction"
    ]
  },
  {
    id: "tech-digital",
    name: "Tech And Digital",
    merchantName: "Tech Help",
    serviceId: "mini-store",
    summary: "Websites, tools, automation, systems, and digital setup.",
    components: ["access checklist", "scope", "test step", "handoff"],
    subcategories: [
      "Website setup",
      "Landing page",
      "Online store",
      "App support",
      "No-code automation",
      "IT support",
      "Cybersecurity basics",
      "Domain setup",
      "Email setup",
      "Analytics setup",
      "Database cleanup",
      "POS setup",
      "Booking system",
      "Software training",
      "AI workflow setup"
    ]
  },
  {
    id: "sales-customer",
    name: "Sales And Customer",
    merchantName: "Sales Support",
    serviceId: "customer-inbox",
    summary: "Lead handling, sales process, customer messaging, and account work.",
    components: ["lead source", "script", "pipeline stage", "next action"],
    subcategories: [
      "Lead generation",
      "Cold outreach",
      "Sales scripts",
      "CRM setup",
      "Pipeline cleanup",
      "Appointment setting",
      "Customer onboarding",
      "Customer success",
      "Review responses",
      "Support macros",
      "Account management",
      "Proposal writing",
      "Quote follow-up",
      "Retention calls"
    ]
  },
  {
    id: "hr-talent",
    name: "HR And Talent",
    merchantName: "Hiring Help",
    serviceId: "jobs",
    summary: "Hiring, onboarding, worker documentation, and team operations.",
    components: ["role brief", "candidate list", "interview steps", "onboarding checklist"],
    subcategories: [
      "Recruiting",
      "Job posting",
      "Resume screening",
      "Interview scheduling",
      "Background check coordination",
      "Onboarding",
      "Employee handbook",
      "Training materials",
      "Shift planning",
      "Contractor management",
      "HR records",
      "Performance process",
      "Compensation review",
      "Team policy setup"
    ]
  },
  {
    id: "real-estate-professional",
    name: "Real Estate Professional",
    merchantName: "Real Estate Desk",
    serviceId: "housing",
    summary: "Property paperwork, leasing, transaction support, and market operations.",
    components: ["property file", "deadline tracker", "contact list", "document status"],
    subcategories: [
      "Transaction coordination",
      "Listing coordination",
      "Lease admin",
      "Property management admin",
      "Tenant screening support",
      "Showing coordination",
      "Market research",
      "Comparable sales",
      "Permit research",
      "HOA document help",
      "Inspection scheduling",
      "Vendor coordination",
      "Open house support",
      "Real estate marketing"
    ]
  },
  {
    id: "education-consulting",
    name: "Education And Consulting",
    merchantName: "Training And Consulting",
    serviceId: "service-quotes",
    summary: "Expert advice, tutoring, training, coaching, and business planning.",
    components: ["session goal", "materials", "schedule", "outcome notes"],
    subcategories: [
      "Business consulting",
      "Startup advising",
      "Career coaching",
      "Tutoring",
      "Test prep",
      "Language lessons",
      "Music lessons",
      "Software training",
      "Financial coaching",
      "Operations consulting",
      "Restaurant consulting",
      "Retail consulting",
      "Workshop planning",
      "Curriculum design"
    ]
  }
];

export const blackCollarServiceCategories = [
  {
    id: "industrial-maintenance",
    name: "Industrial Maintenance",
    merchantName: "Industrial Maintenance Jobs",
    serviceId: "business-profile",
    summary: "Plant, shop, warehouse, and production-floor repair and upkeep.",
    components: ["site access", "safety checklist", "work order", "lockout note"],
    subcategories: [
      "Plant maintenance",
      "Machine repair",
      "Conveyor service",
      "Pump repair",
      "Motor repair",
      "Compressor service",
      "Boiler service",
      "Industrial electrical",
      "Industrial plumbing",
      "Hydraulic repair",
      "Pneumatic repair",
      "Preventive maintenance",
      "Shutdown support",
      "Millwright work"
    ]
  },
  {
    id: "waste-environmental",
    name: "Waste And Environmental",
    merchantName: "Waste And Environmental",
    serviceId: "trust-report",
    summary: "Waste, cleanup, disposal, spill response, and environmental field work.",
    components: ["waste profile", "manifest", "photos", "disposal proof"],
    subcategories: [
      "Waste hauling",
      "Dumpster service",
      "Industrial cleanup",
      "Spill cleanup",
      "Storm drain cleaning",
      "Grease waste",
      "Used oil pickup",
      "Scrap pickup",
      "Recycling service",
      "Environmental sampling",
      "Soil testing",
      "Water testing",
      "Containment setup",
      "Decontamination"
    ]
  },
  {
    id: "energy-utilities",
    name: "Energy And Utilities",
    merchantName: "Energy And Utility Work",
    serviceId: "property-services",
    summary: "Power, utility, generator, fuel, solar, and field service work.",
    components: ["utility notes", "permit check", "crew dispatch", "service report"],
    subcategories: [
      "Generator service",
      "Solar maintenance",
      "Battery storage",
      "EV charger service",
      "Utility locating",
      "Meter service",
      "Transformer support",
      "Power washing industrial",
      "Fuel delivery",
      "Propane service",
      "Backup power setup",
      "Substation support",
      "Utility trenching",
      "Line clearance"
    ]
  },
  {
    id: "oil-gas-field",
    name: "Oil Gas And Field",
    merchantName: "Oil Gas And Field Crews",
    serviceId: "fleet-check",
    summary: "Remote field services around wells, tanks, rigs, and energy sites.",
    components: ["site ticket", "PPE note", "truck route", "field report"],
    subcategories: [
      "Tank cleaning",
      "Rig support",
      "Wellsite support",
      "Vac truck service",
      "Hydro excavation",
      "Pipeline support",
      "Field welding",
      "Valve service",
      "Pressure testing",
      "Lease road work",
      "Equipment staging",
      "Remote fueling",
      "Field inspection",
      "Containment service"
    ]
  },
  {
    id: "mining-materials",
    name: "Mining And Materials",
    merchantName: "Mining And Materials",
    serviceId: "delivery-run",
    summary: "Quarry, aggregate, mining support, crushing, hauling, and material handling.",
    components: ["material type", "scale ticket", "haul route", "equipment check"],
    subcategories: [
      "Aggregate hauling",
      "Quarry support",
      "Crushing support",
      "Screening support",
      "Loader operator",
      "Excavator operator",
      "Drilling support",
      "Dust control",
      "Scale house support",
      "Material testing",
      "Stockpile management",
      "Belt maintenance",
      "Heavy haul",
      "Site road grading"
    ]
  },
  {
    id: "demolition-salvage",
    name: "Demolition And Salvage",
    merchantName: "Demo And Salvage Jobs",
    serviceId: "moving-help",
    summary: "Tear-down, strip-out, salvage, debris, and rough site cleanup.",
    components: ["scope photos", "hazard note", "debris plan", "haul ticket"],
    subcategories: [
      "Interior demolition",
      "Selective demolition",
      "Concrete breaking",
      "Saw cutting",
      "Structure teardown",
      "Salvage removal",
      "Scrap metal recovery",
      "Debris sorting",
      "Roll-off coordination",
      "Dust control",
      "Site cleanup",
      "Floor removal",
      "Roof tear-off",
      "Emergency board-up"
    ]
  },
  {
    id: "transport-heavy",
    name: "Heavy Transport",
    merchantName: "Heavy Transport",
    serviceId: "delivery-run",
    summary: "Heavy hauling, yard work, freight support, towing, and equipment movement.",
    components: ["load details", "route note", "insurance proof", "delivery confirmation"],
    subcategories: [
      "Heavy equipment hauling",
      "Flatbed hauling",
      "Lowboy hauling",
      "Container drayage",
      "Yard jockey",
      "Forklift service",
      "Dock work",
      "Freight loading",
      "Oversize load support",
      "Pilot car coordination",
      "Industrial towing",
      "Trailer repair",
      "Reefer support",
      "Fleet washout"
    ]
  },
  {
    id: "marine-rail-aviation",
    name: "Marine Rail Aviation",
    merchantName: "Marine Rail Aviation",
    serviceId: "fleet-check",
    summary: "Port, marina, rail yard, hangar, and specialized transport support.",
    components: ["asset ID", "yard access", "inspection note", "service log"],
    subcategories: [
      "Boatyard labor",
      "Marine repair",
      "Dock repair",
      "Bilge cleaning",
      "Hull cleaning",
      "Rail yard support",
      "Track maintenance support",
      "Railcar cleaning",
      "Aircraft ground support",
      "Hangar cleaning",
      "GSE maintenance",
      "Cargo handling",
      "Container inspection",
      "Port drayage support"
    ]
  },
  {
    id: "hazard-confined-space",
    name: "Hazard And Confined Space",
    merchantName: "Hazard And Confined Space",
    serviceId: "verification-center",
    summary: "High-risk specialty work that needs proof, procedures, and careful dispatch.",
    components: ["permit", "certification proof", "rescue plan", "incident log"],
    subcategories: [
      "Confined space support",
      "Tank entry support",
      "High-angle work",
      "Fall protection setup",
      "Respirator fit support",
      "Hot work support",
      "Permit-required work",
      "Safety watch",
      "Gas monitoring",
      "Emergency response support",
      "Industrial hygiene support",
      "Decon station setup",
      "Hazard labeling",
      "PPE staging"
    ]
  },
  {
    id: "infrastructure-civil",
    name: "Infrastructure And Civil",
    merchantName: "Infrastructure And Civil",
    serviceId: "route-planner",
    summary: "Road, drainage, underground, site, utility, and municipal support work.",
    components: ["site map", "traffic note", "inspection step", "completion photos"],
    subcategories: [
      "Road repair",
      "Pothole patching",
      "Asphalt work",
      "Concrete flatwork",
      "Drainage work",
      "Culvert service",
      "Storm cleanup",
      "Traffic control",
      "Striping",
      "Sign repair",
      "Guardrail repair",
      "Underground utility support",
      "Manhole service",
      "Site grading"
    ]
  }
];

export const yellowCollarServiceCategories = [
  {
    id: "design-branding",
    name: "Design And Branding",
    merchantName: "Design And Branding",
    serviceId: "creator-bookings",
    summary: "Visual identity, graphics, brand systems, and everyday design work.",
    components: ["creative brief", "brand assets", "revision notes", "usage rights"],
    subcategories: [
      "Graphic design",
      "Logo design",
      "Brand identity",
      "Typography",
      "Packaging design",
      "Print design",
      "Flyers",
      "Signage design",
      "Menu design",
      "Merch design",
      "Pitch deck design",
      "Presentation design",
      "Infographics",
      "Design systems"
    ]
  },
  {
    id: "photo-video",
    name: "Photo And Video",
    merchantName: "Photo And Video Crews",
    serviceId: "creator-bookings",
    summary: "Photography, videography, editing, shoots, and visual production.",
    components: ["shot list", "location", "release notes", "delivery folder"],
    subcategories: [
      "Photography",
      "Videography",
      "Video editing",
      "Product photography",
      "Event photography",
      "Portraits",
      "Real estate photos",
      "Drone video",
      "Short-form video",
      "Color grading",
      "Retouching",
      "Photo assistant",
      "Camera operator",
      "Behind-the-scenes content"
    ]
  },
  {
    id: "film-production",
    name: "Film And Production",
    merchantName: "Film And Production",
    serviceId: "event-staffing",
    summary: "Production crews, sets, scripts, shoots, and post-production workflows.",
    components: ["call sheet", "crew roles", "equipment list", "production wrap"],
    subcategories: [
      "Director",
      "Producer",
      "Assistant director",
      "Production assistant",
      "Script supervisor",
      "Set design",
      "Grip",
      "Gaffer",
      "Lighting crew",
      "Sound recordist",
      "Location scout",
      "Casting support",
      "Storyboard artist",
      "Post-production"
    ]
  },
  {
    id: "music-audio",
    name: "Music And Audio",
    merchantName: "Music And Audio",
    serviceId: "creator-bookings",
    summary: "Music, recording, voice, mixing, sound, and performance support.",
    components: ["session brief", "rights note", "stems/files", "delivery review"],
    subcategories: [
      "Music production",
      "Beat making",
      "Recording engineer",
      "Mixing",
      "Mastering",
      "Voiceover",
      "Podcast editing",
      "Sound design",
      "Jingle creation",
      "DJ services",
      "Live sound",
      "Session musician",
      "Music lessons",
      "Audio cleanup"
    ]
  },
  {
    id: "writing-editorial",
    name: "Writing And Editorial",
    merchantName: "Writing And Editorial",
    serviceId: "service-quotes",
    summary: "Words for brands, stories, campaigns, scripts, publishing, and local business.",
    components: ["outline", "draft", "review round", "final copy"],
    subcategories: [
      "Copywriting",
      "Content writing",
      "Blog writing",
      "Script writing",
      "Technical writing",
      "Editing",
      "Proofreading",
      "Ghostwriting",
      "Grant writing",
      "Press release writing",
      "Newsletter writing",
      "Product descriptions",
      "Speech writing",
      "Story development"
    ]
  },
  {
    id: "creator-social",
    name: "Creator And Social",
    merchantName: "Creator And Social",
    serviceId: "promoter-tools",
    summary: "Creator services, social media content, community growth, and audience work.",
    components: ["content plan", "posting schedule", "approval queue", "performance notes"],
    subcategories: [
      "Content creation",
      "Influencer campaign",
      "Social media management",
      "Community management",
      "Livestream support",
      "Reels and Shorts",
      "UGC creation",
      "Creator partnerships",
      "Audience engagement",
      "Comment moderation",
      "Content calendar",
      "Trend research",
      "Caption writing",
      "Creator coaching"
    ]
  },
  {
    id: "art-illustration",
    name: "Art And Illustration",
    merchantName: "Art And Illustration",
    serviceId: "creator-bookings",
    summary: "Illustration, murals, custom art, prints, visual culture, and handmade creative work.",
    components: ["concept sketch", "style reference", "materials", "approval"],
    subcategories: [
      "Illustration",
      "Digital art",
      "Murals",
      "Custom portraits",
      "Album art",
      "Poster art",
      "Comic art",
      "Character design",
      "Concept art",
      "Fine art commission",
      "Printmaking",
      "Hand lettering",
      "Tattoo design",
      "Public art"
    ]
  },
  {
    id: "fashion-style",
    name: "Fashion And Style",
    merchantName: "Fashion And Style",
    serviceId: "creator-bookings",
    summary: "Styling, beauty, wardrobe, set looks, product styling, and visual presentation.",
    components: ["look board", "sizes", "schedule", "photo proof"],
    subcategories: [
      "Wardrobe styling",
      "Personal styling",
      "Fashion design",
      "Tailoring creative",
      "Makeup artist",
      "Hair stylist",
      "Set styling",
      "Product styling",
      "Model coordination",
      "Lookbook production",
      "Costume design",
      "Jewelry design",
      "Sneaker customization",
      "Merch styling"
    ]
  },
  {
    id: "interactive-digital-art",
    name: "Interactive And Digital Art",
    merchantName: "Interactive Creative",
    serviceId: "mini-store",
    summary: "Creative technology, web visuals, game assets, motion, and interactive content.",
    components: ["asset list", "prototype", "device check", "handoff"],
    subcategories: [
      "Motion graphics",
      "Animation",
      "3D modeling",
      "Game assets",
      "UI visuals",
      "Interactive prototype",
      "AR filters",
      "VR experience",
      "Web animation",
      "NFT art support",
      "Creative coding",
      "Projection visuals",
      "Digital signage",
      "Exhibit media"
    ]
  },
  {
    id: "experience-creative",
    name: "Experience Creative",
    merchantName: "Experience Creative",
    serviceId: "pop-up-planner",
    summary: "Creative direction for events, pop-ups, activations, spaces, and campaigns.",
    components: ["experience brief", "vendor list", "run of show", "recap"],
    subcategories: [
      "Creative direction",
      "Art direction",
      "Event concept",
      "Brand activation",
      "Pop-up design",
      "Exhibit design",
      "Set decoration",
      "Visual merchandising",
      "Retail display",
      "Photo booth concept",
      "Launch campaign",
      "Experiential marketing",
      "Venue styling",
      "Creative operations"
    ]
  }
];

export const greenCollarServiceCategories = [
  {
    id: "renewable-energy",
    name: "Renewable Energy",
    merchantName: "Renewable Energy",
    serviceId: "service-quotes",
    summary: "Solar, wind, battery, audit, and clean-power project support.",
    components: ["site survey", "energy target", "permit notes", "commissioning"],
    subcategories: [
      "Solar assessment",
      "Solar panel install",
      "Solar cleaning",
      "Battery storage",
      "EV charger install",
      "Wind site support",
      "Microgrid planning",
      "Inverter service",
      "Load analysis",
      "Energy rebate support",
      "Net metering help",
      "Renewable maintenance",
      "Backup power planning",
      "Clean energy consulting"
    ]
  },
  {
    id: "energy-efficiency",
    name: "Energy Efficiency",
    merchantName: "Energy Efficiency",
    serviceId: "service-quotes",
    summary: "Building audits, insulation, lighting, HVAC savings, and utility reduction.",
    components: ["audit report", "upgrade list", "savings estimate", "completion proof"],
    subcategories: [
      "Energy audit",
      "Weatherization",
      "Insulation upgrade",
      "Air sealing",
      "LED retrofit",
      "Smart thermostat",
      "HVAC efficiency",
      "Window film",
      "Door sealing",
      "Utility bill review",
      "Appliance efficiency",
      "Building automation",
      "Rebate paperwork",
      "Benchmarking"
    ]
  },
  {
    id: "recycling-waste",
    name: "Recycling And Waste",
    merchantName: "Recycling And Waste",
    serviceId: "service-quotes",
    summary: "Recycling, reuse, compost, diversion, sorting, and waste reduction.",
    components: ["waste stream", "pickup plan", "diversion log", "receipt"],
    subcategories: [
      "Recycling pickup",
      "E-waste recycling",
      "Scrap metal recycling",
      "Cardboard recycling",
      "Compost pickup",
      "Organics sorting",
      "Waste audit",
      "Zero-waste setup",
      "Bin labeling",
      "Donation routing",
      "Material reuse",
      "Construction recycling",
      "Event waste diversion",
      "Recycling education"
    ]
  },
  {
    id: "water-conservation",
    name: "Water Conservation",
    merchantName: "Water Conservation",
    serviceId: "service-quotes",
    summary: "Water audits, irrigation savings, rain systems, fixtures, and leak reduction.",
    components: ["water use map", "fixture list", "savings note", "test result"],
    subcategories: [
      "Water audit",
      "Leak detection",
      "Low-flow fixtures",
      "Irrigation audit",
      "Drip irrigation",
      "Rain barrel setup",
      "Greywater support",
      "Stormwater capture",
      "Native planting",
      "Drought planning",
      "Pool efficiency",
      "Commercial water review",
      "Meter monitoring",
      "Backflow coordination"
    ]
  },
  {
    id: "sustainable-landscape",
    name: "Sustainable Landscape",
    merchantName: "Sustainable Landscape",
    serviceId: "home-services",
    summary: "Native plants, soil health, pollinator support, trees, and low-impact grounds care.",
    components: ["plant list", "soil note", "maintenance plan", "photos"],
    subcategories: [
      "Native landscaping",
      "Pollinator garden",
      "Tree planting",
      "Urban forestry",
      "Soil testing",
      "Composting setup",
      "Mulching",
      "Organic lawn care",
      "Invasive removal",
      "Erosion control",
      "Green roof care",
      "Rain garden",
      "Habitat restoration",
      "Landscape maintenance"
    ]
  },
  {
    id: "environmental-compliance",
    name: "Environmental Compliance",
    merchantName: "Environmental Compliance",
    serviceId: "verification-suite",
    summary: "Permits, reports, inspections, environmental records, and responsible operations.",
    components: ["permit need", "inspection log", "corrective action", "report file"],
    subcategories: [
      "Permit support",
      "Environmental inspection",
      "Stormwater compliance",
      "Spill plan",
      "Air quality support",
      "Water quality support",
      "Waste manifest",
      "SDS organization",
      "Environmental reporting",
      "Compliance calendar",
      "Site assessment",
      "Remediation coordination",
      "Training records",
      "Vendor documentation"
    ]
  },
  {
    id: "green-building",
    name: "Green Building",
    merchantName: "Green Building",
    serviceId: "home-services",
    summary: "Efficient materials, healthier interiors, certifications, retrofits, and building upgrades.",
    components: ["scope", "material list", "certification note", "handoff"],
    subcategories: [
      "Green retrofit",
      "Healthy materials",
      "Low-VOC painting",
      "Efficient windows",
      "Cool roof",
      "Green roof",
      "Building certification",
      "Passive design support",
      "Daylighting",
      "Ventilation upgrade",
      "Embodied carbon review",
      "Sustainable flooring",
      "Deconstruction planning",
      "Commissioning"
    ]
  },
  {
    id: "clean-transport",
    name: "Clean Transport",
    merchantName: "Clean Transport",
    serviceId: "route-planner",
    summary: "EV, bicycle, routing, fleet efficiency, charging, and low-emission transport.",
    components: ["route plan", "vehicle note", "charging stop", "trip log"],
    subcategories: [
      "EV fleet planning",
      "Charging operations",
      "Bike delivery",
      "Cargo bike service",
      "Route optimization",
      "Fuel reduction",
      "Idle reduction",
      "Transit planning",
      "Carpool setup",
      "Last-mile delivery",
      "Fleet emissions review",
      "Driver eco-training",
      "Clean vehicle sourcing",
      "Charging signage"
    ]
  },
  {
    id: "food-agriculture",
    name: "Food And Agriculture",
    merchantName: "Food And Agriculture",
    serviceId: "local-food",
    summary: "Urban farms, organics, food recovery, local sourcing, and sustainable kitchens.",
    components: ["source list", "food safety note", "pickup plan", "impact log"],
    subcategories: [
      "Urban farming",
      "Organic gardening",
      "Hydroponics",
      "Aquaponics",
      "Food recovery",
      "Local sourcing",
      "Compost coordination",
      "Farm stand setup",
      "Community garden",
      "Kitchen waste review",
      "Sustainable catering",
      "Soil amendment",
      "Seedling starts",
      "Food donation routing"
    ]
  },
  {
    id: "climate-resilience",
    name: "Climate Resilience",
    merchantName: "Climate Resilience",
    serviceId: "route-planner",
    summary: "Preparedness, heat, flood, wildfire, continuity, and community resilience work.",
    components: ["risk map", "priority list", "response contact", "drill recap"],
    subcategories: [
      "Heat planning",
      "Flood preparedness",
      "Wildfire readiness",
      "Emergency supplies",
      "Cooling center support",
      "Resilience audit",
      "Backup power plan",
      "Continuity planning",
      "Community outreach",
      "Risk mapping",
      "Insurance document prep",
      "Drainage review",
      "Tree canopy planning",
      "Recovery coordination"
    ]
  }
];

export const pinkCollarServiceCategories = [
  {
    id: "child-family-care",
    name: "Child And Family Care",
    merchantName: "Child And Family Care",
    serviceId: "service-quotes",
    summary: "Childcare, family support, tutoring, activities, and home help.",
    components: ["care brief", "schedule", "safety note", "family update"],
    subcategories: [
      "Babysitting",
      "Nanny services",
      "Daycare support",
      "After-school care",
      "Homework help",
      "Family assistant",
      "Child transport",
      "Playdate support",
      "New parent help",
      "Sleep support",
      "Child activity planning",
      "Special needs care",
      "School pickup",
      "Family scheduling"
    ]
  },
  {
    id: "elder-home-care",
    name: "Elder And Home Care",
    merchantName: "Elder And Home Care",
    serviceId: "home-services",
    summary: "Companion care, home support, errands, reminders, and non-medical assistance.",
    components: ["care plan", "visit log", "contact list", "incident note"],
    subcategories: [
      "Companion care",
      "Elder sitting",
      "Meal prep",
      "Medication reminders",
      "Errand support",
      "Light housekeeping",
      "Laundry help",
      "Mobility assistance",
      "Appointment transport",
      "Respite care",
      "Wellness check",
      "Home safety check",
      "Caregiver relief",
      "Daily living support"
    ]
  },
  {
    id: "health-wellness-support",
    name: "Health And Wellness Support",
    merchantName: "Health And Wellness Support",
    serviceId: "fitness-classes",
    summary: "Wellness, therapy support, coaching, prevention, and everyday care coordination.",
    components: ["intake", "goal note", "session log", "follow-up"],
    subcategories: [
      "Wellness coaching",
      "Nutrition coaching",
      "Fitness support",
      "Physical therapy aide",
      "Occupational therapy aide",
      "Home health aide",
      "Doula services",
      "Lactation support",
      "Massage therapy",
      "Mental health admin",
      "Patient navigation",
      "Care coordination",
      "Group wellness",
      "Recovery support"
    ]
  },
  {
    id: "education-tutoring",
    name: "Education And Tutoring",
    merchantName: "Education And Tutoring",
    serviceId: "classroom",
    summary: "Tutoring, teaching support, learning plans, workshops, and youth development.",
    components: ["learning goal", "lesson plan", "progress note", "next step"],
    subcategories: [
      "Tutoring",
      "Reading help",
      "Math help",
      "Test prep",
      "Language lessons",
      "Music lessons",
      "Art lessons",
      "Study skills",
      "Homeschool support",
      "Teacher aide",
      "Classroom assistant",
      "Youth mentoring",
      "Workshop facilitation",
      "Adult education"
    ]
  },
  {
    id: "hospitality-guest-service",
    name: "Hospitality And Guest Service",
    merchantName: "Hospitality And Guest Service",
    serviceId: "event-staffing",
    summary: "Guest service, hosting, front desk, concierge, reservations, and event warmth.",
    components: ["guest list", "shift notes", "service script", "handoff"],
    subcategories: [
      "Host services",
      "Front desk",
      "Concierge",
      "Reservation support",
      "Greeter",
      "Usher",
      "Tour guide",
      "Event check-in",
      "Coat check",
      "Ticket desk",
      "Guest relations",
      "Hotel support",
      "Venue attendant",
      "Customer welcome"
    ]
  },
  {
    id: "beauty-personal-care",
    name: "Beauty And Personal Care",
    merchantName: "Beauty And Personal Care",
    serviceId: "appointments",
    summary: "Beauty, grooming, spa, styling, and personal appointment services.",
    components: ["appointment", "preference note", "service log", "aftercare"],
    subcategories: [
      "Hair styling",
      "Barbering",
      "Makeup",
      "Nail services",
      "Skincare",
      "Lash services",
      "Brow services",
      "Waxing",
      "Spa attendant",
      "Personal grooming",
      "Mobile beauty",
      "Bridal beauty",
      "Salon assistant",
      "Aftercare coaching"
    ]
  },
  {
    id: "admin-office-service",
    name: "Admin And Office Service",
    merchantName: "Admin And Office Service",
    serviceId: "service-quotes",
    summary: "Scheduling, phones, records, reception, office support, and service desk help.",
    components: ["task list", "queue", "document folder", "status note"],
    subcategories: [
      "Reception",
      "Scheduling",
      "Phone support",
      "Data entry",
      "Records filing",
      "Office assistant",
      "Virtual assistant",
      "Calendar management",
      "Email support",
      "Customer service",
      "Help desk intake",
      "Clerical support",
      "Order processing",
      "Document prep"
    ]
  },
  {
    id: "retail-cashier-service",
    name: "Retail And Cashier Service",
    merchantName: "Retail And Cashier Service",
    serviceId: "mini-store",
    summary: "Retail floor help, cashiering, merchandising, returns, and customer support.",
    components: ["shift", "register note", "stock list", "closeout"],
    subcategories: [
      "Cashier",
      "Retail associate",
      "Personal shopper",
      "Stockroom support",
      "Visual merchandising",
      "Returns desk",
      "Gift wrap",
      "Inventory count",
      "Floor support",
      "Customer fitting",
      "Order pickup",
      "Loyalty signup",
      "Product demo",
      "Store opening"
    ]
  },
  {
    id: "community-social-service",
    name: "Community And Social Service",
    merchantName: "Community And Social Service",
    serviceId: "circle-admin",
    summary: "Community care, nonprofit support, outreach, casework, and resident services.",
    components: ["intake form", "resource list", "case note", "referral"],
    subcategories: [
      "Community outreach",
      "Case aide",
      "Resource navigation",
      "Shelter support",
      "Food pantry support",
      "Volunteer coordination",
      "Resident services",
      "Peer support",
      "Crisis line admin",
      "Benefits help",
      "Nonprofit admin",
      "Program assistant",
      "Donation intake",
      "Client follow-up"
    ]
  },
  {
    id: "domestic-household",
    name: "Domestic And Household",
    merchantName: "Domestic And Household",
    serviceId: "home-services",
    summary: "Home organization, cleaning support, laundry, meal help, and domestic operations.",
    components: ["home brief", "room list", "supply note", "photo proof"],
    subcategories: [
      "Housekeeping",
      "Home organization",
      "Laundry service",
      "Meal prep",
      "Closet organization",
      "Pantry setup",
      "Move-in setup",
      "Pet sitting",
      "Plant care",
      "House sitting",
      "Deep cleaning support",
      "Dishwashing",
      "Errand running",
      "Home reset"
    ]
  }
];

export const brownCollarServiceCategories = [
  {
    id: "public-works",
    name: "Public Works",
    merchantName: "Public Works Support",
    serviceId: "route-planner",
    summary: "Municipal field support, streets, signs, drainage, facilities, and civic upkeep.",
    components: ["work order", "route", "field photos", "completion log"],
    subcategories: [
      "Street maintenance",
      "Sign repair",
      "Sidewalk support",
      "Drain cleaning",
      "Curb repair",
      "Public facility repair",
      "Park maintenance",
      "Snow response",
      "Storm cleanup",
      "Graffiti removal",
      "Street sweeping",
      "Public restroom service",
      "Bridge support",
      "Municipal errands"
    ]
  },
  {
    id: "postal-courier",
    name: "Postal And Courier",
    merchantName: "Postal And Courier",
    serviceId: "delivery",
    summary: "Mailroom, route delivery, parcels, pickups, records, and chain-of-custody support.",
    components: ["pickup ticket", "route", "delivery proof", "exception note"],
    subcategories: [
      "Mailroom support",
      "Parcel delivery",
      "Courier route",
      "Certified mail",
      "Document delivery",
      "Package pickup",
      "Locker support",
      "Sorting",
      "Route assistant",
      "Same-day courier",
      "Bulk mail prep",
      "Return pickup",
      "Delivery audit",
      "Proof of delivery"
    ]
  },
  {
    id: "uniformed-support",
    name: "Uniformed Support",
    merchantName: "Uniformed Support",
    serviceId: "event-staffing",
    summary: "Non-sworn uniformed support for sites, events, civic spaces, and operations.",
    components: ["post order", "shift", "incident note", "handoff"],
    subcategories: [
      "Security greeter",
      "Door attendant",
      "Parking attendant",
      "Crossing support",
      "Event marshal",
      "Queue monitor",
      "Bag check support",
      "Site ambassador",
      "Lobby attendant",
      "Transit ambassador",
      "Campus aide",
      "Venue patrol support",
      "Crowd direction",
      "Lost and found"
    ]
  },
  {
    id: "grounds-field",
    name: "Grounds And Field",
    merchantName: "Grounds And Field",
    serviceId: "home-services",
    summary: "Outdoor field upkeep, grounds crews, rough site work, and property service.",
    components: ["site map", "task list", "equipment note", "before/after"],
    subcategories: [
      "Groundskeeping",
      "Field lining",
      "Fence repair",
      "Trail maintenance",
      "Brush clearing",
      "Lot cleanup",
      "Weed control",
      "Tree debris",
      "Leaf removal",
      "Irrigation check",
      "Playground upkeep",
      "Sports field prep",
      "Outdoor janitorial",
      "Property walk"
    ]
  },
  {
    id: "sanitation-civic-clean",
    name: "Sanitation And Civic Clean",
    merchantName: "Sanitation And Civic Clean",
    serviceId: "service-quotes",
    summary: "Civic cleaning, litter, dumpsters, alleys, public bins, and route-based sanitation.",
    components: ["clean zone", "pickup list", "disposal proof", "issue flag"],
    subcategories: [
      "Litter pickup",
      "Alley cleaning",
      "Dumpster area cleanup",
      "Public bin service",
      "Illegal dump report",
      "Bulk item staging",
      "Pressure washing",
      "Bus stop cleaning",
      "Public plaza cleaning",
      "Market cleanup",
      "Needle sweep support",
      "Trash route helper",
      "Civic event cleanup",
      "Odor control"
    ]
  },
  {
    id: "transport-yard",
    name: "Transport And Yard",
    merchantName: "Transport And Yard",
    serviceId: "route-planner",
    summary: "Yard crews, loading, dispatch support, lot operations, and vehicle staging.",
    components: ["yard map", "load ticket", "vehicle note", "dispatch update"],
    subcategories: [
      "Yard jockey",
      "Dock helper",
      "Loader support",
      "Vehicle staging",
      "Lot attendant",
      "Fleet wash",
      "Fueling support",
      "Trailer check",
      "Gate support",
      "Dispatch runner",
      "Inventory yard count",
      "Equipment staging",
      "Ramp support",
      "Shift handoff"
    ]
  },
  {
    id: "institutional-operations",
    name: "Institutional Operations",
    merchantName: "Institutional Operations",
    serviceId: "verification-suite",
    summary: "Schools, campuses, hospitals, civic buildings, and large-site operations support.",
    components: ["site badge", "department", "task queue", "supervisor signoff"],
    subcategories: [
      "Campus operations",
      "Hospital support",
      "School facilities",
      "Cafeteria support",
      "Laundry operations",
      "Supply room",
      "Room turnover",
      "Event setup",
      "Equipment checkout",
      "ID desk support",
      "Facilities runner",
      "Warehouse room",
      "Shift coverage",
      "Access escort"
    ]
  },
  {
    id: "community-safety",
    name: "Community Safety",
    merchantName: "Community Safety",
    serviceId: "circle-admin",
    summary: "Neighborhood safety, reporting, watch coordination, preparedness, and support roles.",
    components: ["zone", "contact list", "report note", "follow-up"],
    subcategories: [
      "Neighborhood watch",
      "Safety walk",
      "Lighting report",
      "Graffiti report",
      "Traffic calming support",
      "Emergency volunteer",
      "Disaster staging",
      "Shelter runner",
      "Check-in calls",
      "Resource delivery",
      "Community patrol aide",
      "Incident intake",
      "Preparedness drill",
      "Block captain"
    ]
  },
  {
    id: "field-inspection",
    name: "Field Inspection",
    merchantName: "Field Inspection",
    serviceId: "verification-suite",
    summary: "Property checks, condition photos, route inspections, compliance walks, and site notes.",
    components: ["inspection form", "photo set", "condition note", "flag list"],
    subcategories: [
      "Property inspection",
      "Vacancy check",
      "Route inspection",
      "Signage audit",
      "Utility read",
      "Meter photo",
      "Site condition report",
      "Code walk support",
      "Asset tagging",
      "Damage photo",
      "Inventory verification",
      "Permit posting check",
      "Safety walk",
      "Punch list review"
    ]
  },
  {
    id: "seasonal-civic",
    name: "Seasonal Civic",
    merchantName: "Seasonal Civic",
    serviceId: "event-staffing",
    summary: "Seasonal public operations, festivals, cleanup, weather response, and civic staffing.",
    components: ["season plan", "crew list", "route notes", "wrap report"],
    subcategories: [
      "Snow crew",
      "Leaf crew",
      "Festival setup",
      "Parade support",
      "Election site setup",
      "Cooling center staffing",
      "Holiday lighting",
      "Market setup",
      "Park opening",
      "Pool season support",
      "Storm debris crew",
      "Volunteer day support",
      "Street closure support",
      "Seasonal cleanup"
    ]
  }
];

export const purpleCollarServiceCategories = [
  {
    id: "field-it",
    name: "Field IT",
    merchantName: "Field IT",
    serviceId: "service-quotes",
    summary: "Hands-on technical support for devices, networks, sites, and frontline teams.",
    components: ["ticket", "device list", "test result", "handoff"],
    subcategories: [
      "Device setup",
      "Laptop repair",
      "Printer setup",
      "Wi-Fi troubleshooting",
      "Router install",
      "POS setup",
      "Kiosk support",
      "Camera network",
      "Cable tracing",
      "User onboarding",
      "Patch install",
      "Backup check",
      "Inventory tagging",
      "Remote support"
    ]
  },
  {
    id: "smart-building-tech",
    name: "Smart Building Tech",
    merchantName: "Smart Building Tech",
    serviceId: "home-services",
    summary: "Building technology, sensors, access systems, automation, and connected facilities.",
    components: ["floor map", "device map", "commissioning", "owner guide"],
    subcategories: [
      "Smart lock setup",
      "Access control",
      "Security camera install",
      "Sensor setup",
      "Thermostat network",
      "Lighting controls",
      "BMS support",
      "Intercom setup",
      "Alarm integration",
      "Occupancy sensors",
      "Energy dashboard",
      "Device labeling",
      "Firmware update",
      "Building tech audit"
    ]
  },
  {
    id: "industrial-automation",
    name: "Industrial Automation",
    merchantName: "Industrial Automation",
    serviceId: "service-quotes",
    summary: "Automation, controls, robotics, machine data, panels, and production tech.",
    components: ["control point", "safety lockout", "test cycle", "change log"],
    subcategories: [
      "PLC support",
      "HMI setup",
      "Robot cell support",
      "Machine sensor",
      "Conveyor controls",
      "Panel wiring support",
      "SCADA support",
      "Data logging",
      "Preventive tech check",
      "Calibration support",
      "Vision system",
      "Barcode scanner",
      "Production dashboard",
      "Automation troubleshooting"
    ]
  },
  {
    id: "technical-maintenance",
    name: "Technical Maintenance",
    merchantName: "Technical Maintenance",
    serviceId: "service-quotes",
    summary: "Maintenance work that blends mechanical, electrical, diagnostics, and software tools.",
    components: ["asset id", "diagnostic", "part note", "service log"],
    subcategories: [
      "Equipment diagnostics",
      "Firmware service",
      "Sensor replacement",
      "Electrical diagnostic",
      "Mechanical diagnostic",
      "Preventive maintenance",
      "Asset monitoring",
      "Thermal scan",
      "Vibration check",
      "Meter testing",
      "Parts tracking",
      "Service calibration",
      "Remote monitoring",
      "Maintenance reporting"
    ]
  },
  {
    id: "av-event-tech",
    name: "AV And Event Tech",
    merchantName: "AV And Event Tech",
    serviceId: "event-staffing",
    summary: "Audio, video, livestream, lighting, event networks, and technical show support.",
    components: ["run sheet", "gear list", "signal test", "show report"],
    subcategories: [
      "AV setup",
      "Livestream tech",
      "Projector setup",
      "Microphone support",
      "Event Wi-Fi",
      "Lighting board",
      "Video switcher",
      "Stage power support",
      "Speaker setup",
      "Recording support",
      "Hybrid meeting",
      "Badge scanner setup",
      "Digital signage",
      "Show caller tech"
    ]
  },
  {
    id: "logistics-systems",
    name: "Logistics Systems",
    merchantName: "Logistics Systems",
    serviceId: "route-planner",
    summary: "Warehouse systems, scanners, inventory tech, routing tools, and fulfillment operations.",
    components: ["workflow map", "scanner list", "sync check", "exception queue"],
    subcategories: [
      "Warehouse scanner",
      "Inventory system",
      "Barcode setup",
      "Label printer",
      "WMS support",
      "Route software",
      "Dispatch board",
      "RFID tagging",
      "Order sync",
      "Fulfillment dashboard",
      "Returns system",
      "Pick path setup",
      "Cycle count tech",
      "Carrier integration"
    ]
  },
  {
    id: "health-tech-operations",
    name: "Health Tech Operations",
    merchantName: "Health Tech Operations",
    serviceId: "appointments",
    summary: "Clinical technology support, device setup, records workflow, and care operations.",
    components: ["device check", "privacy note", "workflow", "support log"],
    subcategories: [
      "Medical device setup",
      "Telehealth support",
      "EHR workflow support",
      "Patient kiosk",
      "Clinic printer",
      "Secure messaging setup",
      "Device cleaning log",
      "Appointment system",
      "Queue display",
      "Remote patient device",
      "Inventory tech",
      "Access permissions",
      "Support desk",
      "Compliance handoff"
    ]
  },
  {
    id: "creator-tech",
    name: "Creator Tech",
    merchantName: "Creator Tech",
    serviceId: "creator-bookings",
    summary: "Technical setup for creators, studios, content tools, streams, and digital production.",
    components: ["creator setup", "account list", "asset test", "delivery"],
    subcategories: [
      "Studio setup",
      "Streaming setup",
      "Creator workstation",
      "Camera capture",
      "Audio interface",
      "Editing workstation",
      "Cloud folder setup",
      "Creator store setup",
      "Membership platform",
      "Analytics setup",
      "Plugin install",
      "Backup workflow",
      "Content automation",
      "Digital asset handoff"
    ]
  },
  {
    id: "data-ops-support",
    name: "Data Ops Support",
    merchantName: "Data Ops Support",
    serviceId: "search-hub",
    summary: "Data cleanup, dashboards, imports, exports, records, and operational reporting.",
    components: ["data source", "cleanup rules", "dashboard", "QA note"],
    subcategories: [
      "Spreadsheet cleanup",
      "Data import",
      "Data export",
      "Dashboard setup",
      "Report automation",
      "CRM cleanup",
      "Inventory data",
      "Customer list cleanup",
      "Form workflow",
      "Data QA",
      "Duplicate removal",
      "Lookup tables",
      "Ops metrics",
      "Data handoff"
    ]
  },
  {
    id: "cyber-physical",
    name: "Cyber Physical",
    merchantName: "Cyber Physical",
    serviceId: "verification-suite",
    summary: "Security support where devices, access, networks, and real-world operations overlap.",
    components: ["asset list", "risk note", "fix plan", "verification"],
    subcategories: [
      "Device hardening",
      "Network segmentation",
      "Camera security",
      "Access badge audit",
      "IoT inventory",
      "Password reset support",
      "MFA rollout",
      "Endpoint check",
      "Patch verification",
      "Incident evidence",
      "Backup verification",
      "Physical access review",
      "Vendor access cleanup",
      "Security awareness setup"
    ]
  }
];

export const weChatParityInstallPacks = [
  {
    id: "media-messaging",
    area: "Messaging",
    name: "Media Messaging And Calls",
    status: "installed workflow",
    summary: "Voice notes, images, files, call readiness, location sharing, recall, stickers, and translation paths for chat.",
    routeServiceId: "chat-boost",
    components: ["upload queue", "voice note", "call handoff", "message controls"],
    features: [
      "Voice notes",
      "Photo and video attachments",
      "File transfer",
      "Voice call readiness",
      "Video call readiness",
      "Group call readiness",
      "Real-time location sharing",
      "Message recall",
      "Sticker and GIF packs",
      "Chat translation"
    ]
  },
  {
    id: "group-social-privacy",
    area: "Social",
    name: "Group And Social Privacy",
    status: "installed workflow",
    summary: "Group administration, Moments privacy, audience controls, status, contact import, discovery, and safer reporting.",
    routeServiceId: "circle-admin",
    components: ["audience rules", "group roles", "report flow", "contact import"],
    features: [
      "Group roles and approvals",
      "Group announcements",
      "Mute and posting controls",
      "Moments audience controls",
      "Friend-only comment rules",
      "Media album posts",
      "Profile status",
      "Phone contact discovery",
      "Friend radar and shake routing",
      "Block and report upgrades"
    ]
  },
  {
    id: "official-account-console",
    area: "Official Accounts",
    name: "Official Account Console",
    status: "installed workflow",
    summary: "Brand, creator, service, and institution accounts with publishing, menus, followers, CRM, templates, and service inbox.",
    routeServiceId: "business-pages",
    components: ["publisher", "menu builder", "follower list", "service inbox"],
    features: [
      "Account registration queue",
      "Subscription account type",
      "Service account type",
      "Article and newsletter CMS",
      "Custom account menus",
      "Follower CRM",
      "Segmented messaging",
      "Template notifications",
      "Customer-service inbox",
      "Account analytics"
    ]
  },
  {
    id: "mini-program-platform",
    area: "Mini Programs",
    name: "Mini Program Developer Platform",
    status: "installed workflow",
    summary: "Developer console, manifest review, sandbox launch, share cards, QR deep links, billing hooks, analytics, and mini-games path.",
    routeServiceId: "mini-store",
    components: ["developer console", "review queue", "share card", "analytics"],
    features: [
      "Developer console",
      "Submission and review",
      "Embedded runtime path",
      "Mini-program store",
      "QR deep links",
      "Share cards in chats",
      "Share cards in groups",
      "Billing hooks",
      "Program analytics",
      "Mini-games lane"
    ]
  },
  {
    id: "real-payments-wallet",
    area: "Payments",
    name: "Real Wallet And Payment Rails",
    status: "installed workflow",
    summary: "Balance, cards, KYC, P2P transfers, merchant QR pay, checkout, refunds, payouts, red envelopes, bills, and recurring payments.",
    routeServiceId: "wallet",
    components: ["balance ledger", "KYC queue", "payment rail", "payout rail"],
    features: [
      "Stored wallet balance",
      "Bank card linking",
      "KYC and AML flow",
      "Peer transfers",
      "Merchant QR payments",
      "In-app checkout",
      "Mini-program checkout",
      "Processor refunds",
      "Bank payouts",
      "Red envelopes",
      "Bill pay",
      "Mobile top-up",
      "Recurring payments",
      "Cross-border visitor pay"
    ]
  },
  {
    id: "commerce-orders-loyalty",
    area: "Commerce",
    name: "Orders, Loyalty, And Local Transactions",
    status: "installed workflow",
    summary: "Cart, inventory, order lifecycle, coupons, loyalty cards, food, travel, health, utility, and public-service transaction lanes.",
    routeServiceId: "mini-store",
    components: ["cart", "orders", "loyalty", "partner handoff"],
    features: [
      "Product cart",
      "Merchant inventory",
      "Order lifecycle",
      "Shipping and pickup states",
      "Refund states",
      "Loyalty cards",
      "Coupons",
      "Food ordering",
      "Delivery partner handoff",
      "Travel booking handoff",
      "Health appointment handoff",
      "Utility service handoff",
      "Public-service handoff"
    ]
  },
  {
    id: "ecosystem-search",
    area: "Search",
    name: "Ecosystem Search And Discovery",
    status: "installed workflow",
    summary: "Unified index, AI-style suggestions, visual search intake, search ads, and mini-program/service indexing.",
    routeServiceId: "search-hub",
    components: ["index map", "query intent", "visual intake", "ranking rules"],
    features: [
      "Chats index",
      "Posts index",
      "People index",
      "Official account index",
      "Services index",
      "Mini-program index",
      "Merchant index",
      "AI-style suggestions",
      "Visual search intake",
      "Search ads",
      "Mini-program SEO tools"
    ]
  },
  {
    id: "ads-growth",
    area: "Ads",
    name: "Ads And Merchant Growth",
    status: "installed workflow",
    summary: "Promoted posts, official account ads, search ads, service ads, merchant campaigns, targeting, budget, and reporting controls.",
    routeServiceId: "promoter-tools",
    components: ["campaign", "targeting", "budget", "reporting"],
    features: [
      "Moments-style promoted posts",
      "Official account ads",
      "Search ads",
      "Service ads",
      "Merchant ad manager",
      "Audience targeting",
      "Budget controls",
      "Creative approval",
      "Campaign reports",
      "Conversion tracking"
    ]
  },
  {
    id: "production-trust-safety",
    area: "Trust And Safety",
    name: "Production Trust And Safety",
    status: "installed workflow",
    summary: "Server-owned moderation, media review, rate limits, fraud controls, appeals, evidence bundles, and audit trails.",
    routeServiceId: "verification-suite",
    components: ["server checks", "media review", "rate limits", "appeals"],
    features: [
      "Server-owned moderation",
      "Automated media review",
      "Rate limits",
      "Abuse prevention",
      "Fraud controls",
      "Appeal workflow",
      "Evidence bundles",
      "Operator audit logs",
      "Policy templates",
      "Safety notifications"
    ]
  },
  {
    id: "native-notifications",
    area: "Notifications",
    name: "Native Push And Service Alerts",
    status: "installed workflow",
    summary: "Native iOS/Android push delivery, transactional templates, wallet alerts, merchant alerts, and notification preferences.",
    routeServiceId: "notify",
    components: ["push token", "template", "preference", "delivery log"],
    features: [
      "iOS native push",
      "Android native push",
      "Browser notification bridge",
      "Template notifications",
      "Wallet alerts",
      "Merchant alerts",
      "Mini-program alerts",
      "Official account alerts",
      "Delivery receipts",
      "Preference center"
    ]
  },
  {
    id: "platform-developer-enterprise",
    area: "Platform",
    name: "Platform, Developer, And Enterprise Layer",
    status: "installed workflow",
    summary: "Public APIs, partner console, desktop parity, companion-device planning, multi-device controls, and enterprise workspace foundations.",
    routeServiceId: "build-my-platform",
    components: ["API keys", "partner console", "device sessions", "enterprise rooms"],
    features: [
      "Public API platform",
      "Developer keys",
      "Webhook registry",
      "Partner console",
      "Desktop parity plan",
      "Companion-device plan",
      "Multi-device controls",
      "Enterprise workspace",
      "Admin policy controls",
      "Usage analytics"
    ]
  }
];

export const utilityCards = [
  { id: "money", name: "Money", detail: "Transfer, merchant pay, wallet top-up, cash-out" },
  { id: "billpay", name: "Bill Pay", detail: "Universal utility service bills, autopay, reminders, and receipts" },
  { id: "merchantops", name: "MerchantOps", detail: "Merchant queue, settlements, payout status, QR operations" },
  { id: "scan", name: "Scan", detail: "QR add contact, join circle, launch mini-app" },
  { id: "card", name: "Cards", detail: "Identity card, access pass, event credential" },
  { id: "saved", name: "Saved", detail: "Pinned utilities, favorite messages, stored links" }
];

export const utilityBillPayProviders = [
  {
    id: "power-grid",
    name: "Power Grid",
    category: "Electric",
    accountMask: "8842",
    dueAmount: "$126.40",
    dueDate: "2026-05-03",
    status: "ready",
    autopay: true,
    rails: ["ACH", "card", "wallet"],
    memo: "Autopay scheduled from FoxHub wallet."
  },
  {
    id: "city-water",
    name: "City Water",
    category: "Water",
    accountMask: "2910",
    dueAmount: "$48.75",
    dueDate: "2026-05-08",
    status: "attention",
    autopay: false,
    rails: ["ACH", "card"],
    memo: "Needs biller account confirmation before autopay."
  },
  {
    id: "connect-fiber",
    name: "Connect Fiber",
    category: "Internet",
    accountMask: "7716",
    dueAmount: "$89.99",
    dueDate: "2026-05-12",
    status: "ready",
    autopay: false,
    rails: ["card", "wallet"],
    memo: "Eligible for same-day card payment."
  },
  {
    id: "metro-mobile",
    name: "Metro Mobile",
    category: "Mobile",
    accountMask: "4408",
    dueAmount: "$62.10",
    dueDate: "2026-05-15",
    status: "ready",
    autopay: true,
    rails: ["ACH", "card", "wallet"],
    memo: "Family plan reminder enabled."
  }
];

export const utilityBillPayPayments = [
  {
    id: "billpay-1",
    providerId: "power-grid",
    providerName: "Power Grid",
    amount: "$126.40",
    status: "scheduled",
    method: "Wallet balance",
    scheduledFor: "2026-05-03",
    receiptState: "pending"
  },
  {
    id: "billpay-2",
    providerId: "city-water",
    providerName: "City Water",
    amount: "$48.75",
    status: "needs confirmation",
    method: "ACH",
    scheduledFor: "2026-05-08",
    receiptState: "waiting"
  }
];

export const apiConnectors = [
  {
    id: "stripe-connect",
    name: "Stripe Connect",
    category: "Payments",
    summary: "Marketplace payouts, platform fees, and verified business onboarding.",
    status: "ready",
    automation: "High",
    surface: "wallet"
  },
  {
    id: "sendgrid",
    name: "SendGrid",
    category: "Messaging",
    summary: "Transactional email delivery for account, receipt, and platform notices.",
    status: "planned",
    automation: "Medium",
    surface: "chat"
  },
  {
    id: "twilio",
    name: "Twilio",
    category: "Identity",
    summary: "Phone verification, SMS alerts, and recovery flows tied to the identity layer.",
    status: "planned",
    automation: "Medium",
    surface: "chat"
  },
  {
    id: "maps",
    name: "Google Maps Platform",
    category: "Location",
    summary: "Place context, route utilities, and local service discovery anchors.",
    status: "planned",
    automation: "Medium",
    surface: "circles"
  },
  {
    id: "plaid",
    name: "Plaid",
    category: "Banking",
    summary: "Bank-linking foundation for payout rails and account ownership checks.",
    status: "inactive",
    automation: "Low",
    surface: "wallet"
  }
  ,
  {
    id: "universal-bill-pay",
    name: "Universal Bill Pay",
    category: "Utilities",
    summary: "Biller directory, account verification, scheduled utility payments, reminders, autopay, and receipt sync.",
    status: "ready",
    automation: "High",
    surface: "wallet"
  }
  ,
  {
    id: "paypal-commerce",
    name: "PayPal Commerce",
    category: "Payments",
    summary: "Global checkout and payouts with merchant dispute coverage.",
    status: "planned",
    automation: "Medium",
    surface: "wallet"
  },
  {
    id: "square-connect",
    name: "Square",
    category: "Payments",
    summary: "Point of sale and business APIs that cover banks, cards, and terminal flows.",
    status: "planned",
    automation: "Medium",
    surface: "wallet"
  },
  {
    id: "adyen",
    name: "Adyen",
    category: "Payments",
    summary: "Enterprise payment processing, in-person commerce, and global risk controls.",
    status: "planned",
    automation: "High",
    surface: "wallet"
  },
  {
    id: "braintree",
    name: "Braintree",
    category: "Payments",
    summary: "Cards, wallets, recurring billing, and marketplace checkout flows under PayPal infrastructure.",
    status: "planned",
    automation: "Medium",
    surface: "wallet"
  },
  {
    id: "authorize-net",
    name: "Authorize.net",
    category: "Payments",
    summary: "Card processing, customer payment profiles, and merchant checkout coverage.",
    status: "planned",
    automation: "Medium",
    surface: "wallet"
  },
  {
    id: "checkout-com",
    name: "Checkout.com",
    category: "Payments",
    summary: "Global payments, risk tooling, and high-scale card acquiring for modern commerce stacks.",
    status: "planned",
    automation: "High",
    surface: "wallet"
  },
  {
    id: "wise-platform",
    name: "Wise Platform",
    category: "Payouts",
    summary: "Cross-border payouts, balances, and international money movement for platform disbursements.",
    status: "planned",
    automation: "Medium",
    surface: "wallet"
  },
  {
    id: "dwolla",
    name: "Dwolla",
    category: "Banking",
    summary: "ACH transfers, verified bank connections, and bank-to-bank payment rails.",
    status: "planned",
    automation: "Medium",
    surface: "wallet"
  },
  {
    id: "marqeta",
    name: "Marqeta",
    category: "Banking",
    summary: "Card issuing, spend controls, and modern embedded card programs.",
    status: "planned",
    automation: "Medium",
    surface: "wallet"
  },
  {
    id: "unit",
    name: "Unit",
    category: "Banking",
    summary: "Embedded banking accounts, cards, and money movement infrastructure.",
    status: "planned",
    automation: "Medium",
    surface: "wallet"
  },
  {
    id: "synctera",
    name: "Synctera",
    category: "Banking",
    summary: "Bank partner connectivity and embedded finance program orchestration.",
    status: "planned",
    automation: "Low",
    surface: "wallet"
  },
  {
    id: "segment",
    name: "Segment",
    category: "Analytics",
    summary: "Unified user data pipeline for event, profile, and trust signals.",
    status: "planned",
    automation: "Low",
    surface: "connectors"
  },
  {
    id: "algolia",
    name: "Algolia",
    category: "Search",
    summary: "Realtime search indexing for listings, contacts, and service catalogs.",
    status: "planned",
    automation: "Medium",
    surface: "discover"
  },
  {
    id: "meta-whatsapp-business",
    name: "WhatsApp Business Platform",
    category: "Messaging",
    summary: "Business messaging, account notifications, and customer support threads through Meta infrastructure.",
    status: "planned",
    automation: "High",
    surface: "chat"
  },
  {
    id: "instagram-graph",
    name: "Instagram Graph",
    category: "Social",
    summary: "Creator publishing, business account content sync, and audience-facing profile actions.",
    status: "planned",
    automation: "Medium",
    surface: "circles"
  },
  {
    id: "google-auth",
    name: "Google Identity",
    category: "Identity",
    summary: "Sign-in, account linking, and trusted recovery pathways through Google accounts.",
    status: "planned",
    automation: "High",
    surface: "connectors"
  },
  {
    id: "shopify-admin",
    name: "Shopify Admin",
    category: "Commerce",
    summary: "Store catalog, orders, customers, and merchant operations for storefront workflows.",
    status: "planned",
    automation: "High",
    surface: "market"
  },
  {
    id: "slack-platform",
    name: "Slack Platform",
    category: "Workflows",
    summary: "Internal alerts, ops handoff, and workflow routing for teams running FoxHub operations.",
    status: "planned",
    automation: "Medium",
    surface: "connectors"
  },
  {
    id: "hubspot",
    name: "HubSpot",
    category: "CRM",
    summary: "Pipeline, contact lifecycle, and support follow-up for growth and customer success teams.",
    status: "planned",
    automation: "Medium",
    surface: "connectors"
  },
  {
    id: "salesforce",
    name: "Salesforce",
    category: "CRM",
    summary: "Enterprise account records, opportunity syncing, and partner operations management.",
    status: "planned",
    automation: "Medium",
    surface: "connectors"
  },
  {
    id: "docusign",
    name: "DocuSign",
    category: "Agreements",
    summary: "Signature workflows for merchant onboarding, partner approvals, and high-trust account changes.",
    status: "planned",
    automation: "Medium",
    surface: "connectors"
  },
  {
    id: "quickbooks",
    name: "QuickBooks",
    category: "Accounting",
    summary: "Ledger sync, invoices, reconciliation, and accounting export for platform finance teams.",
    status: "planned",
    automation: "Medium",
    surface: "connectors"
  },
  {
    id: "xero",
    name: "Xero",
    category: "Accounting",
    summary: "Accounting sync for reconciliations, invoice workflows, and finance reporting.",
    status: "planned",
    automation: "Medium",
    surface: "connectors"
  },
  {
    id: "avalara",
    name: "Avalara",
    category: "Tax",
    summary: "Tax calculation, compliance, and filing workflows for multi-region commerce activity.",
    status: "planned",
    automation: "Medium",
    surface: "connectors"
  },
  {
    id: "openai-platform",
    name: "OpenAI",
    category: "AI",
    summary: "Assistant, moderation, summarization, and workflow automation for support and operator tooling.",
    status: "planned",
    automation: "High",
    surface: "connectors"
  },
  {
    id: "discord",
    name: "Discord",
    category: "Community",
    summary: "Community sync, event coordination, and audience notifications for creator-led groups.",
    status: "planned",
    automation: "Medium",
    surface: "circles"
  },
  {
    id: "github",
    name: "GitHub",
    category: "Developer",
    summary: "Issue, release, and deployment signal syncing for technical teams building on FoxHub.",
    status: "planned",
    automation: "Medium",
    surface: "connectors"
  }
];

export const favorites = [
  { id: "fav-1", type: "message", title: "Launch Team note", detail: "Keep creators ahead of local merchants in onboarding." },
  { id: "fav-2", type: "mini-app", title: "SplitTab", detail: "Primary nightlife payment wedge." },
  { id: "fav-3", type: "contact", title: "Nova Reyes", detail: "Atlanta rollout lead." }
];

export const savedItems = [
  { id: "saved-1", kind: "message", source: "Launch Team", title: "Creators-first onboarding", detail: "Keep creators ahead of local merchants in onboarding.", meta: "Saved from chat" },
  { id: "saved-2", kind: "moment", source: "Tia Brooks", title: "Merchant QR kits", detail: "If SplitTab launches with merchant QR kits, nightlife adoption gets much easier.", meta: "Saved from Moments" }
];

export const miniAppRecents = [
  { id: "recent-1", name: "SplitTab", meta: "Opened from Miami Hosts" },
  { id: "recent-2", name: "FoxTickets", meta: "Opened from ATL Live" },
  { id: "recent-3", name: "RideGrid", meta: "Opened from Launch Team" }
];

export const miniAppPermissions = [
  { id: "perm-splittab", appId: "splittab", appName: "SplitTab", scope: "identity, wallet, contacts", status: "granted", meta: "Used for nightlife tab closeout" },
  { id: "perm-foxtickets", appId: "foxtickets", appName: "FoxTickets", scope: "identity, circles", status: "granted", meta: "Used for creator event access" }
];

export const officialAccountSubscriptions = ["foxhub-news", "atl-culture", "wallet-watch"];

export const qrActions = [
  { id: "qr-contact", title: "Add contact", detail: "Scan a profile code and open a direct thread instantly." },
  { id: "qr-circle", title: "Join circle", detail: "Scan a trusted invite and move into a local network." },
  { id: "qr-pay", title: "Pay merchant", detail: "Scan a merchant code and push wallet checkout into chat context." },
  { id: "qr-miniapp", title: "Launch mini-app", detail: "Scan an event or service code and open the linked mini-app." }
];

export const qrHistory = [
  { id: "qrh-1", title: "Identity scan", detail: "Opened a direct thread from a profile QR.", meta: "Contact action · 23 min ago" },
  { id: "qrh-2", title: "Merchant scan", detail: "Triggered a merchant payment flow from wallet context.", meta: "Payment action · 51 min ago" }
];

export const serviceContinuity = [
  {
    id: "svc-1",
    appId: "splittab",
    appName: "SplitTab",
    fromThread: "Miami Hosts",
    fromCircle: "Miami Hosts",
    returnLabel: "Return to nightlife settlement thread",
    meta: "Opened from service context"
  },
  {
    id: "svc-2",
    appId: "merchantos",
    appName: "MerchantOS",
    fromThread: "Wallet Watch",
    fromCircle: "Miami Hosts",
    returnLabel: "Return to merchant settlement ops",
    meta: "Opened from merchant operations"
  }
];

export const merchantOpsSuite = {
  summary: {
    locations: 4,
    liveTerminals: 11,
    settlementsDue: "$3,482",
    payoutRisk: 1
  },
  queues: [
    {
      id: "mq-1",
      name: "Settlement queue",
      status: "needs review",
      detail: "3 nightlife closings waiting for final settle before payout release.",
      volume: "$1,840"
    },
    {
      id: "mq-2",
      name: "Merchant onboarding",
      status: "in progress",
      detail: "2 venues still need tax profile and bank verification checks.",
      volume: "2 accounts"
    },
    {
      id: "mq-3",
      name: "Charge health",
      status: "stable",
      detail: "98.7% approval on QR checkouts over the last 7 days.",
      volume: "98.7%"
    }
  ],
  locations: [
    {
      id: "loc-1",
      name: "Noir Room",
      city: "Miami",
      state: "FL",
      status: "live",
      detail: "QR pay active, same-night settlement enabled."
    },
    {
      id: "loc-2",
      name: "South Loop Sessions",
      city: "Atlanta",
      state: "GA",
      status: "pilot",
      detail: "Merchant QR kits staged for weekend creator traffic."
    },
    {
      id: "loc-3",
      name: "Blue Ember",
      city: "Austin",
      state: "TX",
      status: "review",
      detail: "Payout rail ready, merchant compliance follow-up pending."
    }
  ],
  actions: [
    { id: "merchant-pay", label: "Run merchant pay", detail: "Open checkout from current thread." },
    { id: "merchant-qr", label: "Scan merchant QR", detail: "Use QR flow for counter checkout." },
    { id: "merchant-wallet", label: "Open pay ops", detail: "Review settlements and wallet activity." },
    { id: "merchant-watch", label: "Open Wallet Watch", detail: "Jump to merchant service notices." }
  ]
};

export const merchantSettlements = [
  {
    id: "settle-1",
    merchantId: "loc-1",
    merchantName: "Noir Room",
    amount: "$1,120.40",
    window: "2026-04-06",
    status: "review",
    riskFlag: "none",
    note: "Night closeout requires final confirmation before payout release."
  },
  {
    id: "settle-2",
    merchantId: "loc-2",
    merchantName: "South Loop Sessions",
    amount: "$482.10",
    window: "2026-04-06",
    status: "ready",
    riskFlag: "monitor",
    note: "Pilot merchant payout can release once terminal logs are synced."
  },
  {
    id: "settle-3",
    merchantId: "loc-3",
    merchantName: "Blue Ember",
    amount: "$1,879.55",
    window: "2026-04-05",
    status: "hold",
    riskFlag: "high",
    note: "Payout held due to enhanced due diligence and velocity checks."
  }
];

export const merchantPayoutControls = [
  {
    id: "payout-ctrl-1",
    merchantId: "loc-1",
    merchantName: "Noir Room",
    state: "release_ready",
    reservePercent: 5,
    nextPayoutAt: "2026-04-09T10:00:00Z",
    reason: "Stable charge profile"
  },
  {
    id: "payout-ctrl-2",
    merchantId: "loc-2",
    merchantName: "South Loop Sessions",
    state: "monitor",
    reservePercent: 10,
    nextPayoutAt: "2026-04-09T12:00:00Z",
    reason: "Pilot account monitoring window"
  },
  {
    id: "payout-ctrl-3",
    merchantId: "loc-3",
    merchantName: "Blue Ember",
    state: "hold",
    reservePercent: 35,
    nextPayoutAt: "",
    reason: "Enhanced due diligence pending"
  }
];

export const merchantLocations = [
  {
    id: "loc-1",
    merchantName: "Noir Room",
    city: "Miami",
    state: "FL",
    status: "live",
    terminalHealth: "healthy",
    qrStatus: "enabled",
    complianceState: "clear"
  },
  {
    id: "loc-2",
    merchantName: "South Loop Sessions",
    city: "Atlanta",
    state: "GA",
    status: "pilot",
    terminalHealth: "monitor",
    qrStatus: "enabled",
    complianceState: "review"
  },
  {
    id: "loc-3",
    merchantName: "Blue Ember",
    city: "Austin",
    state: "TX",
    status: "review",
    terminalHealth: "risk",
    qrStatus: "limited",
    complianceState: "hold"
  }
];

export const compliancePrograms = [
  {
    id: "control-ofac-screening",
    framework: "OFAC sanctions compliance",
    control: "Sanctions screening on onboarding and payout events",
    status: "required",
    owner: "Compliance Ops",
    cadence: "Realtime + daily backfill",
    lastReviewedAt: "2026-04-06T16:15:00Z",
    reference: "home.treasury.gov/news/press-releases/sm680"
  },
  {
    id: "control-fincen-cdd",
    framework: "FinCEN CDD",
    control: "Customer due diligence and beneficial ownership capture",
    status: "required",
    owner: "Risk Ops",
    cadence: "At onboarding + periodic refresh",
    lastReviewedAt: "2026-04-05T14:40:00Z",
    reference: "fincen.gov/resources/statutes-and-regulations/cdd-final-rule"
  },
  {
    id: "control-pci-dss",
    framework: "PCI DSS",
    control: "Payment-data protection and periodic control checks",
    status: "required",
    owner: "Platform Security",
    cadence: "Quarterly control review",
    lastReviewedAt: "2026-04-04T11:00:00Z",
    reference: "pcisecuritystandards.org/standards/pci-dss"
  },
  {
    id: "control-ftc-safeguards",
    framework: "FTC Safeguards Rule",
    control: "Written information-security program and service-provider safeguards",
    status: "required",
    owner: "Security Governance",
    cadence: "Monthly review",
    lastReviewedAt: "2026-04-03T09:30:00Z",
    reference: "ftc.gov/business-guidance/resources/ftc-safeguards-rule-what-your-business-needs-know"
  }
];

export const trustSafetyIncidents = [
  {
    id: "tsi-1",
    type: "account_takeover_attempt",
    severity: "high",
    status: "investigating",
    owner: "Trust Ops",
    channel: "signin",
    detail: "Three failed sign-in spikes from one ASN were rate-limited and flagged.",
    createdAt: "2026-04-06T21:18:00Z"
  },
  {
    id: "tsi-2",
    type: "merchant_impersonation_report",
    severity: "medium",
    status: "resolved",
    owner: "Safety Review",
    channel: "market",
    detail: "A suspected merchant impersonation listing was removed and account access was challenged.",
    createdAt: "2026-04-05T18:11:00Z"
  }
];

export const merchantOnboardingQueue = [
  {
    id: "mob-isa",
    merchantId: "isa",
    merchantAccountId: "merchant-account-isa",
    userCreatedAt: "2026-04-06T10:15:00Z",
    accountAgeDays: 0,
    minimumAccountAgeDays: 90,
    storefronts: ["shop-isa-primary"],
    merchantName: "Isa Moore",
    stage: "kyb_review",
    status: "review",
    riskTier: "medium",
    requiredItems: ["business registration", "tax profile", "bank account confirmation"],
    nextAction: "Collect tax profile and verify legal entity owner",
    lastUpdatedAt: "2026-04-06T10:15:00Z"
  },
  {
    id: "mob-noir",
    merchantId: "loc-1",
    merchantAccountId: "merchant-account-loc-1",
    userCreatedAt: "2025-12-15T08:20:00Z",
    accountAgeDays: 184,
    minimumAccountAgeDays: 90,
    storefronts: ["loc-1-main", "loc-1-popups"],
    merchantName: "Noir Room",
    stage: "active_monitoring",
    status: "active",
    riskTier: "low",
    requiredItems: ["periodic sanctions screen", "chargeback watch"],
    nextAction: "Continue weekly monitoring and payout review",
    lastUpdatedAt: "2026-04-06T08:20:00Z"
  },
  {
    id: "mob-blueember",
    merchantId: "loc-3",
    merchantAccountId: "merchant-account-loc-3",
    userCreatedAt: "2026-03-20T12:45:00Z",
    accountAgeDays: 79,
    minimumAccountAgeDays: 90,
    storefronts: ["loc-3-main"],
    merchantName: "Blue Ember",
    stage: "enhanced_due_diligence",
    status: "hold",
    riskTier: "high",
    requiredItems: ["owner verification", "bank account recheck", "source-of-funds note"],
    nextAction: "Resolve enhanced due diligence checklist before enabling full payouts",
    lastUpdatedAt: "2026-04-06T12:45:00Z"
  }
];

export const merchantRiskSignals = [
  {
    id: "risk-1",
    merchantId: "loc-3",
    merchantName: "Blue Ember",
    signal: "payout_velocity_spike",
    score: 82,
    status: "review",
    detail: "Payout velocity exceeded baseline by 2.9x during a 24-hour window.",
    detectedAt: "2026-04-06T12:20:00Z"
  },
  {
    id: "risk-2",
    merchantId: "isa",
    merchantName: "Isa Moore",
    signal: "document_gap",
    score: 61,
    status: "review",
    detail: "Tax profile still missing after onboarding submission.",
    detectedAt: "2026-04-05T17:05:00Z"
  }
];

export const disputeCases = [
  {
    id: "disp-1",
    merchantId: "loc-1",
    merchantName: "Noir Room",
    amount: "$84.20",
    reason: "cardholder_dispute",
    status: "open",
    owner: "Payments Ops",
    openedAt: "2026-04-05T21:05:00Z",
    detail: "Cardholder reported duplicate QR charge after venue close."
  }
];

export const moderationCases = [];

export const verificationCases = [
  {
    id: "verify-isa-merchant",
    targetId: "isa",
    targetType: "merchant",
    label: "Isa Moore merchant onboarding",
    status: "review",
    stage: "document_check",
    requestedItems: ["business registration", "tax profile", "bank account confirmation"],
    owner: "Merchant ops",
    createdAt: "2026-04-02T16:10:00Z",
    updatedAt: "2026-04-03T09:30:00Z"
  }
];

export const auditEvents = [
  {
    id: "audit-1",
    type: "auth",
    action: "sign_in",
    actorId: "@foxhub",
    targetId: "workspace",
    detail: "Seed operator session restored.",
    severity: "info",
    createdAt: "2026-04-03T08:35:00Z"
  },
  {
    id: "audit-2",
    type: "verification",
    action: "verification_review",
    actorId: "@ops",
    targetId: "isa",
    detail: "Merchant verification kept in review pending tax and bank documents.",
    severity: "review",
    createdAt: "2026-04-03T09:30:00Z"
  }
];

export const notificationEvents = [
  {
    id: "note-1",
    title: "Verification review is still open",
    body: "Merchant onboarding for Isa Moore still needs tax profile and bank confirmation.",
    category: "verification",
    status: "unread",
    createdAt: "2026-04-03T09:35:00Z"
  },
  {
    id: "note-2",
    title: "Wallet moderation is active",
    body: "Held and blocked wallet actions now route into the moderator layer.",
    category: "moderation",
    status: "read",
    createdAt: "2026-04-03T09:40:00Z"
  }
];

export const deviceSessions = [
  {
    id: "device-1",
    label: "iPhone 15 Pro",
    platform: "iOS",
    trust: "high",
    sessionState: "active",
    location: "Atlanta, GA",
    lastSeenAt: "2026-04-03T09:22:00Z"
  },
  {
    id: "device-2",
    label: "Pixel 9",
    platform: "Android",
    trust: "high",
    sessionState: "recent",
    location: "Miami, FL",
    lastSeenAt: "2026-04-03T07:55:00Z"
  }
];

export const documentVault = [
  {
    id: "doc-1",
    ownerId: "isa",
    targetType: "merchant",
    targetId: "verify-isa-merchant",
    name: "Merchant tax profile",
    kind: "verification",
    mimeType: "application/pdf",
    status: "review",
    source: "operator upload",
    createdAt: "2026-04-03T09:20:00Z"
  },
  {
    id: "doc-2",
    ownerId: "nova",
    targetType: "thread",
    targetId: "launch-team",
    name: "Launch runbook",
    kind: "attachment",
    mimeType: "image/png",
    status: "stored",
    source: "chat attachment",
    createdAt: "2026-04-03T09:28:00Z"
  }
];

export const operatorActions = [
  {
    id: "ops-1",
    action: "verification_case_opened",
    actorId: "@ops",
    targetId: "verify-isa-merchant",
    detail: "Merchant verification case opened for Isa Moore.",
    outcome: "review",
    createdAt: "2026-04-03T09:21:00Z"
  },
  {
    id: "ops-2",
    action: "rating_review_approved",
    actorId: "@ops",
    targetId: "rating-contact-2",
    detail: "Low peer rating kept in operator review queue.",
    outcome: "queued",
    createdAt: "2026-04-03T09:42:00Z"
  }
];

export const operatorAccessRecords = [
  {
    id: "operator-access-seed",
    userId: "seed-ops",
    email: "ops@foxhub.app",
    role: "reviewer",
    scopes: ["verification", "moderation", "documents", "notifications"],
    state: "active",
    grantedAt: "2026-04-03T09:10:00Z",
    grantedBy: "system"
  }
];

export const notificationSubscriptions = [
  {
    id: "notif-web-seed",
    channel: "browser",
    endpoint: "local-browser-session",
    permission: "default",
    status: "ready",
    createdAt: "2026-04-03T09:12:00Z",
    updatedAt: "2026-04-03T09:12:00Z"
  }
];

export const threadReadState = [
  {
    threadId: "launch-team",
    lastReadAt: "2026-04-03T09:14:00Z",
    unreadCount: 0
  }
];

export const invites = [
  {
    id: "invite-founders-01",
    code: "FOXHUB-FOUNDERS",
    label: "Founders access",
    note: "Immediate-access seed invite",
    createdBy: "system",
    createdByHandle: "@foxhub",
    status: "active",
    createdAt: "2026-04-03T08:30:00.000Z",
    expiresAt: "2026-04-10T08:30:00.000Z",
    applicantUid: "",
    applicantEmail: "",
    applicantName: "",
    sponsorDecisionAt: "",
    retentionReviewAt: "",
    rapportBoostedAt: "",
    redeemedBy: "",
    redeemedAt: ""
  }
];

export const defaultProfile = {
  oneId: "",
  name: "",
  displayName: "",
  handle: "",
  city: "",
  zipCode: "",
  postalCode: "",
  bio: "",
  occupation: "",
  demographic: "",
  pronouns: "",
  website: "",
  availability: "",
  interests: "",
  profilePhoto: null,
  profilePhotoUrl: "",
  profilePhotoName: "",
  profilePhotoType: "",
  accessState: "active",
  accessNote: "Open access",
  inviteCode: "",
  sponsorHandle: "",
  waitlistEndsAt: "",
  tutorialCompleted: false,
  verifiedPerformerSubscribed: false,
  verifiedPerformerStatus: "not_subscribed",
  verifiedPerformerPlan: "$20/month",
  verifiedPerformerSince: "",
  presenceState: "away",
  lastSeenAt: "",
  lastActiveAt: "",
  authMethod: "password"
};

export const views = {
  hub: {
    title: "Home starts with social, rapport, community, then service.",
    description:
      "FoxHub is arranged as a community rapport network: people connect, trust forms, communities coordinate, then services and merchants become useful."
  },
  chat: {
    title: "Social is the daily relationship layer.",
    description:
      "Direct threads, group threads, moments, voice, and media should be the first reason users open FoxHub."
  },
  circles: {
    title: "Rapport turns contacts into trusted context.",
    description:
      "Contacts, circles, vouches, endorsements, reputation, and introduction paths show how people know each other and what they can safely do together."
  },
  wallet: {
    title: "Pay orbits trusted relationships.",
    description:
      "Peer transfers, merchant pay, scanning, and payout activity should stay close to conversation, community, and verified service context."
  },
  discover: {
    title: "Services and merchants grow from community trust.",
    description:
      "Mini-apps, local utilities, official service channels, merchant workflows, and return context sit on top of social rapport."
  },
  market: {
    title: "Needs and offers bridge community into commerce.",
    description:
      "Requests, gigs, listings, alerts, and trust-graded sellers route every post back into FoxHub relationships."
  },
  connectors: {
    title: "Tools support the orbiting platform layer.",
    description:
      "Payment, email, signing, maps, and support connections stay visible so nobody has to guess what is working."
  },
  staff: {
    title: "Management keeps member review and moderation together.",
    description:
      "Managers, staff, and moderators can review FoxHub Member applications, verification work, and trust queues from one dashboard."
  },
  experience: {
    title: "UX and goodies make the network easier every day.",
    description:
      "Quick actions, daily cards, payment steps, helpful notices, and simple empty states make the app feel clearer."
  },
  growth: {
    title: "Communal spaces turn belonging into coordination.",
    description:
      "Local rooms, events, shared services, creators, public pages, and community programs give people reasons to return together."
  },
  blueprint: {
    title: "Organizer keeps FoxHub easy to understand.",
    description:
      "Review the 100 helpful pieces by room and purpose so the app feels like clear places instead of one crowded screen."
  }
};
