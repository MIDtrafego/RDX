// Cache do site (service worker).
//
// Na primeira visita, enquanto a abertura roda, ele guarda os arquivos pesados (bibliotecas,
// imagens, fontes). Nas visitas seguintes tudo isso vem do disco, sem rede, e a página abre
// na hora. Cada arquivo guardado é conferido em segundo plano: se mudou no servidor, a cópia
// nova entra no cache e aparece na visita seguinte.
//
// Quando algum arquivo do site mudar de verdade, suba o número da VERSAO: o cache antigo é
// apagado e tudo é baixado de novo.
const VERSAO = 'rdx-v2';

// o que baixar já na instalação (o resto entra conforme é usado)
const PRECARREGAR = [
  '/',
  '/rolagem.html',
  '/src/main.js',
  '/src/estilo.css',
  '/src/saida-hero.js',
  '/src/marca.js',
  '/src/marca-dados.js',
  '/src/gl/fluido.js',
  '/src/gl/cenario.js',
  '/src/gl/servidor3d.js',
  '/src/gl/mercado.js',
  '/src/gl/terminal/terminal.js',
  '/src/gl/terminal/composicao.js',
  '/src/gl/terminal/shaders.js',
  '/src/gl/terminal/pecas.js',
  '/src/gl/terminal/desenhos.js',
  '/src/secoes/secoes.css',
  '/src/secoes/secoes.js',
  '/src/menu/menu.css',
  '/src/menu/menu.js',
  '/src/abertura/abertura.css',
  '/src/abertura/abertura.js',
  '/vendor/three/three.module.min.js',
  '/vendor/three/three.core.min.js',
  '/vendor/gsap/index.js',
  '/vendor/gsap/gsap-core.js',
  '/vendor/gsap/CSSPlugin.js',
  '/vendor/gsap/ScrollTrigger.js',
  '/vendor/gsap/SplitText.js',
  '/vendor/lenis/lenis.mjs',
  '/vendor/lenis/lenis.css',
  '/img/servidor.webp',
  '/img/servidor-luz.png',
  '/img/servidor-brilho.webp',
  '/img/servidor-relevo.png',
  '/img/rdx-logo.svg',
];

// no servidor local de desenvolvimento o cache atrapalha (mostraria arquivo velho): fica desligado
const LOCAL = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

self.addEventListener('install', (e) => {
  if (LOCAL) { self.skipWaiting(); return; }
  e.waitUntil(
    caches.open(VERSAO)
      // um arquivo que falhar não pode derrubar a instalação inteira
      .then((cache) => Promise.allSettled(PRECARREGAR.map((u) => cache.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

function guardavel(url) {
  if (url.origin === self.location.origin) {
    // só o que é estático. nada de páginas de teste nem do canal de recarga local
    if (url.pathname === '/__recarregar') return false;
    return /^\/(vendor|img|src)\//.test(url.pathname) || url.pathname === '/' || url.pathname.endsWith('.html');
  }
  return url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
}

self.addEventListener('fetch', (e) => {
  if (LOCAL) return;
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!guardavel(url)) return;

  const ehPagina = req.mode === 'navigate' || url.pathname.endsWith('.html');

  e.respondWith(caches.open(VERSAO).then(async (cache) => {
    const guardado = await cache.match(req, { ignoreSearch: url.origin === self.location.origin && !ehPagina });
    const buscar = fetch(req).then((resp) => {
      if (resp && (resp.ok || resp.type === 'opaque')) cache.put(req, resp.clone());
      return resp;
    });

    if (ehPagina) {
      // página: rede primeiro, para uma atualização aparecer logo; sem rede, a cópia guardada
      return buscar.catch(() => guardado || Response.error());
    }
    // arquivo estático: responde do cache na hora e atualiza a cópia por trás
    if (guardado) {
      buscar.catch(() => {});
      return guardado;
    }
    return buscar;
  }));
});
