'use strict';

const fs = require('fs');
const path = require('path');
const p = require('@clack/prompts');
const { loadProject } = require('../lib/project');
const { renderTemplate, buildContext, listTemplates } = require('../lib/codegen');
const { PROJECT_STRUCTURE } = require('../lib/scaffold-structure');
const ui = require('../lib/ui');

/**
 * Create a directory if it doesn't exist.
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Write a file, creating parent directories as needed.
 */
function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}

/**
 * Check if a directory exists and is not empty.
 */
function directoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) return false;
  const files = fs.readdirSync(dirPath);
  return files.length > 0;
}

/**
 * Register the scaffold command.
 * @param {import('commander').Command} program
 */
function registerScaffold(program) {
  program
    .command('scaffold <name>')
    .description('Create a complete starter project')
    .option('-t, --target <target>', 'Target framework: vanilla, nextjs, python', 'vanilla')
    .option('-m, --model <model>', 'Override embedding model')
    .option('--db <database>', 'Override database name')
    .option('--collection <name>', 'Override collection name')
    .option('--field <name>', 'Override embedding field name')
    .option('--index <name>', 'Override vector index name')
    .option('-d, --dimensions <n>', 'Override dimensions', parseInt)
    .option('--no-rerank', 'Omit reranking from generated code')
    .option('--rerank-model <model>', 'Rerank model to use')
    .option('--force', 'Overwrite existing directory')
    .option('--json', 'Output file manifest as JSON (no file creation)')
    .option('--dry-run', 'Show what would be created without writing')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(async (name, opts) => {
      try {
        const target = opts.target;
        const projectDir = path.resolve(process.cwd(), name);
        
        // Validate target
        if (!PROJECT_STRUCTURE[target]) {
          console.error(ui.error(`Invalid target: ${target}`));
          console.error(ui.dim(`  Valid targets: ${Object.keys(PROJECT_STRUCTURE).join(', ')}`));
          process.exit(1);
        }
        
        const structure = PROJECT_STRUCTURE[target];
        
        // Check if directory exists
        if (directoryExists(projectDir) && !opts.force && !opts.dryRun && !opts.json) {
          console.error(ui.error(`Directory already exists: ${name}`));
          console.error(ui.dim('  Use --force to overwrite.'));
          process.exit(1);
        }
        
        // Load project config
        let project = {};
        try {
          project = loadProject();
        } catch (e) {
          // No .vai.json, use defaults
          if (!opts.quiet && !opts.json) {
            console.error(ui.warn('No .vai.json found, using defaults'));
          }
        }
        
        // Build context with overrides
        const context = buildContext(project, {
          model: opts.model,
          db: opts.db,
          collection: opts.collection,
          field: opts.field,
          index: opts.index,
          dimensions: opts.dimensions,
          rerank: opts.rerank,
          rerankModel: opts.rerankModel,
          projectName: name,
        });
        
        // Build file manifest
        const manifest = [];
        
        // Render template files
        for (const file of structure.files) {
          const content = renderTemplate(target, file.template, context);
          manifest.push({
            path: file.output,
            fullPath: path.join(projectDir, file.output),
            source: `${target}/${file.template}`,
            size: content.length,
            content,
          });
        }
        
        // Add extra static files
        if (structure.extraFiles) {
          for (const file of structure.extraFiles) {
            const content = typeof file.content === 'function' 
              ? file.content(context) 
              : file.content;
            manifest.push({
              path: file.output,
              fullPath: path.join(projectDir, file.output),
              source: 'static',
              size: content.length,
              content,
            });
          }
        }
        
        // JSON output mode
        if (opts.json) {
          const output = {
            name,
            target,
            directory: projectDir,
            files: manifest.map(f => ({
              path: f.path,
              size: f.size,
              source: f.source,
            })),
            config: context,
          };
          console.log(JSON.stringify(output, null, 2));
          return;
        }
        
        // Dry run mode
        if (opts.dryRun) {
          console.log('');
          console.log(ui.bold(`Would create: ${name}/ (${structure.description})`));
          console.log('');
          for (const file of manifest) {
            console.log(`  ${ui.cyan('+')} ${file.path} ${ui.dim(`(${file.size} bytes)`)}`);
          }
          console.log('');
          console.log(ui.dim(`Total: ${manifest.length} files`));
          return;
        }
        
        // Create project directory
        if (!opts.quiet) {
          console.log('');
          console.log(ui.bold(`Creating ${name}/ (${structure.description})`));
          console.log('');
        }
        
        ensureDir(projectDir);
        
        // Write all files
        for (const file of manifest) {
          writeFile(file.fullPath, file.content);
          if (!opts.quiet) {
            console.log(`  ${ui.cyan('✓')} ${file.path}`);
          }
        }
        
        // Success message with next steps
        if (!opts.quiet) {
          console.log('');
          console.log(ui.success(`Created ${manifest.length} files in ${name}/`));
          console.log('');
          
          // Use clack's note for next steps
          const steps = [
            `cd ${name}`,
            `cp .env.example .env`,
            `# Edit .env with your API keys`,
            structure.postInstall,
            structure.startCommand,
          ];
          
          p.note(steps.join('\n'), 'Next steps');
          
          console.log('');
          console.log(ui.dim('Configuration:'));
          console.log(ui.dim(`  Model:      ${context.model}`));
          console.log(ui.dim(`  Database:   ${context.db}.${context.collection}`));
          console.log(ui.dim(`  Dimensions: ${context.dimensions}`));
          if (context.rerank) {
            console.log(ui.dim(`  Reranking:  ${context.rerankModel}`));
          }
          console.log('');
        }
        
      } catch (err) {
        console.error(ui.error(err.message));
        if (process.env.DEBUG) console.error(err.stack);
        process.exit(1);
      }
    });
}

module.exports = { registerScaffold, PROJECT_STRUCTURE };
