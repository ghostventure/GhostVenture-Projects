export const MAX_CANCELLATION_REASON_LENGTH = 160;

export function normalizeCancellationReason(value) {
  return String(value ?? '').trim().slice(0, MAX_CANCELLATION_REASON_LENGTH);
}
