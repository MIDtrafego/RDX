// SÓ DA PÁGINA DE TESTE (menu.html). NÃO levar para o index.html.
// Liga o menu do jeito que o site vai ligar e anota tudo o que acontece, para os testes lerem.
import { iniciarMenu } from './menu.js';

const registro = {
  eventos: [],     // cada rdx:menu, com o estado do menu naquele instante
  navegou: [],     // cada chamada de aoNavegar
};

const elEvento = document.getElementById('mn-teste-evento');
const elEstado = document.getElementById('mn-teste-estado');
const elDestino = document.getElementById('mn-teste-destino');

let menu = null;

window.addEventListener('rdx:menu', (e) => {
  registro.eventos.push({
    aberto: e.detail.aberto,
    estado: menu ? menu.estado : 'fechado',
    visivel: document.getElementById('menu').classList.contains('mn-visivel'),
    t: Math.round(performance.now()),
  });
  if (elEvento) elEvento.textContent = 'aberto: ' + e.detail.aberto;
});

menu = iniciarMenu({
  botao: document.querySelector('.botao-menu'),
  aoNavegar(id) {
    registro.navegou.push({
      id,
      estado: menu.estado,
      aberto: menu.aberto,
      visivel: document.getElementById('menu').classList.contains('mn-visivel'),
      travado: document.documentElement.classList.contains('mn-travado'),
      t: Math.round(performance.now()),
    });
    if (elDestino) elDestino.textContent = id;
    // no site quem rola é o módulo das seções (Lenis). Aqui, a rolagem nativa.
    const alvo = document.getElementById(id);
    const calmo = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (alvo) alvo.scrollIntoView({ behavior: calmo ? 'auto' : 'smooth', block: 'start' });
  },
});

function lerEstado() {
  if (elEstado && elEstado.textContent !== menu.estado) elEstado.textContent = menu.estado;
  requestAnimationFrame(lerEstado);
}
requestAnimationFrame(lerEstado);

window.__mn = { menu, registro };
