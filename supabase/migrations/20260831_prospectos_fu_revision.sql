-- ============================================================
-- Planilla de Prospectos — seguimiento post-análisis (§6)
-- ============================================================
-- "revision_enviada" no tenía fecha propia, así que quedaba fuera de la
-- cadencia de follow-up: una vez entregado el análisis, el sistema nunca
-- avisaba si pasaron días sin respuesta. Estas tres columnas arrancan y
-- registran la cadencia de dos toques (fu_revision1 a los 3-4 días,
-- fu_revision2 a los 7-10), igual que la de fecha_envio/fecha_fu1/fecha_fu2.
--
-- Ejecutar en Supabase → SQL Editor.
-- ============================================================

ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS fecha_revision DATE;
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS fecha_revision_fu1 DATE;
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS fecha_revision_fu2 DATE;
