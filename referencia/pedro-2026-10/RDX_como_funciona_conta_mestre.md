# RDX Technology — como funciona com conta mestre + copiador

Explicação simples, do começo ao fim, partindo do que já está pronto hoje.

---

## A ideia em uma frase

**O robô roda numa conta só (a nossa). Um serviço na nuvem copia cada ordem dessa conta para a conta de cada cliente, na corretora dele, no tamanho certo pro dinheiro dele. Cada cópia consome MCP, e o cliente paga o MCP que usou no fechamento do ciclo.**

Nada de VPS por cliente. Nada de dinheiro do cliente na nossa mão.

---

## Quem é quem

| Peça | O que é | Já temos? |
|---|---|---|
| **Conta mestre** | Uma conta MT5 da RDX, com capital da empresa. Os Cores rodam SÓ aqui. | Sim (a conta XM 430416653 pode virar a mestre) |
| **Cores** | Os robôs. Continuam iguais. Só que instalados num lugar só. | Sim |
| **Copiador** | Serviço na nuvem (MetaApi CopyFactory) que fica ligado na conta mestre e nas contas dos clientes e repete as ordens. | Não — é contratado, não desenvolvido |
| **Conta do cliente** | Conta MT5 dele, na corretora dele (XM, Exness, qualquer). Dinheiro dele, no nome dele. | Sim (o painel já conecta) |
| **Backend RDX** | Nosso servidor: cadastro, contador de MCP, faturas, pagamentos em USDT, e quem pode ou não receber cópia. | Não — é o trabalho do Danilo |
| **Control Center** | O painel que o cliente vê. | Sim, pronto |
| **Landing** | Site de entrada. | Sim, pronta |

---

## O caminho do cliente, passo a passo

### 1. Ele se cadastra
E-mail, senha, 2FA. Igual está no painel.

### 2. Ele não paga nada pra entrar
A ativação é de **US$ 49, uma vez**, e só entra na **primeira fatura**, depois de 30 dias com a conta operando. Quem conecta e não opera não paga. Fica registrado no Extrato como "Ativação".

### 3. Ele não compra nada além disso
O MCP é **pós-pago**: ele usa primeiro e paga no fechamento do ciclo só o que consumiu. O dinheiro que ele vai operar não passa por nós — fica na corretora dele.

### 4. Ele conecta a conta MT5 dele
No painel: corretora, login, servidor, senha de negociação (trade-only, sem saque). O backend manda isso pro copiador, que passa a "enxergar" a conta dele.

Regra: **capital mínimo de US$ 100 na corretora.** Até US$ 10.000 o cliente usa conta **Cent** (Exness Standard Cent, XM Micro, RoboForex ProCent), que permite lotes 100× menores — assim a conta pequena roda todos os Cores na mesma proporção da grande. Acima de 10k, conta Padrão. Abaixo do mínimo a conta fica "aguardando depósito", desligada no MetaApi (custa centavos), e só é ligada quando tem saldo.

### 5. Os Cores operam na conta mestre
Nada muda no robô. Ele abre uma ordem de 0,15 lote em XAUUSD na nossa conta.

### 6. O copiador repete a ordem nas contas dos clientes
Em ~5 milissegundos, a mesma ordem aparece na conta de cada cliente, **com o lote ajustado ao saldo dele**:

```
lote do cliente = lote da mestre × (saldo do cliente ÷ saldo da mestre)
```

Exemplo com a mestre a US$ 30.000 abrindo 0,15 lote:

| Cliente | Saldo | Lote que recebe | Consome MCP? |
|---|---|---|---|
| A | US$ 30.000 | 0,15 | sim |
| B | US$ 5.000 | 0,03 (arredonda pra 0,03) | sim |
| C | US$ 1.000 | 0,01 (mínimo da corretora) | sim |
| D | US$ 100 | 0,0005 → abaixo de 0,01 | **não recebe a ordem** |

O cliente D fica conectado, mas nada roda. É por isso que existe o mínimo de US$ 1.000.

Stop e alvo são copiados junto. Quando a mestre fecha, a cópia fecha.

### 7. Cada cópia executada conta MCP
Regra que já está no painel:

```
MCP consumido = lote ÷ 0,01 × fator do Core
```

Cliente A (0,15 lote, Core 04 fator 76) → 15 × 76 = 1.140 MCP.
Cliente B (0,03 lote) → 3 × 76 = 228 MCP.

O contador de MCP do cliente sobe a cada ordem. O painel mostra cada ordem com o MCP que ela custou e o total do ciclo até agora.

### 8. Fechou o ciclo, sai a fatura
No fechamento (sugestão: **semanal**, não mensal — explico abaixo) o backend gera a fatura com o MCP consumido, vencimento em 5 dias, pagamento em USDT. É o que já está no Financeiro do painel.

### 9. Atrasou? A cópia para
2 dias de carência. No 3º dia o backend manda o copiador pausar esse cliente: ordens novas não são copiadas pra ele; as abertas seguem sendo geridas até fechar (nunca deixamos posição órfã). Pagou, volta na hora. Já está no painel (congelamento com contagem de horas).

### 10. Ele acompanha tudo no painel
Ao vivo (posições e alvo), histórico da conta dele, consumo de MCP do ciclo, fatura prevista, faturas anteriores. Tudo isso já existe no Control Center — só muda de onde vêm os dados (do copiador em vez de um MT5 por cliente).

---

## E se ele usar e não pagar?

O risco existe, mas no modelo do copiador ele fica pequeno e controlado:

| Controle | Como funciona | Efeito |
|---|---|---|
| **Corte instantâneo** | A cópia liga e desliga por API, na hora. | Quem não paga para de custar no mesmo dia. |
| **Ciclo curto** | Fatura semanal em vez de mensal. | A dívida máxima de um cliente é 1 semana de uso, não 1 mês. |
| **Teto de MCP em aberto** | Passou de X MCP não pago (ex.: o equivalente a 1 semana média), a cópia pausa até quitar, mesmo antes do vencimento. | Ninguém acumula conta grande. |
| **Teto do 1º ciclo** | No primeiro mês, uso em aberto bate US$ 60 → cópia pausa até quitar. | Caloteiro consome no máximo ~US$ 60 antes de ser cortado. |
| **Deploy só com saldo** | Conta sem dinheiro não é ligada no MetaApi. | Cadastro vazio custa centavos, não US$ 6,80. |
| **Custo baixo por conta** | O que a RDX paga ao copiador por conta é centavos por dia. | O prejuízo real de um calote é pequeno; o que se perde é margem, não caixa. |

Na prática: o cliente só consegue "usar de graça" por poucos dias, e quem faz isso perde o acesso. Não compensa pra ele.

---

## Por que isso resolve os três problemas

**"Preciso de 50 VPS"** → Não. 1 VPS com 1 MT5 (a mestre). O copiador é nuvem e já foi testado com 10 mil contas.

**"Corretora não libera API"** → Não precisa. O copiador conecta pelo login de negociação que o cliente entrega, igual a qualquer terminal MT5. Funciona em qualquer corretora MT4/MT5 (conta hedge).

**"E se o cliente não pagar?"** → Ciclo curto + corte instantâneo + teto do 1º ciclo + deploy só com saldo. A exposição é de dias, e custa centavos. Ver a tabela acima.

---

## O que o cliente vê e o que ele não vê

**Vê:** as ordens aparecendo na conta dele, resultado, o que cada ordem consumiu de MCP, o consumo do ciclo e a fatura, o painel RDX com a marca RDX.

**Não vê:** o robô, a conta mestre, o copiador, os outros clientes. Do lado dele é "conectei minha conta, os Cores operam nela". Exatamente o que a landing já promete.

---

## Por que o MCP continua fazendo sentido (e faz até mais)

Antes, o MCP media "processamento" de um robô rodando na conta do cliente. Agora ele mede algo que custa dinheiro real pra RDX **por conta**: a conexão do copiador, o roteamento e a execução de cada ordem espelhada. Quanto mais lote, mais uso. Cobrar por lote executado é literalmente cobrar pela infraestrutura usada.

E a conta do cliente continua com ele — isso é o que mantém a RDX como serviço de tecnologia, não como gestora de dinheiro.

---

## O que custa pra RDX

- **MetaApi**: assinatura fixa (US$ 30/mês regular ou US$ 100/mês extended) + valor por conta conectada, cobrado por uso, mensal. Acima de 250 contas entra no plano Business, negociado. Ordem de grandeza: alguns dólares por conta por mês. Dá pra testar de graça com 2 contas.
- **1 VPS** pra conta mestre.
- **Backend** (Danilo): cadastro, MCP, USDT, integração com a API do copiador.

O MCP de um cliente com US$ 5.000 gira em torno de US$ 150/mês (fatores atuais). Cobre o custo por conta com folga.

---

## O que muda no que já está feito

| Área | Hoje | Vira |
|---|---|---|
| Financeiro | pós-pago, fatura mensal, atraso, congelamento | igual, só que ciclo semanal, pagamento só em USDT, teto de MCP em aberto e ativação diferida de US$ 49 |
| Conta › Corretora | conecta conta, perfil por capital | igual, + "em espera" quando abaixo do mínimo pra receber cópia |
| Cores | cards por Core | igual (os Cores são os mesmos) |
| Operações | lê a conta do cliente | igual — os dados vêm do copiador |
| Landing | adesão + pós-pago | igual |
| Infra | 1 VPS por N clientes | 1 VPS + MetaApi |

---

## Os dois pontos que não mudam, de propósito

1. **Dinheiro do cliente fica na corretora dele.** É o que torna isso um serviço de tecnologia.
2. **A RDX recebe só o que é dela**: ativação e MCP, em USDT, na wallet da empresa, declarado como receita da empresa.

---

## Próximos passos

1. Abrir conta MetaApi (grátis, 2 contas) e conectar a mestre + 1 conta de teste. Um dia de trabalho pra ver a cópia funcionando.
2. Danilo: backend com cadastro, contador de MCP por conta, fechamento semanal, faturas, recebimento USDT e a chamada de API que liga/desliga a cópia por cliente.
3. Eu: ajustar o Financeiro do painel pra ciclo semanal + só USDT + teto de MCP em aberto, e ligar o painel na API do MetaApi (leitura de posições/histórico por conta).
4. Definir o lote base da mestre — isso define o capital mínimo real do cliente.
5. Teste com 10 contas reais antes de abrir.
