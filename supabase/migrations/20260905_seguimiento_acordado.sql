-- ============================================================
-- Prospección — el acuerdo que todavía no es trabajo
-- 2026-09-05
-- ============================================================
--
-- El caso: IMC Marketing contestó que sí, que van a usar a Galu como proveedor
-- de diseño web y que avisan a medida que les entren clientes de ese servicio.
-- Eso no tenía dónde vivir en el CRM. "respondio" se queda corto —ya pasó esa
-- etapa— y "cliente" es falso —no facturó un peso—, así que un acuerdo cerrado
-- se caía del embudo y quedaba dependiendo de que uno se acuerde.
--
-- Y es justo lo que no se puede perder: la meta del carril de agencias, escrita
-- en el plan, es "una agencia mandando trabajo repetido". Ese estado ES la meta.
--
-- Lo que mata un acuerdo así no es que digan que no. Es que a las seis semanas
-- no se acuerden de que existís, y cuando les entra el cliente de web se lo dan
-- a otro. Por eso el estado nuevo no es un estado cerrado: tiene su propio reloj.

-- `estado` es TEXT sin CHECK, así que el valor "acordado" no necesita migración.
-- Lo que sí hace falta son las dos fechas que hacen andar el reloj.

ALTER TABLE prospectos
  -- Cuándo dijo que sí. Arranca la cuenta y no se pisa nunca más.
  ADD COLUMN IF NOT EXISTS fecha_acuerdo DATE,
  -- Último toque de vigencia. Se pisa en cada toque y reinicia los 21 días.
  ADD COLUMN IF NOT EXISTS fecha_ultimo_toque DATE;

COMMENT ON COLUMN prospectos.fecha_acuerdo IS
  'Cuándo acordó ser cliente/proveedor sin que haya trabajo todavía. Estado "acordado".';
COMMENT ON COLUMN prospectos.fecha_ultimo_toque IS
  'Último toque de vigencia. La cadencia es de 21 días — ver DIAS_VIGENCIA en prospeccion.ts.';

-- No se puede haber tocado antes de acordar.
ALTER TABLE prospectos
  DROP CONSTRAINT IF EXISTS prospectos_toque_coherente;
ALTER TABLE prospectos
  ADD CONSTRAINT prospectos_toque_coherente CHECK (
    fecha_ultimo_toque IS NULL
    OR (fecha_acuerdo IS NOT NULL AND fecha_ultimo_toque >= fecha_acuerdo)
  );

-- Los acuerdos vencidos son la consulta que se hace todos los días: se ordena
-- por el toque más viejo primero.
CREATE INDEX IF NOT EXISTS idx_prospectos_acordados
  ON prospectos (fecha_ultimo_toque NULLS FIRST, fecha_acuerdo)
  WHERE estado = 'acordado';
