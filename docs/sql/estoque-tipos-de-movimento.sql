-- O QUE MEDE: a composição do razão de estoque por tipo de movimento.
--
-- COMO LER: 'quantidade' já vem com sinal — saída e transf_saida são negativas.
-- Nunca aplique um sinal por fora, dá o dobro do erro.
-- Os tipos se dividem em dois grupos que NÃO se misturam:
--   físicos:  entrada, saida, ajuste, transf_entrada, transf_saida
--   reserva:  reserva, liberacao_reserva
-- Somar os sete juntos mistura estoque real com intenção de uso e produz um
-- saldo que não existe. A separação está em _TIPOS_FISICOS / _TIPOS_RESERVA
-- (app.js) e precisa ser respeitada aqui.
-- O par reserva/liberacao_reserva é legado: desde a mudança de agosto/2026 a
-- aprovação dá baixa direta, sem reservar. Os saldos de reserva que restam são
-- material já entregue esperando conferência.
select tipo,
       count(*)                            as n,
       round(sum(quantidade)::numeric, 2)  as qtd
  from estoque_movimentos
 group by 1
 order by 2 desc;
