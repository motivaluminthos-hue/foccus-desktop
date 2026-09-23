'use strict';
const $ = id => document.getElementById(id);
let playing = false;
window.spotBridge.onTrack(t => {
  playing = !!(t && t.playing);
  $('art').style.backgroundImage = (t && t.art) ? `url("${t.art}")` : '';
  $('title').textContent = (t && t.playing) ? t.title : 'Spotify';
  $('artist').textContent = (t && t.playing) ? t.artist : 'Nada tocando agora.';
  $('pp-icon').innerHTML = playing ? '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>' : '<path d="M8 5v14l11-7z"/>';
});
$('prev').onclick = () => window.spotBridge.cmd('prev');
$('pp').onclick = () => window.spotBridge.cmd('pp');
$('next').onclick = () => window.spotBridge.cmd('next');
$('close').onclick = () => window.spotBridge.cmd('close');
