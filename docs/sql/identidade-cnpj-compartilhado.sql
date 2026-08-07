-- O QUE MEDE: CNPJs que aparecem em mais de um nome de cliente.
--
-- COMO LER: à primeira vista parece duplicidade. NÃO É. O CNPJ gravado no
-- orçamento é o da ADMINISTRADORA do condomínio, não o do condomínio. Um mesmo
-- CNPJ cobre Edifício Torre de Esmeralda, Villa Di Mare e Villa dos Corais —
-- três prédios diferentes, mesma administradora.
--
-- CONSEQUÊNCIA PRÁTICA: CNPJ NÃO pode ser usado como chave para unificar
-- clientes. Um backfill de cliente_id por CNPJ fundiria condomínios distintos,
-- e o erro só apareceria meses depois, no histórico de vendas errado.
select regexp_replace(cnpj, '[^0-9]', '', 'g') as cnpj_digitos,
       count(distinct trim(cliente))           as nomes_distintos,
       string_agg(distinct trim(cliente), ' | ') as nomes
  from orcamentos
 where coalesce(trim(cnpj), '') <> ''
 group by 1
having count(distinct trim(cliente)) > 1
 order by 2 desc;
