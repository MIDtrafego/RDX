// 2. Manifesto (o problema).
// Rótulo minúsculo em cima e a frase principal centralizada, em duas vozes. Cada linha é
// revelada por um bloco lima que atravessa e sai, rápido e em cascata. Depois entram o
// parágrafo (do mesmo jeito, mais discreto) e o botão. A seção rola normalmente, não trava.
import { revelarTitulo, revelarBlocos } from './nucleo.js';

export function iniciarProblema(ctx) {
  const secao = ctx.raiz.querySelector('#problema');
  if (!secao || !ctx.anima) return null;

  const frase = secao.querySelector('.rx-frase');
  const texto = secao.querySelector('.rx-manifesto-apoio .rx-texto');

  revelarBlocos(secao.querySelectorAll('[data-rx-revela]'), { y: 14, inicio: 'top 92%' });
  revelarTitulo(frase, { inicio: 'top 88%', cascata: 0.1, duracao: 0.38 });
  revelarTitulo(texto, { inicio: 'top 92%', cascata: 0.06, duracao: 0.3 });

  return null;
}
