import { z } from "zod";
import { isValidConsultationSlot } from "./consultations";
import { serviceOptions } from "./services";

const requiredText = (label, min = 1) =>
  z
    .string()
    .trim()
    .min(min, `${label} is required.`);

const optionalText = (label, max = 120, fallback = "") =>
  z.string().trim().max(max, `${label} is too long.`).optional().default(fallback);

const optionalEmail = (label) =>
  z
    .union([z.literal(""), z.email(`${label} must be valid.`)])
    .optional()
    .default("")
    .transform((value) => value.trim().toLowerCase());

const profileFieldsSchema = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
  .optional()
  .default({})
  .transform((fields) =>
    Object.fromEntries(
      Object.entries(fields)
        .map(([key, value]) => [key.trim().slice(0, 80), String(value).trim().slice(0, 2000)])
        .filter(([key, value]) => key && value)
        .slice(0, 80)
    )
  );

export const signupSchema = z.object({
  fullName: requiredText("Full name"),
  username: optionalText("Username", 40).refine(
    (value) => !value || /^[a-zA-Z0-9._-]+$/.test(value),
    "Username can use letters, numbers, dots, underscores, or hyphens."
  ),
  email: z.email("A valid email address is required.").transform((value) => value.trim().toLowerCase()),
  company: optionalText("Company"),
  phone: optionalText("Phone number", 40),
  serviceInterest: z.enum(serviceOptions, {
    error: () => "Please choose a valid service."
  }),
  userType: z.enum(["Individual", "Business", "Organization", "Creator", "Model"]).optional().default("Individual"),
  leadSource: optionalText("Lead source", 120, "Website"),
  preferredLanguage: optionalText("Preferred language", 80, "English"),
  preferredContactMethod: z
    .enum(["Email", "Phone", "Text", "Portal Message"])
    .optional()
    .default("Email"),
  website: optionalText("Website", 180),
  referralSource: optionalText("Referral source", 180),
  password: z.string().min(8, "Password must be at least 8 characters.")
});

export const loginSchema = z.object({
  email: z.email("A valid email address is required.").transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1, "Password is required.")
});

export const profileSchema = z.object({
  fullName: requiredText("Full name"),
  username: optionalText("Username", 40).refine(
    (value) => !value || /^[a-zA-Z0-9._-]+$/.test(value),
    "Username can use letters, numbers, dots, underscores, or hyphens."
  ),
  company: optionalText("Company"),
  phone: optionalText("Phone number", 40),
  serviceInterest: z.enum(serviceOptions, {
    error: () => "Please choose a valid service."
  }),
  userType: z.enum(["Individual", "Business", "Organization", "Creator", "Model"]).optional().default("Individual"),
  leadSource: optionalText("Lead source", 120, "Website"),
  preferredLanguage: optionalText("Preferred language", 80, "English"),
  pronouns: optionalText("Pronouns", 80),
  website: optionalText("Website", 180),
  instagram: optionalText("Instagram", 120),
  tiktok: optionalText("TikTok", 120),
  youtube: optionalText("YouTube", 180),
  merchInterest: z.enum(["Plugz UNTD", "Plugz RNGD", "Both", "None"]).optional().default("Both"),
  preferredContactMethod: z
    .enum(["Email", "Phone", "Text", "Portal Message"])
    .optional()
    .default("Email"),
  notificationOptIn: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .transform((value) => (value === true || value === "true" ? "true" : "false")),
  marketingOptIn: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .transform((value) => (value === true || value === "true" ? "true" : "false")),
  timezone: optionalText("Timezone", 80, "America/New_York"),
  clientNotes: optionalText("Client notes", 1200),
  projectGoals: optionalText("Project goals", 1200),
  referralSource: optionalText("Referral source", 180),
  accessibilityNotes: optionalText("Accessibility notes", 800),
  billingName: optionalText("Billing name"),
  billingEmail: optionalEmail("Billing email"),
  billingAddress: optionalText("Billing address", 400),
  preferredPaymentMethod: optionalText("Preferred payment method", 80),
  budgetProfile: optionalText("Budget profile"),
  shippingName: optionalText("Shipping name"),
  shippingAddress: optionalText("Shipping address", 400),
  shippingCity: optionalText("Shipping city"),
  shippingRegion: optionalText("Shipping region"),
  shippingPostalCode: optionalText("Shipping postal code", 30),
  shippingCountry: optionalText("Shipping country", 120, "United States"),
  taxId: optionalText("Tax ID", 80),
  profileFields: profileFieldsSchema
});

export const requestSchema = z.object({
  projectType: z.enum(serviceOptions, {
    error: () => "Please choose a valid service."
  }),
  budget: requiredText("Budget"),
  timeline: requiredText("Timeline"),
  consultationDate: requiredText("Consultation date"),
  consultationTime: requiredText("Consultation time"),
  details: z
    .string()
    .trim()
    .min(20, "Please provide at least 20 characters of order detail.")
    .max(2000, "Order details are too long.")
}).superRefine((value, context) => {
  if (!isValidConsultationSlot(value.consultationDate, value.consultationTime)) {
    context.addIssue({
      code: "custom",
      path: ["consultationTime"],
      message: "Please choose an available consultation day and time."
    });
  }
});

export const modelApplicationSchema = z.object({
  legalName: requiredText("Legal name").max(120, "Legal name is too long."),
  displayName: optionalText("Public or stage name", 120),
  username: requiredText("Username").regex(/^[a-zA-Z0-9._-]+$/, "Username can use letters, numbers, dots, underscores, or hyphens.").max(40, "Username is too long."),
  email: z.email("A valid email address is required.").transform((value) => value.trim().toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters."),
  phone: optionalText("Phone number", 40),
  city: requiredText("City or service area").max(120, "City or service area is too long."),
  dateOfBirth: requiredText("Date of birth")
    .max(40, "Date of birth is too long.")
    .refine((value) => {
      const birthDate = new Date(`${value}T00:00:00`);
      if (Number.isNaN(birthDate.getTime())) {
        return false;
      }

      const today = new Date();
      const eighteenthBirthday = new Date(
        birthDate.getFullYear() + 18,
        birthDate.getMonth(),
        birthDate.getDate()
      );
      return eighteenthBirthday <= today;
    }, "Model applicants must be at least 18 years old."),
  pronouns: optionalText("Pronouns", 80),
  height: optionalText("Height", 80),
  clothingSizes: optionalText("Clothing sizes", 220),
  hairColor: optionalText("Hair color", 80),
  eyeColor: optionalText("Eye color", 80),
  tattoosPiercings: optionalText("Tattoos or piercings", 500),
  ageConfirmation: z.literal(true, {
    error: () => "Confirm that you are at least 18 years old."
  }),
  projectTypes: z
    .array(z.string().trim().min(1).max(80))
    .min(1, "Choose at least one project type.")
    .max(8, "Choose fewer project types."),
  modelingInterests: z
    .array(z.string().trim().min(1).max(80))
    .min(1, "Choose at least one modeling interest.")
    .max(12, "Choose fewer modeling interests."),
  availability: requiredText("Availability").max(400, "Availability is too long."),
  portfolioUrl: optionalText("Portfolio link", 220),
  instagram: optionalText("Instagram", 120),
  otherSocials: optionalText("Other social links", 300),
  experience: z
    .string()
    .trim()
    .min(20, "Share at least 20 characters about your experience.")
    .max(1600, "Experience is too long."),
  relevantSkills: optionalText("Relevant skills", 800),
  travelReadiness: requiredText("Travel readiness").max(400, "Travel readiness is too long."),
  compensationExpectation: requiredText("Compensation expectation").max(400, "Compensation expectation is too long."),
  usageComfort: requiredText("Usage comfort").max(700, "Usage comfort is too long."),
  wardrobeComfort: requiredText("Wardrobe or styling comfort").max(700, "Wardrobe or styling comfort is too long."),
  productionPace: requiredText("Production pace readiness").max(700, "Production pace readiness is too long."),
  qualityStandards: requiredText("Quality standards").max(700, "Quality standards are too long."),
  reliabilityExamples: requiredText("Reliability examples").max(900, "Reliability examples are too long."),
  preparationProcess: requiredText("Preparation process").max(900, "Preparation process is too long."),
  contractReadiness: z.literal(true, {
    error: () => "Confirm that you can review and sign project paperwork before booking."
  }),
  independentContractorDisclosure: z.literal(true, {
    error: () => "Confirm that you understand model projects are 1099 independent-contractor opportunities, not full-time W-2 employment."
  }),
  reapplicationPolicy: z.literal(true, {
    error: () => "Confirm that you understand model applications are limited to once every 3 months."
  }),
  noShowPolicy: z.literal(true, {
    error: () => "Confirm that you understand missed confirmed calls may lower future priority."
  }),
  legalPolicyAcceptance: z.literal(true, {
    error: () => "Confirm that you agree to the Terms of Use and Privacy Policy."
  }),
  notes: optionalText("Additional notes", 1200),
  consentToContact: z.literal(true, {
    error: () => "Consent to be contacted is required."
  })
});

export const messageSchema = z.object({
  subject: requiredText("Subject").max(120, "Subject is too long."),
  body: z
    .string()
    .trim()
    .min(10, "Please provide at least 10 characters in your message.")
    .max(4000, "Message is too long.")
});

export const managerRequestUpdateSchema = z.object({
  status: z
    .enum([
      "New",
      "Open",
      "In Review",
      "Scheduled",
      "In Progress",
      "Awaiting Payment",
      "Completed",
      "Delivered",
      "Closed",
      "Cancelled",
      "Declined"
    ])
    .optional(),
  invoiceStatus: z
    .enum(["Pending", "Drafted", "Sent", "Overdue", "Paid", "Waived"])
    .optional(),
  paymentStatus: z
    .enum(["Pending", "Deposit Requested", "Deposit Paid", "Partial", "Paid in Full", "Refunded"])
    .optional(),
  fulfillmentStatus: z
    .enum(["Queued", "Scheduled", "In Progress", "Delivered", "On Hold", "Closed"])
    .optional(),
  internalPriority: z
    .enum(["Standard", "Priority", "Rush", "VIP"])
    .optional(),
  managerNotes: z.string().trim().max(4000, "Manager notes are too long.").optional().default("")
}).refine(
  (value) =>
    Boolean(
      value.status ||
      value.invoiceStatus ||
      value.paymentStatus ||
      value.fulfillmentStatus ||
      value.internalPriority ||
      value.managerNotes
    ),
  { message: "At least one manager update field is required." }
);

export function parseWithSchema(schema, payload) {
  const result = schema.safeParse(payload);
  if (!result.success) {
    return {
      ok: false,
      error: result.error.issues[0]?.message || "Invalid request."
    };
  }

  return {
    ok: true,
    data: result.data
  };
}
