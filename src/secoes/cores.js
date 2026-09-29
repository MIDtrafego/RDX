// 5. Grade dos Cores.
// Quatro colunas desencontradas, cartões de borda fina com o canto recortado e a legenda
// embaixo, à direita. Cada coluna anda numa velocidade na rolagem, o cartão inclina e ganha
// uma luz que segue o mouse, a sigla enche de cor. Os números ficam como estão no registro:
// Core 03 e Core 04 aparecem com o resultado que tiveram.
import { gsap } from 'gsap';
import { revelarTitulo, revelarBlocos, contarAoEntrar, aoEntrar } from './nucleo.js';

export function iniciarCores(ctx) {
  const secao = ctx.raiz.querySelector('#cores');
  if (!secao) return null;

  const grade = secao.querySelector('.rx-cores-grade');
  const caixas = gsap.utils.toArray(grade.children);
  const cartoes = gsap.utils.toArray(secao.querySelectorAll('.rx-core'));
  const limpezas = [];

  // luz que segue o mouse e inclinação: só com mouse de verdade
  if (ctx.fino) {
    for (const cartao of cartoes) {
      const girarX = ctx.anima ? gsap.quickTo(cartao, 'rotationX', { duration: 0.5, ease: 'power3.out' }) : null;
      const girarY = ctx.anima ? gsap.quickTo(cartao, 'rotationY', { duration: 0.5, ease: 'power3.out' }) : null;
      if (ctx.anima) gsap.set(cartao, { transformPerspective: 1100, transformOrigin: '50% 50%' });

      const mover = (e) => {
        const r = cartao.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        cartao.style.setProperty('--rx-mx', (px * 100).toFixed(1) + '%');
        cartao.style.setProperty('--rx-my', (py * 100).toFixed(1) + '%');
        if (girarX) {
          girarX((0.5 - py) * 4);
          girarY((px - 0.5) * 5);
        }
      };
      const sair = () => {
        if (!girarX) return;
        gsap.to(cartao, { rotationX: 0, rotationY: 0, duration: 1.1, ease: 'expo.out', overwrite: 'auto' });
      };
      cartao.addEventListener('pointermove', mover, { passive: true });
      cartao.addEventListener('pointerleave', sair, { passive: true });
      limpezas.push(() => {
        cartao.removeEventListener('pointermove', mover);
        cartao.removeEventListener('pointerleave', sair);
        cartao.style.removeProperty('--rx-mx');
        cartao.style.removeProperty('--rx-my');
      });
    }
  }

  if (!ctx.anima) return () => limpezas.forEach((f) => f());

  revelarBlocos(secao.querySelectorAll('.rx-cabeca [data-rx-revela]'), { y: 14 });
  secao.querySelectorAll('.rx-cabeca [data-rx-titulo]').forEach((el, i) => revelarTitulo(el, { atraso: i * 0.2, cascata: i ? 0.05 : 0.09 }));

  // entrada de cada caixa: sobe e aparece, a sigla sobe de dentro do recorte, a barra enche
  // e o percentual conta
  for (const caixa of caixas) {
    const sigla = caixa.querySelector('.rx-core-sigla span');
    const medida = caixa.querySelector('.rx-core-medida:not(.rx-core-medida-vazia) i');
    const entrada = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } })
      .from(caixa, { autoAlpha: 0, yPercent: 8, duration: 1.1 }, 0);
    if (sigla) entrada.from(sigla, { yPercent: 110, duration: 1.2 }, 0.1);
    if (medida) entrada.from(medida, { scaleX: 0, duration: 1.4, ease: 'power4.inOut' }, 0.3);
    aoEntrar(caixa, () => entrada.play(), 'top 90%');
    limpezas.push(contarAoEntrar(caixa, { gatilho: caixa, inicio: 'top 90%', atraso: 0.3 }));
  }

  // colunas em velocidades diferentes (só quando a grade tem mais de uma coluna)
  const colunas = new Map();
  for (const caixa of caixas) {
    const chave = Math.round(caixa.offsetLeft);
    if (!colunas.has(chave)) colunas.set(chave, []);
    colunas.get(chave).push(caixa);
  }
  if (colunas.size > 1) {
    const u = () => parseFloat(getComputedStyle(grade).columnGap) || 12;      // o vão da grade é 1 u
    const forcas = colunas.size >= 4 ? [0, -5, -2, -7] : [0, -4];
    [...colunas.keys()].sort((a, b) => a - b).forEach((chave, i) => {
      const forca = forcas[i] || 0;
      if (!forca) return;
      gsap.fromTo(colunas.get(chave), { y: 0 }, {
        y: () => forca * u(),
        ease: 'none',
        scrollTrigger: {
          trigger: grade,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.6,
          invalidateOnRefresh: true,
        },
      });
    });
  }

  return () => limpezas.forEach((f) => f());
}
