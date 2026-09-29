// O servidor em 3D de verdade, feito com a própria imagem.
//
// A imagem do servidor é projetada sobre uma malha com a forma do gabinete. Cada vértice da malha
// fica preso no raio da câmera que passa pelo pixel dele, e o que muda é só a profundidade:
//   as três faces visíveis (direita, esquerda e a de baixo) são três planos que se cruzam
//   exatamente em cima das arestas medidas na imagem, e o mapa de relevo afunda a janela do
//   cilindro de vidro e salta a barra de luz.
// Como nenhum vértice sai do raio dele, visto de frente o objeto é idêntico à imagem. Ao girar,
// cada face anda como face de verdade.
//
// As medidas vêm de ferramentas/medir-servidor.py (bloco MEDIDAS, colado aqui embaixo).
import * as THREE from 'three';

const LARGURA = 920;
const ALTURA = 1182;

// Espaço de referência: x para a direita, y para cima, origem no centro da imagem, 1 unidade = 1 px
// no plano z = 0, câmera em (0, 0, f). f é a câmera do site na janela de 1440 x 900.
const MEDIDAS = {
  f: 2188.89,
  centro: [16.62, -12.51, -82.05],
  planos: {
    direita: { n: [0.662444, 0.249041, 0.706503], c: 260.387 },
    esquerda: { n: [-0.698888, 0.211504, 0.683243], c: 297.403 },
    baixo: { n: [-0.058001, -0.942251, 0.329846], c: 478.266 },
  },
  cantos: {
    CB: [-26.86, -327.66, 509.24], T: [-45.12, 506.13, 232.45],
    BL: [-402.03, -428.03, 156.54], BR: [404.8, -477.43, 157.3],
    TR: [479.5, 467.96, -245.99], TL: [-458.39, 466.43, -177.99],
    BF: [114.84, -735.73, -631.55], TF: [66.23, 428.26, -656.44],
  },
};

// limite do giro, em graus. Além disso a lateral escondida começaria a aparecer
const LIMITE_GUINADA = 14;
const LIMITE_ARFAGEM = 8;
// balanço sozinho, bem pequeno, para o gabinete não ficar parado quando o mouse para
const BALANCO_GUINADA = 1.1;
const BALANCO_ARFAGEM = 0.5;
const RAD = Math.PI / 180;

function imagem(loader, url) {
  const t = loader.load(url);
  t.premultiplyAlpha = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  return t;
}

function mapa(loader, url) {
  const t = loader.load(url);
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}

// ───────────── vértice: do pixel da imagem para o ponto no gabinete ─────────────
const VERTICE = /* glsl */ `
  uniform float uF;           // distância da câmera de referência
  uniform float uK;           // profundidade na cena / profundidade de referência
  uniform vec4 uPlanoD;       // xyz: normal   w: distância (normal . ponto = w)
  uniform vec4 uPlanoE;
  uniform vec4 uPlanoB;
  uniform vec3 uCentro;       // centro do gabinete, no espaço de referência
  uniform sampler2D uRelevo;  // r: relevo   g: quanto o metal brilha   b: vidro
  uniform float uRelevoForca;
  varying vec3 vRef;          // ponto no espaço de referência: dele sai a coordenada da textura
  varying vec3 vCena;         // ponto na cena, antes do giro: dele sai a normal

  // onde o raio entra no plano, já com o relevo afundando o plano
  float entrada(vec4 plano, vec3 dir, float fundo) {
    return (plano.w - fundo - plano.z * uF) / dot(plano.xyz, dir);
  }

  void main() {
    float fundo = (0.5019608 - texture2D(uRelevo, uv).r) * 255.0 * uRelevoForca;
    vec3 dir = vec3(position.xy, -uF);
    // o gabinete é convexo: o raio entra nele pelo plano mais distante dos três
    float t = max(entrada(uPlanoD, dir, fundo), max(entrada(uPlanoE, dir, fundo), entrada(uPlanoB, dir, fundo)));
    vec3 p = vec3(0.0, 0.0, uF) + dir * t;
    vRef = p;
    // com a câmera a outra distância, a profundidade é reescalada para a vista de frente não mudar
    vCena = vec3(p.xy - uCentro.xy, (p.z - uCentro.z) * uK);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(vCena, 1.0);
  }
`;

// ───────────── fragmento: a imagem projetada, as luzes vivas e o brilho do metal ─────────────
const FRAGMENTO = /* glsl */ `
  uniform sampler2D uMapa;
  uniform sampler2D uLuz;      // r: onde é luz   g: fase do LED   b: tipo (0 LED, 1 barra)
  uniform sampler2D uBrilho;   // cor das luzes, borrada
  uniform sampler2D uRelevo;
  uniform float uTempo;
  uniform float uOpacidade;
  uniform float uLigado;
  uniform float uForca;        // intensidade geral da animação das luzes
  uniform float uF;
  uniform float uK;
  uniform vec3 uCentro;
  uniform vec2 uTamanho;
  uniform mat3 uGiro;          // só o giro do mouse
  uniform float uGirando;      // 0 de frente, 1 girado
  uniform float uExtras;       // brilho do metal e sombra das paredes do relevo
  varying vec3 vRef;
  varying vec3 vCena;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  // liga e desliga em momentos sorteados, com a troca suavizada
  float atividade(float t, float fase) {
    float ritmo = 0.9 + 3.6 * fract(fase * 7.31);
    float tt = t * ritmo + fase * 97.0;
    float i = floor(tt);
    float f = fract(tt);
    float agora = step(0.42, hash(vec2(i, fase * 53.0)));
    float depois = step(0.42, hash(vec2(i + 1.0, fase * 53.0)));
    return mix(agora, depois, smoothstep(0.78, 1.0, f));
  }

  void main() {
    // projeção: a coordenada da textura é onde este ponto aparece visto de frente
    vec2 vUv = vRef.xy * (uF / (uF - vRef.z)) / uTamanho + 0.5;
    vec4 t = texture2D(uMapa, vUv);
    if (t.a < 0.004) discard;
    vec4 m = texture2D(uLuz, vUv);
    vec3 halo = texture2D(uBrilho, vUv).rgb;
    vec4 relevo = texture2D(uRelevo, vUv);
    float fase = m.g;
    float barra = smoothstep(0.4, 0.6, m.b);
    float y = 1.0 - vUv.y;

    // LED pequeno: uma parte fica acesa respirando, o resto pisca como disco trabalhando
    float fixo = step(fase, 0.28);
    float pisca = mix(atividade(uTempo, fase), 0.85 + 0.15 * sin(uTempo * 1.3 + fase * 40.0), fixo);
    // rajadas de dados descendo pelas colunas, cada coluna no seu tempo
    float coluna = hash(vec2(floor(vUv.x * 26.0), 3.0));
    float onda = fract(uTempo * (0.16 + coluna * 0.12) + coluna * 5.0) * 1.5 - 0.25;
    float rajada = exp(-pow((onda - y) * 11.0, 2.0));
    float led = mix(0.50, 1.10, pisca) + rajada * 0.75;

    // barra de luz: respira e é percorrida por um feixe
    float feixe = exp(-pow((fract(uTempo * 0.21 + fase) * 1.5 - 0.25 - y) * 8.0, 2.0));
    float grande = 0.93 + 0.07 * sin(uTempo * 1.7 + fase * 6.28) + feixe * 0.55;

    float ganho = mix(led, grande, barra);
    ganho = mix(1.0, ganho, uForca);

    float lumHalo = dot(halo, vec3(0.30, 0.60, 0.10));
    float peso = clamp(m.r + lumHalo * 1.7, 0.0, 1.0);

    vec3 c = t.rgb * mix(1.0, ganho, peso);
    c += halo * max(ganho - 1.0, 0.0) * 1.25 * t.a;

    // reflexo de luz que atravessa o metal de vez em quando
    float varre = fract(uTempo * 0.085) * 2.6 - 0.8;
    float reflexo = exp(-pow((vUv.x * 0.55 + y * 0.85 - varre) * 5.5, 2.0));
    c += t.rgb * reflexo * 0.30 * uForca;

    // ── o que só o 3D permite ──
    // normal da superfície (já com o relevo), tirada da própria malha
    vec3 n = normalize(cross(dFdx(vCena), dFdy(vCena)));
    vec3 ng = uGiro * n;
    float metal = relevo.g * uExtras;

    // o metal acende quando a face vira para a luz e apaga quando vira para longe. É a
    // diferença para a posição de frente: sem giro, a conta dá zero e a arte fica intacta
    const vec3 LUZ = vec3(0.0, 0.3303, 0.9439);
    float difusa = clamp(dot(ng, LUZ) - dot(n, LUZ), -0.5, 0.5);
    float espelho = pow(max(dot(ng, LUZ), 0.0), 14.0) - pow(max(dot(n, LUZ), 0.0), 14.0);
    c *= 1.0 + difusa * 0.8 * metal;
    c += (t.rgb * 1.7 + vec3(0.016, 0.028, 0.024) * t.a) * espelho * 1.1 * metal;
    // o vidro do cilindro pega um reflexo próprio, mais fino
    float vidro = relevo.b * uExtras;
    float fino = pow(max(dot(ng, LUZ), 0.0), 40.0) - pow(max(dot(n, LUZ), 0.0), 40.0);
    c += vec3(0.10, 0.22, 0.17) * fino * vidro * t.a;

    // parede do relevo (a lateral de dentro da janela): a textura ali é a beirada esticada,
    // então ela escurece, como o lado de dentro de uma moldura
    vec3 raio = normalize(vec3(vRef.xy, (vRef.z - uF) * uK));
    float rasante = abs(dot(n, raio));
    float parede = 1.0 - smoothstep(0.05, 0.30, rasante);
    c *= 1.0 - 0.72 * parede * uGirando * uExtras;

    c = max(c, 0.0);
    c *= mix(0.28, 1.0, uLigado);
    gl_FragColor = vec4(c, t.a) * uOpacidade;
  }
`;

const FRAGMENTO_ARAME = /* glsl */ `
  uniform float uOpacidade;
  varying vec3 vRef;
  varying vec3 vCena;
  void main() {
    // mais claro quanto mais perto da câmera, para dar leitura de profundidade
    float perto = clamp((vRef.z + 650.0) / 1200.0, 0.0, 1.0);
    vec3 cor = mix(vec3(0.05, 0.30, 0.20), vec3(0.45, 1.0, 0.62), perto);
    gl_FragColor = vec4(cor, 1.0) * 0.85 * uOpacidade;
  }
`;

// malha em grade sobre o retângulo da imagem
function grade(celula) {
  const nx = Math.round(LARGURA / celula);
  const ny = Math.round(ALTURA / celula);
  return new THREE.PlaneGeometry(LARGURA, ALTURA, nx, ny);
}

// ───────────── luz de contato embaixo do gabinete ─────────────
// Um plano paralelo à face de baixo, um pouco afastado, com uma poça de luz verde: as luzes de
// baixo do gabinete iluminando o ar. Gira junto.
function criarContato(comuns, uniformsBase) {
  const { cantos, planos, centro } = MEDIDAS;
  const base = ['CB', 'BL', 'BF', 'BR'].map((k) => new THREE.Vector3(...cantos[k]));
  const meio = base.reduce((s, v) => s.add(v), new THREE.Vector3()).multiplyScalar(0.25);
  const normal = new THREE.Vector3(...planos.baixo.n);
  const AFASTAR = 95;    // distância da face de baixo
  const ABRIR = 1.75;    // o plano é maior que a face
  const pos = [];
  for (const v of base) {
    const p = v.clone().sub(meio).multiplyScalar(ABRIR).add(meio).addScaledVector(normal, AFASTAR);
    pos.push(p.x - centro[0], p.y - centro[1], p.z - centro[2]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const mat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      uniform float uK;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xy, position.z * uK, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTempo;
      uniform float uOpacidade;
      uniform float uLigado;
      uniform float uContato;
      varying vec2 vUv;
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r2 = dot(p, p);
        float poca = exp(-r2 * 3.4) * (1.0 - smoothstep(0.55, 1.0, r2));
        float pulso = 0.86 + 0.14 * sin(uTempo * 1.1);
        vec3 cor = vec3(0.16, 0.62, 0.34) * poca * 0.30 * pulso;
        // soma luz, sem cobrir o fundo
        gl_FragColor = vec4(cor * uLigado * uOpacidade * uContato, 0.0);
      }
    `,
    uniforms: {
      uK: uniformsBase.uK,
      uTempo: comuns.uTempo,
      uOpacidade: uniformsBase.uOpacidade,
      uLigado: uniformsBase.uLigado,
      uContato: { value: 1 },
    },
    transparent: true,
    premultipliedAlpha: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const malha = new THREE.Mesh(geo, mat);
  malha.frustumCulled = false;
  malha.renderOrder = 20;
  return malha;
}

// ───────────── servidor ─────────────
// opcoes.distancia: distância da câmera do site até o plano z = 0 (DISTANCIA em main.js)
// opcoes.celula: tamanho da célula da malha, em px da imagem
export function criarServidor3D(loader, comuns, opcoes = {}) {
  const distancia = opcoes.distancia ?? 1500;
  const celula = opcoes.celula ?? 4;
  const plano = (p) => new THREE.Vector4(p.n[0], p.n[1], p.n[2], p.c);

  const uniforms = {
    uMapa: { value: imagem(loader, '/img/servidor.webp') },
    uLuz: { value: mapa(loader, '/img/servidor-luz.png') },
    uBrilho: { value: mapa(loader, '/img/servidor-brilho.webp') },
    uRelevo: { value: mapa(loader, '/img/servidor-relevo.png') },
    uTempo: comuns.uTempo,
    uOpacidade: { value: 0 },
    uLigado: { value: 0 },
    uForca: { value: 1 },
    uF: { value: MEDIDAS.f },
    uK: { value: 1 },
    uPlanoD: { value: plano(MEDIDAS.planos.direita) },
    uPlanoE: { value: plano(MEDIDAS.planos.esquerda) },
    uPlanoB: { value: plano(MEDIDAS.planos.baixo) },
    uCentro: { value: new THREE.Vector3(...MEDIDAS.centro) },
    uRelevoForca: { value: 1 },
    uTamanho: { value: new THREE.Vector2(LARGURA, ALTURA) },
    uGiro: { value: new THREE.Matrix3() },
    uGirando: { value: 0 },
    uExtras: { value: 1 },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: VERTICE,
    fragmentShader: FRAGMENTO,
    uniforms,
    transparent: true,
    premultipliedAlpha: true,
    depthTest: true,
    depthWrite: true,
    side: THREE.DoubleSide,
  });
  const malha = new THREE.Mesh(grade(celula), material);
  malha.frustumCulled = false;   // a posição real sai do shader
  malha.renderOrder = 22;

  const contato = criarContato(comuns, uniforms);

  // objeto: o hero escala e posiciona.   giro: só o giro do mouse, em volta do centro do gabinete
  const objeto = new THREE.Group();
  const giro = new THREE.Group();
  giro.add(contato, malha);
  objeto.add(giro);

  const alvo = { x: 0, y: 0 };
  const suave = { x: 0, y: 0 };
  let trava = null;        // { guinada, arfagem } em graus, para teste
  let arame = null;
  let fase = 0;
  const escala = new THREE.Vector3();
  const matriz = new THREE.Matrix4();
  // O gabinete da imagem é visto de baixo, então o "em pé" dele não é o eixo y da tela: é a
  // aresta do meio (do canto de baixo ao canto de cima). A guinada gira em volta dela, como um
  // prato giratório. Em volta do y da tela o gabinete parecia tombar de lado ao girar.
  const pe = new THREE.Vector3();
  const eixoX = new THREE.Vector3(1, 0, 0);
  const qGuinada = new THREE.Quaternion();
  const qArfagem = new THREE.Quaternion();
  const angulo = { guinada: 0, arfagem: 0 };

  function girar(x, y) {
    alvo.x = Math.max(-1, Math.min(1, x || 0));
    alvo.y = Math.max(-1, Math.min(1, y || 0));
  }

  function atualizar(dt) {
    // a que distância a câmera está, medida em unidades do objeto
    objeto.getWorldScale(escala);
    const d = distancia / Math.max(escala.y, 1e-4);
    const k = Math.max(0.6, Math.min(1.8, d / MEDIDAS.f));
    uniforms.uK.value = k;
    giro.position.set(MEDIDAS.centro[0], MEDIDAS.centro[1], MEDIDAS.centro[2] * k);

    const passo = 1 - Math.exp(-Math.min(dt, 0.1) * 3.6);
    suave.x += (alvo.x - suave.x) * passo;
    suave.y += (alvo.y - suave.y) * passo;
    fase += dt;

    // gabinete mais fundo (tela estreita) mostra a lateral escondida mais cedo: gira menos
    const folga = Math.min(1, 1 / k);
    let guinada, arfagem;
    if (trava) {
      guinada = trava.guinada;
      arfagem = trava.arfagem;
    } else {
      const vivo = uniforms.uLigado.value;
      guinada = (suave.x * LIMITE_GUINADA + Math.sin(fase * 0.31) * BALANCO_GUINADA * vivo) * folga;
      arfagem = (suave.y * LIMITE_ARFAGEM + Math.cos(fase * 0.23) * BALANCO_ARFAGEM * vivo) * folga;
    }
    const { T, CB } = MEDIDAS.cantos;
    pe.set(T[0] - CB[0], T[1] - CB[1], (T[2] - CB[2]) * k).normalize();
    qGuinada.setFromAxisAngle(pe, guinada * RAD);
    qArfagem.setFromAxisAngle(eixoX, arfagem * RAD);
    giro.quaternion.copy(qArfagem).multiply(qGuinada);
    angulo.guinada = guinada;
    angulo.arfagem = arfagem;
    uniforms.uGiro.value.setFromMatrix4(matriz.makeRotationFromQuaternion(giro.quaternion));
    uniforms.uGirando.value = Math.min(1, Math.hypot(guinada, arfagem) / 3);
  }

  // para a página de teste
  const depurar = {
    travar(guinada, arfagem) { trava = { guinada, arfagem }; },
    soltar() { trava = null; },
    forca(v) { uniforms.uForca.value = v; },
    extras(ligado) {
      uniforms.uExtras.value = ligado ? 1 : 0;
      contato.material.uniforms.uContato.value = ligado ? 1 : 0;
    },
    arame(ligado) {
      if (ligado && !arame) {
        arame = new THREE.Mesh(grade(20), new THREE.ShaderMaterial({
          vertexShader: VERTICE,
          fragmentShader: FRAGMENTO_ARAME,
          uniforms,
          transparent: true,
          premultipliedAlpha: true,
          depthTest: false,
          depthWrite: false,
          wireframe: true,
        }));
        arame.frustumCulled = false;
        arame.renderOrder = 23;
        giro.add(arame);
      }
      if (arame) arame.visible = ligado;
    },
    get angulo() { return { ...angulo }; },
    medidas: MEDIDAS,
    limites: { guinada: LIMITE_GUINADA, arfagem: LIMITE_ARFAGEM },
    giro,
    malha,
    contato,
  };

  atualizar(0);

  return {
    objeto,
    altura: ALTURA,
    uniforms: { uOpacidade: uniforms.uOpacidade, uLigado: uniforms.uLigado },
    girar,
    atualizar,
    depurar,
  };
}
