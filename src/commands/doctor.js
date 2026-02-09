'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const pc = require('picocolors');
const { getConfigValue } = require('../lib/config');
const { getApiBase } = require('../lib/api');

/**
 * vai doctor — Health check command
 * Validates the entire setup chain: Node version, API key, MongoDB connectivity,
 * peer dependencies, and configuration.
 */

const CHECKS = {
  node: { name: 'Node.js Version', required: true },
  apiKey: { name: 'Voyage AI API Key', required: true },
  apiConnection: { name: 'Voyage AI API Connection', required: true },
  mongodb: { name: 'MongoDB Connection', required: false },
  pdfParse: { name: 'PDF Support (pdf-parse)', required: false },
  config: { name: 'Configuration Files', required: false },
};

function checkMark(ok) {
  return ok ? pc.green('✓') : pc.red('✗');
}

function warnMark() {
  return pc.yellow('⚠');
}

async function checkNodeVersion() {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0], 10);
  const minVersion = 18;
  const ok = major >= minVersion;
  
  return {
    ok,
    message: ok 
      ? `${version} (meets minimum v${minVersion})`
      : `${version} — ${pc.red(`requires v${minVersion}+`)}`,
    hint: ok ? null : 'Upgrade Node.js: https://nodejs.org/',
  };
}

async function checkApiKey() {
  const key = process.env.VOYAGE_API_KEY || getConfigValue('apiKey');
  const masked = key ? `${key.slice(0, 8)}...${key.slice(-4)}` : null;
  
  if (!key) {
    return {
      ok: false,
      message: 'Not configured',
      hint: 'Set via: vai config set api-key YOUR_KEY\n         or: export VOYAGE_API_KEY=YOUR_KEY\n         Get a key: https://dash.voyageai.com/api-keys',
    };
  }
  
  // Check key format (Voyage keys typically start with pa- or similar)
  const validFormat = key.length > 20;
  
  return {
    ok: true,
    message: masked,
    hint: validFormat ? null : 'Key format looks unusual — verify at dash.voyageai.com',
  };
}

async function checkApiConnection() {
  const key = process.env.VOYAGE_API_KEY || getConfigValue('apiKey');
  if (!key) {
    return {
      ok: false,
      message: 'Skipped (no API key)',
      hint: null,
    };
  }

  const baseUrl = getApiBase();
  
  try {
    const https = require('https');
    const url = require('url');
    
    const parsed = new URL(`${baseUrl}/embeddings`);
    
    const result = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          // 200 = success, 400 = bad request (but server reachable), 401 = bad key
          if (res.statusCode === 401) {
            resolve({ ok: false, status: 401, message: 'Invalid API key' });
          } else if (res.statusCode === 400) {
            // Bad request means server is reachable, key is valid
            resolve({ ok: true, status: 400, message: 'Connected' });
          } else if (res.statusCode === 200) {
            resolve({ ok: true, status: 200, message: 'Connected' });
          } else {
            resolve({ ok: false, status: res.statusCode, message: `HTTP ${res.statusCode}` });
          }
        });
      });
      
      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Connection timeout'));
      });
      
      // Send minimal request body
      req.write(JSON.stringify({ model: 'voyage-3-lite', input: ['test'] }));
      req.end();
    });
    
    return {
      ok: result.ok,
      message: result.ok ? `${result.message} (${baseUrl})` : result.message,
      hint: result.ok ? null : 
        result.status === 401 ? 'API key is invalid — get a new one at dash.voyageai.com' :
        'Check your network connection and API base URL',
    };
  } catch (err) {
    return {
      ok: false,
      message: `Connection failed: ${err.message}`,
      hint: 'Check your network connection or firewall settings',
    };
  }
}

async function checkMongoDB() {
  const uri = process.env.MONGODB_URI || getConfigValue('mongoUri');
  
  if (!uri) {
    return {
      ok: null, // null = not configured (optional)
      message: 'Not configured (optional)',
      hint: 'Set via: vai config set mongo-uri YOUR_URI\n         Required for vai store, vai search, vai query',
    };
  }

  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    
    await client.connect();
    await client.db().command({ ping: 1 });
    await client.close();
    
    // Mask the URI
    const masked = uri.replace(/:\/\/[^@]+@/, '://***@').replace(/\?.*$/, '');
    
    return {
      ok: true,
      message: `Connected (${masked})`,
      hint: null,
    };
  } catch (err) {
    return {
      ok: false,
      message: `Connection failed: ${err.message}`,
      hint: 'Verify your connection string and network access',
    };
  }
}

async function checkPdfParse() {
  try {
    require.resolve('pdf-parse');
    return {
      ok: true,
      message: 'Installed',
      hint: null,
    };
  } catch {
    return {
      ok: null, // null = not installed (optional)
      message: 'Not installed (optional)',
      hint: 'Install for PDF support: npm install pdf-parse',
    };
  }
}

async function checkConfig() {
  const homeConfig = path.join(os.homedir(), '.vai', 'config.json');
  const projectConfig = path.join(process.cwd(), '.vai.json');
  
  const results = [];
  
  // Check home config
  if (fs.existsSync(homeConfig)) {
    try {
      const stat = fs.statSync(homeConfig);
      const mode = (stat.mode & 0o777).toString(8);
      const secure = mode === '600';
      results.push(`~/.vai/config.json: ${secure ? 'OK' : pc.yellow(`permissions ${mode} (should be 600)`)}`);
    } catch {
      results.push('~/.vai/config.json: exists');
    }
  }
  
  // Check project config
  if (fs.existsSync(projectConfig)) {
    try {
      JSON.parse(fs.readFileSync(projectConfig, 'utf8'));
      results.push('.vai.json: OK');
    } catch {
      results.push(`.vai.json: ${pc.red('invalid JSON')}`);
    }
  }
  
  if (results.length === 0) {
    return {
      ok: null,
      message: 'No config files found',
      hint: 'Run: vai init (for project config) or vai config set (for user config)',
    };
  }
  
  return {
    ok: true,
    message: results.join(', '),
    hint: null,
  };
}

async function runDoctor(options = {}) {
  const { json, verbose } = options;
  
  console.log(pc.bold('\n🩺 Voyage AI CLI Health Check\n'));
  
  const results = {};
  let hasError = false;
  let hasWarning = false;
  
  // Run all checks
  const checks = [
    { key: 'node', fn: checkNodeVersion },
    { key: 'apiKey', fn: checkApiKey },
    { key: 'apiConnection', fn: checkApiConnection },
    { key: 'mongodb', fn: checkMongoDB },
    { key: 'pdfParse', fn: checkPdfParse },
    { key: 'config', fn: checkConfig },
  ];
  
  for (const { key, fn } of checks) {
    const check = CHECKS[key];
    const result = await fn();
    results[key] = result;
    
    // Determine status icon
    let icon;
    if (result.ok === true) {
      icon = checkMark(true);
    } else if (result.ok === false) {
      icon = checkMark(false);
      if (check.required) hasError = true;
      else hasWarning = true;
    } else {
      icon = warnMark();
      hasWarning = true;
    }
    
    // Print result
    console.log(`  ${icon} ${pc.bold(check.name)}: ${result.message}`);
    
    if (result.hint && (verbose || result.ok === false)) {
      console.log(`      ${pc.dim(result.hint)}`);
    }
  }
  
  // Summary
  console.log('');
  if (hasError) {
    console.log(pc.red('  ✗ Some required checks failed. Fix the issues above to use vai.\n'));
  } else if (hasWarning) {
    console.log(pc.yellow('  ⚠ Some optional features are not configured.\n'));
  } else {
    console.log(pc.green('  ✓ All checks passed. vai is ready to use!\n'));
  }
  
  // Suggest next steps
  if (!hasError) {
    console.log(pc.dim('  Next steps:'));
    console.log(pc.dim('    vai demo        — Interactive walkthrough'));
    console.log(pc.dim('    vai quickstart  — Zero-to-search tutorial'));
    console.log(pc.dim('    vai explain     — Learn key concepts\n'));
  }
  
  if (json) {
    console.log(JSON.stringify(results, null, 2));
  }
  
  return hasError ? 1 : 0;
}

function register(program) {
  program
    .command('doctor')
    .description('Run health checks on your vai setup')
    .option('--json', 'Output results as JSON')
    .option('-v, --verbose', 'Show hints for all checks')
    .action(async (options) => {
      const exitCode = await runDoctor(options);
      if (exitCode !== 0) process.exit(exitCode);
    });
}

module.exports = { register, runDoctor };
