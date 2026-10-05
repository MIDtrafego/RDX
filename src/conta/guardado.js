// O que a pessoa digita na página "Comece hoje" (comecar.html) fica guardado para o
// cadastro (cadastro.html, campos pré-preenchidos) e para a conferência final do MT5.
//
// HOJE NÃO HÁ SERVIDOR. Enquanto isso, o dado fica neste navegador:
//   • localStorage para nome, WhatsApp, e-mail, login e servidor do MT5
//   • sessionStorage para a senha de negociação: some quando o navegador fecha
//
// Quando o servidor existir, estas três funções passam a falar com src/conta/api.js
// e nada mais precisa mudar nas páginas.

const CHAVE = 'rdx.comecar';
const CHAVE_SENHA = 'rdx.comecar.senha';
const CAMPOS = ['nome', 'whatsapp', 'email', 'mt5Login', 'mt5Servidor'];

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

/** @returns {{ nome: string, whatsapp: string, email: string, mt5Login: string, mt5Servidor: string, mt5Senha: string, quando: number }} */
export function lerGuardado() {
  const base = ler(localStorage, CHAVE) || {};
  const senha = ler(sessionStorage, CHAVE_SENHA) || {};
  const saida = { quando: Number(base.quando) || 0 };
  for (const c of CAMPOS) saida[c] = typeof base[c] === 'string' ? base[c] : '';
  saida.mt5Senha = typeof senha.mt5Senha === 'string' ? senha.mt5Senha : '';
  return saida;
}

/** Guarda só o que vier em `parcial`; o resto fica como estava. */
export function guardar(parcial) {
  const atual = lerGuardado();
  const base = { quando: Date.now() };
  for (const c of CAMPOS) base[c] = c in parcial ? String(parcial[c] || '') : atual[c];
  let ok = escrever(localStorage, CHAVE, base);
  if ('mt5Senha' in parcial) ok = escrever(sessionStorage, CHAVE_SENHA, { mt5Senha: String(parcial.mt5Senha || '') }) && ok;
  return ok;
}

export function limparGuardado() {
  try { localStorage.removeItem(CHAVE); } catch { /* sem depósito */ }
  try { sessionStorage.removeItem(CHAVE_SENHA); } catch { /* sem depósito */ }
}
