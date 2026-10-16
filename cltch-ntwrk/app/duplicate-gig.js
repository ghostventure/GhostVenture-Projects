function normalize(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function findPotentialDuplicateGig(candidate, existingGigs) {
  if (!candidate || !Array.isArray(existingGigs)) return null;
  const venue = normalize(candidate.venue);
  const location = normalize(candidate.location);
  const date = String(candidate.date || '').trim();
  const time = String(candidate.time || '').trim();
  if (!venue || !location || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;

  return existingGigs.find((gig) => {
    if (!gig || (candidate.hostId && gig.hostId !== candidate.hostId)) return false;
    const status = normalize(gig.status);
    if (status !== 'open' && status !== 'accepted') return false;
    return normalize(gig.venue) === venue
      && normalize(gig.location) === location
      && String(gig.date || '').trim() === date
      && String(gig.time || '').trim() === time;
  }) || null;
}
