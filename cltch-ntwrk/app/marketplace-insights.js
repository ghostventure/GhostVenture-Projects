export const MARKETPLACE_INSIGHTS_FEED_LIMIT = 120;
export const MARKETPLACE_INSIGHTS_LOOKAHEAD_DAYS = 180;
export const MARKETPLACE_INSIGHTS_MINIMUM_HOSTS = 5;

function parseIsoDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

function quarterFor(day) {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  const quarter = Math.floor((month - 1) / 3) + 1;
  return { key: `${year}-Q${quarter}`, year, quarter, label: `Q${quarter} ${year}` };
}

export function summarizeUpcomingSupply(records, {
  feedLimit = MARKETPLACE_INSIGHTS_FEED_LIMIT,
  minimumHosts = MARKETPLACE_INSIGHTS_MINIMUM_HOSTS
} = {}) {
  const limit = Number.isInteger(feedLimit) && feedLimit > 0 ? feedLimit : MARKETPLACE_INSIGHTS_FEED_LIMIT;
  const minHosts = Number.isInteger(minimumHosts) && minimumHosts > 0 ? minimumHosts : MARKETPLACE_INSIGHTS_MINIMUM_HOSTS;
  const loaded = Array.isArray(records) ? records.slice(0, limit) : [];
  const quarters = new Map();
  let datedListingCount = 0;

  for (const record of loaded) {
    const day = parseIsoDay(record?.date);
    const hostId = typeof record?.hostId === 'string' ? record.hostId.trim() : '';
    if (!day || !hostId) continue;
    datedListingCount += 1;
    const quarter = quarterFor(day);
    if (!quarters.has(quarter.key)) quarters.set(quarter.key, { ...quarter, listingCount: 0, privateHostIds: new Set() });
    const bucket = quarters.get(quarter.key);
    bucket.listingCount += 1;
    bucket.privateHostIds.add(hostId);
  }

  const allBuckets = [...quarters.values()];
  const visibleQuarters = allBuckets
    .filter((bucket) => bucket.privateHostIds.size >= minHosts)
    .sort((a, b) => a.year - b.year || a.quarter - b.quarter)
    .map(({ key, label, listingCount }) => ({ key, label, listingCount }));

  return {
    loadedListingCount: loaded.length,
    datedListingCount,
    visibleQuarters,
    hasSuppressedQuarters: allBuckets.some((bucket) => bucket.privateHostIds.size < minHosts),
    feedLimitReached: loaded.length >= limit,
    minimumHosts: minHosts
  };
}

export function describeUpcomingSupply(snapshot) {
  const valid = Number(snapshot?.datedListingCount) || 0;
  const loaded = Number(snapshot?.loadedListingCount) || 0;
  const coverage = `${valid} of ${loaded} loaded open listings had a valid event date and host record.`;
  const limitations = [
    `This current snapshot uses the upcoming ${MARKETPLACE_INSIGHTS_LOOKAHEAD_DAYS}-day open-gig feed (up to ${MARKETPLACE_INSIGHTS_FEED_LIMIT} listings) and may contain partial calendar quarters.`,
    'It describes only the currently loaded feed; it is not historical seasonality and is not a forecast.'
  ];
  if (snapshot?.feedLimitReached) limitations.push(`The feed reached its ${MARKETPLACE_INSIGHTS_FEED_LIMIT}-listing cap, so additional upcoming gigs may be omitted.`);
  const privacy = snapshot?.hasSuppressedQuarters
    ? `Quarter groups with fewer than ${snapshot.minimumHosts} distinct hosts are hidden.`
    : `Quarter groups are shown only when at least ${snapshot?.minimumHosts || MARKETPLACE_INSIGHTS_MINIMUM_HOSTS} distinct hosts are represented.`;
  const empty = snapshot?.visibleQuarters?.length
    ? ''
    : snapshot?.hasSuppressedQuarters
      ? 'There is not enough host diversity in this sample to show a quarter breakdown.'
      : 'No quarter in the current sample has enough listings to show a breakdown.';
  return { coverage, limitations: limitations.join(' '), privacy, empty };
}
