#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_DIR = path.resolve(__dirname, '..');
const DEMOS_DIR = path.join(REPO_DIR, 'docs', 'demos');
const RECORD_SCRIPT = path.join(REPO_DIR, 'scripts', 'record-demo.sh');

function loadDemos() {
  return fs.readdirSync(DEMOS_DIR)
    .filter((name) => name.endsWith('.demo.json'))
    .map((name) => {
      const filePath = path.join(DEMOS_DIR, name);
      const demo = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      return {
        ...demo,
        manifestPath: path.relative(REPO_DIR, filePath),
      };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

function getFlags(demo) {
  const flags = [];

  if (demo.environment?.requiresApiKey) flags.push('api-key');
  if (demo.environment?.requiresMongoDbAtlas) flags.push('atlas');
  if (demo.environment?.requiresOllama) flags.push('ollama');
  if (demo.environment?.worksOffline) flags.push('offline');

  return flags.length > 0 ? flags.join(', ') : 'none';
}

function printUsage() {
  console.log('Usage:');
  console.log('  node scripts/run-demos.js list');
  console.log('  node scripts/run-demos.js <slug> [--method vhs|asciinema]');
  console.log('  node scripts/run-demos.js run <slug> [--method vhs|asciinema]');
  console.log('  node scripts/run-demos.js all [--method vhs|asciinema]');
  console.log('');
  console.log('Examples:');
  console.log('  npm run demos:list');
  console.log('  npm run demos:run -- local-inference');
  console.log('  npm run demos:run -- cli-quickstart --method vhs');
  console.log('  npm run demos:run:all');
}

function validateMethod(method) {
  if (method === 'vhs' || method === 'asciinema') return;

  console.error(`❌ Unsupported method: ${method}`);
  console.error('   Supported methods: vhs, asciinema');
  process.exit(1);
}

function printDemoList(demos) {
  console.log('Available demos:\n');

  demos.forEach((demo) => {
    console.log(`- ${demo.slug}`);
    console.log(`  title: ${demo.title}`);
    console.log(`  tape: ${demo.source?.tapePath || 'missing'}`);
    console.log(`  output: ${demo.assets?.recordingOutput || 'unknown'}`);
    console.log(`  requirements: ${getFlags(demo)}`);
  });
}

function parseArgs(argv) {
  let method = 'vhs';
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--method') {
      method = argv[i + 1];
      i += 1;
      continue;
    }

    positional.push(arg);
  }

  return { method, positional };
}

function matchesDemo(demo, target) {
  if (demo.slug === target) return true;

  const tapePath = demo.source?.tapePath || '';
  const tapeBase = path.basename(tapePath);
  const tapeStem = tapeBase.replace(/\.tape$/, '');

  return target === tapePath || target === tapeBase || target === tapeStem;
}

function runDemo(demo, method) {
  if (!demo.source?.tapePath) {
    console.error(`❌ Demo ${demo.slug} is missing source.tapePath in its manifest.`);
    process.exit(1);
  }

  console.log(`\n▶ Running ${demo.slug} (${demo.title})`);
  console.log(`   tape: ${demo.source.tapePath}`);
  console.log(`   method: ${method}`);

  const result = spawnSync(RECORD_SCRIPT, [method, demo.source.tapePath], {
    cwd: REPO_DIR,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function main() {
  const demos = loadDemos();
  const { method, positional } = parseArgs(process.argv.slice(2));
  const command = positional[0] || 'list';

  validateMethod(method);

  if (command === 'help' || command === '--help' || command === '-h') {
    printUsage();
    return;
  }

  if (command === 'list') {
    printDemoList(demos);
    return;
  }

  if (command === 'all') {
    demos
      .filter((demo) => demo.published !== false)
      .forEach((demo) => runDemo(demo, method));
    return;
  }

  const target = command === 'run' ? positional[1] : command;

  if (!target) {
    printUsage();
    process.exit(1);
  }

  const demo = demos.find((item) => matchesDemo(item, target));

  if (!demo) {
    console.error(`❌ Unknown demo: ${target}`);
    console.error('');
    printDemoList(demos);
    process.exit(1);
  }

  runDemo(demo, method);
}

main();
