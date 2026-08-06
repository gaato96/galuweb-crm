-- ============================================================
-- Planilla de Prospectos — soporte multi-sistema (Galu + VivoMenu)
-- ============================================================
-- Un mismo prospecto en Maps puede calificar para más de un sistema, así que
-- se agrega una columna en vez de duplicar la tabla. El índice único de
-- (negocio, ciudad) pasa a incluir el sistema para que un mismo negocio
-- pueda existir una vez del lado Galu y otra del lado VivoMenu.
--
-- Ejecutar en Supabase → SQL Editor.
-- ============================================================

ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS sistema TEXT NOT NULL DEFAULT 'galu';

-- VivoMenu tiene un tercer follow-up (día 14) que Galu no usa.
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS fecha_fu3 DATE;

CREATE INDEX IF NOT EXISTS idx_prospectos_sistema ON prospectos(sistema);

-- El índice único original era (negocio, ciudad). Se reemplaza por uno que
-- incluye sistema, para que "Burger House" pueda prospectarse por Galu (web)
-- y por VivoMenu (menú digital) sin chocar entre sí.
DROP INDEX IF EXISTS idx_prospectos_unico;
CREATE UNIQUE INDEX IF NOT EXISTS idx_prospectos_unico
  ON prospectos (lower(negocio), lower(ciudad), sistema);
