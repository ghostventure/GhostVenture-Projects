export const railItems = [
  { href: "/", label: "Home", value: "Back to the landing page", note: "Review the service offer first" },
  { href: "/store", label: "Store", value: "Merch catalog", note: "Browse merch before account setup" }
];

export const modeItems = [
  { label: "Client", value: "Requests and messages", copy: "Create the account, send the details, and keep replies together." },
  { label: "Studio", value: "Review and follow-up", copy: "Black Lion Studios reviews the request, schedule, billing needs, and delivery details." }
];

export const trustItems = [
  "Your request stays connected to your name and contact details.",
  "Messages stay in one place instead of scattered across apps.",
  "Studio staff can review the service details before replying."
];

export const checklistItems = [
  "Use a real email so replies and account recovery work.",
  "Add contact details that match the project owner.",
  "Save your details once so future requests start faster."
];

export const sidecarTags = ["Email", "Phone", "Client type", "Service choice", "Project goals", "Extra notes"];

export const servicePreview = [
  { label: "Creative", title: "Photo, video, audio", copy: "Send the details for shoots, edits, music, and creative work." },
  { label: "Technical", title: "Sites and PC support", copy: "Ask for help with membership sites, setup, troubleshooting, and upgrades." },
  { label: "Store", title: "Merch and store", copy: "Keep merch questions and order follow-up with your account." }
];

export const signinComponentGroups = [
  {
    kicker: "Start",
    title: "What to have ready",
    copy: "The basics that make the first request easier to answer.",
    items: [
      { label: "01", title: "Contact details", copy: "Use the name, email, and phone number the studio should use for follow-up." },
      { label: "02", title: "Service choice", copy: "Pick the first service you need: photo, video, audio, DJ, site help, PC support, or merch." }
    ]
  },
  {
    kicker: "Request",
    title: "What to send first",
    copy: "Enough detail for the studio to understand the work without a long back-and-forth.",
    items: [
      { label: "03", title: "Project notes", copy: "Share the goal, location, deadline, audience, or problem you need solved." },
      { label: "04", title: "Budget range", copy: "A range helps with planning. It is not treated as a final quote." }
    ]
  },
  {
    kicker: "Follow-up",
    title: "Where updates happen",
    copy: "The account keeps replies and next steps tied to the same request.",
    items: [
      { label: "05", title: "Messages", copy: "Use messages for questions, timing, billing, files, and delivery details." },
      { label: "06", title: "Dashboard", copy: "Return to the dashboard to review requests and project status." }
    ]
  },
  {
    kicker: "Next time",
    title: "Why the account helps later",
    copy: "Saved details make future work easier to start.",
    items: [
      { label: "07", title: "Profile", copy: "Keep contact, billing, shipping, and service preferences ready." },
      { label: "08", title: "Saved details", copy: "Future requests can start from what you already shared." }
    ]
  }
];

export const quickLinks = [
  { href: "/profile", label: "Profile", value: "Update your details" },
  { href: "/messages", label: "Messages", value: "Continue the thread" },
  { href: "/booking-manager", label: "Studio", value: "Staff review" }
];
