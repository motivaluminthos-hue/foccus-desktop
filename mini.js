// Janelinha: monta o DOM só com textContent/atributos controlados (state é dado não confiável;
// o main já validou, mas aqui nada vira HTML).
'use strict';
const $ = (id) => document.getElementById(id);
const mini = $('mini'), cover = $('cover'), ring = $('ring');
const CIRC = 276.46;

// Fontes carregadas sem bloquear a primeira pintura (fallback sans-serif/monospace enquanto chegam).
for (const href of ['https://api.fontshare.com/v2/css?f[]=switzer@100,400,500,600,900&display=swap', 'https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500&display=swap']) {
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l);
}

function render(s) {
  document.documentElement.setAttribute('data-theme', ['light', 'dark', 'black'].includes(s.theme) ? s.theme : 'light');
  $('title').textContent = s.title;
  $('level').textContent = s.level;
  $('time').textContent = s.time;
  // mesma convenção do site: o traço avança conforme o tempo passa (frac = quanto falta)
  ring.style.strokeDashoffset = (CIRC * s.frac).toFixed(1);
  mini.classList.toggle('run', !!s.running);
  $('play').classList.toggle('on', !!s.running);
  $('pause').classList.toggle('on', !s.running);
  if (s.cover) {
    if (cover.getAttribute('src') !== s.cover) cover.src = s.cover;
    cover.hidden = false;
    mini.classList.add('img');
  } else {
    cover.hidden = true;
    cover.removeAttribute('src');
    mini.classList.remove('img');
  }
}

window.foccusMini.onState(render);
$('play').addEventListener('click', () => window.foccusMini.send('play'));
$('pause').addEventListener('click', () => window.foccusMini.send('pause'));
$('info').addEventListener('click', () => window.foccusMini.send('open'));
$('x').addEventListener('click', () => window.foccusMini.send('close'));

/* Aumentar e diminuir, e nada além disso: o desenho é feito UMA vez em 340x176 e escala inteiro por
   zoom. Assim o layout nunca muda de forma, só de tamanho — diferente do player do Spotify, que
   troca de formato. A proporção é travada no main.js, então largura basta. */
const BASE_W = 340;
/* innerWidth de propósito: medido, ele NÃO muda com o zoom da raiz (o clientWidth muda), então
   continua valendo o tamanho real da janela e a pinça não entra em laço. */
const largura = () => Math.round(innerWidth);
function escala() { document.documentElement.style.zoom = (largura() / BASE_W).toFixed(4); }
escala();
addEventListener('resize', escala);

/* Pinça do canto, feita à mão: janela transparente sem moldura no Windows não redimensiona pela
   borda. Usa coordenada de TELA (screenX) — com a da janela, ela cresce, a coordenada muda junto e
   o cálculo entra em laço. Os eventos ficam no documento, senão o arrasto se perde ao sair da pinça. */
(() => {
  const grip = $('grip');
  if (!grip || !window.foccusMini.setSize) return;
  let base = null, pedido = null, aguardando = false;
  const envia = () => { aguardando = false; if (pedido) window.foccusMini.setSize(pedido); };
  function move(e) {
    if (!base) return;
    e.preventDefault();
    pedido = Math.round(base.w + (e.screenX - base.sx));
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
    base = { sx: e.screenX, w: largura() };
    document.body.classList.add('redim');
    document.addEventListener('mousemove', move, true);
    document.addEventListener('mouseup', solta, true);
  });
})();
