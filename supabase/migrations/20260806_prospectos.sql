-- ============================================================
-- Galu-CRM — Módulo Planilla de Prospectos (Prospección en frío)
-- Basado en el sistema operativo de contacto en frío (doc 08)
-- Ejecutar en Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS prospectos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- --- Identidad del negocio ---
  negocio TEXT NOT NULL,
  contacto_nombre TEXT NOT NULL DEFAULT '',
  rubro TEXT NOT NULL DEFAULT '',
  especialidad TEXT NOT NULL DEFAULT '',
  ciudad TEXT NOT NULL DEFAULT '',
  direccion TEXT NOT NULL DEFAULT '',

  -- --- Canales y presencia (§3.2) ---
  telefono TEXT NOT NULL DEFAULT '',
  telefono_wa TEXT NOT NULL DEFAULT '',
  whatsapp_publicado BOOLEAN NOT NULL DEFAULT false,
  es_whatsapp_business BOOLEAN,
  instagram_url TEXT NOT NULL DEFAULT '',
  dias_ultimo_post INTEGER,
  sitio_web_url TEXT NOT NULL DEFAULT '',
  maps_url TEXT NOT NULL DEFAULT '',
  canal TEXT NOT NULL DEFAULT 'instagram',              -- instagram | whatsapp

  -- --- Calificación (§3.2, §4, §7.3, §8) ---
  clasificacion_web TEXT NOT NULL DEFAULT 'sin_definir', -- sin_web|solo_redes|web_debil|web_buena|sin_definir
  demanda_busqueda TEXT NOT NULL DEFAULT 'sin_definir',  -- alta|baja|sin_definir
  rating NUMERIC(2,1),
  reviews_count INTEGER,
  cant_profesionales INTEGER,
  escaneo JSONB NOT NULL DEFAULT '{}'::jsonb,            -- EscaneoProspecto (queja, fallas, hito, trabajo)
  dato_usado TEXT NOT NULL DEFAULT '',
  nivel_dato INTEGER,                                    -- 1..4 (derivado del escaneo)
  score INTEGER NOT NULL DEFAULT 0,

  -- --- Embudo (§3.3, §5) ---
  estado TEXT NOT NULL DEFAULT 'sin_calificar',
  motivo_descarte TEXT NOT NULL DEFAULT '',
  fecha_envio DATE,
  fecha_fu1 DATE,
  fecha_fu2 DATE,
  fecha_respuesta DATE,
  quien_leyo TEXT,                                       -- dueno|secretaria|no_se
  revision_url TEXT NOT NULL DEFAULT '',
  mensaje_enviado TEXT NOT NULL DEFAULT '',

  -- --- Vínculos y trazabilidad ---
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  origen TEXT NOT NULL DEFAULT 'manual',                 -- manual|sheets|scraper
  notas TEXT NOT NULL DEFAULT ''
);

-- Evita cargar dos veces el mismo negocio al pasar en limpio la planilla de Sheets.
CREATE UNIQUE INDEX IF NOT EXISTS idx_prospectos_unico
  ON prospectos (lower(negocio), lower(ciudad));

CREATE INDEX IF NOT EXISTS idx_prospectos_estado ON prospectos(estado);
CREATE INDEX IF NOT EXISTS idx_prospectos_rubro ON prospectos(rubro);
CREATE INDEX IF NOT EXISTS idx_prospectos_score ON prospectos(score DESC);
CREATE INDEX IF NOT EXISTS idx_prospectos_nivel ON prospectos(nivel_dato);
CREATE INDEX IF NOT EXISTS idx_prospectos_fecha_envio ON prospectos(fecha_envio);

-- updated_at automático
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prospectos_updated_at ON prospectos;
CREATE TRIGGER trg_prospectos_updated_at
  BEFORE UPDATE ON prospectos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Coherente con el resto de las tablas del CRM (ver nota de seguridad en el análisis:
-- conviene activar RLS + auth en todo el proyecto, no solo acá).
ALTER TABLE prospectos DISABLE ROW LEVEL SECURITY;
