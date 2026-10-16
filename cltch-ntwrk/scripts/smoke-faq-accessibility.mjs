import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../faq.html', import.meta.url), 'utf8');
const component = readFileSync(new URL('../scripts/legal-components.js', import.meta.url), 'utf8');

assert.match(html, /<a class="skip-link" href="#main-content">Skip to main content<\/a>/);
assert.match(html, /<main[^>]+id="main-content"[^>]+tabindex="-1"/);
assert.match(html, /<nav aria-label="Account navigation">/);
assert.match(html, /@media \(max-width: 768px\)/);
assert.match(html, /\.faq-tools\s*\{[^}]*grid-template-columns: 1fr 1fr/s);
assert.match(html, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(html, /\.faq-q:focus-visible/);
assert.match(html, /min-height: 56px/);
assert.match(component, /type: 'search'/);
assert.match(component, /'aria-label': 'Search questions and answers'/);
assert.match(component, /'aria-live': 'polite'/);
assert.match(component, /'aria-expanded': 'false'/);
assert.match(component, /aria-controls/);
assert.match(component, /answer\.hidden = isOpen/);
assert.match(component, /No questions match that search\./);
assert.match(component, /Expand all/);
assert.match(component, /Collapse all/);

console.log('FAQ accessibility smoke passed: skip navigation, responsive controls, reduced motion, labeled search, live results, and keyboard-operable accordions.');
