-- ══════════════════════════════════════════════════════════════════════════════
--  FATORES DE CONSUMO DA PISCINA — extensão da Etapa 4 (2026-08-13)
--
--  Campos de maior retorno preditivo segundo a referência de consumo
--  químico (docs/referencia-consumo-quimico-piscinas-2026-08-12.md,
--  seção 7.2), na ordem de prioridade que o documento recomenda. Cada um
--  vira um coeficiente sobre a demanda diária de sanitizante (`d`) usada
--  em consumoTeoricoDias()/demandaDiaria() no app.js.
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE piscinas ADD COLUMN IF NOT EXISTS capa_termica boolean DEFAULT false;
ALTER TABLE piscinas ADD COLUMN IF NOT EXISTS exposicao_solar text DEFAULT 'pleno';   -- 'pleno' | 'parcial'
ALTER TABLE piscinas ADD COLUMN IF NOT EXISTS aquecida boolean DEFAULT false;
ALTER TABLE piscinas ADD COLUMN IF NOT EXISTS tipo_uso text DEFAULT 'residencial';    -- 'residencial' | 'condominio'
ALTER TABLE piscinas ADD COLUMN IF NOT EXISTS banhistas_dia integer;                  -- só relevante se tipo_uso='condominio'
ALTER TABLE piscinas ADD COLUMN IF NOT EXISTS estabilizante boolean DEFAULT true;
