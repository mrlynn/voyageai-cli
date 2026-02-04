'use strict';

const { execSync, spawn } = require('child_process');
const https = require('https');
const path = require('path');
const fs = require('fs');

/**
 * Fetch JSON from a URL (Node built-in https).
 * Returns a Promise that resolves with the parsed JSON.
 */
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { 'User-Agent': 'voyageai-cli' },
    };
    https.get(url, options, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJSON(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`GitHub API returned status ${res.statusCode}`));
      }
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

/**
 * Open a URL in the default browser (cross-platform, no dependencies).
 */
function openInBrowser(url) {
  const plat = process.platform;
  if (plat === 'darwin') spawn('open', [url], { stdio: 'ignore', detached: true }).unref();
  else if (plat === 'win32') spawn('cmd', ['/c', 'start', url], { stdio: 'ignore', detached: true }).unref();
  else spawn('xdg-open', [url], { stdio: 'ignore', detached: true }).unref();
}

/**
 * Register the app command — launches the Electron desktop app.
 * @param {import('commander').Command} program
 */
function registerApp(program) {
  program
    .command('app')
    .description('Launch the Voyage AI Playground desktop app (Electron)')
    .option('--install', 'Install Electron dependencies first')
    .option('--dev', 'Run in development mode with DevTools')
    .option('--download', 'Download the latest desktop app release for your platform')
    .option('--version', 'Print the app/CLI version')
    .action(async (opts) => {
      // --version: print version and exit
      if (opts.version) {
        const pkg = require(path.join(__dirname, '..', '..', 'package.json'));
        console.log(`voyageai-cli v${pkg.version}`);
        return;
      }

      // --download: fetch latest GitHub release and open download URL
      if (opts.download) {
        const releaseUrl = 'https://api.github.com/repos/mrlynn/voyageai-cli/releases/latest';
        try {
          console.log('🔍 Checking for the latest desktop app release...');
          const release = await fetchJSON(releaseUrl);

          const extMap = { darwin: '.dmg', win32: '.exe', linux: '.AppImage' };
          const ext = extMap[process.platform];

          const asset = ext && release.assets
            ? release.assets.find((a) => a.name.endsWith(ext))
            : null;

          if (asset) {
            console.log(`\n✅ Found release: ${release.tag_name || release.name}`);
            console.log(`📦 Asset: ${asset.name}`);
            console.log(`🔗 ${asset.browser_download_url}\n`);
            console.log('Opening download in your browser...');
            openInBrowser(asset.browser_download_url);
          } else {
            console.log(
              "No desktop app release found for your platform. Run 'vai playground' for the web version."
            );
          }
        } catch (err) {
          console.error(
            "No desktop app release found. Run 'vai playground' for the web version."
          );
          if (process.env.DEBUG) console.error(err);
        }
        return;
      }
      const electronDir = path.join(__dirname, '..', '..', 'electron');
      const electronPkg = path.join(electronDir, 'package.json');

      if (!fs.existsSync(electronPkg)) {
        console.log('');
        console.log('🖥️  The Vai desktop app is not installed locally.');
        console.log('');
        console.log('   Download the latest release for your platform:');
        console.log('');
        console.log('     vai app --download');
        console.log('');
        console.log('   Or grab it directly from GitHub:');
        console.log('     https://github.com/mrlynn/voyageai-cli/releases/latest');
        console.log('');
        console.log('   Don\'t need the desktop app? Use the web playground instead:');
        console.log('');
        console.log('     vai playground');
        console.log('');
        return;
      }

      // Check if electron is installed
      const nodeModules = path.join(electronDir, 'node_modules', 'electron');
      if (!fs.existsSync(nodeModules) || opts.install) {
        console.log('📦 Installing Electron dependencies...');
        try {
          execSync('npm install', { cwd: electronDir, stdio: 'inherit' });
        } catch (err) {
          console.error('❌ Failed to install dependencies:', err.message);
          process.exit(1);
        }
      }

      // Find the electron binary
      let electronBin;
      let useNpx = false;
      try {
        electronBin = require(path.join(electronDir, 'node_modules', 'electron'));
      } catch {
        // Fallback: try npx
        useNpx = true;
      }

      console.log('🧭 Launching Voyage AI Playground...');

      let bin, args;
      if (useNpx) {
        bin = 'npx';
        args = ['electron', electronDir];
      } else {
        bin = electronBin;
        args = [electronDir];
      }

      if (opts.dev) args.push('--dev');
      const child = spawn(bin, args, {
        cwd: electronDir,
        stdio: 'inherit',
        env: { ...process.env },
        detached: process.platform !== 'win32',
      });

      // Detach — don't block the terminal
      child.unref();

      // Give it a moment to start, then exit CLI
      setTimeout(() => process.exit(0), 500);
    });
}

module.exports = { registerApp };
