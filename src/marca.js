// A marca RDX sendo escrita.
//
// Como funciona: o contorno da logo (src/marca-dados.js, gerado da logo oficial) é desenhado
// preenchido, mas escondido atrás de uma máscara. A máscara é feita de traços largos que correm
// pelo eixo de cada letra. Conforme o traço avança, a logo aparece por dentro dele. No fim, o que
// se vê é a logo exata, e não uma imitação feita de linhas.
//
// Uso:
//   const marca = montarMarca(svg, { cor: '#c8f52a' });
//   marca.escrever(0.4);   // 0 = nada escrito, 1 = logo inteira
import { MARCA } from './marca-dados.js';

// Eixo de cada traço, na ordem em que a mão escreveria, nas coordenadas da logo (453 x 160).
// As pontas passam um pouco do desenho de propósito: a máscara precisa cobrir a ponta inteira.
export const TRACOS = [
  'M-6 9 H96 C113 9 122 21 122 37 C122 55 110 66 93 66 H26',           // R: barra de cima, volta e barra do meio
  'M54 62 L118 124',                                                    // R: perna
  'M156 9 H245 C269 9 277 25 277 46 V72 C277 95 268 108 243 108 H154',  // D
  'M310 -8 L382 58 L310 126',                                           // X: a seta da esquerda
  'M390 56 L456 -8',                                                    // X: braço de cima
  'M390 62 L456 126',                                                   // X: braço de baixo
];
const LARGURA_DO_TRACO = 30;   // a letra tem uns 19 de espessura: o traço da máscara sobra dos dois lados

const NS = 'http://www.w3.org/2000/svg';
let contador = 0;

const limitar = (v) => Math.max(0, Math.min(1, v));
const suave = (t) => t * t * (3 - 2 * t);

export function montarMarca(svg, { cor = '#ffffff', comAssinatura = true } = {}) {
  const id = 'marca-mascara-' + (++contador);
  const el = (nome, atributos = {}) => {
    const n = document.createElementNS(NS, nome);
    for (const [k, v] of Object.entries(atributos)) n.setAttribute(k, v);
    return n;
  };

  svg.setAttribute('viewBox', '0 0 ' + MARCA.largura + ' ' + MARCA.altura);
  svg.setAttribute('fill', 'none');
  svg.replaceChildren();

  const defs = el('defs');
  const mascara = el('mask', { id, maskUnits: 'userSpaceOnUse', x: -20, y: -20, width: MARCA.largura + 40, height: MARCA.altura + 40 });
  const tracos = TRACOS.map((d) => {
    const p = el('path', { d, stroke: '#fff', 'stroke-width': LARGURA_DO_TRACO, 'stroke-linecap': 'butt', 'stroke-linejoin': 'miter', fill: 'none' });
    mascara.appendChild(p);
    return p;
  });
  defs.appendChild(mascara);
  svg.appendChild(defs);

  const letras = el('path', { d: MARCA.letras, fill: cor, 'fill-rule': 'evenodd', mask: 'url(#' + id + ')' });
  svg.appendChild(letras);

  let assinatura = null;
  if (comAssinatura) {
    assinatura = el('path', { d: MARCA.assinatura, fill: cor, 'fill-rule': 'evenodd' });
    svg.appendChild(assinatura);
  }

  // cada traço ocupa um trecho do total, proporcional ao comprimento, com pequena sobreposição
  const comprimentos = tracos.map((p) => p.getTotalLength());
  const total = comprimentos.reduce((a, b) => a + b, 0) || 1;
  let acumulado = 0;
  const trechos = comprimentos.map((c) => {
    const ini = acumulado / total;
    acumulado += c;
    return [Math.max(0, ini - 0.025), acumulado / total];
  });
  tracos.forEach((p, i) => { p.style.strokeDasharray = comprimentos[i] + ' ' + (comprimentos[i] + 4); });

  // a escrita das letras ocupa os primeiros 82% do avanço; a assinatura entra no resto, da esquerda para a direita
  const FIM_LETRAS = comAssinatura ? 0.82 : 1;

  function escrever(avanco) {
    const a = limitar(avanco);
    const w = limitar(a / FIM_LETRAS);
    tracos.forEach((p, i) => {
      const [ini, fim] = trechos[i];
      const t = suave(limitar((w - ini) / (fim - ini)));
      p.style.strokeDashoffset = (comprimentos[i] * (1 - t)).toFixed(2);
      p.style.visibility = t <= 0 ? 'hidden' : 'visible';
    });
    if (assinatura) {
      const t = suave(limitar((a - FIM_LETRAS) / (1 - FIM_LETRAS)));
      assinatura.style.clipPath = 'inset(0 ' + ((1 - t) * 100).toFixed(2) + '% 0 0)';
      assinatura.style.opacity = t <= 0 ? '0' : '1';
    }
  }

  escrever(0);
  return { escrever, tracos, letras, assinatura, largura: MARCA.largura, altura: MARCA.altura };
}
