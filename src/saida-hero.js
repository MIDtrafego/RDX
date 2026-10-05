// Saída do hero, no mesmo desenho do site de referência (medido quadro a quadro):
//   1. o quadro do hero encolhe conforme a rolagem, até virar um cartão no centro
//   2. atrás dele passa uma faixa de texto em duas linhas
//   3. por cima, a marca se escreve a traço, presa à rolagem
//   4. depois tudo sobe junto com a página e sai de cena
//
// Tudo aqui é função da posição da rolagem. Nada anima por tempo, a não ser o passeio da faixa.

import { montarMarca } from './marca.js';

// Medido no site de referência (1440 x 900, rolagem constante), em alturas de tela:
//   rolagem   0,25  0,39  0,53  0,67  0,81  0,95
//   largura   0,90  0,77  0,60  0,45  0,37  0,33   (do quadro, em relação à tela)
// A curva que passa por esses pontos é a suave (3t² - 2t³). A assinatura de lá começa em 0,53
// e termina em 0,88; o conjunto começa a subir com a página em 1,05.
const FIM_ENCOLHER = 0.95;     // o quadro termina de encolher
const INI_ESCREVER = 0.53;     // a marca começa a ser escrita
const FIM_ESCREVER = 0.90;     // a marca está pronta
const INI_SUBIR = 1.05;        // o conjunto começa a subir junto com a página
const ESCALA_FINAL = 0.33;     // largura final do quadro em relação à tela (computador)
const ESCALA_FINAL_CELULAR = 0.66;   // no celular o quadro de 33% ficaria com 130 px; 66% deixa lugar para a chamada

const limitar = (v) => Math.max(0, Math.min(1, v));
const suave = (t) => t * t * (3 - 2 * t);

export function iniciarSaida({ canvas }) {
  const fundo = document.querySelector('.saida-fundo');
  const frente = document.querySelector('.saida-frente');
  if (!fundo || !frente) return null;

  const faixas = [...fundo.querySelectorAll('.saida-faixa')];
  const rotulo = frente.querySelector('.saida-rotulo');
  const chamada = frente.querySelector('.saida-chamada');
  const marca = montarMarca(frente.querySelector('.saida-marca'), { cor: '#c8f52a' });

  // cada faixa repete o próprio texto até passar de duas telas, para o passeio não ter emenda
  for (const f of faixas) {
    const base = f.innerHTML;
    f.innerHTML = base + base + base + base;
  }

  const estado = { y: 0, fase: 0, fora: false };

  function atualizar(y, tempo = 0) {
    const A = window.innerHeight;
    const s = y / A;
    estado.y = y;
    estado.fase = s;

    // depois de pronta a marca, o conjunto sobe junto com a página
    const subida = Math.max(0, y - INI_SUBIR * A);
    estado.fora = subida > A * 1.15;

    const e = suave(limitar(s / FIM_ENCOLHER));
    const final = window.innerWidth < 768 ? ESCALA_FINAL_CELULAR : ESCALA_FINAL;
    const escala = 1 - (1 - final) * e;
    canvas.style.transform = 'translate3d(0,' + (-subida).toFixed(1) + 'px,0) scale(' + escala.toFixed(4) + ')';

    // faixa de texto atrás do quadro: aparece conforme o quadro abre espaço
    fundo.style.opacity = limitar(s / 0.12).toFixed(3);
    fundo.style.transform = 'translate3d(0,' + (-subida).toFixed(1) + 'px,0)';
    faixas.forEach((f, i) => {
      const largura = f.scrollWidth / 4;
      const sentido = i % 2 === 0 ? -1 : 1;
      let x = (y * 0.55 + tempo * 26) % largura;
      if (sentido > 0) x = largura - x;
      f.style.transform = 'translate3d(' + (-x).toFixed(1) + 'px,0,0)';
    });

    // a marca sendo escrita
    marca.escrever((s - INI_ESCREVER) / (FIM_ESCREVER - INI_ESCREVER));
    frente.style.transform = 'translate3d(0,' + (-subida).toFixed(1) + 'px,0)';
    frente.style.visibility = s > INI_ESCREVER - 0.05 && !estado.fora ? 'visible' : 'hidden';
    if (rotulo) rotulo.style.opacity = limitar((s - INI_ESCREVER) / 0.12).toFixed(3);

    // a chamada entra quando a marca está quase pronta e sobe junto com o conjunto
    if (chamada) {
      const c = suave(limitar((s - (FIM_ESCREVER - 0.08)) / 0.12));
      chamada.style.opacity = c.toFixed(3);
      chamada.style.transform = 'translate(-50%, calc(-50% + ' + ((1 - c) * 18).toFixed(1) + 'px))';
      chamada.style.pointerEvents = c > 0.6 && !estado.fora ? 'auto' : 'none';
    }

    return estado;
  }

  atualizar(0);
  return { atualizar, estado, FIM_ENCOLHER };
}
