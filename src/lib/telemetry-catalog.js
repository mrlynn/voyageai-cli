'use strict';

const BASE_FIELDS = [
  {
    name: 'event',
    type: 'string',
    description: 'Telemetry event identifier.',
  },
  {
    name: 'version',
    type: 'string',
    description: 'Current vai version.',
  },
  {
    name: 'context',
    type: 'string',
    description: 'Runtime surface, such as `cli` or `desktop`.',
  },
  {
    name: 'platform',
    type: 'string',
    description: 'Platform and architecture, for example `darwin-arm64`.',
  },
  {
    name: 'locale',
    type: 'string',
    description: 'Resolved runtime locale.',
  },
];

const TELEMETRY_EVENTS = [
  {
    name: 'cli_benchmark',
    fields: ['subcommand', 'durationMs'],
    source: 'src/commands/benchmark.js',
    description: 'Benchmark subcommand run timing.',
  },
  {
    name: 'cli_chat',
    fields: ['provider', 'llmModel', 'embeddingModel', 'turnCount', 'durationMs'],
    source: 'src/commands/chat.js',
    description: 'Interactive chat session summary.',
  },
  {
    name: 'cli_chunk',
    fields: ['strategy', 'chunkSize', 'overlap', 'chunkCount', 'durationMs'],
    source: 'src/commands/chunk.js',
    description: 'Chunking configuration and output size.',
  },
  {
    name: 'cli_code_search_init',
    fields: [],
    source: 'src/commands/code-search.js',
    description: 'Code-search workspace initialization.',
  },
  {
    name: 'cli_code_search_query',
    fields: ['model', 'rerank', 'resultCount', 'durationMs'],
    source: 'src/commands/code-search.js',
    description: 'Code-search query execution summary.',
  },
  {
    name: 'cli_code_search_refresh',
    fields: [],
    source: 'src/commands/code-search.js',
    description: 'Code-search refresh operation.',
  },
  {
    name: 'cli_command',
    fields: ['command'],
    source: 'src/cli.js',
    description: 'Top-level CLI command invocation.',
  },
  {
    name: 'cli_content',
    fields: ['type', 'platform'],
    source: 'src/commands/content.js',
    description: 'Content generation request summary.',
  },
  {
    name: 'cli_embed',
    fields: [
      'model',
      'multimodal',
      'hasText',
      'hasImage',
      'hasVideo',
      'local',
      'inputType',
      'textCount',
      'outputDtype',
      'dimensions',
      'durationMs',
    ],
    source: 'src/commands/embed.js',
    description: 'Embedding request summary.',
  },
  {
    name: 'cli_error',
    fields: ['command', 'errorType'],
    source: 'src/commands/*',
    description: 'High-level command failure type.',
  },
  {
    name: 'cli_estimate',
    fields: ['model', 'tokenCount'],
    source: 'src/commands/estimate.js',
    description: 'Estimator usage summary.',
  },
  {
    name: 'cli_eval',
    fields: ['durationMs'],
    source: 'src/commands/eval.js',
    description: 'Evaluation command timing.',
  },
  {
    name: 'cli_explain',
    fields: ['topic'],
    source: 'src/commands/explain.js',
    description: 'Explain topic selection.',
  },
  {
    name: 'cli_explain_code_run',
    fields: [],
    source: 'src/commands/index-workspace.js',
    description: 'Explain-code operation.',
  },
  {
    name: 'cli_generate',
    fields: ['provider', 'model'],
    source: 'src/commands/generate.js',
    description: 'Code generation request summary.',
  },
  {
    name: 'cli_index_workspace_run',
    fields: ['contentType'],
    source: 'src/commands/index-workspace.js',
    description: 'Workspace indexing operation.',
  },
  {
    name: 'cli_ingest',
    fields: ['durationMs'],
    source: 'src/commands/ingest.js',
    description: 'Ingest command timing.',
  },
  {
    name: 'cli_init',
    fields: [],
    source: 'src/commands/init.js',
    description: 'Project initialization command.',
  },
  {
    name: 'cli_mcp_start',
    fields: ['transport'],
    source: 'src/commands/mcp-server.js',
    description: 'MCP server startup mode.',
  },
  {
    name: 'cli_models',
    fields: ['category'],
    source: 'src/commands/models.js',
    description: 'Model catalog filter usage.',
  },
  {
    name: 'cli_ping',
    fields: ['voyageOk', 'mongoOk'],
    source: 'src/commands/ping.js',
    description: 'Connectivity check summary.',
  },
  {
    name: 'cli_pipeline',
    fields: ['model', 'chunkStrategy', 'chunkSize', 'createIndex', 'durationMs'],
    source: 'src/commands/pipeline.js',
    description: 'End-to-end pipeline execution summary.',
  },
  {
    name: 'cli_query',
    fields: ['model', 'rerankModel', 'rerank', 'limit', 'topK', 'resultCount', 'durationMs'],
    source: 'src/commands/query.js',
    description: 'Vector query execution summary.',
  },
  {
    name: 'cli_rerank',
    fields: ['model', 'docCount', 'topK', 'durationMs'],
    source: 'src/commands/rerank.js',
    description: 'Rerank request summary.',
  },
  {
    name: 'cli_scaffold',
    fields: ['template'],
    source: 'src/commands/scaffold.js',
    description: 'Project scaffold template selection.',
  },
  {
    name: 'cli_search',
    fields: ['model', 'limit', 'durationMs'],
    source: 'src/commands/search.js',
    description: 'Search command summary.',
  },
  {
    name: 'cli_search_code_run',
    fields: ['language'],
    source: 'src/commands/index-workspace.js',
    description: 'Workspace code-search operation.',
  },
  {
    name: 'cli_similarity',
    fields: ['model', 'durationMs'],
    source: 'src/commands/similarity.js',
    description: 'Similarity comparison timing.',
  },
  {
    name: 'cli_store',
    fields: ['model', 'durationMs'],
    source: 'src/commands/store.js',
    description: 'Store command timing.',
  },
  {
    name: 'cli_welcome_complete',
    fields: ['hasApiKey', 'hasMongo', 'keyType'],
    source: 'src/lib/welcome.js',
    description: 'Welcome wizard completion summary.',
  },
  {
    name: 'cli_workflow_install',
    fields: ['packageName'],
    source: 'src/commands/workflow.js',
    description: 'Workflow package install request.',
  },
  {
    name: 'cli_workflow_run',
    fields: ['workflowName', 'stepCount', 'isBuiltin', 'durationMs'],
    source: 'src/commands/workflow.js',
    description: 'Workflow run summary.',
  },
  {
    name: 'cli_workflow_search',
    fields: ['query', 'resultCount'],
    source: 'src/commands/workflow.js',
    description: 'Workflow catalog search summary.',
  },
  {
    name: 'demo_chat_completed',
    fields: ['duration', 'fileCount', 'chunkCount', 'queries', 'llmProvider', 'llmModel'],
    source: 'src/commands/demo.js',
    description: 'Chat demo completion summary.',
  },
  {
    name: 'demo_cleanup',
    fields: ['collectionsDropped'],
    source: 'src/commands/demo.js',
    description: 'Demo cleanup summary.',
  },
  {
    name: 'demo_code_search_completed',
    fields: ['duration', 'files', 'chunks', 'tokens'],
    source: 'src/commands/demo.js',
    description: 'Code-search demo completion summary.',
  },
  {
    name: 'demo_cost_optimizer_completed',
    fields: ['duration', 'docCount', 'queries'],
    source: 'src/commands/demo.js',
    description: 'Cost-optimizer demo completion summary.',
  },
  {
    name: 'desktop_launch',
    fields: ['electronVersion', 'appVersion'],
    source: 'electron/main.js',
    description: 'Desktop application launch summary.',
  },
  {
    name: 'optimize_completed',
    fields: ['queryCount', 'docsScale', 'queriesPerMonth'],
    source: 'src/commands/optimize.js',
    description: 'Optimizer scenario summary.',
  },
];

function getTelemetryEvents() {
  return TELEMETRY_EVENTS.slice();
}

function getTelemetryEvent(name) {
  return TELEMETRY_EVENTS.find((event) => event.name === name) || null;
}

module.exports = {
  BASE_FIELDS,
  TELEMETRY_EVENTS,
  getTelemetryEvents,
  getTelemetryEvent,
};
