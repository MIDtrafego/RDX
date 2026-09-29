// O que vai escrito nos cartões do terminal. Tudo desenhado em canvas 2D, em alta resolução.
import { ATIVO } from '../mercado.js';

const SANS = "'IBM Plex Sans', Arial, sans-serif";
const MONO = "'IBM Plex Mono', Consolas, monospace";

export const TINTA = {
  branco: '#ffffff',
  texto: '#d9ecee',
  apagado: '#7fa3a9',
  verde: '#4ade80',
  lima: '#c8f52a',
  ciano: '#22e3d6',
  positivo: '#1fe6b5',
  negativo: '#ff4d5e',
};

export const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
export const nf2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function carregarFontes() {
  const lista = ['400 14px', '600 14px', '700 14px'].map((f) => f + " 'IBM Plex Sans'")
    .concat(['500 14px', '600 14px'].map((f) => f + " 'IBM Plex Mono'"));
  try {
    await Promise.all(lista.map((f) => document.fonts.load(f)));
  } catch (e) { /* segue com a fonte do sistema */ }
}

export function caixa(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function espacado(c, texto, x, y, espaco) {
  c.letterSpacing = espaco + 'px';
  c.fillText(texto, x, y);
  c.letterSpacing = '0px';
}

export function fundoCartao(c, w, h, r = 16) {
  caixa(c, 1, 1, w - 2, h - 2, r);
  const g = c.createLinearGradient(0, 0, w * 0.35, h);
  g.addColorStop(0, 'rgba(15, 44, 46, 0.88)');
  g.addColorStop(1, 'rgba(4, 14, 17, 0.92)');
  c.fillStyle = g;
  c.fill();

  // reflexo no topo do vidro
  c.save();
  c.clip();
  const l = c.createLinearGradient(0, 0, 0, h * 0.5);
  l.addColorStop(0, 'rgba(160, 255, 235, 0.10)');
  l.addColorStop(1, 'rgba(160, 255, 235, 0)');
  c.fillStyle = l;
  c.fillRect(0, 0, w, h * 0.5);
  c.restore();

  caixa(c, 1, 1, w - 2, h - 2, r);
  const b = c.createLinearGradient(0, 0, w, h);
  b.addColorStop(0, 'rgba(130, 255, 225, 0.70)');
  b.addColorStop(0.5, 'rgba(60, 200, 190, 0.24)');
  b.addColorStop(1, 'rgba(200, 245, 42, 0.55)');
  c.strokeStyle = b;
  c.lineWidth = 1.5;
  c.stroke();
}

function titulo(c, texto, x, y, cor = TINTA.lima) {
  c.font = '700 10.5px ' + SANS;
  c.fillStyle = cor;
  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
  espacado(c, texto, x, y, 2.4);
}

function seta(c, x, y, tam, sobe, cor, espessura = 2.6) {
  c.save();
  c.translate(x, y);
  if (!sobe) c.scale(1, -1);
  c.strokeStyle = cor;
  c.lineWidth = espessura;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(-tam, tam); c.lineTo(tam, -tam);
  c.moveTo(-tam * 0.35, -tam); c.lineTo(tam, -tam); c.lineTo(tam, tam * 0.35);
  c.stroke();
  c.restore();
}

// ───────────── cabeçalho ─────────────
export function desenharCabecalho(c, w, h, d) {
  fundoCartao(c, w, h, 18);

  c.fillStyle = TINTA.lima;
  caixa(c, 14, 22, 4, h - 44, 2);
  c.fill();

  // moeda
  const cx = 56, cy = h / 2, r = 23;
  const g = c.createRadialGradient(cx - 7, cy - 8, 2, cx, cy, r);
  g.addColorStop(0, '#f7a531');
  g.addColorStop(1, '#d96a06');
  c.fillStyle = g;
  c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(255, 220, 150, 0.7)';
  c.lineWidth = 1.2;
  c.beginPath(); c.arc(cx, cy, r - 3.5, 0, Math.PI * 2); c.stroke();
  // o B do bitcoin: a letra mais os dois traços que atravessam
  c.save();
  c.translate(cx + 0.5, cy + 1);
  c.rotate(0.22);
  c.fillStyle = '#ffffff';
  c.font = '700 27px ' + SANS;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('B', 0, 0.5);
  c.fillRect(-5.2, -14.5, 2.6, 5);
  c.fillRect(0.2, -14.5, 2.6, 5);
  c.fillRect(-5.2, 9.5, 2.6, 5);
  c.fillRect(0.2, 9.5, 2.6, 5);
  c.restore();

  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
  c.fillStyle = TINTA.branco;
  c.font = '700 27px ' + SANS;
  c.fillText(ATIVO.par, 92, 42);
  c.fillStyle = TINTA.apagado;
  c.font = '400 13.5px ' + SANS;
  c.fillText(ATIVO.nome, 93, 64);

  // último preço
  c.fillStyle = TINTA.apagado;
  c.font = '600 9.5px ' + SANS;
  espacado(c, 'ÚLTIMO PREÇO', 302, 28, 1.8);
  c.fillStyle = TINTA.branco;
  c.font = '600 30px ' + MONO;
  c.fillText(nf2.format(d.preco), 300, 66);

  // variação em %
  const cor = d.delta >= 0 ? TINTA.positivo : TINTA.negativo;
  const px = 514, pw = 124, ph = 46, py = (h - ph) / 2;
  caixa(c, px, py, pw, ph, 10);
  c.fillStyle = d.delta >= 0 ? 'rgba(31, 230, 181, 0.12)' : 'rgba(255, 77, 94, 0.12)';
  c.fill();
  c.strokeStyle = cor;
  c.lineWidth = 1.5;
  c.stroke();
  seta(c, px + 23, h / 2, 6.5, d.delta >= 0, cor);
  c.fillStyle = cor;
  c.font = '600 22px ' + MONO;
  c.textAlign = 'left';
  c.fillText(nf2.format(Math.abs(d.pct)) + '%', px + 40, h / 2 + 8);

  // variação em 24h
  c.fillStyle = TINTA.apagado;
  c.font = '600 9.5px ' + SANS;
  espacado(c, 'VARIAÇÃO 24H', 658, 28, 1.8);
  c.fillStyle = cor;
  c.font = '600 19px ' + MONO;
  c.fillText((d.delta >= 0 ? '+' : '-') + nf2.format(Math.abs(d.delta)), 657, 63);
}

// ───────────── motor ─────────────
const ESTADOS = {
  analisando: { nome: 'ANALISANDO', cor: TINTA.lima },
  posicao: { nome: 'POSIÇÃO ABERTA', cor: TINTA.ciano },
  alvo: { nome: 'ALVO ATINGIDO', cor: TINTA.verde },
  stop: { nome: 'STOP ACIONADO', cor: TINTA.negativo },
};

export function desenharMotor(c, w, h, d) {
  fundoCartao(c, w, h);
  titulo(c, 'MOTOR RDX', 20, 30);

  c.fillStyle = TINTA.apagado;
  c.font = '500 11px ' + MONO;
  c.textAlign = 'right';
  c.fillText(ATIVO.core + ' · ciclo ' + nf0.format(d.ciclos), w - 20, 30);

  const e = ESTADOS[d.estado];
  const pulso = 0.5 + 0.5 * Math.sin(d.tempo * 5.0);
  c.fillStyle = e.cor;
  c.globalAlpha = 0.25 + 0.3 * pulso;
  c.beginPath(); c.arc(28, 60, 9 + 3 * pulso, 0, Math.PI * 2); c.fill();
  c.globalAlpha = 1;
  c.beginPath(); c.arc(28, 60, 5, 0, Math.PI * 2); c.fill();

  c.textAlign = 'left';
  c.fillStyle = TINTA.branco;
  c.font = '700 22px ' + SANS;
  espacado(c, e.nome, 46, 68, 0.6);
}

// ───────────── operação ─────────────
export function desenharOperacao(c, w, h, d) {
  fundoCartao(c, w, h);
  titulo(c, 'OPERAÇÃO', 20, 30);

  // selo de direção
  const aberta = d.estado !== 'analisando';
  const texto = !aberta ? 'AGUARDANDO' : d.direcao > 0 ? 'COMPRA' : 'VENDA';
  c.font = '700 10.5px ' + SANS;
  c.letterSpacing = '1.6px';
  const tw = c.measureText(texto).width + 22;
  c.letterSpacing = '0px';
  const sx = w - 18 - tw;
  caixa(c, sx, 14, tw, 24, 6);
  if (!aberta) {
    c.strokeStyle = 'rgba(127, 163, 169, 0.6)'; c.lineWidth = 1.2; c.stroke();
    c.fillStyle = TINTA.apagado;
  } else {
    const cor = d.direcao > 0 ? TINTA.lima : TINTA.negativo;
    c.fillStyle = d.direcao > 0 ? 'rgba(200, 245, 42, 0.14)' : 'rgba(255, 77, 94, 0.16)';
    c.fill();
    c.strokeStyle = cor; c.lineWidth = 1.4; c.stroke();
    c.fillStyle = cor;
  }
  c.textAlign = 'left';
  espacado(c, texto, sx + 11, 30.5, 1.6);

  const linhas = [
    ['Entrada', aberta ? nf0.format(d.entrada) : '—', TINTA.branco],
    ['Alvo', aberta ? nf0.format(d.alvo) : '—', TINTA.lima],
    ['Stop', aberta ? nf0.format(d.stop) : '—', TINTA.negativo],
  ];
  let y = 72;
  for (const [rotulo, valor, cor] of linhas) {
    c.fillStyle = TINTA.apagado;
    c.font = '400 15px ' + SANS;
    c.textAlign = 'left';
    c.fillText(rotulo, 20, y);
    c.fillStyle = cor;
    c.font = '600 19px ' + MONO;
    c.textAlign = 'right';
    c.fillText(valor, w - 20, y + 1);
    c.strokeStyle = 'rgba(120, 220, 210, 0.16)';
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(20, y + 13.5); c.lineTo(w - 20, y + 13.5); c.stroke();
    y += 40;
  }

  // resultado
  c.fillStyle = TINTA.apagado;
  c.font = '600 9.5px ' + SANS;
  c.textAlign = 'left';
  espacado(c, 'RESULTADO', 20, h - 27, 1.8);
  const r = d.resultado;
  c.fillStyle = !aberta ? TINTA.apagado : r >= 0 ? TINTA.positivo : TINTA.negativo;
  c.font = '600 24px ' + MONO;
  c.textAlign = 'right';
  c.fillText(!aberta ? '—' : (r >= 0 ? '+' : '-') + 'US$ ' + nf2.format(Math.abs(r)), w - 20, h - 20);
}

// ───────────── contexto ─────────────
export const CONTEXTO = [
  ['tendencia', 'Tendência de curto prazo', ['Baixa', 'Lateral', 'Alta']],
  ['fluxo', 'Fluxo institucional', ['Negativo', 'Neutro', 'Positivo']],
  ['volatilidade', 'Volatilidade', ['Baixa', 'Neutra', 'Alta']],
  ['momento', 'Momento', ['Desfavorável', 'Neutro', 'Favorável']],
];

export function desenharContexto(c, w, h, d) {
  fundoCartao(c, w, h);
  titulo(c, 'CONTEXTO DA DECISÃO', 20, 30);
  let y = 64;
  for (const [chave, rotulo, niveis] of CONTEXTO) {
    const v = d.ind[chave];
    const nivel = niveis[v < 0.38 ? 0 : v < 0.62 ? 1 : 2];
    c.fillStyle = TINTA.texto;
    c.font = '400 14px ' + SANS;
    c.textAlign = 'left';
    c.fillText(rotulo, 20, y);
    c.fillStyle = TINTA.branco;
    c.font = '600 13px ' + SANS;
    c.textAlign = 'right';
    c.fillText(nivel, w - 20, y);
    y += 56;
  }
}

// ───────────── eixo de preço ─────────────
export function desenharEixo(c, w, h, d) {
  // d: { topo, y(preco), niveis[], yEtiqueta }
  c.strokeStyle = 'rgba(225, 245, 248, 0.85)';
  c.lineWidth = 1.6;
  c.beginPath(); c.moveTo(2, 0); c.lineTo(2, h); c.stroke();
  c.font = '500 14.5px ' + MONO;
  c.textBaseline = 'middle';
  c.textAlign = 'left';
  for (const p of d.niveis) {
    const y = d.topo - d.y(p);
    if (y < 8 || y > h - 8) continue;
    c.strokeStyle = 'rgba(225, 245, 248, 0.85)';
    c.beginPath(); c.moveTo(2, y); c.lineTo(10, y); c.stroke();
    const dist = Math.abs(y - (d.topo - d.yEtiqueta));
    c.globalAlpha = Math.max(0, Math.min(1, (dist - 20) / 12));
    c.fillStyle = TINTA.texto;
    c.fillText(nf0.format(p), 16, y + 1);
    c.globalAlpha = 1;
  }
}

// ───────────── etiquetas pequenas ─────────────
export function desenharEtiqueta(c, w, h, d) {
  caixa(c, 1.5, 1.5, w - 3, h - 3, 8);
  c.fillStyle = '#0b4f16';
  c.fill();
  c.strokeStyle = '#dcff2e';
  c.lineWidth = 2;
  c.stroke();
  c.fillStyle = '#ffffff';
  c.font = '600 17px ' + MONO;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(nf0.format(d.preco), w / 2, h / 2 + 1);
}

export function desenharRotuloLinha(c, w, h, d) {
  caixa(c, 0.5, 0.5, w - 1, h - 1, 5);
  c.fillStyle = 'rgba(3, 12, 14, 0.90)';
  c.fill();
  c.strokeStyle = d.cor;
  c.lineWidth = 1;
  c.stroke();
  c.fillStyle = d.cor;
  caixa(c, 0.5, 0.5, 4, h - 1, 2);
  c.fill();
  c.font = '700 9px ' + SANS;
  c.textBaseline = 'middle';
  c.textAlign = 'left';
  espacado(c, d.nome, 11, h / 2 + 0.5, 1.4);
  c.fillStyle = '#ffffff';
  c.font = '600 12px ' + MONO;
  c.textAlign = 'right';
  c.fillText(nf0.format(d.preco), w - 8, h / 2 + 1);
}

export function desenharResultado(c, w, h, d) {
  const cor = d.ganhou ? TINTA.lima : TINTA.negativo;
  caixa(c, 1.5, 1.5, w - 3, h - 3, 10);
  c.fillStyle = d.ganhou ? 'rgba(12, 60, 14, 0.94)' : 'rgba(70, 10, 18, 0.94)';
  c.fill();
  c.strokeStyle = cor;
  c.lineWidth = 2;
  c.stroke();
  c.fillStyle = cor;
  c.font = '600 21px ' + MONO;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText((d.resultado >= 0 ? '+' : '-') + 'US$ ' + nf2.format(Math.abs(d.resultado)), w / 2, h / 2 + 1);
}

export function desenharMarcador(c, w, h, d) {
  const cor = d.direcao > 0 ? TINTA.lima : TINTA.negativo;
  c.save();
  c.translate(w / 2, h / 2);
  if (d.direcao < 0) c.scale(1, -1);
  c.fillStyle = cor;
  c.shadowColor = cor;
  c.shadowBlur = 8;
  c.beginPath();
  c.moveTo(0, -9); c.lineTo(9, 7); c.lineTo(-9, 7);
  c.closePath();
  c.fill();
  c.restore();
}
