// O terminal do hero, replicado dentro do menu: mesmo objeto 3D (src/gl/terminal), com vidro,
// grade, velas com volume, média em tubo, cartões e brilho, já revelado por inteiro e girando
// devagar. Tem renderer próprio e só desenha enquanto o menu está aberto.
import * as THREE from 'three';
import { Terminal, TERMINAL } from '../gl/terminal/terminal.js';
import { Composicao } from '../gl/terminal/composicao.js';

const DISTANCIA = 1500;   // mesma câmera do hero: 1 unidade = 1 px no plano z = 0

export function iniciarGrafico3D(caixa) {
  const canvas = caixa.querySelector('canvas') || caixa.appendChild(document.createElement('canvas'));
  let renderer = null;
  let cena, camera, palco, terminal, composicao, relogio, quadro = null;
  const mira = { x: 0, y: 0 };
  const suave = { x: 0, y: 0 };

  // sem fluido aqui: a máscara é um pixel preto e a revelação fica ligada o tempo todo
  const mascara = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  mascara.needsUpdate = true;
  const comuns = {
    uTempo: { value: 0 },
    uConstrucao: { value: 1 },
    uCurva: { value: 2500 },
    uMascara: { value: mascara },
    uVelocidade: { value: mascara },
    uRevelarTudo: { value: 1 },
    uResolucao: { value: new THREE.Vector2(1, 1) },
  };

  function montar() {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setClearColor(0x000000, 0);

    cena = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(30, 1, 10, 6000);
    camera.position.z = DISTANCIA;

    terminal = new Terminal(comuns);
    palco = new THREE.Group();
    palco.add(terminal.grupo);
    cena.add(palco);
    composicao = new Composicao(renderer, comuns);
    composicao.escala = 1;
    composicao.amostras = 2;
    terminal.carregar();

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
    // o terminal (1200 x 780) cabe no quadro com folga para o giro
    const largura = Math.min(w, (h * TERMINAL.w) / TERMINAL.h) / 1.12;
    const escala = largura / TERMINAL.w;
    terminal.grupo.scale.setScalar(escala);
    const altura = (TERMINAL.h * escala) * (h / (largura * TERMINAL.h / TERMINAL.w));
    camera.fov = (2 * Math.atan(altura / 2 / DISTANCIA) * 180) / Math.PI;
    camera.updateProjectionMatrix();
    renderer.getDrawingBufferSize(comuns.uResolucao.value);
    composicao.redimensionar(comuns.uResolucao.value.x, comuns.uResolucao.value.y);
  }

  function desenhar() {
    const dt = Math.min(relogio.getDelta(), 1 / 30);
    const t = (comuns.uTempo.value += dt);
    terminal.atualizar(dt);

    const k = 1 - Math.exp(-dt * 4);
    suave.x += (mira.x - suave.x) * k;
    suave.y += (mira.y - suave.y) * k;
    palco.rotation.y = -0.16 + Math.sin(t * 0.3) * 0.06 + suave.x * 0.32;
    palco.rotation.x = 0.06 + Math.cos(t * 0.23) * 0.03 + suave.y * 0.18;
    palco.position.y = Math.sin(t * 0.8) * 6;

    renderer.setRenderTarget(null);
    renderer.clear();
    composicao.renderizar(cena, camera, terminal);
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
