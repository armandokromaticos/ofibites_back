-- T-30a: "Mi perfil" del cliente. Fecha del último cambio o restablecimiento de contraseña
-- (lo marcan POST /auth/change-password y POST /auth/reset-password; nulo hasta entonces).
-- Generado con prisma migrate diff (con IF NOT EXISTS para poder re-ejecutarlo). Aplicar a mano (el repo no tiene historial de migraciones):
--   npx prisma db execute --file prisma/migrations/20261022_perfil_usuario/migration.sql --schema prisma/schema.prisma
BEGIN;

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_changed_at" TIMESTAMP(3);

COMMIT;
