-- ══════════════════════════════════════════════════════════════════════════════
--  OFICINA — Tarefa 3h.1: oficina_contatos (18/08)
--
--  A base de tudo do fluxo novo (FLUXO-OFICINA.md). Um reparo em "aguardando
--  aprovação" há 31 dias não está travado por falta de tela — está travado
--  porque ninguém sabe se já foi cobrado. Esta tabela registra CADA tentativa
--  de contato (canal, data, quem fez), não um campo que se sobrescreve —
--  é o rastro que falta pra saber "faz quanto tempo desde o último contato" e
--  cobrar de novo sem perguntar a ninguém.
--
--  Uma linha por tentativa. Nunca UPDATE, só INSERT.
--
--  canal: 'whatsapp' | 'pdf' | 'ligacao' | 'balcao' | 'aviso_pronto'
--  resultado: 'enviado' | 'sem_resposta' | 'aprovado' | 'recusado' | 'avisado'
--
--  Mesmo padrão de id text app-gerado de oficina_reparos/oficina_status_log
--  (não uuid server-gerado) — client já sabe o id na hora de criar, offline.
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS oficina_contatos (
  id text PRIMARY KEY,
  reparo_id text NOT NULL,
  canal text NOT NULL,
  resultado text,
  obs text,
  usuario_id text,
  data timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_of_contatos_reparo ON oficina_contatos(reparo_id, data DESC);

ALTER TABLE oficina_contatos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon full access" ON oficina_contatos;
CREATE POLICY "anon full access" ON oficina_contatos FOR ALL TO anon USING (true) WITH CHECK (true);
