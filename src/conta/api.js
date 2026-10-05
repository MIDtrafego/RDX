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
//       criarConta       nome, sobrenome, email, telefone, pais, origem, senha,
//                        confirma, aceiteTermos, aceiteTitular, aceiteArbitragem
//       enviarDocumento  tipo, frente, verso
//
//     CPF e data de nascimento NÃO são mais pedidos no cadastro (05/10/2026): o
//     KYC fica para o painel, depois da conta criada. CPF_JA_CADASTRADO continua
//     previsto, mas sem campo para marcar vira um aviso geral na tela.
//
// O QUE A TELA JÁ CONFERE ANTES DE CHAMAR (o servidor precisa conferir de novo)
//
//   e-mail em formato válido · telefone completo · senha com 8 ou mais caracteres
//   e confirmação igual · os dois documentos rolados até o fim na janela · as três
//   caixas marcadas · arquivo PNG, JPG ou PDF (pela assinatura do arquivo, não
//   pela extensão) com no máximo 10 MB.
//
// AINDA SEM FUNÇÃO AQUI
//
//   "Esqueci a senha" não tem fluxo definido (ver referencia/PENDENCIAS-CONTA.md).
//   Hoje o link só avisa que a recuperação não está conectada.
// ═══════════════════════════════════════════════════════════════════════════

// false: as telas mostram a faixa de demonstração. true: servidor ligado.
export const CONECTADO = false;

// Versão do texto jurídico mostrado na janela dos termos (Termos de Uso v1.0 e
// Aviso de Risco, outubro de 2026, em /src/conta/documentos.html). Vai junto no
// cadastro para o servidor registrar qual versão foi aceita. Quando o texto mudar,
// troque aqui também: o servidor deve guardar o hash do texto desta versão
// (Termos, cláusula 16.2).
export const VERSAO_DOS_TERMOS = '1.0-2026-10';

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
 *     telefone: '11987654321',        só números. BR: DDD + número (10 ou 11). fora do BR: 7 a 15 números
 *     origem: 'instagram',            'indicacao' | 'instagram' | 'youtube' | 'google' | 'outro' | '' (não respondeu)
 *     senha: 'texto como digitado',
 *     aceites: {
 *       termos: true,                 caixa 1: Termos de Uso, Aviso de Risco e Política de Privacidade
 *       titular: true,                caixa 2: conta de titularidade própria, só capital próprio
 *       arbitragem: true,             caixa 3: arbitragem (cláusula 13.2), aceite separado (Lei 9.307/96, art. 4º, § 2º)
 *       versao: '1.0-2026-10',        versão do texto aceito (VERSAO_DOS_TERMOS)
 *       leuTermos: true,              rolou os Termos de Uso até o fim dentro da janela
 *       leuRisco: true,               rolou o Aviso de Risco até o fim dentro da janela
 *       tempoLeituraMs: 184000,       tempo somado com a janela dos documentos aberta, em milissegundos
 *     },
 *   }
 *   Os três aceites são obrigatórios; a tela só chama com os três true e com os dois
 *   documentos lidos. O servidor registra data e hora (UTC) de cada aceite, IP, user
 *   agent, idioma e fuso, e o hash SHA-256 do texto de cada documento da versão
 *   aceita (Termos de Uso, cláusula 16.2). CPF, nascimento e documento ficam para o KYC.
 *
 * SAÍDA (resolve)
 *   {}                                 nada é obrigatório. a conta criada já deve
 *                                      ficar autenticada (cookie de sessão), porque
 *                                      o passo seguinte envia o documento dela
 *
 * FALHA (rejeita)
 *   { codigo: 'EMAIL_JA_CADASTRADO' }
 *   { codigo: 'CPF_JA_CADASTRADO' }        só faz sentido depois do KYC; na tela vira aviso geral
 *   { codigo: 'DADOS_INVALIDOS', campos: { telefone: '...' } }
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
