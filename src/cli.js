#!/usr/bin/env node
'use strict';

require('dotenv').config({ quiet: true });

const { program } = require('commander');
const pc = require('picocolors');
const { registerEmbed } = require('./commands/embed');
const { registerRerank } = require('./commands/rerank');
const { registerStore } = require('./commands/store');
const { registerSearch } = require('./commands/search');
const { registerIndex } = require('./commands/index');
const { registerModels } = require('./commands/models');
const { registerPing } = require('./commands/ping');
const { registerConfig } = require('./commands/config');
const { registerDemo } = require('./commands/demo');
const { registerExplain } = require('./commands/explain');
const { registerSimilarity } = require('./commands/similarity');
const { registerIngest } = require('./commands/ingest');
const { registerCompletions } = require('./commands/completions');
const { registerPlayground } = require('./commands/playground');
const { showBanner, showQuickStart, getVersion } = require('./lib/banner');

const version = getVersion();

program
  .name('vai')
  .description('Voyage AI embeddings, reranking, and Atlas Vector Search CLI')
  .version(`vai/${version} (community tool — not an official MongoDB or Voyage AI product)`, '-V, --version', 'output the version number');

registerEmbed(program);
registerRerank(program);
registerStore(program);
registerSearch(program);
registerIndex(program);
registerModels(program);
registerPing(program);
registerConfig(program);
registerDemo(program);
registerExplain(program);
registerSimilarity(program);
registerIngest(program);
registerCompletions(program);
registerPlayground(program);

// Append disclaimer to all help output
program.addHelpText('after', `
${pc.dim('Community tool — not an official MongoDB or Voyage AI product.')}
${pc.dim('Docs: https://www.mongodb.com/docs/voyageai/')}
`);

// If no args (just `vai`), show banner + quick start + help
if (process.argv.length <= 2) {
  showBanner();
  showQuickStart();
  program.outputHelp();
  process.exit(0);
}

program.parse();
