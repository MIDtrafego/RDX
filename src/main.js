// Hero do RDX.
//   servidor (fixo, é a "pessoa" da cena)
//   terminal em holograma (malha 3D) flutuando na frente
//   o mouse revela o terminal real operando, com uma máscara de fluido
//
// ?painel=mockup abre a versão anterior, feita com a imagem do mockup, para comparar.
import * as THREE from 'three';
import { gsap } from 'gsap';
import { Fluido } from './gl/fluido.js';
import { criarFundo } from './gl/cenario.js';
import { criarServidor3D } from './gl/servidor3d.js';
import { iniciarSaida } from './saida-hero.js';
import { iniciarMenu } from './menu/menu.js';

const DISTANCIA = 1500;     // distância da câmera: 1 unidade = 1 px no plano z = 0
const Z_PAINEL = 190;       // o terminal flutua na frente do servidor
const MOCKUP = new URLSearchParams(location.search).get('painel') === 'mockup';

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // os shaders já trabalham na cor final
renderer.setClearColor(0x050706, 1);

const cena = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 10, 6000);
camera.position.z = DISTANCIA;

const fluido = new Fluido(renderer);

// valores compartilhados entre os shaders
const comuns = {
  uTempo: { value: 0 },
  uResolucao: { value: new THREE.Vector2(1, 1) },
  uMouse: { value: new THREE.Vector2(0, 0) },
  uMascara: { value: fluido.textura },
  uVelocidade: { value: fluido.velocidade },
  uConstrucao: { value: 0 },
  uCurva: { value: 2500 },
  uRevelarTudo: { value: 0 },
};

const loader = new THREE.TextureLoader();
const fundo = criarFundo(comuns);
// o servidor é um objeto 3D: a imagem projetada sobre a geometria do gabinete
const servidor3d = criarServidor3D(loader, comuns, { distancia: DISTANCIA });
const servidor = servidor3d.objeto;
const palcoServidor = new THREE.Group();
palcoServidor.add(servidor);
const palcoPainel = new THREE.Group();
palcoPainel.position.z = Z_PAINEL;
cena.add(fundo, palcoServidor);

// ───────────── o que flutua na frente do servidor ─────────────
// Cada versão entrega: largura (para o enquadramento), escalar(), atualizar(dt), desenhar() e carregar()
let painel;

async function montarPainel() {
  if (MOCKUP) {
    const [{ PainelVivo, PAINEL }, { criarHolograma }] = await Promise.all([
      import('./gl/painel-vivo.js'),
      import('./gl/holograma.js'),
    ]);
    const vivo = new PainelVivo();
    const holo = criarHolograma({ texturaPainel: vivo.textura, comuns });
    palcoPainel.add(holo.grupo);
    cena.add(palcoPainel);
    let acum = 0;
    painel = {
      largura: PAINEL.w - 2 * PAINEL.margem,
      meiaLargura: PAINEL.w / 2,
      meiaAltura: PAINEL.h / 2,
      escalar(e) { holo.grupo.scale.setScalar(e); holo.alinhar(DISTANCIA, Z_PAINEL, e); },
      redimensionar() {},
      atualizar(dt) {
        acum += dt;
        if (acum >= 1 / 30) { vivo.atualizar(acum); acum = 0; }
      },
      desenhar() {},
      carregar: () => vivo.carregar('/img/painel-base.webp'),
      ciclos: (f) => { vivo.aoFecharVela = (n) => f(1284 + n); },
    };
  } else {
    const [{ Terminal, TERMINAL }, { Composicao }] = await Promise.all([
      import('./gl/terminal/terminal.js'),
      import('./gl/terminal/composicao.js'),
    ]);
    const terminal = new Terminal(comuns);
    const composicao = new Composicao(renderer, comuns);
    const cenaTerminal = new THREE.Scene();
    palcoPainel.add(terminal.grupo);
    cenaTerminal.add(palcoPainel);
    painel = {
      largura: TERMINAL.w,
      meiaLargura: TERMINAL.w / 2,
      meiaAltura: TERMINAL.h / 2,
      escalar(e) { terminal.grupo.scale.setScalar(e); },
      redimensionar(w, h) { composicao.redimensionar(w, h); },
      atualizar(dt) { terminal.atualizar(dt); },
      desenhar() { composicao.renderizar(cenaTerminal, camera, terminal); },
      carregar: () => terminal.carregar(),
      ciclos: (f) => {
        const anterior = terminal.mercado.aoFechar;
        terminal.mercado.aoFechar = (m) => { anterior && anterior(m); f(m.ciclos); };
      },
      terminal,
      composicao,
    };
  }
}

// ───────────── tamanho e enquadramento ─────────────
let L = 1, A = 1;
const arranjo = { servidor: 1, painel: 1 };

function redimensionar() {
  L = innerWidth;
  A = innerHeight;
  renderer.setSize(L, A, false);
  camera.aspect = L / A;
  camera.fov = (2 * Math.atan(A / 2 / DISTANCIA) * 180) / Math.PI;
  camera.updateProjectionMatrix();
  renderer.getDrawingBufferSize(comuns.uResolucao.value);
  fluido.redimensionar(L, A);
  comuns.uMascara.value = fluido.textura;
  comuns.uVelocidade.value = fluido.velocidade;

  const estreito = L < 768;

  // servidor: ocupa a altura da tela, como um retrato
  const altServidor = estreito ? Math.min(A * 0.66, L * 1.45) : Math.min(A * 0.90, L * 0.72);
  arranjo.servidor = altServidor / servidor3d.altura;
  servidor.scale.setScalar(arranjo.servidor);

  if (!painel) return;
  // painel: mais largo que o servidor, flutuando na frente
  const largPainel = estreito ? L * 0.94 : Math.min(L * 0.62, A * 1.12);
  const perspectiva = DISTANCIA / (DISTANCIA - Z_PAINEL);
  arranjo.painel = largPainel / painel.largura / perspectiva;
  painel.escalar(arranjo.painel);
  painel.redimensionar(comuns.uResolucao.value.x, comuns.uResolucao.value.y);
}
addEventListener('resize', redimensionar);

// ───────────── ponteiro ─────────────
const ponteiro = {
  x: 0.5, y: 0.5,          // posição em 0..1, origem embaixo à esquerda
  ax: 0.5, ay: 0.5,        // posição no quadro anterior
  nx: 0, ny: 0,            // -1..1, para o parallax
  moveu: false,
  ultimoToque: -10,
  usos: 0,
};

function aoMover(e) {
  ponteiro.x = e.clientX / L;
  ponteiro.y = 1 - e.clientY / A;
  ponteiro.nx = (e.clientX / L) * 2 - 1;
  ponteiro.ny = (e.clientY / A) * 2 - 1;
  if (!ponteiro.moveu) { ponteiro.ax = ponteiro.x; ponteiro.ay = ponteiro.y; }
  ponteiro.moveu = true;
  ponteiro.ultimoToque = comuns.uTempo.value;
  if (++ponteiro.usos === 40) document.querySelector('.dica')?.classList.add('some');
}
addEventListener('pointermove', aoMover, { passive: true });
addEventListener('pointerdown', aoMover, { passive: true });

// risca o fluido do ponto anterior até o atual, sem deixar buraco em movimento rápido
function riscar(x0, y0, x1, y1, tinta) {
  const dx = x1 - x0, dy = y1 - y0;
  const dist = Math.hypot(dx * (L / A), dy);
  if (dist < 0.0004) return;
  const passos = Math.min(8, Math.max(1, Math.ceil(dist / 0.018)));
  for (let i = 1; i <= passos; i++) {
    const t = i / passos;
    // a tinta tem teto, então cada pingo pode vir cheio: o miolo da pincelada sempre satura
    fluido.pingar(x0 + dx * t, y0 + dy * t, dx / passos, dy / passos, tinta);
  }
}

// piloto automático: enquanto ninguém mexe o mouse, a cena se revela sozinha
const piloto = { ligado: false, x: 0.5, y: 0.5, fase: 0 };
function pilotar(dt) {
  piloto.fase += dt;
  const f = piloto.fase;
  const alcanceX = Math.min(0.30, (arranjo.painel * painel.meiaLargura * 0.84) / L);
  const alcanceY = Math.min(0.30, (arranjo.painel * painel.meiaAltura * 0.72) / A);
  const x = 0.5 + alcanceX * Math.sin(f * 0.83) * Math.cos(f * 0.29);
  const y = 0.5 + alcanceY * Math.sin(f * 1.31 + 1.1);
  riscar(piloto.x, piloto.y, x, y, 0.9);
  piloto.x = x;
  piloto.y = y;
}

// ───────────── entrada ─────────────
const estado = { parallax: 0, flutua: 0 };

function entrada() {
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  servidor.position.y = -60;
  tl.to(fundo.material.uniforms.uEntrada, { value: 1, duration: 1.6, ease: 'power2.out' }, 0)
    .to(servidor3d.uniforms.uOpacidade, { value: 1, duration: 1.1 }, 0.15)
    .to(servidor.position, { y: 0, duration: 1.6, ease: 'expo.out' }, 0.15)
    .to(servidor3d.uniforms.uLigado, { value: 1, duration: 1.2, ease: 'power2.inOut' }, 0.7)
    .to(comuns.uConstrucao, { value: 1, duration: 2.0, ease: 'power2.inOut' }, 1.1)
    .to(estado, { parallax: 1, flutua: 1, duration: 1.6, ease: 'power2.out' }, 0.6)
    .call(() => { piloto.ligado = true; piloto.x = 0.5; piloto.y = 0.5; }, null, 2.5);
  return tl;
}

// ───────────── cartão de status ─────────────
const elCiclos = document.getElementById('st-ciclos');
const elLatencia = document.getElementById('st-latencia');
const milhar = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
if (elCiclos) elCiclos.textContent = milhar(1284);

// ───────────── rolagem ─────────────
// As seções avisam a posição da rolagem. O hero responde como no site de referência: o quadro
// encolhe, o holograma e o líquido saem, fica só o servidor, e a marca se escreve por cima.
// Quando o conjunto sai de vista, o hero para de desenhar.
const rolagem = { y: 0, saida: 0 };
const saida = iniciarSaida({ canvas });
const elTopo = document.querySelector('.topo');
const elHero = document.querySelector('.hero');

addEventListener('rdx:rolagem', (e) => {
  const d = e.detail;
  rolagem.y = d.y;
  rolagem.saida = Math.min(3, d.y / Math.max(1, innerHeight));
  if (elTopo) {
    elTopo.dataset.tema = d.tema || 'escuro';
    elTopo.dataset.temaBotoes = d.temaBotoes || 'escuro';
  }
});
// antes de as seções carregarem ninguém avisa a rolagem: ouve a janela também
addEventListener('scroll', () => { rolagem.y = scrollY; rolagem.saida = Math.min(3, scrollY / Math.max(1, innerHeight)); }, { passive: true });

// Encaixe provisório: enquanto as seções estão em construção, o HTML delas é lido de
// rolagem.html, para esta página acompanhar sozinha o que muda lá.
async function encaixarSecoes() {
  const alvo = document.getElementById('encaixe-secoes');
  if (!alvo) return null;
  const resposta = await fetch('/rolagem.html', { cache: 'no-store' });
  if (!resposta.ok) return null;
  const doc = new DOMParser().parseFromString(await resposta.text(), 'text/html');
  const secoes = doc.getElementById('secoes');
  if (!secoes) return null;
  alvo.replaceWith(document.importNode(secoes, true));
  const { iniciarSecoes } = await import('./secoes/secoes.js');
  return iniciarSecoes({ links: { cadastro: '/cadastro.html', login: '/entrar.html' } });
}

// ───────────── menu ─────────────
// O menu fecha e só depois a página rola. Com ele aberto, a rolagem suave fica parada.
const menu = iniciarMenu({
  botao: document.querySelector('.botao-menu'),
  aoNavegar: (id) => {
    const secoes = window.__rdx.secoes;
    if (secoes) secoes.rolarPara('#' + id);
    else document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  },
});
addEventListener('rdx:menu', (e) => {
  const lenis = window.__rdx.secoes && window.__rdx.secoes.lenis;
  if (!lenis) return;
  if (e.detail.aberto) lenis.stop();
  else lenis.start();
});

// ───────────── laço ─────────────
const relogio = new THREE.Clock();
const suave = { x: 0, y: 0 };
// para teste: com um número aqui, o relógio dos shaders para nesse instante
const depurar = { tempoFixo: null, revelar: null };

function quadro() {
  const dt = Math.min(relogio.getDelta(), 1 / 30);
  const naSaida = saida ? saida.atualizar(rolagem.y, performance.now() / 1000) : null;
  // os avisos do hero (cartão de status, dica) somem assim que a rolagem começa
  if (elHero) elHero.style.opacity = Math.max(0, 1 - rolagem.saida * 5).toFixed(3);
  // hero fora de vista: não gasta placa de vídeo
  if (naSaida ? naSaida.fora : rolagem.saida > 1.25) {
    requestAnimationFrame(quadro);
    return;
  }
  // quanto do holograma e do líquido ainda aparece: somem logo no começo da rolagem
  const presenca = 1 - Math.min(1, rolagem.saida / 0.45);
  const t = (comuns.uTempo.value = depurar.tempoFixo ?? comuns.uTempo.value + dt);

  // ponteiro no fluido
  if (ponteiro.moveu && presenca > 0.5) {
    riscar(ponteiro.ax, ponteiro.ay, ponteiro.x, ponteiro.y, 1.0);
    ponteiro.ax = ponteiro.x;
    ponteiro.ay = ponteiro.y;
  }
  const parado = t - ponteiro.ultimoToque > 2.2;
  if (piloto.ligado && parado && painel && presenca > 0.5) pilotar(dt);
  else { piloto.x = ponteiro.x; piloto.y = ponteiro.y; }

  fluido.passo(dt);
  comuns.uMascara.value = fluido.textura;
  comuns.uVelocidade.value = fluido.velocidade;

  if (painel) painel.atualizar(dt);

  // parallax: cada camada responde um pouco diferente ao mouse, o que cria profundidade
  const k = 1 - Math.exp(-dt * 4.2);
  suave.x += (ponteiro.nx - suave.x) * k;
  suave.y += (ponteiro.ny - suave.y) * k;
  comuns.uMouse.value.set(suave.x, -suave.y);
  const p = estado.parallax;
  const sobe = Math.sin(t * 0.9) * estado.flutua;

  // o giro é do próprio servidor, que já suaviza: recebe o ponteiro cru
  servidor3d.girar(ponteiro.nx * p, ponteiro.ny * p);
  servidor3d.atualizar(dt);
  palcoServidor.position.x = -suave.x * 10 * p;
  palcoServidor.position.y = suave.y * 6 * p + sobe * 7;

  palcoPainel.rotation.y = suave.x * 0.34 * p + Math.sin(t * 0.37) * 0.045;
  palcoPainel.rotation.x = suave.y * 0.19 * p + Math.cos(t * 0.29) * 0.025;
  palcoPainel.position.x = suave.x * 26 * p;
  palcoPainel.position.y = -suave.y * 16 * p + Math.sin(t * 0.9 + 1.2) * 9 * estado.flutua;

  if (depurar.revelar === null) comuns.uRevelarTudo.value = 0;
  fundo.material.uniforms.uLiquido.value = presenca;

  renderer.setRenderTarget(null);
  renderer.render(cena, camera);
  if (painel && presenca > 0.001) {
    if (painel.composicao) painel.composicao.compor.uniforms.uOpacidade.value = presenca;
    painel.desenhar();
  }
  requestAnimationFrame(quadro);
}

// ───────────── partida ─────────────
redimensionar();
requestAnimationFrame(quadro);

montarPainel()
  .then(() => {
    redimensionar();
    painel.ciclos((n) => {
      if (elCiclos) elCiclos.textContent = milhar(n);
      if (elLatencia) elLatencia.textContent = (3.0 + Math.random() * 0.5).toFixed(1) + 'ms';
    });
    return painel.carregar();
  })
  .then(() => entrada())
  .then(() => encaixarSecoes())
  .then((secoes) => { window.__rdx.secoes = secoes; })
  .catch((erro) => console.error('[rdx] falha ao montar a página', erro));

// acesso para depuração e testes automáticos
window.__rdx = { renderer, cena, camera, fluido, comuns, ponteiro, piloto, estado, servidor, servidor3d, fundo, riscar, palcoPainel, depurar, menu, get painel() { return painel; } };
