// Foccus Desktop — integração com o Spotify (widget "tocando agora", monocromático).
// Fica isolado deste arquivo: se não tiver Client ID configurado, tudo aqui vira no-op — nunca
// derruba o resto do programa. Usa PKCE (sem client secret) + um servidor local só pra pegar o
// redirect do login; depois disso é tudo chamada direta pra API do Spotify.
'use strict';
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { shell, app: electronApp } = require('electron');

const CLIENT_ID = (() => { try { return require('./spotify-config.json').clientId || ''; } catch (e) { return ''; } })();
const REDIRECT_PORT = 17654;
const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}/callback`;
const SCOPES = 'user-read-playback-state user-modify-playback-state user-read-currently-playing';
const TOKEN_FILE = () => path.join(electronApp.getPath('userData'), 'spotify-token.json');

const b64url = buf => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const readTokens = () => { try { return JSON.parse(fs.readFileSync(TOKEN_FILE(), 'utf8')); } catch (e) { return null; } };
const writeTokens = t => { try { fs.writeFileSync(TOKEN_FILE(), JSON.stringify(t)); } catch (e) { } };

let verifier = null, pollTimer = null, onTrack = null, server = null;

function configured() { return !!CLIENT_ID; }

function login() {
  if (!configured()) return Promise.reject(new Error('spotify_not_configured'));
  return new Promise((resolve, reject) => {
    verifier = b64url(crypto.randomBytes(64));
    const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
    if (server) { try { server.close(); } catch (e) { } server = null; }
    server = http.createServer((req, res) => {
      const url = new URL(req.url, REDIRECT_URI);
      if (url.pathname !== '/callback') { res.writeHead(404); return res.end(); }
      const code = url.searchParams.get('code'), err = url.searchParams.get('error');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;background:#050505;color:#F4F2EE;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><p>' + (err ? 'Não deu pra conectar. Pode fechar esta aba.' : 'Spotify conectado. Pode fechar esta aba.') + '</p></body>');
      server.close(); server = null;
      if (err || !code) return reject(new Error(err || 'no_code'));
      exchangeCode(code).then(resolve).catch(reject);
    });
    server.listen(REDIRECT_PORT, '127.0.0.1', () => {
      const p = new URLSearchParams({
        client_id: CLIENT_ID, response_type: 'code', redirect_uri: REDIRECT_URI,
        code_challenge_method: 'S256', code_challenge: challenge, scope: SCOPES
      });
      shell.openExternal('https://accounts.spotify.com/authorize?' + p.toString());
    });
  });
}

async function exchangeCode(code) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID, grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI, code_verifier: verifier
  });
  const r = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!r.ok) throw new Error('token_exchange_failed');
  const j = await r.json();
  writeTokens({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + j.expires_in * 1000 });
  return true;
}

async function refreshIfNeeded() {
  const t = readTokens(); if (!t) return null;
  if (t.expires_at > Date.now() + 30000) return t.access_token;
  const body = new URLSearchParams({ client_id: CLIENT_ID, grant_type: 'refresh_token', refresh_token: t.refresh_token });
  const r = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!r.ok) { writeTokens(null); return null; }
  const j = await r.json();
  const next = { access_token: j.access_token, refresh_token: j.refresh_token || t.refresh_token, expires_at: Date.now() + j.expires_in * 1000 };
  writeTokens(next); return next.access_token;
}

async function api(pathname, opts) {
  const tok = await refreshIfNeeded(); if (!tok) return null;
  const r = await fetch('https://api.spotify.com/v1' + pathname, { ...opts, headers: { ...(opts && opts.headers), Authorization: 'Bearer ' + tok } });
  if (r.status === 204 || r.status === 202) return null;
  if (!r.ok) return null;
  try { return await r.json(); } catch (e) { return null; }
}

async function nowPlaying() {
  const j = await api('/me/player');
  if (!j || !j.item) return { playing: false };
  const art = (j.item.album && j.item.album.images && j.item.album.images[0] && j.item.album.images[0].url) || null;
  const volume = j.device && typeof j.device.volume_percent === 'number' ? j.device.volume_percent : null;
  return { playing: !!j.is_playing, title: j.item.name, artist: (j.item.artists || []).map(a => a.name).join(', '), art, volume };
}

function startPolling(cb) {
  onTrack = cb; stopPolling();
  const tick = () => nowPlaying().then(t => { if (onTrack) onTrack(t); }).catch(() => { });
  tick(); pollTimer = setInterval(tick, 5000);
}
function stopPolling() { if (pollTimer) clearInterval(pollTimer); pollTimer = null; }

function logout() { writeTokens(null); stopPolling(); }
function isLoggedIn() { return !!readTokens(); }
const playPause = () => nowPlaying().then(t => api(t.playing ? '/me/player/pause' : '/me/player/play', { method: 'PUT' }));
const next = () => api('/me/player/next', { method: 'POST' });
const prev = () => api('/me/player/previous', { method: 'POST' });
const setVolume = pct => api('/me/player/volume?volume_percent=' + Math.max(0, Math.min(100, Math.round(pct))), { method: 'PUT' });

module.exports = { configured, login, logout, isLoggedIn, startPolling, stopPolling, playPause, next, prev, setVolume };
