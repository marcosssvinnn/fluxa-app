-- ============================================================
-- Migração: número único em orçamentos e ordens de serviço
-- Objetivo: impedir que dois usuários simultâneos gerem o MESMO
-- número (race condition). O app já tenta o próximo número quando
-- o banco recusa por duplicidade — mas isso só funciona se existir
-- o índice UNIQUE abaixo para o banco recusar de fato.
--
-- Como rodar: Supabase → SQL Editor → cole tudo → Run.
-- É seguro rodar mais de uma vez (IF NOT EXISTS).
--
-- ATENÇÃO: se já existirem números duplicados hoje, a criação do
-- índice vai falhar. Rode primeiro os SELECTs de verificação lá no
-- final para achar e corrigir duplicatas antes.
-- ============================================================

-- 1) Índice único do número do ORÇAMENTO
CREATE UNIQUE INDEX IF NOT EXISTS orcamentos_numero_unico
  ON public.orcamentos (numero);

-- 2) Índice único do número da ORDEM DE SERVIÇO
CREATE UNIQUE INDEX IF NOT EXISTS ordens_servico_numero_unico
  ON public.ordens_servico (numero);

-- ============================================================
-- VERIFICAÇÃO (rode ANTES se suspeitar de duplicatas):
-- Mostra números repetidos que impediriam a criação do índice.
-- ============================================================
-- SELECT numero, count(*)  FROM public.orcamentos      GROUP BY numero HAVING count(*) > 1 ORDER BY numero;
-- SELECT numero, count(*)  FROM public.ordens_servico  GROUP BY numero HAVING count(*) > 1 ORDER BY numero;
