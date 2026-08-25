-- ============================================================================
-- Push Subscriptions — App de celular, Fase C (porte do FluxaSaas-/v2, Sprint 1)
-- Aplicado ao banco em 24/08 via Management API. Arquivo é o histórico.
-- ============================================================================
-- Diferença importante em relação ao v2: o v1 NÃO tem Supabase Auth (sessão
-- é nome+PIN em sessionStorage/localStorage) — não existe auth.uid()/
-- empresa_id aqui. Cada inscrição carrega o nome/perfil/loja da SESSÃO no
-- momento em que o dispositivo se inscreveu (perfil é usado só pra filtrar
-- quem recebe o quê — ex.: só gestor/master no aviso de orçamento aprovado).
--
-- RLS segue o padrão universal do v1 ("anon full access", igual a toda
-- tabela existente) — o controle de quem PODE gravar aqui é o mesmo do
-- resto do app: perfil é guardrail de UI, RLS real do v1 é "authenticated
-- não existe, anon é tudo".

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id text PRIMARY KEY,             -- app gera id texto (ex.: 'push_...')
  usuario_nome text NOT NULL,      -- getSessao().nome — único identificador estável do v1
  perfil text,                     -- getSessao().perfil no momento da inscrição
  loja_id text,                    -- getSessao().loja_id (null = gestor principal, vê grupo todo)
  endpoint text NOT NULL UNIQUE,   -- URL do push service (FCM/APNs por baixo, padrão Web Push)
  p256dh text NOT NULL,
  auth_key text NOT NULL,
  user_agent text,
  ativo boolean DEFAULT true,
  criado_em timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_sub_loja ON push_subscriptions(loja_id);
CREATE INDEX IF NOT EXISTS idx_push_sub_perfil ON push_subscriptions(perfil);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon full access" ON push_subscriptions;
CREATE POLICY "anon full access" ON push_subscriptions FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── pg_net — necessário pro banco chamar a Edge Function sem expor o
-- segredo interno ao cliente (o cliente do v1 só tem a anon key, pública) ──
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ── Segredo interno guardado no Vault — nunca no cliente, nunca em texto
-- plano numa tabela comum. Mesmo valor precisa ser configurado como env var
-- (PUSH_INTERNAL_SECRET) na Edge Function enviar-push, no painel do
-- Supabase (passo manual — ver instruções fora deste arquivo). ──
SELECT vault.create_secret(
  '__SUBSTITUIR_PELO_VALOR_GERADO__',
  'push_internal_secret',
  'Segredo compartilhado entre o trigger de push e a Edge Function enviar-push'
) WHERE NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'push_internal_secret');

-- ── Gatilho: orçamento aprovado (pelo portal OU manualmente) → avisa
-- gestor/master da loja. Dispara em QUALQUER caminho que aprove (não só o
-- portal) — mais simples e mais seguro que amarrar num RPC específico, já
-- que o v1 não tem um; o segredo nunca passa pelo cliente porque quem
-- chama a Edge Function é o próprio Postgres, não o navegador. ──
CREATE OR REPLACE FUNCTION _notificar_orcamento_aprovado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'push_internal_secret';
  IF v_secret IS NULL THEN
    RETURN NEW; -- segredo ainda não configurado — não trava a aprovação do orçamento
  END IF;

  PERFORM net.http_post(
    url := 'https://lbxwclwzeqqtnwvlxsxs.functions.supabase.co/enviar-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    body := jsonb_build_object(
      'loja_id', NEW.loja_id,
      'perfis_alvo', jsonb_build_array('gestor', 'master'),
      'titulo', '✅ Orçamento aprovado!',
      'corpo', coalesce(NEW.cliente, 'Cliente') || ' aprovou o orçamento #' || NEW.numero || ' — R$ ' || to_char(NEW.total, 'FM999G999G990D00'),
      'url', '/'
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_orcamento_aprovado ON orcamentos;
CREATE TRIGGER trg_notificar_orcamento_aprovado
  AFTER UPDATE ON orcamentos
  FOR EACH ROW
  WHEN (COALESCE(OLD.status, '') IS DISTINCT FROM 'aprovado' AND NEW.status = 'aprovado')
  EXECUTE FUNCTION _notificar_orcamento_aprovado();
