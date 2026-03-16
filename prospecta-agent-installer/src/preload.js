'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agent', {
  // Vérification de l'état
  checkStatus: () => ipcRenderer.invoke('check-status'),

  // Installation
  install: () => ipcRenderer.invoke('install-agent'),
  onInstallProgress: (cb) => ipcRenderer.on('install-progress', (_, data) => cb(data)),

  // Contrôle de l'agent
  start: () => ipcRenderer.invoke('start-agent'),
  stop: () => ipcRenderer.invoke('stop-agent'),

  // Statut temps réel
  onStatusChange: (cb) => ipcRenderer.on('agent-status', (_, data) => cb(data)),
  onError: (cb) => ipcRenderer.on('agent-error', (_, msg) => cb(msg)),

  // Actions
  openLogs: () => ipcRenderer.invoke('open-logs'),
  openProspecta: () => ipcRenderer.invoke('open-prospecta'),
});
