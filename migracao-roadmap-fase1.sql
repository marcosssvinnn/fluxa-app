-- ══════════════════════════════════════════════════════════════════════
--  Roadmap de indicadores — Fase 1 (financeiro). APLICADO em 2026-08-07
--  no projeto lbxwclwzeqqtnwvlxsxs. Este arquivo é o histórico.
--  ADITIVO: nada renomeado, apagado ou mudado de tipo.
-- ══════════════════════════════════════════════════════════════════════

-- 1.1 — Contas a receber por PARCELA. Antes era um escalar
-- (orcamentos.valor_recebido): sem vencimento, sem data de pagamento, sem
-- linha por parcela — logo sem aging, PMR, inadimplência ou projeção de caixa.
-- orcamentos.valor_recebido NÃO foi tocado: o histórico depende dele.
create table if not exists recebimentos (
  id             text primary key,
  orcamento_id   uuid,
  loja_id        text,
  parcela_n      integer,
  parcelas_total integer,
  vencimento     date,
  valor          numeric(12,2) not null,
  data_pagamento date,
  forma          text,
  obs            text,
  origem         text default 'app',
  data_criacao   timestamptz default now()
);
create index if not exists idx_receb_orc  on recebimentos(orcamento_id);
create index if not exists idx_receb_venc on recebimentos(vencimento) where data_pagamento is null;
create index if not exists idx_receb_loja on recebimentos(loja_id);
alter table recebimentos enable row level security;
drop policy if exists "anon full access" on recebimentos;
create policy "anon full access" on recebimentos for all to anon using (true) with check (true);

-- 1.2 — Despesas nasciam de uma OS (tecnico, os_numero), então aluguel,
-- salário, contador e software não cabiam — e a tabela ficou com 0 registros.
alter table despesas add column if not exists categoria      text;
alter table despesas add column if not exists centro_custo   text;
alter table despesas add column if not exists competencia    text;
alter table despesas add column if not exists recorrente     boolean default false;
alter table despesas add column if not exists fornecedor_id  text;
alter table despesas add column if not exists data_pagamento date;
comment on column despesas.competencia  is 'Mes de referencia YYYY-MM. Diferente da data de pagamento: aluguel de agosto pago em setembro pertence a agosto.';
comment on column despesas.centro_custo is 'fixo|variavel|campo|administrativo';
comment on column despesas.recorrente   is 'Se true, o app lembra de lancar no mes seguinte.';

-- ══════════════════════════════════════════════════════════════════════
--  Fase 3 — identidade do cliente. APLICADO em 2026-08-07.
--  orcamentos.cliente e TEXTO LIVRE: 216 nomes para 141 fichas, e nenhum
--  orcamento aponta para uma ficha. Sem isso nao ha LTV, recompra, ABC de
--  cliente nem base instalada por cliente.
--  ⚠️ Backfill SO com confirmacao humana (tela "Identidade"): CNPJ e da
--  ADMINISTRADORA e telefone e do SINDICO — 5 CNPJs e 4 telefones sao
--  compartilhados por clientes DIFERENTES. Casar por eles funde clientes.
-- ══════════════════════════════════════════════════════════════════════
alter table orcamentos      add column if not exists cliente_id text;
alter table ordens_servico  add column if not exists cliente_id text;
alter table vistorias       add column if not exists cliente_id text;
alter table equipamentos    add column if not exists cliente_id text;
alter table locais_vistoria add column if not exists cliente_id text;
create index if not exists idx_orc_cliente_id on orcamentos(cliente_id);
create index if not exists idx_os_cliente_id  on ordens_servico(cliente_id);
create index if not exists idx_vis_cliente_id on vistorias(cliente_id);

-- ══════════════════════════════════════════════════════════════════════
--  Fase 4 — base instalada. APLICADO em 2026-08-07.
--  `equipamentos` tinha 0 registros, mas os equipamentos ja existem dentro do
--  jsonb das vistorias (o Infinity Coast Tower sozinho tem 51).
-- ══════════════════════════════════════════════════════════════════════
alter table equipamentos add column if not exists ambiente text;
alter table equipamentos add column if not exists origem   text;
comment on column equipamentos.ambiente is 'Onde o equipamento fica. Faz parte da IDENTIDADE: predios tem equipamentos identicos em ambientes diferentes — sem isto a importacao duplica.';
comment on column equipamentos.origem   is 'vistoria|manual';
