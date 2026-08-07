-- O QUE MEDE: quanto tempo o cliente leva entre receber o orçamento e aprovar.
--
-- COMO LER: a MEDIANA é o número honesto; a média é puxada por um único caso
-- de 65 dias. Metade fecha em algumas horas — quem vai comprar, compra na hora.
-- 'depois_da_validade' é o que fechou passados 5 dias, ou seja, DEPOIS de o
-- sistema já ter marcado o orçamento como vencido. Esses casos provam que
-- existe dinheiro além da validade padrão e justificam a fila de follow-up.
--
-- ARMADILHA: o filtro `abs(...) > 60` descarta os registros de backfill, em que
-- data_aprovacao foi preenchida igual a data_criacao por _migrarDataAprovacao()
-- em app.js. São 53 dos 88 aprovados. Sem esse filtro, o resultado vira "todo
-- mundo fecha em zero dia", que é um artefato de migração, não um fato.
with base as (
  select loja_id,
         extract(epoch from (data_aprovacao - data_criacao)) / 86400.0 as dias
    from orcamentos
   where status = 'aprovado'
     and data_aprovacao is not null
     and abs(extract(epoch from (data_aprovacao - data_criacao))) > 60
)
select coalesce(loja_id, '?') as loja,
       count(*)                                                          as n,
       round(avg(dias)::numeric, 1)                                      as media_dias,
       round((percentile_cont(0.5) within group (order by dias))::numeric, 1) as mediana_dias,
       round(max(dias)::numeric, 1)                                      as maior,
       count(*) filter (where dias <= 1)                                 as ate_1_dia,
       count(*) filter (where dias > 5)                                  as depois_da_validade
  from base
 group by 1
 order by 2 desc;
