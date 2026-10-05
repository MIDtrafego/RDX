# RDX — Resumo das últimas alterações (out/2026)

Documento de referência para Danilo (backend), Yuri (site/marketing) e advogado. Tudo abaixo já está aplicado nos arquivos do pacote `RDX_pacote_danilo.zip`.

---

## 1. Modelo comercial — plano único (substitui a adesão de US$ 400)

| Antes | Agora |
|---|---|
| Adesão US$ 400 paga antes de usar | **Nada antes de usar.** Licença semestral de acesso de **US$ 49**, lançada na **primeira fatura**, só se houve execução no mês; renova a cada 6 meses (valor em config; plano: US$ 149 quando a base crescer) |
| Capital mínimo US$ 1.000 | **Mínimo US$ 100** na corretora |
| Perfis Base / Padrão / Completo (Cores por faixa) | **Todos os 6 Cores em todas as faixas.** O que muda por faixa é a **exposição** e o tipo de conta |
| Só conta padrão | **Conta Cent até US$ 10.000** (Exness Standard Cent, XM Micro, RoboForex ProCent); Padrão acima |
| Conexão US$ 15 fixa | **US$ 15/mês por conta ativa; US$ 3** se saldo médio < US$ 1.000 (só no contrato e na fatura, nunca na landing) |
| MCP US$ 0,0167 com teto 3% | igual — **teto de 3% do saldo médio** mantido e agora escrito no contrato como limite em benefício do cliente |
| — | **Teto do 1º ciclo:** uso em aberto chega a US$ 60 → cópia pausa até quitar |

**Faixas (automáticas, cliente não escolhe):**

| Saldo médio | Conta | Exposição | Conexão |
|---|---|---|---|
| US$ 100 – 999 | Cent | 0,5× | US$ 3 |
| US$ 1.000 – 9.999 | Cent | 0,5× | US$ 15 |
| US$ 10.000 – 14.999 | Padrão | 0,75× | US$ 15 |
| US$ 15.000+ | Padrão | 1,0× | US$ 15 |

**Primeira fatura (dia 30):** licença US$ 49 + MCP do mês + conexão. Depois: MCP + conexão. Vencimento 5 dias, carência 2, congela no 3º. Pagamento em USDT.

## 2. Controle de custo MetaApi — estados da conta

Conta só é **deployada** (custa ~US$ 6,80/mês) quando tem saldo ≥ US$ 100.

- `PENDING_DEPOSIT` — conectada sem saldo: undeploy; checagem de saldo 1×/dia (≈ US$ 0,001); 30 dias sem depósito → remove.
- `ACTIVE` — saldo ≥ mínimo: deploy + cópia ligada; conta MCP e conexão.
- `DORMANT` — 7 dias sem saldo mínimo ou credencial inválida → undeploy, sem conexão.
- `SUSPENDED` — inadimplência ou violação.

Custo de uma conta parada: ~US$ 0,50/mês (≈ 2 centavos/dia). Deletada: zero.

**Kill-switch da mestre:** job a cada 60 s; DD de equity ≥ 35% ou heartbeat do EA ausente por 15 min → alerta; sem ação humana em 15 min → fecha posições da mestre (CopyFactory replica). Limite por assinante: 12 posições; sem limite de perda por ordem.

**CopyFactory por assinante:** `multiplier = exposição da faixa`, `tradeSizeScaling: balance`, conta cent com saldo ÷ 100 e mapeamento de símbolo (`XAUUSD → XAUUSDc / XAUUSDm / XAUUSD.c`).

## 3. Contrato (Termos de Uso v1.0) e Aviso de Risco

Arquivos: `RDX_termos_de_uso.md/.docx`, `RDX_disclaimer_e_termo_de_risco.md/.docx`.

- Entidade: **RDX Gestão e Tecnologia Ltda, CNPJ 65.079.034/0001-69**; lei brasileira; foro na sede; arbitragem.
- **5.1** Licença semestral US$ 49, diferida, não reembolsável no todo ou em parte. **5.1.1** licença vale enquanto o serviço existir; sem direito a prazo mínimo, continuidade ou indenização.
- **5.2.1** Teto de 3% (limite, não participação em resultado). **5.3** Conexão 15/3. **5.3.1** Mínimo US$ 100, Cent até 10k, exposição automática.
- **4.6** Código de conduta — 11 condutas vedadas (revender, operar dinheiro de terceiros, se passar por parceiro, prometer ganho, multi-cadastro, fraude de pagamento, assédio/difamação, engenharia reversa, conta proibida pela corretora, informação falsa, cláusula geral de boa-fé).
- **4.7** Sanções sem aviso: suspensão, encerramento definitivo, bloqueio de recadastro, retenção de créditos, cobrança, **multa US$ 5.000** por infração grave, comunicação a corretora/autoridades, medidas cíveis e criminais.
- **4.7-A** Capital de terceiros: **recomposição** (recalcula tudo como se cada terceiro fosse cliente, sem teto e sem desconto) + **indenização pré-fixada: US$ 10.000 ou 20% do capital movimentado, o maior** + **US$ 500 por pessoa** + suplementar expressa (CC 416) + autorização de comunicar Bacen/CVM/PF/MP. **4.7-B** Ciência de que é crime (Lei 7.492/86 art. 16; Lei 6.385/76 art. 27-E).
- **4.8** Apuração pelos logs da RDX, sem obrigação de revelar fonte; defesa em 10 dias; decisão final.
- **4.9** Encerramento por conveniência: a RDX pode encerrar qualquer cliente **sem declinar motivo**, com 7 dias de aviso; imediato em violação.
- **6.6** Estados da conta. **6.7** Uma conta por titular + KYC.
- **12.4-A** Descontinuidade do serviço (inclusive encerramento da empresa, falência, venda) **sem reembolso de nada**. **12.4-B** Nenhum valor devolvido por perda/resultado; RDX não assume nem compartilha perdas.
- **15** Referências normativas BR (CC 421-A, 423/424, CDC 51/54, Lei 9.307 art. 4º §2º, LGPD, Marco Civil, MP 2.200-2, Lei 14.063, Lei 14.478, CVM 19/21 e 21/21, Lei 9.613) e EUA (FAA + *Concepcion*/*Epic Systems*, E-SIGN/UETA, DTSA, DMCA, CFAA; CEA/CFTC como motivo de excluir residentes dos EUA) + Convenção de Nova York.
- **16 Aceite = 3 caixas + 2FA:**
  1. Li e aceito os Termos de Uso, o Aviso de Risco e a Política de Privacidade.
  2. Declaro que a conta conectada é de minha titularidade e que opero exclusivamente capital próprio.
  3. Aceito a arbitragem como forma exclusiva de solução de disputas.
- **16.2 Prova:** rolagem obrigatória até o fim (tempo e scroll gravados), hash SHA-256 do texto de cada documento + versão, data/hora UTC de cada clique, IP, user agent, idioma/fuso, **reautenticação por TOTP**, assinatura HMAC do registro, PDF enviado por e-mail com rastreio, opcional âncora do hash na Tron. **16.3** KYC (documento, selfie, titularidade) vinculado ao aceite.
- **Aviso de Risco:** linguagem direta, sem caixa de "posso perder tudo"; risco em uma frase corrida ("perdas, que podem ser significativas ou totais"), sem destaque.
- Pontos ⚖️ (advogado confirmar): valor das multas (CC 412/413), licença não reembolsável em relação de consumo, teto 3% como não-performance, cobrança condicionada a execução (CDC 39).

## 4. Painel do cliente (`rdx_control_center.html`)

- "Adesão" → **"Licença semestral · US$ 49 · lançada na primeira fatura"**, sem botão de pagar; alerta "Ativação pendente" só informa.
- Regras: licença semestral, teto 3%, mínimo US$ 100, Cent até 10k, exposição automática.
- Perfis: **Cent / Padrão / Padrão+** por saldo; todos os Cores em todos.
- Corretoras no wizard com tipo recomendado (Exness Standard Cent, XM Micro, RoboForex ProCent, Axi/Zero Padrão).
- Extrato: linha "Ativação" (licença) na primeira fatura.

## 5. Landing atual (`rdx_landing.html`)

- Título: **"Nada Antes De Usar. Depois, Só O Que Processou."**
- Card 1: **Ativação US$ 49 · licença semestral · cobrada na 1ª fatura após 30 dias de uso**; "a partir de $ 100"; botão "Conectar minha conta".
- Card 2: uso US$ 0,0167/MCP; "nunca acima de 3% do saldo médio".
- FAQ: "Quanto preciso ter para começar?" (US$ 100, Cent até 10k) e "O que pago e quando?".
- Sem menção à conexão (só contrato/fatura).

## 6. Funil e gancho (`rdx_funil_prototipo.html`) — base para o site do Yuri

- **Gancho** (depois das duas faixas de texto): bloco verde fluorescente com gradiente leve, ~210 px, texto preto **"COLOQUE SEUS DÓLARES PARA *TRABALHAR* HOJE."** e disco preto pulsante com seta/"COMEÇAR". O bloco inteiro é o botão → `/comecar`.
- **Funil** `/comecar`: trilha horizontal 1-2-3-4 (**Assista · Corretora · Conectar · Pronto**), "Pular para o cadastro →", uma ação por tela, "Ajuda" em cada passo → WhatsApp com contexto.
  1. Vídeo 90 s → Próximo.
  2. Corretora: 4 itens (cadastro Exness, documento, conta Standard Cent MT5, PIX mín. R$ 590) + número da conta/servidor.
  3. Conta RDX: nome, WhatsApp, e-mail, senha + 3 caixas + conexão MT5 (login/servidor vêm do passo 2).
  4. "Sua conta está no cluster" + Abrir painel + card do consultor no WhatsApp.
- **Binance fora do onboarding**: USDT só é necessário na 1ª fatura (dia 30); corretora aceita PIX.
- Vídeo: `RDX_roteiro_video_funil_passo1.md` (10 cenas, 88 s, sem rostos, sem promessa, sem defesa).

## 7. Agente de WhatsApp (`RDX_agente_whatsapp_spec.md` + `RDX_agente_whatsapp_system_prompt.md`)

- WhatsApp Cloud API oficial + n8n + Claude API com ferramentas + Chatwoot (fila humana) + Cal.com (agenda).
- 9 ferramentas do backend (lead, estado da conta, fatura, guia do passo, magic link, tag, agendar call, handoff, cadastro na corretora).
- Fluxos: boas-vindas, onboarding guiado, FAQ, **recuperação automática** (passo 1: 2 h; passo 2: 3 h/24 h; sem depósito: 24 h/72 h; check-in dia 7; aviso dia 25; cobrança), objeções.
- Regras: nunca cita rentabilidade; nunca pede senha no chat; nunca inventa estado; redireciona "dinheiro de terceiros".
- Humano só por regra (pediu 2×, golpe/advogado/Procon, objeção repetida, erro técnico 3×, capital ≥ 10k) e entra marcando **call**, não chat. Meta ≥ 85% sem humano. Custo ≈ US$ 100–120/mês para 500 leads.

## 8. Domínio

- Domínio escolhido: **rdxcore.com** (registrar junto rdxcore.com.br, rdxcores.com, rdxcore.io). Estrutura: `app.` painel · `admin.` · `api.` · `status.`.
- Login dos clientes do painel: Identity Platform / Firebase Auth (sem licença por usuário).

## 9. Arquivos no pacote

`frontend/`: rdx_landing.html · rdx_control_center.html · rdx_admin.html · rdx_funil_prototipo.html · imagens/logo · abrir_painel.bat · servidor_local.ps1
`docs/`: RDX_ESPECIFICACAO_TECNICA_BACKEND.md · RDX_como_funciona_conta_mestre.md · RDX_termos_de_uso.md/.docx · RDX_disclaimer_e_termo_de_risco.md/.docx · RDX_roteiro_video_funil_passo1.md · RDX_agente_whatsapp_spec.md · RDX_agente_whatsapp_system_prompt.md
`dados/`: rdx_ops_reais.json
