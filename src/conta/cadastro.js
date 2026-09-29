// Cadastro em 3 passos: dados, segurança, verificação. Depois, a conclusão.
//
// Nada do que é digitado aqui sai do navegador ou é gravado. Os dados ficam só nos campos
// desta página enquanto ela está aberta e são apagados na conclusão. O único caminho para
// o servidor é src/conta/api.js, que hoje devolve SEM_SERVIDOR.
import { CONECTADO, VERSAO_DOS_TERMOS, criarConta, enviarDocumento } from './api.js';
import {
  soNumeros, emailValido, mascaraCpf, cpfValido, mascaraTelefoneBR, numerosDoTelefoneBR,
  limparTelefoneLivre, telefoneValido, idade, limiteDeNascimento, forcaDaSenha, SENHA_MINIMO,
} from './validacao.js';
import { ligarCampos, ligarMascara, ligarOlho, ocupar } from './campos.js';
import { carregarMovimento, ligarCena, reduzido, revelar, trocarPasso } from './movimento.js';
import { criarFundo } from './fundo.js';
import { criarJanela } from './termos.js';
import { ligarArquivo, segurarSoltaFora } from './documento.js';

const TEXTOS = {
  nome: 'Informe o nome.',
  sobrenome: 'Informe o sobrenome.',
  emailVazio: 'Informe o e-mail.',
  email: 'E-mail inválido. Confira o endereço.',
  cpfVazio: 'Informe o CPF.',
  cpfCurto: 'CPF incompleto. São 11 números.',
  cpf: 'CPF inválido. Confira os números.',
  telefoneVazio: 'Informe o telefone.',
  telefoneBR: 'Telefone inválido. Use DDD e número.',
  telefone: 'Telefone inválido. Confira os números.',
  nascimentoVazio: 'Informe a data de nascimento.',
  nascimentoMetade: 'Data incompleta. Informe dia, mês e ano.',
  nascimento: 'Data inválida. Confira dia, mês e ano.',
  menor: 'É preciso ter 18 anos ou mais para criar a conta.',
  pais: 'Escolha o país.',
  senhaVazia: 'Crie uma senha.',
  senhaCurta: 'A senha precisa de no mínimo 8 caracteres.',
  confirmaVazia: 'Confirme a senha.',
  confirma: 'As senhas não são iguais.',
  caixa: 'Marque esta caixa para continuar.',
  frente: 'Envie a frente do documento.',
  verso: 'Envie o verso do documento.',
  emailUsado: 'Este e-mail já tem conta.',
  cpfUsado: 'Este CPF já tem conta.',
  falhaCriar: 'Não foi possível criar a conta agora. Tente de novo em instantes.',
  falhaEnviar: 'Não foi possível enviar o documento agora. Tente de novo em instantes.',
  envioDesligado: 'O envio de documento ainda não está conectado. Nenhum arquivo foi enviado.',
  forca: 'Força da senha: ',
};

const PAISES = ['BR', 'PT', 'US'];
const DO_PASSO_1 = ['nome', 'sobrenome', 'email', 'cpf', 'telefone', 'nascimento', 'pais', 'origem'];

const $ = (id) => document.getElementById(id);

const cartao = $('ct-cartao');
const palco = $('ct-palco');
const passos = {
  1: $('ct-passo-1'),
  2: $('ct-passo-2'),
  3: $('ct-passo-3'),
  4: $('ct-passo-4'),
};
const formDados = $('ct-form-dados');
const formSeguranca = $('ct-form-seguranca');
const formVerificacao = $('ct-form-verificacao');
const btContinuar = $('ct-continuar');
const btVoltar = $('ct-voltar');
const btCriar = $('ct-criar');
const btEnviar = $('ct-enviar');
const btDepois = $('ct-depois');
const erroCriar = $('ct-criar-erro');
const erroEnviar = $('ct-enviar-erro');

const estado = {
  passo: 1,
  contaCriada: false,   // só vira true quando o servidor confirma
  ocupado: false,
};

criarFundo($('ct-fundo'), { parado: reduzido() });
carregarMovimento().then(ligarCena);

if (!CONECTADO) $('ct-demo').hidden = false;

// ═══════════════════════════════════════════════════════════════════════════
// PROGRESSO E TROCA DE PASSO
// ═══════════════════════════════════════════════════════════════════════════
const etapas = Array.from(document.querySelectorAll('[data-ct-etapa]'));
const fios = Array.from(document.querySelectorAll('[data-ct-fio]'));

function pintarProgresso(n) {
  etapas.forEach((el) => {
    const k = Number(el.dataset.ctEtapa);
    el.classList.toggle('ct-etapa-feita', k < n);
    el.classList.toggle('ct-etapa-atual', k === n);
    if (k === n) el.setAttribute('aria-current', 'step');
    else el.removeAttribute('aria-current');
  });
  fios.forEach((el) => el.classList.toggle('ct-fio-cheio', Number(el.dataset.ctFio) < n));
}

function subirParaOCartao() {
  const topo = cartao.getBoundingClientRect().top + window.scrollY - 16;
  if (window.scrollY > topo) {
    window.scrollTo({ top: Math.max(0, topo), behavior: reduzido() ? 'auto' : 'smooth' });
  }
}

async function irPara(n) {
  if (n === estado.passo) return;
  const direcao = n > estado.passo ? 1 : -1;
  const sai = passos[estado.passo];
  const entra = passos[n];
  estado.passo = n;
  pintarProgresso(n);
  const troca = trocarPasso({ palco, sai, entra, direcao });
  const titulo = entra.querySelector('.ct-fim-bloco:not([hidden]) [data-ct-fim-titulo]') || entra.querySelector('.ct-titulo');
  if (titulo) titulo.focus({ preventScroll: true });
  subirParaOCartao();
  await troca;
}

// ═══════════════════════════════════════════════════════════════════════════
// PASSO 1: DADOS PESSOAIS
// ═══════════════════════════════════════════════════════════════════════════
const elCpf = $('ct-cpf');
const elTelefone = $('ct-telefone');
const elNascimento = $('ct-nascimento');
const elPais = $('ct-pais');
const notaCpf = $('ct-cpf-nota');

const doBrasil = () => elPais.value === 'BR';

const dados = ligarCampos(formDados, {
  nome: (v) => (String(v).trim() ? '' : TEXTOS.nome),
  sobrenome: (v) => (String(v).trim() ? '' : TEXTOS.sobrenome),
  email: (v) => {
    const e = String(v).trim();
    if (!e) return TEXTOS.emailVazio;
    return emailValido(e) ? '' : TEXTOS.email;
  },
  cpf: (v) => {
    const n = soNumeros(v);
    if (!n.length) return doBrasil() ? TEXTOS.cpfVazio : '';
    if (n.length < 11) return TEXTOS.cpfCurto;
    return cpfValido(n) ? '' : TEXTOS.cpf;
  },
  telefone: (v) => {
    if (!soNumeros(v).length) return TEXTOS.telefoneVazio;
    if (telefoneValido(v, elPais.value)) return '';
    return doBrasil() ? TEXTOS.telefoneBR : TEXTOS.telefone;
  },
  nascimento: (v, { controle }) => {
    if (!v) return controle.validity && controle.validity.badInput ? TEXTOS.nascimentoMetade : TEXTOS.nascimentoVazio;
    const anos = idade(v);
    if (anos === null || anos < 0 || anos > 120) return TEXTOS.nascimento;
    return anos < 18 ? TEXTOS.menor : '';
  },
  pais: (v) => (PAISES.indexOf(v) !== -1 ? '' : TEXTOS.pais),
});

ligarMascara(elCpf, mascaraCpf);
const mascararTelefone = ligarMascara(elTelefone, (v) => (doBrasil() ? mascaraTelefoneBR(v) : limparTelefoneLivre(v)));
elNascimento.max = limiteDeNascimento();

// O CPF só é exigido de quem mora no Brasil. A máscara do telefone também é só de lá.
function aplicarPais() {
  const br = doBrasil();
  elCpf.required = br;
  notaCpf.hidden = br;
  elTelefone.placeholder = br ? '(99) 99999-9999' : '';
  if (br) mascararTelefone();
  ['cpf', 'telefone'].forEach((nome) => {
    if (dados.campos.get(nome).comErro) dados.validar(nome);
  });
}
elPais.addEventListener('change', aplicarPais);
aplicarPais();

formDados.addEventListener('submit', (e) => {
  e.preventDefault();
  if (estado.ocupado || estado.passo !== 1) return;
  const errados = dados.validarTudo();
  if (errados.length) {
    dados.focar(errados[0]);
    return;
  }
  $('ct-usuario').value = $('ct-email').value.trim().toLowerCase();
  irPara(2);
});

// ═══════════════════════════════════════════════════════════════════════════
// PASSO 2: SEGURANÇA DA CONTA
// ═══════════════════════════════════════════════════════════════════════════
const elSenha = $('ct-senha');
const elConfirma = $('ct-confirma');
const elAceiteTermos = $('ct-aceite-termos');
const elAceiteRisco = $('ct-aceite-risco');
const elForca = $('ct-forca');
const elForcaTexto = $('ct-forca-texto');
const criterios = Array.from(document.querySelectorAll('[data-ct-criterio]'));

const seguranca = ligarCampos(formSeguranca, {
  senha: (v) => {
    if (!v) return TEXTOS.senhaVazia;
    return v.length < SENHA_MINIMO ? TEXTOS.senhaCurta : '';
  },
  confirma: (v) => {
    if (!v) return TEXTOS.confirmaVazia;
    return v === elSenha.value ? '' : TEXTOS.confirma;
  },
  aceiteTermos: (v) => (v ? '' : TEXTOS.caixa),
  aceiteRisco: (v) => (v ? '' : TEXTOS.caixa),
});

const esconderSenhas = Array.from(formSeguranca.querySelectorAll('.ct-olho')).map(ligarOlho);

function pintarForca() {
  const f = forcaDaSenha(elSenha.value);
  elForca.dataset.ctNivel = String(f.nivel);
  const texto = f.nivel ? TEXTOS.forca + f.rotulo : '';
  if (elForcaTexto.textContent !== texto) elForcaTexto.textContent = texto;
  criterios.forEach((li) => li.classList.toggle('ct-criterio-ok', Boolean(elSenha.value) && f.criterios[li.dataset.ctCriterio]));
}
elSenha.addEventListener('input', () => {
  pintarForca();
  if (seguranca.campos.get('confirma').comErro) seguranca.validar('confirma');
});
elSenha.addEventListener('blur', () => {
  if (elConfirma.value && elSenha.value) seguranca.validar('confirma');
});

// "Criar conta" só liga com as duas caixas marcadas
function pintarCriar() {
  btCriar.disabled = !(elAceiteTermos.checked && elAceiteRisco.checked);
}
[elAceiteTermos, elAceiteRisco].forEach((c) => c.addEventListener('change', pintarCriar));

btVoltar.addEventListener('click', () => {
  if (estado.ocupado) return;
  irPara(1);
});

function dadosDoCadastro() {
  const br = doBrasil();
  return {
    nome: $('ct-nome').value.trim(),
    sobrenome: $('ct-sobrenome').value.trim(),
    email: $('ct-email').value.trim().toLowerCase(),
    pais: elPais.value,
    cpf: soNumeros(elCpf.value),
    telefone: br ? numerosDoTelefoneBR(elTelefone.value) : soNumeros(elTelefone.value),
    nascimento: elNascimento.value,
    origem: $('ct-origem').value,
    senha: elSenha.value,
    aceites: {
      termos: elAceiteTermos.checked,
      risco: elAceiteRisco.checked,
      versao: VERSAO_DOS_TERMOS,
    },
  };
}

function avisar(el, texto) {
  el.textContent = texto;
  el.hidden = false;
  revelar(el);
}
function calar(el) {
  el.hidden = true;
  el.textContent = '';
}

// erro que veio do servidor preso a um campo: volta para o passo do campo e mostra ali
async function mostrarErrosDoServidor(erros) {
  const nomes = Object.keys(erros);
  const noPasso1 = nomes.filter((n) => DO_PASSO_1.indexOf(n) !== -1);
  if (noPasso1.length) {
    await irPara(1);
    noPasso1.forEach((n) => dados.mostrarErro(n, erros[n]));
    dados.focar(noPasso1[0]);
    return;
  }
  const noPasso2 = nomes.filter((n) => seguranca.campos.has(n));
  noPasso2.forEach((n) => seguranca.mostrarErro(n, erros[n]));
  if (noPasso2.length) seguranca.focar(noPasso2[0]);
}

async function tentarCriar() {
  if (estado.ocupado || estado.passo !== 2) return;
  calar(erroCriar);
  const errados = seguranca.validarTudo();
  if (errados.length) {
    seguranca.focar(errados[0]);
    return;
  }

  estado.ocupado = true;
  ocupar(btCriar, true);
  esconderSenhas.forEach((f) => f());
  try {
    await criarConta(dadosDoCadastro());
    estado.contaCriada = true;
    await irPara(3);
  } catch (falha) {
    const codigo = falha && falha.codigo;
    if (codigo === 'SEM_SERVIDOR') {
      // sem servidor: o fluxo segue só para mostrar as telas. nada foi criado
      estado.contaCriada = false;
      await irPara(3);
    } else if (codigo === 'EMAIL_JA_CADASTRADO') {
      await mostrarErrosDoServidor({ email: (falha && falha.mensagem) || TEXTOS.emailUsado });
    } else if (codigo === 'CPF_JA_CADASTRADO') {
      await mostrarErrosDoServidor({ cpf: (falha && falha.mensagem) || TEXTOS.cpfUsado });
    } else if (falha && falha.campos && Object.keys(falha.campos).length) {
      await mostrarErrosDoServidor(falha.campos);
    } else {
      avisar(erroCriar, (falha && falha.mensagem) || TEXTOS.falhaCriar);
    }
  } finally {
    estado.ocupado = false;
    ocupar(btCriar, false);
  }
}

formSeguranca.addEventListener('submit', (e) => {
  e.preventDefault();
  tentarCriar();
});

// Enter num campo com o botão desligado não envia nada. Em vez de ficar mudo, o
// formulário aponta o que falta.
formSeguranca.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !btCriar.disabled) return;
  if (!e.target.matches('input.ct-entrada')) return;
  e.preventDefault();
  tentarCriar();
});

// ───────────── janela dos termos ─────────────
const janela = criarJanela($('ct-termos'), {
  aoAceitar() {
    [elAceiteTermos, elAceiteRisco].forEach((c) => {
      c.checked = true;
      c.dispatchEvent(new Event('change', { bubbles: true }));
    });
    seguranca.limparErro('aceiteTermos');
    seguranca.limparErro('aceiteRisco');
    pintarCriar();
  },
});
document.querySelectorAll('[data-ct-termos]').forEach((botao) => {
  botao.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    janela.abrir(botao, botao.dataset.ctTermos);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PASSO 3: VERIFICAÇÃO DE IDENTIDADE
// ═══════════════════════════════════════════════════════════════════════════
const frente = ligarArquivo($('ct-arquivo-frente'), { falta: TEXTOS.frente });
const verso = ligarArquivo($('ct-arquivo-verso'), { falta: TEXTOS.verso });
const notaVerso = $('ct-verso-nota');
const tipos = Array.from(formVerificacao.querySelectorAll('input[name="tipo"]'));
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

function apagarTudo() {
  [formDados, formSeguranca, formVerificacao].forEach((f) => f.reset());
  $('ct-usuario').value = '';
  dados.limparTudo();
  seguranca.limparTudo();
  dados.atualizarMarcas();
  seguranca.atualizarMarcas();
  frente.limpar();
  verso.limpar();
  esconderSenhas.forEach((f) => f());
  pintarForca();
  pintarCriar();
  aplicarPais();
  aplicarTipo();
  calar(erroCriar);
  calar(erroEnviar);
}

// variante: 'demo' | 'com-documento' | 'sem-documento'
async function concluir(variante) {
  passos[4].querySelectorAll('[data-ct-fim]').forEach((bloco) => {
    const meu = bloco.dataset.ctFim === variante;
    bloco.hidden = !meu;
    const titulo = bloco.querySelector('[data-ct-fim-titulo]');
    if (meu) titulo.id = 'ct-fim-titulo';
    else titulo.removeAttribute('id');
  });
  passos[4].dataset.ctVariante = variante;
  await irPara(4);
  apagarTudo();
}

async function tentarEnviar() {
  if (estado.ocupado || estado.passo !== 3) return;
  calar(erroEnviar);
  const okFrente = frente.validar();
  const okVerso = verso.validar();
  if (!okFrente) { frente.focar(); return; }
  if (!okVerso) { verso.focar(); return; }

  // sem conta criada não há para quem enviar: o arquivo nem chega a ser entregue à ponte
  if (!estado.contaCriada) {
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
    });
    await concluir('com-documento');
  } catch (falha) {
    const codigo = falha && falha.codigo;
    if (codigo === 'SEM_SERVIDOR') {
      avisar(erroEnviar, TEXTOS.envioDesligado);
    } else if (falha && falha.campos && (falha.campos.frente || falha.campos.verso)) {
      if (falha.campos.frente) frente.erro(falha.campos.frente);
      if (falha.campos.verso) verso.erro(falha.campos.verso);
      (falha.campos.frente ? frente : verso).focar();
    } else {
      avisar(erroEnviar, (falha && falha.mensagem) || TEXTOS.falhaEnviar);
    }
  } finally {
    estado.ocupado = false;
    ocupar(btEnviar, false);
  }
}

formVerificacao.addEventListener('submit', (e) => {
  e.preventDefault();
  tentarEnviar();
});

btDepois.addEventListener('click', () => {
  if (estado.ocupado || estado.passo !== 3) return;
  concluir(estado.contaCriada ? 'sem-documento' : 'demo');
});

// ═══════════════════════════════════════════════════════════════════════════
// Os botões nascem desligados no HTML e só ligam aqui, com tudo pronto.
// ═══════════════════════════════════════════════════════════════════════════
// estado de cada critério da senha também em texto, para quem usa leitor de tela
criterios.forEach((li) => {
  const voz = document.createElement('span');
  voz.className = 'ct-so-leitor';
  li.appendChild(voz);
});
const pintarVozDosCriterios = () => criterios.forEach((li) => {
  li.lastElementChild.textContent = li.classList.contains('ct-criterio-ok') ? ': atendido' : ': falta';
});
elSenha.addEventListener('input', pintarVozDosCriterios);
pintarVozDosCriterios();

// a animação de abertura é só da chegada: depois disso os passos trocam sem repetir
window.setTimeout(() => document.body.classList.add('ct-aberto'), 2200);

pintarProgresso(1);
pintarForca();
pintarCriar();
btContinuar.disabled = false;
btEnviar.disabled = false;
