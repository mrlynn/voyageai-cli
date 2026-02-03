'use strict';

const fs = require('fs');
const path = require('path');
const { getDefaultModel } = require('../lib/catalog');
const { generateEmbeddings } = require('../lib/api');
const { getMongoCollection } = require('../lib/mongo');
const ui = require('../lib/ui');

/**
 * Detect file format from extension and content.
 * @param {string} filePath
 * @returns {'csv'|'json'|'jsonl'|'text'}
 */
function detectFormat(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.csv') return 'csv';
  if (ext === '.json') return 'json';
  if (ext === '.jsonl' || ext === '.ndjson') return 'jsonl';

  // Try to detect from content
  const content = fs.readFileSync(filePath, 'utf-8');
  const firstLine = content.split('\n').find(l => l.trim());
  if (!firstLine) return 'text';

  // Check for JSON array first (starts with [)
  if (firstLine.trim().startsWith('[')) return 'json';

  try {
    JSON.parse(firstLine);
    return 'jsonl';
  } catch {
    // not JSON per line
  }
  return 'text';
}

/**
 * Parse a CSV line handling quoted fields.
 * @param {string} line
 * @returns {string[]}
 */
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Parse documents from a file.
 * @param {string} filePath
 * @param {string} format
 * @param {object} options
 * @param {string} [options.textField] - JSON/JSONL field for text (default: "text")
 * @param {string} [options.textColumn] - CSV column for text
 * @returns {{documents: object[], textKey: string}}
 */
function parseFile(filePath, format, options = {}) {
  const content = fs.readFileSync(filePath, 'utf-8').trim();
  const textField = options.textField || 'text';

  if (format === 'jsonl') {
    const lines = content.split('\n').filter(l => l.trim());
    const documents = lines.map((line, i) => {
      try {
        return JSON.parse(line);
      } catch (e) {
        throw new Error(`Invalid JSON on line ${i + 1}: ${e.message}`);
      }
    });
    // Validate text field exists
    for (let i = 0; i < documents.length; i++) {
      if (!documents[i][textField]) {
        throw new Error(`Document on line ${i + 1} missing "${textField}" field. Use --text-field to specify the text field.`);
      }
    }
    return { documents, textKey: textField };
  }

  if (format === 'json') {
    let documents;
    try {
      documents = JSON.parse(content);
    } catch (e) {
      throw new Error(`Invalid JSON file: ${e.message}`);
    }
    if (!Array.isArray(documents)) {
      throw new Error('JSON file must contain an array of objects.');
    }
    for (let i = 0; i < documents.length; i++) {
      if (!documents[i][textField]) {
        throw new Error(`Document at index ${i} missing "${textField}" field. Use --text-field to specify the text field.`);
      }
    }
    return { documents, textKey: textField };
  }

  if (format === 'csv') {
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length < 2) {
      throw new Error('CSV file must have a header row and at least one data row.');
    }
    const headers = parseCSVLine(lines[0]);
    const textColumn = options.textColumn;
    if (!textColumn) {
      throw new Error('CSV files require --text-column to specify which column contains the text to embed.');
    }
    const textIndex = headers.indexOf(textColumn);
    if (textIndex === -1) {
      throw new Error(`Column "${textColumn}" not found in CSV headers: ${headers.join(', ')}`);
    }

    const documents = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const doc = {};
      for (let j = 0; j < headers.length; j++) {
        doc[headers[j]] = values[j] !== undefined ? values[j] : '';
      }
      if (!doc[textColumn]) {
        throw new Error(`Row ${i + 1} has empty text column "${textColumn}".`);
      }
      documents.push(doc);
    }
    return { documents, textKey: textColumn };
  }

  // Plain text: one document per non-empty line
  const lines = content.split('\n').filter(l => l.trim());
  const documents = lines.map(line => ({ text: line.trim() }));
  return { documents, textKey: 'text' };
}

/**
 * Rough token estimate (~4 chars per token).
 * @param {string[]} texts
 * @returns {number}
 */
function estimateTokens(texts) {
  const totalChars = texts.reduce((sum, t) => sum + t.length, 0);
  return Math.ceil(totalChars / 4);
}

/**
 * Write a progress bar to stderr.
 * @param {number} current
 * @param {number} total
 * @param {number} batch
 * @param {number} totalBatches
 * @param {number} tokens
 */
function updateProgress(current, total, batch, totalBatches, tokens) {
  const pct = Math.round((current / total) * 100);
  const barLen = 20;
  const filled = Math.round(barLen * current / total);
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barLen - filled);
  const line = `  ${bar} ${current}/${total} (${pct}%) | Batch ${batch}/${totalBatches} | ${tokens.toLocaleString()} tokens`;
  process.stderr.write(`\r${line}`);
}

/**
 * Register the ingest command on a Commander program.
 * @param {import('commander').Command} program
 */
function registerIngest(program) {
  program
    .command('ingest')
    .description('Bulk import documents: read file, embed in batches, store in MongoDB Atlas')
    .requiredOption('--file <path>', 'Input file (JSON, JSONL, CSV, or plain text)')
    .requiredOption('--db <database>', 'Database name')
    .requiredOption('--collection <name>', 'Collection name')
    .requiredOption('--field <name>', 'Embedding field name')
    .option('-m, --model <model>', 'Embedding model', getDefaultModel())
    .option('--input-type <type>', 'Input type: query or document', 'document')
    .option('-d, --dimensions <n>', 'Output dimensions', (v) => parseInt(v, 10))
    .option('--batch-size <n>', 'Documents per batch (default: 50, max: 128)', (v) => parseInt(v, 10), 50)
    .option('--text-column <name>', 'CSV column to embed (required for CSV)')
    .option('--text-field <name>', 'JSON/JSONL field containing text to embed', 'text')
    .option('--dry-run', 'Parse file and show stats without embedding or inserting')
    .option('--strict', 'Abort on first batch error')
    .option('--json', 'Machine-readable JSON output')
    .option('-q, --quiet', 'Suppress progress, show only final summary')
    .action(async (opts) => {
      const startTime = Date.now();

      // Validate file exists
      if (!fs.existsSync(opts.file)) {
        console.error(ui.error(`File not found: ${opts.file}`));
        process.exit(1);
      }

      // Clamp batch size
      if (opts.batchSize > 128) {
        console.error(ui.error('Batch size cannot exceed 128 (Voyage API limit).'));
        process.exit(1);
      }
      if (opts.batchSize < 1) {
        console.error(ui.error('Batch size must be at least 1.'));
        process.exit(1);
      }

      // Detect format
      const format = detectFormat(opts.file);

      // Parse documents
      let documents, textKey;
      try {
        const parsed = parseFile(opts.file, format, {
          textField: opts.textField,
          textColumn: opts.textColumn,
        });
        documents = parsed.documents;
        textKey = parsed.textKey;
      } catch (err) {
        console.error(ui.error(err.message));
        process.exit(1);
      }

      if (documents.length === 0) {
        console.error(ui.error('No documents found in file.'));
        process.exit(1);
      }

      const texts = documents.map(d => d[textKey]);
      const totalBatches = Math.ceil(documents.length / opts.batchSize);

      // Dry run mode
      if (opts.dryRun) {
        const estimated = estimateTokens(texts);
        if (opts.json) {
          console.log(JSON.stringify({
            dryRun: true,
            format,
            documents: documents.length,
            batches: totalBatches,
            batchSize: opts.batchSize,
            estimatedTokens: estimated,
            model: opts.model,
            textField: textKey,
          }, null, 2));
        } else {
          console.log(ui.info('Dry run — no embeddings generated, nothing inserted.\n'));
          console.log(ui.label('File', opts.file));
          console.log(ui.label('Format', format));
          console.log(ui.label('Documents', String(documents.length)));
          console.log(ui.label('Batches', `${totalBatches} (batch size: ${opts.batchSize})`));
          console.log(ui.label('Est. tokens', `~${estimated.toLocaleString()}`));
          console.log(ui.label('Model', opts.model));
          console.log(ui.label('Text field', textKey));
          console.log(ui.label('Target', `${opts.db}.${opts.collection}`));
          console.log(ui.label('Embed field', opts.field));
        }
        return;
      }

      // Real ingest
      let client;
      try {
        const { client: c, collection } = await getMongoCollection(opts.db, opts.collection);
        client = c;

        let totalTokens = 0;
        let succeeded = 0;
        let failed = 0;
        const errors = [];

        if (!opts.quiet && !opts.json) {
          process.stderr.write('Ingesting documents...\n');
        }

        for (let i = 0; i < documents.length; i += opts.batchSize) {
          const batchNum = Math.floor(i / opts.batchSize) + 1;
          const batch = documents.slice(i, i + opts.batchSize);
          const batchTexts = batch.map(d => d[textKey]);

          try {
            const embedResult = await generateEmbeddings(batchTexts, {
              model: opts.model,
              inputType: opts.inputType,
              dimensions: opts.dimensions,
            });

            // Attach embeddings to documents
            for (let j = 0; j < batch.length; j++) {
              batch[j][opts.field] = embedResult.data[j].embedding;
              batch[j].model = opts.model;
              batch[j].dimensions = embedResult.data[j].embedding.length;
              batch[j].ingestedAt = new Date();
            }

            // Insert batch into MongoDB
            await collection.insertMany(batch);

            totalTokens += embedResult.usage?.total_tokens || 0;
            succeeded += batch.length;
          } catch (err) {
            failed += batch.length;
            errors.push({ batch: batchNum, error: err.message });

            if (opts.strict) {
              if (!opts.quiet && !opts.json) {
                process.stderr.write('\n');
              }
              console.error(ui.error(`Batch ${batchNum} failed: ${err.message}`));
              console.error(ui.error('Aborting (--strict mode).'));
              process.exit(1);
            }

            if (!opts.quiet && !opts.json) {
              process.stderr.write(`\n${ui.warn(`Batch ${batchNum} failed: ${err.message}`)}\n`);
            }
          }

          // Update progress
          if (!opts.quiet && !opts.json) {
            updateProgress(
              Math.min(i + opts.batchSize, documents.length),
              documents.length,
              batchNum,
              totalBatches,
              totalTokens
            );
          }
        }

        // Clear progress line
        if (!opts.quiet && !opts.json) {
          process.stderr.write('\n');
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate = (succeeded / (duration > 0 ? duration : 1)).toFixed(1);

        if (opts.json) {
          const summary = {
            succeeded,
            failed,
            total: documents.length,
            database: opts.db,
            collection: opts.collection,
            batches: totalBatches,
            tokens: totalTokens,
            model: opts.model,
            durationSeconds: parseFloat(duration),
            docsPerSecond: parseFloat(rate),
          };
          if (errors.length > 0) {
            summary.errors = errors;
          }
          console.log(JSON.stringify(summary, null, 2));
        } else {
          if (failed === 0) {
            console.log(ui.success(`Ingested ${succeeded} documents into ${opts.db}.${opts.collection}`));
          } else {
            console.log(ui.warn(`Ingested ${succeeded} of ${documents.length} documents into ${opts.db}.${opts.collection} (${failed} failed)`));
          }
          console.log(ui.label('Batches', String(totalBatches)));
          console.log(ui.label('Tokens', totalTokens.toLocaleString()));
          console.log(ui.label('Model', opts.model));
          console.log(ui.label('Duration', `${duration}s`));
          console.log(ui.label('Rate', `${rate} docs/sec`));
          if (errors.length > 0) {
            console.log('');
            console.log(ui.warn(`${errors.length} batch(es) failed:`));
            for (const e of errors) {
              console.log(`  Batch ${e.batch}: ${e.error}`);
            }
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

module.exports = {
  registerIngest,
  // Exported for testing
  detectFormat,
  parseFile,
  parseCSVLine,
  estimateTokens,
  updateProgress,
};
