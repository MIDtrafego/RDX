// Página de teste do servidor 3D (servidor.html).
// Cena mínima com a MESMA câmera do hero, o servidor no centro e um painel de depuração:
// trocar entre a imagem chapada antiga e o 3D novo, ver a malha em arame e travar o giro.
//
// Pela URL, para os testes automáticos:
//   ?modo=imagem | 3d     ?arame=1     ?extras=0     ?g=10&a=-4 (trava o giro, em graus)
//   ?t=12.5 (para o relógio dos shaders nesse instante)     ?painel=0 (esconde o painel)
//   ?forca=0 (desliga a animação das luzes, para comparar só a geometria)
import * as THREE from 'three';
import { criarServidor } from './cenario.js';
import { criarServidor3D } from './servidor3d.js';

const DISTANCIA = 1500;     // igual ao hero: 1 unidade = 1 px no plano z = 0
const url = new URLSearchParams(location.search);

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setClearColor(0x050706, 1);

const cena = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 10, 6000);
camera.position.z = DISTANCIA;

// o servidor não usa o fluido, mas o contrato traz os cinco valores
const vazio = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
vazio.needsUpdate = true;
const comuns = {
  uTempo: { value: 0 },
  uResolucao: { value: new THREE.Vector2(1, 1) },
  uMouse: { value: new THREE.Vector2(0, 0) },
  uMascara: { value: vazio },
  uVelocidade: { value: vazio },
};

const loader = new THREE.TextureLoader();
const antigo = criarServidor(loader, comuns);
antigo.material.uniforms.uOpacidade.value = 1;
antigo.material.uniforms.uLigado.value = 1;
antigo.visible = false;

const novo = criarServidor3D(loader, comuns, { distancia: DISTANCIA });
novo.uniforms.uOpacidade.value = 1;
novo.uniforms.uLigado.value = 1;

const palco = new THREE.Group();
palco.add(antigo, novo.objeto);
cena.add(palco);

// ───────────── tamanho: a mesma conta do hero ─────────────
let L = 1, A = 1;
function redimensionar() {
  L = innerWidth;
  A = innerHeight;
  renderer.setSize(L, A, false);
  camera.aspect = L / A;
  camera.fov = (2 * Math.atan(A / 2 / DISTANCIA) * 180) / Math.PI;
  camera.updateProjectionMatrix();
  renderer.getDrawingBufferSize(comuns.uResolucao.value);
  const estreito = L < 768;
  const altServidor = estreito ? Math.min(A * 0.66, L * 1.45) : Math.min(A * 0.90, L * 0.72);
  antigo.scale.setScalar(altServidor / 1182);
  novo.objeto.scale.setScalar(altServidor / novo.altura);
}
addEventListener('resize', redimensionar);

// ───────────── ponteiro ─────────────
const ponteiro = { nx: 0, ny: 0 };
addEventListener('pointermove', (e) => {
  ponteiro.nx = (e.clientX / L) * 2 - 1;
  ponteiro.ny = (e.clientY / A) * 2 - 1;
}, { passive: true });

// ───────────── painel ─────────────
const el = (id) => document.getElementById(id);
const estado = {
  modo: url.get('modo') === 'imagem' ? 'imagem' : '3d',
  arame: url.get('arame') === '1',
  extras: url.get('extras') !== '0',
  travar: url.has('g') || url.has('a'),
  guinada: Number(url.get('g')) || 0,
  arfagem: Number(url.get('a')) || 0,
  tempoFixo: url.has('t') ? Number(url.get('t')) : null,
  forca: url.has('forca') ? Number(url.get('forca')) : 1,
};
if (url.get('painel') === '0') el('painel').classList.add('escondido');

function aplicar() {
  antigo.visible = estado.modo === 'imagem';
  novo.objeto.visible = estado.modo === '3d';
  novo.depurar.arame(estado.arame);
  novo.depurar.extras(estado.extras);
  novo.depurar.forca(estado.arame ? estado.forca * 0.4 : estado.forca);
  antigo.material.uniforms.uForca.value = estado.forca;
  if (estado.travar) novo.depurar.travar(estado.guinada, estado.arfagem);
  else novo.depurar.soltar();
  document.querySelectorAll('input[name=modo]').forEach((r) => { r.checked = r.value === estado.modo; });
  el('arame').checked = estado.arame;
  el('extras').checked = estado.extras;
  el('travar').checked = estado.travar;
  el('guinada').value = estado.guinada;
  el('arfagem').value = estado.arfagem;
  el('v-guinada').textContent = estado.guinada + '°';
  el('v-arfagem').textContent = estado.arfagem + '°';
}
document.querySelectorAll('input[name=modo]').forEach((r) => r.addEventListener('change', () => { estado.modo = r.value; aplicar(); }));
el('arame').addEventListener('change', (e) => { estado.arame = e.target.checked; aplicar(); });
el('extras').addEventListener('change', (e) => { estado.extras = e.target.checked; aplicar(); });
el('travar').addEventListener('change', (e) => { estado.travar = e.target.checked; aplicar(); });
for (const eixo of ['guinada', 'arfagem']) {
  el(eixo).addEventListener('input', (e) => { estado[eixo] = Number(e.target.value); estado.travar = true; aplicar(); });
}

// ───────────── laço ─────────────
const relogio = new THREE.Clock();
const suave = { x: 0, y: 0 };
const medida = { quadros: 0, desde: performance.now(), qps: 0 };

function quadro() {
  const dt = Math.min(relogio.getDelta(), 1 / 30);
  comuns.uTempo.value = estado.tempoFixo ?? comuns.uTempo.value + dt;

  novo.girar(ponteiro.nx, ponteiro.ny);
  novo.atualizar(dt);

  // a imagem antiga, como está hoje no hero
  const k = 1 - Math.exp(-dt * 4.2);
  suave.x += (ponteiro.nx - suave.x) * k;
  suave.y += (ponteiro.ny - suave.y) * k;
  const travada = estado.travar && estado.modo === 'imagem';
  antigo.rotation.y = travada ? 0 : suave.x * 0.045;
  antigo.rotation.x = travada ? 0 : suave.y * 0.030;

  renderer.render(cena, camera);

  medida.quadros++;
  const agora = performance.now();
  if (agora - medida.desde >= 1000) {
    medida.qps = (medida.quadros * 1000) / (agora - medida.desde);
    medida.quadros = 0;
    medida.desde = agora;
    const ang = novo.depurar.angulo;
    el('leitura').textContent = medida.qps.toFixed(0) + ' qps · giro ' + ang.guinada.toFixed(1) + '° / ' + ang.arfagem.toFixed(1) + '°';
  }
  requestAnimationFrame(quadro);
}

redimensionar();
aplicar();
requestAnimationFrame(quadro);

// acesso para os testes automáticos
window.__srv = {
  renderer, cena, camera, comuns, antigo, novo, estado, aplicar, medida,
  pronto: () => [novo.depurar.malha.material.uniforms, antigo.material.uniforms]
    .every((u) => ['uMapa', 'uLuz', 'uBrilho', 'uRelevo'].every((n) => !u[n] || (u[n].value.image && u[n].value.image.width > 0))),
};
