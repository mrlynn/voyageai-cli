'use strict';

const { randomUUID } = require('node:crypto');
const { createNanoError } = require('./nano-errors.js');

/**
 * NDJSON envelope types used in the bridge protocol.
 */
const ENVELOPE_TYPES = Object.freeze({
  EMBED: 'embed',
  RESULT: 'result',
  ERROR: 'error',
  READY: 'ready',
});

/**
 * Build a request envelope with a unique id.
 *
 * @param {string} type     One of ENVELOPE_TYPES (e.g. 'embed').
 * @param {object} payload  Additional fields to include in the envelope.
 * @returns {object}        Request envelope: { id, type, ...payload }
 */
function createRequest(type, payload) {
  return {
    id: randomUUID(),
    type,
    ...payload,
  };
}

/**
 * Serialize a request envelope to an NDJSON line (JSON + newline).
 *
 * @param {object} requestObj  The request envelope object.
 * @returns {string}           JSON string terminated with '\n'.
 */
function serializeRequest(requestObj) {
  return JSON.stringify(requestObj) + '\n';
}

/**
 * Parse a single NDJSON line into an object.
 *
 * @param {string} line  Raw line from the bridge stdout.
 * @returns {object}     Parsed JSON object.
 * @throws {Error}       NANO_JSON_PARSE_ERROR on malformed input.
 */
function parseLine(line) {
  try {
    return JSON.parse(line);
  } catch (_parseErr) {
    throw createNanoError('NANO_JSON_PARSE_ERROR');
  }
}

/**
 * Validate that a response envelope matches the expected request id and
 * contains a type field.
 *
 * @param {object} response   Parsed response envelope.
 * @param {string} requestId  The id from the original request.
 * @returns {boolean}         true when valid.
 * @throws {Error}            When validation fails.
 */
function validateResponse(response, requestId) {
  if (!response || typeof response !== 'object') {
    throw new Error('Response is not an object');
  }
  if (!response.type) {
    throw new Error('Response missing type field');
  }
  if (response.id !== requestId) {
    throw new Error(
      `Response id mismatch: expected ${requestId}, got ${response.id}`,
    );
  }
  return true;
}

module.exports = {
  ENVELOPE_TYPES,
  createRequest,
  serializeRequest,
  parseLine,
  validateResponse,
};
