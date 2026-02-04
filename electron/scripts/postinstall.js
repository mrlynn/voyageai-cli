#!/usr/bin/env node
'use strict';

// Patch Electron so macOS shows "Vai" everywhere:
//   - Menu bar (CFBundleName/CFBundleDisplayName in Info.plist)
//   - CMD+TAB app switcher (requires renaming Electron.app → Vai.app)
//   - Dock (handled by app.dock.setIcon + app.setName in main.js)
//
// Only applies to unpackaged dev mode — packaged builds use electron-builder's productName.

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const APP_NAME = 'Vai';
const distDir = path.join(__dirname, '..', 'node_modules', 'electron', 'dist');
const oldApp = path.join(distDir, 'Electron.app');
const newApp = path.join(distDir, `${APP_NAME}.app`);
const pathTxt = path.join(__dirname, '..', 'node_modules', 'electron', 'path.txt');

// Step 1: Rename Electron.app → Vai.app
if (fs.existsSync(oldApp) && !fs.existsSync(newApp)) {
  fs.renameSync(oldApp, newApp);
  console.log(`✓ Renamed Electron.app → ${APP_NAME}.app`);
}

// Step 2: Update path.txt so require('electron') finds the binary
if (fs.existsSync(pathTxt)) {
  fs.writeFileSync(pathTxt, `${APP_NAME}.app/Contents/MacOS/Electron`, 'utf-8');
  console.log('✓ Updated electron path.txt');
}

// Step 3: Patch Info.plist
const plist = path.join(newApp || oldApp, 'Contents', 'Info.plist');
const targetPlist = fs.existsSync(path.join(newApp, 'Contents', 'Info.plist'))
  ? path.join(newApp, 'Contents', 'Info.plist')
  : path.join(oldApp, 'Contents', 'Info.plist');

if (fs.existsSync(targetPlist)) {
  try {
    execSync(`/usr/libexec/PlistBuddy -c "Set :CFBundleName ${APP_NAME}" "${targetPlist}"`);
    execSync(`/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName ${APP_NAME}" "${targetPlist}"`);
    execSync(`/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.vai.playground" "${targetPlist}"`);
    console.log(`✓ Patched Info.plist → "${APP_NAME}"`);
  } catch (err) {
    console.warn('⚠  Failed to patch Info.plist:', err.message);
  }
} else {
  console.log('⏭  Info.plist not found — skipping');
}
