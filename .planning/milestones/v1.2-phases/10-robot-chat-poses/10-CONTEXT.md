# Phase 10: Robot Chat Poses - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace plain text spinners (`createTimedSpinner`) in the chat command with animated robot poses during processing states. Chat currently has 4 spinner sites: startup, retrieval, generation, and agent thinking/analyzing. Each gets replaced with the appropriate animated robot pose. Graceful degradation in non-TTY/json/quiet modes.

</domain>

<decisions>
## Implementation Decisions

### Pose mapping
- Startup initialization: **wave** pose (consistent with greet/help headers)
- Vector retrieval ("Searching knowledge base"): **search** pose (eyes scan left-right)
- LLM response generation ("Generating response"): **thinking** pose (eyes look up-center-up)
- Agent mode thinking/analyzing: **thinking** pose (same for both "Thinking" and "Analyzing results")
- After successful response with sources: brief **success** pose flash (~1 second)

### Transition behavior
- Search-to-thinking transition: **in-place swap** using `animateRobot`'s `stop()` then start new animation in same terminal region
- When streaming starts (first chunk): **clear instantly** — thinking robot disappears immediately, attention shifts to response text
- Success pose placement: **print below response text, before sources** render
- Agent mode: thinking pose during **LLM analysis only** — tool call execution display stays text-based (no robot during tool execution)

### Animation labels
- **Keep existing descriptive labels** unchanged: "Starting vai chat", "Searching knowledge base", "Generating response", "Thinking", "Analyzing results"
- **Preserve elapsed time counter** from createTimedSpinner alongside the robot label
- Labels render **right of robot, vertically centered** — use the established sideBySide layout pattern from robot-moments.js
- **Static labels per phase** — no dynamic label updates mid-animation (current animateRobot API stays as-is)

### Error pose usage
- Show **static error pose** (no animation) before the error message text — uses `moments.error()` pattern
- When error occurs during active animation: **replace in-place** — swap the active search/thinking animation to static error pose in same terminal region
- After error display: **continue to input prompt** — errors are non-fatal in chat REPL, user can retry
- **All errors use error robot consistently** — both startup failures (bad MongoDB URI) and mid-turn errors (API timeout)

### Claude's Discretion
- Exact timing of success pose flash duration
- How to integrate elapsed timer with animateRobot label rendering (may need minor extension to animateRobot)
- Terminal line clearing mechanics for in-place pose swaps

</decisions>

<specifics>
## Specific Ideas

- The in-place swap should feel like the robot "changes expression" rather than disappearing and reappearing
- Success pose is a brief positive reinforcement moment, not a blocking delay — should feel snappy
- Existing `moments.startSearching()`, `moments.startThinking()`, `moments.success()`, `moments.error()` should be the primary integration points

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/robot.js`: All poses defined (idle, blink, thinking, success, error, wave, search) with `animateRobot()` returning `{ stop(finalPose) }` controller
- `src/lib/robot-moments.js`: High-level moments API — `startThinking()`, `startSearching()`, `startWaiting()`, `success()`, `error()` with sideBySide layout and `isInteractive()` TTY guard
- `src/lib/robot-moments.js:sideBySide()`: Layout helper rendering robot left, text right — established pattern for label placement

### Established Patterns
- `animateRobot()` uses cursor hiding, in-place overwriting with ANSI escape codes, and `setInterval` for frame updates
- `moments.isInteractive(opts)` checks `process.stdout.isTTY && !opts.json && !opts.plain` — matches chat's existing `!opts.json && !opts.quiet` guard
- Labels render as `colorize(COLORS.teal, label)` at mid-height of the robot frame

### Integration Points
- `src/commands/chat.js:18`: `createTimedSpinner` import from `chat-ui` — primary replacement target
- `src/commands/chat.js:60`: Startup spinner — replace with wave animation
- `src/commands/chat.js:406`: Retrieval spinner — replace with search animation
- `src/commands/chat.js:436`: Generation spinner — replace with thinking animation
- `src/commands/chat.js:519,549`: Agent thinking/analyzing spinners — replace with thinking animation
- `src/commands/chat.js:399`: `showSpinners = !opts.quiet` guard — extend to use `isInteractive()`

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-robot-chat-poses*
*Context gathered: 2026-03-07*
