-- O QUE MEDE: quantos lançamentos de ENTRADA e de SAÍDA cada unidade registrou,
-- e em quanto tempo de razão.
--
-- COMO LER: é a consulta mais reveladora do estoque, e a mais simples. Compare
-- 'saida_movs' com quantos orçamentos a unidade aprovou no mesmo período
-- (`orcamentos-taxa-aprovacao-por-loja.sql` com filtro de data).
-- Medido em 07/08, sobre 48 dias de razão (20/06 a 07/08/2026):
--   Camboriú  201 entradas ·  6 saídas · 33 orçamentos aprovados no período
--   Itapema   102 entradas · 34 saídas · 19 orçamentos aprovados no período
-- Camboriú aprovou 33 e lançou 6 saídas. O material saiu da prateleira; o
-- lançamento não aconteceu.
--
-- É a MESMA assinatura que aparece em `recebimento-registrado.sql` (Camboriú
-- 28,1% × Itapema 98,4%) e em `estoque-cobertura-produto-id-por-natureza.sql`
-- (28,5% × 51,5%). Três indicadores independentes, um problema só: rotina de
-- registro. Vale tratar como um problema, não como três.
--
-- ARMADILHA: não conclua "estoque encalhado" a partir de saldo sem saída. O
-- razão tem menos de 90 dias — item que entrou semana passada e ainda não saiu
-- é indistinguível de item parado há meses. Veja o cabeçalho de
-- `estoque-saldo-e-giro-por-loja.sql`.
select coalesce(loja_id, '?') as loja,
       count(*) filter (where tipo = 'entrada')                   as entrada_movs,
       count(*) filter (where tipo = 'saida')                     as saida_movs,
       count(distinct produto_id) filter (where tipo = 'entrada') as entrada_produtos,
       count(distinct produto_id) filter (where tipo = 'saida')   as saida_produtos,
       round(sum(quantidade) filter (where tipo = 'entrada')::numeric, 0) as entrada_qtd,
       round(sum(quantidade) filter (where tipo = 'saida')::numeric, 0)   as saida_qtd,
       to_char(min(data), 'YYYY-MM-DD')                           as de,
       to_char(max(data), 'YYYY-MM-DD')                           as ate
  from estoque_movimentos
 where tipo in ('entrada', 'saida')
 group by 1
 order by 2 desc;
