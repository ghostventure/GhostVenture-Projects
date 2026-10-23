const FUNCTION_URL = "https://us-central1-cltch-ntwrk-social.cloudfunctions.net/apiUnreadMessageCounts";

export async function fetchUnreadMessageCount(user, fetchImpl = fetch) {
  if (!user || typeof user.getIdToken !== "function") throw new Error("Sign in to check unread messages.");
  const token = await user.getIdToken();
  const response = await fetchImpl(FUNCTION_URL, {
    method: "GET",
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
  });
  let payload = {};
  try { payload = await response.json(); } catch {}
  if (!response.ok) throw new Error(payload.error || "Unread count is currently unavailable.");
  if (payload.available !== true) return payload;
  if (payload.exact !== true || !Number.isSafeInteger(payload.unreadCount) || payload.unreadCount < 0
    || !Number.isSafeInteger(payload.bookingThreads) || payload.bookingThreads < 0) {
    throw new Error("The server did not return a verifiable unread count.");
  }
  return payload;
}

function unavailableMessage(reason) {
  if (reason === "booking_limit") return "Unread total is unavailable for accounts with more than 25 accepted booking threads.";
  if (reason === "message_limit") return "Unread total is unavailable because a booking thread exceeds the count limit.";
  if (reason === "read_state_refresh_required") return "Unread total is unavailable until an older read marker can be safely refreshed. Open the booking conversations, then retry.";
  if (reason === "state_changed_retry") return "Messages changed while the count was being checked. Refresh to try again.";
  return "Unread count is currently unavailable.";
}

export async function refreshUnreadMessageCount(user, statusElement, buttonElement, fetchImpl = fetch) {
  if (!statusElement || !buttonElement || buttonElement.disabled) return;
  buttonElement.disabled = true;
  statusElement.textContent = "Checking unread messages with the server…";
  try {
    const result = await fetchUnreadMessageCount(user, fetchImpl);
    if (result.available !== true) {
      statusElement.textContent = unavailableMessage(result.reason);
      return;
    }
    const checkedAt = new Date(result.checkedAt);
    const time = Number.isNaN(checkedAt.getTime()) ? "just now" : checkedAt.toLocaleTimeString();
    const countLabel = result.unreadCount === 1 ? "1 unread message" : `${result.unreadCount} unread messages`;
    const threadLabel = result.bookingThreads === 1 ? "1 accepted booking thread" : `${result.bookingThreads} accepted booking threads`;
    statusElement.textContent = `${countLabel} across ${threadLabel}. Server checked at ${time}; refresh to update.`;
  } catch {
    statusElement.textContent = "Unread count is currently unavailable. The count will appear when the backend is reachable.";
  } finally {
    buttonElement.disabled = false;
  }
}
