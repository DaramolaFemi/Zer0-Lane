import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const html = readFileSync('dist/index.html', 'utf8').replaceAll('&#39;', "'");
assert.match(html, /Content-Security-Policy/);
assert.match(html, /default-src 'none'/);
assert.match(html, /script-src 'self'/);
assert.match(html, /connect-src 'none'/);
assert.doesNotMatch(html, /unsafe-eval|unsafe-inline|<script[^>]*>\s*[^<\s]/);
const files = ['main.js', 'engine.js', 'audio.js', 'index.html', ...readdirSync('assets').map(file => `assets/${file}`)];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  assert.doesNotMatch(text, /\b(?:eval|Function)\s*\(|\.innerHTML\s*=/, `${file}: unsafe code or HTML evaluation`);
  assert.doesNotMatch(text, /(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|-----BEGIN .*PRIVATE KEY-----)/, `${file}: possible secret`);
}
console.log('Security checks passed: restrictive production CSP, no inline/evaluated scripts, no runtime HTML injection, no known secret patterns in shipped source.');
