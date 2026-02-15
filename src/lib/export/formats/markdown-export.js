'use strict';

/**
 * Render normalized data as Markdown.
 * The shape of `normalized` varies by context — the context module sets a `_context` key.
 * @param {object} normalized
 * @param {object} options
 * @returns {{ content: string, mimeType: string }}
 */
function renderMarkdown(normalized, options = {}) {
  const ctx = normalized._context;
  let md;
  switch (ctx) {
    case 'workflow':
      md = renderWorkflowMd(normalized, options);
      break;
    case 'search':
      md = renderSearchMd(normalized, options);
      break;
    case 'chat':
      md = renderChatMd(normalized, options);
      break;
    case 'benchmark':
      md = renderBenchmarkMd(normalized, options);
      break;
    default:
      md = '# Export\n\n```json\n' + JSON.stringify(normalized, null, 2) + '\n```\n';
  }
  return { content: md, mimeType: 'text/markdown' };
}

// ── Workflow ──

function renderWorkflowMd(n, opts) {
  const lines = [];
  lines.push(`# ${n.name || 'Workflow'}`);
  lines.push('');
  if (n.description) {
    lines.push(n.description);
    lines.push('');
  }

  // Metadata
  if (n.version) lines.push(`**Version:** ${n.version}`);
  const tools = (n.steps || []).map((s) => s.tool).filter(Boolean);
  const unique = [...new Set(tools)];
  if (unique.length) lines.push(`**Tools used:** ${unique.join(', ')}`);
  const layers = n._executionLayers || null;
  if (layers) lines.push(`**Execution layers:** ${layers} (sequential)`);
  lines.push('');

  // Inputs table
  if (n.inputs && Object.keys(n.inputs).length > 0) {
    lines.push('## Inputs');
    lines.push('');
    lines.push('| Parameter | Type | Required | Default | Description |');
    lines.push('|-----------|------|----------|---------|-------------|');
    for (const [key, schema] of Object.entries(n.inputs)) {
      const type = schema.type || 'string';
      const req = schema.required ? 'Yes' : 'No';
      const def = schema.default !== undefined ? String(schema.default) : '—';
      const desc = schema.description || '';
      lines.push(`| ${key} | ${type} | ${req} | ${def} | ${desc} |`);
    }
    lines.push('');
  }

  // Steps
  if (n.steps && n.steps.length > 0) {
    lines.push('## Steps');
    lines.push('');
    const deps = n._dependencyMap || {};
    n.steps.forEach((step, i) => {
      const label = step.name || step.description || step.id;
      lines.push(`### ${i + 1}. ${label}`);
      if (step.tool) lines.push(`- **Tool:** ${step.tool}`);
      const stepDeps = deps[step.id];
      if (stepDeps && stepDeps.length > 0) {
        lines.push(`- **Depends on:** ${stepDeps.join(', ')}`);
      } else {
        lines.push('- **Depends on:** (none — first step)');
      }
      if (step.description && step.description !== label) {
        lines.push(`- **Configuration:** ${step.description}`);
      }
      lines.push('');
    });
  }

  // Output
  if (n.output) {
    lines.push('## Output');
    lines.push('');
    lines.push(`Returns: \`${n.output}\``);
    lines.push('');
  }

  return lines.join('\n');
}

// ── Search Results ──

function renderSearchMd(n, opts) {
  const lines = [];
  lines.push('# Search Results');
  lines.push('');
  if (n.query) lines.push(`**Query:** ${n.query}`);
  if (n.collection) lines.push(`**Collection:** ${n.collection}`);
  if (n.model) lines.push(`**Model:** ${n.model}`);
  const total = (n.results || []).length;
  lines.push(`**Results:** ${total}`);
  lines.push('');

  (n.results || []).forEach((r, i) => {
    lines.push(`### ${i + 1}. ${r.source || 'Result'} (score: ${r.score ?? '—'})`);
    if (r.rerankedScore !== undefined) lines.push(`- **Reranked score:** ${r.rerankedScore}`);
    const text = opts.includeFullText ? r.text : (r.text || '').slice(0, 200);
    if (text) {
      lines.push('');
      lines.push(`> ${text}`);
    }
    lines.push('');
  });

  return lines.join('\n');
}

// ── Chat Session ──

function renderChatMd(n, opts) {
  const lines = [];
  const sessionId = n.sessionId || n.id || 'unknown';
  lines.push(`# Chat Session: ${sessionId}`);
  lines.push('');
  if (n.startedAt) lines.push(`**Date:** ${n.startedAt}`);
  if (n.provider && n.model) lines.push(`**Provider:** ${n.provider} (${n.model})`);
  else if (n.model) lines.push(`**Model:** ${n.model}`);
  if (n.collection) lines.push(`**Knowledge Base:** ${n.collection}`);
  const turns = (n.turns || []).length;
  lines.push(`**Turns:** ${turns}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  (n.turns || []).forEach((turn) => {
    const role = turn.role === 'user' ? 'User' : 'vai';
    lines.push(`**${role}:**`);
    lines.push(turn.content || '');
    if (opts.includeSources !== false && turn.context && turn.context.length > 0) {
      lines.push('');
      lines.push('> **Sources:**');
      turn.context.forEach((src, i) => {
        const rel = src.score !== undefined ? ` (relevance: ${src.score})` : '';
        lines.push(`> ${i + 1}. ${src.source || 'unknown'}${rel}`);
      });
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  });

  return lines.join('\n');
}

// ── Benchmark ──

function renderBenchmarkMd(n, opts) {
  const lines = [];
  lines.push('# Benchmark Results');
  lines.push('');
  if (n.name) lines.push(`**Benchmark:** ${n.name}`);
  if (n.date) lines.push(`**Date:** ${n.date}`);
  lines.push('');

  const results = n.results || n.rows || [];
  if (results.length > 0) {
    const cols = Object.keys(results[0]);
    lines.push('| ' + cols.join(' | ') + ' |');
    lines.push('| ' + cols.map(() => '---').join(' | ') + ' |');
    results.forEach((row) => {
      lines.push('| ' + cols.map((c) => String(row[c] ?? '')).join(' | ') + ' |');
    });
    lines.push('');
  }

  return lines.join('\n');
}

module.exports = { renderMarkdown };
