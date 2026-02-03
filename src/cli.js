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

// Check for updates (async, non-blocking, cached for 1 day)
const updateNotifierModule = require('update-notifier');
const updateNotifier = updateNotifierModule.default || updateNotifierModule;
const pkg = require('../package.json');
updateNotifier({ pkg, updateCheckInterval: 1000 * 60 * 60 * 24 }).notify({ isGlobal: true });

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

program.parse();
