# vai Social Awareness Dashboard

## What This Is

A Next.js web dashboard for managing developer outreach and content marketing for vai (voyageai-cli). It uses OpenAI to generate content drafts — blog posts, social posts, code examples, and video scripts — informed by vai's documentation, codebase, usage patterns, and competitor landscape. Content is formatted for copy-paste publishing to LinkedIn, Dev.to/Hashnode, and Discord/Slack.

## Core Value

Developers discover vai through consistent, high-quality content that shows them exactly how vai solves their embedding and retrieval problems.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] AI-powered content generation using OpenAI, pulling context from vai docs/codebase/usage/competitors
- [ ] Content calendar for planning and scheduling outreach across channels
- [ ] Ready-to-post content library with drafts formatted per platform (LinkedIn, Dev.to/Hashnode, Discord/Slack)
- [ ] Blog post generation (long-form tutorials, feature deep-dives, use cases)
- [ ] Social post generation (short-form for LinkedIn)
- [ ] Code example generation (working snippets showcasing vai capabilities)
- [ ] Video script generation (YouTube, Loom, short-form)
- [ ] Campaign tracking to measure what content performs well
- [ ] Platform-specific formatting (copy-paste ready for each channel)
- [ ] Single-user dashboard (no auth required)

### Out of Scope

- Auto-publishing via platform APIs — copy-paste for v1
- Twitter/X integration — focusing on LinkedIn, Dev.to, Discord/Slack
- Multi-user auth and team collaboration — single user for now
- Mobile app — web dashboard only
- Direct platform API integrations for posting

## Context

- vai is an existing CLI tool (`voyageai-cli` on npm) providing Voyage AI embedding and retrieval capabilities
- vai includes MCP server functionality, a web playground, and an Electron desktop app
- The dashboard is a separate repo/project that references vai's docs and codebase for content source material
- Target audience: developers who need embedding/retrieval solutions and may not know about vai
- Competitor landscape includes OpenAI embeddings, Pinecone, Weaviate, and other vector search tools

## Constraints

- **Stack**: Next.js — deployed on Vercel or similar
- **AI Provider**: OpenAI API for content generation
- **Repo**: Separate repository from voyageai-cli
- **User**: Single user, no authentication infrastructure needed
- **Publishing**: Copy-paste workflow, no platform API integrations

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js for dashboard | React-based, great for dashboards, easy Vercel deployment | — Pending |
| OpenAI for content generation | User preference for content drafting engine | — Pending |
| Separate repo from vai | Clean separation of concerns, different deployment | — Pending |
| Copy-paste over auto-publish | Simpler v1, no API key management for social platforms | — Pending |
| No auth for v1 | Single user, reduces complexity | — Pending |

---
*Last updated: 2026-03-02 after initialization*
