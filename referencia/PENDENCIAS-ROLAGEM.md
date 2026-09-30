# Seções de rolagem: estado, medições e pendências

Atualizado em 29/09/2026. Arquivos desta parte: `rolagem.html`, `src/secoes/**`.

## 1. Estado

| Item | Situação |
|---|---|
| A. Nada cortado em tela nenhuma | FEITO e medido (seção 3) |
| B. Celular 390x844 | FEITO e medido (seções 3 e 6) |
| C. Composição das seções de baixo | FEITO (seção 7) |
| D. Movimento reduzido e sem JavaScript | FEITO e medido (seção 6) |

## 2. Régua adotada (item "está muito gigante")

Uma unidade só, `--u`, em `src/secoes/secoes.css`:
- 992 px ou mais: `min(100vw / 108, 100vh / 62)` (teto pela altura, para notebook baixo)
- 768 a 991 px: `100vw / 64`
- menos de 768 px: `100vw / 36`

Todo tamanho de fonte, margem e espaço é múltiplo de `--u`. Nenhum título passa de 8 u.

| Papel | Em `u` | 1280x600 | 1366x768 | 1440x900 | 1536x730 | 1920x1080 | Celular 390 |
|---|---|---|---|---|---|---|---|
| `--u` | 1 | 9,68 px | 12,39 px | 13,33 px | 11,77 px | 17,42 px | 10,83 px |
| Rótulo, legenda | 0,625 (piso 9 px) | 9 | 9 | 9 | 9 | 10,9 | 9,8 (0,9 u) |
| Texto de apoio | 0,95 (piso 12 px) | 12 | 12 | 12,7 | 12 | 16,5 | 12,5 (1,15 u) |
| Texto corrido | 1,25 (piso 13 px) | 13 | 15,5 | 16,7 | 14,7 | 21,8 | 15,2 (1,4 u) |
| Citação, subtítulo | 1,75 | 16,9 | 21,7 | 23,3 | 20,6 | 30,5 | 19,5 (1,8 u) |
| Título de seção | 4,6 | 44,5 | 57 | 61,3 | 54,2 | 80,1 | 31,4 (2,9 u) |
| Título de destaque | 7 (6 na seção "descansa") | 58,1 | 74,3 | 80 | 70,6 | 104,5 | 36,8 (3,4 u) |
| Frase do manifesto | 8 | 77,4 | 99,1 | 106,7 | 94,2 | 139,4 | 37,9 (3,5 u) |

Margem lateral 1,25 u. Curva padrão `cubic-bezier(.19, 1, .22, 1)`. Passagem do bloco 0,6 s.
Resposta de hover 0,2 s. Entrelinha dos títulos 0,886. Cantos de 3 px. Quebras em 991 e 767 px.

## 3. Medição "nada cortado" (item A)

Script: `scratchpad/pw/rolagem/cortes.cjs`. Percorre a página em passos de 30% da altura da tela
e, em cada passo, mede com `getBoundingClientRect()` todo texto visível dentro de `#secoes`:
1. fora das seções presas: inteiro dentro da largura da tela
2. nas seções presas (trilho e "descansa"): inteiro dentro da largura E da altura
3. texto do trilho: tem que aparecer inteiro em algum momento do percurso
4. texto cortado pelo próprio cartão (ancestral com `overflow` escondido)
5. dois textos irmãos um por cima do outro
6. `document.documentElement.scrollWidth <= innerWidth`

Ignorado de propósito: número decorativo em contorno dos cartões, fotos, recortes da revelação
por bloco, peças do trilho enquanto entram e saem pela lateral.

| Tela | Passos | Texto cortado | Rolagem lateral | Erro de console | 404 |
|---|---|---|---|---|---|
| 1280x600 | 64 | nenhum | não | 0 | 0 |
| 1366x768 | 63 | nenhum | não | 0 | 0 |
| 1440x900 | 59 | nenhum | não | 0 | 0 |
| 1536x730 | 63 | nenhum | não | 0 | 0 |
| 1920x1080 | 63 | nenhum | não | 0 | 0 |
| 390x844 | 57 | nenhum | não | 0 | 0 |
| Página principal 1366x768 | 66 | nenhum | não | 0 | 0 |
| Página principal 390x844 | 60 | nenhum | não | 0 | 0 |

Também medido em 768x1024 (tablet): nenhum corte.

O que o script achou e foi corrigido no caminho:
- bloco de revelação parado em cima do texto (o deslocamento inicial estava no CSS e o GSAP somava)
- linha do título quebrando de novo dentro do recorte ("MAIS DADOS" e "DO QUE" em linhas separadas)
- última peça do trilho nunca aparecia inteira (faltava folga no fim da pista)
- número "+US$ 11,53" estourando a coluna no tablet
- "Commodities" por cima de "matérias-primas" no celular

## 4. Pendências para o dono decidir

1. **Destino dos botões.** "Acessar a infraestrutura" e "Já tenho acesso" não têm endereço.
   Hoje avisam por evento (`rdx:acao`, com `cadastro` ou `login`) e não saem da página.
   Para ligar: `iniciarSecoes({ links: { cadastro: '/...', login: '/...' } })`.
2. **Curva do track record.** O arquivo `referencia/rdx_landing.html` (objeto `RDX_DATA`) não
   está na pasta. A curva mostra só o fechamento de cada mês, que é a soma dos três resultados
   mensais do resumo (0 / +26,45 / +153,15 / +276,60). Não há valor inventado nem redigitado.
   A lista de ordens está no estado vazio. Quando o arquivo chegar:
   `iniciarSecoes({ dados: RDX_DATA })` ou `window.RDX_DATA` antes da chamada. O leitor aceita
   vários nomes de chave, mas o formato real precisa ser conferido (`dados-track-record.js`).
3. **Segunda voz tipográfica.** Usei IBM Plex Sans itálico peso 300 em lima nas palavras-chave.
   A referência usa uma serifada. Se quiserem serifada de verdade, é decisão de marca.
   O peso 300 itálico não vem na folha de fontes do `index.html`: o `secoes.css` carrega
   sozinho, por `@import`. Melhor seria acrescentar `1,300` no `<link>` de fontes do `index.html`.
4. **Frase da chamada final.** Usei "Quando o mercado abre, a infraestrutura já está em
   operação." (vem do texto do cartão "Cluster De Alta Disponibilidade"). Não há frase de
   fechamento no `conteudo.md`.
5. **Texto do botão da chamada curta.** Usei o rótulo "Track Record", que é o que existe no
   conteúdo. Se quiserem outro texto, precisa vir do dono.
6. **Citações do trilho.** São três frases da antiga faixa rolante: "Decisões baseadas em
   cálculo, não em emoção", "Seus servidores nunca param", "Seu capital fica na sua corretora".
   A assinatura embaixo é "RDX Technology · Infraestrutura Quantitativa".
7. **Cores 03 e 04** aparecem com o resultado que tiveram (25,0% e -9,30 USD; 40,0%). Na mesma
   ordem do registro, sem destaque nem esconderijo.
8. **Itens que ficaram de fora do conteúdo** ("3.2ms de latência", "99.8% de uptime" e os
   outros cinco da lista do `conteudo.md`) não aparecem em nenhuma seção. Atenção: o cartão
   de status do hero no `index.html` mostra "3.2ms", que é um desses números sem fonte.

## 5. Limites conhecidos

- A seção "descansa" só trava se o conteúdo couber na altura da tela. Se não couber (celular
  muito baixo), ela vira seção comum, com a mesma revelação por bloco, sem travar.
- Abaixo de 992 px o trilho é rolagem horizontal nativa com encaixe. A troca de cor do fundo
  ao longo do trilho só existe no modo travado (992 px ou mais).
- Com movimento reduzido o FAQ abre e fecha sem animação e começa com a primeira pergunta
  aberta. Sem JavaScript todas as respostas ficam abertas.
- Quadros por segundo foram medidos no Chrome sem janela, neste computador. Celular de verdade
  não foi medido.

## 6. Outras medições (com as fotos já no lugar)

| Teste | 1366x768 | 1920x1080 | 390x844 |
|---|---|---|---|
| Pulo do topo ao fim: texto invisível | 0 | 0 | 0 |
| Pulo do topo ao fim: contador fora do valor final | 0 | 0 | 0 |
| Movimento reduzido: texto invisível, pins | 0, nenhum pin | 0, nenhum pin | 0, nenhum pin |
| Sem JavaScript: texto invisível, FAQ | 0, 5 respostas abertas | 0, 5 abertas | 0, 5 abertas |
| Rolagem lateral da página | não | não | não |
| Travessão ou emoji no HTML | 0 | 0 | 0 |

Antes das fotos chegarem o pulo, o movimento reduzido e o sem JavaScript também passaram em
1280x600, 1440x900 e 1536x730. Não foram repetidos nessas três depois das fotos.

Celular: trilho sem trava, `overflow-x: auto` com encaixe, pista de 3.274 px dentro de 390 px,
última peça alcançável, página sem rolagem lateral. Cursor próprio não é criado em toque.

Interações no computador (1440x900): luz e inclinação no cartão do Core, sigla enche de cor,
cursor próprio com rótulo "Abrir" no FAQ, acordeão anima a altura (0 a 71 px em 0,4 s) e abre
por teclado, botões da chamada final avisam `rdx:acao` sem mover a página, link do rodapé rola
até a seção. Botão magnético: na primeira medição não se moveu, porque a animação de entrada do botão derrubava a do ímã (as duas usavam o mesmo deslocamento). Corrigido em `nucleo.js` e medido de novo: o botão desloca 27 px e 6 px com o mouse em cima e volta a zero quando o mouse sai.

Quadros por segundo, página inteira percorrida em 16 s (Chrome sem janela, tela de 165 Hz):

| Tela | Média | 95% dos quadros até | Pior quadro | Quadros acima de 50 ms |
|---|---|---|---|---|
| 1280x600 | 124 | 17,6 ms | 109 ms | 8 de 2.005 |
| 1366x768 | 124 | 14,9 ms | 103 ms | 6 de 2.010 |
| 1920x1080 | 119 | 17,9 ms | 111 ms | 5 de 1.926 |
| 390x844, processador 4x mais lento, 20 s | 97 | 24,3 ms | 109 ms | 26 de 1.939 |

Os quadros longos acontecem quando uma seção entra e o texto é quebrado em linhas para a
revelação por bloco. Medido antes das fotos chegarem; não foi repetido depois.

## 7. Composição das seções de baixo (item C)

| Seção | Como ficou |
|---|---|
| `track-record` | Chamada curta centralizada (frase + botão), depois o número do período em tamanho de destaque à esquerda com o texto de apoio à direita, e a janela: taxa, ordens e média em grade 1 / 2 / 1, números e barras à esquerda, curva grande à direita |
| `acesso` | Cabeça padrão (título à esquerda, apoio começando em 49,5% da largura), dois cartões de preço, três garantias, quatro passos ligados pela linha que se desenha, fórmula e exemplo |
| `faq` | Título centralizado em duas vozes, atendimento embaixo, lista numa coluna central de 64 u, chamada final em painel lima |
| `rodape` | Assinatura, colunas de links com rótulo minúsculo, logo oficial (`/img/rdx-logo.svg`) subindo de dentro do recorte, aviso de risco integral |

Diferença assumida em relação à referência: o rodapé de lá é claro, o daqui é escuro.
