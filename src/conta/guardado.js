// O que a pessoa faz na página "Comece hoje" (comecar.html) fica guardado para a
// página lembrar onde ela parou: a conta RDX criada, os dados da corretora e o estado
// da conexão.
//
// HOJE NÃO HÁ SERVIDOR. Enquanto isso, o dado fica neste navegador:
//   • localStorage para nome, CPF, WhatsApp, e-mail, país, login e servidor do MT5,
//     a data da conta criada, o registro dos aceites e o estado da conexão
//   • sessionStorage para a senha de negociação: some quando o navegador fecha
//   • a senha da conta RDX NUNCA é guardada, em lugar nenhum
//
// Quando o servidor existir, só src/conta/api.js muda: as páginas continuam
// guardando aqui o que precisam para funcionar sem rede.

const CHAVE = 'rdx.comecar';
const CHAVE_SENHA = 'rdx.comecar.senha';

// textos simples
const CAMPOS = ['nome', 'cpf', 'whatsapp', 'email', 'pais', 'mt5Login', 'mt5Servidor'];

// estado da conexão com a corretora (passo 3)
//   'nenhum'     ainda não conectou nem adiou
//   'conectado'  clicou em "Conectar" (neste navegador, enquanto não há servidor)
//   'depois'     clicou em "Fazer depois": aguardando conexão
export const ESTADOS_DE_CONEXAO = ['nenhum', 'conectado', 'depois'];

function ler(deposito, chave) {
  try {
    const v = JSON.parse(deposito.getItem(chave) || 'null');
    return v && typeof v === 'object' ? v : null;
  } catch {
    return null;
  }
}
function escrever(deposito, chave, valor) {
  try {
    deposito.setItem(chave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}

/**
 * @returns {{
 *   nome: string, cpf: string, whatsapp: string, email: string, pais: string,
 *   mt5Login: string, mt5Servidor: string, mt5Senha: string,
 *   contaCriadaEm: number,            ms desde 1970; 0 quando não há conta criada
 *   aceites: object | null,           registro dos aceites (versão, hashes, data e hora de cada caixa, leitura)
 *   estadoConexao: 'nenhum' | 'conectado' | 'depois',
 *   conexaoEm: number,                ms; quando clicou em Conectar ou Fazer depois
 *   quando: number,                   última gravação
 * }}
 */
export function lerGuardado() {
  const base = ler(localStorage, CHAVE) || {};
  const senha = ler(sessionStorage, CHAVE_SENHA) || {};
  const saida = { quando: Number(base.quando) || 0 };
  for (const c of CAMPOS) saida[c] = typeof base[c] === 'string' ? base[c] : '';
  saida.mt5Senha = typeof senha.mt5Senha === 'string' ? senha.mt5Senha : '';
  saida.contaCriadaEm = Number(base.contaCriadaEm) || 0;
  saida.aceites = base.aceites && typeof base.aceites === 'object' ? base.aceites : null;
  saida.estadoConexao = ESTADOS_DE_CONEXAO.indexOf(base.estadoConexao) !== -1 ? base.estadoConexao : 'nenhum';
  saida.conexaoEm = Number(base.conexaoEm) || 0;
  return saida;
}

/** Guarda só o que vier em `parcial`; o resto fica como estava. Senhas de conta não entram. */
export function guardar(parcial) {
  const atual = lerGuardado();
  const base = { quando: Date.now() };
  for (const c of CAMPOS) base[c] = c in parcial ? String(parcial[c] || '') : atual[c];
  base.contaCriadaEm = 'contaCriadaEm' in parcial ? Number(parcial.contaCriadaEm) || 0 : atual.contaCriadaEm;
  base.aceites = 'aceites' in parcial ? (parcial.aceites && typeof parcial.aceites === 'object' ? parcial.aceites : null) : atual.aceites;
  base.estadoConexao = 'estadoConexao' in parcial && ESTADOS_DE_CONEXAO.indexOf(parcial.estadoConexao) !== -1 ? parcial.estadoConexao : atual.estadoConexao;
  base.conexaoEm = 'conexaoEm' in parcial ? Number(parcial.conexaoEm) || 0 : atual.conexaoEm;
  let ok = escrever(localStorage, CHAVE, base);
  if ('mt5Senha' in parcial) ok = escrever(sessionStorage, CHAVE_SENHA, { mt5Senha: String(parcial.mt5Senha || '') }) && ok;
  return ok;
}

export function limparGuardado() {
  try { localStorage.removeItem(CHAVE); } catch { /* sem depósito */ }
  try { sessionStorage.removeItem(CHAVE_SENHA); } catch { /* sem depósito */ }
}
