export const PERFORMER_COMPARISON_FEED_LIMIT = 250;
export const PERFORMER_COMPARISON_ROW_LIMIT = 5;

const TYPE_LABELS = Object.freeze({
  musician: 'Musician / band',
  dj: 'DJ',
  photographer: 'Photographer',
  cinematographer: 'Cinematographer',
  model: 'Model'
});

function safeText(value, maxLength, fallback) {
  if (typeof value !== 'string') return fallback;
  const text = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
  return text || fallback;
}

function safeExperience(value) {
  const raw = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  if (!/^\d{1,2}$/.test(raw)) return 'Not listed';
  const years = Number(raw);
  return years <= 80 ? `${years} ${years === 1 ? 'year' : 'years'} (self-reported)` : 'Not listed';
}

export function buildPerformerComparison(candidates, {
  loadedCount = 0,
  feedLimit = PERFORMER_COMPARISON_FEED_LIMIT,
  rowLimit = PERFORMER_COMPARISON_ROW_LIMIT,
  radius = 40
} = {}) {
  const safeFeedLimit = Number.isInteger(feedLimit) && feedLimit > 0 ? feedLimit : PERFORMER_COMPARISON_FEED_LIMIT;
  const safeRowLimit = Number.isInteger(rowLimit) && rowLimit > 0 ? Math.min(rowLimit, PERFORMER_COMPARISON_ROW_LIMIT) : PERFORMER_COMPARISON_ROW_LIMIT;
  const unique = new Map();
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    const id = typeof candidate?.id === 'string' ? candidate.id.trim() : '';
    const profile = candidate?.profile;
    const distance = Number(candidate?.distanceMiles);
    if (!id || !profile || profile.available !== true || !Number.isFinite(distance) || distance < 0 || distance > radius || unique.has(id)) continue;
    const rawGenres = Array.isArray(profile.genres) ? profile.genres : [];
    const genres = rawGenres
      .filter((genre) => typeof genre === 'string')
      .map((genre) => safeText(genre, 32, ''))
      .filter(Boolean)
      .slice(0, 4);
    const type = TYPE_LABELS[profile.performerType || 'musician'] || 'Creative professional';
    unique.set(id, {
      name: safeText(profile.stageName, 80, 'Unnamed performer profile'),
      type,
      genres: genres.length ? genres.join(', ') : 'Not listed',
      instruments: safeText(profile.instruments, 80, 'Not listed'),
      experience: safeExperience(profile.experience),
      distanceMiles: Math.round(distance)
    });
  }

  const matches = [...unique.values()].sort((a, b) => a.distanceMiles - b.distanceMiles);
  const loaded = Number.isFinite(Number(loadedCount)) ? Math.max(0, Math.floor(Number(loadedCount))) : 0;
  return {
    loadedCount: loaded,
    feedLimit: safeFeedLimit,
    feedLimitReached: loaded >= safeFeedLimit,
    radiusMiles: Number.isFinite(Number(radius)) ? Math.max(0, Number(radius)) : 40,
    matchedCount: matches.length,
    displayLimit: safeRowLimit,
    omittedMatchCount: Math.max(0, matches.length - safeRowLimit),
    rows: matches.slice(0, safeRowLimit)
  };
}

export function renderPerformerComparison(container, model, documentRef = document) {
  if (!container || !model) return;
  const heading = container.querySelector('#performerComparisonTitle');
  container.replaceChildren(...(heading ? [heading] : []));
  container.hidden = false;

  const intro = documentRef.createElement('p');
  intro.textContent = 'These are available profile matches from the existing host query, not applications. The available flag is not date-specific confirmation for this gig.';
  container.appendChild(intro);

  const coverage = documentRef.createElement('p');
  const countText = model.omittedMatchCount
    ? `Showing ${model.rows.length} of ${model.matchedCount} matching profiles; the comparison table displays at most ${model.displayLimit}.`
    : `Showing ${model.rows.length} matching profile${model.rows.length === 1 ? '' : 's'}.`;
  const capText = model.feedLimitReached
    ? ` The query reached its ${model.feedLimit}-profile limit; additional available profiles may be omitted.`
    : ` The query loaded ${model.loadedCount} of up to ${model.feedLimit} profiles.`;
  coverage.textContent = `${countText}${capText} Distances are approximate straight-line miles; only profiles within ${model.radiusMiles} miles are included.`;
  container.appendChild(coverage);

  if (!model.rows.length) {
    const empty = documentRef.createElement('p');
    empty.textContent = 'No available profiles matched the current role, style, skill, and radius filters in this loaded sample.';
    container.appendChild(empty);
    return;
  }

  const scroll = documentRef.createElement('div');
  scroll.tabIndex = 0;
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', 'Performer comparison table; scroll horizontally if needed');
  scroll.style.overflowX = 'auto';
  scroll.style.border = '1px solid #344252';
  scroll.style.borderRadius = '8px';

  const table = documentRef.createElement('table');
  table.style.width = '100%';
  table.style.minWidth = '680px';
  table.style.borderCollapse = 'collapse';
  const caption = documentRef.createElement('caption');
  caption.textContent = 'Available performer profile comparison. Sorted by approximate straight-line distance, nearest first.';
  table.appendChild(caption);

  const headings = ['Stage name', 'Type', 'Genres / styles', 'Instruments / skills', 'Experience', 'Approx. distance'];
  const thead = documentRef.createElement('thead');
  const headerRow = documentRef.createElement('tr');
  for (const label of headings) {
    const th = documentRef.createElement('th');
    th.scope = 'col';
    th.textContent = label;
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = documentRef.createElement('tbody');
  for (const row of model.rows) {
    const tr = documentRef.createElement('tr');
    const values = [row.name, row.type, row.genres, row.instruments, row.experience, `About ${row.distanceMiles} mi`];
    values.forEach((value, index) => {
      const cell = documentRef.createElement(index === 0 ? 'th' : 'td');
      if (index === 0) cell.scope = 'row';
      cell.textContent = value;
      tr.appendChild(cell);
    });
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  scroll.appendChild(table);
  container.appendChild(scroll);
}
