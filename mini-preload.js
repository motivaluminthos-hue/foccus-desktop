// Preload da janelinha: recebe o state e devolve comandos. Nada além disso.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('foccusMini', {
  onState: (cb) => { ipcRenderer.on('mini:state', (_e, s) => cb(s)); },
  send: (cmd) => {
    if (['play', 'pause', 'open', 'close'].includes(cmd)) ipcRenderer.send('mini:cmd', cmd);
  }
});
