# CRM com insights — plano adaptado ao Fluxa v1 (produção Forthemp)

> **Por que este documento existe.** Um plano de "Insights de IA no CRM" foi
> escrito em outra sessão, mas ele descreve o **Fluxa v2**
> (`~/Documents/fluxa`, branch `dev`, Supabase `auoklaiffalbdgazrbdu`) — que tem
> `page-crm`, tabela `insights`, colunas `crm_*`, RLS multi-tenant e Edge
> Functions. **Nada disso existe neste repositório.** Este documento traduz
> aquele plano para o v1 (`fluxa-app`, `main`, Supabase `lbxwclwzeqqtnwvlxsxs`),
> que é onde estão os dados e o dinheiro reais.
>
> ⚠️ **Não aplicar `setup-v2-delta27.sql` neste banco.** Ele referencia
> `empresa_id`, `cliente_id`, `etapa_desde` e a tabela `insights` — nenhum
> existe aqui. Quebra na hora.

Levantamento feito em 2026-08-06 contra o banco de produção.

---

## 1. Mapa de tradução v2 → v1

| Conceito no plano v2 | Equivalente no v1 | Consequência |
|---|---|---|
| `empresa_id` (uuid) | `loja_id` (text) | filtros mudam de tipo |
| `minhas_empresas()` (RLS) | `escopoEmpresaMatch()` / `filtrarPorLoja()` no JS | **isolamento é no cliente, não no banco** |
| `orcamentos.cliente_id` | ❌ não existe — só `cliente` (texto) | join por nome normalizado |
| tabela `insights` | ❌ não existe | ver decisão §2 |
| `etapa_desde`, `crm_*`, `proximo_contato`, `motivo_perda` | ❌ não existem | criar (§5), aditivo |
| `flagAtiva('insights_ia')` | ❌ não existe | usar `eGestor()` + config |
| Edge Function + `pg_cron` | ❌ sem pasta `supabase/` | ver decisão §2 |
| RLS `service_role` escreve, cliente lê | RLS é `anon full access` | **não há essa garantia aqui** |

### O que isso significa para segurança

No v2, a policy garante que o vendedor não altera o texto do insight. **No v1
isso é impossível de garantir** — a policy é `anon full access` e a anon key
está no código-fonte de um repo público. Qualquer proteção aqui é de UI, não de
servidor. Não vale construir cerimônia (RPC `insight_marcar`, grants) que não
protege nada neste ambiente.

O que **continua valendo integralmente**: chave de API de IA nunca no
`app.js`. Essa regra não é sobre RLS, é sobre o repo ser público.

---

## 2. Decisão de arquitetura: sem IA e sem backend na primeira volta

O plano v2 assume pré-cálculo noturno (Edge Function + cron + LLM). Para o v1 a
recomendação é **inverter a ordem**: gatilhos determinísticos em JS puro,
rodando sobre os dados que o app **já tem em memória**.

Motivos:

1. **O app é local-first.** `todosOrc` já está carregado. Calcular os gatilhos é
   varrer um array — instantâneo, offline, custo zero.
2. **Insight aqui é função pura dos dados.** Sem LLM, não há texto a persistir:
   recalcula na hora e está sempre atualizado. Isso **elimina de saída** o
   problema de `expira_em` ("parado há 20 dias" que vira mentira) e o de
   idempotência (índice único parcial) — os dois existem no v2 só porque lá o
   texto é gerado de madrugada e guardado.
3. **Não existe `supabase/` neste repo.** Edge Function significa instalar CLI,
   configurar deploy e manter infra nova, antes de saber se os gatilhos prestam.
4. **90% do valor está nos fatos, não na redação.** O que torna a sugestão útil
   é *"esse cliente já comprou o trocador"*, não a beleza da frase.

**A camada de IA continua no plano** — mas como §7, depois que os gatilhos
estiverem provados em uso real.

O que **se aproveita integralmente** do plano v2:

- ✅ Regra determinística dispara, IA só veste (aqui: template veste)
- ✅ Guardar os `fatos` que originaram a sugestão (auditabilidade)
- ✅ Feedback útil/inútil para podar gatilho que só faz barulho
- ✅ Ponto de parada: conferir a lista **antes** de construir tela por cima
- ✅ Chave de IA só no servidor

---

## 3. O bloqueador que precisa cair primeiro

**O gatilho principal do plano v2 (`parado`) filtra `status = 'pendente'`.
Na base real da Fortemp isso são 8 registros de 272.**

| Status | Qtd |
|---|---|
| vencido | **163** |
| aprovado | 86 |
| recusado | 15 |
| **pendente** | **8** |

Causa: o select de validade (`index.html`, campo `#val`) só oferece **3, 5, 7 ou
15 dias**, com **5 como padrão** — e `app.js` marca `vencido` automaticamente
quando a data passa. Todo orçamento nasce e morre em uma semana.

Efeito no negócio, medido:

| Faixa | Qtd | Conversão |
|---|---|---|
| < R$ 15k (decisão rápida) | 208 | **39,4%** |
| R$ 15k – 50k | 50 | **8,0%** |
| ≥ R$ 50k (assembleia/investimento) | 13 | **0,0%** |

E não é característica de condomínio — pessoa física acima de R$ 15k converte
8,1%, praticamente igual aos 7,7% do condomínio. **É o valor que alonga o
ciclo**, não o tipo de cliente. Uma validade de 5 dias é incompatível com
qualquer decisão acima de R$ 15k.

**Sem corrigir isto, qualquer CRM inteligente lê 3% da base.**

---

## 4. Fases

### Fase 0 — Validade proporcional ao valor  ✅ CONCLUÍDA (commit `b2df8c0`)

> Implementada em 2026-08-06. O corte final ficou **trilho OU valor**
> (`orcCicloLongo`), não só valor: a linha de base mostrou que equipamento
> converte ~8% em todas as faixas, inclusive abaixo de R$ 15k. Com isso,
> 5 dos 8 pendentes reais sobreviveram (R$ 130.598), incluindo dois que a
> regra só-por-valor teria matado (Andresa R$ 9.871 e Julio Cesar R$ 13.127).
> A decisão do PDF seguiu a recomendação: `validade_data` **não mudou**, então
> o documento do cliente continua igual — mudou só a vida interna no funil.
> Linha de base em `docs/crm-baseline-2026-08-06.md`.

Especificação original abaixo, mantida como referência:

- Ampliar `#val` para incluir 30/45/60/90 dias.
- Sugerir automaticamente pela faixa ao calcular o total (editável sempre):
  | Faixa | Sugestão |
  |---|---|
  | < R$ 15k | 15 dias |
  | R$ 15k – 50k | 45 dias |
  | ≥ R$ 50k | 90 dias |
- Não marcar `vencido` automático acima de R$ 15k — em vez disso, sinalizar
  "preço a revalidar", mantendo o orçamento **vivo no funil**.

> ⚠️ Muda o texto "Válido até …" no PDF que o cliente recebe. Decisão do Marcos
> pendente: pode variar conforme o valor, ou mantém o texto e muda só o
> comportamento interno?

**Urgência real:** Platinum Residence (R$ 83.497 e R$ 65.035) e Infinity Flat
(R$ 59.826) — **R$ 208 mil** — vencem/venceram nesta semana por essa regra.

### Fase 1 + 2 — Gatilhos + painel de insights  ✅ CONCLUÍDAS (commit `3c796d7`)

> Implementadas juntas em 2026-08-06, como `page-insights`, landing do
> gestor/master. `crmCandidatos()` roda sobre `todosOrc` em memória (não
> `todosOS`/`vistorias` — cross-módulo continua bloqueado pela limitação de
> identidade do §8), escopado por `filtrarPorLoja()`.
>
> Retorna `{equipamento, servico}` **já separados em dois trilhos**, não uma
> lista única com `gatilho` — a prévia (`crm-fila-followup-previa.md`) mostrou
> 11 dos 12 primeiros sendo do trilho equipamento (7% de conversão); fila
> única ordenada por valor deixaria o vendedor sem tocar no trilho de 43%.
> Score: `(valor/1000) × (3 se já é cliente, senão 1) ÷ dias_parado`.
>
> **Filtro negativo implementado e testado**: quem já comprou equipamento não
> recebe nova oferta do mesmo trilho — validado contra o caso real (Ibiza
> Towers, R$ 169.210 corretamente suprimido).
>
> Feedback em `localStorage` (`fluxa_crm_feedback`, sem schema): dispensou a
> mesma sugestão 3× → some da fila para sempre; "📞 Liguei" → some por 3 dias.
> Cada card mostra o motivo (constrói repertório) e uma frase pronta para
> abrir a ligação — decisão de produto por causa do público (técnicos que
> também orçam, não vendedores profissionais).
>
> Teto de 8 cards por trilho na tela (150 sugestões = nenhuma sugestão).

### Fase 3 — Persistir a interação  ✅ CONCLUÍDA (commit `ea91f39`)

> Migração aplicada no Supabase em 2026-08-06 (aditiva, tudo nullable):
> `proximo_contato date`, `decisao_prevista date`, `motivo_perda text`,
> `crm_notas jsonb`. Não foram criadas `crm_situacao`, `etapa_desde` nem
> `preco_revalidar`: a primeira dá para derivar, a segunda só faz sentido com
> estágios formais de funil (que ainda não existem) e a terceira já é
> calculada por `orcPrecoARevalidar()` — persistir seria duplicar a verdade.
>
> Modal `abrirCrmContato()` com 4 desfechos e campos condicionais. Regra de
> precedência importante: **assembleia a ≤7 dias fura o silêncio** do
> `proximo_contato`. Sem isso, agendar o retorno para depois da reunião
> escondia justamente a janela em que dá para influenciar o resultado.
>
> Grava via `dbUpdate` (wrapper resiliente) e local-first: o registro entra em
> memória e no localStorage antes de tentar a rede.

### Fase 4 — Camada de IA  🟡 PARCIAL — dossiê entregue sem IA (commit `c9d7044`)

> O **dossiê de assembleia já funciona**, com texto determinístico
> (`_DOSSIE_CONSEQ`): roda offline, custo zero, sem chave de API. A camada de
> IA (redação adaptada) segue pendente, travada por chave de API + Edge
> Function + deploy — nada disso é código. Detalhe em `docs/crm-camada-ia.md`.

§7.

---

## 5. Schema mínimo (Fase 3 — aditivo, não aplicar antes)

Não replicar as 10 colunas de `insights` do v2: sem LLM não há texto a guardar.
O que precisa persistir é a **interação humana**.

```sql
-- Todas NULLABLE. Nada é removido/renomeado; código atual roda igual (rollback).
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS proximo_contato       date;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS decisao_prevista      date;   -- assembleia/reunião
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS crm_situacao          text;   -- aguardando|concorrencia|negociando
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS motivo_perda          text;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS crm_notas             jsonb DEFAULT '[]';
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS etapa_desde           timestamptz;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS preco_revalidar       boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_orc_loja_prox    ON orcamentos (loja_id, proximo_contato)  WHERE proximo_contato IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orc_loja_decisao ON orcamentos (loja_id, decisao_prevista) WHERE decisao_prevista IS NOT NULL;
```

**Regra de ouro do projeto:** gravar sempre via `dbInsert`/`dbUpdate` — se a
coluna faltar, o wrapper remove e reenvia em vez de o registro parar de
sincronizar em silêncio. E `etapa_desde` será NULL em todo registro antigo:
usar sempre `COALESCE(etapa_desde, data_criacao)` (lição aproveitada do v2).

---

## 6. Os gatilhos — adaptados à Forthemp

Os 5 gatilhos do plano v2 são CRM genérico. Abaixo, o conjunto calibrado com os
dados reais desta base.

### 6.1 Ajustes nos gatilhos herdados

| Gatilho v2 | Problema medido no v1 | Adaptação |
|---|---|---|
| `parado` (status pendente) | só 8 registros | ler pendente **+ vencido não-recusado** (após Fase 0) |
| `valor_atipico` (≥1,8× ticket) | ticket aprovado = **R$ 2.269** → limiar **R$ 4.084**; disparia em **todo** trocador | comparar dentro da **mesma categoria** (serviço vs equipamento) |
| `recorrente_sumido` (join `cliente_id`) | não existe `cliente_id` | casar por nome normalizado (limitação §8) |
| `followup_atrasado` | ok | mantém — maior prioridade (compromisso vencido) |
| `assembleia` | ok, mas nem todo negócio tem | mantém **opcional**; nunca premissa |

### 6.2 Gatilhos novos, específicos do negócio

Estes são os que valem dinheiro aqui e não existem no plano v2.

**A) `ja_comprou_equipamento` — o mais importante**

O trocador é **venda única por condomínio** (regra de negócio confirmada pelo
Marcos). Medido: **Ibiza Towers comprou o trocador em 02/05 (R$ 29.885) e
recebeu 5 ofertas de trocador depois disso.** 16 clientes receberam 2+
orçamentos de trocador.

- Detecção: orçamento **aprovado** cujo `servicos` casa
  `/trocador|aquecedor|bomba de calor|fromtherm|jelly/i`, por cliente.
- Efeito: **suprime** qualquer sugestão de reofertar equipamento; troca por
  pós-venda (manutenção, peça, contrato).
- É filtro **negativo** — a inteligência aqui é calar a boca na hora certa.

**B) `trilho` — separar serviço de equipamento**

| Trilho | Qtd | Ticket médio | Conversão | Em aberto |
|---|---|---|---|---|
| Equipamento (trocador/aquecimento) | 85 | R$ 28.146 | **7,1%** | **R$ 1.960.332** |
| Serviço | 186 | R$ 2.267 | **43,0%** | R$ 319.963 |

**86% do valor em aberto é um produto só.** Fila única ordenada por valor vira
100% trocador e o vendedor gasta o dia em negócios de 7%. Os dois trilhos são
listas separadas, com cadência e meta próprias.

**C) `cliente_vs_prospect`**

| | Clientes | Orç. abertos | Valor |
|---|---|---|---|
| Já fechou antes | 14 | 19 | R$ 239.427 |
| Nunca fechou | 114 | 151 | R$ 2.040.871 |

Os 19 de quem já é cliente valem muito mais tempo de telefone que os 151 frios.
É o melhor gatilho de priorização disponível hoje sem schema novo.

**D) `base_instalada` — a oportunidade parada**

Quem comprou trocador vira cliente de manutenção recorrente — e serviço converte
43%. Caso vivo: **Infinity Coast Tower tem 4 trocadores, todos com defeito
apontado na vistoria de 05/08** (o #1 com vazamento e painel morto; #2 e #3 com
rolamento; Jelly Fish com desgaste). Nenhum virou orçamento.

Depende de cruzar vistoria↔orçamento — ver limitação §8.

**E) `janela_temporada`**

Piscina em Balneário Camboriú/Itapema tem pico no verão (dez–mar). Curva medida:

| Mês | Emitidos | Conversão |
|---|---|---|
| abr | 48 | 16,7% |
| mai | 58 | 25,9% |
| jun | 62 | 33,9% |
| **jul** | **91** | **40,7%** |

Obra grande precisa ser aprovada até ~outubro para entregar antes da temporada.
Gatilho sazonal: entre agosto e outubro, orçamento de equipamento ganha
prioridade e argumento datado.

### 6.3 Anti-chatice (requisito explícito do Marcos)

1. **Nunca bloquear** — nada de modal exigindo resposta; card dispensável.
2. **Só falar quando importa** — silêncio abaixo de R$ 15k.
3. **1 toque, nunca digitação** — e **"Não sei"** é resposta legítima
   (o Marcos foi explícito: nem sempre dá para saber se haverá assembleia).
4. **Aprender do silêncio** — ignorou 3×, para de sugerir aquilo.
5. **Teto na tela** — top-N por dia. 150 sugestões = nenhuma sugestão.
   (O plano v2 dimensiona a quota da API mas não põe teto na tela.)

---

## 8. Limitação conhecida: identidade do cliente

`orcamentos.cliente` é **texto livre**; não há `cliente_id`. Medido:

- 214 clientes distintos em orçamentos vs **141 cadastrados** → ~73 sem ficha
- `clientes.tipo` (Residência/Condomínio/…) está documentado no CLAUDE.md mas
  **não existe no banco** — vinha sendo descartado em silêncio no insert
- Dos 14 planos de vistoria ativos, **13 são da Aquamotor**; só Infinity Coast
  Tower é Fortemp
- Casamento de nome entre `locais_vistoria` e `orcamentos`: **match exato zero
  em 13 dos 14**

**Funciona hoje** (dentro de `orcamentos`): valor, faixa, trilho, histórico de
compra, já-comprou-equipamento, dias parado, sazonalidade.

**Não funciona** até consolidar identidade: qualquer gatilho que cruze módulos —
inclusive o `base_instalada` (D), que é dos melhores. Consolidação recomendada
**depois** das fases 0–2, não antes.

---

## 7. Camada de IA (Fase 4, opcional)

Se depois de usar as fases 1–3 a redação automática fizer falta, aí sim vale a
arquitetura do plano v2:

- Edge Function guardando `GROQ_API_KEY` (Groq free tier, `llama-3.3-70b`);
  **nunca** no `app.js` — o repo é público.
- Pré-cálculo, nunca chamada ao vivo (latência, quota, offline).
- Modelo **veste** os fatos; proibido inferir. Guardar `fatos` para auditar.
- Rejeitar resposta vazia, >400 caracteres, ou que cite número fora dos `fatos`.

**Melhor caso de uso identificado, e vale mais que o resto:** transformar o
relatório de vistoria em **material de assembleia** — pegar os 13 itens do
Infinity Coast Tower e gerar um resumo executivo de 1 página para o síndico
defender na reunião. Ataca direto os 0% de conversão acima de R$ 50k, e é
redação real (que é onde LLM ganha de template).

**LGPD:** decisão do Marcos (2026-08-06) de não anonimizar por ora — software
interno. Registrado. Gatilho de reavaliação: quando houver empresa pagante que
não seja dele. Mitigação é barata (código no lugar do nome no payload).

---

## Ordem de execução

1. **Fase 0** (validade por faixa) — pequena, sem schema, destrava tudo e tem
   R$ 208k vencendo agora. Decisão pendente do Marcos: prazos e texto do PDF.
2. **Fase 1** (gatilhos em JS) — e então **🛑 ponto de parada**: rodar a lista e
   mostrar ao Marcos. Se um vendedor não olhar e disser *"é, eu ligaria pra
   esses"*, o problema está nos gatilhos ou nos dados — e nenhuma tela ou texto
   gerado conserta isso. Ajustar limiar aqui é barato; depois de pronto, não é.
   *(Este passo é herdado do plano v2 e é o melhor que ele tem.)*
3. **Fase 2** (tela) — só depois do aceite da lista.
4. **Fase 3** (schema) — só quando a interação começar a ser registrada de fato.
5. **Consolidação de identidade do cliente** — destrava os gatilhos cross-módulo.
6. **Fase 4** (IA) — se fizer falta.

Antes de cada merge: checklist do CLAUDE.md (schema real, ciclo de vida,
persistência dupla, sem falha silenciosa, multi-loja, perfis, mobile+desktop,
PDF/print, sintaxe) e **subir `CACHE` em `sw.js`**.

---

## O que NÃO fazer

- ❌ Aplicar `setup-v2-delta27.sql` neste banco — quebra.
- ❌ Construir Edge Function antes de os gatilhos estarem provados.
- ❌ Chave de IA no `app.js` — repo público.
- ❌ Fila única ordenada por valor — vira 100% trocador (7% de conversão).
- ❌ Oferecer trocador a quem já comprou (acontece hoje: Ibiza, 5×).
- ❌ Copiar `expira_em`/índice único do v2 na fase sem IA — resolvem um problema
  que só existe quando há texto pré-gerado.
- ❌ Pular o ponto de parada (passo 2).
