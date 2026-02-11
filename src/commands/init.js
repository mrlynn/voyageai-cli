'use strict';

const fs = require('fs');
const path = require('path');
const { defaultProjectConfig, saveProject, findProjectFile, PROJECT_FILE } = require('../lib/project');
const { runWizard } = require('../lib/wizard');
const { createCLIRenderer } = require('../lib/wizard-cli');
const { initSteps } = require('../lib/wizard-steps-init');
const ui = require('../lib/ui');

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
        saveProject(defaults);
        if (opts.json) {
          console.log(JSON.stringify(defaults, null, 2));
        } else if (!opts.quiet) {
          console.log(ui.success(`Created ${PROJECT_FILE}`));
        }
        return;
      }

      // Interactive mode — use wizard
      const { answers, cancelled } = await runWizard({
        steps: initSteps,
        config: {},
        renderer: createCLIRenderer({
          title: '🚀 Initialize Voyage AI Project',
          doneMessage: 'Project initialized!',
        }),
      });

      if (cancelled) {
        process.exit(0);
      }

      // Build config from answers
      const config = {
        model: answers.model || defaults.model,
        db: answers.db || defaults.db,
        collection: answers.collection || defaults.collection,
        field: answers.field || defaults.field,
        inputType: 'document',
        dimensions: parseInt(answers.dimensions, 10) || defaults.dimensions,
        index: answers.index || defaults.index,
        chunk: {
          strategy: answers.chunkStrategy || defaults.chunk.strategy,
          size: parseInt(answers.chunkSize, 10) || defaults.chunk.size,
          overlap: parseInt(answers.chunkOverlap, 10) || defaults.chunk.overlap,
        },
      };

      const filePath = saveProject(config);
      const relPath = path.relative(process.cwd(), filePath);

      if (!opts.quiet) {
        console.log('');
        console.log(ui.dim('  Next steps:'));
        console.log(ui.dim('    vai chunk ./docs/           # Chunk your documents'));
        console.log(ui.dim('    vai pipeline ./docs/        # Chunk → embed → store'));
        console.log(ui.dim('    vai search --query "..."    # Search your collection'));
        console.log('');
      }
    });
}

module.exports = { registerInit };
