'use strict';

const path = require('path');
const fs = require('fs');
const { generateEmbeddings, apiRequest } = require('../../lib/api');
const { getMongoCollection } = require('../../lib/mongo');
const { loadProject, saveProject } = require('../../lib/project');
const {
  DEFAULT_CODE_MODEL,
  DEFAULT_DB,
  smartChunkCode,
  extractSymbols,
  findCodeFiles,
  resolveConfig,
  deriveCollectionName,
  selectCodeModel,
  CODE_EXTENSIONS,
} = require('../../lib/code-search');
const {
  isGitHubUrl,
  parseGitHubUrl,
  getAuthToken,
  fetchRepoTree,
  fetchFilesBatch,
  fetchChangedFiles,
  resolveCommitSha,
} = require('../../lib/github');

const DEFAULT_INDEX_NAME = 'code_search_index';

/**
 * Resolve db/collection for MCP tools, falling back through input > project config > defaults.
 */
function resolveDbColl(input) {
  const { db, collection, model } = resolveConfig(
    { db: input.db, collection: input.collection, model: input.model },
    undefined
  );
  return { db, collection, model };
}

/**
 * Handler for vai_code_index.
 */
async function handleCodeIndex(input) {
  const start = Date.now();
  const source = input.source;
  const isRemote = isGitHubUrl(source);
  const batchSize = input.batchSize || 20;

  let resolvedPath, db, collName, model;

  if (isRemote) {
    const { owner, repo } = parseGitHubUrl(source);
    db = input.db || DEFAULT_DB;
    collName = input.collection || `${repo}_code`;
    model = input.model || DEFAULT_CODE_MODEL;
    resolvedPath = `github:${owner}/${repo}`;
  } else {
    resolvedPath = path.resolve(source);
    const resolved = resolveConfig(
      { db: input.db, collection: input.collection, model: input.model },
      resolvedPath
    );
    db = resolved.db;
    collName = resolved.collection;
    model = resolved.model;
  }

  const stats = { filesFound: 0, filesIndexed: 0, chunksCreated: 0, errors: [], totalTokens: 0 };
  let client;

  try {
    const { client: c, collection } = await getMongoCollection(db, collName);
    client = c;

    let allDocs = [];

    if (isRemote) {
      // GitHub remote indexing
      const { owner, repo } = parseGitHubUrl(source);
      const token = getAuthToken();
      const branch = input.branch || 'main';

      const tree = await fetchRepoTree(owner, repo, branch, token);
      const headSha = await resolveCommitSha(owner, repo, branch, token);
      const codeFiles = tree.filter(entry => {
        const ext = path.extname(entry.path).toLowerCase();
        return CODE_EXTENSIONS.includes(ext) && entry.size <= (input.maxFileSize || 100000) && entry.size > 0;
      }).slice(0, input.maxFiles || 5000);

      stats.filesFound = codeFiles.length;

      let didIncrementalRefresh = false;

      if (input.refresh) {
        // Check stored commit SHA for incremental
        const meta = await collection.findOne({ _type: 'index_meta', workspace: resolvedPath });
        if (meta?.commitSha) {
          try {
            const changed = await fetchChangedFiles(owner, repo, meta.commitSha, branch, token);
            const changedSet = new Set(changed.map(f => f.filename));
            const deletedFiles = changed.filter(f => f.status === 'removed').map(f => f.filename);
            if (deletedFiles.length > 0) {
              await collection.deleteMany({ 'metadata.workspace': resolvedPath, 'metadata.source': { $in: deletedFiles } });
            }
            const filesToFetch = codeFiles.filter(f => changedSet.has(f.path));
            if (filesToFetch.length === 0) {
              // Update stored SHA even when up to date
              await collection.updateOne(
                { _type: 'index_meta', workspace: resolvedPath },
                { $set: { commitSha: headSha, updatedAt: new Date().toISOString() } },
                { upsert: true }
              );
              return {
                structuredContent: { ...stats, source: resolvedPath, sourceType: 'github', db, collection: collName, model, timeMs: Date.now() - start, refresh: true, indexName: DEFAULT_INDEX_NAME, message: 'Up to date' },
                content: [{ type: 'text', text: 'Index is up to date, no changes detected.' }],
              };
            }
            // Only fetch changed files
            const fetched = await fetchFilesBatch(owner, repo, filesToFetch.map(f => f.path), branch, token);
            await collection.deleteMany({ 'metadata.workspace': resolvedPath, 'metadata.source': { $in: filesToFetch.map(f => f.path) } });
            for (const file of fetched) {
              if (file.error) { stats.errors.push({ file: file.path, error: file.error }); continue; }
              processFile(file.path, file.content, resolvedPath, input, allDocs, stats);
            }
            didIncrementalRefresh = true;
          } catch {
            // Compare failed, fall through to full index below
          }
        }
      }

      if (!didIncrementalRefresh && allDocs.length === 0) {
        // Full index (either not refreshing, or incremental failed/no prior SHA)
        await collection.deleteMany({ 'metadata.workspace': resolvedPath });

        const filePaths = codeFiles.map(f => f.path);
        const fetched = await fetchFilesBatch(owner, repo, filePaths, branch, token);

        for (const file of fetched) {
          if (file.error) { stats.errors.push({ file: file.path, error: file.error }); continue; }
          processFile(file.path, file.content, resolvedPath, input, allDocs, stats);
        }
      }

      // Store actual commit SHA for future refresh
      await collection.updateOne(
        { _type: 'index_meta', workspace: resolvedPath },
        { $set: { _type: 'index_meta', workspace: resolvedPath, commitSha: headSha, updatedAt: new Date().toISOString() } },
        { upsert: true }
      );

    } else {
      // Local indexing
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Directory not found: ${resolvedPath}`);
      }

      const files = await findCodeFiles(resolvedPath, { maxFiles: input.maxFiles, maxFileSize: input.maxFileSize });
      stats.filesFound = files.length;

      // Auto model selection
      if (!input.model) {
        const { config: proj } = loadProject(resolvedPath);
        model = selectCodeModel(files, proj);
      }

      if (input.refresh) {
        // Incremental refresh
        const indexedFiles = await collection.aggregate([
          { $match: { 'metadata.workspace': resolvedPath } },
          { $group: { _id: '$metadata.source', mtime: { $max: '$metadata.mtime' } } },
        ]).toArray();
        const indexedMap = new Map(indexedFiles.map(f => [f._id, f.mtime]));
        const currentPaths = new Set();

        for (const filePath of files) {
          const relativePath = path.relative(resolvedPath, filePath);
          currentPaths.add(relativePath);
          const fileStats = await fs.promises.stat(filePath);
          const indexedMtime = indexedMap.get(relativePath);
          if (!indexedMtime || fileStats.mtimeMs > indexedMtime) {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            await collection.deleteMany({ 'metadata.workspace': resolvedPath, 'metadata.source': relativePath });
            processFile(relativePath, content, resolvedPath, input, allDocs, stats, filePath, fileStats.mtimeMs);
          }
        }

        // Delete removed files
        const deletedSources = [];
        for (const [source] of indexedMap) {
          if (!currentPaths.has(source)) deletedSources.push(source);
        }
        if (deletedSources.length > 0) {
          await collection.deleteMany({ 'metadata.workspace': resolvedPath, 'metadata.source': { $in: deletedSources } });
        }
      } else {
        // Full index
        await collection.deleteMany({ 'metadata.workspace': resolvedPath });

        for (const filePath of files) {
          try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            const relativePath = path.relative(resolvedPath, filePath);
            const fileStats = await fs.promises.stat(filePath);
            processFile(relativePath, content, resolvedPath, input, allDocs, stats, filePath, fileStats.mtimeMs);
          } catch (err) {
            stats.errors.push({ file: filePath, error: err.message });
          }
        }
      }
    }

    stats.chunksCreated = allDocs.length;

    // Embed and insert in batches
    for (let i = 0; i < allDocs.length; i += batchSize) {
      const batch = allDocs.slice(i, i + batchSize);
      const texts = batch.map(d => d.text);
      const embedResult = await generateEmbeddings(texts, { model, inputType: 'document' });
      stats.totalTokens += embedResult.usage?.total_tokens || 0;

      const docsToInsert = batch.map((doc, idx) => ({
        text: doc.text,
        embedding: embedResult.data[idx].embedding,
        metadata: doc.metadata,
      }));

      await collection.insertMany(docsToInsert);
    }

    // Create vector search index
    try {
      await collection.createSearchIndex({
        name: DEFAULT_INDEX_NAME,
        type: 'vectorSearch',
        definition: {
          fields: [
            { type: 'vector', path: 'embedding', numDimensions: 1024, similarity: 'cosine' },
            { type: 'filter', path: 'metadata.language' },
            { type: 'filter', path: 'metadata.workspace' },
          ],
        },
      });
    } catch (err) {
      if (!err.message?.includes('already exists')) {
        stats.errors.push({ file: '_index', error: `Could not create search index: ${err.message}` });
      }
    }

    const timeMs = Date.now() - start;
    const structured = {
      source: isRemote ? source : resolvedPath,
      sourceType: isRemote ? 'github' : 'local',
      db,
      collection: collName,
      model,
      filesFound: stats.filesFound,
      filesIndexed: stats.filesIndexed,
      chunksCreated: stats.chunksCreated,
      totalTokens: stats.totalTokens,
      errors: stats.errors,
      timeMs,
      refresh: input.refresh || false,
      indexName: DEFAULT_INDEX_NAME,
    };

    return {
      structuredContent: structured,
      content: [{ type: 'text', text: `Indexed ${stats.filesIndexed} files (${stats.chunksCreated} chunks) into ${db}.${collName} using ${model} in ${timeMs}ms. Tokens: ${stats.totalTokens}.${stats.errors.length ? ` Errors: ${stats.errors.length}` : ''}` }],
    };
  } finally {
    if (client) await client.close();
  }
}

/**
 * Process a single file into chunks and add to allDocs.
 */
function processFile(relativePath, content, workspace, input, allDocs, stats, absolutePath, mtime) {
  const ext = path.extname(relativePath).toLowerCase();
  const symbols = extractSymbols(content, relativePath);
  const chunks = smartChunkCode(content, relativePath, {
    chunkSize: input.chunkSize,
    chunkOverlap: input.chunkOverlap,
  });

  for (const c of chunks) {
    allDocs.push({
      text: c.text,
      metadata: {
        source: relativePath,
        filePath: absolutePath || relativePath,
        workspace,
        language: ext.slice(1),
        startLine: c.startLine,
        endLine: c.endLine,
        chunkType: c.type,
        symbols: symbols.filter(s => c.text.includes(s)),
        mtime: mtime || Date.now(),
        indexedAt: new Date().toISOString(),
      },
    });
  }
  stats.filesIndexed++;
}

/**
 * Handler for vai_code_search.
 */
async function handleCodeSearch(input) {
  const start = Date.now();
  const { db, collection: collName, model } = resolveDbColl(input);
  const codeModel = model || DEFAULT_CODE_MODEL;
  const limit = input.limit || 10;
  const doRerank = input.rerank !== false;
  const rerankModel = input.rerankModel || 'rerank-2.5';
  const candidateMultiplier = input._candidateMultiplier || 3;

  let client;
  try {
    // Embed query
    const embedResult = await generateEmbeddings([input.query], { model: codeModel, inputType: 'query' });
    const queryVector = embedResult.data[0].embedding;
    const embedTokens = embedResult.usage?.total_tokens || 0;

    const { client: c, collection } = await getMongoCollection(db, collName);
    client = c;

    // Build filter
    const filter = {};
    if (input.language) filter['metadata.language'] = input.language;
    if (input.category) filter['metadata.chunkType'] = input.category;
    if (input.filter) Object.assign(filter, input.filter);

    const numCandidates = Math.min(limit * 15, 10000);
    const vectorSearchStage = {
      index: DEFAULT_INDEX_NAME,
      path: 'embedding',
      queryVector,
      numCandidates,
      limit: doRerank ? limit * candidateMultiplier : limit,
    };
    if (Object.keys(filter).length > 0) vectorSearchStage.filter = filter;

    const searchResults = await collection.aggregate([
      { $vectorSearch: vectorSearchStage },
      { $addFields: { _vsScore: { $meta: 'vectorSearchScore' } } },
    ]).toArray();

    if (searchResults.length === 0) {
      return {
        structuredContent: { query: input.query, results: [], metadata: { collection: collName, model: codeModel, reranked: false, timeMs: Date.now() - start, resultCount: 0, tokens: { embed: embedTokens, rerank: 0 } } },
        content: [{ type: 'text', text: `No results found for "${input.query}" in ${db}.${collName}` }],
      };
    }

    let finalResults;
    let rerankTokens = 0;

    if (doRerank && searchResults.length > 1) {
      const documents = searchResults.map(d => d.text || '');
      const rerankResult = await apiRequest('/rerank', {
        query: input.query,
        documents,
        model: rerankModel,
        top_k: limit,
      });
      rerankTokens = rerankResult.usage?.total_tokens || 0;

      finalResults = (rerankResult.data || []).map(item => {
        const doc = searchResults[item.index];
        return {
          source: doc.metadata?.source || 'unknown',
          filePath: doc.metadata?.filePath || doc.metadata?.source || 'unknown',
          language: doc.metadata?.language,
          startLine: doc.metadata?.startLine,
          endLine: doc.metadata?.endLine,
          symbols: doc.metadata?.symbols || [],
          content: (doc.text || '').substring(0, 300),
          score: item.relevance_score,
          vectorScore: doc._vsScore,
          rerankScore: item.relevance_score,
          chunkType: doc.metadata?.chunkType,
        };
      });
    } else {
      finalResults = searchResults.slice(0, limit).map(doc => ({
        source: doc.metadata?.source || 'unknown',
        filePath: doc.metadata?.filePath || doc.metadata?.source || 'unknown',
        language: doc.metadata?.language,
        startLine: doc.metadata?.startLine,
        endLine: doc.metadata?.endLine,
        symbols: doc.metadata?.symbols || [],
        content: (doc.text || '').substring(0, 300),
        score: doc._vsScore,
        vectorScore: doc._vsScore,
        chunkType: doc.metadata?.chunkType,
      }));
    }

    const timeMs = Date.now() - start;
    const structured = {
      query: input.query,
      results: finalResults,
      metadata: {
        collection: collName,
        model: codeModel,
        rerankModel: doRerank ? rerankModel : null,
        reranked: doRerank && searchResults.length > 1,
        timeMs,
        resultCount: finalResults.length,
        tokens: { embed: embedTokens, rerank: rerankTokens },
      },
    };

    const textLines = finalResults.map((r, i) =>
      `[${i + 1}] ${r.source}:${r.startLine}-${r.endLine} (${r.language}) score:${(r.score || 0).toFixed(3)}\n  symbols: ${(r.symbols || []).slice(0, 5).join(', ')}\n  ${r.content.split('\n').slice(0, 3).join('\n  ')}`
    );

    return {
      structuredContent: structured,
      content: [{ type: 'text', text: `Found ${finalResults.length} results for "${input.query}" (${timeMs}ms):\n\n${textLines.join('\n\n')}` }],
    };
  } finally {
    if (client) await client.close();
  }
}

/**
 * Handler for vai_code_query — thin wrapper on code_search with different defaults.
 */
async function handleCodeQuery(input) {
  return handleCodeSearch({
    ...input,
    limit: input.limit || 5,
    rerank: true,
    rerankModel: input.rerankModel || 'rerank-2.5',
    _candidateMultiplier: 5,
  });
}

/**
 * Handler for vai_code_find_similar.
 */
async function handleCodeFindSimilar(input) {
  const start = Date.now();
  const { db, collection: collName, model } = resolveDbColl(input);
  const codeModel = model || DEFAULT_CODE_MODEL;
  const limit = input.limit || 10;
  const threshold = input.threshold || 0.5;

  let client;
  try {
    const embedResult = await generateEmbeddings([input.code], { model: codeModel, inputType: 'query' });
    const queryVector = embedResult.data[0].embedding;
    const embedTokens = embedResult.usage?.total_tokens || 0;

    const { client: c, collection } = await getMongoCollection(db, collName);
    client = c;

    const filter = {};
    if (input.language) filter['metadata.language'] = input.language;
    if (input.filter) Object.assign(filter, input.filter);

    const vectorSearchStage = {
      index: DEFAULT_INDEX_NAME,
      path: 'embedding',
      queryVector,
      numCandidates: Math.min(limit * 15, 10000),
      limit: limit * 2,
    };
    if (Object.keys(filter).length > 0) vectorSearchStage.filter = filter;

    const results = await collection.aggregate([
      { $vectorSearch: vectorSearchStage },
      { $addFields: { _vsScore: { $meta: 'vectorSearchScore' } } },
    ]).toArray();

    const filtered = results
      .filter(r => r._vsScore >= threshold)
      .slice(0, limit)
      .map(doc => ({
        source: doc.metadata?.source || 'unknown',
        filePath: doc.metadata?.filePath || doc.metadata?.source || 'unknown',
        language: doc.metadata?.language,
        startLine: doc.metadata?.startLine,
        endLine: doc.metadata?.endLine,
        symbols: doc.metadata?.symbols || [],
        content: (doc.text || '').substring(0, 300),
        score: doc._vsScore,
        chunkType: doc.metadata?.chunkType,
      }));

    const timeMs = Date.now() - start;

    return {
      structuredContent: {
        results: filtered,
        metadata: { collection: collName, model: codeModel, threshold, timeMs, resultCount: filtered.length, tokens: { embed: embedTokens } },
      },
      content: [{ type: 'text', text: `Found ${filtered.length} similar code chunks (threshold: ${threshold}, ${timeMs}ms):\n\n${filtered.map((r, i) => `[${i + 1}] ${r.source}:${r.startLine}-${r.endLine} (score: ${r.score.toFixed(3)})\n  ${r.content.split('\n').slice(0, 3).join('\n  ')}`).join('\n\n')}` }],
    };
  } finally {
    if (client) await client.close();
  }
}

/**
 * Handler for vai_code_status.
 */
async function handleCodeStatus(input) {
  const start = Date.now();
  const { db, collection: collName } = resolveDbColl(input);

  let client;
  try {
    const { client: c, collection } = await getMongoCollection(db, collName);
    client = c;

    const totalChunks = await collection.estimatedDocumentCount();

    if (totalChunks === 0) {
      return {
        structuredContent: { db, collection: collName, totalChunks: 0, filesIndexed: 0, message: 'No indexed code found' },
        content: [{ type: 'text', text: `No indexed code found in ${db}.${collName}. Use vai_code_index to index a codebase.` }],
      };
    }

    const [fileStats] = await collection.aggregate([
      { $match: { _type: { $ne: 'index_meta' } } },
      {
        $group: {
          _id: null,
          uniqueFiles: { $addToSet: '$metadata.source' },
          lastIndexed: { $max: '$metadata.indexedAt' },
          languages: { $addToSet: '$metadata.language' },
          workspaces: { $addToSet: '$metadata.workspace' },
        },
      },
    ]).toArray();

    let indexes = [];
    try {
      indexes = await collection.listSearchIndexes().toArray();
    } catch { /* might not have permissions */ }

    const timeMs = Date.now() - start;
    const structured = {
      db,
      collection: collName,
      totalChunks,
      filesIndexed: fileStats?.uniqueFiles?.length || 0,
      lastIndexed: fileStats?.lastIndexed || 'unknown',
      languages: fileStats?.languages?.filter(Boolean) || [],
      workspaces: fileStats?.workspaces?.filter(Boolean) || [],
      indexes: indexes.map(i => ({ name: i.name, status: i.status })),
      timeMs,
    };

    return {
      structuredContent: structured,
      content: [{ type: 'text', text: `Code Search Index: ${db}.${collName}\n  Files: ${structured.filesIndexed}\n  Chunks: ${totalChunks}\n  Languages: ${structured.languages.join(', ') || 'N/A'}\n  Last indexed: ${structured.lastIndexed}\n  Indexes: ${indexes.map(i => `${i.name} (${i.status})`).join(', ') || 'none'}` }],
    };
  } finally {
    if (client) await client.close();
  }
}

/**
 * Register code search tools on the MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {object} schemas
 */
function registerCodeSearchTools(server, schemas) {
  server.tool(
    'vai_code_index',
    'Index a codebase for semantic code search. Accepts a local directory path or a GitHub repository URL. Uses voyage-code-3 by default for code-optimized embeddings. Supports incremental refresh — only re-embeds files that changed since last indexing. Creates a MongoDB Atlas vector search index automatically.',
    schemas.codeIndexSchema,
    handleCodeIndex
  );

  server.tool(
    'vai_code_search',
    'Semantic code search across an indexed codebase. Finds functions, classes, modules, and documentation semantically related to your natural language query. Uses voyage-code-3 by default. Supports filtering by programming language and content category. Results include file paths, line numbers, symbols, and relevance scores.',
    schemas.codeSearchSchema,
    handleCodeSearch
  );

  server.tool(
    'vai_code_query',
    'Full RAG query against an indexed codebase. Embeds your question, performs vector search, reranks results, and returns the most relevant code with context. Optimized for answering questions like "how does X work" or "where is Y implemented". Always reranks for best quality.',
    schemas.codeQuerySchema,
    handleCodeQuery
  );

  server.tool(
    'vai_code_find_similar',
    'Find code semantically similar to a given snippet. Paste in a function, class, or code block and find related implementations across indexed codebases. Useful for finding duplicates, alternative implementations, or understanding patterns. Uses voyage-code-3 which understands both code structure and intent.',
    schemas.codeFindSimilarSchema,
    handleCodeFindSimilar
  );

  server.tool(
    'vai_code_status',
    'Check the status of a code search index. Shows file count, chunk count, languages indexed, last indexing time, and vector search index health. Use this before searching to verify the index is ready, or to decide if a refresh is needed.',
    schemas.codeStatusSchema,
    handleCodeStatus
  );
}

module.exports = {
  registerCodeSearchTools,
  handleCodeIndex,
  handleCodeSearch,
  handleCodeQuery,
  handleCodeFindSimilar,
  handleCodeStatus,
};
