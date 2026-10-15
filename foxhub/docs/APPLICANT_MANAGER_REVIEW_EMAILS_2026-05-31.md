# Applicant Manager Review Emails - 2026-05-31

## Summary

FoxHub no-invite signups now enter manager review. A manager can approve, priority-approve, hold, or reject the FoxHub Member application from the Management dashboard.

## Behavior

- Applicants with an invite still use the priority access path.
- Applicants without an invite are kept in review instead of receiving immediate member access.
- The Management dashboard shows those records in `FoxHub Member applications`.
- Approve and Priority decisions activate the applicant account.
- Reject keeps the applicant out of member access.
- Hold keeps the applicant in review.
- Each manager decision records an applicant email notice:
  - approved
  - denied
  - follow-up needed

## Implementation Notes

- `src/App.jsx` updates the applicant-facing copy so no-invite applicants know a manager will approve or deny the request and email the decision.
- `src/useFoxHubStore.js` creates manager-review notifications and applicant email notice records.
- `src/repository-local.js` updates the saved local applicant profile after manager approval or denial so the applicant can sign in after approval.
- `src/repository-firebase.js` updates the matching Firebase user profile by email and queues a `transactionalEmailEvents` record when Firebase mode is active.
- `src/FoxHubShell.jsx` adds an `Applicant email notices` panel to Management.

## Verification

Current deploy and live verification stay consolidated in `docs/CURRENT_HANDOFF_2026-05-31.md`.
