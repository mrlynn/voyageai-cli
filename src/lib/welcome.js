'use strict';

const { isFirstRun, isWelcomeSuppressed, saveConfig } = require('./config');

/**
 * Determine if the welcome flow should run.
 * Conditions: first run, interactive TTY, not suppressed by env var.
 * @param {string} [configPath] - Override config path (for testing)
 * @returns {boolean}
 */
function shouldShowWelcome(configPath) {
  if (!isFirstRun(configPath)) return false;
  if (isWelcomeSuppressed(configPath)) return false;
  if (!process.stdin.isTTY || !process.stdout.isTTY) return false;
  return true;
}

/**
 * Run the first-run welcome wizard.
 *
 * Shows the banner, collects API key (and optionally MongoDB URI),
 * saves to ~/.vai/config.json, and prints next steps.
 *
 * @param {object} [opts]
 * @param {string} [opts.configPath] - Override config path (for testing)
 * @returns {Promise<boolean>} true if setup completed, false if cancelled
 */
async function runWelcome(opts = {}) {
  const pc = require('picocolors');
  const { showBanner } = require('./banner');
  const { runWizard } = require('./wizard');
  const { createCLIRenderer } = require('./wizard-cli');
  const { welcomeSteps } = require('./wizard-steps-welcome');
  const { identifyKey } = require('./api');

  // Show the banner first
  showBanner();

  console.log(pc.bold('  Welcome! Let\'s get you set up.\n'));
  console.log('  To use vai, you need a Voyage AI API key.');
  console.log(`  Get a free key at: ${pc.cyan('https://dash.voyageai.com/api-keys')}`);
  console.log(`  (MongoDB Atlas keys starting with ${pc.cyan('al-')} also work)\n`);

  const renderer = createCLIRenderer({
    title: 'vai setup',
    doneMessage: 'Setup complete!',
  });

  const { answers, cancelled } = await runWizard({
    steps: welcomeSteps,
    config: {},
    renderer,
  });

  if (cancelled) {
    return false;
  }

  // Build config object
  const config = {};
  const apiKey = (answers.apiKey || '').trim();

  if (apiKey) {
    config.apiKey = apiKey;

    // Auto-detect base URL from key prefix
    const keyInfo = identifyKey(apiKey);
    config.baseUrl = keyInfo.expectedBase;

    // Set in process.env so subsequent commands in the same session work
    process.env.VOYAGE_API_KEY = apiKey;
  }

  if (answers.mongodbUri) {
    const uri = answers.mongodbUri.trim();
    if (uri) {
      config.mongodbUri = uri;
      process.env.MONGODB_URI = uri;
    }
  }

  // Save to ~/.vai/config.json
  saveConfig(config, opts.configPath);

  // Show next steps
  console.log('');
  if (apiKey) {
    const keyInfo = identifyKey(apiKey);
    console.log(`  ${pc.green('\u2713')} API key saved (${pc.dim(keyInfo.label)} endpoint)`);
  }
  if (answers.mongodbUri) {
    console.log(`  ${pc.green('\u2713')} MongoDB URI saved`);
  }
  console.log('');
  console.log(pc.bold('  What to do next:\n'));
  console.log(`    ${pc.cyan('vai quickstart')}     Zero-to-search tutorial (2 min)`);
  console.log(`    ${pc.cyan('vai doctor')}         Verify your full setup`);
  console.log(`    ${pc.cyan('vai init')}           Initialize a project config`);
  console.log(`    ${pc.cyan('vai embed "hello"')}  Generate your first embedding`);
  console.log('');
  console.log(pc.dim('  Run vai --help to see all commands.\n'));

  // Telemetry (non-blocking, fire-and-forget)
  const telemetry = require('./telemetry');
  telemetry.send('cli_welcome_complete', {
    hasApiKey: !!apiKey,
    hasMongo: !!answers.mongodbUri,
    keyType: apiKey ? identifyKey(apiKey).type : 'none',
  });

  return true;
}

module.exports = { shouldShowWelcome, runWelcome };
