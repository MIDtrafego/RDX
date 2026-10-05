// Página "Comece hoje" (comecar.html): o vídeo, os quatro passos e o botão do painel.
// Os dados da conta MT5 são colhidos no item 3 do passo 2 e conferidos no passo 4.
//
// Os endereços que a página aponta ficam todos aqui, num lugar só.
// Quando o Pedro passar o link de afiliado da Exness e o endereço do painel, é só trocar.

import { criarFundo } from '../conta/fundo.js';
import { guardar, lerGuardado } from '../conta/guardado.js';
import { emailValido, mascaraTelefoneBR, numerosDoTelefoneBR, soNumeros } from '../conta/validacao.js';

const LINKS = {
  exness: 'https://www.exness.com/',          // link de afiliado: cadastro e documento na corretora
  exnessContas: 'https://my.exness.com/',     // área do cliente, onde ficam as contas MT5
  cadastro: '/cadastro.html',                  // criar a conta RDX
  painel: '/entrar.html',                      // entrar no painel
};

const TEXTOS = {
  loginVazio: 'Informe o número da conta.',
  login: 'Só números, como está na Exness.',
  servidorVazio: 'Informe o servidor.',
  senhaVazia: 'Informe a senha de negociação.',
  nome: 'Informe o seu nome.',
  whatsappVazio: 'Informe o WhatsApp.',
  whatsapp: 'Número incompleto. Use DDD e número.',
  emailVazio: 'Informe o e-mail.',
  email: 'E-mail inválido. Confira o endereço.',
  salvo: 'Salvo neste navegador',
  naoSalvou: 'Não deu para salvar neste navegador. Confira as configurações de privacidade.',
  faltaLogin: 'Falta. Salve no item 3 do passo 2.',
  faltaServidor: 'Falta. Salve no item 3 do passo 2.',
  faltaSenha: 'Falta. A senha não fica guardada depois que o navegador fecha: salve de novo no item 3 do passo 2.',
  ok: 'Confere.',
};

// ───────────── endereços ─────────────
for (const el of document.querySelectorAll('[data-cm-link]')) {
  const alvo = LINKS[el.dataset.cmLink];
  if (alvo) el.href = alvo;
}

// ───────────── fundo ─────────────
const canvasFundo = document.getElementById('cm-fundo');
const reduzMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (canvasFundo) criarFundo(canvasFundo, { parado: reduzMovimento });

// ───────────── vídeo ─────────────
const caixa = document.getElementById('cm-video');
if (caixa) {
  const video = caixa.querySelector('video');
  const play = caixa.querySelector('.cm-video-play');
  const falta = caixa.querySelector('.cm-video-falta');
  const fonte = video.querySelector('source');

  const semVideo = () => {
    caixa.dataset.cmEstado = 'falta';
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
  video.addEventListener('click', () => { if (caixa.dataset.cmEstado === 'parado') tocar(); });
  video.addEventListener('play', () => { caixa.dataset.cmEstado = 'tocando'; });
  video.addEventListener('pause', () => { if (caixa.dataset.cmEstado !== 'falta') caixa.dataset.cmEstado = 'pausado'; });
  video.addEventListener('ended', () => { caixa.dataset.cmEstado = 'pausado'; });
}

// ───────────── "como" de cada clique ─────────────
for (const botao of document.querySelectorAll('.cm-item-botao[aria-controls]')) {
  const painel = document.getElementById(botao.getAttribute('aria-controls'));
  if (!painel) continue;
  botao.addEventListener('click', () => {
    const aberto = botao.getAttribute('aria-expanded') === 'true';
    botao.setAttribute('aria-expanded', String(!aberto));
    painel.hidden = aberto;
    botao.closest('.cm-item').classList.toggle('cm-item-aberto', !aberto);
  });
}

// ───────────── formulários (passos 3 e 4) ─────────────
// Cada campo: <div class="cm-campo" data-cm-campo="nome"> rótulo, caixa com o controle, <p class="cm-erro">.
// A regra devolve '' quando está certo ou o texto do erro.
function ligarFormulario(form, regras, aoSalvar) {
  if (!form) return null;
  const campos = new Map();
  form.querySelectorAll('[data-cm-campo]').forEach((caixa) => {
    const nome = caixa.dataset.cmCampo;
    const controle = caixa.querySelector('input');
    const erro = caixa.querySelector('.cm-erro');
    if (!controle || !erro) return;
    const campo = { nome, caixa, controle, erro, comErro: false };
    campos.set(nome, campo);
    const marcar = () => caixa.classList.toggle('cm-cheio', String(controle.value || '').trim() !== '');
    controle.addEventListener('input', () => { marcar(); if (campo.comErro) validar(nome); });
    controle.addEventListener('blur', () => { if (campo.comErro || controle.value) validar(nome); });
    marcar();
  });
  const salvo = form.querySelector('.cm-salvo');

  function mostrarErro(campo, texto) {
    campo.comErro = Boolean(texto);
    campo.erro.textContent = texto;
    campo.erro.hidden = !texto;
    campo.caixa.classList.toggle('cm-com-erro', Boolean(texto));
    if (texto) campo.controle.setAttribute('aria-invalid', 'true');
    else campo.controle.removeAttribute('aria-invalid');
  }
  function validar(nome) {
    const campo = campos.get(nome);
    const regra = regras[nome];
    const texto = regra ? regra(campo.controle.value) : '';
    mostrarErro(campo, texto);
    return !texto;
  }
  function valores() {
    const v = {};
    campos.forEach((c, nome) => { v[nome] = c.controle.value; });
    return v;
  }
  function preencher(dados) {
    campos.forEach((c, nome) => {
      if (dados[nome] && !c.controle.value) {
        c.controle.value = dados[nome];
        c.caixa.classList.add('cm-cheio');
      }
    });
  }
  function avisar(texto, ok) {
    if (!salvo) return;
    salvo.textContent = texto;
    salvo.classList.toggle('cm-salvo-ok', ok);
    salvo.classList.toggle('cm-salvo-erro', !ok);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const errados = [...campos.keys()].filter((nome) => !validar(nome));
    if (errados.length) {
      campos.get(errados[0]).controle.focus();
      return;
    }
    aoSalvar(valores(), avisar);
  });

  return { campos, valores, preencher, avisar };
}

const hora = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

// passo 3: os dados do MT5
const formMt5 = ligarFormulario(document.getElementById('cm-form-mt5'), {
  mt5Login: (v) => {
    const n = String(v).trim();
    if (!n) return TEXTOS.loginVazio;
    return /^\d{4,16}$/.test(n) ? '' : TEXTOS.login;
  },
  mt5Servidor: (v) => (String(v).trim().length >= 3 ? '' : TEXTOS.servidorVazio),
  mt5Senha: (v) => (String(v).length ? '' : TEXTOS.senhaVazia),
}, (v, avisar) => {
  const ok = guardar({ mt5Login: v.mt5Login.trim(), mt5Servidor: v.mt5Servidor.trim(), mt5Senha: v.mt5Senha });
  avisar(ok ? TEXTOS.salvo + ' às ' + hora() + '.' : TEXTOS.naoSalvou, ok);
  conferir();
});

// mostrar e esconder a senha de negociação
for (const olho of document.querySelectorAll('.cm-olho')) {
  const alvo = document.getElementById(olho.getAttribute('aria-controls'));
  if (!alvo) continue;
  olho.addEventListener('click', () => {
    const mostrando = alvo.type === 'text';
    alvo.type = mostrando ? 'password' : 'text';
    olho.setAttribute('aria-pressed', String(!mostrando));
    olho.setAttribute('aria-label', mostrando ? 'Mostrar senha' : 'Ocultar senha');
  });
}

// passo 4: a conta RDX. Salva e segue para o cadastro, que chega pré-preenchido
const elWhatsapp = document.getElementById('cm-whatsapp');
if (elWhatsapp) {
  elWhatsapp.addEventListener('input', () => {
    const m = mascaraTelefoneBR(elWhatsapp.value);
    if (soNumeros(elWhatsapp.value).length <= 11 && m !== elWhatsapp.value) elWhatsapp.value = m;
  });
}
const formConta = ligarFormulario(document.getElementById('cm-form-conta'), {
  nome: (v) => (String(v).trim().length >= 2 ? '' : TEXTOS.nome),
  whatsapp: (v) => {
    const n = soNumeros(v);
    if (!n.length) return TEXTOS.whatsappVazio;
    return n.length >= 10 && n.length <= 15 ? '' : TEXTOS.whatsapp;
  },
  email: (v) => {
    const e = String(v).trim();
    if (!e) return TEXTOS.emailVazio;
    return emailValido(e) ? '' : TEXTOS.email;
  },
}, (v, avisar) => {
  const n = soNumeros(v.whatsapp);
  const ok = guardar({
    nome: v.nome.trim(),
    whatsapp: n.length <= 11 ? numerosDoTelefoneBR(v.whatsapp) : n,
    email: v.email.trim().toLowerCase(),
  });
  avisar(ok ? TEXTOS.salvo + '. Abrindo o cadastro.' : TEXTOS.naoSalvou, ok);
  window.setTimeout(() => { window.location.href = LINKS.cadastro; }, ok ? 350 : 1200);
});

// o que já estava guardado volta para os campos
const guardado = lerGuardado();
if (formMt5) formMt5.preencher({ mt5Login: guardado.mt5Login, mt5Servidor: guardado.mt5Servidor, mt5Senha: guardado.mt5Senha });
if (formConta) formConta.preencher({ nome: guardado.nome, whatsapp: guardado.whatsapp ? mascaraTelefoneBR(guardado.whatsapp) : '', email: guardado.email });
if (formMt5 && guardado.mt5Login && guardado.quando) {
  formMt5.avisar(TEXTOS.salvo + ' em ' + new Date(guardado.quando).toLocaleDateString('pt-BR') + '.', true);
}

// ───────────── passo 5: conferência com selos ─────────────
// O começo de cada dado aparece; o resto vira asterisco.
function mascarar(v, mostrar) {
  const s = String(v || '');
  if (!s) return '';
  const resto = Math.max(3, s.length - mostrar);
  return s.slice(0, mostrar) + '*'.repeat(resto);
}
const REGRAS_SELO = {
  mt5Login: { mostrar: 3, valido: (v) => /^\d{4,16}$/.test(v), falta: TEXTOS.faltaLogin },
  mt5Servidor: { mostrar: 6, valido: (v) => v.trim().length >= 3, falta: TEXTOS.faltaServidor },
  mt5Senha: { mostrar: 1, valido: (v) => v.length > 0, falta: TEXTOS.faltaSenha },
};
function conferir() {
  const dados = lerGuardado();
  let tudoOk = true;
  for (const li of document.querySelectorAll('[data-cm-selo]')) {
    const nome = li.dataset.cmSelo;
    const regra = REGRAS_SELO[nome];
    const valor = dados[nome] || '';
    const ok = Boolean(valor) && regra.valido(valor);
    li.dataset.cmEstado = ok ? 'ok' : 'nao';
    li.querySelector('[data-cm-valor]').textContent = valor ? mascarar(valor, regra.mostrar) : '—';
    li.querySelector('[data-cm-texto]').textContent = ok ? TEXTOS.ok : regra.falta;
    if (!ok) tudoOk = false;
  }
  const falta = document.getElementById('cm-selos-falta');
  if (falta) falta.hidden = tudoOk;
}
conferir();
window.addEventListener('pageshow', conferir);

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
