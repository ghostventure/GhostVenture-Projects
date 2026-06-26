import nodemailer from "nodemailer";
import { isBookingManager } from "./booking-manager";

const defaultMessageAlertTo = "blacklionmediastudio@gmail.com";
const defaultSiteUrl = "https://black-lion-media-studio.web.app";

function asText(value, fallback = "") {
  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value).trim();
}

function escapeHtml(value) {
  return asText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getSmtpConfig() {
  const host = asText(process.env.SMTP_HOST);
  const user = asText(process.env.SMTP_USER);
  const pass = asText(process.env.SMTP_PASS);

  if (!host || !user || !pass) {
    return null;
  }

  const port = Number(process.env.SMTP_PORT || 465);
  const secure =
    process.env.SMTP_SECURE === "false"
      ? false
      : process.env.SMTP_SECURE === "true" || port === 465;

  return {
    host,
    port,
    secure,
    auth: {
      user,
      pass
    },
    connectionTimeout: 7000,
    greetingTimeout: 5000,
    socketTimeout: 10000
  };
}

function buildClientName(user) {
  return asText(user?.full_name || user?.fullName || user?.email, "Client");
}

export async function notifyNewClientMessage({ user, subject, body }) {
  if (isBookingManager(user)) {
    return { skipped: true, reason: "manager-message" };
  }

  const smtpConfig = getSmtpConfig();
  if (!smtpConfig) {
    console.warn("Client message email alert skipped: SMTP_HOST, SMTP_USER, or SMTP_PASS is not configured.");
    return { skipped: true, reason: "smtp-not-configured" };
  }

  const alertTo = asText(process.env.CLIENT_MESSAGE_ALERT_TO, defaultMessageAlertTo);
  const from = asText(process.env.SMTP_FROM, smtpConfig.auth.user);
  const siteUrl = asText(process.env.SITE_BASE_URL, defaultSiteUrl).replace(/\/+$/, "");
  const clientName = buildClientName(user);
  const clientEmail = asText(user?.email);
  const safeSubject = asText(subject, "New client message").slice(0, 120);
  const safeBody = asText(body).slice(0, 4000);
  const dashboardUrl = `${siteUrl}/booking-manager`;
  const profileUrl = `${siteUrl}/profile`;

  const transporter = nodemailer.createTransport(smtpConfig);

  await transporter.sendMail({
    to: alertTo,
    from,
    replyTo: clientEmail || undefined,
    subject: `New client message: ${safeSubject}`,
    text: [
      "A client sent a new message in the Black Lion Studios portal.",
      "",
      `Client: ${clientName}`,
      clientEmail ? `Email: ${clientEmail}` : "Email: Not available",
      `Subject: ${safeSubject}`,
      "",
      safeBody,
      "",
      `Manager dashboard: ${dashboardUrl}`,
      `Client profile route: ${profileUrl}`
    ].join("\n"),
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#122017">
        <h2>New client message</h2>
        <p>A client sent a new message in the Black Lion Studios portal.</p>
        <p><strong>Client:</strong> ${escapeHtml(clientName)}</p>
        <p><strong>Email:</strong> ${escapeHtml(clientEmail || "Not available")}</p>
        <p><strong>Subject:</strong> ${escapeHtml(safeSubject)}</p>
        <div style="margin:18px 0;padding:14px;border:1px solid #d7dfd2;border-radius:10px;background:#f7f8f3">
          ${escapeHtml(safeBody).replaceAll("\n", "<br />")}
        </div>
        <p><a href="${escapeHtml(dashboardUrl)}">Open manager dashboard</a></p>
      </div>
    `
  });

  return { sent: true, to: alertTo };
}

export async function notifyNewModelApplication(application) {
  const smtpConfig = getSmtpConfig();
  if (!smtpConfig) {
    console.warn("Model application email alert skipped: SMTP_HOST, SMTP_USER, or SMTP_PASS is not configured.");
    return { skipped: true, reason: "smtp-not-configured" };
  }

  const alertTo = asText(process.env.MODEL_APPLICATION_ALERT_TO, defaultMessageAlertTo);
  const from = asText(process.env.SMTP_FROM, smtpConfig.auth.user);
  const siteUrl = asText(process.env.SITE_BASE_URL, defaultSiteUrl).replace(/\/+$/, "");
  const applicantName = asText(application.displayName || application.legalName, "Model applicant");
  const applicantEmail = asText(application.email);
  const projectTypes = Array.isArray(application.projectTypes)
    ? application.projectTypes.join(", ")
    : asText(application.projectTypes);
  const modelingInterests = Array.isArray(application.modelingInterests)
    ? application.modelingInterests.join(", ")
    : asText(application.modelingInterests);

  const transporter = nodemailer.createTransport(smtpConfig);

  await transporter.sendMail({
    to: alertTo,
    from,
    replyTo: applicantEmail || undefined,
    subject: `New model application: ${applicantName}`,
    text: [
      "A model submitted a Black Lion Studios project application.",
      "",
      `Name: ${applicantName}`,
      `Legal name: ${asText(application.legalName)}`,
      applicantEmail ? `Email: ${applicantEmail}` : "Email: Not available",
      application.phone ? `Phone: ${application.phone}` : "Phone: Not provided",
      `City/service area: ${asText(application.city)}`,
      `Date of birth: ${asText(application.dateOfBirth)}`,
      application.pronouns ? `Pronouns: ${application.pronouns}` : "",
      application.height ? `Height: ${application.height}` : "",
      application.clothingSizes ? `Clothing sizes: ${application.clothingSizes}` : "",
      application.hairColor ? `Hair color: ${application.hairColor}` : "",
      application.eyeColor ? `Eye color: ${application.eyeColor}` : "",
      application.tattoosPiercings ? `Tattoos/piercings: ${application.tattoosPiercings}` : "",
      `Project types: ${projectTypes}`,
      `Modeling interests: ${modelingInterests}`,
      "",
      "Availability:",
      asText(application.availability),
      "",
      "Travel readiness:",
      asText(application.travelReadiness),
      "",
      "Compensation expectation:",
      asText(application.compensationExpectation),
      "",
      "Usage comfort:",
      asText(application.usageComfort),
      "",
      "Wardrobe/styling comfort:",
      asText(application.wardrobeComfort),
      "",
      "Production pace readiness:",
      asText(application.productionPace),
      "",
      "Quality standards:",
      asText(application.qualityStandards),
      "",
      "Reliability examples:",
      asText(application.reliabilityExamples),
      "",
      "Preparation process:",
      asText(application.preparationProcess),
      "",
      "Portfolio:",
      asText(application.portfolioUrl || "Not provided"),
      application.instagram ? `Instagram: ${application.instagram}` : "",
      application.otherSocials ? `Other socials: ${application.otherSocials}` : "",
      "",
      "Experience:",
      asText(application.experience),
      "",
      application.relevantSkills ? `Relevant skills:\n${application.relevantSkills}` : "",
      "",
      application.notes ? `Notes:\n${application.notes}` : "",
      "",
      `Manager dashboard: ${siteUrl}/booking-manager`
    ].filter(Boolean).join("\n"),
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#122017">
        <h2>New model application</h2>
        <p>A model submitted a Black Lion Studios project application.</p>
        <p><strong>Name:</strong> ${escapeHtml(applicantName)}</p>
        <p><strong>Legal name:</strong> ${escapeHtml(application.legalName)}</p>
        <p><strong>Email:</strong> ${escapeHtml(applicantEmail || "Not available")}</p>
        <p><strong>Phone:</strong> ${escapeHtml(application.phone || "Not provided")}</p>
        <p><strong>City/service area:</strong> ${escapeHtml(application.city)}</p>
        <p><strong>Date of birth:</strong> ${escapeHtml(application.dateOfBirth)}</p>
        <p><strong>Pronouns:</strong> ${escapeHtml(application.pronouns || "Not provided")}</p>
        <p><strong>Height:</strong> ${escapeHtml(application.height || "Not provided")}</p>
        <p><strong>Clothing sizes:</strong> ${escapeHtml(application.clothingSizes || "Not provided")}</p>
        <p><strong>Hair / eye:</strong> ${escapeHtml([application.hairColor, application.eyeColor].filter(Boolean).join(" / ") || "Not provided")}</p>
        <p><strong>Tattoos or piercings:</strong> ${escapeHtml(application.tattoosPiercings || "Not provided")}</p>
        <p><strong>Project types:</strong> ${escapeHtml(projectTypes)}</p>
        <p><strong>Modeling interests:</strong> ${escapeHtml(modelingInterests)}</p>
        <p><strong>Availability:</strong><br />${escapeHtml(application.availability).replaceAll("\n", "<br />")}</p>
        <p><strong>Travel readiness:</strong><br />${escapeHtml(application.travelReadiness).replaceAll("\n", "<br />")}</p>
        <p><strong>Compensation expectation:</strong><br />${escapeHtml(application.compensationExpectation).replaceAll("\n", "<br />")}</p>
        <p><strong>Usage comfort:</strong><br />${escapeHtml(application.usageComfort).replaceAll("\n", "<br />")}</p>
        <p><strong>Wardrobe/styling comfort:</strong><br />${escapeHtml(application.wardrobeComfort).replaceAll("\n", "<br />")}</p>
        <p><strong>Production pace readiness:</strong><br />${escapeHtml(application.productionPace).replaceAll("\n", "<br />")}</p>
        <p><strong>Quality standards:</strong><br />${escapeHtml(application.qualityStandards).replaceAll("\n", "<br />")}</p>
        <p><strong>Reliability examples:</strong><br />${escapeHtml(application.reliabilityExamples).replaceAll("\n", "<br />")}</p>
        <p><strong>Preparation process:</strong><br />${escapeHtml(application.preparationProcess).replaceAll("\n", "<br />")}</p>
        <p><strong>Portfolio:</strong> ${escapeHtml(application.portfolioUrl || "Not provided")}</p>
        <p><strong>Instagram:</strong> ${escapeHtml(application.instagram || "Not provided")}</p>
        <p><strong>Other socials:</strong> ${escapeHtml(application.otherSocials || "Not provided")}</p>
        <div style="margin:18px 0;padding:14px;border:1px solid #d7dfd2;border-radius:10px;background:#f7f8f3">
          <strong>Experience</strong><br />
          ${escapeHtml(application.experience).replaceAll("\n", "<br />")}
        </div>
        ${application.relevantSkills ? `<p><strong>Relevant skills:</strong><br />${escapeHtml(application.relevantSkills).replaceAll("\n", "<br />")}</p>` : ""}
        ${application.notes ? `<p><strong>Notes:</strong><br />${escapeHtml(application.notes).replaceAll("\n", "<br />")}</p>` : ""}
        <p><a href="${escapeHtml(`${siteUrl}/booking-manager`)}">Open manager dashboard</a></p>
      </div>
    `
  });

  return { sent: true, to: alertTo };
}
