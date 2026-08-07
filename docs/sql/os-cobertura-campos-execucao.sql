-- O QUE MEDE: se os campos que registram a EXECUÇÃO do serviço estão sendo
-- preenchidos. É uma medida do processo, não do resultado.
--
-- COMO LER: cada coluna é "em quantas das 118 OS este campo tem conteúdo".
-- Hoje duracao_min, checkin_time e checkout_time estão em zero — o recurso
-- existe no app, mas ninguém bate ponto na OS. Enquanto isso for zero,
-- qualquer indicador de produtividade técnica é impossível de calcular, e
-- 'os-por-tecnico.sql' devolve só contagem.
-- 'tem_obs' alto (103) mostra que a equipe PREENCHE o que considera útil —
-- o problema não é resistência a registrar, é que o check-in não entrou na
-- rotina.
select count(*)                                             as total,
       count(duracao_min)                                   as tem_duracao,
       count(checkin_time)                                  as tem_checkin,
       count(checkout_time)                                 as tem_checkout,
       count(nullif(trim(coalesce(obs_tecnica, '')), ''))   as tem_obs,
       count(nullif(fotos::text, '[]'))                     as tem_fotos,
       count(nullif(trim(coalesce(tecnico, '')), ''))       as tem_tecnico
  from ordens_servico;
