// Foccus Desktop — processo principal.
// Tudo que vem do site (state da janelinha) é DADO NÃO CONFIÁVEL: validado aqui.
'use strict';
const { app, BrowserWindow, Menu, ipcMain, screen, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// ---- configuração fácil de trocar ----
const SITE_URL = 'https://foccus-six.vercel.app';
const PARTITION = 'persist:foccus';
const MINI_W = 340, MINI_H = 176;
// --------------------------------------
const SITE_ORIGIN = new URL(SITE_URL).origin;
const TEST_MINI = !app.isPackaged && process.argv.includes('--test-mini');

let mainWin = null;
let miniWin = null;
let lastState = null;
let miniClosingByApp = false;
let saveTimer = null;
let miniReady = false;

/* ---------- utilidades ---------- */
function isSiteUrl(u) {
  try { return new URL(u).origin === SITE_ORIGIN; } catch (e) { return false; }
}
function openExternalSafe(u) {
  try { if (new URL(u).protocol === 'https:') shell.openExternal(u); } catch (e) { /* ignora */ }
}
function fromMain(e) {
  if (!mainWin || mainWin.isDestroyed() || e.sender !== mainWin.webContents) return false;
  const url = e.senderFrame ? e.senderFrame.url : mainWin.webContents.getURL();
  return isSiteUrl(url);
}
function fromMini(e) {
  return !!miniWin && !miniWin.isDestroyed() && e.sender === miniWin.webContents;
}

/* ---------- validação do state ---------- */
const COVER_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const TIME_RE = /^\d{1,3}:\d\d$/;
const THEMES = ['light', 'dark', 'black'];
function validateState(s) {
  if (!s || typeof s !== 'object') return null;
  if (typeof s.title !== 'string' || typeof s.level !== 'string' || typeof s.time !== 'string') return null;
  if (typeof s.running !== 'boolean') return null;
  if (typeof s.frac !== 'number' || !Number.isFinite(s.frac)) return null;
  if (!TIME_RE.test(s.time)) return null;
  let cover = null;
  if (typeof s.cover === 'string' && s.cover.length <= 1.5 * 1024 * 1024 && COVER_RE.test(s.cover)) cover = s.cover;
  return {
    title: s.title.slice(0, 200),
    level: s.level.slice(0, 30),
    time: s.time,
    frac: Math.min(1, Math.max(0, s.frac)),
    running: s.running,
    cover,
    theme: THEMES.includes(s.theme) ? s.theme : 'light'
  };
}

/* ---------- janela principal ---------- */
function createMain() {
  mainWin = new BrowserWindow({
    width: 1100, height: 800, minWidth: 360, minHeight: 600,
    title: 'Foccus',
    icon: path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: '#121110',
    show: false,
    // sem barra de título: Windows mantém só os 3 botões nativos (sobre o app); Mac mantém os 3 botões redondos
    ...(process.platform === 'win32' ? { titleBarStyle: 'hidden', titleBarOverlay: { color: '#121110', symbolColor: '#F2F1EE', height: 36 } }
      : process.platform === 'darwin' ? { titleBarStyle: 'hidden', trafficLightPosition: { x: 16, y: 14 } } : {}),
    webPreferences: {
      partition: PARTITION,
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webviewTag: false,
      backgroundThrottling: false // o cronômetro segue contando com a janela atrás da janelinha
    }
  });
  const wc = mainWin.webContents;
  mainWin.once('ready-to-show', () => mainWin && mainWin.show());
  wc.on('will-navigate', (e, url) => {
    if (!isSiteUrl(url)) { e.preventDefault(); openExternalSafe(url); }
  });
  wc.setWindowOpenHandler(({ url }) => {
    if (!isSiteUrl(url)) openExternalSafe(url);
    else wc.loadURL(url);
    return { action: 'deny' };
  });
  wc.on('will-attach-webview', (e) => e.preventDefault());
  mainWin.on('page-title-updated', () => {});
  mainWin.on('closed', () => {
    mainWin = null;
    closeMini(false);
  });
  mainWin.loadURL(SITE_URL);
}

function focusMain() {
  if (!mainWin || mainWin.isDestroyed()) return;
  if (mainWin.isMinimized()) mainWin.restore();
  mainWin.show();
  mainWin.focus();
}

/* ---------- janelinha ---------- */
const posFile = () => path.join(app.getPath('userData'), 'mini-position.json');
function loadPos() {
  try {
    const p = JSON.parse(fs.readFileSync(posFile(), 'utf8'));
    if (Number.isFinite(p.x) && Number.isFinite(p.y)) {
      const ok = screen.getAllDisplays().some(d => {
        const a = d.workArea;
        return p.x >= a.x - 20 && p.y >= a.y - 20 && p.x + MINI_W <= a.x + a.width + 20 && p.y + MINI_H <= a.y + a.height + 20;
      });
      if (ok) return { x: Math.round(p.x), y: Math.round(p.y) };
    }
  } catch (e) { /* primeira vez */ }
  const a = screen.getPrimaryDisplay().workArea;
  return { x: a.x + a.width - MINI_W - 16, y: a.y + a.height - MINI_H - 16 };
}
function savePosSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!miniWin || miniWin.isDestroyed()) return;
    const [x, y] = miniWin.getPosition();
    try { fs.writeFileSync(posFile(), JSON.stringify({ x, y })); } catch (e) { /* ignora */ }
  }, 300);
}

function pushState() {
  if (miniWin && !miniWin.isDestroyed() && lastState && miniReady) {
    miniWin.webContents.send('mini:state', lastState);
  }
}

function openMini(state) {
  const clean = validateState(state);
  if (!clean) return;
  lastState = clean;
  if (miniWin && !miniWin.isDestroyed()) { pushState(); if (!miniWin.isVisible()) miniWin.showInactive(); return; }
  const { x, y } = loadPos();
  miniWin = new BrowserWindow({
    x, y, width: MINI_W, height: MINI_H,
    useContentSize: true,
    frame: false, transparent: true, hasShadow: false, backgroundColor: '#00000000',
    alwaysOnTop: true, resizable: false, maximizable: false, minimizable: false, fullscreenable: false,
    skipTaskbar: true, show: false,
    title: 'Foccus',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'mini-preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webviewTag: false,
      backgroundThrottling: false,
      spellcheck: false
    }
  });
  const w = miniWin;
  w.setAlwaysOnTop(true, process.platform === 'darwin' ? 'floating' : 'screen-saver');
  if (process.platform === 'darwin') w.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  w.webContents.on('will-navigate', (e) => e.preventDefault());
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  miniReady = false;
  w.webContents.on('dom-ready', () => { miniReady = true; if (lastState) w.webContents.send('mini:state', lastState); if (!w.isDestroyed()) w.showInactive(); });
  w.on('moved', savePosSoon);
  w.on('closed', () => {
    const byUser = !miniClosingByApp;
    miniWin = null;
    miniClosingByApp = false;
    if (byUser) sendToMain('closed');
  });
  w.loadFile(path.join(__dirname, 'mini.html'));
}

function closeMini(notify) {
  if (!miniWin || miniWin.isDestroyed()) return;
  miniClosingByApp = !notify;
  miniWin.close();
}

function sendToMain(cmd) {
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('mini:command', cmd);
}

/* ---------- IPC ---------- */
// cor dos 3 botões do Windows acompanha o tema do site (fundo e símbolo)
const TITLEBAR = { light: ['#F2F1EE', '#121110'], dark: ['#121110', '#F2F1EE'], black: ['#050505', '#F2F1EE'] };
ipcMain.on('desk:theme', (e, t) => {
  if (!fromMain(e) || process.platform !== 'win32' || !mainWin || mainWin.isDestroyed() || !Object.prototype.hasOwnProperty.call(TITLEBAR, t)) return;
  try { mainWin.setTitleBarOverlay({ color: TITLEBAR[t][0], symbolColor: TITLEBAR[t][1], height: 36 }); mainWin.setBackgroundColor(TITLEBAR[t][0]); } catch (err) { /* sem overlay: ignora */ }
});
ipcMain.on('mini:open', (e, s) => { if (fromMain(e)) openMini(s); });
ipcMain.on('mini:update', (e, s) => {
  if (!fromMain(e)) return;
  const clean = validateState(s);
  if (!clean) return;
  lastState = clean;
  pushState();
});
ipcMain.on('mini:close', (e) => { if (fromMain(e)) closeMini(false); });
ipcMain.on('mini:cmd', (e, cmd) => {
  if (!fromMini(e)) return;
  if (cmd === 'play' || cmd === 'pause') sendToMain(cmd);
  else if (cmd === 'open') { focusMain(); sendToMain('open'); }
  else if (cmd === 'close') closeMini(true);
});

/* ---------- menu ---------- */
function buildMenu() {
  if (process.platform !== 'darwin') { Menu.setApplicationMenu(null); return; }
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Foccus', submenu: [
      { role: 'about', label: 'Sobre o Foccus' }, { type: 'separator' },
      { role: 'hide', label: 'Ocultar o Foccus' }, { role: 'hideOthers', label: 'Ocultar outros' },
      { role: 'unhide', label: 'Mostrar tudo' }, { type: 'separator' },
      { role: 'quit', label: 'Encerrar o Foccus' }
    ] },
    { label: 'Editar', submenu: [
      { role: 'undo', label: 'Desfazer' }, { role: 'redo', label: 'Refazer' }, { type: 'separator' },
      { role: 'cut', label: 'Recortar' }, { role: 'copy', label: 'Copiar' }, { role: 'paste', label: 'Colar' },
      { role: 'selectAll', label: 'Selecionar tudo' }
    ] },
    { label: 'Janela', submenu: [
      { role: 'reload', label: 'Recarregar' }, { role: 'minimize', label: 'Minimizar' },
      { role: 'zoom', label: 'Ampliar' }, { type: 'separator' },
      { role: 'front', label: 'Trazer tudo para a frente' }
    ] }
  ]));
}

/* ---------- ciclo de vida ---------- */
function setupSession() {
  const ses = session.fromPartition(PARTITION);
  // só a origem do Foccus; notificações e microfone (só áudio, para a captura por voz). Câmera e o resto ficam negados.
  const allow = (wc, permission, origin, details) => {
    let ok = false; try { ok = new URL(origin || wc.getURL()).origin === SITE_ORIGIN; } catch (e) { return false; }
    if (!ok) return false;
    if (permission === 'notifications') return true;
    if (permission === 'media') {
      const types = (details && (details.mediaTypes || (details.mediaType ? [details.mediaType] : []))) || [];
      return types.length > 0 && types.every(x => x === 'audio');
    }
    return false;
  };
  ses.setPermissionRequestHandler((wc, permission, cb, details) => cb(allow(wc, permission, details && details.requestingUrl, details)));
  ses.setPermissionCheckHandler((wc, permission, origin, details) => allow(wc, permission, origin, details));
}

async function runMiniTest() {
  const samples = [
    { title: 'Estudar redação do ENEM: proposta de intervenção', level: 'Profundo', time: '24:13', frac: 0.42, running: true, cover: null, theme: 'light' },
    { title: 'Revisar capítulo 4', level: 'Leve', time: '05:00', frac: 0.9, running: false, cover: null, theme: 'black' }
  ];
  // capa de teste: gradiente PNG simples gerado em memória
  const { nativeImage } = require('electron');
  const size = 64, buf = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) { const x = i % size, y = (i / size) | 0; buf[i * 4] = 40 + x * 3; buf[i * 4 + 1] = 90 + y * 2; buf[i * 4 + 2] = 160; buf[i * 4 + 3] = 255; }
  const png = nativeImage.createFromBitmap(buf, { width: size, height: size }).toPNG();
  samples.push({ title: 'Com capa', level: 'Médio', time: '12:34', frac: 0.6, running: true, cover: 'data:image/png;base64,' + png.toString('base64'), theme: 'dark' });
  samples.push({ title: 'Inválido', level: 'x', time: 'abc', frac: 2, running: true, cover: null, theme: 'light' });

  const outDir = process.env.MINI_PREVIEW_DIR || __dirname;
  let n = 0;
  const consoleErrors = [];
  for (const s of samples) {
    if (!validateState(s)) { console.log('[teste] state rejeitado (esperado para o inválido):', s.title); continue; }
    openMini(s);
    if (n === 0) miniWin.webContents.on('console-message', (e) => consoleErrors.push(e.message || JSON.stringify(e)));
    await new Promise(r => setTimeout(r, 2500));
    console.log('[teste] visivel:', miniWin.isVisible(), JSON.stringify(miniWin.getBounds()), 'carregando:', miniWin.webContents.isLoading());
    const img = await miniWin.webContents.capturePage();
    const file = path.join(outDir, n === 0 ? 'preview-mini.png' : `preview-mini-${n}.png`);
    fs.writeFileSync(file, img.toPNG());
    console.log('[teste] screenshot:', file, img.getSize());
    n++;
  }
  console.log('[teste] mensagens do console da mini:', JSON.stringify(consoleErrors));
  console.log('[teste] OK');
  closeMini(false);
  setTimeout(() => app.quit(), 300);
}

if (!TEST_MINI && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => focusMain());
  app.whenReady().then(() => {
    app.setAppUserModelId('app.foccus.desktop');
    buildMenu();
    if (TEST_MINI) { runMiniTest(); return; }
    setupSession();
    createMain();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0 || !mainWin) createMain();
      else focusMain();
    });
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' || TEST_MINI) app.quit();
  });
}
