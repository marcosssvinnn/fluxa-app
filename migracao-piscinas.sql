-- ══════════════════════════════════════════════════════════════════════════════
--  PISCINAS — Etapa 5 do roadmap de CRM (2026-08-12)
--
--  Volume da piscina não era capturado em lugar nenhum — é o número que
--  destrava dosagem, dimensionamento, preço e consumo teórico das próximas
--  etapas. Entidade própria (não campo achatado em clientes) porque um
--  condomínio pode ter mais de uma piscina, com volumes e tratamentos
--  diferentes (adulto/infantil, torres com piscina própria) — achado
--  confirmado na auditoria (docs/etapa5-ficha-tecnica-piscina-auditoria-2026-08-12.md).
--
--  `equipamentos` estava zerado na auditoria (0 registros) — nasce já
--  correto, sem migração de dado real pra preservar.
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS piscinas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id text,           -- mesmo padrão de clientes.id em outras tabelas: text, não uuid
                              -- (cliente local ainda não sincronizado tem id 'cli_<timestamp>')
  local_id text,              -- opcional: liga a locais_vistoria quando existe plano de vistoria
  nome text,                  -- ex: "Piscina Adulto" — opcional, "Piscina principal" por padrão na UI
  volume_m3 numeric(10,2),
  tipo_tratamento text,
  loja_id text,
  ativo boolean DEFAULT true,
  data_criacao timestamptz DEFAULT now()
);

ALTER TABLE piscinas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon full access" ON piscinas;
CREATE POLICY "anon full access" ON piscinas FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_piscinas_cliente ON piscinas(cliente_id);

-- equipamentos ganha vínculo opcional com a piscina específica dentro do
-- condomínio/casa do cliente (equipamentos.cliente_id já existe, este é o
-- nível abaixo — "qual piscina", não só "qual cliente").
ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS piscina_id text;
CREATE INDEX IF NOT EXISTS idx_equipamentos_piscina ON equipamentos(piscina_id);
