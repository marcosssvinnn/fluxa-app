-- ════════════════════════════════════════════════════════════════════
--  MIGRAÇÃO: tabela dedicada locais_vistoria
--  Rode no Supabase → SQL Editor → New query → cole tudo → Run.
--  É idempotente: pode rodar mais de uma vez sem problema.
--
--  Por quê: antes os planos de vistoria ficavam num array dentro de
--  empresa_config.dados. Salvar reescrevia o blob inteiro, então dois
--  gestores salvando ao mesmo tempo sobrescreviam um ao outro (locais
--  "sumiam"). Agora cada local é sua própria linha. O app detecta a
--  tabela automaticamente e migra os locais existentes sozinho.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS locais_vistoria (
  id text PRIMARY KEY,
  loja_id text,
  cliente text, local text,
  email_responsavel text, tecnico text,
  dia_pref text, hora_pref text,
  equipamentos jsonb DEFAULT '[]',
  agendamento_id text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_locais_loja ON locais_vistoria(loja_id);

-- RLS: acesso pela anon key (igual ao resto do app; controle real é no app via perfil/PIN)
ALTER TABLE locais_vistoria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon full access" ON locais_vistoria;
CREATE POLICY "anon full access" ON locais_vistoria FOR ALL TO anon USING (true) WITH CHECK (true);

-- Realtime (sync entre dispositivos)
DO $$
BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE locais_vistoria';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
