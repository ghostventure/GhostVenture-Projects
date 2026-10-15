const CAPTCHA_TTL_MS = 10 * 60 * 1000;

function randomInt(min, max) {
  const lower = Math.ceil(min);
  const upper = Math.floor(max);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return lower + (array[0] % (upper - lower + 1));
  }
  return Math.floor(Math.random() * (upper - lower + 1)) + lower;
}

export function createCaptchaChallenge(now = Date.now()) {
  const left = randomInt(12, 39);
  const right = randomInt(4, 18);
  const checksum = randomInt(20, 99);
  return {
    id: `captcha-${now}-${checksum}`,
    prompt: `${left} + ${right}`,
    answer: String(left + right),
    issuedAt: now
  };
}

export function validateCaptchaProof(payload = {}, now = Date.now()) {
  const challenge = payload.captchaChallenge || {};
  const expected = String(challenge.answer || "").trim().toLowerCase();
  const answer = String(payload.captchaAnswer || "").trim().toLowerCase();
  const issuedAt = Number(challenge.issuedAt || 0);
  const honeypot = String(payload.website || payload.companyWebsite || "").trim();

  if (honeypot) return "Robot check failed.";
  if (!challenge.id || !expected || !issuedAt) return "Complete the robot check before creating an account.";
  if (now - issuedAt > CAPTCHA_TTL_MS) return "Robot check expired. Refresh it and try again.";
  if (!answer) return "Enter the robot check answer.";
  if (answer !== expected) return "Robot check answer does not match.";
  return "";
}

