// Preload da janelinha flutuante do Spotify — independente da janelinha do Pomodoro.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');
let listener = null, themeListener = null;
ipcRenderer.on('spotify:track', (_e, t) => { if (typeof listener === 'function') { try { listener(t); } catch (err) { } } });
ipcRenderer.on('spotify:theme', (_e, t) => { if (typeof themeListener === 'function') { try { themeListener(t); } catch (err) { } } });
contextBridge.exposeInMainWorld('spotBridge', {
  onTrack: (cb) => { listener = typeof cb === 'function' ? cb : null; },
  cmd: (c) => { if (['pp', 'next', 'prev', 'close'].includes(c)) ipcRenderer.send('spot:cmd', c); },
  volume: (pct) => { if (typeof pct === 'number') ipcRenderer.send('spot:volume', pct); },
  onTheme: (cb) => { themeListener = typeof cb === 'function' ? cb : null; },
  setSize: (w, h) => { if (typeof w === 'number' && typeof h === 'number') ipcRenderer.send('spot:size', Math.round(w), Math.round(h)); }
});
