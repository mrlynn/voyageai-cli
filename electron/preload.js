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
  // Update checker
  updates: {
    check:       ()    => ipcRenderer.invoke('app:check-update'),
    openRelease: (url) => ipcRenderer.invoke('app:open-release', url),
  },
  // App info
  getVersion: () => ipcRenderer.invoke('app:version'),
  isElectron: true,
});
