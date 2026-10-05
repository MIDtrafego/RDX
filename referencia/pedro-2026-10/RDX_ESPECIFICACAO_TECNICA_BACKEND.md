# RDX Technology — Especificação técnica completa (backend, integrações e contrato do front)

Documento para o desenvolvedor backend (Danilo). Cobre tudo que o front já pronto espera, o modelo de negócio, a integração com MetaApi/CopyFactory, o motor de cobrança, pagamentos em USDT e a infraestrutura. Escrito para ser colado numa IA de código e virar backlog.

---

## 0. Resumo executivo (o que o sistema faz)

1. Cliente se cadastra na **landing** (`rdx_landing.html`) e conecta a **conta MT4/MT5 dele** (login, servidor, senha de negociação). **Nada é pago antes de usar.** A **ativação de US$ 49** é lançada na primeira fatura do cliente, só se houve execução.
2. O backend registra a conta do cliente no **MetaApi** e a inscreve como **subscriber** de uma estratégia do **CopyFactory** cuja fonte é a **conta mestre da RDX** (onde os Cores rodam). A cópia é proporcional ao saldo do cliente. O dinheiro do cliente **nunca** passa pela RDX.
3. Cada ordem copiada na conta do cliente vira um registro de **MCP** (`lote ÷ 0,01 × fator do Core`).
4. No fechamento mensal o backend gera a **fatura**: `MCP × preço × multiplicador da faixa` (com controlador e teto de 3%) **+ conexão por conta ativa (US$ 15; US$ 3 abaixo de US$ 1.000 de saldo médio)** + ativação US$ 49 na primeira fatura com execução. Pagamento em **USDT**, vencimento em 5 dias.
5. Atrasou: 2 dias de carência; no 3º dia o backend **remove a subscription** da conta (para de copiar). Pagou: religa.
6. O **Control Center** (`rdx_control_center.html`) lê tudo via `GET /api/...`. Já está pronto; o backend só precisa devolver os JSONs no formato descrito na seção 6.

---

## 1. Arquitetura

```
[Landing]  --cadastro/login-->  [API RDX]  <--lê/escreve-->  [PostgreSQL]
[Control Center] --GET /api--> [API RDX]  --REST/WS-->  [MetaApi + CopyFactory]  --protocolo MT-->  [Corretoras dos clientes]
                                   |                                                     ^
                                   |--jobs (cron/worker)-->  MCP, faturas, cortes           |
                                   |--webhooks/polling-->  [Blockchain USDT: TRON/ETH/BSC]   |
[VPS RDX: 1 MT5 + Cores]  --conta mestre-->  [Corretora da RDX]  <--MetaApi provider-------|
```

Componentes:

| Componente | Função | Tecnologia sugerida |
|---|---|---|
| **API RDX** | Auth, cadastro, contas, MCP, faturas, pagamentos, endpoints do painel | Node (NestJS/Fastify) ou Python (FastAPI). REST + JSON |
| **Worker/Jobs** | Sincronizar deals do MetaApi, calcular MCP, fechar mês, cortar inadimplentes, checar pagamentos on-chain | Mesmo runtime; fila (BullMQ/Redis ou cron) |
| **PostgreSQL** | Dados | 15+ |
| **Redis** | Cache de posições/cotações, fila | opcional mas recomendado |
| **MetaApi** | Conexão às contas MT4/MT5, execução, streaming; CopyFactory copia mestre → clientes | SaaS (metaapi.cloud) |
| **VPS mestre** | 1 Windows com MT5 + Cores (EAs) na conta mestre da RDX | 1 VPS |
| **Frontend** | `rdx_landing.html` + `rdx_control_center.html` (estáticos) | Nginx / Cloudflare Pages / S3 |
| **Carteiras USDT** | Recebimento de ativação e faturas | Endereço por fatura (HD wallet) ou gateway (ex.: NOWPayments, CoinPayments) |

---

## 2. Regras de negócio (fonte da verdade)

### 2.1 Cadastro e ativação
- Cadastro: nome, sobrenome, e-mail, telefone, país, senha, 2FA (TOTP).
- **Aceite = 3 caixas + 2FA** (tabela `acceptances`). Fluxo: (1) exibir Termos e Aviso de Risco em modal com rolagem obrigatória até o fim (`scrolled_to_end=true`, `dwell_ms`); (2) habilitar as 3 caixas; (3) pedir código TOTP; (4) gravar: `user_id, doc_terms_version, doc_terms_sha256, doc_risk_version, doc_risk_sha256, box1_at, box2_at, box3_at, ip, user_agent, lang, tz, dwell_terms_ms, dwell_risk_ms, scrolled_terms, scrolled_risk, totp_verified_at, hmac` (HMAC-SHA256 do registro com chave do servidor, para integridade); (5) gerar PDF dos dois documentos + página de registro e enviar por e-mail (tracking de entrega/abertura em `acceptance_emails`); (6) opcional: ancorar o hash do registro numa tx na Tron (custo ~US$ 0,01) e guardar `anchor_txid` — carimbo de tempo externo. Textos dos documentos ficam versionados em `legal_documents` (nunca sobrescrever; nova versão = nova linha). KYC (`kyc_documents`): documento com foto, selfie, comprovante de titularidade da conta — exigido antes do 1º deploy ou sob demanda.
- Ativação = **licença semestral de US$ 49, diferida** (renova a cada 6 meses na fatura do mês de aniversário, só se houve execução nesse mês; `LICENSE_USD` em config para subir a US$ 149 depois; `activation_charged_at` guarda a última cobrança). Não é cobrada no cadastro. Regra: `activation_charged_at = NULL` até a primeira fatura de um ciclo em que **alguma conta do cliente teve ≥ 1 deal de entrada copiado**; nessa fatura entra a linha `Ativação · US$ 49`. Status do cliente: `REGISTERED` → `ACTIVE` (ao conectar a 1ª conta com saldo ≥ mínimo) — não existe mais `PENDING_ACTIVATION`.
- Cliente sem execução nunca é cobrado. Cliente que conecta, usa e não paga a 1ª fatura: corte normal (2.6) + ativação fica devida.
- **Uma conta de cliente por pessoa**: e-mail verificado + telefone + 2FA; opcional KYC leve (documento) antes da 1ª ativação de cópia. Bloquear cadastro duplicado por e-mail/telefone/CPF e por login MT5 já usado.

### 2.2 Conta do cliente (broker account)
- Campos: broker, server, login, senha de negociação (cifrada em repouso, enviada ao MetaApi, **nunca** devolvida ao front), plataforma (mt4/mt5), apelido.
- Estados: `CONNECTING` → `CONNECTED` | `DISCONNECTED` (credencial inválida, cliente desconectou, corte por inadimplência mantém `CONNECTED` mas `copy_enabled=false`).
- **Capital mínimo**: `MIN_CAPITAL = 100` USD (saldo em USD; para conta cent, `balance_usc / 100`).
- **Estados de deploy (controle de custo MetaApi — a conta só custa enquanto deployada):**
  ```
  PENDING_DEPOSIT  conectada, saldo < mínimo → undeploy imediato; checar saldo 1×/dia (deploy ~2 min + undeploy, ≈ US$ 0,001);
                   30 dias sem depósito → remover do MetaApi (custo zero). Sem conexão, sem MCP.
  ACTIVE           saldo ≥ mínimo → deployed + subscriptions ativas. Conexão + MCP.
  DORMANT          ACTIVE que ficou 7 dias com saldo < mínimo ou credencial inválida → undeploy, subscriptions removidas; sem conexão.
  SUSPENDED        inadimplência (2.6) ou violação. Mantém deploy só se houver posições abertas; senão undeploy.
  ```
- **Tipo de conta e faixa (automático, o cliente não escolhe):**
  ```
  tipo    = 'cent' se currency ∈ {USC, EUC, ...} ou contractSize do símbolo = 1/100 do padrão; senão 'standard'
  saldo   = balance em USD (cent: /100)
  FAIXA = [ {min:100,   acc:'cent',     exposure:0.50, infra_usd:3},    # saldo < 1000 → conexão US$ 3
            {min:1000,  acc:'cent',     exposure:0.50, infra_usd:15},
            {min:10000, acc:'standard', exposure:0.75, infra_usd:15},
            {min:15000, acc:'standard', exposure:1.00, infra_usd:15} ]
  ```
  Todos os Cores ativos operam em todas as faixas. `exposure` é o multiplicador aplicado sobre a cópia proporcional (balance scaling); em conta cent o CopyFactory recebe `multiplier = exposure` e o backend informa o saldo já dividido por 100 (ou usa `tradeSizeScaling: {mode:'balance'}` com conversão USC→USD configurada). **Mapeamento de símbolo** por corretora/tipo: `XAUUSD ↔ XAUUSDc / XAUUSDm / XAUUSD.c` (tabela `symbol_map`). Reavaliar faixa diariamente pelo saldo médio.
  Contas cent homologadas: Exness Standard Cent, XM Micro, RoboForex ProCent. Outras → `PENDING_DEPOSIT` com flag `needs_homologation`.
- Múltiplas contas por cliente: permitido. Uma é `primary`.

### 2.3 Cores (engines)
Os 6 Cores são fixos no backend (tabela `engines`), com `id`, `name` (GT Core 0X), `tag` (DN/QT/NT/FM/TT/RX), `symbols`, `factor`, `version`, `status` (ACTIVE/STANDBY), `magic` (número mágico do EA na mestre, **interno, nunca exposto**). Nomes reais dos robôs **não existem** em lugar nenhum do sistema.

### 2.4 MCP
- Por deal de **entrada** (`entry = in`) copiado na conta do cliente: `mcp = (volume / 0.01) × factor(core)`; a ordem é atribuída ao Core pelo `magic`/comentário da mestre (o CopyFactory preserva `comment`; configurar `copyComment`) ou pelo mapeamento `strategyId → core`.
- Fatores atuais (calibrados no track record): core01 76 · core02 70 · core03 73 · core04 76 · core05 67 · core06 70. Preço: **US$ 0,0167 / MCP**. Ambos em tabela de configuração versionada (`pricing_versions`), com `valid_from`.

### 2.5 Fatura (motor de cobrança)
Parâmetros (`PRICING`):
```
base = 0.50            # alvo usado na calibração dos fatores
tiers = [[10000,0.50],[20000,0.45],[30000,0.40],[50000,0.35],[100000,0.30]]   # alvo por saldo médio
ctrl = true; ctrlWindow = 3; ctrlClamp = [0.7, 1.3]   # controlador mensal
capOn = true; capPct = 0.03                            # teto: 3% do saldo médio do mês
infra_usd = 15 (3 se saldo_medio < 1000)               # conexão por conta ativa
activation_usd = 49                                    # licença semestral; 1ª fatura com execução e a cada 6 meses (config, futuro: 149)
first_cycle_cap_usd = 60                               # 1º ciclo: uso em aberto ≥ 60 → pausar cópia até quitar
due_days = 5; grace_days = 2                           # vencimento e carência
```
Cálculo por conta, por mês:
```
mcp_mes        = Σ mcp dos deals de entrada no mês
saldo_medio    = média diária do balance no mês (snapshots)
tm             = tierTarget(saldo_medio) / base           # multiplicador da faixa
cm             = clamp( tierTarget / (pago_ultimos_N / resultado_positivo_ultimos_N), ctrlClamp )  # 1.0 se sem histórico
base_usd       = mcp_mes × price × tm × cm
usage_usd      = min(base_usd, saldo_medio × capPct)      # teto
infra          = (saldo_medio < 1000 ? 3 : 15) se a conta esteve ACTIVE em qualquer dia do mês
activation     = 49 se é a 1ª fatura do cliente com mcp_mes > 0 e activation_charged_at IS NULL
total          = usage_usd + infra + activation
```
O `cm` (controlador) usa `usd` pago e resultado dos últimos `ctrlWindow` meses da **mesma conta**. Guardar `tm`, `cm`, `capped`, `usage`, `infra` na fatura para auditoria.

**Ao cliente**: mostrar `total`, `mcp`, período, vencimento, status e, quando houver, a linha `Ativação · US$ 49`. Nunca exibir alvo/porcentagem nem o fator de exposição. A conexão (3/15) aparece nos Termos e na fatura detalhada, não na landing.

**Kill-switch da mestre (continuidade):** job a cada 60 s lê equity/balance da mestre via MetaApi; se `drawdown_equity ≥ KILL_DD (35%)` ou heartbeat do EA ausente por `HB_TIMEOUT (15 min)` → alerta (Telegram/WhatsApp) e, após `KILL_DELAY (15 min)` sem ação humana, fecha posições da mestre pela API (CopyFactory replica o fechamento). Limites por subscriber: `maxPositions = 12`; sem limite de perda por ordem (flutuante negativo é esperado).

### 2.6 Ciclo de cobrança e inadimplência
- Fechamento: dia 1 de cada mês 00:05 UTC → fatura `open` → `due` (vence em 5 dias).
- Vencida: `late`. `late_days ≥ 3` → `copy_enabled = false` em todas as contas do cliente (remover subscriptions no CopyFactory; posições abertas **não** são fechadas). Notificar.
- Pagamento confirmado → `paid`, `copy_enabled = true`, reinscrever subscriptions.
- Estado exposto ao front: `none | ok | due | late`, com `hrs` até o corte (= due + 3 dias − agora).

### 2.7 Pagamentos (USDT)
- Redes: TRC-20 (Tron), ERC-20 (Ethereum), BEP-20 (BNB Chain).
- Por fatura/ativação: gerar **endereço único** (HD wallet por rede) ou usar gateway que devolve endereço + QR. Valor exato em USDT (1 USDT = 1 USD).
- Confirmação: watcher on-chain (TronGrid / Etherscan / BscScan APIs ou webhook do gateway). Tolerância: valor ≥ 99,5% do esperado. Confirmações: 1 (Tron), 12 (ETH), 15 (BSC).
- Expiração do endereço/QR: 30 min no front (pode gerar outro). Pagamento fora da rede indicada: não reconhecido (registrar para suporte).
- Recibo: `receipts` com número `REC-YYYYMM`, hash da tx, rede, valor, composição.

### 2.8 Segurança
- Senha do MT5: cifrar com KMS/libsodium antes de persistir; enviar ao MetaApi no `createAccount`; **nunca** retornar ao front. Rotação: cliente clica Reconectar → informa senha nova → `PATCH` no MetaApi (`update account`).
- 2FA TOTP obrigatório no login; sessões JWT curtas + refresh; rate limit; audit log de tudo (tabela `audit_logs`).
- Nada de Math.random em dados exibidos; tudo vem de registros.

---

## 3. Integração MetaApi / CopyFactory

Docs: https://metaapi.cloud/docs/client/ · https://metaapi.cloud/docs/copyfactory/ · https://metaapi.cloud/docs/provisioning/
SDKs: JavaScript e Python. Região: escolher a mais próxima das corretoras (Londres/Nova York). Infra **Cloud G2**, regime **24/5** (desligar contas no fim de semana pra economizar).

### 3.1 Setup único (RDX)
1. Criar conta MetaApi (assinatura Extended US$ 100/mês recomendada; Business acima de 250 contas).
2. Adicionar a **conta mestre** da RDX (provisioning API `POST /users/current/accounts`, `type: cloud-g2`, `copyFactoryRoles: ['PROVIDER']`, senha de **investidor** basta para a mestre).
3. Criar **uma estratégia CopyFactory por Core**: `POST /users/current/configuration/strategies/{strategyId}` com `accountId = mestre`, `magicFilter: {included:[<magic do Core>]}` (ou `symbolFilter`), `tradeSizeScaling: {mode:'balance'}`, `copyStopLoss: true`, `copyTakeProfit: true`, `maxTradeRisk` opcional, `minTradeVolume: 0.01`.
   Guardar `strategyId` em `engines.copyfactory_strategy_id`.

### 3.2 Por cliente — conectar conta
```
POST /users/current/accounts            (provisioning)
  { name, type:'cloud-g2', login, password:<senha negociação>, server, platform:'mt5'|'mt4',
    region, magic:0, copyFactoryRoles:['SUBSCRIBER'], quoteStreamingIntervalInSeconds:2.5, reliability:'high' }
→ accountId  → guardar em broker_accounts.metaapi_account_id
esperar state = DEPLOYED e connectionStatus = CONNECTED (polling ou webhook)
ler account information (balance, equity, margin, leverage, currency)  → validar capital mínimo
```
Falha de login/senha → `DISCONNECTED` com motivo; front mostra "Reconectar".

### 3.3 Por cliente — ligar cópia (estado ACTIVE: capital ≥ mínimo; ativação é diferida, não bloqueia)
```
PUT /users/current/configuration/subscribers/{subscriberId = accountId}
  { name, subscriptions: [ {strategyId: <core01>, multiplier: <exposure>}, ... todos os Cores ativos ... ],
    tradeSizeScaling: {mode:'balance'}, symbolMapping: [{from:'XAUUSD', to:'XAUUSDc'}] (cent), maxPositions: 12 }
```
`exposure` vem da FAIXA (0,5 / 0,75 / 1,0). Desligar cópia: `DELETE .../subscribers/{id}` ou subscriptions vazias. Reavaliação diária do perfil por saldo.

### 3.4 Dados para o painel (MetaApi client API)
- **Posições abertas**: `GET /users/current/accounts/{id}/positions` (ou streaming WS) → mapear para `/api/live/positions`.
- **Histórico de deals**: `GET .../history-deals/time/{from}/{to}` → tabela `deals`; agrupar `in`+`out` por `positionId` para formar a ordem fechada (`ops`) com `result = profit+commission+swap`.
- **Conta**: `GET .../account-information` → balance, equity, margin, freeMargin, leverage, currency, broker, server → snapshot diário em `account_snapshots` (base do saldo médio).
- **Cotações**: streaming de `XAUUSD, EURUSD, EURGBP, AUDCAD` da mestre (ou TradingView scanner como hoje no front).
- **Atribuição ao Core**: `deal.comment`/`magic` copiado da mestre ou `CopyFactory transactions` (`GET /users/current/subscribers/{id}/transactions`) que trazem `strategyId` por trade — **preferir este**, é inequívoco.

### 3.5 Custos (calculadora oficial, 24/5, G2, com CopyFactory)
US$ 6,80 por conta ativa/mês · US$ 0,50 conta inativa · US$ 2,10 uma vez por conta adicionada · assinatura US$ 30–100/mês. Cobrança por hora: desligar (`undeploy`) contas inativas/inadimplentes economiza.

---

## 4. Modelo de dados (PostgreSQL)

```sql
users(id, email UNIQUE, password_hash, first_name, last_name, phone, country, lang, tz,
      totp_secret, totp_enabled, status ENUM('REGISTERED','ACTIVE','SUSPENDED'), activation_charged_at TIMESTAMPTZ NULL,
      client_code TEXT UNIQUE,         -- ex.: rdx_7f2a (exibido)
      terms_version, terms_accepted_at, terms_ip, terms_checks JSONB, created_at)

sessions(id, user_id, refresh_token_hash, ua, ip, created_at, expires_at)

broker_accounts(id, user_id, broker, server, login, platform ENUM('mt4','mt5'), nickname,
      password_enc BYTEA, metaapi_account_id, is_primary BOOL,
      status ENUM('CONNECTING','CONNECTED','DISCONNECTED'), status_reason,
      copy_enabled BOOL DEFAULT false, profile ENUM('waiting','Base','Padrão','Completo'),
      currency, leverage, account_type, connected_at, last_sync_at, created_at)

account_snapshots(id, broker_account_id, at TIMESTAMPTZ, balance, equity, margin, free_margin, floating)
      -- 1 por hora (ou por dia); base do saldo médio e do gráfico "Saldo na corretora"

engines(id TEXT PK,  -- core01..core06
      name, tag, cat, symbols TEXT[], factor NUMERIC, version, status ENUM('ACTIVE','STANDBY'),
      magic INT, copyfactory_strategy_id TEXT, deployed_at, last_cycle_at)

deals(id, broker_account_id, metaapi_deal_id UNIQUE, position_id, engine_id, symbol, side ENUM('BUY','SELL'),
      entry ENUM('in','out'), volume, price, profit, commission, swap, at TIMESTAMPTZ, comment, magic)

orders(id, broker_account_id, position_id UNIQUE, engine_id, symbol, side, volume,
      open_at, close_at, price_open, price_close, result NUMERIC, mcp NUMERIC, factor_used, status ENUM('OPEN','CLOSED'))
      -- "ops" do painel; mcp calculado no deal de entrada

pricing_versions(id, valid_from, price_per_mcp, infra_usd, factors JSONB, tiers JSONB, base, ctrl JSONB, cap JSONB)

invoices(id, user_id, period_ym TEXT,  -- '2026-08'
      mcp NUMERIC, usage_usd, infra_usd, total_usd, tm, cm, capped BOOL, avg_balance,
      status ENUM('open','due','late','paid','void'), closes_at, due_at, paid_at, receipt_no,
      accounts JSONB)  -- contas incluídas e mcp por conta

payments(id, user_id, invoice_id NULL, kind ENUM('activation','invoice'), amount_usd, network ENUM('TRC20','ERC20','BEP20'),
      address, expected_usdt, received_usdt, tx_hash, confirmations, status ENUM('pending','confirmed','underpaid','expired'),
      created_at, confirmed_at)

notifications(id, user_id, kind, title, text, at, read BOOL, channels JSONB)
notification_prefs(user_id, kind, wa BOOL, em BOOL, push BOOL)

audit_logs(id, user_id NULL, at, kind ENUM('LOGIN','EXECUTION','SYNC','BILLING','GUARDIAN','DEPLOY','BROKER','SECURITY'), text, meta JSONB)

guardian_state(key PK, value, state ENUM('on','warn','stop'), updated_at)   -- monitores do sistema
```

---

## 5. Jobs (worker)

| Job | Frequência | O que faz |
|---|---|---|
| `sync_positions` | 5 s (ou WS) | posições abertas por conta → cache (Redis) |
| `sync_deals` | 1 min | novos deals do MetaApi → `deals`; fecha `orders`; calcula `mcp` no deal `in`; atribui `engine_id` via CopyFactory transactions |
| `snapshot_accounts` | 1 h | balance/equity → `account_snapshots` |
| `reevaluate_profiles` | diário 00:10 | saldo → perfil ALLOC → ajusta subscriptions |
| `close_month` | dia 1, 00:05 UTC | gera `invoices` (seção 2.5), notifica |
| `mark_due_late` | 1 h | `open→due` no vencimento; `due→late` após; `late ≥ 3 dias` → `copy_enabled=false` + remove subscriptions + notifica |
| `watch_payments` | 30 s | checa endereços pendentes on-chain; confirma → `paid`, religa cópia, gera recibo |
| `weekend_undeploy` | sex 22:00 / dom 22:00 UTC | undeploy/redeploy das contas (economia 24/5) |
| `guardian` | 1 min | latência, conexão da mestre, spread anormal → `guardian_state` + auditoria |

---

## 6. Contrato do frontend (o que `rdx_control_center.html` chama)

Todas as rotas exigem `Authorization: Bearer <jwt>`. O painel usa `RDX.get(path)` com `fetch('/api'+path)`; se falhar cai no DEMO embutido (remover DEMO em produção). Formatos **exatos**:

### `GET /api/account` — conta exibida (a `primary` ou a selecionada via `?id=`)
```json
{ "broker":"XM Global","server":"XMGlobal-MT5 18","login":"430416653","currency":"USD","leverage":"1:500",
  "type":"Real · Hedge","status":"CONNECTED","permissions":"Trade-only · sem saque",
  "balance":6946.09,"equity":7559.18,"margin":412.5,"free_margin":7146.68,"floating":613.09,
  "updated":"2026-09-04T02:06:00","connected_at":"20/07/2026","primary":true }
```

### `GET /api/accounts` — demais contas do cliente (mesmo formato, + `positions:[]`)

### `GET /api/live/positions` — posições abertas da conta exibida
```json
[ { "symbol":"XAUUSD","engine":"core04","side":"BUY","volume":0.02,"opened":"2026-09-04T09:12:40",
    "price_open":4451.20,"price_now":4468.97,"tp":4482.00,"sl":4438.50,"pnl":35.54,"tp_pnl":61.60 } ]
```
`tp_pnl` = lucro estimado no TP (calc: (tp−open)×dir×contrato×lote, em USD). `tp`/`sl` podem ser `null`.

### `GET /api/engines`
```json
[ { "id":"core01","name":"GT Core 01","tag":"DN","cat":"XAU/USD","symbols":["XAUUSD"],"factor":76,
    "version":"3.2.0","status":"ACTIVE","deployed":"2026-08-19","last_cycle":"2026-09-03T15:22:41" } ]
```

### `GET /api/billing`
```json
{ "price_per_mcp":0.0167, "infra_usd":15, "due_days":5,
  "adhesion":{ "usd":49, "paid":true, "charge_on":"first_invoice", "paid_at":"03/05/2026", "method":"USDT · TRC-20" },
  "invoice_status":{ "2026-07":{"status":"paid","paid_at":"04/08/2026","method":"USDT"}, "2026-08":{"status":"late"} } }
```
> Hoje o front **recalcula** as faturas a partir de `ops` + `invoice_status` (função `buildInvoices`). Em produção, trocar por `GET /api/invoices` devolvendo a lista já calculada pelo backend (campos: `id, key, label, period, mcp, n, usd, usage, infra, tm, cm, cap, capped, res, closes, due, dueIso, status, paid_at, method`) e simplificar `buildInvoices` para ler essa lista.

### `GET /api/ops` (novo — hoje vem embutido em `RDX_REAL.ops`)
```json
[ { "id":62659912,"open":"2026-09-03T16:49:16","close":"2026-09-03T17:07:13","symbol":"XAUUSD","engine":"core03",
    "side":"SELL","volume":0.02,"price_open":4456.65,"price_close":4472.07,"duration":"17min","result":-30.84,"mcp":146.0 } ]
```
Ordenado do mais recente ao mais antigo. Também: `balance_series` `[{k:'2026-07-20',v:1819.35}]` (1 por dia) e `by_engine` `{core01:{orders,result,volume,mcp,wins}}` — ou o front calcula.

### `GET /api/system/guardian` → `[["Market Data","HEALTHY","on"],...]` (label, texto, `on|warn|off|stop`)
### `GET /api/notifications` → `[["📈","Título","Texto","04/09 10:48"]]` (o front troca o emoji por ícone; usar os mesmos 7 códigos: 📈 📉 🛡️ 🔔 🧾 ⚙️ 🔗)
### `GET /api/system/audit` → `[["2026-09-04 10:48:11","EXECUTION","texto"]]`
### `GET /api/telemetry/events` → `[{event_id,engine,symbol,ts,market_data_events,processing_ms,mcp,execution,status}]`

### Escritas (a implementar; o front já tem os botões)
| Ação no front | Endpoint | Body |
|---|---|---|
| Cadastro (landing) | `POST /api/auth/register` | `{first_name,last_name,email,phone,country,password,terms_version,terms_checks[]}` |
| Login / 2FA | `POST /api/auth/login`, `POST /api/auth/2fa` | |
| Conectar conta MT5 | `POST /api/brokers` | `{broker,server,login,password,platform,nickname}` → `202 {id,status:'CONNECTING'}`; front faz polling em `GET /api/brokers/{id}` até `CONNECTED` |
| Reconectar (senha nova) | `PATCH /api/brokers/{id}/credentials` | `{password}` |
| Desconectar / tornar principal | `DELETE /api/brokers/{id}` · `POST /api/brokers/{id}/primary` | |
| Pagar ativação / fatura | `POST /api/payments` | `{kind:'activation'|'invoice', invoice_id?, network:'TRC20'|'ERC20'|'BEP20'}` → `{address, expected_usdt, qr_svg, expires_at}` |
| Status do pagamento | `GET /api/payments/{id}` | → `{status, tx_hash, confirmations}` |
| Recibo | `GET /api/receipts/{invoice_id|activation}` | → dados do recibo (o front já monta o layout) |
| Perfil / preferências / senha do painel | `PATCH /api/me`, `PUT /api/me/notification-prefs`, `POST /api/me/password` | |
| 2FA backup codes / sessões | `GET /api/me/2fa/backup`, `DELETE /api/me/sessions/{id}` | |
| Emergency stop (interno) | `POST /api/system/emergency-stop` | admin only |

---

## 7. Landing (`rdx_landing.html`) — o que precisa de backend
- Formulário de cadastro em 3 passos (Dados → Segurança → Verificação) → `POST /api/auth/register`, e-mail de verificação, redirect para o painel.
- Login → `/api/auth/login` (+2FA).
- Track record: hoje é JSON embutido (`RDX_DATA`) extraído do MT5 por `extrator_relatorio_mt5.py`. Em produção: `GET /api/public/track-record` gerado pelo backend a partir da **conta mestre** (ops fechadas, curva, stats) — atualizar 1×/dia. Manter texto "Resultados passados não garantem…".
- Ticker de preços: TradingView scanner direto do navegador (já funciona) — pode manter.

---

## 8. Infra e deploy
- **API + worker**: Docker, 2 réplicas API + 1 worker; Postgres gerenciado; Redis.
- **Frontend**: estático atrás de Cloudflare (HTTPS obrigatório; o widget TradingView exige http/https).
- **VPS mestre**: Windows Server, MT5, Cores, watchdog de reinício; a mestre é lida pelo MetaApi (senha investidor).
- **Segredos**: `.env` → `METAAPI_TOKEN, METAAPI_REGION, DB_URL, REDIS_URL, JWT_SECRET, KMS_KEY, TRON_API_KEY, ETH_RPC, BSC_RPC, WALLET_XPUB_*`.
- **Backups**: Postgres diário; auditoria imutável (append-only).
- **Observabilidade**: logs estruturados, alerta se a mestre desconectar, se `sync_deals` atrasar > 5 min, se watcher de pagamentos falhar.

---

## 9. Sequências principais

**Onboarding**
```
Cadastro → aceite Termos (log) → POST /payments activation → endereço USDT → watcher confirma → user ACTIVE
→ POST /brokers → MetaApi createAccount → CONNECTED → account-information → saldo ≥ 1000?
   sim → perfil ALLOC → PUT subscriber (strategies do perfil) → copy_enabled=true
   não → profile='waiting' (sem subscription) ; reavaliar diariamente
```
**Ordem**
```
Core abre na mestre → CopyFactory replica (balance scaling) → deal 'in' na conta do cliente
→ sync_deals: orders(OPEN) + mcp = vol/0.01 × factor(strategyId→core) → painel Ao vivo
→ fecha → deal 'out' → orders(CLOSED, result) → Histórico
```
**Fatura**
```
dia 1 → close_month: por cliente: Σ mcp (mês) por conta, saldo médio, tm, cm, teto, +15/conta ativa → invoice open/due
→ dia 6 sem pagar → late → dia 8 → copy_enabled=false, remove subscriptions, notifica ("congelamento")
→ pagou → paid, recibo, religa
```

---

## 10. Backlog sugerido (ordem)
1. Auth + cadastro + termos (log) + 2FA.
2. MetaApi: conta mestre + 6 estratégias; `POST /brokers` + polling; `/api/account`, `/api/accounts`.
3. `sync_deals` + `orders` + MCP; `/api/ops`, `/api/live/positions`, `/api/engines`.
4. Snapshots + perfis ALLOC + subscriptions.
5. Pagamentos USDT (ativação) + watcher + recibos.
6. `close_month`, `/api/invoices`, `/api/billing`, inadimplência/corte.
7. Notificações, auditoria, guardian.
8. Track record público da mestre para a landing.
9. Remover `RDX_DEMO` e `RDX_REAL` embutidos do front; apontar tudo para a API.

Arquivos de referência na pasta: `rdx_control_center.html` (painel), `rdx_landing.html` (landing), `rdx_ops_reais.json` (formato de ops/engines/snapshots), `extrator_relatorio_mt5.py` (parser do relatório MT5), `mt5_connector.py` (esqueleto de leitura MT5 — substituído pelo MetaApi), `RDX_como_funciona_conta_mestre.md` (explicação de negócio), `RDX_termos_de_uso_esboco.md` (contrato).
