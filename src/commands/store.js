'use strict';

const fs = require('fs');
const { getDefaultModel } = require('../lib/catalog');
const { generateEmbeddings } = require('../lib/api');
const { resolveTextInput } = require('../lib/input');
const { getMongoCollection } = require('../lib/mongo');
const ui = require('../lib/ui');

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
    .option('-m, --model <model>', 'Embedding model', getDefaultModel())
    .option('--input-type <type>', 'Input type: query or document', 'document')
    .option('-d, --dimensions <n>', 'Output dimensions', (v) => parseInt(v, 10))
    .option('--output-dtype <type>', 'Output data type: float, int8, uint8, binary, ubinary', 'float')
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

        const useColor = !opts.json;
        const useSpinner = useColor && !opts.quiet;
        let spin;
        if (useSpinner) {
          spin = ui.spinner('Embedding and storing...');
          spin.start();
        }

        const embedOpts = {
          model: opts.model,
          inputType: opts.inputType,
          dimensions: opts.dimensions,
        };
        if (opts.outputDtype && opts.outputDtype !== 'float') {
          embedOpts.outputDtype = opts.outputDtype;
        }
        const embedResult = await generateEmbeddings([textContent], embedOpts);

        const embedding = embedResult.data[0].embedding;

        const doc = {
          text: textContent,
          [opts.field]: embedding,
          model: opts.model || getDefaultModel(),
          dimensions: embedding.length,
          createdAt: new Date(),
        };

        if (opts.metadata) {
          try {
            const meta = JSON.parse(opts.metadata);
            Object.assign(doc, meta);
          } catch (e) {
            if (spin) spin.stop();
            console.error(ui.error('Invalid metadata JSON. Ensure it is valid JSON.'));
            process.exit(1);
          }
        }

        const { client: c, collection } = await getMongoCollection(opts.db, opts.collection);
        client = c;
        const result = await collection.insertOne(doc);

        if (spin) spin.stop();

        if (opts.json) {
          console.log(JSON.stringify({
            insertedId: result.insertedId,
            dimensions: embedding.length,
            model: doc.model,
            tokens: embedResult.usage?.total_tokens,
          }, null, 2));
        } else if (!opts.quiet) {
          console.log(ui.success('Stored document: ' + ui.cyan(String(result.insertedId))));
          console.log(ui.label('Database', opts.db));
          console.log(ui.label('Collection', opts.collection));
          console.log(ui.label('Field', opts.field));
          console.log(ui.label('Dimensions', String(embedding.length)));
          console.log(ui.label('Model', doc.model));
          if (embedResult.usage) {
            console.log(ui.label('Tokens', String(embedResult.usage.total_tokens)));
          }
        }
      } catch (err) {
        console.error(ui.error(err.message));
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
      console.error(ui.error('JSONL file is empty.'));
      process.exit(1);
    }

    const records = lines.map((line, i) => {
      try {
        return JSON.parse(line);
      } catch (e) {
        console.error(ui.error(`Invalid JSON on line ${i + 1}: ${e.message}`));
        process.exit(1);
      }
    });

    const texts = records.map(r => {
      if (!r.text) {
        console.error(ui.error('Each JSONL line must have a "text" field.'));
        process.exit(1);
      }
      return r.text;
    });

    const useColor = !opts.json;
    const useSpinner = useColor && !opts.quiet;
    let spin;
    if (useSpinner) {
      spin = ui.spinner(`Embedding and storing ${texts.length} documents...`);
      spin.start();
    }

    const batchEmbedOpts = {
      model: opts.model,
      inputType: opts.inputType,
      dimensions: opts.dimensions,
    };
    if (opts.outputDtype && opts.outputDtype !== 'float') {
      batchEmbedOpts.outputDtype = opts.outputDtype;
    }
    const embedResult = await generateEmbeddings(texts, batchEmbedOpts);

    const docs = records.map((record, i) => {
      const embedding = embedResult.data[i].embedding;
      const doc = {
        text: record.text,
        [opts.field]: embedding,
        model: opts.model || getDefaultModel(),
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
    // insertMany: because life's too short for one document at a time.
    // This is the MongoDB equivalent of "I'll have what everyone's having."
    const result = await collection.insertMany(docs);

    if (spin) spin.stop();

    if (opts.json) {
      console.log(JSON.stringify({
        insertedCount: result.insertedCount,
        insertedIds: result.insertedIds,
        dimensions: docs[0]?.dimensions,
        model: opts.model || getDefaultModel(),
        tokens: embedResult.usage?.total_tokens,
      }, null, 2));
    } else if (!opts.quiet) {
      console.log(ui.success(`Stored ${result.insertedCount} documents`));
      console.log(ui.label('Database', opts.db));
      console.log(ui.label('Collection', opts.collection));
      console.log(ui.label('Field', opts.field));
      console.log(ui.label('Dimensions', String(docs[0]?.dimensions)));
      console.log(ui.label('Model', opts.model || getDefaultModel()));
      if (embedResult.usage) {
        console.log(ui.label('Tokens', String(embedResult.usage.total_tokens)));
      }
    }
  } catch (err) {
    console.error(ui.error(err.message));
    process.exit(1);
  } finally {
    if (client) await client.close();
  }
}

module.exports = { registerStore };
