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
