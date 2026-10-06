// Verificação de identidade (KYC), cadastro.html: tipo de documento, frente, verso,
// selfie, "Enviar para análise" e "Fazer depois". Depois, a conclusão.
//
// O cadastro da conta RDX não mora mais aqui (05/10/2026): é o passo 2 de comecar.html.
// Nada do que é escolhido aqui sai do navegador por conta própria. Os arquivos ficam só
// na memória desta página e são apagados na conclusão. O único caminho para o servidor
// é src/conta/api.js (enviarDocumento), que hoje devolve SEM_SERVIDOR.
import { CONECTADO, enviarDocumento } from './api.js';
import { ocupar } from './campos.js';
import { carregarMovimento, ligarCena, reduzido, revelar, trocarPasso } from './movimento.js';
import { criarFundo } from './fundo.js';
import { ligarArquivo, segurarSoltaFora } from './documento.js';

const TEXTOS = {
  frente: 'Envie a frente do documento.',
  verso: 'Envie o verso do documento.',
  selfie: 'Envie a selfie com o documento.',
  falhaEnviar: 'Não foi possível enviar os documentos agora. Tente de novo em instantes.',
  envioDesligado: 'O envio de documentos ainda não está conectado. Nenhum arquivo foi enviado.',
  semSessao: 'Entre na sua conta RDX para enviar os documentos.',
};

const $ = (id) => document.getElementById(id);

const cartao = $('ct-cartao');
const palco = $('ct-palco');
const passoEnvio = $('ct-passo-kyc');
const passoFim = $('ct-passo-fim');
const form = $('ct-form-verificacao');
const btEnviar = $('ct-enviar');
const btDepois = $('ct-depois');
const erroEnviar = $('ct-enviar-erro');

const estado = { concluido: false, ocupado: false };

criarFundo($('ct-fundo'), { parado: reduzido() });
carregarMovimento().then(ligarCena);

// ───────────── arquivos ─────────────
const frente = ligarArquivo($('ct-arquivo-frente'), { falta: TEXTOS.frente });
const verso = ligarArquivo($('ct-arquivo-verso'), { falta: TEXTOS.verso });
const selfie = ligarArquivo($('ct-arquivo-selfie'), { falta: TEXTOS.selfie });
const notaVerso = $('ct-verso-nota');
const tipos = Array.from(form.querySelectorAll('input[name="tipo"]'));
segurarSoltaFora();

const tipoEscolhido = () => (tipos.find((t) => t.checked) || tipos[0]).value;

// Passaporte não tem verso: a página de identificação é uma só.
function aplicarTipo() {
  const temVerso = tipoEscolhido() !== 'passaporte';
  verso.exigir(temVerso);
  notaVerso.hidden = temVerso;
}
tipos.forEach((t) => t.addEventListener('change', aplicarTipo));
aplicarTipo();

function avisar(el, texto) {
  el.textContent = texto;
  el.hidden = false;
  revelar(el);
}
function calar(el) {
  el.hidden = true;
  el.textContent = '';
}

function apagarTudo() {
  form.reset();
  frente.limpar();
  verso.limpar();
  selfie.limpar();
  aplicarTipo();
  calar(erroEnviar);
}

function subirParaOCartao() {
  const topo = cartao.getBoundingClientRect().top + window.scrollY - 16;
  if (window.scrollY > topo) {
    window.scrollTo({ top: Math.max(0, topo), behavior: reduzido() ? 'auto' : 'smooth' });
  }
}

// variante: 'demo' | 'com-documento' | 'sem-documento'
async function concluir(variante) {
  if (estado.concluido) return;
  estado.concluido = true;
  passoFim.querySelectorAll('[data-ct-fim]').forEach((bloco) => {
    const meu = bloco.dataset.ctFim === variante;
    bloco.hidden = !meu;
    const titulo = bloco.querySelector('[data-ct-fim-titulo]');
    if (meu) titulo.id = 'ct-fim-titulo';
    else titulo.removeAttribute('id');
  });
  passoFim.dataset.ctVariante = variante;
  const troca = trocarPasso({ palco, sai: passoEnvio, entra: passoFim, direcao: 1 });
  const titulo = passoFim.querySelector('.ct-fim-bloco:not([hidden]) [data-ct-fim-titulo]');
  if (titulo) titulo.focus({ preventScroll: true });
  subirParaOCartao();
  await troca;
  apagarTudo();
}

async function tentarEnviar() {
  if (estado.ocupado || estado.concluido) return;
  calar(erroEnviar);
  const okFrente = frente.validar();
  const okVerso = verso.validar();
  const okSelfie = selfie.validar();
  if (!okFrente) { frente.focar(); return; }
  if (!okVerso) { verso.focar(); return; }
  if (!okSelfie) { selfie.focar(); return; }

  // sem servidor não há para quem enviar: os arquivos nem chegam a ser entregues à ponte
  if (!CONECTADO) {
    await concluir('demo');
    return;
  }

  estado.ocupado = true;
  ocupar(btEnviar, true);
  try {
    await enviarDocumento({
      tipo: tipoEscolhido(),
      frente: frente.arquivo(),
      verso: tipoEscolhido() === 'passaporte' ? (verso.arquivo() || null) : verso.arquivo(),
      selfie: selfie.arquivo(),
    });
    await concluir('com-documento');
  } catch (falha) {
    const codigo = falha && falha.codigo;
    const campos = (falha && falha.campos) || {};
    if (codigo === 'SEM_SERVIDOR') {
      avisar(erroEnviar, TEXTOS.envioDesligado);
    } else if (codigo === 'SEM_SESSAO') {
      avisar(erroEnviar, (falha && falha.mensagem) || TEXTOS.semSessao);
    } else if (campos.frente || campos.verso || campos.selfie) {
      if (campos.frente) frente.erro(campos.frente);
      if (campos.verso) verso.erro(campos.verso);
      if (campos.selfie) selfie.erro(campos.selfie);
      (campos.frente ? frente : (campos.verso ? verso : selfie)).focar();
    } else {
      avisar(erroEnviar, (falha && falha.mensagem) || TEXTOS.falhaEnviar);
    }
  } finally {
    estado.ocupado = false;
    ocupar(btEnviar, false);
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  tentarEnviar();
});

btDepois.addEventListener('click', () => {
  if (estado.ocupado || estado.concluido) return;
  concluir(CONECTADO ? 'sem-documento' : 'demo');
});

// a animação de abertura é só da chegada: depois disso as peças trocam sem repetir
window.setTimeout(() => document.body.classList.add('ct-aberto'), 2200);

// o botão nasce desligado no HTML e só liga aqui, com tudo pronto
btEnviar.disabled = false;
