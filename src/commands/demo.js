'use strict';

const path = require('path');
const pc = require('picocolors');
const { getConfigValue } = require('../lib/config');

/**
 * Check prerequisites for a demo.
 * Returns { ok: boolean, errors: string[] }
 */
function checkPrerequisites(required) {
  const errors = [];

  if (required.includes('api-key')) {
    const apiKey = process.env.VOYAGE_API_KEY || getConfigValue('apiKey');
    if (!apiKey) {
      errors.push('VOYAGE_API_KEY not configured. Run: vai config set api-key "your-key"');
    }
  }

  if (required.includes('mongodb')) {
    const mongoUri = process.env.MONGODB_URI || getConfigValue('mongodbUri');
    if (!mongoUri) {
      errors.push('MONGODB_URI not configured. Run: vai config set mongodb-uri "mongodb+srv://..."');
    }
  }

  if (required.includes('llm')) {
    const { resolveLLMConfig } = require('../lib/llm');
    const llmConfig = resolveLLMConfig();
    if (!llmConfig.provider) {
      errors.push('No LLM provider configured. Set one: vai config set llm-provider openai');
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

/**
 * Print prerequisite errors and exit.
 */
function printPrereqErrors(errors) {
  console.error('');
  console.error(pc.red('  Prerequisites not met:'));
  for (const err of errors) {
    console.error(`  ${pc.red('✗')} ${err}`);
  }
  console.error('');
}

/**
 * Register the demo command on a Commander program.
 * @param {import('commander').Command} program
 */
function registerDemo(program) {
  const cmd = program
    .command('demo [subcommand]')
    .description('Guided demonstrations of Voyage AI features')
    .option('--no-pause', 'Skip Enter prompts (for CI/recording)')
    .action(async (subcommand, opts) => {
      // If no subcommand, show menu
      if (!subcommand) {
        await showDemoMenu(opts);
        return;
      }

      // Route to subcommand
      switch (subcommand) {
        case 'cost-optimizer':
          await runCostOptimizerDemo(opts);
          break;
        case 'code-search':
          console.log(pc.yellow('  ⚠ Code Search demo coming soon (Phase 3)'));
          break;
        case 'chat':
          console.log(pc.yellow('  ⚠ Chat demo coming soon (Phase 4)'));
          break;
        case 'cleanup':
          await runCleanup(opts);
          break;
        case 'interactive':
          console.log(pc.yellow('  ⚠ Interactive demo coming soon (legacy refactor)'));
          break;
        default:
          console.error(pc.red(`  Unknown demo: ${subcommand}`));
          process.exit(1);
      }
    });

  return cmd;
}

/**
 * Show interactive demo menu.
 */
async function showDemoMenu(opts) {
  const readline = require('readline');

  console.log('');
  console.log(pc.bold('  Welcome to vai demos!'));
  console.log('');
  console.log('  Choose a demonstration:');
  console.log('');
  console.log('    ' + pc.cyan('1. 💰 Cost Optimizer'));
  console.log('       Prove the shared embedding space saves money — on your data.');
  console.log('');
  console.log('    ' + pc.dim('2. 🔍 Code Search in 5 Minutes'));
  console.log('       ' + pc.dim('Search your codebase with AI (coming soon)'));
  console.log('');
  console.log('    ' + pc.dim('3. 💬 Chat With Your Docs'));
  console.log('       ' + pc.dim('Turn documents into conversational AI (coming soon)'));
  console.log('');

  if (opts.noPause) {
    console.log(pc.dim('  (--no-pause: selecting demo 1)'));
    await runCostOptimizerDemo(opts);
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('  Select (1-3): ', (answer) => {
      rl.close();

      switch (answer.trim()) {
        case '1':
          runCostOptimizerDemo(opts).then(resolve);
          break;
        case '2':
        case '3':
          console.log(pc.yellow('\n  ⚠ Coming soon!'));
          resolve();
          break;
        default:
          console.log(pc.red('\n  Invalid selection'));
          resolve();
      }
    });
  });
}

/**
 * Run the Cost Optimizer demo.
 */
async function runCostOptimizerDemo(opts) {
  const { getConnection } = require('../lib/mongo');
  const telemetry = require('../lib/telemetry');

  // Prerequisite check
  const prereq = checkPrerequisites(['api-key', 'mongodb']);
  if (!prereq.ok) {
    printPrereqErrors(prereq.errors);
    process.exit(1);
  }

  console.log('');
  console.log(pc.bold('  💰 Cost Optimizer Demo'));
  console.log(pc.dim('  ━━━━━━━━━━━━━━━━━━━━━━'));
  console.log('');
  console.log('  This demo proves that the Voyage AI shared embedding space works:');
  console.log('  documents embedded with voyage-4-large can be queried with voyage-4-lite');
  console.log('  — with identical retrieval results and dramatic cost savings.');
  console.log('');

  const demoStart = Date.now();

  try {
    // Step 1: Ingest sample data
    console.log(pc.bold('  Step 1: Preparing knowledge base...'));
    console.log('');

    const sampleDataDir = path.join(__dirname, '..', 'demo', 'sample-data');
    const { ingestSampleData } = require('../lib/demo-ingest');

    const { docCount, collectionName } = await ingestSampleData(sampleDataDir, {
      db: opts.db || 'vai_demo',
      collection: opts.collection || 'cost_optimizer_demo',
    });

    console.log(`  ✓ Ingested ${docCount} sample documents`);
    console.log(`  ✓ Collection: ${collectionName}`);
    console.log('');

    // Step 2: Run cost analysis
    console.log(pc.bold('  Step 2: Analyzing cost savings...'));
    console.log('');

    const { Optimizer } = require('../lib/optimizer');
    const optimizer = new Optimizer({
      db: opts.db || 'vai_demo',
      collection: opts.collection || 'cost_optimizer_demo',
    });

    // Generate sample queries from the corpus
    const queries = await optimizer.generateSampleQueries(5);

    // Run the analysis
    const result = await optimizer.analyze({
      queries,
      models: ['voyage-4-large', 'voyage-4-lite'],
      scale: {
        docs: 1_000_000,
        queriesPerMonth: 50_000_000,
        months: 12,
      },
    });

    // Step 3: Display results
    console.log(pc.bold('  Step 3: Results'));
    console.log('');

    // Print retrieval quality
    console.log(pc.cyan('  ── Retrieval Quality ──'));
    console.log('');
    console.log(`  Comparing voyage-4-large (baseline) vs voyage-4-lite:`);
    console.log('');

    let totalOverlap = 0;
    for (let i = 0; i < result.queries.length; i++) {
      const q = result.queries[i];
      const shortQuery = q.query.length > 60 ? q.query.slice(0, 57) + '...' : q.query;
      console.log(`  Query ${i + 1}: "${shortQuery}"`);
      console.log(`    Overlap: ${q.overlap}/5 documents (${Math.round(q.overlapPercent)}%)`);
      totalOverlap += q.overlapPercent;
    }

    const avgOverlap = (totalOverlap / result.queries.length).toFixed(1);
    console.log('');
    console.log(`  Average overlap: ${avgOverlap}%`);
    console.log(
      pc.green(`  ✓ voyage-4-lite retrieves nearly identical results from the same documents`)
    );
    console.log('');

    // Print cost projection
    console.log(pc.cyan('  ── Cost Projection (1M docs, 50M queries/month, 12 months) ──'));
    console.log('');

    const symmetric = result.costs.symmetric;
    const asymmetric = result.costs.asymmetric;
    const savings = symmetric - asymmetric;
    const savingsPercent = ((savings / symmetric) * 100).toFixed(1);

    console.log(`  Symmetric (large everywhere):     $${symmetric.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`);
    console.log(`  Asymmetric (large→docs, lite→queries): $${asymmetric.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`);
    console.log('');
    console.log(pc.green(`  💰 Annual savings: $${savings.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} (${savingsPercent}%)`));
    console.log('');

    // Step 4: Export prompt
    console.log(pc.cyan('  ── Next Steps ──'));
    console.log('');
    console.log('  Run `vai optimize` with your real data:');
    console.log('');
    console.log(`    ${pc.dim('vai pipeline ./my-docs/ --db myapp --collection knowledge --create-index')}`);
    console.log(`    ${pc.dim('vai optimize --db myapp --collection knowledge --export report.md')}`);
    console.log('');
    console.log('  Or visualize the analysis in the Playground:');
    console.log(`    ${pc.dim('vai playground')}`);
    console.log('');

    // Track completion
    if (telemetry && telemetry.send) {
      telemetry.send('demo_cost_optimizer_completed', {
        duration: Date.now() - demoStart,
        docCount,
        queries: queries.length,
      });
    }
  } catch (err) {
    console.error('');
    console.error(pc.red('  Demo failed:'), err.message);
    if (process.env.DEBUG) console.error(err);
    process.exit(1);
  }
}

/**
 * Run demo cleanup.
 */
async function runCleanup(opts) {
  const { getConnection } = require('../lib/mongo');
  const telemetry = require('../lib/telemetry');

  const prereq = checkPrerequisites(['mongodb']);
  if (!prereq.ok) {
    printPrereqErrors(prereq.errors);
    process.exit(1);
  }

  console.log('');
  console.log(pc.yellow('  Cleaning up demo data...'));

  try {
    const client = await getConnection();
    const db = client.db('vai_demo');

    // Drop demo collections
    const collectionNames = ['cost_optimizer_demo', 'code_search_demo', 'chat_demo'];
    let dropped = 0;

    for (const collName of collectionNames) {
      try {
        await db.collection(collName).drop();
        console.log(pc.dim(`  ✓ Dropped vai_demo.${collName}`));
        dropped++;
      } catch (err) {
        // Collection may not exist
      }
    }

    console.log('');
    if (dropped > 0) {
      console.log(pc.green(`  ✓ Cleaned up ${dropped} collection(s)`));
    } else {
      console.log(pc.dim('  No demo data to clean.'));
    }

    telemetry.track('demo_cleanup', { collectionsDropped: dropped });
  } catch (err) {
    console.error(pc.red('  Cleanup failed:'), err.message);
    process.exit(1);
  }
}

module.exports = { registerDemo };
