'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe API to the renderer — no direct Node access
contextBridge.exposeInMainWorld('vai', {
  // API key management (encrypted via OS keychain)
  apiKey: {
    get:    ()      => ipcRenderer.invoke('api-key:get'),
    set:    (key)   => ipcRenderer.invoke('api-key:set', key),
    delete: ()      => ipcRenderer.invoke('api-key:delete'),
    exists: ()      => ipcRenderer.invoke('api-key:exists'),
    mask:   (key)   => key ? key.slice(0, 6) + '•'.repeat(Math.max(0, key.length - 10)) + key.slice(-4) : '',
  },
  // Update checker + auto-updater
  updates: {
    check:       ()    => ipcRenderer.invoke('app:check-update'),
    download:    ()    => ipcRenderer.invoke('app:download-update'),
    install:     ()    => ipcRenderer.invoke('app:install-update'),
    openRelease: (url) => ipcRenderer.invoke('app:open-release', url),
    onEvent:     (cb)  => {
      const handler = (_event, data) => cb(data);
      ipcRenderer.on('update-event', handler);
      return () => ipcRenderer.removeListener('update-event', handler);
    },
  },
  // Code generation
  generate: {
    code:       (opts) => ipcRenderer.invoke('generate:code', opts),
    components: (opts) => ipcRenderer.invoke('generate:components', opts),
  },
  // Project scaffolding
  scaffold: {
    pickDirectory:    ()     => ipcRenderer.invoke('scaffold:pick-directory'),
    checkDirectory:   (opts) => ipcRenderer.invoke('scaffold:check-directory', opts),
    confirmOverwrite: (opts) => ipcRenderer.invoke('scaffold:confirm-overwrite', opts),
    create:           (opts) => ipcRenderer.invoke('scaffold:create', opts),
    openDirectory:    (opts) => ipcRenderer.invoke('scaffold:open-directory', opts),
    onProgress:       (cb)   => {
      const handler = (_event, data) => cb(data);
      ipcRenderer.on('scaffold:progress', handler);
      return () => ipcRenderer.removeListener('scaffold:progress', handler);
    },
  },
  // App info — returns { app, cli }
  getVersion: () => ipcRenderer.invoke('app:version'),
  isElectron: true,
});
