-- Subtítulo opcional del banner (texto bajo el título; p. ej. el primer banner del
-- carrusel del Dashboard del cliente: "Ideal para reuniones de 4 a 15 personas").
-- Nulo si el banner no tiene subtítulo. Máx. 160 caracteres, validado en el DTO.
-- Aditiva y re-ejecutable (IF NOT EXISTS). Aplicar a mano en Supabase (el repo no tiene historial de migraciones):
--   npx prisma db execute --file prisma/migrations/20261104_banner_subtitulo/migration.sql --schema prisma/schema.prisma
BEGIN;

-- AlterTable
ALTER TABLE "banners" ADD COLUMN IF NOT EXISTS "subtitle" TEXT;

COMMIT;
