# Telas de conta: pendências e decisões para o dono

Telas: `entrar.html` e `cadastro.html`. Código em `src/conta/`. Escrito em 29/09/2026.

Estado: as duas telas funcionam do começo ao fim como interface. **Não existe servidor por trás.**
Nenhum dado digitado sai do navegador e nada é gravado. Quem for ligar a autenticação mexe em um
arquivo só: `src/conta/api.js` (o contrato está escrito no topo dele).

## 1. Precisa de decisão (Yuri / Pedro / advogado)

1. **Cláusula 5 dos termos contra a página de preço.** Os termos falam em "ciclos semanais" e
   "débito automático". A página de preço fala em fatura mensal, em USDT, com 5 dias para pagar.
   O texto jurídico entrou na íntegra, sem alteração. Uma das duas versões precisa ser corrigida
   antes de alguém aceitar esses termos de verdade.
2. **Cláusula 7 cita GDPR no título, mas o texto só trata da LGPD.** Mantido como está.
3. **"Esqueci a senha" não tem fluxo definido.** Não há tela nem texto para recuperar senha. Hoje o
   link só mostra "A recuperação de senha ainda não está conectada." Falta definir o fluxo (pedir
   o e-mail, mandar link, tela de senha nova) e criar a função correspondente em `api.js`.
4. **Quais campos são obrigatórios.** A referência não diz. Ficou assim: Nome, Sobrenome, E-mail,
   Telefone, Nascimento e País obrigatórios. CPF obrigatório só quando o país é Brasil. "Como nos
   conheceu?" opcional.
5. **CPF para quem é de fora.** Com Portugal ou EUA o campo CPF continua na tela, marcado como
   opcional. Se for preenchido, é conferido. Alternativa: esconder o campo para esses países, ou
   pedir outro documento (NIF, SSN). Decidir.
6. **Verso do documento no passaporte.** Passaporte não tem verso. Ficou opcional para passaporte e
   obrigatório para CNH e RG. Confirmar com quem vai analisar os documentos.
7. **Telefone fixo.** A máscara aceita celular, (99) 99999-9999, e também fixo com 10 números,
   (99) 9999-9999. Se só celular for aceito, é uma linha em `src/conta/validacao.js`.
8. **Senha forte obrigatória ou não.** A regra pedida é só o mínimo de 8 caracteres. O medidor
   informa a força, mas uma senha "Muito fraca" com 8 letras é aceita. Decidir se o cadastro deve
   exigir um nível mínimo.
9. **Prazo "até 24 horas úteis".** Aparece na conclusão (quando houver servidor). Confirmar se a
   operação consegue cumprir.

## 2. Decisões que tomei e podem ser revertidas

1. **Faixa "Demonstração · nenhum dado sai do seu navegador"** no alto do cartão, nas duas telas,
   desde o primeiro momento. O pedido era avisar no fim. Coloquei também no começo porque a pessoa
   digita CPF e escolhe foto de documento antes de chegar ao fim. A faixa some sozinha quando
   `CONECTADO` virar `true` em `api.js`.
2. **Conclusão em modo de demonstração não mostra "Conta criada!".** Mostra "Nenhuma conta foi
   criada" e três linhas: conta não criada, documento não enviado, dados apagados da página. Os
   textos da referência ("Conta criada!", "Documento em análise", "Verificação pendente") já estão
   prontos e aparecem quando o servidor confirmar. Foram testados com um servidor de mentira
   dentro do teste automatizado.
3. **Os dados são apagados dos campos ao chegar na conclusão** (senha, CPF, arquivos).
4. **Medidor de força.** Senha com menos de 8 caracteres nunca passa de "Muito fraca", mesmo com
   maiúscula, número e símbolo, porque ela nem é aceita. Com 8 ou mais, cada critério atendido
   acende uma barra.
5. **Botão de mostrar e ocultar a senha** (o olho dentro do campo). Não estava na referência.
6. **Marca no topo com a assinatura "Infraestrutura Quantitativa" ao lado.** A marca é a mesma
   logo do topo do site (`/img/rdx-logo.svg`, pelo `estilo.css`) e volta para `/`.
7. **"Voltar ao site" e "Já tenho acesso"** no rodapé do cartão do cadastro. "Já tenho acesso" é o
   texto do botão do hero e leva para `entrar.html`. A referência não listava link de volta para o
   login no cadastro.
8. **Os três links dos termos abrem a mesma janela em pontos diferentes:** Termos de Uso no começo,
   Aviso de Risco na cláusula 2, Política de Privacidade na cláusula 7.
9. **Ordem dos campos do passo 1 igual à da referência.** O País vem depois de CPF e Telefone, mas é
   ele que decide se o CPF é exigido e qual máscara o telefone usa. Sugestão: subir o País para
   antes do CPF.
10. **Escala apertada no computador** (pedido do dono). Título com 2% da largura da tela, frase da
    coluna da marca com 4%, campos com 15 ou 16 px, rótulos com 11 px. O cartão nunca passa da
    altura da tela: se um passo for mais alto que o espaço, ele rola por dentro do cartão e os
    botões ficam presos na base.
11. **No celular e no tablet a página rola.** O cadastro não cabe inteiro em 390×844 e o botão de
    avançar fica abaixo da dobra nos passos 1, 2 e 3. É o comportamento normal de formulário em
    celular. A regra de caber sem rolar foi aplicada ao computador.

## 3. Textos que escrevi (não estavam na referência)

Todos curtos, sem travessão e sem emoji. Revisar se quiser outro tom.

Avisos de demonstração
- Demonstração · nenhum dado sai do seu navegador
- O acesso ainda não está conectado. Nenhum dado saiu do seu navegador.
- A recuperação de senha ainda não está conectada.
- Ambiente de demonstração / Nenhuma conta foi criada / Este cadastro ainda não está conectado a um
  servidor. Nenhum dado saiu do seu navegador e nenhum documento foi enviado.
- Conta: Não criada / Documento: Não enviado / Dados digitados: Apagados desta página
- O envio de documento ainda não está conectado. Nenhum arquivo foi enviado.

Erros de campo
- Informe o nome. / Informe o sobrenome. / Informe o e-mail. / Informe o CPF. / Informe o telefone.
  / Informe a data de nascimento.
- E-mail inválido. Confira o endereço.
- CPF incompleto. São 11 números. / CPF inválido. Confira os números.
- Telefone inválido. Use DDD e número. / Telefone inválido. Confira os números.
- Data incompleta. Informe dia, mês e ano. / Data inválida. Confira dia, mês e ano.
- É preciso ter 18 anos ou mais para criar a conta.
- Crie uma senha. / A senha precisa de no mínimo 8 caracteres.
- Confirme a senha. / As senhas não são iguais.
- Marque esta caixa para continuar.
- Envie a frente do documento. / Envie o verso do documento.
- Arquivo não aceito. Envie PNG, JPG ou PDF. / Arquivo com 11,0 MB. O máximo é 10 MB. / Arquivo
  vazio. Escolha outro. / Não foi possível ler o arquivo. Tente de novo.

Erros que só aparecem com servidor
- Este e-mail já tem conta. / Este CPF já tem conta.
- Não foi possível entrar agora. Tente de novo em instantes.
- Não foi possível criar a conta agora. Tente de novo em instantes.
- Não foi possível enviar o documento agora. Tente de novo em instantes.

Outros
- Passo 1 de 3, Passo 2 de 3, Passo 3 de 3
- Arraste o arquivo ou clique para escolher / Trocar / Remover / opcional / Selecione
- Força da senha: (Muito fraca, Fraca, Média, Forte)
- Mostrar senha / Ocultar senha / Fechar
- Para entrar é preciso ativar o JavaScript do navegador. / Para criar a conta é preciso ativar o
  JavaScript do navegador.

## 4. Para quem for ligar o servidor

1. Abrir `src/conta/api.js`. É o único arquivo a mudar.
2. Trocar `CONECTADO` para `true`.
3. Escrever o corpo de `entrar(dados)`, `criarConta(dados)` e `enviarDocumento(arquivos)`. O formato
   de entrada, de saída e de erro de cada uma está no comentário em cima da função.
4. A validação do navegador não substitui a do servidor. Conferir tudo de novo lá: CPF, idade,
   tipo e tamanho do arquivo, aceite dos termos (com data e hora registradas pelo servidor).
5. Os formulários usam `method="dialog"` de propósito: fora de um `<dialog>` o envio nativo não faz
   nada, então nenhum dado sai da página mesmo se o JavaScript falhar. Não precisa trocar.
6. Hoje as páginas carregam as fontes do Google (fonts.googleapis.com e fonts.gstatic.com), como o
   resto do site. É o único pedido para fora. Se a política de privacidade pedir, dá para hospedar
   as fontes no próprio site.

## 5. Não foi feito ou não foi testado

- Não testado em aparelho de verdade (iPhone, Android) nem em Safari e Firefox. Os testes rodaram
  no Chrome do computador, nas larguras 390, 768, 1366, 1440, 1536 e 1920.
- Não testado com leitor de tela de verdade (NVDA, VoiceOver). Os atributos de acessibilidade
  foram conferidos por código.
- O botão Voltar do navegador sai da página em vez de voltar um passo. Não há aviso de "você vai
  perder o que digitou".
- A câmera do celular não é aberta direto no campo de documento (daria para pedir com `capture`).
- A logo do topo no celular fica com 83 px de largura porque a regra vem do `estilo.css` do site.
