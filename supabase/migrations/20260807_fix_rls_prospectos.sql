-- ============================================================
-- FIX — "new row violates row-level security policy" en prospectos
-- ============================================================
-- Diagnóstico: la tabla quedó con RLS ACTIVADA y sin ninguna política.
-- En ese estado, la lectura no falla (devuelve vacío) pero toda escritura
-- se rechaza con 42501. Por eso la pantalla cargaba y solo fallaba importar.
--
-- Se deja la tabla igual que el resto del CRM: sin RLS. Es la misma postura
-- de seguridad que ya tienen clientes, proyectos y tareas — ni mejor ni peor.
-- El cierre real de la base es la "migración al servidor" documentada en
-- 20260806_seguridad_rls.sql, que aplica a todas las tablas a la vez.
--
-- Ejecutar en Supabase → SQL Editor.
-- ============================================================

ALTER TABLE prospectos DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON prospectos TO anon;

-- Verificación: rowsecurity debe quedar en false.
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'prospectos';
