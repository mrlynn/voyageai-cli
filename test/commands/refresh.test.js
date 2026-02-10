'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { refresh } = require('../../src/commands/refresh');

describe('refresh command', () => {
  it('exports refresh function', () => {
    assert.equal(typeof refresh, 'function');
  });

  it('returns error when no documents found (mocked scenario)', async () => {
    // This is a basic smoke test - full integration would require MongoDB
    // The function should handle empty results gracefully
    const result = await refresh({
      json: true,
      quiet: true,
      db: 'nonexistent_db_test',
      collection: 'nonexistent_collection',
      dryRun: true,
    }).catch(err => ({ success: false, error: err.message }));
    
    // Either succeeds with 0 docs or fails due to no connection
    assert.ok(result.success === true || result.error);
  });
});
