-- ============================================================================
-- MIGRAÇÃO — Campos de COMPRA no produto
-- Status: ✅ APLICADA em 2026-08-07. Mantida como referência e para novas empresas.
-- ============================================================================
-- Por que existe: o app já tem a lógica de compras completa — lista consolidada
-- agrupada por fornecedor, envio ao fornecedor por WhatsApp, criação de Ordem de
-- Compra, ponto de pedido e arredondamento por lote. Mas QUATRO colunas que essa
-- lógica lê nunca foram criadas neste banco, então a feature roda capada:
--
--   fornecedor_id      → o formulário de produto TEM o campo (#prod-fornecedor),
--                        o usuário preenche e o wrapper resiliente descarta em
--                        silêncio. Resultado: a lista de compras joga tudo em
--                        "Sem fornecedor definido" e o botão "📲 WhatsApp"
--                        nunca aparece, porque depende de achar o fornecedor.
--   lead_time_dias     → pontoDePedido() = lead_time × consumo/dia + segurança.
--   estoque_seguranca  → sem as duas, o ponto de pedido é sempre 0 e o gatilho
--                        "ponto de pedido" NUNCA dispara.
--   lote_minimo        → _calcListaCompras arredonda a quantidade para o múltiplo
--                        do lote. Sem ela, sempre pede 1 (ignora caixa fechada).
--
-- É a mesma classe de problema já corrigida em 2026-08-06 nas vistorias
-- (recomendacoes/obs_ambientes) e em clientes.tipo: o código grava, o banco não
-- tem a coluna, o dbUpsert remove e ninguém percebe.
--
-- Importa especialmente para a Forthemp porque boa parte da operação é "vende
-- primeiro, compra depois" — o fluxo de compra é o coração do modelo.
--
-- 100% aditivo: só colunas nullable. Nenhum dado existente é tocado e o código
-- atual roda igual com ou sem esta migração (requisito de rollback do projeto).
-- ============================================================================

ALTER TABLE produtos ADD COLUMN IF NOT EXISTS fornecedor_id      text;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS lead_time_dias     numeric;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS estoque_seguranca  numeric;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS lote_minimo        numeric;

-- Acelera o agrupamento por fornecedor na lista de compras.
CREATE INDEX IF NOT EXISTS idx_produtos_fornecedor ON produtos (fornecedor_id)
  WHERE fornecedor_id IS NOT NULL;

-- ============================================================================
-- DEPOIS DE RODAR, CONFERIR:
--   select column_name from information_schema.columns
--    where table_name='produtos'
--      and column_name in ('fornecedor_id','lead_time_dias',
--                          'estoque_seguranca','lote_minimo');
--   -- devem aparecer as quatro
--
-- Em seguida, no app: editar um produto, escolher o fornecedor e salvar. Abrir
-- "🛒 Lista de compras" — o item deve passar a aparecer sob o nome do
-- fornecedor, com o botão "📲 WhatsApp" ativo.
-- ============================================================================
