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
  /* progresso: guarda a referência e deixa o relógio local andar entre as consultas (5s), pra
     barra não ficar pulando de 5 em 5 segundos */
  if (t && typeof t.pos === 'number' && typeof t.dur === 'number') { prog = { pos: t.pos, dur: t.dur, em: Date.now() }; }
  else prog = null;
  pintaProgresso();
});
const mmss = ms => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
let prog = null;
function pintaProgresso() {
  if (!prog || !prog.dur) { $('prog-fill').style.width = '0'; $('pos').textContent = '0:00'; $('dur').textContent = '0:00'; return; }
  const decorrido = prog.pos + (playing ? Date.now() - prog.em : 0);
  const atual = Math.min(prog.dur, decorrido);
  $('prog-fill').style.width = (atual / prog.dur * 100).toFixed(1) + '%';
  $('pos').textContent = mmss(atual);
  $('dur').textContent = mmss(prog.dur);
}
setInterval(pintaProgresso, 1000);
$('prev').onclick = () => window.spotBridge.cmd('prev');
$('pp').onclick = () => window.spotBridge.cmd('pp');
$('next').onclick = () => window.spotBridge.cmd('next');
$('close').onclick = () => window.spotBridge.cmd('close');
$('volume').addEventListener('pointerdown', () => volDrag = true);
$('volume').addEventListener('pointerup', () => volDrag = false);
$('volume').addEventListener('input', e => window.spotBridge.volume(+e.target.value));

/* capa ao lado (janela mais larga) ou em cima (mais alta/quadrada). Como tudo escala por vh,
   qualquer tamanho intermediário do arrasto continua proporcional. */
function ajustaLayout() { document.body.classList.toggle('col', innerHeight > innerWidth * 0.78); }
ajustaLayout();
addEventListener('resize', ajustaLayout);

/* tema (claro/escuro/preto) vindo do app, pra janelinha não destoar */
window.spotBridge.onTheme(t => {
  document.documentElement.setAttribute('data-theme', ['light', 'dark', 'black'].includes(t) ? t : 'light');
});

/* Arrastar a pinça do canto pra redimensionar.
   Feito na mão porque janela transparente sem moldura no Windows não redimensiona pela borda.
   Usa coordenadas de TELA (screenX/screenY), nunca as da janela: enquanto a janela cresce, as
   coordenadas internas mudam junto e o cálculo entra num laço que trava ou pula — foi o que
   quebrou a primeira tentativa. Os eventos ficam no documento, senão o arrasto se perde ao sair
   da pinça. */
(() => {
  const grip = $('grip'); if (!grip) return;
  let base = null, pedido = null, aguardando = false;

  function envia() {
    aguardando = false;
    if (pedido) window.spotBridge.setSize(pedido.w, pedido.h);
  }
  function move(e) {
    if (!base) return;
    e.preventDefault();
    pedido = { w: Math.round(base.w + (e.screenX - base.sx)), h: Math.round(base.h + (e.screenY - base.sy)) };
    if (!aguardando) { aguardando = true; requestAnimationFrame(envia); }
  }
  function solta() {
    if (!base) return;
    base = null; pedido = null;
    document.body.classList.remove('redim');
    document.removeEventListener('mousemove', move, true);
    document.removeEventListener('mouseup', solta, true);
  }
  grip.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    base = { sx: e.screenX, sy: e.screenY, w: innerWidth, h: innerHeight };
    document.body.classList.add('redim');
    document.addEventListener('mousemove', move, true);
    document.addEventListener('mouseup', solta, true);
  });
})();
