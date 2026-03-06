'use strict';

const path = require('path');
const readline = require('readline');
const pc = require('picocolors');
const { getConfigValue } = require('../lib/config');

const SAMPLE_DATA_DIR = path.join(__dirname, '..', 'demo', 'sample-data');
const SAMPLE_CODE_DIR = path.join(__dirname, '..', 'demo', 'sample-code');

// ── Verbose helpers ──────────────────────────────────────────────────

function theory(verbose, ...lines) {
  if (!verbose) return;
  console.log('');
  for (const line of lines) {
    console.log(`  ${pc.dim('ℹ ' + line)}`);
  }
  console.log('');
}

function step(verbose, description) {
  if (!verbose) return;
  console.log(`  ${pc.dim('→ ' + description)}`);
}

// ── Retry helper ─────────────────────────────────────────────────────

/**
 * Retry an async function with delay, showing status on index-not-ready errors.
 * @param {function} fn - async function to execute
 * @param {object} [opts]
 * @param {number} [opts.maxRetries=3]
 * @param {number} [opts.delayMs=4000]
 * @returns {Promise<any>} result of fn, or throws on final failure
 */
async function retryQuery(fn, opts = {}) {
  const maxRetries = opts.maxRetries || 3;
  const delayMs = opts.delayMs || 4000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isIndexError = err.message?.includes('index') ||
        err.codeName === 'InvalidPipelineOperator' ||
        err.message?.includes('PlanExecutor');

      if (isIndexError && attempt < maxRetries) {
        console.log(`  ${pc.dim(`  Index warming up, retrying in ${delayMs / 1000}s... (${attempt + 1}/${maxRetries})`)}`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      throw err;
    }
  }
}

// ── Prerequisites ────────────────────────────────────────────────────

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

  return { ok: errors.length === 0, errors };
}

function printPrereqErrors(errors) {
  console.error('');
  console.error(pc.red('  Prerequisites not met:'));
  for (const err of errors) {
    console.error(`  ${pc.red('✗')} ${err}`);
  }
  console.error('');
}

// ── Registration ─────────────────────────────────────────────────────

function registerDemo(program) {
  const cmd = program
    .command('demo [subcommand]')
    .description('Guided demonstrations of Voyage AI features')
    .option('--no-pause', 'Skip Enter prompts and interactive REPL (for CI/recording)')
    .option('-v, --verbose', 'Show theory and behind-the-scenes detail')
    .option('--local', 'Use local nano embeddings for chat demo')
    .action(async (subcommand, opts) => {
      if (!subcommand) {
        await showDemoMenu(opts);
        return;
      }

      switch (subcommand) {
        case 'cost-optimizer':
          await runCostOptimizerDemo(opts);
          break;
        case 'code-search':
          await runCodeSearchDemo(opts);
          break;
        case 'chat':
          await runChatDemo(opts);
          break;
        case 'nano': {
          const { runNanoDemo } = require('../demos/nano');
          await runNanoDemo(opts);
          break;
        }
        case 'cleanup':
          await runCleanup(opts);
          break;
        default:
          console.error(pc.red(`  Unknown demo: ${subcommand}`));
          process.exit(1);
      }
    });

  return cmd;
}

// ── Menu ─────────────────────────────────────────────────────────────

async function showDemoMenu(opts) {
  console.log('');
  console.log(pc.bold('  Welcome to vai demos!'));
  console.log('');
  console.log('  Choose a demonstration:');
  console.log('');
  console.log('    ' + pc.cyan('1. 💰 Cost Optimizer'));
  console.log('       Prove the shared embedding space saves money — on your data.');
  console.log('');
  console.log('    ' + pc.cyan('2. 🔍 Code Search in 5 Minutes'));
  console.log('       Index and search a codebase with semantic AI.');
  console.log('');
  console.log('    ' + pc.cyan('3. 💬 Chat With Your Docs'));
  console.log('       Turn documents into conversational AI with RAG.');
  console.log('');
  console.log('    ' + pc.cyan('4. Local Embeddings (Nano)'));
  console.log('       Experience embedding inference locally -- no API key needed.');
  console.log('');
  console.log('  ' + pc.dim('Tip: add --verbose for behind-the-scenes theory'));
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
    rl.question('  Select (1-4): ', (answer) => {
      rl.close();

      switch (answer.trim()) {
        case '1':
          runCostOptimizerDemo(opts).then(resolve);
          break;
        case '2':
          runCodeSearchDemo(opts).then(resolve);
          break;
        case '3':
          runChatDemo(opts).then(resolve);
          break;
        case '4': {
          const { runNanoDemo } = require('../demos/nano');
          runNanoDemo(opts).then(resolve);
          break;
        }
        default:
          console.log(pc.red('\n  Invalid selection'));
          resolve();
      }
    });
  });
}

// ── Demo 1: Cost Optimizer ───────────────────────────────────────────

async function runCostOptimizerDemo(opts) {
  const telemetry = require('../lib/telemetry');
  const verbose = opts.verbose || false;

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

  theory(verbose,
    'Voyage AI models share a common 1024-dimensional embedding space.',
    'This means vectors from voyage-4-large and voyage-4-lite live in the same',
    'geometric space — cosine similarity works across models.',
    '',
    'The cost optimization strategy: embed documents once with the higher-quality',
    'voyage-4-large model, but query at runtime with the cheaper voyage-4-lite.',
    'You get large-quality document representations with lite-cost queries.',
  );

  const demoStart = Date.now();

  try {
    // Step 1: Ingest sample data
    console.log(pc.bold('  Step 1: Preparing knowledge base...'));
    console.log('');

    step(verbose, 'Reading 65 sample markdown files from src/demo/sample-data/');
    step(verbose, 'Embedding each file with voyage-4-large (1024 dims, ~$0.05/1M tokens)');

    const { ingestSampleData } = require('../lib/demo-ingest');

    const { docCount, collectionName } = await ingestSampleData(SAMPLE_DATA_DIR, {
      db: opts.db || 'vai_demo',
      collection: opts.collection || 'cost_optimizer_demo',
    });

    console.log(`  ✓ Ingested ${docCount} sample documents`);
    console.log(`  ✓ Collection: ${collectionName}`);
    console.log('');

    // Step 2: Run cost analysis
    console.log(pc.bold('  Step 2: Analyzing cost savings...'));
    console.log('');

    theory(verbose,
      'The optimizer generates sample queries from your corpus, then runs each',
      'query through both voyage-4-large and voyage-4-lite to compare results.',
      'It measures "overlap" — how many of the same documents both models retrieve.',
      'High overlap means lite queries are just as accurate as large queries.',
    );

    const { Optimizer } = require('../lib/optimizer');
    const optimizer = new Optimizer({
      db: opts.db || 'vai_demo',
      collection: opts.collection || 'cost_optimizer_demo',
    });

    const queries = await optimizer.generateSampleQueries(5);

    step(verbose, `Generated ${queries.length} sample queries from the corpus`);
    step(verbose, 'Running vector search with voyage-4-large (baseline)');
    step(verbose, 'Running vector search with voyage-4-lite (cost-optimized)');
    step(verbose, 'Comparing top-5 retrieved documents for each query');

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

    console.log(pc.cyan('  ── Retrieval Quality ──'));
    console.log('');
    console.log('  Comparing voyage-4-large (baseline) vs voyage-4-lite:');
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
    console.log(pc.green('  ✓ voyage-4-lite retrieves nearly identical results from the same documents'));
    console.log('');

    theory(verbose,
      `With ${avgOverlap}% overlap, the lite model finds almost exactly the same`,
      'documents as the large model. This is the shared embedding space in action.',
      'The vectors are geometrically close enough that cosine similarity rankings',
      'are preserved even across different model sizes.',
    );

    // Print cost projection
    console.log(pc.cyan('  ── Cost Projection (1M docs, 50M queries/month, 12 months) ──'));
    console.log('');

    const symmetric = result.costs.symmetric;
    const asymmetric = result.costs.asymmetric;
    const savings = symmetric - asymmetric;
    const savingsPercent = ((savings / symmetric) * 100).toFixed(1);

    console.log(`  Symmetric (large everywhere):     $${symmetric.toLocaleString('en-US', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    })}`);
    console.log(`  Asymmetric (large→docs, lite→queries): $${asymmetric.toLocaleString('en-US', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    })}`);
    console.log('');
    console.log(pc.green(`  💰 Annual savings: $${savings.toLocaleString('en-US', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    })} (${savingsPercent}%)`));
    console.log('');

    theory(verbose,
      'Savings come from the pricing difference:',
      '  voyage-4-large: ~$0.05 per 1M tokens (used once at ingest)',
      '  voyage-4-lite:  ~$0.02 per 1M tokens (used for every query)',
      'At 50M queries/month, that difference compounds significantly.',
    );

    // Step 4: Next steps
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

// ── Demo 2: Code Search ──────────────────────────────────────────────

async function runCodeSearchDemo(opts) {
  const { generateEmbeddings } = require('../lib/api');
  const { getMongoCollection } = require('../lib/mongo');
  const { smartChunkCode, extractSymbols, findCodeFiles } = require('../lib/code-search');
  const { ensureVectorIndex, waitForIndex } = require('../lib/demo-ingest');
  const telemetry = require('../lib/telemetry');
  const verbose = opts.verbose || false;
  const interactive = opts.pause !== false; // --no-pause disables interactive

  const prereq = checkPrerequisites(['api-key', 'mongodb']);
  if (!prereq.ok) {
    printPrereqErrors(prereq.errors);
    process.exit(1);
  }

  console.log('');
  console.log(pc.bold('  🔍 Code Search Demo'));
  console.log(pc.dim('  ━━━━━━━━━━━━━━━━━━━━'));
  console.log('');
  console.log('  This demo indexes a sample Node.js API project and performs semantic');
  console.log('  code search — finding relevant code using natural language queries.');
  console.log('');

  theory(verbose,
    'Semantic code search uses voyage-code-3, an embedding model trained',
    'specifically on source code. Unlike text search (grep, ripgrep), it',
    'understands intent — "error handling" finds try/catch blocks, retry',
    'logic, and error formatting even if those words don\'t appear literally.',
    '',
    'The process:',
    '  1. Scan files → smart-chunk by function/class boundaries',
    '  2. Embed each chunk with voyage-code-3 (1024 dims)',
    '  3. Store in MongoDB Atlas with vector search index',
    '  4. Query: embed question → cosine search → rerank',
  );

  const demoStart = Date.now();
  const dbName = opts.db || 'vai_demo';
  const collName = opts.collection || 'code_search_demo';

  let client, collection;

  try {
    // Step 1: Index the sample "TaskFlow API" project
    console.log(pc.bold('  Step 1: Indexing sample TaskFlow API...'));
    console.log('');

    const srcDir = SAMPLE_CODE_DIR;
    step(verbose, `Scanning sample project (${path.basename(srcDir)}/) for code files`);

    const files = await findCodeFiles(srcDir, { maxFiles: 50, maxFileSize: 50000 });
    console.log(`  ✓ Found ${files.length} code files`);

    step(verbose, 'Smart-chunking files by function/class boundaries');
    step(verbose, 'Extracting symbols (function names, exports) per chunk');

    const allDocs = [];
    for (const filePath of files) {
      const content = require('fs').readFileSync(filePath, 'utf-8');
      const relativePath = path.relative(srcDir, filePath);
      const ext = path.extname(filePath).toLowerCase();
      const symbols = extractSymbols(content, filePath);
      const chunks = smartChunkCode(content, filePath, { chunkSize: 512, chunkOverlap: 50 });

      for (const c of chunks) {
        allDocs.push({
          text: c.text,
          metadata: {
            source: relativePath,
            language: ext.slice(1),
            startLine: c.startLine,
            endLine: c.endLine,
            chunkType: c.type,
            symbols: symbols.filter(s => c.text.includes(s)),
          },
        });
      }
    }

    console.log(`  ✓ Created ${allDocs.length} code chunks`);
    console.log('');

    theory(verbose,
      'Smart chunking splits code at natural boundaries (function declarations,',
      'class definitions, module.exports) rather than at fixed character counts.',
      'This means each chunk is a coherent unit of code — not a random slice.',
      'Symbols extracted: function names, class names, exported identifiers.',
    );

    // Step 2: Embed and store
    console.log(pc.bold('  Step 2: Embedding with voyage-code-3...'));
    console.log('');

    step(verbose, 'voyage-code-3 is specifically trained on source code');
    step(verbose, 'It understands syntax, patterns, and programming concepts');

    const batchSize = 10; // Small batches for resilience
    let totalTokens = 0;

    const mongoResult = await getMongoCollection(dbName, collName);
    client = mongoResult.client;
    collection = mongoResult.collection;

    try { await collection.drop(); } catch { /* doesn't exist */ }

    for (let i = 0; i < allDocs.length; i += batchSize) {
      const batch = allDocs.slice(i, i + batchSize);
      const texts = batch.map(d => d.text);

      // Retry embedding with backoff on transient network errors
      let embedResult;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          embedResult = await generateEmbeddings(texts, {
            model: 'voyage-code-3',
            inputType: 'document',
          });
          break;
        } catch (err) {
          const isTransient = err.code === 'EPIPE' || err.code === 'ECONNRESET' ||
            err.message?.includes('EPIPE') || err.message?.includes('socket') ||
            err.message?.includes('ECONNRESET') || err.message?.includes('timeout');
          if (isTransient && attempt < 2) {
            const delay = (attempt + 1) * 2000;
            process.stdout.write(`\r  Embedding... ${pc.dim(`network error, retrying in ${delay / 1000}s...`)}          `);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          throw err;
        }
      }

      totalTokens += embedResult.usage?.total_tokens || 0;

      const docsToInsert = batch.map((doc, idx) => ({
        text: doc.text,
        embedding: embedResult.data[idx].embedding,
        metadata: doc.metadata,
      }));
      await collection.insertMany(docsToInsert);

      process.stdout.write(`\r  Embedding... ${Math.min(i + batchSize, allDocs.length)}/${allDocs.length} chunks`);
    }

    console.log(pc.green('  done'));
    console.log(`  ✓ Used ${totalTokens.toLocaleString()} tokens`);
    console.log('');

    // Create and wait for index
    process.stdout.write('  Creating vector search index... ');
    await ensureVectorIndex(collection, 'code_search_index');
    console.log(pc.green('done'));

    process.stdout.write('  Waiting for index to become queryable... ');
    const ready = await waitForIndex(collection, 'code_search_index', 120000, {
      probeDimensions: 1024,
      onStatus: (status, elapsed) => {
        const secs = Math.round(elapsed / 1000);
        if (status === 'WARMING') {
          process.stdout.write(`\r  Waiting for index to become queryable... ${pc.dim(`${secs}s (warming)`)} `);
        } else if (status === 'READY_PROBING') {
          process.stdout.write(`\r  Waiting for index to become queryable... ${pc.dim(`${secs}s (probing)`)} `);
        }
      },
    });

    if (ready) {
      console.log(`\r  Waiting for index to become queryable... ${pc.green('ready')}             `);
    } else {
      console.log(`\r  Waiting for index to become queryable... ${pc.yellow('timeout')}           `);
    }
    console.log('');

    // Step 3: Run demo queries
    console.log(pc.bold('  Step 3: Semantic code search'));
    console.log('');

    const demoQueries = [
      'How does authentication and JWT token verification work?',
      'error handling middleware and custom error classes',
      'rate limiting implementation',
      'database connection with retry logic',
    ];

    theory(verbose,
      'Each query is embedded with voyage-code-3 as a "query" input type.',
      'The query vector is compared against all code chunk vectors using',
      'cosine similarity via MongoDB Atlas $vectorSearch.',
      'Top candidates are then reranked with Voyage AI\'s reranker for',
      'precision — the reranker considers the full text, not just vectors.',
    );

    /**
     * Run a single code search query against the collection.
     * @returns {Array} search results
     */
    async function executeCodeSearch(query) {
      const embedResult = await generateEmbeddings([query], {
        model: 'voyage-code-3',
        inputType: 'query',
      });
      const queryVector = embedResult.data[0].embedding;

      return collection.aggregate([
        {
          $vectorSearch: {
            index: 'code_search_index',
            path: 'embedding',
            queryVector,
            numCandidates: 50,
            limit: 3,
          },
        },
        { $addFields: { _vsScore: { $meta: 'vectorSearchScore' } } },
      ]).toArray();
    }

    /** Print code search results */
    function printCodeResults(searchResults) {
      if (searchResults.length === 0) {
        console.log(`  ${pc.dim('  No results')}`);
        return;
      }

      for (let i = 0; i < Math.min(searchResults.length, 3); i++) {
        const r = searchResults[i];
        const meta = r.metadata || {};
        const lineRange = meta.startLine ? `:${meta.startLine}-${meta.endLine}` : '';
        const score = r._vsScore ? r._vsScore.toFixed(3) : '—';
        const symbols = (meta.symbols || []).slice(0, 3).join(', ');
        const snippet = (r.text || '').split('\n').slice(0, 2).join(' ').slice(0, 80);

        console.log(`    ${pc.bold(`#${i + 1}`)} ${pc.dim(meta.source + lineRange)} ${pc.dim(`score:${score}`)}`);
        if (symbols) console.log(`       ${pc.dim('symbols:')} ${symbols}`);
        console.log(`       ${pc.dim(snippet + '...')}`);
      }
    }

    // Run canned queries with retry
    for (const query of demoQueries) {
      console.log(`  ${pc.cyan('Q:')} ${query}`);

      try {
        const searchResults = await retryQuery(() => executeCodeSearch(query), {
          maxRetries: 3,
          delayMs: 4000,
        });
        printCodeResults(searchResults);
      } catch (err) {
        console.log(`  ${pc.yellow('  ⚠')} Search failed: ${err.message}`);
      }
      console.log('');
    }

    const elapsed = ((Date.now() - demoStart) / 1000).toFixed(1);
    console.log(`  ${pc.dim(`Canned queries completed in ${elapsed}s`)}`);
    console.log('');

    // Interactive REPL
    if (interactive) {
      console.log(pc.cyan('  ── Try it yourself ──'));
      console.log('');
      console.log('  Type a natural language query to search the sample TaskFlow API.');
      console.log(`  ${pc.dim('Type /quit to exit.')}`);
      console.log('');

      await new Promise((resolve) => {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
          prompt: pc.cyan('  code-search> '),
        });

        rl.prompt();

        rl.on('line', async (line) => {
          const input = line.trim();
          if (!input) { rl.prompt(); return; }
          if (input === '/quit' || input === '/exit' || input === '/q') {
            rl.close();
            return;
          }

          try {
            const results = await executeCodeSearch(input);
            printCodeResults(results);
          } catch (err) {
            console.log(`  ${pc.yellow('  ⚠')} ${err.message}`);
          }
          console.log('');
          rl.prompt();
        });

        rl.on('close', resolve);
        rl.on('SIGINT', () => { console.log(''); rl.close(); });
      });
    }

    // Next steps
    console.log('');
    console.log(pc.cyan('  ── Next Steps ──'));
    console.log('');
    console.log('  Index your own codebase:');
    console.log('');
    console.log(`    ${pc.dim('vai code-search init ./my-project')}`);
    console.log(`    ${pc.dim('vai code-search "how does authentication work?"')}`);
    console.log('');

    if (telemetry && telemetry.send) {
      telemetry.send('demo_code_search_completed', {
        duration: Date.now() - demoStart,
        files: files.length,
        chunks: allDocs.length,
        tokens: totalTokens,
      });
    }
  } catch (err) {
    console.error('');
    console.error(pc.red('  Demo failed:'), err.message);
    if (process.env.DEBUG) console.error(err);
    process.exit(1);
  } finally {
    if (client) await client.close();
  }
}

// ── Demo 3: Chat With Your Docs ──────────────────────────────────────

async function runChatDemo(opts) {
  const { createLLMProvider, resolveLLMConfig } = require('../lib/llm');
  const { ChatHistory } = require('../lib/history');
  const { chatTurn } = require('../lib/chat');
  const { ingestChunkedData, waitForIndex } = require('../lib/demo-ingest');
  const { getMongoCollection } = require('../lib/mongo');
  const chatUI = require('../lib/chat-ui');
  const telemetry = require('../lib/telemetry');
  const verbose = opts.verbose || false;
  const interactive = opts.pause !== false;
  const isLocal = opts.local || false;

  // Nano prerequisite check (before standard prerequisites)
  let generateLocalEmbeddings;
  if (isLocal) {
    const { checkVenv, checkModel } = require('../nano/nano-health');
    const venv = checkVenv();
    const model = checkModel();
    if (!venv.ok || !model.ok) {
      console.log('');
      console.log(pc.red('  voyage-4-nano is not set up.'));
      console.log(`  Run ${pc.cyan('vai nano setup')} to install voyage-4-nano`);
      console.log('');
      process.exit(1);
    }
    generateLocalEmbeddings = require('../nano/nano-local').generateLocalEmbeddings;
  }

  const requiredChecks = isLocal ? ['mongodb', 'llm'] : ['api-key', 'mongodb', 'llm'];
  const prereq = checkPrerequisites(requiredChecks);
  if (!prereq.ok) {
    printPrereqErrors(prereq.errors);
    process.exit(1);
  }

  console.log('');
  console.log(pc.bold(isLocal ? '  💬 Chat With Your Docs Demo (local)' : '  💬 Chat With Your Docs Demo'));
  console.log(pc.dim('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log('');
  console.log('  This demo ingests sample documentation, then runs a RAG-powered');
  console.log('  chat session — asking questions answered by the knowledge base.');
  console.log('');

  if (isLocal) {
    theory(verbose,
      'RAG (Retrieval-Augmented Generation) combines search with LLM generation:',
      '',
      '  1. CHUNK: Split documents into overlapping sections (~800 chars)',
      '  2. EMBED: Convert each chunk to a 1024-dim vector with voyage-4-nano (local inference)',
      '  3. INDEX: Store vectors in MongoDB Atlas with a vector search index',
      '  4. QUERY: Embed the user\'s question, find nearest chunk vectors',
      '  5. RERANK: Skipped in local mode (requires API key)',
      '  6. GENERATE: Send top chunks + question to an LLM for a grounded answer',
      '',
      'The result: the LLM answers using your documents as evidence,',
      'reducing hallucination and providing traceable sources.',
    );
  } else {
    theory(verbose,
      'RAG (Retrieval-Augmented Generation) combines search with LLM generation:',
      '',
      '  1. CHUNK: Split documents into overlapping sections (~800 chars)',
      '  2. EMBED: Convert each chunk to a 1024-dim vector with voyage-4-large',
      '  3. INDEX: Store vectors in MongoDB Atlas with a vector search index',
      '  4. QUERY: Embed the user\'s question, find nearest chunk vectors',
      '  5. RERANK: Re-score candidates with a cross-encoder for precision',
      '  6. GENERATE: Send top chunks + question to an LLM for a grounded answer',
      '',
      'The result: the LLM answers using your documents as evidence,',
      'reducing hallucination and providing traceable sources.',
    );
  }

  const demoStart = Date.now();
  const dbName = opts.db || 'vai_demo';
  const collName = opts.collection || 'chat_demo';

  try {
    // Step 1: Ingest with chunking
    console.log(pc.bold('  Step 1: Ingesting and chunking documents...'));
    console.log('');

    step(verbose, 'Reading markdown files from src/demo/sample-data/');
    step(verbose, 'Splitting by ## heading sections (preserving context)');
    step(verbose, 'Stamping source metadata for human-readable attribution');

    const ingestOpts = {
      db: dbName,
      collection: collName,
      onProgress: (event, data) => {
        switch (event) {
          case 'scan':
            console.log(`  ✓ Found ${data.fileCount} sample documents`);
            break;
          case 'chunks':
            console.log(`  ✓ Created ${data.chunkCount} chunks`);
            break;
          case 'embed':
            process.stdout.write(`\r  Embedding... ${data.done}/${data.total} chunks`);
            if (data.done >= data.total) console.log(pc.green('  done'));
            break;
        }
      },
    };

    if (isLocal) {
      ingestOpts.embedFn = generateLocalEmbeddings;
      ingestOpts.model = 'voyage-4-nano';
      ingestOpts.dimensions = 1024;
    }

    const ingestResult = await ingestChunkedData(SAMPLE_DATA_DIR, ingestOpts);

    console.log(`  ✓ Stored in ${ingestResult.collectionName}`);
    console.log('');

    theory(verbose,
      `${ingestResult.fileCount} files → ${ingestResult.chunkCount} chunks.`,
      'Each chunk carries metadata: title, filename, chunk index.',
      'When the chat retrieves chunks, resolveSourceLabel() extracts the',
      'human-readable title. deduplicateSources() groups chunks from the',
      'same document, showing the best score and chunk count.',
    );

    // Wait for vector index
    console.log(pc.bold('  Step 2: Waiting for vector index...'));
    console.log('');

    step(verbose, 'MongoDB Atlas builds the vector search index asynchronously');
    step(verbose, 'Probing with $vectorSearch to confirm queryability');

    const { client: waitClient, collection: waitColl } = await getMongoCollection(dbName, collName);
    process.stdout.write('  Waiting for index... ');
    const ready = await waitForIndex(waitColl, 'vector_index', 120000, {
      probeDimensions: 1024,
      onStatus: (status, elapsed) => {
        const secs = Math.round(elapsed / 1000);
        if (status === 'WARMING' || status === 'READY_PROBING') {
          process.stdout.write(`\r  Waiting for index... ${pc.dim(`${secs}s (${status.toLowerCase()})`)} `);
        }
      },
    });
    await waitClient.close();

    if (ready) {
      console.log(`\r  Waiting for index... ${pc.green('ready')}             `);
    } else {
      console.log(`\r  Waiting for index... ${pc.yellow('timeout — will retry queries')}        `);
    }
    console.log('');

    // Step 3: Run demo chat queries
    console.log(pc.bold('  Step 3: RAG chat session'));
    console.log('');

    const llmConfig = resolveLLMConfig(opts);
    const llm = createLLMProvider(llmConfig);
    const history = new ChatHistory({ maxTurns: 10 });

    console.log(`  ${pc.dim(`LLM: ${llm.name}/${llm.model}`)}`);
    console.log('');

    /** Run a single chat turn with retry and rendering */
    async function executeChatTurn(query) {
      let sources = [];
      const streamRenderer = chatUI.createStreamRenderer();

      process.stdout.write(`  ${pc.green('vai:')} `);

      const chatOpts = { maxDocs: 3, stream: true, textField: 'text' };
      if (isLocal) {
        chatOpts.embedFn = generateLocalEmbeddings;
        chatOpts.model = 'voyage-4-nano';
        chatOpts.dimensions = 1024;
        chatOpts.rerank = false;
      }

      await retryQuery(async () => {
        for await (const event of chatTurn({
          query,
          db: dbName,
          collection: collName,
          llm,
          history,
          opts: chatOpts,
        })) {
          switch (event.type) {
            case 'retrieval':
              if (verbose) {
                const docs = event.data.docs || [];
                const rerankedNote = isLocal ? ', reranking skipped' : '';
                console.log('');
                console.log(`  ${pc.dim(`  Retrieved ${docs.length} chunks in ${event.data.timeMs}ms${rerankedNote}`)}`);
                for (const d of docs.slice(0, 3)) {
                  console.log(`  ${pc.dim(`    • ${d.source} (score: ${(d.score || 0).toFixed(3)})`)}`);
                }
                process.stdout.write(`  ${pc.green('vai:')} `);
              }
              break;
            case 'chunk':
              streamRenderer.write(event.data);
              break;
            case 'done':
              streamRenderer.end();
              sources = event.data.sources || [];
              break;
          }
        }
      }, { maxRetries: 2, delayMs: 5000 });

      console.log('');

      if (sources.length > 0) {
        console.log(chatUI.renderSources(sources));
      }

      return sources;
    }

    const demoQueries = [
      'How should I handle API key rotation and what are the security best practices?',
      'What retry strategies are recommended for handling transient errors?',
      'Explain the database sharding approach and when to use it.',
    ];

    for (let qi = 0; qi < demoQueries.length; qi++) {
      const query = demoQueries[qi];
      console.log(`  ${pc.cyan('You:')} ${query}`);
      console.log('');

      if (isLocal) {
        theory(verbose,
          'Step A: Embedding query with voyage-4-nano (local)',
          `Step B: $vectorSearch against ${ingestResult.chunkCount} chunks (cosine similarity)`,
          'Step C: Reranking: skipped (local mode)',
          'Step D: Building prompt with retrieved context + history',
          `Step E: Streaming response from ${llm.name}/${llm.model}`,
        );
      } else {
        theory(verbose,
          'Step A: Embedding query with voyage-4-large',
          `Step B: $vectorSearch against ${ingestResult.chunkCount} chunks (cosine similarity)`,
          'Step C: Reranking top candidates with cross-encoder',
          'Step D: Building prompt with retrieved context + history',
          `Step E: Streaming response from ${llm.name}/${llm.model}`,
        );
      }

      try {
        await executeChatTurn(query);
      } catch (err) {
        console.log('');
        console.log(`  ${pc.yellow('⚠')} Query failed: ${err.message}`);
        console.log('');
      }

      if (verbose && qi < demoQueries.length - 1) {
        console.log(pc.dim('  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─'));
        console.log('');
      }
    }

    const elapsed = ((Date.now() - demoStart) / 1000).toFixed(1);
    console.log(`  ${pc.dim(`Canned queries completed in ${elapsed}s`)}`);
    console.log('');

    // Interactive REPL
    if (interactive) {
      console.log(pc.cyan('  ── Try it yourself ──'));
      console.log('');
      console.log('  Ask a question about the sample documentation.');
      console.log('  Conversation history carries over — try follow-up questions!');
      console.log(`  ${pc.dim('Type /quit to exit.')}`);
      console.log('');

      await new Promise((resolve) => {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
          prompt: pc.cyan('  chat> '),
        });

        rl.prompt();

        rl.on('line', async (line) => {
          const input = line.trim();
          if (!input) { rl.prompt(); return; }
          if (input === '/quit' || input === '/exit' || input === '/q') {
            rl.close();
            return;
          }

          console.log('');

          try {
            await executeChatTurn(input);
          } catch (err) {
            console.log(`  ${pc.yellow('⚠')} ${err.message}`);
            console.log('');
          }

          rl.prompt();
        });

        rl.on('close', resolve);
        rl.on('SIGINT', () => { console.log(''); rl.close(); });
      });
    }

    // Next steps
    console.log('');
    console.log(pc.cyan('  ── Next Steps ──'));
    console.log('');
    console.log('  Chat with your own documents:');
    console.log('');
    console.log(`    ${pc.dim('vai ingest ./my-docs/ --db myapp --collection knowledge')}`);
    console.log(`    ${pc.dim('vai chat --db myapp --collection knowledge')}`);
    console.log('');
    console.log('  Or try agent mode (LLM picks its own tools):');
    console.log(`    ${pc.dim('vai chat --mode agent --db myapp --collection knowledge')}`);
    console.log('');

    if (telemetry && telemetry.send) {
      telemetry.send('demo_chat_completed', {
        duration: Date.now() - demoStart,
        fileCount: ingestResult.fileCount,
        chunkCount: ingestResult.chunkCount,
        queries: demoQueries.length,
        llmProvider: llm.name,
        llmModel: llm.model,
      });
    }
  } catch (err) {
    console.error('');
    console.error(pc.red('  Demo failed:'), err.message);
    if (process.env.DEBUG) console.error(err);
    process.exit(1);
  }
}

// ── Cleanup ──────────────────────────────────────────────────────────

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

    const collectionNames = ['cost_optimizer_demo', 'code_search_demo', 'chat_demo'];
    let dropped = 0;

    for (const collName of collectionNames) {
      try {
        await db.collection(collName).drop();
        console.log(pc.dim(`  ✓ Dropped vai_demo.${collName}`));
        dropped++;
      } catch {
        // Collection may not exist
      }
    }

    console.log('');
    if (dropped > 0) {
      console.log(pc.green(`  ✓ Cleaned up ${dropped} collection(s)`));
    } else {
      console.log(pc.dim('  No demo data to clean.'));
    }

    telemetry.send('demo_cleanup', { collectionsDropped: dropped });
  } catch (err) {
    console.error(pc.red('  Cleanup failed:'), err.message);
    process.exit(1);
  }
}

module.exports = { registerDemo };
