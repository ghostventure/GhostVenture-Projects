# Sign-up Feedback Page - 2026-06-06

## Summary

FoxHub now has a public feedback page for incoming users who are having trouble signing up.

## Public route

- `/feedback`
- Live URL: `https://foxhub-superapp.web.app/feedback`

## What changed

- Added a Next route wrapper at `app/feedback/page.jsx`.
- Added a public `SignupFeedbackPage` inside the React app controller.
- Added sign-up help actions from the landing page, the main sign-up page, and the older sign-up overlay.
- Added issue categories for invite code issues, email already taken, password trouble, age verification, waiting on approval, page or button trouble, and other sign-up issues.
- Added a direct support reference to `support@foxhub.app`.

## Feedback behavior

- The form does not require sign-in.
- The form stores the latest 25 feedback records locally in the browser under `foxhub-signup-feedback-requests`.
- Submitting prepares a `mailto:` draft to `support@foxhub.app` with the user's attempted email, name, issue type, invite or sponsor context, message, and captured timestamp.
- This is a visible public support lane now; it can later be connected to Firestore, email automation, or a ticket queue.

## Theme change

- Added Green Composite as a selectable theme.
- Green Composite is the default for first-time visitors.
- Returning visitors without a valid saved theme fall back to Green Composite.
- Visitors with another valid saved theme keep their choice.

## Verification

- `npm test` passed with 15/15 tests.
- `npm run build` passed and included the `/feedback` route.
- `npm run smoke:public` passed.
- Local Playwright check confirmed Green Composite as the first-visit theme and confirmed the feedback route renders.
- Firebase Hosting deploy completed for project `foxhub-superapp`.
- Live Playwright check confirmed:
  - landing route HTTP 200
  - populated React root
  - first-visit theme `green-composite`
  - visible Sign-up help action
  - `/feedback` HTTP 200
  - visible feedback form
  - visible `support@foxhub.app`
  - no console or page errors

## Preservation

After deploy and verification, the project archive was refreshed at:

- `/home/sniper-lion-main/Documents/Firebase Websites/Archives/FoxHub App.zip`
