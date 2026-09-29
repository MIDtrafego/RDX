# Servidor 3D: pendências e decisões

Arquivos: `src/gl/servidor3d.js`, `servidor.html`, `src/gl/servidor3d-teste.js`,
`ferramentas/medir-servidor.py`, `img/servidor-relevo.png`.
Página de teste: http://localhost:5173/servidor.html

## Como funciona, em uma frase

A imagem do servidor é projetada sobre uma malha em grade (230 x 296 células de 4 px). Cada
vértice fica preso no raio da câmera que passa pelo pixel dele; o que muda é só a profundidade.
Por isso, de frente, o objeto é idêntico à imagem, e ao girar cada face anda como face de verdade.

## Pendências

- [ ] **Trocar no hero** (`src/main.js`). Não foi feito por mim, o arquivo não é meu. Passo a passo
      no relatório de entrega e resumido no fim deste arquivo.
- [ ] **O dono precisa ver girando**, no navegador dele, e dizer se o giro de 14° está na medida
      ou se quer menos. É uma constante (`LIMITE_GUINADA`, `LIMITE_ARFAGEM` em `servidor3d.js`).
- [ ] **Testar na placa de vídeo de verdade e no celular de verdade.** Os quadros por segundo
      foram medidos no Chrome sem janela, neste notebook. No celular a malha tem 136 mil
      triângulos e uma leitura de textura no vértice; se pesar, `opcoes.celula: 6` corta a malha
      para menos da metade.
- [ ] **Face de cima e laterais de trás não existem.** A malha só tem as três faces que a imagem
      mostra. Dentro do limite de giro elas nunca aparecem (conta no `medir-servidor.py`). Se um
      dia o giro precisar passar de 20°, é preciso modelar essas faces e inventar textura para elas.
- [ ] **Relevo da face esquerda é mínimo.** Só a barra de luz salta (9 px). Os módulos e os vãos
      escuros entre eles ficaram no plano da face: não dá para saber pela imagem o quanto cada
      um entra, e relevo errado estraga mais que relevo nenhum. Dá para marcar mais regiões no
      `medir-servidor.py` (seção 5), olhando `_faces-servidor.png`.
- [ ] **Alças da lateral direita e parafusos** não têm relevo próprio.
- [ ] **`img/servidor-relevo.png` tem 518 KB.** O peso vem do canal verde (máscara do metal, com o
      detalhe da imagem). Se peso virar assunto: salvar em WebP sem perda ou baixar o canal
      verde para meia resolução.
- [ ] **Se a imagem do servidor for trocada**, rodar de novo `preparar-assets.py`,
      `mapa-de-luz.py` e `medir-servidor.py`, nessa ordem, conferir os 7 cantos em
      `_conferir-servidor.png` (os cantos de dentro são marcados à mão em `CHUTE`) e colar o
      bloco `MEDIDAS` impresso no começo de `servidor3d.js`.

## Decisões que valem registro

- **Caixa reta não serve.** Ajustando uma caixa de ângulos retos + câmera aos 7 cantos, o erro
  fica em 15,4 px de média e 25,9 px no pior canto. A arte não é uma caixa perfeita em
  perspectiva. Solução: três planos que passam exatamente pelas arestas medidas (erro zero por
  construção) e o ajuste procura só a forma mais parecida com uma caixa.
- **A câmera da conta é a do site, não a da imagem.** A arte foi feita com lente longa (quase
  ortográfica). Reconstruída com a lente dela e trazida para a câmera do site, a caixa ficava
  achatada, com 159° entre as faces, quase um plano. Presa na câmera do site, as faces ficam a
  94° e o custo vai para as arestas do fundo, de 9% a 17% mais compridas que a da frente. Não se
  percebe girando.
- **A profundidade muda com o tamanho da janela** (`uK`). A câmera do site fica sempre a 1500 px,
  mas o servidor muda de escala, então a distância medida em unidades do objeto muda. Para a
  vista de frente continuar idêntica à imagem em qualquer janela, a profundidade é multiplicada
  por `k = (1500 / escala) / 2188,89`: 1,00 em 1440 x 900, 0,83 em 1920 x 1080, 1,45 em 390 x 844.
- **No celular o giro é menor** (9,6° e 5,5°), porque lá o gabinete fica mais fundo e a lateral
  escondida apareceria mais cedo.
- **A guinada gira em volta da aresta do meio do gabinete**, não do eixo y da tela. O gabinete é
  visto de baixo; girando em volta do y da tela ele parecia tombar de lado.
- **Brilho do metal e sombra das paredes são diferenças em relação à posição de frente.** Sem
  giro a conta dá zero, então a arte aprovada fica intacta.
- **As diferenças de pixel com as luzes ligadas são ruído das próprias luzes**, não de geometria:
  o pisca-pisca usa funções de sorteio, e uma diferença de coordenada na sétima casa muda o
  sorteio na beirada de um LED. Com as luzes paradas (`?forca=0`) a diferença máxima é 1 em 255.

## Troca no hero (resumo)

1. Importar `criarServidor3D` de `./gl/servidor3d.js`.
2. `const servidor3d = criarServidor3D(loader, comuns, { distancia: DISTANCIA });`
   `const servidor = servidor3d.objeto;`
3. Na entrada, trocar `servidor.material.uniforms.` por `servidor3d.uniforms.`.
4. No laço, tirar a rotação de `palcoServidor` e chamar `servidor3d.girar(...)` e
   `servidor3d.atualizar(dt)`.
