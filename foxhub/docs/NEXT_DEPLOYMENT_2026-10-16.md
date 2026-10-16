# FoxHub Next.js Deployment — October 16, 2026

## Deployment

- Firebase project: `foxhub-c984b`
- Hosting URL: `https://foxhub-c984b.web.app`
- Deployment command: `npm run deploy:next`
- The deployment completed successfully and deployed the `nextApp` Firebase Function with Firebase Hosting rewrites.
- The function is configured for public invocation so Hosting rewrites can serve the Next.js app.
- The Functions runtime is Node.js 22.

## Verification and scope

- The homepage and `/api/health` returned HTTP 200 after deployment.
- The health endpoint reported `ready`; `opsSecretConfigured` and `stripeWebhookConfigured` were false.
- Firestore rules were not deployed. Authenticated member flows, Stripe processing, and ops webhook behavior were not verified.
