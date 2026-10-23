import { BACKEND_DISABLED, BACKEND_DISABLED_MESSAGE } from './backend-api.js';

const ACTIONS_URL = 'https://us-central1-cltch-ntwrk-social.cloudfunctions.net/apiCalendarSubscription';

async function requestAction(auth, action) {
  if (BACKEND_DISABLED) throw new Error(`${BACKEND_DISABLED_MESSAGE} Online calendar links are unavailable until the backend is enabled; use the downloaded calendar export meanwhile.`);
  const user = auth?.currentUser;
  if (!user) throw new Error('Sign in again to manage your calendar link.');
  const token = await user.getIdToken();
  const response = await fetch(ACTIONS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action })
  });
  let payload = {};
  try { payload = await response.json(); } catch {}
  if (!response.ok) throw new Error(payload.error || 'Calendar subscriptions are not available right now.');
  return payload;
}

export function bindCalendarSubscription({ auth } = {}) {
  const create = document.getElementById('calendar-subscription-create');
  const revoke = document.getElementById('calendar-subscription-revoke');
  const status = document.getElementById('calendar-subscription-status');
  const linkContainer = document.getElementById('calendar-subscription-link');
  if (!create || !revoke || !status || !linkContainer) return;

  const showCreatedLink = (url) => {
    linkContainer.replaceChildren();
    linkContainer.hidden = false;
    const label = document.createElement('label');
    label.htmlFor = 'calendarSubscriptionUrl';
    label.textContent = 'Private subscription URL (shown only now)';
    const input = document.createElement('input');
    input.id = 'calendarSubscriptionUrl';
    input.type = 'url';
    input.readOnly = true;
    input.value = url;
    input.autocomplete = 'off';
    input.style.cssText = 'display:block;width:100%;min-height:42px;margin:6px 0;padding:8px;background:#10161d;color:#e4eef8;border:1px solid #405266;border-radius:8px;';
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.textContent = 'Copy private URL';
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(url);
        status.textContent = 'Private URL copied.';
      } catch {
        input.focus(); input.select();
        status.textContent = 'Select and copy the URL from the field.';
      }
    });
    linkContainer.append(label, input, copy);
  };

  const setActive = (active) => {
    revoke.hidden = !active;
    create.textContent = active ? 'Replace private calendar link' : 'Create private calendar link';
  };

  if (BACKEND_DISABLED) {
    create.disabled = true;
    create.hidden = true;
    revoke.hidden = true;
    status.textContent = 'Online calendar links are unavailable while the backend is disabled. Use Download Calendar from your performer dashboard.';
    return;
  }
  create.hidden = false;

  create.addEventListener('click', async () => {
    create.disabled = true;
    status.textContent = 'Creating a private calendar link…';
    try {
      const payload = await requestAction(auth, 'create');
      if (!payload.url) throw new Error('The calendar service did not return a feed URL.');
      showCreatedLink(payload.url);
      setActive(true);
      status.textContent = 'Link created. Add it to your calendar app. Replacing or revoking it invalidates this URL.';
    } catch (error) {
      status.textContent = error.message || 'Could not create a calendar link.';
      setActive(false);
    } finally { create.disabled = false; }
  });

  revoke.addEventListener('click', async () => {
    if (!window.confirm('Revoke this private calendar link? Calendar apps will no longer receive updates from it. Cached events may remain in the calendar app.')) return;
    revoke.disabled = true;
    status.textContent = 'Revoking the private calendar link…';
    try {
      await requestAction(auth, 'revoke');
      linkContainer.replaceChildren();
      linkContainer.hidden = true;
      setActive(false);
      status.textContent = 'Calendar link revoked. Previously cached calendar entries may remain in your calendar app.';
    } catch (error) {
      status.textContent = error.message || 'Could not revoke the calendar link.';
    } finally { revoke.disabled = false; }
  });

  requestAction(auth, 'status').then((payload) => {
    setActive(!!payload.active);
    status.textContent = payload.active
      ? 'A private calendar link is active. For security, its URL is shown only when created; replace it to get a new URL.'
      : 'No calendar link created.';
  }).catch((error) => {
    setActive(false);
    status.textContent = error.message || 'Calendar subscriptions are not available. Your downloaded calendar export still works.';
  });
}
