// 7. Track record.
// Números do resumo contando, barras mensais crescendo e a curva de resultado se desenhando
// com a rolagem. Sem o arquivo original do MT5 a curva mostra só o fechamento de cada mês
// (soma dos resultados mensais do resumo) e a lista de ordens fica no estado vazio.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { formatar, revelarTitulo, revelarBlocos, contarAoEntrar, aoEntrar, prepararTraco } from './nucleo.js';
import { RESUMO, curva as curvaLocal, ordens as ordensLocal, normalizar } from './dados-track-record.js';

const DIA = 86400000;
const doisDigitos = (n) => String(n).padStart(2, '0');
const diaMes = (d) => doisDigitos(d.getUTCDate()) + '/' + doisDigitos(d.getUTCMonth() + 1);
const comSinal = (v) => (v > 0 ? '+' : v < 0 ? '-' : '') + formatar(v, 2);

function lerDados(ctx) {
  const externo = normalizar(ctx.opcoes.dados || window.RDX_DATA || null);
  const local = normalizar({ curva: curvaLocal, ordens: ordensLocal });
  return {
    curva: externo.curva.length ? externo.curva : local.curva,
    ordens: externo.ordens.length ? externo.ordens : local.ordens,
  };
}

// Transforma o dado em pontos de 0 a 1 no eixo do tempo.
function montarSerie(dados) {
  if (dados.curva.length >= 2) {
    const inicio = dados.curva[0].data.getTime();
    const fim = dados.curva[dados.curva.length - 1].data.getTime();
    const vao = Math.max(DIA, fim - inicio);
    const pontos = dados.curva.map((p) => ({ x: (p.data.getTime() - inicio) / vao, v: p.acumulado, data: p.data, marca: false }));
    // só quatro pontos ganham rótulo: começo, fim, o mais alto e o mais baixo
    let alto = 0;
    let baixo = 0;
    pontos.forEach((p, i) => { if (p.v > pontos[alto].v) alto = i; if (p.v < pontos[baixo].v) baixo = i; });
    for (const i of new Set([0, pontos.length - 1, alto, baixo])) pontos[i].marca = true;
    return { modo: 'diaria', pontos };
  }

  const inicio = Date.parse(RESUMO.periodo.inicio + 'T00:00:00Z');
  const fim = Date.parse(RESUMO.periodo.fim + 'T00:00:00Z');
  const pontos = [{ x: 0, v: 0, data: new Date(inicio), marca: true }];
  let soma = 0;
  for (const m of RESUMO.mensal) {
    soma += m.resultado;
    const t = Date.parse(m.fecha + 'T00:00:00Z');
    pontos.push({ x: (t - inicio) / (fim - inicio), v: Math.round(soma * 100) / 100, data: new Date(t), marca: true });
  }
  return { modo: 'mensal', pontos };
}

function escala(pontos) {
  const valores = pontos.map((p) => p.v);
  const maior = Math.max(0, ...valores);
  const menor = Math.min(0, ...valores);
  const vao = Math.max(1, maior - menor);
  const passo = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000].find((s) => vao / s <= 4) || 10000;
  const topo = Math.ceil(maior / passo) * passo || passo;
  const base = Math.floor(menor / passo) * passo;
  const marcas = [];
  for (let v = base; v <= topo + 0.001; v += passo) marcas.push(v);
  return { base, topo, marcas };
}

function criarCurva(painel, serie, ctx) {
  const area = painel.querySelector('.rx-curva-area');
  const svg = painel.querySelector('.rx-curva-svg');
  const grupoLinhas = svg.querySelector('.rx-curva-linhas');
  const fundo = svg.querySelector('.rx-curva-fundo');
  const traco = svg.querySelector('.rx-curva-traco');
  const recorte = svg.querySelector('.rx-curva-recorte');
  const eixo = painel.querySelector('.rx-curva-eixo-y');
  const lista = painel.querySelector('.rx-curva-pontos');
  const marca = painel.querySelector('[data-rx-curva-modo]');
  const nota = painel.querySelector('[data-rx-curva-nota]');

  const original = {
    viewBox: svg.getAttribute('viewBox'),
    linhas: grupoLinhas.innerHTML,
    fundo: fundo.getAttribute('d'),
    traco: traco.getAttribute('d'),
    eixo: eixo.innerHTML,
    lista: lista.innerHTML,
    marca: marca.textContent,
    nota: nota.textContent,
    notaOculta: nota.hidden,
  };

  const { base, topo, marcas } = escala(serie.pontos);
  const altura = (v) => 0.95 - ((v - base) / (topo - base)) * 0.9;     // 0 a 1, de cima para baixo

  if (serie.modo === 'diaria') {
    painel.classList.add('rx-curva-cheia');
    marca.textContent = 'Curva diária';
    nota.hidden = true;
  }

  // eixo e pontos em HTML, por cima do desenho (texto não pode esticar junto com o SVG)
  eixo.innerHTML = marcas.map((v) => '<span style="bottom:' + ((1 - altura(v)) * 100).toFixed(2) + '%">' + formatar(v, 0).replace(/^/, v < 0 ? '-' : '') + '</span>').join('');
  const marcados = serie.pontos.filter((p) => p.marca);
  lista.innerHTML = marcados.map((p, i) => {
    const esquerda = p.x > 0.7 ? ' class="rx-ponto-esq"' : '';
    const valor = i === 0 && p.v === 0 ? '0,00' : comSinal(p.v);
    return '<li' + esquerda + ' style="left:' + (p.x * 100).toFixed(2) + '%;bottom:' + ((1 - altura(p.v)) * 100).toFixed(2) + '%"><i></i><span><b>' + valor + '</b>' + diaMes(p.data) + '</span></li>';
  }).join('');
  const itens = gsap.utils.toArray(lista.children).map((el, i) => ({ el, x: marcados[i].x, aceso: true }));

  let largura = 1000;
  let comprimento = 1;

  function desenhar() {
    const caixa = area.getBoundingClientRect();
    largura = Math.max(10, Math.round(caixa.width));
    const alto = Math.max(10, Math.round(caixa.height));
    svg.setAttribute('viewBox', '0 0 ' + largura + ' ' + alto);
    grupoLinhas.innerHTML = marcas
      .map((v) => '<path' + (v === 0 ? ' class="rx-curva-zero"' : '') + ' d="M0 ' + (altura(v) * alto).toFixed(1) + 'H' + largura + '"/>')
      .join('');
    const d = serie.pontos
      .map((p, i) => (i ? 'L' : 'M') + (p.x * largura).toFixed(1) + ' ' + (altura(p.v) * alto).toFixed(1))
      .join('');
    traco.setAttribute('d', d);
    fundo.setAttribute('d', d + 'V' + (altura(base) * alto).toFixed(1) + 'H0Z');
    recorte.setAttribute('height', alto);
    comprimento = traco.getTotalLength();
  }

  const estado = { p: ctx.anima ? 0 : 1 };
  function aplicar() {
    const ponta = traco.getPointAtLength(comprimento * estado.p);
    traco.style.strokeDashoffset = (1 - estado.p).toFixed(4);
    recorte.setAttribute('width', Math.max(0, estado.p >= 0.999 ? largura : ponta.x).toFixed(1));
    const fracao = estado.p >= 0.999 ? 1.01 : ponta.x / largura;
    for (const item of itens) {
      const aceso = estado.p > 0.001 && fracao >= item.x - 0.004;
      if (aceso === item.aceso) continue;
      item.aceso = aceso;
      gsap.to(item.el, { autoAlpha: aceso ? 1 : 0, scale: aceso ? 1 : 0.4, duration: aceso ? 0.7 : 0.3, ease: aceso ? 'back.out(2.2)' : 'power2.in', overwrite: true });
    }
  }

  painel.classList.add('rx-curva-viva');
  desenhar();

  let limparAnimacao = () => {};
  if (ctx.anima) {
    prepararTraco(traco);
    itens.forEach((item) => { item.aceso = false; gsap.set(item.el, { autoAlpha: 0, scale: 0.4 }); });
    aplicar();
    const tween = gsap.to(estado, {
      p: 1,
      ease: 'none',          // posição ligada à rolagem; a suavidade vem do scrub
      onUpdate: aplicar,
      scrollTrigger: {
        trigger: area,
        start: 'top 84%',
        end: 'bottom 74%',
        scrub: 0.7,
        invalidateOnRefresh: true,
      },
    });
    limparAnimacao = () => { tween.scrollTrigger && tween.scrollTrigger.kill(); tween.kill(); };
  } else {
    recorte.setAttribute('width', largura);
  }

  const aoMedir = () => { desenhar(); aplicar(); };
  ScrollTrigger.addEventListener('refreshInit', aoMedir);

  return () => {
    ScrollTrigger.removeEventListener('refreshInit', aoMedir);
    limparAnimacao();
    painel.classList.remove('rx-curva-viva', 'rx-curva-cheia');
    svg.setAttribute('viewBox', original.viewBox);
    grupoLinhas.innerHTML = original.linhas;
    fundo.setAttribute('d', original.fundo);
    traco.setAttribute('d', original.traco);
    traco.style.strokeDashoffset = '';
    traco.style.strokeDasharray = '';
    recorte.setAttribute('width', '1000');
    recorte.setAttribute('height', '400');
    eixo.innerHTML = original.eixo;
    lista.innerHTML = original.lista;
    marca.textContent = original.marca;
    nota.textContent = original.nota;
    nota.hidden = original.notaOculta;
  };
}

// Tabela de ordens: as colunas saem das chaves do primeiro registro.
function criarOrdens(painel, ordens) {
  const vazio = painel.querySelector('[data-rx-ordens-vazio]');
  const tabela = painel.querySelector('[data-rx-ordens-tabela]');
  const conta = painel.querySelector('[data-rx-ordens-conta]');
  if (!ordens.length) return () => {};

  const textoConta = conta.textContent;
  const colunas = Object.keys(ordens[0]);
  const numerica = (c) => ordens.every((o) => o[c] === null || o[c] === undefined || typeof o[c] === 'number');
  const tipos = colunas.map(numerica);
  const celula = (valor, ehNumero) => {
    if (valor === null || valor === undefined) return '';
    if (ehNumero) return formatar(valor, Number.isInteger(valor) ? 0 : 2).replace(/^/, valor < 0 ? '-' : '');
    return String(valor).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  };

  tabela.innerHTML =
    '<table><thead><tr>' +
    colunas.map((c, i) => '<th' + (tipos[i] ? ' class="rx-num"' : '') + ' scope="col">' + celula(c, false) + '</th>').join('') +
    '</tr></thead><tbody>' +
    ordens.map((o) => '<tr>' + colunas.map((c, i) => {
      const classes = [];
      if (tipos[i]) classes.push('rx-num');
      if (tipos[i] && /result|lucro|profit|pnl/i.test(c)) classes.push(o[c] > 0 ? 'rx-positivo' : o[c] < 0 ? 'rx-negativo' : 'rx-neutro');
      return '<td' + (classes.length ? ' class="' + classes.join(' ') + '"' : '') + '>' + celula(o[c], tipos[i]) + '</td>';
    }).join('') + '</tr>').join('') +
    '</tbody></table>';
  tabela.setAttribute('data-lenis-prevent', '');
  tabela.setAttribute('tabindex', '0');
  tabela.hidden = false;
  vazio.hidden = true;
  conta.textContent = ordens.length + ' ordens';

  return () => {
    tabela.innerHTML = '';
    tabela.hidden = true;
    vazio.hidden = false;
    conta.textContent = textoConta;
  };
}

export function iniciarTrackRecord(ctx) {
  const secao = ctx.raiz.querySelector('#track-record');
  if (!secao) return null;
  const limpezas = [];

  const dados = lerDados(ctx);
  const serie = montarSerie(dados);

  limpezas.push(criarCurva(secao.querySelector('[data-rx-curva]'), serie, ctx));
  limpezas.push(criarOrdens(secao.querySelector('[data-rx-ordens]'), dados.ordens));

  if (!ctx.anima) return () => limpezas.forEach((f) => f());

  revelarBlocos(secao.querySelectorAll('[data-rx-revela]'), { y: 14 });
  secao.querySelectorAll('[data-rx-titulo]').forEach((el) => revelarTitulo(el, { cascata: el.matches('h2') ? 0.09 : 0.05 }));

  // o número grande do período
  limpezas.push(contarAoEntrar(secao.querySelector('.rx-tr-abre'), { inicio: 'top 86%', atraso: 0.2, cascata: 0.2, duracao: 2.2 }));

  // a janela abre de cima para baixo
  const janela = secao.querySelector('.rx-tr-janela');
  gsap.set(janela, { clipPath: 'inset(0% 0% 100% 0%)' });
  aoEntrar(janela, () => gsap.to(janela, {
    clipPath: 'inset(0% 0% 0% 0%)',
    duration: 1.6,
    ease: 'power4.inOut',
    onComplete: () => gsap.set(janela, { clearProps: 'clipPath' }),
  }), 'top 86%');

  // destaques: números contando e a barra de ganhos, perdas e zerada
  const destaques = secao.querySelector('.rx-tr-destaques');
  limpezas.push(contarAoEntrar(destaques, { inicio: 'top 82%', atraso: 0.5, cascata: 0.1, duracao: 2.2 }));
  const partes = destaques.querySelectorAll('.rx-tr-partes i');
  gsap.set(partes, { scaleX: 0 });
  aoEntrar(destaques, () => gsap.to(partes, { scaleX: 1, duration: 1.4, ease: 'power4.inOut', stagger: 0.16, delay: 0.7 }), 'top 82%');

  // barras mensais
  const mensal = secao.querySelector('.rx-tr-mensal');
  const barras = mensal.querySelectorAll('.rx-barras i');
  gsap.set(barras, { scaleY: 0 });
  aoEntrar(mensal, () => gsap.to(barras, { scaleY: 1, duration: 1.5, ease: 'expo.out', stagger: 0.14 }), 'top 84%');
  limpezas.push(contarAoEntrar(mensal, { inicio: 'top 84%', cascata: 0.14, duracao: 1.6 }));

  // ordens por core
  const porCore = secao.querySelector('.rx-tr-porcore');
  const faixas = porCore.querySelectorAll('.rx-porcore i');
  gsap.set(faixas, { scaleX: 0 });
  aoEntrar(porCore, () => gsap.to(faixas, { scaleX: 1, duration: 1.4, ease: 'power4.inOut', stagger: 0.1 }), 'top 88%');
  limpezas.push(contarAoEntrar(porCore, { inicio: 'top 88%', cascata: 0.1, duracao: 1.4 }));

  // lista de números
  const lista = secao.querySelector('.rx-tr-lista');
  limpezas.push(contarAoEntrar(lista, { inicio: 'top 88%', cascata: 0.08, duracao: 1.8 }));
  revelarBlocos(lista.querySelectorAll('dt'), { y: 14, inicio: 'top 92%', cascata: 0.06 });

  revelarBlocos(secao.querySelectorAll('.rx-tr-ordens'), { y: 20 });

  return () => limpezas.forEach((f) => f());
}
