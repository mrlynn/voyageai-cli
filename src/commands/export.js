'use strict';

const fs = require('fs');
const path = require('path');
const { exportArtifact, getFormatsForContext } = require('../lib/export');
const { copyToClipboard } = require('../lib/export/formats/clipboard-export');
const ui = require('../lib/ui');

/**
 * Register the export command on a Commander program.
 * @param {import('commander').Command} program
 */
function registerExport(program) {
  const exportCmd = program
    .command('export')
    .description('Export workflows, chat sessions, and search results in various formats');

  // ── export workflow <file> ──
  exportCmd
    .command('workflow <file>')
    .description('Export a workflow definition')
    .option('-f, --format <fmt>', 'Output format (json, markdown, mermaid, svg, png, clipboard)', 'json')
    .option('-o, --output <path>', 'Output file path (stdout if omitted)')
    .option('--options <json>', 'Format-specific options as JSON string', '{}')
    .option('--clipboard', 'Copy to system clipboard')
    .action(async (file, opts) => {
      await handleExport('workflow', file, opts);
    });

  // ── export chat <sessionId> ──
  exportCmd
    .command('chat <sessionId>')
    .description('Export a chat session')
    .option('-f, --format <fmt>', 'Output format (json, markdown, pdf, clipboard)', 'json')
    .option('-o, --output <path>', 'Output file path (stdout if omitted)')
    .option('--options <json>', 'Format-specific options as JSON string', '{}')
    .option('--clipboard', 'Copy to system clipboard')
    .action(async (sessionId, opts) => {
      await handleExport('chat', sessionId, opts);
    });

  // ── export results <file> ──
  exportCmd
    .command('results <file>')
    .description('Export saved search results')
    .option('-f, --format <fmt>', 'Output format (json, jsonl, csv, markdown, clipboard)', 'json')
    .option('-o, --output <path>', 'Output file path (stdout if omitted)')
    .option('--options <json>', 'Format-specific options as JSON string', '{}')
    .option('--clipboard', 'Copy to system clipboard')
    .action(async (file, opts) => {
      await handleExport('search', file, opts);
    });
}

/**
 * Handle an export action.
 */
async function handleExport(context, source, opts) {
  try {
    // Load source data
    let data;
    if (context === 'chat') {
      // Chat sessions are loaded from MongoDB — for now, support JSON file input too
      data = loadJsonFile(source);
    } else {
      data = loadJsonFile(source);
    }

    const format = opts.clipboard ? 'clipboard' : opts.format;
    const formatOptions = parseOptions(opts.options);

    const result = await exportArtifact({
      context,
      format,
      data,
      options: formatOptions,
    });

    const isBinary = Buffer.isBuffer(result.content);

    // Output
    if (opts.clipboard) {
      console.log(ui.success ? ui.success('Copied to clipboard') : '✓ Copied to clipboard');
    } else if (opts.output) {
      const outPath = path.resolve(opts.output);
      if (isBinary) {
        fs.writeFileSync(outPath, result.content);
      } else {
        fs.writeFileSync(outPath, result.content, 'utf-8');
      }
      console.log(ui.success ? ui.success(`Saved to ${outPath}`) : `✓ Saved to ${outPath}`);
    } else if (isBinary) {
      // Binary to stdout requires --output
      console.error(ui.error ? ui.error('Binary formats (png, pdf) require --output <path>') : '✗ Binary formats (png, pdf) require --output <path>');
      process.exitCode = 1;
    } else {
      // stdout
      process.stdout.write(result.content);
      if (!result.content.endsWith('\n')) process.stdout.write('\n');
    }
  } catch (err) {
    console.error(ui.error ? ui.error(err.message) : `✗ ${err.message}`);
    process.exitCode = 1;
  }
}

function loadJsonFile(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`File not found: ${resolved}`);
  }
  const raw = fs.readFileSync(resolved, 'utf-8');
  return JSON.parse(raw);
}

function parseOptions(jsonStr) {
  try {
    return JSON.parse(jsonStr || '{}');
  } catch {
    throw new Error(`Invalid --options JSON: ${jsonStr}`);
  }
}

module.exports = { registerExport };
