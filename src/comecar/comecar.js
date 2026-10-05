// Página "Comece hoje" (comecar.html): o vídeo, os três passos e o botão do painel.
//
// Os endereços que a página aponta ficam todos aqui, num lugar só.
// Quando o Pedro passar o link de indicação da Exness e o endereço do painel, é só trocar.

import { criarFundo } from '../conta/fundo.js';

const LINKS = {
  exness: 'https://www.exness.com/',   // link de cadastro na corretora
  cadastro: '/cadastro.html',           // criar a conta RDX
  painel: '/entrar.html',               // entrar no painel
};

// ───────────── endereços ─────────────
for (const el of document.querySelectorAll('[data-cm-link]')) {
  const alvo = LINKS[el.dataset.cmLink];
  if (alvo) el.href = alvo;
}

// ───────────── fundo ─────────────
const canvasFundo = document.getElementById('cm-fundo');
const reduzMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (canvasFundo) criarFundo(canvasFundo, { parado: reduzMovimento });

// ───────────── vídeo ─────────────
const caixa = document.getElementById('cm-video');
if (caixa) {
  const video = caixa.querySelector('video');
  const play = caixa.querySelector('.cm-video-play');
  const falta = caixa.querySelector('.cm-video-falta');
  const fonte = video.querySelector('source');

  const semVideo = () => {
    caixa.dataset.cmEstado = 'falta';
    if (falta) falta.hidden = false;
    if (play) play.hidden = true;
  };
  // o erro de carga chega no <source> (último da lista) ou no próprio <video>
  if (fonte) fonte.addEventListener('error', semVideo);
  video.addEventListener('error', semVideo);
  // o erro pode ter acontecido antes deste módulo carregar: confere o estado também
  const conferir = () => {
    if (video.error || video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) semVideo();
  };
  conferir();
  setTimeout(conferir, 1500);
  setTimeout(conferir, 4000);

  const tocar = () => {
    video.controls = true;
    const p = video.play();
    if (p && p.catch) p.catch(() => {});
  };
  if (play) play.addEventListener('click', tocar);
  video.addEventListener('click', () => { if (caixa.dataset.cmEstado === 'parado') tocar(); });
  video.addEventListener('play', () => { caixa.dataset.cmEstado = 'tocando'; });
  video.addEventListener('pause', () => { if (caixa.dataset.cmEstado !== 'falta') caixa.dataset.cmEstado = 'pausado'; });
  video.addEventListener('ended', () => { caixa.dataset.cmEstado = 'pausado'; });
}

// ───────────── "como" de cada clique ─────────────
for (const botao of document.querySelectorAll('.cm-item-botao[aria-controls]')) {
  const painel = document.getElementById(botao.getAttribute('aria-controls'));
  if (!painel) continue;
  botao.addEventListener('click', () => {
    const aberto = botao.getAttribute('aria-expanded') === 'true';
    botao.setAttribute('aria-expanded', String(!aberto));
    painel.hidden = aberto;
    botao.closest('.cm-item').classList.toggle('cm-item-aberto', !aberto);
  });
}

// ───────────── revelação ao rolar ─────────────
const revelar = [...document.querySelectorAll('.cm-revela')];
const passos = [...document.querySelectorAll('.cm-passo')];
if ('IntersectionObserver' in window && !reduzMovimento) {
  const olho = new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('cm-visto');
      olho.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
  revelar.forEach((el) => olho.observe(el));

  // o fio de cada passo acende quando o passo entra em cena
  const olhoPasso = new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('cm-passo-aceso');
      olhoPasso.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -30% 0px', threshold: 0.05 });
  passos.forEach((el) => olhoPasso.observe(el));
} else {
  revelar.forEach((el) => el.classList.add('cm-visto'));
  passos.forEach((el) => el.classList.add('cm-passo-aceso'));
}
