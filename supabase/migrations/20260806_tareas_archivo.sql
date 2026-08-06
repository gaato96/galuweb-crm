-- ============================================================
-- Historial de tareas completadas
-- ============================================================
-- Las tareas completadas se acumulaban en el tablero para siempre. Ahora se
-- archivan: salen del tablero pero quedan consultables en el historial.
--
-- Ejecutar en Supabase → SQL Editor.
-- ============================================================

ALTER TABLE tareas ADD COLUMN IF NOT EXISTS archivada BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS fecha_completada TIMESTAMPTZ;
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS fecha_archivada TIMESTAMPTZ;

-- El tablero filtra por archivada = false en cada carga.
CREATE INDEX IF NOT EXISTS idx_tareas_archivada ON tareas(archivada);

-- A las tareas ya completadas antes de este cambio se les pone una fecha de
-- referencia, para que el historial no las muestre sin fecha.
UPDATE tareas
SET fecha_completada = COALESCE(fecha_completada, created_at)
WHERE estado = 'completada' AND fecha_completada IS NULL;
