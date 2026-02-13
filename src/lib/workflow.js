'use strict';

const path = require('path');
const fs = require('fs');
const {
  resolveTemplate,
  resolveString,
  extractDependencies,
  isTemplateString,
} = require('./template-engine');

// ════════════════════════════════════════════════════════════════════
// Valid tool names — vai tools + control flow
// ════════════════════════════════════════════════════════════════════

const VAI_TOOLS = new Set([
  'query', 'search', 'rerank', 'embed', 'similarity',
  'ingest', 'collections', 'models', 'explain', 'estimate',
]);

const CONTROL_FLOW_TOOLS = new Set(['merge', 'filter', 'transform', 'generate']);

const ALL_TOOLS = new Set([...VAI_TOOLS, ...CONTROL_FLOW_TOOLS]);

// ════════════════════════════════════════════════════════════════════
// Validation
// ════════════════════════════════════════════════════════════════════

/**
 * Validate a workflow definition object.
 * Returns an array of error strings (empty = valid).
 *
 * @param {object} definition - Parsed workflow JSON
 * @returns {string[]} errors
 */
function validateWorkflow(definition) {
  const errors = [];

  // Top-level required fields
  if (!definition || typeof definition !== 'object') {
    return ['Workflow definition must be a JSON object'];
  }
  if (!definition.name || typeof definition.name !== 'string') {
    errors.push('Workflow must have a "name" string');
  }
  if (!Array.isArray(definition.steps) || definition.steps.length === 0) {
    errors.push('Workflow must have a non-empty "steps" array');
  }

  if (errors.length > 0) return errors; // Can't validate steps without them

  // Validate inputs schema
  if (definition.inputs) {
    for (const [key, schema] of Object.entries(definition.inputs)) {
      if (schema.type && !['string', 'number', 'boolean'].includes(schema.type)) {
        errors.push(`Input "${key}" has invalid type "${schema.type}" (must be string, number, or boolean)`);
      }
    }
  }

  // Step-level validation
  const stepIds = new Set();
  const duplicateIds = new Set();

  for (let i = 0; i < definition.steps.length; i++) {
    const step = definition.steps[i];
    const prefix = `Step ${i}`;

    if (!step.id || typeof step.id !== 'string') {
      errors.push(`${prefix}: must have a string "id"`);
      continue;
    }

    const stepPrefix = `Step "${step.id}"`;

    // Duplicate check
    if (stepIds.has(step.id)) {
      duplicateIds.add(step.id);
    }
    stepIds.add(step.id);

    // Tool validation
    if (!step.tool || typeof step.tool !== 'string') {
      errors.push(`${stepPrefix}: must have a string "tool"`);
    } else if (!ALL_TOOLS.has(step.tool)) {
      errors.push(`${stepPrefix}: unknown tool "${step.tool}" (available: ${[...ALL_TOOLS].join(', ')})`);
    }

    // Inputs validation
    if (step.tool !== 'generate' && (!step.inputs || typeof step.inputs !== 'object')) {
      errors.push(`${stepPrefix}: must have an "inputs" object`);
    }

    // Check template references point to known step IDs or reserved prefixes
    // "item" and "index" are injected by forEach at runtime
    const forEachVars = step.forEach ? new Set(['item', 'index']) : new Set();
    if (step.inputs) {
      const deps = extractDependencies(step.inputs);
      for (const dep of deps) {
        if (!forEachVars.has(dep) && !stepIds.has(dep) && !definition.steps.some(s => s.id === dep)) {
          errors.push(`${stepPrefix}: references unknown step "${dep}"`);
        }
      }
    }

    // Condition validation (if present, should be a string)
    if (step.condition !== undefined && typeof step.condition !== 'string') {
      errors.push(`${stepPrefix}: "condition" must be a string`);
    }

    // forEach validation (if present, should be a template string)
    if (step.forEach !== undefined && typeof step.forEach !== 'string') {
      errors.push(`${stepPrefix}: "forEach" must be a string`);
    }
  }

  // Report duplicates
  for (const id of duplicateIds) {
    errors.push(`Duplicate step id: "${id}"`);
  }

  // Check for circular dependencies
  const cycleErrors = detectCycles(definition.steps);
  errors.push(...cycleErrors);

  return errors;
}

/**
 * Detect circular dependencies in steps using DFS.
 * @param {Array} steps
 * @returns {string[]} errors
 */
function detectCycles(steps) {
  const errors = [];
  const stepMap = new Map(steps.map(s => [s.id, s]));
  const adjList = new Map();

  // Build adjacency list from template dependencies
  for (const step of steps) {
    const deps = extractDependencies(step.inputs || {});
    if (step.condition) {
      const condDeps = extractDependencies(step.condition);
      for (const d of condDeps) deps.add(d);
    }
    if (step.forEach) {
      const forDeps = extractDependencies(step.forEach);
      for (const d of forDeps) deps.add(d);
    }
    adjList.set(step.id, deps);
  }

  // DFS cycle detection
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map(steps.map(s => [s.id, WHITE]));

  function dfs(nodeId, path) {
    color.set(nodeId, GRAY);
    path.push(nodeId);

    const neighbors = adjList.get(nodeId) || new Set();
    for (const dep of neighbors) {
      if (!stepMap.has(dep)) continue; // Unknown deps caught by validateWorkflow
      if (color.get(dep) === GRAY) {
        const cycleStart = path.indexOf(dep);
        const cycle = path.slice(cycleStart).concat(dep);
        errors.push(`Circular dependency: ${cycle.join(' -> ')}`);
        return;
      }
      if (color.get(dep) === WHITE) {
        dfs(dep, path);
      }
    }

    path.pop();
    color.set(nodeId, BLACK);
  }

  for (const step of steps) {
    if (color.get(step.id) === WHITE) {
      dfs(step.id, []);
    }
  }

  return errors;
}

// ════════════════════════════════════════════════════════════════════
// Dependency Resolution + Execution Plan
// ════════════════════════════════════════════════════════════════════

/**
 * Build a dependency graph: stepId -> Set of step IDs it depends on.
 * @param {Array} steps
 * @returns {Map<string, Set<string>>}
 */
function buildDependencyGraph(steps) {
  const graph = new Map();

  for (const step of steps) {
    const deps = extractDependencies(step.inputs || {});
    if (step.condition) {
      const condDeps = extractDependencies(step.condition);
      for (const d of condDeps) deps.add(d);
    }
    if (step.forEach) {
      const forDeps = extractDependencies(step.forEach);
      for (const d of forDeps) deps.add(d);
    }
    graph.set(step.id, deps);
  }

  return graph;
}

/**
 * Topological sort with layer grouping (Kahn's algorithm).
 * Returns layers: each layer is an array of step IDs that can run in parallel.
 *
 * @param {Array} steps
 * @returns {string[][]} layers
 */
function buildExecutionPlan(steps) {
  const graph = buildDependencyGraph(steps);
  const stepIds = new Set(steps.map(s => s.id));

  // In-degree: count of dependencies that are actual steps
  const inDegree = new Map();
  for (const step of steps) {
    const deps = graph.get(step.id);
    let count = 0;
    for (const dep of deps) {
      if (stepIds.has(dep)) count++;
    }
    inDegree.set(step.id, count);
  }

  const layers = [];
  const remaining = new Set(stepIds);

  while (remaining.size > 0) {
    // Find all nodes with in-degree 0
    const ready = [];
    for (const id of remaining) {
      if (inDegree.get(id) === 0) {
        ready.push(id);
      }
    }

    if (ready.length === 0) {
      // Should not happen if cycle detection passed, but guard against it
      break;
    }

    layers.push(ready);

    // Remove ready nodes and decrease in-degree of dependents
    for (const id of ready) {
      remaining.delete(id);
      // Decrease in-degree of all steps that depend on this id
      for (const otherId of remaining) {
        const deps = graph.get(otherId);
        if (deps.has(id)) {
          inDegree.set(otherId, inDegree.get(otherId) - 1);
        }
      }
    }
  }

  return layers;
}

// ════════════════════════════════════════════════════════════════════
// Condition Evaluator
// ════════════════════════════════════════════════════════════════════

/**
 * Evaluate a simple condition expression.
 * Supports: comparisons (>, <, >=, <=, ===, !==, ==, !=),
 * boolean operators (&&, ||), negation (!), property access, array .length.
 *
 * This is NOT eval(). It's a very restricted expression evaluator.
 *
 * @param {string} expr - e.g. "check.output.results.length > 0"
 * @param {object} context
 * @returns {boolean}
 */
function evaluateCondition(expr, context) {
  let resolved = expr;

  if (isTemplateString(expr)) {
    // Check if the entire expression is wrapped in {{ }}
    // If so, extract the inner content and evaluate it as a condition
    const soleMatch = expr.match(/^\{\{\s*(.+?)\s*\}\}$/);
    if (soleMatch) {
      const inner = soleMatch[1];
      // If the inner expression contains operators, evaluate as condition
      if (/[><=!&|]/.test(inner)) {
        try {
          return evaluateSimpleExpr(inner.trim(), context);
        } catch {
          return false;
        }
      }
      // Otherwise resolve as template value and check truthiness
      resolved = resolveString(expr, context);
      if (typeof resolved !== 'string') {
        return Boolean(resolved);
      }
    } else {
      // Mixed text + templates: resolve then evaluate
      resolved = resolveString(expr, context);
      if (typeof resolved !== 'string') {
        return Boolean(resolved);
      }
    }
  }

  // Try to evaluate as a simple expression
  try {
    return evaluateSimpleExpr(resolved.trim(), context);
  } catch {
    // If evaluation fails, treat as falsy
    return false;
  }
}

/**
 * Simple expression evaluator for conditions.
 * Handles: path lookups, comparisons, &&, ||, !, literals.
 */
function evaluateSimpleExpr(expr, context) {
  // Handle boolean operators (lowest precedence)
  // Split on || first
  const orParts = splitOutsideParens(expr, '||');
  if (orParts.length > 1) {
    return orParts.some(part => evaluateSimpleExpr(part.trim(), context));
  }

  // Split on &&
  const andParts = splitOutsideParens(expr, '&&');
  if (andParts.length > 1) {
    return andParts.every(part => evaluateSimpleExpr(part.trim(), context));
  }

  // Handle negation
  if (expr.startsWith('!') && !expr.startsWith('!=')) {
    return !evaluateSimpleExpr(expr.slice(1).trim(), context);
  }

  // Handle parentheses
  if (expr.startsWith('(') && expr.endsWith(')')) {
    return evaluateSimpleExpr(expr.slice(1, -1).trim(), context);
  }

  // Handle comparisons
  const compOps = ['===', '!==', '>=', '<=', '==', '!=', '>', '<'];
  for (const op of compOps) {
    const idx = expr.indexOf(op);
    if (idx !== -1) {
      const left = resolveValue(expr.slice(0, idx).trim(), context);
      const right = resolveValue(expr.slice(idx + op.length).trim(), context);
      switch (op) {
        case '===': return left === right;
        case '!==': return left !== right;
        case '==': return left == right;
        case '!=': return left != right;
        case '>': return left > right;
        case '<': return left < right;
        case '>=': return left >= right;
        case '<=': return left <= right;
      }
    }
  }

  // No operator: evaluate as truthy/falsy
  return Boolean(resolveValue(expr, context));
}

/**
 * Split a string by an operator, but not inside parentheses.
 */
function splitOutsideParens(str, op) {
  const parts = [];
  let depth = 0;
  let current = '';

  for (let i = 0; i < str.length; i++) {
    if (str[i] === '(') depth++;
    if (str[i] === ')') depth--;

    if (depth === 0 && str.slice(i, i + op.length) === op) {
      parts.push(current);
      current = '';
      i += op.length - 1;
    } else {
      current += str[i];
    }
  }
  parts.push(current);
  return parts;
}

/**
 * Resolve a value from an expression fragment.
 * Handles: number literals, string literals, true/false, null, undefined, path lookups.
 */
function resolveValue(expr, context) {
  const trimmed = expr.trim();

  // Number
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return parseFloat(trimmed);
  }

  // String literal (single or double quotes)
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1);
  }

  // Boolean / null / undefined
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (trimmed === 'undefined') return undefined;

  // Path lookup (e.g., "check.output.results.length")
  // Walk the context object
  try {
    const parts = trimmed.split('.');
    let current = context;
    for (const part of parts) {
      // Handle array indexing
      const bracketMatch = part.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\[(\d+)\]$/);
      if (bracketMatch) {
        current = current[bracketMatch[1]];
        if (current == null) return undefined;
        current = current[parseInt(bracketMatch[2], 10)];
      } else {
        if (current == null) return undefined;
        current = current[part];
      }
    }
    return current;
  } catch {
    return undefined;
  }
}

// ════════════════════════════════════════════════════════════════════
// Control Flow Executors
// ════════════════════════════════════════════════════════════════════

/**
 * Execute a merge step: concatenate arrays with optional dedup.
 *
 * @param {object} inputs - { arrays: any[][], dedup?: boolean, dedup_field?: string }
 * @returns {{ results: any[], resultCount: number }}
 */
function executeMerge(inputs) {
  const { arrays, dedup, dedup_field } = inputs;

  if (!Array.isArray(arrays)) {
    throw new Error('merge: "arrays" input must be an array of arrays');
  }

  let merged = [];
  for (const arr of arrays) {
    if (Array.isArray(arr)) {
      merged = merged.concat(arr);
    }
  }

  if (dedup && dedup_field) {
    const seen = new Set();
    merged = merged.filter(item => {
      const key = item && typeof item === 'object' ? item[dedup_field] : item;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return { results: merged, resultCount: merged.length };
}

/**
 * Execute a filter step: filter array by condition.
 *
 * @param {object} inputs - { array: any[], condition: string }
 * @param {object} context - workflow context for evaluating conditions
 * @returns {{ results: any[], resultCount: number }}
 */
function executeFilter(inputs, context) {
  const { array, condition } = inputs;

  if (!Array.isArray(array)) {
    throw new Error('filter: "array" input must be an array');
  }

  if (!condition || typeof condition !== 'string') {
    throw new Error('filter: "condition" must be a string expression');
  }

  const results = array.filter(item => {
    // Make "item" available in the condition context
    const itemContext = { ...context, item };
    return evaluateCondition(condition, itemContext);
  });

  return { results, resultCount: results.length };
}

/**
 * Execute a transform step: map/reshape array items.
 *
 * @param {object} inputs - { array: any[], fields?: string[], mapping?: object }
 * @returns {{ results: any[], resultCount: number }}
 */
function executeTransform(inputs) {
  const { array, fields, mapping } = inputs;

  if (!Array.isArray(array)) {
    throw new Error('transform: "array" input must be an array');
  }

  let results;

  if (fields) {
    // Pick specific fields
    results = array.map(item => {
      if (!item || typeof item !== 'object') return item;
      const picked = {};
      for (const field of fields) {
        if (field in item) picked[field] = item[field];
      }
      return picked;
    });
  } else if (mapping) {
    // Rename/reshape fields
    results = array.map(item => {
      if (!item || typeof item !== 'object') return item;
      const mapped = {};
      for (const [newKey, oldKey] of Object.entries(mapping)) {
        mapped[newKey] = typeof oldKey === 'string' && oldKey in item ? item[oldKey] : oldKey;
      }
      return mapped;
    });
  } else {
    results = array;
  }

  return { results, resultCount: results.length };
}

// ════════════════════════════════════════════════════════════════════
// VAI Tool Executors
// ════════════════════════════════════════════════════════════════════

/**
 * Execute a vai query step (embed + vector search + optional rerank).
 */
async function executeQuery(inputs, defaults) {
  const { generateEmbeddings, apiRequest } = require('./api');
  const { getMongoCollection } = require('./mongo');
  const { loadProject } = require('./project');
  const { config: proj } = loadProject();

  const db = inputs.db || defaults.db || proj.db;
  const collection = inputs.collection || defaults.collection || proj.collection;
  const model = inputs.model || defaults.model;
  const query = inputs.query;
  const limit = inputs.limit || 10;
  const doRerank = inputs.rerank !== false;

  if (!query) throw new Error('query: "query" input is required');
  if (!db) throw new Error('query: database not specified (set in inputs, defaults, or vai config)');
  if (!collection) throw new Error('query: collection not specified');

  // Embed
  const embOpts = { inputType: 'query' };
  if (model) embOpts.model = model;
  const embRes = await generateEmbeddings([query], embOpts);
  const embedding = embRes.data[0].embedding;

  // Vector search
  const { client, collection: col } = await getMongoCollection(db, collection);
  try {
    const results = await col.aggregate([
      {
        $vectorSearch: {
          index: 'vector_index',
          path: 'embedding',
          queryVector: embedding,
          numCandidates: Math.min(limit * 10, 200),
          limit,
        },
      },
      {
        $project: {
          text: 1, content: 1, source: 1, metadata: 1,
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ]).toArray();

    // Rerank if requested and results exist
    if (doRerank && results.length > 0) {
      const documents = results.map(r => r.text || r.content || '');
      const { DEFAULT_RERANK_MODEL } = require('./catalog');
      const rerankRes = await apiRequest('/rerank', {
        model: inputs.rerankModel || DEFAULT_RERANK_MODEL,
        query,
        documents,
      });

      const reranked = (rerankRes.data || []).map(r => ({
        ...results[r.index],
        score: r.relevance_score,
      }));

      return { results: reranked, resultCount: reranked.length };
    }

    return { results, resultCount: results.length };
  } finally {
    await client.close();
  }
}

/**
 * Execute a vai search step (embed + vector search, no rerank).
 */
async function executeSearch(inputs, defaults) {
  return executeQuery({ ...inputs, rerank: false }, defaults);
}

/**
 * Execute a vai rerank step.
 */
async function executeRerank(inputs) {
  const { apiRequest } = require('./api');
  const { DEFAULT_RERANK_MODEL } = require('./catalog');

  const query = inputs.query;
  const documents = inputs.documents;
  const model = inputs.model || DEFAULT_RERANK_MODEL;

  if (!query) throw new Error('rerank: "query" input is required');
  if (!Array.isArray(documents)) throw new Error('rerank: "documents" must be an array');

  // If documents are objects, extract text
  const docTexts = documents.map(d =>
    typeof d === 'string' ? d : (d.text || d.content || JSON.stringify(d))
  );

  const res = await apiRequest('/rerank', { model, query, documents: docTexts });

  const results = (res.data || []).map(r => ({
    ...(typeof documents[r.index] === 'object' ? documents[r.index] : { text: documents[r.index] }),
    score: r.relevance_score,
  }));

  return { results, resultCount: results.length };
}

/**
 * Execute a vai embed step.
 */
async function executeEmbed(inputs, defaults) {
  const { generateEmbeddings } = require('./api');

  const text = inputs.text;
  const model = inputs.model || defaults.model;
  const inputType = inputs.inputType || 'query';

  if (!text) throw new Error('embed: "text" input is required');

  const opts = { inputType };
  if (model) opts.model = model;
  if (inputs.dimensions) opts.dimensions = inputs.dimensions;

  const res = await generateEmbeddings([text], opts);
  return {
    embedding: res.data[0].embedding,
    model: res.model,
    dimensions: res.data[0].embedding.length,
  };
}

/**
 * Execute a vai similarity step.
 */
async function executeSimilarity(inputs, defaults) {
  const { generateEmbeddings } = require('./api');
  const { cosineSimilarity } = require('./math');

  const { text1, text2 } = inputs;
  const model = inputs.model || defaults.model;

  if (!text1 || !text2) throw new Error('similarity: "text1" and "text2" are required');

  const opts = { inputType: 'document' };
  if (model) opts.model = model;

  const res = await generateEmbeddings([text1, text2], opts);
  const similarity = cosineSimilarity(res.data[0].embedding, res.data[1].embedding);

  return { similarity, model: res.model };
}

/**
 * Execute a vai ingest step.
 */
async function executeIngest(inputs, defaults) {
  const { generateEmbeddings } = require('./api');
  const { getMongoCollection } = require('./mongo');
  const { chunk } = require('./chunker');
  const { loadProject } = require('./project');
  const { config: proj } = loadProject();

  const db = inputs.db || defaults.db || proj.db;
  const collection = inputs.collection || defaults.collection || proj.collection;
  const text = inputs.text;
  const source = inputs.source || 'workflow-ingest';
  const model = inputs.model || defaults.model;

  if (!text) throw new Error('ingest: "text" input is required');
  if (!db) throw new Error('ingest: database not specified');
  if (!collection) throw new Error('ingest: collection not specified');

  // Chunk text
  const chunks = chunk(text, {
    strategy: inputs.chunkStrategy || 'recursive',
    size: inputs.chunkSize || 512,
  });

  // Embed chunks
  const embOpts = { inputType: 'document' };
  if (model) embOpts.model = model;
  const embRes = await generateEmbeddings(chunks, embOpts);

  // Build docs
  const docs = chunks.map((chunkText, i) => ({
    text: chunkText,
    source,
    embedding: embRes.data[i].embedding,
    metadata: inputs.metadata || {},
    createdAt: new Date(),
  }));

  // Insert
  const { client, collection: col } = await getMongoCollection(db, collection);
  try {
    const result = await col.insertMany(docs);
    return {
      insertedCount: result.insertedCount,
      chunks: chunks.length,
      source,
      model: embRes.model,
    };
  } finally {
    await client.close();
  }
}

/**
 * Execute a vai collections step.
 */
async function executeCollections(inputs, defaults) {
  const { introspectCollections } = require('./workflow-utils');
  const { loadProject } = require('./project');
  const { config: proj } = loadProject();

  const db = inputs.db || defaults.db || proj.db;
  if (!db) throw new Error('collections: database not specified');

  const collections = await introspectCollections(db);
  return { collections, database: db };
}

/**
 * Execute a vai models step.
 */
function executeModels(inputs) {
  const { MODEL_CATALOG } = require('./catalog');

  let models = MODEL_CATALOG.filter(m => !m.legacy && !m.unreleased);
  const category = inputs.category || 'all';

  if (category !== 'all') {
    models = models.filter(m => m.type === category);
  }

  return {
    models: models.map(m => ({
      name: m.name,
      type: m.type,
      dimensions: m.dimensions,
      price: m.price,
      bestFor: m.bestFor,
    })),
    category,
  };
}

/**
 * Execute a vai explain step.
 */
function executeExplain(inputs) {
  const { resolveConcept, getConcept } = require('./explanations');

  const topic = inputs.topic;
  if (!topic) throw new Error('explain: "topic" input is required');

  const conceptKey = resolveConcept(topic);
  if (!conceptKey) {
    return { found: false, topic, text: `No explanation found for "${topic}"` };
  }

  const concept = getConcept(conceptKey);
  return {
    found: true,
    topic: concept.title,
    text: concept.content,
    links: concept.links || [],
  };
}

/**
 * Execute a vai estimate step.
 */
function executeEstimate(inputs) {
  const { MODEL_CATALOG } = require('./catalog');

  const docs = inputs.docs || 1000;
  const queries = inputs.queries || 0;
  const months = inputs.months || 12;
  const model = inputs.model || 'voyage-4-large';

  const modelInfo = MODEL_CATALOG.find(m => m.name === model);
  if (!modelInfo) {
    return { error: `Unknown model: ${model}`, model };
  }

  const pricePerMToken = modelInfo.pricePerMToken || 0;
  // Rough estimate: avg 500 tokens per document chunk
  const avgTokensPerDoc = 500;
  const embeddingCost = (docs * avgTokensPerDoc / 1_000_000) * pricePerMToken;

  // Query cost (embedding queries)
  const avgQueryTokens = 50;
  const monthlyCost = (queries * avgQueryTokens / 1_000_000) * pricePerMToken;
  const totalQueryCost = monthlyCost * months;

  return {
    model,
    docs,
    embeddingCost: Math.round(embeddingCost * 10000) / 10000,
    queriesPerMonth: queries,
    monthlyQueryCost: Math.round(monthlyCost * 10000) / 10000,
    totalCost: Math.round((embeddingCost + totalQueryCost) * 10000) / 10000,
    months,
  };
}

/**
 * Execute a generate step (LLM call).
 */
async function executeGenerate(inputs) {
  const { createLLMProvider } = require('./llm');

  const provider = createLLMProvider();
  if (!provider) {
    throw new Error(
      'generate: No LLM provider configured.\n' +
      'Set up with: vai config set llm-provider anthropic\n' +
      '             vai config set llm-api-key YOUR_KEY'
    );
  }

  const prompt = inputs.prompt;
  if (!prompt) throw new Error('generate: "prompt" input is required');

  const messages = [];

  if (inputs.systemPrompt) {
    messages.push({ role: 'system', content: inputs.systemPrompt });
  }

  // Build user message with context if provided
  let userContent = prompt;
  if (inputs.context) {
    const contextStr = Array.isArray(inputs.context)
      ? inputs.context.map(item =>
          typeof item === 'string' ? item : (item.text || item.content || JSON.stringify(item))
        ).join('\n\n---\n\n')
      : String(inputs.context);
    userContent = `${prompt}\n\nContext:\n${contextStr}`;
  }
  messages.push({ role: 'user', content: userContent });

  // Collect streaming response
  let text = '';
  for await (const chunk of provider.chat(messages, { stream: true })) {
    text += chunk;
  }

  return {
    text,
    model: provider.model,
    provider: provider.name,
  };
}

// ════════════════════════════════════════════════════════════════════
// Step Dispatcher
// ════════════════════════════════════════════════════════════════════

/**
 * Execute a single step with resolved inputs.
 *
 * @param {object} step - The step definition
 * @param {object} resolvedInputs - Inputs with templates already resolved
 * @param {object} defaults - Workflow defaults
 * @param {object} context - Full workflow context
 * @returns {Promise<object>} Step output
 */
async function executeStep(step, resolvedInputs, defaults, context) {
  switch (step.tool) {
    // Control flow
    case 'merge':
      return executeMerge(resolvedInputs);
    case 'filter':
      return executeFilter(resolvedInputs, context);
    case 'transform':
      return executeTransform(resolvedInputs);
    case 'generate':
      return executeGenerate(resolvedInputs);

    // VAI tools
    case 'query':
      return executeQuery(resolvedInputs, defaults);
    case 'search':
      return executeSearch(resolvedInputs, defaults);
    case 'rerank':
      return executeRerank(resolvedInputs);
    case 'embed':
      return executeEmbed(resolvedInputs, defaults);
    case 'similarity':
      return executeSimilarity(resolvedInputs, defaults);
    case 'ingest':
      return executeIngest(resolvedInputs, defaults);
    case 'collections':
      return executeCollections(resolvedInputs, defaults);
    case 'models':
      return executeModels(resolvedInputs);
    case 'explain':
      return executeExplain(resolvedInputs);
    case 'estimate':
      return executeEstimate(resolvedInputs);

    default:
      throw new Error(`Unknown tool: "${step.tool}"`);
  }
}

// ════════════════════════════════════════════════════════════════════
// Main Execution Loop
// ════════════════════════════════════════════════════════════════════

/**
 * Execute a workflow definition.
 *
 * @param {object} definition - Parsed workflow JSON
 * @param {object} opts
 * @param {object} [opts.inputs] - Workflow input values
 * @param {string} [opts.db] - Database override
 * @param {string} [opts.collection] - Collection override
 * @param {boolean} [opts.dryRun] - Show plan without executing
 * @param {boolean} [opts.verbose] - Show step details
 * @param {boolean} [opts.json] - Return JSON output
 * @param {Function} [opts.onStepStart] - Callback(stepId, stepDef)
 * @param {Function} [opts.onStepComplete] - Callback(stepId, output, durationMs)
 * @param {Function} [opts.onStepSkip] - Callback(stepId, reason)
 * @param {Function} [opts.onStepError] - Callback(stepId, error)
 * @returns {Promise<{ output: object, steps: Array, totalTimeMs: number, layers: string[][] }>}
 */
async function executeWorkflow(definition, opts = {}) {
  const startTime = Date.now();

  // Validate
  const errors = validateWorkflow(definition);
  if (errors.length > 0) {
    throw new Error(`Workflow validation failed:\n  ${errors.join('\n  ')}`);
  }

  // Validate required inputs
  const inputValues = opts.inputs || {};
  if (definition.inputs) {
    for (const [key, schema] of Object.entries(definition.inputs)) {
      if (schema.required && !(key in inputValues) && !('default' in schema)) {
        throw new Error(`Missing required input: "${key}"`);
      }
    }
  }

  // Build effective inputs (fill defaults)
  const effectiveInputs = {};
  if (definition.inputs) {
    for (const [key, schema] of Object.entries(definition.inputs)) {
      if (key in inputValues) {
        effectiveInputs[key] = coerceInput(inputValues[key], schema.type);
      } else if ('default' in schema) {
        effectiveInputs[key] = schema.default;
      }
    }
  }
  // Also pass through any extra inputs not in schema
  for (const [key, val] of Object.entries(inputValues)) {
    if (!(key in effectiveInputs)) {
      effectiveInputs[key] = val;
    }
  }

  // Build defaults with CLI overrides
  const defaults = {
    ...(definition.defaults || {}),
    ...(opts.db && { db: opts.db }),
    ...(opts.collection && { collection: opts.collection }),
  };

  // Build execution plan
  const layers = buildExecutionPlan(definition.steps);
  const stepMap = new Map(definition.steps.map(s => [s.id, s]));

  // Dry run: return plan without executing
  if (opts.dryRun) {
    return {
      output: null,
      steps: [],
      totalTimeMs: 0,
      layers,
      inputs: effectiveInputs,
      defaults,
      dryRun: true,
    };
  }

  // Initialize context
  const context = {
    inputs: effectiveInputs,
    defaults,
  };

  // Execute layer by layer
  const stepResults = [];

  for (const layer of layers) {
    const layerPromises = layer.map(async (stepId) => {
      const step = stepMap.get(stepId);
      const stepStart = Date.now();

      // Evaluate condition
      if (step.condition) {
        const conditionMet = evaluateCondition(step.condition, context);
        if (!conditionMet) {
          if (opts.onStepSkip) opts.onStepSkip(stepId, 'condition not met');
          context[stepId] = { output: null, skipped: true };
          stepResults.push({
            id: stepId,
            tool: step.tool,
            skipped: true,
            durationMs: Date.now() - stepStart,
          });
          return;
        }
      }

      if (opts.onStepStart) opts.onStepStart(stepId, step);

      try {
        let output;

        if (step.forEach) {
          // Iterate over an array
          const iterArray = resolveTemplate(step.forEach, context);
          if (!Array.isArray(iterArray)) {
            throw new Error(`forEach in step "${stepId}" did not resolve to an array`);
          }

          const iterResults = [];
          for (let i = 0; i < iterArray.length; i++) {
            const iterContext = { ...context, item: iterArray[i], index: i };
            const resolvedInputs = resolveTemplate(step.inputs || {}, iterContext);
            const iterOutput = await executeStep(step, resolvedInputs, defaults, iterContext);
            iterResults.push(iterOutput);
          }
          output = { results: iterResults, count: iterResults.length };
        } else {
          // Normal execution
          const resolvedInputs = resolveTemplate(step.inputs || {}, context);
          output = await executeStep(step, resolvedInputs, defaults, context);
        }

        const durationMs = Date.now() - stepStart;
        context[stepId] = { output };

        if (opts.onStepComplete) opts.onStepComplete(stepId, output, durationMs);

        stepResults.push({
          id: stepId,
          tool: step.tool,
          output,
          durationMs,
        });
      } catch (err) {
        const durationMs = Date.now() - stepStart;

        if (step.continueOnError) {
          context[stepId] = { output: null, error: err.message };
          if (opts.onStepError) opts.onStepError(stepId, err);
          stepResults.push({
            id: stepId,
            tool: step.tool,
            error: err.message,
            durationMs,
          });
        } else {
          if (opts.onStepError) opts.onStepError(stepId, err);
          throw new Error(`Step "${stepId}" failed: ${err.message}`);
        }
      }
    });

    await Promise.all(layerPromises);
  }

  // Resolve output templates
  const output = definition.output
    ? resolveTemplate(definition.output, context)
    : context;

  return {
    output,
    steps: stepResults,
    totalTimeMs: Date.now() - startTime,
    layers,
  };
}

/**
 * Coerce a string input value to the expected type.
 */
function coerceInput(value, type) {
  if (type === 'number' && typeof value === 'string') {
    const num = parseFloat(value);
    return isNaN(num) ? value : num;
  }
  if (type === 'boolean' && typeof value === 'string') {
    return value === 'true' || value === '1';
  }
  return value;
}

// ════════════════════════════════════════════════════════════════════
// Input Schema Helpers
// ════════════════════════════════════════════════════════════════════

/**
 * Convert a workflow's `inputs` object into wizard-engine-compatible step definitions.
 * Used by both CLI (via @clack/prompts) and playground (via input modal) to
 * prompt users for missing inputs before execution.
 *
 * @param {object} definition - Workflow definition with an `inputs` property
 * @returns {import('./wizard').Step[]}
 */
function buildInputSteps(definition) {
  if (!definition.inputs) return [];
  return Object.entries(definition.inputs).map(([key, spec]) => ({
    id: key,
    label: spec.description || key,
    type: 'text',
    required: !!spec.required,
    placeholder: spec.type === 'number' ? 'number' : (spec.type || 'string'),
    defaultValue: spec.default !== undefined ? String(spec.default) : undefined,
    validate: (val) => {
      if (spec.type === 'number' && val && isNaN(Number(val))) {
        return 'Must be a number';
      }
      return true;
    },
  }));
}

// ════════════════════════════════════════════════════════════════════
// Built-in Templates
// ════════════════════════════════════════════════════════════════════

/**
 * Get the path to the built-in workflows directory.
 */
function getWorkflowsDir() {
  return path.join(__dirname, '..', 'workflows');
}

/**
 * List built-in workflow templates.
 * @returns {Array<{ name: string, description: string, file: string }>}
 */
function listBuiltinWorkflows() {
  const dir = getWorkflowsDir();
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  return files.map(f => {
    try {
      const def = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      return {
        name: f.replace('.json', ''),
        description: def.description || def.name || f,
        file: f,
      };
    } catch {
      return { name: f.replace('.json', ''), description: '(error reading)', file: f };
    }
  });
}

// ════════════════════════════════════════════════════════════════════
// Example Workflows
// ════════════════════════════════════════════════════════════════════

const EXAMPLE_CATEGORIES = {
  'search-filter-transform': 'Retrieval',
  'conditional-fallback-search': 'Retrieval',
  'multi-query-fusion': 'Retrieval',
  'rag-with-guardrails': 'RAG',
  'question-answer-with-citations': 'RAG',
  'topic-deep-dive': 'RAG',
  'dedup-and-ingest': 'Ingestion',
  'content-quality-gate': 'Ingestion',
  'embedding-model-comparison': 'Analysis',
  'batch-similarity-check': 'Analysis',
  'collection-inventory': 'Analysis',
};

/**
 * Get the path to the example workflows directory.
 */
function getExamplesDir() {
  return path.join(__dirname, '..', '..', 'examples', 'workflows');
}

/**
 * List example workflow files with category metadata.
 * @returns {Array<{ name: string, description: string, file: string, category: string, isExample: boolean }>}
 */
function listExampleWorkflows() {
  const dir = getExamplesDir();
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  return files.map(f => {
    try {
      const def = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const stem = f.replace('.json', '');
      return {
        name: stem,
        description: def.description || def.name || f,
        file: f,
        category: EXAMPLE_CATEGORIES[stem] || 'Other',
        isExample: true,
      };
    } catch {
      return null;
    }
  }).filter(Boolean);
}

/**
 * Load a workflow definition from a file path, built-in template name,
 * or example workflow name.
 *
 * @param {string} nameOrPath - File path or template name (e.g., "multi-collection-search")
 * @returns {object} Parsed workflow definition
 */
function loadWorkflow(nameOrPath) {
  // Try as a direct file path
  if (fs.existsSync(nameOrPath)) {
    const content = fs.readFileSync(nameOrPath, 'utf8');
    return JSON.parse(content);
  }

  // Try as a built-in template name
  const builtinPath = path.join(getWorkflowsDir(), `${nameOrPath}.json`);
  if (fs.existsSync(builtinPath)) {
    const content = fs.readFileSync(builtinPath, 'utf8');
    return JSON.parse(content);
  }

  // Try as an example workflow name
  const examplePath = path.join(getExamplesDir(), `${nameOrPath}.json`);
  if (fs.existsSync(examplePath)) {
    const content = fs.readFileSync(examplePath, 'utf8');
    return JSON.parse(content);
  }

  // Try with .json extension appended
  const withJson = nameOrPath.endsWith('.json') ? nameOrPath : `${nameOrPath}.json`;
  if (fs.existsSync(withJson)) {
    const content = fs.readFileSync(withJson, 'utf8');
    return JSON.parse(content);
  }

  throw new Error(`Workflow not found: "${nameOrPath}"\nProvide a file path or built-in template name (see: vai workflow list)`);
}

module.exports = {
  // Validation
  validateWorkflow,
  detectCycles,

  // Dependency resolution
  buildDependencyGraph,
  buildExecutionPlan,

  // Condition evaluation
  evaluateCondition,

  // Control flow
  executeMerge,
  executeFilter,
  executeTransform,

  // Main execution
  executeStep,
  executeWorkflow,

  // Templates
  listBuiltinWorkflows,
  listExampleWorkflows,
  loadWorkflow,
  getWorkflowsDir,
  getExamplesDir,

  // Input helpers
  buildInputSteps,

  // Constants
  VAI_TOOLS,
  CONTROL_FLOW_TOOLS,
  ALL_TOOLS,
};
