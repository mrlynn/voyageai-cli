'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { TurnStateMachine, STATES, LABELS, estimateTokens } = require('../../src/lib/turn-state.js');

// ── STATES enum ──────────────────────────────────────────────────────────

describe('STATES', () => {
  it('contains all expected state keys', () => {
    const expected = [
      'IDLE', 'VALIDATING', 'EMBEDDING', 'RETRIEVING', 'RERANKING',
      'BUILDING_PROMPT', 'GENERATING', 'STREAMING', 'PERSISTING',
      'INTERRUPTED', 'ERROR_TURN', 'TOOL_CALLING',
    ];
    for (const key of expected) {
      assert.equal(STATES[key], key, `STATES.${key} should equal "${key}"`);
    }
  });

  it('is frozen', () => {
    assert.ok(Object.isFrozen(STATES));
  });
});

// ── LABELS map ───────────────────────────────────────────────────────────

describe('LABELS', () => {
  it('maps every state to a human-readable string', () => {
    const expected = {
      IDLE: 'Ready',
      VALIDATING: 'Validating...',
      EMBEDDING: 'Embedding...',
      RETRIEVING: 'Searching...',
      RERANKING: 'Reranking...',
      BUILDING_PROMPT: 'Building prompt...',
      GENERATING: 'Generating...',
      STREAMING: 'Streaming...',
      PERSISTING: 'Saving...',
      INTERRUPTED: 'Interrupted',
      ERROR_TURN: 'Error',
      TOOL_CALLING: 'Calling tools...',
    };
    for (const [key, label] of Object.entries(expected)) {
      assert.equal(LABELS[key], label);
    }
  });

  it('is frozen', () => {
    assert.ok(Object.isFrozen(LABELS));
  });
});

// ── TurnStateMachine ─────────────────────────────────────────────────────

describe('TurnStateMachine', () => {
  let machine;

  beforeEach(() => {
    machine = new TurnStateMachine({ sessionId: 'sess-1', mode: 'pipeline' });
  });

  // ── Construction ─────────────────────────────────────────────────────

  describe('constructor', () => {
    it('starts in IDLE state', () => {
      assert.equal(machine.state, STATES.IDLE);
    });

    it('exposes sessionId', () => {
      assert.equal(machine.sessionId, 'sess-1');
    });

    it('starts with turnIndex 0', () => {
      assert.equal(machine.turnIndex, 0);
    });

    it('label getter returns Ready for IDLE', () => {
      assert.equal(machine.label, 'Ready');
    });
  });

  // ── Pipeline transitions ─────────────────────────────────────────────

  describe('pipeline transitions', () => {
    const pipelineSequence = [
      'VALIDATING', 'EMBEDDING', 'RETRIEVING', 'RERANKING',
      'BUILDING_PROMPT', 'GENERATING', 'STREAMING', 'PERSISTING', 'IDLE',
    ];

    it('progresses through full pipeline sequence', () => {
      for (const target of pipelineSequence) {
        machine.transition(STATES[target]);
      }
      assert.equal(machine.state, STATES.IDLE);
    });

    it('returns the machine for chaining', () => {
      const result = machine.transition(STATES.VALIDATING);
      assert.equal(result, machine);
    });
  });

  // ── Agent transitions ────────────────────────────────────────────────

  describe('agent transitions', () => {
    it('supports GENERATING -> TOOL_CALLING -> GENERATING loop', () => {
      const m = new TurnStateMachine({ sessionId: 's2', mode: 'agent' });
      m.transition(STATES.VALIDATING);
      m.transition(STATES.GENERATING);
      m.transition(STATES.TOOL_CALLING);
      m.transition(STATES.GENERATING);
      assert.equal(m.state, STATES.GENERATING);
    });

    it('supports agent shortcut VALIDATING -> GENERATING', () => {
      const m = new TurnStateMachine({ sessionId: 's3', mode: 'agent' });
      m.transition(STATES.VALIDATING);
      m.transition(STATES.GENERATING);
      assert.equal(m.state, STATES.GENERATING);
    });
  });

  // ── Invalid transitions ──────────────────────────────────────────────

  describe('invalid transitions', () => {
    it('throws for invalid transition with descriptive message', () => {
      assert.throws(
        () => machine.transition(STATES.STREAMING),
        (err) => {
          assert.ok(err.message.includes('IDLE'), 'should mention current state');
          assert.ok(err.message.includes('STREAMING'), 'should mention target state');
          return true;
        },
      );
    });

    it('throws for PERSISTING -> GENERATING', () => {
      machine.transition(STATES.VALIDATING);
      machine.transition(STATES.EMBEDDING);
      machine.transition(STATES.RETRIEVING);
      machine.transition(STATES.RERANKING);
      machine.transition(STATES.BUILDING_PROMPT);
      machine.transition(STATES.GENERATING);
      machine.transition(STATES.STREAMING);
      machine.transition(STATES.PERSISTING);
      assert.throws(() => machine.transition(STATES.GENERATING));
    });
  });

  // ── Universal transitions (INTERRUPTED, ERROR_TURN) ──────────────────

  describe('universal transitions', () => {
    it('any non-IDLE state can transition to INTERRUPTED', () => {
      machine.transition(STATES.VALIDATING);
      machine.transition(STATES.INTERRUPTED);
      assert.equal(machine.state, STATES.INTERRUPTED);
    });

    it('any non-IDLE state can transition to ERROR_TURN', () => {
      machine.transition(STATES.VALIDATING);
      machine.transition(STATES.ERROR_TURN);
      assert.equal(machine.state, STATES.ERROR_TURN);
    });

    it('INTERRUPTED -> IDLE is valid', () => {
      machine.transition(STATES.VALIDATING);
      machine.transition(STATES.INTERRUPTED);
      machine.transition(STATES.IDLE);
      assert.equal(machine.state, STATES.IDLE);
    });

    it('ERROR_TURN -> IDLE is valid', () => {
      machine.transition(STATES.VALIDATING);
      machine.transition(STATES.ERROR_TURN);
      machine.transition(STATES.IDLE);
      assert.equal(machine.state, STATES.IDLE);
    });

    it('IDLE cannot transition to INTERRUPTED', () => {
      assert.throws(() => machine.transition(STATES.INTERRUPTED));
    });

    it('IDLE cannot transition to ERROR_TURN', () => {
      assert.throws(() => machine.transition(STATES.ERROR_TURN));
    });
  });

  // ── stateChange events ───────────────────────────────────────────────

  describe('stateChange events', () => {
    it('emits stateChange with correct payload', () => {
      const events = [];
      machine.on('stateChange', (evt) => events.push(evt));

      machine.transition(STATES.VALIDATING, { foo: 'bar' });

      assert.equal(events.length, 1);
      const evt = events[0];
      assert.equal(evt.from, STATES.IDLE);
      assert.equal(evt.to, STATES.VALIDATING);
      assert.equal(evt.sessionId, 'sess-1');
      assert.equal(typeof evt.turnIndex, 'number');
      assert.equal(typeof evt.timestamp, 'number');
      assert.equal(typeof evt.durationMs, 'number');
      assert.ok(evt.durationMs >= 0);
      assert.deepEqual(evt.metadata, { foo: 'bar' });
    });

    it('increments turnIndex when leaving IDLE', () => {
      const events = [];
      machine.on('stateChange', (evt) => events.push(evt));

      // First turn
      machine.transition(STATES.VALIDATING);
      assert.equal(events[0].turnIndex, 1);

      // Complete first turn
      machine.transition(STATES.EMBEDDING);
      machine.transition(STATES.RETRIEVING);
      machine.transition(STATES.RERANKING);
      machine.transition(STATES.BUILDING_PROMPT);
      machine.transition(STATES.GENERATING);
      machine.transition(STATES.STREAMING);
      machine.transition(STATES.PERSISTING);
      machine.transition(STATES.IDLE);

      // Second turn
      machine.transition(STATES.VALIDATING);
      const lastEvent = events[events.length - 1];
      assert.equal(lastEvent.turnIndex, 2);
    });
  });

  // ── error() method ───────────────────────────────────────────────────

  describe('error()', () => {
    it('transitions through ERROR_TURN to IDLE, emitting two events', () => {
      machine.transition(STATES.VALIDATING);

      const events = [];
      machine.on('stateChange', (evt) => events.push(evt));

      machine.error(new Error('something broke'), { context: 'test' });

      assert.equal(events.length, 2);
      assert.equal(events[0].from, STATES.VALIDATING);
      assert.equal(events[0].to, STATES.ERROR_TURN);
      assert.equal(events[0].metadata.error, 'something broke');
      assert.equal(events[0].metadata.context, 'test');

      assert.equal(events[1].from, STATES.ERROR_TURN);
      assert.equal(events[1].to, STATES.IDLE);

      assert.equal(machine.state, STATES.IDLE);
    });

    it('works with string errors', () => {
      machine.transition(STATES.VALIDATING);

      const events = [];
      machine.on('stateChange', (evt) => events.push(evt));

      machine.error('plain string error');

      assert.equal(events[0].metadata.error, 'plain string error');
    });
  });

  // ── interrupt() method ───────────────────────────────────────────────

  describe('interrupt()', () => {
    it('transitions to INTERRUPTED from non-IDLE', () => {
      machine.transition(STATES.VALIDATING);
      machine.interrupt({ partialResponse: 'partial...' });
      assert.equal(machine.state, STATES.INTERRUPTED);
    });

    it('throws if already IDLE', () => {
      assert.throws(
        () => machine.interrupt(),
        (err) => err.message.includes('IDLE'),
      );
    });

    it('includes metadata in event', () => {
      machine.transition(STATES.VALIDATING);

      const events = [];
      machine.on('stateChange', (evt) => events.push(evt));

      machine.interrupt({ partialResponse: 'half done' });
      assert.equal(events[0].metadata.partialResponse, 'half done');
    });
  });
});

// ── estimateTokens ───────────────────────────────────────────────────────

describe('estimateTokens', () => {
  it('returns ceil(length / 4) for strings', () => {
    assert.equal(estimateTokens('hello world'), Math.ceil('hello world'.length / 4));
  });

  it('returns 0 for empty string', () => {
    assert.equal(estimateTokens(''), 0);
  });

  it('returns 0 for null', () => {
    assert.equal(estimateTokens(null), 0);
  });

  it('returns 0 for undefined', () => {
    assert.equal(estimateTokens(undefined), 0);
  });

  it('handles single character', () => {
    assert.equal(estimateTokens('a'), 1);
  });

  it('handles exactly 4 characters', () => {
    assert.equal(estimateTokens('abcd'), 1);
  });

  it('handles 5 characters (rounds up)', () => {
    assert.equal(estimateTokens('abcde'), 2);
  });
});
