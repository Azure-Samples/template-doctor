const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Guard test for the programmatic Azure Functions v4 model.
// After renaming, the active API lives under packages/api/src/functions.
// Scans TypeScript sources and asserts each declared route begins with 'v4/'.

function collectTsFunctionFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      files.push(...collectTsFunctionFiles(full));
    } else if (e.isFile() && /\.tsx?$/.test(e.name)) {
      files.push(full);
    }
  }
  return files;
}

test.describe('V4 route guard', () => {
  test('all app.http registered routes are api/v4 prefixed', async () => {
  const apiSrc = path.resolve(__dirname, '../../api/src/functions');
  expect(fs.existsSync(apiSrc), 'api functions source must exist').toBeTruthy();

  const tsFiles = collectTsFunctionFiles(apiSrc);
    expect(tsFiles.length, 'should discover at least one function file').toBeGreaterThan(0);

    const violations = [];
    for (const file of tsFiles) {
  const content = fs.readFileSync(file, 'utf8');
      // Very lightweight parse: find app.http('name', { ... route: '...'} ) blocks
      const httpBlocks = content.split(/app\.http\(/).slice(1); // first split segment before first match
      for (const block of httpBlocks) {
        // Capture the route property inside the options object
        // Allows whitespace & different quote styles
        const routeMatch = block.match(/route:\s*['"]([^'"]+)['"]/);
        if (routeMatch) {
          const route = routeMatch[1];
            if (!route.startsWith('v4/')) {
              violations.push({ file: path.relative(apiSrc, file), route });
            }
        }
      }
    }

    if (violations.length) {
  console.error('Non v4-prefixed routes found in api sources:', violations);
    }
    expect(violations, 'All programmatic routes must start with v4/').toEqual([]);
  });
});