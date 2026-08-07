-- O QUE MEDE: quanto tempo passa entre o cliente aprovar e a ordem de serviço
-- ser aberta.
--
-- COMO LER: a amostra é pequena de propósito — só dá para medir quando a OS
-- guarda 'orcamento_id', e apenas 12 das 118 OS guardam. O número que sai daqui
-- descreve essas 12, não a operação. Antes de tirar conclusão de prazo, olhe
-- 'os-por-loja-e-status.sql' para ver o tamanho do vínculo perdido.
with base as (
  select o.loja_id,
         extract(epoch from (os.data_criacao - o.data_aprovacao)) / 86400.0 as dias
    from ordens_servico os
    join orcamentos o on o.id = os.orcamento_id
   where o.data_aprovacao is not null
)
select coalesce(loja_id, '?') as loja,
       count(*)                                                          as n,
       round(avg(dias)::numeric, 1)                                      as media_dias,
       round((percentile_cont(0.5) within group (order by dias))::numeric, 1) as mediana_dias
  from base
 group by 1
 order by 2 desc;
