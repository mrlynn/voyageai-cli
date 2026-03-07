'use strict';

const { cosineSimilarity } = require('./math');

const VALID_DIMENSIONS = [256, 512, 1024, 2048];
const VALID_QUANTIZATIONS = ['float32', 'int8', 'uint8', 'binary'];
const MAX_TEXT_LENGTH = 10000;
const MAX_SIMILARITY_TEXTS = 10;

/**
 * Handle Nano API requests.
 * Returns true if handled, false otherwise.
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Object} context - Dependencies injected for testability
 */
async function handleNanoRequest(req, res, context) {
  const {
    readJsonBody,
    generateLocalEmbeddings,
    checkPython,
    checkVenv,
    checkModel,
    checkDevice,
  } = context;

  // GET /api/nano/status
  if (req.method === 'GET' && req.url === '/api/nano/status') {
    try {
      const python = checkPython();
      const venv = checkVenv();
      const model = checkModel();
      const device = checkDevice();

      const components = {
        python: {
          ok: python.ok,
          version: python.message,
          ...(python.ok ? {} : { hint: python.hint }),
        },
        venv: {
          ok: venv.ok,
          path: venv.message,
          ...(venv.ok ? {} : { hint: venv.hint }),
        },
        model: {
          ok: model.ok,
          path: model.message,
          ...(model.ok ? {} : { hint: model.hint }),
        },
        bridge: {
          ok: device.ok,
          ...(device.ok ? {} : { hint: device.hint }),
        },
      };

      const ready = python.ok && venv.ok && model.ok && device.ok;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ready, components }));
      return true;
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message, code: 'NANO_UNKNOWN' }));
      return true;
    }
  }

  // POST /api/nano/embed
  if (req.method === 'POST' && req.url === '/api/nano/embed') {
    try {
      const body = await readJsonBody(req);

      // Input validation
      if (!body.text || typeof body.text !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'text is required and must be a string' }));
        return true;
      }
      if (body.text.length > MAX_TEXT_LENGTH) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `text exceeds maximum length of ${MAX_TEXT_LENGTH} characters` }));
        return true;
      }

      const dimension = body.dimension || 1024;
      if (!VALID_DIMENSIONS.includes(dimension)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `dimension must be one of: ${VALID_DIMENSIONS.join(', ')}` }));
        return true;
      }

      const quantization = body.quantization || 'float32';
      if (!VALID_QUANTIZATIONS.includes(quantization)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `quantization must be one of: ${VALID_QUANTIZATIONS.join(', ')}` }));
        return true;
      }

      // Check nano readiness
      const venv = checkVenv();
      const model = checkModel();
      if (!venv.ok || !model.ok) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Nano bridge not ready', code: 'NANO_NOT_READY', hint: 'Run: vai nano setup' }));
        return true;
      }

      const start = performance.now();
      const result = await generateLocalEmbeddings([body.text], { dimensions: dimension, precision: quantization });
      const latency_ms = Math.round(performance.now() - start);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        embedding: result.data[0].embedding,
        dimension,
        quantization,
        model: 'voyage-4-nano',
        latency_ms,
      }));
      return true;
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message, code: err.code || 'NANO_UNKNOWN' }));
      return true;
    }
  }

  // POST /api/nano/similarity
  if (req.method === 'POST' && req.url === '/api/nano/similarity') {
    try {
      const body = await readJsonBody(req);

      // Input validation
      if (!Array.isArray(body.texts)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'texts is required and must be an array' }));
        return true;
      }
      if (body.texts.length < 2 || body.texts.length > MAX_SIMILARITY_TEXTS) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `texts must contain 2-${MAX_SIMILARITY_TEXTS} strings` }));
        return true;
      }
      for (let i = 0; i < body.texts.length; i++) {
        if (typeof body.texts[i] !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `texts[${i}] must be a string` }));
          return true;
        }
        if (body.texts[i].length > MAX_TEXT_LENGTH) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `texts[${i}] exceeds maximum length of ${MAX_TEXT_LENGTH} characters` }));
          return true;
        }
      }

      const dimension = body.dimension || 1024;
      if (!VALID_DIMENSIONS.includes(dimension)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `dimension must be one of: ${VALID_DIMENSIONS.join(', ')}` }));
        return true;
      }

      // Check nano readiness
      const venv = checkVenv();
      const model = checkModel();
      if (!venv.ok || !model.ok) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Nano bridge not ready', code: 'NANO_NOT_READY', hint: 'Run: vai nano setup' }));
        return true;
      }

      const start = performance.now();
      const result = await generateLocalEmbeddings(body.texts, { dimensions: dimension });
      const latency_ms = Math.round(performance.now() - start);

      // Compute NxN cosine similarity matrix
      const embeddings = result.data.map(d => d.embedding);
      const n = embeddings.length;
      const matrix = [];
      for (let i = 0; i < n; i++) {
        const row = [];
        for (let j = 0; j < n; j++) {
          if (i === j) {
            row.push(1.0);
          } else {
            row.push(cosineSimilarity(embeddings[i], embeddings[j]));
          }
        }
        matrix.push(row);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        texts: body.texts,
        matrix,
        dimension,
        latency_ms,
      }));
      return true;
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message, code: err.code || 'NANO_UNKNOWN' }));
      return true;
    }
  }

  // POST /api/nano/dimensions
  if (req.method === 'POST' && req.url === '/api/nano/dimensions') {
    try {
      const body = await readJsonBody(req);

      // Input validation
      if (!body.text || typeof body.text !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'text is required and must be a string' }));
        return true;
      }
      if (body.text.length > MAX_TEXT_LENGTH) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `text exceeds maximum length of ${MAX_TEXT_LENGTH} characters` }));
        return true;
      }

      // Check nano readiness
      const venv = checkVenv();
      const model = checkModel();
      if (!venv.ok || !model.ok) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Nano bridge not ready', code: 'NANO_NOT_READY', hint: 'Run: vai nano setup' }));
        return true;
      }

      const start = performance.now();
      const dimensions = {};

      for (const dim of VALID_DIMENSIONS) {
        const result = await generateLocalEmbeddings([body.text], { dimensions: dim });
        const embedding = result.data[0].embedding;

        // L2 norm
        let sumSq = 0;
        let nearZero = 0;
        for (let i = 0; i < embedding.length; i++) {
          sumSq += embedding[i] * embedding[i];
          if (Math.abs(embedding[i]) < 1e-6) nearZero++;
        }

        dimensions[dim] = {
          embedding,
          norm: Math.sqrt(sumSq),
          sparsity: nearZero / embedding.length,
        };
      }

      const latency_ms = Math.round(performance.now() - start);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        text: body.text,
        dimensions,
        latency_ms,
      }));
      return true;
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message, code: err.code || 'NANO_UNKNOWN' }));
      return true;
    }
  }

  // Not a nano endpoint
  return false;
}

module.exports = { handleNanoRequest };
