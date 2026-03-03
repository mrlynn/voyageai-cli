# vai Social Awareness Dashboard - Roadmap

**Created:** 2026-03-02
**Depth:** Quick
**Phases:** 5
**Coverage:** 12/12 v1 requirements mapped

## Phases

- [x] **Phase 1: Foundation** - Project setup, Next.js scaffolding, OpenAI integration configured
- [ ] **Phase 2: Knowledge Base** - Import, index, and retrieve vai documentation and codebase context
- [ ] **Phase 3: Content Generation Engine** - Generate blog posts, social posts, code examples, and video scripts via OpenAI
- [ ] **Phase 4: Platform Formatting & Library** - Format generated content for LinkedIn, Dev.to/Hashnode, and Discord/Slack
- [ ] **Phase 5: Dashboard & Campaign Management** - Content calendar, draft library, and performance tracking

## Phase Details

### Phase 1: Foundation

**Goal:** Project infrastructure ready to build content generation features

**Depends on:** Nothing (first phase)

**Requirements:** None (foundational setup)

**Success Criteria** (what must be TRUE):
1. Next.js project is scaffolded, runs locally, and deploys to Vercel
2. OpenAI API client is configured with authentication and error handling
3. Development environment has TypeScript, linting, and testing setup ready
4. Project structure supports modular content generation, knowledge sources, and dashboard components

**Plans:**
2/2 plans complete
- [x] 01-01: Next.js scaffold with TypeScript, Tailwind CSS v4, Jest, feature directories (Wave 1)
- [x] 01-02: OpenAI client module + health API route + Vercel deployment (Wave 2)

---

### Phase 2: Knowledge Base

**Goal:** System can access vai documentation, codebase, and context to inform content generation

**Depends on:** Phase 1

**Requirements:** KNOW-01, KNOW-02

**Success Criteria** (what must be TRUE):
1. User can index vai docs (README, API docs, tutorials) and system retrieves relevant sections
2. User can analyze vai codebase (key modules, functions, patterns) for technical accuracy
3. Content generation prompts include relevant knowledge source excerpts automatically
4. Knowledge sources are searchable and versioned for tracking context over time

**Plans:**
2/4 plans complete
- [x] 02-01: Knowledge source types + MongoDB data layer + CRUD REST API (Wave 1)
- [x] 02-02: Ingestion engine — file/URL/codebase chunking, embedding, fingerprinting (Wave 2)
- [ ] 02-03: Retrieval API + RAG injection helper for Phase 3 (Wave 3)
- [ ] 02-04: Knowledge Base dashboard UI — source list, add form, staleness, test retrieval panel (Wave 3)

---

### Phase 3: Content Generation Engine

**Goal:** User can generate high-quality content drafts for all major content types via AI

**Depends on:** Phase 2

**Requirements:** CGEN-01, CGEN-02, CGEN-03, CGEN-04

**Success Criteria** (what must be TRUE):
1. User can generate blog post drafts (tutorials, deep-dives, use cases) using vai knowledge as context
2. User can generate short-form social posts optimized for professional tone
3. User can generate working code examples showcasing vai capabilities with proper formatting
4. User can generate video scripts (YouTube, Loom, short-form) with timing and speaker notes

**Plans:** TBD

---

### Phase 4: Platform Formatting & Library

**Goal:** Generated content is formatted for direct copy-paste publishing to target platforms

**Depends on:** Phase 3

**Requirements:** PLAT-01, PLAT-02, PLAT-03

**Success Criteria** (what must be TRUE):
1. Content formatted for LinkedIn includes proper character limits, hashtags, and professional structure
2. Content formatted for Dev.to/Hashnode includes markdown, front matter, and platform-specific tags
3. Content formatted for Discord/Slack includes message formatting, threads, and channel-appropriate tone
4. User can browse and copy formatted content directly to paste into publishing platforms

**Plans:** TBD

---

### Phase 5: Dashboard & Campaign Management

**Goal:** User can plan, track, and manage content campaigns across platforms

**Depends on:** Phase 4

**Requirements:** DASH-01, DASH-02, DASH-03

**Success Criteria** (what must be TRUE):
1. User can view a content calendar showing planned posts across all channels (LinkedIn, Dev.to, Discord/Slack)
2. User can browse, edit, and approve generated drafts in a single draft library
3. User can track content performance and engagement metrics per campaign
4. Dashboard provides clear visibility into content pipeline from generation to publishing

**Plans:** TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/2 | Complete    | 2026-03-02 |
| 2. Knowledge Base | 2/4 | In Progress | — |
| 3. Content Generation Engine | 0/? | Not started | — |
| 4. Platform Formatting & Library | 0/? | Not started | — |
| 5. Dashboard & Campaign Management | 0/? | Not started | — |

---

**Roadmap Status:** Phase 1 complete. Phase 2 in progress (2/4 plans complete).

Next: Execute 02-03 with `/gsd:execute-phase 2`
