'use strict';

const pc = require('picocolors');
const ui = require('../lib/ui');

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
    .action(async (file, opts) => {
      const { loadWorkflow, executeWorkflow, buildExecutionPlan, validateWorkflow } = require('../lib/workflow');

      let definition;
      try {
        definition = loadWorkflow(file);
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
    .description('List built-in workflow templates')
    .action(() => {
      const { listBuiltinWorkflows } = require('../lib/workflow');

      const workflows = listBuiltinWorkflows();
      if (workflows.length === 0) {
        console.log(pc.dim('No built-in workflows found.'));
        return;
      }

      console.log();
      console.log(pc.bold('Built-in workflow templates:'));
      console.log();
      for (const wf of workflows) {
        console.log(`  ${pc.cyan(wf.name.padEnd(28))} ${wf.description}`);
      }
      console.log();
      console.log(pc.dim('Run with: vai workflow run <name> --input key=value'));
      console.log();
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
