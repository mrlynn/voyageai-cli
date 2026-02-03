'use strict';

const { getDefaultDimensions } = require('../lib/catalog');
const { getMongoCollection } = require('../lib/mongo');

/**
 * Register the index command (with create, list, delete subcommands) on a Commander program.
 * @param {import('commander').Command} program
 */
function registerIndex(program) {
  const indexCmd = program
    .command('index')
    .description('Manage Atlas Vector Search indexes');

  // ── index create ──
  indexCmd
    .command('create')
    .description('Create a vector search index')
    .requiredOption('--db <database>', 'Database name')
    .requiredOption('--collection <name>', 'Collection name')
    .requiredOption('--field <name>', 'Embedding field name')
    .option('-d, --dimensions <n>', 'Vector dimensions', (v) => parseInt(v, 10), getDefaultDimensions())
    .option('-s, --similarity <type>', 'Similarity function: cosine, dotProduct, euclidean', 'cosine')
    .option('-n, --index-name <name>', 'Index name', 'default')
    .option('--json', 'Machine-readable JSON output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(async (opts) => {
      let client;
      try {
        const { client: c, collection } = await getMongoCollection(opts.db, opts.collection);
        client = c;

        const indexDef = {
          name: opts.indexName,
          type: 'vectorSearch',
          definition: {
            fields: [
              {
                type: 'vector',
                path: opts.field,
                numDimensions: parseInt(opts.dimensions, 10) || getDefaultDimensions(),
                similarity: opts.similarity,
              },
            ],
          },
        };

        const result = await collection.createSearchIndex(indexDef);

        if (opts.json) {
          console.log(JSON.stringify({ indexName: result, definition: indexDef }, null, 2));
        } else if (!opts.quiet) {
          console.log(`✓ Vector search index created: "${result}"`);
          console.log(`  Database:   ${opts.db}`);
          console.log(`  Collection: ${opts.collection}`);
          console.log(`  Field:      ${opts.field}`);
          console.log(`  Dimensions: ${opts.dimensions}`);
          console.log(`  Similarity: ${opts.similarity}`);
          console.log('');
          console.log('Note: Index may take a few minutes to become ready.');
        }
      } catch (err) {
        if (err.message && err.message.includes('already exists')) {
          console.error(`Error: Index "${opts.indexName}" already exists on ${opts.db}.${opts.collection}`);
          console.error('Use a different --index-name or delete the existing index first.');
        } else {
          console.error(`Error: ${err.message}`);
        }
        process.exit(1);
      } finally {
        if (client) await client.close();
      }
    });

  // ── index list ──
  indexCmd
    .command('list')
    .description('List all search indexes on a collection')
    .requiredOption('--db <database>', 'Database name')
    .requiredOption('--collection <name>', 'Collection name')
    .option('--json', 'Machine-readable JSON output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(async (opts) => {
      let client;
      try {
        const { client: c, collection } = await getMongoCollection(opts.db, opts.collection);
        client = c;

        const indexes = await collection.listSearchIndexes().toArray();

        if (opts.json) {
          console.log(JSON.stringify(indexes, null, 2));
          return;
        }

        if (indexes.length === 0) {
          console.log(`No search indexes found on ${opts.db}.${opts.collection}`);
          return;
        }

        if (!opts.quiet) {
          console.log(`Search indexes on ${opts.db}.${opts.collection}:`);
          console.log('');
        }

        for (const idx of indexes) {
          console.log(`  Name:   ${idx.name}`);
          console.log(`  Type:   ${idx.type || 'N/A'}`);
          console.log(`  Status: ${idx.status || 'N/A'}`);
          if (idx.latestDefinition) {
            console.log(`  Fields: ${JSON.stringify(idx.latestDefinition.fields || [])}`);
          }
          console.log('');
        }
      } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      } finally {
        if (client) await client.close();
      }
    });

  // ── index delete ──
  indexCmd
    .command('delete')
    .description('Drop a search index')
    .requiredOption('--db <database>', 'Database name')
    .requiredOption('--collection <name>', 'Collection name')
    .requiredOption('-n, --index-name <name>', 'Index name to delete')
    .option('--json', 'Machine-readable JSON output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(async (opts) => {
      let client;
      try {
        const { client: c, collection } = await getMongoCollection(opts.db, opts.collection);
        client = c;

        await collection.dropSearchIndex(opts.indexName);

        if (opts.json) {
          console.log(JSON.stringify({ dropped: opts.indexName }, null, 2));
        } else if (!opts.quiet) {
          console.log(`✓ Dropped search index: "${opts.indexName}"`);
          console.log(`  Database:   ${opts.db}`);
          console.log(`  Collection: ${opts.collection}`);
        }
      } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      } finally {
        if (client) await client.close();
      }
    });
}

module.exports = { registerIndex };
