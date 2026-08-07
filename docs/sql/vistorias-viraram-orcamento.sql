-- O QUE MEDE: se a vistoria técnica está virando proposta comercial.
--
-- COMO LER: para cada vistoria, conta quantos orçamentos apareceram para o
-- MESMO NOME de cliente depois dela. Zero em todas significa que o laudo não
-- está sendo convertido em oferta — é o vazamento mais caro do processo,
-- porque a visita já foi paga.
--
-- ARMADILHA: a ligação é feita por nome, porque não existe chave entre as duas
-- tabelas. Se o vendedor escreveu o nome de outro jeito no orçamento, a
-- consulta conta zero mesmo tendo havido proposta. O resultado é um piso do
-- vazamento, não a medida exata — e só deixa de ser estimativa quando
-- 'cliente_id' existir nas duas pontas.
-- A amostra é de 7 vistorias, três delas de 2026-08-05: é cedo para cobrar
-- conversão dessas.
select v.loja_id,
       v.cliente,
       v.data,
       (select count(*)
          from orcamentos o
         where lower(trim(o.cliente)) = lower(trim(v.cliente))
           and o.data_criacao >= v.created_at) as orcs_depois
  from vistorias v
 order by v.created_at;
