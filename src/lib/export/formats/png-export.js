'use strict';

/**
 * Render PNG from Mermaid diagram via Playwright.
 *
 * @param {object} normalized
 * @param {object} options
 * @param {string} [options.resolution='2x'] - '1x' | '2x' | '3x'
 * @param {string} [options.background='transparent'] - 'transparent' | 'dark' | 'light'
 * @param {boolean} [options.includeWatermark=true]
 * @param {boolean} [options.fitToContent=true]
 * @returns {Promise<{ content: Buffer, mimeType: string }>}
 */
async function renderPng(normalized, options = {}) {
  // If raw PNG buffer provided (from Electron canvas capture)
  if (normalized._pngBuffer) {
    return { content: normalized._pngBuffer, mimeType: 'image/png' };
  }

  const { workflowToMermaid } = require('./mermaid-export');

  if (normalized._context !== 'workflow' && normalized._context !== 'benchmark') {
    throw new Error(`PNG export not supported for context: ${normalized._context}`);
  }

  const mermaidSrc = normalized._context === 'workflow'
    ? workflowToMermaid(normalized, options)
    : null;

  if (!mermaidSrc) {
    throw new Error('No Mermaid source available for PNG rendering');
  }

  const png = await renderMermaidToPng(mermaidSrc, options);
  return { content: png, mimeType: 'image/png' };
}

/**
 * Render Mermaid syntax to PNG using Playwright.
 */
async function renderMermaidToPng(mermaidSrc, options = {}) {
  const { chromium } = require('playwright');
  const resolution = options.resolution || '2x';
  const scale = parseInt(resolution) || 2;
  const background = options.background || 'transparent';
  const bgColor = background === 'dark' ? '#1e1e1e' : background === 'light' ? '#ffffff' : 'transparent';

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      deviceScaleFactor: scale,
    });

    const html = `<!DOCTYPE html>
<html><head>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
</head><body style="margin:0;padding:16px;background:${bgColor};">
<pre class="mermaid">${escapeHtml(mermaidSrc)}</pre>
<script>mermaid.initialize({ startOnLoad: true, theme: '${options.theme || 'dark'}' });</script>
</body></html>`;

    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.waitForSelector('svg', { timeout: 10000 });

    const fitToContent = options.fitToContent !== false;

    let screenshotOpts = { type: 'png' };
    if (background === 'transparent') {
      screenshotOpts.omitBackground = true;
    }

    if (fitToContent) {
      const svgEl = await page.$('svg');
      const box = await svgEl.boundingBox();
      if (box) {
        screenshotOpts.clip = {
          x: Math.max(0, box.x - 8),
          y: Math.max(0, box.y - 8),
          width: box.width + 16,
          height: box.height + 16,
        };
      }
    }

    const buffer = await page.screenshot(screenshotOpts);
    return buffer;
  } finally {
    await browser.close();
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = { renderPng, renderMermaidToPng };
