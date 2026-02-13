'use strict';

const path = require('path');
const fs = require('fs');
const { WORKFLOW_PREFIX } = require('./npm-utils');
const { validateWorkflow, ALL_TOOLS } = require('./workflow');

const CATEGORIES = ['retrieval', 'analysis', 'ingestion', 'domain-specific', 'utility', 'integration'];

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
 * @returns {string}
 */
function toPackageName(name) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug.startsWith(WORKFLOW_PREFIX.slice(0, -1))
    ? slug
    : WORKFLOW_PREFIX + slug;
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
 * @param {string} [options.outputDir] - Output directory (default: ./vai-workflow-<name>/)
 * @returns {{ dir: string, files: string[] }}
 */
function scaffoldPackage(options) {
  const { definition, name, author, description, category, tags } = options;

  const packageName = toPackageName(name);
  const outputDir = options.outputDir || path.resolve(process.cwd(), packageName);

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
      inputs: {},
    },
    files: ['workflow.json', 'README.md'],
    license: 'MIT',
  };

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
  toPackageName,
  emptyWorkflowTemplate,
  CATEGORIES,
};
