import * as vscode from 'vscode';
import { VaiServer } from '../server';

export class StatusProvider implements vscode.TreeDataProvider<StatusItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<StatusItem | undefined | null | void> = new vscode.EventEmitter<StatusItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<StatusItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private server: VaiServer;

  constructor(server: VaiServer) {
    this.server = server;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: StatusItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: StatusItem): Promise<StatusItem[]> {
    if (element) {
      return [];
    }

    const items: StatusItem[] = [];

    // Server status
    if (this.server.isRunning) {
      const health = await this.server.checkHealth();

      items.push(new StatusItem(
        'MCP Server',
        `Running on port ${this.server.port}`,
        'running'
      ));

      items.push(new StatusItem(
        'Health',
        health.status,
        health.status === 'ok' ? 'ok' : 'warning'
      ));

      if (health.version) {
        items.push(new StatusItem(
          'Version',
          health.version,
          'info'
        ));
      }

      items.push(new StatusItem(
        'URL',
        this.server.url,
        'link'
      ));
    } else {
      items.push(new StatusItem(
        'MCP Server',
        'Stopped',
        'stopped'
      ));

      items.push(new StatusItem(
        'Start Server',
        'Click to start',
        'action',
        'vai.startServer'
      ));
    }

    // Configuration status
    const config = vscode.workspace.getConfiguration('vai');
    const apiKey = config.get<string>('apiKey') || process.env.VOYAGE_API_KEY;
    const mongoUri = config.get<string>('mongodbUri') || process.env.MONGODB_URI;

    items.push(new StatusItem(
      'API Key',
      apiKey ? 'Configured' : 'Not set',
      apiKey ? 'ok' : 'warning'
    ));

    items.push(new StatusItem(
      'MongoDB',
      mongoUri ? 'Configured' : 'Not set',
      mongoUri ? 'ok' : 'warning'
    ));

    return items;
  }
}

class StatusItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly value: string,
    public readonly type: 'running' | 'stopped' | 'ok' | 'warning' | 'info' | 'link' | 'action',
    command?: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);

    this.description = value;

    switch (type) {
      case 'running':
        this.iconPath = new vscode.ThemeIcon('debug-start', new vscode.ThemeColor('testing.iconPassed'));
        break;
      case 'stopped':
        this.iconPath = new vscode.ThemeIcon('debug-stop', new vscode.ThemeColor('testing.iconFailed'));
        break;
      case 'ok':
        this.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
        break;
      case 'warning':
        this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('testing.iconSkipped'));
        break;
      case 'info':
        this.iconPath = new vscode.ThemeIcon('info');
        break;
      case 'link':
        this.iconPath = new vscode.ThemeIcon('link');
        break;
      case 'action':
        this.iconPath = new vscode.ThemeIcon('play');
        if (command) {
          this.command = {
            command,
            title: value
          };
        }
        break;
    }
  }
}
