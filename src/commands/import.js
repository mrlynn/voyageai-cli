'use strict';

const fs = require('fs');
const path = require('path');
const ui = require('../lib/ui');
const { validateWorkflow } = require('../lib/workflow');

/**
 * Register the import command on a Commander program.
 * @param {import('commander').Command} program
 */
function registerImport(program) {
  program
    .command('import <file>')
    .description('Import a workflow definition or chat session exported by vai')
    .option('--type <type>', 'Force type: workflow or chat (auto-detected if omitted)')
    .option('--db <name>', 'Target database (for chat import)')
    .option('--collection <name>', 'Target collection (for chat import)')
    .option('--dry-run', 'Show what would be imported without writing')
    .option('--json', 'Machine-readable JSON output')
    .action(async (file, opts) => {
      try {
        const resolved = path.resolve(file);
        if (!fs.existsSync(resolved)) {
          throw new Error(`File not found: ${resolved}`);
        }

        const raw = fs.readFileSync(resolved, 'utf-8');
        const data = JSON.parse(raw);

        // Auto-detect type
        const type = opts.type || detectType(data);
        if (!type) {
          throw new Error(
            'Could not auto-detect import type. Use --type workflow or --type chat.'
          );
        }

        if (type === 'workflow') {
          await importWorkflow(data, opts, resolved);
        } else if (type === 'chat') {
          await importChat(data, opts, resolved);
        } else {
          throw new Error(`Unknown import type: "${type}". Use "workflow" or "chat".`);
        }
      } catch (err) {
        if (opts.json) {
          console.log(JSON.stringify({ error: err.message }));
        } else {
          console.error(ui.error ? ui.error(err.message) : `✗ ${err.message}`);
        }
        process.exitCode = 1;
      }
    });
}

/**
 * Detect whether the JSON is a workflow or chat session.
 */
function detectType(data) {
  // Workflow: has steps array
  if (Array.isArray(data.steps) && data.steps.length > 0) return 'workflow';
  // Chat: has turns or session object with turns
  if (data.turns || (data.session && data.session.turns)) return 'chat';
  // Exported chat wrapper
  if (data._context === 'chat') return 'chat';
  if (data._context === 'workflow') return 'workflow';
  // Workflow with name + steps
  if (data.name && data.steps) return 'workflow';
  return null;
}

/**
 * Import a workflow definition.
 */
async function importWorkflow(data, opts, filePath) {
  // Strip export metadata
  const workflow = { ...data };
  delete workflow._exportMeta;
  delete workflow._metadata;
  delete workflow._execution;
  delete workflow._context;
  delete workflow._dependencyMap;
  delete workflow._executionLayers;

  // Validate
  const errors = validateWorkflow(workflow);
  if (errors.length > 0) {
    throw new Error(`Invalid workflow:\n  ${errors.join('\n  ')}`);
  }

  const stepCount = (workflow.steps || []).length;
  const inputCount = Object.keys(workflow.inputs || {}).length;

  if (opts.dryRun) {
    const summary = {
      type: 'workflow',
      name: workflow.name,
      version: workflow.version,
      steps: stepCount,
      inputs: inputCount,
      valid: true,
    };
    if (opts.json) {
      console.log(JSON.stringify({ dryRun: true, ...summary }));
    } else {
      console.log(ui.success ? ui.success('Dry run — workflow is valid') : '✓ Dry run — workflow is valid');
      console.log(`  Name: ${workflow.name}`);
      console.log(`  Version: ${workflow.version || '—'}`);
      console.log(`  Steps: ${stepCount}`);
      console.log(`  Inputs: ${inputCount}`);
    }
    return;
  }

  // Write cleaned workflow to a local file
  const outName = `${workflow.name || 'imported-workflow'}.json`;
  const outPath = path.resolve(outName);
  fs.writeFileSync(outPath, JSON.stringify(workflow, null, 2) + '\n', 'utf-8');

  if (opts.json) {
    console.log(JSON.stringify({ imported: true, type: 'workflow', path: outPath, steps: stepCount }));
  } else {
    console.log(ui.success ? ui.success(`Imported workflow → ${outPath}`) : `✓ Imported workflow → ${outPath}`);
    console.log(`  Name: ${workflow.name}  |  Steps: ${stepCount}  |  Inputs: ${inputCount}`);
    console.log(`  Run with: vai workflow run ${outName}`);
  }
}

/**
 * Import a chat session into MongoDB.
 */
async function importChat(data, opts, filePath) {
  // Unwrap export format
  const session = data.session || data;
  const turns = session.turns || [];

  if (turns.length === 0) {
    throw new Error('Chat session has no turns to import.');
  }

  const summary = {
    type: 'chat',
    sessionId: session.sessionId || session.id,
    turns: turns.length,
    provider: session.provider,
    model: session.model,
  };

  if (opts.dryRun) {
    if (opts.json) {
      console.log(JSON.stringify({ dryRun: true, ...summary }));
    } else {
      console.log(ui.success ? ui.success('Dry run — chat session is valid') : '✓ Dry run — chat session is valid');
      console.log(`  Session: ${summary.sessionId || '—'}`);
      console.log(`  Turns: ${summary.turns}`);
      console.log(`  Provider: ${summary.provider || '—'} (${summary.model || '—'})`);
    }
    return;
  }

  // Import to MongoDB
  const dbName = opts.db || 'vai';
  const collName = opts.collection || 'chat_history';

  const { getMongoCollection } = require('../lib/mongo');
  const { client, collection } = await getMongoCollection(dbName, collName);

  try {
    const docs = turns.map((turn, i) => ({
      sessionId: session.sessionId || session.id || `imported-${Date.now()}`,
      role: turn.role,
      content: turn.content,
      timestamp: turn.timestamp ? new Date(turn.timestamp) : new Date(),
      ...(turn.context ? { context: turn.context } : {}),
      ...(turn.metadata ? { metadata: turn.metadata } : {}),
      _imported: true,
      _importedAt: new Date(),
      _importSource: path.basename(filePath),
    }));

    const result = await collection.insertMany(docs);

    if (opts.json) {
      console.log(JSON.stringify({ imported: true, ...summary, inserted: result.insertedCount, db: dbName, collection: collName }));
    } else {
      console.log(ui.success ? ui.success(`Imported ${result.insertedCount} turns → ${dbName}.${collName}`) : `✓ Imported ${result.insertedCount} turns → ${dbName}.${collName}`);
      console.log(`  Session: ${summary.sessionId || '—'}  |  Provider: ${summary.provider || '—'}`);
    }
  } finally {
    await client.close();
  }
}

module.exports = { registerImport, detectType };
