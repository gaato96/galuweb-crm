-- ============================================================
-- Esperas al cliente: los plazos se corren mientras falta algo suyo
-- 2026-10-05
-- ============================================================
-- Por qué: si el cliente no manda el brief o el material pedido, el
-- proyecto no puede avanzar, pero las fases seguían venciendo igual.
--
-- Qué agrega en proyectos:
--   · esperas_cliente: tramos en los que se espera al cliente (brief,
--     pedidos que frenan el proyecto, o pausas manuales). JSONB.
--   · dias_espera_aplicados: cuántos días de espera ya se sumaron a los
--     plazos guardados (fases pendientes, entrega y tareas), para que
--     correrlos sea idempotente y se pueda volver atrás.
--
-- Es idempotente: correrla dos veces no hace nada.
-- Ejecutar entera en el SQL Editor de Supabase.
-- ============================================================

ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS esperas_cliente JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dias_espera_aplicados INTEGER NOT NULL DEFAULT 0;

-- ── Verificación ─────────────────────────────────────────────
DO $$
DECLARE
  faltan TEXT;
BEGIN
  SELECT string_agg(c, ', ') INTO faltan
  FROM unnest(ARRAY['esperas_cliente', 'dias_espera_aplicados']) AS c
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proyectos' AND column_name = c
  );
  IF faltan IS NOT NULL THEN
    RAISE EXCEPTION 'Faltan columnas en proyectos: %', faltan;
  END IF;
END $$;
