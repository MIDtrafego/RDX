// ═══════════════════════════════════════════════════════════════════════════
// RDX · conta · ponte com o servidor
//
// ESTE É O ÚNICO ARQUIVO QUE PRECISA MUDAR PARA LIGAR O SERVIDOR DE VERDADE.
// As telas (comecar.html, cadastro.html e entrar.html) só falam com o servidor
// por aqui.
//
// HOJE NÃO EXISTE SERVIDOR. Nenhuma função faz pedido de rede, nenhuma guarda o
// que recebe, e todas devolvem uma Promise rejeitada com { codigo: 'SEM_SERVIDOR' }.
// As telas entendem esse código: guardam o que dá no próprio navegador
// (src/conta/guardado.js) e avisam que o servidor ainda não está ligado.
//
// ───────────────────────────────────────────────────────────────────────────
// PARA LIGAR O SERVIDOR
//
//   1. Troque CONECTADO para true. Isso tira os avisos de "ainda sem servidor".
//   2. Escreva o corpo das quatro funções. O formato de entrada e de saída está
//      descrito em cima de cada uma e as telas já contam com ele.
//   3. Não precisa mexer em mais nada.
//
// REGRAS QUE VALEM PARA TODAS
//
//   • Só HTTPS. Senha, CPF, senha de negociação e foto de documento nunca vão
//     em endereço (query string), sempre no corpo do pedido.
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
//       EMAIL_JA_CADASTRADO     marca o campo de e-mail
//       CPF_JA_CADASTRADO       marca o campo de CPF
//       LOGIN_JA_CONECTADO      este login MT5 já está conectado em outra conta RDX
//       CREDENCIAL_INVALIDA     a corretora recusou login, servidor ou senha
//       KYC_PENDENTE            a conexão só libera depois da verificação de identidade
//       ARQUIVO_INVALIDO        use junto com "campos" (frente, verso ou selfie)
//       SEM_SESSAO              a conta não está autenticada
//       MUITAS_TENTATIVAS       mostra a "mensagem", ou um texto padrão
//     Qualquer outro código cai num aviso genérico de falha.
//
//     Nomes aceitos em "campos":
//       entrar           email, senha
//       criarConta       nome, cpf, whatsapp, email, senha, pais,
//                        aceiteTermos, aceiteTitular, aceiteArbitragem
//       conectarConta    mt5Login, mt5Servidor, mt5Senha
//       enviarDocumento  tipo, frente, verso, selfie
//
// O QUE A TELA JÁ CONFERE ANTES DE CHAMAR (o servidor precisa conferir de novo)
//
//   nome com duas palavras ou mais · CPF com dígitos verificadores válidos ·
//   e-mail em formato válido · WhatsApp completo · senha com 8 ou mais
//   caracteres · país BR ou PT (o serviço não é oferecido a residentes nos EUA) ·
//   os dois documentos rolados até o fim na janela · as três caixas marcadas ·
//   login MT5 só números · arquivo PNG, JPG ou PDF (pela assinatura do arquivo,
//   não pela extensão) com no máximo 10 MB.
//
// AINDA SEM FUNÇÃO AQUI
//
//   "Esqueci a senha" não tem fluxo definido (ver referencia/PENDENCIAS-CONTA.md).
//   Hoje o link só avisa que a recuperação não está conectada.
// ═══════════════════════════════════════════════════════════════════════════

// false: as telas avisam que o servidor ainda não está ligado. true: servidor ligado.
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
 * Criar a conta RDX (passo 2 de comecar.html, "Criar conta e entrar").
 * Nomes dos campos como na especificação do backend, seção 2.1 (cadastro e aceite).
 *
 * ENTRADA
 *   dados = {
 *     first_name: 'Pessoa',           primeira palavra do nome completo
 *     last_name: 'Teste da Silva',    o resto do nome completo
 *     email: 'pessoa@exemplo.com',    em minúsculas
 *     phone: '5511987654321',         só números, com o código do país (55 no Brasil)
 *     country: 'BR',                  'BR' | 'PT'. EUA não entra: o serviço não é oferecido lá
 *     password: 'texto como digitado',
 *     cpf: '12345678909',             só números, dígitos verificadores conferidos na tela
 *     terms_version: '1.0-2026-10',   VERSAO_DOS_TERMOS
 *     terms_checks: {
 *       box1: true,                   Li e aceito os Termos de Uso, o Aviso de Risco e a Política de Privacidade
 *       box2: true,                   conta de minha titularidade, só capital próprio
 *       box3: true,                   arbitragem como forma exclusiva de solução de disputas (Lei 9.307/96, art. 4º, § 2º)
 *     },
 *     prova: {                        o que o navegador consegue colher (Termos, cláusula 16.2)
 *       versao: '1.0-2026-10',
 *       hash_termos: '9f2c…',         SHA-256 (hex) do textContent da seção #ct-doc-termos do fragmento
 *       hash_risco: '4b71…',          SHA-256 (hex) do textContent da seção #ct-doc-risco
 *       caixa1_em: '2026-10-05T18:21:07.412Z',   data e hora UTC (ISO 8601) do clique em cada caixa
 *       caixa2_em: '2026-10-05T18:21:09.030Z',
 *       caixa3_em: '2026-10-05T18:21:10.577Z',
 *       user_agent: 'Mozilla/5.0 …',
 *       idioma: 'pt-BR',
 *       fuso: 'America/Sao_Paulo',
 *       tempo_termos_ms: 184000,      tempo com os Termos de Uso sob os olhos, na janela
 *       tempo_risco_ms: 62000,        tempo com o Aviso de Risco sob os olhos
 *       tempo_total_ms: 251000,       tempo somado com a janela aberta
 *       rolou_termos: true,           rolou os Termos de Uso até o fim
 *       rolou_risco: true,            rolou o Aviso de Risco até o fim
 *     },
 *   }
 *   Os três aceites são obrigatórios; a tela só chama com os três true e com os dois
 *   documentos lidos. O servidor completa o registro com IP, HMAC, carimbo de tempo e
 *   confere os hashes contra a versão guardada em legal_documents. O 2FA (TOTP) da
 *   especificação fica para o painel: a tela não o pede.
 *
 * SAÍDA (resolve)
 *   {
 *     destino: '/painel/',            opcional. se vier, a tela navega para lá ("entrar")
 *   }
 *   A conta criada já deve ficar autenticada (cookie de sessão), porque o passo
 *   seguinte conecta a corretora.
 *
 * FALHA (rejeita)
 *   { codigo: 'EMAIL_JA_CADASTRADO' }
 *   { codigo: 'CPF_JA_CADASTRADO' }
 *   { codigo: 'DADOS_INVALIDOS', campos: { whatsapp: '...' } }
 *
 * @param {object} dados
 * @returns {Promise<{ destino?: string }>}
 */
export function criarConta(dados) { // eslint-disable-line no-unused-vars
  return semServidor();
}

/**
 * Conectar a conta da corretora ao cluster (passo 3 de comecar.html, "Conectar").
 * Só faz sentido depois de criarConta ter resolvido e com a sessão ativa. O painel
 * exige a verificação de identidade (KYC) antes de liberar: se ela faltar, rejeite
 * com KYC_PENDENTE.
 *
 * ENTRADA
 *   dados = {
 *     broker: 'Exness',
 *     server: 'Exness-MT5Real8',      como está na Exness
 *     login: '75062604',              só números
 *     password: 'texto como digitado', senha de negociação da plataforma (não a da Exness)
 *     platform: 'mt5',                'mt5' | 'mt4'
 *   }
 *   A senha de negociação vai cifrada em repouso e nunca volta para o navegador
 *   (especificação, seção 2.2).
 *
 * SAÍDA (resolve)
 *   {
 *     estado: 'CONNECTING',           'CONNECTING' | 'CONNECTED' | 'PENDING_DEPOSIT'. opcional
 *   }
 *
 * FALHA (rejeita)
 *   { codigo: 'KYC_PENDENTE' }
 *   { codigo: 'CREDENCIAL_INVALIDA', campos: { mt5Senha: 'A corretora recusou a senha.' } }
 *   { codigo: 'LOGIN_JA_CONECTADO', campos: { mt5Login: '...' } }
 *   { codigo: 'SEM_SESSAO' }
 *
 * @param {{ broker: string, server: string, login: string, password: string, platform: string }} dados
 * @returns {Promise<{ estado?: string }>}
 */
export function conectarConta(dados) { // eslint-disable-line no-unused-vars
  return semServidor();
}

/**
 * Enviar os documentos da verificação de identidade (KYC, cadastro.html).
 * Só é chamada com a sessão ativa.
 *
 * ENTRADA
 *   arquivos = {
 *     tipo: 'cnh',                    'cnh' | 'passaporte' | 'rg'
 *     frente: File,                   PNG, JPG ou PDF, até 10 MB
 *     verso: File | null,             null só quando o tipo é 'passaporte'
 *     selfie: File,                   PNG ou JPG, até 10 MB, rosto da pessoa segurando o documento
 *   }
 *   Envie como multipart/form-data (FormData). "frente", "verso" e "selfie" são
 *   objetos File do navegador, com name, size e type.
 *
 * SAÍDA (resolve)
 *   {}                                 nada é obrigatório. a tela mostra
 *                                      "Documento em análise"
 *
 * FALHA (rejeita)
 *   { codigo: 'ARQUIVO_INVALIDO', campos: { frente: 'Imagem ilegível.' } }
 *   { codigo: 'SEM_SESSAO' }
 *
 * @param {{ tipo: string, frente: File, verso: File | null, selfie: File }} arquivos
 * @returns {Promise<object>}
 */
export function enviarDocumento(arquivos) { // eslint-disable-line no-unused-vars
  return semServidor();
}
