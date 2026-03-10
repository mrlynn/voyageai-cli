'use strict';

const pc = require('picocolors');
const ui = require('../lib/ui');

let p;
function clack() { if (!p) p = require('@clack/prompts'); return p; }

function registerKb(program) {
  const kb = program
    .command('kb')
    .description('Manage the bundled knowledge base');

  // ── vai kb setup ──────────────────────────────────────────────────
  kb
    .command('setup')
    .description('Seed the bundled KB into MongoDB Atlas')
    .option('--db <database>', 'Database name')
    .option('--force', 'Re-seed even if already at current version')
    .option('--local', 'Use voyage-4-nano local embeddings (no API key needed)')
    .option('--json', 'Machine-readable output')
    .action(async (options) => {
      clack();
      const { seedKnowledgeBase } = require('../kb/seeder');

      // Nano prerequisite check
      if (options.local) {
        const { checkVenv, checkModel } = require('../nano/nano-health');
        const venv = checkVenv();
        const model = checkModel();
        if (!venv.ok || !model.ok) {
          if (options.json) {
            console.log(JSON.stringify({ error: 'voyage-4-nano not set up. Run vai nano setup first.' }));
          } else {
            p.intro(ui.bold('vai kb setup'));
            p.log.error('voyage-4-nano is not set up.');
            p.log.info('Run ' + pc.cyan('vai nano setup') + ' to install voyage-4-nano first.');
            p.outro('');
          }
          process.exitCode = 1;
          return;
        }
      }

      if (!options.json) {
        p.intro(ui.bold('vai kb setup'));
        if (options.local) {
          p.log.info('Using voyage-4-nano local embeddings (no API key needed)');
        }
      }

      // Check for MongoDB URI, prompt if missing
      const { loadConfig: loadGlobalConfig, saveConfig: saveGlobalConfig } = require('../lib/config');
      const mongoUri = process.env.MONGODB_URI || loadGlobalConfig().mongodbUri;
      if (!mongoUri) {
        if (options.json) {
          console.log(JSON.stringify({ error: 'MONGODB_URI not configured. Run vai init or set MONGODB_URI.' }));
          process.exitCode = 1;
          return;
        }
        p.log.warn('No MongoDB connection configured.');
        const uri = await p.text({
          message: 'Enter your MongoDB Atlas connection string:',
          placeholder: 'mongodb+srv://user:pass@cluster.mongodb.net/',
          validate: (v) => {
            if (!v || !v.trim()) return 'Connection string is required';
            if (!v.startsWith('mongodb://') && !v.startsWith('mongodb+srv://'))
              return 'Must start with mongodb:// or mongodb+srv://';
          },
        });
        if (p.isCancel(uri)) {
          p.log.info('Setup cancelled.');
          p.outro('');
          return;
        }
        const trimmed = uri.trim();
        process.env.MONGODB_URI = trimmed;
        const cfg = loadGlobalConfig();
        cfg.mongodbUri = trimmed;
        saveGlobalConfig(cfg);
        p.log.success('MongoDB URI saved to ~/.vai/config.json');
      }

      try {
        const result = await seedKnowledgeBase({
          db: options.db,
          force: options.force,
          local: options.local,
          json: options.json,
          onProgress: (stage, data) => {
            if (options.json) return;
            switch (stage) {
              case 'status':
                p.log.info(data.message);
                break;
              case 'skip':
                p.log.warn(data.message);
                p.outro('Nothing to do.');
                break;
              case 'manifest':
                p.log.success(`Corpus v${data.version}: ${data.docCount} documents (${data.source})`);
                break;
              case 'chunked':
                p.log.step(`${data.chunkCount} chunks from ${data.fileCount} documents`);
                break;
              case 'embed':
                if (data.done < data.total) {
                  process.stdout.write(`\r  Embedding... ${data.done}/${data.total} chunks`);
                } else {
                  process.stdout.write(`\r  Embedding... ${data.total}/${data.total} chunks\n`);
                }
                break;
              case 'store':
                p.log.step(`Inserting ${data.chunkCount} chunks into vai_kb...`);
                break;
              case 'index':
                if (data.status === 'creating') {
                  p.log.step('Creating vector search index...');
                } else if (data.status === 'QUERYABLE') {
                  p.log.success('Vector search index ready');
                } else if (data.status === 'timeout') {
                  p.log.warn('Index creation timed out. It may still be building in Atlas.');
                }
                break;
              case 'cancelled':
                p.log.info('Seeding cancelled.');
                p.outro('No API calls made.');
                break;
              case 'done':
                p.log.success(`KB seeded: ${data.chunkCount} chunks from ${data.fileCount} documents (v${data.version})`);
                p.outro(pc.green('Knowledge base ready.'));
                break;
            }
          },
        });

        if (options.json) {
          console.log(JSON.stringify(result));
        }
      } catch (err) {
        if (options.json) {
          console.log(JSON.stringify({ error: err.message }));
        } else {
          p.log.error(`Setup failed: ${err.message}`);
          if (err.stderr) {
            p.log.info(pc.dim(err.stderr.split('\n').slice(-3).join('\n')));
          }
          if (err.fix) {
            p.log.info(pc.cyan(err.fix));
          }
        }
        process.exitCode = 1;
      }
    });

  // ── vai kb status ─────────────────────────────────────────────────
  kb
    .command('status')
    .description('Show KB collection stats and version')
    .option('--db <database>', 'Database name')
    .option('--json', 'Machine-readable output')
    .action(async (options) => {
      clack();
      const { loadConfig } = require('../lib/config');
      const { getMongoCollection } = require('../lib/mongo');
      const { KB_COLLECTION } = require('../kb/seeder');

      const config = loadConfig();
      const kbConfig = config.kb;

      if (!kbConfig) {
        if (options.json) {
          console.log(JSON.stringify({ seeded: false }));
        } else {
          p.intro(ui.bold('vai kb status'));
          p.log.warn('Knowledge base not set up yet.');
          p.log.info('Run ' + pc.cyan('vai kb setup') + ' to seed the KB.');
          p.outro('');
        }
        return;
      }

      const dbName = options.db || config.defaultDb || 'vai';
      let client;

      try {
        const mongo = await getMongoCollection(dbName, KB_COLLECTION);
        client = mongo.client;
        const count = await mongo.collection.countDocuments();

        let indexStatus = 'unknown';
        try {
          const indexes = await mongo.collection.listSearchIndexes().toArray();
          const kbIdx = indexes.find(i => i.name === 'vai_kb_vector_index');
          indexStatus = kbIdx ? kbIdx.status : 'not found';
        } catch { indexStatus = 'unavailable'; }

        const result = {
          seeded: true,
          version: kbConfig.version,
          source: kbConfig.source,
          collection: KB_COLLECTION,
          chunkCount: count,
          embeddingModel: kbConfig.embeddingModel,
          seededAt: kbConfig.seededAt,
          indexStatus,
        };

        if (options.json) {
          console.log(JSON.stringify(result));
        } else {
          p.intro(ui.bold('vai kb status'));
          p.log.success(`Version:    ${kbConfig.version}`);
          p.log.info(`Source:     ${kbConfig.source}`);
          p.log.info(`Chunks:     ${count}`);
          p.log.info(`Model:      ${kbConfig.embeddingModel}`);
          p.log.info(`Index:      ${indexStatus}`);
          p.log.info(`Seeded at:  ${kbConfig.seededAt}`);
          p.outro('');
        }
      } catch (err) {
        if (options.json) {
          console.log(JSON.stringify({ error: err.message, config: kbConfig }));
        } else {
          p.intro(ui.bold('vai kb status'));
          p.log.warn(`Could not connect to MongoDB: ${err.message}`);
          p.log.info(`Last known config: v${kbConfig.version}, ${kbConfig.chunkCount} chunks`);
          p.outro('');
        }
      } finally {
        if (client) await client.close();
      }
    });

  // ── vai kb update ─────────────────────────────────────────────────
  kb
    .command('update')
    .description('Re-embed only documents whose checksums have changed')
    .option('--db <database>', 'Database name')
    .option('--json', 'Machine-readable output')
    .action(async (options) => {
      clack();
      const { seedKnowledgeBase, loadBundledManifest } = require('../kb/seeder');
      const { loadConfig } = require('../lib/config');

      const config = loadConfig();

      if (!config.kb) {
        if (options.json) {
          console.log(JSON.stringify({ error: 'KB not set up. Run vai kb setup first.' }));
        } else {
          p.intro(ui.bold('vai kb update'));
          p.log.warn('KB not set up yet. Run vai kb setup first.');
          p.outro('');
        }
        return;
      }

      const bundled = loadBundledManifest();
      if (config.kb.version === bundled.version) {
        if (options.json) {
          console.log(JSON.stringify({ upToDate: true, version: config.kb.version }));
        } else {
          p.intro(ui.bold('vai kb update'));
          p.log.success(`KB is up to date at version ${config.kb.version}`);
          p.outro('No update needed.');
        }
        return;
      }

      // Version mismatch: full re-seed with force
      if (!options.json) {
        p.intro(ui.bold('vai kb update'));
        p.log.info(`Updating from v${config.kb.version} to v${bundled.version}`);
      }

      try {
        const result = await seedKnowledgeBase({
          db: options.db,
          force: true,
          json: options.json,
          onProgress: (stage, data) => {
            if (options.json) return;
            switch (stage) {
              case 'manifest':
                p.log.success(`Corpus v${data.version}: ${data.docCount} documents`);
                break;
              case 'chunked':
                p.log.step(`${data.chunkCount} chunks ready`);
                break;
              case 'embed':
                if (data.done >= data.total) {
                  process.stdout.write(`\r  Embedding... ${data.total}/${data.total} chunks\n`);
                }
                break;
              case 'done':
                p.log.success(`Updated to v${data.version}: ${data.chunkCount} chunks`);
                p.outro('Knowledge base updated.');
                break;
              case 'cancelled':
                p.log.info('Update cancelled.');
                p.outro('');
                break;
            }
          },
        });
        if (options.json) console.log(JSON.stringify(result));
      } catch (err) {
        if (options.json) {
          console.log(JSON.stringify({ error: err.message }));
        } else {
          p.log.error(`Update failed: ${err.message}`);
        }
        process.exitCode = 1;
      }
    });

  // ── vai kb search ─────────────────────────────────────────────────
  kb
    .command('search <query>')
    .description('Search the knowledge base')
    .option('--db <database>', 'Database name')
    .option('-l, --limit <n>', 'Maximum results', (v) => parseInt(v, 10), 5)
    .option('--json', 'Machine-readable output')
    .action(async (query, options) => {
      clack();
      const { generateEmbeddings } = require('../lib/api');
      const { getMongoCollection } = require('../lib/mongo');
      const { loadConfig } = require('../lib/config');
      const { KB_COLLECTION, KB_INDEX_NAME } = require('../kb/seeder');

      const config = loadConfig();
      if (!config.kb) {
        if (options.json) {
          console.log(JSON.stringify({ error: 'KB not set up. Run vai kb setup first.' }));
        } else {
          p.intro(ui.bold('vai kb search'));
          p.log.warn('KB not set up yet. Run vai kb setup first.');
          p.outro('');
        }
        return;
      }

      const dbName = options.db || config.defaultDb || 'vai';
      const isNano = config.kb.embeddingModel === 'voyage-4-nano';
      let client;

      try {
        if (!options.json) p.intro(ui.bold('vai kb search'));

        let queryVector;
        if (isNano) {
          const { generateLocalEmbeddings } = require('../nano/nano-local');
          const embedResult = await generateLocalEmbeddings([query], {
            inputType: 'query',
            dimensions: 1024,
          });
          queryVector = embedResult.data[0].embedding;
        } else {
          const embedResult = await generateEmbeddings([query], {
            model: config.kb.embeddingModel || 'voyage-4-large',
            inputType: 'query',
          });
          queryVector = embedResult.data[0].embedding;
        }

        const mongo = await getMongoCollection(dbName, KB_COLLECTION);
        client = mongo.client;

        const results = await mongo.collection.aggregate([
          {
            $vectorSearch: {
              index: KB_INDEX_NAME,
              path: 'embedding',
              queryVector,
              numCandidates: options.limit * 15,
              limit: options.limit,
            },
          },
          {
            $project: {
              _id: 0,
              text: 1,
              source: 1,
              score: { $meta: 'vectorSearchScore' },
              metadata: 1,
            },
          },
        ]).toArray();

        if (options.json) {
          console.log(JSON.stringify({ query, results }));
        } else {
          if (results.length === 0) {
            p.log.warn('No results found.');
          } else {
            for (let i = 0; i < results.length; i++) {
              const r = results[i];
              const score = r.score.toFixed(4);
              const category = r.metadata?.category || '';
              console.log('');
              console.log(`  ${pc.bold(`${i + 1}.`)} ${pc.cyan(r.source)} ${pc.dim(`[${category}]`)} ${pc.dim(`score: ${score}`)}`);
              const preview = r.text.slice(0, 200).replace(/\n/g, ' ');
              console.log(`     ${pc.dim(preview)}${r.text.length > 200 ? '...' : ''}`);
            }
            console.log('');
          }
          p.outro(`${results.length} result${results.length === 1 ? '' : 's'}`);
        }
      } catch (err) {
        if (options.json) {
          console.log(JSON.stringify({ error: err.message }));
        } else {
          p.log.error(`Search failed: ${err.message}`);
        }
        process.exitCode = 1;
      } finally {
        if (client) await client.close();
      }
    });

  // ── vai kb reset ──────────────────────────────────────────────────
  kb
    .command('reset')
    .description('Drop and re-seed the KB collection')
    .option('--db <database>', 'Database name')
    .option('--local', 'Use voyage-4-nano local embeddings (no API key needed)')
    .option('--json', 'Machine-readable output')
    .option('--yes', 'Skip confirmation')
    .action(async (options) => {
      clack();
      const { seedKnowledgeBase } = require('../kb/seeder');

      if (!options.json) {
        p.intro(ui.bold('vai kb reset'));
      }

      // Confirm unless --yes
      if (!options.yes && !options.json) {
        const confirmed = await p.confirm({
          message: 'This will drop the vai_kb collection and re-seed from scratch. Continue?',
          initialValue: false,
        });
        if (p.isCancel(confirmed) || !confirmed) {
          p.log.info('Reset cancelled.');
          p.outro('');
          return;
        }
      }

      try {
        const result = await seedKnowledgeBase({
          db: options.db,
          force: true,
          local: options.local,
          json: options.json,
          onProgress: (stage, data) => {
            if (options.json) return;
            switch (stage) {
              case 'manifest':
                p.log.info(`Corpus v${data.version}: ${data.docCount} documents`);
                break;
              case 'chunked':
                p.log.step(`${data.chunkCount} chunks ready`);
                break;
              case 'embed':
                if (data.done >= data.total) {
                  process.stdout.write(`\r  Embedding... ${data.total}/${data.total} chunks\n`);
                }
                break;
              case 'done':
                p.log.success(`KB reset: ${data.chunkCount} chunks (v${data.version})`);
                p.outro(pc.green('Knowledge base re-seeded.'));
                break;
              case 'cancelled':
                p.log.info('Reset cancelled.');
                p.outro('');
                break;
            }
          },
        });
        if (options.json) console.log(JSON.stringify(result));
      } catch (err) {
        if (options.json) {
          console.log(JSON.stringify({ error: err.message }));
        } else {
          p.log.error(`Reset failed: ${err.message}`);
        }
        process.exitCode = 1;
      }
    });
}

module.exports = { registerKb };
