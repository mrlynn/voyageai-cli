'use strict';

const fs = require('fs');
const { DEFAULT_RERANK_MODEL } = require('../lib/catalog');
const { apiRequest } = require('../lib/api');

/**
 * Register the rerank command on a Commander program.
 * @param {import('commander').Command} program
 */
function registerRerank(program) {
  program
    .command('rerank')
    .description('Rerank documents against a query')
    .requiredOption('--query <text>', 'Search query')
    .option('--documents <docs...>', 'Documents to rerank')
    .option('--documents-file <path>', 'File with documents (JSON array or newline-delimited)')
    .option('-m, --model <model>', 'Reranking model', DEFAULT_RERANK_MODEL)
    .option('-k, --top-k <n>', 'Return top K results', (v) => parseInt(v, 10))
    .option('--json', 'Machine-readable JSON output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(async (opts) => {
      try {
        let documents = opts.documents;

        if (opts.documentsFile) {
          const content = fs.readFileSync(opts.documentsFile, 'utf-8').trim();
          try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
              documents = parsed.map(item => {
                if (typeof item === 'string') return item;
                if (item.text) return item.text;
                return JSON.stringify(item);
              });
            } else {
              documents = [typeof parsed === 'string' ? parsed : JSON.stringify(parsed)];
            }
          } catch {
            documents = content.split('\n').filter(line => line.trim());
          }
        }

        // Also support stdin for documents
        if (!documents && !process.stdin.isTTY) {
          const chunks = [];
          for await (const chunk of process.stdin) {
            chunks.push(chunk);
          }
          const input = Buffer.concat(chunks).toString('utf-8').trim();
          try {
            const parsed = JSON.parse(input);
            if (Array.isArray(parsed)) {
              documents = parsed.map(item => {
                if (typeof item === 'string') return item;
                if (item.text) return item.text;
                return JSON.stringify(item);
              });
            }
          } catch {
            documents = input.split('\n').filter(line => line.trim());
          }
        }

        if (!documents || documents.length === 0) {
          console.error('Error: No documents provided. Use --documents, --documents-file, or pipe via stdin.');
          process.exit(1);
        }

        const body = {
          query: opts.query,
          documents,
          model: opts.model,
        };
        if (opts.topK) {
          body.top_k = opts.topK;
        }

        const result = await apiRequest('/rerank', body);

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        if (!opts.quiet) {
          console.log(`Model: ${result.model}`);
          console.log(`Query: "${opts.query}"`);
          console.log(`Results: ${result.data?.length || 0}`);
          if (result.usage) {
            console.log(`Tokens: ${result.usage.total_tokens}`);
          }
          console.log('');
        }

        if (result.data) {
          for (const item of result.data) {
            const docPreview = documents[item.index].substring(0, 80);
            const ellipsis = documents[item.index].length > 80 ? '...' : '';
            console.log(`[${item.index}] Score: ${item.relevance_score.toFixed(6)}  "${docPreview}${ellipsis}"`);
          }
        }
      } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}

module.exports = { registerRerank };
