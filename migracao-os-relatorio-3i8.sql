-- Tarefa 3i.8 (19/08) — o relatório de serviço executado.
-- os_materiais: linha por material realmente aplicado na OS (id text
-- app-gerado, mesmo padrão de oficina_reparos/fornecedores) — hoje
-- ordens_servico.materiais é só texto; reabrir uma OS salva mostra a
-- string, não os chips (limitação registrada em 13/08). Migrar o texto
-- existente não é necessário; OS antiga mostra o texto como está.
CREATE TABLE IF NOT EXISTS os_materiais (
  id text PRIMARY KEY,
  os_id text,
  produto_id text,
  qtd numeric,
  custo_unit numeric,
  data_criacao timestamptz DEFAULT now()
);
ALTER TABLE os_materiais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon full access" ON os_materiais;
CREATE POLICY "anon full access" ON os_materiais FOR ALL TO anon USING (true) WITH CHECK (true);

-- relatorio_enviado_em: já antecipado pela trilha da 3i.6 (_osTrilhaNos lê
-- este campo desde 19/08, nó "Relatório enviado" ficava sempre tracejado
-- até existir). null = relatório ainda não foi enviado ao cliente.
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS relatorio_enviado_em timestamptz;

-- recomendacoes: mesmo padrão de vistorias.recomendacoes (06/08) — texto
-- livre do técnico, capturado no modal "Finalizar serviço" (3i.7),
-- mostrado em destaque no relatório. Desvio pequeno do "única mudança de
-- schema" que o plano original previa (escrito antes da 3i.7 existir com
-- seu campo de recomendação) — registrado no CLAUDE.md.
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS recomendacoes text;
