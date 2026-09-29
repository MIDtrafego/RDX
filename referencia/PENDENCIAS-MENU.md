# Pendências do menu em tela cheia

Arquivos do menu: `menu.html` (página de teste), `src/menu/menu.js`, `src/menu/menu.css`,
`src/menu/teste.js` e `src/menu/teste.css` (os dois últimos são só da página de teste).

Nada abaixo impede o encaixe. São decisões que ficaram para o dono.

## Decisões para o dono

1. **Social sem link.** O `@rdxtechnology` está como texto. Falta dizer qual é a rede
   (Instagram, X, YouTube) e o endereço. Não inventei endereço.
2. **Dois botões "Começar agora" na tela.** Com o menu aberto, o botão lima do cabeçalho
   continua visível por cima, e o menu tem o dele. Opções: deixar assim, ou o cabeçalho
   esconder o botão dele enquanto o menu está aberto (dá para ouvir o evento `rdx:menu`).
   O botão do cabeçalho hoje é um `<button>` sem destino; o do menu leva a `/cadastro.html`.
3. **Aviso de risco resumido.** O texto do rodapé do menu é o que veio no pedido, mais curto
   que o aviso integral de `referencia/conteudo.md`, que lá está marcado como obrigatório e
   sem encurtar. Confirmar se no menu vale o resumido.
4. **Faixa lima na abertura.** A cortina passa uma camada lima na frente do painel escuro.
   Por um instante (menos de 0,1 s por faixa) a logo branca fica sobre lima e perde leitura.
   Com o menu aberto o fundo é escuro e tudo fica legível. Se incomodar, dá para diminuir o
   avanço da camada lima em `ABRIR.lima`, no começo de `src/menu/menu.js`.
5. **"24h" e maiúsculas.** A linha "Infraestrutura em operação · 24h" ficou em caixa normal
   de propósito: em caixa alta viraria "24H".

## Decisões técnicas que eu tomei

1. **Botão "Fechar menu" dentro do painel.** Só aparece quando recebe foco pelo teclado.
   Existe porque o X do cabeçalho fica fora do diálogo: com `aria-modal`, o leitor de tela
   não enxerga o que está fora. Não é item de conteúdo.
2. **Foco ao abrir vai para o próprio painel**, não para o primeiro item. Assim nenhum item
   nasce destacado. O primeiro Tab cai em "Tecnologia".
3. **O Tab não chega ao cabeçalho com o menu aberto.** O cabeçalho continua clicável com o
   mouse. Pelo teclado, fecha com Esc ou com o "Fechar menu".
4. **Trava da rolagem.** `html.mn-travado` usa `overflow: hidden` só no `<html>`. Em
   computador com barra de rolagem clássica (Windows), a classe `mn-calha` guarda o lugar
   da barra para o cabeçalho não andar 15 px para o lado. Efeito colateral: enquanto o menu
   está aberto sobra uma faixa de 15 px à direita, no escuro da página, que o painel não
   cobre (o navegador não deixa pintar ali). Some se o site esconder a barra de rolagem,
   decisão de quem cuida da rolagem.
5. **Sem `aoNavegar`**, o menu faz `location.hash = id` depois de fechar, para o item não
   ficar morto.
6. **`data-lenis-prevent` no bloco do menu**, para o Lenis não capturar a roda do mouse em
   cima do painel quando ele precisa rolar por dentro.
7. **"Aberto" começa quando a cortina cobre a tela** (perto de 1,0 s). O texto termina de
   assentar depois. Quem fecha nesse intervalo recebe o fechamento normal.
8. **Régua.** `--mn-u: min(100vw / 108, 100vh / 62)` no computador, `min(100vw / 64, 100vh / 80)`
   no tablet em pé e `min(100vw / 39, 100vh / 68)` no celular. Navegação em 7 u (4,45 u no
   celular). Entrelinha 1,02 e não 0,81 como na referência: com menos que isso o acento de
   "Dúvidas" encosta no "C" de "Acesso" e a palavra lê como "Açesso".

## Não foi feito

1. **Item da seção atual marcado.** Dá para ouvir `rdx:rolagem` e marcar no menu a seção em
   que a pessoa está. Não fiz porque não foi pedido e depende do nome das seções no evento.
2. **Foco na seção depois de navegar.** Ao fechar, o foco volta para o botão de menu, como
   pedido. Para leitor de tela o ideal é quem recebe o `aoNavegar` levar o foco ao título da
   seção depois de rolar.

## Não foi testado

1. Aparelho de verdade. Tudo foi conferido em Chrome no computador, simulando as telas.
   Falta iPhone (Safari) e Android.
2. Safari e Firefox.
3. Leitor de tela (NVDA, VoiceOver). Os atributos estão no lugar, mas ninguém ouviu.
4. Convivência com o Lenis e com as seções reais. A página de teste usa rolagem nativa.
5. Fluidez com o hero 3D rodando atrás. O recorte é redesenhado a cada quadro; em máquina
   fraca, se engasgar, vale pausar o hero enquanto o menu abre (evento `rdx:menu`).
