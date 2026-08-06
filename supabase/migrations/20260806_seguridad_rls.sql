-- ============================================================
-- Galu-CRM — Cierre de la base de datos (RLS)
-- ============================================================
-- CONTEXTO: la app usa NEXT_PUBLIC_SUPABASE_ANON_KEY, que viaja en el bundle
-- del navegador y por lo tanto es pública. Con RLS desactivada, cualquiera
-- que la lea puede consultar y borrar TODAS las tablas sin pasar por la app.
-- El login del panel no alcanza: hay que cerrar también la base.
--
-- Este script deja las tablas accesibles SOLO para el rol `service_role`
-- (la clave secreta del servidor) y sin acceso para `anon`.
--
-- ⚠️ IMPORTANTE — LEER ANTES DE EJECUTAR:
-- Al correrlo, la app deja de leer datos hasta que muevas las llamadas a
-- Supabase al servidor con SUPABASE_SERVICE_ROLE_KEY. Si hoy necesitás el
-- CRM funcionando ya, ejecutá primero SOLO el bloque 1 (tablas del portal
-- público) y dejá el bloque 2 para cuando hagas la migración al servidor.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- BLOQUE 1 — Tablas sensibles que NUNCA debe ver el navegador.
-- Ninguna pantalla pública las usa, así que esto se puede aplicar ya.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE finanzas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotizaciones    ENABLE ROW LEVEL SECURITY;
ALTER TABLE infraestructura ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON finanzas, cotizaciones, infraestructura FROM anon;

-- ─────────────────────────────────────────────────────────────
-- BLOQUE 2 — El resto del CRM.
-- Ejecutar recién cuando las lecturas pasen por el servidor.
-- ─────────────────────────────────────────────────────────────

-- ALTER TABLE clientes          ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE proyectos         ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE tareas            ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE briefs            ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE recursos          ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE tickets           ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ideas             ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE logs_proyecto     ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE scraper_busquedas ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE prospectos        ENABLE ROW LEVEL SECURITY;
-- REVOKE ALL ON clientes, proyectos, tareas, briefs, recursos, tickets,
--               ideas, logs_proyecto, scraper_busquedas, prospectos FROM anon;

-- ─────────────────────────────────────────────────────────────
-- Nota sobre el portal del cliente (/portal/[slug]) y /briefs:
-- son las únicas pantallas que un tercero tiene que poder abrir. Cuando
-- actives el bloque 2, esas dos páginas tienen que leer desde el servidor
-- con service_role, filtrando por slug — no desde el navegador.
-- ─────────────────────────────────────────────────────────────

-- Recordatorio aparte: `proyectos.accesos` guarda usuarios y contraseñas de
-- clientes en texto plano. Aunque cierres la base, conviene sacarlos de ahí
-- y moverlos a un gestor de contraseñas.
