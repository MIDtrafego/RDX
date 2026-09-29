// Comportamento dos campos: quando validar, como mostrar o erro, para onde vai o foco.
//
// Marcação esperada de cada campo:
//   <div class="ct-campo" data-ct-campo="email">
//     <label class="ct-rotulo" for="ct-email">E-mail</label>
//     <div class="ct-caixa"><input class="ct-entrada" id="ct-email" name="email" ...></div>
//     <p class="ct-erro" id="ct-email-erro" hidden></p>
//   </div>
//
// Quando validar:
//   • ao sair do campo, se a pessoa escreveu alguma coisa nele
//   • ao tentar avançar, todos os campos do passo
//   • enquanto digita, só se o campo já está marcado com erro (para o erro sumir na hora)
// Nunca no primeiro caractere.

export function ligarCampos(raiz, regras = {}) {
  const campos = new Map();

  raiz.querySelectorAll('[data-ct-campo]').forEach((caixa) => {
    const nome = caixa.dataset.ctCampo;
    const controle = caixa.querySelector('[data-ct-controle]') || caixa.querySelector('input, select, textarea');
    const erro = caixa.querySelector('.ct-erro');
    if (!controle || !erro) return;
    const campo = {
      nome,
      caixa,
      controle,
      erro,
      descricao: (controle.getAttribute('aria-describedby') || '').trim(),
      comErro: false,
    };
    campos.set(nome, campo);

    controle.addEventListener('blur', () => {
      if (campo.comErro || preenchido(controle) || pelaMetade(controle)) validar(nome);
    });
    const aoMudar = () => { if (campo.comErro) validar(nome); };
    controle.addEventListener('input', aoMudar);
    controle.addEventListener('change', aoMudar);

    // o rótulo reage: fica marcado enquanto o campo tem conteúdo
    const marcar = () => caixa.classList.toggle('ct-cheio', preenchido(controle));
    controle.addEventListener('input', marcar);
    controle.addEventListener('change', marcar);
    marcar();
  });

  function preenchido(controle) {
    if (controle.type === 'checkbox') return controle.checked;
    return String(controle.value || '').trim() !== '';
  }

  // data digitada pela metade: o campo devolve valor vazio, mas avisa que há entrada ruim
  function pelaMetade(controle) {
    return Boolean(controle.validity && controle.validity.badInput);
  }

  function valor(nome) {
    const campo = campos.get(nome);
    if (!campo) return '';
    if (campo.controle.type === 'checkbox') return campo.controle.checked;
    return campo.controle.value;
  }

  function mostrarErro(nome, mensagem) {
    const campo = campos.get(nome);
    if (!campo) return;
    const mudou = campo.erro.textContent !== mensagem;
    campo.comErro = true;
    campo.erro.textContent = mensagem;
    campo.erro.hidden = false;
    campo.caixa.classList.add('ct-com-erro');
    campo.controle.setAttribute('aria-invalid', 'true');
    campo.controle.setAttribute('aria-describedby', (campo.descricao + ' ' + campo.erro.id).trim());
    if (mudou) {
      // a animação de entrada recomeça quando o texto do erro troca
      campo.erro.classList.remove('ct-erro-entra');
      void campo.erro.offsetWidth;
      campo.erro.classList.add('ct-erro-entra');
    }
  }

  function limparErro(nome) {
    const campo = campos.get(nome);
    if (!campo || !campo.comErro) return;
    campo.comErro = false;
    campo.erro.hidden = true;
    campo.erro.textContent = '';
    campo.erro.classList.remove('ct-erro-entra');
    campo.caixa.classList.remove('ct-com-erro');
    campo.controle.removeAttribute('aria-invalid');
    if (campo.descricao) campo.controle.setAttribute('aria-describedby', campo.descricao);
    else campo.controle.removeAttribute('aria-describedby');
  }

  function validar(nome) {
    const regra = regras[nome];
    const campo = campos.get(nome);
    if (!regra || !campo) return true;
    const mensagem = regra(valor(nome), { valor, controle: campo.controle });
    if (mensagem) {
      mostrarErro(nome, mensagem);
      return false;
    }
    limparErro(nome);
    return true;
  }

  // Valida tudo e devolve os nomes dos campos errados, na ordem em que aparecem na tela.
  function validarTudo() {
    const errados = [];
    for (const nome of campos.keys()) {
      if (!validar(nome)) errados.push(nome);
    }
    return errados;
  }

  function focar(nome) {
    const campo = campos.get(nome);
    if (!campo) return;
    campo.controle.focus({ preventScroll: true });
    const movimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    campo.caixa.scrollIntoView({ block: 'center', behavior: movimento });
    campo.caixa.classList.remove('ct-treme');
    void campo.caixa.offsetWidth;
    campo.caixa.classList.add('ct-treme');
  }

  function limparTudo() {
    for (const nome of campos.keys()) limparErro(nome);
  }

  function atualizarMarcas() {
    for (const campo of campos.values()) campo.caixa.classList.toggle('ct-cheio', preenchido(campo.controle));
  }

  return { campos, valor, validar, validarTudo, mostrarErro, limparErro, limparTudo, focar, atualizarMarcas };
}

// ───────────── máscara com o cursor no lugar certo ─────────────
// Depois de reformatar, o cursor volta para depois do mesmo número de algarismos que
// tinha à esquerda. Sem isso, corrigir um número no meio joga o cursor para o fim.
export function ligarMascara(entrada, formatar) {
  const aplicar = () => {
    const antes = entrada.value;
    const pos = entrada.selectionStart == null ? antes.length : entrada.selectionStart;
    const numerosAntes = antes.slice(0, pos).replace(/\D+/g, '').length;
    const novo = formatar(antes);
    if (novo === antes) return;
    entrada.value = novo;
    let i = 0;
    let vistos = 0;
    while (i < novo.length && vistos < numerosAntes) {
      if (/\d/.test(novo[i])) vistos += 1;
      i += 1;
    }
    if (pos >= antes.length) i = novo.length;
    try { entrada.setSelectionRange(i, i); } catch (e) { /* tipo de campo sem seleção */ }
  };
  entrada.addEventListener('input', aplicar);
  return aplicar;
}

// ───────────── mostrar e ocultar a senha ─────────────
export function ligarOlho(botao) {
  const entrada = document.getElementById(botao.getAttribute('aria-controls'));
  if (!entrada) return () => {};
  const por = (visivel) => {
    entrada.type = visivel ? 'text' : 'password';
    botao.setAttribute('aria-pressed', visivel ? 'true' : 'false');
    botao.setAttribute('aria-label', visivel ? 'Ocultar senha' : 'Mostrar senha');
  };
  botao.addEventListener('click', () => por(entrada.type === 'password'));
  return () => por(false);
}

// ───────────── botão ocupado ─────────────
export function ocupar(botao, ocupado) {
  botao.classList.toggle('ct-ocupado', ocupado);
  if (ocupado) botao.setAttribute('aria-busy', 'true');
  else botao.removeAttribute('aria-busy');
}
