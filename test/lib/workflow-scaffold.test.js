'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const {
  scaffoldPackage,
  generateReadme,
  extractTools,
  guessCategory,
  toPackageName,
  CATEGORIES,
} = require('../../src/lib/workflow-scaffold');

const VALID_DEFINITION = {
  name: 'test-workflow',
  description: 'A test workflow for scaffolding',
  version: '1.0.0',
  inputs: {
    query: { type: 'string', required: true, description: 'Search query' },
    limit: { type: 'number', default: 10, description: 'Max results' },
  },
  steps: [
    { id: 'search', tool: 'query', name: 'Search KB', inputs: { query: '{{ inputs.query }}', limit: '{{ inputs.limit }}' } },
    { id: 'rerank', tool: 'rerank', name: 'Rerank results', inputs: { query: '{{ inputs.query }}', documents: '{{ search.output.results }}' } },
  ],
  output: '{{ rerank.output }}',
};

// Clean up temp dirs after tests
const tempDirs = [];
afterEach(() => {
  for (const d of tempDirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
  }
  tempDirs.length = 0;
});

// ── toPackageName ──

describe('toPackageName', () => {
  it('adds vai-workflow- prefix', () => {
    assert.equal(toPackageName('my-workflow'), 'vai-workflow-my-workflow');
  });

  it('slugifies spaces and special chars', () => {
    assert.equal(toPackageName('My Cool Workflow!'), 'vai-workflow-my-cool-workflow');
  });

  it('does not double-prefix', () => {
    assert.equal(toPackageName('vai-workflow-already'), 'vai-workflow-already');
  });

  it('lowercases', () => {
    assert.equal(toPackageName('Legal-Research'), 'vai-workflow-legal-research');
  });
});

// ── extractTools ──

describe('extractTools', () => {
  it('extracts tool names from steps', () => {
    const tools = extractTools(VALID_DEFINITION);
    assert.ok(tools.includes('query'));
    assert.ok(tools.includes('rerank'));
  });

  it('extracts tools from loop inline steps', () => {
    const def = {
      steps: [
        { id: 'loop1', tool: 'loop', inputs: { items: '{{ x }}', as: 'item', step: { tool: 'template', inputs: {} } } },
      ],
    };
    const tools = extractTools(def);
    assert.ok(tools.includes('loop'));
    assert.ok(tools.includes('template'));
  });

  it('returns empty for no steps', () => {
    assert.deepEqual(extractTools({}), []);
  });
});

// ── guessCategory ──

describe('guessCategory', () => {
  it('guesses retrieval for query+generate', () => {
    assert.equal(guessCategory(['query', 'generate']), 'retrieval');
  });

  it('guesses ingestion for ingest', () => {
    assert.equal(guessCategory(['ingest']), 'ingestion');
  });

  it('guesses analysis for similarity', () => {
    assert.equal(guessCategory(['similarity']), 'analysis');
  });

  it('guesses integration for http', () => {
    assert.equal(guessCategory(['http']), 'integration');
  });

  it('defaults to utility', () => {
    assert.equal(guessCategory(['template']), 'utility');
  });
});

// ── generateReadme ──

describe('generateReadme', () => {
  it('generates readme with inputs table', () => {
    const pkg = { name: 'vai-workflow-test', description: 'Test', vai: { tools: ['query'] }, license: 'MIT' };
    const readme = generateReadme(pkg, VALID_DEFINITION);
    assert.ok(readme.includes('# vai-workflow-test'));
    assert.ok(readme.includes('| query |'));
    assert.ok(readme.includes('| limit |'));
    assert.ok(readme.includes('vai workflow run'));
  });

  it('includes LLM prerequisite when generate is used', () => {
    const pkg = { name: 'test', vai: { tools: ['generate'] } };
    const readme = generateReadme(pkg, { inputs: {}, steps: [] });
    assert.ok(readme.includes('LLM provider'));
  });
});

// ── scaffoldPackage ──

describe('scaffoldPackage', () => {
  it('creates a complete package directory', () => {
    const dir = path.join(os.tmpdir(), `vai-scaffold-test-${Date.now()}`);
    tempDirs.push(dir);

    const result = scaffoldPackage({
      definition: VALID_DEFINITION,
      name: 'test-scaffold',
      author: 'Test Author',
      description: 'Scaffolded test',
      outputDir: dir,
    });

    assert.equal(result.dir, dir);
    assert.ok(result.files.includes('package.json'));
    assert.ok(result.files.includes('workflow.json'));
    assert.ok(result.files.includes('README.md'));
    assert.ok(result.files.includes('LICENSE'));

    // Verify package.json
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    assert.equal(pkg.name, 'vai-workflow-test-scaffold');
    assert.equal(pkg.author, 'Test Author');
    assert.ok(pkg.vai);
    assert.equal(pkg.vai.workflowVersion, '1.0');
    assert.ok(pkg.vai.tools.includes('query'));
    assert.ok(pkg.vai.tools.includes('rerank'));
    assert.equal(pkg.main, 'workflow.json');

    // Verify workflow.json matches input
    const wf = JSON.parse(fs.readFileSync(path.join(dir, 'workflow.json'), 'utf8'));
    assert.equal(wf.name, 'test-workflow');
    assert.equal(wf.steps.length, 2);

    // Verify README exists and has content
    const readme = fs.readFileSync(path.join(dir, 'README.md'), 'utf8');
    assert.ok(readme.includes('vai-workflow-test-scaffold'));
  });

  it('throws on invalid workflow definition', () => {
    const dir = path.join(os.tmpdir(), `vai-scaffold-invalid-${Date.now()}`);
    tempDirs.push(dir);

    assert.throws(
      () => scaffoldPackage({
        definition: { name: 'bad', steps: [] },
        name: 'invalid',
        outputDir: dir,
      }),
      /validation failed/i
    );
  });

  it('auto-detects category from tools', () => {
    const dir = path.join(os.tmpdir(), `vai-scaffold-cat-${Date.now()}`);
    tempDirs.push(dir);

    scaffoldPackage({
      definition: VALID_DEFINITION,
      name: 'cat-test',
      outputDir: dir,
    });

    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    assert.equal(pkg.vai.category, 'retrieval'); // query + rerank → retrieval
  });

  it('populates vai.inputs from workflow definition', () => {
    const dir = path.join(os.tmpdir(), `vai-scaffold-inputs-${Date.now()}`);
    tempDirs.push(dir);

    scaffoldPackage({
      definition: VALID_DEFINITION,
      name: 'inputs-test',
      outputDir: dir,
    });

    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    assert.ok(pkg.vai.inputs.query);
    assert.equal(pkg.vai.inputs.query.required, true);
    assert.equal(pkg.vai.inputs.limit.default, 10);
  });
});

// ── CATEGORIES ──

describe('CATEGORIES', () => {
  it('has the expected categories', () => {
    assert.ok(CATEGORIES.includes('retrieval'));
    assert.ok(CATEGORIES.includes('domain-specific'));
    assert.ok(CATEGORIES.includes('integration'));
    assert.equal(CATEGORIES.length, 6);
  });
});
