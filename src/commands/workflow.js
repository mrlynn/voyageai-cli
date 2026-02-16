'use strict';

const path = require('path');
const pc = require('picocolors');
const ui = require('../lib/ui');

/**
 * Try to get the git user name for default author.
 * @returns {string}
 */
function getGitAuthor() {
  try {
    const { execSync } = require('child_process');
    return execSync('git config user.name', { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

/**
 * Parse repeatable --input key=value options into an object.
 * Used as Commander's option reducer.
 *
 * @param {string} pair - "key=value" string
 * @param {object} prev - Accumulated object
 * @returns {object}
 */
function collectInputs(pair, prev) {
  const eq = pair.indexOf('=');
  if (eq === -1) {
    throw new Error(`Invalid input format: "${pair}". Expected key=value`);
  }
  const key = pair.slice(0, eq).trim();
  const value = pair.slice(eq + 1).trim();
  prev[key] = value;
  return prev;
}

/**
 * Interactively prompt the user for missing workflow inputs using @clack/prompts.
 * Only prompts for inputs not already provided via --input flags.
 *
 * @param {object} definition - Workflow definition
 * @param {object} existingInputs - Inputs already provided via --input
 * @returns {Promise<object>} Merged inputs (existing + prompted)
 */
async function promptForInputs(definition, existingInputs) {
  const { buildInputSteps } = require('../lib/workflow');
  const { createCLIRenderer } = require('../lib/wizard-cli');
  const { runWizard } = require('../lib/wizard');
  const { loadInputCache } = require('../lib/workflow-input-cache');

  // Load cached inputs from last run to use as defaults
  const workflowName = definition.name || '';
  const cachedInputs = loadInputCache(workflowName);

  const allSteps = buildInputSteps(definition, cachedInputs);
  // Only prompt for inputs not already provided
  const steps = allSteps.filter(s => !(s.id in existingInputs));
  if (steps.length === 0) return existingInputs;

  const renderer = createCLIRenderer({
    title: `${definition.name || 'Workflow'} inputs`,
    doneMessage: 'Inputs ready.',
    showBackHint: true,
  });

  const { answers, cancelled } = await runWizard({
    steps,
    config: {},
    renderer,
    initial: {},
  });

  if (cancelled) {
    console.log(pc.dim('Cancelled.'));
    process.exit(0);
  }

  return { ...existingInputs, ...answers };
}

/**
 * Register the workflow command on a Commander program.
 * @param {import('commander').Command} program
 */
function registerWorkflow(program) {
  const wfCmd = program
    .command('workflow')
    .alias('wf')
    .description('Run, validate, and manage composable RAG workflows');

  // ── workflow run <file> ──
  wfCmd
    .command('run <file>')
    .description('Execute a workflow file or built-in template')
    .option('--input <key=value>', 'Set a workflow input (repeatable)', collectInputs, {})
    .option('--db <name>', 'Override default database')
    .option('--collection <name>', 'Override default collection')
    .option('--json', 'Output results as JSON', false)
    .option('-o, --output <format>', 'Output format: json, table, markdown, text, csv, value:<path>')
    .option('--quiet', 'Suppress progress output', false)
    .option('--dry-run', 'Show execution plan without running', false)
    .option('--verbose', 'Show step details', false)
    .option('--no-interactive', 'Disable interactive input prompting')
    .action(async (file, opts) => {
      const { executeWorkflow, buildExecutionPlan, validateWorkflow } = require('../lib/workflow');
      const { resolveWorkflow } = require('../lib/workflow-registry');

      let definition;
      try {
        const resolved = resolveWorkflow(file);
        definition = resolved.definition;

        // Show workflow source notice
        if ((resolved.source === 'community' || resolved.source === 'official') && !opts.quiet) {
          const pkg = resolved.metadata?.package;
          const author = typeof pkg?.author === 'string' ? pkg.author : pkg?.author?.name || 'unknown';
          const tools = (pkg?.vai?.tools || []).join(', ');
          const isOfficial = resolved.source === 'official';
          const label = isOfficial ? 'official catalog workflow' : 'community workflow';
          console.error(`${pc.dim('ℹ')} Running ${label}: ${pc.cyan(pkg?.name || file)} ${pc.dim(`v${pkg?.version || '?'}`)}`);
          console.error(`  ${pc.dim(`by ${author}`)}${tools ? pc.dim(` | Tools: ${tools}`) : ''}`);
          if (!isOfficial) {
            console.error(`  ${pc.dim('This is a community-contributed workflow, not maintained by the vai project.')}`);
          }
          console.error();
          for (const w of resolved.metadata?.warnings || []) {
            console.error(`  ${pc.yellow('⚠')} ${w}`);
          }
        }
      } catch (err) {
        console.error(ui.error(err.message));
        process.exit(1);
      }

      // Validation
      const errors = validateWorkflow(definition);
      if (errors.length > 0) {
        console.error(ui.error('Workflow validation failed:'));
        for (const e of errors) console.error(`  ${pc.red('-')} ${e}`);
        process.exit(1);
      }

      const workflowName = definition.name || file;

      // Interactive prompting for missing inputs
      if (opts.interactive !== false && process.stdin.isTTY) {
        opts.input = await promptForInputs(definition, opts.input);
      }

      if (opts.dryRun) {
        // Dry run: show plan
        const layers = buildExecutionPlan(definition.steps);
        const stepMap = new Map(definition.steps.map(s => [s.id, s]));

        if (opts.json) {
          console.log(JSON.stringify({ name: workflowName, layers, steps: definition.steps, inputs: opts.input }, null, 2));
          return;
        }

        console.log();
        console.log(`${pc.bold('vai workflow:')} ${workflowName} ${pc.dim('(dry run)')}`);
        console.log(pc.dim('═'.repeat(50)));
        console.log();

        // Show inputs
        const inputKeys = Object.keys(opts.input);
        if (inputKeys.length > 0) {
          console.log(pc.bold('Inputs:'));
          for (const [k, v] of Object.entries(opts.input)) {
            console.log(`  ${pc.cyan(k)}: ${JSON.stringify(v)}`);
          }
          console.log();
        }

        // Show execution plan
        console.log(pc.bold('Execution plan:'));
        let stepNum = 1;
        for (let i = 0; i < layers.length; i++) {
          const layer = layers[i];
          for (const stepId of layer) {
            const step = stepMap.get(stepId);
            const toolDesc = `${step.tool}(${summarizeInputs(step.inputs)})`;
            console.log(`  ${pc.dim(`${stepNum}.`)} ${pc.cyan(stepId)} ${pc.dim('->')} ${toolDesc}`);
            stepNum++;
          }
          if (layer.length > 1) {
            console.log(`     ${pc.dim(`(${layer.join(' and ')} run in parallel)`)}`);
          }
        }
        console.log();
        return;
      }

      // Execute workflow
      const telemetry = require('../lib/telemetry');
      const wfDone = telemetry.timer('cli_workflow_run', {
        workflowName,
        stepCount: definition.steps?.length || 0,
        isBuiltin: !!(definition._source === 'builtin'),
      });
      try {
        const result = await executeWorkflow(definition, {
          inputs: opts.input,
          db: opts.db,
          collection: opts.collection,
          dryRun: false,
          verbose: opts.verbose,
          json: opts.json,
          onStepStart: !opts.quiet ? (stepId, step) => {
            process.stderr.write(`  ${pc.dim('...')} ${step.name || stepId}\r`);
          } : undefined,
          onStepComplete: !opts.quiet ? (stepId, output, durationMs) => {
            const stepDef = definition.steps.find(s => s.id === stepId);
            const summary = summarizeOutput(stepDef?.tool, output);
            console.error(`  ${pc.green('✔')} ${stepDef?.name || stepId}  ${pc.dim(summary)}  ${pc.dim(`[${durationMs}ms]`)}`);
          } : undefined,
          onStepSkip: !opts.quiet ? (stepId, reason) => {
            const stepDef = definition.steps.find(s => s.id === stepId);
            console.error(`  ${pc.yellow('⊘')} ${stepDef?.name || stepId}  ${pc.dim(`skipped: ${reason}`)}`);
          } : undefined,
          onStepError: !opts.quiet ? (stepId, err) => {
            const stepDef = definition.steps.find(s => s.id === stepId);
            console.error(`  ${pc.red('✗')} ${stepDef?.name || stepId}  ${pc.red(err.message)}`);
          } : undefined,
        });

        if (!opts.quiet) {
          console.error();
          console.error(`${pc.bold('vai workflow:')} ${workflowName}`);
          console.error(pc.dim('═'.repeat(50)));
          // Step summaries already printed via callbacks
          console.error();
          console.error(`${pc.dim('Complete.')} ${result.steps.length} steps, ${result.totalTimeMs}ms total.`);
          console.error();
        }

        wfDone();

        // Cache inputs for next run
        try {
          const { saveInputCache } = require('../lib/workflow-input-cache');
          saveInputCache(workflowName, opts.input);
        } catch { /* non-critical, don't fail the run */ }

        // Output
        const { formatWorkflowOutput, autoDetectFormat } = require('../lib/workflow-formatters');
        const fmtHints = definition.formatters || {};

        if (opts.json || opts.output === 'json') {
          console.log(JSON.stringify(result.output, null, 2));
        } else if (opts.output) {
          console.log(formatWorkflowOutput(result.output, opts.output, fmtHints));
        } else if (result.output) {
          // Auto-detect best format from output shape and workflow hints
          const bestFormat = autoDetectFormat(result.output, fmtHints);
          console.log(formatWorkflowOutput(result.output, bestFormat, fmtHints));
        }
      } catch (err) {
        console.error(ui.error(err.message));
        if (opts.verbose) {
          console.error(pc.dim(err.stack));
        }
        process.exit(1);
      }
    });

  // ── workflow check <path> ──
  wfCmd
    .command('check <path>')
    .description('Run validation, security, and quality checks on a workflow package')
    .option('--security', 'Run security checks only', false)
    .option('--quality', 'Run quality checks only', false)
    .option('--all', 'Run all check tiers', false)
    .option('--json', 'Output machine-readable JSON', false)
    .option('--ci', 'Output CI-optimized JSON with summary metadata', false)
    .action((pkgPath, opts) => {
      const { validateSchemaEnhanced, loadWorkflow } = require('../lib/workflow');
      const { securityAudit, extractCapabilities } = require('../lib/security-audit');
      const { qualityAudit } = require('../lib/quality-audit');
      const fs = require('fs');

      const resolvedPath = path.resolve(pkgPath);
      const runAll = opts.all || (!opts.security && !opts.quality);

      // Load workflow definition
      let definition;
      let pkg = {};
      let workflowFile;

      try {
        // Check if it's a directory (package) or a single file
        const stat = fs.statSync(resolvedPath);
        if (stat.isDirectory()) {
          // Package directory
          const pkgJsonPath = path.join(resolvedPath, 'package.json');
          if (fs.existsSync(pkgJsonPath)) {
            pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
          }
          // Find workflow file
          workflowFile = pkg.main || 'workflow.json';
          const wfPath = path.join(resolvedPath, workflowFile);
          if (fs.existsSync(wfPath)) {
            definition = JSON.parse(fs.readFileSync(wfPath, 'utf8'));
          } else {
            console.error(ui.error(`Workflow file not found: ${wfPath}`));
            process.exit(1);
          }
        } else {
          // Single file
          definition = loadWorkflow(resolvedPath);
        }
      } catch (err) {
        console.error(ui.error(err.message));
        process.exit(1);
      }

      const results = { schema: [], security: [], quality: [], capabilities: [] };

      // L1: Schema validation (always runs)
      if (runAll || (!opts.security && !opts.quality)) {
        results.schema = validateSchemaEnhanced(definition);
      }

      // L2: Security
      if (runAll || opts.security) {
        const packageDir = fs.statSync(resolvedPath).isDirectory() ? resolvedPath : null;
        results.security = securityAudit(definition, packageDir);
        results.capabilities = [...extractCapabilities(definition)];
      }

      // L3: Quality
      if (runAll || opts.quality) {
        const packageDir = fs.statSync(resolvedPath).isDirectory() ? resolvedPath : null;
        results.quality = qualityAudit(definition, pkg, packageDir);
      }

      // CI output (machine-readable JSON with summary metadata)
      if (opts.ci) {
        const criticalCount = results.security.filter(f => f.severity === 'critical').length;
        const highCount = results.security.filter(f => f.severity === 'high').length;
        const schemaPass = results.schema.length === 0;
        const securityPass = criticalCount === 0 && highCount === 0;
        const qualityPass = results.quality.filter(i => i.level === 'error').length === 0;
        const ciOutput = {
          schema: { pass: schemaPass, errors: results.schema },
          security: { pass: securityPass, findings: results.security },
          quality: { pass: qualityPass, issues: results.quality },
          capabilities: results.capabilities,
          summary: {
            passAll: schemaPass && securityPass && qualityPass,
            criticalCount,
            highCount,
          },
        };
        console.log(JSON.stringify(ciOutput, null, 2));
        if (criticalCount > 0) process.exit(2);
        if (highCount > 0) process.exit(1);
        return;
      }

      // JSON output
      if (opts.json) {
        console.log(JSON.stringify(results, null, 2));
        // Exit code 1 if critical/high security findings
        const hasCritical = results.security.some(f => f.severity === 'critical' || f.severity === 'high');
        if (hasCritical) process.exit(1);
        return;
      }

      // Pretty output
      console.log();
      console.log(pc.bold(`Workflow Check: ${definition.name || pkgPath}`));
      console.log(pc.dim('═'.repeat(50)));

      // Schema
      if (results.schema.length > 0) {
        console.log();
        console.log(pc.bold('Schema Validation:'));
        for (const e of results.schema) {
          console.log(`  ${pc.red('✗')} ${e}`);
        }
      } else if (runAll || (!opts.security && !opts.quality)) {
        console.log();
        console.log(`${pc.bold('Schema Validation:')} ${pc.green('✔ passed')}`);
      }

      // Security
      if (runAll || opts.security) {
        console.log();
        console.log(pc.bold('Security Audit:'));
        if (results.security.length === 0) {
          console.log(`  ${pc.green('✔')} No security issues found`);
        } else {
          for (const f of results.security) {
            const color = f.severity === 'critical' ? pc.red :
                          f.severity === 'high' ? pc.red :
                          f.severity === 'medium' ? pc.yellow : pc.dim;
            const icon = f.severity === 'critical' || f.severity === 'high' ? '✗' : '⚠';
            console.log(`  ${color(icon)} [${f.severity.toUpperCase()}] ${f.message}`);
          }
        }

        // Capability flags
        if (results.capabilities.length > 0) {
          console.log();
          console.log(pc.bold('Capabilities:'));
          const capIcons = { NETWORK: '🌐', WRITE_DB: '💾', LLM: '🤖', LOOP: '🔄', READ_DB: '📊' };
          for (const cap of results.capabilities) {
            console.log(`  ${capIcons[cap] || '•'} ${cap}`);
          }
        }
      }

      // Quality
      if (runAll || opts.quality) {
        console.log();
        console.log(pc.bold('Quality Audit:'));
        if (results.quality.length === 0) {
          console.log(`  ${pc.green('✔')} No quality issues found`);
        } else {
          for (const issue of results.quality) {
            const color = issue.level === 'error' ? pc.red :
                          issue.level === 'warning' ? pc.yellow : pc.dim;
            const icon = issue.level === 'error' ? '✗' : issue.level === 'warning' ? '⚠' : 'ℹ';
            console.log(`  ${color(icon)} [${issue.level.toUpperCase()}] ${issue.message}`);
          }
        }
      }

      console.log();

      // Exit code 1 if critical/high security findings
      const hasCritical = results.security.some(f => f.severity === 'critical' || f.severity === 'high');
      if (hasCritical) process.exit(1);
    });

  // ── workflow test <path> ──
  wfCmd
    .command('test <path>')
    .description('Run test fixtures for a workflow package')
    .option('--test <name>', 'Run a specific test case by name')
    .option('--json', 'Output machine-readable JSON', false)
    .action(async (pkgPath, opts) => {
      const { loadWorkflow } = require('../lib/workflow');
      const { runAllTests, loadTestCases } = require('../lib/workflow-test-runner');
      const fs = require('fs');

      const resolvedPath = path.resolve(pkgPath);

      // Load workflow definition
      let definition;
      try {
        const stat = fs.statSync(resolvedPath);
        if (stat.isDirectory()) {
          const wfPath = path.join(resolvedPath, 'workflow.json');
          if (fs.existsSync(wfPath)) {
            definition = JSON.parse(fs.readFileSync(wfPath, 'utf8'));
          } else {
            console.error(ui.error(`Workflow file not found: ${wfPath}`));
            process.exit(1);
          }
        } else {
          console.error(ui.error('Path must be a workflow package directory'));
          process.exit(1);
        }
      } catch (err) {
        console.error(ui.error(err.message));
        process.exit(1);
      }

      // Check for tests directory
      const testsDir = path.join(resolvedPath, 'tests');
      if (!fs.existsSync(testsDir)) {
        console.error(ui.error('No tests/ directory found in package'));
        process.exit(1);
      }

      const testCases = loadTestCases(resolvedPath);
      if (testCases.length === 0) {
        console.error(ui.error('No *.test.json files found in tests/'));
        process.exit(1);
      }

      try {
        const aggregate = await runAllTests(definition, resolvedPath, {
          testName: opts.test,
        });

        if (opts.json) {
          console.log(JSON.stringify(aggregate, null, 2));
          if (aggregate.failed > 0) process.exit(1);
          return;
        }

        // Pretty output
        console.log();
        console.log(pc.bold(`Workflow Tests: ${definition.name || pkgPath}`));
        console.log(pc.dim('═'.repeat(50)));
        console.log();

        for (const result of aggregate.results) {
          const icon = result.passed ? pc.green('✔') : pc.red('✗');
          console.log(`${icon} ${result.name || result.file}`);

          if (result.error) {
            console.log(`  ${pc.red(result.error)}`);
          }

          for (const assertion of result.assertions) {
            const aIcon = assertion.pass ? pc.green('  ✔') : pc.red('  ✗');
            console.log(`${aIcon} ${assertion.message}`);
          }

          for (const err of (result.errors || [])) {
            console.log(`  ${pc.red('Error:')} ${err}`);
          }
        }

        console.log();
        console.log(`${pc.bold('Summary:')} ${pc.green(`${aggregate.passed} passed`)}, ${aggregate.failed > 0 ? pc.red(`${aggregate.failed} failed`) : `${aggregate.failed} failed`}`);
        console.log();

        if (aggregate.failed > 0) process.exit(1);
      } catch (err) {
        console.error(ui.error(err.message));
        process.exit(1);
      }
    });

  // ── workflow validate <file> ──
  wfCmd
    .command('validate <file>')
    .description('Validate a workflow file without executing')
    .action((file) => {
      const { loadWorkflow, validateWorkflow, buildExecutionPlan } = require('../lib/workflow');

      let definition;
      try {
        definition = loadWorkflow(file);
      } catch (err) {
        console.error(ui.error(err.message));
        process.exit(1);
      }

      const errors = validateWorkflow(definition);
      if (errors.length > 0) {
        console.error(ui.error(`Workflow has ${errors.length} error(s):`));
        for (const e of errors) console.error(`  ${pc.red('-')} ${e}`);
        process.exit(1);
      }

      const layers = buildExecutionPlan(definition.steps);
      console.log(ui.success(`${definition.name} is valid`));
      console.log(`  ${pc.dim('Steps:')} ${definition.steps.length}`);
      console.log(`  ${pc.dim('Layers:')} ${layers.length} (${layers.map(l => l.length).join(' + ')} steps)`);

      if (definition.inputs) {
        const required = Object.entries(definition.inputs).filter(([, s]) => s.required).map(([k]) => k);
        if (required.length > 0) {
          console.log(`  ${pc.dim('Required inputs:')} ${required.join(', ')}`);
        }
      }
    });

  // ── workflow list ──
  wfCmd
    .command('list')
    .description('List available workflows (built-in + official + community)')
    .option('--built-in', 'Show only built-in workflows', false)
    .option('--official', 'Show only official @vaicli workflows', false)
    .option('--community', 'Show only community workflows', false)
    .option('--category <name>', 'Filter by category')
    .option('--tag <name>', 'Filter by tag')
    .option('--json', 'Output JSON', false)
    .action((opts) => {
      const { getRegistry } = require('../lib/workflow-registry');
      const registry = getRegistry({ force: true });

      const showBuiltIn = !opts.community && !opts.official;
      const showOfficial = !opts.builtIn && !opts.community;
      const showCommunity = !opts.builtIn && !opts.official;

      if (opts.json) {
        const out = {};
        if (showBuiltIn) out.builtIn = registry.builtIn;
        if (showOfficial) out.official = registry.official.filter(c => c.errors.length === 0);
        if (showCommunity) out.community = registry.community.filter(c => c.errors.length === 0);
        console.log(JSON.stringify(out, null, 2));
        return;
      }

      /**
       * Display a list of package-based workflows (official or community).
       */
      function displayPackageList(items, label, emptyHint) {
        let filtered = items.filter(c => c.errors.length === 0);
        if (opts.category) {
          filtered = filtered.filter(c => (c.pkg?.vai?.category || 'utility') === opts.category);
        }
        if (opts.tag) {
          filtered = filtered.filter(c => (c.pkg?.vai?.tags || []).includes(opts.tag));
        }

        console.log();
        console.log(pc.bold(`${label} (${filtered.length})`));
        if (filtered.length === 0) {
          console.log(pc.dim(`  (${emptyHint})`));
        } else {
          for (const wf of filtered) {
            const pkg = wf.pkg || {};
            const author = typeof pkg.author === 'string' ? pkg.author : pkg.author?.name || '';
            const tags = (pkg.vai?.tags || []).join(' · ');
            console.log(`  ${pc.cyan(wf.name.padEnd(42))} ${pkg.description || ''}`);
            if (author || tags) {
              console.log(`    ${pc.dim(`by ${author}`)}${pkg.version ? pc.dim(` | v${pkg.version}`) : ''}${tags ? pc.dim(` | ${tags}`) : ''}`);
            }
          }
        }

        // Show invalid packages as warnings
        const invalid = items.filter(c => c.errors.length > 0);
        if (invalid.length > 0) {
          console.log();
          for (const inv of invalid) {
            console.error(`  ${pc.yellow('⚠')} ${inv.name}: ${inv.errors[0]}`);
          }
        }
      }

      // Built-in
      if (showBuiltIn) {
        console.log();
        console.log(pc.bold(`Built-in Workflows (${registry.builtIn.length})`));
        if (registry.builtIn.length === 0) {
          console.log(pc.dim('  (none)'));
        } else {
          for (const wf of registry.builtIn) {
            console.log(`  ${pc.cyan(wf.name.padEnd(28))} ${wf.description}`);
          }
        }
      }

      // Official Catalog (@vaicli)
      if (showOfficial) {
        displayPackageList(registry.official, 'Official Catalog (@vaicli)', 'none installed');
      }

      // Community
      if (showCommunity) {
        displayPackageList(registry.community, 'Community Workflows', 'none installed — install with: vai workflow install <package-name>');
      }

      console.log();
      console.log(pc.dim('Run with: vai workflow run <name> --input key=value'));
      console.log();
    });

  // ── workflow install ──
  wfCmd
    .command('install <package>')
    .description('Install a workflow from npm')
    .option('--global', 'Install globally', false)
    .option('--json', 'Output JSON', false)
    .action(async (packageName, opts) => {
      const { installPackage, WORKFLOW_PREFIX, isWorkflowPackage, isOfficialPackage } = require('../lib/npm-utils');
      const { validatePackage, clearRegistryCache } = require('../lib/workflow-registry');

      // Auto-prefix if needed (but not for scoped packages)
      if (!packageName.startsWith('@') && !packageName.startsWith(WORKFLOW_PREFIX)) {
        packageName = WORKFLOW_PREFIX + packageName;
      }

      const telemetry = require('../lib/telemetry');
      console.log(`Installing ${pc.cyan(packageName)}...`);

      try {
        telemetry.send('cli_workflow_install', { packageName });
        const result = installPackage(packageName, { global: opts.global });
        console.log(`${pc.green('✔')} Downloaded ${pc.cyan(packageName)}@${result.version}`);

        // Validate
        if (result.path) {
          const validation = validatePackage(result.path);
          if (validation.errors.length === 0) {
            const steps = validation.definition?.steps?.length || 0;
            const tools = (validation.pkg?.vai?.tools || []).join(', ');
            console.log(`${pc.green('✔')} Validated workflow definition (${steps} steps${tools ? `, tools: ${tools}` : ''})`);

            // Display capability flags
            if (validation.definition) {
              const { extractCapabilities } = require('../lib/security-audit');
              const caps = extractCapabilities(validation.definition);
              if (caps.size > 0) {
                const capIcons = { NETWORK: '🌐', WRITE_DB: '💾', LLM: '🤖', LOOP: '🔄', READ_DB: '📊' };
                const capList = [...caps].map(c => `${capIcons[c] || '•'} ${c}`).join('  ');
                console.log(`${pc.dim('Capabilities:')} ${capList}`);
              }
            }
          } else {
            console.log(`${pc.yellow('⚠')} Validation issues:`);
            for (const e of validation.errors) {
              console.log(`  ${pc.yellow('-')} ${e}`);
            }
            console.log();
            console.log(pc.dim('The package was installed but the workflow may not execute correctly.'));
          }
          for (const w of validation.warnings) {
            console.log(`${pc.yellow('⚠')} ${w}`);
          }
        }

        clearRegistryCache();

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log();
          console.log(`Installed. Run with:`);
          console.log(`  ${pc.cyan(`vai workflow run ${packageName}`)} --input key=value`);
        }
      } catch (err) {
        console.error(ui.error(err.message));
        process.exit(1);
      }
    });

  // ── workflow uninstall ──
  wfCmd
    .command('uninstall <package>')
    .description('Remove a workflow package')
    .option('--global', 'Uninstall globally', false)
    .action((packageName, opts) => {
      const { uninstallPackage, WORKFLOW_PREFIX } = require('../lib/npm-utils');
      const { clearRegistryCache } = require('../lib/workflow-registry');

      if (!packageName.startsWith('@') && !packageName.startsWith(WORKFLOW_PREFIX)) {
        packageName = WORKFLOW_PREFIX + packageName;
      }

      console.log(`Uninstalling ${pc.cyan(packageName)}...`);

      try {
        uninstallPackage(packageName, { global: opts.global });
        clearRegistryCache();
        console.log(`${pc.green('✔')} Removed ${packageName}`);
      } catch (err) {
        console.error(ui.error(err.message));
        process.exit(1);
      }
    });

  // ── workflow search ──
  wfCmd
    .command('search <query>')
    .description('Search npm for community workflows')
    .option('--limit <n>', 'Maximum results', '10')
    .option('--json', 'Output JSON', false)
    .action(async (query, opts) => {
      const { searchNpm } = require('../lib/npm-utils');

      const telemetry = require('../lib/telemetry');
      console.log(`Searching npm for vai-workflow packages matching "${query}"...`);
      console.log();

      try {
        const results = await searchNpm(query, { limit: parseInt(opts.limit, 10) });
        telemetry.send('cli_workflow_search', { query: query.slice(0, 50), resultCount: results.length });

        if (opts.json) {
          console.log(JSON.stringify(results, null, 2));
          return;
        }

        if (results.length === 0) {
          console.log(pc.dim('  No matching workflow packages found.'));
          console.log();
          return;
        }

        for (const r of results) {
          const badge = r.official ? `  ${pc.green('[OFFICIAL]')}` : '';
          console.log(`  ${pc.cyan(r.name)}  ${pc.dim(`v${r.version}`)}${badge}`);
          if (r.description) console.log(`    ${r.description}`);
          console.log(`    ${pc.dim(`by ${r.author}`)}${r.keywords.length ? pc.dim(` | ${r.keywords.slice(0, 5).join(', ')}`) : ''}`);
          console.log();
        }

        console.log(pc.dim(`Install: vai workflow install <package-name>`));
        console.log();
      } catch (err) {
        console.error(ui.error(err.message));
        process.exit(1);
      }
    });

  // ── workflow info ──
  wfCmd
    .command('info <name>')
    .description('Show detailed info about an installed workflow')
    .option('--json', 'Output JSON', false)
    .action((name, opts) => {
      const { resolveWorkflow, getRegistry } = require('../lib/workflow-registry');
      const { WORKFLOW_PREFIX } = require('../lib/npm-utils');

      try {
        const resolved = resolveWorkflow(name);

        if (opts.json) {
          console.log(JSON.stringify({ source: resolved.source, definition: resolved.definition, metadata: resolved.metadata }, null, 2));
          return;
        }

        const def = resolved.definition;
        console.log();

        if (resolved.source === 'community' || resolved.source === 'official') {
          const pkg = resolved.metadata?.package || {};
          const author = typeof pkg.author === 'string' ? pkg.author : pkg.author?.name || 'unknown';
          const vai = pkg.vai || {};

          console.log(`${pc.bold(pc.cyan(pkg.name || name))} ${pc.dim(`v${pkg.version || '?'}`)}`);
          console.log(`  ${pkg.description || def.description || ''}`);
          console.log();
          console.log(`  ${pc.dim('Author:')}     ${author}`);
          console.log(`  ${pc.dim('License:')}    ${pkg.license || 'unknown'}`);
          console.log(`  ${pc.dim('Category:')}   ${vai.category || 'utility'}`);
          if (vai.tags?.length) console.log(`  ${pc.dim('Tags:')}       ${vai.tags.join(', ')}`);
          if (vai.minVaiVersion) console.log(`  ${pc.dim('Min vai:')}    v${vai.minVaiVersion}`);
          if (vai.tools?.length) console.log(`  ${pc.dim('Tools:')}      ${vai.tools.join(', ')}`);
          console.log(`  ${pc.dim('Steps:')}      ${def.steps?.length || 0}`);
          console.log(`  ${pc.dim('Source:')}     ${resolved.metadata?.path || 'unknown'}`);
          if (pkg.name) console.log(`  ${pc.dim('npm:')}        https://www.npmjs.com/package/${pkg.name}`);
        } else {
          console.log(`${pc.bold(pc.cyan(def.name || name))} ${pc.dim(`[${resolved.source}]`)}`);
          console.log(`  ${def.description || ''}`);
          console.log(`  ${pc.dim('Steps:')} ${def.steps?.length || 0}`);
        }

        // Show inputs
        if (def.inputs && Object.keys(def.inputs).length > 0) {
          console.log();
          console.log(`  ${pc.bold('Inputs:')}`);
          for (const [key, schema] of Object.entries(def.inputs)) {
            const req = schema.required ? pc.red('(required)') : pc.dim(`(default: ${schema.default ?? 'none'})`);
            const desc = schema.description || '';
            console.log(`    ${pc.cyan(key.padEnd(16))} ${(schema.type || 'string').padEnd(8)} ${req}  ${pc.dim(desc)}`);
          }
        }

        console.log();
      } catch (err) {
        console.error(ui.error(err.message));
        process.exit(1);
      }
    });

  // ── workflow create ──
  wfCmd
    .command('create')
    .description('Interactive workflow builder -- scaffold a validated, publish-ready workflow package')
    .option('--from <file>', 'Existing workflow JSON to package')
    .option('--from-description <desc>', 'Generate a workflow skeleton from a text description')
    .option('--name <name>', 'Package name (without vai-workflow- prefix)')
    .option('--author <name>', 'Author name')
    .option('--description <desc>', 'Package description')
    .option('--category <cat>', 'Category (retrieval, analysis, ingestion, domain-specific, utility, integration)')
    .option('--scope <scope>', 'Package scope (e.g. "vaicli" for @vaicli/vai-workflow-*)')
    .option('--output <dir>', 'Output directory')
    .action(async (opts) => {
      const { scaffoldPackage, toPackageName, CATEGORIES } = require('../lib/workflow-scaffold');
      const { loadWorkflow, validateWorkflow, buildExecutionPlan } = require('../lib/workflow');
      const { runInteractiveBuilder, workflowFromDescription } = require('../lib/workflow-builder');

      let definition;
      let name = opts.name;
      let author = opts.author;
      let description = opts.description;
      let category = opts.category;

      if (opts.from) {
        // Package an existing workflow
        try {
          definition = loadWorkflow(opts.from);
        } catch (err) {
          console.error(ui.error(err.message));
          process.exit(1);
        }
        if (!name) {
          name = definition.name || path.basename(opts.from, '.json').replace('.vai-workflow', '');
        }
        if (!description) {
          description = definition.description;
        }
      } else if (opts.fromDescription) {
        // Generate from text description
        try {
          definition = workflowFromDescription(opts.fromDescription);
          name = name || definition.name;
          description = description || definition.description;

          const p = require('@clack/prompts');
          p.intro(pc.bold('Generated workflow from description'));

          // Show what was generated
          p.log.info(`Name: ${pc.cyan(definition.name)}`);
          p.log.info(`Steps: ${definition.steps.map(s => `${pc.cyan(s.id)} (${s.tool})`).join(' -> ')}`);
          p.log.info(`Inputs: ${Object.keys(definition.inputs).join(', ') || 'none'}`);

          // Show execution plan
          try {
            const layers = buildExecutionPlan(definition.steps);
            p.log.info(pc.bold('Execution plan:'));
            for (let i = 0; i < layers.length; i++) {
              p.log.message(`  Layer ${i + 1}: ${layers[i].join(', ')}`);
            }
          } catch (e) { /* skip */ }

          // Validate
          const errors = validateWorkflow(definition);
          if (errors.length > 0) {
            p.log.warn('Validation issues:');
            for (const err of errors) {
              p.log.warn(`  ${err}`);
            }
          } else {
            p.log.success('Workflow validates successfully!');
          }

          // Ask for category if not provided
          if (!category) {
            const { guessCategory, extractTools } = require('../lib/workflow-scaffold');
            category = guessCategory(extractTools(definition));
          }

          // Ask for author if not provided
          if (!author) {
            author = getGitAuthor();
          }

          // Confirm or edit
          const proceed = await p.confirm({ message: 'Scaffold this workflow as a package?', initialValue: true });
          if (p.isCancel(proceed) || !proceed) {
            // Write just the workflow.json for manual editing
            const fs = require('fs');
            const filename = `${definition.name}.vai-workflow.json`;
            fs.writeFileSync(filename, JSON.stringify(definition, null, 2) + '\n');
            p.log.info(`Wrote ${pc.cyan(filename)} for manual editing.`);
            p.outro('Edit the file and run `vai workflow create --from <file>` when ready.');
            return;
          }
        } catch (err) {
          console.error(ui.error(`Generation failed: ${err.message}`));
          process.exit(1);
        }
      } else if (process.stdin.isTTY) {
        // Full interactive builder
        try {
          const result = await runInteractiveBuilder();
          definition = result.definition;
          name = name || result.name;
          description = description || result.description;
          category = category || result.category;
          author = author || result.author;
        } catch (err) {
          if (err.message && err.message.includes('cancelled')) {
            process.exit(0);
          }
          console.error(ui.error(`Interactive mode failed: ${err.message}`));
          process.exit(1);
        }
      } else {
        console.error(ui.error('Provide --from <file>, --from-description "text", or run interactively (TTY required).'));
        process.exit(1);
      }

      if (!name) {
        console.error(ui.error('Workflow name is required. Use --name <name>.'));
        process.exit(1);
      }

      try {
        const result = scaffoldPackage({
          definition,
          name,
          author,
          description,
          category,
          scope: opts.scope,
          outputDir: opts.output,
        });

        const pkgName = toPackageName(name, { scope: opts.scope });
        console.log();
        console.log(`${pc.green('✔')} Created ${pc.cyan(pkgName)}/`);
        for (const f of result.files) {
          console.log(`  ${pc.dim('├──')} ${f}`);
        }
        console.log();
        console.log('Next steps:');
        console.log(`  1. ${opts.from ? 'Review README.md' : `cd ${pkgName} && review workflow.json`}`);
        console.log(`  2. ${pc.dim('vai workflow validate')} ${pkgName}/workflow.json`);
        console.log(`  3. npm publish`);
        console.log();
      } catch (err) {
        console.error(ui.error(err.message));
        process.exit(1);
      }
    });

  // ── workflow init ──
  wfCmd
    .command('init')
    .description('Scaffold a new workflow file')
    .option('--name <name>', 'Workflow name')
    .option('--output <file>', 'Output file path')
    .action((opts) => {
      const fs = require('fs');
      const name = opts.name || 'my-workflow';
      const filename = opts.output || `./${name}.vai-workflow.json`;

      const scaffold = {
        $schema: 'https://vai.dev/schemas/workflow-v1.json',
        name: name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        description: 'TODO: describe what this workflow does',
        version: '1.0.0',
        inputs: {
          query: {
            type: 'string',
            description: 'The search query',
            required: true,
          },
        },
        defaults: {},
        steps: [
          {
            id: 'search',
            name: 'Search knowledge base',
            tool: 'query',
            inputs: {
              query: '{{ inputs.query }}',
              limit: 10,
            },
          },
        ],
        output: {
          results: '{{ search.output.results }}',
          query: '{{ inputs.query }}',
        },
      };

      fs.writeFileSync(filename, JSON.stringify(scaffold, null, 2) + '\n');
      console.log(ui.success(`Created ${filename}`));
      console.log(`  ${pc.dim('Run with:')} vai workflow run ${filename} --input query="your question"`);
      console.log(`  ${pc.dim('Validate:')} vai workflow validate ${filename}`);
    });

  // ── workflow clear-cache [name] ──
  wfCmd
    .command('clear-cache [name]')
    .description('Clear cached workflow inputs (from previous runs)')
    .action((name) => {
      const { clearInputCache, loadInputCache, slugify, CACHE_PATH } = require('../lib/workflow-input-cache');
      const fs = require('fs');

      if (name) {
        const cached = loadInputCache(name);
        const keys = Object.keys(cached);
        if (keys.length === 0) {
          console.log(pc.dim(`No cached inputs for "${name}".`));
          return;
        }
        clearInputCache(name);
        console.log(ui.success(`Cleared cached inputs for "${name}" (${keys.length} field${keys.length === 1 ? '' : 's'}).`));
      } else {
        // Clear all
        let count = 0;
        try {
          const raw = fs.readFileSync(CACHE_PATH, 'utf-8');
          count = Object.keys(JSON.parse(raw)).length;
        } catch { /* no file */ }
        if (count === 0) {
          console.log(pc.dim('No cached workflow inputs.'));
          return;
        }
        clearInputCache();
        console.log(ui.success(`Cleared cached inputs for ${count} workflow${count === 1 ? '' : 's'}.`));
      }
    });
}

/**
 * Summarize step inputs for dry-run display.
 */
function summarizeInputs(inputs) {
  if (!inputs) return '';
  const parts = [];
  for (const [k, v] of Object.entries(inputs)) {
    if (typeof v === 'string' && v.includes('{{')) {
      parts.push(`${k}=<ref>`);
    } else if (typeof v === 'string') {
      parts.push(`${k}=${v.length > 20 ? v.slice(0, 20) + '...' : v}`);
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      parts.push(`${k}=${v}`);
    }
  }
  return parts.join(', ');
}

/**
 * Summarize step output for display.
 */
function summarizeOutput(tool, output) {
  if (!output) return '';
  if (output.results && output.resultCount != null) {
    return `${output.resultCount} results`;
  }
  if (output.insertedCount != null) {
    return `${output.insertedCount} docs inserted`;
  }
  if (output.similarity != null) {
    return `similarity: ${output.similarity.toFixed(4)}`;
  }
  if (output.text) {
    return `${output.text.length} chars`;
  }
  if (output.embedding) {
    return `${output.dimensions}d embedding`;
  }
  if (output.totalCost != null) {
    return `$${output.totalCost}`;
  }
  return '';
}

module.exports = { registerWorkflow, collectInputs };
