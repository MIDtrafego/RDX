// Menu em tela cheia do RDX.
//
//   import { iniciarMenu } from './menu/menu.js';
//   const menu = iniciarMenu({ botao, aoNavegar });
//
//   botao           o botão de menu que já existe no cabeçalho (.botao-menu)
//   aoNavegar(id)   chamado DEPOIS que o menu fecha, com o id da seção ("capacidades", "cores"...).
//                   Quem rola a página é quem chama iniciarMenu.
//
// Devolve { abrir(), fechar(), alternar(), aberto } e mais três campos, úteis em teste:
//   estado     'fechado' | 'abrindo' | 'aberto' | 'fechando'
//              ('aberto' começa quando a cortina cobre a tela; o texto termina de assentar depois)
//   linha      a linha do tempo do GSAP em curso (dá para pausar e fotografar instante por instante)
//   destruir() desliga tudo e devolve o botão e o bloco ao estado em que vieram
//
// No INÍCIO de cada abertura e de cada fechamento dispara, em window:
//   rdx:menu   com detail: { aberto: true | false }
//
// Abertura: cortina em faixas. Uma camada lima desce primeiro, faixa por faixa, a partir do
// lado do botão; o painel escuro vem logo atrás e cobre. As duas são um recorte (clip-path)
// só, em degraus, então não existe emenda entre as faixas.
//
// Cada movimento parte de onde as coisas estão naquele instante. Por isso dá para fechar no
// meio da abertura (e abrir no meio do fechamento) sem pulo e sem estado preso.
import { gsap } from 'gsap';

const MAXIMO_DE_FAIXAS = 8;

// tempos em segundos
const ABRIR = {
  faixa: 0.74,        // quanto cada faixa leva para descer
  passo: 0.05,        // atraso entre faixas vizinhas
  lima: 0.058,        // quanto a camada lima chega antes do painel
  curva: 'expo.inOut',
  itens: 0.54,        // quando o primeiro item começa a subir (o painel termina perto de 1,0 s)
  cascata: 0.06,      // atraso entre os itens
};
const FECHAR = {
  faixa: 0.44,
  passo: 0.016,
  lima: 0.04,
  espera: 0.02,       // o texto sai na frente, a cortina sobe em seguida
  curva: 'power4.inOut',
};
// quando a pessoa interrompe um movimento no meio, a resposta tem que sair na hora
const VIRADA = {
  faixa: 0.5,
  passo: 0.014,
  lima: 0.03,
  curva: 'power2.out',
};

const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function iniciarMenu({ botao, aoNavegar } = {}) {
  const menu = document.getElementById('menu');
  if (!menu || !botao) {
    console.warn('[menu] faltou o bloco #menu ou o botão. O menu não foi ligado.');
    return { abrir() {}, fechar() {}, alternar() {}, aberto: false, estado: 'fechado', linha: null, destruir() {} };
  }
  if (menu.__mn) return menu.__mn;

  const raiz = document.documentElement;
  const cortina = menu.querySelector('.mn-cortina');
  const painel = menu.querySelector('.mn-painel');
  const rolo = menu.querySelector('.mn-rolo');
  const sobe = Array.from(menu.querySelectorAll('.mn-sobe'));
  const numeros = Array.from(menu.querySelectorAll('.mn-num'));
  const entra = Array.from(menu.querySelectorAll('.mn-entra'));
  const fio = menu.querySelector('.mn-fio');
  const aviso = menu.querySelector('.mn-aviso');
  const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)');

  let estado = 'fechado';
  let linha = null;
  let faixas = 5;
  let destino = null;        // id da seção escolhida, à espera do fim do fechamento

  // progresso de cada faixa, de 0 (recolhida no topo) a 1 (até o pé da tela)
  const fLima = Array.from({ length: MAXIMO_DE_FAIXAS }, () => ({ p: 0 }));
  const fPainel = Array.from({ length: MAXIMO_DE_FAIXAS }, () => ({ p: 0 }));

  // ───────────── recorte em degraus ─────────────
  const n3 = (v) => Math.round(v * 1000) / 1000;

  function recorte(lista, n) {
    let cheio = true;
    let vazio = true;
    for (let i = 0; i < n; i++) {
      if (lista[i].p < 0.9995) cheio = false;
      if (lista[i].p > 0.0005) vazio = false;
    }
    if (cheio) return 'none';
    if (vazio) return 'polygon(0 0, 100% 0, 100% 0, 0 0)';
    const pontos = ['0% 0%', '100% 0%'];
    // da direita para a esquerda, pelo pé de cada faixa
    for (let i = n - 1; i >= 0; i--) {
      const y = n3(Math.min(1, Math.max(0, lista[i].p)) * 100);
      pontos.push(n3(((i + 1) / n) * 100) + '% ' + y + '%');
      pontos.push(n3((i / n) * 100) + '% ' + y + '%');
    }
    return 'polygon(' + pontos.join(', ') + ')';
  }

  function desenhar() {
    painel.style.clipPath = recorte(fPainel, faixas);
    cortina.style.clipPath = recorte(fLima, faixas);
  }

  function lerFaixas() {
    const n = parseInt(getComputedStyle(menu).getPropertyValue('--mn-faixas'), 10);
    return Math.min(MAXIMO_DE_FAIXAS, Math.max(1, Number.isFinite(n) ? n : 5));
  }

  // ───────────── repouso ─────────────
  function conteudoEmRepouso(aberto) {
    gsap.set(sobe, { yPercent: aberto ? 0 : 136 });
    gsap.set(numeros, { autoAlpha: aberto ? 1 : 0, x: aberto ? 0 : -10 });
    gsap.set(entra, { autoAlpha: aberto ? 1 : 0, y: aberto ? 0 : 26 });
    if (fio) gsap.set(fio, { scaleX: aberto ? 1 : 0 });
    if (aviso) gsap.set(aviso, { autoAlpha: aberto ? 1 : 0 });
  }
  function cortinaEmRepouso(aberto) {
    const p = aberto ? 1 : 0;
    for (let i = 0; i < MAXIMO_DE_FAIXAS; i++) { fLima[i].p = p; fPainel[i].p = p; }
    desenhar();
  }
  function emRepouso(aberto) {
    conteudoEmRepouso(aberto);
    cortinaEmRepouso(aberto);
    gsap.set(menu, { opacity: 1 });
  }

  // ───────────── linhas do tempo ─────────────
  function largar() {
    if (linha) { linha.kill(); linha = null; }
  }

  function montarAbertura(virada) {
    if (reduzido.matches) {
      // menos movimento: tudo já no lugar, só um fade curto
      const de = virada ? Number(gsap.getProperty(menu, 'opacity')) : 0;
      conteudoEmRepouso(true);
      cortinaEmRepouso(true);
      gsap.set(menu, { opacity: de });
      return gsap.timeline({ paused: true, onComplete: terminouDeAbrir })
        .to(menu, { opacity: 1, duration: 0.22, ease: 'power1.out' }, 0);
    }

    gsap.set(menu, { opacity: 1 });
    const c = virada ? VIRADA : ABRIR;
    const n = faixas;
    const tl = gsap.timeline({ paused: true, onUpdate: desenhar, onComplete: terminouDeAbrir });

    // a cortina começa do lado do botão (direita) e vai para a esquerda
    for (let i = 0; i < n; i++) {
      const quando = (n - 1 - i) * c.passo;
      tl.to(fLima[i], { p: 1, duration: c.faixa, ease: c.curva }, quando);
      tl.to(fPainel[i], { p: 1, duration: c.faixa, ease: c.curva }, quando + c.lima);
    }
    // tela coberta: daqui em diante o menu já conta como aberto. O texto ainda está
    // assentando, mas quem fechar agora recebe o fechamento normal, e não o de virada.
    tl.call(cortinaChegou, null, (n - 1) * c.passo + c.lima + c.faixa);

    const t0 = virada ? 0.06 : ABRIR.itens;
    tl.to(sobe, { yPercent: 0, duration: 0.95, ease: 'expo.out', stagger: ABRIR.cascata }, t0);
    tl.to(numeros, { autoAlpha: 1, x: 0, duration: 0.7, ease: 'power3.out', stagger: ABRIR.cascata }, t0 + 0.14);
    if (fio) tl.to(fio, { scaleX: 1, duration: 1.0, ease: 'expo.out' }, t0 + 0.06);
    tl.to(entra, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.055 }, t0 + 0.12);
    if (aviso) tl.to(aviso, { autoAlpha: 1, duration: 0.6, ease: 'power2.out' }, t0 + 0.32);
    return tl;
  }

  function montarFechamento(virada) {
    if (reduzido.matches) {
      return gsap.timeline({ paused: true, onComplete: terminouDeFechar })
        .to(menu, { opacity: 0, duration: 0.16, ease: 'power1.in' }, 0);
    }

    const c = virada ? VIRADA : FECHAR;
    const n = faixas;
    const tl = gsap.timeline({ paused: true, onUpdate: desenhar, onComplete: terminouDeFechar });

    // o texto volta para dentro da máscara, do último para o primeiro
    tl.to(sobe, { yPercent: 136, duration: 0.32, ease: virada ? 'power2.out' : 'power2.in', stagger: { each: 0.02, from: 'end' } }, 0);
    tl.to(numeros, { autoAlpha: 0, duration: 0.18, ease: 'power1.in' }, 0);
    tl.to(entra, { autoAlpha: 0, y: 12, duration: 0.22, ease: 'power2.in', stagger: { each: 0.014, from: 'end' } }, 0);
    if (aviso) tl.to(aviso, { autoAlpha: 0, duration: 0.18, ease: 'power1.in' }, 0);
    if (fio) tl.to(fio, { scaleX: 0, duration: 0.3, ease: 'power2.in' }, 0);

    // caminho inverso: a última faixa a chegar (esquerda) é a primeira a subir,
    // e a lima, que chegou antes, sai depois
    const espera = virada ? 0 : FECHAR.espera;
    for (let i = 0; i < n; i++) {
      const quando = espera + i * c.passo;
      tl.to(fPainel[i], { p: 0, duration: c.faixa, ease: c.curva }, quando);
      tl.to(fLima[i], { p: 0, duration: c.faixa, ease: c.curva }, quando + c.lima);
    }
    return tl;
  }

  // ───────────── rolagem do fundo ─────────────
  function travar() {
    const barra = window.innerWidth - raiz.clientWidth;
    raiz.classList.toggle('mn-calha', barra > 0);
    raiz.classList.add('mn-travado');
  }
  function destravar() {
    raiz.classList.remove('mn-travado', 'mn-calha');
  }

  // ───────────── abrir e fechar ─────────────
  function avisar(aberto) {
    window.dispatchEvent(new CustomEvent('rdx:menu', { detail: { aberto } }));
  }

  function abrir() {
    if (estado === 'aberto' || estado === 'abrindo') return;
    const virada = estado === 'fechando';
    largar();
    destino = null;
    estado = 'abrindo';
    avisar(true);

    if (!virada) {
      faixas = lerFaixas();
      emRepouso(false);
      if (rolo) rolo.scrollTop = 0;
    }
    if (!raiz.classList.contains('mn-travado')) travar();
    menu.inert = false;
    menu.removeAttribute('inert');
    menu.classList.add('mn-visivel');
    botao.classList.add('mn-aberto');
    botao.setAttribute('aria-expanded', 'true');
    menu.focus({ preventScroll: true });

    linha = montarAbertura(virada);
    linha.play(0);
  }

  function fechar() {
    if (estado === 'fechado' || estado === 'fechando') return;
    const virada = estado === 'abrindo';
    largar();
    estado = 'fechando';
    avisar(false);

    botao.classList.remove('mn-aberto');
    botao.setAttribute('aria-expanded', 'false');
    // o foco sai do menu antes de o menu ficar inerte
    botao.focus({ preventScroll: true });
    menu.inert = true;
    menu.setAttribute('inert', '');

    linha = montarFechamento(virada);
    linha.play(0);
  }

  function alternar() {
    if (estado === 'aberto' || estado === 'abrindo') fechar();
    else abrir();
  }

  function cortinaChegou() {
    if (estado === 'abrindo') estado = 'aberto';
  }

  function terminouDeAbrir() {
    if (estado === 'abrindo') estado = 'aberto';
    emRepouso(true);
  }

  function terminouDeFechar() {
    estado = 'fechado';
    menu.classList.remove('mn-visivel');
    emRepouso(false);
    destravar();
    const id = destino;
    destino = null;
    if (!id) return;
    if (typeof aoNavegar === 'function') aoNavegar(id);
    else window.location.hash = id;      // sem aoNavegar, o navegador pula para a seção
  }

  // ───────────── cliques ─────────────
  function aoClicarNoMenu(e) {
    if (!(e.target instanceof Element)) return;
    if (e.target.closest('.mn-fechar')) {
      e.preventDefault();
      fechar();
      return;
    }
    const link = e.target.closest('[data-mn-secao]');
    if (!link) return;
    // abrir em outra aba, outra janela etc. continua sendo do navegador
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    destino = link.getAttribute('data-mn-secao');
    fechar();
  }

  // ───────────── teclado ─────────────
  function visivel(el) {
    return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  }
  function focaveis() {
    return Array.from(menu.querySelectorAll(FOCAVEIS)).filter(visivel);
  }

  function aoTeclar(e) {
    if (estado !== 'aberto' && estado !== 'abrindo') return;
    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault();
      fechar();
      return;
    }
    if (e.key !== 'Tab') return;
    const lista = focaveis();
    if (!lista.length) {
      e.preventDefault();
      menu.focus({ preventScroll: true });
      return;
    }
    const primeiro = lista[0];
    const ultimo = lista[lista.length - 1];
    const atual = document.activeElement;
    const dentro = atual instanceof Element && menu.contains(atual) && atual !== menu;
    if (e.shiftKey) {
      if (!dentro || atual === primeiro) { e.preventDefault(); ultimo.focus(); }
    } else if (!dentro && atual !== menu) {
      e.preventDefault();
      primeiro.focus();
    } else if (atual === ultimo) {
      e.preventDefault();
      primeiro.focus();
    }
  }

  // se o foco escapar por outro caminho (clique no cabeçalho, leitor de tela), a próxima
  // tecla Tab devolve para dentro. O cabeçalho continua clicável por cima do menu.

  function aoMudarMovimento() {
    // troca de preferência com o menu parado: deixa tudo no repouso certo
    if (estado === 'aberto') emRepouso(true);
    if (estado === 'fechado') emRepouso(false);
  }

  // ───────────── partida ─────────────
  if (!menu.hasAttribute('tabindex')) menu.setAttribute('tabindex', '-1');
  menu.inert = true;
  menu.setAttribute('inert', '');
  menu.removeAttribute('hidden');         // daqui em diante quem esconde é a classe (visibility)
  botao.classList.add('mn-gatilho');
  botao.setAttribute('aria-expanded', 'false');
  botao.setAttribute('aria-controls', 'menu');
  botao.setAttribute('aria-haspopup', 'dialog');
  faixas = lerFaixas();
  emRepouso(false);

  botao.addEventListener('click', alternar);
  menu.addEventListener('click', aoClicarNoMenu);
  document.addEventListener('keydown', aoTeclar, true);
  if (reduzido.addEventListener) reduzido.addEventListener('change', aoMudarMovimento);

  function destruir() {
    largar();
    botao.removeEventListener('click', alternar);
    menu.removeEventListener('click', aoClicarNoMenu);
    document.removeEventListener('keydown', aoTeclar, true);
    if (reduzido.removeEventListener) reduzido.removeEventListener('change', aoMudarMovimento);
    const estavaNaTela = estado !== 'fechado';
    estado = 'fechado';
    destino = null;
    emRepouso(false);
    menu.classList.remove('mn-visivel');
    menu.inert = true;
    menu.setAttribute('inert', '');
    menu.setAttribute('hidden', '');
    botao.classList.remove('mn-gatilho', 'mn-aberto');
    botao.removeAttribute('aria-expanded');
    botao.removeAttribute('aria-controls');
    botao.removeAttribute('aria-haspopup');
    if (estavaNaTela) destravar();
    delete menu.__mn;
  }

  const api = {
    abrir,
    fechar,
    alternar,
    destruir,
    get aberto() { return estado === 'aberto' || estado === 'abrindo'; },
    get estado() { return estado; },
    get linha() { return linha; },
  };
  menu.__mn = api;
  return api;
}
