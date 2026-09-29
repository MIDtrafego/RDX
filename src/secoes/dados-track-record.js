// Dados do track record.
//
// O RESUMO abaixo é o que está em referencia/conteudo.md. Nada aqui foi redigitado de
// operação por operação: a curva diária e a lista de ordens ficam VAZIAS até o arquivo
// original (referencia/rdx_landing.html, objeto RDX_DATA) chegar.
//
// Quando chegar, há três jeitos de entregar o dado, em ordem de prioridade:
//   1. iniciarSecoes({ dados: RDX_DATA })
//   2. window.RDX_DATA definido antes de chamar iniciarSecoes()
//   3. preencher `curva` e `ordens` aqui embaixo
//
// Formato aceito (o leitor é tolerante com o nome das chaves, ver normalizar()):
//   curva:  [{ data: '2026-07-20', acumulado: 12.34 }, ...]   ou   [['2026-07-20', 12.34], ...]
//           se vier só o resultado do dia (resultado, pnl, profit, lucro), o acumulado é somado aqui
//   ordens: [{ ...qualquer conjunto de colunas... }]           as colunas da tabela saem das chaves

export const RESUMO = {
  periodo: { inicio: '2026-07-20', fim: '2026-09-03' },
  resultado: 276.6,
  // resultado de cada mês, como está no resumo. `fecha` é o último dia do mês dentro do período.
  mensal: [
    { mes: 'Jul', fecha: '2026-07-31', resultado: 26.45 },
    { mes: 'Ago', fecha: '2026-08-31', resultado: 126.7 },
    { mes: 'Set', fecha: '2026-09-03', resultado: 123.45 },
  ],
};

export const curva = [];
export const ordens = [];

const CHAVES_CURVA = ['curva', 'curve', 'equity', 'equityCurve', 'daily', 'diario', 'diaria', 'dias', 'days'];
const CHAVES_ORDENS = ['ordens', 'orders', 'trades', 'operacoes', 'deals', 'ops'];
const CHAVES_DATA = ['data', 'date', 'dia', 'day', 'd', 't', 'time'];
const CHAVES_ACUMULADO = ['acumulado', 'acum', 'cum', 'cumulative', 'equity', 'saldo', 'balance', 'total'];
const CHAVES_DIA = ['resultado', 'result', 'pnl', 'profit', 'lucro', 'valor', 'value', 'v'];

const achar = (objeto, chaves) => chaves.find((c) => objeto && objeto[c] !== undefined);

function paraData(bruto) {
  if (bruto instanceof Date) return bruto;
  if (typeof bruto === 'number') return new Date(bruto < 1e12 ? bruto * 1000 : bruto);
  const texto = String(bruto).trim();
  // dd/mm/aaaa ou dd/mm (o período é todo de 2026)
  const br = texto.match(/^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?/);
  if (br) {
    const ano = br[3] ? (br[3].length === 2 ? 2000 + Number(br[3]) : Number(br[3])) : 2026;
    return new Date(Date.UTC(ano, Number(br[2]) - 1, Number(br[1])));
  }
  const iso = texto.match(/^(\d{4})[-.](\d{1,2})[-.](\d{1,2})/);
  if (iso) return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
  const d = new Date(texto);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Devolve { curva: [{ data: Date, acumulado: number }], ordens: [objeto] } ou listas vazias.
export function normalizar(bruto) {
  const saida = { curva: [], ordens: [] };
  if (!bruto || typeof bruto !== 'object') return saida;

  const chaveCurva = achar(bruto, CHAVES_CURVA);
  const listaCurva = chaveCurva ? bruto[chaveCurva] : null;
  if (Array.isArray(listaCurva) && listaCurva.length) {
    let soma = 0;
    for (const item of listaCurva) {
      let data = null;
      let acumulado = null;
      if (Array.isArray(item)) {
        data = paraData(item[0]);
        acumulado = Number(item[1]);
      } else if (item && typeof item === 'object') {
        data = paraData(item[achar(item, CHAVES_DATA)]);
        const chaveAcum = achar(item, CHAVES_ACUMULADO);
        if (chaveAcum) acumulado = Number(item[chaveAcum]);
        else {
          const chaveDia = achar(item, CHAVES_DIA);
          if (chaveDia) { soma += Number(item[chaveDia]) || 0; acumulado = soma; }
        }
      }
      if (data && Number.isFinite(acumulado)) saida.curva.push({ data, acumulado });
    }
    saida.curva.sort((a, b) => a.data - b.data);
  }

  const chaveOrdens = achar(bruto, CHAVES_ORDENS);
  const listaOrdens = chaveOrdens ? bruto[chaveOrdens] : null;
  if (Array.isArray(listaOrdens)) {
    saida.ordens = listaOrdens.filter((o) => o && typeof o === 'object' && !Array.isArray(o));
  }
  return saida;
}
