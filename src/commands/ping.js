'use strict';

const { getApiBase, requireApiKey } = require('../lib/api');
const ui = require('../lib/ui');

/**
 * Register the ping command on a Commander program.
 * @param {import('commander').Command} program
 */
function registerPing(program) {
  program
    .command('ping')
    .description('Test connectivity to Voyage AI API (and optionally MongoDB)')
    .option('--json', 'Machine-readable JSON output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(async (opts) => {
      const results = {};

      // ── Voyage AI ping ──
      let apiKey;
      try {
        apiKey = requireApiKey();
      } catch {
        // requireApiKey calls process.exit, but just in case
        process.exit(1);
      }

      const useColor = !opts.json;
      const useSpinner = useColor && !opts.quiet;

      const apiBase = getApiBase();
      const model = 'voyage-4-lite';
      const startTime = Date.now();

      let spin;
      if (useSpinner) {
        spin = ui.spinner('Testing Voyage AI connection...');
        spin.start();
      }

      try {
        const response = await fetch(`${apiBase}/embeddings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            input: ['ping'],
            model,
          }),
        });

        const elapsed = Date.now() - startTime;

        if (response.status === 401 || response.status === 403) {
          if (spin) spin.stop();
          results.voyage = { ok: false, error: 'auth', elapsed };
          if (opts.json) {
            console.log(JSON.stringify({ ok: false, error: 'Authentication failed', elapsed }));
          } else {
            console.error(ui.error(`Authentication failed (${response.status})`));
            console.error('');
            console.error('Your API key may be invalid or expired.');
            console.error('Get a new key: MongoDB Atlas → AI Models → Create model API key');
            console.error('Then: export VOYAGE_API_KEY="your-new-key"');
          }
          process.exit(1);
        }

        if (!response.ok) {
          if (spin) spin.stop();
          const body = await response.text();
          results.voyage = { ok: false, error: `HTTP ${response.status}`, elapsed };
          if (opts.json) {
            console.log(JSON.stringify({ ok: false, error: `API error (${response.status})`, detail: body, elapsed }));
          } else {
            console.error(ui.error(`API error (${response.status}): ${body}`));
          }
          process.exit(1);
        }

        const data = await response.json();
        const dims = data.data && data.data[0] ? data.data[0].embedding.length : 'unknown';
        const tokens = data.usage ? data.usage.total_tokens : 'unknown';

        results.voyage = { ok: true, elapsed, model, dimensions: dims, tokens, endpoint: apiBase };

        if (spin) spin.stop();

        if (opts.json) {
          // JSON output is emitted at the end after MongoDB check
        } else if (opts.quiet) {
          console.log(`ok ${elapsed}ms`);
        } else {
          console.log(ui.success(`Connected to Voyage AI API ${ui.dim('(' + elapsed + 'ms)')}`));
          console.log(ui.label('Endpoint', apiBase));
          console.log(ui.label('Model', model));
          console.log(ui.label('Dimensions', String(dims)));
          console.log(ui.label('Tokens', String(tokens)));
        }
      } catch (err) {
        if (spin) spin.stop();
        const elapsed = Date.now() - startTime;
        results.voyage = { ok: false, error: 'network', elapsed };
        if (opts.json) {
          console.log(JSON.stringify({ ok: false, error: 'Network error', detail: err.message, elapsed }));
        } else {
          console.error(ui.error(`Connection failed: ${err.message}`));
          console.error('');
          console.error('Check your internet connection and try again.');
        }
        process.exit(1);
      }

      // ── MongoDB ping (optional) ──
      const { getConfigValue } = require('../lib/config');
      const mongoUri = process.env.MONGODB_URI || getConfigValue('mongodbUri');
      if (mongoUri) {
        const mongoStart = Date.now();
        let mongoSpin;
        if (useSpinner) {
          mongoSpin = ui.spinner('Testing MongoDB connection...');
          mongoSpin.start();
        }

        try {
          const { MongoClient } = require('mongodb');
          const client = new MongoClient(mongoUri);
          await client.connect();
          await client.db('admin').command({ ping: 1 });
          const mongoElapsed = Date.now() - mongoStart;

          // Extract cluster hostname from URI
          let cluster = 'unknown';
          try {
            const match = mongoUri.match(/@([^/?]+)/);
            if (match) cluster = match[1];
          } catch { /* ignore */ }

          results.mongodb = { ok: true, elapsed: mongoElapsed, cluster };

          if (mongoSpin) mongoSpin.stop();

          if (!opts.json && !opts.quiet) {
            console.log('');
            console.log(ui.success(`Connected to MongoDB Atlas ${ui.dim('(' + mongoElapsed + 'ms)')}`));
            console.log(ui.label('Cluster', cluster));
          }

          await client.close();
        } catch (err) {
          if (mongoSpin) mongoSpin.stop();
          const mongoElapsed = Date.now() - mongoStart;
          results.mongodb = { ok: false, elapsed: mongoElapsed, error: err.message };
          if (!opts.json && !opts.quiet) {
            console.log('');
            console.log(ui.error(`MongoDB connection failed ${ui.dim('(' + mongoElapsed + 'ms)')}: ${err.message}`));
          }
        }
      }

      // Emit JSON at the end with all results
      if (opts.json) {
        console.log(JSON.stringify({ ok: true, ...results }, null, 2));
      }
    });
}

module.exports = { registerPing };
