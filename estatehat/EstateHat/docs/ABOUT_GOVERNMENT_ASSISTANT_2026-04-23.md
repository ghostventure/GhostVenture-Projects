## EstateHat About / Government / Assistant Refresh

Date: 2026-04-23

### Scope

This release bundled the latest undeployed shared-shell updates across the About section, assistant placement, and government-profile handling.

### Included changes

- Updated the About section language from `American` to `US Citizen` and expanded the mission/positioning copy.
- Added a richer About layout with:
  - `Why EstateHat Exists`
  - `US Citizen / Residency Verification`
  - `Government Boundaries`
  - stronger platform and workflow framing
- Moved the shared EstateHat Assistant launcher/panel to bottom-center to avoid overlapping page content.
- Expanded government profile support with controlled participation boundaries and a subpoena request workflow.
- Enforced that out-of-boundary private-information requests require judge-backed paperwork including the judge's name and signature.
- Consolidated government signup/body classification to use `Municipality` in place of the prior `Village` / `Town` / `City` split.

### Files changed

- `src/estatehat-platform-alpha.jsx`
- `src/AuthScreen.jsx`
- `src/backend.js`

### Verification

- `npm run build` passed
- `npm run deploy:hosting` passed

### Production

- `https://estatehat.web.app`
