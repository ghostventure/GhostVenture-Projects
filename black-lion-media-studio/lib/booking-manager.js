import fs from "node:fs";
import path from "node:path";

const defaultManagerEmails = ["manager@blacklionstudios.com"];

function parseEnvEmails() {
  return String(process.env.BOOKING_MANAGER_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function parseConfigEmails() {
  const configPath = path.join(process.cwd(), "config", "booking-managers.json");

  try {
    if (!fs.existsSync(configPath)) {
      return [];
    }

    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.emails)
      ? parsed.emails.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

export function getBookingManagerEmails() {
  return [...new Set([...defaultManagerEmails, ...parseEnvEmails(), ...parseConfigEmails()])];
}

export function isBookingManagerEmail(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  return Boolean(normalizedEmail && getBookingManagerEmails().includes(normalizedEmail));
}

export function isBookingManager(user) {
  if (!user) {
    return false;
  }

  if (user.is_booking_manager === true || user.isBookingManager === true) {
    return true;
  }

  return isBookingManagerEmail(user.email);
}
