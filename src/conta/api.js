// ═══════════════════════════════════════════════════════════════════════════
// RDX · conta · ponte com o servidor
//
// ESTE É O ÚNICO ARQUIVO QUE PRECISA MUDAR PARA LIGAR A AUTENTICAÇÃO DE VERDADE.
// As telas (entrar.html e cadastro.html) só falam com o servidor por aqui.
//
// HOJE NÃO EXISTE SERVIDOR. Nenhuma função faz pedido de rede, nenhuma guarda o
// que recebe, e todas devolvem uma Promise rejeitada com { codigo: 'SEM_SERVIDOR' }.
// As telas entendem esse código e avisam que é um ambiente de demonstração.
//
// ───────────────────────────────────────────────────────────────────────────
// PARA LIGAR O SERVIDOR
//
//   1. Troque CONECTADO para true. Isso tira a faixa "Demonstração" das telas.
//   2. Escreva o corpo das três funções. O formato de entrada e de saída está
//      descrito em cima de cada uma e as telas já contam com ele.
//   3. Não precisa mexer em mais nada.
//
// REGRAS QUE VALEM PARA AS TRÊS
//
//   • Só HTTPS. Senha, CPF e foto de documento nunca vão em endereço (query
//     string), sempre no corpo do pedido.
//   • Sessão: o ideal é o servidor devolver cookie HttpOnly + Secure + SameSite.
//     Se for por token, guarde numa variável DESTE módulo (memória). Nunca em
//     localStorage, sessionStorage ou cookie escrito por JavaScript.
//   • Não registre os dados em console.log.
//   • Sucesso: a Promise resolve com o objeto descrito em cada função.
//   • Falha: a Promise rejeita com um objeto neste formato:
//
//       {
//         codigo: 'CODIGO_EM_MAIUSCULAS',     obrigatório
//         mensagem: 'texto para a pessoa',    opcional. se vier, a tela mostra este texto
//         campos: { email: 'texto', ... }     opcional. erro preso a um campo
//       }
//
//     Códigos que as telas já conhecem:
//       SEM_SERVIDOR            não há servidor ligado (estado de hoje)
//       CREDENCIAIS_INVALIDAS   mostra "E-mail ou senha incorretos."
//       DADOS_INVALIDOS         use junto com "campos" para apontar o campo
//       EMAIL_JA_CADASTRADO     marca o campo de e-mail do cadastro
//       CPF_JA_CADASTRADO       marca o campo de CPF do cadastro
//       ARQUIVO_INVALIDO        use junto com "campos" (frente ou verso)
//       SEM_SESSAO              a conta não está autenticada para enviar documento
//       MUITAS_TENTATIVAS       mostra a "mensagem", ou um texto padrão
//     Qualquer outro código cai num aviso genérico de falha.
//
//     Nomes aceitos em "campos":
//       entrar           email, senha
//       criarConta       nome, sobrenome, email, cpf, telefone, nascimento, pais,
//                        origem, senha, confirma, aceiteTermos, aceiteRisco
//       enviarDocumento  tipo, frente, verso
//
// O QUE A TELA JÁ CONFERE ANTES DE CHAMAR (o servidor precisa conferir de novo)
//
//   e-mail em formato válido · CPF com os dois dígitos verificadores · telefone
//   completo · 18 anos ou mais · senha com 8 ou mais caracteres e confirmação
//   igual · as duas caixas marcadas · arquivo PNG, JPG ou PDF (pela assinatura
//   do arquivo, não pela extensão) com no máximo 10 MB.
//
// AINDA SEM FUNÇÃO AQUI
//
//   "Esqueci a senha" não tem fluxo definido (ver referencia/PENDENCIAS-CONTA.md).
//   Hoje o link só avisa que a recuperação não está conectada.
// ═══════════════════════════════════════════════════════════════════════════

// false: as telas mostram a faixa de demonstração. true: servidor ligado.
export const CONECTADO = false;

// Versão do texto jurídico mostrado na janela dos termos. Vai junto no cadastro
// para o servidor registrar qual versão foi aceita.
export const VERSAO_DOS_TERMOS = '1.0';

const semServidor = () => Promise.reject({ codigo: 'SEM_SERVIDOR' });

/**
 * Entrar na plataforma.
 *
 * ENTRADA
 *   dados = {
 *     email: 'pessoa@exemplo.com',    sem espaços nas pontas, em minúsculas
 *     senha: 'texto como digitado',   nunca aparada nem alterada
 *   }
 *
 * SAÍDA (resolve)
 *   {
 *     destino: '/painel/',            obrigatório. a tela navega para este endereço
 *   }
 *
 * FALHA (rejeita)
 *   { codigo: 'CREDENCIAIS_INVALIDAS' }
 *   { codigo: 'MUITAS_TENTATIVAS', mensagem: 'Tente de novo em 5 minutos.' }
 *   { codigo: 'DADOS_INVALIDOS', campos: { email: '...' } }
 *
 * @param {{ email: string, senha: string }} dados
 * @returns {Promise<{ destino: string }>}
 */
export function entrar(dados) { // eslint-disable-line no-unused-vars
  return semServidor();
}

/**
 * Criar a conta (passos 1 e 2 do cadastro).
 *
 * ENTRADA
 *   dados = {
 *     nome: 'Pessoa',
 *     sobrenome: 'Teste',
 *     email: 'pessoa@exemplo.com',    em minúsculas
 *     pais: 'BR',                     'BR' | 'PT' | 'US'
 *     cpf: '12345678909',             só os 11 números. '' quando o país não é BR e a pessoa não informou
 *     telefone: '11987654321',        só números. BR: DDD + número (10 ou 11). fora do BR: 7 a 15 números
 *     nascimento: '1990-05-20',       AAAA-MM-DD
 *     origem: 'instagram',            'indicacao' | 'instagram' | 'youtube' | 'google' | 'outro' | '' (não respondeu)
 *     senha: 'texto como digitado',
 *     aceites: {
 *       termos: true,                 caixa 1: Termos de Uso, Política de Privacidade e Aviso de Risco
 *       risco: true,                  caixa 2: declaração de ciência de risco
 *       versao: '1.0',                versão do texto aceito
 *     },
 *   }
 *   A data e a hora do aceite devem ser registradas pelo servidor.
 *
 * SAÍDA (resolve)
 *   {}                                 nada é obrigatório. a conta criada já deve
 *                                      ficar autenticada (cookie de sessão), porque
 *                                      o passo seguinte envia o documento dela
 *
 * FALHA (rejeita)
 *   { codigo: 'EMAIL_JA_CADASTRADO' }
 *   { codigo: 'CPF_JA_CADASTRADO' }
 *   { codigo: 'DADOS_INVALIDOS', campos: { nascimento: '...' } }
 *
 * @param {object} dados
 * @returns {Promise<object>}
 */
export function criarConta(dados) { // eslint-disable-line no-unused-vars
  return semServidor();
}

/**
 * Enviar o documento de identidade (passo 3 do cadastro).
 * Só é chamada depois de criarConta ter resolvido.
 *
 * ENTRADA
 *   arquivos = {
 *     tipo: 'cnh',                    'cnh' | 'passaporte' | 'rg'
 *     frente: File,                   PNG, JPG ou PDF, até 10 MB
 *     verso: File | null,             null só quando o tipo é 'passaporte'
 *   }
 *   Envie como multipart/form-data (FormData). "frente" e "verso" são objetos
 *   File do navegador, com name, size e type.
 *
 * SAÍDA (resolve)
 *   {}                                 nada é obrigatório. a tela mostra
 *                                      "Documento em análise"
 *
 * FALHA (rejeita)
 *   { codigo: 'ARQUIVO_INVALIDO', campos: { frente: 'Imagem ilegível.' } }
 *   { codigo: 'SEM_SESSAO' }
 *
 * @param {{ tipo: string, frente: File, verso: File | null }} arquivos
 * @returns {Promise<object>}
 */
export function enviarDocumento(arquivos) { // eslint-disable-line no-unused-vars
  return semServidor();
}
