const FALLBACK_LOCALE = 'en-US';

export function formatUsd(amount, locale = globalThis.navigator?.language || FALLBACK_LOCALE) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return '';

  const options = { style: 'currency', currency: 'USD' };
  try {
    return new Intl.NumberFormat(locale || FALLBACK_LOCALE, options).format(numericAmount);
  } catch {
    return new Intl.NumberFormat(FALLBACK_LOCALE, options).format(numericAmount);
  }
}
