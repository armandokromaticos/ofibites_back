-- T-34a: onboarding del cliente.
--   * companies.onboarding_completed_at: null = el COMPANY_ADMIN aún no completó
--     el onboarding. Las empresas existentes se marcan completadas (backfill con
--     created_at) para que no vean el onboarding.
--   * company_addresses.type: tipo de sede (OFFICE/WAREHOUSE/OTHER), nullable
--     para no romper filas existentes.
-- Generado a mano siguiendo el patrón de prisma migrate diff y re-ejecutable
-- (IF NOT EXISTS; el enum dentro de un bloque DO). Aplicar a mano (el repo no
-- tiene historial de migraciones):
--   npx prisma db execute --file prisma/migrations/20261103_onboarding/migration.sql --schema prisma/schema.prisma
-- Después, comprobar en information_schema.columns que existen las dos columnas.
BEGIN;

-- CreateEnum (Postgres no admite CREATE TYPE IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CompanyAddressType' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE "CompanyAddressType" AS ENUM ('OFFICE', 'WAREHOUSE', 'OTHER');
  END IF;
END
$$;

-- AlterTable + backfill: las empresas que ya existen no pasan por el onboarding.
-- El UPDATE va en el mismo bloque que crea la columna: si el script se
-- re-ejecuta después del despliegue, no marca como completadas las empresas
-- nuevas que siguen pendientes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'onboarding_completed_at'
  ) THEN
    ALTER TABLE "companies" ADD COLUMN "onboarding_completed_at" TIMESTAMP(3);
    UPDATE "companies" SET "onboarding_completed_at" = "created_at" WHERE "onboarding_completed_at" IS NULL;
  END IF;
END
$$;

-- AlterTable
ALTER TABLE "company_addresses" ADD COLUMN IF NOT EXISTS "type" "CompanyAddressType";

COMMIT;
