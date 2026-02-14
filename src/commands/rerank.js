'use strict';

const fs = require('fs');
const { DEFAULT_RERANK_MODEL } = require('../lib/catalog');
const { apiRequest } = require('../lib/api');
const ui = require('../lib/ui');
const { showCostSummary } = require('../lib/cost-display');

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
    .option('--truncation', 'Enable truncation for long inputs')
    .option('--no-truncation', 'Disable truncation')
    .option('--return-documents', 'Return document text in results')
    .option('--estimate', 'Show estimated tokens and cost without calling the API')
    .option('--json', 'Machine-readable JSON output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(async (opts) => {
      const telemetry = require('../lib/telemetry');
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
          console.error(ui.error('No documents provided. Use --documents, --documents-file, or pipe via stdin.'));
          process.exit(1);
        }

        // --estimate: show cost comparison, optionally switch model
        if (opts.estimate) {
          const { estimateTokens, confirmOrSwitchModel } = require('../lib/cost');
          const tokens = estimateTokens(opts.query) + documents.reduce((s, d) => s + estimateTokens(d), 0);
          const chosenModel = await confirmOrSwitchModel(tokens, opts.model, { json: opts.json });
          if (!chosenModel) return; // cancelled
          opts.model = chosenModel;
        }

        const done = telemetry.timer('cli_rerank', {
          model: opts.model,
          docCount: documents.length,
          topK: opts.topK,
        });

        const body = {
          query: opts.query,
          documents,
          model: opts.model,
        };
        if (opts.topK) {
          body.top_k = opts.topK;
        }
        if (opts.truncation !== undefined) {
          body.truncation = opts.truncation;
        }
        if (opts.returnDocuments) {
          body.return_documents = true;
        }

        const useColor = !opts.json;
        const useSpinner = useColor && !opts.quiet;
        let spin;
        if (useSpinner) {
          spin = ui.spinner('Reranking documents...');
          spin.start();
        }

        const result = await apiRequest('/rerank', body);

        if (spin) spin.stop();

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        if (!opts.quiet) {
          console.log(ui.label('Model', ui.cyan(result.model)));
          console.log(ui.label('Query', ui.cyan(`"${opts.query}"`)));
          console.log(ui.label('Results', String(result.data?.length || 0)));
          if (result.usage) {
            console.log(ui.label('Tokens', ui.dim(String(result.usage.total_tokens))));
          }
          showCostSummary(result.model || opts.model, result.usage?.total_tokens || 0, opts);
          console.log('');
        }

        if (result.data) {
          for (const item of result.data) {
            const docText = item.document || documents[item.index];
            const docPreview = docText.substring(0, 80);
            const ellipsis = docText.length > 80 ? '...' : '';
            console.log(`${ui.dim('[' + item.index + ']')} Score: ${ui.score(item.relevance_score)}  ${ui.dim('"' + docPreview + ellipsis + '"')}`);
          }
        }

        console.log('');
        console.log(ui.success('Reranking complete'));

        done();
      } catch (err) {
        telemetry.send('cli_error', { command: 'rerank', errorType: err.constructor.name });
        console.error(ui.error(err.message));
        process.exit(1);
      }
    });
}

module.exports = { registerRerank };
