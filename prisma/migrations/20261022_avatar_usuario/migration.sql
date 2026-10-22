-- T-30c: foto de perfil del usuario. URL pública del archivo en el bucket `avatars`
-- (ruta <userId>/<uuid>.<jpg|png>); nula si no tiene foto.
-- Aditiva y re-ejecutable (IF NOT EXISTS). Aplicar a mano (el repo no tiene historial de migraciones):
--   npx prisma db execute --file prisma/migrations/20261022_avatar_usuario/migration.sql --schema prisma/schema.prisma
BEGIN;

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" TEXT;

COMMIT;
