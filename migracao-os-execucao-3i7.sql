-- Tarefa 3i.7 (19/08) — modal "Finalizar serviço": confirmação por serviço
-- (Fiz / Não fiz + motivo). Aditiva, nullable — não migra nada retroativo.
-- OS sem esta coluna preenchida (todo o histórico existente) continua
-- funcionando normalmente, sem nenhuma leitura assumindo o campo presente.
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS servicos_execucao jsonb;
