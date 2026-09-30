// Tela de entrar.
//
// Nada do que é digitado aqui sai do navegador ou é gravado. O único caminho para o
// servidor é src/conta/api.js, que hoje devolve SEM_SERVIDOR.
import { CONECTADO, entrar } from './api.js';
import { emailValido } from './validacao.js';
import { ligarCampos, ligarOlho, ocupar } from './campos.js';
import { carregarMovimento, ligarCena, reduzido, revelar } from './movimento.js';
import { criarFundo } from './fundo.js';

const TEXTOS = {
  vazio: 'Preencha e-mail e senha.',
  incorreto: 'E-mail ou senha incorretos.',
  email: 'E-mail inválido. Confira o endereço.',
  semServidor: 'O acesso ainda não está conectado. Nenhum dado saiu do seu navegador.',
  semRecuperacao: 'A recuperação de senha ainda não está conectada.',
  falha: 'Não foi possível entrar agora. Tente de novo em instantes.',
};

const form = document.getElementById('ct-form-entrar');
const botao = document.getElementById('ct-entrar-botao');
const elErro = document.getElementById('ct-entrar-erro');
const elDemo = document.getElementById('ct-entrar-demo');
const email = document.getElementById('ct-email');
const senha = document.getElementById('ct-senha');

criarFundo(document.getElementById('ct-fundo'), { parado: reduzido() });
carregarMovimento().then(ligarCena);

// a faixa de demonstração saiu da tela de entrar a pedido do Yuri (30/09); o aviso ao enviar continua
const faixaDemo = document.getElementById('ct-demo');
if (!CONECTADO && faixaDemo) faixaDemo.hidden = false;

const campos = ligarCampos(form, {
  email: (v) => {
    const e = String(v).trim();
    if (!e) return '';
    return emailValido(e) ? '' : TEXTOS.email;
  },
});
const esconderSenha = ligarOlho(form.querySelector('.ct-olho'));

// ───────────── avisos do formulário ─────────────
function descreverPor(controle, id, sim) {
  const atual = (controle.getAttribute('aria-describedby') || '').split(/\s+/).filter((x) => x && x !== id);
  if (sim) atual.push(id);
  if (atual.length) controle.setAttribute('aria-describedby', atual.join(' '));
  else controle.removeAttribute('aria-describedby');
}

function marcar(controle, sim) {
  const campo = campos.campos.get(controle.name);
  const errado = sim || Boolean(campo && campo.comErro);
  controle.closest('.ct-campo').classList.toggle('ct-com-erro', errado);
  if (errado) controle.setAttribute('aria-invalid', 'true');
  else controle.removeAttribute('aria-invalid');
  descreverPor(controle, elErro.id, sim);
}

function limparAvisos() {
  elErro.hidden = true;
  elErro.textContent = '';
  elDemo.hidden = true;
  elDemo.textContent = '';
  [email, senha].forEach((c) => {
    if (c.getAttribute('aria-describedby') && c.getAttribute('aria-describedby').indexOf(elErro.id) !== -1) marcar(c, false);
  });
}

function avisarErro(texto, controles) {
  elDemo.hidden = true;
  elErro.textContent = texto;
  elErro.hidden = false;
  revelar(elErro);
  controles.forEach((c) => marcar(c, true));
}

function avisarDemo(texto) {
  elErro.hidden = true;
  elDemo.textContent = texto;
  elDemo.hidden = false;
  revelar(elDemo);
}

[email, senha].forEach((c) => c.addEventListener('input', () => {
  if (!elErro.hidden) limparAvisos();
}));

// ───────────── enviar ─────────────
let enviando = false;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (enviando) return;
  limparAvisos();

  const vazios = [email, senha].filter((c) => (c === senha ? c.value === '' : c.value.trim() === ''));
  if (vazios.length) {
    avisarErro(TEXTOS.vazio, vazios);
    vazios[0].focus();
    return;
  }
  if (!campos.validar('email')) {
    campos.focar('email');
    return;
  }

  enviando = true;
  ocupar(botao, true);
  esconderSenha();
  try {
    const resposta = await entrar({ email: email.value.trim().toLowerCase(), senha: senha.value });
    // servidor ligado: a sessão foi aberta e a tela segue para onde ele mandar
    senha.value = '';
    window.location.assign((resposta && resposta.destino) || '/');
  } catch (falha) {
    const codigo = falha && falha.codigo;
    if (codigo === 'SEM_SERVIDOR') {
      avisarDemo(TEXTOS.semServidor);
    } else if (codigo === 'CREDENCIAIS_INVALIDAS') {
      senha.value = '';
      avisarErro((falha && falha.mensagem) || TEXTOS.incorreto, [email, senha]);
      senha.focus();
    } else if (falha && falha.campos && (falha.campos.email || falha.campos.senha)) {
      if (falha.campos.email) campos.mostrarErro('email', falha.campos.email);
      if (falha.campos.senha) campos.mostrarErro('senha', falha.campos.senha);
      campos.focar(falha.campos.email ? 'email' : 'senha');
    } else {
      avisarErro((falha && falha.mensagem) || TEXTOS.falha, []);
    }
  } finally {
    enviando = false;
    ocupar(botao, false);
  }
});

document.getElementById('ct-esqueci').addEventListener('click', () => {
  limparAvisos();
  avisarDemo(TEXTOS.semRecuperacao);
});

window.setTimeout(() => document.body.classList.add('ct-aberto'), 2200);

// o botão nasce desligado no HTML e só liga aqui, com tudo pronto para tratar o envio
botao.disabled = false;
