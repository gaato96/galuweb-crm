-- ============================================================
-- Cotizaciones generadas con IA
-- 2026-09-24
-- ============================================================
-- Qué agrega:
--   briefing       lo que se relevó del cliente, la entrada de la IA. Se guarda
--                  para poder regenerar la cotización sin volver a tipear todo.
--   plan_pago      los tramos de pago que el PDF dibuja como tarjetas.
--   fecha_emision  la fecha que sale impresa. Separada de created_at, porque una
--                  cotización se puede cargar hoy y fecharse el día de la reunión.
--   validez_dias   los días que la propuesta se mantiene en pie.
--
-- El nombre lleva la hora además del día a propósito: ya existe una migración
-- 20260924_columnas_al_dia.sql, y el CLI toma como versión el número de
-- adelante. Dos archivos con el mismo 20260924 = el segundo no corre nunca.
--
-- Ejecutar entera en el SQL Editor de Supabase. Correrla dos veces no hace nada.
-- ============================================================

ALTER TABLE cotizaciones
  ADD COLUMN IF NOT EXISTS briefing JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS plan_pago JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fecha_emision DATE,
  ADD COLUMN IF NOT EXISTS validez_dias INTEGER NOT NULL DEFAULT 15;

-- Las que ya existen quedan fechadas el día en que se crearon.
UPDATE cotizaciones SET fecha_emision = created_at::date WHERE fecha_emision IS NULL;
