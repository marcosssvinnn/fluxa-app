-- O QUE MEDE: valor aprovado e valor recebido, mês a mês, com Camboriú e
-- Itapema em colunas separadas.
--
-- COMO LER: 'aprovado' é o que o cliente disse sim; 'recebido' é o que tem
-- baixa de pagamento registrada no sistema. A diferença entre os dois NÃO é
-- inadimplência — é registro que não foi feito. Enquanto 'recebimentos'
-- estiver vazia, 'valor_recebido' é um campo digitado à mão no orçamento, e
-- some quando ninguém digita.
-- A série começa em 2026-04: é quando o sistema entrou em uso, não o começo
-- da operação.
select to_char(date_trunc('month', coalesce(data_aprovacao, data_criacao)), 'YYYY-MM') as mes,
       count(*) filter (where loja_id = 'fortemp-camboriu')                              as cba_qtd,
       round(coalesce(sum(total)          filter (where loja_id = 'fortemp-camboriu'), 0)::numeric, 2) as cba_valor,
       round(coalesce(sum(valor_recebido) filter (where loja_id = 'fortemp-camboriu'), 0)::numeric, 2) as cba_recebido,
       count(*) filter (where loja_id = 'fortemp-itapema')                               as itp_qtd,
       round(coalesce(sum(total)          filter (where loja_id = 'fortemp-itapema'), 0)::numeric, 2) as itp_valor,
       round(coalesce(sum(valor_recebido) filter (where loja_id = 'fortemp-itapema'), 0)::numeric, 2) as itp_recebido
  from orcamentos
 where status = 'aprovado'
   and coalesce(data_aprovacao, data_criacao) >= now() - interval '12 months'
 group by 1
 order by 1 desc;
