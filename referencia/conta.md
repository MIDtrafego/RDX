# Telas de conta (entrar e cadastro): conteúdo de referência

Regras de texto: português do Brasil, sem travessão, sem emoji.

## Texto jurídico (Termos de Uso e Aviso de Risco)

Desde 05/10/2026 o texto jurídico das telas de conta vem dos documentos do Pedro, em
`referencia/pedro-2026-10/`:

- `RDX_termos_de_uso.md` (Termos de Uso, Contrato de Prestação de Serviço de Infraestrutura de
  Execução e Termo de Ciência de Risco, versão 1.0, outubro de 2026, 16 cláusulas)
- `RDX_disclaimer_e_termo_de_risco.md` (Aviso de Risco e Disclaimer, versão 1.0, 11 seções)
- `LEIA-ME_ULTIMAS_ALTERACOES.md`, seção 3, com o contexto (entidade, modelo das 3 caixas, prova)

O texto antigo (10 cláusulas do site antigo, "vigência a partir de 18 de março de 2026") foi
substituído e não está mais em lugar nenhum do site.

### Onde o texto vive no site

- `src/conta/documentos.html`: fragmento HTML com os dois documentos, convertidos do markdown.
  É a ÚNICA cópia do texto no site. A janela do cadastro (`src/conta/termos.js`) e a página
  pública `termos.html` carregam esse arquivo por fetch.
- Ids para apontar: `#ct-doc-termos`, `#ct-doc-risco`, `#ct-clausula-1` a `#ct-clausula-16`
  (mais `#ct-clausula-15a` e `#ct-clausula-anexo-1`), `#ct-risco-1` a `#ct-risco-11`.
- Versão registrada no aceite: `VERSAO_DOS_TERMOS = '1.0-2026-10'` em `src/conta/api.js`.

### O que foi REMOVIDO na conversão (não vai para o público)

- A linha do subtítulo "pendente de validação por advogado (pontos ⚖️ no final)".
- O parágrafo inteiro "Nota de trabalho (apagar antes de publicar): ...".
- Todos os símbolos ⚖️ (marcavam pontos para o advogado: 4.7 (f), 4.7-A (b) e (d), 8.2, 10.2,
  12.4-A, títulos das cláusulas 13 e 15).
- A seção final "Pontos que precisam de advogado antes de publicar" inteira.
- O bloco "Aceite (3 caixas)" do fim do Aviso de Risco (as três caixas ficam no formulário do
  cadastro, passo 2).
- Travessões trocados por ponto, vírgula, dois-pontos ou parênteses, mantendo o sentido.

Todo o resto do texto jurídico foi mantido como está, sem resumo e sem reescrita.

### Lacunas deixadas pelo Pedro (entre colchetes no texto, para ele preencher)

- Cláusula 13.2: câmara arbitral "[sugestão: CAMARB ou CBMA]".
- Cláusula 14.2: foro "da comarca da sede da RDX [cidade/UF]".
- Cláusula 15.6: idioma que prevalece em tradução "[português/inglês]".

### Pendências de conteúdo

- Política de Privacidade: os Termos citam (11.2, 15.1, caixa 1) mas não há documento próprio.
  No cadastro, o link "Política de Privacidade" abre a cláusula 11 (dados e privacidade) até o
  Pedro mandar o documento.
- O Aviso de Risco diz que "deve ser exibido na landing, no cadastro e no painel". Hoje está no
  cadastro (janela), em `termos.html` e no rodapé de `comecar.html` (outro agente cuida das
  páginas públicas).
- A cláusula 16.2 prevê hash SHA-256 do texto, 2FA no aceite, HMAC e PDF por e-mail: tudo é do
  servidor (`src/conta/api.js`, `criarConta`). A tela manda `aceites` com as três caixas,
  `versao`, `leuTermos`, `leuRisco` e `tempoLeituraMs`.

## Entrar
- Marca no topo + assinatura "Infraestrutura Quantitativa"
- Título: Bem-vindo de volta
- Apoio: Acesse sua conta para continuar
- Campos: E-mail, Senha
- Link: Esqueci a senha
- Botão: Entrar na plataforma
- Rodapé: Não tem conta? Criar agora / Voltar ao site
- Erros: "Preencha e-mail e senha." e "E-mail ou senha incorretos."

## Cadastro, em 3 passos (Dados, Segurança, Verificação)

### Passo 1: Dados pessoais
- Nome, Sobrenome
- E-mail
- Telefone (máscara (99) 99999-9999 quando o país é Brasil)
- País (Brasil, Portugal, EUA)
- Como nos conheceu? (Indicação, Instagram, YouTube, Google, Outro)
- Botão: Continuar
- CPF e Nascimento saíram em 05/10/2026: o KYC fica para o painel, depois da conta criada
  (especificação do Pedro).

### Passo 2: Segurança da conta
- Crie sua senha (mínimo 8 caracteres), com medidor de força em 4 barras: Muito fraca, Fraca, Média, Forte
  (critérios: 8 ou mais caracteres, letra maiúscula, número, símbolo)
- Dica: Use letras, números e símbolos.
- Confirme a senha
- Aviso: Após criar a conta, você precisará verificar sua identidade (KYC) para ativar o acesso completo.
- Aviso de trava (some quando os documentos foram lidos): Leia os Termos de Uso e o Aviso de
  Risco até o fim para liberar o aceite. [Abrir os documentos]
- Três caixas de aceite (Termos, cláusula 16.1), que nascem desligadas e só ligam depois de a
  pessoa rolar os dois documentos até o fim dentro da janela:
  1. Li e aceito os Termos de Uso, o Aviso de Risco e a Política de Privacidade.
     (cada nome abre a janela no ponto certo: início dos Termos, Aviso de Risco, cláusula 11)
  2. Declaro que a conta conectada é de minha titularidade e que opero exclusivamente capital próprio.
  3. Aceito a arbitragem (cláusula 13.2) como forma exclusiva de solução de disputas, em caráter individual.
     (caixa em destaque separado, rótulo "Aceite separado, Lei 9.307/96, art. 4º, § 2º";
     "arbitragem" abre a cláusula 13)
- Botões: Voltar / Criar conta (desabilitado enquanto as três caixas não estiverem marcadas)

### Passo 3: Verificação de identidade
- Apoio: Para sua segurança, confirme sua identidade antes de ativar o acesso completo.
- Aviso: A conexão de corretoras é liberada apenas após aprovação do documento.
- Tipo de documento: CNH, Passaporte, RG
- Frente do documento e Verso do documento: PNG, JPG ou PDF, máximo 10 MB
- Botão: Enviar para análise
- Link: Fazer depois (acesso limitado)

### Conclusão
- Com documento: "Conta criada!" + "Documento enviado. Você receberá um e-mail quando a verificação
  for concluída." + estado "Documento em análise", prazo de até 24 horas úteis
- Sem documento: "Conta criada com acesso limitado. Complete a verificação para desbloquear todas as
  funcionalidades." + estado "Verificação pendente"
- Botão: Ir para o login

## Janela dos termos (cadastro)

- Título: Termos de Uso e Aviso de Risco
- Versão 1.0 · outubro de 2026
- Duas abas no cabeçalho: Termos de Uso / Aviso de Risco (rolam até o começo de cada documento;
  a bolinha enche quando o documento foi lido até o fim)
- O texto entra por fetch de `src/conta/documentos.html` na primeira abertura, com estado
  "Carregando os documentos" e, se falhar, aviso com "Tentar de novo" e link para `termos.html`
- Rodapé: "Role os dois documentos até o fim para liberar o aceite." + botão "Li e aceito os
  termos" (só liga com os dois documentos lidos; ao clicar marca as três caixas e fecha)
- Um documento conta como lido quando o fim dele ficou visível na área de rolagem

## Página pública `termos.html`

- Mesmo topo das telas de conta, fundo sem o canvas
- Navegação fixa: Termos de Uso (`#termos`) / Aviso de Risco (`#aviso-de-risco`) / Voltar ao site
- Mostra os dois documentos do mesmo fragmento; sem JavaScript, mostra um link direto para o
  fragmento

## Observações antigas que continuam valendo
- Enquanto não houver servidor de verdade por trás, nada do cadastro pode sair do navegador
  (`src/conta/api.js` devolve SEM_SERVIDOR).
