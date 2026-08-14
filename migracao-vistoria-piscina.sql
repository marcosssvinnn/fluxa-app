-- ══════════════════════════════════════════════════════════════════════════════
--  VISTORIA → PISCINA — Etapa 5, pendência final (2026-08-14)
--
--  Recomendação da auditoria (docs/etapa5-ficha-tecnica-piscina-auditoria-
--  2026-08-12.md, §3, opção c2): ligar a vistoria à piscina permite saber
--  DE QUAL piscina do cliente aquela vistoria específica trata (relevante
--  pra condomínio com piscina adulto + infantil, volumes/dosagem diferentes).
--
--  Escopo desta migração — deliberadamente pequeno, igual ao registrado no
--  §4 do doc: só a referência (piscina_id). NÃO inclui a reescrita maior de
--  puxar equipamentos de `equipamentos` filtrados por piscina em vez do
--  jsonb duplicado de `locais_vistoria.equipamentos`/`vistorias.equipamentos`
--  — o próprio doc já registrava isso como "mudança de fluxo maior, pode
--  ficar pra uma etapa seguinte".
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE vistorias ADD COLUMN IF NOT EXISTS piscina_id text;

-- Já aplicada em produção (2026-08-14, via Management API, verificado com
-- leitura de information_schema.columns antes e depois). Arquivo fica como
-- registro histórico — rodar de novo é seguro (IF NOT EXISTS).
