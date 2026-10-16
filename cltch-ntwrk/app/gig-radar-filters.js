export const MIN_GIG_PAY = 0;
export const MAX_GIG_PAY = 100000;
export const GIG_RADAR_PAY_FILTER_KEY = 'cltch_gig_min_pay_v1';

export function normalizeMinimumGigPay(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return MIN_GIG_PAY;
  return Math.min(MAX_GIG_PAY, Math.max(MIN_GIG_PAY, Math.round(parsed)));
}

export function readMinimumGigPay(storage) {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    return normalizeMinimumGigPay(target?.getItem(GIG_RADAR_PAY_FILTER_KEY) ?? MIN_GIG_PAY);
  } catch {
    return MIN_GIG_PAY;
  }
}

export function saveMinimumGigPay(value, storage) {
  const normalized = normalizeMinimumGigPay(value);
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    target?.setItem(GIG_RADAR_PAY_FILTER_KEY, String(normalized));
  } catch {
    // Filtering remains available for the current page when browser storage is blocked.
  }
  return normalized;
}

export function meetsMinimumGigPay(item, minimumPay) {
  return (Number(item?.payAmount) || 0) >= normalizeMinimumGigPay(minimumPay);
}
