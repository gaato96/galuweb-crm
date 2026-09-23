-- ============================================================
-- Gestión completa de proyectos de clientes
-- 2026-09-23
-- ============================================================
-- Qué agrega:
--   · Plazos: fecha de inicio (la de entrega ya existía). Los plazos por fase
--     viven dentro del JSONB `fases` (fecha_limite / fecha_completada).
--   · Monto cobrado por el proyecto y la cotización de la que salió. Los cobros
--     en sí siguen viviendo en `finanzas` (proyecto_id), que es la fuente de verdad.
--   · Links compartidos con el cliente y el brief del proyecto (JSONB).
--   · `tareas.fase`: a qué fase del roadmap pertenece cada tarea, para armar
--     el checklist fase por fase.
--   · Archivos del proyecto (los sube la agencia o el cliente desde el portal).
--   · Solicitudes al cliente ("mandame las fotos del local") que el cliente
--     responde desde el portal subiendo archivos.
--
-- Es idempotente: correrla dos veces no hace nada.
-- Ejecutar entera en el SQL Editor de Supabase.
-- ============================================================

ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS fecha_inicio DATE,
  ADD COLUMN IF NOT EXISTS monto_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cotizacion_id UUID REFERENCES cotizaciones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS links JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS brief JSONB DEFAULT NULL;

ALTER TABLE tareas
  ADD COLUMN IF NOT EXISTS fase TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_tareas_proyecto_fase ON tareas(proyecto_id, fase);

-- ── Archivos del proyecto ────────────────────────────────────
CREATE TABLE IF NOT EXISTS proyecto_archivos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'otro',        -- cotizacion | contrato | logo | imagen | documento | otro
  subido_por TEXT NOT NULL DEFAULT 'agencia',    -- agencia | cliente
  visible_cliente BOOLEAN NOT NULL DEFAULT true,
  solicitud_id UUID DEFAULT NULL,
  mime TEXT NOT NULL DEFAULT '',
  tamano BIGINT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_proyecto_archivos_proyecto ON proyecto_archivos(proyecto_id, created_at DESC);

-- ── Solicitudes al cliente ───────────────────────────────────
CREATE TABLE IF NOT EXISTS proyecto_solicitudes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  estado TEXT NOT NULL DEFAULT 'pendiente',       -- pendiente | entregada | aprobada
  respuesta_cliente TEXT NOT NULL DEFAULT '',
  fecha_limite DATE DEFAULT NULL,
  entregada_at TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_proyecto_solicitudes_proyecto ON proyecto_solicitudes(proyecto_id, estado);

ALTER TABLE proyecto_archivos
  DROP CONSTRAINT IF EXISTS proyecto_archivos_solicitud_fk;
ALTER TABLE proyecto_archivos
  ADD CONSTRAINT proyecto_archivos_solicitud_fk
  FOREIGN KEY (solicitud_id) REFERENCES proyecto_solicitudes(id) ON DELETE SET NULL;

-- Igual que el resto de las tablas del CRM hoy (ver 20260806_seguridad_rls.sql):
-- la app habla con Supabase desde el navegador con la anon key, y el portal
-- del cliente escribe acá sin login. Si Supabase creó las tablas con RLS
-- activada por defecto, la app no podría leerlas ni escribirlas.
ALTER TABLE proyecto_archivos DISABLE ROW LEVEL SECURITY;
ALTER TABLE proyecto_solicitudes DISABLE ROW LEVEL SECURITY;

-- ── Verificación ─────────────────────────────────────────────
DO $$
DECLARE
  faltan TEXT;
BEGIN
  SELECT string_agg(c, ', ') INTO faltan
  FROM unnest(ARRAY['fecha_inicio', 'monto_total', 'cotizacion_id', 'links', 'brief']) AS c
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proyectos' AND column_name = c
  );
  IF faltan IS NOT NULL THEN
    RAISE EXCEPTION 'Faltan columnas en proyectos: %', faltan;
  END IF;
END $$;
