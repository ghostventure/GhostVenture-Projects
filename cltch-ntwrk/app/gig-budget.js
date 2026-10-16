export function calculateGigSeriesBudget(amount, count, feeRate = 0.02) {
  const baseCents = Math.round(Number(amount) * 100);
  const totalDates = Number(count);
  const rate = Number(feeRate);
  if (!Number.isSafeInteger(baseCents) || baseCents <= 0) throw new RangeError('Enter a valid amount per event.');
  if (!Number.isInteger(totalDates) || totalDates < 1 || totalDates > 12) throw new RangeError('Choose between 1 and 12 event dates.');
  if (!Number.isFinite(rate) || rate < 0 || rate > 0.25) throw new RangeError('Fee rate is outside the supported range.');
  const perEventFeeCents = Math.round(baseCents * rate);
  const perEventTotalCents = baseCents + perEventFeeCents;
  return {
    count: totalDates,
    perEventPay: baseCents / 100,
    perEventFee: perEventFeeCents / 100,
    perEventTotal: perEventTotalCents / 100,
    totalPay: (baseCents * totalDates) / 100,
    totalFees: (perEventFeeCents * totalDates) / 100,
    totalHostCost: (perEventTotalCents * totalDates) / 100
  };
}
