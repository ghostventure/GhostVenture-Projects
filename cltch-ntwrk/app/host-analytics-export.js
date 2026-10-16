export const HOST_ANALYTICS_FEED_LIMIT = 200;

function parseDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : value;
}

function parsePostedPay(value) {
  if (typeof value !== 'string') return null;
  const match = value.replace(/,/g, '').match(/\d+(?:\.\d{1,2})?/);
  if (!match) return null;
  const amount = Number(match[0]);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildHostAnalyticsCsv(records, hostId, exportedAt = new Date().toISOString()) {
  if (typeof hostId !== 'string' || !hostId) throw new TypeError('A signed-in host ID is required.');
  const seen = new Set();
  const gigs = [];
  for (const row of Array.isArray(records) ? records.slice(0, HOST_ANALYTICS_FEED_LIMIT) : []) {
    const gigId = typeof row?.gigId === 'string' ? row.gigId : '';
    const gig = row?.g;
    if (!gigId || !gig || typeof gig !== 'object' || gig.hostId !== hostId || seen.has(gigId)) continue;
    seen.add(gigId);
    gigs.push(gig);
  }

  const statusCounts = { open: 0, accepted: 0, cancelled: 0, other: 0 };
  const monthCounts = new Map();
  const payAmounts = [];
  let validDateCount = 0;
  let missingDateCount = 0;
  let missingPayCount = 0;
  for (const gig of gigs) {
    const status = ['open', 'accepted', 'cancelled'].includes(gig.status) ? gig.status : 'other';
    statusCounts[status] += 1;
    const day = parseDay(gig.date);
    if (day) {
      validDateCount += 1;
      const month = day.slice(0, 7);
      monthCounts.set(month, (monthCounts.get(month) || 0) + 1);
    } else missingDateCount += 1;
    const pay = parsePostedPay(gig.pay);
    if (pay == null) missingPayCount += 1;
    else payAmounts.push(pay);
  }
  const payTotal = payAmounts.reduce((sum, amount) => sum + amount, 0);
  const avgPay = payAmounts.length ? Math.round((payTotal / payAmounts.length) * 100) / 100 : '';
  const rows = [
    ['section', 'metric', 'value', 'numerator', 'denominator', 'definition'],
    ['metadata', 'exported_at', exportedAt, '', '', 'Local export time; figures come from the currently loaded host feed.'],
    ['coverage', 'included_host_gigs', gigs.length, gigs.length, gigs.length, 'Distinct records matching the signed-in host ID, capped at the 200 newest records in the host feed.'],
    ['coverage', 'feed_limit', HOST_ANALYTICS_FEED_LIMIT, '', '', 'Older host gigs may be outside this loaded feed and are not included.'],
    ['coverage', 'gigs_with_valid_event_date', validDateCount, validDateCount, gigs.length, 'Valid YYYY-MM-DD event dates divided by included host gigs.'],
    ['coverage', 'gigs_with_unavailable_event_date', missingDateCount, missingDateCount, gigs.length, 'Missing or invalid event date count.'],
    ['coverage', 'gigs_with_unavailable_pay', missingPayCount, missingPayCount, gigs.length, 'Missing or invalid posted performer-pay count.'],
    ['pay', 'average_posted_performer_pay_usd', avgPay, payAmounts.length ? payTotal.toFixed(2) : '', payAmounts.length, 'Average of the first positive numeric amount in each parseable posted pay string; not payment or payout history.']
  ];
  for (const [status, count] of Object.entries(statusCounts)) {
    rows.push(['status', `${status}_gigs`, count, count, gigs.length, 'Count divided by all included distinct host gigs.']);
  }
  for (const [month, count] of [...monthCounts].sort(([a], [b]) => a.localeCompare(b))) {
    rows.push(['event_month', month, count, count, validDateCount, 'Gigs by event month divided by gigs with a valid event date.']);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function downloadHostAnalyticsCsv(csv, { documentRef = document, urlApi = URL, BlobCtor = Blob } = {}) {
  const blob = new BlobCtor([csv], { type: 'text/csv;charset=utf-8' });
  const url = urlApi.createObjectURL(blob);
  const link = documentRef.createElement('a');
  link.href = url;
  link.download = `cltch-host-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
  link.hidden = true;
  documentRef.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => urlApi.revokeObjectURL(url), 1000);
}
