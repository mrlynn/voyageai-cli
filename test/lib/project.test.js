'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  PROJECT_FILE,
  PROJECT_VERSION,
  findProjectFile,
  loadProject,
  saveProject,
  mergeOptions,
  defaultProjectConfig,
} = require('../../src/lib/project');

describe('project', () => {
  describe('constants', () => {
    it('PROJECT_FILE is .vai.json', () => {
      assert.equal(PROJECT_FILE, '.vai.json');
    });

    it('PROJECT_VERSION is 1', () => {
      assert.equal(PROJECT_VERSION, 1);
    });
  });

  describe('defaultProjectConfig', () => {
    it('returns an object with required fields', () => {
      const config = defaultProjectConfig();
      assert.equal(config.model, 'voyage-4-large');
      assert.equal(config.field, 'embedding');
      assert.equal(config.inputType, 'document');
      assert.equal(config.dimensions, 1024);
      assert.ok(config.chunk);
      assert.equal(config.chunk.strategy, 'recursive');
      assert.equal(config.chunk.size, 512);
      assert.equal(config.chunk.overlap, 50);
    });
  });

  describe('saveProject / loadProject', () => {
    it('round-trips config through file', () => {
      const tmpDir = path.join(os.tmpdir(), `vai-proj-${Date.now()}`);
      fs.mkdirSync(tmpDir, { recursive: true });
      const filePath = path.join(tmpDir, PROJECT_FILE);

      const config = { model: 'voyage-4-lite', db: 'testdb', collection: 'docs' };
      saveProject(config, filePath);

      const { config: loaded, filePath: foundPath } = loadProject(tmpDir);
      assert.equal(loaded.version, PROJECT_VERSION);
      assert.equal(loaded.model, 'voyage-4-lite');
      assert.equal(loaded.db, 'testdb');
      assert.equal(foundPath, filePath);

      fs.rmSync(tmpDir, { recursive: true });
    });
  });

  describe('findProjectFile', () => {
    it('returns null when no .vai.json exists', () => {
      const tmpDir = path.join(os.tmpdir(), `vai-find-${Date.now()}`);
      fs.mkdirSync(tmpDir, { recursive: true });
      const result = findProjectFile(tmpDir);
      assert.equal(result, null);
      fs.rmSync(tmpDir, { recursive: true });
    });

    it('finds .vai.json in current directory', () => {
      const tmpDir = path.join(os.tmpdir(), `vai-find-${Date.now()}`);
      fs.mkdirSync(tmpDir, { recursive: true });
      const filePath = path.join(tmpDir, PROJECT_FILE);
      fs.writeFileSync(filePath, '{}');

      const result = findProjectFile(tmpDir);
      assert.equal(result, filePath);

      fs.rmSync(tmpDir, { recursive: true });
    });

    it('walks up to parent directory', () => {
      const tmpDir = path.join(os.tmpdir(), `vai-find-${Date.now()}`);
      const childDir = path.join(tmpDir, 'child');
      fs.mkdirSync(childDir, { recursive: true });
      const filePath = path.join(tmpDir, PROJECT_FILE);
      fs.writeFileSync(filePath, '{}');

      const result = findProjectFile(childDir);
      assert.equal(result, filePath);

      fs.rmSync(tmpDir, { recursive: true });
    });
  });

  describe('mergeOptions', () => {
    it('CLI options override project config', () => {
      const project = { model: 'voyage-4-large', db: 'projdb' };
      const cli = { model: 'voyage-4-lite' };
      const merged = mergeOptions(project, cli);
      assert.equal(merged.model, 'voyage-4-lite');
      assert.equal(merged.db, 'projdb');
    });

    it('falls through to project config when CLI is undefined', () => {
      const project = { model: 'voyage-4', db: 'mydb', collection: 'docs' };
      const merged = mergeOptions(project, {});
      assert.equal(merged.model, 'voyage-4');
      assert.equal(merged.db, 'mydb');
    });

    it('includes chunk config from project', () => {
      const project = { chunk: { strategy: 'sentence', size: 256 } };
      const merged = mergeOptions(project, {});
      assert.deepEqual(merged.chunk, { strategy: 'sentence', size: 256 });
    });
  });
});
