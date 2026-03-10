# Phase 4: Error Remediation Display - Research

**Researched:** 2026-03-06
**Domain:** CLI error handling -- surfacing `.fix` remediation in command catch blocks
**Confidence:** HIGH

## Summary

This phase is a small, well-scoped integration task. The error taxonomy (`nano-errors.js`) already defines `.fix` strings for every error code, and `formatNanoError()` already formats them for display. The pattern is already used in `nano-setup.js:297-301`. The three command catch blocks (`embed.js`, `ingest.js`, `pipeline.js`) currently display errors with `ui.error(err.message)` but never show the `.fix` property. The fix is to add a conditional check in each catch block.

Additionally, `validateResponse` in `nano-protocol.js` is exported but never imported anywhere in the `src/` directory. It should be removed (the function itself and its export). The corresponding test in `nano-protocol.test.js` should also be removed.

**Primary recommendation:** Copy the `if (err.code && err.fix)` pattern from `nano-setup.js:299` into the three command catch blocks, remove dead `validateResponse` code, add a test verifying `.fix` appears in formatted output.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Reuse existing `formatNanoError()` from nano-errors.js (already used in nano-setup.js)
- Check `err.code && err.fix` before calling formatNanoError; fall back to `ui.error(err.message)` for non-nano errors
- Target catch blocks: embed.js:276, ingest.js:428, pipeline.js:356
- Remove `validateResponse` export from nano-protocol.js (unused)
- Verify `.fix` property appears in command error output for nano errors
- Follow existing test patterns in the project

### Claude's Discretion
- Exact test structure and assertion style
- Whether to extract a shared error handler or inline the pattern

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BRDG-04 | Every failure mode has a clear error message with an actionable remediation command | The `.fix` property exists on all nano errors (verified in nano-errors.js). `formatNanoError()` already displays it. Three command catch blocks need the conditional to surface it. Test confirms output contains `.fix` text. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node:test | built-in | Test runner | Already used across all test files in project |
| node:assert/strict | built-in | Assertions | Already used across all test files in project |
| picocolors | (installed) | Terminal colors | Used by `ui.js` for error/success/warn formatting |

No new dependencies needed. This phase uses only existing project code.

## Architecture Patterns

### Error Display Pattern (from nano-setup.js:297-301)

The canonical pattern already exists and should be copied verbatim:

```javascript
// Source: src/nano/nano-setup.js lines 297-301
} catch (err) {
  // ... spinner/telemetry handling ...
  if (err.code && err.fix) {
    console.error(formatNanoError(err));
  } else {
    console.error(ui.error(err.message));
  }
  process.exit(1);
}
```

### Target Catch Blocks

**embed.js:276-280** -- Simple catch, no special handling:
```javascript
} catch (err) {
  telemetry.send('cli_error', { command: 'embed', errorType: err.constructor.name });
  console.error(ui.error(err.message));   // <-- replace this line
  process.exit(1);
}
```

**ingest.js:428-434** -- Has `finally` block for client cleanup:
```javascript
} catch (err) {
  telemetry.send('cli_error', { command: 'ingest', errorType: err.constructor.name });
  console.error(ui.error(err.message));   // <-- replace this line
  process.exit(1);
} finally {
  if (client) await client.close();
}
```

**pipeline.js:356-368** -- Has special EPIPE handling + `finally` block:
```javascript
} catch (err) {
  telemetry.send('cli_error', { command: 'pipeline', errorType: err.constructor.name });
  const isEpipe = err.code === 'EPIPE' || err.message?.includes('EPIPE');
  if (isEpipe) {
    console.error(ui.error('Connection closed while writing to MongoDB (EPIPE).'));
    console.error(ui.dim('  Try: --store-batch-size 50  or check network/Atlas connectivity.'));
  } else {
    console.error(ui.error(err.message));   // <-- replace this line (inside else)
  }
  process.exit(1);
} finally {
  if (client) await client.close();
}
```

Note: pipeline.js EPIPE handling should remain. The nano error check goes in the `else` branch, before the generic fallback.

### Import Required

Each command file needs `formatNanoError` imported:
```javascript
const { formatNanoError } = require('../nano/nano-errors.js');
```

### Dead Code Removal Pattern

In `nano-protocol.js`:
1. Remove the `validateResponse` function (lines 65-78)
2. Remove `validateResponse` from the `module.exports` object (line 85)

In `test/nano/nano-protocol.test.js`:
1. Remove `validateResponse` from the destructured require (line 9)
2. Remove the entire `describe('validateResponse', ...)` block (lines 99-122)

### Anti-Patterns to Avoid
- **Extracting a shared error handler function**: Overkill for three identical two-line conditionals. Inline the pattern.
- **Changing the EPIPE handling in pipeline.js**: The EPIPE check is intentional and separate from nano errors. Don't merge them.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Error formatting with remediation | Custom formatter | `formatNanoError()` from nano-errors.js | Already handles message + fix display |
| Error code detection | Type checking or instanceof | `err.code && err.fix` guard | Matches existing pattern, works with any error that has these properties |

## Common Pitfalls

### Pitfall 1: Missing import of formatNanoError
**What goes wrong:** ReferenceError at runtime if `formatNanoError` is not imported
**How to avoid:** Add `const { formatNanoError } = require('../nano/nano-errors.js');` to each command file

### Pitfall 2: Breaking EPIPE handling in pipeline.js
**What goes wrong:** Nano error check could shadow the EPIPE-specific error message
**How to avoid:** Insert nano error check inside the existing `else` branch, before the generic `ui.error()` fallback. Order: EPIPE check first, then nano error check, then generic fallback.

### Pitfall 3: Removing validateResponse function but not its tests
**What goes wrong:** Test file imports a non-existent export, all tests in that file fail
**How to avoid:** Remove both the export AND the test describe block AND the import reference

## Code Examples

### Modified embed.js catch block
```javascript
const { formatNanoError } = require('../nano/nano-errors.js');
// ...
} catch (err) {
  telemetry.send('cli_error', { command: 'embed', errorType: err.constructor.name });
  if (err.code && err.fix) {
    console.error(formatNanoError(err));
  } else {
    console.error(ui.error(err.message));
  }
  process.exit(1);
}
```

### Modified pipeline.js catch block (preserving EPIPE)
```javascript
const { formatNanoError } = require('../nano/nano-errors.js');
// ...
} catch (err) {
  telemetry.send('cli_error', { command: 'pipeline', errorType: err.constructor.name });
  const isEpipe = err.code === 'EPIPE' || err.message?.includes('EPIPE');
  if (isEpipe) {
    console.error(ui.error('Connection closed while writing to MongoDB (EPIPE).'));
    console.error(ui.dim('  Try: --store-batch-size 50  or check network/Atlas connectivity.'));
  } else if (err.code && err.fix) {
    console.error(formatNanoError(err));
  } else {
    console.error(ui.error(err.message));
  }
  process.exit(1);
}
```

### Test pattern (node:test style)
```javascript
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createNanoError, formatNanoError } = require('../../src/nano/nano-errors.js');

describe('error remediation display (BRDG-04)', () => {
  it('formatNanoError output includes the .fix remediation text', () => {
    const err = createNanoError('NANO_VENV_MISSING');
    const output = formatNanoError(err);
    assert.ok(output.includes(err.fix), 'output must contain the fix text');
    assert.ok(output.includes(err.message), 'output must contain the error message');
  });
});
```

## State of the Art

No technology changes relevant -- this is pure internal refactoring using existing patterns.

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ui.error(err.message)` only | `formatNanoError(err)` with `.fix` | This phase | Users see remediation commands on failure |

## Open Questions

1. **Where to place the new test file?**
   - Recommendation: Add assertions to existing `test/nano/nano-errors.test.js` since it already tests `formatNanoError`, OR create a lightweight integration-style test. The existing test at line 52-58 already verifies `formatNanoError` includes `.fix` text, so the main gap is verifying the *command catch blocks* call it. Given the commands are hard to unit-test (they use Commander + process.exit), a unit test on `formatNanoError` output is the pragmatic choice -- and it already exists. Consider adding a test that simulates the conditional pattern instead.

## Sources

### Primary (HIGH confidence)
- Direct source code inspection of: `src/nano/nano-errors.js`, `src/nano/nano-setup.js`, `src/nano/nano-protocol.js`, `src/commands/embed.js`, `src/commands/ingest.js`, `src/commands/pipeline.js`
- Direct source code inspection of: `test/nano/nano-errors.test.js`, `test/nano/nano-protocol.test.js`
- `grep` for `validateResponse` across `src/` confirms zero usage outside its definition

### Secondary (MEDIUM confidence)
- None needed -- all findings from direct code inspection

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all existing code
- Architecture: HIGH - pattern already exists in nano-setup.js, verified by reading source
- Pitfalls: HIGH - identified from reading the actual catch blocks and their differences

**Research date:** 2026-03-06
**Valid until:** Indefinite (internal code patterns, not external dependencies)
