// SÓ DA PÁGINA DE TESTE (rolagem.html). NÃO levar para o index.html.
// Mostra como o hero de verdade pode ouvir a rolagem das seções:
//   window.addEventListener('rdx:rolagem', (e) => e.detail.progresso, e.detail.secao, e.detail.y,
//                                                 e.detail.tema, e.detail.temaBotoes)

const miolo = document.querySelector('.teste-hero-miolo');
const topo = document.querySelector('.teste-topo');
const elSecao = document.getElementById('teste-leitura-secao');
const elProgresso = document.getElementById('teste-leitura-progresso');

window.__rxEventos = { total: 0, ultimo: null, secoes: [] };

window.addEventListener('rdx:rolagem', (e) => {
  const d = e.detail;
  const registro = window.__rxEventos;
  registro.total += 1;
  registro.ultimo = d;
  if (registro.secoes[registro.secoes.length - 1] !== d.secao) registro.secoes.push(d.secao);

  if (elSecao) elSecao.textContent = d.secao;
  if (elProgresso) elProgresso.textContent = d.progresso.toFixed(3).replace('.', ',');
  if (topo) {
    topo.dataset.tema = d.tema || 'escuro';
    topo.dataset.temaBotoes = d.temaBotoes || 'escuro';
  }

  // o hero recua e apaga enquanto a primeira seção sobe por cima dele
  if (miolo) {
    const saida = Math.min(1, d.y / (window.innerHeight * 1.1));
    miolo.style.transform = 'translate3d(0,' + (-saida * 90).toFixed(1) + 'px,0) scale(' + (1 - saida * 0.08).toFixed(4) + ')';
    miolo.style.opacity = (1 - saida * 0.9).toFixed(3);
  }
});
