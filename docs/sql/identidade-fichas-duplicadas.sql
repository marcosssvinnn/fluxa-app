-- O QUE MEDE: duplicidade dentro da própria tabela 'clientes' — a mesma
-- empresa cadastrada duas ou três vezes.
--
-- COMO LER: o agrupamento ignora caixa, acento, pontuação e as palavras que
-- indicam TIPO e não identidade (condomínio, edifício, residencial, torre...).
-- É por isso que 'CONDOMINIO ATLANTICO' e 'Condominio Atlântico' caem juntos.
-- Importa porque metade dos casos ambíguos do relatório de deduplicação trava
-- aqui: o nome do orçamento está certo, mas há duas fichas candidatas e o
-- sistema não tem como escolher. Limpar isto resolve os dois lados de uma vez.
--
-- ARMADILHA: nome parecido não é cliente igual. Infinity Coast, Infinity
-- Paradise e Infinity Flat são condomínios DIFERENTES. Esta consulta só junta
-- o que fica idêntico depois da normalização — ela não decide nada por
-- semelhança, e é assim que deve continuar.
-- A pontuação sai ANTES das palavras de tipo: sem isso, "Luan (CONDOMINIO)"
-- vira "luan ()" e não casa com "LUAN", que é exatamente o par que se quer ver.
with norm as (
  select id,
         nome,
         trim(regexp_replace(
           regexp_replace(
             regexp_replace(
               lower(translate(nome,
                 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
                 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')),
               '[^a-z0-9]+', ' ', 'g'),
             '\y(condominio|cond|residencial|resid|edificio|edif|ed|predio|torre|tower|towers|residence|ltda|me|eireli|sa)\y', '', 'g'),
           '\s+', ' ', 'g')) as chave
    from clientes
   where coalesce(trim(nome), '') <> ''
)
select chave,
       count(*)                       as fichas,
       string_agg(nome, ' | ')        as nomes
  from norm
 group by 1
having count(*) > 1
 order by 2 desc, 1;
