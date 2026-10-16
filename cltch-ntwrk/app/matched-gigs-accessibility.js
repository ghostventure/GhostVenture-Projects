// Small progressive enhancements for the matched-gigs queue. Works alongside
// the page's existing Firebase renderer without changing its data contract.
(() => {
  const init = () => {
    const search = document.getElementById('gigSearchInput');
    const filters = document.getElementById('gigFilterRow');
    const queue = document.getElementById('matchedQueueList');
    const radar = document.getElementById('gigList');
    if (!search || !filters) return;

    search.setAttribute('aria-label', 'Search gigs by venue, location, genre, or pay');
    search.setAttribute('aria-keyshortcuts', 'Control+/ Meta+/');
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'matched-gigs-clear-search';
    clear.textContent = 'Clear search';
    clear.setAttribute('aria-label', 'Clear gig search');
    clear.hidden = !search.value;
    search.insertAdjacentElement('afterend', clear);

    const status = document.createElement('p');
    status.className = 'matched-gigs-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    status.textContent = 'Search and filters update the gig list.';
    filters.insertAdjacentElement('afterend', status);

    const syncButtons = () => {
      filters.querySelectorAll('[data-filter]').forEach((button) => {
        button.setAttribute('aria-pressed', String(button.classList.contains('active')));
      });
    };
    const resultCount = () => {
      const activeTab = document.getElementById('gig-radar')?.classList.contains('hidden')
        ? queue : radar;
      if (!activeTab) return null;
      const empty = activeTab.querySelector('.empty, .empty-sm');
      if (empty && activeTab.children.length === 1) return 0;
      return [...activeTab.children].filter((item) => !item.classList.contains('empty') && !item.classList.contains('empty-sm')).length;
    };
    const announce = () => {
      clear.hidden = !search.value;
      syncButtons();
      const count = resultCount();
      const active = filters.querySelector('[data-filter].active');
      const filterName = active?.textContent?.trim() || 'All';
      status.textContent = `${count === null ? 'Gig list' : `${count} ${count === 1 ? 'gig' : 'gigs'}`} shown. ${filterName} filter${search.value ? `; search: ${search.value.trim()}` : ''}.`;
    };

    clear.addEventListener('click', () => {
      search.value = '';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      search.focus();
    });
    search.addEventListener('input', announce);
    filters.addEventListener('click', (event) => {
      if (event.target.closest('[data-filter]')) requestAnimationFrame(announce);
    });
    document.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === '/') {
        event.preventDefault();
        search.focus();
      }
      if (event.key === 'Escape' && document.activeElement === search && search.value) {
        search.value = '';
        search.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    [queue, radar].filter(Boolean).forEach((list) => {
      new MutationObserver(() => requestAnimationFrame(announce)).observe(list, { childList: true, subtree: true });
    });
    syncButtons();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
