-- O QUE MEDE: quantos orçamentos usam o formato "escopo fechado" — itens com
-- preço zero e o valor inteiro numa linha final de "Investimento total:".
--
-- COMO LER: 'pct_preco_zero' perto de 80% confirma o padrão. Em Camboriú são 64
-- orçamentos e R$ 1,33 milhão — 51% do valor da unidade.
-- Isso é normal comercialmente: numa proposta de equipamento não se abre a
-- composição para o cliente. O que importa é a consequência dentro do sistema:
--   1. A linha de fechamento carrega todo o dinheiro e NUNCA é um produto, então
--      medir cobertura de produto_id por VALOR não faz sentido. Meça por linha.
--   2. Custo congelado por item (roadmap 2.1) não funciona aqui: o item tem
--      preço zero, então não há receita por item para comparar com o custo. A
--      margem só existe no nível do orçamento inteiro.
--
-- ARMADILHA: a deteção é por texto. Se alguém escrever a linha de fechamento de
-- um jeito novo, o orçamento cai no grupo 'false' sem aviso. Confira contra
-- 'pct_preco_zero' — é ele que denuncia o formato de verdade.
with o as (
  select id, loja_id, status, total,
         (servicos::text ~* '(investimento|valor|total) *(total|geral|do investimento)? *:') as tem_linha_total,
         (select count(*) from jsonb_array_elements(
            case when jsonb_typeof(servicos::jsonb) = 'array' then servicos::jsonb else '[]'::jsonb end) it) as n_itens,
         (select count(*) from jsonb_array_elements(
            case when jsonb_typeof(servicos::jsonb) = 'array' then servicos::jsonb else '[]'::jsonb end) it
           where coalesce(nullif(it->>'preco', '')::numeric, 0) = 0) as n_preco_zero
    from orcamentos
)
select coalesce(loja_id, '?') as loja,
       tem_linha_total,
       count(*)                                   as orcs,
       round(sum(total)::numeric, 2)              as valor,
       sum(n_itens)                               as itens,
       sum(n_preco_zero)                          as itens_preco_zero,
       round(100.0 * sum(n_preco_zero) / nullif(sum(n_itens), 0), 1) as pct_preco_zero
  from o
 group by 1, 2
 order by 1, 2 desc;
