// Regras de validação e máscaras das telas de conta.
// Só funções puras: recebem o valor, devolvem a resposta. Nada aqui toca na página,
// guarda dado ou fala com a rede.

export const soNumeros = (v) => String(v == null ? '' : v).replace(/\D+/g, '');

// ───────────── e-mail ─────────────
export function emailValido(v) {
  const e = String(v || '').trim();
  if (e.length > 254) return false;
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(e) && !/\.\./.test(e);
}

// ───────────── CPF ─────────────
export function mascaraCpf(v) {
  const n = soNumeros(v).slice(0, 11);
  let s = n.slice(0, 3);
  if (n.length > 3) s += '.' + n.slice(3, 6);
  if (n.length > 6) s += '.' + n.slice(6, 9);
  if (n.length > 9) s += '-' + n.slice(9, 11);
  return s;
}

// Confere os dois dígitos verificadores. Sequência repetida (111.111.111-11) passa na
// conta, mas não existe: é recusada antes.
export function cpfValido(v) {
  const n = soNumeros(v);
  if (n.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(n)) return false;
  const digito = (ate) => {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(n[i]) * (ate + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(n[9]) && digito(10) === Number(n[10]);
}

// ───────────── telefone ─────────────
// O preenchimento automático costuma trazer +55 na frente: sai antes da máscara.
export function numerosDoTelefoneBR(v) {
  let n = soNumeros(v);
  if (n.length > 11 && n.indexOf('55') === 0) n = n.slice(2);
  if (n.length > 11 && n[0] === '0') n = n.slice(1);
  return n.slice(0, 11);
}

export function mascaraTelefoneBR(v) {
  const n = numerosDoTelefoneBR(v);
  if (!n.length) return '';
  let s = '(' + n.slice(0, 2);
  if (n.length > 2) s += ') ';
  if (n.length <= 10) {
    s += n.slice(2, 6);
    if (n.length > 6) s += '-' + n.slice(6, 10);
  } else {
    s += n.slice(2, 7) + '-' + n.slice(7, 11);
  }
  return s;
}

export function telefoneValido(v, pais) {
  if (pais === 'BR') {
    const n = numerosDoTelefoneBR(v);
    if (n.length !== 10 && n.length !== 11) return false;
    if (Number(n.slice(0, 2)) < 11) return false;
    if (/^(\d)\1+$/.test(n.slice(2))) return false;
    if (n.length === 11 && n[2] !== '9') return false;
    return true;
  }
  const n = soNumeros(v);
  return n.length >= 7 && n.length <= 15;
}

// Fora do Brasil não há máscara: só tira o que não faz parte de um telefone.
export function limparTelefoneLivre(v) {
  return String(v || '').replace(/[^\d+()\-\s.]/g, '').slice(0, 24);
}

// ───────────── nascimento ─────────────
// Recebe AAAA-MM-DD (o valor de um input de data) e devolve a idade em anos completos.
// Devolve null quando a data não existe.
export function idade(dataISO, hoje = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dataISO || ''));
  if (!m) return null;
  const a = Number(m[1]);
  const mes = Number(m[2]);
  const d = Number(m[3]);
  const data = new Date(a, mes - 1, d);
  if (data.getFullYear() !== a || data.getMonth() !== mes - 1 || data.getDate() !== d) return null;
  let anos = hoje.getFullYear() - a;
  const fezAniversario = hoje.getMonth() > mes - 1 || (hoje.getMonth() === mes - 1 && hoje.getDate() >= d);
  if (!fezAniversario) anos -= 1;
  return anos;
}

// Última data de nascimento aceita: quem faz 18 anos hoje.
export function limiteDeNascimento(hoje = new Date()) {
  const dois = (x) => String(x).padStart(2, '0');
  const d = new Date(hoje.getFullYear() - 18, hoje.getMonth(), hoje.getDate());
  return d.getFullYear() + '-' + dois(d.getMonth() + 1) + '-' + dois(d.getDate());
}

// ───────────── senha ─────────────
export const SENHA_MINIMO = 8;
export const NIVEIS_DE_FORCA = ['', 'Muito fraca', 'Fraca', 'Média', 'Forte'];

// Quatro critérios, uma barra para cada um. Senha com menos de 8 caracteres não passa
// de "Muito fraca", porque nem é aceita.
export function forcaDaSenha(senha) {
  const s = String(senha || '');
  const criterios = {
    tamanho: s.length >= SENHA_MINIMO,
    maiuscula: /\p{Lu}/u.test(s),
    numero: /\d/.test(s),
    simbolo: /[^\p{L}\p{N}\s]/u.test(s),
  };
  let nivel = 0;
  if (s.length) {
    nivel = Object.values(criterios).filter(Boolean).length;
    if (!criterios.tamanho) nivel = 1;
    nivel = Math.max(1, nivel);
  }
  return { nivel, rotulo: NIVEIS_DE_FORCA[nivel], criterios };
}

// ───────────── documento ─────────────
export const ARQUIVO_MAXIMO = 10 * 1024 * 1024;

const ASSINATURAS = [
  { tipo: 'png', mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { tipo: 'jpg', mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { tipo: 'pdf', mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
];

export function tamanhoLegivel(bytes) {
  const n = Number(bytes) || 0;
  const br = (x, casas) => x.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return br(n / 1024, 0) + ' KB';
  return br(n / (1024 * 1024), 1) + ' MB';
}

// Confere o arquivo de verdade: o tamanho vem do próprio arquivo e o tipo vem dos
// primeiros bytes do conteúdo. Extensão e tipo declarado não contam, porque basta
// renomear um arquivo para enganar os dois. A leitura é local, nada é enviado.
export async function conferirArquivo(arquivo) {
  if (!arquivo || typeof arquivo.size !== 'number') return { ok: false, motivo: 'vazio' };
  if (arquivo.size === 0) return { ok: false, motivo: 'vazio' };
  if (arquivo.size > ARQUIVO_MAXIMO) return { ok: false, motivo: 'tamanho', tamanho: arquivo.size };

  let cabeca;
  try {
    cabeca = new Uint8Array(await arquivo.slice(0, 8).arrayBuffer());
  } catch (e) {
    return { ok: false, motivo: 'leitura' };
  }
  const achado = ASSINATURAS.find((a) => a.bytes.every((b, i) => cabeca[i] === b));
  if (!achado) return { ok: false, motivo: 'tipo' };
  return { ok: true, tipo: achado.tipo, mime: achado.mime, imagem: achado.tipo !== 'pdf', tamanho: arquivo.size };
}
