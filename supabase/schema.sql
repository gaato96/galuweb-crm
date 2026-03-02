-- ============================================================
-- Nexus-CRM — Supabase Database Schema
-- ============================================================

-- Enums
CREATE TYPE etapa_cliente AS ENUM (
  'contacto', 'investigando', 'calificado', 
  'contactado', 'cotizado', 'cliente_actual', 'cliente_finalizado'
);
CREATE TYPE tipo_proyecto AS ENUM ('landing', 'institucional', 'ecommerce');
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
  notas_seguimiento JSONB DEFAULT '[]'::jsonb
);

-- Proyectos
CREATE TABLE proyectos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  tipo_proyecto tipo_proyecto NOT NULL DEFAULT 'landing',
  figma_url TEXT NOT NULL DEFAULT '',
  calendly_url TEXT NOT NULL DEFAULT '',
  slug_portal TEXT NOT NULL UNIQUE,
  estado estado_proyecto NOT NULL DEFAULT 'activo'
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
  categoria categoria_tarea NOT NULL DEFAULT 'otro'
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
