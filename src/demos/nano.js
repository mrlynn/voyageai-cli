'use strict';

const readline = require('readline');
const pc = require('picocolors');
const { getConfigValue } = require('../lib/config');
const { getBridgeManager } = require('../nano/nano-manager');

// ── Verbose helpers (duplicated from demo.js -- not exported there) ──

function theory(verbose, ...lines) {
  if (!verbose) return;
  console.log('');
  for (const line of lines) {
    console.log(`  ${pc.dim('\u2139 ' + line)}`);
  }
  console.log('');
}

function step(verbose, description) {
  if (!verbose) return;
  console.log(`  ${pc.dim('\u2192 ' + description)}`);
}

// ── Sample texts (9 texts, 3 clusters) ──

const sampleTexts = [
  // Database cluster (0, 1, 2)
  'Create an index on the email field for faster lookups',
  'Shard the collection across regions for horizontal scaling',
  'Use aggregation pipelines to transform and filter documents',
  // Auth cluster (3, 4, 5)
  'JWT tokens expire after 24 hours and must be refreshed',
  'Hash passwords with bcrypt before storing in the database',
  'OAuth2 authorization code flow redirects to the callback URL',
  // Caching cluster (6, 7, 8)
  'Redis stores key-value pairs in memory for sub-millisecond reads',
  'Set a TTL on cache entries to prevent stale data',
  'Invalidate the cache when the underlying data changes',
];

const labels = [
  'db-index', 'db-shard', 'db-aggreg',
  'auth-jwt', 'auth-hash', 'auth-oauth',
  'cache-redis', 'cache-ttl', 'cache-inval',
];

const clusterAssignment = [0, 0, 0, 1, 1, 1, 2, 2, 2];

// ── Cosine similarity ──

function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// ── Prerequisite check ──

function checkNanoPrerequisites() {
  const { checkVenv, checkDeps, checkModel } = require('../nano/nano-health');

  const venv = checkVenv();
  const deps = checkDeps();
  const model = checkModel();

  const ok = venv.ok && deps.ok && model.ok;
  return { ok, checks: { venv, deps, model } };
}

// ── Similarity matrix display ──

function displaySimilarityMatrix(embeddings, matrixLabels) {
  const n = embeddings.length;
  const scores = [];

  // Compute pairwise similarities
  for (let i = 0; i < n; i++) {
    scores[i] = [];
    for (let j = 0; j < n; j++) {
      scores[i][j] = cosineSimilarity(embeddings[i], embeddings[j]);
    }
  }

  // Find max label width for alignment
  const maxLabel = Math.max(...matrixLabels.map(l => l.length));

  // Print header row
  const header = ' '.repeat(maxLabel + 2) + matrixLabels.map(l => l.padStart(6)).join(' ');
  console.log(pc.dim(`  ${header}`));

  // Print each row with color coding
  for (let i = 0; i < n; i++) {
    const row = matrixLabels[i].padEnd(maxLabel) + '  ' +
      scores[i].map((s, j) => {
        const formatted = s.toFixed(2).padStart(6);
        if (i === j) return pc.dim(formatted);
        if (s >= 0.7) return pc.green(formatted);
        if (s >= 0.4) return pc.yellow(formatted);
        return pc.dim(formatted);
      }).join(' ');
    console.log(`  ${row}`);
  }

  // Compute within/cross cluster ranges
  let withinMin = 1, withinMax = 0;
  let crossMin = 1, crossMax = 0;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const s = scores[i][j];
      if (clusterAssignment[i] === clusterAssignment[j]) {
        withinMin = Math.min(withinMin, s);
        withinMax = Math.max(withinMax, s);
      } else {
        crossMin = Math.min(crossMin, s);
        crossMax = Math.max(crossMax, s);
      }
    }
  }

  console.log('');
  console.log(`  Within-cluster: ${withinMin.toFixed(2)}-${withinMax.toFixed(2)} | Cross-cluster: ${crossMin.toFixed(2)}-${crossMax.toFixed(2)}`);

  return scores;
}

// ── Dimension comparison ──

async function compareDimensions(texts, clusters, dimensions) {
  const { generateLocalEmbeddings } = require('../nano/nano-local');
  const results = [];

  for (const dim of dimensions) {
    const result = await generateLocalEmbeddings(texts, { dimensions: dim });
    const embeddings = result.data.map(d => d.embedding);

    let withinSum = 0, withinCount = 0;
    let crossSum = 0, crossCount = 0;

    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        const sim = cosineSimilarity(embeddings[i], embeddings[j]);
        if (clusters[i] === clusters[j]) {
          withinSum += sim;
          withinCount++;
        } else {
          crossSum += sim;
          crossCount++;
        }
      }
    }

    results.push({
      dim,
      withinAvg: withinSum / withinCount,
      crossAvg: crossSum / crossCount,
      memoryKB: (dim * 4 * 1000) / 1024,
    });
  }

  return results;
}

// ── Dimension table display ──

function displayDimensionTable(results) {
  // Table header
  console.log(`  ${'Dimensions'.padEnd(12)} ${'Within-Cluster'.padEnd(16)} ${'Cross-Cluster'.padEnd(15)} ${'Separation'.padEnd(12)} ${'Memory/1K'}`);
  console.log(`  ${'----------'.padEnd(12)} ${'--------------'.padEnd(16)} ${'-------------'.padEnd(15)} ${'----------'.padEnd(12)} ${'---------'}`);

  for (const r of results) {
    const within = r.withinAvg.toFixed(3);
    const cross = r.crossAvg.toFixed(3);
    const sep = (r.withinAvg - r.crossAvg).toFixed(3);
    const mem = r.memoryKB >= 1024
      ? `${(r.memoryKB / 1024).toFixed(1)} MB`
      : `${Math.round(r.memoryKB)} KB`;

    console.log(`  ${String(r.dim).padEnd(12)} ${within.padEnd(16)} ${cross.padEnd(15)} ${sep.padEnd(12)} ${mem}`);
  }

  // Summary line comparing smallest vs largest
  if (results.length >= 2) {
    const smallest = results[0];
    const largest = results[results.length - 1];
    const smallSep = smallest.withinAvg - smallest.crossAvg;
    const largeSep = largest.withinAvg - largest.crossAvg;
    const retainedPct = ((smallSep / largeSep) * 100).toFixed(0);
    const memRatio = Math.round(largest.memoryKB / smallest.memoryKB);

    console.log('');
    console.log(`  ${smallest.dim} dims retains ~${retainedPct}% separation at 1/${memRatio} memory`);
  }
}

// ── Main demo flow ──

async function runNanoDemo(opts) {
  const ui = require('../lib/ui');
  const { generateLocalEmbeddings } = require('../nano/nano-local');
  const telemetry = require('../lib/telemetry');
  const verbose = opts.verbose || false;
  const interactive = opts.pause !== false;
  const demoStart = Date.now();

  // 1. Check prerequisites
  const prereq = checkNanoPrerequisites();
  if (!prereq.ok) {
    console.log('');
    console.log(pc.red('  Nano prerequisites not met:'));
    console.log('');
    const { venv, deps, model } = prereq.checks;
    if (!venv.ok) console.log(`  ${pc.red('\u2717')} Virtual environment: ${venv.message}${venv.hint ? '  ' + pc.yellow(venv.hint) : ''}`);
    if (!deps.ok) console.log(`  ${pc.red('\u2717')} Dependencies: ${deps.message}${deps.hint ? '  ' + pc.yellow(deps.hint) : ''}`);
    if (!model.ok) console.log(`  ${pc.red('\u2717')} Model: ${model.message}${model.hint ? '  ' + pc.yellow(model.hint) : ''}`);
    console.log('');
    console.log(`  Run ${pc.cyan('vai nano setup')} to get started.`);
    console.log('');
    return;
  }

  try {
    // 2. Header
    console.log('');
    console.log(pc.bold('  Local Embeddings Demo'));
    console.log(pc.dim('  \u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501'));
    console.log('');
    console.log('  Experience local embedding inference with voyage-4-nano.');
    console.log('  No API key, no network, no external dependencies.');
    console.log('');

    // 3. Theory about nano embeddings
    theory(verbose,
      'voyage-4-nano runs entirely on your machine using a Python bridge.',
      'The model uses Matryoshka Representation Learning (MRL) to produce',
      'embeddings at different dimensions (256/512/1024/2048), allowing you',
      'to trade quality for memory depending on your use case.',
    );

    // 4. Step 1: Similarity Matrix
    console.log(pc.bold('  Step 1: Embedding sample texts...'));
    console.log('');

    step(verbose, 'Embedding 9 developer-focused texts across 3 semantic clusters');
    step(verbose, 'Database (indexing, sharding, aggregation), Auth (JWT, bcrypt, OAuth), Caching (Redis, TTL, invalidation)');

    // Wrap first embedding call in spinner
    await ui.ensureSpinnerReady();
    const spinner = ui.spinner('Loading voyage-4-nano model and embedding 9 texts...').start();

    let result;
    try {
      result = await generateLocalEmbeddings(sampleTexts, { dimensions: 1024 });
      spinner.succeed('Model loaded \u2014 embeddings generated');
    } catch (err) {
      spinner.fail('Failed to generate embeddings');
      throw err;
    }

    const embeddings = result.data.map(d => d.embedding);

    console.log('');
    displaySimilarityMatrix(embeddings, labels);
    console.log('');

    theory(verbose,
      'Cosine similarity measures the angle between two vectors (0 = unrelated, 1 = identical).',
      'Green cells (>= 0.7) show high similarity within semantic clusters.',
      'Dim cells (< 0.4) show low similarity across different topics.',
      'Notice how the 3x3 blocks along the diagonal light up \u2014 that is the model',
      'recognizing that database, auth, and caching texts form distinct clusters.',
    );

    // 5. Step 2: Dimension Comparison
    console.log(pc.bold('  Step 2: Comparing MRL dimensions...'));
    console.log('');

    step(verbose, 'Re-embedding all 9 texts at 256, 1024, and 2048 dimensions');
    step(verbose, 'Measuring how cluster separation changes with dimensionality');

    console.log(pc.dim('  Comparing dimensions...'));

    const dimResults = await compareDimensions(sampleTexts, clusterAssignment, [256, 1024, 2048]);

    console.log('');
    displayDimensionTable(dimResults);
    console.log('');

    theory(verbose,
      'Matryoshka Representation Learning (MRL) trains the model so that',
      'the first N dimensions of any embedding are a valid embedding on their own.',
      'Like a matryoshka doll, smaller representations nest inside larger ones.',
      '',
      'This means you can choose your dimension at query time:',
      '  \u2022 256 dims: Fast, small \u2014 great for filtering or approximate matching',
      '  \u2022 1024 dims: Balanced \u2014 good default for most applications',
      '  \u2022 2048 dims: Maximum quality \u2014 when precision matters most',
    );

    // 6. Step 3: Interactive REPL (DEMO-05)
    if (interactive) {
      console.log(pc.cyan('  -- Try it yourself --'));
      console.log('');
      console.log('  Type any text to see how similar it is to the sample texts.');
      console.log(`  ${pc.dim('Type /quit to exit.')}`);
      console.log('');

      await new Promise((resolve) => {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
          prompt: pc.cyan('  nano> '),
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
            const userResult = await generateLocalEmbeddings([input], { dimensions: 1024 });
            const userEmb = userResult.data[0].embedding;

            // Compare against cached sample embeddings
            const ranked = sampleTexts.map((text, idx) => ({
              text,
              label: labels[idx],
              score: cosineSimilarity(userEmb, embeddings[idx]),
            }));

            ranked.sort((a, b) => b.score - a.score);

            console.log('');
            for (let i = 0; i < Math.min(5, ranked.length); i++) {
              const r = ranked[i];
              const rank = pc.bold(`#${i + 1}`);
              const score = pc.dim(r.score.toFixed(4));
              const shortText = r.text.length > 60 ? r.text.slice(0, 57) + '...' : r.text;
              console.log(`  ${rank}  ${score}  "${shortText}"`);
            }
            console.log('');
          } catch (err) {
            console.log(`  ${pc.yellow('Warning:')} ${err.message}`);
            console.log('');
          }

          rl.prompt();
        });

        rl.on('close', resolve);
        rl.on('SIGINT', () => { console.log(''); rl.close(); });
      });
    }

    // 7. Step 4: Shared Embedding Space Proof (DEMO-06)
    const apiKey = process.env.VOYAGE_API_KEY || getConfigValue('apiKey');

    if (apiKey) {
      try {
        // Lazy require -- avoid loading api.js if no API key
        const { generateEmbeddings } = require('../lib/api');

        console.log('');
        console.log(pc.cyan('  -- Bonus: Shared Embedding Space --'));
        console.log('');
        console.log('  API key detected -- comparing nano vs API rankings.');
        console.log('');

        theory(verbose,
          'voyage-4-nano and voyage-4-large share the same embedding space.',
          'Vectors from either model can be compared with cosine similarity.',
          'This means you can use nano for local development and the API for',
          'production -- the similarity rankings should be nearly identical.',
        );

        // Pick 3 query texts (one per cluster): indices 0, 3, 6
        const queryIndices = [0, 3, 6];

        // Cache API document embeddings (reused across all 3 queries)
        let apiDocEmbeddings = null;

        for (const qi of queryIndices) {
          const queryText = sampleTexts[qi];
          const queryLabel = labels[qi];

          // Nano rankings: use cached embeddings
          const nanoRanked = sampleTexts.map((text, idx) => ({
            label: labels[idx],
            score: cosineSimilarity(embeddings[qi], embeddings[idx]),
          }));
          nanoRanked.sort((a, b) => b.score - a.score);

          // API rankings
          const apiQueryResult = await generateEmbeddings([queryText], {
            model: 'voyage-4-large',
            inputType: 'query',
          });
          const apiQueryEmb = apiQueryResult.data[0].embedding;

          if (!apiDocEmbeddings) {
            const apiDocResult = await generateEmbeddings(sampleTexts, {
              model: 'voyage-4-large',
              inputType: 'document',
            });
            apiDocEmbeddings = apiDocResult.data.map(d => d.embedding);
          }

          const apiRanked = sampleTexts.map((text, idx) => ({
            label: labels[idx],
            score: cosineSimilarity(apiQueryEmb, apiDocEmbeddings[idx]),
          }));
          apiRanked.sort((a, b) => b.score - a.score);

          // Display side-by-side
          console.log(`  Query: "${queryText}" ${pc.dim(`[${queryLabel}]`)}`);
          console.log('');
          console.log(`  ${'Rank'.padEnd(6)} ${'Nano'.padEnd(20)} ${'API (voyage-4-large)'.padEnd(20)} ${'Match'}`);
          console.log(`  ${'----'.padEnd(6)} ${'----'.padEnd(20)} ${'--------------------'.padEnd(20)} ${'-----'}`);

          for (let i = 0; i < 5; i++) {
            const nanoLabel = nanoRanked[i].label;
            const apiLabel = apiRanked[i].label;
            const match = nanoLabel === apiLabel ? pc.green('=') : pc.dim('-');
            console.log(`  ${String(i + 1).padEnd(6)} ${nanoLabel.padEnd(20)} ${apiLabel.padEnd(20)} ${match}`);
          }
          console.log('');
        }
      } catch (err) {
        console.log(pc.dim('  API comparison unavailable: ' + err.message));
        console.log('');
      }
    }

    // 8. Step 5: Next Steps + Telemetry
    console.log(pc.cyan('  -- Next Steps --'));
    console.log('');
    console.log('  Try nano in your workflow:');
    console.log(`    ${pc.dim('vai nano status')}          Check your nano setup`);
    console.log(`    ${pc.dim('vai nano test')}            Run a quick embedding test`);
    console.log(`    ${pc.dim('vai demo code-search')}     Try code search with the API`);
    console.log(`    ${pc.dim('vai demo chat')}            Try RAG chat with the API`);
    console.log('');

    if (telemetry && telemetry.send) {
      telemetry.send('demo_nano_completed', { duration: Date.now() - demoStart });
    }
  } finally {
    await getBridgeManager().shutdown();
  }
}

module.exports = { runNanoDemo };
