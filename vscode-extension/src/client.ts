import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';

export interface SearchResult {
  source: string;
  content: string;
  score: number;
  metadata?: Record<string, any>;
  filePath?: string;
  lineNumber?: number;
}

export interface IndexResult {
  filesProcessed: number;
  chunksCreated: number;
  errors: string[];
}

export interface ModelInfo {
  name: string;
  description: string;
  price: number;
  dimensions: number;
}

/**
 * Client for interacting with vai CLI or MCP server.
 * Uses CLI by default, can connect to HTTP server if running.
 */
export class VaiClient {
  private context: vscode.ExtensionContext;
  private httpBaseUrl: string | null = null;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Set HTTP server URL for MCP connection.
   */
  setHttpServer(url: string) {
    this.httpBaseUrl = url;
  }

  /**
   * Execute a vai CLI command and return parsed JSON output.
   */
  private async execVai(args: string[]): Promise<any> {
    return new Promise((resolve, reject) => {
      const config = vscode.workspace.getConfiguration('vai');
      const env: Record<string, string> = { ...process.env as Record<string, string> };

      // Set environment from config
      const apiKey = config.get<string>('apiKey');
      const mongodbUri = config.get<string>('mongodbUri');
      if (apiKey) env.VOYAGE_API_KEY = apiKey;
      if (mongodbUri) env.MONGODB_URI = mongodbUri;

      const proc = spawn('vai', [...args, '--json'], {
        env,
        cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(stderr || `vai exited with code ${code}`));
          return;
        }

        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch {
          // Some commands don't output JSON
          resolve({ output: stdout });
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to run vai: ${err.message}. Is vai installed?`));
      });
    });
  }

  /**
   * Call MCP tool via HTTP if server is running, otherwise fall back to CLI.
   */
  private async callTool(tool: string, params: Record<string, any>): Promise<any> {
    if (this.httpBaseUrl) {
      try {
        const response = await fetch(`${this.httpBaseUrl}/mcp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'tools/call',
            params: { name: tool, arguments: params }
          })
        });

        const result = await response.json() as any;
        if (result.error) {
          throw new Error(result.error.message);
        }
        return result.result;
      } catch (error: any) {
        // Fall back to CLI if server connection fails
        console.warn(`MCP server unavailable, falling back to CLI: ${error.message}`);
      }
    }

    // Map tool names to CLI commands
    const toolToCommand: Record<string, string[]> = {
      vai_query: ['query'],
      vai_search: ['search'],
      vai_embed: ['embed'],
      vai_similarity: ['similarity'],
      vai_collections: ['index', 'list'],
      vai_models: ['models'],
      vai_ingest: ['store']
    };

    const command = toolToCommand[tool];
    if (!command) {
      throw new Error(`Unknown tool: ${tool}`);
    }

    // Convert params to CLI args
    const args = [...command];
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        args.push(`--${key}`, String(value));
      }
    }

    return this.execVai(args);
  }

  /**
   * Run a semantic query against the knowledge base.
   */
  async query(query: string, options: { db?: string; collection?: string; limit?: number } = {}): Promise<SearchResult[]> {
    const config = vscode.workspace.getConfiguration('vai');
    const params = {
      query,
      db: options.db || config.get<string>('defaultDb'),
      collection: options.collection || config.get<string>('defaultCollection'),
      limit: options.limit || 10,
      rerank: true
    };

    const result = await this.callTool('vai_query', params);
    return this.parseResults(result);
  }

  /**
   * Search the codebase semantically.
   */
  async searchCodebase(query: string): Promise<SearchResult[]> {
    const config = vscode.workspace.getConfiguration('vai');
    const params = {
      query,
      db: config.get<string>('defaultDb'),
      collection: config.get<string>('defaultCollection'),
      limit: 20
    };

    const result = await this.callTool('vai_search', params);
    return this.parseResults(result);
  }

  /**
   * Get related context for code explanation.
   */
  async explainCode(code: string, language: string): Promise<SearchResult[]> {
    const query = `Explain this ${language} code: ${code.slice(0, 500)}`;
    return this.query(query, { limit: 5 });
  }

  /**
   * Calculate similarity between two texts.
   */
  async similarity(text1: string, text2: string): Promise<number> {
    const result = await this.callTool('vai_similarity', { text1, text2 });
    return result.similarity || result.structuredContent?.similarity || 0;
  }

  /**
   * Index workspace files.
   */
  async indexWorkspace(
    workspacePath: string,
    pattern: string,
    db: string,
    collection: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<IndexResult> {
    const config = vscode.workspace.getConfiguration('vai');
    const model = config.get<string>('embeddingModel') || 'voyage-4-large';

    // Find files matching pattern
    const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**');
    const result: IndexResult = {
      filesProcessed: 0,
      chunksCreated: 0,
      errors: []
    };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      onProgress?.(i + 1, files.length);

      try {
        const content = await fs.promises.readFile(file.fsPath, 'utf-8');
        const relativePath = path.relative(workspacePath, file.fsPath);

        // Skip binary or very large files
        if (content.length > 100000) {
          result.errors.push(`Skipped ${relativePath}: file too large`);
          continue;
        }

        await this.callTool('vai_ingest', {
          text: content,
          db,
          collection,
          source: relativePath,
          model,
          metadata: {
            filePath: file.fsPath,
            language: path.extname(file.fsPath).slice(1),
            indexedAt: new Date().toISOString()
          }
        });

        result.filesProcessed++;
        // Estimate chunks (vai will chunk internally)
        result.chunksCreated += Math.ceil(content.length / 512);
      } catch (error: any) {
        result.errors.push(`${file.fsPath}: ${error.message}`);
      }
    }

    return result;
  }

  /**
   * Get available collections.
   */
  async getCollections(db?: string): Promise<any[]> {
    const config = vscode.workspace.getConfiguration('vai');
    const result = await this.callTool('vai_collections', {
      db: db || config.get<string>('defaultDb')
    });
    return result.collections || result.structuredContent?.collections || [];
  }

  /**
   * Get available models.
   */
  async getModels(): Promise<ModelInfo[]> {
    const result = await this.callTool('vai_models', { category: 'embedding' });
    const models = result.models || result.structuredContent?.models || [];
    return models.map((m: any) => ({
      name: m.name || m.id,
      description: m.description || '',
      price: m.price || m.cost || 0,
      dimensions: m.dimensions || 1024
    }));
  }

  /**
   * Parse search results into consistent format.
   */
  private parseResults(result: any): SearchResult[] {
    const results = result.results || result.structuredContent?.results || [];
    return results.map((r: any) => ({
      source: r.source || 'unknown',
      content: r.content || r.text || '',
      score: r.rerankedScore || r.score || 0,
      metadata: r.metadata || {},
      filePath: r.metadata?.filePath,
      lineNumber: r.metadata?.lineNumber
    }));
  }
}
