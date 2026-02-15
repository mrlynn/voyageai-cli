'use strict';

const path = require('path');
const fs = require('fs');
const { WORKFLOW_PREFIX, VAICLI_WORKFLOW_PREFIX } = require('./npm-utils');
const { validateWorkflow, ALL_TOOLS } = require('./workflow');

const CATEGORIES = ['retrieval', 'analysis', 'ingestion', 'domain-specific', 'utility', 'integration'];

/**
 * Predefined Lucide icon names available for workflow branding.
 * These map to SVG paths served by the playground/store.
 */
const BRANDING_ICONS = [
  'trophy', 'search', 'dollar-sign', 'split', 'file-search', 'database',
  'activity', 'globe', 'shield-alert', 'timer', 'refresh-cw', 'flask-conical',
  'target', 'code', 'clipboard-list', 'layers', 'bar-chart-3', 'heart-pulse',
  'brain', 'check-circle', 'zap', 'package', 'microscope', 'sparkle',
  'scale', 'file-text', 'filter',
];

/**
 * Default branding colors per category.
 */
const CATEGORY_COLORS = {
  retrieval: '#00D4AA',
  analysis: '#8B5CF6',
  ingestion: '#059669',
  'domain-specific': '#1E40AF',
  utility: '#0D9488',
  integration: '#0EA5E9',
};

/**
 * Suggest a branding icon based on category and tools.
 * @param {string} category
 * @param {string[]} tools
 * @returns {string}
 */
function suggestBrandingIcon(category, tools) {
  const t = new Set(tools);
  if (t.has('estimate') && t.has('similarity')) return 'trophy';
  if (t.has('ingest')) return 'database';
  if (t.has('generate') && t.has('query')) return 'sparkle';
  if (t.has('rerank') && t.has('search')) return 'target';
  if (t.has('search')) return 'search';
  if (t.has('similarity')) return 'scale';
  if (t.has('generate')) return 'brain';
  if (t.has('http')) return 'globe';
  const catMap = {
    retrieval: 'search', analysis: 'bar-chart-3', ingestion: 'database',
    'domain-specific': 'target', utility: 'zap', integration: 'package',
  };
  return catMap[category] || 'zap';
}

/**
 * Guess a category based on the tools a workflow uses.
 * @param {string[]} tools
 * @returns {string}
 */
function guessCategory(tools) {
  const t = new Set(tools);
  if (t.has('ingest') || t.has('chunk')) return 'ingestion';
  if (t.has('generate') && (t.has('query') || t.has('search'))) return 'retrieval';
  if (t.has('similarity') || t.has('aggregate')) return 'analysis';
  if (t.has('http')) return 'integration';
  if (t.has('query') || t.has('search') || t.has('rerank')) return 'retrieval';
  return 'utility';
}

/**
 * Extract tool names from a workflow definition's steps.
 * @param {object} definition
 * @returns {string[]}
 */
function extractTools(definition) {
  const tools = new Set();
  if (!definition.steps) return [];
  for (const step of definition.steps) {
    if (step.tool && ALL_TOOLS.has(step.tool)) {
      tools.add(step.tool);
    }
    // Check loop inline steps
    if (step.tool === 'loop' && step.inputs?.step?.tool) {
      tools.add(step.inputs.step.tool);
    }
  }
  return [...tools];
}

/**
 * Generate a package name from a workflow name.
 * @param {string} name
 * @param {{ scope?: string }} [options]
 * @returns {string}
 */
function toPackageName(name, options = {}) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const base = slug.startsWith(WORKFLOW_PREFIX.slice(0, -1))
    ? slug
    : WORKFLOW_PREFIX + slug;
  if (options.scope === 'vaicli') {
    return `@vaicli/${base}`;
  }
  return base;
}

/**
 * Generate a README.md from workflow definition and package metadata.
 * @param {object} pkg - package.json content
 * @param {object} definition - workflow definition
 * @returns {string}
 */
function generateReadme(pkg, definition) {
  const lines = [];
  lines.push(`# ${pkg.name}`);
  lines.push('');
  lines.push(pkg.description || definition.description || 'A vai community workflow.');
  lines.push('');

  // Prerequisites
  lines.push('## Prerequisites');
  lines.push('');
  lines.push('- [voyageai-cli](https://github.com/mrlynn/voyageai-cli) installed');
  const tools = pkg.vai?.tools || [];
  if (tools.includes('query') || tools.includes('search') || tools.includes('ingest')) {
    lines.push('- A MongoDB collection with embedded documents');
  }
  if (tools.includes('generate')) {
    lines.push('- An LLM provider configured (`vai config set llm-provider ...`)');
  }
  if (tools.includes('http')) {
    lines.push('- Network access for external HTTP requests');
  }
  lines.push('');

  // Inputs
  const inputs = definition.inputs;
  if (inputs && Object.keys(inputs).length > 0) {
    lines.push('## Inputs');
    lines.push('');
    lines.push('| Input | Type | Required | Default | Description |');
    lines.push('|-------|------|----------|---------|-------------|');
    for (const [key, schema] of Object.entries(inputs)) {
      const type = schema.type || 'string';
      const req = schema.required ? 'Yes' : 'No';
      const def = schema.default !== undefined ? String(schema.default) : '—';
      const desc = schema.description || '';
      lines.push(`| ${key} | ${type} | ${req} | ${def} | ${desc} |`);
    }
    lines.push('');
  }

  // Usage
  lines.push('## Usage');
  lines.push('');
  lines.push('```bash');
  const inputFlags = inputs
    ? Object.entries(inputs)
        .filter(([, s]) => s.required)
        .map(([k]) => `--input ${k}="..."`)
        .join(' \\\n  ')
    : '';
  lines.push(`vai workflow run ${pkg.name}${inputFlags ? ' \\\n  ' + inputFlags : ''}`);
  lines.push('```');
  lines.push('');

  // Steps
  if (definition.steps?.length) {
    lines.push('## Steps');
    lines.push('');
    for (let i = 0; i < definition.steps.length; i++) {
      const step = definition.steps[i];
      lines.push(`${i + 1}. **${step.name || step.id}** — \`${step.tool}\``);
    }
    lines.push('');
  }

  lines.push('## License');
  lines.push('');
  lines.push(pkg.license || 'MIT');
  lines.push('');

  return lines.join('\n');
}

/**
 * Scaffold a publish-ready npm package from a workflow definition.
 *
 * @param {object} options
 * @param {object} options.definition - Workflow definition (parsed JSON)
 * @param {string} options.name - Package name (without vai-workflow- prefix)
 * @param {string} [options.author] - Author name
 * @param {string} [options.description] - Package description
 * @param {string} [options.category] - Workflow category
 * @param {string[]} [options.tags] - Tags
 * @param {string} [options.scope] - Scope ('vaicli' for official @vaicli packages)
 * @param {string} [options.outputDir] - Output directory (default: ./vai-workflow-<name>/)
 * @returns {{ dir: string, files: string[] }}
 */
function scaffoldPackage(options) {
  const { definition, name, author, description, category, tags, scope } = options;

  const packageName = toPackageName(name, { scope });
  // For scoped packages, use the unscoped part as the directory name
  const dirName = packageName.startsWith('@') ? packageName.split('/')[1] : packageName;
  const outputDir = options.outputDir || path.resolve(process.cwd(), dirName);

  // Validate the workflow
  const errors = validateWorkflow(definition);
  if (errors.length > 0) {
    throw new Error(`Workflow validation failed:\n  ${errors.join('\n  ')}`);
  }

  // Extract metadata
  const tools = extractTools(definition);
  const guessedCategory = category || guessCategory(tools);

  // Build package.json
  const pkg = {
    name: packageName,
    version: '1.0.0',
    description: description || definition.description || '',
    main: 'workflow.json',
    keywords: ['vai-workflow', 'voyageai-cli', ...tools, ...(tags || [])],
    vai: {
      workflowVersion: '1.0',
      category: guessedCategory,
      tags: tags || [],
      tools,
      branding: {
        icon: suggestBrandingIcon(guessedCategory, tools),
        color: CATEGORY_COLORS[guessedCategory] || '#0D9488',
      },
      inputs: {},
    },
    files: ['workflow.json', 'README.md'],
    license: 'MIT',
  };

  // Add publishConfig for scoped packages
  if (scope === 'vaicli') {
    pkg.publishConfig = { access: 'public' };
    pkg.repository = {
      type: 'git',
      url: 'https://github.com/vaicli/workflows.git',
      directory: `packages/${dirName}`,
    };
  }

  if (author) {
    pkg.author = author;
  }

  // Copy input descriptions to vai.inputs
  if (definition.inputs) {
    for (const [key, schema] of Object.entries(definition.inputs)) {
      pkg.vai.inputs[key] = {
        type: schema.type || 'string',
        required: !!schema.required,
        ...(schema.default !== undefined && { default: schema.default }),
        description: schema.description || '',
      };
    }
  }

  // Generate files
  const readme = generateReadme(pkg, definition);
  const license = `MIT License\n\nCopyright (c) ${new Date().getFullYear()} ${author || 'Contributors'}\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the "Software"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n`;

  // Write
  fs.mkdirSync(outputDir, { recursive: true });
  const files = [];

  fs.writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
  files.push('package.json');

  fs.writeFileSync(path.join(outputDir, 'workflow.json'), JSON.stringify(definition, null, 2) + '\n');
  files.push('workflow.json');

  fs.writeFileSync(path.join(outputDir, 'README.md'), readme);
  files.push('README.md');

  fs.writeFileSync(path.join(outputDir, 'LICENSE'), license);
  files.push('LICENSE');

  // Create tests/ directory with a sample test case
  const testsDir = path.join(outputDir, 'tests');
  fs.mkdirSync(testsDir, { recursive: true });

  // Build sample mocks based on the tools used
  const sampleMocks = {};
  for (const tool of tools) {
    if (tool === 'query' || tool === 'search') {
      sampleMocks[tool] = { results: [{ text: 'Sample result', score: 0.95 }], resultCount: 1 };
    } else if (tool === 'embed') {
      sampleMocks[tool] = { embedding: [0.1, 0.2, 0.3], model: 'voyage-3-large', dimensions: 3 };
    } else if (tool === 'rerank') {
      sampleMocks[tool] = { results: [{ text: 'Reranked result', score: 0.98 }], resultCount: 1 };
    } else if (tool === 'generate') {
      sampleMocks[tool] = { text: 'Generated text response', model: 'mock-llm', provider: 'mock' };
    }
  }

  // Build sample inputs from definition
  const sampleInputs = {};
  if (definition.inputs) {
    for (const [key, schema] of Object.entries(definition.inputs)) {
      if (schema.default !== undefined) {
        sampleInputs[key] = schema.default;
      } else if (schema.type === 'number') {
        sampleInputs[key] = 10;
      } else if (schema.type === 'boolean') {
        sampleInputs[key] = true;
      } else {
        sampleInputs[key] = 'test value';
      }
    }
  }

  // Build expected steps
  const expectedSteps = {};
  if (definition.steps) {
    for (const step of definition.steps) {
      expectedSteps[step.id] = { status: 'completed' };
    }
  }

  const sampleTestCase = {
    name: 'basic workflow test',
    inputs: sampleInputs,
    mocks: sampleMocks,
    expect: {
      steps: expectedSteps,
      noErrors: true,
    },
  };

  fs.writeFileSync(path.join(testsDir, 'basic.test.json'), JSON.stringify(sampleTestCase, null, 2) + '\n');
  files.push('tests/basic.test.json');

  // Create fixtures directory with .gitkeep
  const fixturesDir = path.join(testsDir, 'fixtures');
  fs.mkdirSync(fixturesDir, { recursive: true });
  fs.writeFileSync(path.join(fixturesDir, '.gitkeep'), '');
  files.push('tests/fixtures/.gitkeep');

  return { dir: outputDir, files };
}

/**
 * Create an empty workflow template for interactive mode.
 * @returns {object}
 */
function emptyWorkflowTemplate() {
  return {
    name: '',
    description: '',
    version: '1.0.0',
    inputs: {},
    steps: [],
    output: {},
  };
}

module.exports = {
  scaffoldPackage,
  generateReadme,
  extractTools,
  guessCategory,
  suggestBrandingIcon,
  toPackageName,
  emptyWorkflowTemplate,
  CATEGORIES,
  BRANDING_ICONS,
};
