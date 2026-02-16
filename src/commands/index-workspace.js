'use strict';

const path = require('path');
let ora;
async function getOra() {
  if (!ora) { ora = (await import('ora')).default; }
  return ora;
}
const pc = require('picocolors');

/**
 * Register the index-workspace command.
 * @param {import('commander').Command} program
 */
function registerIndexWorkspace(program) {
  program
    .command('index-workspace [path]')
    .alias('index-ws')
    .description('Index a workspace/codebase for semantic code search')
    .option('--db <name>', 'MongoDB database name')
    .option('--collection <name>', 'Collection to store indexed documents')
    .option('--content-type <type>', 'Content type: code, docs, config, or all', 'code')
    .option('--model <name>', 'Embedding model', 'voyage-code-3')
    .option('--max-files <n>', 'Maximum files to index', (v) => parseInt(v, 10), 1000)
    .option('--max-file-size <bytes>', 'Maximum file size in bytes', (v) => parseInt(v, 10), 100000)
    .option('--chunk-size <n>', 'Target chunk size in characters', (v) => parseInt(v, 10), 512)
    .option('--chunk-overlap <n>', 'Overlap between chunks', (v) => parseInt(v, 10), 50)
    .option('--batch-size <n>', 'Files per batch', (v) => parseInt(v, 10), 10)
    .option('--create-index', 'Create vector search index after indexing')
    .option('--json', 'Output as JSON')
    .action(async (workspacePath, opts) => {
      const telemetry = require('../lib/telemetry');
      telemetry.send('cli_index_workspace_run', { contentType: opts.contentType });

      const { handleIndexWorkspace } = require('../mcp/tools/workspace');
      const resolvedPath = workspacePath ? path.resolve(workspacePath) : process.cwd();

      const spinner = (await getOra())(`Indexing ${resolvedPath}...`).start();

      try {
        const result = await handleIndexWorkspace({
          path: resolvedPath,
          db: opts.db,
          collection: opts.collection,
          contentType: opts.contentType,
          model: opts.model,
          maxFiles: opts.maxFiles,
          maxFileSize: opts.maxFileSize,
          chunkSize: opts.chunkSize,
          chunkOverlap: opts.chunkOverlap,
          batchSize: opts.batchSize,
        });

        spinner.stop();

        if (opts.json) {
          console.log(JSON.stringify(result.structuredContent, null, 2));
        } else {
          const stats = result.structuredContent;
          console.log('\n' + pc.green('Workspace indexed successfully!') + '\n');
          console.log(`  Files found:    ${stats.filesFound}`);
          console.log(`  Files indexed:  ${stats.filesIndexed}`);
          console.log(`  Chunks created: ${stats.chunksCreated}`);
          console.log(`  Time:           ${stats.timeMs}ms`);
          console.log(`  Collection:     ${stats.db}.${stats.collection}`);
          console.log(`  Model:          ${stats.model}`);

          if (stats.errors?.length > 0) {
            console.log('\n' + pc.yellow(`Errors (${stats.errors.length}):`));
            for (const err of stats.errors.slice(0, 5)) {
              console.log(`  ${pc.dim(err.file)}: ${err.error}`);
            }
            if (stats.errors.length > 5) {
              console.log(`  ... and ${stats.errors.length - 5} more`);
            }
          }
        }

        // Create index if requested
        if (opts.createIndex) {
          const indexSpinner = (await getOra())('Creating vector search index...').start();
          try {
            const { createVectorIndex } = require('../lib/mongo');
            await createVectorIndex(
              result.structuredContent.db,
              result.structuredContent.collection,
              'vector_index',
              'embedding'
            );
            indexSpinner.succeed('Vector search index created');
          } catch (err) {
            indexSpinner.fail(`Failed to create index: ${err.message}`);
          }
        }

      } catch (err) {
        spinner.fail(`Indexing failed: ${err.message}`);
        process.exit(1);
      }
    });

  // Search code command
  program
    .command('search-code <query>')
    .alias('sc')
    .description('Semantic code search across indexed codebase')
    .option('--db <name>', 'MongoDB database name')
    .option('--collection <name>', 'Collection with indexed code')
    .option('--limit <n>', 'Maximum results', (v) => parseInt(v, 10), 10)
    .option('--language <lang>', 'Filter by programming language (e.g., js, py, go)')
    .option('--category <cat>', 'Filter by category: code, docs, config')
    .option('--model <name>', 'Embedding model')
    .option('--json', 'Output as JSON')
    .action(async (query, opts) => {
      const telemetry = require('../lib/telemetry');
      telemetry.send('cli_search_code_run', { language: opts.language });

      const { handleSearchCode } = require('../mcp/tools/workspace');
      const spinner = (await getOra())('Searching...').start();

      try {
        const result = await handleSearchCode({
          query,
          db: opts.db,
          collection: opts.collection,
          limit: opts.limit,
          language: opts.language,
          category: opts.category,
          model: opts.model,
        });

        spinner.stop();

        if (opts.json) {
          console.log(JSON.stringify(result.structuredContent, null, 2));
        } else {
          const results = result.structuredContent.results;
          const meta = result.structuredContent.metadata;

          console.log(`\n${pc.bold(`Found ${results.length} results`)} ${pc.dim(`(${meta.timeMs}ms)`)}\n`);

          for (let i = 0; i < results.length; i++) {
            const r = results[i];
            const score = (r.score * 100).toFixed(1);

            console.log(pc.cyan(`[${i + 1}] ${r.source}`) + pc.dim(` (${r.language || 'unknown'}) — ${score}%`));

            if (r.symbols?.length > 0) {
              console.log(pc.dim(`    Symbols: ${r.symbols.slice(0, 5).join(', ')}`));
            }

            // Show snippet
            const snippet = r.content.slice(0, 200).replace(/\n/g, '\n    ');
            console.log(pc.dim('    ' + snippet + (r.content.length > 200 ? '...' : '')));
            console.log('');
          }
        }

      } catch (err) {
        spinner.fail(`Search failed: ${err.message}`);
        process.exit(1);
      }
    });

  // Explain code command (context retrieval for code)
  program
    .command('context-code')
    .alias('ctx')
    .description('Get contextual information for code from indexed documentation')
    .option('--code <snippet>', 'Code snippet to explain')
    .option('--file <path>', 'File containing code to explain')
    .option('--language <lang>', 'Programming language')
    .option('--db <name>', 'MongoDB database name')
    .option('--collection <name>', 'Collection with indexed documentation')
    .option('--context-limit <n>', 'Number of context documents', (v) => parseInt(v, 10), 5)
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const telemetry = require('../lib/telemetry');
      telemetry.send('cli_explain_code_run');

      const { handleExplainCode } = require('../mcp/tools/workspace');
      const fs = require('fs');

      let code = opts.code;

      // Read from file if provided
      if (opts.file && !code) {
        try {
          code = fs.readFileSync(opts.file, 'utf-8');
          if (!opts.language) {
            opts.language = path.extname(opts.file).slice(1);
          }
        } catch (err) {
          console.error(`Failed to read file: ${err.message}`);
          process.exit(1);
        }
      }

      // Read from stdin if no code provided
      if (!code) {
        console.error('Provide code via --code, --file, or pipe to stdin');
        process.exit(1);
      }

      const spinner = (await getOra())('Finding relevant context...').start();

      try {
        const result = await handleExplainCode({
          code,
          language: opts.language,
          db: opts.db,
          collection: opts.collection,
          contextLimit: opts.contextLimit,
        });

        spinner.stop();

        if (opts.json) {
          console.log(JSON.stringify(result.structuredContent, null, 2));
        } else {
          console.log('\n' + pc.bold('Code Context') + '\n');
          console.log(pc.dim('─'.repeat(60)) + '\n');

          const context = result.structuredContent.context || [];
          if (context.length === 0) {
            console.log(pc.yellow('No relevant context found. Try indexing more documentation.'));
          } else {
            for (const ctx of context) {
              console.log(pc.cyan(`[${ctx.source}]`) + pc.dim(` — ${(ctx.score * 100).toFixed(1)}%`));
              console.log(ctx.content.slice(0, 500));
              console.log(pc.dim('─'.repeat(40)) + '\n');
            }
          }
        }

      } catch (err) {
        spinner.fail(`Explain failed: ${err.message}`);
        process.exit(1);
      }
    });
}

module.exports = { registerIndexWorkspace };
