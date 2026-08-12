-- ══════════════════════════════════════════════════════════════════════════════
--  VENDA DE BALCÃO — entidade própria (Etapa 1 do roadmap de CRM, 2026-08-12)
--
--  Hoje, venda de balcão (químico, peça, avulso) só existe como saída de
--  estoque com motivo em texto ("vendido loja", "venda brooklyn"...) — sem
--  cliente, sem histórico, o dado evapora todo dia. Esta tabela dá à venda de
--  balcão o mesmo status de transação que orçamento/OS já têm: fica no
--  histórico do cliente e alimenta recorrência/consumo teórico das próximas
--  etapas do roadmap.
--
--  Entidade própria, não reaproveita `orcamentos`: misturar distorceria
--  conversão/ticket médio do funil de orçamento (venda de balcão fecha na
--  hora, sem negociação — ciclo de vida diferente).
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS vendas_balcao (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id text,
  cliente_id uuid,           -- nullable: venda de balcão pode ser anônima
  cliente_nome text,         -- snapshot do nome no momento da venda (mesmo padrão de orcamentos.cliente)
  itens jsonb DEFAULT '[]',  -- [{produto_id, nome, qtd, preco_unit, custo_unit}]
  valor_total numeric(12,2) DEFAULT 0,
  custo_total numeric(12,2) DEFAULT 0,
  forma_pagamento text,
  vendedor text,
  observacao text,
  data_criacao timestamptz DEFAULT now()
);

ALTER TABLE vendas_balcao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon full access" ON vendas_balcao;
CREATE POLICY "anon full access" ON vendas_balcao FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_vendas_balcao_cliente ON vendas_balcao(cliente_id);
CREATE INDEX IF NOT EXISTS idx_vendas_balcao_data ON vendas_balcao(data_criacao DESC);
