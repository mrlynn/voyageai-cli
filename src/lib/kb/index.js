'use strict';

/**
 * KB seeding library (Phase 31): manifest resolution, chunk plan, pre-API cost gate.
 * MongoDB insert and embeddings are Phase 31-02.
 */

const resolve = require('./resolve-manifest');
const plan = require('./plan-kb-seed');
const seed = require('./seed');
const fm = require('./front-matter');

module.exports = {
  ...resolve,
  ...plan,
  ...seed,
  parseFrontMatter: fm.parseFrontMatter,
};
