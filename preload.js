// Preload da janela principal: expõe apenas window.foccusDesktop (contrato com o site).
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

let listener = null;
ipcRenderer.on('mini:command', (_e, cmd) => {
  if (typeof listener === 'function' && ['play', 'pause', 'open', 'closed'].includes(cmd)) {
    try { listener(cmd); } catch (err) { /* erro do site não derruba o preload */ }
  }
});

let trackListener = null;
ipcRenderer.on('spotify:track', (_e, t) => { if (typeof trackListener === 'function') { try { trackListener(t); } catch (err) { } } });

// state é copiado por valor (structured clone) e revalidado no processo main.
contextBridge.exposeInMainWorld('foccusDesktop', {
  isDesktop: true,
  platform: process.platform,
  mini: {
    open: (state) => ipcRenderer.send('mini:open', state),
    update: (state) => ipcRenderer.send('mini:update', state),
    close: () => ipcRenderer.send('mini:close')
  },
  setTheme: (t) => { if (['light', 'dark', 'black'].includes(t)) ipcRenderer.send('desk:theme', t); },
  onMiniCommand: (cb) => { listener = typeof cb === 'function' ? cb : null; },
  spotify: {
    configured: () => ipcRenderer.invoke('spotify:configured'),
    loggedIn: () => ipcRenderer.invoke('spotify:logged-in'),
    login: () => ipcRenderer.invoke('spotify:login'),
    logout: () => ipcRenderer.send('spotify:logout'),
    playPause: () => ipcRenderer.send('spotify:play-pause'),
    next: () => ipcRenderer.send('spotify:next'),
    prev: () => ipcRenderer.send('spotify:prev'),
    onTrack: (cb) => { trackListener = typeof cb === 'function' ? cb : null; },
    openFloating: () => ipcRenderer.send('spotify:open-floating'),
    closeFloating: () => ipcRenderer.send('spotify:close-floating')
  }
});
