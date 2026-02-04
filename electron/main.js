'use strict';

const { app, BrowserWindow, Menu, shell, dialog, nativeTheme, nativeImage, ipcMain, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

// ── Secure API Key Storage ──
// Uses Electron safeStorage (OS keychain encryption) + file on disk

function getKeyFilePath() {
  return path.join(app.getPath('userData'), '.voyage-api-key');
}

function loadStoredApiKey() {
  const keyFile = getKeyFilePath();
  if (!fs.existsSync(keyFile)) return null;
  try {
    const encrypted = fs.readFileSync(keyFile);
    if (!safeStorage.isEncryptionAvailable()) return null;
    return safeStorage.decryptString(encrypted);
  } catch {
    return null;
  }
}

function saveApiKey(key) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS encryption not available');
  }
  const encrypted = safeStorage.encryptString(key);
  const keyFile = getKeyFilePath();
  fs.writeFileSync(keyFile, encrypted);
}

function deleteApiKey() {
  const keyFile = getKeyFilePath();
  if (fs.existsSync(keyFile)) fs.unlinkSync(keyFile);
}

// Register IPC handlers for renderer access
function registerApiKeyHandlers() {
  ipcMain.handle('api-key:get', () => {
    return loadStoredApiKey();
  });

  ipcMain.handle('api-key:set', (_event, key) => {
    saveApiKey(key);
    // Also inject into process.env so the playground server picks it up
    process.env.VOYAGE_API_KEY = key;
    return true;
  });

  ipcMain.handle('api-key:delete', () => {
    deleteApiKey();
    delete process.env.VOYAGE_API_KEY;
    return true;
  });

  ipcMain.handle('api-key:exists', () => {
    return !!loadStoredApiKey() || !!process.env.VOYAGE_API_KEY;
  });

  ipcMain.handle('app:version', () => {
    return app.getVersion();
  });
}

// ── Icon helpers ──
function getIconPath(isDark) {
  const variant = isDark ? 'dark' : 'light';
  const png = path.join(__dirname, 'icons', variant, 'AppIcons', 'Assets.xcassets', 'AppIcon.appiconset', '1024.png');
  const icns = path.join(__dirname, 'icons', variant, 'icon.icns');
  return fs.existsSync(png) ? png : icns;
}

function updateDockIcon() {
  if (process.platform !== 'darwin') return;
  const iconPath = getIconPath(nativeTheme.shouldUseDarkColors);
  try {
    const icon = nativeImage.createFromPath(iconPath);
    if (!icon.isEmpty()) app.dock.setIcon(icon);
  } catch (err) {
    console.error('Failed to set dock icon:', err.message);
  }
}

// ── App name & early dock icon (must be set before 'ready') ──
if (process.platform === 'darwin') {
  app.setName('Vai');
  // Set dock icon as early as possible
  app.on('ready', () => updateDockIcon());
}

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
  const isDark = nativeTheme.shouldUseDarkColors;
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: 960,
    minHeight: 600,
    title: 'Voyage AI Playground',
    icon: getIconPath(isDark),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 14, y: 14 },
    backgroundColor: isDark ? '#112733' : '#F9FBFA',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false, // Show after ready-to-show to avoid flash
  });

  // Listen for OS theme changes and update dock icon
  nativeTheme.on('updated', () => {
    updateDockIcon();
  });

  mainWindow.loadURL(`http://127.0.0.1:${serverPort}`);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // If no API key was found, switch to settings tab
    if (global.openSettingsOnLaunch) {
      mainWindow.webContents.executeJavaScript(`
        if (typeof switchTab === 'function') switchTab('settings');
      `).catch(() => {});
      global.openSettingsOnLaunch = false;
    }
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
  // Register secure API key IPC handlers
  registerApiKeyHandlers();

  // Try to load stored API key into env if not already set
  if (!process.env.VOYAGE_API_KEY) {
    const stored = loadStoredApiKey();
    if (stored) {
      process.env.VOYAGE_API_KEY = stored;
    }
  }

  // Check for API key — show warning only if no env var AND no stored key
  if (!process.env.VOYAGE_API_KEY) {
    const result = dialog.showMessageBoxSync({
      type: 'warning',
      title: 'API Key Required',
      message: 'No Voyage AI API key found.',
      detail: 'You can add your API key in Settings (⚙️) after launch,\nor set VOYAGE_API_KEY in your shell profile.\n\nGet a key at: https://dash.voyageai.com',
      buttons: ['Open Settings', 'Quit'],
      defaultId: 0,
    });
    if (result === 1) {
      app.quit();
      return;
    }
    // Flag to open settings tab on launch
    global.openSettingsOnLaunch = true;
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
