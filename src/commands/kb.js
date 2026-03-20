'use strict';

const path = require('path');
const ui = require('../lib/ui');
const { loadConfig } = require('../lib/config');
const { getMongoCollection } = require('../lib/mongo');
const { getDefaultDimensions } = require('../lib/catalog');
const {
  resolveKbManifest,
  buildKbChunkPlan,
  confirmKbSeedEmbeddingCost,
  runKbSeed,
  runKbIncrementalUpdate,
  formatCostEstimate,
  DEFAULT_DB,
  DEFAULT_COLLECTION,
  DEFAULT_FIELD,
  DEFAULT_INDEX_NAME,
  KB_MARKER_FIELD,
  KB_BUNDLE_MARKER,
} = require('../lib/kb');
const { kbSearchQuery } = require('../lib/kb/retrieval');

const CORPUS_ROOT = path.join(__dirname, '..', 'kb', 'corpus');

/**
 * @param {object} opts
 * @returns {{ db: string, collection: string, field: string, indexName: string, embeddingModel?: string }}
 */
function resolveKbTarget(opts) {
  const cfg = loadConfig();
  const kb = cfg.kb || {};
  return {
    db: opts.db || kb.db || DEFAULT_DB,
    collection: opts.collection || kb.collection || DEFAULT_COLLECTION,
    field: opts.field || kb.field || DEFAULT_FIELD,
    indexName: opts.index || kb.indexName || DEFAULT_INDEX_NAME,
    embeddingModel: opts.model || kb.embeddingModel,
  };
}

/**
 * @param {import('commander').Command} program
 */
function registerKb(program) {
  const kbCmd = program
    .command('kb')
    .description(
      'Bundled documentation KB in MongoDB Atlas (embeddings use Voyage API unless you add local paths later). ' +
        'Full chat still needs Atlas + an LLM; this seeds retrieval only.'
    );

  kbCmd
    .command('setup')
    .description('Chunk, estimate cost, embed, and store the bundled KB into Atlas (collection vai_kb by default)')
    .option('--db <name>', 'MongoDB database name')
    .option('--collection <name>', 'Collection name', DEFAULT_COLLECTION)
    .option('--field <name>', 'Embedding field name', DEFAULT_FIELD)
    .option('-n, --index <name>', 'Vector search index name', DEFAULT_INDEX_NAME)
    .option('-m, --model <model>', 'Override embedding model (default: manifest embeddingModel)')
    .option('--dry-run', 'Print token/cost estimate only (no API calls)')
    .option('-y, --yes', 'Skip interactive cost confirmation')
    .option('--use-bundled', 'Use only the bundled manifest (skip remote fetch)')
    .option('--json', 'Machine-readable output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(async (opts) => {
      try {
        await runKbSetup(opts);
      } catch (err) {
        if (opts.json) {
          console.log(JSON.stringify({ error: err.message, code: err.code || null }));
        } else {
          console.error(ui.error(err.message));
        }
        process.exit(1);
      }
    });

  kbCmd
    .command('status')
    .description('Show KB corpus version, chunk counts, and vector index status')
    .option('--db <name>', 'MongoDB database name')
    .option('--collection <name>', 'Collection name')
    .option('--json', 'Machine-readable output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(async (opts) => {
      try {
        await runKbStatus(opts);
      } catch (err) {
        if (opts.json) {
          console.log(JSON.stringify({ error: err.message }));
        } else {
          console.error(ui.error(err.message));
        }
        process.exit(1);
      }
    });

  kbCmd
    .command('reset')
    .description('Remove all bundled KB documents from the collection and re-run setup')
    .option('--db <name>', 'MongoDB database name')
    .option('--collection <name>', 'Collection name')
    .option('-y, --yes', 'Skip confirmation prompt')
    .option('--json', 'Machine-readable output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(async (opts) => {
      try {
        await runKbReset(opts);
      } catch (err) {
        if (opts.json) {
          console.log(JSON.stringify({ error: err.message }));
        } else {
          console.error(ui.error(err.message));
        }
        process.exit(1);
      }
    });

  kbCmd
    .command('update')
    .description('Incremental update: re-embed only manifest documents whose checksums changed')
    .option('--db <name>', 'MongoDB database name')
    .option('--collection <name>', 'Collection name')
    .option('-n, --index <name>', 'Vector search index name')
    .option('-m, --model <model>', 'Override embedding model')
    .option('--use-bundled', 'Use only the bundled manifest')
    .option('-y, --yes', 'Skip interactive cost confirmation')
    .option('--json', 'Machine-readable output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(async (opts) => {
      try {
        await runKbUpdate(opts);
      } catch (err) {
        if (opts.json) {
          console.log(JSON.stringify({ error: err.message, code: err.code || null }));
        } else {
          console.error(ui.error(err.message));
        }
        process.exit(1);
      }
    });

  kbCmd
    .command('search <query>')
    .description('Vector search over the seeded KB collection')
    .option('--db <name>', 'MongoDB database name')
    .option('--collection <name>', 'Collection name')
    .option('-n, --index <name>', 'Vector search index name')
    .option('-m, --model <model>', 'Override embedding model')
    .option('-l, --limit <n>', 'Max results', (v) => parseInt(v, 10), 10)
    .option('--rerank', 'Run Voyage rerank on candidates (extra API cost)')
    .option('--json', 'Machine-readable output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(async (query, opts) => {
      try {
        await runKbSearch(query, opts);
      } catch (err) {
        if (opts.json) {
          console.log(JSON.stringify({ error: err.message }));
        } else {
          console.error(ui.error(err.message));
        }
        process.exit(1);
      }
    });
}

async function runKbSetup(opts) {
  const target = resolveKbTarget(opts);
  const modelPref = opts.model || null;

  const { manifest, source } = await resolveKbManifest({
    skipRemote: !!opts.useBundled,
  });

  const { chunks, totalTokens } = buildKbChunkPlan({ manifest, corpusRoot: CORPUS_ROOT });
  const model = modelPref || manifest.embeddingModel;

  if (opts.dryRun) {
    const gate = await confirmKbSeedEmbeddingCost({
      totalTokens,
      model,
      dryRun: true,
    });
    if (opts.json) {
      console.log(
        JSON.stringify(
          {
            dryRun: true,
            manifestVersion: manifest.version,
            corpusSource: source,
            chunks: chunks.length,
            estimatedTokens: totalTokens,
            model,
            estimate: gate.estimate,
          },
          null,
          2
        )
      );
    } else if (!opts.quiet) {
      console.log(ui.dim(`Manifest: ${manifest.version} (${source})`));
      console.log(ui.dim(`Chunks: ${chunks.length}  ~tokens: ${totalTokens}`));
      console.log('');
      console.log(formatCostEstimate(gate.estimate));
    }
    return;
  }

  const gate = await confirmKbSeedEmbeddingCost({
    totalTokens,
    model,
    dryRun: false,
    yes: !!opts.yes,
    json: !!opts.json,
  });

  if (!gate.ok) {
    process.exit(1);
  }

  const chosenModel = gate.model;
  const dims = getDefaultDimensions();

  if (!opts.json && !opts.quiet) {
    console.log('');
    console.log(ui.bold('Embedding and storing KB…'));
  }

  const result = await runKbSeed({
    chunks,
    manifest,
    corpusSource: source,
    model: chosenModel,
    db: target.db,
    collection: target.collection,
    field: target.field,
    indexName: target.indexName,
    dimensions: dims,
    createIndex: true,
  });

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          manifestVersion: manifest.version,
          corpusSource: source,
          inserted: result.insertedCount,
          tokens: result.totalApiTokens,
          indexCreated: result.indexCreated,
          numDimensions: result.numDimensions,
          db: target.db,
          collection: target.collection,
          index: target.indexName,
        },
        null,
        2
      )
    );
  } else if (!opts.quiet) {
    console.log(ui.success(`Seeded ${result.insertedCount} chunks → ${target.db}.${target.collection}`));
    if (result.indexCreated) {
      console.log(ui.dim('Vector index created (may take a minute to become queryable).'));
    }
  }
}

async function runKbStatus(opts) {
  const target = resolveKbTarget(opts);
  const cfg = loadConfig();
  const kb = cfg.kb || {};

  let client;
  const { client: c, collection: coll } = await getMongoCollection(target.db, target.collection);
  client = c;

  try {
    const tagged = await coll.countDocuments({ [KB_MARKER_FIELD]: KB_BUNDLE_MARKER });
    const indexes = await coll.listSearchIndexes().toArray();
    const idx = indexes.find((i) => i.name === target.indexName);

    const payload = {
      corpusVersion: kb.corpusVersion || null,
      corpusSource: kb.corpusSource || null,
      chunkCountConfig: kb.chunkCount,
      chunkCountCollection: tagged,
      embeddingModel: kb.embeddingModel || null,
      db: target.db,
      collection: target.collection,
      indexName: target.indexName,
      indexStatus: idx ? idx.status : 'missing',
      indexQueryable: idx && idx.status === 'READY',
    };

    if (opts.json) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }

    if (!opts.quiet) {
      console.log(ui.bold('KB status'));
      console.log(ui.label('Corpus version', payload.corpusVersion || '(unknown)'));
      console.log(ui.label('Corpus source', payload.corpusSource || '(unknown)'));
      console.log(ui.label('Chunks (config)', String(payload.chunkCountConfig ?? '—')));
      console.log(ui.label('Chunks (tagged in DB)', String(tagged)));
      console.log(ui.label('Embedding model', payload.embeddingModel || '—'));
      console.log(ui.label('Target', `${target.db}.${target.collection}`));
      console.log(ui.label('Vector index', target.indexName));
      console.log(ui.label('Index status', idx ? ui.status(idx.status) : ui.yellow('not found')));
    }
  } finally {
    if (client) await client.close();
  }
}

async function runKbReset(opts) {
  const target = resolveKbTarget(opts);

  if (!opts.yes) {
    const p = require('@clack/prompts');
    const ok = await p.confirm({
      message: `Delete all bundled KB documents in ${target.db}.${target.collection} and re-seed?`,
      initialValue: false,
    });
    if (p.isCancel(ok) || !ok) {
      console.log(ui.dim('Cancelled.'));
      process.exit(0);
    }
  }

  let client;
  const { client: c, collection: coll } = await getMongoCollection(target.db, target.collection);
  client = c;
  try {
    await coll.deleteMany({ [KB_MARKER_FIELD]: KB_BUNDLE_MARKER });
  } finally {
    if (client) await client.close();
  }

  if (!opts.json && !opts.quiet) {
    console.log(ui.dim('Cleared bundled KB documents. Re-seeding…'));
  }

  await runKbSetup({ ...opts, yes: true, dryRun: false });
}

async function runKbUpdate(opts) {
  const cfg = loadConfig();
  const kb = cfg.kb || {};
  if (!kb.documentChecksums || !kb.embeddingModel) {
    throw new Error('No KB snapshot in config. Run `vai kb setup` first.');
  }

  const target = resolveKbTarget(opts);
  const { manifest, source } = await resolveKbManifest({
    skipRemote: !!opts.useBundled,
  });

  const oldMap = kb.documentChecksums;
  const changed = [];
  const removed = [];

  for (const doc of manifest.documents) {
    if (!oldMap[doc.id] || oldMap[doc.id] !== doc.checksum) {
      changed.push(doc.id);
    }
  }
  for (const id of Object.keys(oldMap)) {
    if (!manifest.documents.find((d) => d.id === id)) {
      removed.push(id);
    }
  }

  if (changed.length === 0 && removed.length === 0) {
    if (opts.json) {
      console.log(JSON.stringify({ ok: true, message: 'Already up to date' }));
    } else {
      console.log(ui.success('KB is already up to date.'));
    }
    return;
  }

  const { totalTokens } = buildKbChunkPlan({
    manifest,
    corpusRoot: CORPUS_ROOT,
    documentIds: new Set(changed),
  });

  const model = opts.model || manifest.embeddingModel;

  let chosenModel = model;
  if (changed.length > 0) {
    const gate = await confirmKbSeedEmbeddingCost({
      totalTokens,
      model,
      dryRun: false,
      yes: !!opts.yes,
      json: !!opts.json,
    });
    if (!gate.ok) process.exit(1);
    chosenModel = gate.model;
  }

  const result = await runKbIncrementalUpdate({
    changedDocumentIds: changed,
    removedDocumentIds: removed,
    manifest,
    corpusRoot: CORPUS_ROOT,
    corpusSource: source,
    model: chosenModel,
    db: target.db,
    collection: target.collection,
    field: target.field,
    indexName: target.indexName,
    dimensions: getDefaultDimensions(),
  });

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          corpusSource: source,
          changed: result.changedCount,
          removed: result.removedCount,
          inserted: result.insertedCount,
          tokens: result.totalApiTokens,
          chunkCount: result.chunkCount,
        },
        null,
        2
      )
    );
  } else if (!opts.quiet) {
    console.log(
      ui.success(
        `Updated: removed ${result.removedCount} doc(s), re-embedded ${result.changedCount} doc(s), ` +
          `+${result.insertedCount} chunks. Total tagged chunks: ${result.chunkCount}.`
      )
    );
  }
}

async function runKbSearch(query, opts) {
  const target = resolveKbTarget(opts);
  if (!target.embeddingModel) {
    throw new Error('No embedding model in config. Run `vai kb setup` first (or pass -m).');
  }

  const { results, tokens, retrievalTimeMs } = await kbSearchQuery(
    query,
    {
      db: target.db,
      collection: target.collection,
      indexName: target.indexName,
      field: target.field,
      embeddingModel: target.embeddingModel,
    },
    {
      limit: opts.limit || 10,
      rerank: !!opts.rerank,
      dimensions: getDefaultDimensions(),
    }
  );

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          query,
          results,
          tokens,
          retrievalTimeMs,
        },
        null,
        2
      )
    );
    return;
  }

  if (!opts.quiet) {
    console.log(ui.dim(`(${results.length} results, ${retrievalTimeMs}ms)`));
    console.log('');
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      console.log(ui.bold(`${i + 1}. `) + ui.cyan(String(r.score).slice(0, 8)) + `  ${r.kbDocumentId || '—'}  ${ui.dim(r.path || '')}`);
      console.log(ui.dim(r.textPreview.replace(/\s+/g, ' ').slice(0, 200)));
      console.log('');
    }
  }
}

module.exports = { registerKb };
