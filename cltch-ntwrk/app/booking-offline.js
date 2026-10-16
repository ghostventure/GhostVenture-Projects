export function isBrowserOffline(navigatorRef) {
  return navigatorRef?.onLine === false;
}

const OFFLINE_COPY = 'Your browser reports no network. Loaded booking details may be stale. New check-ins and message sends are paused. You can keep a message draft here. If an action was already in progress when the connection dropped, check its status after reconnecting.';
const RECONNECTED_COPY = 'Connection restored. An action that was already in progress may have completed. Check the booking or message thread before retrying; no new action is sent automatically. Refresh if you need the latest booking state.';

export function installBookingOfflineStatus({ navigatorRef, windowRef, banner, dismissButton, onChange = () => {} }) {
  if (!navigatorRef || !windowRef || !banner) throw new TypeError('Browser connection status elements are required.');
  let wasOffline = false;
  const dismiss = () => { banner.hidden = true; };
  const sync = () => {
    const offline = isBrowserOffline(navigatorRef);
    if (offline) {
      wasOffline = true;
      banner.hidden = false;
      banner.dataset.connection = 'offline';
      banner.querySelector('[data-connection-copy]').textContent = OFFLINE_COPY;
      if (dismissButton) dismissButton.hidden = true;
    } else if (wasOffline) {
      wasOffline = false;
      banner.hidden = false;
      banner.dataset.connection = 'online';
      banner.querySelector('[data-connection-copy]').textContent = RECONNECTED_COPY;
      if (dismissButton) dismissButton.hidden = false;
    } else {
      banner.hidden = true;
    }
    onChange(offline);
  };
  const onOffline = () => sync();
  const onOnline = () => sync();
  windowRef.addEventListener('offline', onOffline);
  windowRef.addEventListener('online', onOnline);
  dismissButton?.addEventListener('click', dismiss);
  sync();
  return () => {
    windowRef.removeEventListener('offline', onOffline);
    windowRef.removeEventListener('online', onOnline);
    dismissButton?.removeEventListener('click', dismiss);
  };
}
