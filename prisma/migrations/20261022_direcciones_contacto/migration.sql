-- T-31a: "Direcciones y sedes" de Mi perfil. Campos nuevos del Figma en
-- company_addresses: "Quién recibe" / "Teléfono de contacto" (requeridos solo
-- en el DTO de creación, por eso nullable en BD para no romper filas
-- existentes) y "Marcar como sede principal" (un solo primario por empresa,
-- mismo patrón que is_billing).
-- Generado a mano siguiendo el patrón de prisma migrate diff (con IF NOT EXISTS
-- para poder re-ejecutarlo). Aplicar a mano (el repo no tiene historial de migraciones):
--   npx prisma db execute --file prisma/migrations/20261022_direcciones_contacto/migration.sql --schema prisma/schema.prisma
BEGIN;

-- AlterTable
ALTER TABLE "company_addresses" ADD COLUMN IF NOT EXISTS "contact_name" TEXT;
ALTER TABLE "company_addresses" ADD COLUMN IF NOT EXISTS "contact_phone" TEXT;
ALTER TABLE "company_addresses" ADD COLUMN IF NOT EXISTS "is_primary" BOOLEAN NOT NULL DEFAULT false;

COMMIT;
