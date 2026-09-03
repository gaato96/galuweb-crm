-- ============================================================
-- Prospección — Listados nombrados + sistema "agencias" + oferta en el análisis
-- ============================================================
-- Tres cambios que van juntos porque responden al mismo replanteo (ver
-- notas/10-a-quien-le-vendo.md):
--
--  1. LISTADOS. Hasta ahora la única forma de separar prospectos era `sistema`
--     (galu | vivomenu). Con prospección en varios países y varios rubros eso
--     no alcanza: "agencias de Guadalajara" y "agencias de Medellín" son la
--     misma marca y el mismo rubro, y hay que poder medirlas por separado.
--     Un listado = un scrapeo = una tanda medible.
--
--  2. SISTEMA "agencias". Vender a una agencia como proveedor no es el mismo
--     juego que venderle a un comercio: no hay que educar a nadie, no va
--     análisis gratis, y lo que califica es al revés — sirve la agencia que
--     NO ofrece desarrollo web. Score y guion propios, igual que VivoMenu.
--
--  3. OFERTA EN EL ANÁLISIS. El embudo se cortaba justo acá: 5 de 45 pidieron
--     el análisis y ninguno siguió. El análisis entregaba todo el valor y no
--     dejaba ninguna decisión sobre la mesa. Estas tres columnas obligan a que
--     exista un precio y una fecha ANTES de mandarlo.
--
-- Ejecutar en Supabase → SQL Editor.
-- ============================================================

-- ── 1. Listados de prospección ──────────────────────────────

CREATE TABLE IF NOT EXISTS listas_prospeccion (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Cómo lo llama Gastón. Se autogenera al importar, pero es editable.
  nombre TEXT NOT NULL,
  sistema TEXT NOT NULL DEFAULT 'galu',

  -- Las dimensiones van separadas y no metidas dentro del nombre, para poder
  -- preguntar "todo México" o "todas las agencias" sin depender de cómo se
  -- escribió el título ese día.
  pais TEXT NOT NULL DEFAULT '',
  ciudad TEXT NOT NULL DEFAULT '',
  rubro TEXT NOT NULL DEFAULT '',

  origen TEXT NOT NULL DEFAULT 'scraper',   -- scraper | sheets | manual
  objetivo TEXT NOT NULL DEFAULT '',        -- qué se busca probar con esta tanda
  notas TEXT NOT NULL DEFAULT '',
  archivada BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_listas_sistema ON listas_prospeccion(sistema);
CREATE INDEX IF NOT EXISTS idx_listas_archivada ON listas_prospeccion(archivada);

DROP TRIGGER IF EXISTS trg_listas_updated_at ON listas_prospeccion;
CREATE TRIGGER trg_listas_updated_at
  BEFORE UPDATE ON listas_prospeccion
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE listas_prospeccion DISABLE ROW LEVEL SECURITY;

-- ON DELETE SET NULL a propósito: borrar un listado no puede borrar prospectos
-- que ya tienen trabajo encima. Quedan sin listado y se ven en "Sin listado".
ALTER TABLE prospectos
  ADD COLUMN IF NOT EXISTS lista_id UUID REFERENCES listas_prospeccion(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prospectos_lista ON prospectos(lista_id);

-- ── 2. País y calificación de agencias ──────────────────────

-- Con prospección internacional, "ciudad" sola es ambigua: hay un Santiago en
-- Chile, otro en República Dominicana y otro en México.
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS pais TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_prospectos_pais ON prospectos(pais);

-- NULL = todavía no se verificó. Es el filtro que decide todo el sistema
-- "agencias": una agencia que YA ofrece desarrollo web no es prospecto.
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS ofrece_desarrollo_web BOOLEAN;

-- Personas visibles en la web o en LinkedIn. Menos de 3 no terceriza (lo hace
-- el dueño); más de 30 ya tiene proveedor fijo.
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS tam_equipo INTEGER;

-- Sin clientes visibles no hay trabajo que tercerizar.
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS muestra_clientes BOOLEAN;

-- Lo que lista en su página de servicios, tal cual. Es de dónde sale la línea
-- de personalización del mensaje 1.
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS servicios TEXT NOT NULL DEFAULT '';

-- Email: en prospección a agencias del exterior es el canal por defecto, no
-- WhatsApp. La tabla no lo tenía.
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS linkedin_url TEXT NOT NULL DEFAULT '';

-- ── 3. La oferta que cierra el análisis ─────────────────────

-- Sin estos tres campos el mensaje 2 entrega el análisis y no pide nada. Con
-- ellos, el generador de mensajes puede cerrar con "esto lo arreglo por X y lo
-- tenés el Y, lo hacemos?" — que es el paso que faltaba.
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS oferta_titulo TEXT NOT NULL DEFAULT '';
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS oferta_precio TEXT NOT NULL DEFAULT '';
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS oferta_plazo TEXT NOT NULL DEFAULT '';

-- ── 4. Índice único ─────────────────────────────────────────
-- Sigue siendo (negocio, ciudad, sistema): el mismo negocio no debe entrar dos
-- veces al mismo sistema aunque se scrapee en dos listados distintos. Se agrega
-- el país porque hay ciudades homónimas entre países (Santiago, Córdoba, Mérida,
-- La Paz) y sin eso dos agencias distintas se pisaban entre sí.
DROP INDEX IF EXISTS idx_prospectos_unico;
CREATE UNIQUE INDEX IF NOT EXISTS idx_prospectos_unico
  ON prospectos (lower(negocio), lower(ciudad), lower(pais), sistema);
