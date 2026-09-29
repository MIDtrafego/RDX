// SÓ DA PÁGINA DE TESTE (abertura.html). NÃO levar para o index.html.
// Faz o papel do hero: carrega em saltos irregulares, avisa a abertura e entra em cena
// no instante em que ela começa a sair.
//
//   abertura.html?caso=rapido     carrega em 0,3 s (a abertura respeita o mínimo de 1,2 s)
//   abertura.html?caso=normal     carrega em 2,5 s
//   abertura.html?caso=travado    para em 62% e nunca avisa que ficou pronto (sai em 8 s)
//   abertura.html?congelar=0.4    para a transição de saída em 40%, para conferir o desenho
//   abertura.html?escrita=0.4     para a escrita da marca em 40%
import { gsap } from 'gsap';
import { iniciarAbertura } from './abertura.js';

const CASOS = {
  rapido: { nome: 'rápido', total: 300 },
  normal: { nome: 'normal', total: 2500 },
  travado: { nome: 'travado', total: 2500, paraEm: 0.62 },
};

// [instante, progresso] em fração do total
const SALTOS = [
  [0.05, 0.04], [0.13, 0.11], [0.2, 0.19], [0.33, 0.37], [0.46, 0.42],
  [0.57, 0.61], [0.7, 0.66], [0.82, 0.84], [0.93, 0.91], [1, 1],
];

const parametros = new URLSearchParams(location.search);
const chave = CASOS[parametros.get('caso')] ? parametros.get('caso') : 'normal';
const caso = CASOS[chave];
const congelar = parametros.has('congelar') ? Number(parametros.get('congelar')) : null;
const escrita = parametros.has('escrita') ? Number(parametros.get('escrita')) : null;

const registro = [];
const anotar = (tipo, valor) => registro.push({ t: Math.round(performance.now()), tipo, valor });

const abertura = iniciarAbertura();
window.__abTeste = { caso: chave, abertura, registro };

// ───────────── hero de mentira ─────────────
const servidor = document.querySelector('.ab-teste-servidor');
const topo = document.querySelector('.ab-teste-topo');
const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;

if (congelar === null && !reduzido) {
  gsap.set(servidor, { opacity: 0, y: 60 });
  gsap.set(topo, { opacity: 0, y: -14 });
}

window.addEventListener('rdx:abertura-saindo', (e) => {
  anotar('saindo', e.detail.motivo);
  if (congelar !== null || reduzido) return;
  gsap.to(servidor, { opacity: 1, duration: 1.1, ease: 'power3.out', delay: 0.15 });
  gsap.to(servidor, { y: 0, duration: 1.6, ease: 'expo.out', delay: 0.15 });
  gsap.to(topo, { opacity: 1, y: 0, duration: 1.0, ease: 'expo.out', delay: 0.5 });
}, { once: true });

window.addEventListener('rdx:abertura-fim', (e) => {
  anotar('fim', e.detail.motivo);
  escreverLeitura(e.detail);
}, { once: true });

// ───────────── leitura ─────────────
const leitura = document.querySelector('.ab-teste-leitura');
const segundos = (ms) => (ms / 1000).toFixed(2).replace('.', ',') + ' s';
const MOTIVOS = { pronto: 'hero pronto', 'tempo-maximo': 'tempo máximo', socorro: 'socorro', teste: 'teste' };

function escreverLeitura(detalhe) {
  if (!leitura) return;
  leitura.innerHTML =
    'Caso <b>' + caso.nome + '</b><br>' +
    'Na tela <b>' + segundos(detalhe.naTela || 0) + '</b><br>' +
    'Saiu por <b>' + (MOTIVOS[detalhe.motivo] || detalhe.motivo) + '</b>';
}

document.querySelectorAll('.ab-teste-casos a').forEach((a) => {
  if (a.dataset.caso === chave) a.setAttribute('aria-current', 'true');
});

// ───────────── carregamento simulado ─────────────
if (escrita !== null) {
  // a caneta para no ponto pedido; o carregamento não anda (a abertura sai sozinha em 8 s)
  abertura.marca.pause().progress(Math.max(0, Math.min(1, escrita)));
} else if (congelar !== null) {
  abertura.progresso(1).pronto();
  abertura.congelar(congelar);
} else {
  SALTOS.forEach(([instante, p]) => {
    if (caso.paraEm && p > caso.paraEm) return;
    setTimeout(() => {
      abertura.progresso(p);
      anotar('progresso', p);
      if (p === 1) {
        abertura.pronto();
        anotar('pronto', 1);
      }
    }, instante * caso.total);
  });
}
