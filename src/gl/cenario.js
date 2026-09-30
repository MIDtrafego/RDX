// O que fica atrás do holograma: o fundo animado e o servidor.
import * as THREE from 'three';
import { CORTE_LIQUIDO } from './fluido.js';

const RUIDO = /* glsl */ `
  vec3 permutar(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
  float ruido(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permutar(permutar(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
`;

// ───────────── fundo ─────────────
export function criarFundo(comuns) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const mat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform vec2 uResolucao;
      uniform float uTempo;
      uniform vec2 uMouse;
      uniform float uEntrada;
      uniform sampler2D uMascara;
      uniform sampler2D uVelocidade;
      uniform vec3 uPoca;       // tom do líquido no fundo
      uniform float uSuave;     // força da parte macia, que se espalha em volta
      uniform float uMiolo;     // força do miolo da mancha, com a borda do líquido
      uniform float uLiquido;   // 0 a 1: some quando a página começa a rolar
      uniform vec2 uEmpurrao;   // x: fator da velocidade   y: teto do deslocamento
      ${RUIDO}
      ${CORTE_LIQUIDO}
      void main() {
        vec2 uv = gl_FragCoord.xy / uResolucao;
        vec2 p = (gl_FragCoord.xy - 0.5 * uResolucao) / uResolucao.y;
        vec3 cor = vec3(0.020, 0.027, 0.024);

        // luz atrás do servidor
        vec2 q = p * vec2(1.0, 1.2);
        cor += vec3(0.03, 0.20, 0.11) * exp(-dot(q, q) * 3.0) * 0.62 * uEntrada;

        // o fluido empurra as curvas na direção do movimento. a velocidade vem em texels
        // por segundo e passa de 100: fator pequeno e teto, para o fundo só ceder de leve
        vec2 uf = uvFluido(uv);
        vec2 desvio = texture2D(uVelocidade, uf).xy * uEmpurrao.x;
        desvio *= clamp(uEmpurrao.y / max(length(desvio), 0.00001), 0.0, 1.0);

        // curvas de nível, como um mapa de calor do mercado
        float n = ruido((p - desvio) * 1.25 + vec2(uTempo * 0.014, -uTempo * 0.009) + uMouse * 0.04) * 3.6;
        float l = abs(fract(n - 0.5) - 0.5) / max(fwidth(n), 0.0001);
        float linha = 1.0 - smoothstep(0.5, 1.5, l);
        cor += vec3(0.29, 0.87, 0.50) * linha * 0.060 * uEntrada;

        // escurece as beiradas da tela
        cor *= 1.0 - 0.60 * smoothstep(0.30, 1.05, length(p * vec2(0.78, 1.0)));

        // O mesmo líquido que revela o terminal também passa pelo fundo: o corpo da mancha,
        // com a borda do líquido, mais um halo macio em volta, que suaviza a passagem entre
        // o fundo e o terminal revelado.
        // Entra DEPOIS do escurecimento das beiradas de propósito: o líquido tem que continuar
        // visível até a borda da tela. Apagado ali, parecia que batia numa parede antes de sair.
        float tinta = texture2D(uMascara, uf).r;
        float larga = tinta * 0.20;
        vec2 anel = vec2(uResolucao.y / uResolucao.x, 1.0);
        for (int i = 0; i < 4; i++) {
          float a = float(i) * 1.5708 + 0.3927;
          vec2 d = vec2(cos(a), sin(a)) * anel;
          larga += texture2D(uMascara, uf + d * 0.018).r * 0.12;
          larga += texture2D(uMascara, uf + d * 0.040).r * 0.08;
        }
        float nevoa = smoothstep(0.03, 0.85, larga);
        cor += uPoca * (nevoa * uSuave + liquido(tinta) * uMiolo) * uEntrada * uLiquido;

        gl_FragColor = vec4(cor, 1.0);
      }
    `,
    uniforms: {
      uResolucao: comuns.uResolucao,
      uTempo: comuns.uTempo,
      uMouse: comuns.uMouse,
      uMascara: comuns.uMascara,
      uVelocidade: comuns.uVelocidade,
      uPoca: { value: new THREE.Vector3(0.020, 0.082, 0.058) },
      uSuave: { value: 0.8 },
      uMiolo: { value: 0.8 },
      uLiquido: { value: 1 },
      uEmpurrao: { value: new THREE.Vector2(0.00030, 0.035) },
      uEntrada: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
  });
  const malha = new THREE.Mesh(geo, mat);
  malha.frustumCulled = false;
  malha.renderOrder = 0;
  return malha;
}

function imagem(loader, url) {
  const t = loader.load(url);
  t.premultiplyAlpha = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  return t;
}

// ───────────── servidor ─────────────
// A imagem do servidor é fixa. O que se mexe são as luzes: o mapa de luz diz onde fica
// cada LED e dá a ele uma fase própria, então cada um pisca no seu ritmo.
export function criarServidor(loader, comuns) {
  const luz = loader.load('/img/servidor-luz.png');
  luz.minFilter = THREE.LinearFilter;
  luz.magFilter = THREE.LinearFilter;
  luz.generateMipmaps = false;

  const brilho = loader.load('/img/servidor-brilho.webp');
  brilho.minFilter = THREE.LinearFilter;
  brilho.magFilter = THREE.LinearFilter;
  brilho.generateMipmaps = false;

  const mat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMapa;
      uniform sampler2D uLuz;      // r: onde é luz   g: fase do LED   b: tipo (0 LED, 1 barra)
      uniform sampler2D uBrilho;   // cor das luzes, borrada
      uniform float uTempo;
      uniform float uOpacidade;
      uniform float uLigado;
      uniform float uForca;        // intensidade geral da animação das luzes
      varying vec2 vUv;

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
        vec4 t = texture2D(uMapa, vUv);
        vec4 m = texture2D(uLuz, vUv);
        vec3 halo = texture2D(uBrilho, vUv).rgb;
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

        c *= mix(0.28, 1.0, uLigado);
        gl_FragColor = vec4(c, t.a) * uOpacidade;
      }
    `,
    uniforms: {
      uMapa: { value: imagem(loader, '/img/servidor.webp') },
      uLuz: { value: luz },
      uBrilho: { value: brilho },
      uTempo: comuns.uTempo,
      uOpacidade: { value: 0 },
      uLigado: { value: 0 },
      uForca: { value: 1 },
    },
    transparent: true,
    premultipliedAlpha: true,
    depthTest: false,
    depthWrite: false,
  });
  const malha = new THREE.Mesh(new THREE.PlaneGeometry(920, 1182), mat);
  malha.renderOrder = 20;
  return malha;
}
