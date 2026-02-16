'use strict';

const { loadProject } = require('../lib/project');

/**
 * Resolve db/collection from tool input, falling back to project config.
 * Shared by retrieval, workspace, and ingest tool handlers.
 * @param {object} input - Tool input with optional db/collection fields
 * @returns {{ db: string, collection: string }}
 */
function resolveDbCollection(input) {
  const { config: proj } = loadProject();
  const db = input.db || proj.db;
  const collection = input.collection || proj.collection;
  if (!db) throw new Error('No database specified. Pass db parameter or configure via vai init.');
  if (!collection) throw new Error('No collection specified. Pass collection parameter or configure via vai init.');
  return { db, collection };
}

module.exports = { resolveDbCollection };
