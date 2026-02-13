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
            vai_website: 'https://vaicli.com',
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

      // Why Voyage AI?
      console.log(`  ${pc.bold(pc.green('Why Voyage AI?'))}`);
      console.log(`  Voyage AI provides state-of-the-art embedding models with`);
      console.log(`  the best quality-to-cost ratio in the industry.`);
      console.log('');
      console.log(`  ${pc.cyan('🎯 SOTA Quality')}`);
      console.log(`     Voyage-3 ranks #1 on MTEB retrieval benchmarks, outperforming`);
      console.log(`     OpenAI, Cohere, and other providers on real-world tasks.`);
      console.log('');
      console.log(`  ${pc.cyan('💰 Best Value')}`);
      console.log(`     Up to 83% cost reduction with asymmetric retrieval: embed`);
      console.log(`     documents with voyage-3-lite, query with voyage-3-large.`);
      console.log('');
      console.log(`  ${pc.cyan('🔗 Shared Embedding Space')}`);
      console.log(`     All Voyage-3 models share the same embedding space — mix`);
      console.log(`     and match models for optimal cost-quality tradeoffs.`);
      console.log('');
      console.log(`  ${pc.cyan('🏢 Domain-Specific Models')}`);
      console.log(`     Specialized models for code, finance, law, and multilingual`);
      console.log(`     content that outperform general-purpose alternatives.`);
      console.log('');
      console.log(`  ${pc.cyan('⚡ Reranking')}`);
      console.log(`     Two-stage retrieval with rerank-2 boosts precision by`);
      console.log(`     re-scoring candidates with a powerful cross-encoder.`);
      console.log('');

      // Features
      console.log(`  ${pc.bold('What You Can Do')}`);
      console.log(`  ${pc.cyan('vai quickstart')}   Zero-to-search tutorial (start here!)`);
      console.log(`  ${pc.cyan('vai embed')}        Generate vector embeddings for text`);
      console.log(`  ${pc.cyan('vai similarity')}   Compare texts with cosine similarity`);
      console.log(`  ${pc.cyan('vai rerank')}       Rerank documents against a query`);
      console.log(`  ${pc.cyan('vai search')}       Vector search against Atlas collections`);
      console.log(`  ${pc.cyan('vai store')}        Embed and store documents in Atlas`);
      console.log(`  ${pc.cyan('vai benchmark')}    Compare model latency, ranking & costs`);
      console.log(`  ${pc.cyan('vai doctor')}       Health-check your setup`);
      console.log(`  ${pc.cyan('vai explain')}      Learn about embeddings, vector search & more`);
      console.log(`  ${pc.cyan('vai playground')}   Launch interactive web playground`);
      console.log('');

      // Voyage AI Links
      console.log(`  ${pc.bold('Voyage AI Resources')}`);
      console.log(`  ${pc.dim('Docs:')}      https://docs.voyageai.com`);
      console.log(`  ${pc.dim('Dashboard:')} https://dash.voyageai.com`);
      console.log(`  ${pc.dim('Pricing:')}   https://voyageai.com/pricing`);
      console.log(`  ${pc.dim('Blog:')}      https://blog.voyageai.com`);
      console.log('');

      // Tool Links
      console.log(`  ${pc.bold('This Tool')}`);
      console.log(`  ${pc.dim('npm:')}     https://www.npmjs.com/package/voyageai-cli`);
      console.log(`  ${pc.dim('GitHub:')}  https://github.com/mrlynn/voyageai-cli`);
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
