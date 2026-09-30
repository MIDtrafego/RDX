// 10. Rodapé.
// A logo oficial (img/rdx-logo.svg) sobe de dentro do recorte, ligada à rolagem, e termina
// no lugar quando a página chega ao fim. O aviso de risco entra inteiro, sem corte.
import { gsap } from 'gsap';
import { revelarBlocos } from './nucleo.js';

export function iniciarRodape(ctx) {
  const secao = ctx.raiz.querySelector('#rodape');
  if (!secao || !ctx.anima) return null;

  const marca = secao.querySelector('.rx-rodape-marca');
  const logo = marca.querySelector('img');

  revelarBlocos(secao.querySelectorAll('.rx-rodape-topo > *'), { y: 14, inicio: 'top 94%' });
  revelarBlocos(secao.querySelectorAll('.rx-rodape-base > *'), { y: 14, inicio: 'top 98%' });

  const subir = gsap.fromTo(logo,
    { yPercent: 102 },
    {
      yPercent: 0,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: marca,
        start: 'top 98%',
        end: 'bottom 90%',
        scrub: 0.6,
      },
    });

  return () => {
    if (subir.scrollTrigger) subir.scrollTrigger.kill();
    subir.kill();
    gsap.set(logo, { clearProps: 'transform' });
  };
}
