'use strict';

const fs = require('fs');
const path = require('path');
const pc = require('picocolors');
const { defaultProjectConfig, saveProject, findProjectFile, PROJECT_FILE } = require('../lib/project');
const { runWizard } = require('../lib/wizard');
const { createCLIRenderer } = require('../lib/wizard-cli');
const { initSteps } = require('../lib/wizard-steps-init');
const { globalSetupSteps } = require('../lib/wizard-steps-global');
const { getConfigValue, loadConfig, saveConfig } = require('../lib/config');
const { identifyKey } = require('../lib/api');
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
      const telemetry = require('../lib/telemetry');
      telemetry.send('cli_init');
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

      // Interactive mode — ensure global config (API key, optional MongoDB/LLM) then project wizard
      const hasApiKey = process.env.VOYAGE_API_KEY || getConfigValue('apiKey');
      let useNanoMode = false;

      if (!hasApiKey && process.stdin.isTTY && process.stdout.isTTY) {
        // Detect if nano is set up and offer as an option
        let nanoReady = false;
        try {
          const { checkVenv, checkModel } = require('../nano/nano-health');
          nanoReady = checkVenv().ok && checkModel().ok;
        } catch { /* nano module not available */ }

        if (nanoReady) {
          const clack = require('@clack/prompts');
          console.log('');
          const mode = await clack.select({
            message: 'How would you like to use Voyage AI?',
            options: [
              { value: 'nano', label: 'Local (voyage-4-nano)', hint: 'No API key needed, fully offline' },
              { value: 'cloud', label: 'Cloud API', hint: 'Requires API key from dash.voyageai.com' },
            ],
          });
          if (clack.isCancel(mode)) {
            process.exit(0);
          }
          useNanoMode = mode === 'nano';
        }

        if (useNanoMode) {
          // Nano path: just collect MongoDB URI
          console.log(pc.dim('  Local nano mode: no API key needed.\n'));
          const { nanoSetupSteps } = require('../lib/wizard-steps-global');
          const { answers: nanoAnswers, cancelled: nanoCancelled } = await runWizard({
            steps: nanoSetupSteps,
            config: {},
            renderer: createCLIRenderer({
              title: 'MongoDB connection',
              doneMessage: 'Saved to ~/.vai/config.json',
            }),
          });
          if (nanoCancelled) {
            process.exit(0);
          }
          const globalConfig = {};
          if (nanoAnswers.mongodbUri) {
            const uri = nanoAnswers.mongodbUri.trim();
            if (uri) {
              globalConfig.mongodbUri = uri;
              process.env.MONGODB_URI = uri;
            }
          }
          if (Object.keys(globalConfig).length) {
            const existing = loadConfig();
            saveConfig({ ...existing, ...globalConfig });
          }
          console.log('');
        } else {
          // Cloud path: full global setup wizard
          console.log(pc.dim('  First, configure your API key and optional connections.\n'));
          const { answers: globalAnswers, cancelled: globalCancelled } = await runWizard({
            steps: globalSetupSteps,
            config: {},
            renderer: createCLIRenderer({
              title: 'API & connections',
              doneMessage: 'Saved to ~/.vai/config.json',
            }),
          });
          if (globalCancelled) {
            process.exit(0);
          }
          const globalConfig = {};
          const apiKey = (globalAnswers.apiKey || '').trim();
          if (apiKey) {
            globalConfig.apiKey = apiKey;
            globalConfig.baseUrl = identifyKey(apiKey).expectedBase;
            process.env.VOYAGE_API_KEY = apiKey;
          }
          if (globalAnswers.mongodbUri) {
            const uri = globalAnswers.mongodbUri.trim();
            if (uri) {
              globalConfig.mongodbUri = uri;
              process.env.MONGODB_URI = uri;
            }
          }
          if (globalAnswers.wantLlm && globalAnswers.llmProvider) {
            globalConfig.llmProvider = globalAnswers.llmProvider;
            if (globalAnswers.llmApiKey) globalConfig.llmApiKey = globalAnswers.llmApiKey.trim();
            if (globalAnswers.llmModel) globalConfig.llmModel = globalAnswers.llmModel;
            if (globalAnswers.llmProvider === 'ollama' && globalAnswers.llmBaseUrl) {
              globalConfig.llmBaseUrl = globalAnswers.llmBaseUrl.trim();
            }
          }
          if (Object.keys(globalConfig).length) {
            const existing = loadConfig();
            saveConfig({ ...existing, ...globalConfig });
          }
          console.log('');
        }
      } else if (hasApiKey && process.stdout.isTTY) {
        console.log(pc.dim('  Using existing API key from ~/.vai/config.json or env.\n'));
      }

      // Project wizard (pre-select nano model if in nano mode)
      const wizardConfig = useNanoMode ? { model: 'voyage-4-nano' } : {};
      const { answers, cancelled } = await runWizard({
        steps: initSteps,
        config: wizardConfig,
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

      // Warn if nano selected but bridge is not set up
      if (config.model === 'voyage-4-nano') {
        try {
          const { checkVenv, checkModel } = require('../nano/nano-health');
          const venv = checkVenv();
          const model = checkModel();
          if (!venv.ok || !model.ok) {
            console.log('');
            console.log(pc.yellow('⚠ voyage-4-nano requires local setup before use.'));
            if (!venv.ok) console.log(pc.dim('  • Python venv: not found'));
            if (!model.ok) console.log(pc.dim('  • Model weights: not downloaded'));
            console.log(pc.yellow('  Run: vai nano setup'));
          }
        } catch (_) {
          // nano module not available — skip check
        }
      }

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
