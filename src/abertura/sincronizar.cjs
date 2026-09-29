// Embute a abertura numa página: o CSS crítico, o script do <head> e o bloco HTML,
// sempre a partir dos arquivos desta pasta, para a cópia embutida nunca ficar diferente.
//
// A página precisa ter os três pares de marcadores:
//   <!-- ab:critico:inicio --> ... <!-- ab:critico:fim -->     (no <head>)
//   <!-- ab:cabeca:inicio -->  ... <!-- ab:cabeca:fim -->      (no <head>, depois do crítico)
//   <!-- ab:bloco:inicio -->   ... <!-- ab:bloco:fim -->       (logo depois do <body>)
//
// Uso:
//   node src/abertura/sincronizar.cjs                      grava em abertura.html
//   node src/abertura/sincronizar.cjs index.html           grava em outra página
//   node src/abertura/sincronizar.cjs --conferir [pagina]  só confere, não grava
const fs = require('fs');
const path = require('path');

const AQUI = __dirname;
const RAIZ = path.resolve(AQUI, '..', '..');
const args = process.argv.slice(2);
const soConferir = args.includes('--conferir');
const pagina = path.resolve(RAIZ, args.filter((a) => a !== '--conferir')[0] || 'abertura.html');

const ler = (nome) => fs.readFileSync(path.join(AQUI, nome), 'utf8').replace(/\r\n/g, '\n').trim();

const PARTES = {
  critico: '<style id="ab-critico">\n' + ler('abertura-critico.css') + '\n</style>',
  cabeca: '<script>\n' + ler('abertura-cabeca.js') + '\n</script>',
  bloco: ler('abertura-bloco.html'),
};

let html = fs.readFileSync(pagina, 'utf8').replace(/\r\n/g, '\n');
const diferentes = [];

for (const [nome, conteudo] of Object.entries(PARTES)) {
  const abre = '<!-- ab:' + nome + ':inicio -->';
  const fecha = '<!-- ab:' + nome + ':fim -->';
  const a = html.indexOf(abre);
  const b = html.indexOf(fecha);
  if (a === -1 || b === -1 || b < a) {
    console.error('faltam os marcadores de "' + nome + '" em ' + path.basename(pagina));
    process.exit(1);
  }
  const atual = html.slice(a + abre.length, b).trim();
  if (atual !== conteudo) diferentes.push(nome);
  html = html.slice(0, a + abre.length) + '\n' + conteudo + '\n' + html.slice(b);
}

if (soConferir) {
  if (diferentes.length) {
    console.log('DIFERENTE em ' + path.basename(pagina) + ': ' + diferentes.join(', '));
    process.exit(2);
  }
  console.log('igual: ' + path.basename(pagina) + ' está com a mesma abertura dos arquivos');
} else {
  fs.writeFileSync(pagina, html, 'utf8');
  console.log('gravado em ' + path.basename(pagina) + (diferentes.length ? ' (mudou: ' + diferentes.join(', ') + ')' : ' (nada mudou)'));
}
