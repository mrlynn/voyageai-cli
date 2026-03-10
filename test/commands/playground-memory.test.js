'use strict';

const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { createPlaygroundServer } = require('../../src/commands/playground');

/**
 * Tests for /api/chat/memory endpoint contract.
 *
 * NOTE: Full strategy-switching E2E (verifying that sending a chat message
 * with memoryStrategy='summarization' updates the reported strategy) requires
 * LLM configuration. These tests validate the endpoint contract and response
 * shape without requiring external services.
 */
describe('playground memory endpoint', () => {
  let server;
  let port;

  const serverReady = new Promise((resolve) => {
    server = createPlaygroundServer();
    server.listen(0, () => {
      port = server.address().port;
      resolve();
    });
  });

  after(() => {
    return new Promise((resolve) => {
      if (server) server.close(resolve);
      else resolve();
    });
  });

  it('GET /api/chat/memory returns default strategy before any message', async () => {
    await serverReady;
    const body = await httpGet(`http://localhost:${port}/api/chat/memory`);
    const data = JSON.parse(body);
    assert.equal(data.strategy, 'sliding_window', 'default strategy should be sliding_window');
  });

  it('GET /api/chat/memory returns all three available strategies', async () => {
    await serverReady;
    const body = await httpGet(`http://localhost:${port}/api/chat/memory`);
    const data = JSON.parse(body);
    assert.ok(Array.isArray(data.availableStrategies), 'availableStrategies should be an array');
    assert.equal(data.availableStrategies.length, 3, 'should have 3 strategies');
    assert.ok(data.availableStrategies.includes('sliding_window'), 'should include sliding_window');
    assert.ok(data.availableStrategies.includes('summarization'), 'should include summarization');
    assert.ok(data.availableStrategies.includes('hierarchical'), 'should include hierarchical');
  });

  it('GET /api/chat/memory returns budget object with numeric fields', async () => {
    await serverReady;
    const body = await httpGet(`http://localhost:${port}/api/chat/memory`);
    const data = JSON.parse(body);
    assert.ok(data.budget && typeof data.budget === 'object', 'budget should be an object');
    assert.ok(typeof data.budget.modelLimit === 'number', 'modelLimit should be a number');
    assert.ok(typeof data.budget.reservedResponse === 'number', 'reservedResponse should be a number');
    assert.ok(typeof data.budget.historyBudget === 'number', 'historyBudget should be a number');
  });

  it('GET /api/chat/memory returns utilization object with numeric fields', async () => {
    await serverReady;
    const body = await httpGet(`http://localhost:${port}/api/chat/memory`);
    const data = JSON.parse(body);
    assert.ok(data.utilization && typeof data.utilization === 'object', 'utilization should be an object');
    assert.ok(typeof data.utilization.turnCount === 'number', 'turnCount should be a number');
    assert.ok(typeof data.utilization.tokensUsed === 'number', 'tokensUsed should be a number');
    assert.ok(typeof data.utilization.tokensBudget === 'number', 'tokensBudget should be a number');
    assert.ok(typeof data.utilization.percent === 'number', 'percent should be a number');
  });
});

/**
 * Simple HTTP GET that returns the body string.
 */
function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString()));
      res.on('error', reject);
    }).on('error', reject);
  });
}
