-- O QUE MEDE: taxa de aprovação, ticket médio e o valor que está em aberto,
-- por unidade.
--
-- COMO LER: a taxa sozinha engana. Itapema aprova mais (42,6% contra 29,0%),
-- mas com ticket médio muito menor — vende serviço pequeno e frequente.
-- Camboriú tem taxa menor e um valor em aberto quinze vezes maior, porque o
-- mix dela é equipamento caro, que depende de assembleia.
-- 'em aberto' = pendente + vencido, o que ainda pode ser recuperado.
-- A Aquamotor aparece com 0% de aprovação: ela usa o sistema só para agendar,
-- e o fechamento acontece fora dele. Não é sinal de problema comercial.
select coalesce(loja_id, '(sem loja)') as loja,
       count(*)                                                       as orcs,
       count(*) filter (where status = 'aprovado')                    as aprovados,
       round(100.0 * count(*) filter (where status = 'aprovado') / count(*), 1) as taxa_pct,
       round(avg(total)::numeric, 2)                                  as ticket_medio_geral,
       round(avg(total) filter (where status = 'aprovado')::numeric, 2) as ticket_aprovado,
       round(sum(total) filter (where status = 'aprovado')::numeric, 2) as valor_aprovado,
       round(sum(total) filter (where status in ('pendente','vencido'))::numeric, 2) as valor_em_aberto
  from orcamentos
 group by 1
 order by 2 desc;
