// O terminal do RDX em 3D de verdade: vidro curvo com espessura, velas com volume,
// média móvel em tubo e cartões flutuando em profundidades diferentes.
// Coordenadas: origem no centro do vidro, x para a direita, y para cima, z para quem olha.
import * as THREE from 'three';
import { Mercado, ATIVO } from '../mercado.js';
import { Caixas, Cartao, Fita, Tubo, criarAro, criarVidro } from './pecas.js';
import * as D from './desenhos.js';

export const TERMINAL = { w: 1200, h: 780, raio: 44, fundo: -30 };

const QUADRO = { x0: -566, y0: -356, x1: 226, y1: 252 };          // moldura do gráfico
const PLOT = { x0: -556, x1: 136, yTopo: 222, yBase: -190, yChao: -348 };
const EIXO_X = 140;
const PASSO = 15;

// profundidade de cada camada: é o que cria o 3D quando o terminal gira
const Z = {
  volume: 9, vela: 22, media: 42, linhas: 50, rotulos: 54, etiqueta: 62,
  cabecalho: 36, motor: 30, operacao: 52, contexto: 36, barras: 46,
};

const COR = {
  alta: [0.12, 0.91, 0.97],
  baixa: [0.90, 0.95, 0.11],
  volume: [0.12, 0.62, 0.52],
  trilho: [0.05, 0.22, 0.22],
  lima: [0.80, 0.97, 0.18],
  ciano: [0.13, 0.89, 0.84],
  verde: [0.29, 0.87, 0.50],
  vermelho: [1.0, 0.30, 0.37],
};

const degrau = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mistura = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export class Terminal {
  constructor(comuns) {
    this.comuns = comuns;
    this.grupo = new THREE.Group();
    this.pecas = [];
    this.mercado = new Mercado({ visiveis: Math.floor((PLOT.x1 - PLOT.x0) / PASSO) });
    this.tempo = 0;
    this.relogios = { cabecalho: 0, motor: 0, operacao: 0, eixo: 0, contexto: 0 };
    this.anim = { linhas: 0, resultado: 0, varrendo: 0, clarao: 0 };
    this.pronto = false;

    this._vidro();
    this._grafico();
    this._cartoes();

    this.mercado.aoAbrir = () => this._aoAbrir();
    this.mercado.aoFechar = (m) => this._aoFechar(m);
  }

  // emite: a peça é fonte de luz e entra no passe de brilho
  _entrar(peca, emite = false) {
    peca.emite = emite;
    this.pecas.push(peca);
    this.grupo.add(peca.objeto);
    return peca;
  }

  // ───────────── vidro ─────────────
  _vidro() {
    const c = this.comuns;
    this.uGrafico = {
      uQuadro: { value: new THREE.Vector4(QUADRO.x0, QUADRO.y0, QUADRO.x1, QUADRO.y1) },
      uPlot: { value: new THREE.Vector4(PLOT.yBase, PLOT.yTopo, 124600, 130300) },
      uPasso: { value: 1000 },
      uGradeX: { value: new THREE.Vector2(PASSO * 4, 0) },
      uVarredura: { value: -9999 },
      uVarrendo: { value: 0 },
      uClarao: { value: new THREE.Vector4(0.8, 0.97, 0.18, 0) },
    };
    const { w, h, raio, fundo } = TERMINAL;
    this._entrar(criarVidro({ w, h, raio, z: fundo, comuns: c, soMalha: true, peso: 0.45, ordem: 1 }));
    this._entrar(criarAro({ w, h, raio, fundo, comuns: c, ordem: 2 }), true);
    this.vidro = this._entrar(criarVidro({ w, h, raio, z: 0, comuns: c, uniformsGrafico: this.uGrafico, ordem: 3 }));
  }

  // ───────────── gráfico ─────────────
  _grafico() {
    const c = this.comuns;
    this.volume = new Caixas(80, c, { opaco: false, ordem: 6 });
    this.velas = new Caixas(260, c, { opaco: true, ordem: 7 });
    this._entrar({ objeto: this.volume.objeto, solido: this.volume.solido, malhaMat: this.volume.malhaMat }, true);
    this._entrar({ objeto: this.velas.objeto, solido: this.velas.solido, malhaMat: this.velas.malhaMat }, true);

    this.media = this._entrar(new Tubo({ pontos: this.mercado.visiveis + 2, espessura: 4.2, cor: '#f4ee2e', comuns: c, ordem: 8 }), true);

    this.linhaPreco = this._entrar(new Fita({ cor: '#dcff2e', espessura: 1.6, tracejado: 12, comuns: c, ordem: 30 }));
    this.ligacao = this._entrar(new Fita({ cor: '#dcff2e', espessura: 2.2, tracejado: 9, comuns: c, ordem: 31 }));
    this.linhas = {
      entrada: this._entrar(new Fita({ cor: '#ffffff', espessura: 1.8, tracejado: 14, comuns: c, ordem: 32 })),
      alvo: this._entrar(new Fita({ cor: '#c8f52a', espessura: 2.4, comuns: c, ordem: 33 }), true),
      stop: this._entrar(new Fita({ cor: '#ff4d5e', espessura: 2.4, comuns: c, ordem: 34 }), true),
    };

    this.eixo = this._entrar(new Cartao({
      w: 84, h: QUADRO.y1 - QUADRO.y0 - 16, x: EIXO_X + 40, y: (QUADRO.y0 + QUADRO.y1) / 2, z: 3,
      moldura: false, segmentos: 4, ordem: 9, comuns: c, desenhar: D.desenharEixo,
    }));
    this.etiqueta = this._entrar(new Cartao({
      w: 92, h: 34, x: EIXO_X + 56, y: 0, z: Z.etiqueta, raio: 8, segmentos: 3, ordem: 60, comuns: c, desenhar: D.desenharEtiqueta,
    }));

    const rotulo = (ordem) => this._entrar(new Cartao({
      w: 138, h: 22, x: 0, y: 0, z: Z.rotulos, raio: 5, segmentos: 3, ordem, comuns: c, desenhar: D.desenharRotuloLinha,
    }));
    this.rotulos = { entrada: rotulo(40), alvo: rotulo(41), stop: rotulo(42) };
    this.marcador = this._entrar(new Cartao({
      w: 28, h: 28, x: 0, y: 0, z: Z.rotulos, raio: 4, moldura: false, segmentos: 1, ordem: 43, comuns: c, desenhar: D.desenharMarcador,
    }));
    this.resultado = this._entrar(new Cartao({
      w: 196, h: 44, x: 0, y: 0, z: Z.etiqueta + 14, raio: 10, segmentos: 4, ordem: 70, comuns: c, desenhar: D.desenharResultado,
    }));
    for (const p of [this.rotulos.entrada, this.rotulos.alvo, this.rotulos.stop, this.marcador, this.resultado]) p.uOpacidade.value = 0;
  }

  // ───────────── cartões ─────────────
  _cartoes() {
    const c = this.comuns;
    const cx = 406, lw = 320;
    this.cabecalho = this._entrar(new Cartao({ w: 792, h: 88, x: -170, y: 312, z: Z.cabecalho, raio: 18, segmentos: 20, ordem: 50, comuns: c, desenhar: D.desenharCabecalho }));
    this.motor = this._entrar(new Cartao({ w: lw, h: 150, x: cx, y: 281, z: Z.motor, ordem: 51, comuns: c, desenhar: D.desenharMotor }));
    this.operacao = this._entrar(new Cartao({ w: lw, h: 230, x: cx, y: 75, z: Z.operacao, ordem: 55, comuns: c, desenhar: D.desenharOperacao }));
    this.contexto = this._entrar(new Cartao({ w: lw, h: 300, x: cx, y: -206, z: Z.contexto, ordem: 52, comuns: c, desenhar: D.desenharContexto }));

    // barras com volume, na frente dos cartões
    this.trilhos = new Caixas(16, c, { opaco: false, ordem: 56 });
    this.barras = new Caixas(64, c, { opaco: true, ordem: 57 });
    this._entrar({ objeto: this.trilhos.objeto, solido: this.trilhos.solido, malhaMat: this.trilhos.malhaMat });
    this._entrar({ objeto: this.barras.objeto, solido: this.barras.solido, malhaMat: this.barras.malhaMat }, true);
  }

  async carregar() {
    await D.carregarFontes();
    this._redesenharTudo();
    this.pronto = true;
  }

  // ───────────── eventos do motor ─────────────
  _aoAbrir() {
    this.anim.linhas = 0;
    this.abrindo = true;
    this._rotulosDaOperacao();
    this.marcador.redesenhar({ direcao: this.mercado.motor.direcao });
    this.relogios.operacao = 1;
    this.relogios.motor = 1;
  }

  _aoFechar(m) {
    this.abrindo = false;
    this.anim.resultado = 0.0001;
    this.anim.clarao = 1;
    const cor = m.ganhou ? COR.lima : COR.vermelho;
    this.uGrafico.uClarao.value.set(cor[0], cor[1], cor[2], 1);
    this.resultado.redesenhar({ resultado: m.resultado, ganhou: m.ganhou });
    this.resultado.base = { x: EIXO_X - 70, y: this._y(m.ganhou ? m.alvo : m.stop) };
    this.relogios.operacao = 1;
    this.relogios.motor = 1;
  }

  _rotulosDaOperacao() {
    const m = this.mercado.motor;
    this.rotulos.entrada.redesenhar({ nome: 'ENTRADA', preco: m.entrada, cor: '#ffffff' });
    this.rotulos.alvo.redesenhar({ nome: 'ALVO', preco: m.alvo, cor: D.TINTA.lima });
    this.rotulos.stop.redesenhar({ nome: 'STOP', preco: m.stop, cor: D.TINTA.negativo });
  }

  // ───────────── conversões ─────────────
  _y(preco) {
    const me = this.mercado;
    const t = (preco - me.min) / (me.max - me.min);
    return Math.max(QUADRO.y0 + 6, Math.min(QUADRO.y1 - 6, PLOT.yBase + t * (PLOT.yTopo - PLOT.yBase)));
  }

  _niveis() {
    const me = this.mercado;
    const faixa = me.max - me.min;
    const passo = faixa > 7500 ? 2000 : faixa > 3600 ? 1000 : 500;
    const lista = [];
    for (let p = Math.ceil(me.min / passo) * passo; p <= me.max + passo; p += passo) lista.push(p);
    return { passo, lista };
  }

  _estadoDoMotor() {
    const m = this.mercado.motor;
    if (m.estado === 'fechada') return m.ganhou ? 'alvo' : 'stop';
    return m.estado;
  }

  _redesenharTudo() {
    const me = this.mercado, m = me.motor;
    const delta = me.preco - ATIVO.ref24h;
    this.cabecalho.redesenhar({ preco: me.preco, delta, pct: (delta / ATIVO.ref24h) * 100 });
    this.motor.redesenhar({ estado: this._estadoDoMotor(), ciclos: m.ciclos, tempo: this.tempo });
    this.operacao.redesenhar({ estado: m.estado, direcao: m.direcao, entrada: m.entrada, alvo: m.alvo, stop: m.stop, resultado: m.resultado });
    this.contexto.redesenhar({ ind: me.ind });
    this.etiqueta.redesenhar({ preco: Math.round(me.preco) });
    this._eixo();
  }

  _eixo() {
    const topo = QUADRO.y1 - 8;
    this.eixo.redesenhar({
      topo,
      y: (p) => PLOT.yBase + ((p - this.mercado.min) / (this.mercado.max - this.mercado.min)) * (PLOT.yTopo - PLOT.yBase),
      niveis: this._niveis().lista,
      yEtiqueta: this._y(this.mercado.preco),
    });
  }

  // ───────────── quadro a quadro ─────────────
  atualizar(dt) {
    if (!this.pronto) return;
    this.tempo += dt;
    const me = this.mercado;
    me.atualizar(dt);
    const m = me.motor;
    const t = this.tempo;

    // escala do gráfico vai para o shader do vidro (grade)
    const { passo } = this._niveis();
    this.uGrafico.uPlot.value.set(PLOT.yBase, PLOT.yTopo, me.min, me.max);
    this.uGrafico.uPasso.value = passo;
    this.uGrafico.uGradeX.value.y = (me.tempo / me.duracaoVela) * PASSO;

    // varredura enquanto o motor analisa
    const analisando = m.estado === 'analisando' ? 1 : 0;
    this.anim.varrendo += (analisando - this.anim.varrendo) * Math.min(1, dt * 3);
    this.uGrafico.uVarrendo.value = this.anim.varrendo;
    this.uGrafico.uVarredura.value = PLOT.x0 + ((t * 0.55) % 1) * (PLOT.x1 - PLOT.x0 + 40);
    this.anim.clarao = Math.max(0, this.anim.clarao - dt * 0.9);
    this.uGrafico.uClarao.value.w = this.anim.clarao * this.anim.clarao;

    this._velas(t);
    this._linhas(dt);
    this._barras(t);
    this._textos(dt);
  }

  _velas(t) {
    const me = this.mercado, m = me.motor;
    const lista = me.visiveisAgora;
    const n = lista.length;
    const dx = (1 - me.avanco) * PASSO;
    const xDe = (i) => PLOT.x1 - 22 - (n - 1 - i) * PASSO + dx;
    this.xDoIndice = (indice) => xDe(n - 1 - (me.indice - indice));
    const varredura = this.uGrafico.uVarredura.value;

    this.velas.limpar();
    this.volume.limpar();
    for (let i = 0; i < n; i++) {
      const v = lista[i];
      const x = xDe(i);
      const fade = degrau(PLOT.x0 + 2, PLOT.x0 + 34, x);
      if (fade <= 0.001) continue;
      const alta = v.c >= v.o;
      const cor = alta ? COR.alta : COR.baixa;
      const yo = this._y(v.o), yc = this._y(v.c);
      const yh = this._y(v.h), yl = this._y(v.l);

      let brilho = 0.95;
      if (i === n - 1) brilho = 1.15 + 0.25 * Math.sin(t * 7);            // vela em formação
      // a varredura acende as velas por onde passa
      brilho += this.anim.varrendo * 0.55 * Math.exp(-Math.pow((x - varredura) / 30, 2));
      if (m.estado !== 'analisando' && v.i === m.indiceEntrada) brilho += 0.35;

      this.velas.por(x, (yo + yc) / 2, Z.vela, 9.6 * fade, Math.max(3, Math.abs(yc - yo)), 17 * fade, cor, brilho, 1);
      this.velas.por(x, (yh + yl) / 2, Z.vela, 2.2 * fade, Math.max(1, yh - yl), 2.2, cor, brilho * 0.9, 1);

      const alt = Math.min(1.3, v.v) * 104;
      this.volume.por(x, PLOT.yChao + alt / 2, Z.volume, 10.4 * fade, alt, 15, COR.volume, 1.05, 0.62);
    }
    this.velas.enviar();
    this.volume.enviar();

    // média móvel
    const mm = me.mediaMovel(14, n);
    const pts = [];
    for (let i = 0; i < n; i++) pts.push([Math.max(PLOT.x0 + 6, xDe(i)), this._y(mm[i])]);
    this.media.atualizar(pts, Z.media);

    this.xAtual = xDe(n - 1);
  }

  _linhas(dt) {
    const me = this.mercado, m = me.motor;
    const yPreco = this._y(me.preco);

    // preço atual: linha que atravessa o gráfico, ligação e etiqueta
    this.linhaPreco.por(PLOT.x0, yPreco, Z.linhas - 6, this.xAtual - PLOT.x0 - 8);
    this.linhaPreco.uOpacidade.value = 0.22;
    this.ligacao.por(this.xAtual + 8, yPreco, Z.linhas, EIXO_X + 12 - this.xAtual - 8);
    this.ligacao.uOpacidade.value = 0.95;
    this.etiqueta.uPosicao.value.y = yPreco;

    // entrada, alvo e stop
    const aberta = m.estado === 'posicao';
    const alvoAnim = aberta ? 1 : 0;
    const vel = aberta ? 2.4 : 1.6;
    this.anim.linhas += (alvoAnim - this.anim.linhas) * Math.min(1, dt * vel);
    const a = this.anim.linhas;
    const visivel = a > 0.01 && m.estado !== 'analisando' ? a : m.estado === 'analisando' ? a : a;

    const x0 = Math.max(PLOT.x0 + 4, this.xDoIndice ? this.xDoIndice(m.indiceEntrada) : PLOT.x0);
    const comprimento = (PLOT.x1 + 2 - x0) * degrau(0, 1, a);
    const niveis = { entrada: m.entrada, alvo: m.alvo, stop: m.stop };
    let k = 0;
    for (const nome of ['entrada', 'alvo', 'stop']) {
      const y = this._y(niveis[nome]);
      const fita = this.linhas[nome];
      fita.por(x0, y, Z.linhas + k, comprimento);
      fita.uOpacidade.value = visivel * (nome === 'entrada' ? 0.8 : 0.95);
      const r = this.rotulos[nome];
      // o rótulo fica antes da vela de entrada, para não cobrir o que vem depois
      const rx = Math.max(PLOT.x0 + 76, x0 - 80);
      r.uPosicao.value.set(rx, y, Z.rotulos + k);
      r.uOpacidade.value = degrau(0.5, 1, a);
      k++;
    }

    // marcador na vela de entrada
    const velaEntrada = me.velas.find((v) => v.i === m.indiceEntrada) || me.atual;
    const base = m.direcao > 0 ? this._y(velaEntrada.l) - 20 : this._y(velaEntrada.h) + 20;
    this.marcador.uPosicao.value.set(x0, base, Z.rotulos + 4);
    this.marcador.uOpacidade.value = degrau(0.2, 0.8, a) * degrau(PLOT.x0 + 4, PLOT.x0 + 30, x0);

    // resultado sobe e some
    if (this.anim.resultado > 0) {
      this.anim.resultado += dt / 2.3;
      const p = this.anim.resultado;
      if (p >= 1) {
        this.anim.resultado = 0;
        this.resultado.uOpacidade.value = 0;
      } else {
        const b = this.resultado.base;
        const sobe = 1 - Math.pow(1 - p, 3);
        this.resultado.uPosicao.value.set(b.x, b.y + 26 + sobe * 54, Z.etiqueta + 14);
        this.resultado.uOpacidade.value = degrau(0, 0.12, p) * (1 - degrau(0.72, 1, p));
        const pop = 0.8 + 0.2 * degrau(0, 0.18, p);
        this.resultado.uEscalaXY.value.set(pop, pop);
      }
    }
  }

  _barras(t) {
    const m = this.mercado.motor;
    this.barras.limpar();
    this.trilhos.limpar();

    // equalizador do motor: a atividade muda com o estado
    const atividade = m.estado === 'analisando' ? 1 : m.estado === 'posicao' ? 0.62 : 0.28;
    this.atividade = (this.atividade ?? atividade) + (atividade - (this.atividade ?? atividade)) * 0.06;
    const N = 22, larg = 8, passo = 13;
    const x0 = 406 - ((N - 1) * passo) / 2;
    const chao = 281 - 75 + 16;
    for (let i = 0; i < N; i++) {
      const f = i / (N - 1);
      const onda = 0.5 + 0.5 * Math.sin(t * (2.2 + (i % 5) * 0.7) + i * 1.7);
      const onda2 = 0.5 + 0.5 * Math.sin(t * 5.3 + i * 0.6);
      const alt = 5 + 40 * (0.25 + 0.75 * onda * (0.6 + 0.4 * onda2)) * this.atividade;
      this.barras.por(x0 + i * passo, chao + alt / 2, Z.barras, larg, alt, 9, mistura(COR.lima, COR.ciano, f), 1.0, 1);
    }

    // barras do contexto
    const ind = this.mercado.ind;
    const chaves = ['tendencia', 'fluxo', 'volatilidade', 'momento'];
    const largura = 280, esquerda = 406 - 140;
    for (let k = 0; k < 4; k++) {
      const y = -56 - 64 - k * 56 - 20;
      const v = Math.max(0.04, Math.min(1, ind[chaves[k]]));
      this.trilhos.por(406, y, Z.contexto + 5, largura, 8, 5, COR.trilho, 1, 0.75);
      // o preenchimento é feito em gomos, para o degradê ir do lima ao ciano
      const gomos = 14;
      for (let g = 0; g < gomos; g++) {
        const ini = g / gomos, fim = (g + 1) / gomos;
        if (ini >= v) break;
        const ate = Math.min(fim, v);
        const w = (ate - ini) * largura;
        this.barras.por(esquerda + ini * largura + w / 2, y, Z.contexto + 9, w - 1.5, 8, 8, mistura(COR.lima, COR.ciano, (ini + fim) / 2), 1.0, 1);
      }
    }
    this.barras.enviar();
    this.trilhos.enviar();
  }

  _textos(dt) {
    const r = this.relogios;
    const me = this.mercado, m = me.motor;
    for (const k of Object.keys(r)) r[k] += dt;

    if (r.cabecalho > 1 / 8) {
      r.cabecalho = 0;
      const delta = me.preco - ATIVO.ref24h;
      this.cabecalho.redesenhar({ preco: me.preco, delta, pct: (delta / ATIVO.ref24h) * 100 });
      const arredondado = Math.round(me.preco);
      if (arredondado !== this.ultimoPreco) {
        this.ultimoPreco = arredondado;
        this.etiqueta.redesenhar({ preco: arredondado });
      }
    }
    if (r.motor > 1 / 6) {
      r.motor = 0;
      this.motor.redesenhar({ estado: this._estadoDoMotor(), ciclos: m.ciclos, tempo: this.tempo });
    }
    if (r.operacao > 1 / 6) {
      r.operacao = 0;
      this.operacao.redesenhar({ estado: m.estado, direcao: m.direcao, entrada: m.entrada, alvo: m.alvo, stop: m.stop, resultado: m.resultado });
    }
    if (r.eixo > 1 / 6) {
      r.eixo = 0;
      this._eixo();
    }
    if (r.contexto > 1 / 3) {
      r.contexto = 0;
      this.contexto.redesenhar({ ind: me.ind });
    }
  }

  // troca o material de todas as peças: 'solido', 'malha' ou 'luz' (só o que emite, para o brilho)
  vestir(modo) {
    for (const p of this.pecas) {
      if (modo === 'solido' || modo === 'luz') {
        p.objeto.visible = !!p.solido && (modo === 'solido' || p.emite);
        if (p.solido) p.objeto.material = p.solido;
      } else {
        p.objeto.visible = true;
        p.objeto.material = p.malhaMat;
      }
    }
  }
}
