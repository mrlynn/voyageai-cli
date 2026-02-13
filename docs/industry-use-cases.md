# FEATURE SPECIFICATION

## **vai Industry Use Cases**

### Domain-Specific "Zero to RAG" Walkthroughs & Marketing Pages

**Version 1.0 | February 2026**

**Target: vai-site (vai.mlynn.org)**

**Author:** Michael Lynn

**Repository:** [github.com/mrlynn/vai-site](https://github.com/mrlynn/vai-site) · `/Users/michael.lynn/code/vai-site`

---

## 1. Executive Summary

vai already demonstrates how to build RAG pipelines — but every example is generic. "Embed these documents, search them, get results." This tells developers *how* the tool works but not *why it matters for their work*.

Industry use cases close this gap. Each use case is a self-contained, completable walkthrough that takes a specific professional persona from "I have these domain documents" to "I have a working knowledge base I can query" — in under 30 minutes. The walkthrough runs against a curated, small-scope sample document set (10–20 files) bundled with each use case, so every command produces real, meaningful results.

These are simultaneously **marketing pages** (showing domain-specific value), **tutorials** (teaching vai's pipeline), and **demos** (running against real documents). The limited scope is intentional — a user finishes the walkthrough with a working system and the confidence to scale it to their own corpus.

### 1.1 What This Enables

- **Domain-specific entry points:** A healthcare professional, legal researcher, financial analyst, or developer lead finds a page that speaks their language, uses their documents, and solves their problems
- **Completable walkthroughs:** Each use case has a bundled sample document set small enough to process in minutes, but realistic enough to produce meaningful results
- **Marketing-grade landing pages:** Hosted on vai.mlynn.org with SEO, OpenGraph, and structured data optimized for each domain
- **Reusable template:** A consistent structure that makes adding new industry verticals straightforward — write the content, provide the sample docs, and the page framework handles the rest
- **Lead generation for vai adoption:** Each page ends with natural next steps that drive `npm install -g voyageai-cli` and GitHub stars

### 1.2 Design Principles

1. **Show, don't describe.** Every page runs real vai commands against real documents with real output. No mock results, no placeholder data.
2. **Completable in 30 minutes.** The sample document set is intentionally small (10–20 files, < 500KB total). A user can go from `npm install` to querying their knowledge base in a single sitting.
3. **Domain-native language.** Each page speaks the vocabulary of its audience. A legal page discusses "contract clauses" and "regulatory compliance," not "text chunks" and "vector embeddings." The technical concepts are introduced through the domain lens.
4. **Progressive depth.** The page starts with the value proposition (30 seconds), moves to the walkthrough (20 minutes), and ends with "what's next" for scaling to production (5 minutes). A visitor can stop at any level.
5. **Consistent pipeline, varied content.** Every use case follows the same vai pipeline (ingest → chunk → embed → search → query). The variation is in the documents, the queries, the domain-specific model selection, and the narrative framing.

---

## 2. The Four Initial Domains

### 2.1 Selection Criteria

The initial four domains were chosen based on:

- **Voyage AI model coverage** — domains where Voyage AI offers specialized models (law, finance, code) get a natural product tie-in
- **Document availability** — domains where realistic sample documents can be created or sourced under permissive licenses
- **Audience reach** — domains with large developer-adjacent professional populations
- **RAG value clarity** — domains where "search your own documents and get grounded answers" is an immediately obvious improvement over status quo

### 2.2 The Four Domains

| # | Domain | Slug | Voyage AI Model | Target Persona |
|---|--------|------|----------------|----------------|
| 1 | **Healthcare & Clinical** | `/use-cases/healthcare` | `voyage-4-large` | Clinical informaticist, health-tech developer, care team lead |
| 2 | **Legal & Compliance** | `/use-cases/legal` | `voyage-law-2` | Legal technologist, compliance officer, paralegal building tools |
| 3 | **Financial Services** | `/use-cases/finance` | `voyage-finance-2` | Fintech developer, analyst building internal tools, risk team |
| 4 | **Developer Documentation** | `/use-cases/devdocs` | `voyage-code-3` | Engineering lead, DevRel, platform team building internal search |

Each domain gets its own page under `/use-cases/{slug}`, plus a landing page at `/use-cases` that serves as a directory.

---

## 3. Use Case Template — Universal Structure

Every industry use case page follows the same structural template. This section defines that template. Sections 4–7 fill it in for each specific domain.

### 3.1 Page Sections

Each use case page contains these sections in order:

| # | Section | Purpose | Approximate Length |
|---|---------|---------|-------------------|
| 1 | **Hero** | Domain-specific headline, one-liner, and visual | 1 screen |
| 2 | **The Problem** | Why this domain needs RAG — the pain point in their language | 2–3 paragraphs |
| 3 | **The Solution** | How vai solves it — the pipeline mapped to their workflow | 1 pipeline diagram + 2 paragraphs |
| 4 | **Sample Document Set** | What's included, what it represents, how to download | Table + download button |
| 5 | **Walkthrough** | Step-by-step from install to query, with real commands and output | 6–8 steps, ~15 minutes reading |
| 6 | **Example Queries & Results** | 3–5 domain-specific queries with realistic results | Formatted query/response pairs |
| 7 | **Why This Model?** | The Voyage AI model used and why it's the right choice for this domain | 1 comparison table + paragraph |
| 8 | **Scaling to Production** | What changes when moving from 20 sample docs to 20,000 real ones | Bullet points + cost estimate |
| 9 | **Call to Action** | Install vai, star the repo, explore other use cases | Buttons + links |

### 3.2 Sample Document Sets

Each use case ships with a curated document set. These are **not** real proprietary documents — they are purpose-written sample files that are realistic enough to produce meaningful search results but entirely synthetic and safe to distribute under MIT license.

**Constraints per document set:**

| Property | Requirement |
|----------|-------------|
| File count | 10–20 files |
| Total size | < 500KB (text only, no images) |
| Formats | `.md` and `.txt` (universally readable, no special parsers needed) |
| Content | Synthetic but domain-realistic — written to cover overlapping topics so search results are interesting |
| License | MIT — included in the sample set, safe to redistribute |
| Location | `/public/use-cases/{slug}/sample-docs/` in vai-site, also downloadable as `.zip` |

### 3.3 Walkthrough Step Template

Every walkthrough follows this sequence of vai commands:

```
Step 1: Install vai (if not already installed)
        npm install -g voyageai-cli

Step 2: Configure credentials
        vai config set api-key YOUR_VOYAGE_KEY
        vai config set mongodb-uri YOUR_MONGODB_URI

Step 3: Download the sample documents
        (download link or curl command)

Step 4: Initialize the project
        vai init
        (pre-configured .vai.json for this domain)

Step 5: Ingest & embed the documents
        vai pipeline ./sample-docs/ --db {db} --collection {collection} --create-index

Step 6: Verify the knowledge base
        vai search "test query" --db {db} --collection {collection}

Step 7: Run domain-specific queries
        vai query "{domain-specific question}" --db {db} --collection {collection}

Step 8: (Optional) Explore in the playground
        vai playground
```

Each step shows the exact command, the expected terminal output (screenshot or formatted code block), and a brief explanation of what's happening.

---

## 4. Use Case 1: Healthcare & Clinical

### 4.1 Overview

| Property | Value |
|----------|-------|
| **Slug** | `/use-cases/healthcare` |
| **Headline** | "Build a Clinical Knowledge Base in 20 Minutes" |
| **Subheadline** | "From clinical guidelines to searchable AI — using your own infrastructure" |
| **Target persona** | Clinical informaticist, health-tech developer, care team lead building internal tools |
| **Voyage AI model** | `voyage-4-large` (best general-purpose accuracy for clinical text) |
| **MongoDB database** | `healthcare_demo` |
| **Collection** | `clinical_knowledge` |

### 4.2 The Problem (Page Copy)

Healthcare teams drown in clinical documentation. Treatment guidelines update quarterly. Drug interaction databases span thousands of pages. Internal protocols live in scattered wikis, PDFs, and shared drives. When a clinician needs an answer — "What's the recommended first-line treatment for Type 2 diabetes with renal impairment?" — they search through multiple systems, often settling for whatever Google returns rather than their organization's own vetted guidelines.

Standard search tools fail here because clinical questions are semantic, not keyword-based. A search for "diabetes kidney treatment" needs to find documents about "glycemic management in chronic kidney disease" — same concept, completely different words. This is exactly what embedding-based semantic search solves.

### 4.3 Sample Document Set

**Theme:** A fictional hospital system's clinical reference library — treatment guidelines, drug references, and care protocols.

| # | Filename | Topic | ~Size |
|---|----------|-------|-------|
| 1 | `diabetes-management.md` | Type 2 diabetes treatment guidelines, HbA1c targets, medication ladder | 3KB |
| 2 | `diabetes-renal.md` | Glycemic management in patients with CKD stages 3–5 | 2KB |
| 3 | `metformin-reference.md` | Metformin prescribing information, contraindications, renal dosing | 2KB |
| 4 | `sglt2-inhibitors.md` | SGLT2 inhibitor class overview, cardiovascular and renal benefits | 2KB |
| 5 | `hypertension-guidelines.md` | Blood pressure targets, first-line agents, resistant hypertension | 3KB |
| 6 | `ace-inhibitor-reference.md` | ACE inhibitor prescribing, renal protective effects, monitoring | 2KB |
| 7 | `heart-failure-protocol.md` | HFrEF and HFpEF management, GDMT optimization | 3KB |
| 8 | `anticoagulation-guide.md` | Anticoagulation selection, DOAC vs warfarin, bridging protocols | 3KB |
| 9 | `sepsis-bundle.md` | Sepsis recognition, hour-1 bundle, lactate-guided resuscitation | 2KB |
| 10 | `pain-management.md` | Acute and chronic pain protocols, opioid stewardship, multimodal approach | 2KB |
| 11 | `drug-interactions-cardiac.md` | Common drug interactions in cardiac patients, QTc prolongation risks | 2KB |
| 12 | `ckd-staging.md` | Chronic kidney disease staging, eGFR calculation, referral criteria | 2KB |
| 13 | `insulin-protocols.md` | Basal-bolus insulin, sliding scale, transition from IV to subcutaneous | 2KB |
| 14 | `discharge-checklist.md` | Hospital discharge protocol, medication reconciliation, follow-up | 2KB |
| 15 | `falls-prevention.md` | Fall risk assessment, prevention interventions, post-fall protocol | 2KB |

**Total:** 15 files, ~34KB

### 4.4 Example Queries

These demonstrate the kind of semantic understanding embedding-based search provides:

| Query | Why It's Interesting |
|-------|---------------------|
| "What medications should I avoid in a patient with kidney problems?" | Tests cross-document retrieval — answer spans metformin reference, CKD staging, ACE inhibitor docs |
| "How do I manage blood sugar in someone who can't take metformin?" | Tests the medication ladder + renal contraindication overlap |
| "What's the sepsis protocol for the first hour?" | Tests precise retrieval from the sepsis bundle |
| "My patient is on warfarin and needs to start amiodarone — what do I watch for?" | Tests drug interaction document retrieval |
| "When should I refer a patient to nephrology?" | Tests CKD staging referral criteria |

### 4.5 Why This Model?

The healthcare use case uses `voyage-4-large` because:

- Clinical text has specialized vocabulary that benefits from the highest-quality embedding model
- The document set is small enough that the cost difference between `voyage-4-large` and `voyage-4-lite` is negligible
- For a production healthcare system, accuracy is paramount — `voyage-4-large`'s 71.41 RTEB score represents the best available retrieval quality
- No domain-specific healthcare model exists in the Voyage AI lineup, so the best general-purpose model is the right choice

The walkthrough includes a benchmark comparison showing `voyage-4-large` vs. `voyage-4-lite` on the sample clinical queries to make this concrete.

### 4.6 Scaling Section Notes

The "Scaling to Production" section for healthcare should address:

- HIPAA considerations — vai processes documents locally before embedding; the vectors sent to Voyage AI don't contain readable PHI, but the text chunks stored in MongoDB do, so the Atlas cluster must be HIPAA-eligible
- Document volume — a typical hospital formulary + guideline set might be 5,000–50,000 pages; the cost estimate should cover this range
- Update frequency — clinical guidelines update; the page should mention re-running `vai pipeline` on updated docs
- `vai chat` integration — the natural next step is adding a conversational interface with `vai chat` so clinicians can ask questions in natural language

---

## 5. Use Case 2: Legal & Compliance

### 5.1 Overview

| Property | Value |
|----------|-------|
| **Slug** | `/use-cases/legal` |
| **Headline** | "Turn Your Contract Library Into a Searchable Knowledge Base" |
| **Subheadline** | "Semantic search across legal documents — powered by a model trained on legal text" |
| **Target persona** | Legal technologist, compliance officer, paralegal building search tools |
| **Voyage AI model** | `voyage-law-2` (domain-specific legal model) |
| **MongoDB database** | `legal_demo` |
| **Collection** | `legal_knowledge` |

### 5.2 The Problem (Page Copy)

Legal professionals spend 20–40% of their time searching for information. Contract review requires cross-referencing clauses across dozens of agreements. Compliance teams must verify that policies align with regulatory requirements — often across hundreds of pages of regulation. Due diligence involves reading rooms full of documents to find specific provisions.

Keyword search fails legal work because legal language is deliberately precise but wildly inconsistent across documents. One contract says "indemnification," another says "hold harmless," a third says "defense and indemnity" — all meaning approximately the same thing. A search for any one term misses the others. Semantic search understands the meaning, not just the words.

### 5.3 Sample Document Set

**Theme:** A fictional company's legal document library — contracts, policies, and regulatory summaries.

| # | Filename | Topic | ~Size |
|---|----------|-------|-------|
| 1 | `master-services-agreement.md` | MSA template with scope, payment terms, IP provisions | 4KB |
| 2 | `saas-subscription-agreement.md` | SaaS terms — uptime SLA, data handling, renewal/termination | 3KB |
| 3 | `data-processing-addendum.md` | DPA with GDPR and CCPA provisions, sub-processor obligations | 3KB |
| 4 | `nda-mutual.md` | Mutual NDA — definition of confidential information, exclusions, term | 2KB |
| 5 | `nda-unilateral.md` | One-way NDA — receiving party obligations, return/destruction | 2KB |
| 6 | `employment-agreement.md` | Standard employment terms — compensation, benefits, non-compete | 3KB |
| 7 | `independent-contractor.md` | Contractor agreement — deliverables, IP assignment, indemnification | 3KB |
| 8 | `privacy-policy.md` | Company privacy policy — data collection, retention, user rights | 3KB |
| 9 | `acceptable-use-policy.md` | AUP for SaaS product — prohibited uses, enforcement, liability caps | 2KB |
| 10 | `ip-assignment-agreement.md` | Intellectual property assignment — work product, prior inventions | 2KB |
| 11 | `gdpr-compliance-summary.md` | GDPR requirements summary — lawful basis, data subject rights, DPO | 3KB |
| 12 | `ccpa-compliance-summary.md` | CCPA requirements — consumer rights, opt-out, service provider obligations | 3KB |
| 13 | `soc2-policy-overview.md` | SOC 2 Trust Services Criteria — security, availability, confidentiality | 2KB |
| 14 | `limitation-of-liability.md` | Analysis of liability cap patterns across contract types | 2KB |
| 15 | `force-majeure-clauses.md` | Force majeure provisions — triggering events, notice requirements, remedies | 2KB |

**Total:** 15 files, ~39KB

### 5.4 Example Queries

| Query | Why It's Interesting |
|-------|---------------------|
| "What are our obligations if a customer requests deletion of their data?" | Spans GDPR summary, CCPA summary, privacy policy, and DPA |
| "Compare the indemnification provisions across our contracts" | Tests retrieval across MSA, contractor agreement, and SaaS agreement |
| "What happens if we can't meet the SLA due to a natural disaster?" | Tests force majeure + SLA interaction |
| "Do our NDAs allow sharing confidential information with sub-processors?" | Tests NDA exceptions vs. DPA sub-processor provisions |
| "What non-compete restrictions apply to former employees?" | Tests employment agreement retrieval |

### 5.5 Why This Model?

The legal use case features `voyage-law-2` — Voyage AI's domain-specific model trained on legal text:

- Legal vocabulary has distinct semantic patterns (e.g., "consideration" means something entirely different in contract law vs. general English)
- `voyage-law-2` captures these domain-specific relationships that a general-purpose model may miss
- The walkthrough includes a side-by-side comparison: run the same legal queries against `voyage-law-2` and `voyage-4-large` to show the domain model's advantage
- This is a powerful product story — "Voyage AI builds models specifically for your domain"

### 5.6 Scaling Section Notes

- Privilege and confidentiality — emphasize that documents stay in the user's MongoDB; note that text is sent to Voyage AI for embedding (with a link to Voyage AI's data handling policy)
- Contract volume — a mid-size company might have 500–5,000 contracts; show cost estimate at this scale
- Metadata filtering — legal search often needs filters (by contract type, counterparty, date range); demonstrate `--filter` with the sample set
- Integration with `vai chat` — a compliance officer asking questions about the contract library in natural language is a compelling next step

---

## 6. Use Case 3: Financial Services

### 6.1 Overview

| Property | Value |
|----------|-------|
| **Slug** | `/use-cases/finance` |
| **Headline** | "Semantic Search Across Financial Documents — In Minutes" |
| **Subheadline** | "Earnings calls, risk reports, and policy docs — searchable with a model trained on financial text" |
| **Target persona** | Fintech developer, quantitative analyst, risk team building internal tools |
| **Voyage AI model** | `voyage-finance-2` (domain-specific financial model) |
| **MongoDB database** | `finance_demo` |
| **Collection** | `financial_knowledge` |

### 6.2 The Problem (Page Copy)

Financial analysis requires synthesizing information across dozens of documents: earnings call transcripts, 10-K filings, risk committee reports, internal policy memos, and market research. An analyst asking "What did management say about margin pressure?" needs to find the relevant passage across hundreds of pages of transcripts — and keyword search returns far too many results for "margin" alone.

The financial domain also has its own vocabulary challenges. "Headwinds" means challenges. "Color" means additional detail. "Constructive" means cautiously optimistic. A semantic search system trained on financial text understands these conventions; a generic one doesn't.

### 6.3 Sample Document Set

**Theme:** A fictional public company's (Acme Corp) financial document library across multiple quarters.

| # | Filename | Topic | ~Size |
|---|----------|-------|-------|
| 1 | `q3-2025-earnings-call.md` | Acme Corp Q3 2025 earnings call transcript — revenue beat, margin pressure | 4KB |
| 2 | `q4-2025-earnings-call.md` | Q4 2025 earnings call — full-year results, 2026 guidance | 4KB |
| 3 | `q3-2025-10q-summary.md` | 10-Q highlights — revenue breakdown, operating expenses, risk factors | 3KB |
| 4 | `annual-report-summary.md` | Annual report executive summary — strategy, markets, competitive position | 3KB |
| 5 | `risk-committee-report.md` | Risk committee quarterly report — credit risk, market risk, operational risk | 3KB |
| 6 | `credit-policy.md` | Corporate credit policy — approval tiers, concentration limits, monitoring | 3KB |
| 7 | `market-risk-framework.md` | Market risk management framework — VaR methodology, stress testing | 2KB |
| 8 | `interest-rate-analysis.md` | Interest rate sensitivity analysis — duration gaps, hedging strategy | 2KB |
| 9 | `liquidity-policy.md` | Liquidity management policy — reserve requirements, stress scenarios | 2KB |
| 10 | `compliance-aml-summary.md` | AML/KYC compliance summary — CDD requirements, SAR filing triggers | 3KB |
| 11 | `vendor-risk-assessment.md` | Third-party vendor risk assessment framework — tiering, due diligence | 2KB |
| 12 | `capital-allocation-memo.md` | Capital allocation strategy memo — dividends, buybacks, M&A criteria | 2KB |
| 13 | `esg-report-summary.md` | ESG report highlights — carbon targets, diversity metrics, governance | 2KB |
| 14 | `fintech-partnership-memo.md` | Strategic memo on fintech partnership — embedded finance, API strategy | 2KB |
| 15 | `regulatory-change-tracker.md` | Regulatory change log — upcoming Basel IV, DORA, SEC climate disclosure | 2KB |

**Total:** 15 files, ~39KB

### 6.4 Example Queries

| Query | Why It's Interesting |
|-------|---------------------|
| "What did management say about margin compression and how are they addressing it?" | Tests earnings call retrieval with nuanced financial language |
| "What are our biggest risk exposures right now?" | Spans risk committee report, market risk framework, credit policy |
| "How are we preparing for upcoming regulatory changes?" | Tests regulatory change tracker + compliance documents |
| "What's the capital return strategy for next year?" | Tests capital allocation memo + earnings call guidance |
| "Do we have concentration risk in our vendor relationships?" | Tests vendor risk assessment + credit policy overlap |

### 6.5 Why This Model?

`voyage-finance-2` is purpose-built for financial text:

- Financial jargon ("headwinds," "run-rate," "accretive," "mark-to-market") has domain-specific semantics
- Earnings call language follows conventions that general models may not capture
- The walkthrough demonstrates a comparison query against both `voyage-finance-2` and `voyage-4-large` to show domain model advantages
- Cost comparison using `vai estimate` is particularly compelling for finance audiences who care about unit economics

### 6.6 Scaling Section Notes

- Data sensitivity — financial documents are often material non-public information (MNPI); emphasize that embedding vectors don't expose readable text, but MongoDB storage does contain the original text
- Scale projections — an investment firm might ingest 10,000+ documents (transcripts, filings, research notes); show cost estimate at this scale with asymmetric retrieval savings
- Metadata filtering — financial search often needs filters by date, company, document type; demonstrate `--filter` with the sample set
- Real-time ingestion — earnings calls and filings arrive on a schedule; demonstrate `vai pipeline` as part of an ingestion workflow

---

## 7. Use Case 4: Developer Documentation

### 7.1 Overview

| Property | Value |
|----------|-------|
| **Slug** | `/use-cases/devdocs` |
| **Headline** | "Make Your Engineering Docs Actually Searchable" |
| **Subheadline** | "Internal docs, API references, and runbooks — semantic search in minutes" |
| **Target persona** | Engineering lead, DevRel, platform team building internal developer experience |
| **Voyage AI model** | `voyage-code-3` (domain-specific code/developer model) |
| **MongoDB database** | `devdocs_demo` |
| **Collection** | `engineering_knowledge` |

### 7.2 The Problem (Page Copy)

Every engineering team has a documentation problem. Internal docs live across Confluence, Notion, GitHub wikis, README files, and Slack threads. The official search is terrible. Developers ask the same questions in Slack because it's faster than searching the wiki. When someone asks "How do I set up the local development environment?" — the answer exists somewhere, but nobody can find it.

The irony: developers build search systems for users but can't search their own documentation. Traditional keyword search fails because engineering docs use inconsistent terminology — "deployment," "shipping," "releasing," and "going live" might all describe the same process in different documents.

### 7.3 Sample Document Set

**Theme:** A fictional engineering team's internal documentation — architecture decisions, API references, runbooks, and onboarding guides.

| # | Filename | Topic | ~Size |
|---|----------|-------|-------|
| 1 | `architecture-overview.md` | System architecture — microservices, event bus, data stores | 3KB |
| 2 | `api-authentication.md` | API auth — OAuth 2.0 flow, JWT tokens, API keys, rate limiting | 3KB |
| 3 | `api-endpoints-users.md` | User API endpoints — CRUD, search, permissions, pagination | 3KB |
| 4 | `api-endpoints-orders.md` | Order API endpoints — create, status, webhooks, idempotency | 3KB |
| 5 | `local-dev-setup.md` | Local development environment — Docker Compose, seed data, env vars | 3KB |
| 6 | `deployment-guide.md` | Deployment process — CI/CD pipeline, staging, production, rollback | 3KB |
| 7 | `database-schema.md` | Database schema — tables, indexes, migrations, naming conventions | 3KB |
| 8 | `monitoring-runbook.md` | Monitoring and alerting — Datadog dashboards, PagerDuty escalation, common alerts | 3KB |
| 9 | `incident-response.md` | Incident response process — severity levels, communication, postmortem | 2KB |
| 10 | `onboarding-checklist.md` | New engineer onboarding — accounts, tooling, first PR, buddy system | 2KB |
| 11 | `testing-strategy.md` | Testing philosophy — unit, integration, e2e, coverage targets | 2KB |
| 12 | `feature-flags.md` | Feature flag system — LaunchDarkly setup, naming, lifecycle, cleanup | 2KB |
| 13 | `error-handling.md` | Error handling patterns — error codes, retry logic, circuit breakers | 2KB |
| 14 | `caching-strategy.md` | Caching architecture — Redis layers, TTLs, invalidation patterns | 2KB |
| 15 | `adr-001-event-sourcing.md` | ADR: Adopted event sourcing for order service — rationale, tradeoffs | 2KB |
| 16 | `adr-002-graphql.md` | ADR: Chose GraphQL over REST for new client API — rationale, migration | 2KB |

**Total:** 16 files, ~40KB

### 7.4 Example Queries

| Query | Why It's Interesting |
|-------|---------------------|
| "How do I get the development environment running on my laptop?" | Tests local-dev-setup retrieval — the most common new-hire question |
| "What happens when an API request fails — how do we handle errors?" | Spans error-handling doc, API endpoints, and circuit breaker patterns |
| "What's the process for deploying to production?" | Tests deployment guide + CI/CD pipeline + feature flag lifecycle |
| "Why did we choose event sourcing for orders?" | Tests ADR retrieval — architectural decision records |
| "How do I add a new API endpoint with authentication?" | Spans API auth, endpoint patterns, and testing strategy |

### 7.5 Why This Model?

`voyage-code-3` is optimized for code and technical documentation:

- Developer docs contain a mix of natural language, code snippets, configuration examples, and CLI commands
- `voyage-code-3` understands that `docker compose up` and "start the local development environment" are semantically related
- The walkthrough includes a comparison against `voyage-4-large` and `voyage-4-lite` showing how the code-specific model handles mixed prose+code retrieval
- This is the "default" use case closest to vai's existing audience — it should be the most polished and complete

### 7.6 Scaling Section Notes

- Source diversity — real engineering docs come from multiple sources (Git repos, Confluence, Notion); mention `vai pipeline`'s file reader support and future source connectors
- Keeping docs current — engineering docs change constantly; demonstrate re-running the pipeline on updated files
- MCP server integration — this is the use case where `vai mcp-server` is most naturally compelling: "Make your docs available to every developer's AI agent"
- `vai chat` for internal Q&A — the natural extension is a chatbot that new hires can ask questions to, powered by the team's actual documentation

---

## 8. Site Architecture

### 8.1 Route Structure

```
vai-site/src/app/
├── page.tsx                              (existing home page)
├── use-cases/
│   ├── page.tsx                          (use case directory/landing page)
│   ├── [slug]/
│   │   └── page.tsx                      (individual use case page)
│   └── layout.tsx                        (shared layout for use case pages)
```

This uses Next.js App Router dynamic routes. The `[slug]` parameter maps to the four use case slugs defined in Section 2.2. All use case data (copy, document lists, queries, commands) is defined in a data file rather than hardcoded into components.

### 8.2 New Files

```
src/
├── app/
│   └── use-cases/
│       ├── page.tsx                      # Use case directory page
│       ├── layout.tsx                    # Shared layout (Navbar + Footer)
│       └── [slug]/
│           └── page.tsx                  # Individual use case page
├── components/
│   └── use-cases/
│       ├── UseCaseHero.tsx               # Domain-specific hero section
│       ├── ProblemSection.tsx            # "The Problem" narrative
│       ├── SolutionPipeline.tsx          # Pipeline diagram mapped to domain
│       ├── SampleDocsList.tsx            # Document set table + download
│       ├── WalkthroughStepper.tsx        # Step-by-step walkthrough with code
│       ├── CommandBlock.tsx              # Styled terminal command + output
│       ├── ExampleQueries.tsx            # Query/result showcase
│       ├── ModelComparison.tsx           # Model selection rationale + table
│       ├── ScalingSection.tsx            # Production considerations
│       ├── UseCaseCTA.tsx                # Call to action footer
│       └── UseCaseCard.tsx               # Card for the directory page
├── data/
│   └── use-cases/
│       ├── index.ts                      # Use case registry + types
│       ├── healthcare.ts                 # Healthcare use case data
│       ├── legal.ts                      # Legal use case data
│       ├── finance.ts                    # Finance use case data
│       └── devdocs.ts                    # Developer docs use case data
public/
└── use-cases/
    ├── healthcare/
    │   └── sample-docs/                  # 15 markdown files
    │       └── sample-docs.zip           # Downloadable archive
    ├── legal/
    │   └── sample-docs/
    │       └── sample-docs.zip
    ├── finance/
    │   └── sample-docs/
    │       └── sample-docs.zip
    └── devdocs/
        └── sample-docs/
            └── sample-docs.zip
```

### 8.3 Data Structure

Each use case is defined as a TypeScript data object. This separates content from presentation and makes adding new use cases straightforward.

```typescript
// src/data/use-cases/index.ts

export interface UseCaseData {
  // Identity
  slug: string;
  title: string;
  headline: string;
  subheadline: string;
  description: string;                    // For SEO meta description
  icon: string;                           // MUI icon name
  accentColor: string;                    // Domain-specific accent color

  // Domain content
  persona: string;
  problemStatement: string;               // Rich text / paragraphs
  solutionSummary: string;

  // Technical configuration
  voyageModel: string;
  voyageModelReason: string;
  dbName: string;
  collectionName: string;
  vaiJsonConfig: Record<string, unknown>; // The .vai.json for this domain

  // Sample documents
  sampleDocs: SampleDocument[];
  sampleDocsZipUrl: string;

  // Walkthrough steps
  walkthroughSteps: WalkthroughStep[];

  // Example queries
  exampleQueries: ExampleQuery[];

  // Model comparison data
  modelComparison: ModelComparison;

  // Scaling notes
  scalingNotes: ScalingNote[];
}

export interface SampleDocument {
  filename: string;
  topic: string;
  sizeKb: number;
}

export interface WalkthroughStep {
  number: number;
  title: string;
  description: string;
  command: string;
  expectedOutput?: string;               // Formatted terminal output
  notes?: string;
}

export interface ExampleQuery {
  query: string;
  explanation: string;
  sampleResults?: Array<{
    source: string;
    relevance: number;
    snippet: string;
  }>;
}

export interface ModelComparison {
  recommended: string;
  alternatives: Array<{
    model: string;
    score?: number;
    notes: string;
  }>;
  comparisonNarrative: string;
}

export interface ScalingNote {
  title: string;
  content: string;
  icon?: string;
}
```

### 8.4 Shared Layout

The use case pages share a layout that includes the existing Navbar and Footer, plus breadcrumb navigation:

```
Navbar (existing)
  └── Breadcrumbs: Home > Use Cases > {Domain Name}
      └── Page Content (scrollable sections)
          └── Cross-links to other use cases
Footer (existing)
```

### 8.5 Home Page Integration

The existing home page (`src/app/page.tsx`) gains a new section component — `UseCases` — inserted between the existing `McpServer` and `DesktopApp` sections (or wherever most appropriate in the narrative flow). This section shows 4 cards linking to the use case pages.

```typescript
// Updated src/app/page.tsx
import UseCases from '@/components/UseCases';

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <WhyVoyageAI />
      <Features />
      <Models />
      <CliDemo />
      <McpServer />
      <UseCases />          {/* NEW */}
      <DesktopApp />
      <CommunityStats />
      <Footer />
    </main>
  );
}
```

The `UseCases` component renders 4 cards in a grid, each with the domain icon, headline, and a brief description, linking to `/use-cases/{slug}`.

### 8.6 Navbar Update

Add "Use Cases" to the navigation items, linking to `/use-cases`:

```typescript
const navItems = [
  { label: 'Why Voyage AI', href: '#why-voyage' },
  { label: 'Features', href: '#features' },
  { label: 'Models', href: '#models' },
  { label: 'Use Cases', href: '/use-cases' },          // NEW
  { label: 'CLI', href: '#cli-demo' },
  { label: 'MCP', href: '#mcp' },
  { label: 'Docs', href: 'https://github.com/mrlynn/voyageai-cli#readme', external: true },
];
```

---

## 9. Component Specifications

### 9.1 Design System

All components use the existing vai-site design system:

- **MUI 6** (Material UI) — the existing component library
- **No Tailwind** — per project convention
- **Dark theme** — the MongoDB-inspired palette from `src/theme/theme.ts`
- **Brand palette** — primary teal (`#00D4AA`), secondary cyan (`#40E0FF`), hero gradient (`linear-gradient(135deg, #00D4AA 0%, #40E0FF 100%)`). See `/branding` for the full guide.
- **Accent colors** — each domain gets a subtle accent color variant for visual differentiation while maintaining the overall dark theme and teal/cyan brand

| Domain | Accent Color | MUI Icon | Rationale |
|--------|-------------|----------|-----------|
| Healthcare | `#5CE8CC` (teal light) | `LocalHospitalIcon` | Closest to brand primary, clinical trust |
| Legal | `#B45AF2` (purple) | `GavelIcon` | Legal/authority, matches brand semantic purple |
| Finance | `#FFC010` (amber/gold) | `TrendingUpIcon` | Financial association, matches brand warning/gold |
| Developer Docs | `#40E0FF` (cyan) | `CodeIcon` | Matches brand secondary, developer/tech feel |

The primary site accent (`#00D4AA` teal) remains the dominant brand color. Domain accents are drawn from the brand palette where possible (teal light, cyan, purple) with finance using the brand's gold/warning color. These are used sparingly — on the use case hero, section headers, and card borders — to differentiate without breaking the visual system.

### 9.2 UseCaseHero

The hero section for each use case page. Full-width, matching the existing Hero component's visual language but with domain-specific content.

**Contents:**
- Domain icon (large, in accent color)
- Headline (e.g., "Build a Clinical Knowledge Base in 20 Minutes")
- Subheadline (one line)
- Two CTAs: "Start the Walkthrough" (scrolls to walkthrough) and "Download Sample Docs" (direct zip download)
- Subtle background pattern or gradient using the domain accent color

### 9.3 CommandBlock

A reusable component that displays a terminal command and its expected output. This is the core visual element of every walkthrough.

**Features:**
- Dark terminal styling (consistent with existing `CliDemo` component)
- Copy button on the command
- Collapsible/expandable output section
- Line numbers on output (optional)
- Monospace font throughout

### 9.4 WalkthroughStepper

A vertical stepper (MUI Stepper) that walks through the vai commands. Each step contains:

- Step number and title
- Brief description of what this step does (in domain language)
- A `CommandBlock` with the exact command and expected output
- Optional callout/note box for additional context

The stepper uses non-linear navigation — users can jump between steps.

### 9.5 ExampleQueries

A showcase section that displays 3–5 domain-specific queries and their results. Each query is expandable:

- **Collapsed:** Shows the query text and a brief explanation of why it's interesting
- **Expanded:** Shows the full retrieved context (source file, relevance score, snippet) — formatted like vai's terminal output

### 9.6 UseCaseCard

Card component used on the directory page and the home page section. Displays:

- Domain icon + accent color border
- Headline
- Brief description (2 lines)
- Model badge (e.g., "voyage-law-2")
- "Explore →" link

---

## 10. SEO & Metadata

### 10.1 Per-Page Metadata

Each use case page generates SEO-optimized metadata:

```typescript
// src/app/use-cases/[slug]/page.tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const useCase = getUseCaseBySlug(params.slug);
  return {
    title: `${useCase.headline} — Vai`,
    description: useCase.description,
    keywords: [...baseKeywords, ...useCase.domainKeywords],
    openGraph: {
      title: useCase.headline,
      description: useCase.subheadline,
      url: `https://vai.mlynn.org/use-cases/${useCase.slug}`,
      images: [{ url: `/og/${useCase.slug}.png`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: useCase.headline,
      description: useCase.subheadline,
    },
  };
}
```

### 10.2 Structured Data

Each use case page includes JSON-LD structured data as a `HowTo` schema:

```json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "Build a Clinical Knowledge Base with Vai",
  "description": "Step-by-step guide to creating a searchable clinical knowledge base using Voyage AI embeddings and MongoDB Atlas Vector Search",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Install vai",
      "text": "Install voyageai-cli globally via npm"
    }
  ],
  "tool": {
    "@type": "SoftwareApplication",
    "name": "Vai (VoyageAI-CLI)"
  }
}
```

### 10.3 OpenGraph Images

Each use case needs a domain-specific OG image (1200×630) for social sharing. These should be generated or designed with:

- The vai brand
- The domain headline
- The domain icon
- The domain accent color

---

## 11. Implementation Plan

### 11.1 Phased Delivery

#### Phase 1: Infrastructure + Developer Docs (First)

Build the framework and the most familiar use case:

- Data types and use case registry (`src/data/use-cases/index.ts`)
- All shared components (`CommandBlock`, `WalkthroughStepper`, `ExampleQueries`, etc.)
- Developer Documentation use case — full data file, sample documents, complete page
- Use case directory page (`/use-cases`)
- Home page `UseCases` section
- Navbar update

**Why Developer Docs first:** It's closest to the existing audience, most familiar to write and validate, and any issues with the component framework will be caught before tackling less familiar domains.

#### Phase 2: Legal & Finance

Two domain-specific model use cases:

- Legal use case — data file, 15 sample documents, complete page
- Finance use case — data file, 15 sample documents, complete page
- Model comparison sections with real benchmark data
- `voyage-law-2` and `voyage-finance-2` product narratives

#### Phase 3: Healthcare + Polish

The most sensitive domain and final polish:

- Healthcare use case — data file, 15 sample documents, complete page
- Healthcare-specific compliance and sensitivity callouts
- OG images for all four use cases
- Cross-linking between use case pages
- SEO audit and structured data validation

### 11.2 Content Production

The sample documents are the most time-intensive deliverable. Each set needs to be:

- **Written from scratch** (not copied from real documents — license and liability)
- **Internally consistent** (documents reference each other, overlapping topics exist)
- **Semantically rich** (using domain vocabulary so embedding-based search produces meaningfully different results than keyword search)
- **Small but complete** (each document should feel like a real excerpt, not a placeholder)

Estimated content production per domain: 4–6 hours for the sample documents, 2–3 hours for the page copy and walkthrough validation.

### 11.3 Testing

| Layer | Approach |
|-------|----------|
| **Component** | Visual testing of each component with all four use case data sets |
| **Route** | Verify all four `/use-cases/{slug}` routes render correctly |
| **Download** | Verify sample doc zip files download and contain the expected files |
| **Mobile** | Each page must be responsive — test walkthrough stepper and command blocks on mobile |
| **Walkthrough** | Run each walkthrough end-to-end with a real Voyage AI key and MongoDB cluster to verify all commands and expected outputs are accurate |
| **SEO** | Validate metadata, OG images, JSON-LD structured data |

---

## 12. Future Expansion

### 12.1 Additional Domains

The template-based architecture makes adding new domains straightforward. Candidates for future use cases:

| Domain | Model | Target Persona | Document Types |
|--------|-------|---------------|----------------|
| **Education** | `voyage-4-large` | EdTech developers, course designers | Syllabi, course materials, research papers |
| **Customer Support** | `voyage-4-large` | Support engineering, CX teams | Help articles, ticket templates, troubleshooting guides |
| **HR & People Ops** | `voyage-4-large` | HR technologists, people analytics | Policies, handbooks, benefits guides |
| **Real Estate** | `voyage-4-large` | PropTech developers | Property listings, market reports, zoning regulations |
| **Research & Academia** | `voyage-4-large` | Research librarians, lab teams | Paper abstracts, methods, grant applications |

### 12.2 Interactive Playground

A future enhancement: each use case page could include an embedded, interactive playground that lets visitors query the pre-built knowledge base without installing anything. This would require a hosted vai instance with the sample documents pre-indexed — effectively a read-only demo.

### 12.3 Community-Contributed Use Cases

Once the template is proven, the community could contribute new domain use cases via pull requests. A contributing guide would document the data schema, sample document requirements, and page generation process.

---

*End of Specification*

*vai-site — [vai.mlynn.org](https://vai.mlynn.org)*