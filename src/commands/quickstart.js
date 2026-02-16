'use strict';

const pc = require('picocolors');
const readline = require('readline');
const { getConfigValue } = require('../lib/config');
const { embed } = require('../lib/api');

/**
 * vai quickstart — Zero-to-search interactive tutorial
 * Gets developers from nothing to their first semantic search in minutes.
 */

const SAMPLE_DOCS = [
  "MongoDB Atlas Vector Search enables semantic search on your data using machine learning embeddings.",
  "Voyage AI provides state-of-the-art embedding models with the best quality-to-cost ratio.",
  "RAG (Retrieval-Augmented Generation) combines vector search with LLMs for accurate AI responses.",
  "The shared embedding space in Voyage 4 models lets you embed queries and documents with different models.",
  "Reranking improves search precision by re-scoring results with a cross-encoder model.",
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createPrompt() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return {
    ask: (question) => new Promise((resolve) => {
      rl.question(question, (answer) => resolve(answer));
    }),
    close: () => rl.close(),
  };
}

async function runQuickstart(options = {}) {
  const { skip } = options;
  
  console.log(pc.bold('\n🚀 Voyage AI CLI Quickstart\n'));
  console.log(pc.dim('This tutorial will get you from zero to semantic search in 2 minutes.\n'));
  
  // Check for API key
  const apiKey = process.env.VOYAGE_API_KEY || getConfigValue('apiKey');
  if (!apiKey) {
    console.log(pc.red('✗ No API key found.\n'));
    console.log('  First, get a free API key:');
    console.log(pc.cyan('  → https://dash.voyageai.com/api-keys\n'));
    console.log('  Then configure it:');
    console.log(pc.cyan('  → vai config set api-key YOUR_KEY\n'));
    console.log('  Or set the environment variable:');
    console.log(pc.cyan('  → export VOYAGE_API_KEY=YOUR_KEY\n'));
    return 1;
  }
  
  console.log(pc.green('✓') + ' API key configured\n');
  
  // Step 1: Explain what we're doing
  console.log(pc.bold('Step 1: Understanding Embeddings'));
  console.log(pc.dim('─'.repeat(40)));
  console.log(`
Embeddings turn text into ${pc.cyan('vectors')} (arrays of numbers) that capture
meaning. Similar texts have similar vectors, enabling semantic search.

We'll embed these ${SAMPLE_DOCS.length} sample documents:
`);
  
  SAMPLE_DOCS.forEach((doc, i) => {
    const preview = doc.length > 70 ? doc.slice(0, 70) + '...' : doc;
    console.log(`  ${i + 1}. ${pc.dim(preview)}`);
  });
  console.log('');
  
  if (!skip) {
    const prompt = createPrompt();
    await prompt.ask(pc.dim('Press Enter to continue...'));
    prompt.close();
  }
  
  // Step 2: Embed the documents
  console.log(pc.bold('\nStep 2: Embedding Documents'));
  console.log(pc.dim('─'.repeat(40)));
  console.log(`
Running: ${pc.cyan('vai embed --model voyage-4-lite')}
`);
  
  let embeddings;
  try {
    process.stdout.write('  Embedding documents... ');
    const result = await embed({
      texts: SAMPLE_DOCS,
      model: 'voyage-4-lite',
      inputType: 'document',
    });
    embeddings = result.embeddings;
    console.log(pc.green('✓'));
    console.log(`
  ${pc.green('✓')} Created ${embeddings.length} embeddings
  ${pc.dim(`  Dimensions: ${embeddings[0].length}`)}
  ${pc.dim(`  Model: voyage-4-lite`)}
`);
  } catch (err) {
    console.log(pc.red('✗'));
    console.log(pc.red(`\n  Error: ${err.message}\n`));
    console.log('  Check your API key with: vai doctor\n');
    return 1;
  }
  
  // Step 3: Search
  console.log(pc.bold('Step 3: Semantic Search'));
  console.log(pc.dim('─'.repeat(40)));
  
  const query = 'How do I improve search accuracy?';
  console.log(`
Now let's search! We'll embed a query and find the most similar documents.

Query: "${pc.cyan(query)}"
`);
  
  try {
    process.stdout.write('  Embedding query... ');
    const queryResult = await embed({
      texts: [query],
      model: 'voyage-4-lite',
      inputType: 'query',
    });
    const queryEmbedding = queryResult.embeddings[0];
    console.log(pc.green('✓'));
    
    // Calculate similarities
    const similarities = embeddings.map((docEmb, i) => {
      const dotProduct = docEmb.reduce((sum, val, j) => sum + val * queryEmbedding[j], 0);
      const normA = Math.sqrt(docEmb.reduce((sum, val) => sum + val * val, 0));
      const normB = Math.sqrt(queryEmbedding.reduce((sum, val) => sum + val * val, 0));
      return {
        index: i,
        score: dotProduct / (normA * normB),
        text: SAMPLE_DOCS[i],
      };
    });
    
    // Sort by similarity
    similarities.sort((a, b) => b.score - a.score);
    
    console.log(`
  ${pc.bold('Results (ranked by similarity):')}
`);
    
    similarities.forEach((item, rank) => {
      const scoreColor = item.score > 0.5 ? pc.green : item.score > 0.3 ? pc.yellow : pc.dim;
      const preview = item.text.length > 60 ? item.text.slice(0, 60) + '...' : item.text;
      console.log(`  ${rank + 1}. ${scoreColor(item.score.toFixed(3))} ${preview}`);
    });
    
  } catch (err) {
    console.log(pc.red('✗'));
    console.log(pc.red(`\n  Error: ${err.message}\n`));
    return 1;
  }
  
  // Success!
  console.log(pc.bold('\n✨ Congratulations!'));
  console.log(pc.dim('─'.repeat(40)));
  console.log(`
You just performed your first semantic search with Voyage AI!

The top result about ${pc.cyan('reranking')} is relevant because it discusses
improving search ${pc.cyan('precision')} — even though it doesn't contain the
exact words "improve" or "accuracy". That's the power of embeddings!

${pc.bold('Why Voyage AI?')}
  • ${pc.cyan('Best quality-to-cost ratio')} — SOTA quality at lower prices
  • ${pc.cyan('Shared embedding space')} — mix models for cost optimization
  • ${pc.cyan('Domain-specific models')} — code, finance, law, multilingual
  • ${pc.cyan('Reranking')} — boost precision with two-stage retrieval

${pc.bold('Next Steps:')}
  ${pc.cyan('vai explain embeddings')}  — Learn more about how embeddings work
  ${pc.cyan('vai explain reranking')}   — Understand two-stage retrieval
  ${pc.cyan('vai demo')}                — Full interactive walkthrough
  ${pc.cyan('vai pipeline')}            — Build a complete RAG pipeline
  ${pc.cyan('vai playground')}          — Visual exploration in your browser

${pc.dim('Docs: https://docs.voyageai.com | Dashboard: https://dash.voyageai.com')}
`);
  
  return 0;
}

function register(program) {
  program
    .command('quickstart')
    .description('Zero-to-search tutorial — learn semantic search in 2 minutes')
    .option('--skip', 'Skip interactive prompts')
    .action(async (options) => {
      const exitCode = await runQuickstart(options);
      process.exit(exitCode);
    });
}

module.exports = { register, runQuickstart };
