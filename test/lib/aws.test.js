'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { resolveAWSCredentials, parseBedrockEventStream, parseINIFile } = require('../../src/lib/aws');

describe('aws', () => {
  let tmpDir;
  let savedEnv;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vai-aws-test-'));
    savedEnv = {
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
      AWS_SESSION_TOKEN: process.env.AWS_SESSION_TOKEN,
      AWS_REGION: process.env.AWS_REGION,
      AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION,
      AWS_PROFILE: process.env.AWS_PROFILE,
      AWS_SHARED_CREDENTIALS_FILE: process.env.AWS_SHARED_CREDENTIALS_FILE,
    };
    // Clear all AWS env vars for hermetic tests
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_SESSION_TOKEN;
    delete process.env.AWS_REGION;
    delete process.env.AWS_DEFAULT_REGION;
    delete process.env.AWS_PROFILE;
    delete process.env.AWS_SHARED_CREDENTIALS_FILE;
  });

  afterEach(() => {
    // Restore env vars
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('parseINIFile', () => {
    it('parses a credentials file with default profile', () => {
      const credFile = path.join(tmpDir, 'credentials');
      fs.writeFileSync(credFile, [
        '[default]',
        'aws_access_key_id = AKIAEXAMPLE',
        'aws_secret_access_key = wJalrXUtnFEMI/K7EXAMPLE',
      ].join('\n'));

      const sections = parseINIFile(credFile);
      assert.equal(sections.default.aws_access_key_id, 'AKIAEXAMPLE');
      assert.equal(sections.default.aws_secret_access_key, 'wJalrXUtnFEMI/K7EXAMPLE');
    });

    it('parses multiple profiles', () => {
      const credFile = path.join(tmpDir, 'credentials');
      fs.writeFileSync(credFile, [
        '[default]',
        'aws_access_key_id = AKIADEFAULT',
        'aws_secret_access_key = secretDefault',
        '',
        '[staging]',
        'aws_access_key_id = AKIASTAGING',
        'aws_secret_access_key = secretStaging',
        'aws_session_token = tokenStaging',
      ].join('\n'));

      const sections = parseINIFile(credFile);
      assert.equal(sections.default.aws_access_key_id, 'AKIADEFAULT');
      assert.equal(sections.staging.aws_access_key_id, 'AKIASTAGING');
      assert.equal(sections.staging.aws_session_token, 'tokenStaging');
    });

    it('skips comments and blank lines', () => {
      const credFile = path.join(tmpDir, 'credentials');
      fs.writeFileSync(credFile, [
        '# This is a comment',
        '; Another comment',
        '',
        '[default]',
        'aws_access_key_id = AKIATEST',
        '# inline comment line',
        'aws_secret_access_key = secretTest',
      ].join('\n'));

      const sections = parseINIFile(credFile);
      assert.equal(sections.default.aws_access_key_id, 'AKIATEST');
      assert.equal(sections.default.aws_secret_access_key, 'secretTest');
    });

    it('returns empty object for missing file', () => {
      const sections = parseINIFile(path.join(tmpDir, 'nonexistent'));
      assert.deepEqual(sections, {});
    });
  });

  describe('resolveAWSCredentials', () => {
    it('returns env vars when set', () => {
      process.env.AWS_ACCESS_KEY_ID = 'AKIAENV';
      process.env.AWS_SECRET_ACCESS_KEY = 'secretEnv';
      process.env.AWS_REGION = 'us-west-2';
      process.env.AWS_SESSION_TOKEN = 'tokenEnv';

      const creds = resolveAWSCredentials();
      assert.equal(creds.accessKeyId, 'AKIAENV');
      assert.equal(creds.secretAccessKey, 'secretEnv');
      assert.equal(creds.region, 'us-west-2');
      assert.equal(creds.sessionToken, 'tokenEnv');
    });

    it('falls back to AWS_DEFAULT_REGION', () => {
      process.env.AWS_ACCESS_KEY_ID = 'AKIA';
      process.env.AWS_SECRET_ACCESS_KEY = 'secret';
      process.env.AWS_DEFAULT_REGION = 'eu-west-1';

      const creds = resolveAWSCredentials();
      assert.equal(creds.region, 'eu-west-1');
    });

    it('uses opts when env vars are not set', () => {
      const creds = resolveAWSCredentials({
        awsAccessKeyId: 'AKIAOPTS',
        awsSecretAccessKey: 'secretOpts',
        awsRegion: 'ap-southeast-1',
      });
      assert.equal(creds.accessKeyId, 'AKIAOPTS');
      assert.equal(creds.secretAccessKey, 'secretOpts');
      assert.equal(creds.region, 'ap-southeast-1');
    });

    it('env vars take precedence over opts', () => {
      process.env.AWS_ACCESS_KEY_ID = 'AKIAENV';
      process.env.AWS_SECRET_ACCESS_KEY = 'secretEnv';

      const creds = resolveAWSCredentials({
        awsAccessKeyId: 'AKIAOPTS',
        awsSecretAccessKey: 'secretOpts',
      });
      assert.equal(creds.accessKeyId, 'AKIAENV');
      assert.equal(creds.secretAccessKey, 'secretEnv');
    });

    it('reads from credentials file when env and opts are empty', () => {
      const credFile = path.join(tmpDir, 'credentials');
      fs.writeFileSync(credFile, [
        '[default]',
        'aws_access_key_id = AKIAFILE',
        'aws_secret_access_key = secretFile',
      ].join('\n'));
      process.env.AWS_SHARED_CREDENTIALS_FILE = credFile;

      const creds = resolveAWSCredentials();
      assert.equal(creds.accessKeyId, 'AKIAFILE');
      assert.equal(creds.secretAccessKey, 'secretFile');
    });

    it('respects AWS_PROFILE for credentials file', () => {
      const credFile = path.join(tmpDir, 'credentials');
      fs.writeFileSync(credFile, [
        '[default]',
        'aws_access_key_id = AKIADEFAULT',
        'aws_secret_access_key = secretDefault',
        '',
        '[staging]',
        'aws_access_key_id = AKIASTAGING',
        'aws_secret_access_key = secretStaging',
      ].join('\n'));
      process.env.AWS_SHARED_CREDENTIALS_FILE = credFile;
      process.env.AWS_PROFILE = 'staging';

      const creds = resolveAWSCredentials();
      assert.equal(creds.accessKeyId, 'AKIASTAGING');
      assert.equal(creds.secretAccessKey, 'secretStaging');
    });

    it('returns nulls for key fields when nothing is configured', () => {
      // Point credentials file to a path that does not exist
      process.env.AWS_SHARED_CREDENTIALS_FILE = path.join(tmpDir, 'nope');

      const creds = resolveAWSCredentials();
      assert.equal(creds.accessKeyId, null);
      assert.equal(creds.secretAccessKey, null);
      assert.equal(creds.sessionToken, null);
      // Region may be non-null if ~/.aws/config exists on the test machine,
      // so we just verify it's a string or null
      assert.ok(creds.region === null || typeof creds.region === 'string');
    });
  });

  describe('parseBedrockEventStream', () => {
    /**
     * Build a binary event stream message.
     * Simplified: only string headers, no CRC validation.
     */
    function buildEventMessage(payload, headers = {}) {
      const payloadBuf = Buffer.from(JSON.stringify(payload), 'utf8');

      // Build headers buffer
      const headerParts = [];
      for (const [key, value] of Object.entries(headers)) {
        const nameBuf = Buffer.from(key, 'utf8');
        const valueBuf = Buffer.from(value, 'utf8');
        const headerBuf = Buffer.alloc(1 + nameBuf.length + 1 + 2 + valueBuf.length);
        let offset = 0;
        headerBuf.writeUInt8(nameBuf.length, offset); offset += 1;
        nameBuf.copy(headerBuf, offset); offset += nameBuf.length;
        headerBuf.writeUInt8(7, offset); offset += 1; // string type
        headerBuf.writeUInt16BE(valueBuf.length, offset); offset += 2;
        valueBuf.copy(headerBuf, offset);
        headerParts.push(headerBuf);
      }
      const headersBuf = Buffer.concat(headerParts);

      const totalLength = 12 + headersBuf.length + payloadBuf.length + 4;
      const msg = Buffer.alloc(totalLength);
      let offset = 0;
      msg.writeUInt32BE(totalLength, offset); offset += 4;
      msg.writeUInt32BE(headersBuf.length, offset); offset += 4;
      msg.writeUInt32BE(0, offset); offset += 4; // prelude CRC (dummy)
      headersBuf.copy(msg, offset); offset += headersBuf.length;
      payloadBuf.copy(msg, offset); offset += payloadBuf.length;
      msg.writeUInt32BE(0, offset); // message CRC (dummy)

      return msg;
    }

    it('parses a single event message', async () => {
      const payload = { type: 'content_block_delta', delta: { text: 'Hello' } };
      const msg = buildEventMessage(payload, { ':event-type': 'chunk', ':content-type': 'application/json' });

      async function* fakeStream() { yield msg; }
      const events = [];
      for await (const event of parseBedrockEventStream(fakeStream())) {
        events.push(event);
      }

      assert.equal(events.length, 1);
      assert.equal(events[0].__event, 'content_block_delta');
      assert.equal(events[0].__data.delta.text, 'Hello');
    });

    it('parses multiple concatenated messages', async () => {
      const msg1 = buildEventMessage(
        { type: 'message_start', message: { usage: { input_tokens: 10 } } },
        { ':event-type': 'chunk' }
      );
      const msg2 = buildEventMessage(
        { type: 'content_block_delta', delta: { text: 'Hi' } },
        { ':event-type': 'chunk' }
      );
      const msg3 = buildEventMessage(
        { type: 'message_delta', usage: { output_tokens: 5 } },
        { ':event-type': 'chunk' }
      );

      async function* fakeStream() { yield Buffer.concat([msg1, msg2, msg3]); }
      const events = [];
      for await (const event of parseBedrockEventStream(fakeStream())) {
        events.push(event);
      }

      assert.equal(events.length, 3);
      assert.equal(events[0].__event, 'message_start');
      assert.equal(events[1].__event, 'content_block_delta');
      assert.equal(events[2].__event, 'message_delta');
    });

    it('handles data arriving in partial chunks', async () => {
      const payload = { type: 'content_block_delta', delta: { text: 'partial' } };
      const msg = buildEventMessage(payload, { ':event-type': 'chunk' });

      // Split the message into two chunks
      const mid = Math.floor(msg.length / 2);
      const part1 = msg.subarray(0, mid);
      const part2 = msg.subarray(mid);

      async function* fakeStream() {
        yield part1;
        yield part2;
      }
      const events = [];
      for await (const event of parseBedrockEventStream(fakeStream())) {
        events.push(event);
      }

      assert.equal(events.length, 1);
      assert.equal(events[0].__data.delta.text, 'partial');
    });

    it('handles base64-encoded bytes payload', async () => {
      const inner = { type: 'content_block_delta', delta: { text: 'decoded' } };
      const wrapper = { bytes: Buffer.from(JSON.stringify(inner)).toString('base64') };
      const msg = buildEventMessage(wrapper, { ':event-type': 'chunk' });

      async function* fakeStream() { yield msg; }
      const events = [];
      for await (const event of parseBedrockEventStream(fakeStream())) {
        events.push(event);
      }

      assert.equal(events.length, 1);
      assert.equal(events[0].__event, 'content_block_delta');
      assert.equal(events[0].__data.delta.text, 'decoded');
    });

    it('yields error events for exception messages', async () => {
      const payload = { message: 'Access denied' };
      const msg = buildEventMessage(payload, {
        ':event-type': 'exception',
        ':message-type': 'exception',
      });

      async function* fakeStream() { yield msg; }
      const events = [];
      for await (const event of parseBedrockEventStream(fakeStream())) {
        events.push(event);
      }

      assert.equal(events.length, 1);
      assert.equal(events[0].__event, 'error');
      assert.equal(events[0].__data.message, 'Access denied');
    });

    it('skips empty payload messages', async () => {
      // Build a message with empty payload
      const headersBuf = Buffer.alloc(0);
      const totalLength = 12 + 0 + 0 + 4; // prelude + no headers + no payload + CRC
      const msg = Buffer.alloc(totalLength);
      msg.writeUInt32BE(totalLength, 0);
      msg.writeUInt32BE(0, 4);
      msg.writeUInt32BE(0, 8);
      msg.writeUInt32BE(0, totalLength - 4);

      const realPayload = { type: 'content_block_delta', delta: { text: 'after' } };
      const msg2 = buildEventMessage(realPayload, { ':event-type': 'chunk' });

      async function* fakeStream() { yield Buffer.concat([msg, msg2]); }
      const events = [];
      for await (const event of parseBedrockEventStream(fakeStream())) {
        events.push(event);
      }

      assert.equal(events.length, 1);
      assert.equal(events[0].__data.delta.text, 'after');
    });
  });
});
