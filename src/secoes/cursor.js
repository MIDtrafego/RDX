// Cursor próprio e botão magnético. Só existem com mouse de verdade
// ((hover: hover) and (pointer: fine)); em tela de toque nada disto é criado.
import { gsap } from 'gsap';

const ALVOS = 'a, button, summary, [data-rx-cursor]';

export function iniciarCursor(ctx) {
  if (!ctx.fino || !ctx.anima || ctx.opcoes.cursor === false) return null;
  const raiz = ctx.raiz;

  const cursor = document.createElement('div');
  cursor.className = 'rx-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  cursor.innerHTML = '<span class="rx-cursor-anel"><span class="rx-cursor-texto"></span></span><span class="rx-cursor-ponto"></span>';
  raiz.appendChild(cursor);
  const anel = cursor.querySelector('.rx-cursor-anel');
  const ponto = cursor.querySelector('.rx-cursor-ponto');
  const texto = cursor.querySelector('.rx-cursor-texto');

  // o ponto gruda no mouse; o anel vem atrás, com atraso
  const pontoX = gsap.quickSetter(ponto, 'x', 'px');
  const pontoY = gsap.quickSetter(ponto, 'y', 'px');
  const anelX = gsap.quickTo(anel, 'x', { duration: 0.45, ease: 'power3.out' });
  const anelY = gsap.quickTo(anel, 'y', { duration: 0.45, ease: 'power3.out' });

  let dentro = false;
  let primeiro = true;

  function entrar() {
    if (dentro) return;
    dentro = true;
    raiz.classList.add('rx-com-cursor');
    cursor.classList.add('rx-cursor-vivo');
  }
  function sair() {
    if (!dentro) return;
    dentro = false;
    raiz.classList.remove('rx-com-cursor');
    cursor.classList.remove('rx-cursor-vivo', 'rx-cursor-alvo', 'rx-cursor-rotulo');
  }

  function mover(e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    const alvoNaRaiz = e.target instanceof Element && raiz.contains(e.target) && !e.target.closest('.rx-janela');
    if (!alvoNaRaiz) { sair(); return; }
    entrar();
    pontoX(e.clientX);
    pontoY(e.clientY);
    if (primeiro) {
      primeiro = false;
      gsap.set(anel, { x: e.clientX, y: e.clientY });
    }
    anelX(e.clientX);
    anelY(e.clientY);

    const alvo = e.target.closest(ALVOS);
    const rotulo = alvo ? alvo.closest('[data-rx-cursor]') : null;
    const temRotulo = Boolean(rotulo && rotulo.dataset.rxCursor);
    if (temRotulo && texto.textContent !== rotulo.dataset.rxCursor) texto.textContent = rotulo.dataset.rxCursor;
    cursor.classList.toggle('rx-cursor-rotulo', temRotulo);
    cursor.classList.toggle('rx-cursor-alvo', Boolean(alvo) && !temRotulo);
  }

  const apertar = () => cursor.classList.add('rx-cursor-aperto');
  const soltar = () => cursor.classList.remove('rx-cursor-aperto');
  const aoSairDaJanela = () => sair();

  window.addEventListener('pointermove', mover, { passive: true });
  window.addEventListener('pointerdown', apertar, { passive: true });
  window.addEventListener('pointerup', soltar, { passive: true });
  document.documentElement.addEventListener('pointerleave', aoSairDaJanela);

  return () => {
    window.removeEventListener('pointermove', mover);
    window.removeEventListener('pointerdown', apertar);
    window.removeEventListener('pointerup', soltar);
    document.documentElement.removeEventListener('pointerleave', aoSairDaJanela);
    raiz.classList.remove('rx-com-cursor');
    cursor.remove();
  };
}

// Botão magnético: o botão é puxado pelo mouse e volta com mola quando o mouse sai.
export function iniciarImas(ctx) {
  if (!ctx.fino || !ctx.anima) return null;
  const limpezas = [];

  for (const botao of ctx.raiz.querySelectorAll('[data-rx-ima]')) {
    const rotulo = botao.querySelector('.rx-botao-rotulo');
    const bx = gsap.quickTo(botao, 'x', { duration: 0.5, ease: 'power3.out' });
    const by = gsap.quickTo(botao, 'y', { duration: 0.5, ease: 'power3.out' });
    const rx = rotulo ? gsap.quickTo(rotulo, 'x', { duration: 0.5, ease: 'power3.out' }) : null;
    const ry = rotulo ? gsap.quickTo(rotulo, 'y', { duration: 0.5, ease: 'power3.out' }) : null;

    const mover = (e) => {
      // o centro é o do botão em repouso: desconta o deslocamento que ele já tem
      const r = botao.getBoundingClientRect();
      const dx = e.clientX - (r.left - Number(gsap.getProperty(botao, 'x')) + r.width / 2);
      const dy = e.clientY - (r.top - Number(gsap.getProperty(botao, 'y')) + r.height / 2);
      bx(dx * 0.32);
      by(dy * 0.42);
      if (rx) { rx(dx * 0.12); ry(dy * 0.16); }
    };
    const sair = () => {
      gsap.to(botao, { x: 0, y: 0, duration: 1.1, ease: 'elastic.out(1, 0.38)', overwrite: 'auto' });
      if (rotulo) gsap.to(rotulo, { x: 0, y: 0, duration: 1.1, ease: 'elastic.out(1, 0.38)', overwrite: 'auto' });
    };
    botao.addEventListener('pointermove', mover, { passive: true });
    botao.addEventListener('pointerleave', sair, { passive: true });
    limpezas.push(() => {
      botao.removeEventListener('pointermove', mover);
      botao.removeEventListener('pointerleave', sair);
      gsap.killTweensOf([botao, rotulo].filter(Boolean));
      gsap.set([botao, rotulo].filter(Boolean), { clearProps: 'x,y' });
    });
  }

  return () => limpezas.forEach((f) => f());
}
