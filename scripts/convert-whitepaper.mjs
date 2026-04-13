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
  '01-abstract/1.0-abstract.md':                       'index.mdx',
  '02-introduction/2.0-introduction.md':               'introduction.mdx',
  '03-mechanism/3.1-system-participants-and-roles.md':  'mechanism/system-participants.mdx',
  '03-mechanism/3.2-task-lifecycle.md':                 'mechanism/task-lifecycle.mdx',
  '03-mechanism/3.3-evaluation-loop-and-sampling.md':   'mechanism/evaluation-loop.mdx',
  '03-mechanism/3.6-design-rationale.md':               'mechanism/design-rationale.mdx',
  '04-architecture/4.1-architectural-overview.md':      'architecture/overview.mdx',
  '04-architecture/4.2-environment-layer-affinetes.md': 'architecture/affinetes.mdx',
  '04-architecture/4.3-inference-layer.md':             'architecture/inference-layer.mdx',
  '04-architecture/4.4-openenv-protocol.md':            'architecture/openenv-protocol.mdx',
  '04-architecture/4.5-logprob-collection.md':          'architecture/logprob-collection.mdx',
  '04-architecture/4.6-execution-flow.md':              'architecture/execution-flow.mdx',
  '04-architecture/4.7-scalability-and-reproducibility.md': 'architecture/scalability.mdx',
  '05-environments/5.0-environment-overview.md':        'environments/overview.mdx',
  '05-environments/5.1-swe-infinite.md':                'environments/swe-infinite.mdx',
  '05-environments/5.2-liveweb-arena.md':               'environments/liveweb-arena.mdx',
  '05-environments/5.3-memorygym.md':                   'environments/memorygym.mdx',
  '05-environments/5.4-navworld-qqr.md':                'environments/navworld.mdx',
  '05-environments/5.5-game-openspiel.md':              'environments/openspiel.mdx',
  '05-environments/5.6-distill.md':                     'environments/distill.mdx',
  '06-scoring/6.1-scoring-pipeline.md':                 'scoring/scoring-pipeline.mdx',
  '06-scoring/6.2-anti-plagiarism.md':                  'scoring/anti-plagiarism.mdx',
  '07-mining-tutorial/7.1-miner-workflow.md':           'mining-tutorial/miner-workflow.mdx',
  '07-mining-tutorial/7.2-training-philosophy.md':      'mining-tutorial/training-philosophy.mdx',
  '08-training/8.1-distill-pipeline.md':                'training/distill-pipeline.mdx',
  '08-training/8.2-reward-signal-design.md':            'training/reward-signal.mdx',
  '09-benchmarks/9.0-benchmark-overview.md':            'benchmarks/overview.mdx',
  '09-benchmarks/9.1-stable-benchmarks.md':             'benchmarks/stable-benchmarks.mdx',
  '09-benchmarks/9.2-snapshot-benchmarks.md':           'benchmarks/snapshot-benchmarks.mdx',
  '09-benchmarks/9.3-code-generation.md':               'benchmarks/code-generation.mdx',
  '09-benchmarks/9.4-interpretation.md':                'benchmarks/interpretation.mdx',
  '10-roadmap/10.0-roadmap-overview.md':                'roadmap/overview.mdx',
  '10-roadmap/10.1-model-architecture-scaling.md':      'roadmap/model-scaling.mdx',
  '10-roadmap/10.2-distillation-evolution.md':          'roadmap/distillation-evolution.mdx',
  '10-roadmap/10.3-inference-independence.md':          'roadmap/inference-independence.mdx',
  '10-roadmap/10.4-environment-expansion.md':           'roadmap/environment-expansion.mdx',
  '10-roadmap/10.5-scoring-refinement.md':              'roadmap/scoring-refinement.mdx',
  '10-roadmap/10.6-conclusion.md':                      'roadmap/conclusion.mdx',
};

// ──────────────────────────────────────────────────────────────────────────────
// Section number → slug mapping for cross-references
// ──────────────────────────────────────────────────────────────────────────────

const SECTION_SLUGS = {
  '1':    '/',
  '1.0':  '/',
  '2':    '/introduction/',
  '2.0':  '/introduction/',
  '3':    '/mechanism/system-participants/',
  '3.1':  '/mechanism/system-participants/',
  '3.2':  '/mechanism/task-lifecycle/',
  '3.3':  '/mechanism/evaluation-loop/',
  '3.6':  '/mechanism/design-rationale/',
  '4':    '/architecture/overview/',
  '4.1':  '/architecture/overview/',
  '4.2':  '/architecture/affinetes/',
  '4.3':  '/architecture/inference-layer/',
  '4.4':  '/architecture/openenv-protocol/',
  '4.5':  '/architecture/logprob-collection/',
  '4.6':  '/architecture/execution-flow/',
  '4.7':  '/architecture/scalability/',
  '5':    '/environments/overview/',
  '5.0':  '/environments/overview/',
  '5.1':  '/environments/swe-infinite/',
  '5.2':  '/environments/liveweb-arena/',
  '5.3':  '/environments/memorygym/',
  '5.4':  '/environments/navworld/',
  '5.5':  '/environments/openspiel/',
  '5.6':  '/environments/distill/',
  '6':    '/scoring/scoring-pipeline/',
  '6.1':  '/scoring/scoring-pipeline/',
  '6.2':  '/scoring/anti-plagiarism/',
  '7':    '/mining-tutorial/miner-workflow/',
  '7.1':  '/mining-tutorial/miner-workflow/',
  '7.2':  '/mining-tutorial/training-philosophy/',
  '8':    '/training/distill-pipeline/',
  '8.1':  '/training/distill-pipeline/',
  '8.2':  '/training/reward-signal/',
  '9':    '/benchmarks/overview/',
  '9.0':  '/benchmarks/overview/',
  '9.1':  '/benchmarks/stable-benchmarks/',
  '9.2':  '/benchmarks/snapshot-benchmarks/',
  '9.3':  '/benchmarks/code-generation/',
  '9.4':  '/benchmarks/interpretation/',
  '10':   '/roadmap/overview/',
  '10.0': '/roadmap/overview/',
  '10.1': '/roadmap/model-scaling/',
  '10.2': '/roadmap/distillation-evolution/',
  '10.3': '/roadmap/inference-independence/',
  '10.4': '/roadmap/environment-expansion/',
  '10.5': '/roadmap/scoring-refinement/',
  '10.6': '/roadmap/conclusion/',
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

  // 3. Convert cross-references: §X.Y → links
  // Match §X.Y patterns (with or without parentheses, in various contexts)
  content = content.replace(/§(\d+(?:\.\d+)?)/g, (match, num) => {
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

  // 5. Escape JSX-problematic characters outside code blocks
  // MDX treats < as JSX tags. We need to escape bare < in prose (not in code blocks).
  const lines = content.split('\n');
  let inCodeBlock = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (!inCodeBlock) {
      // Escape < that is followed by a digit, =, or space (not HTML tags or mermaid)
      // but not inside inline code backticks
      lines[i] = lines[i].replace(/(?<!`[^`]*)<(?=[\d=\s])/g, '&lt;');
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
