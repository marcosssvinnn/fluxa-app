-- O QUE MEDE: valor em estoque, itens sem saída registrada, e saldo negativo —
-- por unidade.
--
-- COMO LER: 'valor_parado' usa o custo cadastrado no produto. Como 36 itens com
-- saldo estão com custo zero, o valor real é MAIOR que o mostrado — este número
-- é piso, não estimativa.
--
-- 🔴 NÃO LEIA 'sem_giro_90d' COMO ESTOQUE ENCALHADO. O nome da coluna promete
-- mais do que ela entrega, e a primeira versão deste arquivo induziu a leitura
-- errada. O razão de estoque começou em 20/06/2026 — tem menos de 90 dias de
-- vida. Logo NENHUM item pode ter "última saída há mais de 90 dias", e o que a
-- coluna captura, na prática, são os itens que **nunca tiveram saída
-- registrada** (o `ultima_saida is null` do filtro).
-- Item que entrou há 9 dias e ainda não saiu cai aqui igual a item encalhado.
--
-- O número certo a tirar daqui é a comparação entrada × saída, não o giro:
-- em 48 dias Camboriú lançou 201 entradas e **6 saídas**, tendo aprovado 33
-- orçamentos no período; Itapema lançou 102 entradas e 34 saídas para 19
-- aprovados. Não é estoque parado — é saída que não está sendo lançada.
-- A leitura completa está em docs/estoque-giro-2026-08-07.md.
-- 'negativos' deveria ficar em zero ou perto: negativo significa que saiu mais
-- do que entrou, ou seja, entrada não lançada. Com a baixa automática na
-- aprovação, negativo passou a ser o sinal normal de "precisa comprar" — o que
-- não pode é ficar negativo sem virar pedido.
--
-- ARMADILHA: o agrupamento é pela loja do MOVIMENTO, não pela do produto. O
-- mesmo produto recebe movimento nas duas unidades; agrupar por produtos.loja_id
-- joga o saldo de Itapema na conta de Camboriú.
with saldo as (
  select m.loja_id,
         m.produto_id,
         sum(m.quantidade) filter (where m.tipo in ('entrada','saida','ajuste','transf_entrada','transf_saida')) as fisico,
         coalesce(sum(m.quantidade) filter (where m.tipo in ('reserva','liberacao_reserva')), 0)                 as reservado,
         max(m.data) filter (where m.tipo in ('saida','transf_saida'))                                          as ultima_saida
    from estoque_movimentos m
   group by 1, 2
)
select coalesce(s.loja_id, '(sem loja)') as loja,
       count(*)                                                          as produtos_movimentados,
       count(*) filter (where fisico > 0)                                as com_saldo,
       count(*) filter (where fisico < 0)                                as negativos,
       coalesce(round(sum(fisico) filter (where fisico < 0)::numeric, 2), 0)     as qtd_negativa,
       coalesce(round(sum(reservado) filter (where reservado <> 0)::numeric, 2), 0) as reservado_legado,
       round(sum(fisico * coalesce(p.custo, 0)) filter (where fisico > 0)::numeric, 2) as valor_parado,
       count(*) filter (where fisico > 0 and coalesce(p.custo, 0) = 0)    as sem_custo,
       count(*) filter (where fisico > 0
                          and (ultima_saida is null or ultima_saida < now() - interval '90 days')) as sem_giro_90d,
       round(sum(fisico * coalesce(p.custo, 0)) filter (where fisico > 0
                          and (ultima_saida is null or ultima_saida < now() - interval '90 days'))::numeric, 2) as valor_sem_giro
  from saldo s
  left join produtos p on p.id = s.produto_id
 group by 1
 order by 7 desc nulls last;
