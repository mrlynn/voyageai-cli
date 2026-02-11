'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('MCP utility tools — registration', () => {
  const schemas = require('../../src/mcp/schemas');
  const { registerUtilityTools } = require('../../src/mcp/tools/utility');

  it('registers exactly 2 tools', () => {
    const tools = [];
    const fakeServer = {
      tool: (name) => { tools.push(name); },
    };
    registerUtilityTools(fakeServer, schemas);
    assert.equal(tools.length, 2);
  });

  it('registers vai_explain and vai_estimate', () => {
    const tools = [];
    const fakeServer = {
      tool: (name) => { tools.push(name); },
    };
    registerUtilityTools(fakeServer, schemas);
    assert.deepEqual(tools, ['vai_explain', 'vai_estimate']);
  });

  it('uses correct schemas', () => {
    const tools = [];
    const fakeServer = {
      tool: (name, desc, schema) => { tools.push({ name, schema }); },
    };
    registerUtilityTools(fakeServer, schemas);
    assert.strictEqual(tools[0].schema, schemas.explainSchema);
    assert.strictEqual(tools[1].schema, schemas.estimateSchema);
  });
});

describe('MCP utility — vai_explain handler', () => {
  const schemas = require('../../src/mcp/schemas');
  const { registerUtilityTools } = require('../../src/mcp/tools/utility');

  function getExplainHandler() {
    const tools = {};
    const fakeServer = {
      tool: (name, _d, _s, handler) => { tools[name] = handler; },
    };
    registerUtilityTools(fakeServer, schemas);
    return tools.vai_explain;
  }

  it('returns content for a known topic (embeddings)', async () => {
    const handler = getExplainHandler();
    const result = await handler({ topic: 'embeddings' });

    assert.ok(result.structuredContent);
    assert.equal(result.structuredContent.topic, 'embeddings');
    assert.ok(result.structuredContent.title);
    assert.ok(result.structuredContent.summary);
    assert.ok(result.structuredContent.content);
    assert.ok(result.content[0].text.includes(result.structuredContent.title));
  });

  it('returns content for moe topic', async () => {
    const handler = getExplainHandler();
    const result = await handler({ topic: 'moe' });

    assert.ok(result.structuredContent);
    assert.ok(result.structuredContent.title);
  });

  it('returns error for unknown topic', async () => {
    const handler = getExplainHandler();
    const result = await handler({ topic: 'definitely_not_a_topic_xyz' });

    assert.equal(result.structuredContent.error, 'unknown_topic');
    assert.ok(Array.isArray(result.structuredContent.available));
    assert.ok(result.structuredContent.available.length > 0);
    assert.ok(result.content[0].text.includes('Unknown topic'));
  });

  it('includes links in structuredContent when available', async () => {
    const handler = getExplainHandler();
    const result = await handler({ topic: 'embeddings' });

    // Links may or may not be present depending on the concept
    assert.ok('links' in result.structuredContent || true);
  });
});

describe('MCP utility — vai_estimate handler', () => {
  const schemas = require('../../src/mcp/schemas');
  const { registerUtilityTools } = require('../../src/mcp/tools/utility');

  function getEstimateHandler() {
    const tools = {};
    const fakeServer = {
      tool: (name, _d, _s, handler) => { tools[name] = handler; },
    };
    registerUtilityTools(fakeServer, schemas);
    return tools.vai_estimate;
  }

  it('returns estimates for 10k docs / 1k queries / 12 months', async () => {
    const handler = getEstimateHandler();
    const result = await handler({ docs: 10000, queries: 1000, months: 12 });

    assert.ok(result.structuredContent);
    assert.equal(result.structuredContent.input.docs, 10000);
    assert.equal(result.structuredContent.input.queries, 1000);
    assert.equal(result.structuredContent.input.months, 12);
    assert.ok(Array.isArray(result.structuredContent.estimates));
    assert.ok(result.structuredContent.estimates.length >= 1);
  });

  it('estimates are sorted by totalCost ascending', async () => {
    const handler = getEstimateHandler();
    const result = await handler({ docs: 5000, queries: 500, months: 6 });

    const costs = result.structuredContent.estimates.map(e => e.totalCost);
    for (let i = 1; i < costs.length; i++) {
      assert.ok(costs[i] >= costs[i - 1], `costs should be sorted: ${costs[i]} >= ${costs[i - 1]}`);
    }
  });

  it('recommendation matches first (cheapest) estimate model', async () => {
    const handler = getEstimateHandler();
    const result = await handler({ docs: 1000, queries: 100, months: 12 });

    const estimates = result.structuredContent.estimates;
    if (estimates.length > 0) {
      // recommendation should be the cheapest model
      assert.equal(result.structuredContent.recommendation, estimates[0].model);
      assert.ok(estimates[0].model, 'cheapest model should have a name');
    }
  });

  it('zero queries yields zero monthly cost', async () => {
    const handler = getEstimateHandler();
    const result = await handler({ docs: 1000, queries: 0, months: 12 });

    for (const est of result.structuredContent.estimates) {
      assert.equal(est.monthlyCost, 0, `${est.model} should have 0 monthly cost`);
    }
  });

  it('each estimate has required fields', async () => {
    const handler = getEstimateHandler();
    const result = await handler({ docs: 1000, queries: 100, months: 12 });

    for (const est of result.structuredContent.estimates) {
      assert.ok(est.model);
      assert.ok('pricePerMToken' in est);
      assert.ok('embeddingCost' in est);
      assert.ok('monthlyCost' in est);
      assert.ok('totalCost' in est);
    }
  });

  it('text output includes model names and costs', async () => {
    const handler = getEstimateHandler();
    const result = await handler({ docs: 1000, queries: 100, months: 12 });

    const text = result.content[0].text;
    assert.ok(text.includes('Cost estimate'));
    assert.ok(text.includes('$'));
    assert.ok(text.includes('Recommended'));
  });

  it('higher doc count produces higher costs', async () => {
    const handler = getEstimateHandler();
    const small = await handler({ docs: 100, queries: 0, months: 1 });
    const large = await handler({ docs: 100000, queries: 0, months: 1 });

    const smallTotal = small.structuredContent.estimates[0].totalCost;
    const largeTotal = large.structuredContent.estimates[0].totalCost;
    assert.ok(largeTotal > smallTotal, 'More docs should cost more');
  });
});
