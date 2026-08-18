'use strict'
// The whole surface the renderer gets. No Node, no fs, no child_process — just
// these calls and two event streams.

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('storeApi', {
  state: () => ipcRenderer.invoke('app:state'),
  setLocale: (locale) => ipcRenderer.invoke('app:setLocale', locale),

  list: () => ipcRenderer.invoke('store:list'),
  paths: () => ipcRenderer.invoke('store:paths'),
  sync: (names) => ipcRenderer.invoke('store:sync', names),
  remove: (name) => ipcRenderer.invoke('store:remove', name),
  bootstrap: () => ipcRenderer.invoke('store:bootstrap'),
  launch: (game) => ipcRenderer.invoke('store:launch', game),

  openFolder: (dir) => ipcRenderer.invoke('app:openFolder', dir),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),

  // Streams from the running CLI: `log` is a line a person can read, `event` is
  // one of the store's JSON progress events.
  onLog: (fn) => ipcRenderer.on('store:log', (_e, line) => fn(line)),
  onEvent: (fn) => ipcRenderer.on('store:event', (_e, event) => fn(event)),
  onBusy: (fn) => ipcRenderer.on('store:busy', (_e, value) => fn(value))
})
