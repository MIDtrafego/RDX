/* RDX · abertura · liga a tela de carregamento antes do primeiro quadro. Vai embutido no <head>. */
(function (w, d) {
  var h = d.documentElement;
  var a = (w.__abertura = { estado: 'carregando', inicio: 0, socorro: 0 });
  var avisar = function (nome) {
    w.dispatchEvent(new CustomEvent(nome, { detail: { motivo: 'socorro' } }));
  };
  h.classList.add('ab-ligado', 'ab-travado');
  w.requestAnimationFrame(function () { a.inicio = w.performance.now(); });
  /* se o módulo da abertura não assumir em 8 s, ela sai sozinha */
  a.socorro = w.setTimeout(function () {
    a.estado = 'saindo';
    h.classList.add('ab-socorro');
    avisar('rdx:abertura-saindo');
    w.setTimeout(function () {
      h.classList.remove('ab-ligado', 'ab-travado', 'ab-socorro');
      a.estado = 'fim';
      avisar('rdx:abertura-fim');
    }, 450);
  }, 8000);
})(window, document);
