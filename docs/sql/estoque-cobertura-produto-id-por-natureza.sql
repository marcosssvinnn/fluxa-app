-- O QUE MEDE: a cobertura de produto_id separando as linhas por NATUREZA —
-- material, mão de obra e linha de fechamento.
--
-- COMO LER: esta é a versão honesta de 'estoque-cobertura-produto-id.sql'.
-- Mão de obra nunca vai ter produto, e "Investimento total:" muito menos. O
-- denominador certo é só o material.
-- Sobre o material dos aprovados a cobertura é 34,5% (Camboriú 28,5%, Itapema
-- 51,5%) — contra os 29,9% que saem quando se divide por todas as linhas.
-- A conclusão não muda (Camboriú deixa 71% do material fora da contabilidade),
-- mas a meta passa a ser alcançável: 100% de 252 linhas, não de 294.
--
-- ARMADILHA: a classificação é por expressão regular sobre a descrição digitada.
-- Ela acerta o padrão atual, não é uma verdade do banco. Se a equipe mudar o
-- jeito de escrever, revise os padrões antes de comparar com esta medição.
-- O detalhamento descrição a descrição está em docs/cobertura-produto-id.json.
with itens as (
  select o.loja_id,
         jsonb_array_elements(
           case when jsonb_typeof(o.servicos::jsonb) = 'array' then o.servicos::jsonb else '[]'::jsonb end) as it
    from orcamentos o
   where o.status = 'aprovado'          -- tire este filtro para ver a base toda
),
c as (
  select loja_id,
         coalesce(it->>'produto_id', '') <> '' as tem_pid,
         case
           when (it->>'desc') ~* 'investimento total|valor total|total do investimento|^investimento|valor instala'
             then 'fechamento'
           when (it->>'desc') ~* 'm[ãa]o de obra|instala[çc][ãa]o|servi[çc]o|manuten[çc][ãa]o|visita|deslocamento|frete|limpeza|montagem|conserto|reparo|vistoria'
             then 'servico'
           else 'material'
         end as natureza
    from itens
)
select coalesce(loja_id, '?') as loja,
       natureza,
       count(*)                            as itens,
       count(*) filter (where tem_pid)     as com_produto_id,
       round(100.0 * count(*) filter (where tem_pid) / count(*), 1) as pct
  from c
 group by 1, 2
 order by 1, 2;
