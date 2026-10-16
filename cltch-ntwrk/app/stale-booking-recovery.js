export const STALE_BOOKING_RECOVERY_LIMIT = 20;

export function selectPastAcceptedBookings(records, { today, limit = STALE_BOOKING_RECOVERY_LIMIT } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(today || ""))) {
    throw new Error("A valid current date is required.");
  }
  const safeLimit = Number.isInteger(limit) ? Math.max(0, Math.min(limit, STALE_BOOKING_RECOVERY_LIMIT)) : STALE_BOOKING_RECOVERY_LIMIT;
  return (Array.isArray(records) ? records : [])
    .filter((record) => record && record.status === "accepted" && record.id && /^\d{4}-\d{2}-\d{2}$/.test(String(record.date || "")) && record.date < today)
    .sort((left, right) => right.date.localeCompare(left.date) || String(left.id).localeCompare(String(right.id)))
    .slice(0, safeLimit);
}

export function renderStaleBookingRecovery(container, records, { today, documentRef = document } = {}) {
  const bookings = selectPastAcceptedBookings(records, { today });
  container.replaceChildren();

  const heading = documentRef.createElement("h2");
  heading.textContent = "Past accepted bookings";
  const description = documentRef.createElement("p");
  description.textContent = "Review a past booking or check its latest details. This list shows up to 20 records.";
  container.append(heading, description);

  if (!bookings.length) {
    const empty = documentRef.createElement("p");
    empty.textContent = "No past accepted bookings were found in this check.";
    container.append(empty);
    return bookings;
  }

  const list = documentRef.createElement("ul");
  for (const booking of bookings) {
    const item = documentRef.createElement("li");
    const summary = documentRef.createElement("span");
    summary.textContent = `${booking.date} — ${String(booking.venue || "Venue not listed")}`;
    const link = documentRef.createElement("a");
    link.href = `booking.html?id=${encodeURIComponent(String(booking.id))}`;
    link.textContent = "Open booking details";
    item.append(summary, documentRef.createTextNode(" "), link);
    list.append(item);
  }
  container.append(list);
  return bookings;
}
