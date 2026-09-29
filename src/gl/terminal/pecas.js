// Peças de montagem do terminal: caixas instanciadas, placas com conteúdo, fitas, tubo e aro.
// Toda peça guarda dois materiais (sólido e malha) e entra na lista `pecas` do terminal.
import * as THREE from 'three';
import * as S from './shaders.js';

const base = (comuns) => ({
  uCurva: comuns.uCurva,
  uTempo: comuns.uTempo,
  uConstrucao: comuns.uConstrucao,
});

function material(vertexShader, fragmentShader, uniforms, extra = {}) {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    premultipliedAlpha: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    ...extra,
  });
}

const naMalha = { depthTest: false, depthWrite: false };

// ───────────── caixas ─────────────
export class Caixas {
  constructor(capacidade, comuns, { opaco = true, ordem = 10 } = {}) {
    const cubo = new THREE.BoxGeometry(1, 1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = cubo.index;
    g.setAttribute('position', cubo.attributes.position);
    g.setAttribute('normal', cubo.attributes.normal);
    g.setAttribute('uv', cubo.attributes.uv);

    this.capacidade = capacidade;
    this.centro = new Float32Array(capacidade * 3);
    this.tamanho = new Float32Array(capacidade * 3);
    this.cor = new Float32Array(capacidade * 3);
    this.luz = new Float32Array(capacidade * 2);
    const atr = (nome, dados, n) => {
      const a = new THREE.InstancedBufferAttribute(dados, n);
      a.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute(nome, a);
      return a;
    };
    this.atributos = [
      atr('iCentro', this.centro, 3),
      atr('iTamanho', this.tamanho, 3),
      atr('iCor', this.cor, 3),
      atr('iLuz', this.luz, 2),
    ];
    g.instanceCount = 0;
    this.geometria = g;
    this.n = 0;

    this.solido = material(S.CAIXA_VERTICE, S.CAIXA_SOLIDA, base(comuns), {
      transparent: !opaco,
      depthWrite: opaco,
      side: THREE.FrontSide,
    });
    this.malhaMat = material(S.CAIXA_VERTICE, S.CAIXA_MALHA, base(comuns), { ...naMalha, side: THREE.FrontSide });

    this.objeto = new THREE.Mesh(g, this.solido);
    this.objeto.frustumCulled = false;
    this.objeto.renderOrder = ordem;
  }

  limpar() { this.n = 0; }

  por(cx, cy, cz, sx, sy, sz, cor, brilho = 1, alfa = 1) {
    if (this.n >= this.capacidade) return;
    const i = this.n++;
    this.centro.set([cx, cy, cz], i * 3);
    this.tamanho.set([Math.max(sx, 0.001), Math.max(sy, 0.001), Math.max(sz, 0.001)], i * 3);
    this.cor.set(cor, i * 3);
    this.luz.set([brilho, alfa], i * 2);
  }

  enviar() {
    this.geometria.instanceCount = this.n;
    for (const a of this.atributos) a.needsUpdate = true;
  }
}

// ───────────── cartão: placa com conteúdo desenhado em canvas ─────────────
export class Cartao {
  constructor({ w, h, x, y, z, raio = 16, resolucao = 2, segmentos = 8, ordem = 20, celula = 26, moldura = true, comuns, desenhar }) {
    this.w = w;
    this.h = h;
    this.desenhar = desenhar;
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.round(w * resolucao);
    this.canvas.height = Math.round(h * resolucao);
    this.ctx = this.canvas.getContext('2d');
    this.resolucao = resolucao;

    this.textura = new THREE.CanvasTexture(this.canvas);
    this.textura.premultiplyAlpha = true;
    this.textura.minFilter = THREE.LinearMipmapLinearFilter;
    this.textura.magFilter = THREE.LinearFilter;
    this.textura.anisotropy = 8;

    this.uPosicao = { value: new THREE.Vector3(x, y, z) };
    this.uEscalaXY = { value: new THREE.Vector2(1, 1) };
    this.uOpacidade = { value: 1 };
    const tam = { value: new THREE.Vector2(w, h) };

    const u = { ...base(comuns), uPosicao: this.uPosicao, uEscalaXY: this.uEscalaXY, uMapa: { value: this.textura }, uOpacidade: this.uOpacidade };
    this.solido = material(S.PLACA_VERTICE, S.CARTAO_SOLIDO, u);
    this.malhaMat = material(S.PLACA_VERTICE, S.PLACA_MALHA, {
      ...u,
      uTam: tam,
      uRaio: { value: raio },
      uCelula: { value: celula },
      uPeso: { value: moldura ? 1 : 0 },
      uContorno: { value: moldura ? 1 : 0 },
      uFantasma: { value: moldura ? 1 : 1.6 },
      uTela: { value: 1 },
    }, naMalha);

    this.objeto = new THREE.Mesh(new THREE.PlaneGeometry(w, h, segmentos, 1), this.solido);
    this.objeto.frustumCulled = false;
    this.objeto.renderOrder = ordem;
  }

  redesenhar(dados) {
    const c = this.ctx;
    c.setTransform(this.resolucao, 0, 0, this.resolucao, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    c.shadowBlur = 0;
    this.desenhar(c, this.w, this.h, dados);
    this.textura.needsUpdate = true;
  }
}

// ───────────── fita: linha horizontal com comprimento animável ─────────────
export class Fita {
  constructor({ cor, espessura = 2, tracejado = 0, ordem = 30, comuns }) {
    this.uPosicao = { value: new THREE.Vector3() };
    this.uTam = { value: new THREE.Vector2(1, espessura) };
    this.uOpacidade = { value: 0 };
    const u = {
      ...base(comuns),
      uPosicao: this.uPosicao,
      uEscalaXY: this.uTam,
      uTam: this.uTam,
      uCor: { value: new THREE.Color(cor) },
      uOpacidade: this.uOpacidade,
      uTracejado: { value: tracejado },
    };
    this.solido = material(S.PLACA_VERTICE, S.FITA_SOLIDA, u, { depthTest: false });
    this.malhaMat = material(S.PLACA_VERTICE, S.FITA_MALHA, u, naMalha);
    const g = new THREE.PlaneGeometry(1, 1, 24, 1);
    g.translate(0.5, 0, 0); // a origem fica na ponta esquerda
    this.objeto = new THREE.Mesh(g, this.solido);
    this.objeto.frustumCulled = false;
    this.objeto.renderOrder = ordem;
  }

  por(x, y, z, comprimento) {
    this.uPosicao.value.set(x, y, z);
    this.uTam.value.x = Math.max(0.001, comprimento);
  }
}

// ───────────── tubo: linha com volume, passando por pontos que mudam a cada quadro ─────────────
export class Tubo {
  constructor({ pontos, espessura = 3.4, cor, ordem = 25, comuns }) {
    this.n = pontos;
    this.meio = espessura / 2;
    const LADOS = 4;
    this.lados = LADOS;
    this.pos = new Float32Array(pontos * LADOS * 3);
    this.nor = new Float32Array(pontos * LADOS * 3);
    const uv = new Float32Array(pontos * LADOS * 2);
    const idx = [];
    for (let i = 0; i < pontos; i++) {
      for (let k = 0; k < LADOS; k++) {
        uv[(i * LADOS + k) * 2] = i / (pontos - 1);
        uv[(i * LADOS + k) * 2 + 1] = k / LADOS;
        if (i < pontos - 1) {
          const a = i * LADOS + k, b = i * LADOS + ((k + 1) % LADOS);
          const c = a + LADOS, d = b + LADOS;
          idx.push(a, c, b, b, c, d);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aNor = new THREE.BufferAttribute(this.nor, 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos);
    g.setAttribute('normal', this.aNor);
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);

    this.uOpacidade = { value: 1 };
    const u = { ...base(comuns), uCor: { value: new THREE.Color(cor) }, uOpacidade: this.uOpacidade };
    this.solido = material(S.TUBO_VERTICE, S.TUBO_SOLIDO, u, { transparent: false, depthWrite: true });
    this.malhaMat = material(S.TUBO_VERTICE, S.TUBO_MALHA, u, naMalha);
    this.objeto = new THREE.Mesh(g, this.solido);
    this.objeto.frustumCulled = false;
    this.objeto.renderOrder = ordem;
  }

  // pts: lista de [x, y], z: profundidade
  atualizar(pts, z) {
    const n = this.n, m = this.meio, L = this.lados;
    for (let i = 0; i < n; i++) {
      const p = pts[Math.min(i, pts.length - 1)];
      const a = pts[Math.max(0, Math.min(i, pts.length - 1) - 1)];
      const b = pts[Math.min(pts.length - 1, Math.min(i, pts.length - 1) + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1];
      const comp = Math.hypot(tx, ty) || 1;
      tx /= comp; ty /= comp;
      const nx = -ty, ny = tx; // normal no plano
      // seção quadrada girada em 45 graus: quinas para cima, frente, baixo e fundo
      const cantos = [[nx, ny, 0], [0, 0, 1], [-nx, -ny, 0], [0, 0, -1]];
      for (let k = 0; k < L; k++) {
        const c = cantos[k], o = (i * L + k) * 3;
        this.pos[o] = p[0] + c[0] * m;
        this.pos[o + 1] = p[1] + c[1] * m;
        this.pos[o + 2] = z + c[2] * m;
        this.nor[o] = c[0]; this.nor[o + 1] = c[1]; this.nor[o + 2] = c[2];
      }
    }
    this.aPos.needsUpdate = true;
    this.aNor.needsUpdate = true;
  }
}

// ───────────── vidro do terminal e o aro que dá espessura a ele ─────────────
export function contornoArredondado(w, h, raio, porCanto = 8, passoReta = 60) {
  const pts = [];
  const hw = w / 2, hh = h / 2;
  const reta = (x0, y0, x1, y1) => {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / passoReta));
    for (let i = 0; i < n; i++) pts.push([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);
  };
  const arco = (cx, cy, a0) => {
    for (let i = 0; i < porCanto; i++) {
      const a = a0 - (Math.PI / 2) * (i / porCanto);
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

export function criarAro({ w, h, raio, fundo, comuns, ordem = 4 }) {
  const pts = contornoArredondado(w, h, raio);
  const n = pts.length;
  const pos = [], nor = [], uv = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const p = pts[i % n];
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const c = Math.hypot(tx, ty) || 1;
    // contorno no sentido horário: a normal para fora é a tangente girada para a esquerda
    const nx = -ty / c, ny = tx / c;
    for (let k = 0; k < 2; k++) {
      pos.push(p[0], p[1], k === 0 ? 0 : fundo);
      nor.push(nx, ny, 0);
      uv.push(i / n, k);
    }
    if (i < n) {
      const q = i * 2;
      idx.push(q, q + 1, q + 2, q + 2, q + 1, q + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const peca = {
    solido: material(S.TUBO_VERTICE, S.ARO_SOLIDO, base(comuns), { transparent: false, depthWrite: true }),
    malhaMat: material(S.TUBO_VERTICE, S.ARO_MALHA, base(comuns), naMalha),
  };
  peca.objeto = new THREE.Mesh(g, peca.solido);
  peca.objeto.frustumCulled = false;
  peca.objeto.renderOrder = ordem;
  return peca;
}

export function criarVidro({ w, h, raio, z, comuns, uniformsGrafico, ordem = 5, soMalha = false, peso = 1 }) {
  const uPosicao = { value: new THREE.Vector3(0, 0, z) };
  const comum = {
    ...base(comuns),
    uPosicao,
    uEscalaXY: { value: new THREE.Vector2(1, 1) },
    uTam: { value: new THREE.Vector2(w, h) },
    uRaio: { value: raio },
    uOpacidade: { value: 1 },
  };
  const peca = {
    solido: soMalha
      ? null
      : material(S.PLACA_VERTICE, S.VIDRO_SOLIDO, { ...comum, ...uniformsGrafico }),
    // a placa do fundo é só malha; o vidro da frente também traz o vidro pintado, na onda
    malhaMat: soMalha
      ? material(S.PLACA_VERTICE, S.PLACA_MALHA, {
        ...comum,
        uCelula: { value: 26 },
        uPeso: { value: peso },
        uContorno: { value: 1 },
        uFantasma: { value: 0 },
        uTela: { value: 0 },
        uMapa: { value: null },
      }, naMalha)
      : material(S.PLACA_VERTICE, S.VIDRO_MALHA, {
        ...comum,
        ...uniformsGrafico,
        uCelula: { value: 26 },
        uPeso: { value: peso },
      }, naMalha),
  };
  peca.objeto = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 64, 1), peca.solido || peca.malhaMat);
  peca.objeto.frustumCulled = false;
  peca.objeto.renderOrder = ordem;
  return peca;
}
