// Campo de arquivo do passo 3: escolher, arrastar e soltar, conferir, trocar e remover.
//
// O arquivo fica só na memória desta página. Nada é enviado e nada é gravado. A miniatura
// usa um endereço temporário (URL.createObjectURL), liberado assim que deixa de ser usado.
import { conferirArquivo, tamanhoLegivel } from './validacao.js';
import { revelar } from './movimento.js';

const MENSAGENS = {
  tipo: () => 'Arquivo não aceito. Envie PNG, JPG ou PDF.',
  tamanho: (r) => 'Arquivo com ' + tamanhoLegivel(r.tamanho) + '. O máximo é 10 MB.',
  vazio: () => 'Arquivo vazio. Escolha outro.',
  leitura: () => 'Não foi possível ler o arquivo. Tente de novo.',
};

const NOMES_DE_TIPO = { png: 'PNG', jpg: 'JPG', pdf: 'PDF' };

export function ligarArquivo(caixa, { falta }) {
  const entrada = caixa.querySelector('input[type="file"]');
  const zona = caixa.querySelector('.ct-solta');
  const escolhido = caixa.querySelector('.ct-escolhido');
  const miniatura = caixa.querySelector('.ct-miniatura');
  const elNome = caixa.querySelector('.ct-escolhido-nome');
  const elTamanho = caixa.querySelector('.ct-escolhido-tamanho');
  const elErro = caixa.querySelector('.ct-erro');
  const elVoz = caixa.querySelector('.ct-arquivo-voz');
  const btTrocar = caixa.querySelector('[data-ct-trocar]');
  const btRemover = caixa.querySelector('[data-ct-remover]');
  const descricao = (entrada.getAttribute('aria-describedby') || '').trim();

  let arquivo = null;
  let endereco = null;
  let obrigatorio = true;
  let vez = 0;        // descarta a resposta de uma conferência antiga se outra começou depois

  function soltarEndereco() {
    if (endereco) URL.revokeObjectURL(endereco);
    endereco = null;
  }

  function mostrarErro(mensagem) {
    elErro.textContent = mensagem;
    elErro.hidden = false;
    elErro.classList.remove('ct-erro-entra');
    void elErro.offsetWidth;
    elErro.classList.add('ct-erro-entra');
    caixa.classList.add('ct-com-erro');
    entrada.setAttribute('aria-invalid', 'true');
    entrada.setAttribute('aria-describedby', (descricao + ' ' + elErro.id).trim());
  }

  function limparErro() {
    elErro.hidden = true;
    elErro.textContent = '';
    caixa.classList.remove('ct-com-erro');
    entrada.removeAttribute('aria-invalid');
    if (descricao) entrada.setAttribute('aria-describedby', descricao);
    else entrada.removeAttribute('aria-describedby');
  }

  function esvaziar() {
    vez += 1;
    arquivo = null;
    soltarEndereco();
    entrada.value = '';
    miniatura.textContent = '';
    elNome.textContent = '';
    elTamanho.textContent = '';
    escolhido.hidden = true;
    zona.dataset.ctEstado = 'vazio';
    entrada.tabIndex = 0;
  }

  function desenharMiniatura(resultado) {
    miniatura.textContent = '';
    soltarEndereco();
    if (resultado.imagem) {
      endereco = URL.createObjectURL(arquivo);
      const img = document.createElement('img');
      img.alt = '';
      img.decoding = 'async';
      img.addEventListener('error', () => {
        // imagem que o navegador não consegue abrir: fica só a sigla do tipo
        miniatura.textContent = NOMES_DE_TIPO[resultado.tipo];
        soltarEndereco();
      }, { once: true });
      img.src = endereco;
      miniatura.appendChild(img);
    } else {
      miniatura.textContent = NOMES_DE_TIPO[resultado.tipo];
    }
  }

  async function receber(novo) {
    if (!novo) return;
    const minha = ++vez;
    const resultado = await conferirArquivo(novo);
    if (minha !== vez) return;

    if (!resultado.ok) {
      const anterior = arquivo;
      entrada.value = '';
      if (!anterior) esvaziar();
      mostrarErro(MENSAGENS[resultado.motivo](resultado));
      elVoz.textContent = elErro.textContent;
      return;
    }

    arquivo = novo;
    limparErro();
    desenharMiniatura(resultado);
    elNome.textContent = novo.name;
    elTamanho.textContent = NOMES_DE_TIPO[resultado.tipo] + ' · ' + tamanhoLegivel(novo.size);
    escolhido.hidden = false;
    zona.dataset.ctEstado = 'cheio';
    entrada.tabIndex = -1;
    revelar(escolhido);
    elVoz.textContent = 'Arquivo escolhido: ' + novo.name + ', ' + tamanhoLegivel(novo.size) + '.';
  }

  entrada.addEventListener('change', () => {
    const novo = entrada.files && entrada.files[0];
    if (novo) receber(novo);
  });

  // arrastar e soltar
  let dentro = 0;
  const temArquivo = (e) => Boolean(e.dataTransfer) && Array.from(e.dataTransfer.types || []).indexOf('Files') !== -1;
  zona.addEventListener('dragenter', (e) => {
    if (!temArquivo(e)) return;
    e.preventDefault();
    dentro += 1;
    zona.classList.add('ct-solta-sobre');
  });
  zona.addEventListener('dragover', (e) => {
    if (!temArquivo(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  zona.addEventListener('dragleave', () => {
    dentro = Math.max(0, dentro - 1);
    if (!dentro) zona.classList.remove('ct-solta-sobre');
  });
  zona.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dentro = 0;
    zona.classList.remove('ct-solta-sobre');
    const novo = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (novo) receber(novo);
  });

  btTrocar.addEventListener('click', () => entrada.click());
  btRemover.addEventListener('click', () => {
    esvaziar();
    limparErro();
    elVoz.textContent = 'Arquivo removido.';
    entrada.focus({ preventScroll: true });
  });

  window.addEventListener('pagehide', soltarEndereco);

  return {
    caixa,
    arquivo: () => arquivo,
    exigir(sim) {
      obrigatorio = sim;
      caixa.classList.toggle('ct-opcional', !sim);
      if (!sim && !arquivo) limparErro();
    },
    validar() {
      if (arquivo) {
        limparErro();
        return true;
      }
      if (!obrigatorio) {
        limparErro();
        return true;
      }
      mostrarErro(falta);
      return false;
    },
    erro: mostrarErro,
    focar() {
      const alvo = arquivo ? btTrocar : entrada;
      alvo.focus({ preventScroll: true });
      const movimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
      caixa.scrollIntoView({ block: 'center', behavior: movimento });
    },
    limpar() {
      esvaziar();
      limparErro();
      elVoz.textContent = '';
    },
  };
}

// Arquivo solto fora das zonas faria o navegador sair da página para abrir o arquivo.
export function segurarSoltaFora() {
  const segurar = (e) => {
    if (e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('Files') !== -1) e.preventDefault();
  };
  window.addEventListener('dragover', segurar);
  window.addEventListener('drop', segurar);
}
