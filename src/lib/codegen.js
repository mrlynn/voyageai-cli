'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Safely get the CLI version, handling both development and packaged Electron app.
 * @returns {string} The version string or 'unknown'
 */
function getCliVersion() {
  // Try multiple paths to find package.json
  const possiblePaths = [
    path.join(__dirname, '..', '..', 'package.json'),  // Development: src/lib -> root
    path.join(process.resourcesPath || '', 'cli-package.json'),  // Packaged Electron app
    path.join(__dirname, '..', 'package.json'),  // Alternative structure
  ];
  
  for (const pkgPath of possiblePaths) {
    try {
      if (fs.existsSync(pkgPath)) {
        const pkg = require(pkgPath);
        if (pkg.version) return pkg.version;
      }
    } catch {
      // Try next path
    }
  }
  
  return 'unknown';
}

/**
 * Lightweight template engine for code generation.
 * 
 * Syntax:
 *   {{variable}}           - Variable substitution
 *   {{variable.nested}}    - Nested property access
 *   {{#if condition}}...{{/if}} - Conditional block
 *   {{#unless condition}}...{{/unless}} - Inverse conditional
 *   {{#each items}}...{{/each}} - Loop over array
 *   {{@index}}             - Current loop index (0-based)
 *   {{@first}}             - true if first iteration
 *   {{@last}}              - true if last iteration
 *   {{this}}               - Current item in loop
 * 
 * No dependencies. All templates are .tpl files.
 */

/**
 * Get a nested property from an object using dot notation.
 * @param {object} obj - The object to query
 * @param {string} path - Dot-separated path (e.g., "chunk.strategy")
 * @returns {*} The value or undefined
 */
function getPath(obj, path) {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Check if a value is truthy for template conditionals.
 * Empty arrays and empty strings are falsy.
 * @param {*} value
 * @returns {boolean}
 */
function isTruthy(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value === '') return false;
  return Boolean(value);
}

/**
 * Escape special regex characters in a string.
 * @param {string} str
 * @returns {string}
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Render a template string with the given context.
 * @param {string} template - Template string with {{...}} placeholders
 * @param {object} context - Data object for substitution
 * @returns {string} Rendered output
 */
function render(template, context = {}) {
  let result = template;

  // Process {{#each items}}...{{/each}} blocks first (can be nested)
  result = processEachBlocks(result, context);

  // Process {{#if condition}}...{{/if}} blocks
  result = processIfBlocks(result, context);

  // Process {{#unless condition}}...{{/unless}} blocks
  result = processUnlessBlocks(result, context);

  // Process simple variable substitutions {{variable}} and {{variable.nested}}
  result = result.replace(/\{\{(@?[a-zA-Z_][\w.]*)\}\}/g, (match, varPath) => {
    const value = getPath(context, varPath);
    if (value === undefined || value === null) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  });

  return result;
}

/**
 * Process {{#each items}}...{{/each}} blocks.
 * Supports nested each blocks and special variables: @index, @first, @last, this
 */
function processEachBlocks(template, context) {
  // Match {{#each varName}}...{{/each}} - non-greedy, handles nesting
  const eachRegex = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
  
  let result = template;
  let match;
  let iterations = 0;
  const maxIterations = 100; // Prevent infinite loops

  // Keep processing until no more matches (handles nested blocks)
  while ((match = eachRegex.exec(result)) !== null && iterations < maxIterations) {
    const [fullMatch, varName, blockContent] = match;
    const items = getPath(context, varName);

    if (!Array.isArray(items) || items.length === 0) {
      result = result.replace(fullMatch, '');
      eachRegex.lastIndex = 0; // Reset regex
      iterations++;
      continue;
    }

    const rendered = items.map((item, index) => {
      // Create loop context with special variables
      const loopContext = {
        ...context,
        '@index': index,
        '@first': index === 0,
        '@last': index === items.length - 1,
        'this': item,
      };

      // If item is an object, spread its properties into context
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        Object.assign(loopContext, item);
      }

      return render(blockContent, loopContext);
    }).join('');

    result = result.replace(fullMatch, rendered);
    eachRegex.lastIndex = 0; // Reset regex for next iteration
    iterations++;
  }

  return result;
}

/**
 * Process {{#if condition}}...{{/if}} and {{#if condition}}...{{else}}...{{/if}} blocks.
 * Handles nested blocks by processing iteratively from innermost to outermost.
 */
function processIfBlocks(template, context) {
  let result = template;
  let changed = true;
  let iterations = 0;
  const maxIterations = 50;

  // Process iteratively until no more matches (handles nesting)
  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    // Match if-else blocks that don't contain nested {{#if (innermost first)
    // This regex ensures we don't have another {{#if inside the captured groups
    const ifElseRegex = /\{\{#if\s+(@?\w+(?:\.\w+)*)\}\}((?:(?!\{\{#if)[\s\S])*?)\{\{else\}\}((?:(?!\{\{#if)[\s\S])*?)\{\{\/if\}\}/;
    
    let match = result.match(ifElseRegex);
    if (match) {
      const [fullMatch, varPath, ifBlock, elseBlock] = match;
      const value = getPath(context, varPath);
      const replacement = isTruthy(value) ? render(ifBlock, context) : render(elseBlock, context);
      result = result.replace(fullMatch, replacement);
      changed = true;
      continue;
    }

    // Match simple if blocks that don't contain nested {{#if
    const ifRegex = /\{\{#if\s+(@?\w+(?:\.\w+)*)\}\}((?:(?!\{\{#if)[\s\S])*?)\{\{\/if\}\}/;
    
    match = result.match(ifRegex);
    if (match) {
      const [fullMatch, varPath, blockContent] = match;
      const value = getPath(context, varPath);
      const replacement = isTruthy(value) ? render(blockContent, context) : '';
      result = result.replace(fullMatch, replacement);
      changed = true;
    }
  }

  return result;
}

/**
 * Process {{#unless condition}}...{{/unless}} blocks.
 */
function processUnlessBlocks(template, context) {
  const unlessRegex = /\{\{#unless\s+(@?\w+(?:\.\w+)*)\}\}([\s\S]*?)\{\{\/unless\}\}/g;

  return template.replace(unlessRegex, (match, varPath, blockContent) => {
    const value = getPath(context, varPath);
    return isTruthy(value) ? '' : render(blockContent, context);
  });
}

/**
 * Load a template file from the templates directory.
 * @param {string} target - Target framework: 'vanilla', 'nextjs', 'python'
 * @param {string} name - Template name (with or without .tpl extension)
 * @returns {string} Template content
 */
function loadTemplate(target, name) {
  const templatesDir = path.join(__dirname, 'templates', target);
  
  // Try exact name with .tpl
  let filePath = path.join(templatesDir, name.endsWith('.tpl') ? name : `${name}.tpl`);
  
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8');
  }
  
  // Try with common extensions
  const extensions = ['.js.tpl', '.jsx.tpl', '.py.tpl', '.json.tpl', '.md.tpl'];
  for (const ext of extensions) {
    filePath = path.join(templatesDir, `${name}${ext}`);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
  }
  
  throw new Error(`Template not found: ${target}/${name}`);
}

/**
 * List available templates for a target.
 * @param {string} target - Target framework
 * @returns {string[]} List of template names (without .tpl extension)
 */
function listTemplates(target) {
  const templatesDir = path.join(__dirname, 'templates', target);
  
  if (!fs.existsSync(templatesDir)) {
    return [];
  }
  
  return fs.readdirSync(templatesDir)
    .filter(f => f.endsWith('.tpl'))
    .map(f => f.replace('.tpl', ''));
}

/**
 * Get all available targets (framework directories).
 * @returns {string[]} List of target names
 */
function listTargets() {
  const templatesDir = path.join(__dirname, 'templates');
  
  if (!fs.existsSync(templatesDir)) {
    return [];
  }
  
  return fs.readdirSync(templatesDir)
    .filter(f => fs.statSync(path.join(templatesDir, f)).isDirectory());
}

/**
 * Render a template file with context.
 * @param {string} target - Target framework
 * @param {string} name - Template name
 * @param {object} context - Data for substitution
 * @returns {string} Rendered output
 */
function renderTemplate(target, name, context) {
  const template = loadTemplate(target, name);
  return render(template, context);
}

/**
 * Build a context object from project config and CLI options.
 * @param {object} project - Project config from .vai.json
 * @param {object} options - CLI options (overrides)
 * @returns {object} Merged context for templates
 */
function buildContext(project, options = {}) {
  const context = {
    // Core config
    model: options.model || project.model || 'voyage-3-large',
    db: options.db || project.db || 'myapp',
    collection: options.collection || project.collection || 'documents',
    field: options.field || project.field || 'embedding',
    index: options.index || project.index || 'vector_index',
    dimensions: options.dimensions || project.dimensions || 1024,
    inputType: options.inputType || project.inputType || 'document',

    // Chunk config
    chunkStrategy: project.chunk?.strategy || 'recursive',
    chunkSize: project.chunk?.size || 1000,
    chunkOverlap: project.chunk?.overlap || 200,

    // Feature flags
    rerank: options.rerank !== false && options.noRerank !== true,
    rerankModel: options.rerankModel || 'rerank-2.5',

    // Metadata
    generatedAt: new Date().toISOString(),
    vaiVersion: getCliVersion(),
    vaiVersion: require('../../package.json').version,
  };

  return context;
}

module.exports = {
  render,
  loadTemplate,
  listTemplates,
  listTargets,
  renderTemplate,
  buildContext,
  getPath,
  isTruthy,
};
