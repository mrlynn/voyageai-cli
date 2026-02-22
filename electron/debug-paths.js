#!/usr/bin/env node

// Debug script to test path resolution like Electron would
const path = require('path');
const fs = require('fs');

// Simulate both packaged and dev environments
const scenarios = [
  { name: 'Development', isPackaged: false, resourcesPath: null },
  { name: 'Packaged', isPackaged: true, resourcesPath: '/Applications/Vai.app/Contents/Resources' }
];

scenarios.forEach(scenario => {
  console.log(`\n=== ${scenario.name} Environment ===`);
  console.log(`isPackaged: ${scenario.isPackaged}`);
  
  // Simulate the path resolution logic from main.js
  const srcBase = scenario.isPackaged
    ? path.join(scenario.resourcesPath, 'src')
    : path.join(__dirname, '..', 'src');
    
  const playgroundPath = path.join(srcBase, 'commands', 'playground.js');
  const htmlPath = path.join(srcBase, 'playground', 'index.html');
  
  console.log(`srcBase: ${srcBase}`);
  console.log(`playgroundPath: ${playgroundPath}`);
  console.log(`htmlPath: ${htmlPath}`);
  
  // Check if files exist (only for dev scenario since we can't check packaged paths)
  if (!scenario.isPackaged) {
    console.log(`playground.js exists: ${fs.existsSync(playgroundPath)}`);
    console.log(`index.html exists: ${fs.existsSync(htmlPath)}`);
    
    // Try to require the playground module
    try {
      const { createPlaygroundServer } = require(playgroundPath);
      console.log(`✅ Successfully required playground module`);
      console.log(`✅ createPlaygroundServer function exists: ${typeof createPlaygroundServer === 'function'}`);
    } catch (err) {
      console.log(`❌ Failed to require playground module:`, err.message);
    }
  }
});

// Also test the actual directory structure
console.log(`\n=== Actual Directory Structure ===`);
const actualSrcBase = path.join(__dirname, '..', 'src');
console.log(`Source directory: ${actualSrcBase}`);

if (fs.existsSync(actualSrcBase)) {
  console.log('Contents of src/:');
  fs.readdirSync(actualSrcBase).forEach(item => {
    const itemPath = path.join(actualSrcBase, item);
    const isDir = fs.lstatSync(itemPath).isDirectory();
    console.log(`  ${isDir ? '📁' : '📄'} ${item}`);
  });
  
  const playgroundDir = path.join(actualSrcBase, 'playground');
  if (fs.existsSync(playgroundDir)) {
    console.log('\nContents of src/playground/:');
    fs.readdirSync(playgroundDir).forEach(item => {
      const itemPath = path.join(playgroundDir, item);
      const isDir = fs.lstatSync(itemPath).isDirectory();
      console.log(`  ${isDir ? '📁' : '📄'} ${item}`);
    });
  }
  
  const commandsDir = path.join(actualSrcBase, 'commands');
  if (fs.existsSync(commandsDir)) {
    console.log('\nContents of src/commands/:');
    fs.readdirSync(commandsDir)
      .filter(item => item.endsWith('.js'))
      .forEach(item => console.log(`  📄 ${item}`));
  }
} else {
  console.log(`❌ Source directory does not exist: ${actualSrcBase}`);
}