'use strict';
const $ = id => document.getElementById(id);
let playing = false, volDrag = false;
window.spotBridge.onTrack(t => {
  playing = !!(t && t.playing);
  $('art').style.backgroundImage = (t && t.art) ? `url("${t.art}")` : '';
  $('title').textContent = (t && t.title) ? t.title : 'Spotify';
  $('artist').textContent = (t && t.title) ? t.artist : 'Nada tocando agora.';
  $('pp-icon').innerHTML = playing ? '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>' : '<path d="M8 5v14l11-7z"/>';
  if (!volDrag && t && typeof t.volume === 'number') $('volume').value = t.volume;
});
$('prev').onclick = () => window.spotBridge.cmd('prev');
$('pp').onclick = () => window.spotBridge.cmd('pp');
$('next').onclick = () => window.spotBridge.cmd('next');
$('close').onclick = () => window.spotBridge.cmd('close');
$('volume').addEventListener('pointerdown', () => volDrag = true);
$('volume').addEventListener('pointerup', () => volDrag = false);
$('volume').addEventListener('input', e => window.spotBridge.volume(+e.target.value));

/* a janela pode ficar tanto uma barra comprida quanto um quadrado/retrato — em vez de espremer
   tudo numa linha só (o que quebrava o layout), troca sozinho pro modo "card" (capa grande em
   cima, resto embaixo) quando a altura fica perto ou maior que a largura. */
function fitShape() {
  document.body.classList.toggle('tall', innerHeight > innerWidth * 0.62);
}
fitShape();
addEventListener('resize', fitShape);
