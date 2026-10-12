-- ============================================================
-- Formularios extra para el cliente, además del brief
-- 2026-10-12
-- ============================================================
-- Por qué: el brief no alcanza para todo. Antes de algunas fases hace falta
-- preguntarle al cliente en profundidad (ej: el detalle de cada curso que
-- vende), y eso se va armando a medida que avanza el proyecto.
--
-- Qué agrega en proyectos:
--   · formularios: lista de formularios (mismas secciones y preguntas que el
--     brief, con título, fase para la que se necesitan y si frenan el
--     proyecto). JSONB. El cliente los responde desde el portal.
--
-- Es idempotente: correrla dos veces no hace nada.
-- Ejecutar entera en el SQL Editor de Supabase.
-- ============================================================

ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS formularios JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ── Verificación ─────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proyectos' AND column_name = 'formularios'
  ) THEN
    RAISE EXCEPTION 'Falta la columna formularios en proyectos';
  END IF;
END $$;
