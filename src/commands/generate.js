'use strict';

const fs = require('fs');
const path = require('path');
const { loadProject } = require('../lib/project');
const { renderTemplate, buildContext, listTemplates, listTargets } = require('../lib/codegen');
const ui = require('../lib/ui');

/**
 * Component to template mapping for each target.
 */
const COMPONENT_MAP = {
  vanilla: {
    client: 'client.js',
    connection: 'connection.js',
    retrieval: 'retrieval.js',
    ingest: 'ingest.js',
    'search-api': 'search-api.js',
  },
  nextjs: {
    client: 'lib-voyage.js',
    connection: 'lib-mongo.js',
    retrieval: 'route-search.js', // Route includes retrieval logic
    ingest: 'route-ingest.js',
    'search-api': 'route-search.js',
    'search-page': 'page-search.jsx',
    theme: 'theme.js',
    layout: 'layout.jsx',
  },
  python: {
    client: 'voyage_client.py',
    connection: 'mongo_client.py',
    retrieval: 'app.py', // App includes retrieval routes
    ingest: 'chunker.py',
    'search-api': 'app.py',
  },
};

/**
 * Suggested output filenames for each component.
 */
const OUTPUT_NAMES = {
  vanilla: {
    client: 'lib/voyage.js',
    connection: 'lib/mongodb.js',
    retrieval: 'lib/retrieval.js',
    ingest: 'lib/ingest.js',
    'search-api': 'lib/search-api.js',
  },
  nextjs: {
    client: 'lib/voyage.js',
    connection: 'lib/mongodb.js',
    retrieval: 'app/api/search/route.js',
    ingest: 'app/api/ingest/route.js',
    'search-api': 'app/api/search/route.js',
    'search-page': 'app/search/page.jsx',
    theme: 'lib/theme.js',
    layout: 'app/layout.jsx',
  },
  python: {
    client: 'voyage_client.py',
    connection: 'mongo_client.py',
    retrieval: 'app.py',
    ingest: 'chunker.py',
    'search-api': 'app.py',
  },
};

/**
 * Auto-detect target from project files.
 */
function detectTarget() {
  const cwd = process.cwd();
  
  // Check for Next.js
  if (
    fs.existsSync(path.join(cwd, 'next.config.js')) ||
    fs.existsSync(path.join(cwd, 'next.config.mjs')) ||
    fs.existsSync(path.join(cwd, 'next.config.ts'))
  ) {
    return 'nextjs';
  }
  
  // Check for Python
  if (
    fs.existsSync(path.join(cwd, 'requirements.txt')) ||
    fs.existsSync(path.join(cwd, 'pyproject.toml')) ||
    fs.existsSync(path.join(cwd, 'setup.py'))
  ) {
    return 'python';
  }
  
  // Default to vanilla Node.js
  return 'vanilla';
}

/**
 * Get available components for a target.
 */
function getComponents(target) {
  return Object.keys(COMPONENT_MAP[target] || {});
}

/**
 * Register the generate command.
 * @param {import('commander').Command} program
 */
function registerGenerate(program) {
  program
    .command('generate [component]')
    .alias('gen')
    .description('Generate code snippets for RAG applications')
    .option('-t, --target <target>', 'Target framework: vanilla, nextjs, python')
    .option('-m, --model <model>', 'Override embedding model')
    .option('--db <database>', 'Override database name')
    .option('--collection <name>', 'Override collection name')
    .option('--field <name>', 'Override embedding field name')
    .option('--index <name>', 'Override vector index name')
    .option('-d, --dimensions <n>', 'Override dimensions', parseInt)
    .option('--no-rerank', 'Omit reranking from generated code')
    .option('--rerank-model <model>', 'Rerank model to use')
    .option('--json', 'Machine-readable output with filename')
    .option('-l, --list', 'List available components')
    .option('-q, --quiet', 'Suppress hints and metadata')
    .action(async (component, opts) => {
      const telemetry = require('../lib/telemetry');
      try {
        telemetry.send('cli_generate', { provider: opts.target, model: opts.model });
        // Determine target
        const target = opts.target || detectTarget();
        
        // Validate target
        const validTargets = ['vanilla', 'nextjs', 'python'];
        if (!validTargets.includes(target)) {
          console.error(ui.error(`Invalid target: ${target}`));
          console.error(ui.dim(`  Valid targets: ${validTargets.join(', ')}`));
          process.exit(1);
        }
        
        // List components
        if (opts.list || !component) {
          console.log('');
          console.log(ui.bold(`Available components for ${target}:`));
          console.log('');
          
          const components = getComponents(target);
          for (const comp of components) {
            const outputName = OUTPUT_NAMES[target][comp];
            console.log(`  ${ui.cyan(comp.padEnd(15))} → ${ui.dim(outputName)}`);
          }
          
          console.log('');
          console.log(ui.dim('Usage: vai generate <component> [--target <target>]'));
          console.log(ui.dim('       vai generate retrieval > lib/retrieval.js'));
          console.log('');
          return;
        }
        
        // Validate component
        const components = getComponents(target);
        if (!components.includes(component)) {
          console.error(ui.error(`Unknown component: ${component}`));
          console.error(ui.dim(`  Available: ${components.join(', ')}`));
          process.exit(1);
        }
        
        // Load project config
        let project = {};
        try {
          project = loadProject();
        } catch (e) {
          // No .vai.json, use defaults
          if (!opts.quiet) {
            console.error(ui.warn('No .vai.json found, using defaults'));
          }
        }
        
        // Build context with overrides
        const context = buildContext(project, {
          model: opts.model,
          db: opts.db,
          collection: opts.collection,
          field: opts.field,
          index: opts.index,
          dimensions: opts.dimensions,
          rerank: opts.rerank,
          rerankModel: opts.rerankModel,
          projectName: path.basename(process.cwd()),
        });
        
        // Get template name (strip the output extension, keep for template lookup)
        const templateFile = COMPONENT_MAP[target][component];
        const templateName = templateFile.replace(/\.(js|jsx|py)$/, '');
        
        // Render template
        const output = renderTemplate(target, templateName, context);
        
        // Output
        if (opts.json) {
          const filename = OUTPUT_NAMES[target][component];
          console.log(JSON.stringify({ filename, content: output }, null, 2));
        } else {
          // Output to stdout for piping
          console.log(output);
          
          // Hints on stderr
          if (!opts.quiet) {
            const filename = OUTPUT_NAMES[target][component];
            console.error('');
            console.error(ui.dim(`# Generated ${component} for ${target}`));
            console.error(ui.dim(`# Suggested: vai generate ${component} > ${filename}`));
          }
        }
      } catch (err) {
        console.error(ui.error(err.message));
        if (process.env.DEBUG) console.error(err.stack);
        process.exit(1);
      }
    });
}

module.exports = { registerGenerate, detectTarget, getComponents };
