// Página "Comece hoje" (comecar.html): quatro passos numa página só.
//
//   1. Assista      o vídeo
//   2. Conta RDX    o cadastro (único): dados, documentos no modal, 3 caixas, "Criar conta e entrar"
//   3. Corretora    os 4 cliques da Exness, os dados do MT5 e o botão Conectar (no painel, logado)
//   4. Pronto       estado da conexão e o botão do painel
//
// HOJE NÃO HÁ SERVIDOR NEM PAINEL: src/conta/api.js rejeita tudo com SEM_SERVIDOR e a
// página guarda o que precisa neste navegador (src/conta/guardado.js) para funcionar de
// ponta a ponta sem rede. Quando o servidor existir, só api.js muda.
//
// Os endereços que a página aponta ficam todos em LINKS, num lugar só.

import { criarFundo } from '../conta/fundo.js';
import { guardar, lerGuardado } from '../conta/guardado.js';
import { VERSAO_DOS_TERMOS, criarConta, conectarConta } from '../conta/api.js';
import { criarJanela } from '../conta/termos.js';
import {
  cpfValido, emailValido, mascaraCpf, mascaraTelefoneBR, numerosDoTelefoneBR,
  limparTelefoneLivre, soNumeros, SENHA_MINIMO,
} from '../conta/validacao.js';

const LINKS = {
  exness: 'https://www.exness.com/',          // link de afiliado: cadastro e documento na corretora
  exnessContas: 'https://my.exness.com/',     // área do cliente, onde ficam as contas MT5
  exnessDeposito: 'https://my.exness.com/',   // página de depósito (PIX) dentro da área do cliente
  painel: '/entrar.html',                      // abrir o painel (quando existir, trocar aqui)
  kyc: '/cadastro.html',                       // verificação de identidade (documento e selfie)
  whatsapp: '',                                // número do consultor, só dígitos com DDI (ex.: 5511999999999). Vazio: o cartão fica escondido
};

const PAISES = ['BR', 'PT'];

const TEXTOS = {
  nome: 'Informe nome e sobrenome.',
  cpfVazio: 'Informe o CPF.',
  cpf: 'CPF inválido. Confira os números.',
  whatsappVazio: 'Informe o WhatsApp.',
  whatsapp: 'Número incompleto. Use DDD e número.',
  emailVazio: 'Informe o e-mail.',
  email: 'E-mail inválido. Confira o endereço.',
  senhaVazia: 'Crie uma senha.',
  senhaCurta: 'A senha precisa de no mínimo ' + SENHA_MINIMO + ' caracteres.',
  pais: 'Escolha o país.',
  caixa: 'Marque esta caixa para continuar.',
  caixaTravada: 'Leia os Termos de Uso e o Aviso de Risco até o fim para liberar esta caixa.',
  loginVazio: 'Informe o número da conta.',
  login: 'Só números, como está na Exness.',
  servidorVazio: 'Informe o servidor.',
  senhaMt5Vazia: 'Informe a senha de negociação.',
  salvo: 'Salvo neste navegador',
  naoSalvou: 'Não deu para salvar neste navegador. Confira as configurações de privacidade.',
  contaCriada: 'Conta criada neste navegador. O servidor ainda não está ligado.',
  conectado: 'Conectado neste navegador. O servidor ainda não está ligado: a conexão de verdade acontece no painel.',
  depois: 'Aguardando conexão. Volte quando tiver os dados da corretora.',
  emailUsado: 'Este e-mail já tem conta.',
  cpfUsado: 'Já existe uma conta com este CPF.',
  falhaCriar: 'Não foi possível criar a conta agora. Tente de novo em instantes.',
  falhaConectar: 'Não foi possível conectar agora. Tente de novo em instantes.',
  kycPendente: 'O painel pede a verificação de identidade antes de liberar a conexão.',
  semSessao: 'Entre na sua conta RDX para conectar a corretora.',
  mt5Falta: 'Preencha e salve os dados da conta MT5 no item 3.',
};

const $ = (id) => document.getElementById(id);

// ───────────── endereços ─────────────
for (const el of document.querySelectorAll('[data-cm-link]')) {
  const alvo = LINKS[el.dataset.cmLink];
  if (alvo) el.href = alvo;
}

// ───────────── fundo ─────────────
const canvasFundo = $('cm-fundo');
const reduzMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (canvasFundo) criarFundo(canvasFundo, { parado: reduzMovimento });

// ───────────── vídeo (passo 1) ─────────────
const caixaVideo = $('cm-video');
if (caixaVideo) {
  const video = caixaVideo.querySelector('video');
  const play = caixaVideo.querySelector('.cm-video-play');
  const falta = caixaVideo.querySelector('.cm-video-falta');
  const fonte = video.querySelector('source');

  const semVideo = () => {
    caixaVideo.dataset.cmEstado = 'falta';
    if (falta) falta.hidden = false;
    if (play) play.hidden = true;
  };
  // o erro de carga chega no <source> (último da lista) ou no próprio <video>
  if (fonte) fonte.addEventListener('error', semVideo);
  video.addEventListener('error', semVideo);
  // o erro pode ter acontecido antes deste módulo carregar: confere o estado também
  const conferirVideo = () => {
    if (video.error || video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) semVideo();
  };
  conferirVideo();
  setTimeout(conferirVideo, 1500);
  setTimeout(conferirVideo, 4000);

  const tocar = () => {
    video.controls = true;
    const p = video.play();
    if (p && p.catch) p.catch(() => {});
  };
  if (play) play.addEventListener('click', tocar);
  video.addEventListener('click', () => { if (caixaVideo.dataset.cmEstado === 'parado') tocar(); });
  video.addEventListener('play', () => { caixaVideo.dataset.cmEstado = 'tocando'; });
  video.addEventListener('pause', () => { if (caixaVideo.dataset.cmEstado !== 'falta') caixaVideo.dataset.cmEstado = 'pausado'; });
  video.addEventListener('ended', () => { caixaVideo.dataset.cmEstado = 'pausado'; });
}

// ───────────── formulários ─────────────
// Cada campo: <div data-cm-campo="nome"> rótulo, caixa com o controle (input, select ou
// checkbox), <p class="cm-erro"> ou <p class="ct-erro">. A regra devolve '' quando está
// certo ou o texto do erro; recebe (valor, controle). Checkbox: o valor é "marcada".
function ligarFormulario(form, regras) {
  if (!form) return null;
  const campos = new Map();
  form.querySelectorAll('[data-cm-campo]').forEach((caixa) => {
    const nome = caixa.dataset.cmCampo;
    const controle = caixa.querySelector('input, select');
    const erro = caixa.querySelector('.cm-erro, .ct-erro');
    if (!controle || !erro) return;
    const campo = { nome, caixa, controle, erro, comErro: false };
    campos.set(nome, campo);
    const marcar = () => caixa.classList.toggle('cm-cheio', valorDe(controle) !== '' && valorDe(controle) !== false);
    const aoMudar = () => { marcar(); if (campo.comErro) validar(nome); };
    controle.addEventListener('input', aoMudar);
    controle.addEventListener('change', aoMudar);
    controle.addEventListener('blur', () => { if (campo.comErro || valorDe(controle)) validar(nome); });
    marcar();
  });
  const salvo = form.querySelector(':scope > .cm-acoes .cm-salvo');

  function valorDe(controle) {
    if (controle.type === 'checkbox') return controle.checked;
    return String(controle.value || '');
  }
  function mostrarErro(nome, texto) {
    const campo = campos.get(nome);
    if (!campo) return;
    campo.comErro = Boolean(texto);
    campo.erro.textContent = texto;
    campo.erro.hidden = !texto;
    campo.caixa.classList.toggle('cm-com-erro', Boolean(texto));
    campo.caixa.classList.toggle('ct-com-erro', Boolean(texto));
    if (texto) campo.controle.setAttribute('aria-invalid', 'true');
    else campo.controle.removeAttribute('aria-invalid');
  }
  function validar(nome) {
    const campo = campos.get(nome);
    const regra = regras[nome];
    const texto = regra ? regra(valorDe(campo.controle), campo.controle) : '';
    mostrarErro(nome, texto);
    return !texto;
  }
  function validarTudo() {
    return [...campos.keys()].filter((nome) => !validar(nome));
  }
  function focar(nome) {
    const campo = campos.get(nome);
    if (!campo) return;
    campo.controle.focus({ preventScroll: true });
    campo.caixa.scrollIntoView({ block: 'center', behavior: reduzMovimento ? 'auto' : 'smooth' });
  }
  function valores() {
    const v = {};
    campos.forEach((c, nome) => { v[nome] = valorDe(c.controle); });
    return v;
  }
  function preencher(dados) {
    campos.forEach((c, nome) => {
      if (dados[nome] && c.controle.type !== 'checkbox' && !c.controle.value) {
        c.controle.value = dados[nome];
        c.caixa.classList.add('cm-cheio');
      }
    });
  }
  function avisar(texto, ok) {
    if (!salvo) return;
    salvo.textContent = texto;
    salvo.classList.toggle('cm-salvo-ok', Boolean(ok));
    salvo.classList.toggle('cm-salvo-erro', !ok);
  }
  return { campos, validar, validarTudo, focar, valores, preencher, avisar, mostrarErro };
}

// mostrar e esconder senhas
for (const olho of document.querySelectorAll('.cm-olho')) {
  const alvo = $(olho.getAttribute('aria-controls'));
  if (!alvo) continue;
  olho.addEventListener('click', () => {
    const mostrando = alvo.type === 'text';
    alvo.type = mostrando ? 'password' : 'text';
    olho.setAttribute('aria-pressed', String(!mostrando));
    olho.setAttribute('aria-label', mostrando ? 'Mostrar senha' : 'Ocultar senha');
  });
}
const esconderSenha = (id) => {
  const el = $(id);
  const olho = document.querySelector('.cm-olho[aria-controls="' + id + '"]');
  if (el) el.type = 'password';
  if (olho) { olho.setAttribute('aria-pressed', 'false'); olho.setAttribute('aria-label', 'Mostrar senha'); }
};

function avisar(el, texto) {
  if (!el) return;
  el.textContent = texto;
  el.hidden = false;
}
function calar(el) {
  if (!el) return;
  el.hidden = true;
  el.textContent = '';
}
const rolarAte = (el) => {
  if (!el) return;
  el.scrollIntoView({ block: 'start', behavior: reduzMovimento ? 'auto' : 'smooth' });
};
const dois = (n) => String(n).padStart(2, '0');
const dataHora = (ms) => {
  const d = new Date(ms);
  return dois(d.getDate()) + '/' + dois(d.getMonth() + 1) + ', ' + dois(d.getHours()) + ':' + dois(d.getMinutes());
};
// o começo de cada dado aparece; o resto vira asterisco
function mascarar(v, mostrar) {
  const s = String(v || '');
  if (!s) return '';
  return s.slice(0, mostrar) + '*'.repeat(Math.max(3, s.length - mostrar));
}

// ═══════════════════════════════════════════════════════════════════════════
// PASSO 2: CONTA RDX
// ═══════════════════════════════════════════════════════════════════════════
const formConta = $('cm-form-conta');
const elPais = $('cm-pais');
const elWhatsapp = $('cm-whatsapp');
const elCpf = $('cm-cpf');
const elSenha = $('cm-senha');
const btCriar = $('cm-criar');
const erroConta = $('cm-conta-erro');
const blocoAceites = $('ct-aceites');
const travaAceites = $('ct-aceites-trava');
const caixasDeAceite = ['ct-aceite-termos', 'ct-aceite-titular', 'ct-aceite-arbitragem'].map($);
const NOMES_DAS_CAIXAS = ['aceiteTermos', 'aceiteTitular', 'aceiteArbitragem'];

const doBrasil = () => !elPais || elPais.value === 'BR';

// máscaras
if (elCpf) elCpf.addEventListener('input', () => { const m = mascaraCpf(elCpf.value); if (m !== elCpf.value) elCpf.value = m; });
if (elWhatsapp) {
  elWhatsapp.addEventListener('input', () => {
    const m = doBrasil() ? mascaraTelefoneBR(elWhatsapp.value) : limparTelefoneLivre(elWhatsapp.value);
    if (m !== elWhatsapp.value) elWhatsapp.value = m;
  });
}
function aplicarPais() {
  if (!elWhatsapp) return;
  elWhatsapp.placeholder = doBrasil() ? '(11) 99999-9999' : 'código do país + número';
  if (doBrasil()) elWhatsapp.value = mascaraTelefoneBR(elWhatsapp.value);
}
if (elPais) elPais.addEventListener('change', aplicarPais);

// caixa desligada: a pessoa ainda não leu os documentos até o fim
function regraDeCaixa(marcada, controle) {
  if (marcada) return '';
  return controle.disabled ? TEXTOS.caixaTravada : TEXTOS.caixa;
}
const conta = ligarFormulario(formConta, {
  nome: (v) => (String(v).trim().split(/\s+/).filter(Boolean).length >= 2 ? '' : TEXTOS.nome),
  cpf: (v) => {
    const n = soNumeros(v);
    if (!n.length) return TEXTOS.cpfVazio;
    return cpfValido(n) ? '' : TEXTOS.cpf;
  },
  whatsapp: (v) => {
    const n = doBrasil() ? numerosDoTelefoneBR(v) : soNumeros(v);
    if (!n.length) return TEXTOS.whatsappVazio;
    if (doBrasil()) return n.length >= 10 && n.length <= 11 ? '' : TEXTOS.whatsapp;
    return n.length >= 7 && n.length <= 15 ? '' : TEXTOS.whatsapp;
  },
  email: (v) => {
    const e = String(v).trim();
    if (!e) return TEXTOS.emailVazio;
    return emailValido(e) ? '' : TEXTOS.email;
  },
  senha: (v) => {
    if (!v) return TEXTOS.senhaVazia;
    return v.length < SENHA_MINIMO ? TEXTOS.senhaCurta : '';
  },
  pais: (v) => (PAISES.indexOf(v) !== -1 ? '' : TEXTOS.pais),
  aceiteTermos: regraDeCaixa,
  aceiteTitular: regraDeCaixa,
  aceiteArbitragem: regraDeCaixa,
});

// data e hora (UTC) do clique em cada caixa: prova do aceite (Termos, cláusula 16.2)
const cliques = { aceiteTermos: '', aceiteTitular: '', aceiteArbitragem: '' };
caixasDeAceite.forEach((c, i) => {
  if (!c) return;
  c.addEventListener('change', () => { cliques[NOMES_DAS_CAIXAS[i]] = c.checked ? new Date().toISOString() : ''; });
});

// As caixas nascem desligadas e só ligam depois que os dois documentos foram rolados até
// o fim dentro da janela (termos.js avisa por aoLer).
function liberarAceites(leitura) {
  if (!(leitura.leuTermos && leitura.leuRisco)) return;
  if (!blocoAceites || blocoAceites.dataset.ctLiberado === '1') return;
  blocoAceites.dataset.ctLiberado = '1';
  caixasDeAceite.forEach((c) => { if (c) c.disabled = false; });
  if (travaAceites) travaAceites.hidden = true;
  NOMES_DAS_CAIXAS.forEach((n) => conta.mostrarErro(n, ''));
}

// ───────────── janela dos termos ─────────────
// O texto vem de /src/conta/documentos.html por fetch na primeira abertura (termos.js).
const elJanela = $('ct-termos');
const janela = elJanela ? criarJanela(elJanela, {
  aoLer: liberarAceites,
  aoAceitar(leitura) {
    liberarAceites(leitura);
    caixasDeAceite.forEach((c) => {
      if (!c || c.checked) return;
      c.checked = true;
      c.dispatchEvent(new Event('change', { bubbles: true }));
    });
  },
}) : null;
// data-ct-termos é o id do alvo dentro do fragmento (ct-doc-termos, ct-doc-risco, ct-clausula-11...)
document.querySelectorAll('[data-ct-termos]').forEach((botao) => {
  botao.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (janela) janela.abrir(botao, botao.dataset.ctTermos);
  });
});

// monta o pedido no formato da especificação do backend (seção 2.1) e o registro local
async function montarCadastro(v) {
  const partes = v.nome.trim().split(/\s+/).filter(Boolean);
  const leitura = janela ? janela.leitura() : { leuTermos: false, leuRisco: false, tempoLeituraMs: 0, tempoTermosMs: 0, tempoRiscoMs: 0 };
  const hashes = janela ? await janela.hashes() : { termos: '', risco: '' };
  const nacional = doBrasil() ? numerosDoTelefoneBR(v.whatsapp) : soNumeros(v.whatsapp);
  let fuso = '';
  try { fuso = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* sem Intl */ }
  const prova = {
    versao: VERSAO_DOS_TERMOS,
    hash_termos: hashes.termos,
    hash_risco: hashes.risco,
    caixa1_em: cliques.aceiteTermos,
    caixa2_em: cliques.aceiteTitular,
    caixa3_em: cliques.aceiteArbitragem,
    user_agent: navigator.userAgent,
    idioma: navigator.language || '',
    fuso,
    tempo_termos_ms: leitura.tempoTermosMs,
    tempo_risco_ms: leitura.tempoRiscoMs,
    tempo_total_ms: leitura.tempoLeituraMs,
    rolou_termos: leitura.leuTermos,
    rolou_risco: leitura.leuRisco,
  };
  const pedido = {
    first_name: partes[0] || '',
    last_name: partes.slice(1).join(' '),
    email: v.email.trim().toLowerCase(),
    phone: doBrasil() ? '55' + nacional : nacional,
    country: v.pais,
    password: v.senha,
    cpf: soNumeros(v.cpf),
    terms_version: VERSAO_DOS_TERMOS,
    terms_checks: { box1: Boolean(v.aceiteTermos), box2: Boolean(v.aceiteTitular), box3: Boolean(v.aceiteArbitragem) },
    prova,
  };
  // o que fica neste navegador: nunca a senha
  const local = {
    nome: v.nome.trim(),
    cpf: soNumeros(v.cpf),
    whatsapp: nacional,
    email: pedido.email,
    pais: v.pais,
    aceites: prova,
  };
  return { pedido, local };
}

let ocupado = false;
async function tentarCriar() {
  if (ocupado || !conta) return;
  calar(erroConta);
  const errados = conta.validarTudo();
  if (errados.length) {
    conta.focar(errados[0]);
    return;
  }
  ocupado = true;
  btCriar.disabled = true;
  btCriar.setAttribute('aria-busy', 'true');
  esconderSenha('cm-senha');
  try {
    const { pedido, local } = await montarCadastro(conta.valores());
    let destino = '';
    try {
      const resposta = await criarConta(pedido);
      destino = resposta && resposta.destino ? String(resposta.destino) : '';
    } catch (falha) {
      const codigo = falha && falha.codigo;
      if (codigo !== 'SEM_SERVIDOR') throw falha;
      // sem servidor: a conta fica criada só neste navegador e a página segue
    }
    const ok = guardar({ ...local, contaCriadaEm: Date.now(), estadoConexao: 'nenhum', conexaoEm: 0 });
    if (!ok) { avisar(erroConta, TEXTOS.naoSalvou); return; }
    if (elSenha) elSenha.value = '';
    conta.avisar(TEXTOS.contaCriada, true);
    pintarEstado();
    if (destino) { window.location.href = destino; return; }
    rolarAte($('passo-3'));
  } catch (falha) {
    const codigo = falha && falha.codigo;
    if (codigo === 'EMAIL_JA_CADASTRADO') {
      conta.mostrarErro('email', (falha && falha.mensagem) || TEXTOS.emailUsado);
      conta.focar('email');
    } else if (codigo === 'CPF_JA_CADASTRADO') {
      conta.mostrarErro('cpf', (falha && falha.mensagem) || TEXTOS.cpfUsado);
      conta.focar('cpf');
    } else if (falha && falha.campos && Object.keys(falha.campos).length) {
      const nomes = Object.keys(falha.campos).filter((n) => conta.campos.has(n));
      nomes.forEach((n) => conta.mostrarErro(n, falha.campos[n]));
      if (nomes.length) conta.focar(nomes[0]);
      else avisar(erroConta, (falha && falha.mensagem) || TEXTOS.falhaCriar);
    } else {
      avisar(erroConta, (falha && falha.mensagem) || TEXTOS.falhaCriar);
    }
  } finally {
    ocupado = false;
    btCriar.disabled = false;
    btCriar.removeAttribute('aria-busy');
  }
}
if (formConta) formConta.addEventListener('submit', (e) => { e.preventDefault(); tentarCriar(); });

// "Refazer": a conta deixa de valer neste navegador; os campos continuam preenchidos
const btRefazer = $('cm-conta-refazer');
if (btRefazer) {
  btRefazer.addEventListener('click', () => {
    guardar({ contaCriadaEm: 0, aceites: null, estadoConexao: 'nenhum', conexaoEm: 0 });
    caixasDeAceite.forEach((c) => { if (c) c.checked = false; });
    NOMES_DAS_CAIXAS.forEach((n) => { cliques[n] = ''; });
    if (conta) conta.avisar('', true);
    pintarEstado();
    const elNome = $('cm-nome');
    if (elNome) elNome.focus({ preventScroll: true });
    rolarAte($('passo-2'));
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PASSO 3: CORRETORA
// ═══════════════════════════════════════════════════════════════════════════
const mt5 = ligarFormulario($('cm-form-mt5'), {
  mt5Login: (v) => {
    const n = String(v).trim();
    if (!n) return TEXTOS.loginVazio;
    return /^\d{4,16}$/.test(n) ? '' : TEXTOS.login;
  },
  mt5Servidor: (v) => (String(v).trim().length >= 3 ? '' : TEXTOS.servidorVazio),
  mt5Senha: (v) => (String(v).length ? '' : TEXTOS.senhaMt5Vazia),
});
const hora = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

function salvarMt5(v) {
  return guardar({ mt5Login: v.mt5Login.trim(), mt5Servidor: v.mt5Servidor.trim(), mt5Senha: v.mt5Senha });
}
const formMt5 = $('cm-form-mt5');
if (formMt5 && mt5) {
  formMt5.addEventListener('submit', (e) => {
    e.preventDefault();
    const errados = mt5.validarTudo();
    if (errados.length) { mt5.focar(errados[0]); return; }
    const ok = salvarMt5(mt5.valores());
    mt5.avisar(ok ? TEXTOS.salvo + ' às ' + hora() + '.' : TEXTOS.naoSalvou, ok);
  });
}

const btConectar = $('cm-conectar');
const btDepois = $('cm-depois');
const erroConectar = $('cm-conectar-erro');
const estadoConectar = $('cm-conectar-estado');

function avisarConexao(texto, ok) {
  if (!estadoConectar) return;
  estadoConectar.textContent = texto;
  estadoConectar.classList.toggle('cm-salvo-ok', Boolean(ok));
  estadoConectar.classList.toggle('cm-salvo-erro', !ok);
}

async function tentarConectar() {
  if (ocupado || !mt5) return;
  calar(erroConectar);
  const errados = mt5.validarTudo();
  if (errados.length) {
    avisarConexao(TEXTOS.mt5Falta, false);
    mt5.focar(errados[0]);
    return;
  }
  const v = mt5.valores();
  if (!salvarMt5(v)) { avisar(erroConectar, TEXTOS.naoSalvou); return; }
  ocupado = true;
  btConectar.disabled = true;
  btConectar.setAttribute('aria-busy', 'true');
  esconderSenha('cm-mt5-senha');
  try {
    try {
      await conectarConta({ broker: 'Exness', server: v.mt5Servidor.trim(), login: v.mt5Login.trim(), password: v.mt5Senha, platform: 'mt5' });
    } catch (falha) {
      const codigo = falha && falha.codigo;
      if (codigo !== 'SEM_SERVIDOR') throw falha;
      // sem servidor: conectado só neste navegador
    }
    guardar({ estadoConexao: 'conectado', conexaoEm: Date.now() });
    avisarConexao(TEXTOS.conectado, true);
    pintarEstado();
    rolarAte($('passo-4'));
  } catch (falha) {
    const codigo = falha && falha.codigo;
    if (codigo === 'KYC_PENDENTE') {
      erroConectar.textContent = '';
      erroConectar.append((falha && falha.mensagem) || TEXTOS.kycPendente, ' ');
      const a = document.createElement('a');
      a.className = 'cm-link';
      a.href = LINKS.kyc;
      a.textContent = 'Fazer a verificação';
      erroConectar.append(a, '.');
      erroConectar.hidden = false;
    } else if (codigo === 'SEM_SESSAO') {
      avisar(erroConectar, TEXTOS.semSessao);
    } else if (falha && falha.campos && Object.keys(falha.campos).length) {
      const nomes = Object.keys(falha.campos).filter((n) => mt5.campos.has(n));
      nomes.forEach((n) => mt5.mostrarErro(n, falha.campos[n]));
      if (nomes.length) mt5.focar(nomes[0]);
      else avisar(erroConectar, (falha && falha.mensagem) || TEXTOS.falhaConectar);
    } else {
      avisar(erroConectar, (falha && falha.mensagem) || TEXTOS.falhaConectar);
    }
  } finally {
    ocupado = false;
    btConectar.disabled = false;
    btConectar.removeAttribute('aria-busy');
  }
}
if (btConectar) btConectar.addEventListener('click', tentarConectar);
if (btDepois) {
  btDepois.addEventListener('click', () => {
    if (ocupado) return;
    calar(erroConectar);
    guardar({ estadoConexao: 'depois', conexaoEm: Date.now() });
    avisarConexao(TEXTOS.depois, true);
    pintarEstado();
    rolarAte($('passo-4'));
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// ESTADO DA PÁGINA: o que ficou guardado decide o que cada passo mostra
// ═══════════════════════════════════════════════════════════════════════════
function pintarTrilha(g) {
  const temConta = g.contaCriadaEm > 0;
  const conectado = g.estadoConexao === 'conectado';
  const feitos = { 1: temConta, 2: temConta, 3: temConta && conectado, 4: temConta && conectado };
  let atual = 0;
  for (let n = 1; n <= 4; n++) { if (!feitos[n]) { atual = n; break; } }
  for (const li of document.querySelectorAll('[data-cm-parada]')) {
    const n = Number(li.dataset.cmParada);
    const estado = feitos[n] ? 'feito' : (n === atual ? 'atual' : 'a-fazer');
    li.dataset.cmEstado = estado;
    const voz = li.querySelector('.cm-parada-estado');
    if (voz) voz.textContent = estado === 'feito' ? 'feito' : (estado === 'atual' ? 'atual' : 'a fazer');
    const liga = li.querySelector('a');
    if (liga) {
      if (estado === 'atual') liga.setAttribute('aria-current', 'step');
      else liga.removeAttribute('aria-current');
    }
  }
}

function pintarWhatsapp(g) {
  const cartao = $('cm-whatsapp-cartao');
  const botao = $('cm-whatsapp-botao');
  if (!cartao || !botao) return;
  const numero = soNumeros(LINKS.whatsapp);
  if (!numero) { cartao.hidden = true; return; }
  const etapa = g.estadoConexao === 'conectado' ? 'conta conectada' : (g.estadoConexao === 'depois' ? 'aguardando conexão' : 'conta criada');
  const texto = 'Olá! Vim pelo site da RDX. Etapa: ' + etapa;
  botao.href = 'https://wa.me/' + numero + '?text=' + encodeURIComponent(texto);
  cartao.hidden = false;
}

function pintarEstado() {
  const g = lerGuardado();
  const temConta = g.contaCriadaEm > 0;

  // passo 2: recolhido quando a conta existe
  const feita = $('cm-conta-feita');
  if (feita) feita.hidden = !temConta;
  if (formConta) formConta.hidden = temConta;
  const quando = $('cm-conta-feita-quando');
  if (quando && temConta) quando.textContent = 'Conta criada em ' + dataHora(g.contaCriadaEm) + (g.nome ? ' · ' + g.nome : '');

  // passo 3: só abre com a conta criada; mostra "Olá, Nome"
  const passo3 = $('passo-3');
  if (passo3) passo3.dataset.cmTravado = temConta ? '0' : '1';
  const miolo3 = $('cm-passo-3-miolo');
  if (miolo3) miolo3.inert = !temConta;
  const ola = $('cm-ola');
  const olaNome = $('cm-ola-nome');
  if (ola && olaNome) {
    const primeiro = (g.nome || '').trim().split(/\s+/)[0] || '';
    olaNome.textContent = primeiro;
    ola.hidden = !(temConta && primeiro);
  }
  if (temConta && g.estadoConexao === 'conectado') avisarConexao(TEXTOS.conectado, true);
  else if (temConta && g.estadoConexao === 'depois') avisarConexao(TEXTOS.depois, true);
  else if (estadoConectar && !estadoConectar.classList.contains('cm-salvo-erro')) avisarConexao('', true);

  // passo 4: estado da conexão
  const passo4 = $('passo-4');
  const titulo = $('cm-pronto-titulo');
  const apoio = $('cm-pronto-apoio');
  const estado = $('cm-estado');
  const falta = $('cm-pronto-falta');
  const liberado = temConta && (g.estadoConexao === 'conectado' || g.estadoConexao === 'depois');
  if (passo4) passo4.dataset.cmTravado = liberado ? '0' : '1';
  const abrir = $('cm-abrir-painel');
  if (abrir) abrir.inert = !liberado;
  if (temConta && g.estadoConexao === 'conectado') {
    if (titulo) titulo.textContent = 'Sua conta está no cluster.';
    if (apoio) apoio.textContent = 'A partir de agora, o painel mostra o que acontece na sua conta.';
    if (estado) {
      estado.hidden = false;
      $('cm-estado-login').textContent = mascarar(g.mt5Login, 3) || '***';
      $('cm-estado-servidor').textContent = mascarar(g.mt5Servidor, 6) || '***';
    }
    if (falta) falta.hidden = true;
  } else if (temConta && g.estadoConexao === 'depois') {
    if (titulo) titulo.textContent = 'Sua conta RDX está criada. Falta conectar a corretora.';
    if (apoio) apoio.textContent = 'Quando tiver os dados da conta MT5, volte ao passo 3 e conecte. O painel já pode ser aberto.';
    if (estado) estado.hidden = true;
    if (falta) falta.hidden = false;
  } else {
    if (titulo) titulo.innerHTML = 'Tudo conectado? <em>Abra o painel.</em>';
    if (apoio) apoio.textContent = temConta
      ? 'Conecte a corretora no passo 3. Depois, é só abrir o painel.'
      : 'Crie sua conta RDX no passo 2 e conecte a corretora no passo 3. Depois, é só abrir o painel.';
    if (estado) estado.hidden = true;
    if (falta) falta.hidden = true;
  }

  pintarWhatsapp(g);
  pintarTrilha(g);
}

// o que já estava guardado volta para os campos
const guardado = lerGuardado();
if (conta) {
  conta.preencher({
    nome: guardado.nome,
    cpf: guardado.cpf ? mascaraCpf(guardado.cpf) : '',
    whatsapp: guardado.whatsapp ? (guardado.pais === 'PT' ? guardado.whatsapp : mascaraTelefoneBR(guardado.whatsapp)) : '',
    email: guardado.email,
  });
  if (elPais && PAISES.indexOf(guardado.pais) !== -1) elPais.value = guardado.pais;
}
aplicarPais();
if (mt5) {
  mt5.preencher({ mt5Login: guardado.mt5Login, mt5Servidor: guardado.mt5Servidor, mt5Senha: guardado.mt5Senha });
  if (guardado.mt5Login && guardado.quando) mt5.avisar(TEXTOS.salvo + ' em ' + new Date(guardado.quando).toLocaleDateString('pt-BR') + '.', true);
}
pintarEstado();
window.addEventListener('pageshow', (e) => { if (e.persisted) pintarEstado(); });

// ───────────── revelação ao rolar ─────────────
const revelar = [...document.querySelectorAll('.cm-revela')];
const passos = [...document.querySelectorAll('.cm-passo')];
if ('IntersectionObserver' in window && !reduzMovimento) {
  const olho = new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('cm-visto');
      olho.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
  revelar.forEach((el) => olho.observe(el));

  // o fio de cada passo acende quando o passo entra em cena
  const olhoPasso = new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('cm-passo-aceso');
      olhoPasso.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -30% 0px', threshold: 0.05 });
  passos.forEach((el) => olhoPasso.observe(el));
} else {
  revelar.forEach((el) => el.classList.add('cm-visto'));
  passos.forEach((el) => el.classList.add('cm-passo-aceso'));
}
