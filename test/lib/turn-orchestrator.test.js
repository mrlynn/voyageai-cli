'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ── Helpers: mock generators ─────────────────────────────────────────────

/**
 * Create a mock pipeline generator that yields controlled events.
 */
async function* mockPipelineGenerator() {
  yield { type: 'retrieval', data: { docs: [{ text: 'doc1' }], timeMs: 10, tokens: { embed: 5, rerank: 3 } } };
  yield { type: 'history', data: { turnCount: 1, messageCount: 4 } };
  yield { type: 'chunk', data: 'Hello' };
  yield { type: 'chunk', data: ' world' };
  yield { type: 'done', data: { fullResponse: 'Hello world', sources: [], metadata: {} } };
}

/**
 * Create a mock agent generator that yields tool_call + text events.
 */
async function* mockAgentGenerator() {
  yield { type: 'history', data: { turnCount: 0, messageCount: 2 } };
  yield { type: 'tool_call', data: { name: 'search', args: { query: 'test' }, result: {}, timeMs: 50 } };
  yield { type: 'chunk', data: 'Agent response' };
  yield { type: 'done', data: { fullResponse: 'Agent response', toolCalls: [{ name: 'search' }], metadata: {} } };
}

/**
 * Generator that throws an error mid-stream.
 */
async function* mockErrorGenerator() {
  yield { type: 'chunk', data: 'partial' };
  throw new Error('LLM connection lost');
}

/**
 * Generator that yields slowly (for interrupt testing).
 */
async function* mockSlowGenerator(signal) {
  yield { type: 'retrieval', data: { docs: [], timeMs: 5, tokens: { embed: 1, rerank: 0 } } };
  yield { type: 'chunk', data: 'start...' };
  // Check signal between chunks
  if (signal && signal.aborted) return;
  yield { type: 'chunk', data: ' more' };
  if (signal && signal.aborted) return;
  yield { type: 'done', data: { fullResponse: 'start... more', sources: [], metadata: {} } };
}

// ── Tests ────────────────────────────────────────────────────────────────

const { TurnOrchestrator } = require('../../src/lib/turn-orchestrator.js');
const { STATES } = require('../../src/lib/turn-state.js');

describe('TurnOrchestrator', () => {

  describe('constructor', () => {
    it('creates instance with sessionId and mode', () => {
      const orch = new TurnOrchestrator({ sessionId: 'test-123', mode: 'pipeline' });
      assert.equal(orch.state, STATES.IDLE);
      assert.equal(typeof orch.label, 'string');
      assert.equal(orch.turnIndex, 0);
    });

    it('defaults mode to pipeline', () => {
      const orch = new TurnOrchestrator({ sessionId: 'test-456' });
      assert.equal(orch.state, STATES.IDLE);
    });
  });

  describe('executePipelineTurn', () => {
    it('progresses through correct states for pipeline turn', async () => {
      const orch = new TurnOrchestrator({ sessionId: 's1', mode: 'pipeline' });
      const stateChanges = [];
      orch.on('stateChange', (evt) => stateChanges.push({ from: evt.from, to: evt.to }));

      const events = [];
      for await (const evt of orch.executePipelineTurn({ generatorFn: mockPipelineGenerator })) {
        events.push(evt);
      }

      // Should have re-yielded all generator events
      const types = events.map(e => e.type);
      assert.ok(types.includes('retrieval'), 'should yield retrieval event');
      assert.ok(types.includes('history'), 'should yield history event');
      assert.ok(types.includes('chunk'), 'should yield chunk events');
      assert.ok(types.includes('done'), 'should yield done event');

      // State machine should have progressed correctly
      assert.equal(orch.state, STATES.IDLE, 'should return to IDLE after done');

      // Check key transitions happened
      const transitions = stateChanges.map(sc => `${sc.from}->${sc.to}`);
      assert.ok(transitions.includes('IDLE->VALIDATING'), 'should start with IDLE->VALIDATING');
      assert.ok(transitions.includes('PERSISTING->IDLE'), 'should end with PERSISTING->IDLE');
    });

    it('fires stateChange events with correct from/to fields', async () => {
      const orch = new TurnOrchestrator({ sessionId: 's2', mode: 'pipeline' });
      const stateChanges = [];
      orch.on('stateChange', (evt) => {
        assert.ok(evt.from, 'stateChange should have from');
        assert.ok(evt.to, 'stateChange should have to');
        assert.ok(evt.timestamp, 'stateChange should have timestamp');
        assert.equal(evt.sessionId, 's2');
        stateChanges.push(evt);
      });

      for await (const _ of orch.executePipelineTurn({ generatorFn: mockPipelineGenerator })) {
        // consume
      }

      assert.ok(stateChanges.length >= 4, `should fire at least 4 stateChange events, got ${stateChanges.length}`);
    });
  });

  describe('executeAgentTurn', () => {
    it('progresses through correct states with tool_call', async () => {
      const orch = new TurnOrchestrator({ sessionId: 's3', mode: 'agent' });
      const stateChanges = [];
      orch.on('stateChange', (evt) => stateChanges.push({ from: evt.from, to: evt.to }));

      const events = [];
      for await (const evt of orch.executeAgentTurn({ generatorFn: mockAgentGenerator })) {
        events.push(evt);
      }

      const types = events.map(e => e.type);
      assert.ok(types.includes('tool_call'), 'should yield tool_call');
      assert.ok(types.includes('chunk'), 'should yield chunk');
      assert.ok(types.includes('done'), 'should yield done');

      // Check state transitions
      const transitions = stateChanges.map(sc => `${sc.from}->${sc.to}`);
      assert.ok(transitions.includes('IDLE->VALIDATING'), 'should start with IDLE->VALIDATING');
      assert.ok(transitions.some(t => t.includes('TOOL_CALLING')), 'should include TOOL_CALLING');
      assert.ok(transitions.includes('PERSISTING->IDLE'), 'should end with PERSISTING->IDLE');

      assert.equal(orch.state, STATES.IDLE);
    });
  });

  describe('error handling', () => {
    it('error in generator triggers error recovery and does not throw', async () => {
      const orch = new TurnOrchestrator({ sessionId: 's4', mode: 'pipeline' });
      const stateChanges = [];
      orch.on('stateChange', (evt) => stateChanges.push({ from: evt.from, to: evt.to }));

      const events = [];
      // Should NOT throw
      for await (const evt of orch.executePipelineTurn({ generatorFn: mockErrorGenerator })) {
        events.push(evt);
      }

      // Should yield error event
      const errorEvt = events.find(e => e.type === 'error');
      assert.ok(errorEvt, 'should yield error event');
      assert.ok(errorEvt.data.message.includes('LLM connection lost'));

      // State machine should recover to IDLE
      assert.equal(orch.state, STATES.IDLE, 'should recover to IDLE after error');

      // Check ERROR_TURN transition happened
      const transitions = stateChanges.map(sc => `${sc.from}->${sc.to}`);
      assert.ok(transitions.some(t => t.includes('ERROR_TURN')), 'should transition through ERROR_TURN');
    });
  });

  describe('interrupt handling', () => {
    it('interrupt during streaming yields interrupted event with partial response', async () => {
      const orch = new TurnOrchestrator({ sessionId: 's5', mode: 'pipeline' });

      const events = [];
      let chunkCount = 0;

      for await (const evt of orch.executePipelineTurn({
        generatorFn: async function* () {
          yield { type: 'retrieval', data: { docs: [], timeMs: 5, tokens: { embed: 1, rerank: 0 } } };
          yield { type: 'chunk', data: 'Hello' };
          yield { type: 'chunk', data: ' world' };
          // Simulate orchestrator being interrupted after second chunk
          orch.interrupt();
          yield { type: 'chunk', data: ' more' };
          yield { type: 'done', data: { fullResponse: 'Hello world more', sources: [], metadata: {} } };
        },
      })) {
        events.push(evt);
        if (evt.type === 'chunk') chunkCount++;
      }

      // Should have an interrupted event
      const intEvt = events.find(e => e.type === 'interrupted');
      assert.ok(intEvt, 'should yield interrupted event');
      assert.ok(intEvt.data.partialResponse, 'interrupted event should have partialResponse');
    });
  });

  describe('delegate getters', () => {
    it('exposes state, label, turnIndex from internal state machine', () => {
      const orch = new TurnOrchestrator({ sessionId: 's6', mode: 'pipeline' });
      assert.equal(orch.state, STATES.IDLE);
      assert.equal(orch.label, 'Ready');
      assert.equal(orch.turnIndex, 0);
    });

    it('getStateMachine returns the internal state machine', () => {
      const orch = new TurnOrchestrator({ sessionId: 's7', mode: 'agent' });
      const sm = orch.getStateMachine();
      assert.ok(sm);
      assert.equal(sm.state, STATES.IDLE);
    });
  });
});
