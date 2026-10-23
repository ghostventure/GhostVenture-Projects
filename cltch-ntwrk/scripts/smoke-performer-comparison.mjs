import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../host.html', import.meta.url), 'utf8');
const checks = [
  ['Comparison follows the existing available-performer query and match filters', /getDocs\(buildAvailableMusiciansQuery\(db, performerType\)\)/.test(html) && /skillMatch\.matched/.test(html) && /dist <= 40/.test(html)],
  ['Candidate set is bounded, distance-sorted, and labeled with its radius', /candidates\.sort\(\(a, b\) => a\.distance/.test(html) && /candidates\.slice\(0, 8\)/.test(html) && /within \$\{radius\} miles/.test(html)],
  ['Table has caption and scoped row and column headers', /table\.createCaption|table\.append\(caption\)/.test(html) && /th\.scope = 'col'/.test(html) && /nameCell\.scope = 'row'/.test(html)],
  ['Only public profile fields are shown and text uses textContent', /performer-view\.html\?id=\$\{encodeURIComponent\(id\)\}/.test(html) && /link\.textContent = name/.test(html) && /rate\.textContent = profile\.rate/.test(html)],
  ['Comparison is presented in a live status region after the real match count', /id="performerComparison" aria-live="polite"/.test(html) && /renderPerformerComparison\(match\.candidates, match\.radius\)/.test(html)],
];
for (const [label, passed] of checks) {
  assert.ok(passed, label);
  console.log(`PASS ${label}`);
}
console.log(`Validated ${checks.length} performer comparison safeguards.`);
