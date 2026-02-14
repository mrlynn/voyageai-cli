'use strict';

const fs = require('fs');
const path = require('path');
const { chunk, estimateTokens, STRATEGIES, DEFAULTS } = require('../lib/chunker');
const { readFile, scanDirectory, isSupported, getReaderType } = require('../lib/readers');
const { loadProject, mergeOptions } = require('../lib/project');
const ui = require('../lib/ui');

/**
 * Format a number with commas.
 */
function fmtNum(n) {
  return n.toLocaleString('en-US');
}

/**
 * Build chunk metadata for a source file.
 * @param {string} filePath - Source file path
 * @param {string} basePath - Base directory for relative paths
 * @param {number} index - Chunk index within the file
 * @param {number} total - Total chunks from this file
 * @returns {object}
 */
function buildMetadata(filePath, basePath, index, total) {
  return {
    source: path.relative(basePath, filePath),
    chunk_index: index,
    total_chunks: total,
  };
}

/**
 * Register the chunk command on a Commander program.
 * @param {import('commander').Command} program
 */
function registerChunk(program) {
  program
    .command('chunk [input]')
    .description('Chunk documents for embedding — files, directories, or stdin')
    .option('-s, --strategy <strategy>', `Chunking strategy: ${STRATEGIES.join(', ')}`)
    .option('-c, --chunk-size <n>', 'Target chunk size in characters', (v) => parseInt(v, 10))
    .option('--overlap <n>', 'Overlap between chunks in characters', (v) => parseInt(v, 10))
    .option('--min-size <n>', 'Minimum chunk size (drop smaller)', (v) => parseInt(v, 10))
    .option('-o, --output <path>', 'Output file (JSONL). Omit for stdout')
    .option('--text-field <name>', 'Text field name for JSON/JSONL input', 'text')
    .option('--extensions <exts>', 'Comma-separated file extensions to include when scanning directories')
    .option('--ignore <dirs>', 'Comma-separated directory names to skip', 'node_modules,.git,__pycache__')
    .option('--dry-run', 'Show what would be chunked without processing')
    .option('--stats', 'Show chunking statistics after processing')
    .option('--json', 'Machine-readable JSON output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(async (input, opts) => {
      const telemetry = require('../lib/telemetry');
      try {
        // Load project config, merge with CLI opts
        const { config: projectConfig } = loadProject();
        const chunkConfig = projectConfig.chunk || {};

        const strategy = opts.strategy || chunkConfig.strategy || DEFAULTS.strategy || 'recursive';
        const chunkSize = opts.chunkSize || chunkConfig.size || DEFAULTS.size;
        const overlap = opts.overlap != null ? opts.overlap : (chunkConfig.overlap != null ? chunkConfig.overlap : DEFAULTS.overlap);
        const minSize = opts.minSize || chunkConfig.minSize || DEFAULTS.minSize;
        const textField = opts.textField || 'text';

        const done = telemetry.timer('cli_chunk', {
          strategy,
          chunkSize,
          overlap,
        });

        if (!STRATEGIES.includes(strategy)) {
          console.error(ui.error(`Unknown strategy: "${strategy}". Available: ${STRATEGIES.join(', ')}`));
          process.exit(1);
        }

        // Resolve input files
        const files = resolveInput(input, opts);

        if (files.length === 0) {
          console.error(ui.error('No supported files found. Supported types: .txt, .md, .html, .json, .jsonl, .pdf'));
          process.exit(1);
        }

        // Dry run
        if (opts.dryRun) {
          if (opts.json) {
            console.log(JSON.stringify({ files: files.map(f => path.relative(process.cwd(), f)), strategy, chunkSize, overlap }, null, 2));
          } else {
            console.log(ui.bold(`Would chunk ${files.length} file(s) with strategy: ${strategy}`));
            console.log(ui.dim(`  Chunk size: ${chunkSize} chars, overlap: ${overlap} chars`));
            console.log('');
            for (const f of files) {
              const size = fs.statSync(f).size;
              console.log(`  ${ui.dim(path.relative(process.cwd(), f))} (${fmtNum(size)} bytes)`);
            }
          }
          return;
        }

        // Process files
        const basePath = input && fs.existsSync(input) && fs.statSync(input).isDirectory()
          ? path.resolve(input)
          : process.cwd();

        const allChunks = [];
        const fileStats = [];

        const showProgress = !opts.json && !opts.quiet && files.length > 1;
        if (showProgress) {
          console.log(ui.bold(`Chunking ${files.length} file(s) with strategy: ${strategy}`));
          console.log(ui.dim(`  Chunk size: ${chunkSize}, overlap: ${overlap}, min: ${minSize}`));
          console.log('');
        }

        for (let fi = 0; fi < files.length; fi++) {
          const filePath = files[fi];
          const relPath = path.relative(basePath, filePath);
          const readerType = getReaderType(filePath);

          try {
            const content = await readFile(filePath, { textField });

            // readFile returns string for text/html/pdf, array for json/jsonl
            let textsToChunk = [];

            if (typeof content === 'string') {
              textsToChunk = [{ text: content, metadata: {} }];
            } else if (Array.isArray(content)) {
              textsToChunk = content;
            }

            let fileChunkCount = 0;
            for (const item of textsToChunk) {
              const effectiveStrategy = readerType === 'text' && filePath.endsWith('.md') ? 'markdown' : strategy;
              // Auto-detect markdown for .md files when using default strategy
              const useStrategy = (strategy === 'recursive' && filePath.endsWith('.md')) ? 'markdown' : strategy;

              const chunks = chunk(item.text, {
                strategy: useStrategy,
                size: chunkSize,
                overlap,
                minSize,
              });

              for (let ci = 0; ci < chunks.length; ci++) {
                allChunks.push({
                  text: chunks[ci],
                  metadata: {
                    ...item.metadata,
                    ...buildMetadata(filePath, basePath, ci, chunks.length),
                  },
                });
              }
              fileChunkCount += chunks.length;
            }

            fileStats.push({
              file: relPath,
              inputChars: textsToChunk.reduce((sum, t) => sum + t.text.length, 0),
              chunks: fileChunkCount,
            });

            if (showProgress) {
              console.log(`  ${ui.green('✓')} ${relPath} → ${fileChunkCount} chunks`);
            }
          } catch (err) {
            fileStats.push({ file: relPath, error: err.message, chunks: 0 });
            if (!opts.quiet) {
              console.error(`  ${ui.red('✗')} ${relPath}: ${err.message}`);
            }
          }
        }

        // Output
        if (opts.json) {
          const output = {
            totalChunks: allChunks.length,
            totalTokens: allChunks.reduce((sum, c) => sum + estimateTokens(c.text), 0),
            strategy,
            chunkSize,
            overlap,
            files: fileStats,
            chunks: allChunks,
          };
          const jsonStr = JSON.stringify(output, null, 2);
          if (opts.output) {
            fs.writeFileSync(opts.output, jsonStr + '\n');
          } else {
            console.log(jsonStr);
          }
        } else {
          // JSONL output
          const lines = allChunks.map(c => JSON.stringify(c));
          const jsonlStr = lines.join('\n') + '\n';

          if (opts.output) {
            fs.writeFileSync(opts.output, jsonlStr);
            if (!opts.quiet) {
              console.log('');
              console.log(ui.success(`Wrote ${fmtNum(allChunks.length)} chunks to ${opts.output}`));
            }
          } else if (opts.quiet || !showProgress) {
            // Stdout — write JSONL directly
            process.stdout.write(jsonlStr);
          } else {
            // Progress was shown, write to stdout with separator
            console.log('');
            process.stdout.write(jsonlStr);
          }
        }

        // Stats summary
        if ((opts.stats || showProgress) && !opts.json) {
          const totalChars = fileStats.reduce((sum, f) => sum + (f.inputChars || 0), 0);
          const totalTokens = allChunks.reduce((sum, c) => sum + estimateTokens(c.text), 0);
          const avgChunkSize = allChunks.length > 0
            ? Math.round(allChunks.reduce((sum, c) => sum + c.text.length, 0) / allChunks.length)
            : 0;
          const errors = fileStats.filter(f => f.error).length;

          console.log('');
          console.log(ui.bold('Summary'));
          console.log(ui.label('Files', `${fmtNum(files.length)}${errors ? ` (${errors} failed)` : ''}`));
          console.log(ui.label('Input', `${fmtNum(totalChars)} chars`));
          console.log(ui.label('Chunks', fmtNum(allChunks.length)));
          console.log(ui.label('Avg chunk', `${fmtNum(avgChunkSize)} chars (~${fmtNum(Math.round(avgChunkSize / 4))} tokens)`));
          console.log(ui.label('Est. tokens', `~${fmtNum(totalTokens)}`));

          // Cost hint
          const pricePerMToken = 0.12; // voyage-4-large default
          const cost = (totalTokens / 1e6) * pricePerMToken;
          if (cost > 0) {
            console.log(ui.label('Est. cost', ui.dim(`~$${cost < 0.01 ? cost.toFixed(4) : cost.toFixed(2)} with voyage-4-large`)));
          }
        }

        done({ chunkCount: allChunks.length });
      } catch (err) {
        telemetry.send('cli_error', { command: 'chunk', errorType: err.constructor.name });
        console.error(ui.error(err.message));
        process.exit(1);
      }
    });
}

/**
 * Resolve input to a list of file paths.
 * @param {string} input - File path, directory path, or glob
 * @param {object} opts
 * @returns {string[]}
 */
function resolveInput(input, opts) {
  if (!input) {
    console.error(ui.error('Please provide a file or directory path.'));
    console.error(ui.dim('  Usage: vai chunk <file-or-directory> [options]'));
    process.exit(1);
  }

  const resolved = path.resolve(input);

  if (!fs.existsSync(resolved)) {
    console.error(ui.error(`Not found: ${input}`));
    process.exit(1);
  }

  const stat = fs.statSync(resolved);

  if (stat.isFile()) {
    return [resolved];
  }

  if (stat.isDirectory()) {
    const scanOpts = {};
    if (opts.extensions) {
      scanOpts.extensions = opts.extensions.split(',').map(e => e.trim());
    }
    if (opts.ignore) {
      scanOpts.ignore = opts.ignore.split(',').map(d => d.trim());
    }
    return scanDirectory(resolved, scanOpts);
  }

  return [];
}

module.exports = { registerChunk };
