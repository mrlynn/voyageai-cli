'use strict';

const fs = require('fs');
const path = require('path');
const { chunk, estimateTokens, STRATEGIES } = require('../lib/chunker');
const { readFile, scanDirectory, isSupported, getReaderType } = require('../lib/readers');
const { loadProject } = require('../lib/project');
const { getDefaultModel } = require('../lib/catalog');
const { generateEmbeddings } = require('../lib/api');
const { getMongoCollection } = require('../lib/mongo');
const ui = require('../lib/ui');

/**
 * Format number with commas.
 */
function fmtNum(n) {
  return n.toLocaleString('en-US');
}

/**
 * Resolve input path(s) to file list.
 */
function resolveFiles(input, opts) {
  const resolved = path.resolve(input);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Not found: ${input}`);
  }

  const stat = fs.statSync(resolved);
  if (stat.isFile()) return [resolved];

  if (stat.isDirectory()) {
    const scanOpts = {};
    if (opts.extensions) scanOpts.extensions = opts.extensions.split(',').map(e => e.trim());
    if (opts.ignore) scanOpts.ignore = opts.ignore.split(',').map(d => d.trim());
    return scanDirectory(resolved, scanOpts);
  }

  return [];
}

/**
 * Register the pipeline command on a Commander program.
 * @param {import('commander').Command} program
 */
function registerPipeline(program) {
  program
    .command('pipeline <input>')
    .description('End-to-end: chunk → embed → store in MongoDB Atlas')
    .option('--db <database>', 'Database name')
    .option('--collection <name>', 'Collection name')
    .option('--field <name>', 'Embedding field name')
    .option('--index <name>', 'Vector search index name')
    .option('-m, --model <model>', 'Embedding model')
    .option('-d, --dimensions <n>', 'Output dimensions', (v) => parseInt(v, 10))
    .option('-s, --strategy <strategy>', 'Chunking strategy')
    .option('-c, --chunk-size <n>', 'Target chunk size in characters', (v) => parseInt(v, 10))
    .option('--overlap <n>', 'Overlap between chunks', (v) => parseInt(v, 10))
    .option('--batch-size <n>', 'Texts per embedding API call', (v) => parseInt(v, 10), 25)
    .option('--text-field <name>', 'Text field for JSON/JSONL input', 'text')
    .option('--extensions <exts>', 'File extensions to include')
    .option('--ignore <dirs>', 'Directory names to skip', 'node_modules,.git,__pycache__')
    .option('--create-index', 'Auto-create vector search index if it doesn\'t exist')
    .option('--dry-run', 'Show what would happen without executing')
    .option('--estimate', 'Show estimated tokens and cost without executing')
    .option('--json', 'Machine-readable JSON output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(async (input, opts) => {
      let client;
      try {
        // Merge project config
        const { config: proj } = loadProject();
        const projChunk = proj.chunk || {};

        const db = opts.db || proj.db;
        const collection = opts.collection || proj.collection;
        const field = opts.field || proj.field || 'embedding';
        const index = opts.index || proj.index || 'vector_index';
        let model = opts.model || proj.model || getDefaultModel();
        const dimensions = opts.dimensions || proj.dimensions;
        const strategy = opts.strategy || projChunk.strategy || 'recursive';
        const chunkSize = opts.chunkSize || projChunk.size || 512;
        const overlap = opts.overlap != null ? opts.overlap : (projChunk.overlap != null ? projChunk.overlap : 50);
        const batchSize = opts.batchSize || 25;
        const textField = opts.textField || 'text';

        if (!db || !collection) {
          console.error(ui.error('Database and collection required. Use --db/--collection or "vai init".'));
          process.exit(1);
        }

        if (!STRATEGIES.includes(strategy)) {
          console.error(ui.error(`Unknown strategy: "${strategy}". Available: ${STRATEGIES.join(', ')}`));
          process.exit(1);
        }

        // Step 1: Resolve files
        const files = resolveFiles(input, opts);
        if (files.length === 0) {
          console.error(ui.error('No supported files found.'));
          process.exit(1);
        }

        const basePath = fs.statSync(path.resolve(input)).isDirectory()
          ? path.resolve(input)
          : process.cwd();

        const verbose = !opts.json && !opts.quiet;

        if (verbose) {
          console.log('');
          console.log(ui.bold('🚀 Pipeline: chunk → embed → store'));
          console.log(ui.dim(`  Files: ${files.length} | Strategy: ${strategy} | Model: ${model}`));
          console.log(ui.dim(`  Target: ${db}.${collection} (field: ${field})`));
          console.log('');
        }

        // Step 2: Chunk all files
        if (verbose) console.log(ui.bold('Step 1/3 — Chunking'));

        const allChunks = [];
        let totalInputChars = 0;
        const fileErrors = [];

        for (const filePath of files) {
          const relPath = path.relative(basePath, filePath);
          try {
            const content = await readFile(filePath, { textField });
            const texts = typeof content === 'string'
              ? [{ text: content, metadata: {} }]
              : content;

            for (const item of texts) {
              const useStrategy = (strategy === 'recursive' && filePath.endsWith('.md'))
                ? 'markdown' : strategy;

              const chunks = chunk(item.text, {
                strategy: useStrategy,
                size: chunkSize,
                overlap,
              });

              totalInputChars += item.text.length;

              for (let ci = 0; ci < chunks.length; ci++) {
                allChunks.push({
                  text: chunks[ci],
                  metadata: {
                    ...item.metadata,
                    source: relPath,
                    chunk_index: ci,
                    total_chunks: chunks.length,
                  },
                });
              }
            }

            if (verbose) console.log(`  ${ui.green('✓')} ${relPath} → ${allChunks.length} chunks total`);
          } catch (err) {
            fileErrors.push({ file: relPath, error: err.message });
            if (verbose) console.error(`  ${ui.red('✗')} ${relPath}: ${err.message}`);
          }
        }

        if (allChunks.length === 0) {
          console.error(ui.error('No chunks produced. Check your files and chunk settings.'));
          process.exit(1);
        }

        const totalTokens = allChunks.reduce((sum, c) => sum + estimateTokens(c.text), 0);

        if (verbose) {
          console.log(ui.dim(`  ${fmtNum(allChunks.length)} chunks, ~${fmtNum(totalTokens)} tokens`));
          console.log('');
        }

        // Dry run — stop here
        if (opts.dryRun) {
          const { estimateCost, formatCostEstimate } = require('../lib/cost');
          const est = estimateCost(totalTokens, model);
          if (opts.json) {
            console.log(JSON.stringify({
              dryRun: true,
              files: files.length,
              chunks: allChunks.length,
              estimatedTokens: totalTokens,
              estimatedCost: est.cost,
              pricePerMToken: est.pricePerMToken,
              strategy, chunkSize, overlap, model, db, collection, field,
            }, null, 2));
          } else {
            console.log(ui.success(`Dry run complete: ${fmtNum(allChunks.length)} chunks from ${files.length} files.`));
            console.log('');
            console.log(formatCostEstimate(est));
            console.log('');
          }
          return;
        }

        // Estimate — show comparison table, let user confirm or switch model, then continue
        if (opts.estimate) {
          const { confirmOrSwitchModel } = require('../lib/cost');
          const chosenModel = await confirmOrSwitchModel(totalTokens, model, { json: opts.json });
          if (!chosenModel) return; // cancelled
          model = chosenModel;
        }

        // Step 3: Embed in batches
        if (verbose) console.log(ui.bold('Step 2/3 — Embedding'));

        const batches = [];
        for (let i = 0; i < allChunks.length; i += batchSize) {
          batches.push(allChunks.slice(i, i + batchSize));
        }

        let embeddedCount = 0;
        let totalApiTokens = 0;
        const embeddings = new Array(allChunks.length);

        for (let bi = 0; bi < batches.length; bi++) {
          const batch = batches[bi];
          const texts = batch.map(c => c.text);

          if (verbose) {
            const pct = Math.round(((bi + 1) / batches.length) * 100);
            process.stderr.write(`\r  Batch ${bi + 1}/${batches.length} (${pct}%)...`);
          }

          const embedOpts = { model, inputType: 'document' };
          if (dimensions) embedOpts.dimensions = dimensions;

          const result = await generateEmbeddings(texts, embedOpts);
          totalApiTokens += result.usage?.total_tokens || 0;

          for (let j = 0; j < result.data.length; j++) {
            embeddings[embeddedCount + j] = result.data[j].embedding;
          }
          embeddedCount += batch.length;
        }

        if (verbose) {
          process.stderr.write('\r');
          console.log(`  ${ui.green('✓')} Embedded ${fmtNum(embeddedCount)} chunks (${fmtNum(totalApiTokens)} tokens)`);
          console.log('');
        }

        // Step 4: Store in MongoDB
        if (verbose) console.log(ui.bold('Step 3/3 — Storing in MongoDB'));

        const { client: c, collection: coll } = await getMongoCollection(db, collection);
        client = c;

        const documents = allChunks.map((chunk, i) => ({
          text: chunk.text,
          [field]: embeddings[i],
          metadata: chunk.metadata,
          _model: model,
          _embeddedAt: new Date(),
        }));

        const insertResult = await coll.insertMany(documents);

        if (verbose) {
          console.log(`  ${ui.green('✓')} Inserted ${fmtNum(insertResult.insertedCount)} documents`);
        }

        // Optional: create index
        if (opts.createIndex) {
          if (verbose) console.log('');
          try {
            const dim = embeddings[0]?.length || dimensions || 1024;
            const indexDef = {
              name: index,
              type: 'vectorSearch',
              definition: {
                fields: [{
                  type: 'vector',
                  path: field,
                  numDimensions: dim,
                  similarity: 'cosine',
                }],
              },
            };
            await coll.createSearchIndex(indexDef);
            if (verbose) console.log(`  ${ui.green('✓')} Created vector index "${index}" (${dim} dims, cosine)`);
          } catch (err) {
            if (err.message?.includes('already exists')) {
              if (verbose) console.log(`  ${ui.dim('ℹ Index "' + index + '" already exists — skipping')}`);
            } else {
              if (verbose) console.error(`  ${ui.yellow('⚠')} Index creation failed: ${err.message}`);
            }
          }
        }

        // Summary
        if (opts.json) {
          console.log(JSON.stringify({
            files: files.length,
            fileErrors: fileErrors.length,
            chunks: allChunks.length,
            tokens: totalApiTokens,
            inserted: insertResult.insertedCount,
            model, db, collection, field, strategy, chunkSize,
            index: opts.createIndex ? index : null,
          }, null, 2));
        } else if (verbose) {
          console.log('');
          console.log(ui.success('Pipeline complete'));
          console.log(ui.label('Files', `${fmtNum(files.length)}${fileErrors.length ? ` (${fileErrors.length} failed)` : ''}`));
          console.log(ui.label('Chunks', fmtNum(allChunks.length)));
          console.log(ui.label('Tokens', fmtNum(totalApiTokens)));
          console.log(ui.label('Stored', `${fmtNum(insertResult.insertedCount)} docs → ${db}.${collection}`));
          console.log('');
          console.log(ui.dim('  Next: vai query "your search" --db ' + db + ' --collection ' + collection));
        }
      } catch (err) {
        console.error(ui.error(err.message));
        process.exit(1);
      } finally {
        if (client) await client.close();
      }
    });
}

module.exports = { registerPipeline };
