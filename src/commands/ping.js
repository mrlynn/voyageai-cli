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
    .option('--mask', 'Mask sensitive info (cluster hostnames, endpoints) in output. Also enabled by VAI_MASK=1 env var.')
    .action(async (opts) => {
      // Support env var so all recordings are masked without remembering the flag
      if (process.env.VAI_MASK === '1' || process.env.VAI_MASK === 'true') {
        opts.mask = true;
      }
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

      // Masking helper: "performance.zbcul.mongodb.net" → "perfo*****.mongodb.net"
      const PUBLIC_HOSTS = ['ai.mongodb.com', 'api.voyageai.com'];
      const maskHost = (host) => {
        if (!opts.mask || !host) return host;
        if (PUBLIC_HOSTS.includes(host)) return host;
        const parts = host.split('.');
        if (parts.length >= 3) {
          const name = parts[0];
          const masked = name.slice(0, Math.min(5, name.length)) + '*****';
          return [masked, ...parts.slice(1)].join('.');
        }
        return host.slice(0, 5) + '*****';
      };

      const maskUrl = (url) => {
        if (!opts.mask || !url) return url;
        try {
          const u = new URL(url);
          u.hostname = maskHost(u.hostname);
          return u.toString().replace(/\/$/, '');
        } catch {
          return url;
        }
      };

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
          console.log(ui.label('Endpoint', maskUrl(apiBase)));
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
            console.log(ui.label('Cluster', maskHost(cluster)));
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

      // ── LLM provider ping (optional) ──
      const { createLLMProvider, resolveLLMConfig } = require('../lib/llm');
      const llmConfig = resolveLLMConfig();
      if (llmConfig.provider) {
        const llmStart = Date.now();
        let llmSpin;
        if (useSpinner) {
          llmSpin = ui.spinner(`Testing LLM provider (${llmConfig.provider})...`);
          llmSpin.start();
        }

        try {
          const llm = createLLMProvider();
          const pingResult = await llm.ping();
          const llmElapsed = Date.now() - llmStart;

          results.llm = { ok: pingResult.ok, elapsed: llmElapsed, provider: llmConfig.provider, model: pingResult.model };
          if (pingResult.error) results.llm.error = pingResult.error;

          if (llmSpin) llmSpin.stop();

          if (!opts.json && !opts.quiet) {
            console.log('');
            if (pingResult.ok) {
              console.log(ui.success(`LLM Provider connected ${ui.dim('(' + llmElapsed + 'ms)')}`));
              console.log(ui.label('Provider', llmConfig.provider));
              console.log(ui.label('Model', pingResult.model));
            } else {
              console.log(ui.error(`LLM Provider failed: ${pingResult.error}`));
            }
          }
        } catch (err) {
          if (llmSpin) llmSpin.stop();
          const llmElapsed = Date.now() - llmStart;
          results.llm = { ok: false, elapsed: llmElapsed, provider: llmConfig.provider, error: err.message };
          if (!opts.json && !opts.quiet) {
            console.log('');
            console.log(ui.error(`LLM Provider error: ${err.message}`));
          }
        }
      }

      // ── Chat readiness summary ──
      if (!opts.json && !opts.quiet && llmConfig.provider) {
        console.log('');
        if (results.voyage?.ok && results.llm?.ok) {
          console.log(ui.success('Chat is ready. Run: vai chat'));
        } else if (!results.llm?.ok) {
          console.log(ui.warn('Chat requires a working LLM provider. Check your configuration.'));
        }
      }

      // Emit JSON at the end with all results
      if (opts.json) {
        console.log(JSON.stringify({ ok: true, ...results }, null, 2));
      }
    });
}

module.exports = { registerPing };
