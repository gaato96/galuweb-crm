-- ============================================================
-- Galu-CRM — Supabase Database Schema
-- ============================================================

-- Enums
CREATE TYPE etapa_cliente AS ENUM (
  'contacto', 'investigando', 'calificado', 
  'contactado', 'cotizado', 'cliente_actual', 'cliente_finalizado', 'no_interesado'
);
CREATE TYPE tipo_proyecto AS ENUM ('landing', 'institucional', 'ecommerce', 'webapp', 'saas');
CREATE TYPE estado_proyecto AS ENUM ('activo', 'pausado', 'finalizado');
CREATE TYPE prioridad AS ENUM ('baja', 'media', 'alta');
CREATE TYPE estado_tarea AS ENUM ('pendiente', 'en_progreso', 'completada');
CREATE TYPE categoria_tarea AS ENUM ('diseno', 'dev', 'marketing', 'contenido', 'seo', 'otro');
CREATE TYPE estado_cotizacion AS ENUM ('borrador', 'enviada', 'aceptada', 'rechazada');
CREATE TYPE tipo_finanza AS ENUM ('ingreso', 'ads', 'gasto', 'herramienta');
CREATE TYPE tipo_recurso AS ENUM ('link', 'video', 'archivo', 'curso', 'plugin', 'inspiracion');

-- Clientes
CREATE TABLE clientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  nombre TEXT NOT NULL,
  negocio TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  tel TEXT NOT NULL DEFAULT '',
  canal TEXT NOT NULL DEFAULT '',
  etapa etapa_cliente NOT NULL DEFAULT 'contacto',
  info_investigacion JSONB DEFAULT NULL,
  msg_whatsapp TEXT NOT NULL DEFAULT '',
  link_demo TEXT NOT NULL DEFAULT '',
  notas_seguimiento JSONB DEFAULT '[]'::jsonb
);

-- Proyectos
CREATE TABLE proyectos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  tipo_proyecto tipo_proyecto NOT NULL DEFAULT 'landing',
  figma_url TEXT NOT NULL DEFAULT '',
  calendly_url TEXT NOT NULL DEFAULT '',
  slug_portal TEXT NOT NULL UNIQUE,
  contrato_url TEXT NOT NULL DEFAULT '',
  estado estado_proyecto NOT NULL DEFAULT 'activo',
  descripcion TEXT NOT NULL DEFAULT '',
  fecha_entrega DATE,
  es_interno BOOLEAN NOT NULL DEFAULT false,
  accesos JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- Tareas
CREATE TABLE tareas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  proyecto_id UUID REFERENCES proyectos(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  prioridad prioridad NOT NULL DEFAULT 'media',
  estado estado_tarea NOT NULL DEFAULT 'pendiente',
  categoria categoria_tarea NOT NULL DEFAULT 'otro',
  bloque TEXT,
  fecha_vencimiento DATE,
  hora_recordatorio TEXT
);

-- Cotizaciones
CREATE TABLE cotizaciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  estado estado_cotizacion NOT NULL DEFAULT 'borrador',
  pdf_url TEXT NOT NULL DEFAULT '',
  notas TEXT NOT NULL DEFAULT ''
);

-- Finanzas
CREATE TABLE finanzas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  proyecto_id UUID REFERENCES proyectos(id) ON DELETE SET NULL,
  monto NUMERIC(12,2) NOT NULL DEFAULT 0,
  tipo tipo_finanza NOT NULL DEFAULT 'ingreso',
  cuotas_totales INTEGER NOT NULL DEFAULT 1,
  cuota_actual INTEGER NOT NULL DEFAULT 1,
  fecha_cobro DATE NOT NULL DEFAULT CURRENT_DATE,
  descripcion TEXT NOT NULL DEFAULT ''
);

-- Briefs
CREATE TABLE briefs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  respuestas JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- Recursos
CREATE TABLE recursos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  titulo TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  tipo tipo_recurso NOT NULL DEFAULT 'link',
  tags TEXT[] NOT NULL DEFAULT '{}',
  descripcion TEXT NOT NULL DEFAULT ''
);

-- Indexes
CREATE INDEX idx_clientes_etapa ON clientes(etapa);
CREATE INDEX idx_proyectos_cliente ON proyectos(cliente_id);
CREATE INDEX idx_proyectos_estado ON proyectos(estado);
CREATE INDEX idx_tareas_proyecto ON tareas(proyecto_id);
CREATE INDEX idx_tareas_estado ON tareas(estado);
CREATE INDEX idx_tareas_prioridad ON tareas(prioridad);
CREATE INDEX idx_cotizaciones_cliente ON cotizaciones(cliente_id);
CREATE INDEX idx_finanzas_proyecto ON finanzas(proyecto_id);
CREATE INDEX idx_finanzas_fecha ON finanzas(fecha_cobro);
CREATE INDEX idx_briefs_cliente ON briefs(cliente_id);

-- Ideas
CREATE TYPE categoria_idea AS ENUM ('cliente_potencial', 'servicio', 'saas', 'software_rubro', 'otro');
CREATE TYPE estado_idea AS ENUM ('borrador', 'investigando', 'aprobada', 'descartada');

CREATE TABLE ideas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  titulo TEXT NOT NULL,
  categoria categoria_idea NOT NULL DEFAULT 'otro',
  descripcion TEXT NOT NULL DEFAULT '',
  rubro TEXT NOT NULL DEFAULT '',
  cliente_potencial TEXT NOT NULL DEFAULT '',
  impacto INTEGER NOT NULL DEFAULT 3 CHECK (impacto >= 1 AND impacto <= 5),
  dificultad INTEGER NOT NULL DEFAULT 3 CHECK (dificultad >= 1 AND dificultad <= 5),
  estado estado_idea NOT NULL DEFAULT 'borrador',
  notas_adicionales TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_ideas_categoria ON ideas(categoria);
CREATE INDEX idx_ideas_estado ON ideas(estado);

-- Disable Row Level Security (RLS) for ideas to match other CRM tables
ALTER TABLE ideas DISABLE ROW LEVEL SECURITY;

-- Updates for Proyectos Propios & Tareas Recurrentes / Pasos
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS tipo_propio TEXT DEFAULT 'web_propia';
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS stack_tecnologico TEXT DEFAULT '';
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS notas_negocio TEXT DEFAULT '';
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS url_producto TEXT DEFAULT '';

ALTER TABLE tareas ADD COLUMN IF NOT EXISTS pasos JSONB DEFAULT '[]'::jsonb;
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS tipo_tarea TEXT DEFAULT 'puntual';
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS frecuencia_recurrente TEXT DEFAULT NULL;
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS ultima_ejecucion TIMESTAMPTZ DEFAULT NULL;

-- ============================================================
-- Puesta al día del esquema (2026-08)
-- Todo lo de acá abajo existía en producción pero faltaba en este archivo,
-- que por eso ya no servía para recrear la base desde cero.
-- ============================================================

-- --- Columnas que fueron apareciendo en Clientes ---
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS pdf_cotizacion_url TEXT DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS mantenimiento_mensual BOOLEAN DEFAULT false;

-- --- Proyectos: fases, documentos, SaaS y branding ---
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS fases JSONB DEFAULT '[]'::jsonb;
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS documentos JSONB DEFAULT '[]'::jsonb;
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS figma_aprobado BOOLEAN DEFAULT false;
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS figma_comentarios TEXT DEFAULT '';
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT '';
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS saas_url TEXT DEFAULT '';
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS version TEXT DEFAULT '';
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS usuarios_activos INTEGER DEFAULT 0;
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS membresias JSONB DEFAULT '[]'::jsonb;

-- --- Tareas: módulo de marketing y contenido ---
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS idea_contenido TEXT DEFAULT '';
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS hook TEXT DEFAULT '';
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS guion TEXT DEFAULT '';
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS notas_visuales TEXT DEFAULT '';
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS plataformas TEXT[] DEFAULT '{}';
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS formato TEXT DEFAULT '';
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS workflow_stage TEXT DEFAULT NULL;
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS editado BOOLEAN DEFAULT false;
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS publicado BOOLEAN DEFAULT false;

-- --- Cotizaciones: web app, secciones del PDF y archivado ---
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS tipo_cotizacion TEXT DEFAULT 'web';
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS especificaciones_webapp JSONB DEFAULT NULL;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS secciones_pdf JSONB DEFAULT NULL;
-- El estado 'archivada' se usa en la app pero faltaba en el enum.
ALTER TYPE estado_cotizacion ADD VALUE IF NOT EXISTS 'archivada';

-- --- Finanzas: cobros, recurrencia y cuotas agrupadas ---
ALTER TABLE finanzas ADD COLUMN IF NOT EXISTS cobrado BOOLEAN DEFAULT false;
ALTER TABLE finanzas ADD COLUMN IF NOT EXISTS fecha_cobrado DATE DEFAULT NULL;
ALTER TABLE finanzas ADD COLUMN IF NOT EXISTS es_recurrente BOOLEAN DEFAULT false;
ALTER TABLE finanzas ADD COLUMN IF NOT EXISTS grupo_cuota TEXT DEFAULT NULL;

-- --- Tablas que faltaban por completo ---

CREATE TABLE IF NOT EXISTS infraestructura (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'hosting',        -- hosting | dominio
  nombre TEXT NOT NULL DEFAULT '',
  proveedor TEXT NOT NULL DEFAULT '',
  fecha_vencimiento DATE,
  costo NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  proyecto_id UUID REFERENCES proyectos(id) ON DELETE SET NULL,
  asunto TEXT NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  estado TEXT NOT NULL DEFAULT 'abierto',      -- abierto | en_progreso | resuelto
  prioridad prioridad NOT NULL DEFAULT 'media'
);

CREATE TABLE IF NOT EXISTS logs_proyecto (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  fecha DATE NOT NULL DEFAULT CURRENT_DATE
);

-- El id es TEXT a propósito: lo genera el cliente como `search-<timestamp>`.
CREATE TABLE IF NOT EXISTS scraper_busquedas (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rubro TEXT NOT NULL DEFAULT '',
  lugar TEXT NOT NULL DEFAULT '',
  titulo_personalizado TEXT,
  total_resultados INTEGER NOT NULL DEFAULT 0,
  sin_web_count INTEGER NOT NULL DEFAULT 0,
  con_whatsapp_count INTEGER NOT NULL DEFAULT 0,
  prospectos JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_infraestructura_cliente ON infraestructura(cliente_id);
CREATE INDEX IF NOT EXISTS idx_infraestructura_venc ON infraestructura(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_tickets_cliente ON tickets(cliente_id);
CREATE INDEX IF NOT EXISTS idx_tickets_estado ON tickets(estado);
CREATE INDEX IF NOT EXISTS idx_logs_proyecto ON logs_proyecto(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_scraper_fecha ON scraper_busquedas(created_at DESC);

-- La tabla `prospectos` está en supabase/migrations/20260806_prospectos.sql
-- El cierre de seguridad está en supabase/migrations/20260806_seguridad_rls.sql



