export function bindSensitiveFieldToggle(input, button, { windowRef = globalThis.window, documentRef = globalThis.document } = {}) {
  if (!input || !button) return () => {};
  let visible = false;

  const render = () => {
    input.type = visible ? 'text' : 'password';
    button.textContent = visible ? 'Hide payout details' : 'Show payout details';
    button.setAttribute('aria-pressed', visible ? 'true' : 'false');
  };
  const toggle = () => {
    visible = !visible;
    render();
  };
  const hideWhenPageLeaves = () => {
    if (!visible) return;
    visible = false;
    render();
  };
  const hideWhenDocumentHidden = () => {
    if (documentRef?.visibilityState === 'hidden') hideWhenPageLeaves();
  };

  button.addEventListener('click', toggle);
  windowRef?.addEventListener('blur', hideWhenPageLeaves);
  documentRef?.addEventListener('visibilitychange', hideWhenDocumentHidden);
  render();

  return () => {
    button.removeEventListener('click', toggle);
    windowRef?.removeEventListener('blur', hideWhenPageLeaves);
    documentRef?.removeEventListener('visibilitychange', hideWhenDocumentHidden);
  };
}
