# VAI Announcements

This file contains the announcements displayed on the VAI home page carousel.
Each announcement is separated by `---` and uses YAML frontmatter for metadata.

Format:
- `id`: Unique identifier (used to track dismissals)
- `badge`: Label shown on the card (e.g., "New", "Update", "New Model")
- `published`: Date published (YYYY-MM-DD)
- `expires`: Date to stop showing (YYYY-MM-DD)
- `cta_label`: Button text
- `cta_action`: Either "navigate" (internal tab) or "link" (external URL)
- `cta_target`: Tab name (e.g., "/benchmark") or full URL

The title is the first `## ` heading, and the description is the paragraph below it.

---

id: ann-collapsible-layout
badge: New
published: 2026-02-15
expires: 2026-03-20
icon: 🖥️
bg_color: linear-gradient(135deg, #001E2B 0%, #0A2A3A 50%, rgba(0, 212, 170, 0.08) 100%)
cta_label: Try Workflows
cta_action: navigate
cta_target: /workflows

## Redesigned Workflows Layout

Maximize your canvas with collapsible panels, accordion properties, and library search. Collapse the sidebar to icon-only mode, toggle panels from the toolbar, or use keyboard shortcuts — Cmd+B, Cmd+I, Cmd+\\ for instant focus.

---

id: ann-cost-dashboard
badge: New
published: 2026-02-15
expires: 2026-03-20
icon: 💰
bg_color: linear-gradient(135deg, #0A1E2B 0%, #112733 50%, rgba(64, 224, 255, 0.07) 100%)
cta_label: View Dashboard
cta_action: navigate
cta_target: /embed

## Live Cost Tracking Dashboard

Every embed, rerank, and tool call now shows real-time cost in the status bar. Expand the detail panel to see per-operation breakdowns, token counts, and cumulative spend across your session.

---

id: ann-desktop-app
badge: Update
published: 2026-02-15
expires: 2026-04-01
icon: 🖥️
bg_color: linear-gradient(135deg, #001E2B 0%, #1C2D38 100%)
cta_label: Download
cta_action: link
cta_target: https://github.com/mrlynn/voyageai-cli/releases

## VAI Desktop App v1.30

The signed & notarized macOS desktop app is updated with the full collapsible layout, cost tracking, and all 22 Explore concepts including multimodal. Auto-updates built in.

---

id: ann-voyage-4
badge: New Model
published: 2026-02-14
expires: 2026-03-15
icon: 🚀
bg_color: linear-gradient(135deg, rgba(0, 212, 170, 0.09) 0%, #001E2B 50%, rgba(64, 224, 255, 0.08) 100%)
cta_label: Try It Now
cta_action: navigate
cta_target: /benchmark

## Voyage AI 4 Large Now Available

The latest embedding model from Voyage AI is ready to benchmark in VAI. Experience improved accuracy and performance across all embedding tasks.

---

id: ann-marketplace-workflows
badge: New
published: 2026-02-12
expires: 2026-03-01
icon: 🏪
bg_color: linear-gradient(135deg, #112733 0%, #001E2B 100%)
cta_label: Explore Marketplace
cta_action: navigate
cta_target: /workflows

## New Marketplace Workflows

HIPAA-compliant document search, legal contract analysis, and more workflows are now available in the VAI Marketplace.

---

id: ann-csv-ingestion
badge: Update
published: 2026-02-10
expires: 2026-04-01
icon: 📊
bg_color: linear-gradient(135deg, #001E2B 0%, rgba(0, 212, 170, 0.06) 50%, #112733 100%)
cta_label: Learn More
cta_action: link
cta_target: https://docs.vaicli.com/csv-import

## VAI v1.3 Adds Bulk CSV Ingestion

Import large datasets efficiently with the new bulk CSV ingestion feature. Process thousands of documents in a single operation.

---

id: ann-workflow-store
badge: New
published: 2026-02-13
expires: 2026-03-15
icon: ⚡
bg_color: linear-gradient(135deg, rgba(64, 224, 255, 0.06) 0%, #001E2B 50%, rgba(0, 212, 170, 0.06) 100%)
cta_label: Browse Store
cta_action: navigate
cta_target: /workflows

## Workflow Store Now Live

Discover, install, and share VAI workflows with the new integrated Workflow Store. Browse featured picks, community contributions, and install with one click.
