function dateLabel(value, locale) {
  const date = value instanceof Date ? value : value?.toDate?.();
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function formatHostBookingReliability(record, locale) {
  if (!record || !Number.isSafeInteger(record.acceptedTransitions) || record.acceptedTransitions < 1
    || !Number.isSafeInteger(record.hostCancellationsAfterAcceptance) || record.hostCancellationsAfterAcceptance < 0
    || record.hostCancellationsAfterAcceptance > record.acceptedTransitions) return '';
  const since = dateLabel(record.coverageStartedAt, locale);
  if (!since) return '';
  const cancellations = record.hostCancellationsAfterAcceptance;
  const cancellationLabel = cancellations === 1 ? 'host cancellation' : 'host cancellations';
  return `Forward-only record: ${cancellations} ${cancellationLabel} after acceptance out of ${record.acceptedTransitions} accepted booking transitions, tracked since ${since}. Earlier bookings are not included.`;
}
