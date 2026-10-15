import assert from "node:assert/strict";
import test from "node:test";

import { createCaptchaChallenge, validateCaptchaProof } from "../src/captchaGuard.js";

test("captcha challenge validates the expected answer", () => {
  const challenge = createCaptchaChallenge(1000);
  assert.equal(validateCaptchaProof({ captchaChallenge: challenge, captchaAnswer: challenge.answer }, 2000), "");
});

test("captcha challenge blocks missing, wrong, stale, and honeypot answers", () => {
  const challenge = { id: "captcha-test", prompt: "12 + 4", answer: "16", issuedAt: 1000 };
  assert.equal(validateCaptchaProof({}, 2000), "Complete the robot check before creating an account.");
  assert.equal(validateCaptchaProof({ captchaChallenge: challenge }, 2000), "Enter the robot check answer.");
  assert.equal(validateCaptchaProof({ captchaChallenge: challenge, captchaAnswer: "15" }, 2000), "Robot check answer does not match.");
  assert.equal(validateCaptchaProof({ captchaChallenge: challenge, captchaAnswer: "16", website: "https://bot.example" }, 2000), "Robot check failed.");
  assert.equal(validateCaptchaProof({ captchaChallenge: challenge, captchaAnswer: "16" }, 11 * 60 * 1000), "Robot check expired. Refresh it and try again.");
});

