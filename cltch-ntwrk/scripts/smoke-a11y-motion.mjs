import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../site-init.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../cltch-boilerplate.css', import.meta.url), 'utf8');
assert.match(source, /motion: stored\.motion === "reduce" \? "reduce" : "system"/);
assert.match(source, /data-motion", "reduce"/);
assert.match(source, /data-a11y-motion/);
assert.match(source, /Reduce Motion: System/);
assert.match(css, /html\[data-motion='reduce'\]/);
assert.match(css, /prefers-reduced-motion: reduce/);

console.log('Accessibility motion smoke passed: system fallback and persisted reduce override are wired.');
