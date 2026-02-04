#!/usr/bin/env node
'use strict';

const { chromium } = require('playwright');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname);
const BASE_URL = 'http://127.0.0.1:19878';

async function capture() {
  const browser = await chromium.launch();
  
  // Dark mode screenshots
  const darkPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await darkPage.goto(BASE_URL);
  await darkPage.waitForTimeout(1000);

  // Embed tab (default)
  await darkPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'vai-dark-embed.png') });
  console.log('✓ vai-dark-embed.png');

  // Compare tab
  await darkPage.click('[data-tab="compare"]');
  await darkPage.waitForTimeout(500);
  await darkPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'vai-dark-compare.png') });
  console.log('✓ vai-dark-compare.png');

  // Search tab
  await darkPage.click('[data-tab="search"]');
  await darkPage.waitForTimeout(500);
  await darkPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'vai-dark-search.png') });
  console.log('✓ vai-dark-search.png');

  // Benchmark tab
  await darkPage.click('[data-tab="benchmark"]');
  await darkPage.waitForTimeout(500);
  await darkPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'vai-dark-benchmark.png') });
  console.log('✓ vai-dark-benchmark.png');

  // Settings tab
  await darkPage.click('[data-tab="settings"]');
  await darkPage.waitForTimeout(500);
  await darkPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'vai-dark-settings.png') });
  console.log('✓ vai-dark-settings.png');

  // Light mode screenshots
  // Switch to light theme
  await darkPage.click('#themeToggle');
  await darkPage.waitForTimeout(300);

  // Embed tab in light mode
  await darkPage.click('[data-tab="embed"]');
  await darkPage.waitForTimeout(500);
  await darkPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'vai-light-embed.png') });
  console.log('✓ vai-light-embed.png');

  // Settings in light mode
  await darkPage.click('[data-tab="settings"]');
  await darkPage.waitForTimeout(500);
  await darkPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'vai-light-settings.png') });
  console.log('✓ vai-light-settings.png');

  await browser.close();
  console.log('\n✅ All screenshots captured in', SCREENSHOTS_DIR);
}

capture().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
