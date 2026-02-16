'use strict';

const { validateWorkflow, buildExecutionPlan, buildDependencyGraph, ALL_TOOLS } = require('../../lib/workflow');

// ════════════════════════════════════════════════════════════════════
// Tool catalog: default inputs per tool
// ════════════════════════════════════════════════════════════════════

const TOOL_DEFAULTS = {
  query: { query: '{{ inputs.query }}', collection: '{{ inputs.collection }}', limit: '{{ inputs.limit }}' },
  search: { query: '{{ inputs.query }}', collection: '{{ inputs.collection }}', limit: '{{ inputs.limit }}' },
  rerank: { query: '{{ inputs.query }}', documents: [], model: 'rerank-2.5' },
  embed: { text: '{{ inputs.text }}' },
  similarity: { text1: '{{ inputs.text1 }}', text2: '{{ inputs.text2 }}' },
  ingest: { text: '{{ inputs.text }}', collection: '{{ inputs.collection }}' },
  collections: {},
  models: { category: 'all' },
  explain: { topic: '{{ inputs.topic }}' },
  estimate: { docs: '{{ inputs.docs }}', queries: '{{ inputs.queries }}', months: 12 },
  generate: { prompt: '{{ inputs.prompt }}' },
  template: { text: '' },
  merge: { arrays: [], dedup: true },
  filter: { array: [], condition: '' },
  transform: { array: [], fields: [] },
  conditional: { condition: '', then: [], else: [] },
  loop: { items: [], as: 'item', step: {} },
  chunk: { text: '{{ inputs.text }}', strategy: 'recursive', size: 512 },
  aggregate: { pipeline: [] },
  http: { url: '{{ inputs.url }}', method: 'GET' },
  code_index: { source: '{{ inputs.source }}' },
  code_search: { query: '{{ inputs.query }}' },
  code_query: { query: '{{ inputs.query }}' },
  code_find_similar: { code: '{{ inputs.code }}' },
  code_status: {},
};

// ════════════════════════════════════════════════════════════════════
// Common workflow patterns
// ════════════════════════════════════════════════════════════════════

const PATTERNS = {
  // Search then generate (RAG)
  rag: {
    tools: ['query', 'generate'],
    inputs: {
      query: { type: 'string', required: true, description: 'The question to answer' },
      collection: { type: 'string', required: true, description: 'MongoDB collection with embedded documents' },
      limit: { type: 'number', default: 5, description: 'Number of results to retrieve' },
    },
    steps: [
      { id: 'retrieve', tool: 'query', name: 'Retrieve relevant documents', inputs: { query: '{{ inputs.query }}', collection: '{{ inputs.collection }}', limit: '{{ inputs.limit }}' } },
      { id: 'answer', tool: 'generate', name: 'Generate answer from context', inputs: { prompt: 'Answer the following question using the provided context.\n\nQuestion: {{ inputs.query }}', context: '{{ retrieve.output.results }}' } },
    ],
    output: { answer: '{{ answer.output.response }}', sources: '{{ retrieve.output.results }}' },
  },

  // Search + rerank
  search_rerank: {
    tools: ['search', 'rerank'],
    inputs: {
      query: { type: 'string', required: true, description: 'Search query' },
      collection: { type: 'string', required: true, description: 'MongoDB collection' },
      limit: { type: 'number', default: 10, description: 'Number of results' },
    },
    steps: [
      { id: 'search_step', tool: 'search', name: 'Vector search', inputs: { query: '{{ inputs.query }}', collection: '{{ inputs.collection }}', limit: 50 } },
      { id: 'rerank_step', tool: 'rerank', name: 'Rerank results', inputs: { query: '{{ inputs.query }}', documents: '{{ search_step.output.results }}', model: 'rerank-2.5' } },
    ],
    output: { results: '{{ rerank_step.output.results }}' },
  },

  // Ingest pipeline
  ingest_pipeline: {
    tools: ['chunk', 'ingest'],
    inputs: {
      text: { type: 'string', required: true, description: 'Text content to ingest' },
      collection: { type: 'string', required: true, description: 'Target collection' },
      source: { type: 'string', default: 'manual', description: 'Source identifier' },
    },
    steps: [
      { id: 'chunk_step', tool: 'chunk', name: 'Chunk the text', inputs: { text: '{{ inputs.text }}', strategy: 'recursive', size: 512 } },
      { id: 'ingest_step', tool: 'ingest', name: 'Embed and store chunks', inputs: { text: '{{ inputs.text }}', collection: '{{ inputs.collection }}', source: '{{ inputs.source }}' } },
    ],
    output: { chunks: '{{ chunk_step.output.totalChunks }}', inserted: '{{ ingest_step.output.insertedCount }}' },
  },

  // Compare embeddings
  compare: {
    tools: ['similarity'],
    inputs: {
      text1: { type: 'string', required: true, description: 'First text' },
      text2: { type: 'string', required: true, description: 'Second text' },
    },
    steps: [
      { id: 'compare_step', tool: 'similarity', name: 'Compare text similarity', inputs: { text1: '{{ inputs.text1 }}', text2: '{{ inputs.text2 }}' } },
    ],
    output: { similarity: '{{ compare_step.output.similarity }}' },
  },

  // Multi-search + merge + rerank
  multi_search: {
    tools: ['query', 'merge', 'rerank'],
    inputs: {
      query: { type: 'string', required: true, description: 'Search query' },
      collection: { type: 'string', required: true, description: 'MongoDB collection' },
      limit: { type: 'number', default: 10, description: 'Number of results' },
    },
    steps: [
      { id: 'search_broad', tool: 'query', name: 'Broad search', inputs: { query: '{{ inputs.query }}', collection: '{{ inputs.collection }}', limit: 20 } },
      { id: 'merge_results', tool: 'merge', name: 'Merge results', inputs: { arrays: ['{{ search_broad.output.results }}'], dedup: true } },
      { id: 'rerank_merged', tool: 'rerank', name: 'Rerank merged results', inputs: { query: '{{ inputs.query }}', documents: '{{ merge_results.output.results }}' } },
    ],
    output: { results: '{{ rerank_merged.output.results }}' },
  },
};

// ════════════════════════════════════════════════════════════════════
// Pattern matching
// ════════════════════════════════════════════════════════════════════

/**
 * Match a set of requested tools to the best known pattern.
 * @param {string[]} tools
 * @returns {string|null} pattern key or null
 */
function matchPattern(tools) {
  const toolSet = new Set(tools);

  // Score each pattern by how many of its tools are present
  let bestKey = null;
  let bestScore = 0;

  for (const [key, pattern] of Object.entries(PATTERNS)) {
    const patternTools = new Set(pattern.tools);
    let matches = 0;
    for (const t of patternTools) {
      if (toolSet.has(t)) matches++;
    }
    const score = matches / patternTools.size;
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }

  return bestScore >= 0.5 ? bestKey : null;
}

// ════════════════════════════════════════════════════════════════════
// Workflow generation
// ════════════════════════════════════════════════════════════════════

/**
 * Generate a workflow definition from a description and optional tools list.
 *
 * @param {object} params
 * @param {string} params.description - Natural language description
 * @param {string} [params.category] - Workflow category
 * @param {string[]} [params.tools] - Explicit list of tools to use
 * @returns {{ workflow: object, validation: object, executionPlan: string[][], dependencyGraph: object }}
 */
function generateWorkflow({ description, category, tools }) {
  // Determine tools from description if not provided
  const requestedTools = tools && tools.length > 0
    ? tools.filter(t => ALL_TOOLS.has(t))
    : inferToolsFromDescription(description);

  // Try to match a known pattern
  const patternKey = matchPattern(requestedTools);
  let workflow;

  if (patternKey) {
    workflow = buildFromPattern(patternKey, description, category, requestedTools);
  } else {
    workflow = buildFromToolList(description, category, requestedTools);
  }

  // Validate
  const validationErrors = validateWorkflow(workflow);
  const layers = validationErrors.length === 0
    ? buildExecutionPlan(workflow.steps)
    : [];

  // Build dependency info
  let dependencyGraph = {};
  if (validationErrors.length === 0) {
    const graph = buildDependencyGraph(workflow.steps);
    for (const [stepId, deps] of graph) {
      dependencyGraph[stepId] = [...deps];
    }
  }

  return {
    workflow,
    validation: {
      valid: validationErrors.length === 0,
      errors: validationErrors,
    },
    executionPlan: layers,
    dependencyGraph,
  };
}

/**
 * Infer tools from a natural language description.
 * @param {string} description
 * @returns {string[]}
 */
function inferToolsFromDescription(description) {
  const lower = description.toLowerCase();
  const tools = [];

  // Keywords to tool mapping
  const keywords = {
    query: ['search', 'query', 'find', 'retrieve', 'look up', 'lookup', 'rag', 'answer'],
    generate: ['generate', 'summarize', 'answer', 'synthesize', 'write', 'compose', 'rag', 'explain answer'],
    rerank: ['rerank', 're-rank', 'rank', 'sort by relevance', 'precision'],
    embed: ['embed', 'embedding', 'vector', 'vectorize'],
    similarity: ['similar', 'similarity', 'compare', 'distance'],
    ingest: ['ingest', 'import', 'load', 'store', 'index document'],
    chunk: ['chunk', 'split', 'segment', 'partition'],
    merge: ['merge', 'combine', 'concat', 'join', 'union'],
    filter: ['filter', 'exclude', 'include only', 'where'],
    transform: ['transform', 'reshape', 'map', 'rename'],
    template: ['template', 'format', 'compose text'],
    conditional: ['conditional', 'if', 'branch', 'when'],
    loop: ['loop', 'iterate', 'for each', 'batch'],
    http: ['http', 'api', 'fetch', 'request', 'url', 'endpoint', 'webhook'],
    estimate: ['cost', 'estimate', 'price', 'budget'],
    models: ['model', 'models', 'list models', 'catalog'],
    collections: ['collection', 'collections', 'list collections'],
    aggregate: ['aggregate', 'pipeline', 'mongodb aggregate'],
    search: ['full-text search', 'vector search'],
    code_search: ['code search', 'search code', 'codebase search'],
    code_index: ['code index', 'index code', 'index repo', 'index repository'],
    code_query: ['code query', 'ask about code', 'codebase question'],
    code_find_similar: ['find similar code', 'similar code', 'code clone'],
  };

  for (const [tool, kws] of Object.entries(keywords)) {
    for (const kw of kws) {
      if (lower.includes(kw)) {
        tools.push(tool);
        break;
      }
    }
  }

  // Default: if nothing matched, provide a basic query + generate (RAG) workflow
  if (tools.length === 0) {
    tools.push('query', 'generate');
  }

  // Deduplicate
  return [...new Set(tools)];
}

/**
 * Build a workflow from a known pattern.
 */
function buildFromPattern(patternKey, description, category, requestedTools) {
  const pattern = PATTERNS[patternKey];
  const slug = slugify(description);

  const workflow = {
    name: slug,
    description,
    version: '1.0.0',
    inputs: { ...pattern.inputs },
    defaults: {},
    steps: pattern.steps.map(s => ({ ...s, inputs: { ...s.inputs } })),
    output: { ...pattern.output },
  };

  // Add any extra requested tools not in the pattern as additional steps
  const patternTools = new Set(pattern.tools);
  const extras = requestedTools.filter(t => !patternTools.has(t));

  for (const tool of extras) {
    const stepId = `${tool}_step`;
    const step = buildStepForTool(tool, stepId, workflow);
    workflow.steps.push(step);
  }

  if (category) {
    workflow.category = category;
  }

  return workflow;
}

/**
 * Build a workflow from an explicit tool list with no pattern match.
 */
function buildFromToolList(description, category, requestedTools) {
  const slug = slugify(description);

  // Build inputs based on what tools need
  const inputs = {};
  const toolSet = new Set(requestedTools);

  if (toolSet.has('query') || toolSet.has('search') || toolSet.has('code_search') || toolSet.has('code_query')) {
    inputs.query = { type: 'string', required: true, description: 'Search query or question' };
  }
  if (toolSet.has('query') || toolSet.has('search') || toolSet.has('ingest')) {
    inputs.collection = { type: 'string', required: true, description: 'MongoDB collection name' };
  }
  if (toolSet.has('query') || toolSet.has('search')) {
    inputs.limit = { type: 'number', default: 10, description: 'Maximum results to return' };
  }
  if (toolSet.has('embed') || toolSet.has('chunk') || toolSet.has('ingest')) {
    inputs.text = { type: 'string', required: true, description: 'Text content to process' };
  }
  if (toolSet.has('similarity')) {
    inputs.text1 = { type: 'string', required: true, description: 'First text to compare' };
    inputs.text2 = { type: 'string', required: true, description: 'Second text to compare' };
  }
  if (toolSet.has('http')) {
    inputs.url = { type: 'string', required: true, description: 'URL for HTTP request' };
  }
  if (toolSet.has('estimate')) {
    inputs.docs = { type: 'number', required: true, description: 'Number of documents' };
    inputs.queries = { type: 'number', default: 0, description: 'Queries per month' };
  }
  if (toolSet.has('code_index')) {
    inputs.source = { type: 'string', required: true, description: 'Path or URL of code to index' };
  }
  if (toolSet.has('code_find_similar')) {
    inputs.code = { type: 'string', required: true, description: 'Code snippet to find similar implementations for' };
  }
  if (toolSet.has('explain')) {
    inputs.topic = { type: 'string', required: true, description: 'Topic to explain' };
  }

  // Build steps in a sensible order
  const steps = [];
  const output = {};

  // Data retrieval tools first
  const orderedTools = orderTools(requestedTools);
  let prevArrayStepId = null;

  for (let i = 0; i < orderedTools.length; i++) {
    const tool = orderedTools[i];
    const stepId = orderedTools.filter((t, j) => j < i && t === tool).length > 0
      ? `${tool}_step_${i}`
      : `${tool}_step`;

    const step = buildStepForTool(tool, stepId, { inputs, steps }, prevArrayStepId);
    steps.push(step);

    // Track steps that output arrays for chaining
    if (['query', 'search', 'merge', 'filter', 'transform', 'rerank'].includes(tool)) {
      prevArrayStepId = stepId;
    }
  }

  // Build output from last step(s)
  if (steps.length > 0) {
    const lastStep = steps[steps.length - 1];
    if (lastStep.tool === 'generate') {
      output.response = `{{ ${lastStep.id}.output.response }}`;
    } else if (['query', 'search', 'rerank', 'merge', 'filter', 'transform'].includes(lastStep.tool)) {
      output.results = `{{ ${lastStep.id}.output.results }}`;
    } else {
      output.result = `{{ ${lastStep.id}.output }}`;
    }
  }

  const workflow = {
    name: slug,
    description,
    version: '1.0.0',
    inputs,
    defaults: {},
    steps,
    output,
  };

  if (category) {
    workflow.category = category;
  }

  return workflow;
}

/**
 * Build a single step definition for a given tool.
 */
function buildStepForTool(tool, stepId, workflowContext, prevArrayStepId) {
  const inputs = workflowContext.inputs || {};
  const step = {
    id: stepId,
    tool,
    name: humanizeTool(tool),
    inputs: {},
  };

  switch (tool) {
    case 'query':
      step.inputs = { query: '{{ inputs.query }}', collection: '{{ inputs.collection }}', limit: '{{ inputs.limit }}' };
      break;
    case 'search':
      step.inputs = { query: '{{ inputs.query }}', collection: '{{ inputs.collection }}', limit: '{{ inputs.limit }}' };
      break;
    case 'rerank':
      step.inputs = {
        query: '{{ inputs.query }}',
        documents: prevArrayStepId ? `{{ ${prevArrayStepId}.output.results }}` : '{{ inputs.documents }}',
        model: 'rerank-2.5',
      };
      break;
    case 'embed':
      step.inputs = { text: '{{ inputs.text }}' };
      break;
    case 'similarity':
      step.inputs = { text1: '{{ inputs.text1 }}', text2: '{{ inputs.text2 }}' };
      break;
    case 'ingest':
      step.inputs = { text: '{{ inputs.text }}', collection: '{{ inputs.collection }}' };
      break;
    case 'chunk':
      step.inputs = { text: '{{ inputs.text }}', strategy: 'recursive', size: 512 };
      break;
    case 'generate':
      step.inputs = {
        prompt: `Based on the provided context, ${workflowContext.inputs?.query ? 'answer the question: {{ inputs.query }}' : 'generate a response.'}`,
      };
      if (prevArrayStepId) {
        step.inputs.context = `{{ ${prevArrayStepId}.output.results }}`;
      }
      break;
    case 'merge':
      step.inputs = { arrays: prevArrayStepId ? [`{{ ${prevArrayStepId}.output.results }}`] : [], dedup: true };
      break;
    case 'filter':
      step.inputs = {
        array: prevArrayStepId ? `{{ ${prevArrayStepId}.output.results }}` : [],
        condition: 'item.score > 0.5',
      };
      break;
    case 'transform':
      step.inputs = {
        array: prevArrayStepId ? `{{ ${prevArrayStepId}.output.results }}` : [],
        fields: ['text', 'score'],
      };
      break;
    case 'template':
      step.inputs = { text: 'Workflow result summary' };
      break;
    case 'conditional':
      step.inputs = { condition: 'true', then: [], else: [] };
      break;
    case 'loop':
      step.inputs = {
        items: prevArrayStepId ? `{{ ${prevArrayStepId}.output.results }}` : [],
        as: 'doc',
        step: { tool: 'embed', inputs: { text: '{{ doc.text }}' } },
      };
      break;
    case 'http':
      step.inputs = { url: '{{ inputs.url }}', method: 'GET' };
      break;
    case 'estimate':
      step.inputs = { docs: '{{ inputs.docs }}', queries: '{{ inputs.queries }}', months: 12 };
      break;
    case 'models':
      step.inputs = { category: 'all' };
      break;
    case 'collections':
      step.inputs = {};
      break;
    case 'explain':
      step.inputs = { topic: '{{ inputs.topic }}' };
      break;
    case 'aggregate':
      step.inputs = { collection: '{{ inputs.collection }}', pipeline: [] };
      break;
    case 'code_index':
      step.inputs = { source: '{{ inputs.source }}' };
      break;
    case 'code_search':
      step.inputs = { query: '{{ inputs.query }}' };
      break;
    case 'code_query':
      step.inputs = { query: '{{ inputs.query }}' };
      break;
    case 'code_find_similar':
      step.inputs = { code: '{{ inputs.code }}' };
      break;
    case 'code_status':
      step.inputs = {};
      break;
    default:
      step.inputs = TOOL_DEFAULTS[tool] || {};
  }

  return step;
}

/**
 * Order tools in a sensible execution sequence.
 */
function orderTools(tools) {
  const order = [
    'collections', 'models', 'code_status',
    'http',
    'chunk', 'code_index',
    'ingest',
    'embed',
    'query', 'search', 'code_search', 'code_query', 'code_find_similar',
    'similarity',
    'merge',
    'filter', 'transform',
    'rerank',
    'aggregate',
    'estimate', 'explain',
    'template',
    'conditional', 'loop',
    'generate',
  ];

  const orderMap = new Map(order.map((t, i) => [t, i]));
  return [...tools].sort((a, b) => (orderMap.get(a) || 50) - (orderMap.get(b) || 50));
}

/**
 * Create a human-readable name for a tool.
 */
function humanizeTool(tool) {
  const names = {
    query: 'Query documents', search: 'Vector search', rerank: 'Rerank results',
    embed: 'Generate embedding', similarity: 'Compare similarity',
    ingest: 'Ingest documents', chunk: 'Chunk text', generate: 'Generate response',
    merge: 'Merge results', filter: 'Filter results', transform: 'Transform data',
    template: 'Compose text', conditional: 'Conditional branch', loop: 'Loop over items',
    http: 'HTTP request', estimate: 'Cost estimate', models: 'List models',
    collections: 'List collections', explain: 'Explain topic', aggregate: 'Aggregation pipeline',
    code_index: 'Index codebase', code_search: 'Search code', code_query: 'Query codebase',
    code_find_similar: 'Find similar code', code_status: 'Code index status',
  };
  return names[tool] || tool;
}

/**
 * Slugify a description into a workflow name.
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

// ════════════════════════════════════════════════════════════════════
// Validate workflow tool
// ════════════════════════════════════════════════════════════════════

/**
 * Validate a workflow definition and return structured results.
 *
 * @param {object} params
 * @param {object} params.workflow - The workflow JSON definition
 * @returns {{ valid: boolean, errors: string[], warnings: string[], layers: string[][], dependencyGraph: object }}
 */
function validateWorkflowTool({ workflow }) {
  const errors = validateWorkflow(workflow);
  let layers = [];
  let dependencyGraph = {};

  if (errors.length === 0 && Array.isArray(workflow.steps) && workflow.steps.length > 0) {
    layers = buildExecutionPlan(workflow.steps);
    const graph = buildDependencyGraph(workflow.steps);
    for (const [stepId, deps] of graph) {
      dependencyGraph[stepId] = [...deps];
    }
  }

  // Separate warnings (non-blocking) from errors
  // For now, validateWorkflow returns all as errors in strict mode
  const warnings = [];

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    layers,
    dependencyGraph,
  };
}

// ════════════════════════════════════════════════════════════════════
// MCP Tool Registration
// ════════════════════════════════════════════════════════════════════

/**
 * Handler for vai_generate_workflow MCP tool.
 */
async function handleGenerateWorkflow(input) {
  const result = generateWorkflow(input);

  const summary = result.validation.valid
    ? `Generated valid workflow "${result.workflow.name}" with ${result.workflow.steps.length} steps across ${result.executionPlan.length} execution layers.`
    : `Generated workflow "${result.workflow.name}" with ${result.validation.errors.length} validation error(s). Review and fix the errors before running.`;

  return {
    structuredContent: result,
    content: [{
      type: 'text',
      text: `${summary}\n\nWorkflow JSON:\n${JSON.stringify(result.workflow, null, 2)}\n\nExecution Plan: ${JSON.stringify(result.executionPlan)}\n\nValidation: ${result.validation.valid ? 'PASSED' : 'FAILED - ' + result.validation.errors.join('; ')}`,
    }],
  };
}

/**
 * Handler for vai_validate_workflow MCP tool.
 */
async function handleValidateWorkflow(input) {
  const result = validateWorkflowTool(input);

  const summary = result.valid
    ? `Workflow is valid. ${result.layers.length} execution layer(s), ${Object.keys(result.dependencyGraph).length} step(s).`
    : `Workflow has ${result.errors.length} error(s).`;

  return {
    structuredContent: result,
    content: [{
      type: 'text',
      text: `${summary}\n\nErrors: ${result.errors.length > 0 ? result.errors.join('\n') : 'None'}\nWarnings: ${result.warnings.length > 0 ? result.warnings.join('\n') : 'None'}\nExecution Layers: ${JSON.stringify(result.layers)}\nDependency Graph: ${JSON.stringify(result.dependencyGraph, null, 2)}`,
    }],
  };
}

/**
 * Register authoring tools on the MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {object} schemas
 */
function registerAuthoringTools(server, schemas) {
  server.tool(
    'vai_generate_workflow',
    'Generate a complete, executable vai workflow JSON from a natural language description. Returns the workflow definition, validation results, and execution plan. The generated workflow uses template expressions for step inputs and follows all vai workflow conventions.',
    schemas.generateWorkflowSchema,
    handleGenerateWorkflow
  );

  server.tool(
    'vai_validate_workflow',
    'Validate a vai workflow JSON definition. Checks for structural errors, unknown tools, circular dependencies, and missing references. Returns validation errors, warnings, execution plan layers, and the dependency graph.',
    schemas.validateWorkflowSchema,
    handleValidateWorkflow
  );
}

module.exports = {
  registerAuthoringTools,
  handleGenerateWorkflow,
  handleValidateWorkflow,
  generateWorkflow,
  validateWorkflowTool,
};
