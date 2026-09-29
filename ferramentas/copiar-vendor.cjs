// Copia do node_modules para a pasta vendor só os arquivos de biblioteca que o site usa.
// O site é estático: o navegador carrega esses módulos direto, sem empacotador.
//
// Uso: npm install && npm run vendor
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const NM = path.join(RAIZ, 'node_modules');
const VENDOR = path.join(RAIZ, 'vendor');

function copiar(de, para) {
  fs.mkdirSync(path.dirname(para), { recursive: true });
  fs.copyFileSync(de, para);
  console.log('  ' + path.relative(RAIZ, para) + '  ' + Math.round(fs.statSync(para).size / 1024) + ' KB');
}

// three: o módulo principal e o núcleo que ele importa
for (const f of ['three.module.min.js', 'three.core.min.js']) {
  copiar(path.join(NM, 'three', 'build', f), path.join(VENDOR, 'three', f));
}

// gsap: os módulos ES (index.js importa os vizinhos por caminho relativo)
const gsapDir = path.join(NM, 'gsap');
for (const f of fs.readdirSync(gsapDir)) {
  if (f.endsWith('.js')) copiar(path.join(gsapDir, f), path.join(VENDOR, 'gsap', f));
}
const utils = path.join(gsapDir, 'utils');
if (fs.existsSync(utils)) {
  for (const f of fs.readdirSync(utils)) {
    if (f.endsWith('.js')) copiar(path.join(utils, f), path.join(VENDOR, 'gsap', 'utils', f));
  }
}

// lenis (rolagem suave das seções): o módulo ES, que não importa nada, e a folha de estilo dele
for (const f of ['lenis.mjs', 'lenis.css']) {
  copiar(path.join(NM, 'lenis', 'dist', f), path.join(VENDOR, 'lenis', f));
}

const v = (p) => JSON.parse(fs.readFileSync(path.join(NM, p, 'package.json'), 'utf8')).version;
fs.writeFileSync(
  path.join(VENDOR, 'versoes.json'),
  JSON.stringify({ three: v('three'), gsap: v('gsap'), lenis: v('lenis') }, null, 2),
);
console.log('  three ' + v('three') + ' · gsap ' + v('gsap') + ' · lenis ' + v('lenis'));
