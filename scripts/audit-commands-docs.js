#!/usr/bin/env node
'use strict';

/**
 * Audit vai CLI commands against vai-docs.
 *
 * Usage:
 *   node scripts/audit-commands-docs.js [path-to-vai-docs] [--out report.md]
 *
 * Default path-to-vai-docs: ../vai-docs (sibling of voyageai-cli).
 * --out: write report to file instead of stdout.
 *
 * Outputs:
 *   - Commands in CLI but not documented in vai-docs
 *   - Command docs in vai-docs with no matching CLI command (e.g. overview.md is expected)
 *   - Matched commands and their doc paths
 *   - Summary counts
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const argv = process.argv.slice(2);
const outIndex = argv.indexOf('--out');
const outFile = outIndex !== -1 ? argv[outIndex + 1] : null;
const positional = argv.filter((a) => a !== '--out' && a !== outFile);
const VAI_DOCS = path.resolve(process.cwd(), positional[0] || '../vai-docs');
const DOCS_COMMANDS = path.join(VAI_DOCS, 'docs', 'commands');

// Top-level names we treat as one for "documented" (CLI name -> doc name)
const CLI_TO_DOC_ALIAS = {
  'mcp-server': 'mcp',
  explore: 'explain',
  bench: 'benchmark',
  gen: 'generate',
  'index-ws': 'index-workspace',
  wf: 'workflow',
  sc: 'search-code',
  ctx: 'context-code',
};

/**
 * Get top-level command names from `vai --help` (excluding "help").
 */
function getCliTopLevelCommands() {
  const out = execSync('node ./src/cli.js --help', {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
  const lines = out.split('\n');
  const commands = [];
  let inCommands = false;
  for (const line of lines) {
    if (line.startsWith('Commands:')) {
      inCommands = true;
      continue;
    }
    if (inCommands && line.trim() === '') break;
    if (inCommands) {
      const match = line.match(/^\s{2}(\S+)/);
      if (match) {
        const name = match[1];
        if (name === 'help') continue;
        if (name.includes('|')) {
          const [primary] = name.split('|');
          commands.push(primary.trim());
        } else {
          commands.push(name);
        }
      }
    }
  }
  return [...new Set(commands)];
}

/**
 * Get subcommands for a given parent (e.g. "workflow" -> ["run", "list", ...]).
 */
function getSubcommands(parentName) {
  const normalized = parentName.replace(/\|.*/, '').trim();
  try {
    const out = execSync(`node ./src/cli.js ${normalized} --help`, {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    });
    const lines = out.split('\n');
    const subs = [];
    let inCommands = false;
    for (const line of lines) {
      if (line.startsWith('Commands:')) {
        inCommands = true;
        continue;
      }
      if (inCommands && line.trim() === '') break;
      if (inCommands) {
        const match = line.match(/^\s{2}(\S+)/);
        if (match) {
          const name = match[1];
          if (name.includes(' ')) {
            subs.push(name.split(' ')[0]);
          } else {
            subs.push(name);
          }
        }
      }
    }
    return subs;
  } catch {
    return [];
  }
}

/**
 * Build full CLI command list: top-level + "parent sub" for each subcommand.
 */
function getFullCliCommandList() {
  const top = getCliTopLevelCommands();
  const full = new Set(top.map((c) => CLI_TO_DOC_ALIAS[c] || c));

  const withSubs = [
    'workflow',
    'config',
    'mcp-server',
    'index',
    'export',
    'code-search',
    'benchmark',
    'eval',
    'demo',
  ];
  for (const parent of top) {
    const canonicalParent = CLI_TO_DOC_ALIAS[parent] || parent;
    if (!withSubs.includes(parent) && !withSubs.includes(canonicalParent)) continue;
    const subs = getSubcommands(parent);
    for (const sub of subs) {
      if (sub === 'help') continue; // Commander built-in
      full.add(`${canonicalParent} ${sub}`);
    }
  }

  return full;
}

/**
 * List all command doc files under docs/commands (recursive).
 * Returns array of { relativePath, filePath, inferredCommand }.
 * inferredCommand: e.g. "workflow-run" -> "workflow run", "index-cmd" -> "index"
 */
function getDocCommandPages() {
  if (!fs.existsSync(DOCS_COMMANDS)) {
    return [];
  }
  const results = [];
  function walk(dir, prefix = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full, rel);
      } else if (e.isFile() && (e.name.endsWith('.md') || e.name.endsWith('.mdx'))) {
        const base = e.name.replace(/\.(md|mdx)$/, '');
        const inferred = fileBaseToCommand(rel, base);
        results.push({ relativePath: rel, filePath: full, inferredCommand: inferred });
      }
    }
  }
  walk(DOCS_COMMANDS);
  return results;
}

/**
 * Map file path + base name to "parent sub" or "parent" command string.
 * - workflow-run.md -> "workflow run"
 * - index-cmd.md -> "index"
 * - mcp-install.md -> "mcp install"
 * - embed.md -> "embed"
 */
function fileBaseToCommand(relativePath, base) {
  const dir = path.dirname(relativePath);
  const lower = base.toLowerCase();

  if (lower === 'index-cmd') return 'index';
  if (lower === 'eval-compare') return 'eval compare';

  const withHyphen = base.replace(/-/g, ' ');
  const parts = withHyphen.split(' ');
  if (parts.length >= 2 && ['workflow', 'mcp', 'config'].some((p) => dir.includes(p) || parts[0] === p)) {
    return parts.join(' ');
  }
  if (dir.includes('advanced') && parts[0] === 'workflow' && parts[1]) {
    return parts.join(' ');
  }
  if (dir.includes('mcp') && base.startsWith('mcp-')) {
    const sub = base.slice(4).replace(/-/g, ' ');
    return sub ? `mcp ${sub}` : 'mcp';
  }
  if (dir.includes('evaluation') && lower === 'eval-compare') return 'eval compare';
  if (dir.includes('evaluation') && lower === 'benchmark') return 'benchmark';
  if (dir.includes('evaluation') && lower === 'eval') return 'eval';

  return parts[0] || base;
}

/**
 * Normalize a doc-inferred command for comparison (e.g. "workflow run" stays, "mcp" stays).
 */
function normalizeDocCommand(s) {
  return s.trim().toLowerCase();
}

/**
 * Check if a CLI command (full path like "workflow run" or "embed") is covered by a doc page.
 */
function docCoversCommand(docInferred, cliCommand) {
  const d = normalizeDocCommand(docInferred);
  const c = normalizeDocCommand(cliCommand);
  if (d === c) return true;
  if (c.startsWith(d + ' ') || d.startsWith(c + ' ')) return true;
  return false;
}

/**
 * Find which doc page (if any) documents a given CLI command.
 */
function findDocForCliCommand(docPages, cliCommand) {
  const norm = normalizeDocCommand(cliCommand);
  for (const doc of docPages) {
    const docNorm = normalizeDocCommand(doc.inferredCommand);
    if (docNorm === norm) return doc;
    if (norm.startsWith(docNorm + ' ') || docNorm.startsWith(norm + ' ')) return doc;
  }
  return null;
}

function main() {
  console.log('vai CLI vs vai-docs command audit\n');
  console.log('vai-docs path:', VAI_DOCS);
  if (!fs.existsSync(VAI_DOCS)) {
    console.error('Error: vai-docs path does not exist.');
    process.exit(1);
  }
  console.log('');

  const cliCommands = getFullCliCommandList();
  const docPages = getDocCommandPages();

  const cliList = [...cliCommands].filter((c) => c !== 'help' && !c.endsWith(' help')).sort();

  const missingInDocs = [];
  const documented = [];
  for (const cmd of cliList) {
    const doc = findDocForCliCommand(docPages, cmd);
    if (doc) {
      documented.push({ cmd, doc: doc.relativePath });
    } else {
      missingInDocs.push(cmd);
    }
  }

  const docOnly = [];
  for (const d of docPages) {
    const norm = normalizeDocCommand(d.inferredCommand);
    const matched = [...cliCommands].some((c) => {
      const cn = normalizeDocCommand(c);
      return cn === norm || c.startsWith(norm + ' ') || norm.startsWith(c + ' ');
    });
    if (!matched) {
      docOnly.push({ inferred: d.inferredCommand, path: d.relativePath });
    }
  }

  const sections = [];
  sections.push('--- Commands in CLI but not documented in vai-docs ---');
  if (missingInDocs.length === 0) {
    sections.push('(none)\n');
  } else {
    missingInDocs.sort();
    missingInDocs.forEach((c) => sections.push('  ' + c));
    sections.push('');
  }
  sections.push('--- Documented in vai-docs but no matching CLI command ---');
  if (docOnly.length === 0) {
    sections.push('(none)\n');
  } else {
    docOnly.forEach(({ inferred, path: p }) => sections.push('  ' + inferred + ' -> ' + p));
    sections.push('');
  }
  sections.push('--- Documented (matched to CLI) ---');
  documented.sort((a, b) => a.cmd.localeCompare(b.cmd));
  documented.forEach(({ cmd, doc }) => sections.push('  ' + cmd + ' -> ' + doc));
  sections.push('');
  sections.push('--- Summary ---');
  sections.push('  CLI commands (top-level + key subcommands): ' + cliList.length);
  sections.push('  Doc command pages: ' + docPages.length);
  sections.push('  Matched (documented): ' + documented.length);
  sections.push('  In CLI only (missing in docs): ' + missingInDocs.length);
  sections.push('  In docs only (no CLI match): ' + docOnly.length);

  const report =
    'vai CLI vs vai-docs command audit\n\nvai-docs path: ' +
    VAI_DOCS +
    '\n\n' +
    sections.join('\n');
  if (outFile) {
    fs.writeFileSync(outFile, report, 'utf8');
    console.log('Wrote report to ' + outFile);
  } else {
    console.log(report);
  }
}

main();
