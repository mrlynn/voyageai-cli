'use strict';

let p;
function clack() { if (!p) p = require('@clack/prompts'); return p; }
const { loadProject, saveProject } = require('../lib/project');
const { connect, close } = require('../lib/mongo');
const { generateEmbeddings } = require('../lib/api');
const { chunkText } = require('../lib/chunker');
const ui = require('../lib/ui');

/**
 * Process documents in batches.
 */
async function processBatch(docs, embedder, options) {
  const texts = docs.map(d => d.text);
  const embeddings = await embedder(texts);
  
  return docs.map((doc, i) => ({
    ...doc,
    [options.field]: embeddings[i],
    _model: options.model,
    _embeddedAt: new Date(),
  }));
}

/**
 * Re-chunk a document's text.
 */
function rechunkDocument(doc, options) {
  const text = doc.text || doc.content || '';
  if (!text) return [doc];

  const chunks = chunkText(text, {
    strategy: options.strategy || 'recursive',
    chunkSize: options.chunkSize || 512,
    overlap: options.overlap || 50,
  });

  return chunks.map((chunk, i) => ({
    ...doc,
    text: chunk.text,
    _chunkIndex: i,
    _chunkCount: chunks.length,
    metadata: {
      ...doc.metadata,
      chunkIndex: i,
      chunkCount: chunks.length,
      originalId: doc._id?.toString(),
    },
  }));
}

/**
 * Execute the refresh command.
 */
async function refresh(options = {}) {
  clack(); // lazy-load @clack/prompts
  const quiet = options.quiet || options.json;

  // Load project config
  const project = loadProject();
  const db = options.db || project.db || process.env.VAI_DB || 'vai';
  const collectionName = options.collection || project.collection || process.env.VAI_COLLECTION || 'embeddings';
  const field = options.field || project.field || 'embedding';
  const model = options.model || project.model || 'voyage-3.5-lite';
  const dimensions = options.dimensions || project.dimensions;
  const batchSize = options.batchSize || 25;

  if (!quiet) {
    p.intro(ui.title('vai refresh'));
  }

  let client;
  try {
    // Connect to MongoDB
    if (!quiet) {
      p.log.step(`Connecting to database: ${db}`);
    }
    client = await connect(db);
    const collection = client.db(db).collection(collectionName);

    // Build filter
    let filter = {};
    if (options.filter) {
      try {
        filter = JSON.parse(options.filter);
      } catch (err) {
        throw new Error(`Invalid JSON filter: ${err.message}`);
      }
    }

    // Count documents
    const totalCount = await collection.countDocuments(filter);

    if (totalCount === 0) {
      if (options.json) {
        console.log(JSON.stringify({ success: true, count: 0, message: 'No documents to refresh' }));
      } else {
        p.log.success('No documents to refresh.');
        p.outro('Nothing to do.');
      }
      return { success: true, count: 0 };
    }

    // Show plan
    const rechunkLabel = options.rechunk ? ` (re-chunking with ${options.strategy || 'recursive'})` : '';
    const dimLabel = dimensions ? ` @ ${dimensions}d` : '';
    
    if (options.json && options.dryRun) {
      console.log(JSON.stringify({
        dryRun: true,
        count: totalCount,
        model,
        dimensions: dimensions || 'default',
        rechunk: !!options.rechunk,
      }));
      return { success: true, dryRun: true, count: totalCount };
    }

    if (!quiet) {
      p.log.info(`Found ${totalCount} document${totalCount === 1 ? '' : 's'} to refresh`);
      p.log.info(`Target model: ${model}${dimLabel}${rechunkLabel}`);
    }

    // Dry run - stop here
    if (options.dryRun) {
      if (!quiet) {
        p.log.info('Dry run - no documents modified.');
        p.outro(`Would refresh ${totalCount} document${totalCount === 1 ? '' : 's'}.`);
      }
      return { success: true, dryRun: true, count: totalCount };
    }

    // Confirm unless --force
    if (!options.force && !options.json) {
      const confirmed = await p.confirm({
        message: `Re-embed ${totalCount} document${totalCount === 1 ? '' : 's'}? This will update the embeddings in-place.`,
        initialValue: true,
      });

      if (p.isCancel(confirmed) || !confirmed) {
        p.log.info('Refresh cancelled.');
        p.outro('No documents modified.');
        return { success: false, cancelled: true };
      }
    }

    // Create embedder function
    const embedder = async (texts) => {
      const result = await generateEmbeddings(texts, {
        model,
        dimensions,
        inputType: 'document',
      });
      return result.embeddings;
    };

    // Process documents
    let processed = 0;
    let errors = 0;
    const cursor = collection.find(filter);
    let batch = [];

    const spinner = !quiet ? p.spinner() : null;
    if (spinner) spinner.start('Processing documents...');

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      
      if (options.rechunk) {
        // Re-chunk the document
        const chunks = rechunkDocument(doc, options);
        batch.push(...chunks);
      } else {
        batch.push(doc);
      }

      // Process when batch is full
      if (batch.length >= batchSize) {
        try {
          const updated = await processBatch(batch, embedder, { field, model });
          
          // Replace documents in database
          for (const updatedDoc of updated) {
            if (options.rechunk && updatedDoc.metadata?.originalId) {
              // For rechunked docs, insert new and delete original later
              await collection.insertOne(updatedDoc);
            } else {
              // Update in place
              await collection.updateOne(
                { _id: updatedDoc._id },
                { $set: { [field]: updatedDoc[field], _model: model, _embeddedAt: new Date() } }
              );
            }
          }
          
          processed += batch.length;
          if (spinner) spinner.message(`Processed ${processed}/${totalCount} documents...`);
        } catch (err) {
          errors += batch.length;
          if (!quiet) {
            p.log.warn(`Batch error: ${err.message}`);
          }
        }
        batch = [];
      }
    }

    // Process remaining batch
    if (batch.length > 0) {
      try {
        const updated = await processBatch(batch, embedder, { field, model });
        
        for (const updatedDoc of updated) {
          if (options.rechunk && updatedDoc.metadata?.originalId) {
            await collection.insertOne(updatedDoc);
          } else {
            await collection.updateOne(
              { _id: updatedDoc._id },
              { $set: { [field]: updatedDoc[field], _model: model, _embeddedAt: new Date() } }
            );
          }
        }
        
        processed += batch.length;
      } catch (err) {
        errors += batch.length;
        if (!quiet) {
          p.log.warn(`Batch error: ${err.message}`);
        }
      }
    }

    // If rechunking, delete original documents
    if (options.rechunk) {
      const originalIds = await collection.distinct('metadata.originalId', filter);
      if (originalIds.length > 0) {
        // Convert string IDs back to ObjectIds for deletion
        const { ObjectId } = require('mongodb');
        const objectIds = originalIds
          .filter(id => id)
          .map(id => {
            try { return new ObjectId(id); } catch { return null; }
          })
          .filter(id => id);
        
        if (objectIds.length > 0) {
          await collection.deleteMany({ _id: { $in: objectIds } });
        }
      }
    }

    if (spinner) spinner.stop('Processing complete.');

    // Update project config if model/dimensions changed
    const configUpdated = (model !== project.model) || (dimensions && dimensions !== project.dimensions);
    if (configUpdated && !options.json) {
      try {
        saveProject({
          ...project,
          model,
          ...(dimensions && { dimensions }),
        });
        if (!quiet) {
          p.log.info('Updated .vai.json with new model/dimensions.');
        }
      } catch {
        // Ignore save errors
      }
    }

    if (options.json) {
      console.log(JSON.stringify({ success: true, processed, errors }));
    } else {
      if (errors > 0) {
        p.log.warn(`Refreshed ${processed} documents with ${errors} errors.`);
      } else {
        p.log.success(`Refreshed ${processed} document${processed === 1 ? '' : 's'}.`);
      }
      p.outro('Refresh complete.');
    }

    return { success: true, processed, errors };

  } catch (err) {
    if (options.json) {
      console.log(JSON.stringify({ error: err.message }));
    } else {
      p.log.error(`Refresh failed: ${err.message}`);
    }
    return { success: false, error: err.message };
  } finally {
    if (client) {
      await close();
    }
  }
}

/**
 * Register the refresh command with Commander.
 */
function register(program) {
  program
    .command('refresh')
    .description('Re-embed documents with a new model, dimensions, or chunk settings')
    .option('--db <database>', 'Database name')
    .option('--collection <name>', 'Collection name')
    .option('--field <name>', 'Embedding field name')
    .option('-m, --model <model>', 'New embedding model')
    .option('-d, --dimensions <n>', 'New dimensions', parseInt)
    .option('--rechunk', 'Re-chunk text before re-embedding')
    .option('-s, --strategy <strategy>', 'Chunk strategy (with --rechunk)')
    .option('-c, --chunk-size <n>', 'Chunk size (with --rechunk)', parseInt)
    .option('--overlap <n>', 'Chunk overlap (with --rechunk)', parseInt)
    .option('--batch-size <n>', 'Texts per API call (default: 25)', parseInt)
    .option('--filter <json>', 'Only refresh matching documents (JSON)')
    .option('--force', 'Skip confirmation prompt')
    .option('--dry-run', 'Show plan without executing')
    .option('--json', 'Machine-readable output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(refresh);
}

module.exports = { register, refresh };
