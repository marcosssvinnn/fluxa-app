-- O QUE MEDE: se o motivo do ajuste de estoque está padronizado.
--
-- COMO LER: 'motivo' é texto livre e 'motivo_cod' é o código padronizado que
-- entrou em agosto/2026. Enquanto houver muitos motivos distintos para poucos
-- ajustes, não dá para responder "por que o estoque não bate" — cada pessoa
-- escreve de um jeito e o agrupamento não fecha.
-- Ajuste com motivo vazio é o pior caso: some da análise sem deixar rastro de
-- quem mexeu e por quê.
select coalesce(nullif(trim(motivo_cod), ''), '(sem codigo)') as motivo_cod,
       coalesce(nullif(trim(motivo), ''), '(vazio)')          as motivo_texto,
       count(*)                                               as n,
       round(sum(quantidade)::numeric, 2)                     as qtd
  from estoque_movimentos
 where tipo = 'ajuste'
 group by 1, 2
 order by 3 desc;
