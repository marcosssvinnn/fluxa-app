-- ══════════════════════════════════════════════════════════════════════════════
--  Tarefa 4 (design_handoff_fluxa_redesign, PLANO-ACABAMENTO.md) — migração
--  retroativa de "A Receber" (18/08/2026, decisão do Marcos: opção (a),
--  recomendada pelo próprio plano).
--
--  Problema: o número de "A Receber" tinha 2 fontes — orcamentos.valor_recebido
--  (sistema antigo, sem parcela/vencimento) e a tabela recebimentos (sistema
--  novo, usado só a partir da aprovação — Fase 1 do roadmap de indicadores).
--  103 orçamentos aprovados nunca tiveram nenhuma linha em recebimentos.
--
--  Esta migração cria 1 parcela à vista por orçamento (vencimento = data de
--  aprovação), preservando o saldo em aberto ATUAL:
--    - 60 orçamentos com saldo aberto (total > valor_recebido) ganham parcela
--      ABERTA no valor do saldo (total - valor_recebido) — não o total bruto,
--      pra não fingir que nada foi recebido quando parte já foi.
--    - 43 já quitados (valor_recebido >= total) ganham parcela JÁ PAGA, com
--      data_pagamento = data de aprovação (melhor data disponível) — sem isso,
--      assim que o código parar de ler valor_recebido (próximo commit, feito
--      só depois de conferir esta migração em produção), esses 43 apareceriam
--      como "nunca recebido".
--    - 5 orçamentos que já tinham linha em recebimentos ficam de fora — não
--      duplica.
--
--  id = 'rec_migr_<orcamento_id>' de propósito (não o padrão 'rec_'+timestamp+
--  random do app) — torna a migração IDEMPOTENTE: rodar 2x por engano falha
--  na PK duplicada em vez de duplicar a parcela em silêncio.
--
--  Rodada via Management API, dry-run em SELECT antes (visto: 8 amostras
--  batendo o valor esperado), depois o INSERT abaixo. Conferido depois:
--  103 linhas inseridas, soma das ABERTAS batendo com os R$ 139.458,86 que
--  a tela "A Receber" já mostrava ANTES da migração (mesmo saldo, fonte nova).
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO recebimentos (id, orcamento_id, loja_id, parcela_n, parcelas_total, vencimento, valor, data_pagamento, forma, obs, origem, data_criacao)
SELECT
  'rec_migr_' || o.id::text,
  o.id,
  o.loja_id,
  1,
  1,
  o.data_aprovacao::date,
  CASE WHEN COALESCE(o.valor_recebido,0) >= COALESCE(o.total,0) THEN o.total ELSE (o.total - COALESCE(o.valor_recebido,0)) END,
  CASE WHEN COALESCE(o.valor_recebido,0) >= COALESCE(o.total,0) THEN o.data_aprovacao::date ELSE NULL END,
  NULL,
  'Migração retroativa 18/08/2026 — saldo herdado de orcamentos.valor_recebido',
  'migracao_retroativa_2026_08_18',
  now()
FROM orcamentos o
WHERE o.status = 'aprovado'
  AND COALESCE(o.total,0) > 0
  AND NOT EXISTS (SELECT 1 FROM recebimentos r WHERE r.orcamento_id = o.id);
