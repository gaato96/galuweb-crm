-- ============================================================
-- Galu-CRM — Bucket de archivos (`galu-assets`)
-- ============================================================
-- Este script crea el bucket que usa `storageStore` en src/lib/store.ts
-- (PDFs de cotizaciones, contratos y logos) y le deja las políticas que
-- necesita la app, que habla con Supabase desde el navegador usando
-- NEXT_PUBLIC_SUPABASE_ANON_KEY (rol `anon`).
--
-- Si al subir un PDF ves "No existe el bucket" o "no permite subir
-- archivos con la clave pública", ejecutá este archivo entero en el
-- SQL Editor de Supabase.
--
-- ⚠️ NOTA DE SEGURIDAD: el bucket queda público de lectura y escribible
-- por `anon`, igual que hoy funcionan el resto de las tablas del CRM.
-- Cuando se haga la migración al servidor descripta en
-- 20260806_seguridad_rls.sql, estas políticas deberían restringirse a
-- `service_role` y las subidas pasar por una ruta de API.
-- ============================================================

-- 1. Crear el bucket (idempotente). Público para que los links del PDF
--    se puedan abrir sin sesión. 50 MB de tope por archivo.
insert into storage.buckets (id, name, public, file_size_limit)
values ('galu-assets', 'galu-assets', true, 52428800)
on conflict (id) do update
set public = true,
    file_size_limit = 52428800;

-- 2. Políticas de acceso sobre storage.objects para este bucket.
drop policy if exists "galu_assets_lectura_publica" on storage.objects;
create policy "galu_assets_lectura_publica"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'galu-assets');

drop policy if exists "galu_assets_subida" on storage.objects;
create policy "galu_assets_subida"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'galu-assets');

drop policy if exists "galu_assets_actualizacion" on storage.objects;
create policy "galu_assets_actualizacion"
on storage.objects for update
to anon, authenticated
using (bucket_id = 'galu-assets')
with check (bucket_id = 'galu-assets');

drop policy if exists "galu_assets_borrado" on storage.objects;
create policy "galu_assets_borrado"
on storage.objects for delete
to anon, authenticated
using (bucket_id = 'galu-assets');
