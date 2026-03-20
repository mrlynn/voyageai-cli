'use strict';

const { generateEmbeddings } = require('../api');
const { getMongoCollection } = require('../mongo');
const { loadConfig, saveConfig } = require('../config');
const { getDefaultDimensions } = require('../catalog');

/** Tag bundled KB docs so re-seed only removes our inserts, not user data in the same collection. */
const KB_BUNDLE_MARKER = 'vai-bundled';
const KB_MARKER_FIELD = '_kb';

const DEFAULT_DB = 'vai';
const DEFAULT_COLLECTION = 'vai_kb';
const DEFAULT_FIELD = 'embedding';
const DEFAULT_INDEX_NAME = 'vai_kb_vector_index';

/**
 * @param {object} manifest
 * @returns {Record<string, string>}
 */
function checksumFromManifest(manifest) {
  if (!Array.isArray(manifest.documents)) return {};
  return Object.fromEntries(manifest.documents.map((d) => [d.id, d.checksum]));
}

/**
 * Merge KB seeding metadata into global config under `kb` (SEED-05).
 * Does not touch `db` / `collection` top-level keys used for non-KB workflows.
 *
 * @param {object} params
 * @param {object} params.manifest
 * @param {'remote'|'bundled'} params.corpusSource
 * @param {string} params.db
 * @param {string} params.collection
 * @param {string} params.field
 * @param {string} params.indexName
 * @param {string} params.embeddingModel
 * @param {number} params.chunkCount
 * @param {Record<string, string>} [params.documentChecksums] - manifest doc id → checksum (incremental updates merge via full replace)
 * @param {string} [params.configPath]
 */
function persistKbSeedingState({
  manifest,
  corpusSource,
  db,
  collection,
  field,
  indexName,
  embeddingModel,
  chunkCount,
  documentChecksums,
  configPath,
}) {
  const config = loadConfig(configPath);
  const checksums =
    documentChecksums ||
    checksumFromManifest(manifest);
  config.kb = {
    ...(config.kb || {}),
    corpusSource,
    corpusVersion: manifest.version,
    db,
    collection,
    field,
    indexName,
    embeddingModel,
    lastSeededAt: new Date().toISOString(),
    chunkCount,
    documentChecksums: checksums,
  };
  saveConfig(config, configPath);
}

/**
 * After cost confirmation (31-01), embed chunks, store in MongoDB, create vector index, persist config.
 * Caller must not invoke this until `confirmKbSeedEmbeddingCost` has succeeded with ok: true.
 *
 * @param {object} params
 * @param {Array<{ text: string, metadata: object }>} params.chunks
 * @param {object} params.manifest
 * @param {'remote'|'bundled'} params.corpusSource
 * @param {string} params.model - embedding model (from cost gate)
 * @param {string} [params.db]
 * @param {string} [params.collection]
 * @param {string} [params.field]
 * @param {string} [params.indexName]
 * @param {number} [params.dimensions] - MRL output dimension (default from catalog)
 * @param {number} [params.batchSize]
 * @param {number} [params.storeBatchSize]
 * @param {boolean} [params.createIndex]
 * @param {string} [params.configPath]
 * @param {typeof generateEmbeddings} [params.generateEmbeddings]
 * @param {typeof getMongoCollection} [params.getMongoCollection]
 * @returns {Promise<{ insertedCount: number, totalApiTokens: number, indexCreated: boolean, numDimensions: number }>}
 */
async function runKbSeed({
  chunks,
  manifest,
  corpusSource,
  model,
  db = DEFAULT_DB,
  collection = DEFAULT_COLLECTION,
  field = DEFAULT_FIELD,
  indexName = DEFAULT_INDEX_NAME,
  dimensions,
  batchSize = 25,
  storeBatchSize = 100,
  createIndex = true,
  configPath,
  generateEmbeddings: genEmb = generateEmbeddings,
  getMongoCollection: getMongo = getMongoCollection,
}) {
  if (!chunks || chunks.length === 0) {
    throw new Error('runKbSeed: no chunks to embed');
  }

  const dims = dimensions != null ? dimensions : getDefaultDimensions();

  let client;
  const { client: c, collection: coll } = await getMongo(db, collection);
  client = c;

  try {
    await coll.deleteMany({ [KB_MARKER_FIELD]: KB_BUNDLE_MARKER });

    const embeddings = new Array(chunks.length);
    let totalApiTokens = 0;
    let embeddedCount = 0;

    for (let bi = 0; bi < chunks.length; bi += batchSize) {
      const batch = chunks.slice(bi, bi + batchSize);
      const texts = batch.map((x) => x.text);
      const embedOpts = { model, inputType: 'document', dimensions: dims };
      const result = await genEmb(texts, embedOpts);
      totalApiTokens += result.usage?.total_tokens || 0;
      for (let j = 0; j < result.data.length; j++) {
        embeddings[embeddedCount + j] = result.data[j].embedding;
      }
      embeddedCount += batch.length;
    }

    const numDimensions = embeddings[0]?.length || dims;

    const documents = chunks.map((chunk, i) => ({
      text: chunk.text,
      [field]: embeddings[i],
      metadata: chunk.metadata,
      [KB_MARKER_FIELD]: KB_BUNDLE_MARKER,
      _model: model,
      _embeddedAt: new Date(),
    }));

    let totalInserted = 0;
    for (let i = 0; i < documents.length; i += storeBatchSize) {
      const batch = documents.slice(i, i + storeBatchSize);
      const ins = await coll.insertMany(batch);
      totalInserted += ins.insertedCount;
    }

    let indexCreated = false;
    if (createIndex) {
      try {
        const indexDef = {
          name: indexName,
          type: 'vectorSearch',
          definition: {
            fields: [
              {
                type: 'vector',
                path: field,
                numDimensions,
                similarity: 'cosine',
              },
            ],
          },
        };
        await coll.createSearchIndex(indexDef);
        indexCreated = true;
      } catch (err) {
        if (err.message?.includes('already exists')) {
          indexCreated = false;
        } else {
          throw err;
        }
      }
    }

    persistKbSeedingState({
      manifest,
      corpusSource,
      db,
      collection,
      field,
      indexName,
      embeddingModel: model,
      chunkCount: chunks.length,
      configPath,
      documentChecksums: checksumFromManifest(manifest),
    });

    return {
      insertedCount: totalInserted,
      totalApiTokens,
      indexCreated,
      numDimensions,
    };
  } finally {
    if (client) await client.close();
  }
}

/**
 * Incremental KB update: remove chunks for changed/removed docs, embed+insert only changed docs.
 * @param {object} params
 * @param {string[]} params.changedDocumentIds
 * @param {string[]} params.removedDocumentIds
 * @param {object} params.manifest
 * @param {string} params.corpusRoot
 * @param {'remote'|'bundled'} params.corpusSource
 * @param {string} params.model
 * @param {string} [params.db]
 * @param {string} [params.collection]
 * @param {string} [params.field]
 * @param {string} [params.indexName]
 * @param {number} [params.dimensions]
 * @param {number} [params.batchSize]
 * @param {number} [params.storeBatchSize]
 * @param {string} [params.configPath]
 * @param {typeof generateEmbeddings} [params.generateEmbeddings]
 * @param {typeof getMongoCollection} [params.getMongoCollection]
 */
async function runKbIncrementalUpdate({
  changedDocumentIds,
  removedDocumentIds,
  manifest,
  corpusRoot,
  corpusSource,
  model,
  db = DEFAULT_DB,
  collection = DEFAULT_COLLECTION,
  field = DEFAULT_FIELD,
  indexName = DEFAULT_INDEX_NAME,
  dimensions,
  batchSize = 25,
  storeBatchSize = 100,
  configPath,
  generateEmbeddings: genEmb = generateEmbeddings,
  getMongoCollection: getMongo = getMongoCollection,
}) {
  const dims = dimensions != null ? dimensions : getDefaultDimensions();
  const changedSet = new Set(changedDocumentIds);
  const removed = removedDocumentIds || [];

  let client;
  const { client: c, collection: coll } = await getMongo(db, collection);
  client = c;

  try {
    if (removed.length) {
      await coll.deleteMany({
        [KB_MARKER_FIELD]: KB_BUNDLE_MARKER,
        'metadata.kbDocumentId': { $in: removed },
      });
    }
    for (const id of changedSet) {
      await coll.deleteMany({
        [KB_MARKER_FIELD]: KB_BUNDLE_MARKER,
        'metadata.kbDocumentId': id,
      });
    }

    const { buildKbChunkPlan } = require('./plan-kb-seed');
    const { chunks } = buildKbChunkPlan({
      manifest,
      corpusRoot,
      documentIds: changedSet,
    });

    let totalInserted = 0;
    let totalApiTokens = 0;

    if (chunks.length > 0) {
      const embeddings = new Array(chunks.length);
      let embeddedCount = 0;
      for (let bi = 0; bi < chunks.length; bi += batchSize) {
        const batch = chunks.slice(bi, bi + batchSize);
        const texts = batch.map((x) => x.text);
        const result = await genEmb(texts, {
          model,
          inputType: 'document',
          dimensions: dims,
        });
        totalApiTokens += result.usage?.total_tokens || 0;
        for (let j = 0; j < result.data.length; j++) {
          embeddings[embeddedCount + j] = result.data[j].embedding;
        }
        embeddedCount += batch.length;
      }

      const documents = chunks.map((chunk, i) => ({
        text: chunk.text,
        [field]: embeddings[i],
        metadata: chunk.metadata,
        [KB_MARKER_FIELD]: KB_BUNDLE_MARKER,
        _model: model,
        _embeddedAt: new Date(),
      }));

      for (let i = 0; i < documents.length; i += storeBatchSize) {
        const batch = documents.slice(i, i + storeBatchSize);
        const ins = await coll.insertMany(batch);
        totalInserted += ins.insertedCount;
      }
    }

    const chunkCount = await coll.countDocuments({ [KB_MARKER_FIELD]: KB_BUNDLE_MARKER });

    persistKbSeedingState({
      manifest,
      corpusSource,
      db,
      collection,
      field,
      indexName,
      embeddingModel: model,
      chunkCount,
      configPath,
      documentChecksums: checksumFromManifest(manifest),
    });

    return {
      insertedCount: totalInserted,
      totalApiTokens,
      chunkCount,
      changedCount: changedSet.size,
      removedCount: removed.length,
    };
  } finally {
    if (client) await client.close();
  }
}

module.exports = {
  runKbSeed,
  runKbIncrementalUpdate,
  persistKbSeedingState,
  checksumFromManifest,
  KB_BUNDLE_MARKER,
  KB_MARKER_FIELD,
  DEFAULT_DB,
  DEFAULT_COLLECTION,
  DEFAULT_FIELD,
  DEFAULT_INDEX_NAME,
};
