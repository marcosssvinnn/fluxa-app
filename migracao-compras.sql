-- ============================================================================
-- MIGRAÇÃO — Fornecedores e Ordens de Compra
-- Status: ✅ APLICADA em 2026-08-06. Mantida como referência e para novas empresas.
-- ============================================================================
-- Por que existe: o app JÁ TEM a feature completa de compras — tela de
-- Fornecedores, cadastro, criação de Ordem de Compra, marcar como recebida
-- (`loadFornecedores`, `salvarFornecedor`, `salvarOC`, `receberOC` em app.js).
-- Mas as duas tabelas nunca foram criadas neste banco.
--
-- Consequências hoje:
--   1. Fornecedores e OCs vivem SÓ no localStorage: trocou de aparelho ou
--      limpou o navegador, perdeu tudo. Nada sincroniza entre Camboriú e
--      Itapema.
--   2. O app dispara ~48 erros HTTP 400 a cada carregamento tentando ler
--      essas tabelas. Não quebra nada (os loaders têm catch), mas polui o
--      console e pode mascarar erro real.
--
-- É a mesma classe de problema das colunas `recomendacoes`/`obs_ambientes`
-- em vistorias, corrigidas em 2026-08-06: o código grava, o banco não tem,
-- o wrapper resiliente descarta em silêncio.
--
-- Estrutura conferida contra o que o app realmente grava (app.js:
-- `salvarFornecedor` e `salvarOC`), não inventada.
-- 100% aditivo: nenhuma tabela existente é tocada.
-- ============================================================================

CREATE TABLE IF NOT EXISTS fornecedores (
  id            text PRIMARY KEY,        -- 'forn_<timestamp>'
  loja_id       text,
  nome          text,
  contato       text,
  whatsapp      text,                    -- só dígitos
  email         text,
  obs           text,
  ativo         boolean DEFAULT true,
  data_criacao  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ordens_compra (
  id               text PRIMARY KEY,     -- 'oc_<timestamp>'
  loja_id          text,
  numero           integer,
  fornecedor_id    text,
  data             text,                 -- 'YYYY-MM-DD'
  status           text DEFAULT 'rascunho',  -- rascunho | enviada | recebida
  itens            jsonb DEFAULT '[]',   -- [{produto_id, qtd, custo_unit}]
  total            numeric,
  obs              text,
  data_recebimento timestamptz,
  data_criacao     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fornec_loja ON fornecedores (loja_id);
CREATE INDEX IF NOT EXISTS idx_oc_loja     ON ordens_compra (loja_id, data_criacao DESC);

-- RLS no mesmo padrão das demais tabelas deste banco.
-- ⚠️ `anon full access` concede leitura E escrita a qualquer um com a anon key
-- (que está no código-fonte de um repo público). O controle de acesso real
-- acontece só no JS do cliente — vale para todas as tabelas daqui, não é
-- específico destas duas.
ALTER TABLE fornecedores  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordens_compra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon full access" ON fornecedores
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access" ON ordens_compra
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================================
-- DEPOIS DE RODAR, CONFERIR:
--   select table_name from information_schema.tables
--    where table_name in ('fornecedores','ordens_compra');
--   -- devem aparecer as duas
--
-- E abrir o app: os erros 400 do console devem sumir, e o que já estava no
-- localStorage passa a subir no próximo save.
-- ============================================================================
