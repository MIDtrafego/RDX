// Utilidades compartilhadas pelas seções de rolagem.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

export const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
export const misturar = (a, b, t) => a + (b - a) * t;

// 1234.5 vira "1.234,50". O sinal fica por conta do prefixo do elemento.
export function formatar(valor, casas = 0) {
  const fixo = Math.abs(valor).toFixed(casas);
  const partes = fixo.split('.');
  const inteiro = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return partes[1] ? inteiro + ',' + partes[1] : inteiro;
}

// ───────────── entrada na tela, com rede de segurança ─────────────
// Toda revelação de uma vez só passa por aqui. O gatilho normal é o ScrollTrigger.
// A rede confere, quando a rolagem para, se sobrou alguém que já está na tela ou
// ficou para trás (pulo do topo ao fim, rolagem muito rápida) e revela na hora.
const rede = new Set();

export function aoEntrar(gatilho, acao, inicio = 'top 88%') {
  const item = { gatilho, feito: false, disparar: null };
  item.disparar = () => {
    if (item.feito) return;
    item.feito = true;
    rede.delete(item);
    acao();
  };
  rede.add(item);
  ScrollTrigger.create({ trigger: gatilho, start: inicio, once: true, onEnter: item.disparar });
  return item;
}

export function conferirRede() {
  if (!rede.size) return 0;
  const limite = window.innerHeight * 0.97;
  let forcados = 0;
  for (const item of [...rede]) {
    if (!item.gatilho.isConnected) { rede.delete(item); continue; }
    if (item.gatilho.getBoundingClientRect().top < limite) {
      item.disparar();
      forcados += 1;
    }
  }
  return forcados;
}

export function esvaziarRede() { rede.clear(); }
export function pendentesNaRede() { return rede.size; }

// ───────────── texto ─────────────
// Revelação por bloco, como no site de referência: um bloco de cor atravessa a linha,
// o texto aparece atrás dele e o bloco sai pelo outro lado. Rápido e em cascata.
const TEMPO_BLOCO = 0.3;      // cada metade: a passagem inteira leva 0,6 s

// Monta a passagem do bloco numa linha do tempo. `linha` é o texto, `bloco` é a faixa de cor.
export function passarBloco(linhaDoTempo, linha, bloco, quando, duracao = TEMPO_BLOCO) {
  linhaDoTempo
    .fromTo(bloco, { xPercent: -101 }, { xPercent: 0, duration: duracao, ease: 'power3.inOut' }, quando)
    .set(linha, { autoAlpha: 1 }, quando + duracao)
    .to(bloco, { xPercent: 101, duration: duracao, ease: 'power3.inOut' }, quando + duracao);
  return linhaDoTempo;
}

// Para linhas já marcadas no HTML (<span class="rx-l">): embrulha o texto e cria o bloco.
export function prepararLinha(el) {
  let texto = el.querySelector(':scope > .rx-l-texto');
  if (!texto) {
    texto = document.createElement('span');
    texto.className = 'rx-l-texto';
    texto.style.display = 'inline-block';
    while (el.firstChild) texto.appendChild(el.firstChild);
    el.appendChild(texto);
  }
  let bloco = el.querySelector(':scope > .rx-bloco');
  if (!bloco) {
    bloco = document.createElement('i');
    bloco.className = 'rx-bloco';
    bloco.setAttribute('aria-hidden', 'true');
    el.appendChild(bloco);
  }
  gsap.set(bloco, { xPercent: -101 });
  return { texto, bloco };
}

// Título ou parágrafo revelado por bloco, linha por linha, quando entra na tela (uma vez só).
// A quebra em linhas é refeita sozinha se a largura mudar (autoSplit).
export function revelarTitulo(el, opcoes = {}) {
  let tocou = false;
  let linhaDoTempo = null;
  const partes = SplitText.create(el, {
    type: 'lines',
    mask: 'lines',
    linesClass: 'rx-linha',
    autoSplit: true,
    ...opcoes.dividir,
    onSplit(self) {
      const blocos = self.masks.map((mascara) => {
        const bloco = document.createElement('i');
        bloco.className = 'rx-bloco';
        bloco.setAttribute('aria-hidden', 'true');
        mascara.appendChild(bloco);
        gsap.set(bloco, { xPercent: -101 });
        return bloco;
      });
      gsap.set(self.lines, { autoAlpha: 0 });
      linhaDoTempo = gsap.timeline({ paused: true, delay: opcoes.atraso || 0 });
      self.lines.forEach((linha, i) => passarBloco(linhaDoTempo, linha, blocos[i], i * (opcoes.cascata ?? 0.09), opcoes.duracao));
      if (tocou) linhaDoTempo.progress(1);
      return linhaDoTempo;
    },
  });
  aoEntrar(opcoes.gatilho || el, () => {
    tocou = true;
    if (linhaDoTempo) linhaDoTempo.play();
  }, opcoes.inicio || 'top 90%');
  return partes;
}

// Blocos que sobem e aparecem. Quem entra no mesmo quadro ganha atraso em cascata.
export function revelarBlocos(elementos, opcoes = {}) {
  const lista = gsap.utils.toArray(elementos);
  if (!lista.length) return;
  // botão magnético já usa x e y para seguir o mouse: nele a entrada é só de opacidade,
  // senão uma animação derruba a outra
  const sobe = (el) => (el.hasAttribute('data-rx-ima') ? 0 : (opcoes.y ?? 24));
  lista.forEach((el) => gsap.set(el, el.hasAttribute('data-rx-ima') ? { autoAlpha: 0 } : { autoAlpha: 0, y: sobe(el) }));

  let fila = [];
  let agendado = false;
  const soltar = () => {
    const lote = fila;
    fila = [];
    agendado = false;
    const imas = lote.filter((el) => el.hasAttribute('data-rx-ima'));
    if (imas.length) gsap.to(imas, { autoAlpha: 1, duration: 0.9, ease: 'expo.out' });
    const comuns = lote.filter((el) => !el.hasAttribute('data-rx-ima'));
    if (!comuns.length) return;          // só ímãs no quadro: sem alvo, o GSAP avisaria
    gsap.to(comuns, {
      autoAlpha: 1,
      y: 0,
      duration: opcoes.duracao || 0.9,
      ease: 'expo.out',
      stagger: opcoes.cascata ?? 0.07,
      overwrite: 'auto',
    });
  };
  for (const el of lista) {
    aoEntrar(el, () => {
      fila.push(el);
      if (!agendado) { agendado = true; requestAnimationFrame(soltar); }
    }, opcoes.inicio || 'top 90%');
  }
}

// ───────────── números ─────────────
// Contador: começa em zero, sobe até o valor e termina exatamente no texto do HTML.
export function contar(el, opcoes = {}) {
  const alvo = parseFloat(el.dataset.rxConta);
  if (!Number.isFinite(alvo)) return null;
  const casas = parseInt(el.dataset.rxCasas || '0', 10);
  const prefixo = el.dataset.rxPrefixo || '';
  const sufixo = el.dataset.rxSufixo || '';
  const final = el.textContent;
  const estado = { v: 0 };

  // reserva a largura final para o número não empurrar o vizinho enquanto conta
  let reservado = false;
  const largura = el.getBoundingClientRect().width;
  if (largura > 0 && getComputedStyle(el).display.startsWith('inline')) {
    el.style.display = 'inline-block';
    el.style.minWidth = Math.ceil(largura) + 'px';
    reservado = true;
  }
  const soltar = () => {
    if (!reservado) return;
    el.style.minWidth = '';
    el.style.display = '';
    reservado = false;
  };

  let ultima = 0;
  const escrever = () => { el.textContent = prefixo + formatar(estado.v, casas) + sufixo; };
  const escreverComFreio = () => {
    const agora = performance.now();
    if (agora - ultima < 33) return;
    ultima = agora;
    escrever();
  };
  escrever();

  const tween = gsap.to(estado, {
    v: alvo,
    duration: opcoes.duracao || 1.9,
    ease: 'power3.out',
    paused: true,
    delay: opcoes.atraso || 0,
    onUpdate: escreverComFreio,
    onComplete() { el.textContent = final; soltar(); },
  });

  return {
    el,
    tocar: () => tween.play(),
    desfazer() { tween.kill(); el.textContent = final; soltar(); },
  };
}

// Liga os contadores de um trecho a um gatilho de rolagem. Devolve a limpeza.
export function contarAoEntrar(raiz, opcoes = {}) {
  const alvos = raiz.matches?.('[data-rx-conta]') ? [raiz] : gsap.utils.toArray(raiz.querySelectorAll('[data-rx-conta]'));
  const contadores = alvos
    .map((el, i) => contar(el, { atraso: (opcoes.atraso || 0) + i * (opcoes.cascata ?? 0.06), duracao: opcoes.duracao }))
    .filter(Boolean);
  if (!contadores.length) return () => {};
  aoEntrar(opcoes.gatilho || raiz, () => contadores.forEach((c) => c.tocar()), opcoes.inicio || 'top 86%');
  return () => contadores.forEach((c) => c.desfazer());
}

// ───────────── traço ─────────────
// Prepara um traço SVG para ser desenhado (pathLength="1" já vem no elemento).
// "1 2" no lugar de "1": com "1" sobra um pontinho na ponta arredondada.
export function prepararTraco(caminhos) {
  gsap.set(caminhos, { strokeDasharray: '1 2', strokeDashoffset: 1 });
}
