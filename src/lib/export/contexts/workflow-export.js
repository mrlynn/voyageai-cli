'use strict';

const { buildDependencyGraph } = require('../../workflow');

/**
 * Normalize a workflow definition for export.
 * @param {object} workflow - Raw workflow JSON
 * @param {object} options
 * @param {boolean} [options.includeExecution=false]
 * @param {boolean} [options.includeMetadata=false]
 * @returns {object} normalized
 */
function normalizeWorkflow(workflow, options = {}) {
  const normalized = {
    _context: 'workflow',
    name: workflow.name,
    description: workflow.description,
    version: workflow.version,
    inputs: workflow.inputs || {},
    defaults: workflow.defaults,
    steps: workflow.steps || [],
    output: workflow.output,
  };

  // Compute dependency map for markdown rendering (Map<string, Set> → plain obj)
  const depGraphMap = buildDependencyGraph(workflow.steps || []);
  const depGraph = {};
  for (const [id, deps] of depGraphMap) {
    depGraph[id] = [...deps];
  }
  normalized._dependencyMap = depGraph;

  // Count execution layers
  const layerCount = computeLayerCount(workflow.steps || [], depGraph);
  normalized._executionLayers = layerCount;

  if (options.includeExecution && workflow._execution) {
    normalized._execution = workflow._execution;
  }

  if (options.includeMetadata) {
    normalized._metadata = {
      _exportedAt: new Date().toISOString(),
      _source: workflow._source || 'local',
    };
  }

  return normalized;
}

function computeLayerCount(steps, depGraph) {
  if (steps.length === 0) return 0;
  const inDegree = {};
  const ids = steps.map((s) => s.id);
  for (const id of ids) inDegree[id] = (depGraph[id] || []).length;
  const remaining = new Set(ids);
  let layers = 0;
  while (remaining.size > 0) {
    const layer = [];
    for (const id of remaining) {
      if ((inDegree[id] || 0) === 0) layer.push(id);
    }
    if (layer.length === 0) break;
    layers++;
    for (const id of layer) {
      remaining.delete(id);
      for (const [depId, deps] of Object.entries(depGraph)) {
        if (remaining.has(depId) && deps.includes(id)) {
          inDegree[depId]--;
        }
      }
    }
  }
  return layers;
}

/** Supported export formats for workflows */
const WORKFLOW_FORMATS = ['json', 'markdown', 'mermaid', 'svg', 'png', 'clipboard'];

module.exports = { normalizeWorkflow, WORKFLOW_FORMATS };
