-- ============================================================
-- Migração: tabela de auditoria (histórico de ações no banco)
-- Hoje o log de ações fica só no localStorage — trocar de aparelho
-- ou limpar o navegador apaga o histórico. O app já tenta gravar
-- cada ação nesta tabela; basta criá-la para o histórico ficar
-- centralizado e à prova de troca de dispositivo.
--
-- Como rodar: Supabase → SQL Editor → cole tudo → Run. Seguro repetir.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.auditoria (
  id       text PRIMARY KEY,
  usuario  text,
  perfil   text,
  acao     text,
  detalhe  text,
  loja_id  text,
  data     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auditoria_data_idx ON public.auditoria (data DESC);

-- RLS: o app usa a chave anônima. Liberamos leitura/escrita nesta tabela
-- de log (não contém dados sensíveis além de nome/ação). Ajuste conforme
-- sua política de segurança se quiser restringir.
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS auditoria_rw ON public.auditoria;
CREATE POLICY auditoria_rw ON public.auditoria
  FOR ALL USING (true) WITH CHECK (true);
