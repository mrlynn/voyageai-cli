'use strict';

const pc = require('picocolors');
const { ALL_TOOLS } = require('./workflow');
const { CATEGORIES } = require('./workflow-scaffold');

// Reserved words that cannot be used as step IDs
const RESERVED_STEP_IDS = new Set([
  'index', 'inputs', 'defaults', 'item', 'true', 'false', 'null', 'undefined',
  'output', 'input', 'step', 'steps',
]);

/**
 * Validate a step ID.
 * @param {string} id
 * @param {Set<string>} existingIds
 * @returns {string|undefined} error message or undefined if valid
 */
function validateStepId(id, existingIds) {
  if (!id) return 'Step ID is required';
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(id)) return 'Step ID must start with a letter or underscore and contain only alphanumeric characters and underscores';
  if (RESERVED_STEP_IDS.has(id)) return `"${id}" is a reserved keyword and cannot be used as a step ID`;
  if (existingIds.has(id)) return `Step ID "${id}" is already used`;
  return undefined;
}

/**
 * Build tool options for selection, sorted alphabetically.
 * @returns {Array<{value: string, label: string, hint?: string}>}
 */
function buildToolOptions() {
  const toolHints = {
    query: 'Vector search with Voyage AI embeddings',
    search: 'Full-text or hybrid search',
    rerank: 'Rerank documents by relevance',
    embed: 'Generate embeddings for text',
    similarity: 'Compute similarity between texts',
    ingest: 'Ingest documents into a collection',
    collections: 'List or manage collections',
    models: 'List available models',
    explain: 'Explain an embedding or result',
    estimate: 'Estimate embedding cost',
    code_index: 'Index a codebase',
    code_search: 'Search indexed code',
    code_query: 'Query code with natural language',
    code_find_similar: 'Find similar code snippets',
    code_status: 'Check code index status',
    merge: 'Merge multiple arrays',
    filter: 'Filter results by condition',
    transform: 'Transform data with expressions',
    generate: 'Generate text with an LLM',
    conditional: 'Branch based on a condition',
    loop: 'Loop over items',
    template: 'Render a template string',
    chunk: 'Split text into chunks',
    aggregate: 'Aggregate values',
    http: 'Make an HTTP request',
  };

  return [...ALL_TOOLS].sort().map(tool => ({
    value: tool,
    label: tool,
    hint: toolHints[tool] || '',
  }));
}

/**
 * Suggest input template references based on existing steps and workflow inputs.
 * @param {object} definition - Partial workflow definition
 * @param {number} stepIndex - Current step index
 * @returns {string[]}
 */
function suggestReferences(definition, stepIndex) {
  const refs = [];
  // Workflow-level inputs
  for (const key of Object.keys(definition.inputs || {})) {
    refs.push(`{{ inputs.${key} }}`);
  }
  // Previous steps
  for (let i = 0; i < stepIndex; i++) {
    const step = definition.steps[i];
    refs.push(`{{ ${step.id}.output }}`);
    if (step.tool === 'query' || step.tool === 'search' || step.tool === 'rerank') {
      refs.push(`{{ ${step.id}.output.results }}`);
    }
    if (step.tool === 'generate') {
      refs.push(`{{ ${step.id}.output.response }}`);
    }
    if (step.tool === 'estimate') {
      refs.push(`{{ ${step.id}.output }}`);
    }
    if (step.tool === 'embed') {
      refs.push(`{{ ${step.id}.output.embedding }}`);
    }
    if (step.tool === 'merge') {
      refs.push(`{{ ${step.id}.output.results }}`);
    }
  }
  return refs;
}

/**
 * Run the full interactive workflow builder using @clack/prompts.
 * @returns {Promise<{definition: object, name: string, description: string, category: string, author: string}>}
 */
async function runInteractiveBuilder() {
  const p = require('@clack/prompts');

  p.intro(pc.bold(pc.cyan('Interactive Workflow Builder')));

  // Step 1: Basic info
  const basicInfo = await p.group({
    name: () => p.text({
      message: 'Workflow name',
      placeholder: 'my-workflow',
      validate: v => {
        if (!v) return 'Required';
        if (!/^[a-z][a-z0-9-]*$/.test(v)) return 'Use lowercase letters, numbers, and hyphens only (start with a letter)';
        return undefined;
      },
    }),
    description: () => p.text({
      message: 'Description',
      placeholder: 'What does this workflow do?',
      validate: v => v ? undefined : 'Required',
    }),
    category: () => p.select({
      message: 'Category',
      options: CATEGORIES.map(c => ({ value: c, label: c })),
    }),
    author: () => p.text({
      message: 'Author',
      placeholder: 'Your Name',
      defaultValue: getGitAuthor(),
    }),
  });

  if (p.isCancel(basicInfo)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }

  const definition = {
    name: basicInfo.name,
    description: basicInfo.description,
    version: '1.0.0',
    inputs: {},
    defaults: {},
    steps: [],
    output: {},
  };

  // Step 2: Workflow inputs
  p.log.info(pc.bold('Define workflow-level inputs'));
  p.log.message(pc.dim('These are the parameters users provide when running the workflow.'));

  let addingInputs = true;
  while (addingInputs) {
    const addInput = await p.confirm({
      message: Object.keys(definition.inputs).length === 0
        ? 'Add a workflow input?'
        : 'Add another workflow input?',
      initialValue: Object.keys(definition.inputs).length === 0,
    });

    if (p.isCancel(addInput)) {
      p.cancel('Cancelled.');
      process.exit(0);
    }

    if (!addInput) {
      addingInputs = false;
      break;
    }

    const inputInfo = await p.group({
      name: () => p.text({
        message: 'Input name',
        placeholder: 'query',
        validate: v => {
          if (!v) return 'Required';
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(v)) return 'Must be a valid identifier';
          if (definition.inputs[v]) return `Input "${v}" already exists`;
          return undefined;
        },
      }),
      type: () => p.select({
        message: 'Type',
        options: [
          { value: 'string', label: 'string' },
          { value: 'number', label: 'number' },
          { value: 'boolean', label: 'boolean' },
          { value: 'array', label: 'array' },
        ],
      }),
      required: () => p.confirm({ message: 'Required?', initialValue: true }),
      description: () => p.text({ message: 'Description', placeholder: 'What is this input for?' }),
    });

    if (p.isCancel(inputInfo)) {
      p.cancel('Cancelled.');
      process.exit(0);
    }

    const inputDef = {
      type: inputInfo.type,
      required: inputInfo.required,
    };
    if (inputInfo.description) inputDef.description = inputInfo.description;

    if (!inputInfo.required) {
      const hasDefault = await p.confirm({ message: 'Set a default value?', initialValue: false });
      if (p.isCancel(hasDefault)) { p.cancel('Cancelled.'); process.exit(0); }
      if (hasDefault) {
        const defaultVal = await p.text({ message: 'Default value' });
        if (p.isCancel(defaultVal)) { p.cancel('Cancelled.'); process.exit(0); }
        if (inputInfo.type === 'number') {
          inputDef.default = Number(defaultVal);
        } else if (inputInfo.type === 'boolean') {
          inputDef.default = defaultVal === 'true';
        } else {
          inputDef.default = defaultVal;
        }
      }
    }

    definition.inputs[inputInfo.name] = inputDef;
    p.log.success(`Added input: ${pc.cyan(inputInfo.name)} (${inputInfo.type}${inputInfo.required ? ', required' : ''})`);
  }

  // Step 3: Workflow steps
  p.log.info(pc.bold('Define workflow steps'));
  const refs = suggestReferences(definition, 0);
  if (refs.length > 0) {
    p.log.message(pc.dim(`Available references: ${refs.join(', ')}`));
  }

  const existingStepIds = new Set();
  let addingSteps = true;
  while (addingSteps) {
    const stepNum = definition.steps.length + 1;
    p.log.step(`Step ${stepNum}`);

    // Show available references
    const currentRefs = suggestReferences(definition, definition.steps.length);
    if (currentRefs.length > 0) {
      p.log.message(pc.dim(`Available references:\n  ${currentRefs.join('\n  ')}`));
    }

    const stepId = await p.text({
      message: 'Step ID',
      placeholder: `step_${stepNum}`,
      validate: v => validateStepId(v, existingStepIds),
    });
    if (p.isCancel(stepId)) { p.cancel('Cancelled.'); process.exit(0); }

    const tool = await p.select({
      message: 'Tool',
      options: buildToolOptions(),
    });
    if (p.isCancel(tool)) { p.cancel('Cancelled.'); process.exit(0); }

    const stepName = await p.text({
      message: 'Step name (human readable)',
      placeholder: `${tool} step`,
      validate: v => v ? undefined : 'Required',
    });
    if (p.isCancel(stepName)) { p.cancel('Cancelled.'); process.exit(0); }

    // Collect step inputs as key-value pairs
    const stepInputs = {};
    p.log.message(pc.dim('Add inputs for this step. Use template syntax like {{ inputs.query }} or {{ previousStep.output.results }}'));

    let addingInputPairs = true;
    while (addingInputPairs) {
      const addPair = await p.confirm({
        message: Object.keys(stepInputs).length === 0
          ? 'Add a step input?'
          : 'Add another step input?',
        initialValue: Object.keys(stepInputs).length === 0,
      });
      if (p.isCancel(addPair)) { p.cancel('Cancelled.'); process.exit(0); }

      if (!addPair) {
        addingInputPairs = false;
        break;
      }

      // Suggest common input keys per tool
      const suggestedKeys = getSuggestedInputKeys(tool);

      const inputKey = await p.text({
        message: 'Input key',
        placeholder: suggestedKeys[0] || 'key',
        validate: v => v ? undefined : 'Required',
      });
      if (p.isCancel(inputKey)) { p.cancel('Cancelled.'); process.exit(0); }

      const inputValue = await p.text({
        message: `Value for "${inputKey}"`,
        placeholder: currentRefs.length > 0 ? currentRefs[0] : 'value or {{ template }}',
        validate: v => (v !== undefined && v !== '') ? undefined : 'Required',
      });
      if (p.isCancel(inputValue)) { p.cancel('Cancelled.'); process.exit(0); }

      // Try to parse numbers and booleans for non-template values
      if (!/\{\{/.test(inputValue)) {
        if (inputValue === 'true') stepInputs[inputKey] = true;
        else if (inputValue === 'false') stepInputs[inputKey] = false;
        else if (!isNaN(inputValue) && inputValue.trim() !== '') stepInputs[inputKey] = Number(inputValue);
        else stepInputs[inputKey] = inputValue;
      } else {
        stepInputs[inputKey] = inputValue;
      }
    }

    const step = {
      id: stepId,
      tool: tool,
      name: stepName,
      inputs: stepInputs,
    };

    definition.steps.push(step);
    existingStepIds.add(stepId);

    p.log.success(`Added step: ${pc.cyan(stepId)} (${tool})`);

    const addMore = await p.confirm({
      message: 'Add another step?',
      initialValue: false,
    });
    if (p.isCancel(addMore)) { p.cancel('Cancelled.'); process.exit(0); }
    if (!addMore) addingSteps = false;
  }

  if (definition.steps.length === 0) {
    p.log.error('Workflow must have at least one step.');
    process.exit(1);
  }

  // Step 4: Output mapping
  p.log.info(pc.bold('Define workflow output'));
  p.log.message(pc.dim('Map output keys to step results.'));

  const allRefs = suggestReferences(definition, definition.steps.length);
  if (allRefs.length > 0) {
    p.log.message(pc.dim(`Available references:\n  ${allRefs.join('\n  ')}`));
  }

  let addingOutputs = true;
  while (addingOutputs) {
    const addOutput = await p.confirm({
      message: Object.keys(definition.output).length === 0
        ? 'Add an output mapping?'
        : 'Add another output mapping?',
      initialValue: true,
    });
    if (p.isCancel(addOutput)) { p.cancel('Cancelled.'); process.exit(0); }
    if (!addOutput) { addingOutputs = false; break; }

    const outputKey = await p.text({
      message: 'Output key',
      placeholder: 'result',
      validate: v => v ? undefined : 'Required',
    });
    if (p.isCancel(outputKey)) { p.cancel('Cancelled.'); process.exit(0); }

    const outputValue = await p.text({
      message: `Value for "${outputKey}"`,
      placeholder: allRefs.length > 0 ? allRefs[allRefs.length - 1] : '{{ stepId.output }}',
      validate: v => v ? undefined : 'Required',
    });
    if (p.isCancel(outputValue)) { p.cancel('Cancelled.'); process.exit(0); }

    definition.output[outputKey] = outputValue;
  }

  // Step 5: Validate
  const { validateWorkflow, buildExecutionPlan } = require('./workflow');
  const errors = validateWorkflow(definition);

  if (errors.length > 0) {
    p.log.error(pc.bold('Validation errors:'));
    for (const err of errors) {
      p.log.error(`  ${pc.red('x')} ${err}`);
    }
    const fixOrWrite = await p.confirm({
      message: 'Write anyway (you can fix later)?',
      initialValue: false,
    });
    if (p.isCancel(fixOrWrite) || !fixOrWrite) {
      p.cancel('Workflow not saved. Fix the errors and try again.');
      process.exit(1);
    }
  } else {
    p.log.success('Workflow validates successfully!');
  }

  // Step 6: Show execution plan
  try {
    const layers = buildExecutionPlan(definition.steps);
    p.log.info(pc.bold('Execution plan:'));
    for (let i = 0; i < layers.length; i++) {
      const layerSteps = layers[i].map(id => {
        const step = definition.steps.find(s => s.id === id);
        return `${pc.cyan(id)} (${step ? step.tool : '?'})`;
      });
      p.log.message(`  Layer ${i + 1}: ${layerSteps.join(', ')}`);
    }
    if (layers.length > 1) {
      p.log.message(pc.dim(`  Steps in the same layer run in parallel.`));
    }
  } catch (err) {
    p.log.warn(`Could not build execution plan: ${err.message}`);
  }

  return {
    definition,
    name: basicInfo.name,
    description: basicInfo.description,
    category: basicInfo.category,
    author: basicInfo.author,
  };
}

/**
 * Generate a workflow skeleton from a text description.
 * Uses pattern matching against known tool capabilities.
 * @param {string} description
 * @returns {object} workflow definition
 */
function workflowFromDescription(description) {
  const desc = description.toLowerCase();
  const definition = {
    name: '',
    description: description,
    version: '1.0.0',
    inputs: {},
    defaults: {},
    steps: [],
    output: {},
  };

  // Extract a name from the description
  const nameMatch = description.match(/^(\w[\w\s-]{2,30})/);
  if (nameMatch) {
    definition.name = nameMatch[1].trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  } else {
    definition.name = 'generated-workflow';
  }

  // Pattern matching for common workflow types
  const hasSearch = /search|find|look up|retrieve|query/i.test(desc);
  const hasCompare = /compare|versus|vs|shootout|side.by.side/i.test(desc);
  const hasGenerate = /generate|summarize|synthesize|answer|write|create text|explain/i.test(desc);
  const hasRerank = /rerank|re-rank|rank|sort by relevance/i.test(desc);
  const hasMerge = /merge|combine|aggregate results/i.test(desc);
  const hasIngest = /ingest|import|load|index documents/i.test(desc);
  const hasEmbed = /embed|embedding|vectorize/i.test(desc);
  const hasSimilarity = /similar|similarity|compare embeddings/i.test(desc);
  const hasDecompose = /decompos|break down|sub.quer/i.test(desc);
  const hasHttp = /http|api|fetch|request|webhook/i.test(desc);
  const hasLoop = /loop|iterate|each|batch/i.test(desc);
  const hasFilter = /filter|exclude|only keep/i.test(desc);
  const hasChunk = /chunk|split|segment/i.test(desc);
  const hasCost = /cost|estimat|price/i.test(desc);

  // Common inputs
  if (hasSearch || hasRerank || hasGenerate || hasDecompose) {
    definition.inputs.query = { type: 'string', required: true, description: 'The search query or question' };
  }
  if (hasSearch || hasIngest) {
    definition.inputs.collection = { type: 'string', required: true, description: 'MongoDB collection name' };
  }
  if (hasSearch) {
    definition.inputs.limit = { type: 'number', default: 10, description: 'Maximum results to return' };
  }
  if (hasHttp) {
    definition.inputs.url = { type: 'string', required: true, description: 'URL to fetch' };
  }
  if (hasEmbed || hasChunk) {
    definition.inputs.text = { type: 'string', required: true, description: 'Text to process' };
  }

  let stepIndex = 0;

  // Build steps based on detected patterns
  if (hasDecompose) {
    definition.steps.push({
      id: 'decompose',
      tool: 'generate',
      name: 'Decompose into sub-queries',
      inputs: {
        prompt: 'Break the following question into 3 focused sub-questions. Return ONLY a JSON array of strings.\n\nQuestion: {{ inputs.query }}',
        format: 'json',
      },
    });
    stepIndex++;
  }

  if (hasChunk) {
    definition.steps.push({
      id: 'chunk_text',
      tool: 'chunk',
      name: 'Split text into chunks',
      inputs: { text: '{{ inputs.text }}', chunkSize: 512 },
    });
    stepIndex++;
  }

  if (hasEmbed && !hasSearch) {
    definition.steps.push({
      id: 'embed_text',
      tool: 'embed',
      name: 'Generate embeddings',
      inputs: { text: '{{ inputs.text }}', model: 'voyage-4-large' },
    });
    stepIndex++;
  }

  if (hasIngest) {
    definition.steps.push({
      id: 'ingest_data',
      tool: 'ingest',
      name: 'Ingest documents',
      inputs: { collection: '{{ inputs.collection }}' },
    });
    stepIndex++;
  }

  if (hasHttp) {
    definition.steps.push({
      id: 'fetch_data',
      tool: 'http',
      name: 'Fetch external data',
      inputs: { url: '{{ inputs.url }}', method: 'GET' },
    });
    stepIndex++;
  }

  if (hasSearch && hasCompare) {
    // Comparison pattern: search with multiple models
    for (const model of ['voyage-4-large', 'voyage-4', 'voyage-4-lite']) {
      const suffix = model.replace('voyage-4', '').replace('-', '') || 'base';
      const id = `search_${suffix === '' ? 'base' : suffix}`;
      definition.steps.push({
        id,
        tool: 'query',
        name: `Search with ${model}`,
        inputs: {
          query: '{{ inputs.query }}',
          collection: '{{ inputs.collection }}',
          model,
          limit: '{{ inputs.limit }}',
        },
      });
    }
    stepIndex += 3;
  } else if (hasSearch) {
    const searchId = hasDecompose ? 'search_results' : 'search';
    const queryRef = hasDecompose ? '{{ decompose.output.response[0] }}' : '{{ inputs.query }}';
    definition.steps.push({
      id: searchId,
      tool: 'query',
      name: 'Search knowledge base',
      inputs: {
        query: queryRef,
        collection: '{{ inputs.collection }}',
        limit: '{{ inputs.limit }}',
      },
    });
    stepIndex++;
  }

  if (hasSimilarity) {
    definition.steps.push({
      id: 'check_similarity',
      tool: 'similarity',
      name: 'Compute similarity',
      inputs: { text1: '{{ inputs.query }}', text2: '{{ inputs.text }}' },
    });
    stepIndex++;
  }

  if (hasCost) {
    definition.steps.push({
      id: 'estimate_cost',
      tool: 'estimate',
      name: 'Estimate cost',
      inputs: { text: '{{ inputs.query }}', model: 'voyage-4-large' },
    });
    stepIndex++;
  }

  if (hasMerge && definition.steps.length >= 2) {
    const arrayRefs = definition.steps
      .filter(s => s.tool === 'query' || s.tool === 'search')
      .map(s => `{{ ${s.id}.output.results }}`);
    if (arrayRefs.length >= 2) {
      definition.steps.push({
        id: 'merged',
        tool: 'merge',
        name: 'Merge results',
        inputs: { arrays: arrayRefs, dedup: true },
      });
      stepIndex++;
    }
  }

  if (hasFilter) {
    const lastResultStep = [...definition.steps].reverse().find(s =>
      s.tool === 'query' || s.tool === 'search' || s.tool === 'merge'
    );
    if (lastResultStep) {
      definition.steps.push({
        id: 'filtered',
        tool: 'filter',
        name: 'Filter results',
        inputs: {
          items: `{{ ${lastResultStep.id}.output.results }}`,
          condition: 'item.score > 0.5',
        },
      });
      stepIndex++;
    }
  }

  if (hasRerank) {
    const lastResultStep = [...definition.steps].reverse().find(s =>
      s.tool === 'query' || s.tool === 'search' || s.tool === 'merge' || s.tool === 'filter'
    );
    if (lastResultStep) {
      definition.steps.push({
        id: 'reranked',
        tool: 'rerank',
        name: 'Rerank results',
        inputs: {
          query: '{{ inputs.query }}',
          documents: `{{ ${lastResultStep.id}.output.results }}`,
          model: 'rerank-2.5',
          limit: '{{ inputs.limit }}',
        },
      });
      stepIndex++;
    }
  }

  if (hasGenerate) {
    const contextStep = [...definition.steps].reverse().find(s =>
      s.tool === 'rerank' || s.tool === 'query' || s.tool === 'search' || s.tool === 'merge' || s.tool === 'filter'
    );
    definition.steps.push({
      id: 'generate_response',
      tool: 'generate',
      name: 'Generate response',
      inputs: {
        prompt: `Using the following context, provide a comprehensive answer.\n\nQuestion: {{ inputs.query }}`,
        ...(contextStep ? { context: `{{ ${contextStep.id}.output.results }}` } : {}),
      },
    });
    stepIndex++;
  }

  // Fallback: if no steps were generated, add a basic search step
  if (definition.steps.length === 0) {
    if (!definition.inputs.query) {
      definition.inputs.query = { type: 'string', required: true, description: 'Search query' };
    }
    if (!definition.inputs.collection) {
      definition.inputs.collection = { type: 'string', required: true, description: 'Collection name' };
    }
    definition.steps.push({
      id: 'search',
      tool: 'query',
      name: 'Search',
      inputs: {
        query: '{{ inputs.query }}',
        collection: '{{ inputs.collection }}',
        limit: 10,
      },
    });
  }

  // Build output mapping from last step(s)
  const lastStep = definition.steps[definition.steps.length - 1];
  if (lastStep.tool === 'generate') {
    definition.output.response = `{{ ${lastStep.id}.output.response }}`;
  } else {
    definition.output.results = `{{ ${lastStep.id}.output.results }}`;
  }
  // Also expose query if it exists
  if (definition.inputs.query) {
    definition.output.query = '{{ inputs.query }}';
  }

  return definition;
}

/**
 * Get suggested input keys for a tool.
 * @param {string} tool
 * @returns {string[]}
 */
function getSuggestedInputKeys(tool) {
  const suggestions = {
    query: ['query', 'collection', 'model', 'limit', 'filter'],
    search: ['query', 'collection', 'limit'],
    rerank: ['query', 'documents', 'model', 'limit'],
    embed: ['text', 'model'],
    similarity: ['text1', 'text2', 'model'],
    ingest: ['collection', 'documents', 'model'],
    estimate: ['text', 'model'],
    generate: ['prompt', 'context', 'format', 'model'],
    merge: ['arrays', 'dedup'],
    filter: ['items', 'condition'],
    transform: ['items', 'expression'],
    conditional: ['condition', 'ifTrue', 'ifFalse'],
    loop: ['items', 'step', 'as'],
    template: ['template', 'data'],
    chunk: ['text', 'chunkSize', 'overlap'],
    aggregate: ['items', 'operation'],
    http: ['url', 'method', 'headers', 'body'],
    collections: [],
    models: [],
    explain: ['text', 'model'],
    code_index: ['path'],
    code_search: ['query'],
    code_query: ['query'],
    code_find_similar: ['code'],
    code_status: [],
  };
  return suggestions[tool] || [];
}

function getGitAuthor() {
  try {
    const { execSync } = require('child_process');
    return execSync('git config user.name', { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

module.exports = {
  runInteractiveBuilder,
  workflowFromDescription,
  validateStepId,
  buildToolOptions,
  suggestReferences,
  getSuggestedInputKeys,
  RESERVED_STEP_IDS,
};
