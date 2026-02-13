'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {
  executeHttp,
  executeAggregate,
  executeWorkflow,
} = require('../../src/lib/workflow');

// ── HTTP Test Server ──

let server;
let serverUrl;

before(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const url = new URL(req.url, `http://localhost`);

      if (url.pathname === '/json') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'hello', method: req.method }));
      } else if (url.pathname === '/echo') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ body: body ? JSON.parse(body) : null, headers: req.headers }));
      } else if (url.pathname === '/text') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('plain text response');
      } else if (url.pathname === '/error') {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'internal error' }));
      } else if (url.pathname === '/slow') {
        // Don't respond — will trigger timeout
        setTimeout(() => {
          res.writeHead(200);
          res.end('late');
        }, 5000);
      } else if (url.pathname === '/redirect') {
        res.writeHead(302, { Location: `${serverUrl}/json` });
        res.end();
      } else {
        res.writeHead(404);
        res.end('not found');
      }
    });
  });

  await new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      serverUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

after(() => {
  if (server) server.close();
});

// ── HTTP Node ──

describe('executeHttp', () => {
  it('makes a GET request and returns JSON', async () => {
    const result = await executeHttp({ url: `${serverUrl}/json` });
    assert.equal(result.status, 200);
    assert.equal(result.body.message, 'hello');
    assert.equal(result.body.method, 'GET');
    assert.ok(result.durationMs >= 0);
  });

  it('makes a POST request with JSON body', async () => {
    const result = await executeHttp({
      url: `${serverUrl}/echo`,
      method: 'POST',
      body: { key: 'value' },
    });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.body, { key: 'value' });
    // Auto-set Content-Type
    assert.equal(result.body.headers['content-type'], 'application/json');
  });

  it('returns text when responseType is text', async () => {
    const result = await executeHttp({
      url: `${serverUrl}/text`,
      responseType: 'text',
    });
    assert.equal(result.body, 'plain text response');
  });

  it('handles non-2xx status codes', async () => {
    const result = await executeHttp({ url: `${serverUrl}/error` });
    assert.equal(result.status, 500);
    assert.equal(result.body.error, 'internal error');
  });

  it('times out on slow responses', async () => {
    await assert.rejects(
      () => executeHttp({ url: `${serverUrl}/slow`, timeout: 100 }),
      /abort|timeout/i
    );
  });

  it('does not follow redirects by default', async () => {
    const result = await executeHttp({ url: `${serverUrl}/redirect` });
    assert.equal(result.status, 302);
  });

  it('follows redirects when enabled', async () => {
    const result = await executeHttp({
      url: `${serverUrl}/redirect`,
      followRedirects: true,
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.message, 'hello');
  });

  it('passes custom headers', async () => {
    const result = await executeHttp({
      url: `${serverUrl}/echo`,
      method: 'POST',
      headers: { 'X-Custom': 'test-val' },
      body: {},
    });
    assert.equal(result.body.headers['x-custom'], 'test-val');
  });

  it('throws on missing url', async () => {
    await assert.rejects(
      () => executeHttp({}),
      /url.*required/i
    );
  });

  it('falls back to text when JSON parse fails', async () => {
    const result = await executeHttp({
      url: `${serverUrl}/text`,
      responseType: 'json', // but response is plain text
    });
    assert.equal(typeof result.body, 'string');
    assert.equal(result.body, 'plain text response');
  });
});

// ── Aggregate Node ──

describe('executeAggregate', () => {
  it('throws on missing pipeline', async () => {
    await assert.rejects(
      () => executeAggregate({ db: 'test', collection: 'test', pipeline: 'not-array' }, {}),
      /pipeline.*array/i
    );
  });

  it('throws on pipeline exceeding 20 stages', async () => {
    const pipeline = Array.from({ length: 21 }, () => ({ $match: {} }));
    await assert.rejects(
      () => executeAggregate({ db: 'test', collection: 'test', pipeline }, {}),
      /20 stages/i
    );
  });

  it('blocks $out without allowWrites', async () => {
    await assert.rejects(
      () => executeAggregate({ db: 'test', collection: 'test', pipeline: [{ $out: 'other' }] }, {}),
      /\$out.*allowWrites/i
    );
  });

  it('blocks $merge without allowWrites', async () => {
    await assert.rejects(
      () => executeAggregate({ db: 'test', collection: 'test', pipeline: [{ $merge: { into: 'other' } }] }, {}),
      /\$merge.*allowWrites/i
    );
  });

  // Note: db/collection missing tests would require mocking loadProject
  // since it may fill defaults. We test that the aggregate function
  // validates pipeline structure, write protection, and stage limits.
  // Connection-level errors (missing MONGODB_URI) are tested implicitly.
});

// ── End-to-end: http in workflow ──

describe('executeWorkflow — http node', () => {
  it('uses http node in a workflow pipeline', async () => {
    const definition = {
      name: 'http-test',
      steps: [
        {
          id: 'fetch',
          tool: 'http',
          inputs: { url: `${serverUrl}/json` },
        },
        {
          id: 'result',
          tool: 'template',
          inputs: { text: 'Got: {{ fetch.output.body.message }}' },
        },
      ],
      output: '{{ result.output.text }}',
    };

    const result = await executeWorkflow(definition);
    assert.equal(result.output, 'Got: hello');
  });

  it('http with conditional branching on status', async () => {
    const definition = {
      name: 'http-conditional',
      steps: [
        {
          id: 'fetch',
          tool: 'http',
          inputs: { url: `${serverUrl}/json` },
        },
        {
          id: 'check',
          tool: 'conditional',
          inputs: {
            condition: '{{ fetch.output.status === 200 }}',
            then: ['success'],
            else: ['failure'],
          },
        },
        {
          id: 'success',
          tool: 'template',
          inputs: { text: 'Request succeeded' },
        },
        {
          id: 'failure',
          tool: 'template',
          inputs: { text: 'Request failed' },
        },
      ],
      output: '{{ check.output.branchTaken }}',
    };

    const completed = [];
    const result = await executeWorkflow(definition, {
      onStepComplete: (id) => completed.push(id),
    });
    assert.equal(result.output, 'then');
    assert.ok(completed.includes('success'));
    assert.ok(!completed.includes('failure'));
  });

  it('http with continueOnError catches failures', async () => {
    const definition = {
      name: 'http-error-handling',
      steps: [
        {
          id: 'bad_fetch',
          tool: 'http',
          inputs: { url: 'http://127.0.0.1:1/nonexistent', timeout: 500 },
          continueOnError: true,
        },
        {
          id: 'result',
          tool: 'template',
          inputs: { text: 'continued past error' },
        },
      ],
      output: '{{ result.output.text }}',
    };

    const result = await executeWorkflow(definition);
    assert.equal(result.output, 'continued past error');
    const badStep = result.steps.find(s => s.id === 'bad_fetch');
    assert.ok(badStep.error);
  });
});
