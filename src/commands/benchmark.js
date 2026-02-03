'use strict';

const fs = require('fs');
const { generateEmbeddings, apiRequest } = require('../lib/api');
const { cosineSimilarity } = require('../lib/math');
const { MODEL_CATALOG, getDefaultModel, DEFAULT_RERANK_MODEL } = require('../lib/catalog');
const ui = require('../lib/ui');

// ── Built-in sample corpus for zero-config benchmarks ──

const SAMPLE_TEXTS = [
  'MongoDB Atlas provides a fully managed cloud database service with built-in vector search capabilities.',
  'Kubernetes orchestrates containerized applications across clusters of machines for high availability.',
  'Machine learning models transform raw data into embeddings that capture semantic meaning.',
  'RESTful APIs use HTTP methods like GET, POST, PUT, and DELETE to manage resources.',
  'Natural language processing enables computers to understand and generate human language.',
  'Vector databases store high-dimensional embeddings and support fast nearest-neighbor search.',
  'Microservices architecture breaks applications into small, independently deployable services.',
  'Retrieval-augmented generation combines search with language models for grounded answers.',
  'TLS encryption protects data in transit between clients and servers using certificate-based authentication.',
  'GraphQL provides a flexible query language that lets clients request exactly the data they need.',
];

const SAMPLE_QUERY = 'How do I search for similar documents using embeddings?';

const SAMPLE_RERANK_DOCS = [
  'Vector search finds documents by computing similarity between embedding vectors in high-dimensional space.',
  'MongoDB Atlas Vector Search lets you index and query vector embeddings alongside your operational data.',
  'Traditional full-text search uses inverted indexes to match keyword terms in documents.',
  'Cosine similarity measures the angle between two vectors, commonly used for semantic search.',
  'Database sharding distributes data across multiple servers for horizontal scalability.',
  'Embedding models convert text into dense numerical vectors that capture meaning.',
  'SQL JOIN operations combine rows from two or more tables based on related columns.',
  'Approximate nearest neighbor algorithms like HNSW enable fast similarity search at scale.',
  'Load balancers distribute network traffic across multiple servers to ensure reliability.',
  'Reranking models rescore initial search results to improve relevance ordering.',
];

// ── Helpers ──

/**
 * Parse a comma-separated list of model names.
 */
function parseModels(val) {
  return val.split(',').map(m => m.trim()).filter(Boolean);
}

/**
 * Compute percentile from sorted array.
 */
function percentile(sorted, p) {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

/**
 * Strip ANSI escape codes from a string for width calculations.
 */
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*m/g;
function stripAnsi(str) {
  return String(str).replace(ANSI_RE, '');
}

/**
 * Format milliseconds with color.
 */
function fmtMs(ms) {
  const s = ms.toFixed(0) + 'ms';
  if (ms < 200) return ui.green(s);
  if (ms < 500) return ui.yellow(s);
  return ui.red(s);
}

/**
 * Right-pad a (possibly ANSI-colored) string to a visible width.
 */
function rpad(str, width) {
  const s = String(str);
  const visible = stripAnsi(s).length;
  return s + ' '.repeat(Math.max(0, width - visible));
}

/**
 * Left-pad a (possibly ANSI-colored) string to a visible width.
 */
function lpad(str, width) {
  const s = String(str);
  const visible = stripAnsi(s).length;
  return ' '.repeat(Math.max(0, width - visible)) + s;
}

/**
 * Load texts from a file (JSON array or newline-delimited).
 */
function loadTexts(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8').trim();
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed.map(item => (typeof item === 'string') ? item : (item.text || JSON.stringify(item)));
    }
  } catch { /* not JSON */ }
  return content.split('\n').filter(line => line.trim());
}

/**
 * Run a single timed embedding request.
 */
async function timedEmbed(texts, model, inputType, dimensions) {
  const opts = { model };
  if (inputType) opts.inputType = inputType;
  if (dimensions) opts.dimensions = dimensions;

  const start = performance.now();
  const result = await generateEmbeddings(texts, opts);
  const elapsed = performance.now() - start;

  return {
    elapsed,
    tokens: result.usage?.total_tokens || 0,
    dimensions: result.data?.[0]?.embedding?.length || 0,
    embeddings: result.data?.map(d => d.embedding),
    model: result.model,
  };
}

/**
 * Run a single timed rerank request.
 */
async function timedRerank(query, documents, model, topK) {
  const body = { query, documents, model };
  if (topK) body.top_k = topK;

  const start = performance.now();
  const result = await apiRequest('/rerank', body);
  const elapsed = performance.now() - start;

  return {
    elapsed,
    tokens: result.usage?.total_tokens || 0,
    results: result.data || [],
    model: result.model,
  };
}

/**
 * Get price per 1M tokens for a model from catalog.
 */
function getPrice(modelName) {
  const entry = MODEL_CATALOG.find(m => m.name === modelName);
  if (!entry) return null;
  const match = entry.price.match(/\$([0-9.]+)\/1M/);
  return match ? parseFloat(match[1]) : null;
}

// ── Subcommands ──

/**
 * benchmark embed — Latency & throughput comparison across embedding models.
 */
async function benchmarkEmbed(opts) {
  const models = opts.models ? parseModels(opts.models) : ['voyage-4-large', 'voyage-4', 'voyage-4-lite'];
  const rounds = parseInt(opts.rounds, 10) || 5;
  const inputType = opts.inputType || 'document';
  const dimensions = opts.dimensions ? parseInt(opts.dimensions, 10) : undefined;

  let texts;
  if (opts.input) {
    texts = [opts.input];
  } else if (opts.file) {
    texts = loadTexts(opts.file);
  } else {
    texts = SAMPLE_TEXTS;
  }

  if (!opts.json && !opts.quiet) {
    console.log('');
    console.log(ui.bold('  Embedding Benchmark'));
    console.log(ui.dim(`  ${texts.length} text(s) × ${rounds} rounds × ${models.length} model(s)`));
    if (dimensions) console.log(ui.dim(`  Output dimensions: ${dimensions}`));
    console.log('');
  }

  const results = [];

  for (const model of models) {
    const latencies = [];
    let totalTokens = 0;
    let dims = 0;

    const spin = (!opts.json && !opts.quiet) ? ui.spinner(`  Benchmarking ${model}...`) : null;
    if (spin) spin.start();

    for (let i = 0; i < rounds; i++) {
      try {
        const r = await timedEmbed(texts, model, inputType, dimensions);
        latencies.push(r.elapsed);
        totalTokens = r.tokens;  // same per call for same input
        dims = r.dimensions;
      } catch (err) {
        if (spin) spin.stop();
        console.error(ui.warn(`  ${model}: ${err.message} — skipping`));
        break;
      }
    }

    if (spin) spin.stop();

    if (latencies.length === 0) continue;

    const sorted = [...latencies].sort((a, b) => a - b);
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const price = getPrice(model);

    results.push({
      model,
      rounds: latencies.length,
      avg,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      tokens: totalTokens,
      dimensions: dims,
      pricePerMillion: price,
      costEstimate: price ? (totalTokens / 1_000_000) * price : null,
    });
  }

  if (opts.json) {
    console.log(JSON.stringify({ benchmark: 'embed', texts: texts.length, rounds, results }, null, 2));
    return;
  }

  if (results.length === 0) {
    console.error(ui.error('No models completed successfully.'));
    process.exit(1);
  }

  // Display table
  const header = `  ${rpad('Model', 24)} ${lpad('Avg', 8)} ${lpad('p50', 8)} ${lpad('p95', 8)} ${lpad('Min', 8)} ${lpad('Max', 8)} ${lpad('Dims', 6)} ${lpad('Tokens', 7)} ${lpad('$/1M tok', 9)}`;
  console.log(ui.dim(header));
  console.log(ui.dim('  ' + '─'.repeat(header.length - 2)));

  // Sort by avg latency
  results.sort((a, b) => a.avg - b.avg);
  const fastest = results[0].avg;

  for (const r of results) {
    const badge = r.avg === fastest ? ui.green(' ⚡') : '   ';
    const priceStr = r.pricePerMillion != null ? `$${r.pricePerMillion.toFixed(2)}` : 'N/A';
    console.log(
      `  ${rpad(r.model, 24)} ${lpad(fmtMs(r.avg), 8)} ${lpad(fmtMs(r.p50), 8)} ${lpad(fmtMs(r.p95), 8)} ${lpad(fmtMs(r.min), 8)} ${lpad(fmtMs(r.max), 8)} ${lpad(String(r.dimensions), 6)} ${lpad(String(r.tokens), 7)} ${lpad(priceStr, 9)}${badge}`
    );
  }

  console.log('');

  // Verdict
  const cheapest = [...results].sort((a, b) => (a.pricePerMillion || 999) - (b.pricePerMillion || 999))[0];
  if (results.length > 1) {
    console.log(ui.success(`Fastest: ${ui.bold(results[0].model)} (${results[0].avg.toFixed(0)}ms avg)`));
    if (cheapest.model !== results[0].model) {
      console.log(ui.info(`Cheapest: ${ui.bold(cheapest.model)} ($${cheapest.pricePerMillion?.toFixed(2)}/1M tokens)`));
    }
  }
  console.log('');

  // Save results
  if (opts.save) {
    const outData = { benchmark: 'embed', timestamp: new Date().toISOString(), texts: texts.length, rounds, results };
    const outPath = typeof opts.save === 'string' ? opts.save : `benchmark-embed-${Date.now()}.json`;
    fs.writeFileSync(outPath, JSON.stringify(outData, null, 2));
    console.log(ui.info(`Results saved to ${outPath}`));
    console.log('');
  }
}

/**
 * benchmark rerank — Compare reranking models.
 */
async function benchmarkRerank(opts) {
  const models = opts.models ? parseModels(opts.models) : ['rerank-2.5', 'rerank-2.5-lite'];
  const rounds = parseInt(opts.rounds, 10) || 5;
  const query = opts.query || SAMPLE_QUERY;
  const topK = opts.topK ? parseInt(opts.topK, 10) : undefined;

  let documents;
  if (opts.documentsFile) {
    documents = loadTexts(opts.documentsFile);
  } else {
    documents = SAMPLE_RERANK_DOCS;
  }

  if (!opts.json && !opts.quiet) {
    console.log('');
    console.log(ui.bold('  Rerank Benchmark'));
    console.log(ui.dim(`  ${documents.length} docs × ${rounds} rounds × ${models.length} model(s)`));
    console.log(ui.dim(`  Query: "${query.substring(0, 60)}${query.length > 60 ? '...' : ''}"`));
    if (topK) console.log(ui.dim(`  Top-K: ${topK}`));
    console.log('');
  }

  const allResults = [];

  for (const model of models) {
    const latencies = [];
    let totalTokens = 0;
    let lastRankResults = [];

    const spin = (!opts.json && !opts.quiet) ? ui.spinner(`  Benchmarking ${model}...`) : null;
    if (spin) spin.start();

    for (let i = 0; i < rounds; i++) {
      try {
        const r = await timedRerank(query, documents, model, topK);
        latencies.push(r.elapsed);
        totalTokens = r.tokens;
        lastRankResults = r.results;
      } catch (err) {
        if (spin) spin.stop();
        console.error(ui.warn(`  ${model}: ${err.message} — skipping`));
        break;
      }
    }

    if (spin) spin.stop();

    if (latencies.length === 0) continue;

    const sorted = [...latencies].sort((a, b) => a - b);
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const price = getPrice(model);

    allResults.push({
      model,
      rounds: latencies.length,
      avg,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      tokens: totalTokens,
      pricePerMillion: price,
      topResults: lastRankResults.slice(0, topK || 5),
      rankOrder: lastRankResults.map(r => r.index),
    });
  }

  if (opts.json) {
    console.log(JSON.stringify({ benchmark: 'rerank', query, documents: documents.length, rounds, results: allResults }, null, 2));
    return;
  }

  if (allResults.length === 0) {
    console.error(ui.error('No models completed successfully.'));
    process.exit(1);
  }

  // Latency table
  const header = `  ${rpad('Model', 22)} ${lpad('Avg', 8)} ${lpad('p50', 8)} ${lpad('p95', 8)} ${lpad('Min', 8)} ${lpad('Max', 8)} ${lpad('Tokens', 7)} ${lpad('$/1M tok', 9)}`;
  console.log(ui.dim(header));
  console.log(ui.dim('  ' + '─'.repeat(header.length - 2)));

  allResults.sort((a, b) => a.avg - b.avg);
  const fastest = allResults[0].avg;

  for (const r of allResults) {
    const badge = r.avg === fastest ? ui.green(' ⚡') : '   ';
    const priceStr = r.pricePerMillion != null ? `$${r.pricePerMillion.toFixed(2)}` : 'N/A';
    console.log(
      `  ${rpad(r.model, 22)} ${lpad(fmtMs(r.avg), 8)} ${lpad(fmtMs(r.p50), 8)} ${lpad(fmtMs(r.p95), 8)} ${lpad(fmtMs(r.min), 8)} ${lpad(fmtMs(r.max), 8)} ${lpad(String(r.tokens), 7)} ${lpad(priceStr, 9)}${badge}`
    );
  }

  console.log('');

  // Compare ranking order if multiple models
  if (allResults.length > 1) {
    console.log(ui.bold('  Ranking Comparison (top 5)'));
    console.log('');

    const showK = Math.min(topK || 5, 5);
    for (let rank = 0; rank < showK; rank++) {
      const parts = allResults.map(r => {
        const item = r.topResults[rank];
        if (!item) return ui.dim('—');
        const docIdx = item.index;
        const score = item.relevance_score;
        const preview = documents[docIdx].substring(0, 40) + (documents[docIdx].length > 40 ? '...' : '');
        return `[${docIdx}] ${score.toFixed(3)} ${ui.dim(preview)}`;
      });

      console.log(ui.dim(`  #${rank + 1}`));
      allResults.forEach((r, i) => {
        console.log(`    ${ui.cyan(rpad(r.model, 20))} ${parts[i]}`);
      });
    }

    // Check if top-5 ordering agrees
    const orders = allResults.map(r => r.rankOrder.slice(0, 5).join(','));
    const allAgree = orders.every(o => o === orders[0]);
    console.log('');
    if (allAgree) {
      console.log(ui.info('Models agree on top-5 ranking — cheaper model may be sufficient.'));
    } else {
      console.log(ui.warn('Models disagree on ranking — premium model may capture nuances the lite model misses.'));
    }
  }

  console.log('');
  console.log(ui.success(`Fastest: ${ui.bold(allResults[0].model)} (${allResults[0].avg.toFixed(0)}ms avg)`));
  console.log('');

  // Save results
  if (opts.save) {
    const outData = { benchmark: 'rerank', timestamp: new Date().toISOString(), query, documents: documents.length, rounds, results: allResults };
    const outPath = typeof opts.save === 'string' ? opts.save : `benchmark-rerank-${Date.now()}.json`;
    fs.writeFileSync(outPath, JSON.stringify(outData, null, 2));
    console.log(ui.info(`Results saved to ${outPath}`));
    console.log('');
  }
}

/**
 * benchmark similarity — Compare how different models rank the same corpus.
 */
async function benchmarkSimilarity(opts) {
  const models = opts.models ? parseModels(opts.models) : ['voyage-4-large', 'voyage-4', 'voyage-4-lite'];
  const query = opts.query || SAMPLE_QUERY;
  const dimensions = opts.dimensions ? parseInt(opts.dimensions, 10) : undefined;
  const showK = opts.topK ? parseInt(opts.topK, 10) : 5;

  let corpus;
  if (opts.file) {
    corpus = loadTexts(opts.file);
  } else {
    corpus = SAMPLE_RERANK_DOCS;
  }

  if (!opts.json && !opts.quiet) {
    console.log('');
    console.log(ui.bold('  Similarity Benchmark'));
    console.log(ui.dim(`  Query: "${query.substring(0, 60)}${query.length > 60 ? '...' : ''}"`));
    console.log(ui.dim(`  ${corpus.length} documents × ${models.length} model(s)`));
    if (dimensions) console.log(ui.dim(`  Dimensions: ${dimensions}`));
    console.log('');
  }

  const allResults = [];

  for (const model of models) {
    const spin = (!opts.json && !opts.quiet) ? ui.spinner(`  Embedding with ${model}...`) : null;
    if (spin) spin.start();

    try {
      const allTexts = [query, ...corpus];
      const embedOpts = { model, inputType: 'document' };
      if (dimensions) embedOpts.dimensions = dimensions;

      const result = await generateEmbeddings(allTexts, embedOpts);
      if (spin) spin.stop();

      const embeddings = result.data.map(d => d.embedding);
      const queryEmbed = embeddings[0];

      const ranked = corpus.map((text, i) => ({
        index: i,
        text,
        similarity: cosineSimilarity(queryEmbed, embeddings[i + 1]),
      })).sort((a, b) => b.similarity - a.similarity);

      allResults.push({
        model: result.model || model,
        tokens: result.usage?.total_tokens || 0,
        ranked,
      });
    } catch (err) {
      if (spin) spin.stop();
      console.error(ui.warn(`  ${model}: ${err.message} — skipping`));
    }
  }

  if (opts.json) {
    console.log(JSON.stringify({ benchmark: 'similarity', query, corpus: corpus.length, results: allResults }, null, 2));
    return;
  }

  if (allResults.length === 0) {
    console.error(ui.error('No models completed successfully.'));
    process.exit(1);
  }

  // Show side-by-side rankings
  console.log(ui.bold(`  Top ${showK} results by model`));
  console.log('');

  for (let rank = 0; rank < showK && rank < corpus.length; rank++) {
    console.log(ui.dim(`  #${rank + 1}`));
    for (const r of allResults) {
      const item = r.ranked[rank];
      const preview = item.text.substring(0, 50) + (item.text.length > 50 ? '...' : '');
      console.log(`    ${ui.cyan(rpad(r.model, 20))} ${ui.score(item.similarity)}  [${item.index}] ${ui.dim(preview)}`);
    }
  }

  console.log('');

  // Measure agreement
  if (allResults.length > 1) {
    const orders = allResults.map(r => r.ranked.slice(0, showK).map(x => x.index).join(','));
    const allAgree = orders.every(o => o === orders[0]);

    if (allAgree) {
      console.log(ui.info(`All models agree on top-${showK} ranking — cheaper model is likely sufficient for your data.`));
    } else {
      // Compute overlap
      const sets = allResults.map(r => new Set(r.ranked.slice(0, showK).map(x => x.index)));
      const intersection = [...sets[0]].filter(idx => sets.every(s => s.has(idx)));
      const overlapPct = ((intersection.length / showK) * 100).toFixed(0);
      console.log(ui.warn(`Models share ${overlapPct}% of top-${showK} results — differences may matter for your use case.`));
    }
    console.log('');
  }
}

/**
 * benchmark cost — Project costs at different query volumes.
 */
async function benchmarkCost(opts) {
  const models = opts.models
    ? parseModels(opts.models)
    : MODEL_CATALOG.filter(m => !m.legacy && m.type === 'embedding').map(m => m.name);

  let tokensPerQuery;
  if (opts.file) {
    const texts = loadTexts(opts.file);
    // Estimate tokens (rough: 1 token ≈ 4 chars for English)
    const totalChars = texts.reduce((sum, t) => sum + t.length, 0);
    tokensPerQuery = Math.ceil(totalChars / 4);
    if (!opts.json && !opts.quiet) {
      console.log('');
      console.log(ui.dim(`  Estimated ~${tokensPerQuery} tokens from ${texts.length} text(s) in file`));
    }
  } else {
    tokensPerQuery = parseInt(opts.tokens, 10) || 500;
  }

  const volumes = opts.volumes
    ? opts.volumes.split(',').map(v => parseInt(v.trim(), 10))
    : [100, 1000, 10000, 100000];

  if (!opts.json && !opts.quiet) {
    console.log('');
    console.log(ui.bold('  Cost Projection'));
    console.log(ui.dim(`  ~${tokensPerQuery} tokens per query`));
    console.log('');
  }

  const costData = [];

  for (const model of models) {
    const price = getPrice(model);
    if (price == null) continue;

    const entry = { model, pricePerMillion: price, volumes: {} };
    for (const vol of volumes) {
      const dailyTokens = tokensPerQuery * vol;
      const dailyCost = (dailyTokens / 1_000_000) * price;
      const monthlyCost = dailyCost * 30;
      entry.volumes[vol] = { dailyCost, monthlyCost };
    }
    costData.push(entry);
  }

  if (opts.json) {
    console.log(JSON.stringify({ benchmark: 'cost', tokensPerQuery, volumes, models: costData }, null, 2));
    return;
  }

  // Build header
  const volHeaders = volumes.map(v => {
    if (v >= 1000) return `${v / 1000}K/day`;
    return `${v}/day`;
  });

  const headerParts = [`  ${rpad('Model', 24)} ${lpad('$/1M', 7)}`];
  for (const vh of volHeaders) {
    headerParts.push(lpad(vh, 12));
  }
  const header = headerParts.join('');

  console.log(ui.dim(header));
  console.log(ui.dim('  ' + '─'.repeat(header.length - 2)));

  // Sort by price
  costData.sort((a, b) => a.pricePerMillion - b.pricePerMillion);

  for (const entry of costData) {
    const parts = [`  ${rpad(entry.model, 24)} ${lpad('$' + entry.pricePerMillion.toFixed(2), 7)}`];
    for (const vol of volumes) {
      const monthly = entry.volumes[vol].monthlyCost;
      let costStr;
      if (monthly < 0.01) costStr = '<$0.01';
      else if (monthly < 1) costStr = `$${monthly.toFixed(2)}`;
      else if (monthly < 100) costStr = `$${monthly.toFixed(1)}`;
      else costStr = `$${monthly.toFixed(0)}`;
      parts.push(lpad(costStr + '/mo', 12));
    }
    console.log(parts.join(''));
  }

  console.log('');
  console.log(ui.dim('  Costs are estimates based on published per-token pricing.'));
  console.log('');
}

/**
 * benchmark batch — Measure throughput at different batch sizes.
 */
async function benchmarkBatch(opts) {
  const model = opts.model || getDefaultModel();
  const batchSizes = opts.batchSizes
    ? opts.batchSizes.split(',').map(v => parseInt(v.trim(), 10))
    : [1, 5, 10, 25, 50];
  const rounds = parseInt(opts.rounds, 10) || 3;

  // Build a pool of texts
  let pool;
  if (opts.file) {
    pool = loadTexts(opts.file);
  } else {
    // Repeat sample texts to fill larger batches
    pool = [];
    while (pool.length < Math.max(...batchSizes)) {
      pool.push(...SAMPLE_TEXTS);
    }
  }

  if (!opts.json && !opts.quiet) {
    console.log('');
    console.log(ui.bold('  Batch Throughput Benchmark'));
    console.log(ui.dim(`  Model: ${model}`));
    console.log(ui.dim(`  Batch sizes: ${batchSizes.join(', ')} × ${rounds} rounds`));
    console.log('');
  }

  const results = [];

  for (const size of batchSizes) {
    const texts = pool.slice(0, size);
    if (texts.length < size) {
      console.error(ui.warn(`  Not enough texts for batch size ${size} (have ${pool.length}) — skipping`));
      continue;
    }

    const latencies = [];
    let totalTokens = 0;

    const spin = (!opts.json && !opts.quiet) ? ui.spinner(`  Batch size ${size}...`) : null;
    if (spin) spin.start();

    for (let i = 0; i < rounds; i++) {
      try {
        const r = await timedEmbed(texts, model, 'document');
        latencies.push(r.elapsed);
        totalTokens = r.tokens;
      } catch (err) {
        if (spin) spin.stop();
        console.error(ui.warn(`  Batch ${size}: ${err.message} — skipping`));
        break;
      }
    }

    if (spin) spin.stop();
    if (latencies.length === 0) continue;

    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const textsPerSec = (size / (avg / 1000));
    const tokensPerSec = totalTokens / (avg / 1000);

    results.push({
      batchSize: size,
      avgLatency: avg,
      textsPerSec,
      tokensPerSec,
      tokens: totalTokens,
    });
  }

  if (opts.json) {
    console.log(JSON.stringify({ benchmark: 'batch', model, rounds, results }, null, 2));
    return;
  }

  if (results.length === 0) {
    console.error(ui.error('No batch sizes completed successfully.'));
    process.exit(1);
  }

  const header = `  ${rpad('Batch Size', 12)} ${lpad('Avg Latency', 12)} ${lpad('Texts/sec', 12)} ${lpad('Tokens/sec', 12)} ${lpad('Tokens', 8)}`;
  console.log(ui.dim(header));
  console.log(ui.dim('  ' + '─'.repeat(header.length - 2)));

  for (const r of results) {
    console.log(
      `  ${rpad(String(r.batchSize), 12)} ${lpad(fmtMs(r.avgLatency), 12)} ${lpad(r.textsPerSec.toFixed(1), 12)} ${lpad(r.tokensPerSec.toFixed(0), 12)} ${lpad(String(r.tokens), 8)}`
    );
  }

  console.log('');

  // Throughput verdict
  const best = [...results].sort((a, b) => b.textsPerSec - a.textsPerSec)[0];
  console.log(ui.success(`Best throughput: batch size ${best.batchSize} (${best.textsPerSec.toFixed(1)} texts/sec)`));
  console.log('');
}

// ── Registration ──

/**
 * Register the benchmark command tree on a Commander program.
 * @param {import('commander').Command} program
 */
function registerBenchmark(program) {
  const bench = program
    .command('benchmark')
    .alias('bench')
    .description('Benchmark models to choose the right one for your use case');

  // ── benchmark embed ──
  bench
    .command('embed')
    .description('Compare embedding model latency, throughput, and cost')
    .option('--models <models>', 'Comma-separated model names', 'voyage-4-large,voyage-4,voyage-4-lite')
    .option('-r, --rounds <n>', 'Number of rounds per model', '5')
    .option('-i, --input <text>', 'Custom input text')
    .option('-f, --file <path>', 'Load texts from file (JSON array or newline-delimited)')
    .option('-t, --input-type <type>', 'Input type: query or document', 'document')
    .option('-d, --dimensions <n>', 'Output dimensions')
    .option('--json', 'Machine-readable JSON output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .option('-s, --save [path]', 'Save results to JSON file')
    .action(benchmarkEmbed);

  // ── benchmark rerank ──
  bench
    .command('rerank')
    .description('Compare reranking model latency and ranking quality')
    .option('--models <models>', 'Comma-separated rerank model names', 'rerank-2.5,rerank-2.5-lite')
    .option('-r, --rounds <n>', 'Number of rounds per model', '5')
    .option('--query <text>', 'Search query')
    .option('--documents-file <path>', 'File with documents to rerank')
    .option('-k, --top-k <n>', 'Return top K results')
    .option('--json', 'Machine-readable JSON output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .option('-s, --save [path]', 'Save results to JSON file')
    .action(benchmarkRerank);

  // ── benchmark similarity ──
  bench
    .command('similarity')
    .description('Compare how different models rank the same corpus')
    .option('--models <models>', 'Comma-separated embedding model names', 'voyage-4-large,voyage-4,voyage-4-lite')
    .option('--query <text>', 'Search query')
    .option('-f, --file <path>', 'Corpus file (JSON array or newline-delimited)')
    .option('-k, --top-k <n>', 'Show top K results', '5')
    .option('-d, --dimensions <n>', 'Output dimensions')
    .option('--json', 'Machine-readable JSON output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(benchmarkSimilarity);

  // ── benchmark cost ──
  bench
    .command('cost')
    .description('Project monthly costs at different query volumes')
    .option('--models <models>', 'Comma-separated model names (default: all current embedding models)')
    .option('--tokens <n>', 'Estimated tokens per query', '500')
    .option('-f, --file <path>', 'Estimate tokens from file contents')
    .option('--volumes <list>', 'Comma-separated daily query volumes', '100,1000,10000,100000')
    .option('--json', 'Machine-readable JSON output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(benchmarkCost);

  // ── benchmark batch ──
  bench
    .command('batch')
    .description('Measure throughput at different batch sizes')
    .option('-m, --model <model>', 'Embedding model to benchmark')
    .option('--batch-sizes <sizes>', 'Comma-separated batch sizes', '1,5,10,25,50')
    .option('-r, --rounds <n>', 'Number of rounds per batch size', '3')
    .option('-f, --file <path>', 'Load texts from file')
    .option('--json', 'Machine-readable JSON output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(benchmarkBatch);
}

module.exports = { registerBenchmark };
