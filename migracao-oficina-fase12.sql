-- ══════════════════════════════════════════════════════════════════════════════
--  OFICINA — Fase 12: serviço terceirizado (18/08)
--
--  Rebobinamento/usinagem/retífica é rotina pra equipamento de piscina.
--  Enquanto o equipamento está fora, esse tempo não é nosso — hoje contava
--  igual, poluindo tempo médio de reparo e o alerta de "travado".
--
--  Decisão: flag ORTOGONAL ao status, não um status novo na sequência — o
--  reparo continua no status que já estava (em_reparo/aguardando_peca) por
--  dentro; só ganha uma janela desde/até que as métricas descontam. V1
--  suporta 1 ida-e-volta por reparo (enviar de novo sobrescreve a janela
--  anterior) — raro precisar de 2 no mesmo reparo, YAGNI até virar
--  necessidade real.
--
--  100% aditivo.
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE oficina_reparos ADD COLUMN IF NOT EXISTS terceirizado_prestador text;
ALTER TABLE oficina_reparos ADD COLUMN IF NOT EXISTS terceirizado_desde     timestamptz;
ALTER TABLE oficina_reparos ADD COLUMN IF NOT EXISTS terceirizado_ate       timestamptz;
