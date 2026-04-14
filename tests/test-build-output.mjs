/**
 * Post-build validation — checks the dist/ output for correctness.
 * Run AFTER `npm run build`:
 *
 *   npm run build && node tests/test-build-output.mjs
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(message);
    console.error(`  FAIL: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findFiles(dir, ext, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      findFiles(fullPath, ext, files);
    } else if (entry.name.endsWith(ext)) {
      files.push(fullPath);
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// Test: dist/ exists
// ---------------------------------------------------------------------------
console.log('\n--- Build Output Validation ---\n');

assert(existsSync(DIST), 'dist/ directory should exist. Run `npm run build` first.');

if (!existsSync(DIST)) {
  console.error('\nCannot continue — dist/ does not exist.\n');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Test: Page count
// ---------------------------------------------------------------------------
const htmlFiles = findFiles(DIST, '.html');
const MIN_PAGES = 90; // 38 whitepaper + 56 subnet - some tolerance

console.log(`Found ${htmlFiles.length} HTML pages in dist/`);
assert(
  htmlFiles.length >= MIN_PAGES,
  `Expected ≥${MIN_PAGES} HTML pages but found ${htmlFiles.length}. ` +
  `Pages may be missing — check conversion scripts and MDX files.`
);

// ---------------------------------------------------------------------------
// Test: Key pages exist
// ---------------------------------------------------------------------------
const KEY_PAGES = [
  'index.html',                              // Whitepaper abstract
  'introduction/index.html',                 // Whitepaper intro
  'mechanism/task-lifecycle/index.html',      // Whitepaper mechanism
  'architecture/overview/index.html',         // Whitepaper architecture
  'environments/overview/index.html',         // Whitepaper environments
  'scoring/scoring-pipeline/index.html',      // Whitepaper scoring
  'benchmarks/overview/index.html',           // Whitepaper benchmarks
  'roadmap/conclusion/index.html',            // Whitepaper roadmap
  'subnets/index.html',                      // Subnet docs overview
  '404.html',                                // Error page
];

console.log('\nChecking key pages...');
for (const page of KEY_PAGES) {
  const fullPath = join(DIST, page);
  assert(
    existsSync(fullPath),
    `Missing key page: ${page} — check FILE_MAP in convert-whitepaper.mjs or sidebar config in astro.config.mjs`
  );
}

// ---------------------------------------------------------------------------
// Test: No empty pages
// ---------------------------------------------------------------------------
console.log('\nChecking for empty pages...');
const MIN_PAGE_SIZE = 1024; // 1KB minimum
let emptyPages = 0;
for (const file of htmlFiles) {
  const size = statSync(file).size;
  if (size < MIN_PAGE_SIZE) {
    const relPath = relative(DIST, file);
    assert(false, `Page too small (${size} bytes): ${relPath} — may have no content`);
    emptyPages++;
  }
}
if (emptyPages === 0) {
  assert(true, `All ${htmlFiles.length} pages have content (>${MIN_PAGE_SIZE} bytes)`);
}

// ---------------------------------------------------------------------------
// Test: Internal links valid
// ---------------------------------------------------------------------------
console.log('\nChecking internal links...');
const linkRegex = /href="(\/[^"]*?)"/g;
const existingPaths = new Set();

// Build set of all valid paths
for (const file of htmlFiles) {
  let relPath = relative(DIST, file);
  // Convert file path to URL path
  relPath = '/' + relPath.replace(/index\.html$/, '').replace(/\.html$/, '/');
  relPath = relPath.replace(/\/+$/, '/');
  if (relPath === '//') relPath = '/';
  existingPaths.add(relPath);
  // Also add without trailing slash
  if (relPath.endsWith('/') && relPath !== '/') {
    existingPaths.add(relPath.slice(0, -1));
  }
}
// Add common static paths
existingPaths.add('/');
existingPaths.add('/pagefind');
existingPaths.add('/favicon-dynamic.svg');

let brokenLinks = 0;
const checkedLinks = new Set();
for (const file of htmlFiles) {
  const content = readFileSync(file, 'utf-8');
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    const href = match[1].split('#')[0].split('?')[0]; // Strip anchors and query params
    if (!href || href === '/') continue;
    if (checkedLinks.has(href)) continue;
    checkedLinks.add(href);

    // Check if target exists
    const normalized = href.endsWith('/') ? href : href + '/';
    const withoutSlash = href.endsWith('/') ? href.slice(0, -1) : href;

    if (!existingPaths.has(href) && !existingPaths.has(normalized) && !existingPaths.has(withoutSlash)) {
      // Skip static assets
      if (href.startsWith('/pagefind') || href.startsWith('/scripts/') ||
          href.startsWith('/_astro/') || href.endsWith('.svg') ||
          href.endsWith('.ico') || href.endsWith('.png') ||
          href.endsWith('.css') || href.endsWith('.js') ||
          href.endsWith('.xml') || href.endsWith('.webmanifest')) {
        continue;
      }
      const source = relative(DIST, file);
      // Subnet docs may reference pages DeepWiki didn't provide content for — warn, don't fail
      if (href.startsWith('/subnets/')) {
        console.warn(`  WARN: Broken subnet link: ${href} (in ${source}) — DeepWiki may not have this page`);
      } else {
        assert(false, `Broken internal link: ${href} (found in ${source})`);
        brokenLinks++;
      }
    }
  }
}
if (brokenLinks === 0) {
  assert(true, `All internal links valid (checked ${checkedLinks.size} unique links)`);
}

// ---------------------------------------------------------------------------
// Test: Search index exists
// ---------------------------------------------------------------------------
console.log('\nChecking build artifacts...');
assert(
  existsSync(join(DIST, 'pagefind')),
  'Search index (pagefind/) should exist — Starlight generates this automatically'
);

// ---------------------------------------------------------------------------
// Test: Sitemap exists
// ---------------------------------------------------------------------------
assert(
  existsSync(join(DIST, 'sitemap-index.xml')),
  'Sitemap (sitemap-index.xml) should exist'
);

// ---------------------------------------------------------------------------
// Test: Favicon exists
// ---------------------------------------------------------------------------
assert(
  existsSync(join(DIST, 'favicon-dynamic.svg')),
  'Dynamic favicon (favicon-dynamic.svg) should exist'
);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${'='.repeat(50)}`);
console.log(`Build Validation: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(50)}\n`);

if (failures.length > 0) {
  console.log('Failures:');
  for (const f of failures) {
    console.log(`  - ${f}`);
  }
  console.log('');
}

process.exit(failed > 0 ? 1 : 0);
