const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  requestAiReview: (payload) => ipcRenderer.invoke('audit:ai-review', payload),
  importGitHubRepository: (url) => ipcRenderer.invoke('audit:github-import', url),
});
