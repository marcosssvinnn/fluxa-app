-- ══════════════════════════════════════════════════════════════════════════
--  Assinatura digital do técnico na Vistoria (2026-08-24)
--  Confirma que o técnico realizou a vistoria no local — obrigatória para
--  finalizar (decisão do Marcos). Mesmo padrão já usado em
--  orcamentos.assinatura_* e oficina_reparos.termo_entrada_assinatura_* /
--  entrega_assinatura_* (base64/data/meta), aditivo, sem quebrar registro
--  antigo (os 3 campos ficam null em vistorias já salvas antes desta data).
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.vistorias ADD COLUMN IF NOT EXISTS assinatura_tecnico_base64 text;
ALTER TABLE public.vistorias ADD COLUMN IF NOT EXISTS assinatura_tecnico_data timestamptz;
ALTER TABLE public.vistorias ADD COLUMN IF NOT EXISTS assinatura_tecnico_meta text;
