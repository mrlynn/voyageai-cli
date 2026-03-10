'use strict';

const { EventEmitter } = require('node:events');

// ── STATES enum ──────────────────────────────────────────────────────────

const STATES = Object.freeze({
  IDLE: 'IDLE',
  VALIDATING: 'VALIDATING',
  EMBEDDING: 'EMBEDDING',
  RETRIEVING: 'RETRIEVING',
  RERANKING: 'RERANKING',
  BUILDING_PROMPT: 'BUILDING_PROMPT',
  GENERATING: 'GENERATING',
  STREAMING: 'STREAMING',
  PERSISTING: 'PERSISTING',
  INTERRUPTED: 'INTERRUPTED',
  ERROR_TURN: 'ERROR_TURN',
  TOOL_CALLING: 'TOOL_CALLING',
});

// ── LABELS map ───────────────────────────────────────────────────────────

const LABELS = Object.freeze({
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
});

// ── Transition table ─────────────────────────────────────────────────────
// Both pipeline and agent transitions are encoded here.
// The orchestrator (Plan 02) decides which path to take.

const TRANSITIONS = new Map([
  // Pipeline path
  [STATES.IDLE, new Set([STATES.VALIDATING])],
  [STATES.VALIDATING, new Set([STATES.EMBEDDING, STATES.GENERATING])],
  [STATES.EMBEDDING, new Set([STATES.RETRIEVING])],
  [STATES.RETRIEVING, new Set([STATES.RERANKING])],
  [STATES.RERANKING, new Set([STATES.BUILDING_PROMPT])],
  [STATES.BUILDING_PROMPT, new Set([STATES.GENERATING])],
  [STATES.GENERATING, new Set([STATES.STREAMING, STATES.TOOL_CALLING])],
  [STATES.STREAMING, new Set([STATES.PERSISTING])],
  [STATES.PERSISTING, new Set([STATES.IDLE])],
  // Agent loop
  [STATES.TOOL_CALLING, new Set([STATES.GENERATING])],
  // Recovery
  [STATES.INTERRUPTED, new Set([STATES.IDLE])],
  [STATES.ERROR_TURN, new Set([STATES.IDLE])],
]);

// ── TurnStateMachine ─────────────────────────────────────────────────────

class TurnStateMachine extends EventEmitter {
  /**
   * @param {object} options
   * @param {string} options.sessionId - Unique session identifier
   * @param {string} options.mode     - 'pipeline' or 'agent'
   */
  constructor({ sessionId, mode = 'pipeline' } = {}) {
    super();
    this._sessionId = sessionId;
    this._mode = mode;
    this._state = STATES.IDLE;
    this._turnIndex = 0;
    this._stateEnteredAt = Date.now();
  }

  // ── Getters ────────────────────────────────────────────────────────────

  get state() {
    return this._state;
  }

  get label() {
    return LABELS[this._state];
  }

  get turnIndex() {
    return this._turnIndex;
  }

  get sessionId() {
    return this._sessionId;
  }

  // ── Core transition ────────────────────────────────────────────────────

  /**
   * Transition to `target` state. Validates the transition is legal.
   * @param {string} target  - Target state (use STATES enum)
   * @param {object} [metadata={}] - Arbitrary metadata for the event
   * @returns {TurnStateMachine} this (for chaining)
   */
  transition(target, metadata = {}) {
    const from = this._state;

    // Universal transitions: any non-IDLE state -> INTERRUPTED or ERROR_TURN
    const isUniversal =
      from !== STATES.IDLE &&
      (target === STATES.INTERRUPTED || target === STATES.ERROR_TURN);

    if (!isUniversal) {
      const allowed = TRANSITIONS.get(from);
      if (!allowed || !allowed.has(target)) {
        throw new Error(
          `Invalid state transition: ${from} -> ${target}`,
        );
      }
    }

    // Increment turn index when leaving IDLE (start of a new turn)
    if (from === STATES.IDLE && target !== STATES.IDLE) {
      this._turnIndex++;
    }

    const now = Date.now();
    const durationMs = now - this._stateEnteredAt;

    this._state = target;
    this._stateEnteredAt = now;

    this.emit('stateChange', {
      from,
      to: target,
      sessionId: this._sessionId,
      turnIndex: this._turnIndex,
      timestamp: now,
      durationMs,
      metadata,
    });

    return this;
  }

  // ── Error recovery ─────────────────────────────────────────────────────

  /**
   * Transition through ERROR_TURN back to IDLE (auto-recovery).
   * Emits two stateChange events.
   * @param {Error|string} err
   * @param {object} [metadata={}]
   */
  error(err, metadata = {}) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    this.transition(STATES.ERROR_TURN, { error: errorMsg, ...metadata });
    this.transition(STATES.IDLE);
  }

  // ── Interrupt ──────────────────────────────────────────────────────────

  /**
   * Interrupt the current turn. Throws if already IDLE.
   * @param {object} [metadata={}]
   */
  interrupt(metadata = {}) {
    if (this._state === STATES.IDLE) {
      throw new Error('Cannot interrupt: already in IDLE state');
    }
    this.transition(STATES.INTERRUPTED, metadata);
  }
}

// ── Token estimator ──────────────────────────────────────────────────────

/**
 * Conservative character-based token estimate.
 * @param {string|null|undefined} text
 * @returns {number}
 */
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

// ── Exports ──────────────────────────────────────────────────────────────

module.exports = { TurnStateMachine, STATES, LABELS, estimateTokens };
