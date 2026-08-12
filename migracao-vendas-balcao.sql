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
  cliente_id text,           -- nullable: venda de balcão pode ser anônima. text, NÃO uuid —
                              -- ver correção abaixo (mesmo motivo de equipamentos/orcamentos.cliente_id)
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

-- ══════════════════════════════════════════════════════════════════════════════
--  CORREÇÃO (2026-08-12, mesmo dia) — cliente_id criado como uuid por engano.
--  Cliente recém-criado localmente (offline, ou antes de sincronizar) tem id
--  tipo 'cli_1699...' — texto, não uuid. Uma coluna uuid REJEITA esse insert
--  (erro 22P02), exatamente o mesmo bug de classe que já pegou despesas e
--  equipamentos em 08/08. Confirmado com um insert de teste real que falhou
--  antes desta correção. Rodar mesmo se a tabela já foi criada com o SQL
--  acima — ALTER é seguro, não há dado ainda que dependa do tipo antigo.
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE vendas_balcao ALTER COLUMN cliente_id TYPE text;
