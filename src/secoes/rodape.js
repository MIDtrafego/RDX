// 10. Rodapé.
// Moldura lima com painel escuro. A logo oficial se escreve quando o painel entra na tela,
// do mesmo jeito que na saída do hero (src/marca.js).
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { revelarBlocos } from './nucleo.js';
import { montarMarca } from '../marca.js';

export function iniciarRodape(ctx) {
  const secao = ctx.raiz.querySelector('#rodape');
  if (!secao) return null;

  const svg = secao.querySelector('.rx-rodape-escrita');
  const marca = svg ? montarMarca(svg, { cor: '#c8f52a' }) : null;
  if (!ctx.anima) {
    if (marca) marca.escrever(1);
    return null;
  }

  revelarBlocos(secao.querySelectorAll('.rx-rodape-frase, .rx-rodape-coluna, .rx-rodape-botao'), { y: 18, inicio: 'top 88%' });
  // a base fica colada no fim da página: um gatilho em 98% nunca era cruzado pela última linha
  revelarBlocos(secao.querySelectorAll('.rx-rodape-base > *'), { y: 12, inicio: 'top 100%' });

  const servidor = secao.querySelector('.rx-rodape-servidor img');
  const sobe = servidor
    ? gsap.fromTo(servidor, { yPercent: 14 }, {
      yPercent: 0,
      ease: 'none',
      scrollTrigger: { trigger: secao, start: 'top 90%', end: 'bottom bottom', scrub: 0.6 },
    })
    : null;

  const avanco = { a: 0 };
  const escrita = marca
    ? gsap.to(avanco, {
      a: 1,
      duration: 1.3,
      ease: 'power2.inOut',
      paused: true,
      onUpdate: () => marca.escrever(avanco.a),
    })
    : null;
  const gatilho = escrita
    ? ScrollTrigger.create({
      trigger: secao.querySelector('.rx-rodape-cabeca'),
      start: 'top 82%',
      onEnter: () => escrita.play(),
      onLeaveBack: () => escrita.reverse(),
    })
    : null;

  return () => {
    if (gatilho) gatilho.kill();
    if (escrita) escrita.kill();
    if (sobe) { if (sobe.scrollTrigger) sobe.scrollTrigger.kill(); sobe.kill(); }
    if (servidor) gsap.set(servidor, { clearProps: 'transform' });
    if (marca) marca.escrever(1);
  };
}
