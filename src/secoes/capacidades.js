// 3. Trilho horizontal.
// No computador a seção trava e a rolagem vertical vira deslocamento lateral da pista.
// As peças têm tamanhos diferentes e ficam espalhadas em alturas diferentes (posição no
// HTML, em --x e --y). Cada uma anda numa velocidade um pouco diferente (parallax) e entra
// com uma cortina lima que atravessa. O fundo muda do escuro para o claro ao longo do trilho.
// Abaixo de 992 px e com movimento reduzido, a pista é rolagem horizontal nativa.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { limitar, revelarTitulo, revelarBlocos, prepararTraco, aoEntrar } from './nucleo.js';

const ESCURO = '#050706';
const CLARO = '#dfe5dc';
const VIRADA = [0.46, 0.62];      // trecho do trilho em que o fundo troca de cor

export function iniciarCapacidades(ctx) {
  const secao = ctx.raiz.querySelector('#capacidades');
  if (!secao) return null;

  const palco = secao.querySelector('.rx-trilho-palco');
  const fundo = secao.querySelector('.rx-trilho-fundo');
  const pista = secao.querySelector('.rx-trilho-pista');
  const abre = secao.querySelector('.rx-trilho-abre');
  const titulo = secao.querySelector('.rx-trilho-titulo');
  const pecas = gsap.utils.toArray(secao.querySelectorAll('.rx-peca'));
  const limpezas = [];

  // monta a entrada de uma peça: a cortina lima cobre o quadro, o conteúdo aparece, a cortina sai
  function entradaDaPeca(el) {
    const quadro = el.querySelector('.rx-peca-quadro');
    const cortina = el.querySelector('.rx-peca-cortina');
    const legenda = el.querySelector('.rx-legenda');
    const traco = el.querySelector('.rx-peca-icone path');
    const miolo = gsap.utils.toArray(quadro.children).filter((f) => f !== cortina);
    prepararTraco(traco);
    gsap.set(cortina, { xPercent: -101 });
    gsap.set([quadro, legenda], { autoAlpha: 0 });
    gsap.set(miolo, { autoAlpha: 0 });
    return gsap.timeline({ paused: true })
      .set(quadro, { autoAlpha: 1 }, 0)
      .fromTo(cortina, { xPercent: -101 }, { xPercent: 0, duration: 0.3, ease: 'power3.inOut' }, 0)
      .set(miolo, { autoAlpha: 1 }, 0.3)
      .to(cortina, { xPercent: 101, duration: 0.3, ease: 'power3.inOut' }, 0.3)
      .to(legenda, { autoAlpha: 1, duration: 0.5, ease: 'power2.out' }, 0.3)
      .to(traco, { strokeDashoffset: 0, duration: 1.2, ease: 'power3.inOut' }, 0.6);
  }

  const fixo = ctx.anima && ctx.mesa;

  // ───────────── pista nativa (celular, tablet, movimento reduzido) ─────────────
  if (!fixo) {
    if (ctx.anima) {
      revelarBlocos(abre.querySelectorAll('.rx-etiqueta, .rx-trilho-dica'), { y: 14 });
      revelarTitulo(titulo);
      const entradas = pecas.map(entradaDaPeca);
      const citas = secao.querySelectorAll('.rx-cita');
      gsap.set(citas, { autoAlpha: 0, y: 20 });
      aoEntrar(pista, () => {
        entradas.forEach((t, i) => t.delay(0.15 + i * 0.09).play());
        gsap.to(citas, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.12, delay: 0.4 });
      }, 'top 78%');
    }
    return () => limpezas.forEach((f) => f());
  }

  // ───────────── pista fixa (computador) ─────────────
  secao.classList.add('rx-trilho-fixo');
  pista.scrollLeft = 0;
  limpezas.push(() => secao.classList.remove('rx-trilho-fixo'));

  const itens = gsap.utils.toArray(pista.children)
    .filter((el) => !el.classList.contains('rx-trilho-fim') && el !== abre)
    .map((el) => {
      const ehPeca = el.classList.contains('rx-peca');
      let entrada;
      if (ehPeca) {
        entrada = entradaDaPeca(el);
      } else {
        gsap.set(el, { autoAlpha: 0 });
        entrada = gsap.timeline({ paused: true }).to(el, { autoAlpha: 1, duration: 0.8, ease: 'power2.out' }, 0);
      }
      return { el, z: Number(el.dataset.rxZ) || 0, esq: 0, larg: 0, entrada, entrou: false };
    });
  prepararTraco(secao.querySelectorAll('.rx-trilho-dica path'));

  let distancia = 1;
  let L = 1;
  function medir() {
    L = palco.clientWidth;
    distancia = Math.max(1, pista.offsetWidth - L);
    for (const item of itens) {
      item.esq = item.el.offsetLeft;
      item.larg = item.el.offsetWidth;
    }
  }
  medir();
  ScrollTrigger.addEventListener('refreshInit', medir);
  limpezas.push(() => ScrollTrigger.removeEventListener('refreshInit', medir));

  const corDoFundo = gsap.utils.interpolate(ESCURO, CLARO);
  const corDaTinta = gsap.utils.interpolate('#ffffff', '#050706');
  const corDaTinta2 = gsap.utils.interpolate('#8a938e', '#3d4641');
  let viradaAnterior = -1;

  function aplicar(progresso) {
    const x = -distancia * progresso;

    // fundo e tinta das legendas e citações
    const t = limitar((progresso - VIRADA[0]) / (VIRADA[1] - VIRADA[0]), 0, 1);
    const virada = Math.round(t * 200) / 200;
    if (virada !== viradaAnterior) {
      viradaAnterior = virada;
      const suave = virada * virada * (3 - 2 * virada);
      fundo.style.backgroundColor = corDoFundo(suave);
      palco.style.setProperty('--rx-tinta', corDaTinta(suave));
      palco.style.setProperty('--rx-tinta-2', corDaTinta2(suave));
      palco.dataset.rxTema = suave > 0.5 ? 'claro' : 'escuro';
    }

    for (const item of itens) {
      const esquerda = item.esq + x;
      if (!item.entrou && esquerda < L * 0.93) {
        item.entrou = true;
        item.entrada.play();
      }
      if (esquerda > L * 1.3 || esquerda + item.larg < -L * 0.3) continue;
      // -0.5: entrando pela direita · 0: no centro da tela · 0.5: saindo pela esquerda
      const d = (L / 2 - (esquerda + item.larg / 2)) / L;
      // 0.4: o parallax era forte o bastante para uma peça cobrir a vizinha
      item.el.style.transform = 'translate3d(' + (d * item.z * L * 0.4).toFixed(1) + 'px,0,0)';
    }
  }

  const andar = gsap.to(pista, {
    x: () => -distancia,
    ease: 'none',          // aqui a posição é a própria rolagem: a inércia vem do Lenis
    scrollTrigger: {
      trigger: secao,
      start: 'top top',
      end: () => '+=' + distancia,
      pin: palco,
      pinSpacing: true,
      anticipatePin: 1,
      scrub: true,
      invalidateOnRefresh: true,
      onUpdate: (self) => aplicar(self.progress),
      onRefresh: (self) => aplicar(self.progress),
    },
  });
  limpezas.push(() => {
    if (andar.scrollTrigger) andar.scrollTrigger.kill();
    andar.kill();
    gsap.set(pista, { clearProps: 'transform' });
    for (const item of itens) item.el.style.transform = '';
    fundo.style.backgroundColor = '';
    palco.style.removeProperty('--rx-tinta');
    palco.style.removeProperty('--rx-tinta-2');
    palco.dataset.rxTema = 'escuro';
  });

  // abertura: entra quando a seção chega, antes de travar
  revelarBlocos(abre.querySelectorAll('.rx-etiqueta, .rx-trilho-dica'), { y: 14, inicio: 'top 70%' });
  revelarTitulo(titulo, { gatilho: secao, inicio: 'top 70%' });
  aoEntrar(secao, () => {
    gsap.to(secao.querySelectorAll('.rx-trilho-dica path'), { strokeDashoffset: 0, duration: 1.2, ease: 'power3.inOut', delay: 0.5 });
  }, 'top 60%');

  return () => limpezas.forEach((f) => f());
}
