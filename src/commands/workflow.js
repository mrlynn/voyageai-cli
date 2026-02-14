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

  const allSteps = buildInputSteps(definition);
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

        // Output
        if (opts.json) {
          console.log(JSON.stringify(result.output, null, 2));
        } else if (result.output) {
          // Pretty-print top results if they exist
          const output = result.output;
          if (output.results && Array.isArray(output.results)) {
            const top = output.results.slice(0, 5);
            console.log(pc.bold('Top results:'));
            for (let i = 0; i < top.length; i++) {
              const r = top[i];
              const source = r.source || r.text?.slice(0, 50) || `result ${i + 1}`;
              const score = r.score != null ? ` (${r.score.toFixed(2)})` : '';
              console.log(`  ${pc.dim(`[${i + 1}]`)} ${source}${pc.dim(score)}`);
            }
          } else if (output.summary) {
            console.log(output.summary);
          } else if (output.comparison) {
            console.log(pc.bold('Cost comparison:'));
            for (const item of output.comparison) {
              if (item && item.model) {
                console.log(`  ${pc.cyan(item.model)}: $${item.totalCost} total (embed: $${item.embeddingCost}, queries: $${item.monthlyQueryCost}/mo)`);
              }
            }
          } else {
            console.log(JSON.stringify(output, null, 2));
          }
        }
      } catch (err) {
        console.error(ui.error(err.message));
        if (opts.verbose) {
          console.error(pc.dim(err.stack));
        }
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

      console.log(`Installing ${pc.cyan(packageName)}...`);

      try {
        const result = installPackage(packageName, { global: opts.global });
        console.log(`${pc.green('✔')} Downloaded ${pc.cyan(packageName)}@${result.version}`);

        // Validate
        if (result.path) {
          const validation = validatePackage(result.path);
          if (validation.errors.length === 0) {
            const steps = validation.definition?.steps?.length || 0;
            const tools = (validation.pkg?.vai?.tools || []).join(', ');
            console.log(`${pc.green('✔')} Validated workflow definition (${steps} steps${tools ? `, tools: ${tools}` : ''})`);
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

      console.log(`Searching npm for vai-workflow packages matching "${query}"...`);
      console.log();

      try {
        const results = await searchNpm(query, { limit: parseInt(opts.limit, 10) });

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
    .description('Scaffold a publish-ready npm package from a workflow')
    .option('--from <file>', 'Existing workflow JSON to package')
    .option('--name <name>', 'Package name (without vai-workflow- prefix)')
    .option('--author <name>', 'Author name')
    .option('--description <desc>', 'Package description')
    .option('--category <cat>', 'Category (retrieval, analysis, ingestion, domain-specific, utility, integration)')
    .option('--scope <scope>', 'Package scope (e.g. "vaicli" for @vaicli/vai-workflow-*)')
    .option('--output <dir>', 'Output directory')
    .action(async (opts) => {
      const { scaffoldPackage, toPackageName, CATEGORIES, emptyWorkflowTemplate } = require('../lib/workflow-scaffold');
      const { loadWorkflow } = require('../lib/workflow');

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
      } else if (process.stdin.isTTY) {
        // Interactive mode
        try {
          const p = require('@clack/prompts');
          p.intro(pc.bold('Create a new workflow package'));

          const answers = await p.group({
            name: () => p.text({ message: 'Workflow name', placeholder: 'my-workflow', validate: v => v ? undefined : 'Required' }),
            description: () => p.text({ message: 'Description', placeholder: 'A brief description of what this workflow does' }),
            category: () => p.select({
              message: 'Category',
              options: CATEGORIES.map(c => ({ value: c, label: c })),
            }),
            author: () => p.text({ message: 'Author', placeholder: 'Your Name', defaultValue: getGitAuthor() }),
          });

          if (p.isCancel(answers)) {
            p.cancel('Cancelled.');
            process.exit(0);
          }

          name = answers.name;
          description = answers.description;
          category = answers.category;
          author = answers.author;
          definition = emptyWorkflowTemplate();
          definition.name = name;
          definition.description = description || '';
          // Add a placeholder step so validation passes
          definition.steps = [{
            id: 'search',
            tool: 'query',
            name: 'Search',
            inputs: { query: '{{ inputs.query }}' },
          }];
          definition.inputs = {
            query: { type: 'string', required: true, description: 'Search query' },
          };
        } catch (err) {
          console.error(ui.error(`Interactive mode failed: ${err.message}`));
          process.exit(1);
        }
      } else {
        console.error(ui.error('Provide --from <file> or run interactively (TTY required).'));
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
        console.log(`  1. ${opts.from ? '' : pc.dim('Edit workflow.json with your workflow definition')}${opts.from ? 'Review README.md' : ''}`);
        console.log(`  2. cd ${pkgName}`);
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
