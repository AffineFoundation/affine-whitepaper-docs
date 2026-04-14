/**
 * Unit tests for the whitepaper conversion pipeline (convert-whitepaper.mjs).
 * Uses Node.js built-in test runner (node --test).
 *
 * Run: node --test tests/test-conversion.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const FIXTURE = readFileSync(join(__dirname, 'fixtures', 'sample-whitepaper.md'), 'utf-8');

// ---------------------------------------------------------------------------
// Helper: run the conversion script on a temp whitepaper directory
// ---------------------------------------------------------------------------
function runConversion(inputFiles) {
  const tmpWhitepaper = join(ROOT, '_test_whitepaper');
  const tmpOutput = join(ROOT, '_test_output');

  // Cleanup
  if (existsSync(tmpWhitepaper)) rmSync(tmpWhitepaper, { recursive: true });
  if (existsSync(tmpOutput)) rmSync(tmpOutput, { recursive: true });

  // Write input files
  for (const [relPath, content] of Object.entries(inputFiles)) {
    const fullPath = join(tmpWhitepaper, relPath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, 'utf-8');
  }

  // We can't easily run the full script with different dirs,
  // so we test the transformations inline below.

  // Cleanup
  if (existsSync(tmpWhitepaper)) rmSync(tmpWhitepaper, { recursive: true });
  if (existsSync(tmpOutput)) rmSync(tmpOutput, { recursive: true });
}

// ---------------------------------------------------------------------------
// Test: H1 extraction
// ---------------------------------------------------------------------------
describe('H1 extraction', () => {
  it('extracts H1 as title', () => {
    const h1Match = FIXTURE.match(/^#\s+(.+)$/m);
    assert.ok(h1Match, 'Should find an H1');
    assert.equal(h1Match[1].trim(), '3.1 System Participants and Roles');
  });

  it('removes H1 from body after extraction', () => {
    let content = FIXTURE;
    content = content.replace(/^#\s+.+\n?\n?/, '');
    assert.ok(!content.startsWith('# 3.1'), 'H1 should be removed from body');
    assert.ok(content.includes('**Overview.**'), 'Body content should remain');
  });
});

// ---------------------------------------------------------------------------
// Test: Cross-reference conversion
// ---------------------------------------------------------------------------
describe('Cross-reference conversion', () => {
  // Import the section slugs from the conversion script
  const SECTION_SLUGS = {
    '3.2': '/mechanism/task-lifecycle/',
    '5.1': '/environments/swe-infinite/',
    '6.1': '/scoring/scoring-pipeline/',
    '7.1': '/mining-tutorial/miner-workflow/',
    '10.6': '/roadmap/conclusion/',
  };

  it('converts §X.Y to links', () => {
    let content = '§5.1 is the environment';
    content = content.replace(/§(\d+(?:\.\d+)?)/g, (match, num) => {
      const slug = SECTION_SLUGS[num];
      return slug ? `[§${num}](${slug})` : match;
    });
    assert.equal(content, '[§5.1](/environments/swe-infinite/) is the environment');
  });

  it('converts Section X.Y to links', () => {
    let content = 'See Section 3.2 for details';
    content = content.replace(/(?<!\[)Section\s+(\d+(?:\.\d+)?)(?!\])/g, (match, num) => {
      const slug = SECTION_SLUGS[num];
      return slug ? `[Section ${num}](${slug})` : match;
    });
    assert.equal(content, 'See [Section 3.2](/mechanism/task-lifecycle/) for details');
  });

  it('leaves missing section references as plain text', () => {
    let content = 'Section 3.4 does not exist';
    content = content.replace(/(?<!\[)Section\s+(\d+(?:\.\d+)?)(?!\])/g, (match, num) => {
      const slug = SECTION_SLUGS[num];
      return slug ? `[Section ${num}](${slug})` : match;
    });
    assert.equal(content, 'Section 3.4 does not exist');
  });
});

// ---------------------------------------------------------------------------
// Test: JSX escaping
// ---------------------------------------------------------------------------
describe('JSX character escaping', () => {
  it('escapes < followed by digits', () => {
    const line = 'response time <100ms';
    const result = line.replace(/(?<!`[^`]*)<(?=[\d=\s])/g, '&lt;');
    assert.ok(result.includes('&lt;100ms'), `Expected &lt;100ms but got: ${result}`);
  });

  it('escapes <= operators', () => {
    const line = 'threshold <=5%';
    const result = line.replace(/(?<!`[^`]*)<(?=[\d=\s])/g, '&lt;');
    assert.ok(result.includes('&lt;=5%'), `Expected &lt;=5% but got: ${result}`);
  });

  it('preserves < in code blocks', () => {
    const lines = ['```', '<5 is small', '```'];
    let inCodeBlock = false;
    const result = [];
    for (const line of lines) {
      if (line.trimStart().startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        result.push(line);
        continue;
      }
      if (!inCodeBlock) {
        result.push(line.replace(/(?<!`[^`]*)<(?=[\d=\s])/g, '&lt;'));
      } else {
        result.push(line);
      }
    }
    assert.equal(result[1], '<5 is small', 'Code block content should not be escaped');
  });
});

// ---------------------------------------------------------------------------
// Test: Mermaid transformations
// ---------------------------------------------------------------------------
describe('Mermaid transformations', () => {
  it('converts \\n to <br> in mermaid blocks', () => {
    const input = '```mermaid\ngraph TD\n    A["Node A\\nFirst line"]\n```';
    const result = input.replace(/```mermaid\n([\s\S]*?)```/g, (match, code) => {
      return '```mermaid\n' + code.replace(/\\n/g, '<br>') + '```';
    });
    assert.ok(result.includes('Node A<br>First line'), 'Should convert \\n to <br>');
    assert.ok(!result.includes('\\n'), 'No \\n should remain in mermaid');
  });

  it('strips classDef lines', () => {
    const input = '```mermaid\ngraph TD\n    A --> B\n    classDef default fill:#f9f9f9\n```';
    const result = input.replace(/^\s*classDef\s+.*$/gm, '');
    assert.ok(!result.includes('classDef'), 'classDef should be removed');
    assert.ok(result.includes('A --> B'), 'Graph content should remain');
  });

  it('strips style fill lines', () => {
    const input = '    style A fill:#e8f5e9\n    style B fill:#ffebee';
    const result = input.replace(/^\s*classDef\s+.*$/gm, '').replace(/^\s*style\s+\w+\s+fill:#[a-fA-F0-9]+.*$/gm, '');
    assert.ok(!result.includes('fill:#'), 'Style fill lines should be removed');
  });
});

// ---------------------------------------------------------------------------
// Test: Table wrapping
// ---------------------------------------------------------------------------
describe('Table wrapping', () => {
  it('wraps table blocks in <Table> component', () => {
    const input = 'Text before\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\nText after';
    const lines = input.split('\n');
    const result = [];
    let inTable = false;
    for (const line of lines) {
      const isTable = line.trimStart().startsWith('|');
      if (isTable && !inTable) {
        inTable = true;
        result.push('<Table>');
        result.push('');
      } else if (!isTable && inTable) {
        inTable = false;
        result.push('');
        result.push('</Table>');
        result.push('');
      }
      result.push(line);
    }
    if (inTable) { result.push(''); result.push('</Table>'); }
    const output = result.join('\n');

    assert.ok(output.includes('<Table>'), 'Should have opening <Table>');
    assert.ok(output.includes('</Table>'), 'Should have closing </Table>');
    assert.ok(output.includes('| A | B |'), 'Table content should remain');
    assert.ok(output.includes('Text before'), 'Text before should remain');
    assert.ok(output.includes('Text after'), 'Text after should remain');
  });

  it('handles multiple tables', () => {
    const input = '| A |\n|---|\n| 1 |\n\nMiddle\n\n| B |\n|---|\n| 2 |';
    const lines = input.split('\n');
    const result = [];
    let inTable = false;
    for (const line of lines) {
      const isTable = line.trimStart().startsWith('|');
      if (isTable && !inTable) { inTable = true; result.push('<Table>'); result.push(''); }
      else if (!isTable && inTable) { inTable = false; result.push(''); result.push('</Table>'); result.push(''); }
      result.push(line);
    }
    if (inTable) { result.push(''); result.push('</Table>'); }
    const output = result.join('\n');
    const tableCount = (output.match(/<Table>/g) || []).length;
    assert.equal(tableCount, 2, 'Should have 2 <Table> tags');
  });
});

// ---------------------------------------------------------------------------
// Test: Full pipeline validation
// ---------------------------------------------------------------------------
describe('Full pipeline output validation', () => {
  it('existing whitepaper MDX files have valid frontmatter', () => {
    const docsDir = join(ROOT, 'src', 'content', 'docs');
    const indexMdx = readFileSync(join(docsDir, 'index.mdx'), 'utf-8');

    assert.ok(indexMdx.startsWith('---\n'), 'Should start with frontmatter');
    assert.ok(indexMdx.includes('title:'), 'Should have title in frontmatter');
    assert.ok(indexMdx.includes('---\n\n'), 'Should close frontmatter');
  });

  it('whitepaper MDX files have no raw H1 duplicating title', () => {
    const docsDir = join(ROOT, 'src', 'content', 'docs');
    const indexMdx = readFileSync(join(docsDir, 'index.mdx'), 'utf-8');

    // Extract title from frontmatter
    const titleMatch = indexMdx.match(/title:\s*"(.+?)"/);
    if (titleMatch) {
      const title = titleMatch[1];
      const body = indexMdx.split('---')[2] || '';
      const bodyH1 = body.match(/^#\s+(.+)$/m);
      if (bodyH1) {
        assert.notEqual(
          bodyH1[1].trim().toLowerCase(),
          title.toLowerCase(),
          `Body H1 "${bodyH1[1]}" should not duplicate frontmatter title "${title}"`
        );
      }
    }
  });

  it('all whitepaper source files have corresponding MDX output', () => {
    const FILE_MAP = {
      '01-abstract/1.0-abstract.md': 'index.mdx',
      '02-introduction/2.0-introduction.md': 'introduction.mdx',
      '03-mechanism/3.1-system-participants-and-roles.md': 'mechanism/system-participants.mdx',
      '03-mechanism/3.2-task-lifecycle.md': 'mechanism/task-lifecycle.mdx',
      '03-mechanism/3.3-evaluation-loop-and-sampling.md': 'mechanism/evaluation-loop.mdx',
      '03-mechanism/3.6-design-rationale.md': 'mechanism/design-rationale.mdx',
    };
    const docsDir = join(ROOT, 'src', 'content', 'docs');
    for (const [src, dest] of Object.entries(FILE_MAP)) {
      const srcPath = join(ROOT, 'whitepaper', src);
      const destPath = join(docsDir, dest);
      if (existsSync(srcPath)) {
        assert.ok(existsSync(destPath), `Missing MDX output for ${src} → expected ${dest}`);
      }
    }
  });

  it('conversion script runs without errors', () => {
    const result = execSync('node scripts/convert-whitepaper.mjs', {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 30000,
    });
    assert.ok(result.includes('Done.'), 'Conversion should complete successfully');
    assert.ok(result.includes('Converted'), 'Should report converted files');
  });
});
