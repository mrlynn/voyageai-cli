---
phase: 28-config-reference-cross-links
plan: 01
subsystem: docs
tags: [reference, environment-variables, configuration, vai-json, chat, memory, mdx]

# Dependency graph
requires:
  - phase: 27-playground-documentation
    provides: MDX frontmatter and table patterns established for reference pages
  - phase: 26-chat-command-documentation
    provides: chat.mdx flag reference (linked from See Also sections)
provides:
  - docs/reference/environment-variables.mdx -- complete env var reference page (20+ variables)
  - docs/reference/vai-json-schema.mdx -- full .vai.json schema including v1.5 chat block
affects: [28-02, future cross-reference plans, vai explain harness topic]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reference page frontmatter: title, description, sidebar_position"
    - "Environment variable tables: Variable | Description | Default"
    - "Schema field tables with Type and Default columns"
    - "Chat block fields table: Field | Type | CLI Equivalent | Description | Default"
    - "Docusaurus details/summary block for annotated JSON examples"
    - "v1.5 note using :::note Added in v1.5 ::: admonition"

key-files:
  created:
    - docs/reference/environment-variables.mdx
    - docs/reference/vai-json-schema.mdx
  modified:
    - .gitignore (added docs/reference/ to tracked paths whitelist)

key-decisions:
  - "Session/Memory/Observability section in env vars page explains v1.5 additions without fabricating env vars -- points to CLI flags and .vai.json chat block instead"
  - "docs/reference/ needed .gitignore whitelist addition (same pattern as docs/guides/, docs/commands/)"
  - "showSources and showToolCalls documented as config-only (no CLI equivalent) to distinguish from flag-backed fields"

patterns-established:
  - "Reference pages live in docs/reference/ with sidebar_position starting at 10"
  - "See Also on both pages links to vai explain harness (enabling XREF-01 in Plan 02)"
  - "Resolution order: CLI flag > env var > .vai.json > hardcoded default (documented in schema page)"

requirements-completed: [CONF-01, CONF-02]

# Metrics
duration: 3min
completed: 2026-03-09
---

# Phase 28 Plan 01: Config Reference Cross-Links Summary

**Two MDX reference pages covering all 20+ environment variables and the complete .vai.json schema (including v1.5 chat block with 8 fields), establishing the docs/reference/ directory**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-09T16:51:06Z
- **Completed:** 2026-03-09T16:53:16Z
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 updated)

## Accomplishments

- Created `docs/reference/environment-variables.mdx` with all env vars organized into 8 sections (Core, LLM, Project Defaults, Session/Memory/Observability, Display/UX, MCP, Playground, Telemetry, Advanced/Debug)
- Created `docs/reference/vai-json-schema.mdx` with root fields table, chunk block, and full v1.5 chat block documenting all 8 chat config fields with types, CLI equivalents, descriptions, and defaults
- Both pages follow the established MDX frontmatter and table patterns from Phase 26/27 and include `vai explain harness` in See Also sections

## Task Commits

Each task was committed atomically:

1. **Task 1: Create environment variables reference page** - `f164882` (feat)
2. **Task 2: Create .vai.json schema reference page** - `311a949` (feat)

## Files Created/Modified

- `docs/reference/environment-variables.mdx` - All VAI_* and VOYAGE_API_* env vars in 8 sections
- `docs/reference/vai-json-schema.mdx` - Full .vai.json schema including v1.5 chat block
- `.gitignore` - Added `!/docs/reference/` and `!/docs/reference/**` to whitelist

## Decisions Made

- Session/Memory/Observability section in env-vars page avoids fabricating env vars — explains that session/memory is controlled via CLI flags and .vai.json chat block instead, which accurately reflects the codebase
- `showSources` and `showToolCalls` documented as config-only (no CLI equivalent) clearly distinguished from the flag-backed fields
- `docs/reference/` directory required a .gitignore whitelist addition (same pattern already used for `docs/guides/`, `docs/commands/`, `docs/playground/`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added docs/reference/ to .gitignore whitelist**
- **Found during:** Task 1 (Create environment variables reference page)
- **Issue:** `.gitignore` has `/docs/*` glob that blocks all docs subdirectories unless explicitly whitelisted. `docs/reference/` was not in the whitelist, causing `git add` to reject the new file.
- **Fix:** Added `!/docs/reference/` and `!/docs/reference/**` to `.gitignore` following the same pattern already used for `docs/guides/`, `docs/commands/`, and `docs/playground/`
- **Files modified:** `.gitignore`
- **Verification:** `git add docs/reference/environment-variables.mdx` succeeded after fix
- **Committed in:** `f164882` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking)
**Impact on plan:** Necessary infrastructure fix. No scope creep.

## Issues Encountered

None beyond the .gitignore deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both reference pages exist and pass all plan verification checks
- `vai explain harness` cross-link present in both pages, ready for Plan 02 (XREF-01 coverage)
- `docs/reference/` directory established with sidebar_position 10/11 slots for future reference pages

---
*Phase: 28-config-reference-cross-links*
*Completed: 2026-03-09*
