'use strict';

const { MongoClient } = require('mongodb');

let client = null;
let db = null;

/**
 * Connect to MongoDB using the MONGODB_URI environment variable.
 * Uses connection pooling with a maximum of 10 connections.
 * Retries up to 3 times with exponential backoff on failure.
 */
async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is required');
  }

  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      client = new MongoClient(uri, {
        maxPoolSize: 10,
        connectTimeoutMS: 5000,
        serverSelectionTimeoutMS: 5000,
      });

      await client.connect();
      db = client.db(process.env.DB_NAME || 'taskflow');

      // Verify connectivity with a ping
      await db.command({ ping: 1 });
      return db;
    } catch (err) {
      console.error(`Database connection attempt ${attempt}/${maxRetries} failed: ${err.message}`);

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
        console.log(`Retrying in ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw new Error(`Database connection failed after ${maxRetries} attempts: ${err.message}`);
      }
    }
  }
}

/**
 * Get the active database instance.
 * Throws if connectDatabase() hasn't been called successfully.
 */
function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized — call connectDatabase() first');
  }
  return db;
}

/**
 * Close the database connection gracefully.
 * Safe to call multiple times.
 */
async function closeDatabase() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

module.exports = { connectDatabase, getDatabase, closeDatabase };
