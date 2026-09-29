# Site de referência (landonorris.com): o que foi medido

Medição feita com Playwright em 1440 x 900, rolagem constante de 208 px por segundo, vídeo fatiado
a 10 quadros por segundo. As folhas de quadros estão nesta pasta (`folha_1` a `folha_5`, em ordem de
rolagem). Os números brutos estão em `medidas.json`. OLHE as folhas antes de mexer em qualquer seção.

O dono do projeto pediu: "a animação tem que ser exatamente igual. Usar as mesmas grades, os mesmos
jeitos de animação. Só não coloca as fotos, as fotos a gente coloca depois." E reclamou da escala:
"está muito gigante, tem coisa sumindo da tela, não dá de ler direito. Tudo tem que dar de ler de
acordo com cada tela."

## 1. A régua (é a causa do "tudo gigante")

O site de referência prende TUDO à largura da tela. A fonte da raiz é `largura / 108`:
em 1440 px dá 13,33 px. Todo tamanho é múltiplo dessa unidade (chame de `u`).

| Papel | Tamanho em 1440 | Em `u` | Em % da largura | Peso / caixa | Entrelinha |
|---|---|---|---|---|---|
| Rótulo, legenda, data | 8,3 px | 0,625 u | 0,6% | 400, caixa alta | 1,0 |
| Texto de apoio pequeno | 12 px | 0,9 u | 0,8% | 600 a 700 | 1,25 |
| Texto corrido | 16,7 px | 1,25 u | 1,2% | 400 | 1,25 |
| Citação curta (serifada) | 20 a 26,7 px | 1,5 a 2 u | 1,4 a 1,9% | 400 | 1,0 |
| Título de seção | 60 a 62,5 px | 4,5 a 4,7 u | 4,2 a 4,3% | 700, caixa alta | 0,89 |
| Título de destaque | 93 a 97 px | 7 a 7,3 u | 6,5 a 6,8% | 700, caixa alta | 0,81 |
| Frase principal (manifesto) | 106 a 110 px | 7,9 a 8,25 u | 7,3 a 7,6% | 400 e 700, caixa alta | 0,83 a 0,90 |

Margem lateral da página: 17 px em 1440, ou seja 1,25 u.
Espaçamento entre letras nos títulos: negativo, de -0,06 u a -0,25 u.

Regras que saem disso:
- Nenhum título passa de 8,25 u. Nada de 9, 10, 12% da largura.
- O texto corrido é PEQUENO (1,25 u). O contraste de escala entre título e texto é o que dá o ar
  editorial. Texto de 17 px fixo ao lado de título gigante quebra isso.
- Como tudo é proporcional à largura, a composição é a mesma em qualquer monitor. Em tela baixa
  (notebook com 700 a 760 px de altura útil) a unidade precisa de um teto pela ALTURA também, senão
  o bloco não cabe: use `--u: min(100vw / 108, 100vh / 62)`.
- No celular a unidade não pode cair tanto: abaixo de 768 px de largura use uma régua própria
  (`100vw / 36`, por exemplo) e reduza os multiplicadores dos títulos.

## 2. As duas vozes tipográficas

Lá são duas fontes misturadas NA MESMA FRASE: uma sem serifa pesada (Mona Sans) e uma serifada de
título (Brier), esta sempre na cor de destaque (lima) e nas palavras-chave.
Exemplo do manifesto: "REDEFINING" (serifada, lima) "LIMITS, FIGHTING FOR" (sem serifa, branco)
"WINS" (serifada, lima).

No RDX as fontes da marca são IBM Plex Sans e IBM Plex Mono. O equivalente:
- voz 1: IBM Plex Sans 700, caixa alta, branco
- voz 2: IBM Plex Sans ITÁLICO 400 ou 300, caixa alta, lima (`#c8f52a`), nas palavras-chave
Se quiser uma serifada de verdade para a voz 2, proponha em PENDENCIAS, não troque por conta própria.

## 3. As seções, na ordem, com a grade de cada uma

Altura total 13.577 px (15 telas). Fundo escuro oliva na primeira metade, clareando até quase
branco na galeria, escuro de novo nos capacetes, claro no rodapé.

| # | Classe lá | Altura | O que é | Grade e animação |
|---|---|---|---|---|
| 1 | `home-hero` + `home-marquee` | 1 tela, presa | Hero que encolhe | JÁ FEITO em `src/saida-hero.js`. Não refazer |
| 2 | `s` (manifesto) | 1,14 tela | Um rótulo minúsculo com ícone em cima, e a frase principal CENTRALIZADA, 7 linhas, largura de 66% da tela | Cada linha é revelada por um bloco lima que atravessa e sai (ver `folha_2`, 5,9 s e 6,5 s): o bloco entra cobrindo a linha, o texto aparece atrás, o bloco sai. Rápido, em cascata |
| 3 | `is-horizontal-track` | 3,49 telas, presa | Galeria que anda de lado | Rolagem vertical vira deslocamento horizontal. Cartões de TAMANHOS DIFERENTES espalhados em alturas diferentes (pequeno 6% da largura, médio 14%, grande 20%), cada um com legenda minúscula em cima (0,625 u). Entre eles, citações curtas na serifada (1,5 u) com uma assinatura pequena. O fundo muda de cor ao longo do trilho. Cada cartão entra com um traço lima que passa (mesma ideia do bloco do manifesto) |
| 4 | `is-otot-home` + `is-otot-end` | 2 telas | "ON TRACK / OFF TRACK" | Duas palavras gigantes (7 u) empilhadas, alinhadas à direita do centro, com texto de apoio pequeno embaixo. Troca de estado entre as duas telas |
| 5 | `home-helmets` | 1,88 tela | Grade de capacetes | Título de seção (4,5 u) em duas linhas à esquerda, texto de apoio (1,25 u) na coluna da direita começando em 49,5% da largura. Grade de 4 colunas, colunas DESENCONTRADAS na vertical, cartões com borda fina e canto recortado, legenda embaixo à direita (nome + ano em lima) |
| 6 | `s` | 0,53 tela | Chamada curta | Uma frase na serifada (2 u), centralizada, com um botão |
| 7 | `is-lando-exe` | 1 tela | Destaque | Título de destaque (7 u) em duas linhas à esquerda (10% da largura de margem), texto de apoio embaixo, imagem grande à direita |
| 8 | `is-home-collabs` | 0,88 tela | Parceiros | Mesma cabeça da seção 5 (título à esquerda, apoio à direita), depois uma fileira de marcas |
| 9 | `is-callout-socials` | 1,07 tela | Redes | Título de seção centralizado em duas vozes, frase na serifada, cartões em leque |
| 10 | `is-footer` | 1,07 tela | Rodapé claro | Frase grande (5 u) em duas vozes, colunas de links com rótulo minúsculo, linha de direitos em 0,75 u |

## 4. Equivalência para o conteúdo do RDX (sem fotos)

| Seção de lá | No RDX | Conteúdo (de `referencia/conteudo.md`) |
|---|---|---|
| 2 manifesto | `problema` | "O mercado gera mais dados do que você consegue processar." como frase principal, centralizada |
| 3 trilho | `capacidades` | Os 4 cartões do problema + as 4 capacidades, em cartões de tamanhos diferentes. No lugar das fotos: cartão com fundo escuro, número grande em contorno e o ícone. Citações curtas entre eles: frases da faixa rolante |
| 4 on/off | `descansa` | "VOCÊ DESCANSA / OS SERVIDORES CALCULAM" |
| 5 capacetes | `cores` | Grade dos 5 Cores + "Próximo Core", 4 colunas desencontradas |
| 6 chamada | (nova, curta) | "Execução real. Sem maquiagem." + botão para o track record |
| 7 destaque | `track-record` | Números do período à esquerda, curva à direita |
| 8 parceiros | `acesso` | Adesão + Uso, e os 4 passos da cobrança |
| 9 redes | `faq` | FAQ + chamada final |
| 10 rodapé | `rodape` | Marca + aviso de risco integral |

Onde lá tem FOTO, aqui fica um espaço reservado com a MESMA proporção e posição, discreto (fundo
`#10160f`, borda fina, rótulo minúsculo "imagem"), para o dono trocar depois. Não invente imagem.

## 5. Transição de saída do hero (já implementada, só para contexto)

| Rolagem (em telas) | 0,25 | 0,39 | 0,53 | 0,67 | 0,81 | 0,95 |
|---|---|---|---|---|---|---|
| Largura do quadro | 0,90 | 0,77 | 0,60 | 0,45 | 0,37 | 0,33 |

Assinatura escrita entre 0,53 e 0,88 tela. O conjunto sobe com a página a partir de 1,05 tela.
Faixa de texto em duas linhas atrás do quadro.
