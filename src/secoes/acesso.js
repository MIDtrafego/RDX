// 8. Acesso e uso, e como funciona a cobrança.
// Os dois cartões de preço abrem com os valores contando. Os quatro passos da cobrança são
// ligados por uma linha SVG que se desenha com a rolagem; cada passo acende quando a linha
// chega nele. A linha fica sempre ATRÁS dos números (ver z-index em .rx-passo).
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { revelarTitulo, revelarBlocos, contarAoEntrar, aoEntrar } from './nucleo.js';

const SVG = 'http://www.w3.org/2000/svg';

function criarLinhaDosPassos(lista, ctx) {
  const passos = gsap.utils.toArray(lista.querySelectorAll('.rx-passo'));
  const numeros = passos.map((p) => p.querySelector('.rx-passo-n'));

  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'rx-passos-linha');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('preserveAspectRatio', 'none');
  const base = document.createElementNS(SVG, 'path');
  base.setAttribute('class', 'rx-linha-base');
  const viva = document.createElementNS(SVG, 'path');
  viva.setAttribute('class', 'rx-linha-viva');
  viva.setAttribute('pathLength', '1');
  svg.append(base, viva);
  lista.prepend(svg);

  let marcos = passos.map(() => 0);     // em que fração da linha cada passo está

  function desenhar() {
    const largura = lista.clientWidth;
    const altura = lista.clientHeight;
    svg.setAttribute('viewBox', '0 0 ' + largura + ' ' + altura);
    const pontos = passos.map((p, i) => {
      const n = numeros[i];
      return [
        p.offsetLeft + n.offsetLeft + n.offsetWidth / 2,
        p.offsetTop + n.offsetTop + n.offsetHeight / 2,
      ];
    });
    const d = pontos.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
    base.setAttribute('d', d);
    viva.setAttribute('d', d);

    let total = 0;
    const acumulado = [0];
    for (let i = 1; i < pontos.length; i++) {
      total += Math.hypot(pontos[i][0] - pontos[i - 1][0], pontos[i][1] - pontos[i - 1][1]);
      acumulado.push(total);
    }
    marcos = acumulado.map((v) => (total ? v / total : 0));
  }

  const estado = { p: ctx.anima ? 0 : 1 };
  function aplicar() {
    viva.style.strokeDashoffset = (1 - estado.p).toFixed(4);
    passos.forEach((p, i) => {
      const aceso = estado.p >= 0.999 ? true : estado.p > 0.002 && estado.p >= marcos[i] - 0.002;
      p.classList.toggle('rx-passo-aceso', aceso);
    });
  }

  desenhar();
  viva.style.strokeDasharray = '1 2';
  aplicar();

  let tween = null;
  if (ctx.anima) {
    const textos = passos.map((p) => p.querySelectorAll('h4, p'));
    gsap.set(textos, { autoAlpha: 0.32 });
    tween = gsap.to(estado, {
      p: 1,
      ease: 'none',          // ligado à rolagem; a suavidade vem do scrub
      onUpdate() {
        aplicar();
        passos.forEach((p, i) => {
          const aceso = p.classList.contains('rx-passo-aceso');
          if (p.__rxAceso === aceso) return;
          p.__rxAceso = aceso;
          gsap.to(textos[i], { autoAlpha: aceso ? 1 : 0.32, duration: aceso ? 0.8 : 0.4, ease: 'power3.out', overwrite: true });
          if (aceso) gsap.fromTo(numeros[i], { scale: 0.8 }, { scale: 1, duration: 0.9, ease: 'back.out(3)', overwrite: true });
        });
      },
      scrollTrigger: {
        trigger: lista,
        start: 'top 76%',
        end: () => (ctx.mesa ? 'top 34%' : 'bottom 62%'),
        scrub: 0.6,
        invalidateOnRefresh: true,
      },
    });
  }

  const aoMedir = () => { desenhar(); aplicar(); };
  ScrollTrigger.addEventListener('refreshInit', aoMedir);

  return () => {
    ScrollTrigger.removeEventListener('refreshInit', aoMedir);
    if (tween) { tween.scrollTrigger && tween.scrollTrigger.kill(); tween.kill(); }
    svg.remove();
    passos.forEach((p) => { p.classList.remove('rx-passo-aceso'); delete p.__rxAceso; });
  };
}

export function iniciarAcesso(ctx) {
  const secao = ctx.raiz.querySelector('#acesso');
  if (!secao) return null;
  const limpezas = [];

  limpezas.push(criarLinhaDosPassos(secao.querySelector('[data-rx-passos]'), ctx));

  if (!ctx.anima) return () => limpezas.forEach((f) => f());

  revelarBlocos(secao.querySelectorAll('[data-rx-revela]'), { y: 14 });
  secao.querySelectorAll('[data-rx-titulo]').forEach((t) => revelarTitulo(t, { cascata: t.matches('p') ? 0.05 : 0.09 }));

  // cartões de preço: abrem de baixo, o valor sobe do recorte e conta
  gsap.utils.toArray(secao.querySelectorAll('[data-rx-preco]')).forEach((cartao, i) => {
    const valor = cartao.querySelector('.rx-preco-valor');
    const itens = cartao.querySelectorAll('.rx-preco-lista li');
    const resto = cartao.querySelectorAll('.rx-preco-topo, .rx-preco-nome, .rx-preco-sub');
    const entrada = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' }, delay: i * 0.14 })
      .from(cartao, { autoAlpha: 0, scale: 0.95, transformOrigin: '50% 100%', duration: 1.3 }, 0)
      .from(valor, { autoAlpha: 0, yPercent: 40, duration: 1.3 }, 0.2);
    // cascata dos itens só no computador
    if (ctx.mesa) {
      entrada
        .from(resto, { autoAlpha: 0, y: 24, duration: 1, stagger: 0.07 }, 0.15)
        .from(itens, { autoAlpha: 0, x: -18, duration: 0.9, stagger: 0.06 }, 0.45);
    }
    aoEntrar(cartao, () => entrada.play(), 'top 86%');
    limpezas.push(contarAoEntrar(valor, { gatilho: cartao, inicio: 'top 86%', atraso: 0.3 + i * 0.14, duracao: 2 }));
  });

  // exemplo da fórmula
  secao.querySelectorAll('.rx-formula-bloco').forEach((bloco) => {
    limpezas.push(contarAoEntrar(bloco, { inicio: 'top 88%', atraso: 0.3, cascata: 0.25, duracao: 1.6 }));
  });

  return () => limpezas.forEach((f) => f());
}
