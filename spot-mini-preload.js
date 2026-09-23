// Preload da janelinha flutuante do Spotify — independente da janelinha do Pomodoro.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');
let listener = null, sizeListener = null;
ipcRenderer.on('spotify:track', (_e, t) => { if (typeof listener === 'function') { try { listener(t); } catch (err) { } } });
ipcRenderer.on('spotify:size', (_e, i) => { if (typeof sizeListener === 'function') { try { sizeListener(i); } catch (err) { } } });
contextBridge.exposeInMainWorld('spotBridge', {
  onTrack: (cb) => { listener = typeof cb === 'function' ? cb : null; },
  cmd: (c) => { if (['pp', 'next', 'prev', 'close'].includes(c)) ipcRenderer.send('spot:cmd', c); },
  volume: (pct) => { if (typeof pct === 'number') ipcRenderer.send('spot:volume', pct); },
  setSize: (i) => { if (Number.isInteger(i)) ipcRenderer.send('spot:size', i); },
  sizes: () => ipcRenderer.invoke('spot:sizes'),
  onSize: (cb) => { sizeListener = typeof cb === 'function' ? cb : null; }
});
