function cleanText(value, maxLength) {
  return String(value || "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").trim().slice(0, maxLength);
}

export function buildSupportConversationContext({ booking, messages = [], includeMessages = false, maxChars = 8000 } = {}) {
  const snapshot = {
    booking: {
      id: cleanText(booking?.id, 120),
      date: cleanText(booking?.date, 30),
      venue: cleanText(booking?.venue, 120),
      status: cleanText(booking?.status, 30)
    },
    messages: includeMessages ? messages.slice(-20).map((message) => ({
      role: message.senderRole === "host" ? "host" : "performer",
      sentAt: cleanText(message.createdAt?.toDate?.()?.toISOString?.() || "", 40),
      text: cleanText(message.text, 600)
    })) : []
  };
  while (JSON.stringify(snapshot).length > maxChars && snapshot.messages.length) snapshot.messages.shift();
  if (JSON.stringify(snapshot).length > maxChars) {
    snapshot.booking.venue = snapshot.booking.venue.slice(0, Math.max(0, maxChars - 250));
  }
  return JSON.stringify(snapshot);
}

export function buildSupportTicketCopy({ id, bookingId, description, context }) {
  return [
    `CLTCH support request ${cleanText(id, 128)}`,
    `Booking: ${cleanText(bookingId, 128)}`,
    "",
    "Issue description:",
    cleanText(description, 1500),
    "",
    "Booking context (conversation included only if selected):",
    cleanText(context, 8000)
  ].join("\n").slice(0, 10000);
}
