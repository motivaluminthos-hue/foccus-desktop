// Preload da janelinha flutuante do Spotify — independente da janelinha do Pomodoro.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');
let listener = null;
ipcRenderer.on('spotify:track', (_e, t) => { if (typeof listener === 'function') { try { listener(t); } catch (err) { } } });
contextBridge.exposeInMainWorld('spotBridge', {
  onTrack: (cb) => { listener = typeof cb === 'function' ? cb : null; },
  cmd: (c) => { if (['pp', 'next', 'prev', 'close'].includes(c)) ipcRenderer.send('spot:cmd', c); }
});
