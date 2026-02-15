import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';

/**
 * Manages the vai MCP server lifecycle.
 */
export class VaiServer {
  private context: vscode.ExtensionContext;
  private process: ChildProcess | null = null;
  private outputChannel: vscode.OutputChannel;
  private _isRunning: boolean = false;
  private _port: number = 3100;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.outputChannel = vscode.window.createOutputChannel('vai MCP Server');
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  get port(): number {
    return this._port;
  }

  get url(): string {
    return `http://127.0.0.1:${this._port}`;
  }

  /**
   * Start the MCP server.
   */
  async start(): Promise<void> {
    if (this._isRunning) {
      throw new Error('Server is already running');
    }

    const config = vscode.workspace.getConfiguration('vai');
    this._port = config.get<number>('serverPort') || 3100;

    const env: Record<string, string> = { ...process.env as Record<string, string> };

    // Set environment from config
    const apiKey = config.get<string>('apiKey');
    const mongodbUri = config.get<string>('mongodbUri');
    if (apiKey) env.VOYAGE_API_KEY = apiKey;
    if (mongodbUri) env.MONGODB_URI = mongodbUri;

    // Enable verbose logging
    env.VAI_MCP_VERBOSE = '1';

    return new Promise((resolve, reject) => {
      this.process = spawn('vai', [
        'mcp-server',
        '--transport', 'http',
        '--port', String(this._port)
      ], { env });

      this.process.stdout?.on('data', (data) => {
        const output = data.toString();
        this.outputChannel.appendLine(output);

        // Server started successfully
        if (output.includes('running on http://')) {
          this._isRunning = true;
          resolve();
        }
      });

      this.process.stderr?.on('data', (data) => {
        this.outputChannel.appendLine(`[stderr] ${data.toString()}`);
      });

      this.process.on('error', (err) => {
        this._isRunning = false;
        reject(new Error(`Failed to start vai: ${err.message}`));
      });

      this.process.on('close', (code) => {
        this._isRunning = false;
        this.outputChannel.appendLine(`Server exited with code ${code}`);
      });

      // Timeout if server doesn't start
      setTimeout(() => {
        if (!this._isRunning) {
          this.stop();
          reject(new Error('Server failed to start within timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Stop the MCP server.
   */
  stop(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this._isRunning = false;
  }

  /**
   * Check server health.
   */
  async checkHealth(): Promise<{ status: string; version?: string }> {
    if (!this._isRunning) {
      return { status: 'stopped' };
    }

    try {
      const response = await fetch(`${this.url}/health`);
      const health = await response.json() as any;
      return {
        status: health.status || 'unknown',
        version: health.version
      };
    } catch {
      return { status: 'error' };
    }
  }

  /**
   * Show the output channel.
   */
  showOutput(): void {
    this.outputChannel.show();
  }
}
