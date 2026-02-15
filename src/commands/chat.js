'use strict';

const readline = require('readline');
const { createLLMProvider, resolveLLMConfig } = require('../lib/llm');
const { ChatHistory } = require('../lib/history');
const { chatTurn, agentChatTurn } = require('../lib/chat');
const { loadProject } = require('../lib/project');
const { getMongoCollection } = require('../lib/mongo');
const { setConfigValue } = require('../lib/config');
const { runWizard } = require('../lib/wizard');
const { createCLIRenderer } = require('../lib/wizard-cli');
const { chatSetupSteps } = require('../lib/wizard-steps-chat');
const ui = require('../lib/ui');
const pc = require('picocolors');
const fs = require('fs');

/**
 * Register the chat command.
 * @param {import('commander').Command} program
 */
function registerChat(program) {
  program
    .command('chat')
    .description('RAG-powered conversational interface — chat with your knowledge base')
    .option('--db <name>', 'MongoDB database name')
    .option('--collection <name>', 'Collection with embedded documents')
    .option('--session <id>', 'Resume a previous chat session')
    .option('--llm-provider <name>', 'LLM provider: anthropic, openai, ollama')
    .option('--llm-model <name>', 'Specific LLM model to use')
    .option('--llm-api-key <key>', 'LLM API key')
    .option('--llm-base-url <url>', 'LLM API base URL (Ollama)')
    .option('--mode <mode>', 'Chat mode: pipeline (fixed RAG) or agent (tool-calling)', 'pipeline')
    .option('--max-context-docs <n>', 'Max retrieved documents for context', (v) => parseInt(v, 10), 5)
    .option('--max-turns <n>', 'Max conversation turns before truncation', (v) => parseInt(v, 10), 20)
    .option('--no-history', 'Disable MongoDB persistence (in-memory only)')
    .option('--no-rerank', 'Skip reranking step')
    .option('--no-stream', 'Wait for complete response instead of streaming')
    .option('--system-prompt <text>', 'Override the system prompt')
    .option('--text-field <name>', 'Document text field name', 'text')
    .option('--filter <json>', 'MongoDB pre-filter for vector search')
    .option('--estimate', 'Show estimated per-turn cost breakdown and exit')
    .option('--json', 'Output JSON per turn (for scripting)')
    .option('-q, --quiet', 'Suppress decorative output')
    .action(async (opts) => {
      try {
        await runChat(opts);
      } catch (err) {
        console.error(ui.error(err.message));
        process.exit(1);
      }
    });
}

async function runChat(opts) {
  const { config: proj } = loadProject();
  const chatConf = proj.chat || {};

  const db = opts.db || proj.db;
  const collection = opts.collection || proj.collection;
  const maxDocs = opts.maxContextDocs || chatConf.maxContextDocs || 5;
  const maxTurns = opts.maxTurns || chatConf.maxConversationTurns || 20;
  const textField = opts.textField || 'text';
  const doRerank = opts.rerank !== false;
  const doStream = opts.stream !== false;
  const systemPrompt = opts.systemPrompt || chatConf.systemPrompt;

  // Resolve mode
  const mode = opts.mode || chatConf.mode || 'pipeline';
  const isAgent = mode === 'agent';

  // Validate DB + collection (required for pipeline, recommended for agent)
  if (!isAgent && (!db || !collection)) {
    console.error(ui.error('Database and collection required for pipeline mode.'));
    console.error('');
    console.error('  Use --db and --collection, or configure .vai.json:');
    console.error('    vai init');
    console.error('');
    console.error('  Or use --mode agent to let the LLM discover collections.');
    console.error('');
    process.exit(1);
  }

  // Resolve LLM config — run interactive setup if missing
  let llmConfig = resolveLLMConfig(opts);
  if (!llmConfig.provider) {
    if (opts.json) {
      // Non-interactive mode — can't run wizard
      console.error(JSON.stringify({ error: 'No LLM provider configured. Run vai chat interactively to set up.' }));
      process.exit(1);
    }

    const { answers, cancelled } = await runWizard({
      steps: chatSetupSteps,
      config: llmConfig,
      renderer: createCLIRenderer({
        title: 'vai chat — LLM Setup',
        doneMessage: 'Configuration saved. Starting chat...',
      }),
    });

    if (cancelled) {
      process.exit(0);
    }

    // Persist to ~/.vai/config.json
    if (answers.provider) setConfigValue('llmProvider', answers.provider);
    if (answers.apiKey) setConfigValue('llmApiKey', answers.apiKey);
    if (answers.model) setConfigValue('llmModel', answers.model);
    if (answers.ollamaBaseUrl && answers.ollamaBaseUrl !== 'http://localhost:11434') {
      setConfigValue('llmBaseUrl', answers.ollamaBaseUrl);
    }

    // Re-resolve with new config
    llmConfig = resolveLLMConfig(opts);
  }

  // --estimate: show per-turn cost breakdown and exit
  if (opts.estimate) {
    const { estimateChatCost, formatChatCostBreakdown } = require('../lib/cost');
    const breakdown = estimateChatCost({
      query: 'How does authentication work?', // sample question
      contextDocs: maxDocs,
      embeddingModel: proj.model || 'voyage-4-large',
      rerankModel: doRerank ? 'rerank-2.5' : null,
      llmProvider: llmConfig.provider,
      llmModel: llmConfig.model,
      historyTurns: 0,
    });
    if (opts.json) {
      console.log(JSON.stringify(breakdown, null, 2));
    } else {
      console.log('');
      console.log(formatChatCostBreakdown(breakdown));
      console.log('');
    }
    return;
  }

  const llm = createLLMProvider(opts);

  // Check tool support for agent mode
  if (isAgent && !llm.supportsTools) {
    if (!opts.quiet && !opts.json) {
      console.log(ui.warn(`LLM provider "${llm.name}" does not support tool calling. Falling back to pipeline mode.`));
    }
    // Fall through to pipeline mode
    return runChat({ ...opts, mode: 'pipeline' });
  }

  // Preflight: verify the RAG pipeline is ready (pipeline mode only)
  if (!isAgent && !opts.json) {
    const { runPreflight, formatPreflight, waitForIndex } = require('../lib/preflight');
    const { checks, ready } = await runPreflight({
      db, collection,
      field: proj.field || 'embedding',
      llmConfig,
      textField,
    });

    console.log('');
    console.log(formatPreflight(checks));
    console.log('');

    if (!ready) {
      // Check if the only blocker is an index that's building
      const indexCheck = checks.find(c => c.id === 'vectorIndex');
      const otherFailures = checks.filter(c => !c.ok && c.id !== 'vectorIndex');

      if (indexCheck?.building && otherFailures.length === 0) {
        // Wait for it with a spinner
        const p = require('@clack/prompts');
        const spinner = p.spinner();
        spinner.start(`Index '${indexCheck.indexName}' is building — waiting for it to be ready...`);

        const result = await waitForIndex({
          db, collection,
          indexName: indexCheck.indexName,
          timeoutMs: 300000, // 5 minutes
        });

        if (result.ready) {
          const secs = Math.round(result.elapsed / 1000);
          spinner.stop(`Index ready (${secs}s)`);
        } else {
          spinner.stop(`Index not ready after ${Math.round(result.elapsed / 1000)}s (status: ${result.status})`);
          console.log('');
          console.log(pc.dim('  The index may need more time. Try again in a few minutes.'));
          console.log('');
          process.exit(1);
        }
      } else if (otherFailures.length > 0) {
        process.exit(1);
      }
    }
  }

  // Initialize history
  let historyMongo = null;
  if (opts.history !== false) {
    try {
      const historyCollection = chatConf.historyCollection ||
        process.env.VAI_CHAT_HISTORY || 'vai_chat_history';
      const { client, collection: coll } = await getMongoCollection(db || 'vai', historyCollection);
      historyMongo = { client, collection: coll };
      await ChatHistory.ensureIndexes(coll);
    } catch {
      // MongoDB persistence failure is non-fatal
      historyMongo = null;
    }
  }

  const history = new ChatHistory({
    sessionId: opts.session || undefined,
    maxTurns,
    mongo: historyMongo,
  });

  // Load existing session if resuming
  if (opts.session) {
    const loaded = await history.load();
    if (!loaded && !opts.quiet && !opts.json) {
      console.log(ui.warn(`Session ${opts.session} not found. Starting new conversation.`));
    }
  }

  // Telemetry: track session
  const telemetry = require('../lib/telemetry');
  const chatStartTime = Date.now();
  let turnCount = 0;

  // Track tool calls from last agent response (for /tools and /export-workflow)
  let lastToolCalls = [];

  // Print header
  if (!opts.quiet && !opts.json) {
    console.log('');
    console.log(`${pc.bold('vai chat')} v${getVersion()}`);
    console.log(ui.label('Provider', `${llmConfig.provider} (${llmConfig.model})`));
    if (isAgent) {
      console.log(ui.label('Mode', 'agent (tool-calling)'));
      if (db) console.log(ui.label('Default DB', db));
      if (collection) console.log(ui.label('Default collection', collection));
    } else {
      console.log(ui.label('Mode', 'pipeline (fixed RAG)'));
      console.log(ui.label('Knowledge base', `${db}.${collection}`));
    }
    console.log(ui.label('Session', pc.dim(history.sessionId)));
    console.log(pc.dim('Type /help for commands, /quit to exit.'));
    console.log('');
  }

  // Start REPL
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: pc.green('> '),
    terminal: !opts.json,
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    // Handle slash commands
    if (input.startsWith('/')) {
      const handled = await handleSlashCommand(input, {
        history, opts, db, collection, llm, rl, historyMongo,
        isAgent, lastToolCalls,
      });
      if (handled === 'quit') {
        await cleanup(historyMongo);
        process.exit(0);
      }
      rl.prompt();
      return;
    }

    // Execute chat turn
    turnCount++;
    try {
      if (isAgent) {
        lastToolCalls = await handleAgentTurn(input, {
          llm, history, opts, db, collection, systemPrompt, chatConf,
        });
      } else {
        await handlePipelineTurn(input, {
          db, collection, llm, history, opts,
          maxDocs, doRerank, doStream, systemPrompt, textField, chatConf,
        });
      }
    } catch (err) {
      console.error('');
      console.error(ui.error(err.message));
      console.error('');
    }

    rl.prompt();
  });

  function sendChatTelemetry() {
    telemetry.send('cli_chat', {
      provider: llmConfig.provider,
      llmModel: llmConfig.model,
      embeddingModel: proj.model || undefined,
      turnCount,
      durationMs: Date.now() - chatStartTime,
    });
  }

  rl.on('close', async () => {
    sendChatTelemetry();
    await cleanup(historyMongo);
    process.exit(0);
  });

  // Handle Ctrl+C gracefully
  rl.on('SIGINT', async () => {
    sendChatTelemetry();
    console.log('');
    await cleanup(historyMongo);
    process.exit(0);
  });
}

/**
 * Handle a single pipeline mode turn.
 */
async function handlePipelineTurn(input, ctx) {
  const { db, collection, llm, history, opts, maxDocs, doRerank, doStream, systemPrompt, textField, chatConf } = ctx;
  const turnNum = Math.floor(history.turns.length / 2) + 1;

  if (opts.json) {
    // JSON mode — collect everything then output
    let fullResponse = '';
    let sources = [];
    let metadata = {};

    for await (const event of chatTurn({
      query: input, db, collection, llm, history,
      opts: { maxDocs, rerank: doRerank, stream: false, systemPrompt, textField, filter: opts.filter },
    })) {
      if (event.type === 'chunk') fullResponse += event.data;
      if (event.type === 'done') {
        sources = event.data.sources;
        metadata = event.data.metadata;
      }
    }

    console.log(JSON.stringify({
      sessionId: history.sessionId,
      turn: turnNum,
      query: input,
      response: fullResponse,
      sources,
      metadata,
    }));
  } else {
    // Interactive mode — stream output
    let retrievalShown = false;

    for await (const event of chatTurn({
      query: input, db, collection, llm, history,
      opts: { maxDocs, rerank: doRerank, stream: doStream, systemPrompt, textField, filter: opts.filter },
    })) {
      if (event.type === 'retrieval' && !opts.quiet) {
        const { docs, timeMs } = event.data;
        if (!retrievalShown) {
          console.log(pc.dim(`  [${docs.length} docs retrieved in ${timeMs}ms]`));
          console.log('');
          retrievalShown = true;
        }
      }

      if (event.type === 'chunk') {
        process.stdout.write(event.data);
      }

      if (event.type === 'done') {
        console.log(''); // End the streamed response line

        // Show sources
        const { sources, metadata } = event.data;
        if (sources.length > 0 && chatConf.showSources !== false) {
          console.log('');
          console.log(pc.dim('Sources:'));
          for (let i = 0; i < sources.length; i++) {
            const s = sources[i];
            console.log(pc.dim(`  [${i + 1}] ${s.source} (relevance: ${s.score?.toFixed(2) || 'N/A'})`));
          }
        }
        console.log('');
      }
    }
  }
}

/**
 * Handle a single agent mode turn.
 * @returns {Array} Tool calls from this turn (for /tools and /export-workflow)
 */
async function handleAgentTurn(input, ctx) {
  const { llm, history, opts, db, collection, systemPrompt, chatConf } = ctx;
  const showToolCalls = chatConf.showToolCalls !== undefined ? chatConf.showToolCalls : true;
  const toolCalls = [];

  if (opts.json) {
    // JSON mode — collect everything then output
    let fullResponse = '';
    let metadata = {};

    for await (const event of agentChatTurn({
      query: input, llm, history,
      opts: { systemPrompt, db, collection },
    })) {
      if (event.type === 'tool_call') {
        toolCalls.push(event.data);
      }
      if (event.type === 'chunk') fullResponse += event.data;
      if (event.type === 'done') {
        metadata = event.data.metadata;
      }
    }

    console.log(JSON.stringify({
      sessionId: history.sessionId,
      query: input,
      response: fullResponse,
      toolCalls,
      metadata,
    }));
  } else {
    // Interactive mode
    for await (const event of agentChatTurn({
      query: input, llm, history,
      opts: { systemPrompt, db, collection },
    })) {
      if (event.type === 'tool_call') {
        toolCalls.push(event.data);
        if (showToolCalls) {
          const { name, timeMs, error } = event.data;
          if (error) {
            console.log(pc.dim(`  [tool] ${name} ${pc.red('failed')} (${timeMs}ms): ${error}`));
          } else if (showToolCalls === 'verbose') {
            console.log(pc.dim(`  [tool] ${name} (${timeMs}ms)`));
            const result = event.data.result;
            if (result) {
              const preview = JSON.stringify(result).substring(0, 200);
              console.log(pc.dim(`    ${preview}${JSON.stringify(result).length > 200 ? '...' : ''}`));
            }
          } else {
            console.log(pc.dim(`  [tool] ${name} (${timeMs}ms)`));
          }
        }
      }

      if (event.type === 'chunk') {
        if (toolCalls.length > 0 && !opts.quiet) {
          console.log(''); // Visual separator after tool calls
        }
        process.stdout.write(event.data);
      }

      if (event.type === 'done') {
        console.log(''); // End the response line
        console.log('');
      }
    }
  }

  return toolCalls;
}

/**
 * Handle slash commands within the REPL.
 * @returns {'quit'|true|false} - 'quit' to exit, true if handled, false if unknown
 */
async function handleSlashCommand(input, ctx) {
  const { history, opts, db, collection, llm, rl, isAgent, lastToolCalls } = ctx;
  const parts = input.split(/\s+/);
  const cmd = parts[0].toLowerCase();

  switch (cmd) {
    case '/quit':
    case '/exit':
    case '/q':
      return 'quit';

    case '/help':
      console.log('');
      console.log(pc.bold('Commands:'));
      console.log('  /sources    Show sources from last response');
      console.log('  /session    Display current session ID');
      console.log('  /history    List recent chat sessions');
      console.log('  /context    Show retrieved context from last query');
      console.log('  /clear      Clear conversation history');
      console.log('  /model      Show or switch LLM model (/model <name>)');
      console.log('  /export [format] [file]  Export conversation (markdown, json, pdf)');
      if (isAgent) {
        console.log('  /tools      Show tool calls from last response');
        console.log('  /export-workflow  Export last tool sequence as workflow');
      }
      console.log('  /help       Show this help');
      console.log('  /quit       Exit chat');
      console.log('');
      return true;

    case '/sources': {
      const sources = history.getLastSources();
      if (!sources) {
        console.log(pc.dim('  No sources available yet.'));
      } else {
        console.log('');
        for (let i = 0; i < sources.length; i++) {
          console.log(`  [${i + 1}] ${sources[i].source} (${sources[i].score?.toFixed(2) || 'N/A'})`);
        }
        console.log('');
      }
      return true;
    }

    case '/session':
      console.log(`  Session: ${history.sessionId}`);
      console.log(`  Turns: ${Math.floor(history.turns.length / 2)}`);
      if (isAgent) {
        console.log(`  Mode: agent (tool-calling)`);
      } else {
        console.log(`  Mode: pipeline (fixed RAG)`);
      }
      return true;

    case '/context': {
      const lastCtx = history.getLastContext();
      if (!lastCtx) {
        console.log(pc.dim('  No context available yet.'));
      } else {
        console.log('');
        for (const doc of lastCtx) {
          console.log(pc.bold(`  [${doc.source}]`));
          const preview = (doc.text || '').substring(0, 300);
          console.log(`  ${preview}${doc.text?.length > 300 ? '...' : ''}`);
          console.log('');
        }
      }
      return true;
    }

    case '/history': {
      if (!ctx.historyMongo) {
        console.log(pc.dim('  History persistence is disabled (--no-history or no MongoDB).'));
        return true;
      }
      try {
        const { listSessions } = require('../lib/history');
        const sessions = await listSessions(ctx.historyMongo.collection, 10);
        if (sessions.length === 0) {
          console.log(pc.dim('  No previous sessions found.'));
        } else {
          console.log('');
          for (const s of sessions) {
            const active = s.sessionId === history.sessionId ? pc.green(' <- current') : '';
            const date = s.lastActivity ? new Date(s.lastActivity).toLocaleString() : 'unknown';
            const preview = (s.firstMessage || '').substring(0, 60);
            console.log(`  ${pc.bold(s.sessionId.slice(0, 8))}  ${pc.dim(date)}  ${s.turnCount} turns${active}`);
            if (preview) console.log(`    ${pc.dim(preview)}${s.firstMessage?.length > 60 ? '...' : ''}`);
          }
          console.log('');
          console.log(pc.dim('  Resume with: vai chat --session <id>'));
        }
      } catch (err) {
        console.log(pc.dim(`  Error listing sessions: ${err.message}`));
      }
      return true;
    }

    case '/clear':
      history.clear();
      console.log(pc.dim('  Conversation cleared.'));
      return true;

    case '/model':
    case '/models': {
      if (parts.length > 1) {
        llm.model = parts[1];
        console.log(`  Model switched to: ${parts[1]}`);
      } else {
        console.log(`  Current model: ${pc.bold(llm.model)}`);
        console.log(`  Provider: ${llm.name}`);
        try {
          const { listModels } = require('../lib/llm');
          const models = await listModels(llm.name);
          if (models.length > 0) {
            console.log('');
            console.log(`  Available models:`);
            for (const m of models) {
              const current = m.id === llm.model ? pc.green(' <- current') : '';
              let info = m.name || m.id;
              if (m.size) info += pc.dim(` (${m.size})`);
              if (m.parameterSize) info += pc.dim(` [${m.parameterSize}]`);
              if (m.context) info += pc.dim(` ctx:${m.context}`);
              console.log(`    ${info}${current}`);
            }
            console.log('');
            console.log(pc.dim('  Switch with: /model <name>'));
          }
        } catch { /* ignore */ }
      }
      return true;
    }

    case '/export': {
      const format = parts[1] || 'markdown';
      const outFile = parts[2] || null;
      const validFormats = ['json', 'markdown', 'md', 'pdf'];

      if (!validFormats.includes(format)) {
        console.log(pc.dim(`  Unknown format: ${format}. Use: ${validFormats.join(', ')}`));
        return true;
      }

      try {
        const { exportArtifact } = require('../lib/export');
        const chatData = history.exportJSON();
        const effectiveFormat = format === 'md' ? 'markdown' : format;

        const result = await exportArtifact({
          context: 'chat',
          format: effectiveFormat,
          data: chatData,
          options: {},
        });

        const isBinary = Buffer.isBuffer(result.content);
        const filename = outFile || result.suggestedFilename;

        if (isBinary) {
          fs.writeFileSync(filename, result.content);
        } else {
          fs.writeFileSync(filename, result.content, 'utf-8');
        }
        console.log(ui.success(`Exported to ${filename}`));
      } catch (err) {
        console.log(pc.red(`  Export failed: ${err.message}`));
      }
      return true;
    }

    case '/tools': {
      if (!isAgent) {
        console.log(pc.dim('  /tools is only available in agent mode (--mode agent).'));
        return true;
      }
      if (!lastToolCalls || lastToolCalls.length === 0) {
        console.log(pc.dim('  No tool calls from the last response.'));
        return true;
      }
      console.log('');
      console.log(pc.bold(`  Tool calls (${lastToolCalls.length}):`));
      console.log('');
      for (let i = 0; i < lastToolCalls.length; i++) {
        const tc = lastToolCalls[i];
        const status = tc.error ? pc.red('FAILED') : pc.green('OK');
        console.log(`  ${i + 1}. ${pc.bold(tc.name)} [${status}] (${tc.timeMs}ms)`);

        // Show args
        const argKeys = Object.keys(tc.args || {});
        if (argKeys.length > 0) {
          const argStr = argKeys.map(k => `${k}=${JSON.stringify(tc.args[k])}`).join(', ');
          const preview = argStr.substring(0, 120);
          console.log(pc.dim(`     Args: ${preview}${argStr.length > 120 ? '...' : ''}`));
        }

        // Show result summary
        if (tc.error) {
          console.log(pc.dim(`     Error: ${tc.error}`));
        } else if (tc.result) {
          const resultStr = JSON.stringify(tc.result);
          const preview = resultStr.substring(0, 120);
          console.log(pc.dim(`     Result: ${preview}${resultStr.length > 120 ? '...' : ''}`));
        }
        console.log('');
      }
      return true;
    }

    case '/export-workflow': {
      if (!isAgent) {
        console.log(pc.dim('  /export-workflow is only available in agent mode (--mode agent).'));
        return true;
      }
      if (!lastToolCalls || lastToolCalls.length === 0) {
        console.log(pc.dim('  No tool calls to export. Ask a question first.'));
        return true;
      }

      const workflow = {
        name: `agent-workflow-${Date.now()}`,
        description: 'Workflow exported from vai chat agent session',
        version: '1.0.0',
        steps: lastToolCalls.map((tc, i) => ({
          id: `step_${i + 1}`,
          tool: tc.name,
          args: tc.args,
          description: `Step ${i + 1}: ${tc.name}`,
        })),
        metadata: {
          exportedAt: new Date().toISOString(),
          sessionId: history.sessionId,
          llmProvider: llm.name,
          llmModel: llm.model,
        },
      };

      const filename = `agent-workflow-${history.sessionId.slice(0, 8)}.vai-workflow.json`;
      fs.writeFileSync(filename, JSON.stringify(workflow, null, 2) + '\n');
      console.log(ui.success(`Exported ${lastToolCalls.length} tool calls to ${filename}`));
      return true;
    }

    default:
      console.log(pc.dim(`  Unknown command: ${cmd}. Type /help for available commands.`));
      return true;
  }
}

async function cleanup(mongo) {
  if (mongo?.client) {
    try { await mongo.client.close(); } catch { /* ignore */ }
  }
}

function getVersion() {
  try {
    const pkg = require('../../package.json');
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}

module.exports = { registerChat };
