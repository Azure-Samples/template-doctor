#!/usr/bin/env node
import fs from 'fs';

const htmlPath = 'packages/app/index.html';
const html = fs.readFileSync(htmlPath, 'utf8');
const forbidden = [
  /<script[^>]+js\/app\.js/i,
  /<script[^>]+js\/debug-console\.js/i,
];

let failed = false;
for (const rx of forbidden) {
  if (rx.test(html)) {
    console.error(`[legacy-guard] Forbidden legacy script tag matched: ${rx}`);
    failed = true;
  }
}

if (fs.existsSync('packages/app/js')) {
  console.error('[legacy-guard] Legacy js folder reintroduced (packages/app/js). Remove it or rename to _legacy_js_backup.');
  failed = true;
}

if (failed) {
  process.exit(1);
} else {
  console.log('[legacy-guard] Passed: no forbidden legacy scripts or folders');
}