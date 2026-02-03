#!/usr/bin/env node
'use strict';

require('dotenv').config({ quiet: true });

const { program } = require('commander');
const { registerEmbed } = require('./commands/embed');
const { registerRerank } = require('./commands/rerank');
const { registerStore } = require('./commands/store');
const { registerSearch } = require('./commands/search');
const { registerIndex } = require('./commands/index');
const { registerModels } = require('./commands/models');
const { registerPing } = require('./commands/ping');
const { registerConfig } = require('./commands/config');
const { registerDemo } = require('./commands/demo');
const { showBanner, showQuickStart } = require('./lib/banner');

program
  .name('vai')
  .description('Voyage AI embeddings, reranking, and Atlas Vector Search CLI')
  .version('1.1.0');

registerEmbed(program);
registerRerank(program);
registerStore(program);
registerSearch(program);
registerIndex(program);
registerModels(program);
registerPing(program);
registerConfig(program);
registerDemo(program);

// If no args (just `vai`), show banner + quick start + help
if (process.argv.length <= 2) {
  showBanner();
  showQuickStart();
  program.outputHelp();
  process.exit(0);
}

program.parse();
