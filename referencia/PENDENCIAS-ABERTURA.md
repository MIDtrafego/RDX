# Abertura: pendências e decisões para o dono

Página de teste: http://localhost:5173/abertura.html
Arquivos: `abertura.html` e `src/abertura/`. A logo vem do módulo compartilhado `src/marca.js`.

## Decisões que eu tomei e que você pode querer mudar

1. **Tempo mínimo subiu de 1,2 s para 1,5 s.** A escrita da logo leva 1,2 s e precisa caber inteira. Além do tempo mínimo, a abertura só sai depois que a logo terminou de ser escrita e o contador ficou 0,22 s parado no 100. No carregamento rápido (0,3 s) ela saiu entre 1,50 s e 1,55 s nos testes. Para mudar: `iniciarAbertura({ tempoMinimo: 1500, escrita: 1.2, pausaNoCem: 220 })`.

2. **A cortina tem duas folhas: lima na frente e verde `#4ade80` atrás.** O pedido era a cor lima saindo. Eu coloquei uma segunda folha verde, que aparece como uma faixa entre o lima e o hero e dá profundidade à curva. Se preferir uma cor só, como no site do Lando: `iniciarAbertura({ corFundo: null })`.

3. **No caso travado o contador para no último valor real.** Se o hero nunca avisar que ficou pronto, a abertura sai sozinha em 8 s com o número onde estava (61 no teste). Ele não pula para 100, porque 100 só aparece depois do `pronto()`.

4. **Linha de status ligada ao progresso, e não a um cronômetro.** De 0 a 33 "conectando ao cluster", de 34 a 66 "carregando o motor", de 67 a 99 "sincronizando o terminal", no 100 "motor pronto". Se o progresso ficar 2,2 s sem andar, aparece "aguardando resposta". Os textos são meus: troque em `iniciarAbertura({ frases: { etapas: [...], espera: '...', fim: '...' } })`.

5. **Linha fina de progresso no rodapé.** Não estava no pedido. Ela acompanha o mesmo número do contador. Para tirar, apague o `<span class="ab-linha">` do bloco HTML.

6. **Zero com ponto no meio.** É o desenho normal do zero na IBM Plex Mono. Mantive, porque os números do site usam a mesma fonte.

7. **Tamanho da logo:** 22% da largura da tela no computador (mínimo 240 px, máximo 460 px) e 56% até 768 px de largura. No tablet de 768 px isso dá 430 px. Se achar grande no tablet, mude o `@media` em `abertura-critico.css`.

8. **A saída dura 1,29 s no relógio, mas a tela fica limpa por volta de 1,0 s.** A curva `expo.inOut` tem um final muito longo e quase parado: nos últimos 20% só sobra um fiapo de cor nos cantos de cima. O evento `rdx:abertura-fim` e a liberação da rolagem acontecem em 1,29 s.

## O que depende de você

9. **Peso de cada etapa do carregamento.** No ensaio com o hero de verdade eu usei: 10% quando o `main.js` começa, até 50% com as 3 imagens do servidor, 70% quando o terminal 3D é montado, 100% quando as fontes do terminal carregam. Na rede local tudo isso acontece em menos de 1 s, então o número corre. Vale conferir numa rede lenta.

10. **Rolagem suave (Lenis).** Enquanto a abertura está na tela eu seguro roda do mouse, toque e teclas de rolagem, e a classe `ab-travado` no `<html>` tira a barra. Rolagem feita por código (`window.scrollTo`) continua funcionando: se alguma parte do site rolar a página sozinha durante a abertura, ela vai rolar. Hoje as seções só são montadas depois da entrada do hero, então não acontece.

11. **A barra de rolagem aparece quando a abertura termina.** No Windows ela ocupa uns 15 px e o conteúdo fixo encolhe nessa hora. Se incomodar, a saída é esconder a barra do site inteiro (decisão de quem cuida das seções).

12. **Se o módulo da abertura não carregar** (arquivo fora do ar, erro no `src/marca.js`, rede caída no meio), a tela fica lima, sem logo e sem contador, e sai sozinha em 8 s com um fade. Quem garante isso é o script embutido no `<head>`. Testado bloqueando o arquivo.

13. **Aba aberta em segundo plano.** O navegador não desenha quadros em aba escondida. O tempo máximo de 8 s continua valendo, mas a transição só anda quando a pessoa volta para a aba.

14. **A abertura aparece em toda visita.** Não há memória de "já viu". Se quiser mostrar só na primeira visita da sessão, é uma mudança pequena no script do `<head>`.

## Achado em arquivo que não é meu

15. **`src/marca.js`: um pontinho solto no X durante a escrita.** Na captura de 60% da escrita, em 1440 px, aparece um ponto preto de 1 ou 2 px perto do cruzamento do X, antes de o braço de baixo começar. Some em seguida e em 100% a logo está inteira e nítida. É do traço da máscara `M390 62 L456 126`. Não mexi, porque o arquivo não é meu.

## Não testado

- Celular e tablet de verdade. Os testes foram no Chrome do computador, em 390, 768, 1440 e 1920 px de largura, com toque simulado.
- Safari e Firefox.
- Rede lenta de verdade (só o caso de arquivo bloqueado).
