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

/* capa ao lado (barra) ou em cima (quadrado/vertical) — decidido pelo formato aplicado.
   Como só existem formatos prontos, isso nunca cai num estado intermediário quebrado. */
function ajustaLayout() {
  document.body.classList.toggle('col', innerHeight > innerWidth * 0.78);
}
ajustaLayout();
addEventListener('resize', ajustaLayout);

/* alça do canto: um clique abre os formatos, outro clique aplica. */
(() => {
  const grip = $('grip'), menu = $('sizes');
  if (!grip || !menu) return;
  let lista = [], atual = 1;

  function desenha() {
    menu.innerHTML = lista.map((s, i) =>
      `<button data-i="${i}" class="${i === atual ? 'on' : ''}">${s.nome}</button>`).join('');
  }
  function carrega() {
    return window.spotBridge.sizes().then(r => {
      if (!r) return;
      lista = r.lista || []; atual = r.atual || 0; desenha();
    }).catch(() => { });
  }
  carrega();
  window.spotBridge.onSize(i => { atual = i; desenha(); });

  grip.addEventListener('click', async e => {
    e.stopPropagation();
    if (!lista.length) await carrega();
    menu.hidden = !menu.hidden;
  });
  menu.addEventListener('click', e => {
    const b = e.target.closest('[data-i]'); if (!b) return;
    const i = +b.dataset.i;
    atual = i; desenha(); menu.hidden = true;
    window.spotBridge.setSize(i);
  });
  document.addEventListener('click', () => { if (!menu.hidden) menu.hidden = true; });
})();
