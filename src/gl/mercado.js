// Simulação do mercado e do motor operando. Só números: quem desenha é o terminal.
//
// O motor passa por três estados, em ciclo:
//   analisando -> posicao (entrada, alvo e stop definidos) -> fechada (alvo ou stop) -> analisando
//
// IMPORTANTE: tudo aqui é ilustrativo. Nada vem de conta real.

export const ATIVO = {
  par: 'BTC/USDT',
  nome: 'Bitcoin / Tether USDT',
  preco: 129320.45,
  ref24h: 126194.85,
  lote: 0.1,
  core: 'GT Core 02',
};

// de cada 5 operações, 4 batem o alvo: acompanha a taxa do track record real (79,2%)
const CHANCE_DE_ALVO = 0.79;

function sorteio(semente) {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Mercado {
  constructor({ visiveis = 46, duracaoVela = 1.35 } = {}) {
    this.visiveis = visiveis;
    this.duracaoVela = duracaoVela;
    this.rnd = sorteio(20260929);
    this.tempo = 0;
    this.relogio = 0;
    this.indice = 0;            // número da vela em formação (cresce para sempre)
    this.aoAbrir = null;
    this.aoFechar = null;
    this.aoFecharVela = null;

    this.motor = {
      estado: 'analisando',
      t: 0,
      espera: 3.2,
      direcao: 1,
      entrada: 0, alvo: 0, stop: 0,
      indiceEntrada: 0,
      vaiGanhar: true,
      resultado: 0,
      ganhou: true,
      ciclos: 1284,
      acertos: 0,
      total: 0,
    };

    this.ind = { tendencia: 0.7, fluxo: 0.62, volatilidade: 0.45, momento: 0.66 };
    this._semear();
  }

  _semear() {
    const r = this.rnd;
    this.velas = [];
    let p = 124650;
    const total = this.visiveis + 26;
    for (let i = 0; i < total; i++) {
      const tendencia = 60 + 45 * Math.sin(i * 0.31);
      const corpo = (r() - 0.43) * 1050 + tendencia * 0.5;
      const o = p, c = o + corpo;
      this.velas.push({
        o, c,
        h: Math.max(o, c) + r() * 300,
        l: Math.min(o, c) - r() * 300,
        v: 0.18 + r() * 0.5 + Math.abs(corpo) / 900,
        i: i - total,
      });
      p = c;
    }
    const desvio = ATIVO.preco - p;
    for (const v of this.velas) { v.o += desvio; v.h += desvio; v.l += desvio; v.c += desvio; }
    this.preco = ATIVO.preco;
    this.min = 124600;
    this.max = 130300;
    this._novaVela();
  }

  _novaVela() {
    const r = this.rnd;
    const o = this.preco;
    const m = this.motor;
    this.atual = { o, h: o, l: o, c: o, v: 0.05, i: this.indice };

    if (m.estado === 'posicao') {
      // caminha na direção do desfecho sorteado, com recuos no meio do caminho
      const destino = m.vaiGanhar ? m.alvo : m.stop;
      const falta = destino - o;
      const passo = falta * (0.22 + r() * 0.30);
      const recuo = (r() - 0.62) * Math.abs(m.alvo - m.entrada) * 0.55 * Math.sign(falta);
      this.alvoVela = o + passo + recuo;
    } else {
      const centro = 129300 + 1100 * Math.sin(this.tempo * 0.07);
      this.alvoVela = o + (r() - 0.47) * 900 + (centro - o) * 0.16;
    }
    this.volAlvo = 0.2 + r() * 0.75 + (m.estado === 'posicao' ? 0.25 : 0);
  }

  _abrir() {
    const r = this.rnd;
    const m = this.motor;
    m.estado = 'posicao';
    m.t = 0;
    m.direcao = r() < 0.72 ? 1 : -1;
    m.entrada = this.preco;
    const alcance = 720 + r() * 420;
    m.alvo = m.entrada + m.direcao * alcance;
    m.stop = m.entrada - m.direcao * alcance * (0.58 + r() * 0.10);
    m.indiceEntrada = this.indice;
    m.vaiGanhar = r() < CHANCE_DE_ALVO;
    m.resultado = 0;
    this._novaVela();
    this.relogio = 0;
    if (this.aoAbrir) this.aoAbrir(m);
  }

  _fechar(ganhou, precoSaida) {
    const m = this.motor;
    m.estado = 'fechada';
    m.t = 0;
    m.ganhou = ganhou;
    m.resultado = (precoSaida - m.entrada) * m.direcao * ATIVO.lote;
    m.ciclos++;
    m.total++;
    if (ganhou) m.acertos++;
    m.espera = 2.6;
    if (this.aoFechar) this.aoFechar(m);
  }

  atualizar(dt) {
    this.tempo += dt;
    this.relogio += dt;
    const r = this.rnd;
    const m = this.motor;
    m.t += dt;

    const k = Math.min(1, this.relogio / this.duracaoVela);
    const guia = this.atual.o + (this.alvoVela - this.atual.o) * (k * k * (3 - 2 * k));
    this.preco += (guia - this.preco) * Math.min(1, dt * 7) + (r() - 0.5) * 34 * Math.sqrt(dt * 60);
    const a = this.atual;
    a.c = this.preco;
    a.h = Math.max(a.h, a.c);
    a.l = Math.min(a.l, a.c);
    a.v += (this.volAlvo - a.v) * Math.min(1, dt * 1.6);

    // motor
    if (m.estado === 'analisando' && m.t > m.espera) {
      this._abrir();
    } else if (m.estado === 'posicao') {
      m.resultado = (this.preco - m.entrada) * m.direcao * ATIVO.lote;
      const bateuAlvo = (this.preco - m.alvo) * m.direcao >= 0;
      const bateuStop = (this.preco - m.stop) * m.direcao <= 0;
      if (bateuAlvo) this._fechar(true, m.alvo);
      else if (bateuStop) this._fechar(false, m.stop);
    } else if (m.estado === 'fechada' && m.t > m.espera) {
      m.estado = 'analisando';
      m.t = 0;
      m.espera = 3.0 + r() * 2.2;
    }

    if (this.relogio >= this.duracaoVela) {
      this.relogio = 0;
      this.velas.push(a);
      if (this.velas.length > this.visiveis + 30) this.velas.shift();
      this.indice++;
      this._novaVela();
      if (this.aoFecharVela) this.aoFecharVela(this);
    }

    // escala vertical: acompanha as velas visíveis e as linhas da operação
    const vis = this.velas.slice(-this.visiveis);
    let lo = a.l, hi = a.h;
    for (const v of vis) { if (v.l < lo) lo = v.l; if (v.h > hi) hi = v.h; }
    if (m.estado !== 'analisando') {
      lo = Math.min(lo, m.alvo, m.stop);
      hi = Math.max(hi, m.alvo, m.stop);
    }
    const folga = (hi - lo) * 0.10 + 80;
    const s = Math.min(1, dt * 2.0);
    this.min += (lo - folga - this.min) * s;
    this.max += (hi + folga - this.max) * s;

    this._indicadores(dt, vis);
  }

  _indicadores(dt, vis) {
    const recente = vis.slice(-8);
    const inclinacao = (recente[recente.length - 1].c - recente[0].c) / 2400;
    let amplitude = 0;
    for (const v of recente) amplitude += v.h - v.l;
    amplitude /= recente.length;
    const alvo = {
      tendencia: 0.5 + Math.max(-0.45, Math.min(0.45, inclinacao)),
      volatilidade: Math.max(0.12, Math.min(0.95, amplitude / 900)),
      fluxo: 0.58 + 0.30 * Math.sin(this.tempo * 0.43) * Math.cos(this.tempo * 0.17),
      momento: 0.60 + 0.28 * Math.sin(this.tempo * 0.31 + 1.7),
    };
    const s = Math.min(1, dt * 1.4);
    for (const c of Object.keys(alvo)) this.ind[c] += (alvo[c] - this.ind[c]) * s;
  }

  // velas que aparecem no gráfico, da mais antiga para a atual
  get visiveisAgora() {
    return this.velas.slice(-(this.visiveis + 1)).concat(this.atual);
  }

  get avanco() {
    return this.relogio / this.duracaoVela;
  }

  mediaMovel(periodo, quantidade) {
    const todas = this.velas.concat(this.atual);
    const saida = [];
    for (let i = todas.length - quantidade; i < todas.length; i++) {
      let soma = 0, cont = 0;
      for (let k = Math.max(0, i - periodo + 1); k <= i; k++) { soma += todas[k].c; cont++; }
      saida.push(soma / cont);
    }
    return saida;
  }
}
