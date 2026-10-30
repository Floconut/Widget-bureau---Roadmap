'use strict';
const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('api', {
  load: () => ipcRenderer.invoke('data:load'),
  save: data => ipcRenderer.invoke('data:save', data),
  saveSync: data => ipcRenderer.sendSync('data:saveSync', data),
  applySettings: s => ipcRenderer.send('settings:apply', s),
  setZoom: f => webFrame.setZoomFactor(f),
  exportData: data => ipcRenderer.invoke('data:export', data),
  importData: () => ipcRenderer.invoke('data:import'),
  hide: () => ipcRenderer.send('win:hide'),
  quit: () => ipcRenderer.send('app:quit'),
  onSettingsPatch: cb => ipcRenderer.on('settings:patch', (e, patch) => cb(patch)),
  onFlush: cb => ipcRenderer.on('app:flush', () => { cb(); ipcRenderer.send('app:flushed'); }),
});
