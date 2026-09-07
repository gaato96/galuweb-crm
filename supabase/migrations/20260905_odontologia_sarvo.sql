-- ============================================================
-- Prospección — sistema "odontologia" (Sarvo) + la prueba de la hora
-- 2026-09-05
-- ============================================================
--
-- Contexto: notas/10-plan.md, Etapa 3. Se abre el cuarto sistema de
-- prospección, para consultorios odontológicos, con Sarvo como producto.
--
-- Lo único que hace falta del lado de la base son tres columnas, y las tres
-- existen por el mismo motivo. El plan manda escribirle al consultorio como
-- paciente un sábado a la noche preguntando el precio de una limpieza, y
-- anotar la hora exacta de la respuesta. Ese dato no es un adorno del CRM:
--
--   · es la primera línea del mensaje en frío ("les escribí el sábado 21:40 y
--     me contestaron el lunes 10:15"), y
--   · es lo que más pesa en el score del sistema, porque un consultorio que
--     contesta en diez minutos no tiene el problema que Sarvo resuelve.
--
-- Mientras vivía en un papel, el mensaje no se podía generar solo y el score
-- no lo podía usar. Por eso baja a columnas.
--
-- `sistema` es TEXT sin enum ni check, así que sumar "odontologia" no requiere
-- ninguna migración de tipo: alcanza con el cambio en TypeScript.

-- ── La prueba de la hora ─────────────────────────────────────
-- TIMESTAMPTZ y no DATE: la hora importa tanto como el día. La gracia del dato
-- es que dice "21:40 de un sábado", no "el 12 de septiembre".
ALTER TABLE prospectos
  ADD COLUMN IF NOT EXISTS prueba_enviada_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS prueba_respondida_at TIMESTAMPTZ,
  -- Nunca contestaron. Es un estado propio y no un dato faltante: para vender
  -- es el mejor caso posible, así que no puede quedar indistinguible de
  -- "todavía no corrí la prueba".
  ADD COLUMN IF NOT EXISTS prueba_sin_respuesta BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN prospectos.prueba_enviada_at IS
  'Cuándo se le escribió como paciente. Ver notas/10-plan.md, Etapa 3.';
COMMENT ON COLUMN prospectos.prueba_respondida_at IS
  'Cuándo contestaron. NULL + prueba_sin_respuesta=true significa que nunca lo hicieron.';

-- No se puede haber contestado antes de que se le escriba.
ALTER TABLE prospectos
  DROP CONSTRAINT IF EXISTS prospectos_prueba_coherente;
ALTER TABLE prospectos
  ADD CONSTRAINT prospectos_prueba_coherente CHECK (
    prueba_respondida_at IS NULL
    OR (prueba_enviada_at IS NOT NULL AND prueba_respondida_at >= prueba_enviada_at)
  );

-- La cola del día de odontología se ordena por demora: primero los que más
-- tardaron, que son los que tienen el dolor más grande y el mejor mensaje.
CREATE INDEX IF NOT EXISTS idx_prospectos_prueba
  ON prospectos (prueba_enviada_at, prueba_respondida_at)
  WHERE prueba_enviada_at IS NOT NULL;

-- ── Nada que migrar en listas_prospeccion ────────────────────
-- Los listados ya soportan cualquier sistema y ya tienen país, así que
-- "AR · Tucumán · Odontología" y "MX · Guadalajara · Odontología" conviven
-- sin cambios de esquema. Es lo que permite usar Tucumán como banco de prueba
-- del mensaje sin ensuciar la métrica de México: la tasa de respuesta se corta
-- por listado.
