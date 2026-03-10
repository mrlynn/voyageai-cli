# Phase 16: Embedding Config - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can choose their embedding model in chat and the selection drives retrieval. Covers the playground UI dropdown, backend wiring, CLI flag addition, and auto-default logic. Does NOT include onboarding/detection (Phase 17), status bar display (Phase 18), or KB ingest (Phase 19).

</domain>

<decisions>
## Implementation Decisions

### Dropdown placement & design
- New row inside the existing Configuration section of the KB sidebar panel, after the LLM Model row
- Label: "Embedding" (plain, matching existing "LLM Provider" / "Model" style — no tooltip)
- Colored pill badges: green "LOCAL" pill for nano, blue "API" pill for cloud models
- Badges visible in both collapsed (selected) state AND expanded options list

### Model list & filtering
- Voyage 4 family only: voyage-4-nano, voyage-4-lite, voyage-4, voyage-4-large
- Ordered: local first, then by cost ascending (nano free, lite $0.02, 4 $0.06, large $0.12)
- Show pricing next to each option in the dropdown
- All 4 models always visible; unavailable ones grayed out with reason tooltip ("Run vai nano setup" or "API key required")

### Auto-default logic
- Default priority: nano if set up > voyage-4-large if API key exists > all disabled
- When BOTH nano and API key exist, default to nano (favor free/local)
- Selection persists across sessions (saved to config alongside other chat settings)
- Mid-conversation switching allowed — takes effect on next message, no warning needed (shared embedding space makes this safe)
- If selected model becomes unavailable (e.g., nano bridge crashes): show inline error on dropdown row, suggest switching to API model — do NOT auto-fallback

### Backend wiring
- Embedding model sent in each POST /api/chat/message request as `embeddingModel` field (stateless, per-message)
- Backend validates model availability before retrieval: nano selected -> check bridge running; API model -> check API key present. Return clear error if unavailable.
- Reranking auto-disabled when nano is selected (matches existing CLI --local behavior, keeps zero-cost path)
- CLI gets new `--embedding-model <name>` flag accepting any Voyage 4 model name; `--local` becomes shorthand for `--embedding-model voyage-4-nano`

### Claude's Discretion
- Exact CSS styling for pill badges (colors, border-radius, font size)
- How disabled state looks in the native `<select>` vs custom dropdown
- Error message wording for unavailable models
- Whether to use native `<select>` or custom dropdown component

</decisions>

<specifics>
## Specific Ideas

- The dropdown should feel like a natural extension of the existing Configuration section — same row height, label alignment, and select styling
- Pricing display helps users make cost-aware decisions without needing external reference
- The shared embedding space across Voyage 4 models is the key enabler for mid-conversation switching — this should "just work" without warnings

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `MODEL_CATALOG` in `src/lib/catalog.js`: Full model catalog with `local`, `pricePerMToken`, `sharedSpace`, `family` fields — perfect for filtering Voyage 4 family and generating dropdown options
- KB sidebar Configuration section in `src/playground/index.html` (~line 8722): Existing `<select>` elements for LLM Provider, Model, Chat Mode — new Embedding row slots in here
- `src/lib/chat.js`: Chat orchestrator with `generateEmbeddings()` call — wiring point for model selection
- `src/commands/chat.js`: CLI chat command with `--local` flag and `resolveLLMConfig()` pattern
- `src/nano/nano-health.js`: `checkVenv()` and `checkModel()` for nano availability detection
- `src/lib/api.js`: `generateEmbeddings()` and `getApiKey()` for API model availability detection

### Established Patterns
- Config persistence: `setConfigValue()` / `getConfigValue()` from `src/lib/config.js`
- Playground API: `/api/chat/config` GET and `/api/chat/message` POST endpoints
- Badge pattern: No existing pill badge pattern in config section — this will be a new visual element
- Disabled options: No existing pattern for disabled `<select>` options with tooltips — may need custom dropdown

### Integration Points
- KB sidebar Configuration section (`#chatProvider`, `#chatModel` selects) — add `#chatEmbeddingModel` select
- `/api/chat/message` handler — accept and pass through `embeddingModel` param
- `chatTurn()` in `src/lib/chat.js` — route to nano bridge or Voyage API based on model name
- CLI `registerChat()` in `src/commands/chat.js` — add `--embedding-model` option

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-embedding-config*
*Context gathered: 2026-03-07*
