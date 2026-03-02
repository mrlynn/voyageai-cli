# Requirements: vai Social Awareness Dashboard

**Defined:** 2026-03-02
**Core Value:** Developers discover vai through consistent, high-quality content that shows them exactly how vai solves their embedding and retrieval problems.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Content Generation

- [ ] **CGEN-01**: User can generate blog post drafts (tutorials, feature deep-dives, use cases) via OpenAI
- [ ] **CGEN-02**: User can generate short-form social posts formatted for LinkedIn
- [ ] **CGEN-03**: User can generate working code example snippets showcasing vai capabilities
- [ ] **CGEN-04**: User can generate video scripts for YouTube, Loom, and short-form video

### Knowledge Sources

- [ ] **KNOW-01**: System imports and indexes vai docs, README, and docs.vaicli.com as content context
- [ ] **KNOW-02**: System analyzes vai codebase for technical accuracy in generated content

### Dashboard

- [ ] **DASH-01**: User can view a content calendar with planned content across channels
- [ ] **DASH-02**: User can browse, edit, and approve AI-generated drafts in a draft library
- [ ] **DASH-03**: User can track content performance and engagement metrics per campaign

### Platform Formatting

- [ ] **PLAT-01**: Content is formatted for LinkedIn (character limits, hashtags, professional tone)
- [ ] **PLAT-02**: Content is formatted for Dev.to/Hashnode (markdown, tags, front matter)
- [ ] **PLAT-03**: Content is formatted for Discord/Slack (message formatting, thread structure)

## v2 Requirements

### Knowledge Sources

- **KNOW-03**: System compares vai vs competitors (OpenAI embeddings, Pinecone, Weaviate) for positioning content
- **KNOW-04**: System incorporates real usage patterns and community feedback

### Publishing

- **PUBL-01**: System auto-publishes to LinkedIn via API after approval
- **PUBL-02**: System auto-publishes to Dev.to via API after approval
- **PUBL-03**: System posts to Discord/Slack channels via webhooks

### Collaboration

- **COLB-01**: Multiple users can access the dashboard with basic auth
- **COLB-02**: Team members can assign and review content drafts

## Out of Scope

| Feature | Reason |
|---------|--------|
| Twitter/X integration | Focusing on LinkedIn, Dev.to, Discord/Slack for developer audience |
| Auto-publishing via platform APIs | Copy-paste workflow for v1 simplicity |
| Multi-user auth | Single user for v1, reduces complexity |
| Mobile app | Web dashboard only |
| Analytics integrations (Google Analytics, etc.) | Manual tracking for v1 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CGEN-01 | Phase 3 | Pending |
| CGEN-02 | Phase 3 | Pending |
| CGEN-03 | Phase 3 | Pending |
| CGEN-04 | Phase 3 | Pending |
| KNOW-01 | Phase 2 | Pending |
| KNOW-02 | Phase 2 | Pending |
| DASH-01 | Phase 5 | Pending |
| DASH-02 | Phase 5 | Pending |
| DASH-03 | Phase 5 | Pending |
| PLAT-01 | Phase 4 | Pending |
| PLAT-02 | Phase 4 | Pending |
| PLAT-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0

---

*Requirements defined: 2026-03-02*
*Last updated: 2026-03-02 after roadmap creation*
