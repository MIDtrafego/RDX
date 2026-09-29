// O painel "operando": a imagem do painel serve de base e o gráfico, os eixos,
// a etiqueta de preço e os números do cabeçalho são redesenhados ao vivo num canvas,
// que vira a textura do painel na cena 3D.
//
// Todas as coordenadas abaixo estão no espaço da textura (1202 x 929).
import * as THREE from 'three';

export const PAINEL = { w: 1202, h: 929, margem: 40, raio: 46 };

// blocos da interface, medidos na imagem: [x0, y0, x1, y1, raio]
export const BLOCOS = [
  [91, 100, 785, 199, 18],    // cabeçalho
  [366, 124, 504, 182, 10],   // variação %
  [517, 120, 635, 185, 10],   // último preço
  [648, 120, 782, 186, 10],   // variação 24h
  [80, 202, 702, 599, 14],    // gráfico
  [92, 647, 169, 689, 10],    // 1m
  [184, 647, 262, 689, 10],   // 5m
  [277, 647, 373, 689, 10],   // 15m
  [388, 647, 471, 689, 10],   // 1h
  [486, 647, 571, 689, 10],   // 4h
  [587, 647, 675, 689, 10],   // 1d
  [706, 621, 783, 694, 12],   // botão do gráfico
  [80, 714, 246, 832, 12],    // índices
  [261, 714, 423, 832, 12],   // ações
  [438, 714, 605, 832, 12],   // moedas
  [620, 714, 795, 832, 12],   // commodities
  [817, 176, 1126, 274, 12],  // comprar
  [818, 288, 1125, 357, 12],  // vender
  [816, 376, 1126, 512, 12],  // entrada / alvo / stop
  [816, 528, 1126, 771, 14],  // contexto da decisão
];

const G = { x0: 80, y0: 204, x1: 702, y1: 599 };   // moldura do gráfico (eixos)
const PLOT = { topo: 232, base: 570 };             // faixa vertical onde o preço é desenhado
const VOLUME_ALT = 128;
const PASSO_VELA = 15.4;
const LARG_VELA = 10;
const VISIVEIS = 41;
const DURACAO_VELA = 1.7;                          // segundos para fechar uma vela

const COR = {
  alta: '#1fe9f7',
  baixa: '#e6f21c',
  media: '#f4ee2e',
  grade: 'rgba(70, 205, 200, 0.20)',
  eixo: 'rgba(225, 245, 248, 0.92)',
  texto: '#e4f2f4',
  positivo: '#1fe6b5',
  negativo: '#ff3b4f',
  volume: 'rgba(28, 150, 128, 0.62)',
};

const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// gerador com semente: o gráfico abre sempre com o mesmo desenho
function sorteio(semente) {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function caixaRedonda(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class PainelVivo {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = PAINEL.w;
    this.canvas.height = PAINEL.h;
    this.ctx = this.canvas.getContext('2d');

    this.textura = new THREE.CanvasTexture(this.canvas);
    this.textura.premultiplyAlpha = true;
    this.textura.minFilter = THREE.LinearMipmapLinearFilter;
    this.textura.magFilter = THREE.LinearFilter;
    this.textura.generateMipmaps = true;
    this.textura.anisotropy = 8;

    this.rnd = sorteio(20260929);
    this.base = null;
    this.tempo = 0;
    this.relogio = 0;       // tempo dentro da vela atual
    this.ciclos = 0;
    this.aoFecharVela = null;
    this.referencia24h = 126194.85;

    this._semear();
  }

  async carregar(url) {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    this.base = img;
    try {
      await Promise.all([
        document.fonts.load('700 30px Roboto'),
        document.fonts.load('500 20px Roboto'),
      ]);
    } catch (e) { /* segue com a fonte do sistema */ }
    this.desenhar();
  }

  // histórico inicial: tendência de alta parecida com a do mockup
  _semear() {
    const r = this.rnd;
    this.velas = [];
    let p = 124650;
    const total = VISIVEIS + 24;
    for (let i = 0; i < total; i++) {
      const tendencia = 60 + 45 * Math.sin(i * 0.31);
      const corpo = (r() - 0.43) * 1050 + tendencia * 0.5;
      const o = p;
      const c = o + corpo;
      const h = Math.max(o, c) + r() * 300;
      const l = Math.min(o, c) - r() * 300;
      this.velas.push({ o, h, l, c, v: 0.18 + r() * 0.5 + Math.abs(corpo) / 900 });
      p = c;
    }
    // encaixa o último fechamento no preço do mockup
    const desvio = 129320.45 - p;
    for (const v of this.velas) { v.o += desvio; v.h += desvio; v.l += desvio; v.c += desvio; }
    this.preco = 129320.45;
    this.alvo = this.preco;
    this._novaVela();
    this.min = 124600; this.max = 130300;
  }

  _novaVela() {
    const o = this.preco;
    this.atual = { o, h: o, l: o, c: o, v: 0.05 };
    // destino da vela: leve viés de alta, puxado de volta para uma faixa razoável
    const r = this.rnd;
    const centro = 129300 + 1100 * Math.sin(this.tempo * 0.07);
    const retorno = (centro - o) * 0.16;
    this.alvo = o + (r() - 0.46) * 1050 + retorno;
    this.volAlvo = 0.2 + r() * 0.75;
  }

  atualizar(dt) {
    this.tempo += dt;
    this.relogio += dt;
    const r = this.rnd;
    const k = Math.min(1, this.relogio / DURACAO_VELA);

    // o preço caminha até o destino da vela, com ruído de tick
    const guia = this.atual.o + (this.alvo - this.atual.o) * (k * k * (3 - 2 * k));
    this.preco += (guia - this.preco) * Math.min(1, dt * 7) + (r() - 0.5) * 95 * Math.sqrt(dt * 60) * 0.35;
    const a = this.atual;
    a.c = this.preco;
    a.h = Math.max(a.h, a.c);
    a.l = Math.min(a.l, a.c);
    a.v += (this.volAlvo - a.v) * Math.min(1, dt * 1.6);

    if (this.relogio >= DURACAO_VELA) {
      this.relogio = 0;
      this.velas.push(a);
      if (this.velas.length > VISIVEIS + 30) this.velas.shift();
      this.ciclos++;
      this._novaVela();
      if (this.aoFecharVela) this.aoFecharVela(this.ciclos, this.preco);
    }

    // escala vertical acompanha as velas visíveis, com suavidade
    const vis = this.velas.slice(-VISIVEIS).concat(this.atual);
    let lo = Infinity, hi = -Infinity;
    for (const v of vis) { if (v.l < lo) lo = v.l; if (v.h > hi) hi = v.h; }
    const folga = (hi - lo) * 0.09 + 60;
    const s = Math.min(1, dt * 2.2);
    this.min += (lo - folga - this.min) * s;
    this.max += (hi + folga - this.max) * s;

    this.desenhar();
  }

  _y(preco) {
    const t = (preco - this.min) / (this.max - this.min);
    return PLOT.base - t * (PLOT.base - PLOT.topo);
  }

  desenhar() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.clearRect(0, 0, PAINEL.w, PAINEL.h);
    if (this.base) ctx.drawImage(this.base, 0, 0);

    this._grafico(ctx);
    this._eixo(ctx);
    this._cabecalho(ctx);
    this._botoes(ctx);

    this.textura.needsUpdate = true;
  }

  _grafico(ctx) {
    const avanco = this.relogio / DURACAO_VELA;
    const velas = this.velas.slice(-(VISIVEIS + 1)).concat(this.atual);
    const n = velas.length;
    // a vela em formação nasce encostada à direita e vai cedendo um passo até fechar
    const xUltima = G.x1 - 30;
    const xDe = (i) => xUltima - (n - 1 - i) * PASSO_VELA;

    ctx.save();
    caixaRedonda(ctx, G.x0 + 2, G.y0 + 2, G.x1 - G.x0 - 3, G.y1 - G.y0 - 3, 14);
    ctx.clip();

    // grade
    ctx.lineWidth = 1;
    ctx.strokeStyle = COR.grade;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    const desloc = (this.tempo / DURACAO_VELA) * PASSO_VELA;
    const passoX = PASSO_VELA * 4;
    for (let x = G.x1 - (desloc % passoX); x > G.x0; x -= passoX) {
      ctx.moveTo(Math.round(x) + 0.5, G.y0);
      ctx.lineTo(Math.round(x) + 0.5, G.y1);
    }
    for (const p of this._niveis()) {
      const y = Math.round(this._y(p)) + 0.5;
      ctx.moveTo(G.x0, y);
      ctx.lineTo(G.x1, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    const dx = (1 - avanco) * PASSO_VELA;

    // volume
    for (let i = 0; i < n; i++) {
      const v = velas[i];
      const x = xDe(i) + dx;
      const alt = Math.min(1.25, v.v) * VOLUME_ALT * 0.8;
      const gr = ctx.createLinearGradient(0, G.y1 - alt, 0, G.y1);
      gr.addColorStop(0, 'rgba(36, 170, 140, 0.70)');
      gr.addColorStop(1, 'rgba(20, 110, 100, 0.38)');
      ctx.fillStyle = gr;
      ctx.fillRect(x - 6, G.y1 - alt, 12, alt);
    }

    // média móvel
    const periodo = 14;
    const todas = this.velas.concat(this.atual);
    const ini = todas.length - n;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      let soma = 0, cont = 0;
      for (let k = Math.max(0, ini + i - periodo + 1); k <= ini + i; k++) { soma += todas[k].c; cont++; }
      const x = xDe(i) + dx;
      const y = this._y(soma / cont);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(244, 238, 46, 0.75)';
    ctx.shadowBlur = 9;
    ctx.strokeStyle = COR.media;
    ctx.lineWidth = 2.6;
    ctx.stroke();

    // velas
    for (let i = 0; i < n; i++) {
      const v = velas[i];
      const x = xDe(i) + dx;
      const alta = v.c >= v.o;
      const cor = alta ? COR.alta : COR.baixa;
      const yo = this._y(v.o), yc = this._y(v.c);
      const topo = Math.min(yo, yc);
      const alt = Math.max(3, Math.abs(yc - yo));
      ctx.shadowColor = cor;
      ctx.shadowBlur = 11;
      ctx.fillStyle = cor;
      ctx.fillRect(x - 1, this._y(v.h), 2, this._y(v.l) - this._y(v.h));
      ctx.fillRect(x - LARG_VELA / 2, topo, LARG_VELA, alt);
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    this.xAtual = xDe(n - 1) + dx;
  }

  _niveis() {
    const faixa = this.max - this.min;
    const passo = faixa > 7500 ? 2000 : faixa > 3600 ? 1000 : 500;
    const lista = [];
    for (let p = Math.ceil(this.min / passo) * passo; p <= this.max; p += passo) lista.push(p);
    return lista;
  }

  _eixo(ctx) {
    // eixos
    ctx.strokeStyle = COR.eixo;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(G.x1, G.y0 + 8);
    ctx.lineTo(G.x1, G.y1);
    ctx.stroke();
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(G.x0, G.y0 + 20);
    ctx.lineTo(G.x0, G.y1);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // rótulos de preço
    ctx.font = '500 20px Roboto, Arial, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const yTag = Math.max(G.y0 + 22, Math.min(G.y1 - 22, this._y(this.preco)));
    for (const p of this._niveis()) {
      const y = this._y(p);
      if (y < G.y0 + 14 || y > G.y1 - 12) continue;
      ctx.strokeStyle = COR.eixo;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(G.x1, Math.round(y) + 0.5);
      ctx.lineTo(G.x1 + 9, Math.round(y) + 0.5);
      ctx.stroke();
      const dist = Math.abs(y - yTag);
      ctx.globalAlpha = Math.max(0, Math.min(1, (dist - 20) / 12));
      ctx.fillStyle = COR.texto;
      ctx.fillText(nf0.format(p), G.x1 + 18, y + 1);
      ctx.globalAlpha = 1;
    }

    // ligação da vela atual até a etiqueta
    ctx.strokeStyle = COR.baixa;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(this.xAtual + 8, yTag);
    ctx.lineTo(G.x1 + 6, yTag);
    ctx.stroke();
    ctx.setLineDash([]);

    // etiqueta do preço atual
    const x = G.x1 + 5, w = 80, h = 33;
    ctx.shadowColor = 'rgba(210, 255, 40, 0.8)';
    ctx.shadowBlur = 10;
    caixaRedonda(ctx, x, yTag - h / 2, w, h, 8);
    ctx.fillStyle = '#0b4f16';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#dcff2e';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = '700 19px Roboto, Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(nf0.format(Math.round(this.preco)), x + w / 2, yTag + 1);
    ctx.textAlign = 'left';
  }

  _cabecalho(ctx) {
    const delta = this.preco - this.referencia24h;
    const pct = (delta / this.referencia24h) * 100;
    const sobe = delta >= 0;
    const cor = sobe ? COR.positivo : COR.negativo;

    // variação em %
    ctx.save();
    ctx.translate(387, 153);
    if (!sobe) ctx.scale(1, -1);
    ctx.strokeStyle = cor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-8, 8); ctx.lineTo(8, -8);
    ctx.moveTo(-3, -8); ctx.lineTo(8, -8); ctx.lineTo(8, 3);
    ctx.stroke();
    ctx.restore();

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = cor;
    ctx.font = '700 30px Roboto, Arial, sans-serif';
    ctx.fillText(nf2.format(Math.abs(pct)) + '%', 411, 164);

    // último preço
    ctx.font = '700 21px Roboto, Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(nf2.format(this.preco), 576, 155);

    // variação em 24h
    ctx.fillStyle = cor;
    ctx.fillText((sobe ? '+' : '-') + nf2.format(Math.abs(delta)), 715, 155);
    ctx.textAlign = 'left';
  }

  _botoes(ctx) {
    // pulso de luz no botão de compra e no ponto de "próximo passo"
    const t = this.tempo;
    const pulso = 0.5 + 0.5 * Math.sin(t * 2.4);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    caixaRedonda(ctx, 817, 176, 309, 98, 12);
    ctx.clip();
    ctx.fillStyle = 'rgba(210, 255, 60, ' + (0.05 + 0.1 * pulso).toFixed(3) + ')';
    ctx.fillRect(817, 176, 309, 98);
    // reflexo que atravessa o botão
    const fase = (t * 0.38) % 1;
    const xr = 760 + fase * 480;
    const gr = ctx.createLinearGradient(xr - 70, 0, xr + 70, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0.34)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr;
    ctx.transform(1, 0, -0.45, 1, 100, 0);
    ctx.fillRect(xr - 70, 170, 140, 110);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const rg = ctx.createRadialGradient(829, 142, 0, 829, 142, 20);
    rg.addColorStop(0, 'rgba(230, 255, 80, ' + (0.25 + 0.5 * pulso).toFixed(3) + ')');
    rg.addColorStop(1, 'rgba(230, 255, 80, 0)');
    ctx.fillStyle = rg;
    ctx.fillRect(805, 118, 48, 48);
    ctx.restore();
  }
}
