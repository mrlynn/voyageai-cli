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
    if (!safeStorage.isEncryptionAvailable()) {
      console.log('[API Key] safeStorage not yet available');
      return null;
    }
    return safeStorage.decryptString(encrypted);
  } catch (err) {
    console.error('[API Key] Failed to decrypt:', err.message);
    return null;
  }
}

// Async version with retry for startup timing issues
async function loadStoredApiKeyWithRetry(maxRetries = 3, delayMs = 200) {
  for (let i = 0; i < maxRetries; i++) {
    const key = loadStoredApiKey();
    if (key) return key;
    // Key file exists but safeStorage not ready - wait and retry
    const keyFile = getKeyFilePath();
    if (fs.existsSync(keyFile) && !safeStorage.isEncryptionAvailable()) {
      console.log(`[API Key] Retry ${i + 1}/${maxRetries} - waiting for safeStorage...`);
      await new Promise(r => setTimeout(r, delayMs));
    } else {
      break; // No key file or other error, don't retry
    }
  }
  return loadStoredApiKey();
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
    return { app: APP_VERSION, cli: getCliVersion() };
  });

  ipcMain.handle('app:check-update', () => {
    return checkForUpdates();
  });

  ipcMain.handle('app:open-release', (_event, url) => {
    shell.openExternal(url);
  });

  ipcMain.handle('app:download-update', () => {
    return downloadUpdate();
  });

  ipcMain.handle('app:install-update', () => {
    autoUpdater.quitAndInstall(false, true);
  });

  // ── Generate & Scaffold handlers ──
  
  // Import codegen and scaffold structure from the CLI package
  let codegen, scaffoldStructure;
  // In dev: use local src path; in packaged: use extraResources or resolved package
  const srcBase = app.isPackaged
    ? path.join(process.resourcesPath, 'src')
    : path.join(__dirname, '..', 'src');
  
  try {
    codegen = require(path.join(srcBase, 'lib', 'codegen'));
    console.log('[Generate] Loaded codegen from', path.join(srcBase, 'lib', 'codegen'));
  } catch (err) {
    console.error('[Generate] Failed to load codegen:', err.message);
  }
  
  try {
    // Load scaffold structure from separate file (no @clack/prompts dependency)
    const scaffoldModule = require(path.join(srcBase, 'lib', 'scaffold-structure'));
    scaffoldStructure = scaffoldModule.PROJECT_STRUCTURE;
    console.log('[Scaffold] Loaded scaffold-structure from', path.join(srcBase, 'lib', 'scaffold-structure'));
  } catch (err) {
    console.error('[Scaffold] Failed to load scaffold-structure:', err.message);
  }

  // Generate code for a component
  ipcMain.handle('generate:code', async (_event, { target, component, config }) => {
    if (!codegen) return { error: 'Codegen module not available' };
    try {
      const context = codegen.buildContext(config || {}, { projectName: 'my-app' });
      
      // Map component to template name
      const templateMap = {
        vanilla: { client: 'client.js', connection: 'connection.js', retrieval: 'retrieval.js', ingest: 'ingest.js', 'search-api': 'search-api.js' },
        nextjs: { client: 'lib-voyage.js', connection: 'lib-mongo.js', retrieval: 'route-search.js', ingest: 'route-ingest.js', 'search-page': 'page-search.jsx' },
        python: { client: 'voyage_client.py', connection: 'mongo_client.py', retrieval: 'app.py', ingest: 'chunker.py' },
      };
      
      const templateName = (templateMap[target] || {})[component];
      if (!templateName) return { error: `Unknown component: ${component}` };
      
      const code = codegen.renderTemplate(target, templateName.replace(/\.(js|jsx|py)$/, ''), context);
      return { code, filename: templateName };
    } catch (err) {
      return { error: err.message };
    }
  });

  // List available components for a target
  ipcMain.handle('generate:components', async (_event, { target }) => {
    const components = {
      vanilla: ['client', 'connection', 'retrieval', 'ingest', 'search-api'],
      nextjs: ['client', 'connection', 'retrieval', 'ingest', 'search-page'],
      python: ['client', 'connection', 'retrieval', 'ingest'],
    };
    return components[target] || [];
  });

  // Pick a directory for scaffold output
  ipcMain.handle('scaffold:pick-directory', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose location for new project',
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: 'Select Folder',
    });
    if (result.canceled || result.filePaths.length === 0) return { canceled: true };
    return { path: result.filePaths[0] };
  });

  // Check if a directory already has files
  ipcMain.handle('scaffold:check-directory', async (_event, { dirPath, projectName }) => {
    const targetPath = path.join(dirPath, projectName);
    if (!fs.existsSync(targetPath)) return { exists: false };
    const files = fs.readdirSync(targetPath);
    return { exists: true, fileCount: files.length };
  });

  // Confirm overwrite dialog
  ipcMain.handle('scaffold:confirm-overwrite', async (_event, { projectName }) => {
    const result = await dialog.showMessageBox({
      type: 'warning',
      title: 'Directory exists',
      message: `The folder "${projectName}" already exists and contains files.`,
      detail: 'Do you want to overwrite the existing files?',
      buttons: ['Cancel', 'Overwrite'],
      defaultId: 0,
      cancelId: 0,
    });
    return { confirmed: result.response === 1 };
  });

  // Create scaffold project
  ipcMain.handle('scaffold:create', async (event, { dirPath, projectName, target, config }) => {
    if (!codegen || !scaffoldStructure) return { error: 'Scaffold module not available' };
    
    const structure = scaffoldStructure[target];
    if (!structure) return { error: `Unknown target: ${target}` };
    
    const projectDir = path.join(dirPath, projectName);
    const context = codegen.buildContext(config || {}, { projectName });
    const createdFiles = [];

    try {
      // Create project directory
      if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
      }

      // Render and write template files
      for (const file of structure.files) {
        const content = codegen.renderTemplate(target, file.template.replace(/\.(js|jsx|py|json|md|txt)$/, ''), context);
        const outputPath = path.join(projectDir, file.output);
        const outputDir = path.dirname(outputPath);
        
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        
        fs.writeFileSync(outputPath, content, 'utf8');
        createdFiles.push(file.output);
        
        // Send progress update
        event.sender.send('scaffold:progress', { file: file.output, total: structure.files.length, current: createdFiles.length });
      }

      // Write extra static files
      if (structure.extraFiles) {
        for (const file of structure.extraFiles) {
          const content = typeof file.content === 'function' ? file.content(context) : file.content;
          const outputPath = path.join(projectDir, file.output);
          const outputDir = path.dirname(outputPath);
          
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
          
          fs.writeFileSync(outputPath, content, 'utf8');
          createdFiles.push(file.output);
        }
      }

      return {
        success: true,
        projectDir,
        files: createdFiles,
        postInstall: structure.postInstall,
        startCommand: structure.startCommand,
      };
    } catch (err) {
      return { error: err.message };
    }
  });

  // Open directory in Finder/Explorer
  ipcMain.handle('scaffold:open-directory', async (_event, { dirPath }) => {
    shell.openPath(dirPath);
    return { success: true };
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

// ── Update Checker (electron-updater) ──
// Auto-downloads updates from GitHub Releases, supports quit-and-install.

const { autoUpdater } = require('electron-updater');

const APP_VERSION = require('./package.json').version;
function getCliVersion() {
  try {
    const pkgPath = app.isPackaged
      ? path.join(process.resourcesPath, 'cli-package.json')
      : path.join(__dirname, '..', 'package.json');
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
  } catch { return 'unknown'; }
}

// Configure autoUpdater
autoUpdater.autoDownload = false;          // We control when to download
autoUpdater.autoInstallOnAppQuit = true;   // Install on next quit if downloaded
autoUpdater.allowPrerelease = false;

// Send update events to renderer
function sendUpdateEvent(event, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-event', { event, ...data });
  }
}

autoUpdater.on('update-available', (info) => {
  sendUpdateEvent('update-available', {
    latestVersion: info.version,
    currentVersion: APP_VERSION,
    releaseName: info.releaseName || `v${info.version}`,
    releaseNotes: info.releaseNotes || '',
    releaseDate: info.releaseDate || '',
  });
});

autoUpdater.on('update-not-available', (info) => {
  sendUpdateEvent('update-not-available', {
    currentVersion: APP_VERSION,
    latestVersion: info.version,
  });
});

autoUpdater.on('download-progress', (progress) => {
  sendUpdateEvent('download-progress', {
    percent: progress.percent,
    bytesPerSecond: progress.bytesPerSecond,
    transferred: progress.transferred,
    total: progress.total,
  });
});

autoUpdater.on('update-downloaded', (info) => {
  sendUpdateEvent('update-downloaded', {
    latestVersion: info.version,
    releaseName: info.releaseName || `v${info.version}`,
  });
});

autoUpdater.on('error', (err) => {
  sendUpdateEvent('update-error', { message: err.message || 'Update check failed' });
});

function checkForUpdates() {
  if (!app.isPackaged) {
    // In dev mode, fall back to manual GitHub API check
    return checkForUpdatesManual();
  }
  return autoUpdater.checkForUpdates().then((result) => {
    if (!result || !result.updateInfo) {
      return { hasUpdate: false, currentVersion: APP_VERSION };
    }
    const info = result.updateInfo;
    const hasUpdate = compareVersions(info.version, APP_VERSION) > 0;
    return {
      hasUpdate,
      currentVersion: APP_VERSION,
      latestVersion: info.version,
      releaseName: info.releaseName || `v${info.version}`,
      releaseUrl: `https://github.com/mrlynn/voyageai-cli/releases/tag/app-v${info.version}`,
    };
  }).catch(() => {
    return { hasUpdate: false, currentVersion: APP_VERSION, error: 'check_failed' };
  });
}

function downloadUpdate() {
  if (!app.isPackaged) {
    return Promise.resolve({ error: 'dev_mode' });
  }
  return autoUpdater.downloadUpdate().then(() => {
    return { success: true };
  }).catch((err) => {
    return { error: err.message };
  });
}

// Manual fallback for dev mode (no code signing = no autoUpdater)
function checkForUpdatesManual() {
  const https = require('https');
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/mrlynn/voyageai-cli/releases?per_page=20',
      headers: { 'User-Agent': `Vai/${APP_VERSION}` },
      timeout: 5000,
    };
    const req = https.get(options, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        https.get(res.headers.location, { headers: options.headers, timeout: 5000 }, handleResponse);
        return;
      }
      handleResponse(res);
    });
    function handleResponse(res) {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const releases = JSON.parse(data);
          const appRelease = Array.isArray(releases)
            ? releases.find(r => r.tag_name && r.tag_name.startsWith('app-v'))
            : null;
          const release = appRelease || (releases && releases.tag_name ? releases : null);
          if (!release) {
            resolve({ hasUpdate: false, currentVersion: APP_VERSION, error: 'no_app_release' });
            return;
          }
          const latestTag = (release.tag_name || '').replace(/^app-v/, '');
          if (latestTag && compareVersions(latestTag, APP_VERSION) > 0) {
            resolve({
              hasUpdate: true,
              currentVersion: APP_VERSION,
              latestVersion: latestTag,
              releaseUrl: release.html_url,
              releaseName: release.name || `v${latestTag}`,
              publishedAt: release.published_at,
            });
          } else {
            resolve({ hasUpdate: false, currentVersion: APP_VERSION, latestVersion: latestTag });
          }
        } catch {
          resolve({ hasUpdate: false, currentVersion: APP_VERSION, error: 'parse_error' });
        }
      });
    }
    req.on('error', () => resolve({ hasUpdate: false, currentVersion: APP_VERSION, error: 'network_error' }));
    req.on('timeout', () => { req.destroy(); resolve({ hasUpdate: false, currentVersion: APP_VERSION, error: 'timeout' }); });
  });
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
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
  // In dev: ../src/commands/playground.js (relative to electron/)
  // In packaged app: process.resourcesPath/src/commands/playground.js (extraResources)
  const srcBase = app.isPackaged
    ? path.join(process.resourcesPath, 'src')
    : path.join(__dirname, '..', 'src');
  const playgroundPath = path.join(srcBase, 'commands', 'playground.js');
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

// Manual update check with user feedback dialog
async function checkForUpdatesWithFeedback() {
  const result = await checkForUpdates();
  
  if (result.error) {
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Update Check Failed',
      message: 'Could not check for updates.',
      detail: result.error === 'network_error' 
        ? 'Please check your internet connection and try again.'
        : result.error === 'timeout'
        ? 'The request timed out. Please try again.'
        : 'An error occurred while checking for updates.',
      buttons: ['OK'],
    });
    return;
  }
  
  if (result.hasUpdate) {
    const response = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `A new version is available: ${result.releaseName || 'v' + result.latestVersion}`,
      detail: `You are currently running v${result.currentVersion}.\n\nWould you like to download the update?`,
      buttons: ['Download Update', 'View Release', 'Later'],
      defaultId: 0,
      cancelId: 2,
    });
    
    if (response.response === 0) {
      // Download update
      if (app.isPackaged) {
        downloadUpdate();
      } else {
        shell.openExternal(result.releaseUrl);
      }
    } else if (response.response === 1) {
      // View release
      shell.openExternal(result.releaseUrl);
    }
  } else {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'No Updates Available',
      message: "You're up to date!",
      detail: `Version ${result.currentVersion} is the latest version.`,
      buttons: ['OK'],
    });
  }
}

function buildMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        {
          label: 'Check for Updates...',
          click: () => checkForUpdatesWithFeedback(),
        },
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
        // On Windows/Linux, add Check for Updates here (macOS has it in app menu)
        ...(!isMac ? [
          { type: 'separator' },
          {
            label: 'Check for Updates...',
            click: () => checkForUpdatesWithFeedback(),
          },
        ] : []),
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
  // Use retry version to handle safeStorage timing on macOS
  if (!process.env.VOYAGE_API_KEY) {
    const stored = await loadStoredApiKeyWithRetry();
    if (stored) {
      process.env.VOYAGE_API_KEY = stored;
    }
  }

  // Also check ~/.vai/config.json (CLI config file) as fallback
  if (!process.env.VOYAGE_API_KEY) {
    try {
      const cliConfigPath = path.join(require('os').homedir(), '.vai', 'config.json');
      if (fs.existsSync(cliConfigPath)) {
        const cliConfig = JSON.parse(fs.readFileSync(cliConfigPath, 'utf8'));
        if (cliConfig.apiKey) {
          process.env.VOYAGE_API_KEY = cliConfig.apiKey;
        }
      }
    } catch { /* ignore */ }
  }

  // Check for API key — show warning only if no env var, no stored key, AND no CLI config
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
