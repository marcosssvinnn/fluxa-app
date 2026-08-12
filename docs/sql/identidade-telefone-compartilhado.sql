-- O QUE MEDE: telefones que aparecem em mais de um nome de cliente.
--
-- COMO LER: quase sempre é o telefone do SÍNDICO, não do cliente. Quando o
-- mesmo número aparece numa pessoa física e num condomínio (LUAN e RESIDENCIAL
-- DI MARIA, por exemplo), isso descreve a relação contato ↔ cliente — o síndico
-- é a pessoa, o condomínio é quem paga. Não são duplicatas.
-- Duplicata real é quando os dois nomes são variações da MESMA pessoa
-- (RENATA / Renatta Terra Treptow). Só esse caso pode ser unificado.
--
-- CONSEQUÊNCIA PRÁTICA: telefone serve como evidência de apoio numa tela de
-- confirmação, nunca como critério automático de fusão.
select regexp_replace(tel_cliente, '[^0-9]', '', 'g') as telefone,
       count(distinct trim(cliente))                  as nomes_distintos,
       string_agg(distinct trim(cliente), ' | ')      as nomes
  from orcamentos
 where length(regexp_replace(coalesce(tel_cliente, ''), '[^0-9]', '', 'g')) >= 10
 group by 1
having count(distinct trim(cliente)) > 1
 order by 2 desc;
