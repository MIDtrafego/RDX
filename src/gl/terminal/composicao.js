// Junta as duas versões do terminal na tela.
//   1. desenha o terminal sólido numa textura
//   2. desenha o terminal em malha em outra
//   3. desenha só as peças que emitem luz e tira o brilho (bloom) delas
//   4. mistura as duas pela máscara do fluido: malha onde não tem tinta, sólido onde tem
import * as THREE from 'three';
import { CORTE_LIQUIDO } from '../fluido.js';

const VERTICE = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const CLAREAR = /* glsl */ `
  uniform sampler2D uMapa;
  uniform vec2 uTexel;
  varying vec2 vUv;
  void main() {
    // reduz com 4 amostras e fica só com o que é luz
    vec3 c = vec3(0.0);
    c += texture2D(uMapa, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
    c += texture2D(uMapa, vUv + uTexel * vec2( 1.0, -1.0)).rgb;
    c += texture2D(uMapa, vUv + uTexel * vec2(-1.0,  1.0)).rgb;
    c += texture2D(uMapa, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
    c *= 0.25;
    float l = max(c.r, max(c.g, c.b));
    gl_FragColor = vec4(c * smoothstep(0.10, 0.70, l), 1.0);
  }
`;

const BORRAR = /* glsl */ `
  uniform sampler2D uMapa;
  uniform vec2 uDirecao;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(uMapa, vUv).rgb * 0.227027;
    c += (texture2D(uMapa, vUv + uDirecao * 1.3846).rgb + texture2D(uMapa, vUv - uDirecao * 1.3846).rgb) * 0.316216;
    c += (texture2D(uMapa, vUv + uDirecao * 3.2308).rgb + texture2D(uMapa, vUv - uDirecao * 3.2308).rgb) * 0.070270;
    gl_FragColor = vec4(c, 1.0);
  }
`;

const COMPOR = /* glsl */ `
  uniform sampler2D uSolido;
  uniform sampler2D uMalha;
  uniform sampler2D uBrilhoCurto;
  uniform sampler2D uBrilhoLargo;
  uniform sampler2D uMascara;
  uniform float uRevelarTudo;
  uniform float uConstrucao;
  uniform float uOpacidade;
  uniform vec2 uFio;          // x: largura em px de tela   y: força
  varying vec2 vUv;

  const vec3 CIANO = vec3(0.13, 0.89, 0.84);
  const vec3 LIMA  = vec3(0.80, 0.97, 0.18);

  ${CORTE_LIQUIDO}

  void main() {
    vec4 s = texture2D(uSolido, vUv);
    vec4 w = texture2D(uMalha, vUv);
    vec3 brilho = texture2D(uBrilhoCurto, vUv).rgb * 0.95 + texture2D(uBrilhoLargo, vUv).rgb * 1.10;

    float tinta = texture2D(uMascara, uvFluido(vUv)).r;
    float pronto = smoothstep(0.55, 1.0, uConstrucao);
    // corte seco, de líquido. é o mesmo corte da poça do fundo (ver criarFundo)
    float m = max(liquido(tinta), uRevelarTudo) * pronto;

    vec4 real = vec4(s.rgb + brilho, s.a);
    vec4 cor = w * (1.0 - m) + real * m;

    // fio de luz fino no contorno do líquido, só por cima do terminal. sem halo em volta
    float fio = contornoLiquido(tinta, uFio.x);
    float presenca = clamp(s.a * 1.2 + dot(brilho, vec3(0.4)), 0.0, 1.0);
    cor.rgb += mix(LIMA, CIANO, 0.35) * fio * uFio.y * presenca * pronto * (1.0 - uRevelarTudo);

    gl_FragColor = cor * uOpacidade;
  }
`;

export class Composicao {
  constructor(renderer, comuns) {
    this.renderer = renderer;
    this.comuns = comuns;
    this.cena = new THREE.Scene();
    this.camera = new THREE.Camera();

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.tela = new THREE.Mesh(g, null);
    this.tela.frustumCulled = false;
    this.cena.add(this.tela);

    const passe = (fragmentShader, uniforms, extra = {}) =>
      new THREE.ShaderMaterial({ vertexShader: VERTICE, fragmentShader, uniforms, depthTest: false, depthWrite: false, ...extra });

    this.clarear = passe(CLAREAR, { uMapa: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.borrar = passe(BORRAR, { uMapa: { value: null }, uDirecao: { value: new THREE.Vector2() } });
    this.compor = passe(COMPOR, {
      uSolido: { value: null },
      uMalha: { value: null },
      uBrilhoCurto: { value: null },
      uBrilhoLargo: { value: null },
      uMascara: comuns.uMascara,
      uRevelarTudo: comuns.uRevelarTudo,
      uConstrucao: comuns.uConstrucao,
      uOpacidade: { value: 1 },
      uFio: { value: new THREE.Vector2(1.0, 0.22) },
    }, { transparent: true, premultipliedAlpha: true });

    this.preto = new THREE.Color(0x000000);
    this.corAnterior = new THREE.Color();
  }

  _alvo(w, h, amostras, profundidade) {
    return new THREE.WebGLRenderTarget(w, h, {
      samples: amostras,
      depthBuffer: profundidade,
      stencilBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
      colorSpace: THREE.NoColorSpace,
    });
  }

  redimensionar(w, h) {
    for (const k of ['solido', 'malha', 'luz', 'c1', 'c2', 'l1', 'l2']) this[k] && this[k].dispose();
    this.w = w;
    this.h = h;
    this.solido = this._alvo(w, h, 4, true);
    this.malha = this._alvo(w, h, 4, false);
    this.luz = this._alvo(Math.max(2, Math.round(w / 2)), Math.max(2, Math.round(h / 2)), 0, true);
    const w4 = Math.max(2, Math.round(w / 4)), h4 = Math.max(2, Math.round(h / 4));
    const w8 = Math.max(2, Math.round(w / 8)), h8 = Math.max(2, Math.round(h / 8));
    this.c1 = this._alvo(w4, h4, 0, false);
    this.c2 = this._alvo(w4, h4, 0, false);
    this.l1 = this._alvo(w8, h8, 0, false);
    this.l2 = this._alvo(w8, h8, 0, false);
  }

  _passar(material, alvo) {
    this.tela.material = material;
    this.renderer.setRenderTarget(alvo);
    this.renderer.render(this.cena, this.camera);
  }

  renderizar(cenaTerminal, camera, terminal) {
    const r = this.renderer;
    r.getClearColor(this.corAnterior);
    const alfaAnterior = r.getClearAlpha();
    r.setClearColor(this.preto, 0);

    // 1 e 2: as duas versões do terminal
    terminal.vestir('solido');
    r.setRenderTarget(this.solido);
    r.clear();
    r.render(cenaTerminal, camera);

    terminal.vestir('malha');
    r.setRenderTarget(this.malha);
    r.clear();
    r.render(cenaTerminal, camera);

    // 3: brilho em dois tamanhos, só do que emite luz
    terminal.vestir('luz');
    r.setRenderTarget(this.luz);
    r.clear();
    r.render(cenaTerminal, camera);
    terminal.vestir('solido');

    this.clarear.uniforms.uMapa.value = this.luz.texture;
    this.clarear.uniforms.uTexel.value.set(1 / this.luz.width, 1 / this.luz.height);
    this._passar(this.clarear, this.c1);

    const borra = (de, para, dx, dy) => {
      this.borrar.uniforms.uMapa.value = de.texture;
      this.borrar.uniforms.uDirecao.value.set(dx, dy);
      this._passar(this.borrar, para);
    };
    borra(this.c1, this.c2, 1 / this.c1.width, 0);
    borra(this.c2, this.c1, 0, 1 / this.c1.height);
    borra(this.c1, this.l1, 1.6 / this.l1.width, 0);
    borra(this.l1, this.l2, 0, 1.6 / this.l1.height);
    borra(this.l2, this.l1, 1.6 / this.l1.width, 0);
    borra(this.l1, this.l2, 0, 1.6 / this.l1.height);

    // 4: mistura na tela, por cima do fundo e do servidor
    r.setClearColor(this.corAnterior, alfaAnterior);
    const u = this.compor.uniforms;
    u.uSolido.value = this.solido.texture;
    u.uMalha.value = this.malha.texture;
    u.uBrilhoCurto.value = this.c1.texture;
    u.uBrilhoLargo.value = this.l2.texture;
    const limpar = r.autoClear;
    r.autoClear = false;
    this._passar(this.compor, null);
    r.autoClear = limpar;
  }
}
