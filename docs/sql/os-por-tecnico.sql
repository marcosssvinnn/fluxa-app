-- O QUE MEDE: volume de OS e duração média por técnico.
--
-- COMO LER: hoje esta consulta devolve quase só '(sem técnico)' — o campo está
-- preenchido em 4 das 118 OS, e 'duracao_min' em nenhuma. Ou seja: as colunas
-- de duração vêm nulas e NÃO significam "serviço rápido", significam "não
-- medido". Rode 'os-cobertura-campos-execucao.sql' antes de apresentar
-- qualquer número daqui.
-- Deixada versionada porque passa a valer assim que o check-in virar rotina.
select coalesce(nullif(trim(tecnico), ''), '(sem tecnico)') as tecnico,
       coalesce(loja_id, '?')                               as loja,
       count(*)                                             as os,
       count(*) filter (where duracao_min > 0)              as com_duracao,
       round(avg(duracao_min) filter (where duracao_min > 0)::numeric, 0) as media_min,
       round((percentile_cont(0.5) within group (order by duracao_min)
              filter (where duracao_min > 0))::numeric, 0)  as mediana_min
  from ordens_servico
 group by 1, 2
 order by 3 desc;
