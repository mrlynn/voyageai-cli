'use strict';

const pc = require('picocolors');
const ui = require('../lib/ui');
const { generateWithContext } = require('../lib/content-generation');

const VALID_TYPES = ['blog-post', 'social-post', 'code-example', 'video-script'];

/**
 * Register the content generation command on a Commander program.
 * @param {import('commander').Command} program
 */
function registerContent(program) {
  program
    .command('content')
    .description('Generate content drafts (blog, social, code examples, video scripts) with your LLM provider')
    .requiredOption('-t, --type <type>', `Content type: ${VALID_TYPES.join(', ')}`)
    .requiredOption('--topic <text>', 'Topic or title for the content')
    .option('-p, --platform <platform>', 'Platform hint (e.g. linkedin, devto, hashnode, youtube, loom)')
    .option('-i, --instructions <text>', 'Additional instructions for style, audience, or constraints')
    .option('--json', 'Machine-readable JSON output')
    .option('-q, --quiet', 'Suppress decorative output')
    .action(async (opts) => {
      const telemetry = require('../lib/telemetry');
      const contentType = opts.type;
      const topic = opts.topic;

      try {
        telemetry.send('cli_content', {
          type: contentType,
          platform: opts.platform || null,
        });

        // Basic validation beyond Commander’s requiredOption
        if (!VALID_TYPES.includes(contentType)) {
          console.error(
            ui.error(
              `Invalid content type: "${contentType}". Must be one of: ${VALID_TYPES.join(', ')}`
            )
          );
          process.exit(1);
        }

        if (!topic || typeof topic !== 'string' || topic.trim() === '') {
          console.error(ui.error('Topic is required and must be a non-empty string.'));
          process.exit(1);
        }

        const spinner = !opts.json && !opts.quiet ? ui.spinner('Generating content...') : null;
        if (spinner) spinner.start();

        const result = await generateWithContext({
          contentType,
          topic: topic.trim(),
          platform: opts.platform,
          additionalInstructions: opts.instructions,
          // knowledgeContext is left for callers to wire in via higher-level flows
        });

        if (spinner) spinner.stop();

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        const draft = result.draft;
        console.log('');
        console.log(`${pc.bold('Type')}: ${pc.cyan(draft.type)}`);
        console.log(`${pc.bold('Topic')}: ${draft.title}`);
        if (draft.platform) {
          console.log(`${pc.bold('Platform')}: ${draft.platform}`);
        }
        console.log(`${pc.bold('Model')}: ${result.model || 'unknown'}`);
        console.log(`${pc.bold('Tokens')}: ${result.tokensUsed}`);
        console.log('');
        console.log(pc.bold('Draft:'));
        console.log('─'.repeat(60));
        console.log(draft.body);
        console.log('─'.repeat(60));
        console.log('');
      } catch (err) {
        console.error(ui.error(err.message || String(err)));
        process.exit(1);
      }
    });
}

module.exports = { registerContent };

