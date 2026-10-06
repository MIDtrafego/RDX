// Janela dos termos.
//
//   • o texto dos documentos (Termos de Uso e Aviso de Risco) vem de
//     /src/conta/documentos.html por fetch, na primeira abertura
//   • duas abas no cabeçalho levam ao início de cada documento
//   • a janela registra quando a pessoa rolou cada documento até o fim
//     (leuTermos e leuRisco), quanto tempo ficou com a janela aberta e quanto
//     tempo cada documento ficou sob os olhos (tempoTermosMs e tempoRiscoMs)
//   • hashes(): SHA-256 do texto exato de cada documento (Termos, cláusula 16.2)
//   • "Li e aceito os termos" só liga depois dos dois documentos lidos;
//     ao clicar chama aoAceitar e fecha
//   • o foco fica preso dentro da janela (Tab e Shift+Tab dão a volta)
//   • o resto da página fica inerte e o fundo não rola
//   • Esc, o botão de fechar e o clique fora fecham
//   • ao fechar, o foco volta para o link que abriu
import { abrirJanela, fecharJanela } from './movimento.js';

const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// de onde vem o texto jurídico. é um fragmento HTML (sem <html>/<head>), com as
// seções #ct-doc-termos e #ct-doc-risco
export const FONTE_DOS_DOCUMENTOS = '/src/conta/documentos.html';

const DOCUMENTOS = ['termos', 'risco'];

// folga, em px, para considerar que o fim do documento ficou à vista
const FOLGA_DO_FIM = 4;

const TEXTOS = {
  carregando: 'Carregando os documentos',
  falha: 'Não foi possível carregar os documentos agora.',
  tentar: 'Tentar de novo',
  abrirPagina: 'Abrir em página inteira',
  faltaOsDois: 'Role os dois documentos até o fim para liberar o aceite.',
  faltaRisco: 'Falta rolar o Aviso de Risco até o fim.',
  faltaTermos: 'Falta rolar os Termos de Uso até o fim.',
  pronto: 'Documentos lidos até o fim.',
  lido: ' (lido até o fim)',
};

/**
 * Carrega o fragmento dos documentos e devolve um DocumentFragment com ele.
 * Também é usado por termos.html.
 */
export async function carregarDocumentos(fonte = FONTE_DOS_DOCUMENTOS) {
  const resposta = await fetch(fonte, { credentials: 'same-origin' });
  if (!resposta.ok) throw new Error('HTTP ' + resposta.status);
  const html = await resposta.text();
  const molde = document.createElement('template');
  molde.innerHTML = html;
  if (!molde.content.querySelector('#ct-doc-termos') || !molde.content.querySelector('#ct-doc-risco')) {
    throw new Error('fragmento sem os dois documentos');
  }
  return molde.content;
}

/**
 * SHA-256, em hexadecimal, de um texto. Devolve '' quando o navegador não tem
 * crypto.subtle (só existe em contexto seguro: https ou localhost).
 */
export async function hashDoTexto(texto) {
  try {
    if (!window.crypto || !window.crypto.subtle) return '';
    const bytes = new TextEncoder().encode(String(texto));
    const resumo = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(resumo)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return '';
  }
}

/**
 * @param {HTMLElement} janela  o .ct-janela
 * @param {object} opcoes
 * @param {() => void} [opcoes.aoAceitar]   clique em "Li e aceito"
 * @param {(leitura: object) => void} [opcoes.aoLer]   um documento acabou de ser lido até o fim
 * @param {string} [opcoes.fonte]   endereço do fragmento
 */
export function criarJanela(janela, { aoAceitar, aoLer, fonte = FONTE_DOS_DOCUMENTOS } = {}) {
  const fundo = janela.querySelector('.ct-janela-fundo');
  const caixa = janela.querySelector('[role="dialog"]');
  const texto = janela.querySelector('.ct-janela-texto');
  const aceitar = janela.querySelector('[data-ct-aceitar]');
  const falta = janela.querySelector('[data-ct-falta]');
  const abas = Array.from(janela.querySelectorAll('[data-ct-aba]'));

  let aberta = false;
  let voltarPara = null;
  let inertes = [];

  // carregamento do texto
  let carregado = false;
  let carregando = null;
  let alvoPendente = '';

  // prova de leitura
  const leitura = { leuTermos: false, leuRisco: false, tempoLeituraMs: 0, tempoTermosMs: 0, tempoRiscoMs: 0 };
  let abertaEm = 0;
  // qual documento está sob os olhos e desde quando (para o tempo por documento)
  let docAtual = 'termos';
  let docDesde = 0;

  function fecharContagemDoDocumento() {
    if (!docDesde) return;
    leitura[docAtual === 'termos' ? 'tempoTermosMs' : 'tempoRiscoMs'] += performance.now() - docDesde;
    docDesde = 0;
  }

  const focaveis = () => Array.from(caixa.querySelectorAll(FOCAVEIS))
    .filter((el) => el.offsetParent !== null || el === document.activeElement);

  function travarPagina() {
    const raiz = document.documentElement;
    const barra = window.innerWidth - raiz.clientWidth;
    raiz.style.setProperty('--ct-barra', barra + 'px');
    raiz.classList.add('ct-travado');
    inertes = Array.from(document.body.children).filter((el) => el !== janela && !el.inert && el.tagName !== 'SCRIPT');
    inertes.forEach((el) => { el.inert = true; });
  }

  function soltarPagina() {
    const raiz = document.documentElement;
    raiz.classList.remove('ct-travado');
    raiz.style.removeProperty('--ct-barra');
    inertes.forEach((el) => { el.inert = false; });
    inertes = [];
  }

  // ───────────── carregamento ─────────────
  function mostrarCarregando() {
    texto.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'ct-janela-carregando';
    p.setAttribute('role', 'status');
    p.textContent = TEXTOS.carregando;
    texto.appendChild(p);
  }

  function mostrarFalha() {
    texto.innerHTML = '';
    const bloco = document.createElement('div');
    bloco.className = 'ct-aviso ct-aviso-erro ct-janela-falha';
    bloco.setAttribute('role', 'alert');
    const p = document.createElement('p');
    p.textContent = TEXTOS.falha;
    const acoes = document.createElement('p');
    acoes.className = 'ct-janela-falha-acoes';
    const tentar = document.createElement('button');
    tentar.type = 'button';
    tentar.className = 'ct-link';
    tentar.textContent = TEXTOS.tentar;
    tentar.addEventListener('click', () => { carregar(); });
    const pagina = document.createElement('a');
    pagina.className = 'ct-link ct-link-fraco';
    pagina.href = '/termos';
    pagina.target = '_blank';
    pagina.rel = 'noopener';
    pagina.textContent = TEXTOS.abrirPagina;
    acoes.append(tentar, ' ', pagina);
    bloco.append(p, acoes);
    texto.appendChild(bloco);
  }

  function carregar() {
    if (carregado) return Promise.resolve();
    if (carregando) return carregando;
    mostrarCarregando();
    carregando = carregarDocumentos(fonte)
      .then((fragmento) => {
        texto.innerHTML = '';
        texto.appendChild(fragmento);
        carregado = true;
        // o alvo pedido antes de o texto chegar
        irPara(alvoPendente);
        alvoPendente = '';
        requestAnimationFrame(medir);
      })
      .catch(() => {
        mostrarFalha();
      })
      .finally(() => {
        carregando = null;
      });
    return carregando;
  }

  // ───────────── navegação por dentro do texto ─────────────
  // alvo: id de uma cláusula ou de um documento (ct-clausula-13, ct-doc-risco...)
  function irPara(alvo) {
    const el = alvo ? texto.querySelector('#' + alvo) : null;
    texto.querySelectorAll('.ct-clausula-acesa').forEach((c) => c.classList.remove('ct-clausula-acesa'));
    // sem alvo, ou alvo no começo do texto (o primeiro documento): volta ao topo
    if (!el || el === texto.firstElementChild) {
      texto.scrollTop = 0;
      return;
    }
    texto.scrollTop = Math.max(0, el.offsetTop - 18);
    if (el.classList.contains('ct-clausula')) el.classList.add('ct-clausula-acesa');
  }

  abas.forEach((aba) => {
    aba.addEventListener('click', () => {
      if (!carregado) {
        alvoPendente = 'ct-doc-' + aba.dataset.ctAba;
        carregar();
        return;
      }
      irPara('ct-doc-' + aba.dataset.ctAba);
    });
  });

  // ───────────── prova de leitura ─────────────
  const chave = (doc) => (doc === 'termos' ? 'leuTermos' : 'leuRisco');

  function pintarLeitura() {
    const tudo = leitura.leuTermos && leitura.leuRisco;
    abas.forEach((aba) => {
      const lida = leitura[chave(aba.dataset.ctAba)];
      aba.classList.toggle('ct-aba-lida', lida);
      const voz = aba.querySelector('.ct-aba-voz');
      if (voz) voz.textContent = lida ? TEXTOS.lido : '';
    });
    if (aceitar) aceitar.disabled = !tudo;
    if (falta) {
      let msg = TEXTOS.faltaOsDois;
      if (tudo) msg = TEXTOS.pronto;
      else if (leitura.leuTermos) msg = TEXTOS.faltaRisco;
      else if (leitura.leuRisco) msg = TEXTOS.faltaTermos;
      if (falta.textContent !== msg) falta.textContent = msg;
      falta.classList.toggle('ct-janela-falta-ok', tudo);
    }
  }

  // qual documento está sob os olhos: a aba correspondente fica marcada
  function pintarAbaAtual() {
    const topo = texto.getBoundingClientRect().top;
    let atual = 'termos';
    DOCUMENTOS.forEach((doc) => {
      const sec = texto.querySelector('#ct-doc-' + doc);
      if (sec && sec.getBoundingClientRect().top <= topo + texto.clientHeight * 0.4) atual = doc;
    });
    abas.forEach((aba) => {
      if (aba.dataset.ctAba === atual) aba.setAttribute('aria-current', 'true');
      else aba.removeAttribute('aria-current');
    });
    // trocou de documento: o tempo do anterior fecha e o do novo começa a contar
    if (aberta && atual !== docAtual) {
      fecharContagemDoDocumento();
      docAtual = atual;
      docDesde = performance.now();
    }
  }

  // o fim de um documento ficou à vista dentro da área de rolagem: documento lido
  function medir() {
    if (!aberta || !carregado || texto.clientHeight === 0) return;
    const base = texto.getBoundingClientRect().bottom;
    let mudou = false;
    DOCUMENTOS.forEach((doc) => {
      const k = chave(doc);
      if (leitura[k]) return;
      const sec = texto.querySelector('#ct-doc-' + doc);
      if (!sec) return;
      if (sec.getBoundingClientRect().bottom <= base + FOLGA_DO_FIM) {
        leitura[k] = true;
        mudou = true;
      }
    });
    pintarAbaAtual();
    if (mudou) {
      pintarLeitura();
      if (typeof aoLer === 'function') aoLer(estadoDaLeitura());
    }
  }

  function estadoDaLeitura() {
    const agora = aberta && abertaEm ? performance.now() - abertaEm : 0;
    const noDoc = aberta && docDesde ? performance.now() - docDesde : 0;
    return {
      leuTermos: leitura.leuTermos,
      leuRisco: leitura.leuRisco,
      tempoLeituraMs: Math.round(leitura.tempoLeituraMs + agora),
      tempoTermosMs: Math.round(leitura.tempoTermosMs + (docAtual === 'termos' ? noDoc : 0)),
      tempoRiscoMs: Math.round(leitura.tempoRiscoMs + (docAtual === 'risco' ? noDoc : 0)),
    };
  }

  // SHA-256 do texto exato de cada documento, como está no fragmento carregado.
  // Carrega o fragmento se ainda não carregou. { termos: 'hex', risco: 'hex' }
  async function hashes() {
    await carregar();
    if (!carregado) return { termos: '', risco: '' };
    const secTermos = texto.querySelector('#ct-doc-termos');
    const secRisco = texto.querySelector('#ct-doc-risco');
    const [termos, risco] = await Promise.all([
      hashDoTexto(secTermos ? secTermos.textContent : ''),
      hashDoTexto(secRisco ? secRisco.textContent : ''),
    ]);
    return { termos, risco };
  }

  texto.addEventListener('scroll', medir, { passive: true });
  window.addEventListener('resize', () => { if (aberta) medir(); });

  // ───────────── abrir e fechar ─────────────
  function abrir(gatilho, alvo) {
    if (aberta) return;
    aberta = true;
    abertaEm = performance.now();
    docDesde = performance.now();
    voltarPara = gatilho || document.activeElement;
    janela.hidden = false;
    travarPagina();
    if (carregado) {
      irPara(alvo);
      requestAnimationFrame(medir);
    } else {
      alvoPendente = alvo || '';
      carregar();
    }
    pintarLeitura();
    abrirJanela({ fundo, caixa });
    texto.focus({ preventScroll: true });
    document.addEventListener('keydown', aoTeclar, true);
  }

  async function fechar() {
    if (!aberta) return;
    fecharContagemDoDocumento();
    aberta = false;
    if (abertaEm) leitura.tempoLeituraMs += performance.now() - abertaEm;
    abertaEm = 0;
    document.removeEventListener('keydown', aoTeclar, true);
    await fecharJanela({ fundo, caixa });
    janela.hidden = true;
    soltarPagina();
    if (voltarPara && document.contains(voltarPara) && typeof voltarPara.focus === 'function') {
      voltarPara.focus({ preventScroll: true });
    }
    voltarPara = null;
  }

  function aoTeclar(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      fechar();
      return;
    }
    if (e.key !== 'Tab') return;
    const lista = focaveis();
    if (!lista.length) {
      e.preventDefault();
      caixa.focus({ preventScroll: true });
      return;
    }
    const primeiro = lista[0];
    const ultimo = lista[lista.length - 1];
    const atual = document.activeElement;
    if (!caixa.contains(atual)) {
      e.preventDefault();
      primeiro.focus();
    } else if (e.shiftKey && (atual === primeiro || atual === caixa)) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && atual === ultimo) {
      e.preventDefault();
      primeiro.focus();
    }
  }

  janela.querySelectorAll('[data-ct-fechar]').forEach((el) => el.addEventListener('click', fechar));

  if (aceitar) {
    aceitar.addEventListener('click', () => {
      if (!(leitura.leuTermos && leitura.leuRisco)) return;
      if (typeof aoAceitar === 'function') aoAceitar(estadoDaLeitura());
      fechar();
    });
  }

  // barra de leitura: quanto do texto já passou
  const barra = janela.querySelector('.ct-janela-leitura i');
  if (barra) {
    const medirBarra = () => {
      const resto = texto.scrollHeight - texto.clientHeight;
      const p = resto > 0 ? texto.scrollTop / resto : 0;
      barra.style.transform = 'scaleX(' + Math.min(1, Math.max(0, p)).toFixed(4) + ')';
    };
    texto.addEventListener('scroll', medirBarra, { passive: true });
    new MutationObserver(medirBarra).observe(janela, { attributes: true, attributeFilter: ['hidden'] });
  }

  pintarLeitura();

  return { abrir, fechar, estaAberta: () => aberta, leitura: estadoDaLeitura, carregar, hashes };
}
