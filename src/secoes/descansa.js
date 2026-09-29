// 4. Enquanto você descansa, nossos servidores calculam.
// A seção trava. Estado 1, no claro: a primeira metade da frase, em duas linhas gigantes à
// direita do centro, com um led pulsando embaixo. Conforme a rolagem avança o led abre em
// círculo e vira a tela lima (estado 2), com a segunda metade da frase e os quatro mercados.
// Na saída a tela encolhe e vira um cartão. As linhas são reveladas por bloco, como no
// resto do site.
//
// Em tela larga a lista e a frase ficam lado a lado. Abaixo de 992 px elas ocupam o mesmo
// lugar, uma depois da outra: a frase sai e a lista entra.
import { gsap } from 'gsap';
import { passarBloco, prepararLinha, revelarBlocos, aoEntrar } from './nucleo.js';

export function iniciarDescansa(ctx) {
  const secao = ctx.raiz.querySelector('#descansa');
  if (!secao || !ctx.anima) return null;

  const palco = secao.querySelector('.rx-descansa-palco');
  const noite = secao.querySelector('.rx-descansa-noite');
  const dia = secao.querySelector('.rx-descansa-dia');
  const miolo = secao.querySelector('.rx-descansa-dia-miolo');
  const led = secao.querySelector('.rx-descansa-led');
  const reserva = noite.querySelector('.rx-reserva');
  const blocoNoite = noite.querySelector('.rx-descansa-bloco');
  const blocoDia = dia.querySelector('.rx-descansa-bloco');
  const etiquetaNoite = noite.querySelector('.rx-etiqueta');
  const etiquetaDia = dia.querySelector('.rx-etiqueta');
  const texto = dia.querySelector('.rx-descansa-texto');
  const lista = dia.querySelector('.rx-mercados');
  const mercados = gsap.utils.toArray(dia.querySelectorAll('.rx-mercado'));
  const limpezas = [];

  const linhasNoite = gsap.utils.toArray(noite.querySelectorAll('.rx-l')).map(prepararLinha);
  const linhasDia = gsap.utils.toArray(dia.querySelectorAll('.rx-l')).map(prepararLinha);
  const todas = linhasNoite.concat(linhasDia);
  gsap.set(todas.map((l) => l.texto), { autoAlpha: 0 });
  limpezas.push(() => gsap.set(todas.map((l) => l.texto).concat(todas.map((l) => l.bloco)), { clearProps: 'all' }));

  const empilhado = !ctx.largo;

  // mede já no modo fixo: só trava se o conteúdo couber inteiro na tela
  secao.classList.add('rx-descansa-fixo');
  secao.classList.toggle('rx-descansa-empilhado', empilhado);
  const estilo = getComputedStyle(miolo);
  const recheio = parseFloat(estilo.paddingTop) + parseFloat(estilo.paddingBottom);
  const conteudo = Math.max(blocoDia.offsetHeight, lista.offsetHeight, blocoNoite.offsetHeight);
  const cabe = (empilhado
    ? conteudo
    : Math.max(conteudo, blocoDia.offsetHeight)) + recheio <= window.innerHeight + 1
    && (empilhado || miolo.scrollHeight <= miolo.clientHeight + 1);

  if (!cabe) {
    // não coube: fica no fluxo normal, com revelação simples
    secao.classList.remove('rx-descansa-fixo', 'rx-descansa-empilhado');
    revelarBlocos([etiquetaNoite, etiquetaDia, texto], { y: 14 });
    for (const parte of [noite, dia]) {
      const daParte = gsap.utils.toArray(parte.querySelectorAll('.rx-l')).map(prepararLinha);
      const entrada = gsap.timeline({ paused: true });
      daParte.forEach((l, i) => passarBloco(entrada, l.texto, l.bloco, i * 0.1));
      aoEntrar(parte.querySelector('.rx-descansa-frase'), () => entrada.play(), 'top 88%');
    }
    gsap.set(mercados, { autoAlpha: 0, y: 24 });
    aoEntrar(lista, () => gsap.to(mercados, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.08 }), 'top 86%');
    return () => limpezas.forEach((f) => f());
  }
  limpezas.push(() => secao.classList.remove('rx-descansa-fixo', 'rx-descansa-empilhado'));

  // entrada do estado 1, antes de travar
  const entrada = gsap.timeline({ paused: true })
    .from(etiquetaNoite, { autoAlpha: 0, y: 12, duration: 0.7, ease: 'expo.out' }, 0)
    .from(led, { scale: 0, duration: 1, ease: 'back.out(2.4)' }, 0.4);
  if (reserva) entrada.from(reserva, { autoAlpha: 0, duration: 0.9, ease: 'power2.out' }, 0.1);
  linhasNoite.forEach((l, i) => passarBloco(entrada, l.texto, l.bloco, 0.05 + i * 0.11));
  aoEntrar(secao, () => entrada.play(), 'top 60%');

  const percurso = () => Math.round(window.innerHeight * (empilhado ? 2.6 : 2));

  const linha = gsap.timeline({
    defaults: { ease: 'power3.out' },
    scrollTrigger: {
      trigger: secao,
      start: 'top top',
      end: () => '+=' + percurso(),
      pin: palco,
      pinSpacing: true,
      anticipatePin: 1,
      scrub: 0.5,
      invalidateOnRefresh: true,
    },
  });

  // o estado 1 recua e o led abre em círculo
  linha
    .to([blocoNoite, reserva].filter(Boolean), { autoAlpha: 0, duration: 1.6, ease: 'power2.in' }, 1.4)
    .fromTo(dia,
      { clipPath: 'circle(0% at 50% 86%)' },
      { clipPath: 'circle(130% at 50% 86%)', duration: 3.4, ease: 'power2.inOut' }, 0.5)
    .fromTo(etiquetaDia, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8 }, 2.7);
  linhasDia.forEach((l, i) => passarBloco(linha, l.texto, l.bloco, 2.8 + i * 0.35, 0.6));
  linha.fromTo(texto, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 1 }, 4.2);

  // em tela estreita a frase sai de cena antes de a lista entrar
  let comeco = 3.6;
  if (empilhado) {
    linha.to(blocoDia, { yPercent: -14, autoAlpha: 0, duration: 1.2, ease: 'power2.in' }, 6);
    comeco = 7;
  }

  linha.fromTo(lista, { '--rx-fio': 0 }, { '--rx-fio': 1, duration: 1.2, ease: 'power3.inOut' }, comeco - 0.2);
  mercados.forEach((m, i) => {
    linha
      .fromTo(m, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'power3.inOut' }, comeco + i * 0.6)
      .fromTo(m.children, { yPercent: 90 }, { yPercent: 0, duration: 1.1, ease: 'power4.out', stagger: 0.1 }, comeco + 0.2 + i * 0.6);
  });
  linha.to({}, { duration: 1.2 }, comeco + 3.8);

  // saída: a tela encolhe e vira cartão enquanto sobe
  const saida = gsap.fromTo(palco,
    { clipPath: 'inset(0% 0% 0% 0%)' },
    {
      clipPath: 'inset(0% 3% 12% 3%)',
      ease: 'power2.in',
      immediateRender: false,
      scrollTrigger: {
        trigger: secao,
        start: () => 'top+=' + percurso() + ' top',
        end: 'bottom top',
        scrub: true,
        invalidateOnRefresh: true,
      },
    });
  limpezas.push(() => {
    if (saida.scrollTrigger) saida.scrollTrigger.kill();
    saida.kill();
    gsap.set(palco, { clearProps: 'clipPath' });
  });

  return () => limpezas.forEach((f) => f());
}
