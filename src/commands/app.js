'use strict';

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

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
    .action(async (opts) => {
      const electronDir = path.join(__dirname, '..', '..', 'electron');
      const electronPkg = path.join(electronDir, 'package.json');

      if (!fs.existsSync(electronPkg)) {
        console.error('❌ Electron app not found. Expected at:', electronDir);
        process.exit(1);
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
      try {
        electronBin = require(path.join(electronDir, 'node_modules', 'electron'));
      } catch {
        // Fallback: try npx
        electronBin = 'npx';
      }

      console.log('🧭 Launching Voyage AI Playground...');

      const args = typeof electronBin === 'string'
        ? ['electron', electronDir]
        : [electronDir];

      if (opts.dev) args.push('--dev');

      const bin = typeof electronBin === 'string' ? electronBin : electronBin;
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
