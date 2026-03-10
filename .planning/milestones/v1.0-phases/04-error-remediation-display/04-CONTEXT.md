# Phase 4: Error Remediation Display - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Surface the `.fix` remediation property from nano errors in command catch blocks so users see actionable fix commands when `--local` operations fail. Remove dead code. Add test coverage.

</domain>

<decisions>
## Implementation Decisions

### Error display pattern
- Reuse existing `formatNanoError()` from nano-errors.js (already used in nano-setup.js)
- Check `err.code && err.fix` before calling formatNanoError; fall back to `ui.error(err.message)` for non-nano errors
- Target catch blocks: embed.js:276, ingest.js:428, pipeline.js:356

### Dead code removal
- Remove `validateResponse` export from nano-protocol.js (unused)

### Test approach
- Verify `.fix` property appears in command error output for nano errors
- Follow existing test patterns in the project

### Claude's Discretion
- Exact test structure and assertion style
- Whether to extract a shared error handler or inline the pattern

</decisions>

<specifics>
## Specific Ideas

No specific requirements -- the pattern already exists in nano-setup.js:297-301. Copy that approach into the three command catch blocks.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `formatNanoError(err)` in src/nano/nano-errors.js:96 -- formats error message + `.fix` text
- `createNanoError(code, ...args)` -- creates errors with `.code`, `.message`, `.fix` properties
- Existing pattern in src/nano/nano-setup.js:299 -- `if (err.code && err.fix) { formatNanoError(err) }`

### Established Patterns
- Commands use `ui.error(err.message)` for display, `process.exit(1)` for failure
- Telemetry `cli_error` event sent before error display

### Integration Points
- src/commands/embed.js:276-280 -- outer catch block
- src/commands/ingest.js:428-432 -- outer catch block
- src/commands/pipeline.js:356-365 -- outer catch block (has special EPIPE handling)
- src/nano/nano-protocol.js:85 -- dead validateResponse export to remove

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 04-error-remediation-display*
*Context gathered: 2026-03-06*
