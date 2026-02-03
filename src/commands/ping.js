'use strict';

const { API_BASE } = require('../lib/api');

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
      const apiKey = process.env.VOYAGE_API_KEY;
      if (!apiKey) {
        if (opts.json) {
          console.log(JSON.stringify({ ok: false, error: 'VOYAGE_API_KEY not set' }));
        } else {
          console.error('✗ VOYAGE_API_KEY is not set.');
          console.error('');
          console.error('Get one from MongoDB Atlas → AI Models → Create model API key');
          console.error('Then: export VOYAGE_API_KEY="your-key-here"');
        }
        process.exit(1);
      }

      const model = 'voyage-4-lite';
      const startTime = Date.now();

      try {
        const response = await fetch(`${API_BASE}/embeddings`, {
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
          results.voyage = { ok: false, error: 'auth', elapsed };
          if (opts.json) {
            console.log(JSON.stringify({ ok: false, error: 'Authentication failed', elapsed }));
          } else {
            console.error(`✗ Authentication failed (${response.status})`);
            console.error('');
            console.error('Your API key may be invalid or expired.');
            console.error('Get a new key: MongoDB Atlas → AI Models → Create model API key');
            console.error('Then: export VOYAGE_API_KEY="your-new-key"');
          }
          process.exit(1);
        }

        if (!response.ok) {
          const body = await response.text();
          results.voyage = { ok: false, error: `HTTP ${response.status}`, elapsed };
          if (opts.json) {
            console.log(JSON.stringify({ ok: false, error: `API error (${response.status})`, detail: body, elapsed }));
          } else {
            console.error(`✗ API error (${response.status}): ${body}`);
          }
          process.exit(1);
        }

        const data = await response.json();
        const dims = data.data && data.data[0] ? data.data[0].embedding.length : 'unknown';
        const tokens = data.usage ? data.usage.total_tokens : 'unknown';

        results.voyage = { ok: true, elapsed, model, dimensions: dims, tokens, endpoint: API_BASE };

        if (opts.json) {
          // JSON output is emitted at the end after MongoDB check
        } else if (opts.quiet) {
          console.log(`ok ${elapsed}ms`);
        } else {
          console.log(`✓ Connected to Voyage AI API (${elapsed}ms)`);
          console.log(`  Endpoint:   ${API_BASE}`);
          console.log(`  Model:      ${model}`);
          console.log(`  Dimensions: ${dims}`);
          console.log(`  Tokens:     ${tokens}`);
        }
      } catch (err) {
        const elapsed = Date.now() - startTime;
        results.voyage = { ok: false, error: 'network', elapsed };
        if (opts.json) {
          console.log(JSON.stringify({ ok: false, error: 'Network error', detail: err.message, elapsed }));
        } else {
          console.error(`✗ Connection failed: ${err.message}`);
          console.error('');
          console.error('Check your internet connection and try again.');
        }
        process.exit(1);
      }

      // ── MongoDB ping (optional) ──
      const mongoUri = process.env.MONGODB_URI;
      if (mongoUri) {
        const mongoStart = Date.now();
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

          if (!opts.json && !opts.quiet) {
            console.log('');
            console.log(`✓ Connected to MongoDB Atlas (${mongoElapsed}ms)`);
            console.log(`  Cluster:    ${cluster}`);
          }

          await client.close();
        } catch (err) {
          const mongoElapsed = Date.now() - mongoStart;
          results.mongodb = { ok: false, elapsed: mongoElapsed, error: err.message };
          if (!opts.json && !opts.quiet) {
            console.log('');
            console.log(`✗ MongoDB connection failed (${mongoElapsed}ms): ${err.message}`);
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
