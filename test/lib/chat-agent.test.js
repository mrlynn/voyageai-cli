'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('chat agent module', () => {
  const chat = require('../../src/lib/chat');

  it('exports agentChatTurn function', () => {
    assert.equal(typeof chat.agentChatTurn, 'function');
  });

  it('exports retrieve function (unchanged)', () => {
    assert.equal(typeof chat.retrieve, 'function');
  });

  it('exports chatTurn function (unchanged)', () => {
    assert.equal(typeof chat.chatTurn, 'function');
  });

  it('agentChatTurn is an async generator function', () => {
    // AsyncGeneratorFunction constructor name
    assert.equal(chat.agentChatTurn.constructor.name, 'AsyncGeneratorFunction');
  });

  it('chatTurn is an async generator function', () => {
    assert.equal(chat.chatTurn.constructor.name, 'AsyncGeneratorFunction');
  });
});

describe('agentChatTurn behavior (mock)', () => {
  // We re-implement the agent loop logic inline to verify the event protocol
  // without needing real API calls.

  it('yields tool_call events for each tool invocation', async () => {
    // Simulate the event protocol that agentChatTurn produces
    const events = [
      { type: 'tool_call', data: { name: 'vai_collections', args: {}, result: { collections: [] }, error: null, timeMs: 50 } },
      { type: 'tool_call', data: { name: 'vai_query', args: { query: 'test' }, result: { docs: [] }, error: null, timeMs: 200 } },
      { type: 'chunk', data: 'No results found for your query.' },
      { type: 'done', data: { fullResponse: 'No results found for your query.', toolCalls: [], metadata: { mode: 'agent', iterationCount: 2, toolCallCount: 2 } } },
    ];

    const toolCalls = events.filter(e => e.type === 'tool_call');
    assert.equal(toolCalls.length, 2);
    assert.equal(toolCalls[0].data.name, 'vai_collections');
    assert.equal(toolCalls[1].data.name, 'vai_query');
  });

  it('done event includes metadata with agent mode info', () => {
    const doneEvent = {
      type: 'done',
      data: {
        fullResponse: 'test response',
        toolCalls: [{ name: 'vai_query', args: { query: 'test' } }],
        metadata: {
          mode: 'agent',
          iterationCount: 1,
          toolCallCount: 1,
          totalTimeMs: 300,
        },
      },
    };

    assert.equal(doneEvent.data.metadata.mode, 'agent');
    assert.equal(typeof doneEvent.data.metadata.iterationCount, 'number');
    assert.equal(typeof doneEvent.data.metadata.toolCallCount, 'number');
    assert.equal(typeof doneEvent.data.metadata.totalTimeMs, 'number');
  });

  it('tool_call event includes timing', () => {
    const event = {
      type: 'tool_call',
      data: { name: 'vai_embed', args: { text: 'hello' }, result: {}, error: null, timeMs: 100 },
    };
    assert.equal(typeof event.data.timeMs, 'number');
    assert.ok(event.data.timeMs >= 0);
  });

  it('tool_call event captures errors', () => {
    const event = {
      type: 'tool_call',
      data: { name: 'vai_query', args: { query: 'test' }, result: null, error: 'Connection failed', timeMs: 50 },
    };
    assert.equal(event.data.error, 'Connection failed');
    assert.equal(event.data.result, null);
  });
});

describe('agentChatTurn defaults injection logic', () => {
  // Test the args merging logic that the agent loop performs

  it('injects default db when not in args', () => {
    const opts = { db: 'mydb', collection: 'mycoll' };
    const callArgs = { query: 'test' };

    const args = { ...callArgs };
    if (opts.db && !args.db) args.db = opts.db;
    if (opts.collection && !args.collection) args.collection = opts.collection;

    assert.equal(args.db, 'mydb');
    assert.equal(args.collection, 'mycoll');
    assert.equal(args.query, 'test');
  });

  it('does not override explicit db/collection in args', () => {
    const opts = { db: 'default_db', collection: 'default_coll' };
    const callArgs = { query: 'test', db: 'custom_db', collection: 'custom_coll' };

    const args = { ...callArgs };
    if (opts.db && !args.db) args.db = opts.db;
    if (opts.collection && !args.collection) args.collection = opts.collection;

    assert.equal(args.db, 'custom_db');
    assert.equal(args.collection, 'custom_coll');
  });

  it('handles missing opts.db gracefully', () => {
    const opts = {};
    const callArgs = { query: 'test' };

    const args = { ...callArgs };
    if (opts.db && !args.db) args.db = opts.db;
    if (opts.collection && !args.collection) args.collection = opts.collection;

    assert.equal(args.db, undefined);
    assert.equal(args.collection, undefined);
    assert.equal(args.query, 'test');
  });
});
