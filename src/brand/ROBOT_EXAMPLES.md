/**
 * @file ROBOT_INTEGRATION_EXAMPLES.md
 *
 * How to wire robot moments into existing vai commands.
 * Copy the relevant snippets into each command file.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. vai --help  (src/cli.js or wherever your root yargs setup lives)
// ─────────────────────────────────────────────────────────────────────────────

import { moments } from '../lib/robot-moments.js';
import { readFileSync } from 'fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));

// Add before yargs .usage() / .epilog():
moments.greet({ version, name: config.get('user-name') });


// ─────────────────────────────────────────────────────────────────────────────
// 2. vai ingest  (src/commands/ingest.js)
// ─────────────────────────────────────────────────────────────────────────────

export async function handler(argv) {
  // Show thinking animation while scanning files
  const anim = moments.startThinking(`Scanning ${argv.path}…`);

  try {
    const files = await scanFiles(argv.path);
    // Update label mid-animation isn't built-in, so just stop and restart:
    anim.stop();

    const anim2 = moments.startThinking(`Embedding ${files.length} files…`);
    const { chunks } = await embedAndIngest(files, argv);
    anim2.stop('success');

    moments.success(
      `Indexed ${chunks} chunks from ${files.length} files`,
      [
        `Collection: ${argv.collection}`,
        `Model:      ${argv.model ?? 'voyage-4-large'}`,
        `Run 'vai search' to test retrieval`,
      ]
    );
  } catch (err) {
    anim.stop('error');
    moments.error(err.message, 'Check your MongoDB URI and Voyage AI key');
    process.exit(1);
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// 3. vai search  (src/commands/search.js)
// ─────────────────────────────────────────────────────────────────────────────

export async function handler(argv) {
  const anim = moments.startSearching(
    `Searching ${argv.collection} · top-${argv.k ?? 5}…`
  );

  try {
    const start = Date.now();
    const hits = await vectorSearch(argv.query, argv);
    anim.stop(hits.length > 0 ? 'success' : 'idle');

    if (hits.length === 0) {
      moments.noResults(
        argv.collection,
        'Try a broader query or check that documents are ingested'
      );
      return;
    }

    moments.results(hits.length, argv.collection, Date.now() - start);
    // ... render hits table as normal
  } catch (err) {
    anim.stop('error');
    moments.error(err.message);
    process.exit(1);
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// 4. vai explain  (src/commands/explain.js)
// ─────────────────────────────────────────────────────────────────────────────

export async function handler(argv) {
  moments.explain(argv.topic);
  // ... existing explain output continues below
}


// ─────────────────────────────────────────────────────────────────────────────
// 5. vai init / vai config  (first-run setup)
// ─────────────────────────────────────────────────────────────────────────────

export async function handler(argv) {
  moments.setup('Let\'s configure vai for your project…');

  // ... prompts, config writing, etc.

  moments.success(
    'vai is configured and ready!',
    ['Run \'vai ingest\' to embed your first documents']
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// 6. vai chat  (src/commands/chat.js) — during RAG retrieval step
// ─────────────────────────────────────────────────────────────────────────────

async function handleTurn(userMessage, session) {
  // Show searching animation during retrieval
  const anim = moments.startSearching(`Searching ${session.collection}…`);
  const docs = await retrieveAndRerank(userMessage, session);
  anim.stop();

  // Show thinking animation during LLM generation
  const anim2 = moments.startThinking(`Generating with ${session.llmModel}…`);
  const response = await streamGenerate(docs, userMessage, session);
  anim2.stop();

  // ... stream response to terminal
}


// ─────────────────────────────────────────────────────────────────────────────
// 7. Plain/pipe mode guard  (add to any command)
// ─────────────────────────────────────────────────────────────────────────────

// Check if output is being piped — skip robot in that case
const isInteractive = process.stdout.isTTY && !argv.plain && !argv.json;

if (isInteractive) {
  moments.greet({ version });
} else {
  // plain text output only, no robot
}