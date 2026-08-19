-- ══════════════════════════════════════════════════════════════════════════════
--  OFICINA — Tarefa 3h.5: entrega com os 4 requisitos (19/08)
--
--  Os quatro requisitos do FLUXO-OFICINA.md ("nada sai da loja sem os
--  quatro"): foto do equipamento pronto, termo de garantia (com o que foi
--  feito), pagamento na retirada, assinatura de quem retirou. A assinatura em
--  si já tinha coluna (Fase 1c, entrega_assinatura_*) — faltavam as outras
--  três peças de dado.
--
--  100% aditivo.
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE oficina_reparos ADD COLUMN IF NOT EXISTS fotos_pronto jsonb DEFAULT '[]';
ALTER TABLE oficina_reparos ADD COLUMN IF NOT EXISTS o_que_foi_feito text;
ALTER TABLE oficina_reparos ADD COLUMN IF NOT EXISTS entrega_forma_pagamento text;
ALTER TABLE oficina_reparos ADD COLUMN IF NOT EXISTS entrega_retirado_por text;
