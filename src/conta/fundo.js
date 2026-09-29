// Fundo das telas de conta: curvas de nível, como as do hero, em canvas 2D.
//
// É o mesmo desenho do shader do hero (src/gl/cenario.js), feito sem WebGL: um campo de
// ruído amostrado numa grade, com as linhas de nível achadas por "marching squares".
// Escala, velocidade e número de níveis são os mesmos de lá.

const CELULA = 14;        // tamanho da célula da grade, em px de tela
const ESCALA = 1.25;      // zoom do ruído (igual ao hero)
const NIVEIS = 3.6;       // o campo vai de -3.6 a 3.6 e há uma linha em cada inteiro
const VEL_X = 0.014;
const VEL_Y = -0.009;
const QUADROS = 30;       // o desenho anda devagar: 30 por segundo sobra

// ───────────── ruído simplex 2D ─────────────
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const GRAD = [1, 1, -1, 1, 1, -1, -1, -1, 1, 0, -1, 0, 0, 1, 0, -1];
const PERM = new Uint8Array(512);
(() => {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = 20260929;
  for (let i = 255; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
})();

function ruido(x, y) {
  const s = (x + y) * F2;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  const t = (i + j) * G2;
  const x0 = x - (i - t);
  const y0 = y - (j - t);
  const i1 = x0 > y0 ? 1 : 0;
  const j1 = x0 > y0 ? 0 : 1;
  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2;
  const y2 = y0 - 1 + 2 * G2;
  const ii = i & 255;
  const jj = j & 255;
  let n = 0;
  let a = 0.5 - x0 * x0 - y0 * y0;
  if (a > 0) {
    const g = (PERM[ii + PERM[jj]] & 7) * 2;
    a *= a;
    n += a * a * (GRAD[g] * x0 + GRAD[g + 1] * y0);
  }
  a = 0.5 - x1 * x1 - y1 * y1;
  if (a > 0) {
    const g = (PERM[ii + i1 + PERM[jj + j1]] & 7) * 2;
    a *= a;
    n += a * a * (GRAD[g] * x1 + GRAD[g + 1] * y1);
  }
  a = 0.5 - x2 * x2 - y2 * y2;
  if (a > 0) {
    const g = (PERM[ii + 1 + PERM[jj + 1]] & 7) * 2;
    a *= a;
    n += a * a * (GRAD[g] * x2 + GRAD[g + 1] * y2);
  }
  return 70 * n;
}

export function criarFundo(canvas, { parado = false } = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { parar() {} };

  let larg = 0;
  let alt = 0;
  let colunas = 0;
  let linhas = 0;
  let campo = new Float32Array(0);
  let tinta = null;
  let quadro = 0;
  let ultimo = 0;
  let vivo = true;
  const inicio = performance.now();
  const mouse = { x: 0, y: 0, alvoX: 0, alvoY: 0 };

  function medir() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    larg = canvas.clientWidth || window.innerWidth;
    alt = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(larg * dpr);
    canvas.height = Math.round(alt * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    colunas = Math.ceil(larg / CELULA) + 1;
    linhas = Math.ceil(alt / CELULA) + 1;
    campo = new Float32Array(colunas * linhas);

    // mais luz no meio da tela, menos nas bordas
    const raio = Math.hypot(larg, alt) * 0.62;
    tinta = ctx.createRadialGradient(larg * 0.5, alt * 0.46, 0, larg * 0.5, alt * 0.46, raio);
    tinta.addColorStop(0, 'rgba(74, 222, 128, 0.17)');
    tinta.addColorStop(0.55, 'rgba(74, 222, 128, 0.085)');
    tinta.addColorStop(1, 'rgba(74, 222, 128, 0.03)');
  }

  function desenhar(t) {
    mouse.x += (mouse.alvoX - mouse.x) * 0.06;
    mouse.y += (mouse.alvoY - mouse.y) * 0.06;
    const dx = t * VEL_X + mouse.x * 0.04;
    const dy = t * VEL_Y + mouse.y * 0.04;
    const k = ESCALA / alt;

    for (let j = 0; j < linhas; j++) {
      const py = (j * CELULA - alt * 0.5) * k + dy;
      for (let i = 0; i < colunas; i++) {
        const px = (i * CELULA - larg * 0.5) * k + dx;
        campo[j * colunas + i] = ruido(px, py) * NIVEIS;
      }
    }

    ctx.clearRect(0, 0, larg, alt);
    ctx.beginPath();
    for (let j = 0; j < linhas - 1; j++) {
      const y0 = j * CELULA;
      const y1 = y0 + CELULA;
      for (let i = 0; i < colunas - 1; i++) {
        const a = campo[j * colunas + i];             // canto de cima, esquerda
        const b = campo[j * colunas + i + 1];         // cima, direita
        const c = campo[(j + 1) * colunas + i + 1];   // baixo, direita
        const d = campo[(j + 1) * colunas + i];       // baixo, esquerda
        const menor = Math.min(a, b, c, d);
        const maior = Math.max(a, b, c, d);
        const primeiro = Math.ceil(menor);
        if (primeiro > maior) continue;
        const x0 = i * CELULA;
        const x1 = x0 + CELULA;
        for (let nivel = primeiro; nivel <= maior; nivel++) {
          const caso = (a > nivel ? 8 : 0) | (b > nivel ? 4 : 0) | (c > nivel ? 2 : 0) | (d > nivel ? 1 : 0);
          if (caso === 0 || caso === 15) continue;
          // ponto de cruzamento em cada lado da célula
          const cimaX = x0 + CELULA * ((nivel - a) / (b - a));
          const dirY = y0 + CELULA * ((nivel - b) / (c - b));
          const baixoX = x0 + CELULA * ((nivel - d) / (c - d));
          const esqY = y0 + CELULA * ((nivel - a) / (d - a));
          switch (caso) {
            case 1: case 14: ctx.moveTo(x0, esqY); ctx.lineTo(baixoX, y1); break;
            case 2: case 13: ctx.moveTo(baixoX, y1); ctx.lineTo(x1, dirY); break;
            case 3: case 12: ctx.moveTo(x0, esqY); ctx.lineTo(x1, dirY); break;
            case 4: case 11: ctx.moveTo(cimaX, y0); ctx.lineTo(x1, dirY); break;
            case 6: case 9: ctx.moveTo(cimaX, y0); ctx.lineTo(baixoX, y1); break;
            case 7: case 8: ctx.moveTo(x0, esqY); ctx.lineTo(cimaX, y0); break;
            case 5:
              ctx.moveTo(x0, esqY); ctx.lineTo(cimaX, y0);
              ctx.moveTo(baixoX, y1); ctx.lineTo(x1, dirY);
              break;
            case 10:
              ctx.moveTo(x0, esqY); ctx.lineTo(baixoX, y1);
              ctx.moveTo(cimaX, y0); ctx.lineTo(x1, dirY);
              break;
            default:
          }
        }
      }
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = tinta;
    ctx.stroke();
  }

  function laco(agora) {
    if (!vivo) return;
    quadro = requestAnimationFrame(laco);
    if (agora - ultimo < 1000 / QUADROS - 2) return;
    ultimo = agora;
    desenhar((agora - inicio) / 1000);
  }

  function ligar() {
    cancelAnimationFrame(quadro);
    if (parado || document.hidden) return;
    quadro = requestAnimationFrame(laco);
  }

  const aoMedir = () => {
    medir();
    desenhar(parado ? 12 : (performance.now() - inicio) / 1000);
  };
  const aoMexer = (e) => {
    mouse.alvoX = e.clientX / window.innerWidth - 0.5;
    mouse.alvoY = 0.5 - e.clientY / window.innerHeight;
  };
  const aoEsconder = () => ligar();

  let espera = 0;
  const aoRedimensionar = () => {
    clearTimeout(espera);
    espera = setTimeout(aoMedir, 120);
  };

  window.addEventListener('resize', aoRedimensionar);
  document.addEventListener('visibilitychange', aoEsconder);
  if (!parado) window.addEventListener('pointermove', aoMexer, { passive: true });

  aoMedir();
  ligar();
  canvas.classList.add('ct-fundo-pronto');

  return {
    parar() {
      vivo = false;
      cancelAnimationFrame(quadro);
      window.removeEventListener('resize', aoRedimensionar);
      window.removeEventListener('pointermove', aoMexer);
      document.removeEventListener('visibilitychange', aoEsconder);
    },
  };
}
