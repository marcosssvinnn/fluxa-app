-- ══════════════════════════════════════════════════════════════════════════════
--  OFICINA — Fase 11: custo do reparo — técnico + mão de obra (18/08)
--
--  Peça: o custo já congela sozinho no orçamento de conserto vinculado no
--  momento da aprovação (_congelarCustoOrc, mesmo mecanismo de qualquer
--  orçamento — Etapa 2.1 do roadmap antigo). Não precisa de coluna nova
--  aqui, só passou a ser EXIBIDO como margem na ficha do reparo.
--
--  Mão de obra: nada existia. tecnico_responsavel (texto, mesmo padrão de
--  ordens_servico.tecnico — não é FK, é o nome como já é usado no resto do
--  app) + horas_mao_obra (numeric, captura manual mas pré-sugerida a partir
--  do tempo em "em_reparo" no log de status, que já existe desde a Fase 2).
--
--  100% aditivo.
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE oficina_reparos ADD COLUMN IF NOT EXISTS tecnico_responsavel text;
ALTER TABLE oficina_reparos ADD COLUMN IF NOT EXISTS horas_mao_obra numeric;
