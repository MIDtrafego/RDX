// 10. Rodapé.
// A marca gigante sobe letra por letra de dentro do recorte, ligada à rolagem, e termina
// no lugar quando a página chega ao fim. O aviso de risco entra inteiro, sem corte.
import { gsap } from 'gsap';
import { revelarBlocos } from './nucleo.js';

export function iniciarRodape(ctx) {
  const secao = ctx.raiz.querySelector('#rodape');
  if (!secao || !ctx.anima) return null;

  const marca = secao.querySelector('.rx-rodape-marca');
  const letras = marca.querySelectorAll('span');

  revelarBlocos(secao.querySelectorAll('.rx-rodape-topo > *'), { y: 14, inicio: 'top 94%' });
  revelarBlocos(secao.querySelectorAll('.rx-rodape-base > *'), { y: 20, inicio: 'top 98%' });

  const subir = gsap.fromTo(letras,
    { yPercent: 105 },
    {
      yPercent: 0,
      ease: 'power3.out',
      stagger: 0.12,
      scrollTrigger: {
        trigger: marca,
        start: 'top 96%',
        end: 'bottom 88%',
        scrub: 0.6,
      },
    });

  return () => { subir.scrollTrigger && subir.scrollTrigger.kill(); subir.kill(); };
}
