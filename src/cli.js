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
const { registerBenchmark } = require('./commands/benchmark');
const { registerEstimate } = require('./commands/estimate');
const { registerInit } = require('./commands/init');
const { registerChunk } = require('./commands/chunk');
const { registerQuery } = require('./commands/query');
const { registerPipeline } = require('./commands/pipeline');
const { registerEval } = require('./commands/eval');
const { registerGenerate } = require('./commands/generate');
const { registerScaffold } = require('./commands/scaffold');
const { register: registerPurge } = require('./commands/purge');
const { register: registerRefresh } = require('./commands/refresh');
const { registerApp } = require('./commands/app');
const { registerAbout } = require('./commands/about');
const { register: registerDoctor } = require('./commands/doctor');
const { register: registerQuickstart } = require('./commands/quickstart');
const { registerBug } = require('./commands/bug');
const { registerChat } = require('./commands/chat');
const { registerMcpServer } = require('./commands/mcp-server');
const { registerWorkflow } = require('./commands/workflow');
const { registerIndexWorkspace } = require('./commands/index-workspace');
const { registerExport } = require('./commands/export');
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
registerBenchmark(program);
registerEstimate(program);
registerInit(program);
registerChunk(program);
registerQuery(program);
registerPipeline(program);
registerEval(program);
registerGenerate(program);
registerScaffold(program);
registerPurge(program);
registerRefresh(program);
registerApp(program);
registerAbout(program);
registerDoctor(program);
registerQuickstart(program);
registerBug(program);
registerChat(program);
registerMcpServer(program);
registerWorkflow(program);
registerIndexWorkspace(program);
registerExport(program);

// Append disclaimer to all help output
program.addHelpText('after', `
${pc.dim('Community tool — not an official MongoDB or Voyage AI product.')}
${pc.dim('Docs: https://www.mongodb.com/docs/voyageai/')}
`);

// Anonymous telemetry (fire-and-forget, non-blocking)
const telemetry = require('./lib/telemetry');

// If no args (just `vai`), show banner + quick start + help
if (process.argv.length <= 2) {
  showBanner();
  showQuickStart();
  program.outputHelp();
  process.exit(0);
}

// Track command usage after parsing
program.hook('preAction', (thisCommand) => {
  const cmd = thisCommand.args?.[0] || thisCommand.name();
  telemetry.send('cli_command', { command: cmd });
});

program.parse();
