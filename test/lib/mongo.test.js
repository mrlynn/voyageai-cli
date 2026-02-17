'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { mock } = require('node:test');

describe('mongo', () => {
  let mongoModule;

  beforeEach(() => {
    // Clear require cache so each test gets fresh state
    delete require.cache[require.resolve('../../src/lib/mongo')];
    // Reset env
    delete process.env.MONGODB_URI;
  });

  describe('requireMongoUri', () => {
    it('returns MONGODB_URI from environment', () => {
      process.env.MONGODB_URI = 'mongodb+srv://test:pass@cluster.mongodb.net/';
      mongoModule = require('../../src/lib/mongo');
      const uri = mongoModule.requireMongoUri();
      assert.equal(uri, 'mongodb+srv://test:pass@cluster.mongodb.net/');
    });

    it('throws when no URI is configured', () => {
      delete process.env.MONGODB_URI;
      // Also need to ensure config returns nothing
      mongoModule = require('../../src/lib/mongo');
      // Mock getConfigValue to return undefined
      const configModule = require('../../src/lib/config');
      const original = configModule.getConfigValue;
      configModule.getConfigValue = () => undefined;
      try {
        assert.throws(
          () => mongoModule.requireMongoUri(),
          { message: /MONGODB_URI is not set/ }
        );
      } finally {
        configModule.getConfigValue = original;
      }
    });

    it('error message includes both configuration options', () => {
      delete process.env.MONGODB_URI;
      mongoModule = require('../../src/lib/mongo');
      const configModule = require('../../src/lib/config');
      const original = configModule.getConfigValue;
      configModule.getConfigValue = () => undefined;
      try {
        assert.throws(
          () => mongoModule.requireMongoUri(),
          (err) => {
            assert.ok(err.message.includes('Option 1'), 'should mention env var option');
            assert.ok(err.message.includes('Option 2'), 'should mention config option');
            assert.ok(err.message.includes('vai config set'), 'should mention vai config');
            return true;
          }
        );
      } finally {
        configModule.getConfigValue = original;
      }
    });

    it('falls back to config file when env var is not set', () => {
      delete process.env.MONGODB_URI;
      mongoModule = require('../../src/lib/mongo');
      const configModule = require('../../src/lib/config');
      const original = configModule.getConfigValue;
      configModule.getConfigValue = (key) => {
        if (key === 'mongodbUri') return 'mongodb+srv://from-config@cluster.mongodb.net/';
        return original(key);
      };
      try {
        const uri = mongoModule.requireMongoUri();
        assert.equal(uri, 'mongodb+srv://from-config@cluster.mongodb.net/');
      } finally {
        configModule.getConfigValue = original;
      }
    });

    it('prefers env var over config file', () => {
      process.env.MONGODB_URI = 'mongodb+srv://from-env@cluster.mongodb.net/';
      mongoModule = require('../../src/lib/mongo');
      const configModule = require('../../src/lib/config');
      const original = configModule.getConfigValue;
      configModule.getConfigValue = (key) => {
        if (key === 'mongodbUri') return 'mongodb+srv://from-config@cluster.mongodb.net/';
        return original(key);
      };
      try {
        const uri = mongoModule.requireMongoUri();
        assert.equal(uri, 'mongodb+srv://from-env@cluster.mongodb.net/');
      } finally {
        configModule.getConfigValue = original;
      }
    });
  });

  describe('getMongoCollection', () => {
    it('returns client and collection objects', async () => {
      process.env.MONGODB_URI = 'mongodb://localhost:27017/';
      mongoModule = require('../../src/lib/mongo');

      // Mock the mongodb driver
      const mockCollection = { find: () => {} };
      const mockDb = { collection: (name) => { assert.equal(name, 'testcol'); return mockCollection; } };
      const mockClient = {
        connect: async () => {},
        db: (name) => { assert.equal(name, 'testdb'); return mockDb; },
        close: async () => {},
      };

      // Intercept require('mongodb')
      const Module = require('module');
      const originalResolve = Module._resolveFilename;
      const originalLoad = Module._cache;

      // Use a simpler approach: monkey-patch after requiring
      // We need to mock MongoClient constructor
      // Since mongo.js uses lazy require, we can pre-populate the cache
      const mongodbPath = require.resolve('mongodb');
      const cachedMongodb = require.cache[mongodbPath];
      require.cache[mongodbPath] = {
        id: mongodbPath,
        filename: mongodbPath,
        loaded: true,
        exports: { MongoClient: function() { return mockClient; } },
      };

      try {
        const { client, collection } = await mongoModule.getMongoCollection('testdb', 'testcol');
        assert.equal(client, mockClient);
        assert.equal(collection, mockCollection);
      } finally {
        if (cachedMongodb) {
          require.cache[mongodbPath] = cachedMongodb;
        } else {
          delete require.cache[mongodbPath];
        }
      }
    });
  });

  describe('connectAndClose', () => {
    it('calls function with collection and closes client', async () => {
      process.env.MONGODB_URI = 'mongodb://localhost:27017/';

      let closed = false;
      const mockCollection = { name: 'test' };
      const mockDb = { collection: () => mockCollection };
      const mockClient = {
        connect: async () => {},
        db: () => mockDb,
        close: async () => { closed = true; },
      };

      const mongodbPath = require.resolve('mongodb');
      const cachedMongodb = require.cache[mongodbPath];
      require.cache[mongodbPath] = {
        id: mongodbPath,
        filename: mongodbPath,
        loaded: true,
        exports: { MongoClient: function() { return mockClient; } },
      };

      // Fresh require
      delete require.cache[require.resolve('../../src/lib/mongo')];
      mongoModule = require('../../src/lib/mongo');

      try {
        const result = await mongoModule.connectAndClose('db', 'col', async (col) => {
          assert.equal(col, mockCollection);
          return 42;
        });
        assert.equal(result, 42);
        assert.ok(closed, 'client should be closed after fn completes');
      } finally {
        if (cachedMongodb) {
          require.cache[mongodbPath] = cachedMongodb;
        } else {
          delete require.cache[mongodbPath];
        }
      }
    });

    it('closes client even when function throws', async () => {
      process.env.MONGODB_URI = 'mongodb://localhost:27017/';

      let closed = false;
      const mockCollection = {};
      const mockDb = { collection: () => mockCollection };
      const mockClient = {
        connect: async () => {},
        db: () => mockDb,
        close: async () => { closed = true; },
      };

      const mongodbPath = require.resolve('mongodb');
      const cachedMongodb = require.cache[mongodbPath];
      require.cache[mongodbPath] = {
        id: mongodbPath,
        filename: mongodbPath,
        loaded: true,
        exports: { MongoClient: function() { return mockClient; } },
      };

      delete require.cache[require.resolve('../../src/lib/mongo')];
      mongoModule = require('../../src/lib/mongo');

      try {
        await assert.rejects(
          () => mongoModule.connectAndClose('db', 'col', async () => {
            throw new Error('boom');
          }),
          { message: 'boom' }
        );
        assert.ok(closed, 'client should be closed even after error');
      } finally {
        if (cachedMongodb) {
          require.cache[mongodbPath] = cachedMongodb;
        } else {
          delete require.cache[mongodbPath];
        }
      }
    });
  });

  describe('exports', () => {
    it('exports requireMongoUri, getMongoCollection, connectAndClose', () => {
      mongoModule = require('../../src/lib/mongo');
      assert.equal(typeof mongoModule.requireMongoUri, 'function');
      assert.equal(typeof mongoModule.getMongoCollection, 'function');
      assert.equal(typeof mongoModule.connectAndClose, 'function');
      assert.equal(Object.keys(mongoModule).length, 3);
    });
  });
});
