-- O QUE MEDE: volume de OS por unidade, quantas concluídas, quantas ligadas a
-- um orçamento e quanto valor carregam.
--
-- COMO LER: o status válido é 'concluido' (masculino, sem 'a'). Escrever
-- `status = 'concluida'` devolve zero e passa despercebido — é o erro mais
-- fácil de cometer nesta tabela.
-- As 92 OS da Aquamotor são manutenção recorrente agendada, com total zero e
-- data de serviço no futuro: são compromissos de agenda, não trabalho feito.
-- Somá-las ao volume da Fortemp infla o número em quatro vezes.
select coalesce(loja_id, '(sem loja)') as loja,
       count(*)                                                as os,
       count(*) filter (where status = 'concluido')            as concluidas,
       count(*) filter (where orcamento_id is not null)        as com_orcamento,
       count(*) filter (where checkin_time is not null)        as com_checkin,
       count(*) filter (where duracao_min is not null and duracao_min > 0) as com_duracao,
       round(sum(coalesce(total, 0))::numeric, 2)              as valor
  from ordens_servico
 group by 1
 order by 2 desc;
