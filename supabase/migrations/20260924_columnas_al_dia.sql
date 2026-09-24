-- ============================================================
-- Poner al día las columnas de tareas, proyectos y finanzas
-- 2026-09-24
-- ============================================================
-- Por qué: al cargar tareas sugeridas en una fase, Supabase respondió
-- PGRST204 "Could not find the 'fecha_vencimiento' column of 'tareas'".
-- La base de producción nunca recibió varias columnas que schema.sql
-- declara y que el código usa hace tiempo. Esta migración las agrega
-- todas con IF NOT EXISTS: si ya están, no toca nada.
--
-- Ejecutar entera en el SQL Editor de Supabase.
-- ============================================================

-- ── Tareas ───────────────────────────────────────────────────
ALTER TABLE tareas
  ADD COLUMN IF NOT EXISTS bloque TEXT,
  ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE,
  ADD COLUMN IF NOT EXISTS hora_recordatorio TEXT,
  ADD COLUMN IF NOT EXISTS pasos JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tipo_tarea TEXT DEFAULT 'puntual',
  ADD COLUMN IF NOT EXISTS frecuencia_recurrente TEXT,
  ADD COLUMN IF NOT EXISTS ultima_ejecucion TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS idea_contenido TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS hook TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS guion TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS notas_visuales TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS plataformas TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS formato TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS workflow_stage TEXT,
  ADD COLUMN IF NOT EXISTS editado BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS publicado BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS archivada BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fecha_completada TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_archivada TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fase TEXT;

CREATE INDEX IF NOT EXISTS idx_tareas_proyecto_fase ON tareas(proyecto_id, fase);

-- ── Proyectos ────────────────────────────────────────────────
ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS contrato_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS fecha_entrega DATE,
  ADD COLUMN IF NOT EXISTS tipo_propio TEXT DEFAULT 'web_propia',
  ADD COLUMN IF NOT EXISTS stack_tecnologico TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS notas_negocio TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS url_producto TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS fases JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS documentos JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS figma_aprobado BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS figma_comentarios TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS saas_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS version TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS usuarios_activos INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS membresias JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fecha_inicio DATE,
  ADD COLUMN IF NOT EXISTS monto_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS links JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS brief JSONB DEFAULT NULL;

-- ── Finanzas ─────────────────────────────────────────────────
ALTER TABLE finanzas
  ADD COLUMN IF NOT EXISTS cobrado BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS fecha_cobrado DATE,
  ADD COLUMN IF NOT EXISTS es_recurrente BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS grupo_cuota TEXT;

-- Que la API de Supabase vea las columnas nuevas ya mismo
-- (el error PGRST204 sale de este caché).
NOTIFY pgrst, 'reload schema';

-- ── Verificación ─────────────────────────────────────────────
DO $$
DECLARE
  faltan TEXT;
BEGIN
  SELECT string_agg(t || '.' || c, ', ') INTO faltan
  FROM (VALUES
    ('tareas', 'fecha_vencimiento'), ('tareas', 'fase'), ('tareas', 'pasos'),
    ('tareas', 'archivada'), ('tareas', 'fecha_completada'),
    ('proyectos', 'fases'), ('proyectos', 'documentos'), ('proyectos', 'monto_total'),
    ('proyectos', 'brief'), ('proyectos', 'links'), ('proyectos', 'fecha_inicio'),
    ('finanzas', 'cobrado'), ('finanzas', 'grupo_cuota')
  ) AS x(t, c)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = x.t AND column_name = x.c
  );
  IF faltan IS NOT NULL THEN
    RAISE EXCEPTION 'Siguen faltando columnas: %', faltan;
  END IF;
END $$;
