-- O QUE MEDE: que fatia dos itens vendidos aponta para um produto do estoque.
--
-- COMO LER: este é o teto da baixa automática. Desde agosto/2026 aprovar um
-- orçamento dá baixa no estoque — mas só dos itens que têm 'produto_id'. Item
-- digitado como texto livre não move estoque nenhum e some da contabilidade.
-- Rodando só sobre os APROVADOS (troque o filtro), a cobertura sobe, porque o
-- que fecha tende a ser material catalogado. Os dois números importam: o geral
-- diz o tamanho do problema de cadastro, o dos aprovados diz quanto da baixa
-- automática realmente funciona hoje.
--
-- ARMADILHA: 'servicos' é JSON guardado em coluna de texto. O
-- `jsonb_typeof(...) = 'array'` não é preciosismo — sem ele, registros com
-- formato inesperado derrubam a consulta inteira.
with itens as (
  select o.id,
         o.loja_id,
         o.status,
         jsonb_array_elements(
           case when jsonb_typeof(o.servicos::jsonb) = 'array'
                then o.servicos::jsonb else '[]'::jsonb end) as it
    from orcamentos o
   -- para medir só o que a baixa automática enxerga, descomente:
   -- where o.status = 'aprovado'
)
select coalesce(loja_id, '?') as loja,
       count(*)                                                                as itens,
       count(*) filter (where it->>'produto_id' is not null and it->>'produto_id' <> '') as com_produto,
       round(100.0 * count(*) filter (where it->>'produto_id' is not null and it->>'produto_id' <> '')
             / count(*), 1)                                                    as pct
  from itens
 group by 1
 order by 2 desc;
