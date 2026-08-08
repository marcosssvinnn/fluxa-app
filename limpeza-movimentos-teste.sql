-- ══════════════════════════════════════════════════════════════════════
--  Limpeza dos movimentos de TESTE do razão de estoque — 2026-08-07
--  APLICADO. Este arquivo é o histórico do que foi feito.
--  Reversão: docs/desfazer-limpeza-teste-2026-08-07.sql (INSERTs de volta)
--
--  ⚠️ POR QUE NÃO DEU PARA APAGAR SÓ OS `test_`:
--  a correção de reserva negativa de hoje (`fix:reserva-negativa:*`) foi
--  calculada para COMPENSAR justamente esses lançamentos. Apagar só um dos
--  lados jogaria o reservado de volta para +5, +30, +1 e +7. Por isso os dois
--  conjuntos saem JUNTOS, e só nos 2 produtos onde a correção existia apenas
--  por causa do teste — as correções dos outros 15 produtos (que vieram do bug
--  real de reserva) ficaram intactas.
--
--  Impacto medido antes de executar: reserva neutra em todos os pares; único
--  saldo físico alterado foi Motobomba Syllent 1 cv em Camboriú (0 → 1),
--  porque a saída de teste "concluiu" um orçamento que nunca foi entrega real.
-- ══════════════════════════════════════════════════════════════════════

-- 35 movimentos: refs de teste + as 4 correções que só existiam para compensá-los
delete from estoque_movimentos
where ref like '%test\_%'
   or (ref like 'fix:reserva-negativa%'
       and produto_id in ('prod_1782041694471','prod_1781924307155'));

-- 3 movimentos de um produto de teste que nem existe mais no cadastro
-- ("Teste cache", "Teste cache 2", "Saída teste") — sem ref, achados por não
-- terem produto correspondente.
delete from estoque_movimentos where produto_id='prod_teste_cache_1782122643985';

-- Estado final verificado: 689 movimentos, 0 com ref de teste, 0 apontando para
-- produto inexistente, 0 com motivo "teste", 0 reservas negativas.
