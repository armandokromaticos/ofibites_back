-- T-19a: flags de catálogo (badge "POPULAR" y "En oferta") en productos y combos.
-- Generado con prisma migrate diff (con IF NOT EXISTS para poder re-ejecutarlo). Aplicar a mano (el repo no tiene historial de migraciones):
--   npx prisma db execute --file prisma/migrations/20261015_catalogo_flags/migration.sql --schema prisma/schema.prisma
BEGIN;

-- AlterTable
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "is_featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "is_on_sale" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "combos" ADD COLUMN IF NOT EXISTS "is_featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "is_on_sale" BOOLEAN NOT NULL DEFAULT false;

COMMIT;
