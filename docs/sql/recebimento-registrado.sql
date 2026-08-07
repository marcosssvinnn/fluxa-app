-- O QUE MEDE: de tudo que foi aprovado, quanto tem recebimento registrado.
--
-- COMO LER: 'quitados' são os que têm valor_recebido >= total. A diferença
-- entre 'com_recebimento' e 'aprovados' é o buraco do registro financeiro:
-- orçamentos aprovados sobre os quais o sistema não sabe dizer se entrou
-- dinheiro. Não confunda com inadimplência — o serviço pode ter sido pago em
-- espécie e ninguém ter lançado.
-- 'recebimentos_linhas' acompanha a migração para a tabela nova: enquanto for
-- 0, o controle ainda é o campo único no orçamento, que não guarda parcelas
-- nem data de pagamento.
select (select count(*) from recebimentos)                     as recebimentos_linhas,
       count(*)                                                as aprovados,
       round(sum(total)::numeric, 2)                           as valor_aprovado,
       round(sum(coalesce(valor_recebido, 0))::numeric, 2)     as valor_recebido,
       count(*) filter (where coalesce(valor_recebido, 0) > 0) as com_recebimento,
       count(*) filter (where coalesce(valor_recebido, 0) >= total) as quitados
  from orcamentos
 where status = 'aprovado';
