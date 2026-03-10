---
status: diagnosed
phase: 17-onboarding-detection
source: 17-01-SUMMARY.md, 17-02-SUMMARY.md
started: 2026-03-07T14:30:00Z
updated: 2026-03-07T14:38:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Health Dots in Config Panel
expected: Open the playground chat UI config panel. Green or red dots appear next to LLM Provider, Embedding, and API Key labels indicating service availability.
result: pass

### 2. Ollama Detection
expected: If Ollama is running locally, LLM Provider health dot is green. If Ollama is not running, it shows red. Detection should not noticeably delay config panel load (2s timeout).
result: pass

### 3. API Key Row Auto-Show
expected: When no Voyage API key is configured, the API Key row is automatically visible in the config panel with a red health dot, prompting setup.
result: pass

### 4. Welcome Banner on First Run
expected: When no LLM provider is configured, a welcome banner appears at the top of the chat area showing service status dots for Ollama, Nano Bridge, and Voyage API, plus a recommended action button.
result: pass

### 5. Recommendation Engine Label
expected: The welcome banner's action button text reflects the detected scenario (e.g., "Start with Full Local" if Ollama + nano are available, or "Start with Cloud" if only API key is set).
result: pass

### 6. One-Click Apply Config
expected: Clicking the recommended action button on the welcome banner auto-fills the LLM provider, model, and embedding dropdowns with appropriate values and saves settings. Banner dismisses.
result: pass

### 7. Configure Manually Dismiss
expected: Clicking "Configure Manually" on the welcome banner dismisses the banner without changing any settings.
result: issue
reported: "once I select an api-based model, re-rank slider radio button enables but I cannot change the value"
severity: major

## Summary

total: 7
passed: 6
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "Configure Manually dismisses banner without side effects; re-rank controls work after manual config"
  status: failed
  reason: "User reported: once I select an api-based model, re-rank slider radio button enables but I cannot change the value"
  severity: major
  test: 7
  root_cause: "updateEmbedBadge() asymmetrically handles enable vs disable - removes 'active' class when disabling for nano but never restores it when re-enabling for API models. Also potential init race: loadChatConfig() runs before initSettings() attaches click handler."
  artifacts:
    - path: "src/playground/index.html"
      issue: "updateEmbedBadge() line 16258-16263 missing active class restoration in else-branch"
    - path: "src/playground/index.html"
      issue: "Click handler attached in initSettings() (line 14228) may race with loadChatConfig() (line 17294)"
  missing:
    - "Restore 'active' class in updateEmbedBadge() when re-enabling rerank button for API models"
    - "Consider adding onclick attribute directly on button HTML as fallback for race condition"
  debug_session: ".planning/debug/rerank-toggle-not-interactive.md"
