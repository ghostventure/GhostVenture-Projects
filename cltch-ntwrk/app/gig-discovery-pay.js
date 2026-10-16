const USD_PAY = /^\s*\$\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)(\s+.+|\/.*)?\s*$/;

export function formatListedPay(value, locale = globalThis.navigator?.language || 'en-US') {
  const original = typeof value === 'string' ? value : value == null ? '' : String(value);
  const match = original.match(USD_PAY);
  if (!match) return { text: original, formatted: false, locale: '' };

  const amountText = match[1];
  const amount = Number(amountText.replace(/,/g, ''));
  if (!Number.isFinite(amount)) return { text: original, formatted: false, locale: '' };

  const decimalPlaces = amountText.includes('.') ? amountText.split('.')[1].length : 0;
  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      currencyDisplay: 'name',
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: 2
    });
    return {
      text: `${formatter.format(amount)}${match[2] || ''}`,
      formatted: true,
      locale: formatter.resolvedOptions().locale
    };
  } catch {
    return { text: original, formatted: false, locale: '' };
  }
}
