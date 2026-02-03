'use strict';

/**
 * Get MongoDB URI or exit with a helpful error.
 * Checks: env var → config file.
 * @returns {string}
 */
function requireMongoUri() {
  const { getConfigValue } = require('./config');
  const uri = process.env.MONGODB_URI || getConfigValue('mongodbUri');
  if (!uri) {
    console.error('Error: MONGODB_URI is not set.');
    console.error('');
    console.error('Option 1: export MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/"');
    console.error('Option 2: vai config set mongodb-uri "mongodb+srv://user:pass@cluster.mongodb.net/"');
    process.exit(1);
  }
  return uri;
}

/**
 * Get a connected MongoDB client and target collection.
 * Lazy-requires the mongodb driver.
 * @param {string} db - Database name
 * @param {string} collectionName - Collection name
 * @returns {Promise<{client: import('mongodb').MongoClient, collection: import('mongodb').Collection}>}
 */
async function getMongoCollection(db, collectionName) {
  const { MongoClient } = require('mongodb');
  const uri = requireMongoUri();
  const client = new MongoClient(uri);
  await client.connect();
  const collection = client.db(db).collection(collectionName);
  return { client, collection };
}

/**
 * Connect to MongoDB, run a function with the collection, then close.
 * @param {string} db - Database name
 * @param {string} collectionName - Collection name
 * @param {(collection: import('mongodb').Collection) => Promise<*>} fn - Function to run
 * @returns {Promise<*>}
 */
async function connectAndClose(db, collectionName, fn) {
  const { client, collection } = await getMongoCollection(db, collectionName);
  try {
    return await fn(collection);
  } finally {
    await client.close();
  }
}

module.exports = {
  requireMongoUri,
  getMongoCollection,
  connectAndClose,
};
