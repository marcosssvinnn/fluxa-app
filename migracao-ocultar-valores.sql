-- ══════════════════════════════════════════════════════════════════════════════
--  OCULTAR VALORES UNITÁRIOS NO ORÇAMENTO — pedido do Marcos (14/08)
--
--  Nem todo item de um orçamento deve mostrar o preço individual pro cliente
--  (ex.: composição de custo que a empresa não quer expor item a item). Opção
--  por orçamento: quando marcada, o PDF mostra só a descrição de cada serviço
--  (sem coluna de valor) e só o TOTAL final (sem subtotal/desconto detalhado).
--  Aditiva, default false — nenhum orçamento existente muda de comportamento.
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS ocultar_valores boolean DEFAULT false;

-- Já aplicada em produção (2026-08-17, via Management API, verificada com
-- leitura de information_schema.columns antes e depois). Arquivo fica como
-- registro histórico — rodar de novo é seguro (IF NOT EXISTS).
