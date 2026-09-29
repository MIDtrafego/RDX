// Simulação de fluido em 2D (fluidos estáveis) rodando na placa de vídeo.
// O mouse injeta velocidade e "tinta". A tinta é a máscara que revela o painel real.
//
// O que faz a tinta parecer LÍQUIDO e não fumaça:
//   1. a cada quadro ela é borrada de leve e depois "reapertada" em torno de um limiar.
//      Isso é tensão de superfície: ponta fina some primeiro, a mancha arredonda, duas
//      manchas próximas se fundem. Ela encolhe pela beira, sem ficar transparente.
//   2. as bordas são abertas: o que chega nelas escoa para fora, não bate e volta.
//   3. a simulação cobre uma área MAIOR que a tela (MARGEM_FLUIDO de sobra em cada lado).
//      O líquido atravessa a borda da tela e some lá fora, onde ninguém vê.
import * as THREE from 'three';

export const MARGEM_FLUIDO = 0.18;
const ESCALA = 1 + 2 * MARGEM_FLUIDO;

const VERTICE = /* glsl */ `
  uniform vec2 texel;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    vL = vUv - vec2(texel.x, 0.0);
    vR = vUv + vec2(texel.x, 0.0);
    vT = vUv + vec2(0.0, texel.y);
    vB = vUv - vec2(0.0, texel.y);
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const CABECALHO = /* glsl */ `
  uniform vec2 texel;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;

  float fora(vec2 uv) {
    return (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) ? 1.0 : 0.0;
  }
`;

const FRAG = {
  pingo: /* glsl */ `
    uniform sampler2D uAlvo;
    uniform float aspecto;
    uniform vec3 cor;
    uniform vec2 ponto;
    uniform float raio;
    uniform float teto;
    uniform float alongar;   // pincel mais largo que alto: a pincelada sai deitada
    void main() {
      vec2 p = vUv - ponto;
      p.x *= aspecto / alongar;
      vec3 s = exp(-dot(p, p) / raio) * cor;
      vec3 base = texture2D(uAlvo, vUv).xyz;
      vec3 r = base + s;
      if (teto > 0.0) r = min(r, vec3(teto));
      gl_FragColor = vec4(r, 1.0);
    }
  `,
  adveccao: /* glsl */ `
    uniform sampler2D uVelocidade;
    uniform sampler2D uFonte;
    uniform vec2 texelVel;
    uniform float dt;
    uniform float dissipacao;
    void main() {
      vec2 coord = vUv - dt * texture2D(uVelocidade, vUv).xy * texelVel;
      // borda aberta: o que vem de fora da tela é vazio
      vec4 r = texture2D(uFonte, coord) * (1.0 - fora(coord));
      gl_FragColor = r / (1.0 + dissipacao * dt);
    }
  `,
  // tensão de superfície da tinta (ver o topo do arquivo)
  assentar: /* glsl */ `
    uniform sampler2D uFonte;
    uniform float raio;      // alcance do borrão, em texels
    uniform float limiar;    // acima de 0.5 a mancha encolhe; quanto maior, mais rápido
    uniform float maciez;    // meia largura da beira
    void main() {
      vec2 t = texel * raio;
      float c = texture2D(uFonte, vUv).x * 0.25;
      c += texture2D(uFonte, vUv + vec2( t.x, 0.0)).x * 0.125;
      c += texture2D(uFonte, vUv + vec2(-t.x, 0.0)).x * 0.125;
      c += texture2D(uFonte, vUv + vec2(0.0,  t.y)).x * 0.125;
      c += texture2D(uFonte, vUv + vec2(0.0, -t.y)).x * 0.125;
      c += texture2D(uFonte, vUv + vec2( t.x,  t.y)).x * 0.0625;
      c += texture2D(uFonte, vUv + vec2(-t.x,  t.y)).x * 0.0625;
      c += texture2D(uFonte, vUv + vec2( t.x, -t.y)).x * 0.0625;
      c += texture2D(uFonte, vUv + vec2(-t.x, -t.y)).x * 0.0625;
      c = smoothstep(limiar - maciez, limiar + maciez, c);
      // perto da beira da tela a tinta se desfaz: ela sai de cena em vez de empilhar
      float beira = smoothstep(0.0, 0.06, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
      gl_FragColor = vec4(vec3(c * beira), 1.0);
    }
  `,
  divergencia: /* glsl */ `
    uniform sampler2D uVelocidade;
    void main() {
      // sem parede: a velocidade na borda não é espelhada, o fluido atravessa
      float L = texture2D(uVelocidade, vL).x;
      float R = texture2D(uVelocidade, vR).x;
      float T = texture2D(uVelocidade, vT).y;
      float B = texture2D(uVelocidade, vB).y;
      gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
    }
  `,
  rotacional: /* glsl */ `
    uniform sampler2D uVelocidade;
    void main() {
      float L = texture2D(uVelocidade, vL).y;
      float R = texture2D(uVelocidade, vR).y;
      float T = texture2D(uVelocidade, vT).x;
      float B = texture2D(uVelocidade, vB).x;
      gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
    }
  `,
  vorticidade: /* glsl */ `
    uniform sampler2D uVelocidade;
    uniform sampler2D uRotacional;
    uniform float forca;
    uniform float dt;
    void main() {
      float L = texture2D(uRotacional, vL).x;
      float R = texture2D(uRotacional, vR).x;
      float T = texture2D(uRotacional, vT).x;
      float B = texture2D(uRotacional, vB).x;
      float C = texture2D(uRotacional, vUv).x;
      vec2 f = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
      f /= length(f) + 0.0001;
      f *= forca * C;
      f.y *= -1.0;
      vec2 v = texture2D(uVelocidade, vUv).xy + f * dt;
      gl_FragColor = vec4(clamp(v, -1000.0, 1000.0), 0.0, 1.0);
    }
  `,
  atenuar: /* glsl */ `
    uniform sampler2D uAlvo;
    uniform float valor;
    void main() {
      gl_FragColor = valor * texture2D(uAlvo, vUv);
    }
  `,
  pressao: /* glsl */ `
    uniform sampler2D uPressao;
    uniform sampler2D uDivergencia;
    void main() {
      // fora da tela a pressão é zero: é isso que deixa o fluido sair
      float L = texture2D(uPressao, vL).x * (1.0 - fora(vL));
      float R = texture2D(uPressao, vR).x * (1.0 - fora(vR));
      float T = texture2D(uPressao, vT).x * (1.0 - fora(vT));
      float B = texture2D(uPressao, vB).x * (1.0 - fora(vB));
      float d = texture2D(uDivergencia, vUv).x;
      gl_FragColor = vec4((L + R + B + T - d) * 0.25, 0.0, 0.0, 1.0);
    }
  `,
  gradiente: /* glsl */ `
    uniform sampler2D uPressao;
    uniform sampler2D uVelocidade;
    void main() {
      float L = texture2D(uPressao, vL).x * (1.0 - fora(vL));
      float R = texture2D(uPressao, vR).x * (1.0 - fora(vR));
      float T = texture2D(uPressao, vT).x * (1.0 - fora(vT));
      float B = texture2D(uPressao, vB).x * (1.0 - fora(vB));
      vec2 v = texture2D(uVelocidade, vUv).xy - vec2(R - L, T - B);
      gl_FragColor = vec4(v, 0.0, 1.0);
    }
  `,
};

// O corte do líquido. A tinta já vive perto de 0 ou de 1 (o passe "assentar" cuida disso),
// então o corte fica no meio. O terminal usa o corte seco; o fundo usa a versão macia.
export const CORTE_LIQUIDO = /* glsl */ `
  // da posição na tela (0..1) para a posição na textura do fluido, que é maior que a tela
  vec2 uvFluido(vec2 uvTela) {
    return (uvTela - 0.5) / ${ESCALA.toFixed(4)} + 0.5;
  }
  float liquido(float tinta) {
    return smoothstep(0.44, 0.56, tinta);
  }
  // fio em cima do contorno do líquido, com a largura em px de tela
  float contornoLiquido(float tinta, float largura) {
    float d = abs(tinta - 0.5) / max(fwidth(tinta), 0.0001);
    return 1.0 - smoothstep(largura * 0.5, largura * 0.5 + 1.0, d);
  }
`;

export const AJUSTES_FLUIDO = {
  resSim: 190,          // resolução da velocidade (lado menor)
  resTinta: 540,        // resolução da máscara (lado menor). baixa de propósito: gota gorda, não fiapo
  dissipacaoTinta: 0.0, // a tinta não fica transparente: quem faz ela sumir é o encolhimento
  dissipacaoVel: 1.1,   // líquido grosso: desacelera logo depois que o mouse para
  pressao: 0.8,
  iteracoes: 18,
  redemoinho: 0,        // redemoinho faz fiapo, que é cara de fumaça
  raio: 0.85,           // tamanho do pincel
  alongar: 1.7,         // pincel mais largo que alto
  forca: 2600,
  tinta: 1.0,           // quanto cada passada do mouse deposita
  teto: 1.0,
  // tensão de superfície
  borrao: 2.3,          // alcance do borrão por quadro, em texels. é o que arredonda as pontas
  encolher: 4.0,        // velocidade com que a mancha encolhe pela beira (0 = não some nunca)
  maciez: 0.36,         // largura da beira da mancha
};

export class Fluido {
  constructor(renderer, ajustes = AJUSTES_FLUIDO) {
    this.renderer = renderer;
    this.a = ajustes;
    this.cena = new THREE.Scene();
    this.camera = new THREE.Camera();

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.malha = new THREE.Mesh(geo, null);
    this.malha.frustumCulled = false;
    this.cena.add(this.malha);

    this.mat = {};
    for (const [nome, frag] of Object.entries(FRAG)) {
      this.mat[nome] = new THREE.ShaderMaterial({
        vertexShader: VERTICE,
        fragmentShader: CABECALHO + frag,
        uniforms: { texel: { value: new THREE.Vector2() } },
        depthTest: false,
        depthWrite: false,
      });
    }
    const u = (m, obj) => Object.assign(this.mat[m].uniforms, obj);
    u('pingo', { uAlvo: { value: null }, aspecto: { value: 1 }, cor: { value: new THREE.Vector3() }, ponto: { value: new THREE.Vector2() }, raio: { value: 0.01 }, teto: { value: 0 }, alongar: { value: 1 } });
    u('adveccao', { uVelocidade: { value: null }, uFonte: { value: null }, texelVel: { value: new THREE.Vector2() }, dt: { value: 0.016 }, dissipacao: { value: 1 } });
    u('assentar', { uFonte: { value: null }, raio: { value: 1 }, limiar: { value: 0.5 }, maciez: { value: 0.35 } });
    u('divergencia', { uVelocidade: { value: null } });
    u('rotacional', { uVelocidade: { value: null } });
    u('vorticidade', { uVelocidade: { value: null }, uRotacional: { value: null }, forca: { value: 0 }, dt: { value: 0.016 } });
    u('atenuar', { uAlvo: { value: null }, valor: { value: 0.8 } });
    u('pressao', { uPressao: { value: null }, uDivergencia: { value: null } });
    u('gradiente', { uPressao: { value: null }, uVelocidade: { value: null } });

    this.redimensionar(innerWidth, innerHeight);
  }

  _alvo(w, h) {
    return new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
    });
  }

  _duplo(w, h) {
    const d = {
      ler: this._alvo(w, h),
      escrever: this._alvo(w, h),
      texel: new THREE.Vector2(1 / w, 1 / h),
      trocar() { const t = d.ler; d.ler = d.escrever; d.escrever = t; },
      liberar() { d.ler.dispose(); d.escrever.dispose(); },
    };
    return d;
  }

  _tamanho(res, aspecto) {
    const menor = Math.round(res);
    const maior = Math.round(res * (aspecto > 1 ? aspecto : 1 / aspecto));
    return aspecto > 1 ? [maior, menor] : [menor, maior];
  }

  redimensionar(largura, altura) {
    this.aspecto = largura / altura;
    const [sw, sh] = this._tamanho(this.a.resSim, this.aspecto);
    const [tw, th] = this._tamanho(this.a.resTinta, this.aspecto);

    for (const k of ['vel', 'tinta', 'press']) this[k] && this[k].liberar();
    this.div && this.div.dispose();
    this.rot && this.rot.dispose();

    this.vel = this._duplo(sw, sh);
    this.press = this._duplo(sw, sh);
    this.tinta = this._duplo(tw, th);
    this.div = this._alvo(sw, sh);
    this.rot = this._alvo(sw, sh);
  }

  get textura() {
    return this.tinta.ler.texture;
  }

  // campo de velocidade (xy), para quem quiser deformar algo junto com o fluido
  get velocidade() {
    return this.vel.ler.texture;
  }

  _passar(nome, alvo, texel) {
    const m = this.mat[nome];
    m.uniforms.texel.value.copy(texel);
    this.malha.material = m;
    this.renderer.setRenderTarget(alvo);
    this.renderer.render(this.cena, this.camera);
  }

  // x, y em 0..1 NA TELA, com origem embaixo à esquerda. dx, dy = deslocamento em 0..1
  pingar(x, y, dx, dy, tinta = this.a.tinta, escalaRaio = 1) {
    const p = this.mat.pingo.uniforms;
    let raio = (this.a.raio / 100) * escalaRaio;
    if (this.aspecto > 1) raio *= this.aspecto;
    // da tela para a área do fluido
    raio /= ESCALA * ESCALA;
    x = (x - 0.5) / ESCALA + 0.5;
    y = (y - 0.5) / ESCALA + 0.5;
    dx /= ESCALA;
    dy /= ESCALA;

    p.aspecto.value = this.aspecto;
    p.ponto.value.set(x, y);
    p.raio.value = raio;
    p.alongar.value = this.a.alongar;

    p.uAlvo.value = this.vel.ler.texture;
    p.cor.value.set(dx * this.a.forca, dy * this.a.forca, 0);
    p.teto.value = 0;
    this._passar('pingo', this.vel.escrever, this.vel.texel);
    this.vel.trocar();

    p.uAlvo.value = this.tinta.ler.texture;
    p.cor.value.set(tinta, tinta, tinta);
    p.teto.value = this.a.teto;
    this._passar('pingo', this.tinta.escrever, this.tinta.texel);
    this.tinta.trocar();
  }

  passo(dt) {
    const { mat, vel, press, tinta, div, rot, a } = this;
    const r = this.renderer;
    const alvoAnterior = r.getRenderTarget();

    if (a.redemoinho > 0) {
      mat.rotacional.uniforms.uVelocidade.value = vel.ler.texture;
      this._passar('rotacional', rot, vel.texel);

      mat.vorticidade.uniforms.uVelocidade.value = vel.ler.texture;
      mat.vorticidade.uniforms.uRotacional.value = rot.texture;
      mat.vorticidade.uniforms.forca.value = a.redemoinho;
      mat.vorticidade.uniforms.dt.value = dt;
      this._passar('vorticidade', vel.escrever, vel.texel);
      vel.trocar();
    }

    mat.divergencia.uniforms.uVelocidade.value = vel.ler.texture;
    this._passar('divergencia', div, vel.texel);

    mat.atenuar.uniforms.uAlvo.value = press.ler.texture;
    mat.atenuar.uniforms.valor.value = a.pressao;
    this._passar('atenuar', press.escrever, vel.texel);
    press.trocar();

    mat.pressao.uniforms.uDivergencia.value = div.texture;
    for (let i = 0; i < a.iteracoes; i++) {
      mat.pressao.uniforms.uPressao.value = press.ler.texture;
      this._passar('pressao', press.escrever, vel.texel);
      press.trocar();
    }

    mat.gradiente.uniforms.uPressao.value = press.ler.texture;
    mat.gradiente.uniforms.uVelocidade.value = vel.ler.texture;
    this._passar('gradiente', vel.escrever, vel.texel);
    vel.trocar();

    const ad = mat.adveccao.uniforms;
    ad.dt.value = dt;
    ad.texelVel.value.copy(vel.texel);

    ad.uVelocidade.value = vel.ler.texture;
    ad.uFonte.value = vel.ler.texture;
    ad.dissipacao.value = a.dissipacaoVel;
    this._passar('adveccao', vel.escrever, vel.texel);
    vel.trocar();

    ad.uVelocidade.value = vel.ler.texture;
    ad.uFonte.value = tinta.ler.texture;
    ad.dissipacao.value = a.dissipacaoTinta;
    this._passar('adveccao', tinta.escrever, tinta.texel);
    tinta.trocar();

    // tensão de superfície. o limiar sobe com o tempo do quadro para a velocidade de
    // encolhimento ser a mesma em tela de 60 e de 144 quadros por segundo
    const as = mat.assentar.uniforms;
    as.uFonte.value = tinta.ler.texture;
    as.raio.value = a.borrao;
    as.limiar.value = 0.5 + Math.min(0.2, a.encolher * dt);
    as.maciez.value = a.maciez;
    this._passar('assentar', tinta.escrever, tinta.texel);
    tinta.trocar();

    r.setRenderTarget(alvoAnterior);
  }
}
