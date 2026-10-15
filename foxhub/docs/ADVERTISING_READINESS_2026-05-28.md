# FoxHub Advertising Readiness - 2026-05-28

## Summary

Prepared the public FoxHub web surface for small advertising tests.

## Installed

- Added lightweight campaign-source capture for ad links.
- Added `utm_source`, `utm_campaign`, `utm_medium`, `utm_term`, and `utm_content` persistence in browser local storage.
- Added a visible campaign source note on the splash page when a campaign link is used.
- Added stronger public page copy for key footer destinations:
  - Privacy Policy
  - Terms of Use
  - Help Center
  - Contact Support
  - Safety Center
  - System Status
  - Mission
  - What's Inside
- Kept the privacy splash copy focused on FoxHub's design direction without naming specific competitors.
- Added a broader privacy line without spotlighting specific age groups.
- Clarified that safety checks should focus on abuse, fraud, security, and illegal activity, not ordinary private life.
- Updated release smoke coverage to verify campaign copy, privacy page copy, footer routes, and current Organizer count.

## Suggested Test Links

Use these for early ad tests:

```text
https://foxhub-superapp.web.app/?utm_source=facebook&utm_medium=paid-social&utm_campaign=privacy-first-alpha
https://foxhub-superapp.web.app/?utm_source=instagram&utm_medium=paid-social&utm_campaign=trusted-circles
https://foxhub-superapp.web.app/?utm_source=local&utm_medium=flyer&utm_campaign=founding-members
```

## Positioning Notes

- Private circles for people you actually know.
- Local help, groups, and trusted recommendations in one place.
- Useful online space for literally almost anyone who has had enough with being watched online.
- Early access for founding members.

## Guardrails

- Keep ad claims tied to the current app state.
- Do not market FoxHub as a production bank, payment processor, or full marketplace until the backend authority path is live.
- Do not imply final legal/privacy terms are finished until legal copy is reviewed.

## Verification

Completed:

- `npm run release:check` (pass)
- `npm run deploy:hosting` (pass)
- live campaign URL: `https://foxhub-superapp.web.app/?utm_source=facebook&utm_medium=paid-social&utm_campaign=privacy-first-alpha` (HTTP 200)
- live privacy footer route: `https://foxhub-superapp.web.app/footer/legal/privacy-policy` (HTTP 200)
- live mission route: `https://foxhub-superapp.web.app/footer/company/mission` (HTTP 200)
- live `Last-Modified`: `Thu, 28 May 2026 11:26:58 GMT`
- live JS bundle contains `Ad source`, `utm_source`, `Your private activity should stay private`, `literally almost anyone who has had enough with being watched online`, and `What is private stays private`
- live JS bundle contains `private messages or personal images for ad profiles`, `abuse, fraud, security, and illegal activity`, and `feeling watched`
- live CSS bundle contains `landing-campaign-note` and `landing-privacy-note`

## Current Deployment

Firebase Hosting is live at:

```text
https://foxhub-superapp.web.app
```
