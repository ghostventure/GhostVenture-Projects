# Black Lion Studios website functionality: 50-feature scope

## Current wave status

47 of 50 capabilities are implemented in the current local source. The new booking, private-file, payment-history, and password-recovery flows are wired to backend routes, but require Square, Firebase Storage, and email configuration to work in production. Deployment remains unverified and was not performed. The remaining items need real portfolio records, a published cancellation policy, and a defined account-retention policy.

This is the site-wide feature scope. It does not count the Project Planner's 50 field-level capabilities. `[x]` means implemented in the current local source wave; `[ ]` means not implemented. Local implementation is not the same as Firebase deployment.

## Discovery and service evaluation

1. [x] Search public pages, services, and FAQ answers from one site-wide search.
2. [x] Filter search results by page, service, or FAQ category.
3. [x] Navigate search results with the keyboard and open a selected result.
4. [x] Search FAQ questions and answers directly on the FAQ page.
5. [x] Open a matching FAQ answer from a search result using a direct page anchor.
6. [x] Compare service offerings, price context, and turnaround side by side.
7. [x] Filter service options by budget range and expected turnaround.
8. [ ] Filter portfolio work by studio branch and project type. Current gallery filters illustrative previews; real case studies and metadata are not present.
9. [x] Preview existing illustrative portfolio media in a full-screen viewer with keyboard controls.
10. [x] Recommend the most relevant service branch from a visitor's project description using transparent catalog keyword matches, with no server submission.

## Booking and request creation

11. [x] Review all request details in a final confirmation step before sending.
12. [x] Save an in-progress request form on this device and offer to restore it later.
13. [x] Generate consultation dates using the visitor's local calendar date without UTC day shifts.
14. [x] Show appointment slots from the actual Square booking calendar. Requires Square access token, location, and consultation service configuration.
15. [x] Reserve the selected slot through Square before saving the request; use a stable booking-attempt idempotency key and cancel an orphaned Square booking if request persistence fails. Requires Square configuration.
16. [x] Let clients request a new time for an existing appointment using account-owned Square availability and booking updates. Requires Square configuration.
17. [ ] Let clients cancel an appointment with a clear policy and confirmation. Client cancellation and confirmation UI are wired; a published cancellation policy is still missing.
18. [x] Start a new request from a previous request's service and project details.
19. [x] Attach reference files to requests with private, per-account access through authenticated upload/list routes and short-lived signed downloads. Requires `FIREBASE_STORAGE_BUCKET` configuration.
20. [x] Validate request fields together and show a summary of what needs attention.

## Client dashboard

21. [x] Refresh request statuses without reloading the whole page.
22. [x] Filter request history by status.
23. [x] Sort request history from newest or oldest.
24. [x] Expand a request to review its saved details and appointment information.
25. [x] Show a dated request activity timeline with request submission, manager status/payment updates, invoice sent, and Square booking changes.
26. [x] Surface requests that need a client response or action, including unpaid Square invoices.
27. [x] Show current appointment and invoice state together with dated appointment/invoice changes in request activity.
28. [x] Download a portable copy of a submitted request and its status.
29. [x] Show Square payment and refund events, net paid total, payment status, and available receipt links in each request's history. Requires the Square payment/refund webhooks and receipt URLs to be configured and receiving events.
30. [x] Export confirmed Square appointments to a personal calendar file.

## Client inbox and support

31. [x] Refresh messages and report whether new messages arrived.
32. [x] Search the subject and body of loaded messages.
33. [x] Copy an individual message with on-screen and screen-reader feedback.
34. [x] Mark an owned conversation read or unread with server-saved message state.
35. [x] Show a server-counted unread studio-message count in the client navigation.
36. [x] Link client messages to an owned request and filter the inbox by request or general support.
37. [x] Attach private files directly to an individual client message. Files are uploaded after message creation, linked to that message, and downloadable through owner-authenticated short-lived signed URLs. Failed uploads can be retried without resending the message; studio managers have request/message-scoped retrieval routes. Requires `FIREBASE_STORAGE_BUCKET` configuration.
38. [x] Retry message loading in place after a temporary network failure.

## Account and profile controls

39. [x] Recover a forgotten password using a rate-limited, single-use, expiring token delivered by email. Requires recovery email delivery configuration.
40. [x] Change a password from account settings after verifying the current password; atomically bump the account auth version and invalidate older sessions.
41. [x] Jump directly to profile sections from a persistent section menu.
42. [x] Warn before leaving the profile with unsaved changes.
43. [x] Discard profile edits and return to the last loaded values.
44. [x] Show completion and browser-validation status for each profile section.
45. [x] Download a copy of the account profile data.
46. [ ] Submit an account deletion request with clear retention and follow-up details. The authenticated request and manager review queue exist; the retention policy and deletion timing still need to be defined.

## Accessibility and preferences

47. [x] Increase or reduce the site's base text size.
48. [x] Turn on stronger contrast for text and interface borders.
49. [x] Reduce motion manually and honor the operating system's reduced-motion setting.
50. [x] Save accessibility preferences in this browser and apply them across site pages.
