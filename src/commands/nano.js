'use strict';

function registerNano(program) {
  const nano = program
    .command('nano')
    .description('Local inference with voyage-4-nano');

  nano
    .command('setup')
    .description('Set up local inference environment (Python venv, deps, model)')
    .option('--force', 'Rebuild environment from scratch')
    .action(async (options) => {
      const { runSetup } = require('../nano/nano-setup.js');
      await runSetup(options);
    });

  nano
    .command('clear-cache')
    .description('Remove cached model files')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (options) => {
      const { runClearCache } = require('../nano/nano-setup.js');
      await runClearCache(options);
    });

  nano
    .command('status')
    .description('Check local inference readiness')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const { runStatus } = require('../nano/nano-health.js');
      await runStatus(options);
    });

  nano
    .command('test')
    .description('Smoke-test local inference')
    .action(async () => {
      const { runTest } = require('../nano/nano-health.js');
      await runTest();
    });

  nano
    .command('info')
    .description('Show model details and cache location')
    .action(async () => {
      const { runInfo } = require('../nano/nano-health.js');
      await runInfo();
    });
}

module.exports = { registerNano };
