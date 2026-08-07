-- O QUE MEDE: o tamanho do problema de identidade do cliente — nomes livres em
-- 'orcamentos.cliente' contra as fichas de 'clientes'.
--
-- COMO LER: se 'nomes_distintos' for maior que 'fichas', o cadastro não é a
-- fonte da verdade: a maioria dos orçamentos foi digitada sem passar por ele.
-- Hoje são 216 nomes para 141 fichas.
-- A classificação nome a nome (exato / provável / revisar / nenhum) está em
-- docs/dedup-clientes-2026-08-07.md e no JSON ao lado; esta consulta é só o
-- placar, e serve para acompanhar se o número melhora depois da tela de
-- confirmação de identidade.
select (select count(distinct trim(cliente)) from orcamentos
         where coalesce(trim(cliente), '') <> '')             as nomes_distintos,
       (select count(*) from clientes)                        as fichas,
       (select count(*) from orcamentos)                      as orcamentos,
       (select round(sum(coalesce(total, 0))::numeric, 2) from orcamentos) as valor_total;
