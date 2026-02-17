'use strict';

const fs = require('fs');
const path = require('path');
const { executeWorkflow } = require('./workflow');

/**
 * Domain-to-workflow mapping. Each entry defines which workflows are compatible
 * with a given use-case domain, and how to map domain data into workflow inputs.
 */
const WORKFLOW_DOMAIN_MAP = {
  'rag-chat': {
    inputMapper: (domain, query) => ({
      question: query.query,
      collection: domain.collectionName,
      collection2: '',
      limit: 10,
      min_score: 0.3,
      system_prompt: 'You are a helpful assistant. Answer based on provided context. Cite sources.',
      chat_history: '',
    }),
    assertions: ['noErrors', 'stepsCompleted', 'nonEmptyOutput'],
  },
  'search-with-fallback': {
    inputMapper: (domain, query) => ({
      query: query.query,
      primary_collection: domain.collectionName,
      fallback_collection: domain.collectionName, // same collection for testing
    }),
    assertions: ['noErrors', 'stepsCompleted'],
  },
  'research-and-summarize': {
    inputMapper: (domain, query) => ({
      question: query.query,
      limit: 5,
    }),
    assertions: ['noErrors', 'stepsCompleted'],
  },
  'multi-collection-search': {
    inputMapper: (domain, query) => ({
      query: query.query,
      collection1: domain.collectionName,
      collection2: domain.collectionName,
      limit: 5,
    }),
    assertions: ['noErrors', 'stepsCompleted'],
  },
  'consistency-check': {
    inputMapper: (domain, _query) => ({
      topic: domain.title,
      collection1: domain.collectionName,
      collection2: domain.collectionName,
    }),
    assertions: ['noErrors'],
  },
  'cost-analysis': {
    inputMapper: (domain, _query) => ({
      docs: 100,
      queries: 500,
      months: 1,
    }),
    assertions: ['noErrors', 'stepsCompleted'],
  },
  'smart-ingest': {
    inputMapper: (domain, _query, sampleDocPath) => {
      // Use first sample doc content if available
      let text = 'This is a test document for integration testing.';
      if (sampleDocPath) {
        const docs = fs.readdirSync(sampleDocPath).filter(f => f.endsWith('.md'));
        if (docs.length > 0) {
          text = fs.readFileSync(path.join(sampleDocPath, docs[0]), 'utf8').slice(0, 2000);
        }
      }
      return {
        text,
        source: 'integration-test',
        threshold: 0.95,
      };
    },
    assertions: ['noErrors'],
  },
};

/**
 * Load a use-case domain dataset.
 *
 * @param {string} domainDataPath - Path to the use-case .ts/.json data file or parsed object
 * @returns {object} Parsed domain data with sampleDocs, exampleQueries, etc.
 */
function loadDomainData(domainData) {
  if (typeof domainData === 'object') return domainData;
  const raw = fs.readFileSync(domainData, 'utf8');
  return JSON.parse(raw);
}

/**
 * Seed a test collection by ingesting sample documents.
 *
 * @param {object} options
 * @param {string} options.sampleDocsPath - Path to folder of sample .md files
 * @param {string} options.dbName - Target database
 * @param {string} options.collectionName - Target collection
 * @param {string} [options.model] - Voyage model to use
 * @returns {Promise<{ docCount: number, collection: string }>}
 */
async function seedCollection({ sampleDocsPath, dbName, collectionName, model }) {
  const { connectAndClose } = require('./mongo');

  // Check if collection already has documents (skip re-seeding)
  const existingCount = await connectAndClose(dbName, collectionName, async (col) => {
    return col.countDocuments();
  });

  if (existingCount > 0) {
    return { docCount: existingCount, collection: collectionName, seeded: false };
  }

  // Read all .md files from sample docs
  const files = fs.readdirSync(sampleDocsPath).filter(f => f.endsWith('.md'));
  if (files.length === 0) {
    throw new Error(`No .md files found in ${sampleDocsPath}`);
  }

  const documents = files.map(f => ({
    text: fs.readFileSync(path.join(sampleDocsPath, f), 'utf8'),
    source: f,
    metadata: { filename: f },
  }));

  // Chunk and embed
  const { chunk } = require('./chunker');
  const { generateEmbeddings } = require('./api');

  const allChunks = [];
  for (const doc of documents) {
    const chunks = chunk(doc.text, { strategy: 'recursive', chunkSize: 512, chunkOverlap: 50 });
    for (const c of chunks) {
      allChunks.push({
        text: c.text || c,
        source: doc.source,
        metadata: doc.metadata,
      });
    }
  }

  // Embed in batches
  const batchSize = 128;
  const allEmbeddings = [];
  for (let i = 0; i < allChunks.length; i += batchSize) {
    const batch = allChunks.slice(i, i + batchSize);
    const texts = batch.map(c => c.text);
    const resp = await generateEmbeddings(texts, {
      model: model || 'voyage-3-lite',
      inputType: 'document',
    });
    allEmbeddings.push(...resp.data.map(d => d.embedding));
  }

  // Insert into MongoDB
  const docsToInsert = allChunks.map((c, i) => ({
    text: c.text,
    source: c.source,
    metadata: c.metadata,
    embedding: allEmbeddings[i],
  }));

  await connectAndClose(dbName, collectionName, async (col) => {
    await col.insertMany(docsToInsert);

    // Create vector search index if it doesn't exist
    try {
      const indexes = await col.listSearchIndexes().toArray();
      const hasIndex = indexes.some(idx => idx.name === 'vector_index');
      if (!hasIndex) {
        await col.createSearchIndex({
          name: 'vector_index',
          type: 'vectorSearch',
          definition: {
            fields: [{
              type: 'vector',
              path: 'embedding',
              numDimensions: allEmbeddings[0].length,
              similarity: 'cosine',
            }],
          },
        });
      }
    } catch {
      // May not be available on non-Atlas deployments
    }
  });

  return { docCount: docsToInsert.length, collection: collectionName, seeded: true };
}

/**
 * Check if a vector search index exists and is ready.
 * Optionally waits for it to become ready.
 *
 * @param {string} dbName
 * @param {string} collectionName
 * @param {object} [options]
 * @param {string} [options.indexName='vector_index']
 * @param {boolean} [options.wait=false] - Wait for index to become ready
 * @param {number} [options.timeoutMs=120000] - Max wait time
 * @param {function} [options.onProgress] - Progress callback
 * @returns {Promise<boolean>}
 */
async function checkVectorIndex(dbName, collectionName, options = {}) {
  const { indexName = 'vector_index', wait = false, timeoutMs = 120000, onProgress = () => {} } = options;
  const { getMongoCollection } = require('./mongo');

  const deadline = Date.now() + timeoutMs;

  while (true) {
    const { client, collection } = await getMongoCollection(dbName, collectionName);
    try {
      const indexes = await collection.listSearchIndexes().toArray();
      const idx = indexes.find(i => i.name === indexName);
      if (idx && idx.status === 'READY') return true;
      if (!wait || Date.now() >= deadline) return false;
      const status = idx ? idx.status : 'NOT_FOUND';
      onProgress({ phase: 'index', message: `Index status: ${status}, waiting...` });
    } catch {
      if (!wait || Date.now() >= deadline) return false;
    } finally {
      await client.close();
    }
    // Wait 5 seconds before checking again
    await new Promise(r => setTimeout(r, 5000));
  }
}

/**
 * Run integration tests for a domain against compatible workflows.
 *
 * @param {object} options
 * @param {object} options.domain - Domain data (from use-case data files)
 * @param {string} options.sampleDocsPath - Path to sample doc files
 * @param {string} options.workflowsDir - Path to workflow JSON definitions
 * @param {string[]} [options.workflows] - Specific workflow names to test (default: all compatible)
 * @param {boolean} [options.seed] - Whether to seed data first (default: true)
 * @param {boolean} [options.teardown] - Whether to drop test collections after (default: false)
 * @param {function} [options.onProgress] - Progress callback
 * @returns {Promise<IntegrationTestResults>}
 */
async function runIntegrationTests(options) {
  const {
    domain,
    sampleDocsPath,
    workflowsDir,
    workflows: requestedWorkflows,
    seed = true,
    teardown = false,
    onProgress = () => {},
  } = options;

  const testCollectionName = `vai_test_${domain.slug || domain.collectionName}`;
  const testDomain = { ...domain, collectionName: testCollectionName };
  const results = {
    domain: domain.slug || domain.title,
    collection: testCollectionName,
    seed: null,
    indexReady: false,
    workflows: [],
    summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
  };

  // Step 1: Seed
  if (seed && sampleDocsPath) {
    onProgress({ phase: 'seed', message: `Seeding ${testCollectionName}...` });
    try {
      results.seed = await seedCollection({
        sampleDocsPath,
        dbName: domain.dbName || 'vai_integration_test',
        collectionName: testCollectionName,
        model: domain.voyageModel,
      });
      onProgress({ phase: 'seed', message: `Seeded ${results.seed.docCount} chunks` });
    } catch (err) {
      results.seed = { error: err.message };
      onProgress({ phase: 'seed', message: `Seed failed: ${err.message}` });
      // Can't continue without data for most workflows
    }
  }

  // Step 2: Check vector index (wait up to 2 minutes for it to become ready)
  onProgress({ phase: 'index', message: 'Checking vector search index...' });
  results.indexReady = await checkVectorIndex(
    domain.dbName || 'vai_integration_test',
    testCollectionName,
    { wait: true, timeoutMs: 120000, onProgress }
  );
  if (!results.indexReady) {
    onProgress({ phase: 'index', message: 'WARNING: Vector index not ready — query-based workflows may fail' });
  } else {
    onProgress({ phase: 'index', message: 'Vector index ready' });
  }

  // Step 3: Run workflows
  const availableWorkflows = fs.readdirSync(workflowsDir)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));

  const workflowsToTest = requestedWorkflows
    ? requestedWorkflows.filter(w => availableWorkflows.includes(w) && WORKFLOW_DOMAIN_MAP[w])
    : availableWorkflows.filter(w => WORKFLOW_DOMAIN_MAP[w]);

  const queries = domain.exampleQueries || [];
  if (queries.length === 0) {
    queries.push({ query: domain.title, explanation: 'Fallback query from domain title' });
  }

  for (const wfName of workflowsToTest) {
    const mapping = WORKFLOW_DOMAIN_MAP[wfName];
    if (!mapping) {
      results.workflows.push({ name: wfName, status: 'skipped', reason: 'No domain mapping' });
      results.summary.skipped++;
      results.summary.total++;
      continue;
    }

    const wfPath = path.join(workflowsDir, `${wfName}.json`);
    const definition = JSON.parse(fs.readFileSync(wfPath, 'utf8'));

    // Test with first example query
    const testQuery = queries[0];
    const inputs = mapping.inputMapper(testDomain, testQuery, sampleDocsPath);

    onProgress({ phase: 'workflow', message: `Running ${wfName} with query: "${testQuery.query}"` });

    const wfResult = {
      name: wfName,
      query: testQuery.query,
      inputs,
      status: 'passed',
      steps: [],
      assertions: [],
      errors: [],
      durationMs: 0,
    };

    const start = Date.now();
    try {
      // Inject db and embedding model into workflow defaults so query/rerank
      // steps use the same model the documents were embedded with
      const testDefinition = {
        ...definition,
        defaults: {
          ...(definition.defaults || {}),
          db: domain.dbName || 'vai_integration_test',
          model: domain.voyageModel,
        },
      };
      const result = await executeWorkflow(testDefinition, {
        inputs,
        db: domain.dbName || 'vai_integration_test',
      });
      wfResult.durationMs = Date.now() - start;
      wfResult.steps = (result.steps || []).map(s => ({
        id: s.id,
        tool: s.tool,
        skipped: s.skipped || false,
        error: s.error || null,
        durationMs: s.durationMs,
      }));

      // Run assertions
      if (mapping.assertions.includes('noErrors')) {
        const errorSteps = (result.steps || []).filter(s => s.error);
        if (errorSteps.length > 0) {
          wfResult.assertions.push({
            pass: false,
            name: 'noErrors',
            message: `${errorSteps.length} step(s) errored: ${errorSteps.map(s => `${s.id}: ${s.error}`).join('; ')}`,
          });
          wfResult.status = 'failed';
        } else {
          wfResult.assertions.push({ pass: true, name: 'noErrors', message: 'All steps error-free' });
        }
      }

      if (mapping.assertions.includes('stepsCompleted')) {
        const completedSteps = (result.steps || []).filter(s => !s.skipped && !s.error);
        if (completedSteps.length === 0) {
          wfResult.assertions.push({ pass: false, name: 'stepsCompleted', message: 'No steps completed' });
          wfResult.status = 'failed';
        } else {
          wfResult.assertions.push({ pass: true, name: 'stepsCompleted', message: `${completedSteps.length} steps completed` });
        }
      }

      if (mapping.assertions.includes('nonEmptyOutput')) {
        const output = result.output || {};
        const hasContent = Object.values(output).some(v =>
          v && (typeof v === 'string' ? v.length > 0 : Array.isArray(v) ? v.length > 0 : true)
        );
        if (!hasContent) {
          wfResult.assertions.push({ pass: false, name: 'nonEmptyOutput', message: 'Output is empty' });
          wfResult.status = 'failed';
        } else {
          wfResult.assertions.push({ pass: true, name: 'nonEmptyOutput', message: 'Output has content' });
        }
      }

      // Check expected sources if the query has sampleResults
      if (testQuery.sampleResults && testQuery.sampleResults.length > 0 && result.output) {
        const outputStr = JSON.stringify(result.output).toLowerCase();
        const expectedSource = testQuery.sampleResults[0].source.toLowerCase();
        const baseName = expectedSource.replace('.md', '');
        const found = outputStr.includes(expectedSource) || outputStr.includes(baseName);
        wfResult.assertions.push({
          pass: found,
          name: 'expectedSource',
          message: found
            ? `Found expected source: ${testQuery.sampleResults[0].source}`
            : `Expected source "${testQuery.sampleResults[0].source}" not found in output (sources: ${
                (result.output.sources || []).map(s => s.source || s.filename || 'unknown').join(', ') || 'none'
              })`,
        });
        // Source matching is a soft signal — don't fail the whole test, just warn
        if (!found) wfResult.assertions[wfResult.assertions.length - 1].warn = true;
      }

    } catch (err) {
      wfResult.durationMs = Date.now() - start;
      wfResult.status = 'failed';
      wfResult.errors.push(err.message);
    }

    results.workflows.push(wfResult);
    results.summary.total++;
    if (wfResult.status === 'passed') results.summary.passed++;
    else if (wfResult.status === 'failed') results.summary.failed++;
    else results.summary.skipped++;
  }

  // Step 4: Teardown
  if (teardown) {
    onProgress({ phase: 'teardown', message: `Dropping ${testCollectionName}...` });
    try {
      const { connectAndClose } = require('./mongo');
      await connectAndClose(domain.dbName || 'vai_integration_test', testCollectionName, async (col) => {
        await col.drop();
      });
    } catch (err) {
      onProgress({ phase: 'teardown', message: `Teardown failed: ${err.message}` });
    }
  }

  return results;
}

module.exports = {
  WORKFLOW_DOMAIN_MAP,
  seedCollection,
  checkVectorIndex,
  runIntegrationTests,
};
