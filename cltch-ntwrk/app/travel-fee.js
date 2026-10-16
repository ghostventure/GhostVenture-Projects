export function estimateTravelFee(oneWayMiles, perMileRate) {
  if (String(oneWayMiles ?? '').trim() === '' || String(perMileRate ?? '').trim() === '') {
    throw new RangeError('Enter route miles and a per-mile rate.');
  }
  const miles = Number(oneWayMiles);
  const rate = Number(perMileRate);
  if (!Number.isFinite(miles) || miles < 0 || miles > 5000) {
    throw new RangeError('Enter one-way route miles from 0 to 5,000.');
  }
  if (!Number.isFinite(rate) || rate < 0 || rate > 1000) {
    throw new RangeError('Enter a per-mile rate from 0 to 1,000.');
  }
  return Math.round(miles * 2 * rate * 100) / 100;
}
