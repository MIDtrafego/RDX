// Movimento das telas de conta: troca de passo, janela e paralaxe.
//
// O GSAP é carregado por import dinâmico. Se ele faltar, ou se a pessoa pediu menos
// movimento no sistema, tudo continua funcionando: o passo só troca, sem deslocamento.

const TEMPO = 0.45;
const CURVA = 'power3.out';

let gsap = null;
let carga = null;

export const reduzido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function carregarMovimento() {
  if (!carga) {
    carga = import('gsap')
      .then((m) => { gsap = m.gsap || m.default || null; return gsap; })
      .catch(() => null);
  }
  return carga;
}

const parado = () => reduzido() || !gsap;

// ───────────── troca de passo ─────────────
// O passo atual sai para um lado e o próximo entra pelo outro, os dois por trás de uma
// máscara. O palco acompanha a altura do passo que chega, para o cartão não dar salto.
// direcao: 1 avança, -1 volta.
let trocaAtual = null;

export function trocarPasso({ palco, sai, entra, direcao = 1 }) {
  if (trocaAtual) trocaAtual.progress(1);

  if (parado()) {
    sai.hidden = true;
    entra.hidden = false;
    return Promise.resolve();
  }

  return new Promise((ok) => {
    const alturaSai = palco.offsetHeight;
    entra.hidden = false;
    // o palco tem uma folga em volta: o passo que sai fica preso no mesmo lugar em que estava
    const folga = parseFloat(window.getComputedStyle(palco).paddingLeft) || 0;
    gsap.set(sai, { position: 'absolute', top: folga, left: folga, width: sai.offsetWidth });
    palco.scrollTop = 0;
    const alturaEntra = entra.offsetHeight + folga * 2;
    gsap.set(palco, { height: alturaSai });
    palco.classList.add('ct-trocando');

    const passo = 32 * direcao;
    const fechada = direcao > 0 ? 'inset(0% 100% 0% 0%)' : 'inset(0% 0% 0% 100%)';
    const porAbrir = direcao > 0 ? 'inset(0% 0% 0% 100%)' : 'inset(0% 100% 0% 0%)';
    const aberta = 'inset(0% 0% 0% 0%)';

    const tl = gsap.timeline({
      defaults: { duration: TEMPO, ease: CURVA },
      onComplete: () => {
        sai.hidden = true;
        gsap.set([sai, entra, palco], { clearProps: 'all' });
        palco.classList.remove('ct-trocando');
        trocaAtual = null;
        ok();
      },
    });
    tl.fromTo(sai, { x: 0, opacity: 1, clipPath: aberta }, { x: -passo, opacity: 0, clipPath: fechada }, 0)
      .fromTo(entra, { x: passo, opacity: 0, clipPath: porAbrir }, { x: 0, opacity: 1, clipPath: aberta }, 0.07)
      .to(palco, { height: alturaEntra }, 0);
    trocaAtual = tl;
  });
}

// ───────────── janela ─────────────
export function abrirJanela({ fundo, caixa }) {
  if (parado()) return;
  gsap.killTweensOf([fundo, caixa]);
  gsap.fromTo(fundo, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: CURVA });
  gsap.fromTo(
    caixa,
    { y: 28, opacity: 0, scale: 0.985, clipPath: 'inset(8% 0% 0% 0% round 22px)' },
    { y: 0, opacity: 1, scale: 1, clipPath: 'inset(0% 0% 0% 0% round 22px)', duration: TEMPO, ease: CURVA, clearProps: 'all' },
  );
}

export function fecharJanela({ fundo, caixa }) {
  if (parado()) return Promise.resolve();
  return new Promise((ok) => {
    gsap.killTweensOf([fundo, caixa]);
    gsap.to(fundo, { opacity: 0, duration: 0.25, ease: 'power2.out' });
    gsap.to(caixa, {
      y: 16,
      opacity: 0,
      scale: 0.99,
      duration: 0.25,
      ease: 'power2.out',
      onComplete: () => {
        gsap.set([fundo, caixa], { clearProps: 'all' });
        ok();
      },
    });
  });
}

// ───────────── peça que aparece (arquivo escolhido, aviso) ─────────────
export function revelar(el) {
  if (parado()) return;
  gsap.fromTo(
    el,
    { y: 10, opacity: 0, clipPath: 'inset(0% 0% 100% 0%)' },
    { y: 0, opacity: 1, clipPath: 'inset(0% 0% 0% 0%)', duration: TEMPO, ease: CURVA, clearProps: 'all' },
  );
}

// ───────────── paralaxe da área de marca e luz do cartão ─────────────
export function ligarCena() {
  const fino = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!fino) return;

  // luz que acompanha o mouse por dentro do cartão (só CSS, vale mesmo sem GSAP)
  document.querySelectorAll('.ct-cartao').forEach((cartao) => {
    cartao.addEventListener('pointermove', (e) => {
      const r = cartao.getBoundingClientRect();
      cartao.style.setProperty('--ct-mx', ((e.clientX - r.left) / r.width * 100).toFixed(2) + '%');
      cartao.style.setProperty('--ct-my', ((e.clientY - r.top) / r.height * 100).toFixed(2) + '%');
    });
  });

  if (parado()) return;
  const camadas = Array.from(document.querySelectorAll('[data-ct-fundura]'));
  if (!camadas.length) return;
  const moves = camadas.map((el) => ({
    f: Number(el.dataset.ctFundura) || 0,
    x: gsap.quickTo(el, 'x', { duration: 1.1, ease: CURVA }),
    y: gsap.quickTo(el, 'y', { duration: 1.1, ease: CURVA }),
  }));
  window.addEventListener('pointermove', (e) => {
    const nx = e.clientX / window.innerWidth - 0.5;
    const ny = e.clientY / window.innerHeight - 0.5;
    for (const m of moves) {
      m.x(nx * m.f);
      m.y(ny * m.f);
    }
  }, { passive: true });
}
