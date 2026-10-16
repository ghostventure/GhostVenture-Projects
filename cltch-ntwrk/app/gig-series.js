const ALLOWED_CADENCES = new Set([0, 7, 14]);

export function generateGigDates(startDate, count, cadenceDays) {
  const dateText = String(startDate || '').trim();
  const total = Number(count);
  const cadence = Number(cadenceDays);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) throw new RangeError('Choose a valid start date.');
  if (!Number.isInteger(total) || total < 1 || total > 12) throw new RangeError('Choose between 1 and 12 event dates.');
  if (!ALLOWED_CADENCES.has(cadence) || (cadence === 0 && total !== 1)) throw new RangeError('Choose one date, weekly, or every two weeks.');

  const [year, month, day] = dateText.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day));
  if (start.getUTCFullYear() !== year || start.getUTCMonth() !== month - 1 || start.getUTCDate() !== day) {
    throw new RangeError('Choose a real calendar date.');
  }

  return Array.from({ length: total }, (_, index) => {
    const date = new Date(start.getTime());
    date.setUTCDate(date.getUTCDate() + index * cadence);
    return date.toISOString().slice(0, 10);
  });
}
