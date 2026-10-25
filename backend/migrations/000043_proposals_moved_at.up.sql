-- Arrastar cards no quadro: moved_at é quando o card entrou na coluna atual (as
-- colunas ordenam por ele, então o card movido cai sempre no topo) e a janela
-- de 30 dias das concluídas/recusadas passa a contar daí. closed_by e
-- close_reason dizem quem encerrou a votação e como (time tech ou prazo).
ALTER TABLE proposals ADD COLUMN moved_at TIMESTAMPTZ NULL;
UPDATE proposals SET moved_at = COALESCE(closed_at, created_at);
ALTER TABLE proposals ALTER COLUMN moved_at SET NOT NULL;
ALTER TABLE proposals ALTER COLUMN moved_at SET DEFAULT NOW();

ALTER TABLE proposals ADD COLUMN closed_by UUID NULL REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE proposals ADD COLUMN close_reason VARCHAR(8) NULL
    CHECK (close_reason IN ('manual', 'deadline'));
UPDATE proposals SET close_reason = 'deadline' WHERE closed_at IS NOT NULL;
