// Abertura do RDX: tela de carregamento e transição de entrada.
//
//   import { iniciarAbertura } from './abertura/abertura.js';
//   const abertura = iniciarAbertura();
//   abertura.progresso(0.4);     // de 0 a 1, quantas vezes quiser, conforme o hero carrega
//   abertura.pronto();           // o hero está pronto: ela espera o tempo mínimo e sai
//   await abertura.terminou;     // a transição de saída acabou
//
// Eventos em window:
//   rdx:abertura-saindo   a saída começou   detail: { motivo, duracao }   (duracao em segundos)
//   rdx:abertura-fim      a saída acabou    detail: { motivo, naTela }    (naTela em ms)
//   motivo: 'pronto' | 'tempo-maximo' | 'socorro' | 'teste'
//
// O primeiro quadro não depende deste arquivo: quem garante é o CSS crítico mais o script
// embutido no <head> (abertura-critico.css e abertura-cabeca.js). Se este módulo nunca
// chegar, aquele script tira a abertura sozinho depois de 8 s.
import { gsap } from 'gsap';
import { montarMarca } from '../marca.js';

const PADRAO = {
  tempoMinimo: 1500,   // ms na tela, mesmo que tudo carregue na hora (a escrita da marca precisa caber)
  tempoMaximo: 8000,   // ms: passou disso, sai sozinha
  pausaNoCem: 220,     // ms com o 100 parado, e a marca pronta, antes de sair
  escrita: 1.2,        // s que a caneta leva para escrever a logo (RDX e depois TECHNOLOGY)
  frases: {
    etapas: ['conectando ao cluster', 'carregando o motor', 'sincronizando o terminal'],
    espera: 'aguardando resposta',   // aparece quando o progresso para de andar
    fim: 'motor pronto',
  },
  corDaMarca: '#050706',
  corFrente: '#c8f52a',
  corFundo: '#4ade80',   // cor da folha de trás da cortina; com null a cortina fica de uma cor só
};

const RITMO = 7;            // quanto maior, mais rápido o número alcança o progresso informado
const PASSO_MINIMO = 14;    // pontos por segundo, para o número não rastejar no fim
const FRASE_MINIMA = 600;   // ms que uma frase fica na tela antes de poder trocar
const PARADO_DEPOIS = 2200; // ms sem avanço para mostrar a frase de espera

// tempos da saída, em segundos (no total: 1,29 s)
const SAIDA = {
  rodape: 0.4,          // contador, status e linha saem primeiro: ficam embaixo, por onde a cortina começa a subir
  marcaInicio: 0.05,
  marca: 0.5,
  cascata: 0.05,
  cortinaInicio: 0.26,
  cortina: 0.96,
  atrasoDoFundo: 0.07,  // a folha de trás sai logo depois da folha da frente
};

const TECLAS_DE_ROLAGEM = [' ', 'Spacebar', 'PageDown', 'PageUp', 'End', 'Home', 'ArrowDown', 'ArrowUp'];
const SVG = 'http://www.w3.org/2000/svg';

let unica = null;

function inerte(estado) {
  const feito = Promise.resolve({ motivo: 'ausente', naTela: 0 });
  const c = {
    progresso() { return c; },
    pronto() { return c; },
    congelar() { return c; },
    terminou: feito,
    saindo: feito,
    saida: null,
    marca: null,
    duracaoDaEscrita: 0,
    estado,
    informado: 0,
    mostrado: 0,
  };
  return c;
}

export function iniciarAbertura(opcoes = {}) {
  if (unica) return unica;

  const cfg = { ...PADRAO, ...opcoes, frases: { ...PADRAO.frases, ...(opcoes.frases || {}) } };
  const html = document.documentElement;
  const raiz = opcoes.raiz || document.getElementById('abertura');
  const global = (window.__abertura = window.__abertura || { estado: 'carregando', inicio: 0, socorro: 0 });

  // sem o bloco na página, ou com a saída de socorro já disparada: nada a fazer
  if (!raiz || global.estado !== 'carregando') {
    clearTimeout(global.socorro);
    html.classList.remove('ab-ligado', 'ab-travado', 'ab-socorro');
    global.estado = 'fim';
    return (unica = inerte('fim'));
  }

  // a partir daqui quem cuida do tempo máximo é este módulo
  clearTimeout(global.socorro);
  html.classList.add('ab-ligado', 'ab-travado');
  raiz.classList.add('ab-vivo');

  const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const inicio = global.inicio || performance.now();
  global.inicio = inicio;

  const svgMarca = raiz.querySelector('svg.ab-marca');
  const marca = [svgMarca].filter(Boolean);
  const rodape = raiz.querySelector('.ab-rodape');
  const trilho = raiz.querySelector('.ab-status-trilho');
  const cursor = raiz.querySelector('.ab-cursor');
  const numero = raiz.querySelector('.ab-numero');
  const linha = raiz.querySelector('.ab-linha');
  const cheia = raiz.querySelector('.ab-linha-cheia');
  const doRodape = [trilho, numero].filter(Boolean);

  let estado = 'carregando';
  let informado = 0;          // progresso que o hero informou, de 0 a 1
  let mostrado = 0;           // o que o contador mostra, de 0 a 100
  let escrito = -1;
  let sinalPronto = false;
  let motivoDaSaida = '';
  let ultimoAvanco = performance.now();
  let chegouACem = 0;
  let entrou = false;
  let entrouEm = 0;
  let rodapeVisivel = false;
  let ultimoQuadro = performance.now();

  let avisarSaindo, avisarTerminou;
  const saindo = new Promise((ok) => { avisarSaindo = ok; });
  const terminou = new Promise((ok) => { avisarTerminou = ok; });

  const evento = (nome, detail) => window.dispatchEvent(new CustomEvent(nome, { detail }));

  // ───────────── cortina ─────────────
  // Duas folhas num SVG que estica com a tela. A da frente é o lima, a de trás é o verde.
  // A borda de baixo de cada folha é uma curva: o meio sobe antes e os lados acompanham.
  const cortina = document.createElementNS(SVG, 'svg');
  cortina.setAttribute('class', 'ab-cortina');
  cortina.setAttribute('viewBox', '0 0 100 100');
  cortina.setAttribute('preserveAspectRatio', 'none');
  cortina.setAttribute('aria-hidden', 'true');
  cortina.setAttribute('focusable', 'false');
  cortina.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none';
  const folha = (classe, cor) => {
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('class', classe);
    p.setAttribute('fill', cor);
    cortina.appendChild(p);
    return p;
  };
  const folhaFundo = cfg.corFundo ? folha('ab-cortina-fundo', cfg.corFundo) : null;
  const folhaFrente = folha('ab-cortina-frente', cfg.corFrente);
  raiz.insertBefore(cortina, raiz.firstChild);

  const curva = gsap.parseEase('expo.inOut');
  const avanco = { frente: 0, fundo: 0 };

  // altura da barriga da curva, em unidades do desenho (0 a 100 na altura da tela)
  function barriga() {
    const L = raiz.clientWidth || window.innerWidth;
    const A = raiz.clientHeight || window.innerHeight;
    return (Math.min(L * 0.26, A * 0.3) / A) * 100;
  }

  function contorno(t, alturaDaBarriga) {
    const lado = 100 * (1 - curva(t));
    const meio = lado - 2 * alturaDaBarriga * Math.sin(Math.PI * t);
    return 'M-1 -1H101V' + lado.toFixed(3) + 'Q50 ' + meio.toFixed(3) + ' -1 ' + lado.toFixed(3) + 'Z';
  }

  function desenharCortina() {
    const b = barriga();
    folhaFrente.setAttribute('d', contorno(avanco.frente, b));
    if (folhaFundo) folhaFundo.setAttribute('d', contorno(avanco.fundo, b * 1.12));
  }
  desenharCortina();
  window.addEventListener('resize', desenharCortina);

  // ───────────── contador e linha ─────────────
  function escrever() {
    const inteiro = Math.min(100, Math.floor(mostrado + 1e-6));
    if (inteiro !== escrito) {
      escrito = inteiro;
      if (numero) numero.textContent = String(inteiro).padStart(3, '0');
    }
    if (cheia) cheia.style.transform = 'scaleX(' + (mostrado / 100).toFixed(4) + ')';
  }

  // teto do contador: nunca passa do que foi informado, e 100 só depois do pronto()
  const teto = () => (sinalPronto ? 100 : Math.min(informado * 100, 99));

  // ───────────── linha de status ─────────────
  let frase = trilho ? trilho.querySelector('.ab-status-texto') : null;
  let fraseAtual = frase ? frase.textContent.trim() : '';
  let fraseDesde = performance.now();

  function fraseDaVez(agora) {
    if (sinalPronto && mostrado >= 100) return cfg.frases.fim;
    if (!sinalPronto && agora - ultimoAvanco > PARADO_DEPOIS && mostrado >= teto() - 0.5) return cfg.frases.espera;
    const lista = cfg.frases.etapas;
    return lista[Math.min(lista.length - 1, Math.floor((mostrado / 100) * lista.length))];
  }

  function trocarFrase(texto, agora) {
    if (!trilho || texto === fraseAtual) return;
    const ultima = texto === cfg.frases.fim;
    if (!ultima && rodapeVisivel && agora - fraseDesde < FRASE_MINIMA) return;
    fraseAtual = texto;
    fraseDesde = agora;
    const sai = frase;
    const entra = document.createElement('span');
    entra.className = 'ab-status-texto';
    entra.textContent = texto;
    trilho.appendChild(entra);
    frase = entra;
    if (reduzido || !rodapeVisivel) {
      if (sai) sai.remove();
      return;
    }
    // as duas frases andam juntas, com a mesma curva: uma nunca passa por cima da outra
    const troca = { duration: 0.5, ease: 'expo.out', overwrite: true };
    gsap.fromTo(entra, { yPercent: 115 }, { yPercent: 0, ...troca });
    if (sai) gsap.to(sai, { yPercent: -115, ...troca, onComplete: () => sai.remove() });
  }

  // ───────────── a marca: a logo oficial sendo escrita ─────────────
  // Quem monta e escreve é o módulo compartilhado (src/marca.js). Aqui só anda um número de 0 a 1.
  let rodapeEntrou = false;
  let marcaEntrou = false;
  const conferirEntrada = () => {
    if (rodapeEntrou && marcaEntrou && !entrou) { entrou = true; entrouEm = performance.now(); }
  };

  let logo = null;
  try {
    if (svgMarca) logo = montarMarca(svgMarca, { cor: cfg.corDaMarca });
  } catch (erro) {
    console.warn('abertura: a marca não pôde ser montada', erro);
  }
  const caneta = { a: 0 };
  const entradaDaMarca = gsap.timeline({ paused: true, onComplete: () => { marcaEntrou = true; conferirEntrada(); } });
  if (logo && reduzido) {
    logo.escrever(1);
  } else if (logo) {
    entradaDaMarca.to(caneta, { a: 1, duration: cfg.escrita, ease: 'power2.inOut', onUpdate: () => logo.escrever(caneta.a) }, 0);
  }
  const duracaoDaEscrita = entradaDaMarca.duration();
  if (duracaoDaEscrita > 0) entradaDaMarca.play(0);
  else marcaEntrou = true;   // marca pronta (movimento reduzido) ou sem marca: nada a esperar

  // ───────────── entrada do rodapé ─────────────
  // O rodapé espera o estilo e a fonte dos números.
  const entrada = gsap.timeline({ paused: true, onComplete: () => { marcarEntrada(); } });

  function marcarEntrada() {
    rodapeEntrou = true;
    conferirEntrada();
  }

  function montarEntrada() {
    if (rodapeVisivel || !rodape) return;
    rodapeVisivel = true;
    fraseDesde = performance.now();
    if (reduzido) {
      rodape.style.visibility = 'visible';
      marcarEntrada();
      return;
    }
    gsap.set(doRodape, { yPercent: 115 });
    if (linha) gsap.set(linha, { scaleX: 0, transformOrigin: '0% 50%' });
    if (cursor) gsap.set(cursor, { scaleY: 0, transformOrigin: '50% 100%' });
    rodape.style.visibility = 'visible';
    entrada.to(doRodape, { yPercent: 0, duration: 0.7, ease: 'expo.out', stagger: 0.06 }, 0);
    if (linha) entrada.to(linha, { scaleX: 1, duration: 0.76, ease: 'expo.out' }, 0);
    if (cursor) entrada.to(cursor, { scaleY: 1, duration: 0.5, ease: 'expo.out' }, 0.1);
    entrada.play(0);
  }

  function esperarEstilo(limite) {
    return new Promise((ok) => {
      const t0 = performance.now();
      const olhar = () => {
        const chegou = getComputedStyle(raiz).getPropertyValue('--ab-estilo').trim() === '1';
        if (chegou || performance.now() - t0 > limite) ok(chegou);
        else setTimeout(olhar, 40);
      };
      olhar();
    });
  }

  function esperarFonte(limite) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const carga = document.fonts.load('500 16px "IBM Plex Mono"', '0123456789').catch(() => {});
    return Promise.race([carga, new Promise((ok) => setTimeout(ok, limite))]);
  }

  Promise.all([esperarEstilo(1500), esperarFonte(600)]).then(() => {
    if (estado === 'carregando') montarEntrada();
  });

  // ───────────── saída ─────────────
  function montarSaida() {
    const tl = gsap.timeline({ paused: true, onComplete: terminar });
    if (reduzido) {
      // sem transição elaborada: só some
      tl.to(raiz, { opacity: 0, duration: 0.3, ease: 'power1.out' }, 0);
      return tl;
    }
    // o texto sobe de dentro do recorte: primeiro o rodapé, depois a marca
    tl.to(doRodape, { yPercent: -115, duration: SAIDA.rodape, ease: 'power3.inOut', stagger: 0.03 }, 0);
    if (linha) {
      tl.set(linha, { transformOrigin: '100% 50%' }, 0);
      tl.to(linha, { scaleX: 0, duration: SAIDA.rodape, ease: 'power3.inOut' }, 0);
    }
    if (cursor) tl.to(cursor, { scaleY: 0, transformOrigin: '50% 0%', duration: 0.25, ease: 'power3.in' }, 0);
    tl.to(marca, { yPercent: -115, duration: SAIDA.marca, ease: 'power3.inOut', stagger: SAIDA.cascata }, SAIDA.marcaInicio);
    // a cor sai: a folha da frente primeiro, a de trás logo depois
    tl.to(avanco, { frente: 1, duration: SAIDA.cortina, ease: 'none', onUpdate: desenharCortina }, SAIDA.cortinaInicio);
    tl.to(avanco, { fundo: 1, duration: SAIDA.cortina, ease: 'none', onUpdate: desenharCortina }, SAIDA.cortinaInicio + SAIDA.atrasoDoFundo);
    return tl;
  }
  const saida = montarSaida();

  let timerMaximo = 0;
  let timerFim = 0;
  function vigiarFim() {
    // rede de segurança: se a linha do tempo não chegar ao fim, termina assim mesmo
    clearTimeout(timerFim);
    timerFim = setTimeout(() => {
      if (estado === 'fim') return;
      if (document.hidden) {
        document.addEventListener('visibilitychange', vigiarFim, { once: true });
        return;
      }
      terminar();
    }, saida.duration() * 1000 + 2000);
  }

  function prepararSaida(motivo) {
    if (estado !== 'carregando') return false;
    estado = 'saindo';
    global.estado = 'saindo';
    motivoDaSaida = motivo;
    clearTimeout(timerMaximo);
    gsap.ticker.remove(quadro);

    // o que ainda estava entrando vai direto para o lugar
    entradaDaMarca.progress(1);
    if (logo) logo.escrever(1);
    if (!rodapeVisivel) montarEntrada();
    entrada.progress(1);
    if (sinalPronto) {
      mostrado = 100;
      escrever();
      if (frase && fraseAtual !== cfg.frases.fim) {
        gsap.killTweensOf(frase);
        gsap.set(frase, { yPercent: 0 });
        frase.textContent = fraseAtual = cfg.frases.fim;
      }
    }

    // a cor chapada do fundo dá lugar ao desenho da cortina, que já estava por cima dela
    raiz.classList.add('ab-saindo');
    raiz.style.background = 'transparent';
    raiz.style.pointerEvents = 'none';

    const detalhe = { motivo, duracao: saida.duration() };
    evento('rdx:abertura-saindo', detalhe);
    avisarSaindo(detalhe);
    return true;
  }

  function sair(motivo) {
    if (!prepararSaida(motivo)) return;
    vigiarFim();
    saida.play(0);
  }

  function terminar() {
    if (estado === 'fim') return;
    estado = 'fim';
    global.estado = 'fim';
    clearTimeout(timerMaximo);
    clearTimeout(timerFim);
    gsap.ticker.remove(quadro);
    window.removeEventListener('resize', desenharCortina);
    destravar();
    html.classList.remove('ab-ligado', 'ab-travado', 'ab-socorro');
    raiz.style.display = 'none';
    raiz.setAttribute('aria-hidden', 'true');
    const detalhe = { motivo: motivoDaSaida, naTela: Math.round(performance.now() - inicio) };
    evento('rdx:abertura-fim', detalhe);
    avisarTerminou(detalhe);
  }

  // ───────────── rolagem travada ─────────────
  // A classe ab-travado no <html> tira a barra. Os ouvintes abaixo seguram roda, toque e
  // teclado, que é por onde uma rolagem suave (Lenis) ainda conseguiria mexer a página.
  const opcoesDeTrava = { capture: true, passive: false };
  function barrar(e) {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
  }
  function barrarTecla(e) {
    if (!TECLAS_DE_ROLAGEM.includes(e.key)) return;
    const alvo = e.target;
    if (alvo && alvo.closest && alvo.closest('input, textarea, select, [contenteditable]')) return;
    e.preventDefault();
  }
  function travar() {
    window.addEventListener('wheel', barrar, opcoesDeTrava);
    window.addEventListener('touchmove', barrar, opcoesDeTrava);
    window.addEventListener('keydown', barrarTecla, opcoesDeTrava);
  }
  function destravar() {
    window.removeEventListener('wheel', barrar, opcoesDeTrava);
    window.removeEventListener('touchmove', barrar, opcoesDeTrava);
    window.removeEventListener('keydown', barrarTecla, opcoesDeTrava);
  }
  travar();

  // ───────────── laço ─────────────
  function quadro() {
    if (estado !== 'carregando') return;
    const agora = performance.now();
    const dt = Math.min((agora - ultimoQuadro) / 1000, 0.1);
    ultimoQuadro = agora;

    const alvo = teto();
    if (mostrado < alvo) {
      const passo = Math.max((alvo - mostrado) * (1 - Math.exp(-dt * RITMO)), PASSO_MINIMO * dt);
      mostrado = Math.min(alvo, mostrado + passo);
      if (mostrado >= 100 && !chegouACem) chegouACem = agora;
    }
    escrever();
    trocarFrase(fraseDaVez(agora), agora);

    const naTela = agora - inicio;
    if (naTela >= cfg.tempoMaximo) {
      sair('tempo-maximo');
      return;
    }
    if (
      sinalPronto && entrou && chegouACem &&
      naTela >= cfg.tempoMinimo &&
      agora - Math.max(chegouACem, entrouEm) >= cfg.pausaNoCem
    ) {
      sair('pronto');
    }
  }
  gsap.ticker.add(quadro);

  // o laço depende de quadro desenhado; este relógio garante o tempo máximo mesmo sem ele
  timerMaximo = setTimeout(
    () => sair('tempo-maximo'),
    Math.max(0, cfg.tempoMaximo - (performance.now() - inicio)),
  );

  // ───────────── controle ─────────────
  const controle = {
    progresso(p) {
      const v = Math.max(0, Math.min(1, Number(p) || 0));
      if (estado === 'carregando' && v > informado) {
        informado = v;
        ultimoAvanco = performance.now();
      }
      return controle;
    },
    pronto() {
      if (estado === 'carregando' && !sinalPronto) {
        sinalPronto = true;
        informado = 1;
        ultimoAvanco = performance.now();
      }
      return controle;
    },
    // conferência: leva a transição de saída a um ponto exato (0 a 1) e para ali
    congelar(p = 0) {
      if (estado === 'fim') return controle;
      if (estado === 'carregando') prepararSaida('teste');
      clearTimeout(timerFim);
      saida.pause();
      saida.progress(Math.max(0, Math.min(1, Number(p) || 0)));
      return controle;
    },
    terminou,
    saindo,
    saida,
    marca: entradaDaMarca,       // linha do tempo da escrita da logo
    duracaoDaEscrita,            // em segundos
    get estado() { return estado; },
    get informado() { return informado; },
    get mostrado() { return Math.min(100, Math.floor(mostrado + 1e-6)); },
  };

  return (unica = controle);
}
