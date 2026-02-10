'use strict';

const fs = require('fs');
const path = require('path');
const p = require('@clack/prompts');
const { loadProject } = require('../lib/project');
const { connect, close } = require('../lib/mongo');
const ui = require('../lib/ui');

/**
 * Build a MongoDB filter from the provided criteria.
 */
function buildFilter(options) {
  const conditions = [];

  // Filter by source pattern (glob-like)
  if (options.source) {
    // Convert glob pattern to regex
    const pattern = options.source
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    conditions.push({ 'metadata.source': { $regex: pattern } });
  }

  // Filter by embedded date
  if (options.before) {
    const date = new Date(options.before);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date format: ${options.before}`);
    }
    conditions.push({ _embeddedAt: { $lt: date } });
  }

  // Filter by model
  if (options.model) {
    conditions.push({ _model: options.model });
  }

  // Raw MongoDB filter
  if (options.filter) {
    try {
      const rawFilter = JSON.parse(options.filter);
      conditions.push(rawFilter);
    } catch (err) {
      throw new Error(`Invalid JSON filter: ${err.message}`);
    }
  }

  // Combine conditions with $and
  if (conditions.length === 0) {
    return {};
  } else if (conditions.length === 1) {
    return conditions[0];
  } else {
    return { $and: conditions };
  }
}

/**
 * Check which documents have stale source files (file no longer exists on disk).
 */
async function findStaleDocuments(collection, baseDir) {
  const docs = await collection.find({ 'metadata.source': { $exists: true } }).toArray();
  const staleIds = [];

  for (const doc of docs) {
    const source = doc.metadata?.source;
    if (source) {
      // Resolve relative to baseDir or treat as absolute
      const filePath = path.isAbsolute(source) ? source : path.join(baseDir, source);
      if (!fs.existsSync(filePath)) {
        staleIds.push(doc._id);
      }
    }
  }

  return staleIds;
}

/**
 * Format a sample of documents for display.
 */
function formatSample(docs, limit = 5) {
  const sample = docs.slice(0, limit);
  return sample.map(doc => {
    const source = doc.metadata?.source || doc._id?.toString() || 'unknown';
    const model = doc._model || 'unknown';
    const date = doc._embeddedAt ? new Date(doc._embeddedAt).toISOString().split('T')[0] : 'unknown';
    return `  • ${source} (model: ${model}, date: ${date})`;
  }).join('\n');
}

/**
 * Execute the purge command.
 */
async function purge(options = {}) {
  const quiet = options.quiet || options.json;

  // Load project config
  const project = loadProject();
  const db = options.db || project.db || process.env.VAI_DB || 'vai';
  const collectionName = options.collection || project.collection || process.env.VAI_COLLECTION || 'embeddings';

  if (!quiet) {
    p.intro(ui.title('vai purge'));
  }

  // Validate that at least one filter is provided
  if (!options.source && !options.before && !options.model && !options.filter && !options.stale) {
    if (options.json) {
      console.log(JSON.stringify({ error: 'No filter criteria provided. Use --source, --before, --model, --filter, or --stale.' }));
    } else {
      p.log.error('No filter criteria provided.');
      p.log.info('Use --source, --before, --model, --filter, or --stale to specify what to purge.');
    }
    return { success: false, error: 'No filter criteria' };
  }

  let client;
  try {
    // Connect to MongoDB
    if (!quiet) {
      p.log.step(`Connecting to database: ${db}`);
    }
    client = await connect(db);
    const collection = client.db(db).collection(collectionName);

    let filter = {};
    let staleIds = [];

    if (options.stale) {
      // Find documents with stale source files
      if (!quiet) {
        p.log.step('Scanning for stale documents (source files that no longer exist)...');
      }
      const baseDir = project.root || process.cwd();
      staleIds = await findStaleDocuments(collection, baseDir);
      
      if (staleIds.length === 0) {
        if (options.json) {
          console.log(JSON.stringify({ success: true, count: 0, message: 'No stale documents found' }));
        } else {
          p.log.success('No stale documents found.');
          p.outro('Nothing to purge.');
        }
        return { success: true, count: 0 };
      }
      
      filter = { _id: { $in: staleIds } };
    } else {
      // Build filter from criteria
      filter = buildFilter(options);
    }

    // Count matching documents
    const count = options.stale ? staleIds.length : await collection.countDocuments(filter);

    if (count === 0) {
      if (options.json) {
        console.log(JSON.stringify({ success: true, count: 0, message: 'No matching documents found' }));
      } else {
        p.log.success('No matching documents found.');
        p.outro('Nothing to purge.');
      }
      return { success: true, count: 0 };
    }

    // Get sample for display
    const sampleDocs = await collection.find(filter).limit(5).toArray();

    if (options.json) {
      if (options.dryRun) {
        console.log(JSON.stringify({
          dryRun: true,
          count,
          sample: sampleDocs.map(d => ({
            id: d._id?.toString(),
            source: d.metadata?.source,
            model: d._model,
            embeddedAt: d._embeddedAt,
          })),
        }));
        return { success: true, dryRun: true, count };
      }
    } else {
      // Show what will be deleted
      p.log.warn(`Found ${count} document${count === 1 ? '' : 's'} matching criteria:`);
      console.log(formatSample(sampleDocs));
      if (count > 5) {
        console.log(`  ... and ${count - 5} more`);
      }
      console.log();
    }

    // Dry run - stop here
    if (options.dryRun) {
      if (!quiet) {
        p.log.info('Dry run - no documents deleted.');
        p.outro(`Would delete ${count} document${count === 1 ? '' : 's'}.`);
      }
      return { success: true, dryRun: true, count };
    }

    // Confirm unless --force
    if (!options.force && !options.json) {
      const confirmed = await p.confirm({
        message: `Delete ${count} document${count === 1 ? '' : 's'}? This cannot be undone.`,
        initialValue: false,
      });

      if (p.isCancel(confirmed) || !confirmed) {
        p.log.info('Purge cancelled.');
        p.outro('No documents deleted.');
        return { success: false, cancelled: true };
      }
    }

    // Delete documents
    if (!quiet) {
      p.log.step('Deleting documents...');
    }
    
    const result = await collection.deleteMany(filter);
    const deleted = result.deletedCount;

    if (options.json) {
      console.log(JSON.stringify({ success: true, deleted }));
    } else {
      p.log.success(`Deleted ${deleted} document${deleted === 1 ? '' : 's'}.`);
      p.outro('Purge complete.');
    }

    return { success: true, deleted };

  } catch (err) {
    if (options.json) {
      console.log(JSON.stringify({ error: err.message }));
    } else {
      p.log.error(`Purge failed: ${err.message}`);
    }
    return { success: false, error: err.message };
  } finally {
    if (client) {
      await close();
    }
  }
}

/**
 * Register the purge command with Commander.
 */
function register(program) {
  program
    .command('purge')
    .description('Remove embeddings from MongoDB based on criteria')
    .option('--db <database>', 'Database name')
    .option('--collection <name>', 'Collection name')
    .option('--source <glob>', 'Filter by metadata.source pattern')
    .option('--before <date>', 'Filter by _embeddedAt before date (ISO 8601)')
    .option('-m, --model <model>', 'Filter by _model field')
    .option('--filter <json>', 'Raw MongoDB filter (JSON)')
    .option('--stale', 'Remove docs whose source files no longer exist')
    .option('--force', 'Skip confirmation prompt')
    .option('--dry-run', 'Show what would be deleted without acting')
    .option('--json', 'Machine-readable output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(purge);
}

module.exports = { register, purge, buildFilter };
