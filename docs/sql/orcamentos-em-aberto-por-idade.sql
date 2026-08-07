-- O QUE MEDE: quanto dinheiro está parado no funil e há quanto tempo.
--
-- COMO LER: 'idade_media_dias' é o tempo desde a criação, não desde o último
-- contato — um orçamento de 64 dias pode ter sido trabalhado ontem. O que
-- importa é 'mais_30d': passado um mês sem fechar, o preço provavelmente já
-- não vale mais e o orçamento precisa ser refeito antes de qualquer cobrança.
-- É por isso que a fila de follow-up separa "vida no funil" de "validade do
-- preço": são duas contas diferentes.
select coalesce(loja_id, '?') as loja,
       count(*)                                                            as abertos,
       round(avg(extract(epoch from (now() - data_criacao)) / 86400)::numeric, 0) as idade_media_dias,
       count(*) filter (where data_criacao < now() - interval '30 days')   as mais_30d,
       round(sum(total) filter (where data_criacao < now() - interval '30 days')::numeric, 2) as valor_mais_30d
  from orcamentos
 where status in ('pendente', 'vencido')
 group by 1
 order by 2 desc;
