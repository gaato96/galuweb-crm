-- ============================================================
-- ROLLBACK del bloque 1 de 20260806_seguridad_rls.sql
-- ============================================================
-- Por qué: el bloque 1 activaba RLS y revocaba `anon` sobre finanzas,
-- cotizaciones e infraestructura. Pero esas pantallas leen Supabase DESDE
-- EL NAVEGADOR con la anon key, así que quedan sin permisos y fallan.
--
-- Activar RLS en cualquier tabla exige, primero, que sus lecturas pasen por
-- el servidor. Ver la nota de "migración al servidor" en el README de
-- seguridad. Este script devuelve las tres tablas a su estado anterior.
--
-- Ejecutar en Supabase → SQL Editor.
-- ============================================================

ALTER TABLE finanzas        DISABLE ROW LEVEL SECURITY;
ALTER TABLE cotizaciones    DISABLE ROW LEVEL SECURITY;
ALTER TABLE infraestructura DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON finanzas        TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON cotizaciones    TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON infraestructura TO anon;

-- Verificación: las tres deben quedar en rowsecurity = false.
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('finanzas', 'cotizaciones', 'infraestructura');
