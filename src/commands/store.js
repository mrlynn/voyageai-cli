'use strict';

const fs = require('fs');
const { DEFAULT_EMBED_MODEL } = require('../lib/catalog');
const { generateEmbeddings } = require('../lib/api');
const { resolveTextInput } = require('../lib/input');
const { getMongoCollection } = require('../lib/mongo');

/**
 * Register the store command on a Commander program.
 * @param {import('commander').Command} program
 */
function registerStore(program) {
  program
    .command('store')
    .description('Embed text and store in MongoDB Atlas')
    .requiredOption('--db <database>', 'Database name')
    .requiredOption('--collection <name>', 'Collection name')
    .requiredOption('--field <name>', 'Embedding field name')
    .option('--text <text>', 'Text to embed and store')
    .option('-f, --file <path>', 'File to embed and store (text file or .jsonl for batch mode)')
    .option('-m, --model <model>', 'Embedding model', DEFAULT_EMBED_MODEL)
    .option('--input-type <type>', 'Input type: query or document', 'document')
    .option('-d, --dimensions <n>', 'Output dimensions', (v) => parseInt(v, 10))
    .option('--metadata <json>', 'Additional metadata as JSON')
    .option('--json', 'Machine-readable JSON output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(async (opts) => {
      let client;
      try {
        // Batch mode: .jsonl file
        if (opts.file && opts.file.endsWith('.jsonl')) {
          await handleBatchStore(opts);
          return;
        }

        const texts = await resolveTextInput(opts.text, opts.file);
        const textContent = texts[0];

        const embedResult = await generateEmbeddings([textContent], {
          model: opts.model,
          inputType: opts.inputType,
          dimensions: opts.dimensions,
        });

        const embedding = embedResult.data[0].embedding;

        const doc = {
          text: textContent,
          [opts.field]: embedding,
          model: opts.model || DEFAULT_EMBED_MODEL,
          dimensions: embedding.length,
          createdAt: new Date(),
        };

        if (opts.metadata) {
          try {
            const meta = JSON.parse(opts.metadata);
            Object.assign(doc, meta);
          } catch (e) {
            console.error('Error: Invalid metadata JSON. Ensure it is valid JSON.');
            process.exit(1);
          }
        }

        const { client: c, collection } = await getMongoCollection(opts.db, opts.collection);
        client = c;
        const result = await collection.insertOne(doc);

        if (opts.json) {
          console.log(JSON.stringify({
            insertedId: result.insertedId,
            dimensions: embedding.length,
            model: doc.model,
            tokens: embedResult.usage?.total_tokens,
          }, null, 2));
        } else if (!opts.quiet) {
          console.log(`✓ Stored document: ${result.insertedId}`);
          console.log(`  Database:   ${opts.db}`);
          console.log(`  Collection: ${opts.collection}`);
          console.log(`  Field:      ${opts.field}`);
          console.log(`  Dimensions: ${embedding.length}`);
          console.log(`  Model:      ${doc.model}`);
          if (embedResult.usage) {
            console.log(`  Tokens:     ${embedResult.usage.total_tokens}`);
          }
        }
      } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      } finally {
        if (client) await client.close();
      }
    });
}

/**
 * Handle batch store from a .jsonl file.
 * Each line: {"text": "...", "metadata": {...}}
 * @param {object} opts - Command options
 */
async function handleBatchStore(opts) {
  let client;
  try {
    const content = fs.readFileSync(opts.file, 'utf-8').trim();
    const lines = content.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
      console.error('Error: JSONL file is empty.');
      process.exit(1);
    }

    const records = lines.map((line, i) => {
      try {
        return JSON.parse(line);
      } catch (e) {
        console.error(`Error: Invalid JSON on line ${i + 1}: ${e.message}`);
        process.exit(1);
      }
    });

    const texts = records.map(r => {
      if (!r.text) {
        console.error('Error: Each JSONL line must have a "text" field.');
        process.exit(1);
      }
      return r.text;
    });

    if (!opts.quiet) {
      console.log(`Embedding ${texts.length} documents...`);
    }

    const embedResult = await generateEmbeddings(texts, {
      model: opts.model,
      inputType: opts.inputType,
      dimensions: opts.dimensions,
    });

    const docs = records.map((record, i) => {
      const embedding = embedResult.data[i].embedding;
      const doc = {
        text: record.text,
        [opts.field]: embedding,
        model: opts.model || DEFAULT_EMBED_MODEL,
        dimensions: embedding.length,
        createdAt: new Date(),
      };
      if (record.metadata) {
        Object.assign(doc, record.metadata);
      }
      return doc;
    });

    const { client: c, collection } = await getMongoCollection(opts.db, opts.collection);
    client = c;
    const result = await collection.insertMany(docs);

    if (opts.json) {
      console.log(JSON.stringify({
        insertedCount: result.insertedCount,
        insertedIds: result.insertedIds,
        dimensions: docs[0]?.dimensions,
        model: opts.model || DEFAULT_EMBED_MODEL,
        tokens: embedResult.usage?.total_tokens,
      }, null, 2));
    } else if (!opts.quiet) {
      console.log(`✓ Stored ${result.insertedCount} documents`);
      console.log(`  Database:   ${opts.db}`);
      console.log(`  Collection: ${opts.collection}`);
      console.log(`  Field:      ${opts.field}`);
      console.log(`  Dimensions: ${docs[0]?.dimensions}`);
      console.log(`  Model:      ${opts.model || DEFAULT_EMBED_MODEL}`);
      if (embedResult.usage) {
        console.log(`  Tokens:     ${embedResult.usage.total_tokens}`);
      }
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  } finally {
    if (client) await client.close();
  }
}

module.exports = { registerStore };
