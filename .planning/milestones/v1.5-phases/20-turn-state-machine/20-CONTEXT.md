# Phase 20: Turn State Machine - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the ad-hoc chat turn flow with a deterministic, interruptible state machine module. A chat turn progresses through named states (IDLE through PERSISTING back to IDLE), transitions are logged, invalid transitions throw, Ctrl+C preserves partial responses, and turn-level errors don't kill the session. Token estimation via character-based approximation. This phase does NOT add session persistence, memory management, or observability UI -- those are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Integration approach
- Wrap externally: TurnOrchestrator wraps existing `chatTurn`/`agentChatTurn` async generators
- The generators continue working as-is internally; orchestrator maps their events to state transitions
- Both pipeline and agent modes supported from the start -- single TurnOrchestrator with mode-aware state paths
- Pipeline: EMBEDDING -> RETRIEVING -> RERANKING -> BUILDING_PROMPT -> GENERATING
- Agent: GENERATING -> TOOL_CALLING -> GENERATING (loop)
- Module lives at `src/lib/turn-state.js` (pure module, no I/O dependencies, alongside chat.js)
- Replace direct chatTurn/agentChatTurn calls in `commands/chat.js` in this phase -- single code path going forward

### Interrupt behavior
- Show partial response + continue: display whatever was streamed, append dim '[interrupted]' suffix, return to prompt
- Partial response saved to history with `interrupted: true` metadata so LLM has context for subsequent turns
- Use standard AbortController/AbortSignal: TurnOrchestrator creates one per turn, passes to generators, Ctrl+C calls controller.abort()
- Same cancel behavior for all states (EMBEDDING, RETRIEVING, GENERATING, etc.) -- cancel immediately, transition to INTERRUPTED, return to IDLE

### Event & logging design
- TurnStateMachine extends Node EventEmitter
- Emits 'stateChange' events with core fields: `{ from, to, sessionId, turnIndex, timestamp, durationMs, metadata }`
- In-memory events only -- no persistent log in this phase (Phase 21 can persist if needed)
- Human-readable labels baked into the state machine as a LABELS map: `{ EMBEDDING: 'Embedding...', RETRIEVING: 'Searching...', GENERATING: 'Generating...' }` etc. (SM-04)
- Single source of truth for labels -- Phase 23 reads labels from events

### Error recovery
- Transition to ERROR_TURN state, display error with state context (e.g., "Error during retrieval: Connection timeout")
- Auto-transition back to IDLE -- user can immediately send another message
- No auto-retry, no consecutive error limits -- keep it simple
- Failed turns NOT recorded in history -- user's message is effectively "unsent", keeps history clean

### Claude's Discretion
- Exact state names and enum values
- Token estimator implementation details (4 chars ~ 1 token approximation)
- Internal structure of TurnOrchestrator class
- How AbortSignal propagates through existing generator code
- Test structure and coverage approach

</decisions>

<specifics>
## Specific Ideas

- State machine is a pure module with no I/O dependencies -- makes it testable and reusable
- The existing `chatTurn` generator yields coarse events: `retrieval`, `chunk`, `done`, `history` -- orchestrator maps these to finer state transitions
- The existing `agentChatTurn` generator also yields `tool_call` events -- maps to TOOL_CALLING state
- Requirements covered: SM-01, SM-02, SM-03, SM-04, SM-05, SM-06, MEM-06

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `chatTurn` async generator (src/lib/chat.js): yields `retrieval`, `chunk`, `done`, `history` events -- orchestrator wraps this
- `agentChatTurn` async generator (src/lib/chat.js): yields `tool_call`, `chunk`, `done`, `history` events -- orchestrator wraps this
- `ChatHistory` class (src/lib/history.js): manages turn storage, used by both generators
- `ChatSessionStats` class (src/lib/chat-session-stats.js): token/cost accumulator per session
- `robot-moments` module: provides animated spinners (startSearching, startThinking) that map to states

### Established Patterns
- Async generator pattern: chat.js uses `async function*` yielding typed events -- orchestrator consumes these
- Event-driven rendering: commands/chat.js iterates generator events to drive UI (spinners, streaming, sources)
- Picocolors for terminal styling: all UI modules use `pc` from picocolors
- Error handling: try/catch around generator iteration, errors displayed, REPL continues

### Integration Points
- `commands/chat.js` lines 341-362: where chatTurn/agentChatTurn are called -- TurnOrchestrator replaces these calls
- `commands/chat.js` lines 385-390: Ctrl+C handler -- needs to signal AbortController instead of process.exit
- `commands/chat.js` lines 309-314: readline REPL setup -- orchestrator integrates here
- `chat-ui.js` rendering functions: continue to be used for display, but driven by state events instead of raw generator events

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 20-turn-state-machine*
*Context gathered: 2026-03-09*
