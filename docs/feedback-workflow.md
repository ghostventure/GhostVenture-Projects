# Customer feedback workflow

The public website provides `/feedback/` for product feedback. A customer must be signed in with a verified Firebase email before the form is available.

Each submission records a feedback type, a one-to-five rating, a short description, whether follow-up is welcome, the authenticated account identifier and email, a server timestamp, and a `New` status in the private Firestore `product_feedback` collection.

Firestore rules allow only a verified user to create a bounded feedback record for their own identity. Read, update, and delete access are denied to website clients, so customers cannot view one another's feedback. Product staff review submissions in the authenticated `overhead-office` Firestore console under `product_feedback`; do not export or share feedback containing sensitive customer information.

The page warns customers not to submit passwords, recovery codes, payment details, or unredacted customer records. Support issues that require diagnosis should still go through `/support/`.
