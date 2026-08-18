-- ══════════════════════════════════════════════════════════════════════════════
--  OFICINA — Fase 2: estados e quadro visual (17/08)
--
--  Log de transição de status — sem ele, a Fase 5 ("tempo médio POR
--  status", "quanto tempo fica parado em aguardando peça") não tem dado
--  histórico pra calcular retroativamente; só o ciclo total
--  (data_entrega − data_criacao) já dá pra calcular sem isso, que é bem
--  menos acionável pra achar o gargalo.
--
--  Estados (oficina_reparos.status, controlados só no JS, mesmo padrão de
--  orcamentos.status): recebido → diagnostico → aguardando_aprovacao →
--  aguardando_peca → em_reparo → pronto → entregue, com cancelado como
--  saída lateral em qualquer ponto. aguardando_peca é opcional (pode pular
--  direto pra em_reparo/pronto quando não precisa de peça).
--
--  100% aditivo.
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS oficina_status_log (
  id         text PRIMARY KEY,      -- 'ofl_<timestamp>_<rand>'
  reparo_id  text NOT NULL,
  status     text NOT NULL,
  usuario    text,
  data       timestamptz DEFAULT now()
);

ALTER TABLE oficina_status_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon full access" ON oficina_status_log;
CREATE POLICY "anon full access" ON oficina_status_log FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_oficina_log_reparo ON oficina_status_log(reparo_id, data);
