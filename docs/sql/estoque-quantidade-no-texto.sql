-- O QUE MEDE: itens cuja QUANTIDADE está escrita na descrição ("05 Leds RGS")
-- enquanto o campo `qty` continua 1 ou vazio.
--
-- POR QUE IMPORTA: desde agosto/2026 aprovar um orçamento dá baixa direta no
-- estoque, e a baixa usa `qty`, não o texto. Enquanto o item está SEM
-- `produto_id` isso é inofensivo — ele não move estoque de qualquer jeito. O
-- risco aparece quando o item passa a ser vinculado: aí o sistema debita
-- **1 unidade em vez de 5**, e o estoque fica com aparência de correto estando
-- errado por um fator de cinco. É pior que não vincular, porque some o sinal.
--
-- COMO LER:
--   'divergentes'                -> itens onde o texto e o `qty` discordam
--   'divergentes_ja_vinculados'  -> os que JÁ dariam baixa errada hoje
--   'unidades_a_menos'           -> quanto de material sairia a menos
-- Medido em 07/08: 456 unidades subnotificadas na base, 72 delas em orçamentos
-- aprovados de Camboriú. Apenas 1 item já vinculado (orçamento 325, "21 Sal
-- para gerador de cloro", qty=1) — ou seja, nenhuma baixa errada aconteceu
-- ainda. É um risco para a frente, não um estrago feito.
--
-- Rode esta consulta ANTES de qualquer mutirão de vinculação: vincular sem
-- corrigir `qty` transforma um problema visível (item sem vínculo, que o rodapé
-- do orçamento avisa) num problema invisível (baixa errada, que ninguém vê).
--
-- ARMADILHA: só detecta a quantidade quando ela abre a descrição. "Sal para
-- gerador — 21 unidades" passa batido. O número é piso.
with itens as (
  select o.numero, o.loja_id, o.status,
         jsonb_array_elements(
           case when jsonb_typeof(o.servicos::jsonb) = 'array' then o.servicos::jsonb else '[]'::jsonb end) as it
    from orcamentos o
),
c as (
  select loja_id, status, numero,
         coalesce(nullif(substring(it->>'desc' from '^\s*(\d{1,3})\s'), '')::int, 1) as qtd_texto,
         coalesce(nullif(it->>'qty', '')::numeric, 1)                                as qty,
         coalesce(it->>'produto_id', '') <> ''                                       as vinculado
    from itens
   where (it->>'desc') ~ '^\s*\d{1,3}\s+[A-Za-zÀ-ÿ]'
)
select coalesce(loja_id, '?') as loja,
       status,
       count(*)                                                          as itens_com_qtd_no_texto,
       count(*) filter (where qtd_texto <> qty)                          as divergentes,
       count(*) filter (where qtd_texto <> qty and vinculado)            as divergentes_ja_vinculados,
       sum(qtd_texto - qty) filter (where qtd_texto <> qty)              as unidades_a_menos
  from c
 group by 1, 2
 order by 4 desc;
