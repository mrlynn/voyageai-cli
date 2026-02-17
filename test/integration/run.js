#!/usr/bin/env node
'use strict';

/**
 * Integration test runner for VAI workflows against use-case domain datasets.
 *
 * Usage:
 *   node test/integration/run.js [options]
 *
 * Options:
 *   --domain <slug>      Test only a specific domain (devdocs, healthcare, finance, legal)
 *   --workflow <name>     Test only a specific workflow
 *   --no-seed            Skip seeding (assumes data already exists)
 *   --teardown           Drop test collections after running
 *   --json               Output machine-readable JSON
 *   --sample-docs <path> Override base path for sample documents
 */

const path = require('path');
const fs = require('fs');
const { runIntegrationTests } = require('../../src/lib/integration-test-runner');

const args = process.argv.slice(2);
const flags = {
  domain: null,
  workflow: null,
  seed: true,
  teardown: false,
  json: false,
  sampleDocsBase: null,
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--domain' && args[i + 1]) { flags.domain = args[++i]; }
  else if (args[i] === '--workflow' && args[i + 1]) { flags.workflow = args[++i]; }
  else if (args[i] === '--no-seed') { flags.seed = false; }
  else if (args[i] === '--teardown') { flags.teardown = true; }
  else if (args[i] === '--json') { flags.json = true; }
  else if (args[i] === '--sample-docs' && args[i + 1]) { flags.sampleDocsBase = args[++i]; }
}

// Default sample docs path: check vai-site public dir, then local copy
const VAI_SITE_SAMPLES = path.resolve(__dirname, '../../../vai-site/public/use-cases');
const LOCAL_SAMPLES = path.resolve(__dirname, 'sample-docs');

function findSampleDocsPath(slug) {
  if (flags.sampleDocsBase) {
    const p = path.join(flags.sampleDocsBase, slug, 'sample-docs');
    if (fs.existsSync(p)) return p;
  }
  // Try vai-site public directory
  const siteP = path.join(VAI_SITE_SAMPLES, slug, 'sample-docs');
  if (fs.existsSync(siteP)) return siteP;
  // Try local copy
  const localP = path.join(LOCAL_SAMPLES, slug);
  if (fs.existsSync(localP)) return localP;
  return null;
}

async function main() {
  const domainsFile = path.resolve(__dirname, 'domains.json');
  const domainsData = JSON.parse(fs.readFileSync(domainsFile, 'utf8'));
  const workflowsDir = path.resolve(__dirname, '../../src/workflows');

  let domains = domainsData.domains;
  if (flags.domain) {
    domains = domains.filter(d => d.slug === flags.domain);
    if (domains.length === 0) {
      console.error(`Unknown domain: ${flags.domain}`);
      console.error(`Available: ${domainsData.domains.map(d => d.slug).join(', ')}`);
      process.exit(1);
    }
  }

  const allResults = [];
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const domain of domains) {
    const sampleDocsPath = findSampleDocsPath(domain.slug);

    if (!sampleDocsPath && flags.seed) {
      if (!flags.json) {
        console.log(`\n⚠ Skipping ${domain.slug}: no sample docs found`);
        console.log(`  Looked in: ${VAI_SITE_SAMPLES}/${domain.slug}/sample-docs`);
      }
      allResults.push({ domain: domain.slug, skipped: true, reason: 'No sample docs' });
      continue;
    }

    if (!flags.json) {
      console.log(`\n${'═'.repeat(60)}`);
      console.log(`  Domain: ${domain.title} (${domain.slug})`);
      console.log(`  Collection: vai_test_${domain.slug}`);
      console.log(`  Model: ${domain.voyageModel}`);
      if (sampleDocsPath) console.log(`  Sample docs: ${sampleDocsPath}`);
      console.log('═'.repeat(60));
    }

    const result = await runIntegrationTests({
      domain,
      sampleDocsPath,
      workflowsDir,
      workflows: flags.workflow ? [flags.workflow] : undefined,
      seed: flags.seed,
      teardown: flags.teardown,
      onProgress: ({ phase, message }) => {
        if (!flags.json) console.log(`  [${phase}] ${message}`);
      },
    });

    allResults.push(result);
    totalPassed += result.summary.passed;
    totalFailed += result.summary.failed;
    totalSkipped += result.summary.skipped;

    if (!flags.json) {
      console.log();
      for (const wf of result.workflows) {
        const icon = wf.status === 'passed' ? '✔' : wf.status === 'failed' ? '✗' : '⊘';
        const color = wf.status === 'passed' ? '\x1b[32m' : wf.status === 'failed' ? '\x1b[31m' : '\x1b[33m';
        console.log(`  ${color}${icon}\x1b[0m ${wf.name} (${wf.durationMs || 0}ms)`);
        if (wf.inputs) {
          console.log(`    \x1b[36mInputs:\x1b[0m`);
          for (const [k, v] of Object.entries(wf.inputs)) {
            const display = typeof v === 'string' && v.length > 80 ? v.slice(0, 77) + '...' : v;
            console.log(`      ${k}: ${display}`);
          }
        }
        if (wf.assertions) {
          for (const a of wf.assertions) {
            const aIcon = a.pass ? '  ✓' : '  ✗';
            console.log(`    ${a.pass ? '\x1b[32m' : '\x1b[31m'}${aIcon}\x1b[0m ${a.message}`);
          }
        }
        if (wf.errors && wf.errors.length > 0) {
          for (const e of wf.errors) {
            console.log(`    \x1b[31m  error: ${e}\x1b[0m`);
          }
        }
      }
    }
  }

  if (flags.json) {
    console.log(JSON.stringify({ domains: allResults, summary: { passed: totalPassed, failed: totalFailed, skipped: totalSkipped } }, null, 2));
  } else {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  Summary: ${totalPassed} passed, ${totalFailed} failed, ${totalSkipped} skipped`);
    console.log('─'.repeat(60));
  }

  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Integration test runner failed:', err);
  process.exit(1);
});
