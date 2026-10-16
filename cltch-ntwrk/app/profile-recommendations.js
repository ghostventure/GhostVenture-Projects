const MAX_PROFILE_RECOMMENDATIONS = 8;

const PROFILE_FIELDS = Object.freeze([
  { key: 'firstName', label: 'Add your first name', href: '#firstName', complete: (profile) => hasText(profile.firstName) },
  { key: 'lastName', label: 'Add your last name', href: '#lastName', complete: (profile) => hasText(profile.lastName) },
  { key: 'zipCode', label: 'Add your ZIP code', href: '#zipCode', complete: (profile) => hasText(profile.zipCode) },
  { key: 'genres', label: 'Choose at least one style or genre', href: '#genreGrid', complete: (profile) => Array.isArray(profile.genres) && profile.genres.length > 0 },
  { key: 'rate', label: 'Add your rate', href: '#rate', complete: (profile) => hasText(profile.rate) },
  { key: 'bio', label: 'Add a short bio', href: '#bio', complete: (profile) => hasText(profile.bio) },
  { key: 'payoutMethod', label: 'Choose a payout method', href: '#payoutMethod', complete: (profile) => hasText(profile.payoutMethod) },
  {
    key: 'payoutHandle',
    label: 'Add the details for your selected payout method',
    href: '#payoutHandle',
    complete: (profile) => !requiresPayoutHandle(profile.payoutMethod) || hasText(profile.payoutHandle)
  }
]);

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function requiresPayoutHandle(method) {
  return hasText(method) && method !== 'check' && method !== 'plaid';
}

export function getMissingProfileRecommendations(profile = {}) {
  return PROFILE_FIELDS
    .filter((field) => !field.complete(profile))
    .slice(0, MAX_PROFILE_RECOMMENDATIONS)
    .map(({ key, label, href }) => ({ key, label, href }));
}

export function renderProfileRecommendations(container, profile = {}) {
  if (!container) return [];
  const missing = getMissingProfileRecommendations(profile);
  container.replaceChildren();

  const heading = document.createElement('h2');
  heading.textContent = missing.length ? 'Profile recommendations' : 'Profile looks complete';
  container.append(heading);

  const summary = document.createElement('p');
  summary.textContent = missing.length
    ? `${missing.length} profile item${missing.length === 1 ? '' : 's'} still count toward profile completion.`
    : 'All fields currently counted toward profile completion are filled in.';
  container.append(summary);

  if (missing.length) {
    const list = document.createElement('ul');
    missing.forEach(({ label, href }) => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = href;
      link.textContent = label;
      item.append(link);
      list.append(item);
    });
    container.append(list);
  }

  return missing;
}
