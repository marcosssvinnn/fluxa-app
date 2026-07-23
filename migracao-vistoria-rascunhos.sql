-- ════════════════════════════════════════════════════════════════════
--  MIGRAÇÃO: tabela vistoria_rascunhos (backup na nuvem da vistoria em campo)
--  Rode no Supabase → SQL Editor → New query → cole tudo → Run. Idempotente.
--
--  Enquanto o técnico preenche, o progresso sobe para o servidor a cada
--  poucos segundos. Se o celular morrer/perder/limpar dados, restaura —
--  inclusive logando em OUTRO aparelho. Limpo automaticamente ao finalizar.
--  Enquanto esta migração não rodar, o backup fica só no aparelho (local).
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vistoria_rascunhos (
  id text PRIMARY KEY,
  usuario text,
  dados jsonb,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE vistoria_rascunhos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon full access" ON vistoria_rascunhos;
CREATE POLICY "anon full access" ON vistoria_rascunhos FOR ALL TO anon USING (true) WITH CHECK (true);
