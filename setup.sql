-- ════════════════════════════════════════════════════════════════════
--  FLUXA APP — SETUP COMPLETO DE UMA EMPRESA NOVA
--  Rode este arquivo UMA vez no SQL Editor do Supabase da empresa nova.
--  (Projeto novo e vazio. É seguro: só cria tabelas/políticas, não apaga dados.)
-- ════════════════════════════════════════════════════════════════════

-- ─────────────────────────────  TABELAS  ─────────────────────────────
CREATE TABLE IF NOT EXISTS orcamentos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  numero integer, cliente text, local_servico text,
  tel_cliente text, servicos jsonb,
  subtotal numeric(10,2), desconto numeric(10,2),
  total numeric(10,2), pagamento text,
  validade_dias integer, validade_data text,
  data_servico text, escopo text, obs text,
  foto_base64 text,
  valor_recebido numeric(10,2) DEFAULT 0,
  status text DEFAULT 'pendente',
  data_criacao timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ordens_servico (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  numero integer, orcamento_id uuid,
  cliente text, local_servico text,
  data_servico text, hora text,
  tecnico text, servicos jsonb,
  materiais text, obs_tecnica text,
  total numeric(10,2) DEFAULT 0,
  valor_recebido numeric(10,2) DEFAULT 0,
  status text DEFAULT 'agendado',
  data_criacao timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS empresa_config (
  id integer PRIMARY KEY DEFAULT 1,
  dados jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clientes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text, telefone text, endereco text,
  data_criacao timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agendamentos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente text, local_servico text, tecnico text,
  tipo_servico text, periodicidade text,
  dia_semana integer, horario text,
  data_inicio text, data_fim text, obs text,
  ativo boolean DEFAULT true,
  data_criacao timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vistorias (
  id text PRIMARY KEY,
  loja_id text, cliente text, local text,
  data text, hora text, tecnico text, mes_ref text,
  hora_checkin text, hora_checkout text,
  obs_geral text, email_responsavel text,
  equipamentos jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS equipamentos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid, cliente_nome text,
  tipo text, marca text, modelo text, potencia text,
  numero_serie text, data_instalacao text,
  garantia_meses integer DEFAULT 12, garantia_vencimento text,
  obs text, foto_base64 text,
  ativo boolean DEFAULT true,
  data_criacao timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS despesas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  os_id uuid, os_numero integer, tecnico text,
  data text, tipo text, valor numeric(10,2),
  descricao text, foto_base64 text,
  status text DEFAULT 'pendente',
  data_criacao timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lojas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text, cnpj text, razao_social text,
  inscricao_estadual text, inscricao_municipal text,
  regime_tributario text, endereco text, tel text, cidade text,
  logo_base64 text, cor_primaria text,
  focusnfe_token text, focusnfe_ambiente text DEFAULT 'homologacao',
  iss_aliquota numeric(5,2) DEFAULT 2.0,
  codigo_servico_municipal text DEFAULT '7.10',
  ativo boolean DEFAULT true,
  data_criacao timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usuarios (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL, pin text, perfil text DEFAULT 'tecnico',
  loja_id uuid, loja_nome text,
  ativo boolean DEFAULT true,
  data_criacao timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notas_fiscais (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id uuid, orcamento_id uuid,
  tipo text, referencia text UNIQUE,
  numero integer, serie text, chave_acesso text,
  status text DEFAULT 'pendente',
  xml_autorizado text, pdf_danfe_url text,
  protocolo text, motivo_rejeicao text, dados_envio jsonb,
  data_emissao timestamptz DEFAULT now(),
  data_criacao timestamptz DEFAULT now()
);

-- ─────────────  COLUNAS EXTRAS (idempotente, seguro re-rodar)  ─────────────
ALTER TABLE orcamentos     ADD COLUMN IF NOT EXISTS nota_interna text;
ALTER TABLE orcamentos     ADD COLUMN IF NOT EXISTS cnpj text;
ALTER TABLE orcamentos     ADD COLUMN IF NOT EXISTS loja_id text;
ALTER TABLE orcamentos     ADD COLUMN IF NOT EXISTS origem_cliente text;
ALTER TABLE orcamentos     ADD COLUMN IF NOT EXISTS assinatura_base64 text;
ALTER TABLE orcamentos     ADD COLUMN IF NOT EXISTS assinatura_data timestamptz;  -- quando foi assinado
ALTER TABLE orcamentos     ADD COLUMN IF NOT EXISTS assinatura_hash text;         -- anti-adulteração
ALTER TABLE orcamentos     ADD COLUMN IF NOT EXISTS assinatura_meta text;         -- dispositivo que assinou
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS fotos jsonb DEFAULT '[]';
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS video_link text;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS agendamento_id uuid;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS checkin_time timestamptz;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS checkout_time timestamptz;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS duracao_min integer;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS cnpj text;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS loja_id text;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS checklist text;
ALTER TABLE clientes       ADD COLUMN IF NOT EXISTS portal_token uuid DEFAULT gen_random_uuid();
ALTER TABLE clientes       ADD COLUMN IF NOT EXISTS portal_ativo boolean DEFAULT true;
ALTER TABLE clientes       ADD COLUMN IF NOT EXISTS cnpj text;
ALTER TABLE clientes       ADD COLUMN IF NOT EXISTS email_responsavel text;
ALTER TABLE clientes       ADD COLUMN IF NOT EXISTS loja_id text;
ALTER TABLE agendamentos   ADD COLUMN IF NOT EXISTS local_id text;
ALTER TABLE agendamentos   ADD COLUMN IF NOT EXISTS loja_id text;
ALTER TABLE vistorias      ADD COLUMN IF NOT EXISTS local_id text;
ALTER TABLE equipamentos   ADD COLUMN IF NOT EXISTS loja_id text;
ALTER TABLE despesas       ADD COLUMN IF NOT EXISTS loja_id text;

-- ─────────────  NÚMERO ÚNICO (anti-duplicata em uso simultâneo)  ─────────────
--  O app tenta o próximo número quando o banco recusa por duplicidade — mas só
--  funciona se existir o índice UNIQUE para o banco recusar de fato. Num banco
--  novo e vazio não há duplicatas, então a criação é segura.
CREATE UNIQUE INDEX IF NOT EXISTS orcamentos_numero_unico     ON orcamentos (numero);
CREATE UNIQUE INDEX IF NOT EXISTS ordens_servico_numero_unico ON ordens_servico (numero);

-- ─────────────  LOCAIS DE VISTORIA (planos recorrentes — 1 linha por local)  ─────────────
--  Antes ficavam num array dentro de empresa_config.dados → salvar reescrevia o
--  blob inteiro e dois gestores simultâneos sobrescreviam um ao outro. Agora cada
--  local é sua própria linha (sem clobber entre empresas). O app migra sozinho.
CREATE TABLE IF NOT EXISTS locais_vistoria (
  id text PRIMARY KEY,
  loja_id text,
  cliente text, local text,
  email_responsavel text, tecnico text,
  dia_pref text, hora_pref text,
  equipamentos jsonb DEFAULT '[]',
  agendamento_id text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_locais_loja ON locais_vistoria(loja_id);

-- ─────────────  ESTOQUE  ─────────────
CREATE TABLE IF NOT EXISTS produtos (
  id text PRIMARY KEY,
  loja_id text,
  nome text, codigo text, unidade text DEFAULT 'un',
  preco_venda numeric(10,2) DEFAULT 0,
  custo numeric(10,2) DEFAULT 0,
  estoque_minimo numeric(10,2) DEFAULT 0,
  -- campos fiscais (preenchidos quando ativar NF-e de produto; ficam vazios até lá)
  ncm text, cest text, cfop_padrao text, origem text, gtin_ean text,
  ativo boolean DEFAULT true,
  data_criacao timestamptz DEFAULT now()
);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS lote text;      -- lote/código de lote do estoque
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS validade date;  -- validade do produto
ALTER TABLE usuarios       ADD COLUMN IF NOT EXISTS acessos jsonb DEFAULT '[]';  -- empresas separadas que o usuário acessa (ex.: ["aquamotor"]) — gerenciado na tela Usuários
CREATE TABLE IF NOT EXISTS estoque_movimentos (
  id text PRIMARY KEY,
  loja_id text,
  produto_id text,
  tipo text,                 -- 'entrada' | 'saida' | 'ajuste'
  quantidade numeric(10,2),  -- entrada/ajuste+ positivo; saida negativo
  custo_unit numeric(10,2),
  motivo text,
  ref text,                  -- referência única p/ idempotência (ex: 'orc:<id>')
  usuario text,
  data timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mov_produto ON estoque_movimentos(produto_id);
CREATE INDEX IF NOT EXISTS idx_mov_ref ON estoque_movimentos(ref);

-- ─────────────  AUDITORIA (quem fez o quê — segurança/responsabilidade)  ─────────────
CREATE TABLE IF NOT EXISTS auditoria (
  id text PRIMARY KEY,
  usuario text, perfil text,
  acao text,                 -- ex: 'login' | 'orcamento_status' | 'estoque_mov' | 'os_concluida' | 'usuario_editado'
  detalhe text,
  loja_id text,
  data timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aud_data ON auditoria(data DESC);

-- ─────────────  RLS: acesso pela anon key (igual ao resto do app)  ─────────────
--  ⚠️ A anon key é pública. O controle de acesso real é feito no app (perfis/PIN).
--  Para isolar de verdade, cada empresa tem o SEU próprio projeto Supabase.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'orcamentos','ordens_servico','empresa_config','clientes','agendamentos',
    'vistorias','equipamentos','despesas','lojas','usuarios','notas_fiscais',
    'produtos','estoque_movimentos','auditoria','locais_vistoria'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "anon full access" ON %I;', t);
    EXECUTE format('CREATE POLICY "anon full access" ON %I FOR ALL TO anon USING (true) WITH CHECK (true);', t);
  END LOOP;
END $$;

-- ─────────────  REALTIME (sync entre dispositivos)  ─────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['orcamentos','clientes','agendamentos','equipamentos','despesas','vistorias','produtos','estoque_movimentos','locais_vistoria'] LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I;', t);
    EXCEPTION WHEN duplicate_object THEN NULL; -- já está na publicação
    END;
  END LOOP;
END $$;

-- ─────────────  STORAGE: bucket de PDFs das vistorias  ─────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('vistorias-pdf', 'vistorias-pdf', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "fluxa upload vistorias-pdf" ON storage.objects;
CREATE POLICY "fluxa upload vistorias-pdf" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'vistorias-pdf');

DROP POLICY IF EXISTS "fluxa update vistorias-pdf" ON storage.objects;
CREATE POLICY "fluxa update vistorias-pdf" ON storage.objects
  FOR UPDATE TO anon USING (bucket_id = 'vistorias-pdf');

DROP POLICY IF EXISTS "fluxa read vistorias-pdf" ON storage.objects;
CREATE POLICY "fluxa read vistorias-pdf" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'vistorias-pdf');

-- ════════════════════════════════════════════════════════════════════
--  PRONTO. Agora preencha o config.js da empresa (URL + anon key + lojas)
--  e faça o deploy. Veja NOVA-EMPRESA.md.
-- ════════════════════════════════════════════════════════════════════
