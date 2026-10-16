/** Run an optional check-in write only after current eligibility and explicit consent pass. */
export async function confirmArrivalWithConsent({ allowed, consentChecked, write }) {
  if (allowed !== true || consentChecked !== true || typeof write !== 'function') return false;
  await write();
  return true;
}
