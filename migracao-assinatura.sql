-- ============================================================
-- Migração: valor probatório da assinatura de orçamentos
-- Guarda, no momento em que o cliente assina:
--   assinatura_data → quando assinou (timestamp)
--   assinatura_hash → "impressão digital" SHA-256 do conteúdo assinado
--                     (número, cliente, itens, total, desconto, validade)
--   assinatura_meta → dispositivo/navegador que assinou
--
-- Com isso, se o orçamento for alterado depois da assinatura, o hash
-- recalculado deixa de bater — evidência de adulteração. O app já grava
-- esses campos; sem estas colunas eles são descartados silenciosamente.
--
-- Como rodar: Supabase → SQL Editor → cole tudo → Run. Seguro repetir.
-- ============================================================

ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS assinatura_data timestamptz;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS assinatura_hash text;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS assinatura_meta text;
