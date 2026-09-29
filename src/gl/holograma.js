// O PC em holograma: uma placa curva desenhada em malha (linhas), em três camadas de profundidade.
// Onde a máscara do fluido passa, a malha dá lugar ao painel real.
import * as THREE from 'three';
import { PAINEL, BLOCOS } from './painel-vivo.js';
import { CORTE_LIQUIDO } from './fluido.js';

const N = BLOCOS.length;

const CURVAR = /* glsl */ `
  uniform float uCurva;
  vec3 curvar(vec3 p) {
    float ang = p.x / uCurva;
    return vec3(sin(ang) * uCurva, p.y, p.z + (1.0 - cos(ang)) * uCurva);
  }
`;

const VERTICE = /* glsl */ `
  ${CURVAR}
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(curvar(position), 1.0);
  }
`;

const FRAGMENTO = /* glsl */ `
  #define N_BLOCOS ${N}
  #define CELULA 46.0

  uniform sampler2D uPainel;
  uniform sampler2D uMascara;
  uniform vec2 uResolucao;
  uniform vec2 uTamanho;
  uniform float uMargem;
  uniform float uRaio;
  uniform float uTempo;
  uniform float uConstrucao;
  uniform float uOpacidade;
  uniform vec4 uBlocos[N_BLOCOS];
  uniform float uRaios[N_BLOCOS];
  uniform float uPesoMalha;
  uniform float uPesoBlocos;
  uniform float uPesoBorda;
  uniform float uPesoReal;
  uniform float uPesoFantasma;
  uniform float uRevelarTudo;
  varying vec2 vUv;

  const vec3 VERDE = vec3(0.29, 0.87, 0.50);
  const vec3 CIANO = vec3(0.13, 0.89, 0.84);
  const vec3 LIMA  = vec3(0.80, 0.97, 0.18);

  ${CORTE_LIQUIDO}

  float sdCaixa(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // linha com espessura em px de tela, a partir de uma distância em px de textura
  float traco(float d, float espessura, float e) {
    float t = abs(d) / e;
    return 1.0 - smoothstep(espessura * 0.5, espessura * 0.5 + 1.0, t);
  }

  void main() {
    vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uTamanho;
    float e = max(length(vec2(dFdx(px.x), dFdy(px.x))), length(vec2(dFdx(px.y), dFdy(px.y))));
    e = max(e, 0.0001);

    // forma do painel
    vec2 centro = uTamanho * 0.5;
    float d = sdCaixa(px - centro, centro - uMargem, uRaio);
    float dentro = 1.0 - smoothstep(-e, e, d);

    // malha: quadros, diagonais e vértices
    vec2 g = (px - centro) / CELULA;
    vec2 dg = abs(fract(g - 0.5) - 0.5) * CELULA;
    float quadros = max(traco(dg.x, 1.0, e), traco(dg.y, 1.0, e));
    float dd = abs(fract(g.x + g.y - 0.5) - 0.5) * CELULA * 0.7071;
    float diagonais = traco(dd, 1.0, e);
    float vertices = 1.0 - smoothstep(1.4, 2.6, length(dg) / e);

    // blocos da interface
    float contorno = 0.0;
    float dentroBloco = 0.0;
    for (int i = 0; i < N_BLOCOS; i++) {
      float di = sdCaixa(px - uBlocos[i].xy, uBlocos[i].zw, uRaios[i]);
      contorno = max(contorno, traco(di, 1.5, e));
      dentroBloco = max(dentroBloco, 1.0 - smoothstep(-e, e, di));
    }

    // construção: a malha nasce do centro para fora, célula por célula
    float rr = length((vUv - 0.5) * vec2(1.25, 1.0));
    float vis = smoothstep(0.0, 0.16, uConstrucao * 1.5 - rr - hash(floor(g)) * 0.30);
    float frente = vis * (1.0 - vis) * 4.0;

    // vida do holograma
    float varre = exp(-pow((fract(uTempo * 0.10) * 1.6 - 0.3 - vUv.y) * 7.0, 2.0));
    float linhasTV = 0.90 + 0.10 * sin(gl_FragCoord.y * 1.1 - uTempo * 5.0);
    float pisca = 0.94 + 0.06 * sin(uTempo * 31.0) * sin(uTempo * 7.3);
    vec3 cor = mix(VERDE, CIANO, clamp(vUv.y * 0.7 + 0.15 + 0.2 * sin(uTempo * 0.5 + vUv.x * 3.0), 0.0, 1.0));

    float aMalha = (quadros * 0.26 + diagonais * 0.13 + vertices * 0.55) * mix(1.0, 0.30, dentroBloco) * uPesoMalha;
    float aBlocos = (contorno * 0.90 + dentroBloco * 0.05) * uPesoBlocos;
    float aBorda = (traco(d, 2.2, e) + traco(d + 33.0, 1.2, e) * 0.55) * uPesoBorda;
    float a = (aMalha + aBlocos) * dentro + aBorda;
    // a frente da construção acende as linhas por onde passa
    a *= (1.0 + varre * 1.7 + frente * 2.6) * linhasTV * pisca;

    // fantasma do conteúdo real, bem de leve, para o holograma "ler" como tela
    vec4 real = texture2D(uPainel, vUv);
    float lum = dot(real.rgb, vec3(0.30, 0.60, 0.10));
    float fantasma = smoothstep(0.22, 0.85, lum) * 0.20 * uPesoFantasma * dentro * linhasTV;

    // máscara do fluido, no espaço da tela
    float tinta = texture2D(uMascara, uvFluido(gl_FragCoord.xy / uResolucao)).r;
    // corte seco, de líquido, e não de fumaça
    float m = max(smoothstep(0.17, 0.25, tinta), uRevelarTudo) * vis;

    float aHolo = (a + fantasma) * vis * (1.0 - m);
    vec3 rgbHolo = cor * a + mix(cor, vec3(1.0), 0.25) * fantasma;
    rgbHolo *= vis * (1.0 - m);

    vec4 saida = vec4(rgbHolo, aHolo * 0.55);

    // painel real
    float forma = 1.0 - smoothstep(-2.0, 0.0, d + 1.0);
    vec4 r = real * forma * m * uPesoReal;
    saida = saida * (1.0 - r.a) + r;

    // energia na fronteira da revelação e brilho por fora do painel
    // fio de luz com largura fixa na tela, acompanhando o contorno do líquido
    float fio = 1.0 - smoothstep(0.8, 2.6, abs(tinta - 0.21) / max(fwidth(tinta), 0.0001));
    float faixa = smoothstep(0.13, 0.21, tinta) * (1.0 - smoothstep(0.21, 0.27, tinta));
    faixa = (fio * 0.85 + faixa * 0.16) * (1.0 - uRevelarTudo);
    float beira = smoothstep(0.0, 10.0, min(min(px.x, uTamanho.x - px.x), min(px.y, uTamanho.y - px.y)));
    float pertoDoPainel = 1.0 - smoothstep(0.0, 26.0, d);
    saida.rgb += mix(LIMA, CIANO, 0.35) * faixa * 0.80 * pertoDoPainel * beira * vis * uPesoReal;
    float halo = exp(-max(d, 0.0) / 13.0) * (1.0 - forma) * m * beira;
    saida.rgb += mix(VERDE, CIANO, 0.5) * halo * 0.55 * uPesoReal;

    gl_FragColor = saida * uOpacidade;
  }
`;

const VERTICE_LINHA = /* glsl */ `
  ${CURVAR}
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(curvar(position), 1.0);
  }
`;

const FRAGMENTO_LINHA = /* glsl */ `
  uniform sampler2D uMascara;
  uniform vec2 uResolucao;
  uniform float uConstrucao;
  uniform float uOpacidade;
  uniform float uRevelarTudo;
  ${CORTE_LIQUIDO}
  void main() {
    float tinta = texture2D(uMascara, uvFluido(gl_FragCoord.xy / uResolucao)).r;
    float m = max(smoothstep(0.17, 0.25, tinta), uRevelarTudo);
    float a = 0.34 * smoothstep(0.55, 1.0, uConstrucao) * (1.0 - m) * uOpacidade;
    gl_FragColor = vec4(vec3(0.20, 0.88, 0.66) * a, a * 0.5);
  }
`;

// pontos ao longo do contorno arredondado do painel
function contorno(w, h, raio, passo) {
  const pts = [];
  const hw = w / 2, hh = h / 2;
  const reta = (x0, y0, x1, y1) => {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / passo));
    for (let i = 0; i < n; i++) pts.push([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);
  };
  // quarto de círculo no sentido horário, a partir do ângulo a0
  const arco = (cx, cy, a0) => {
    for (let i = 0; i < 4; i++) {
      const a = a0 - (Math.PI / 2) * (i / 4);
      pts.push([cx + Math.cos(a) * raio, cy + Math.sin(a) * raio]);
    }
  };
  reta(-hw + raio, hh, hw - raio, hh);
  arco(hw - raio, hh - raio, Math.PI / 2);
  reta(hw, hh - raio, hw, -hh + raio);
  arco(hw - raio, -hh + raio, 0);
  reta(hw - raio, -hh, -hw + raio, -hh);
  arco(-hw + raio, -hh + raio, -Math.PI / 2);
  reta(-hw, -hh + raio, -hw, hh - raio);
  arco(-hw + raio, hh - raio, Math.PI);
  return pts;
}

export function criarHolograma({ texturaPainel, comuns }) {
  const grupo = new THREE.Group();

  // blocos no formato do shader: centro e meio-tamanho
  const blocos = BLOCOS.map(([x0, y0, x1, y1]) => new THREE.Vector4((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2));
  const raios = BLOCOS.map((b) => b[4]);

  const geo = new THREE.PlaneGeometry(PAINEL.w, PAINEL.h, 72, 1);

  const camada = (z, pesos, opacidade, ordem) => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERTICE,
      fragmentShader: FRAGMENTO,
      uniforms: {
        uPainel: { value: texturaPainel },
        uMascara: comuns.uMascara,
        uResolucao: comuns.uResolucao,
        uTempo: comuns.uTempo,
        uConstrucao: comuns.uConstrucao,
        uCurva: comuns.uCurva,
        uRevelarTudo: comuns.uRevelarTudo,
        uTamanho: { value: new THREE.Vector2(PAINEL.w, PAINEL.h) },
        uMargem: { value: PAINEL.margem },
        uRaio: { value: PAINEL.raio },
        uBlocos: { value: blocos },
        uRaios: { value: raios },
        uOpacidade: { value: opacidade },
        uPesoMalha: { value: pesos.malha },
        uPesoBlocos: { value: pesos.blocos },
        uPesoBorda: { value: pesos.borda },
        uPesoReal: { value: pesos.real },
        uPesoFantasma: { value: pesos.fantasma },
      },
      transparent: true,
      premultipliedAlpha: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const malha = new THREE.Mesh(geo, mat);
    malha.position.z = z;
    malha.userData.profundidade = z;
    malha.renderOrder = ordem;
    malha.frustumCulled = false;
    grupo.add(malha);
    return malha;
  };

  const PROF_TRAS = -54;
  const PROF_FRENTE = 30;

  const tras = camada(PROF_TRAS, { malha: 0.55, blocos: 0, borda: 0.8, real: 0, fantasma: 0 }, 0.55, 30);
  const frente = camada(PROF_FRENTE, { malha: 0, blocos: 1, borda: 0, real: 0, fantasma: 0 }, 0.9, 50);
  const base = camada(0, { malha: 1, blocos: 0.3, borda: 1, real: 1, fantasma: 1 }, 1, 60);

  // arestas que ligam a frente da placa à traseira: é o que dá volume quando ela gira
  const pts = contorno(PAINEL.w - 2 * PAINEL.margem, PAINEL.h - 2 * PAINEL.margem, PAINEL.raio, 92);
  const pos = [];
  for (const [x, y] of pts) pos.push(x, y, 0, x, y, PROF_TRAS);
  // pinos que sustentam a camada da frente nos cantos de cada bloco
  for (const [x0, y0, x1, y1] of BLOCOS) {
    for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) {
      const lx = x - PAINEL.w / 2, ly = PAINEL.h / 2 - y;
      pos.push(lx, ly, 0, lx, ly, PROF_FRENTE);
    }
  }
  const geoLinhas = new THREE.BufferGeometry();
  geoLinhas.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const linhas = new THREE.LineSegments(
    geoLinhas,
    new THREE.ShaderMaterial({
      vertexShader: VERTICE_LINHA,
      fragmentShader: FRAGMENTO_LINHA,
      uniforms: {
        uMascara: comuns.uMascara,
        uResolucao: comuns.uResolucao,
        uConstrucao: comuns.uConstrucao,
        uCurva: comuns.uCurva,
        uRevelarTudo: comuns.uRevelarTudo,
        uOpacidade: { value: 1 },
      },
      transparent: true,
      premultipliedAlpha: true,
      depthTest: false,
      depthWrite: false,
    })
  );
  linhas.renderOrder = 40;
  linhas.frustumCulled = false;
  grupo.add(linhas);

  // Camadas em profundidades diferentes aparecem em tamanhos diferentes por causa da perspectiva.
  // Isso desalinha os contornos do painel real. Aqui cada camada é reescalada para casar com a
  // base quando vista de frente: a diferença só aparece quando a placa gira, que é o efeito desejado.
  function alinhar(distanciaCamera, zGrupo, escalaGrupo) {
    const ate = distanciaCamera - zGrupo;
    for (const m of [tras, frente]) {
      const k = (ate - m.userData.profundidade * escalaGrupo) / ate;
      m.scale.set(k, k, 1);
    }
  }

  return { grupo, base, tras, frente, linhas, alinhar };
}
