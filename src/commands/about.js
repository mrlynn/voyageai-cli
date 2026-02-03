'use strict';

const pc = require('picocolors');

/**
 * Register the about command on a Commander program.
 * @param {import('commander').Command} program
 */
function registerAbout(program) {
  program
    .command('about')
    .description('About this tool and its author')
    .option('--json', 'Machine-readable JSON output')
    .action((opts) => {
      if (opts.json) {
        console.log(JSON.stringify({
          tool: 'voyageai-cli',
          binary: 'vai',
          author: {
            name: 'Michael Lynn',
            role: 'Principal Staff Developer Advocate, MongoDB',
            github: 'https://github.com/mrlynn',
            website: 'https://mlynn.org',
          },
          links: {
            npm: 'https://www.npmjs.com/package/voyageai-cli',
            github: 'https://github.com/mrlynn/voyageai-cli',
            docs: 'https://www.mongodb.com/docs/voyageai/',
          },
          disclaimer: 'Community tool — not an official MongoDB or Voyage AI product.',
        }, null, 2));
        return;
      }

      console.log('');
      console.log(`  ${pc.bold(pc.cyan('voyageai-cli'))} ${pc.dim('(vai)')}`);
      console.log(`  ${pc.dim('Voyage AI embeddings, reranking & Atlas Vector Search CLI')}`);
      console.log('');

      // Author
      console.log(`  ${pc.bold('Author')}`);
      console.log(`  Michael Lynn`);
      console.log(`  ${pc.dim('Principal Staff Developer Advocate · MongoDB')}`);
      console.log(`  ${pc.dim('25+ years enterprise infrastructure · 10+ years at MongoDB')}`);
      console.log('');

      // About
      console.log(`  ${pc.bold('About This Project')}`);
      console.log(`  A community-built CLI for working with Voyage AI embeddings,`);
      console.log(`  reranking, and MongoDB Atlas Vector Search. Created to help`);
      console.log(`  developers explore, benchmark, and integrate Voyage AI models`);
      console.log(`  into their applications — right from the terminal.`);
      console.log('');

      // Features
      console.log(`  ${pc.bold('What You Can Do')}`);
      console.log(`  ${pc.cyan('vai embed')}        Generate vector embeddings for text`);
      console.log(`  ${pc.cyan('vai similarity')}   Compare texts with cosine similarity`);
      console.log(`  ${pc.cyan('vai rerank')}       Rerank documents against a query`);
      console.log(`  ${pc.cyan('vai search')}       Vector search against Atlas collections`);
      console.log(`  ${pc.cyan('vai store')}        Embed and store documents in Atlas`);
      console.log(`  ${pc.cyan('vai benchmark')}    Compare model latency, ranking & costs`);
      console.log(`  ${pc.cyan('vai explain')}      Learn about embeddings, vector search & more`);
      console.log(`  ${pc.cyan('vai playground')}   Launch interactive web playground`);
      console.log('');

      // Links
      console.log(`  ${pc.bold('Links')}`);
      console.log(`  ${pc.dim('npm:')}     https://www.npmjs.com/package/voyageai-cli`);
      console.log(`  ${pc.dim('GitHub:')}  https://github.com/mrlynn/voyageai-cli`);
      console.log(`  ${pc.dim('Docs:')}    https://www.mongodb.com/docs/voyageai/`);
      console.log(`  ${pc.dim('Author:')}  https://mlynn.org`);
      console.log('');

      // Disclaimer
      console.log(`  ${pc.yellow('⚠ Community Tool Disclaimer')}`);
      console.log(`  ${pc.dim('This tool is not an official product of MongoDB, Inc. or')}`);
      console.log(`  ${pc.dim('Voyage AI. It is independently built and maintained by')}`);
      console.log(`  ${pc.dim('Michael Lynn as a community resource. Not supported,')}`);
      console.log(`  ${pc.dim('endorsed, or guaranteed by either company.')}`);
      console.log('');
    });
}

module.exports = { registerAbout };
