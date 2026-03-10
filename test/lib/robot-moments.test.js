'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

describe('robot-moments', () => {
  let moments;
  let originalIsTTY;
  let originalWrite;
  let writeOutput;

  beforeEach(() => {
    originalIsTTY = process.stdout.isTTY;
    originalWrite = process.stdout.write;
    writeOutput = [];
    // Mock stdout.write to prevent terminal output during tests
    process.stdout.write = (data) => {
      writeOutput.push(data);
      return true;
    };
  });

  afterEach(() => {
    process.stdout.isTTY = originalIsTTY;
    process.stdout.write = originalWrite;
  });

  it('isInteractive returns false when stdout is not a TTY', () => {
    process.stdout.isTTY = false;
    // Re-require to get fresh module with mocked TTY
    const { isInteractive } = require('../../src/lib/robot-moments');
    assert.strictEqual(isInteractive(), false);
  });

  it('isInteractive returns false when json option is true', () => {
    process.stdout.isTTY = true;
    const { isInteractive } = require('../../src/lib/robot-moments');
    assert.strictEqual(isInteractive({ json: true }), false);
  });

  it('isInteractive returns false when plain option is true', () => {
    process.stdout.isTTY = true;
    const { isInteractive } = require('../../src/lib/robot-moments');
    assert.strictEqual(isInteractive({ plain: true }), false);
  });

  it('startWaving is a function', () => {
    const { startWaving } = require('../../src/lib/robot-moments');
    assert.strictEqual(typeof startWaving, 'function');
  });

  it('startThinking is a function', () => {
    const { startThinking } = require('../../src/lib/robot-moments');
    assert.strictEqual(typeof startThinking, 'function');
  });

  it('startSearching is a function', () => {
    const { startSearching } = require('../../src/lib/robot-moments');
    assert.strictEqual(typeof startSearching, 'function');
  });

  it('success is a function', () => {
    const { success } = require('../../src/lib/robot-moments');
    assert.strictEqual(typeof success, 'function');
  });

  it('error is a function', () => {
    const { error } = require('../../src/lib/robot-moments');
    assert.strictEqual(typeof error, 'function');
  });

  it('startWaving returns controller with stop method', () => {
    process.stdout.isTTY = true;
    const { startWaving } = require('../../src/lib/robot-moments');
    const controller = startWaving('Testing...');
    assert.ok(controller, 'should return a controller');
    assert.strictEqual(typeof controller.stop, 'function', 'controller should have stop method');
    controller.stop();
  });

  it('startThinking returns controller with stop method', () => {
    process.stdout.isTTY = true;
    const { startThinking } = require('../../src/lib/robot-moments');
    const controller = startThinking('Thinking...');
    assert.ok(controller, 'should return a controller');
    assert.strictEqual(typeof controller.stop, 'function', 'controller should have stop method');
    controller.stop();
  });

  it('startSearching returns controller with stop method', () => {
    process.stdout.isTTY = true;
    const { startSearching } = require('../../src/lib/robot-moments');
    const controller = startSearching('Searching...');
    assert.ok(controller, 'should return a controller');
    assert.strictEqual(typeof controller.stop, 'function', 'controller should have stop method');
    controller.stop();
  });
});
