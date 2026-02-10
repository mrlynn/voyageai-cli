'use strict';

const fs = require('fs');
const path = require('path');
const p = require('@clack/prompts');
const { MODEL_CATALOG } = require('../lib/catalog');
const { STRATEGIES } = require('../lib/chunker');
const { defaultProjectConfig, saveProject, findProjectFile, PROJECT_FILE } = require('../lib/project');
const ui = require('../lib/ui');

/**
 * Build model options with helpful hints
 */
function getModelOptions() {
  const models = MODEL_CATALOG.filter(m => m.type === 'embedding' && !m.legacy && !m.unreleased);
  
  return models.map(m => {
    // Use shortFor or bestFor from catalog, or build a fallback hint
    let hint = m.shortFor || m.bestFor;
    if (!hint) {
      // Extract first dimension from string or array
      if (Array.isArray(m.dimensions)) {
        hint = `${m.dimensions[0]}d`;
      } else if (typeof m.dimensions === 'string') {
        const match = m.dimensions.match(/^(\d+)/);
        hint = match ? `${match[1]}d` : undefined;
      }
    }
    return {
      value: m.name,
      label: m.name,
      hint,
    };
  });
}

/**
 * Get dimension options for a model
 */
function getDimensionOptions(modelName) {
  const model = MODEL_CATALOG.find(m => m.name === modelName);
  if (!model || !model.dimensions) return [{ value: 1024, label: '1024' }];
  
  // Handle both array and string formats
  // String format: "1024 (default), 256, 512, 2048"
  // Array format: ["1024", "512", "256"]
  let dims;
  if (Array.isArray(model.dimensions)) {
    dims = model.dimensions.map(d => String(d));
  } else if (typeof model.dimensions === 'string') {
    // Parse "1024 (default), 256, 512, 2048" format
    dims = model.dimensions.split(',').map(s => s.replace(/\(default\)/i, '').trim());
  } else {
    return [{ value: 1024, label: '1024' }];
  }

  return dims.map((d, i) => ({
    value: parseInt(d, 10),
    label: d,
    hint: i === 0 ? 'default' : undefined,
  }));
}

/**
 * Interactive init with back navigation
 */
async function runInteractiveInit(defaults, opts) {
  console.log('');
  p.intro(ui.bold('🚀 Initialize Voyage AI Project'));

  // Define all steps
  const steps = [
    'model',
    'dimensions',
    'db',
    'collection',
    'field',
    'index',
    'strategy',
    'chunkSize',
    'chunkOverlap',
  ];

  const answers = { ...defaults };
  let currentStep = 0;

  while (currentStep < steps.length) {
    const step = steps[currentStep];
    let result;

    try {
      switch (step) {
        case 'model':
          result = await p.select({
            message: 'Which embedding model?',
            options: getModelOptions(),
            initialValue: answers.model,
          });
          if (!p.isCancel(result)) answers.model = result;
          break;

        case 'dimensions':
          const dimOptions = getDimensionOptions(answers.model);
          if (dimOptions.length === 1) {
            // Skip if only one option
            answers.dimensions = dimOptions[0].value;
            currentStep++;
            continue;
          }
          result = await p.select({
            message: 'Output dimensions?',
            options: dimOptions,
            initialValue: answers.dimensions,
          });
          if (!p.isCancel(result)) answers.dimensions = result;
          break;

        case 'db':
          p.log.step(ui.bold('MongoDB Atlas Settings'));
          result = await p.text({
            message: 'Database name',
            placeholder: 'myapp',
            defaultValue: answers.db || 'myapp',
            initialValue: answers.db || 'myapp',
          });
          if (!p.isCancel(result)) answers.db = result;
          break;

        case 'collection':
          result = await p.text({
            message: 'Collection name',
            placeholder: 'documents',
            defaultValue: answers.collection || 'documents',
            initialValue: answers.collection || 'documents',
          });
          if (!p.isCancel(result)) answers.collection = result;
          break;

        case 'field':
          result = await p.text({
            message: 'Embedding field name',
            placeholder: 'embedding',
            defaultValue: answers.field || 'embedding',
            initialValue: answers.field || 'embedding',
          });
          if (!p.isCancel(result)) answers.field = result;
          break;

        case 'index':
          result = await p.text({
            message: 'Vector search index name',
            placeholder: 'vector_index',
            defaultValue: answers.index || 'vector_index',
            initialValue: answers.index || 'vector_index',
          });
          if (!p.isCancel(result)) answers.index = result;
          break;

        case 'strategy':
          p.log.step(ui.bold('Chunking Configuration'));
          result = await p.select({
            message: 'Chunking strategy?',
            options: STRATEGIES.map(s => {
              const hints = {
                'fixed': 'simple character-based splits',
                'sentence': 'split on sentence boundaries',
                'paragraph': 'split on paragraph breaks',
                'recursive': 'smart hierarchical splitting',
                'semantic': 'AI-powered topic boundaries',
              };
              return { value: s, label: s, hint: hints[s] };
            }),
            initialValue: answers.chunk?.strategy || 'recursive',
          });
          if (!p.isCancel(result)) {
            answers.chunk = answers.chunk || {};
            answers.chunk.strategy = result;
          }
          break;

        case 'chunkSize':
          result = await p.text({
            message: 'Chunk size (characters)',
            placeholder: '1000',
            defaultValue: String(answers.chunk?.size || 1000),
            initialValue: String(answers.chunk?.size || 1000),
            validate: (v) => {
              const n = parseInt(v, 10);
              if (isNaN(n) || n < 100) return 'Must be at least 100';
              if (n > 10000) return 'Must be at most 10000';
            },
          });
          if (!p.isCancel(result)) {
            answers.chunk = answers.chunk || {};
            answers.chunk.size = parseInt(result, 10);
          }
          break;

        case 'chunkOverlap':
          result = await p.text({
            message: 'Chunk overlap (characters)',
            placeholder: '200',
            defaultValue: String(answers.chunk?.overlap || 200),
            initialValue: String(answers.chunk?.overlap || 200),
            validate: (v) => {
              const n = parseInt(v, 10);
              if (isNaN(n) || n < 0) return 'Must be 0 or greater';
              if (n >= (answers.chunk?.size || 1000)) return 'Must be less than chunk size';
            },
          });
          if (!p.isCancel(result)) {
            answers.chunk = answers.chunk || {};
            answers.chunk.overlap = parseInt(result, 10);
          }
          break;
      }

      // Handle cancel (Ctrl+C) - go back or exit
      if (p.isCancel(result)) {
        if (currentStep === 0) {
          p.cancel('Setup cancelled');
          process.exit(0);
        } else {
          // Go back to previous step
          currentStep--;
          p.log.warn('↩ Going back...');
          continue;
        }
      }

      // Move to next step
      currentStep++;

    } catch (err) {
      // Handle unexpected errors gracefully
      if (err.message?.includes('cancel')) {
        if (currentStep === 0) {
          p.cancel('Setup cancelled');
          process.exit(0);
        }
        currentStep--;
        continue;
      }
      throw err;
    }
  }

  // Build final config
  const config = {
    model: answers.model,
    db: answers.db,
    collection: answers.collection,
    field: answers.field,
    inputType: 'document',
    dimensions: answers.dimensions,
    index: answers.index,
    chunk: {
      strategy: answers.chunk.strategy,
      size: answers.chunk.size,
      overlap: answers.chunk.overlap,
    },
  };

  // Confirm before saving
  const shouldSave = await p.confirm({
    message: 'Save configuration?',
    initialValue: true,
  });

  if (p.isCancel(shouldSave) || !shouldSave) {
    p.cancel('Setup cancelled');
    process.exit(0);
  }

  // Save and show next steps
  const filePath = saveProject(config);
  
  p.log.success(`Created ${path.relative(process.cwd(), filePath)}`);
  
  p.note(
    [
      `${ui.cyan('vai chunk ./docs/')}         Chunk your documents`,
      `${ui.cyan('vai pipeline ./docs/')}      Chunk → embed → store`,
      `${ui.cyan('vai search "query"')}        Search your collection`,
    ].join('\n'),
    'Next steps'
  );

  p.outro('Happy embedding! 🎉');
}

/**
 * Register the init command on a Commander program.
 * @param {import('commander').Command} program
 */
function registerInit(program) {
  program
    .command('init')
    .description('Initialize a project with .vai.json configuration')
    .option('-y, --yes', 'Accept all defaults (non-interactive)')
    .option('--force', 'Overwrite existing .vai.json')
    .option('--json', 'Output created config as JSON (non-interactive)')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(async (opts) => {
      // Check for existing config
      const existing = findProjectFile();
      if (existing && !opts.force) {
        const relPath = path.relative(process.cwd(), existing);
        console.error(ui.warn(`Project already initialized: ${relPath}`));
        console.error(ui.dim('  Use --force to overwrite.'));
        process.exit(1);
      }

      const defaults = defaultProjectConfig();

      // Non-interactive mode
      if (opts.yes || opts.json) {
        const filePath = saveProject(defaults);
        if (opts.json) {
          console.log(JSON.stringify(defaults, null, 2));
        } else if (!opts.quiet) {
          console.log(ui.success(`Created ${PROJECT_FILE}`));
        }
        return;
      }

      // Interactive mode with clack
      await runInteractiveInit(defaults, opts);
    });
}

module.exports = { registerInit };
