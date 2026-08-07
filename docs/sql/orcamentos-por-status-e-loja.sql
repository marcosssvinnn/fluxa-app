-- O QUE MEDE: como os orçamentos se distribuem entre status, em cada unidade,
-- com o ticket médio de cada combinação.
--
-- COMO LER: compare o ticket médio de 'vencido' com o de 'aprovado' na mesma
-- unidade. Em Camboriú o vencido é ~6x maior que o aprovado — o que morre no
-- funil é o orçamento grande, não o pequeno. Esse é o padrão que o CRM ataca.
-- 'vencido' não quer dizer perdido: quer dizer que passou da validade sem
-- resposta. 'recusado' é o não explícito, e é raro.
select coalesce(loja_id, '(sem loja)') as loja,
       status,
       count(*)                                  as qtd,
       round(sum(coalesce(total, 0))::numeric, 2) as valor,
       round(avg(coalesce(total, 0))::numeric, 2) as ticket_medio
  from orcamentos
 group by 1, 2
 order by 1, 4 desc;
