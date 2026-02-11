'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('MCP utility tools — registration', () => {
  const schemas = require('../../src/mcp/schemas');
  const { registerUtilityTools } = require('../../src/mcp/tools/utility');

  it('registers exactly 3 tools', () => {
    const tools = [];
    const fakeServer = {
      tool: (name) => { tools.push(name); },
    };
    registerUtilityTools(fakeServer, schemas);
    assert.equal(tools.length, 3);
  });

  it('registers vai_topics, vai_explain, and vai_estimate', () => {
    const tools = [];
    const fakeServer = {
      tool: (name) => { tools.push(name); },
    };
    registerUtilityTools(fakeServer, schemas);
    assert.deepEqual(tools, ['vai_topics', 'vai_explain', 'vai_estimate']);
  });

  it('uses correct schemas', () => {
    const tools = [];
    const fakeServer = {
      tool: (name, desc, schema) => { tools.push({ name, schema }); },
    };
    registerUtilityTools(fakeServer, schemas);
    assert.strictEqual(tools[0].schema, schemas.topicsSchema);
    assert.strictEqual(tools[1].schema, schemas.explainSchema);
    assert.strictEqual(tools[2].schema, schemas.estimateSchema);
  });
});

describe('MCP utility — vai_topics handler', () => {
  const schemas = require('../../src/mcp/schemas');
  const { registerUtilityTools } = require('../../src/mcp/tools/utility');

  function getTopicsHandler() {
    const tools = {};
    const fakeServer = {
      tool: (name, _d, _s, handler) => { tools[name] = handler; },
    };
    registerUtilityTools(fakeServer, schemas);
    return tools.vai_topics;
  }

  it('lists all topics when no search provided', async () => {
    const handler = getTopicsHandler();
    const result = await handler({});

    assert.ok(result.structuredContent);
    assert.ok(Array.isArray(result.structuredContent.topics));
    assert.ok(result.structuredContent.topics.length >= 20, 'should have 20+ topics');
    assert.equal(result.structuredContent.totalTopics, result.structuredContent.topics.length);
  });

  it('each topic has topic, title, and summary', async () => {
    const handler = getTopicsHandler();
    const result = await handler({});

    for (const t of result.structuredContent.topics) {
      assert.ok(t.topic, 'should have topic key');
      assert.ok(t.title, 'should have title');
      assert.ok(t.summary, 'should have summary');
    }
  });

  it('includes category groupings when listing all', async () => {
    const handler = getTopicsHandler();
    const result = await handler({});

    assert.ok(result.structuredContent.categories);
    assert.ok(result.structuredContent.categories['Core Concepts']);
    assert.ok(result.structuredContent.categories['Models & Pricing']);
    assert.ok(result.structuredContent.categories['Multimodal']);
  });

  it('filters topics by search term', async () => {
    const handler = getTopicsHandler();
    const result = await handler({ search: 'multimodal' });

    assert.ok(result.structuredContent.topics.length > 0);
    assert.ok(result.structuredContent.topics.length < 29, 'should filter, not return all');
    // Should include multimodal topics
    const keys = result.structuredContent.topics.map(t => t.topic);
    assert.ok(keys.some(k => k.includes('multimodal')));
  });

  it('returns empty results for nonsense search', async () => {
    const handler = getTopicsHandler();
    const result = await handler({ search: 'xyzzy_nonsense_12345' });

    assert.equal(result.structuredContent.results.length, 0);
    assert.ok(result.content[0].text.includes('No topics matching'));
  });

  it('search for "embed" returns embedding-related topics', async () => {
    const handler = getTopicsHandler();
    const result = await handler({ search: 'embed' });

    const keys = result.structuredContent.topics.map(t => t.topic);
    assert.ok(keys.includes('embeddings') || keys.some(k => k.includes('embed')));
  });

  it('omits categories when searching', async () => {
    const handler = getTopicsHandler();
    const result = await handler({ search: 'rag' });

    assert.equal(result.structuredContent.categories, undefined);
  });

  it('text output includes usage hint', async () => {
    const handler = getTopicsHandler();
    const result = await handler({});

    assert.ok(result.content[0].text.includes('vai_explain'));
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

    assert.ok('links' in result.structuredContent);
  });

  it('includes relatedTopics in response', async () => {
    const handler = getExplainHandler();
    const result = await handler({ topic: 'embeddings' });

    assert.ok(Array.isArray(result.structuredContent.relatedTopics));
  });

  it('fuzzy matches partial topic names', async () => {
    const handler = getExplainHandler();
    // "multimodal" isn't an exact topic key, but should fuzzy match to multimodal-embeddings
    const result = await handler({ topic: 'multimodal' });

    // Should either resolve or suggest — not a hard failure
    assert.ok(result.structuredContent);
    if (result.structuredContent.error) {
      // Got suggestions
      assert.ok(result.structuredContent.suggestions.length > 0);
      assert.ok(result.structuredContent.suggestions.some(s => s.topic.includes('multimodal')));
    } else {
      // Auto-resolved
      assert.ok(result.structuredContent.topic.includes('multimodal'));
    }
  });

  it('suggests similar topics for unknown input', async () => {
    const handler = getExplainHandler();
    const result = await handler({ topic: 'vector stuff' });

    assert.ok(result.structuredContent);
    // Should find vector-search related suggestions
    if (result.structuredContent.error) {
      assert.ok(result.structuredContent.suggestions.length > 0);
      assert.ok(result.content[0].text.includes('Did you mean'));
    }
  });

  it('text output includes "Related" section', async () => {
    const handler = getExplainHandler();
    const result = await handler({ topic: 'rag' });

    assert.ok(result.content[0].text.includes('Related'));
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
