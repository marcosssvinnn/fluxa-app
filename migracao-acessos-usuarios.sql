-- ════════════════════════════════════════════════════════════════════
--  MIGRAÇÃO: coluna `acessos` em usuarios (acessos a empresas separadas)
--  Rode no Supabase → SQL Editor → New query → cole tudo → Run.
--  Idempotente: pode rodar mais de uma vez.
--
--  Permite gerenciar pela tela Usuários quem acessa empresas separadas
--  (ex.: Aquamotor) — antes era uma lista fixa no código (acessoGrupo).
--  Enquanto esta migração não rodar, a lista fixa continua valendo.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS acessos jsonb DEFAULT '[]';

-- Reflete a regra atual: Marcos e Tamara (gestão) + Bruno (técnico) na Aquamotor
UPDATE usuarios SET acessos='["aquamotor"]'::jsonb
 WHERE ativo=true AND nome IN ('Marcos','Tamara','Bruno');
