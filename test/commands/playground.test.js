'use strict';

const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { Command } = require('commander');
const { registerPlayground, createPlaygroundServer } = require('../../src/commands/playground');

describe('playground command', () => {
  let server;
  let port;

  // Start server once for all tests
  const serverReady = new Promise((resolve) => {
    server = createPlaygroundServer();
    server.listen(0, () => {
      port = server.address().port;
      resolve();
    });
  });

  after(() => {
    return new Promise((resolve) => {
      if (server) server.close(resolve);
      else resolve();
    });
  });

  it('registers correctly on a program', () => {
    const program = new Command();
    registerPlayground(program);
    const cmd = program.commands.find(c => c.name() === 'playground');
    assert.ok(cmd, 'playground command should be registered');
    assert.ok(cmd.description().includes('playground') || cmd.description().includes('Playground') || cmd.description().includes('web'),
      'should have a relevant description');
  });

  it('serves HTML on GET /', async () => {
    await serverReady;
    const body = await httpGet(`http://localhost:${port}/`);
    assert.ok(body.includes('<!DOCTYPE html>'), 'should return HTML');
    assert.ok(body.includes('Voyage AI Playground'), 'should include playground title');
  });

  it('returns JSON from GET /api/models', async () => {
    await serverReady;
    const body = await httpGet(`http://localhost:${port}/api/models`);
    const data = JSON.parse(body);
    assert.ok(Array.isArray(data.models), 'models should be an array');
    assert.ok(data.models.length > 0, 'should have at least one model');
    assert.ok(data.models.every(m => !m.legacy), 'should not include legacy models');
    // Check a known model exists
    const names = data.models.map(m => m.name);
    assert.ok(names.includes('voyage-4-large'), 'should include voyage-4-large');
  });

  it('returns config with hasKey boolean from GET /api/config', async () => {
    await serverReady;
    const body = await httpGet(`http://localhost:${port}/api/config`);
    const data = JSON.parse(body);
    assert.ok(typeof data.hasKey === 'boolean', 'hasKey should be a boolean');
    assert.ok(typeof data.baseUrl === 'string', 'baseUrl should be a string');
    // Should never expose the actual key
    assert.ok(!data.apiKey, 'should not expose apiKey');
    assert.ok(!data.key, 'should not expose key');
  });

  it('returns 404 for unknown routes', async () => {
    await serverReady;
    const { statusCode } = await httpGetFull(`http://localhost:${port}/nonexistent`);
    assert.equal(statusCode, 404);
  });

  it('returns 400 for POST /api/embed with invalid body', async () => {
    await serverReady;
    // Ensure an API key is available so we reach body validation (not 401)
    const saved = process.env.VOYAGE_API_KEY;
    process.env.VOYAGE_API_KEY = saved || 'test-dummy-key';
    const { statusCode, body } = await httpPostFull(`http://localhost:${port}/api/embed`, { texts: 'not-an-array' });
    assert.equal(statusCode, 400);
    const data = JSON.parse(body);
    assert.ok(data.error, 'should return an error message');
    if (saved !== undefined) process.env.VOYAGE_API_KEY = saved;
    else delete process.env.VOYAGE_API_KEY;
  });
});

/**
 * Simple HTTP GET that returns the body string.
 */
function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString()));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * HTTP GET returning { statusCode, body }.
 */
function httpGetFull(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks).toString() }));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * HTTP POST returning { statusCode, body }.
 */
function httpPostFull(url, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const parsed = new URL(url);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks).toString() }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}
