const DEFAULT_KEY = 'cltch.booking-walkthrough.v1';

function readSavedState(storage, key, stepCount) {
  try {
    const saved = JSON.parse(storage?.getItem(key) || 'null');
    if (saved && Number.isInteger(saved.index) && saved.index >= 0 && saved.index < stepCount && ['in-progress', 'skipped', 'complete'].includes(saved.status)) {
      return { index: saved.index, status: saved.status };
    }
  } catch {}
  return { index: 0, status: 'not-started' };
}

export function createBookingWalkthrough(steps, { storage = null, storageKey = DEFAULT_KEY, suggestedIndex = 0 } = {}) {
  const safeSteps = Array.isArray(steps) ? steps : [];
  let state = readSavedState(storage, storageKey, safeSteps.length || 1);
  const save = () => {
    try { storage?.setItem(storageKey, JSON.stringify(state)); } catch {}
  };
  const indexForSuggestion = () => Math.max(0, Math.min(safeSteps.length - 1, Number.isInteger(suggestedIndex) ? suggestedIndex : 0));

  return {
    getState: () => ({ ...state }),
    getView: () => ({
      ...state,
      step: safeSteps[state.index] || null,
      stepNumber: safeSteps.length ? state.index + 1 : 0,
      total: safeSteps.length,
      canGoBack: state.index > 0,
      canGoNext: state.index < safeSteps.length - 1
    }),
    dispatch(action) {
      if (!safeSteps.length) return this.getView();
      if (action === 'start' || action === 'restart') state = { index: indexForSuggestion(), status: 'in-progress' };
      else if (action === 'resume') state.status = 'in-progress';
      else if (action === 'back' && state.status === 'in-progress') state.index = Math.max(0, state.index - 1);
      else if (action === 'next' && state.status === 'in-progress') {
        if (state.index >= safeSteps.length - 1) state.status = 'complete';
        else state.index += 1;
      } else if (action === 'skip' && state.status === 'in-progress') state.status = 'skipped';
      save();
      return this.getView();
    }
  };
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

export function renderBookingWalkthrough(container, workflow) {
  if (!container || !workflow) return;
  container._bookingWalkthrough = workflow;
  const view = workflow.getView();
  const step = view.step;
  if (view.status === 'in-progress' && step) {
    container.innerHTML = `
      <div class="walkthrough-progress" aria-label="Tutorial progress">Step ${view.stepNumber} of ${view.total}</div>
      <h3>${escapeHtml(step.title)}</h3>
      <p>${escapeHtml(step.detail)}</p>
      <p>${step.done ? 'Your dashboard suggests this step is complete.' : 'Suggested next step.'}</p>
      <p><a href="${escapeHtml(step.href)}">${escapeHtml(step.linkLabel)}</a></p>
      <div class="walkthrough-actions">
        <button type="button" data-walkthrough-action="back" ${view.canGoBack ? '' : 'disabled'}>Back</button>
        <button type="button" data-walkthrough-action="next">${view.canGoNext ? 'Next' : 'Finish tutorial'}</button>
        <button type="button" data-walkthrough-action="skip">Skip tutorial</button>
      </div>`;
  } else if (view.status === 'complete') {
    container.innerHTML = '<p role="status">Walkthrough complete. You can restart it whenever you need a refresher.</p><button type="button" data-walkthrough-action="restart">Restart tutorial</button>';
  } else if (view.status === 'skipped') {
    container.innerHTML = '<p role="status">Walkthrough paused. Your place is saved on this device.</p><button type="button" data-walkthrough-action="resume">Continue tutorial</button><button type="button" data-walkthrough-action="restart">Start over</button>';
  } else {
    container.innerHTML = '<p>A short, optional guide to setting up your profile, choosing a match, and following a booking through.</p><button type="button" data-walkthrough-action="start">Start tutorial</button>';
  }
  if (!container.dataset.walkthroughBound) {
    container.addEventListener('click', (event) => {
      const action = event.target.closest('[data-walkthrough-action]')?.dataset.walkthroughAction;
      if (!action) return;
      container._bookingWalkthrough?.dispatch(action);
      renderBookingWalkthrough(container, container._bookingWalkthrough);
      container.querySelector('[data-walkthrough-action]')?.focus();
    });
    container.dataset.walkthroughBound = 'true';
  }
}
