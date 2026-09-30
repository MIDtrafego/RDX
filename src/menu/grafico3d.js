// Gráfico de velas em 3D para o menu. Usa o mesmo mercado simulado e as mesmas peças do
// terminal do hero, numa cena própria, pequena, que só desenha enquanto o menu está aberto.
import * as THREE from 'three';
import { Mercado } from '../gl/mercado.js';
import { Caixas } from '../gl/terminal/pecas.js';

const VISIVEIS = 34;
const PASSO = 15;
const ALTURA = 210;            // faixa vertical do preço, em unidades
const CHAO = -125;

const COR = {
  alta: [0.12, 0.91, 0.97],
  baixa: [0.80, 0.97, 0.18],
  volume: [0.12, 0.62, 0.52],
  grade: [0.20, 0.55, 0.45],
};

export function iniciarGrafico3D(caixa) {
  const canvas = caixa.querySelector('canvas') || caixa.appendChild(document.createElement('canvas'));
  let renderer = null;
  let cena, camera, grupo, velas, volume, mercado, relogio, quadro = null;
  const comuns = { uTempo: { value: 0 }, uConstrucao: { value: 1 }, uCurva: { value: 1e7 } };
  const mira = { x: 0, y: 0 };
  const suave = { x: 0, y: 0 };
  let min = 0, max = 1;

  function montar() {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setClearColor(0x000000, 0);

    cena = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(30, 1, 10, 4000);
    camera.position.set(0, 70, 600);
    camera.lookAt(0, 8, 0);

    grupo = new THREE.Group();
    cena.add(grupo);

    mercado = new Mercado({ visiveis: VISIVEIS, duracaoVela: 1.1 });
    velas = new Caixas(VISIVEIS * 2 + 4, comuns, { opaco: true });
    volume = new Caixas(VISIVEIS + 2, comuns, { opaco: false });
    grupo.add(velas.objeto, volume.objeto);

    // piso em grade, como a mesa onde o gráfico está apoiado
    const pts = [];
    const meia = ((VISIVEIS + 1) * PASSO) / 2;
    for (let i = 0; i <= 12; i++) {
      const x = -meia + (i / 12) * meia * 2;
      pts.push(x, CHAO - 6, -60, x, CHAO - 6, 60);
    }
    for (let j = 0; j <= 4; j++) {
      const z = -60 + (j / 4) * 120;
      pts.push(-meia, CHAO - 6, z, meia, CHAO - 6, z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const piso = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: new THREE.Color(...COR.grade), transparent: true, opacity: 0.35 }));
    grupo.add(piso);

    relogio = new THREE.Clock();
    caixa.addEventListener('pointermove', (e) => {
      const r = caixa.getBoundingClientRect();
      mira.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      mira.y = ((e.clientY - r.top) / r.height) * 2 - 1;
    });
    caixa.addEventListener('pointerleave', () => { mira.x = 0; mira.y = 0; });
  }

  function redimensionar() {
    const w = caixa.clientWidth, h = caixa.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  const y = (preco) => CHAO + 30 + ((preco - min) / (max - min)) * ALTURA;

  function desenhar() {
    const dt = Math.min(relogio.getDelta(), 1 / 30);
    comuns.uTempo.value += dt;
    mercado.atualizar(dt);
    const lista = mercado.visiveisAgora;
    const n = lista.length;

    let lo = Infinity, hi = -Infinity;
    for (const v of lista) { if (v.l < lo) lo = v.l; if (v.h > hi) hi = v.h; }
    const folga = (hi - lo) * 0.08 + 40;
    const s = Math.min(1, dt * 2.5);
    min = min ? min + (lo - folga - min) * s : lo - folga;
    max = max > 1 ? max + (hi + folga - max) * s : hi + folga;

    const dx = (1 - mercado.avanco) * PASSO;
    const x0 = -((n - 1) * PASSO) / 2;
    velas.limpar();
    volume.limpar();
    for (let i = 0; i < n; i++) {
      const v = lista[i];
      const x = x0 + i * PASSO + dx;
      const fade = Math.min(1, (x - x0 + PASSO) / (PASSO * 2));
      const alta = v.c >= v.o;
      const cor = alta ? COR.alta : COR.baixa;
      const yo = y(v.o), yc = y(v.c), yh = y(v.h), yl = y(v.l);
      const brilho = i === n - 1 ? 1.2 + 0.25 * Math.sin(comuns.uTempo.value * 7) : 0.95;
      velas.por(x, (yo + yc) / 2, 0, 8.6 * fade, Math.max(2.5, Math.abs(yc - yo)), 12 * fade, cor, brilho, 1);
      velas.por(x, (yh + yl) / 2, 0, 2 * fade, Math.max(1, yh - yl), 2, cor, brilho * 0.9, 1);
      const alt = Math.min(1.3, v.v) * 34;
      volume.por(x, CHAO + alt / 2, 0, 9.4 * fade, alt, 10, COR.volume, 1.0, 0.7);
    }
    velas.enviar();
    volume.enviar();

    // gira devagar sozinho e acompanha o mouse por cima do gráfico
    const k = 1 - Math.exp(-dt * 4);
    suave.x += (mira.x - suave.x) * k;
    suave.y += (mira.y - suave.y) * k;
    grupo.rotation.y = -0.42 + Math.sin(comuns.uTempo.value * 0.25) * 0.12 + suave.x * 0.35;
    grupo.rotation.x = 0.10 + suave.y * 0.12;

    renderer.render(cena, camera);
    quadro = requestAnimationFrame(desenhar);
  }

  return {
    ligar() {
      if (!renderer) montar();
      redimensionar();
      relogio.getDelta();
      if (quadro === null) quadro = requestAnimationFrame(desenhar);
    },
    desligar() {
      if (quadro !== null) cancelAnimationFrame(quadro);
      quadro = null;
    },
    redimensionar() { if (renderer) redimensionar(); },
  };
}
