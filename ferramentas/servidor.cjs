// Servidor local de desenvolvimento, em Node puro (sem binário nativo).
// Serve a pasta do projeto e recarrega o navegador sozinho quando um arquivo muda.
// CSS troca sem recarregar a página.
//
// Uso: node ferramentas/servidor.cjs [--porta 5180]   (ou npm run dev)
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const RAIZ = path.resolve(__dirname, '..');
// porta: --porta N na linha de comando, ou a variável PORTA. 5180 de fábrica, porque a 5173
// é a que o Vite usa e outro projeto desta máquina costuma estar nela
const argPorta = process.argv.indexOf('--porta');
const PORTA = Number(argPorta !== -1 ? process.argv[argPorta + 1] : process.env.PORTA) || 5180;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glsl': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary',
  '.hdr': 'application/octet-stream',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.wasm': 'application/wasm',
};

const IGNORAR = /(^|[\\/])(node_modules|\.git|Assets|ferramentas|\.vite-dev\.log)([\\/]|$)/;

const CLIENTE = `
<script>
(() => {
  const es = new EventSource('/__recarregar');
  es.onmessage = (e) => {
    const arq = e.data;
    if (arq.endsWith('.css')) {
      document.querySelectorAll('link[rel=stylesheet]').forEach((l) => {
        const u = new URL(l.href);
        if (u.origin !== location.origin) return;
        u.searchParams.set('v', Date.now());
        l.href = u.href;
      });
      return;
    }
    location.reload();
  };
})();
</script>`;

const ouvintes = new Set();

function avisar(arquivo) {
  for (const res of ouvintes) res.write('data: ' + arquivo.replace(/\\/g, '/') + '\n\n');
}

let espera = null;
fs.watch(RAIZ, { recursive: true }, (_, arquivo) => {
  if (!arquivo || IGNORAR.test(arquivo)) return;
  clearTimeout(espera);
  espera = setTimeout(() => {
    console.log('  mudou: ' + arquivo);
    avisar(arquivo);
  }, 80);
});

const servidor = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let caminho = decodeURIComponent(url.pathname);

  if (caminho === '/__recarregar') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(': ok\n\n');
    ouvintes.add(res);
    req.on('close', () => ouvintes.delete(res));
    return;
  }

  if (caminho.endsWith('/')) caminho += 'index.html';
  const arquivo = path.join(RAIZ, caminho);
  if (!arquivo.startsWith(RAIZ)) {
    res.writeHead(403);
    return res.end('proibido');
  }

  // endereço limpo, como na Vercel (cleanUrls): /termos serve termos.html
  const candidato = !path.extname(arquivo) && fs.existsSync(arquivo + '.html') ? arquivo + '.html' : arquivo;

  fs.readFile(candidato, (erro, dados) => {
    if (erro) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('não encontrado: ' + caminho);
    }
    const arquivo = candidato;
    const ext = path.extname(arquivo).toLowerCase();
    const cab = { 'Content-Type': TIPOS[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' };
    if (ext === '.html') {
      const html = dados.toString('utf8').replace('</body>', CLIENTE + '\n</body>');
      res.writeHead(200, cab);
      return res.end(html);
    }
    res.writeHead(200, cab);
    res.end(dados);
  });
});

servidor.listen(PORTA, '0.0.0.0', () => {
  console.log('\n  RDX no ar');
  console.log('  neste computador:  http://localhost:' + PORTA + '/');
  for (const lista of Object.values(os.networkInterfaces())) {
    for (const r of lista || []) {
      if (r.family === 'IPv4' && !r.internal) console.log('  na rede (celular):  http://' + r.address + ':' + PORTA + '/');
    }
  }
  console.log('');
});
