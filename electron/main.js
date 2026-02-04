'use strict';

const { app, BrowserWindow, Menu, shell, dialog, nativeTheme } = require('electron');
const path = require('path');
const http = require('http');

// ── Configuration ──
const DEFAULT_PORT = 19878;
const WINDOW_WIDTH = 1280;
const WINDOW_HEIGHT = 860;

let mainWindow = null;
let serverPort = DEFAULT_PORT;

// ── Playground Server ──
// Reuse the existing playground server from the CLI codebase.
// We import registerPlayground and spin up the HTTP server in-process.

function findFreePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(startPort, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      // Port in use, try next
      resolve(findFreePort(startPort + 1));
    });
  });
}

async function startPlaygroundServer() {
  const port = await findFreePort(DEFAULT_PORT);
  serverPort = port;

  // Reuse the playground's HTTP server directly.
  const playgroundPath = path.join(__dirname, '..', 'src', 'commands', 'playground.js');
  const { createPlaygroundServer } = require(playgroundPath);

  return new Promise((resolve, reject) => {
    const server = createPlaygroundServer();
    server.listen(port, '127.0.0.1', () => {
      console.log(`Playground server running on port ${port}`);
      resolve(server);
    });
    server.on('error', reject);
  });
}

// ── Application Menu ──

function buildMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
        ] : [
          { role: 'close' },
        ]),
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Voyage AI Documentation',
          click: () => shell.openExternal('https://docs.voyageai.com'),
        },
        {
          label: 'voyageai-cli on GitHub',
          click: () => shell.openExternal('https://github.com/mrlynn/voyageai-cli'),
        },
        {
          label: 'voyageai-cli on npm',
          click: () => shell.openExternal('https://www.npmjs.com/package/voyageai-cli'),
        },
        { type: 'separator' },
        {
          label: 'MongoDB Atlas Vector Search',
          click: () => shell.openExternal('https://www.mongodb.com/products/platform/atlas-vector-search'),
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

// ── Window Creation ──

function createWindow() {
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: 900,
    minHeight: 600,
    title: 'Voyage AI Playground',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#001E2B' : '#FFFFFF',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false,
    },
    show: false, // Show after ready-to-show to avoid flash
  });

  mainWindow.loadURL(`http://127.0.0.1:${serverPort}`);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ── App Lifecycle ──

app.whenReady().then(async () => {
  // Check for API key
  if (!process.env.VOYAGE_API_KEY) {
    const result = dialog.showMessageBoxSync({
      type: 'warning',
      title: 'API Key Required',
      message: 'VOYAGE_API_KEY environment variable is not set.',
      detail: 'The playground needs a Voyage AI API key to function.\n\nYou can:\n1. Set VOYAGE_API_KEY in your shell profile\n2. Launch from terminal: VOYAGE_API_KEY=your-key vai app\n3. Use "vai config set key YOUR_KEY" to store it',
      buttons: ['Continue Anyway', 'Quit'],
      defaultId: 0,
    });
    if (result === 1) {
      app.quit();
      return;
    }
  }

  Menu.setApplicationMenu(buildMenu());

  try {
    await startPlaygroundServer();
    createWindow();
  } catch (err) {
    dialog.showErrorBox('Server Error', `Failed to start playground server:\n${err.message}`);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
