'use strict';

const {
  VAI_TOOLS,
  CONTROL_FLOW_TOOLS,
  PROCESSING_TOOLS,
  INTEGRATION_TOOLS,
  buildDependencyGraph,
} = require('../../workflow');

// ════════════════════════════════════════════════════════════════════
// Tool → Category mapping
// ════════════════════════════════════════════════════════════════════

function getToolCategory(tool) {
  if (!tool) return 'utility';
  if (tool === 'rerank') return 'retrieval';
  if (['query', 'search'].includes(tool)) return 'retrieval';
  if (['embed', 'similarity'].includes(tool)) return 'embedding';
  if (tool === 'generate') return 'generation';
  if (tool === 'ingest') return 'ingestion';
  if (CONTROL_FLOW_TOOLS.has(tool)) return 'control';
  if (PROCESSING_TOOLS.has(tool)) return 'utility';
  if (INTEGRATION_TOOLS.has(tool)) return 'utility';
  return 'utility';
}

// ════════════════════════════════════════════════════════════════════
// Emoji per category
// ════════════════════════════════════════════════════════════════════

const CATEGORY_EMOJI = {
  retrieval: '🔍',
  embedding: '🧬',
  generation: '✨',
  control: '⚙️',
  utility: '🔧',
  ingestion: '📥',
};

// ════════════════════════════════════════════════════════════════════
// Mermaid node shape per category (spec Section 7.1)
// ════════════════════════════════════════════════════════════════════

function wrapNodeShape(id, label, category, isConditional) {
  if (isConditional) return `${id}{"${label}"}`;
  switch (category) {
    case 'retrieval':  return `${id}(["${label}"])`;   // stadium
    case 'embedding':  return `${id}("${label}")`;     // rounded
    case 'generation': return `${id}[/"${label}"/]`;   // trapezoid
    case 'control':    return `${id}{"${label}"}`;     // diamond
    case 'ingestion':  return `${id}[["${label}"]]`;   // subroutine
    case 'utility':
    default:           return `${id}("${label}")`;     // rounded
  }
}

// ════════════════════════════════════════════════════════════════════
// Style class definitions (spec Section 7.2)
// ════════════════════════════════════════════════════════════════════

const CLASS_DEFS = {
  retrieval:  'classDef retrieval fill:#00838F,stroke:#00D4AA,color:#fff',
  embedding:  'classDef embedding fill:#4A148C,stroke:#CE93D8,color:#fff',
  generation: 'classDef generation fill:#6A1B9A,stroke:#CE93D8,color:#fff',
  control:    'classDef control fill:#424242,stroke:#9E9E9E,color:#fff',
  utility:    'classDef utility fill:#E65100,stroke:#FFB74D,color:#fff',
  ingestion:  'classDef ingestion fill:#1B5E20,stroke:#66BB6A,color:#fff',
};

// ════════════════════════════════════════════════════════════════════
// Main conversion
// ════════════════════════════════════════════════════════════════════

/**
 * Convert a workflow definition to Mermaid flowchart syntax.
 *
 * @param {object} workflow - Parsed workflow JSON
 * @param {object} [options]
 * @param {string} [options.theme='dark']
 * @param {string} [options.direction='TD']
 * @param {boolean} [options.includeStepIds=false]
 * @param {boolean} [options.includeToolEmoji=true]
 * @param {boolean} [options.colorCoded=true]
 * @param {boolean} [options.includeParallelism=false]
 * @returns {string} Mermaid diagram source
 */
function workflowToMermaid(workflow, options = {}) {
  const {
    theme = 'dark',
    direction = 'TD',
    includeStepIds = false,
    includeToolEmoji = true,
    colorCoded = true,
    includeParallelism = false,
  } = options;

  const steps = workflow.steps || [];
  if (steps.length === 0) return '';

  const lines = [];

  // Init directive
  lines.push(`%%{init: {'theme': '${theme}', 'themeVariables': { 'primaryColor': '#00D4AA' }}}%%`);
  lines.push(`graph ${direction}`);

  // Class definitions
  if (colorCoded) {
    const usedCategories = new Set(steps.map((s) => getToolCategory(s.tool)));
    for (const cat of usedCategories) {
      if (CLASS_DEFS[cat]) lines.push(`    ${CLASS_DEFS[cat]}`);
    }
    lines.push('');
  }

  // Build dependency info — buildDependencyGraph returns Map<string, Set<string>>
  const depGraphMap = buildDependencyGraph(steps);
  // Convert to plain object with arrays for easier iteration
  const depGraph = {};
  for (const [id, deps] of depGraphMap) {
    depGraph[id] = [...deps];
  }

  // Build execution layers if needed (for subgraph grouping)
  let layers = null;
  if (includeParallelism) {
    layers = buildLayers(steps, depGraph);
  }

  // Node definitions
  if (layers && includeParallelism) {
    layers.forEach((layerStepIds, i) => {
      if (layerStepIds.length > 1) {
        lines.push(`    subgraph "Layer ${i + 1} (parallel)"`);
        for (const sid of layerStepIds) {
          const step = steps.find((s) => s.id === sid);
          lines.push(`        ${buildNode(step, { includeStepIds, includeToolEmoji })}`);
        }
        lines.push('    end');
      } else if (layerStepIds.length === 1) {
        const step = steps.find((s) => s.id === layerStepIds[0]);
        lines.push(`    ${buildNode(step, { includeStepIds, includeToolEmoji })}`);
      }
    });
  } else {
    for (const step of steps) {
      lines.push(`    ${buildNode(step, { includeStepIds, includeToolEmoji })}`);
    }
  }

  lines.push('');

  // Edges
  const stepIds = new Set(steps.map((s) => s.id));
  for (const step of steps) {
    const deps = depGraph[step.id] || [];

    // Also detect implicit deps from condition/forEach that reference step IDs
    const implicitDeps = new Set();
    if (step.condition) {
      for (const sid of stepIds) {
        if (step.condition.includes(sid) && sid !== step.id && !deps.includes(sid)) {
          implicitDeps.add(sid);
        }
      }
    }
    if (step.forEach) {
      for (const sid of stepIds) {
        if (step.forEach.includes(sid) && sid !== step.id && !deps.includes(sid)) {
          implicitDeps.add(sid);
        }
      }
    }

    for (const dep of deps) {
      const hasCondition = step.condition && step.condition.includes(dep);
      const arrow = hasCondition ? '-.->' : '-->';
      lines.push(`    ${dep} ${arrow} ${step.id}`);
    }
    for (const dep of implicitDeps) {
      lines.push(`    ${dep} -.-> ${step.id}`);
    }
  }

  // Apply class assignments
  if (colorCoded) {
    lines.push('');
    for (const step of steps) {
      const cat = getToolCategory(step.tool);
      lines.push(`    class ${step.id} ${cat}`);
    }
  }

  return lines.join('\n');
}

/**
 * Build a single node definition string.
 */
function buildNode(step, opts) {
  const category = getToolCategory(step.tool);
  const isConditional = !!step.condition;
  const isForEach = !!step.forEach;

  let label = step.name || step.description || step.id;
  if (opts.includeToolEmoji && CATEGORY_EMOJI[category]) {
    label = `${CATEGORY_EMOJI[category]} ${label}`;
  }
  if (opts.includeStepIds) {
    label = `${label} (${step.id})`;
  }
  if (isConditional) {
    const condText = step.condition.length > 30
      ? step.condition.slice(0, 27) + '...'
      : step.condition;
    label = `${label}<br/><small>condition: ${condText}</small>`;
  }
  if (isForEach) {
    label = `${label}<br/><small>∀ item in ${step.forEach}</small>`;
  }

  return wrapNodeShape(step.id, label, category, isConditional);
}

/**
 * Build execution layers via topological sort / breadth-first layering.
 */
function buildLayers(steps, depGraph) {
  const inDegree = {};
  const stepIds = steps.map((s) => s.id);
  for (const id of stepIds) inDegree[id] = 0;
  for (const [id, deps] of Object.entries(depGraph)) {
    inDegree[id] = (deps || []).length;
  }

  const layers = [];
  const remaining = new Set(stepIds);

  while (remaining.size > 0) {
    const layer = [];
    for (const id of remaining) {
      if ((inDegree[id] || 0) === 0) layer.push(id);
    }
    if (layer.length === 0) break; // cycle guard
    layers.push(layer);
    for (const id of layer) {
      remaining.delete(id);
      // Decrement in-degree of dependents
      for (const [depId, deps] of Object.entries(depGraph)) {
        if (remaining.has(depId) && deps.includes(id)) {
          inDegree[depId]--;
        }
      }
    }
  }

  return layers;
}

/**
 * Render as Mermaid format for the export system.
 * @param {object} normalized - workflow normalized data
 * @param {object} options
 * @returns {{ content: string, mimeType: string }}
 */
function renderMermaid(normalized, options = {}) {
  const mermaid = workflowToMermaid(normalized, options);
  return {
    content: mermaid,
    mimeType: 'text/x-mermaid',
  };
}

module.exports = { workflowToMermaid, renderMermaid, getToolCategory, buildLayers };
