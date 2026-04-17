/**
 * convert-whitepaper.mjs
 *
 * Reads all .md files from whitepaper/ and writes .mdx files to src/content/docs/.
 * Handles:
 *  - H1 extraction → frontmatter title
 *  - Cross-reference conversion (§X.Y and "Section X.Y" → internal links)
 *  - Mermaid classDef stripping (light-mode colors removed, dark theme handles it)
 *  - File path mapping to Starlight slugs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const WHITEPAPER_DIR = join(ROOT, 'whitepaper');
const DOCS_DIR = join(ROOT, 'src', 'content', 'docs');

// ──────────────────────────────────────────────────────────────────────────────
// File → output path mapping
// ──────────────────────────────────────────────────────────────────────────────

const FILE_MAP = {
  '01-abstract/1.0-abstract.md':                'index.mdx',
  '02-introduction/2.1-vision.md':              'introduction/vision.mdx',
  '02-introduction/2.2-problem.md':             'introduction/problem.mdx',
  '02-introduction/2.3-affine-solution.md':     'introduction/solution.mdx',
  '03-mechanism/3.1-participants.md':           'mechanism/participants.mdx',
  '03-mechanism/3.2-scoring.md':                'mechanism/scoring.mdx',
  '04-system-design/4.1-architecture.md':       'system-design/architecture.mdx',
  '04-system-design/4.2-affinetes.md':          'system-design/affinetes.mdx',
  '04-system-design/4.3-inference-layer.md':    'system-design/inference-layer.mdx',
  '05-environments/5.1-design-criteria.md':     'environments/design-criteria.mdx',
  '05-environments/5.2-task-renewal.md':        'environments/task-renewal.mdx',
  '05-environments/5.3-environment-suite.md':   'environments/suite.mdx',
  '05-environments/5.4-training-interface.md':  'environments/training-interface.mdx',
  '06-roadmap.md':                              'roadmap.mdx',
  '07-conclusion.md':                           'conclusion.mdx',
};

// ──────────────────────────────────────────────────────────────────────────────
// Section number → slug mapping for cross-references
// ──────────────────────────────────────────────────────────────────────────────

const SECTION_SLUGS = {
  '1':    '/',
  '2':    '/introduction/vision/',
  '2.1':  '/introduction/vision/',
  '2.2':  '/introduction/problem/',
  '2.3':  '/introduction/solution/',
  '3':    '/mechanism/participants/',
  '3.1':  '/mechanism/participants/',
  '3.2':  '/mechanism/scoring/',
  '4':    '/system-design/architecture/',
  '4.1':  '/system-design/architecture/',
  '4.2':  '/system-design/affinetes/',
  '4.3':  '/system-design/inference-layer/',
  '5':    '/environments/design-criteria/',
  '5.1':  '/environments/design-criteria/',
  '5.2':  '/environments/task-renewal/',
  '5.3':  '/environments/suite/',
  '5.4':  '/environments/training-interface/',
  '6':    '/roadmap/',
  '7':    '/conclusion/',
};

// ──────────────────────────────────────────────────────────────────────────────
// Conversion logic
// ──────────────────────────────────────────────────────────────────────────────

function convertFile(relPath) {
  const srcPath = join(WHITEPAPER_DIR, relPath);
  const destRelPath = FILE_MAP[relPath];

  if (!destRelPath) {
    console.warn(`  SKIP: No mapping for ${relPath}`);
    return;
  }

  const destPath = join(DOCS_DIR, destRelPath);
  let content = readFileSync(srcPath, 'utf-8');

  // 1. Extract and remove H1 title
  let title = 'Untitled';
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) {
    title = h1Match[1].trim();
    // Remove the H1 line (and any blank line immediately after)
    content = content.replace(/^#\s+.+\n?\n?/, '');
  }

  // 2. Strip mermaid classDef lines (light-mode colors that override dark theme)
  content = content.replace(/^\s*classDef\s+.*$/gm, '');

  // 2b. Fix mermaid \n → <br> for line breaks inside diagram labels
  // Only apply inside mermaid code blocks
  content = content.replace(/```mermaid\n([\s\S]*?)```/g, (match, code) => {
    // Replace \n with <br> inside quoted strings and node labels
    const fixed = code.replace(/\\n/g, '<br>');
    return '```mermaid\n' + fixed + '```';
  });

  // 3a. Rewrite existing markdown links of form [§X.Y](any-url) → [§X.Y](new-slug)
  content = content.replace(/\[§(\d+(?:\.\d+)?)\]\(([^)]+)\)/g, (match, num) => {
    const slug = SECTION_SLUGS[num];
    if (slug) return `[§${num}](${slug})`;
    console.warn(`  WARNING: No slug for cross-reference §${num} in ${relPath}`);
    return match;
  });

  // 3b. Wrap bare §X.Y (not already inside a markdown link) in a link
  content = content.replace(/(?<!\[)§(\d+(?:\.\d+)?)(?!\])/g, (match, num) => {
    const slug = SECTION_SLUGS[num];
    if (slug) return `[§${num}](${slug})`;
    console.warn(`  WARNING: No slug for cross-reference §${num} in ${relPath}`);
    return match;
  });

  // 4. Convert "Section X.Y" text references → links
  // Only convert when not already inside a markdown link
  content = content.replace(/(?<!\[)Section\s+(\d+(?:\.\d+)?)(?!\])/g, (match, num) => {
    const slug = SECTION_SLUGS[num];
    if (slug) return `[Section ${num}](${slug})`;
    console.warn(`  WARNING: No slug for "Section ${num}" in ${relPath}`);
    return match;
  });

  // 4b. Escape { and } inside block math ($$...$$) — may span multiple lines
  content = content.replace(/\$\$([\s\S]+?)\$\$/g, (match, expr) => {
    const escaped = expr.replace(/\{/g, '\\{').replace(/\}/g, '\\}');
    return '$$' + escaped + '$$';
  });

  // 5. Escape JSX-problematic characters outside code blocks
  // MDX treats < as JSX tags, and {foo} as JS expressions. Escape both in prose.
  const lines = content.split('\n');
  let inCodeBlock = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (!inCodeBlock) {
      // Escape < followed by digit, =, space (not HTML tags) — but not inside inline code backticks
      lines[i] = lines[i].replace(/(?<!`[^`]*)<(?=[\d=\s])/g, '&lt;');
      // Escape { and } inside $...$ math expressions so MDX does not treat them as JSX
      lines[i] = lines[i].replace(/\$([^$\n]+)\$/g, (match, expr) => {
        const escaped = expr.replace(/\{/g, '\\{').replace(/\}/g, '\\}');
        return '$' + escaped + '$';
      });
    }
  }
  content = lines.join('\n');

  // 6. Wrap markdown tables in <Table> component
  let hasTable = false;
  const lines2 = content.split('\n');
  const result = [];
  let inTable = false;
  for (let i = 0; i < lines2.length; i++) {
    const line = lines2[i];
    const isTableLine = line.trimStart().startsWith('|');
    if (isTableLine && !inTable) {
      inTable = true;
      hasTable = true;
      result.push('<Table>');
      result.push('');
      result.push(line);
    } else if (!isTableLine && inTable) {
      inTable = false;
      result.push('');
      result.push('</Table>');
      result.push('');
      result.push(line);
    } else {
      result.push(line);
    }
  }
  if (inTable) {
    result.push('');
    result.push('</Table>');
  }
  content = result.join('\n');

  // 7. Add language hints to bare code blocks where detectable
  // ```\n code → ```python or ```bash etc based on content heuristics
  content = content.replace(/```\n([\s\S]*?)```/g, (match, code) => {
    // Detect Python-like code
    if (/\b(await|async|import|def |class |print\(|self\.)/.test(code)) {
      return '```python\n' + code + '```';
    }
    // Detect shell/CLI commands
    if (/^\s*(pip |npm |af |git |curl |docker |sudo |cd |mkdir |export )/.test(code)) {
      return '```bash\n' + code + '```';
    }
    // Detect JSON
    if (/^\s*\{[\s\S]*\}\s*$/.test(code.trim())) {
      return '```json\n' + code + '```';
    }
    return match; // leave as-is if can't detect
  });

  // Build frontmatter + imports
  const safeTitle = title.replace(/"/g, '\\"');
  let frontmatter = `---\ntitle: "${safeTitle}"\n---\n\n`;
  if (hasTable) {
    // Calculate relative path from output file to src/components/
    const destDir = dirname(destRelPath);
    const depth = destDir === '.' ? 2 : 3; // docs/file.mdx = 2 levels, docs/subdir/file.mdx = 3 levels
    const relPrefix = '../'.repeat(depth);
    frontmatter += `import Table from '${relPrefix}components/Table.astro';\n\n`;
  }

  // Write output
  const outputDir = dirname(destPath);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  writeFileSync(destPath, frontmatter + content.trim() + '\n', 'utf-8');
  console.log(`  OK: ${relPath} → ${destRelPath}`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────

console.log('Converting whitepaper markdown to MDX...\n');

if (!existsSync(WHITEPAPER_DIR)) {
  console.error(`ERROR: Whitepaper directory not found: ${WHITEPAPER_DIR}`);
  process.exit(1);
}

let converted = 0;
let warnings = 0;

for (const [relPath, destPath] of Object.entries(FILE_MAP)) {
  const srcPath = join(WHITEPAPER_DIR, relPath);
  if (!existsSync(srcPath)) {
    console.warn(`  MISSING: ${relPath} (source file does not exist)`);
    warnings++;
    continue;
  }
  convertFile(relPath);
  converted++;
}

console.log(`\nDone. Converted ${converted} files.`);
if (warnings > 0) console.log(`${warnings} warnings (missing source files).`);
