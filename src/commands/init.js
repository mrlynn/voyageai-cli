'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { MODEL_CATALOG } = require('../lib/catalog');
const { STRATEGIES } = require('../lib/chunker');
const { defaultProjectConfig, saveProject, findProjectFile, PROJECT_FILE } = require('../lib/project');
const ui = require('../lib/ui');

/**
 * Prompt the user for input with a default value.
 * @param {readline.Interface} rl
 * @param {string} question
 * @param {string} [defaultVal]
 * @returns {Promise<string>}
 */
function ask(rl, question, defaultVal) {
  const suffix = defaultVal ? ` ${ui.dim(`(${defaultVal})`)}` : '';
  return new Promise((resolve) => {
    rl.question(`  ${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || defaultVal || '');
    });
  });
}

/**
 * Prompt for a choice from a list.
 * @param {readline.Interface} rl
 * @param {string} question
 * @param {string[]} choices
 * @param {string} defaultVal
 * @returns {Promise<string>}
 */
async function askChoice(rl, question, choices, defaultVal) {
  console.log('');
  for (let i = 0; i < choices.length; i++) {
    const marker = choices[i] === defaultVal ? ui.cyan('→') : ' ';
    console.log(`  ${marker} ${i + 1}. ${choices[i]}`);
  }
  const answer = await ask(rl, question, defaultVal);
  // Accept number or value
  const num = parseInt(answer, 10);
  if (num >= 1 && num <= choices.length) return choices[num - 1];
  if (choices.includes(answer)) return answer;
  return defaultVal;
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

      // Interactive mode
      console.log('');
      console.log(ui.bold('  🚀 Initialize Voyage AI Project'));
      console.log(ui.dim('  Creates .vai.json in the current directory.'));
      console.log(ui.dim('  Press Enter to accept defaults.'));
      console.log('');

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      try {
        // Embedding model
        const embeddingModels = MODEL_CATALOG
          .filter(m => m.type === 'embedding' && !m.legacy && !m.unreleased)
          .map(m => m.name);
        const model = await askChoice(rl, 'Embedding model', embeddingModels, defaults.model);

        // MongoDB settings
        console.log('');
        console.log(ui.bold('  MongoDB Atlas'));
        const db = await ask(rl, 'Database name', defaults.db || 'myapp');
        const collection = await ask(rl, 'Collection name', defaults.collection || 'documents');
        const field = await ask(rl, 'Embedding field', defaults.field);
        const index = await ask(rl, 'Vector index name', defaults.index);

        // Dimensions
        const modelInfo = MODEL_CATALOG.find(m => m.name === model);
        const defaultDims = modelInfo && modelInfo.dimensions.includes('1024') ? '1024' : '512';
        const dimensions = parseInt(await ask(rl, 'Dimensions', defaultDims), 10) || parseInt(defaultDims, 10);

        // Chunking
        console.log('');
        console.log(ui.bold('  Chunking'));
        const strategy = await askChoice(rl, 'Chunk strategy', STRATEGIES, defaults.chunk.strategy);
        const chunkSize = parseInt(await ask(rl, 'Chunk size (chars)', String(defaults.chunk.size)), 10);
        const chunkOverlap = parseInt(await ask(rl, 'Chunk overlap (chars)', String(defaults.chunk.overlap)), 10);

        const config = {
          model,
          db,
          collection,
          field,
          inputType: 'document',
          dimensions,
          index,
          chunk: {
            strategy,
            size: chunkSize,
            overlap: chunkOverlap,
          },
        };

        const filePath = saveProject(config);
        console.log('');
        console.log(ui.success(`Created ${path.relative(process.cwd(), filePath)}`));
        console.log('');
        console.log(ui.dim('  Next steps:'));
        console.log(ui.dim('    vai chunk ./docs/           # Chunk your documents'));
        console.log(ui.dim('    vai pipeline ./docs/        # Chunk → embed → store (coming soon)'));
        console.log(ui.dim('    vai search --query "..."    # Search your collection'));
        console.log('');
      } finally {
        rl.close();
      }
    });
}

module.exports = { registerInit };
