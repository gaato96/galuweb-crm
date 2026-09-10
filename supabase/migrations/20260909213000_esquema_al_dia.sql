-- ============================================================
-- Prospección — poner el esquema al día de una sola pasada
-- 2026-09-09
-- ============================================================
--
-- Por qué existe esta migración, que no agrega nada nuevo:
--
-- Las migraciones de este repo se nombran `YYYYMMDD_nombre.sql`, y el CLI de
-- Supabase toma como VERSIÓN el número de adelante. El 2026-09-05 se crearon
-- dos el mismo día —`20260905_odontologia_sarvo` y `20260905_seguimiento_acordado`—
-- o sea dos archivos distintos con la misma versión. Cuando se aplicó el
-- primero, esa versión quedó registrada como hecha y el segundo no volvió a
-- correr nunca. Resultado: la tabla se quedó sin `fecha_acuerdo` ni
-- `fecha_ultimo_toque`, y copiar un prospecto a otro sistema explotaba con
-- PGRST204 ("Could not find the 'fecha_acuerdo' column").
--
-- El archivo que colisionaba ya se renombró a `20260906_seguimiento_acordado.sql`.
-- Esta migración es el cinturón de seguridad: vuelve a declarar TODAS las
-- columnas que el código necesita hoy, con IF NOT EXISTS, así no importa en qué
-- estado haya quedado la base. Correrla dos veces no hace nada.

-- ── Sistema "odontologia" (Sarvo): la prueba de la hora ──────
ALTER TABLE prospectos
  ADD COLUMN IF NOT EXISTS prueba_enviada_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS prueba_respondida_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS prueba_sin_respuesta BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Estado "acordado": el acuerdo que todavía no es trabajo ──
-- Estas dos son las que faltaban.
ALTER TABLE prospectos
  ADD COLUMN IF NOT EXISTS fecha_acuerdo DATE,
  ADD COLUMN IF NOT EXISTS fecha_ultimo_toque DATE;

-- ── Sello del escaneo automático ─────────────────────────────
ALTER TABLE prospectos
  ADD COLUMN IF NOT EXISTS escaneado_at TIMESTAMPTZ;

-- ── Restricciones e índices, por si vinieron en el archivo que no corrió ──
ALTER TABLE prospectos DROP CONSTRAINT IF EXISTS prospectos_prueba_coherente;
ALTER TABLE prospectos
  ADD CONSTRAINT prospectos_prueba_coherente CHECK (
    prueba_respondida_at IS NULL
    OR (prueba_enviada_at IS NOT NULL AND prueba_respondida_at >= prueba_enviada_at)
  );

ALTER TABLE prospectos DROP CONSTRAINT IF EXISTS prospectos_toque_coherente;
ALTER TABLE prospectos
  ADD CONSTRAINT prospectos_toque_coherente CHECK (
    fecha_ultimo_toque IS NULL
    OR (fecha_acuerdo IS NOT NULL AND fecha_ultimo_toque >= fecha_acuerdo)
  );

CREATE INDEX IF NOT EXISTS idx_prospectos_prueba
  ON prospectos (prueba_enviada_at, prueba_respondida_at)
  WHERE prueba_enviada_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prospectos_acordados
  ON prospectos (fecha_ultimo_toque NULLS FIRST, fecha_acuerdo)
  WHERE estado = 'acordado';

CREATE INDEX IF NOT EXISTS idx_prospectos_sin_escanear
  ON prospectos (sistema)
  WHERE escaneado_at IS NULL;

-- ── Verificación ─────────────────────────────────────────────
-- Si algo quedó afuera, esto lo dice en vez de fallar recién en la aplicación.
DO $$
DECLARE
  faltan TEXT;
BEGIN
  SELECT string_agg(c, ', ') INTO faltan
  FROM unnest(ARRAY[
    'prueba_enviada_at', 'prueba_respondida_at', 'prueba_sin_respuesta',
    'fecha_acuerdo', 'fecha_ultimo_toque', 'escaneado_at'
  ]) AS c
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prospectos' AND column_name = c
  );

  IF faltan IS NOT NULL THEN
    RAISE EXCEPTION 'Faltan columnas en prospectos: %', faltan;
  END IF;
END $$;
