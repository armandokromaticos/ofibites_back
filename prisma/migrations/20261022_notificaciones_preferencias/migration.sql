-- T-30e: preferencias de notificaciones del usuario ("Mi perfil" > Notificaciones).
-- Catálogo nuevo y separado de NotificationType/notifications (las notificaciones
-- in-app reales de cambio de estado de pedido no cambian). Una fila por (userId, type);
-- sin fila guardada, el default es (emailEnabled true, platformEnabled true). Solo
-- persistencia de la preferencia: ningún correo se envía de verdad desde este repo.
-- Generado a mano (el repo no tiene historial de migraciones) con el mismo patrón
-- re-ejecutable (IF NOT EXISTS) que 20261016_notificaciones y 20261022_avatar_usuario.
-- Aplicar con:
--   npx prisma db execute --file prisma/migrations/20261022_notificaciones_preferencias/migration.sql --schema prisma/schema.prisma
BEGIN;

-- CreateEnum (Postgres no admite CREATE TYPE IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationPreferenceType' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE "NotificationPreferenceType" AS ENUM (
      'ORDER_CONFIRMED_OR_REJECTED',
      'ORDER_STATUS_CHANGED',
      'INVOICE_GENERATED',
      'INVOICE_DUE_SOON_OR_OVERDUE',
      'PAYMENT_STATUS_CHANGED',
      'NEW_ASSORTMENT',
      'QUICK_COFFEE_BREAK_OPTIONS',
      'SUGGESTION_FOR_YOU',
      'TERMS_CHANGES'
    );
  END IF;
END
$$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "notification_preferences" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "user_id" TEXT NOT NULL,
    "type" "NotificationPreferenceType" NOT NULL,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "platform_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notification_preferences_user_id_type_key" UNIQUE ("user_id", "type")
);

-- Defaults en BD repetidos por si la tabla ya existía de una ejecución anterior de este archivo.
ALTER TABLE "notification_preferences" ALTER COLUMN "id" SET DEFAULT (gen_random_uuid())::text;
ALTER TABLE "notification_preferences" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "notification_preferences" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notification_preferences_user_id_idx" ON "notification_preferences"("user_id");

-- AddForeignKey (Postgres no admite ADD CONSTRAINT IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_preferences_user_id_fkey' AND conrelid = '"notification_preferences"'::regclass) THEN
    ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

COMMIT;
