'use strict';

const { TurnStateMachine, STATES } = require('./turn-state');

/**
 * TurnOrchestrator wraps chat generators (chatTurn / agentChatTurn) with
 * TurnStateMachine, driving deterministic state transitions for every turn.
 *
 * - Maps generator yield events to state transitions
 * - Handles Ctrl+C interrupts via AbortController
 * - Catches errors without killing the chat session
 * - Re-yields all generator events so callers render unchanged
 */
class TurnOrchestrator {
  /**
   * @param {object} options
   * @param {string} options.sessionId - Unique session identifier
   * @param {string} [options.mode='pipeline'] - 'pipeline' or 'agent'
   */
  constructor({ sessionId, mode = 'pipeline' } = {}) {
    this._sm = new TurnStateMachine({ sessionId, mode });
    this._mode = mode;
    this._controller = null;
    this._interrupted = false;
  }

  // ── Delegate getters ──────────────────────────────────────────────────

  get state() { return this._sm.state; }
  get label() { return this._sm.label; }
  get turnIndex() { return this._sm.turnIndex; }

  /**
   * Subscribe to state machine events (e.g. 'stateChange').
   */
  on(event, handler) {
    this._sm.on(event, handler);
    return this;
  }

  /**
   * Return the internal TurnStateMachine for direct access.
   */
  getStateMachine() {
    return this._sm;
  }

  // ── Interrupt ─────────────────────────────────────────────────────────

  /**
   * Interrupt the current turn. Aborts the controller and transitions
   * the state machine to INTERRUPTED.
   */
  interrupt() {
    this._interrupted = true;
    if (this._controller) {
      this._controller.abort();
    }
    // Only call sm.interrupt if not already IDLE or INTERRUPTED
    if (this._sm.state !== STATES.IDLE && this._sm.state !== STATES.INTERRUPTED) {
      this._sm.interrupt();
    }
  }

  // ── Pipeline turn ─────────────────────────────────────────────────────

  /**
   * Execute a pipeline turn by wrapping a generator function.
   *
   * @param {object} params
   * @param {AsyncGeneratorFunction} params.generatorFn - The generator to wrap (e.g. chatTurn)
   * @param {object} [params.args] - Arguments to pass to the generator
   * @yields {object} Re-yielded events from the generator, plus 'interrupted' / 'error' events
   */
  async *executePipelineTurn({ generatorFn, args = {} }) {
    this._controller = new AbortController();
    this._interrupted = false;
    const signal = this._controller.signal;
    let partialResponse = '';
    let firstChunk = true;

    // Start: IDLE -> VALIDATING -> EMBEDDING
    this._sm.transition(STATES.VALIDATING);
    this._sm.transition(STATES.EMBEDDING);

    try {
      const gen = generatorFn(args);

      for await (const event of gen) {
        // Check interrupt between events
        if (this._interrupted || signal.aborted) {
          yield {
            type: 'interrupted',
            data: { partialResponse, metadata: { state: this._sm.state } },
          };
          // Transition to IDLE via INTERRUPTED if not already
          if (this._sm.state !== STATES.IDLE && this._sm.state !== STATES.INTERRUPTED) {
            this._sm.transition(STATES.INTERRUPTED);
          }
          if (this._sm.state === STATES.INTERRUPTED) {
            this._sm.transition(STATES.IDLE);
          }
          return;
        }

        switch (event.type) {
          case 'retrieval':
            // EMBEDDING -> RETRIEVING
            if (this._sm.state === STATES.EMBEDDING) {
              this._sm.transition(STATES.RETRIEVING);
              this._sm.transition(STATES.RERANKING);
              this._sm.transition(STATES.BUILDING_PROMPT);
              this._sm.transition(STATES.GENERATING);
            }
            yield event;
            break;

          case 'history':
            yield event;
            break;

          case 'chunk':
            if (firstChunk) {
              // Fast-forward to STREAMING if needed
              const s = this._sm.state;
              if (s === STATES.EMBEDDING) {
                this._sm.transition(STATES.RETRIEVING);
                this._sm.transition(STATES.RERANKING);
                this._sm.transition(STATES.BUILDING_PROMPT);
                this._sm.transition(STATES.GENERATING);
                this._sm.transition(STATES.STREAMING);
              } else if (s === STATES.GENERATING) {
                this._sm.transition(STATES.STREAMING);
              } else if (s === STATES.BUILDING_PROMPT) {
                this._sm.transition(STATES.GENERATING);
                this._sm.transition(STATES.STREAMING);
              }
              firstChunk = false;
            }
            partialResponse += event.data;
            yield event;
            break;

          case 'done':
            // STREAMING -> PERSISTING -> IDLE
            if (this._sm.state === STATES.STREAMING) {
              this._sm.transition(STATES.PERSISTING);
            }
            this._sm.transition(STATES.IDLE);
            yield event;
            break;

          default:
            yield event;
            break;
        }
      }
    } catch (err) {
      // Check if it's an abort error
      if (this._interrupted || signal.aborted || err.name === 'AbortError') {
        yield {
          type: 'interrupted',
          data: { partialResponse, metadata: { state: this._sm.state } },
        };
        if (this._sm.state !== STATES.IDLE && this._sm.state !== STATES.INTERRUPTED) {
          this._sm.transition(STATES.INTERRUPTED);
        }
        if (this._sm.state === STATES.INTERRUPTED) {
          this._sm.transition(STATES.IDLE);
        }
        return;
      }

      // Non-abort error: recover gracefully
      this._sm.error(err);
      yield {
        type: 'error',
        data: { message: err.message, state: this._sm.state },
      };
    }
  }

  // ── Agent turn ────────────────────────────────────────────────────────

  /**
   * Execute an agent turn by wrapping a generator function.
   *
   * @param {object} params
   * @param {AsyncGeneratorFunction} params.generatorFn - The generator to wrap (e.g. agentChatTurn)
   * @param {object} [params.args] - Arguments to pass to the generator
   * @yields {object} Re-yielded events from the generator, plus 'interrupted' / 'error' events
   */
  async *executeAgentTurn({ generatorFn, args = {} }) {
    this._controller = new AbortController();
    this._interrupted = false;
    const signal = this._controller.signal;
    let partialResponse = '';
    let firstChunk = true;
    let inStreaming = false;

    // Agent path: IDLE -> VALIDATING -> GENERATING
    this._sm.transition(STATES.VALIDATING);
    this._sm.transition(STATES.GENERATING);

    try {
      const gen = generatorFn(args);

      for await (const event of gen) {
        if (this._interrupted || signal.aborted) {
          yield {
            type: 'interrupted',
            data: { partialResponse, metadata: { state: this._sm.state } },
          };
          if (this._sm.state !== STATES.IDLE && this._sm.state !== STATES.INTERRUPTED) {
            this._sm.transition(STATES.INTERRUPTED);
          }
          if (this._sm.state === STATES.INTERRUPTED) {
            this._sm.transition(STATES.IDLE);
          }
          return;
        }

        switch (event.type) {
          case 'history':
            yield event;
            break;

          case 'tool_call':
            // GENERATING -> TOOL_CALLING, then back to GENERATING
            if (this._sm.state === STATES.GENERATING) {
              this._sm.transition(STATES.TOOL_CALLING);
            }
            yield event;
            // After yielding tool_call, go back to GENERATING
            if (this._sm.state === STATES.TOOL_CALLING) {
              this._sm.transition(STATES.GENERATING);
            }
            break;

          case 'chunk':
            if (firstChunk || !inStreaming) {
              if (this._sm.state === STATES.GENERATING) {
                this._sm.transition(STATES.STREAMING);
              }
              firstChunk = false;
              inStreaming = true;
            }
            partialResponse += event.data;
            yield event;
            break;

          case 'done':
            if (this._sm.state === STATES.STREAMING) {
              this._sm.transition(STATES.PERSISTING);
            }
            this._sm.transition(STATES.IDLE);
            yield event;
            break;

          default:
            yield event;
            break;
        }
      }
    } catch (err) {
      if (this._interrupted || signal.aborted || err.name === 'AbortError') {
        yield {
          type: 'interrupted',
          data: { partialResponse, metadata: { state: this._sm.state } },
        };
        if (this._sm.state !== STATES.IDLE && this._sm.state !== STATES.INTERRUPTED) {
          this._sm.transition(STATES.INTERRUPTED);
        }
        if (this._sm.state === STATES.INTERRUPTED) {
          this._sm.transition(STATES.IDLE);
        }
        return;
      }

      this._sm.error(err);
      yield {
        type: 'error',
        data: { message: err.message, state: this._sm.state },
      };
    }
  }
}

module.exports = { TurnOrchestrator };
