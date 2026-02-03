'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const readline = require('readline');
const pc = require('picocolors');

const CLI_PATH = path.join(__dirname, '..', 'cli.js');

/**
 * Wait for the user to press Enter.
 * Resolves immediately if noPause is true.
 * @param {boolean} noPause
 * @returns {Promise<void>}
 */
function waitForEnter(noPause) {
  if (noPause) return Promise.resolve();
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(pc.dim('  Press Enter to continue...'), () => {
      rl.close();
      resolve();
    });
  });
}

/**
 * Print a command that's about to be run.
 * @param {string} cmd
 */
function showCommand(cmd) {
  console.log(`\n  ${pc.bold(pc.cyan('$ ' + cmd))}\n`);
}

/**
 * Run a vai sub-command as a child process with inherited stdio.
 * @param {string[]} args
 * @returns {{ status: number }}
 */
function runVai(args) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    stdio: 'inherit',
    env: process.env,
  });
}

/**
 * Print a step header.
 * @param {number} num
 * @param {string} title
 */
function stepHeader(num, title) {
  const label = `── Step ${num}: ${title} `;
  const pad = Math.max(0, 60 - label.length);
  console.log(`\n${pc.bold(label)}${'─'.repeat(pad)}`);
}

/**
 * Run a vai command, show it, and return whether it succeeded.
 * @param {string} display  - the display string (e.g. 'vai embed "hello"')
 * @param {string[]} args   - args to pass to vai
 * @returns {boolean} success
 */
function runStep(display, args) {
  showCommand(display);
  const result = runVai(args);
  return result.status === 0;
}

/**
 * Ask user whether to continue after a failure.
 * @param {boolean} noPause
 * @returns {Promise<boolean>} true = continue, false = abort
 */
function askContinue(noPause) {
  if (noPause) return Promise.resolve(true);
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(pc.yellow('  Step failed. Continue anyway? (Y/n) '), (answer) => {
      rl.close();
      const a = answer.trim().toLowerCase();
      resolve(a === '' || a === 'y' || a === 'yes');
    });
  });
}

/**
 * Sleep for ms milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Register the demo command on a Commander program.
 * @param {import('commander').Command} program
 */
function registerDemo(program) {
  program
    .command('demo')
    .description('Interactive guided walkthrough of Voyage AI features')
    .option('--no-pause', 'Skip Enter prompts (for CI/recording)')
    .option('--skip-pipeline', 'Skip the full pipeline step (Step 5)')
    .option('--keep', 'Keep the demo collection after pipeline step')
    .action(async (opts) => {
      const noPause = !opts.pause;

      // ── Preflight: check API key ──
      const apiKey = process.env.VOYAGE_API_KEY;
      if (!apiKey) {
        const { getConfigValue } = require('../lib/config');
        const configKey = getConfigValue('apiKey');
        if (!configKey) {
          console.error('');
          console.error(pc.red('  ✗ VOYAGE_API_KEY is not set.'));
          console.error('');
          console.error('  Set it with:');
          console.error(`    ${pc.cyan('export VOYAGE_API_KEY="your-key"')}`);
          console.error('  Or:');
          console.error(`    ${pc.cyan('vai config set api-key "your-key"')}`);
          console.error('');
          process.exit(1);
        }
      }

      // ── Banner ──
      console.log('');
      console.log(pc.bold('  🧭 Voyage AI Interactive Demo'));
      console.log(pc.dim('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
      console.log('');
      console.log(pc.dim('  Note: This is a community tool, not an official MongoDB or Voyage AI product.'));
      console.log(pc.dim('  For official docs and support: https://www.mongodb.com/docs/voyageai/'));
      console.log('');
      console.log('  This walkthrough demonstrates embeddings, semantic search, and reranking');
      console.log('  using Voyage AI models via MongoDB Atlas.');
      console.log('');

      await waitForEnter(noPause);

      // ── Step 1: Ping ──
      stepHeader(1, 'Check Connection');
      console.log('  First, let\'s verify your API key works.');

      let ok = runStep('vai ping', ['ping']);
      if (!ok) {
        const cont = await askContinue(noPause);
        if (!cont) process.exit(1);
      }

      await waitForEnter(noPause);

      // ── Step 2: Embeddings ──
      stepHeader(2, 'Generate Embeddings');
      console.log('  Embeddings convert text into numerical vectors that capture meaning.');
      console.log('  Let\'s embed a sentence:');

      ok = runStep('vai embed "MongoDB is the most popular document database"',
        ['embed', 'MongoDB is the most popular document database']);
      if (!ok) {
        const cont = await askContinue(noPause);
        if (!cont) process.exit(1);
      }

      console.log('\n  Let\'s try another:');

      ok = runStep('vai embed "I love using NoSQL databases for modern applications"',
        ['embed', 'I love using NoSQL databases for modern applications']);
      if (!ok) {
        const cont = await askContinue(noPause);
        if (!cont) process.exit(1);
      }

      console.log('');
      console.log('  These two sentences are about related topics — their vectors will be');
      console.log('  close together in embedding space, even though they share few words.');

      await waitForEnter(noPause);

      // ── Step 3: Compare Similarity ──
      stepHeader(3, 'Compare Similarity');
      console.log('  Let\'s embed a set of diverse documents and see how the model');
      console.log('  distinguishes meaning:');

      runStep('vai embed "MongoDB Atlas is a cloud database" --quiet',
        ['embed', 'MongoDB Atlas is a cloud database', '--quiet']);
      runStep('vai embed "The weather in Paris is lovely" --quiet',
        ['embed', 'The weather in Paris is lovely', '--quiet']);
      runStep('vai embed "Vector search enables AI applications" --quiet',
        ['embed', 'Vector search enables AI applications', '--quiet']);

      console.log('');
      console.log('  Notice how the model captures semantic relationships — database topics');
      console.log('  cluster together, while unrelated topics are far apart.');

      await waitForEnter(noPause);

      // ── Step 4: Reranking ──
      stepHeader(4, 'Reranking');
      console.log('  Reranking scores how relevant each document is to a specific query.');
      console.log('  This is the "precision" stage of two-stage retrieval.');

      ok = runStep(
        'vai rerank --query "How do I build AI search?" --documents ...',
        [
          'rerank',
          '--query', 'How do I build AI search?',
          '--documents',
          'MongoDB Atlas provides vector search capabilities',
          'The recipe calls for two cups of flour',
          'Voyage AI embeddings power semantic retrieval',
          'Python is a popular programming language',
          'Atlas Search combines full-text and vector search',
        ]
      );
      if (!ok) {
        const cont = await askContinue(noPause);
        if (!cont) process.exit(1);
      }

      console.log('');
      console.log('  Notice how the reranker assigns HIGH scores to relevant documents');
      console.log('  and LOW scores to irrelevant ones — much more decisive than');
      console.log('  embedding similarity alone.');

      await waitForEnter(noPause);

      // ── Step 5: Full Pipeline (optional) ──
      const { getConfigValue } = require('../lib/config');
      const mongoUri = process.env.MONGODB_URI || getConfigValue('mongodbUri');
      const skipPipeline = opts.skipPipeline || !mongoUri;

      if (skipPipeline && !opts.skipPipeline) {
        stepHeader(5, 'Full Pipeline (skipped)');
        console.log(pc.dim('  Skipping pipeline demo — set MONGODB_URI to try the full flow.'));
        console.log(pc.dim('  See: vai config set mongodb-uri "mongodb+srv://..."'));
        console.log('');
      } else if (!skipPipeline) {
        stepHeader(5, 'Full Pipeline');
        console.log('  Now let\'s put it all together: embed → store → index → search → rerank.');
        console.log('');

        const db = 'test';
        const collection = 'demo_voyage_test';
        const field = 'embedding';

        const documents = [
          'MongoDB Atlas is a fully managed cloud database',
          'Voyage AI provides state of the art embedding models',
          'Vector search enables semantic retrieval for AI applications',
          'Atlas Search combines full-text and vector search capabilities',
          'The recipe calls for two cups of flour and three eggs',
        ];

        console.log(pc.dim(`  Creating test collection: ${collection}...`));
        console.log('');

        let pipelineOk = true;
        for (const text of documents) {
          const short = text.length > 50 ? text.slice(0, 47) + '...' : text;
          ok = runStep(
            `vai store --db ${db} --collection ${collection} --field ${field} --text "${short}"`,
            ['store', '--db', db, '--collection', collection, '--field', field, '--text', text]
          );
          if (!ok) {
            pipelineOk = false;
            const cont = await askContinue(noPause);
            if (!cont) break;
          }
        }

        if (pipelineOk) {
          // Create index
          ok = runStep(
            `vai index create --db ${db} --collection ${collection} --field ${field} --dimensions 1024`,
            ['index', 'create', '--db', db, '--collection', collection, '--field', field, '--dimensions', '1024']
          );

          if (ok) {
            // Wait for index to be ready
            console.log('');
            console.log(pc.dim('  Waiting for index to build...'));

            const { getConnection } = require('../lib/mongo');
            let indexReady = false;
            const deadline = Date.now() + 120000;

            try {
              const client = await getConnection();
              const coll = client.db(db).collection(collection);

              while (Date.now() < deadline) {
                const indexes = await coll.listSearchIndexes().toArray();
                const idx = indexes.find(i => i.name && i.status);
                if (idx && idx.status === 'READY') {
                  indexReady = true;
                  console.log(pc.green('  ✓ Index is READY'));
                  break;
                }
                const statusStr = idx ? idx.status : 'PENDING';
                process.stdout.write(pc.dim(`\r  Index status: ${statusStr}...`));
                await sleep(5000);
              }

              if (!indexReady) {
                console.log(pc.yellow('\n  ⚠ Index build timed out (120s). Trying search anyway...'));
              }
            } catch (err) {
              console.log(pc.yellow(`\n  ⚠ Could not check index status: ${err.message}`));
            }

            console.log('');

            // Search
            ok = runStep(
              `vai search --query "cloud database for AI apps" --db ${db} --collection ${collection} --field ${field}`,
              ['search', '--query', 'cloud database for AI apps', '--db', db, '--collection', collection, '--field', field]
            );
          }
        }

        // Cleanup
        if (!opts.keep) {
          console.log('');
          console.log(pc.dim(`  Cleaning up: dropping ${collection}...`));
          try {
            const { getConnection } = require('../lib/mongo');
            const client = await getConnection();
            await client.db(db).collection(collection).drop();
            console.log(pc.dim('  ✓ Collection dropped.'));
          } catch (err) {
            console.log(pc.dim(`  ⚠ Cleanup note: ${err.message}`));
          }
        } else {
          console.log(pc.dim(`  Collection ${collection} kept (--keep flag).`));
        }
      }

      // ── Done ──
      console.log('');
      console.log('─'.repeat(60));
      console.log(pc.bold('  🧭 That\'s Voyage AI in action!'));
      console.log('');
      console.log('  Next steps:');
      console.log(`    • Read the docs: ${pc.cyan('https://www.mongodb.com/docs/voyageai/')}`);
      console.log(`    • Explore models: ${pc.cyan('vai models')}`);
      console.log(`    • Configure: ${pc.cyan('vai config set api-key <your-key>')}`);
      console.log(`    • Full pipeline: ${pc.cyan('vai store → vai index create → vai search')}`);
      console.log('');
      console.log('  Happy searching! 🚀');
      console.log('');
    });
}

module.exports = { registerDemo };
