// 7. Infraestrutura em números.
// Os números do registro (extraídos do MT5 da conta de desenvolvimento da RDX) ficam escritos
// no HTML, com a fonte em referencia/conteudo.md. Aqui só a entrada: a janela abre de cima
// para baixo, os quatro destaques contam, as barras por Core enchem e a lista aparece.
//
// Este módulo substitui o track-record.js (05/10/2026, pedido do Pedro): saíram a curva de
// resultado, o resultado em US$, a taxa de acerto e o extrato por ordem. Sem eles o leitor de
// dados (dados-track-record.js, objeto RDX_DATA) deixou de ter uso e foi removido junto.
import { gsap } from 'gsap';
import { revelarTitulo, revelarBlocos, contarAoEntrar, aoEntrar } from './nucleo.js';

export function iniciarNumeros(ctx) {
  const secao = ctx.raiz.querySelector('#numeros');
  if (!secao || !ctx.anima) return null;
  const limpezas = [];

  revelarBlocos(secao.querySelectorAll('[data-rx-revela]'), { y: 14 });
  secao.querySelectorAll('[data-rx-titulo]').forEach((el) => revelarTitulo(el, { cascata: el.matches('h2') ? 0.09 : 0.05 }));

  // a janela abre de cima para baixo
  const janela = secao.querySelector('.rx-tr-janela');
  gsap.set(janela, { clipPath: 'inset(0% 0% 100% 0%)' });
  aoEntrar(janela, () => gsap.to(janela, {
    clipPath: 'inset(0% 0% 0% 0%)',
    duration: 1.6,
    ease: 'power4.inOut',
    onComplete: () => gsap.set(janela, { clearProps: 'clipPath' }),
  }), 'top 86%');

  // destaques: os quatro números contando
  limpezas.push(contarAoEntrar(secao.querySelector('.rx-tr-destaques'), { inicio: 'top 82%', atraso: 0.5, cascata: 0.1, duracao: 2.2 }));

  // ordens e MCP por Core: barras enchendo e números contando
  secao.querySelectorAll('.rx-tr-porcore').forEach((painel, i) => {
    const faixas = painel.querySelectorAll('.rx-porcore i');
    gsap.set(faixas, { scaleX: 0 });
    aoEntrar(painel, () => gsap.to(faixas, { scaleX: 1, duration: 1.4, ease: 'power4.inOut', stagger: 0.1, delay: i * 0.15 }), 'top 88%');
    limpezas.push(contarAoEntrar(painel, { inicio: 'top 88%', atraso: i * 0.15, cascata: 0.1, duracao: 1.4 }));
  });

  // lista: período, ativos e conta
  const lista = secao.querySelector('.rx-tr-lista');
  limpezas.push(contarAoEntrar(lista, { inicio: 'top 88%', cascata: 0.08, duracao: 1.8 }));
  revelarBlocos(lista.querySelectorAll('dt'), { y: 14, inicio: 'top 92%', cascata: 0.06 });

  return () => limpezas.forEach((f) => f());
}
