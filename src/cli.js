#!/usr/bin/env node
'use strict';

const { program } = require('commander');
const { registerEmbed } = require('./commands/embed');
const { registerRerank } = require('./commands/rerank');
const { registerStore } = require('./commands/store');
const { registerSearch } = require('./commands/search');
const { registerIndex } = require('./commands/index');
const { registerModels } = require('./commands/models');

program
  .name('vai')
  .description('Voyage AI embeddings, reranking, and Atlas Vector Search CLI')
  .version('1.0.0');

registerEmbed(program);
registerRerank(program);
registerStore(program);
registerSearch(program);
registerIndex(program);
registerModels(program);

program.parse();
