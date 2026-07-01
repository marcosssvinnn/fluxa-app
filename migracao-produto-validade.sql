-- ============================================================
-- Migração: lote e validade de produtos (para químicos, ex.: cloro)
-- O app já grava esses campos; sem as colunas eles ficam só no
-- localStorage (o dbUpsert descarta colunas inexistentes em silêncio).
--
-- Como rodar: Supabase → SQL Editor → cole tudo → Run. Seguro repetir.
-- ============================================================

ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS lote text;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS validade date;
