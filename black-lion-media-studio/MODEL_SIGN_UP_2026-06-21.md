# Model Sign-up Implementation - 2026-06-21

## Summary

Installed a dedicated `Model Sign-up` workflow at `/models` for Black Lion Studios. Model accounts are intentionally separate from client accounts and are used for casting review, production-readiness screening, manager search, PII/profile maintenance, and project-term follow-up.

## Workflow Order

1. Public homepage shows a visible `Are you a model?` CTA to `/models`.
2. `/models` presents the Model Sign-up form, model review notices, 100+ page units, and a Model FAQ.
3. The applicant enters account basics, username/password, DOB, contact details, Instagram/portfolio links, project types, modeling interests, availability, production-readiness answers, compensation/usage/wardrobe terms, and legal acknowledgments.
4. `/api/model-applications` validates same-origin mutation, rate limit, schema, 18+ DOB, new email requirement, unique username, required project/modeling interests, 1099 independent-contractor disclosure, 90-day reapply acknowledgment, no-show acknowledgment, Terms/Privacy acceptance, and contact consent.
5. On success, Firestore stores both a `model_applications` record and a separate model user profile.
6. The user receives a signed session and is redirected to `/profile` for comprehensive PII/profile updates.
7. Managers use `/booking-manager` to search model profiles separately from client request lists.

## Data Contract

- Model users use `roles: ["model"]`, `user_type: "Model"`, `client_tier: "Model"`, and service interest `Model Sign-up`.
- Public model signup blocks existing account emails to avoid password takeover.
- Usernames are normalized lowercase and uniqueness-checked on signup, model signup, and profile update.
- Model Sign-up writes use Firestore reservation/lock documents for email and username duplicate resistance so simultaneous submissions cannot both create the same model application/account.
- Model Sign-up draft details autosave in the browser while the applicant types and restore if the applicant returns; the password is intentionally not retained locally and must be re-entered.
- Successful submission clears the local draft and inserts the entered model data into both the model application record and the separate model user profile.
- Legal/contract/reapply/no-show/contact acknowledgments are retained in the application/profile data for workflow evidence.
- Model applicants must acknowledge that model projects are offered as project-based 1099 independent-contractor opportunities, not full-time W-2 employment, with no payroll withholding, employee benefits, or guaranteed hours unless a separate written agreement says otherwise.
- Model applications are limited to once every 3 months per email.
- Application records store `next_eligible_application_at`, `attendance_status`, `no_show_count`, and `queue_status`.
- Custom profile fields now allow up to 80 keys and 2000 characters per value so comprehensive model profile details are retained.

## Model Profile Coverage

The model profile captures legal/stage name, username, DOB, phone, city/service area, pronouns, height, clothing sizes, hair color, eye color, tattoos/piercings/visible marks, portfolio link, Instagram, other social links, project types, modeling interests, availability, travel readiness, compensation expectations, usage comfort, wardrobe/styling comfort, production pace, quality standards, reliability examples, preparation process, relevant skills, notes, queue status, and no-show count.

Modeling interests include Fashion, Portrait, Lifestyle, Commercial, Product/Merch, Editorial, Fitness, Music Video, Event Promo, Beauty/Grooming, Streetwear, and Brand Campaign.

## Manager Search

`/booking-manager` now includes a model-only search panel. Managers can search model profiles by name, username, email, phone, Instagram, city, project types, modeling interests, availability, travel readiness, production pace, quality standards, reliability, preparation process, queue status, and lifecycle stage.

## Legal And Compliance Notes

- Model Sign-up is adult-only and requires server-side 18+ validation.
- Submission does not create employment, agency representation, a contract, exclusivity, a booking, or guaranteed paid work.
- Model Sign-up states that project opportunities are intended as 1099 independent-contractor opportunities, not full-time W-2 employment. Final worker classification still depends on actual project terms and applicable law.
- Compensation, schedule, usage rights, release terms, wardrobe/styling expectations, cancellation/no-show terms, and deliverables are confirmed separately before project booking.
- Model profiles are separate from client profiles and should not be publicly exposed.
- Privacy/Terms/FAQ/DMCA/legal copy now covers model applicant PII, portfolio/social links, retention, correction/deletion requests, copyright materials, and sponsored/paid content disclosure expectations.
- DMCA/copyright handling remains allegation-based and includes model-submitted portfolio/reference materials.

## Key Files

- `app/models/page.js`
- `components/model-application-form.js`
- `components/model-application-component-library.js`
- `components/profile-app.js`
- `components/booking-manager-app.js`
- `components/site-footer.js`
- `app/page.js`
- `app/api/model-applications/route.js`
- `app/api/profile/route.js`
- `app/api/signup/route.js`
- `lib/db.js`
- `lib/validation.js`
- `lib/services.js`
- `lib/email-notifications.js`
- `lib/manager-dashboard-data.js`
- `lib/model-application-components.js`
- `lib/legal-content.js`
- `app/globals.css`
- `app/sitemap.js`

## Verification

- `node --check` passed for edited JavaScript files.
- `npm run build` passed.
- IRS and U.S. Department of Labor guidance was checked for independent-contractor disclosure framing.
- Local smoke verified `/models` returns HTTP 200.
- Local smoke verified malformed JSON to `/api/model-applications` returns HTTP 400.
- Local smoke verified empty payload to `/api/model-applications` returns HTTP 400.
- Local smoke verified an under-18 DOB payload returns HTTP 400 with `Model applicants must be at least 18 years old.`
- Model Sign-up detects another open instance in another tab and displays `another instance of this is open`; it also closes or quietly exits after 20 minutes of no activity on that page.
- Local homepage smoke confirmed the `Are you a model?` CTA is rendered.
- New Model Sign-up CSS uses existing theme variables and no hard-coded light-only colors were found in the added model selectors.
- `npm run deploy:full` completed successfully for Firebase project `black-lion-media-studio`.
- Live `/models` returned HTTP 200.
- Live `/models` content check found `Model Sign-up`, `Model FAQ`, `Fashion`, `Portrait`, `Terms of Use and Privacy Policy`, and `100+ model application components installed`.
- Live homepage content check found `Are you a model?`.
- Live `/api/model-applications` rejected an empty payload with HTTP 400.
- Final live smoke after adding the 1099/W-2 disclosure found `1099 independent-contractor` and `not full-time W-2 employment` on `/models`.
- Final live API smoke confirmed an otherwise-valid payload without the 1099 disclosure is rejected with HTTP 400, and an under-18 payload with the disclosure still rejects with `Model applicants must be at least 18 years old.`
- Live valid-write smoke was submitted after owner approval and returned HTTP 201. It created model application `BA9lxwvDTJQQm4QocCkf` and separate model user `wSozquJowaA9VYUMhTqZ` using the smoke-test email `smoke.model+1782006295214@example.com`, username `smoke-model-1782006295214`, `roles: ["model"]`, `user_type: "Model"`, and service interest `Model Sign-up`.
- Cleanup: the production smoke-test model application, model user, email lock, and username reservation were removed with targeted Firebase CLI `firestore:delete --force` commands. Local Admin SDK readback was unavailable because application default credentials are not configured in this shell.
