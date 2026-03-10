'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Parse an INI-format file (like ~/.aws/credentials or ~/.aws/config).
 * Returns an object keyed by section name, each value is a key-value map.
 *
 * @param {string} filePath
 * @returns {Record<string, Record<string, string>>}
 */
function parseINIFile(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return {};
  }
  const sections = {};
  let current = null;
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) continue;
    const section = trimmed.match(/^\[(.+)\]$/);
    if (section) {
      current = section[1].trim();
      sections[current] = {};
    } else if (current) {
      const eq = trimmed.indexOf('=');
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1).trim();
        sections[current][key] = value;
      }
    }
  }
  return sections;
}

/**
 * Resolve AWS credentials from environment, opts, and standard AWS files.
 *
 * Resolution order (first non-null wins per field):
 *   1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, etc.)
 *   2. Explicit opts (from vai config storage)
 *   3. ~/.aws/credentials file (INI, respects AWS_PROFILE)
 *   4. ~/.aws/config for region
 *
 * @param {object} [opts]
 * @param {string} [opts.awsAccessKeyId]
 * @param {string} [opts.awsSecretAccessKey]
 * @param {string} [opts.awsRegion]
 * @returns {{ accessKeyId: string|null, secretAccessKey: string|null, sessionToken: string|null, region: string|null }}
 */
function resolveAWSCredentials(opts = {}) {
  const profile = process.env.AWS_PROFILE || 'default';

  // 1 + 2: env vars and opts (env takes precedence)
  let accessKeyId = process.env.AWS_ACCESS_KEY_ID || opts.awsAccessKeyId || null;
  let secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || opts.awsSecretAccessKey || null;
  let sessionToken = process.env.AWS_SESSION_TOKEN || null;
  let region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || opts.awsRegion || null;

  // 3: ~/.aws/credentials file
  if (!accessKeyId || !secretAccessKey) {
    const credPath = process.env.AWS_SHARED_CREDENTIALS_FILE
      || path.join(os.homedir(), '.aws', 'credentials');
    const sections = parseINIFile(credPath);
    const creds = sections[profile] || {};
    accessKeyId = accessKeyId || creds.aws_access_key_id || null;
    secretAccessKey = secretAccessKey || creds.aws_secret_access_key || null;
    sessionToken = sessionToken || creds.aws_session_token || null;
  }

  // 4: ~/.aws/config for region
  if (!region) {
    const configPath = path.join(os.homedir(), '.aws', 'config');
    const sections = parseINIFile(configPath);
    // In config file, non-default profiles use "profile NAME" as section header
    const configProfile = profile === 'default' ? 'default' : `profile ${profile}`;
    const conf = sections[configProfile] || sections[profile] || {};
    region = conf.region || null;
  }

  return { accessKeyId, secretAccessKey, sessionToken, region };
}

/**
 * Parse binary headers from an AWS event stream message.
 * Header format: 1-byte name length, N-byte name, 1-byte type, 2-byte value length, M-byte value.
 *
 * @param {Buffer} buf - Header bytes
 * @returns {Record<string, string>}
 */
function parseEventHeaders(buf) {
  const headers = {};
  let offset = 0;
  while (offset < buf.length) {
    const nameLen = buf.readUInt8(offset);
    offset += 1;
    const name = buf.subarray(offset, offset + nameLen).toString('utf8');
    offset += nameLen;
    const valueType = buf.readUInt8(offset);
    offset += 1;
    if (valueType === 7) {
      // String type
      const valueLen = buf.readUInt16BE(offset);
      offset += 2;
      const value = buf.subarray(offset, offset + valueLen).toString('utf8');
      offset += valueLen;
      headers[name] = value;
    } else {
      // Skip other types (we only need string headers for event-type)
      // For safety, break to avoid infinite loops on unknown formats
      break;
    }
  }
  return headers;
}

/**
 * Parse an AWS binary event stream (application/vnd.amazon.eventstream).
 *
 * Each message:
 *   - 4 bytes: total message length (big-endian uint32)
 *   - 4 bytes: headers length (big-endian uint32)
 *   - 4 bytes: prelude CRC32
 *   - {headersLength} bytes: headers
 *   - payload bytes (totalLength - 12 - headersLength - 4)
 *   - 4 bytes: message CRC32
 *
 * Yields objects matching the shape of parseSSEWithMeta(): { __event, __data }
 *
 * @param {ReadableStream|AsyncIterable} body
 * @yields {{ __event: string|null, __data: object|string }}
 */
async function* parseBedrockEventStream(body) {
  let buffer = Buffer.alloc(0);

  for await (const chunk of body) {
    buffer = Buffer.concat([buffer, Buffer.from(chunk)]);

    // Process all complete messages in the buffer
    while (buffer.length >= 12) {
      const totalLength = buffer.readUInt32BE(0);
      const headersLength = buffer.readUInt32BE(4);
      // Byte 8-11: prelude CRC (skip validation, HTTPS provides integrity)

      if (buffer.length < totalLength) break; // wait for more data

      const headersStart = 12;
      const headersEnd = 12 + headersLength;
      const payloadEnd = totalLength - 4; // last 4 bytes = message CRC

      // Parse headers to get event type
      const headers = parseEventHeaders(buffer.subarray(headersStart, headersEnd));
      const eventType = headers[':event-type'] || null;
      const messageType = headers[':message-type'] || null;

      // Skip exception messages (surface them as errors)
      if (messageType === 'exception') {
        const payloadBuf = buffer.subarray(headersEnd, payloadEnd);
        let errData;
        try {
          errData = JSON.parse(payloadBuf.toString('utf8'));
        } catch {
          errData = payloadBuf.toString('utf8');
        }
        buffer = buffer.subarray(totalLength);
        yield { __event: 'error', __data: errData };
        continue;
      }

      // Parse payload
      const payloadBuf = buffer.subarray(headersEnd, payloadEnd);
      if (payloadBuf.length === 0) {
        buffer = buffer.subarray(totalLength);
        continue;
      }

      let data;
      try {
        data = JSON.parse(payloadBuf.toString('utf8'));
      } catch {
        data = payloadBuf.toString('utf8');
      }

      // Bedrock wraps Anthropic events: payload may have { bytes: "base64..." }
      if (data && data.bytes) {
        const decoded = Buffer.from(data.bytes, 'base64').toString('utf8');
        try {
          data = JSON.parse(decoded);
        } catch {
          data = decoded;
        }
      }

      yield { __event: data?.type || eventType, __data: data };

      buffer = buffer.subarray(totalLength);
    }
  }
}

module.exports = {
  resolveAWSCredentials,
  parseBedrockEventStream,
  parseINIFile,
};
