// Seções de rolagem do site RDX.
//
// Uso:
//   import { iniciarSecoes } from '/src/secoes/secoes.js';
//   const secoes = iniciarSecoes();            // nada roda sozinho ao importar
//
// Opções (todas opcionais):
//   raiz           elemento ou seletor do contêiner. Padrão: '#secoes'
//   rolagemSuave   false desliga o Lenis (a página rola do jeito nativo)
//   lenis          uma instância de Lenis já criada pelo site, para não ter duas
//   cursor         false desliga o cursor próprio
//   dados          objeto RDX_DATA do track record (curva diária e lista de ordens)
//   links          { cadastro: '/cadastro', login: '/login' } destino dos botões da chamada final
//
// Devolve { lenis, rolarPara, atualizar, destruir }.
//
// Evento para o resto do site (o hero 3D ouve isto):
//   window.addEventListener('rdx:rolagem', (e) => {
//     e.detail.progresso   0 a 1 na página inteira
//     e.detail.secao       id da seção no meio da tela ('hero', 'problema', 'capacidades', ...)
//     e.detail.y           posição da rolagem em px
//     e.detail.tema        'escuro' ou 'claro': o que está debaixo da MARCA, no canto de cima à esquerda
//     e.detail.temaBotoes  'escuro' ou 'claro': o que está debaixo dos BOTÕES, no canto de cima à direita
//     e.detail.velocidade  px por quadro, com sinal
//   });
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

import { limitar, conferirRede, esvaziarRede } from './nucleo.js';
import { iniciarProblema } from './problema.js';
import { iniciarCapacidades } from './capacidades.js';
import { iniciarDescansa } from './descansa.js';
import { iniciarCores } from './cores.js';
import { iniciarTrackRecord } from './track-record.js';
import { iniciarAcesso } from './acesso.js';
import { iniciarFaq } from './faq.js';
import { iniciarRodape } from './rodape.js';
import { iniciarCursor, iniciarImas } from './cursor.js';

// a ordem é a da página: os pins de cima precisam existir antes dos gatilhos de baixo
const SECOES = [
  iniciarProblema,
  iniciarCapacidades,
  iniciarDescansa,
  iniciarCores,
  iniciarTrackRecord,
  iniciarAcesso,
  iniciarFaq,
  iniciarRodape,
  iniciarImas,
  iniciarCursor,
];

let instancia = null;

export function iniciarSecoes(opcoes = {}) {
  if (instancia) return instancia;

  const raiz = typeof opcoes.raiz === 'string'
    ? document.querySelector(opcoes.raiz)
    : opcoes.raiz || document.getElementById('secoes');
  if (!raiz) {
    console.warn('[rdx] contêiner das seções não encontrado');
    return null;
  }

  gsap.registerPlugin(ScrollTrigger, SplitText);
  ScrollTrigger.config({ ignoreMobileResize: true });

  // a partir daqui o CSS pode contar com o JS: estado escondido só depois desta linha
  raiz.classList.add('rx-js');

  let lenis = null;
  let lenisProprio = false;

  // ───────────── evento rdx:rolagem ─────────────
  const leitura = { secao: 'hero', tema: 'escuro', temaBotoes: 'escuro', ultima: 0 };

  // primeiro elemento das seções que está naquele ponto da tela (o hit test respeita clip-path)
  function noPonto(x, y) {
    for (const el of document.elementsFromPoint(x, y)) {
      if (el !== raiz && raiz.contains(el)) return el;
    }
    return null;
  }
  function temaEm(x, y) {
    const el = noPonto(x, y);
    const dono = el ? el.closest('[data-rx-tema]') : null;
    return dono ? dono.dataset.rxTema : 'escuro';
  }

  function lerTela() {
    leitura.ultima = performance.now();
    const L = document.documentElement.clientWidth;
    const meio = noPonto(L / 2, window.innerHeight / 2);
    const dona = meio ? meio.closest('.rx-secao') : null;
    const secao = dona && dona.id ? dona.id : 'hero';
    const tema = temaEm(Math.min(64, L / 2), 44);
    const temaBotoes = temaEm(Math.max(L - 110, L / 2), 44);
    const mudou = secao !== leitura.secao || tema !== leitura.tema || temaBotoes !== leitura.temaBotoes;
    leitura.secao = secao;
    leitura.tema = tema;
    leitura.temaBotoes = temaBotoes;
    return mudou;
  }

  function emitir() {
    const y = lenis ? lenis.scroll : window.scrollY;
    const limite = lenis ? lenis.limit : document.documentElement.scrollHeight - window.innerHeight;
    const velocidade = lenis ? lenis.velocity : 0;
    window.dispatchEvent(new CustomEvent('rdx:rolagem', {
      detail: {
        progresso: limite > 0 ? limitar(y / limite, 0, 1) : 0,
        secao: leitura.secao,
        y,
        tema: leitura.tema,
        temaBotoes: leitura.temaBotoes,
        velocidade,
      },
    }));
  }

  let parada = 0;
  function aoRolar() {
    // a leitura da tela custa um teste de acerto: no máximo uma a cada 90 ms
    if (performance.now() - leitura.ultima > 90) lerTela();
    emitir();
    clearTimeout(parada);
    parada = setTimeout(() => {
      conferirRede();
      if (lerTela()) emitir();
    }, 160);
  }

  // ───────────── links internos e ações ─────────────
  function rolarPara(alvo, extra = {}) {
    const destino = typeof alvo === 'string' ? document.querySelector(alvo) : alvo;
    if (destino === null || destino === undefined) return;
    if (lenis) lenis.scrollTo(destino, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4), ...extra });
    else if (typeof destino === 'number') window.scrollTo({ top: destino });
    else destino.scrollIntoView({ block: 'start' });
  }

  function aoClicar(e) {
    const link = e.target instanceof Element ? e.target.closest('a[href]') : null;
    if (!link || !raiz.contains(link)) return;

    const acao = link.dataset.rxAcao;
    if (acao) {
      const destino = opcoes.links && opcoes.links[acao];
      window.dispatchEvent(new CustomEvent('rdx:acao', { detail: { acao, origem: link } }));
      if (!destino) e.preventDefault();      // sem destino definido o botão não joga a página para o topo
      return;
    }

    const href = link.getAttribute('href');
    if (!href || href.charAt(0) !== '#' || href.length < 2) return;
    const destino = document.getElementById(href.slice(1));
    if (!destino) return;
    e.preventDefault();
    rolarPara(destino);
  }
  raiz.addEventListener('click', aoClicar);

  if (opcoes.links) {
    for (const link of raiz.querySelectorAll('a[data-rx-acao]')) {
      const destino = opcoes.links[link.dataset.rxAcao];
      if (destino) link.setAttribute('href', destino);
    }
  }

  // ───────────── montagem por condição de tela ─────────────
  const mm = gsap.matchMedia();
  const tique = (tempo) => { if (lenis) lenis.raf(tempo * 1000); };

  mm.add(
    {
      sempre: '(min-width: 1px)',
      mesa: '(min-width: 992px)',
      largo: '(min-width: 992px)',
      calmo: '(prefers-reduced-motion: reduce)',
      fino: '(hover: hover) and (pointer: fine)',
    },
    (contexto) => {
      const { mesa, largo, calmo, fino } = contexto.conditions;
      const anima = !calmo;
      raiz.classList.toggle('rx-anima', anima);

      if (anima && opcoes.rolagemSuave !== false) {
        if (opcoes.lenis) {
          lenis = opcoes.lenis;
        } else {
          lenis = new Lenis({
            lerp: 0.1,
            wheelMultiplier: 1,
            smoothWheel: true,
            syncTouch: false,          // no toque a rolagem é a nativa do aparelho
            autoRaf: false,
          });
          lenisProprio = true;
          gsap.ticker.add(tique);
          gsap.ticker.lagSmoothing(0);
        }
        lenis.on('scroll', ScrollTrigger.update);
        lenis.on('scroll', aoRolar);
      } else {
        window.addEventListener('scroll', aoRolar, { passive: true });
      }

      const ctx = {
        raiz,
        opcoes,
        anima,
        mesa,             // 992 px ou mais: o trilho trava e anda de lado
        largo,            // 992 px ou mais: colunas lado a lado
        fino,             // mouse de verdade: cursor próprio, ímã, inclinação
        lenis: () => lenis,
      };

      const limpezas = [];
      for (const iniciar of SECOES) {
        try {
          const limpar = iniciar(ctx);
          if (typeof limpar === 'function') limpezas.push(limpar);
        } catch (erro) {
          // uma seção com problema não pode derrubar as outras nem deixar nada escondido
          console.error('[rdx] falha ao iniciar ' + iniciar.name, erro);
        }
      }

      ScrollTrigger.refresh();
      lerTela();
      emitir();

      return () => {
        limpezas.reverse().forEach((f) => { try { f(); } catch (erro) { console.error(erro); } });
        esvaziarRede();
        window.removeEventListener('scroll', aoRolar);
        if (lenis) {
          lenis.off('scroll', ScrollTrigger.update);
          lenis.off('scroll', aoRolar);
          if (lenisProprio) {
            gsap.ticker.remove(tique);
            lenis.destroy();
          }
          lenis = null;
          lenisProprio = false;
        }
        raiz.classList.remove('rx-anima');
      };
    },
  );

  // fonte carregada muda a altura dos títulos: recalcula os gatilhos
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => ScrollTrigger.refresh());
  }
  window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });

  instancia = {
    get lenis() { return lenis; },
    rolarPara,
    atualizar: () => ScrollTrigger.refresh(),
    destruir() {
      mm.revert();
      raiz.removeEventListener('click', aoClicar);
      clearTimeout(parada);
      raiz.classList.remove('rx-js', 'rx-anima');
      instancia = null;
    },
  };
  return instancia;
}
