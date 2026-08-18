-- ══════════════════════════════════════════════════════════════════════════════
--  OFICINA — Fase 1: recepção e ficha de entrada (17/08)
--
--  Expansão de negócio: além da manutenção de campo, a empresa vai abrir uma
--  bancada de reparo. Cliente traz equipamento (ou é garantia de fabricante,
--  ou vem de uma OS de campo já aprovada) → recepção registra o estado de
--  chegada → diagnóstico → orçamento de conserto → aprovação → reparo →
--  entrega. Pesquisa de mercado + mapeamento do código existente feitos numa
--  sessão anterior (artefato "Módulo de Oficina").
--
--  Tabela NOVA, separada de `ordens_servico` (decisão do Marcos) — a OS de
--  campo tem check-in/check-out por GPS de visita agendada; a oficina tem
--  estados de bancada (recebido → diagnóstico → ... → entregue) que não
--  fazem sentido pra OS de campo e a poluiriam.
--
--  `id text PRIMARY KEY` (prefixo 'ofr_<timestamp>', app-gerado) — mesmo
--  padrão de `fornecedores`/`ordens_compra` (ver migracao-compras.sql), não
--  o padrão de `id uuid` server-gerado de `orcamentos`/`equipamentos`: local-
--  first sem precisar reconciliar id temporário → id real depois do sync.
--
--  Todas as referências (cliente_id, equipamento_id, os_campo_id) são TEXT,
--  nunca uuid — mesmo motivo já documentado em despesas/equipamentos/
--  vendas_balcao: um cliente ou equipamento criado offline tem id tipo
--  'cli_1699...'/'eq_1699...', uma coluna uuid rejeitaria esse insert (22P02).
--
--  100% aditivo.
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS oficina_reparos (
  id              text PRIMARY KEY,        -- 'ofr_<timestamp>'
  loja_id         text,                    -- nullable — uma unidade só por enquanto
  numero          integer,                 -- numeração própria via dbInsertNumerado

  cliente_id      text,
  cliente_nome    text,                    -- snapshot, mesmo padrão de orcamentos.cliente

  equipamento_id  text,                    -- aponta pro cadastro em equipamentos
  -- snapshot do equipamento NA ENTRADA — a ficha é documento histórico; se o
  -- cadastro for editado depois, a ficha de entrada não muda retroativamente.
  eq_tipo         text,
  eq_marca        text,
  eq_modelo       text,
  eq_numero_serie text,

  origem          text DEFAULT 'balcao',   -- 'balcao' | 'os_campo' | 'garantia_fabricante'
  os_campo_id     text,                    -- se origem='os_campo': ordens_servico.id de onde veio

  status          text DEFAULT 'recebido', -- ver máquina de estados completa na Fase 2

  estado_entrada  jsonb DEFAULT '{}',      -- checklist estruturado (Fase 1b)
  fotos_entrada   jsonb DEFAULT '[]',      -- [{base64, legenda}] (Fase 1b)
  obs_entrada     text,

  termo_entrada_assinatura_base64 text,    -- Fase 1c
  termo_entrada_assinatura_data   timestamptz,
  termo_entrada_assinatura_meta   text,

  diagnostico     text,

  entrega_assinatura_base64 text,
  entrega_assinatura_data   timestamptz,
  entrega_assinatura_meta   text,

  cancelado_motivo text,

  data_criacao     timestamptz DEFAULT now(),
  data_diagnostico timestamptz,
  data_pronto      timestamptz,
  data_entrega     timestamptz
);

ALTER TABLE oficina_reparos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon full access" ON oficina_reparos;
CREATE POLICY "anon full access" ON oficina_reparos FOR ALL TO anon USING (true) WITH CHECK (true);
-- mesma ressalva de sempre: "anon full access" não é controle de acesso real,
-- é só habilitação técnica — o controle fica no JS do cliente.

CREATE INDEX IF NOT EXISTS idx_oficina_cliente ON oficina_reparos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_oficina_equip   ON oficina_reparos(equipamento_id);
CREATE INDEX IF NOT EXISTS idx_oficina_status  ON oficina_reparos(status);
CREATE INDEX IF NOT EXISTS idx_oficina_loja    ON oficina_reparos(loja_id, data_criacao DESC);

-- OBRIGATÓRIO — sem isto dbInsertNumerado não protege de verdade contra
-- colisão de numeração (mesmo motivo de migracao-numero-unico.sql).
CREATE UNIQUE INDEX IF NOT EXISTS oficina_reparos_numero_unico ON oficina_reparos(numero);
