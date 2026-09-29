// 9. FAQ e chamada final.
// No HTML as respostas vêm abertas (<details open>): sem JS tudo fica legível. Com JS o
// módulo fecha todas e passa a abrir uma por vez, animando a altura.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { revelarTitulo, revelarBlocos, aoEntrar } from './nucleo.js';

export function iniciarFaq(ctx) {
  const secao = ctx.raiz.querySelector('#faq');
  if (!secao) return null;
  const limpezas = [];

  const itens = gsap.utils.toArray(secao.querySelectorAll('.rx-faq-item')).map((el) => ({
    el,
    resumo: el.querySelector('summary'),
    corpo: el.querySelector('.rx-faq-corpo'),
    texto: el.querySelector('.rx-faq-corpo p'),
    aberto: false,
  }));

  const tempo = (s) => (ctx.anima ? s : 0);
  const atualizar = () => ScrollTrigger.refresh();

  function fechar(item, avisar = true) {
    if (!item.aberto) return;
    item.aberto = false;
    item.el.classList.remove('rx-aberto');
    item.resumo.setAttribute('aria-expanded', 'false');
    gsap.to(item.texto, { autoAlpha: 0, y: -8, duration: tempo(0.3), ease: 'power2.in', overwrite: true });
    gsap.to(item.corpo, {
      height: 0,
      duration: tempo(0.6),
      ease: 'power4.inOut',
      overwrite: true,
      onComplete: () => { item.el.open = false; if (avisar) atualizar(); },
    });
  }

  function abrir(item) {
    if (item.aberto) return;
    itens.forEach((outro) => { if (outro !== item) fechar(outro, false); });
    item.aberto = true;
    item.el.open = true;
    item.el.classList.add('rx-aberto');
    item.resumo.setAttribute('aria-expanded', 'true');
    gsap.fromTo(item.corpo, { height: item.corpo.offsetHeight }, {
      height: 'auto',
      duration: tempo(0.8),
      ease: 'expo.out',
      overwrite: true,
      onComplete: atualizar,
    });
    gsap.fromTo(item.texto, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: tempo(0.9), ease: 'expo.out', delay: tempo(0.08), overwrite: true });
  }

  for (const item of itens) {
    item.el.open = false;
    item.corpo.style.height = '0px';
    item.resumo.setAttribute('aria-expanded', 'false');
    const aoClicar = (e) => {
      e.preventDefault();
      if (item.aberto) fechar(item); else abrir(item);
    };
    item.resumo.addEventListener('click', aoClicar);
    limpezas.push(() => {
      item.resumo.removeEventListener('click', aoClicar);
      item.resumo.removeAttribute('aria-expanded');
      item.el.classList.remove('rx-aberto');
      gsap.killTweensOf([item.corpo, item.texto]);
      gsap.set([item.corpo, item.texto], { clearProps: 'all' });
      item.el.open = true;
    });
  }

  // a primeira pergunta começa aberta, sem animação
  if (itens.length) {
    const primeiro = itens[0];
    primeiro.aberto = true;
    primeiro.el.open = true;
    primeiro.el.classList.add('rx-aberto');
    primeiro.resumo.setAttribute('aria-expanded', 'true');
    primeiro.corpo.style.height = 'auto';
  }

  if (!ctx.anima) return () => limpezas.forEach((f) => f());

  revelarBlocos(secao.querySelectorAll('.rx-faq-cabeca [data-rx-revela]'), { y: 14 });
  revelarTitulo(secao.querySelector('.rx-faq-cabeca [data-rx-titulo]'));

  // cada pergunta entra com o fio de cima se desenhando
  const linhas = itens.map((i) => i.el);
  gsap.set(linhas, { autoAlpha: 0, y: 20 });
  linhas.forEach((linha, i) => {
    aoEntrar(linha, () => gsap.to(linha, { autoAlpha: 1, y: 0, duration: 1.1, ease: 'expo.out', delay: (i % 5) * 0.05 }), 'top 92%');
  });

  // chamada final: o painel lima abre em cortina e o título sobe do recorte
  const chamada = secao.querySelector('[data-rx-chamada]');
  const fundo = chamada.querySelector('.rx-chamada-fundo');
  gsap.set(chamada, { clipPath: 'inset(16% 5% 16% 5%)' });
  gsap.to(chamada, {
    clipPath: 'inset(0% 0% 0% 0%)',
    ease: 'power2.out',
    scrollTrigger: { trigger: chamada, start: 'top 96%', end: 'top 38%', scrub: 0.5 },
  });
  gsap.fromTo(fundo, { yPercent: -8 }, {
    yPercent: 8,
    ease: 'none',
    scrollTrigger: { trigger: chamada, start: 'top bottom', end: 'bottom top', scrub: true },
  });
  revelarBlocos(chamada.querySelectorAll('.rx-etiqueta'), { y: 20, inicio: 'top 80%' });
  revelarTitulo(chamada.querySelector('[data-rx-titulo]'), { inicio: 'top 78%' });
  const acoes = chamada.querySelectorAll('.rx-botao');
  gsap.set(acoes, { autoAlpha: 0, yPercent: 60 });
  aoEntrar(chamada.querySelector('.rx-chamada-acoes'), () => {
    gsap.to(acoes, { autoAlpha: 1, yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.1, delay: 0.25 });
  }, 'top 92%');

  return () => limpezas.forEach((f) => f());
}
