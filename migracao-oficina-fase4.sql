-- ══════════════════════════════════════════════════════════════════════════════
--  OFICINA — Fase 4: garantia de fabricante (rastreio) + retrabalho (17/08)
--
--  Garantia de fabricante: decisão do Marcos é só RASTREAR por enquanto —
--  sem cobrança/recebimento formal do fabricante ainda — por isso são
--  campos de texto livre, não uma tabela de faturamento/contas a receber.
--
--  Garantia própria da oficina (retrabalho): distinta da de fabricante —
--  é o compromisso da PRÓPRIA oficina com o serviço que ela mesma fez.
--  retrabalho_de é self-FK (aponta pro reparo original quando este é o
--  retorno do mesmo defeito) — vira a base da taxa de retrabalho, métrica
--  de qualidade (Fase 5).
--
--  100% aditivo.
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE oficina_reparos ADD COLUMN IF NOT EXISTS fabricante           text;
ALTER TABLE oficina_reparos ADD COLUMN IF NOT EXISTS fabricante_protocolo text; -- nº de protocolo/RMA com o fabricante, se houver
ALTER TABLE oficina_reparos ADD COLUMN IF NOT EXISTS fabricante_nf        text; -- referência de NF de compra original, se o cliente trouxer

ALTER TABLE oficina_reparos ADD COLUMN IF NOT EXISTS retrabalho_de               text; -- self-FK: id do reparo original
ALTER TABLE oficina_reparos ADD COLUMN IF NOT EXISTS garantia_propria_meses      integer DEFAULT 3;
ALTER TABLE oficina_reparos ADD COLUMN IF NOT EXISTS garantia_propria_vencimento date;

CREATE INDEX IF NOT EXISTS idx_oficina_retrabalho ON oficina_reparos(retrabalho_de) WHERE retrabalho_de IS NOT NULL;
