// Janela dos termos.
//
//   • o foco fica preso dentro da janela (Tab e Shift+Tab dão a volta)
//   • o resto da página fica inerte e o fundo não rola
//   • Esc, o botão de fechar e o clique fora fecham
//   • ao fechar, o foco volta para o link que abriu
//   • "Li e aceito os termos" chama aoAceitar e fecha
import { abrirJanela, fecharJanela } from './movimento.js';

const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function criarJanela(janela, { aoAceitar } = {}) {
  const fundo = janela.querySelector('.ct-janela-fundo');
  const caixa = janela.querySelector('[role="dialog"]');
  const texto = janela.querySelector('.ct-janela-texto');
  const aceitar = janela.querySelector('[data-ct-aceitar]');

  let aberta = false;
  let voltarPara = null;
  let inertes = [];

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

  function irPara(clausula) {
    const alvo = clausula ? janela.querySelector('#ct-clausula-' + clausula) : null;
    janela.querySelectorAll('.ct-clausula-acesa').forEach((el) => el.classList.remove('ct-clausula-acesa'));
    if (!alvo) {
      texto.scrollTop = 0;
      return;
    }
    texto.scrollTop = Math.max(0, alvo.offsetTop - 18);
    alvo.classList.add('ct-clausula-acesa');
  }

  function abrir(gatilho, clausula) {
    if (aberta) return;
    aberta = true;
    voltarPara = gatilho || document.activeElement;
    janela.hidden = false;
    travarPagina();
    irPara(clausula);
    abrirJanela({ fundo, caixa });
    texto.focus({ preventScroll: true });
    document.addEventListener('keydown', aoTeclar, true);
  }

  async function fechar() {
    if (!aberta) return;
    aberta = false;
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
      if (typeof aoAceitar === 'function') aoAceitar();
      fechar();
    });
  }

  // barra de leitura: quanto do texto já passou
  const barra = janela.querySelector('.ct-janela-leitura i');
  if (barra) {
    const medir = () => {
      const resto = texto.scrollHeight - texto.clientHeight;
      const p = resto > 0 ? texto.scrollTop / resto : 1;
      barra.style.transform = 'scaleX(' + Math.min(1, Math.max(0, p)).toFixed(4) + ')';
    };
    texto.addEventListener('scroll', medir, { passive: true });
    new MutationObserver(medir).observe(janela, { attributes: true, attributeFilter: ['hidden'] });
  }

  return { abrir, fechar, estaAberta: () => aberta };
}
