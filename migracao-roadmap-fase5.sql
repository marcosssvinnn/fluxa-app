-- ══════════════════════════════════════════════════════════════════════
--  Roadmap de indicadores — itens 5.4 e 5.2 (esforço mínimo, alto destrave)
--  APLICADO em 2026-08-07 no projeto lbxwclwzeqqtnwvlxsxs. Arquivo é histórico.
--  ADITIVO: nada renomeado, apagado ou mudado de tipo.
-- ══════════════════════════════════════════════════════════════════════

-- 5.4 — Sem a data PROMETIDA não existe lead time real nem OTIF de fornecedor,
-- e o lead_time_dias do produto (que arma o ponto de pedido) continua sendo
-- digitado à mão — quando fica vazio, o gatilho de compra nunca dispara.
-- Obs.: o formulário já tinha um campo rotulado "Data prevista", mas ele
-- gravava em `data` (data da ordem). Agora são dois campos de verdade.
ALTER TABLE ordens_compra ADD COLUMN IF NOT EXISTS data_prevista text;
COMMENT ON COLUMN ordens_compra.data_prevista IS
  'Data prometida pelo fornecedor. Com data_recebimento sai lead time real e OTIF.';

-- 5.2 — `motivo` é texto livre: 21 ajustes geraram 15 grafias distintas
-- ('AJUSTE', 'ajuste de estoque', 'ERRO DE ENTRADA', 'ERRO NA ENTRADA'...),
-- o que impede separar perda real de erro de contagem.
-- NÃO converto a coluna existente em enum (destrutivo, perderia os 21
-- registros): o código entra ao lado e `motivo` segue guardando o detalhe.
ALTER TABLE estoque_movimentos ADD COLUMN IF NOT EXISTS motivo_cod text;
COMMENT ON COLUMN estoque_movimentos.motivo_cod IS
  'Codigo padronizado do ajuste: quebra|perda|contagem|devolucao|furto|inventario|outro. O campo motivo segue livre para o detalhe.';
