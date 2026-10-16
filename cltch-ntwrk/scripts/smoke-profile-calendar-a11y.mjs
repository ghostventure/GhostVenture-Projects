import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../musician-profile.html', import.meta.url), 'utf8');
const calendar = page.slice(page.indexOf('// ── Availability calendar'), page.indexOf('// Tooltip for booked date info'));

assert.match(page, /aria-label="Previous month"/);
assert.match(page, /aria-label="Next month"/);
assert.match(page, /id="calTitle" aria-live="polite"/);
assert.match(page, /role="group" aria-label="Availability dates/);
assert.match(page, /\.cal-cell\s*\{[^}]*min-height: 40px/s);
assert.match(page, /button\.cal-cell\s*\{/);
assert.match(calendar, /document.createElement\('button'\)/);
assert.match(calendar, /cell.dataset.date = dateStr/);
assert.match(calendar, /cell.tabIndex = .*calFocusDate/);
assert.match(calendar, /cell.setAttribute\('aria-label', `\$\{spokenDate\}, \$\{state\}`\)/);
assert.match(calendar, /cell.setAttribute\('aria-pressed', String\(isBlocked\)\)/);
assert.match(calendar, /cell.addEventListener\('focus'/);
assert.match(calendar, /event.key === 'PageUp' \|\| event.key === 'PageDown'/);
for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']) {
  assert.ok(calendar.includes(`${key}:`), `keyboard navigation supports ${key}`);
}
assert.match(calendar, /if \(isBooked\)[\s\S]*?else if \(!isPast\)/);
assert.match(calendar, /if \(isPast\)\s+cls \+= ' past'/);
assert.match(calendar, /aria-hidden', 'true'/);

console.log('Performer availability calendar smoke passed: keyboard date movement and toggling, announced month/date state, booked/past safeguards, and mobile-sized targets.');
