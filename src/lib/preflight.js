'use strict';

/**
 * Preflight checks for vai chat.
 *
 * Validates that the full RAG pipeline is ready before
 * starting a chat session. Returns structured results
 * usable by CLI, Playground, and Desktop.
 */

/**
 * @typedef {Object} PreflightCheck
 * @property {string}  id      - check identifier
 * @property {string}  label   - human-readable label
 * @property {boolean} ok      - passed?
 * @property {string}  [detail] - success detail (e.g. "23,530 documents")
 * @property {string}  [error]  - failure message
 * @property {string[]} [fix]   - commands to fix the issue
 */

/**
 * Run all preflight checks for chat.
 *
 * @param {object} params
 * @param {string} params.db            - database name
 * @param {string} params.collection    - collection name
 * @param {string} params.field         - embedding field name (default: 'embedding')
 * @param {object} params.llmConfig     - resolved LLM config ({ provider, model, ... })
 * @param {string} [params.textField]   - document text field (default: 'text')
 * @returns {Promise<{ checks: PreflightCheck[], ready: boolean }>}
 */
async function runPreflight({ db, collection, field = 'embedding', llmConfig, textField = 'text' }) {
  const checks = [];

  // 1. LLM Provider
  checks.push({
    id: 'llm',
    label: 'LLM Provider',
    ok: !!llmConfig?.provider,
    detail: llmConfig?.provider
      ? `${llmConfig.provider} (${llmConfig.model})`
      : undefined,
    error: !llmConfig?.provider ? 'No LLM provider configured' : undefined,
    fix: !llmConfig?.provider ? [
      'vai config set llm-provider anthropic',
      'vai config set llm-api-key YOUR_KEY',
    ] : undefined,
  });

  // 2–4: MongoDB checks (need connection)
  let client;
  try {
    const { getMongoCollection } = require('./mongo');
    const result = await getMongoCollection(db, collection);
    client = result.client;
    const coll = result.collection;

    // 2. Collection + document count
    const docCount = await coll.estimatedDocumentCount();
    if (docCount === 0) {
      checks.push({
        id: 'collection',
        label: 'Collection',
        ok: false,
        error: `${db}.${collection} is empty (0 documents)`,
        fix: [
          `vai pipeline ./your-docs --db ${db} --collection ${collection}`,
        ],
      });
    } else {
      checks.push({
        id: 'collection',
        label: 'Collection',
        ok: true,
        detail: `${db}.${collection} (${docCount.toLocaleString()} documents)`,
      });
    }

    // 3. Embeddings — check if documents have the embedding field
    if (docCount > 0) {
      const withEmbedding = await coll.countDocuments(
        { [field]: { $exists: true } },
        { limit: 1 }
      );
      if (withEmbedding === 0) {
        checks.push({
          id: 'embeddings',
          label: 'Embeddings',
          ok: false,
          error: `No '${field}' field found in documents`,
          fix: [
            `vai pipeline ./your-docs --db ${db} --collection ${collection}`,
            '',
            'Or step by step:',
            `  vai chunk ./docs                                    # Split into chunks`,
            `  vai store --db ${db} --collection ${collection}     # Embed and store`,
          ],
        });
      } else {
        // Check what fraction have embeddings
        const embeddedCount = await coll.countDocuments({ [field]: { $exists: true } });
        const pct = Math.round((embeddedCount / docCount) * 100);
        checks.push({
          id: 'embeddings',
          label: 'Embeddings',
          ok: true,
          detail: pct === 100
            ? `All documents have '${field}' field`
            : `${embeddedCount.toLocaleString()}/${docCount.toLocaleString()} documents embedded (${pct}%)`,
        });
      }
    } else {
      checks.push({
        id: 'embeddings',
        label: 'Embeddings',
        ok: false,
        error: 'No documents to check',
      });
    }

    // 4. Vector search index
    try {
      const indexes = await coll.listSearchIndexes().toArray();
      const vectorIndex = indexes.find(idx => {
        // Check if any index has a vector field mapping
        if (idx.latestDefinition?.fields) {
          return idx.latestDefinition.fields.some(
            f => f.type === 'vector' || f.type === 'knnVector'
          );
        }
        // Atlas Search index with vectorSearch type
        if (idx.type === 'vectorSearch') return true;
        return false;
      });

      if (vectorIndex) {
        const status = vectorIndex.status || 'READY';
        checks.push({
          id: 'vectorIndex',
          label: 'Vector Search Index',
          ok: status === 'READY',
          detail: status === 'READY'
            ? `'${vectorIndex.name}' (${status})`
            : undefined,
          error: status !== 'READY'
            ? `Index '${vectorIndex.name}' status: ${status} (not ready yet)`
            : undefined,
        });
      } else {
        checks.push({
          id: 'vectorIndex',
          label: 'Vector Search Index',
          ok: false,
          error: `No vector search index found on ${db}.${collection}`,
          fix: [
            `vai index create --db ${db} --collection ${collection} --field ${field} --dimensions 1024`,
          ],
        });
      }
    } catch (err) {
      // listSearchIndexes may not be available on non-Atlas deployments
      checks.push({
        id: 'vectorIndex',
        label: 'Vector Search Index',
        ok: false,
        error: `Could not check indexes: ${err.message}`,
        fix: [
          `vai index create --db ${db} --collection ${collection} --field ${field} --dimensions 1024`,
        ],
      });
    }

  } catch (err) {
    // MongoDB connection failed entirely
    checks.push({
      id: 'collection',
      label: 'MongoDB Connection',
      ok: false,
      error: err.message,
      fix: [
        'vai config set mongodb-uri "mongodb+srv://user:pass@cluster.mongodb.net/"',
      ],
    });
  } finally {
    if (client) {
      try { await client.close(); } catch { /* ignore */ }
    }
  }

  const ready = checks.every(c => c.ok);
  return { checks, ready };
}

/**
 * Format preflight results for terminal display.
 * @param {PreflightCheck[]} checks
 * @returns {string}
 */
function formatPreflight(checks) {
  const pc = require('picocolors');
  const lines = [];

  for (const check of checks) {
    const icon = check.ok ? pc.green('✓') : pc.red('✗');
    const detail = check.ok ? pc.dim(check.detail || '') : pc.red(check.error || 'failed');
    lines.push(`  ${icon} ${pc.bold(padRight(check.label, 22))} ${detail}`);
  }

  // Collect all fix commands from failed checks
  const failedChecks = checks.filter(c => !c.ok && c.fix);
  if (failedChecks.length > 0) {
    lines.push('');
    lines.push(pc.bold('  To fix:'));
    for (const check of failedChecks) {
      for (const cmd of check.fix) {
        if (cmd === '') {
          lines.push('');
        } else if (cmd.startsWith('  ') || cmd.startsWith('Or ')) {
          lines.push(`  ${pc.dim(cmd)}`);
        } else {
          lines.push(`    ${pc.cyan(cmd)}`);
        }
      }
    }
    lines.push('');
    lines.push(`  ${pc.dim('Learn more: vai explain chat')}`);
  }

  return lines.join('\n');
}

function padRight(str, len) {
  return str + ' '.repeat(Math.max(0, len - str.length));
}

module.exports = {
  runPreflight,
  formatPreflight,
};
